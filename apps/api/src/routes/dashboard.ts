import { Router } from 'express';
import { db } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import type { DashboardSummary, ChartData, AccountWithBalance, TransactionWithDetails } from '@financer/shared';

export const dashboardRouter = Router();

dashboardRouter.use(authMiddleware);

// Get dashboard summary
dashboardRouter.get('/summary', (_req, res) => {
  // Get current month boundaries
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  // Get accounts with balances
  const accounts = db.prepare(`
    SELECT
      a.*,
      a.initial_balance + COALESCE(
        (SELECT SUM(
          CASE
            WHEN t.type = 'income' THEN t.amount
            WHEN t.type = 'expense' THEN -t.amount
            WHEN t.type = 'transfer' AND t.account_id = a.id THEN -t.amount
            WHEN t.type = 'transfer' AND t.transfer_to_account_id = a.id THEN t.amount
            ELSE 0
          END
        ) FROM transactions t
        WHERE t.account_id = a.id OR t.transfer_to_account_id = a.id
        ), 0
      ) as balance
    FROM accounts a
    ORDER BY a.name
  `).all() as any[];

  const mappedAccounts: AccountWithBalance[] = accounts.map(a => ({
    id: a.id,
    name: a.name,
    type: a.type,
    currency: a.currency,
    initialBalance: a.initial_balance,
    color: a.color ?? undefined,
    icon: a.icon ?? undefined,
    includeInBudget: a.include_in_budget === 1,
    isDefault: a.is_default === 1,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
    balance: a.balance,
  }));

  // Calculate total balance (exclude credit cards - they are liabilities, not assets)
  const totalBalance = mappedAccounts
    .filter(a => a.type !== 'credit')
    .reduce((sum, a) => sum + a.balance, 0);

  // Calculate budget balance (only accounts with includeInBudget=true)
  const budgetBalance = mappedAccounts
    .filter(a => a.includeInBudget)
    .reduce((sum, a) => sum + a.balance, 0);

  // Get monthly income
  const monthlyIncomeResult = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE type = 'income' AND date >= ? AND date <= ?
  `).get(startOfMonth, endOfMonth) as { total: number };

  // Get monthly expenses
  const monthlyExpensesResult = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE type = 'expense' AND date >= ? AND date <= ?
  `).get(startOfMonth, endOfMonth) as { total: number };

  // Get recent transactions
  const recentTransactions = db.prepare(`
    SELECT
      t.*,
      a.name as account_name,
      c.name as category_name,
      c.color as category_color,
      pc.name as parent_category_name,
      ta.name as transfer_to_account_name
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    LEFT JOIN accounts ta ON t.transfer_to_account_id = ta.id
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT 10
  `).all() as any[];

  const mappedTransactions: TransactionWithDetails[] = recentTransactions.map(t => ({
    id: t.id,
    accountId: t.account_id,
    categoryId: t.category_id ?? undefined,
    amount: t.amount,
    type: t.type,
    description: t.description ?? undefined,
    date: t.date,
    notes: t.notes ?? undefined,
    transferToAccountId: t.transfer_to_account_id ?? undefined,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    accountName: t.account_name,
    categoryName: t.category_name ?? undefined,
    categoryColor: t.category_color ?? undefined,
    parentCategoryName: t.parent_category_name ?? undefined,
    transferToAccountName: t.transfer_to_account_name ?? undefined,
  }));

  const summary: DashboardSummary = {
    totalBalance,
    budgetBalance,
    monthlyIncome: monthlyIncomeResult.total,
    monthlyExpenses: monthlyExpensesResult.total,
    accounts: mappedAccounts,
    recentTransactions: mappedTransactions,
  };

  res.json({ success: true, data: summary });
});

// Get chart data for last N months
dashboardRouter.get('/chart', (req, res) => {
  const months = parseInt(req.query.months as string, 10) || 6;

  const labels: string[] = [];
  const income: number[] = [];
  const expenses: number[] = [];

  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const startOfMonth = date.toISOString().split('T')[0];
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

    // Format label
    const label = date.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
    labels.push(label);

    // Get income
    const incomeResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type = 'income' AND date >= ? AND date <= ?
    `).get(startOfMonth, endOfMonth) as { total: number };
    income.push(incomeResult.total);

    // Get expenses
    const expensesResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type = 'expense' AND date >= ? AND date <= ?
    `).get(startOfMonth, endOfMonth) as { total: number };
    expenses.push(expensesResult.total);
  }

  const chartData: ChartData = { labels, income, expenses };

  res.json({ success: true, data: chartData });
});
