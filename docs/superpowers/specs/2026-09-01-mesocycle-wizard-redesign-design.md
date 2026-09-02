# Mesocycle wizard + active-meso pages redesign — design spec

**Date:** 2026-09-01 · **Driving idea:** collapse the mesocycle system to a single,
correctly-working Hypertrophy model; day-count-driven scheduling; hybrid deterministic +
Gemini program generation; redesign all mesocycle subpages in the design 2.0 tile language.

## Problem

The current wizard offers 6 mesocycle types (`GOAL_PRESETS`), 6 split presets (`SPLITS`),
a hand-editable phase curve, and an Emphasize/Grow/Maintain muscle picker — but the tier
choices **do not affect the generated program** at all, and the "Heti szet-büdzsé" card
divides planned sets by the tier's own landmark (Emphasize→MRV, Maintain→MEV), so an
Emphasized muscle shows the *lowest* percentage. Mathematically intended (spec GD5),
perceptually backwards. Meanwhile the backend already contains a full RP-style volume
engine (`VolumeDecider`, `seedBaselines`, weekly rollover, per-tier ceilings) that the
wizard front-end simply isn't built around.

Decisions made with Daniel in this brainstorm:

- **Full deletion** of the other mesocycle types — one Hypertrophy model, polished.
- **Hybrid generation**: deterministic skeleton (split, per-muscle set frames, ramp,
  deload) + Gemini variance in exercise selection and day contents, steered by a
  free-text goal field.
- **Gemini** (already integrated via the companion `*LlmAdapter` pattern) is the LLM;
  called from the backend; Fake adapter in mock/test mode.
- **3 priority tiers with real effect** (Emphasize/Grow/Maintain now drive generated sets).
- **3-step wizard**; length and phase curve become automatic defaults (editable in step 3).
- **All subpages redesigned** (hub, run, weekly review + muscle detail — which absorbs the
  former Volumen page —, templates+editor, report, compare).
- **Readable past, new future**: old runs/reports/templates stay viewable (preset label
  becomes plain text); new mesocycles only via the new model; starting an old template
  converts it.
- **Backend generator**: single source of truth; the FE landmark mirror and the old
  fatigue-cap model get retired.
- Training days may be **any day of the week** (weekends included).

## The training model (deterministic core)

Inputs: days/week (2–6) + concrete days (any of the 7) · per-muscle tier · optional
free-text goal.

Per-muscle weekly sets from the existing `mezo.volume.baselines`:

| Tier | Week-1 start | Ceiling | Meaning |
|---|---|---|---|
| Emphasize (max 2 muscles) | MEV + 2 | MRV | ramp hard |
| Grow (default) | MEV | MAV | normal growth |
| Maintain | MEV | MEV | hold, no ramp (MV is not a landmark in this codebase — refined during planning) |

Weekly progression: +2 sets (existing `step: 2`) toward the ceiling, RIR-based HOLD on
grinding (existing `grind-rir-gap`), terminal **deload week at half volume** (existing
`deload-fraction: 0.5`). Default length **5 ramp weeks + 1 deload**, adjustable 4–8 in
step 3. The manual phase-curve editor is deleted — the curve is derived.

Split derivation from day count: 2–3 → Full body · 4 → Upper/Lower · 5 →
Upper/Lower/Push/Pull/Legs · 6 → PPL×2. Constraints: every muscle ≥2×/week, ≤~8
sets/muscle/session; weekly target volume is spread across days under these caps.
The split-preset picker is deleted; Gemini varies day *contents* (exercise choice, order,
goal-text preferences) within the set frames.

The "Heti szet-büdzsé" % display is deleted. Everywhere a muscle's volume shows, the
format is `current weekly sets → ceiling · tier` (e.g. `Hát · 12 → 22 · Emphasize`) —
grows week over week; Emphasized muscles read largest, not smallest.

## Wizard (3 steps)

1. **"Mikor és miért"** — day-count tiles (2–6); a 7-day picker (H–V) pre-filled with a
   recommended pattern for the chosen count (weekend days selectable); optional free-text
   goal field ("pl. röplabda szezon mellett, vállra figyelve"). Empty goal text still
   yields a full program.
2. **"Fókusz"** — per-muscle Emphasize/Grow/Maintain via `MusclePriorityPicker`
   (Emphasize cap 2 kept). Live footer: total week-1 and peak-week sets.
3. **"Program"** — calls the generator endpoint; shows the generated program (day
   breakdown, editable with the existing editor: swap/reorder/set counts), a `rationale`
   line from Gemini in the header, and an **Újragenerálás** button (re-callable with
   edited goal text). Any regeneration after manual edits asks first (AD6 extended: no
   input change silently regenerates hand-edited work). Save = existing template-first
   seam (`createTemplate` → optional `startTemplate`).

## Backend

**New endpoint** `POST /api/train/meso-plans/generate` in `api/feature/train/train.yml`.
Request `{ daysOfWeek, weeks, priorities, goalText? }` → response: a
`MesoTemplateUpsertRequest`-compatible proposal (days + exercises + sets +
`volumePerMuscle` landmark instance) + `rationale` string. Saving uses the **existing**
`POST /api/train/meso-templates` (+ `/start`) path — no new save route.

New services in `feature/train`:

- `MesoPlanSkeletonService` — pure: day count → split → per-day per-muscle set frames
  from `VolumeProperties`; unit-tested.
- `MesoPlanLlmAdapter` — Gemini via the companion adapter pattern, LLM-logged; Fake
  implementation for tests/mock.
- Validator/fallback filler — if Gemini exceeds set frames or names unknown exercises,
  a deterministic filler repairs the response; generation never fails toward the user.
  LLM output is never trusted raw: only catalog exercise ids and in-frame set counts
  validate through (guards goal-text prompt injection too).

**Deletions/simplifications:**

- FE: `GOAL_PRESETS`, `SPLITS`, `SCHEMES`, phase-curve editor, `SetBudgetCard` %,
  and the old fatigue-cap volume model (`budgetOf`, and its consumers in `programFit`,
  `weekZone`, `peakWeekFit`). One volume model remains (landmark-based).
  `structureLint` stays, retargeted to the new frames.
- Backend: `goalPreset` column stays (readable past); new runs write fixed
  `hypertrophy`. Check consumers `exerciseDefaults.ts` (NULL→hypertrophy default
  already) and the character feature's `MesoAdherenceDetector` for the fixed value.
- Old template start: converts on the `/start` path via existing `seedBaselines`
  (already landmark-seeding — near-free).

**Unchanged:** run-time weekly rollover (`VolumeDecider`, `rolloverIfDue`),
`SetRecommendationService`, template/run split (ADR-0027), contract-drift + CODEMAP
gates.

## Active-meso pages (design 2.0 tile language)

All seven surfaces redesigned with washed tiles, clay icons, animated bars, honest empty
states (per the standing §1 tile recipe in
`docs/design_2.0/2026-08-27-mezo-en-design-iterations.md`):

- **Hub** — structure kept (active hero + Volumen/Történet/Sablonok/Új blokk tiles);
  hero shows the new model's state: week X/Y, phase chip (Rámpa/Csúcs/Deload), mini
  muscle grid with animated `current → ceiling` bars.
- **Active run** — status-first instead of editor-central: weekly ramp timeline (week
  dot row with deload anchor), per-muscle tiles `12 → 22 · Emphasize` with ▲+2 weekly
  chips; `VolumeDecider` HOLD/DELOAD outcomes rendered as Hungarian sentences; the
  week's days as a tile mosaic (today marked, done days ticked) → a day tile opens the
  editable day page (muscle-washed, grouped exercise tiles, stepper body). **No in-cycle
  Fókusz change** (decided in the prototype round): tiers are set only in the wizard /
  template editor, so the live `PUT …/muscle-priorities` on a running mesocycle leaves
  the UI (the endpoint may stay for templates).
- **Heti vizsgálat (weekly review) + muscle detail** — replaces the standalone Volumen
  page (decided in the prototype round: the two drew the same band twice). Reached from
  the hub tile and the run page: hero (this week's sets + delta vs last week), 4 stat
  cells, next-rollover banner, then per-muscle washed tiles (`current → ceiling`,
  MEV/MAV/MRV band with last-week/now markers, W1–W6 spark, status line). A muscle tile
  opens the **muscle detail page**, which keeps every Volumen datum and adds more: stat
  cells (now · ceiling · this week · frequency), the band, the block arc, the
  `VolumeDecider` decision as a sentence, *where it works this week* (days + exercises
  with sets), the 4-step derivation (Baseline → Fókusz-sáv → personalisation → resulting)
  with confidence + Felülír, and the previous block's start → peak / ceiling. The
  `VolumeArcChart`/`MesoOverviewPage` provenance code migrates here; `/train/mesocycles/:id/overview`
  route is replaced by `/train/mesocycles/:id/week` and `/week/:muscle`.
- **Sablonok + editor** — list becomes tiles (split icon, day count, emphasized-muscle
  chips); editor loses phase-curve and preset pickers, keeps day/exercise editing +
  Fókusz.
- **Záróriport** — frozen report + new-model summary: per-muscle `start → peak /
  ceiling` bar, deload marker, the goal text quoted back.
- **Compare** — A/B kept; comparison axes become per-muscle peak volume and tier-choice
  diffs.

Visual work happens as a **new iteration of `docs/design_2.0/prototypes/mezociklus.html`**
(artifact update), iterated with Daniel before implementation of the FE slices.

## Testing & error handling

- `MesoPlanSkeletonService`: table-driven units (day counts × priorities → expected
  splits/frames; ≥2×/week and session-cap invariants).
- Gemini adapter: recording tests + Fake (companion pattern); validator tested on
  malformed-LLM-response cases.
- FE: logic-module table tests rewritten for the new model; hooks work in both modes
  (`VITE_USE_MOCK` trap); `/train/gym` and `/train/session` visual goldens likely
  affected (darwin local, linux via CI bot).
- Contract change → regenerate both sides; CODEMAP regenerated in the same change;
  ArchUnit layer rules respected (full gate via CI self-PR).
- Gemini error/timeout → deterministic filler takes over silently; UI notes "alap
  gyakorlat-kiosztás — újragenerálhatod". Generation never blocks the wizard.

## Rollout — 4 slices (each its own bd issue + branch + self-PR)

1. **Prototype iteration** on `mezociklus.html` — first, the visual truth for slices 3–4.
2. **Model + backend generator** (skeleton service, Gemini adapter, endpoint, contract).
3. **Wizard rewrite** (3 steps; delete presets/splits/phase-curve/old FE volume model).
4. **Subpages** (hub, run, volume, templates, report, compare in tile language).

## Prior art

Researcher's findings (sources vetted, adopted/rejected):

- **RP Hypertrophy app** — days/week + per-muscle status; priority maps to a landmark
  band (start + ceiling), never a shared budget. Adopted wholesale; this is the fix for
  the "Emphasize shows least" bug. https://rpstrength.com/pages/hypertrophy-app
- **RP volume landmarks (Israetel)** — MEV start, +1–2 sets/week to MRV, terminal
  half-volume deload; MV ≈ 6 sets/week is the "maintain" number. Adopted as the
  deterministic core (already largely in the backend).
  https://rpstrength.com/blogs/articles/training-volume-landmarks-muscle-growth
- **Arvo landmark table** — usable per-muscle MEV/MAV/MRV numbers + the frequency ×
  per-session-cap (6–10 sets) rule that drives split derivation. Adopted as seed data /
  constraint. https://arvo.guru/resources/volume-training
- **Alpha Progression** — "frequency + priorities in, full editable plan out" wizard.
  Adopted: opinionated defaults, post-hoc editing. Rejected: its 1×/week floor (we keep
  ≥2×). https://alphaprogression.com/en
- **JuggernautAI** — readiness check-ins scaling volume: good later addition (backend
  already autoregulates); its up-front periodization-model picker is exactly the
  taxonomy we are deleting. Rejected for v1.
  https://www.garagegymreviews.com/juggernautai-review

## Codebase terrain

Investigator's findings (key anchors):

- Wizard: `frontend/src/features/train/pages/MesocyclePlannerPage.tsx` (5-step, state
  :60-90, save :206-240); logic `frontend/src/features/train/logic/planner.ts`;
  presets/splits `frontend/src/data/train/train.ts:1130-1146`.
- Bug locus: `frontend/src/features/train/logic/setBudget.ts:133-191`
  (`budget = workingSets / tierTargetOf(tier)`),
  `musclePriorities.ts:41-45` (Emphasize→MRV … Maintain→MEV),
  display `SetBudgetCard.tsx:37-44`; priorities deliberately excluded from program
  regeneration (`MesocyclePlannerPage.tsx:87-89`, AD6).
- Backend engine already present: `application.yml:1471-1489` (`mezo.volume` baselines,
  step 2, deload 0.5), `VolumeProgressionService.java:79-156` (seed + rollover),
  `VolumeDecider.java`, `PriorityTier.java:29-31` (tier→ceiling),
  `SetRecommendationService`, `TrainService.stampRun` (:197-265).
- Gemini seam: `feature/companion/llm/GeminiCompanionLlm.java` + `*LlmAdapter` pattern
  with Fakes; LLM logging via `feature/llmlog`.
- Pages: `MesocycleLibraryPage`, `MesocycleBuilderPage`, `MesoOverviewPage`,
  `MesoTemplatesPage`, `MesoTemplateEditorPage`, `MesoReportPage`, `MesoComparePage`;
  shared `MesoEditor.tsx` (muscleBudgets at :66).
- Traps: contract-drift gate (generated DTOs), CODEMAP gate, ArchUnit layers,
  Testcontainers for full backend suite, `VITE_USE_MOCK` dual-mode, visual goldens on
  `/train/gym` & `/train/session`, priorities' three mount points + carry ITs
  (`MusclePrioritiesCarryIT`, `GoalPresetCarryIT`), two coexisting FE volume models
  sharing `setBudget.ts`, `goalPreset` consumers (`exerciseDefaults.ts`,
  `MesoAdherenceDetector`).
- Docs: `docs/features/train.md` §2/§4/§10, ADR-0027, research pages
  `docs/research/concepts/{program-design-rules,set-volume-landmarks}.md`.
