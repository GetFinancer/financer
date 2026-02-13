import { AsyncLocalStorage } from 'node:async_hooks';
import initSqlJs, { Database as SqlJsDatabase, SqlJsStatic } from 'sql.js';
import path from 'path';
import fs from 'fs';

// Base data directory for all tenant databases
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');

// AsyncLocalStorage to track which tenant the current request belongs to
export const tenantStorage = new AsyncLocalStorage<string>();

// Map of tenant name -> loaded SQLite database
const tenantDbs = new Map<string, SqlJsDatabase>();

// sql.js WASM module (loaded once at startup)
let SQL: SqlJsStatic | null = null;

// Get current tenant's database from AsyncLocalStorage context
function getCurrentTenantDb(): SqlJsDatabase {
  const tenant = tenantStorage.getStore();
  if (!tenant) throw new Error('No tenant context - request missing tenant middleware?');
  const sqlDb = tenantDbs.get(tenant);
  if (!sqlDb) throw new Error(`Database not loaded for tenant: ${tenant}`);
  return sqlDb;
}

// Database wrapper - same API as before, but tenant-aware via AsyncLocalStorage
export const db = {
  prepare(sql: string) {
    return {
      run(...params: any[]) {
        const sqlDb = getCurrentTenantDb();
        sqlDb.run(sql, params);
        return { lastInsertRowid: sqlDb.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] ?? 0 };
      },
      get(...params: any[]) {
        const sqlDb = getCurrentTenantDb();
        const stmt = sqlDb.prepare(sql);
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
        const sqlDb = getCurrentTenantDb();
        const stmt = sqlDb.prepare(sql);
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
    const sqlDb = getCurrentTenantDb();
    sqlDb.exec(sql);
  },
};

// Get filesystem path for a tenant's database
function getTenantDbPath(tenant: string): string {
  return path.join(dataDir, tenant, 'financer.db');
}

// Save a specific tenant's database to disk
function saveTenantDatabase(tenant: string) {
  const sqlDb = tenantDbs.get(tenant);
  if (!sqlDb) return;

  const dbPath = getTenantDbPath(tenant);
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const data = sqlDb.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

// Save all loaded tenant databases
function saveAllDatabases() {
  for (const tenant of tenantDbs.keys()) {
    try {
      saveTenantDatabase(tenant);
    } catch (e) {
      console.error(`Failed to save database for tenant ${tenant}:`, e);
    }
  }
}

// Auto-save every 5 seconds
setInterval(saveAllDatabases, 5000);

// Save all on process exit
process.on('beforeExit', saveAllDatabases);
process.on('SIGINT', () => {
  saveAllDatabases();
  process.exit(0);
});
process.on('SIGTERM', () => {
  saveAllDatabases();
  process.exit(0);
});

// Initialize sql.js WASM module (call once at startup)
export async function initSqlModule() {
  if (!SQL) {
    SQL = await initSqlJs();
    console.log('sql.js module initialized');
  }
}

// Check if a tenant has an existing database
export function tenantExists(tenant: string): boolean {
  return fs.existsSync(getTenantDbPath(tenant));
}

// List all existing tenants
export function listTenants(): string[] {
  if (!fs.existsSync(dataDir)) return [];
  return fs.readdirSync(dataDir).filter(name => {
    const tenantPath = path.join(dataDir, name);
    return fs.statSync(tenantPath).isDirectory() &&
           fs.existsSync(path.join(tenantPath, 'financer.db'));
  });
}

// Initialize or load a tenant's database (lazy, called on first request)
export async function initTenantDatabase(tenant: string): Promise<void> {
  if (tenantDbs.has(tenant)) return; // Already loaded

  if (!SQL) await initSqlModule();

  const dbPath = getTenantDbPath(tenant);
  let sqlDb: SqlJsDatabase;

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    sqlDb = new SQL!.Database(buffer);
    console.log(`Loaded database for tenant: ${tenant}`);
  } else {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    sqlDb = new SQL!.Database();
    console.log(`Created new database for tenant: ${tenant}`);
  }

  tenantDbs.set(tenant, sqlDb);

  // Run schema initialization within tenant context
  tenantStorage.run(tenant, () => {
    initSchema();
  });

  // Save immediately
  saveTenantDatabase(tenant);
}

// Schema initialization (runs per tenant)
function initSchema() {
  // Settings table (for password hash etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Accounts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('bank', 'cash', 'credit', 'savings')),
      currency TEXT DEFAULT 'EUR',
      initial_balance REAL DEFAULT 0,
      color TEXT,
      icon TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Categories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      color TEXT,
      icon TEXT,
      parent_id INTEGER REFERENCES categories(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Transactions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
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
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);
  `);

  // Login attempts table for rate limiting
  db.exec(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT NOT NULL,
      attempted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      success INTEGER DEFAULT 0
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
    CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts(attempted_at);
  `);

  // Recurring transactions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
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
    )
  `);

  // Recurring transaction instances
  db.exec(`
    CREATE TABLE IF NOT EXISTS recurring_instances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recurring_id INTEGER NOT NULL REFERENCES recurring_transactions(id) ON DELETE CASCADE,
      due_date TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      completed_at TEXT,
      transaction_id INTEGER REFERENCES transactions(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(recurring_id, due_date)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_recurring_instances_date ON recurring_instances(due_date);
    CREATE INDEX IF NOT EXISTS idx_recurring_instances_recurring ON recurring_instances(recurring_id);
  `);

  // Recurring exceptions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS recurring_exceptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recurring_id INTEGER NOT NULL REFERENCES recurring_transactions(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      amount REAL,
      note TEXT,
      skip INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(recurring_id, date)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_recurring_exceptions_recurring ON recurring_exceptions(recurring_id);
    CREATE INDEX IF NOT EXISTS idx_recurring_exceptions_date ON recurring_exceptions(date);
  `);

  // Migrations
  try { db.exec(`ALTER TABLE accounts ADD COLUMN include_in_budget INTEGER DEFAULT 1`); } catch (e) { /* exists */ }
  try { db.exec(`ALTER TABLE recurring_transactions ADD COLUMN account_id INTEGER REFERENCES accounts(id)`); } catch (e) { /* exists */ }
  try { db.exec(`ALTER TABLE accounts ADD COLUMN billing_day INTEGER`); } catch (e) { /* exists */ }
  try { db.exec(`ALTER TABLE accounts ADD COLUMN payment_day INTEGER`); } catch (e) { /* exists */ }
  try { db.exec(`ALTER TABLE accounts ADD COLUMN linked_account_id INTEGER REFERENCES accounts(id)`); } catch (e) { /* exists */ }
  try { db.exec(`ALTER TABLE accounts ADD COLUMN is_default INTEGER DEFAULT 0`); } catch (e) { /* exists */ }

  // Credit card bills table
  db.exec(`
    CREATE TABLE IF NOT EXISTS credit_card_bills (
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
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_credit_card_bills_account ON credit_card_bills(account_id);
    CREATE INDEX IF NOT EXISTS idx_credit_card_bills_payment_date ON credit_card_bills(payment_date);
  `);

  // Insert default categories if none exist
  const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };

  if (categoryCount.count === 0) {
    const defaultCategories = [
      { name: 'Gehalt', type: 'income', color: '#22c55e' },
      { name: 'Freelance', type: 'income', color: '#10b981' },
      { name: 'Sonstiges Einkommen', type: 'income', color: '#14b8a6' },
      { name: 'Wohnen', type: 'expense', color: '#ef4444' },
      { name: 'Lebensmittel', type: 'expense', color: '#f97316' },
      { name: 'Transport', type: 'expense', color: '#eab308' },
      { name: 'Freizeit', type: 'expense', color: '#8b5cf6' },
      { name: 'Shopping', type: 'expense', color: '#ec4899' },
      { name: 'Gesundheit', type: 'expense', color: '#06b6d4' },
      { name: 'Bildung', type: 'expense', color: '#3b82f6' },
      { name: 'Sonstiges', type: 'expense', color: '#6b7280' },
    ];

    for (const cat of defaultCategories) {
      db.prepare('INSERT INTO categories (name, type, color) VALUES (?, ?, ?)').run(cat.name, cat.type, cat.color);
    }
  }

  console.log('Schema initialized');
}
