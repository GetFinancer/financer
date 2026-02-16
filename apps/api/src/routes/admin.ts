import { Router } from 'express';
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
} from '../db/registry.js';
import type { TenantPlan } from '@financer/shared';

const router = Router();

// Public endpoints (no admin auth needed)
router.post('/login', adminLogin);
router.post('/logout', adminLogout);
router.get('/status', adminStatus);

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

function generateCouponCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export { router as adminRouter };
