import { Router } from 'express';
import { db } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import type { TransactionWithDetails, CreateTransactionRequest } from '@financer/shared';

export const transactionsRouter = Router();

transactionsRouter.use(authMiddleware);

// Get transactions with filters
transactionsRouter.get('/', (req, res) => {
  const { accountId, categoryId, startDate, endDate, limit = '50', offset = '0' } = req.query;

  let query = `
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
    WHERE 1=1
  `;

  const params: any[] = [];

  if (accountId) {
    query += ' AND t.account_id = ?';
    params.push(accountId);
  }

  if (categoryId) {
    query += ' AND t.category_id = ?';
    params.push(categoryId);
  }

  if (startDate) {
    query += ' AND t.date >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND t.date <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY t.date DESC, t.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit as string, 10), parseInt(offset as string, 10));

  const transactions = db.prepare(query).all(...params) as any[];

  const mapped: TransactionWithDetails[] = transactions.map(t => ({
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

  res.json({ success: true, data: mapped });
});

// Get single transaction
transactionsRouter.get('/:id', (req, res) => {
  const { id } = req.params;

  const transaction = db.prepare(`
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
    WHERE t.id = ?
  `).get(id) as any;

  if (!transaction) {
    res.status(404).json({ success: false, error: 'Transaktion nicht gefunden' });
    return;
  }

  const mapped: TransactionWithDetails = {
    id: transaction.id,
    accountId: transaction.account_id,
    categoryId: transaction.category_id ?? undefined,
    amount: transaction.amount,
    type: transaction.type,
    description: transaction.description ?? undefined,
    date: transaction.date,
    notes: transaction.notes ?? undefined,
    transferToAccountId: transaction.transfer_to_account_id ?? undefined,
    createdAt: transaction.created_at,
    updatedAt: transaction.updated_at,
    accountName: transaction.account_name,
    categoryName: transaction.category_name ?? undefined,
    categoryColor: transaction.category_color ?? undefined,
    parentCategoryName: transaction.parent_category_name ?? undefined,
    transferToAccountName: transaction.transfer_to_account_name ?? undefined,
  };

  res.json({ success: true, data: mapped });
});

// Create transaction
transactionsRouter.post('/', (req, res) => {
  const {
    accountId,
    categoryId,
    amount,
    type,
    description,
    date,
    notes,
    transferToAccountId,
  } = req.body as CreateTransactionRequest;

  if (!accountId || amount === undefined || !type || !date) {
    res.status(400).json({
      success: false,
      error: 'Konto, Betrag, Typ und Datum sind erforderlich',
    });
    return;
  }

  if (!['income', 'expense', 'transfer'].includes(type)) {
    res.status(400).json({ success: false, error: 'Ungültiger Transaktionstyp' });
    return;
  }

  if (type === 'transfer' && !transferToAccountId) {
    res.status(400).json({
      success: false,
      error: 'Zielkonto für Überweisung erforderlich',
    });
    return;
  }

  // Verify account exists
  const account = db.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId);
  if (!account) {
    res.status(400).json({ success: false, error: 'Konto nicht gefunden' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO transactions (account_id, category_id, amount, type, description, date, notes, transfer_to_account_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    accountId,
    categoryId || null,
    Math.abs(amount),
    type,
    description || null,
    date,
    notes || null,
    transferToAccountId || null
  );

  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);

  res.status(201).json({ success: true, data: transaction });
});

// Update transaction
transactionsRouter.put('/:id', (req, res) => {
  const { id } = req.params;
  const {
    accountId,
    categoryId,
    amount,
    type,
    description,
    date,
    notes,
    transferToAccountId,
  } = req.body;

  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Transaktion nicht gefunden' });
    return;
  }

  db.prepare(`
    UPDATE transactions
    SET account_id = COALESCE(?, account_id),
        category_id = ?,
        amount = COALESCE(?, amount),
        type = COALESCE(?, type),
        description = ?,
        date = COALESCE(?, date),
        notes = ?,
        transfer_to_account_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    accountId ?? null,
    categoryId ?? null,
    amount !== undefined ? Math.abs(amount) : null,
    type ?? null,
    description ?? null,
    date ?? null,
    notes ?? null,
    transferToAccountId ?? null,
    id
  );

  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);

  res.json({ success: true, data: transaction });
});

// Delete transaction
transactionsRouter.delete('/:id', (req, res) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Transaktion nicht gefunden' });
    return;
  }

  db.prepare('DELETE FROM transactions WHERE id = ?').run(id);

  res.json({ success: true, data: { success: true } });
});
