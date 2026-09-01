import React from 'react';
import { X, AlertTriangle, ShieldAlert, ZapOff, CopyX, Scale } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface SlashingRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SlashingRulesModal: React.FC<SlashingRulesModalProps> = ({
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
            <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-gray-900 leading-tight">{t('modalSlashingTitle')}</h2>
              <p className="text-[12px] text-gray-500">{t('modalSlashingSubtitle')}</p>
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
          {/* Core Golden Rule */}
          <div className="bg-rose-50/80 p-4 rounded-xl border border-rose-200 text-rose-900">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-[14px]">{t('slashingGoldenRuleTitle')}</h3>
                <p className="text-[13px] text-rose-800 mt-1">
                  {t('slashingGoldenRuleDesc')}
                </p>
              </div>
            </div>
          </div>

          {/* Penalty 1: Downtime */}
          <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-gray-900">
                <ZapOff className="w-4 h-4 text-amber-600" />
                <span>{t('penaltyDowntimeTitle')}</span>
              </div>
              <span className="text-rose-600 font-bold font-mono text-[13px] bg-rose-50 px-2 py-0.5 rounded">
                {t('penaltyDowntimeValue')}
              </span>
            </div>
            <p className="text-gray-600 text-[12px]">
              {t('penaltyDowntimeDesc')}
            </p>
          </div>

          {/* Penalty 2: Double Sign */}
          <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-gray-900">
                <CopyX className="w-4 h-4 text-rose-600" />
                <span>{t('penaltyDoubleSignTitle')}</span>
              </div>
              <span className="text-rose-600 font-bold font-mono text-[13px] bg-rose-50 px-2 py-0.5 rounded">
                {t('penaltyDoubleSignValue')}
              </span>
            </div>
            <p className="text-gray-600 text-[12px]">
              {t('penaltyDoubleSignDesc')}
            </p>
          </div>

          {/* Network Safety Guardrails */}
          <div className="bg-[#FAFBFD] p-4 rounded-xl border border-[#EEF2F6] space-y-2">
            <div className="flex items-center gap-2 font-semibold text-gray-900 text-[13px]">
              <Scale className="w-4 h-4 text-blue-600" />
              <span>{t('securityGuardrailsTitle')}</span>
            </div>
            <ul className="text-[12px] text-gray-600 space-y-1.5 list-disc pl-4">
              <li>
                {t('securityGuardrails1')}
              </li>
              <li>
                {t('securityGuardrails2')}
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#F0F2F5] bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-gray-900 hover:bg-gray-800 active:bg-black text-white font-medium rounded-xl text-[14px] transition-colors"
          >
            {t('btnUnderstandRisks')}
          </button>
        </div>
      </div>
    </div>
  );
};
