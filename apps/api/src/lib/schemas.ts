import { z } from 'zod';
import { SECURITY } from '../config/constants.js';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss im Format YYYY-MM-DD sein');

// ── Auth ──────────────────────────────────────────────────────────────────────

export const SetupSchema = z.object({
  password: z.string().min(
    SECURITY.PASSWORD_MIN_LENGTH,
    `Passwort muss mindestens ${SECURITY.PASSWORD_MIN_LENGTH} Zeichen lang sein`
  ),
});

export const LoginSchema = z.object({
  password: z.string().min(1, 'Passwort ist erforderlich'),
  totpCode: z.string().optional(),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Aktuelles Passwort ist erforderlich'),
  newPassword: z.string().min(
    SECURITY.PASSWORD_MIN_LENGTH,
    `Neues Passwort muss mindestens ${SECURITY.PASSWORD_MIN_LENGTH} Zeichen lang sein`
  ),
});

export const TwoFACodeSchema = z.object({
  code: z.string().min(1, 'Code ist erforderlich'),
});

export const TwoFADisableSchema = z.object({
  password: z.string().min(1, 'Passwort ist erforderlich'),
  code: z.string().optional(),
});

export const BackupCodeRegenerateSchema = z.object({
  password: z.string().min(1, 'Passwort ist erforderlich'),
});

export const EmailSchema = z.object({
  email: z.string().refine(
    v => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
    'Ungültige E-Mail-Adresse'
  ),
});

// ── Register ──────────────────────────────────────────────────────────────────

export const RegisterTenantSchema = z.object({
  tenant: z.string().min(1, 'Tenant name is required'),
});

// ── Accounts ──────────────────────────────────────────────────────────────────

export const CreateAccountSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  type: z.enum(['bank', 'cash', 'credit', 'savings']),
  currency: z.string().optional(),
  initialBalance: z.number().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  includeInBudget: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  billingDay: z.number().int().min(1).max(31).optional(),
  paymentDay: z.number().int().min(1).max(31).optional(),
  linkedAccountId: z.number().int().optional(),
});

export const UpdateAccountSchema = CreateAccountSchema.partial();

// ── Transactions ──────────────────────────────────────────────────────────────

export const CreateTransactionSchema = z.object({
  accountId: z.number().int(),
  amount: z.number(),
  type: z.enum(['income', 'expense', 'transfer']),
  date: dateStr,
  categoryId: z.number().int().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  transferToAccountId: z.number().int().optional(),
});

export const UpdateTransactionSchema = CreateTransactionSchema.partial();

// ── Categories ────────────────────────────────────────────────────────────────

export const CreateCategorySchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  type: z.enum(['income', 'expense']),
  color: z.string().optional(),
  icon: z.string().optional(),
  parentId: z.number().int().optional(),
});

export const UpdateCategorySchema = CreateCategorySchema.partial();

// ── Recurring ─────────────────────────────────────────────────────────────────

export const CreateRecurringSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  amount: z.number(),
  type: z.enum(['income', 'expense', 'transfer']),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'bimonthly', 'quarterly', 'semiannually', 'yearly']),
  startDate: dateStr,
  accountId: z.number().int().optional(),
  categoryId: z.number().int().optional(),
  transferToAccountId: z.number().int().positive().optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  endDate: dateStr.optional(),
});

export const UpdateRecurringSchema = CreateRecurringSchema.partial().extend({
  active: z.boolean().optional(),
});

export const RecurringAmountFromDateSchema = z.object({
  amount: z.number(),
  fromDate: dateStr,
});

export const CreateRecurringExceptionSchema = z.object({
  date: dateStr,
  amount: z.number().optional(),
  note: z.string().optional(),
  skip: z.boolean().optional(),
});

export const UpdateRecurringExceptionSchema = z.object({
  amount: z.number().optional(),
  note: z.string().optional(),
  skip: z.boolean().optional(),
});
