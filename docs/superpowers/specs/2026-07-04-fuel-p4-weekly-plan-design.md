# Fuel P4 — Weekly Plan / Rhythm (Terv) goes real — design

- **Date:** 2026-07-04
- **Status:** designed — session-autonomous slice per the Phase-2 completion roadmap handoff
- **Driving bd:** `mezo-kpo` (fuel roadmap P4)
- **Parent roadmaps:** [`2026-06-26-fuel-completion-roadmap.md`](../plans/2026-06-26-fuel-completion-roadmap.md) §P4 ·
  [`2026-07-04-phase2-completion-roadmap.md`](../plans/2026-07-04-phase2-completion-roadmap.md) §F-P4
- **Depends on (all shipped):** P0a ADR (Train owns the schedule; Fuel = secondary editor),
  P3 medication (derived `retaDay`/cycle), meal-logging + water (per-day rollups), Train
  gym/sport schedules (`PUT/GET /api/train/{gym,sport}-schedule`, `deriveGymSchedule`).
- **Living docs to update on ship:** `docs/features/fuel.md` (§2 Terv, §3 hooks, §4 contract, §5 integrations), `docs/features/train.md` (integration seam), `docs/milestones/roadmap.md`.

## 1. Problem & direction

The Terv view (`FuelPlanPage`) is the last fully-fabricated Fuel surface in real mode: a private
mock `gymSchedule` (edits vanish on reload), mock `volleyballSessions`, magic-number `weeklyStats`
(`kcalTarget 3100 · factor 0.91 · protein 6/7 · adherence 92%`), a static `retaWeek`, a hardcoded
`"Máj 18 – 24"` title, and hand-authored AI prose. P4 makes the week real: schedule from Train,
Reta strip from the medication cycle, weekly stats from real per-day meal rollups, gym-time edits
written through to Train — and every surface that cannot be real yet renders an honest state
(the `mezo-lfw` strip philosophy), never fiction.

## 2. Decisions (resolving the roadmap's open items)

1. **Shape bridge `GymScheduleDay` ↔ `GymScheduleSlot`** — reuse Train's `deriveGymSchedule`
   output (`useTrain().gymSchedule.weeklyTimes`) for the read side; on save, map
   `GymScheduleDay[]` → `GymScheduleSlotInput[]` (`active && time` days only,
   `dayOfWeek = DAY_ORDER.indexOf(day)`) and call `useTrain().saveGymSchedule` (PUT full-replace).
   **The sheet stays untouched** (signature-stable). Known v1 limit, documented: only *day + time*
   persist (the Train contract); `type`/`active` are mesocycle-owned — an edit shows optimistically
   (page-local override) but meso truth wins on reload. Toggling a day OFF *does* persist correctly
   (its slot is dropped from the PUT).
2. **`duration` gap** — `deriveGymSchedule` yields `duration: null` (no DB home); the grid needs a
   width. Real mode defaults active-with-time days to the planner's existing `DEFAULT_BLOCK_MIN`
   (60, `fuelConfig.ts`) — presentational default, consistent with the P5 Mai timeline blocks.
   No `gym_schedule_slot` column extension (nothing would write it).
3. **`weeklyStats` — real via a small server read-model** (the D′ coordination point):
   **`GET /api/fuel/week/{start}`** in `meal.yml` → `FuelWeekResponse { start, days[7] }`,
   each `FuelDayRollup { date, targets: MacroSet, consumed: MacroSet }` (no meals — lean).
   `FuelDayService.getWeek` loops 7 days reusing the existing per-day consumed/water rollup.
   FE derives: `kcalTarget` = targets.kcal; `kcalAvgFactor` = avg(consumed.kcal of days with
   any kcal) / target (0 when no data → the card shows `—`); `proteinHitDays` = count of days
   with `consumed.p ≥ targets.p`. **`supplementsAdherence` → `null` in real mode** (honest `—`;
   needs planned-vs-taken semantics — deferred with P8). `WeeklyStats` becomes a named type
   (`supplementsAdherence: number | null`).
4. **`retaWeek` real** (the P3 leftover): map `useMedication().cycle.week`
   (`MedicationCycleCell { day, phaseKey, label, current }`) → `RetaDayCell { d, label, color }`
   (`phaseKey` → `Peak|Stable|Trough`, color = `var(--reta-d{day})`). No medication/dose →
   empty week → **the whole Reta card hides** (honest ghost).
5. **Honest-empty for the un-real-izable sections:** real mode returns `patterns: []` and
   `weeklySupplements: []` (fabricated prose / plan map — pattern-engine and protocol-map work
   live in later epics); the page hides both sections when empty. The stats-card Mezo prose
   moves into the hook as `weeklyNote: string | null` (mock = the seed string, real = `null` →
   row hidden). Precedent: `useStackRecommendations` real → `[]`.
6. **Title date-derived:** additive `title` field on the hook — mock keeps `"Máj 18 – 24"`
   byte-for-byte; real derives the current Monday-based week (`weekTitle`: same-month
   `"Júl 1 – 7"`, cross-month `"Jún 29 – Júl 5"`, HU month abbrevs from `dates.ts`).
   Week boundary = **Monday** (matches `DAY_ORDER`, `deriveSportWeek`'s ISO-week precedent).
7. **Hook split:** `useFuelWeek` moves to a new composing dual-mode
   `data/fuel/fuelWeekHooks.ts` (+ `useFuelWeekActions().saveGymSchedule`); mock returns the
   exact current seeds (byte parity); real composes `useTrain` + `useMedication` + the new
   `['fuelWeek', monday]` query — all hooks called unconditionally, only the return branches
   (the P5 `timelineHooks` idiom). `fuelReadHooks.ts` keeps `useReplanScenarios` /
   `useStackRecommendations` (P8). Page-local `gymOverride ?? gymSchedule` replaces the
   seed-once `useState` (fixes async-data staleness + gives optimistic save in both modes).

## 3. Out of scope (unchanged from the roadmap)

Supplement-adherence % + protocol-derived week map; `recurringPatterns` from the pattern engine
(P8); `useReplanScenarios`/`useStackRecommendations` (P8, `mezo-0h6w`); per-vendor duration/type
persistence on gym slots; the AI weekly prose (proactive epic).

## 4. Slice shape

- **Contract:** `api/feature/meal/meal.yml` + merge + FE/BE regen (`FuelWeekResponse`, `FuelDayRollup`).
- **Backend:** `FuelDayService.getWeek` + `MealController.getFuelWeek`; ITs (empty week, populated
  week sums per day, ownership isolation). No migration, no new tables.
- **FE:** `fuelWeekHooks.ts` (dual-mode read + actions + pure `deriveWeeklyStats` /
  `gymDaysToSlots` / `toRetaCells` / `weekTitle`), `mealApi.getWeek`, `FuelPlanPage` honest
  guards + write-through wiring, `types.ts` `WeeklyStats`.
- **Gates:** BE `./mvnw clean test`; FE `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`;
  feature docs + `node scripts/lint-docs.mjs`.
