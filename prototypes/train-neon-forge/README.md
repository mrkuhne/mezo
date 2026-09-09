# Neon Forge · Train design prototype

Driving issue: mezo-i18d. [Approved design](../../docs/superpowers/specs/2026-09-09-train-neon-forge-design.md).

A standalone, Hungarian, interactive mock prototype. It never calls the Mezo API.
No installation or build is required. Start from the repository root:

```sh
python3 -m http.server 5187 --bind 127.0.0.1 --directory prototypes/train-neon-forge
```

Open <http://127.0.0.1:5187> for the phone frame. The app scrolls independently
inside it; <http://127.0.0.1:5187/app.html> opens the app without the frame.
Stop the server with Ctrl+C.

## App structure

The Train hub follows the existing Mezo navigation: **Heti, Mezociklus, Sport,
Futás, Gyakorlatok, Medálok**, plus the daily view. The bottom bar preserves
**Nap · Edzés · Fuel · Mezo · Én**. Non-Train tabs are explicit context previews.

Sport logs Röplabda/Cross/TRX with duration, RPE, sets or rounds, optional notes
and volleyball shoulder load. The weekly plan accepts additional slots. Running
logs prescribed sprint/pyramid sessions with completed rounds, RPE and HR recovery;
future sessions are disabled. Logging updates the daily view and demo rewards.
The mesocycle view includes weeks, exercise days, muscle loads and activation of a
named Upper/Lower sample block. The catalog supports search and muscle filters.
Medals reflect activity completion. The own-workout shortcut uses the same sample
workout; this prototype is not exhaustive production feature parity.

See [the app-alignment design](../../docs/superpowers/specs/2026-09-09-train-neon-forge-app-alignment.md)
for the user-requested change from the original standalone game dashboard.

## Try the complete flow

Select **Indítsuk az edzést**, adjust weight/repetitions/RIR, and select **Sorozat kész**.
The rest timer lasts 90 seconds; **Pihenő kihagyása** speeds up the demo. Three
sets per exercise automatically advance through three exercises. **Edzés lezárása**
opens the recap, and **Lássuk a jutalmam!** claims the chest once. Returning to
the overview shows the updated level, streak, weekly totals and quests.

You can also finish early after any logged set, inspect the skill tree, and buy
the Aurora cosmetic for 250 mock coins. The sound button opts into synthesized
reward chimes. **Demo újraindítása**, or a page refresh, resets all mock progress.

## Files and verification

- `state.mjs`: pure state transitions, validation and reward accounting.
- `train-state.mjs`: sport/running logs, schedule slots and active mesocycle.
- `train-ui.mjs`: the app-aligned Train hub, six destinations, daily view and forms.
- `train.css`: the app navigation and functional Train surfaces.
- `index.html` / `app.html`: device frame / actual iframe app entry.
- `state.test.mjs`: Node tests for exact totals, one-time claims, partial workouts,
  invalid input and purchases. Together with `train-state.test.mjs`, run all 7 tests:
  `node --test prototypes/train-neon-forge/*.test.mjs`.
- `art.mjs`: hand-authored SVG kettlebell, crystal, chest, medal and icon library.
- `app.mjs`: the three views, modal interactions, rest timer and reward choreography.
- `style.css`: responsive layout, pattern system, motion and reduced-motion mode.

Fonts load from Google Fonts with local sans-serif fallbacks. All illustration,
motion and application code is served locally. Reward values, skills, history,
date and character are intentionally illustrative; they are not production rules.
The 24 crystals are a decorative sample balance; the shop spends Forge coins.
