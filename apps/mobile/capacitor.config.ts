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
    // "never": the WKWebView renders edge-to-edge and does NOT add its own
    // native content inset for the status bar/notch. Safe-area insetting is
    // instead handled entirely on the CSS side via env(safe-area-inset-*)
    // (viewportFit: 'cover' in layout.tsx + the safe-area-top/bottom classes
    // and fixed header/bottom nav). Using "automatic" here as well double-
    // applies the inset (native inset + CSS padding stacked), which showed up
    // as an oversized header on first paint until the first scroll event.
    contentInset: 'never',
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
