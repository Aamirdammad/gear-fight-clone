# Gear Forge Mobile

Expo React Native prototype for Android, portrait orientation.

## Current scope

- Portrait-only mobile layout inspired by the provided cartoon gear-combat references.
- Placeholder-only visuals: colored gears, simple units, sky/island background shapes, and chunky UI panels.
- 4x5 gear board with a fixed power core.
- Bottom shop with three cards, reroll, gear placement, and tap-to-upgrade.
- Five-wave combat loop with simple lane simulation.
- Android package id: `com.gearforge.prototype`.
- EAS preview profile configured to output a test APK.

## Run locally with Expo

```bash
cd mobile
npm install
npm start
```

`npm install` restores the placeholder PNG icons from `scripts/assets.json`.

Open the QR code in Expo Go on Android, or run:

```bash
npm run android
```

`npm run android` requires Android tooling/emulator support on the machine.

## Type check

```bash
npm run typecheck
```

## Build a test APK

This repository is ready for an EAS cloud APK build:

```bash
cd mobile
npx eas-cli build --platform android --profile preview
```

That command requires Expo/EAS authentication. The current cloud machine does not have Android SDK tooling, so EAS cloud build is the practical path for producing the APK from this environment.
