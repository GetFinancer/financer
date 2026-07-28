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
  // The native WKWebView/window background is white by default and shows
  // through in areas the web content doesn't cover yet (e.g. the status-bar
  // strip revealed by contentInset, or a brief flash before the page paints).
  backgroundColor: '#0b1020',
  server: {
    // Without this, Capacitor treats navigation to the live tenant domain as
    // "external" and hands it off to Safari instead of loading it in-app —
    // this must cover every possible tenant subdomain.
    allowNavigation: ['*.getfinancer.com', 'getfinancer.com'],
  },
  ios: {
    // By default the WKWebView renders edge-to-edge under the status bar.
    // "automatic" makes iOS inset the page content below the status bar/notch
    // itself, instead of the app's own top UI being drawn underneath it.
    // (Tried "never" to stop the native scroll-view bounce that shifted the
    // header/bottom nav — but that also breaks env(safe-area-inset-*), so the
    // header ends up flush under the status bar. Bounce is instead disabled
    // natively in ViewController.swift, see there.)
    contentInset: 'automatic',
  },
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
