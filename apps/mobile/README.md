# @financer/mobile

Capacitor-Wrapper für iOS und Android, der die live gehostete Financer-Web-App (`https://<tenant>.getfinancer.com`) im WebView lädt. Kein eigener Build der Web-App — dieses Package ist bewusst isoliert und nicht Teil der Docker-Deploy-Pipeline (`docker-compose.yml`, Root-`package.json`-Scripts).

## Funktionsweise

Da die App Multi-Tenant ist (jeder Nutzer hat eine eigene Subdomain, keine feste Domain für alle), gibt es keine feste `server.url` in `capacitor.config.ts`. Stattdessen lädt die App lokal `www/index.html`:

- Ist im WebView-`localStorage` bereits ein Tenant-Host gespeichert (`financer.tenantHost`), wird sofort per `window.location.href` dorthin weitergeleitet.
- Ansonsten zeigt die Seite ein einfaches Formular zur Eingabe der Financer-Adresse (z. B. `dein-tenant.getfinancer.com`), speichert die Eingabe und leitet dann weiter.

Ab dem Redirect läuft die eigentliche Next.js-App normal im selben Origin (Cookies, Login, Sessions funktionieren wie im Browser).

Den Splash Screen (`launchAutoHide: false`) blendet die Web-App-Seite selbst aus, sobald Tenant-Redirect bzw. Biometrie-Check abgeschlossen sind (wird in `apps/web` gepflegt).

## Setup

```bash
pnpm install
```

Native Projekte hinzufügen (braucht lokal installiertes Xcode bzw. Android Studio/SDK):

```bash
cd apps/mobile
npx cap add ios
npx cap add android
```

Nach jeder Änderung an `www/` oder `capacitor.config.ts`:

```bash
npx cap sync
```

## Icons & Splash Screen

1. `icon.png` (1024×1024) und `splash.png` in `apps/mobile/resources/` ablegen, siehe `resources/README.md`.
2. Generieren:

```bash
npx @capacitor/assets generate
```

## Manuelle native Konfiguration (nach `cap add`)

`npx cap add` erzeugt die nativen Projekte mit Standardwerten. Folgende Einträge müssen danach manuell ergänzt werden (die zugehörigen Capacitor-Plugins für Kamera/Biometrie werden separat als Dependency in `apps/web` gepflegt, hier geht es nur um die nativen Permission-Strings):

**iOS — `ios/App/App/Info.plist`**

```xml
<key>NSCameraUsageDescription</key>
<string>Financer benötigt Kamerazugriff, um Belege zu fotografieren.</string>
<key>NSFaceIDUsageDescription</key>
<string>Financer nutzt Face ID, um dein Konto schnell und sicher zu entsperren.</string>
```

**Android — `android/app/src/main/AndroidManifest.xml`**

```xml
<uses-permission android:name="android.permission.CAMERA" />
```

(Biometrie unter Android läuft über die `BiometricPrompt`-API des jeweiligen Plugins, benötigt in der Regel keinen zusätzlichen Manifest-Eintrag über die Plugin-eigene Konfiguration hinaus.)

## Signing

App Store und Play Store Signing (Apple Developer Account, Provisioning Profiles, Android Keystore) ist Aufgabe des Nutzers/Betreibers und nicht Teil dieses Scaffolds.
