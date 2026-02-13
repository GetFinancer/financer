import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import { authRouter } from './routes/auth.js';
import { accountsRouter } from './routes/accounts.js';
import { categoriesRouter } from './routes/categories.js';
import { transactionsRouter } from './routes/transactions.js';
import { dashboardRouter } from './routes/dashboard.js';
import { recurringRouter } from './routes/recurring.js';
import { creditCardsRouter } from './routes/credit-cards.js';
import { analyticsRouter } from './routes/analytics.js';
import { errorHandler } from './middleware/errorHandler.js';
import { tenantMiddleware } from './middleware/tenant.js';

export function createApp(options?: { skipRateLimit?: boolean; skipTenant?: boolean }) {
  const app = express();

  // Trust proxy (wichtig wenn hinter nginx)
  app.set('trust proxy', 1);

  // Rate Limiting - Allgemein (100 Anfragen pro Minute)
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 Minute
    max: 100,
    message: { success: false, error: 'Zu viele Anfragen. Bitte warte einen Moment.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Rate Limiting - Auth (10 Versuche pro 15 Minuten - Brute-Force Schutz)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 Minuten
    max: 10,
    message: { success: false, error: 'Zu viele Login-Versuche. Bitte warte 15 Minuten.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Middleware
  app.use(helmet());

  // CORS - support wildcard subdomains
  const baseDomain = process.env.BASE_DOMAIN || 'getfinancer.com';
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, server-to-server)
      if (!origin) return callback(null, true);

      // Allow any subdomain of the base domain
      const allowedPattern = new RegExp(`^https?://([a-z0-9-]+\\.)?${baseDomain.replace('.', '\\.')}$`);
      if (allowedPattern.test(origin)) return callback(null, true);

      // Allow localhost for development
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);

      // Allow configured CORS_ORIGIN
      const corsOrigin = process.env.CORS_ORIGIN;
      if (corsOrigin && origin === corsOrigin) return callback(null, true);

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }));
  app.use(express.json());

  if (!options?.skipRateLimit) {
    app.use(generalLimiter);
  }

  // Session configuration
  app.use(session({
    secret: process.env.SESSION_SECRET || 'change-me-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      // Don't set domain - each subdomain gets its own cookie automatically
    },
  }));

  // Health check (before tenant middleware - for monitoring)
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Tenant middleware - resolves subdomain to database
  if (!options?.skipTenant) {
    app.use('/api', tenantMiddleware);
  }

  // Routes
  if (!options?.skipRateLimit) {
    app.use('/api/auth/login', authLimiter);
    app.use('/api/auth/setup', authLimiter);
  }
  app.use('/api/auth', authRouter);
  app.use('/api/accounts', accountsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/recurring', recurringRouter);
  app.use('/api/credit-cards', creditCardsRouter);
  app.use('/api/analytics', analyticsRouter);

  // Error handler
  app.use(errorHandler);

  return app;
}
