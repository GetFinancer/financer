'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { LanguageProvider } from '@/lib/i18n';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';

interface AppShellProps {
  children: React.ReactNode;
}

// Pages that don't need the app shell
const authPages = ['/login', '/setup'];

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
      } catch (error) {
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
      <div className="min-h-screen bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
        {/* Mobile Header */}
        <Header />

        {/* Desktop Sidebar - persistent, no re-render on navigation */}
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

        {/* Main Content */}
        <main
          className={`
            container mx-auto px-4 py-6 pb-24
            md:pb-6 md:transition-all md:duration-300
            ${sidebarOpen ? 'md:pl-72' : 'md:pl-24'}
          `}
        >
          <div key={pathname} className="animate-page-in">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation - persistent */}
        <BottomNav />
      </div>
    </LanguageProvider>
  );
}
