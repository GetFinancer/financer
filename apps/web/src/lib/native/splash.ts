import { isNative } from './index';

export async function hideSplash(): Promise<void> {
  if (!isNative()) return;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    // Best-effort — nothing meaningful to recover from here.
  }
}
