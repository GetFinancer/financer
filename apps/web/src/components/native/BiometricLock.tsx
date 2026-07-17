'use client';

import { useEffect, useState } from 'react';
import { isNative } from '@/lib/native';
import { getLockEnabled, setLockEnabled } from '@/lib/native/preferences';
import { authenticate, isBiometricAvailable } from '@/lib/native/biometric';
import { useTranslation } from '@/lib/i18n';
import { api } from '@/lib/api';

interface BiometricLockProps {
  children: React.ReactNode;
}

export function BiometricLock({ children }: BiometricLockProps) {
  const native = isNative();
  const { t } = useTranslation();
  const [checkingLock, setCheckingLock] = useState(native);
  const [lockEnabled, setLockEnabledState] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!native) return;

    let cancelled = false;

    getLockEnabled().then((enabled) => {
      if (cancelled) return;
      setLockEnabledState(enabled);
      setCheckingLock(false);
      if (enabled) {
        tryUnlock();
      } else {
        setUnlocked(true);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native]);

  useEffect(() => {
    if (!native) return;

    let removeListener: (() => void) | undefined;

    import('@capacitor/app').then(({ App }) => {
      const handle = App.addListener('resume', () => {
        if (lockEnabled) {
          setUnlocked(false);
          setFailed(false);
          tryUnlock();
        }
      });
      removeListener = () => {
        handle.then((h) => h.remove());
      };
    });

    return () => {
      removeListener?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native, lockEnabled]);

  async function tryUnlock() {
    setFailed(false);

    // Biometric enrollment can change on the OS level (e.g. Face ID disabled or
    // all fingerprints removed) after the in-app toggle was switched on. If it's
    // no longer available, don't keep prompting into a dead end — drop the lock.
    const available = await isBiometricAvailable();
    if (!available) {
      await setLockEnabled(false);
      setLockEnabledState(false);
      setUnlocked(true);
      return;
    }

    const success = await authenticate();
    if (!success) {
      setFailed(true);
      return;
    }

    // A successful local biometric check only proves device possession, not that
    // the server session is still valid — revalidate before granting access.
    try {
      const status = await api.getAuthStatus();
      if (!status.isAuthenticated) {
        window.location.href = '/login';
        return;
      }
    } catch {
      window.location.href = '/login';
      return;
    }

    setUnlocked(true);
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await api.logout();
    } catch {
      // Ignore — we're navigating to /login regardless.
    } finally {
      window.location.href = '/login';
    }
  }

  if (!native) return <>{children}</>;
  if (checkingLock) return null;
  if (!lockEnabled || unlocked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm px-4">
      <div className="glass-card-elevated w-full max-w-sm p-8 text-center space-y-5">
        <h1 className="text-lg font-bold">{t('biometricLockTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('biometricLockSubtitle')}</p>

        <button
          onClick={tryUnlock}
          className="w-full px-4 py-2.5 nav-item-active rounded-[10px] hover:opacity-90 active:scale-95 transition-all text-sm font-semibold"
        >
          {t('biometricUnlock')}
        </button>

        {failed && (
          <div className="space-y-3">
            <p className="text-xs text-destructive">{t('biometricRetryHint')}</p>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {loggingOut ? t('logoutLoading') : t('biometricUseLogin')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
