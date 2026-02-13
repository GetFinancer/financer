'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

export default function SetupPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 4) {
      setError(t('setupPasswordTooShort'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('setupPasswordMismatch'));
      return;
    }

    setLoading(true);

    try {
      await api.setup(password);
      router.push('/');
    } catch (err) {
      setError(t('setupFailed'));
    } finally {
      setLoading(false);
    }
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
            <p className="text-foreground-secondary">{t('setupTitle')}</p>
          </div>

          <p className="text-sm text-foreground-secondary mb-6">
            {t('setupDescription')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                {t('setupPassword')}
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

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                {t('setupConfirmPassword')}
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••••"
                required
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
              {loading ? t('setupLoading') : t('setupButton')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
