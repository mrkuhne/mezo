# Startup splash: fill + orbit — spec + plan (mezo-1dxhp)

Small change: spec and plan folded into one doc (CLAUDE.md §Frontend change workflow, scaling).
Owner approved the prototype on 2026-09-27 and asked to build straight through.

## What the owner sees

Approved prototype: [`docs/design_2.0/prototypes/indito-animacio.html`](../../design_2.0/prototypes/indito-animacio.html),
variant **D · Töltődés + keringés** (artifact `https://claude.ai/artifact/4LWPKqRbbxsdhvyngvmAqo`).

Same 3-second intro, same glass orb and „boop” wordmark. During those 3 s:

- **Fill (t = 0 → 2.7 s):** the lavender liquid rises from empty to ~70% (surface y 150 → 48 in the
  150-unit orb), sine-eased so it keeps moving and comes to rest exactly as the fade starts.
  It sloshes (damped rotation) and waves while filling; a darker back wave adds depth; seven
  bubbles rise and vanish at the surface.
- **Spawn + orbit (t = 0.1 s →):** five Titanium sprite icons — `t-sun`, `t-dumbbell`, `t-bowl`,
  `t-water`, `t-moon` — pop in one by one, 0.24 s apart (0.48 s each, slight overshoot and a
  brightness flash), in place on a flat circle (r = 108 px) around the orb, which spins one turn
  per 5.2 s. No path is drawn. Each icon glows in its own accent (`--c`).
- **Finale:** a light sheen sweeps across the glass (2.25 → 2.77 s) with a soft glow flash;
  the stage fades 2.7 → 3.0 s (unchanged).
- **Reduced motion:** nothing moves, nothing fades; the orb stands at 70% with the five icons in
  place. The 3 s timer still hands over to the app.

No new icons (all five are in the shared sprite).

## Build

- `frontend/src/app/startupChoreography.ts` — pure frame function `splashFrame(t, still)` →
  numbers (level, slosh, wave offsets, bubble positions, icon transforms/opacity/flash, sheen,
  glow). Unit-tested.
- `StartupSplash.tsx` — adds the back wave, bubbles, sheen, glow and the orbit (`Icon3D`), and
  one rAF loop (`useLayoutEffect`) that applies `splashFrame` to refs for 3 s; reduced motion
  (or no rAF) paints the still frame once. The timer/inert/aria/skip seam are untouched.
- `StartupSplash.css` — drop `startup-float` / `uv-wave` on the splash (JS drives them now);
  keep the wordmark rise and the stage fade; mark gets `margin-block: 56px` so the orbit clears
  the wordmark.

## Kész, ha…

- [ ] Splash fills to ~70% over 2.7 s, bubbles, sheen — matches prototype D (browser check).
- [ ] Five sprite icons pop in one by one from 0.1 s, orbit on a flat circle; no dashed path.
- [ ] Reduced motion: static frame (70%, icons in place), zero animations, no fade.
- [ ] Parity: 3 s then app; inert + aria-hidden wrapper; `role=status` „Boop betöltése”;
      wordmark „boop”; DEV skip seam; no replay on route change.
- [ ] 320 px width: orbit fits inside the screen.
- [ ] Gates: FE tests `CI=true` mock + `VITE_USE_MOCK=false`; `tests/layout/startup.spec.ts`;
      `pnpm build`; `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` 0/0.
- [ ] Docs: `docs/features/_platform-design-system.md` §9 startup; `docs/features/today.md`
      startup note; dated milestone entry in `docs/milestones/roadmap.md`.
- [ ] Shipped: merged to main, `deploy` green for the commit, live on the production URL.
- [ ] Prototype matches production.
