'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { formatCurrency } from '@/lib/utils';
import type { SharedAccountInfo, AccountWithBalance, Category, SharedBalanceResult } from '@financer/shared';
import SharedAccountModal from '@/components/SharedAccountModal';

interface InvitePreview {
  sharedUuid: string;
  ownerTenant: string;
  accountName: string;
  expiresAt: string;
}

type Panel = 'none' | 'invite' | 'share';

interface DebtEntry {
  account: SharedAccountInfo;
  tenant: string;
  displayName: string | null;
  owes: number;
  sources: { description?: string; amount: number }[];
}

interface SettleDialog {
  accountUuid: string;
  creditorTenant: string;
  displayName: string | null;
  amount: number;
}

export default function SharedAccountsPage() {
  const { t, numberLocale, locale } = useTranslation();
  const [sharedAccounts, setSharedAccounts] = useState<SharedAccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SharedAccountInfo | null>(null);

  // Debt state
  const [debtEntries, setDebtEntries] = useState<DebtEntry[]>([]);
  const [expandedDebts, setExpandedDebts] = useState<Set<string>>(new Set());
  const [iOweCollapsed, setIOweCollapsed] = useState(false);
  const [theyOweCollapsed, setTheyOweCollapsed] = useState(false);

  // Panel state
  const [panel, setPanel] = useState<Panel>('none');

  // Invite via link
  const [inviteInput, setInviteInput] = useState('');
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);

  // Share an account
  const [ownAccounts, setOwnAccounts] = useState<AccountWithBalance[]>([]);
  const [shareAccountId, setShareAccountId] = useState<number | null>(null);
  const [shareMode, setShareMode] = useState<'joint' | 'pool'>('joint');
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareInviteUrl, setShareInviteUrl] = useState<string | null>(null);
  const [shareInviteCopied, setShareInviteCopied] = useState(false);

  // Settle dialog
  const [settleDialog, setSettleDialog] = useState<SettleDialog | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleDate, setSettleDate] = useState(new Date().toISOString().split('T')[0]);
  const [settleFromAccountId, setSettleFromAccountId] = useState('');
  const [settleCategoryId, setSettleCategoryId] = useState('');
  const [settling, setSettling] = useState(false);
  const [settleOwnAccounts, setSettleOwnAccounts] = useState<AccountWithBalance[]>([]);
  const [settleCategories, setSettleCategories] = useState<Category[]>([]);

  async function loadSharedAccounts() {
    try {
      const data = await api.getSharedAccounts();
      setSharedAccounts(data);
      await loadBalances(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadBalances(accounts: SharedAccountInfo[]) {
    const entries: DebtEntry[] = [];
    // The backend already nets balances across all related shared accounts.
    // Querying multiple accounts with overlapping members would duplicate results,
    // so we skip any creditor tenant we've already seen from a prior call.
    const seenCreditors = new Set<string>();
    for (const sa of accounts) {
      try {
        const bal: SharedBalanceResult = await api.getSharedBalance(sa.uuid);
        for (const b of bal.balances) {
          if (!seenCreditors.has(b.tenant)) {
            seenCreditors.add(b.tenant);
            entries.push({ account: sa, tenant: b.tenant, displayName: b.displayName, owes: b.owes, sources: b.sources ?? [] });
          }
        }
      } catch {}
    }
    setDebtEntries(entries);
  }

  async function loadOwnAccounts() {
    try {
      const data = await api.getAccounts();
      setOwnAccounts(data.filter(a => !a.sharedUuid));
    } catch {}
  }

  useEffect(() => {
    loadSharedAccounts();
  }, []);

  // Load settle accounts/categories when settle dialog opens
  useEffect(() => {
    if (!settleDialog) return;
    Promise.all([api.getAccounts(), api.getCategories()])
      .then(([accs, cats]) => {
        setSettleOwnAccounts(accs.filter(a => !a.sharedUuid));
        setSettleCategories(cats.filter(c => c.type === 'expense'));
      })
      .catch(() => {});
  }, [settleDialog]);

  function openPanel(p: Panel) {
    setPanel(v => v === p ? 'none' : p);
    if (p === 'share') loadOwnAccounts();
    setInviteInput('');
    setInvitePreview(null);
    setInviteError(null);
    setJoinSuccess(false);
    setShareError(null);
    setShareAccountId(null);
    setShareMode('joint');
    setShareInviteUrl(null);
    setShareInviteCopied(false);
  }

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
        setPanel('none');
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

  function buildInviteUrl(token: string): string {
    if (typeof window === 'undefined') return token;
    return `${window.location.protocol}//${window.location.host}/join/${token}`;
  }

  async function handleShare() {
    if (!shareAccountId) return;
    setSharing(true);
    setShareError(null);
    try {
      const { uuid } = await api.shareAccount(shareAccountId, shareMode);
      const invite = await api.createInvite(uuid, 48);
      const url = buildInviteUrl(invite.token);
      setShareInviteUrl(url);
      await loadSharedAccounts();
    } catch (err: any) {
      setShareError(err.message || t('errorSaving'));
    } finally {
      setSharing(false);
    }
  }

  function handleCopyShareInvite() {
    if (!shareInviteUrl) return;
    navigator.clipboard.writeText(shareInviteUrl);
    setShareInviteCopied(true);
    setTimeout(() => setShareInviteCopied(false), 2000);
  }

  function handleDoneSharing() {
    setPanel('none');
    setShareAccountId(null);
    setShareInviteUrl(null);
    setShareInviteCopied(false);
    setShareMode('joint');
  }

  function openSettleDialog(entry: DebtEntry) {
    setSettleDialog({
      accountUuid: entry.account.uuid,
      creditorTenant: entry.tenant,
      displayName: entry.displayName,
      amount: Math.abs(entry.owes),
    });
    setSettleAmount(String(Math.abs(entry.owes)));
    setSettleDate(new Date().toISOString().split('T')[0]);
    setSettleFromAccountId('');
    setSettleCategoryId('');
  }

  async function handleSettle() {
    if (!settleDialog) return;
    setSettling(true);
    try {
      await api.settleUp(
        settleDialog.accountUuid,
        Number(settleAmount),
        settleDate,
        {
          fromAccountId: settleFromAccountId ? Number(settleFromAccountId) : undefined,
          categoryId: settleCategoryId ? Number(settleCategoryId) : undefined,
        }
      );
      setSettleDialog(null);
      loadSharedAccounts();
    } catch {
    } finally {
      setSettling(false);
    }
  }

  function toggleDebtExpand(key: string) {
    setExpandedDebts(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Translate system-generated description prefixes
  function translateDesc(desc: string | undefined): string | undefined {
    if (!desc) return desc;
    if (desc.startsWith('Eigenanteil / Own share: ')) {
      return t('sharedAccountsEigenanteil') + ': ' + desc.slice('Eigenanteil / Own share: '.length);
    }
    if (desc.startsWith('Eigenanteil: ')) {
      return t('sharedAccountsEigenanteil') + ': ' + desc.slice('Eigenanteil: '.length);
    }
    return desc;
  }

  const iOweEntries = debtEntries.filter(e => e.owes < 0);
  const theyOweEntries = debtEntries.filter(e => e.owes > 0);

  return (
    <>
      {selected && (
        <SharedAccountModal
          account={selected}
          onClose={() => { loadSharedAccounts(); setSelected(null); }}
          onDeleted={() => { loadSharedAccounts(); setSelected(null); }}
        />
      )}

      {/* Settle Dialog */}
      {settleDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <h3 className="font-semibold">{t('sharedAccountsSettleTitle')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('sharedAccountsSettleToward').replace('{name}', settleDialog.displayName ?? settleDialog.creditorTenant)}
            </p>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('sharedAccountsSettleAmount')}</label>
              <input
                type="number"
                value={settleAmount}
                onChange={e => setSettleAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:border-primary"
                step="0.01" min="0"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('txDate')}</label>
              <input
                type="date"
                value={settleDate}
                onChange={e => setSettleDate(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('sharedAccountsSettleFromAccount')}</label>
              <select
                value={settleFromAccountId}
                onChange={e => setSettleFromAccountId(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:border-primary"
              >
                <option value="">{t('sharedAccountsSettleNoAccount')}</option>
                {settleOwnAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance, undefined, numberLocale)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('sharedAccountsSettleCategory')}</label>
              <select
                value={settleCategoryId}
                onChange={e => setSettleCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:border-primary"
              >
                <option value="">{t('sharedAccountsSettleNoCategory')}</option>
                {settleCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSettle}
                disabled={!settleAmount || settling}
                className="flex-1 py-2 nav-item-active rounded-full text-sm hover:opacity-90 disabled:opacity-50"
              >
                {settling ? t('loading') : t('sharedAccountsSettleConfirmBtn')}
              </button>
              <button
                onClick={() => setSettleDialog(null)}
                className="flex-1 py-2 border border-border rounded-full text-sm hover:bg-card"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{t('sharedAccountsTitle')}</h1>
            <p className="text-muted-foreground">{t('sharedAccountsSubtitle')}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => openPanel('share')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all hover:opacity-90 active:scale-95 ${panel === 'share' ? 'nav-item-active' : 'border border-border text-muted-foreground hover:text-foreground'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              {t('sharedAccountsShare')}
            </button>
            <button
              onClick={() => openPanel('invite')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all hover:opacity-90 active:scale-95 ${panel === 'invite' ? 'nav-item-active' : 'border border-border text-muted-foreground hover:text-foreground'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {t('sharedAccountsEnterLink')}
            </button>
          </div>
        </div>

        {/* Share an account panel */}
        {panel === 'share' && (
          <div className="glass-card p-5 space-y-4">
            <h2 className="font-semibold text-sm">{t('sharedAccountsShare')}</h2>
            {shareInviteUrl ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{t('sharedAccountsInviteTokenHint')}</p>
                <a
                  href={shareInviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-card border border-border rounded p-3 text-sm font-mono break-all select-all hover:border-primary/50 transition-colors"
                  onClick={e => e.preventDefault()}
                >
                  {shareInviteUrl}
                </a>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyShareInvite}
                    className={`flex-1 py-2 rounded-full text-sm transition-all ${shareInviteCopied ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'nav-item-active hover:opacity-90'}`}
                  >
                    {shareInviteCopied ? t('sharedAccountsInviteCopied') : t('sharedAccountsInviteCopy')}
                  </button>
                  <button onClick={handleDoneSharing} className="px-4 py-2 border border-border rounded-full text-sm hover:bg-card">
                    {t('done')}
                  </button>
                </div>
              </div>
            ) : ownAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('sharedAccountsNoAccountsToShare')}</p>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">{t('sharedAccountsSelectAccount')}</label>
                  <select
                    value={shareAccountId ?? ''}
                    onChange={e => setShareAccountId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="">{t('sharedAccountsSelectAccountPlaceholder')}</option>
                    {ownAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} — {formatCurrency(a.balance, undefined, numberLocale)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">{t('sharedAccountsSelectMode')}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      onClick={() => setShareMode('joint')}
                      className={`text-left p-3 border rounded-lg transition-colors ${shareMode === 'joint' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-card'}`}
                    >
                      <div className="font-medium text-sm">{t('sharedAccountsModeJoint')}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{t('sharedAccountsModeJointDesc')}</div>
                    </button>
                    <button
                      onClick={() => setShareMode('pool')}
                      className={`text-left p-3 border rounded-lg transition-colors ${shareMode === 'pool' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-card'}`}
                    >
                      <div className="font-medium text-sm">{t('sharedAccountsModePool')}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{t('sharedAccountsModePoolDesc')}</div>
                    </button>
                  </div>
                </div>
                {shareError && <p className="text-sm text-destructive">{shareError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleShare}
                    disabled={!shareAccountId || sharing}
                    className="px-4 py-2 nav-item-active rounded-full text-sm hover:opacity-90 disabled:opacity-50"
                  >
                    {sharing ? t('loading') : t('sharedAccountsShare')}
                  </button>
                  <button onClick={() => setPanel('none')} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
                    {t('cancel')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Einladungslink-Formular */}
        {panel === 'invite' && (
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
                <button onClick={() => setPanel('none')} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
                  {t('cancel')}
                </button>
              </div>
            )}
            {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
            {joinSuccess && <p className="text-sm text-green-500 font-medium">{t('joinSuccess')}</p>}
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
                  <button onClick={() => setPanel('none')} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-full">
                    {t('cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">{t('loading')}</div>
        ) : (
          <>
            {/* ── Schulde ich ── */}
            {iOweEntries.length > 0 && (
              <div className="glass-card overflow-hidden">
                <button
                  onClick={() => setIOweCollapsed(v => !v)}
                  className="w-full flex items-center justify-between p-4 hover:bg-card/50 transition-colors"
                >
                  <span className="font-semibold text-sm flex items-center gap-2">
                    {t('sharedAccountsTabSchuldeIch')}
                    <span className="text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full">{iOweEntries.length}</span>
                  </span>
                  <svg className={`w-4 h-4 text-muted-foreground transition-transform ${iOweCollapsed ? '-rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {!iOweCollapsed && (
                  <div className="border-t border-border divide-y divide-border/50">
                    {iOweEntries.map(entry => {
                      const key = `iowe-${entry.account.uuid}-${entry.tenant}`;
                      const isExpanded = expandedDebts.has(key);
                      const hasSources = entry.sources.length > 0;
                      return (
                        <div key={key}>
                          <div className="flex items-center justify-between px-4 py-3 gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-expense">
                                  {formatCurrency(Math.abs(entry.owes), undefined, numberLocale)}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {t('sharedAccountsDebtSectionIOwePre')} <span className="text-foreground font-medium">{entry.displayName ?? entry.tenant}</span>
                                </span>
                                <span className="text-xs text-muted-foreground/60">· {entry.account.accountName}</span>
                              </div>
                              {isExpanded && hasSources && (
                                <div className="mt-2 space-y-1">
                                  {entry.sources.map((s, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs text-muted-foreground pl-2 border-l border-border">
                                      <span>{s.description ? translateDesc(s.description) : '—'}</span>
                                      <span>{formatCurrency(s.amount, undefined, numberLocale)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {hasSources && (
                                <button
                                  onClick={() => toggleDebtExpand(key)}
                                  className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground border border-transparent hover:border-border rounded transition-colors"
                                >
                                  {isExpanded ? '▲' : '▼'}
                                </button>
                              )}
                              <button
                                onClick={() => openSettleDialog(entry)}
                                className="text-xs px-3 py-1.5 nav-item-active rounded-full hover:opacity-90 transition-all"
                              >
                                {t('sharedAccountsSettleBtn')}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Schuldet mir ── */}
            {theyOweEntries.length > 0 && (
              <div className="glass-card overflow-hidden">
                <button
                  onClick={() => setTheyOweCollapsed(v => !v)}
                  className="w-full flex items-center justify-between p-4 hover:bg-card/50 transition-colors"
                >
                  <span className="font-semibold text-sm flex items-center gap-2">
                    {t('sharedAccountsTabSchuldetMir')}
                    <span className="text-xs bg-income/20 text-income px-1.5 py-0.5 rounded-full">{theyOweEntries.length}</span>
                  </span>
                  <svg className={`w-4 h-4 text-muted-foreground transition-transform ${theyOweCollapsed ? '-rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {!theyOweCollapsed && (
                  <div className="border-t border-border divide-y divide-border/50">
                    {theyOweEntries.map(entry => {
                      const key = `theyowe-${entry.account.uuid}-${entry.tenant}`;
                      const isExpanded = expandedDebts.has(key);
                      const hasSources = entry.sources.length > 0;
                      return (
                        <div key={key}>
                          <div className="flex items-center justify-between px-4 py-3 gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-income">
                                  {formatCurrency(entry.owes, undefined, numberLocale)}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  <span className="text-foreground font-medium">{entry.displayName ?? entry.tenant}</span> {t('sharedAccountsDebtSectionTheyOwePre')}
                                </span>
                                <span className="text-xs text-muted-foreground/60">· {entry.account.accountName}</span>
                              </div>
                              {isExpanded && hasSources && (
                                <div className="mt-2 space-y-1">
                                  {entry.sources.map((s, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs text-muted-foreground pl-2 border-l border-border">
                                      <span>{s.description ? translateDesc(s.description) : '—'}</span>
                                      <span>{formatCurrency(s.amount, undefined, numberLocale)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            {hasSources && (
                              <button
                                onClick={() => toggleDebtExpand(key)}
                                className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground border border-transparent hover:border-border rounded transition-colors flex-shrink-0"
                              >
                                {isExpanded ? '▲' : '▼'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Geteilte Konten ── */}
            {sharedAccounts.length === 0 ? (
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
                            {sa.mode === 'pool' ? t('sharedAccountsModePool') : t('sharedAccountsModeJoint')}
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
          </>
        )}
      </div>
    </>
  );
}
