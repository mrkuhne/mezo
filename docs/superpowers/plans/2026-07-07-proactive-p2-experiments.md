# Proactive P2 — N=1 Experiments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** The companion proposes N=1 experiments on Daniel's own data; he accepts/dismisses with one tap (L2); the system tracks the window and evaluates the outcome deterministically — the last Insights ghost (Experiments) un-ghosts.

**Architecture:** The FINAL proactive surface, and the first with a WRITE path. Proposal generation mirrors the P1 `PredictionGenerator` (smart-tier, CONFIRMED-pattern-grounded); outcome evaluation reuses a **shared `MetricWindowEvaluator`** extracted from `PredictionValidationService` (DRY — same weight/sleep/training window-vs-baseline comparison). The write path mirrors the companion `PatternService.decide` (fetch-owned-or-404 → status guard → `saveAndFlush`). `POST .../experiment/{id}/decision` is L2 accept/dismiss; `POST .../experiment/propose` is the on-demand propose the "+ Új kísérlet javasol Mezo" button fires. FE mirrors the P1 un-ghost + the pattern-decision `useMutation`+`invalidateQueries` idiom.

**Tech Stack:** Spring Boot 4 / Java 21 / Liquibase / MapStruct / React 19 / TanStack Query / Vitest+MSW.

**Driving bd:** `mezo-h4wp.8` · Roadmap §P2 · Design spec §5.2.

## Global Constraints

- Dual-switch `@ConditionalOnProperty` on every bean; the job adds `EXPERIMENT_JOB_SWITCH`.
- Contract-first; marker literal-mirror rule; no fabricated numbers (outcome is code-computed; `outcome_good` NULLABLE = honest "nem értékelhető").
- Smart tier for proposal (`completeSmart`); deterministic LLM-free outcome eval.
- Backend gate `./mvnw clean test`; FE gate `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`; docs + lint before close.

## In-slice decisions (documented in proactive.md §9 at close)

- **(x) Propose trigger = BOTH:** a weekly `ExperimentJob.runPropose` cron + the "+ Új kísérlet javasol Mezo" button → `POST /api/proactive/experiment/propose`. The button becomes REAL in live mode (the W1/W2 false-affordance lesson, inverted); mock keeps it local.
- **(y) Propose cap:** a no-op when the user already has `max-open` (config, default 3) OPEN experiments (`proposed` OR `active`) — bounds both cron and button. Grounding gate = CONFIRMED patterns (the P1 gate).
- **(z) Lifecycle:** `proposed` →(accept)→ `active` (start_date=today) | →(dismiss)→ `dismissed`; `active` →(daily outcome cron, window closed)→ `completed`. Re-deciding a non-`proposed` experiment ⇒ **409 CONFLICT**; not-found/foreign ⇒ 404; invalid decision value ⇒ 400 (contract `@Pattern` + service guard).
- **(aa) Outcome eval (deterministic, shared evaluator):** over `[start_date, start_date+total_days-1]` vs the `total_days` before start; direction match `expected_direction` ⇒ `outcome_good=true` else `false`; **no data ⇒ `completed` with `outcome_good=null`** (honest "Nem értékelhető — nincs elég adat"). Window not closed ⇒ untouched.
- **(bb) List read:** `GET /api/proactive/experiment` returns `proposed`+`active`+`completed` (dismissed excluded), newest first; `200 []` = honest empty, NEVER 404 (the P1 list precedent).
- **Marker:** `EXPERIMENT_MARKER = "N1-KISERLET-FELADAT"` (prefix-collision-safe); sentinel GREEDY (nested payload). Metric catalog reuses the P1 3 keys.

---

### Task 1: Contract — experiment endpoints

**Files:** Modify `api/feature/proactive/proactive.yml`; regenerate.

**Produces:** `GET /api/proactive/experiment` → `ExperimentResponse[]` (200·401); `POST /api/proactive/experiment/{id}/decision` (body `ExperimentDecisionRequest{decision: accept|dismiss}`) → `ExperimentResponse` (200·400·401·404·409); `POST /api/proactive/experiment/propose` → `ExperimentResponse[]` (200·401). Backend `ProactiveApi.getExperiments()`/`decideExperiment(UUID, ExperimentDecisionRequest)`/`proposeExperiments()`.

- [ ] Add three paths after `/api/proactive/prediction` (mirror the pattern-decision fragment for the POST with `{id}` path param):

```yaml
  /api/proactive/experiment:
    get:
      tags: [Proactive]
      operationId: getExperiments
      summary: All live N=1 experiments (proposed/active/completed), newest first (P2)
      description: >-
        Returns the user's live experiments (dismissed excluded). An empty array is the honest
        empty state (never a 404). Lazily proposes when the user has none and has confirmed patterns.
      responses:
        '200':
          description: All live experiments (possibly empty)
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/ExperimentResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/proactive/experiment/propose:
    post:
      tags: [Proactive]
      operationId: proposeExperiments
      summary: On-demand experiment proposal ("+ Új kísérlet javasol Mezo") (P2)
      description: >-
        Generates up to the open-cap of experiment proposals from confirmed patterns. A no-op
        (empty array) when the cap is already met or there are no confirmed patterns.
      responses:
        '200':
          description: The freshly proposed experiments (possibly empty)
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/ExperimentResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/proactive/experiment/{id}/decision:
    post:
      tags: [Proactive]
      operationId: decideExperiment
      summary: L2 accept/dismiss a proposed experiment (P2)
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/ExperimentDecisionRequest' }
      responses:
        '200':
          description: The experiment with its new status
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ExperimentResponse' }
        '400':
          description: Validation error
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: Experiment not found (or owned by someone else)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '409':
          description: The experiment is not in the proposed state (already decided)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

- [ ] Add schemas after `PredictionResponse`:

```yaml
    ExperimentDecisionRequest:
      type: object
      required: [decision]
      properties:
        decision: { type: string, pattern: '^(accept|dismiss)$' }
    ExperimentResponse:
      type: object
      required: [id, title, hypothesis, status, metricKey, expectedDirection, totalDays, generatedAt]
      properties:
        id: { type: string, format: uuid }
        title: { type: string }
        hypothesis: { type: string }
        status:
          type: string
          description: proposed | active | completed | dismissed
        metricKey: { type: string }
        expectedDirection: { type: string, description: 'up | down | stable' }
        startDate:
          type: string
          format: date
          nullable: true
          description: Null until accepted (proposed rows have no start)
        totalDays: { type: integer }
        outcome:
          type: string
          nullable: true
          description: Code-formatted outcome once the window closed
        outcomeGood:
          type: boolean
          nullable: true
          description: true/false once evaluated; null = completed but inconclusive (no data)
        generatedAt: { type: string, format: date-time }
```

- [ ] `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`
- [ ] Commit: `feat(api): proactive experiment contract — list + propose + decide (mezo-h4wp.8)`

### Task 2: Extract `MetricWindowEvaluator` (refactor P1, keep green)

**Files:** Create `backend/.../feature/proactive/service/MetricWindowEvaluator.java`; modify `PredictionValidationService.java` to delegate. Test: existing `PredictionValidationIT` must stay green (behavior identical).

**Produces:** `MetricWindowEvaluator.evaluate(UUID userId, String metricKey, LocalDate winFrom, LocalDate winTo, LocalDate baseFrom, LocalDate baseTo): Verdict` where `public record Verdict(String direction, String actualText)`; null when a compare window has no data.

- [ ] Create `MetricWindowEvaluator` — lift the metric logic verbatim (weight/sleep/training + `avg`/`direction`/`round1`/`signed`/`inRange` helpers), parameterizing the baseline's upper bound (predictions pass `baseTo = winFrom.minusDays(1)`):

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Shared deterministic metric comparison (proactive P1 + P2): the window's avg/count vs a
 * baseline window, per the fixed metric catalog. LLM-free; null when a compare window has no
 * data (the honest "no verdict" state). Extracted from PredictionValidationService so P1
 * (window-close validation) and P2 (experiment outcome) share one implementation.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class MetricWindowEvaluator {

    public record Verdict(String direction, String actualText) {
    }

    private final WeightLogRepository weightLogRepository;
    private final SleepLogRepository sleepLogRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ProactiveProperties properties;

    /** null = no data in a compare window (honest — no verdict). */
    public Verdict evaluate(UUID userId, String metricKey,
                            LocalDate winFrom, LocalDate winTo, LocalDate baseFrom, LocalDate baseTo) {
        return switch (metricKey) {
            case PredictionEntity.METRIC_WEIGHT_TREND -> weight(userId, winFrom, winTo, baseFrom, baseTo);
            case PredictionEntity.METRIC_SLEEP_AVG -> sleep(userId, winFrom, winTo, baseFrom, baseTo);
            case PredictionEntity.METRIC_TRAINING_VOLUME -> volume(userId, winFrom, winTo, baseFrom, baseTo);
            default -> null;
        };
    }

    private Verdict weight(UUID userId, LocalDate winFrom, LocalDate winTo, LocalDate baseFrom, LocalDate baseTo) {
        List<WeightLogEntity> all = weightLogRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, baseFrom);
        BigDecimal win = avg(all.stream().filter(w -> inRange(w.getDate(), winFrom, winTo))
                .map(WeightLogEntity::getWeightKg).toList());
        BigDecimal base = avg(all.stream().filter(w -> inRange(w.getDate(), baseFrom, baseTo))
                .map(WeightLogEntity::getWeightKg).toList());
        if (win == null || base == null) {
            return null;
        }
        BigDecimal delta = win.subtract(base);
        return new Verdict(direction(delta, properties.prediction().weightEpsilonKg()),
                "átlag " + round1(win) + " kg vs " + round1(base) + " kg (" + signed(delta) + ")");
    }

    private Verdict sleep(UUID userId, LocalDate winFrom, LocalDate winTo, LocalDate baseFrom, LocalDate baseTo) {
        List<SleepLogEntity> all = sleepLogRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, baseFrom);
        BigDecimal win = avg(all.stream().filter(s -> inRange(s.getDate(), winFrom, winTo))
                .map(SleepLogEntity::getDurationH).toList());
        BigDecimal base = avg(all.stream().filter(s -> inRange(s.getDate(), baseFrom, baseTo))
                .map(SleepLogEntity::getDurationH).toList());
        if (win == null || base == null) {
            return null;
        }
        BigDecimal delta = win.subtract(base);
        return new Verdict(direction(delta, properties.prediction().sleepEpsilonH()),
                "átlag " + round1(win) + " h vs " + round1(base) + " h (" + signed(delta) + ")");
    }

    private Verdict volume(UUID userId, LocalDate winFrom, LocalDate winTo, LocalDate baseFrom, LocalDate baseTo) {
        int win = workoutSessionRepository.findDoneInstanceDates(userId, winFrom, winTo).size();
        int base = workoutSessionRepository.findDoneInstanceDates(userId, baseFrom, baseTo).size();
        if (win == 0 && base == 0) {
            return null;
        }
        int delta = win - base;
        String dir = delta > 0 ? PredictionEntity.DIRECTION_UP
                : delta < 0 ? PredictionEntity.DIRECTION_DOWN : PredictionEntity.DIRECTION_STABLE;
        return new Verdict(dir, win + " edzés vs " + base + " (" + (delta >= 0 ? "+" : "") + delta + ")");
    }

    private static boolean inRange(LocalDate d, LocalDate from, LocalDate to) {
        return d != null && !d.isBefore(from) && !d.isAfter(to);
    }

    private static BigDecimal avg(List<BigDecimal> values) {
        List<BigDecimal> present = values.stream().filter(v -> v != null).toList();
        if (present.isEmpty()) {
            return null;
        }
        return present.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(present.size()), 3, RoundingMode.HALF_UP);
    }

    private static String direction(BigDecimal delta, BigDecimal epsilon) {
        if (delta.abs().compareTo(epsilon) <= 0) {
            return PredictionEntity.DIRECTION_STABLE;
        }
        return delta.signum() > 0 ? PredictionEntity.DIRECTION_UP : PredictionEntity.DIRECTION_DOWN;
    }

    private static String round1(BigDecimal v) {
        return v.setScale(1, RoundingMode.HALF_UP).toPlainString();
    }

    private static String signed(BigDecimal delta) {
        BigDecimal r = delta.setScale(1, RoundingMode.HALF_UP);
        return (r.signum() >= 0 ? "+" : "") + r.toPlainString();
    }
}
```

- [ ] Rewrite `PredictionValidationService` to inject `MetricWindowEvaluator` and delegate — drop the private weight/sleep/volume/avg/direction/round1/signed/inRange + its own `Verdict` record + the weight/sleep/train repo deps; keep `PredictionRepository` + the loop:

```java
@Slf4j @Service @RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH}, havingValue = "true")
public class PredictionValidationService {
    private final PredictionRepository predictionRepository;
    private final MetricWindowEvaluator evaluator;

    @Transactional
    public int validateClosedWindows(UUID userId, LocalDate today) {
        List<PredictionEntity> due = predictionRepository
                .findByCreatedByAndStatusAndValidToBefore(userId, PredictionEntity.STATUS_PENDING, today);
        int closed = 0;
        for (PredictionEntity p : due) {
            MetricWindowEvaluator.Verdict v = evaluator.evaluate(
                    userId, p.getMetricKey(), p.getValidFrom(), p.getValidTo(),
                    p.getValidFrom().minusDays(7), p.getValidFrom().minusDays(1));
            if (v == null) { continue; }
            p.setStatus(v.direction().equals(p.getExpectedDirection())
                    ? PredictionEntity.STATUS_VALIDATED : PredictionEntity.STATUS_MISSED);
            p.setActual(v.actualText());
            predictionRepository.saveAndFlush(p);
            closed++;
        }
        return closed;
    }
}
```

- [ ] Run `./mvnw clean test -Dtest='PredictionValidationIT'` → 4 PASS (behavior unchanged). Commit: `refactor(proactive): extract MetricWindowEvaluator shared by P1/P2 (mezo-h4wp.8)`.

### Task 3: experiment table + entity + repo + populator + persistence IT

**Files:** migration `202607072000_mezo-h4wp.8_create_experiment.sql` + master; `entity/ExperimentEntity.java`; `repository/ExperimentRepository.java`; `support/populator/ExperimentPopulator.java` + `AbstractIntegrationTest` @Import + `ResetDatabase` (prepend `experiment`); `ExperimentPersistenceIT.java`.

**Produces:** `ExperimentEntity{UUID id, String title, String hypothesis, String status, String metricKey, String expectedDirection, LocalDate startDate?, int totalDays, String outcome?, Boolean outcomeGood?, Instant generatedAt}` + constants `STATUS_PROPOSED/ACTIVE/COMPLETED/DISMISSED`; `ExperimentRepository.findByIdAndCreatedByAndDeletedFalse`, `findByCreatedByAndStatusInOrderByGeneratedAtDesc`, `findByCreatedByAndStatusOrderByGeneratedAtDesc`, `countByCreatedByAndStatusIn`; `ExperimentPopulator.experiment(UUID, String status, String metricKey, String expectedDirection)`.

- [ ] Migration:

```sql
-- Proactive P2 (bd mezo-h4wp.8, roadmap §P2): N=1 experiments (propose → L2 accept → track → outcome).
-- status lifecycle proposed→active→completed | proposed→dismissed; outcome_good NULLABLE
-- (null = completed but inconclusive — no data); start_date null until accepted.

create table experiment (
    id                 uuid          not null default gen_random_uuid(),
    created_by         uuid          not null,
    is_deleted         boolean       not null default false,
    created_at         timestamptz   not null default now(),
    title              varchar(200)  not null,
    hypothesis         text          not null,
    status             varchar(10)   not null default 'proposed',
    metric_key         varchar(40)   not null,
    expected_direction varchar(8)    not null,
    start_date         date,
    total_days         int           not null,
    outcome            text,
    outcome_good       boolean,
    generated_at       timestamptz   not null,
    constraint pk_experiment_id primary key (id),
    constraint fk_experiment_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_experiment_expected_direction check (expected_direction in ('up', 'down', 'stable')),
    constraint ck_experiment_status check (status in ('proposed', 'active', 'completed', 'dismissed'))
);

create index idx_experiment_created_by_status on experiment (created_by, status) where is_deleted = false;
```

Register in `1.0.0_master.yml` (append after the prediction changeSet, id `"1.0.0:202607072000_mezo-h4wp.8_create_experiment"`).

- [ ] Entity (OwnedEntity, `@SQLDelete`/`@SQLRestriction`, the PredictionEntity shape; `@Pattern` on status/direction like PatternEntity; `Boolean outcomeGood` nullable; `LocalDate startDate` nullable):

```java
public static final String STATUS_PROPOSED = "proposed";
public static final String STATUS_ACTIVE = "active";
public static final String STATUS_COMPLETED = "completed";
public static final String STATUS_DISMISSED = "dismissed";
```
Fields: `id`, `title (200)`, `hypothesis (text)`, `status (@Pattern "proposed|active|completed|dismissed", default PROPOSED)`, `metricKey (40)`, `expectedDirection (@Pattern "up|down|stable", 8)`, `startDate (nullable)`, `totalDays (int)`, `outcome (text nullable)`, `outcomeGood (Boolean nullable)`, `generatedAt`.

- [ ] Repository:

```java
public interface ExperimentRepository extends JpaRepository<ExperimentEntity, UUID> {
    Optional<ExperimentEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
    List<ExperimentEntity> findByCreatedByAndStatusInOrderByGeneratedAtDesc(UUID createdBy, Collection<String> statuses);
    List<ExperimentEntity> findByCreatedByAndStatusOrderByGeneratedAtDesc(UUID createdBy, String status);
    long countByCreatedByAndStatusIn(UUID createdBy, Collection<String> statuses);
}
```

- [ ] Populator (mirror PredictionPopulator; default title/hypothesis, totalDays=7, startDate null, outcome null, outcomeGood null, generatedAt truncated-to-µs; status/metric/direction params). Register in `@Import` + prepend `experiment` to `ResetDatabase` TRUNCATE.
- [ ] `ExperimentPersistenceIT` (3): round-trip a proposed row (startDate null, outcomeGood null); the status CHECK rejects a bad status; `findByCreatedByAndStatusInOrderByGeneratedAtDesc([proposed,active,completed])` excludes a dismissed row + is owner-scoped.
- [ ] RED→GREEN; commit `feat(proactive): experiment table + entity + repo + persistence IT (mezo-h4wp.8)`.

### Task 4: ExperimentProposalGenerator + fake sentinel + config

**Files:** `service/ExperimentProposalGenerator.java`; `FakeCompanionLlm.java` (mirror + sentinel + branch); `ProactiveProperties.java` (`Experiment` record); `application.yml`; `FeaturesConfiguration.java` (`EXPERIMENT_JOB_SWITCH`); test `ExperimentProposalGeneratorIT.java`.

**Produces:** `ExperimentProposalGenerator.propose(UUID userId): List<ExperimentEntity>` (empty when cap met or no confirmed patterns); `EXPERIMENT_MARKER = "N1-KISERLET-FELADAT"`; properties `mezo.proactive.experiment.{propose-cron, outcome-cron, max-open, min-days, max-days}`.

- [ ] `ProactiveProperties`: add `@NotNull @Valid Experiment experiment` +

```java
public record Experiment(
    @NotBlank String proposeCron,
    @NotBlank String outcomeCron,
    @Min(1) @Max(10) int maxOpen,
    @Min(1) @Max(60) int minDays,
    @Min(1) @Max(60) int maxDays
) {}
```

- [ ] `application.yml` under `mezo.proactive:`:

```yaml
    experiment:
      # P2 weekly proposal (Monday, after the prediction batch) + daily outcome evaluation
      propose-cron: "0 45 6 * * MON"
      outcome-cron: "0 20 6 * * *"
      max-open: 3
      min-days: 3
      max-days: 28
```
and under `mezo.techcore.cron:` add `experiment-job:\n        enabled: true`.

- [ ] `FeaturesConfiguration`: `public static final String EXPERIMENT_JOB_SWITCH = "mezo.techcore.cron.experiment-job.enabled";`
- [ ] `FakeCompanionLlm`: `EXPERIMENT_MARKER_MIRROR = "N1-KISERLET-FELADAT"` + `EXPERIMENT_SENTINEL = Pattern.compile("\\[fake-experiment:(\\{.*\\})]", Pattern.DOTALL)` (GREEDY) + branch with default `{"experiments":[{"title":"Fake kísérlet","hypothesis":"FAKE-HIPOTÉZIS","patternIndex":0,"metricKey":"sleep_avg","expectedDirection":"up","totalDays":7}]}`.
- [ ] `ExperimentProposalGenerator` (mirror PredictionGenerator's gather + parse; cap-gated):

```java
@Transactional
public List<ExperimentEntity> propose(UUID userId) {
    int open = (int) experimentRepository.countByCreatedByAndStatusIn(userId,
            List.of(ExperimentEntity.STATUS_PROPOSED, ExperimentEntity.STATUS_ACTIVE));
    int room = properties.experiment().maxOpen() - open;
    if (room <= 0) { return List.of(); }                         // cap met — no-op (§9 decision y)
    Gather gather = gather(userId);
    if (gather == null) { return List.of(); }                    // no confirmed patterns (grounding gate)
    String answer = companionLlm.completeSmart(PROMPT, gather.payload());
    ParsedExperiments parsed = parse(answer);
    if (parsed == null || parsed.experiments() == null) { return List.of(); }
    List<ExperimentEntity> saved = new ArrayList<>();
    for (ParsedExperiment p : parsed.experiments()) {
        if (saved.size() >= room) { break; }
        if (p == null || isBlank(p.title()) || isBlank(p.hypothesis())) { continue; }
        if (!VALID_METRICS.contains(p.metricKey()) || !VALID_DIRECTIONS.contains(p.expectedDirection())) { continue; }
        ExperimentEntity e = new ExperimentEntity();
        e.setCreatedBy(userId);
        e.setTitle(p.title().strip());
        e.setHypothesis(p.hypothesis().strip());
        e.setStatus(ExperimentEntity.STATUS_PROPOSED);
        e.setMetricKey(p.metricKey());
        e.setExpectedDirection(p.expectedDirection());
        e.setTotalDays(clampDays(p.totalDays()));                // [min-days, max-days], default min on null
        e.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        saved.add(experimentRepository.saveAndFlush(e));
    }
    return saved;
}
```
`gather(userId)` = confirmed patterns → null gate; payload = snapshot(today) + facts + numbered pattern candidates + `METRIKA-KATALÓGUS` + `IRÁNYOK` (mirror PredictionGenerator, minus the confidence use). `clampDays(Integer)`: null → minDays; else `Math.max(min, Math.min(max, v))`. `PROMPT` (HU): propose 1-3 N=1 experiments for Daniel from confirmed patterns; each ties to a metricKey + expectedDirection + a totalDays window; strict JSON `{"experiments":[{"title","hypothesis","patternIndex","metricKey","expectedDirection","totalDays"}]}`; no med-dose suggestions; invent-no-numbers. Records `Gather(String payload, List<PatternEntity> candidates)`, `ParsedExperiment(String title, String hypothesis, Integer patternIndex, String metricKey, String expectedDirection, Integer totalDays)`, `ParsedExperiments(List<ParsedExperiment> experiments)`.
- [ ] `ExperimentProposalGeneratorIT` (5, `@Transactional @ActiveProfiles("companion-fake")`): gather composes snapshot+candidates+catalog with a confirmed pattern; gather null with only a proposed pattern; propose persists a scripted proposed row (via `[fake-experiment:{…}]` in a check-in note) with clamped totalDays; propose is a no-op when `max-open` open rows already exist (plant 3 active via populator); unparseable ⇒ empty.
- [ ] RED→GREEN; commit `feat(proactive): ExperimentProposalGenerator (smart tier, cap-gated) + fake sentinel + config (mezo-h4wp.8)`.

### Task 5: ExperimentOutcomeService + outcome IT

**Files:** `service/ExperimentOutcomeService.java`; test `ExperimentOutcomeIT.java`.

**Produces:** `ExperimentOutcomeService.evaluateClosed(UUID userId, LocalDate today): int` — for each `active` experiment whose window closed (`startDate + totalDays <= today`), evaluate via `MetricWindowEvaluator` over `[startDate, startDate+totalDays-1]` vs the `totalDays` before start; set `completed` + `outcome`/`outcomeGood`.

```java
@Transactional
public int evaluateClosed(UUID userId, LocalDate today) {
    List<ExperimentEntity> active = experimentRepository
            .findByCreatedByAndStatusOrderByGeneratedAtDesc(userId, ExperimentEntity.STATUS_ACTIVE);
    int closed = 0;
    for (ExperimentEntity e : active) {
        LocalDate start = e.getStartDate();
        if (start == null) { continue; }
        LocalDate winTo = start.plusDays(e.getTotalDays() - 1);
        if (!today.isAfter(winTo)) { continue; }                 // window not closed yet
        MetricWindowEvaluator.Verdict v = evaluator.evaluate(
                userId, e.getMetricKey(), start, winTo,
                start.minusDays(e.getTotalDays()), start.minusDays(1));
        e.setStatus(ExperimentEntity.STATUS_COMPLETED);
        if (v == null) {
            e.setOutcome("Nem értékelhető — nincs elég adat.");
            e.setOutcomeGood(null);                              // honest inconclusive (§9 decision aa)
        } else {
            boolean good = v.direction().equals(e.getExpectedDirection());
            e.setOutcomeGood(good);
            e.setOutcome((good ? "Beigazolódott · " : "Nem igazolódott · ") + v.actualText());
        }
        experimentRepository.saveAndFlush(e);
        closed++;
    }
    return closed;
}
```

- [ ] `ExperimentOutcomeIT` (4, fixed past dates): an active sleep-up experiment whose window closed + sleep rose → completed, outcomeGood true, outcome contains "Beigazolódott"; wrong direction → completed, outcomeGood false, "Nem igazolódott"; no data → completed, outcomeGood null, "Nem értékelhető"; a still-open window (today ≤ winTo) untouched (stays active).
- [ ] RED→GREEN; commit `feat(proactive): ExperimentOutcomeService — deterministic window-close evaluation (mezo-h4wp.8)`.

### Task 6: Write path — service + controller + mapper + job + API ITs

**Files:** `service/ProactiveExperimentService.java`; `ProactiveController.java` (3 methods); `ProactiveMapper.java` (`toExperimentResponse`); `service/ExperimentJob.java`; `messages.properties` (2 codes); test `ProactiveApiExperimentIT.java`, `ExperimentJobIT.java`, `ExperimentJobSwitchOffIT.java`; `ProactiveApiSwitchOffIT.java` (+2).

**Produces:** `ProactiveExperimentService.getExperiments(userId)` (list proposed+active+completed, lazy-propose when empty), `.propose(userId)`, `.decide(userId, id, request)`; `ExperimentJob.runPropose()`/`runOutcome()`; codes `PROACTIVE_EXPERIMENT_NOT_FOUND`, `PROACTIVE_EXPERIMENT_NOT_PROPOSED`.

- [ ] `messages.properties`: `PROACTIVE_EXPERIMENT_NOT_FOUND=Experiment not found.` + `PROACTIVE_EXPERIMENT_NOT_PROPOSED=The experiment is not awaiting a decision.`
- [ ] Service:

```java
private static final List<String> LIVE_STATUSES = List.of(
        ExperimentEntity.STATUS_PROPOSED, ExperimentEntity.STATUS_ACTIVE, ExperimentEntity.STATUS_COMPLETED);

@Transactional
public List<ExperimentResponse> getExperiments(UUID userId) {
    if (experimentRepository.countByCreatedByAndStatusIn(userId,
            List.of(ExperimentEntity.STATUS_PROPOSED, ExperimentEntity.STATUS_ACTIVE)) == 0) {
        generator.propose(userId);                               // lazy first proposal; empty = honest
    }
    return experimentRepository.findByCreatedByAndStatusInOrderByGeneratedAtDesc(userId, LIVE_STATUSES)
            .stream().map(mapper::toExperimentResponse).toList();
}

@Transactional
public List<ExperimentResponse> propose(UUID userId) {
    return generator.propose(userId).stream().map(mapper::toExperimentResponse).toList();
}

@Transactional
public ExperimentResponse decide(UUID userId, UUID id, ExperimentDecisionRequest request) {
    ExperimentEntity e = experimentRepository.findByIdAndCreatedByAndDeletedFalse(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                    SystemMessage.error("PROACTIVE_EXPERIMENT_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    if (!ExperimentEntity.STATUS_PROPOSED.equals(e.getStatus())) {
        throw new SystemRuntimeErrorException(
                SystemMessage.error("PROACTIVE_EXPERIMENT_NOT_PROPOSED").build(), HttpStatus.CONFLICT);
    }
    switch (request.getDecision()) {
        case "accept" -> { e.setStatus(ExperimentEntity.STATUS_ACTIVE); e.setStartDate(LocalDate.now()); }
        case "dismiss" -> e.setStatus(ExperimentEntity.STATUS_DISMISSED);
        default -> throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "decision").build());
    }
    return mapper.toExperimentResponse(experimentRepository.saveAndFlush(e));
}
```

- [ ] Mapper: `ExperimentResponse toExperimentResponse(ExperimentEntity entity);` (direct field map; `Boolean`→wire boolean, `LocalDate`→date, reuse the Instant→OffsetDateTime default).
- [ ] Controller: inject `ProactiveExperimentService`; `getExperiments()`/`proposeExperiments()`/`decideExperiment(UUID id, ExperimentDecisionRequest request)` delegating with `currentUserId.get()`.
- [ ] `ExperimentJob` (mirror PredictionJob two-cron): `runPropose` (`${mezo.proactive.experiment.propose-cron}`) loops users → `generator.propose`; `runOutcome` (`${…outcome-cron}`) loops users → `outcomeService.evaluateClosed`; three-switch `EXPERIMENT_JOB_SWITCH`.
- [ ] `ProactiveApiExperimentIT extends ApiIntegrationTest` (`@ActiveProfiles("companion-fake")`, mirror `CompanionPatternApiIT` + `ProactiveApiIT` prediction cases):
  - list returns `[]` when no confirmed patterns (lazy-propose honest-fails); 401 without token.
  - with a confirmed pattern (PatternPopulator confirmed + a `[fake-experiment:{…}]` check-in note is NOT needed — the fake default proposes a valid row): GET lazily proposes → 1 proposed row.
  - `POST /experiment/{id}/decision {accept}` → 200, status active, startDate today; a second decide on the now-active row → **409**; `{dismiss}` on a fresh proposed row → 200 dismissed, and it disappears from the next GET list.
  - decide on a random UUID → 404; `{decision:"nope"}` → 400 (contract pattern).
  - `POST /experiment/propose` → 200 array (proposes when under cap).
- [ ] `ExperimentJobIT` (2): propose run creates a proposed row for a confirmed-pattern user; outcome run completes a due active experiment (plant an active row via populator with startDate in the past + weight logs). `ExperimentJobSwitchOffIT` (1): third switch off ⇒ no bean.
- [ ] `ProactiveApiSwitchOffIT` (+2): `GET /experiment` and `POST /experiment/{uuid}/decision` both 404 when proactive off.
- [ ] Full backend gate `./mvnw clean test`; commit `feat(proactive): experiment write path — list/propose/decide + ExperimentJob (mezo-h4wp.8)`.

### Task 7: FE data layer — type + api + hooks + MSW + tests

**Files:** `src/data/types.ts` (Experiment); `src/data/insights/experimentsApi.ts` + `experimentsHooks.ts`; `data/hooks.ts` barrel; `test/msw/handlers.ts` (GET `[]` + POST handlers); test `experimentsHooks.test.tsx`.

- [ ] `types.ts` — extend honestly, keep the mock seed compiling:

```ts
export type ExperimentStatus = 'proposed' | 'active' | 'completed' | 'dismissed'
export interface Experiment {
  id: string
  title: string
  status: ExperimentStatus
  day: number
  total: number
  hypothesis: string
  outcome?: string
  outcomeGood?: boolean
}
```

- [ ] `experimentsApi.ts`: `ExperimentWire = paths['/api/proactive/experiment']['get']['responses']['200']['content']['application/json'][number]`; `toExperiment(wire)` computes `day` client-side (`proposed` → 0; else `min(daysSince(startDate)+1, totalDays)` clamped ≥0, `completed` → totalDays), `total = totalDays`, `outcomeGood = wire.outcomeGood ?? undefined`; `list()`, `decide(id, decision: 'accept'|'dismiss')` (POST, `satisfies ExperimentDecisionRequest`), `propose()` (POST → list). Reuse a `daysBetween` helper or inline with `Math.round`.
- [ ] `experimentsHooks.ts` — `useExperiments(): { experiments, mode }` (mirror `usePredictions`: mock seed / real list, `[]` on error) + `useExperimentActions()` (mirror `usePatternActions`: `useMutation` calling `experimentsApi.decide`/`.propose` in live, cache-local in mock, `invalidateQueries(['experiments'])` onSuccess). Expose `decide(id, decision)`, `propose()`, `pending`.
- [ ] Barrel: `export { useExperiments, useExperimentActions } from '@/data/insights/experimentsHooks'`. MSW: default `http.get(.../experiment → HttpResponse.json([]))` + `http.post(.../experiment/:id/decision …)` echoing the decided status + `http.post(.../experiment/propose → [])`.
- [ ] `experimentsHooks.test.tsx` (3+): maps a wire row (computes day, status proposed→day 0); `[]` on the default; mock returns the seed without fetching; the actions hook posts a decision and invalidates (assert the fetch/spy or a refetch).
- [ ] RED→GREEN; commit `feat(fe): useExperiments + useExperimentActions dual-mode hooks (mezo-h4wp.8)`.

### Task 8: FE surface — ExperimentsPage un-ghost

**Files:** `ExperimentsPage.tsx` (real dual-mode + accept/dismiss + propose button); `tabs.ts` (`PHASE3_TAB_IDS = new Set([])`); `ExperimentsPage.test.tsx`; `InsightsSubNav.test.tsx` + `insights.nav.test.tsx`.

- [ ] `ExperimentsPage.tsx`: `const { experiments, mode } = useExperiments(); const { decide, propose, pending } = useExperimentActions()`. Drop the `PhaseTeaserCard` ghost. Empty list ⇒ honest null-state *"Az első N=1 kísérletet a megerősített mintákból javasolja Mezo."*. Each card: status chip (`proposed` → „◇ Javaslat"; `active` → „◐ Aktív"; `completed`+good → „✓ Megerősítve"; completed+!good → „◯ Nem igazolódott"; completed+null → „◌ Nem értékelhető"), `day/total nap` (hidden for proposed), title, hypothesis, progress bar (`active`/`completed` only), outcome line. **Proposed rows** render an **Elfogadom / Elvetem** button pair calling `decide(e.id, 'accept'|'dismiss')` (disabled while `pending`). The footer **„+ Új kísérlet javasol Mezo"** button calls `propose()` in live mode (disabled while pending); mock keeps it inert. Keep byte-parity for mock (the seed has no proposed rows, so no accept/dismiss buttons appear in mock — matches the current demo).
- [ ] `tabs.ts`: `PHASE3_TAB_IDS = new Set([])` + comment "Predictions un-ghosted at P1; Experiments at P2 — nothing hidden now."
- [ ] `ExperimentsPage.test.tsx`: mock describe (seed active+completed cards, the inert propose button); real describe — MSW list with a proposed row → renders „◇ Javaslat" + Elfogadom/Elvetem, clicking Elfogadom posts accept (assert via a `server.use` POST spy or a re-GET returning active); real default `[]` → the honest null-state, no `hamarosan`.
- [ ] Nav tests: `InsightsSubNav.test.tsx` real describe — add `'Experiments'` to the visible loop, DELETE the hidden assertion (rename: "shows all seven tabs — nothing hidden"). `insights.nav.test.tsx` — append an Experiments hop (click → `heading 'Experiments'` → the honest null-state text).
- [ ] Full FE gate (`pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`); commit `feat(fe): ExperimentsPage un-ghosts — real N=1 experiments + L2 accept/dismiss + propose (mezo-h4wp.8)`.

### Task 9: Docs + gates + merge + close

- [ ] `docs/features/proactive.md` — §1 (P2 block + status rows), §2 (Live since P2), §3 (list/decide/propose/outcome flows + switch-gating list = 6 jobs), §4 (table + entity + 3 endpoints + config + the `MetricWindowEvaluator` note), §5 (5.1 pattern read + biometrics/train reads via evaluator + 5.9 Experiments FE), §6 (curl), §7 (extend: nothing left in P; the shared evaluator recipe), §8 (test additions), §9 (decisions x/y/z/aa/bb + gotcha (a) SIX markers + the MetricWindowEvaluator DRY note), §10 (key files). `docs/features/insights.md` — Experiments un-ghost (§1/§2/§2.7/§3/§8/§9/§10; `PHASE3_TAB_IDS` now empty; `useInsights` has no live consumers left). `docs/features/companion.md` — the `[fake-experiment:{…}]` sentinel line. `docs/milestones/roadmap.md` — P2 milestone row + **the Proactive epic is COMPLETE** (Phase-4 line: all 8 slices shipped). Roadmap plan §P2 → ✅ shipped-as-built block + "epic complete" note.
- [ ] `node scripts/lint-docs.mjs` → PASS (bump collateral `_platform-*`/`me` dates with real cross-refs as in P1); both full gates once more if code changed.
- [ ] Commit docs; merge per house flow (`git checkout main && git pull --rebase && git merge --no-ff feat/proactive-p2 -m "Merge feat/proactive-p2 — N=1 experiments (mezo-h4wp.8)"`; delete branch; `bd close mezo-h4wp.8` + notes; **consider closing the epic `mezo-h4wp`** if all children done; `bd dolt push && git push`).

## Self-review notes

- Spec §5.2 coverage: experiment domain ✓, smart-tier proposal from patterns ✓, L2 accept POST decision ✓, day counter (FE-derived) + metric tracking (shared evaluator) ✓, outcome eval deterministic + prose ✓, un-ghost ✓, propose trigger = button + cron ✓.
- DRY: `MetricWindowEvaluator` shared by P1 validation + P2 outcome (Task 2 refactor, P1 ITs guard it).
- Deviations documented: `outcome_good` nullable (honest inconclusive), dismissed excluded from the list read, propose cap on open count.
- Verify-at-execution: exact PatternDecisionRequest generated-DTO getter (`getDecision()`), the `ExperimentDecisionRequest` generated builder method name in ITs (`.decision("accept")`), FE `paths[...]` POST typing after regen.
