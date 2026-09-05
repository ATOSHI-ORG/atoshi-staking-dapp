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
  ArrowRight,
  Plus, 
  Minus,
  Gift,
  HelpCircle
} from 'lucide-react';
import { UnbondingEntry, StakingTxHistory, DelegationItem } from '../types';
import { formatCoinAmount, formatCountdown, formatDateTime, shortenAddress } from '../utils/format';
import { useLanguage } from '../i18n/LanguageContext';
import { EXPLORER_URL } from '../wallet/chain';

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
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:items-stretch lg:gap-3 lg:space-y-0">
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
                  className="flex h-full flex-col rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-xs"
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
                  <div className="mt-3 bg-[#FAFBFD] p-3 rounded-xl border border-[#F0F2F5] flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-gray-600 text-[12px]">
                      <Clock className="w-4 h-4 text-rose-600 animate-pulse" />
                      <span>{t('countdownLabel')}</span>
                    </div>
                    <div className="font-mono font-bold text-[13px] text-rose-600">
                      {countdown.text}
                    </div>
                  </div>

                  {/* Footer Meta */}
                  <div className="mt-auto flex items-center justify-between border-t border-[#F0F2F5] pt-3 text-[11px] text-gray-400">
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
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xs">
          {txHistory.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-gray-400">
              {t('noHistoryTitle')}
            </div>
          ) : (
            <>
              <div className="hidden border-b border-[#E5E7EB] bg-[#FAFBFD] px-4 py-2.5 text-[10px] font-semibold text-gray-400 lg:grid lg:grid-cols-[minmax(140px,1fr)_minmax(220px,1.6fr)_minmax(130px,0.8fr)_100px_145px_36px] lg:items-center lg:gap-4">
                <span>{t('historyTypeLabel')}</span>
                <span>{t('historyValidatorLabel')}</span>
                <span className="text-right">{t('historyAmountLabel')}</span>
                <span className="text-center">{t('historyStatusLabel')}</span>
                <span>{t('historyTimeLabel')}</span>
                <span className="sr-only">{t('historyExplorerLabel')}</span>
              </div>

              <div className="divide-y divide-[#EEF1F4]">
                {txHistory.map((tx) => {
                  const TxIcon = tx.type === 'delegate'
                    ? Plus
                    : tx.type === 'undelegate'
                      ? Minus
                      : tx.type === 'redelegate'
                        ? ArrowRightLeft
                        : Gift;
                  const typeLabel = tx.type === 'delegate'
                    ? t('txTypeDelegate')
                    : tx.type === 'undelegate'
                      ? t('txTypeUndelegate')
                      : tx.type === 'redelegate'
                        ? t('txTypeRedelegate')
                        : t('txTypeClaim');
                  const iconTone = tx.type === 'delegate'
                    ? 'bg-blue-50 text-blue-600'
                    : tx.type === 'undelegate'
                      ? 'bg-rose-50 text-rose-600'
                      : tx.type === 'redelegate'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-indigo-50 text-indigo-600';
                  const amountSign = tx.type === 'undelegate' ? '-' : tx.type === 'redelegate' ? '' : '+';
                  const amountTone = tx.type === 'undelegate'
                    ? 'text-rose-600'
                    : tx.denom === 'ATOX'
                      ? 'text-indigo-600'
                      : tx.type === 'redelegate'
                        ? 'text-emerald-600'
                        : 'text-gray-900';
                  const statusLabel = tx.status === 'success'
                    ? t('confirmedOnChain')
                    : tx.status === 'pending'
                      ? t('pendingOnChain')
                      : t('failedOnChain');
                  const statusTone = tx.status === 'success'
                    ? 'bg-emerald-50 text-emerald-700'
                    : tx.status === 'pending'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-rose-50 text-rose-700';
                  const sourceValidator = tx.validator_moniker
                    || (tx.validator_address ? shortenAddress(tx.validator_address, 10, 6) : '—');
                  const destinationValidator = tx.dst_validator_moniker
                    || (tx.dst_validator_address ? shortenAddress(tx.dst_validator_address, 10, 6) : '');

                  return (
                    <div
                      key={tx.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-4 py-3.5 text-[12px] transition-colors hover:bg-[#FAFBFD] lg:grid-cols-[minmax(140px,1fr)_minmax(220px,1.6fr)_minmax(130px,0.8fr)_100px_145px_36px] lg:gap-4"
                    >
                      <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2.5 lg:col-start-1">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconTone}`}>
                          <TxIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-gray-900" title={typeLabel}>{typeLabel}</div>
                          <div className="mt-0.5 text-[10px] text-gray-400 lg:hidden">{formatDateTime(tx.timestamp)}</div>
                        </div>
                      </div>

                      <div className="col-span-2 row-start-2 min-w-0 rounded-lg bg-[#FAFBFD] px-2.5 py-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:bg-transparent lg:p-0">
                        <div className="flex min-w-0 items-center gap-1.5 font-medium text-gray-700">
                          <span className="truncate" title={sourceValidator}>{sourceValidator}</span>
                          {destinationValidator && (
                            <>
                              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                              <span className="truncate" title={destinationValidator}>{destinationValidator}</span>
                            </>
                          )}
                        </div>
                        {tx.validator_address && (
                          <div className="mt-0.5 truncate font-mono text-[10px] text-gray-400" title={tx.validator_address}>
                            {shortenAddress(tx.validator_address, 12, 8)}
                          </div>
                        )}
                      </div>

                      <div className={`col-start-2 row-start-1 whitespace-nowrap text-right font-mono text-[13px] font-bold lg:col-start-3 ${amountTone}`}>
                        {amountSign}{formatCoinAmount(tx.amount)} <span className="text-[10px] font-medium">{tx.denom}</span>
                      </div>

                      <div className="col-start-1 row-start-3 lg:col-start-4 lg:row-start-1 lg:text-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold ${statusTone}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {statusLabel}
                        </span>
                      </div>

                      <div className="hidden text-[11px] text-gray-500 lg:col-start-5 lg:row-start-1 lg:block">
                        {formatDateTime(tx.timestamp)}
                      </div>

                      <a
                        href={`${EXPLORER_URL}/tx/${tx.tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${t('historyExplorerLabel')}: ${tx.tx_hash}`}
                        title={t('historyExplorerLabel')}
                        className="col-start-2 row-start-3 inline-flex min-w-0 items-center justify-self-end gap-1 font-mono text-[10px] text-blue-600 hover:text-blue-800 lg:col-start-6 lg:row-start-1 lg:h-8 lg:w-8 lg:justify-center lg:rounded-lg lg:hover:bg-blue-50"
                      >
                        <span className="truncate lg:hidden">{shortenAddress(tx.tx_hash, 8, 6)}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
