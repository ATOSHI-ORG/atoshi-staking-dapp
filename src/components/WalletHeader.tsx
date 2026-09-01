import React, { useState } from 'react';
import { ChevronLeft, RefreshCw, Zap, ShieldCheck, Copy, Check, Globe } from 'lucide-react';
import { shortenAddress } from '../utils/format';
import { useLanguage } from '../i18n/LanguageContext';

interface WalletHeaderProps {
  address: string;
  energyBalance: number;
  qualifiesForEnergy: boolean;
  onRefresh: () => void;
  isLoading?: boolean;
  onOpenEnergyInfo: () => void;
}

export const WalletHeader: React.FC<WalletHeaderProps> = ({
  address,
  energyBalance,
  qualifiesForEnergy,
  onRefresh,
  isLoading,
  onOpenEnergyInfo,
}) => {
  const { language, toggleLanguage, setLanguage, t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#F0F2F5] shadow-xs">
      {/* WebView Top App Bar */}
      <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
        <div className="flex items-center gap-2.5">
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
              <span className="text-[11px] text-gray-400 font-medium">{t('networkName')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Language Switcher Button */}
          <div className="flex items-center bg-[#F1F3F6] p-0.5 rounded-lg border border-[#E5E7EB]">
            <button
              type="button"
              id="lang-switch-en"
              onClick={() => setLanguage('en')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all ${
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
              className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all ${
                language === 'zh'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              中文
            </button>
          </div>

          {/* Energy badge */}
          <button
            type="button"
            id="energy-header-badge"
            onClick={onOpenEnergyInfo}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium border transition-colors ${
              qualifiesForEnergy
                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${qualifiesForEnergy ? 'fill-amber-500 text-amber-500' : 'text-gray-400'}`} />
            <span className="hidden xs:inline sm:inline">{qualifiesForEnergy ? t('energyFreeGas') : t('energyNoFreeGas')}</span>
            <span className="xs:hidden sm:hidden">{qualifiesForEnergy ? 'Gas Free' : 'No Free'}</span>
          </button>

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

      {/* Sub Header: Wallet Address Info */}
      <div className="bg-[#FAFBFD] px-4 py-2 border-t border-[#F4F5F7] flex items-center justify-between text-[12px] max-w-lg mx-auto">
        <div className="flex items-center gap-1.5 text-gray-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>{t('myAddress')}:</span>
          <button
            type="button"
            onClick={handleCopy}
            className="font-mono text-gray-800 font-medium flex items-center gap-1 hover:text-blue-600 transition-colors"
          >
            <span>{shortenAddress(address, 8, 6)}</span>
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-gray-400" />}
          </button>
        </div>

        <div className="text-[11px] text-gray-400 font-medium">
          {t('dualTokenSystem')}
        </div>
      </div>
    </header>
  );
};
