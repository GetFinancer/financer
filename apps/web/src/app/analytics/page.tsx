'use client';

import { useEffect, useState } from 'react';
import { AnalyticsData, Category } from '@financer/shared';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

type DateRangeType = 'month' | 'quarter' | 'year' | 'custom';

// Default colors for categories without color
const defaultColors = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#eab308',
  '#22c55e', '#14b8a6', '#06b6d4', '#6366f1', '#a855f7',
];

export default function AnalyticsPage() {
  const { t, numberLocale } = useTranslation();

  const monthNames = [
    t('monthJanuary'), t('monthFebruary'), t('monthMarch'), t('monthApril'),
    t('monthMay'), t('monthJune'), t('monthJuly'), t('monthAugust'),
    t('monthSeptember'), t('monthOctober'), t('monthNovember'), t('monthDecember'),
  ];

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range state
  const now = new Date();
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>('month');
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Category filter state
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  // View toggle: expenses or income
  const [viewType, setViewType] = useState<'expense' | 'income'>('expense');

  // Get root categories (no parent) for the dropdown
  const rootCategories = categories.filter(c => !c.parentId);
  const expenseCategories = rootCategories.filter(c => c.type === 'expense');
  const incomeCategories = rootCategories.filter(c => c.type === 'income');

  function getDateRange(): { startDate: string; endDate: string } {
    if (dateRangeType === 'month') {
      const start = new Date(selectedYear, selectedMonth - 1, 1);
      const end = new Date(selectedYear, selectedMonth, 0);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    }

    if (dateRangeType === 'quarter') {
      const startMonth = (selectedQuarter - 1) * 3;
      const start = new Date(selectedYear, startMonth, 1);
      const end = new Date(selectedYear, startMonth + 3, 0);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    }

    if (dateRangeType === 'year') {
      return {
        startDate: `${selectedYear}-01-01`,
        endDate: `${selectedYear}-12-31`,
      };
    }

    // custom
    return {
      startDate: customStartDate || now.toISOString().split('T')[0],
      endDate: customEndDate || now.toISOString().split('T')[0],
    };
  }

  function getDateRangeLabel(): string {
    if (dateRangeType === 'month') {
      return `${monthNames[selectedMonth - 1]} ${selectedYear}`;
    }
    if (dateRangeType === 'quarter') {
      return `Q${selectedQuarter} ${selectedYear}`;
    }
    if (dateRangeType === 'year') {
      return `${selectedYear}`;
    }
    if (customStartDate && customEndDate) {
      return `${customStartDate} - ${customEndDate}`;
    }
    return t('analyticsChooseRange');
  }

  async function loadCategories() {
    try {
      const data = await api.getCategories();
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }

  async function loadAnalytics() {
    try {
      setLoading(true);
      setError(null);
      const { startDate, endDate } = getDateRange();
      const data = await api.getAnalytics(startDate, endDate, selectedCategoryId || undefined);
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorLoading'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [dateRangeType, selectedYear, selectedMonth, selectedQuarter, customStartDate, customEndDate, selectedCategoryId]);

  // Navigate to previous period
  function goToPrevious() {
    if (dateRangeType === 'month') {
      if (selectedMonth === 1) {
        setSelectedMonth(12);
        setSelectedYear(selectedYear - 1);
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    } else if (dateRangeType === 'quarter') {
      if (selectedQuarter === 1) {
        setSelectedQuarter(4);
        setSelectedYear(selectedYear - 1);
      } else {
        setSelectedQuarter(selectedQuarter - 1);
      }
    } else if (dateRangeType === 'year') {
      setSelectedYear(selectedYear - 1);
    }
  }

  // Navigate to next period
  function goToNext() {
    if (dateRangeType === 'month') {
      if (selectedMonth === 12) {
        setSelectedMonth(1);
        setSelectedYear(selectedYear + 1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    } else if (dateRangeType === 'quarter') {
      if (selectedQuarter === 4) {
        setSelectedQuarter(1);
        setSelectedYear(selectedYear + 1);
      } else {
        setSelectedQuarter(selectedQuarter + 1);
      }
    } else if (dateRangeType === 'year') {
      setSelectedYear(selectedYear + 1);
    }
  }

  // Calculate percentage change
  function getPercentageChange(current: number, previous: number): { value: number; isPositive: boolean } {
    if (previous === 0) return { value: 0, isPositive: true };
    const change = ((current - previous) / previous) * 100;
    return { value: Math.abs(Math.round(change)), isPositive: change >= 0 };
  }

  const categoryData = viewType === 'expense'
    ? analytics?.expensesByCategory || []
    : analytics?.incomeByCategory || [];

  const totalAmount = viewType === 'expense'
    ? analytics?.totalExpenses || 0
    : analytics?.totalIncome || 0;

  // Prepare pie chart data with colors
  const pieChartData = categoryData.map((cat, index) => ({
    ...cat,
    color: cat.color || defaultColors[index % defaultColors.length],
  }));

  // Get available categories for the filter based on viewType
  const filterCategories = viewType === 'expense' ? expenseCategories : incomeCategories;

  return (
    <div className="space-y-6">
      {/* Header with Date Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">
          Analytics
          {analytics?.filterCategory && (
            <span className="text-lg font-normal text-muted-foreground ml-2">
              - {analytics.filterCategory.name || t('txNoCategory')}
            </span>
          )}
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Type Selector */}
          <select
            value={dateRangeType}
            onChange={(e) => setDateRangeType(e.target.value as DateRangeType)}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="month">{t('analyticsMonth')}</option>
            <option value="quarter">{t('analyticsQuarter')}</option>
            <option value="year">{t('analyticsYear')}</option>
            <option value="custom">{t('analyticsCustom')}</option>
          </select>

          {/* Navigation for non-custom ranges */}
          {dateRangeType !== 'custom' && (
            <div className="flex items-center gap-1">
              <button
                onClick={goToPrevious}
                className="p-2 hover:bg-background-surface-hover rounded-md transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="px-3 py-2 font-medium min-w-[140px] text-center">
                {getDateRangeLabel()}
              </span>
              <button
                onClick={goToNext}
                className="p-2 hover:bg-background-surface-hover rounded-md transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          {/* Custom date inputs */}
          {dateRangeType === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-muted-foreground">-</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setViewType('expense')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewType === 'expense'
                ? 'bg-expense text-white'
                : 'bg-background-surface hover:bg-background-surface-hover'
            }`}
          >
            {t('dashboardExpenses')}
          </button>
          <button
            onClick={() => setViewType('income')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewType === 'income'
                ? 'bg-income text-white'
                : 'bg-background-surface hover:bg-background-surface-hover'
            }`}
          >
            {t('dashboardIncome')}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('analyticsCategory')}</span>
          <select
            value={selectedCategoryId || ''}
            onChange={(e) => setSelectedCategoryId(e.target.value ? parseInt(e.target.value, 10) : null)}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[150px]"
          >
            <option value="">{t('all')}</option>
            {filterCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name || t('txNoCategory')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-8 text-center text-muted-foreground">{t('loading')}</div>
      ) : error ? (
        <div className="glass-card p-8 text-center text-destructive">{error}</div>
      ) : analytics ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="glass-card p-6">
              <div className="text-sm text-muted-foreground mb-1">
                {analytics.filterCategory ? `${t('dashboardExpenses')} (${analytics.filterCategory.name || t('txNoCategory')})` : t('analyticsTotalExpenses')}
              </div>
              <div className="text-2xl font-bold text-expense">
                {formatCurrency(analytics.totalExpenses, 'EUR', numberLocale)}
              </div>
              {analytics.previousPeriod && (
                <div className={`text-sm mt-1 ${
                  getPercentageChange(analytics.totalExpenses, analytics.previousPeriod.totalExpenses).isPositive
                    ? 'text-destructive' : 'text-success'
                }`}>
                  {getPercentageChange(analytics.totalExpenses, analytics.previousPeriod.totalExpenses).isPositive ? '▲' : '▼'}
                  {' '}
                  {getPercentageChange(analytics.totalExpenses, analytics.previousPeriod.totalExpenses).value}% {t('analyticsVsPrevious')}
                </div>
              )}
            </div>

            <div className="glass-card p-6">
              <div className="text-sm text-muted-foreground mb-1">
                {analytics.filterCategory ? `${t('dashboardIncome')} (${analytics.filterCategory.name || t('txNoCategory')})` : t('analyticsTotalIncome')}
              </div>
              <div className="text-2xl font-bold text-income">
                {formatCurrency(analytics.totalIncome, 'EUR', numberLocale)}
              </div>
              {analytics.previousPeriod && (
                <div className={`text-sm mt-1 ${
                  getPercentageChange(analytics.totalIncome, analytics.previousPeriod.totalIncome).isPositive
                    ? 'text-success' : 'text-destructive'
                }`}>
                  {getPercentageChange(analytics.totalIncome, analytics.previousPeriod.totalIncome).isPositive ? '▲' : '▼'}
                  {' '}
                  {getPercentageChange(analytics.totalIncome, analytics.previousPeriod.totalIncome).value}% {t('analyticsVsPrevious')}
                </div>
              )}
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold mb-4">
                {t('analyticsByCategory', { type: viewType === 'expense' ? t('dashboardExpenses') : t('dashboardIncome') })}
              </h2>
              {pieChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percentage }) => `${name} (${percentage}%)`}
                      labelLine={false}
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value, 'EUR', numberLocale)}
                      contentStyle={{
                        backgroundColor: 'hsl(240 6% 10%)',
                        border: '1px solid hsl(240 5% 17%)',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  {t('noData')}
                </div>
              )}
            </div>

            {/* Bar Chart - Monthly Trend */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold mb-4">{t('analyticsMonthlyTrend')}</h2>
              {analytics.monthlyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 5% 17%)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: 'hsl(218 11% 65%)' }}
                      axisLine={{ stroke: 'hsl(240 5% 17%)' }}
                    />
                    <YAxis
                      tick={{ fill: 'hsl(218 11% 65%)' }}
                      axisLine={{ stroke: 'hsl(240 5% 17%)' }}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value, 'EUR', numberLocale)}
                      contentStyle={{
                        backgroundColor: 'hsl(240 6% 10%)',
                        border: '1px solid hsl(240 5% 17%)',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'hsl(0 0% 90%)' }}
                    />
                    <Legend />
                    <Bar
                      dataKey="expenses"
                      name={t('dashboardExpenses')}
                      fill="hsl(0 84% 60%)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="income"
                      name={t('dashboardIncome')}
                      fill="hsl(142 71% 45%)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  {t('noData')}
                </div>
              )}
            </div>
          </div>

          {/* Category List */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold mb-4">
              {t('analyticsTopCategories', { type: viewType === 'expense' ? t('dashboardExpenses') : t('dashboardIncome') })}
            </h2>
            {categoryData.length > 0 ? (
              <div className="space-y-3">
                {categoryData.map((cat, index) => (
                  <div key={cat.id || index} className="flex items-center gap-4">
                    {/* Color indicator */}
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color || defaultColors[index % defaultColors.length] }}
                    />

                    {/* Category name and parent */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {cat.parentName ? `${cat.parentName} → ` : ''}
                        {cat.name || t('txNoCategory')}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {cat.transactionCount !== 1 ? t('analyticsTransactionCountPlural', { count: cat.transactionCount }) : t('analyticsTransactionCount', { count: cat.transactionCount })}
                      </div>
                    </div>

                    {/* Amount and percentage */}
                    <div className="text-right flex-shrink-0">
                      <div className={`font-semibold ${viewType === 'expense' ? 'text-expense' : 'text-income'}`}>
                        {formatCurrency(cat.amount, 'EUR', numberLocale)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {cat.percentage}%
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-24 hidden sm:block">
                      <div className="h-2 bg-background-surface rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${cat.percentage}%`,
                            backgroundColor: cat.color || defaultColors[index % defaultColors.length],
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                {t('analyticsNoDataRange')}
              </div>
            )}
          </div>

          {/* Monthly Breakdown Table (Year + Category selected) */}
          {analytics.monthlyBreakdown && analytics.monthlyBreakdown.length > 0 && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold mb-4">
                {t('analyticsMonthlyDistribution', { year: selectedYear })}
                {analytics.filterCategory && ` - ${analytics.filterCategory.name || t('txNoCategory')}`}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t('analyticsMonthColumn')}</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">{t('dashboardExpenses')}</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">{t('dashboardIncome')}</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">{t('analyticsDifferenceColumn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.monthlyBreakdown.map((row) => {
                      const diff = row.income - row.expenses;
                      return (
                        <tr key={row.monthNum} className="border-b border-border/50 hover:bg-background-surface-hover">
                          <td className="py-3 px-4 font-medium">{row.month}</td>
                          <td className="py-3 px-4 text-right text-expense">
                            {row.expenses > 0 ? formatCurrency(row.expenses, 'EUR', numberLocale) : '-'}
                          </td>
                          <td className="py-3 px-4 text-right text-income">
                            {row.income > 0 ? formatCurrency(row.income, 'EUR', numberLocale) : '-'}
                          </td>
                          <td className={`py-3 px-4 text-right font-medium ${diff >= 0 ? 'text-income' : 'text-expense'}`}>
                            {(row.income > 0 || row.expenses > 0) ? formatCurrency(diff, 'EUR', numberLocale) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Total row */}
                    <tr className="bg-background-surface font-semibold">
                      <td className="py-3 px-4">{t('total')}</td>
                      <td className="py-3 px-4 text-right text-expense">
                        {formatCurrency(analytics.totalExpenses, 'EUR', numberLocale)}
                      </td>
                      <td className="py-3 px-4 text-right text-income">
                        {formatCurrency(analytics.totalIncome, 'EUR', numberLocale)}
                      </td>
                      <td className={`py-3 px-4 text-right ${analytics.totalIncome - analytics.totalExpenses >= 0 ? 'text-income' : 'text-expense'}`}>
                        {formatCurrency(analytics.totalIncome - analytics.totalExpenses, 'EUR', numberLocale)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
