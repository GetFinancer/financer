import { Router } from 'express';
import { db } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import type { AccountWithBalance, CreateAccountRequest } from '@financer/shared';

// DB Row type (snake_case from SQLite)
interface AccountRow {
  id: number;
  name: string;
  type: string;
  currency: string;
  initial_balance: number;
  color: string | null;
  icon: string | null;
  include_in_budget: number;
  is_default: number;
  billing_day: number | null;
  payment_day: number | null;
  linked_account_id: number | null;
  linked_account_name?: string | null;
  created_at: string;
  updated_at: string;
  balance: number;
}

export const accountsRouter = Router();

// All routes require authentication
accountsRouter.use(authMiddleware);

// Get all accounts with balances
accountsRouter.get('/', (_req, res) => {
  const accounts = db.prepare(`
    SELECT
      a.*,
      la.name as linked_account_name,
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
    LEFT JOIN accounts la ON a.linked_account_id = la.id
    ORDER BY a.name
  `).all() as AccountRow[];

  const mapped: AccountWithBalance[] = accounts.map(a => ({
    id: a.id,
    name: a.name,
    type: a.type as AccountWithBalance['type'],
    currency: a.currency,
    initialBalance: a.initial_balance,
    color: a.color ?? undefined,
    icon: a.icon ?? undefined,
    includeInBudget: a.include_in_budget === 1,
    isDefault: a.is_default === 1,
    billingDay: a.billing_day ?? undefined,
    paymentDay: a.payment_day ?? undefined,
    linkedAccountId: a.linked_account_id ?? undefined,
    linkedAccountName: a.linked_account_name ?? undefined,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
    balance: a.balance,
  }));

  res.json({ success: true, data: mapped });
});

// Get single account
accountsRouter.get('/:id', (req, res) => {
  const { id } = req.params;

  const account = db.prepare(`
    SELECT
      a.*,
      la.name as linked_account_name,
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
    LEFT JOIN accounts la ON a.linked_account_id = la.id
    WHERE a.id = ?
  `).get(id) as AccountRow | undefined;

  if (!account) {
    res.status(404).json({ success: false, error: 'Konto nicht gefunden' });
    return;
  }

  const mapped: AccountWithBalance = {
    id: account.id,
    name: account.name,
    type: account.type as AccountWithBalance['type'],
    currency: account.currency,
    initialBalance: account.initial_balance,
    color: account.color ?? undefined,
    icon: account.icon ?? undefined,
    includeInBudget: account.include_in_budget === 1,
    isDefault: account.is_default === 1,
    billingDay: account.billing_day ?? undefined,
    paymentDay: account.payment_day ?? undefined,
    linkedAccountId: account.linked_account_id ?? undefined,
    linkedAccountName: account.linked_account_name ?? undefined,
    createdAt: account.created_at,
    updatedAt: account.updated_at,
    balance: account.balance,
  };

  res.json({ success: true, data: mapped });
});

// Create account
accountsRouter.post('/', (req, res) => {
  const { name, type, currency, initialBalance, color, icon, includeInBudget, isDefault, billingDay, paymentDay, linkedAccountId } = req.body as CreateAccountRequest;

  if (!name || !type) {
    res.status(400).json({ success: false, error: 'Name und Typ sind erforderlich' });
    return;
  }

  // Credit cards cannot be included in budget
  const shouldIncludeInBudget = type === 'credit' ? false : (includeInBudget !== false);

  // Validate credit card fields
  if (type === 'credit') {
    if (!billingDay || !paymentDay) {
      res.status(400).json({ success: false, error: 'Kreditkarten benötigen Abrechnungs- und Zahlungstag' });
      return;
    }
    if (billingDay < 1 || billingDay > 31 || paymentDay < 1 || paymentDay > 31) {
      res.status(400).json({ success: false, error: 'Ungültiger Tag (1-31)' });
      return;
    }
  }

  // If setting as default, clear other defaults first
  if (isDefault) {
    db.prepare('UPDATE accounts SET is_default = 0 WHERE is_default = 1').run();
  }

  const result = db.prepare(`
    INSERT INTO accounts (name, type, currency, initial_balance, color, icon, include_in_budget, is_default, billing_day, payment_day, linked_account_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name,
    type,
    currency || 'EUR',
    initialBalance || 0,
    color || null,
    icon || null,
    shouldIncludeInBudget ? 1 : 0,
    isDefault ? 1 : 0,
    type === 'credit' ? billingDay : null,
    type === 'credit' ? paymentDay : null,
    type === 'credit' ? (linkedAccountId || null) : null
  );

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);

  res.status(201).json({ success: true, data: account });
});

// Update account
accountsRouter.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, type, currency, initialBalance, color, icon, includeInBudget, isDefault, billingDay, paymentDay, linkedAccountId } = req.body;

    const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ success: false, error: 'Konto nicht gefunden' });
      return;
    }

    // Determine the effective type (existing or new)
    const effectiveType = type ?? existing.type;

    // Credit cards cannot be included in budget
    let effectiveIncludeInBudget = includeInBudget;
    if (effectiveType === 'credit') {
      effectiveIncludeInBudget = false;
    }

    // If setting as default, clear other defaults first
    if (isDefault === true) {
      db.prepare('UPDATE accounts SET is_default = 0 WHERE is_default = 1').run();
    }

    // Convert undefined to null for sql.js compatibility
    db.prepare(`
      UPDATE accounts
      SET name = COALESCE(?, name),
          type = COALESCE(?, type),
          currency = COALESCE(?, currency),
          initial_balance = COALESCE(?, initial_balance),
          color = ?,
          icon = ?,
          include_in_budget = COALESCE(?, include_in_budget),
          is_default = COALESCE(?, is_default),
          billing_day = ?,
          payment_day = ?,
          linked_account_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name ?? null,
      type ?? null,
      currency ?? null,
      initialBalance ?? null,
      color ?? null,
      icon ?? null,
      effectiveIncludeInBudget !== undefined ? (effectiveIncludeInBudget ? 1 : 0) : null,
      isDefault !== undefined ? (isDefault ? 1 : 0) : null,
      effectiveType === 'credit' ? (billingDay ?? existing.billing_day ?? null) : null,
      effectiveType === 'credit' ? (paymentDay ?? existing.payment_day ?? null) : null,
      effectiveType === 'credit' ? (linkedAccountId !== undefined ? linkedAccountId : existing.linked_account_id) : null,
      id
    );

    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);

    res.json({ success: true, data: account });
  } catch (err) {
    console.error('Update account error:', err);
    next(err);
  }
});

// Delete account
accountsRouter.delete('/:id', (req, res) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Konto nicht gefunden' });
    return;
  }

  // Check for transactions
  const transactionCount = db.prepare(
    'SELECT COUNT(*) as count FROM transactions WHERE account_id = ? OR transfer_to_account_id = ?'
  ).get(id, id) as { count: number };

  if (transactionCount.count > 0) {
    res.status(400).json({
      success: false,
      error: 'Konto kann nicht gelöscht werden, da noch Transaktionen vorhanden sind',
    });
    return;
  }

  db.prepare('DELETE FROM accounts WHERE id = ?').run(id);

  res.json({ success: true, data: { success: true } });
});
