#!/usr/bin/env tsx
/**
 * Admin CLI Script
 *
 * Manage tenants and coupons from the command line.
 *
 * Usage:
 *   npm run admin -- --list-tenants
 *   npm run admin -- --stats
 *   npm run admin -- --tenant NAME --set-status active
 *   npm run admin -- --tenant NAME --extend-trial 30
 *   npm run admin -- --tenant NAME --delete
 *   npm run admin -- --create-coupon --type trial_extension --value 30 --max-uses 100
 *   npm run admin -- --create-coupon --type trial_extension --value 30 --code WELCOME30
 *   npm run admin -- --list-coupons
 *   npm run admin -- --delete-coupon CODE
 */

import {
  initRegistry,
  getRegisteredTenants,
  getRegistryStats,
  updateTenantStatus,
  updateTenantTrialEnd,
  deleteTenant,
  createCoupon,
  getCoupons,
  deleteCoupon as removeCoupon,
} from '../db/registry.js';
import type { TenantPlan } from '@financer/shared';

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

async function main() {
  await initRegistry();

  // --stats
  if (hasFlag('stats')) {
    const stats = getRegistryStats();
    console.log('\n=== Tenant Stats ===');
    console.log(`  Total:     ${stats.total}`);
    console.log(`  Trial:     ${stats.trial}`);
    console.log(`  Active:    ${stats.active}`);
    console.log(`  Expired:   ${stats.expired}`);
    console.log(`  Cancelled: ${stats.cancelled}`);
    console.log('');
    return;
  }

  // --list-tenants
  if (hasFlag('list-tenants')) {
    const tenants = getRegisteredTenants();
    console.log('\n=== Registered Tenants ===');
    if (tenants.length === 0) {
      console.log('  (none)');
    } else {
      for (const t of tenants) {
        const trial = t.trialEndsAt ? ` (trial until ${new Date(t.trialEndsAt).toLocaleDateString()})` : '';
        const stripe = t.stripeCustomerId ? ' [Stripe]' : '';
        console.log(`  ${t.name.padEnd(20)} ${t.status.padEnd(10)} ${t.createdAt.substring(0, 10)}${trial}${stripe}`);
      }
    }
    console.log('');
    return;
  }

  // --list-coupons
  if (hasFlag('list-coupons')) {
    const coupons = getCoupons();
    console.log('\n=== Coupons ===');
    if (coupons.length === 0) {
      console.log('  (none)');
    } else {
      for (const c of coupons) {
        const expires = c.expiresAt ? ` expires ${new Date(c.expiresAt).toLocaleDateString()}` : '';
        const valueStr = c.type === 'trial_extension' ? `${c.value} days` : c.type === 'discount' ? `${c.value}%` : '—';
        console.log(`  ${c.code.padEnd(15)} ${c.type.padEnd(18)} ${valueStr.padEnd(10)} ${c.timesUsed}/${c.maxUses} used${expires}`);
      }
    }
    console.log('');
    return;
  }

  // --create-coupon
  if (hasFlag('create-coupon')) {
    const type = getArg('type') as 'trial_extension' | 'free_access' | 'discount' | undefined;
    const value = getArg('value');
    const maxUses = getArg('max-uses');
    const code = getArg('code');
    const expiresAt = getArg('expires-at');
    const stripeCouponId = getArg('stripe-coupon-id');

    if (!type || !value) {
      console.error('\nError: --type and --value are required for --create-coupon');
      console.error('Example: npm run admin -- --create-coupon --type trial_extension --value 30\n');
      process.exit(1);
    }

    const generatedCode = code || generateCode();
    createCoupon({
      code: generatedCode,
      type,
      value: parseInt(value),
      maxUses: maxUses ? parseInt(maxUses) : 1,
      expiresAt,
      stripeCouponId,
    });
    console.log(`\nCoupon created: ${generatedCode} (${type}, value: ${value})\n`);
    return;
  }

  // --delete-coupon CODE
  if (hasFlag('delete-coupon')) {
    const code = getArg('delete-coupon');
    if (!code) {
      console.error('\nError: provide coupon code after --delete-coupon\n');
      process.exit(1);
    }
    const deleted = removeCoupon(code);
    if (deleted) {
      console.log(`\nCoupon ${code.toUpperCase()} deleted.\n`);
    } else {
      console.error(`\nCoupon ${code.toUpperCase()} not found.\n`);
      process.exit(1);
    }
    return;
  }

  // Tenant-specific commands
  const tenantName = getArg('tenant');
  if (tenantName) {
    // --set-status
    const status = getArg('set-status') as TenantPlan | undefined;
    if (status) {
      const valid: TenantPlan[] = ['trial', 'active', 'expired', 'cancelled'];
      if (!valid.includes(status)) {
        console.error(`\nError: invalid status "${status}". Valid: ${valid.join(', ')}\n`);
        process.exit(1);
      }
      updateTenantStatus(tenantName, status);
      console.log(`\nTenant "${tenantName}" status set to: ${status}\n`);
      return;
    }

    // --extend-trial DAYS
    const extendDays = getArg('extend-trial');
    if (extendDays) {
      const days = parseInt(extendDays);
      const newEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      updateTenantTrialEnd(tenantName, newEnd);
      console.log(`\nTenant "${tenantName}" trial extended by ${days} days (until ${new Date(newEnd).toLocaleDateString()})\n`);
      return;
    }

    // --delete
    if (hasFlag('delete')) {
      deleteTenant(tenantName);
      console.log(`\nTenant "${tenantName}" deleted.\n`);
      return;
    }

    console.error('\nError: specify an action: --set-status, --extend-trial, or --delete\n');
    process.exit(1);
  }

  // No valid command
  console.log(`
Usage:
  npm run admin -- --stats
  npm run admin -- --list-tenants
  npm run admin -- --list-coupons
  npm run admin -- --tenant NAME --set-status active|trial|expired|cancelled
  npm run admin -- --tenant NAME --extend-trial DAYS
  npm run admin -- --tenant NAME --delete
  npm run admin -- --create-coupon --type trial_extension --value 30 [--max-uses 100] [--code CODE]
  npm run admin -- --delete-coupon CODE
`);
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
