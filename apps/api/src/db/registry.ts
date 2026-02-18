import initSqlJs, { Database as SqlJsDatabase, SqlJsStatic } from 'sql.js';
import path from 'path';
import fs from 'fs';
import type { TenantPlan } from '@financer/shared';

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const registryDir = path.join(dataDir, '_registry');
const registryDbPath = path.join(registryDir, 'registry.db');

let SQL: SqlJsStatic | null = null;
let registryDb: SqlJsDatabase | null = null;

function getDb(): SqlJsDatabase {
  if (!registryDb) throw new Error('Registry not initialized. Call initRegistry() first.');
  return registryDb;
}

function saveRegistry() {
  if (!registryDb) return;
  if (!fs.existsSync(registryDir)) {
    fs.mkdirSync(registryDir, { recursive: true });
  }
  const data = registryDb.export();
  fs.writeFileSync(registryDbPath, Buffer.from(data));
}

// Auto-save every 5 seconds
let saveInterval: ReturnType<typeof setInterval> | null = null;

export async function initRegistry() {
  if (registryDb) return;

  if (!SQL) {
    SQL = await initSqlJs();
  }

  if (fs.existsSync(registryDbPath)) {
    const buffer = fs.readFileSync(registryDbPath);
    registryDb = new SQL.Database(buffer);
    console.log('Loaded tenant registry');
  } else {
    if (!fs.existsSync(registryDir)) {
      fs.mkdirSync(registryDir, { recursive: true });
    }
    registryDb = new SQL.Database();
    console.log('Created new tenant registry');
  }

  // Create schema
  registryDb.run(`
    CREATE TABLE IF NOT EXISTS tenants (
      name TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'trial',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      trial_ends_at TEXT,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT
    )
  `);

  // Coupons schema
  registryDb.run(`
    CREATE TABLE IF NOT EXISTS coupons (
      code TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      value INTEGER,
      stripe_coupon_id TEXT,
      max_uses INTEGER DEFAULT 1,
      times_used INTEGER DEFAULT 0,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  registryDb.run(`
    CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coupon_code TEXT NOT NULL REFERENCES coupons(code),
      tenant_name TEXT NOT NULL,
      redeemed_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  saveRegistry();

  // Auto-save
  if (!saveInterval) {
    saveInterval = setInterval(saveRegistry, 5000);
  }
}

export function saveRegistrySync() {
  saveRegistry();
}

export function tenantNameAvailable(name: string): boolean {
  const db = getDb();
  const stmt = db.prepare('SELECT name FROM tenants WHERE name = ?');
  stmt.bind([name]);
  const exists = stmt.step();
  stmt.free();
  // Also check if directory exists (legacy tenant without registry entry)
  const tenantDir = path.join(dataDir, name);
  return !exists && !fs.existsSync(tenantDir);
}

export function registerTenant(name: string): void {
  const db = getDb();
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  // Create tenant directory FIRST — if this fails, no DB entry is created
  const tenantDir = path.join(dataDir, name);
  if (!fs.existsSync(tenantDir)) {
    fs.mkdirSync(tenantDir, { recursive: true });
  }

  const stmt = db.prepare('INSERT INTO tenants (name, status, trial_ends_at) VALUES (?, ?, ?)');
  try {
    stmt.run([name, 'trial', trialEndsAt]);
  } catch (err) {
    // Rollback: remove directory if DB insert fails
    try { fs.rmdirSync(tenantDir); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    stmt.free();
  }

  saveRegistry();
}

export function getTenantStatus(name: string): {
  status: TenantPlan;
  trialEndsAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
} | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM tenants WHERE name = ?');
  stmt.bind([name]);

  if (stmt.step()) {
    const columns = stmt.getColumnNames();
    const values = stmt.get();
    const row: Record<string, any> = {};
    columns.forEach((col, i) => { row[col] = values[i]; });
    stmt.free();

    // Lazy check: if trial has expired, update status
    let status = row.status as TenantPlan;
    if (status === 'trial' && row.trial_ends_at) {
      if (new Date(row.trial_ends_at) < new Date()) {
        status = 'expired';
        updateTenantStatus(name, 'expired');
      }
    }

    return {
      status,
      trialEndsAt: row.trial_ends_at,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      createdAt: row.created_at,
    };
  }

  stmt.free();
  return null; // Not in registry = legacy tenant
}

export function updateTenantStatus(name: string, status: TenantPlan): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE tenants SET status = ? WHERE name = ?');
  stmt.run([status, name]);
  stmt.free();
  saveRegistry();
}

export function updateTenantStripe(
  name: string,
  customerId: string,
  subscriptionId: string
): void {
  const db = getDb();
  const stmt = db.prepare(
    'UPDATE tenants SET stripe_customer_id = ?, stripe_subscription_id = ?, status = ? WHERE name = ?'
  );
  stmt.run([customerId, subscriptionId, 'active', name]);
  stmt.free();
  saveRegistry();
}

export function getRegisteredTenants(): Array<{
  name: string;
  status: TenantPlan;
  createdAt: string;
  trialEndsAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}> {
  const db = getDb();
  const results = db.exec('SELECT name, status, created_at, trial_ends_at, stripe_customer_id, stripe_subscription_id FROM tenants ORDER BY created_at DESC');
  if (results.length === 0) return [];

  const columns = results[0].columns;
  return results[0].values.map((row) => {
    const obj: Record<string, any> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return {
      name: obj.name,
      status: obj.status as TenantPlan,
      createdAt: obj.created_at,
      trialEndsAt: obj.trial_ends_at,
      stripeCustomerId: obj.stripe_customer_id,
      stripeSubscriptionId: obj.stripe_subscription_id,
    };
  });
}

export function updateTenantTrialEnd(name: string, trialEndsAt: string): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE tenants SET trial_ends_at = ?, status = ? WHERE name = ?');
  stmt.run([trialEndsAt, 'trial', name]);
  stmt.free();
  saveRegistry();
}

export function deleteTenant(name: string): void {
  const db = getDb();
  // Delete redemptions first
  const stmt1 = db.prepare('DELETE FROM coupon_redemptions WHERE tenant_name = ?');
  stmt1.run([name]);
  stmt1.free();
  // Delete tenant
  const stmt2 = db.prepare('DELETE FROM tenants WHERE name = ?');
  stmt2.run([name]);
  stmt2.free();
  // Delete directory
  const tenantDir = path.join(dataDir, name);
  if (fs.existsSync(tenantDir)) {
    fs.rmSync(tenantDir, { recursive: true, force: true });
  }
  saveRegistry();
}

// Clean up orphaned tenants (registry entry exists but no directory on disk)
export function cleanupOrphanedTenants(): Array<{ name: string; action: string }> {
  const tenants = getRegisteredTenants();
  const cleaned: Array<{ name: string; action: string }> = [];

  for (const tenant of tenants) {
    const tenantDir = path.join(dataDir, tenant.name);
    if (!fs.existsSync(tenantDir)) {
      // Registry entry without directory — remove from registry
      const db = getDb();
      const stmt1 = db.prepare('DELETE FROM coupon_redemptions WHERE tenant_name = ?');
      stmt1.run([tenant.name]);
      stmt1.free();
      const stmt2 = db.prepare('DELETE FROM tenants WHERE name = ?');
      stmt2.run([tenant.name]);
      stmt2.free();
      cleaned.push({ name: tenant.name, action: 'removed_orphaned_registry_entry' });
    }
  }

  if (cleaned.length > 0) {
    saveRegistry();
  }

  return cleaned;
}

// Diagnose data directory permissions and state
export function diagnoseDataDir(): {
  dataDir: string;
  exists: boolean;
  writable: boolean;
  registryExists: boolean;
  tenants: Array<{ name: string; hasDir: boolean; hasDb: boolean }>;
} {
  const exists = fs.existsSync(dataDir);
  let writable = false;
  if (exists) {
    try {
      fs.accessSync(dataDir, fs.constants.W_OK);
      writable = true;
    } catch (_) { /* not writable */ }
  }

  const registryExists = fs.existsSync(registryDbPath);

  const tenants = getRegisteredTenants().map(t => {
    const dir = path.join(dataDir, t.name);
    return {
      name: t.name,
      hasDir: fs.existsSync(dir),
      hasDb: fs.existsSync(path.join(dir, 'financer.db')),
    };
  });

  return { dataDir, exists, writable, registryExists, tenants };
}

// ===== Coupon Functions =====

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

function rowToCoupon(obj: Record<string, any>): Coupon {
  return {
    code: obj.code,
    type: obj.type as CouponType,
    value: obj.value,
    stripeCouponId: obj.stripe_coupon_id,
    maxUses: obj.max_uses,
    timesUsed: obj.times_used,
    expiresAt: obj.expires_at,
    createdAt: obj.created_at,
  };
}

export function createCoupon(params: {
  code: string;
  type: CouponType;
  value: number;
  maxUses?: number;
  expiresAt?: string;
  stripeCouponId?: string;
}): void {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO coupons (code, type, value, max_uses, expires_at, stripe_coupon_id) VALUES (?, ?, ?, ?, ?, ?)'
  );
  stmt.run([
    params.code.toUpperCase(),
    params.type,
    params.value,
    params.maxUses ?? 1,
    params.expiresAt ?? null,
    params.stripeCouponId ?? null,
  ]);
  stmt.free();
  saveRegistry();
}

export function getCoupons(): Coupon[] {
  const db = getDb();
  const results = db.exec('SELECT * FROM coupons ORDER BY created_at DESC');
  if (results.length === 0) return [];

  const columns = results[0].columns;
  return results[0].values.map((row) => {
    const obj: Record<string, any> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return rowToCoupon(obj);
  });
}

export function getCouponByCode(code: string): Coupon | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM coupons WHERE code = ?');
  stmt.bind([code.toUpperCase()]);

  if (stmt.step()) {
    const columns = stmt.getColumnNames();
    const values = stmt.get();
    const obj: Record<string, any> = {};
    columns.forEach((col, i) => { obj[col] = values[i]; });
    stmt.free();
    return rowToCoupon(obj);
  }

  stmt.free();
  return null;
}

export function deleteCoupon(code: string): boolean {
  const db = getDb();
  const coupon = getCouponByCode(code);
  if (!coupon) return false;

  const stmt1 = db.prepare('DELETE FROM coupon_redemptions WHERE coupon_code = ?');
  stmt1.run([code.toUpperCase()]);
  stmt1.free();

  const stmt2 = db.prepare('DELETE FROM coupons WHERE code = ?');
  stmt2.run([code.toUpperCase()]);
  stmt2.free();

  saveRegistry();
  return true;
}

export function redeemCoupon(code: string, tenant: string): {
  success: boolean;
  error?: string;
  type?: CouponType;
  stripeCouponId?: string;
} {
  const coupon = getCouponByCode(code);
  if (!coupon) return { success: false, error: 'Coupon not found' };

  // Check expiry
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return { success: false, error: 'Coupon has expired' };
  }

  // Check usage limit
  if (coupon.timesUsed >= coupon.maxUses) {
    return { success: false, error: 'Coupon has been fully redeemed' };
  }

  // Check if tenant already redeemed this coupon
  const db = getDb();
  const checkStmt = db.prepare(
    'SELECT id FROM coupon_redemptions WHERE coupon_code = ? AND tenant_name = ?'
  );
  checkStmt.bind([coupon.code, tenant]);
  const alreadyRedeemed = checkStmt.step();
  checkStmt.free();
  if (alreadyRedeemed) {
    return { success: false, error: 'Already redeemed' };
  }

  // Get tenant
  const tenantInfo = getTenantStatus(tenant);
  if (!tenantInfo) {
    return { success: false, error: 'Tenant not found in registry' };
  }

  // Apply coupon effect
  switch (coupon.type) {
    case 'trial_extension': {
      // Extend from current end or from now, whichever is later
      const base = tenantInfo.trialEndsAt
        ? Math.max(new Date(tenantInfo.trialEndsAt).getTime(), Date.now())
        : Date.now();
      const newEnd = new Date(base + coupon.value * 24 * 60 * 60 * 1000).toISOString();
      updateTenantTrialEnd(tenant, newEnd);
      break;
    }
    case 'free_access': {
      updateTenantStatus(tenant, 'active');
      break;
    }
    case 'discount': {
      // stripe_coupon_id is returned to caller and applied at checkout
      break;
    }
  }

  // Record redemption
  const redeemStmt = db.prepare(
    'INSERT INTO coupon_redemptions (coupon_code, tenant_name) VALUES (?, ?)'
  );
  redeemStmt.run([coupon.code, tenant]);
  redeemStmt.free();

  // Increment usage
  const updateStmt = db.prepare('UPDATE coupons SET times_used = times_used + 1 WHERE code = ?');
  updateStmt.run([coupon.code]);
  updateStmt.free();

  saveRegistry();

  return {
    success: true,
    type: coupon.type,
    stripeCouponId: coupon.stripeCouponId ?? undefined,
  };
}

export function getDiscountCouponForTenant(tenant: string): string | null {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT c.stripe_coupon_id FROM coupon_redemptions cr
    JOIN coupons c ON cr.coupon_code = c.code
    WHERE cr.tenant_name = ? AND c.type = 'discount' AND c.stripe_coupon_id IS NOT NULL
    ORDER BY cr.redeemed_at DESC LIMIT 1
  `);
  stmt.bind([tenant]);
  let result: string | null = null;
  if (stmt.step()) {
    result = stmt.get()[0] as string;
  }
  stmt.free();
  return result;
}

export function getRegistryStats(): {
  total: number;
  trial: number;
  active: number;
  expired: number;
  cancelled: number;
} {
  const db = getDb();
  const results = db.exec(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'trial' THEN 1 ELSE 0 END) as trial,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
    FROM tenants
  `);

  if (results.length === 0) return { total: 0, trial: 0, active: 0, expired: 0, cancelled: 0 };

  const row = results[0].values[0];
  return {
    total: (row[0] as number) || 0,
    trial: (row[1] as number) || 0,
    active: (row[2] as number) || 0,
    expired: (row[3] as number) || 0,
    cancelled: (row[4] as number) || 0,
  };
}
