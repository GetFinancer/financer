'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import type { AccountWithBalance, Category, RecurringFrequency } from '@financer/shared';

interface RecurringQuickModalProps {
  initialName: string;
  initialType: 'income' | 'expense';
  initialAmount: string;
  initialAccountId: string;
  initialCategoryId: string;
  accounts: AccountWithBalance[];
  categories: Category[];
  onClose: () => void;
  onCreated: () => void;
}

export function RecurringQuickModal({
  initialName,
  initialType,
  initialAmount,
  initialAccountId,
  initialCategoryId,
  accounts,
  categories,
  onClose,
  onCreated,
}: RecurringQuickModalProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: initialName,
    type: initialType,
    amount: initialAmount,
    accountId: initialAccountId,
    categoryId: initialCategoryId,
    frequency: 'monthly' as RecurringFrequency,
    startDate: new Date().toISOString().split('T')[0],
  });

  const filteredCategories = categories.filter(c => c.type === form.type);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createRecurringTransaction({
        name: form.name,
        type: form.type,
        amount: Number(form.amount),
        accountId: Number(form.accountId),
        categoryId: form.categoryId ? Number(form.categoryId) : undefined,
        frequency: form.frequency,
        dayOfMonth: 1,
        dayOfWeek: 1,
        startDate: form.startDate,
        endDate: undefined,
      });
      onCreated();
    } catch {
      // keep open on error
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full md:max-w-lg glass-card-elevated rounded-t-2xl md:rounded-xl p-6 max-h-[90vh] overflow-y-auto safe-area-bottom">
        <div className="md:hidden w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">{t('recurringNewRecurring')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-background-surface-hover rounded-md transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('recurringName')}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              required
              autoFocus
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('txType')}</label>
            <div className="grid grid-cols-2 gap-2">
              {(['expense', 'income'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm({ ...form, type, categoryId: '' })}
                  className={`py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
                    form.type === type
                      ? type === 'expense' ? 'bg-expense text-white' : 'bg-income text-white'
                      : 'bg-background border border-border hover:bg-background-surface-hover'
                  }`}
                >
                  {type === 'expense' ? t('typeExpense') : t('typeIncome')}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('txAmount')}</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-4 py-4 text-2xl font-semibold rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-center"
                placeholder="0,00"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl text-muted-foreground">€</span>
            </div>
          </div>

          {/* Account */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('txAccount')}</label>
            <select
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              <option value="">{t('txSelectAccount')}</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('txCategory')}</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">{t('txNoCategory')}</option>
              {filteredCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('recurringFrequency')}</label>
            <select
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value as RecurringFrequency })}
              className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="monthly">{t('freqMonthly')}</option>
              <option value="weekly">{t('freqWeekly')}</option>
              <option value="quarterly">{t('freqQuarterly')}</option>
              <option value="yearly">{t('freqYearly')}</option>
            </select>
          </div>

          {/* Start date */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('txDate')}</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 nav-item-active rounded-full hover:opacity-90 active:scale-95 transition-all font-semibold text-lg disabled:opacity-50"
          >
            {saving ? '…' : t('save')}
          </button>
          <div style={{ height: '20px' }} />
        </form>
      </div>
    </div>
  );
}
