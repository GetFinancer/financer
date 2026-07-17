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

  // Highlight the most recent bar in the monthly trend chart (current period)
  const currentTrendMonth = analytics?.monthlyTrend.length
    ? analytics.monthlyTrend[analytics.monthlyTrend.length - 1].month
    : null;

  return (
    <div className="space-y-5">
      {/* Header with Date Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 rounded-full bg-primary flex-shrink-0" />
          <h1 className="text-xl font-bold tracking-tight">
            Analytics
            {analytics?.filterCategory && (
              <span className="text-base font-normal text-muted-foreground ml-2">
                - {analytics.filterCategory.name || t('txNoCategory')}
              </span>
            )}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Type Selector */}
          <select
            value={dateRangeType}
            onChange={(e) => setDateRangeType(e.target.value as DateRangeType)}
            className="px-3.5 py-2 rounded-lg border border-border bg-background-surface/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="month">{t('analyticsMonth')}</option>
            <option value="quarter">{t('analyticsQuarter')}</option>
            <option value="year">{t('analyticsYear')}</option>
            <option value="custom">{t('analyticsCustom')}</option>
          </select>

          {/* Navigation for non-custom ranges */}
          {dateRangeType !== 'custom' && (
            <div className="flex items-center gap-1 px-1 rounded-lg border border-border bg-background-surface/60">
              <button
                onClick={goToPrevious}
                className="p-2 hover:bg-background-surface-hover rounded-md transition-colors text-muted-foreground hover:text-foreground"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="px-2 py-2 font-semibold text-sm min-w-[130px] text-center">
                {getDateRangeLabel()}
              </span>
              <button
                onClick={goToNext}
                className="p-2 hover:bg-background-surface-hover rounded-md transition-colors text-muted-foreground hover:text-foreground"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="px-3 py-2 rounded-lg border border-border bg-background-surface/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-muted-foreground">-</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background-surface/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex p-1 rounded-[11px] bg-background-surface/60 border border-border text-[11.5px] font-semibold">
          <button
            onClick={() => setViewType('expense')}
            className={`px-4 py-1.5 rounded-lg transition-colors ${
              viewType === 'expense'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('dashboardExpenses')}
          </button>
          <button
            onClick={() => setViewType('income')}
            className={`px-4 py-1.5 rounded-lg transition-colors ${
              viewType === 'income'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('dashboardIncome')}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10.5px] text-muted-foreground">{t('analyticsCategory')}</span>
          <select
            value={selectedCategoryId || ''}
            onChange={(e) => setSelectedCategoryId(e.target.value ? parseInt(e.target.value, 10) : null)}
            className="px-3 py-2 rounded-lg border border-border bg-background-surface/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[150px]"
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
            <div className="rounded-2xl border border-expense/20 bg-expense/[0.06] backdrop-blur-xl p-5">
              <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
                {analytics.filterCategory ? `${t('dashboardExpenses')} (${analytics.filterCategory.name || t('txNoCategory')})` : t('analyticsTotalExpenses')}
              </div>
              <div className="text-[26px] font-extrabold font-mono text-expense mt-2">
                {formatCurrency(analytics.totalExpenses, 'EUR', numberLocale)}
              </div>
              {analytics.previousPeriod && (
                <div className={`text-[10.5px] mt-1.5 ${
                  getPercentageChange(analytics.totalExpenses, analytics.previousPeriod.totalExpenses).isPositive
                    ? 'text-expense' : 'text-income'
                }`}>
                  {getPercentageChange(analytics.totalExpenses, analytics.previousPeriod.totalExpenses).isPositive ? '▲' : '▼'}
                  {' '}
                  {getPercentageChange(analytics.totalExpenses, analytics.previousPeriod.totalExpenses).value}% {t('analyticsVsPrevious')}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/[0.07] backdrop-blur-xl p-5">
              <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
                {analytics.filterCategory ? `${t('dashboardIncome')} (${analytics.filterCategory.name || t('txNoCategory')})` : t('analyticsTotalIncome')}
              </div>
              <div className="text-[26px] font-extrabold font-mono text-primary-hover mt-2">
                {formatCurrency(analytics.totalIncome, 'EUR', numberLocale)}
              </div>
              {analytics.previousPeriod && (
                <div className={`text-[10.5px] mt-1.5 ${
                  getPercentageChange(analytics.totalIncome, analytics.previousPeriod.totalIncome).isPositive
                    ? 'text-income' : 'text-expense'
                }`}>
                  {getPercentageChange(analytics.totalIncome, analytics.previousPeriod.totalIncome).isPositive ? '▲' : '▼'}
                  {' '}
                  {getPercentageChange(analytics.totalIncome, analytics.previousPeriod.totalIncome).value}% {t('analyticsVsPrevious')}
                </div>
              )}
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Donut Chart */}
            <div className="glass-card p-6">
              <h2 className="text-[12.5px] font-bold mb-4">
                {t('analyticsByCategory', { type: viewType === 'expense' ? t('dashboardExpenses') : t('dashboardIncome') })}
              </h2>
              {pieChartData.length > 0 ? (
                <div className="flex items-center gap-6">
                  <div className="relative flex-shrink-0" style={{ width: 170, height: 170 }}>
                    <ResponsiveContainer width={170} height={170}>
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          dataKey="amount"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={85}
                          startAngle={90}
                          endAngle={-270}
                          stroke="none"
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
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[9px] text-muted-foreground tracking-wide">{t('total').toUpperCase()}</span>
                      <span className="text-sm font-bold font-mono">
                        {formatCurrency(totalAmount, 'EUR', numberLocale)}
                      </span>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex flex-col gap-2 text-[10.5px] min-w-0 flex-1">
                    {pieChartData.map((cat, index) => (
                      <div key={cat.id || index} className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-[9px] h-[9px] rounded-[3px] flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate">{cat.name || t('txNoCategory')}</span>
                        <span className="text-muted-foreground ml-auto flex-shrink-0">{cat.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                  {t('noData')}
                </div>
              )}
            </div>

            {/* Bar Chart - Monthly Trend */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[12.5px] font-bold">{t('analyticsMonthlyTrend')}</h2>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-expense inline-block" />{t('dashboardExpenses')}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-income inline-block" />{t('dashboardIncome')}</span>
                </div>
              </div>
              {analytics.monthlyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={analytics.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 5% 17%)" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={({ x, y, payload }) => (
                        <text
                          x={x}
                          y={y + 12}
                          textAnchor="middle"
                          fontSize={9.5}
                          fontWeight={payload.value === currentTrendMonth ? 600 : 400}
                          fill={payload.value === currentTrendMonth ? 'hsl(var(--primary-hover))' : 'hsl(218 11% 65%)'}
                        >
                          {payload.value}
                        </text>
                      )}
                      axisLine={{ stroke: 'hsl(240 5% 17%)' }}
                    />
                    <YAxis
                      tick={{ fill: 'hsl(218 11% 65%)', fontSize: 10 }}
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
                    <Bar dataKey="expenses" name={t('dashboardExpenses')} radius={[4, 4, 0, 0]}>
                      {analytics.monthlyTrend.map((entry, index) => (
                        <Cell
                          key={`expense-${index}`}
                          fill="hsl(0 91% 71%)"
                          fillOpacity={entry.month === currentTrendMonth ? 0.85 : 0.55}
                        />
                      ))}
                    </Bar>
                    <Bar dataKey="income" name={t('dashboardIncome')} radius={[4, 4, 0, 0]}>
                      {analytics.monthlyTrend.map((entry, index) => (
                        <Cell
                          key={`income-${index}`}
                          fill="hsl(158 64% 52%)"
                          fillOpacity={entry.month === currentTrendMonth ? 1 : 0.55}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-muted-foreground">
                  {t('noData')}
                </div>
              )}
            </div>
          </div>

          {/* Category List */}
          <div className="glass-card p-6">
            <h2 className="text-[12.5px] font-bold mb-3">
              {t('analyticsTopCategories', { type: viewType === 'expense' ? t('dashboardExpenses') : t('dashboardIncome') })}
            </h2>
            {categoryData.length > 0 ? (
              <div className="flex flex-col text-[11.5px]">
                {categoryData.map((cat, index) => (
                  <div
                    key={cat.id || index}
                    className={`flex items-center gap-3 py-[7px] ${index > 0 ? 'border-t border-border/50' : ''}`}
                  >
                    {/* Color indicator */}
                    <span
                      className="w-[9px] h-[9px] rounded-[3px] flex-shrink-0"
                      style={{ backgroundColor: cat.color || defaultColors[index % defaultColors.length] }}
                    />

                    {/* Category name and parent */}
                    <div className="flex-1 min-w-0 truncate">
                      <span className="font-medium">
                        {cat.parentName ? `${cat.parentName} → ` : ''}
                        {cat.name || t('txNoCategory')}
                      </span>{' '}
                      <span className="text-[9.5px] text-muted-foreground">
                        · {cat.transactionCount !== 1 ? t('analyticsTransactionCountPlural', { count: cat.transactionCount }) : t('analyticsTransactionCount', { count: cat.transactionCount })}
                      </span>
                    </div>

                    {/* Amount */}
                    <div className={`font-semibold font-mono flex-shrink-0 ${viewType === 'expense' ? 'text-expense' : 'text-income'}`}>
                      {formatCurrency(cat.amount, 'EUR', numberLocale)}
                    </div>

                    {/* Percentage */}
                    <div className="w-11 text-right text-muted-foreground text-[10px] flex-shrink-0">
                      {cat.percentage}%
                    </div>

                    {/* Progress bar */}
                    <div className="w-[90px] hidden sm:block flex-shrink-0">
                      <div className="h-[5px] bg-background-surface rounded-full overflow-hidden">
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
              <h2 className="text-[12.5px] font-bold mb-4">
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
