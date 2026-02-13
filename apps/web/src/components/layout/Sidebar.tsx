'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const [loggingOut, setLoggingOut] = useState(false);

  const navItems = [
    { href: '/', label: t('navDashboard'), icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { href: '/transactions', label: t('navTransactions'), icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { href: '/recurring', label: t('navRecurring'), icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
    { href: '/accounts', label: t('navAccounts'), icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
    { href: '/categories', label: t('navCategories'), icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
    { href: '/analytics', label: t('navAnalytics'), icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  ];

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

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col fixed left-0 top-0 h-full z-40 glass-card-elevated border-r transition-all duration-300',
        isOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* Header with Logo and Toggle */}
      <div className="flex items-center h-14 px-3 border-b border-border">
        <button
          onClick={onToggle}
          className="p-2 text-foreground hover:bg-background-surface-hover rounded-md transition-colors flex-shrink-0"
          aria-label={isOpen ? t('sidebarCollapse') : t('sidebarExpand')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {isOpen && (
          <Link href="/" className="ml-2">
            <Image
              src="/logo.png"
              alt="Financer"
              width={100}
              height={50}
              className="rounded-md"
            />
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-background-surface-hover',
                !isOpen && 'justify-center'
              )}
              title={!isOpen ? item.label : undefined}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              {isOpen && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border py-4 px-2 space-y-1">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-background-surface-hover transition-colors',
            pathname === '/settings' && 'bg-primary text-primary-foreground',
            !isOpen && 'justify-center'
          )}
          title={!isOpen ? t('navSettings') : undefined}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {isOpen && <span className="text-sm font-medium">{t('navSettings')}</span>}
        </Link>

        <a
          href="https://docs.getfinancer.com"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-background-surface-hover transition-colors',
            !isOpen && 'justify-center'
          )}
          title={!isOpen ? t('navDocumentation') : undefined}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          {isOpen && <span className="text-sm font-medium">{t('navDocumentation')}</span>}
        </a>

        <a
          href="https://financer.getbugio.com"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-background-surface-hover transition-colors',
            !isOpen && 'justify-center'
          )}
          title={!isOpen ? t('navFeedback') : undefined}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {isOpen && <span className="text-sm font-medium">{t('navFeedback')}</span>}
        </a>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-destructive hover:bg-background-surface-hover transition-colors disabled:opacity-50',
            !isOpen && 'justify-center'
          )}
          title={!isOpen ? t('logout') : undefined}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {isOpen && <span className="text-sm font-medium">{loggingOut ? t('logoutLoading') : t('logout')}</span>}
        </button>
      </div>
    </aside>
  );
}
