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
    type: 'event',
    name: 'ClaimRewards',
    inputs: [
      { name: 'delegatorAddress', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'WithdrawDelegatorRewards',
    inputs: [
      { name: 'delegatorAddress', type: 'address', indexed: true },
      { name: 'validatorAddress', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
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
  /**
   * ATOX 兑换。结算只动一个账户的 index 和余额，比遍历验证人便宜得多，
   * 但仍按预编译的惯例给固定上限（estimateGas 对预编译偏低约 2%）。
   */
  claimAtox: 400_000n,
} as const;

/**
 * ATOX 兑换预编译（链上 precompiles/atox，地址 0x…0809）。
 *
 * 为什么单独一个预编译而不是挂在 distribution 上：兑换和领取奖励是两件事 ——
 * 奖励是 ATOX 进账，兑换是把手里**任意来源**的 ATOX（包括桥进来的、别人转的）
 * 按 1:1 换成 ATOS 并销毁等量 ATOX。钱包侧也要单独接这个口，不能只在质押页里有。
 *
 * 授权模型：claim() 只给签名者本人兑换，合约不能替别人兑。所以这一步必须由
 * 用户自己签一笔交易，没法和领取奖励合成一笔 —— UI 上是一个按钮，链上是两笔。
 *
 * claim() 在没有可兑换额度时是 **revert** 而不是返回 0。所以调用前必须先用
 * claimable() 判断，否则用户会看到一个莫名其妙的「交易失败」。
 */
export const ATOX_PRECOMPILE = '0x0000000000000000000000000000000000000809' as const;

export const atoxAbi = [
  {
    type: 'event',
    name: 'ClaimAtos',
    inputs: [
      { name: 'claimer', type: 'address', indexed: true },
      { name: 'atosPaid', type: 'uint256', indexed: false },
      { name: 'atoxBurned', type: 'uint256', indexed: false },
    ],
  },
  {
    // 把可兑换的 ATOX 全部换成 ATOS。没有额度会 revert。
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ name: 'atosPaid', type: 'uint256' }],
  },
  {
    // 现在能换到多少 ATOS（= 已结算待领 + 本次读取时才算出来的未结算部分）。
    // 这个数字会随 Tier 释放增长，不是快照。
    type: 'function',
    name: 'claimable',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'amount', type: 'uint256' }],
  },
  {
    // 下次结算会销毁多少 ATOX。兑换是 1:1 且销毁等量，所以这是「要花掉的 ATOX」。
    type: 'function',
    name: 'burnOnSettle',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'amount', type: 'uint256' }],
  },
  {
    // 全局释放进度，1e18 定点。账户 index 落后于它的部分就是能兑换的额度。
    type: 'function',
    name: 'globalIndex',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'index', type: 'uint256' }],
  },
] as const;
