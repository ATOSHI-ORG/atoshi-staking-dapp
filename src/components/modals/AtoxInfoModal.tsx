import React from 'react';
import { X, Sparkles, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface AtoxInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AtoxInfoModal: React.FC<AtoxInfoModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useLanguage();
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
