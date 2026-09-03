# Napi értékelés újraépítés — Implementation Plan (2/2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A companion `DayScoreService` 4 sovány sub-score-ja helyett 6 gazdag dimenzió (tápanyag/minőség/edzés/alvás/logolás/ritmus) determinisztikus motorral, lusta+cache-elt LLM-réteggel (narratíva, per-dimenzió mondatok, ±5 „Mezo-kontextus” korrekció láthatóan), és a `/me/week/napok/:date` nap-oldal Mozaik 2.0 kibővítése (lezárt + folyamatban állapotok).

**Architecture:** Determinisztikus mag (ADR 0006 mintája): pure engine egy input-carrier felett, a `DayScoreService`-be integrálva (EGY napi matek marad — a heti trend 4 régi átlag-mezője a legközelebbi új dimenzióból map-elődik). LLM: consumer-owned belső port (`DayReviewLlm`, a `MealCoachLlmAdapter` kliens-mintájával), eredménye a `day_review` jsonb cache-be íródik `inputsHash`-sel (self-invalidating). Napzárás v1 = naptári nap vége (a spec nyitott kérdése így zárul); késői szerkesztést az inputsHash-eltérés invalidál.

**Tech Stack:** Spring Boot + Liquibase (új `day_review` tábla), OpenAPI contract-first (`me-week.yml` + új day-evaluation op), React + Mozaik/clay kit.

**Spec:** `docs/superpowers/specs/2026-09-03-daily-score-redesign-design.md` · **bd:** mezo-jcpt · **Előfeltétel:** az 1/2 terv (meal-score fixek) merge-ölve — a minőség-dimenzió a renormalizált meal-envelope-okra épít.

## Global Constraints

- Ugyanazok, mint az 1/2 tervben (fókuszált tesztek lokálban, FE mindkét mód, contract-drift gate, ArchUnit + codemap, Mozaik 2.0 design-szabály, jóváhagyott prototípus 1–2. képernyője).
- Súlyok (config, induló): nutrition .30 · quality .15 · training .20 · sleep .15 · logging .10 · rhythm .10 — összeg 1.0, startup-validálva.
- Honesty: degraded dimenzió súlya renormalizálódik; <2 élő dimenzió → score null („tanulom”); jövőbeli/lezáratlan nap → nincs összpontszám. LLM-hiba/kikapcsolás → determinisztikus válasz teljes értékű, próza nélkül; SOHA 5xx.
- A korrekció clamp: `delta ∈ [-5, +5]`, egész; indoklás nélkül eldobva.
- Sáv-színek: ≥80 sage · 60–79 arany · <60 terrakotta (FE `scoreBand.ts` már így megy — ne duplikáld).

---

### Task 1: DayEvaluationProperties + input-carrier

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/DayEvaluationProperties.java`
- Modify: `backend/src/main/resources/application.yml` (a companion blokk `me-week`/hasonló szomszédjába — grep `MeWeekProperties` prefixét és tedd mellé)
- Modify: a `@ConfigurationProperties` regisztráció ott, ahol a `MeWeekProperties` is regisztrálva van (grep `@EnableConfigurationProperties.*MeWeekProperties` vagy `@ConfigurationPropertiesScan`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/config/DayEvaluationPropertiesTest.java`

**Interfaces:**
- Produces (minden későbbi task ezt fogyasztja):

```java
@Validated
@ConfigurationProperties(prefix = "mezo.companion.day-evaluation")
public record DayEvaluationProperties(
    @NotNull @Valid Weights weights,
    @NotNull @Valid NutritionBands nutrition,
    /** Edzésnapi kcal/CH sáv-tágítás (kcal). */ @Min(0) @Max(600) int workoutDayKcalWiden,
    /** Alvás-cél óra (a MeWeekProperties.sleepTargetH marad a legacy útnak; itt a sajátunk). */
    @DecimalMin("4.0") @DecimalMax("12.0") double sleepTargetH,
    /** Ritmus-ablak napokban + a minimum értékelt nap benne. */
    @Min(3) @Max(14) int rhythmWindowDays, @Min(2) @Max(7) int rhythmMinDays,
    /** Étkezés „időben logolva”: ennyi percen belül a loggedAt a slot-ablaktól. */
    @Min(30) @Max(720) int logTimelyMin
) {
    public record Weights(double nutrition, double quality, double training,
                          double sleep, double logging, double rhythm) {
        @AssertTrue(message = "mezo.companion.day-evaluation.weights must sum to 1.0")
        public boolean isNormalized() {
            return Math.abs(nutrition + quality + training + sleep + logging + rhythm - 1.0) < 1e-6;
        }
    }
    /** Aszimmetrikus toleranciasávok a napi célhoz képest (relatív arányok). */
    public record NutritionBands(
        /** kcal: sávon belül teljes pont — alul tágabb, felül szűkebb (cut-aszimmetria). */
        @DecimalMin("0.0") @DecimalMax("0.5") double kcalUnderBand,   // 0.10
        @DecimalMin("0.0") @DecimalMax("0.5") double kcalOverBand,    // 0.05
        /** sávon kívül lineáris lecsengés: pont/relatív-eltérés meredekség. */
        @DecimalMin("0.5") @DecimalMax("10.0") double kcalSlope,      // 3.0
        /** fehérje: hiány-sáv + meredekség; a többlet megbocsátva (fitness-policy). */
        @DecimalMin("0.0") @DecimalMax("0.5") double proteinUnderBand, // 0.05
        @DecimalMin("0.5") @DecimalMax("10.0") double proteinSlope,    // 2.5
        /** C+F együtt, szimmetrikus sáv + enyhébb meredekség. */
        @DecimalMin("0.0") @DecimalMax("0.5") double carbFatBand,      // 0.15
        @DecimalMin("0.5") @DecimalMax("10.0") double carbFatSlope     // 1.5
    ) { }
}
```

- yml (kebab-case, a fenti defaultokkal + `weights: {nutrition: 0.30, quality: 0.15, training: 0.20, sleep: 0.15, logging: 0.10, rhythm: 0.10}`).

- [ ] **Step 1: Failing test** — property-binding teszt a repo meglévő `*PropertiesTest` mintájára (grep egy példát: `rg -l "ConfigurationProperties.*Test|bind" backend/src/test | head`): kösd a defaultokat, assertáld a súly-összeg validációt (0.9-es összeg → `BindValidationException`).
- [ ] **Step 2: Run — FAIL** · `./mvnw test -Dtest=DayEvaluationPropertiesTest`
- [ ] **Step 3: Record + yml + regisztráció** a fenti kód szerint.
- [ ] **Step 4: Run — PASS**, plusz `./mvnw test -Dtest='*ContextLoad*,*ApplicationTest*'` jellegű boot-smoke, ha van (grep) — a yml-hiba bootot tör.
- [ ] **Step 5: Commit** · `git commit -m "feat(companion): day-evaluation tunables (mezo-jcpt)"`

---

### Task 2: Pure engine — DayEvaluationEngine + tápanyag-dimenzió

Az engine a `MealScoringService` mintája: pure, repository-mentes, egy input-record felett; a `DayScoreService` tölti majd az inputot (Task 5).

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DayEvaluationEngine.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/DayEvaluationEngineTest.java`

**Interfaces:**
- Produces (a teljes terv gerince — Task 3–9 erre épül):

```java
@Service
@RequiredArgsConstructor
public class DayEvaluationEngine {
    private final DayEvaluationProperties props;

    /** Minden, amit egy nap értékeléséhez tudni kell — a hívó (DayScoreService) tölti. */
    public record DayInputs(
        LocalDate date, boolean closed,               // closed = date < today (v1 napzárás)
        Double kcal, Double proteinG, Double carbsG, Double fatG,          // consumed (null = nincs log)
        Double kcalTarget, Double proteinTargetG, Double carbsTargetG, Double fatTargetG,
        boolean workoutDay,                            // volt-e AZNAPRA tervezett/végzett edzés
        Integer plannedWorkouts, Integer doneWorkouts, // train terv vs tény (null/0 planned = pihenőnap)
        Double sleepH, Integer sleepQuality1to10,      // null = nincs alvás-log
        List<MealLogFact> meals,                       // logolási dimenzióhoz
        boolean waterLogged, int checkinCount,
        List<Integer> priorBaseScores                  // az előző rhythmWindowDays nap base-scoreja (ami van)
    ) { }
    public record MealLogFact(String slot, LocalTime loggedAt, LocalTime eatenAt,
                              Double novaDimScore, Double microDimScore, double kcal) { }

    public record DimFact(String label, String value) { }
    /** status: DONE (pont van) | IN_PROGRESS (nyitott nap, még gyűlik) | NO_DATA (degraded). */
    public record DayDimension(String id, String label, double weight, Integer score,
                               String status, List<DimFact> facts) { }
    public record DayEvaluation(LocalDate date, Integer base, List<DayDimension> dimensions) { }

    public DayEvaluation evaluate(DayInputs in) { ... }
}
```

- Dimenzió-idk (contract-ban is ezek): `nutrition, quality, training, sleep, logging, rhythm`. Súly-renormalizálás: a NO_DATA/IN_PROGRESS dimenziók 0 súllyal esnek ki, a kiadott `weight` a renormalizált érték (az 1/2 terv Task 2 mintája). `base` = kerekített súlyozott összeg; null, ha <2 DONE dimenzió VAGY `!closed`.

- [ ] **Step 1: Failing testek** — a tápanyag-dimenzió magja (számold ki kézzel az elvárásokat, kommentben):

```java
@Test
void nutrition_insideAsymmetricBands_fullScore() {
    // kcal 2450/2600 (−5.8%, under-band 10% → bent), P 170/170, C/F sávban → 100
    DayEvaluation e = engine.evaluate(closedDay(b -> b.kcal(2450.0).proteinG(170.0)
        .carbsG(300.0).fatG(75.0).targets(2600, 170, 310, 80)));
    assertThat(dim(e, "nutrition").score()).isEqualTo(100);
}

@Test
void nutrition_kcalOverIsPenalizedHarderThanUnder() {
    int overBy8pct = score(engine, b -> b.kcal(2808.0), 2600);   // +8% (over-band 5%)
    int underBy8pct = score(engine, b -> b.kcal(2392.0), 2600);  // −8% (under-band 10% → bent)
    assertThat(underBy8pct).isGreaterThan(overBy8pct);
}

@Test
void nutrition_proteinSurplusForgiven_deficitCounts() { ... 190/170 == 170/170; 150/170 < 170/170 ... }

@Test
void nutrition_workoutDayWidensKcalTopBand() {
    // workoutDay=true: a felső sáv 2600+150 kcal-ig teljes pont
    ...
}

@Test
void nutrition_noKcalLogged_degradesAndWeightRenormalizes() { ... }
```

- [ ] **Step 2: Run — FAIL** · `./mvnw test -Dtest=DayEvaluationEngineTest`
- [ ] **Step 3: Implementáció** — a tápanyag-dim képlete:

```java
    // komponensek: kcal 0.5 · protein 0.3 · carb+fat 0.2 (fix belső arány, nem config — YAGNI)
    private double kcalFit(double kcal, double target, boolean workoutDay) {
        double top = target + (workoutDay ? props.workoutDayKcalWiden() : 0);
        double relOver = Math.max(0, kcal / top - 1);          // a tágított felső célhoz
        double relUnder = Math.max(0, 1 - kcal / target);
        double over = Math.max(0, relOver - props.nutrition().kcalOverBand());
        double under = Math.max(0, relUnder - props.nutrition().kcalUnderBand());
        return Math.max(0, 1 - (over + under) * props.nutrition().kcalSlope());
    }
    private double proteinFit(double p, double target) {
        double relUnder = Math.max(0, 1 - p / target);
        double under = Math.max(0, relUnder - props.nutrition().proteinUnderBand());
        return Math.max(0, 1 - under * props.nutrition().proteinSlope()); // surplus: teljes pont
    }
    private double carbFatFit(double c, double f, Double ct, Double ft) {
        if (ct == null || ft == null) return 1.0; // nincs C/F cél → nem büntetünk
        double dev = (Math.max(0, Math.abs(c / ct - 1) - props.nutrition().carbFatBand())
                    + Math.max(0, Math.abs(f / ft - 1) - props.nutrition().carbFatBand())) / 2;
        return Math.max(0, 1 - dev * props.nutrition().carbFatSlope());
    }
```

`facts`: `("kcal", "2450 / 2600"), ("fehérje", "158 / 170 g"), ("c · f", "312 g · 74 g")` + workoutDay-nél `("sáv", "edzésnapi +150 kcal")`. Nyitott napnál (`!closed`) a nutrition dim `IN_PROGRESS` státuszú, score null, facts a nyers haladás.

- [ ] **Step 4: Run — PASS**
- [ ] **Step 5: Commit** · `git commit -m "feat(companion): day-evaluation engine + nutrition dimension (mezo-jcpt)"`

---

### Task 3: Minőség- és edzés-dimenzió

**Files:** ugyanaz a kettő (engine + teszt).

**Interfaces:** változatlan `evaluate`; a quality a `MealLogFact.novaDimScore/microDimScore`-ból (a meal-envelope-ok MÁR renormalizált dimenzióiból jön — 1/2 terv), a training a `plannedWorkouts/doneWorkouts`-ból.

- [ ] **Step 1: Failing testek**

```java
@Test
void quality_kcalWeightedMeanOfMealNovaScores_blendedWithMicro() {
    // két meal: nova 0.9 (600 kcal), nova 0.5 (200 kcal) → nova-rész (0.9·600+0.5·200)/800 = 0.8
    // micro-átlag 0.6 → quality = 0.75·0.8 + 0.25·0.6 = 0.75 → 75
}
@Test
void quality_mealsWithoutNovaScores_degrade() { ... novaDimScore=null mindenhol → NO_DATA ... }
@Test
void training_restDayIsNeutral() {
    // plannedWorkouts=0 → a training dim NO_DATA státuszú "Pihenőnap" ténnyel, súlya kiesik,
    // a többi dim renormalizálódik — a nap NEM kap edzés-levonást.
}
@Test
void training_plannedAndDone_scoresFull() { ... planned=1, done=1 → 100 ... }
@Test
void training_plannedButSkipped_scoresLow() { ... planned=1, done=0 → 30 ... }
```

- [ ] **Step 2: Run — FAIL**
- [ ] **Step 3: Implementáció** — quality: `0.75 × kcal-súlyozott nova-átlag + 0.25 × micro-átlag` (micro nélkül a nova-rész önmagában, 1.0 súllyal); training: `done/planned` arány lineárisan 0.3 (0 done) és 1.0 (mind done) között: `0.3 + 0.7 × done/planned`, 0 planned → degraded "Pihenőnap · nem számít" ténnyel. Nyitott nap: a training DONE, amint `done ≥ planned` VAGY a nap zárult; egyébként IN_PROGRESS.
- [ ] **Step 4: Run — PASS**
- [ ] **Step 5: Commit** · `git commit -m "feat(companion): quality + training day dimensions (mezo-jcpt)"`

---

### Task 4: Alvás-, logolás-, ritmus-dimenzió + honesty-kapu

**Files:** ugyanaz a kettő.

- [ ] **Step 1: Failing testek**

```java
@Test void sleep_durationBlendedWithQuality() { /* 6.33h/7.5 cél, Q6 → 0.7·0.844+0.3·((6−1)/9)=0.757 → 76;
    a meglévő DayScoreService-formula marad (1-10 skála, (v−1)/9) */ }
@Test void sleep_presentOnOpenDay_isDone() { /* nyitott napon is DONE, ha van alvás-log — A+ minta */ }
@Test void logging_timelyMealsWaterCheckins() {
    // 4/4 meal a slot-ablak+logTimelyMin-en belül logolva (loggedAt vs eatenAt≤120p), víz ✓,
    // 3/4 check-in → 0.5·1.0 + 0.2·1.0 + 0.3·0.75 = 0.925 → 93 (kerekítve)
}
@Test void logging_lateLogsLowerTheScore() { ... }
@Test void rhythm_meanOfPriorBaseScores_minDaysGate() {
    // priorBaseScores [84,72,80] (min 3 nap megvan) → 79; két elemnél NO_DATA
}
@Test void overall_fewerThanTwoDoneDims_isNull() { ... }
@Test void overall_openDay_hasNoBaseScore() { /* closed=false → base null, dims státuszai élnek */ }
```

- [ ] **Step 2: Run — FAIL**
- [ ] **Step 3: Implementáció** — logging: `0.5 × (időben-logolt étkezések aránya) + 0.2 × (víz logolva ? 1 : 0) + 0.3 × min(1, checkinCount/4)`; „időben” = `|loggedAt − eatenAt| ≤ logTimelyMin` perc. 0 meal-lel a meal-rész kiesik és a maradék két rész arányosan skálázódik (0.4/0.6). rhythm: `mean(priorBaseScores)` ha `size ≥ rhythmMinDays`, különben NO_DATA. Honesty + renormalizálás + `base` a Task 2 interface szerint.
- [ ] **Step 4: Run — PASS** · teljes engine-teszt zöld.
- [ ] **Step 5: Commit** · `git commit -m "feat(companion): sleep/logging/rhythm dims + honesty gate (mezo-jcpt)"`

---

### Task 5: DayScoreService — az engine bekötése (EGY napi matek)

A 4 sub-score-os matek helyére az engine kerül; a MeWeekService/heti trend hívási felülete megmarad, a 4 legacy átlag-mező a legközelebbi utódból map-elődik (sleep→sleep, fuel→nutrition, checkin→logging, activity→training) — dokumentálva.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DayScoreService.java` (a subscore-metódusok cseréje input-töltésre + engine-hívásra)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MeWeekService.java` (toSubscores mapping)
- Test: a meglévő DayScoreService-tesztek átírása (grep: `rg -l "DayScoreService" backend/src/test`) + `MeWeek*IT` futtatás

**Interfaces:**
- Produces: `DayScoreService.DayScore` bővül: `record DayScore(LocalDate date, Integer score, DaySubscores subscores, DayEvaluationEngine.DayEvaluation evaluation)` — a `DaySubscores(sleep, fuel, checkin, activity)` MARAD a wire-kompat kedvéért, de a mezői az új dimenziókból jönnek: `sleep=dim(sleep)`, `fuel=dim(nutrition)`, `checkin=dim(logging)`, `activity=dim(training)`; `score = evaluation.base()`. (A me-week contract subscores-a így változatlan marad ebben a tervben — a nap-oldal az ÚJ evaluation endpointból él, Task 7.)
- Input-töltés: kcal/protein/sleep sorozatok a meglévő `MetricSeriesService`-ből; C/F + targets a `FuelDayResponse`-ból (`getConsumed()/getTargets()` — MacroSet, lásd MeWeekService.buildDay); planned/done workout a `WorkoutSessionRepository`-ból (grep `findDoneInstancesBetween` mellé a planned-változatot; ha nincs, a `WorkoutWindowQueryService.windowsFor(userId, date)` `Window(start,end,done)` listája adja: planned=windows.size(), done=count(done)); meal-tények a `MealRepository`-ból (loggedAt) + envelope dim-score-ok; víz `WaterLogRepository`; checkin a meglévő `checkinCounts`; priorBaseScores rekurzió-mentesen: az előző 7 nap engine-hívása rhythm dim NÉLKÜL (a rhythm sosem eszi önmagát — az engine kap egy `evaluateWithoutRhythm` belső utat vagy üres priorral hívjuk).

- [ ] **Step 1: Failing test** — a meglévő DayScoreService-teszt fixture-eit az új elvárásokra írod át; PLUSZ egy regressziós: `scores()` továbbra is 7 elemet ad, a legacy subscores mapping a dokumentált módon töltődik.
- [ ] **Step 2: Run — FAIL** · `./mvnw test -Dtest='DayScore*Test'`
- [ ] **Step 3: Implementáció** a fenti töltési térkép szerint; a régi `sleepSubscore/fuelSubscore/checkinSubscore/activitySubscore` metódusok törlődnek (a formulák az engine-ben élnek tovább).
- [ ] **Step 4: Run — PASS** · `./mvnw test -Dtest='DayScore*Test,MeWeek*Test,MeWeek*IT,WeeklyScore*'`
- [ ] **Step 5: Commit** · `git commit -m "refactor(companion): DayScoreService runs on the 6-dim evaluation engine (mezo-jcpt)"`

---

### Task 6: day_review persistencia (Liquibase + entity + repository)

**Files:**
- Create: Liquibase changelog — nézd meg a meglévő struktúrát (`backend/src/main/resources/db/changelog/` alatt; kövesd a legutóbbi changeset fájl-elnevezését és include-mintáját, pl. a `weekly_score` táblát létrehozó changeset a sablon)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/DayReviewEntity.java` (a `WeeklyScoreEntity` mintájára)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/DayReviewJson.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/DayReviewRepository.java`
- Test: repository-IT a repo meglévő repository-IT mintájára (grep `WeeklyScore` tesztjeit)

**Interfaces:**
- Produces:

```java
/** A nap LLM-rétege — cache, nem igazság: inputsHash mondja meg, friss-e. */
public record DayReviewJson(
    List<String> narrative,                        // 1-3 bekezdés
    Map<String, String> dimensionNotes,            // dim-id → 1-2 mondat
    List<Highlight> highlights,                    // max 3
    Adjustment adjustment,                         // nullable
    List<ContextSignal> context                    // nem pontozott jelek, determinisztikusan töltve
) {
    public record Highlight(String kind, String label) { }        // kind: key|pattern|win
    public record Adjustment(int delta, String reason) { }
    public record ContextSignal(String label, String value) { }
}
```

- Tábla: `day_review(id uuid pk, created_by uuid not null, date date not null, envelope jsonb not null, inputs_hash varchar(64) not null, computed_at timestamptz not null, unique(created_by, date))`. Repository: `Optional<DayReviewEntity> findByCreatedByAndDate(UUID, LocalDate)`.

- [ ] **Step 1: Changeset + entity + repo** a WeeklyScore-minta másolásával (jsonb: `@JdbcTypeCode(SqlTypes.JSON)` a MealBreakdownJson-precedens szerint).
- [ ] **Step 2: Repository-IT** (mentés + visszaolvasás + unique-constraint) — FAIL → PASS ciklusban.
- [ ] **Step 3: Run** · `./mvnw test -Dtest='DayReview*'`
- [ ] **Step 4: Commit** · `git commit -m "feat(companion): day_review cache table + envelope (mezo-jcpt)"`

---

### Task 7: Contract — day-evaluation endpoint + regen

**Files:**
- Modify: `api/feature/me-week/me-week.yml` (új path + sémák)
- Regen: `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces — a FE (Task 9-10) EZT fogyasztja:

```yaml
  /api/me/day/{date}/evaluation:
    get:
      tags: [MeWeek]
      operationId: getDayEvaluation
      summary: A nap 6-dimenziós értékelése + (lezárt napra, lustán) a Mezo-próza
      parameters:
        - name: date
          in: path
          required: true
          schema: { type: string, format: date }
      responses:
        '200': { ...DayEvaluationResponse... }
```

```yaml
    DayDimension:
      type: object
      required: [id, label, weight, status]
      properties:
        id: { type: string, description: nutrition|quality|training|sleep|logging|rhythm }
        label: { type: string }
        weight: { type: number, description: renormalizált súly; NO_DATA-nál 0 }
        score: { type: integer, nullable: true }
        status: { type: string, description: DONE|IN_PROGRESS|NO_DATA }
        facts:
          type: array
          items: { type: object, required: [label, value],
                   properties: { label: {type: string}, value: {type: string} } }
        note: { type: string, nullable: true, description: 1-2 mondat a Mezotól (lezárt nap) }
    DayEvaluationResponse:
      type: object
      required: [date, state, dimensions]
      properties:
        date: { type: string, format: date }
        state: { type: string, description: scored|in_progress|thin|empty|future }
        score: { type: integer, nullable: true, description: base + adjustment.delta, clampelve 0..100 }
        base: { type: integer, nullable: true }
        adjustment:
          type: object
          nullable: true
          required: [delta, reason]
          properties: { delta: { type: integer, minimum: -5, maximum: 5 }, reason: { type: string } }
        narrative: { type: array, items: { type: string }, description: üres, ha nincs próza }
        highlights:
          type: array
          items: { type: object, required: [kind, label],
                   properties: { kind: { type: string, description: key|pattern|win }, label: { type: string } } }
        context:
          type: array
          items: { type: object, required: [label, value],
                   properties: { label: {type: string}, value: {type: string} } }
        dimensions: { type: array, items: { $ref: '#/components/schemas/DayDimension' } }
```

- [ ] **Step 1: yml-bővítés** a fenti sémákkal (400: nem-valid dátum; 401 a szokásos minta).
- [ ] **Step 2: Regen + build** · a contract-regen script fut, `./mvnw compile` zöld (generált DTO-k létrejönnek).
- [ ] **Step 3: Commit** · `git commit -m "feat(api): day-evaluation contract (mezo-jcpt)"`

---

### Task 8: DayReviewService — LLM-réteg (lusta, clampelt, cache-elt) + controller

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DayReviewLlm.java` (belső port: `String complete(String system, String user)`)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/DayReviewLlmAdapter.java` — a `MealCoachLlmAdapter` (`backend/.../companion/llm/MealCoachLlmAdapter.java`) kliens-hívását tükrözi (ugyanaz az olcsó tier; olvasd el és másold a hívási mintát)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DayReviewService.java`
- Create: controller-op a me-week controllerben (grep: `rg -l "getMeWeek" backend/src/main --type java` → ott a `getDayEvaluation` op)
- Test: `DayReviewServiceTest` (fake port) + `DayEvaluationApiIT` + `DayEvaluationSwitchOffApiIT` (a `SlotPlanEvaluateSwitchOffApiIT` minta)

**Interfaces:**
- Produces: `DayEvaluationResponse assemble(UUID userId, LocalDate date)`:
  1. state-döntés a `weekDay.ts` négy állapotának szerver-oldali tükre + `in_progress` (date == today);
  2. engine-hívás a DayScoreService input-töltőjén át (bontsd ki oda: `DayInputs inputsFor(UUID, LocalDate)` publikus segéd);
  2b. a nem pontozott kontextus-jelek DETERMINISZTIKUS töltése (nem az LLM-é): energia = a nap `CHECKIN_ENERGY` átlaga (`MetricSeriesService`), súlytrend = `WeightTrendService.computeTrend(userId).getWeeklyRateKgPerWeek()`, alvás-sorozat = hány egymást követő nap volt cél alatt; ezek mennek a response `context` mezőjébe ÉS az LLM user-üzenetébe;
  3. LEZÁRT + scored napra: cache-olvasás `day_review`-ból; `inputsHash = sha256(dims id|score|status + base)` egyezésnél a cache-elt próza; eltérésnél VAGY hiánynál EGY LLM-hívás (`LlmCallContext("day_review", "narrate", "day", null)`), parse, clamp, upsert;
  4. bármely LLM-hiba → determinisztikus válasz üres narrative-vel (SOHA 5xx);
  5. `score = base == null ? null : clamp(base + delta, 0, 100)`.
- SYSTEM_PROMPT (magyar, a MealCoach hangneme):

```
Egy fitness-app napi értékelő rétege vagy. Megkapod a nap determinisztikus dimenzió-pontjait,
tényeit, a nem pontozott kontextus-jeleket (energia, súlytrend) és az előző napok mintáit.
Válaszolj EGY JSON objektummal:
{"narrative":[string,...],"dimensionNotes":{"<dim-id>":string},
 "highlights":[{"kind":"key|pattern|win","label":string}],
 "adjustment":{"delta":int,"reason":string} | null}
Szabályok:
- Magyarul, tegeződve, ítélkezésmentesen — tényt nevezel meg, nem minősítesz.
- narrative: 2-3 bekezdés, ami ÖSSZEKÖTI a dimenziókat (ok-okozat, minták), nem felolvassa őket.
- dimensionNotes: minden DONE dimenzióhoz 1-2 mondat, mindig MÁS adatból hozott kontextussal.
- adjustment: CSAK ha a számok nem látnak valamit (edzésnapi refeed, betegnap-jel); delta −5..+5
  egész, kötelező indoklással. Ha nincs ok, null.
- A kapott számoknak soha ne mondj ellent és ne találj ki újakat.
```

- [ ] **Step 1: Failing testek** — `DayReviewServiceTest` fake porttal: (a) első hívás generál+perzisztál, második cache-ből jön (a fake port hívás-számlálója 1); (b) inputsHash-eltérés újragenerál; (c) `delta: 9` → 5-re clampelve; (d) indoklás nélküli adjustment eldobva; (e) port-exception → üres narrative, 200-as út.
- [ ] **Step 2: Run — FAIL** · `./mvnw test -Dtest=DayReviewServiceTest`
- [ ] **Step 3: Implementáció** a fenti sorrendben; controller-op vékony delegálás.
- [ ] **Step 4: IT-k** — `DayEvaluationApiIT` (scored nap: 200 + dimenziók; ma: in_progress, score null; jövő: future) és a SwitchOff IT (companion off → 200 determinisztikus, narrative üres). `./mvnw test -Dtest='DayReview*,DayEvaluation*'` zöld.
- [ ] **Step 5: Commit** · `git commit -m "feat(companion): lazy cached day-review LLM layer + evaluation endpoint (mezo-jcpt)"`

---

### Task 9: FE adat-réteg + weekDay-logika 6 dimenzióra

**Files:**
- Create: `frontend/src/data/me/dayEvaluation.ts` (típus-reexport az api.gen-ből + normalizálás), `frontend/src/data/me/dayEvaluationHooks.ts` (`useDayEvaluation(date)` — a `meWeekHooks.ts` react-query mintájára), mock-ág a fuel/me mock-csatornában (nézd meg, hogyan mockol a `meWeekApi.ts` — ugyanaz a VITE_USE_MOCK elágazás)
- Modify: `frontend/src/features/me/logic/weekDay.ts` — `SUBSCORES`/`SUBRING_LABEL` 6 elemre (`nutrition·minőség·edzés·alvás·logolás·ritmus` — label: `tápanyag, minőség, edzés, alvás, logolás, ritmus`), `subscoreCount` az új kulcsokra
- Modify: `frontend/src/features/me/components/week/WeekScoreBars.tsx` + `WeekDayCard.tsx` sparks (4→6 pálcika, színek: sage #8FAF7E · gold #C9962E · coral #FF6B4A · lav #9B8FC4 · rose #C46FA0 · sky #4E8FB8 — CSS-osztályokon/tokeneken át, ne literálként, a meglévő `is-sleep`-minta szerint)
- Test: `weekDay.test.ts` átírás + `dayEvaluationHooks.test.tsx` (mock-módú render)

**Interfaces:**
- Consumes: Task 7 generált típusai (`DayEvaluationResponse`, `DayDimension`).
- Produces: `useDayEvaluation(dateIso: string): { data?: DayEvaluationResponse, isPending, error }`; `SUBSCORES: { key: 'nutrition'|'quality'|'training'|'sleep'|'logging'|'rhythm', label, barClass }[]`. FONTOS: a `MeWeekDay.subscores` wire-alakja (sleep/fuel/checkin/activity) VÁLTOZATLAN — a heti mozaik pálcikái ebből map-elődnek (`nutrition←fuel, logging←checkin, training←activity`), a 6 pálcika a nap-oldal evaluation-jából jön, a WeekDayCard 4 pálcikán marad (a spec 3. nyitott kérdése: a kártya-sűrítés későbbi döntés — itt NEM nyúlunk hozzá). Ezért a `WeekScoreBars` ebben a taskban VÁLTOZATLAN; csak a weekDay.ts nap-oldali exportjai bővülnek.
- Mock-adat: egy scored nap (78, 6 dim, narrative 3 bekezdés, +3 adjustment), egy in_progress (2 DONE dim), egy thin, egy future — a prototípus számaival.

- [ ] **Step 1: Failing testek** (weekDay.test.ts új kulcsokra + hook mock-render), **Step 2: FAIL**, **Step 3: impl**, **Step 4: PASS mindkét módban** (`pnpm test features/me data/me` és `VITE_USE_MOCK=false` ugyanez), **Step 5: Commit** · `feat(me): day-evaluation data layer + 6-dim day logic (mezo-jcpt)`

---

### Task 10: WeekDayPage átépítés a prototípus szerint

**Files:**
- Modify: `frontend/src/features/me/pages/WeekDayPage.tsx` (hero + body az evaluation-ból)
- Create: `frontend/src/features/me/components/week/DayDimensionTile.tsx`, `DayReviewCard.tsx`
- Modify: a me-feature stíluscsatorna (ahol a `wkd-*` osztályok élnek — grep `wkd-` a css-ekben) — új osztályok a prototípus token-értékeivel
- Test: `WeekDayPage.test.tsx` átírás (mock-adattal a 3 állapotra)

**Interfaces:**
- Consumes: `useDayEvaluation` (Task 9), meglévő `useMeWeek` (mcells + chipek), `MozaikPage/ClayIcon/ClaySpot`, `scoreBandColor`.
- Produces: a jóváhagyott prototípus 1–2. képernyője:
  - Hero: dayring (band-szín) + clay-chipek + `alap N · Mezo-kontextus +N` chip-pár (adjustment nélkül csak `alap N` chip); in_progress: szaggatott gyűrű „este zárom” + `N dimenzió kész · M még íródik` sor.
  - `DayReviewCard` (lila revcard): orb + narrative bekezdések + highlight-chipek (`kind` → szín: key=lav, pattern=gold, win=sage) + adjustment-sor + meglévő chat-handoff gomb (`useChatHandoff` marad).
  - 6× `DayDimensionTile`: wash a dim-hez (nutrition=sage, quality=amber, training=coral, sleep=lav, logging=rose, rhythm=sky), clay ikon (`fuel, termes, edzes, alvas, naplo, heti`), súly-eyebrow, sring (score vagy — dash), facts-chipek, note-mondat; NO_DATA/IN_PROGRESS → ghost-stílus + stag-címke.
  - Kontextus ghost-csempe a `context` jelekből; a meglévő mcells + daynav MARAD.
  - `thin/empty/future` állapotok a meglévő `DAY_COPY` mondataival (változatlan copy).

- [ ] **Step 1: Failing testek** — scored nap: renderel 6 csempét + narratívát + „Mezo-kontextus +3” chipet; in_progress: „este zárom” + nincs összpontszám; NO_DATA dim: „Pihenőnap” tény látszik, sring dash.
- [ ] **Step 2: FAIL** · `pnpm test WeekDayPage`
- [ ] **Step 3: Implementáció** a prototípus HTML/CSS-éből fordítva (a `docs/design_2.0/prototypes` build-mintái és a scratch-prototípus a referencia; wash/árnyék értékek a prototype.css tokenjeiből).
- [ ] **Step 4: PASS mindkét módban** + runtime-verify (`verify` skill): mock PWA → /me/week → nap megnyitása → képernyőkép vs. prototípus; in_progress a mai napon.
- [ ] **Step 5: Commit** · `git commit -m "feat(me): WeekDayPage 6-dim Mozaik evaluation (mezo-jcpt)"`

---

### Task 11: Kapuk + doksik + szelet-zárás

- [ ] **Step 1: Backend fókusz-suite** · `./mvnw test -Dtest='DayEvaluation*,DayScore*,DayReview*,MeWeek*,WeeklyScore*'` zöld.
- [ ] **Step 2: FE mindkét mód + build** · `VITE_USE_MOCK=false pnpm test && pnpm test && pnpm build`.
- [ ] **Step 3: ArchUnit + codemap** · `node scripts/gen-codemap.mjs` (új service/entity/repository fájlok!), ArchUnit-teszt zöld (figyelj: entity/repository/service/llm/config alcsomagok).
- [ ] **Step 4: Doksik** — `docs/features/companion.md`: a DayScoreService-szekció átírása a 6 dimenzióra + day_review cache + endpoint; a heti trend legacy-mapping dokumentálása. Ha van `docs/features/me*.md` a nap-oldalról, frissítsd. Commit: `docs(companion): 6-dim day evaluation`.
- [ ] **Step 5: bd + push** — szelet-issue-k zárása; a spec 3 nyitott kérdéséből az 1. (régi meal-ek re-score) és 3. (heti kártya-sűrítés) még nyitott → fájlj róluk külön bd issue-t; PR-flow a házirend szerint.
