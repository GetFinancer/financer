// Account Types
export type AccountType = 'bank' | 'cash' | 'credit' | 'savings';

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  currency: string;
  initialBalance: number;
  color?: string;
  icon?: string;
  includeInBudget: boolean;
  isDefault: boolean; // Default account for new transactions
  // Credit card specific fields
  billingDay?: number; // Day of month when billing cycle ends (e.g., 20)
  paymentDay?: number; // Day of month when payment is due (e.g., 27)
  linkedAccountId?: number; // Bank account that pays the credit card
  createdAt: string;
  updatedAt: string;
}

export interface AccountWithBalance extends Account {
  balance: number;
  linkedAccountName?: string; // Name of linked account for credit cards
}

// Category Types
export type CategoryType = 'income' | 'expense';

export interface Category {
  id: number;
  name: string;
  type: CategoryType;
  color?: string;
  icon?: string;
  parentId?: number;
  createdAt: string;
}

// Transaction Types
export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Transaction {
  id: number;
  accountId: number;
  categoryId?: number;
  amount: number;
  type: TransactionType;
  description?: string;
  date: string;
  notes?: string;
  transferToAccountId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionWithDetails extends Transaction {
  accountName: string;
  categoryName?: string;
  categoryColor?: string;
  parentCategoryName?: string;
  transferToAccountName?: string;
}

// API Request/Response Types
export interface CreateAccountRequest {
  name: string;
  type: AccountType;
  currency?: string;
  initialBalance?: number;
  color?: string;
  icon?: string;
  includeInBudget?: boolean;
  isDefault?: boolean;
  // Credit card specific fields
  billingDay?: number;
  paymentDay?: number;
  linkedAccountId?: number;
}

export interface UpdateAccountRequest extends Partial<CreateAccountRequest> {}

export interface CreateCategoryRequest {
  name: string;
  type: CategoryType;
  color?: string;
  icon?: string;
  parentId?: number;
}

export interface UpdateCategoryRequest extends Partial<CreateCategoryRequest> {}

export interface CreateTransactionRequest {
  accountId: number;
  categoryId?: number;
  amount: number;
  type: TransactionType;
  description?: string;
  date: string;
  notes?: string;
  transferToAccountId?: number;
}

export interface UpdateTransactionRequest extends Partial<CreateTransactionRequest> {}

// Recurring Transaction Types
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannually' | 'yearly';

export interface RecurringTransaction {
  id: number;
  name: string;
  accountId?: number;
  categoryId?: number;
  amount: number;
  type: 'income' | 'expense';
  frequency: RecurringFrequency;
  dayOfWeek?: number; // 0-6 (Sonntag-Samstag)
  dayOfMonth?: number; // 1-31
  startDate: string;
  endDate?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTransactionWithDetails extends RecurringTransaction {
  accountName?: string;
  categoryName?: string;
  categoryColor?: string;
}

export interface RecurringInstance {
  id: number;
  recurringId: number;
  dueDate: string;
  completed: boolean;
  completedAt?: string;
  transactionId?: number;
  createdAt: string;
}

export interface RecurringInstanceWithDetails extends RecurringInstance {
  name: string;
  accountId?: number;
  accountName?: string;
  amount: number; // Effective amount (after exception applied)
  originalAmount: number; // Base amount from recurring transaction
  type: 'income' | 'expense';
  categoryName?: string;
  categoryColor?: string;
  isModified: boolean; // true if exception exists
  exceptionId?: number; // ID of exception if exists
  exceptionNote?: string; // Note from exception
}

export interface CreateRecurringTransactionRequest {
  name: string;
  accountId?: number;
  categoryId?: number;
  amount: number;
  type: 'income' | 'expense';
  frequency: RecurringFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  startDate: string;
  endDate?: string;
}

export interface UpdateRecurringTransactionRequest extends Partial<CreateRecurringTransactionRequest> {
  active?: boolean;
}

// Recurring Exception Types (for individual payment overrides)
export interface RecurringException {
  id: number;
  recurringId: number;
  date: string; // YYYY-MM-DD - the specific occurrence date
  amount?: number; // Override amount (null = use original)
  note?: string;
  skip: boolean; // true = skip this occurrence entirely
  createdAt: string;
}

export interface CreateRecurringExceptionRequest {
  date: string;
  amount?: number;
  note?: string;
  skip?: boolean;
}

export interface UpdateRecurringExceptionRequest {
  amount?: number;
  note?: string;
  skip?: boolean;
}

// Generated occurrence with exception applied
export interface RecurringOccurrence {
  date: string;
  originalAmount: number;
  effectiveAmount: number; // After exception applied
  isModified: boolean;
  isSkipped: boolean;
  note?: string;
  exception?: RecurringException;
}

// Credit Card Bill Types
export interface CreditCardBill {
  id: number;
  accountId: number;
  periodStart: string; // Start of billing period (YYYY-MM-DD)
  periodEnd: string; // End of billing period (YYYY-MM-DD)
  paymentDate: string; // When payment is due (YYYY-MM-DD)
  amount: number; // Total amount for the billing period
  completed: boolean;
  completedAt?: string;
  transactionId?: number; // Reference to the payment transaction
  createdAt: string;
}

export interface CreditCardBillWithDetails extends CreditCardBill {
  accountName: string;
  linkedAccountId?: number;
  linkedAccountName?: string;
}

// Dashboard Types
export interface DashboardSummary {
  totalBalance: number;
  budgetBalance: number; // Summe nur der Konten mit includeInBudget=true
  monthlyIncome: number;
  monthlyExpenses: number;
  accounts: AccountWithBalance[];
  recentTransactions: TransactionWithDetails[];
}

export interface ChartData {
  labels: string[];
  income: number[];
  expenses: number[];
}

// Auth Types
export interface AuthStatus {
  isAuthenticated: boolean;
  isSetupComplete: boolean;
  twoFactorEnabled: boolean;
  twoFactorRequired?: boolean; // true wenn Passwort korrekt aber 2FA noch aussteht
}

export interface LoginRequest {
  password: string;
  totpCode?: string;
}

export interface LoginResponse {
  success: boolean;
  requiresTwoFactor?: boolean;
  sessionToken?: string;
}

export interface SetupRequest {
  password: string;
}

// 2FA Types
export interface TwoFactorSetupResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface TwoFactorVerifyRequest {
  code: string;
}

export interface TwoFactorStatus {
  enabled: boolean;
  hasBackupCodes: boolean;
}

// Analytics Types
export interface CategoryStats {
  id: number;
  name: string;
  color: string | null;
  amount: number;
  percentage: number;
  transactionCount: number;
  parentName?: string;
}

export interface MonthlyTrend {
  month: string; // "Jan 26", "Feb 26", etc.
  expenses: number;
  income: number;
}

export interface MonthlyBreakdown {
  month: string;
  monthNum: number;
  expenses: number;
  income: number;
}

export interface AnalyticsData {
  period: {
    startDate: string;
    endDate: string;
  };
  expensesByCategory: CategoryStats[];
  incomeByCategory: CategoryStats[];
  totalExpenses: number;
  totalIncome: number;
  monthlyTrend: MonthlyTrend[];
  previousPeriod?: {
    totalExpenses: number;
    totalIncome: number;
  };
  monthlyBreakdown?: MonthlyBreakdown[];
  filterCategory?: {
    id: number;
    name: string;
    color: string | null;
  };
}

// Tenant & Billing Types
export type TenantPlan = 'trial' | 'active' | 'expired' | 'cancelled';

export interface TenantStatus {
  status: TenantPlan;
  trialEndsAt?: string;
  daysRemaining?: number;
  hasPaymentMethod: boolean;
  legacy?: boolean;
}

export interface RegisterRequest {
  tenant: string;
}

export interface RegisterResponse {
  tenant: string;
  url: string;
}

// Coupon Types
export type CouponType = 'trial_extension' | 'free_access' | 'discount';

export interface Coupon {
  code: string;
  type: CouponType;
  value: number;
  stripeCouponId: string | null;
  maxUses: number;
  timesUsed: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreateCouponRequest {
  code?: string;
  type: CouponType;
  value: number;
  maxUses?: number;
  expiresAt?: string;
  stripeCouponId?: string;
}

export interface RedeemCouponRequest {
  code: string;
}

export interface RedeemCouponResponse {
  success: boolean;
  error?: string;
  type?: CouponType;
  message?: string;
}

// Admin Types
export interface AdminLoginRequest {
  token: string;
}

export interface AdminStats {
  total: number;
  trial: number;
  active: number;
  expired: number;
  cancelled: number;
}

export interface AdminTenant {
  name: string;
  status: TenantPlan;
  createdAt: string;
  trialEndsAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export interface UpdateTenantRequest {
  status?: TenantPlan;
  trialEndsAt?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
