/**
 * 钱包状态条。三种状态，只在需要时占位：
 *
 *  1. 已连接、链正确 → 什么都不显示。用户在钱包里打开 DApp 已经是「已连接」，
 *     再挂一个「已连接 0x71cb…」的条只是占掉首屏空间。
 *  2. 未连接 → 显示连接按钮，并说明为什么需要（只读数据不用连，签名才用）。
 *  3. 连着但在别的链上 → 红条 + 一键切链。这个最重要：不拦住的话页面会安静地
 *     显示一堆 0，用户完全看不出是链选错了。
 *
 * 按钮是自己写的而不是用 RainbowKit 的 —— 见 wallet/config.ts 里关于体积的说明。
 */

import { AlertTriangle, Wallet } from 'lucide-react';

import { useLanguage } from '../i18n/LanguageContext';

interface WalletBarProps {
  isConnected: boolean;
  isConnecting: boolean;
  wrongChain: boolean;
  hasProvider: boolean;
  onConnect: () => void;
  onSwitchChain: () => void;
}

export function WalletBar({
  isConnected,
  isConnecting,
  wrongChain,
  hasProvider,
  onConnect,
  onSwitchChain,
}: WalletBarProps) {
  const { t } = useLanguage();

  if (wrongChain) {
    return (
      <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
        <p className="flex-1 text-[12px] leading-snug text-red-700">{t('walletWrongChain')}</p>
        <button
          onClick={onSwitchChain}
          className="shrink-0 rounded-lg bg-red-600 px-2.5 py-1.5 text-[12px] font-medium text-white active:bg-red-700"
        >
          {t('walletSwitchChain')}
        </button>
      </div>
    );
  }

  if (isConnected) return null;

  return (
    <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-[#ECEFF3] bg-white px-3 py-2.5">
      <p className="flex-1 text-[12px] leading-snug text-gray-500">
        {/* 页面在普通浏览器里打开时根本没有钱包可连，这时提示「请连接钱包」是
            误导 —— 用户点了也不会有任何反应。分开说清楚。 */}
        {hasProvider ? t('walletConnectHint') : t('walletNoProvider')}
      </p>
      {hasProvider && (
        <button
          onClick={onConnect}
          disabled={isConnecting}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#111827] px-3 py-1.5 text-[12px] font-medium text-white active:bg-black disabled:opacity-50"
        >
          <Wallet className="h-3.5 w-3.5" />
          {isConnecting ? t('walletConnecting') : t('walletConnect')}
        </button>
      )}
    </div>
  );
}
