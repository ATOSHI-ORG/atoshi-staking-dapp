import React, { useState } from 'react';
import { Check, ChevronLeft, Copy, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { shortenAddress } from '../utils/format';
import { useLanguage } from '../i18n/LanguageContext';

interface WalletHeaderProps {
  address?: string;
  onRefresh: () => void;
  isLoading?: boolean;
  onDisconnect: () => void;
}

export const WalletHeader: React.FC<WalletHeaderProps> = ({
  address,
  onRefresh,
  isLoading,
  onDisconnect,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <header className="sticky top-0 z-30 mx-4 border-b border-[#F0F2F5] bg-white shadow-xs lg:mx-8">
      {/* WebView Top App Bar */}
      <div className="mx-auto flex w-full items-center justify-between px-2 py-3 sm:px-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            id="wallet-back-btn"
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            title={language === 'zh' ? '返回钱包' : 'Back to Wallet'}
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              }
            }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-[17px] font-bold text-gray-900 leading-none">{t('appTitle')}</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="whitespace-nowrap text-[11px] font-medium text-gray-400">{t('networkName')}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Language Switcher Button */}
          <div className="flex shrink-0 items-center bg-[#F1F3F6] p-0.5 rounded-lg border border-[#E5E7EB]">
            <button
              type="button"
              id="lang-switch-en"
              onClick={() => setLanguage('en')}
              className={`whitespace-nowrap px-2 py-0.5 text-[11px] font-bold rounded-md transition-all ${
                language === 'en'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              id="lang-switch-zh"
              onClick={() => setLanguage('zh')}
              className={`whitespace-nowrap px-2 py-0.5 text-[11px] font-bold rounded-md transition-all ${
                language === 'zh'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              中文
            </button>
          </div>

          {/* Refresh button */}
          <button
            type="button"
            id="refresh-state-btn"
            onClick={onRefresh}
            disabled={isLoading}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-50"
            title={language === 'zh' ? '刷新链上数据' : 'Refresh On-Chain Data'}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Only a connected wallet may be presented as "My Address". */}
      {address && (
        <div className="border-t border-[#F4F5F7] bg-[#FAFBFD]">
          <div className="mx-auto flex w-full items-center justify-between px-4 py-2 text-[12px] lg:px-8">
            <div className="flex min-w-0 items-center gap-1.5 text-gray-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="whitespace-nowrap">{t('myAddress')}:</span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex min-w-0 items-center gap-1 font-mono font-medium text-gray-800 transition-colors hover:text-blue-600"
              >
                <span className="whitespace-nowrap">{shortenAddress(address, 8, 6)}</span>
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-gray-400" />}
              </button>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden text-[11px] font-medium text-gray-400 lg:inline">
                {t('dualTokenSystem')}
              </span>
              <button
                type="button"
                id="wallet-disconnect-btn"
                onClick={onDisconnect}
                title={t('walletDisconnect')}
                className="flex h-7 shrink-0 items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-medium text-rose-600 transition-colors hover:bg-rose-50 active:bg-rose-100"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden whitespace-nowrap min-[380px]:inline">{t('walletDisconnect')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
