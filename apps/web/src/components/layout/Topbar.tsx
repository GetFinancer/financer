'use client';

import { cn } from '@/lib/utils';
import { GlobalSearch } from './GlobalSearch';
import { ThemeToggle } from './ThemeToggle';

interface TopbarProps {
  sidebarOpen: boolean;
}

export function Topbar({ sidebarOpen }: TopbarProps) {
  return (
    <header
      className={cn(
        'hidden sidebar:flex fixed top-0 right-0 z-30 h-16 topbar-bg transition-all duration-300',
        sidebarOpen ? 'left-64' : 'left-16'
      )}
    >
      <div className="w-full h-full px-6 flex items-center justify-between gap-4">
        <GlobalSearch />
        <div className="flex items-center gap-1 flex-shrink-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
