import { Capacitor } from '@capacitor/core';

export function isNative(): boolean {
  if (typeof window === 'undefined') return false;
  return Capacitor.isNativePlatform();
}
