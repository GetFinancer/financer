'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type {
  RecurringTransactionWithDetails,
  Category,
  AccountWithBalance,
  CreateRecurringTransactionRequest,
  RecurringFrequency,
  RecurringOccurrence,
  CreateRecurringExceptionRequest,
} from '@financer/shared';
import { useTranslation } from '@/lib/i18n';

export default function RecurringPage() {
  const { t, numberLocale } = useTranslation();

  const frequencyLabels: Record<RecurringFrequency, string> = {
    daily: t('freqDaily'),
    weekly: t('freqWeekly'),
    monthly: t('freqMonthly'),
    bimonthly: t('freqBimonthly'),
    quarterly: t('freqQuarterly'),
    semiannually: t('freqSemiannually'),
    yearly: t('freqYearly'),
  };

  const weekdayLabels = [t('weekSunday'), t('weekMonday'), t('weekTuesday'), t('weekWednesday'), t('weekThursday'), t('weekFriday'), t('weekSaturday')];
  const [recurring, setRecurring] = useState<RecurringTransactionWithDetails[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  // Occurrences view state
  const [viewingOccurrences, setViewingOccurrences] = useState<RecurringTransactionWithDetails | null>(null);
  const [occurrences, setOccurrences] = useState<RecurringOccurrence[]>([]);
  const [occurrencesLoading, setOccurrencesLoading] = useState(false);

  // Exception edit state
  const [editingOccurrence, setEditingOccurrence] = useState<RecurringOccurrence | null>(null);
  const [exceptionForm, setExceptionForm] = useState<CreateRecurringExceptionRequest>({
    date: '',
    amount: undefined,
    note: '',
    skip: false,
  });

  const [form, setForm] = useState<CreateRecurringTransactionRequest>({
    name: '',
    accountId: undefined,
    categoryId: undefined,
    amount: 0,
    type: 'expense',
    frequency: 'monthly',
    dayOfWeek: 1,
    dayOfMonth: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: undefined,
  });

  useEffect(() => {
    loadData();
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showForm || viewingOccurrences || editingOccurrence) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showForm, viewingOccurrences, editingOccurrence]);

  async function loadData() {
    try {
      const [recurringData, categoriesData, accountsData] = await Promise.all([
        api.getRecurringTransactions(),
        api.getCategories(),
        api.getAccounts(),
      ]);
      setRecurring(recurringData);
      setCategories(categoriesData);
      setAccounts(accountsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({
      name: '',
      accountId: undefined,
      categoryId: undefined,
      amount: 0,
      type: 'expense',
      frequency: 'monthly',
      dayOfWeek: 1,
      dayOfMonth: 1,
      startDate: new Date().toISOString().split('T')[0],
      endDate: undefined,
    });
    setEditingId(null);
    setShowForm(false);
    setError('');
  }

  function handleEdit(item: RecurringTransactionWithDetails) {
    setForm({
      name: item.name,
      accountId: item.accountId,
      categoryId: item.categoryId,
      amount: item.amount,
      type: item.type,
      frequency: item.frequency,
      dayOfWeek: item.dayOfWeek ?? 1,
      dayOfMonth: item.dayOfMonth ?? 1,
      startDate: item.startDate,
      endDate: item.endDate,
    });
    setEditingId(item.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    try {
      if (editingId) {
        await api.updateRecurringTransaction(editingId, form);
      } else {
        await api.createRecurringTransaction(form);
      }
      resetForm();
      loadData();
    } catch (err: any) {
      setError(err.message || t('errorSaving'));
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(t('recurringConfirmDelete'))) return;

    try {
      await api.deleteRecurringTransaction(id);
      loadData();
    } catch (err: any) {
      setError(err.message || t('errorDeleting'));
    }
  }

  async function handleToggleActive(item: RecurringTransactionWithDetails) {
    try {
      await api.updateRecurringTransaction(item.id, { active: !item.active });
      loadData();
    } catch (err: any) {
      setError(err.message || t('errorUpdating'));
    }
  }

  // Load occurrences for a recurring transaction (next 12 months)
  async function handleViewOccurrences(item: RecurringTransactionWithDetails) {
    setViewingOccurrences(item);
    setOccurrencesLoading(true);

    const today = new Date();
    const from = today.toISOString().split('T')[0];
    const toDate = new Date(today);
    toDate.setMonth(toDate.getMonth() + 12);
    const to = toDate.toISOString().split('T')[0];

    try {
      const data = await api.getRecurringOccurrences(item.id, from, to);
      setOccurrences(data);
    } catch (err: any) {
      setError(err.message || t('errorLoading'));
    } finally {
      setOccurrencesLoading(false);
    }
  }

  function closeOccurrences() {
    setViewingOccurrences(null);
    setOccurrences([]);
  }

  function openExceptionEdit(occurrence: RecurringOccurrence) {
    setEditingOccurrence(occurrence);
    setExceptionForm({
      date: occurrence.date,
      amount: occurrence.exception?.amount ?? occurrence.originalAmount,
      note: occurrence.exception?.note ?? '',
      skip: occurrence.isSkipped,
    });
  }

  function closeExceptionEdit() {
    setEditingOccurrence(null);
    setExceptionForm({ date: '', amount: undefined, note: '', skip: false });
  }

  async function handleSaveException(e: React.FormEvent) {
    e.preventDefault();
    if (!viewingOccurrences || !editingOccurrence) return;

    try {
      const data: CreateRecurringExceptionRequest = {
        date: exceptionForm.date,
        amount: exceptionForm.skip ? undefined : exceptionForm.amount,
        note: exceptionForm.note || undefined,
        skip: exceptionForm.skip,
      };

      if (editingOccurrence.exception) {
        // Update existing exception
        await api.updateRecurringException(
          viewingOccurrences.id,
          editingOccurrence.exception.id,
          data
        );
      } else {
        // Create new exception
        await api.createRecurringException(viewingOccurrences.id, data);
      }

      // Reload occurrences
      closeExceptionEdit();
      await handleViewOccurrences(viewingOccurrences);
    } catch (err: any) {
      setError(err.message || t('errorSaving'));
    }
  }

  async function handleDeleteException() {
    if (!viewingOccurrences || !editingOccurrence?.exception) return;

    try {
      await api.deleteRecurringException(
        viewingOccurrences.id,
        editingOccurrence.exception.id
      );
      closeExceptionEdit();
      await handleViewOccurrences(viewingOccurrences);
    } catch (err: any) {
      setError(err.message || t('errorDeleting'));
    }
  }

  async function handleApplyToFuture() {
    if (!viewingOccurrences || !editingOccurrence) return;

    const amount = exceptionForm.amount ?? editingOccurrence.originalAmount;
    if (!amount || amount <= 0) {
      setError(t('confirmValidAmount'));
      return;
    }

    const formattedDate = new Date(editingOccurrence.date).toLocaleDateString(numberLocale);
    if (!confirm(t('confirmApplyFuture', { amount: amount.toFixed(2) + ' \u20AC', date: formattedDate }))) return;

    try {
      await api.updateRecurringAmountFromDate(viewingOccurrences.id, amount, editingOccurrence.date);
      closeExceptionEdit();
      closeOccurrences();
      loadData();
    } catch (err: any) {
      setError(err.message || t('errorSaving'));
    }
  }

  // Build hierarchical category list for dropdown
  const getHierarchicalCategories = () => {
    const typeFiltered = categories.filter(c => c.type === form.type);
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

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">{t('loading')}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('recurringTitle')}</h1>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            {t('new')}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
            {error}
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={resetForm}
            />

            {/* Modal Content */}
            <div className="relative w-full md:max-w-md glass-card-elevated rounded-t-2xl md:rounded-xl p-6 pb-20 max-h-[90vh] overflow-y-auto safe-area-bottom">
              {/* Mobile Handle */}
              <div className="md:hidden w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-4" />

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">
                  {editingId ? t('recurringEditRecurring') : t('recurringNewRecurring')}
                </h2>
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
                <div>
                  <label className="block text-sm font-medium mb-2">{t('recurringName')}</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={t('recurringNamePlaceholder')}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t('txAccount')}</label>
                  <select
                    value={form.accountId || ''}
                    onChange={(e) => setForm({ ...form, accountId: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">{t('recurringNoAccount')}</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t('txType')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: 'expense', categoryId: undefined })}
                      className={`py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
                        form.type === 'expense'
                          ? 'bg-expense text-white'
                          : 'bg-background border border-border hover:bg-background-surface-hover'
                      }`}
                    >
                      {t('typeExpense')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: 'income', categoryId: undefined })}
                      className={`py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
                        form.type === 'income'
                          ? 'bg-income text-white'
                          : 'bg-background border border-border hover:bg-background-surface-hover'
                      }`}
                    >
                      {t('typeIncome')}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t('txAmount')}</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={form.amount || ''}
                      onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary pr-10"
                      placeholder="0,00"
                      required
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">{'\u20AC'}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t('txCategory')}</label>
                  <select
                    value={form.categoryId || ''}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">{t('txNoCategory')}</option>
                    {hierarchicalCategories.map(({ category, isChild }) => (
                      <option key={category.id} value={category.id}>
                        {isChild ? `  \u2514 ${category.name}` : category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={`grid gap-4 ${form.frequency === 'weekly' || ['monthly', 'bimonthly', 'quarterly', 'semiannually', 'yearly'].includes(form.frequency) ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('recurringFrequency')}</label>
                    <select
                      value={form.frequency}
                      onChange={(e) => setForm({ ...form, frequency: e.target.value as RecurringFrequency })}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    >
                      {Object.entries(frequencyLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {form.frequency === 'weekly' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">{t('recurringWeekday')}</label>
                      <select
                        value={form.dayOfWeek ?? 1}
                        onChange={(e) => setForm({ ...form, dayOfWeek: parseInt(e.target.value) })}
                        className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {weekdayLabels.map((label, index) => (
                          <option key={index} value={index}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {['monthly', 'bimonthly', 'quarterly', 'semiannually', 'yearly'].includes(form.frequency) && (
                    <div>
                      <label className="block text-sm font-medium mb-2">{t('recurringDayOfMonth')}</label>
                      <select
                        value={form.dayOfMonth ?? 1}
                        onChange={(e) => setForm({ ...form, dayOfMonth: parseInt(e.target.value) })}
                        className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                          <option key={day} value={day}>
                            {day}.
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('recurringStartDate')}</label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">{t('recurringEndDate')}</label>
                    <input
                      type="date"
                      value={form.endDate || ''}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value || undefined })}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full py-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold text-lg mt-2"
                >
                  {editingId ? t('save') : t('create')}
                </button>
                {/* Spacer for bottom padding */}
                <div style={{ height: '40px' }} />
              </form>
            </div>
          </div>
        )}

        {/* List - Two Column Layout */}
        {recurring.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-muted-foreground">{t('recurringNoRecurring')}</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 text-primary hover:underline"
            >
              {t('recurringCreateFirst')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Expenses (Left) */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-expense">{t('recurringExpenses')}</h2>
              {recurring.filter(item => item.type === 'expense').length === 0 ? (
                <div className="glass-card p-4 text-center text-muted-foreground text-sm">
                  {t('recurringNoExpenses')}
                </div>
              ) : (
                recurring.filter(item => item.type === 'expense').map((item) => (
                  <div
                    key={item.id}
                    className={`glass-card p-4 ${!item.active ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-expense/20 text-expense">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-medium truncate">{item.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {frequencyLabels[item.frequency]}
                              {item.frequency === 'weekly' && item.dayOfWeek !== undefined && (
                                <> &middot; {weekdayLabels[item.dayOfWeek]}</>
                              )}
                              {['monthly', 'bimonthly', 'quarterly', 'semiannually', 'yearly'].includes(item.frequency) &&
                                item.dayOfMonth && <> &middot; {item.dayOfMonth}.</>}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {item.accountName && (
                                <span className="text-xs text-primary">{item.accountName}</span>
                              )}
                              {item.categoryName && (
                                <span
                                  className="px-2 py-0.5 rounded text-xs"
                                  style={{ backgroundColor: item.categoryColor || '#6b7280', color: '#fff' }}
                                >
                                  {item.categoryName}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="font-semibold whitespace-nowrap text-expense">
                            -{item.amount.toFixed(2)} {'\u20AC'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <button
                            onClick={() => handleToggleActive(item)}
                            className={`px-3 py-1.5 text-xs rounded-md font-medium ${
                              item.active ? 'bg-income/20 text-income' : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {item.active ? t('recurringActive') : t('recurringInactive')}
                          </button>
                          <button
                            onClick={() => handleViewOccurrences(item)}
                            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-sm text-primary hover:text-primary/80 hover:bg-primary/10 rounded-md transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleEdit(item)}
                            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-sm text-muted-foreground hover:text-foreground hover:bg-background rounded-md transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Income (Right) */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-income">{t('recurringIncome')}</h2>
              {recurring.filter(item => item.type === 'income').length === 0 ? (
                <div className="glass-card p-4 text-center text-muted-foreground text-sm">
                  {t('recurringNoIncome')}
                </div>
              ) : (
                recurring.filter(item => item.type === 'income').map((item) => (
                  <div
                    key={item.id}
                    className={`glass-card p-4 ${!item.active ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-income/20 text-income">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-medium truncate">{item.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {frequencyLabels[item.frequency]}
                              {item.frequency === 'weekly' && item.dayOfWeek !== undefined && (
                                <> &middot; {weekdayLabels[item.dayOfWeek]}</>
                              )}
                              {['monthly', 'bimonthly', 'quarterly', 'semiannually', 'yearly'].includes(item.frequency) &&
                                item.dayOfMonth && <> &middot; {item.dayOfMonth}.</>}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {item.accountName && (
                                <span className="text-xs text-primary">{item.accountName}</span>
                              )}
                              {item.categoryName && (
                                <span
                                  className="px-2 py-0.5 rounded text-xs"
                                  style={{ backgroundColor: item.categoryColor || '#6b7280', color: '#fff' }}
                                >
                                  {item.categoryName}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="font-semibold whitespace-nowrap text-income">
                            +{item.amount.toFixed(2)} {'\u20AC'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <button
                            onClick={() => handleToggleActive(item)}
                            className={`px-3 py-1.5 text-xs rounded-md font-medium ${
                              item.active ? 'bg-income/20 text-income' : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {item.active ? t('recurringActive') : t('recurringInactive')}
                          </button>
                          <button
                            onClick={() => handleViewOccurrences(item)}
                            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-sm text-primary hover:text-primary/80 hover:bg-primary/10 rounded-md transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleEdit(item)}
                            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-sm text-muted-foreground hover:text-foreground hover:bg-background rounded-md transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Occurrences Modal */}
        {viewingOccurrences && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={closeOccurrences} />
            <div className="relative w-full md:max-w-lg glass-card-elevated rounded-t-2xl md:rounded-xl p-6 max-h-[90vh] overflow-y-auto safe-area-bottom">
              <div className="md:hidden w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-4" />

              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold">{viewingOccurrences.name}</h2>
                  <p className="text-sm text-muted-foreground">{t('recurringUpcoming')}</p>
                </div>
                <button
                  onClick={closeOccurrences}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-background-surface-hover rounded-md transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {occurrencesLoading ? (
                <div className="text-center py-8 text-muted-foreground">{t('loading')}</div>
              ) : occurrences.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('recurringNoUpcoming')}
                </div>
              ) : (
                <div className="space-y-2">
                  {occurrences.map((occ) => (
                    <button
                      key={occ.date}
                      onClick={() => openExceptionEdit(occ)}
                      className={`w-full p-4 rounded-lg border text-left transition-colors ${
                        occ.isSkipped
                          ? 'bg-muted/50 border-border opacity-60'
                          : occ.isModified
                          ? 'bg-primary/10 border-primary/30 hover:bg-primary/20'
                          : 'bg-background border-border hover:bg-background-surface-hover'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            {new Date(occ.date).toLocaleDateString(numberLocale, {
                              weekday: 'short',
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                          {occ.note && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {occ.note}
                            </div>
                          )}
                          {occ.isModified && !occ.isSkipped && occ.effectiveAmount !== occ.originalAmount && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {t('recurringOriginalAmount')} {occ.originalAmount.toFixed(2)} {'\u20AC'}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          {occ.isSkipped ? (
                            <span className="text-muted-foreground line-through">
                              {occ.originalAmount.toFixed(2)} {'\u20AC'}
                            </span>
                          ) : (
                            <span className={`font-semibold ${
                              viewingOccurrences.type === 'income' ? 'text-income' : 'text-expense'
                            }`}>
                              {viewingOccurrences.type === 'income' ? '+' : '-'}
                              {occ.effectiveAmount.toFixed(2)} {'\u20AC'}
                            </span>
                          )}
                          {occ.isModified && (
                            <div className="text-xs text-primary mt-1">{t('recurringAdjusted')}</div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Exception Edit Modal */}
        {editingOccurrence && viewingOccurrences && (
          <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={closeExceptionEdit} />
            <div className="relative w-full md:max-w-md glass-card-elevated rounded-t-2xl md:rounded-xl p-6 max-h-[90vh] overflow-y-auto safe-area-bottom">
              <div className="md:hidden w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-4" />

              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold">{t('recurringAdjustPayment')}</h2>
                  <p className="text-sm text-muted-foreground">
                    {new Date(editingOccurrence.date).toLocaleDateString(numberLocale, {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <button
                  onClick={closeExceptionEdit}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-background-surface-hover rounded-md transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSaveException} className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-background rounded-lg border border-border">
                  <input
                    type="checkbox"
                    id="skip"
                    checked={exceptionForm.skip}
                    onChange={(e) => setExceptionForm({ ...exceptionForm, skip: e.target.checked })}
                    className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="skip" className="flex-1">
                    <div className="font-medium">{t('recurringSkipPayment')}</div>
                    <div className="text-sm text-muted-foreground">{t('recurringSkipDescription')}</div>
                  </label>
                </div>

                {!exceptionForm.skip && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {t('recurringAmountLabel', { amount: editingOccurrence.originalAmount.toFixed(2) + ' \u20AC' })}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={exceptionForm.amount ?? ''}
                        onChange={(e) => setExceptionForm({
                          ...exceptionForm,
                          amount: e.target.value ? parseFloat(e.target.value) : undefined
                        })}
                        className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary pr-10"
                        placeholder={editingOccurrence.originalAmount.toFixed(2)}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">{'\u20AC'}</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-2">{t('recurringNoteOptional')}</label>
                  <input
                    type="text"
                    value={exceptionForm.note}
                    onChange={(e) => setExceptionForm({ ...exceptionForm, note: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={t('recurringNotePlaceholder')}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  {editingOccurrence.exception && (
                    <button
                      type="button"
                      onClick={handleDeleteException}
                      className="px-4 py-3 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      {t('reset')}
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold"
                  >
                    {t('save')}
                  </button>
                </div>

                {/* Apply to future button */}
                {!exceptionForm.skip && (
                  <button
                    type="button"
                    onClick={handleApplyToFuture}
                    className="w-full py-3 bg-background border border-primary text-primary rounded-lg hover:bg-primary/10 transition-colors font-medium text-sm"
                  >
                    {t('recurringApplyToFuture')}
                  </button>
                )}

                {/* Spacer for bottom padding */}
                <div style={{ height: '40px' }} />
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
