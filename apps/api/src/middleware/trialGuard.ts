import { Request, Response, NextFunction } from 'express';

// Paths that are always allowed, even when trial is expired
const ALLOWED_PATHS = [
  '/api/auth',
  '/api/tenant',
  '/api/billing',
  '/api/settings',
];

export function trialGuard(req: Request, res: Response, next: NextFunction) {
  // Self-hosted: no trial system
  if ((process.env.DEPLOYMENT_MODE || 'selfhosted') === 'selfhosted') {
    next();
    return;
  }

  // Only block write operations
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }

  // Check if tenant is expired (set by tenant middleware)
  if (!res.locals.tenantExpired) {
    next();
    return;
  }

  // Allow certain paths even when expired
  const isAllowed = ALLOWED_PATHS.some((p) => req.path.startsWith(p));
  if (isAllowed) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    error: 'trial_expired',
    message: 'Your trial has expired. Please upgrade to continue.',
  });
}
