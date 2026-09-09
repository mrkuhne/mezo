# Titanium workout → weekly load flow

Driving issue: mezo-ceci. User approved implementing the first dominant flow after reviewing
[contextual navigation](2026-09-09-titanium-navigation-demo.md). This is an isolated visual and
interaction prototype under `prototypes/companion-titanium`, not a production feature change.

## Approved scope and design

The first detailed flow is Edzés Mai → active workout → explicit review/finish → weekly load.
Train's [living feature documentation](../features/train.md), especially active execution and
completed-workout semantics, guides the flow. Existing four-ring companion geometry and motion
are unchanged. On Mai the compact companion precedes a custom SVG bench/barbell illustration,
three-exercise lineup, and context tiles for sleep, food and tomorrow's volleyball.

Active execution takes over the phone surface and hides the global chrome. It prioritizes
weight/reps steppers, direct numerical entry, RIR, the prior prescription, a short coach cue,
nine progress ticks and free selection among three exercises. Existing set rows are editable.
Logging starts a wall-clock rest countdown; it can be skipped and continues across temporary
leave/return. The main session clock includes time spent outside the workout surface.

A user can finish after any positive number of sets. Summary is a separate, reversible step;
only explicit finish marks the session complete. The closed summary shows count, reps,
entered-kg × reps volume, a per-exercise set map, optional note and an animated reward symbol.
The demo XP estimate is ten per logged set, derived once from state rather than an award event.
Closed sessions cannot be edited; re-entering opens their review.

Weekly load is derived from explicit sample baselines plus today's closed working sets.
It distinguishes solid completed bars, dashed planned bars and sample target bands. Muscle
rows open a source explanation. Volleyball's estimated involvement is separate and never
converted into gym sets. Sleep remains directly reachable. The Train log page reflects the
current session status and actual logged totals.

## Implementation and limits

- `workout-state.js`: bounded set writes, summary metrics, explicit idempotent finish, load rows.
- `workout.js`: full-phone flow, stepper/edit actions, timer, training landing/load/log renderers.
- `workout.css`: gym illustration presentation, set console, history, reward, layered load bars.
- `navigation.js`: delegates detailed Train pages and both manual/command workout opening.

All data stays in memory and reload resets it; this differs deliberately from production's
hard-reload resume. The desktop “Mintanap újraindítása” also clears this demo workout.
The workout takeover is a local phase, not a separate hash route; its back button returns to
the surrounding page. No real API, AI or reward award call runs. Weight/sport quick-log forms
remain the earlier feedback-only demos. No warmup logging, set deletion, real exercise media,
rest audio, persistent storage or full hypertrophy engine is added. Three sets per exercise
are the bounded example; the six-week plan itself remains a detail demo.

## Verification

Two new state tests first failed for the missing module, then passed. They cover set edits
without duplication, invalid input without mutation, no empty finish, weekly load only after
explicit finish, repeat finish without doubling and rejection of post-finish writes.
All six prototype tests and both Vite entry builds pass. The existing >500 kB Three.js warning
remains. No production frontend/backend source changed.

At 390 × 844, manually exercised start, set logging, editing first weight to 62.5 kg, leave and
resume, all nine sets, explicit finish and navigation into load. Browser showed 9 sets,
96 reps, 4,045 entered-kg × reps, +90 demo XP; load became 36 total (27 baseline + 9), with
Mell 9/12, Hát 12/14, Váll 7/8 and Láb 8/12. Reviewed screenshots of the active console,
closed summary and load page. Browser snapshot verified the countdown begins at 2:30.
