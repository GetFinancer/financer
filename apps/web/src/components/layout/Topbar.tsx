'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

interface TopbarProps {
  sidebarOpen: boolean;
}

const PAGE_TITLES: Record<string, string> = {
  '/': 'navDashboard',
  '/transactions': 'navTransactions',
  '/recurring': 'navRecurring',
  '/accounts': 'navAccounts',
  '/categories': 'navCategories',
  '/analytics': 'navAnalytics',
  '/settings': 'navSettings',
};

export function Topbar({ sidebarOpen }: TopbarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const titleKey = PAGE_TITLES[pathname] ?? 'navDashboard';
  const pageTitle = t(titleKey as Parameters<typeof t>[0]);

  return (
    <header
      className={cn(
        'hidden md:flex fixed top-0 right-0 z-30 h-16 topbar-bg transition-all duration-300',
        sidebarOpen ? 'left-64' : 'left-16'
      )}
    >
      <div className="w-full h-full max-w-screen-xl mx-auto px-6 flex items-center">
        <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
      </div>
    </header>
  );
}
