# Gear Forge Mobile

Expo React Native prototype for Android, portrait orientation.

## Loop

- Pick 3 gears before a run. Cog stays pinned in the shop. Clear even waves to unlock the rest of the 8-gear kit.
- Fixed spinner. Gears only work when a chain touches it. Powered gears spin; dead gears sit still.
- Merge same type + same rank (1 to 2 to 4). Drag to move or merge. Tap a placed gear, then sell.
- Cheap units spawn fast. Costly units spawn slower and hit harder. Bolt is a line shot with no bodies. Mender heals its lane.
- Later jobs lock sockets. Grab the mid-lane crate for a short overdrive.
- Ten waves with different jobs. Fail text names the mistake: empty lane, all-spell board, no tank.
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
