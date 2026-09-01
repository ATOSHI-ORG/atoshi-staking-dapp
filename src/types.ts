/**
 * Atoshi Staking DApp Type Definitions
 * Strictly matches chain parameters and precision specs
 */

export interface Validator {
  operator_address: string;
  moniker: string;
  identity: string;
  website: string;
  details: string;
  status: 'BOND_STATUS_BONDED' | 'BOND_STATUS_UNBONDED' | 'BOND_STATUS_UNBONDING';
  jailed: boolean;
  tokens: string; // in liao (10^18)
  voting_power_percent: number; // e.g. 12.45
  commission_rate: string; // e.g. "0.0500" (5%)
  commission_max_rate: string; // e.g. "0.2000" (20%)
  commission_max_change_rate: string; // e.g. "0.0100" (1% daily)
  self_delegation: string; // in liao (must be >= 1亿 ATOS)
  uptime_percent: number; // e.g. 99.9
  missed_blocks_counter: number; // missed in last 100 blocks
  signed_blocks_window: number; // 100
  estimated_apr_atox: number; // in % (paid in ATOX)
  in_active_set: boolean; // Top 100
  rank: number;
}

export interface StakingParams {
  unbonding_time_seconds: number; // 1814400 (21 days)
  max_validators: number; // 100
  max_entries: number; // 7 (max concurrent unbonding entries per validator)
  min_commission_rate: string; // "0.05"
  validator_min_self_delegation: string; // "100000000000000000000000000" (100,000,000 ATOS)
  bond_denom: string; // "liao"
  slashing_downtime_percent: number; // 1%
  slashing_downtime_jail_duration_minutes: number; // 10 mins
  slashing_double_sign_percent: number; // 5%
}

export interface DelegationItem {
  delegator_address: string;
  validator_address: string;
  validator_moniker: string;
  validator_jailed: boolean;
  validator_in_active_set: boolean;
  amount: string; // in liao
  pending_reward_atox: string; // in aatox
  commission_rate: string;
  estimated_apr_atox: number;
  in_flight_unbonding_count: number; // 0..7
}

export interface UnbondingEntry {
  id: string;
  validator_address: string;
  validator_moniker: string;
  amount: string; // in liao
  creation_time: number; // timestamp
  completion_time: number; // timestamp ms
  initial_balance: string;
}

export interface AtoxAccountData {
  address: string;
  atox_balance: string; // in aatox
  pending_atos: string; // in liao, pending auto-settlement
  cumulative_converted_atos: string; // in liao, settled to balance
}

export interface AtoxGlobalData {
  global_index: string;
  total_released_to_pool: string; // in liao
  atox_total_supply: string; // 1 Trillion = 10^12 * 10^18 aatox
  current_tier: number;
  total_tiers: number;
  tier_name: string;
  next_tier_progress_percent: number;
}

export interface EnergyAccountData {
  address: string;
  energy_balance: number; // e.g. 8500
  energy_max: number; // 10000
  qualifies_for_energy: boolean; // total ATOS >= 30,000
  available_atos: string; // in liao
  staked_atos: string; // in liao
  total_calculated_atos: string; // in liao (available + staked)
  free_gas_tx_remaining: number; // daily free gas txs
  energy_threshold_atos: number; // 30,000
}

export interface AccountAssets {
  address: string;
  available_atos: string; // in liao
  staked_atos: string; // in liao
  unbonding_atos: string; // in liao
  total_pending_atox: string; // in aatox
  nearest_unbonding_completion_time?: number;
}

export interface StakingTxHistory {
  id: string;
  tx_hash: string;
  type: 'delegate' | 'undelegate' | 'redelegate' | 'withdraw_rewards';
  amount: string;
  denom: 'ATOS' | 'ATOX';
  validator_address?: string;
  validator_moniker?: string;
  dst_validator_address?: string;
  dst_validator_moniker?: string;
  timestamp: number;
  status: 'success' | 'pending' | 'failed';
  fee_atos: string;
  energy_consumed?: number;
  is_free_gas?: boolean;
}
