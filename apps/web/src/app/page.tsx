'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { DashboardSummary, RecurringInstanceWithDetails, CreateRecurringExceptionRequest, CreditCardBillWithDetails, TransactionWithDetails, AccountWithBalance, Category } from '@financer/shared';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

export default function Dashboard() {
  const { t, numberLocale } = useTranslation();

  const monthNames = [
    t('monthJanuary'), t('monthFebruary'), t('monthMarch'), t('monthApril'),
    t('monthMay'), t('monthJune'), t('monthJuly'), t('monthAugust'),
    t('monthSeptember'), t('monthOctober'), t('monthNovember'), t('monthDecember')
  ];
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Month selector state
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Recurring instances state
  const [instances, setInstances] = useState<RecurringInstanceWithDetails[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(true);

  // Credit card bills state
  const [creditCardBills, setCreditCardBills] = useState<CreditCardBillWithDetails[]>([]);

  // Hide completed toggle
  const [hideCompleted, setHideCompleted] = useState(false);

  // Search for recurring transactions (desktop only)
  const [recurringSearch, setRecurringSearch] = useState('');

  // Edit instance modal state
  const [editingInstance, setEditingInstance] = useState<RecurringInstanceWithDetails | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');

  // Recent transactions state
  const [recentTransactions, setRecentTransactions] = useState<TransactionWithDetails[]>([]);
  const [transactionLimit, setTransactionLimit] = useState(10);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Transaction modal state (for both new and edit)
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithDetails | null>(null);
  const [txFormData, setTxFormData] = useState({
    accountId: '',
    categoryId: '',
    amount: '',
    type: 'expense' as 'income' | 'expense' | 'transfer',
    description: '',
    date: new Date().toISOString().split('T')[0],
    transferToAccountId: '',
  });

  // Card visibility settings
  const [cardVisibility, setCardVisibility] = useState<Record<string, boolean>>({
    totalBalance: true,
    monthlyIncome: true,
    monthlyExpenses: true,
    remainingBudget: true,
  });
  const [showCardSettings, setShowCardSettings] = useState(false);

  // Swipe-to-dismiss state
  const [modalDragY, setModalDragY] = useState(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);

  // Load settings from localStorage
  useEffect(() => {
    const savedCards = localStorage.getItem('dashboardCardVisibility');
    if (savedCards) {
      try {
        setCardVisibility(JSON.parse(savedCards));
      } catch (e) {
        // Ignore parse errors
      }
    }
    const savedHideCompleted = localStorage.getItem('dashboardHideCompleted');
    if (savedHideCompleted) {
      setHideCompleted(savedHideCompleted === 'true');
    }
  }, []);

  // Save card visibility to localStorage
  function updateCardVisibility(key: string, visible: boolean) {
    const newVisibility = { ...cardVisibility, [key]: visible };
    setCardVisibility(newVisibility);
    localStorage.setItem('dashboardCardVisibility', JSON.stringify(newVisibility));
  }

  // Close modals with Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showTransactionModal) {
          closeTransactionModal();
        } else if (editingInstance) {
          closeEditInstance();
        } else if (showMonthPicker) {
          setShowMonthPicker(false);
        } else if (showCardSettings) {
          setShowCardSettings(false);
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showTransactionModal, editingInstance, showMonthPicker, showCardSettings]);

  useEffect(() => {
    loadDashboard();
    loadAccountsAndCategories();
  }, []);

  useEffect(() => {
    loadInstances();
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    loadRecentTransactions();
  }, [transactionLimit, selectedYear, selectedMonth]);

  async function loadDashboard() {
    try {
      const data = await api.getDashboardSummary();
      setSummary(data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAccountsAndCategories() {
    try {
      const [accs, cats] = await Promise.all([
        api.getAccounts(),
        api.getCategories(),
      ]);
      setAccounts(accs);
      setCategories(cats);
    } catch (error) {
      console.error('Failed to load accounts/categories:', error);
    }
  }

  async function loadRecentTransactions() {
    try {
      // Filter by selected month
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const txs = await api.getTransactions({ limit: transactionLimit, startDate, endDate });
      setRecentTransactions(txs);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  }

  async function loadInstances(showLoading = true) {
    if (showLoading) setLoadingInstances(true);
    try {
      const [instancesData, billsData] = await Promise.all([
        api.getRecurringInstances(selectedYear, selectedMonth),
        api.getCreditCardBills(selectedYear, selectedMonth),
      ]);
      setInstances(instancesData);
      setCreditCardBills(billsData);
    } catch (error) {
      console.error('Failed to load recurring instances:', error);
    } finally {
      if (showLoading) setLoadingInstances(false);
    }
  }

  async function handleToggleInstance(id: number) {
    try {
      await api.toggleRecurringInstance(id);
      loadInstances(false);
      loadDashboard();
      loadRecentTransactions();
    } catch (error) {
      console.error('Failed to toggle instance:', error);
    }
  }

  async function handleToggleCreditCardBill(id: number) {
    try {
      await api.toggleCreditCardBill(id);
      loadInstances(false);
      loadDashboard();
      loadRecentTransactions();
    } catch (error) {
      console.error('Failed to toggle credit card bill:', error);
    }
  }

  function openEditInstance(instance: RecurringInstanceWithDetails) {
    setEditingInstance(instance);
    setEditAmount(String(instance.amount));
    setEditNote(instance.exceptionNote || '');
  }

  function closeEditInstance() {
    setEditingInstance(null);
    setEditAmount('');
    setEditNote('');
  }

  async function handleSaveInstanceException() {
    if (!editingInstance) return;

    try {
      const amount = parseFloat(editAmount);
      if (isNaN(amount) || amount <= 0) {
        alert(t('confirmValidAmount'));
        return;
      }

      const data: CreateRecurringExceptionRequest = {
        date: editingInstance.dueDate,
        amount: amount,
        note: editNote || undefined,
      };

      if (editingInstance.exceptionId) {
        // Update existing exception
        await api.updateRecurringException(editingInstance.recurringId, editingInstance.exceptionId, {
          amount: amount,
          note: editNote || undefined,
        });
      } else {
        // Create new exception
        await api.createRecurringException(editingInstance.recurringId, data);
      }

      closeEditInstance();
      loadInstances(false);
      loadDashboard();
    } catch (error) {
      console.error('Failed to save exception:', error);
      alert(t('errorSaving'));
    }
  }

  async function handleResetInstanceException() {
    if (!editingInstance || !editingInstance.exceptionId) return;

    if (!confirm(t('confirmResetException'))) return;

    try {
      await api.deleteRecurringException(editingInstance.recurringId, editingInstance.exceptionId);
      closeEditInstance();
      loadInstances(false);
      loadDashboard();
    } catch (error) {
      console.error('Failed to reset exception:', error);
      alert(t('errorResetting'));
    }
  }

  async function handleApplyToFuture() {
    if (!editingInstance) return;

    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      alert(t('confirmValidAmount'));
      return;
    }

    if (!confirm(t('confirmApplyFuture', { amount: formatCurrency(amount, 'EUR', numberLocale), date: formatDate(editingInstance.dueDate, numberLocale) }))) return;

    try {
      await api.updateRecurringAmountFromDate(editingInstance.recurringId, amount, editingInstance.dueDate);
      closeEditInstance();
      loadInstances(false);
      loadDashboard();
    } catch (error) {
      console.error('Failed to apply to future:', error);
      alert(t('errorApplying'));
    }
  }

  // Transaction modal functions
  function openNewTransaction() {
    // Find default account
    const defaultAccount = accounts.find(a => a.isDefault) || accounts[0];
    setTxFormData({
      accountId: defaultAccount ? String(defaultAccount.id) : '',
      categoryId: '',
      amount: '',
      type: 'expense',
      description: '',
      date: new Date().toISOString().split('T')[0],
      transferToAccountId: '',
    });
    setEditingTransaction(null);
    setShowTransactionModal(true);
  }

  function openEditTransaction(tx: TransactionWithDetails) {
    setTxFormData({
      accountId: String(tx.accountId),
      categoryId: tx.categoryId ? String(tx.categoryId) : '',
      amount: String(tx.amount),
      type: tx.type,
      description: tx.description || '',
      date: tx.date,
      transferToAccountId: tx.transferToAccountId ? String(tx.transferToAccountId) : '',
    });
    setEditingTransaction(tx);
    setShowTransactionModal(true);
  }

  function closeTransactionModal() {
    setShowTransactionModal(false);
    setEditingTransaction(null);
    setTxFormData({
      accountId: '',
      categoryId: '',
      amount: '',
      type: 'expense',
      description: '',
      date: new Date().toISOString().split('T')[0],
      transferToAccountId: '',
    });
  }

  async function handleSaveTransaction(e: React.FormEvent) {
    e.preventDefault();

    try {
      const payload = {
        accountId: Number(txFormData.accountId),
        categoryId: txFormData.categoryId ? Number(txFormData.categoryId) : undefined,
        amount: Number(txFormData.amount),
        type: txFormData.type,
        description: txFormData.description || undefined,
        date: txFormData.date,
        transferToAccountId: txFormData.type === 'transfer' && txFormData.transferToAccountId
          ? Number(txFormData.transferToAccountId)
          : undefined,
      };

      if (editingTransaction) {
        await api.updateTransaction(editingTransaction.id, payload);
      } else {
        await api.createTransaction(payload);
      }
      closeTransactionModal();
      loadRecentTransactions();
      loadDashboard();
    } catch (error) {
      console.error('Failed to save transaction:', error);
      alert(t('errorSaving'));
    }
  }

  async function handleDeleteTransaction(id: number) {
    if (!confirm(t('transactionsConfirmDelete'))) return;

    try {
      await api.deleteTransaction(id);
      closeTransactionModal();
      loadRecentTransactions();
      loadDashboard();
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      alert(t('errorDeleting'));
    }
  }

  // Build hierarchical category list for dropdown
  const getHierarchicalCategories = () => {
    const typeFiltered = categories.filter(
      c => c.type === txFormData.type || txFormData.type === 'transfer'
    );
    const parents = typeFiltered.filter(c => !c.parentId);
    const result: Array<{ category: typeof categories[0]; isChild: boolean; parentName?: string }> = [];

    parents.forEach(parent => {
      result.push({ category: parent, isChild: false });
      const children = typeFiltered.filter(c => c.parentId === parent.id);
      children.forEach(child => {
        result.push({ category: child, isChild: true, parentName: parent.name });
      });
    });

    return result;
  };

  const hierarchicalCategories = getHierarchicalCategories();

  // Swipe-to-dismiss handlers
  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = true;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isDragging.current) return;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    // Only allow dragging down
    if (deltaY > 0) {
      setModalDragY(deltaY);
    }
  }

  function handleTouchEnd(closeModal: () => void) {
    isDragging.current = false;
    // If dragged more than 100px, close the modal
    if (modalDragY > 100) {
      closeModal();
    }
    setModalDragY(0);
  }

  function goToPreviousMonth() {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  }

  function goToNextMonth() {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  }

  function selectMonth(year: number, month: number) {
    setSelectedYear(year);
    setSelectedMonth(month);
    setShowMonthPicker(false);
  }

  // Calculate planned totals (including credit card bills as expenses)
  const creditCardTotal = creditCardBills.reduce((sum, b) => sum + b.amount, 0);
  const creditCardCompleted = creditCardBills.filter(b => b.completed).reduce((sum, b) => sum + b.amount, 0);

  const plannedIncome = instances
    .filter(i => i.type === 'income')
    .reduce((sum, i) => sum + i.amount, 0);
  const plannedExpenses = instances
    .filter(i => i.type === 'expense')
    .reduce((sum, i) => sum + i.amount, 0) + creditCardTotal;
  const completedIncome = instances
    .filter(i => i.type === 'income' && i.completed)
    .reduce((sum, i) => sum + i.amount, 0);
  const completedExpenses = instances
    .filter(i => i.type === 'expense' && i.completed)
    .reduce((sum, i) => sum + i.amount, 0) + creditCardCompleted;

  // Calculate pending (not completed) amounts
  const pendingIncome = instances
    .filter(i => i.type === 'income' && !i.completed)
    .reduce((sum, i) => sum + i.amount, 0);
  const pendingExpenses = instances
    .filter(i => i.type === 'expense' && !i.completed)
    .reduce((sum, i) => sum + i.amount, 0) + (creditCardTotal - creditCardCompleted);

  // Calculate remaining budget: current budget balance + pending income - pending expenses
  const remainingBudget = summary
    ? summary.budgetBalance + pendingIncome - pendingExpenses
    : 0;

  return (
    <>
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">{t('loading')}</div>
      ) : !summary ? (
        <div className="text-center py-8 text-muted-foreground">{t('dashboardErrorLoading')}</div>
      ) : (
        <div className="space-y-12">
          {/* Financial Overview Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{t('dashboardFinancialOverview')}</h2>
              <div className="relative">
                <button
                  onClick={() => setShowCardSettings(!showCardSettings)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-background-surface-hover rounded-md transition-colors"
                  title={t('dashboardToggleCards')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>

                {/* Settings Dropdown */}
                {showCardSettings && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowCardSettings(false)} />
                    <div className="absolute right-0 top-full mt-2 z-50 glass-card-elevated p-4 min-w-[220px] space-y-3">
                      <p className="text-sm font-medium text-muted-foreground mb-2">{t('dashboardVisibleCards')}</p>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cardVisibility.totalBalance}
                          onChange={(e) => updateCardVisibility('totalBalance', e.target.checked)}
                          className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary"
                        />
                        <span className="text-sm">{t('dashboardTotalBalance')}</span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cardVisibility.monthlyIncome}
                          onChange={(e) => updateCardVisibility('monthlyIncome', e.target.checked)}
                          className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary"
                        />
                        <span className="text-sm">{t('dashboardMonthlyIncome')}</span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cardVisibility.monthlyExpenses}
                          onChange={(e) => updateCardVisibility('monthlyExpenses', e.target.checked)}
                          className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary"
                        />
                        <span className="text-sm">{t('dashboardMonthlyExpenses')}</span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cardVisibility.remainingBudget}
                          onChange={(e) => updateCardVisibility('remainingBudget', e.target.checked)}
                          className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary"
                        />
                        <span className="text-sm">{t('dashboardRemaining')}</span>
                      </label>

                      {summary.accounts.length > 0 && (
                        <>
                          <div className="border-t border-border pt-3 mt-3">
                            <p className="text-xs text-muted-foreground mb-2">{t('dashboardAccounts')}</p>
                          </div>
                          {summary.accounts.map((account) => (
                            <label key={account.id} className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={cardVisibility[`account_${account.id}`] !== false}
                                onChange={(e) => updateCardVisibility(`account_${account.id}`, e.target.checked)}
                                className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary"
                              />
                              <span className="text-sm truncate">{account.name}</span>
                            </label>
                          ))}
                        </>
                      )}

                      <div className="border-t border-border pt-3 mt-3">
                        <Link
                          href="/accounts"
                          className="text-xs text-primary hover:underline"
                          onClick={() => setShowCardSettings(false)}
                        >
                          {t('dashboardManageAccounts')}
                        </Link>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Unified Card Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {cardVisibility.totalBalance && (
                <div className="glass-card p-4">
                  <p className="text-xs text-muted-foreground mb-1">{t('dashboardTotalBalance')}</p>
                  <p className={`text-xl font-bold ${summary.totalBalance >= 0 ? '' : 'text-expense'}`}>
                    {formatCurrency(summary.totalBalance, 'EUR', numberLocale)}
                  </p>
                </div>
              )}
              {cardVisibility.monthlyIncome && (
                <div className="glass-card p-4">
                  <p className="text-xs text-muted-foreground mb-1">{t('dashboardMonthlyIncome')}</p>
                  <p className="text-xl font-bold text-income">{formatCurrency(summary.monthlyIncome, 'EUR', numberLocale)}</p>
                </div>
              )}
              {cardVisibility.monthlyExpenses && (
                <div className="glass-card p-4">
                  <p className="text-xs text-muted-foreground mb-1">{t('dashboardMonthlyExpenses')}</p>
                  <p className="text-xl font-bold text-expense">{formatCurrency(summary.monthlyExpenses, 'EUR', numberLocale)}</p>
                </div>
              )}
              {cardVisibility.remainingBudget && (
                <div className="glass-card p-4">
                  <p className="text-xs text-muted-foreground mb-1">{t('dashboardRemaining')}</p>
                  <p className={`text-xl font-bold ${remainingBudget >= 0 ? 'text-income' : 'text-expense'}`}>
                    {formatCurrency(remainingBudget, 'EUR', numberLocale)}
                  </p>
                </div>
              )}
              {summary.accounts
                .filter((account) => cardVisibility[`account_${account.id}`] !== false)
                .map((account) => (
                  <div key={account.id} className="glass-card p-4">
                    <p className="text-xs text-muted-foreground truncate mb-1">
                      {account.name}
                      {account.includeInBudget && (
                        <span className="ml-1 text-primary">•</span>
                      )}
                    </p>
                    <p className={`text-xl font-bold ${account.balance >= 0 ? '' : 'text-expense'}`}>
                      {formatCurrency(account.balance, 'EUR', numberLocale)}
                    </p>
                  </div>
                ))}
            </div>
          </section>

          {/* Quick Add Button */}
          <div className="flex justify-center">
            <button
              onClick={openNewTransaction}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              {t('dashboardNewTransaction')}
            </button>
          </div>

          {/* Planned Transactions Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{t('dashboardPlannedTransactions')}</h2>
              <Link href="/recurring" className="text-sm text-primary hover:underline">
                {t('dashboardManageRecurring')}
              </Link>
            </div>

            {/* Month Selector */}
            <div className="glass-card p-4 mb-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={goToPreviousMonth}
                  className="p-2 hover:bg-background-surface-hover rounded-md transition-colors"
                >
                  ←
                </button>

                <button
                  onClick={() => setShowMonthPicker(!showMonthPicker)}
                  className="px-4 py-2 font-medium hover:bg-background-surface-hover rounded-md transition-colors"
                >
                  {monthNames[selectedMonth - 1]} {selectedYear}
                </button>

                <button
                  onClick={goToNextMonth}
                  className="p-2 hover:bg-background-surface-hover rounded-md transition-colors"
                >
                  →
                </button>
              </div>

              {/* Month Picker Dropdown */}
              {showMonthPicker && (
                <div className="mt-4 border-t border-border pt-4">
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <button
                      onClick={() => setSelectedYear(selectedYear - 1)}
                      className="p-1 hover:bg-background-surface-hover rounded"
                    >
                      ←
                    </button>
                    <span className="font-medium">{selectedYear}</span>
                    <button
                      onClick={() => setSelectedYear(selectedYear + 1)}
                      className="p-1 hover:bg-background-surface-hover rounded"
                    >
                      →
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {monthNames.map((name, index) => (
                      <button
                        key={index}
                        onClick={() => selectMonth(selectedYear, index + 1)}
                        className={`py-2 px-3 rounded text-sm transition-colors ${
                          selectedMonth === index + 1
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-background-surface-hover'
                        }`}
                      >
                        {name.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary for selected month */}
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground">{t('dashboardPlannedIncome')}</p>
                  <p className="text-lg font-semibold text-income">
                    {formatCurrency(plannedIncome, 'EUR', numberLocale)}
                    {completedIncome > 0 && (
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        ({formatCurrency(completedIncome, 'EUR', numberLocale)} {t('dashboardReceived')})
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('dashboardPlannedExpenses')}</p>
                  <p className="text-lg font-semibold text-expense">
                    {formatCurrency(plannedExpenses, 'EUR', numberLocale)}
                    {completedExpenses > 0 && (
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        ({formatCurrency(completedExpenses, 'EUR', numberLocale)} {t('dashboardPaid')})
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Search and Hide completed toggle */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4 pt-4 border-t border-border">
                {/* Search field */}
                <div className="flex items-center flex-1 sm:max-w-xs relative">
                  <svg
                    className="absolute left-3 w-4 h-4 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={recurringSearch}
                    onChange={(e) => setRecurringSearch(e.target.value)}
                    placeholder={t('search')}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={hideCompleted}
                    onChange={(e) => {
                      setHideCompleted(e.target.checked);
                      localStorage.setItem('dashboardHideCompleted', String(e.target.checked));
                    }}
                    className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-0"
                  />
                  {t('dashboardHideCompleted')}
                </label>
              </div>
            </div>

            {/* Recurring Instances and Credit Card Bills - Two Column Layout */}
            {loadingInstances ? (
              <div className="glass-card p-6 text-center text-muted-foreground">{t('loading')}</div>
            ) : instances.length === 0 && creditCardBills.length === 0 ? (
              <div className="glass-card p-6 text-center text-muted-foreground">
                <p>{t('dashboardNoPlannedTransactions')}</p>
                <Link href="/recurring" className="text-primary hover:underline">
                  {t('dashboardCreateRecurring')}
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Ausgaben (Links) */}
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-expense bg-expense/10 rounded-lg py-2 px-3 text-center md:text-left md:text-sm md:font-medium md:text-muted-foreground md:bg-transparent md:py-0 md:px-1">{t('dashboardExpenses')}</h3>
                  {/* Credit Card Bills */}
                  {creditCardBills
                    .filter(bill => !hideCompleted || !bill.completed)
                    .filter(bill => !recurringSearch || bill.accountName?.toLowerCase().includes(recurringSearch.toLowerCase()))
                    .map((bill) => (
                    <div
                      key={`cc-${bill.id}`}
                      className={`glass-card p-4 ${bill.completed ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => handleToggleCreditCardBill(bill.id)}
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5 ${
                            bill.completed
                              ? 'bg-income border-income text-white'
                              : 'border-border hover:border-primary'
                          }`}
                        >
                          {bill.completed && '✓'}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`font-medium ${bill.completed ? 'line-through' : ''}`}>
                              💳 {bill.accountName}
                            </p>
                            <p className="font-semibold text-expense whitespace-nowrap">
                              -{formatCurrency(bill.amount, 'EUR', numberLocale)}
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {t('dashboardDue')} {formatDate(bill.paymentDate, numberLocale)}
                            {bill.linkedAccountName && (
                              <span className="ml-2 text-xs text-primary">→ {bill.linkedAccountName}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Expense Instances */}
                  {instances
                    .filter(i => i.type === 'expense' && (!hideCompleted || !i.completed))
                    .filter(i => !recurringSearch || i.name.toLowerCase().includes(recurringSearch.toLowerCase()) || i.accountName?.toLowerCase().includes(recurringSearch.toLowerCase()))
                    .map((instance) => (
                    <div
                      key={`ri-${instance.id}`}
                      className={`glass-card p-4 ${instance.completed ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => handleToggleInstance(instance.id)}
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5 ${
                            instance.completed
                              ? 'bg-income border-income text-white'
                              : 'border-border hover:border-primary'
                          }`}
                        >
                          {instance.completed && '✓'}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`font-medium ${instance.completed ? 'line-through' : ''}`}>
                              {instance.name}
                              {instance.isModified && (
                                <span className="ml-2 text-xs text-primary">✎</span>
                              )}
                            </p>
                            <div className="text-right flex-shrink-0">
                              <p className="font-semibold text-expense whitespace-nowrap">
                                -{formatCurrency(instance.amount, 'EUR', numberLocale)}
                              </p>
                              {instance.isModified && instance.originalAmount !== instance.amount && (
                                <p className="text-xs text-muted-foreground line-through">
                                  {formatCurrency(instance.originalAmount, 'EUR', numberLocale)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-sm text-muted-foreground">
                              {formatDate(instance.dueDate, numberLocale)}
                              {instance.accountName && (
                                <span className="ml-2 text-xs text-primary">• {instance.accountName}</span>
                              )}
                            </p>
                            <button
                              onClick={() => openEditInstance(instance)}
                              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-background-surface-hover rounded-md transition-colors"
                              title={t('dashboardAdjustAmount')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {creditCardBills
                    .filter(b => !hideCompleted || !b.completed)
                    .filter(b => !recurringSearch || b.accountName?.toLowerCase().includes(recurringSearch.toLowerCase()))
                    .length === 0 &&
                   instances
                    .filter(i => i.type === 'expense' && (!hideCompleted || !i.completed))
                    .filter(i => !recurringSearch || i.name.toLowerCase().includes(recurringSearch.toLowerCase()) || i.accountName?.toLowerCase().includes(recurringSearch.toLowerCase()))
                    .length === 0 && (
                    <div className="glass-card p-4 text-center text-muted-foreground text-sm">
                      {recurringSearch ? t('dashboardNoExpensesSearch', { term: recurringSearch }) : hideCompleted ? t('dashboardAllExpensesDone') : t('dashboardNoExpensesPlanned')}
                    </div>
                  )}
                </div>

                {/* Einnahmen (Rechts) */}
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-income bg-income/10 rounded-lg py-2 px-3 text-center md:text-left md:text-sm md:font-medium md:text-muted-foreground md:bg-transparent md:py-0 md:px-1">{t('dashboardIncome')}</h3>
                  {instances
                    .filter(i => i.type === 'income' && (!hideCompleted || !i.completed))
                    .filter(i => !recurringSearch || i.name.toLowerCase().includes(recurringSearch.toLowerCase()) || i.accountName?.toLowerCase().includes(recurringSearch.toLowerCase()))
                    .map((instance) => (
                    <div
                      key={`ri-${instance.id}`}
                      className={`glass-card p-4 ${instance.completed ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => handleToggleInstance(instance.id)}
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5 ${
                            instance.completed
                              ? 'bg-income border-income text-white'
                              : 'border-border hover:border-primary'
                          }`}
                        >
                          {instance.completed && '✓'}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`font-medium ${instance.completed ? 'line-through' : ''}`}>
                              {instance.name}
                              {instance.isModified && (
                                <span className="ml-2 text-xs text-primary">✎</span>
                              )}
                            </p>
                            <div className="text-right flex-shrink-0">
                              <p className="font-semibold text-income whitespace-nowrap">
                                +{formatCurrency(instance.amount, 'EUR', numberLocale)}
                              </p>
                              {instance.isModified && instance.originalAmount !== instance.amount && (
                                <p className="text-xs text-muted-foreground line-through">
                                  {formatCurrency(instance.originalAmount, 'EUR', numberLocale)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-sm text-muted-foreground">
                              {formatDate(instance.dueDate, numberLocale)}
                              {instance.accountName && (
                                <span className="ml-2 text-xs text-primary">• {instance.accountName}</span>
                              )}
                            </p>
                            <button
                              onClick={() => openEditInstance(instance)}
                              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-background-surface-hover rounded-md transition-colors"
                              title={t('dashboardAdjustAmount')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {instances
                    .filter(i => i.type === 'income' && (!hideCompleted || !i.completed))
                    .filter(i => !recurringSearch || i.name.toLowerCase().includes(recurringSearch.toLowerCase()) || i.accountName?.toLowerCase().includes(recurringSearch.toLowerCase()))
                    .length === 0 && (
                    <div className="glass-card p-4 text-center text-muted-foreground text-sm">
                      {recurringSearch ? t('dashboardNoIncomeSearch', { term: recurringSearch }) : hideCompleted ? t('dashboardAllIncomeReceived') : t('dashboardNoIncomePlanned')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Recent Transactions */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">{t('dashboardRecentTransactions')}</h2>
                <select
                  value={transactionLimit}
                  onChange={(e) => setTransactionLimit(Number(e.target.value))}
                  className="px-2 py-1 text-sm rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <Link href="/transactions" className="text-sm text-primary hover:underline">
                {t('dashboardShowAll')}
              </Link>
            </div>
            <div className="glass-card divide-y divide-border/50">
              {recentTransactions.length === 0 ? (
                <p className="p-6 text-muted-foreground text-center">
                  {t('dashboardNoTransactionsMonth')}
                </p>
              ) : (
                recentTransactions.map((transaction) => (
                  <div key={transaction.id} className="p-4 flex items-center gap-3 hover:bg-background-surface-hover active:bg-background-surface-hover">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      transaction.type === 'income' ? 'bg-income/20 text-income' : 'bg-expense/20 text-expense'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {transaction.type === 'income' ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                        )}
                      </svg>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {transaction.description || transaction.categoryName || t('txTransaction')}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {transaction.accountName} • {formatDate(transaction.date, numberLocale)}
                      </p>
                    </div>

                    {/* Amount & Edit Button */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className={`font-semibold whitespace-nowrap ${transaction.type === 'income' ? 'text-income' : 'text-expense'}`}>
                        {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount, 'EUR', numberLocale)}
                      </p>
                      <button
                        onClick={() => openEditTransaction(transaction)}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-background-surface-hover rounded-md transition-colors"
                        title={t('edit')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* Edit Instance Modal */}
      {editingInstance && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeEditInstance}
          />

          {/* Modal Content */}
          <div
            className="relative w-full md:max-w-md glass-card-elevated rounded-t-2xl md:rounded-xl p-6 max-h-[90vh] overflow-y-auto safe-area-bottom transition-transform duration-75"
            style={{ transform: `translateY(${modalDragY}px)`, opacity: Math.max(0.5, 1 - modalDragY / 200) }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={() => handleTouchEnd(closeEditInstance)}
          >
            {/* Mobile Handle - swipe down to close */}
            <div className="md:hidden w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-4 cursor-grab active:cursor-grabbing" />

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">
                {t('dashboardAdjustAmount')}
              </h2>
              <button
                onClick={closeEditInstance}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-background-surface-hover rounded-md transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-background rounded-lg p-4 border border-border">
                <p className="font-medium">{editingInstance.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(editingInstance.dueDate, numberLocale)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('dashboardDefaultAmount')} {formatCurrency(editingInstance.originalAmount, 'EUR', numberLocale)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t('dashboardAmountForDate')}</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full px-4 py-3 pr-10 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.00"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t('dashboardNoteOptional')}</label>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={t('dashboardNoteExample')}
                />
              </div>

              <div className="flex gap-3 pt-2">
                {editingInstance.isModified && (
                  <button
                    type="button"
                    onClick={handleResetInstanceException}
                    className="flex-1 py-3 bg-background border border-border text-foreground rounded-lg hover:bg-background-surface-hover transition-colors font-medium"
                  >
                    {t('reset')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveInstanceException}
                  className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                >
                  {t('save')}
                </button>
              </div>

              {/* Apply to future button */}
              <button
                type="button"
                onClick={handleApplyToFuture}
                className="w-full py-3 bg-background border border-primary text-primary rounded-lg hover:bg-primary/10 transition-colors font-medium text-sm"
              >
                {t('dashboardApplyToFuture')}
              </button>

              {/* Spacer for bottom padding */}
              <div style={{ height: '40px' }} />
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal (New/Edit) */}
      {showTransactionModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeTransactionModal}
          />

          {/* Modal Content */}
          <div
            className="relative w-full md:max-w-lg glass-card-elevated rounded-t-2xl md:rounded-xl p-6 max-h-[90vh] overflow-y-auto overflow-x-hidden safe-area-bottom transition-transform duration-75"
            style={{ transform: `translateY(${modalDragY}px)`, opacity: Math.max(0.5, 1 - modalDragY / 200) }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={() => handleTouchEnd(closeTransactionModal)}
          >
            {/* Mobile Handle - swipe down to close */}
            <div className="md:hidden w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-4 cursor-grab active:cursor-grabbing" />

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">
                {editingTransaction ? t('dashboardEditTransaction') : t('dashboardNewTransaction')}
              </h2>
              <button
                onClick={closeTransactionModal}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-background-surface-hover rounded-md transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="space-y-4 min-w-0">
              {/* Type Buttons */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('txType')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['expense', 'income', 'transfer'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTxFormData({ ...txFormData, type, categoryId: '' })}
                      className={`py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
                        txFormData.type === type
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

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('txAmount')}</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={txFormData.amount}
                    onChange={(e) => setTxFormData({ ...txFormData, amount: e.target.value })}
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
                  value={txFormData.accountId}
                  onChange={(e) => setTxFormData({ ...txFormData, accountId: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="">{t('txSelectAccount')}</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category */}
              {txFormData.type !== 'transfer' && (
                <div>
                  <label className="block text-sm font-medium mb-2">{t('txCategory')}</label>
                  <select
                    value={txFormData.categoryId}
                    onChange={(e) => setTxFormData({ ...txFormData, categoryId: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">{t('txNoCategory')}</option>
                    {hierarchicalCategories.map(({ category, isChild, parentName }) => (
                      <option key={category.id} value={category.id}>
                        {isChild ? `  └ ${category.name}` : category.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Transfer Target Account */}
              {txFormData.type === 'transfer' && (
                <div>
                  <label className="block text-sm font-medium mb-2">{t('txTargetAccount')}</label>
                  <select
                    value={txFormData.transferToAccountId}
                    onChange={(e) => setTxFormData({ ...txFormData, transferToAccountId: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="">{t('txSelectTargetAccount')}</option>
                    {accounts
                      .filter((acc) => String(acc.id) !== txFormData.accountId)
                      .map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Date */}
              <div className="min-w-0">
                <label className="block text-sm font-medium mb-2">{t('txDate')}</label>
                <input
                  type="date"
                  value={txFormData.date}
                  onChange={(e) => setTxFormData({ ...txFormData, date: e.target.value })}
                  className="w-full max-w-full min-w-0 px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('txDescription')}</label>
                <input
                  type="text"
                  value={txFormData.description}
                  onChange={(e) => setTxFormData({ ...txFormData, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={t('optional')}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                {editingTransaction && (
                  <button
                    type="button"
                    onClick={() => handleDeleteTransaction(editingTransaction.id)}
                    className="px-4 py-3 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition-colors font-medium"
                  >
                    {t('delete')}
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold"
                >
                  {editingTransaction ? t('save') : t('create')}
                </button>
              </div>

              {/* Spacer for bottom padding */}
              <div style={{ height: '40px' }} />
            </form>
          </div>
        </div>
      )}
    </>
  );
}
