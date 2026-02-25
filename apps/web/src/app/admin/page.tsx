'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AdminStats, AdminTenant, Coupon, CouponType, TenantPlan } from '@financer/shared';
import { PasswordInput } from '@/components/PasswordInput';

const API_BASE = '/api/admin';

async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ===== Login =====
function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await adminFetch('/login', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      onLogin();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
      <div className="w-full max-w-sm">
        <div className="glass-card glass-glow p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">Financer Admin</h1>
            <p className="text-foreground-secondary">Enter admin token to continue</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="token" className="block text-sm font-medium mb-2">
                Admin Token
              </label>
              <PasswordInput
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full px-4 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••••"
                required
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 nav-item-active rounded-full hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ===== Stats Cards =====
function StatsCards({ stats }: { stats: AdminStats }) {
  const cards = [
    { label: 'Total', value: stats.total, color: 'text-foreground' },
    { label: 'Trial', value: stats.trial, color: 'text-blue-400' },
    { label: 'Active', value: stats.active, color: 'text-green-400' },
    { label: 'Expired', value: stats.expired, color: 'text-yellow-400' },
    { label: 'Cancelled', value: stats.cancelled, color: 'text-red-400' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
      {cards.map((c) => (
        <div key={c.label} className="glass-card p-4 text-center">
          <div className={`text-3xl font-bold ${c.color}`}>{c.value}</div>
          <div className="text-sm text-muted-foreground mt-1">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

// ===== Tenant Table =====
function TenantTable({
  tenants,
  onRefresh,
  hosted = false,
}: {
  tenants: AdminTenant[];
  onRefresh: () => void;
  hosted?: boolean;
}) {
  const [editingTenant, setEditingTenant] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<TenantPlan>('trial');
  const [extendDays, setExtendDays] = useState('30');
  const [tenantInfo, setTenantInfo] = useState<Record<string, { email: string; has2fa: boolean; hasPassword: boolean; mailerConfigured: boolean }>>({});
  const [pwResetStatus, setPwResetStatus] = useState<Record<string, string>>({});

  async function handleStatusChange(name: string) {
    await adminFetch(`/tenants/${name}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    });
    setEditingTenant(null);
    onRefresh();
  }

  async function handleExtendTrial(name: string) {
    const days = parseInt(extendDays);
    if (isNaN(days) || days <= 0) return;
    const newEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    await adminFetch(`/tenants/${name}`, {
      method: 'PATCH',
      body: JSON.stringify({ trialEndsAt: newEnd }),
    });
    setEditingTenant(null);
    onRefresh();
  }

  async function handleDelete(name: string) {
    if (!confirm(`Delete tenant "${name}" and all data? This cannot be undone!`)) return;
    await adminFetch(`/tenants/${name}`, { method: 'DELETE' });
    onRefresh();
  }

  async function loadTenantInfo(name: string) {
    try {
      const info = await adminFetch<{ success: boolean; email: string; has2fa: boolean; hasPassword: boolean; mailerConfigured: boolean }>(`/tenants/${name}/email`);
      setTenantInfo(prev => ({ ...prev, [name]: { email: info.email, has2fa: info.has2fa, hasPassword: info.hasPassword, mailerConfigured: info.mailerConfigured } }));
    } catch {
      // Ignore
    }
  }

  async function handleResetPassword(name: string) {
    const info = tenantInfo[name];
    if (!info?.email) {
      alert('Password reset not possible: this tenant has no email address on file.\n\nThe user must add an email address in Settings first.');
      return;
    }
    if (!info?.mailerConfigured) {
      alert('Password reset not possible: SMTP is not configured on this server.\n\nSet SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.');
      return;
    }
    if (!confirm(`Send a temporary password to ${info.email}?`)) return;
    try {
      const result = await adminFetch<{ success: boolean; emailSentTo: string }>(`/tenants/${name}/reset-password`, { method: 'POST' });
      setPwResetStatus(prev => ({ ...prev, [name]: `Email sent to ${result.emailSentTo}` }));
    } catch (err: any) {
      setPwResetStatus(prev => ({ ...prev, [name]: `Failed: ${err.message}` }));
    }
  }

  async function handleReset2FA(name: string) {
    if (!confirm(`Reset 2FA for "${name}"? The user will need to set up 2FA again.`)) return;
    try {
      await adminFetch(`/tenants/${name}/reset-2fa`, { method: 'POST' });
      alert(`2FA reset for "${name}".`);
      loadTenantInfo(name);
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    }
  }

  const statusColors: Record<TenantPlan, string> = {
    trial: 'bg-blue-500/20 text-blue-400',
    active: 'bg-green-500/20 text-green-400',
    expired: 'bg-yellow-500/20 text-yellow-400',
    cancelled: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="glass-card p-6 mb-8">
      <h2 className="text-lg font-semibold mb-4">Tenants</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="pb-2 pr-4">Name</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4">Created</th>
              {hosted && <th className="pb-2 pr-4">Trial Ends</th>}
              {hosted && <th className="pb-2 pr-4">Stripe</th>}
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.name} className="border-b border-border/50">
                <td className="py-3 pr-4 font-medium">{t.name}</td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[t.status]}`}>
                    {t.status}
                  </span>
                </td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {new Date(t.createdAt).toLocaleDateString()}
                </td>
                {hosted && (
                  <td className="py-3 pr-4 text-muted-foreground">
                    {t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString() : '—'}
                  </td>
                )}
                {hosted && (
                  <td className="py-3 pr-4">
                    {t.stripeCustomerId ? (
                      <span className="text-green-400 text-xs">Connected</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                )}
                <td className="py-3">
                  {editingTenant === t.name ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2 items-center">
                        <select
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value as TenantPlan)}
                          className="px-2 py-1 rounded border border-border bg-background text-xs"
                        >
                          <option value="trial">Trial</option>
                          <option value="active">Active</option>
                          <option value="expired">Expired</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <button
                          onClick={() => handleStatusChange(t.name)}
                          className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs"
                        >
                          Set
                        </button>
                      </div>
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          value={extendDays}
                          onChange={(e) => setExtendDays(e.target.value)}
                          className="w-16 px-2 py-1 rounded border border-border bg-background text-xs"
                          placeholder="Days"
                        />
                        <button
                          onClick={() => handleExtendTrial(t.name)}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
                        >
                          Extend Trial
                        </button>
                        <button
                          onClick={() => setEditingTenant(null)}
                          className="px-2 py-1 text-muted-foreground text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setEditingTenant(t.name); setNewStatus(t.status); }}
                          className="px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => { if (!tenantInfo[t.name]) loadTenantInfo(t.name); }}
                          className="px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                        >
                          Info
                        </button>
                        <button
                          onClick={() => handleResetPassword(t.name)}
                          className="px-2 py-1 text-xs text-yellow-400 hover:bg-yellow-500/10 rounded transition-colors"
                        >
                          Reset PW
                        </button>
                        <button
                          onClick={() => handleReset2FA(t.name)}
                          className="px-2 py-1 text-xs text-orange-400 hover:bg-orange-500/10 rounded transition-colors"
                        >
                          Reset 2FA
                        </button>
                        <button
                          onClick={() => handleDelete(t.name)}
                          className="px-2 py-1 text-xs text-destructive hover:bg-destructive/10 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                      {tenantInfo[t.name] && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>Email: {tenantInfo[t.name].email || <span className="text-yellow-500">— (PW-Reset nicht möglich)</span>}</div>
                          <div>2FA: {tenantInfo[t.name].has2fa ? 'Active' : 'Off'}</div>
                          <div>Password: {tenantInfo[t.name].hasPassword ? 'Set' : 'Not set'}</div>
                          <div>SMTP: {tenantInfo[t.name].mailerConfigured ? <span className="text-green-400">configured</span> : <span className="text-yellow-500">not configured</span>}</div>
                        </div>
                      )}
                      {pwResetStatus[t.name] && (
                        <div className="text-xs bg-blue-500/10 border border-blue-500/30 rounded p-2 text-blue-300">
                          {pwResetStatus[t.name]}
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={hosted ? 6 : 4} className="py-8 text-center text-muted-foreground">
                  No tenants registered yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== Coupon Section =====
function CouponSection({
  coupons,
  onRefresh,
}: {
  coupons: Coupon[];
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState('');
  const [type, setType] = useState<CouponType>('trial_extension');
  const [value, setValue] = useState('30');
  const [maxUses, setMaxUses] = useState('1');
  const [expiresAt, setExpiresAt] = useState('');
  const [stripeCouponId, setStripeCouponId] = useState('');
  const [error, setError] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await adminFetch('/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: code || undefined,
          type,
          value: parseInt(value),
          maxUses: parseInt(maxUses),
          expiresAt: expiresAt || undefined,
          stripeCouponId: stripeCouponId || undefined,
        }),
      });
      setShowForm(false);
      setCode('');
      setValue('30');
      setMaxUses('1');
      setExpiresAt('');
      setStripeCouponId('');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(couponCode: string) {
    if (!confirm(`Delete coupon "${couponCode}"?`)) return;
    await adminFetch(`/coupons/${couponCode}`, { method: 'DELETE' });
    onRefresh();
  }

  const typeLabels: Record<CouponType, string> = {
    trial_extension: 'Trial Extension',
    free_access: 'Free Access',
    discount: 'Discount',
  };

  const typeColors: Record<CouponType, string> = {
    trial_extension: 'bg-blue-500/20 text-blue-400',
    free_access: 'bg-green-500/20 text-green-400',
    discount: 'bg-purple-500/20 text-purple-400',
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Coupons</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
        >
          {showForm ? 'Cancel' : 'Create Coupon'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="glass-card p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Code (auto-generated if empty)</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-1.5 rounded border border-border bg-background text-sm"
                placeholder="e.g. WELCOME30"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CouponType)}
                className="w-full px-3 py-1.5 rounded border border-border bg-background text-sm"
              >
                <option value="trial_extension">Trial Extension (days)</option>
                <option value="free_access">Free Access</option>
                <option value="discount">Stripe Discount (%)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Value ({type === 'trial_extension' ? 'days' : type === 'discount' ? 'percent' : 'n/a'})
              </label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full px-3 py-1.5 rounded border border-border bg-background text-sm"
                min="0"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Max Uses</label>
              <input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                className="w-full px-3 py-1.5 rounded border border-border bg-background text-sm"
                min="1"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Expires At (optional)</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-1.5 rounded border border-border bg-background text-sm"
              />
            </div>
            {type === 'discount' && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Stripe Coupon ID</label>
                <input
                  type="text"
                  value={stripeCouponId}
                  onChange={(e) => setStripeCouponId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-border bg-background text-sm"
                  placeholder="e.g. coupon_xxx"
                />
              </div>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
          >
            Create
          </button>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="pb-2 pr-4">Code</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4">Value</th>
              <th className="pb-2 pr-4">Uses</th>
              <th className="pb-2 pr-4">Expires</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.code} className="border-b border-border/50">
                <td className="py-3 pr-4 font-mono font-medium">{c.code}</td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[c.type]}`}>
                    {typeLabels[c.type]}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  {c.type === 'trial_extension' ? `${c.value} days` : c.type === 'discount' ? `${c.value}%` : '—'}
                </td>
                <td className="py-3 pr-4">
                  {c.timesUsed} / {c.maxUses}
                </td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '—'}
                </td>
                <td className="py-3">
                  <button
                    onClick={() => handleDelete(c.code)}
                    className="px-2 py-1 text-xs text-destructive hover:bg-destructive/10 rounded transition-colors"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {coupons.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  No coupons created yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== Diagnose & Cleanup Section =====
interface DiagnoseResult {
  dataDir: string;
  exists: boolean;
  writable: boolean;
  registryExists: boolean;
  tenants: Array<{ name: string; hasDir: boolean; hasDb: boolean }>;
}

function DiagnoseSection() {
  const [result, setResult] = useState<DiagnoseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<Array<{ name: string; action: string }> | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  async function runDiagnose() {
    setLoading(true);
    setResult(null);
    try {
      const data = await adminFetch<DiagnoseResult>('/diagnose');
      setResult(data);
    } catch (err) {
      console.error('Diagnose failed:', err);
    } finally {
      setLoading(false);
    }
  }

  async function runCleanup() {
    if (!confirm('Remove all orphaned registry entries (tenants without directory)?')) return;
    setCleanupLoading(true);
    setCleanupResult(null);
    try {
      const data = await adminFetch<{ success: boolean; cleaned: Array<{ name: string; action: string }> }>('/cleanup', { method: 'POST' });
      setCleanupResult(data.cleaned);
      runDiagnose();
    } catch (err) {
      console.error('Cleanup failed:', err);
    } finally {
      setCleanupLoading(false);
    }
  }

  const orphanedCount = result?.tenants.filter(t => !t.hasDir).length ?? 0;

  return (
    <div className="glass-card p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">System Diagnose</h2>
        <div className="flex gap-2">
          {orphanedCount > 0 && (
            <button
              onClick={runCleanup}
              disabled={cleanupLoading}
              className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded-md text-sm hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {cleanupLoading ? 'Cleaning...' : `Cleanup ${orphanedCount} orphaned`}
            </button>
          )}
          <button
            onClick={runDiagnose}
            disabled={loading}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Run Diagnose'}
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-card p-3">
              <div className="text-xs text-muted-foreground mb-1">Data Dir</div>
              <div className="text-sm font-mono truncate" title={result.dataDir}>{result.dataDir}</div>
            </div>
            <div className="glass-card p-3">
              <div className="text-xs text-muted-foreground mb-1">Dir Exists</div>
              <div className={`text-sm font-medium ${result.exists ? 'text-green-400' : 'text-red-400'}`}>
                {result.exists ? 'Yes' : 'No'}
              </div>
            </div>
            <div className="glass-card p-3">
              <div className="text-xs text-muted-foreground mb-1">Writable</div>
              <div className={`text-sm font-medium ${result.writable ? 'text-green-400' : 'text-red-400'}`}>
                {result.writable ? 'Yes' : 'No'}
              </div>
            </div>
            <div className="glass-card p-3">
              <div className="text-xs text-muted-foreground mb-1">Registry</div>
              <div className={`text-sm font-medium ${result.registryExists ? 'text-green-400' : 'text-yellow-400'}`}>
                {result.registryExists ? 'OK' : 'In-Memory Only'}
              </div>
            </div>
          </div>

          {result.tenants.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="pb-2 pr-4">Tenant</th>
                    <th className="pb-2 pr-4">Directory</th>
                    <th className="pb-2">Database</th>
                  </tr>
                </thead>
                <tbody>
                  {result.tenants.map(t => (
                    <tr key={t.name} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium">{t.name}</td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${t.hasDir ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {t.hasDir ? 'OK' : 'MISSING'}
                        </span>
                      </td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${t.hasDb ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {t.hasDb ? 'OK' : 'Not yet'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!result.writable && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md text-sm text-red-400">
              Data directory is not writable! New tenants cannot be created. Check folder permissions on the server.
            </div>
          )}
        </div>
      )}

      {cleanupResult && cleanupResult.length > 0 && (
        <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-md text-sm text-green-400">
          Cleaned up {cleanupResult.length} orphaned tenant(s): {cleanupResult.map(c => c.name).join(', ')}
        </div>
      )}
      {cleanupResult && cleanupResult.length === 0 && (
        <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-md text-sm text-blue-400">
          No orphaned tenants found.
        </div>
      )}
    </div>
  );
}

// ===== Main Admin Dashboard =====
interface AdminConfig {
  hosted: boolean;
  stripe: boolean;
}

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  const [config, setConfig] = useState<AdminConfig>({ hosted: false, stripe: false });
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  useEffect(() => {
    Promise.all([
      adminFetch<{ isAdmin: boolean; configured: boolean }>('/status'),
      adminFetch<AdminConfig>('/config'),
    ])
      .then(([statusData, configData]) => {
        setIsLoggedIn(statusData.isAdmin);
        setConfig(configData);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [s, t, c] = await Promise.all([
        adminFetch<AdminStats>('/stats'),
        adminFetch<AdminTenant[]>('/tenants'),
        config.hosted ? adminFetch<Coupon[]>('/coupons') : Promise.resolve([]),
      ]);
      setStats(s);
      setTenants(t);
      setCoupons(c);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
  }, [config.hosted]);

  useEffect(() => {
    if (isLoggedIn) loadData();
  }, [isLoggedIn, loadData]);

  async function handleLogout() {
    await adminFetch('/logout', { method: 'POST' });
    setIsLoggedIn(false);
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <AdminLogin onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Financer Admin</h1>
          {!config.hosted && (
            <span className="text-xs text-muted-foreground">Self-Hosted Mode</span>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Logout
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {stats && <StatsCards stats={stats} />}
        <DiagnoseSection />
        <TenantTable tenants={tenants} onRefresh={loadData} hosted={config.hosted} />
        {config.hosted && <CouponSection coupons={coupons} onRefresh={loadData} />}
      </main>
    </div>
  );
}
