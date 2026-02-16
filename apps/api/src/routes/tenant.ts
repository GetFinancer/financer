import { Router } from 'express';
import { tenantStorage } from '../db/index.js';
import { getTenantStatus, redeemCoupon } from '../db/registry.js';
import { authMiddleware } from '../middleware/auth.js';

export const tenantRouter = Router();

tenantRouter.get('/status', authMiddleware, (req, res) => {
  const tenant = tenantStorage.getStore();

  if (!tenant) {
    res.status(500).json({ success: false, error: 'No tenant context' });
    return;
  }

  const registryEntry = getTenantStatus(tenant);

  // Legacy tenant (not in registry) — unrestricted
  if (!registryEntry) {
    res.json({
      success: true,
      data: {
        status: 'active',
        hasPaymentMethod: true,
        legacy: true,
      },
    });
    return;
  }

  const daysRemaining = registryEntry.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(registryEntry.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : undefined;

  res.json({
    success: true,
    data: {
      status: registryEntry.status,
      trialEndsAt: registryEntry.trialEndsAt,
      daysRemaining,
      hasPaymentMethod: !!registryEntry.stripeSubscriptionId,
    },
  });
});

// Redeem coupon code
tenantRouter.post('/redeem', authMiddleware, (req, res) => {
  const tenant = tenantStorage.getStore();
  if (!tenant) {
    res.status(500).json({ success: false, error: 'No tenant context' });
    return;
  }

  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    res.status(400).json({ success: false, error: 'Coupon code is required' });
    return;
  }

  const result = redeemCoupon(code, tenant);

  if (!result.success) {
    res.status(400).json({ success: false, error: result.error });
    return;
  }

  let message = 'Coupon redeemed successfully';
  if (result.type === 'trial_extension') {
    message = 'Trial extended successfully';
  } else if (result.type === 'free_access') {
    message = 'Account activated successfully';
  } else if (result.type === 'discount') {
    message = 'Discount will be applied at checkout';
  }

  res.json({ success: true, type: result.type, message });
});
