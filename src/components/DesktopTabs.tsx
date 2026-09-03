/**
 * 桌面端的横向标签栏。
 *
 * 手机端用固定在底部的三个图标（拇指可达），那个交互在宽屏上不成立 ——
 * 鼠标要跑到屏幕最下方，而且横跨 1080px 的底栏很怪。所以这一栏只在 lg 以上
 * 显示，底部导航同时隐藏，两者互斥。
 *
 * 状态还是 App 里那个 activeTab，两套导航共用，不引入第二份状态。
 */

import { Clock, LayoutDashboard, Users } from 'lucide-react';

import { useLanguage } from '../i18n/LanguageContext';

type Tab = 'overview' | 'validators' | 'unbonding';

interface DesktopTabsProps {
  activeTab: Tab;
  onChange: (tab: Tab) => void;
  /** 解质押中的笔数，>0 时在标签上显示一个角标 */
  unbondingCount: number;
}

export function DesktopTabs({ activeTab, onChange, unbondingCount }: DesktopTabsProps) {
  const { t } = useLanguage();

  const tabs: Array<{ key: Tab; label: string; icon: typeof LayoutDashboard }> = [
    { key: 'overview', label: t('tabOverview'), icon: LayoutDashboard },
    { key: 'validators', label: t('tabValidators'), icon: Users },
    { key: 'unbonding', label: t('tabUnbonding'), icon: Clock },
  ];

  return (
    <nav className="hidden lg:flex items-center gap-1 border-b border-[#ECEFF3] bg-white px-8">
      {tabs.map(({ key, label, icon: Icon }) => {
        const active = activeTab === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`relative flex items-center gap-2 px-4 py-3 text-[13px] transition-colors ${
              active
                ? 'font-bold text-blue-600'
                : 'font-medium text-gray-500 hover:text-gray-900'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
            {key === 'unbonding' && unbondingCount > 0 && (
              <span className="ml-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {unbondingCount}
              </span>
            )}
            {/* 选中态用下边框，和顶部 header 的分隔线对齐 */}
            {active && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-blue-600" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
