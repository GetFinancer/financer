'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { LanguageProvider, useTranslation } from '@/lib/i18n';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ReleaseNotesModal } from '@/components/ReleaseNotesModal';
import { releaseNotes } from '@/lib/release-notes';
import type { TenantStatus } from '@financer/shared';

interface AppShellProps {
  children: React.ReactNode;
}

function PasswordWarningBanner({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-yellow-500/15 border-b border-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-sm">
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span className="flex-1">{t('passwordWarningBanner')}</span>
      <a href="/settings" className="font-semibold underline underline-offset-2 hover:no-underline whitespace-nowrap">
        {t('passwordWarningCta')}
      </a>
      <button onClick={onDismiss} className="ml-1 text-yellow-500 hover:text-yellow-300 transition-colors" aria-label="Dismiss">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// Pages that don't need the app shell
const authPages = ['/login', '/setup', '/admin'];


export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tenantStatus, setTenantStatus] = useState<TenantStatus | null>(null);
  const [releaseNotesVersion, setReleaseNotesVersion] = useState<string | null>(null);
  const [showPasswordWarning, setShowPasswordWarning] = useState(false);

  const isAuthPage = authPages.includes(pathname);

  useEffect(() => {
    async function checkAuth() {
      try {
        const status = await api.getAuthStatus();

        if (!status.isSetupComplete) {
          router.push('/setup');
          return;
        }

        if (!status.isAuthenticated) {
          router.push('/login');
          return;
        }

        setAuthenticated(true);

        if (status.passwordNeedsUpdate) {
          setShowPasswordWarning(true);
        }

        // Fetch tenant status for trial banner
        try {
          const ts = await api.getTenantStatus();
          setTenantStatus(ts);
        } catch {
          // Ignore — legacy tenant or billing not configured
        }

        // Check if release notes should be shown
        try {
          const rnStatus = await api.getReleaseNotesStatus();
          if (rnStatus.lastSeenVersion !== rnStatus.currentVersion) {
            const hasNotes = releaseNotes.some(n => n.version === rnStatus.currentVersion);
            if (hasNotes) {
              setReleaseNotesVersion(rnStatus.currentVersion);
            } else {
              // No notes for this version — mark as seen silently
              await api.markReleaseNotesSeen();
            }
          }
        } catch {
          // Ignore — don't block the app if this fails
        }
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }

    // Skip auth check for login/setup pages
    if (isAuthPage) {
      setLoading(false);
      setAuthenticated(true);
      return;
    }

    checkAuth();
  }, [router, isAuthPage]);

  async function handleReleaseNotesClose() {
    setReleaseNotesVersion(null);
    try {
      await api.markReleaseNotesSeen();
    } catch {
      // Ignore
    }
  }

  // Auth pages render without shell but still need LanguageProvider
  if (isAuthPage) {
    return <LanguageProvider>{children}</LanguageProvider>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Laden...</div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return (
    <LanguageProvider>
      <div className="min-h-screen bg-background">
        {/* Mobile Header */}
        <Header />

        {/* Desktop Sidebar – fixed left */}
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} tenantStatus={tenantStatus} />

        {/* Desktop Topbar – fixed top, offset by sidebar width */}
        <Topbar sidebarOpen={sidebarOpen} />

        {/* Password security warning banner */}
        {showPasswordWarning && (
          <div className={`fixed top-16 left-0 right-0 z-30 transition-all duration-300 ${sidebarOpen ? 'md:left-64' : 'md:left-16'}`}>
            <PasswordWarningBanner onDismiss={() => setShowPasswordWarning(false)} />
          </div>
        )}

        {/* Main Content */}
        <main
          className={`
            transition-all duration-300
            px-4 py-6 pb-24
            md:pb-8 md:px-6 lg:px-8
            md:pt-24
            ${sidebarOpen ? 'md:pl-72' : 'md:pl-24'}
          `}
        >
          <div key={pathname} className="animate-page-in max-w-screen-xl mx-auto">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <BottomNav />

        {/* Release Notes Modal */}
        {releaseNotesVersion && (
          <ReleaseNotesModal
            version={releaseNotesVersion}
            onClose={handleReleaseNotesClose}
          />
        )}
      </div>
    </LanguageProvider>
  );
}
