# Meso builder — two-phase editing: persistent picker + day-tabbed set/rep page — Design

> **Date:** 2026-07-16
> **Status:** Approved (brainstorming) → next: writing-plans
> **Driving issue:** `mezo-n46i`
> **Scope:** Frontend only — no API-contract or backend change. Reshapes exercise editing in
> BOTH meso-editing surfaces: the new-meso planner wizard (`/train/mesocycles/new`) and the
> builder page (`/train/mesocycles/:id`, Gyakorlatok view).

## Problem

Two friction points in meso exercise editing today:

1. **The exercise picker closes after every pick.** `ExercisePickerSheet` calls `onPick(item)`
   then `close()` on row tap (`ExercisePickerSheet.tsx:102-105`), so building a 6-exercise day
   means opening the sheet six times.
2. **Set/rep tuning is buried or missing.** In the planner's program review (step 3) the
   `PlannerExerciseRow` settings chip is **inert** — every added exercise keeps the default
   recipe (2 warmup · 3 working · 6-8 · RIR 0) with no way to change it before saving. In the
   builder, editing exists (`ExerciseEditRow` inline steppers) but hides behind a tiny settings
   chip with poor discoverability.

## Approved decisions

| Decision | Choice |
|---|---|
| Scope | **Both surfaces** — planner wizard AND builder Gyakorlatok view |
| Wizard shape | **New 5th step**: 4 = exercise selection (AI prefill + multi-add), 5 = set/rep tuning with day tabs; save buttons move to step 5 |
| Editable recipe fields | **Full recipe**: warmup sets · working sets · rep min · rep max · RIR + the nullable **Kiinduló kg** anchor (parity with today's six-tile inline editor) |
| Builder integration | Gyakorlatok view **replaced** by the same day-tabbed editor component (one shared component, two call sites) |
| Picker UX after pick | Sheet stays open; row flashes "✓ Hozzáadva" (~900 ms), header shows a live added-counter, sticky **Kész** button closes; duplicates remain allowed |
| Component architecture | **One shared controlled component** (`MesoDayTabsEditor`); persistence semantics stay in the parents (wizard = in-memory draft, builder = per-change full-list PUT) |

## 1 · `ExercisePickerSheet` — persistent picker

- Row tap calls `onPick(item)` only — **no `close()`**.
- Sheet-local `addedCount` state increments per pick (resets naturally on mount; the picker is
  mounted per day-open in both call sites).
- Per-row flash: `flashId` state set on pick, cleared after ~900 ms — the `+` icon swaps to a
  check and the row gets a brand tint while flashing.
- New optional `dayLabel` prop (e.g. `"Cs · Push A"`), shown as header subtitle together with the
  live counter (`"2 hozzáadva"`).
- Sticky bottom **Kész** CTA closes the sheet (label `"Kész · N hozzáadva"` when `addedCount > 0`);
  the header ✕ stays.
- Call sites (`MesoExercises`, planner step) keep their existing `onClose`/`onPick` wiring and
  only add `dayLabel`.
- **Adjacent bugfix:** new-exercise ids are `${item.id}-${Date.now()}` in both call sites — a fast
  double-add can collide within one millisecond. Switch to `crypto.randomUUID()` (already the
  app-wide id pattern).

## 2 · New shared component: `MesoDayTabsEditor`

`frontend/src/features/train/components/MesoDayTabsEditor.tsx` — fully controlled, no data
hooks, no persistence knowledge:

```ts
interface MesoDayTabsEditorProps {
  days: MesoDay[]                        // PlannerDay is a type alias of MesoDay (planner.ts:84)
  onAddClick: (dayKey: string) => void   // parent owns the picker sheet
  onRemove: (dayKey: string, exId: string) => void
  onChange: (dayKey: string, exId: string, patch: Partial<GymExercise>) => void
  onReorder: (dayKey: string, ids: string[]) => void
}
```

- **Off-day detection is muscle-based**, not type-based: builder fixture types include
  `'Volleyball · meccs'`, so exact type matching breaks. Shared helper
  `isOffDay(d) = d.muscle === '' || d.muscle === 'sport'` (rest days carry `muscle: ''`, sport
  days `'sport'`, in both the planner generator and the builder fixtures/backend mirror). Side
  win: this fixes the existing builder quirk where a training day emptied of exercises rendered
  as "off" and lost its add CTA (`DayExerciseSection` used `exercises.length > 0`).
- **Day tabs (top):** one tab per day, all 7 shown. Training days get a small exercise-count
  badge; off days render muted. Horizontal scroll if the row overflows. Default active tab: the
  `current` day, else the first training day.
- **Active day content:** day header (`type` + `N gyakorlat · M szet`) → `SortableList` of
  exercise rows → dashed `+ Gyakorlat hozzáadása` CTA → `onAddClick(day.day)`.
- **Exercise row:** name + muscle label + recipe summary in mono + optional niggle warning; the
  **whole row toggles** an inline stepper panel (chevron affordance) — replacing the tiny
  settings chip. Panel = five `RecipeStepper` tiles (Bemelegítő 0-10 · Working 1-10 ·
  Rep min · Rep max · RIR 0-5, min/max cross-clamped as today) **plus the nullable
  `AnchorStepper` "Kiinduló kg" tile** (2.5 kg steps, `auto` when unset) — today's builder
  inline editor has six tiles, and dropping the anchor would regress `mezo-anm4`. Each stepper
  tap fires `onChange(dayKey, exId, patch)`. Remove ✕ stays on the row.
- **Off-day content:** rest note + inert "Edzéssé alakít" chip (parity with today).
- `RecipeStepper` moves out of `ExerciseEditRow` into this file as a private sub-component.

## 3 · Planner wizard: 4 → 5 steps

`MesocyclePlannerPage.tsx` + `logic/planner.ts`:

Steps below are named 1-based (code indices in parens).

- `STEP_COUNT = 5`; `stepLabels = ['Cél', 'Hossz + fázisok', 'Split + napok', 'Gyakorlatok',
  'Set & rep']`; `PAGE_TITLES` gains a 5th entry (e.g. "Mennyit és hányszor?"; the 4th title
  becomes exercise-selection-flavored, final HU copy at implementation).
- **Step 4 · Gyakorlatok (index 3):** current `Step3Program` UI (summary header, AI hint,
  collapsible `PlannerDaySection` days, add/remove/reorder, custom-day rename) with the
  now-persistent picker. The inert settings chip is **removed** from `PlannerExerciseRow`.
  Footer: standard `Tovább →`, gated on `program !== null`.
- **Step 5 · Set & rep (index 4):** new `Step4Recipe` step component rendering
  `MesoDayTabsEditor` over the same lifted `program` state, plus its own picker instance for
  in-tab adds. The two terminal save buttons (`Hozzáad mint tervezett` / `Aktiválás most`)
  move here unchanged (`saveMesocycle` untouched).
- **Program mutation helpers lift to the page** (`addExercise`, `removeExercise`,
  `reorderExercises`, `renameDay`, new `updateExercise` recipe patch) and are passed to both
  steps — no duplicated `setProgram` logic.
- **Regeneration guard (bugfix this design forces):** today the generate-`useEffect` runs on
  every `Step3Program` mount, so stepping back from Set & rep to Gyakorlatok would regenerate
  and wipe all edits. Generation moves up to the page (or gets a guard) keyed on an **input
  signature** (`goal.id | split.label | days | weekdays`): regenerate only when the signature
  actually changed since the last generation; otherwise keep the edited program. Gyakorlatok ↔
  Set & rep round-trips must preserve edits.

## 4 · Builder Gyakorlatok view

`MesoExercises.tsx`:

- Keeps: `seedDays` local state, `persistDay` full-list PUT per change, intro card (copy updated
  for the tabbed UI), weekly set-volume footer, planned/archived early-return.
- The `DayExerciseSection` list is replaced by `MesoDayTabsEditor`; the existing four handlers
  (`addExercise`, `removeExercise`, `updateExercise`, `reorderExercises`) wire in unchanged.
  `current` day drives the default tab.
- Weekly at-a-glance overview remains available in the Áttekintés view (`MesoOverview`).
- **Deleted:** `DayExerciseSection.tsx`, `ExerciseEditRow.tsx` + their tests (no other users).

## 5 · Data / API

No contract, hook-signature, or backend change. Wizard stays an in-memory draft until
`createMesocycle`; builder keeps firing `saveDayExercises` full-list PUTs per mutation
(including per stepper tap — existing behavior, unchanged).

## 6 · Testing

- `ExercisePickerSheet.test`: stays open after pick; counter increments; Kész closes; flash
  badge renders; `dayLabel` shown.
- New `MesoDayTabsEditor.test`: tab switching; default tab (current > first training day);
  recipe patch callbacks; reorder; add-CTA callback; off-day rendering.
- `MesocyclePlannerPage.test`: 5-step walk-through; Gyakorlatok-step gate on `program`; save
  buttons on the Set & rep step; **Gyakorlatok ↔ Set & rep round-trip preserves program edits**
  (regeneration guard).
- `MesoExercises.test`: rewritten for the tabbed UI; PUTs still fire on add/remove/change/reorder.
- Gate: `pnpm build && pnpm test` + `VITE_USE_MOCK=true pnpm test` (both modes green), plus a
  visual pass in the running app (layout changes are verified by eye per project practice).

## 7 · Docs

- `docs/features/train.md`: planner + builder sections updated (flow, file map) in the same
  change; `node scripts/lint-docs.mjs` clean.
