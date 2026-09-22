# Jutalomoldalak Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-compose the workout-close ceremony and the meal-log ceremony into one reward family (one warm stone, one card, one CTA language) with two weight classes, per the approved spec.

**Architecture:** Markup-and-CSS change on two existing React components plus their CSS sections in `prototype.css`. Every class that tests or `SportCeremony` rely on is kept; new structure is added under new classes (`.cer-card`, `.cer-tally`, `.cer-verdict`, `.cer-recap-chip`, `.fcx-sheet`, `.fcx-ring`, …). Motion stays one frame-driven rAF pass per ceremony; the pass now also toggles beat classes (`is-b1/2/3`).

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library, plain CSS in `frontend/src/styles/prototype.css`.

**Spec:** `docs/superpowers/specs/2026-09-22-jutalomoldalak-design.md` · **Bead:** `mezo-p2777`

## Global Constraints

- All copy strings, verdict ladders, triggers and computations are frozen (spec §Unchanged).
- No visible star numeral on the workout ceremony (D3). Meal score `x,y` stays.
- Stone literal (both sections, verbatim): `radial-gradient(85% 160% at 36% 30%, #FFE9A8 0%, #E0AC2F 55%, #A9770F 100%)`.
- Fills/entries are frame-driven; no CSS transition/animation may be the only way a value or the meal sheet reaches its final state.
- Reduced motion (and workout `settled`) → final state on the first render, no rAF.
- No emojis, no `backdrop-filter`, no `drop-shadow`, no bare `var(--amber|sage|…)` in the fuel section, no `filter: grayscale`.
- Run frontend tests with `CI=true` in both modes: `VITE_USE_MOCK=true` and `VITE_USE_MOCK=false`.

---

### Task 1: Workout ceremony — step one re-composed

**Files:**
- Modify: `frontend/src/features/train/components/WorkoutCeremony.tsx`
- Modify: `frontend/src/styles/prototype.css` (section `── train ceremony (` … `── /train ceremony `)
- Test: `frontend/src/features/train/components/WorkoutCeremony.test.tsx`, `frontend/src/shared/ui/mozaik/prototypeCssStructure.test.ts`

**Interfaces:** Props unchanged. New DOM: `.cer-screen.is-staged` root (ref) → `.cer` stage (eyebrow, sky, `.cer-stars` arc, `.cer-bar` fuse) → `.cer-result` [h1 sr-only, `p.cer-verdict`, `.cer-card` [`.cer-record`?, `.cer-stats`?, `.cer-tally` with `[data-cer-count]`], `p.cer-recap-note`?] → `.cer-foot`. Timing constants `STARS_MS=1700`, `BEATS={b1:1750,b2:2050,b3:2350}`, `DURATION_MS=2700`.

- [ ] **Step 1: Update tests first**
  - pass test: halfway frame `850` (not 1200) → `--p ≈ 0.7`; add `frames.shift()?.(2100)` asserting `.cer-screen` has `is-b1` and `is-b2`, not `is-b3`/`is-told`; final frame `2700`.
  - new test: `step one writes no star numeral — the stars are the reward` → `expect(screen.queryByText(/\/\s*5/)).toBeNull()` and no element with text matching `/^4(,5)?$/` inside `.cer`.
  - new test: `the tally, the stats and the record live in ONE card` → with minutes/xp/records, `.cer-card` contains `.cer-record`, `.cer-stats`, `[data-cer-count="sets"]`.
  - CSS test (`train ceremony` describe): stone regex → `/\.cer-fill \{[^}]*#FFE9A8 0%, #E0AC2F 55%, #A9770F 100%/`; class list adds `.cer-card`, `.cer-tally`, `.cer-verdict`, `.cer-recap-chip`.
- [ ] **Step 2: Run** `cd frontend && CI=true VITE_USE_MOCK=true pnpm vitest run src/features/train/components/WorkoutCeremony.test.tsx src/shared/ui/mozaik/prototypeCssStructure.test.ts` → the new/changed tests FAIL.
- [ ] **Step 3: Implement** the component pass and markup:

```tsx
const DURATION_MS = 2700
const STARS_MS = 1700
const BEATS = { b1: 1750, b2: 2050, b3: 2350 } as const
const ease = (t: number) => 1 - (1 - t) ** 3
// in the pass effect:
const root = rootRef.current, stage = stageRef.current
const paint = (ms: number) => {
  const starP = ease(Math.min(1, ms / STARS_MS))
  const tallyP = ease(Math.max(0, Math.min(1, (ms - BEATS.b2) / (DURATION_MS - BEATS.b2))))
  const progressed = starP * score.ratio
  stage.style.setProperty('--p', String(progressed))
  // counters (now in the card) via root.querySelectorAll('[data-cer-count]') with tallyP
  // stars via stage.querySelectorAll('[data-cer-star]') with starClass(i, progressed)
  root.classList.toggle('is-b1', ms >= BEATS.b1)
  root.classList.toggle('is-b2', ms >= BEATS.b2)
  root.classList.toggle('is-b3', ms >= BEATS.b3)
}
const frame = (now: number) => {
  const ms = Math.max(0, Math.min(DURATION_MS, now - started))
  paint(ms)
  if (ms < DURATION_MS && stage.isConnected) requestAnimationFrame(frame)
  else setTold(true)
}
```

  Root className: `cer-screen is-staged${told ? ' is-b1 is-b2 is-b3 is-told' : ''}`. Card markup:

```tsx
<section className="cer-result">
  <h1 className="sr-only" tabIndex={-1} ref={headingRef}>{huStars(score.stars)} csillag az ötből</h1>
  <p className="cer-verdict">{verdictFor(score.stars)}</p>
  <div className="cer-card">
    {records.length > 0 && (<div className="cer-record">…unchanged content…</div>)}
    {minutes != null || xpGained != null ? (
      <div className="cer-stats">
        {minutes != null && (<span><ClayIcon name="i-idozito" size={30} className="icon" /><strong>{minutes}<i>′</i></strong><small>a pulton töltött idő</small></span>)}
        {xpGained != null && (<span><ClayIcon name="i-kristaly" size={30} className="icon" /><strong>+{huNumber(xpGained)}</strong><small>szerzett XP</small></span>)}
      </div>) : null}
    <div className="cer-tally">
      <span><ClayIcon name="i-suly" size={20} className="icon" /><b data-cer-count="sets">…</b><small>szett</small></span>
      <span><ClayIcon name="i-edzes" size={20} className="icon" /><b data-cer-count="reps">…</b><small>ismétlés</small></span>
      <span><ClayIcon name="i-stack" size={20} className="icon" /><b data-cer-count="volume">…</b><small>kg × rep</small></span>
    </div>
  </div>
  {pendingSets > 0 && <p className="cer-recap-note">{pendingSets} szett kihagyott státusszal zárult.</p>}
</section>
```

  CSS (train ceremony section): arc (`.cer-stars` flex-end, height 100px; `i:nth-child(1|5)` 46px lift 20px, `(2|4)` 56px lift 7px, `(3)` 68px; `.icon` 100%, unlit opacity .22), fuse (`.cer-bar` 250×8, `u` = 2px `var(--canvas)` gaps, `.cer-fill` stone + `inset 0 1px 0 rgba(255, 255, 255, 0.6)`), `.cer-screen.is-staged` layout (stage at top, `.cer-result` visible, staged children hidden until `is-b1/b2/b3`, foot until `is-told`), `.cer-verdict` 26px/700, `.cer-card` (`--surface-1`, radius 24, `--mz-shadow`), `.cer-card .cer-record` (`--mz-wash-gold` + `--mz-shadow-dec`), `.cer-card .cer-stats` (2-col pair, 30px/200 numerals, divider), `.cer-tally` (quiet row, 16px/300), reduced-motion branch.
- [ ] **Step 4: Run** the Step 2 command → all PASS; also run `SportCeremony.test.tsx` → PASS.
- [ ] **Step 5: Commit** `feat(train): workout ceremony step one — star arc, stone fuse, one card (mezo-p2777)`.

### Task 2: Workout ceremony — step two re-ordered with MuscleMap crops

**Files:** same component, CSS section and test file as Task 1.

- [ ] **Step 1: Tests** — new: `step two opens on a recap chip, then the kcal hero, then the muscle card` (DOM order: `.cer-recap-chip` before `.cer-kcal` before `.cer-muscles`; chip text contains the verdict; chip has 5 `.cer-starrow.mini i`); new: `each muscle row carries its MuscleMap crop` (`.cer-mstar-art` present per row, with `--ex-color` on the row). Existing row/kcal/note/CTA tests stay green.
- [ ] **Step 2: Run** the test file → new tests FAIL.
- [ ] **Step 3: Implement** — details order: sr-only h2 · `<div className="cer-recap-chip"><span className="cer-starrow mini" aria-hidden="true">{5× starClass(s, score.ratio)}</span><span>{verdictFor(score.stars)}</span></div>` · kcal button (unchanged content) · muscles section (unchanged content; `MuscleChip size={40}`) · note · CTAs · footnote. CSS: `.cer-recap-chip` gold cell pill; `.cer-mstars` becomes one card (`--surface-1`, `--mz-shadow`, radius 22, rows transparent with `border-top: 1px solid var(--divider)` between); `.cer-mstar` grid `44px 1fr auto`; `.cer-mstar-art` 44px tile `color-mix(in srgb, var(--ex-color) 12%, var(--surface-1))`, radius 14; track spans columns 2/-1.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(train): ceremony details — recap chip, kcal hero first, MuscleMap rows in one card (mezo-p2777)`.

### Task 3: Meal ceremony — the small moment on a sheet, with fat

**Files:**
- Modify: `frontend/src/features/fuel/components/FuelMealCeremony.tsx`, `frontend/src/features/fuel/MealCeremonyProvider.tsx`, `frontend/src/features/fuel/components/MealComposer.tsx` (`celebrate`: add `f?: number` to the param type and `fatG: meal.f ?? 0`)
- Modify: `frontend/src/styles/prototype.css` (section `── fuel-ceremony (` … `── /fuel-ceremony `)
- Test: `FuelMealCeremony.test.tsx`, `MealCeremonyProvider.test.tsx`, `prototypeCssStructure.test.ts`

**Interfaces:** `FuelMealCeremonyProps.fatG: number`; `MealCelebration.fatG: number`. DOM: `.fcx-screen[role=dialog]` (ref, `--rise`, `is-b1/b2/is-told`) → `.fcx-scrim` (div, aria-hidden, click = onClose) + `section.fcx-sheet` (`--p`, `--score`) → `.fcx-sky`, `.fcx-grab`, `.fcx` head [left: `.fcx-eyebrow`, `p.fcx-meal`, `span.fcx-when`, `.fcx-stars` 5× `[data-fcx-star]`; right: `.fcx-score` medal: `svg.fcx-ring` + `strong[data-fcx-score]` + `small` `Mezo értékelése`] → `.fcx-result` [h1 sr-only, `p.fcx-verdict`] → `.fcx-counters` 4 cells `[data-fcx-count=kcal|p|c|f]` → `.fcx-foot` [`button.fcx-close` `Vissza a naphoz`, `button.fcx-cta` `Részletek` (if onDetails)]. Timing: `DURATION_MS=1000`, `RISE_MS=300`, ignition `200..950`, `b1` at 550, `b2` at 850.

- [ ] **Step 1: Tests** — update label assertions to `getByText('Túrós zabkása · áfonyával')` + `getByText('07:15')` (provider test: `'Túrós zabkása'` + `'07:15'`); add `fatG={21}` to setups and `MEAL`; new: fat cell reads `21` with label `g zsír`; new: scrim click calls `onClose`; new: pass test (rAF mocked: first frame at 0 → `--rise` `1`, `.fcx-screen` not told; frame 1000 → counters final, 5 lit, `is-told`, `[data-fcx-score]` `8,3`); provider: `fatG` passes through (`[data-fcx-count="f"]` = 21). CSS test (fuel describe): class list → `.fcx-screen, .fcx-scrim, .fcx-sheet, .fcx-sky, .fcx-stars, .fcx-ring, .fcx-score, .fcx-counters, .fcx-result, .fcx-cta, .fcx-close`; stone test → the new stone literal present + `.fcx-sheet` transform formula `translateY(calc(var(--rise, 0) * 105%))` and no `transition` on `.fcx-sheet`.
- [ ] **Step 2: Run** `CI=true VITE_USE_MOCK=true pnpm vitest run src/features/fuel src/shared/ui/mozaik/prototypeCssStructure.test.ts` → FAIL.
- [ ] **Step 3: Implement** the component (full code in the commit; pass):

```tsx
const frame = (now: number) => {
  const ms = Math.max(0, Math.min(DURATION_MS, now - started))
  const rise = 1 - ease(Math.min(1, ms / RISE_MS))
  const p = ease(Math.max(0, Math.min(1, (ms - 200) / 750)))
  root.style.setProperty('--rise', String(rise))
  sheet.style.setProperty('--p', String(p))
  // counters: huNumber(value * p); score: huScore(scoreOutOfTen * p); stars: is-lit when p * stars >= i + 1 - .001
  root.classList.toggle('is-b1', ms >= 550)
  root.classList.toggle('is-b2', ms >= 850)
  if (ms < DURATION_MS && root.isConnected) requestAnimationFrame(frame)
  else setTold(true)
}
```

  Ring: `<circle className="fcx-ring-fill" r="40" cx="46" cy="46" pathLength={100} stroke={`url(#${gradId})`} />` with `stroke-dasharray: 100; stroke-dashoffset: calc(100 - var(--p, 0) * var(--score, 0) * 100)` and a `<radialGradient>` of the stone stops (`useId`). CSS section rewritten: scrim `rgba(43, 33, 24, 0.34)` × `calc(1 - var(--rise))`, sheet radius `30px 30px 0 0`, ground + halo, medal 92px disc `--surface-1` + `--mz-shadow-dec`, 4-col macro card with kcal in `--mz-cell-sage-ink`, actions grid `1fr 1.25fr`, `.fcx-cta` = house CTA (`--gradient-cta`, `--shadow-cta`, white ink), `.fcx-close` = house secondary; staged `.fcx-result`/`.fcx-counters` (b1) and `.fcx-foot` (b2); reduced-motion branch.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(fuel): meal ceremony as a one-second sheet, with fat (mezo-p2777)`.

### Task 4: Docs, gates, live check, merge

- [ ] Update `docs/design_2.0/2026-09-15-ceremony-pattern.md` (weight classes, D3, the warm stone replaces the 4-stop linear), style bible Appendix C.3 addendum, `docs/features/train.md` + `docs/features/fuel.md` ceremony paragraphs (point at the spec).
- [ ] Gates: `cd frontend && CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test && pnpm build` (+ `pnpm lint` if present).
- [ ] Live: mock-mode dev server → log a meal (ceremony sheet), log a sport session (shared arc/stone); screenshots light + dark.
- [ ] `git pull --rebase` main → local `--no-ff` merge via detached HEAD → push → `bd close mezo-p2777` → beads backup refresh → push.
