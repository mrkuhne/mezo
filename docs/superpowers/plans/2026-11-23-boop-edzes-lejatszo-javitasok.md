# Boop Edzés — the player fix bundle (mezo-r36n9.147)

**Owner report 2026-11-23**, ten items on the workout player and the Ma card. Decisions taken the same day:
reorder during a running workout is **allowed**; the weight/reps input becomes a **finger-draggable scale** with
**0.5 kg** steps (reps by 1); no exercise has history yet, so a missing target weight on the first session is the
expected state, not a bug.

Session: `edzes-player-fixes`, branch `feat/edzes-player-fixes`, worktree `/Users/daniel.kuhne/mezo-edzes`.

## Findings (code reading, 2026-11-23)

| # | Owner's words | Cause | Fix |
|---|---|---|---|
| 1 | block edited, started workout unchanged, technique not saved | `EdzesStore.today` cached up to 36 h, never force-reloaded after a day save; the session is a snapshot of that cache. Server: `replaceDayExercises` refuses any non-aligned list with 409 while the day's workout runs, so a reorder + technique save fails together | reload today after a day save and on start; merge a fresh plan into the running session (`WorkoutSession.apply`); server saves a pure permutation in place (ids kept); builder's running day allows reorder + settings |
| 2 | change the exercise, not just push it to the end | „Végleg lecserélem másikra" is a **today-only** swap (`scope: .TODAY`); label misleads | menu: „Ma mást csinálok helyette" (today) + „Lecserélem a blokkban is" (`.MESO`) |
| 3 | note: keyboard stuck, cannot save | no Kész, vertical TextField, no `.workoutNote` ever enqueued (the kind, payload and sender exist) | Kész + focus; send the exercise note when the sheet closes |
| 4 | previous set's weight not carried | `loadCurrent` resets to the plan's target (or nothing) every set | `WorkoutSession.prefill`: warm-ups and the first working set from the plan, later working sets from the previous working set |
| 5 | scroll/wheel input | +/− stepper | `NKScale` draggable ruler, 0.5 kg / 1 rep, plan mark, typing kept |
| 6 | recommended weight not shown | the plan value is the big number with a faint TERV tag and disappears once touched; nil on first sessions | persistent „Terv: …" line; „Ehhez még nincs ajánlás" when nil |
| 7 | reps start at 4 | the warm-up ladder (1 warm-up = 4 reps @70 %) and a small pill | big warm-up label with its reps; no made-up weight |
| 8 | no RIR in correction | sheet has only kg + reps | reserve stepper; edit payload already carries `rir` |
| 9 | X, X, X+Y → new target? | engine references the **heaviest** set | no change; documented |
| 10 | Ma shows „Indítás" after finish | card reads `brief.day.session.done`; nothing reloads the brief; the finish waits in the outbox; local session deleted; no result view | flush now + `onSent` tick → reload brief + today; done from today/last result too; keep the last finished session for „Megnézem" |

## Kész, ha…

- [ ] (a) note sheet: Kész button, keyboard dismisses, the note reaches the server as the exercise's durable note
- [ ] (b) prefill rule unit-tested in `WorkoutSessionTests`; label says TERV / ELŐZŐ
- [ ] (c) „Terv: … kg × … · tartalék …" stays under the pads; „Ehhez még nincs ajánlás" when the plan has no weight
- [ ] (d) warm-up sets carry a big label with their reps
- [ ] (e) correction sheet has a reserve stepper; the edit reaches the server
- [ ] (f) today-only and whole-block swap both in the menu and working
- [ ] (g) finish → flush, reload brief + today; Ma card „megvolt" + „Megnézem" opens the day's result; room menu and wall card agree
- [ ] (h) day save reloads today; start reloads today; running session merges order / set counts / technique (unit-tested) without losing logged sets
- [ ] (i) server: permutation in place while running; IT + ArchitectureTest green with Testcontainers
- [ ] (j) builder's running day: reorder + settings allowed; add/swap/delete locked; lock line reworded
- [ ] (k) `NKScale`: drag, 0.5 kg / 1 rep, plan mark, typing; shown to the owner in the simulator
- [ ] (l) `xcodebuild test` BoopKit + Boop green; `gen-codemap`; `lint-docs` 0/0
- [ ] (m) docs (`boop-ios.md`, `train.md`), handbook `07-edzes/03`, `16`; `_jegyek` / `_kiadasok` / `_dontesek`; Notion check 0
- [ ] (n) merged to main; backend deployed; app on the phone
