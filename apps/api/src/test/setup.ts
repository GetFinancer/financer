import { beforeAll, afterEach, vi } from 'vitest';
import { AsyncLocalStorage } from 'node:async_hooks';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';

let sqlDb: SqlJsDatabase | null = null;

// Real AsyncLocalStorage for tenant context in tests
const testTenantStorage = new AsyncLocalStorage<string>();

// Mock the db module
vi.mock('../db/index.js', () => {
  const mockDb = {
    prepare(sql: string) {
      if (!sqlDb) throw new Error('Database not initialized');
      return {
        run(...params: any[]) {
          sqlDb!.run(sql, params);
          return { lastInsertRowid: sqlDb!.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] ?? 0 };
        },
        get(...params: any[]) {
          const stmt = sqlDb!.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const columns = stmt.getColumnNames();
            const values = stmt.get();
            const row: Record<string, any> = {};
            columns.forEach((col, i) => {
              row[col] = values[i];
            });
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        },
        all(...params: any[]) {
          const stmt = sqlDb!.prepare(sql);
          stmt.bind(params);
          const rows: Record<string, any>[] = [];
          while (stmt.step()) {
            const columns = stmt.getColumnNames();
            const values = stmt.get();
            const row: Record<string, any> = {};
            columns.forEach((col, i) => {
              row[col] = values[i];
            });
            rows.push(row);
          }
          stmt.free();
          return rows;
        },
      };
    },
    exec(sql: string) {
      if (!sqlDb) throw new Error('Database not initialized');
      sqlDb.run(sql);
    },
  };

  return {
    db: mockDb,
    tenantStorage: testTenantStorage,
    tenantExists: () => true,
    initTenantDatabase: async () => {},
    initSqlModule: async () => {},
    listTenants: () => ['test'],
  };
});

// Export functions to control the test database
async function createTestSchema() {
  const SQL = await initSqlJs();
  sqlDb = new SQL.Database();

  sqlDb.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`);

  sqlDb.run(`CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('bank', 'cash', 'credit', 'savings')),
    currency TEXT DEFAULT 'EUR',
    initial_balance REAL DEFAULT 0,
    color TEXT,
    icon TEXT,
    include_in_budget INTEGER DEFAULT 1,
    is_default INTEGER DEFAULT 0,
    billing_day INTEGER,
    payment_day INTEGER,
    linked_account_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  sqlDb.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    color TEXT,
    icon TEXT,
    parent_id INTEGER REFERENCES categories(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  sqlDb.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    category_id INTEGER REFERENCES categories(id),
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'transfer')),
    description TEXT,
    date TEXT NOT NULL,
    notes TEXT,
    transfer_to_account_id INTEGER REFERENCES accounts(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  sqlDb.run(`CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL,
    attempted_at TEXT DEFAULT CURRENT_TIMESTAMP,
    success INTEGER DEFAULT 0
  )`);

  sqlDb.run(`CREATE TABLE IF NOT EXISTS recurring_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    account_id INTEGER REFERENCES accounts(id),
    category_id INTEGER REFERENCES categories(id),
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly', 'bimonthly', 'quarterly', 'semiannually', 'yearly')),
    day_of_week INTEGER CHECK(day_of_week >= 0 AND day_of_week <= 6),
    day_of_month INTEGER CHECK(day_of_month >= 1 AND day_of_month <= 31),
    start_date TEXT NOT NULL,
    end_date TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  sqlDb.run(`CREATE TABLE IF NOT EXISTS recurring_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recurring_id INTEGER NOT NULL REFERENCES recurring_transactions(id) ON DELETE CASCADE,
    due_date TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    completed_at TEXT,
    transaction_id INTEGER REFERENCES transactions(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(recurring_id, due_date)
  )`);

  sqlDb.run(`CREATE TABLE IF NOT EXISTS recurring_exceptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recurring_id INTEGER NOT NULL REFERENCES recurring_transactions(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    amount REAL,
    note TEXT,
    skip INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(recurring_id, date)
  )`);

  sqlDb.run(`CREATE TABLE IF NOT EXISTS credit_card_bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    payment_date TEXT NOT NULL,
    amount REAL NOT NULL,
    completed INTEGER DEFAULT 0,
    completed_at TEXT,
    transaction_id INTEGER REFERENCES transactions(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, period_start, period_end)
  )`);
}

export async function initTestDatabase() {
  await createTestSchema();
}

export function resetTestDatabase() {
  if (sqlDb) {
    sqlDb.close();
    sqlDb = null;
  }
}

beforeAll(async () => {
  await initTestDatabase();
});

afterEach(() => {
  // Clear data between tests but keep schema
  if (sqlDb) {
    sqlDb.run('DELETE FROM transactions');
    sqlDb.run('DELETE FROM accounts');
    sqlDb.run('DELETE FROM categories');
    sqlDb.run('DELETE FROM settings');
    sqlDb.run('DELETE FROM login_attempts');
    sqlDb.run('DELETE FROM recurring_transactions');
    sqlDb.run('DELETE FROM recurring_instances');
    sqlDb.run('DELETE FROM recurring_exceptions');
    sqlDb.run('DELETE FROM credit_card_bills');
  }
});
