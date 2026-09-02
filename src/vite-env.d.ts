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

  /** 出块间隔（秒），用于把每块 ATOX 产出换算成年化。默认 5 */
  readonly VITE_BLOCK_SECONDS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
