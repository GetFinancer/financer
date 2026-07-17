'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useTranslation, Locale } from '@/lib/i18n';
import type { TenantStatus, Category, SharedAccountInfo } from '@financer/shared';
import { PasswordInput } from '@/components/PasswordInput';
import { ReleaseNotesModal } from '@/components/ReleaseNotesModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="w-1 h-3.5 rounded-sm bg-primary flex-shrink-0" />
      <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{title}</h2>
    </div>
  );
}

interface TwoFactorStatus {
  enabled: boolean;
  hasBackupCodes: boolean;
  backupCodesRemaining: number;
}

interface SetupData {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

const PASSWORD_MIN_LENGTH = 12;

export default function SettingsPage() {
  const router = useRouter();
  const { t, locale, setLocale, locales } = useTranslation();

  // Password change form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // 2FA state
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [twoFactorSuccess, setTwoFactorSuccess] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // Disable 2FA form
  const [disableForm, setDisableForm] = useState({ password: '', code: '' });
  const [showDisableForm, setShowDisableForm] = useState(false);

  // Regenerate backup codes
  const [regeneratePassword, setRegeneratePassword] = useState('');
  const [showRegenerateForm, setShowRegenerateForm] = useState(false);

  // Billing state
  const [tenantStatus, setTenantStatus] = useState<TenantStatus | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState('');
  const searchParams = useSearchParams();

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMessage, setCouponMessage] = useState('');
  const [couponError, setCouponError] = useState('');

  // Email state
  const [email, setEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [emailError, setEmailError] = useState('');

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [themeMounted, setThemeMounted] = useState(false);

  // Release Notes state
  const [currentVersion, setCurrentVersion] = useState('0.0.0');
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);

  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoryDeleteError, setCategoryDeleteError] = useState('');
  const [categoryDeleteDialog, setCategoryDeleteDialog] = useState<number | null>(null);

  // Shared accounts state
  const [sharedAccounts, setSharedAccounts] = useState<SharedAccountInfo[]>([]);
  const [sharedAccountsLoading, setSharedAccountsLoading] = useState(true);

  useEffect(() => {
    load2FAStatus();
    loadTenantStatus();
    loadEmail();
    loadCategories();
    loadSharedAccounts();
    api.getReleaseNotesStatus().then(s => setCurrentVersion(s.currentVersion)).catch(() => {});
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
    // Mark as mounted after initial render to prevent animation flash
    // Use requestAnimationFrame to ensure the theme state has been painted
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setThemeMounted(true);
      });
    });
  }, []);

  async function loadTenantStatus() {
    try {
      const status = await api.getTenantStatus();
      setTenantStatus(status);
    } catch {
      // Ignore — legacy tenant or billing not configured
    }
  }

  async function loadEmail() {
    try {
      const result = await api.getEmail();
      setEmail(result.email || '');
    } catch {
      // Ignore
    }
  }

  async function loadCategories() {
    try {
      const data = await api.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setCategoriesLoading(false);
    }
  }

  function handleDeleteCategory(id: number) {
    setCategoryDeleteDialog(id);
  }

  async function confirmDeleteCategory() {
    if (categoryDeleteDialog === null) return;
    const id = categoryDeleteDialog;
    setCategoryDeleteDialog(null);
    try {
      await api.deleteCategory(id);
      loadCategories();
    } catch (error: any) {
      setCategoryDeleteError(error.message || t('categoriesDeleteFailed'));
    }
  }

  async function loadSharedAccounts() {
    try {
      const data = await api.getSharedAccounts();
      setSharedAccounts(data);
    } catch (error) {
      console.error('Failed to load shared accounts:', error);
    } finally {
      setSharedAccountsLoading(false);
    }
  }

  async function handleSaveEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailSaving(true);
    setEmailMessage('');
    setEmailError('');
    try {
      await api.updateEmail(email);
      setEmailMessage(t('settingsEmailSaved'));
    } catch (err: any) {
      setEmailError(err.message || t('settingsEmailError'));
    } finally {
      setEmailSaving(false);
    }
  }

  async function handleUpgrade() {
    setBillingLoading(true);
    setBillingError('');
    try {
      const result = await api.createCheckoutSession();
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err: any) {
      setBillingError(err.message || t('settingsBillingError'));
    } finally {
      setBillingLoading(false);
    }
  }

  async function handleRedeemCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCouponError('');
    setCouponMessage('');
    setCouponLoading(true);
    try {
      const result = await api.redeemCoupon(couponCode);
      setCouponMessage(result.message || t('couponRedeemed'));
      setCouponCode('');
      loadTenantStatus();
    } catch (err: any) {
      setCouponError(err.message || t('couponError'));
    } finally {
      setCouponLoading(false);
    }
  }

  async function handleManageBilling() {
    setBillingLoading(true);
    try {
      const result = await api.createPortalSession();
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error('Failed to create portal session:', error);
    } finally {
      setBillingLoading(false);
    }
  }

  function handleThemeChange(newTheme: 'dark' | 'light') {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }

  async function load2FAStatus() {
    try {
      const status = await api.get2FAStatus();
      setTwoFactorStatus(status);
    } catch (error) {
      console.error('Failed to load 2FA status:', error);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.newPassword.length < PASSWORD_MIN_LENGTH) {
      setPasswordError(t('settingsPasswordTooShort'));
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(t('settingsPasswordMismatch'));
      return;
    }

    setChangingPassword(true);

    try {
      await api.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordSuccess(t('settingsPasswordChanged'));
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      setPasswordError(error.message || t('settingsPasswordChangeFailed'));
    } finally {
      setChangingPassword(false);
    }
  }

  const [deleteAccountDialog, setDeleteAccountDialog] = useState(false);

  async function handleDeleteAccount() {
    try {
      await api.deleteMyAccount();
      router.push('/login');
    } catch (error) {
      console.error('Failed to delete account:', error);
    }
  }

  async function handleLogout() {
    try {
      await api.logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  async function handleSetup2FA() {
    setTwoFactorError('');
    setTwoFactorLoading(true);

    try {
      const data = await api.setup2FA();
      setSetupData(data);
      setBackupCodes(data.backupCodes);
    } catch (error: any) {
      setTwoFactorError(error.message || t('settings2faSetupFailed'));
    } finally {
      setTwoFactorLoading(false);
    }
  }

  async function handleVerify2FA(e: React.FormEvent) {
    e.preventDefault();
    setTwoFactorError('');
    setTwoFactorLoading(true);

    try {
      await api.verify2FA(verifyCode);
      setTwoFactorSuccess(t('settings2faActivated'));
      setSetupData(null);
      setVerifyCode('');
      setShowBackupCodes(true);
      load2FAStatus();
    } catch (error: any) {
      setTwoFactorError(error.message || t('settings2faVerifyFailed'));
    } finally {
      setTwoFactorLoading(false);
    }
  }

  async function handleDisable2FA(e: React.FormEvent) {
    e.preventDefault();
    setTwoFactorError('');
    setTwoFactorLoading(true);

    try {
      await api.disable2FA(disableForm.password, disableForm.code);
      setTwoFactorSuccess(t('settings2faDeactivated'));
      setShowDisableForm(false);
      setDisableForm({ password: '', code: '' });
      setBackupCodes([]);
      load2FAStatus();
    } catch (error: any) {
      setTwoFactorError(error.message || t('settings2faDeactivateFailed'));
    } finally {
      setTwoFactorLoading(false);
    }
  }

  async function handleRegenerateBackupCodes(e: React.FormEvent) {
    e.preventDefault();
    setTwoFactorError('');
    setTwoFactorLoading(true);

    try {
      const result = await api.regenerateBackupCodes(regeneratePassword);
      setBackupCodes(result.backupCodes);
      setShowBackupCodes(true);
      setShowRegenerateForm(false);
      setRegeneratePassword('');
      setTwoFactorSuccess(t('settings2faBackupCodesGenerated'));
      load2FAStatus();
    } catch (error: any) {
      setTwoFactorError(error.message || t('settings2faBackupCodesFailed'));
    } finally {
      setTwoFactorLoading(false);
    }
  }

  function cancelSetup() {
    setSetupData(null);
    setVerifyCode('');
    setTwoFactorError('');
    setBackupCodes([]);
  }

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-5 rounded-sm bg-primary" />
          <h1 className="text-lg font-bold tracking-tight">{t('settingsTitle')}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* PROFIL */}
          <section className="glass-card p-6">
            <SectionHeader title={t('settingsAppearance')} />

            {/* Email / Profile field */}
            <form onSubmit={handleSaveEmail} className="mb-5">
              <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                {t('settingsEmailTitle')}
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-[10px] border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  placeholder={t('settingsEmailPlaceholder')}
                />
                <button
                  type="submit"
                  disabled={emailSaving}
                  className="px-4 py-2 nav-item-active rounded-[10px] hover:opacity-90 active:scale-95 transition-all text-sm font-semibold disabled:opacity-50"
                >
                  {emailSaving ? '...' : t('settingsEmailSave')}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{t('settingsEmailDescription')}</p>
              {emailMessage && <p className="text-xs text-income mt-2">{emailMessage}</p>}
              {emailError && <p className="text-xs text-destructive mt-2">{emailError}</p>}
            </form>

            {/* Language segmented control */}
            <div className="mb-5">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                {t('settingsLanguage')}
              </span>
              <div className="inline-flex p-1 rounded-[11px] bg-white/[0.06] gap-1">
                {(Object.keys(locales) as Locale[]).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setLocale(loc)}
                    className={`px-4 py-1.5 rounded-[8px] text-xs font-semibold transition-all ${
                      locale === loc
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {locales[loc].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Darstellung pill choices */}
            <div>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                {t('settingsTheme')}
              </span>
              <div className="flex flex-wrap gap-2">
                {(['dark', 'light'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleThemeChange(mode)}
                    className={`px-4 py-1.5 rounded-full border text-xs font-semibold transition-all ${themeMounted ? '' : 'transition-none'} ${
                      theme === mode
                        ? 'bg-primary/12 border-primary/30 text-primary-hover'
                        : 'border-white/12 text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
                    }`}
                  >
                    {mode === 'dark' ? t('settingsThemeDark') : t('settingsThemeLight')}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* SICHERHEIT */}
          <section className="glass-card p-6">
            <SectionHeader title={t('settingsChangePassword')} />

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  {t('settingsCurrentPassword')}
                </label>
                <PasswordInput
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-[10px] border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  {t('settingsNewPassword')}
                </label>
                <PasswordInput
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-[10px] border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  {t('settingsConfirmNewPassword')}
                </label>
                <PasswordInput
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-[10px] border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  required
                />
              </div>

              {passwordError && (
                <p className="text-xs text-destructive">{passwordError}</p>
              )}

              {passwordSuccess && (
                <p className="text-xs text-income">{passwordSuccess}</p>
              )}

              <button
                type="submit"
                disabled={changingPassword}
                className="px-4 py-2 nav-item-active rounded-[10px] hover:opacity-90 active:scale-95 transition-all text-sm font-semibold disabled:opacity-50"
              >
                {changingPassword ? t('settingsChanging') : t('settingsChangePassword')}
              </button>
            </form>
          </section>
        </div>

        {/* 2FA Section */}
        <section className="glass-card p-6">
          <SectionHeader title={t('settings2faTitle')} />

          {twoFactorError && (
            <p className="text-sm text-destructive mb-4">{twoFactorError}</p>
          )}

          {twoFactorSuccess && (
            <p className="text-sm text-income mb-4">{twoFactorSuccess}</p>
          )}

          {/* Status display */}
          {twoFactorStatus && !setupData && !showDisableForm && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${twoFactorStatus.enabled ? 'bg-income' : 'bg-muted-foreground'}`} />
                  <span>{twoFactorStatus.enabled ? t('settings2faEnabled') : t('settings2faDisabled')}</span>
                </div>
                {twoFactorStatus.enabled && (
                  <span className="text-sm text-muted-foreground">
                    {t('settings2faBackupCodesRemaining', { count: twoFactorStatus.backupCodesRemaining })}
                  </span>
                )}
              </div>

              {!twoFactorStatus.enabled ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('settings2faDescription')}
                  </p>
                  <button
                    onClick={handleSetup2FA}
                    disabled={twoFactorLoading}
                    className="px-4 py-2 nav-item-active rounded-full hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {twoFactorLoading ? t('loading') : t('settings2faEnable')}
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowRegenerateForm(true)}
                    className="px-4 py-2 bg-background border border-border rounded-md hover:bg-background-surface-hover transition-colors text-sm"
                  >
                    {t('settings2faNewBackupCodes')}
                  </button>
                  <button
                    onClick={() => setShowDisableForm(true)}
                    className="px-4 py-2 text-destructive border border-destructive/30 rounded-md hover:bg-destructive/10 transition-colors text-sm"
                  >
                    {t('settings2faDisable')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Setup flow */}
          {setupData && (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-2">{t('settings2faScanQR')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('settings2faScanQRDescription')}
                </p>
                <div className="bg-white p-4 rounded-lg inline-block">
                  <Image
                    src={setupData.qrCodeUrl}
                    alt="2FA QR Code"
                    width={200}
                    height={200}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {t('settings2faManualCode')} <code className="bg-background px-2 py-1 rounded">{setupData.secret}</code>
                </p>
              </div>

              <div>
                <h3 className="font-medium mb-2">{t('settings2faSaveBackup')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('settings2faSaveBackupDescription')}
                </p>
                <div className="bg-background rounded-lg p-4 grid grid-cols-2 gap-2 font-mono text-sm">
                  {setupData.backupCodes.map((code, i) => (
                    <div key={i} className="text-center">{code}</div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">{t('settings2faVerifyCode')}</h3>
                <form onSubmit={handleVerify2FA} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {t('twoFactorCode')}
                    </label>
                    <input
                      type="text"
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\s/g, ''))}
                      className="w-full max-w-xs px-4 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-center text-xl tracking-widest"
                      placeholder="000000"
                      maxLength={6}
                      required
                      autoComplete="one-time-code"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={twoFactorLoading || verifyCode.length < 6}
                      className="px-4 py-2 nav-item-active rounded-full hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {twoFactorLoading ? t('verifyLoading') : t('settings2faActivate')}
                    </button>
                    <button
                      type="button"
                      onClick={cancelSetup}
                      className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Disable 2FA form */}
          {showDisableForm && (
            <form onSubmit={handleDisable2FA} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('settings2faDisableDescription')}
              </p>
              <div>
                <label className="block text-sm font-medium mb-2">{t('password')}</label>
                <PasswordInput
                  value={disableForm.password}
                  onChange={(e) => setDisableForm({ ...disableForm, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('settings2fa2faCode')}</label>
                <input
                  type="text"
                  value={disableForm.code}
                  onChange={(e) => setDisableForm({ ...disableForm, code: e.target.value.replace(/\s/g, '') })}
                  className="w-full max-w-xs px-4 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-center tracking-widest"
                  placeholder="000000"
                  maxLength={8}
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={twoFactorLoading}
                  className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  {twoFactorLoading ? t('settings2faDisabling') : t('settings2faDisable')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDisableForm(false);
                    setDisableForm({ password: '', code: '' });
                    setTwoFactorError('');
                  }}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          )}

          {/* Regenerate backup codes form */}
          {showRegenerateForm && (
            <form onSubmit={handleRegenerateBackupCodes} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('settings2faRegenerateDescription')}
              </p>
              <div>
                <label className="block text-sm font-medium mb-2">{t('password')}</label>
                <PasswordInput
                  value={regeneratePassword}
                  onChange={(e) => setRegeneratePassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={twoFactorLoading}
                  className="px-4 py-2 nav-item-active rounded-full hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                >
                  {twoFactorLoading ? t('settings2faGenerating') : t('settings2faGenerateNew')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRegenerateForm(false);
                    setRegeneratePassword('');
                    setTwoFactorError('');
                  }}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          )}

          {/* Show backup codes after generation */}
          {showBackupCodes && backupCodes.length > 0 && !setupData && (
            <div className="mt-4 space-y-4">
              <h3 className="font-medium">{t('settings2faYourBackupCodes')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('settings2faBackupCodesOneTime')}
              </p>
              <div className="bg-background rounded-lg p-4 grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((code, i) => (
                  <div key={i} className="text-center">{code}</div>
                ))}
              </div>
              <button
                onClick={() => {
                  setShowBackupCodes(false);
                  setBackupCodes([]);
                  setTwoFactorSuccess('');
                }}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('settings2faHideCodes')}
              </button>
            </div>
          )}
        </section>

        {/* KATEGORIEN + GETEILTE KONTEN */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* KATEGORIEN */}
          <section className="glass-card p-6">
            <SectionHeader title={t('settingsCategories')} />

            {categoryDeleteError && (
              <p className="text-xs text-destructive mb-3">{categoryDeleteError}</p>
            )}

            {categoriesLoading ? (
              <p className="text-sm text-muted-foreground">{t('loading')}</p>
            ) : categories.length === 0 ? (
              <p className="text-sm text-muted-foreground mb-4">{t('categoriesNoExpenseCategories')}</p>
            ) : (
              <div className="flex flex-wrap gap-2 mb-4">
                {categories.map((cat) => {
                  const color = cat.color || '#6b7280';
                  return (
                    <span
                      key={cat.id}
                      className="group inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-xs font-medium border"
                      style={{ backgroundColor: `${color}26`, borderColor: `${color}66`, color }}
                    >
                      {cat.name}
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="opacity-60 hover:opacity-100 transition-opacity"
                        aria-label={`${t('delete')} ${cat.name}`}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <Link
              href="/categories"
              className="inline-flex items-center justify-center px-4 py-2 rounded-[10px] border border-dashed border-white/20 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-white/35 transition-colors"
            >
              {t('categoriesNewCategory')}
            </Link>

            <div className="mt-4 pt-4 border-t border-border">
              <Link href="/categories" className="text-xs font-semibold text-primary-hover hover:opacity-80 transition-opacity">
                {t('settingsCategoriesManage')}
              </Link>
            </div>
          </section>

          {/* GETEILTE KONTEN */}
          <section className="glass-card p-6">
            <SectionHeader title={t('settingsSharedAccounts')} />

            {sharedAccountsLoading ? (
              <p className="text-sm text-muted-foreground">{t('loading')}</p>
            ) : sharedAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground mb-4">{t('sharedAccountsEmpty')}</p>
            ) : (
              <div className="space-y-3 mb-4">
                {sharedAccounts.map((sa) => (
                  <div key={sa.uuid} className="flex items-center justify-between gap-3 p-3 rounded-[10px] bg-white/[0.04]">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{sa.accountName}</p>
                      <p className="text-[10.5px] text-muted-foreground">
                        {t('sharedAccountsOwner')}: {sa.isOwner ? t('sharedAccountsYou') : sa.ownerTenant} · {t('sharedAccountsMembers').replace('{count}', String(sa.members.length))}
                      </p>
                    </div>
                    <div className="flex -space-x-2 flex-shrink-0">
                      {sa.members.map((m) => (
                        <div
                          key={m.tenant}
                          title={m.displayName || m.tenant}
                          className="w-[26px] h-[26px] rounded-full bg-primary/20 border-2 border-background text-primary-hover text-[10px] font-bold flex items-center justify-center"
                        >
                          {(m.displayName || m.tenant).charAt(0).toUpperCase()}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Link
              href="/shared-accounts"
              className="inline-flex items-center justify-center px-4 py-2 rounded-[10px] border border-dashed border-white/20 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-white/35 transition-colors"
            >
              + {t('sharedAccountsShare')}
            </Link>

            <div className="mt-4 pt-4 border-t border-border">
              <Link href="/shared-accounts" className="text-xs font-semibold text-primary-hover hover:opacity-80 transition-opacity">
                {t('settingsSharedAccountsManage')}
              </Link>
            </div>
          </section>
        </div>

        {categoryDeleteDialog !== null && (
          <ConfirmDialog
            message={t('categoriesConfirmDelete')}
            onConfirm={confirmDeleteCategory}
            onCancel={() => setCategoryDeleteDialog(null)}
            confirmLabel={t('yes')}
            cancelLabel={t('cancel')}
          />
        )}

        {/* Billing Section */}
        {tenantStatus && !tenantStatus.legacy && (
          <section className="glass-card p-6">
            <SectionHeader title={t('settingsBillingTitle')} />

            {tenantStatus.status === 'trial' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span>{t('settingsBillingTrial')}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('settingsBillingTrialDays', { days: String(tenantStatus.daysRemaining ?? 0) })}
                </p>
                <button
                  onClick={handleUpgrade}
                  disabled={billingLoading}
                  className="px-4 py-2 nav-item-active rounded-full hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                >
                  {billingLoading ? t('settingsBillingLoading') : t('settingsBillingUpgrade')}
                </button>
              </div>
            )}

            {tenantStatus.status === 'active' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-income" />
                  <span>{tenantStatus.activatedByCoupon ? t('settingsBillingCouponActive') : t('settingsBillingActive')}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {tenantStatus.activatedByCoupon ? t('settingsBillingCouponActiveDescription') : t('settingsBillingActiveDescription')}
                </p>
                {tenantStatus.hasPaymentMethod && !tenantStatus.activatedByCoupon && (
                  <button
                    onClick={handleManageBilling}
                    disabled={billingLoading}
                    className="px-4 py-2 bg-background border border-border rounded-md hover:bg-background-surface-hover transition-colors text-sm disabled:opacity-50"
                  >
                    {billingLoading ? t('settingsBillingLoading') : t('settingsBillingManage')}
                  </button>
                )}
              </div>
            )}

            {(tenantStatus.status === 'expired' || tenantStatus.status === 'cancelled') && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <span>{t('settingsBillingExpired')}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('settingsBillingExpiredDescription')}
                </p>
                <button
                  onClick={handleUpgrade}
                  disabled={billingLoading}
                  className="px-4 py-2 nav-item-active rounded-full hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                >
                  {billingLoading ? t('settingsBillingLoading') : t('settingsBillingUpgrade')}
                </button>
              </div>
            )}

            {searchParams.get('billing') === 'success' && (
              <p className="text-sm text-income mt-4">{t('settingsBillingActiveDescription')}</p>
            )}

            {billingError && (
              <p className="text-sm text-destructive mt-4">{billingError}</p>
            )}

            {/* Coupon Redemption */}
            <div className="mt-6 pt-6 border-t border-border">
              <h3 className="text-sm font-medium mb-3">{t('couponTitle')}</h3>
              <form onSubmit={handleRedeemCoupon} className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="flex-1 px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  placeholder={t('couponPlaceholder')}
                  required
                />
                <button
                  type="submit"
                  disabled={couponLoading || !couponCode.trim()}
                  className="px-4 py-2 nav-item-active rounded-full hover:opacity-90 active:scale-95 transition-all text-sm disabled:opacity-50"
                >
                  {couponLoading ? '...' : t('couponRedeem')}
                </button>
              </form>
              {couponMessage && <p className="text-sm text-income mt-2">{couponMessage}</p>}
              {couponError && <p className="text-sm text-destructive mt-2">{couponError}</p>}
            </div>
          </section>
        )}

        {/* App Info Section */}
        <section className="glass-card p-6">
          <SectionHeader title={t('settingsAppInfo')} />

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('settingsVersion')}</dt>
              <dd>{currentVersion}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('settingsLicense')}</dt>
              <dd>MIT</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-border">
            <button
              onClick={() => setReleaseNotesOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-background border border-border rounded-md hover:bg-background-surface-hover transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {t('settingsReleaseNotes')}
            </button>
            <a
              href="https://docs.getfinancer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-background border border-border rounded-md hover:bg-background-surface-hover transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {t('navDocumentation')}
            </a>
            <a
              href="https://bugsfinancer.itwtserv.ovh"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-background border border-border rounded-md hover:bg-background-surface-hover transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {t('navFeedback')}
            </a>
          </div>

          {process.env.DEPLOYMENT_MODE === 'cloudhost' && (
            <p className="text-sm text-muted-foreground mt-4 pt-4 border-t border-border">
              {t('settingsSupportContact')}{' '}
              <a href="mailto:admin@getfinancer.com" className="text-foreground underline underline-offset-2">
                admin@getfinancer.com
              </a>
            </p>
          )}
        </section>

        {/* Danger Zone — cloudhost only */}
        {process.env.DEPLOYMENT_MODE === 'cloudhost' && (
          <section className="glass-card p-6 border border-destructive/30">
            <h2 className="text-sm font-bold text-destructive mb-2">{t('settingsDeleteAccount')}</h2>
            <p className="text-sm text-muted-foreground mb-4">{t('settingsDeleteAccountDesc')}</p>
            <button
              onClick={() => setDeleteAccountDialog(true)}
              className="px-4 py-2 border border-destructive text-destructive rounded-md hover:bg-destructive/10 transition-colors text-sm"
            >
              {t('settingsDeleteAccountButton')}
            </button>
          </section>
        )}

        {/* Footer bar */}
        <div className="flex items-center justify-between gap-4 pt-4 pb-1 text-xs text-muted-foreground border-t border-white/[0.08] mt-2">
          <span className="font-mono">
            v{currentVersion} · {t('settingsFooterLicense')}
          </span>
          <button
            onClick={handleLogout}
            className="font-semibold text-destructive hover:opacity-80 transition-opacity"
          >
            {t('logout')} →
          </button>
        </div>
      </div>

      {deleteAccountDialog && (
        <ConfirmDialog
          message={t('settingsDeleteAccountConfirm')}
          onConfirm={() => { setDeleteAccountDialog(false); handleDeleteAccount(); }}
          onCancel={() => setDeleteAccountDialog(false)}
          confirmLabel={t('settingsDeleteAccountButton')}
          cancelLabel={t('cancel')}
        />
      )}

      {releaseNotesOpen && (
        <ReleaseNotesModal
          version={currentVersion}
          onClose={() => setReleaseNotesOpen(false)}
        />
      )}
    </>
  );
}
