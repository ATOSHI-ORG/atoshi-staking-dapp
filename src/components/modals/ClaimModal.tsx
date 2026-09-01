import React, { useState } from 'react';
import { X, Gift, Sparkles, AlertTriangle, Loader2, CheckCircle2, Zap, ArrowRight } from 'lucide-react';
import { DelegationItem, EnergyAccountData } from '../../types';
import { formatCoinAmount, rawToNumber } from '../../utils/format';
import { useLanguage } from '../../i18n/LanguageContext';

interface ClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDelegation: DelegationItem | null;
  allDelegations: DelegationItem[];
  availableAtos: string;
  energyData: EnergyAccountData;
  onConfirm: (validatorValoper?: string) => Promise<void>;
}

export const ClaimModal: React.FC<ClaimModalProps> = ({
  isOpen,
  onClose,
  targetDelegation,
  allDelegations,
  availableAtos,
  energyData,
  onConfirm,
}) => {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculate total pending rewards
  let totalPendingAtoxRaw = 0n;
  for (const d of allDelegations) {
    totalPendingAtoxRaw += BigInt(d.pending_reward_atox);
  }

  const isClaimSingle = !!targetDelegation;
  const rewardAmountToClaim = isClaimSingle
    ? targetDelegation.pending_reward_atox
    : totalPendingAtoxRaw.toString();

  const availableNum = rawToNumber(availableAtos);
  const isZeroGasAndNoEnergy = availableNum <= 0 && !energyData.qualifies_for_energy;

  const handleSubmit = async () => {
    if (isZeroGasAndNoEnergy) {
      setErrorMsg(t('errNoGasAndNoEnergy'));
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await onConfirm(isClaimSingle ? targetDelegation.validator_address : 'all');
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || t('toastErrorGeneral'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs transition-opacity p-0 sm:p-4">
      <div 
        className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in slide-in-from-bottom duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#F0F2F5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Gift className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-gray-900 leading-tight">
                {isClaimSingle ? t('modalClaimSingleTitle') : t('modalClaimAllTitle')}
              </h2>
              <p className="text-[12px] text-gray-500">{t('modalClaimSubtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-[13px]">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[12px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Reward Amount Display */}
          <div className="bg-[#FAFBFD] p-5 rounded-2xl border border-[#EEF2F6] text-center space-y-1">
            <div className="text-[12px] text-gray-500">{t('claimRewardDisplayLabel')}</div>
            <div className="text-[28px] font-mono font-bold text-blue-600 tracking-tight">
              {formatCoinAmount(rewardAmountToClaim)}
            </div>
            <div className="inline-flex items-center gap-1 text-[12px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full mt-1">
              <Sparkles className="w-3 h-3" />
              <span>ATOX</span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] space-y-2.5 text-[12px]">
            <div className="flex justify-between py-1 text-gray-500 border-b border-[#F0F2F5]">
              <span>{t('claimScopeLabel')}</span>
              <span className="font-semibold text-gray-900">
                {isClaimSingle ? targetDelegation.validator_moniker : t('allValidatorsScope', { count: allDelegations.length })}
              </span>
            </div>

            <div className="flex justify-between py-1 text-gray-500 border-b border-[#F0F2F5]">
              <span>{t('claimGasDesc')}</span>
              {energyData.qualifies_for_energy ? (
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 fill-emerald-500" />
                  {t('claimGasFree')}
                </span>
              ) : (
                <span className="font-mono text-gray-800 font-medium">≈ 0.0050 ATOS</span>
              )}
            </div>

            <div className="flex justify-between py-1 text-gray-500">
              <span>{t('currentAvailableAtos')}</span>
              <span className="font-mono text-gray-800 font-medium">
                {formatCoinAmount(availableAtos)} ATOS
              </span>
            </div>
          </div>

          {/* Gas warning if zero */}
          {isZeroGasAndNoEnergy && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[12px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>{t('insufficientGasTitle')}</strong>
                <p className="mt-0.5">{t('insufficientGasDesc')}</p>
              </div>
            </div>
          )}

          {/* Educational Note */}
          <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-200 text-blue-900 text-[12px] space-y-1">
            <span className="font-bold flex items-center gap-1.5 text-blue-800">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>{t('atoxAutoConversionExplainTitle')}</span>
            </span>
            <p className="text-blue-800 text-[12px] leading-relaxed">
              {t('atoxAutoConversionExplainDesc')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#F0F2F5] bg-gray-50 flex items-center gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="py-2.5 px-4 bg-white border border-[#D1D5DB] hover:bg-gray-100 active:bg-gray-200 text-gray-700 font-medium rounded-xl text-[14px] transition-colors"
          >
            {t('btnCancel')}
          </button>

          <button
            type="button"
            id="claim-submit-btn"
            disabled={isSubmitting || BigInt(rewardAmountToClaim || '0') <= 0n || isZeroGasAndNoEnergy}
            onClick={handleSubmit}
            className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-xl text-[14px] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('btnClaiming')}</span>
              </>
            ) : (
              <>
                <Gift className="w-4 h-4" />
                <span>{t('btnConfirmClaim')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
