'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);

  // Check if setup is complete, redirect to setup if not
  useEffect(() => {
    async function checkSetupStatus() {
      try {
        const status = await api.getAuthStatus();
        if (!status.isSetupComplete) {
          router.push('/setup');
          return;
        }
        if (status.isAuthenticated) {
          router.push('/');
          return;
        }
      } catch {
        // API error - stay on login page
      } finally {
        setCheckingSetup(false);
      }
    }
    checkSetupStatus();
  }, [router]);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await api.login(password);
      if (result.requiresTwoFactor) {
        setRequiresTwoFactor(true);
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message || t('loginWrongPassword'));
    } finally {
      setLoading(false);
    }
  }

  async function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.login(password, totpCode);
      router.push('/');
    } catch (err: any) {
      setError(err.message || t('loginInvalidCode'));
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setRequiresTwoFactor(false);
    setTotpCode('');
    setError('');
  }

  if (checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
      <div className="w-full max-w-sm">
        <div className="glass-card glass-glow p-8">
          <div className="text-center mb-8">
            <Image
              src="/favicon.svg"
              alt="Financer Logo"
              width={64}
              height={64}
              className="mx-auto mb-4 rounded-lg"
            />
            <h1 className="text-2xl font-bold text-foreground mb-2">Financer</h1>
            <p className="text-foreground-secondary">
              {requiresTwoFactor ? t('twoFactorTitle') : t('loginTitle')}
            </p>
          </div>

          {!requiresTwoFactor ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2">
                  {t('password')}
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="••••••••"
                  required
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loading ? t('loginLoading') : t('login')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleTotpSubmit} className="space-y-4">
              <div>
                <label htmlFor="totpCode" className="block text-sm font-medium mb-2">
                  {t('twoFactorCode')}
                </label>
                <input
                  type="text"
                  id="totpCode"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\s/g, ''))}
                  className="w-full px-4 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-center text-2xl tracking-widest"
                  placeholder="000000"
                  maxLength={8}
                  required
                  autoFocus
                  autoComplete="one-time-code"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {t('twoFactorHint')}
                </p>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loading ? t('verifyLoading') : t('verify')}
              </button>

              <button
                type="button"
                onClick={handleBack}
                className="w-full py-2 px-4 text-muted-foreground hover:text-foreground transition-colors text-sm"
              >
                {t('back')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
