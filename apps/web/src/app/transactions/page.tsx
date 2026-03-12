'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { TransactionWithDetails, AccountWithBalance, Category, SharedAccountInfo } from '@financer/shared';
import { api, isTrialExpiredError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { RECURRING_HINTS, findSemanticCategory } from '@/components/CategoryCombobox';
import { RecurringQuickModal } from '@/components/RecurringQuickModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function TransactionsPage() {
  const { t, numberLocale } = useTranslation();
  const router = useRouter();
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sharedAccounts, setSharedAccounts] = useState<SharedAccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [saveError, setSaveError] = useState('');
  const [recurringQuick, setRecurringQuick] = useState<{ name: string; categoryId: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const autofillCategoryRef = useRef<string | null>(null); // tracks auto-filled categoryId
  const amountInputRef = useRef<HTMLInputElement>(null);
  // Form state
  const [formData, setFormData] = useState({
    accountId: '',
    categoryId: '',
    transferToAccountId: '',
    amount: '',
    type: 'expense' as 'income' | 'expense' | 'transfer',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadData();
  }, []);

  // Prevent body scroll when modal is open on mobile
  useEffect(() => {
    if (showForm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showForm]);

  async function loadData() {
    try {
      const [txs, accs, cats, sas] = await Promise.all([
        api.getTransactions(),
        api.getAccounts(),
        api.getCategories(),
        api.getSharedAccounts().catch(() => [] as SharedAccountInfo[]),
      ]);

      setAccounts(accs);
      setCategories(cats);
      setSharedAccounts(sas);

      // For shared accounts where the current user is a member (not owner),
      // transactions are stored in the owner's DB and won't appear in the regular list.
      // Load them separately and merge in.
      const memberSharedAccounts = sas.filter(sa => !sa.isOwner);
      let allTxs = txs;
      if (memberSharedAccounts.length > 0) {
        const sharedTxArrays = await Promise.all(
          memberSharedAccounts.map(sa =>
            api.getSharedAccountTransactions(sa.uuid)
              .then(list => list.map(tx => ({ ...tx, sharedUuid: sa.uuid })))
              .catch(() => [])
          )
        );
        const sharedTxs = sharedTxArrays.flat();
        // Merge and sort by date descending
        allTxs = [...txs, ...sharedTxs].sort((a, b) =>
          b.date.localeCompare(a.date) || b.id - a.id
        );
      }

      setTransactions(allTxs);

      // Set default account (prefer isDefault, fallback to first)
      if (accs.length > 0 && !formData.accountId) {
        const defaultAccount = accs.find(a => a.isDefault) || accs[0];
        setFormData(prev => ({ ...prev, accountId: String(defaultAccount.id) }));
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    const defaultAccount = accounts.find(a => a.isDefault) || accounts[0];
    setFormData({
      accountId: defaultAccount ? String(defaultAccount.id) : '',
      categoryId: '',
      transferToAccountId: '',
      amount: '',
      type: 'expense',
      description: '',
      date: new Date().toISOString().split('T')[0],
    });
    setEditingId(null);
    setShowForm(false);
  }

  function handleEdit(tx: TransactionWithDetails) {
    // tx.sharedUuid is set for member-loaded transactions (owner's DB);
    // fall back to checking the account's sharedUuid for owner transactions
    const txAccount = accounts.find(a => a.id === tx.accountId);
    const resolvedSharedUuid = tx.sharedUuid ?? (txAccount?.sharedUuid ? txAccount.sharedUuid : null);
    const accountId = resolvedSharedUuid ? `shared:${resolvedSharedUuid}` : String(tx.accountId);
    setFormData({
      accountId,
      categoryId: tx.categoryId ? String(tx.categoryId) : '',
      transferToAccountId: tx.transferToAccountId ? String(tx.transferToAccountId) : '',
      amount: String(tx.amount),
      type: tx.type,
      description: tx.description || '',
      date: tx.date,
    });
    setEditingId(tx.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError('');

    try {
      const sharedPrefix = 'shared:';
      if (formData.accountId.startsWith(sharedPrefix)) {
        const uuid = formData.accountId.slice(sharedPrefix.length);
        const txData = {
          categoryId: formData.categoryId ? Number(formData.categoryId) : undefined,
          amount: Number(formData.amount),
          type: formData.type as 'income' | 'expense',
          description: formData.description || undefined,
          date: formData.date,
        };
        if (editingId) {
          await api.updateSharedTransaction(uuid, editingId, txData);
        } else {
          await api.addSharedTransaction(uuid, txData);
        }
      } else {
        const payload = {
          accountId: Number(formData.accountId),
          categoryId: formData.type !== 'transfer' && formData.categoryId ? Number(formData.categoryId) : undefined,
          transferToAccountId: formData.type === 'transfer' && formData.transferToAccountId ? Number(formData.transferToAccountId) : undefined,
          amount: Number(formData.amount),
          type: formData.type,
          description: formData.description || undefined,
          date: formData.date,
        };
        if (editingId) {
          await api.updateTransaction(editingId, payload);
        } else {
          await api.createTransaction(payload);
        }
      }

      resetForm();
      loadData();
    } catch (error) {
      if (isTrialExpiredError(error)) {
        setSaveError(t('trialExpiredWriteBlocked'));
      } else {
        setSaveError(t('errorSaving'));
      }
    }
  }

  async function handleSubmitAndContinue() {
    setSaveError('');
    try {
      const sharedPrefix = 'shared:';
      if (formData.accountId.startsWith(sharedPrefix)) {
        const uuid = formData.accountId.slice(sharedPrefix.length);
        await api.addSharedTransaction(uuid, {
          categoryId: formData.categoryId ? Number(formData.categoryId) : undefined,
          amount: Number(formData.amount),
          type: formData.type as 'income' | 'expense',
          description: formData.description || undefined,
          date: formData.date,
        });
      } else {
      const payload = {
        accountId: Number(formData.accountId),
        categoryId: formData.categoryId ? Number(formData.categoryId) : undefined,
        amount: Number(formData.amount),
        type: formData.type,
        description: formData.description || undefined,
        date: formData.date,
      };
      await api.createTransaction(payload);
    }
    // Keep form open — reset only amount, description, category
    setFormData(prev => ({
      ...prev,
      categoryId: '',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
    }));
    loadData();
    setTimeout(() => amountInputRef.current?.focus(), 50);
  } catch (error) {
      if (isTrialExpiredError(error)) {
        setSaveError(t('trialExpiredWriteBlocked'));
      } else {
        setSaveError(t('errorSaving'));
      }
    }
  }

  function handleDelete(id: number) {
    setConfirmDialog({
      message: t('transactionsConfirmDelete'),
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.deleteTransaction(id);
          loadData();
        } catch (error) {
          setSaveError(isTrialExpiredError(error) ? t('trialExpiredWriteBlocked') : t('errorDeleting'));
        }
      },
    });
  }

  function toggleSelectMode() {
    setSelectMode(prev => !prev);
    setSelectedIds(new Set());
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTransactions.map(tx => tx.id)));
    }
  }

  function handleDeleteSelected() {
    const count = selectedIds.size;
    if (count === 0) return;
    setConfirmDialog({
      message: t('transactionsConfirmDeleteMultiple', { count: String(count) }),
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await Promise.all([...selectedIds].map(id => api.deleteTransaction(id)));
          setSelectMode(false);
          setSelectedIds(new Set());
          loadData();
        } catch (error) {
          setSaveError(isTrialExpiredError(error) ? t('trialExpiredWriteBlocked') : t('errorDeleting'));
        }
      },
    });
  }

  async function handleCreateCategoryFromDesc(name: string) {
    if (formData.type === 'transfer') return;
    try {
      const newCat = await api.createCategory({ name, type: formData.type });
      setCategories(prev => [...prev, newCat]);
      setFormData(prev => ({ ...prev, categoryId: String(newCat.id) }));
    } catch { /* ignore */ }
  }

  async function openRecurringQuick(name: string) {
    let catId = '';
    if (formData.type !== 'transfer') {
      const existing = categories.find(c =>
        c.name.toLowerCase() === name.toLowerCase() && c.type === formData.type
      );
      const cat = existing ?? await api.createCategory({ name, type: formData.type }).catch(() => null);
      if (cat) {
        if (!existing) setCategories(prev => [...prev, cat]);
        catId = String(cat.id);
      }
    }
    setRecurringQuick({ name, categoryId: catId });
  }

  function handleDescriptionChange(val: string) {
    const descLower = val.trim().toLowerCase();
    const updates: { description: string; categoryId?: string } = { description: val };
    const currentIsAutofill = autofillCategoryRef.current !== null && formData.categoryId === autofillCategoryRef.current;

    if (!val.trim()) {
      if (currentIsAutofill) { updates.categoryId = ''; autofillCategoryRef.current = null; }
    } else if (!formData.categoryId || currentIsAutofill) {
      const exact = hierarchicalCategories.find(({ category }) =>
        category.name.toLowerCase() === descLower
      );
      if (exact) {
        updates.categoryId = String(exact.category.id);
        autofillCategoryRef.current = String(exact.category.id);
      } else if (currentIsAutofill) {
        updates.categoryId = '';
        autofillCategoryRef.current = null;
      }
    }
    setFormData(prev => ({ ...prev, ...updates }));
  }

  // Build hierarchical category list for dropdown
  const getHierarchicalCategories = () => {
    const typeFiltered = categories.filter(
      c => c.type === formData.type || formData.type === 'transfer'
    );
    const parents = typeFiltered.filter(c => !c.parentId);
    const result: Array<{ category: typeof categories[0]; isChild: boolean }> = [];

    parents.forEach(parent => {
      result.push({ category: parent, isChild: false });
      const children = typeFiltered.filter(c => c.parentId === parent.id);
      children.forEach(child => {
        result.push({ category: child, isChild: true });
      });
    });

    return result;
  };

  const hierarchicalCategories = getHierarchicalCategories();

  // Accounts that belong to a shared account owned by this user — shown in "Geteilte Konten" group only
  const sharedOwnedAccountIds = new Set(
    sharedAccounts.filter(sa => sa.isOwner).map(sa => Number(sa.accountId))
  );
  const regularAccounts = accounts.filter(a => !sharedOwnedAccountIds.has(Number(a.id)));

  function translateDesc(desc: string | undefined): string | undefined {
    if (!desc) return desc;
    if (desc === 'Eigenanteil / Own share' || desc === 'Eigenanteil') return t('sharedAccountsEigenanteil');
    if (desc.startsWith('Eigenanteil / Own share: ')) return t('sharedAccountsEigenanteil') + ': ' + desc.slice('Eigenanteil / Own share: '.length);
    if (desc.startsWith('Eigenanteil: ')) return t('sharedAccountsEigenanteil') + ': ' + desc.slice('Eigenanteil: '.length);
    if (desc.startsWith('Schuldenausgleich / Settlement')) {
      const match = desc.match(/\(([^)]+)\)$/);
      return match ? `${t('sharedAccountsSettlement')} (${match[1]})` : t('sharedAccountsSettlement');
    }
    return desc;
  }

  // Filter transactions by search term
  const filteredTransactions = transactions.filter(tx => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      tx.description?.toLowerCase().includes(term) ||
      tx.categoryName?.toLowerCase().includes(term) ||
      tx.accountName?.toLowerCase().includes(term)
    );
  });

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
          <h1 className="text-2xl font-bold">{t('transactionsTitle')}</h1>
          <div className="flex items-center gap-2">
            {selectMode ? (
              <>
                {selectedIds.size > 0 && (
                  <button
                    onClick={handleDeleteSelected}
                    className="px-3 py-1.5 text-sm bg-destructive text-white rounded-full hover:opacity-90 active:scale-95 transition-all font-medium"
                  >
                    {t('transactionsDeleteSelected', { count: String(selectedIds.size) })}
                  </button>
                )}
                <button
                  onClick={toggleSelectMode}
                  className="px-3 py-1.5 text-sm border border-border rounded-full hover:bg-background-surface-hover active:scale-95 transition-all"
                >
                  {t('transactionsCancelSelect')}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={toggleSelectMode}
                  className="px-3 py-1.5 text-sm border border-border rounded-full hover:bg-background-surface-hover active:scale-95 transition-all"
                >
                  {t('transactionsSelect')}
                </button>
                <button
                  onClick={() => setShowForm(true)}
                  className="px-3 py-1.5 text-sm nav-item-active rounded-full hover:opacity-90 active:scale-95 transition-all"
                >
                  {t('newTransaction')}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search Field */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('transactionsSearch')}
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={resetForm}
            />

            {/* Modal Content */}
            <div className="relative w-full md:max-w-lg glass-card-elevated rounded-t-2xl md:rounded-xl p-6 max-h-[90vh] overflow-y-auto safe-area-bottom">
              {/* Mobile Handle */}
              <div className="md:hidden w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-4" />

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">{editingId ? t('transactionsEditTransaction') : t('transactionsNewTransaction')}</h2>
                <button
                  onClick={resetForm}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-background-surface-hover rounded-md transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Type Buttons */}
                <div>
                  <label className="block text-sm font-medium mb-2">{t('txType')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['expense', 'income', 'transfer'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, type, categoryId: '' })}
                        className={`py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
                          formData.type === type
                            ? type === 'expense'
                              ? 'bg-expense text-white'
                              : type === 'income'
                              ? 'bg-income text-white'
                              : 'bg-primary text-primary-foreground'
                            : 'bg-background border border-border hover:bg-background-surface-hover'
                        }`}
                      >
                        {type === 'expense' ? t('typeExpense') : type === 'income' ? t('typeIncome') : t('typeTransfer')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount - Large Input */}
                <div>
                  <label className="block text-sm font-medium mb-2">{t('txAmount')}</label>
                  <div className="relative">
                    <input
                      ref={amountInputRef}
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full px-4 py-4 text-2xl font-semibold rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-center"
                      placeholder="0,00"
                      required
                      autoFocus
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl text-muted-foreground">
                      €
                    </span>
                  </div>
                </div>

                {/* Account */}
                <div>
                  <label className="block text-sm font-medium mb-2">{t('txAccount')}</label>
                  <select
                    value={formData.accountId}
                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="">{t('txSelectAccount')}</option>
                    {sharedAccounts.length > 0 ? (
                      <>
                        <optgroup label={t('txOwnAccountGroup')}>
                          {regularAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label={t('txSharedAccountGroup')}>
                          {sharedAccounts.map((sa) => (
                            <option key={sa.uuid} value={`shared:${sa.uuid}`}>{sa.accountName}</option>
                          ))}
                        </optgroup>
                      </>
                    ) : (
                      accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))
                    )}
                  </select>
                </div>

                {/* Description — between Account and Category */}
                <div>
                  <label className="block text-sm font-medium mb-2">{t('txDescription')}</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={t('optional')}
                  />
                  {/* Smart category / recurring suggestions */}
                  {(() => {
                    const raw = formData.description.trim();
                    const desc = raw.toLowerCase();
                    if (!desc || formData.type === 'transfer') return null;
                    // Already auto-filled — no chip needed
                    if (formData.categoryId) return null;
                    if (raw.length < 2) return null;

                    const isRecurring = RECURRING_HINTS.has(desc) ||
                      (desc.length >= 3 && Array.from(RECURRING_HINTS).some(h => h.startsWith(desc)));

                    if (isRecurring) {
                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => openRecurringQuick(raw)}
                            className="mt-1.5 flex items-center gap-1.5 text-xs text-secondary/80 hover:text-secondary transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            {t('createAsRecurring')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCreateCategoryFromDesc(raw)}
                            className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                            {t('createAsCategory')} „{raw}"
                          </button>
                        </>
                      );
                    }

                    // Uncertain semantic match (e.g. "miete" → "Wohnen")
                    const semantic = findSemanticCategory(desc, hierarchicalCategories.map(h => h.category));
                    if (semantic) {
                      return (
                        <button
                          type="button"
                          onClick={() => { setFormData(prev => ({ ...prev, categoryId: String(semantic.id) })); autofillCategoryRef.current = null; }}
                          className="mt-1.5 flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          {semantic.name}?
                        </button>
                      );
                    }

                    return (
                      <button
                        type="button"
                        onClick={() => handleCreateCategoryFromDesc(raw)}
                        className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        {t('createAsCategory')} „{raw}"
                      </button>
                    );
                  })()}
                </div>

                {/* Category */}
                {formData.type !== 'transfer' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('txCategory')}</label>
                    <select
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">{t('txNoCategory')}</option>
                      {hierarchicalCategories.map(({ category, isChild }) => (
                        <option key={category.id} value={category.id}>
                          {isChild ? `  └ ${category.name}` : category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Transfer Target Account */}
                {formData.type === 'transfer' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('txTargetAccount')}</label>
                    <select
                      value={formData.transferToAccountId}
                      onChange={(e) => setFormData({ ...formData, transferToAccountId: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    >
                      <option value="">{t('txSelectTargetAccount') || t('txSelectAccount')}</option>
                      {accounts
                        .filter(a => String(a.id) !== formData.accountId)
                        .map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium mb-2">{t('txDate')}</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                {/* Error */}
                {saveError && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                    {saveError}
                  </div>
                )}

                {/* Submit Buttons */}
                <button
                  type="submit"
                  className="w-full py-4 nav-item-active rounded-full hover:opacity-90 active:scale-95 transition-all font-semibold text-lg"
                >
                  {editingId ? t('update') : t('save')}
                </button>
                {!editingId && (
                  <button
                    type="button"
                    onClick={handleSubmitAndContinue}
                    className="w-full py-3 text-sm text-muted-foreground border border-border rounded-full hover:bg-white/5 transition-colors"
                  >
                    {t('saveAndAddAnother')}
                  </button>
                )}
                {/* Spacer for bottom nav + safe area */}
                <div style={{ height: '80px' }} />
              </form>
            </div>
          </div>
        )}

        {/* Transaction List */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">{t('loading')}</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground bg-card rounded-lg border">
            {t('transactionsNoTransactions')}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground bg-card rounded-lg border">
            {t('transactionsNoResults', { term: searchTerm })}
          </div>
        ) : (
          <div className="glass-card divide-y divide-border/50">
            {selectMode && filteredTransactions.length > 1 && (
              <div className="p-3 px-4 flex items-center gap-3 border-b border-border bg-background-surface-hover/50">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredTransactions.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size > 0 ? `${selectedIds.size} / ${filteredTransactions.length}` : t('transactionsSelect')}
                </span>
              </div>
            )}
            {filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className={`p-4 flex items-center gap-3 hover:bg-background-surface-hover active:bg-background-surface-hover ${selectMode ? 'cursor-pointer' : ''} ${selectMode && selectedIds.has(tx.id) ? 'bg-primary/5' : ''}`}
                onClick={selectMode ? () => toggleSelect(tx.id) : undefined}
              >
                {/* Checkbox in select mode */}
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(tx.id)}
                    onChange={() => toggleSelect(tx.id)}
                    onClick={e => e.stopPropagation()}
                    className="w-4 h-4 accent-primary cursor-pointer flex-shrink-0"
                  />
                )}

                {/* Icon */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  tx.type === 'income' ? 'bg-income/20 text-income' :
                  tx.type === 'transfer' ? 'bg-primary/20 text-primary' :
                  'bg-expense/20 text-expense'
                }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {tx.type === 'income' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                    ) : tx.type === 'transfer' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                    )}
                  </svg>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {translateDesc(tx.description) || tx.categoryName || t('txTransaction')}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {tx.type === 'transfer' && tx.transferToAccountName
                      ? `${tx.accountName} → ${tx.transferToAccountName} • ${formatDate(tx.date, numberLocale)}`
                      : `${tx.accountName} • ${formatDate(tx.date, numberLocale)}`}
                    {tx.categoryName && (
                      <span
                        className="ml-2 px-1.5 py-0.5 text-xs rounded"
                        style={{
                          backgroundColor: tx.categoryColor ? `${tx.categoryColor}20` : undefined,
                          color: tx.categoryColor || undefined
                        }}
                      >
                        {tx.parentCategoryName ? `${tx.parentCategoryName} › ${tx.categoryName}` : tx.categoryName}
                      </span>
                    )}
                  </p>
                </div>

                {/* Amount & Actions */}
                <div className="flex flex-col items-end gap-1">
                  <span className={`font-semibold whitespace-nowrap ${
                    tx.type === 'income' ? 'text-income' :
                    tx.type === 'transfer' ? 'text-primary' :
                    'text-expense'
                  }`}>
                    {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '' : '-'}
                    {formatCurrency(tx.amount, 'EUR', numberLocale)}
                  </span>
                  {!selectMode && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(tx)}
                        className="flex items-center gap-1.5 px-2 py-1.5 min-h-[36px] text-xs text-muted-foreground hover:text-foreground hover:bg-background-surface-hover rounded-md transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span className="hidden sm:inline">{t('edit')}</span>
                      </button>
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="flex items-center gap-1.5 px-2 py-1.5 min-h-[36px] text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span className="hidden sm:inline">{t('delete')}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {recurringQuick && (
        <RecurringQuickModal
          initialName={recurringQuick.name}
          initialType={formData.type === 'transfer' ? 'expense' : formData.type}
          initialAmount={formData.amount}
          initialAccountId={formData.accountId}
          initialCategoryId={recurringQuick.categoryId}
          accounts={accounts}
          categories={categories}
          onClose={() => setRecurringQuick(null)}
          onCreated={() => { setRecurringQuick(null); loadData(); }}
        />
      )}
    </>
  );
}
