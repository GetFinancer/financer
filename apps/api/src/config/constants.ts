// Security constants — single source of truth for all security-related values.
// Avoids magic numbers scattered across the codebase.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const _pkg = JSON.parse(
  readFileSync(resolve(__dirname, '../../package.json'), 'utf-8')
) as { version: string };

export const APP_VERSION: string = process.env.APP_VERSION ?? _pkg.version;

export const SECURITY = {
  PASSWORD_MIN_LENGTH: 12,
  BCRYPT_ROUNDS: 10,

  // Login rate limiting
  LOGIN_ATTEMPT_LIMIT: 5,
  LOGIN_LOCKOUT_DURATION_MINUTES: 15,
  LOGIN_CLEANUP_HOURS: 24,

  // 2FA / Backup codes
  BACKUP_CODES_COUNT: 10,
  BACKUP_CODE_LENGTH: 8,

  // Coupon codes
  COUPON_CODE_LENGTH: 8,
} as const;
