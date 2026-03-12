'use client';

import { useEffect, useState } from 'react';
import { AccountWithBalance, AccountType, CreateAccountRequest } from '@financer/shared';
import { api, isTrialExpiredError } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function AccountsPage() {
  const { t, numberLocale } = useTranslation();

  const accountTypes: { value: AccountType; label: string }[] = [
    { value: 'bank', label: t('accountTypeBank') },
    { value: 'cash', label: t('accountTypeCash') },
    { value: 'credit', label: t('accountTypeCredit') },
    { value: 'savings', label: t('accountTypeSavings') },
  ];

  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'bank' as AccountType,
    initialBalance: '',
    includeInBudget: true,
    isDefault: false,
    // Credit card specific
    billingDay: '20',
    paymentDay: '27',
    linkedAccountId: '' as string | number,
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      const data = await api.getAccounts();
      setAccounts(data);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      type: 'bank',
      initialBalance: '',
      includeInBudget: true,
      isDefault: false,
      billingDay: '20',
      paymentDay: '27',
      linkedAccountId: '',
    });
    setEditingId(null);
    setShowForm(false);
  }

  function handleEdit(account: AccountWithBalance) {
    setFormData({
      name: account.name,
      type: account.type,
      initialBalance: String(account.initialBalance),
      includeInBudget: account.includeInBudget,
      isDefault: account.isDefault,
      billingDay: account.billingDay ? String(account.billingDay) : '20',
      paymentDay: account.paymentDay ? String(account.paymentDay) : '27',
      linkedAccountId: account.linkedAccountId || '',
    });
    setEditingId(account.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const payload: CreateAccountRequest = {
        name: formData.name,
        type: formData.type as AccountType,
        initialBalance: formData.initialBalance ? Number(formData.initialBalance) : 0,
        includeInBudget: formData.type === 'credit' ? false : formData.includeInBudget,
        isDefault: formData.isDefault,
        // Credit card specific fields
        ...(formData.type === 'credit' && {
          billingDay: Number(formData.billingDay),
          paymentDay: Number(formData.paymentDay),
          linkedAccountId: formData.linkedAccountId ? Number(formData.linkedAccountId) : undefined,
        }),
      };

      if (editingId) {
        await api.updateAccount(editingId, payload);
      } else {
        await api.createAccount(payload);
      }

      resetForm();
      loadAccounts();
    } catch (error: unknown) {
      if (isTrialExpiredError(error)) {
        setSaveError(t('trialExpiredWriteBlocked'));
      } else {
        setSaveError(error instanceof Error ? error.message : t('errorSaving'));
      }
    }
  }

  function handleDelete(id: number) {
    setConfirmDialog({
      message: t('accountsConfirmDelete'),
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.deleteAccount(id);
          loadAccounts();
        } catch (error: unknown) {
          if (isTrialExpiredError(error)) {
            setSaveError(t('trialExpiredWriteBlocked'));
            return;
          }
          const msg = error instanceof Error ? error.message : '';
          if (msg.includes('Transaktionen vorhanden')) {
            // Second confirmation: force-delete with all transactions
            setConfirmDialog({
              message: t('accountsConfirmDeleteForce'),
              onConfirm: async () => {
                setConfirmDialog(null);
                try {
                  await api.deleteAccount(id, true);
                  loadAccounts();
                } catch (e: unknown) {
                  setSaveError(e instanceof Error ? e.message : t('accountsDeleteFailed'));
                }
              },
            });
          } else {
            setSaveError(msg || t('accountsDeleteFailed'));
          }
        }
      },
    });
  }

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  function AccountTypeIcon({ type, className = 'w-5 h-5' }: { type: string; className?: string }) {
    if (type === 'cash') return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    );
    if (type === 'credit') return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    );
    if (type === 'savings') return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    );
  }

  return (
    <>
      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
          confirmLabel={t('yes')}
          cancelLabel={t('cancel')}
        />
      )}
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('accountsTitle')}</h1>
            <p className="text-muted-foreground">
              {t('accountsTotalBalance')} <span className="font-semibold text-foreground">{formatCurrency(totalBalance, undefined, numberLocale)}</span>
            </p>
          </div>
          <button
            onClick={() => {
              if (showForm) resetForm();
              else setShowForm(true);
            }}
            className="self-start px-3 py-1.5 text-sm nav-item-active rounded-full hover:opacity-90 active:scale-95 transition-all"
          >
            {showForm ? t('cancel') : t('accountsNewAccount')}
          </button>
        </div>

        {saveError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex justify-between">
            {saveError}
            <button onClick={() => setSaveError('')} className="ml-2 opacity-60 hover:opacity-100">×</button>
          </div>
        )}

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
            <h2 className="font-semibold">{editingId ? t('accountsEditAccount') : t('accountsNewAccountTitle')}</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('accountsName')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={t('accountsNamePlaceholder')}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t('accountsType')}</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as AccountType })}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {accountTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {formData.type !== 'credit' && (
                <div>
                  <label className="block text-sm font-medium mb-2">{t('accountsInitialBalance')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.initialBalance}
                    onChange={(e) => setFormData({ ...formData, initialBalance: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>

            {/* Credit card specific fields */}
            {formData.type === 'credit' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('accountsBillingDay')}</label>
                  <select
                    value={formData.billingDay}
                    onChange={(e) => setFormData({ ...formData, billingDay: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>{day}.</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">{t('accountsBillingDayDescription')}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t('accountsPaymentDay')}</label>
                  <select
                    value={formData.paymentDay}
                    onChange={(e) => setFormData({ ...formData, paymentDay: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>{day}.</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">{t('accountsPaymentDayDescription')}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t('accountsLinkedAccount')}</label>
                  <select
                    value={formData.linkedAccountId}
                    onChange={(e) => setFormData({ ...formData, linkedAccountId: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">{t('accountsNoLinkedAccount')}</option>
                    {accounts.filter(a => a.type !== 'credit' && a.id !== editingId).map((account) => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">{t('accountsLinkedAccountDescription')}</p>
                </div>
              </div>
            )}

            {/* Include in budget checkbox - only for non-credit cards */}
            {formData.type !== 'credit' && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeInBudget"
                  checked={formData.includeInBudget}
                  onChange={(e) => setFormData({ ...formData, includeInBudget: e.target.checked })}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="includeInBudget" className="text-sm">
                  {t('accountsIncludeInBudget')}
                </label>
              </div>
            )}

            {/* Default account checkbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <label htmlFor="isDefault" className="text-sm">
                {t('accountsDefaultAccount')}
              </label>
            </div>

            <button
              type="submit"
              className="px-4 py-2 nav-item-active rounded-full hover:opacity-90 active:scale-95 transition-all"
            >
              {editingId ? t('update') : t('create')}
            </button>
          </form>
        )}

        {/* Account List */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">{t('loading')}</div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground bg-card rounded-lg border">
            {t('accountsNoAccounts')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <div key={account.id} className="glass-card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-muted-foreground flex-shrink-0">
                      <AccountTypeIcon type={account.type} className="w-5 h-5" />
                    </div>
                    <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      {account.name}
                      {account.isDefault && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                          {t('accountsDefault')}
                        </span>
                      )}
                      {account.sharedUuid && (
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                          {t('sharedAccountsShared')}
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {accountTypes.find(at => at.value === account.type)?.label}
                      {account.includeInBudget && (
                        <span className="ml-2 text-xs text-primary">• {t('accountsBudget')}</span>
                      )}
                    </p>
                    {account.type === 'credit' && account.billingDay && account.paymentDay && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('accountsBilling')} {account.billingDay}. | {t('accountsPayment')} {account.paymentDay}.
                        {account.linkedAccountName && (
                          <span className="ml-1">→ {account.linkedAccountName}</span>
                        )}
                      </p>
                    )}
                    </div>
                  </div>
                  <span className={`text-xl font-bold ${account.balance >= 0 ? 'text-income' : 'text-expense'}`}>
                    {formatCurrency(account.balance, undefined, numberLocale)}
                  </span>
                </div>

                <div className="flex gap-2 mt-2 flex-wrap">
                  <button
                    onClick={() => handleEdit(account)}
                    className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-sm text-muted-foreground hover:text-foreground hover:bg-background rounded-md border border-transparent hover:border-border transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    {t('edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(account.id)}
                    className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md border border-transparent hover:border-destructive/20 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {t('delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
