import React from 'react';
import { X, ShieldCheck, Globe, Activity, Award, AlertTriangle, ShieldAlert, CheckCircle2, ChevronRight, ExternalLink } from 'lucide-react';
import { Validator } from '../../types';
import { formatCoinAmount, formatLargeAmount, formatCommission, shortenAddress } from '../../utils/format';
import { useLanguage } from '../../i18n/LanguageContext';

interface ValidatorDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  validator: Validator | null;
  onDelegate: (validator: Validator) => void;
  onOpenSlashingRules: () => void;
}

export const ValidatorDetailModal: React.FC<ValidatorDetailModalProps> = ({
  isOpen,
  onClose,
  validator,
  onDelegate,
  onOpenSlashingRules,
}) => {
  const { t, language } = useLanguage();
  if (!isOpen || !validator) return null;

  const selfDelegationMet = BigInt(validator.self_delegation) >= 100000000n * 1000000000000000000n;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs transition-opacity p-0 sm:p-4">
      <div 
        className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in slide-in-from-bottom duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#F0F2F5] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-[15px] border border-blue-100">
              {validator.moniker.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-bold text-gray-900 leading-tight">{validator.moniker}</h2>
              </div>
              <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                {shortenAddress(validator.operator_address, 10, 8)}
              </p>
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
        <div className="p-5 overflow-y-auto space-y-4 text-[13px] text-gray-600">
          {/* Status Badge & Rank */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {validator.jailed ? (
                <span className="px-2.5 py-1 rounded-full text-[12px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {t('jailedBadge')}
                </span>
              ) : validator.in_active_set ? (
                <span className="px-2.5 py-1 rounded-full text-[12px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('activeSetBadge', { rank: validator.rank })}
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[12px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                  {t('candidateBadge', { rank: validator.rank })}
                </span>
              )}
            </div>

            <div className="text-right">
              <span className="text-[11px] text-gray-400">{t('estAprLabel')}</span>
              <div className="font-mono font-bold text-blue-600 text-[15px]">
                {validator.estimated_apr_atox}% <span className="text-[10px] text-gray-500 font-normal">ATOX</span>
              </div>
            </div>
          </div>

          {/* Jailed Warning */}
          {validator.jailed && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[12px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>{t('nodeJailedWarningTitle')}</strong>
                <p className="mt-0.5">{t('nodeJailedWarningDesc')}</p>
              </div>
            </div>
          )}

          {/* Description */}
          {validator.details && (
            <div className="bg-[#FAFBFD] p-3.5 rounded-xl border border-[#EEF2F6] text-[12px] text-gray-600 leading-relaxed">
              {validator.details}
            </div>
          )}

          {/* Self-Delegation Requirement Card */}
          <div className={`p-3.5 rounded-xl border ${selfDelegationMet ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'} space-y-1`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900 flex items-center gap-1.5 text-[12px]">
                <ShieldCheck className={`w-4 h-4 ${selfDelegationMet ? 'text-emerald-600' : 'text-rose-600'}`} />
                {t('validatorSelfStake')}
              </span>
              <span className="font-mono font-bold text-[13px] text-gray-900">
                {formatLargeAmount(validator.self_delegation, 'ATOS', language)}
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              {t('selfStakeRuleNote')}
            </p>
          </div>

          {/* Staking & Voting Power */}
          <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] space-y-3">
            <h3 className="font-semibold text-gray-900 text-[13px]">{t('stakingConsensusMetrics')}</h3>
            
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div className="bg-gray-50 p-2.5 rounded-lg">
                <div className="text-gray-400 text-[11px]">{t('totalStaked')}</div>
                <div className="font-mono font-bold text-gray-900 mt-0.5">
                  {formatLargeAmount(validator.tokens, 'ATOS', language)}
                </div>
              </div>
              <div className="bg-gray-50 p-2.5 rounded-lg">
                <div className="text-gray-400 text-[11px]">{t('votingPowerShare')}</div>
                <div className="font-mono font-bold text-gray-900 mt-0.5">
                  {validator.voting_power_percent}%
                </div>
              </div>
            </div>

            {/* Voting power bar */}
            <div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${Math.min(100, validator.voting_power_percent * 3)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Commission & Uptime */}
          <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] space-y-3">
            <h3 className="font-semibold text-gray-900 text-[13px]">{t('commissionAndUptimeTitle')}</h3>
            
            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between py-1 border-b border-[#F0F2F5]">
                <span className="text-gray-500">{t('currentCommissionRate')}</span>
                <span className="font-mono font-bold text-gray-900">
                  {formatCommission(validator.commission_rate)}
                  <span className="text-[11px] font-normal text-gray-400 ml-1.5">{t('onchainMinCommission')}</span>
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#F0F2F5]">
                <span className="text-gray-500">{t('maxCommissionDailyMax')}</span>
                <span className="font-mono text-gray-700">
                  {formatCommission(validator.commission_max_rate)} / {formatCommission(validator.commission_max_change_rate)} {t('perDay')}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#F0F2F5]">
                <span className="text-gray-500">{t('recent100BlocksUptime')}</span>
                <span className="font-mono font-bold text-emerald-600">
                  {validator.uptime_percent}% ({validator.signed_blocks_window - validator.missed_blocks_counter}/{validator.signed_blocks_window} {t('blocksUnit')})
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">{t('missedBlocksCounter')}</span>
                <span className={`font-mono font-medium ${validator.missed_blocks_counter > 20 ? 'text-rose-600' : 'text-gray-700'}`}>
                  {validator.missed_blocks_counter} {t('blocksUnit')} {t('missedBlocksJailWarning')}
                </span>
              </div>
            </div>
          </div>

          {/* Website Link if present */}
          {validator.website && (
            <div className="flex items-center justify-between p-3 bg-[#FAFBFD] rounded-xl border border-[#EEF2F6] text-[12px]">
              <div className="flex items-center gap-2 text-gray-600">
                <Globe className="w-4 h-4 text-gray-400" />
                <span>{t('officialWebsite')}:</span>
                <span className="font-medium text-gray-800">{validator.website}</span>
              </div>
            </div>
          )}

          {/* Slashing risk entry */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSlashingRules();
            }}
            className="w-full flex items-center justify-between p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[12px] text-amber-900 hover:bg-amber-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>{t('viewSlashingRulesBanner')}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-600" />
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#F0F2F5] bg-gray-50 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 bg-white border border-[#D1D5DB] hover:bg-gray-100 active:bg-gray-200 text-gray-700 font-medium rounded-xl text-[14px] transition-colors"
          >
            {t('btnClose')}
          </button>
          <button
            type="button"
            disabled={validator.jailed}
            onClick={() => {
              onClose();
              onDelegate(validator);
            }}
            className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-xl text-[14px] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{validator.jailed ? t('nodeJailedCantStake') : t('stakeToThisValidator')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
