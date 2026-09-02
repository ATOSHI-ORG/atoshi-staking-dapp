/// <reference types="vite/client" />

/**
 * 本项目用到的环境变量。写成类型而不是散在代码里读 any，
 * 是为了拼错变量名时能在编译期发现。
 */
interface ImportMetaEnv {
  /** mock（默认，内置模拟数据）| chain（连真链） */
  readonly VITE_API_MODE?: 'mock' | 'chain';

  /**
   * Cosmos REST（LCD）根地址，chain 模式必填。
   * 对应节点 app.toml 的 [api]，默认端口 1317。
   * ⚠️ 不是 EVM JSON-RPC（8545），也不是 CometBFT RPC（26657）。
   */
  readonly VITE_REST_URL?: string;

  /** chain 模式下首屏用哪个地址查只读数据；接入钱包后由 bridge 提供 */
  readonly VITE_DEMO_ADDRESS?: string;

  /** 质押币最小单位，默认 liao */
  readonly VITE_BOND_DENOM?: string;
  /** 奖励币最小单位，默认 aatox */
  readonly VITE_ATOX_DENOM?: string;

  /** 出块间隔（秒），用于把每块 ATOX 产出换算成年产出。默认 5 */
  readonly VITE_BLOCK_SECONDS?: string;

  /**
   * EVM 链 id，默认 88288（测试网）。
   * 写操作走 EVM 预编译，钱包必须连在这条链上，wagmi 会拿它做校验。
   */
  readonly VITE_CHAIN_ID?: string;

  /**
   * EVM JSON-RPC 地址，默认 https://rpc-testnet.atoshi.org。
   * 用来等交易回执（waitForTransactionReceipt）。
   * 注意跟 VITE_REST_URL 不是一回事：这个是 8545，那个是 1317。
   */
  readonly VITE_EVM_RPC_URL?: string;

  /** 区块浏览器地址，用于交易成功后的跳转链接 */
  readonly VITE_EXPLORER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
