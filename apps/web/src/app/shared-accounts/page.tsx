'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { formatCurrency } from '@/lib/utils';
import type { SharedAccountInfo } from '@financer/shared';
import SharedAccountModal from '@/components/SharedAccountModal';

interface InvitePreview {
  sharedUuid: string;
  ownerTenant: string;
  accountName: string;
  expiresAt: string;
}

export default function SharedAccountsPage() {
  const { t, numberLocale, locale } = useTranslation();
  const [sharedAccounts, setSharedAccounts] = useState<SharedAccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SharedAccountInfo | null>(null);

  // Einladungslink-Eingabe
  const [showInviteInput, setShowInviteInput] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);

  async function loadSharedAccounts() {
    try {
      const data = await api.getSharedAccounts();
      setSharedAccounts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSharedAccounts();
  }, []);

  // Token aus URL oder bare token extrahieren
  function extractToken(input: string): string {
    const trimmed = input.trim();
    const joinIndex = trimmed.lastIndexOf('/join/');
    return joinIndex !== -1 ? trimmed.slice(joinIndex + 6) : trimmed;
  }

  async function handlePreviewInvite() {
    const token = extractToken(inviteInput);
    if (!token) return;
    setInviteLoading(true);
    setInviteError(null);
    setInvitePreview(null);
    try {
      const data = await api.getInvitePreview(token);
      setInvitePreview(data);
    } catch (err: any) {
      setInviteError(err.message || t('joinError'));
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleJoin() {
    if (!invitePreview) return;
    const token = extractToken(inviteInput);
    setJoining(true);
    try {
      await api.joinSharedAccount(token);
      setJoinSuccess(true);
      setTimeout(() => {
        setShowInviteInput(false);
        setInviteInput('');
        setInvitePreview(null);
        setJoinSuccess(false);
        loadSharedAccounts();
      }, 1500);
    } catch (err: any) {
      setInviteError(err.message || t('joinError'));
    } finally {
      setJoining(false);
    }
  }

  function resetInviteForm() {
    setShowInviteInput(false);
    setInviteInput('');
    setInvitePreview(null);
    setInviteError(null);
    setJoinSuccess(false);
  }

  return (
    <>
      {selected && (
        <SharedAccountModal
          account={selected}
          onClose={() => setSelected(null)}
          onDeleted={() => { loadSharedAccounts(); setSelected(null); }}
        />
      )}

      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t('sharedAccountsTitle')}</h1>
            <p className="text-muted-foreground">{t('sharedAccountsSubtitle')}</p>
          </div>
          <button
            onClick={() => setShowInviteInput(v => !v)}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 nav-item-active rounded-full hover:opacity-90 active:scale-95 transition-all text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            {t('sharedAccountsEnterLink')}
          </button>
        </div>

        {/* Einladungslink-Formular */}
        {showInviteInput && (
          <div className="glass-card p-5 space-y-4">
            <h2 className="font-semibold text-sm">{t('sharedAccountsEnterLink')}</h2>

            {!invitePreview && !joinSuccess && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteInput}
                  onChange={e => { setInviteInput(e.target.value); setInviteError(null); }}
                  placeholder={t('sharedAccountsLinkPlaceholder')}
                  className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
                  onKeyDown={e => e.key === 'Enter' && handlePreviewInvite()}
                  autoFocus
                />
                <button
                  onClick={handlePreviewInvite}
                  disabled={!inviteInput.trim() || inviteLoading}
                  className="px-4 py-2 nav-item-active rounded-md text-sm hover:opacity-90 disabled:opacity-50"
                >
                  {inviteLoading ? t('loading') : t('sharedAccountsLinkCheck')}
                </button>
                <button onClick={resetInviteForm} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
                  {t('cancel')}
                </button>
              </div>
            )}

            {inviteError && (
              <p className="text-sm text-destructive">{inviteError}</p>
            )}

            {joinSuccess && (
              <p className="text-sm text-green-500 font-medium">{t('joinSuccess')}</p>
            )}

            {invitePreview && !joinSuccess && (
              <div className="space-y-3">
                <div className="bg-card border border-border rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('joinInvitedBy')}</span>
                    <span className="font-medium">{invitePreview.ownerTenant}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('joinAccountName')}</span>
                    <span className="font-medium">{invitePreview.accountName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('joinExpires')}</span>
                    <span className="text-muted-foreground">
                      {new Date(invitePreview.expiresAt).toLocaleString(locale === 'de' ? 'de-DE' : 'en-US')}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleJoin}
                    disabled={joining}
                    className="flex-1 py-2 nav-item-active rounded-full text-sm hover:opacity-90 disabled:opacity-50"
                  >
                    {joining ? t('joinAccepting') : t('joinAccept')}
                  </button>
                  <button onClick={resetInviteForm} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-full">
                    {t('cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">{t('loading')}</div>
        ) : sharedAccounts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border border-border">
            <p>{t('sharedAccountsEmpty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sharedAccounts.map(sa => (
              <div key={sa.uuid} className="glass-card p-6 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      {sa.accountName}
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-normal">
                        {t('sharedAccountsShared')}
                      </span>
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {t('sharedAccountsOwner')}: {sa.isOwner ? t('sharedAccountsYou') : sa.ownerTenant}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('sharedAccountsMembers').replace('{count}', String(sa.members.length))}
                    </p>
                  </div>
                  <span className={`text-xl font-bold ${sa.balance >= 0 ? 'text-income' : 'text-expense'}`}>
                    {formatCurrency(sa.balance, undefined, numberLocale)}
                  </span>
                </div>

                <button
                  onClick={() => setSelected(sa)}
                  className="w-full py-2 text-sm nav-item-active rounded-full hover:opacity-90 active:scale-95 transition-all"
                >
                  {t('sharedAccountsViewDetails')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
