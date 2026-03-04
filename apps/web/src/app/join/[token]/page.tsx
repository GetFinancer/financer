'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

interface InvitePreview {
  sharedUuid: string;
  ownerTenant: string;
  accountName: string;
  expiresAt: string;
}

export default function JoinPage() {
  const { t, locale } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.getInvitePreview(token)
      .then(data => {
        setPreview(data);
      })
      .catch(err => {
        setError(err.message || t('joinError'));
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleJoin() {
    if (!preview) return;
    setJoining(true);
    try {
      await api.joinSharedAccount(token);
      setJoined(true);
      setTimeout(() => router.push('/shared-accounts'), 2000);
    } catch (err: any) {
      setError(err.message || t('joinError'));
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-background border border-border rounded-xl shadow-xl p-8 w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-center">{t('joinTitle')}</h1>

        {loading && (
          <div className="text-center text-muted-foreground">{t('loading')}</div>
        )}

        {error && (
          <div className="text-center space-y-4">
            <div className="text-destructive">{error}</div>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 nav-item-active rounded-full hover:opacity-90 transition-all"
            >
              {t('back')}
            </button>
          </div>
        )}

        {joined && (
          <div className="text-center text-green-500 font-medium">{t('joinSuccess')}</div>
        )}

        {preview && !joined && !error && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('joinInvitedBy')}</span>
                <span className="font-medium">{preview.ownerTenant}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('joinAccountName')}</span>
                <span className="font-medium">{preview.accountName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('joinExpires')}</span>
                <span className="text-muted-foreground">
                  {new Date(preview.expiresAt).toLocaleString(locale === 'de' ? 'de-DE' : 'en-US')}
                </span>
              </div>
            </div>

            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full py-3 nav-item-active rounded-full hover:opacity-90 active:scale-95 transition-all font-medium disabled:opacity-50"
            >
              {joining ? t('joinAccepting') : t('joinAccept')}
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('cancel')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
