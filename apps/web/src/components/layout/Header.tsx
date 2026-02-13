'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';

export function Header() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const isSettingsPage = pathname === '/settings';

  return (
    <header className="sticky top-0 z-50 glass-nav border-b md:hidden">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center justify-between">
          {/* Logo links */}
          <Link href="/" className="flex items-center">
            <Image
              src="/logo.png"
              alt="Financer"
              width={100}
              height={50}
              className="rounded-md"
            />
          </Link>

          {/* Settings Icon rechts - auf Settings-Seite zurück zum Dashboard */}
          <Link
            href={isSettingsPage ? '/' : '/settings'}
            className="p-2 -mr-2 text-foreground hover:bg-background-surface-hover rounded-md transition-colors"
            aria-label={isSettingsPage ? t('back') : t('navSettings')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
