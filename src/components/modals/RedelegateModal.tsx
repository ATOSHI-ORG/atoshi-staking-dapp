import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, Zap, AlertTriangle, ArrowRight, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { DelegationItem, Validator } from '../../types';
import { formatCoinAmount, parseHumanAmountToRaw, rawToNumber, formatCommission } from '../../utils/format';
import { useLanguage } from '../../i18n/LanguageContext';

interface RedelegateModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSrcDelegation: DelegationItem | null;
  allDelegations: DelegationItem[];
  allValidators: Validator[];
  onConfirm: (srcVal: string, dstVal: string, rawAmount: string) => Promise<void>;
}

export const RedelegateModal: React.FC<RedelegateModalProps> = ({
  isOpen,
  onClose,
  initialSrcDelegation,
  allDelegations,
  allValidators,
  onConfirm,
}) => {
  const { t } = useLanguage();
  const [srcValoper, setSrcValoper] = useState<string>('');
  const [dstValoper, setDstValoper] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialSrcDelegation) {
      setSrcValoper(initialSrcDelegation.validator_address);
    } else if (allDelegations.length > 0) {
      setSrcValoper(allDelegations[0].validator_address);
    }
  }, [initialSrcDelegation, allDelegations]);

  // Set default dst validator different from src
  useEffect(() => {
    if (allValidators.length > 0 && srcValoper) {
      const candidates = allValidators.filter((v) => v.operator_address !== srcValoper && !v.jailed);
      if (candidates.length > 0 && (!dstValoper || dstValoper === srcValoper)) {
        setDstValoper(candidates[0].operator_address);
      }
    }
  }, [srcValoper, allValidators, dstValoper]);

  useEffect(() => {
    if (isOpen) {
      setAmountInput('');
      setStep('input');
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentSrcDelegation = allDelegations.find((d) => d.validator_address === srcValoper);
  const currentDstValidator = allValidators.find((v) => v.operator_address === dstValoper);
  const maxRedelegateNum = currentSrcDelegation ? rawToNumber(currentSrcDelegation.amount) : 0;

  const handleQuickPercent = (pct: number) => {
    const calculated = (maxRedelegateNum * pct) / 100;
    setAmountInput(calculated > 0 ? calculated.toFixed(4) : '0');
    setErrorMsg(null);
  };

  const handleNextStep = () => {
    setErrorMsg(null);
    if (!currentSrcDelegation) {
      setErrorMsg(t('errSelectValidDelegation'));
      return;
    }
    if (!currentDstValidator) {
      setErrorMsg(t('errSelectValidValidator'));
      return;
    }
    if (srcValoper === dstValoper) {
      setErrorMsg(t('errSameSrcDst'));
      return;
    }
    if (currentDstValidator.jailed) {
      setErrorMsg(t('errValidatorJailed'));
      return;
    }

    const inputNum = parseFloat(amountInput);
    if (isNaN(inputNum) || inputNum <= 0) {
      setErrorMsg(t('errInvalidAmount'));
      return;
    }

    if (inputNum > maxRedelegateNum) {
      setErrorMsg(t('errExceedsDelegation'));
      return;
    }

    setStep('confirm');
  };

  const handleSubmit = async () => {
    if (!currentSrcDelegation || !currentDstValidator) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const rawAmount = parseHumanAmountToRaw(amountInput);
      await onConfirm(srcValoper, dstValoper, rawAmount);
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
          <div>
            <h2 className="text-[16px] font-bold text-gray-900 leading-tight">
              {step === 'input' ? t('modalRedelegateTitle') : t('modalRedelegateConfirmTitle')}
            </h2>
            <p className="text-[12px] text-gray-500">
              {step === 'input' ? t('modalRedelegateSubtitle') : t('modalRedelegateConfirmSubtitle')}
            </p>
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

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-[13px]">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[12px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Key Value Proposition Callout: NO 21-DAY WAITING */}
          <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-xl space-y-1 text-[12px]">
            <div className="flex items-center gap-1.5 font-bold text-emerald-900">
              <Zap className="w-4 h-4 text-emerald-600 fill-emerald-600" />
              <span>{t('redelegateAdvantageTitle')}</span>
            </div>
            <p className="text-emerald-800 leading-relaxed">
              {t('redelegateAdvantageDesc')}
            </p>
          </div>

          {step === 'input' ? (
            <>
              {/* Source Validator Selection */}
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
                  {t('stepSelectSrcVal')}
                </label>
                <select
                  id="redelegate-src-select"
                  value={srcValoper}
                  onChange={(e) => setSrcValoper(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAFBFD] border border-[#E5E7EB] rounded-xl text-gray-900 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  {allDelegations.map((d) => (
                    <option key={d.validator_address} value={d.validator_address}>
                      {d.validator_moniker} ({formatCoinAmount(d.amount)} ATOS)
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination Validator Selection */}
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
                  {t('stepSelectDstVal')}
                </label>
                <select
                  id="redelegate-dst-select"
                  value={dstValoper}
                  onChange={(e) => setDstValoper(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAFBFD] border border-[#E5E7EB] rounded-xl text-gray-900 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  {allValidators
                    .filter((v) => v.operator_address !== srcValoper)
                    .map((v) => (
                      <option key={v.operator_address} value={v.operator_address} disabled={v.jailed}>
                        {v.moniker} {v.jailed ? `(${t('jailedStatus')})` : `(${t('commissionLabel')} ${formatCommission(v.commission_rate)} | ${t('estAprLabel')} ${v.estimated_apr_atox.toFixed(2)} ATOX/ATOS)`}
                      </option>
                    ))}
                </select>
              </div>

              {/* Amount Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12px] font-semibold text-gray-700">{t('redelegateAmountLabel')}</label>
                  <span className="text-[12px] text-gray-500">
                    {t('srcDelegationTotal')}: <span className="font-mono text-gray-800 font-medium">{formatCoinAmount(currentSrcDelegation?.amount)} ATOS</span>
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    id="redelegate-amount-input"
                    step="0.0001"
                    min="0"
                    placeholder="0.0000"
                    value={amountInput}
                    onChange={(e) => {
                      setAmountInput(e.target.value);
                      setErrorMsg(null);
                    }}
                    className="w-full pl-3.5 pr-16 py-3 bg-white border border-[#E5E7EB] rounded-xl text-[16px] font-mono font-medium text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-gray-500">ATOS</span>
                  </div>
                </div>

                {/* Quick percentage buttons */}
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleQuickPercent(pct)}
                      className="py-1.5 text-[12px] font-medium bg-[#F1F3F6] hover:bg-gray-200 active:bg-gray-300 text-gray-700 rounded-lg transition-colors"
                    >
                      {pct === 100 ? t('quickAll') : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cooldown Rule notice */}
              <div className="bg-[#FAFBFD] border border-[#EEF2F6] p-3 rounded-xl text-[12px] text-gray-500 space-y-1">
                <span className="font-semibold text-gray-700">{t('redelegateCooldownRule')}</span>
              </div>
            </>
          ) : (
            /* Confirmation Step */
            <div className="space-y-4">
              <div className="bg-[#FAFBFD] p-4 rounded-xl border border-[#EEF2F6] space-y-3">
                <div className="flex justify-between py-1 text-gray-500 border-b border-[#F0F2F5]">
                  <span>{t('redelegateSrcNode')}</span>
                  <span className="font-semibold text-gray-900">{currentSrcDelegation?.validator_moniker}</span>
                </div>
                <div className="flex justify-between py-1 text-gray-500 border-b border-[#F0F2F5]">
                  <span>{t('redelegateDstNode')}</span>
                  <span className="font-semibold text-blue-600">{currentDstValidator?.moniker}</span>
                </div>
                <div className="flex justify-between py-1 text-gray-500 border-b border-[#F0F2F5]">
                  <span>{t('redelegateDstCommission')}</span>
                  <span className="font-mono text-gray-800">
                    {currentDstValidator ? formatCommission(currentDstValidator.commission_rate) : '5.00%'}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-gray-500 border-b border-[#F0F2F5]">
                  <span>{t('redelegateAmountLabel')}</span>
                  <span className="font-mono font-bold text-[15px] text-blue-600">
                    {parseFloat(amountInput || '0').toFixed(4)} ATOS
                  </span>
                </div>
                <div className="flex justify-between py-1 text-gray-500">
                  <span>{t('redelegateEffectiveTime')}</span>
                  <span className="font-medium text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t('redelegateInstantEffective')}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-[12px] flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  {t('redelegateSettlementNotice')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#F0F2F5] bg-gray-50 flex items-center gap-3">
          {step === 'confirm' && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setStep('input')}
              className="py-2.5 px-4 bg-white border border-[#D1D5DB] hover:bg-gray-100 active:bg-gray-200 text-gray-700 font-medium rounded-xl text-[14px] transition-colors"
            >
              {t('btnBackEdit')}
            </button>
          )}

          {step === 'input' ? (
            <button
              type="button"
              id="redelegate-next-btn"
              onClick={handleNextStep}
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-xl text-[14px] transition-colors flex items-center justify-center gap-1.5"
            >
              <span>{t('btnNextReview')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              id="redelegate-submit-btn"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-xl text-[14px] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('btnRedelegating')}</span>
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>{t('btnConfirmRedelegate')}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
