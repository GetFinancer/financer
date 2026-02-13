import type {
  AuthStatus,
  DashboardSummary,
  ChartData,
  Account,
  AccountWithBalance,
  Category,
  Transaction,
  TransactionWithDetails,
  CreateAccountRequest,
  UpdateAccountRequest,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  CreateTransactionRequest,
  UpdateTransactionRequest,
  ApiResponse,
  TwoFactorSetupResponse,
  TwoFactorStatus,
  LoginResponse,
  RecurringTransaction,
  RecurringTransactionWithDetails,
  RecurringInstanceWithDetails,
  CreateRecurringTransactionRequest,
  UpdateRecurringTransactionRequest,
  RecurringException,
  RecurringOccurrence,
  CreateRecurringExceptionRequest,
  UpdateRecurringExceptionRequest,
  CreditCardBillWithDetails,
  AnalyticsData,
} from '@financer/shared';

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Use relative URL - Next.js rewrites will proxy to the API server
  const response = await fetch(`/api${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data: ApiResponse<T> = await response.json();

  if (response.status === 404 && data.error === 'Tenant not found') {
    window.location.href = 'https://getfinancer.com';
    throw new Error('Tenant not found');
  }

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'An error occurred');
  }

  return data.data as T;
}

export const api = {
  // Auth
  getAuthStatus: () => fetchApi<AuthStatus>('/auth/status'),

  login: (password: string, totpCode?: string) =>
    fetchApi<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password, totpCode }),
    }),

  logout: () =>
    fetchApi<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    }),

  setup: (password: string) =>
    fetchApi<{ success: boolean }>('/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    fetchApi<{ success: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // 2FA
  get2FAStatus: () => fetchApi<TwoFactorStatus & { backupCodesRemaining: number }>('/auth/2fa/status'),

  setup2FA: () => fetchApi<TwoFactorSetupResponse>('/auth/2fa/setup', {
    method: 'POST',
  }),

  verify2FA: (code: string) =>
    fetchApi<{ success: boolean }>('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  disable2FA: (password: string, code: string) =>
    fetchApi<{ success: boolean }>('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ password, code }),
    }),

  regenerateBackupCodes: (password: string) =>
    fetchApi<{ backupCodes: string[] }>('/auth/2fa/backup-codes/regenerate', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  // Dashboard
  getDashboardSummary: () => fetchApi<DashboardSummary>('/dashboard/summary'),

  getChartData: (months: number = 6) =>
    fetchApi<ChartData>(`/dashboard/chart?months=${months}`),

  // Accounts
  getAccounts: () => fetchApi<AccountWithBalance[]>('/accounts'),

  getAccount: (id: number) => fetchApi<AccountWithBalance>(`/accounts/${id}`),

  createAccount: (data: CreateAccountRequest) =>
    fetchApi<Account>('/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAccount: (id: number, data: UpdateAccountRequest) =>
    fetchApi<Account>(`/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteAccount: (id: number) =>
    fetchApi<{ success: boolean }>(`/accounts/${id}`, {
      method: 'DELETE',
    }),

  // Categories
  getCategories: () => fetchApi<Category[]>('/categories'),

  getCategory: (id: number) => fetchApi<Category>(`/categories/${id}`),

  createCategory: (data: CreateCategoryRequest) =>
    fetchApi<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCategory: (id: number, data: UpdateCategoryRequest) =>
    fetchApi<Category>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCategory: (id: number) =>
    fetchApi<{ success: boolean }>(`/categories/${id}`, {
      method: 'DELETE',
    }),

  // Transactions
  getTransactions: (params?: {
    accountId?: number;
    categoryId?: number;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return fetchApi<TransactionWithDetails[]>(
      `/transactions${query ? `?${query}` : ''}`
    );
  },

  getTransaction: (id: number) =>
    fetchApi<TransactionWithDetails>(`/transactions/${id}`),

  createTransaction: (data: CreateTransactionRequest) =>
    fetchApi<Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTransaction: (id: number, data: UpdateTransactionRequest) =>
    fetchApi<Transaction>(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTransaction: (id: number) =>
    fetchApi<{ success: boolean }>(`/transactions/${id}`, {
      method: 'DELETE',
    }),

  // Recurring Transactions
  getRecurringTransactions: () =>
    fetchApi<RecurringTransactionWithDetails[]>('/recurring'),

  getRecurringTransaction: (id: number) =>
    fetchApi<RecurringTransactionWithDetails>(`/recurring/${id}`),

  createRecurringTransaction: (data: CreateRecurringTransactionRequest) =>
    fetchApi<RecurringTransaction>('/recurring', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRecurringTransaction: (id: number, data: UpdateRecurringTransactionRequest) =>
    fetchApi<RecurringTransaction>(`/recurring/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteRecurringTransaction: (id: number) =>
    fetchApi<{ success: boolean }>(`/recurring/${id}`, {
      method: 'DELETE',
    }),

  getRecurringInstances: (year: number, month: number) =>
    fetchApi<RecurringInstanceWithDetails[]>(`/recurring/instances/${year}/${month}`),

  toggleRecurringInstance: (id: number) =>
    fetchApi<{ completed: boolean }>(`/recurring/instances/${id}/toggle`, {
      method: 'POST',
    }),

  // Recurring Exceptions (individual payment overrides)
  getRecurringExceptions: (recurringId: number) =>
    fetchApi<RecurringException[]>(`/recurring/${recurringId}/exceptions`),

  createRecurringException: (recurringId: number, data: CreateRecurringExceptionRequest) =>
    fetchApi<RecurringException>(`/recurring/${recurringId}/exceptions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRecurringException: (recurringId: number, exceptionId: number, data: UpdateRecurringExceptionRequest) =>
    fetchApi<RecurringException>(`/recurring/${recurringId}/exceptions/${exceptionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteRecurringException: (recurringId: number, exceptionId: number) =>
    fetchApi<{ success: boolean }>(`/recurring/${recurringId}/exceptions/${exceptionId}`, {
      method: 'DELETE',
    }),

  getRecurringOccurrences: (recurringId: number, from: string, to: string) =>
    fetchApi<RecurringOccurrence[]>(`/recurring/${recurringId}/occurrences?from=${from}&to=${to}`),

  updateRecurringAmountFromDate: (recurringId: number, amount: number, fromDate: string) =>
    fetchApi<RecurringTransaction>(`/recurring/${recurringId}/amount-from-date`, {
      method: 'PATCH',
      body: JSON.stringify({ amount, fromDate }),
    }),

  // Credit Card Bills
  getCreditCardBills: (year: number, month: number) =>
    fetchApi<CreditCardBillWithDetails[]>(`/credit-cards/bills/${year}/${month}`),

  toggleCreditCardBill: (id: number) =>
    fetchApi<{ completed: boolean }>(`/credit-cards/bills/${id}/toggle`, {
      method: 'POST',
    }),

  // Analytics
  getAnalytics: (startDate: string, endDate: string, categoryId?: number) => {
    let url = `/analytics/categories?startDate=${startDate}&endDate=${endDate}`;
    if (categoryId) {
      url += `&categoryId=${categoryId}`;
    }
    return fetchApi<AnalyticsData>(url);
  },
};
