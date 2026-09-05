import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Gift, 
  Clock, 
  ArrowRightLeft, 
  Plus, 
  Minus, 
  Zap, 
  HelpCircle, 
  ChevronRight, 
  ArrowUpRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { 
  AccountAssets, 
  DelegationItem, 
  AtoxAccountData, 
  AtoxGlobalData, 
  Validator 
} from '../types';
import { 
  formatCoinAmount, 
  formatLargeAmount, 
  formatCountdown, 
  formatCommission 
} from '../utils/format';
import { useLanguage } from '../i18n/LanguageContext';

interface OverviewTabProps {
  assets: AccountAssets;
  delegations: DelegationItem[];
  atoxAccount: AtoxAccountData;
  atoxGlobal: AtoxGlobalData;
  validators: Validator[];
  onOpenDelegate: (validator?: Validator) => void;
  onOpenUndelegate: (delegation?: DelegationItem) => void;
  onOpenRedelegate: (delegation?: DelegationItem) => void;
  onOpenClaim: (delegation?: DelegationItem) => void;
  onOpenAtoxInfo: () => void;
  onNavigateToValidators: () => void;
  onNavigateToUnbonding: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  assets,
  delegations,
  atoxAccount,
  atoxGlobal,
  validators,
  onOpenDelegate,
  onOpenUndelegate,
  onOpenRedelegate,
  onOpenClaim,
  onOpenAtoxInfo,
  onNavigateToValidators,
  onNavigateToUnbonding,
}) => {
  const { language, t } = useLanguage();
  const [nearestCountdown, setNearestCountdown] = useState<string>('');

  useEffect(() => {
    if (!assets.nearest_unbonding_completion_time) {
      setNearestCountdown('');
      return;
    }

    const updateTimer = () => {
      const { text } = formatCountdown(assets.nearest_unbonding_completion_time!, language);
      setNearestCountdown(text);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [assets.nearest_unbonding_completion_time, language]);

  const hasPendingAtox = BigInt(assets.total_pending_atox || '0') > 0n;
  const hasUnbonding = BigInt(assets.unbonding_atos || '0') > 0n;

  return (
    <div
      className="space-y-4 pb-12 animate-in fade-in duration-200 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0"
    >
      {/* 1. Top Asset Card (White background, light gray grid dividers, 4 metrics) */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs overflow-hidden lg:col-span-2">
        {/* Header line of Asset Card */}
        <div className="px-4 py-3 bg-[#FAFBFD] border-b border-[#F0F2F5] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-bold text-gray-900">{t('assetOverviewTitle')}</span>
          </div>
          <div
            className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium"
          >
            <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
            <span>{t('energyHoldingsBadge')}</span>
          </div>
        </div>

        {/* 4 Numbers Grid */}
        <div className="grid grid-cols-2 divide-x divide-y divide-[#F0F2F5]">
          {/* 1. 可用余额 (ATOS) */}
          <div className="p-4 space-y-1">
            <div className="text-[11px] text-gray-400 font-medium">{t('availableBalance')}</div>
            <div className="text-[18px] font-mono font-bold text-gray-900 tracking-tight">
              {formatCoinAmount(assets.available_atos)}
            </div>
            <div className="text-[11px] text-gray-400">{t('availableDesc')}</div>
          </div>

          {/* 2. 质押中 (ATOS) */}
          <div className="p-4 space-y-1">
            <div className="text-[11px] text-gray-400 font-medium">{t('stakedBalance')}</div>
            <div className="text-[18px] font-mono font-bold text-blue-600 tracking-tight">
              {formatCoinAmount(assets.staked_atos)}
            </div>
            <div className="text-[11px] text-gray-500 flex items-center gap-1">
              <span>{t('stakedDesc')}</span>
            </div>
          </div>

          {/* 3. 解质押中 (ATOS) */}
          <div className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-400 font-medium">{t('unbondingBalance')}</span>
              {hasUnbonding && (
                <button
                  type="button"
                  onClick={onNavigateToUnbonding}
                  className="text-[10px] text-rose-600 font-medium hover:underline flex items-center"
                >
                  {t('detailsBtn')}
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="text-[18px] font-mono font-bold text-gray-700 tracking-tight">
              {formatCoinAmount(assets.unbonding_atos)}
            </div>
            {hasUnbonding && nearestCountdown ? (
              <div className="inline-flex items-center gap-1 text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded font-mono">
                <Clock className="w-2.5 h-2.5" />
                <span>{t('nearestCompletion', { time: nearestCountdown })}</span>
              </div>
            ) : (
              <div className="text-[11px] text-gray-400">{t('unbondingDesc')}</div>
            )}
          </div>

          {/* 4. 待领奖励 (ATOX) + Claim Button */}
          <div className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {t('pendingRewards')}
              </span>
            </div>
            <div className="text-[18px] font-mono font-bold text-emerald-600 tracking-tight">
              {formatCoinAmount(assets.total_pending_atox)}
            </div>
            <div className="pt-0.5">
              <button
                type="button"
                id="claim-all-rewards-btn"
                disabled={!hasPendingAtox}
                onClick={() => onOpenClaim()}
                className={`w-full py-1 px-2.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors ${
                  hasPendingAtox
                    ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Gift className="w-3 h-3" />
                <span>{hasPendingAtox ? t('claimAllBtn') : t('noPendingRewards')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick action strip */}
        <div className="px-4 py-2.5 bg-[#FAFBFD] border-t border-[#F0F2F5] flex items-center justify-between">
          <div className="text-[12px] text-gray-500">
            {t('delegatedCount', { count: delegations.length })}
          </div>
          <button
            type="button"
            id="overview-quick-stake-btn"
            onClick={() => onOpenDelegate()}
            className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[12px] font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('quickStakeBtn')}</span>
          </button>
        </div>
      </div>

      {/* 2. My Delegations List (我的委托列表) */}
      <div className="space-y-2.5 lg:col-span-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[14px] font-bold text-gray-900">
            {t('myDelegationsTitle')} <span className="text-[12px] font-normal text-gray-400 font-mono">({delegations.length})</span>
          </h3>
          <button
            type="button"
            onClick={onNavigateToValidators}
            className="text-[12px] text-blue-600 font-medium hover:text-blue-800 flex items-center gap-0.5"
          >
            <span>{t('allValidatorsBtn')}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {delegations.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Plus className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-[14px] font-bold text-gray-900">{t('emptyDelegationTitle')}</h4>
              <p className="text-[12px] text-gray-500 max-w-xs mx-auto">
                {t('emptyDelegationDesc')}
              </p>
            </div>
            <button
              type="button"
              id="empty-go-stake-btn"
              onClick={onNavigateToValidators}
              className="py-2 px-5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[13px] font-semibold rounded-xl shadow-xs transition-colors"
            >
              {t('emptyDelegationAction')}
            </button>
          </div>
        ) : (
          /* Delegations Cards */
          <div className="space-y-3 lg:grid lg:grid-cols-2 lg:items-stretch lg:gap-3 lg:space-y-0">
            {delegations.map((item, index) => {
              const matchedVal = validators.find((v) => v.operator_address === item.validator_address);
              const isJailed = item.validator_jailed || matchedVal?.jailed;
              const isLastOddCard = delegations.length % 2 === 1 && index === delegations.length - 1;

              return (
                <div
                  key={item.validator_address}
                  className={`flex h-full flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xs transition-all ${
                    isLastOddCard ? 'lg:col-span-2' : ''
                  }`}
                >
                  {/* Card Top: Moniker + Status + Amount */}
                  <div className="flex-1 p-4 space-y-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-[13px] border border-blue-100 shrink-0">
                        {item.validator_moniker.slice(0, 2)}
                      </div>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <h4 className="truncate text-[13px] font-bold leading-tight text-gray-900">
                          {item.validator_moniker}
                        </h4>
                        {isJailed ? (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            {t('jailedStatus')}
                          </span>
                        ) : (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {t('activeStatus')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Amount row */}
                    <div className="bg-[#FAFBFD] px-3 py-2 rounded-xl border border-[#F0F2F5] flex items-center justify-between text-[12px]">
                      <span className="text-gray-500">{t('delegatedAmount')}</span>
                      <span className="font-mono font-bold text-gray-900 text-[14px]">
                        {formatCoinAmount(item.amount)} <span className="text-[11px] text-gray-500 font-normal">ATOS</span>
                      </span>
                    </div>

                    {/* Metric table: labels on the first row, values directly below. */}
                    <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-[#F0F2F5] bg-[#FAFBFD] text-center">
                      <div className="flex min-h-9 items-center justify-center px-1.5 py-1.5 text-[10px] font-medium leading-tight text-gray-500">
                        {t('commissionLabel')}
                      </div>
                      <div className="flex min-h-9 items-center justify-center border-l border-[#F0F2F5] px-1.5 py-1.5 text-[10px] font-medium leading-tight text-gray-500">
                        {t('estAprLabel')}
                      </div>
                      <div className="flex min-h-9 items-center justify-center border-l border-[#F0F2F5] px-1.5 py-1.5 text-[10px] font-medium leading-tight text-gray-500">
                        {t('pendingAtox')}
                      </div>

                      <div className="flex min-h-10 items-center justify-center border-t border-[#F0F2F5] px-1.5 py-2 font-mono text-[11px] font-bold text-gray-800">
                        {formatCommission(item.commission_rate)}
                      </div>
                      <div className="flex min-h-10 min-w-0 items-center justify-center border-l border-t border-[#F0F2F5] px-1.5 py-2 font-mono text-[11px] font-bold text-blue-600">
                        <span className="truncate" title={`${item.estimated_apr_atox.toFixed(2)} ATOX/ATOS`}>
                          {item.estimated_apr_atox.toFixed(2)} <span className="text-[9px] font-normal text-gray-500">ATOX/ATOS</span>
                        </span>
                      </div>
                      <div className="flex min-h-10 min-w-0 items-center justify-center border-l border-t border-[#F0F2F5] px-1.5 py-2 font-mono text-[11px] font-bold text-emerald-600">
                        <span className="truncate" title={`${formatCoinAmount(item.pending_reward_atox)} ATOX`}>
                          {formatCoinAmount(item.pending_reward_atox)} <span className="text-[9px] font-normal text-gray-500">ATOX</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom: Quick Actions Bar */}
                  <div className="px-3 py-2 bg-[#FAFBFD] border-t border-[#F0F2F5] grid grid-cols-4 gap-1.5 text-[11px]">
                    {/* 1. 追加质押 */}
                    <button
                      type="button"
                      disabled={isJailed}
                      onClick={() => onOpenDelegate(matchedVal)}
                      className="py-1.5 px-2 bg-white border border-[#E5E7EB] hover:bg-gray-50 active:bg-gray-100 rounded-lg text-gray-800 font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                      title={t('btnStakeMore')}
                    >
                      <Plus className="w-3 h-3 text-blue-600" />
                      <span>{t('btnStakeMore')}</span>
                    </button>

                    {/* 2. 解除质押 */}
                    <button
                      type="button"
                      onClick={() => onOpenUndelegate(item)}
                      className="py-1.5 px-2 bg-white border border-[#E5E7EB] hover:bg-gray-50 active:bg-gray-100 rounded-lg text-gray-800 font-medium flex items-center justify-center gap-1 transition-colors"
                      title={t('btnUndelegate')}
                    >
                      <Minus className="w-3 h-3 text-rose-600" />
                      <span>{t('btnUndelegate')}</span>
                    </button>

                    {/* 3. 转委托 */}
                    <button
                      type="button"
                      onClick={() => onOpenRedelegate(item)}
                      className="py-1.5 px-2 bg-white border border-[#E5E7EB] hover:bg-gray-50 active:bg-gray-100 rounded-lg text-gray-800 font-medium flex items-center justify-center gap-1 transition-colors"
                      title={t('btnRedelegate')}
                    >
                      <ArrowRightLeft className="w-3 h-3 text-emerald-600" />
                      <span>{t('btnRedelegate')}</span>
                    </button>

                    {/* 4. 单独领奖 */}
                    <button
                      type="button"
                      disabled={BigInt(item.pending_reward_atox || '0') <= 0n}
                      onClick={() => onOpenClaim(item)}
                      className="py-1.5 px-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 active:bg-blue-200 rounded-lg text-blue-700 font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-40"
                      title={t('btnClaimAtox')}
                    >
                      <Gift className="w-3 h-3 text-blue-600" />
                      <span>{t('btnClaimAtox')}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. ATOX Automatic Conversion Tracker */}
      <div className="space-y-3 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-xs lg:col-span-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-[13px] font-bold leading-tight text-gray-900">{t('atoxTrackerTitle')}</h3>
              <p className="text-[11px] text-gray-400">{t('atoxTrackerSubtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            id="atox-info-btn"
            onClick={onOpenAtoxInfo}
            className="flex items-center gap-0.5 text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
          >
            <span>{t('mechanismExplainBtn')}</span>
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div className="rounded-xl border border-[#EEF2F6] bg-[#FAFBFD] p-3">
            <span className="text-[11px] text-gray-400">{t('myAtoxBalance')}</span>
            <div className="mt-0.5 font-mono text-[14px] font-bold text-gray-900">
              {formatCoinAmount(atoxAccount.atox_balance)} <span className="text-[10px] font-normal text-gray-500">ATOX</span>
            </div>
          </div>

          <div className="rounded-xl border border-[#EEF2F6] bg-[#FAFBFD] p-3">
            <span className="text-[11px] text-gray-400">{t('cumulativeConvertedAtos')}</span>
            <div className="mt-0.5 font-mono text-[14px] font-bold text-emerald-600">
              {formatCoinAmount(atoxAccount.cumulative_converted_atos)} <span className="text-[10px] font-normal text-gray-500">ATOS</span>
            </div>
          </div>
        </div>

        <div className="space-y-1.5 rounded-xl border border-[#EEF2F6] bg-[#F8FAFC] p-3 text-[11px]">
          <div className="flex items-center justify-between text-gray-600">
            <span className="font-medium">{t('globalPoolProgress', { tier: atoxGlobal.tier_name })}</span>
            <span className="font-mono font-semibold text-gray-800">
              {formatLargeAmount(atoxGlobal.total_released_to_pool, 'ATOS', language)} / {language === 'zh' ? '1万亿 ATOX' : '1T ATOX'}
            </span>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600"
              style={{ width: `${Math.min(100, Math.max(2, (Number(atoxGlobal.total_released_to_pool) / (1e12 * 1e18)) * 100))}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span>{t('progressLabel', { percent: ((Number(BigInt(atoxGlobal.total_released_to_pool) / 1000000000000000000n) / 1000000000000) * 100).toFixed(4) })}</span>
            <span className="font-medium text-indigo-600">{t('autoConversionNoManualNote')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
