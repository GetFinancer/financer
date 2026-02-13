#!/usr/bin/env tsx
/**
 * Password Reset Script (Multi-Tenant)
 *
 * Usage:
 *   npm run reset-password -- --tenant roland           # Reset password for tenant "roland"
 *   npm run reset-password -- --tenant roland --include-2fa  # Reset password AND 2FA
 *   npm run reset-password -- --list-tenants            # List all tenants
 *
 * In Docker:
 *   docker exec -it financer-api-1 npm run reset-password -- --tenant roland
 *   docker exec -it financer-api-1 npm run reset-password -- --tenant roland --include-2fa
 *   docker exec -it financer-api-1 npm run reset-password -- --list-tenants
 */

import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const include2FA = process.argv.includes('--include-2fa');
const listTenantsFlag = process.argv.includes('--list-tenants');

// Extract --tenant value
const tenantIndex = process.argv.indexOf('--tenant');
const tenant = tenantIndex !== -1 ? process.argv[tenantIndex + 1] : undefined;

function listTenants() {
  console.log('\n=== Financer Tenants ===\n');

  if (!fs.existsSync(dataDir)) {
    console.log('No data directory found at:', dataDir);
    return;
  }

  const entries = fs.readdirSync(dataDir, { withFileTypes: true });
  const tenants = entries
    .filter((e) => e.isDirectory())
    .filter((e) => fs.existsSync(path.join(dataDir, e.name, 'financer.db')));

  if (tenants.length === 0) {
    console.log('No tenants found.');
    return;
  }

  console.log(`Found ${tenants.length} tenant(s):\n`);
  for (const t of tenants) {
    const dbPath = path.join(dataDir, t.name, 'financer.db');
    const stats = fs.statSync(dbPath);
    const size = (stats.size / 1024).toFixed(1);
    console.log(`  - ${t.name} (${size} KB)`);
  }
  console.log('');
}

async function resetPassword() {
  if (listTenantsFlag) {
    listTenants();
    return;
  }

  if (!tenant) {
    console.error('\nError: --tenant <name> is required.\n');
    console.error('Usage:');
    console.error('  npm run reset-password -- --tenant <name>');
    console.error('  npm run reset-password -- --tenant <name> --include-2fa');
    console.error('  npm run reset-password -- --list-tenants\n');
    process.exit(1);
  }

  console.log(`\n=== Financer Password Reset (Tenant: ${tenant}) ===\n`);

  const dbPath = path.join(dataDir, tenant, 'financer.db');

  // Check if database exists
  if (!fs.existsSync(dbPath)) {
    console.error('Database not found at:', dbPath);
    console.error(`Tenant "${tenant}" does not exist or has not been set up yet.`);
    console.error('\nUse --list-tenants to see available tenants.');
    process.exit(1);
  }

  // Load database
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // Check if password exists
  const result = db.exec("SELECT value FROM settings WHERE key = 'password_hash'");
  if (result.length === 0 || result[0].values.length === 0) {
    console.log('No password is set - the app has not been set up yet.');
    db.close();
    process.exit(0);
  }

  // Delete password hash
  db.run("DELETE FROM settings WHERE key = 'password_hash'");
  console.log('Password has been reset.');

  // Optionally delete 2FA settings
  if (include2FA) {
    db.run("DELETE FROM settings WHERE key IN ('totp_enabled', 'totp_secret', 'totp_backup_codes', 'totp_secret_pending', 'totp_backup_codes_pending')");
    console.log('2FA settings have been reset.');
  }

  // Save database
  const data = db.export();
  const outBuffer = Buffer.from(data);
  fs.writeFileSync(dbPath, outBuffer);
  db.close();

  console.log('\nDone! Open the app in your browser to set a new password.');
  if (!include2FA) {
    console.log('\nNote: 2FA settings were kept. Use --include-2fa to also reset 2FA.');
  }
  console.log('');
}

resetPassword().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
