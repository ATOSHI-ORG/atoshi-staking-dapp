/**
 * 页面拿账户用这一个 hook。
 *
 * 它负责三件容易漏的事：
 *  1. 在钱包 WebView 里自动连接，不弹窗（用户已经在钱包里了，再让他「连接钱包」
 *     是多余的一步）。
 *  2. 把 0x 地址转成 bech32 —— Cosmos REST 的查询路径只认 atoshi1…。
 *  3. 检查链 id。用户可能连着别的链，此时读到的余额是别的链的，
 *     不拦住会显示一堆 0 而看不出原因。
 */

import { useEffect, useMemo, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';

import { CHAIN_ID, hexToBech32 } from './chain';

/**
 * 页面所在环境里有没有注入的 EVM provider。
 *
 * 只看 window.ethereum 存不存在，不去嗅探是哪个钱包 —— 各家的 isXxx 标志不可靠
 * （Atoshi 自己的 provider 就把 isMetaMask 设成了 true），而我们也不需要区分：
 * 有 provider 就能连，没有就连不了。
 */
function hasInjectedProvider(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).ethereum);
}

/** 是不是 Atoshi 钱包自己的 WebView。只在这里面才自动连接。 */
function isAtoshiWebView(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).ethereum?.isAtoshiWallet);
}

export function useWallet() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [autoTried, setAutoTried] = useState(false);

  const injectedConnector = connectors.find((c) => c.id === 'injected' || c.type === 'injected');

  // 只在 Atoshi 钱包自己的 WebView 里自动连接 —— 用户已经在钱包里了，
  // 再要求他点一次「连接钱包」是多余的一步。
  //
  // 在 MetaMask 之类第三方钱包里不自动连：那属于「授权把地址给这个网站」，
  // 应该由用户主动触发，页面一打开就弹授权是不礼貌的做法。
  //
  // 只试一次 —— 用户主动断开后不该被反复拉起来。
  useEffect(() => {
    if (autoTried || isConnected || isPending) return;
    if (!isAtoshiWebView() || !injectedConnector) return;

    connect({ connector: injectedConnector });
    setAutoTried(true);
  }, [autoTried, isConnected, isPending, injectedConnector, connect]);

  const bech32Address = useMemo(() => {
    if (!address) return '';
    try {
      return hexToBech32(address);
    } catch {
      return '';
    }
  }, [address]);

  const wrongChain = isConnected && chainId !== undefined && chainId !== CHAIN_ID;

  return {
    /** 0x 地址，写操作和展示用 */
    address,
    /** atoshi1… 地址，REST 查询用 */
    bech32Address,
    isConnected,
    isConnecting: isPending,
    /** 连着钱包但不在 Atoshi 链上 */
    wrongChain,
    chainId,
    expectedChainId: CHAIN_ID,
    /** 当前环境有没有钱包可连。没有时不该显示「连接钱包」按钮 —— 点了不会有反应 */
    hasProvider: hasInjectedProvider(),
    connect: () => {
      if (injectedConnector) connect({ connector: injectedConnector });
    },
    disconnect: () => disconnect(),
    switchToAtoshi: () => switchChain({ chainId: CHAIN_ID }),
  };
}
