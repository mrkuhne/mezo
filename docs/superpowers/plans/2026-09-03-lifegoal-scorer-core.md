# lifegoal motor-mag + élő haladás (mezo-iizd.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A determinisztikus pontozó motor (SignalSource port + LifeGoalScorer) és a hozzá tartozó
progress/today/evaluate endpointok, plusz a lifegoal FE placeholderek cseréje élő pöttyökre,
nyilakra és értékekre.

**Architecture:** Új `engine` alcsomag a `feature/lifegoal` alatt: `SignalSource` port 5
megvalósítással (a `habit` source-típusnak nincs katalógus-bejegyzése — ismeretlen típus `no_data`),
tiszta `LifeGoalScorer`, és egy `LifeGoalProgressService`, ami a tárolt `life_goal_pillar_day`
sorokat előnyben részesíti, a hiányzó napokat pedig olvasáskor számolja (így a job — mezo-iizd.6 —
nélkül is él a FE). `POST /{id}/evaluate` az utolsó 3 lezárt napot upserteli.

**Tech Stack:** Spring Boot + JPA (Liquibase-séma már kész), OpenAPI contract-first
(`api/feature/lifegoal/lifegoal.yml` → generált `LifeGoalApi`), React + TanStack Query
(`useDualQuery`), MSW, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-03-lifegoal-slice2-motor-design.md` (+ alap-spec §5: `docs/superpowers/specs/2026-09-02-lifegoal-system-design.md`).
- bd issue: **mezo-iizd.5** — minden commit subjectben.
- Backend fókuszált teszt MINDIG `-Dmezo.test.use-testcontainers=true`-val fut.
- `no_data` SOHA nem `miss`; `↘` sosem piros; nincs veszteség-mechanika (ADR-guardrail, D1).
- Napi státusz szótár: `hit | partial | miss | no_data`. Napi cél-pont: súlyozott átlag, `hit`=1, `partial`=0.5, `miss`=0, `no_data` kimarad; ha egy pillérnek sincs adata → `null`.
- Irány-nyíl: utolsó 7 nap átlaga vs az azt megelőző 21 nap; ≥ +0,10 `up`, ≤ −0,10 `down`, közte `flat`; MINDKÉT ablakban ≥ 5 adat-nap, különben `insufficient`.
- Kötelező FE teszt-mód fegyelem: `VITE_USE_MOCK=false pnpm test` és `VITE_USE_MOCK=true pnpm test` KÜLÖN parancsban.
- Kontrakt-változás után: `cd api/generate && npm run generate:api`, majd `cd frontend && pnpm generate:api`.
- Cross-feature irány: lifegoal → companion, activity, needs, goal, biometrics.weight; visszafelé SEMMI (ArchUnit: `-Dtest='*Arch*Test'` külön futtatandó, a fókuszált IT nem fedi).
- Stereotype-csomagok kötelezők (`entity/repository/service/controller/mapper/config/engine`); nincs osztályszintű `@Transactional`, nincs `@Value`, nincs nyers `RuntimeException` (`SystemRuntimeErrorException` + `SystemMessage`).
- Docs ugyanabban a változásban: `docs/features/lifegoal.md`; merge előtt `node scripts/gen-codemap.mjs` (regenerálás) és `node scripts/lint-docs.mjs --errors-only`.
- A FE vizuális igazsága a prototípus: `docs/design_2.0/prototypes/celok.html` (lg-arrow / lg-wk7 osztályok — a pötty-állapot osztályneveket ONNAN kell átvenni, nem kitalálni).
- Új `lg-*` CSS szabályok a `frontend/src/styles/prototype.css`-ben a Today-szekció ELÉ kerülnek (CSS-guard teszt kényszeríti).

---

### Task 1: Kontrakt — progress / today / evaluate

**Files:**
- Modify: `api/feature/lifegoal/lifegoal.yml`
- Generated: `backend` `LifeGoalApi` + DTO-k (`npm run generate:api`), `frontend/src/data/_client/api.gen.ts` (`pnpm generate:api`)

**Interfaces:**
- Produces: `getLifeGoalProgress(UUID id, LocalDate from, LocalDate to) → LifeGoalProgressResponse`, `getLifeGoalsToday() → LifeGoalTodayResponse`, `evaluateLifeGoal(UUID id) → LifeGoalProgressResponse` generált API-metódusok; DTO-k: `PillarDayStatus`, `TrendArrow`, `PillarDayEntry`, `PillarProgress`, `GoalDayEntry`, `LifeGoalProgressResponse`, `LifeGoalTodaySummary`, `LifeGoalTodayResponse`.

- [ ] **Step 1: Bővítsd a yml-t** — a `paths` alá (a `/api/life-goals/{id}/pillars` után) és a `components/schemas` végére:

```yaml
  /api/life-goals/today:
    get:
      tags: [LifeGoal]
      operationId: getLifeGoalsToday
      summary: Per-active-goal weekly arrow + 7-day dots + today's pillar tally (LifeGoal)
      responses:
        '200':
          description: Summary for the hub tiles and the Nap tile
          content: { application/json: { schema: { $ref: '#/components/schemas/LifeGoalTodayResponse' } } }
  /api/life-goals/{id}/progress:
    parameters:
      - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
    get:
      tags: [LifeGoal]
      operationId: getLifeGoalProgress
      summary: Daily rows + computed arrows + conflict note for one goal; stored rows win, missing days are computed on read (LifeGoal)
      parameters:
        - { name: from, in: query, required: true, schema: { type: string, format: date } }
        - { name: to, in: query, required: true, schema: { type: string, format: date } }
      responses:
        '200': { description: Progress, content: { application/json: { schema: { $ref: '#/components/schemas/LifeGoalProgressResponse' } } } }
        '404': { description: Not found / not owned, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/life-goals/{id}/evaluate:
    parameters:
      - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
    post:
      tags: [LifeGoal]
      operationId: evaluateLifeGoal
      summary: Manual evaluation — upserts the last 3 closed days' pillar rows, returns fresh 28-day progress (LifeGoal)
      responses:
        '200': { description: Fresh progress after the upsert, content: { application/json: { schema: { $ref: '#/components/schemas/LifeGoalProgressResponse' } } } }
        '404': { description: Not found / not owned, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
```

```yaml
    PillarDayStatus:
      type: string
      enum: [hit, partial, miss, no_data]
    TrendArrow:
      type: string
      enum: [up, flat, down, insufficient]
    PillarDayEntry:
      type: object
      required: [day, status]
      properties:
        day: { type: string, format: date }
        status: { $ref: '#/components/schemas/PillarDayStatus' }
        value: { type: number }
        target: { type: number }
        baseline: { type: number }
    PillarProgress:
      type: object
      required: [pillarId, arrow, days]
      properties:
        pillarId: { type: string, format: uuid }
        arrow: { $ref: '#/components/schemas/TrendArrow' }
        currentValue: { type: number, description: mean of the last 7 days' values (absent when none) }
        referenceValue: { type: number, description: 'the rule''s comparison figure: threshold / expected(today) / baseline median' }
        missingHitDays: { type: integer, description: 'habit kind, arrow=down only: max(0, daysPerWeek − hits in the last 7 days)' }
        days: { type: array, items: { $ref: '#/components/schemas/PillarDayEntry' } }
    GoalDayEntry:
      type: object
      required: [day]
      properties:
        day: { type: string, format: date }
        point: { type: number, description: weighted daily point 0..1; absent = no pillar had data }
    LifeGoalProgressResponse:
      type: object
      required: [goalId, from, to, arrow, days, pillars, conflicts]
      properties:
        goalId: { type: string, format: uuid }
        from: { type: string, format: date }
        to: { type: string, format: date }
        arrow: { $ref: '#/components/schemas/TrendArrow' }
        weeklyPct: { type: integer, description: round(mean of the last 7 days' points × 100); absent when no data-day in the window }
        days: { type: array, items: { $ref: '#/components/schemas/GoalDayEntry' } }
        pillars: { type: array, items: { $ref: '#/components/schemas/PillarProgress' } }
        conflicts: { type: array, items: { type: string }, description: Hungarian one-liners — same signal pulled in opposite directions by another active goal }
    LifeGoalTodaySummary:
      type: object
      required: [goalId, title, dimension, arrow, days7]
      properties:
        goalId: { type: string, format: uuid }
        title: { type: string }
        dimension: { $ref: '#/components/schemas/LifeGoalDimension' }
        arrow: { $ref: '#/components/schemas/TrendArrow' }
        days7:
          type: array
          description: oldest→today; goal-day dot statuses derived from the daily point (≥0.66 hit, ≥0.33 partial, <0.33 miss, null no_data)
          items: { $ref: '#/components/schemas/PillarDayStatus' }
        pillarsTotal: { type: integer }
        pillarsHitToday: { type: integer }
    LifeGoalTodayResponse:
      type: object
      required: [goals]
      properties:
        goals: { type: array, items: { $ref: '#/components/schemas/LifeGoalTodaySummary' } }
```

- [ ] **Step 2: Generálás mindkét oldalon**

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`
Expected: mindkettő hiba nélkül; a backendben megjelenik a 3 új metódus a `LifeGoalApi`-n.

- [ ] **Step 3: Stub-overridek a controllerben** — a generált interfész metódusai ABSZTRAKTOK (nincs default), ezért a `LifeGoalController` e nélkül nem fordul a Task 5-ig. Add hozzá (a Task 5 cseréli valódi delegálásra):

```java
    @Override public LifeGoalProgressResponse getLifeGoalProgress(UUID id, LocalDate from, LocalDate to) { throw notImplementedYet(); }
    @Override public LifeGoalProgressResponse evaluateLifeGoal(UUID id) { throw notImplementedYet(); }
    @Override public LifeGoalTodayResponse getLifeGoalsToday() { throw notImplementedYet(); }

    /** Task 1 scaffolding (mezo-iizd.5): a progress-service a Task 5-ben érkezik. */
    private static SystemRuntimeErrorException notImplementedYet() {
        return new SystemRuntimeErrorException(SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }
```

(A generált metódusnevek/paramtípusok eltérhetnek — igazodj a generált `LifeGoalApi`-hoz.)

Run: `cd backend && ./mvnw compile -q`
Expected: zöld fordítás.

- [ ] **Step 4: Commit**

```bash
git add api/feature/lifegoal/lifegoal.yml frontend/src/data/_client/api.gen.ts backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/controller/LifeGoalController.java
git commit -m "feat(api): lifegoal progress/today/evaluate kontrakt (mezo-iizd.5)"
```

---

### Task 2: LifeGoalScorer — tiszta pontozó (TDD)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/engine/SignalWindow.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/engine/PillarDayScore.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/engine/LifeGoalScorer.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/engine/LifeGoalScorerTest.java` (sima JUnit, NEM Spring)

**Interfaces:**
- Consumes: `PillarRuleJson`, `PillarSourceJson` (entity csomag, léteznek).
- Produces (a Task 4–7 erre épül — pontos aláírások):

```java
/** A forrás-ablak: napi értékek; targets CSAK a weight_goal forrásnál nem null (expected ütemvonal). */
public record SignalWindow(Map<LocalDate, BigDecimal> values, Map<LocalDate, BigDecimal> targets) {
    public static SignalWindow of(Map<LocalDate, BigDecimal> values) { return new SignalWindow(values, null); }
}

/** Egy pillér-nap kiszámolt eredménye. status ∈ hit|partial|miss|no_data (string, a DB-oszlop szótára). */
public record PillarDayScore(String status, BigDecimal value, BigDecimal target, BigDecimal baseline) {}

public final class LifeGoalScorer {
    public static final double ARROW_THRESHOLD = 0.10;
    public static final int ARROW_SHORT_DAYS = 7;
    public static final int ARROW_LONG_DAYS = 21;
    public static final int ARROW_MIN_DATA_DAYS = 5;
    private LifeGoalScorer() {}
    /** Napi státusz fajtánként (alap-spec §5 + D-2). kind ∈ habit|average|target|baseline|linked. */
    public static PillarDayScore scoreDay(String kind, PillarRuleJson rule, LocalDate day, SignalWindow window);
    /** Súlyozott napi cél-pont: hit=1, partial=0.5, miss=0, no_data kimarad; mind no_data → null. */
    public static Double dailyPoint(List<WeightedStatus> statuses);
    public record WeightedStatus(int weight, String status) {}
    /** 7 vs 21 napos nyíl. series: nap → pont (0..1, null-mentes map — a no_data nap NINCS benne). Return: up|flat|down|insufficient. */
    public static String arrow(Map<LocalDate, Double> series, LocalDate today);
}
```

Pontozási szabályok, amiket a teszt rögzít (alap-spec §5 + D-2, itt kiegészítve a determinisztikus részletekkel):
- **habit**: a napi érték a `comparator` (`gte`/`lte`) jó oldalán a `threshold`-hoz képest → `hit`, különben `miss`; nincs érték → `no_data`. `value`=napi érték, `target`=threshold.
- **average**: a napra végződő `windowDays` (alap 7) ablak elérhető értékeinek átlaga vs `threshold`: jó oldal → `hit`; rossz oldal, de a thresholdtól 10%-on belül → `partial`; különben `miss`; az ablakban nincs érték → `no_data`. `value`=ablak-átlag, `target`=threshold.
- **target**: `expected(day) = startValue + (targetValue − startValue) × elapsed/total` (elapsed = nap − startDate, total = targetDate − startDate, napokban; total ≤ 0 → `no_data`); a napi érték az expected jó oldalán (`direction`: `up` → érték ≥ expected, `down` → érték ≤ expected) → `hit`, különben `miss`; nincs napi érték → `no_data`. `value`=napi érték, `target`=expected.
- **baseline**: az azt MEGELŐZŐ `windowDays` (alap 28) nap értékeinek mediánja; ha az ablakban < `minDataDays` (alap 14) adat-nap VAGY nincs napi érték → `no_data`; a napi érték a mediánnál jobb (`direction` szerint szigorúan jobb) → `hit`, különben `miss`. `value`=napi érték, `baseline`=medián.
- **linked**: a window `values` = trend-súly, `targets` = expected ütemvonal (a rule ITT ÜRES — alap-spec §4, az igazság az aktív súlycél); trend a jó oldalon VAGY 0,3 kg-on belül az expectedtől → `hit`, különben `partial` (SOHA nem miss); nincs trend-érték vagy target arra a napra → `no_data`. A jó oldal iránya a `targets` vonal lejtéséből: ha a targets legkésőbbi értéke < legkorábbi (fogyás) → `hit` ha trend ≤ expected+0,3; különben (hízás/tartás) → `hit` ha trend ≥ expected−0,3. Egyetlen target-nap esetén |trend − expected| ≤ 0,3 → `hit`. `value`=trend, `target`=expected.
- **arrow**: rövid ablak = (today−6 … today), hosszú = (today−27 … today−7); mindkettőben ≥ 5 adat-nap kell, különben `insufficient`; diff = mean(rövid) − mean(hosszú); ≥ +0.10 → `up`, ≤ −0.10 → `down`, különben `flat`.
- Ismeretlen kind → `no_data` (defenzív, nem exception — a katalógus-validáció a felvételnél véd).

- [ ] **Step 1: Írd meg a bukó tesztet** — `LifeGoalScorerTest` (részlet; MINDEN fenti ágra írj esetet, kb. 20 teszt):

```java
package io.mrkuhne.mezo.feature.lifegoal.engine;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.lifegoal.entity.PillarRuleJson;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class LifeGoalScorerTest {

    private static final LocalDate DAY = LocalDate.of(2026, 9, 1);

    private static PillarRuleJson habitRule(String cmp, String threshold) {
        return new PillarRuleJson(new BigDecimal(threshold), cmp, 4, null, null, null, null, null, null, null);
    }

    @Test
    void habit_hit_on_good_side_of_gte_threshold() {
        SignalWindow w = SignalWindow.of(Map.of(DAY, new BigDecimal("165")));
        assertThat(LifeGoalScorer.scoreDay("habit", habitRule("gte", "160"), DAY, w).status()).isEqualTo("hit");
    }

    @Test
    void habit_no_value_is_no_data_never_miss() {
        assertThat(LifeGoalScorer.scoreDay("habit", habitRule("gte", "160"), DAY, SignalWindow.of(Map.of()))
            .status()).isEqualTo("no_data");
    }

    @Test
    void average_within_ten_percent_is_partial() {
        Map<LocalDate, BigDecimal> vals = new HashMap<>();
        for (int i = 0; i < 7; i++) vals.put(DAY.minusDays(i), new BigDecimal("150")); // avg 150 vs ≥160 → 6.25% alatta
        PillarRuleJson rule = new PillarRuleJson(new BigDecimal("160"), "gte", null, 7, null, null, null, null, null, null);
        assertThat(LifeGoalScorer.scoreDay("average", rule, DAY, SignalWindow.of(vals)).status()).isEqualTo("partial");
    }

    @Test
    void target_hit_on_good_side_of_pace_line() {
        PillarRuleJson rule = new PillarRuleJson(null, null, null, null, new BigDecimal("0"),
            new BigDecimal("100"), DAY.minusDays(10), DAY.plusDays(10), "up", null);
        // expected(DAY) = 0 + 100×10/20 = 50
        SignalWindow w = SignalWindow.of(Map.of(DAY, new BigDecimal("55")));
        PillarDayScore s = LifeGoalScorer.scoreDay("target", rule, DAY, w);
        assertThat(s.status()).isEqualTo("hit");
        assertThat(s.target()).isEqualByComparingTo("50");
    }

    @Test
    void baseline_under_min_data_days_is_no_data() {
        Map<LocalDate, BigDecimal> vals = new HashMap<>();
        for (int i = 1; i <= 13; i++) vals.put(DAY.minusDays(i), new BigDecimal("7")); // csak 13 adat-nap
        vals.put(DAY, new BigDecimal("8"));
        PillarRuleJson rule = new PillarRuleJson(null, null, null, 28, null, null, null, null, "up", 14);
        assertThat(LifeGoalScorer.scoreDay("baseline", rule, DAY, SignalWindow.of(vals)).status()).isEqualTo("no_data");
    }

    @Test
    void linked_off_pace_is_partial_never_miss() {
        Map<LocalDate, BigDecimal> trend = Map.of(DAY, new BigDecimal("90.0"));
        Map<LocalDate, BigDecimal> expected = Map.of(
            DAY.minusDays(1), new BigDecimal("88.1"),   // fogyó ütemvonal
            DAY, new BigDecimal("88.0"));               // trend 2 kg felette → nem hit
        PillarDayScore s = LifeGoalScorer.scoreDay("linked",
            new PillarRuleJson(null, null, null, null, null, null, null, null, null, null), // linked rule üres
            DAY, new SignalWindow(trend, expected));
        assertThat(s.status()).isEqualTo("partial");
    }

    @Test
    void daily_point_weights_and_skips_no_data() {
        Double p = LifeGoalScorer.dailyPoint(List.of(
            new LifeGoalScorer.WeightedStatus(2, "hit"),
            new LifeGoalScorer.WeightedStatus(1, "miss"),
            new LifeGoalScorer.WeightedStatus(3, "no_data")));
        assertThat(p).isEqualTo(2.0 / 3.0, org.assertj.core.data.Offset.offset(1e-9));
    }

    @Test
    void all_no_data_daily_point_is_null() {
        assertThat(LifeGoalScorer.dailyPoint(List.of(new LifeGoalScorer.WeightedStatus(1, "no_data")))).isNull();
    }

    @Test
    void arrow_insufficient_below_five_data_days_in_either_window() {
        Map<LocalDate, Double> series = new HashMap<>();
        for (int i = 0; i < 7; i++) series.put(DAY.minusDays(i), 1.0); // rövid ablak ok, hosszú üres
        assertThat(LifeGoalScorer.arrow(series, DAY)).isEqualTo("insufficient");
    }

    @Test
    void arrow_up_at_plus_point_one() {
        Map<LocalDate, Double> series = new HashMap<>();
        for (int i = 7; i < 28; i++) series.put(DAY.minusDays(i), 0.5);
        for (int i = 0; i < 7; i++) series.put(DAY.minusDays(i), 0.6);
        assertThat(LifeGoalScorer.arrow(series, DAY)).isEqualTo("up");
    }
}
```

- [ ] **Step 2: Futtasd — buknia kell**

Run: `cd backend && ./mvnw test -Dtest='LifeGoalScorerTest' -Dmezo.test.use-testcontainers=true`
Expected: compile error (nincs `LifeGoalScorer`) vagy FAIL.

- [ ] **Step 3: Minimál implementáció** — `SignalWindow`, `PillarDayScore` a fenti Produces blokk szerint; a `LifeGoalScorer` a rögzített szabályokkal. BigDecimal-összehasonlítás `compareTo`-val; átlag/medián double-ban számolva, `value`/`target`/`baseline` `BigDecimal.valueOf(...).setScale(3, RoundingMode.HALF_UP)`-pal. A `partial` sáv: `abs(avg − threshold) / threshold ≤ 0.10` (threshold=0 esetén nincs partial). Linked jó-oldal: `targetValue < startValue` → fogyás.

- [ ] **Step 4: Zöldre**

Run: `cd backend && ./mvnw test -Dtest='LifeGoalScorerTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS, minden teszt.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/engine backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/engine
git commit -m "feat(lifegoal): tiszta LifeGoalScorer — napi státusz, súlyozott pont, irány-nyíl (mezo-iizd.5)"
```

---

### Task 3: SignalSource port + metric/social/activity/needs adapterek

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/engine/SignalSource.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/engine/MetricSignalSource.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/engine/SocialMentionsSignalSource.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/engine/ActivitySignalSource.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/engine/NeedsRingSignalSource.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/engine/SignalSourceIT.java`

**Interfaces:**
- Consumes: `MetricSeriesService.series(UUID, MetricKey, LocalDate, LocalDate) → Map<LocalDate, Double>` (companion), `ActivityLogRepository.findByCreatedByAndOccurredOnBetween`, `NeedsDayRepository.findByCreatedByAndNeedsDateBetweenAndDeletedFalseOrderByNeedsDateAsc`, `SignalWindow` (Task 2).
- Produces:

```java
/** Egy forrás-típus napi értéksora. A Task 5 ProgressService a listán supports()-szal diszpécsel. */
public interface SignalSource {
    boolean supports(PillarSourceJson source);
    SignalWindow window(UUID userId, PillarSourceJson source, LocalDate from, LocalDate to);
}
```

Megvalósítási szabályok:
- **MetricSignalSource** (`type=metric`): `MetricKey.valueOf(source.key())` — a katalógus-validáció miatt mindig ismert; a Double-mapet BigDecimal-lá képezi. Konstruktor-injektált `MetricSeriesService`.
- **SocialMentionsSignalSource** (`type=social_mentions`): fixen `MetricKey.SOCIAL_MENTIONS`.
- **ActivitySignalSource** (`type=activity`): a tartomány sorai közül a `skillKey`-re szűr, naponként aggregál `measure` szerint — `minutes`: Σ `extracted.durationMin` (null → 0 hozzájárulás), `count`: darabszám, `huf`: Σ `extracted.amountHuf`. Nap, ahol nincs sor → nincs kulcs (no_data).
- **NeedsRingSignalSource** (`type=needs_ring`): a `NeedsDayEntity` megfelelő gyűrű-mezője (`ring` ∈ energia|hidratacio|pihenes|mozgas|lelek|rend → getter) — CSAK létező (zárt) napokra ad kulcsot.
- Mindegyik `@Component`, `@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")`, `@RequiredArgsConstructor`.

- [ ] **Step 1: Bukó IT** — `SignalSourceIT` a meglévő `LifeGoalApiIT` IT-alapja szerint (nézd meg a szomszéd IT-k base-osztályát/annotációit, és KÖVESD): seedelj `ActivityLogEntity`-t (2 sor ugyanarra a napra, durationMin 20+40, skillKey `productivity`) és egy `NeedsDayEntity`-t (mozgas=80), majd:

```java
@Test
void activity_minutes_sums_per_day() {
    PillarSourceJson src = new PillarSourceJson("activity", null, "productivity", "minutes", null, null);
    SignalWindow w = pick(src).window(userId, src, day, day);
    assertThat(w.values().get(day)).isEqualByComparingTo("60");
}

@Test
void needs_ring_only_closed_days_have_keys() {
    PillarSourceJson src = new PillarSourceJson("needs_ring", null, null, null, null, "mozgas");
    SignalWindow w = pick(src).window(userId, src, day.minusDays(1), day);
    assertThat(w.values()).containsOnlyKeys(day);
    assertThat(w.values().get(day)).isEqualByComparingTo("80");
}
```

(`pick(src)` = az injektált `List<SignalSource>`-ból az első, amelyik `supports(src)`.)

- [ ] **Step 2: Futtasd — bukik** (compile error). Run: `cd backend && ./mvnw test -Dtest='SignalSourceIT' -Dmezo.test.use-testcontainers=true`

- [ ] **Step 3: Implementáld a 4 adaptert + az interfészt** a fenti szabályok szerint.

- [ ] **Step 4: Zöldre.** Run: ugyanaz. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/engine backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/engine
git commit -m "feat(lifegoal): SignalSource port + metric/social/activity/needs adapterek (mezo-iizd.5)"
```

---

### Task 4: WeightGoalSignalSource (linked forrás, D-2)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/engine/WeightGoalSignalSource.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/engine/WeightGoalSignalSourceIT.java`

**Interfaces:**
- Consumes: `SignalSource` + `SignalWindow` (Task 2–3); `GoalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")` (goal); `WeightTrendService.computeTrend(UUID) → WeightTrendResponse` (biometrics.weight; `.getSeries()` = `WeightTrendPoint(date, trendKg)` lista).
- Produces: a `type=weight_goal` forrás `SignalWindow`-ja, ahol `values` = napi trend-súly (a trend-serieből), `targets` = `expected(day) = startWeightKg + (targetWeightKg − startWeightKg) × elapsed/total` az aktív súlycél `startDate`/`targetDate` vonalán, MINDEN napra a kért tartományban, ami a cél-ablakba esik.

Szabályok: nincs aktív súlycél VAGY `targetWeightKg == null` VAGY a trend-serie üres → üres `values` (minden nap `no_data`). A rule-beli `startValue`/`targetValue` itt NEM kell — az igazság az aktív `GoalEntity`. A scorer linked-ága (Task 2) a `targets`-ből dönt.

- [ ] **Step 1: Bukó IT** — seedelj aktív `GoalEntity`-t (startWeightKg 92, targetWeightKg 85, startDate=−20 nap, targetDate=+50 nap) + napi `WeightLogEntity`-sort (92.0-ról 91.0-ra csökkenő, 15 nap), és:

```java
@Test
void window_carries_trend_values_and_expected_targets() {
    PillarSourceJson src = new PillarSourceJson("weight_goal", null, null, null, null, null);
    SignalWindow w = source.window(userId, src, today.minusDays(6), today);
    assertThat(w.values()).isNotEmpty();
    assertThat(w.targets().get(today)).isNotNull();
    // expected(ma) = 92 + (85−92) × 20/70 = 90.0
    assertThat(w.targets().get(today).doubleValue()).isCloseTo(90.0, within(0.05));
}

@Test
void no_active_goal_yields_empty_window() { /* másik user, cél nélkül → values üres */ }
```

- [ ] **Step 2: Futtasd — bukik.** Run: `cd backend && ./mvnw test -Dtest='WeightGoalSignalSourceIT' -Dmezo.test.use-testcontainers=true`

- [ ] **Step 3: Implementáld** — `@Component` + LIFEGOAL_SWITCH-gate, `GoalRepository` + `WeightTrendService` injektálva; az első aktív cél (a goal-motor egy-aktív invariánsa miatt legfeljebb egy van).

- [ ] **Step 4: Zöldre.** Run: ugyanaz. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/engine backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/engine
git commit -m "feat(lifegoal): WeightGoalSignalSource — trend vs ütemvonal (mezo-iizd.5, D-2)"
```

---

### Task 5: LifeGoalProgressService + progress endpoint

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalProgressService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/controller/LifeGoalController.java` — a Task 1 három stub-overridja itt vált valódi delegálásra (`progressService.progress/evaluate/today`), a `notImplementedYet()` segéd törlődik; mindhárom service-metódus ebben a taskban létrejön (az evaluate/today belső logikáját a Task 6–7 teszi teljessé és fedi IT-vel)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalProgressApiIT.java`

**Interfaces:**
- Consumes: `SignalSource` lista (Task 3–4), `LifeGoalScorer` (Task 2), `LifeGoalService.requireOwned(userId, id)` (package-private, létezik), `LifeGoalPillarRepository.findByGoalIdAndDeletedFalseOrderByPositionAsc`, `LifeGoalPillarDayRepository.findByPillarIdInAndDayBetweenAndDeletedFalseOrderByDayAsc`.
- Produces:

```java
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalProgressService {
    /** Tárolt sorok győznek; hiányzó nap olvasáskor számolódik (NEM íródik). from > to → 400. */
    @Transactional(readOnly = true)
    public LifeGoalProgressResponse progress(UUID userId, UUID goalId, LocalDate from, LocalDate to);
    /** Az utolsó 3 LEZÁRT nap (tegnap, −2, −3) upsertje minden aktív pillérre, majd 28 napos progress. */
    @Transactional
    public LifeGoalProgressResponse evaluate(UUID userId, UUID goalId);
    /** Aktív célonként: nyíl + 7 napi cél-pont-pötty + mai pillér-számláló. */
    @Transactional(readOnly = true)
    public LifeGoalTodayResponse today(UUID userId);
}
```

Belső folyamat (progress):
1. `requireOwned`; pillérek betöltése; INAKTÍV (`active=false`) pillér kimarad a pontból és a válaszból.
2. Pillérenként forrás-diszpécs (`sources.stream().filter(s -> s.supports(p.getSource())).findFirst()`); nincs találat (pl. `habit` típus) → minden nap `no_data`. Az ablakot bővítve kérd le: `from − 28 nap` (baseline/average visszatekintés) — a scorer kapja a bő ablakot, a válasz csak `from..to` napokat tartalmaz.
3. Naponként `scoreDay`; a TÁROLT `life_goal_pillar_day` sor (ha van) felülírja a számoltat (status/value/target/baseline onnan).
4. `dailyPoint` a napi cél-ponthoz; `arrow` pillérenként (status→pont: hit=1, partial=0.5, miss=0; no_data nap kimarad a serie-ből) és célra (napi pontok serie-je).
5. `currentValue` = az utolsó 7 nap érték-átlaga; `referenceValue` = threshold / expected(to) / baseline-medián kind szerint; `missingHitDays` csak habit + `down` nyílnál.
6. `weeklyPct` = round(mean(utolsó 7 nap pontjai) × 100), ha van adat-nap.
7. Konfliktus: a felhasználó ÖSSZES aktív céljának aktív pillérei közt azonos jel-identitás (SignalCatalog.find → entry id), ellentétes kívánt irány (habit/average: comparator `gte`↔`lte`; target/baseline: direction `up`↔`down`; a linked kimarad) → magyar egysoros: `"<jel label> · két cél ellentétes irányba húzza (<másik cél címe>)"`.

- [ ] **Step 1: Bukó IT** — `LifeGoalProgressApiIT`: seedelj célt egy `habit` fajtájú, `activity_productivity` forrású pillérrel (threshold 30, gte, daysPerWeek 4) + `ActivityLogEntity` sorokkal (3 nap: 40/20/45 perc), és MockMvc-vel:

```java
@Test
void progress_scores_days_and_serves_arrow_gate() throws Exception {
    mvc.perform(get("/api/life-goals/{id}/progress", goalId)
            .param("from", today.minusDays(6).toString()).param("to", today.toString()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.pillars[0].days[?(@.day=='" + d1 + "')].status").value("hit"))     // 40 perc
        .andExpect(jsonPath("$.pillars[0].days[?(@.day=='" + d2 + "')].status").value("miss"))    // 20 perc
        .andExpect(jsonPath("$.pillars[0].days[?(@.day=='" + d0 + "')].status").value("no_data")) // nincs sor
        .andExpect(jsonPath("$.pillars[0].arrow").value("insufficient"))                          // < 5 adat-nap
        .andExpect(jsonPath("$.conflicts").isArray());
}

@Test
void foreign_goal_is_404() throws Exception { /* másik user célja → 404 */ }
```

- [ ] **Step 2: Futtasd — bukik.** Run: `cd backend && ./mvnw test -Dtest='LifeGoalProgressApiIT' -Dmezo.test.use-testcontainers=true`

- [ ] **Step 3: Implementáld** a service-t + a controller 3 @Override-ját (`getLifeGoalProgress`, `evaluateLifeGoal`, `getLifeGoalsToday` — mindhárom delegál, a today/evaluate teste is kész service-hívás, a Task 6–7 IT-je fedi le őket).

- [ ] **Step 4: Zöldre**, majd a Task 2–4 tesztjei is: Run: `cd backend && ./mvnw test -Dtest='LifeGoal*' -Dmezo.test.use-testcontainers=true` Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal
git commit -m "feat(lifegoal): progress endpoint — tárolt sorok + olvasáskori pontozás + konfliktus-derivált (mezo-iizd.5)"
```

---

### Task 6: evaluate — 3 napos idempotens upsert

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalProgressService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalEvaluateApiIT.java`

**Interfaces:**
- Consumes: `LifeGoalPillarDayRepository.findByPillarIdAndDayAndDeletedFalse` (upsert-lookup), Task 5 service.
- Produces: működő `POST /api/life-goals/{id}/evaluate` — upsert (tegnap, −2, −3) MINDEN aktív pillérre (`computedAt` frissül, `createdBy` a goal tulaja), majd 28 napos progress-válasz (`from = ma−27`, `to = ma`).

- [ ] **Step 1: Bukó IT**:

```java
@Test
void evaluate_upserts_last_three_closed_days_idempotently() throws Exception {
    mvc.perform(post("/api/life-goals/{id}/evaluate", goalId)).andExpect(status().isOk());
    long after1 = dayRepository.count();
    mvc.perform(post("/api/life-goals/{id}/evaluate", goalId)).andExpect(status().isOk());
    assertThat(dayRepository.count()).isEqualTo(after1);        // nincs duplikált sor
    assertThat(after1).isEqualTo(3);                            // 1 pillér × 3 lezárt nap
    assertThat(dayRepository.findByPillarIdAndDayAndDeletedFalse(pillarId, yesterday))
        .hasValueSatisfying(r -> assertThat(r.getStatus()).isEqualTo("hit"));
}

@Test
void late_logging_flips_a_stored_miss_on_reevaluate() throws Exception {
    mvc.perform(post("/api/life-goals/{id}/evaluate", goalId)).andExpect(status().isOk()); // tegnap: nincs adat → no_data
    seedActivity(yesterday, 45);                                                           // kései naplózás
    mvc.perform(post("/api/life-goals/{id}/evaluate", goalId)).andExpect(status().isOk());
    assertThat(dayRepository.findByPillarIdAndDayAndDeletedFalse(pillarId, yesterday))
        .hasValueSatisfying(r -> assertThat(r.getStatus()).isEqualTo("hit"));
}
```

- [ ] **Step 2: Futtasd — bukik.** Run: `cd backend && ./mvnw test -Dtest='LifeGoalEvaluateApiIT' -Dmezo.test.use-testcontainers=true`

- [ ] **Step 3: Implementáld** az `evaluate`-et: napok = `ma−1 … ma−3`; pillérenként `scoreDay` a bő ablakból; létező sor → mezők frissítése, hiányzó → új entity; `saveAll`.

- [ ] **Step 4: Zöldre.** Run: ugyanaz. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal
git commit -m "feat(lifegoal): evaluate — 3 lezárt nap idempotens upsertje (mezo-iizd.5)"
```

---

### Task 7: today endpoint

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalProgressService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalTodayApiIT.java`

**Interfaces:**
- Consumes: Task 5 belső folyamat.
- Produces: `GET /api/life-goals/today` — aktív célonként `LifeGoalTodaySummary`: `arrow` (28 napos serie-ből), `days7` (ma−6…ma napi cél-pontok pötty-státusszá képezve: ≥0.66 `hit`, ≥0.33 `partial`, <0.33 `miss`, null `no_data`), `pillarsTotal` = aktív pillérek, `pillarsHitToday` = ma `hit` státuszú pillérek.

- [ ] **Step 1: Bukó IT**:

```java
@Test
void today_lists_active_goals_with_dots_and_tally() throws Exception {
    mvc.perform(get("/api/life-goals/today"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.goals[0].goalId").value(goalId.toString()))
        .andExpect(jsonPath("$.goals[0].days7.length()").value(7))
        .andExpect(jsonPath("$.goals[0].days7[6]").value("hit"))   // mai activity-sor seedelve
        .andExpect(jsonPath("$.goals[0].pillarsHitToday").value(1));
}

@Test
void parked_goal_is_absent() throws Exception { /* parkolt cél nem szerepel */ }
```

- [ ] **Step 2: Futtasd — bukik.** Run: `cd backend && ./mvnw test -Dtest='LifeGoalTodayApiIT' -Dmezo.test.use-testcontainers=true`

- [ ] **Step 3: Implementáld** — a progress belső útvonalát újrahasznosítva (28 napos ablak célonként).

- [ ] **Step 4: Zöldre + teljes lifegoal-kör + ArchUnit:**

Run: `cd backend && ./mvnw test -Dtest='LifeGoal*' -Dmezo.test.use-testcontainers=true && ./mvnw test -Dtest='*Arch*Test'`
Expected: PASS mindkettő (ArchUnit: nincs új ciklus a lifegoal→biometrics/goal élekkel).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal
git commit -m "feat(lifegoal): today endpoint a hub- és Nap-csempének (mezo-iizd.5)"
```

---

### Task 8: FE adatréteg — api + mock + hookok + MSW

**Files:**
- Modify: `frontend/src/data/lifegoal/lifegoalApi.ts`
- Modify: `frontend/src/data/lifegoal/lifegoalMock.ts`
- Modify: `frontend/src/data/lifegoal/lifegoalHooks.ts`
- Modify: `frontend/src/data/hooks.ts` (barrel: `useLifeGoalProgress`, `useLifeGoalToday` export)
- Modify: `frontend/src/test/msw/handlers.ts`
- Test: `frontend/src/data/lifegoal/lifegoalHooks.test.tsx` (bővítés)

**Interfaces:**
- Consumes: generált típusok (`api.gen.ts`, Task 1): `LifeGoalProgressResponse`, `LifeGoalTodayResponse`, `PillarProgress`, `PillarDayEntry`, `TrendArrow`, `PillarDayStatus`.
- Produces:

```ts
// lifegoalApi.ts — új sorok:
export type LifeGoalProgressResponse = components['schemas']['LifeGoalProgressResponse']
export type LifeGoalTodayResponse = components['schemas']['LifeGoalTodayResponse']
export type PillarProgress = components['schemas']['PillarProgress']
export type PillarDayStatus = components['schemas']['PillarDayStatus']
export type TrendArrow = components['schemas']['TrendArrow']
// az objektumban:
  progress: (id: string, from: string, to: string) =>
    apiFetch<LifeGoalProgressResponse>(`/api/life-goals/${id}/progress?from=${from}&to=${to}`),
  today: () => apiFetch<LifeGoalTodayResponse>('/api/life-goals/today'),
  evaluate: (id: string) => apiFetch<LifeGoalProgressResponse>(`/api/life-goals/${id}/evaluate`, { method: 'POST' }),
```

```ts
// lifegoalHooks.ts — új hookok (a useDualQuery mintája, realStaleTime EXPLICIT):
export const LIFE_GOAL_PROGRESS_KEY = (id: string) => ['lifeGoalProgress', id] as const
export const LIFE_GOAL_TODAY_KEY = ['lifeGoalToday'] as const

/** 28 napos ablak: from = ma−27, to = ma (ISO yyyy-MM-dd). */
export function useLifeGoalProgress(id: string | undefined): {
  progress: LifeGoalProgressResponse | null; isPending: boolean; isError: boolean }

export function useLifeGoalToday(): {
  today: LifeGoalTodayResponse; isPending: boolean; isError: boolean }
```

- Mock: `lifegoalMock.ts`-be determinisztikus generátor — NEM véletlenszám (teszt-stabilitás):

```ts
/** Determinisztikus 28 napos mock-progress a seed-célokhoz: a (goalId, pillarId, dayIndex) hash
 *  dönti a státuszt úgy, hogy legyen hit/partial/miss/no_data vegyesen, az első seed-cél nyila 'up',
 *  a másodiké 'down' (missingHitDays=2), a többi 'insufficient'. */
export function mockProgress(goalId: string): LifeGoalProgressResponse
export function mockToday(): LifeGoalTodayResponse
```

- MSW (`handlers.ts`): a lifegoal-blokkban a STATIKUS `today` a `:id` handler ELÉ (a meglévő NOTE-komment alá), a progress/evaluate a `:id`-s szakaszba:

```ts
  http.get(`${API_BASE}/api/life-goals/today`, () => HttpResponse.json(mockToday())),
  // ... meglévő :id handlerek után:
  http.get(`${API_BASE}/api/life-goals/:id/progress`, ({ params }) =>
    findLifeGoal(params.id as string) != null
      ? HttpResponse.json(mockProgress(params.id as string))
      : new HttpResponse(null, { status: 404 })),
  http.post(`${API_BASE}/api/life-goals/:id/evaluate`, ({ params }) =>
    findLifeGoal(params.id as string) != null
      ? HttpResponse.json(mockProgress(params.id as string))
      : new HttpResponse(null, { status: 404 })),
```

- [ ] **Step 1: Bukó hook-teszt** — a meglévő `lifegoalHooks.test.tsx` mintájára:

```tsx
it('useLifeGoalProgress returns 28 days per pillar', async () => {
  const { result } = renderDataHook(() => useLifeGoalProgress(MOCK_LIFE_GOALS[0].id))
  await waitFor(() => expect(result.current.isPending).toBe(false))
  expect(result.current.progress?.pillars[0]?.days).toHaveLength(28)
})

it('useLifeGoalToday lists only active goals', async () => {
  const { result } = renderDataHook(() => useLifeGoalToday())
  await waitFor(() => expect(result.current.isPending).toBe(false))
  expect(result.current.today.goals.length).toBeGreaterThan(0)
  expect(result.current.today.goals.every((g) => g.days7.length === 7)).toBe(true)
})
```

(A meglévő teszt-fájl render-segédjét használd — nézd meg, hogyan mountolja a QueryClientProvider-t.)

- [ ] **Step 2: Futtasd mindkét módban — bukik**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test lifegoalHooks && VITE_USE_MOCK=false pnpm test lifegoalHooks`
Expected: FAIL (nincs hook).

- [ ] **Step 3: Implementáld** az api/mock/hooks/MSW négyest a fenti kontraktok szerint.

- [ ] **Step 4: Zöldre mindkét módban.** Run: ugyanaz. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data frontend/src/test/msw/handlers.ts
git commit -m "feat(fe): lifegoal progress/today dual-mode adatréteg + MSW (mezo-iizd.5)"
```

---

### Task 9: PillarCard + CelPage élő haladás

**Files:**
- Modify: `frontend/src/features/me/components/PillarCard.tsx`
- Modify: `frontend/src/features/me/pages/CelPage.tsx`
- Modify (ha kell új osztály): `frontend/src/styles/prototype.css` (lg-* szabály a Today-szekció ELÉ)
- Test: `frontend/src/features/me/pages/CelPage.test.tsx` (vagy a meglévő teszt-fájl bővítése — nézd meg, mi létezik `frontend/src/features/me/pages/` alatt)

**Interfaces:**
- Consumes: `useLifeGoalProgress` (Task 8), `PillarProgress`, `TrendArrow`; a prototípus `docs/design_2.0/prototypes/celok.html` `#page-g1` blokkja (lg-arrow up/down/none, lg-wk7 pötty-osztályok — PONTOSAN az ottani osztályneveket használd).
- Produces: `PillarCard({ pillar, progress, delayMs })` — a `progress?: PillarProgress` új, opcionális prop; `undefined` → a mai őszinte placeholder marad (mock-üzemben is mindig jön adat, real-módban a betöltési ablak alatt placeholder).

Viselkedés:
- Nyíl: `arrow` szerint `↗/→/↘` a prototípus osztályaival; `insufficient` → a mai `—` + "még nincs elég adat · az első nyíl 5 adat-nap után" copy marad.
- Érték-sor: `currentValue` + a `ruleLine` referenciaértéke (`referenceValue`); `↘`-nél habitnál: `még {missingHitDays} hit-nap a fordulásig`.
- 7 pötty: a `days` utolsó 7 eleme státusz szerint színezve (hit/partial/miss/no_data osztályok a prototípusból); baseline fajtánál a 28 napos hőtérkép-sor (a prototípus 28-cellás változata), ha a prototípusban külön blokk van rá.
- **Hét/Hónap chipek** (alap-spec §6, a prototípus fejléce szerint): egy `useState<'week' | 'month'>` váltó a `CelPage` tetején; `week` = a mai 7 pöttyös nézet, `month` = pillérenként 28-cellás hőtérkép-sor a `days` teljes tartalmából (ugyanazok a státusz-osztályok). A chipek helye és kinézete a prototípus `#page-g1` fejléce.
- `↘` SOHA nem piros (guardrail — a prototípus színei már ilyenek, ne térj el).

- [ ] **Step 1: Bukó render-teszt**:

```tsx
it('renders live dots and arrow from progress', async () => {
  render(<CelPageWrapper goalId={MOCK_LIFE_GOALS[0].id} />)
  await screen.findByText(MOCK_LIFE_GOALS[0].pillars[0].label)
  expect(document.querySelectorAll('.lg-wk7 i.h').length).toBeGreaterThan(0) // a prototípus hit-osztálya
  expect(screen.queryByText('még nincs adat · az első nyíl 5 adat-nap után')).toBeNull()
})
```

(A `.h` osztálynevet ELLENŐRIZD a prototípusban, és igazítsd a tesztet a valódihoz, mielőtt implementálsz.)

- [ ] **Step 2: Futtasd mindkét módban — bukik.** Run: `cd frontend && VITE_USE_MOCK=true pnpm test CelPage && VITE_USE_MOCK=false pnpm test CelPage`

- [ ] **Step 3: Implementáld** — `CelPage` hívja a `useLifeGoalProgress(goal.id)`-t, hero big = cél-nyíl + `weeklyPct` („{pct}%”), a PillarCardok megkapják a hozzájuk tartozó `PillarProgress`-t (pillarId szerint párosítva); a `PageBody principle` sor marad.

- [ ] **Step 4: Zöldre mindkét módban + build.** Run: `cd frontend && VITE_USE_MOCK=true pnpm test CelPage && VITE_USE_MOCK=false pnpm test CelPage && pnpm build` Expected: PASS + zöld build.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/me frontend/src/styles/prototype.css
git commit -m "feat(fe): CelPage + PillarCard élő pöttyök, nyilak, heti % (mezo-iizd.5)"
```

---

### Task 10: LifeGoalTile + CelokPage élő hub

**Files:**
- Modify: `frontend/src/features/me/components/LifeGoalTile.tsx`
- Modify: `frontend/src/features/me/pages/CelokPage.tsx`
- Test: a CelokPage meglévő teszt-fájljának bővítése

**Interfaces:**
- Consumes: `useLifeGoalToday` (Task 8), `LifeGoalTodaySummary`.
- Produces: `LifeGoalTile({ goal, summary, delayMs, onClick })` — `summary?: LifeGoalTodaySummary`; a csempe nyila + 7 pöttye a summaryből; `undefined` → placeholder marad.

Viselkedés:
- `CelokPage`: `useLifeGoalToday()`; a hero companion-sorból törlődik az "Az irány-nyíl a 2. szelettel jön" mondat — helyette nyíl-számlálók: `{n}↗ · {n}→ · {n}↘` (insufficient nem számít bele, a prototípus hero-sora szerint); a csempék goalId szerint kapják a summaryt.
- A pötty-státusz osztályok ugyanazok, mint a Task 9-ben.

- [ ] **Step 1: Bukó render-teszt** — a hub mutat élő nyilat és számlálót:

```tsx
it('hub shows arrow counters and live tile dots', async () => {
  render(<CelokPageWrapper />)
  await screen.findByText('Célok')
  expect(screen.queryByText(/Az irány-nyíl a 2\. szelettel jön/)).toBeNull()
  expect(document.querySelectorAll('.lg-tile .lg-wk7 i.h').length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Futtasd mindkét módban — bukik.** Run: `cd frontend && VITE_USE_MOCK=true pnpm test CelokPage && VITE_USE_MOCK=false pnpm test CelokPage`

- [ ] **Step 3: Implementáld.**

- [ ] **Step 4: Zöldre mindkét módban, majd a TELJES FE suite mindkét módban + build:**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build`
Expected: PASS + zöld build.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/me
git commit -m "feat(fe): CelokPage hub élő nyíl-számlálók + csempe-pöttyök (mezo-iizd.5)"
```

---

### Task 11: Docs + kapuk

**Files:**
- Modify: `docs/features/lifegoal.md` (§ pontozó motor: kész állapot, D-1..D-4 hivatkozás a szelet-specre; key_files frontmatter bővítése az engine-fájlokkal)
- Modify: `docs/CODEMAP.md` (generált)

**Interfaces:** —

- [ ] **Step 1: Frissítsd a `docs/features/lifegoal.md`-t** — a motor-szakasz a "slice 2 hozza" jelzésekről élő leírásra vált (scorer-szabályok, progress/today/evaluate, olvasáskori számolás vs tárolt sorok, a habit-forrás kihagyása és oka), key_files frontmatterbe: `engine/LifeGoalScorer.java`, `engine/SignalSource.java`, `service/LifeGoalProgressService.java`.

- [ ] **Step 2: Codemap + docs-lint**

Run: `node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs --errors-only`
Expected: codemap regenerálódik; docs-lint 0 ÚJ error (a main ~16 stale doc-ja előzetes, nem a miénk).

- [ ] **Step 3: Backend teljes lifegoal-kör + ArchUnit mégegyszer**

Run: `cd backend && ./mvnw test -Dtest='LifeGoal*' -Dmezo.test.use-testcontainers=true && ./mvnw test -Dtest='*Arch*Test'`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/features/lifegoal.md docs/CODEMAP.md
git commit -m "docs(lifegoal): motor-mag dokumentálva + codemap (mezo-iizd.5)"
```

---

### Task 12: Self-PR + CI + merge

**Files:** —

**Interfaces:** — (házirend: CLAUDE.md git workflow)

- [ ] **Step 1: Push + self-PR**

```bash
git push -u origin feat/lifegoal-scorer-core
gh pr create --title "feat(lifegoal): motor-mag + élő haladás (mezo-iizd.5)" --body "$(cat <<'EOF'
Slice 2a a mezo-iizd epicből: SignalSource port (5 adapter), tiszta LifeGoalScorer,
GET /{id}/progress · GET /today · POST /{id}/evaluate, FE élő pöttyök/nyilak/heti %.
Spec: docs/superpowers/specs/2026-09-03-lifegoal-slice2-motor-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Várd meg a CI-t** (~20 perc; `gh pr checks --watch`). Konfliktus esetén ("no checks reported"): merge origin/main az ágba, `.beads/issues.jsonl`-t bármelyik oldalra oldd (a hook újraexportál), push.

- [ ] **Step 3: Lokális `--no-ff` merge az AKTUÁLIS main tetején** (a worktree-ben `git checkout main` NEM megy):

```bash
git fetch origin && git checkout --detach origin/main && git merge --no-ff feat/lifegoal-scorer-core
node scripts/gen-codemap.mjs --check || { node scripts/gen-codemap.mjs && git add docs/CODEMAP.md && git commit --amend --no-edit; }
node scripts/lint-docs.mjs --errors-only
git push origin HEAD:main
git push origin --delete feat/lifegoal-scorer-core
bd close mezo-iizd.5 && bd dolt push
```

- [ ] **Step 4: Ellenőrzés** — `gh run list --branch main --limit 2` (deploy + ci elindult), `git status` tiszta.
