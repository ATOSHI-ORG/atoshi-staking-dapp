import React from 'react';
import { X, Sparkles, RefreshCcw, Layers, ArrowRight, ShieldCheck, Info } from 'lucide-react';
import { formatCoinAmount, formatLargeAmount } from '../../utils/format';
import { AtoxGlobalData, AtoxAccountData } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';

interface AtoxInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  globalData: AtoxGlobalData;
  accountData: AtoxAccountData;
}

export const AtoxInfoModal: React.FC<AtoxInfoModalProps> = ({
  isOpen,
  onClose,
  globalData,
  accountData,
}) => {
  const { language, t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs transition-opacity p-0 sm:p-4">
      <div 
        className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in slide-in-from-bottom duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#F0F2F5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-gray-900 leading-tight">{t('modalAtoxInfoTitle')}</h2>
              <p className="text-[12px] text-gray-500">{t('modalAtoxInfoSubtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-[13px] text-gray-600 leading-relaxed">
          {/* Rule 1: Dual Token */}
          <div className="bg-[#FAFBFD] p-4 rounded-xl border border-[#EEF2F6]">
            <div className="flex items-center gap-2 font-semibold text-gray-900 mb-1.5">
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">1</div>
              <span>{t('atoxRule1Title')}</span>
            </div>
            <p className="text-gray-600 pl-7">
              {t('atoxRule1Desc')}
            </p>
          </div>

          {/* Rule 2: Auto Conversion */}
          <div className="bg-[#FAFBFD] p-4 rounded-xl border border-[#EEF2F6]">
            <div className="flex items-center gap-2 font-semibold text-gray-900 mb-1.5">
              <div className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center font-bold">2</div>
              <span>{t('atoxRule2Title')}</span>
            </div>
            <p className="text-gray-600 pl-7 mb-3">
              {t('atoxRule2Desc')}
            </p>
            <div className="pl-7">
              <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-2 rounded-lg text-[12px] flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  {t('atoxRule2Notice')}
                </span>
              </div>
            </div>
          </div>

          {/* Global Progress & Account stats */}
          <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                {t('atoxTrackerTitle')}
              </span>
              <span className="text-[12px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded">
                {globalData.tier_name}
              </span>
            </div>

            <div>
              <div className="flex justify-between text-[12px] text-gray-500 mb-1">
                <span>{t('releasedToPool')}</span>
                <span className="font-mono font-medium text-gray-800">
                  {formatLargeAmount(globalData.total_released_to_pool, 'ATOS', language)}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(2, (Number(globalData.total_released_to_pool) / (1e12 * 1e18)) * 100))}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                <span>{t('progressLabel', { percent: ((Number(BigInt(globalData.total_released_to_pool) / 1000000000000000000n) / 1000000000000) * 100).toFixed(4) })}</span>
                <span>{t('totalAtoxSupplyLabel')}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#F0F2F5] text-[12px]">
              <div className="bg-gray-50 p-2.5 rounded-lg">
                <div className="text-gray-400 text-[11px]">{t('myAtoxBalance')}</div>
                <div className="font-mono font-bold text-gray-900 mt-0.5">
                  {formatCoinAmount(accountData.atox_balance, 4)} <span className="text-[10px] text-gray-500 font-normal">ATOX</span>
                </div>
              </div>
              <div className="bg-gray-50 p-2.5 rounded-lg">
                <div className="text-gray-400 text-[11px]">{t('cumulativeConvertedAtos')}</div>
                <div className="font-mono font-bold text-emerald-600 mt-0.5">
                  {formatCoinAmount(accountData.cumulative_converted_atos, 4)} <span className="text-[10px] text-gray-500 font-normal">ATOS</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#F0F2F5] bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-gray-900 hover:bg-gray-800 active:bg-black text-white font-medium rounded-xl text-[14px] transition-colors"
          >
            {t('btnCloseUnderstand')}
          </button>
        </div>
      </div>
    </div>
  );
};
