import { Request, Response, NextFunction } from 'express';
import { tenantStorage, initTenantDatabase, tenantExists } from '../db/index.js';

// Valid tenant name: lowercase alphanumeric + hyphens, 1-63 chars
const VALID_TENANT = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const hostname = req.hostname;
  const baseDomain = process.env.BASE_DOMAIN || 'getfinancer.com';
  let tenant: string;

  if (hostname.endsWith(`.${baseDomain}`)) {
    // Extract subdomain: roland.getfinancer.com -> roland
    tenant = hostname.slice(0, -(baseDomain.length + 1));
  } else {
    // Local development or direct IP access -> use default tenant
    tenant = process.env.DEFAULT_TENANT || 'default';
  }

  if (!VALID_TENANT.test(tenant)) {
    res.status(400).json({ success: false, error: 'Invalid tenant' });
    return;
  }

  // Check if tenant exists (unless auto-provisioning is enabled)
  if (!tenantExists(tenant) && process.env.ALLOW_AUTO_PROVISION !== 'true') {
    res.status(404).json({ success: false, error: 'Tenant not found' });
    return;
  }

  // Initialize tenant DB (lazy loading) and set AsyncLocalStorage context
  initTenantDatabase(tenant).then(() => {
    tenantStorage.run(tenant, () => {
      // Store tenant in session for cross-subdomain protection
      if (req.session) {
        req.session.tenant = tenant;
      }
      next();
    });
  }).catch((err) => {
    console.error(`Failed to initialize database for tenant ${tenant}:`, err);
    res.status(500).json({ success: false, error: 'Database initialization failed' });
  });
}
