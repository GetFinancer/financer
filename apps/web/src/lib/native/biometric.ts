import { isNative } from './index';

export async function isBiometricAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    const result = await BiometricAuth.checkBiometry();
    return result.isAvailable;
  } catch {
    return false;
  }
}

export async function authenticate(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    await BiometricAuth.authenticate();
    return true;
  } catch {
    return false;
  }
}
