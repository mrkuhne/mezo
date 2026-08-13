# Pattern-katalógus bővítés + AI-kontextus (V3.4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 19 új `MetricKey` + 21 új katalógus-pár (össz 31 metrika / 29 pár), futás-szintű sorozat-cache a `detect()`-ben, digest-gazdagítás minőségi mezőkkel, heti metrika-tábla + kapu-diagnosztika a hipotézis-`gather()`-ben.

**Architecture:** Tisztán additív bővítés a V3.1 pattern-motoron: minden új metrika egy `MetricKey` enum-tag + egy extraktor a `MetricSeriesService`-ben; a párok YAML-katalógus-sorok (`mezo.companion.patterns.pairs`) — se új tábla, se contract-változás, se FE-munka. A B-tételek a `DailySummaryService.digest` és a `HypothesisPipelineService.gather` bővítései.

**Tech Stack:** Spring Boot 4 / Java 21, Maven, Postgres (compose a :15432-n), AssertJ + `AbstractIntegrationTest` (fixed `mezo_test` DB, `companion-fake` profil).

**Spec:** [`docs/superpowers/specs/2026-08-11-pattern-catalog-expansion-design.md`](../specs/2026-08-11-pattern-catalog-expansion-design.md) · **bd:** `mezo-6ha5`

## Global Constraints

- Aggregálási elv változatlan: **hiányzó nap = nincs adat, sosem találunk ki értéket** (kivétel: a derivált naptári sorozatok — `weekend`, ACWR/monotónia napi terhelése, `ritual-closed` — ahol a 0 valódi tény).
- Pár-kulcs = stabil identitás, élőben soha nem nevezzük át; kulcs-regex `[a-z0-9~-]{3,64}`; kategória ∈ `physiology|trigger|response`.
- Configérték soha nem hardcode: minden tunable a `mezo.companion.*` alá, `CompanionProperties` `@Validated` rekordmezőként (`configuration_conventions.md`).
- Backend teszt: integration-first, `test{Method}_should{Result}_when{Condition}`, AssertJ, populator-adat, NO mock/H2 (`testing_standards.md`, `integration_test_framework.md`).
- Build mindig `./mvnw clean test` (Lombok+MapStruct inkrementális fordítás flaky).
- Commit-subject: `feat(companion): … (mezo-6ha5)` konvenció.
- **Spec-eltérések (dokumentálandók a companion.md-ben, Task 9):**
  - `sourceHu` mező NEM kerül a `MetricKey`-be — a monitor (mezo-viqs) enélkül shipppelt, a contract `PatternMetricCoverage`-ében nincs ilyen mező, fogyasztó nélkül dead code lenne.
  - `reta-dose-mg` forrása a **dózis-log** (`MedicationDoseEntity.dose`, az adott napon-vagy-előtte utolsó beadás), nem a cycle JSON — a `MedicationCycleJson`-ban nincs dózis-lépcső, csak fázis-címkék.
  - A bd-issue "20 metrika / 32 össz" szövege elavult: a 2026-08-11-i gyűjtő-UI audit után a spec 19 új metrikát (össz 31) rögzít (deep-min kikerült).

## File Structure

| Fájl | Felelősség |
|---|---|
| `backend/.../feature/companion/service/MetricKey.java` | +19 enum-tag (labelHu) |
| `backend/.../feature/companion/service/MetricSeriesService.java` | +extraktorok (switch-ágak + privát metódusok); új read-only repo-függőségek + `CompanionProperties` |
| `backend/.../feature/companion/service/PatternGate.java` | +statikus `window()` helper (detect + monitor közös) |
| `backend/.../feature/companion/service/PatternDetectionService.java` | futás-szintű `EnumMap` sorozat-cache |
| `backend/.../feature/companion/service/PatternMonitorService.java` | saját `window()` → `PatternGate.window` |
| `backend/.../feature/companion/service/DailySummaryService.java` | digest-gazdagítás (B1) |
| `backend/.../feature/companion/service/HypothesisPipelineService.java` | gather: metrika-tábla (B2) + kapu-diagnosztika (B3); `gather()` package-private |
| `backend/.../feature/companion/config/CompanionProperties.java` | `Patterns.loadGymKgPerMin`, `Summary.noteMaxChars` |
| `backend/src/main/resources/application.yml` | 21 új pair-bejegyzés + 2 új configérték |
| `backend/.../feature/ritual/repository/RitualDayRepository.java` | +2 derived finder |
| Populátorok (`support/populator/`) | CheckIn/Train/SleepLog overloadok |
| `backend/src/test/.../feature/companion/MetricSeriesExpansionIT.java` | ÚJ — közvetlen metrikák extraktor-IT-i |
| `backend/src/test/.../feature/companion/MetricSeriesDerivedIT.java` | ÚJ — derivált metrikák extraktor-IT-i |
| `backend/src/test/.../feature/companion/service/HypothesisGatherContextIT.java` | ÚJ — gather-kontextus IT |
| `docs/features/companion.md` | metrika-tábla + katalógus + gather/digest szakaszok |

---

### Task 1: Gym-feedback + check-in metrikák (`gym-workload`, `gym-joint-pain`, `checkin-body`, `checkin-mental`)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricKey.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricSeriesService.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/TrainPopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/CheckInPopulator.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/MetricSeriesExpansionIT.java`

**Interfaces:**
- Consumes: `WorkoutSessionRepository.findDoneInstancesBetween(userId, from, to)`, `ExerciseFeedbackRepository.findByCreatedByAndWorkoutSessionId(userId, sessionId)` (léteznek), meglévő `checkIn(...)` + `average(...)` helper a service-ben.
- Produces: `MetricKey.GYM_WORKLOAD/GYM_JOINT_PAIN/CHECKIN_BODY/CHECKIN_MENTAL` (wire: `gym-workload`, `gym-joint-pain`, `checkin-body`, `checkin-mental`); populator-overloadok: `TrainPopulator.createFeedback(UUID, UUID, UUID, int pump, int jointPain, int workload)`, `CheckInPopulator.createCheckIn(UUID, LocalDate, String, Integer energy, Integer stress, Integer body, Integer mental, String note)`.

- [ ] **Step 1: Populator-overloadok**

`TrainPopulator`-ban a meglévő `createFeedback` delegáljon az újra:

```java
public ExerciseFeedbackEntity createFeedback(UUID createdBy, UUID workoutSessionId, UUID exerciseId) {
    return createFeedback(createdBy, workoutSessionId, exerciseId, 3, 1, 2);
}

/** Explicit értékű set-debrief — a metrika-extraktor IT-k vezérléséhez. */
public ExerciseFeedbackEntity createFeedback(UUID createdBy, UUID workoutSessionId, UUID exerciseId,
    int pump, int jointPain, int workload) {
    ExerciseFeedbackEntity f = new ExerciseFeedbackEntity();
    f.setCreatedBy(createdBy);
    f.setWorkoutSessionId(workoutSessionId);
    f.setExerciseId(exerciseId);
    f.setPump(pump);
    f.setJointPain(jointPain);
    f.setWorkload(workload);
    return exerciseFeedbackRepository.saveAndFlush(f);
}
```

`CheckInPopulator`-ban ugyanígy (a meglévő fix `body=3, mental=3` értékek az új overloadba paraméterként mennek; a régi szignatúra `createCheckIn(owner, date, slotTime, energy, stress, 3, 3, note)`-ra delegál).

- [ ] **Step 2: Failing test**

Új fájl `backend/src/test/java/io/mrkuhne/mezo/feature/companion/MetricSeriesExpansionIT.java` (a `MetricSeriesServiceIT` mintájára — `@Transactional`, `@ActiveProfiles("companion-fake")`, `extends AbstractIntegrationTest`):

```java
/**
 * V3.4 katalógus-bővítés (mezo-6ha5): az új KÖZVETLEN metrikák extraktorai populator-adat felett —
 * nap-aggregálás (átlag vs csúcs-érzékeny max), ablak-határok, hiányzó nap = nincs adatpont.
 */
@Transactional
@ActiveProfiles("companion-fake")
class MetricSeriesExpansionIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 6, 20);

    @Autowired private MetricSeriesService metricSeriesService;
    @Autowired private UserPopulator userPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private CheckInPopulator checkInPopulator;

    /** Egy befejezett workout-instance DAY-en két gyakorlattal + két feedbackkel. */
    private UUID seedFeedbackDay(UUID owner, int workloadA, int painA, int workloadB, int painB) {
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "V3.4 meso", "active");
        WorkoutSessionEntity template = trainPopulator.createWorkoutSession(
                owner, meso.getId(), "H", "Pull Day", 0, "planned");
        ExerciseEntity exA = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        ExerciseEntity exB = trainPopulator.createExercise(owner, template.getId(), "Curl", 1);
        WorkoutSessionEntity instance = trainPopulator.createWorkoutInstance(
                owner, template, DAY, "completed");
        trainPopulator.createFeedback(owner, instance.getId(), exA.getId(), 3, painA, workloadA);
        trainPopulator.createFeedback(owner, instance.getId(), exB.getId(), 3, painB, workloadB);
        return instance.getId();
    }

    @Test
    void testSeries_shouldAverageWorkload_whenMultipleFeedbacksOnDay() {
        UUID owner = userPopulator.createUser().getId();
        seedFeedbackDay(owner, 1, 1, 3, 1);

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.GYM_WORKLOAD, DAY.minusDays(7), DAY);

        assertThat(series).containsOnlyKeys(DAY);
        assertThat(series.get(DAY)).isEqualTo(2.0);
    }

    @Test
    void testSeries_shouldTakeMaxJointPain_whenMultipleFeedbacksOnDay() {
        UUID owner = userPopulator.createUser().getId();
        seedFeedbackDay(owner, 2, 1, 2, 3);

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.GYM_JOINT_PAIN, DAY.minusDays(7), DAY);

        assertThat(series.get(DAY)).isEqualTo(3.0); // a fájdalom csúcs-érzékeny
    }

    @Test
    void testSeries_shouldAverageBodyAndMental_whenMultipleCheckInsPerDay() {
        UUID owner = userPopulator.createUser().getId();
        checkInPopulator.createCheckIn(owner, DAY, "08:00", 3, 2, 2, 4, null);
        checkInPopulator.createCheckIn(owner, DAY, "20:00", 3, 2, 4, 2, null);

        assertThat(metricSeriesService.series(owner, MetricKey.CHECKIN_BODY, DAY, DAY).get(DAY))
                .isEqualTo(3.0);
        assertThat(metricSeriesService.series(owner, MetricKey.CHECKIN_MENTAL, DAY, DAY).get(DAY))
                .isEqualTo(3.0);
    }
}
```

- [ ] **Step 3: Run — FAIL** (`GYM_WORKLOAD` nem létezik → fordítási hiba)

```bash
cd backend && ./mvnw clean test -Dtest=MetricSeriesExpansionIT
```

- [ ] **Step 4: Implementáció**

`MetricKey`-be (a `CHECKIN_ENERGY` után, a `;`-t áthelyezve):

```java
    CHECKIN_ENERGY("energia-szint"),
    GYM_WORKLOAD("gym-terhelésérzet"),
    GYM_JOINT_PAIN("ízületi fájdalom"),
    CHECKIN_BODY("testérzet"),
    CHECKIN_MENTAL("mentális állapot");
```

`MetricSeriesService`: új mező `private final ExerciseFeedbackRepository exerciseFeedbackRepository;` (import: `io.mrkuhne.mezo.feature.train.entity.ExerciseFeedbackEntity`, `io.mrkuhne.mezo.feature.train.repository.ExerciseFeedbackRepository`), switch-ágak:

```java
    case GYM_WORKLOAD -> gymFeedback(userId, from, to, ExerciseFeedbackEntity::getWorkload, false);
    case GYM_JOINT_PAIN -> gymFeedback(userId, from, to, ExerciseFeedbackEntity::getJointPain, true);
    case CHECKIN_BODY -> checkIn(userId, from, to, CheckInEntity::getBody);
    case CHECKIN_MENTAL -> checkIn(userId, from, to, CheckInEntity::getMental);
```

és a privát extraktor:

```java
    private interface FeedbackValue {
        Integer value(ExerciseFeedbackEntity feedback);
    }

    /** Set-debrief jelek a nap befejezett edzései felett — workload átlag, fájdalom csúcs (max). */
    private Map<LocalDate, Double> gymFeedback(UUID userId, LocalDate from, LocalDate to,
                                               FeedbackValue extractor, boolean peak) {
        Map<LocalDate, List<Double>> perDay = new HashMap<>();
        for (WorkoutSessionEntity session : workoutSessionRepository.findDoneInstancesBetween(userId, from, to)) {
            if (session.getDate() == null) {
                continue;
            }
            for (ExerciseFeedbackEntity feedback : exerciseFeedbackRepository
                    .findByCreatedByAndWorkoutSessionId(userId, session.getId())) {
                Integer value = extractor.value(feedback);
                if (value != null) {
                    perDay.computeIfAbsent(session.getDate(), d -> new ArrayList<>()).add(value.doubleValue());
                }
            }
        }
        if (!peak) {
            return average(perDay);
        }
        Map<LocalDate, Double> series = new HashMap<>();
        perDay.forEach((day, values) -> series.put(day,
                values.stream().mapToDouble(Double::doubleValue).max().orElseThrow()));
        return series;
    }
```

- [ ] **Step 5: Run — PASS**

```bash
cd backend && ./mvnw clean test -Dtest=MetricSeriesExpansionIT
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricKey.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricSeriesService.java backend/src/test/java/io/mrkuhne/mezo/support/populator/TrainPopulator.java backend/src/test/java/io/mrkuhne/mezo/support/populator/CheckInPopulator.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/MetricSeriesExpansionIT.java
git commit -m "feat(companion): gym-feedback + check-in body/mental metrikák (mezo-6ha5)"
```

---

### Task 2: Alvás-óra metrikák (`bedtime-hour`, `wakeup-hour`, `sleep-awakenings`)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricKey.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricSeriesService.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/SleepLogPopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/MetricSeriesExpansionIT.java`

**Interfaces:**
- Consumes: a service meglévő `sleep(userId, from, to, SleepValue)` helperje (több sor esetén `Math::max` merge); `SleepLogEntity.getBedtime()/getWakeup()` `"H:mm"`/`"HH:mm"` string, `getAwakenings()` Integer.
- Produces: `MetricKey.BEDTIME_HOUR/WAKEUP_HOUR/SLEEP_AWAKENINGS` (wire: `bedtime-hour`, `wakeup-hour`, `sleep-awakenings`); `private static Double clockHour(String clock, boolean shiftPastMidnight)` (Task 5 is használja); populator-overload: `SleepLogPopulator.createSleepLog(UUID, LocalDate, String bedtime, String wakeup, BigDecimal durationH, Integer quality, Integer awakenings, String notes)`.

- [ ] **Step 1: Populator-overload**

```java
    /** Teljes alvás-sor a V3.4 extraktor/digest IT-khez — minden mező explicit. */
    public SleepLogEntity createSleepLog(UUID owner, LocalDate date, String bedtime, String wakeup,
        BigDecimal durationH, Integer quality, Integer awakenings, String notes) {
        SleepLogEntity e = new SleepLogEntity();
        e.setCreatedBy(owner);
        e.setDate(date);
        e.setBedtime(bedtime);
        e.setWakeup(wakeup);
        e.setDurationH(durationH);
        e.setQuality(quality);
        e.setAwakenings(awakenings);
        e.setNotes(notes);
        return sleepLogRepository.saveAndFlush(e);
    }
```

- [ ] **Step 2: Failing test** — a `MetricSeriesExpansionIT`-be (`SleepLogPopulator` autowire hozzáadásával):

```java
    @Test
    void testSeries_shouldShiftPastMidnightBedtimePlus24_whenBedtimeAfterMidnight() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, DAY, "23:15", "06:30", new BigDecimal("7.0"), 4, 0, null);
        sleepLogPopulator.createSleepLog(owner, DAY.minusDays(1), "0:30", "07:00", new BigDecimal("6.5"), 3, 1, null);

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.BEDTIME_HOUR, DAY.minusDays(7), DAY);

        assertThat(series.get(DAY)).isEqualTo(23.25);
        assertThat(series.get(DAY.minusDays(1))).isEqualTo(24.5); // éjfél utáni óra +24
    }

    @Test
    void testSeries_shouldReturnPlainFractionalWakeup_whenWakeupLogged() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, DAY, "22:00", "06:30", new BigDecimal("8.0"), 4, 0, null);

        assertThat(metricSeriesService.series(owner, MetricKey.WAKEUP_HOUR, DAY, DAY).get(DAY))
                .isEqualTo(6.5); // ébredésnél nincs +24 eltolás
    }

    @Test
    void testSeries_shouldTakeMaxAwakenings_whenMultipleRowsOnDay() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, DAY, "22:00", "06:00", new BigDecimal("7.0"), 4, 1, null);
        sleepLogPopulator.createSleepLog(owner, DAY, "23:00", "06:30", new BigDecimal("6.0"), 3, 3, null);

        assertThat(metricSeriesService.series(owner, MetricKey.SLEEP_AWAKENINGS, DAY, DAY).get(DAY))
                .isEqualTo(3.0);
    }

    @Test
    void testSeries_shouldSkipRow_whenBedtimeMalformed() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, DAY, "későn", "06:30", new BigDecimal("7.0"), 4, 0, null);

        assertThat(metricSeriesService.series(owner, MetricKey.BEDTIME_HOUR, DAY, DAY)).isEmpty();
    }
```

- [ ] **Step 3: Run — FAIL**

```bash
cd backend && ./mvnw clean test -Dtest=MetricSeriesExpansionIT
```

- [ ] **Step 4: Implementáció** — enum-tagok: `BEDTIME_HOUR("lefekvés ideje")`, `WAKEUP_HOUR("ébredés ideje")`, `SLEEP_AWAKENINGS("éjszakai ébredések")`; switch-ágak + parse-helper:

```java
    case BEDTIME_HOUR -> sleep(userId, from, to, s -> clockHour(s.getBedtime(), true));
    case WAKEUP_HOUR -> sleep(userId, from, to, s -> clockHour(s.getWakeup(), false));
    case SLEEP_AWAKENINGS -> sleep(userId, from, to, s ->
            s.getAwakenings() == null ? null : s.getAwakenings().doubleValue());
```

```java
    /**
     * "H:mm"/"HH:mm" óra-string → törtóra; lefekvésnél az éjfél utáni óra +24 (01:00 → 25.0,
     * dél előtti cutoff), hogy a sorozat monoton maradjon a "későn feküdt" tengelyen.
     * Hibás/hiányzó string → null (nincs adatpont, sosem találunk ki értéket).
     */
    private static Double clockHour(String clock, boolean shiftPastMidnight) {
        if (clock == null || !clock.matches("\\d{1,2}:\\d{2}")) {
            return null;
        }
        String[] parts = clock.split(":");
        int hour = Integer.parseInt(parts[0]);
        int minute = Integer.parseInt(parts[1]);
        if (hour > 23 || minute > 59) {
            return null;
        }
        double fractional = hour + minute / 60.0;
        return shiftPastMidnight && hour < 12 ? fractional + 24 : fractional;
    }
```

- [ ] **Step 5: Run — PASS** (ugyanaz a parancs)

- [ ] **Step 6: Commit**

```bash
git add -A backend/src
git commit -m "feat(companion): bedtime/wakeup törtóra + awakenings metrikák (mezo-6ha5)"
```

---

### Task 3: Fuel + gyógyszer metrikák (`daily-protein-g`, `meal-score`, `reta-dose-mg`)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricKey.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricSeriesService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/MetricSeriesExpansionIT.java`

**Interfaces:**
- Consumes: `FuelDayService.getDay(userId, day)` → `FuelDayResponse.getConsumed().getP()` (a meglévő `dailyKcal` mintája); `MealEntity.getScore()`; `MedicationDoseRepository.findFirstByCreatedByAndMedicationIdAndDeletedFalseAndAdministeredDateLessThanEqualOrderByAdministeredDateDesc(...)` (a `DailySummaryService` már használja); populátorok: `MealPopulator.createScoredMeal(owner, pantryItem, mealDate, title, loggedAt)` (fix 0.62 score), `PantryItemPopulator.createFoodWithNutrients(owner, name)`, `MedicationPopulator.createReta(owner)`, `MedicationDosePopulator.createDose(owner, medId, date, dose)`.
- Produces: `MetricKey.DAILY_PROTEIN_G/MEAL_SCORE/RETA_DOSE_MG` (wire: `daily-protein-g`, `meal-score`, `reta-dose-mg`); a `dailyKcal` általánosítása `fuelRollup(...)`-ra. Új service-függőség: `MedicationDoseRepository`.

- [ ] **Step 1: Failing test** — `MetricSeriesExpansionIT`-be (autowire: `MealPopulator`, `PantryItemPopulator`, `MedicationPopulator`, `MedicationDosePopulator`):

```java
    @Test
    void testSeries_shouldReturnProteinOnMealDaysOnly_whenMealsLogged() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity food = pantryItemPopulator.createFoodWithNutrients(owner, "Csirkemell");
        mealPopulator.createPantryMeal(owner, food, DAY);

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.DAILY_PROTEIN_G, DAY.minusDays(7), DAY);

        assertThat(series).containsOnlyKeys(DAY);
        assertThat(series.get(DAY)).isGreaterThan(0);
    }

    @Test
    void testSeries_shouldAverageMealScores_whenScoredMealsExist() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity food = pantryItemPopulator.createFoodWithNutrients(owner, "Zabkása");
        mealPopulator.createScoredMeal(owner, food, DAY, "Reggeli",
                DAY.atStartOfDay(ZoneOffset.UTC).toInstant());

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.MEAL_SCORE, DAY, DAY);

        assertThat(series.get(DAY)).isEqualTo(0.62); // score-atlan meal nem ad pontot
    }

    @Test
    void testSeries_shouldCarryLastDoseForward_whenDoseAdministeredEarlier() {
        UUID owner = userPopulator.createUser().getId();
        MedicationEntity med = medicationPopulator.createReta(owner);
        medicationDosePopulator.createDose(owner, med.getId(), DAY.minusDays(2), new BigDecimal("6"));

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.RETA_DOSE_MG, DAY.minusDays(3), DAY);

        assertThat(series.get(DAY.minusDays(3))).isNull(); // dózis-horgony előtt nincs adat
        assertThat(series.get(DAY.minusDays(2))).isEqualTo(6.0);
        assertThat(series.get(DAY)).isEqualTo(6.0); // az aktuális dózis-szint továbbél
    }
```

- [ ] **Step 2: Run — FAIL**

```bash
cd backend && ./mvnw clean test -Dtest=MetricSeriesExpansionIT
```

- [ ] **Step 3: Implementáció** — enum: `DAILY_PROTEIN_G("napi fehérje")`, `MEAL_SCORE("étkezés-pontszám")`, `RETA_DOSE_MG("Reta-dózis")`; a `dailyKcal` általánosítása + új ágak:

```java
    case DAILY_KCAL -> fuelRollup(userId, from, to, consumed -> consumed.getKcal());
    case DAILY_PROTEIN_G -> fuelRollup(userId, from, to, consumed -> consumed.getP());
    case MEAL_SCORE -> mealScore(userId, from, to);
    case RETA_DOSE_MG -> retaDose(userId, from, to);
```

```java
    private interface FuelValue {
        BigDecimal value(io.mrkuhne.mezo.api.dto.MacroBlock consumed);
    }

    /** Napi fuel-rollup — csak étkezéses napok (a DAILY_KCAL eredeti mintája, mezőre paraméterezve). */
    private Map<LocalDate, Double> fuelRollup(UUID userId, LocalDate from, LocalDate to, FuelValue extractor) {
        Map<LocalDate, Double> series = new HashMap<>();
        List<LocalDate> mealDays = mealRepository.findAllOwned(userId).stream()
                .map(MealEntity::getMealDate)
                .filter(d -> !d.isBefore(from) && !d.isAfter(to))
                .distinct()
                .toList();
        for (LocalDate day : mealDays) {
            FuelDayResponse fuelDay = fuelDayService.getDay(userId, day);
            BigDecimal value = extractor.value(fuelDay.getConsumed());
            if (value != null && value.signum() > 0) {
                series.put(day, value.doubleValue());
            }
        }
        return series;
    }

    /** A nap score-olt étkezéseinek átlaga (score nélküli meal nem adatpont). */
    private Map<LocalDate, Double> mealScore(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, List<Double>> perDay = new HashMap<>();
        for (MealEntity meal : mealRepository.findAllOwned(userId)) {
            if (meal.getMealDate().isBefore(from) || meal.getMealDate().isAfter(to)
                    || meal.getScore() == null) {
                continue;
            }
            perDay.computeIfAbsent(meal.getMealDate(), d -> new ArrayList<>())
                    .add(meal.getScore().doubleValue());
        }
        return average(perDay);
    }

    /**
     * Aktuális dózis-szint naponta: az adott napon-vagy-előtte utolsó beadott dózis (a ciklusnap-
     * deriválás horgony-mintája). Az első beadás előtti napokra nincs adat — honest absence.
     */
    private Map<LocalDate, Double> retaDose(UUID userId, LocalDate from, LocalDate to) {
        MedicationEntity med = medicationRepository
                .findFirstByCreatedByAndActiveTrueAndDeletedFalse(userId).orElse(null);
        if (med == null) {
            return Map.of();
        }
        Map<LocalDate, Double> series = new HashMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            LocalDate current = day;
            medicationDoseRepository
                    .findFirstByCreatedByAndMedicationIdAndDeletedFalseAndAdministeredDateLessThanEqualOrderByAdministeredDateDesc(
                            userId, med.getId(), day)
                    .ifPresent(dose -> {
                        if (dose.getDose() != null) {
                            series.put(current, dose.getDose().doubleValue());
                        }
                    });
        }
        return series;
    }
```

Új mező: `private final MedicationDoseRepository medicationDoseRepository;`. A `FuelValue` interfész paramétertípusát a `FuelDayResponse.getConsumed()` TÉNYLEGES visszatérési típusához igazítsd (a generált api.dto-ból — nézd meg a `FuelDayResponse`-t; ha nem `MacroBlock` a neve, használd azt).

- [ ] **Step 4: Run — PASS**, majd a régi kcal-teszt is:

```bash
cd backend && ./mvnw clean test -Dtest='MetricSeriesExpansionIT,MetricSeriesServiceIT'
```

- [ ] **Step 5: Commit**

```bash
git add -A backend/src
git commit -m "feat(companion): fehérje-, meal-score- és Reta-dózis metrikák (mezo-6ha5)"
```

---

### Task 4: Growth/social/futás metrikák (`habits-done`, `ritual-closed`, `daily-xp`, `social-mentions`, `run-hr-recovery-s`)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricKey.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricSeriesService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/ritual/repository/RitualDayRepository.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/MetricSeriesExpansionIT.java`

**Interfaces:**
- Consumes: `HabitDayRepository.findByCreatedByAndHabitDateBetween`, `ActivityLogRepository.findByCreatedByAndOccurredOnBetween`, `DailyQuestRepository.findByCreatedByAndQuestDateBetweenOrderByQuestDateDesc`, `MentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc`, `RunSessionLogRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc` (léteznek); populátorok: `HabitPopulator.row(owner, date, key, status)`, `RitualPopulator.closedDay(owner, date)`, `ActivityPopulator.activity(owner, day, text, skillKey, xpAwarded, categorizedBy)`, `QuestPopulator.quest(...)`, `MentionPopulator.createMention(owner, personId, ts, tone)`, `PersonPopulator.createPerson(owner, name)`, `RunningPopulator.createBlock(...)` + `createRunLog(...)`.
- Produces: `MetricKey.HABITS_DONE/RITUAL_CLOSED/DAILY_XP/SOCIAL_MENTIONS/RUN_HR_RECOVERY_S` (wire: `habits-done`, `ritual-closed`, `daily-xp`, `social-mentions`, `run-hr-recovery-s`); új repo-finderek: `RitualDayRepository.findByCreatedByAndRitualDateBetween(UUID, LocalDate, LocalDate)` és `findFirstByCreatedByOrderByRitualDateAsc(UUID)`. Új service-függőségek: `HabitDayRepository`, `RitualDayRepository`, `ActivityLogRepository`, `DailyQuestRepository`, `MentionRepository`.

- [ ] **Step 1: RitualDayRepository finderek**

```java
    List<RitualDayEntity> findByCreatedByAndRitualDateBetween(UUID createdBy, LocalDate from, LocalDate to);

    Optional<RitualDayEntity> findFirstByCreatedByOrderByRitualDateAsc(UUID createdBy);
```

- [ ] **Step 2: Failing test** — `MetricSeriesExpansionIT`-be (autowire: `HabitPopulator`, `RitualPopulator`, `ActivityPopulator`, `QuestPopulator`, `MentionPopulator`, `PersonPopulator`, `RunningPopulator`):

```java
    @Test
    void testSeries_shouldCountDoneHabits_whenDayHasHabitRows() {
        UUID owner = userPopulator.createUser().getId();
        habitPopulator.row(owner, DAY, "wake_on_time", "done");
        habitPopulator.row(owner, DAY, "protein_target", "done");
        habitPopulator.row(owner, DAY, "bed_on_time", "missed");
        habitPopulator.row(owner, DAY.minusDays(1), "wake_on_time", "missed");

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.HABITS_DONE, DAY.minusDays(7), DAY);

        assertThat(series.get(DAY)).isEqualTo(2.0);
        assertThat(series.get(DAY.minusDays(1))).isEqualTo(0.0); // van sor, nincs done → valódi 0
        assertThat(series).doesNotContainKey(DAY.minusDays(2)); // sor nélküli nap = nincs adat
    }

    @Test
    void testSeries_shouldEmitBinaryRitualSeries_fromFirstAdoptionDay() {
        UUID owner = userPopulator.createUser().getId();
        ritualPopulator.closedDay(owner, DAY.minusDays(2));
        ritualPopulator.closedDay(owner, DAY);

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.RITUAL_CLOSED, DAY.minusDays(7), DAY);

        assertThat(series).containsOnlyKeys(DAY.minusDays(2), DAY.minusDays(1), DAY);
        assertThat(series.get(DAY.minusDays(1))).isEqualTo(0.0); // adopció utáni le-nem-zárt nap = 0
        assertThat(series.get(DAY)).isEqualTo(1.0);
    }

    @Test
    void testSeries_shouldSumXpAcrossSources_whenActivityHabitAndQuestAwardXp() {
        UUID owner = userPopulator.createUser().getId();
        activityPopulator.activity(owner, DAY, "Olvasás", "mindset", 15, "ai");
        HabitDayEntity habit = habitPopulator.row(owner, DAY, "wake_on_time", "done");
        habit.setXpAwarded(10);
        questPopulator.quest(owner, DAY, "MORNING", "hydrate", "vitality", "LIFE",
                "water_ml", new BigDecimal("500"), 20, "completed");
        questPopulator.quest(owner, DAY, "EVENING", "stretch", "vitality", "LIFE",
                "minutes", new BigDecimal("10"), 20, "offered"); // nem completed → nem számít

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.DAILY_XP, DAY, DAY);

        assertThat(series.get(DAY)).isEqualTo(45.0);
    }

    @Test
    void testSeries_shouldCountMentionsPerDay_whenMentionsLogged() {
        UUID owner = userPopulator.createUser().getId();
        PersonEntity anna = personPopulator.createPerson(owner, "Anna");
        Instant noon = DAY.atTime(12, 0).atZone(ZoneId.systemDefault()).toInstant();
        mentionPopulator.createMention(owner, anna.getId(), noon, "warm");
        mentionPopulator.createMention(owner, anna.getId(), noon.plusSeconds(3600), "neutral");

        assertThat(metricSeriesService.series(owner, MetricKey.SOCIAL_MENTIONS, DAY, DAY).get(DAY))
                .isEqualTo(2.0);
    }

    @Test
    void testSeries_shouldAverageHrRecovery_whenRunsLogged() {
        UUID owner = userPopulator.createUser().getId();
        RunningBlockEntity block = runningPopulator.createBlock(owner, "Sprint blokk", "active");
        runningPopulator.createRunLog(owner, block.getId(), 1, "tue-sprint", DAY, 6, 8, 40, null, 30);
        runningPopulator.createRunLog(owner, block.getId(), 1, "thu-sprint", DAY, 6, 7, 60, null, 30);

        assertThat(metricSeriesService.series(owner, MetricKey.RUN_HR_RECOVERY_S, DAY, DAY).get(DAY))
                .isEqualTo(50.0);
    }
```

(A habit-XP tesztben a `habit.setXpAwarded(10)` után `saveAndFlush` kell — a `HabitDayRepository`-t autowire-old a tesztbe, vagy adj a `HabitPopulator`-nak egy xp-s overloadot; a kisebb diff a repo-autowire + saveAndFlush.)

- [ ] **Step 3: Run — FAIL**

```bash
cd backend && ./mvnw clean test -Dtest=MetricSeriesExpansionIT
```

- [ ] **Step 4: Implementáció** — enum: `HABITS_DONE("kész szokások")`, `RITUAL_CLOSED("esti lezárás")`, `DAILY_XP("napi XP")`, `SOCIAL_MENTIONS("társas említések")`, `RUN_HR_RECOVERY_S("pulzus-visszaállás")`; switch-ágak:

```java
    case HABITS_DONE -> habitsDone(userId, from, to);
    case RITUAL_CLOSED -> ritualClosed(userId, from, to);
    case DAILY_XP -> dailyXp(userId, from, to);
    case SOCIAL_MENTIONS -> socialMentions(userId, from, to);
    case RUN_HR_RECOVERY_S -> hrRecovery(userId, from, to);
```

```java
    /** Kész szokások száma naponta — habit-soros nap 0-val is adatpont, sor nélküli nap nem. */
    private Map<LocalDate, Double> habitsDone(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> series = new HashMap<>();
        for (HabitDayEntity habit : habitDayRepository.findByCreatedByAndHabitDateBetween(userId, from, to)) {
            double done = "done".equals(habit.getStatus()) ? 1 : 0;
            series.merge(habit.getHabitDate(), done, Double::sum);
        }
        return series;
    }

    /**
     * 0/1 lezárás-sorozat (point-biserial). ritual_day sor csak záráskor születik, ezért a 0-kat
     * a naptár adja — de csak az első valaha lezárt nap (adopció) UTÁN: előtte a hiány nem
     * "nem zárta le", hanem "még nem használta a rituálét".
     */
    private Map<LocalDate, Double> ritualClosed(UUID userId, LocalDate from, LocalDate to) {
        LocalDate adopted = ritualDayRepository.findFirstByCreatedByOrderByRitualDateAsc(userId)
                .map(RitualDayEntity::getRitualDate).orElse(null);
        if (adopted == null) {
            return Map.of();
        }
        java.util.Set<LocalDate> closed = ritualDayRepository
                .findByCreatedByAndRitualDateBetween(userId, from, to).stream()
                .map(RitualDayEntity::getRitualDate)
                .collect(Collectors.toSet());
        Map<LocalDate, Double> series = new HashMap<>();
        for (LocalDate day = from.isBefore(adopted) ? adopted : from; !day.isAfter(to); day = day.plusDays(1)) {
            series.put(day, closed.contains(day) ? 1.0 : 0.0);
        }
        return series;
    }

    /** Napi össz-XP (activity + habit + completed quest); 0 XP-s nap nem adatpont (DAILY_KCAL-minta). */
    private Map<LocalDate, Double> dailyXp(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> series = new HashMap<>();
        activityLogRepository.findByCreatedByAndOccurredOnBetween(userId, from, to).forEach(a -> {
            if (a.getXpAwarded() != null && a.getXpAwarded() > 0) {
                series.merge(a.getOccurredOn(), a.getXpAwarded().doubleValue(), Double::sum);
            }
        });
        habitDayRepository.findByCreatedByAndHabitDateBetween(userId, from, to).forEach(h -> {
            if (h.getXpAwarded() != null && h.getXpAwarded() > 0) {
                series.merge(h.getHabitDate(), h.getXpAwarded().doubleValue(), Double::sum);
            }
        });
        dailyQuestRepository.findByCreatedByAndQuestDateBetweenOrderByQuestDateDesc(userId, from, to)
                .forEach(q -> {
                    if (DailyQuestEntity.STATUS_COMPLETED.equals(q.getStatus())
                            && q.getXp() != null && q.getXp() > 0) {
                        series.merge(q.getQuestDate(), q.getXp().doubleValue(), Double::sum);
                    }
                });
        return series;
    }

    /** People-említések napi darabszáma (ts rendszerzónás napja). */
    private Map<LocalDate, Double> socialMentions(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> series = new HashMap<>();
        for (MentionEntity mention : mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(userId)) {
            LocalDate day = mention.getTs().atZone(ZoneId.systemDefault()).toLocalDate();
            if (!day.isBefore(from) && !day.isAfter(to)) {
                series.merge(day, 1.0, Double::sum);
            }
        }
        return series;
    }

    /** Futás utáni pulzus-visszaállás (mp) napi átlaga — ritka adat, a kapu kezeli. */
    private Map<LocalDate, Double> hrRecovery(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, List<Double>> perDay = new HashMap<>();
        runSessionLogRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from)
                .forEach(r -> {
                    if (!r.getDate().isAfter(to) && r.getHrRecoverySec() != null) {
                        perDay.computeIfAbsent(r.getDate(), d -> new ArrayList<>())
                                .add(r.getHrRecoverySec().doubleValue());
                    }
                });
        return average(perDay);
    }
```

(A `"done"` habit-státusz literál helyett használd a `HabitDayEntity` tényleges státusz-konstansát, ha van — nézd meg az entitást; `STATUS_PENDING` létezik, a done-párja valószínűleg `STATUS_DONE`. A quest-finder szignatúráját is ellenőrizd — ha az `OrderByQuestDateDesc` változat nem `(UUID, LocalDate, LocalDate)` paraméterű, igazítsd.)

- [ ] **Step 5: Run — PASS**

- [ ] **Step 6: Commit**

```bash
git add -A backend/src
git commit -m "feat(companion): habit/ritual/XP/mention/HR-recovery metrikák (mezo-6ha5)"
```

---

### Task 5: Derivált metrikák (`weekend`, `acwr`, `training-monotony`, `bedtime-variability`) + load-config

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java`
- Modify: `backend/src/main/resources/application.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricKey.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricSeriesService.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/MetricSeriesDerivedIT.java`

**Interfaces:**
- Consumes: a service saját `sportLoad`/`gymVolume`/`sleep` extraktorai + a Task 2 `clockHour` helperje; `CompanionProperties.patterns()`.
- Produces: `MetricKey.WEEKEND/ACWR/TRAINING_MONOTONY/BEDTIME_VARIABILITY` (wire: `weekend`, `acwr`, `training-monotony`, `bedtime-variability`); `Patterns.loadGymKgPerMin()` int configmező. Új service-függőség: `CompanionProperties`.

- [ ] **Step 1: Config** — `CompanionProperties.Patterns` rekordba új mező a `reinforceCooldownDays` után:

```java
        /** ACWR/monotónia napi terhelése: ennyi kg gym-volumen ér egy sport-percet (közös skála). */
        @Min(1) @Max(10000) int loadGymKgPerMin,
```

`application.yml` a `reinforce-cooldown-days: 7` után:

```yaml
      # Derivalt terheles-metrikak (ACWR, monotonia) kozos skalaja: ennyi kg gym-volumen
      # szamit egy sport-perc-ekvivalensnek a napi terheles osszegzeseben
      load-gym-kg-per-min: 100
```

- [ ] **Step 2: Failing test** — új fájl `MetricSeriesDerivedIT.java`:

```java
/**
 * V3.4 derivált sport-tudományi metrikák: naptári hétvége-sorozat, ACWR belső ablak-kiterjesztéssel
 * (az ablak ELŐTTI 28 nap beszámít), Foster-monotónia (szórás=0 → nincs adatpont),
 * lefekvés-szórás (min. 3 nap a gördülő ablakban).
 */
@Transactional
@ActiveProfiles("companion-fake")
class MetricSeriesDerivedIT extends AbstractIntegrationTest {

    // fix hétfő, hogy a hétvége-asszertek determinisztikusak legyenek
    private static final LocalDate MONDAY = LocalDate.of(2026, 6, 15);

    @Autowired private MetricSeriesService metricSeriesService;
    @Autowired private UserPopulator userPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;

    @Test
    void testSeries_shouldMarkSaturdaySunday_whenWeekendRequested() {
        UUID owner = userPopulator.createUser().getId();

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.WEEKEND, MONDAY, MONDAY.plusDays(6));

        assertThat(series).hasSize(7); // tiszta naptári sorozat — minden napra létezik
        assertThat(series.get(MONDAY)).isEqualTo(0.0);
        assertThat(series.get(MONDAY.plusDays(5))).isEqualTo(1.0); // szombat
        assertThat(series.get(MONDAY.plusDays(6))).isEqualTo(1.0); // vasárnap
    }

    @Test
    void testSeries_shouldUsePreWindowLoadInChronic_whenAcwrRequested() {
        UUID owner = userPopulator.createUser().getId();
        // 28 nap egyenletes 60 perc/nap a kért ablak ELŐTT — csak a krónikus nevezőben él
        for (int i = 1; i <= 28; i++) {
            trainPopulator.createSportSession(owner, MONDAY.minusDays(i), "futball", 60, 3);
        }
        // a kért napon 120 perc → akut(7 nap): (120+6*0)/7 ≈ 17.14... várt ACWR < 1 a 60-as krónikushoz képest
        trainPopulator.createSportSession(owner, MONDAY, "futball", 120, 4);

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.ACWR, MONDAY, MONDAY);

        // akut = 120/7; krónikus = (27*60 + 120)/28 — az ablak előtti napok NÉLKÜL a nevező 120/28 lenne
        double acute = 120.0 / 7;
        double chronic = (27 * 60.0 + 120) / 28;
        assertThat(series.get(MONDAY)).isCloseTo(acute / chronic, within(1e-9));
    }

    @Test
    void testSeries_shouldOmitDay_whenMonotonyStdDevZero() {
        UUID owner = userPopulator.createUser().getId();
        // 7 azonos terhelésű nap → szórás=0 → definiálatlan monotónia, nincs adatpont (nem ∞)
        for (int i = 0; i < 7; i++) {
            trainPopulator.createSportSession(owner, MONDAY.minusDays(i), "futball", 60, 3);
        }

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.TRAINING_MONOTONY, MONDAY, MONDAY);

        assertThat(series).doesNotContainKey(MONDAY);
    }

    @Test
    void testSeries_shouldComputeMonotony_whenLoadVaries() {
        UUID owner = userPopulator.createUser().getId();
        trainPopulator.createSportSession(owner, MONDAY, "futball", 90, 4);
        trainPopulator.createSportSession(owner, MONDAY.minusDays(2), "futball", 30, 2);
        // többi 5 nap 0 terhelés → átlag/szórás jól definiált

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.TRAINING_MONOTONY, MONDAY, MONDAY);

        // load = [0,0,0,0,30,0,90]: átlag 120/7; populációs szórás kiszámolható — csak a létezést
        // és a pozitivitást assertáljuk, a képletet a szórás=0 teszt védi
        assertThat(series.get(MONDAY)).isPositive();
    }

    @Test
    void testSeries_shouldRequireThreeBedtimes_whenVariabilityRequested() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, MONDAY, "22:00", "06:00", new BigDecimal("7.5"), 4, 0, null);
        sleepLogPopulator.createSleepLog(owner, MONDAY.minusDays(1), "23:00", "06:00", new BigDecimal("6.5"), 3, 0, null);

        Map<LocalDate, Double> two = metricSeriesService.series(
                owner, MetricKey.BEDTIME_VARIABILITY, MONDAY, MONDAY);
        assertThat(two).doesNotContainKey(MONDAY); // csak 2 nap adat a 7 napos ablakban

        sleepLogPopulator.createSleepLog(owner, MONDAY.minusDays(2), "0:00", "07:00", new BigDecimal("6.0"), 3, 0, null);
        Map<LocalDate, Double> three = metricSeriesService.series(
                owner, MetricKey.BEDTIME_VARIABILITY, MONDAY, MONDAY);
        // órák: 22, 23, 24 → átlag 23, populációs szórás sqrt(2/3)
        assertThat(three.get(MONDAY)).isCloseTo(Math.sqrt(2.0 / 3), within(1e-9));
    }
}
```

(A `createSportSession(owner, date, sport, durationMin, intensity)` overload szignatúráját ellenőrizd a `TrainPopulator`-ban — létezik `createSportSession(UUID, LocalDate, String, Integer…)` változat; ha az argumentum-sorrend más, igazítsd a tesztet.)

- [ ] **Step 3: Run — FAIL**

```bash
cd backend && ./mvnw clean test -Dtest=MetricSeriesDerivedIT
```

- [ ] **Step 4: Implementáció** — enum: `WEEKEND("hétvége")`, `ACWR("akut:krónikus terhelés")`, `TRAINING_MONOTONY("edzés-monotónia")`, `BEDTIME_VARIABILITY("lefekvés-szórás")`; új mező: `private final CompanionProperties properties;`; switch-ágak:

```java
    case WEEKEND -> weekend(from, to);
    case ACWR -> acwr(userId, from, to);
    case TRAINING_MONOTONY -> trainingMonotony(userId, from, to);
    case BEDTIME_VARIABILITY -> bedtimeVariability(userId, from, to);
```

```java
    /** 0/1 hétvége-jel (szo–vas) — tiszta naptári sorozat, kontroll-változó. */
    private static Map<LocalDate, Double> weekend(LocalDate from, LocalDate to) {
        Map<LocalDate, Double> series = new HashMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            DayOfWeek dow = day.getDayOfWeek();
            series.put(day, dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY ? 1.0 : 0.0);
        }
        return series;
    }

    /**
     * Napi terhelés közös skálán: sport-perc + gym-volumen perc-ekvivalens (kg / load-gym-kg-per-min).
     * Naptári tömb — a nem-logolt nap terhelése valódi 0 (a gördülő ablakok ezt igénylik).
     */
    private double[] dailyLoad(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> sport = sportLoad(userId, from, to);
        Map<LocalDate, Double> gym = gymVolume(userId, from, to);
        double kgPerMin = properties.patterns().loadGymKgPerMin();
        int days = (int) (to.toEpochDay() - from.toEpochDay()) + 1;
        double[] load = new double[days];
        for (int i = 0; i < days; i++) {
            LocalDate day = from.plusDays(i);
            load[i] = sport.getOrDefault(day, 0.0) + gym.getOrDefault(day, 0.0) / kgPerMin;
        }
        return load;
    }

    /**
     * ACWR: 7 napos akut / 28 napos krónikus átlag-terhelés aránya. Az extraktor az ablak ELŐTTI
     * 28 napot is beolvassa (belső ablak-kiterjesztés — a hívó [from,to]-ja változatlan);
     * krónikus 0 → nincs adatpont.
     */
    private Map<LocalDate, Double> acwr(UUID userId, LocalDate from, LocalDate to) {
        LocalDate extendedFrom = from.minusDays(27);
        double[] load = dailyLoad(userId, extendedFrom, to);
        Map<LocalDate, Double> series = new HashMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            int idx = (int) (day.toEpochDay() - extendedFrom.toEpochDay());
            double acute = mean(load, idx - 6, idx);
            double chronic = mean(load, idx - 27, idx);
            if (chronic > 0) {
                series.put(day, acute / chronic);
            }
        }
        return series;
    }

    /** Foster-monotónia: 7 napos gördülő átlag/szórás; szórás=0 → definiálatlan, nincs adatpont. */
    private Map<LocalDate, Double> trainingMonotony(UUID userId, LocalDate from, LocalDate to) {
        LocalDate extendedFrom = from.minusDays(6);
        double[] load = dailyLoad(userId, extendedFrom, to);
        Map<LocalDate, Double> series = new HashMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            int idx = (int) (day.toEpochDay() - extendedFrom.toEpochDay());
            double mean = mean(load, idx - 6, idx);
            double sd = stdDev(load, idx - 6, idx, mean);
            if (sd > 0) {
                series.put(day, mean / sd);
            }
        }
        return series;
    }

    /** A bedtime-hour 7 napos gördülő (populációs) szórása — social jetlag jel; min. 3 nap adat. */
    private Map<LocalDate, Double> bedtimeVariability(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> bedtimes = sleep(userId, from.minusDays(6), to,
                s -> clockHour(s.getBedtime(), true));
        Map<LocalDate, Double> series = new HashMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            List<Double> window = new ArrayList<>();
            for (int i = 0; i <= 6; i++) {
                Double value = bedtimes.get(day.minusDays(i));
                if (value != null) {
                    window.add(value);
                }
            }
            if (window.size() < 3) {
                continue;
            }
            double mean = window.stream().mapToDouble(Double::doubleValue).average().orElseThrow();
            double sq = window.stream().mapToDouble(v -> (v - mean) * (v - mean)).sum();
            series.put(day, Math.sqrt(sq / window.size()));
        }
        return series;
    }

    private static double mean(double[] values, int fromIdx, int toIdx) {
        double sum = 0;
        for (int i = fromIdx; i <= toIdx; i++) {
            sum += values[i];
        }
        return sum / (toIdx - fromIdx + 1);
    }

    /** Populációs szórás a [fromIdx,toIdx] szeleten (a 7 napos Foster-ablak fix hosszú). */
    private static double stdDev(double[] values, int fromIdx, int toIdx, double mean) {
        double sq = 0;
        for (int i = fromIdx; i <= toIdx; i++) {
            sq += (values[i] - mean) * (values[i] - mean);
        }
        return Math.sqrt(sq / (toIdx - fromIdx + 1));
    }
```

- [ ] **Step 5: Run — PASS**, plusz a teljes companion-csomag zöld:

```bash
cd backend && ./mvnw clean test -Dtest='MetricSeries*,PatternDetectionServiceIT,CompanionPatternMonitorApiIT'
```

- [ ] **Step 6: Commit**

```bash
git add -A backend/src
git commit -m "feat(companion): weekend/ACWR/monotónia/bedtime-szórás derivált metrikák (mezo-6ha5)"
```

---

### Task 6: 21 új pár a katalógusban + futás-szintű sorozat-cache a detect()-ben

**Files:**
- Modify: `backend/src/main/resources/application.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternGate.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternDetectionService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternMonitorService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/PatternDetectionServiceIT.java`

**Interfaces:**
- Consumes: Task 1–5 metrikái; `PatternGate.evaluate(...)` (változatlan); `CompanionProperties.PatternPair`.
- Produces: `PatternGate.window(Map<LocalDate,Double> series, LocalDate from, LocalDate to)` statikus helper (a monitor is ezt hívja); a katalógus 29 párra nő.

- [ ] **Step 1: Failing test** — `PatternDetectionServiceIT`-be új teszt (a seed a Task 2 sleep-populator-overloadot használja):

```java
    @Test
    void testDetect_shouldPersistBedtimePattern_whenLateBedtimeTracksLowQuality() {
        UUID owner = userPopulator.createUser().getId();
        // bedtime 22:00→02:30 (törtóra 22..26.5) ↔ minőség 5..1 — erős negatív együttjárás
        for (int i = 0; i < 10; i++) {
            LocalDate day = LocalDate.now().minusDays(1L + i);
            int shift = i % 5;
            String bedtime = shift < 2 ? (22 + shift) + ":00" : (shift - 2) + ":30";
            sleepLogPopulator.createSleepLog(owner, day, bedtime, "06:30",
                    new BigDecimal("7.0"), 5 - shift, 0, null);
        }

        patternDetectionService.detect(owner);

        PatternEntity row = patternRepository.findByCreatedByAndKindAndPairKeyAndDeletedFalse(
                owner, PatternEntity.KIND_STATISTICAL, "bedtime-hour~sleep-quality").orElseThrow();
        assertThat(row.getStatus()).isEqualTo(PatternEntity.STATUS_PROPOSED);
        assertThat(row.getR().doubleValue()).isLessThan(0);
        assertThat(row.getN()).isEqualTo(10);
    }
```

- [ ] **Step 2: Run — FAIL** (a pár még nincs a katalógusban)

```bash
cd backend && ./mvnw clean test -Dtest=PatternDetectionServiceIT
```

- [ ] **Step 3: Katalógus-bővítés** — `application.yml` `pairs:` lista végére a 21 új bejegyzés (kulcsok a spec §4-ből, kategória-címkék a meglévő minta szerint — `physiology`→`Fiziológia`, `trigger`→`Trigger`, `response`→`Response`):

```yaml
        - key: sleep-quality~next-day-gym-workload
          category: physiology
          label: Fiziológia
          title: "Alvásminőség ↔ másnapi gym-terhelésérzet"
          metric-a: sleep-quality
          metric-b: gym-workload
          lag-days: 1
        - key: gym-volume~next-day-joint-pain
          category: response
          label: Response
          title: "Gym-volumen ↔ másnapi ízületi fájdalom"
          metric-a: gym-volume-kg
          metric-b: gym-joint-pain
          lag-days: 1
        - key: checkin-body~gym-joint-pain
          category: physiology
          label: Fiziológia
          title: "Testérzet ↔ aznapi ízületi fájdalom"
          metric-a: checkin-body
          metric-b: gym-joint-pain
          lag-days: 0
        - key: gym-workload~next-day-checkin-body
          category: response
          label: Response
          title: "Gym-terhelésérzet ↔ másnapi testérzet"
          metric-a: gym-workload
          metric-b: checkin-body
          lag-days: 1
        - key: bedtime-hour~sleep-quality
          category: trigger
          label: Trigger
          title: "Lefekvés ideje ↔ aznapi alvásminőség"
          metric-a: bedtime-hour
          metric-b: sleep-quality
          lag-days: 0
        - key: late-meal~next-sleep-awakenings
          category: trigger
          label: Trigger
          title: "Késői étkezés ↔ rákövetkező éjszakai ébredések"
          metric-a: late-meal-hour
          metric-b: sleep-awakenings
          lag-days: 1
        - key: checkin-stress~late-meal-hour
          category: trigger
          label: Trigger
          title: "Stressz-szint ↔ aznapi késői étkezés"
          metric-a: checkin-stress
          metric-b: late-meal-hour
          lag-days: 0
        - key: habits-done~checkin-mental
          category: response
          label: Response
          title: "Kész szokások ↔ mentális állapot"
          metric-a: habits-done
          metric-b: checkin-mental
          lag-days: 0
        - key: ritual-closed~next-sleep-quality
          category: trigger
          label: Trigger
          title: "Esti lezárás ↔ rákövetkező alvásminőség"
          metric-a: ritual-closed
          metric-b: sleep-quality
          lag-days: 1
        - key: daily-protein~next-day-checkin-energy
          category: physiology
          label: Fiziológia
          title: "Napi fehérje ↔ másnapi energia-szint"
          metric-a: daily-protein-g
          metric-b: checkin-energy
          lag-days: 1
        - key: daily-xp~checkin-mental
          category: response
          label: Response
          title: "Napi XP ↔ mentális állapot"
          metric-a: daily-xp
          metric-b: checkin-mental
          lag-days: 0
        - key: meal-score~next-day-checkin-energy
          category: physiology
          label: Fiziológia
          title: "Étkezés-pontszám ↔ másnapi energia-szint"
          metric-a: meal-score
          metric-b: checkin-energy
          lag-days: 1
        - key: reta-dose~daily-kcal
          category: physiology
          label: Fiziológia
          title: "Reta-dózis ↔ napi kalória"
          metric-a: reta-dose-mg
          metric-b: daily-kcal
          lag-days: 0
        - key: sport-load~next-sleep-quality
          category: physiology
          label: Fiziológia
          title: "Sportterhelés ↔ rákövetkező alvásminőség"
          metric-a: sport-load-min
          metric-b: sleep-quality
          lag-days: 1
        - key: wakeup-hour~checkin-energy
          category: trigger
          label: Trigger
          title: "Ébredés ideje ↔ energia-szint"
          metric-a: wakeup-hour
          metric-b: checkin-energy
          lag-days: 0
        - key: sleep-quality~next-day-hr-recovery
          category: physiology
          label: Fiziológia
          title: "Alvásminőség ↔ másnapi pulzus-visszaállás"
          metric-a: sleep-quality
          metric-b: run-hr-recovery-s
          lag-days: 1
        - key: social-mentions~checkin-mental
          category: response
          label: Response
          title: "Társas említések ↔ mentális állapot"
          metric-a: social-mentions
          metric-b: checkin-mental
          lag-days: 0
        - key: acwr~next-day-joint-pain
          category: response
          label: Response
          title: "ACWR ↔ másnapi ízületi fájdalom"
          metric-a: acwr
          metric-b: gym-joint-pain
          lag-days: 1
        - key: training-monotony~checkin-energy
          category: physiology
          label: Fiziológia
          title: "Edzés-monotónia ↔ energia-szint"
          metric-a: training-monotony
          metric-b: checkin-energy
          lag-days: 0
        - key: bedtime-variability~checkin-mental
          category: trigger
          label: Trigger
          title: "Lefekvés-szórás ↔ mentális állapot"
          metric-a: bedtime-variability
          metric-b: checkin-mental
          lag-days: 0
        - key: weekend~late-meal-hour
          category: trigger
          label: Trigger
          title: "Hétvége ↔ késői étkezés"
          metric-a: weekend
          metric-b: late-meal-hour
          lag-days: 0
```

- [ ] **Step 4: Futás-szintű cache** — `PatternGate`-be statikus helper (a monitor privát `window()`-ja ide emelve; import `LinkedHashMap`):

```java
    /** [from,to] szűkítés — a futás-szintű cache uniós ablakából a pár PONTOS ablaka. */
    static Map<LocalDate, Double> window(Map<LocalDate, Double> series, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> out = new LinkedHashMap<>();
        series.forEach((day, value) -> {
            if (!day.isBefore(from) && !day.isAfter(to)) {
                out.put(day, value);
            }
        });
        return out;
    }
```

`PatternDetectionService.detect` átírása (a per-pár izolált try-catch marad):

```java
    public int detect(UUID userId) {
        CompanionProperties.Patterns config = properties.patterns();
        LocalDate to = LocalDate.now().minusDays(1);
        LocalDate from = to.minusDays(config.lookbackDays() - 1L);
        int maxLag = config.pairs().stream()
                .mapToInt(CompanionProperties.PatternPair::lagDays).max().orElse(0);
        // Futás-szintű sorozat-cache (spec §4): metrikánként EGY series()-hívás az uniós
        // [from, to+maxLag] ablakra — a 29 pár legtöbbje osztozik metrikán.
        Map<MetricKey, Map<LocalDate, Double>> cache = new EnumMap<>(MetricKey.class);
        int upserted = 0;
        for (CompanionProperties.PatternPair pair : config.pairs()) {
            try {
                if (detectPair(userId, pair, from, to, config.minN(), cache, maxLag)) {
                    upserted++;
                }
            } catch (Exception e) {
                log.warn("Pattern detection failed for pair {} of user {}", pair.key(), userId, e);
            }
        }
        return upserted;
    }

    private boolean detectPair(UUID userId, CompanionProperties.PatternPair pair,
                               LocalDate from, LocalDate to, int minN,
                               Map<MetricKey, Map<LocalDate, Double>> cache, int maxLag) {
        Map<LocalDate, Double> seriesA = PatternGate.window(
                cached(cache, userId, pair.metricA(), from, to, maxLag), from, to);
        Map<LocalDate, Double> seriesB = PatternGate.window(
                cached(cache, userId, pair.metricB(), from, to, maxLag),
                from.plusDays(pair.lagDays()), to.plusDays(pair.lagDays()));
        // A kapu KÖZÖS a monitorral (PatternMonitorService) — a diagnosztika ettől hiteles.
        PatternGate.Outcome outcome = PatternGate.evaluate(seriesA, seriesB, pair.lagDays(), minN);
        if (outcome.verdict() != PatternGate.Verdict.LIVE) {
            return false; // a kapun kívül semmit nem perzisztálunk
        }
        upsert(userId, pair, outcome.result(), from, to);
        return true;
    }

    private Map<LocalDate, Double> cached(Map<MetricKey, Map<LocalDate, Double>> cache, UUID userId,
                                          MetricKey metric, LocalDate from, LocalDate to, int maxLag) {
        return cache.computeIfAbsent(metric,
                m -> metricSeriesService.series(userId, m, from, to.plusDays(maxLag)));
    }
```

`PatternMonitorService`: a privát `window(...)` metódus törlése, hívásai `PatternGate.window(...)`-ra cserélve (4 hely: `toPair` 2×, `thinnerMetric` 2×, `coverage` 1×).

- [ ] **Step 5: Run — PASS** (detection + monitor + a régi párok regressziója):

```bash
cd backend && ./mvnw clean test -Dtest='PatternDetectionServiceIT,CompanionPatternMonitorApiIT,CompanionPatternMonitorSwitchOffIT,MetricSeries*'
```

- [ ] **Step 6: Commit**

```bash
git add -A backend/src
git commit -m "feat(companion): 21 új katalógus-pár + futás-szintű sorozat-cache a detect()-ben (mezo-6ha5)"
```

---

### Task 7: B1 — digest-gazdagítás minőségi mezőkkel

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java`
- Modify: `backend/src/main/resources/application.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DailySummaryService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/DailySummaryServiceIT.java`

**Interfaces:**
- Consumes: `SleepLogEntity.getNotes()`, `RunSessionLogEntity.getNotes()`, `MentionEntity.getTone()/getExcerpt()/getTs()`, `DailyIntentionRepository.findByCreatedByAndIntentionDateAndDeletedFalse(...)` → `DailyIntentionEntity.getReflection()`; a fake LLM `summaryAnswer`-e sentinel híján a digestet echózza (`"ÖSSZEFOGLALÓ(" + digest + ")"`) — a narratíva-assert így a digestet látja.
- Produces: `Summary.noteMaxChars()` configmező; a digest új blokkjai: `Említés (<tone>): "<excerpt>"`, `Napi reflexió: "<reflection>"`; sleep/run sor jegyzet-farka. Új service-függőségek: `MentionRepository`, `DailyIntentionRepository`.

- [ ] **Step 1: Config** — `CompanionProperties.Summary`:

```java
    /** V2.2 nightly daily-summary job — the narrative memory's generator. */
    public record Summary(
        /** Cron for the nightly job (server zone), late enough that "yesterday" is truly finished. */
        @NotBlank String cron,
        /** How many finished days back the job checks and self-heals (idempotent catch-up = backfill). */
        @Min(1) @Max(60) int catchUpDays,
        /** V3.4 digest-gazdagítás: minőségi mezőnkénti karakter-cap (check-in/alvás/futás jegyzet,
         *  említés-kivonat, intention-reflexió). */
        @Min(0) @Max(1000) int noteMaxChars
    ) {}
```

`application.yml` a `summary:` blokkba (`catch-up-days` után):

```yaml
      # V3.4 digest-gazdagitas: minosegi mezonkenti karakter-cap (jegyzetek, emlites-kivonat,
      # reflexio) - a digest ossz-merete tovabbra is konstrukcio szerint korlatos
      note-max-chars: 200
```

- [ ] **Step 2: Failing test** — `DailySummaryServiceIT`-be (autowire: `SleepLogPopulator` már lehet benne — ellenőrizd; plusz `PersonPopulator`, `MentionPopulator`, `IntentionPopulator`; a `DAY` konstans a fájl meglévő mintája szerint):

```java
    @Test
    void testGenerate_shouldCarryQualityFields_whenNotesMentionAndReflectionExist() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, DAY, "23:00", "06:30",
                new BigDecimal("7.0"), 4, 1, "Nyugtalan éjszaka, sok forgolódás.");
        PersonEntity anna = personPopulator.createPerson(owner, "Anna");
        mentionPopulator.createMention(owner, anna.getId(),
                DAY.atTime(18, 0).atZone(ZoneId.systemDefault()).toInstant(), "warm");
        intentionPopulator.reflection(owner, DAY, "Hálás vagyok a mai napért.");

        DailySummaryEntity summary = dailySummaryService.generate(owner, DAY);

        assertThat(summary.getNarrative())
                .contains("Nyugtalan éjszaka")
                .contains("Említés (warm)")
                .contains("Teszt említés.")
                .contains("Napi reflexió")
                .contains("Hálás vagyok a mai napért.");
    }

    @Test
    void testGenerate_shouldCapQualityField_whenNoteLongerThanConfig() {
        UUID owner = userPopulator.createUser().getId();
        String longNote = "a".repeat(250);
        sleepLogPopulator.createSleepLog(owner, DAY, "23:00", "06:30",
                new BigDecimal("7.0"), 4, 0, longNote);

        DailySummaryEntity summary = dailySummaryService.generate(owner, DAY);

        assertThat(summary.getNarrative()).contains("a".repeat(200));
        assertThat(summary.getNarrative()).doesNotContain("a".repeat(201));
    }

    @Test
    void testGenerate_shouldLeaveNoTrace_whenQualityFieldsEmpty() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, DAY, new BigDecimal("7.5"), 4); // nincs notes

        DailySummaryEntity summary = dailySummaryService.generate(owner, DAY);

        assertThat(summary.getNarrative())
                .doesNotContain("Említés")
                .doesNotContain("Napi reflexió");
    }
```

- [ ] **Step 3: Run — FAIL**

```bash
cd backend && ./mvnw clean test -Dtest=DailySummaryServiceIT
```

- [ ] **Step 4: Implementáció** — `DailySummaryService`:

Új mezők: `private final MentionRepository mentionRepository;` + `private final DailyIntentionRepository dailyIntentionRepository;` (importok: `feature.people.entity.MentionEntity`, `feature.people.repository.MentionRepository`, `feature.intention.repository.DailyIntentionRepository`, `java.time.ZoneId`).

Cap-helper:

```java
    /** Minőségi mező capelése (V3.4 B1 — summary.note-max-chars); null/üres → üres string. */
    private String cap(String text) {
        if (text == null) {
            return "";
        }
        String trimmed = text.strip();
        int max = properties.summary().noteMaxChars();
        return trimmed.length() > max ? trimmed.substring(0, max) : trimmed;
    }
```

`digest(...)`-be két új hívás a `addCheckIns` után:

```java
        addMentions(blocks, userId, date);
        addIntention(blocks, userId, date);
```

`addSleep` sor-vége bővül (a meglévő builder-lánc végére):

```java
                .ifPresent(s -> {
                    String notes = cap(s.getNotes());
                    blocks.add("Alvás: " + num(s.getDurationH()) + " óra"
                            + (s.getQuality() != null ? ", minőség " + s.getQuality() + "/5" : "")
                            + (s.getAwakenings() != null && s.getAwakenings() > 0
                                    ? ", " + s.getAwakenings() + " ébredés" : "")
                            + (notes.isBlank() ? "" : " — \"" + notes + "\""));
                });
```

`addTrain` futás-ága ugyanígy: a `blocks.add("Futás: " …)` lánc végére `+ (cap(r.getNotes()).isBlank() ? "" : " — \"" + cap(r.getNotes()) + "\"")` (egy lokális változóval, ne hívd kétszer).

`addCheckIns`: a kézi `noteCap`/`substring` logika cseréje `cap(c.getNote())`-ra (a `properties.snapshot().checkinNoteMaxChars()` sor törölhető — a digest mostantól a summary-capet használja; a V0.3 snapshot-assembler érintetlen).

Új blokkok:

```java
    /** People-említések tónussal + capelt kivonattal (B1) — a nap legfrissebb 5 említése. */
    private void addMentions(List<String> blocks, UUID userId, LocalDate date) {
        ZoneId zone = ZoneId.systemDefault();
        mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(userId).stream()
                .filter(m -> date.equals(m.getTs().atZone(zone).toLocalDate()))
                .limit(5)
                .forEach(m -> blocks.add("Említés (" + m.getTone() + "): \"" + cap(m.getExcerpt()) + "\""));
    }

    /** Az esti intention-reflexió (B1) — üres reflexió nem hagy nyomot. */
    private void addIntention(List<String> blocks, UUID userId, LocalDate date) {
        dailyIntentionRepository.findByCreatedByAndIntentionDateAndDeletedFalse(userId, date)
                .ifPresent(i -> {
                    String reflection = cap(i.getReflection());
                    if (!reflection.isBlank()) {
                        blocks.add("Napi reflexió: \"" + reflection + "\"");
                    }
                });
    }
```

- [ ] **Step 5: Run — PASS** (a teljes summary-teszt + a briefing/memoir fogyasztók regressziója):

```bash
cd backend && ./mvnw clean test -Dtest='DailySummary*,Briefing*,Memoir*'
```

- [ ] **Step 6: Commit**

```bash
git add -A backend/src
git commit -m "feat(companion): digest-gazdagítás minőségi mezőkkel + note-max-chars cap (mezo-6ha5)"
```

---

### Task 8: B2+B3 — heti metrika-tábla + kapu-diagnosztika a gather()-ben

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/HypothesisPipelineService.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/HypothesisGatherContextIT.java`

**Interfaces:**
- Consumes: `MetricSeriesService.series(...)`, `PatternMonitorService.monitor(userId)` → `PatternMonitorResponse.getPairs()/getMinN()` (generált api.dto getterek), `PatternMonitorService.VERDICT_LIVE/VERDICT_FROZEN` (package-private konstansok — azonos csomag).
- Produces: `gather(UUID)` láthatósága `private` → package-private (a gather-IT hívja); a kontextus két új blokkja: `HETI METRIKA-TÁBLA …` és `KAPU-DIAGNOSZTIKA (nem-élő párok):`.

- [ ] **Step 1: Failing test** — új fájl `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/HypothesisGatherContextIT.java` (SERVICE-csomagban — a package-private `gather()`-t hívja; a `WebPageClientIT`-féle service-csomagos IT precedens):

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * V3.4 B2+B3: a hipotézis-kör gather() kontextusa a napi összefoglalók MELLÉ hordozza a heti
 * nyers metrika-táblát (nemlineáris sejtésekhez) és a nem-élő párok kapu-diagnosztikáját
 * (hiányzó-adat-hipotézisekhez) — determinisztikus blokkok, LLM nélkül assertálva.
 */
@Transactional
@ActiveProfiles("companion-fake")
class HypothesisGatherContextIT extends AbstractIntegrationTest {

    @Autowired private HypothesisPipelineService pipeline;
    @Autowired private UserPopulator userPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;

    @Test
    void testGather_shouldIncludeMetricTableAndGateDiagnostics_whenSummariesExist() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        dailySummaryPopulator.summary(owner, yesterday, "Tegnap jó nap volt.");
        sleepLogPopulator.createSleepLog(owner, yesterday, new BigDecimal("7.5"), 4);

        String context = pipeline.gather(owner);

        assertThat(context).contains("HETI METRIKA-TÁBLA");
        assertThat(context).contains(MetricKey.SLEEP_QUALITY.labelHu());
        assertThat(context).contains("7.5"); // a nyers érték benne van a táblában
        assertThat(context).contains("– "); // hiányzó nap jele
        assertThat(context).contains("KAPU-DIAGNOSZTIKA (nem-élő párok):");
        // alig van adat: az edzés-RPE pár biztosan nem élő → egysoros diagnosztikája megjelenik
        assertThat(context).contains("sleep-quality~next-day-training-rpe");
        assertThat(context).contains("illesztett napok");
    }

    @Test
    void testGather_shouldStayNull_whenNoSummaries() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(pipeline.gather(owner)).isNull(); // az üres-kontextus kapu változatlan
    }
}
```

- [ ] **Step 2: Run — FAIL** (`gather` private → fordítási hiba)

```bash
cd backend && ./mvnw clean test -Dtest=HypothesisGatherContextIT
```

- [ ] **Step 3: Implementáció** — `HypothesisPipelineService`:

Új mezők: `private final MetricSeriesService metricSeriesService;` + `private final PatternMonitorService patternMonitorService;` (import: `io.mrkuhne.mezo.api.dto.PatternMonitorResponse`, `java.util.Map`, `java.math.RoundingMode` már bent van).

`gather` láthatóság + vége:

```java
    /** Pure compute: weekly narrative context — null when there is nothing to hypothesize over.
     *  Package-private a gather-kontextus IT-nek (HypothesisGatherContextIT). */
    String gather(UUID userId) {
        ...változatlan törzs a return-ig...
        return "NAPI ÖSSZEFOGLALÓK:\n" + narratives
                + (facts.isBlank() ? "" : "\n\n" + facts)
                + (statistical.isBlank() ? "" : "\n\nSTATISZTIKAI MINTÁK:\n" + statistical)
                + "\n\nHETI METRIKA-TÁBLA (sor = metrika, oszlop = nap, – = nincs adat):\n"
                + metricTable(userId)
                + gateDiagnostics(userId);
    }
```

```java
    /** B2: az összes metrika utolsó 7 lezárt napja nyers számokként — a páronkénti Pearson
     *  számára láthatatlan (küszöb / U-alak / interakció) sejtésekhez. */
    private String metricTable(UUID userId) {
        LocalDate to = LocalDate.now().minusDays(1);
        LocalDate from = to.minusDays(6);
        StringBuilder table = new StringBuilder("metrika");
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            table.append(" | ").append(day.getMonthValue()).append('.').append(day.getDayOfMonth()).append('.');
        }
        for (MetricKey metric : MetricKey.values()) {
            Map<java.time.LocalDate, Double> series = metricSeriesService.series(userId, metric, from, to);
            table.append('\n').append(metric.labelHu());
            for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
                Double value = series.get(day);
                table.append(" | ").append(value == null ? "–" : compact(value));
            }
        }
        return table.toString();
    }

    private static String compact(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP)
                .stripTrailingZeros().toPlainString();
    }

    /** B3: a nem-élő (és nem user-judged) párok egysoros kapu-összegzése — a hiányzó adatról
     *  szóló actionable hipotézisek takarmánya. */
    private String gateDiagnostics(UUID userId) {
        PatternMonitorResponse monitor = patternMonitorService.monitor(userId);
        String lines = monitor.getPairs().stream()
                .filter(p -> !PatternMonitorService.VERDICT_LIVE.equals(p.getVerdict())
                        && !PatternMonitorService.VERDICT_FROZEN.equals(p.getVerdict()))
                .map(p -> "- " + p.getTitle() + " (" + p.getKey() + "): " + p.getVerdict()
                        + ", illesztett napok " + p.getAlignedDays() + "/" + monitor.getMinN()
                        + (p.getBottleneckMetricKey() == null
                                ? "" : ", szűk keresztmetszet: " + p.getBottleneckMetricKey()))
                .collect(Collectors.joining("\n"));
        return lines.isBlank() ? "" : "\n\nKAPU-DIAGNOSZTIKA (nem-élő párok):\n" + lines;
    }
```

(A táblában a `– ` asszert miatt a hiányzó cella után szóköz nem lesz — ha az asszert emiatt törik, cseréld `" | –"`-ra a tesztben. A `getAlignedDays()` DTO-getter nevét ellenőrizd az api.gen `PatternMonitorPair`-ben.)

- [ ] **Step 4: Run — PASS** (gather-IT + a meglévő pipeline-IT regresszió):

```bash
cd backend && ./mvnw clean test -Dtest='HypothesisGatherContextIT,HypothesisPipelineServiceIT'
```

- [ ] **Step 5: Commit**

```bash
git add -A backend/src
git commit -m "feat(companion): heti metrika-tábla + kapu-diagnosztika a hipotézis-gather()-ben (mezo-6ha5)"
```

---

### Task 9: Teljes kapu + docs + kiadás

**Files:**
- Modify: `docs/features/companion.md`
- (ellenőrzés) `node scripts/lint-docs.mjs`

**Interfaces:**
- Consumes: Task 1–8 kész állapota.
- Produces: friss feature-doc; zöld helyi fókusz-gate; PR.

- [ ] **Step 1: Teljes backend-teszt** (compose fut):

```bash
cd backend && docker compose up -d && ./mvnw clean test
```

Elvárt: BUILD SUCCESS. (Ha a 16 GB-os gépen az IT-suite nem fut le, a fókuszált tesztlista: `MetricSeries*`, `PatternDetectionServiceIT`, `CompanionPatternMonitor*`, `DailySummary*`, `Hypothesis*` — a teljes suite-ot a CI-PR viszi.)

- [ ] **Step 2: `docs/features/companion.md` frissítése** — az érintett szakaszok (V3.1 metrika/katalógus táblák, V2.2 digest-leírás, V3.2 gather-leírás, config-kulcs lista, §10 key files):
  - metrika-lista: 12 → 31 (az új kulcsok + magyar címkék + napi aggregálás egy-egy sorban);
  - pár-katalógus: 8 → 29 (elég a kulcs+lag+kategória tábla);
  - `detect()` futás-szintű `EnumMap` sorozat-cache + `PatternGate.window` közös helper említése;
  - digest: minőségi mezők (check-in/alvás/futás jegyzet, említés tónus+kivonat, napi reflexió) + `mezo.companion.summary.note-max-chars` (200);
  - gather: heti metrika-tábla + kapu-diagnosztika blokkok; `gather()` package-private a tesztnek;
  - config-kulcsok: `mezo.companion.patterns.load-gym-kg-per-min` (100), `mezo.companion.summary.note-max-chars` (200);
  - **Decisions/gotchas** szakaszba a három spec-eltérés a Global Constraints-ből (sourceHu kihagyva; reta-dose a dózis-logból; 19/31 a bd-szöveg 20/32-je helyett), plusz: bedtime dél-előtti-óra +24 cutoff, ritual-closed adopció-naptól 0/1, daily-load populációs szórás, XP csak completed questből.

- [ ] **Step 3: Lint**

```bash
node scripts/lint-docs.mjs
```

Elvárt: nincs staleness-flag a companion.md-re, nincs törött link.

- [ ] **Step 4: Commit + push + self-PR (CI-kapu)**

```bash
git add docs/features/companion.md
git commit -m "docs(companion): V3.4 katalógus-bővítés + AI-kontextus dokumentálása (mezo-6ha5)"
git push -u origin claude/pattern-catalog-expansion-00ba8f
gh pr create --fill --title "feat(companion): pattern-katalógus bővítés + AI-kontextus V3.4 (mezo-6ha5)"
```

CI zöld után (a repo git-workflow szabálya szerint): `git checkout main && git pull --rebase && git merge --no-ff <branch> && git push`, majd `bd close mezo-6ha5` + `bd dolt push`.

---

## Self-Review (elvégzve a terv írásakor)

- **Spec-lefedettség:** §3 mind a 19 metrika → Task 1 (4), Task 2 (3), Task 3 (3), Task 4 (5), Task 5 (4) = 19 ✓; §4 21 pár + futásköltség-refaktor → Task 6 ✓; §5 B1/B2/B3 → Task 7–8 ✓ (B3 függősége, a `PatternMonitorService`, már élesben van); §6 tesztek: bedtime +24 (T2), bináris metrikák (T4 ritual/T5 weekend), ACWR ablak-kiterjesztés (T5), monotónia szórás=0 (T5), detektálási e2e új párra (T6), digest-teszt (T7), gather-teszt (T8) ✓; §7 docs → Task 9 ✓.
- **Típus-konzisztencia:** `clockHour` (T2) ↔ T5 `bedtimeVariability` hívása; `PatternGate.window` (T6) ↔ monitor + detection hívások; `Summary.noteMaxChars` (T7) yml `note-max-chars` ✓; wire-kulcsok (`wireKey()` = kebab-case enum-név) ↔ yml `metric-a/b` értékek betűre egyeznek ✓.
- **Ismert bizonytalanságok (az implementáló ellenőrizze a megjelölt helyen):** `FuelDayResponse.getConsumed()` visszatérési típusneve (T3), `HabitDayEntity` done-státusz konstans + quest Between-finder szignatúra (T4), `createSportSession` overload argumentum-sorrend (T5), `PatternMonitorPair` getter-nevek (T8) — mind lokálisan, egy-egy fájl megnyitásával eldönthető.
