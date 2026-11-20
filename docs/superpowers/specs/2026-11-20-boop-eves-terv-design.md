# Boop Edzés — the year plan (éves terv) and the plan recommender (tervajánló)

**Issue:** `mezo-r36n9.113` (re-filed owner decision #49, „Kerüljön a meglévőbe”; scope grown 2026-11-20).
**Status:** design — **owner OK 2026-11-20** („Jóváhagyom”). Next: simulator spike → plan. Then: simulator spike (owner OK) → plan (owner OK) → build per slice.
**Sources:** `docs/research/queries/muscle-ladder-train-fact-check-audit.md` §2.1/§2.5; the owner's own hand-made
year plan (a local HTML file, "ATLAS 4.0", reviewed 2026-11-20 — used as a *pattern*, never copied as content).

## 1. Intent — why

The owner does not know whether a block he builds is right "for growth": enough sets per session and per week, not
too many, enough rest, the right number of exercises, where the overdoing starts. He wants it *scientifically sound
from every angle* — and wants to **see why**. He also plans a year ahead (his ATLAS file: 52 weeks, 8 × 6-week
focus blocks + consolidation) and wants **a full year plan in the app that he can follow**.

Reviewing his hand-made year plan proved the point: the frame was sound (rotating focus, a light 6th week, no muscle
on two consecutive days) but the detail had exactly the failures he worries about — shoulders at 0 hard sets in all
four leg blocks (24 weeks a year), calves ~0 all year, back at 2–3 sets for 36 weeks, focus muscles only 8–11 sets
(trained-lifter evidence: 12–20), Wednesday/Friday sessions of 4–6 sets at 4 RIR (not hard sets), a 4-week
near-zero consolidation. A machine that builds *and checks* every block fixes that class of error.

## 2. Owner decisions (2026-11-20, this brainstorm)

1. **Boop proposes the plan** (not "start from the previous block"): 2–3 candidate splits with estimated time and a
   "why"; he picks, then edits in the existing builder.
2. **Boop generates year plans** (rotating focus blocks); his ATLAS is a pattern, not an import.
3. **Year map up front, detail at block start**: the year shows which block, which focus, when the light weeks are;
   exercises and sets are built when a block starts, from his latest state.
4. **Own year map on the server** (not pre-generated block drafts, not "next block only").
5. **Four slices in this order:** S1 smarter block building + checking → S2 new block on the phone → S3 the year
   map → S4 following it.
6. **A new block attaches to the active season** (not "every block a new season").
7. **The year ends with a 2-week light maintenance block** (not a free week, not the ATLAS 4 near-zero weeks).
8. **Tier budget:** the time budget limits how many groups can be Építés/Hangsúly, and at most 2 are Hangsúly
   (not fixed counts, not warnings only).

My calls (stated to the owner, not objected to — confirm at the spec OK):
- **No experience-level question.** Single user, trained; the engine's one (RP intermediate) landmark table stays.
  Making experience real would mean a stored column threaded through every band reader (ledger, weekly proposal,
  tier proposal, evaluator, goal guard) for an answer that would never change.
- **The time limit picks the split, it never silently cuts weekly volume** (Fitbod's drop-exercises-to-fit clashes
  with a block's weekly target). Over-time is shown, the candidate ranks lower.
- **The AI refinement runs once, on the chosen candidate** (candidates are deterministic skeleton + filler).

## 3. Goals, non-goals, anti-goals

**Goals**
- G1 A new block can be started on the phone (today impossible: the builder only edits a running/planned block).
- G2 For the same days/goal, 2–3 split candidates, each with per-session minutes (rest included), a recommended one,
  and a short why / why-not.
- G3 Every muscle in the builder carries its *why*: weekly sets vs band, what the band is and where it comes from.
- G4 A 52-week year map: block order, each block's focus (1–2 muscle groups), length, light week, consolidation; a
  year view on the phone showing where he is.
- G5 At a block's end the next block comes from the map (pre-filled intake); a late start / skipped block re-dates the
  rest of the map.

**Non-goals**
- The food / meal side of the ATLAS file; the plyo module content (the sport load stays the existing
  `sportGroups` volleyball rule).
- Pre-built exercise detail for future blocks; an AI-written year plan (the rotation is deterministic in v1).
- Copying any of the book's 20 programs, images or exercise texts.
- The web frontend (retired, #52).

**Anti-goals (a failure even if it "works")**
- Any generated block where a trained muscle group gets 0 hard sets per week (the Tartás band floor is
  `ceil(mev/3)` — never bypassed).
- A candidate or year plan shown without its reason.
- Weekly volume quietly lowered to fit the minutes.
- A number on the phone that the phone computed (bands, minutes, ranks are the server's).

## 4. Approaches considered (owner picked A)

| | Approach | Trade-off |
|---|---|---|
| **A** | **Year map as its own server object**; each block generated from it at block start (focus → Hangsúly, rest → Tartás) | Most work; the only one he can follow and re-schedule |
| B | Pre-generate 8–9 block drafts today, chained | Faster; a skipped week or focus change means hand-fixing every draft — the problem he rejected |
| C | No map; at each block end Boop suggests the next focus | Cheapest; no year picture, nothing to follow |

Within S1, candidates are a **new read-only server endpoint** (not the phone calling `generate` N times): one round
trip, no LLM cost per candidate, ranking stays on the server.

## 5. Design

### S1 — smarter block building and checking (server, plus the builder's rendering)

1. **Split catalogue** (config, `mezo.meso-plan.splits`, per training-day count). v1:

   | Days | Candidates (first = today's default) |
   |---|---|
   | 2 | Full ×2 |
   | 3 | Full ×3 · Upper / Lower / Full |
   | 4 | Upper / Lower ×2 · Full ×4 |
   | 5 | Upper / Lower / Push / Pull / Legs · Upper / Lower / Upper / Lower / Full · Push / Pull / Legs / Upper / Lower |
   | 6 | Push / Pull / Legs ×2 · Upper / Lower ×3 |

   `MesoPlanSkeleton` takes an optional split key; absent = today's `SPLIT_DAYS` (byte-identical). Every catalogue
   entry must keep the skeleton invariants (each group ≥ 2×/week, ≤ `session-cap` sets per group per session in
   week 1) — enforced by a table test over the whole catalogue.

2. **`POST /api/train/meso-plans/candidates`** (read-only, no persistence, no LLM). Request = the generate request
   (`daysOfWeek`, `weeks`, `priorities?`, `goalText?` ignored) + `sessionMinutesTarget?` + `sportGroups?`.
   Response: 1–3 candidates, each `{splitKey, splitLabel, template (MesoTemplateUpsertRequest, styled as generate
   does), evaluation (MesoPlanEvaluation), recommended, reasons[]}`. Each candidate's evaluation is the existing
   `PlanEvaluator` run in-process. **Only flawless candidates are offered (owner, 2026-11-21: „olyanokat generált,
   amikben már hiba van?”).** Hard filters (pure, tested): every trained group ≥ 2×/week; every day within the minutes
   target; no group with a *heavy* load on two consecutive calendar days (≥ `consecutive-heavy-sets: 4` hard sets on
   both days — a full-body split's 2–3 sets a day is not a recovery problem; high-frequency, volume-equated training
   shows no detriment). Survivors are ranked by (1) fewest muscles outside their band, (2) shortest longest day,
   (3) catalogue order; the first is *Ajánlott*. If **no** candidate passes, the response returns the closest one
   flagged `nothingFits` with the failed rule and what would fix it (`MORE_MINUTES {needed}`, `FEWER_EMPHASIS`,
   `MORE_DAYS`) — the phone says so plainly instead of offering a flawed plan. `reasons[]` on an offered candidate
   are only neutral or positive facts (`FITS_TIME {maxMinutes}`, `FREQ_2X`, `MORE_WARMUPS {perWeek}`, …); the phone
   owns the Hungarian copy.

3. **Generate takes `split?`** — the chosen candidate's key; the LLM refinement (when enabled) runs once on it.
   Absent = today.

4. **Minutes model v2** (`PlanEvaluator.day`): per working set `setSeconds + restSeconds`, where `restSeconds` is the
   exercise's prescribed rest when the plan is styled (balanced: 150 s compound / 90 s isolation; from the style
   stamp) and the flat `minutes-per-working-set` when unstyled; + warm-up sets × `minutes-per-warmup-set`;
   + `transition-minutes` per exercise; + `session-overhead-minutes`. New config keys under
   `mezo.volume.evaluator` (`set-seconds: 40`, `transition-minutes: 1`). The evaluate request already carries
   `trainingStyle`; the per-exercise rest comes from the same stamp the generator uses. The learned timing profile is
   **not** used in v1 (noted for later; it reads higher than the static formula).
   *Check:* a balanced 5-exercise × 3-set day ≈ 15 × (40+~120)/60 + warm-ups + 5 + 6 ≈ 55 min — inside Fitbod's
   logged 35–60 min for 5 exercises.

5. **The why per muscle.** `MuscleEvaluation` gains `basis` (`{tier, bandLow, bandHigh, source}` where `source` is a
   code: `LANDMARKS_RP`, `MAINTAIN_THIRD`, `SPORT_ADJUSTED`). Phone copy (Hungarian, with the references in the
   handbook page): Építés/Hangsúly bands = research-based landmark estimates (dose-response: Schoenfeld 2017; trained
   lifters 12–20 sets: Baz-Valle 2022); Tartás = about a third of the growth dose keeps size (Bickel 2011); sport-
   adjusted = the volleyball already trains these.

6. **Recovery spacing hint.** `DayEvaluation`/`MuscleEvaluation` flag a group with a heavy load
   (≥ `consecutive-heavy-sets` hard sets) on two consecutive calendar days (core/mobility exempt) — a hint in the
   builder (where his own edits can cause it), never a block; candidates with it are not offered at all.

7. **Tier budget (owner decision 2026-11-20, „Időkeret + legfeljebb 2 Hangsúly”).** The evaluation gains
   `budget {capacitySets, usedSets, emphasizeCount, emphasizeMax}`: `capacitySets` = how many working sets fit in the
   training days × `sessionMinutesTarget` under minutes model v2; `usedSets` = the plan's **peak (heaviest loading)
   week** total for the chosen tiers (the ramp grows Építés/Hangsúly, so the peak week must fit, not week 1);
   `emphasizeMax` = config `mezo.volume.bands.emphasize-max: 2` (book PDF 458–490 prioritisation; RP's warning
   against many priority muscles). The phone shows a „Heti keret” bar and **disables raising a tier** that would
   exceed the budget or the Hangsúly cap, with the reason; lowering is always allowed. Applies to the new-block
   intake **and** the running block's builder (its minutes pills supply the target). The server also rejects a
   generate/candidates request over the Hangsúly cap (400) — the budget itself is advisory on the server (a plan
   edited by hand may exceed it; the evaluator flags it).

8. **The builder** renders: the minutes per day (now with rest), the per-muscle *why* sheet, the consecutive-day hint.

### S2 — a new block on the phone

- Entry: the builder's "Nincs futó blokkod" screen gets **Új blokk**; later (S4) the "Következik" card.
- Steps: **Alapok** (weeks 4–8, muscle emphasis per group — the existing tier chips, session minutes 45/60/75/90;
  training days read from the active season's gym days, shown, not asked) → **Jelöltek** (the 2–3 candidate cards:
  split, ~minutes, recommended badge, why lines) → pick → generate (one LLM pass) → the **existing builder** on the
  unsaved draft → **Indítás** = create template + start (season gate: no season → the existing `SEASON_REQUIRED`
  copy with a way to the Évad page).
- Client: new hand-decoded operations in `PlanClient`/`PlanWire` (candidates, generate, create template, start) —
  not the generated client (strict enum decoding, boop-ios.md §4). `WireEvaluateRequest` gains
  `sessionMinutesTarget`.
- States: loading candidates, error/offline (retry), no season, generate failed (fall back to the candidate's
  deterministic template), smallest iPhone width, reduced motion.

### S3 — the year map

- **Data** (Liquibase): `training_year_plan` (id, user_id, start_date (a Monday), status `active|archived`,
  created/updated, soft delete) and `training_year_block` (plan_id, ordinal, weeks, focus (1–2 coarse groups),
  kind `upper|lower|full|consolidation`, planned_start, mesocycle_id nullable, status
  `planned|running|done|skipped`). At most one active plan per user.
- **Year generator** (pure, deterministic). Inputs: start date, a year emphasis (groups he wants more of; default
  none), block length (default 6 = 5 loading + 1 light, config 4–8), consolidation length (default 2 weeks, config
  1–2). Fill: as many full blocks as fit in 52 weeks before the consolidation; leftover weeks become a buffer before
  the consolidation (holiday / illness slack). Rotation: alternate upper- and lower-focus blocks; focus pairs from a
  config table of compatible pairs (e.g. back+biceps, chest+triceps, chest+shoulder, back+shoulder, quad+glute,
  ham+glute, quad+calf); every trained group is a focus at least once a year, emphasised groups twice; no group
  focused in two consecutive blocks.
- **Block from the map:** focus groups → Hangsúly, all others → Tartás (the band floor keeps every group above
  0); weeks = the block's length (the phase curve's last week is the light week); the user may still change tiers
  in the intake.
- **API:** `POST /api/train/year-plans/preview` (no persistence), `POST /api/train/year-plans` (create/activate),
  `GET /api/train/year-plans/active`, `PATCH .../blocks/{id}` (reorder, change focus, length), `POST .../archive`.
- **Phone:** a year view reachable from the Edzés room — the 52-week strip (blocks, light weeks, consolidation,
  "itt tartasz"), each block's focus, dates and status; create (preview → Elfogadom), reorder, change a block's
  focus. Look decided in the simulator spike.
- **Consolidation (owner decision 2026-11-20): a 2-week light maintenance block** — every group at Tartás, the band
  **low**, no ramp and no separate deload week; the year view shows the year review and offers the next year's plan
  during it. This needs a short-block path: `weeks` 2–3 allowed **only** for a consolidation block (the user-facing
  generate/start limits stay 4–8), with its own flat phase curve.
- **Seasons (owner decision 2026-11-20): a newly started block attaches to the active season.** The season always
  shows the running block; on a block change only the block is swapped (its `goal_plan_link` re-pointed), the goal
  and the food targets stay, and the season page's deload weeks / calories follow the new block. This is a season-
  side change (S4); the season gate itself is unchanged.

### S4 — following the map

- In the running block's last week (and when no block runs but a plan is active), the Edzés room shows
  **Következik: <block>** → the S2 intake pre-filled from the map (focus tiers, weeks; days from the season) →
  candidates → builder → start; the started mesocycle is linked to the year block (`running`, then `done` when it
  ends).
- A late start re-dates every later `planned` block; **Kihagyom** marks a block `skipped` and re-dates; the
  consolidation stays last.

## 6. Prior art (researcher, 2026-11-20)

- **Alpha Progression** (vendor guide, alphaprogression.com/en/blog/alpha-progression-guide): intake of experience,
  goal, priorities, days/week, approximate workout length; split "Automatic" (recommended) or a split valid for the
  day count; one editable plan. *Adopted:* the valid split set depends on the day count, a recommended default.
  *Beyond it:* we show 2–3 candidates with time and reasons side by side.
- **Fitbod** (help centre, help.fitbod.me/…/360004429814): duration 15–90 min; fits by changing exercise count;
  logged ranges 4 exercises 27–51 min, 5 → 35–60, ~7 for an hour. *Adopted:* the ranges as a sanity check of the
  minutes model. *Rejected:* dropping exercises to fit (conflicts with a block's weekly target).
- **RP Hypertrophy** (help centre hypertrophy.zendesk.com/…/32430129362327; reviewer report): pick from filtered
  templates; start near MEV and grow; warns against too many priority muscles. *Adopted:* start low, grow in the
  block (already our ramp); the year map limits focus to 1–2 groups per block.
- **Iversen et al. 2021, Sports Med** (pmc.ncbi.nlm.nih.gov/articles/PMC8449772): rest 1–2 min untrained / ≥2 min
  trained, shorter for isolation; specific warm-ups mainly for heavy loads; frequency matters less than volume.
  *Adopted:* rest-based minutes model.
- **Baz-Valle et al. 2022, J Hum Kinet** (pmc.ncbi.nlm.nih.gov/articles/PMC8884877): 12–20 weekly sets per muscle
  for trained men; small evidence base. *Adopted:* the "why" copy for Építés/Hangsúly; our RP bands sit in that range.
- No app found offers a year map of rotating focus blocks; the pattern is the owner's and the book's prioritisation
  chapter (PDF 458–490).

## 7. Codebase terrain (investigator, 2026-11-20)

- **Generator:** `train/service/MesoPlanGeneratorService.java:52` (no `@Transactional` on purpose — LLM round trip;
  default style stamped `:130`, `:152-170`), `MesoPlanSkeleton.java` (`SPLIT_DAYS` `:33`, `startSets` `:54`,
  `phaseCurve` `:109` always ends with a Deload), `VolumeBands.java` (Tartás `[ceil(mev/3), mev-1]`), the single RP
  intermediate table `application.yml` `mezo.volume.baselines`.
- **Evaluator:** `MesoPlanEvaluateService.java:66` (stateless, works for an unsaved draft; 400 when `phaseCurve.size()
  != weeks`), `PlanEvaluator.java` (`day()` `:184` flat minutes; `Input.sessionMinutesTarget` `:51`).
- **Contract:** `api/feature/train/train.yml` (`/meso-plans/generate` `:523`, `/evaluate` `:553`,
  `MesoPlanGenerateRequest` `:2762`, `MesoPlanEvaluateRequest` `:2792`, `DayEvaluation` `:2917`). Contract-first:
  edit the fragment → `cd api/generate && npm run generate:api` → `ios/scripts/sync-openapi.sh`;
  `scripts/check-ios-contract.mjs` covers raw `PlanClient` operation ids.
- **iOS:** `BoopCore/Train/BlockBuilderModel.swift` (phases `loading/noBlock/failed/ready`), `PlanClient.swift`,
  `PlanWire.swift` (`WireEvaluateRequest` `:104` lacks `sessionMinutesTarget`), `Boop/EdzesTerv/BlockBuilderPage.swift:50`
  (no-block screen), `PlanKit.swift:237` (`SEASON_REQUIRED` copy), `PlanPreview.swift` (DEBUG fixtures; its minutes
  formula lacks warm-ups), `Edzes/EdzesRoom.swift:124` (builder cover). Synchronized Xcode folders.
- **Season:** a block starts only inside a season (409 `SEASON_REQUIRED`); the season owns the gym weekdays and locks
  them while its block runs.
- **Traps:** skeleton invariants in `MesoPlanSkeletonTest`; strict enum decoding of the generated Swift client;
  ArchUnit layer subpackages and `feature_slices_are_cycle_free` (train → season only via `SeasonGatePort`); regenerate
  `docs/CODEMAP.md` after every merge; `MessageBundleParityTest` for new error keys; run ITs with
  `-Dmezo.test.use-testcontainers=true`.
- **Collision:** `mezo-r36n9.114` (coverage hints, design phase, another session) extends `PlanEvaluator`,
  `MesoPlanEvaluateService`, `MuscleEvaluation` in `train.yml` and `PlanWire.WireEvaluation` — the same files S1 #4–#6
  touch. **S1's evaluator work starts after .114 merges** (or by agreement with that session); S1 #1–#3 (catalogue,
  candidates, generate `split`) do not touch the evaluator and can go first.

## 7a. Builder-check calls (mine, 2026-11-20 — the owner checks them while reading)

- **`kind` only drives tiers.** An upper/lower block sets focus → Hangsúly, the rest → Tartás; the split still comes
  from the day count via the candidates. `kind` is `upper|lower|consolidation` (no `full`).
- **Re-dating:** "late" = the block starts more than 3 days after `planned_start`. A delay eats the buffer first, then
  shortens the consolidation to 1 week, then moves the plan's end past 52 weeks (the year view says so). A skipped
  block's focus is not silently lost: the year view shows "X idén nem kap fókuszt" and offers to put it on a later
  block.
- **Rotation conflicts:** the generator relaxes in this order — emphasised-twice → once, then the compatible-pair
  table — and the preview lists what was relaxed; it rejects (400) only an impossible input (no training days).
  The owner's own edits (PATCH) are always accepted; rule breaks come back as warnings, never refusals.
- **Linking outside "Következik":** a block started from S2 *Új blokk* while a plan is active links to the current or
  next `planned` year block when its `planned_start` is within ±14 days, else to none (the year view offers to
  re-date). Creating a plan while a block runs adopts that block as block 1 (focus = its Hangsúly groups). A block
  ended early → `done`; cancelled → `skipped`; both re-date the rest.

## 8. Left to the builder

Exact reason-code list and copy; the compatible-pair table and rotation tie-breaks; candidate card layout and year
view look (spike); whether the year view lives in the Edzés room or the Évad page (spike decides, default Edzés);
error keys and messages; the buffer-week placement detail.

## 9. Kész, ha… (per slice; the plan expands it)

- S1: candidates endpoint returns 1–3 ranked candidates for 2–6 days, every candidate passes the skeleton
  invariants; `split` absent → generate byte-identical; minutes model v2 within the Fitbod range for the reference
  day; `basis` and consecutive-day hints present; contract + IT + unit tests; ArchitectureTest; codemap; lint-docs.
- S2: a new block can be created and started on the phone end to end against production; every state (loading,
  error, offline, no season, generate failure) seen in the simulator; smallest width; reduced motion; no emoji, no
  "Mezo".
- S3: a year plan can be previewed, created, reordered and archived; every trained group is a focus ≥ 1× a year; no
  block leaves a group at 0 hard sets; year view in the simulator.
- S4: at the last week the next block is offered pre-filled; late start / skip re-dates; the started block is linked.
- Each slice: docs (`docs/features/train.md`, `boop-ios.md`), handbook page, Notion synced, merged, deployed, live
  check, installed on the phone.
