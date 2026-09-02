import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  SlidersHorizontal, 
  ChevronRight, 
  Info, 
  Plus, 
  Eye, 
  Globe, 
  Layers,
  ArrowUpDown,
  X
} from 'lucide-react';
import { Validator } from '../types';
import { 
  formatLargeAmount, 
  formatCommission, 
  shortenAddress 
} from '../utils/format';
import { useLanguage } from '../i18n/LanguageContext';

interface ValidatorsTabProps {
  validators: Validator[];
  onOpenDelegate: (validator: Validator) => void;
  onOpenValidatorDetail: (validator: Validator) => void;
  onOpenSlashingRules: () => void;
}

export const ValidatorsTab: React.FC<ValidatorsTabProps> = ({
  validators,
  onOpenDelegate,
  onOpenValidatorDetail,
  onOpenSlashingRules,
}) => {
  const { language, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'active' | 'candidate' | 'jailed'>('all');
  const [hideJailed, setHideJailed] = useState<boolean>(false);
  const [sortKey, setSortKey] = useState<'tokens' | 'commission' | 'uptime' | 'apr'>('tokens');

  // Filter & Sort
  const filteredList = validators
    .filter((v) => {
      if (hideJailed && v.jailed) return false;

      if (filterType === 'active') return v.in_active_set && !v.jailed;
      if (filterType === 'candidate') return !v.in_active_set && !v.jailed;
      if (filterType === 'jailed') return v.jailed;
      return true;
    })
    .filter((v) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        v.moniker.toLowerCase().includes(q) ||
        v.operator_address.toLowerCase().includes(q) ||
        (v.identity && v.identity.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortKey === 'commission') {
        return parseFloat(a.commission_rate) - parseFloat(b.commission_rate);
      }
      if (sortKey === 'uptime') {
        return b.uptime_percent - a.uptime_percent;
      }
      if (sortKey === 'apr') {
        return b.estimated_apr_atox - a.estimated_apr_atox;
      }
      return BigInt(b.tokens) > BigInt(a.tokens) ? 1 : -1;
    });

  const activeSetCount = validators.filter((v) => v.in_active_set && !v.jailed).length;
  const jailedCount = validators.filter((v) => v.jailed).length;

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* 1. Slashing & Risk Warning Top Banner */}
      <div className="bg-rose-50/80 rounded-2xl border border-rose-200/90 p-3.5 shadow-xs space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-bold text-rose-900 text-[13px]">{t('slashingBannerTitle')}</span>
          </div>
          <button
            type="button"
            onClick={onOpenSlashingRules}
            className="text-[11px] text-rose-700 font-semibold hover:underline flex items-center gap-0.5"
          >
            <span>{t('slashingRulesDetail')}</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <p className="text-[12px] text-rose-800 leading-relaxed">
          {t('slashingBannerDesc')}
        </p>
      </div>

      {/* 2. Active Set Indicator & Requirements Note */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-3.5 shadow-xs flex items-center justify-between text-[12px]">
        <div className="flex items-center gap-2 text-gray-700">
          <Layers className="w-4 h-4 text-blue-600" />
          <span>{t('activeSetLimit', { count: activeSetCount })}</span>
        </div>
        <div className="text-gray-400 text-[11px]">
          {t('minCommissionRule')}
        </div>
      </div>

      {/* 3. Search & Filters Bar */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-3.5 shadow-xs space-y-3">
        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            id="validator-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full pl-9 pr-8 py-2 bg-[#FAFBFD] border border-[#E5E7EB] rounded-xl text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="w-5 h-5 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 absolute right-2.5 top-1/2 -translate-y-1/2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[12px] no-scrollbar">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filterType === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-[#F1F3F6] text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('filterAll', { count: validators.length })}
          </button>

          <button
            type="button"
            onClick={() => setFilterType('active')}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filterType === 'active'
                ? 'bg-emerald-600 text-white'
                : 'bg-[#F1F3F6] text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('filterActive')}
          </button>

          <button
            type="button"
            onClick={() => setFilterType('candidate')}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filterType === 'candidate'
                ? 'bg-indigo-600 text-white'
                : 'bg-[#F1F3F6] text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('filterCandidate')}
          </button>

          <button
            type="button"
            onClick={() => setFilterType('jailed')}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filterType === 'jailed'
                ? 'bg-rose-600 text-white'
                : 'bg-[#F1F3F6] text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('filterJailed', { count: jailedCount })}
          </button>

          <label className="flex items-center gap-1 ml-auto text-[11px] text-gray-500 cursor-pointer whitespace-nowrap pl-2">
            <input
              type="checkbox"
              checked={hideJailed}
              onChange={(e) => setHideJailed(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>{t('hideJailedLabel')}</span>
          </label>
        </div>

        {/* Sort row */}
        <div className="flex items-center justify-between pt-2 border-t border-[#F0F2F5] text-[11px] text-gray-500">
          <span className="flex items-center gap-1 font-medium">
            <ArrowUpDown className="w-3 h-3 text-gray-400" />
            {t('sortByLabel')}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSortKey('tokens')}
              className={`px-2 py-0.5 rounded transition-colors ${
                sortKey === 'tokens' ? 'bg-gray-900 text-white font-semibold' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t('sortTotalStaked')}
            </button>
            <button
              type="button"
              onClick={() => setSortKey('commission')}
              className={`px-2 py-0.5 rounded transition-colors ${
                sortKey === 'commission' ? 'bg-gray-900 text-white font-semibold' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t('sortCommission')}
            </button>
            <button
              type="button"
              onClick={() => setSortKey('uptime')}
              className={`px-2 py-0.5 rounded transition-colors ${
                sortKey === 'uptime' ? 'bg-gray-900 text-white font-semibold' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t('sortUptime')}
            </button>
            <button
              type="button"
              onClick={() => setSortKey('apr')}
              className={`px-2 py-0.5 rounded transition-colors ${
                sortKey === 'apr' ? 'bg-gray-900 text-white font-semibold' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t('sortApr')}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Validator Cards List */}
      <div className="space-y-3">
        {filteredList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 text-center text-gray-400 text-[13px]">
            {t('noValidatorsMatched')}
          </div>
        ) : (
          filteredList.map((val) => {
            const selfDelegationMet = BigInt(val.self_delegation) >= 100000000n * 1000000000000000000n;

            return (
              <div
                key={val.operator_address}
                className={`bg-white rounded-2xl border transition-all shadow-xs overflow-hidden ${
                  val.jailed
                    ? 'border-rose-200/90 bg-rose-50/20'
                    : 'border-[#E5E7EB] hover:border-blue-300'
                }`}
              >
                {/* Validator Header */}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-[14px] border border-blue-100 shrink-0">
                        {val.moniker.slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-[13px] font-bold text-gray-900 leading-tight">
                            {val.moniker}
                          </h4>

                          {/* Rank badge */}
                          <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            #{val.rank}
                          </span>

                          {/* Status Badge */}
                          {val.jailed ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-0.5">
                              <ShieldAlert className="w-2.5 h-2.5" />
                              {t('jailedStatus')}
                            </span>
                          ) : val.in_active_set ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {t('activeStatus')}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                              {t('filterCandidate')}
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                          {shortenAddress(val.operator_address, 8, 6)}
                        </div>
                      </div>
                    </div>

                    {/* APR in ATOX */}
                    <div className="text-right">
                      <div className="text-[10px] text-gray-400">{t('estAprLabel')}</div>
                      <div className="font-mono font-bold text-[14px] text-blue-600">
                        {val.estimated_apr_atox.toFixed(2)} <span className="text-[10px] font-normal text-gray-500">ATOX/ATOS</span>
                      </div>
                    </div>
                  </div>

                  {/* 4 Stats Grid */}
                  <div className="grid grid-cols-2 gap-2 bg-[#FAFBFD] p-3 rounded-xl border border-[#F0F2F5] text-[12px]">
                    {/* Total Staked */}
                    <div>
                      <div className="text-gray-400 text-[10px]">{t('totalStakedVotingPower')}</div>
                      <div className="font-mono font-bold text-gray-900 text-[12px] mt-0.5">
                        {formatLargeAmount(val.tokens, 'ATOS', language)}
                        <span className="text-[10px] font-normal text-gray-500 ml-1">({val.voting_power_percent}%)</span>
                      </div>
                    </div>

                    {/* Commission */}
                    <div>
                      <div className="text-gray-400 text-[10px]">{t('commissionLabel')} {language === 'zh' ? '(最低5%)' : '(Min 5%)'}</div>
                      <div className="font-mono font-bold text-gray-900 text-[12px] mt-0.5">
                        {formatCommission(val.commission_rate)}
                      </div>
                    </div>

                    {/* Self-Delegation Requirement */}
                    <div>
                      <div className="text-gray-400 text-[10px]">{t('selfDelegationLabel')}</div>
                      <div className="font-mono font-bold text-[12px] mt-0.5 flex items-center gap-1">
                        <span className={selfDelegationMet ? 'text-gray-900' : 'text-rose-600'}>
                          {formatLargeAmount(val.self_delegation, 'ATOS', language)}
                        </span>
                        {selfDelegationMet ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" title={t('selfDelegationMet')} />
                        ) : (
                          <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" title={t('selfDelegationUnmet')} />
                        )}
                      </div>
                    </div>

                    {/* Uptime in 100 blocks */}
                    <div>
                      <div className="text-gray-400 text-[10px]">{t('uptime100Blocks')}</div>
                      <div className={`font-mono font-bold text-[12px] mt-0.5 ${val.uptime_percent < 50 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {val.uptime_percent}% <span className="text-[10px] font-normal text-gray-400">({val.signed_blocks_window - val.missed_blocks_counter}/100)</span>
                      </div>
                    </div>
                  </div>

                  {/* Chain Self-Delegation Rule Note */}
                  <div className="text-[11px] text-gray-500 flex items-center justify-between">
                    <span>{t('chainSelfDelegationRule')}</span>
                    <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      {t('rewardIsAtoxBadge')}
                    </span>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="px-4 py-2.5 bg-[#FAFBFD] border-t border-[#F0F2F5] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenValidatorDetail(val)}
                    className="py-1.5 px-3 bg-white border border-[#E5E7EB] hover:bg-gray-100 active:bg-gray-200 text-gray-700 text-[12px] font-medium rounded-xl flex items-center gap-1 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-gray-500" />
                    <span>{t('viewDetailsBtn')}</span>
                  </button>

                  <button
                    type="button"
                    disabled={val.jailed}
                    onClick={() => onOpenDelegate(val)}
                    className="py-1.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[12px] font-semibold rounded-xl flex items-center gap-1 transition-colors disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{val.jailed ? t('nodeJailedBtn') : t('delegateBtn')}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
