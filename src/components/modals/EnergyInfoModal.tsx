import React from 'react';
import { X, Zap, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatCoinAmount } from '../../utils/format';
import { EnergyAccountData } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';

interface EnergyInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  energyData: EnergyAccountData;
}

export const EnergyInfoModal: React.FC<EnergyInfoModalProps> = ({
  isOpen,
  onClose,
  energyData,
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
            <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-gray-900 leading-tight">{t('modalEnergyTitle')}</h2>
              <p className="text-[12px] text-gray-500">{t('modalEnergySubtitle')}</p>
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
          {/* Key Rule: Staking counts towards energy! */}
          <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-200/80">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-amber-900 text-[14px]">{t('energyRuleMainTitle')}</h3>
                <p className="text-amber-800 text-[13px] mt-1">
                  {t('energyRuleMainDesc')}
                </p>
              </div>
            </div>
          </div>

          {/* Qualification status card */}
          <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900">{t('energyStatusTitle')}</span>
              {energyData.qualifies_for_energy ? (
                <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('energyQualifiedBadge')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[12px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {t('energyUnqualifiedBadge')}
                </span>
              )}
            </div>

            {/* Breakdown table */}
            <div className="space-y-2 pt-2 border-t border-[#F0F2F5] text-[12px]">
              <div className="flex justify-between py-1 text-gray-500">
                <span>{t('energyBreakdownAvailable')}</span>
                <span className="font-mono text-gray-800 font-medium">
                  {formatCoinAmount(energyData.available_atos)} ATOS
                </span>
              </div>
              <div className="flex justify-between py-1 text-gray-500">
                <span>{t('energyBreakdownStaked')}</span>
                <span className="font-mono text-emerald-600 font-medium">
                  + {formatCoinAmount(energyData.staked_atos)} ATOS
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-t border-dashed border-gray-200 text-gray-800 font-semibold">
                <span>{t('energyBreakdownTotal')}</span>
                <span className="font-mono text-[13px] text-gray-900">
                  {formatCoinAmount(energyData.total_calculated_atos)} ATOS
                </span>
              </div>
            </div>

            <div className="bg-[#FAFBFD] p-3 rounded-lg border border-[#F0F2F5] flex items-center justify-between text-[12px]">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span className="text-gray-700 font-medium">{t('energyDailyRemaining')}</span>
              </div>
              <span className="font-mono font-bold text-gray-900 text-[14px]">
                {t('txCountUnit', { count: energyData.free_gas_tx_remaining })}
              </span>
            </div>
          </div>

          {/* Rules Description */}
          <div className="space-y-2 text-[12px] text-gray-500">
            <h4 className="font-semibold text-gray-700 text-[13px]">{t('energyRulesDescTitle')}</h4>
            <ul className="list-disc pl-4 space-y-1">
              <li>{t('energyRulesDesc1')}</li>
              <li>{t('energyRulesDesc2')}</li>
              <li>{t('energyRulesDesc3')}</li>
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
            {t('btnCloseUnderstand')}
          </button>
        </div>
      </div>
    </div>
  );
};
