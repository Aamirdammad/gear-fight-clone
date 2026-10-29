# Gear Forge

Gear Forge is a small browser game prototype inspired by the game-theory loop behind Gear Fight: buy gears, connect them to a powered machine, optimize multipliers, then watch a three-lane auto battle resolve.

This project does not copy Gear Fight assets, branding, or levels. It uses the public high-level concept as a case study and turns it into a distinct playable slice.

## Case study summary: Gear Fight

Public coverage describes Gear Fight as a hybrid of gear puzzle, backpack-like optimization, and lane auto-battler.

- **Core loop:** prepare a gear board, spend a limited budget, start a wave, earn rewards, then rebuild or upgrade.
- **Main decision:** placement matters because gears must be connected and multiplier gears improve adjacent output.
- **Battle model:** after planning, combat is mostly hands-off. The payoff is seeing a good machine produce enough troops, weapons, and effects to beat the wave.
- **Engagement driver:** short plan-and-watch cycles create experimentation, near misses, and a "one more build" feeling.
- **Risk:** if battles are too slow or early gear output is weak, the experience can feel passive. This prototype keeps the session short and makes lane power visible.

## Prototype features

- 4x5 gear board with a fixed power core.
- Shop with attack, control, burst, and multiplier gears.
- Upgrade economy and reroll cost.
- Three-lane auto battle with five escalating waves.
- In-app case-study cards explaining what was borrowed from the concept.
- Responsive layout for desktop and mobile browsers.

## Mobile app

An Expo React Native Android prototype is available in `mobile/`.

- Android-focused
- Portrait orientation
- Placeholder visuals based on the supplied cartoon gear-combat references
- Five-wave gameplay loop
- EAS preview APK profile included

See `mobile/README.md` for run and APK build commands.

## Run locally

```bash
npm install
npm run dev
```

Then open the URL printed by Vite.

## Build

```bash
npm run build
```
