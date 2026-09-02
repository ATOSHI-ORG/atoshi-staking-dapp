/**
 * StakingApi 的切换层。UI 只 import 这个文件，不关心数据来自哪里。
 *
 *   VITE_API_MODE=mock   （默认）内置模拟数据，不需要节点。
 *                        给产品和设计看页面、以及节点还没就绪时用。
 *   VITE_API_MODE=chain  连真链的 Cosmos REST，需要 VITE_REST_URL。
 *
 * 之所以保留 mock 而不是直接换掉：真链的 REST 端点（节点 app.toml 的 [api]，
 * 默认 1317）目前还没对外暴露，只暴露了 EVM JSON-RPC（8545）。而质押、委托、
 * 奖励、解质押这些数据全在 Cosmos 模块里，EVM JSON-RPC 一个都读不到。
 * 等 REST 暴露出来，改一个环境变量即可切换，UI 代码不用动。
 */

import { StakingApiMock, USER_ADDRESS as MOCK_ADDRESS } from './stakingApiMock';
import { StakingApiChain } from './stakingApiChain';
import { REST_BASE } from './chainRest';

export type ApiMode = 'mock' | 'chain';

/**
 * 生效的模式。
 *
 * 显式设了 chain 但没给 REST 地址时不静默退回 mock —— 那样页面会显示一堆
 * 假数据而看起来一切正常，是最难排查的一种故障。这里直接抛错。
 */
export const API_MODE: ApiMode = (() => {
  const mode = (import.meta.env.VITE_API_MODE as string | undefined)?.trim();
  if (mode === 'chain') {
    if (!REST_BASE) {
      throw new Error(
        'VITE_API_MODE=chain 但没有配置 VITE_REST_URL。' +
          '质押数据需要节点的 Cosmos REST 端点（app.toml 的 [api]，默认 1317），' +
          '不是 EVM JSON-RPC（8545）。',
      );
    }
    return 'chain';
  }
  return 'mock';
})();

export const StakingApi = API_MODE === 'chain' ? StakingApiChain : StakingApiMock;

/**
 * 当前账户地址。
 *
 * 真实运行时应该来自钱包（window.atoshiWallet.getAddress()），这里给的是
 * 首屏渲染用的初始值：chain 模式下用 VITE_DEMO_ADDRESS（只读查询用一个真实
 * 地址就能看到真数据），mock 模式下用内置的假地址。
 *
 * 接入钱包后这个常量应该换成从 bridge 拿地址的 hook —— 现在 UI 是把它当
 * 常量用的，改动面在 App.tsx，等钱包端接口定下来再改。
 */
export const USER_ADDRESS: string =
  API_MODE === 'chain'
    ? (import.meta.env.VITE_DEMO_ADDRESS as string) || MOCK_ADDRESS
    : MOCK_ADDRESS;

// 首屏在参数请求返回之前要有东西可渲染，用 mock 里那份（值与链上默认一致）。
// 真链模式下 App 挂载后会用 getParams() 的结果覆盖。
export { DEFAULT_STAKING_PARAMS } from './stakingApiMock';

export { ChainRestError } from './chainRest';
export type { WalletBridge } from './stakingApiChain';
