/**
 * wagmi 配置。
 *
 * 只用 injected connector，没有 RainbowKit / MetaMask SDK / Coinbase SDK。
 *
 * 为什么：这个页面是钱包里的 DApp，用户从钱包内置浏览器打开，钱包会注入
 * window.ethereum（见安卓端 assets/dapp_provider.js，标准 EIP-1193 + EIP-6963）。
 * 手机上主流钱包 —— Atoshi 自己的、MetaMask、OKX、TokenPocket、imToken、
 * Bitget、Trust —— 在自己的内置浏览器里全都这么干，所以 injected 一个 connector
 * 就覆盖了绝大多数真实用户。
 *
 * 加上 RainbowKit 的全套 connector 实测让打包从 99 kB gzip 涨到 1420 kB，
 * 大头是 MetaMask SDK（558 kB）和 Coinbase SDK —— 那两个 SDK 是给「桌面浏览器
 * 没装插件、要扫码连手机钱包」这个场景用的，跟钱包内嵌完全不沾。为一个我们
 * 几乎不会走的路径付 14 倍体积，在移动端 WebView 里不划算。
 *
 * 如果以后确实需要「桌面浏览器扫码连手机钱包」，正确做法是把 WalletConnect
 * 做成点击时 dynamic import 的懒加载模块，而不是塞进首屏 bundle。
 */

import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';

import { atoshi } from './chain';

export const wagmiConfig = createConfig({
  chains: [atoshi],
  connectors: [
    // shimDisconnect: 用户主动断开后记住这个选择，刷新页面不会又自动连上。
    // 不开的话「断开」按钮在注入式钱包里基本没有效果。
    injected({ shimDisconnect: true }),
  ],
  transports: {
    [atoshi.id]: http(),
  },
  ssr: false,
});
