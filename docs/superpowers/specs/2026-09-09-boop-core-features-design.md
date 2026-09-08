# Boop core feature mock implementation

2026-09-09 · mezo-88jw.10 · user explicitly requested complete core feature journeys inside the selected Boop design.

## Scope and approach

The isolated Boop prototype gains editable persisted domain state, all existing rich flow routes and additional goal/workout/mesocycle lifecycle pages. Production frontend/backend remain untouched. The documented user-facing behavior is the reference; backend computation, camera recognition and LLM inference are deterministic labeled simulations. Do not infer functionality from feature-doc implementation history: distinguish current surfaces from retired routes.

## Route and behavior coverage

| Area | Required journeys |
| --- | --- |
| Training | day/week, gym history/detail, exercise catalog/media/detail, active session with kg/reps/RIR, rest, save/resume/finish/review, sport and running schedule/log/detail |
| Mesocycles | library, planning/draft edits/activation, run detail, day, week/muscle, template library/start, close/report/rerun/compare |
| Food | diary, text/photo/barcode/manual mock input, review/edit portions, save/edit/delete meal, AI score dimensions/provenance, pantry/stock/recipes/cooking/shopping/settings |
| Weight/sleep | overview/trend, dated create/edit/delete, history, goals/sleep timing/settings present in existing rich flows |
| Goals | weight goal, life goals, creation/detail/edit, pillars, progress/manual signals, archive/restore |
| People | list/search, relationship views, person detail/edit/archive, contact log, shared event |
| Patterns | lifecycle filter, detail/evidence, feedback/confirm/reject, experiments and related source links |
| Knowledge | search/filter, fact detail/edit/enable/disable, categories/relationships, communication preferences, source links |

## Navigation and state

One Boop shell, one shared chat, one persisted state. Detailed routes are hash-addressable under their domain and carry IDs. Main tabs retain their meaning; detail pages render one heading, back returns through actual browser history, opening chat preserves the detail below it. Field mutations update domain summaries and subsequent reads. Existing presence-only saved data migrates additively. Preserve earlier comparison studies.

## Execution and verification

Track work in Beads: inventory → shared route/state adapter → core flow integration → missing workout/goals/mesocycle depth → visual integration → end-to-end verification. Add meaningful state tests before implementation. Verify all registered views render, exercise write/read/reload and back/chat paths in the browser, test both 430 and 360 px frames. Keep a coverage guide with production references and simulation boundaries. Existing prototype tests/build, doc lint errors-only, CODEMAP and diff gates must pass. Commit and push a draft PR; no production migration.
