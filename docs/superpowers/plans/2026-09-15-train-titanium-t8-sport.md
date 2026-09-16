# Train Titanium T8 — Sport logging + kcal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** sport logging becomes the full-screen Titanium flow with eleven sports and
per-sport fields; the backend owns a personalised MET kcal estimate (sex/age/body-fat/weight
— never AI) with a user override on the wire; the sport close earns the same ceremony; the
kcal fields finally feed T12's `movementWeek` honesty gate.

**Architecture:** contract-first — the sport-session request/response (and the run-session
response) gain kcal fields in ONE contract commit; a Spring-free `SportEnergyCalculator`
decider + `SportService` wiring (profile via `BiometricProfileRepository`, weight via
`WeightLogRepository`, the `GoalPrescriptionCalculator` exemplar) computes and persists the
estimate; the FE replaces the 3-kind `SportLogSheet` with a full-screen pick→form→ceremony
flow over a new eleven-sport vocabulary module; `TrainWeekMozgasPage` swaps its hardcoded
`kcal: null` for the wire value.

**Tech stack:** OpenAPI fragment + openapi-merge + openapi-typescript, Liquibase SQL
changesets, Spring Boot service + pure decider with unit tests + testcontainers ITs,
React + RTL, the shipped `cer-` ceremony CSS + a new `sp-` section.

**Driving artifacts:** prototype `sport.js`/`sport-state.js`/`sport.css`, recon
`t8-recon.md` (2026-09-16, verified anchors), ceremony pattern doc, bd `mezo-88iwa.9`
(+ its T12 wire-fields note), branch `feat/train-titanium-sport`.

## Global Constraints

Everything in `2026-09-15-train-titanium-slices.md` §Global Constraints, plus:

- **Contract change = fragment + merged `api/openapi.yml` + regenerated `api.gen.ts` in ONE
  commit** (`cd api/generate && npm ci && npm run generate:api`, then
  `cd frontend && pnpm generate:api`).
- **The estimate is the backend's** (deterministic MET math, never AI); the FE never
  computes a sport kcal itself — it displays the wire value. A user override is stored as
  the value with `kcalIsEstimate: false`; missing inputs (no weight log) → `kcal: null` on
  the wire, and every FE surface renders the em dash/hides, never 0.
- **Honesty copy:** the estimate is always labelled ("Becslés, nem mérés" / the breakdown
  line); an override shows "Saját értéket adtál meg — ezt mentjük, nem a becslést."
  (prototype verbatim).
- **Sport stays its own row** — never converted to gym sets (prototype `sport.js:171`).
- **Vocabulary:** the eleven tiles are volleyball · cross (CrossFit/HIIT) · trx · bike ·
  swim · football · basketball · tennis · hike · other + **Futás** — the run tile routes to
  the EXISTING run-logging flow (run sessions are their own feature); the sport-session
  vocabulary on the wire/DB is the ten non-run ids. Existing ids `volleyball|cross|trx`
  keep their spelling (DB rows exist); the schedule-slot vocabulary
  (`ck_sport_schedule_slot_sport`) is OUT of scope.
- **Ceremony:** the sport close reuses the `cer-` scene (one rAF pass, reduced-motion,
  clay icons never emojis); stars come from the prototype's `sportStars` (time share 0.7 +
  effort share 0.3 — real minutes vs the sport's target, real RPE), with the honesty line
  naming that source; the ceremony pattern doc's trigger table gains the sport row in this
  slice (it is stale vs the approved prototype).
- **BE gates:** focused ITs with `-Dmezo.test.use-testcontainers=true`; ArchitectureTest
  (services under `..service..`, no hand-written controllers); pure decider = plain unit
  tests, Spring-free.
- **FE CSS:** new classes `sp-`-prefixed in one marked section, registered in
  `prototypeCssStructure.test.ts`; both-mode vitest; mock parity for every new wire field.

Verified anchors: `api/feature/train/train.yml:779-829` (POST sport-sessions), `:3475-3518`
(`SportSessionCreateRequest` — `sport` pattern `^(volleyball|cross|trx)$`), `:3696-3740`
(`SportSessionResponse`), `RunSessionLogResponse` (same file — locate exactly);
`SportSessionEntity.java` (no kcal column; sport CHECK), Liquibase
`backend/src/main/resources/db/changelog/1.0.0/script/` dated `YYYYMMDDHHMM_mezo-<id>_….sql`
+ `1.0.0_master.yml` include, `202606271000_mezo-lmox_generalize_sport_session.sql:10`
(`ck_sport_session_sport`); `SportService.java:60-83` (`logSportSession`);
`GoalPrescriptionCalculator.java` (profile+weight wiring exemplar);
`BiometricProfileEntity` (sex/birthDate NOT NULL, bodyFatPct nullable);
`WeightLogRepository` (`feature/biometrics/weight/repository`);
`ArchitectureTest.java:48-55,131-140`; FE `logic/sportKinds.ts` (3-kind vocabulary + its
consumers: `SportLogSheet.tsx`, schedule editor, agenda row, heroes), `SportPage.tsx`,
`trainApi.ts:28,160`, `trainHooks.ts:460-537,933,1077-1104`
(`useLogSportSession`/`useQuickLogSport`), `TrainWeekMozgasPage.tsx:123-145,175` (hardcoded
`kcal: null` + suppressed render), `loadWeek.ts:144-179` (`movementWeek` honest-null gate —
needs NO change), `WorkoutCeremony.tsx:49-63` + `logic/cerScore.ts` (gym-shaped — sport gets
its own score), prototype `sport-state.js:6-30` (personalFactor/kcalFor), `:37-144`
(SPORTS table), `:171-176` (sportStars), `sport.js:12-13` (step machine), `:106-115`
(kcal display+override), `:121-177` (ceremony), `:271` (askKcal dialog).

---

### Task 1: The contract + migration + backend kcal (ONE contract commit inside)

**Files:**
- Modify: `api/feature/train/train.yml` — `SportSessionCreateRequest` gains optional
  `kcalOverride` (integer, 1..5000) and the widened `sport` pattern
  `^(volleyball|cross|trx|bike|swim|football|basketball|tennis|hike|other)$`;
  `SportSessionResponse` gains `kcal` (integer, nullable) + `kcalIsEstimate` (boolean,
  present when kcal is); `RunSessionLogResponse` gains the same `kcal`/`kcalIsEstimate`
  pair. Regenerate merged `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts` —
  fragment + merge + gen in ONE commit.
- Create: Liquibase script `2026…_mezo-88iwa.9_sport_session_kcal.sql` — `ALTER TABLE
  sport_session ADD COLUMN kcal integer NULL, ADD COLUMN kcal_is_estimate boolean NULL;`
  extend `ck_sport_session_sport` to the ten ids; same-named kcal columns on the run-session
  table (find its entity/table name); register in `1.0.0_master.yml`.
- Create: `backend/…/feature/train/service/SportEnergyCalculator.java` — Spring-free pure
  decider + `SportEnergyCalculatorTest` (plain JUnit):

```java
/** Personalised MET kcal (prototype sport-state.js:6-30, our own math — no AI):
 *  kcal = met * 3.5 * weightKg / 200 * minutes * personalFactor.
 *  personalFactor = sexFactor (F: 0.94) * ageFactor (−0.2%/yr past 30, clamped 0.90–1.05)
 *                 * leanFactor (from bodyFatPct when present, clamped 0.92–1.08; 1 when null).
 *  Returns empty when weightKg is unknown — the caller persists NULL, never 0. */
public static Optional<Integer> estimate(String sport, int durationMin, @Nullable Integer intensity,
    double metFor, double weightKg, String sex, int age, @Nullable BigDecimal bodyFatPct)
```

  plus a `metFor(sport, intensity)` table mirroring the prototype's per-sport MET math
  (volleyball modes fold to intensity here; bike/swim/hike/trx/cross formulas ported —
  copy the exact constants from `sport-state.js:37-144` into the decider with a table test
  per sport).
- Modify: `SportService.logSportSession` — inject `BiometricProfileRepository` +
  `WeightLogRepository` (the `GoalPrescriptionCalculator` wiring); when the request carries
  `kcalOverride` persist it with `kcal_is_estimate=false`; else persist the estimate (or
  NULL when no weight log / no profile); map both fields into the response. Same for the
  run-session log service (run MET from pace per the prototype's `runMet`).
- Test: service IT (testcontainers): override wins; estimate persisted with flag; no weight
  log → null; response carries the fields; the widened sport ids accepted end-to-end;
  ArchitectureTest still green.

- [ ] **Step 1:** Failing decider unit tests (personalFactor clamps at both ends, female
  factor, null body-fat → leanFactor 1, weight-unknown → empty, one table row per sport's
  MET). **Step 2:** Implement decider. **Step 3:** Contract commit (fragment+merge+gen,
  one commit) + migration. **Step 4:** Service wiring + ITs
  (`-Dmezo.test.use-testcontainers=true`, focused). **Step 5:** Commits:
  `feat(api): sport/run sessions carry kcal + kcalIsEstimate; sport vocabulary widens (mezo-88iwa.9)`,
  `feat(train): personalised sport kcal estimate in the backend (mezo-88iwa.9)`.

### Task 2: The eleven-sport FE vocabulary

**Files:**
- Create: `frontend/src/features/train/logic/sports.ts` + `sports.test.ts` — the SPORTS
  table ported from `sport-state.js:37-144`: `{ id, name, art (clay icon id), color,
  targetMinutes, muscles[], fields[] }` for the ten wire ids + the `run` tile entry marked
  `route: '/train/futas/new'`-style (read where the run logger actually lives and point
  there). Field kinds: number/chips/range/modes exactly as the prototype per sport.
- Modify: `logic/sportKinds.ts` consumers — `SportKind` widens to the ten ids; the agenda
  row/heroes/schedule editor keep working (schedule editor keeps offering its OWN 3-kind
  vocabulary — its wire constraint is unchanged; give it its own narrowed list instead of
  the widened one).
- Test: table tests (every sport has name/art/color/target/fields; ids match the contract
  pattern verbatim — assert against a literal list, the single mirror rule).

- [ ] Steps: failing tests → port → consumers compile (`npx tsc -b`) → both-mode train
  suite → commit `feat(train): the eleven-sport vocabulary (mezo-88iwa.9)`.

### Task 3: The `sp-` CSS section

Port `sport.css` `.sp-*` families (page/head/lead/grid/tile/modes/field/number/chips/
text/range/kcal + states) into one marked section (`/* ── /train sport titanium ─ */` …),
registered in `prototypeCssStructure.test.ts` (assert `.sp-grid`, `.sp-tile`, `.sp-field`,
`.sp-chips`, `.sp-kcal`, `.sp-note`). The ceremony families are NOT re-ported (T7's `cer-`
serves). Same collision rules as every section.

- [ ] Failing registration test → port → `pnpm build` + grep → commit
  `feat(train): the sp- sport CSS section (mezo-88iwa.9)`.

### Task 4: The full-screen sport flow

**Files:**
- Create: `frontend/src/features/train/pages/SportLogPage.tsx` + test (route
  `/train/sport/log` under the Mai tab's `owns` — extend navModel's owns list),
  components as needed (`SportPickGrid`, `SportForm` — keep them in the page file unless
  they exceed ~150 lines each).
- Modify: `SportPage.tsx` + `TrainTodayPage.tsx` — the sport entry points route to the new
  page; `SportLogSheet.tsx` retires (delete + test when no other consumer — grep);
  `trainHooks.ts` mock branch returns the new kcal fields (estimate mirroring the decider
  roughly; fixture values, not the real formula).

Flow (prototype `sport.js:12-13`, step machine on one route): **pick** (the eleven tiles,
clay art + name + target; Futás routes away) → **form** (the sport's fields; duration
prefilled with target; RPE/intensity; per-sport extras; the `.sp-kcal` line shows the
estimate the BACKEND would give — before save the FE cannot know it, so the line shows the
breakdown inputs and "a mentés után pontos becslést kapsz"? NO — honesty and UX: the FE MAY
preview using the same published formula ONLY if the wire exposes it; it does not. Decision:
the form's kcal line is the OVERRIDE affordance — "Kalória: becslést mentünk" + a "Saját
érték" button opening the number dialog (`askKcal` port); the ceremony then shows the WIRE
value from the response. No FE-computed preview number.) → save via `useLogSportSession`
(request carries `kcalOverride` when set) → **ceremony** (Task 5) → details/close to Mai.

- [ ] Failing tests (pick renders eleven tiles incl. Futás routing; per-sport fields render
  by table; override dialog round-trips into the request; no fabricated kcal number
  pre-save) → implement → both modes → commit
  `feat(train): full-screen sport logging flow (mezo-88iwa.9)`.

### Task 5: The sport ceremony

**Files:**
- Create: `frontend/src/features/train/logic/sportScore.ts` (+test) — `sportStars`
  (time_share·0.7 + effort_share·0.3, prototype `sport-state.js:171-176`) and
  `SportScore { ratio, stars }`.
- Create: `frontend/src/features/train/components/SportCeremony.tsx` + test — the `cer-`
  scene (sky/stars/bar/counters: perc · RPE · kcal-ha-ismert) with the SAME single-rAF
  driver idiom as WorkoutCeremony (extract the shared pass into a small hook
  `useCeremonyPass` in `shared/` or `features/train/logic` ONLY if it stays a thin, clean
  seam — else duplicate the ~30-line driver with a comment noting the twin); act two:
  verdict (sport ladder — reuse the workout VERDICTS ladder), the kcal tile with the WIRE
  value (+"Becslés, nem mérés" when `kcalIsEstimate`, "Saját értéked" when not, hidden when
  null), levelUp XP tile when the response carries it, honesty line "A csillagok az
  edzésidőből és az erőfeszítésből számolnak, nem AI-értékelés.", CTA back to Mai.
- Modify: `docs/design_2.0/2026-09-15-ceremony-pattern.md` trigger table — add the sport
  row (trigger: saving a sport session; never on edit), and note the sport star source.

- [ ] Failing tests (reduced-motion final state; counters; kcal tile three states —
  estimate/own/hidden; close CTA) → implement → wire into Task 4's flow → both modes →
  commit `feat(train): the sport close ceremony (mezo-88iwa.9)`.

### Task 6: movementWeek wiring, docs, gates, ship

- Modify: `TrainWeekMozgasPage.tsx:123-145` — the two `kcal: null` maps read the wire's
  `kcal`; keep `movementWeek` itself untouched (its gate is already correct); check
  `TrainWeekMapPage.tsx`'s sport note for a matching mention; the Mai per-event sport list
  (T5) gains the kcal suffix where the wire has it (em dash rule).
- Docs: `docs/features/train.md` — sport section rewrite (eleven sports, flow, BE-owned
  estimate + override semantics, ceremony); CODEMAP regen.
- Gates FOREGROUND: FE both modes full, `tsc -b`, `pnpm build` + sp- grep,
  `pnpm test:layout`; BE focused ITs already green from Task 1 (re-run the sport ITs on the
  final tree).
- Ship: push, self-PR (`--body-file`), CI, detached merge, post-merge CODEMAP, close
  `mezo-88iwa.9`.

## Self-review notes

- The FE never re-implements the kcal formula (no preview number pre-save) — one estimator,
  one owner. The prototype's live in-form estimate is deliberately dropped; the override
  dialog survives.
- `movementWeek`'s all-or-null gate means the sport kcal line on Mozgás lights up only once
  every session in the week carries kcal — old sessions have NULL, which is correct and
  self-heals as weeks roll.
- Run tile routes away; the run-session response still gains kcal (the same estimator via
  the run service) so Mozgás can eventually satisfy its gate for mixed weeks.
- The schedule editor keeps its 3-kind wire; only the session vocabulary widens.
- Type check: `SportScore`/`sportStars` names consistent between Tasks 5's files;
  `kcalOverride` (request) vs `kcal`+`kcalIsEstimate` (responses) used consistently in
  Tasks 1, 4, 5, 6.
