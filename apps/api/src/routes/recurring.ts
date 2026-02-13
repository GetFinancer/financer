import { Router } from 'express';
import { db } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import type {
  RecurringTransactionWithDetails,
  RecurringInstanceWithDetails,
  CreateRecurringTransactionRequest,
  RecurringException,
  RecurringOccurrence,
  CreateRecurringExceptionRequest,
  UpdateRecurringExceptionRequest,
} from '@financer/shared';

export const recurringRouter = Router();

recurringRouter.use(authMiddleware);

// Get all recurring transactions
recurringRouter.get('/', (req, res) => {
  const recurring = db.prepare(`
    SELECT
      r.*,
      a.name as account_name,
      c.name as category_name,
      c.color as category_color
    FROM recurring_transactions r
    LEFT JOIN accounts a ON r.account_id = a.id
    LEFT JOIN categories c ON r.category_id = c.id
    ORDER BY r.name ASC
  `).all() as any[];

  const mapped: RecurringTransactionWithDetails[] = recurring.map(r => ({
    id: r.id,
    name: r.name,
    accountId: r.account_id ?? undefined,
    categoryId: r.category_id ?? undefined,
    amount: r.amount,
    type: r.type,
    frequency: r.frequency,
    dayOfWeek: r.day_of_week ?? undefined,
    dayOfMonth: r.day_of_month ?? undefined,
    startDate: r.start_date,
    endDate: r.end_date ?? undefined,
    active: r.active === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    accountName: r.account_name ?? undefined,
    categoryName: r.category_name ?? undefined,
    categoryColor: r.category_color ?? undefined,
  }));

  res.json({ success: true, data: mapped });
});

// Get single recurring transaction
recurringRouter.get('/:id', (req, res) => {
  const { id } = req.params;

  const recurring = db.prepare(`
    SELECT
      r.*,
      a.name as account_name,
      c.name as category_name,
      c.color as category_color
    FROM recurring_transactions r
    LEFT JOIN accounts a ON r.account_id = a.id
    LEFT JOIN categories c ON r.category_id = c.id
    WHERE r.id = ?
  `).get(id) as any;

  if (!recurring) {
    res.status(404).json({ success: false, error: 'Wiederkehrende Transaktion nicht gefunden' });
    return;
  }

  const mapped: RecurringTransactionWithDetails = {
    id: recurring.id,
    name: recurring.name,
    accountId: recurring.account_id ?? undefined,
    categoryId: recurring.category_id ?? undefined,
    amount: recurring.amount,
    type: recurring.type,
    frequency: recurring.frequency,
    dayOfWeek: recurring.day_of_week ?? undefined,
    dayOfMonth: recurring.day_of_month ?? undefined,
    startDate: recurring.start_date,
    endDate: recurring.end_date ?? undefined,
    active: recurring.active === 1,
    createdAt: recurring.created_at,
    updatedAt: recurring.updated_at,
    accountName: recurring.account_name ?? undefined,
    categoryName: recurring.category_name ?? undefined,
    categoryColor: recurring.category_color ?? undefined,
  };

  res.json({ success: true, data: mapped });
});

// Create recurring transaction
recurringRouter.post('/', (req, res) => {
  const {
    name,
    accountId,
    categoryId,
    amount,
    type,
    frequency,
    dayOfWeek,
    dayOfMonth,
    startDate,
    endDate,
  } = req.body as CreateRecurringTransactionRequest;

  if (!name || amount === undefined || !type || !frequency || !startDate) {
    res.status(400).json({
      success: false,
      error: 'Name, Betrag, Typ, Häufigkeit und Startdatum sind erforderlich',
    });
    return;
  }

  if (!['income', 'expense'].includes(type)) {
    res.status(400).json({ success: false, error: 'Ungültiger Typ' });
    return;
  }

  const validFrequencies = ['daily', 'weekly', 'monthly', 'bimonthly', 'quarterly', 'semiannually', 'yearly'];
  if (!validFrequencies.includes(frequency)) {
    res.status(400).json({ success: false, error: 'Ungültige Häufigkeit' });
    return;
  }

  // Validate day_of_week for weekly
  if (frequency === 'weekly' && (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6)) {
    res.status(400).json({ success: false, error: 'Wochentag erforderlich (0-6)' });
    return;
  }

  // Validate day_of_month for monthly and longer intervals
  if (['monthly', 'bimonthly', 'quarterly', 'semiannually', 'yearly'].includes(frequency)) {
    if (dayOfMonth === undefined || dayOfMonth < 1 || dayOfMonth > 31) {
      res.status(400).json({ success: false, error: 'Tag des Monats erforderlich (1-31)' });
      return;
    }
  }

  const result = db.prepare(`
    INSERT INTO recurring_transactions (name, account_id, category_id, amount, type, frequency, day_of_week, day_of_month, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name,
    accountId || null,
    categoryId || null,
    Math.abs(amount),
    type,
    frequency,
    frequency === 'weekly' ? dayOfWeek : null,
    ['monthly', 'bimonthly', 'quarterly', 'semiannually', 'yearly'].includes(frequency) ? dayOfMonth : null,
    startDate,
    endDate || null
  );

  const recurring = db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(result.lastInsertRowid);

  res.status(201).json({ success: true, data: recurring });
});

// Update recurring transaction
recurringRouter.put('/:id', (req, res) => {
  const { id } = req.params;
  const {
    name,
    accountId,
    categoryId,
    amount,
    type,
    frequency,
    dayOfWeek,
    dayOfMonth,
    startDate,
    endDate,
    active,
  } = req.body;

  const existing = db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Wiederkehrende Transaktion nicht gefunden' });
    return;
  }

  db.prepare(`
    UPDATE recurring_transactions
    SET name = COALESCE(?, name),
        account_id = ?,
        category_id = ?,
        amount = COALESCE(?, amount),
        type = COALESCE(?, type),
        frequency = COALESCE(?, frequency),
        day_of_week = ?,
        day_of_month = ?,
        start_date = COALESCE(?, start_date),
        end_date = ?,
        active = COALESCE(?, active),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name ?? null,
    accountId ?? null,
    categoryId ?? null,
    amount !== undefined ? Math.abs(amount) : null,
    type ?? null,
    frequency ?? null,
    dayOfWeek ?? null,
    dayOfMonth ?? null,
    startDate ?? null,
    endDate ?? null,
    active !== undefined ? (active ? 1 : 0) : null,
    id
  );

  const recurring = db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(id);

  res.json({ success: true, data: recurring });
});

// Delete recurring transaction
recurringRouter.delete('/:id', (req, res) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Wiederkehrende Transaktion nicht gefunden' });
    return;
  }

  // Delete instances and exceptions first (cascade should handle this, but be explicit)
  db.prepare('DELETE FROM recurring_instances WHERE recurring_id = ?').run(id);
  db.prepare('DELETE FROM recurring_exceptions WHERE recurring_id = ?').run(id);
  db.prepare('DELETE FROM recurring_transactions WHERE id = ?').run(id);

  res.json({ success: true, data: { success: true } });
});

// Update amount for future instances (changes base amount and clears future exceptions)
recurringRouter.patch('/:id/amount-from-date', (req, res) => {
  const { id } = req.params;
  const { amount, fromDate } = req.body;

  if (amount === undefined || !fromDate) {
    res.status(400).json({ success: false, error: 'Betrag und Datum erforderlich' });
    return;
  }

  const existing = db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Wiederkehrende Transaktion nicht gefunden' });
    return;
  }

  // Update the base amount
  db.prepare(`
    UPDATE recurring_transactions
    SET amount = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(Math.abs(amount), id);

  // Delete exceptions for this date and all future dates (so they use the new amount)
  db.prepare(`
    DELETE FROM recurring_exceptions
    WHERE recurring_id = ? AND date >= ?
  `).run(id, fromDate);

  const recurring = db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(id);

  res.json({ success: true, data: recurring });
});

// Get instances for a specific month
recurringRouter.get('/instances/:year/:month', (req, res) => {
  const { year, month } = req.params;
  const yearNum = parseInt(year, 10);
  const monthNum = parseInt(month, 10);

  if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    res.status(400).json({ success: false, error: 'Ungültiges Jahr oder Monat' });
    return;
  }

  // Get all active recurring transactions
  const recurringList = db.prepare(`
    SELECT
      r.*,
      a.name as account_name,
      c.name as category_name,
      c.color as category_color
    FROM recurring_transactions r
    LEFT JOIN accounts a ON r.account_id = a.id
    LEFT JOIN categories c ON r.category_id = c.id
    WHERE r.active = 1
      AND r.start_date <= ?
      AND (r.end_date IS NULL OR r.end_date >= ?)
  `).all(
    `${yearNum}-${String(monthNum).padStart(2, '0')}-31`,
    `${yearNum}-${String(monthNum).padStart(2, '0')}-01`
  ) as any[];

  const instances: RecurringInstanceWithDetails[] = [];

  for (const r of recurringList) {
    const dueDates = calculateDueDatesForMonth(r, yearNum, monthNum);

    for (const dueDate of dueDates) {
      // Check if instance already exists
      let instance = db.prepare(`
        SELECT * FROM recurring_instances
        WHERE recurring_id = ? AND due_date = ?
      `).get(r.id, dueDate) as any;

      // Create instance if it doesn't exist
      if (!instance) {
        db.prepare(`
          INSERT INTO recurring_instances (recurring_id, due_date)
          VALUES (?, ?)
        `).run(r.id, dueDate);

        instance = db.prepare(`
          SELECT * FROM recurring_instances
          WHERE recurring_id = ? AND due_date = ?
        `).get(r.id, dueDate) as any;
      }

      // Check for exception on this date
      const exception = db.prepare(`
        SELECT * FROM recurring_exceptions
        WHERE recurring_id = ? AND date = ?
      `).get(r.id, dueDate) as any;

      // Skip this occurrence if exception says to skip
      if (exception && exception.skip === 1) {
        continue;
      }

      const effectiveAmount = exception?.amount ?? r.amount;

      instances.push({
        id: instance.id,
        recurringId: instance.recurring_id,
        dueDate: instance.due_date,
        completed: instance.completed === 1,
        completedAt: instance.completed_at ?? undefined,
        transactionId: instance.transaction_id ?? undefined,
        createdAt: instance.created_at,
        name: r.name,
        accountId: r.account_id ?? undefined,
        accountName: r.account_name ?? undefined,
        amount: effectiveAmount,
        originalAmount: r.amount,
        type: r.type,
        categoryName: r.category_name ?? undefined,
        categoryColor: r.category_color ?? undefined,
        isModified: !!exception,
        exceptionId: exception?.id ?? undefined,
        exceptionNote: exception?.note ?? undefined,
      });
    }
  }

  // Sort by due date
  instances.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  res.json({ success: true, data: instances });
});

// Toggle instance completion
recurringRouter.post('/instances/:id/toggle', (req, res) => {
  const { id } = req.params;

  const instance = db.prepare('SELECT * FROM recurring_instances WHERE id = ?').get(id) as any;
  if (!instance) {
    res.status(404).json({ success: false, error: 'Instanz nicht gefunden' });
    return;
  }

  // Get the recurring transaction details
  const recurring = db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(instance.recurring_id) as any;
  if (!recurring) {
    res.status(404).json({ success: false, error: 'Dauerauftrag nicht gefunden' });
    return;
  }

  const newCompleted = instance.completed === 1 ? 0 : 1;

  // Check for exception on this date to get effective amount
  const exception = db.prepare(`
    SELECT * FROM recurring_exceptions
    WHERE recurring_id = ? AND date = ?
  `).get(instance.recurring_id, instance.due_date) as any;

  const effectiveAmount = exception?.amount ?? recurring.amount;

  if (newCompleted === 1) {
    // Completing: Create a transaction if account is set
    let transactionId = null;
    const today = new Date().toISOString().split('T')[0];

    if (recurring.account_id) {
      const result = db.prepare(`
        INSERT INTO transactions (account_id, category_id, amount, type, description, date)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        recurring.account_id,
        recurring.category_id || null,
        effectiveAmount,
        recurring.type,
        recurring.name,
        today // Use actual completion date, not scheduled due date
      );
      transactionId = result.lastInsertRowid;
    }

    db.prepare(`
      UPDATE recurring_instances
      SET completed = 1,
          completed_at = ?,
          transaction_id = ?
      WHERE id = ?
    `).run(new Date().toISOString(), transactionId, id);
  } else {
    // Uncompleting: Delete the associated transaction if exists
    if (instance.transaction_id) {
      db.prepare('DELETE FROM transactions WHERE id = ?').run(instance.transaction_id);
    }

    db.prepare(`
      UPDATE recurring_instances
      SET completed = 0,
          completed_at = NULL,
          transaction_id = NULL
      WHERE id = ?
    `).run(id);
  }

  const updated = db.prepare('SELECT * FROM recurring_instances WHERE id = ?').get(id);

  res.json({ success: true, data: updated });
});

// ============================================
// Exception Routes (for individual payment overrides)
// ============================================

// Get all exceptions for a recurring transaction
recurringRouter.get('/:id/exceptions', (req, res) => {
  const { id } = req.params;

  const recurring = db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(id);
  if (!recurring) {
    res.status(404).json({ success: false, error: 'Dauerauftrag nicht gefunden' });
    return;
  }

  const exceptions = db.prepare(`
    SELECT * FROM recurring_exceptions
    WHERE recurring_id = ?
    ORDER BY date ASC
  `).all(id) as any[];

  const mapped: RecurringException[] = exceptions.map(e => ({
    id: e.id,
    recurringId: e.recurring_id,
    date: e.date,
    amount: e.amount ?? undefined,
    note: e.note ?? undefined,
    skip: e.skip === 1,
    createdAt: e.created_at,
  }));

  res.json({ success: true, data: mapped });
});

// Create exception for a specific date
recurringRouter.post('/:id/exceptions', (req, res) => {
  const { id } = req.params;
  const { date, amount, note, skip } = req.body as CreateRecurringExceptionRequest;

  if (!date) {
    res.status(400).json({ success: false, error: 'Datum ist erforderlich' });
    return;
  }

  const recurring = db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(id);
  if (!recurring) {
    res.status(404).json({ success: false, error: 'Dauerauftrag nicht gefunden' });
    return;
  }

  // Check if exception already exists for this date
  const existing = db.prepare(`
    SELECT * FROM recurring_exceptions WHERE recurring_id = ? AND date = ?
  `).get(id, date);

  if (existing) {
    res.status(409).json({ success: false, error: 'Für dieses Datum existiert bereits eine Ausnahme' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO recurring_exceptions (recurring_id, date, amount, note, skip)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, date, amount ?? null, note ?? null, skip ? 1 : 0);

  const exception = db.prepare('SELECT * FROM recurring_exceptions WHERE id = ?').get(result.lastInsertRowid) as any;

  const mapped: RecurringException = {
    id: exception.id,
    recurringId: exception.recurring_id,
    date: exception.date,
    amount: exception.amount ?? undefined,
    note: exception.note ?? undefined,
    skip: exception.skip === 1,
    createdAt: exception.created_at,
  };

  res.status(201).json({ success: true, data: mapped });
});

// Update exception
recurringRouter.put('/:id/exceptions/:exceptionId', (req, res) => {
  const { id, exceptionId } = req.params;
  const { amount, note, skip } = req.body as UpdateRecurringExceptionRequest;

  const exception = db.prepare(`
    SELECT * FROM recurring_exceptions WHERE id = ? AND recurring_id = ?
  `).get(exceptionId, id) as any;

  if (!exception) {
    res.status(404).json({ success: false, error: 'Ausnahme nicht gefunden' });
    return;
  }

  db.prepare(`
    UPDATE recurring_exceptions
    SET amount = ?,
        note = ?,
        skip = ?
    WHERE id = ?
  `).run(
    amount !== undefined ? amount : exception.amount,
    note !== undefined ? note : exception.note,
    skip !== undefined ? (skip ? 1 : 0) : exception.skip,
    exceptionId
  );

  const updated = db.prepare('SELECT * FROM recurring_exceptions WHERE id = ?').get(exceptionId) as any;

  const mapped: RecurringException = {
    id: updated.id,
    recurringId: updated.recurring_id,
    date: updated.date,
    amount: updated.amount ?? undefined,
    note: updated.note ?? undefined,
    skip: updated.skip === 1,
    createdAt: updated.created_at,
  };

  res.json({ success: true, data: mapped });
});

// Delete exception
recurringRouter.delete('/:id/exceptions/:exceptionId', (req, res) => {
  const { id, exceptionId } = req.params;

  const exception = db.prepare(`
    SELECT * FROM recurring_exceptions WHERE id = ? AND recurring_id = ?
  `).get(exceptionId, id);

  if (!exception) {
    res.status(404).json({ success: false, error: 'Ausnahme nicht gefunden' });
    return;
  }

  db.prepare('DELETE FROM recurring_exceptions WHERE id = ?').run(exceptionId);

  res.json({ success: true, data: { success: true } });
});

// Get occurrences for a date range with exceptions applied
recurringRouter.get('/:id/occurrences', (req, res) => {
  const { id } = req.params;
  const { from, to } = req.query;

  if (!from || !to) {
    res.status(400).json({ success: false, error: 'from und to Parameter sind erforderlich (YYYY-MM-DD)' });
    return;
  }

  const recurring = db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(id) as any;
  if (!recurring) {
    res.status(404).json({ success: false, error: 'Dauerauftrag nicht gefunden' });
    return;
  }

  // Get all exceptions for this recurring transaction
  const exceptions = db.prepare(`
    SELECT * FROM recurring_exceptions
    WHERE recurring_id = ? AND date >= ? AND date <= ?
  `).all(id, from, to) as any[];

  const exceptionMap = new Map<string, any>();
  for (const e of exceptions) {
    exceptionMap.set(e.date, e);
  }

  // Calculate all occurrence dates in the range
  const fromDate = new Date(from as string);
  const toDate = new Date(to as string);
  const allDates = calculateOccurrencesInRange(recurring, fromDate, toDate);

  const occurrences: RecurringOccurrence[] = allDates.map(date => {
    const exception = exceptionMap.get(date);
    const isSkipped = exception?.skip === 1;
    const effectiveAmount = exception?.amount ?? recurring.amount;

    return {
      date,
      originalAmount: recurring.amount,
      effectiveAmount: isSkipped ? 0 : effectiveAmount,
      isModified: !!exception && (exception.amount !== null || exception.note !== null),
      isSkipped,
      note: exception?.note ?? undefined,
      exception: exception ? {
        id: exception.id,
        recurringId: exception.recurring_id,
        date: exception.date,
        amount: exception.amount ?? undefined,
        note: exception.note ?? undefined,
        skip: exception.skip === 1,
        createdAt: exception.created_at,
      } : undefined,
    };
  });

  res.json({ success: true, data: occurrences });
});

// Helper: Calculate all occurrence dates in a date range
function calculateOccurrencesInRange(recurring: any, fromDate: Date, toDate: Date): string[] {
  const occurrences: string[] = [];
  const startDate = new Date(recurring.start_date);
  const endDate = recurring.end_date ? new Date(recurring.end_date) : null;

  // Iterate through each month in the range
  const currentMonth = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  const endMonth = new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0);

  while (currentMonth <= endMonth) {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    const dates = calculateDueDatesForMonth(recurring, year, month);

    for (const date of dates) {
      const d = new Date(date);
      if (d >= fromDate && d <= toDate) {
        if (d >= startDate && (!endDate || d <= endDate)) {
          occurrences.push(date);
        }
      }
    }

    currentMonth.setMonth(currentMonth.getMonth() + 1);
  }

  return occurrences;
}

// Helper: Calculate due dates for a recurring transaction in a specific month
function calculateDueDatesForMonth(recurring: any, year: number, month: number): string[] {
  const dueDates: string[] = [];
  const startDate = new Date(recurring.start_date);
  const endDate = recurring.end_date ? new Date(recurring.end_date) : null;

  // First day of the month
  const monthStart = new Date(year, month - 1, 1);
  // Last day of the month
  const monthEnd = new Date(year, month, 0);

  const daysInMonth = monthEnd.getDate();

  switch (recurring.frequency) {
    case 'daily': {
      // Every day in the month
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        if (date >= startDate && (!endDate || date <= endDate)) {
          dueDates.push(formatDate(date));
        }
      }
      break;
    }

    case 'weekly': {
      // Find all occurrences of the specified weekday
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        if (date.getDay() === recurring.day_of_week) {
          if (date >= startDate && (!endDate || date <= endDate)) {
            dueDates.push(formatDate(date));
          }
        }
      }
      break;
    }

    case 'monthly': {
      const dayOfMonth = Math.min(recurring.day_of_month, daysInMonth);
      const date = new Date(year, month - 1, dayOfMonth);
      if (date >= startDate && (!endDate || date <= endDate)) {
        dueDates.push(formatDate(date));
      }
      break;
    }

    case 'bimonthly': {
      // Every 2 months
      const monthsSinceStart = (year - startDate.getFullYear()) * 12 + (month - 1 - startDate.getMonth());
      if (monthsSinceStart >= 0 && monthsSinceStart % 2 === 0) {
        const dayOfMonth = Math.min(recurring.day_of_month, daysInMonth);
        const date = new Date(year, month - 1, dayOfMonth);
        if (date >= startDate && (!endDate || date <= endDate)) {
          dueDates.push(formatDate(date));
        }
      }
      break;
    }

    case 'quarterly': {
      // Every 3 months
      const monthsSinceStart = (year - startDate.getFullYear()) * 12 + (month - 1 - startDate.getMonth());
      if (monthsSinceStart >= 0 && monthsSinceStart % 3 === 0) {
        const dayOfMonth = Math.min(recurring.day_of_month, daysInMonth);
        const date = new Date(year, month - 1, dayOfMonth);
        if (date >= startDate && (!endDate || date <= endDate)) {
          dueDates.push(formatDate(date));
        }
      }
      break;
    }

    case 'semiannually': {
      // Every 6 months
      const monthsSinceStart = (year - startDate.getFullYear()) * 12 + (month - 1 - startDate.getMonth());
      if (monthsSinceStart >= 0 && monthsSinceStart % 6 === 0) {
        const dayOfMonth = Math.min(recurring.day_of_month, daysInMonth);
        const date = new Date(year, month - 1, dayOfMonth);
        if (date >= startDate && (!endDate || date <= endDate)) {
          dueDates.push(formatDate(date));
        }
      }
      break;
    }

    case 'yearly': {
      // Once a year - check if this is the start month
      if (month - 1 === startDate.getMonth()) {
        const dayOfMonth = Math.min(recurring.day_of_month, daysInMonth);
        const date = new Date(year, month - 1, dayOfMonth);
        if (date >= startDate && (!endDate || date <= endDate)) {
          dueDates.push(formatDate(date));
        }
      }
      break;
    }
  }

  return dueDates;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
