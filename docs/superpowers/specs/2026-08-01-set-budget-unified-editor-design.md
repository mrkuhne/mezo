# Set-budget warnings + unified mesocycle exercise editor — design

- **Date:** 2026-08-01
- **Driving issue:** mezo-7rdg
- **Status:** approved (brainstormed with Daniel, mockups validated in visual companion: `row-layout` → A accordion, `header` → B budget bars, `composite-v2` → final visual language)
- **Source:** Jeremy Ethier / Built With Science, "What is the fastest way to gain 20 lb of muscle naturally?" (youtube `ehQ_5TThkRI`), experts: Dr. Mike Zourdos (set-volume + proximity-to-failure meta-analyses), Jake Remmert (per-session set cap), Dr. Eric Helms, Steve Hall. Transcript to be ingested into `docs/research/` as part of this work.

## 1. Problem

The app counts weekly working sets per muscle group (`muscleWeekFromMeso`) and shows them on the Gym page, but never tells the user when the volume stops being useful. The video's evidence-based rules:

- **Intensity (failure) style:** every set to failure (RIR 0) → **5–12 sets/muscle/week** is the productive range.
- **Volume style:** sets stopped 2–3 reps short (RIR 2–3) → **12–20 sets/muscle/week**.
- Styles can be **mixed per muscle** (Ethier himself does failure for arms/back, volume for legs).
- **Per-session cap:** beyond **~10–11 sets per muscle in a single session** there is no measurable extra growth — the fix is frequency (split the same weekly volume across ≥2 days, worth up to ~30% faster gains).

Separately, the mesocycle exercise flow is split across two screens (picker screen → numbers screen), and the numbers editor (`ExerciseRecipeRow`: six always-open steppers per row) is cramped, small-targeted, colorless, and has no day/week summary.

## 2. Decisions (validated in brainstorm)

| # | Decision | Choice |
|---|---|---|
| D1 | Failure/volume modeling | **No new field.** Existing `targetRIR` is the source of truth. Classification: `targetRIR ≤ 1` → failure 🔥, `targetRIR ≥ 2` → volume 🌿. UI: segmented toggle per exercise that sets RIR to **0** (Failure) or **2** (Volume); manual RIR fine-tuning stays available and reclassifies accordingly. |
| D2 | Mixed-week math | **Budget model:** each failure set costs 1/12 of the weekly per-muscle budget, each volume set 1/20. `budget = failureSets/12 + volumeSets/20`. `> 1.0` → red over-budget warning; `0.85–1.0` → amber "approaching" state. |
| D3 | Daily session cap | Per day × muscle: working sets `> 11` → amber warning + "split across two days" hint. Frequency data already exists (`gymFrequency`). |
| D4 | Relation to MEV/MAV/MRV | **Two separate layers.** Budget warnings live at *planning* time (unified editor + read-only mirrors). The `VolumeProgressionService` / volume-arc / MRV engine is untouched. No integration now (YAGNI). |
| D5 | Screen merge scope | **Full unification.** One new editor component used by the builder "Gyakorlatok" view AND the planner wizard, whose steps 3 (AI program review) + 4 (set & rep tuning) merge into one "Program" step → 4-step wizard. `ExercisePickerSheet` is kept and opens from the editor's "+ Gyakorlat" button. |
| D6 | Row layout | **Accordion** (mockup A): collapsed rows show name + muscle pill + `🔥 4×8–10` chip; one row expanded at a time with the toggle + 2×2 large steppers (working sets, rep range, anchor kg, warmup). New exercises default to 🌿 volume (RIR 2) and are created expanded. |
| D7 | Summary header | **Collapsible budget card** (mockup B) under a **gradient hero** (composite v2). Hero: day focus — big daily set count, weekly total + training-day count, status line (✓ / ⚠ n jelzés), wash→surface gradient + radial glow, amber-shifted in warning state. Budget card: collapsed = muscle pills with % in family colors; expanded = per-muscle rows (5px rail, family-colored bar, % + 🔥/🌿 split) + warning lines at the bottom. Warning day gets a red dot on its day tab. |
| D8 | Visual language | Existing tokens only: muscle color families from `muscleColors.ts` (coral=Mell, sky=Hát, lav=Váll, rose=Kar, sage=Láb, amber=Core; rail/wash/deep), gradient recipe `linear-gradient(180deg, <wash> 0%, var(--surface-1) 100%)` as in `ActiveMesoCard`/`SportPage`, radial glow accents, day-tab mini dots in the day's dominant region color. |
| D9 | Persistence | **None.** All budget/warning computation is client-side from the meso `days` template. No API, DB, or contract change. The toggle writes the existing `targetRIR` field through the existing save path. |

## 3. Architecture

### 3.1 Logic layer (pure, unit-tested)

New module `frontend/src/features/train/logic/setBudget.ts`:

- `setStyle(targetRIR: number): 'failure' | 'volume'` — D1 rule.
- `muscleBudget(rows)` — extends the `muscleWeekFromMeso` output: per muscle `{ failureSets, volumeSets, budget, level: 'ok' | 'near' | 'over' }` per D2.
- `sessionCapWarnings(days)` — per day × muscle working-set totals, `> 11` → warning entries with day + muscle + count (D3).
- Off-day rows (`muscle === '' | 'sport'`) skipped exactly as `muscleWeek.ts` does; warmup sets excluded everywhere (working sets only).
- `MuscleWeekRow` (in `muscleWeek.ts`) gains `failureSets` / `volumeSets` fields (computed in the same pass); `setBudget.ts` derives budget from them so there is one traversal source.

### 3.2 Unified editor (feature components)

- `MesoEditor` (new, `features/train/components/`): day tabs → hero → budget card → accordion list → "+ Gyakorlat" button. Owns the local `days` state + background `saveDayExercises` persistence exactly as `MesoExercises` does today (seed/clone → mutate → PUT per day).
- `MesoEditorHero` — D7 hero.
- `SetBudgetCard` — D7 collapsible card (collapsed pills / expanded rows + warning lines).
- `ExerciseAccordionRow` — D6 row (replaces `ExerciseRecipeRow`, which is removed with its tests).
- `ExercisePickerSheet` unchanged, opened from the add button; a newly added exercise lands expanded with RIR 2.
- Drag-reorder (`SortableList`) is preserved on collapsed rows.

### 3.3 Integration points

- **Builder:** `MesocycleBuilderPage` "Gyakorlatok" view renders `MesoEditor` (replacing `MesoExercises` internals; `MesoExercises` is removed or reduced to a thin wrapper).
- **Wizard:** `MesocyclePlannerPage` steps 3+4 merge into one "Program" step rendering `MesoEditor` over the AI-generated program; step count, progress UI, and navigation update from 5 to 4 steps.
- **Read-only mirrors:** `MuscleWeekSheet` rows get the budget bar + % + 🔥/🌿 split; `GymPage` muscle pills take warning coloring when `level !== 'ok'`. No other Gym-page change.

## 4. Testing

- Unit: `setBudget.test.ts` — style boundary (RIR 1 vs 2), pure-failure >12, pure-volume >20, mixed budget arithmetic (8🔥+6🌿 = 108% → over), near-band 85–100%, session cap (11 ok / 12 warn), off-day + warmup exclusion.
- Component: `MesoEditor` (toggle writes RIR 0/2, accordion single-expand, add-flow default, persistence call), `SetBudgetCard` states, wizard 4-step navigation.
- Both modes green: `pnpm test` and `VITE_USE_MOCK=true pnpm test`, plus `pnpm build`.
- Existing `MesoExercises`/`ExerciseRecipeRow`/planner tests updated or replaced — the "what can a user no longer do" check applies (nothing: every old capability exists in the new editor).

## 5. Documentation

- `docs/features/train.md`: §2 page inventory (screen merge, 4-step wizard), §4 (set-budget logic), §10 file map — same change.
- Video ingest into `docs/research/` via the knowledge-base skill (source: transcript; distilled page: set-volume landmarks / failure-vs-volume training).
- This spec is the frozen design artifact; no ADR needed (no infra/tooling decision).

## 6. Out of scope

- MEV/MAV/MRV recomputation or landmark changes (D4).
- Backend/API/DB changes of any kind (D9).
- Lower-bound "too few sets" warnings (the MEV system already covers under-volume).
- Workout-execution surfaces (GymDayPage logging flow) beyond the two read-only mirrors.
