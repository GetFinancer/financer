import { Router } from 'express';
import { db } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import type { AnalyticsData, CategoryStats, MonthlyTrend } from '@financer/shared';

export const analyticsRouter = Router();

analyticsRouter.use(authMiddleware);

// GET /analytics/categories?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&categoryId=123
analyticsRouter.get('/categories', (req, res) => {
  const { startDate, endDate, categoryId } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      error: 'startDate und endDate sind erforderlich',
    });
  }

  // If categoryId is provided, get the category and its subcategories
  let categoryIds: number[] = [];
  let filterCategory: any = null;

  if (categoryId) {
    const catId = parseInt(categoryId as string, 10);
    filterCategory = db.prepare('SELECT * FROM categories WHERE id = ?').get(catId);

    if (filterCategory) {
      // Get the parent category and all its subcategories
      const subcategories = db.prepare('SELECT id FROM categories WHERE parent_id = ?').all(catId) as { id: number }[];
      categoryIds = [catId, ...subcategories.map(c => c.id)];
    }
  }

  // Build category filter SQL (with alias for JOINs, without for simple queries)
  const categoryFilter = categoryIds.length > 0
    ? `AND t.category_id IN (${categoryIds.join(',')})`
    : '';
  const categoryFilterSimple = categoryIds.length > 0
    ? `AND category_id IN (${categoryIds.join(',')})`
    : '';

  // Get expenses by category
  const expenseRows = db.prepare(`
    SELECT
      c.id,
      c.name,
      c.color,
      pc.name as parent_name,
      SUM(t.amount) as total_amount,
      COUNT(t.id) as transaction_count
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    WHERE t.type = 'expense'
      AND t.date >= ?
      AND t.date <= ?
      ${categoryFilter}
    GROUP BY c.id
    ORDER BY total_amount DESC
  `).all(startDate, endDate) as any[];

  // Get income by category
  const incomeRows = db.prepare(`
    SELECT
      c.id,
      c.name,
      c.color,
      pc.name as parent_name,
      SUM(t.amount) as total_amount,
      COUNT(t.id) as transaction_count
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    WHERE t.type = 'income'
      AND t.date >= ?
      AND t.date <= ?
      ${categoryFilter}
    GROUP BY c.id
    ORDER BY total_amount DESC
  `).all(startDate, endDate) as any[];

  // Calculate totals
  const totalExpenses = expenseRows.reduce((sum, row) => sum + (row.total_amount || 0), 0);
  const totalIncome = incomeRows.reduce((sum, row) => sum + (row.total_amount || 0), 0);

  // Map to CategoryStats with percentages
  const expensesByCategory: CategoryStats[] = expenseRows.map(row => ({
    id: row.id || 0,
    name: row.name || 'Ohne Kategorie',
    color: row.color,
    amount: row.total_amount || 0,
    percentage: totalExpenses > 0 ? Math.round((row.total_amount / totalExpenses) * 100) : 0,
    transactionCount: row.transaction_count,
    parentName: row.parent_name ?? undefined,
  }));

  const incomeByCategory: CategoryStats[] = incomeRows.map(row => ({
    id: row.id || 0,
    name: row.name || 'Ohne Kategorie',
    color: row.color,
    amount: row.total_amount || 0,
    percentage: totalIncome > 0 ? Math.round((row.total_amount / totalIncome) * 100) : 0,
    transactionCount: row.transaction_count,
    parentName: row.parent_name ?? undefined,
  }));

  // Calculate monthly trend (last 6 months from endDate)
  const monthlyTrend: MonthlyTrend[] = [];
  const endDateObj = new Date(endDate as string);

  for (let i = 5; i >= 0; i--) {
    const date = new Date(endDateObj.getFullYear(), endDateObj.getMonth() - i, 1);
    const monthStart = date.toISOString().split('T')[0];
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

    const label = date.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });

    const expenseResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type = 'expense' AND date >= ? AND date <= ? ${categoryFilterSimple}
    `).get(monthStart, monthEnd) as { total: number };

    const incomeResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type = 'income' AND date >= ? AND date <= ? ${categoryFilterSimple}
    `).get(monthStart, monthEnd) as { total: number };

    monthlyTrend.push({
      month: label,
      expenses: expenseResult.total,
      income: incomeResult.total,
    });
  }

  // Calculate monthly breakdown for yearly view with category filter
  interface MonthlyBreakdown {
    month: string;
    monthNum: number;
    expenses: number;
    income: number;
  }
  let monthlyBreakdown: MonthlyBreakdown[] = [];

  // Check if this is a year-long period (roughly 365 days)
  const startDateObj = new Date(startDate as string);
  const periodDays = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
  const isYearView = periodDays > 300;

  if (isYearView && categoryIds.length > 0) {
    // Generate monthly breakdown for the selected year
    const year = startDateObj.getFullYear();
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(year, month, 1).toISOString().split('T')[0];
      const monthEnd = new Date(year, month + 1, 0).toISOString().split('T')[0];
      const monthLabel = new Date(year, month, 1).toLocaleDateString('de-DE', { month: 'long' });

      const expenseResult = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE type = 'expense' AND date >= ? AND date <= ? ${categoryFilterSimple}
      `).get(monthStart, monthEnd) as { total: number };

      const incomeResult = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE type = 'income' AND date >= ? AND date <= ? ${categoryFilterSimple}
      `).get(monthStart, monthEnd) as { total: number };

      monthlyBreakdown.push({
        month: monthLabel,
        monthNum: month + 1,
        expenses: expenseResult.total,
        income: incomeResult.total,
      });
    }
  }

  // Calculate previous period for comparison
  const prevEndDate = new Date(startDateObj.getTime() - 1);
  const prevStartDate = new Date(prevEndDate.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const prevExpenseResult = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE type = 'expense' AND date >= ? AND date <= ? ${categoryFilterSimple}
  `).get(
    prevStartDate.toISOString().split('T')[0],
    prevEndDate.toISOString().split('T')[0]
  ) as { total: number };

  const prevIncomeResult = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE type = 'income' AND date >= ? AND date <= ? ${categoryFilterSimple}
  `).get(
    prevStartDate.toISOString().split('T')[0],
    prevEndDate.toISOString().split('T')[0]
  ) as { total: number };

  const analyticsData: AnalyticsData & { monthlyBreakdown?: MonthlyBreakdown[]; filterCategory?: { id: number; name: string; color: string | null } } = {
    period: {
      startDate: startDate as string,
      endDate: endDate as string,
    },
    expensesByCategory,
    incomeByCategory,
    totalExpenses,
    totalIncome,
    monthlyTrend,
    previousPeriod: {
      totalExpenses: prevExpenseResult.total,
      totalIncome: prevIncomeResult.total,
    },
  };

  // Add monthly breakdown if available
  if (monthlyBreakdown.length > 0) {
    analyticsData.monthlyBreakdown = monthlyBreakdown;
  }

  // Add filter category info if filtered
  if (filterCategory) {
    analyticsData.filterCategory = {
      id: filterCategory.id,
      name: filterCategory.name,
      color: filterCategory.color,
    };
  }

  res.json({ success: true, data: analyticsData });
});
