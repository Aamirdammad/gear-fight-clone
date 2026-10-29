# Gear Forge Mobile

Expo React Native prototype for Android, portrait orientation.

## Slice 1 loop

- Fixed spinner. Gears only work when a chain touches it. Powered gears spin; dead gears sit still.
- Pinned Cog in the shop plus three unit cards. Merge same type + same rank (1 to 2 to 4).
- Drag to move or merge. Tap a placed gear, then sell for a partial refund.
- Cheap units spawn fast. Costly units spawn slower and hit harder.
- Combat is walking lane units, not a hidden formula. Five waves with different jobs: rush, archers, tank+swarm, freezer slow, mixed boss.
- Android package id: `com.gearforge.prototype`.

## Run locally with Expo

```bash
cd mobile
npm install
npm start
```

`npm install` generates the placeholder PNG icons.

## Type check and combat smoke

```bash
npm run typecheck
npx --yes tsx scripts/smoke-sim.ts
```

## Build a test APK

```bash
cd mobile
npx eas-cli build --platform android --profile preview --non-interactive
```
