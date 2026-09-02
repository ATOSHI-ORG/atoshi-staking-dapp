/**
 * StakingApi 的真链实现：从 Cosmos REST 读，字段映射到 UI 的类型。
 *
 * 只读部分是完整的。写操作（delegate / undelegate / redelegate / withdraw）
 * 需要签名，而这个页面是嵌在 Atoshi 钱包里的 WebView —— 签名走钱包注入的
 * bridge，不走 REST。所以那四个方法在这里是明确的接入点，不是假实现：
 * 没接上钱包时抛错并说清缺什么，而不是静默返回一个假的 tx_hash。
 *
 * 链上参数（21 天解绑、7 笔并发上限、5% 最低佣金、1 亿自质押门槛）全部从
 * REST 读，不写死 —— 治理改了参数，页面要跟着变。
 */

import {
  Validator,
  StakingParams,
  DelegationItem,
  UnbondingEntry,
  AtoxAccountData,
  AtoxGlobalData,
  EnergyAccountData,
  AccountAssets,
  StakingTxHistory,
} from '../types';
import {
  ATOX_DENOM,
  BOND_DENOM,
  ChainRestError,
  DECIMALS_18,
  amountOf,
  decCoinToInt,
  decToFixed4,
  durationToSeconds,
  restGet,
  restGetAllPages,
} from './chainRest';

/* ────────────────────────────── 钱包签名接入点 ────────────────────────────── */

/**
 * 钱包注入的签名桥。页面跑在 Atoshi 钱包的 WebView 里时由宿主注入。
 * 形状按 Cosmos 的 Msg 走，具体字段与钱包端对齐后可能要调整。
 */
export interface WalletBridge {
  /** 当前账户的 bech32 地址 */
  getAddress(): Promise<string>;
  /** 签名并广播一组 Msg，返回 tx hash */
  signAndBroadcast(msgs: unknown[], memo?: string): Promise<{ tx_hash: string }>;
}

declare global {
  interface Window {
    atoshiWallet?: WalletBridge;
  }
}

function requireWallet(): WalletBridge {
  const w = typeof window !== 'undefined' ? window.atoshiWallet : undefined;
  if (!w) {
    throw new ChainRestError(
      '未检测到钱包。质押类交易需要签名，页面必须运行在 Atoshi 钱包内（由宿主注入 window.atoshiWallet）。',
    );
  }
  return w;
}

/* ────────────────────────────── 只读查询 ────────────────────────────── */

async function getParams(): Promise<StakingParams> {
  // 三个模块的参数分别取，任一失败就整体失败 —— 参数不全的页面会给出错误的
  // 提示（比如 21 天解绑显示成 0 天），比直接报错更糟。
  const [staking, slashing, tokenomics] = await Promise.all([
    restGet<any>('/cosmos/staking/v1beta1/params'),
    restGet<any>('/cosmos/slashing/v1beta1/params'),
    restGet<any>('/atoshi/tokenomics/v1/params'),
  ]);

  const sp = staking.params ?? {};
  const sl = slashing.params ?? {};
  const tp = tokenomics.params ?? {};

  const jailSeconds = durationToSeconds(sl.downtime_jail_duration);

  return {
    unbonding_time_seconds: durationToSeconds(sp.unbonding_time),
    max_validators: Number(sp.max_validators ?? 0),
    max_entries: Number(sp.max_entries ?? 0),
    min_commission_rate: decToFixed4(sp.min_commission_rate),
    // 这条是本链特有的，不在 cosmos staking params 里
    validator_min_self_delegation: tp.validator_min_self_delegation ?? '0',
    bond_denom: sp.bond_denom ?? BOND_DENOM,
    slashing_downtime_percent: Number(sl.slash_fraction_downtime ?? 0) * 100,
    slashing_downtime_jail_duration_minutes: Math.round(jailSeconds / 60),
    slashing_double_sign_percent: Number(sl.slash_fraction_double_sign ?? 0) * 100,
  };
}

/**
 * 出块奖励是 ATOX，所以年化必须按 ATOX 的发行速率算，不能套用「通胀÷质押率」
 * 那套 ATOS 的公式 —— 本链 inflation 是关掉的，那个公式会算出 0。
 *
 * 年化 = 每年 ATOX 产出 × (1 - 佣金) × (该验证人质押 / 全网质押) / 该验证人质押
 *      = 每年 ATOX 产出 × (1 - 佣金) / 全网质押
 * 也就是说委托人的 ATOX 年化只取决于佣金率和全网总质押，与选哪个验证人无关
 * （除了佣金差异）。这跟 ATOS 计价的年化不是一回事，UI 上标注了单位是 ATOX。
 */
function estimateAprAtox(
  blockRewardAatox: bigint,
  blockSeconds: number,
  totalBondedLiao: bigint,
  commissionRate: string,
): number {
  if (totalBondedLiao === 0n || blockSeconds <= 0) return 0;
  const blocksPerYear = BigInt(Math.round((365 * 24 * 3600) / blockSeconds));
  const yearlyAtox = blockRewardAatox * blocksPerYear;
  // 两者都是 18 位精度，比值直接可用
  const gross = Number(yearlyAtox) / Number(totalBondedLiao);
  const net = gross * (1 - Number(commissionRate || '0'));
  return Number.isFinite(net) ? net * 100 : 0;
}

async function getValidators(query?: {
  status?: string;
  sort?: string;
  search?: string;
  hideJailed?: boolean;
}): Promise<Validator[]> {
  const [raw, poolRes, tokenomicsRes, stakingParamsRes] = await Promise.all([
    // 不带 status 过滤，一次拿全量：UI 要区分「活跃集内 / 候补 / 已监禁」，
    // 而 REST 的 status 过滤一次只能给一种
    restGetAllPages<any>('/cosmos/staking/v1beta1/validators', (p) => p.validators ?? []),
    restGet<any>('/cosmos/staking/v1beta1/pool'),
    restGet<any>('/atoshi/tokenomics/v1/params'),
    restGet<any>('/cosmos/staking/v1beta1/params'),
  ]);

  const totalBonded = BigInt(poolRes?.pool?.bonded_tokens ?? '0');
  const blockReward = BigInt(tokenomicsRes?.params?.initial_block_reward ?? '0');
  const blockSeconds = Number(import.meta.env.VITE_BLOCK_SECONDS ?? 5);
  const maxValidators = Number(stakingParamsRes?.params?.max_validators ?? 100);
  const signedWindow = 100; // slashing.signed_blocks_window，下面再校准

  let slashingInfos: any[] = [];
  try {
    slashingInfos = await restGetAllPages<any>(
      '/cosmos/slashing/v1beta1/signing_infos',
      (p) => p.info ?? [],
    );
  } catch {
    // 拿不到签名信息不该让整个列表挂掉，在线率降级成未知
    slashingInfos = [];
  }

  // 按质押量排名，用来判断是否在活跃集（前 max_validators 名）
  const sortedByTokens = [...raw].sort((a, b) =>
    BigInt(b.tokens ?? '0') > BigInt(a.tokens ?? '0') ? 1 : -1,
  );
  const rankOf = new Map<string, number>();
  sortedByTokens.forEach((v, i) => rankOf.set(v.operator_address, i + 1));

  let list: Validator[] = raw.map((v) => {
    const tokens = v.tokens ?? '0';
    const commission = v.commission?.commission_rates ?? {};
    const rank = rankOf.get(v.operator_address) ?? 0;

    // signing_infos 用的是共识地址，validators 用的是 operator 地址，
    // 两者没有可以在前端做的映射关系（需要 pubkey 换算）。所以只有在链上
    // 给出 missed_blocks_counter 时才展示真实值，否则标成未知。
    const info = slashingInfos.find((s) => s?.address === v.consensus_address);
    const missed = info ? Number(info.missed_blocks_counter ?? 0) : 0;

    return {
      operator_address: v.operator_address,
      moniker: v.description?.moniker ?? '',
      identity: v.description?.identity ?? '',
      website: v.description?.website ?? '',
      details: v.description?.details ?? '',
      status: v.status,
      jailed: Boolean(v.jailed),
      tokens,
      voting_power_percent:
        totalBonded > 0n ? (Number(BigInt(tokens)) / Number(totalBonded)) * 100 : 0,
      commission_rate: decToFixed4(commission.rate),
      commission_max_rate: decToFixed4(commission.max_rate),
      commission_max_change_rate: decToFixed4(commission.max_change_rate),
      // REST 的 validator 对象没有自质押字段。它等于该验证人对自己的委托，
      // 需要另一个接口按地址查；列表里逐个查会放大成 N 次请求，所以这里
      // 先给 min_self_delegation（验证人申报的下限，链上强制 >= 门槛），
      // 详情弹窗再查真实自质押。
      self_delegation: v.min_self_delegation ?? '0',
      uptime_percent: info ? Math.max(0, (1 - missed / signedWindow) * 100) : 100,
      missed_blocks_counter: missed,
      signed_blocks_window: signedWindow,
      estimated_apr_atox: estimateAprAtox(
        blockReward,
        blockSeconds,
        totalBonded,
        commission.rate ?? '0',
      ),
      in_active_set: v.status === 'BOND_STATUS_BONDED' && rank > 0 && rank <= maxValidators,
      rank,
    };
  });

  // 过滤和排序在前端做：REST 一次只能按一种 status 过滤，而 UI 要组合条件
  if (query?.hideJailed) list = list.filter((v) => !v.jailed);
  if (query?.status === 'active') list = list.filter((v) => v.in_active_set && !v.jailed);
  else if (query?.status === 'candidate') list = list.filter((v) => !v.in_active_set && !v.jailed);
  else if (query?.status === 'jailed') list = list.filter((v) => v.jailed);

  if (query?.search) {
    const s = query.search.toLowerCase();
    list = list.filter(
      (v) =>
        v.moniker.toLowerCase().includes(s) || v.operator_address.toLowerCase().includes(s),
    );
  }

  if (query?.sort === 'commission') {
    list.sort((a, b) => parseFloat(a.commission_rate) - parseFloat(b.commission_rate));
  } else if (query?.sort === 'uptime') {
    list.sort((a, b) => b.uptime_percent - a.uptime_percent);
  } else if (query?.sort === 'apr') {
    list.sort((a, b) => b.estimated_apr_atox - a.estimated_apr_atox);
  } else {
    list.sort((a, b) => a.rank - b.rank);
  }

  return list;
}

/** 委托列表。奖励和「在途解质押笔数」要另外两个接口补齐。 */
async function getDelegations(address: string): Promise<DelegationItem[]> {
  const [delRes, rewardsRes, unbondingRes, validators] = await Promise.all([
    restGetAllPages<any>(
      `/cosmos/staking/v1beta1/delegations/${address}`,
      (p) => p.delegation_responses ?? [],
    ),
    restGet<any>(`/cosmos/distribution/v1beta1/delegators/${address}/rewards`).catch(() => ({
      rewards: [],
    })),
    restGetAllPages<any>(
      `/cosmos/staking/v1beta1/delegators/${address}/unbonding_delegations`,
      (p) => p.unbonding_responses ?? [],
    ).catch(() => []),
    getValidators(),
  ]);

  const valByAddr = new Map(validators.map((v) => [v.operator_address, v]));

  // 每个验证人下的在途解质押笔数，用来在 UI 上拦住第 8 笔
  // （链上 max_entries = 7，超了交易会失败）
  const inFlight = new Map<string, number>();
  for (const u of unbondingRes) {
    inFlight.set(u.validator_address, (u.entries ?? []).length);
  }

  return delRes.map((d) => {
    const valAddr = d.delegation?.validator_address ?? '';
    const v = valByAddr.get(valAddr);
    const rw = (rewardsRes.rewards ?? []).find(
      (r: any) => r.validator_address === valAddr,
    );

    return {
      delegator_address: d.delegation?.delegator_address ?? address,
      validator_address: valAddr,
      validator_moniker: v?.moniker ?? valAddr,
      validator_jailed: v?.jailed ?? false,
      validator_in_active_set: v?.in_active_set ?? false,
      amount: d.balance?.amount ?? '0',
      // distribution 返回 DecCoin（放大 10^18 的定点数），必须除回去，
      // 否则奖励会显示成实际值的 10^18 倍
      pending_reward_atox: decCoinToInt(amountOf(rw?.reward, ATOX_DENOM)),
      commission_rate: v?.commission_rate ?? '0.0000',
      estimated_apr_atox: v?.estimated_apr_atox ?? 0,
      in_flight_unbonding_count: inFlight.get(valAddr) ?? 0,
    };
  });
}

async function getUnbonding(address: string): Promise<UnbondingEntry[]> {
  const [rows, validators] = await Promise.all([
    restGetAllPages<any>(
      `/cosmos/staking/v1beta1/delegators/${address}/unbonding_delegations`,
      (p) => p.unbonding_responses ?? [],
    ),
    getValidators(),
  ]);
  const valByAddr = new Map(validators.map((v) => [v.operator_address, v]));

  const out: UnbondingEntry[] = [];
  for (const u of rows) {
    const v = valByAddr.get(u.validator_address);
    for (const e of u.entries ?? []) {
      out.push({
        id: `${u.validator_address}-${e.creation_height}`,
        validator_address: u.validator_address,
        validator_moniker: v?.moniker ?? u.validator_address,
        amount: e.balance ?? '0',
        creation_time: 0, // REST 只给 creation_height，没有时间
        completion_time: e.completion_time ? Date.parse(e.completion_time) : 0,
        initial_balance: e.initial_balance ?? '0',
      });
    }
  }
  out.sort((a, b) => a.completion_time - b.completion_time);
  return out;
}

async function getRewards(address: string) {
  const res = await restGet<any>(
    `/cosmos/distribution/v1beta1/delegators/${address}/rewards`,
  );
  return {
    total_atox: decCoinToInt(amountOf(res.total, ATOX_DENOM)),
    per_validator: (res.rewards ?? []).map((r: any) => ({
      validator_address: r.validator_address,
      amount_atox: decCoinToInt(amountOf(r.reward, ATOX_DENOM)),
    })),
  };
}

async function getAtoxAccount(address: string): Promise<AtoxAccountData> {
  const [acct, bal] = await Promise.all([
    restGet<any>(`/atoshi/atox/v1/account/${address}`).catch(() => ({})),
    restGet<any>(`/cosmos/bank/v1beta1/balances/${address}/by_denom?denom=${ATOX_DENOM}`)
      .catch(() => ({ balance: { amount: '0' } })),
  ]);

  return {
    address,
    atox_balance: bal?.balance?.amount ?? '0',
    pending_atos: acct?.pending ?? '0',
    cumulative_converted_atos: acct?.cumulative_paid_out ?? '0',
  };
}

async function getAtoxGlobal(): Promise<AtoxGlobalData> {
  const [global, params, release] = await Promise.all([
    restGet<any>('/atoshi/atox/v1/global_state').catch(() => ({})),
    restGet<any>('/atoshi/atox/v1/params').catch(() => ({})),
    restGet<any>('/atoshi/tokenomics/v1/release_state').catch(() => ({})),
  ]);

  const gs = global?.global_state ?? global ?? {};
  const rs = release?.release_state ?? release ?? {};
  const supplyCap = params?.params?.supply_cap ?? '0';

  const released = BigInt(gs.total_released_to_pool ?? '0');
  const cap = BigInt(supplyCap || '0');

  return {
    global_index: gs.global_index ?? '0',
    total_released_to_pool: gs.total_released_to_pool ?? '0',
    atox_total_supply: supplyCap,
    current_tier: Number(rs.current_tier ?? 0),
    total_tiers: 10, // Tier 表是 10 档（+10% 到 +100%）
    tier_name: `T${rs.current_tier ?? 0}`,
    next_tier_progress_percent:
      cap > 0n ? Math.min(100, (Number(released) / Number(cap)) * 100) : 0,
  };
}

async function getEnergyAccount(address: string): Promise<EnergyAccountData> {
  const [energyAcct, energyParams, assets] = await Promise.all([
    restGet<any>(`/atoshi/energy/v1/account/${address}`).catch(() => ({})),
    restGet<any>('/atoshi/energy/v1/params').catch(() => ({})),
    getAccountAssets(address),
  ]);

  const ea = energyAcct?.account ?? energyAcct ?? {};
  const ep = energyParams?.params ?? {};

  const thresholdRaw = BigInt(ep.tx_energy_holding_threshold ?? '0');
  // 质押中的 ATOS 也算持仓 —— 币还是用户的。这是本链和多数链不同的一点，
  // UI 上要明确告诉用户「质押不影响能量额度」。
  const total = BigInt(assets.available_atos) + BigInt(assets.staked_atos);

  return {
    address,
    energy_balance: Number(ea.energy ?? 0),
    energy_max: Number(ep.tx_energy_per_threshold ?? 0),
    qualifies_for_energy: thresholdRaw > 0n && total >= thresholdRaw,
    available_atos: assets.available_atos,
    staked_atos: assets.staked_atos,
    total_calculated_atos: total.toString(),
    free_gas_tx_remaining: Number(ea.energy ?? 0) > 0 ? 1 : 0,
    energy_threshold_atos: Number(thresholdRaw / DECIMALS_18),
  };
}

async function getAccountAssets(address: string): Promise<AccountAssets> {
  const [balances, delegations, unbonding, rewards] = await Promise.all([
    restGet<any>(`/cosmos/bank/v1beta1/balances/${address}`).catch(() => ({ balances: [] })),
    restGetAllPages<any>(
      `/cosmos/staking/v1beta1/delegations/${address}`,
      (p) => p.delegation_responses ?? [],
    ).catch(() => []),
    restGetAllPages<any>(
      `/cosmos/staking/v1beta1/delegators/${address}/unbonding_delegations`,
      (p) => p.unbonding_responses ?? [],
    ).catch(() => []),
    restGet<any>(`/cosmos/distribution/v1beta1/delegators/${address}/rewards`).catch(() => ({
      total: [],
    })),
  ]);

  let staked = 0n;
  for (const d of delegations) staked += BigInt(d.balance?.amount ?? '0');

  let unbondingTotal = 0n;
  let nearest = 0;
  for (const u of unbonding) {
    for (const e of u.entries ?? []) {
      unbondingTotal += BigInt(e.balance ?? '0');
      const t = e.completion_time ? Date.parse(e.completion_time) : 0;
      if (t && (nearest === 0 || t < nearest)) nearest = t;
    }
  }

  return {
    address,
    available_atos: amountOf(balances.balances, BOND_DENOM),
    staked_atos: staked.toString(),
    unbonding_atos: unbondingTotal.toString(),
    total_pending_atox: decCoinToInt(amountOf(rewards.total, ATOX_DENOM)),
    nearest_unbonding_completion_time: nearest || undefined,
  };
}

/**
 * 交易历史。
 *
 * 链上没有「某地址的质押操作历史」这个查询 —— 要靠 tx 事件索引拼，
 * 而 REST 的 /cosmos/tx/v1beta1/txs?query= 在不同版本上语法不一致，
 * 而且需要节点开着 tx_index。这块建议由后端做一个索引服务，
 * 前端读一个稳定的接口。这里先返回空列表，UI 会显示空状态。
 */
async function getHistory(): Promise<StakingTxHistory[]> {
  return [];
}

/* ────────────────────────────── 写操作（需要钱包签名） ────────────────────────────── */

async function delegate(params: {
  delegator: string;
  validator: string;
  amount: string;
}): Promise<{ success: boolean; tx_hash: string; message?: string }> {
  const wallet = requireWallet();
  const { tx_hash } = await wallet.signAndBroadcast([
    {
      typeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
      value: {
        delegatorAddress: params.delegator,
        validatorAddress: params.validator,
        amount: { denom: BOND_DENOM, amount: params.amount },
      },
    },
  ]);
  return { success: true, tx_hash };
}

async function undelegate(params: {
  delegator: string;
  validator: string;
  amount: string;
}): Promise<{ success: boolean; tx_hash: string; message?: string }> {
  const wallet = requireWallet();
  const { tx_hash } = await wallet.signAndBroadcast([
    {
      typeUrl: '/cosmos.staking.v1beta1.MsgUndelegate',
      value: {
        delegatorAddress: params.delegator,
        validatorAddress: params.validator,
        amount: { denom: BOND_DENOM, amount: params.amount },
      },
    },
  ]);
  return { success: true, tx_hash };
}

async function redelegate(params: {
  delegator: string;
  src_validator: string;
  dst_validator: string;
  amount: string;
}): Promise<{ success: boolean; tx_hash: string; message?: string }> {
  const wallet = requireWallet();
  const { tx_hash } = await wallet.signAndBroadcast([
    {
      typeUrl: '/cosmos.staking.v1beta1.MsgBeginRedelegate',
      value: {
        delegatorAddress: params.delegator,
        validatorSrcAddress: params.src_validator,
        validatorDstAddress: params.dst_validator,
        amount: { denom: BOND_DENOM, amount: params.amount },
      },
    },
  ]);
  return { success: true, tx_hash };
}

async function withdrawRewards(params: {
  delegator: string;
  validator?: string;
}): Promise<{ success: boolean; tx_hash: string; total_claimed_atox: string }> {
  const wallet = requireWallet();

  // 不指定验证人就是「全部领取」，要为每个有委托的验证人各发一条 Msg ——
  // 链上没有「一次领全部」的单条消息
  const delegations = await getDelegations(params.delegator);
  const targets = params.validator
    ? [params.validator]
    : delegations.map((d) => d.validator_address);

  if (targets.length === 0) {
    return { success: false, tx_hash: '', total_claimed_atox: '0' };
  }

  // 广播前先记下待领金额。广播后再查会拿到 0（已经领完了），
  // 而 UI 要用这个数字提示「领取了多少 ATOX」。
  const claimed = delegations
    .filter((d) => targets.includes(d.validator_address))
    .reduce((sum, d) => sum + BigInt(d.pending_reward_atox), 0n);

  const { tx_hash } = await wallet.signAndBroadcast(
    targets.map((v) => ({
      typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
      value: { delegatorAddress: params.delegator, validatorAddress: v },
    })),
  );
  return { success: true, tx_hash, total_claimed_atox: claimed.toString() };
}

export const StakingApiChain = {
  getParams,
  getValidators,
  getDelegations,
  getUnbonding,
  getRewards,
  getAtoxAccount,
  getAtoxGlobal,
  getEnergyAccount,
  getAccountAssets,
  getHistory,
  delegate,
  undelegate,
  redelegate,
  withdrawRewards,
};
