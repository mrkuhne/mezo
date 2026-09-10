# Nap → Mai Titanium Production Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `/nap` landing page (`NapHubPage`) into the owner-approved Titanium design: living companion presence + ONE computed next step + six stable tiles, per the frozen coverage manifest.

**Architecture:** Pure `nextStep` selector + presentational `TitanCompanion` (animated SVG, needs-tinted) feed a rebuilt `NapHubPage`; a `QuickLogSurface` extraction lets the existing quick-log grid serve both the global sheet and a new full-page `/nap/gyors` picker. All data stays behind `@/data/hooks`; zero backend changes (water undo uses the existing `DELETE /api/water-log/{id}`).

**Tech Stack:** React 18 + TypeScript, TanStack Query dual-mode hooks, vitest + @testing-library/react, mozaik/clay UI kits, `styles/prototype.css` `--mz-*` tokens.

**Driving artifacts (read before any task):**
- Spec: `docs/superpowers/specs/2026-09-10-nap-mai-titanium-design.md`
- FROZEN manifest: `docs/design_2.0/2026-09-10-nap-mai-coverage.md` (preservation-test column = required tests)
- Visual reference: `docs/design_2.0/prototypes/companion-titanium/` (`nap.html#nap/0`, `day-pages.js` `today()`/`rough()`, `personal-state.js` `nextStep()`)
- bd issue: mezo-mhum

## Global Constraints

- Frontend only. NO backend/API/contract change of any kind (contract-drift gate).
- All data access via `@/data/hooks` re-exports; every hook dual-mode (mock seed / real query).
- Honest states: nothing numeric while pending; `—` never a fabricated zero; no fake trend arrow with a single weigh-in.
- Clay/titanium SVG only — NEVER emoji, never generic icon libs.
- `prefers-reduced-motion` honored everywhere (static companion, no entrance/count animation).
- Daypart single-sourced via `useDayFace()`/`useMinuteTick()` — never a second clock.
- Tap targets ≥ 44px (`todayTapTargets.test.ts` guards).
- `data-kalauz-anchor="nap-hero"` must exist on the hero/companion block in every daypart AND anchor mode.
- All `/nap/*` subroutes + `today/*` redirects keep resolving; `/nap/kuldetesek` stays routed (tile removed — C1 DEFER).
- CSS goes into `frontend/src/styles/prototype.css` using `--mz-*` tokens; verify `pnpm build` (vitest never catches a cut `@media` brace).
- Tests run: `CI=true VITE_USE_MOCK=true pnpm test` AND `CI=true VITE_USE_MOCK=false pnpm test` (file filters after `--` do NOT scope; run the full suite at gate time, single-file via `pnpm vitest run <path>` during TDD).
- Commit subjects carry `(mezo-mhum)`.
- Regenerate CODEMAP (`node scripts/gen-codemap.mjs`) in the same change that adds/renames files.

---

### Task 1: `nextStep` selector (pure logic)

**Files:**
- Create: `frontend/src/features/today/logic/nextStep.ts`
- Test: `frontend/src/features/today/logic/nextStep.test.ts`

**Interfaces:**
- Consumes: `DayFace` from `@/features/today/logic/dayFace`, `ClayIconName` from `@/shared/ui/clay`.
- Produces (used by Task 5's page):

```ts
export interface NextStepInputs {
  face: DayFace                    // 'reggel' | 'nap' | 'este'
  ritualClosed: boolean            // useRitualDay(date).data.closed
  intentionSet: boolean            // (useIntentionDay(date).data?.creed ?? null) !== null || foci.length > 0 — see step 1 test for exact rule
  morningHabitPending: boolean     // a non-derived, pending morning-chain habit exists
  checkinStale: boolean            // no 'done' checkin slot among the day/afternoon slots
  waterMl: number
  waterTargetMl: number
  workoutPlanned: boolean          // today.workoutType != null
  workoutDone: boolean
  goalStep: string | null          // first goal's today-step title from useLifeGoalToday(), else null
}
export interface NextStep {
  title: string; sub: string; icon: ClayIconName
  kind: 'route' | 'intention'      // 'intention' → page opens IntentionSheet instead of navigating
  to: string                       // route target when kind==='route' ('' when kind==='intention')
}
export function nextStep(i: NextStepInputs): NextStep
```

Priority ladder (One Big Thing — mirror of the approved prototype `personal-state.js#nextStep`):
1. `face==='este'` → closed: `{title:'A mai nap a helyén.', sub:'Ha szeretnéd, vissza is nézheted.', icon:'i-alvas', kind:'route', to:'/ritual'}`; not closed: `{title:'Tegyük le a napot.', sub:'Amit megőriznél, és amit elengednél.', icon:'i-alvas', kind:'route', to:'/ritual'}`
2. `face==='reggel' && !intentionSet` → `{title:'Adjunk irányt a napnak.', sub:'Egy mondat elég.', icon:'i-lang', kind:'intention', to:''}`
3. `face==='reggel' && morningHabitPending` → `{title:'A reggeli ritmusod vár.', sub:'Apró lépések, a saját sorrendedben.', icon:'i-lang', kind:'route', to:'/nap/rutin?dp=reggel'}`
4. `checkinStale` → `{title:'Hogy vagy most?', sub:'Egy rövid pillanatkép, magadért.', icon:'i-checkin', kind:'route', to:'/nap/checkin'}`
5. `waterTargetMl>0 && waterMl < waterTargetMl*0.6` → `{title:'Egy pohár víz jólesne.', sub:'<X,XX> liter ma eddig.' (hu-HU formatted from waterMl), icon:'i-viz', kind:'route', to:'/fuel'}`
6. `workoutPlanned && !workoutDone` → `{title:'A mai mozgásod még előtted áll.', sub:'Együtt bele tudunk kezdeni.', icon:'i-edzes', kind:'route', to:'/train'}`
7. `goalStep !== null` → `{title:'Egy lépés a célod felé.', sub: goalStep, icon:'i-growth', kind:'route', to:'/me/goals'}` — VERIFY the goals route in `app/router.tsx` before hardcoding; use the route `LifeGoalTodayTile` links to today.
8. fallback → `{title:'Egy gondolatnyi hely.', sub:'A napló mindig nyitva áll.', icon:'i-naplo', kind:'route', to:'/me/naplo'}` — VERIFY journal route the same way (grep router.tsx for the journal page path).

Also VERIFY each `ClayIconName` literal exists in `shared/ui/clay` (grep the union); substitute the nearest existing name when one differs — never invent names.

- [ ] **Step 1: Write the failing tests** — one test per ladder rung plus ordering:

```ts
import { describe, expect, test } from 'vitest'
import { nextStep, type NextStepInputs } from './nextStep'

const base: NextStepInputs = {
  face: 'nap', ritualClosed: false, intentionSet: true, morningHabitPending: false,
  checkinStale: false, waterMl: 1600, waterTargetMl: 2000, workoutPlanned: true,
  workoutDone: true, goalStep: null,
}

describe('nextStep — egy kiemelt lépés', () => {
  test('este mindig a napzárás, lezárás után lecsendesül', () => {
    expect(nextStep({ ...base, face: 'este' }).to).toBe('/ritual')
    expect(nextStep({ ...base, face: 'este', ritualClosed: true }).title).toBe('A mai nap a helyén.')
  })
  test('reggel: előbb a szándék, aztán a reggeli rutin', () => {
    expect(nextStep({ ...base, face: 'reggel', intentionSet: false }).kind).toBe('intention')
    expect(nextStep({ ...base, face: 'reggel', morningHabitPending: true }).to).toBe('/nap/rutin?dp=reggel')
  })
  test('napközbeni létra: check-in → víz → edzés → cél → napló', () => {
    expect(nextStep({ ...base, checkinStale: true }).to).toBe('/nap/checkin')
    expect(nextStep({ ...base, waterMl: 500 }).to).toBe('/fuel')
    expect(nextStep({ ...base, workoutDone: false }).to).toBe('/train')
    expect(nextStep({ ...base, goalStep: 'Heti három edzés' }).sub).toBe('Heti három edzés')
    expect(nextStep(base).title).toBe('Egy gondolatnyi hely.')
  })
  test('a check-in megelőzi a vizet (egy dolog egyszerre)', () => {
    expect(nextStep({ ...base, checkinStale: true, waterMl: 0 }).to).toBe('/nap/checkin')
  })
})
```

- [ ] **Step 2: Run** `cd frontend && pnpm vitest run src/features/today/logic/nextStep.test.ts` — expect FAIL (module missing).
- [ ] **Step 3: Implement** `nextStep.ts` exactly per the ladder above (a chain of early returns; hu-HU litre formatting via `Intl.NumberFormat('hu-HU',{maximumFractionDigits:2})`).
- [ ] **Step 4: Run the test again** — expect PASS.
- [ ] **Step 5: Commit** `feat(today): one-big-thing nextStep selector (mezo-mhum)`

---

### Task 2: `TitanCompanion` presence component

**Files:**
- Create: `frontend/src/features/today/components/TitanCompanion.tsx`
- Modify: `frontend/src/styles/prototype.css` (append a clearly-commented `/* ── titanium companion (mezo-mhum) ── */` block)
- Test: `frontend/src/features/today/components/TitanCompanion.test.tsx`

**Interfaces:**
- Consumes: `NeedState[]` shape from `@/features/today/logic/needs` (`NEED_META[key].color` gives each need's color; band per state).
- Produces: `export function TitanCompanion({ states, onOpenSignals }: { states: NeedState[]; onOpenSignals: () => void })`

Design (from the prototype's mini-titan mark + motion study): inline SVG ~180px — three rotated titanium petals, a gold core, 2 orbital ellipse rings, one small planet dot. CSS animation: whole form slow rotation (~60s linear), rings counter-rotating slower, planet orbit; occasional local glow keyframe (like `.lf-closing-orbit>b`). Behind it a static aura `box-shadow`/radial gradient built from the FIRST THREE need colors, each at an alpha proportional to band (`green`→0.35, `yellow`→0.22, `red`/`critical`→0.12 — dimmer when the need is unmet, honest but calm). Wrapped in a `<button aria-label="Életjelek">` calling `onOpenSignals`. All animation inside `@media (prefers-reduced-motion: no-preference)`; without it the SVG is static.

- [ ] **Step 1: Failing test:**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { TitanCompanion } from './TitanCompanion'

const states = [
  { key: 'energia', band: 'green' }, { key: 'hidratacio', band: 'yellow' }, { key: 'pihenes', band: 'green' },
] as never

describe('TitanCompanion', () => {
  test('tap opens the signals surface and the button is labelled', () => {
    const open = vi.fn()
    render(<TitanCompanion states={states} onOpenSignals={open} />)
    fireEvent.click(screen.getByRole('button', { name: /életjelek/i }))
    expect(open).toHaveBeenCalledOnce()
  })
  test('aura colors come from the need meta, per band', () => {
    render(<TitanCompanion states={states} onOpenSignals={() => {}} />)
    const aura = document.querySelector('.titan-aura') as HTMLElement
    expect(aura.style.getPropertyValue('--aura-0')).not.toBe('')
  })
})
```

- [ ] **Step 2: Run it** (`pnpm vitest run src/features/today/components/TitanCompanion.test.tsx`) — FAIL.
- [ ] **Step 3: Implement** component + CSS. CSS append-only at the END of prototype.css; count braces; no nested `@media` edits mid-file.
- [ ] **Step 4: Tests pass; run `pnpm build`** (CSS brace gate).
- [ ] **Step 5: Commit** `feat(today): TitanCompanion needs-tinted presence (mezo-mhum)`

---

### Task 3: water undo in `useWaterActions`

**Files:**
- Modify: `frontend/src/data/fuel/mealApi.ts` (logWater returns the response; add `deleteWaterLog`)
- Modify: `frontend/src/data/fuel/fuelHooks.ts:119-145` (`useWaterActions`)
- Test: extend `frontend/src/data/hooks.test.tsx` OR a new `frontend/src/data/fuel/waterUndo.test.tsx` following the existing dual-mode hook test pattern in `data/` (copy the render/QueryClient harness from `hooks.test.tsx`).

**Interfaces:**
- Produces: `useWaterActions(date?)` now returns `{ logWater(amountMl), undoLastWater(): void, canUndo: boolean }`. `canUndo` is true only after a `logWater` in this mount session (mirrors the prototype: only the *own last glass* is undoable; server history is never guessed).
- Mock mode: `logWater` mutates `['fuelDay',date]` cache `consumed.water += amount` (existing); `undoLastWater` subtracts the last logged amount (floor 0) and pops it from an internal `useRef<number[]>` stack.
- Real mode: `mealApi.logWater` becomes `Promise<WaterLogResponse>` (`apiFetch<WaterLogResponse>(...)` — the generated `WaterLogResponse` type has `id`); the hook keeps a `useRef<string[]>` of returned ids; `undoLastWater` calls `mealApi.deleteWaterLog(id)` = `apiFetch('/api/water-log/'+id, { method: 'DELETE' })`, then invalidates `[FUELDAY_KEY]` and `['dailyQuests', date]` exactly like log does. VERIFY the delete path in `api/openapi.yml` (`grep -n "water-log" ../api/openapi.yml`) and use the exact declared path.
- NO other consumer changes: `QuickInputSheet`/`WaterLogSheet` keep using `logWater` (return-type change is source-compatible for `void` consumers).

- [ ] **Step 1: Failing test** — mock mode: log 250 then undo → cache water back to seed value and `canUndo` false; undo with empty stack is a no-op. Real mode (msw or fetch spy per existing pattern): undo issues DELETE with the id from the POST response.
- [ ] **Step 2: Run** the new test file — FAIL.
- [ ] **Step 3: Implement** per interface.
- [ ] **Step 4: Test passes; run the two dual-mode guard files** `pnpm vitest run src/data/dualMode.guard.test.ts src/data/hooks.reexport.test.ts`.
- [ ] **Step 5: Commit** `feat(fuel): water undo via existing delete endpoint (mezo-mhum)`

---

### Task 4: `QuickLogSurface` extraction + `/nap/gyors` full-page picker

**Files:**
- Create: `frontend/src/features/quickinput/QuickLogSurface.tsx` (the grid + phase logic moved OUT of `QuickInputSheet.tsx` verbatim — same tiles, same sublines, same `Mondd el Mezónak` row)
- Modify: `frontend/src/features/quickinput/sheets/QuickInputSheet.tsx` → thin `Sheet` wrapper around `QuickLogSurface`
- Create: `frontend/src/features/today/pages/NapGyorsPage.tsx` (full-page Titanium picker: `MozaikPage`-style heading „GYORS RÖGZÍTÉS / Mi érkezett?" + `<QuickLogSurface variant="page" onDone={() => navigate(-1)} />`)
- Modify: `frontend/src/app/router.tsx` (add `{ path: 'nap/gyors', element: <NapGyorsPage /> }` beside the other Nap subroutes)
- Modify: `frontend/src/app/QuickLogFab.tsx` — on `/nap` exactly (useLocation().pathname === '/nap') the FAB navigates to `/nap/gyors`; everywhere else it opens the sheet as today.
- Test: keep `QuickInputSheet.test.tsx` green untouched; create `frontend/src/features/today/pages/NapGyorsPage.test.tsx`.

**Interfaces:**
- Produces: `export function QuickLogSurface({ variant, onDone }: { variant: 'sheet' | 'page'; onDone: () => void })` — `onDone` replaces the sheet's `close()` in navigation callbacks. In `variant='sheet'` the existing in-place phase swaps (water/sleep/weight/checkin/sport/journal sheets) behave exactly as today; in `variant='page'` phases render the SAME sub-sheets (they are modal `Sheet`s — acceptable on top of the page).
- The sub-sheet imports move with the logic into `QuickLogSurface`.

- [ ] **Step 1: Failing test** (`NapGyorsPage.test.tsx`): renders the nine tiles (Étkezés, Víz, Stack, Edzés, Sport, Súly, Check-in, Napló, Alvás) and the `Mondd el Mezónak` row; Stack tile navigates to `/fuel/stack` (assert via a spy on `useNavigate` per the pattern used in `QuickInputSheet.test.tsx`).
- [ ] **Step 2: Run it** — FAIL. Also run `pnpm vitest run src/features/quickinput/sheets/QuickInputSheet.test.tsx` — currently PASS (baseline).
- [ ] **Step 3: Extract + implement** all four files.
- [ ] **Step 4: Both test files pass**; run `pnpm vitest run src/app` (router/fab neighbors).
- [ ] **Step 5: Commit** `feat(quickinput): QuickLogSurface + /nap/gyors full-page picker (mezo-mhum)`

---

### Task 5: NapHubPage rebuild — companion + next step + six tiles

**Files:**
- Rewrite: `frontend/src/features/today/pages/NapHubPage.tsx`
- Modify: `frontend/src/styles/prototype.css` (append `/* ── nap-mai titanium (mezo-mhum) ── */` block)
- Delete: `frontend/src/features/today/components/LifeGoalTodayTile.tsx` (+ its test file if separate)
- Modify: `frontend/src/features/today/todayScope.test.ts` — add `'LifeGoalTodayTile.tsx'` to a new `RETIRED_TITANIUM = [...]` list with a comment citing mezo-mhum + manifest row C6
- Test: rewrite `frontend/src/features/today/pages/NapHubPage.test.tsx`

**Page composition (single source of layout truth):**

```
<div className="nap-hub nap-titan">
  <EntranceGroup replayKey={face}>
    1. Companion block  [data-kalauz-anchor="nap-hero"]
       - <TitanCompanion states={needs.states} onOpenSignals={() => navigate('/nap/eletjel')} />
       - greeting <h2> by face: reggel 'Jó reggelt.' / nap 'Jó itt folytatni.' / este 'Megérkeztél.'
       - creed line (C3): when intention.creed → the creed text; tap opens IntentionSheet
         (aria-label="Kreed és fókuszok"); foci count badge „n fókusz" when foci.length>0
       - morning context row (A3/A4, face==='reggel' only): weight chip
         `Súly <b>84,2 kg ↘</b>` → navigate('/me/suly'-equivalent — the route the old hero
         used; VERIFY in router.tsx) — arrow ONLY when previousWeight exists and differs;
         focus chip with intention.foci[0].text when present
       - companion CTA row: „Beszéljük át a napod" → navigate('/nap/uzenetek')  (D6)
    2. Next-step card (.nap-nextstep, big tappable): from nextStep(inputs);
       kind==='intention' → opens IntentionSheet; else navigate(step.to)
    3. <Mosaic> six tiles in FIXED order (never varies by daypart):
       víz · alvás · étkezés · edzés · rutin · napló
    4. Evening extras (face==='este' only): napzárás CTA under the next-step is ALREADY
       the next-step itself (A6 — ladder rung 1); StatStrip (A7): kcal cell
       (label 'kcal · kereten belül ✓'/'kereten túl'), workout cell (type + '✓' when done,
       `${workoutDoneSets} szett` label, '—' when no plan), XP cell `+${xpTotal}`;
       timed night tile (C7): only when 0 < minsToBed(tick, sleepGoal.bedTime) <= 90 →
       Tile → navigate('/me/sleep/night')
  </EntranceGroup>
  {focusOpen && <IntentionSheet creed={intention.creed} onSave={addFocus} onClose={...} />}
</div>
```

**The six tiles (exact content):**
- **Víz (B1):** container `div role="button" tabIndex={0}` (aria-label "Hidratáció · részletek") → navigate('/fuel'); inner `<button className="nap-water-quick" aria-label="Víz +2,5 dl">` → `logWater(250)`; shows `consumed.water/1000` / `targets.water/1000` L + fill bar (`--w` var like today); when `canUndo` → inner `<button aria-label="Utolsó pohár visszavonása">` → `undoLastWater()`. Keyboard: Enter/Space on the container navigates.
- **Alvás (A2/B6):** `lastNight` → `fmtHm(Math.round(lastNight.duration*60))` (duration is HOURS!) + `minőség {quality}/10`; no data → big `—` + 'Még nincs naplózva'. → navigate to the sleep page route the old hero implied (VERIFY: the /me sleep route in router.tsx; the night tile uses `/me/sleep/night`, so the day surface is its parent — grep it).
- **Étkezés (A5/B4):** big `kcalLeft = round(targets.kcal - consumed.kcal)` with `useCountUp`, sub `fehérje {round(consumed.p)}/{round(targets.p)} g`; when `nowWindow` (from `useFuelPreview`, same `slotKey !== undefined && state==='now'` rule as QuickInputSheet) → eyebrow `⟨label⟩ · most` + tile navigates to the window's log route (`/fuel/log/uj?w=${tileKey(nowWindow)}`), else eyebrow 'Keret · ma' + navigate('/fuel').
- **Edzés (B3):** planned → `today.workoutType` (+' ✓' when workoutDone) → '/train'; no plan → 'Pihenő' word + honest empty sub. Keep tile rendered always (stable order!) — the old page hid it; the manifest fixes six stable tiles.
- **Rutin (B2):** MOVE the existing `habitTile`/`tileTick` logic VERBATIM (chain-aware next pick, `promptKey` „Most jön", ADR-0010 check-only tick, `buildHabitRewardToast` with celebration + `daypartMilestone`, disabled while `habitPending`) — morning face shows the MORNING chain, este the EVENING chain, day face shows whichever has a pending item (morning first), all-done → sage 'Tökéletes nap' state. → `/nap/rutin?dp=...` as today.
- **Napló (B5):** `useJournalNotes(date, date)` → `n bejegyzés ma` (0 honest); → the journal route (VERIFY in router.tsx — the /me journal page path).

**Removed from the page (manifest):** quest tile + `useDailyQuests` (C1 DEFER), check-in tile + `useCheckins` (C2 — quick picker + ladder rung 4 covers it; the page still needs checkins for `checkinStale`, so KEEP the `useCheckins` read), kreed tile (C3 → companion), életjel tile + `needRingGradient` import (C4 → TitanCompanion), stack tile + `useStackDay` (C5), `LifeGoalTodayTile` (C6 → `useLifeGoalToday` feeds `goalStep`). `useGamificationDay` stays (A7 XP cell). Meal-window extra tile gone (B4 merged into étkezés tile).

**Anchor mode (D1):** keep the `scenario.anchorMode` early return but restyle: quieted companion (TitanCompanion with a `quiet` class — reduced aura, no next-step), 'Horgony mód · csendben' eyebrow, the three ANCHORS rows with local ticks + exit — content unchanged, wrapper classes moved to the new `.nap-titan` language. Keep `data-kalauz-anchor="nap-hero"` on its hero.

**Preservation tests (rewrite `NapHubPage.test.tsx` — name each `test()` after its manifest row):** copy the existing file's render harness (QueryClient + MemoryRouter + `vi.mock` of `useMinuteTick`/clock pinning — see the current file and `todayCssTokens` conventions; the mock sleep goal pins wake 06:45/bed 23:15). Required cases:
- A1: with `?dp=reggel` and `?dp=este` the greeting changes but the six tile labels render in identical order.
- A2/B6: sleep tile shows `7:30`-style value from mock seed; with an empty sleep mock → `—`.
- A3: morning face shows weight chip with arrow only when the mock seed has ≥2 differing weigh-ins (assert arrow absent after slicing the mock to 1 entry via the hook mock).
- A5/B4: étkezés tile shows kcal-left and protein from mock fuel seed.
- A6: este face → next-step card links to `/ritual`.
- A7: este face renders the StatStrip with 3 cells; no-workout mock → `—` cell.
- B1: click the water `+` → water value increases by 0.25 L and the undo button appears; click undo → value back, undo gone.
- B2: routine tile tick fires the same `emitToast` payload builder as the Rutin page (spy `emitToast`; assert `buildHabitRewardToast` fields present) and a DERIVED habit renders without a tick button.
- B5: journal tile shows the mock day's entry count.
- C1: NO 'Küldetések' text on the page; router still resolves `/nap/kuldetesek` (assert in Task 6's router test instead if the harness is page-scoped).
- C3: creed visible on the companion block; tapping it opens the IntentionSheet (dialog appears).
- C4: companion button labelled Életjelek navigates to `/nap/eletjel`.
- C7: with clock pinned inside the wind-down window the night tile renders; pinned at 14:00 it does not.
- D1: `?day=rough` renders the anchor surface and no tile mosaic.
- D4: with `matchMedia` mocked to `prefers-reduced-motion: reduce`, entrance classes are absent (assert no `.rise` animation wrapper or the EntranceGroup pop attribute — follow how mozaik motion tests assert this; if none exists, assert the companion svg has the `titan-static` class).
- D5: `[data-kalauz-anchor="nap-hero"]` exists on default AND rough render.

- [ ] **Step 1:** Write the full new `NapHubPage.test.tsx` (all cases above) — run: most FAIL against the old page (some, like B2, already pass — fine).
- [ ] **Step 2:** Rewrite `NapHubPage.tsx` + CSS block per the composition spec.
- [ ] **Step 3:** Delete `LifeGoalTodayTile.tsx`, update `todayScope.test.ts` retirement list.
- [ ] **Step 4:** `pnpm vitest run src/features/today` — ALL green (guards: tap targets, css tokens, scope).
- [ ] **Step 5:** `pnpm build` (CSS gate). 
- [ ] **Step 6: Commit** `feat(today): Titanium Nap Mai landing — companion, next step, six tiles (mezo-mhum)`

---

### Task 6: routes, docs, CODEMAP, coverage closure

**Files:**
- Test: extend the router test that covers nap subroutes (grep `router.test` / `hubHeaders.test.tsx`): `/nap/gyors` resolves; `/nap/kuldetesek` still resolves (C1); `today/*` redirect intact.
- Modify: `docs/features/today.md` — §3 composition tree rewritten for the new page (companion block, nextStep, six tiles, /nap/gyors), remove stale visual-golden references (§8/§10 — goldens retired mezo-ryb6, layout specs live in `frontend/tests/layout/`), note quest tile DEFER (mezo tracked), water undo, TitanCompanion.
- Modify: `docs/design_2.0/2026-09-10-nap-mai-coverage.md` — fill each row's Preservation test cell with the actual test name(s) implemented in Task 5/this task.
- Run: `node scripts/gen-codemap.mjs` (new files) and `node scripts/check-beads-backup.mjs --fix`.
- Check: `frontend/tests/layout/layout.spec.ts` — if it snapshots `/nap` structure, update expectations deliberately.

- [ ] **Step 1:** Router/redirect tests (write first, run, fix).
- [ ] **Step 2:** Docs updates (today.md truth-sync; coverage test-name mapping).
- [ ] **Step 3:** CODEMAP regen + beads backup; `git add` docs + generated map.
- [ ] **Step 4:** Full local gates: `CI=true VITE_USE_MOCK=true pnpm test`, `CI=true VITE_USE_MOCK=false pnpm test`, `pnpm build`, doc lint (`node scripts/lint-docs.mjs` if present — VERIFY script name in package.json / scripts/).
- [ ] **Step 5: Commit** `docs(today): truth-sync Nap Mai Titanium + codemap (mezo-mhum)`

---

## Self-review notes

- Spec coverage: every frozen-manifest row maps to a task (A1-A7, B1-B6 → T5; C1-C7 → T5/T6; D1 → T5; D2 shell untouched — no task needed, assert nothing forked; D3 → T4; D4/D5 → T5; D6 → T5 companion CTA; D7 → T6; D8 → T5 A7/B2).
- Route strings marked VERIFY must be read from `router.tsx` by the implementer, never guessed.
- No backend task exists by design; any backend diff is a stop-the-line error.
