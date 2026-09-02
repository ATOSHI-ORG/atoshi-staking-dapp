import React, { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  RefreshCw,
  Plus
} from 'lucide-react';
import { WalletBar } from './components/WalletBar';
import { WalletHeader } from './components/WalletHeader';
import { OverviewTab } from './components/OverviewTab';
import { ValidatorsTab } from './components/ValidatorsTab';
import { UnbondingTab } from './components/UnbondingTab';
import { DelegateModal } from './components/modals/DelegateModal';
import { UndelegateModal } from './components/modals/UndelegateModal';
import { RedelegateModal } from './components/modals/RedelegateModal';
import { ClaimModal } from './components/modals/ClaimModal';
import { AtoxInfoModal } from './components/modals/AtoxInfoModal';
import { EnergyInfoModal } from './components/modals/EnergyInfoModal';
import { SlashingRulesModal } from './components/modals/SlashingRulesModal';
import { ValidatorDetailModal } from './components/modals/ValidatorDetailModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { useLanguage } from './i18n/LanguageContext';
import { 
  StakingApi, 
  USER_ADDRESS as FALLBACK_ADDRESS, 
  DEFAULT_STAKING_PARAMS 
} from './services/stakingApi';
import { 
  Validator, 
  DelegationItem, 
  UnbondingEntry, 
  AtoxAccountData, 
  AtoxGlobalData, 
  EnergyAccountData, 
  AccountAssets, 
  StakingTxHistory 
} from './types';
import { formatCoinAmount } from './utils/format';
import { useWallet } from './wallet/useWallet';

export default function App() {
  const { t } = useLanguage();

  // 钱包给的是 0x 地址，但 Cosmos REST 的查询路径只认 atoshi1…，
  // useWallet 里已经转好了。没连钱包时退回 FALLBACK_ADDRESS（mock 模式的假地址，
  // 或 chain 模式的 VITE_DEMO_ADDRESS），让页面有东西可渲染。
  const {
    bech32Address,
    isConnected,
    isConnecting,
    wrongChain,
    hasProvider,
    connect: connectWallet,
    switchToAtoshi,
  } = useWallet();
  const userAddress = bech32Address || FALLBACK_ADDRESS;

  const [activeTab, setActiveTab] = useState<'overview' | 'validators' | 'unbonding'>('overview');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Core chain state
  const [assets, setAssets] = useState<AccountAssets>({
    address: userAddress,
    available_atos: '0',
    staked_atos: '0',
    unbonding_atos: '0',
    total_pending_atox: '0',
  });
  const [validators, setValidators] = useState<Validator[]>([]);
  const [delegations, setDelegations] = useState<DelegationItem[]>([]);
  const [unbondingEntries, setUnbondingEntries] = useState<UnbondingEntry[]>([]);
  const [atoxAccount, setAtoxAccount] = useState<AtoxAccountData>({
    address: userAddress,
    atox_balance: '0',
    pending_atos: '0',
    cumulative_converted_atos: '0',
  });
  const [atoxGlobal, setAtoxGlobal] = useState<AtoxGlobalData>({
    global_index: '1.0',
    total_released_to_pool: '0',
    atox_total_supply: '1000000000000000000000000000000',
    current_tier: 1,
    total_tiers: 10,
    tier_name: 'Tier 1',
    next_tier_progress_percent: 0,
  });
  const [energyData, setEnergyData] = useState<EnergyAccountData>({
    address: userAddress,
    energy_balance: 0,
    energy_max: 10000,
    qualifies_for_energy: false,
    available_atos: '0',
    staked_atos: '0',
    total_calculated_atos: '0',
    free_gas_tx_remaining: 0,
    energy_threshold_atos: 30000,
  });
  const [txHistory, setTxHistory] = useState<StakingTxHistory[]>([]);

  // Toast management
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', title: string, description?: string) => {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Modals state
  const [isDelegateOpen, setIsDelegateOpen] = useState(false);
  const [selectedValidatorForDelegate, setSelectedValidatorForDelegate] = useState<Validator | null>(null);

  const [isUndelegateOpen, setIsUndelegateOpen] = useState(false);
  const [selectedDelegationForUndelegate, setSelectedDelegationForUndelegate] = useState<DelegationItem | null>(null);

  const [isRedelegateOpen, setIsRedelegateOpen] = useState(false);
  const [selectedDelegationForRedelegate, setSelectedDelegationForRedelegate] = useState<DelegationItem | null>(null);

  const [isClaimOpen, setIsClaimOpen] = useState(false);
  const [selectedDelegationForClaim, setSelectedDelegationForClaim] = useState<DelegationItem | null>(null);

  const [isAtoxInfoOpen, setIsAtoxInfoOpen] = useState(false);
  const [isEnergyInfoOpen, setIsEnergyInfoOpen] = useState(false);
  const [isSlashingRulesOpen, setIsSlashingRulesOpen] = useState(false);

  const [isValidatorDetailOpen, setIsValidatorDetailOpen] = useState(false);
  const [selectedValidatorForDetail, setSelectedValidatorForDetail] = useState<Validator | null>(null);

  // Load all on-chain data
  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const [
        valList,
        delList,
        unbondList,
        atoxAcc,
        atoxGlob,
        energyAcc,
        assetData,
        hist,
      ] = await Promise.all([
        StakingApi.getValidators(),
        StakingApi.getDelegations(userAddress),
        StakingApi.getUnbonding(userAddress),
        StakingApi.getAtoxAccount(userAddress),
        StakingApi.getAtoxGlobal(),
        StakingApi.getEnergyAccount(userAddress),
        StakingApi.getAccountAssets(userAddress),
        StakingApi.getHistory(),
      ]);

      setValidators(valList);
      setDelegations(delList);
      setUnbondingEntries(unbondList);
      setAtoxAccount(atoxAcc);
      setAtoxGlobal(atoxGlob);
      setEnergyData(energyAcc);
      setAssets(assetData);
      setTxHistory(hist);
    } catch (e: any) {
      console.error('Failed to load staking data', e);
      addToast('error', t('toastErrorGeneral'), e?.message || '');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [t, userAddress]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers for core on-chain operations
  const handleConfirmDelegate = async (valoper: string, rawAmount: string) => {
    const res = await StakingApi.delegate({
      delegator: userAddress,
      validator: valoper,
      amount: rawAmount,
    });
    await loadData();
    addToast(
      'success',
      t('toastSuccessDelegate'),
      `${formatCoinAmount(rawAmount)} ATOS`
    );
  };

  const handleConfirmUndelegate = async (valoper: string, rawAmount: string) => {
    const res = await StakingApi.undelegate({
      delegator: userAddress,
      validator: valoper,
      amount: rawAmount,
    });
    await loadData();
    addToast(
      'success',
      t('toastSuccessUndelegate'),
      `${formatCoinAmount(rawAmount)} ATOS`
    );
  };

  const handleConfirmRedelegate = async (srcVal: string, dstVal: string, rawAmount: string) => {
    const res = await StakingApi.redelegate({
      delegator: userAddress,
      src_validator: srcVal,
      dst_validator: dstVal,
      amount: rawAmount,
    });
    await loadData();
    addToast(
      'success',
      t('toastSuccessRedelegate'),
      `${formatCoinAmount(rawAmount)} ATOS`
    );
  };

  const handleConfirmWithdrawRewards = async (validatorValoper?: string) => {
    const res = await StakingApi.withdrawRewards({
      delegator: userAddress,
      validator: validatorValoper,
    });
    await loadData();
    addToast(
      'success',
      t('toastSuccessClaim'),
      `${formatCoinAmount(res.total_claimed_atox)} ATOX`
    );
  };

  return (
    <div className="min-h-screen bg-[#F6F8FA] flex justify-center text-[#1F2937]">
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Main Mobile App Frame (375-430px responsive mobile canvas) */}
      <div className="w-full max-w-[430px] min-h-screen bg-[#F8F9FB] flex flex-col shadow-lg relative border-x border-[#ECEFF3]">
        {/* Top Wallet WebView Header */}
        <WalletHeader
          address={userAddress}
          energyBalance={energyData.energy_balance}
          qualifiesForEnergy={energyData.qualifies_for_energy}
          onRefresh={() => loadData(true)}
          isLoading={isRefreshing}
          onOpenEnergyInfo={() => setIsEnergyInfoOpen(true)}
        />

        <WalletBar
          isConnected={isConnected}
          isConnecting={isConnecting}
          wrongChain={wrongChain}
          hasProvider={hasProvider}
          onConnect={connectWallet}
          onSwitchChain={switchToAtoshi}
        />

        {/* Tab Content */}
        <main className="flex-1 p-4 pb-20 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-3 text-gray-400">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-[13px]">{t('loadingChainData')}</p>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewTab
                  assets={assets}
                  delegations={delegations}
                  atoxAccount={atoxAccount}
                  atoxGlobal={atoxGlobal}
                  energyData={energyData}
                  validators={validators}
                  onOpenDelegate={(val) => {
                    setSelectedValidatorForDelegate(val || null);
                    setIsDelegateOpen(true);
                  }}
                  onOpenUndelegate={(del) => {
                    setSelectedDelegationForUndelegate(del || null);
                    setIsUndelegateOpen(true);
                  }}
                  onOpenRedelegate={(del) => {
                    setSelectedDelegationForRedelegate(del || null);
                    setIsRedelegateOpen(true);
                  }}
                  onOpenClaim={(del) => {
                    setSelectedDelegationForClaim(del || null);
                    setIsClaimOpen(true);
                  }}
                  onOpenAtoxInfo={() => setIsAtoxInfoOpen(true)}
                  onOpenEnergyInfo={() => setIsEnergyInfoOpen(true)}
                  onNavigateToValidators={() => setActiveTab('validators')}
                  onNavigateToUnbonding={() => setActiveTab('unbonding')}
                />
              )}

              {activeTab === 'validators' && (
                <ValidatorsTab
                  validators={validators}
                  onOpenDelegate={(val) => {
                    setSelectedValidatorForDelegate(val);
                    setIsDelegateOpen(true);
                  }}
                  onOpenValidatorDetail={(val) => {
                    setSelectedValidatorForDetail(val);
                    setIsValidatorDetailOpen(true);
                  }}
                  onOpenSlashingRules={() => setIsSlashingRulesOpen(true)}
                />
              )}

              {activeTab === 'unbonding' && (
                <UnbondingTab
                  unbondingEntries={unbondingEntries}
                  txHistory={txHistory}
                  delegations={delegations}
                />
              )}
            </>
          )}
        </main>

        {/* Bottom Tab Bar (White background, light gray divider, fixed 3-tab navigation) */}
        <nav 
          id="staking-bottom-nav"
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-[#F0F2F5] px-2 py-1.5 flex items-center justify-around z-30 shadow-md"
        >
          {/* Tab 1: 概览 */}
          <button
            type="button"
            id="nav-tab-overview"
            onClick={() => setActiveTab('overview')}
            className={`flex flex-col items-center py-1 px-4 rounded-xl transition-colors ${
              activeTab === 'overview'
                ? 'text-blue-600 font-bold'
                : 'text-gray-400 hover:text-gray-600 font-medium'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[11px] mt-0.5">{t('tabOverview')}</span>
          </button>

          {/* Tab 2: 验证人 */}
          <button
            type="button"
            id="nav-tab-validators"
            onClick={() => setActiveTab('validators')}
            className={`flex flex-col items-center py-1 px-4 rounded-xl transition-colors ${
              activeTab === 'validators'
                ? 'text-blue-600 font-bold'
                : 'text-gray-400 hover:text-gray-600 font-medium'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[11px] mt-0.5">{t('tabValidators')}</span>
          </button>

          {/* Tab 3: 解质押 / 记录 */}
          <button
            type="button"
            id="nav-tab-unbonding"
            onClick={() => setActiveTab('unbonding')}
            className={`flex flex-col items-center py-1 px-4 rounded-xl transition-colors relative ${
              activeTab === 'unbonding'
                ? 'text-blue-600 font-bold'
                : 'text-gray-400 hover:text-gray-600 font-medium'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[11px] mt-0.5">{t('tabUnbonding')}</span>
            {unbondingEntries.length > 0 && (
              <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-rose-500"></span>
            )}
          </button>
        </nav>

        {/* Global Modals */}
        <DelegateModal
          isOpen={isDelegateOpen}
          onClose={() => setIsDelegateOpen(false)}
          validator={selectedValidatorForDelegate}
          allValidators={validators}
          availableAtos={assets.available_atos}
          energyData={energyData}
          onConfirm={handleConfirmDelegate}
        />

        <UndelegateModal
          isOpen={isUndelegateOpen}
          onClose={() => setIsUndelegateOpen(false)}
          delegation={selectedDelegationForUndelegate}
          allDelegations={delegations}
          onConfirm={handleConfirmUndelegate}
        />

        <RedelegateModal
          isOpen={isRedelegateOpen}
          onClose={() => setIsRedelegateOpen(false)}
          initialSrcDelegation={selectedDelegationForRedelegate}
          allDelegations={delegations}
          allValidators={validators}
          onConfirm={handleConfirmRedelegate}
        />

        <ClaimModal
          isOpen={isClaimOpen}
          onClose={() => setIsClaimOpen(false)}
          targetDelegation={selectedDelegationForClaim}
          allDelegations={delegations}
          availableAtos={assets.available_atos}
          energyData={energyData}
          onConfirm={handleConfirmWithdrawRewards}
        />

        <AtoxInfoModal
          isOpen={isAtoxInfoOpen}
          onClose={() => setIsAtoxInfoOpen(false)}
          globalData={atoxGlobal}
          accountData={atoxAccount}
        />

        <EnergyInfoModal
          isOpen={isEnergyInfoOpen}
          onClose={() => setIsEnergyInfoOpen(false)}
          energyData={energyData}
        />

        <SlashingRulesModal
          isOpen={isSlashingRulesOpen}
          onClose={() => setIsSlashingRulesOpen(false)}
        />

        <ValidatorDetailModal
          isOpen={isValidatorDetailOpen}
          onClose={() => setIsValidatorDetailOpen(false)}
          validator={selectedValidatorForDetail}
          onDelegate={(val) => {
            setSelectedValidatorForDelegate(val);
            setIsDelegateOpen(true);
          }}
          onOpenSlashingRules={() => setIsSlashingRulesOpen(true)}
        />
      </div>
    </div>
  );
}
