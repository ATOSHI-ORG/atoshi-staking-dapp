/**
 * Atoshi Staking RESTful & Mock Engine Layer
 * Implements the required interface specifications:
 * - GET /staking/validators
 * - GET /staking/params
 * - GET /staking/delegations
 * - GET /staking/unbonding
 * - GET /staking/rewards
 * - GET /atox/account
 * - GET /atox/global
 * - GET /energy/account
 * - POST /staking/delegate
 * - POST /staking/undelegate
 * - POST /staking/redelegate
 * - POST /staking/withdraw
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
import { parseHumanAmountToRaw } from '../utils/format';

export const USER_ADDRESS = 'atos1q8x9y7w5e4r3t2y1u0i9o8p7a6s5d4f3g2h1j';

// 1 ATOS = 10^18 liao
const DECIMALS_18 = 1000000000000000000n;

export const DEFAULT_STAKING_PARAMS: StakingParams = {
  unbonding_time_seconds: 1814400, // 21 days in seconds
  max_validators: 100,
  max_entries: 7, // Max 7 concurrent unbonding per validator
  min_commission_rate: '0.0500', // 5.00% minimum
  validator_min_self_delegation: (100000000n * DECIMALS_18).toString(), // 1亿 ATOS
  bond_denom: 'liao',
  slashing_downtime_percent: 1, // 1%
  slashing_downtime_jail_duration_minutes: 10, // 10 minutes
  slashing_double_sign_percent: 5, // 5%
};

const INITIAL_VALIDATORS: Validator[] = [
  {
    operator_address: 'atosvaloper1q8x9y7w5e4r3t2y1u0i9o8p7a6s5d4f3g20001',
    moniker: 'Atoshi Genesis #01 (官方节点)',
    identity: '9A7B3E2F401C5D6E',
    website: 'https://genesis1.atoshi.org',
    details: 'Atoshi 官方创世验证人节点，极高安全性与 100% 在线率保证。支持全天候区块广播与灾备冗余。',
    status: 'BOND_STATUS_BONDED',
    jailed: false,
    tokens: (1285000000n * DECIMALS_18).toString(), // 12.85亿 ATOS
    voting_power_percent: 14.82,
    commission_rate: '0.0500', // 5.00%
    commission_max_rate: '0.2000',
    commission_max_change_rate: '0.0100',
    self_delegation: (350000000n * DECIMALS_18).toString(), // 3.5亿 ATOS (>= 1亿)
    uptime_percent: 100.0,
    missed_blocks_counter: 0,
    signed_blocks_window: 100,
    estimated_apr_atox: 19.85,
    in_active_set: true,
    rank: 1,
  },
  {
    operator_address: 'atosvaloper1m4k2j8l9p0o1i2u3y4t5r6e7w8q9a0s1d0002',
    moniker: 'HashMatrix Capital 节点',
    identity: 'E4D3C2B1A0F9E8D7',
    website: 'https://hashmatrix.io',
    details: '专业机构级 PoS 基础设施服务商，多区域多活集群部署，99.99% SLA 承诺。',
    status: 'BOND_STATUS_BONDED',
    jailed: false,
    tokens: (980000000n * DECIMALS_18).toString(), // 9.8亿 ATOS
    voting_power_percent: 11.31,
    commission_rate: '0.0600', // 6.00%
    commission_max_rate: '0.1500',
    commission_max_change_rate: '0.0100',
    self_delegation: (200000000n * DECIMALS_18).toString(), // 2亿 ATOS (>= 1亿)
    uptime_percent: 99.9,
    missed_blocks_counter: 1,
    signed_blocks_window: 100,
    estimated_apr_atox: 19.20,
    in_active_set: true,
    rank: 2,
  },
  {
    operator_address: 'atosvaloper1z9x8c7v6b5n4m3l2k1j0h9g8f7d6s5a4p0003',
    moniker: 'Atoshi Community DAO 节点',
    identity: 'F1E2D3C4B5A69788',
    website: 'https://dao.atoshi.community',
    details: '由 Atoshi 社区开发者与布道者共同维护的非盈利验证节点，节点收益全额回馈生态基金。',
    status: 'BOND_STATUS_BONDED',
    jailed: false,
    tokens: (750000000n * DECIMALS_18).toString(), // 7.5亿 ATOS
    voting_power_percent: 8.65,
    commission_rate: '0.0500', // 5.00%
    commission_max_rate: '0.1000',
    commission_max_change_rate: '0.0100',
    self_delegation: (150000000n * DECIMALS_18).toString(), // 1.5亿 ATOS (>= 1亿)
    uptime_percent: 99.8,
    missed_blocks_counter: 2,
    signed_blocks_window: 100,
    estimated_apr_atox: 19.85,
    in_active_set: true,
    rank: 3,
  },
  {
    operator_address: 'atosvaloper1t7y8u9i0o1p2a3s4d5f6g7h8j9k0l1z2x0004',
    moniker: 'InfraNode Sentinel',
    identity: '1A2B3C4D5E6F7081',
    website: 'https://sentinel.infranode.net',
    details: '全球高性能裸金属节点，配备 DDoS 防护及防双签硬件哨兵系统。',
    status: 'BOND_STATUS_BONDED',
    jailed: false,
    tokens: (620000000n * DECIMALS_18).toString(),
    voting_power_percent: 7.15,
    commission_rate: '0.0750', // 7.50%
    commission_max_rate: '0.2000',
    commission_max_change_rate: '0.0150',
    self_delegation: (120000000n * DECIMALS_18).toString(), // 1.2亿 ATOS
    uptime_percent: 100.0,
    missed_blocks_counter: 0,
    signed_blocks_window: 100,
    estimated_apr_atox: 18.75,
    in_active_set: true,
    rank: 4,
  },
  {
    operator_address: 'atosvaloper1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6j7k0005',
    moniker: 'BlockPulse Global',
    identity: '5566778899AABBCC',
    website: 'https://blockpulse.tech',
    details: '跨链 PoS 质押服务专家，提供自动化监控与奖励再分配结算。',
    status: 'BOND_STATUS_BONDED',
    jailed: false,
    tokens: (490000000n * DECIMALS_18).toString(),
    voting_power_percent: 5.65,
    commission_rate: '0.0500',
    commission_max_rate: '0.1000',
    commission_max_change_rate: '0.0100',
    self_delegation: (110000000n * DECIMALS_18).toString(), // 1.1亿 ATOS
    uptime_percent: 99.4,
    missed_blocks_counter: 3,
    signed_blocks_window: 100,
    estimated_apr_atox: 19.85,
    in_active_set: true,
    rank: 5,
  },
  {
    operator_address: 'atosvaloper1j1k2l3z4x5c6v7b8n9m0a1s2d3f4g5h6j0006',
    moniker: 'StarStaking Alliance (候补)',
    identity: '778899AABBCCDDEE',
    website: 'https://starstaking.xyz',
    details: '新锐社区验证人，正在冲刺活跃验证人集 Top 100。',
    status: 'BOND_STATUS_UNBONDED',
    jailed: false,
    tokens: (150000000n * DECIMALS_18).toString(),
    voting_power_percent: 1.73,
    commission_rate: '0.0500',
    commission_max_rate: '0.1000',
    commission_max_change_rate: '0.0100',
    self_delegation: (100000000n * DECIMALS_18).toString(), // 1.0亿 ATOS
    uptime_percent: 98.2,
    missed_blocks_counter: 5,
    signed_blocks_window: 100,
    estimated_apr_atox: 0.0, // Inactive set earns no rewards
    in_active_set: false,
    rank: 101,
  },
  {
    operator_address: 'atosvaloper1x9y8z7w6v5u4t3s2r1q0p9o8i7u6y5t4r0007',
    moniker: 'FaultyNode [已监禁]',
    identity: '9900112233445566',
    website: 'https://faultynode.test',
    details: '因机房故障长时间漏块（最近 100 块漏签 54 块），已被链上共识系统自动监禁。',
    status: 'BOND_STATUS_UNBONDING',
    jailed: true,
    tokens: (80000000n * DECIMALS_18).toString(),
    voting_power_percent: 0.92,
    commission_rate: '0.0800',
    commission_max_rate: '0.2000',
    commission_max_change_rate: '0.0200',
    self_delegation: (80000000n * DECIMALS_18).toString(),
    uptime_percent: 46.0,
    missed_blocks_counter: 54, // > 50 missed in 100 window triggers jail!
    signed_blocks_window: 100,
    estimated_apr_atox: 0.0,
    in_active_set: false,
    rank: 102,
  },
];

// Initial user mock state
const INITIAL_DELEGATIONS: DelegationItem[] = [
  {
    delegator_address: USER_ADDRESS,
    validator_address: 'atosvaloper1q8x9y7w5e4r3t2y1u0i9o8p7a6s5d4f3g20001',
    validator_moniker: 'Atoshi Genesis #01 (官方节点)',
    validator_jailed: false,
    validator_in_active_set: true,
    amount: (45000n * DECIMALS_18).toString(), // 45,000 ATOS
    pending_reward_atox: (842n * DECIMALS_18 + 560000000000000000n).toString(), // 842.56 ATOX
    commission_rate: '0.0500',
    estimated_apr_atox: 19.85,
    in_flight_unbonding_count: 1,
  },
  {
    delegator_address: USER_ADDRESS,
    validator_address: 'atosvaloper1m4k2j8l9p0o1i2u3y4t5r6e7w8q9a0s1d0002',
    validator_moniker: 'HashMatrix Capital 节点',
    validator_jailed: false,
    validator_in_active_set: true,
    amount: (20000n * DECIMALS_18).toString(), // 20,000 ATOS
    pending_reward_atox: (315n * DECIMALS_18 + 240000000000000000n).toString(), // 315.24 ATOX
    commission_rate: '0.0600',
    estimated_apr_atox: 19.20,
    in_flight_unbonding_count: 0,
  },
];

const INITIAL_UNBONDING_ENTRIES: UnbondingEntry[] = [
  {
    id: 'unbond_1',
    validator_address: 'atosvaloper1q8x9y7w5e4r3t2y1u0i9o8p7a6s5d4f3g20001',
    validator_moniker: 'Atoshi Genesis #01 (官方节点)',
    amount: (5000n * DECIMALS_18).toString(), // 5,000 ATOS
    creation_time: Date.now() - 3 * 86400 * 1000,
    // 21 days from creation = 18 days remaining
    completion_time: Date.now() + 18 * 86400 * 1000 + 4 * 3600 * 1000,
    initial_balance: (5000n * DECIMALS_18).toString(),
  },
];

const INITIAL_ATOX_ACCOUNT: AtoxAccountData = {
  address: USER_ADDRESS,
  atox_balance: (4280n * DECIMALS_18 + 890000000000000000n).toString(), // 4,280.89 ATOX
  pending_atos: (65n * DECIMALS_18 + 320000000000000000n).toString(), // 65.32 ATOS ready in next settlement
  cumulative_converted_atos: (1520n * DECIMALS_18 + 450000000000000000n).toString(), // 1,520.45 ATOS converted so far
};

const INITIAL_ATOX_GLOBAL: AtoxGlobalData = {
  global_index: '1.04289',
  // 152.8 亿 ATOS released into pool
  total_released_to_pool: (15280000000n * DECIMALS_18).toString(),
  // 1 万亿 ATOX total supply = 1,000,000,000,000 * 10^18
  atox_total_supply: (1000000000000n * DECIMALS_18).toString(),
  current_tier: 3,
  total_tiers: 10,
  tier_name: 'Tier 3 (生态扩容期)',
  next_tier_progress_percent: 68.4,
};

const INITIAL_TX_HISTORY: StakingTxHistory[] = [
  {
    id: 'tx_1',
    tx_hash: '0x8f3c9e2b1a0d7e6f5a4c3b2a1e0f9d8c7b6a5e4d3c2b1a0f9e8d7c6b5a4f3e2d',
    type: 'delegate',
    amount: (20000n * DECIMALS_18).toString(),
    denom: 'ATOS',
    validator_address: 'atosvaloper1m4k2j8l9p0o1i2u3y4t5r6e7w8q9a0s1d0002',
    validator_moniker: 'HashMatrix Capital 节点',
    timestamp: Date.now() - 2 * 86400 * 1000,
    status: 'success',
    fee_atos: '0',
    is_free_gas: true,
    energy_consumed: 150,
  },
  {
    id: 'tx_2',
    tx_hash: '0x3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b',
    type: 'undelegate',
    amount: (5000n * DECIMALS_18).toString(),
    denom: 'ATOS',
    validator_address: 'atosvaloper1q8x9y7w5e4r3t2y1u0i9o8p7a6s5d4f3g20001',
    validator_moniker: 'Atoshi Genesis #01 (官方节点)',
    timestamp: Date.now() - 3 * 86400 * 1000,
    status: 'success',
    fee_atos: '0',
    is_free_gas: true,
    energy_consumed: 150,
  },
];

// In-memory or localStorage state store
const STORAGE_KEY = 'atoshi_staking_state_v1';

interface AppState {
  available_atos: string; // 28,500 ATOS
  validators: Validator[];
  delegations: DelegationItem[];
  unbonding_entries: UnbondingEntry[];
  atox_account: AtoxAccountData;
  atox_global: AtoxGlobalData;
  tx_history: StakingTxHistory[];
}

function loadState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load state from localStorage', e);
  }

  return {
    available_atos: (28500n * DECIMALS_18 + 750000000000000000n).toString(), // 28,500.75 ATOS
    validators: INITIAL_VALIDATORS,
    delegations: INITIAL_DELEGATIONS,
    unbonding_entries: INITIAL_UNBONDING_ENTRIES,
    atox_account: INITIAL_ATOX_ACCOUNT,
    atox_global: INITIAL_ATOX_GLOBAL,
    tx_history: INITIAL_TX_HISTORY,
  };
}

function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state to localStorage', e);
  }
}

let currentState: AppState = loadState();

export const StakingApiMock = {
  // GET /staking/params
  async getParams(): Promise<StakingParams> {
    await new Promise((r) => setTimeout(r, 150));
    return DEFAULT_STAKING_PARAMS;
  },

  // GET /staking/validators
  async getValidators(query?: { status?: string; sort?: string; search?: string; hideJailed?: boolean }): Promise<Validator[]> {
    await new Promise((r) => setTimeout(r, 200));
    let list = [...currentState.validators];

    if (query?.hideJailed) {
      list = list.filter((v) => !v.jailed);
    }

    if (query?.status === 'active') {
      list = list.filter((v) => v.in_active_set && !v.jailed);
    } else if (query?.status === 'candidate') {
      list = list.filter((v) => !v.in_active_set && !v.jailed);
    } else if (query?.status === 'jailed') {
      list = list.filter((v) => v.jailed);
    }

    if (query?.search) {
      const s = query.search.toLowerCase();
      list = list.filter((v) => v.moniker.toLowerCase().includes(s) || v.operator_address.toLowerCase().includes(s));
    }

    if (query?.sort === 'commission') {
      list.sort((a, b) => parseFloat(a.commission_rate) - parseFloat(b.commission_rate));
    } else if (query?.sort === 'uptime') {
      list.sort((a, b) => b.uptime_percent - a.uptime_percent);
    } else if (query?.sort === 'apr') {
      list.sort((a, b) => b.estimated_apr_atox - a.estimated_apr_atox);
    } else {
      // Default: sort by total staked tokens (rank)
      list.sort((a, b) => (BigInt(b.tokens) > BigInt(a.tokens) ? 1 : -1));
    }

    return list;
  },

  // GET /staking/delegations
  async getDelegations(address: string = USER_ADDRESS): Promise<DelegationItem[]> {
    await new Promise((r) => setTimeout(r, 180));
    return currentState.delegations.filter((d) => d.delegator_address === address);
  },

  // GET /staking/unbonding
  async getUnbonding(address: string = USER_ADDRESS): Promise<UnbondingEntry[]> {
    await new Promise((r) => setTimeout(r, 180));
    return currentState.unbonding_entries;
  },

  // GET /staking/rewards
  async getRewards(address: string = USER_ADDRESS): Promise<{ total_atox: string; per_validator: { validator_address: string; amount_atox: string }[] }> {
    await new Promise((r) => setTimeout(r, 150));
    const userDelegations = currentState.delegations.filter((d) => d.delegator_address === address);
    let totalAtox = 0n;
    const per_validator = userDelegations.map((d) => {
      totalAtox += BigInt(d.pending_reward_atox);
      return {
        validator_address: d.validator_address,
        amount_atox: d.pending_reward_atox,
      };
    });

    return {
      total_atox: totalAtox.toString(),
      per_validator,
    };
  },

  // GET /atox/account
  async getAtoxAccount(address: string = USER_ADDRESS): Promise<AtoxAccountData> {
    await new Promise((r) => setTimeout(r, 150));
    return { ...currentState.atox_account, address };
  },

  // GET /atox/global
  async getAtoxGlobal(): Promise<AtoxGlobalData> {
    await new Promise((r) => setTimeout(r, 150));
    return currentState.atox_global;
  },

  // GET /energy/account
  async getEnergyAccount(address: string = USER_ADDRESS): Promise<EnergyAccountData> {
    await new Promise((r) => setTimeout(r, 150));
    let stakedTotal = 0n;
    for (const d of currentState.delegations) {
      stakedTotal += BigInt(d.amount);
    }
    const available = BigInt(currentState.available_atos);
    const totalCalculated = available + stakedTotal;
    const qualifies = totalCalculated >= 30000n * DECIMALS_18;

    return {
      address,
      energy_balance: qualifies ? 8850 : 0,
      energy_max: 10000,
      qualifies_for_energy: qualifies,
      available_atos: currentState.available_atos,
      staked_atos: stakedTotal.toString(),
      total_calculated_atos: totalCalculated.toString(),
      free_gas_tx_remaining: qualifies ? 18 : 0,
      energy_threshold_atos: 30000,
    };
  },

  // Compute overall account summary assets
  async getAccountAssets(address: string = USER_ADDRESS): Promise<AccountAssets> {
    await new Promise((r) => setTimeout(r, 150));
    let stakedTotal = 0n;
    let totalPendingAtox = 0n;
    for (const d of currentState.delegations) {
      stakedTotal += BigInt(d.amount);
      totalPendingAtox += BigInt(d.pending_reward_atox);
    }

    let unbondingTotal = 0n;
    let nearestTime: number | undefined = undefined;
    for (const u of currentState.unbonding_entries) {
      unbondingTotal += BigInt(u.amount);
      if (!nearestTime || u.completion_time < nearestTime) {
        nearestTime = u.completion_time;
      }
    }

    return {
      address,
      available_atos: currentState.available_atos,
      staked_atos: stakedTotal.toString(),
      unbonding_atos: unbondingTotal.toString(),
      total_pending_atox: totalPendingAtox.toString(),
      nearest_unbonding_completion_time: nearestTime,
    };
  },

  // GET /staking/history
  async getHistory(): Promise<StakingTxHistory[]> {
    await new Promise((r) => setTimeout(r, 150));
    return [...currentState.tx_history];
  },

  // POST /staking/delegate
  async delegate(params: { delegator: string; validator: string; amount: string }): Promise<{ success: boolean; tx_hash: string; message?: string }> {
    await new Promise((r) => setTimeout(r, 600));

    const val = currentState.validators.find((v) => v.operator_address === params.validator);
    if (!val) {
      throw new Error('未找到指定验证人');
    }
    if (val.jailed) {
      throw new Error('该验证人已被链上监禁，无法接受新委托');
    }

    const delegateAmount = BigInt(params.amount);
    if (delegateAmount <= 0n) {
      throw new Error('质押数量必须大于 0');
    }

    const available = BigInt(currentState.available_atos);
    const gasReserve = 100000000000000000n; // 0.1 ATOS gas buffer
    if (delegateAmount > available) {
      throw new Error('可用余额不足');
    }

    // Deduct available ATOS
    currentState.available_atos = (available - delegateAmount).toString();

    // Update delegation
    const existingIndex = currentState.delegations.findIndex((d) => d.validator_address === params.validator);
    if (existingIndex >= 0) {
      const existing = currentState.delegations[existingIndex];
      currentState.delegations[existingIndex] = {
        ...existing,
        amount: (BigInt(existing.amount) + delegateAmount).toString(),
      };
    } else {
      currentState.delegations.push({
        delegator_address: params.delegator || USER_ADDRESS,
        validator_address: val.operator_address,
        validator_moniker: val.moniker,
        validator_jailed: val.jailed,
        validator_in_active_set: val.in_active_set,
        amount: delegateAmount.toString(),
        pending_reward_atox: '0',
        commission_rate: val.commission_rate,
        estimated_apr_atox: val.estimated_apr_atox,
        in_flight_unbonding_count: 0,
      });
    }

    // Update validator tokens
    val.tokens = (BigInt(val.tokens) + delegateAmount).toString();

    const txHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    // Add tx history
    currentState.tx_history.unshift({
      id: 'tx_' + Date.now(),
      tx_hash: txHash,
      type: 'delegate',
      amount: delegateAmount.toString(),
      denom: 'ATOS',
      validator_address: val.operator_address,
      validator_moniker: val.moniker,
      timestamp: Date.now(),
      status: 'success',
      fee_atos: '0',
      is_free_gas: true,
      energy_consumed: 120,
    });

    saveState(currentState);
    return { success: true, tx_hash: txHash };
  },

  // POST /staking/undelegate
  async undelegate(params: { delegator: string; validator: string; amount: string }): Promise<{ success: boolean; tx_hash: string; message?: string }> {
    await new Promise((r) => setTimeout(r, 600));

    const delegation = currentState.delegations.find((d) => d.validator_address === params.validator);
    if (!delegation) {
      throw new Error('未找到该验证人的有效委托');
    }

    // Check max 7 in-flight unbonding entries
    const inFlightCount = currentState.unbonding_entries.filter((u) => u.validator_address === params.validator).length;
    if (inFlightCount >= 7) {
      throw new Error('该验证人当前在途解质押笔数已达上限（7 笔），请等待已有解质押到账后再发起');
    }

    const unbondAmount = BigInt(params.amount);
    const delegatedAmount = BigInt(delegation.amount);

    if (unbondAmount <= 0n) {
      throw new Error('解质押数量必须大于 0');
    }
    if (unbondAmount > delegatedAmount) {
      throw new Error('解质押数量不能超过当前委托数量');
    }

    // Deduct delegation
    const remainingDelegation = delegatedAmount - unbondAmount;
    if (remainingDelegation === 0n) {
      currentState.delegations = currentState.delegations.filter((d) => d.validator_address !== params.validator);
    } else {
      delegation.amount = remainingDelegation.toString();
      delegation.in_flight_unbonding_count = inFlightCount + 1;
    }

    // Add unbonding entry with 21-day lock
    const completionTime = Date.now() + 1814400 * 1000; // 21 days
    currentState.unbonding_entries.push({
      id: 'unbond_' + Date.now(),
      validator_address: delegation.validator_address,
      validator_moniker: delegation.validator_moniker,
      amount: unbondAmount.toString(),
      creation_time: Date.now(),
      completion_time: completionTime,
      initial_balance: unbondAmount.toString(),
    });

    // Update validator tokens
    const val = currentState.validators.find((v) => v.operator_address === params.validator);
    if (val) {
      val.tokens = (BigInt(val.tokens) - unbondAmount).toString();
    }

    const txHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    currentState.tx_history.unshift({
      id: 'tx_' + Date.now(),
      tx_hash: txHash,
      type: 'undelegate',
      amount: unbondAmount.toString(),
      denom: 'ATOS',
      validator_address: delegation.validator_address,
      validator_moniker: delegation.validator_moniker,
      timestamp: Date.now(),
      status: 'success',
      fee_atos: '0',
      is_free_gas: true,
      energy_consumed: 150,
    });

    saveState(currentState);
    return { success: true, tx_hash: txHash };
  },

  // POST /staking/redelegate
  async redelegate(params: {
    delegator: string;
    src_validator: string;
    dst_validator: string;
    amount: string;
  }): Promise<{ success: boolean; tx_hash: string; message?: string }> {
    await new Promise((r) => setTimeout(r, 600));

    if (params.src_validator === params.dst_validator) {
      throw new Error('源验证人与目标验证人不能相同');
    }

    const srcDelegation = currentState.delegations.find((d) => d.validator_address === params.src_validator);
    if (!srcDelegation) {
      throw new Error('源验证人无有效委托');
    }

    const dstValidator = currentState.validators.find((v) => v.operator_address === params.dst_validator);
    if (!dstValidator) {
      throw new Error('目标验证人不存在');
    }
    if (dstValidator.jailed) {
      throw new Error('目标验证人已被监禁，无法转入');
    }

    const redelegateAmount = BigInt(params.amount);
    const currentAmount = BigInt(srcDelegation.amount);

    if (redelegateAmount <= 0n) {
      throw new Error('转委托数量必须大于 0');
    }
    if (redelegateAmount > currentAmount) {
      throw new Error('转委托数量不能超过源验证人委托量');
    }

    // Reduce src delegation
    const remainingSrc = currentAmount - redelegateAmount;
    if (remainingSrc === 0n) {
      currentState.delegations = currentState.delegations.filter((d) => d.validator_address !== params.src_validator);
    } else {
      srcDelegation.amount = remainingSrc.toString();
    }

    // Add to dst delegation
    const dstIndex = currentState.delegations.findIndex((d) => d.validator_address === params.dst_validator);
    if (dstIndex >= 0) {
      const existing = currentState.delegations[dstIndex];
      currentState.delegations[dstIndex] = {
        ...existing,
        amount: (BigInt(existing.amount) + redelegateAmount).toString(),
      };
    } else {
      currentState.delegations.push({
        delegator_address: params.delegator || USER_ADDRESS,
        validator_address: dstValidator.operator_address,
        validator_moniker: dstValidator.moniker,
        validator_jailed: dstValidator.jailed,
        validator_in_active_set: dstValidator.in_active_set,
        amount: redelegateAmount.toString(),
        pending_reward_atox: '0',
        commission_rate: dstValidator.commission_rate,
        estimated_apr_atox: dstValidator.estimated_apr_atox,
        in_flight_unbonding_count: 0,
      });
    }

    // Update validators total tokens
    const srcVal = currentState.validators.find((v) => v.operator_address === params.src_validator);
    if (srcVal) {
      srcVal.tokens = (BigInt(srcVal.tokens) - redelegateAmount).toString();
    }
    dstValidator.tokens = (BigInt(dstValidator.tokens) + redelegateAmount).toString();

    const txHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    currentState.tx_history.unshift({
      id: 'tx_' + Date.now(),
      tx_hash: txHash,
      type: 'redelegate',
      amount: redelegateAmount.toString(),
      denom: 'ATOS',
      validator_address: params.src_validator,
      validator_moniker: srcDelegation.validator_moniker,
      dst_validator_address: dstValidator.operator_address,
      dst_validator_moniker: dstValidator.moniker,
      timestamp: Date.now(),
      status: 'success',
      fee_atos: '0',
      is_free_gas: true,
      energy_consumed: 180,
    });

    saveState(currentState);
    return { success: true, tx_hash: txHash };
  },

  // POST /staking/withdraw (Claim Rewards -> ATOX)
  async withdrawRewards(params: { delegator: string; validator?: string }): Promise<{ success: boolean; tx_hash: string; total_claimed_atox: string }> {
    await new Promise((r) => setTimeout(r, 600));

    // Check gas balance if user has 0 ATOS and 0 Energy
    const available = BigInt(currentState.available_atos);
    const hasEnergy = available >= 30000n * DECIMALS_18;
    if (available === 0n && !hasEnergy) {
      throw new Error('ATOS 可用余额为 0 且无能量额度，无法支付链上 Gas 费，请先充值 ATOS');
    }

    let claimedAtox = 0n;

    if (params.validator && params.validator !== 'all') {
      const d = currentState.delegations.find((item) => item.validator_address === params.validator);
      if (d) {
        claimedAtox = BigInt(d.pending_reward_atox);
        d.pending_reward_atox = '0';
      }
    } else {
      // Claim all
      for (const d of currentState.delegations) {
        claimedAtox += BigInt(d.pending_reward_atox);
        d.pending_reward_atox = '0';
      }
    }

    if (claimedAtox === 0n) {
      throw new Error('当前无可领取的 ATOX 奖励');
    }

    // Add to user's ATOX balance
    currentState.atox_account.atox_balance = (BigInt(currentState.atox_account.atox_balance) + claimedAtox).toString();

    const txHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    currentState.tx_history.unshift({
      id: 'tx_' + Date.now(),
      tx_hash: txHash,
      type: 'withdraw_rewards',
      amount: claimedAtox.toString(),
      denom: 'ATOX',
      timestamp: Date.now(),
      status: 'success',
      fee_atos: '0',
      is_free_gas: true,
      energy_consumed: 90,
    });

    saveState(currentState);
    return { success: true, tx_hash: txHash, total_claimed_atox: claimedAtox.toString() };
  },

  // Reset to initial demo data
  resetDemoData() {
    localStorage.removeItem(STORAGE_KEY);
    currentState = loadState();
  },
};
