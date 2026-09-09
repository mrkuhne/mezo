# Guided-day prototype variant — design (mezo-tiy8)

2026-09-09 · Driver: Daniel's decision after reviewing PR #595 (UX research) and PR #610
(Boop core journeys). Status: **approved direction, first visual iteration** — a clickable
study to react to, not a production redesign.

## Decision summary (from the user)

- Replace the current UX/UI entirely in the prototype; **keep** the design 2.0 color world
  and the clay 3D icons.
- From Boop keep ONLY: the dynamic bottom navigation (fixed orb + morphing per-space tab
  row) and the centred animated SVG companion. The Boop editorial visual style and its
  thin-line icon family are explicitly rejected.
- Companion **leads at key moments** (morning greeting, workout completion), never gates
  quick logging.
- The five areas stay: Nap, Edzés, Fuel, Mezo, Én.
- First round: key scenes only — morning Day briefing, workout start→run→complete, meal
  logging, weekly review. Everything else comes after visual approval.

## Prior art

Researcher findings (full report in session; sources listed):

- **iOS 26 tab bars** (donnywals.com): stable top-level tabs + a contextual "accessory
  shelf" docked above the bar → adopted as the **active-workout shelf** that persists
  across space switches. Wholesale tab swaps rejected.
- **Smashing Magazine mobile-nav golden rules**: never remove/reshuffle tabs, never mix
  actions into the nav bar → adopted as guardrail: orb + 5 spaces are invariant anchors;
  only the per-space tab row morphs; actions live on the page or in sheets.
- **WHOOP home redesign** (whoop.com): computed "today's directive" at top, quick actions
  never gated → adopted as the Nap page's opening block.
- **Finch** (IXD@Pratt critique): companion as reward surface and narrator, one-tap task
  completion → adopted for greeting + celebration moments; companion economy/clutter
  rejected.
- **Fabulous** (design.google): time-of-day ritual spine (morning/day/evening chapters)
  → adopted as the Nap page rhythm ("hol tartok → mi fontos most → mit tehetek → mi
  változott"); heavy ceremony rejected (everything skippable).

## Codebase terrain

Investigator findings (key anchors):

- Lab: `docs/design_3.0/prototypes/` — standalone React 19 + Vite (port 5193,
  `--strictPort`), variant switch on `?v=` in `src/main.jsx`; node:test for `*.test.mjs`
  (no JSX in tests); `?width=360` frame is the acceptance gate (no horizontal overflow).
- Reference shell: `src/PresenceStudy.jsx` — localStorage owned by the shell, hash routing
  `#<variant>/<space>/<tab>?panel=…`, history-depth counter for dialog back behaviour,
  native `<dialog>` with focus return, `key={space}`-remounted dock tab row for the morph
  transition.
- State pattern: pure reducer module (`presence-model.mjs`) `(state, args) => state`,
  components never touch storage.
- Companion: `shared.jsx` `Avatar` wraps `@bible-strong/avatar-react` with states
  idle/listening/thinking/happy/sleeping; clay gradient via CSS vars — defaults are
  already the design 2.0 coral ramp.
- Clay sprites: `frontend/src/shared/ui/clay/clay-icons.svg` + `clay-spots.svg` are the
  source of truth (~50 icons, 24 spots, `viewBox 0 0 100 100`); production injects them
  once and renders `<use href="#i-…">`. Copied verbatim into the lab (lab imports nothing
  from `frontend/`).
- Palette: `frontend/src/styles/prototype.css` DS ramps — paper `#FBF6EF`, ink `#2B2118`,
  coral `#FF6B4A`, domain colors sage/lav/rose/sky/amber. Hexes are copied into the
  variant CSS (the lab has no access to production CSS).
- Trap honoured: Boop deliberately dropped clay icons for thin-line ones — this variant
  reverses that by explicit user decision.
- Trap honoured: own localStorage key (`mezo-guided-v1`), own route prefix (`#guided/…`),
  no touching `COMPLETE_ROUTES`.

## What gets built

New variant `?v=guided` in the lab. Files (all new, plus one `main.jsx` route branch):

- `src/guided-model.mjs` — SPACES map (5 spaces, design 2.0 domain colors, clay icon ids,
  per-space tabs) + `createGuided()` seed + pure reducers: `selectSpace`, `selectTab`,
  `greet`, `addWater`, `logMeal`, `startWorkout`, `toggleSet`, `finishWorkout`,
  `dismissCelebration`, `foodBudget`.
- `src/guided-model.test.mjs` — node:test coverage of the reducers.
- `src/GuidedStudy.jsx` — shell (storage, hash routing, history, dialogs, dock, shelf)
  + the scene pages.
- `src/guided.css` — scoped under `.guided-study`, `gd-` class prefix, design 2.0 tokens.
- `src/clay-icons.svg` + `src/clay-spots.svg` — verbatim copies of the production sprites
  (`?raw`-imported, injected once).

Scenes:

1. **Nap · Ma** — companion morning greeting (dismissable hero, avatar `listening`),
   WHOOP-style directive ("ma ez a fontos"), then the four-beat rhythm: state strip
   (sleep/weight), what matters now (session at 17:30 + remaining kcal), quick actions
   (víz +250 ml, étkezés, edzés), what changed (insight card).
2. **Edzés** — session card → start → active workout (sets with done-toggles, rest hint)
   → finish → companion celebration (avatar `happy`, `s-medal` spot). While active, a
   **shelf** above the dock shows the running session on every page.
3. **Fuel** — remaining-budget hero (ring), meal list (clay meal icons), add-meal sheet
   (few one-tap options), budget follows the log.
4. **Nap · Hét** — weekly review: narrative summary, sparkline, three stat tiles.
5. Mezo · Minták and Én · Ma get one honest lightweight page each (insight detail;
   sleep/weight quick view) so no dock destination is dead.

Non-goals (this round): chat, the other ~100 routes, production code, dark theme,
route registry integration (`verify-routes.mjs` covers `COMPLETE_ROUTES` only and stays
untouched/green).

## Acceptance

- `npm test` green (model tests), Vite build passes.
- All four scenes clickable end-to-end at 360 px width with no horizontal overflow,
  44 px touch targets, 16 px inputs, no emoji icons, no dead buttons.
- Dock: orb + tab row morph on space switch; back button restores previous state.
- Screenshots of the four scenes attached for Daniel's review; iteration follows.
