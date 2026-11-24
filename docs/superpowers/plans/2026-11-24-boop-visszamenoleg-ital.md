# Boop backdated capture, Napló catch-up, gym catch-up and drinks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every quick sheet and the meal composer can be dated (today and the previous six days); the Napló lists the
week and lets a past day's missing check-in moment, gym day and close be caught up; a drink is a sixth, unscored meal
bucket that counts in the day but fills no window.

**Architecture:** Server first — the meal slot vocabulary gains `drink` (DB CHECK, contract, `SlotKey`, no scoring, no
window, own usual bucket, out of Boop's meal rules) and the train slice gains one idempotent endpoint that books a
template day as planned on a past date. Then the kit's `NKWhenRow` (the composer's time row lifted) and BoopCore's pure
rules (labels, clamps, catch-up computation, as-planned rows), then the phone's sheets, composer drink mode, Napló
catch-ups and the Megvolt sheet, all offline-first through the existing outbox. Pure rules live in BoopCore so
`swift test` proves them on this Mac; app-target tests are written too but run only under `xcodebuild test` on the
Xcode-ready Mac (`mezo-r36n9.150`).

**Tech Stack:** Spring Boot 3 / Java 21 (Liquibase, openapi-generator, ArchUnit, Testcontainers ITs), SwiftUI iOS 26 /
Swift 6.2 (BoopKit SPM: BoopCore, BoopDesign, generated BoopAPI), Swift Testing.

**Spec:** `docs/superpowers/specs/2026-11-24-boop-visszamenoleg-ital-design.md` (issues `mezo-r36n9.159`, `.160`, `.161`;
decisions #103–#105).

## Global Constraints

- **Window:** today and the previous six days (`earliest = startOfDay(today) − 6 days`), never the future; copy
  „Egy hétre visszamenőleg tudsz rögzíteni." (spec §3.1). Server windows stay as they are (meal/check-in/close: 7 days;
  as-planned: today−7…today).
- **Catch-up instants:** check-in = the moment's slot time on that day (reggel 06:30 · dél 10:00 · délután 14:00);
  close = that day 21:00 (spec §3.5). Never „now" for a catch-up.
- **Drink:** slot wire value `drink`; no score (`score`/`breakdown` null), no window, counts in `consumed`; recipes and
  shelf items need no drink category; water stays water (spec §3.7, §7).
- **As-planned booking:** prescription as of today; one weight per exercise may be overridden; an exercise with neither
  prescription nor override gets the skip marker, never a zero weight; `finishedAt = startedAt`, `activeSeconds`
  null (spec §3.6, §7).
- **Offline is an answer:** every new write goes ledger/outbox first (`Outbox.swift` order groups), never straight to
  the server; a 4xx is the quiet „Újra" row.
- **Swift 6.2:** no `async let` fan-outs (`Task {}` handles), `@MainActor @Observable` stores, sheets at page level
  (exception: the Napló day sheet presents its own catch-up covers from inside the sheet), `.refreshable` only on the
  page above its `.sheet`s.
- **Copy:** Hungarian, never emoji, never „Mezo"; kit chrome uses drawn glyphs (`NKGlyph.outlined`), no SF Symbols.
- **Contract-first:** edit `api/feature/*.yml` → `cd backend && ./mvnw -q compile` regenerates `api.dto`/`*Api` →
  add the operation to `ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml` → `ios/scripts/sync-openapi.sh` →
  `node scripts/check-ios-contract.mjs`.
- **Never rename an `OutboxKind` raw value** (persisted in `queue.json`).
- Native BoopCore tests on this Mac: `K=<scratchpad>/kit; rsync -a --delete ios/BoopKit/Sources/BoopCore/ $K/Sources/BoopCore/ && rsync -a --delete ios/BoopKit/Tests/BoopCoreTests/ $K/Tests/BoopCoreTests/ && (cd $K && swift test --filter <Suite>)` (the scratchpad kit's `Package.swift` has no BoopDesign; the copy exists at
  `/private/tmp/claude-504/-Users-daniel-kuhne-mezo/bb497b35-b883-471f-8c80-0d2b52402d72/scratchpad/kit`).
- Backend focused tests: `cd backend && ./mvnw -q test -Dtest=<Class> -Dmezo.test.use-testcontainers=true`.
- App build check: `cd ios && xcodebuild build -project Boop.xcodeproj -scheme Boop -destination 'platform=iOS Simulator,id=712BEBCE-D15A-4975-8B22-B862E55AD9C9' -skipPackagePluginValidation -derivedDataPath build/app`.

## Review Focus

1. **A drink captured offline through the Vonalkód or text door** must come back as a drink, not a snack: the queued
   `MealCapture` has to carry the kind and `MealDraftSender` must stamp `slot = "drink"` (Task 9 pins it).
2. **The day boundary for „Tegnap" at 23:30** with the phone east of Budapest: the meal's day is its `capturedAt`
   offset's local day (server), the weight/sleep/sport/journal day is the phone's `yyyy-MM-dd` — both must be the day
   the owner tapped, never shifted (Task 3's label/clamp tests use a fixed calendar and zone).
3. **Today's „passed" moments at the boundary** (10:00:30 → reggel is passed, 14:30:00 → dél is not yet): the catch-up
   computation must use the same boundaries as `CheckInMoment.moment(at:)` (Task 6 pins both edges).
4. **As-planned for a template day that is not in the active block any more** (rotated block, block ended) → 404
   `TRAIN_*` not found, never a booking onto a stale template; and a date before the block's start → still bookable
   (the window is the only date rule) (Task 2 pins the 404).
5. **A sleep catch-up on a night Health already filled** keeps the sensor's times — the sheet's note must appear when
   a past day is chosen so the owner is not surprised (Task 4 pins the note's presence rule in BoopCore).

## File Structure

**Backend (`backend/src/main/java/io/mrkuhne/mezo/…`)**
- Modify `feature/nutrition/service/dayplan/SlotKey.java` (DRINK), `MealSlots.java` (drink/ital), `feature/meal/service/MealService.java` (no score for drink), `feature/meal/service/MealCoachEagerListener.java` (skip drink), `feature/boop/service/BoopDayAssembler.java` (skip drink), `feature/train/service/WorkoutService.java` (`completeAsPlanned`), `feature/train/controller/TrainController.java`, `feature/train/entity/WorkoutSessionEntity.java` (+ `clientRef`), `feature/train/repository/WorkoutSessionRepository.java`.
- Create `resources/db/changelog/1.1.0/script/202611241300_mezo-r36n9.160_meal_slot_drink.sql`, `…/202611241400_mezo-r36n9.161_workout_session_client_ref.sql` (+ two changeSets in `1.1.0_master.yml`).
- Contract: `api/feature/meal/meal.yml`, `api/feature/meal/fuel-plan.yml`, `api/feature/train/train.yml`; messages `resources/messages_{hu,en}.properties`.
- Tests: `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/service/dayplan/{SlotKeyTest,UsualMealRankerTest}.java`, `feature/meal/MealDrinkApiIT.java`, `feature/boop/BoopDayAssemblerDrinkIT.java` (or the assembler's existing test class), `feature/train/WorkoutAsPlannedIT.java`.

**Kit / core (`ios/BoopKit/Sources/…`)**
- Create `BoopCore/When/When.swift` (pure: `WhenChoice`, `whenEarliest`, `whenClamp`, `whenLabel`, `whenToast`), `BoopDesign/Napkelte/When.swift` (`NKWhenRow`), `BoopCore/Ritmus/NaploCatchUps.swift`, `BoopCore/Train/AsPlanned.swift`.
- Modify `BoopCore/Ritmus/CheckInSlot.swift` (`time(on:calendar:)`, `catchUpLabel`), `BoopCore/Ritmus/NaploDays.swift` (`weekEntries`), `BoopCore/Ritmus/Outbox.swift` (`workoutAsPlanned`), `BoopCore/Ritmus/RitmusClient.swift` (route + `journalLines(on:)`), `BoopCore/Train/TrainClient.swift` (`completeWorkoutAsPlanned`, `sendAsPlanned`), `BoopCore/Train/TrainPayloads.swift` (or where `SportSessionPayload` lives: `WorkoutAsPlannedPayload`), `BoopCore/Etel/MealDraft.swift` (`MealCapture.kind`), `BoopCore/Etel/FoodOutbox.swift` (drink slot), `BoopCore/Morning/MorningClient.swift` (`brief(for:)`), `BoopDesign/Napkelte/Glass.swift` (`cup-cream` glyph), `BoopAPI/openapi-generator-config.yaml`.
- Tests: `Tests/BoopCoreTests/{WhenTests,NaploCatchUpsTests,AsPlannedTests,CheckInCatchUpTests,NaploWeekEntriesTests,MealCaptureKindTests,TrainAsPlannedClientTests}.swift`, `Tests/BoopDesignTests/NapkelteTokensTests.swift` (+ glyph).

**App (`ios/Boop/…`)**
- Modify `Capture/QuickSheets.swift`, `Capture/CaptureSheet.swift`, `Etel/Composer.swift`, `Etel/EtelRoom.swift`, `Etel/EtelLogic.swift`, `Etel/EtelMa.swift`, `Etel/EtelHet.swift`, `Naplo/NaploView.swift`, `Ritmus/{CheckinFlow,CheckinView,EsteFlow,EsteView,RitmusEnvironment}.swift`, `Shell/ShellView.swift` (preview hooks), `Edzes/EdzesStore.swift` (done marks).
- Create `Naplo/NaploCatchUp.swift` (PÓTLÁS block + covers), `Edzes/WorkoutAsPlanned.swift` (sheet + model).
- Tests (run on the Xcode Mac): `ios/BoopTests/{QuickSheetsWhenTests,MealComposerDrinkTests,EtelDrinkRowsTests,CheckinFlowTests(+),EsteFlowTests(+),WorkoutAsPlannedModelTests}.swift`.

**Docs:** `docs/features/{boop-ios,fuel,train,me,journal,dayclose}.md`, `docs/boop-handbook/…` (§Task 12), `ios/README.md`, `docs/guides/boop-telefon-telepites-atado-2026-11-23.md`.

---

### Task 1: Server — the `drink` meal slot (`mezo-r36n9.160`)

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.1.0/script/202611241300_mezo-r36n9.160_meal_slot_drink.sql`
- Modify: `backend/src/main/resources/db/changelog/1.1.0/1.1.0_master.yml` (append the changeSet `1.1.0:202611241300_mezo-r36n9.160_meal_slot_drink`, author `daniel.kuhne`, `sqlFile` relative like the others)
- Modify: `api/feature/meal/meal.yml:426` (`MealRequest.slot` pattern → `^(breakfast|lunch|dinner|snack|drink)$`), `api/feature/meal/fuel-plan.yml:38` and `:69` (enum `[breakfast, lunch, dinner, snack, drink]`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/dayplan/SlotKey.java`, `MealSlots.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java` (`applyScore`), `MealCoachEagerListener.java` (`onMealSaved`), `backend/src/main/java/io/mrkuhne/mezo/feature/boop/service/BoopDayAssembler.java` (`meals`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/service/dayplan/SlotKeyTest.java` (new or extend an existing `MealSlotsTest`), `UsualMealRankerTest.java` (extend if present, else new), `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealDrinkApiIT.java` (new, `extends ApiIntegrationTest`)

**Interfaces:**
- Produces: wire slot value `"drink"` accepted by `POST /api/meal`, returned by `GET /api/meal/day`, ranked by `GET /api/fuel/plan/usual-meals?slot=drink`; a drink's `score` and `breakdown` are null; `SlotKey.DRINK` (`wire() == "drink"`); `MealSlots.of("drink")`/`of("Ital")` → `DRINK`.

- [ ] **Step 1: Write the failing unit tests**

```java
// SlotKeyTest
@Test void drinkIsAKnownSlot() { assertThat(SlotKey.fromWire("drink")).isEqualTo(SlotKey.DRINK); assertThat(SlotKey.DRINK.wire()).isEqualTo("drink"); }
@Test void mealSlotsReadTheDrinkWireAndTheHungarianWord() { assertThat(MealSlots.of("drink")).isEqualTo(SlotKey.DRINK); assertThat(MealSlots.of("Ital · 09:40")).isEqualTo(SlotKey.DRINK); }
// UsualMealRankerTest
@Test void drinksAreTheirOwnBucket() {
    var history = List.of(logged("drink", "Fehérjeturmix", 180), logged("drink", "Fehérjeturmix", 180), logged("snack", "Alma", 80));
    var out = UsualMealRanker.rank(history, SlotKey.DRINK, 5);
    assertThat(out).extracting(UsualMeal::title).containsExactly("Fehérjeturmix", "Alma");
    assertThat(out.get(0).slot()).isEqualTo(SlotKey.DRINK);
}
```
(`logged(...)` builds a `LoggedMeal` with that slot, title, kcal and a fixed `loggedAt`; copy the constructor shape from `LoggedMeal.java`.)

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && ./mvnw -q test -Dtest=SlotKeyTest,UsualMealRankerTest`
Expected: FAIL — `SlotKey.DRINK` does not compile / `MealSlots.of("drink")` is null.

- [ ] **Step 3: Implement the vocabulary**

`SlotKey`: add `DRINK` after `SNACK` (javadoc: never a recipe category — the recipe contract enum stays four).
`MealSlots.of`: before `return null`, `if (s.equals("drink") || s.contains("ital")) return SlotKey.DRINK;`.
Check with `grep -rn "SlotKey.values()" backend/src/main/java`: any loop that turns every `SlotKey` into a recipe category or a day-plan window must exclude `DRINK` (`WindowPlacer` builds windows from occasions, not from `values()` — verify; if a recipe validator iterates `values()`, filter `k != DRINK`).

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `cd backend && ./mvnw -q test -Dtest=SlotKeyTest,UsualMealRankerTest`
Expected: PASS.

- [ ] **Step 5: Write the failing API test**

```java
public class MealDrinkApiIT extends ApiIntegrationTest {
    @Test void aDrinkIsSavedUnscoredCountsInTheDayClaimsNoWindowAndRanksAmongUsuals() {
        // POST /api/meal with slot "drink", one item (title "Fehérjeturmix", 180 kcal, 24 g p), capturedAt now, clientRef
        // → 201; response.slot == "drink"; response.score.value == null; response.score.breakdown == null
        // GET /api/fuel/day?date=today → consumed.kcal >= 180 and meals contains the drink
        // GET /api/fuel/plan/{today} → no window's loggedMealIds contains the drink id
        // GET /api/fuel/plan/usual-meals?slot=drink → usuals[0].title == "Fehérjeturmix", slot == drink
        // GET /api/boop/brief?date=today → day.meals has no entry titled "Fehérjeturmix" (Boop's meal rules see meals only)
    }
    @Test void anUnknownSlotIsStillRefused() { /* POST slot "coffee" → 400 field error on slot */ }
}
```
Use `MealApiIT`'s helpers for posting a meal (`ownerAuthHeaders()`, `rest.exchange`) and the brief IT's profile if the brief needs `@ActiveProfiles("companion-fake")` — copy the class-level annotations from the nearest brief IT (`grep -rln "getBoopBrief\|/api/boop/brief" backend/src/test`).

- [ ] **Step 6: Run it to verify it fails**

Run: `cd backend && ./mvnw -q test -Dtest=MealDrinkApiIT -Dmezo.test.use-testcontainers=true`
Expected: FAIL — 400 on `slot` (the contract pattern) or a DB CHECK violation.

- [ ] **Step 7: Implement the server side**

- Changeset SQL (formatted like `202611231000_mezo-r36n9.16_season_menu.sql`'s header comment): `alter table meal drop constraint ck_meal_slot; alter table meal add constraint ck_meal_slot check (slot in ('breakfast','lunch','dinner','snack','drink'));` — confirm the constraint name in `db/changelog/1.0.0/script/202606241400_mezo-arb_create_meal.sql:21`.
- Contract: the three enum/pattern edits above; `cd backend && ./mvnw -q compile` (regenerates `api.dto`).
- `MealService.applyScore`: first line `if (SlotKey.DRINK.wire().equals(meal.getSlot())) { meal.setScore(null); meal.setBreakdown(null); return; }` (javadoc: a drink is not judged — spec §3.7).
- `MealCoachEagerListener.onMealSaved`: return early when the saved meal's slot is `drink` (read the meal by id as the listener already does; no coach note for a drink).
- `BoopDayAssembler.meals`: `fuel.getMeals().stream().filter(m -> !"drink".equals(m.getSlot())).forEach(...)`.
- `DayPlanService.assign` needs no change (`DRINK` has no window → `candidates` empty → `continue`); `usualMeals(userId, slot)` must accept `drink` through `SlotKey.fromWire` (verify `FuelPlanController.getUsualMeals` → `DayPlanService` path uses `fromWire`, not a switch).

- [ ] **Step 8: Run the API test and the slice's focused tests**

Run: `cd backend && ./mvnw -q test -Dtest=MealDrinkApiIT,MealApiIT,FuelDayServiceIT,ClientRefIdempotencyIT,ArchitectureTest -Dmezo.test.use-testcontainers=true`
Expected: PASS (ArchUnit: `meal → nutrition` already exists; no new edge).

- [ ] **Step 9: Commit**

```bash
git add api/feature/meal backend/src/main backend/src/test
git commit -m "feat(meal): the drink slot — unscored, no window, its own usual bucket, out of Boop's meal rules (mezo-r36n9.160)"
```

### Task 2: Server — `POST /api/train/workouts/as-planned` (`mezo-r36n9.161`)

**Files:**
- Modify: `api/feature/train/train.yml` (new path after `/api/train/workouts` start; schema `WorkoutAsPlannedRequest`, `WorkoutAsPlannedOverride`)
- Create: `backend/src/main/resources/db/changelog/1.1.0/script/202611241400_mezo-r36n9.161_workout_session_client_ref.sql` (+ changeSet in `1.1.0_master.yml`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/WorkoutSessionEntity.java` (`clientRef` UUID nullable), `feature/train/repository/WorkoutSessionRepository.java` (`Optional<WorkoutSessionEntity> findByCreatedByAndClientRef(UUID, UUID)`), `feature/train/service/WorkoutService.java`, `feature/train/controller/TrainController.java`, `backend/src/main/resources/messages_{hu,en}.properties` (`TRAIN_AS_PLANNED_DATE_OUT_OF_WINDOW`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutAsPlannedIT.java` (extends `AbstractIntegrationTest`, uses `TrainPopulator` like `CrossDayWorkoutIT`)

**Interfaces:**
- Produces: operation `completeWorkoutAsPlanned`, body `{templateSessionId: uuid, date: date, startedAt: date-time, clientRef: uuid, overrides: [{exerciseId: uuid, weightKg: number}]}` (required: templateSessionId, date, startedAt, clientRef), 201 `WorkoutInstanceResponse` (status `completed`, `date`, `startedAt`, `finishedAt == startedAt`, `sets`), 400 (date outside today−7…today, startedAt > now+5 min), 401, 404 (template not the owner's / not a template), 409 `TRAIN_WORKOUT_OPEN_ELSEWHERE` / `TRAIN_DAY_DONE_THIS_WEEK`.
- Service: `public WorkoutInstanceResponse completeAsPlanned(UUID createdBy, WorkoutAsPlannedRequest req)`.

- [ ] **Step 1: Write the failing IT**

```java
class WorkoutAsPlannedIT extends AbstractIntegrationTest {
    // setup: TrainPopulator seeds an active block with a template day that has two exercises with a prescription
    // (anchor weights) and one exercise without any history (no prescription).
    @Test void booksThePastDayAsPlanned() {
        // date = today − 2, startedAt = that day 18:00 Europe/Budapest, overrides = [] →
        // response.status == "completed", response.date == date, finishedAt == startedAt,
        // sets: for each prescribed exercise workingSets rows, kind working, weightKg == targetWeightKg, reps == targetReps, doneAt == startedAt;
        // the unprescribed exercise has exactly one skipped marker row and no working set; instance.activeSeconds == null.
    }
    @Test void anOverrideReplacesTheWeightOfEverySetOfThatExercise() { /* overrides = [{ex1, 62.5}] → every ex1 set weightKg 62.5 */ }
    @Test void aTypedWeightBooksAnUnprescribedExercise() { /* overrides = [{ex3, 20}] → ex3 gets working sets (reps = repMin), no marker */ }
    @Test void aRetryWithTheSameClientRefReturnsTheSameInstance() { /* second call → same id, no second instance */ }
    @Test void theWindowIsTodayMinusSevenToToday() { /* date today−8 → 400 field error `date`; date tomorrow → 400 */ }
    @Test void aLiveWorkoutBlocksTheBooking() { /* startWorkout first → 409 TRAIN_WORKOUT_OPEN_ELSEWHERE */ }
    @Test void theWeekIsJudgedByTheDate() { /* complete the template day on date today−9 (last week) via populator; booking today−2 is fine; booking another day of LAST week → 409 TRAIN_DAY_DONE_THIS_WEEK */ }
    @Test void aTemplateOutsideTheOwnersBlockIsNotFound() { /* random templateSessionId → 404 */ }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && ./mvnw -q test -Dtest=WorkoutAsPlannedIT -Dmezo.test.use-testcontainers=true`
Expected: FAIL — `WorkoutAsPlannedRequest` / `completeAsPlanned` do not exist.

- [ ] **Step 3: Contract + generation**

`train.yml`: path `/api/train/workouts/as-planned` `post`, `tags: [Train]`, `operationId: completeWorkoutAsPlanned`, summary „Book a past template day as completed with the plan's prescribed sets (Boop catch-up, mezo-r36n9.161)", request `WorkoutAsPlannedRequest`, responses 201 `WorkoutInstanceResponse`, 400/401/404/409 like `startWorkout`'s. Schemas: `WorkoutAsPlannedRequest` (properties above; `overrides` array of `WorkoutAsPlannedOverride {exerciseId uuid, weightKg number minimum 0 exclusiveMinimum}`). `cd backend && ./mvnw -q compile`.

- [ ] **Step 4: Implement**

- Changeset: `alter table workout_session add column client_ref uuid; create unique index uq_workout_session_owner_client_ref on workout_session (created_by, client_ref) where client_ref is not null;` + entity field + repository finder.
- `WorkoutService`: extract from `startWorkout` a `private WorkoutSessionEntity newInstance(UUID createdBy, WorkoutSessionEntity template, LocalDate date, Instant startedAt)` (the block that copies the template's fields and sets status/date/startedAt) and reuse it there; extract `completedInWeekOf(UUID createdBy, UUID templateId, LocalDate anchor)` (Mon–Sun of `anchor`) and keep `completedThisWeek` delegating with `LocalDate.now(clock)`; extract from `skipExercise` a `private ExerciseSetEntity skipMarker(UUID createdBy, WorkoutSessionEntity instance, UUID exerciseId, Instant at)`.
- `completeAsPlanned`: idempotency (`findByCreatedByAndClientRef` → return `toInstanceResponse`); template lookup as `startWorkout` (404); window: `LocalDate today = LocalDate.now(clock)`; `date` in `[today−7, today]` else 400 `TRAIN_AS_PLANNED_DATE_OUT_OF_WINDOW` (field `date`); `startedAt` ≤ `clock.instant() + 5 min` else 400; D6 as `startWorkout` (409); D5 `completedInWeekOf(date)` (409, custom templates exempt as in `startWorkout`); prescription = `getToday(createdBy, template.getId()).getExercises()` (`TodayExercise`: `getId()`, `getWorkingSets()`, `getPrescribedSets()` → `PrescribedSet.getTargetWeightKg()/getTargetReps()/getKind()`, `getRepMin()`); for each exercise: `BigDecimal weight = override ?? first working prescribed set's targetWeightKg`; if `weight == null` → `skipMarker`; else for `i in 1..workingSets` (fallback `prescribedSets` working count, else 3): new `ExerciseSetEntity` like `logSet` (kind `working`, `reps = prescribed targetReps ?? repMin`, `doneAt = startedAt`, `targetWeightKg/targetReps` snapshot, `targetRepMin/Max` from the exercise); `instance.setStatus("completed"); instance.setFinishedAt(startedAt); instance.setClientRef(req.getClientRef());` save; publish `WorkoutFinishedEvent(createdBy, instance.getId())`; medals as `finishWorkout`; return `toInstanceResponse`. The `clock` is the application `Clock` bean via `ObjectProvider<Clock>` as `CheckInService` does (fallback system).
- `TrainController.completeWorkoutAsPlanned(WorkoutAsPlannedRequest)` → `workoutService.completeAsPlanned(currentUserId.get(), req)`, 201 as the generated interface dictates.
- Messages: `TRAIN_AS_PLANNED_DATE_OUT_OF_WINDOW=Egy hétre visszamenőleg tudsz pótolni.` / `…=A catch-up may be dated at most a week back.`

- [ ] **Step 5: Run the IT and the slice's guards**

Run: `cd backend && ./mvnw -q test -Dtest=WorkoutAsPlannedIT,CrossDayWorkoutIT,SportServiceIT,ArchitectureTest -Dmezo.test.use-testcontainers=true`
Expected: PASS.

- [ ] **Step 6: The phone's contract copy**

Append `completeWorkoutAsPlanned` and `listJournalEntries` to `ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml` (the Train and Journal groups); run `ios/scripts/sync-openapi.sh` and `node scripts/check-ios-contract.mjs`.
Expected: `openapi.yaml` rewritten; contract check prints the operation count one higher per operation and no drift.

- [ ] **Step 7: Commit**

```bash
git add api/feature/train backend/src ios/BoopKit/Sources/BoopAPI
git commit -m "feat(train): book a past template day as planned — one idempotent endpoint with a date window, overrides and no invented timing (mezo-r36n9.161)"
```

### Task 3: Kit — `NKWhenRow` and the pure „when" rules

**Files:**
- Create: `ios/BoopKit/Sources/BoopCore/When/When.swift`, `ios/BoopKit/Sources/BoopDesign/Napkelte/When.swift`
- Test: `ios/BoopKit/Tests/BoopCoreTests/WhenTests.swift`

**Interfaces:**
- Produces (BoopCore, all pure):
  - `public enum WhenChoice: Equatable, Sendable { case now, yesterday, other(Date) }`
  - `public func whenEarliest(now: Date, calendar: Calendar) -> Date` (start of today − 6 days)
  - `public func whenClamp(_ date: Date, now: Date, calendar: Calendar) -> Date` (into `earliest…now`)
  - `public func whenResolved(_ choice: WhenChoice, now: Date, calendar: Calendar) -> Date` (`.now` → now; `.yesterday` → now − 1 day, clamped; `.other(d)` → clamped)
  - `public func whenLabel(_ choice: WhenChoice, now: Date, withTime: Bool, calendar: Calendar, locale: Locale = Locale(identifier: "hu_HU")) -> String` — day form: „ma" / „tegnap" / „nov. 22. · szombat"; time form: „most" / „tegnap · 21:40" / „ma · 08:15" / „nov. 22. · 08:15"
  - `public func whenToast(_ base: String, choice: WhenChoice, now: Date, calendar: Calendar) -> String` — `base` unchanged for today, `"\(base) · tegnap"`, `"\(base) · nov. 22."`
  - `public func whenDayString(_ date: Date, calendar: Calendar) -> String` (`yyyy-MM-dd`, the same as `RitmusEnvironment.day(of:)`)
- Produces (BoopDesign): `public struct NKWhenRow: View { public init(eyebrow: String, hue: Hue, withTime: Bool = false, choice: Binding<WhenChoice>, now: @escaping () -> Date = { Date() }) }` — chips Ma/Most · Tegnap · Más nap/időpont, the resolved label at the right, the compact hu_HU `DatePicker` under „Más…", the window line; on = white 92 % capsule, off = white 8 %; a11y: each chip `.isSelected` when on. Tapping „Tegnap" in the time form opens the picker.

- [ ] **Step 1: Write the failing tests**

```swift
@Suite struct WhenTests {
    let cal: Calendar = { var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; c.locale = Locale(identifier: "hu_HU"); return c }()
    func at(_ s: String) -> Date { /* "2026-11-24 13:11" in Budapest */ }
    @Test func earliestIsSixDaysBackAtMidnight() { #expect(whenEarliest(now: at("2026-11-24 13:11"), calendar: cal) == at("2026-11-18 00:00")) }
    @Test func clampKeepsTheWindow() { #expect(whenClamp(at("2026-11-10 10:00"), now: at("2026-11-24 13:11"), calendar: cal) == at("2026-11-18 00:00")); #expect(whenClamp(at("2026-11-25 10:00"), now: at("2026-11-24 13:11"), calendar: cal) == at("2026-11-24 13:11")) }
    @Test func dayLabels() { let now = at("2026-11-24 13:11"); #expect(whenLabel(.now, now: now, withTime: false, calendar: cal) == "ma"); #expect(whenLabel(.yesterday, now: now, withTime: false, calendar: cal) == "tegnap"); #expect(whenLabel(.other(at("2026-11-22 09:00")), now: now, withTime: false, calendar: cal) == "nov. 22. · szombat") }
    @Test func timeLabels() { let now = at("2026-11-24 13:11"); #expect(whenLabel(.now, now: now, withTime: true, calendar: cal) == "most"); #expect(whenLabel(.yesterday, now: now, withTime: true, calendar: cal) == "tegnap · 13:11"); #expect(whenLabel(.other(at("2026-11-22 08:15")), now: now, withTime: true, calendar: cal) == "nov. 22. · 08:15") }
    @Test func yesterdayAtTwentyThreeThirtyStaysYesterday() { let now = at("2026-11-24 23:30"); #expect(whenDayString(whenResolved(.yesterday, now: now, calendar: cal), calendar: cal) == "2026-11-23") }
    @Test func toastNamesTheDayWhenNotToday() { let now = at("2026-11-24 13:11"); #expect(whenToast("Súly 81,4 kg rögzítve", choice: .now, now: now, calendar: cal) == "Súly 81,4 kg rögzítve"); #expect(whenToast("Súly 81,4 kg rögzítve", choice: .yesterday, now: now, calendar: cal) == "Súly 81,4 kg rögzítve · tegnap"); #expect(whenToast("x", choice: .other(at("2026-11-22 08:00")), now: now, calendar: cal) == "x · nov. 22.") }
}
```

- [ ] **Step 2: Run to verify RED**

Run: the native kit command (Global Constraints) with `--filter WhenTests`
Expected: FAIL — symbols missing.

- [ ] **Step 3: Implement `BoopCore/When/When.swift`** (the signatures above; `DateFormatter` with the given calendar/locale, patterns `"MMM d. · EEEE"` and `"MMM d. · HH:mm"`, `"'ma' · HH:mm"`, `"'tegnap' · HH:mm"`).

- [ ] **Step 4: Run to verify GREEN** (same command). Expected: PASS.

- [ ] **Step 5: Implement `NKWhenRow`** in `BoopDesign/Napkelte/When.swift` from the spike's `SpikeWhenRow` (branch `spike/boop-visszamenoleg-ital`, `ios/Boop/Capture/SpikeWhen.swift`) but driven by `WhenChoice` and the BoopCore helpers; chips are the composer's capsule style; the picker binds `.other(clamped)`.

- [ ] **Step 6: Build the kit** — `cd ios/BoopKit && swift build` is not available with BoopDesign on this Mac; build the app instead after Task 4 (the sheets use it). Commit now:

```bash
git add ios/BoopKit/Sources/BoopCore/When ios/BoopKit/Sources/BoopDesign/Napkelte/When.swift ios/BoopKit/Tests/BoopCoreTests/WhenTests.swift
git commit -m "feat(kit): NKWhenRow and the pure when rules — today and the previous six days, labels, clamp, toast suffix (mezo-r36n9.159)"
```

### Task 4: Phone — the quick sheets take the row (`.159`)

**Files:**
- Modify: `ios/Boop/Capture/QuickSheets.swift` (`WeightSheet`, `SleepLogSheet`, `SportSheet`, `JournalSheet`), `ios/Boop/Ritmus/RitmusEnvironment.swift` (`captureSleep`/`captureSport` take the chosen instant for `capturedAt`; `captureWeight(kg:at:)` and `captureJournal(text:at:)` already take a date)
- Modify: `ios/BoopKit/Sources/BoopCore/When/When.swift` (+ `whenSleepNote`)
- Test: `ios/BoopKit/Tests/BoopCoreTests/WhenTests.swift` (+1), `ios/BoopTests/QuickSheetsWhenTests.swift` (new; runs on the Xcode Mac)

**Interfaces:**
- Consumes: `NKWhenRow`, `whenResolved`, `whenToast`, `whenDayString`, `SportSessionPayload(sport:date:time:durationMinutes:rpe:)`, `SleepLogPayload(date:…)`, `clockLabel(_:)`.
- Produces: `public func whenSleepNote(_ choice: WhenChoice) -> String?` — nil for `.now`, else „Ha az órád már mérte ezt az éjszakát, csak a minősítésed kerül mellé."

- [ ] **Step 1: Failing test** (BoopCore): `@Test func sleepNoteOnlyForAPastMorning() { #expect(whenSleepNote(.now) == nil); #expect(whenSleepNote(.yesterday) != nil) }`. Run `--filter WhenTests`. Expected: FAIL.
- [ ] **Step 2: Implement `whenSleepNote`**; run; Expected: PASS.
- [ ] **Step 3: The sheets.** Each sheet gets `@State private var when: WhenChoice = .now` and `NKWhenRow` placed as the spike shows (`spike/boop-visszamenoleg-ital`, `QuickSheets.swift`): Súly `MELYIK NAP` (day form; hint „Reggel, étkezés előtt a legjobb. Egy napra a legutóbb beírt mérés számít."), Alvás `MELYIK REGGEL ÉBREDTÉL` (day form; `whenSleepNote` under the row; hint ends „Arra a reggelre kerül, amelyiket választod."), Sport `MIKOR SPORTOLTÁL` (time form), Napló `MELYIK NAP` (day form). Saving: `let moment = whenResolved(when, now: BoopClock.now(), calendar: .current)`; Súly → `ritmus.captureWeight(kg:at: moment)`; Alvás → `SleepLogPayload(date: ritmus.day(of: moment), …)`; Sport → `SportSessionPayload(…, date: ritmus.day(of: moment), time: clockLabel(moment), …)`; Napló → `ritmus.captureJournal(text:at: moment)`. Toasts through `whenToast(base, choice: when, now:, calendar:)`. DEBUG: `-previewWhen tegnap` presets `when = .yesterday` (keep the spike's `previewDefault` idea as `WhenChoice.previewDefault`).
- [ ] **Step 4: App test** `QuickSheetsWhenTests`: the sheet payload builders are private — expose the two pure builders as internal static funcs (`SportSheet.payload(sport:minutes:rpe:moment:day:)`, `SleepLogSheet.payload(bed:wake:quality:morning:)`) and assert the date/time strings for a yesterday moment.
- [ ] **Step 5: Build the app** (Global Constraints command). Expected: `BUILD SUCCEEDED`.
- [ ] **Step 6: Commit** — `git commit -am "feat(boop): the Súly, Alvás, Sport and Napló sheets take a Mikor row (mezo-r36n9.159)"`.

### Task 5: Phone — the composer's row becomes `NKWhenRow` with a Tegnap chip

**Files:**
- Modify: `ios/Boop/Etel/Composer.swift` (`MealTimeRow` → wraps `NKWhenRow(eyebrow: "MIKOR ETTED", hue: .fuel, withTime: true, …)` plus the composer's own quick chips „fél órája · 1 órája · 2 órája" kept — the kit row gains an optional `extraChips: [(String, Date)]` parameter, or the composer keeps its own chip strip and only adds a `Tegnap` chip; **choose the second** (smallest change): add the chip `chip("Tegnap", on: …)` before „Más időpont" exactly as the spike did, and keep `MealTimeRow`'s picker.)
- Test: `ios/BoopTests/MealComposerTests.swift` (+ `tegnapKeepsTheTimeOfDayAndOpensThePicker`-style test on `MealComposerModel.setTime` with a fixed clock: `setTime(yesterday same time)` → `capturedAt` is yesterday at the clock's time, `draft.date` is yesterday's string)

- [ ] **Step 1: Failing app test** (written; runs on the Xcode Mac — note it in the ledger).
- [ ] **Step 2: Implement the chip** (copy from the spike commit `bb74c2333`, `Composer.swift`).
- [ ] **Step 3: Build the app.** Expected: `BUILD SUCCEEDED`.
- [ ] **Step 4: Commit** — `git commit -am "feat(boop): a Tegnap chip on the composer's Mikor etted row (mezo-r36n9.159)"`.

### Task 6: Core — the Napló's week entries, the catch-up computation, the catch-up instants

**Files:**
- Modify: `ios/BoopKit/Sources/BoopCore/Ritmus/NaploDays.swift`, `ios/BoopKit/Sources/BoopCore/Ritmus/CheckInSlot.swift`
- Create: `ios/BoopKit/Sources/BoopCore/Ritmus/NaploCatchUps.swift`
- Test: `ios/BoopKit/Tests/BoopCoreTests/{NaploWeekEntriesTests,NaploCatchUpsTests,CheckInCatchUpTests}.swift`

**Interfaces:**
- `public enum NaploListEntry: Equatable, Identifiable, Sendable { case day(NaploDayRow), empty(date: String) }` with `id` = the date; `public static func NaploDays.weekEntries(rows: [NaploDayRow], today: String, count: Int = 7) -> [NaploListEntry]` — the last `count` days newest first, each a `.day` when `rows` has it else `.empty`, then the older rows in their order.
- `public struct NaploCatchUps: Equatable, Sendable { public let missingMoments: [CheckInMoment]; public let canClose: Bool; public let gymTemplateId: UUID?; public let gymTitle: String? }` and `public static func NaploCatchUps.compute(date: String, today: String, now: Date, checkIns: [LedgerCheckIn], closed: Bool, templateDay: (id: UUID, title: String)?, completedThatDay: Bool, calendar: Calendar) -> NaploCatchUps` — today: only the moments already passed (`CheckInMoment.moment(at: now)` is later than the moment) and not done; `canClose` false; gym nil. Past day inside the window (`date` ≥ today−6): every moment not done; `canClose = !closed`; gym when `templateDay != nil && !completedThatDay`. Outside the window or a future date: everything empty.
- `public extension CheckInMoment { func time(on day: String, calendar: Calendar) -> Date? }` (the slot id's HH:mm on that day); `public func catchUpLabel(date: String, moment: CheckInMoment, today: String, calendar: Calendar) -> String` → „PÓTLÁS · TEGNAP · DÉL" / „PÓTLÁS · MA · REGGEL" / „PÓTLÁS · NOV. 22. · DÉLUTÁN"; `public static func esteCatchUpInstant(on day: String, calendar: Calendar) -> Date?` (21:00) on `CheckInMoment` or a free function in `NaploCatchUps`.

- [ ] **Step 1: Failing tests**

```swift
@Suite struct NaploWeekEntriesTests {
    @Test func theWeekIsAlwaysThereNewestFirst() { let rows = [row("2026-11-23"), row("2026-11-15")]; let out = NaploDays.weekEntries(rows: rows, today: "2026-11-24"); #expect(out.map(\.id) == ["2026-11-24","2026-11-23","2026-11-22","2026-11-21","2026-11-20","2026-11-19","2026-11-18","2026-11-15"]); #expect(out[0] == .empty(date: "2026-11-24")); if case .day = out[1] {} else { Issue.record() } }
}
@Suite struct NaploCatchUpsTests {
    @Test func todayOffersOnlyPassedMissingMoments() { /* now 11:00, no check-ins → [.reggel]; now 14:30:00 → [.reggel] (dél not passed); now 14:31 → [.reggel, .delben]; canClose false, gym nil */ }
    @Test func todayWithTheMorningDoneOffersNothingAtEleven() { /* checkIns: slot "06:30" → [] */ }
    @Test func aPastDayOffersEverythingMissing() { /* yesterday, checkIns slot "06:30" and "14:00", closed false, template (id, "Pull Day"), completedThatDay false → [.delben], canClose true, gymTitle "Pull Day" */ }
    @Test func aClosedDayAndADoneGymDayOfferNeither() { }
    @Test func outsideTheWeekNothing() { /* date today−7 → all empty */ }
}
@Suite struct CheckInCatchUpTests {
    @Test func theMomentsOwnTime() { #expect(CheckInMoment.delben.time(on: "2026-11-23", calendar: cal) == at("2026-11-23 10:00")) }
    @Test func labels() { #expect(catchUpLabel(date: "2026-11-23", moment: .delben, today: "2026-11-24", calendar: cal) == "PÓTLÁS · TEGNAP · DÉL"); #expect(catchUpLabel(date: "2026-11-22", moment: .delutan, today: "2026-11-24", calendar: cal) == "PÓTLÁS · NOV. 22. · DÉLUTÁN") }
    @Test func theCloseCatchUpIsAtNine() { #expect(esteCatchUpInstant(on: "2026-11-23", calendar: cal) == at("2026-11-23 21:00")) }
}
```

- [ ] **Step 2: Run RED** (`--filter "NaploWeekEntriesTests|NaploCatchUpsTests|CheckInCatchUpTests"`). Expected: FAIL.
- [ ] **Step 3: Implement** the three files (pure; `NaploDays.days(from:to:)`/`range(endingOn:count:)` already exist for the date arithmetic; the moment boundaries reuse `CheckInMoment.moment(at:)` so both edges agree).
- [ ] **Step 4: Run GREEN**; then the whole native suite (`swift test`). Expected: PASS, no other suite broken.
- [ ] **Step 5: Commit** — `git add ios/BoopKit && git commit -m "feat(core): Napló week entries, the catch-up computation and the catch-up instants (mezo-r36n9.159)"`.

### Task 7: Phone — Napló: the week listed, the PÓTLÁS block, the day's journal lines, the covers

**Files:**
- Modify: `ios/Boop/Naplo/NaploView.swift` (list from `NaploDays.weekEntries`; `NaploDayDetail` gets the block and A NAP SORAI), `ios/BoopKit/Sources/BoopCore/Ritmus/RitmusClient.swift` (`public func journalLines(on date: String) async throws -> [JournalLineLite]` via `listJournalEntries(from: date, to: date)`; `public struct JournalLineLite: Identifiable, Equatable, Sendable { id: UUID; text: String; occurredOn: String; createdAt: Date }`), `ios/BoopKit/Sources/BoopCore/Morning/MorningClient.swift` (`public func brief(for day: String) async throws -> Brief` = `fetch(.get, day)`)
- Create: `ios/Boop/Naplo/NaploCatchUp.swift` — `struct NaploCatchUpBlock: View` (the spike's `SpikeCatchupBlock` made real: moments row reggel/dél/délután with the check glyph, one button per missing moment „Check-in pótlása: dél", „Edzés pótlása: <title>", the „A nap még nincs lezárva." line + „Lezárom a napot"), and `@MainActor @Observable final class NaploCatchUpModel` (loads: the day's ledger check-ins/close, the block's template day for the weekday (`TrainClient.block()`-equivalent: read how `EdzesStore.loadBlock` gets `BlockPlan` and its `days` with `BlockDay.id/day`; weekday label table `["Hét","Ke","Sze","Csü","Pé","Szo","Vas"]` as `EdzesRoom.swift:689`), `TrainClient.history(from:to:)` for that date's completed instance, the day's journal lines (ledger + server, merged by id, newest first), that day's brief for the close (`MorningClient.brief(for:)`); computes `NaploCatchUps`; exposes `catchUps`, `journalLines`, `brief`, `loading`, `problem`).
- Test: `ios/BoopKit/Tests/BoopCoreTests/RitmusClientTests.swift` (+ `journalLinesDecodeOccurredOnAndCreatedAt` on the existing stub transport pattern), `ios/BoopTests/NaploCatchUpModelTests.swift` (runs on the Xcode Mac)

**Interfaces:**
- Consumes: Task 6 (`weekEntries`, `NaploCatchUps.compute`), Task 8 (`CheckinView(env:catchUp:onClose:)`), Task 9 (`EsteView(env:brief:date:onClose:)`), Task 11 (`WorkoutAsPlannedSheet(templateSessionId:date:title:onDone:)`).
- Presentation: `NaploDayDetail` owns `@State private var cover: NaploCover?` (`enum NaploCover: Identifiable { case checkin(CheckInMoment), este, gym }`) and presents `.fullScreenCover(item:)` for check-in/este and `.sheet(item:)` for the gym sheet from inside the day sheet; on a saved result the cover closes and the day sheet dismisses (`@Environment(\.dismiss)`), the Napló's rows re-read from the ledger (`env.refreshNaplo()`); on cancel only the cover closes.

- [ ] **Step 1: Failing BoopCore test** for `journalLines(on:)` (stub transport answering `listJournalEntries` with two entries; expect ids, texts, `occurredOn`, `createdAt`). Run RED.
- [ ] **Step 2: Implement `journalLines(on:)`** and `MorningClient.brief(for:)`; run GREEN.
- [ ] **Step 3: The views and the model** as specified; the list: `ForEach(entries)` → `.day` → `NaploDayRowView`, `.empty` → the spike's empty row („Erről a napról még nincs semmi."); DEBUG `-previewOpen naploDay` keeps opening yesterday (keep the spike's shell-level hook as the reliable one: `ShellView` presents `NaploDayDetail` for yesterday).
- [ ] **Step 4: App test** `NaploCatchUpModelTests`: with a stub `TrainClient`/ledger, the model's `catchUps` for yesterday equals `NaploCatchUps.compute(...)` of the same inputs; the journal merge keeps a pending ledger line that the server does not have yet.
- [ ] **Step 5: Build the app.** Expected: `BUILD SUCCEEDED`.
- [ ] **Step 6: Commit** — `git commit -am "feat(boop): the Napló lists the week and a day's sheet carries its catch-ups and journal lines (mezo-r36n9.159)"`.

### Task 8: Phone — the check-in catch-up

**Files:**
- Modify: `ios/Boop/Ritmus/CheckinFlow.swift` (`init(env:catchUp:)` with `struct CatchUp: Equatable { let date: String; let moment: CheckInMoment }`; when set: `date`/`moment` fixed, `overwriteNotice` from that day's ledger, `questions` from that day's plan; `save` uses `capturedAt = catchUp.moment.time(on: catchUp.date)` and never re-decides; `momentLabel` → `catchUpLabel(...)`; `canQuickExit` unchanged; the snapshot read at that instant), `ios/Boop/Ritmus/CheckinView.swift` (`init(env:catchUp:onClose:)`; header line „Ahogy akkor voltál." when `flow.isCatchUp`; the top-right label always shown for a catch-up)
- Test: `ios/BoopTests/CheckinFlowTests.swift` (+ `aCatchUpKeepsItsDayAndMomentAndStampsTheSlotTime`: env clock = today 21:40, catch-up (yesterday, .delben) → after `save`, the ledger of yesterday has a check-in with slot "10:00" and `capturedAt == yesterday 10:00`; the outbox item's `date` is yesterday)

- [ ] **Step 1: Failing app test** (written; the Xcode Mac runs it; ledger note).
- [ ] **Step 2: Implement.** `RitmusEnvironment.snapshot(at:)` already takes the instant.
- [ ] **Step 3: Build the app.** Expected: `BUILD SUCCEEDED`.
- [ ] **Step 4: Commit** — `git commit -am "feat(boop): a check-in can be caught up for a day and moment, stamped at the moment's own time (mezo-r36n9.159)"`.

### Task 9: Phone — the day-close catch-up

**Files:**
- Modify: `ios/Boop/Ritmus/EsteFlow.swift` (`init(env:brief:date:)` — when `date` is given: `self.date = date`, the goal from `env.goal(on: date)` else the ledger's close, `use(brief)` with that day's brief; `closeDay` uses `now = isCatchUp ? esteCatchUpInstant(on: date) : env.clock()` for `capturedAt` of the close, the journal line and the relink; `isCatchUp` exposed), `ios/Boop/Ritmus/EsteView.swift` (`init(env:brief:date:onClose:)`; eyebrow shows the day when it is not the evening's own)
- Test: `ios/BoopTests/EsteFlowTests.swift` (+ `aCatchUpCloseIsStampedAtNineOnThatDay`: date yesterday → the queued `dayClose` item has `date == yesterday`, `capturedAt == yesterday 21:00`; the journal item too)

- [ ] **Step 1: Failing app test.** **Step 2: Implement.** **Step 3: Build.** **Step 4: Commit** — `git commit -am "feat(boop): a past day can be closed from the Napló with its own goal and brief, stamped at 21:00 (mezo-r36n9.159)"`.

### Task 10: Phone + core — the drink entrance (`.160`)

**Files:**
- Modify: `ios/BoopKit/Sources/BoopCore/Etel/MealDraft.swift` (`MealCapture.kind: MealKind = .meal`; `public enum MealKind: String, Codable, Sendable { case meal, drink; public var fixedSlot: String? { self == .drink ? "drink" : nil } }`), `ios/BoopKit/Sources/BoopCore/Etel/FoodOutbox.swift` (`MealDraftSender`: after `drafter.draft(...)`, `if let slot = capture.kind.fixedSlot { draft.slot = slot }`), `ios/BoopKit/Sources/BoopCore/Etel/FoodClient.swift` (`public static func slot(at:cal:kind:)` → `kind.fixedSlot ?? slot(at:cal:)`), `ios/BoopKit/Sources/BoopDesign/Napkelte/Glass.swift` (`"cup-cream"` drawn mug glyph in `NKGlyph.outlined`), `ios/BoopKit/Sources/BoopDesign/Napkelte/Area.swift` (no change)
- Modify: `ios/Boop/Etel/Composer.swift` (`MealStart.Entrance.drink`; `MealComposerModel.kind: MealKind` set from the start; every `FoodClient.slot(at:…)` call site (lines ~107, 130, 215, 243, 329, 339, 508, 1066) goes through `slot(at:cal:kind:)`; the usuals loader asks `food.usuals(slot: kind == .drink ? "drink" : FoodClient.slot(at:…))`; `keep(words:why:)` enqueues `MealCapture(text:barcode:kind:)`; the view: eyebrow „Ital · HH:mm", title „Mit ittál?", MIKOR ITTAD, the SZOKÁSOS ITALAID chips block above the words in drink mode (`model.usuals` loaded on appear; a chip → `model.chooseUsual(usual)`), the photo zone and the four doors (Recept · Kamra · Vonalkód · Szokásos) unchanged, the hint line „Beszámít a napi keretbe és a görbébe, de étkezési ablakot nem foglal, és pontot sem kap."), `ios/Boop/Capture/CaptureSheet.swift` (meal chip `("cup-cream", "Ital", .meal(.drink, text: ""))`), `ios/Boop/Etel/EtelRoom.swift` (action `NKAreaAction(glyph: "cup-cream", label: "Ital rögzítése") { composer = MealStart(entrance: .drink) }`; DEBUG `-etelSheet compose-drink`), `ios/Boop/Etel/EtelLogic.swift` (`etelSlotLabel("drink") → "Ital"`; `func etelDrinks(_ day: FoodDay) -> [Meal]`; `etelWindowItems` appends unclaimed **meals** only (drinks never); `etelStats` counts `day.meals.filter { $0.slot != "drink" }.count`), `ios/Boop/Etel/EtelMa.swift` (ITALOK `NKBare` under A MAI ÉTKEZÉSEK when `etelDrinks` is non-empty: rows title · „HH:mm · N kcal · P g fehérje", the cup medallion, the „ital" pill, no ring; trailing = the drinks' kcal sum), `ios/Boop/Etel/EtelHet.swift` (day sheet: no ring for a drink; the slot pill already prints `etelSlotLabel`), `ios/Boop/Shell/ShellView.swift` (`-previewOpen drink` → `meal = MealStart(entrance: .drink)`)
- Test: `ios/BoopKit/Tests/BoopCoreTests/MealCaptureKindTests.swift` (`MealCapture` round-trips `kind`, old JSON without `kind` decodes as `.meal`; `FoodClient.slot(at:cal:kind: .drink) == "drink"`), `FoodOutboxTests.swift` (+ the sender stamps `drink` on the draft of a drink capture), `ios/BoopKit/Tests/BoopDesignTests/NapkelteTokensTests.swift` (+ `cup-cream` in `outlined`), `ios/BoopTests/{MealComposerDrinkTests,EtelDrinkRowsTests}.swift` (drink mode saves slot drink whatever the door; `etelWindowItems` leaves drinks out; `etelStats` counts meals only; the ITALOK sum)

- [ ] **Step 1: Failing BoopCore tests** (`MealCaptureKindTests`, the `FoodOutboxTests` addition, the glyph assertion). Run RED (`--filter "MealCaptureKindTests|FoodOutboxTests"`; the design test runs on the Xcode Mac).
- [ ] **Step 2: Implement the core parts**; run GREEN; full native suite green.
- [ ] **Step 3: Implement the phone parts** (copy the spike's `SpikeDrink.swift` layout for the chips block and the hint; the spike's `FlowChips` → use the kit's `NKFlowRow` as `EtelHet` does).
- [ ] **Step 4: App tests written** (Xcode Mac). **Step 5: Build the app.** Expected: `BUILD SUCCEEDED`; simulator screenshots `-previewOpen drink`, `-previewHome etel -previewDrinks YES` (keep the DEBUG hook that injects two drinks into the preview day — `Etel/FoodPreview*` fixtures — so the ITALOK group is reviewable).
- [ ] **Step 6: Commit** — `git commit -am "feat(boop): the Ital entrance — usual drinks, the no-describing doors, slot drink everywhere, ITALOK on Étel Ma (mezo-r36n9.160)"`.

### Task 11: Phone + core — the Megvolt sheet (`.161`)

**Files:**
- Create: `ios/BoopKit/Sources/BoopCore/Train/AsPlanned.swift` — `public struct AsPlannedRow: Equatable, Identifiable, Sendable { id: UUID (exercise); name: String; setsText: String; needsWeight: Bool }`; `public func asPlannedRows(_ workout: TodayWorkout, overrides: [UUID: Double]) -> [AsPlannedRow]` (`"3 × 8 · 60 kg"` from `workingCount` × first working `PrescribedSet.targetReps` · `targetKg` (override wins; „62,5 kg" with a comma); no weight → `"3 × 15 · – kg · írd be"`, `needsWeight = true`); `public func asPlannedDefaultTime(session: String?, on day: String, calendar: Calendar) -> Date` (the day's planned session time `HH:mm`, else 18:00); `public struct WorkoutAsPlannedPayload: Codable, Equatable, Sendable { templateSessionId: UUID; date: String; startedAt: Date; overrides: [Override] }`, `public struct Override: Codable, Equatable, Sendable { exerciseId: UUID; weightKg: Double }`; `public func asPlannedPayload(workout: TodayWorkout, date: String, startedAt: Date, overrides: [UUID: Double]) -> WorkoutAsPlannedPayload?` (nil without `templateSessionId`; only typed overrides)
- Modify: `ios/BoopKit/Sources/BoopCore/Ritmus/Outbox.swift` (`case workoutAsPlanned` — comment **never rename**; group `("workout|\(item.id.uuidString)", false)`), `ios/BoopKit/Sources/BoopCore/Ritmus/RitmusClient.swift` (route `.workoutAsPlanned` to `train.send`), `ios/BoopKit/Sources/BoopCore/Train/TrainClient.swift` (`sendAsPlanned(item)` → `client.completeWorkoutAsPlanned(body:)` with `clientRef = item.id`; 201 → `.sent`; 400/404 → `.failed`; 409 → `.failed("…")` with the server's message so the row can say „Ezen a héten már megvolt." / „Előbb fejezd be a futó edzést."; `TrainPayloadCodec` encodes the payload), `ios/Boop/Ritmus/RitmusEnvironment.swift` (`func captureWorkoutAsPlanned(_ payload: WorkoutAsPlannedPayload) async throws` → outbox item `kind: .workoutAsPlanned, date: payload.date, capturedAt: payload.startedAt`; `edzesTick += 1`), `ios/Boop/Edzes/EdzesStore.swift` (re-read `weekDoneDates`/history on `edzesTick`, as the player's finish does)
- Create: `ios/Boop/Edzes/WorkoutAsPlanned.swift` — `struct WorkoutAsPlannedSheet: View { init(templateSessionId: UUID, date: String, title: String, onDone: @escaping (String?) -> Void) }` + `@MainActor @Observable final class WorkoutAsPlannedModel` (loads `TrainClient.todayWorkout(templateSessionId:)`, rows via `asPlannedRows`, `overrides: [UUID: Double]`, `time: Date` default via `asPlannedDefaultTime`, `book()` → `ritmus.captureWorkoutAsPlanned(...)`, toast `whenToast("Edzés könyvelve", choice: …)`); the view follows the spike's `SpikeMegvolt.swift` (rows; a tap on a row's weight opens a `NKScale`-free number field: a small `TextField` with the decimal pad in a glass box under the row; MIKOR row with „A terv ideje · Más időpont" and the compact time picker; the explanatory line; `QuickFoot("Megvolt")`; busy/error states)
- Test: `ios/BoopKit/Tests/BoopCoreTests/AsPlannedTests.swift` (rows text, comma decimals, needsWeight, default time, payload keeps only typed overrides, nil without template id), `OutboxTests.swift` (+ the new kind's group stands alone), `TrainAsPlannedClientTests.swift` (stub transport: 201 → `.sent`, 409 → `.failed` carrying the message), `ios/BoopTests/WorkoutAsPlannedModelTests.swift` (Xcode Mac)

- [ ] **Step 1: Failing BoopCore tests** (`--filter "AsPlannedTests|OutboxTests|TrainAsPlannedClientTests"`). Expected: FAIL.
- [ ] **Step 2: Implement the core parts**; GREEN; full native suite green.
- [ ] **Step 3: Implement the sheet, the model, the environment capture and the Napló door** (Task 7's `.gym` cover opens `WorkoutAsPlannedSheet(templateSessionId: catchUps.gymTemplateId!, date:, title:)`).
- [ ] **Step 4: Build the app;** screenshot `-previewOpen megvolt` (the shell hook opens the sheet on the preview block's first template day for yesterday).
- [ ] **Step 5: Commit** — `git commit -am "feat(boop): Megvolt — a past template day booked as planned, offline-first, one weight per exercise editable (mezo-r36n9.161)"`.

### Task 12: Docs, handbook, tracker rows, handover

**Files:**
- Modify: `docs/features/boop-ios.md` (§2: the Mikor row, the Napló catch-ups, the drink mode, Megvolt; §4: the two operations; §8 tests; §9 gotchas: catch-up instants, drink kind offline, sheet-in-sheet covers; §10 files), `docs/features/fuel.md` (drink slot rules + the DB CHECK), `docs/features/train.md` (as-planned endpoint + `client_ref`), `docs/features/me.md` (check-in catch-up posts a past slot), `docs/features/journal.md` (`listJournalEntries` now read by the phone), `docs/features/dayclose.md` (date bump + the catch-up instant), `ios/README.md` (flags `-previewWhen tegnap`, `-previewOpen drink|megvolt|naploDay`, `-previewCatchup YES`, `-previewDrinks YES`)
- Handbook: `docs/boop-handbook/01-alapok/gyors-rogzites.md` (the Mikor row; the Ital door), `03-naplo/napok-lista.md` (the week always; the day's PÓTLÁS block; A NAP SORAI), `03-naplo/check-in.md` (pótlás), `03-naplo/esti-zaras.md` (pótlás), create `06-etel/11-italok.md` (format per the folder README), update `06-etel/02-etkezes-rogzitese.md` (Tegnap, Ital), create `07-edzes/<nn>-edzes-potlasa.md`, `README.md` folder rows if the folder README lists pages; `_funkciok.json` (meal/drink row `app: Kész`, train as-planned row new), `_kiadasok.json` (key = the merge sha, after the merge), `_jegyek.json` states follow bd.
- `docs/guides/boop-telefon-telepites-atado-2026-11-23.md`: „Negyedik csomag" section (what to check on the phone; the new tests).
- `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` → PASS.

- [ ] **Step 1:** write the docs after the code commits (lint-docs flags docs committed before code). **Step 2:** run codemap + lint-docs; Expected: PASS 0 stale / 0 error. **Step 3:** commit `docs(boop): …` on the branch; the release row and tracker backup come with the merge commit as in the previous slices.

---

## Self-review

- **Spec coverage:** §3.1 → Task 3; §3.2 → Task 4; §3.3 → Task 5; §3.4 → Tasks 6, 7; §3.5 → Tasks 8, 9; §3.6 → Tasks 2, 11; §3.7 → Tasks 1, 10; §7 → Tasks 1, 2; §8 → Tasks 3–11; §10 docs → Task 12. The water/supplement sheets stay untouched (non-goal). The „utólag" tag is out (§9).
- **Type consistency:** `WhenChoice`/`whenResolved`/`whenToast` used in Tasks 4, 5, 11 as defined in Task 3; `NaploCatchUps.compute` (Task 6) consumed by Task 7's model; `CheckInMoment.time(on:calendar:)` (Task 6) used in Task 8; `esteCatchUpInstant(on:calendar:)` (Task 6) used in Task 9; `WorkoutAsPlannedPayload` (Task 11) matches the contract of Task 2 (`templateSessionId, date, startedAt, clientRef = item id, overrides[]`); `MealKind.fixedSlot` (Task 10) feeds `FoodClient.slot(at:cal:kind:)`.
- **Review Focus pinned:** 1 → Task 10 `FoodOutboxTests`; 2 → Task 3 `yesterdayAtTwentyThreeThirtyStaysYesterday`; 3 → Task 6 `todayOffersOnlyPassedMissingMoments`; 4 → Task 2 `aTemplateOutsideTheOwnersBlockIsNotFound`; 5 → Task 4 `sleepNoteOnlyForAPastMorning`.
- **Proportion:** signatures and test names, bodies only where the spec fixes copy or an algorithm; the spike commit `bb74c2333` is the visual reference for every new view.
