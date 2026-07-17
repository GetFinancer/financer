# Assets

Lege hier ab, bevor du Icons/Splash generierst:

- `icon.png` — 1024×1024, quadratisch, ohne abgerundete Ecken, ohne Transparenz
- `splash.png` — mindestens 2732×2732, Motiv zentriert (wird auf allen Geräten unterschiedlich zugeschnitten)

Danach im `apps/mobile`-Ordner:

```
npx @capacitor/assets generate
```

Das erzeugt automatisch alle benötigten iOS-/Android-Icon- und Splash-Screen-Größen in den `ios/`- und `android/`-Projekten.
