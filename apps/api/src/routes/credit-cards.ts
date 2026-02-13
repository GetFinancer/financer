import { Router } from 'express';
import { db } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import type { CreditCardBillWithDetails } from '@financer/shared';

export const creditCardsRouter = Router();

// All routes require authentication
creditCardsRouter.use(authMiddleware);

// Helper function to calculate billing period for a given month
function calculateBillingPeriod(billingDay: number, year: number, month: number) {
  // The billing period for month M ends on billingDay of month M
  // and starts on billingDay+1 of month M-1

  // Period end: billingDay of the given month
  const periodEndYear = year;
  const periodEndMonth = month;
  const lastDayOfEndMonth = new Date(periodEndYear, periodEndMonth, 0).getDate();
  const periodEndDay = Math.min(billingDay, lastDayOfEndMonth);
  const periodEnd = `${periodEndYear}-${String(periodEndMonth).padStart(2, '0')}-${String(periodEndDay).padStart(2, '0')}`;

  // Period start: billingDay+1 of previous month
  let periodStartYear = year;
  let periodStartMonth = month - 1;
  if (periodStartMonth < 1) {
    periodStartMonth = 12;
    periodStartYear--;
  }
  const lastDayOfStartMonth = new Date(periodStartYear, periodStartMonth, 0).getDate();
  const periodStartDay = Math.min(billingDay + 1, lastDayOfStartMonth);
  const periodStart = `${periodStartYear}-${String(periodStartMonth).padStart(2, '0')}-${String(periodStartDay).padStart(2, '0')}`;

  return { periodStart, periodEnd };
}

// Helper function to calculate payment date
function calculatePaymentDate(paymentDay: number, year: number, month: number) {
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const day = Math.min(paymentDay, lastDayOfMonth);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Get credit card bills for a specific month
creditCardsRouter.get('/bills/:year/:month', (req, res) => {
  const { year, month } = req.params;
  const yearNum = parseInt(year, 10);
  const monthNum = parseInt(month, 10);

  if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    res.status(400).json({ success: false, error: 'Ungültiges Jahr oder Monat' });
    return;
  }

  // Get all credit card accounts
  const creditCards = db.prepare(`
    SELECT
      a.*,
      la.name as linked_account_name
    FROM accounts a
    LEFT JOIN accounts la ON a.linked_account_id = la.id
    WHERE a.type = 'credit'
      AND a.billing_day IS NOT NULL
      AND a.payment_day IS NOT NULL
  `).all() as any[];

  const bills: CreditCardBillWithDetails[] = [];

  for (const card of creditCards) {
    const { periodStart, periodEnd } = calculateBillingPeriod(card.billing_day, yearNum, monthNum);
    const paymentDate = calculatePaymentDate(card.payment_day, yearNum, monthNum);

    // Calculate total expenses on this credit card for the billing period
    const totalResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE account_id = ?
        AND type = 'expense'
        AND date >= ?
        AND date <= ?
    `).get(card.id, periodStart, periodEnd) as { total: number };

    const amount = totalResult.total;

    // Skip if no transactions in this period
    if (amount === 0) {
      continue;
    }

    // Check if bill already exists in database
    let bill = db.prepare(`
      SELECT * FROM credit_card_bills
      WHERE account_id = ?
        AND period_start = ?
        AND period_end = ?
    `).get(card.id, periodStart, periodEnd) as any;

    // Create bill record if it doesn't exist
    if (!bill) {
      db.prepare(`
        INSERT INTO credit_card_bills (account_id, period_start, period_end, payment_date, amount)
        VALUES (?, ?, ?, ?, ?)
      `).run(card.id, periodStart, periodEnd, paymentDate, amount);

      bill = db.prepare(`
        SELECT * FROM credit_card_bills
        WHERE account_id = ?
          AND period_start = ?
          AND period_end = ?
      `).get(card.id, periodStart, periodEnd) as any;
    } else {
      // Update amount if it changed (new transactions added)
      if (bill.amount !== amount && !bill.completed) {
        db.prepare(`
          UPDATE credit_card_bills
          SET amount = ?, payment_date = ?
          WHERE id = ?
        `).run(amount, paymentDate, bill.id);
        bill.amount = amount;
        bill.payment_date = paymentDate;
      }
    }

    bills.push({
      id: bill.id,
      accountId: bill.account_id,
      periodStart: bill.period_start,
      periodEnd: bill.period_end,
      paymentDate: bill.payment_date,
      amount: bill.amount,
      completed: bill.completed === 1,
      completedAt: bill.completed_at ?? undefined,
      transactionId: bill.transaction_id ?? undefined,
      createdAt: bill.created_at,
      accountName: card.name,
      linkedAccountId: card.linked_account_id ?? undefined,
      linkedAccountName: card.linked_account_name ?? undefined,
    });
  }

  // Sort by payment date
  bills.sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));

  res.json({ success: true, data: bills });
});

// Toggle credit card bill completion
creditCardsRouter.post('/bills/:id/toggle', (req, res) => {
  const { id } = req.params;

  const bill = db.prepare('SELECT * FROM credit_card_bills WHERE id = ?').get(id) as any;
  if (!bill) {
    res.status(404).json({ success: false, error: 'Kreditkartenabrechnung nicht gefunden' });
    return;
  }

  // Get the credit card account
  const creditCard = db.prepare('SELECT * FROM accounts WHERE id = ?').get(bill.account_id) as any;
  if (!creditCard) {
    res.status(404).json({ success: false, error: 'Kreditkartenkonto nicht gefunden' });
    return;
  }

  const newCompleted = bill.completed === 1 ? 0 : 1;

  if (newCompleted === 1) {
    // Completing: Create a transfer transaction from linked account to credit card
    let transactionId = null;

    if (creditCard.linked_account_id) {
      // Create transfer from bank account to credit card
      const result = db.prepare(`
        INSERT INTO transactions (account_id, amount, type, description, date, transfer_to_account_id)
        VALUES (?, ?, 'transfer', ?, ?, ?)
      `).run(
        creditCard.linked_account_id,
        bill.amount,
        `Kreditkartenabrechnung ${creditCard.name}`,
        bill.payment_date,
        creditCard.id
      );
      transactionId = result.lastInsertRowid;
    }

    db.prepare(`
      UPDATE credit_card_bills
      SET completed = 1,
          completed_at = ?,
          transaction_id = ?
      WHERE id = ?
    `).run(new Date().toISOString(), transactionId, id);
  } else {
    // Uncompleting: Delete the associated transaction if exists
    if (bill.transaction_id) {
      db.prepare('DELETE FROM transactions WHERE id = ?').run(bill.transaction_id);
    }

    db.prepare(`
      UPDATE credit_card_bills
      SET completed = 0,
          completed_at = NULL,
          transaction_id = NULL
      WHERE id = ?
    `).run(id);
  }

  const updatedBill = db.prepare('SELECT * FROM credit_card_bills WHERE id = ?').get(id) as any;

  res.json({
    success: true,
    data: {
      completed: updatedBill.completed === 1,
    },
  });
});
