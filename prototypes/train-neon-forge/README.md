# Neon Forge · Train design prototype

Driving issue: mezo-i18d. [Approved design](../../docs/superpowers/specs/2026-09-09-train-neon-forge-design.md).

A standalone, Hungarian, interactive mock prototype. It never calls the Mezo API.
No installation or build is required. Start from the repository root:

```sh
python3 -m http.server 5187 --bind 127.0.0.1 --directory prototypes/train-neon-forge
```

Open <http://127.0.0.1:5187>. Stop the server with Ctrl+C.

## Try the complete flow

Select **Induljon az edzés**, adjust weight/repetitions, and select **Sorozat kész**.
The rest timer lasts 90 seconds; **Pihenő kihagyása** speeds up the demo. Three
sets per exercise automatically advance through three exercises. **Edzés lezárása**
opens the recap, and **Lássuk a jutalmam!** claims the chest once. Returning to
the overview shows the updated level, streak, weekly totals and quests.

You can also finish early after any logged set, inspect the skill tree, and buy
the Aurora cosmetic for 250 mock coins. The sound button opts into synthesized
reward chimes. **Demo újraindítása**, or a page refresh, resets all mock progress.

## Files and verification

- `state.mjs`: pure state transitions, validation and reward accounting.
- `state.test.mjs`: Node tests for exact totals, one-time claims, partial workouts,
  invalid input and purchases. Run `node --test prototypes/train-neon-forge/state.test.mjs`.
- `art.mjs`: hand-authored SVG kettlebell, crystal, chest, medal and icon library.
- `app.mjs`: the three views, modal interactions, rest timer and reward choreography.
- `style.css`: responsive layout, pattern system, motion and reduced-motion mode.

Fonts load from Google Fonts with local sans-serif fallbacks. All illustration,
motion and application code is served locally. Reward values, skills, history,
date and character are intentionally illustrative; they are not production rules.
The 24 crystals are a decorative sample balance; the shop spends Forge coins.
