/**
 * Cosmos 模块的 EVM 预编译。
 *
 * 质押本质上是 Cosmos 消息（MsgDelegate 之类），MetaMask 这类以太坊钱包签不了。
 * 但链上开了 staking / distribution 预编译（用 `atoshid q evm params` 里的
 * active_static_precompiles 可以确认），于是质押可以变成一笔普通的以太坊交易，
 * 任何 EVM 钱包都能签。这是这个 DApp 能用 wagmi 而不必自己写钱包 bridge 的前提。
 *
 * ABI 是从链仓库 precompiles/{staking,distribution}/abi.json 摘出来的，
 * 只留 UI 用到的方法 —— 全量 ABI 有 30 多个方法，多余的会让打包变大也更难核对。
 *
 * 两个坑：
 *  1. delegatorAddress 是 0x 地址，validatorAddress 是 bech32 字符串
 *     （atoshivaloper1…），同一个调用里两种格式混用，别搞反。
 *  2. amount 是最小单位 liao 的 uint256，不是 ATOS。
 */

export const STAKING_PRECOMPILE = '0x0000000000000000000000000000000000000800' as const;
export const DISTRIBUTION_PRECOMPILE = '0x0000000000000000000000000000000000000801' as const;

export const stakingAbi = [
  {
    type: 'function',
    name: 'delegate',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'delegatorAddress', type: 'address' },
      { name: 'validatorAddress', type: 'string' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'undelegate',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'delegatorAddress', type: 'address' },
      { name: 'validatorAddress', type: 'string' },
      { name: 'amount', type: 'uint256' },
    ],
    // 解质押返回的是完成时间的 unix 秒。UI 上「预计到账时间」应该用它，
    // 而不是自己拿 now + unbonding_time 去算 —— 链上是按打包那个块的时间算的。
    outputs: [{ name: 'completionTime', type: 'int64' }],
  },
  {
    type: 'function',
    name: 'redelegate',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'delegatorAddress', type: 'address' },
      { name: 'validatorSrcAddress', type: 'string' },
      { name: 'validatorDstAddress', type: 'string' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'completionTime', type: 'int64' }],
  },
] as const;

export const distributionAbi = [
  {
    type: 'function',
    name: 'withdrawDelegatorRewards',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'delegatorAddress', type: 'address' },
      { name: 'validatorAddress', type: 'string' },
    ],
    outputs: [
      {
        name: 'amount',
        type: 'tuple[]',
        components: [
          { name: 'denom', type: 'string' },
          { name: 'amount', type: 'uint256' },
        ],
      },
    ],
  },
  {
    // 一笔交易领全部。Cosmos 那边没有对应的单条消息（得为每个验证人各发一条
    // MsgWithdrawDelegatorReward），预编译这里合成了一个，「全部领取」按钮用它。
    // maxRetrieve 是要遍历的验证人个数上限，给太小会漏领。
    type: 'function',
    name: 'claimRewards',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'delegatorAddress', type: 'address' },
      { name: 'maxRetrieve', type: 'uint32' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
] as const;

/**
 * 各操作的 gas 上限。
 *
 * 预编译的 eth_estimateGas 实测会偏低约 2%（链侧已记录为待办），偏低会直接
 * 让交易 out of gas，所以这里给固定上限而不是依赖估算。多给的 gas 不会被扣，
 * EVM 只按实际消耗收费。
 */
export const GAS_LIMITS = {
  delegate: 600_000n,
  undelegate: 600_000n,
  redelegate: 800_000n,
  withdrawRewards: 500_000n,
  /** claimRewards 遍历 N 个验证人，按个数递增 */
  claimRewardsBase: 300_000n,
  claimRewardsPerValidator: 250_000n,
} as const;
