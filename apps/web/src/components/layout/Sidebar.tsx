'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import type { TenantStatus } from '@financer/shared';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  tenantStatus?: TenantStatus | null;
}

const mainNavItems = [
  {
    key: 'dashboard',
    href: '/',
    labelKey: 'navDashboard' as const,
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    key: 'transactions',
    href: '/transactions',
    labelKey: 'navTransactions' as const,
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  },
  {
    key: 'recurring',
    href: '/recurring',
    labelKey: 'navRecurring' as const,
    icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  },
  {
    key: 'accounts',
    href: '/accounts',
    labelKey: 'navAccounts' as const,
    icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  },
  {
    key: 'analytics',
    href: '/analytics',
    labelKey: 'navAnalytics' as const,
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
];

const otherNavItems = [
  {
    key: 'categories',
    href: '/categories',
    labelKey: 'navCategories' as const,
    icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
  },
  {
    key: 'settings',
    href: '/settings',
    labelKey: 'navSettings' as const,
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  },
];

function NavItem({
  href,
  label,
  icon,
  isActive,
  isOpen,
}: {
  href: string;
  label: string;
  icon: string;
  isActive: boolean;
  isOpen: boolean;
}) {
  return (
    <Link
      href={href}
      title={!isOpen ? label : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group relative',
        isActive
          ? 'nav-item-active shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
      )}
    >
      <svg
        className={cn(
          'w-5 h-5 flex-shrink-0 transition-transform duration-150',
          isActive ? 'text-white' : 'text-current',
          !isOpen && 'mx-auto'
        )}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2.5 : 2} d={icon} />
      </svg>
      {isOpen && (
        <span className={cn('text-sm font-medium truncate', isActive ? 'text-white' : '')}>
          {label}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ isOpen, onToggle, tenantStatus }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await api.logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setLoggingOut(false);
    }
  }

  const showTrial = tenantStatus && !tenantStatus.legacy && tenantStatus.status !== 'active';
  const isExpired = tenantStatus?.status === 'expired' || tenantStatus?.status === 'cancelled';
  const daysRemaining = tenantStatus?.daysRemaining ?? 0;

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col fixed left-0 top-0 h-full z-40 sidebar-bg transition-all duration-300',
        isOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* Logo + Toggle */}
      <div
        className={cn(
          'flex items-center h-16 border-b border-border flex-shrink-0',
          isOpen ? 'px-4 gap-3' : 'px-3 justify-center'
        )}
      >
        {isOpen && (
          <Link href="/" className="flex-1 min-w-0">
            <Image
              src="/logo.png"
              alt="Financer"
              width={110}
              height={44}
              className="rounded-md object-contain"
            />
          </Link>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-lg transition-colors flex-shrink-0"
          aria-label={isOpen ? t('sidebarCollapse') : t('sidebarExpand')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            )}
          </svg>
        </button>
      </div>

      {/* Main Navigation – scrollable */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <div className="space-y-1">
          {isOpen && (
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
              {t('sidebarGroupMain')}
            </p>
          )}
          {mainNavItems.map((item) => (
            <NavItem
              key={item.key}
              href={item.href}
              label={t(item.labelKey)}
              icon={item.icon}
              isActive={pathname === item.href}
              isOpen={isOpen}
            />
          ))}
        </div>
      </nav>

      {/* Bottom Section – fixed, not scrollable */}
      <div className="flex-shrink-0 border-t border-border px-2 py-3 space-y-1">
        {isOpen && (
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
            {t('sidebarGroupOthers')}
          </p>
        )}

        {otherNavItems.map((item) => (
          <NavItem
            key={item.key}
            href={item.href}
            label={t(item.labelKey)}
            icon={item.icon}
            isActive={pathname === item.href}
            isOpen={isOpen}
          />
        ))}

        {/* Docs */}
        <a
          href="https://docs.getfinancer.com"
          target="_blank"
          rel="noopener noreferrer"
          title={!isOpen ? t('navDocumentation') : undefined}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <svg className={cn('w-5 h-5 flex-shrink-0', !isOpen && 'mx-auto')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          {isOpen && <span className="text-sm font-medium">{t('navDocumentation')}</span>}
        </a>

        {/* Feedback */}
        <a
          href="https://financer.getbugio.com"
          target="_blank"
          rel="noopener noreferrer"
          title={!isOpen ? t('navFeedback') : undefined}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <svg className={cn('w-5 h-5 flex-shrink-0', !isOpen && 'mx-auto')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {isOpen && <span className="text-sm font-medium">{t('navFeedback')}</span>}
        </a>

        {/* Logout */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          title={!isOpen ? t('logout') : undefined}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50',
            !isOpen && 'justify-center'
          )}
        >
          <svg className={cn('w-5 h-5 flex-shrink-0', !isOpen && 'mx-auto')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {isOpen && (
            <span className="text-sm font-medium">
              {loggingOut ? t('logoutLoading') : t('logout')}
            </span>
          )}
        </button>
      </div>

      {/* Trial notification — above upgrade card */}
      {isOpen && showTrial && (
        <div className="px-3 pb-2 flex-shrink-0">
          <div
            className={`rounded-xl px-3 py-2.5 text-xs cursor-pointer transition-colors ${
              isExpired
                ? 'bg-destructive/15 text-destructive hover:bg-destructive/20'
                : daysRemaining <= 3
                  ? 'bg-yellow-500/15 text-yellow-500 hover:bg-yellow-500/20'
                  : 'bg-primary/10 text-primary hover:bg-primary/15'
            }`}
            onClick={() => router.push('/settings?billing=true')}
          >
            <p className="font-semibold leading-tight">
              {isExpired
                ? t('trialBannerExpired')
                : daysRemaining <= 1
                  ? t('trialBannerLastDay')
                  : t('trialBannerDays', { days: String(daysRemaining) })}
            </p>
            <p className="mt-0.5 opacity-80">{t('trialUpgrade')} →</p>
          </div>
        </div>
      )}

      {/* Upgrade Card — only shown in cloud deployment */}
      {isOpen && process.env.DEPLOYMENT_MODE === 'cloudhost' && (
        <div className="px-3 pb-4 flex-shrink-0">
          <div className="upgrade-gradient rounded-2xl p-4 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">👑</span>
              <span className="text-sm font-bold">{t('sidebarUpgradeTitle')}</span>
            </div>
            <p className="text-xs text-white/80 mb-3 leading-relaxed">
              {t('sidebarUpgradeText')}
            </p>
            <a
              href="https://getfinancer.com/upgrade"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-xs font-semibold bg-white/20 hover:bg-white/30 transition-colors rounded-full px-3 py-1.5"
            >
              {t('sidebarUpgradeCta')}
            </a>
          </div>
        </div>
      )}
    </aside>
  );
}
