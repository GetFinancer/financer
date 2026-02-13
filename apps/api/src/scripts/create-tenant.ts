#!/usr/bin/env tsx
/**
 * Tenant Provisioning Script
 *
 * Creates the data directory for a new tenant. The database itself
 * will be created automatically on first access.
 *
 * Usage:
 *   npm run create-tenant -- --name roland
 *   npm run create-tenant -- --name roland --migrate /old/path/financer.db
 *
 * In Docker:
 *   docker exec -it financer-api-1 npm run create-tenant -- --name roland
 *   docker exec -it financer-api-1 npm run create-tenant -- --name roland --migrate /tmp/old.db
 */

import path from 'path';
import fs from 'fs';

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');

// Extract --name value
const nameIndex = process.argv.indexOf('--name');
const tenantName = nameIndex !== -1 ? process.argv[nameIndex + 1] : undefined;

// Extract --migrate value (path to existing DB to copy in)
const migrateIndex = process.argv.indexOf('--migrate');
const migratePath = migrateIndex !== -1 ? process.argv[migrateIndex + 1] : undefined;

// Validate tenant name
const VALID_TENANT = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

function createTenant() {
  if (!tenantName) {
    console.error('\nError: --name <tenant> is required.\n');
    console.error('Usage:');
    console.error('  npm run create-tenant -- --name <tenant>');
    console.error('  npm run create-tenant -- --name <tenant> --migrate /path/to/old/financer.db\n');
    process.exit(1);
  }

  if (!VALID_TENANT.test(tenantName)) {
    console.error(`\nError: Invalid tenant name "${tenantName}".`);
    console.error('Tenant names must be lowercase alphanumeric with optional hyphens (1-63 chars).\n');
    process.exit(1);
  }

  console.log(`\n=== Creating Tenant: ${tenantName} ===\n`);

  const tenantDir = path.join(dataDir, tenantName);
  const dbPath = path.join(tenantDir, 'financer.db');

  // Check if tenant already exists
  if (fs.existsSync(dbPath)) {
    console.error(`Tenant "${tenantName}" already exists at: ${tenantDir}`);
    process.exit(1);
  }

  // Create directory
  fs.mkdirSync(tenantDir, { recursive: true });
  console.log(`Created directory: ${tenantDir}`);

  // If migrating, copy existing database
  if (migratePath) {
    if (!fs.existsSync(migratePath)) {
      console.error(`Migration source not found: ${migratePath}`);
      process.exit(1);
    }

    fs.copyFileSync(migratePath, dbPath);
    const size = (fs.statSync(dbPath).size / 1024).toFixed(1);
    console.log(`Migrated database from: ${migratePath} (${size} KB)`);
  } else {
    console.log('No database created yet - it will be initialized on first access.');
  }

  console.log(`\nTenant "${tenantName}" is ready!`);
  console.log(`Access it at: https://${tenantName}.${process.env.BASE_DOMAIN || 'getfinancer.com'}`);
  console.log('');
}

createTenant();
