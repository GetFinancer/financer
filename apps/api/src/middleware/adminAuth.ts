import { Request, Response, NextFunction } from 'express';

declare module 'express-session' {
  interface SessionData {
    isAdmin?: boolean;
  }
}

const getAdminToken = () => process.env.ADMIN_TOKEN;

export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!getAdminToken()) {
    res.status(503).json({ success: false, error: 'Admin not configured' });
    return;
  }

  if (!req.session.isAdmin) {
    res.status(401).json({ success: false, error: 'Admin authentication required' });
    return;
  }

  next();
}

export function adminLogin(req: Request, res: Response) {
  const adminToken = getAdminToken();
  if (!adminToken) {
    res.status(503).json({ success: false, error: 'Admin not configured' });
    return;
  }

  const { token } = req.body;
  if (!token || token !== adminToken) {
    res.status(401).json({ success: false, error: 'Invalid admin token' });
    return;
  }

  req.session.isAdmin = true;
  res.json({ success: true });
}

export function adminLogout(req: Request, res: Response) {
  req.session.isAdmin = false;
  res.json({ success: true });
}

export function adminStatus(req: Request, res: Response) {
  res.json({
    isAdmin: req.session.isAdmin === true,
    configured: !!getAdminToken(),
  });
}
