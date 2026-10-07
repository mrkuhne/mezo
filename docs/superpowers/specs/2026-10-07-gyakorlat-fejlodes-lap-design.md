# Fejlődés-lap: per-exercise progress chart, reachable mid-workout

- **Issue:** `mezo-a8kcs`
- **Date:** 2026-10-07
- **Status:** design approved by the owner in chat (2026-10-07); prototype awaiting OK
- **Prototype:** `docs/design_2.0/prototypes/elo/edzes.html` — the `prog` sheet (side panel →
  "Legutóbb változott"), `#review/gyak`, `#exercise`

## Problem

The owner asked for "a chart where you can see how you progress in a given exercise", and looked
for it **during a workout**. A curve already exists (`ExerciseStoryPage` → "Az erőd íve",
`StrengthCurve`), but in practice it is invisible:

1. **Hidden.** The only door is Edzés → Gyakorlatok → a catalogue card. Nothing links to it from
   the active workout or the workout review.
2. **Empty for many exercises.** It plots e1RM only. e1RM needs a weight and at most 12 reps
   (`OneRepMax.eligible`). In production 69 of 366 working sets are above 12 reps and 84 have a
   zero or null weight, so many isolation and bodyweight exercises have no curve.
3. **Mute.** No axis, no tap-to-inspect, no deload or mesocycle context (a deload week reads as an
   unexplained dip), one metric.

Real history is thin: it starts 2026-08-24, about 20 sessions, typically 2–8 points per exercise.

## Owner decisions (2026-10-07)

| Question | Decision |
|---|---|
| Scope | Door + a proper chart. **No** stall / plateau detection, no forecast (`mezo-88iwa.15` stays separate). |
| Where it opens mid-workout | A **bottom sheet** over the workout, from the per-exercise records glass. Dismissing it returns to the exact place. |
| Views | **Two**: *Erő* (e1RM) and *Legjobb sorozat* (top set). No volume view. |
| RIR | Shown at the tapped point; **not** folded into the estimate, so the number matches the existing records. |

## Design

### Entry points

- **Active workout:** the records glass (`WorkoutRecordsGlass`) gains a first row "Fejlődés"
  (trend icon, one-line summary, mini sparkline, chevron). Tapping it closes the glass and opens
  the sheet. The glass's closing sentence that says there is no trajectory chart goes away.
- **Workout review, exercise view** (`ExerciseReview`): the same row, under the stat strip.
- **Exercise story page:** the "Az erőd íve" section renders the same chart inline in its glass
  card (toggle, chart, read-out), followed by an open "Alkalmak" list of every session.

One chart component serves all three; the sheet and the page differ only in their wrapper.

### The sheet, top to bottom

1. Header: muscle chip, eyebrow "FEJLŐDÉS · <izom>", exercise name, close.
2. Hero: the current value (latest session) as a large numeral, a delta chip against the first
   point, and "<first date> óta · N alkalom".
3. Segmented toggle: **Erő** / **Legjobb sorozat**, with one explanatory sentence under it.
4. Chart (hand-rolled SVG, time-spaced x-axis):
   - three or four horizontal gridlines with value labels on the right; first and last date below;
   - every session is a dot; the line breaks on gaps exactly as `StrengthCurve.splitOnGaps` does;
   - the **record** point is gold; the selected point has a halo and a vertical guide;
   - a **deload week** is a faint vertical band labelled "PIHENŐHÉT";
   - a **mesocycle change** is a dashed vertical rule with the plan's name above each segment;
   - in *Legjobb sorozat* the line is the weight and a small "×reps" label sits above the points
     (all points when there are at most six, otherwise only the selected one);
   - each point's tap target is the full-height column around it.
5. Read-out of the selected point (default: the latest): date, "kg × reps", RIR tag, "rekord" /
   "pihenőhét" tags, and "becsült erő X kg · N ismétlés maradt a tartalékban".
6. "Legutóbbi alkalmak": the last five sessions, newest first, as open hairline rows; tapping a
   row selects that point.
7. "A gyakorlat teljes oldala" → the story page.

### View rules

- **Erő** = best eligible e1RM of the session, through `OneRepMax` (Epley, reps ≤ 12, weight > 0).
  It is the default when available.
- **Legjobb sorozat** = the session's top working set: the set with the best e1RM when any set is
  eligible, otherwise the heaviest, ties broken by reps. For a bodyweight exercise (no set with
  weight > 0) the value plotted is the reps and the unit is "ism.".
- **Fallback:** Erő is offered when at least half of the sessions have an eligible set. Otherwise
  the Erő button is disabled, the sheet opens on Legjobb sorozat, and the sentence says why
  ("12 ismétlés fölött…" / "Súly nélküli gyakorlatnál…").
- **Y-axis** spans at least 15% of the peak value, so a small wobble never looks like a crash.
- **States:** no session → a dashed empty card with one honest sentence; one session → the dot,
  the read-out and "a következő után lesz belőle vonal"; loading → a layout-matched skeleton;
  error → the shared error line with retry.
- **Motion:** the line draws in once on open and on a view switch, dots fade in after it; the
  reduced-motion branch shows the final state. No forecast, no dashed projection.

### Data

A richer per-session point, derived on read (ADR 0016, nothing materialised), from a new pure
class beside `E1rmSeries`:

```
ExerciseProgressPoint { date, topWeightKg?, topReps, topRir?, e1rm?, deload, mesocycleId?, mesocycleName? }
```

- Served by a **new per-exercise endpoint** `GET /api/train/exercise-records/{key}/progress`
  (key = the existing identity key), loaded when the sheet or the story page opens. The
  all-exercises records call the active workout already makes stays as it is.
- `deload` and the mesocycle tag come from the session's mesocycle and its date against the
  mesocycle start, as `MesocycleReportService` derives the week. Custom workouts carry no tag.
- Same 52-point cap and oldest-first, pre-rounded wire as `e1rmSeries`.
- Skipped sets are excluded. The same change makes `ExerciseRecordService` exclude them too
  (`mezo-za09c`), so records and chart agree and the story page's reconciliation code can go.
- Per-side sets (`side` L/R/B): the top set is chosen across all rows; a left and a right set of
  the same weight are one top set, never summed.
- Identity is unchanged: a swapped-in exercise has its own history.

### Out of scope

Time-range selector, volume view, RIR-adjusted estimate, plateau detection, forecast, merging the
history of substituted exercises, lb units.

## Prior art

Researcher report, 2026-10-07 (five sources).

- **Built With Science+** ([App Store](https://apps.apple.com/us/app/built-with-science/id6446000532)):
  a per-exercise chart could not be confirmed. Verified: exercise history list, personal records
  shown under it, and a text progression cue for the next session. *Adopted:* history list and
  records next to the chart. The next-session cue already exists here (the proportional step).
- **Hevy** ([features](https://www.hevyapp.com/features/gym-performance/)): chart with a metric
  toggle, time ranges, records, then a per-session history. *Adopted:* the layout (chart → records
  → sessions). *Rejected:* five toggles and time ranges (one user, six weeks of data); the
  population "strength level".
- **FitNotes** ([progress tracking](http://www.fitnotesapp.com/progress_tracking/)): max weight at
  a rep count and rep-max records, no formula. *Adopted in spirit:* Legjobb sorozat shows real
  weight and reps for exercises the estimate cannot cover.
- **MacroFactor Workouts** ([help](https://help.macrofactorapp.com/en/articles/344-viewing-exercise-performance-over-time)):
  estimated 1/3/10-RM charts. *Rejected for now:* a second estimate would disagree with the
  existing records.
- Researcher's inference (unsourced): volume load mostly tracks set count, which a mesocycle ramps
  and deloads by design — a sawtooth. *Hence no volume view.* No app documents RIR handling.

## Codebase terrain

Investigator report, 2026-10-07. Only the **train** block is touched.

- **FE homes:** `features/train/pages/ExerciseStoryPage.tsx` (section at `:319`, reconciliation
  `:141-186`), `components/StrengthCurve.tsx` (to be superseded; keep `splitOnGaps`),
  `components/WorkoutRecordsGlass.tsx` (mounted in `ActiveWorkoutPage.tsx:1146`),
  `components/ExerciseReview.tsx`, `logic/recordFor.ts`, `logic/exerciseLibrary.ts`.
- **BE:** `ExerciseRecordService` (`:47-162`), `E1rmSeries`, `OneRepMax` (the one formula home),
  `ExerciseRepository.findIdentityRowsIncludingDeleted`, `ExerciseSetEntity`,
  `WorkoutSessionEntity` (no week column), contract `api/feature/train/train.yml:741`.
- **Patterns:** derived not stored; one formula home; gap not zero; oldest-first pre-rounded wire;
  FE logic in pure `logic/*.ts`; `InfoButton` beside section heads; hooks via `@/data/hooks`;
  hand-rolled SVG (no chart library); üveg bible §5–§6; CSS in `styles/prototype.css` (base
  `.gy-*` block and the Üveg override must both move).
- **Mirror for both FE modes:** `train.yml` → `api.gen.ts` → `trainApi.ts` → mock fixture in
  `data/train/train.ts` → MSW handler (`test/msw/handlers.ts:1290`) → tests.
- **Traps:** thin data (design for 2–8 points); bodyweight rows return `weightKg: 0`
  (`mezo-7hzf`, treat `> 0` as weighted); Dead Hang logs seconds as reps (no timed flag — it will
  read as "ism."; accepted); weighted pull-up/dip store only the added load; point date uses the
  latest set instant (use Europe/Budapest explicitly); open unfinished sessions count; four FE
  Epley copies exist — add none; no layout spec covers the story page (add one for 320px); the
  csepp re-skin (`cseppesites` C3/C4) will restyle these surfaces later, so the sheet stays quiet:
  one glass (the sheet), open rows inside.
- **Stale:** the living prototype's `#exercise` curve did not match production (index-spaced,
  eight points); this change replaces it.
