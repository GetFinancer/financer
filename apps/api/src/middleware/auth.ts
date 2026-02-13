import { Request, Response, NextFunction } from 'express';
import { tenantStorage } from '../db/index.js';

declare module 'express-session' {
  interface SessionData {
    isAuthenticated?: boolean;
    pendingTwoFactor?: boolean;
    tenant?: string;
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Verify session belongs to current tenant (prevents cross-subdomain session hijacking)
  const currentTenant = tenantStorage.getStore();
  if (currentTenant && req.session.tenant && req.session.tenant !== currentTenant) {
    res.status(401).json({
      success: false,
      error: 'Session does not match tenant',
    });
    return;
  }

  if (!req.session.isAuthenticated) {
    res.status(401).json({
      success: false,
      error: 'Nicht authentifiziert',
    });
    return;
  }
  next();
}
