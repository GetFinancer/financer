import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendPasswordReset, isMailerConfigured } from '../lib/mailer.js';
import { adminAuthMiddleware, adminLogin, adminLogout, adminStatus } from '../middleware/adminAuth.js';
import {
  getRegisteredTenants,
  getRegistryStats,
  updateTenantStatus,
  updateTenantTrialEnd,
  deleteTenant,
  createCoupon,
  getCoupons,
  deleteCoupon,
  saveRegistrySync,
  cleanupOrphanedTenants,
  diagnoseDataDir,
} from '../db/registry.js';
import { initTenantDatabase, getTenantDatabase, saveTenantDatabase } from '../db/index.js';
import type { TenantPlan } from '@financer/shared';

const router = Router();

// Public endpoints (no admin auth needed)
router.post('/login', adminLogin);
router.post('/logout', adminLogout);
router.get('/status', adminStatus);

// Config endpoint (public - tells frontend which features are available)
router.get('/config', (_req, res) => {
  const deploymentMode = process.env.DEPLOYMENT_MODE || 'selfhosted';
  res.json({
    hosted: deploymentMode === 'cloudhost',
    stripe: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
  });
});

// Protected endpoints
router.use(adminAuthMiddleware);

// Stats
router.get('/stats', (_req, res) => {
  const stats = getRegistryStats();
  res.json(stats);
});

// Tenants
router.get('/tenants', (_req, res) => {
  const tenants = getRegisteredTenants();
  res.json(tenants);
});

router.patch('/tenants/:name', (req, res) => {
  const { name } = req.params;
  const { status, trialEndsAt } = req.body;

  if (status) {
    const valid: TenantPlan[] = ['trial', 'active', 'expired', 'cancelled'];
    if (!valid.includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid status' });
      return;
    }
    updateTenantStatus(name, status);
  }

  if (trialEndsAt) {
    updateTenantTrialEnd(name, trialEndsAt);
  }

  res.json({ success: true });
});

router.delete('/tenants/:name', (req, res) => {
  const { name } = req.params;
  deleteTenant(name);
  res.json({ success: true });
});

// Coupons
router.get('/coupons', (_req, res) => {
  const coupons = getCoupons();
  res.json(coupons);
});

router.post('/coupons', (req, res) => {
  const { code, type, value, maxUses, expiresAt, stripeCouponId } = req.body;

  if (!type || value === undefined) {
    res.status(400).json({ success: false, error: 'type and value are required' });
    return;
  }

  const validTypes = ['trial_extension', 'free_access', 'discount'];
  if (!validTypes.includes(type)) {
    res.status(400).json({ success: false, error: 'Invalid coupon type' });
    return;
  }

  const couponCode = code || generateCouponCode();

  try {
    createCoupon({
      code: couponCode,
      type,
      value,
      maxUses,
      expiresAt,
      stripeCouponId,
    });
    res.json({ success: true, code: couponCode });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to create coupon' });
  }
});

router.delete('/coupons/:code', (req, res) => {
  const { code } = req.params;
  const deleted = deleteCoupon(code);
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Coupon not found' });
    return;
  }
  res.json({ success: true });
});

// Diagnose data directory
router.get('/diagnose', (_req, res) => {
  const info = diagnoseDataDir();
  res.json(info);
});

// Cleanup orphaned tenants (registry entry without directory)
router.post('/cleanup', (_req, res) => {
  const cleaned = cleanupOrphanedTenants();
  res.json({ success: true, cleaned });
});

// Helper: get a setting from a tenant's database
function getTenantSetting(tenantName: string, key: string): string | undefined {
  const sqlDb = getTenantDatabase(tenantName);
  if (!sqlDb) return undefined;
  const stmt = sqlDb.prepare('SELECT value FROM settings WHERE key = ?');
  stmt.bind([key]);
  if (stmt.step()) {
    const val = stmt.get()[0] as string;
    stmt.free();
    return val;
  }
  stmt.free();
  return undefined;
}

// Helper: set a setting in a tenant's database
function setTenantSetting(tenantName: string, key: string, value: string): void {
  const sqlDb = getTenantDatabase(tenantName);
  if (!sqlDb) return;
  sqlDb.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

// Helper: delete settings from a tenant's database
function deleteTenantSettings(tenantName: string, keys: string[]): void {
  const sqlDb = getTenantDatabase(tenantName);
  if (!sqlDb) return;
  const placeholders = keys.map(() => '?').join(',');
  sqlDb.run(`DELETE FROM settings WHERE key IN (${placeholders})`, keys);
}

// Get tenant email + status
router.get('/tenants/:name/email', async (req, res) => {
  const { name } = req.params;
  try {
    await initTenantDatabase(name);
    const email = getTenantSetting(name, 'email') || '';
    const has2fa = getTenantSetting(name, 'totp_enabled') === '1';
    const hasPassword = !!getTenantSetting(name, 'password_hash');
    res.json({ success: true, email, has2fa, hasPassword, mailerConfigured: isMailerConfigured() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to load tenant' });
  }
});

// Reset tenant password — requires email on file + SMTP configured
router.post('/tenants/:name/reset-password', async (req, res) => {
  const { name } = req.params;
  try {
    await initTenantDatabase(name);
    const sqlDb = getTenantDatabase(name);
    if (!sqlDb) {
      res.status(404).json({ success: false, error: 'Tenant database not found' });
      return;
    }

    const email = getTenantSetting(name, 'email') || '';
    if (!email) {
      res.status(400).json({ success: false, error: 'No email address on file for this tenant. Password reset is not possible.' });
      return;
    }

    if (!isMailerConfigured()) {
      res.status(503).json({ success: false, error: 'SMTP not configured on this server. Password reset via email is not available.' });
      return;
    }

    // Generate temporary password
    const tempPassword = crypto.randomBytes(6).toString('base64url');
    const hash = await bcrypt.hash(tempPassword, 10);

    setTenantSetting(name, 'password_hash', hash);
    saveTenantDatabase(name);

    await sendPasswordReset({ to: email, tenantName: name, tempPassword });

    res.json({ success: true, emailSentTo: email });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to reset password' });
  }
});

// Reset tenant 2FA
router.post('/tenants/:name/reset-2fa', async (req, res) => {
  const { name } = req.params;
  try {
    await initTenantDatabase(name);
    const sqlDb = getTenantDatabase(name);
    if (!sqlDb) {
      res.status(404).json({ success: false, error: 'Tenant database not found' });
      return;
    }

    deleteTenantSettings(name, [
      'totp_secret',
      'totp_enabled',
      'totp_backup_codes',
      'totp_secret_pending',
      'totp_backup_codes_pending',
    ]);
    saveTenantDatabase(name);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to reset 2FA' });
  }
});

function generateCouponCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export { router as adminRouter };
