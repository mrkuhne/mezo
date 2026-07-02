# Fuel P5 — Mai Merged Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static mock Mai pacing timeline + Today preview with a real merged agenda: logged meals + protocol supplement slots (intake-derived done state) + today's Train gym/sport blocks, with honest generic placeholders for un-logged meal slots.

**Architecture:** Frontend-only. A pure `buildTimeline()` logic function (the `buildProtocol` precedent) merges four already-real data sources; `useFuelTimeline`/`useFuelPreview` become dual-mode (mock = the untouched hand-authored seed; real = the composed build). Zero backend/contract change — the protocol slots are FE-computed by design (P2 selection-only persistence).

**Tech Stack:** React 19 + TanStack Query, MSW/vitest; no Java, no Liquibase, no OpenAPI edits.

**Driving bd:** `mezo-9ys`. Spec: `docs/superpowers/specs/2026-07-02-fuel-p5-merged-timeline-design.md`.
**Branch:** `feat/fuel-p5-timeline` (from `main`). Claim already done (`bd update mezo-9ys --claim`).

## Global Constraints

- FE house standard `docs/references/frontend_conventions.md` — read FIRST. Hooks exported to features only via the `@/data/hooks` barrel; data modules may deep-import each other; logic functions in `features/fuel/logic/` are pure (no Date.now inside `buildTimeline` — the caller injects `nowHHmm`).
- **Hook signatures stable:** `useFuelTimeline(): { plan: FuelPlanToday; getScoredMeal(s: FuelSlot): FuelMeal | null }` and `useFuelPreview(): { visible: FuelSlot[]; nextStack: FuelSlot | undefined }` keep their shapes. `FuelSlot` gains only the additive `mealId?: string`.
- **No static-seed fallback in real mode**; real mode never fabricates prose (`mezoNote`/`windowTip` stay absent). Mock mode returns the seed byte-identically (existing mock tests must stay green unless they pinned the title-join).
- Gate per task and at the end: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes green. Hungarian UI copy, English code/commits, commits carry `(mezo-9ys)` + trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. The bd hook auto-stages `.beads/issues.jsonl` — expected.
- Time in tests: `vi.setSystemTime` (never real clock assertions).

---

### Task 1: `fuelConfig.ts` + `mealId` + id-based `getScoredMeal`

**Files:**
- Create: `frontend/src/data/fuel/fuelConfig.ts`
- Modify: `frontend/src/data/types.ts` (FuelSlot), `frontend/src/data/fuel/fuel.ts` (seed mealIds + getScoredMeal)
- Test: `frontend/src/data/fuel/fuelData.test.tsx` (extend/adapt)

**Interfaces (produces):**
```ts
// fuelConfig.ts
export const FUEL_ANCHORS = { caffeineCutoff: '14:00', kitchenClose: '21:30', bedtime: '23:00' } as const
export interface MealWindow { slot: MealSlot; time: string; label: string; kind: FuelKind }
export const MEAL_WINDOWS: MealWindow[]  // breakfast 07:00 Reggeli meal · lunch 12:30 Ebéd meal · snack 16:00 Snack snack · dinner 19:00 Vacsora meal
```
`FuelSlot` gains `mealId?: string`. `getScoredMeal(slot, meals)` becomes `slot.mealId ? meals.find(m => m.id === slot.mealId && m.breakdown) ?? null : null`.

- [ ] **Step 1: Failing test** — in `fuelData.test.tsx` add: `getScoredMeal` returns `m1` for a slot with `mealId: 'm1'`, and `null` for a slot with a `mealName` but no `mealId` (the old title-join must be dead). Run `pnpm vitest run src/data/fuel/fuelData.test.tsx` — FAIL.
- [ ] **Step 2: Implement** — add `fuelConfig.ts` with the two consts above (import `MealSlot`/`FuelKind` from `@/data/types`); add `mealId?: string` to `FuelSlot`; in `fuel.ts` set `mealId: 'm1'` on the seed slot whose mealName is `'Túrós zabkása · áfonyával'` and `mealId: 'm2'` on `'Csirke + édesburgonya + spenót'`; rewrite `getScoredMeal` id-based. Check `fuel.ts`'s `fuelDay.meals` ids are literally `m1`/`m2` first (`grep -n "id: 'm" frontend/src/data/fuel/fuel.ts`).
- [ ] **Step 3: Green + both-mode sanity** — the MealScoreSheet flow on Mai must still open in mock (FuelMaiPage.test.tsx's `/AI/` button test). Run `pnpm vitest run src/data/fuel src/features/fuel/pages/FuelMaiPage.test.tsx`.
- [ ] **Step 4: Commit** — `feat(fe): fuelConfig windows/anchors + id-based getScoredMeal (mezo-9ys)`.

---

### Task 2: `buildTimeline` pure logic + unit tests

**Files:**
- Create: `frontend/src/features/fuel/logic/buildTimeline.ts`
- Test: `frontend/src/features/fuel/logic/buildTimeline.test.ts`

**Interfaces (produces):**
```ts
export interface TimelineGym { time: string; type: string | null }
export interface TimelineSport { time: string; durationMin: number; kind: string }
export interface TimelineInput {
  meals: FuelMeal[]
  protocolSlots: ProtocolSlotData[]
  intakes: Intake[]
  gymToday: TimelineGym | null
  sportToday: TimelineSport | null
  nowHHmm: string
}
export function buildTimeline(input: TimelineInput): FuelPlanToday
```

- [ ] **Step 1: Verify two literals before coding** — (a) the exact `ProtocolSlotData.kind` strings `buildProtocol` emits (`grep -n "kind:" frontend/src/features/fuel/logic/buildProtocol.ts`); (b) the real-mode `FuelMeal.slot` format produced by `mealApi.ts` `fromResponse` (raw enum `breakfast|lunch|dinner|snack` or a display string — read the mapper). Write a `mealSlotKey(m: FuelMeal): MealSlot | null` helper that handles BOTH the real format and the mock display strings (`'Reggeli · 09:15 · post-workout'` → prefix match on the Hungarian label).
- [ ] **Step 2: Failing unit tests** (fixtures, no hooks/HTTP):
  - empty day (no meals/intakes/blocks, 2 protocol slots) → 4 pending placeholders + 2 protocol slots, sorted by time, no `now` before 00:00… use `nowHHmm: '10:00'` and assert the placeholder rule;
  - mid-day: breakfast logged 09:15 (done, carries `mealId`, macros, `time: '09:15'`), lunch un-logged (pending placeholder 12:30), one intake taken → that pip `done: true`, others false;
  - multi-meal slot: two snacks logged → both render, no placeholder for snack;
  - gym day: `gymToday {time:'07:30', type:'Pull Day'}` → workout slot `done` when `nowHHmm > '07:30'`, and `plan.workout = {type:'Pull Day', start:'07:30', ...}`; rest day → `workout.start === '—'`;
  - sport day: `sportToday` → `kind:'sport'` slot with `duration: durationMin` + `volleyball.noneToday === false`;
  - now-flag: with `nowHHmm '16:10'` and snack placeholder at 16:00 pending → snack is `'now'`; when that slot is done, no slot carries `'now'`;
  - anchors: output `caffeineCutoff/kitchenClose/bedtime` equal `FUEL_ANCHORS`.
- [ ] **Step 3: Implement** —
  - meals: per `MEAL_WINDOWS` window: logged meals of that slot each → `{ time: hhmm(loggedAt) || w.time, kind: w.kind, label: w.label, state: 'done', mealName: title, kcal/p/c/f, mealId: id }`; none → `{ time: w.time, kind: w.kind, label: w.label, state: 'pending' }` (`hhmm` = `loggedAt.slice(11,16)` with a fallback when unparsable);
  - protocol: map each `ProtocolSlotData` → `{ time, kind: PROTOCOL_KIND[ps.kind] ?? 'midday', label: ps.window, state, items }` where `items = ps.items.map(it => ({ type:'supplement', refId: it.refId, label: `${it.name} ${it.dose}`, done: intakes.some(i => i.pantryItemId === it.refId), primary: ps.primary || undefined }))` and `state = items.length > 0 && items.every(i => i.done) ? 'done' : 'pending'`; `PROTOCOL_KIND` maps the Step-1a literals onto `FuelKind` (wake→wake, pre-workout→preworkout, midday→midday, evening→evening, the pre-fuel/pre-snack kind→snack);
  - blocks: gym → `{ time, kind:'workout', label: `${type ?? 'Gym'} · gym`, state: time <= nowHHmm ? 'done' : 'pending' }` (NO `duration` field — unknown); sport → same with `kind:'sport'`, `duration: durationMin`;
  - sort by `time` (HH:mm strings compare lexicographically); **now-rule:** the LAST slot with `time <= nowHHmm && state !== 'done'` gets `state: 'now'`;
  - top fields: `workout: gymToday ? { type: type ?? '—', start: time, end: '—', duration: 0 } : { type:'—', start:'—', end:'—', duration: 0 }`; `volleyball: sportToday ? { start: time, end: '—', noneToday: false } : { start:'—', end:'—', noneToday: true }`; anchors spread from `FUEL_ANCHORS`.
- [ ] **Step 4: Green + commit** — `pnpm vitest run src/features/fuel/logic/buildTimeline.test.ts`; commit `feat(fe): buildTimeline pure merge — meals + protocol + train blocks (mezo-9ys)`.

---

### Task 3: dual-mode `useFuelTimeline` (`timelineHooks.ts`) + barrel

**Files:**
- Create: `frontend/src/data/fuel/timelineHooks.ts`
- Test: `frontend/src/data/fuel/timelineHooks.test.tsx`
- Modify: `frontend/src/data/fuel/stackHooks.ts` (export `useIntakes`), `frontend/src/data/fuel/fuelReadHooks.ts` (remove `useFuelTimeline`), `frontend/src/data/hooks.ts` (barrel line)

**Interfaces:**
- Consumes: `buildTimeline` (Task 2), `useFuelDay`, `useProtocol`/`useStack`/`useIntakes`, `useTrain` (`gymSchedule?.weeklyTimes`, `sport.schedule`), `buildProtocol`, seeds `fuelPlan`/`fuelDay`.
- Produces: `useFuelTimeline(): { plan: FuelPlanToday; getScoredMeal: (s: FuelSlot) => FuelMeal | null }` exported from `@/data/hooks` (signature unchanged).

- [ ] **Step 1: Failing hook tests** (`sharedWrapper` + `vi.stubEnv` + MSW idioms from `stackHooks.test.tsx`; `vi.setSystemTime` for the now-rule):
  - mock: `plan` === the seed `fuelPlan.today` (same slot count/labels — byte-parity), `getScoredMeal` id-based works;
  - real: with MSW returning one logged meal for today + an intake + empty protocol → `plan.slots` contains the meal (done, mealId) + 3 placeholders; no seed slot names leak (assert `'Lazac'`-free);
  - real cold-load: while queries pend → placeholders only (honest-empty), never the seed.
- [ ] **Step 2: Implement** —
  - export `useIntakes` from `stackHooks.ts` (rename-safe: keep it internal-named, add `export`);
  - `timelineHooks.ts`: `const mock = isMockMode()`; mock branch returns `{ plan: fuelPlan.today, getScoredMeal: s => getScoredMeal(s, fuelDay.meals) }` (unchanged seed path); real branch: `const { fuel } = useFuelDay(date)`, `const { selectedIds } = useProtocol()`, `const { stash } = useStack()`, `const intakes = useIntakes(date)`, `const train = useTrain()`; compute `gymToday` from `train.gymSchedule?.weeklyTimes.find(d => d.today && d.active && d.time)` (`type` from the same row) and `sportToday` from the sport schedule's today session — read `trainHooks.ts` first to see how a real sport session marks today (if the real rows carry no `today` flag, derive by `dayOfWeek === (new Date().getDay()+6)%7` the way `deriveGymSchedule` does); protocol slots = `buildProtocol(selectedIds ?? stash.filter(s => s.type !== 'medication').map(s => s.id), stash).slots`; `plan = buildTimeline({...})` with `nowHHmm` from `new Date`; `getScoredMeal` = id-based against `fuel.meals`. IMPORTANT: hooks must be called unconditionally (both branches call the same hooks; only the returned value branches) — React rules.
  - `fuelReadHooks.ts` drops `useFuelTimeline` (+ unused imports); barrel line 9 updates to export it from `timelineHooks`.
- [ ] **Step 3: Green + both-mode full run + commit** — `feat(fe): dual-mode useFuelTimeline — real merged agenda (mezo-9ys)`.

---

### Task 4: `useFuelPreview` composes the timeline

**Files:**
- Modify: `frontend/src/data/today/todayHooks.ts` (useFuelPreview), its test file (check `todayHooks.test.tsx` / `today` data tests)
- Test: extend the same test file

- [ ] **Step 1: Failing tests** — mock: `visible` = the same 3 seed slots as today (behavior unchanged); real (MSW: one pending placeholder timeline): `visible` derives from the composed plan, `nextStack` = first non-done slot with undone items or `undefined` when none.
- [ ] **Step 2: Implement** — `useFuelPreview()` calls `useFuelTimeline()` and applies the existing slice logic to `plan.slots` (drop the static `fuelToday` import): `nowIdx = findIndex(state==='now')`, `visible = slots.slice(max(0,nowIdx), max(0,nowIdx)+3)`, `nextStack = slots.find(s => s.state !== 'done' && (s.items ?? []).some(it => !it.done))`. Note any test rendering Today now needs the Query wrapper (it already does — verify).
- [ ] **Step 3: Green + commit** — `feat(fe): Today fuel preview reads the merged timeline (mezo-9ys)`.

---

### Task 5: Mai + preview rendering (placeholders, duration guard, real context strip)

**Files:**
- Modify: `frontend/src/features/fuel/components/SlotCard.tsx`, `FuelTimeline.tsx` (pass-through prop), `frontend/src/features/fuel/pages/FuelMaiPage.tsx`, `frontend/src/features/today/components/FuelTimelinePreview.tsx`, `frontend/src/features/fuel/sheets/LogMealSheet.tsx` (optional `initialSlot`)
- Tests: colocated test files of each

- [ ] **Step 1: Failing tests** —
  - SlotCard: a pending meal-kind slot WITHOUT `mealName` renders the label + a `Logolás` affordance (`aria-label={`${label} logolása`}`) and clicking calls the new optional `onLogMeal?.(slot)` prop; a workout slot without `duration` renders NO `· perc` suffix;
  - FuelMaiPage (real mode, MSW): context strip shows the schedule-derived gym time (not the `today.workoutType` static); clicking a placeholder opens `LogMealSheet` with the slot preselected (assert the segmented control's active slot);
  - FuelTimelinePreview: placeholder slot renders its label (no `undefined`).
- [ ] **Step 2: Implement** —
  - `SlotCard` gains optional `onLogMeal?: (slot: FuelSlot) => void`; render branch: `!slot.mealName && (slot.kind === 'meal' || slot.kind === 'snack') && slot.state !== 'done'` → label + Logolás chip-button calling it; duration suffix only when `slot.duration` truthy. `FuelTimeline` threads the prop through (`TimelineSlot` too).
  - `LogMealSheet` gains optional `initialSlot?: MealSlot` (default state seeding — check its current prefill prop shape and extend additively).
  - `FuelMaiPage`: pass `onLogMeal={slot => { setLogSlot(mealSlotOf(slot)); setLogOpen(true) }}` (map the slot label back to `MealSlot` via `MEAL_WINDOWS`); context strip gym label from `plan.workout.type`, time from `plan.workout.start`, duration cell only when `plan.workout.duration > 0`.
  - `FuelTimelinePreview`: `{s.mealName || s.label}` already handles placeholders — verify and cover.
- [ ] **Step 3: Green both modes + build + commit** — `feat(fe): Mai placeholders + real context strip + preview polish (mezo-9ys)`.

---

### Task 6: Docs + gates + close + merge

**Files:**
- Modify: `docs/features/fuel.md` (§2 Mai timeline, §3 timelineHooks, §5 Train seam), `docs/features/today.md` (preview), `docs/superpowers/plans/2026-06-26-fuel-completion-roadmap.md` (P5 ✅ SHIPPED note incl. the client-merge decision), `docs/milestones/roadmap.md`

- [ ] **Step 1:** Update docs; `node scripts/lint-docs.mjs` PASS (reconcile rippled docs per the P1/P2 precedent).
- [ ] **Step 2:** Full gates one last time (`pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`).
- [ ] **Step 3 (controller):** commit docs; `bd close mezo-9ys`; commit bd sync; `git checkout main && git pull --rebase && git merge --no-ff feat/fuel-p5-timeline -m "Merge feat/fuel-p5-timeline: Mai merged timeline — real agenda (mezo-9ys)" && git branch -d feat/fuel-p5-timeline && bd dolt push && git push`.
