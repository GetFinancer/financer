import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { TOTP, generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';
import { db } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

// Create TOTP instance
const totp = new TOTP();

export const authRouter = Router();

// Rate limiting configuration
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

// Helper: Check if IP is locked out
function isLockedOut(ip: string): { locked: boolean; remainingMinutes?: number } {
  const cutoff = new Date(Date.now() - LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString();

  const recentFailures = db.prepare(`
    SELECT COUNT(*) as count FROM login_attempts
    WHERE ip_address = ? AND attempted_at > ? AND success = 0
  `).get(ip, cutoff) as { count: number };

  if (recentFailures.count >= MAX_LOGIN_ATTEMPTS) {
    // Find the oldest recent failure to calculate remaining time
    const oldestFailure = db.prepare(`
      SELECT attempted_at FROM login_attempts
      WHERE ip_address = ? AND attempted_at > ? AND success = 0
      ORDER BY attempted_at ASC LIMIT 1
    `).get(ip, cutoff) as { attempted_at: string } | undefined;

    if (oldestFailure) {
      const lockoutEnd = new Date(new Date(oldestFailure.attempted_at).getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
      const remainingMs = lockoutEnd.getTime() - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      return { locked: true, remainingMinutes };
    }
  }

  return { locked: false };
}

// Helper: Record login attempt
function recordLoginAttempt(ip: string, success: boolean) {
  db.prepare(`
    INSERT INTO login_attempts (ip_address, success) VALUES (?, ?)
  `).run(ip, success ? 1 : 0);

  // Clean up old attempts (older than 24 hours)
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  db.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').run(dayAgo);
}

// Helper: Get client IP
function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
         req.socket.remoteAddress ||
         'unknown';
}

// Helper: Generate backup codes
function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}

// Helper: Get 2FA settings
function get2FASettings(): { enabled: boolean; secret?: string; backupCodes?: string[] } {
  const enabled = db.prepare("SELECT value FROM settings WHERE key = 'totp_enabled'").get() as { value: string } | undefined;
  const secret = db.prepare("SELECT value FROM settings WHERE key = 'totp_secret'").get() as { value: string } | undefined;
  const backupCodes = db.prepare("SELECT value FROM settings WHERE key = 'totp_backup_codes'").get() as { value: string } | undefined;

  return {
    enabled: enabled?.value === 'true',
    secret: secret?.value,
    backupCodes: backupCodes?.value ? JSON.parse(backupCodes.value) : undefined,
  };
}

// Get auth status
authRouter.get('/status', (req, res) => {
  const passwordHash = db.prepare(
    "SELECT value FROM settings WHERE key = 'password_hash'"
  ).get() as { value: string } | undefined;

  const twoFactorSettings = get2FASettings();

  res.json({
    success: true,
    data: {
      isAuthenticated: !!req.session.isAuthenticated,
      isSetupComplete: !!passwordHash,
      twoFactorEnabled: twoFactorSettings.enabled,
      twoFactorRequired: req.session.pendingTwoFactor === true,
    },
  });
});

// Initial setup - set password
authRouter.post('/setup', async (req, res) => {
  const { password } = req.body;

  if (!password || password.length < 4) {
    res.status(400).json({
      success: false,
      error: 'Passwort muss mindestens 4 Zeichen lang sein',
    });
    return;
  }

  // Check if already set up
  const existingHash = db.prepare(
    "SELECT value FROM settings WHERE key = 'password_hash'"
  ).get();

  if (existingHash) {
    res.status(400).json({
      success: false,
      error: 'Setup wurde bereits durchgeführt',
    });
    return;
  }

  const hash = await bcrypt.hash(password, 10);

  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('password_hash', ?)"
  ).run(hash);

  req.session.isAuthenticated = true;

  res.json({
    success: true,
    data: { success: true },
  });
});

// Login
authRouter.post('/login', async (req, res) => {
  const { password, totpCode } = req.body;
  const clientIp = getClientIp(req);

  // Check rate limiting
  const lockoutStatus = isLockedOut(clientIp);
  if (lockoutStatus.locked) {
    res.status(429).json({
      success: false,
      error: `Zu viele Fehlversuche. Bitte warte ${lockoutStatus.remainingMinutes} Minuten.`,
    });
    return;
  }

  const result = db.prepare(
    "SELECT value FROM settings WHERE key = 'password_hash'"
  ).get() as { value: string } | undefined;

  if (!result) {
    res.status(400).json({
      success: false,
      error: 'Setup nicht abgeschlossen',
    });
    return;
  }

  // If session has pending 2FA and totpCode is provided, verify it
  if (req.session.pendingTwoFactor && totpCode) {
    const twoFactorSettings = get2FASettings();

    if (!twoFactorSettings.enabled || !twoFactorSettings.secret) {
      req.session.isAuthenticated = true;
      req.session.pendingTwoFactor = false;
      recordLoginAttempt(clientIp, true);
      res.json({
        success: true,
        data: { success: true },
      });
      return;
    }

    // Check TOTP code
    const totpResult = verifySync({ token: totpCode, secret: twoFactorSettings.secret });
    const isValidTotp = totpResult.valid;

    // If TOTP fails, check backup codes
    let usedBackupCode = false;
    if (!isValidTotp && twoFactorSettings.backupCodes) {
      const codeIndex = twoFactorSettings.backupCodes.indexOf(totpCode.toUpperCase());
      if (codeIndex !== -1) {
        // Remove used backup code
        twoFactorSettings.backupCodes.splice(codeIndex, 1);
        db.prepare("UPDATE settings SET value = ? WHERE key = 'totp_backup_codes'")
          .run(JSON.stringify(twoFactorSettings.backupCodes));
        usedBackupCode = true;
      }
    }

    if (!isValidTotp && !usedBackupCode) {
      recordLoginAttempt(clientIp, false);
      res.status(401).json({
        success: false,
        error: 'Ungültiger 2FA-Code',
      });
      return;
    }

    req.session.isAuthenticated = true;
    req.session.pendingTwoFactor = false;
    recordLoginAttempt(clientIp, true);

    res.json({
      success: true,
      data: {
        success: true,
        usedBackupCode,
      },
    });
    return;
  }

  // Normal password login
  const isValid = await bcrypt.compare(password, result.value);

  if (!isValid) {
    recordLoginAttempt(clientIp, false);
    res.status(401).json({
      success: false,
      error: 'Falsches Passwort',
    });
    return;
  }

  // Check if 2FA is enabled
  const twoFactorSettings = get2FASettings();

  if (twoFactorSettings.enabled) {
    req.session.pendingTwoFactor = true;
    req.session.isAuthenticated = false;

    res.json({
      success: true,
      data: {
        success: true,
        requiresTwoFactor: true,
      },
    });
    return;
  }

  // No 2FA, complete login
  req.session.isAuthenticated = true;
  recordLoginAttempt(clientIp, true);

  res.json({
    success: true,
    data: { success: true },
  });
});

// Logout
authRouter.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({
        success: false,
        error: 'Logout fehlgeschlagen',
      });
      return;
    }
    res.json({
      success: true,
      data: { success: true },
    });
  });
});

// Change password (requires authentication)
authRouter.post('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({
      success: false,
      error: 'Aktuelles und neues Passwort erforderlich',
    });
    return;
  }

  if (newPassword.length < 4) {
    res.status(400).json({
      success: false,
      error: 'Neues Passwort muss mindestens 4 Zeichen lang sein',
    });
    return;
  }

  const result = db.prepare(
    "SELECT value FROM settings WHERE key = 'password_hash'"
  ).get() as { value: string } | undefined;

  if (!result) {
    res.status(400).json({
      success: false,
      error: 'Kein Passwort gesetzt',
    });
    return;
  }

  const isValid = await bcrypt.compare(currentPassword, result.value);

  if (!isValid) {
    res.status(401).json({
      success: false,
      error: 'Aktuelles Passwort ist falsch',
    });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 10);

  db.prepare(
    "UPDATE settings SET value = ? WHERE key = 'password_hash'"
  ).run(newHash);

  res.json({
    success: true,
    data: { success: true },
  });
});

// ===== 2FA Endpoints =====

// Get 2FA status
authRouter.get('/2fa/status', authMiddleware, (req, res) => {
  const settings = get2FASettings();

  res.json({
    success: true,
    data: {
      enabled: settings.enabled,
      hasBackupCodes: settings.backupCodes ? settings.backupCodes.length > 0 : false,
      backupCodesRemaining: settings.backupCodes?.length || 0,
    },
  });
});

// Start 2FA setup - generate secret and QR code
authRouter.post('/2fa/setup', authMiddleware, async (req, res) => {
  const settings = get2FASettings();

  if (settings.enabled) {
    res.status(400).json({
      success: false,
      error: '2FA ist bereits aktiviert',
    });
    return;
  }

  // Generate new secret
  const secret = generateSecret();

  // Generate QR code URL
  const otpauth = generateURI({ issuer: 'Financer', label: 'user', secret });
  const qrCodeUrl = await QRCode.toDataURL(otpauth);

  // Generate backup codes
  const backupCodes = generateBackupCodes();

  // Store temporarily (not enabled yet)
  db.prepare(`
    INSERT OR REPLACE INTO settings (key, value) VALUES ('totp_secret_pending', ?)
  `).run(secret);

  db.prepare(`
    INSERT OR REPLACE INTO settings (key, value) VALUES ('totp_backup_codes_pending', ?)
  `).run(JSON.stringify(backupCodes));

  res.json({
    success: true,
    data: {
      secret,
      qrCodeUrl,
      backupCodes,
    },
  });
});

// Verify and enable 2FA
authRouter.post('/2fa/verify', authMiddleware, (req, res) => {
  const { code } = req.body;

  if (!code) {
    res.status(400).json({
      success: false,
      error: 'Code erforderlich',
    });
    return;
  }

  // Get pending secret
  const pendingSecret = db.prepare(
    "SELECT value FROM settings WHERE key = 'totp_secret_pending'"
  ).get() as { value: string } | undefined;

  if (!pendingSecret) {
    res.status(400).json({
      success: false,
      error: 'Kein 2FA-Setup aktiv. Bitte starte den Setup-Prozess erneut.',
    });
    return;
  }

  // Verify the code
  const verifyResult = verifySync({ token: code, secret: pendingSecret.value });
  const isValid = verifyResult.valid;

  if (!isValid) {
    res.status(400).json({
      success: false,
      error: 'Ungültiger Code. Bitte versuche es erneut.',
    });
    return;
  }

  // Get pending backup codes
  const pendingBackupCodes = db.prepare(
    "SELECT value FROM settings WHERE key = 'totp_backup_codes_pending'"
  ).get() as { value: string } | undefined;

  // Activate 2FA
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('totp_secret', ?)").run(pendingSecret.value);
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('totp_enabled', 'true')").run();

  if (pendingBackupCodes) {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('totp_backup_codes', ?)").run(pendingBackupCodes.value);
  }

  // Clean up pending
  db.prepare("DELETE FROM settings WHERE key = 'totp_secret_pending'").run();
  db.prepare("DELETE FROM settings WHERE key = 'totp_backup_codes_pending'").run();

  res.json({
    success: true,
    data: { success: true },
  });
});

// Disable 2FA
authRouter.post('/2fa/disable', authMiddleware, async (req, res) => {
  const { password, code } = req.body;

  if (!password) {
    res.status(400).json({
      success: false,
      error: 'Passwort erforderlich',
    });
    return;
  }

  // Verify password
  const result = db.prepare(
    "SELECT value FROM settings WHERE key = 'password_hash'"
  ).get() as { value: string } | undefined;

  if (!result) {
    res.status(400).json({
      success: false,
      error: 'Kein Passwort gesetzt',
    });
    return;
  }

  const isValidPassword = await bcrypt.compare(password, result.value);

  if (!isValidPassword) {
    res.status(401).json({
      success: false,
      error: 'Falsches Passwort',
    });
    return;
  }

  // Verify 2FA code if 2FA is enabled
  const settings = get2FASettings();

  if (settings.enabled && settings.secret) {
    if (!code) {
      res.status(400).json({
        success: false,
        error: '2FA-Code erforderlich',
      });
      return;
    }

    const codeVerifyResult = verifySync({ token: code, secret: settings.secret });
    const isValidCode = codeVerifyResult.valid;

    // Check backup code if TOTP fails
    let validBackupCode = false;
    if (!isValidCode && settings.backupCodes) {
      validBackupCode = settings.backupCodes.includes(code.toUpperCase());
    }

    if (!isValidCode && !validBackupCode) {
      res.status(401).json({
        success: false,
        error: 'Ungültiger 2FA-Code',
      });
      return;
    }
  }

  // Disable 2FA
  db.prepare("DELETE FROM settings WHERE key = 'totp_secret'").run();
  db.prepare("DELETE FROM settings WHERE key = 'totp_enabled'").run();
  db.prepare("DELETE FROM settings WHERE key = 'totp_backup_codes'").run();

  res.json({
    success: true,
    data: { success: true },
  });
});

// Regenerate backup codes
authRouter.post('/2fa/backup-codes/regenerate', authMiddleware, async (req, res) => {
  const { password } = req.body;

  if (!password) {
    res.status(400).json({
      success: false,
      error: 'Passwort erforderlich',
    });
    return;
  }

  // Verify password
  const result = db.prepare(
    "SELECT value FROM settings WHERE key = 'password_hash'"
  ).get() as { value: string } | undefined;

  if (!result) {
    res.status(400).json({
      success: false,
      error: 'Kein Passwort gesetzt',
    });
    return;
  }

  const isValidPassword = await bcrypt.compare(password, result.value);

  if (!isValidPassword) {
    res.status(401).json({
      success: false,
      error: 'Falsches Passwort',
    });
    return;
  }

  const settings = get2FASettings();

  if (!settings.enabled) {
    res.status(400).json({
      success: false,
      error: '2FA ist nicht aktiviert',
    });
    return;
  }

  // Generate new backup codes
  const backupCodes = generateBackupCodes();

  db.prepare("UPDATE settings SET value = ? WHERE key = 'totp_backup_codes'")
    .run(JSON.stringify(backupCodes));

  res.json({
    success: true,
    data: { backupCodes },
  });
});

// Email endpoints
authRouter.get('/email', authMiddleware, (_req, res) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('email');
  res.json({ success: true, data: { email: row?.value || '' } });
});

authRouter.put('/email', authMiddleware, (req, res) => {
  const { email } = req.body;
  if (email !== undefined && typeof email === 'string') {
    const trimmed = email.trim();
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      res.status(400).json({ success: false, error: 'Invalid email format' });
      return;
    }
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('email', trimmed);
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, error: 'Email is required' });
  }
});
