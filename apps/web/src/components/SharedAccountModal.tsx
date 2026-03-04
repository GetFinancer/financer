'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { formatCurrency } from '@/lib/utils';
import type { SharedAccountInfo, TransactionWithDetails, SharedBalanceResult } from '@financer/shared';

interface Props {
  account: SharedAccountInfo;
  onClose: () => void;
  onDeleted: () => void;
}

type Tab = 'all' | 'me' | 'other';

export default function SharedAccountModal({ account, onClose, onDeleted }: Props) {
  const { t, locale, numberLocale } = useTranslation();

  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [balance, setBalance] = useState<SharedBalanceResult | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<{ token: string; expiresAt: string } | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleDate, setSettleDate] = useState(new Date().toISOString().slice(0, 10));
  const [settleTenant, setSettleTenant] = useState('');
  const [splitTxId, setSplitTxId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Detect current tenant from hostname (e.g., alice.getfinancer.com -> alice)
  const currentTenant = account.isOwner
    ? account.ownerTenant
    : (typeof window !== 'undefined' && window.location.hostname.includes('.')
      ? window.location.hostname.split('.')[0]
      : account.members[0]?.tenant ?? '');
  const otherMembers = account.isOwner
    ? account.members
    : [{ tenant: account.ownerTenant, displayName: account.ownerTenant, joinedAt: '' }, ...account.members.filter(m => m.tenant !== currentTenant)];

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

  const filteredTx = transactions.filter(tx => {
    if (tab === 'all') return true;
    if (tab === 'me') return !tx.addedBy || tx.addedBy === currentTenant;
    if (tab === 'other') return tx.addedBy && tx.addedBy !== currentTenant;
    return true;
  });

  async function handleCreateInvite() {
    try {
      const data = await api.createInvite(account.uuid);
      setInvite({ token: data.token, expiresAt: data.expiresAt });
      setShowInvite(true);
    } catch (e) {
      alert(t('errorSaving'));
    }
  }

  function handleCopyInvite() {
    if (!invite) return;
    navigator.clipboard.writeText(invite.token);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setShowInvite(false);
    }, 1500);
  }

  async function handleRemoveMember(memberTenant: string) {
    if (!confirm(t('sharedAccountsRemoveMemberConfirm').replace('{tenant}', memberTenant))) return;
    try {
      await api.removeMember(account.uuid, memberTenant);
      onDeleted(); // Refresh parent
      onClose();
    } catch (e) {
      alert(t('errorDeleting'));
    }
  }

  async function handleStopSharing() {
    if (!confirm(t('sharedAccountsStopSharingConfirm'))) return;
    try {
      await api.deleteSharedAccount(account.uuid);
      onDeleted();
      onClose();
    } catch (e) {
      alert(t('errorDeleting'));
    }
  }

  async function handleLeave() {
    if (!confirm(t('sharedAccountsLeaveConfirm'))) return;
    try {
      await api.removeMember(account.uuid, currentTenant);
      onDeleted();
      onClose();
    } catch (e) {
      alert(t('errorDeleting'));
    }
  }

  async function handleDeleteTx(txId: number) {
    if (!confirm(t('transactionsConfirmDelete'))) return;
    try {
      await api.deleteSharedTransaction(account.uuid, txId);
      loadData();
    } catch (e) {
      alert(t('errorDeleting'));
    }
  }

  async function handleSplitEqual(txId: number) {
    try {
      await api.splitTransaction(account.uuid, txId, { type: 'equal' });
      loadData();
    } catch (e) {
      alert(t('errorSaving'));
    }
  }

  async function handleSettleUp() {
    if (!settleAmount || isNaN(Number(settleAmount))) {
      alert(t('confirmValidAmount'));
      return;
    }
    try {
      await api.settleUp(account.uuid, Number(settleAmount), settleDate, settleTenant || undefined);
      setShowSettle(false);
      setSettleAmount('');
      loadData();
    } catch (e) {
      alert(t('errorSaving'));
    }
  }

  const otherMemberName = otherMembers[0]?.displayName ?? otherMembers[0]?.tenant ?? '?';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              {account.accountName}
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-normal">
                {t('sharedAccountsShared')}
              </span>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t('sharedAccountsOwner')}: {account.isOwner ? t('sharedAccountsYou') : account.ownerTenant}
              {' · '}
              {t('sharedAccountsMembers').replace('{count}', String(account.members.length))}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Balance Summary */}
        {balance && balance.balances.length > 0 && (
          <div className="px-6 py-3 border-b border-border bg-card/50">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                {balance.balances.map(b => (
                  <span key={b.tenant} className="mr-4">
                    {b.owes > 0
                      ? t('sharedAccountsOwes').replace('{name}', b.displayName ?? b.tenant).replace('{amount}', formatCurrency(b.owes, undefined, numberLocale))
                      : t('sharedAccountsOwesYou').replace('{name}', b.displayName ?? b.tenant).replace('{amount}', formatCurrency(Math.abs(b.owes), undefined, numberLocale))
                    }
                  </span>
                ))}
                {balance.totalUnsettled === 0 && (
                  <span className="text-green-500">{t('sharedAccountsSettled')}</span>
                )}
              </div>
              {balance.totalUnsettled !== 0 && (
                <button
                  onClick={() => {
                    setShowSettle(true);
                    setSettleAmount(String(Math.abs(balance.totalUnsettled)));
                    if (balance.balances[0]) setSettleTenant(balance.balances[0].tenant);
                  }}
                  className="text-sm px-3 py-1 nav-item-active rounded-full hover:opacity-90 transition-all"
                >
                  {t('sharedAccountsSettleUp')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Settle Up Form */}
        {showSettle && (
          <div className="px-6 py-3 border-b border-border bg-card">
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="number"
                step="0.01"
                value={settleAmount}
                onChange={e => setSettleAmount(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2 rounded-md border border-border bg-background text-sm"
                placeholder={t('sharedAccountsSettleAmount')}
              />
              <input
                type="date"
                value={settleDate}
                onChange={e => setSettleDate(e.target.value)}
                className="px-3 py-2 rounded-md border border-border bg-background text-sm"
              />
              <button onClick={handleSettleUp} className="px-3 py-2 nav-item-active rounded-md text-sm hover:opacity-90">
                {t('sharedAccountsSettleConfirm')}
              </button>
              <button onClick={() => setShowSettle(false)} className="text-sm text-muted-foreground hover:text-foreground">
                {t('cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          {(['all', 'me', 'other'] as Tab[]).map(tabKey => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === tabKey
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tabKey === 'all' && t('sharedAccountsTabAll')}
              {tabKey === 'me' && t('sharedAccountsTabByMe')}
              {tabKey === 'other' && t('sharedAccountsTabByOther').replace('{name}', otherMemberName)}
            </button>
          ))}
        </div>

        {/* Transaction List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">{t('loading')}</div>
          ) : filteredTx.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{t('sharedAccountsNoTransactions')}</div>
          ) : (
            filteredTx.map(tx => {
              const isMyTx = !tx.addedBy || tx.addedBy === currentTenant;
              return (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${tx.type === 'income' ? 'text-income' : 'text-expense'}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, undefined, numberLocale)}
                      </span>
                      <span className="text-sm truncate">{tx.description || tx.categoryName}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {tx.date} · {isMyTx ? t('sharedAccountsYou') : (tx.addedBy ?? account.ownerTenant)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {tx.type === 'expense' && (
                      <button
                        onClick={() => setSplitTxId(splitTxId === tx.id ? null : tx.id)}
                        className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-background rounded border border-transparent hover:border-border transition-colors"
                      >
                        {t('sharedAccountsSplitEqual')}
                      </button>
                    )}
                    {isMyTx && (
                      <button
                        onClick={() => handleDeleteTx(tx.id)}
                        className="text-xs px-2 py-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded border border-transparent hover:border-destructive/20 transition-colors"
                      >
                        {t('sharedAccountsDeleteTx')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-border p-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {account.isOwner && (
              <>
                <button
                  onClick={handleCreateInvite}
                  className="text-sm px-3 py-2 rounded-md border border-border hover:bg-card transition-colors"
                >
                  {t('sharedAccountsInviteCreate')}
                </button>
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
              <div className="bg-card border border-border rounded p-3 text-sm font-mono break-all select-all">
                {invite.token}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('sharedAccountsInviteExpires').replace('{date}', new Date(invite.expiresAt).toLocaleString(locale === 'de' ? 'de-DE' : 'en-US'))}
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
      </div>
    </div>
  );
}
