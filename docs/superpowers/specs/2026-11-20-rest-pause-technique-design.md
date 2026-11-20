# Rest pause — a fixed 20 + 4×5 technique (short design)

Date: 2026-11-20 · Epic `mezo-r36n9` · Size: small change (short design; spec + plan folded into one owner OK,
CLAUDE.md §Owner gates). No simulator spike: the picker gains one row in an existing list, nothing new to look at.

## Intent
The owner trains a fixed rest-pause scheme and wants it as a technique he can pick: **20 reps, then 10 s rest + 5
reps, four times** (20 + 5 + 5 + 5 + 5). The existing *Myo set* is close but adaptive (20 s rest, stops when a
mini-set falls under 3) — he wants his fixed version beside it, named **„Rest pause"**.

## Goals
- A fifth owner-pickable technique `rest_pause`, shown as „Rest pause" in the technique picker of the block builder
  and the running block, with the same eligibility as myo (stable, judged exercises only — `TechniqueRules`).
- Picking it makes **the whole exercise 20 reps** (owner, 2026-11-20: "az egész gyakorlat 20"): rep range 20–20 for
  every working set, not only the technique set.
- In the workout player: the last working set is the 20-rep main part, then four mini-sets of 5, each after a 10 s
  rest countdown. **Fixed:** a short mini-set does not end the run; only „Elég volt" does.
- Logged, shown in the diary and counted exactly like the other technique sets (one set; excluded from detectors).

## Non-goals / anti-goals
- The planner never places it (`TechniquePlanner`), the AI refiner may not set it (`TechniqueMerger` /
  `TechniqueLlmAdapter` allow-list unchanged), the recommender never suggests it. Owner pick only — like drop/partials.
- Myo set is unchanged.
- Removing the technique does not restore the old rep range (it stays 20–20; he edits it like any row). Builder call.
- Failure: a 20 that silently becomes something else, or a mini-set auto-stop he did not ask for.

## Approach (picked)
Reuse the myo machinery — a new enum value whose prescription is four `MINI` legs with **no `minReps`**:

| Option | Trade-off |
|---|---|
| **New `rest_pause` technique on the existing leg model (picked)** | Small: enum + config + prescriber case + one DB check-constraint change + picker row. The player already runs mini-sets and only auto-stops when `minReps` is set. |
| A "fixed" flag on myo | One technique would mean two different things; the owner asked for a separate named one. |
| Retune myo to 10 s / no stop | Changes an existing, live feature; owner wants both. |

## Design
- **Wire / DB:** `Technique.REST_PAUSE` (`rest_pause`) in the backend enum, OpenAPI `Technique` enum, iOS
  `SetTechnique.restPause`; Liquibase changeset widening `ck_exercise_technique` and `ck_exercise_set_technique`.
- **Config:** `mezo.train.technique.rest-pause: { main-reps: 20, main-reserve: 0, mini-reps: 5, mini-rest-sec: 10,
  minis: 4 }` (`TrainTechniqueProperties.RestPause`).
- **Prescription (`TechniquePrescriber`):** main part target reps = `main-reps` (20), RIR = `main-reserve`; four
  `MINI` legs at the main weight, `reps 5`, `restBeforeSec 10`, `minReps null`, `toFailure false`. Challenge
  half-reps after it work as for myo. `TechniqueRules.allowedLegKinds(REST_PAUSE) = {MINI}`.
- **The 20 reps:** server-side on every technique save (block builder save, running-block exercise edit, template):
  when the technique is `rest_pause`, set the row's `repMin = repMax = 20` (config `main-reps`). The iOS draft editor
  mirrors it on pick so the row shows 20 at once. Server is the source of truth.
- **Player:** no logic change expected — `logLeg` only ends early when `minReps` is set; verify by test.
- **Copy (iOS):** name „Rest pause"; about „20 ismétlés, aztán 10 mp pihenő és 5 ismétlés, ezt négyszer. Fix menet,
  nem áll le magától."; steps „20 ismétlés" · „10 mp pihenő" · „5 ismétlés, négyszer". Picker icon: reuse the myo
  glyph unless the kit has a fitting one (builder call).
- **Docs:** handbook `07-edzes/15-technikak.md` table row + feature doc + `_jegyek.json` / `_kiadasok.json`.

## Left to the builder
Exact place of the rep-range rewrite in each save path; icon; test names. Main RIR 0 vs 1 (default 0: the 20 is the
hard part).
