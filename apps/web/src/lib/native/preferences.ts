import { isNative } from './index';

const LOCK_ENABLED_KEY = 'financer.biometricLockEnabled';

export async function getLockEnabled(): Promise<boolean> {
  if (!isNative()) return false;
  const { Preferences } = await import('@capacitor/preferences');
  const { value } = await Preferences.get({ key: LOCK_ENABLED_KEY });
  return value === 'true';
}

export async function setLockEnabled(v: boolean): Promise<void> {
  if (!isNative()) return;
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.set({ key: LOCK_ENABLED_KEY, value: v ? 'true' : 'false' });
}
