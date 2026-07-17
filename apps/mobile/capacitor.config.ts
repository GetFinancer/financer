import type { CapacitorConfig } from '@capacitor/cli';

// Kein server.url: die Web-App ist Multi-Tenant per Subdomain
// (<tenant>.getfinancer.com), es gibt keine feste Domain für alle Nutzer.
// Stattdessen lädt die App lokal www/index.html, die den zuletzt
// gespeicherten Tenant-Host aus localStorage liest und dorthin
// weiterleitet (oder bei Erststart danach fragt).
const config: CapacitorConfig = {
  appId: 'com.getfinancer.app',
  appName: 'Financer',
  webDir: 'www',
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#0b1020',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
