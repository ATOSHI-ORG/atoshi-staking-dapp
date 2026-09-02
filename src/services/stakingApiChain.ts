/**
 * StakingApi 的真链实现。读和写走两条不同的路：
 *
 *   读 → Cosmos REST（app.toml 的 [api]，1317）
 *   写 → EVM 预编译（0x…0800 staking / 0x…0801 distribution），钱包签名
 *
 * 为什么不统一成一条：
 *  - 写不能走 REST。质押是 Cosmos 消息（MsgDelegate），以太坊钱包签不了。
 *    但链上开了这两个预编译，于是质押可以变成一笔普通 EVM 交易，
 *    MetaMask / OKX / 钱包 WebView 注入的 provider 全都能签。这是这个 DApp
 *    能直接用 wagmi、不必自己写钱包 bridge 的前提。
 *  - 读不走预编译。预编译的 view 方法一次只能查一个验证人，而且拿不到
 *    在线率、解质押完成时间这些只有 REST 才给的字段。列表页用 REST 便宜得多。
 *
 * 链上参数（21 天解绑、7 笔并发上限、5% 最低佣金、1 亿自质押门槛）全部从
 * REST 读，不写死 —— 治理改了参数，页面要跟着变。
 *
 * 所有 REST 路径和返回字段都逐条对过真链（atoshi_88288-1），不是按字段名猜的。
 * 改这个文件时请照样对一遍：猜错的字段读出来是 undefined，UI 静默显示 0，
 * 比报错难查得多。
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

/* ────────────────────────────── 钱包写操作 ────────────────────────────── */

/**
 * 读走 Cosmos REST，写走 EVM 预编译。
 *
 * 为什么不是两边都用一种：
 *  - 写：质押是 Cosmos 消息，以太坊钱包签不了；但链上开了 staking/distribution
 *    预编译，于是可以变成一笔普通 EVM 交易，MetaMask/OKX/钱包内注入的
 *    provider 全都能签。这是不用自己写钱包 bridge 的前提。
 *  - 读：预编译也有 view 方法，但一次只能查一个验证人，而且拿不到 REST 才有的
 *    在线率、解质押完成时间这些字段。列表页用 REST 一次拿全量便宜得多。
 *
 * 用 wagmi 的命令式 actions（不是 hooks），这样 StakingApi 保持普通对象的形状，
 * 上层 UI 一行都不用改。
 */

import { getAccount, waitForTransactionReceipt, writeContract } from 'wagmi/actions';

import { atoshi, toBech32, toHex } from '../wallet/chain';
import { wagmiConfig } from '../wallet/config';
import {
  DISTRIBUTION_PRECOMPILE,
  GAS_LIMITS,
  STAKING_PRECOMPILE,
  distributionAbi,
  stakingAbi,
} from '../wallet/precompiles';

/** 当前已连接的 0x 地址；没连钱包就抛出能看懂的错误。 */
function requireAccount(): `0x${string}` {
  const { address, isConnected } = getAccount(wagmiConfig);
  if (!isConnected || !address) {
    throw new ChainRestError('请先连接钱包。质押类操作需要签名。');
  }
  return address;
}

/**
 * 广播并等上链。
 *
 * 必须等 receipt 而不是拿到 hash 就返回：预编译调用失败时交易照样上链，
 * 只是 status = 'reverted'。不检查的话 UI 会显示「质押成功」而链上什么都没发生。
 *
 * 参数收成一个闭包而不是抽出参数类型：`Parameters<typeof writeContract>[1]`
 * 会把泛型塌成约束上界，既丢掉 ABI 的类型检查，又把本该可选的 chain/account
 * 变成必填。让 writeContract 在调用处直接推断才有意义。
 */
async function sendTx(send: () => Promise<`0x${string}`>): Promise<string> {
  const hash = await send();
  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
  if (receipt.status !== 'success') {
    throw new ChainRestError(`交易已上链但执行失败（reverted），tx: ${hash}`);
  }
  return hash;
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
 * 收益率：每质押 1 ATOS，一年能拿到多少个 ATOX。
 *
 * 单位是 ATOX/ATOS，**不是百分比**。这一点很容易写错，说清楚原因：
 * 出块奖励是 ATOX，质押的是 ATOS，两个不同的币，比值没法写成百分号 ——
 * 百分比要求分子分母同单位。也换不成百分比：ATOX 没有市场价（它是靠 tier
 * 释放按兑换池比例结算成 ATOS 的，比例随池子变），oracle 只喂 ATOS 的价。
 *
 * 实测（块高 2400）这个比值是 78 ATOX/ATOS，写成 "7031%" 会让用户以为
 * 一年翻 70 倍。我第一版就是这么错的。
 *
 * 也不能套用「通胀率 ÷ 质押率」那套 ATOS 的公式 —— 本链 inflation 是关掉的，
 * 那个公式会算出 0。
 *
 * 比值 = 每年 ATOX 产出 × (1-佣金) × (该验证人质押/全网质押) / 该验证人质押
 *      = 每年 ATOX 产出 × (1-佣金) / 全网质押
 * 约掉之后与选哪个验证人无关，只取决于佣金率和全网总质押。
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
  // 不乘 100 —— 返回的是 ATOX/ATOS 的比值本身，不是百分比
  return Number.isFinite(net) ? net : 0;
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
    // block_reward 给的是「当前」每块产出，已经算进减半。
    // 不能用 tokenomics params 里的 initial_block_reward —— 那是创世值，
    // 每过一个 halving_interval_blocks 就翻倍偏高（实测块高 2361 时链上
    // current_reward 是 4954.75 ATOX，而 initial 是 19819，差 4 倍）。
    restGet<any>('/atoshi/tokenomics/v1/block_reward'),
    restGet<any>('/cosmos/staking/v1beta1/params'),
  ]);

  const totalBonded = BigInt(poolRes?.pool?.bonded_tokens ?? '0');
  const blockReward = BigInt(tokenomicsRes?.current_reward ?? '0');
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

  // 实测返回形状（块高 2400，atoshi_88288-1）：
  //   { account: { address, index, pending, total_claimed },
  //     atox_balance, unsettled, claimable }
  // 逐条对过链上的返回，不要凭字段名猜 —— 我第一版写的 acct.pending 和
  // acct.cumulative_paid_out 都读不到东西，永远显示 0。
  const a = acct?.account ?? {};

  return {
    address,
    // 模块自己给了 atox_balance，优先用它；bank 那条是兜底（模块查询失败时）
    atox_balance: acct?.atox_balance ?? bal?.balance?.amount ?? '0',
    // pending = 已结算待兑换的部分，unsettled = 还没结算进 index 的部分，
    // 两者都是用户「拿得到但还没到账」的 ATOX，UI 上是一个数字，得加起来
    pending_atos: (
      BigInt(a.pending ?? '0') + BigInt(acct?.unsettled ?? '0')
    ).toString(),
    cumulative_converted_atos: a.total_claimed ?? '0',
  };
}

async function getAtoxGlobal(): Promise<AtoxGlobalData> {
  const [global, params, release] = await Promise.all([
    restGet<any>('/atoshi/atox/v1/global_state').catch(() => ({})),
    restGet<any>('/atoshi/atox/v1/params').catch(() => ({})),
    // 是 release_status，不是 release_state —— 后者链上没注册，REST 返回 501。
    // 路径以 proto/atoshi/tokenomics/v1/query.proto 里的 google.api.http 为准。
    restGet<any>('/atoshi/tokenomics/v1/release_status').catch(() => ({})),
  ]);

  // 两个自定义模块的返回都把结构体包在 "state" 里，不是 "global_state"/"release_state"
  const gs = global?.state ?? {};
  const rs = release?.state ?? {};
  const supplyCap = params?.params?.supply_cap ?? '0';

  // 已发行的 ATOX 实际流通量，模块直接给了；不要拿 supply_cap 当总量 ——
  // cap 是 1 万亿 ATOX 的上限，实际流通只有 3 千多万，差 5 个数量级，
  // 用 cap 算进度会永远显示 0%。
  const released = BigInt(global?.atox_supply ?? gs.total_released_to_pool ?? '0');
  const cap = BigInt(supplyCap || '0');

  return {
    global_index: gs.global_index ?? '0',
    total_released_to_pool: gs.total_released_to_pool ?? '0',
    atox_total_supply: global?.atox_supply ?? '0',
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

  // 实测返回形状：
  //   { settled: { tx_energy_accrued, deploy_energy_accrued, last_balance_snapshot, ... },
  //     tx_energy_capacity, deploy_energy_capacity }
  // 没有 account 这一层，也没有叫 energy 的字段。
  const ea = energyAcct?.settled ?? {};
  const ep = energyParams?.params ?? {};

  // 上限用模块算好的 tx_energy_capacity，不要拿 tx_energy_per_threshold 当上限 ——
  // 后者是「每满一个门槛给多少」（50,000），而上限是它乘以门槛个数
  // （2 亿 ATOS / 3 万 = 6666 个门槛 → 333,300,000）。差 6000 多倍。
  const capacity = Number(energyAcct?.tx_energy_capacity ?? 0);
  const accrued = Number(ea.tx_energy_accrued ?? 0);

  const thresholdRaw = BigInt(ep.tx_energy_holding_threshold ?? '0');
  // 质押中的 ATOS 也算持仓 —— 币还是用户的。这是本链和多数链不同的一点，
  // UI 上要明确告诉用户「质押不影响能量额度」。
  const total = BigInt(assets.available_atos) + BigInt(assets.staked_atos);

  return {
    address,
    energy_balance: accrued,
    energy_max: capacity,
    qualifies_for_energy: thresholdRaw > 0n && total >= thresholdRaw,
    available_atos: assets.available_atos,
    staked_atos: assets.staked_atos,
    total_calculated_atos: total.toString(),
    // 能量的单位就是 gas。一笔普通转账约 100k gas，用它换算成「还能免费发几笔」。
    // 是个量级估计，不是保证 —— 预编译调用要 50 万以上，用户实际能发的更少。
    free_gas_tx_remaining: Math.floor(accrued / 100_000),
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

/* ────────────────────────────── 写操作（走 EVM 预编译） ────────────────────────────── */

/**
 * 传进来的 delegator 可能是 bech32（UI 从 REST 拿到的）也可能是 0x（钱包给的）。
 * 预编译要 0x，而且必须是当前连接的那个账户 —— 让别人替你质押链上会拒绝。
 */
function delegatorArg(delegator: string): `0x${string}` {
  const connected = requireAccount();
  const want = toHex(delegator);
  if (want.toLowerCase() !== connected.toLowerCase()) {
    throw new ChainRestError(
      `页面上的账户（${toBech32(delegator)}）和钱包当前账户不一致，请在钱包里切换后重试。`,
    );
  }
  return connected;
}

async function delegate(params: {
  delegator: string;
  validator: string;
  amount: string;
}): Promise<{ success: boolean; tx_hash: string; message?: string }> {
  const account = delegatorArg(params.delegator);
  const tx_hash = await sendTx(() =>
    writeContract(wagmiConfig, {
      account,
      chain: atoshi,
      address: STAKING_PRECOMPILE,
      abi: stakingAbi,
      functionName: 'delegate',
      args: [account, params.validator, BigInt(params.amount)],
      gas: GAS_LIMITS.delegate,
    }),
  );
  return { success: true, tx_hash };
}

async function undelegate(params: {
  delegator: string;
  validator: string;
  amount: string;
}): Promise<{ success: boolean; tx_hash: string; message?: string }> {
  const account = delegatorArg(params.delegator);
  const tx_hash = await sendTx(() =>
    writeContract(wagmiConfig, {
      account,
      chain: atoshi,
      address: STAKING_PRECOMPILE,
      abi: stakingAbi,
      functionName: 'undelegate',
      args: [account, params.validator, BigInt(params.amount)],
      gas: GAS_LIMITS.undelegate,
    }),
  );
  return { success: true, tx_hash };
}

async function redelegate(params: {
  delegator: string;
  src_validator: string;
  dst_validator: string;
  amount: string;
}): Promise<{ success: boolean; tx_hash: string; message?: string }> {
  const account = delegatorArg(params.delegator);
  const tx_hash = await sendTx(() =>
    writeContract(wagmiConfig, {
      account,
      chain: atoshi,
      address: STAKING_PRECOMPILE,
      abi: stakingAbi,
      functionName: 'redelegate',
      args: [account, params.src_validator, params.dst_validator, BigInt(params.amount)],
      gas: GAS_LIMITS.redelegate,
    }),
  );
  return { success: true, tx_hash };
}

async function withdrawRewards(params: {
  delegator: string;
  validator?: string;
}): Promise<{ success: boolean; tx_hash: string; total_claimed_atox: string }> {
  const account = delegatorArg(params.delegator);

  // 广播前先记下待领金额。广播后再查会拿到 0（已经领完了），
  // 而 UI 要用这个数字提示「领取了多少 ATOX」。
  const delegations = await getDelegations(params.delegator);
  const targets = params.validator
    ? [params.validator]
    : delegations.map((d) => d.validator_address);

  if (targets.length === 0) {
    return { success: false, tx_hash: '', total_claimed_atox: '0' };
  }

  const claimed = delegations
    .filter((d) => targets.includes(d.validator_address))
    .reduce((sum, d) => sum + BigInt(d.pending_reward_atox), 0n);

  // 单个验证人用 withdrawDelegatorRewards；「全部领取」用 claimRewards ——
  // 它在预编译内部遍历，一笔交易搞定，不用像 Cosmos 那样为每个验证人发一条消息。
  const single = params.validator;
  const tx_hash = single
    ? await sendTx(() =>
        writeContract(wagmiConfig, {
          account,
          chain: atoshi,
          address: DISTRIBUTION_PRECOMPILE,
          abi: distributionAbi,
          functionName: 'withdrawDelegatorRewards',
          args: [account, single],
          gas: GAS_LIMITS.withdrawRewards,
        }),
      )
    : await sendTx(() =>
        writeContract(wagmiConfig, {
          account,
          chain: atoshi,
          address: DISTRIBUTION_PRECOMPILE,
          abi: distributionAbi,
          functionName: 'claimRewards',
          // maxRetrieve 给太小会漏领，所以按实际委托数再留一点余量
          args: [account, Math.min(targets.length + 5, 0xffff)],
          gas:
            GAS_LIMITS.claimRewardsBase +
            GAS_LIMITS.claimRewardsPerValidator * BigInt(targets.length),
        }),
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
