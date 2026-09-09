import React, { useState, useEffect } from 'react';
import { X, Clock, AlertTriangle, ArrowRight, Loader2, AlertCircle, Ban } from 'lucide-react';
import { DelegationItem } from '../../types';
import { formatCoinAmount, parseHumanAmountToRaw, rawToNumber } from '../../utils/format';
import { transactionErrorMessage } from '../../utils/transactionError';
import { useLanguage } from '../../i18n/LanguageContext';

interface UndelegateModalProps {
  isOpen: boolean;
  onClose: () => void;
  delegation: DelegationItem | null;
  allDelegations: DelegationItem[];
  onConfirm: (valoper: string, rawAmount: string) => Promise<void>;
}

export const UndelegateModal: React.FC<UndelegateModalProps> = ({
  isOpen,
  onClose,
  delegation,
  allDelegations,
  onConfirm,
}) => {
  const { t } = useLanguage();
  const [selectedDelegation, setSelectedDelegation] = useState<DelegationItem | null>(delegation);
  const [amountInput, setAmountInput] = useState<string>('');
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (delegation) {
      setSelectedDelegation(delegation);
    } else if (allDelegations.length > 0 && !selectedDelegation) {
      setSelectedDelegation(allDelegations[0]);
    }
  }, [delegation, allDelegations]);

  useEffect(() => {
    if (isOpen) {
      setAmountInput('');
      setStep('input');
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentDelegationNum = selectedDelegation ? rawToNumber(selectedDelegation.amount) : 0;
  const inFlightCount = selectedDelegation?.in_flight_unbonding_count || 0;
  const isMaxEntriesReached = inFlightCount >= 7;

  const handleQuickPercent = (pct: number) => {
    const calculated = (currentDelegationNum * pct) / 100;
    setAmountInput(calculated > 0 ? calculated.toFixed(4) : '0');
    setErrorMsg(null);
  };

  const handleNextStep = () => {
    setErrorMsg(null);
    if (!selectedDelegation) {
      setErrorMsg(t('errSelectValidDelegation'));
      return;
    }

    if (isMaxEntriesReached) {
      setErrorMsg(t('errMaxEntriesReached'));
      return;
    }

    const inputNum = parseFloat(amountInput);
    if (isNaN(inputNum) || inputNum <= 0) {
      setErrorMsg(t('errInvalidAmount'));
      return;
    }

    if (inputNum > currentDelegationNum) {
      setErrorMsg(t('errExceedsDelegation'));
      return;
    }

    setStep('confirm');
  };

  const handleSubmit = async () => {
    if (!selectedDelegation) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const rawAmount = parseHumanAmountToRaw(amountInput);
      await onConfirm(selectedDelegation.validator_address, rawAmount);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(transactionErrorMessage(err, t));
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
              {step === 'input' ? t('modalUndelegateTitle') : t('modalUndelegateConfirmTitle')}
            </h2>
            <p className="text-[12px] text-gray-500">
              {step === 'input' ? t('modalUndelegateSubtitle') : t('modalUndelegateConfirmSubtitle')}
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

          {/* Max 7 in-flight entries warning if active */}
          {isMaxEntriesReached && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[12px] flex items-start gap-2.5">
              <Ban className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">{t('maxEntriesLimitReachedTitle')}</strong>
                <p className="mt-0.5 text-amber-700">
                  {t('maxEntriesLimitReachedDesc')}
                </p>
              </div>
            </div>
          )}

          {step === 'input' ? (
            <>
              {/* Delegation Target Selection */}
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
                  {t('selectDelegationToUndelegate')}
                </label>
                <select
                  id="undelegate-select"
                  value={selectedDelegation?.validator_address || ''}
                  onChange={(e) => {
                    const found = allDelegations.find((d) => d.validator_address === e.target.value);
                    if (found) setSelectedDelegation(found);
                  }}
                  className="w-full px-3.5 py-2.5 bg-[#FAFBFD] border border-[#E5E7EB] rounded-xl text-gray-900 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  {allDelegations.map((d) => (
                    <option key={d.validator_address} value={d.validator_address}>
                      {d.validator_moniker} ({formatCoinAmount(d.amount)} ATOS)
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Delegation Status */}
              {selectedDelegation && (
                <div className="bg-[#FAFBFD] p-3.5 rounded-xl border border-[#EEF2F6] space-y-2">
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-gray-500">{t('currentInFlightCount')}</span>
                    <span className="font-mono font-medium text-gray-800">
                      {selectedDelegation.in_flight_unbonding_count} / 7
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-gray-500">{t('totalPendingRewardsToClaim')}</span>
                    <span className="font-mono font-bold text-blue-600">
                      {formatCoinAmount(selectedDelegation.pending_reward_atox)} ATOX
                    </span>
                  </div>
                </div>
              )}

              {/* Amount Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12px] font-semibold text-gray-700">{t('confirmUndelegateAmount')}</label>
                  <span className="text-[12px] text-gray-500">
                    {t('maxUndelegateAvailable')}: <span className="font-mono text-gray-800 font-medium">{formatCoinAmount(selectedDelegation?.amount)} ATOS</span>
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    id="undelegate-amount-input"
                    step="0.0001"
                    min="0"
                    placeholder="0.0000"
                    value={amountInput}
                    disabled={isMaxEntriesReached}
                    onChange={(e) => {
                      setAmountInput(e.target.value);
                      setErrorMsg(null);
                    }}
                    className="w-full pl-3.5 pr-16 py-3 bg-white border border-[#E5E7EB] rounded-xl text-[16px] font-mono font-medium text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-100"
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
                      disabled={isMaxEntriesReached}
                      onClick={() => handleQuickPercent(pct)}
                      className="py-1.5 text-[12px] font-medium bg-[#F1F3F6] hover:bg-gray-200 active:bg-gray-300 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {pct === 100 ? t('quickAll') : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Crucial 21-day lock rules */}
              <div className="bg-rose-50/70 border border-rose-200/80 p-3.5 rounded-xl space-y-2 text-[12px]">
                <div className="flex items-center gap-1.5 font-bold text-rose-900">
                  <Clock className="w-4 h-4 text-rose-600" />
                  <span>{t('hardRules21DaysTitle')}</span>
                </div>
                <ul className="text-rose-800 space-y-1 pl-4 list-disc text-[12px]">
                  <li>{t('hardRules21Days1')}</li>
                  <li>{t('hardRules21Days2')}</li>
                  <li>{t('hardRules21Days3')}</li>
                </ul>
              </div>
            </>
          ) : (
            /* Confirmation Step */
            <div className="space-y-4">
              <div className="bg-[#FAFBFD] p-4 rounded-xl border border-[#EEF2F6] space-y-3">
                <div className="flex justify-between py-1 text-gray-500 border-b border-[#F0F2F5]">
                  <span>{t('confirmTargetValidator')}</span>
                  <span className="font-semibold text-gray-900">{selectedDelegation?.validator_moniker}</span>
                </div>
                <div className="flex justify-between py-1 text-gray-500 border-b border-[#F0F2F5]">
                  <span>{t('confirmUndelegateAmount')}</span>
                  <span className="font-mono font-bold text-[15px] text-rose-600">
                    {parseFloat(amountInput || '0').toFixed(4)} ATOS
                  </span>
                </div>
                <div className="flex justify-between py-1 text-gray-500 border-b border-[#F0F2F5]">
                  <span>{t('confirmEstUnlockTime')}</span>
                  <span className="font-mono font-medium text-gray-800">
                    {new Date(Date.now() + 21 * 86400 * 1000).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-gray-500">
                  <span>{t('confirmInFlightChange')}</span>
                  <span className="font-mono text-gray-800">
                    {inFlightCount} ➔ {inFlightCount + 1} (Max 7)
                  </span>
                </div>
              </div>

              {/* Irreversible Double Warning Banner */}
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-[12px] space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-700">
                  <AlertCircle className="w-4 h-4" />
                  <span>{t('redelegateReminderBoxTitle')}</span>
                </div>
                <p className="text-rose-800 text-[12px] leading-relaxed">
                  {t('redelegateReminderBoxDesc')}
                </p>
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
              id="undelegate-next-btn"
              disabled={isMaxEntriesReached}
              onClick={handleNextStep}
              className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-medium rounded-xl text-[14px] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <span>{t('btnNextReview')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              id="undelegate-submit-btn"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-medium rounded-xl text-[14px] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('btnUndelegating')}</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4" />
                  <span>{t('btnConfirmUndelegate')}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
