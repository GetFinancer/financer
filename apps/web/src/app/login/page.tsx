'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { PasswordInput } from '@/components/PasswordInput';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [version, setVersion] = useState('0.0.0');

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
    api.getReleaseNotesStatus().then(s => setVersion(s.currentVersion)).catch(() => {});
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
      <div className="app-bg-glow min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="app-bg-glow min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="glass-card-elevated p-8 rounded-[22px]">
          <div className="text-center mb-8">
            <Image
              src="/favicon.svg"
              alt="Financer Logo"
              width={56}
              height={56}
              className="mx-auto mb-4 rounded-lg"
            />
            <h1 className="text-base font-bold text-foreground mb-1.5">
              {requiresTwoFactor ? t('twoFactorTitle') : t('loginWelcomeBack')}
            </h1>
            <p className="text-[11px] text-muted-foreground font-mono">
              {t('loginSelfHosted')} · v{version}
            </p>
          </div>

          {!requiresTwoFactor ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  {t('password')}
                </label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-[10px] border border-white/12 bg-white/5 text-sm focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-colors"
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
                className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-[10px] font-bold text-[13px] shadow-[0_6px_24px_-4px_hsl(var(--primary)/0.4)] hover:bg-primary-hover active:scale-[0.99] transition-all disabled:opacity-50"
              >
                {loading ? t('loginLoading') : t('login')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleTotpSubmit} className="space-y-4">
              <div>
                <label htmlFor="totpCode" className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  {t('twoFactorCode')}
                </label>
                <input
                  type="text"
                  id="totpCode"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\s/g, ''))}
                  className="w-full px-4 py-2.5 rounded-[10px] border border-white/12 bg-white/5 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20 text-center text-2xl tracking-widest font-mono transition-colors"
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
                className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-[10px] font-bold text-[13px] shadow-[0_6px_24px_-4px_hsl(var(--primary)/0.4)] hover:bg-primary-hover active:scale-[0.99] transition-all disabled:opacity-50"
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

        <div className="flex items-center justify-center gap-4 mt-6 text-[10px] text-muted-foreground/70">
          <a
            href="https://docs.getfinancer.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            {t('navDocumentation')}
          </a>
          <span className="opacity-40">·</span>
          <a
            href="https://bugsfinancer.itwtserv.ovh"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            {t('navFeedback')}
          </a>
        </div>
      </div>
    </div>
  );
}
