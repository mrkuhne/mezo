# Proactive P1 — Predictions + Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Insights Predictions tab stops being fiction — a `prediction` table + weekly smart-tier generation grounded in CONFIRMED patterns + a deterministic validation job closing expired windows + `GET /api/proactive/prediction` + a real dual-mode PredictionsPage (un-ghost, „tanulom" on null confidence, honest accuracy header).

**Architecture:** A fifth proactive surface. The generator is the **memoir structured smart-tier idiom**: pure-code gather (V0.3 snapshot for next-week context + facts + **numbered CONFIRMED-pattern candidates** + the fixed metric catalog) → ONE `completeSmart` call → strict-JSON `{predictions:[{title, basis, patternIndex, metricKey, expectedDirection}]}` → defensive parse → **code-set validity windows** (`[weekStart, weekStart+6]`), **pattern-copied confidence** (never model-invented; null ⇒ „tanulom"), catalog/enum-validated rows, capped at `max-per-week`. `PredictionJob` = the H1 two-methods-one-switch idiom: weekly generation (Mon 06:30) + daily deterministic validation (06:15). The read is a **list** (200 + `[]` is the honest empty state — no 404; single-resource precedents don't apply).

**Tech Stack:** Spring Boot 4 / Java 21 / Liquibase / MapStruct / React 19 / TanStack Query / Vitest+MSW.

**Driving bd:** `mezo-h4wp.7` · Roadmap §P1 · Design spec §5 (P1) + §3 (`prediction` row) + §6 (no fabricated confidence).

## Global Constraints

- Dual-switch `@ConditionalOnProperty` on every bean; the job adds `PREDICTION_JOB_SWITCH` (`mezo.techcore.cron.prediction-job.enabled`) — ONE switch for both scheduled methods (the H1 precedent).
- Contract-first; no hand-written boundary DTOs; marker literal-mirror rule.
- **No fabricated numbers:** `confidence` is COPIED from the grounding pattern's `confidence` column (null for statistical rows ⇒ FE renders „tanulom"); validity windows and `actual` text are code-set; the model only SELECTS (pattern by index, metric from the catalog, direction from the enum).
- Smart tier: `completeSmart` (weekly narrative — the tier policy).
- Backend gate `./mvnw clean test`; FE gate `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`; docs + `node scripts/lint-docs.mjs` before close.

## In-slice decisions (resolved now, documented in proactive.md §9 at close)

- **(t) Metric-key catalog v1 — 3 deterministic keys**, each evaluated as *window avg/count vs the preceding 7 days*: `weight_trend` (avg `weight_log.weightKg`, epsilon config `weight-epsilon-kg` 0.1), `sleep_avg` (avg `sleep_log.durationH`, epsilon config `sleep-epsilon-h` 0.25), `training_volume` (count of done gym instances via `findDoneInstanceDates`; sport excluded v1). Direction = `up`/`down`/`stable` by epsilon-banded delta.
- **(u) Window-close semantics:** every prediction's window is code-set to its generation week `[weekStart, weekStart+6]`; the daily validation run evaluates `pending` rows with `valid_to < today`; **no data in either compare window ⇒ stays `pending`** (skipped, honest) — no L2/soft judging in v1 (the catalog is cut so everything is deterministic).
- **(v) Grounding & gate:** the emptiness gate is **zero CONFIRMED patterns** (the spec's "grounded in CONFIRMED patterns"); candidates are confirmed-only; a prediction whose `patternIndex` is invalid/missing keeps `confidence = null` („tanulom") rather than being dropped; invalid `metricKey`/`expectedDirection` DROPS the row (unvalidatable = fiction).
- **(w) List semantics:** `GET /api/proactive/prediction` returns ALL live rows (single user, ~3/week) ordered `valid_from desc, generated_at desc`; lazy-generates the CURRENT week when it has no rows (the weekly-suggestion idiom); `200 []` = honest empty (no 404). The FE derives the accuracy header from closed rows only (absent when none closed).
- **Marker:** `PREDICTION_MARKER = "HETI-PREDIKCIO-FELADAT"` (prefix-collision-safe vs `HETI-TERVJAVASLAT`/`HETI-MEMOIR-FELADAT` — full-marker `startsWith` dispatch); sentinel `[fake-prediction:{…}]` rides a **check-in note** (the gather HAS a snapshot).

---

### Task 1: Contract — prediction endpoint

**Files:** Modify `api/feature/proactive/proactive.yml`; regenerate.

**Produces:** `GET /api/proactive/prediction` → `PredictionResponse[]` (200 · 401); backend `ProactiveApi.getPredictions()`; FE `paths['/api/proactive/prediction']`.

- [ ] Add the path (after `/api/proactive/heartbeat`):

```yaml
  /api/proactive/prediction:
    get:
      tags: [Proactive]
      operationId: getPredictions
      summary: Pattern-grounded weekly predictions with validation state (P1)
      description: >-
        All live predictions, newest window first. Lazily generates the CURRENT week's batch when
        that week has no rows yet (needs CONFIRMED patterns — the grounding gate). An empty array
        is the honest empty state (never fabricated forecasts).
      responses:
        '200':
          description: All live predictions (possibly empty)
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/PredictionResponse'
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
```

- [ ] Add the schema (after `HeartbeatNoteResponse`):

```yaml
    PredictionResponse:
      type: object
      required: [id, title, basis, metricKey, expectedDirection, validFrom, validTo, status, generatedAt]
      properties:
        id: { type: string, format: uuid }
        title:
          type: string
          description: The forecast statement (HU prose, model-written)
        basis:
          type: string
          description: Why — grounded in the selected pattern + context (model-written prose)
        confidence:
          type: number
          format: double
          nullable: true
          description: COPIED from the grounding pattern's stats; null = the FE renders „tanulom" (never model-invented)
        metricKey:
          type: string
          description: weight_trend | sleep_avg | training_volume (the deterministic v1 catalog)
        expectedDirection:
          type: string
          description: up | down | stable (model-SELECTED from the enum)
        validFrom: { type: string, format: date }
        validTo: { type: string, format: date }
        status:
          type: string
          description: pending | validated | missed
        actual:
          type: string
          nullable: true
          description: Code-formatted outcome text once the validation job closed the window
        generatedAt: { type: string, format: date-time }
```

- [ ] `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`
- [ ] Commit: `feat(api): proactive prediction contract — GET /api/proactive/prediction (mezo-h4wp.7)`

### Task 2: Table + entity + repository (+ populator, ResetDatabase, persistence IT)

**Files:**
- Create `backend/src/main/resources/db/changelog/1.0.0/script/202607071900_mezo-h4wp.7_create_prediction.sql` + register in `1.0.0_master.yml`
- Create `entity/PredictionEntity.java`, `repository/PredictionRepository.java`
- Create `support/populator/PredictionPopulator.java`; add to `AbstractIntegrationTest` `@Import` + `ResetDatabase` TRUNCATE (prepend `prediction`)
- Test `PredictionPersistenceIT.java`

**Produces:** `PredictionEntity{UUID id, LocalDate weekStart, String title, String basis, BigDecimal confidence?, String metricKey, String expectedDirection, LocalDate validFrom, LocalDate validTo, String status, String actual?, Instant generatedAt}` with constants `STATUS_PENDING/VALIDATED/MISSED`, `DIRECTION_UP/DOWN/STABLE`, `METRIC_WEIGHT_TREND/SLEEP_AVG/TRAINING_VOLUME`; `PredictionRepository.existsByCreatedByAndWeekStart(UUID, LocalDate)` + `findByCreatedByOrderByValidFromDescGeneratedAtDesc(UUID)` + `findByCreatedByAndStatusAndValidToBefore(UUID, String, LocalDate)`; `PredictionPopulator.prediction(UUID createdBy, LocalDate weekStart, String metricKey, String expectedDirection, String status)`.

- [ ] Migration:

```sql
-- Proactive P1 (bd mezo-h4wp.7, roadmap §P1): pattern-grounded weekly predictions + validation.
-- week_start = the generation week (ISO Monday) — idempotence probe, NOT unique (n rows/week).
-- confidence is COPIED from the grounding pattern (null = "tanulom"); windows are code-set;
-- the daily validation job flips pending -> validated|missed deterministically.

create table prediction (
    id                 uuid          not null default gen_random_uuid(),
    created_by         uuid          not null,
    is_deleted         boolean       not null default false,
    created_at         timestamptz   not null default now(),
    week_start         date          not null,
    title              varchar(200)  not null,
    basis              text          not null,
    confidence         numeric(4,3),
    metric_key         varchar(40)   not null,
    expected_direction varchar(8)    not null,
    valid_from         date          not null,
    valid_to           date          not null,
    status             varchar(10)   not null default 'pending',
    actual             text,
    generated_at       timestamptz   not null,
    constraint pk_prediction_id primary key (id),
    constraint fk_prediction_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_prediction_expected_direction check (expected_direction in ('up', 'down', 'stable')),
    constraint ck_prediction_status check (status in ('pending', 'validated', 'missed'))
);

create index idx_prediction_created_by_week_start on prediction (created_by, week_start) where is_deleted = false;
```

- [ ] Entity (OwnedEntity, `@SQLDelete`/`@SQLRestriction`, the H1 flat shape + `BigDecimal confidence` `@Column(precision = 4, scale = 3)`).
- [ ] Repository + populator (populator defaults: title `"Teszt predikció"`, basis `"Teszt alap."`, confidence null, window = weekStart..+6, generatedAt truncated-to-µs; status param).
- [ ] `PredictionPersistenceIT` (3): round-trip incl. null confidence; the status CHECK rejects a bad status (`DataIntegrityViolationException` via populator with `"bogus"`); owner-scoped ordered finder returns own rows newest-window-first.
- [ ] Run RED→GREEN; commit `feat(proactive): prediction table + entity + repo + persistence IT (mezo-h4wp.7)`.

### Task 3: PredictionGenerator + fake sentinel + generator IT

**Files:** Create `service/PredictionGenerator.java`; modify `FakeCompanionLlm.java`; add `ProactiveProperties.Prediction` + `application.yml` block (needed by the generator's cap); test `PredictionGeneratorIT.java`.

**Consumes:** `ContextSnapshotAssembler.render`, `KnowledgeFactService.renderPromptBlock`, `PatternRepository.findByCreatedByAndStatusAndDeletedFalseOrderByLastDetectedAtDesc(userId, "confirmed")`, `CompanionLlm.completeSmart`, Jackson `ObjectMapper` (the MemoirGenerator parse idiom).

**Produces:** `PredictionGenerator.generate(UUID userId, LocalDate weekStart): List<PredictionEntity>` (empty list = honest absence; NEVER null), `gather(UUID, LocalDate): PredictionGather(String payload, List<PatternEntity> candidates)`, `PREDICTION_MARKER`; properties `mezo.proactive.prediction.{cron: "0 30 6 * * MON", validation-cron: "0 15 6 * * *", max-per-week: 3, weight-epsilon-kg: 0.1, sleep-epsilon-h: 0.25}`.

- [ ] `ProactiveProperties`: add `@NotNull @Valid Prediction prediction` +

```java
/** P1 weekly prediction generation + daily deterministic validation. */
public record Prediction(
    @NotBlank String cron,
    @NotBlank String validationCron,
    @Min(1) @Max(10) int maxPerWeek,
    @NotNull @DecimalMin("0.0") BigDecimal weightEpsilonKg,
    @NotNull @DecimalMin("0.0") BigDecimal sleepEpsilonH
) {}
```

- [ ] `application.yml` under `mezo.proactive:`:

```yaml
    prediction:
      # P1 Monday-morning generation (after the weekly suggestion) + daily window-close validation
      cron: "0 30 6 * * MON"
      validation-cron: "0 15 6 * * *"
      max-per-week: 3
      # epsilon bands for the deterministic direction verdicts (stable inside ±epsilon)
      weight-epsilon-kg: 0.1
      sleep-epsilon-h: 0.25
```

- [ ] `FakeCompanionLlm`: `PREDICTION_MARKER_MIRROR = "HETI-PREDIKCIO-FELADAT"` + `PREDICTION_SENTINEL = Pattern.compile("\\[fake-prediction:(\\{.*?\\})]", Pattern.DOTALL)` + dispatch branch with default `{"predictions":[{"title":"Fake predikció","basis":"FAKE-ALAP","patternIndex":0,"metricKey":"weight_trend","expectedDirection":"down"}]}`.
- [ ] `PredictionGenerator` — the full flow:

```java
@Transactional
public List<PredictionEntity> generate(UUID userId, LocalDate weekStart) {
    if (predictionRepository.existsByCreatedByAndWeekStart(userId, weekStart)) { return List.of(); }  // idempotent, no LLM
    PredictionGather gather = gather(userId, weekStart);
    if (gather == null) { return List.of(); }                          // no confirmed patterns — the grounding gate
    String answer = companionLlm.completeSmart(PROMPT, gather.payload());
    ParsedPredictions parsed = parse(answer);                          // first-{ to last-} + ObjectMapper (memoir idiom)
    if (parsed == null || parsed.predictions() == null) { return List.of(); }
    List<PredictionEntity> saved = new ArrayList<>();
    for (ParsedPrediction p : parsed.predictions()) {
        if (saved.size() >= properties.prediction().maxPerWeek()) { break; }
        if (p == null || isBlank(p.title()) || isBlank(p.basis())) { continue; }
        if (!VALID_METRICS.contains(p.metricKey()) || !VALID_DIRECTIONS.contains(p.expectedDirection())) { continue; }  // unvalidatable = dropped (§9 decision v)
        PredictionEntity e = new PredictionEntity();
        e.setCreatedBy(userId); e.setWeekStart(weekStart);
        e.setTitle(p.title().strip()); e.setBasis(p.basis().strip());
        e.setConfidence(resolveConfidence(p.patternIndex(), gather.candidates()));  // COPIED or null — never invented
        e.setMetricKey(p.metricKey()); e.setExpectedDirection(p.expectedDirection());
        e.setValidFrom(weekStart); e.setValidTo(weekStart.plusDays(6));             // code-set window (§9 decision u)
        e.setStatus(PredictionEntity.STATUS_PENDING);
        e.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        saved.add(predictionRepository.saveAndFlush(e));
    }
    return saved;
}
```

`gather`: confirmed patterns → null gate when empty; payload = snapshot(today) + facts + `"MINTA-JELÖLTEK (a patternIndex ezekre mutat):"` numbered list `i: title (r=…, n=…, konfidencia=…)` + `"METRIKA-KATALÓGUS: weight_trend | sleep_avg | training_volume"` + `"IRÁNYOK: up | down | stable"`. `resolveConfidence`: bounds-checked index → `candidates.get(i).getConfidence()` (may be null); invalid index → null. PROMPT (HU): weekly forecasts for the STARTING week from patterns+context only; select pattern/metric/direction from the offered lists; 1-3 predictions; invent-no-numbers; no med-dose suggestions; strict JSON `{"predictions":[{"title","basis","patternIndex","metricKey","expectedDirection"}]}`.

- [ ] `PredictionGeneratorIT` (6, `@Transactional @ActiveProfiles("companion-fake")`): gather composes snapshot + numbered candidates + catalog when a confirmed pattern exists; gather null without confirmed patterns (a `proposed` pattern does NOT count); generate persists the scripted rows with code-set windows + pattern-copied (null for statistical) confidence via `[fake-prediction:{…}]` in a check-in note; drops rows with invalid metricKey; idempotent (second call returns empty, count unchanged); unusable JSON ⇒ empty list, no rows. Pattern rows via `PatternPopulator.statistical(user, pairKey, "confirmed")`.
- [ ] RED→GREEN; commit `feat(proactive): PredictionGenerator (smart tier, pattern-grounded, code-set windows) + fake sentinel (mezo-h4wp.7)`.

### Task 4: PredictionValidationService + PredictionJob + ITs

**Files:** Create `service/PredictionValidationService.java`, `service/PredictionJob.java`; add `HEARTBEAT`-style `PREDICTION_JOB_SWITCH` to `FeaturesConfiguration` + `application.yml` `techcore.cron.prediction-job.enabled: true`; add `WeightLogRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(UUID, LocalDate)` (mirror the sleep finder); tests `PredictionValidationIT.java`, `PredictionJobIT.java`, `PredictionJobSwitchOffIT.java`.

**Produces:** `PredictionValidationService.validateClosedWindows(UUID userId, LocalDate today): int` (pure deterministic, LLM-free); `PredictionJob.runWeekly()` (`${mezo.proactive.prediction.cron}`) + `runValidation()` (`${mezo.proactive.prediction.validation-cron}`), both per-user isolated under ONE third switch.

- [ ] Validation core:

```java
public int validateClosedWindows(UUID userId, LocalDate today) {
    List<PredictionEntity> due = predictionRepository
            .findByCreatedByAndStatusAndValidToBefore(userId, PredictionEntity.STATUS_PENDING, today);
    int closed = 0;
    for (PredictionEntity p : due) {
        Verdict v = evaluate(userId, p);        // metric switch; null = no data in a window -> stays pending (§9 decision u)
        if (v == null) { continue; }
        p.setStatus(v.direction().equals(p.getExpectedDirection())
                ? PredictionEntity.STATUS_VALIDATED : PredictionEntity.STATUS_MISSED);
        p.setActual(v.actualText());            // code-formatted HU, e.g. "átlag 78.2 kg vs 78.6 kg (-0.4)"
        predictionRepository.saveAndFlush(p);
        closed++;
    }
    return closed;
}
```

`evaluate`: window = `[validFrom, validTo]`, baseline = the preceding 7 days `[validFrom-7, validFrom)`; per metric: `weight_trend` avg `weightKg` (fetch `dateGreaterThanEqual(validFrom-7)`, split in Java — the house ≥-then-filter idiom), `sleep_avg` avg `durationH`, `training_volume` `findDoneInstanceDates(user, from, to).size()` per window. Either side empty (count metrics: both zero) ⇒ null. Direction by epsilon band (`weightEpsilonKg`/`sleepEpsilonH`; volume epsilon = 0, integer compare). `actualText` per metric in HU with both values + delta.

- [ ] `PredictionJob` — the H1 shape: `runWeekly()` generates `previousOrSame(MONDAY)` for all users; `runValidation()` calls `validateClosedWindows(user, LocalDate.now())` for all users; both try/catch per user, count-log.
- [ ] `PredictionValidationIT` (4, fixed past week `2026-06-22`): weight-down prediction validates when the window avg dropped >epsilon (plant weight logs both sides via `WeightLogPopulator`); flips to missed on the wrong direction; stays pending with no window data; a still-open window (validTo ≥ today) is untouched.
- [ ] `PredictionJobIT` (2): weekly run generates for a user with a confirmed pattern; validation run closes a due prediction. `PredictionJobSwitchOffIT` (1): third switch off ⇒ no bean.
- [ ] RED→GREEN; commit `feat(proactive): prediction validation service + weekly/daily PredictionJob (mezo-h4wp.7)`.

### Task 5: Read path — service + controller + mapper + API IT

**Files:** Create `service/ProactivePredictionService.java`; modify `ProactiveController` (+`getPredictions()`), `ProactiveMapper` (+`toPredictionResponse` — direct field map, `BigDecimal→Double` default method), `ProactiveApiIT` (+2), `ProactiveApiSwitchOffIT` (+1).

- [ ] Service:

```java
@Transactional
public List<PredictionResponse> getPredictions(UUID userId) {
    LocalDate weekStart = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    if (!predictionRepository.existsByCreatedByAndWeekStart(userId, weekStart)) {
        generator.generate(userId, weekStart);          // lazy current-week batch (the weekly idiom); empty = honest
    }
    return predictionRepository.findByCreatedByOrderByValidFromDescGeneratedAtDesc(userId)
            .stream().map(mapper::toPredictionResponse).toList();
}
```

- [ ] Mapper: `PredictionResponse toPredictionResponse(PredictionEntity entity);` + `default Double map(BigDecimal v) { return v == null ? null : v.doubleValue(); }`.
- [ ] `ProactiveApiIT` +2: list returns the populated rows newest-window-first (plant 2 via populator, different week_starts, current week included so no lazy attempt); empty array when no rows and no confirmed patterns (lazy attempt honest-fails). `ProactiveApiSwitchOffIT` +1: prediction 404 when off. 401 covered by the endpoint being under the same auth (add one 401 line like heartbeat).
- [ ] Full backend gate `./mvnw clean test`; commit `feat(proactive): prediction read path — lazy weekly batch + list GET (mezo-h4wp.7)`.

### Task 6: FE data layer — type update + api + hook + MSW + tests

**Files:** Modify `src/data/types.ts` (Prediction); create `src/data/insights/predictionsApi.ts` + `predictionsHooks.ts`; barrel line in `data/hooks.ts`; MSW default (`200 []`); test `predictionsHooks.test.tsx`.

- [ ] `types.ts` — extend honestly, keep the mock seed compiling:

```ts
export type PredictionStatus = 'pending' | 'validated' | 'missed'
export interface Prediction {
  id: string
  title: string
  /** null = the engine is still learning („tanulom") — never a fabricated number. */
  confidence: number | null
  status: PredictionStatus
  date: string
  basis?: string
  actual?: string
}
```

- [ ] `predictionsApi.ts`: `PredictionWire = paths['/api/proactive/prediction']['get']['responses']['200']['content']['application/json'][number]`; `toPrediction(wire)` maps `confidence ?? null`, `date` = a HU window label derived from `validFrom`/`validTo` (`formatShortRange` local helper via `Intl.DateTimeFormat('hu-HU', {month:'short', day:'numeric'})` → `júl. 7. – júl. 13.`); `predictionsApi.list()`.
- [ ] `predictionsHooks.ts` — the memoir view-object idiom:

```ts
export interface PredictionsView { predictions: Prediction[]; mode: 'mock' | 'live' }
export function usePredictions(): PredictionsView
```

mock: seed + `mode:'mock'` synchronously (no fetch, `initialData`); real: `['predictions']` query → list, error/loading → `[]`, `mode:'live'`, `retry:false`.
- [ ] Barrel: `export { usePredictions } from '@/data/insights/predictionsHooks'`. MSW default: `http.get(…/api/proactive/prediction, () => HttpResponse.json([]))` (list endpoint — the honest default is an empty array, NOT 404).
- [ ] `predictionsHooks.test.tsx` (3): maps a wire row (confidence null preserved, window label derived); `[]` on the default; mock returns the seed without fetching.
- [ ] RED→GREEN; commit `feat(fe): usePredictions dual-mode hook (mezo-h4wp.7)`.

### Task 7: FE surface — PredictionsPage un-ghost

**Files:** Modify `src/features/insights/pages/tabs.ts` (drop `'predictions'` from `PHASE3_TAB_IDS`), `PredictionsPage.tsx` (real dual-mode), `PredictionsPage.test.tsx` (real-mode rewrite), `InsightsSubNav.test.tsx` + `insights.nav.test.tsx` (Predictions visible in real mode).

- [ ] `PredictionsPage.tsx`: `const { predictions, mode } = usePredictions()`; **drop the `PhaseTeaserCard` ghost**; header right side: mock keeps the Phase-1 literal `2 validated · 60-day acc 68%` (byte-parity); live derives from closed rows — `closed = validated+missed`, shown only when `closed > 0` as `` `${validated} validated · acc ${Math.round(validated / closed * 100)}%` ``; empty live list ⇒ honest null-state card *"Az első predikciók a megerősített mintákból készülnek — a minta-motor még tanul."*; confidence bar+% renders only when `p.confidence != null`, else a `label-mono` **„tanulom"**; keep the existing card markup otherwise (status chip gains the `missed` case: `✗ Missed`, no `brand` class).
- [ ] Tests: `PredictionsPage.test.tsx` — mock byte-parity (seed cards + hardcoded header); real + MSW rows (renders title, „tanulom" on null confidence, derived header, no `hamarosan`); real + default `[]` (null-state text). Nav tests: move `Predictions` to the visible list (only `Experiments` stays hidden); add the Predictions navigation hop in `insights.nav.test.tsx` (the Memoir precedent).
- [ ] Full FE gate (build + both modes); commit `feat(fe): PredictionsPage un-ghosts — real predictions, honest accuracy header (mezo-h4wp.7)`.

### Task 8: Docs + gates + merge + close

- [ ] `docs/features/proactive.md` — §1 (P1 block + status rows), §2 (Live since P1), §3 (read/job/generator/validation flows + switch-gating list), §4 (table + entity + endpoint row + config), §5 (5.1 pattern read note + 5.8 Insights Predictions FE), §6 (curl), §7 (extend — P2 recipe), §8 (test additions), §9 (decisions t/u/v/w + gotcha (a) FIVE markers), §10 (key files). `docs/features/insights.md` — Predictions tab un-ghost (§2 + tabs + key files + `updated`). `docs/milestones/roadmap.md` — P1 milestone row + Phase-4 line. Roadmap plan §P1 → ✅ shipped-as-built block.
- [ ] `node scripts/lint-docs.mjs` → PASS; both full gates once more if anything changed since.
- [ ] Commit docs; merge per house flow (`git checkout main && git pull --rebase && git merge --no-ff feat/proactive-p1 -m "Merge feat/proactive-p1 — predictions + validation (mezo-h4wp.7)"`; delete branch; `bd close mezo-h4wp.7` + notes; `bd dolt push && git push`).

## Self-review notes

- Spec coverage: table fields ✓ (spec §3 row + week_start for idempotence + expected_direction for deterministic close), weekly smart generation grounded in CONFIRMED patterns ✓, validation window+metric ✓, deterministic close ✓ (§u), null-confidence „tanulom" ✓, honest accuracy header ✓, un-ghost ✓.
- Deviation from the spec table: added `week_start` + `expected_direction` columns (idempotence + machine-checkable claim — without a direction the "deterministic where possible" evaluation has nothing to judge); documented in §9 decision u.
- Verify-at-execution points: `PatternPopulator.statistical(user, pairKey, status)` exact behavior (confidence null on statistical ✓ desired), `WeightLogPopulator` signature, `Intl` HU short-month output in tests (assert with a regex, not an exact literal).
