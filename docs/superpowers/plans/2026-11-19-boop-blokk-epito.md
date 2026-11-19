# Boop Edzés — block builder + weekly review (implementation plan)

> Issue `mezo-r36n9.83` (epic `mezo-r36n9`) · session `boop-blokk-epito` · branch `feat/boop-blokk-epito`.
> Specs: `docs/superpowers/specs/2026-11-17-train-volume-engine-v2-design.md` §6.6–§6.7 + §12,
> `docs/superpowers/specs/2026-11-17-train-style-and-techniques-design.md` §6.10 + §11.
> **The look is approved** (owner, rounds 1–7, 2026-11-17): `spike/boop-blokk-epito`,
> `ios/Boop/EdzesTervDemo/{BlokkDemoModel,BlokkDemoViews}.swift` (`-previewBlokk YES`, `-previewBlokkOpen epito|het`,
> `-previewBlokkTab napok|blokk`). The player half of that spike (`BlokkDemoPlayer.swift`, technique step card and the
> challenge) is **not** this slice — it is `mezo-r36n9.84`, after T3.
> Execution: inline, TDD for every `BoopCore` piece (StubTransport), screens ported from the spike onto the kit.

## Goal

The owner opens Edzés → Blokk on his real running block and can

1. **Build / adjust the block** — full-screen builder with its own three-way bar **Izmok · Napok · Blokk**, one
   primary button (*Igazítsd a sávba* while a muscle is outside its band, otherwise *Mentés*), the scope line in the
   head ("EGY HÉT · IZMONKÉNT" …). Every number on it comes from the server evaluator, not from Swift maths.
2. **Review the week** — Monday's proposal as the approved deck: one card per muscle, one tile per exercise change
   with its own accept / keep, *Mind elfogadom* / *a többi marad* per card, a "nem változik" card, a summary card;
   entrance card on the Blokk tab with **Átnézem** and **Elfogadom átnézés nélkül**.

## What exists on the server (no change needed)

| Need | Operation | Note |
|---|---|---|
| the running block, its days, exercises, sets, tiers, sport groups, style, techniques flag | `listMesocycles` (already in Boop) | `MesocycleResponse.days[].exercises[]` (`GymExercise`: `workingSets`, `muscle`, `countsTowardVolume`, `catalogId`, `technique`, `challenge`, `trainingStyle`, `effectiveTrainingStyle`) |
| bands, where he stands, the per-muscle proposal, caps, minutes, the six-week path, sport-group suggestion | `evaluateMesoPlan` (POST, read-only) | called with the **draft** after every edit (debounced 300 ms); `MuscleEvaluation.proposal` drives *Elfogadom* and *Igazítsd a sávba* |
| which techniques an exercise may carry | `getExerciseCatalog` (already in Boop) | stability + lengthened-friendly by `catalogId`; the server re-checks (400 on an unsafe pick) |
| save set counts of a day | `replaceDayExercises` (full list, carries style/technique fields the client omits) | only the days that changed; re-mints exercise ids (history is by identity — harmless) |
| save tiers + sport groups | `updateMesocycleMusclePriorities` | takes effect at the next weekly rollover; a changed band opens a `tier_change` proposal (S3) |
| set one exercise's technique / the day's challenge | `updateExerciseTechnique` | 409 while the block's techniques switch is off |
| the week's proposal, decide per line / the rest | `listWeekProposals`, `decideWeekProposal` | `muscles[]` (lineCount 0 = quiet), lines `sets|weight|reps` with `from`/`to`, 21 reason codes, `acceptRest` / `keepRest`; a repeated identical submit returns 200 |

All of them go into the Boop generator filter (`BoopAPI/openapi-generator-config.yaml`) in one late, isolated commit.

**T3 adds enum values in parallel** (bd comment on `.83`, 2026-11-19): `WeekProposalLine.kind` + `technique|rep_range`
(optional `fromTechnique/toTechnique/challenge/fromRepMin…toRepMax`), six new reason codes, evaluate request
`trainingStyle/techniquesEnabled`, evaluation per-week techniques/challenges + `techniqueWarnings`. The generated
client decodes enums **strictly** (an unknown value fails the whole response), so the two proposal operations and the
evaluator are decoded by hand in `TrainClient+Plan` with lenient enums (unknown kind → generic tile, unknown reason →
no pill), and the synced contract is refreshed from main right before merge. A test feeds a response with unknown
values and expects a rendered deck.

## The gap — needs the owner's pick (see the question at the end)

Three things the approved screens promise **cannot be saved on a running block today**:

1. **Edzésmód** (the block's style) — only a template carries it; a running block has no way to change it.
2. **Technikák bekapcsolása** — the running block's switch is off and nothing can turn it on, so every technique tap
   would fail.
3. **"I review the week myself"** — the weekly mode is one server-wide setting (`auto`); the review deck's accept
   buttons only work in `manual`. The owner's own rule: auto stays on *until this screen exists* — so the switch to
   manual belongs to this slice.

**Recommended fix (option A):** one small server operation, `PUT /api/train/mesocycles/{id}/settings`
`{trainingStyle?, techniquesEnabled?, weeklyReviewMode?: auto|manual}` (absent = keep), one Liquibase changeset
(`mesocycle.weekly_review_mode`, nullable → falls back to the server setting), `WeekProposalService` reads the run's
mode first. A style change re-stamps the run's rows through the existing `ExerciseStyler` (same path as a day save).
Contract-first, ITs (`MesocycleSettingsApiIT`), `ArchitectureTest`, deploy. Coordinated with T3 (`mezo-r36n9.81`)
through bd comments; one isolated commit, rebased on whatever T3 merges first.

Option B (no server change): style and technique shown read-only on the running block ("a következő blokkban
állíthatod"), and the deck stays a read-only record of what was applied automatically — the accept buttons would not
exist. Not recommended: it removes the point of the review.

## Architecture (Swift)

- `BoopCore/Train/BlockDraft.swift` — the editable copy of the running block: days → exercises (id, name, muscle,
  sets, counts, catalogId, technique, challenge, style), tiers, sport groups, block style. Pure value type; edits are
  functions (`step(day:exercise:by:)` clamped 1…8, `cycleTier`, `setStyle`, `cycleTechnique` over the allowed list,
  `toggleChallenge` — one a day), `apply(_ edits: [PlanProposalEdit])`, `diff(against:)` → changed days / tiers /
  techniques / style. Building the evaluate request from a draft is a pure function.
- `BoopCore/Train/PlanEvaluation.swift` — Swift mirror of `MesoPlanEvaluation` (bands, fit, diff, spread, proposal,
  blocked, day minutes + cap warnings + sport same day, six-week path, suggested sport groups).
- `BoopCore/Train/WeekReview.swift` — the proposal as the deck needs it: muscles with lines grouped by muscle in body
  order, quiet muscles, per-line local decision (nil / accepted / kept), the summary numbers (sets before → after
  of what is accepted, counts by kind, where the changes land in the week), the **Hungarian reason pill text for
  all 21 codes** (one table, unknown code → no pill), and the decision request builder (per line, `acceptRest`,
  `keepRest`). Unknown line kinds (T3 will add some) render as a generic "from → to" tile, never a crash.
- `BoopCore/Train/TrainClient+Plan.swift` — `evaluate(_ draft:)`, `weekProposals(blockId:)`,
  `decide(blockId:proposalId:_:)`, `saveDays(…)`, `savePriorities(…)`, `saveTechnique(…)`, (A) `saveSettings(…)`;
  each maps 400/401/404/409 to a typed error the screens turn into Hungarian.
- `BoopCore/Train/BlockBuilderModel.swift` — `@Observable` screen model: load (block + catalog) → draft →
  debounced evaluate → state (`loading | ready(evaluation) | stale(evaluation, error) | failed | offline | noBlock`);
  `save()` writes only what changed, in order priorities → days → techniques → settings, stops at the first failure
  and says what was and was not saved.
- `ios/Boop/EdzesTerv/` — `BlockBuilderPage` (head, bar, primary button), `BuilderMusclesView` (body map + one
  card per muscle: tier switch, his number big, the band, where the sets sit, the proposal with *Elfogadom* /
  *miért?*), `BuilderDaysView` (day pills with minutes, one day a page, steppers, technique pill + challenge flag,
  per-day muscle totals, cap warning), `BuilderBlockView` (style four-way choice with its line, six weeks totals +
  each muscle's path, technique weeks), `WeekReviewDeck` (+ `ReviewCard`, `ChangeRow`, `QuietCard`, `SummaryCard`),
  `WeekReviewEntrance` (the Blokk-tab card). Ported from the spike, data from the models above.
- `BoopDesign/Napkelte/PlanMarks.swift` — the spike's drawn mark family (sets, weight, reps, calendar, check, keep,
  style marks) on the kit's 64-unit grid. No emoji, no SF Symbols except chevrons.
- Hooks: the entrance card + *Blokk szerkesztése* on the Blokk tab (`EdzesRoom.swift` / `EdzesBlokk.swift`, a few
  lines; both covers sit at page level per `boop-ios.md` §9). DEBUG launch args kept for review:
  `-previewBlokk YES` now opens the **real** screens over `PreviewTransport` fixtures (`-previewBlokkOpen epito|het`,
  `-previewBlokkTab napok|blokk`, `-previewBlokkState empty|loading|error|offline`).
- `mezo-r36n9.71` (client band maths) is resolved by construction: the builder and the deck show only server bands;
  `MuscleBands.swift`'s own band maths stays for the old load page until that page is folded in (follow-up issue).

## Tasks

1. **Contract into Boop** — filter + synced `openapi.yaml`, regenerate, build. (Late isolated commit; rebase-safe.)
2. **(A only) Server settings op** — contract → Liquibase changeset → entity/service/controller → ITs
   (style restamps rows, techniques switch on/off, manual mode makes the next weekly `pending`, absent = keep,
   foreign run 404, archived 409) → `ArchitectureTest` → codemap.
3. **`BlockDraft` + request builder** — tests first: steps clamp, one challenge a day, technique cycle respects
   stability/lengthened, proposal edits apply, diff finds exactly the changed days/tiers/techniques.
4. **`PlanEvaluation` + `WeekReview`** — tests: mapping from stub JSON, grouping/quiet muscles, summary numbers,
   all 21 reason texts present, unknown kind/code tolerated, decision request shapes (per line, rest flags never both).
5. **`TrainClient+Plan`** — StubTransport tests per operation incl. 400/404/409/offline.
6. **`BlockBuilderModel`** — tests: debounce coalesces edits, stale evaluation kept on failure, save order and
   partial-failure message, noBlock / offline states.
7. **Mark family** + **builder screens** (Izmok, Napok, Blokk) ported from the spike.
8. **Weekly review deck** + entrance card (pending → deck; applied/auto_applied → read-only "ez lépett életbe";
   no proposal → no card) + *Elfogadom átnézés nélkül* (`acceptRest`).
9. **States**: loading skeleton, evaluator failure (keeps last numbers, "nem frissült"), offline (edits allowed, save
   disabled with the reason), no running block, decision 409 ("lejárt a hét, a múlt heti számok maradnak"),
   smallest iPhone width, reduced motion, VoiceOver labels on steppers and tiles.
10. **Gates, review, ship** — see *Kész, ha…*.

## Kész, ha…

**Amit a tulajdonos lát**
- [ ] Builder: Izmok (body map, one muscle a card, tier switch, his number, band, spread, proposal + *Elfogadom* /
  *miért?*), Napok (day pills with minutes, steppers, technique pill + challenge flag, muscle totals, cap warning),
  Blokk (style four-way choice, six weeks + each muscle's path, technique weeks) — each matches its spike screen.
- [ ] One primary button: *Igazítsd a sávba* while anything is outside, otherwise *Mentés*; head names the scope.
- [ ] Review deck: one card per muscle, one tile per change (kind mark, day + kind pills, the change loudest, reasons
  as pills, own accept/keep), *Mind elfogadom* / *a többi marad*, "nem változik" card, summary card (ring, three
  tiles, per-muscle result, where it lands in the week). No half-circle gauge on the review.
- [ ] Entrance card on the Blokk tab with *Átnézem* and *Elfogadom átnézés nélkül*; after deciding it says what took
  effect.
- [ ] Empty (no running block), loading, evaluator error, offline, decision-expired states — each screenshotted.
- [ ] Smallest iPhone width (iPhone SE 3rd gen / 16e simulator) and reduced motion screenshotted.
- [ ] No emoji, no "Mezo", no SF Symbols except chevrons in any new string or screen.

**Paritás**
- [ ] Ma tab, player, Gyakorlatok, Előzmények and the existing block load page unchanged.
- [ ] Every number on the builder comes from the evaluator; nothing computes a band in Swift for these screens.

**Kapuk**
- [ ] `xcodebuild test` BoopKit and Boop green (known flake `mezo-r36n9.52` noted if it appears).
- [ ] (A) backend focused ITs + `ArchitectureTest` with `-Dmezo.test.use-testcontainers=true`.
- [ ] `node scripts/gen-codemap.mjs`, `node scripts/lint-docs.mjs` 0 errors / 0 stale.
- [ ] Final fresh-context review; Critical/Important fixed with failing tests first; minors filed under the epic.

**Docs**
- [ ] `docs/features/boop-ios.md` Edzés section; `docs/features/train.md` §4 (settings op, if A); feature-index row;
  milestone entry.
- [ ] Handbook: new page `docs/boop-handbook/07-edzes/16-blokk-epito.md`, `05-heti-volumen.md` (manual review now
  live), `14-edzesstilus.md` / `15-technikak.md` (set from the phone).
- [ ] `_jegyek.json`, `_kiadasok.json`, `_dontesek.json` (the owner's pick), Notion `plan` → apply → `check` exits 0.

**Kiszállítva**
- [ ] Merged to main (`--no-ff`, detached HEAD), (A) deploy green and the pod on the new version, production DB shows
  the column and his run unchanged until he saves.
- [ ] Installed on his phone; walked through on his real block: open the builder, read each tab, save one change,
  open the week's review (his first manual proposal opens Monday 2026-11-23; until then the deck is checked on
  fixtures and the entrance shows "nincs új javaslat").
- [ ] Issue closed, tracker backup refreshed, Hungarian report.

## Left out (on purpose)

Building a brand-new block from scratch (template wizard), adding/removing/swapping exercises in the builder, the
player's technique and challenge moments (`mezo-r36n9.84`), the old load page's own band maths (follow-up).
