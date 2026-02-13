'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
    if (pathname === '/login' || pathname === '/setup') {
      setLoading(false);
      setAuthenticated(true);
      return;
    }

    checkAuth();
  }, [router, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Laden...</div>
      </div>
    );
  }

  // No header for login/setup pages
  if (pathname === '/login' || pathname === '/setup') {
    return <>{children}</>;
  }

  if (!authenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      {/* Mobile Header */}
      <Header />

      {/* Desktop Sidebar */}
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

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
