# Training exploration coverage — mezo-88jw.3

This is the Training slice of the two approved Design 3.0 prototypes. It changes no production feature, API, or contract. Both variants use the original warm neutral Mérték tokens. Companion adds narrative openings while retaining the same direct training tools.

## Source evidence and adaptation

Orientation started with [CODEMAP — train](../CODEMAP.md#train) and [growth](../CODEMAP.md#progression), then [Train §2 and §10](../features/train.md) and [Growth §2 and §10](../features/growth.md). Representative source reviewed: `EdzesHubPage` behaviour documented in Train; `MesocycleBuilderPage.tsx` status-first cycle overview; `RunningBlockBuilderPage.tsx` editable running blocks; `ExerciseImage.tsx` paired frames; `VideoDemo.tsx` opt-in external embeds; `data/train/train.ts` fixtures and muscle vocabulary.

| Area | Existing source behaviour | Exploration adaptation |
|---|---|---|
| Training hub | Today hero and six navigable siblings | Upcoming gym action, today's sport, full gym/cycle/sport/running/exercise/medal destinations, crossload access |
| Gym | Day selection, workouts and completed history | Seven-day selector, exercise previews, history list and workout detail; active-workout CTA hands off to root `workout` |
| Mezocycle | Run library, status-first overview, week/day drilldowns and editable planning | Three-step goal/frequency/equipment/sport-load wizard; deterministic editable draft; activation archives previous cycle; week arc and day exercises; duplicate-to-draft |
| Sport | Multiple slots per day, sport-specific logging, notes, history and crossload | Full per-slot add/edit/delete, date/duration/effort/notes log, duplicate-slot protection and detailed history |
| Running | Block structure, sessions, manual logs and planned-versus-completed distinction | Goal/time/frequency builder; inspect/edit weekdays; activate plan; weeks/sessions/interval details; actual-distance logging and calculated pace; history |
| Exercise library | Two-image demonstrations plus opt-in video, muscle/search filters and records | Seven real local image pairs, accent-insensitive search, muscle filter, favorites, technique steps, manually playable two-image study and demo records |
| Medals | Train-specific derived record history, separate from Growth badges | Earned record collection and detail plus clearly identified prospective goal examples; no fabricated activity unlocks |
| Recovery | Sport/running crossload is currently a heuristic, not a live automatic volume engine | Transparent fixed-demo-week duration × effort comparison; personal sleep and Fuel links; contextual companion handoff |

The broad interaction references are applied structurally: Hevy's fast workout entry, Strava's navigable activity history, Nike's build–inspect–activate–support sequence, and Bevel's combined recovery view. No third-party screens or assets were copied from these products.

## Routes and integration

`TrainFlow.jsx` exports default `TrainFlow({page,api})` and `TRAIN_ROUTES`. All new keys use `train-`; the hub remains `train`.

- Hub and gym: `train`, `train-gym`, `train-gym-detail`.
- Mezocycle: `train-cycles`, `train-build`, `train-draft`, `train-cycle`, `train-cycle-week`, `train-day`.
- Sport: `train-sport`, `train-sport-schedule`, `train-sport-log`, `train-sport-detail`, `train-recovery`.
- Running: `train-running`, `train-run-build`, `train-run-preview`, `train-run-plan`, `train-run-session`, `train-run-log`, `train-run-detail`.
- Catalog and medals: `train-exercises`, `train-exercise`, `train-medals`, `train-medal`.

Cycle detail uses `id`; week uses `id` and `week`; day uses `id` and `day`. Sport log optionally accepts `slot`. Running session accepts `id`, optional `plan` and `week`; running log optionally accepts `plan` and `session`. Other details use `id`. Parent navigation is root-owned. Explicit invalid IDs show a recovery path; cycles/running plans default to the active plan only when no ID is supplied. Hub sport and running links derive from the saved schedules/plans and open an existing same-date log when available.

State is rooted at `api.state.training` and seeded with `createTrainState()`: `cycles`, `draft`, `schedule`, `sportLogs`, `runPlans`, `runDraft`, `runLogs`, `favorites`, `medals`, and `gymHistory`. Reducers update immutable slices. Cycle activation emits a local notification. Crossload optionally reads `api.state.personal.sleep.latest.minutes`. Cross-domain routes are `workout`, `week`, `sleep`, `fuel`; contextual discussion uses `api.ask`.

## Media provenance

Fourteen JPG files in `prototypes/public/train/` are byte-for-byte copies of seven already-vendored start/end pairs in `frontend/public/exercises/`: barbell bench press, neutral lat pulldown, barbell squat, Romanian deadlift, lateral raise, seated cable row, and dumbbell bench press. Their source is the public-domain/Unlicense **yuhonas/free-exercise-db** dataset, documented by [Train — demo stills](../features/train.md) and [ADR 0020](../decisions/0020-vendor-public-domain-exercise-imagery.md). The existing hand-curated mapping in `scripts/data/exercise-image-map.json` establishes movement identity. No network asset fetch, new AI generation, or video generation occurred.

No local video files were found in the exercise asset directory. The UI explicitly labels its playable media **“Kétképes mozdulattanulmány · nem videófelvétel”**. Playback alternates only the two actual photographs; pause and manual frame switching work locally. The entire intermediate movement is never represented as a recorded video. Playback is opt-in; reduced-motion preference slows the alternation, and the manual toggle remains available.

## Verification and exact limits

The nine `node:test` state tests were written and observed failing before implementation. They cover equipment/frequency-aware drafts, retained edits through activation, immutable seeds, multi-slot replacement, invalid time/duration/effort, duplicate sport/run logging, pace calculation, independent running activation, accent-insensitive search, and advertised interval durations. The shortest-duration test exposed a 20-versus-15-minute interval sum; it was corrected and the suite rerun green. `TrainFlow.jsx` was independently transformed through Vite to check syntax before root route integration. All 25 Training routes were then server-rendered with representative IDs and drafts in both themes (50 renders) without component errors. Additional audit regressions cover strict record identity, edited/deleted/logged hub appointments and matching seed counts. Server rendering verified one actual completed set without fabricated exercises and eight invalid-detail guards. The integrated Vite build passed. Root performs final visual QA and interaction checks. The repository docs lint reported 62 clean, 2 warnings, 14 stale and 0 errors (exit 1); the stale findings identify existing committed production key files, and this exploration coverage page is outside its feature/research corpus.

This remains an intentionally local functional mock: no backend, GPS, real AI coach, automatic physiological analysis, live training progression, actual video, or production writes. The gym history, records, medals and base gym load are seeded examples. Three seeded gym sessions align with the current weekly narrative; their detailed breakdown is explicitly unavailable. Newly completed workouts render only the actual exercise/set snapshots stored by the root workout flow. New sport/run logs and derived pace/load really update local state. The recovery calculation uses the fixed September 7–13 demo week. The cycle closing week shows an illustrative halved volume; running weeks repeat their basic structure. Active workout is the root's shared sample session, not a generated draft's exercise list; the day handoff says this explicitly. Production support for cycle templates, archived reports, arbitrary custom exercise authoring, external video URL editing, running-plan deletion and automatic medal derivation is not represented by this exploration slice.
