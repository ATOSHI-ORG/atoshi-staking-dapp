import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Clock, AlertTriangle, ArrowRight, Loader2, CheckCircle2, Zap } from 'lucide-react';
import { Validator, EnergyAccountData } from '../../types';
import { formatCoinAmount, parseHumanAmountToRaw, rawToNumber, formatCommission } from '../../utils/format';
import { useLanguage } from '../../i18n/LanguageContext';

interface DelegateModalProps {
  isOpen: boolean;
  onClose: () => void;
  validator: Validator | null;
  allValidators: Validator[];
  availableAtos: string;
  energyData: EnergyAccountData;
  onConfirm: (valoper: string, rawAmount: string) => Promise<void>;
}

export const DelegateModal: React.FC<DelegateModalProps> = ({
  isOpen,
  onClose,
  validator,
  allValidators,
  availableAtos,
  energyData,
  onConfirm,
}) => {
  const { t } = useLanguage();
  const [selectedValidator, setSelectedValidator] = useState<Validator | null>(validator);
  const [amountInput, setAmountInput] = useState<string>('');
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (validator) {
      setSelectedValidator(validator);
    } else if (allValidators.length > 0 && !selectedValidator) {
      const activeFirst = allValidators.find((v) => !v.jailed && v.in_active_set) || allValidators[0];
      setSelectedValidator(activeFirst);
    }
  }, [validator, allValidators]);

  useEffect(() => {
    if (isOpen) {
      setAmountInput('');
      setStep('input');
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const availableNum = rawToNumber(availableAtos);
  const gasBuffer = 0.1; // 0.1 ATOS gas buffer
  const maxAvailableForStake = Math.max(0, availableNum - gasBuffer);

  const handleQuickPercent = (pct: number) => {
    const calculated = (maxAvailableForStake * pct) / 100;
    setAmountInput(calculated > 0 ? calculated.toFixed(4) : '0');
    setErrorMsg(null);
  };

  const handleNextStep = () => {
    setErrorMsg(null);
    if (!selectedValidator) {
      setErrorMsg(t('errSelectValidValidator'));
      return;
    }
    if (selectedValidator.jailed) {
      setErrorMsg(t('errValidatorJailed'));
      return;
    }

    const inputNum = parseFloat(amountInput);
    if (isNaN(inputNum) || inputNum <= 0) {
      setErrorMsg(t('errInvalidAmount'));
      return;
    }

    if (inputNum > availableNum) {
      setErrorMsg(t('errExceedsAvailable'));
      return;
    }

    setStep('confirm');
  };

  const handleSubmit = async () => {
    if (!selectedValidator) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const rawAmount = parseHumanAmountToRaw(amountInput);
      await onConfirm(selectedValidator.operator_address, rawAmount);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || t('toastErrorGeneral'));
      setIsSubmitting(false);
    }
  };

  const estimatedRewardAtoxPerYear = selectedValidator
    ? (parseFloat(amountInput || '0') * selectedValidator.estimated_apr_atox).toFixed(4)
    : '0.0000';

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
              {step === 'input' ? t('modalDelegateTitle') : t('modalDelegateConfirmTitle')}
            </h2>
            <p className="text-[12px] text-gray-500">
              {step === 'input' ? t('modalDelegateSubtitle') : t('modalDelegateConfirmSubtitle')}
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

          {step === 'input' ? (
            <>
              {/* Validator Selector */}
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
                  {t('selectTargetValidator')}
                </label>
                <select
                  id="delegate-validator-select"
                  value={selectedValidator?.operator_address || ''}
                  onChange={(e) => {
                    const found = allValidators.find((v) => v.operator_address === e.target.value);
                    if (found) setSelectedValidator(found);
                  }}
                  className="w-full px-3.5 py-2.5 bg-[#FAFBFD] border border-[#E5E7EB] rounded-xl text-gray-900 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  {allValidators.map((v) => (
                    <option key={v.operator_address} value={v.operator_address} disabled={v.jailed}>
                      {v.moniker} {v.jailed ? `(${t('jailedStatus')})` : `(${t('commissionLabel')} ${formatCommission(v.commission_rate)} | ${t('estAprLabel')} ${v.estimated_apr_atox.toFixed(2)} ATOX/ATOS)`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Validator Info Preview */}
              {selectedValidator && (
                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#EEF2F6] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-blue-600/10 text-blue-700 font-bold flex items-center justify-center text-[13px]">
                      {selectedValidator.moniker.slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-[13px]">{selectedValidator.moniker}</div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                        <span>{t('validatorCommission')}: <strong className="text-gray-700 font-mono">{formatCommission(selectedValidator.commission_rate)}</strong></span>
                        <span>•</span>
                        <span>{t('validatorUptime')}: <strong className="text-emerald-600 font-mono">{selectedValidator.uptime_percent}%</strong></span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-gray-400">{t('estAprLabel')}</div>
                    <div className="text-[13px] font-bold text-blue-600 font-mono">
                      {selectedValidator.estimated_apr_atox.toFixed(2)} ATOX/ATOS
                    </div>
                  </div>
                </div>
              )}

              {/* Amount Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12px] font-semibold text-gray-700">{t('stakeAmountLabel')}</label>
                  <span className="text-[12px] text-gray-500">
                    {t('availableLabel')}: <span className="font-mono text-gray-800 font-medium">{formatCoinAmount(availableAtos)} ATOS</span>
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    id="delegate-amount-input"
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
                      {pct === 100 ? t('quickMax') : `${pct}%`}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-gray-400 mt-1 flex justify-between">
                  <span>{t('gasBufferHint')}</span>
                </div>
              </div>

              {/* Energy & Dual Token Key Rules Callout */}
              <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-xl space-y-1.5 text-[12px]">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>{t('energyProtectionTitle')}</span>
                </div>
                <p className="text-amber-800 leading-relaxed">
                  {t('energyProtectionDesc')}
                </p>
                <p className="text-amber-700/90 text-[11px]">
                  {t('atoxRewardNote')}
                </p>
              </div>
            </>
          ) : (
            /* Confirmation Step */
            <div className="space-y-4">
              <div className="bg-[#FAFBFD] p-4 rounded-xl border border-[#EEF2F6] space-y-3">
                <div className="flex justify-between py-1 text-gray-500 border-b border-[#F0F2F5]">
                  <span>{t('targetValidatorLabel')}</span>
                  <span className="font-semibold text-gray-900">{selectedValidator?.moniker}</span>
                </div>
                <div className="flex justify-between py-1 text-gray-500 border-b border-[#F0F2F5]">
                  <span>{t('validatorCommission')}</span>
                  <span className="font-mono text-gray-800">
                    {selectedValidator ? formatCommission(selectedValidator.commission_rate) : '5.00%'}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-gray-500 border-b border-[#F0F2F5]">
                  <span>{t('stakeAmountLabel')}</span>
                  <span className="font-mono font-bold text-[15px] text-blue-600">
                    {parseFloat(amountInput || '0').toFixed(4)} ATOS
                  </span>
                </div>
                <div className="flex justify-between py-1 text-gray-500 border-b border-[#F0F2F5]">
                  <span>{t('estAnnualAtoxReward')}</span>
                  <span className="font-mono font-bold text-emerald-600">
                    ≈ {estimatedRewardAtoxPerYear} ATOX
                  </span>
                </div>
                <div className="flex justify-between py-1 text-gray-500">
                  <span>{t('estGasFee')}</span>
                  <span className="flex items-center gap-1 text-emerald-600 font-medium">
                    <Zap className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500" />
                    {t('energyCoveredGas')}
                  </span>
                </div>
              </div>

              {/* Crucial mandatory disclosures */}
              <div className="space-y-2 text-[12px]">
                <div className="flex items-start gap-2 text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    {t('energyProtectionDesc')}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <Clock className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                  <span>
                    {t('unbondingDurationWarning')}
                  </span>
                </div>
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
              id="delegate-next-btn"
              onClick={handleNextStep}
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-xl text-[14px] transition-colors flex items-center justify-center gap-1.5"
            >
              <span>{t('btnNextReview')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              id="delegate-submit-btn"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-xl text-[14px] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('btnSigning')}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('btnConfirmStake')}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
