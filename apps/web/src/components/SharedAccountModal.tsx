'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { formatCurrency } from '@/lib/utils';
import { ConfirmDialog } from './ConfirmDialog';
import type { SharedAccountInfo, TransactionWithDetails, SharedBalanceResult, AccountWithBalance, Category } from '@financer/shared';

interface Props {
  account: SharedAccountInfo;
  onClose: () => void;
  onDeleted: () => void;
}

type Tab = 'ausgaben' | 'schuldeich' | 'schuldetmir';

interface SettleDialog {
  creditorTenant: string;
  displayName: string | null;
  amount: number;
}

export default function SharedAccountModal({ account, onClose, onDeleted }: Props) {
  const { t, locale, numberLocale } = useTranslation();

  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [balance, setBalance] = useState<SharedBalanceResult | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('ausgaben');
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<{ token: string; expiresAt: string } | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [inviteDurationHours, setInviteDurationHours] = useState(48);

  // Split panel state
  const [openSplitTxId, setOpenSplitTxId] = useState<number | null>(null);
  const [splitDraftAmounts, setSplitDraftAmounts] = useState<Record<number, Record<string, string>>>({});

  // Settle dialog state
  const [settleDialog, setSettleDialog] = useState<SettleDialog | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleDate, setSettleDate] = useState(new Date().toISOString().split('T')[0]);
  const [settleFromAccountId, setSettleFromAccountId] = useState('');
  const [settleCategoryId, setSettleCategoryId] = useState('');
  const [settling, setSettling] = useState(false);
  const [ownAccounts, setOwnAccounts] = useState<AccountWithBalance[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Detect current tenant from hostname
  const currentTenant = account.isOwner
    ? account.ownerTenant
    : (typeof window !== 'undefined' && window.location.hostname.includes('.')
      ? window.location.hostname.split('.')[0]
      : account.members[0]?.tenant ?? '');

  const allMembersForSplit = [
    { tenant: account.ownerTenant, displayName: account.isOwner ? t('sharedAccountsYou') : account.ownerTenant },
    ...account.members.map(m => ({
      tenant: m.tenant,
      displayName: m.tenant === currentTenant ? t('sharedAccountsYou') : (m.displayName ?? m.tenant),
    })),
  ];

  // Computed balance views
  const iOwe = (balance?.balances ?? []).filter(b => b.owes < 0);
  const theyOweMe = (balance?.balances ?? []).filter(b => b.owes > 0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [txs, bal] = await Promise.all([
        api.getSharedAccountTransactions(account.uuid),
        api.getSharedBalance(account.uuid),
      ]);
      setTransactions(txs);
      setBalance(bal);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [account.uuid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load own accounts + categories when settle dialog opens
  useEffect(() => {
    if (!settleDialog) return;
    Promise.all([api.getAccounts(), api.getCategories()])
      .then(([accs, cats]) => {
        setOwnAccounts(accs.filter(a => !a.sharedUuid));
        setCategories(cats.filter(c => c.type === 'expense'));
      })
      .catch(() => {});
  }, [settleDialog]);

  function buildInviteUrl(token: string): string {
    if (typeof window === 'undefined') return token;
    return `${window.location.protocol}//${window.location.host}/join/${token}`;
  }

  async function handleCreateInvite() {
    try {
      const data = await api.createInvite(account.uuid, inviteDurationHours);
      setInvite({ token: data.token, expiresAt: data.expiresAt });
      setShowInvite(true);
      setErrorMsg(null);
    } catch {
      setErrorMsg(t('errorSaving'));
    }
  }

  function handleCopyInvite() {
    if (!invite) return;
    navigator.clipboard.writeText(buildInviteUrl(invite.token));
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setShowInvite(false);
    }, 1500);
  }

  function handleRemoveMember(memberTenant: string) {
    setConfirmDialog({
      message: t('sharedAccountsRemoveMemberConfirm').replace('{tenant}', memberTenant),
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.removeMember(account.uuid, memberTenant);
          onDeleted();
          onClose();
        } catch {
          setErrorMsg(t('errorDeleting'));
        }
      },
    });
  }

  function handleStopSharing() {
    setConfirmDialog({
      message: t('sharedAccountsStopSharingConfirm'),
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.deleteSharedAccount(account.uuid);
          onDeleted();
          onClose();
        } catch {
          setErrorMsg(t('errorDeleting'));
        }
      },
    });
  }

  function handleLeave() {
    setConfirmDialog({
      message: t('sharedAccountsLeaveConfirm'),
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.removeMember(account.uuid, currentTenant);
          onDeleted();
          onClose();
        } catch {
          setErrorMsg(t('errorDeleting'));
        }
      },
    });
  }

  function handleDeleteTx(txId: number) {
    setConfirmDialog({
      message: t('transactionsConfirmDelete'),
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.deleteSharedTransaction(account.uuid, txId);
          if (openSplitTxId === txId) setOpenSplitTxId(null);
          loadData();
        } catch {
          setErrorMsg(t('errorDeleting'));
        }
      },
    });
  }

  // Determine payer tenant for a transaction
  function getPayerTenant(tx: TransactionWithDetails): string {
    return tx.addedBy ?? account.ownerTenant;
  }

  // Fill split draft with equal amounts (locked settled shares kept, payer gets residual)
  function fillEqualSplit(tx: TransactionWithDetails) {
    const payerTenant = getPayerTenant(tx);
    const perPerson = Math.round((tx.amount / allMembersForSplit.length) * 100) / 100;
    const amounts: Record<string, string> = {};
    allMembersForSplit.forEach(m => {
      if (m.tenant === payerTenant) return; // payer computed last
      // Keep locked settled amounts
      const share = tx.split?.shares.find(s => s.tenant === m.tenant);
      if (share?.settled) {
        amounts[m.tenant] = String(share.amount);
      } else {
        amounts[m.tenant] = String(perPerson);
      }
    });
    // Payer gets residual
    const othersSum = Object.values(amounts).reduce((sum, v) => sum + Number(v), 0);
    amounts[payerTenant] = String(Math.max(0, Math.round((tx.amount - othersSum) * 100) / 100));
    setSplitDraftAmounts(prev => ({ ...prev, [tx.id]: amounts }));
  }

  // Open/close split panel
  function toggleSplitPanel(txId: number, tx: TransactionWithDetails) {
    if (openSplitTxId === txId) {
      setOpenSplitTxId(null);
      return;
    }
    setOpenSplitTxId(txId);
    if (tx.split) {
      const amounts: Record<string, string> = {};
      tx.split.shares.forEach(s => { amounts[s.tenant] = String(s.amount); });
      setSplitDraftAmounts(prev => ({ ...prev, [txId]: amounts }));
    } else {
      fillEqualSplit(tx);
    }
  }

  // Recalculate payer's residual when any other member's amount changes
  function updateSplitAmount(txId: number, changedTenant: string, value: string, txAmount: number, payerTenant: string) {
    const current = splitDraftAmounts[txId] ?? {};
    const updated = { ...current, [changedTenant]: value };
    // Payer always gets the residual
    const othersSum = allMembersForSplit
      .filter(m => m.tenant !== payerTenant)
      .reduce((sum, m) => sum + (Number(updated[m.tenant]) || 0), 0);
    updated[payerTenant] = String(Math.max(0, Math.round((txAmount - othersSum) * 100) / 100));
    setSplitDraftAmounts(prev => ({ ...prev, [txId]: updated }));
  }

  async function handleApplySplit(txId: number, payerTenant: string) {
    const amounts = splitDraftAmounts[txId] ?? {};
    const shares: Record<string, number> = {};
    for (const [tenant, amt] of Object.entries(amounts)) {
      if (tenant === payerTenant) continue; // backend computes payer residual
      shares[tenant] = Number(amt);
    }
    try {
      await api.splitTransaction(account.uuid, txId, { type: 'custom', shares });
      setOpenSplitTxId(null);
      loadData();
    } catch {
      setErrorMsg(t('errorSaving'));
    }
  }

  async function handleToggleSettled(txId: number, tenant: string, currentSettled: boolean) {
    try {
      await api.settleShare(account.uuid, txId, tenant, !currentSettled);
      loadData();
    } catch {
      setErrorMsg(t('errorSaving'));
    }
  }

  function openSettleDialog(creditorTenant: string, displayName: string | null, amount: number) {
    setSettleDialog({ creditorTenant, displayName, amount });
    setSettleAmount(String(Math.abs(amount)));
    setSettleDate(new Date().toISOString().split('T')[0]);
    setSettleFromAccountId('');
    setSettleCategoryId('');
  }

  async function handleSettle() {
    if (!settleDialog) return;
    setSettling(true);
    try {
      await api.settleUp(
        account.uuid,
        Number(settleAmount),
        settleDate,
        {
          fromAccountId: settleFromAccountId ? Number(settleFromAccountId) : undefined,
          categoryId: settleCategoryId ? Number(settleCategoryId) : undefined,
        }
      );
      setSettleDialog(null);
      loadData();
    } catch {
      setErrorMsg(t('errorSaving'));
    } finally {
      setSettling(false);
    }
  }

  const isMyTxCheck = (tx: TransactionWithDetails) =>
    !tx.addedBy || tx.addedBy === currentTenant;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {confirmDialog && (
          <ConfirmDialog
            message={confirmDialog.message}
            onConfirm={confirmDialog.onConfirm}
            onCancel={() => setConfirmDialog(null)}
            confirmLabel={t('yes')}
            cancelLabel={t('cancel')}
          />
        )}

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              {account.accountName}
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-normal">
                {account.mode === 'pool' ? t('sharedAccountsModePool') : t('sharedAccountsModeJoint')}
              </span>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t('sharedAccountsOwner')}: {account.isOwner ? t('sharedAccountsYou') : account.ownerTenant}
              {' · '}
              {t('sharedAccountsMembers').replace('{count}', String(account.members.length))}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Inline error */}
        {errorMsg && (
          <div className="px-6 py-2 bg-destructive/10 border-b border-destructive/20 flex items-center justify-between">
            <p className="text-sm text-destructive">{errorMsg}</p>
            <button onClick={() => setErrorMsg(null)} className="text-destructive/60 hover:text-destructive ml-4">×</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          {(['ausgaben', 'schuldeich', 'schuldetmir'] as Tab[]).map(tab => {
            const label = tab === 'ausgaben' ? t('sharedAccountsTabAusgaben')
              : tab === 'schuldeich' ? t('sharedAccountsTabSchuldeIch')
              : t('sharedAccountsTabSchuldetMir');
            const badge = tab === 'schuldeich' ? iOwe.length
              : tab === 'schuldetmir' ? theyOweMe.length
              : null;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
                {badge != null && badge > 0 && (
                  <span className="text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full leading-none">{badge}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">{t('loading')}</div>
          ) : (
            <>
              {/* ── Ausgaben ── */}
              {activeTab === 'ausgaben' && (
                <div className="space-y-1">
                  {transactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">{t('sharedAccountsNoTransactions')}</div>
                  ) : transactions.map(tx => {
                    const isMyTx = isMyTxCheck(tx);
                    const payerTenant = getPayerTenant(tx);
                    const isSplitOpen = openSplitTxId === tx.id;
                    const hasSplit = !!tx.split;
                    const allSettled = hasSplit && tx.split!.shares.every(s => s.settled);
                    // Only allow deleting expense txs that haven't had any non-payer share settled yet
                    // (settled shares create income txs that would be orphaned if the expense is deleted)
                    const hasSettledNonPayerShares = hasSplit && tx.split!.shares.some(s => s.settled && s.tenant !== payerTenant);
                    const canDelete = isMyTx && tx.type === 'expense' && !hasSettledNonPayerShares;

                    return (
                      <div key={tx.id}>
                        <div className="flex items-center justify-between py-2 border-b border-border/50">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${tx.type === 'income' ? 'text-income' : 'text-expense'}`}>
                                {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, undefined, numberLocale)}
                              </span>
                              <span className="text-sm truncate">{tx.description || tx.categoryName}</span>
                              {allSettled ? (
                                <span className="text-xs bg-green-500/15 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded">
                                  {t('sharedAccountsSplitFullySettled')}
                                </span>
                              ) : hasSplit ? (
                                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                  {t('sharedAccountsSplitDone')}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {tx.date} · {isMyTx ? t('sharedAccountsYou') : (tx.addedBy ?? account.ownerTenant)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            {tx.type === 'expense' && account.mode === 'pool' && !allSettled && (
                              <button
                                onClick={() => toggleSplitPanel(tx.id, tx)}
                                className={`text-xs px-2 py-1 rounded border transition-colors ${
                                  isSplitOpen
                                    ? 'border-primary/50 text-primary bg-primary/5'
                                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-background hover:border-border'
                                }`}
                              >
                                {isMyTx
                                  ? (hasSplit ? t('sharedAccountsSplitChange') : t('sharedAccountsSplitOpen'))
                                  : (hasSplit ? t('sharedAccountsSplitView') : null)}
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteTx(tx.id)}
                                className="text-xs px-2 py-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded border border-transparent hover:border-destructive/20 transition-colors"
                              >
                                {t('sharedAccountsDeleteTx')}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Split panel */}
                        {isSplitOpen && (
                          <div className="bg-card/40 border border-border/60 rounded-lg p-3 my-1 space-y-2">
                            <div className="text-xs font-medium text-muted-foreground">{t('sharedAccountsSplitTitle')}</div>
                            {allMembersForSplit.map(member => {
                              const share = tx.split?.shares.find(s => s.tenant === member.tenant);
                              const draftAmt = splitDraftAmounts[tx.id]?.[member.tenant] ?? '';
                              const isPayer = member.tenant === payerTenant;
                              const isLocked = !isPayer && share?.settled === true;

                              return (
                                <div key={member.tenant} className="flex items-center gap-2">
                                  <span className="text-xs flex-1 truncate">
                                    {member.displayName}
                                    {isPayer && <span className="text-muted-foreground ml-1">({t('sharedAccountsSplitPayerLabel')})</span>}
                                  </span>
                                  {isLocked ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-muted-foreground w-24 text-right">
                                        {formatCurrency(share!.amount, undefined, numberLocale)}
                                      </span>
                                      <span className="text-xs text-green-500">✓</span>
                                    </div>
                                  ) : isPayer ? (
                                    <span className="text-xs text-muted-foreground w-24 text-right italic">
                                      {draftAmt ? formatCurrency(Number(draftAmt), undefined, numberLocale) : '—'}
                                    </span>
                                  ) : isMyTx ? (
                                    <input
                                      type="number"
                                      value={draftAmt}
                                      onChange={e => updateSplitAmount(tx.id, member.tenant, e.target.value, tx.amount, payerTenant)}
                                      className="w-24 px-2 py-1 text-xs border border-border rounded bg-background text-right"
                                      step="0.01"
                                      min="0"
                                    />
                                  ) : (
                                    <span className="text-xs text-muted-foreground w-24 text-right">
                                      {share ? formatCurrency(share.amount, undefined, numberLocale) : '—'}
                                    </span>
                                  )}
                                  {hasSplit && share !== undefined && !isLocked && isMyTx && (
                                    <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={share.settled}
                                        onChange={() => handleToggleSettled(tx.id, member.tenant, share.settled)}
                                        className="cursor-pointer"
                                      />
                                      <span className={share.settled ? 'text-green-500' : 'text-muted-foreground'}>
                                        {t('sharedAccountsSplitSettled')}
                                      </span>
                                    </label>
                                  )}
                                  {hasSplit && share !== undefined && !isLocked && !isMyTx && share.settled && (
                                    <span className="text-xs text-green-500">✓</span>
                                  )}
                                </div>
                              );
                            })}

                            {isMyTx && (
                              <div className="flex gap-2 pt-1 items-center">
                                <button
                                  onClick={() => fillEqualSplit(tx)}
                                  className="text-xs px-2 py-1 border border-border rounded hover:bg-background transition-colors"
                                >
                                  {t('sharedAccountsSplitEqual')}
                                </button>
                                <button
                                  onClick={() => handleApplySplit(tx.id, payerTenant)}
                                  className="text-xs px-2 py-1 nav-item-active rounded hover:opacity-90 transition-all"
                                >
                                  {t('sharedAccountsSplitApply')}
                                </button>
                                <button
                                  onClick={() => setOpenSplitTxId(null)}
                                  className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground ml-auto"
                                >
                                  {t('close')}
                                </button>
                              </div>
                            )}
                            {!isMyTx && (
                              <div className="flex justify-end pt-1">
                                <button
                                  onClick={() => setOpenSplitTxId(null)}
                                  className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground"
                                >
                                  {t('close')}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Schulde ich ── */}
              {activeTab === 'schuldeich' && (
                <div className="space-y-3">
                  {iOwe.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">{t('sharedAccountsNoDebts')}</div>
                  ) : iOwe.map(b => (
                    <div key={b.tenant} className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {t('sharedAccountsIOweTo')
                            .replace('{name}', b.displayName ?? b.tenant)
                            .replace('{amount}', formatCurrency(Math.abs(b.owes), undefined, numberLocale))}
                        </p>
                        {b.sources && b.sources.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {b.sources.filter(s => s.description).map(s => s.description).join(', ')}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => openSettleDialog(b.tenant, b.displayName, Math.abs(b.owes))}
                        className="text-sm px-3 py-1.5 nav-item-active rounded-full hover:opacity-90 transition-all flex-shrink-0 ml-3"
                      >
                        {t('sharedAccountsSettleBtn')}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Schuldet mir ── */}
              {activeTab === 'schuldetmir' && (
                <div className="space-y-3">
                  {theyOweMe.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">{t('sharedAccountsNobodyOwes')}</div>
                  ) : theyOweMe.map(b => (
                    <div key={b.tenant} className="p-3 bg-card border border-border rounded-lg">
                      <p className="text-sm font-medium">
                        {t('sharedAccountsTheyOweMe')
                          .replace('{name}', b.displayName ?? b.tenant)
                          .replace('{amount}', formatCurrency(b.owes, undefined, numberLocale))}
                      </p>
                      {b.sources && b.sources.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {b.sources.filter(s => s.description).map(s => s.description).join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-border p-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {account.isOwner && (
              <>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleCreateInvite}
                    className="text-sm px-3 py-2 rounded-md border border-border hover:bg-card transition-colors"
                  >
                    {t('sharedAccountsInviteCreate')}
                  </button>
                  <select
                    value={inviteDurationHours}
                    onChange={e => setInviteDurationHours(Number(e.target.value))}
                    className="text-xs px-2 py-2 rounded-md border border-border bg-background text-muted-foreground focus:outline-none"
                    title={t('sharedAccountsInviteDuration')}
                  >
                    <option value={24}>{t('sharedAccountsInvite24h')}</option>
                    <option value={48}>{t('sharedAccountsInvite48h')}</option>
                    <option value={168}>{t('sharedAccountsInvite7d')}</option>
                    <option value={720}>{t('sharedAccountsInvite30d')}</option>
                    <option value={0}>{t('sharedAccountsInviteUnlimited')}</option>
                  </select>
                </div>
                <button
                  onClick={handleStopSharing}
                  className="text-sm px-3 py-2 rounded-md border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors"
                >
                  {t('sharedAccountsStopSharing')}
                </button>
              </>
            )}
            {!account.isOwner && (
              <button
                onClick={handleLeave}
                className="text-sm px-3 py-2 rounded-md border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors"
              >
                {t('sharedAccountsLeave')}
              </button>
            )}
          </div>

          {/* Members list (owner view) */}
          {account.isOwner && account.members.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {account.members.map(m => (
                <div key={m.tenant} className="flex items-center gap-1 text-xs bg-card border border-border rounded-full px-2 py-1">
                  <span>{m.displayName ?? m.tenant}</span>
                  <button
                    onClick={() => handleRemoveMember(m.tenant)}
                    className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invite Modal */}
        {showInvite && invite && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-6 rounded-xl">
            <div className="bg-background border border-border rounded-lg p-6 w-full max-w-sm space-y-4">
              <h3 className="font-semibold">{t('sharedAccountsInviteCreate')}</h3>
              <p className="text-xs text-muted-foreground">{t('sharedAccountsInviteTokenHint')}</p>
              <a
                href={buildInviteUrl(invite.token)}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-card border border-border rounded p-3 text-sm font-mono break-all select-all hover:border-primary/50 transition-colors"
                onClick={e => e.preventDefault()}
              >
                {buildInviteUrl(invite.token)}
              </a>
              <p className="text-xs text-muted-foreground">
                {invite.expiresAt.startsWith('9999')
                  ? t('sharedAccountsInviteNoExpiry')
                  : t('sharedAccountsInviteExpires').replace('{date}', new Date(invite.expiresAt).toLocaleString(locale === 'de' ? 'de-DE' : 'en-US'))}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyInvite}
                  className={`flex-1 py-2 rounded-md text-sm transition-all ${copied ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'nav-item-active hover:opacity-90'}`}
                >
                  {copied ? t('sharedAccountsInviteCopied') : t('sharedAccountsInviteCopy')}
                </button>
                <button onClick={() => setShowInvite(false)} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-card">
                  {t('cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settle Dialog */}
        {settleDialog && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-6 rounded-xl">
            <div className="bg-background border border-border rounded-lg p-6 w-full max-w-sm space-y-4">
              <h3 className="font-semibold">{t('sharedAccountsSettleTitle')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('sharedAccountsSettleToward').replace('{name}', settleDialog.displayName ?? settleDialog.creditorTenant)}
              </p>

              {/* Amount */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('sharedAccountsSettleAmount')}</label>
                <input
                  type="number"
                  value={settleAmount}
                  onChange={e => setSettleAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:border-primary"
                  step="0.01"
                  min="0"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('txDate')}</label>
                <input
                  type="date"
                  value={settleDate}
                  onChange={e => setSettleDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:border-primary"
                />
              </div>

              {/* Optional: from account */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('sharedAccountsSettleFromAccount')}</label>
                <select
                  value={settleFromAccountId}
                  onChange={e => setSettleFromAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">{t('sharedAccountsSettleNoAccount')}</option>
                  {ownAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance, undefined, numberLocale)}</option>
                  ))}
                </select>
              </div>

              {/* Optional: category */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('sharedAccountsSettleCategory')}</label>
                <select
                  value={settleCategoryId}
                  onChange={e => setSettleCategoryId(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">{t('sharedAccountsSettleNoCategory')}</option>
                  {categories.map(c => (
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
      </div>
    </div>
  );
}
