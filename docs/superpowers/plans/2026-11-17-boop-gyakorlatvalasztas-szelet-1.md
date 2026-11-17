# Boop — Indokolt csere (slice 1 of personalised exercise selection) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In Boop's workout player, the swap sheet offers up to five ranked substitutes — by plan role, discomfort,
block goal and trackability, filtered by the owner's equipment — each with a one-sentence reason, plus a *Mi van a
termemben* settings page.

**Architecture:** The backend gains catalogue attributes (authored in the catalogue JSON), a per-user gym profile,
a swap-time discomfort record, and a pure, table-tested `ExerciseSubstituteRanker` behind one read endpoint that
returns suggestions with server-rendered Hungarian reasons and stable signal codes. The phone renders them; it
ranks nothing. No LLM anywhere in the path.

**Tech Stack:** Spring Boot + Liquibase + OpenAPI contract-first (`api/feature/train/train.yml`); Swift 6 / SwiftUI,
`BoopCore` (TrainClient, StubTransport tests), `BoopDesign` Napkelte kit.

**Spec:** `docs/superpowers/specs/2026-11-17-boop-gyakorlatvalasztas-design.md` (§6.1, §6.2). Approved look: branch
`spike/boop-gyakorlatcsere`, `ios/Boop/GyakorlatCsereDemo/CsereDemo.swift` + screenshots in
`docs/superpowers/specs/assets/gyakorlatcsere/` (owner OK 2026-11-17). **Driving issue:** `mezo-r36n9.66`;
prerequisite bug `mezo-r36n9.67`.

## Global Constraints

- iPhone only. No change under `frontend/`. The web keeps working against the widened contract (new fields optional).
- No exercise is "the best": the words *legjobb*, a coach's name, a percentage or any predicted result never appear
  in a reason. Nothing from the source PDF (text, images, its list of picks) enters code, catalogue or docs.
- Reasons never embed an exercise name; exercise names stay English.
- Boop orders and explains, never hides for good: every filtered exercise stays pickable in the full list.
- Discomfort changes **which exercise is suggested**, never load or volume.
- A user-authored exercise (no attributes) is never filtered, ranks neutral, reason
  `saját gyakorlat — erről még keveset tudok`.
- Tier order of the ranking is fixed: role → discomfort → goal → trackability. Weights inside a tier are free.
- Contract first; Liquibase SQL in `db/changelog/1.1.0/script/`, registered in `1.1.0_master.yml`; no bare `?` in a
  changeset; ArchUnit layer packages; no class-level `@Transactional`; regenerate `docs/CODEMAP.md`.
- Shared hot spots — one writer at a time, check `bd list --parent mezo-r36n9 --status in_progress` before each:
  `api/openapi.yml`, `api/generate/merge.yml`, `1.1.0_master.yml`, `support/ResetDatabase.java`,
  `ios/BoopKit/Sources/BoopAPI/**`, `exercise-catalog.json`.
- **Do not start Task 1 until the owner has confirmed the B5 session (`mezo-r36n9.15`) is finished** — it owns
  `ios/Boop/Edzes/**` and `BoopCore/Train/**`. Then write this issue's build-phase *Owns* list.
- Privacy: no real health value in tests, docs, handbook, Notion; examples invented and marked „például”.

## Review Focus

1. **A custom workout with no block** (no `mesocycleId`) or a block with no goal → suggestions still come, ranked
   as hypertrophy. *(Task 5 IT.)*
2. **Everything filtered out** (all kinds off, or every same-muscle exercise hurt) → an empty suggestion list with
   labels for the full list, never an error; the phone shows the "nincs jó ajánlásom" line. *(Task 4 test, Task 7.)*
3. **The outgoing exercise is custom / unlinked** (no `catalogId`, matched by name or not at all) → candidates by
   its muscle and type only, no crash, chips still work (discomfort keyed by name identity). *(Task 3, Task 5 IT.)*
4. **Suggestions cannot be fetched** (offline, 5xx) → the old same-muscle list from the cached catalogue, one
   explanatory line; chips disabled. *(Task 7 test with `StubTransport` status 503.)*
5. **Feedback rows written before the scale fix** — production holds none from Boop (checked 2026-11-17: 15 rows,
   all web, `joint_pain = 1`); re-check before Task 3 ships and say so in the report. *(Task 0 note.)*

---

### Task 0: Fix the 0-based feedback answers (`mezo-r36n9.67`)

**Files:**
- Modify: `ios/BoopKit/Sources/BoopCore/Train/TrainClient.swift` (`sendFeedback`, ~:476-493)
- Test: `ios/BoopKit/Tests/BoopCoreTests/TrainOutboxTests.swift`

**Interfaces:** Produces nothing new. In-app values stay 0-based (`WorkoutFeedback` pump 0–3, jointPain 0–2,
workload 0–2); the wire is 1-based.

- [ ] **Step 1: Failing test** `feedbackIsSentOneBased`: enqueue a `WorkoutFeedbackPayload` item
  `(pump: 0, jointPain: 2, workload: 1)`, flush through `StubTransport` (`on("saveWorkoutFeedback", .status(204))`),
  assert the sent body's item is `pump == 1, jointPain == 3, workload == 2`.
- [ ] **Step 2:** Run the BoopKit tests (command in `ios/README.md`), expect the new test to fail.
- [ ] **Step 3:** Map `+1` on all three fields in `sendFeedback` only (this also corrects items already queued on
  the phone). Do not change stored payloads or `WorkoutSession`.
- [ ] **Step 4:** Tests pass. **Step 5:** Commit `fix(boop): send exercise feedback 1-based (mezo-r36n9.67)`.

### Task 1: Catalogue attributes

**Files:**
- Modify: `backend/src/main/resources/content/exercise-catalog.json` (all 166 rows)
- Create: `backend/src/main/resources/db/changelog/1.1.0/script/202611171000_mezo-r36n9.66_exercise_attributes.sql`;
  register in `1.1.0/1.1.0_master.yml`
- Modify: `feature/train/entity/ExerciseCatalogEntity.java`, `feature/train/ExerciseCatalogLoader.java`
  (`CatalogJsonItem`, `load`, `validate`), `api/feature/train/train.yml` (`ExerciseCatalogItem`)
- Test: `ExerciseCatalogLoaderIT`, `ExerciseCatalogContractIT`, new `ExerciseCatalogAttributesTest` (pure, reads the JSON)

**Interfaces — Produces:**
- Columns on `exercise_catalog`, all nullable: `equipment varchar(16)[]`, `pattern varchar(24)`,
  `secondary_muscles varchar(24)[]`, `joints varchar(16)[]`, `lengthened boolean`, `demand varchar(8)`.
- Entity getters `getEquipment(): List<String>`, `getPattern()`, `getSecondaryMuscles()`, `getJoints()`,
  `getLengthened(): Boolean`, `getDemand()`; contract fields of the same camelCase names (optional, nullable).
- Allowed values exactly as spec §6.1: equipment `barbell dumbbell kettlebell cable machine smith bench pullup-bar
  bodyweight specialty`; the 21 patterns; joints `shoulder elbow wrist lower-back hip knee ankle`; demand
  `low medium high`.

- [ ] **Step 1: Failing pure test** `ExerciseCatalogAttributesTest`: every row with no `createdBy` has non-empty
  `equipment`, a `pattern`, a `demand`, a non-null `lengthened`; every value is in the allowed sets;
  `secondaryMuscles` ⊆ the loader's `MUSCLES` and never contains the row's own `muscle`; a row whose only equipment
  is `bodyweight` lists nothing else; `type == plyo` ⇒ `pattern == jump`.
- [ ] **Step 2:** Author the six attributes for all 166 rows (own classification; when a row does not fit a value,
  add the value to the spec's table and the allowed set in the same commit, and say so in the report).
- [ ] **Step 3:** Changeset + entity (`SqlTypes.ARRAY` as in `CheckInEntity`), `CatalogJsonItem` gains the six
  fields **appended** after `imageEndUrl`; fix the positional constructors in `ExerciseCatalogLoaderIT` (:74, :126);
  loader validates against the allowed sets and upserts the six fields.
- [ ] **Step 4:** Contract: add the six fields to `ExerciseCatalogItem`; `cd api/generate && npm run generate:api`;
  `TrainMapper.toCatalogItem` maps by name — add an assertion to `ExerciseCatalogContractIT` that
  `barbell-bench-press` returns `equipment` containing `barbell` and `bench`, and that a user-authored row returns
  them null.
- [ ] **Step 5:** Run `./mvnw test -Dtest='ArchitectureTest,ExerciseCatalog*' -Dmezo.test.use-testcontainers=true`
  → pass. Commit.

### Task 2: Gym profile

**Files:**
- Create: `…/1.1.0/script/202611171010_mezo-r36n9.66_gym_profile.sql` (+ master), `feature/train/entity/GymProfileEntity.java`
  (extends `OwnedEntity`, modelled on `nutrition/entity/SensitivityProfileEntity`), `repository/GymProfileRepository.java`,
  `service/GymProfileService.java`; contract paths in `train.yml`; methods on `TrainController`
- Modify: `support/ResetDatabase.java` (add `gym_profile`)
- Test: `feature/train/GymProfileIT.java` (extends `ApiIntegrationTest`)

**Interfaces — Produces:**
- Table `gym_profile(id, created_by, off_kinds varchar(16)[] not null default '{}', missing_exercise_ids uuid[] not
  null default '{}', audit cols, is_deleted)`, one live row per user (partial unique index like the sensitivity table).
- `GET /api/train/gym-profile` → `getGymProfile`; `PUT /api/train/gym-profile` → `putGymProfile`; schema
  `GymProfile { offKinds: string[], missingExerciseIds: uuid[] }`. GET with no row returns both empty (no 404).
- `GymProfileService.get(UUID userId): GymProfile`, `put(UUID userId, GymProfile)`, and for the ranker
  `availability(UUID userId): GymAvailability` where `record GymAvailability(Set<String> offKinds, Set<UUID> missing)`
  with `boolean available(ExerciseCatalogEntity e)` — false if `e.id ∈ missing` or any of `e.equipment ∈ offKinds`;
  `bodyweight` and a null `equipment` are always available.

- [ ] **Step 1: Failing IT:** GET on a fresh user → `{offKinds: [], missingExerciseIds: []}`; PUT
  `{offKinds:["cable"], missingExerciseIds:[<hack-squat id>]}` then GET returns it; PUT with `offKinds:["laser"]`
  → 400 field error; PUT with `bodyweight` → 400; another user's GET is unaffected.
- [ ] **Step 2:** Run, expect fail. **Step 3:** Implement. **Step 4:** Add a pure `GymAvailabilityTest`
  (missing id · off kind · two kinds one off · null equipment · bodyweight). **Step 5:** Focused run incl.
  `ArchitectureTest` → pass. Commit.

### Task 3: Discomfort — the swap-time record and the per-exercise history

**Files:**
- Create: `…/1.1.0/script/202611171020_mezo-r36n9.66_exercise_discomfort.sql` (+ master),
  `entity/ExerciseDiscomfortEntity.java`, `repository/ExerciseDiscomfortRepository.java`,
  `service/ExerciseDiscomfortService.java`, `service/DiscomfortHistory.java`; contract paths; controller methods
- Modify: `repository/ExerciseFeedbackRepository.java` (history query), `ResetDatabase.java`
- Test: `feature/train/ExerciseDiscomfortIT.java`, `service/DiscomfortHistoryTest.java` (pure part)

**Interfaces — Produces:**
- Table `exercise_discomfort(id, created_by, identity_key varchar(160) not null, catalog_id uuid null, noted_on
  date not null, source varchar(8) not null default 'swap', audit, is_deleted)`, unique live row per
  `(created_by, identity_key, noted_on)`. `identity_key` = `ExerciseHistoryResolver.identityKey(...)` of the outgoing
  workout-exercise row (reuse it — do **not** add a fourth copy of the identity logic; see `mezo-or51`).
- `POST /api/train/workouts/{id}/exercises/{exerciseId}/discomfort` → `markExerciseDiscomfort` (204, idempotent per
  day); `DELETE` same path → `clearExerciseDiscomfort` (204; removes today's row only). `{id}` is the active
  workout instance, `{exerciseId}` the workout-exercise row; 404 as `changeWorkoutExercise` does.
- `enum PainLevel { NONE, MILD, STRONG }` and
  `DiscomfortHistory.levels(UUID userId, Collection<ExerciseCatalogEntity> exercises, LocalDate today): Map<UUID, PainLevel>`:
  per catalogue exercise, over its **last three** feedback rows (by identity) and discomfort records of the last
  42 days — `STRONG` if any feedback `jointPain == 3`; else `MILD` if any `jointPain == 2` or any discomfort record;
  else `NONE`. The 3 and 42 are `mezo.train.substitute.*` configuration values, not constants.

- [ ] **Step 1: Failing pure test** for the fold rule (inputs: lists of joint-pain ints + record count → level):
  `[1,1,1]`→NONE · `[1,2,1]`→MILD · `[3,1,1]`→STRONG · `[1,1,1,3]` (the 3 is fourth-newest)→NONE · `[]`+1 record→MILD.
- [ ] **Step 2: Failing IT:** POST twice the same day → one row; DELETE → none; POST on a custom (unlinked)
  exercise row → 204 and a row with `catalog_id` null; `levels` returns MILD for that exercise's catalogue twin by
  name; another user sees NONE; POST on a finished workout → the same error `changeWorkoutExercise` gives.
- [ ] **Step 3:** Implement (feedback history query joins feedback → exercise row → identity). **Step 4:** Run
  focused + `ArchitectureTest`. Commit.

### Task 4: The ranker and the reasons (pure)

**Files:**
- Create: `feature/train/service/ExerciseSubstituteRanker.java`, `service/SubstituteReason.java`,
  `service/PainJointMap.java`
- Test: `service/ExerciseSubstituteRankerTest.java`, `service/SubstituteReasonTest.java`

**Interfaces — Produces (no Spring, static, like `MesoPlanFiller`):**

```java
record Candidate(UUID id, String muscle, String type, List<String> equipment, String pattern,
                 List<String> secondaryMuscles, List<String> joints, Boolean lengthened, String demand,
                 BigDecimal stim, BigDecimal fatigue, boolean custom,
                 boolean available, PainLevel pain, boolean doneBefore) {}
record Context(String goalPreset, boolean soreNow, Set<String> painJointsToday, Set<UUID> inWorkout) {}
enum Signal { SAME_ROLE, OTHER_TYPE, SPARES_JOINT, GUIDED, MILD_BEFORE, PAIN_TODAY, GOAL_HYPERTROPHY,
              GOAL_STRENGTH, GOAL_LOW_FATIGUE, LENGTHENED, DONE_BEFORE, NO_EQUIPMENT, HAS_EQUIPMENT, CUSTOM }
enum Label { NO_EQUIPMENT, HURT_BEFORE }
record Ranked(UUID id, List<Signal> signals) {}
record Result(List<Ranked> suggestions, Map<UUID, Label> labels) {}
static Result rank(Candidate out, List<Candidate> pool, Context ctx);          // ExerciseSubstituteRanker
static String sentence(List<Signal> signals, String painJointHu);             // SubstituteReason
static Set<String> joints(Collection<String> painRegions);                    // PainJointMap
```

- Rules exactly as spec §6.2 "How suggestions are chosen": candidates = same `muscle`, not in `ctx.inWorkout`, not
  `out`; left out (and labelled) = `!available` → `NO_EQUIPMENT`, `pain == STRONG` → `HURT_BEFORE`, plyo when `out`
  is not plyo (no label); if fewer than three remain, widen to same `pattern` within the same body region (region =
  the muscle-token prefix group the loader already uses for display); max five; tier order role → discomfort →
  goal → trackability; `goalPreset` null / unknown / `sport` ⇒ hypertrophy; `erohipertrofia` ⇒ hypertrophy;
  `cut-prep`, `recovery` ⇒ low fatigue.
- `signals` on each `Ranked`: the one or two that decided its place, role signal first (`SAME_ROLE` or `OTHER_TYPE`).
- `PainJointMap`: `VALL→shoulder, KONYOK→elbow, CSUKLO_KEZ→wrist, DEREK→lower-back, CSIPO→hip, TERD→knee,
  BOKA_LABFEJ→ankle`; anything else maps to nothing.
- Phrase table (final copy, approved on the spike): `SAME_ROLE` „Ugyanazt a munkát végzi a tervben” · `OTHER_TYPE`
  „Ugyanazt az izmot éri, de {összetett|izolált} mozgásként” · `SPARES_JOINT` „nem terheli azt, ami most nem esett
  jól” · `GUIDED` „vezetett mozgás, kíméletesebb az ízületnek” · `PAIN_TODAY` „kíméli {a válladat}, amit ma
  jeleztél” · `MILD_BEFORE` „legutóbb enyhén érezted” (appended after `;`) · `GOAL_HYPERTROPHY` „stabil, könnyű benne
  terhelni — izomépítéshez jó” · `GOAL_STRENGTH` „erőcélhoz a szabadsúlyos változat áll a legközelebb” ·
  `GOAL_LOW_FATIGUE` „kevésbé fáraszt, ebben a szakaszban ez számít” · `LENGTHENED` „megnyújtott helyzetben is jól
  terhel” · `DONE_BEFORE` „ezt már csináltad, így látod, hol tartasz” · `NO_EQUIPMENT` „eszköz nélkül is megy” ·
  `HAS_EQUIPMENT` „és ehhez van eszközöd” · `CUSTOM` „Saját gyakorlat — erről még keveset tudok”. Sentence = role
  phrase + „, ” + second phrase + „.”, capitalised once.

- [ ] **Step 1: Failing table test** `ExerciseSubstituteRankerTest` — one case per rule, built from a small fixture
  pool (bench-press slot and hack-squat slot, mirroring the spike): same type outranks other type · same pattern
  outranks other pattern within a type · `soreNow` moves a candidate sharing `out.joints` below one that does not,
  and lifts a `machine`/`cable` + `demand low` one · `painJointsToday = {shoulder}` demotes shoulder-loading
  candidates · MILD demotes, STRONG is left out with `HURT_BEFORE` · unavailable is left out with `NO_EQUIPMENT` ·
  strength goal puts the free-weight same-pattern compound first, hypertrophy the guided one · `lengthened` only
  breaks an otherwise exact tie · `doneBefore` beats never-done at equal fit · candidate in `inWorkout` is absent ·
  custom candidate ranks after attributed ones of the same type with `CUSTOM` · widening kicks in below three ·
  everything filtered → empty suggestions, labels filled · at most five · **tier dominance:** a same-type candidate
  with every lower-tier disadvantage still outranks an other-type candidate with every advantage.
- [ ] **Step 2: Failing test** `SubstituteReasonTest`: exact strings for six signal lists; and a guard test that no
  phrase contains `legjobb`, `%`, a digit, or any catalogue `name`.
- [ ] **Step 3:** Implement. **Step 4:** Run both tests + `ArchitectureTest`. Commit.

### Task 5: The substitutes endpoint

**Files:**
- Create: `feature/train/service/ExerciseSubstituteService.java`; contract path + schemas in `train.yml`;
  method on `TrainController`; config keys under `mezo.train.substitute` in `application.yml` + its properties class
- Test: `feature/train/ExerciseSubstitutesIT.java`

**Interfaces — Consumes:** `GymProfileService.availability`, `DiscomfortHistory.levels`, `ExerciseSubstituteRanker.rank`,
`SubstituteReason.sentence`, `PainJointMap.joints`, `ReadinessAssessor.morningCheckIn`, `ExerciseHistoryResolver`.
**Produces:** `GET /api/train/workouts/{id}/exercises/{exerciseId}/substitutes` → `getExerciseSubstitutes`:

```yaml
ExerciseSubstitutesResponse:
  suggestions: ExerciseSubstitute[]   # ordered, 0..5
  labels: ExerciseSubstituteLabel[]   # { catalogId: uuid, label: NO_EQUIPMENT | HURT_BEFORE }
ExerciseSubstitute:
  exercise: ExerciseCatalogItem
  reasonText: string
  signals: string[]
  lastTopSet: { weightKg: number, reps: integer } | null
```

`soreNow` = a discomfort record for the outgoing exercise exists today (so the phone POSTs the chip, then re-reads).
Goal from the instance's `mesocycleId` → `MesocycleEntity.goalPreset`, null-safe.

- [ ] **Step 1: Failing IT** (populators as `WorkoutExerciseChangeIT`): default user, bench-press slot → 200,
  ≤ 5 suggestions, all `chest-*`… same muscle, first is a compound, every `reasonText` non-blank and ends with `.` ·
  after `PUT gym-profile offKinds:[machine]` no suggestion has `machine` and those exercises appear in `labels` as
  `NO_EQUIPMENT` · after a feedback row with `jointPain 3` on a candidate it is labelled `HURT_BEFORE` · after
  `markExerciseDiscomfort` the first suggestion's signals contain `SPARES_JOINT` or `GUIDED` · a custom workout (no
  mesocycle) → 200 · an outgoing custom exercise row → 200 · a candidate with a logged working set returns
  `lastTopSet` · a finished workout → the same error as `changeWorkoutExercise` · another user's workout → 404.
- [ ] **Step 2:** Run, fail. **Step 3:** Implement; `cd api/generate && npm run generate:api`. **Step 4:** Focused
  run with `ArchitectureTest`; `node scripts/gen-codemap.mjs`. Commit.

### Task 6: BoopCore — client, models, preview stubs

**Files:**
- Modify: `ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml` (add `getGymProfile`, `putGymProfile`,
  `markExerciseDiscomfort`, `clearExerciseDiscomfort`, `getExerciseSubstitutes`), run `ios/scripts/sync-openapi.sh`;
  `BoopCore/Train/TrainModels.swift`, `TrainClient.swift`; `ios/Boop/Connect/PreviewTransport.swift` (`trainOps`)
- Create: `BoopCore/Train/GymProfile.swift`
- Test: `ios/BoopKit/Tests/BoopCoreTests/SubstituteTests.swift`

**Interfaces — Produces:**

```swift
public struct CatalogExercise { … public let equipment: [String]? }           // added field only
public struct GymProfile: Equatable, Sendable { public var offKinds: Set<String>; public var missing: Set<UUID> }
public enum EquipmentKind: String, CaseIterable, Sendable   // the nine owner-facing kinds, `label` in Hungarian (spec §6.1)
public enum MissingEdit: Equatable { case exercise(UUID), kind(EquipmentKind), ask([EquipmentKind]) }
public func missingEdit(for e: CatalogExercise) -> MissingEdit?    // nil when e has no attributes
public struct Substitute: Identifiable, Sendable { exercise: CatalogExercise; reason: String; signals: [String]; lastTopSet: (kg: Double, reps: Int)? }
public struct Substitutes: Sendable { suggestions: [Substitute]; labels: [UUID: SubstituteLabel] }   // .noEquipment / .hurtBefore
extension TrainClient {
  func gymProfile() async throws -> GymProfile
  func saveGymProfile(_ p: GymProfile) async throws -> GymProfile
  func substitutes(workoutId: UUID, exerciseId: UUID) async throws -> Substitutes
  func markDiscomfort(workoutId: UUID, exerciseId: UUID) async throws
  func clearDiscomfort(workoutId: UUID, exerciseId: UUID) async throws
}
```

`missingEdit`: any of `machine`, `smith`, `specialty` in the exercise's equipment → `.exercise(id)`; else exactly one
kind other than `bodyweight` → `.kind`; else several → `.ask` (all its kinds, `bench` last). These five calls are
online-only (not outbox kinds), like `changeExercise`.

- [ ] **Step 1: Failing tests** (`StubTransport`): `substitutes` decodes two suggestions with reason, signals,
  `lastTopSet` and a label map · `missingEdit` for hack squat → `.exercise` · for cable fly → `.kind(.cable)` · for
  barbell bench → `.ask([.barbell, .bench])` · for a custom exercise → nil · `saveGymProfile` sends both arrays ·
  503 on `substitutes` throws.
- [ ] **Step 2:** Run BoopKit tests → fail. **Step 3:** Implement; add preview answers for the five operations to
  `PreviewTransport.trainOps` (invented data, the spike's two slots). **Step 4:** Tests pass. Commit.

### Task 7: The swap sheet

**Files:**
- Modify: `ios/Boop/Edzes/WorkoutPlayer.swift` (`swapSheet`, `PlayerSheet`, the player's inputs),
  `ios/Boop/Edzes/EdzesStore.swift`, `ios/Boop/Edzes/EdzesRoom.swift` (wiring ~:115-135)
- Create: `ios/Boop/Edzes/SwapSheet.swift` (the sheet moves out of the 800-line player file)
- Test: `ios/BoopKit/Tests/BoopCoreTests/` for any store logic that is pure; the screen by simulator review

**Interfaces — Consumes** Task 6. **Produces** on `EdzesStore`:
`func substitutes(for exerciseId: UUID) async -> Substitutes?` (nil on failure),
`func markMissing(_ edit: MissingEdit) async -> String?`, `func undoMissing(_ edit: MissingEdit) async`,
`func setDiscomfort(_ on: Bool, exerciseId: UUID) async -> Bool`, `var gym: GymProfile`.

Build to match `CsereDemo.swift`'s `SwapSheet` and screenshots 1–3 exactly: two chips; the note line with
*visszavonom*; `AJÁNLOM` with up to five cards (first one emphasised; name, `izom · típus`, reason, *Legutóbb: …* in
the hue or *Ezt még nem csináltad*); *Minden gyakorlat* expanding to a search field + the full catalogue (same
muscle first) with the two quiet labels; the footer line; a *Mi van a termemben ›* link. Differences from the spike,
all from the spec: `.ask` opens a short pick of the kinds; the outgoing exercise's catalogue row is found the way
`techniqueSheet` does (by name) and both chips are hidden when it is not found; exercises already in today's workout
are absent from suggestions and the list (today's filter compares the wrong ids — fix it); loading shows *Keresem…*;
on failure the old same-muscle list with *„Most nem érem el az ajánlásokat — a teljes listából választhatsz.”*; while
`swapping`, rows are disabled as today; a successful swap still says *„… — lecserélve”*.

- [ ] **Step 1:** Add launch flags following the Edzés convention (`docs/features/boop-ios.md` §preview flags):
  `-previewEdzesSwap YES` opens the player with the swap sheet on the first exercise; `-previewEdzesSwapFail YES`
  makes the preview `getExerciseSubstitutes` answer 503. Document both.
- [ ] **Step 2:** Implement store methods + the sheet. **Step 3:** Build; in the session's own simulator screenshot
  (`xcrun simctl io <udid> screenshot`): default · after *nem esik jól* · after *ehhez nincs eszközöm* on a machine
  exercise · the `.ask` pick · full list open with a search hit and a no-hit · failure state · Dynamic Type one step
  larger · reduce motion on. Compare each with the spike screenshots. **Step 4:** Commit.

### Task 8: *Mi van a termemben*

**Files:**
- Create: `ios/Boop/Edzes/GymSettings.swift` (an `@Observable GymEditor` with load / dirty / save, modelled on
  `SensitivityEditor`, + the sheet)
- Modify: `ios/Boop/Edzes/EdzesRoom.swift` (the *Beállítások* "soon" toast at ~:86 opens the sheet)

Build to match the spike's `GymSheet` and screenshot 4: the intro sentence, nine switches with the §6.1 labels,
*AMI KONKRÉTAN HIÁNYZIK* with *mégis van* per row (exercise names resolved from the cached catalogue) and the empty
line. Saves on each change (PUT whole profile); a failed save rolls the switch back and shows the quiet
*„nem sikerült elmenteni · Újra”* row used elsewhere in Ritmus. Reachable from the room and from the swap sheet's link.

- [ ] **Step 1:** Flag `-previewEdzesGym YES`. **Step 2:** Implement. **Step 3:** Simulator screenshots: all on ·
  two off + one missing exercise · save failure. **Step 4:** Commit.

### Task 9: Docs, gates, ship

- [ ] `docs/features/boop-ios.md` (§2 *The Edzés room*, *The workout player*, §4 *B5 API operations*, preview
  flags) · `docs/features/train.md` (§4 *Mid-workout swap / add*, *Exercise catalog + records*, the new tables and
  endpoints) · feature index rows · `docs/milestones/roadmap.md` entry.
- [ ] Handbook: `docs/boop-handbook/07-edzes/03-edzeslejatszo.md` (the swap: what it does, how it decides, why; the
  answered part of the open discomfort question), `06-gyakorlatok-elozmenyek.md` (catalogue attributes), a new page
  for *Mi van a termemben* (format in the folder README); `_kiadasok.json` row keyed by the merge sha;
  `mezo-r36n9.66` relabelled; close `mezo-r36n9.67`.
- [ ] Gates: backend full suite `./mvnw clean test -Dmezo.test.use-testcontainers=true`; BoopKit + app tests
  (`ios/README.md`); web contract still compiles (`cd frontend && pnpm generate:api && CI=true pnpm test` both
  modes + `pnpm build`) since `ExerciseCatalogItem` widened; `node scripts/gen-codemap.mjs`;
  `node scripts/lint-docs.mjs` 0 errors / 0 stale.
- [ ] Fresh-context review on the most capable model; fix Critical/Important test-first; file minors under the epic.
- [ ] `git fetch && git rebase origin/main` → detached `--no-ff` merge → push → regenerate CODEMAP → `deploy`
  workflow green → pod tag = release version → production: `select count(*) from exercise_catalog where created_by
  is null and equipment is null` = 0, `gym_profile` / `exercise_discomfort` exist.
- [ ] Announce, then `ios/scripts/install-on-phone.sh`; on the phone: open a workout → *csere* → suggestions with
  reasons arrive; *ehhez nincs eszközöm* on a machine exercise → it shows under *Ami konkrétan hiányzik*; undo it.
- [ ] `node scripts/boop-notion-sync.mjs plan` → apply → `check`; `node scripts/check-beads-backup.mjs --fix`;
  delete the session simulator and the `spike/boop-gyakorlatcsere` branch; Hungarian report walking *Kész, ha…*.

## Kész, ha…

**Amit a tulajdonos lát**
- [ ] A cserelap megegyezik a jóváhagyott bemutatóval: két gomb, legfeljebb öt ajánlás egy-egy indokló mondattal,
  „Legutóbb: …” vagy „Ezt még nem csináltad”, „Minden gyakorlat” kereséssel és halk címkékkel.
- [ ] „ehhez nincs eszközöm”: hordozható eszköznél a fajtát kapcsolja ki, gépnél csak azt az egy gyakorlatot jelöli;
  több eszköznél megkérdezi, melyik hiányzik; mindegyik visszavonható.
- [ ] „nem esik jól”: feljegyzi, az ajánlások átrendeződnek, visszavonható.
- [ ] „Mi van a termemben”: kilenc kapcsoló + „Ami konkrétan hiányzik”; az Edzés szobából és a cserelapról is nyílik.
- [ ] Üres, töltődő és hibás állapot mind megvan (nincs ajánlás · keresem · nem érem el → régi lista).
- [ ] Sehol nincs „legjobb”, százalék, ígért eredmény vagy edző neve; a mondatokban nincs gyakorlatnév.

**Megmaradt működés**
- [ ] A csere továbbra is a mai edzésre szól, internetet kér, és ugyanúgy megőrzi a sorozatokat, mint eddig.
- [ ] A teljes listából bármi választható, a kiszűrt gyakorlat is.
- [ ] A gyakorlat utáni három kérdés válaszai pontosan úgy mentődnek, ahogy megnyomta (`mezo-r36n9.67`).
- [ ] A webes alkalmazás változatlanul működik.

**Kapuk** — a 9. feladat listája szerint, mind zöld, bizonyítékkal.

**Élesítve** — a szerver új változata fut, az adatbázisban mind a 166 gyakorlatnak van eszköze, a telefonon a csere
élőben kipróbálva.

**Dokumentáció és Notion** — a funkcióleírások, a kézikönyv három oldala, a kiadási sor és a jegyek állapota friss;
a Notion-ellenőrzés hibátlan.

## Later slices (not in this plan — each gets its own spike and plan)

| Slice | What | Waits for |
|---|---|---|
| 2 „Miért ezt?” | The block on the player's technique sheet, from the same attributes + the ranker's top two | this slice |
| 3 Hiányok a tervben | Complementary-pair hints inside the block builder's weekly review | this slice **and** `mezo-r36n9.65` shipped |
| 4 Tudatos váltás | *Az egész blokkra* scope in Boop + keep-or-change lines | this slice |
| 5 Katalógusbővítés | Counting no-hit searches (the search built in Task 7 gets the counter then) and custom exercises | this slice |
