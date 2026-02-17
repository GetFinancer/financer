import { Request, Response, NextFunction } from 'express';

// Paths that are always allowed, even when trial is expired.
// Note: This middleware is mounted on /api, so req.path has no /api prefix.
const ALLOWED_PATHS = [
  '/auth',
  '/tenant',
  '/billing',
  '/settings',
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
