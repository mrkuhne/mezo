# Companion-feed Implementation Plan (mezo-gst9)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single dawn briefing + separate heartbeat notes with an event-driven, 5-kind companion-message feed (morning / sleep / weight / midday / evening) on one `companion_message` table and one `GET /api/proactive/feed` endpoint, and unify the kcal target source on the goal engine.

**Architecture:** New `companion_message` table + `CompanionMessageGenerator` (per-kind prompts, the existing gather→ONE-LLM-call→strict-parse idiom). Cron kinds (morning/midday/evening) run from one `CompanionMessageJob`; event kinds (sleep/weight) generate from `@TransactionalEventListener(AFTER_COMMIT) @Async` listeners on the sleep/weight write paths. Push rides the EXISTING per-minute N2 dispatch spine — `AnchorResolver` gets ported/new cases reading `companion_message`. FE: the existing MezoChip message thread (`buildMezoMessages`) switches from two hooks to one `useCompanionFeed()`. Old briefing/heartbeat spine (tables, services, endpoints, hooks) is removed at the end, no data migration.

**Tech Stack:** Spring Boot 4 / Java 21 / Maven, PostgreSQL + Liquibase, MapStruct, OpenAPI contract-first (`api/`), React 19 + TanStack Query + Vitest/MSW.

**Design of record:** `docs/superpowers/specs/2026-08-15-companion-feed-design.md`

## Global Constraints

- Read `docs/references/` FIRST for anything you touch: `spring_patterns.md`, `error_handling.md`, `liquibase_conventions.md`, `testing_standards.md`, `integration_test_framework.md`, `configuration_conventions.md`, `api_contract_conventions.md`, `frontend_conventions.md`.
- Contract-first: edit `api/feature/proactive/proactive.yml` BEFORE backend/frontend code; merge with `cd api/generate && npm run generate:api`; FE types with `cd frontend && pnpm generate:api`; backend Java types regenerate in `./mvnw generate-sources` (any `./mvnw clean test` run does this).
- Backend base package `io.mrkuhne.mezo`; UUID PKs; constructor injection via `@RequiredArgsConstructor`; `@Transactional` method-level only; NEVER `@Value` — config via `@Validated` `*Properties` records under `mezo:`.
- Liquibase: new changesets only (`{YYYYMMDDHHMM}_mezo-gst9_{desc}.sql`, 12-digit UTC timestamp), registered in `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (`id: "1.0.0:<script-name-without-.sql>"`, `author: daniel.kuhne`); NEVER modify released changesets; explicit constraint names (`pk_/fk_/uq_/ck_/idx_`).
- Integration tests only (no mocks/H2): extend `ApiIntegrationTest` (HTTP) or `AbstractIntegrationTest` (service) from `backend/src/test/java/io/mrkuhne/mezo/support/`; data via `support/populator/*Populator`; naming `test{Method}_should{Result}_when{Condition}`; AssertJ only. New domain table ⇒ add to the `ResetDatabase` TRUNCATE list; new aggregate ⇒ new populator.
- ALWAYS `./mvnw clean test` (never without `clean`); run focused tests per task (`-Dtest=...`), the full suite is CI's job.
- Honest-absence rules: no fabricated numbers/confidence; missing data ⇒ no row/`[]`/404, never placeholder fiction. Gather = pure code, prose = pure LLM.
- FakeCompanionLlm markers: generator marker constants are MIRRORED as literals in `FakeCompanionLlm` (`*_MARKER_MIRROR`) — a companion→proactive import would be a package cycle. Keep pairs in sync.
- Frontend: hooks only via `@/data/hooks` barrel; deep absolute `@/*` imports; mock mode byte-parity with Phase 1; both test modes must be green (`pnpm test` AND `VITE_USE_MOCK=true pnpm test`).
- Commits: conventional subject + driving bd id, e.g. `feat(api): feed endpoint (mezo-gst9)`, ending with the Claude co-author trailer.
- UI/prompt copy is Hungarian.

---

### Task 1: FuelDayService targets from the goal engine

The fixed `mezo.nutrition.targets.kcal: 3100` stops being the truth wherever an active goal exists: kcal + protein come from the goal's current prescription segment (already TDEE − deficit, weekly-stepped). Carbs/fat/water stay config (the engine prescribes only kcal+protein). No active goal (or goal without a usable segment) ⇒ config fallback unchanged.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/FuelDayService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/FuelDayServiceIT.java` (extend the existing IT)

**Interfaces:**
- Consumes: `GoalRepository.findByCreatedByAndStatusAndDeletedFalse(UUID, String)` (exists), `GoalPrescriptionJson.currentSegment(GoalPrescriptionJson, long)` → `Segment(… Integer kcal, Integer proteinG …)` (exists), `GoalPopulator.createGoalFull(UUID owner, LocalDate startDate, LocalDate targetDate, GoalPrescriptionJson prescription, Integer mealsPerDay, String wakeTime, String bedTime)` (exists).
- Produces: `FuelDayService.targetSet(UUID userId, LocalDate date)` (private; both `getDay` and `getWeek` per-day rollups call it with the day's date).

- [ ] **Step 1: Write the failing tests** — add to `FuelDayServiceIT` (mirror the existing test style in that file for populator/user setup):

```java
@Test
void testGetDay_shouldUseGoalSegmentKcalAndProtein_whenActiveGoalHasCurrentSegment() {
    UUID owner = userPopulator.createOwner().getId(); // use the file's existing user-setup idiom
    LocalDate today = LocalDate.now();
    // week 1 segment: 2600 kcal / 190 g protein — deliberately != the 3100/220 config
    GoalPrescriptionJson prescription = new GoalPrescriptionJson(List.of(
            new GoalPrescriptionJson.Segment(1, 12, 2600, 190, null, null)), null, null);
    // adjust the Segment constructor args to the record's actual component order — open
    // GoalPrescriptionJson and match (fromWeek/toWeek/kcal/proteinG/sleepTargetH/restDays)
    goalPopulator.createGoalFull(owner, today.minusDays(3), today.plusWeeks(11),
            prescription, 4, "06:00", "22:00");

    FuelDayResponse day = fuelDayService.getDay(owner, today);

    assertThat(day.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(2600));
    assertThat(day.getTargets().getP()).isEqualByComparingTo(BigDecimal.valueOf(190));
    // c/f/water stay config-driven
    assertThat(day.getTargets().getC()).isEqualByComparingTo(BigDecimal.valueOf(380));
}

@Test
void testGetDay_shouldFallBackToConfigTargets_whenNoActiveGoal() {
    UUID owner = userPopulator.createOwner().getId();
    FuelDayResponse day = fuelDayService.getDay(owner, LocalDate.now());
    assertThat(day.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(3100));
    assertThat(day.getTargets().getP()).isEqualByComparingTo(BigDecimal.valueOf(220));
}
```

- [ ] **Step 2: Run to verify failure** — `cd backend && ./mvnw clean test -Dtest=FuelDayServiceIT` → the first test FAILS (targets still 3100).

- [ ] **Step 3: Implement** — in `FuelDayService`: inject `private final GoalRepository goalRepository;` and change `targetSet()` to:

```java
private static final String GOAL_STATUS_ACTIVE = "active";

/** kcal+protein from the active goal's current prescription segment (TDEE − deficit, the
 *  goal-engine truth); c/f/water stay config. No active goal / no segment ⇒ full config. */
private MacroSet targetSet(UUID userId, LocalDate date) {
    GoalEntity goal = goalRepository
        .findByCreatedByAndStatusAndDeletedFalse(userId, GOAL_STATUS_ACTIVE)
        .stream().findFirst().orElse(null);
    Integer kcal = null;
    Integer protein = null;
    if (goal != null && goal.getStartDate() != null) {
        long week = ChronoUnit.DAYS.between(goal.getStartDate(), date) / 7 + 1;
        GoalPrescriptionJson.Segment seg =
            GoalPrescriptionJson.currentSegment(goal.getPrescription(), week);
        if (seg != null) {
            kcal = seg.kcal();
            protein = seg.proteinG();
        }
    }
    return MacroSet.builder()
        .kcal(BigDecimal.valueOf(kcal != null ? kcal : targets.kcal()))
        .p(BigDecimal.valueOf(protein != null ? protein : targets.p()))
        .c(BigDecimal.valueOf(targets.c()))
        .f(BigDecimal.valueOf(targets.f()))
        .water(BigDecimal.valueOf(targets.water()))
        .build();
}
```

Update both call sites: `getDay` → `.targets(targetSet(userId, date))`, `getWeek` rollup → `.targets(targetSet(userId, d))`. Update the class javadoc (targets are goal-engine-driven with config fallback).

- [ ] **Step 4: Run to verify pass** — `./mvnw clean test -Dtest=FuelDayServiceIT` → PASS. Also run the fuel-adjacent snapshot IT (its `[Mai üzemanyag]` line may assert 3100 with no goal — should still pass, but verify): `./mvnw clean test -Dtest=ContextSnapshotAssemblerIT`.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(fuel): fuel-day targets from the active goal's prescription segment (mezo-gst9)"` (+ co-author trailer).

---

### Task 2: Snapshot [Profil] shows the latest actual weigh-in beside the trend

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ContextSnapshotAssembler.java` (`profileBlock`, lines ~133-164)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/weight/repository/WeightLogRepository.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ContextSnapshotAssemblerIT.java`

**Interfaces:**
- Produces: `WeightLogRepository.findFirstByCreatedByAndDeletedFalseOrderByDateDescCreatedAtDesc(UUID createdBy)` → `Optional<WeightLogEntity>`.
- Snapshot line format becomes: `[Profil] …; mérés: 96.4 kg (2026-08-15); súlytrend: 97.1 kg, heti -0.4 kg (…)` — with `mérés: nincs adat` when no weigh-in exists.

- [ ] **Step 1: Failing test** — in `ContextSnapshotAssemblerIT` (reuse its existing owner/populator setup idiom):

```java
@Test
void testRender_shouldShowLatestMeasurementBesideTrend_whenWeighInsExist() {
    // weightLogPopulator: create two logs, older 97.5 on day-3, latest 96.4 on today
    // (mirror the file's existing weight-log creation calls)
    String snapshot = contextSnapshotAssembler.render(owner, LocalDate.now());
    assertThat(snapshot).contains("mérés: 96.4 kg (" + LocalDate.now() + ")");
    assertThat(snapshot).contains("súlytrend:");
}

@Test
void testRender_shouldShowNoDataMeasurement_whenNoWeighIns() {
    String snapshot = contextSnapshotAssembler.render(owner, LocalDate.now());
    assertThat(snapshot).contains("mérés: nincs adat");
}
```

- [ ] **Step 2: Verify failure** — `./mvnw clean test -Dtest=ContextSnapshotAssemblerIT` → FAIL (no `mérés:` in output).

- [ ] **Step 3: Implement** — add the repository finder; in `profileBlock` inject nothing new (assembler already has no WeightLogRepository — add `private final WeightLogRepository weightLogRepository;`) and insert before the `; súlytrend: ` append:

```java
b.append("; mérés: ");
weightLogRepository.findFirstByCreatedByAndDeletedFalseOrderByDateDescCreatedAtDesc(userId)
        .ifPresentOrElse(
                w -> b.append(num(w.getWeightKg())).append(" kg (").append(w.getDate()).append(')'),
                () -> b.append(NO_DATA));
```

- [ ] **Step 4: Verify pass** — `./mvnw clean test -Dtest=ContextSnapshotAssemblerIT` → PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(companion): snapshot profile block shows latest weigh-in beside the EWMA trend (mezo-gst9)"`.

---

### Task 3: companion_message table + entity + repository + populator

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608151200_mezo-gst9_create_companion_message.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeset)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/CompanionMessageEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/CompanionMessageEnvelope.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/CompanionMessageRepository.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/CompanionMessagePopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (add `companion_message` to the TRUNCATE list, next to `briefing`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/CompanionMessagePersistenceIT.java`

**Interfaces (produced — later tasks depend on these exact names):**
- `CompanionMessageEntity` extends `OwnedEntity`: `UUID id`, `LocalDate messageDate`, `String kind`, `CompanionMessageEnvelope content`, `Instant generatedAt`; constants `KIND_MORNING="morning"`, `KIND_SLEEP="sleep"`, `KIND_WEIGHT="weight"`, `KIND_MIDDAY="midday"`, `KIND_EVENING="evening"`.
- `CompanionMessageEnvelope(String eyebrow, List<String> body, List<CompanionMessageEnvelope.Ref> refs)`, nested `record Ref(String kind, String label)`.
- `CompanionMessageRepository extends JpaRepository<CompanionMessageEntity, UUID>`: `Optional<CompanionMessageEntity> findByCreatedByAndMessageDateAndKind(UUID, LocalDate, String)`, `List<CompanionMessageEntity> findByCreatedByAndMessageDateOrderByGeneratedAtAsc(UUID, LocalDate)`.
- `CompanionMessagePopulator.createMessage(UUID owner, LocalDate date, String kind, String eyebrow, List<String> body)` → persisted entity (generatedAt = now, refs = empty).

- [ ] **Step 1: SQL changeset** (mirror the briefing DDL conventions exactly):

```sql
-- Companion-feed (bd mezo-gst9, spec §4): one generated feed message per user+day+kind.
-- Content is the typed jsonb envelope (eyebrow + body paragraphs + model-SELECTED refs).

create table companion_message (
    id           uuid        not null default gen_random_uuid(),
    created_by   uuid        not null,
    is_deleted   boolean     not null default false,
    created_at   timestamptz not null default now(),
    message_date date        not null,
    kind         varchar(16) not null,
    content      jsonb       not null,
    generated_at timestamptz not null,
    constraint pk_companion_message_id primary key (id),
    constraint fk_companion_message_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_companion_message_kind check (kind in ('morning','sleep','weight','midday','evening'))
);

-- Partial UNIQUE (the briefing precedent): one LIVE message per user+day+kind; soft-delete +
-- reinsert stays possible. Doubles as the lookup index.
create unique index uq_companion_message_created_by_date_kind
    on companion_message (created_by, message_date, kind) where is_deleted = false;
```

Register in `1.0.0_master.yml` (append, same shape as the last entry):

```yaml
  - changeSet:
      id: "1.0.0:202608151200_mezo-gst9_create_companion_message"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202608151200_mezo-gst9_create_companion_message.sql
```

- [ ] **Step 2: Entity + envelope + repository** — `CompanionMessageEntity` is a byte-for-byte structural mirror of `BriefingEntity` (same `@SQLDelete`/`@SQLRestriction` idiom, table `companion_message`, `update companion_message set is_deleted = true where id = ?`) plus the `kind` column (`@NotNull @Column(nullable = false, length = 16)`) and WITHOUT `regen_count` (no regeneration path). `CompanionMessageEnvelope` mirrors `BriefingContentEnvelope`'s record/jsonb shape. Repository as in Interfaces.

- [ ] **Step 3: Failing persistence IT** — `CompanionMessagePersistenceIT extends AbstractIntegrationTest` (mirror `BriefingPersistenceIT`'s structure): round-trips an entity through the populator + repository, asserts jsonb envelope survives, asserts the partial-unique allows a second row only after soft-delete, asserts `findByCreatedByAndMessageDateOrderByGeneratedAtAsc` ordering with two kinds.

- [ ] **Step 4: Populator + ResetDatabase** — `CompanionMessagePopulator` mirrors `BriefingPopulator` (same package, `@Component`-or-whatever idiom that file uses — copy it); add `companion_message, ` into the `ResetDatabase` TRUNCATE string right before `briefing, `.

- [ ] **Step 5: Run** — `./mvnw clean test -Dtest=CompanionMessagePersistenceIT` → PASS (Liquibase applies the changeset on context start).

- [ ] **Step 6: Commit** — `git commit -m "feat(proactive): companion_message table + entity + repository (mezo-gst9)"`.

---

### Task 4: CompanionMessageGenerator — morning kind (+ fake sentinel)

The morning message is the day's first, generated BEFORE sleep/weight logging — its gather must not carry sleep/weight state at all (prompt prohibition alone is not enough; strip at the source).

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageGenerator.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ContextSnapshotAssembler.java` (biometrics-free render variant)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` (new mirror + sentinel)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/CompanionMessageGeneratorIT.java`

**Interfaces:**
- Consumes: Task 3's entity/repository/envelope; `DailySummaryRepository.findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc`; `KnowledgeFactService.renderPromptBlock(UUID)`; `CompanionLlm.complete(String, String)`; `LlmCallContextHolder.runWith(...)`; `ProactiveProperties` (Task 7 adds the `feed` record — until then reuse `properties.briefing().pastDays()`).
- Produces:
  - `CompanionMessageGenerator.generateMorning(UUID userId, LocalDate date)` → `CompanionMessageEntity` (null = honest absence; existing row returned untouched).
  - `ContextSnapshotAssembler.renderWithoutBiometrics(UUID userId, LocalDate today)` — same block composition as `render` but `profileBlock` omits BOTH the `mérés:` and `súlytrend:` parts (height/age/sex only) and `recoveryBlock` omits the sleep part (check-in kept).
  - Marker constant `CompanionMessageGenerator.MORNING_MARKER = "REGGELI-ELIGAZITAS-FELADAT"`; FakeCompanionLlm `MORNING_MARKER_MIRROR` + `[fake-feed-morning:{json}]` sentinel (non-greedy `\\{.*?\\}` like BRIEFING_SENTINEL — payload has no nested objects).

- [ ] **Step 1: Snapshot variant** — refactor `profileBlock(UUID, LocalDate)` → `profileBlock(UUID, LocalDate, boolean withWeight)` and `recoveryBlock(UUID)` → `recoveryBlock(UUID, boolean withSleep)`; `render` passes `true`, new `renderWithoutBiometrics` passes `false`. Extend `ContextSnapshotAssemblerIT` with one test: `testRenderWithoutBiometrics_shouldOmitWeightAndSleep_whenDataExists` (assert output does NOT contain `súlytrend`, `mérés:`, `alvás (`; DOES contain `[Cél]`, `[Edzés]`, `check-in`). Run focused, PASS, before moving on.

- [ ] **Step 2: Generator skeleton + morning prompt.** New class, same annotations/gating as `BriefingGenerator` (`@Slf4j @Service @RequiredArgsConstructor`, dual `@ConditionalOnProperty` on COMPANION_SWITCH + PROACTIVE_SWITCH). Core shared pieces (event/window kinds reuse them in Tasks 5-6):

```java
public static final String MORNING_MARKER = "REGGELI-ELIGAZITAS-FELADAT";

private static final String MORNING_PROMPT = MORNING_MARKER + "\n"
        + "Írj rövid magyar reggeli eligazítást Danielnek a mai napra, kizárólag a megadott "
        + "tényadatokból. Ez a nap ELSŐ üzenete, még az alvás és a testsúly rögzítése ELŐTT "
        + "készül: (1) az éjszakai alvásról és a testsúlyról/súlytrendről NE írj — azokról "
        + "külön üzenet szól majd, amint Daniel rögzítette őket; (2) fókusz: a mai terv "
        + "(edzés, kalóriakeret, gyógyszer) és a hét trendje; (3) zárd 2-3 konkrét, apró "
        + "fókuszponttal; (4) számot vagy adatot kitalálni tilos; (5) gyógyszer adagolására "
        + "(pl. retatrutid) vonatkozó változtatást SOHA ne javasolj — az orvosi döntés. "
        + "Válaszolj KIZÁRÓLAG szigorú JSON-nal, markdown nélkül, pontosan ebben a formában: "
        + "{\"eyebrow\": \"egysoros fejléc\", \"body\": [\"bekezdés\", ...], "
        + "\"refIndexes\": [a felhasznált HIVATKOZÁS-JELÖLTEK sorszámai]}";

/** Morning ref candidates — deliberately NO WeightTrend / Sleep (spec §3). */
static final List<CompanionMessageEnvelope.Ref> MORNING_CANDIDATES = List.of(
        new CompanionMessageEnvelope.Ref("Goal", "cél"),
        new CompanionMessageEnvelope.Ref("Workout", "edzés"),
        new CompanionMessageEnvelope.Ref("FuelDay", "mai üzemanyag"),
        new CompanionMessageEnvelope.Ref("Medication", "gyógyszer"));

record ParsedMessage(String eyebrow, List<String> body, List<Integer> refIndexes) {}
```

`generateMorning(userId, date)`:
1. existing row for (userId, date, KIND_MORNING) ⇒ return it.
2. gather: `past = dailySummaryRepository.findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc(userId, date.minusDays(pastDays))`; empty ⇒ null (emptiness gate). Payload = `contextSnapshotAssembler.renderWithoutBiometrics(userId, date)` + `knowledgeFactService.renderPromptBlock(userId)` + `KORÁBBI NAPOK` block + numbered candidate list (copy `BriefingGenerator.gather`'s loop verbatim, adding one `Ref("Memory", summary.getSummaryDate().toString())` candidate per summary on top of `MORNING_CANDIDATES`).
3. ONE `companionLlm.complete(MORNING_PROMPT, payload)` under `LlmCallContext("proactive_feed", "morning", null, null)`.
4. Defensive first-`{`-to-last-`}` parse into `ParsedMessage` (copy `BriefingGenerator.parse` + `resolveRefs` verbatim, typed to `CompanionMessageEnvelope.Ref`); blank eyebrow/empty body ⇒ null.
5. Persist `CompanionMessageEntity` (kind=morning, envelope, `generatedAt = Instant.now().truncatedTo(ChronoUnit.MICROS)`) via `saveAndFlush`.

Also add the shared private helper used by all later kinds:

```java
/** Today's already-persisted feed messages as a "ne ismételd" block; "" when none. */
private String earlierMessagesBlock(UUID userId, LocalDate date) {
    List<CompanionMessageEntity> earlier =
            companionMessageRepository.findByCreatedByAndMessageDateOrderByGeneratedAtAsc(userId, date);
    if (earlier.isEmpty()) {
        return "";
    }
    return "\n\nMAI KORÁBBI ÜZENETEK (ne ismételd):\n" + earlier.stream()
            .map(m -> "- [" + m.getKind() + "] " + String.join(" ", m.getContent().body()))
            .collect(Collectors.joining("\n"));
}
```

- [ ] **Step 3: Fake sentinel** — in `FakeCompanionLlm`, next to the briefing pair: `public static final String MORNING_MARKER_MIRROR = "REGGELI-ELIGAZITAS-FELADAT";`, pattern `MORNING_SENTINEL = Pattern.compile("\\[fake-feed-morning:(\\{.*?\\})]", Pattern.DOTALL)`, and a dispatch branch mirroring the existing `BRIEFING_MARKER_MIRROR` branch at line ~236 (scan the context for the sentinel; return its JSON payload verbatim).

- [ ] **Step 4: Failing IT** — `CompanionMessageGeneratorIT extends AbstractIntegrationTest`, mirroring `BriefingGeneratorIT`'s setup (owner + `DailySummaryPopulator` + check-in note carrying the sentinel — the snapshot renders check-in notes, which is the established sentinel-planting channel):
  - `testGenerateMorning_shouldPersistEnvelope_whenNarrativeWindowHasSummaries` — plant `[fake-feed-morning:{"eyebrow":"Jó reggelt","body":["Mai terv."],"refIndexes":[0]}]`, assert persisted row: kind `morning`, eyebrow, body, refs=[Goal/cél].
  - `testGenerateMorning_shouldReturnNull_whenNoSummariesInWindow`.
  - `testGenerateMorning_shouldReturnExistingRow_whenCalledTwice` (second call: no new row, same id).
  - `testGenerateMorning_shouldExcludeSleepAndWeightFromPayload_whenBiometricsExist` — create sleep+weight logs, call `generator` via its public gather path… the generator's payload is internal; instead assert on `contextSnapshotAssembler.renderWithoutBiometrics` (already covered in Step 1) AND assert the generator uses it by checking the fake's captured prompt if `FakeCompanionLlm` exposes one (it does for some paths — check for a capture field; if none, skip this assertion, Step 1's coverage suffices).

- [ ] **Step 5: Run** — `./mvnw clean test -Dtest=CompanionMessageGeneratorIT` → PASS.

- [ ] **Step 6: Commit** — `git commit -m "feat(proactive): companion-message generator — morning kind, biometrics-free gather (mezo-gst9)"`.

---

### Task 5: Generator — sleep + weight reaction kinds

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageGenerator.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/CompanionMessageGeneratorIT.java`

**Interfaces:**
- Consumes: `SleepLogRepository.findFirstByCreatedByAndDeletedFalseOrderByDateDesc(UUID)` (exists), `WeightLogRepository.findFirstByCreatedByAndDeletedFalseOrderByDateDescCreatedAtDesc(UUID)` (Task 2), `WeightTrendService.computeTrend(UUID)` (exists).
- Produces: `generateSleepReaction(UUID userId, LocalDate date)`, `generateWeightReaction(UUID userId, LocalDate date)` → `CompanionMessageEntity` (null = honest absence). Markers `SLEEP_MARKER = "ALVAS-REAKCIO-FELADAT"`, `WEIGHT_MARKER = "SULY-REAKCIO-FELADAT"`; fake sentinels `[fake-feed-sleep:{json}]`, `[fake-feed-weight:{json}]` (+ mirrors).

- [ ] **Step 1: Failing ITs** —
  - `testGenerateSleepReaction_shouldPersistEnvelope_whenFreshSleepLogExists` — SleepLogPopulator log for today, sentinel planted, assert kind `sleep` row with parsed envelope.
  - `testGenerateSleepReaction_shouldReturnNull_whenNoFreshSleepLog` — latest sleep log dated `date-2` (stale) ⇒ null, no row.
  - `testGenerateWeightReaction_shouldPersistEnvelope_whenTodayWeighInExists`.
  - `testGenerateWeightReaction_shouldReturnNull_whenNoTodayWeighIn` — weigh-in yesterday only ⇒ null.
  - `testGenerateSleepReaction_shouldReturnExistingRow_whenCalledTwice`.
  - `testGenerateSleepReaction_shouldIncludeEarlierMessagesBlock_whenMorningExists` — persist a morning row via `CompanionMessagePopulator` first; hard to assert the prompt directly — assert instead that generation still succeeds and produces the sleep row (the block-building itself is pure code exercised by the call; content-level dedupe is the LLM's job).

- [ ] **Step 2: Verify failure** — focused run, methods don't exist → compile FAIL.

- [ ] **Step 3: Implement.** Grounding gates (the event IS the grounding — no daily-summary gate here):
  - sleep: `sleepLogRepository.findFirstByCreatedByAndDeletedFalseOrderByDateDesc(userId)` — must exist AND `log.getDate().isAfter(date.minusDays(2))` (last night's sleep: dated today or yesterday), else null.
  - weight: `weightLogRepository.findFirstByCreatedByAndDeletedFalseOrderByDateDescCreatedAtDesc(userId)` — must exist AND `log.getDate().equals(date)`, else null.

Prompts (strict-JSON contract identical to morning):

```java
public static final String SLEEP_MARKER = "ALVAS-REAKCIO-FELADAT";
public static final String WEIGHT_MARKER = "SULY-REAKCIO-FELADAT";

private static final String SLEEP_PROMPT = SLEEP_MARKER + "\n"
        + "Daniel most rögzítette a ma éjszakai alvását. Írj rövid magyar reakciót "
        + "társ-szemszögből, kizárólag a megadott tényadatokból: (1) értékeld a MOST RÖGZÍTETT "
        + "ALVÁS blokk adatait (időtartam, minőség) a cél és a szokásos mintázat tükrében; "
        + "(2) mondd ki, mit jelent ez a mai napra (edzés, fókusz, energia); (3) ha volt már "
        + "MAI KORÁBBI ÜZENET, ne ismételd. Számot kitalálni tilos; gyógyszer-adagolás "
        + "változtatást SOHA ne javasolj. Válaszolj KIZÁRÓLAG szigorú JSON-nal: "
        + "{\"eyebrow\": \"egysoros fejléc\", \"body\": [\"bekezdés\", ...], "
        + "\"refIndexes\": [a felhasznált HIVATKOZÁS-JELÖLTEK sorszámai]}";

private static final String WEIGHT_PROMPT = WEIGHT_MARKER + "\n"
        + "Daniel most mérte meg a testsúlyát. Írj rövid magyar reakciót társ-szemszögből, "
        + "kizárólag a megadott tényadatokból: (1) a MOST RÖGZÍTETT MÉRÉS a kiindulópont — a "
        + "trendérték (EWMA) simított szám, a kettőt ne keverd össze, és a mérést nevezd "
        + "mérésnek, a trendet trendnek; (2) helyezd a mérést a heti trend és a cél "
        + "kontextusába; (3) egyetlen mérésből messzemenő következtetést ne vonj le; (4) ha "
        + "volt már MAI KORÁBBI ÜZENET, ne ismételd. Számot kitalálni tilos; gyógyszer-"
        + "adagolás változtatást SOHA ne javasolj. Válaszolj KIZÁRÓLAG szigorú JSON-nal: "
        + "{\"eyebrow\": \"egysoros fejléc\", \"body\": [\"bekezdés\", ...], "
        + "\"refIndexes\": [a felhasznált HIVATKOZÁS-JELÖLTEK sorszámai]}";

static final List<CompanionMessageEnvelope.Ref> SLEEP_CANDIDATES = List.of(
        new CompanionMessageEnvelope.Ref("Sleep", "ma éjszakai alvás"),
        new CompanionMessageEnvelope.Ref("Goal", "cél"),
        new CompanionMessageEnvelope.Ref("Workout", "mai edzés"));

static final List<CompanionMessageEnvelope.Ref> WEIGHT_CANDIDATES = List.of(
        new CompanionMessageEnvelope.Ref("WeightTrend", "súlytrend"),
        new CompanionMessageEnvelope.Ref("Goal", "cél"),
        new CompanionMessageEnvelope.Ref("FuelDay", "mai üzemanyag"));
```

Payloads use the FULL snapshot (`contextSnapshotAssembler.render` — the fresh log is now in it) + facts + `earlierMessagesBlock(userId, date)` + a detail block rendered in pure code:

```java
// sleep detail block (num() = copy BriefingGenerator's BigDecimal helper or reuse a shared one)
String detail = "\n\nMOST RÖGZÍTETT ALVÁS (" + sleep.getDate() + "): "
        + num(sleep.getDurationH()) + " h"
        + (sleep.getQuality() != null ? ", minőség " + sleep.getQuality() + "/5" : "")
        + (sleep.getAwakenings() != null ? ", ébredések: " + sleep.getAwakenings() : "");

// weight detail block
WeightTrendResponse trend = weightTrendService.computeTrend(userId);
String detail = "\n\nMOST RÖGZÍTETT MÉRÉS (" + weight.getDate() + "): "
        + num(weight.getWeightKg()) + " kg"
        + (trend.getLatestTrendKg() != null
                ? "; trendérték (EWMA, simított): " + num(trend.getLatestTrendKg()) + " kg" : "")
        + (trend.getWeeklyRateKgPerWeek() != null
                ? ", heti " + num(trend.getWeeklyRateKgPerWeek()) + " kg" : "");
```

`LlmCallContext("proactive_feed", "sleep"/"weight", null, null)`; parse/resolve/persist identical to morning (kind differs). FakeCompanionLlm: two new mirror+sentinel pairs, branches mirroring the morning one.

- [ ] **Step 4: Run focused → PASS.**

- [ ] **Step 5: Commit** — `git commit -m "feat(proactive): sleep + weight reaction kinds (mezo-gst9)"`.

---

### Task 6: Generator — window kinds (midday/evening port)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageGenerator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/CompanionMessageGeneratorIT.java`

**Interfaces:**
- Produces: `generateWindow(UUID userId, LocalDate date, String kind)` where kind ∈ {`KIND_MIDDAY`, `KIND_EVENING`} → `CompanionMessageEntity` (null = honest absence). Reuses the EXISTING `HeartbeatGenerator.HEARTBEAT_MARKER` string as its own constant `WINDOW_MARKER = "NAPKOZBENI-JEGYZET-FELADAT"` (FakeCompanionLlm's `HEARTBEAT_MARKER_MIRROR` + `[fake-heartbeat:…]` sentinel keep working unchanged).

- [ ] **Step 1: Failing ITs** — mirror `HeartbeatGeneratorIT`'s scenarios against the new method: persists a `midday` row with `[fake-heartbeat:…]` prose wrapped as `CompanionMessageEnvelope("Napközi jegyzet", List.of(prose), List.of())`; `evening` gets eyebrow `"Napzárás"`; null when zero daily summaries in the past-days window; idempotent per user+day+kind.

- [ ] **Step 2: Implement** — port `HeartbeatGenerator.generate`/`gather` into `generateWindow`: same window prompt (copy the PROMPT text verbatim from `HeartbeatGenerator`), same summary emptiness gate, but the briefing dedupe block is replaced by `earlierMessagesBlock(userId, date)` (which now covers morning+sleep+weight+midday), and the flat prose answer is wrapped in the envelope with the code-set eyebrow above. `ABLAK:` block: `"este (closing)"` for evening else `"dél (nudge)"`. `LlmCallContext("proactive_feed", kind, null, null)`.

- [ ] **Step 3: Run focused → PASS. Commit** — `git commit -m "feat(proactive): window kinds midday/evening ported to companion messages (mezo-gst9)"`.

---

### Task 7: Contract + feed read service + controller

**Files:**
- Modify: `api/feature/proactive/proactive.yml` (add `/api/proactive/feed` + `FeedMessageResponse` + `FeedRef`; old briefing/heartbeat paths STAY until Task 12)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveFeedService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/controller/ProactiveController.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/mapper/ProactiveMapper.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/config/ProactiveProperties.java` (+ `backend/src/main/resources/application.yml`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ProactiveApiFeedIT.java`

**Interfaces:**
- Contract: `GET /api/proactive/feed?date=` (operationId `getFeed`, tag `Proactive`, optional `date` query param, format date) → `200` array of `FeedMessageResponse`; NO 404 (a list endpoint — `200 []` is the honest empty state, the P1 precedent).

```yaml
    FeedRef:
      type: object
      required: [kind, label]
      properties:
        kind:
          type: string
          description: FE RefTag kind (WeightTrend/Goal/Workout/FuelDay/Medication/Sleep/Memory)
        label:
          type: string
    FeedMessageResponse:
      type: object
      required: [date, kind, eyebrow, body, refs, generatedAt]
      properties:
        date: { type: string, format: date }
        kind:
          type: string
          enum: [morning, sleep, weight, midday, evening]
        eyebrow: { type: string }
        body:
          type: array
          items: { type: string }
        refs:
          type: array
          items: { $ref: '#/components/schemas/FeedRef' }
        generatedAt: { type: string, format: date-time }
```

- Produces: `ProactiveFeedService.getFeed(UUID userId, LocalDate date)` → `List<FeedMessageResponse>`; `ProactiveMapper.toFeedResponse(CompanionMessageEntity)` (MapStruct maps `messageDate`→`date`, envelope fields flattened: `content.eyebrow`→`eyebrow` etc. — mirror how `toBriefingResponse` maps the briefing envelope); `ProactiveProperties.Feed(String morningCron, String middayCron, String eveningCron, int pastDays)` record + `feed()` accessor.
- Config (`application.yml` under `mezo.proactive:`): `feed: { morning-cron: "0 45 5 * * *", midday-cron: "0 30 12 * * *", evening-cron: "0 30 20 * * *", past-days: 7 }` (copy the current `briefing.past-days` value — check it in the yml, use the same number).
- Generator switches from `properties.briefing().pastDays()` to `properties.feed().pastDays()` in this task.

- [ ] **Step 1: Contract first** — edit the yml, then `cd api/generate && npm run generate:api`, then `cd frontend && pnpm generate:api` (commit the regenerated `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts` together with this task).

- [ ] **Step 2: Failing IT** — `ProactiveApiFeedIT extends ApiIntegrationTest`:
  - `testGetFeed_shouldReturnEmptyList_whenNoMessagesAndNoNarrativeMemory` — `200 []`.
  - `testGetFeed_shouldReturnMessagesInGeneratedOrder_whenRowsExist` — populate morning+sleep rows via `CompanionMessagePopulator`, assert order + field mapping.
  - `testGetFeed_shouldLazilyGenerateMorning_whenTodayAndMissing` — daily summary + `[fake-feed-morning:…]` sentinel planted, GET today ⇒ morning appears.
  - `testGetFeed_shouldLazilyGenerateElapsedWindows_whenTodayAfterMidday` — this is time-of-day dependent; follow `HeartbeatLazyIT`'s established approach for controlling/deriving the elapsed window (it solved the same problem — reuse its technique verbatim).
  - `testGetFeed_shouldNotGenerate_whenPastDate` — GET yesterday with no rows ⇒ `[]`, no LLM call.

- [ ] **Step 3: Implement** —

```java
@Transactional
public List<FeedMessageResponse> getFeed(UUID userId, LocalDate date) {
    LocalDate day = date != null ? date : LocalDate.now();
    if (day.equals(LocalDate.now())) {
        ensureTodayCronKinds(userId, day);
    }
    return companionMessageRepository
            .findByCreatedByAndMessageDateOrderByGeneratedAtAsc(userId, day)
            .stream().map(mapper::toFeedResponse).toList();
}

/** Miss-recovery for the cron kinds only (event kinds are born from their events):
 *  morning always (its cron is dawn — by any read it has elapsed); midday/evening when
 *  their fire-time (derived from the SAME cron via CronExpression — the heartbeat idiom)
 *  has passed. Each generate is idempotent and honest-null. */
private void ensureTodayCronKinds(UUID userId, LocalDate day) {
    generator.generateMorning(userId, day);
    LocalDateTime dayStart = day.atStartOfDay().minusNanos(1);
    LocalDateTime now = LocalDateTime.now();
    if (elapsed(properties.feed().middayCron(), dayStart, now, day)) {
        generator.generateWindow(userId, day, CompanionMessageEntity.KIND_MIDDAY);
    }
    if (elapsed(properties.feed().eveningCron(), dayStart, now, day)) {
        generator.generateWindow(userId, day, CompanionMessageEntity.KIND_EVENING);
    }
}

private boolean elapsed(String cron, LocalDateTime dayStart, LocalDateTime now, LocalDate day) {
    LocalDateTime fire = CronExpression.parse(cron).next(dayStart);
    return fire != null && fire.toLocalDate().equals(day) && !fire.isAfter(now);
}
```

Controller: implement the regenerated `ProactiveApi.getFeed(LocalDate date)` delegating to the service (the `currentUserId.get()` idiom). Mapper: add `toFeedResponse`.

- [ ] **Step 4: Run** — `./mvnw clean test -Dtest=ProactiveApiFeedIT` → PASS; also `-Dtest=ProactiveApiSwitchOffIT` still green (whole-surface 404 gating is controller-level, unchanged).

- [ ] **Step 5: Commit** — `git commit -m "feat(api): GET /api/proactive/feed — unified companion-message feed (mezo-gst9)"`.

---

### Task 8: CompanionMessageJob (three crons, one switch)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageJob.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` (add `FEED_JOB_SWITCH = "mezo.techcore.cron.feed-job.enabled"` constant, next to BRIEFING_JOB_SWITCH)
- Modify: `backend/src/main/resources/application.yml` (`mezo.techcore.cron.feed-job.enabled: true`, commented like its siblings)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/CompanionMessageJobIT.java`, `.../CompanionMessageJobSwitchOffIT.java`

**Interfaces:**
- Produces: `CompanionMessageJob.runMorning()`, `runMidday()`, `runEvening()` — three `@Scheduled` methods on `${mezo.proactive.feed.morning-cron}` / `midday-cron` / `evening-cron`, one bean gated on COMPANION + PROACTIVE + FEED_JOB switches (the `PredictionJob` multi-method idiom).

- [ ] **Step 1: Failing ITs** — mirror `BriefingJobIT` / `BriefingJobSwitchOffIT` structure: `runMorning` generates today's morning row for the seeded user (sentinel planted), is idempotent, isolates per-user failures (two users, one with no summaries ⇒ other still generated); `runMorning` ALSO generates the sleep reaction when a fresh (today/yesterday) sleep log already exists (the spec §3 "cron előtt logolt alvás" case): assert both `morning` and `sleep` rows after one run. SwitchOff IT: `mezo.techcore.cron.feed-job.enabled=false` ⇒ no `CompanionMessageJob` bean in the context.

- [ ] **Step 2: Implement** — each method: `LocalDate today = LocalDate.now();` loop `appUserRepository.findAll()`, try/catch per user (copy `BriefingJob.run`'s loop shape), calling `generateMorning` (+ then `generateSleepReaction(user.getId(), today)` — its own freshness gate makes it a safe no-op when sleep isn't logged yet) / `generateWindow(…, KIND_MIDDAY)` / `generateWindow(…, KIND_EVENING)`.

- [ ] **Step 3: Run focused → PASS. Commit** — `git commit -m "feat(proactive): CompanionMessageJob — morning/midday/evening crons (mezo-gst9)"`.

---

### Task 9: Event-driven sleep/weight triggers

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/SleepLogSavedEvent.java` (`public record SleepLogSavedEvent(UUID userId, LocalDate date) {}`)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/weight/service/WeightLogSavedEvent.java` (`public record WeightLogSavedEvent(UUID userId, LocalDate date) {}`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/SleepLogService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/weight/service/WeightLogService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageEventListener.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/CompanionMessageEventIT.java`

**Interfaces:**
- Consumes: `ApplicationEventPublisher` (inject into both log services); Task 5's `generateSleepReaction`/`generateWeightReaction`.
- Produces: listener methods `onSleepLogged(SleepLogSavedEvent)`, `onWeightLogged(WeightLogSavedEvent)` — `@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)` + `@Async`, each in its own try/catch (log-and-swallow — a failed message must never surface to the logging request).

- [ ] **Step 1: Failing IT** — `CompanionMessageEventIT extends ApiIntegrationTest`:
  - `testLogSleep_shouldCreateSleepReactionMessage_whenDateIsFresh` — plant `[fake-feed-sleep:…]` sentinel, POST the sleep-log endpoint (find its path in `api/feature/` — the existing sleep API IT shows the verb helper usage) with today's date, then await the async row: poll `companionMessageRepository` with Awaitility (check the repo's test deps — if Awaitility isn't on the classpath, loop-with-sleep up to ~5 s the way other async ITs in the repo do; grep for `await` in `backend/src/test` and copy the established pattern).
  - `testLogSleep_shouldNotCreateMessage_whenBackfillDate` — POST with `date = today-5` ⇒ no row (give the async a short grace, then assert absence).
  - `testLogWeight_shouldCreateWeightReactionMessage_whenToday` / `testLogWeight_shouldNotCreateMessage_whenBackfillDate` — same pair for weight.

- [ ] **Step 2: Implement** — publish after save: in `SleepLogService.log` add `eventPublisher.publishEvent(new SleepLogSavedEvent(createdBy, req.getDate()));` right before the return (inside the `@Transactional` — AFTER_COMMIT defers it); same in `WeightLogService.log`. Listener:

```java
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class CompanionMessageEventListener {

    private final CompanionMessageGenerator generator;

    /** Fresh-night guard mirrors the generator's own gate; backfill logs never message. */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onSleepLogged(SleepLogSavedEvent event) {
        LocalDate today = LocalDate.now();
        if (event.date().isBefore(today.minusDays(1))) {
            return;
        }
        try {
            generator.generateSleepReaction(event.userId(), today);
        } catch (Exception e) {
            log.warn("Sleep-reaction generation failed for {}", event.userId(), e);
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onWeightLogged(WeightLogSavedEvent event) {
        LocalDate today = LocalDate.now();
        if (!event.date().equals(today)) {
            return;
        }
        try {
            generator.generateWeightReaction(event.userId(), today);
        } catch (Exception e) {
            log.warn("Weight-reaction generation failed for {}", event.userId(), e);
        }
    }
}
```

(`@Async` runs on Boot's `applicationTaskExecutor` via the existing `AsyncConfiguration` — the `PushDispatchExecutor` precedent. The `@Transactional` on the generator opens its own transaction on the async thread.)

- [ ] **Step 3: Run focused → PASS. Commit** — `git commit -m "feat(proactive): sleep/weight log events trigger reaction messages (mezo-gst9)"`.

---

### Task 10: Push — new categories + AnchorResolver on companion_message

Push rides the EXISTING per-minute N2 dispatch spine (`mezo.notification.dispatch-cron: "0 * * * * *"`): event-kind messages get an anchor = their own generation minute, so the next dispatch tick (≤1 min) sends them. No new push infra.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/domain/NotificationCategory.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/service/AnchorResolver.java`
- Modify: `frontend/src/data/types.ts` (`NotificationCategoryKey` union + `NOTIFICATION_CATEGORY_META`)
- Test: extend the existing AnchorResolver/dispatch ITs (find them: `grep -rl "AnchorResolver" backend/src/test`) with the new cases
- Test (FE): `frontend/src/features/me/logic/notificationForecast.test.ts` — extend if the meta map is exhaustively iterated there

**Interfaces:**
- Produces: enum entries `EVENING("evening", true, 0, false)`, `SLEEP_REACTION("sleep_reaction", true, 0, false)`, `WEIGHT_REACTION("weight_reaction", true, 0, false)` (javadoc anchor notes mirroring the MIDDAY entry). AnchorResolver cases:
  - `morningAnchor` — REPLACES `briefingAnchor`'s repository read: `companionMessageRepository.findByCreatedByAndMessageDateAndKind(owner, date, KIND_MORNING)`, category stays `BRIEFING`, anchor logic (wake anchor + `anchorAfterGeneration` against `proactiveProperties.feed().morningCron()`) and title `"Mezo · reggeli briefing"` → change title to `"Mezo · reggeli eligazítás"`.
  - `middayAnchor` — same port (kind `midday`, cron `feed().middayCron()`), category `MIDDAY`, unchanged copy.
  - `eveningAnchor` — NEW, mirrors middayAnchor (kind `evening`, `EVENING_PREFERRED_MINUTE = 20 * 60 + 30`, cron `feed().eveningCron()`, title `"Mezo · napzárás"`).
  - `sleepReactionAnchor` / `weightReactionAnchor` — NEW: read the kind's row; anchor minute = the row's OWN generation minute: `int minute = minuteOfDay(LocalDateTime.ofInstant(msg.getGeneratedAt(), ZoneId.systemDefault()).toLocalTime())` (check `minuteOfDay`'s parameter type in the file and adapt — it takes the type the other call sites pass); titles `"Mezo · alvás"` / `"Mezo · testsúly"`; body `excerptProse(String.join(" ", msg.getContent().body()))`; url `URL_TODAY`. Register all five in `resolve(...)`'s `proseAnchors` section (lines ~126-133).
- FE meta entries (match the existing entry shape in `NOTIFICATION_CATEGORY_META` — copy a `prose`-section sibling): `evening: { label: 'Napzárás', description: 'Esti záró üzenet a naptól.', section: 'prose' }`, `sleep_reaction: { label: 'Alvás-reakció', description: 'Üzenet az alvás rögzítése után.', section: 'prose' }`, `weight_reaction: { label: 'Súly-reakció', description: 'Üzenet a reggeli mérés után.', section: 'prose' }` — adapt keys/fields to the actual meta record shape in types.ts.

- [ ] **Step 1: Failing BE tests** — in the existing AnchorResolver IT: seed `companion_message` rows via `CompanionMessagePopulator` (morning/midday/evening/sleep/weight kinds) and assert `resolve(owner, today)` yields the five categories with expected minutes (event kinds: the row's generatedAt minute). Temporarily ALSO keep the old briefing-row test green by seeding `companion_message` instead of `briefing` where the test asserted the BRIEFING category (update those assertions — the source table changed by design).
- [ ] **Step 2: Implement + run focused → PASS.**
- [ ] **Step 3: FE meta + both FE test modes** — `cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test` (the meta map is typed by `NotificationCategoryKey` — the union extension will surface every place needing the three new keys; follow the compiler).
- [ ] **Step 4: Commit** — `git commit -m "feat(notification): evening + sleep/weight reaction push categories on companion_message (mezo-gst9)"`.

---

### Task 11: FE swap — useCompanionFeed + MezoChip thread

**Files:**
- Create: `frontend/src/data/today/feedApi.ts`, `frontend/src/data/today/feedHooks.ts`, `frontend/src/data/today/feedHooks.test.tsx`
- Modify: `frontend/src/data/types.ts` (FeedMessage types), `frontend/src/data/hooks.ts` (barrel export), `frontend/src/features/today/logic/mezoMessages.ts` (+ its test), `frontend/src/features/today/pages/TodayPage.tsx`, `frontend/src/data/me/sleepHooks.ts`, `frontend/src/data/me/weightHooks.ts`, `frontend/src/test/msw/handlers.ts`
- Do NOT delete briefing/heartbeat hooks yet (Task 12).

**Interfaces:**
- `types.ts`:

```ts
export type FeedMessageKind = 'morning' | 'sleep' | 'weight' | 'midday' | 'evening'
export interface FeedMessage {
  kind: FeedMessageKind
  eyebrow: string
  body: BriefingPara[]
  refs: BriefingRef[]
  generatedAt: string // ISO date-time
}
```

- `feedApi.ts` (the `briefingApi.ts` wire-mapping idiom):

```ts
import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { FeedMessage } from '@/data/types'

type FeedWire =
  paths['/api/proactive/feed']['get']['responses']['200']['content']['application/json']

export function toFeedMessages(wire: FeedWire): FeedMessage[] {
  return wire.map((m) => ({
    kind: m.kind,
    eyebrow: m.eyebrow,
    body: m.body.map((text) => ({ type: 'p' as const, text })),
    refs: m.refs.map((r) => ({ kind: r.kind, label: r.label })),
    generatedAt: m.generatedAt,
  }))
}

export const feedApi = {
  /** The feed for the FE's LOCAL day (the check-in date precedent). */
  get: (date: string) =>
    apiFetch<FeedWire>(`/api/proactive/feed?date=${date}`).then(toFeedMessages),
}
```

- `feedHooks.ts` — `useCompanionFeed(): FeedMessage[]`; mock mode: `[]` synchronously (`initialData: [], staleTime: Infinity` — Phase-1 byte-parity); real mode: `queryKey: ['companionFeed', date]`, `refetchInterval: 60_000` (cron-kind arrivals + async event kinds land without reload), errors → `[]`, `retry: false`. Export from the `data/hooks.ts` barrel.
- `mezoMessages.ts` — new signature:

```ts
export function buildMezoMessages({ feed, demoBriefing }: {
  feed: FeedMessage[]
  demoBriefing: Briefing | null
}): MezoMessageItem[]
```

Feed items map 1:1 to `MezoMessageItem` (`id` = `kind`, `eyebrow` from the message, `time` = `HH:mm` from `generatedAt` via a local formatter, `paragraphs` = body texts, `refs` pass through, `meta: null`). When `feed` contains NO `morning` kind AND `demoBriefing != null`, prepend the demo item (`id: 'briefing-demo'`, `meta: 'Demo tartalom'`, paragraphs/refs from `demoBriefing`) — the honest fallback card, and the only Phase-1-visible state in mock mode. Delete the `CompanionNote`-based branch and `NOTE_EYEBROW`.
- `TodayPage.tsx` — replace `useCompanionNote()` + `useToday().briefing/briefingDemo` feeding with `const feed = useCompanionFeed()` and `buildMezoMessages({ feed, demoBriefing: resolveBriefing(scenario.dayState) })`. (Check `useToday`/`todayHooks.ts`: if `briefing`/`briefingDemo` have no other consumer, leave their removal to Task 12.)
- `sleepHooks.ts` / `weightHooks.ts` — in the log-mutation `onSuccess` blocks add `qc.invalidateQueries({ queryKey: ['companionFeed'] })`.
- `msw/handlers.ts` — add `http.get(`${API_BASE}/api/proactive/feed`, () => HttpResponse.json([]))` next to the briefing handler (default: honest empty feed).

- [ ] **Step 1: Failing tests** — `feedHooks.test.tsx` mirrors `briefingHooks.test.tsx` (mock returns `[]` sync; real maps the wire; error → `[]`). Update `mezoMessages`' colocated test (find it: `frontend/src/features/today/logic/` — if the test lives in `todayScope.test.ts`, update there): feed→items mapping, demo-fallback prepend, no-demo case.
- [ ] **Step 2: Implement; run BOTH modes** — `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → all green (the build catches TodayPage/type wiring).
- [ ] **Step 3: Commit** — `git commit -m "feat(today): MezoChip thread reads the unified companion feed (mezo-gst9)"`.

---

### Task 12: Old spine removal (BE + FE + contract + tables)

Everything the feed replaced goes away in ONE coherent commit. Old generated rows are discarded (user decision — no migration).

**Files (delete):**
- BE main: `proactive/service/BriefingGenerator.java`, `BriefingJob.java`, `ProactiveBriefingService.java`, `HeartbeatGenerator.java`, `HeartbeatJob.java`, `ProactiveHeartbeatService.java`; `proactive/entity/BriefingEntity.java`, `BriefingContentEnvelope.java`, `HeartbeatNoteEntity.java`; `proactive/repository/BriefingRepository.java`, `HeartbeatNoteRepository.java`
- BE test: `BriefingGeneratorIT`, `BriefingJobIT`, `BriefingJobSwitchOffIT`, `BriefingFreshnessIT`, `BriefingPersistenceIT`, `HeartbeatGeneratorIT`, `HeartbeatJobIT`, `HeartbeatJobSwitchOffIT`, `HeartbeatLazyIT`, `HeartbeatPersistenceIT`; populators `BriefingPopulator`, `HeartbeatNotePopulator`
- FE: `data/today/briefingApi.ts`, `briefingHooks.ts`, `briefingHooks.test.tsx`, `heartbeatApi.ts`, `heartbeatHooks.ts`, `heartbeatHooks.test.tsx`

**Files (modify):**
- `api/feature/proactive/proactive.yml` — remove `/api/proactive/briefing` + `/api/proactive/heartbeat` paths and `BriefingResponse`/`BriefingRef`/`HeartbeatNoteResponse` schemas; regenerate (api + FE types)
- `ProactiveController.java` — drop `getBriefing`/`getHeartbeat` overrides; `ProactiveMapper.java` — drop `toBriefingResponse`/`toHeartbeatResponse`
- `ProactiveProperties.java` — drop the `Briefing` and `Heartbeat` records (KEEP `feed`); `application.yml` — drop `mezo.proactive.briefing.*` + `mezo.proactive.heartbeat.*` + `mezo.techcore.cron.briefing-job` + `heartbeat-job` blocks
- `FeaturesConfiguration.java` — drop `BRIEFING_JOB_SWITCH` + `HEARTBEAT_JOB_SWITCH` constants
- `FakeCompanionLlm.java` — drop `BRIEFING_MARKER_MIRROR`/`BRIEFING_SENTINEL`/`HEARTBEAT_…` is still used by the WINDOW kinds — KEEP `HEARTBEAT_MARKER_MIRROR` + `[fake-heartbeat:…]`; drop only the briefing pair + its dispatch branch
- `AnchorResolver.java` — already ported (Task 10); remove any leftover `BriefingRepository`/`HeartbeatNoteRepository` injections/imports
- `ResetDatabase.java` — remove `heartbeat_note, ` and `briefing, ` from the TRUNCATE list
- `SleepLogRepository.java` — remove the now-unused `existsByCreatedByAndDeletedFalseAndDateGreaterThanEqualAndCreatedAtAfter` staleness probe (verify no other caller first: `grep -rn existsByCreatedByAndDeletedFalseAndDateGreaterThanEqual backend/src`)
- FE: `data/hooks.ts` barrel (drop the two old exports), `data/types.ts` (drop `CompanionNote`; KEEP `Briefing`/`BriefingRef`/`BriefingPara` — the demo fallback still uses them), `todayHooks.ts` (drop `briefing`/`briefingDemo` composition if Task 11 left it), `msw/handlers.ts` (drop the two old handlers), and `grep -rn "useBriefing\|useCompanionNote\|briefingApi\|heartbeatApi\|CompanionNote" frontend/src` must come back empty (except types kept above)
- New changeset: `backend/src/main/resources/db/changelog/1.0.0/script/202608151230_mezo-gst9_drop_briefing_heartbeat_note.sql`:

```sql
-- Companion-feed (bd mezo-gst9, spec §2/§4): the briefing + heartbeat_note tables are replaced
-- by companion_message; old generated rows are deliberately discarded (no migration — decision).
drop table if exists heartbeat_note;
drop table if exists briefing;
```

  registered in `1.0.0_master.yml` (id `"1.0.0:202608151230_mezo-gst9_drop_briefing_heartbeat_note"`).

**Steps:**

- [ ] **Step 1: Contract removal + regen** — yml edit, `npm run generate:api`, `pnpm generate:api`; compile will now enumerate every dead reference — follow it through the delete/modify lists above.
- [ ] **Step 2: Grep sweeps** — `grep -rn "BriefingEntity\|HeartbeatNote\|briefingRepository\|heartbeatNoteRepository\|BRIEFING_JOB_SWITCH\|HEARTBEAT_JOB_SWITCH\|proactive.briefing\|proactive.heartbeat" backend/src api/` → only historical docs/spec hits allowed, zero code hits. Same for the FE grep above.
- [ ] **Step 3: Gates** — `cd backend && ./mvnw clean test -Dtest='io.mrkuhne.mezo.feature.proactive.*'` (the whole proactive package) + `-Dtest=ContextSnapshotAssemblerIT,FuelDayServiceIT`; `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- [ ] **Step 4: Commit** — `git commit -m "refactor(proactive)!: remove briefing/heartbeat spine — companion_message feed replaces it (mezo-gst9)"`.

---

### Task 13: Docs, lint, full local gate, hand-off

- [ ] **Step 1: Feature docs (same-change rule)** — update the affected sections, overwrite-in-place, `file:line` pointers not code dumps:
  - `docs/features/proactive.md` — B and H stage sections → the feed model (5 kinds, companion_message, event triggers, job, lazy read, push categories); status table rows for briefing/heartbeat → feed; §9 gotchas: the regen/staleness decision is RETIRED (note why).
  - `docs/features/today.md` — MezoChip thread reads `useCompanionFeed`; CompanionNoteCard/briefing-card references updated.
  - `docs/features/fuel.md` — targets come from the goal engine (config fallback), §4/§10 pointers.
  - `docs/features/_platform-notifications.md` — 14-category catalog (3 new), AnchorResolver companion_message source.
  - `docs/features/me.md` — sleep/weight log write paths publish events (integration seam mention in §5).
- [ ] **Step 2: Lint** — `node scripts/lint-docs.mjs` → zero errors/staleness on the touched docs.
- [ ] **Step 3: Full local gate** — `cd backend && ./mvnw clean test` (the 128 GB machine runs the full suite locally; CI remains the authoritative gate) and both FE modes + build.
- [ ] **Step 4: bd + push** — `bd update mezo-gst9 --claim` was done at start; now `bd close mezo-gst9` after CI is green post-merge (per house flow: push branch → self-PR → CI green → `--no-ff` merge to main → push). `git pull --rebase && bd dolt push && git push`, `git status` must show up-to-date.

---

## Self-review notes (already applied)

- Spec §5 "cron előtt logolt alvás → a cron a morning után legyártja" → covered in Task 8 (`runMorning` also calls `generateSleepReaction`).
- Spec §5 regen removal → Task 12 (ProactiveBriefingService + regen_count die with the table; no port).
- Spec §7 polling → Task 11 (60 s `refetchInterval` + mutation invalidation) — covers both async event kinds and cron kinds.
- Spec §8 direct-dispatch wording → implemented as generation-minute anchors on the EXISTING per-minute dispatch spine (Task 10) — functionally "push within a minute of generation" with pref/dedup/catch-up for free; this supersedes the spec's literal "PushDispatchExecutor direct call" (record this nuance in proactive.md in Task 13).
- Type consistency: `CompanionMessageEnvelope.Ref` used consistently (generator candidates, mapper, contract `FeedRef`); `KIND_*` constants single source (`CompanionMessageEntity`); `feed()` properties record consumed by generator (pastDays), feed service + job (crons), AnchorResolver (crons).
