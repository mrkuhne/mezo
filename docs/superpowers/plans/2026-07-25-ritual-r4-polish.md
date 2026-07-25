---
title: Ritual R4 — polish plan (visual goldens, reduced-motion audit, live verify)
type: plan
status: in-progress
bd: mezo-mzbz
epic: mezo-vrq3
base: 70e7e606
created: 2026-07-25
---

# Ritual R4 — Polish & docs (mezo-mzbz)

Last slice of the Napzárás epic (`mezo-vrq3`). R1/R2/R3 shipped; the ritual is functionally
live end-to-end. R4 = visual Playwright goldens for `/ritual`, a formal reduced-motion audit
of the `rz-*`/`.ritcard`/`.np-anim` families, and the still-pending **live-stack** verification
of the `mezo-ywz1` real-mode close→habit→harvest ordering fix. Spec §9/§10.

## Global Constraints

- **Determinism is law for visual goldens.** Every lever from `frontend/tests/visual/visual.spec.ts`
  must hold or the shots flake: clock frozen to `2026-05-21T13:42:00` via `page.clock.setFixedTime`
  BEFORE `goto`; theme set via `localStorage['mezo-theme']` in an init script BEFORE `goto`;
  `contextOptions: { reducedMotion: 'reduce' }` (already in the config); `timezoneId: 'Europe/Budapest'`
  (already in the config); wait for `document.fonts.ready` before every screenshot; `maxDiffPixels: 120`.
- **Golden naming:** `<name>-<theme>-<os>.png` under `frontend/tests/visual/visual.spec.ts-snapshots/`.
  New shots use the prefixes `ritual-arrival` and `ritual-harvest` → 8 new goldens total
  (2 shots × 2 themes × {darwin, linux}). darwin generated locally; linux via the CI workflow.
- **No production code changes for tests.** Do NOT add a `?act=` deep-link or any RitualPage/CSS
  change purely to make a golden reachable — drive the Harvest act by clicking through the flow
  (each act mounts exactly one `.rz-cta` advance button; only one act is mounted at a time).
- **House FE gate stays green in BOTH modes:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
  New unit tests (the guard test) must pass in both ambient modes.
- **Living docs:** touch `docs/features/ritual.md` in the same change; run `node scripts/lint-docs.mjs`
  and clear any branch-induced staleness on `ritual.md` (pre-existing main-drift on other docs is out of scope).
- ADR 0010 tone and the frontend conventions (`docs/references/frontend_conventions.md`) apply.

## Task 1: Reduced-motion audit + guard test + `/ritual` visual goldens (FE)

**Scope:** one FE change adding two Playwright goldens for `/ritual`, a formal reduced-motion
audit of the ritual animation families with a durable guard test, and the matching `ritual.md`
doc update. This is the **only dispatched implementation task**; the live-stack verification and
linux-golden generation are controller-driven (Task 2).

### 1a. Visual goldens — `frontend/tests/visual/visual.spec.ts`

Add TWO new screens to the existing self-baselined harness, one describe-block per theme just
like the current `SCREENS` loop (or extend it — controller's choice of structure, keep it in the
same file and style):

- **`ritual-arrival`** — `page.goto('/ritual')` lands on act 1 (Megérkezés). Apply the standard
  determinism levers (frozen clock + theme init script BEFORE goto, `waitForLoadState('networkidle')`,
  `await page.evaluate(() => document.fonts.ready)`), then `toHaveScreenshot('ritual-arrival-<theme>.png')`.
- **`ritual-harvest`** — `page.goto('/ritual')`, then click through to act 4 (Termés). Each advance
  is the single mounted `button.rz-cta`:
  1. act 1 → 2: click the „Kezdjük 🌙" CTA
  2. act 2 → 3: click „Tovább"
  3. act 3 → 4: click „Tovább"
  Between clicks, wait for the next act's DOM marker (read the act components to pick stable
  selectors — e.g. act 4 renders `.rz-harvest` with `.rz-xp-num`). After landing on act 4, wait
  for `.rz-harvest` + the XP number to be present + `document.fonts.ready`, then
  `toHaveScreenshot('ritual-harvest-<theme>.png')`.
  - `getByRole('button', { name: '…' })` resolves uniquely per act (only one act mounts at a time).
  - The Harvest display is deterministic under mock mode + reduced motion: `useGamificationDay(date)`
    is a fixed day seed (12/alive, fixed `xpBySource`/`coinEvents`), `CountUp` renders its final value
    immediately under reduced motion, and confetti is `display:none` under the reduced-motion guard.
    The mock `close()` that fires on entering act 4 patches only the account `['gamification']` cache,
    not `['gamificationDay', date]`, so it does not perturb the Harvest numbers.

Generate the darwin goldens locally and commit them: `cd frontend && pnpm test:visual:update`
(the config auto-starts the Vite mock dev server on port 4318; do NOT `playwright install` new
browsers — use the cached Chromium). Confirm a clean re-run: `pnpm test:visual` passes with the
4 new darwin goldens (`ritual-arrival-{light,dark}-darwin.png`, `ritual-harvest-{light,dark}-darwin.png`).
Commit the spec change + the 4 darwin PNGs. **Linux goldens are NOT generated here** — Task 2
triggers the CI workflow for those.

### 1b. Reduced-motion audit (formal) + guard test

**Formal audit.** Enumerate every animation on a ritual-surface selector and confirm each is
neutralized (or does not run) under `@media (prefers-reduced-motion: reduce)`. Cover the three
families: `.rz-*` (the full-screen flow, `prototype.css` tail), `.ritcard*` (Today entry card),
and the ritual's use of the shared `.np-anim` class. Produce the enumeration as a table in your
report (selector → animation/keyframe → guard mechanism → verdict). The known guard mechanisms
(verify each against `prototype.css`, do not assume):
- the `@media (prefers-reduced-motion: reduce)` block at the `rz-*` tail (currently ~line 2119)
  sets `animation: none` (and freezes one-shot reveals to their end state) for the rz-* selectors;
- `.np-anim` is globally neutralized under reduce (`animation: none; opacity: 1`, ~line 1190);
- `.ritcard-moon` breathing is declared under `@media (prefers-reduced-motion: no-preference)`
  (opt-in motion — it simply does not run under reduce);
- `.rz-conf i` (confetti) is neutralized by its parent `.rz-conf { display: none }` under reduce
  (ancestor neutralization — call this out explicitly).
If the audit finds ANY ritual animation that plays under reduce (a real a11y gap), fix it by
extending the existing reduce block (do not invent a new pattern) and note it.

**Guard test** (durable regression net — encode the audit as an executable check). Add a vitest
unit test (runs in the normal `pnpm test` gate, both modes) that parses `frontend/src/styles/prototype.css`
and asserts: for every selector in the ritual families (`.rz-`, `.ritcard`, and the `.np-anim`
class) that declares a non-`none` `animation`/`animation-name`, EITHER
(a) the same selector is set to `animation: none` inside a `prefers-reduced-motion: reduce` block, OR
(b) its animation is declared inside a `prefers-reduced-motion: no-preference` block, OR
(c) it is in an explicit, commented allowlist of ancestor-neutralized selectors (e.g. `.rz-conf i`,
neutralized by `.rz-conf { display: none }`).
Keep the parser scoped to the ritual families (avoid false positives on unrelated `np-*` usage).
Give clear failure messages ("selector X declares animation Y but has no reduced-motion guard").
Place it near the ritual FE code, colocated (e.g. `frontend/src/features/ritual/reducedMotionGuard.test.ts`).

**CountUp path.** Verify (do not just assume) that `frontend/src/shared/ui/CountUp.test.tsx`
already asserts the reduced-motion / jsdom synchronous-value path (renders `to` immediately, no rAF).
If there is a genuine gap in that assertion, add it; otherwise state in your report that it is covered.

### 1c. Docs — `docs/features/ritual.md`

- §9 "Deferred to R4" bullet: replace the reduced-motion clause with the audit conclusion (every
  `rz-*`/`.ritcard`/`.np-anim` animation neutralized under `prefers-reduced-motion: reduce`,
  enforced by the new guard test; note the `.rz-conf` ancestor-neutralization and the `.ritcard-moon`
  no-preference opt-in). Update the visual-goldens clause to "shipped" (Arrival + Harvest, both themes,
  darwin+linux) rather than "deferred".
- §8 Testing: add the two `/ritual` visual goldens and the reduced-motion guard test to the test map.
- Do NOT touch the live-stack `mezo-ywz1` "pending" caveats (§3/§5/§9) — Task 2 flips those after the
  live run. Leave them as-is.
- Run `node scripts/lint-docs.mjs`; `ritual.md` must be clean. Pre-existing main-drift flags on other
  docs (e.g. train/fuel) are out of scope — report them, do not fix them.

**Gate for Task 1:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (both green),
`pnpm test:visual` (darwin goldens pass), `node scripts/lint-docs.mjs` (ritual.md clean). Commit everything.

## Task 2 (controller-driven — not a dispatched subagent)

1. **Linux goldens:** push the branch, open the self-PR, then `gh workflow run update-visual-baselines.yml -r chore/ritual-r4-polish`.
   The bot commits `*-linux.png` and pushes; because the bot push uses `GITHUB_TOKEN` it will NOT
   retrigger PR CI — push an empty commit to retrigger the authoritative `ci.yml` (incl. `test-visual`).
2. **Live-stack verification of `mezo-ywz1`** (real Postgres, real backend, FE real mode): start the
   stack (`cd backend && docker compose up -d` + `./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata`;
   frontend real mode on :5180), then drive a browser (verify skill / chrome-devtools MCP) to confirm,
   after closing the Napzárás: (a) the ritual's own +10 XP appears in the Termés (Harvest), and
   (b) returning to `/today` does NOT flash a second `LevelUpScreen` overlay. On success, flip
   `ritual.md` §3/§5/§9 caveats from "live-stack verification pending" to "verified live".
3. **Ship:** CI green → `git pull --rebase` main → `--no-ff` merge → push → `bd close mezo-mzbz` →
   delete branch → `bd dolt push`. Epic `mezo-vrq3` → 4/4 complete.
