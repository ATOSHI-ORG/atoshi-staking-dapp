import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  AlertTriangle, 
  Ban, 
  CheckCircle2, 
  History, 
  Layers, 
  ExternalLink, 
  Sparkles, 
  ArrowRightLeft, 
  Plus, 
  Minus,
  Gift,
  HelpCircle
} from 'lucide-react';
import { UnbondingEntry, StakingTxHistory, DelegationItem } from '../types';
import { formatCoinAmount, formatCountdown, formatDateTime, shortenAddress } from '../utils/format';
import { useLanguage } from '../i18n/LanguageContext';

interface UnbondingTabProps {
  unbondingEntries: UnbondingEntry[];
  txHistory: StakingTxHistory[];
  delegations: DelegationItem[];
}

export const UnbondingTab: React.FC<UnbondingTabProps> = ({
  unbondingEntries,
  txHistory,
  delegations,
}) => {
  const { language, t } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState<'unbonding' | 'history'>('unbonding');
  const [, setTick] = useState<number>(0);

  // Re-render countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate total unbonding amount
  let totalUnbondingRaw = 0n;
  for (const entry of unbondingEntries) {
    totalUnbondingRaw += BigInt(entry.amount);
  }

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* 1. Unbonding Rules Alert Box (21-day lock, 7 max entries, no rewards, non-cancellable) */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-gray-900 leading-tight">{t('unbondingRulesTitle')}</h3>
            <p className="text-[11px] text-gray-400">{t('unbondingRulesSubtitle')}</p>
          </div>
        </div>

        {/* 4 Core Invariants */}
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div className="bg-[#FAFBFD] p-3 rounded-xl border border-[#EEF2F6] space-y-0.5">
            <div className="text-gray-400 text-[11px]">{t('unbondingPeriodLabel')}</div>
            <div className="font-mono font-bold text-rose-600 text-[14px]">
              {language === 'zh' ? '21 天' : '21 Days'} <span className="text-[11px] font-normal text-gray-400">({language === 'zh' ? '1,814,400 秒' : '1,814,400 s'})</span>
            </div>
          </div>

          <div className="bg-[#FAFBFD] p-3 rounded-xl border border-[#EEF2F6] space-y-0.5">
            <div className="text-gray-400 text-[11px]">{t('maxEntriesLabel')}</div>
            <div className="font-mono font-bold text-gray-900 text-[14px]">
              {language === 'zh' ? '最多 7 笔' : 'Max 7 Entries'} <span className="text-[11px] font-normal text-gray-400">(max_entries=7)</span>
            </div>
          </div>
        </div>

        <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200/80 space-y-1 text-[12px] text-rose-900">
          <div className="font-bold flex items-center gap-1.5 text-rose-800">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{t('unbondingImportantNotice')}</span>
          </div>
          <ul className="text-rose-800/90 space-y-0.5 list-disc pl-4 text-[11px] leading-relaxed">
            <li>{t('unbondingNoRewardNotice')}</li>
            <li>{t('unbondingIrreversibleNotice')}</li>
            <li>{t('unbondingRedelegateSuggestion')}</li>
          </ul>
        </div>
      </div>

      {/* 2. Sub Tab Switcher: 在途解质押 vs 历史记录 */}
      <div className="bg-[#F1F3F6] p-1 rounded-xl flex text-[13px] font-medium">
        <button
          type="button"
          onClick={() => setActiveSubTab('unbonding')}
          className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeSubTab === 'unbonding'
              ? 'bg-white text-gray-900 shadow-xs font-bold'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{t('tabInFlight', { count: unbondingEntries.length })}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('history')}
          className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeSubTab === 'history'
              ? 'bg-white text-gray-900 shadow-xs font-bold'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>{t('tabTxHistory')}</span>
        </button>
      </div>

      {/* 3. Sub Tab Content */}
      {activeSubTab === 'unbonding' ? (
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
          {unbondingEntries.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 text-center space-y-2 lg:col-span-2">
              <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <h4 className="text-[14px] font-bold text-gray-900">{t('noInFlightTitle')}</h4>
              <p className="text-[12px] text-gray-500">
                {t('noInFlightDesc')}
              </p>
            </div>
          ) : (
            unbondingEntries.map((entry) => {
              const countdown = formatCountdown(entry.completion_time, language);
              // Check in-flight entries count for this validator
              const sameValCount = unbondingEntries.filter((u) => u.validator_address === entry.validator_address).length;

              return (
                <div
                  key={entry.id}
                  className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-[13px] font-bold text-gray-900">{entry.validator_moniker}</h4>
                      <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                        {shortenAddress(entry.validator_address, 8, 6)}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-gray-400">{t('confirmUndelegateAmount')}</span>
                      <div className="font-mono font-bold text-rose-600 text-[14px]">
                        {formatCoinAmount(entry.amount)} <span className="text-[10px] text-gray-500 font-normal">ATOS</span>
                      </div>
                    </div>
                  </div>

                  {/* Real-time Countdown Box */}
                  <div className="bg-[#FAFBFD] p-3 rounded-xl border border-[#F0F2F5] flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-gray-600 text-[12px]">
                      <Clock className="w-4 h-4 text-rose-600 animate-pulse" />
                      <span>{t('countdownLabel')}</span>
                    </div>
                    <div className="font-mono font-bold text-[13px] text-rose-600">
                      {countdown.text}
                    </div>
                  </div>

                  {/* Footer Meta */}
                  <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-[#F0F2F5]">
                    <span>{t('initiatedAt', { time: formatDateTime(entry.creation_time) })}</span>
                    <span className="text-gray-500">{t('quotaUsed', { count: sameValCount })}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* History Tab */
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
          {txHistory.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 text-center text-gray-400 text-[13px] lg:col-span-2">
              {t('noHistoryTitle')}
            </div>
          ) : (
            txHistory.map((tx) => (
              <div
                key={tx.id}
                className="bg-white rounded-2xl border border-[#E5E7EB] p-3.5 shadow-xs space-y-2 text-[12px]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {tx.type === 'delegate' && (
                      <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {tx.type === 'undelegate' && (
                      <div className="w-6 h-6 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                        <Minus className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {tx.type === 'redelegate' && (
                      <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {tx.type === 'withdraw_rewards' && (
                      <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Gift className="w-3.5 h-3.5" />
                      </div>
                    )}

                    <div>
                      <span className="font-bold text-gray-900">
                        {tx.type === 'delegate' && t('txTypeDelegate')}
                        {tx.type === 'undelegate' && t('txTypeUndelegate')}
                        {tx.type === 'redelegate' && t('txTypeRedelegate')}
                        {tx.type === 'withdraw_rewards' && t('txTypeClaim')}
                      </span>
                      <div className="text-[11px] text-gray-400">{formatDateTime(tx.timestamp)}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`font-mono font-bold ${tx.denom === 'ATOX' ? 'text-blue-600' : tx.type === 'undelegate' ? 'text-rose-600' : 'text-gray-900'}`}>
                      {tx.type === 'undelegate' ? '-' : '+'}{formatCoinAmount(tx.amount)} {tx.denom}
                    </div>
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">
                      {t('confirmedOnChain')}
                    </span>
                  </div>
                </div>

                {tx.validator_moniker && (
                  <div className="bg-[#FAFBFD] p-2 rounded-lg text-[11px] text-gray-600 flex justify-between">
                    <span>{t('validatorLabel')}</span>
                    <span className="font-medium text-gray-800">
                      {tx.validator_moniker} {tx.dst_validator_moniker ? `➔ ${tx.dst_validator_moniker}` : ''}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
