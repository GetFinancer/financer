import { Router } from 'express';
import { registerTenant, tenantNameAvailable } from '../db/registry.js';
import { validate } from '../middleware/validate.js';
import { RegisterTenantSchema } from '../lib/schemas.js';

const VALID_TENANT = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const RESERVED_NAMES = ['www', 'api', 'admin', 'app', 'mail', 'smtp', 'ftp', 'ns1', 'ns2', '_registry'];

export const registerRouter = Router();

// Public config for register page (base domain)
registerRouter.get('/config', (_req, res) => {
  res.json({ success: true, data: { baseDomain: process.env.BASE_DOMAIN || 'getfinancer.com' } });
});

// Check tenant name availability
registerRouter.get('/check/:name', (req, res) => {
  const name = req.params.name.toLowerCase();

  if (!VALID_TENANT.test(name) || RESERVED_NAMES.includes(name)) {
    res.json({ success: true, data: { available: false, reason: 'invalid' } });
    return;
  }

  const available = tenantNameAvailable(name);
  res.json({ success: true, data: { available } });
});

// Register a new tenant
registerRouter.post('/', validate(RegisterTenantSchema), (req, res) => {
  const { tenant } = req.body as { tenant: string };

  const name = tenant.toLowerCase().trim();

  if (!VALID_TENANT.test(name)) {
    res.status(400).json({
      success: false,
      error: 'Invalid tenant name. Use lowercase letters, numbers, and hyphens (1-63 characters).',
    });
    return;
  }

  if (RESERVED_NAMES.includes(name)) {
    res.status(400).json({ success: false, error: 'This name is reserved.' });
    return;
  }

  if (!tenantNameAvailable(name)) {
    res.status(409).json({ success: false, error: 'This name is already taken.' });
    return;
  }

  try {
    registerTenant(name);
    const baseDomain = process.env.BASE_DOMAIN || 'getfinancer.com';
    const url = `https://${name}.${baseDomain}`;
    res.status(201).json({ success: true, data: { tenant: name, url } });
  } catch (err) {
    console.error('Failed to register tenant:', err);
    res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
});
