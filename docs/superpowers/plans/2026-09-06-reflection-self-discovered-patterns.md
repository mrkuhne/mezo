# Reflexió — Self-Discovered Patterns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Mezo extract signals from the user's free text, form pre-registered hypotheses,
evaluate them nightly with the existing statistical gate, speak about them on a third
*Észrevételek* tab with reply chips, and show every hypothesis' full trail in the Minták
laborfüzet.

**Architecture:** A new `companion/reflection` sub-package turns journal/gratitude/chat text into
`text_signal` rows and four new `MetricKey` series; the `pattern` table grows a `test_plan`,
`belief`, tallies and a stable `hypothesis_key`; a pure `HypothesisLifecycle` state machine is
driven only by nightly `PatternGate` evaluations and user replies; Gemini proposes and phrases
(quick notice after a save, nightly reflection at 03:40 with `REFLECTION` memory context) but
never moves state. Companion exposes an observation feed and a reply endpoint; the Nap→Mezo page
gets the tab, the pattern detail page gets the lab notebook.

**Tech Stack:** Java 21, Spring Boot 4, Spring AI 2 (Gemini via `CompanionLlm`), PostgreSQL 16,
Liquibase, JPA/Hibernate, React 19, TypeScript, TanStack Query, JUnit 5/AssertJ, Vitest/Testing
Library, OpenAPI 3.0.3.

**Spec:** `docs/superpowers/specs/2026-09-06-reflection-self-discovered-patterns-design.md`
**Visual truth:** `docs/design_2.0/prototypes/eszrevetelek.html`

## Global Constraints

- **Gemini phrases, code decides.** The LLM may only create `proposed` rows and `observation`
  events. `pattern.status`, `pattern.belief`, `knowledge_fact` rows and `memory_item.salience`
  are never written from an LLM answer.
- Every owned query filters `created_by` in SQL (repository method names carry `CreatedBy`).
- New enum values are a Liquibase CHECK migration (`{ts}_{bd-id}_{desc}.sql`, registered in
  `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`) + the entity `@Pattern`
  regex + the contract `pattern:` + the FE union, all in one commit.
- Every new table joins `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`'s
  TRUNCATE list and gets a populator under `support/populator/` in the same task.
- Config lives under `mezo:` in `application.yml` bound to validated records; never `@Value`.
- Jobs: `@Component` + `@ConditionalOnProperty` on `FeaturesConfiguration.COMPANION_SWITCH` and
  their own `mezo.techcore.cron.<job>.enabled` switch + `UserFanOut.forEachActiveUser` + per-user
  try/catch; the service is never class-level `@Transactional`.
- LLM prompts start with a `*_MARKER` constant; `FakeCompanionLlm` dispatches on it with
  `startsWith`; every call runs inside `LlmCallContextHolder.runWith(new LlmCallContext(
  "companion_reflection", "<stage>", ...))`; JSON answers are parsed defensively (broken = no
  output, never an exception out of the stage).
- `feature.companion` may not import `feature.proactive` or `feature.journal` services
  (ArchUnit `feature_slices_are_cycle_free`). Journal *events* and *repositories* are already
  imported by `companion/embedding` and stay allowed; proactive → companion is the allowed
  direction.
- Contract changes: edit the fragment under `api/feature/**`, then run
  `cd api/generate && npm run generate:api` and `cd frontend && pnpm generate:api`, and commit
  `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts` with the fragment.
- FE: hooks via `useDualQuery` (`mockData` / `realFetch` / `realEmpty`, 404 → `degraded`),
  re-exported from `@/data/hooks`; every page handles pending → error → degraded → empty in that
  order; tests run in BOTH modes (`pnpm test` and `VITE_USE_MOCK=false pnpm test`); MSW defaults
  in `frontend/src/test/msw/handlers.ts`. UI follows Mozaik 2.0 (`shared/ui/mozaik`,
  `shared/ui/clay`, no emoji, human-word confidence; raw r/p only inside a disclosure).
- Each task is one Beads child of `mezo-eq85`, one `feat/<topic>` branch, one self-PR, CI green,
  `--no-ff` merge, before the next dependent task starts. Commit subjects carry the issue id.
- Each task updates `docs/features/companion.md` (and `insights.md` / `today.md` for FE tasks),
  regenerates `docs/CODEMAP.md` (`node scripts/gen-codemap.mjs`), and runs
  `node scripts/lint-docs.mjs --errors-only`. Do not repair unrelated stale docs.
- Local backend verification is FOCUSED (`./mvnw test -Dtest=<ITs> -Dmezo.test.use-testcontainers=true`
  from `backend/`) plus `ArchitectureTest`; the full suite runs in CI.
- Deviation from the spec, decided while planning: the four text metric keys are named
  `TEXT_MOOD`, `TEXT_ENERGY`, `TEXT_STRESS`, `TEXT_SOCIAL_CONTACT` (wire keys `text-mood`,
  `text-energy`, `text-stress`, `text-social-contact`) so they cannot be confused with the
  existing `CHECKIN_ENERGY` / `CHECKIN_STRESS` / `SOCIAL_MENTIONS`. Reflection-close (ritual)
  signal extraction is deferred: v1 extracts from journal entries, gratitude entries and the
  nightly chat day. The `REFLECTION` policy has no hard `window-days` filter; the platform's
  existing recency modifier applies.

---

## File and interface map

**Task 1 — signals (`mezo-eq85.1`)**

| File | Responsibility |
|---|---|
| `db/changelog/1.0.0/script/202609071000_mezo-eq85.1_text_signal.sql` + master entry | `text_signal` table |
| `companion/reflection/entity/TextSignalEntity.java` | one extracted signal per source row version |
| `companion/reflection/repository/TextSignalRepository.java` | owned reads by source / day window |
| `companion/reflection/config/ReflectionProperties.java` | `mezo.companion.reflection.*` |
| `techcore/configuration/FeaturesConfiguration.java` | `REFLECTION_SWITCH`, `REFLECTION_JOB_SWITCH` |
| `companion/reflection/service/TextSignalExtractor.java` | `SIGNAL_MARKER`, one cheap-tier call → `ExtractedSignal` |
| `companion/reflection/service/TextSignalService.java` | hash/version, persist, enrich `memory_item.people/topics`, suppress |
| `companion/reflection/service/TextSignalListener.java` | journal + gratitude saved/deleted → extract |
| `companion/reflection/service/TextSignalCatchUpService.java` | last-N-days re-extraction of missing/stale signals |
| `companion/reflection/service/ChatDaySignalService.java` | one call over yesterday's user turns |
| `companion/reflection/service/TextSignalSeriesService.java` | four per-day series from signals |
| `companion/reflection/service/DerivedSeriesService.java` | `people:<name>` / `topic:<key>` / `MetricKey` series by string key |
| `companion/service/MetricKey.java`, `MetricSeriesService.java` | four new keys + delegation |
| `companion/llm/FakeCompanionLlm.java` | `SIGNAL_MARKER` dispatch + `[[SIGNAL:…]]` sentinel |
| `support/populator/TextSignalPopulator.java`, `support/ResetDatabase.java` | test data |

**Task 2 — lifecycle (`mezo-eq85.2`)**

| File | Responsibility |
|---|---|
| `db/changelog/.../202609071100_mezo-eq85.2_pattern_reflection_lifecycle.sql` | new columns, widened CHECKs |
| `companion/entity/TestPlanEnvelope.java` | pre-registered test, canonical key |
| `companion/entity/PatternEntity.java`, `PatternEventEntity.java`, `PatternEventPayloadEnvelope.java` | new kinds/statuses/fields |
| `companion/service/PatternGate.java` | visibility → public (no logic change) |
| `companion/service/PatternService.java` | `applyEngineConfirm` |
| `companion/reflection/service/HypothesisLifecycle.java` | pure state machine + belief |
| `companion/reflection/service/HypothesisEvaluationService.java` | nightly gate evaluation → events → transitions |
| `companion/reflection/service/ReflectionJob.java` | 03:40 orchestration; replaces `HypothesisJob` |
| `companion/service/HypothesisPipelineService.java` | `run(userId, extraContext)`, max-per-night |
| `api/feature/companion/companion.yml` | `PatternResponse` / `PatternEventResponse` widened |
| `frontend/src/data/types.ts`, `data/insights/patternsApi.ts`, `patternDetailApi.ts` | unions widened (render in Task 6) |

**Task 3 — memory + chat (`mezo-eq85.3`)**

| File | Responsibility |
|---|---|
| `companion/memory/dto/ConsumerPolicy.java`, `config/MemoryPlatformProperties.java`, `service/MemoryContextService.java`, `LlmMemoryReranker.java` | `REFLECTION` policy |
| `companion/reflection/service/ReflectionMemoryGateway.java` | one audited retrieval per reflection call, fail-open |
| `companion/reflection/service/TestPlanValidator.java` | LLM plan → validated `TestPlanEnvelope` |
| `companion/service/HypothesisPipelineService.java` | test-plan-aware prompt, `kind=reflection` persistence, memory context |
| `companion/reflection/service/ReflectionPromptBlock.java` + `ChatService.java` | `[Észrevételek]` block |
| `db/changelog/.../202609071200_mezo-eq85.3_ai_conversation_seed_pattern.sql`, `AiConversationEntity`, `ConversationService`, contract | conversation seeded with a hypothesis |
| `companion/reflection/service/ReflectionReplyRecorder.java` + `ChatService.java` | chat turn → `user_reply` event |
| `docs/infrastructure/local-dev-testing.md` | `MEZO_MEMORY_SERVING_MODE=NEW` |

**Task 4 — quick notice, observation feed, reply, morning digest (`mezo-eq85.4`)**

| File | Responsibility |
|---|---|
| `companion/reflection/service/QuickNoticePreScreen.java` | pure trigger rules |
| `companion/reflection/service/ObservationBudget.java` | per-day cap, gap, quiet hours |
| `companion/reflection/service/QuickNoticeService.java` | `NOTICE_MARKER` call, persist, surface |
| `companion/reflection/service/ObservationFeedService.java` | the four card kinds for a day |
| `companion/reflection/service/ReflectionReplyService.java` | chip replies, `talk` → seeded conversation |
| `companion/reflection/service/ReflectionDigestService.java` + `proactive/service/CompanionMessageGenerator.java` | morning one-liner |
| `companion/reflection/controller/CompanionObservationController.java` + contract tag `CompanionObservation` | `GET /api/companion/observation`, `POST /api/companion/pattern/{id}/reply` |
| `appnotification/domain/AppNotificationKind.java` | `OBSERVATION_NEW` |

**Task 5 — FE tab (`mezo-eq85.5`)**

| File | Responsibility |
|---|---|
| `frontend/src/data/insights/observationsApi.ts`, `observationsHooks.ts`, `observations.ts` (mock seed) | dual-mode read + reply mutation |
| `frontend/src/features/today/components/ObservationCard.tsx` | the four card kinds + chips |
| `frontend/src/features/today/pages/NapMezoPage.tsx` | third tab, dot |
| `frontend/src/styles/prototype.css` | `.nap-obs*` |
| `frontend/src/test/msw/handlers.ts` | defaults |

**Task 6 — FE laborfüzet (`mezo-eq85.6`)**

| File | Responsibility |
|---|---|
| `companion/service/PatternPairDetailService.java` | reflection rows served by `hypothesis_key` |
| `frontend/src/features/insights/components/{HypothesisStateCard,TestPlanTiles,EvidenceLog}.tsx` | lab notebook sections |
| `frontend/src/features/insights/pages/PatternDetailPage.tsx`, `logic/lifecycle.ts`, `logic/patternCatalog.ts` | wiring + buckets |

---

### Task 1: Text signals and the four text series (`mezo-eq85.1`)

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609071000_mezo-eq85.1_text_signal.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/entity/TextSignalEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/repository/TextSignalRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/config/ReflectionProperties.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/MezoApplication.java` (only if `ReflectionProperties` is not picked up by the existing `@ConfigurationPropertiesScan`)
- Create: `.../companion/reflection/service/TextSignalExtractor.java`
- Create: `.../companion/reflection/service/TextSignalService.java`
- Create: `.../companion/reflection/service/TextSignalListener.java`
- Create: `.../companion/reflection/service/TextSignalCatchUpService.java`
- Create: `.../companion/reflection/service/ChatDaySignalService.java`
- Create: `.../companion/reflection/service/TextSignalSeriesService.java`
- Create: `.../companion/reflection/service/DerivedSeriesService.java`
- Modify: `.../companion/service/MetricKey.java`, `.../companion/service/MetricSeriesService.java`
- Modify: `.../companion/llm/FakeCompanionLlm.java`
- Modify: `backend/src/main/resources/application.yml`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/TextSignalPopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/reflection/TextSignalExtractorTest.java`
- Test: `.../feature/companion/reflection/TextSignalListenerIT.java`
- Test: `.../feature/companion/reflection/TextSignalListenerSwitchOffIT.java`
- Test: `.../feature/companion/reflection/TextSignalSeriesIT.java`

**Interfaces:**
- Consumes: `JournalEntrySavedEvent(UUID entryId)`, `GratitudeEntrySavedEvent(UUID entryId)`,
  `JournalEntryDeletedEvent(UUID entryId)`, `GratitudeEntryDeletedEvent(UUID entryId)`
  (`feature.journal.service`); `JournalEntryRepository`, `GratitudeEntryRepository`;
  `AiMessageRepository.findByCreatedByAndRoleAndDeletedFalseAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtAsc`;
  `MemoryItemRepository.findByCreatedByAndSourceKindAndSourceId(UUID, String, UUID)`;
  `CompanionLlm.complete(String systemPrompt, List<Turn> history, String userMessage, ...)` as used
  by `HypothesisPipelineService`; `MetricSeriesService.series(UUID, MetricKey, LocalDate, LocalDate)`.
- Produces:
  - `TextSignalEntity` (fields below), `TextSignalRepository`.
  - `record ExtractedSignal(Integer mood, Integer energy, Integer stress, String confidence,
    List<String> people, List<String> topics, List<String> keywords)`; `TextSignalExtractor.extract(UUID userId, String sourceKind, UUID sourceId, String text) → Optional<ExtractedSignal>`.
  - `TextSignalService.record(UUID userId, String sourceKind, UUID sourceId, LocalDate occurredOn, String text) → Optional<TextSignalEntity>`; `TextSignalService.suppress(UUID userId, String sourceKind, UUID sourceId)`.
  - `TextSignalCatchUpService.catchUp(UUID userId, LocalDate today) → int`.
  - `ChatDaySignalService.extractDay(UUID userId, LocalDate day) → Optional<TextSignalEntity>`.
  - `DerivedSeriesService.series(UUID userId, String key, LocalDate from, LocalDate to) → Map<LocalDate, Double>`; `DerivedSeriesService.valueKindOf(String key) → MetricValueKind`; `DerivedSeriesService.labelOf(String key) → String`; `DerivedSeriesService.isKnown(UUID userId, String key) → boolean`.
  - `MetricKey.TEXT_MOOD`, `TEXT_ENERGY`, `TEXT_STRESS` (NUMBER), `TEXT_SOCIAL_CONTACT` (BINARY).
  - `ReflectionProperties` (record below), `FeaturesConfiguration.REFLECTION_SWITCH = "mezo.companion.reflection.enabled"`, `FeaturesConfiguration.REFLECTION_JOB_SWITCH = "mezo.techcore.cron.reflection-job.enabled"`.
  - `TextSignalEntity.SOURCE_JOURNAL = "journal_entry"`, `SOURCE_GRATITUDE = "gratitude"`, `SOURCE_CHAT_DAY = "chat_day"`, `CONFIDENCE_SURE = "sure"`, `CONFIDENCE_UNSURE = "unsure"`.

- [ ] **Step 1: Write the migration and register it**

`202609071000_mezo-eq85.1_text_signal.sql`:

```sql
-- Reflexió S1 (bd mezo-eq85.1, spec 2026-09-06 §4.1): one extracted signal per source-row
-- version. Never updated in place — an edited entry gets a new version; series read the newest
-- version per (source_kind, source_id). `unsure` rows exist for audit but never enter a series.
create table text_signal (
    id            uuid         not null default gen_random_uuid(),
    created_by    uuid         not null,
    is_deleted    boolean      not null default false,
    created_at    timestamptz  not null default now(),
    source_kind   varchar(16)  not null,
    source_id     uuid         not null,
    occurred_on   date         not null,
    content_hash  varchar(64)  not null,
    version       integer      not null default 1,
    mood          smallint,
    energy        smallint,
    stress        smallint,
    confidence    varchar(8)   not null,
    people        text[]       not null default '{}',
    topics        text[]       not null default '{}',
    keywords      text[]       not null default '{}',
    provenance    jsonb        not null default '{}'::jsonb,
    constraint pk_text_signal_id primary key (id),
    constraint fk_text_signal_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_text_signal_source_kind check (source_kind in ('journal_entry', 'gratitude', 'chat_day')),
    constraint ck_text_signal_confidence check (confidence in ('sure', 'unsure')),
    constraint ck_text_signal_mood check (mood is null or mood between 1 and 5),
    constraint ck_text_signal_energy check (energy is null or energy between 1 and 5),
    constraint ck_text_signal_stress check (stress is null or stress between 1 and 5)
);
create unique index uq_text_signal_source_version on text_signal (created_by, source_kind, source_id, version) where is_deleted = false;
create index idx_text_signal_created_by_occurred_on on text_signal (created_by, occurred_on);
```

Append to `1.0.0_master.yml` (same shape as the last entry):

```yaml
  - changeSet:
      id: "1.0.0:202609071000_mezo-eq85.1_text_signal"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609071000_mezo-eq85.1_text_signal.sql
```

Run: `node scripts/lint-liquibase.mjs` → expected: no error for the new file.

- [ ] **Step 2: Entity, repository, populator, ResetDatabase**

`TextSignalEntity.java` (mirror `MemoryItemEntity.topics`'s array mapping exactly):

```java
package io.mrkuhne.mezo.feature.companion.reflection.entity;

@Getter @Setter @Entity @Table(name = "text_signal")
@SQLDelete(sql = "update text_signal set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class TextSignalEntity extends OwnedEntity {
    public static final String SOURCE_JOURNAL = "journal_entry";
    public static final String SOURCE_GRATITUDE = "gratitude";
    public static final String SOURCE_CHAT_DAY = "chat_day";
    public static final String CONFIDENCE_SURE = "sure";
    public static final String CONFIDENCE_UNSURE = "unsure";

    @Id @GeneratedValue @Column(columnDefinition = "uuid") private UUID id;
    @NotNull @Pattern(regexp = "journal_entry|gratitude|chat_day") @Column(name = "source_kind", nullable = false, length = 16) private String sourceKind;
    @NotNull @Column(name = "source_id", nullable = false, columnDefinition = "uuid") private UUID sourceId;
    @NotNull @Column(name = "occurred_on", nullable = false) private LocalDate occurredOn;
    @NotNull @Column(name = "content_hash", nullable = false, length = 64) private String contentHash;
    @NotNull @Column(nullable = false) private Integer version = 1;
    @Min(1) @Max(5) private Integer mood;
    @Min(1) @Max(5) private Integer energy;
    @Min(1) @Max(5) private Integer stress;
    @NotNull @Pattern(regexp = "sure|unsure") @Column(nullable = false, length = 8) private String confidence;
    @NotNull @JdbcTypeCode(SqlTypes.ARRAY) @Column(nullable = false, columnDefinition = "text[]") private List<String> people = new ArrayList<>();
    @NotNull @JdbcTypeCode(SqlTypes.ARRAY) @Column(nullable = false, columnDefinition = "text[]") private List<String> topics = new ArrayList<>();
    @NotNull @JdbcTypeCode(SqlTypes.ARRAY) @Column(nullable = false, columnDefinition = "text[]") private List<String> keywords = new ArrayList<>();
    @NotNull @JdbcTypeCode(SqlTypes.JSON) @Column(nullable = false, columnDefinition = "jsonb") private TextSignalProvenanceEnvelope provenance = TextSignalProvenanceEnvelope.empty();

    public boolean isSure() { return CONFIDENCE_SURE.equals(confidence); }
}
```

`TextSignalProvenanceEnvelope` (same package): `record TextSignalProvenanceEnvelope(String model, String extractedAt, Integer textLength) { static TextSignalProvenanceEnvelope empty() { return new TextSignalProvenanceEnvelope(null, null, null); } }`.

`TextSignalRepository.java`:

```java
public interface TextSignalRepository extends JpaRepository<TextSignalEntity, UUID> {
    Optional<TextSignalEntity> findFirstByCreatedByAndSourceKindAndSourceIdAndDeletedFalseOrderByVersionDesc(UUID createdBy, String sourceKind, UUID sourceId);
    List<TextSignalEntity> findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(UUID createdBy, String sourceKind, UUID sourceId);
    List<TextSignalEntity> findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnAscVersionDesc(UUID createdBy, LocalDate from, LocalDate to);
    Optional<TextSignalEntity> findFirstByCreatedByAndSourceKindAndOccurredOnAndDeletedFalseOrderByVersionDesc(UUID createdBy, String sourceKind, LocalDate occurredOn);
}
```

`TextSignalPopulator.java` (`@TestComponent`): `TextSignalEntity signal(UUID owner, String sourceKind, UUID sourceId, LocalDate day, Integer mood, Integer energy, Integer stress, List<String> people, List<String> topics)` → `confidence = "sure"`, `contentHash = "h-" + sourceId`, `saveAndFlush`. Add `text_signal` to the `ResetDatabase` TRUNCATE list right before `pattern_event`.

- [ ] **Step 3: Configuration**

`ReflectionProperties.java`:

```java
@Validated
@ConfigurationProperties(prefix = "mezo.companion.reflection")
public record ReflectionProperties(
        boolean enabled,
        @NotBlank String cron,
        @Min(1) @Max(30) int catchUpDays,
        @NotNull @Valid Notice notice,
        @NotNull @Valid Propose propose,
        @NotNull @Valid Lifecycle lifecycle) {
    public record Notice(@Min(0) @Max(10) int maxPerDay, @Min(0) @Max(24) int minGapHours,
                         @NotNull LocalTime quietFrom, @NotNull LocalTime quietTo) {}
    public record Propose(@Min(0) @Max(5) int maxPerNight) {}
    public record Lifecycle(@Min(1) @Max(10) int confirmStreak, @Min(1) @Max(10) int refuteStreak,
                            @Min(7) @Max(180) int dormantAfterDays,
                            @DecimalMin("0.05") @DecimalMax("0.9") double strongR,
                            @DecimalMin("0.01") @DecimalMax("0.5") double strongP) {}
}
```

Register it the way `MemoryPlatformProperties` is registered (grep `MemoryPlatformProperties.class`; if the app uses `@ConfigurationPropertiesScan` on `MezoApplication`, nothing else is needed).

`application.yml`, under `mezo.companion:` (next to `memory-platform:`):

```yaml
    reflection:
      # Reflexió (mezo-eq85): text signals, quick notices, the 03:40 nightly reflection.
      enabled: true
      # 03:40 — free dawn slot between graph maintenance (03:20) and audit retention (03:50).
      cron: "0 40 3 * * *"
      # Missing/stale text signals are re-extracted for this many finished days each night.
      catch-up-days: 7
      notice:
        max-per-day: 2
        min-gap-hours: 4
        quiet-from: "22:00"
        quiet-to: "07:00"
      propose:
        max-per-night: 2
      lifecycle:
        confirm-streak: 3
        refute-streak: 3
        dormant-after-days: 30
        strong-r: 0.3
        strong-p: 0.15
```

Under `mezo.techcore.cron:` add `reflection-job: { enabled: true }` (expanded form like the
neighbours) and add the 03:40 line to the dawn-slot comment block. `FeaturesConfiguration`:

```java
public static final String REFLECTION_SWITCH = "mezo.companion.reflection.enabled";
public static final String REFLECTION_JOB_SWITCH = "mezo.techcore.cron.reflection-job.enabled";
```

- [ ] **Step 4: Write the failing extractor unit test**

`TextSignalExtractorTest.java` (plain JUnit, a stub `CompanionLlm` lambda/anonymous class that
returns a canned string; construct the extractor with `new ObjectMapper()` and a
`LlmCallContextHolder` the way `HypothesisPipelineService`'s unit tests do, or instantiate
`LlmCallContextHolder` directly if it has a no-arg constructor):

```java
class TextSignalExtractorTest {
    @Test
    void testExtract_shouldParseNumbersPeopleTopics_whenAnswerIsValidJson() {
        TextSignalExtractor extractor = extractorReturning(
            "{\"mood\":4,\"energy\":3,\"stress\":2,\"confidence\":\"sure\",\"people\":[\"Anna\"],\"topics\":[\"kapcsolatok\",\"ismeretlen\"],\"keywords\":[\"séta\"]}");
        ExtractedSignal s = extractor.extract(UUID.randomUUID(), "journal_entry", UUID.randomUUID(), "Annával sétáltunk").orElseThrow();
        assertThat(s.mood()).isEqualTo(4);
        assertThat(s.people()).containsExactly("Anna");
        assertThat(s.topics()).containsExactly("kapcsolatok"); // unknown topic dropped
    }
    @Test
    void testExtract_shouldDropNumbers_whenUnsure() {
        ExtractedSignal s = extractorReturning("{\"mood\":4,\"confidence\":\"unsure\",\"people\":[],\"topics\":[],\"keywords\":[]}")
            .extract(UUID.randomUUID(), "journal_entry", UUID.randomUUID(), "ok").orElseThrow();
        assertThat(s.mood()).isNull();
        assertThat(s.confidence()).isEqualTo("unsure");
    }
    @Test
    void testExtract_shouldBeEmpty_whenAnswerIsNotJson() {
        assertThat(extractorReturning("nem tudom").extract(UUID.randomUUID(), "journal_entry", UUID.randomUUID(), "x")).isEmpty();
    }
    @Test
    void testExtract_shouldClampOutOfRange_whenModelOvershoots() {
        ExtractedSignal s = extractorReturning("{\"mood\":9,\"confidence\":\"sure\",\"people\":[],\"topics\":[],\"keywords\":[]}")
            .extract(UUID.randomUUID(), "journal_entry", UUID.randomUUID(), "x").orElseThrow();
        assertThat(s.mood()).isEqualTo(5);
    }
}
```

- [ ] **Step 5: Run it to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=TextSignalExtractorTest -q` → expected: compilation error (`TextSignalExtractor` missing).

- [ ] **Step 6: Implement the extractor**

```java
@Slf4j @Service @RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH}, havingValue = "true")
public class TextSignalExtractor {
    public static final String SIGNAL_MARKER = "SZÖVEG-JEL-KINYERÉS";
    public static final Set<String> TOPICS = Set.of("munka", "család", "kapcsolatok", "sport", "egészség",
            "pihenés", "alvás", "evés", "pénz", "alkotás", "tanulás", "otthon");
    private static final String PROMPT = SIGNAL_MARKER + """
            . Az alábbi rövid magyar bejegyzésből nyerj ki jeleket. Válaszolj KIZÁRÓLAG JSON-nal:
            {"mood":1-5|null,"energy":1-5|null,"stress":1-5|null,"confidence":"sure"|"unsure",
             "people":["név ahogy a szövegben szerepel"],"topics":["""
            + String.join("|", TOPICS.stream().sorted().toList()) + """
            "],"keywords":["max 3 szabad kulcsszó"]}
            Semleges, kétsoros, érzelemmentes bejegyzésnél confidence="unsure" és a számok null.
            Ne találj ki embert, aki nincs a szövegben.""";

    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;
    private final LlmCallContextHolder llmCallContextHolder;

    public record ExtractedSignal(Integer mood, Integer energy, Integer stress, String confidence,
                                  List<String> people, List<String> topics, List<String> keywords) {}

    public Optional<ExtractedSignal> extract(UUID userId, String sourceKind, UUID sourceId, String text) {
        if (text == null || text.isBlank()) { return Optional.empty(); }
        String raw;
        try {
            raw = llmCallContextHolder.runWith(
                new LlmCallContext("companion_reflection", "signal_" + sourceKind, sourceKind, sourceId),
                () -> companionLlm.complete(PROMPT, List.of(), text, userId));
        } catch (RuntimeException e) {
            log.warn("Signal extraction call failed for {} {}", sourceKind, sourceId, e);
            return Optional.empty();
        }
        Raw parsed = parse(raw);
        if (parsed == null) { return Optional.empty(); }
        boolean sure = "sure".equals(parsed.confidence());
        return Optional.of(new ExtractedSignal(
            sure ? clamp(parsed.mood()) : null, sure ? clamp(parsed.energy()) : null, sure ? clamp(parsed.stress()) : null,
            sure ? "sure" : "unsure",
            clean(parsed.people(), 5, false), clean(parsed.topics(), 3, true), clean(parsed.keywords(), 3, false)));
    }
    private record Raw(Integer mood, Integer energy, Integer stress, String confidence,
                       List<String> people, List<String> topics, List<String> keywords) {}
    private Raw parse(String raw) {
        if (raw == null) { return null; }
        int start = raw.indexOf('{'); int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) { return null; }
        try { return objectMapper.readValue(raw.substring(start, end + 1), Raw.class); }
        catch (Exception e) { log.warn("Signal answer was not parseable JSON — dropping: {}", raw, e); return null; }
    }
    private static Integer clamp(Integer v) { return v == null ? null : Math.clamp(v, 1, 5); }
    private static List<String> clean(List<String> in, int max, boolean topicVocabulary) {
        if (in == null) { return List.of(); }
        return in.stream().filter(Objects::nonNull).map(String::trim).filter(s -> !s.isBlank())
                .filter(s -> !topicVocabulary || TOPICS.contains(s.toLowerCase(Locale.ROOT)))
                .map(s -> topicVocabulary ? s.toLowerCase(Locale.ROOT) : s).distinct().limit(max).toList();
    }
}
```

Adapt the `companionLlm.complete(...)` call to the real `CompanionLlm` signature used in
`HypothesisPipelineService.propose` (copy that call shape exactly).

- [ ] **Step 7: Run the unit test → PASS, commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection backend/src/main/resources backend/src/test/java/io/mrkuhne/mezo/support backend/src/test/java/io/mrkuhne/mezo/feature/companion/reflection/TextSignalExtractorTest.java backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java
git commit -m "feat(companion): text_signal table, reflection config and the signal extractor (mezo-eq85.1)"
```

- [ ] **Step 8: FakeCompanionLlm dispatch**

In `FakeCompanionLlm.complete(...)`, before the `HypothesisPipelineService.HYPOTHESIS_MARKER`
branch, add (sentinel constant next to the other `*_SENTINEL` patterns):

```java
private static final Pattern SIGNAL_SENTINEL = Pattern.compile("\\[\\[SIGNAL:(.*?)\\]\\]", Pattern.DOTALL);
public static final String SIGNAL_FAIL = "SIGNAL_FAIL";
...
if (systemPrompt.startsWith(TextSignalExtractor.SIGNAL_MARKER)) {
    if (userMessage.contains(SIGNAL_FAIL)) { throw new IllegalStateException("scripted signal failure"); }
    Matcher m = SIGNAL_SENTINEL.matcher(userMessage);
    // default: a sure, mildly positive signal mentioning Anna — the e2e happy path
    return m.find() ? m.group(1)
        : "{\"mood\":4,\"energy\":3,\"stress\":2,\"confidence\":\"sure\",\"people\":[\"Anna\"],\"topics\":[\"kapcsolatok\"],\"keywords\":[]}";
}
```

(`IllegalStateException` is allowed inside the test-profile fake only if the fake already
throws raw runtime types elsewhere; otherwise use the same exception type the fake's other
`*_FAIL` branches use.)

- [ ] **Step 9: Write the failing listener IT**

`TextSignalListenerIT.java`:

```java
@ActiveProfiles("companion-fake")
class TextSignalListenerIT extends AbstractIntegrationTest {
    @Autowired private JournalService journalService;          // the real write path publishes the event
    @Autowired private TextSignalRepository textSignalRepository;
    @Autowired private MemoryItemRepository memoryItemRepository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testJournalSave_shouldWriteSignalAndEnrichMemoryItem() {
        UUID owner = userPopulator.createUser().getId();
        // Use the real journal write service so JournalEntrySavedEvent fires; read
        // feature/journal/service/JournalService.java for the exact create method + request DTO
        // (the populator would bypass the event). Text: "Annával sétáltunk, jó nap volt."
        UUID entryId = createJournalEntryViaService(owner, LocalDate.now().minusDays(1), "Annával sétáltunk, jó nap volt.");
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            TextSignalEntity s = textSignalRepository.findFirstByCreatedByAndSourceKindAndSourceIdAndDeletedFalseOrderByVersionDesc(owner, "journal_entry", entryId).orElseThrow();
            assertThat(s.getMood()).isEqualTo(4);
            assertThat(s.getPeople()).containsExactly("Anna");
            MemoryItemEntity item = memoryItemRepository.findByCreatedByAndSourceKindAndSourceId(owner, "journal_entry", entryId).orElseThrow();
            assertThat(item.getPeople()).containsExactly("Anna");
            assertThat(item.getTopics()).containsExactly("kapcsolatok");
        });
    }

    @Test
    void testJournalEdit_shouldWriteNewVersion_notOverwrite() { /* create, await v1, update text, await v2; both rows present, newest version 2 */ }

    @Test
    void testJournalDelete_shouldSoftDeleteSignals() { /* create, await, delete, await repository returns empty */ }

    @Test
    void testExtractionFailure_shouldLeaveEntryIntactAndWriteNoSignal() {
        /* text contains FakeCompanionLlm.SIGNAL_FAIL; sleep-free: assert entry readable, then after 2s no signal row */
    }
}
```

Use the real journal write service and request DTO names from `feature/journal/service/JournalService.java`
(read that file for the exact create/update/delete method names and request types before writing
the test). `MemoryItemEntity` for a journal entry exists because `JournalEmbeddingListener`
dual-writes it; if the fake embedding profile does not produce a `memory_item` row synchronously,
seed one with `MemoryItemPopulator.item(owner, "journal_entry", entryId, ...)` before the save.

- [ ] **Step 10: Run it → FAIL (listener missing)**

Run: `cd backend && ./mvnw test -Dtest=TextSignalListenerIT -Dmezo.test.use-testcontainers=true -q`

- [ ] **Step 11: Implement service + listener**

`TextSignalService.java`:

```java
@Slf4j @Service @RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH}, havingValue = "true")
public class TextSignalService {
    private final TextSignalRepository textSignalRepository;
    private final TextSignalExtractor extractor;
    private final MemoryItemRepository memoryItemRepository;

    /** Idempotent on (source, content hash): same text ⇒ the existing newest row is returned. */
    @Transactional
    public Optional<TextSignalEntity> record(UUID userId, String sourceKind, UUID sourceId, LocalDate occurredOn, String text) {
        String hash = sha256(text);
        Optional<TextSignalEntity> newest = textSignalRepository
            .findFirstByCreatedByAndSourceKindAndSourceIdAndDeletedFalseOrderByVersionDesc(userId, sourceKind, sourceId);
        if (newest.isPresent() && newest.get().getContentHash().equals(hash)) { return newest; }
        Optional<ExtractedSignal> extracted = extractor.extract(userId, sourceKind, sourceId, text);
        if (extracted.isEmpty()) { return Optional.empty(); }
        ExtractedSignal e = extracted.get();
        TextSignalEntity row = new TextSignalEntity();
        row.setCreatedBy(userId); row.setSourceKind(sourceKind); row.setSourceId(sourceId);
        row.setOccurredOn(occurredOn); row.setContentHash(hash);
        row.setVersion(newest.map(n -> n.getVersion() + 1).orElse(1));
        row.setMood(e.mood()); row.setEnergy(e.energy()); row.setStress(e.stress());
        row.setConfidence(e.confidence());
        row.setPeople(new ArrayList<>(e.people())); row.setTopics(new ArrayList<>(e.topics())); row.setKeywords(new ArrayList<>(e.keywords()));
        row.setProvenance(new TextSignalProvenanceEnvelope("companion-cheap", Instant.now().toString(), text.length()));
        TextSignalEntity saved = textSignalRepository.saveAndFlush(row);
        enrichMemoryItem(userId, sourceKind, sourceId, e);
        return Optional.of(saved);
    }

    @Transactional
    public void suppress(UUID userId, String sourceKind, UUID sourceId) {
        textSignalRepository.findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(userId, sourceKind, sourceId)
            .forEach(textSignalRepository::delete); // @SQLDelete ⇒ soft delete
    }

    /** memory_item.people/topics only — salience is never touched (RAG spec §12). */
    private void enrichMemoryItem(UUID userId, String sourceKind, UUID sourceId, ExtractedSignal e) {
        memoryItemRepository.findByCreatedByAndSourceKindAndSourceId(userId, sourceKind, sourceId).ifPresent(item -> {
            item.setPeople(new ArrayList<>(e.people()));
            item.setTopics(new ArrayList<>(e.topics()));
            memoryItemRepository.saveAndFlush(item);
        });
    }

    static String sha256(String text) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new SystemRuntimeErrorException(SystemMessage.error("INTERNAL_ERROR").build());
        }
    }
}
```

(`memory_item.source_kind` for gratitude rows is whatever `MemoryEmbeddingWriter.writeGratitude`
sets — read it and pass that exact string when the listener calls `record` for gratitude:
`sourceKind` for the signal row is `"gratitude"`, and the lookup key for `memory_item` is the
writer's kind. Add a `memoryItemSourceKind` parameter if the two differ.)

`TextSignalListener.java` — the `JournalEmbeddingListener` idiom (`@Async`,
`@TransactionalEventListener(phase = AFTER_COMMIT)`, gated on `COMPANION_SWITCH`,
`JOURNAL_SWITCH`, `REFLECTION_SWITCH`, catch-everything, warn-log):

```java
@Async @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
public void onJournalEntrySaved(JournalEntrySavedEvent event) {
    try {
        journalEntryRepository.findById(event.entryId()).ifPresent(entry ->
            textSignalService.record(entry.getCreatedBy(), TextSignalEntity.SOURCE_JOURNAL, entry.getId(), entry.getOccurredOn(), entry.getText()));
    } catch (Exception e) { log.warn("Text signal extraction failed for journal entry {}", event.entryId(), e); }
}
// onGratitudeEntrySaved: same with GratitudeEntryRepository / SOURCE_GRATITUDE
// onJournalEntryDeleted / onGratitudeEntryDeleted: textSignalService.suppress(ownerId, kind, id)
//   — the deleted event carries only the id; resolve the owner by reading the (soft-deleted)
//   signal rows: add TextSignalRepository.findBySourceKindAndSourceIdAndDeletedFalse(String, UUID)
//   and delete those rows (no owner needed for a soft delete keyed by source id).
```

- [ ] **Step 12: Run the listener IT → PASS; write the switch-off IT; commit**

`TextSignalListenerSwitchOffIT`: `@TestPropertySource(properties = "mezo.companion.reflection.enabled=false")`,
assert `context.getBeanProvider(TextSignalListener.class).getIfAvailable()` is null (the
`PatternDetectionJobSwitchOffIT` shape).

```bash
git add -A backend
git commit -m "feat(companion): text signal listener + memory_item people/topics enrichment (mezo-eq85.1)"
```

- [ ] **Step 13: Write the failing series IT**

`TextSignalSeriesIT.java`:

```java
@ActiveProfiles("companion-fake")
class TextSignalSeriesIT extends AbstractIntegrationTest {
    @Autowired private MetricSeriesService metricSeriesService;
    @Autowired private DerivedSeriesService derivedSeriesService;
    @Autowired private TextSignalPopulator textSignalPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testTextMood_shouldAverageSureSignalsPerDay_andSkipUnsure() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate d = LocalDate.now().minusDays(2);
        textSignalPopulator.signal(owner, "journal_entry", UUID.randomUUID(), d, 4, 3, 2, List.of("Anna"), List.of("sport"));
        textSignalPopulator.signal(owner, "gratitude", UUID.randomUUID(), d, 2, null, null, List.of(), List.of());
        TextSignalEntity unsure = textSignalPopulator.signal(owner, "journal_entry", UUID.randomUUID(), d, 5, 5, 5, List.of(), List.of());
        unsure.setConfidence("unsure"); textSignalPopulator.save(unsure);
        Map<LocalDate, Double> mood = metricSeriesService.series(owner, MetricKey.TEXT_MOOD, d, d);
        assertThat(mood).containsEntry(d, 3.0);
        assertThat(metricSeriesService.series(owner, MetricKey.TEXT_SOCIAL_CONTACT, d, d)).containsEntry(d, 1.0);
    }

    @Test
    void testDerivedPeopleSeries_shouldBeBinaryOnDaysWithAnySignal() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate a = LocalDate.now().minusDays(3), b = LocalDate.now().minusDays(2);
        textSignalPopulator.signal(owner, "journal_entry", UUID.randomUUID(), a, 3, 3, 3, List.of("Anna"), List.of());
        textSignalPopulator.signal(owner, "journal_entry", UUID.randomUUID(), b, 3, 3, 3, List.of(), List.of("munka"));
        Map<LocalDate, Double> anna = derivedSeriesService.series(owner, "people:anna", a, b);
        assertThat(anna).containsEntry(a, 1.0).containsEntry(b, 0.0);
        assertThat(derivedSeriesService.series(owner, "topic:munka", a, b)).containsEntry(a, 0.0).containsEntry(b, 1.0);
        assertThat(derivedSeriesService.series(owner, "sleep-duration-h", a, b)).isEmpty(); // MetricKey delegation, no sleep seeded
        assertThat(derivedSeriesService.valueKindOf("people:anna")).isEqualTo(MetricValueKind.BINARY);
        assertThat(derivedSeriesService.isKnown(owner, "people:anna")).isTrue();
        assertThat(derivedSeriesService.isKnown(owner, "people:senki")).isFalse();
        assertThat(derivedSeriesService.isKnown(owner, "nincs-ilyen")).isFalse();
    }

    @Test
    void testNewerVersion_shouldWinPerSource() { /* two versions of one source on one day: mood 2 (v1) and 4 (v2) ⇒ series value 4.0 */ }
}
```

- [ ] **Step 14: Run → FAIL; implement the series services and MetricKey entries**

`MetricKey` additions (after `COMBINED_LOAD_MIN`):

```java
TEXT_MOOD("hangulat (szöveg)", "Napló- és hála-bejegyzések (LLM-jel)", MetricDomain.MIND),
TEXT_ENERGY("energia (szöveg)", "Napló- és hála-bejegyzések (LLM-jel)", MetricDomain.MIND),
TEXT_STRESS("feszültség (szöveg)", "Napló- és hála-bejegyzések (LLM-jel)", MetricDomain.MIND),
TEXT_SOCIAL_CONTACT("társas nap (szöveg)", "Napló- és hála-bejegyzések (LLM-jel)", MetricDomain.MIND, MetricValueKind.BINARY);
```

`TextSignalSeriesService.java` (`@Service`, gated on `COMPANION_SWITCH` + `REFLECTION_SWITCH`):

```java
public enum Field { MOOD, ENERGY, STRESS }
/** Newest version per (sourceKind, sourceId), sure rows only, mean per day. */
public Map<LocalDate, Double> numeric(UUID userId, Field field, LocalDate from, LocalDate to) {
    Map<LocalDate, List<Double>> perDay = new HashMap<>();
    for (TextSignalEntity s : newestPerSource(userId, from, to)) {
        Integer v = switch (field) { case MOOD -> s.getMood(); case ENERGY -> s.getEnergy(); case STRESS -> s.getStress(); };
        if (s.isSure() && v != null) { perDay.computeIfAbsent(s.getOccurredOn(), d -> new ArrayList<>()).add(v.doubleValue()); }
    }
    Map<LocalDate, Double> out = new HashMap<>();
    perDay.forEach((d, vs) -> out.put(d, vs.stream().mapToDouble(Double::doubleValue).average().orElse(0)));
    return out;
}
/** 1.0 on a day with any person mentioned, 0.0 on a day with signals but no person, absent otherwise. */
public Map<LocalDate, Double> socialContact(UUID userId, LocalDate from, LocalDate to) { ... }
/** Package-visible for DerivedSeriesService. */
List<TextSignalEntity> newestPerSource(UUID userId, LocalDate from, LocalDate to) {
    Map<String, TextSignalEntity> newest = new LinkedHashMap<>();
    for (TextSignalEntity s : textSignalRepository.findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnAscVersionDesc(userId, from, to)) {
        newest.putIfAbsent(s.getSourceKind() + ':' + s.getSourceId(), s); // first seen = highest version
    }
    return List.copyOf(newest.values());
}
```

`MetricSeriesService.series(...)` switch: `case TEXT_MOOD -> textSignalSeries(userId, Field.MOOD, from, to)` etc., where the private helper returns `Map.of()` when `ObjectProvider<TextSignalSeriesService>.getIfAvailable()` is null (reflection switched off ⇒ the metric has no data, the monitor shows it as `no_data`).

`DerivedSeriesService.java`:

```java
public static final String PEOPLE_PREFIX = "people:";
public static final String TOPIC_PREFIX = "topic:";
public Map<LocalDate, Double> series(UUID userId, String key, LocalDate from, LocalDate to) {
    if (key.startsWith(PEOPLE_PREFIX)) { return presence(userId, from, to, s -> s.getPeople().stream().anyMatch(p -> p.equalsIgnoreCase(key.substring(PEOPLE_PREFIX.length())))); }
    if (key.startsWith(TOPIC_PREFIX)) { return presence(userId, from, to, s -> s.getTopics().contains(key.substring(TOPIC_PREFIX.length()).toLowerCase(Locale.ROOT))); }
    return metricKey(key).map(k -> metricSeriesService.series(userId, k, from, to)).orElse(Map.of());
}
public MetricValueKind valueKindOf(String key) { return key.startsWith(PEOPLE_PREFIX) || key.startsWith(TOPIC_PREFIX) ? MetricValueKind.BINARY : metricKey(key).map(MetricKey::valueKind).orElse(MetricValueKind.NUMBER); }
public String labelOf(String key) { people: → "„<Name>” a szövegeidben", topic: → "<téma> téma", MetricKey → labelHu(), unknown → key }
/** people:/topic: keys are known when at least one signal of the last 180 days carries them; metric keys when the wire key resolves. */
public boolean isKnown(UUID userId, String key) { ... }
public static Optional<MetricKey> metricKey(String wireKey) { return Arrays.stream(MetricKey.values()).filter(k -> k.wireKey().equals(wireKey)).findFirst(); }
private Map<LocalDate, Double> presence(UUID userId, LocalDate from, LocalDate to, Predicate<TextSignalEntity> match) {
    Map<LocalDate, Double> out = new HashMap<>();
    for (TextSignalEntity s : textSignalSeriesService.newestPerSource(userId, from, to)) {
        out.merge(s.getOccurredOn(), match.test(s) ? 1.0 : 0.0, Math::max);
    }
    return out;
}
```

`ChatDaySignalService.extractDay(userId, day)`: join the day's `ROLE_USER` turns
(`AiMessageRepository.findByCreatedByAndRoleAndDeletedFalseAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtAsc(userId, "user", dayStart, dayEnd)`)
with `"\n"`; empty ⇒ `Optional.empty()`; else `textSignalService.record(userId, SOURCE_CHAT_DAY, uuidV5OfDay(userId, day), day, joined)` where `uuidV5OfDay` is
`UUID.nameUUIDFromBytes((userId + ":" + day).getBytes(UTF_8))` (stable per user+day, so an
edited day re-versions). `TextSignalCatchUpService.catchUp(userId, today)`: for the last
`catchUpDays` finished days, every journal/gratitude row whose newest signal is missing or whose
hash differs ⇒ `record(...)`; plus `chatDaySignalService.extractDay` for each day without a
`chat_day` signal; returns the count of rows written. Both are called by the job in Task 2.

- [ ] **Step 15: Run the series IT → PASS; run ArchitectureTest; docs; commit**

Run: `cd backend && ./mvnw test -Dtest='TextSignalSeriesIT,TextSignalListenerIT,TextSignalListenerSwitchOffIT,TextSignalExtractorTest,ArchitectureTest' -Dmezo.test.use-testcontainers=true -q`

Docs: `docs/features/companion.md` — new subsection "Reflexió S1 — text signals (`mezo-eq85.1`)"
under §1 (what a signal is, the four keys, the enrichment, the catch-up), the `text_signal`
table under §4, `ReflectionProperties` keys under the config section, the four tests under §8.
`node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs --errors-only`.

```bash
git add -A
git commit -m "feat(companion): text signal series, four TEXT_* metric keys, derived people/topic series (mezo-eq85.1)"
```

Push, self-PR, CI green, `--no-ff` merge, `bd close mezo-eq85.1`.

---

### Task 2: Hypothesis lifecycle on the `pattern` table and the nightly `ReflectionJob` (`mezo-eq85.2`)

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609071100_mezo-eq85.2_pattern_reflection_lifecycle.sql` + master entry
- Create: `.../companion/entity/TestPlanEnvelope.java`
- Modify: `.../companion/entity/PatternEntity.java`, `PatternEventEntity.java`, `PatternEventPayloadEnvelope.java`
- Modify: `.../companion/service/PatternGate.java` (public), `PatternService.java` (`applyEngineConfirm`), `HypothesisPipelineService.java` (`run(userId, extraContext)`), `PatternDetectionService.java` (stamp `testPlan` on statistical rows)
- Delete: `.../companion/service/HypothesisJob.java`; remove `FeaturesConfiguration.HYPOTHESIS_JOB_SWITCH`, yml `hypothesis-job` and `hypotheses.cron`
- Create: `.../companion/reflection/service/HypothesisLifecycle.java`, `HypothesisEvaluationService.java`, `ReflectionJob.java`
- Modify: `api/feature/companion/companion.yml` (`PatternResponse`, `PatternEventResponse`), regenerate
- Modify: `.../companion/mapper/CompanionMapper.java`
- Modify: `frontend/src/data/types.ts`, `frontend/src/data/insights/patternsApi.ts`, `patternDetailApi.ts`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/PatternPopulator.java`
- Test: `.../feature/companion/reflection/HypothesisLifecycleTest.java`, `HypothesisEvaluationServiceIT.java`, `ReflectionJobSwitchOffIT.java`, `ReflectionJobIT.java`

**Interfaces:**
- Consumes: Task 1 (`DerivedSeriesService.series/valueKindOf`, `TextSignalCatchUpService.catchUp`, `ChatDaySignalService.extractDay`, `ReflectionProperties`); `PatternGate.evaluate(seriesA, seriesB, lagDays, minN, minGroupN, MetricValueKind) → Outcome(verdict, alignedDays, PearsonCorrelation.Result result, ...)` with `result.r()`, `result.p()`.
- Produces:
  - `TestPlanEnvelope(String seriesA, String seriesB, int lagDays, String expectedDirection, int minN, int minGroupN, int windowDays)` with `canonical()` and `static String key(TestPlanEnvelope)` → `"ref-" + 8 hex`.
  - `PatternEntity`: `KIND_REFLECTION = "reflection"`, `STATUS_REFUTED = "refuted"`, `STATUS_DORMANT = "dormant"`, fields `hypothesisKey`, `testPlan`, `belief (BigDecimal)`, `evidenceHits`, `evidenceMisses`, `origin`; `ORIGIN_PAIR_CATALOG/WEEKLY_HYPOTHESIS/QUICK_NOTICE/NIGHTLY_REFLECTION`.
  - `PatternEventEntity`: `KIND_OBSERVATION`, `KIND_EVIDENCE`, `KIND_USER_REPLY`, `KIND_REVISED`, `KIND_REFUTED`, `KIND_DORMANT`.
  - `PatternEventPayloadEnvelope` trailing components `Boolean hit, String verdict, String channel, String choice, String text, List<String> evidenceRefs, Boolean surfaced` + factories `evidence(r, n, p, verdict, hit)`, `observation(text, evidenceRefs, surfaced)`, `userReply(channel, choice, text)`, `revised(text)`.
  - `HypothesisLifecycle.Decision decide(String status, Verdict verdict, boolean hit, int hitStreak, int missStreak, int positiveReplies, int negativeReplies, long daysWithoutData, ReflectionProperties.Lifecycle cfg)` → `record Decision(String newStatus, String eventKind)` or `Decision.NONE`; `static double belief(Double r, Double p, int positive, int negative, int hits, int misses, Lifecycle cfg)`.
  - `HypothesisEvaluationService.evaluate(UUID userId, LocalDate today) → int` (rows evaluated).
  - `PatternService.applyEngineConfirm(UUID userId, PatternEntity pattern)`.
  - `HypothesisPipelineService.run(UUID userId, String extraContext) → int`.
  - `ReflectionJob` (03:40), bean-gated on `COMPANION_SWITCH` + `REFLECTION_JOB_SWITCH`.
  - Contract: `PatternResponse` gains `hypothesisKey`, `testPlan {seriesA, seriesB, seriesALabel, seriesBLabel, lagDays, expectedDirection, minN, windowDays}` (nullable), `belief` (nullable), `evidenceHits`, `evidenceMisses`, `origin` (nullable); `kind` pattern `^(statistical|ai_hypothesis|reflection)$`; `status` pattern `^(proposed|monitoring|confirmed|rejected|refuted|dormant)$`. `PatternEventResponse` gains `hit`, `verdict`, `channel`, `choice`, `text` (all nullable); `kind` pattern widened with the six new kinds.
  - FE: `PatternRowStatus` adds `'refuted' | 'dormant'`; `Pattern.kind` adds `'reflection'`; `Pattern` gains `hypothesisKey?`, `testPlan?`, `belief?`, `evidenceHits`, `evidenceMisses`, `origin?`; `PatternEventKind` adds the six kinds; `PatternEvent` gains `hit?`, `verdict?`, `channel?`, `choice?`, `text?`.

- [ ] **Step 1: Migration**

```sql
-- Reflexió S2 (bd mezo-eq85.2, spec 2026-09-06 §4.2–4.3): one lifecycle for every pattern kind.
ALTER TABLE pattern DROP CONSTRAINT ck_pattern_kind;
ALTER TABLE pattern ADD CONSTRAINT ck_pattern_kind CHECK (kind IN ('statistical', 'ai_hypothesis', 'reflection'));
ALTER TABLE pattern DROP CONSTRAINT ck_pattern_status;
ALTER TABLE pattern ADD CONSTRAINT ck_pattern_status CHECK (status IN ('proposed', 'monitoring', 'confirmed', 'rejected', 'refuted', 'dormant'));
ALTER TABLE pattern
    ADD COLUMN hypothesis_key   varchar(80),
    ADD COLUMN test_plan        jsonb,
    ADD COLUMN belief           numeric(4,3),
    ADD COLUMN evidence_hits    integer not null default 0,
    ADD COLUMN evidence_misses  integer not null default 0,
    ADD COLUMN origin           varchar(24);
ALTER TABLE pattern ADD CONSTRAINT ck_pattern_origin CHECK (origin IS NULL OR origin IN ('pair_catalog', 'weekly_hypothesis', 'quick_notice', 'nightly_reflection'));
CREATE UNIQUE INDEX uq_pattern_created_by_hypothesis_key ON pattern (created_by, hypothesis_key) WHERE hypothesis_key IS NOT NULL AND is_deleted = false;
ALTER TABLE pattern_event DROP CONSTRAINT ck_pattern_event_kind;
ALTER TABLE pattern_event ADD CONSTRAINT ck_pattern_event_kind CHECK (kind IN ('snapshot', 'confirmed', 'monitoring', 'rejected', 'reinforced', 'promoted', 'observation', 'evidence', 'user_reply', 'revised', 'refuted', 'dormant'));
```

(Check the existing constraint names in `PatternEntity`'s javadoc — `ck_pattern_kind`,
`ck_pattern_status`, `ck_pattern_event_kind` — and in the original `create table pattern`
migration before writing the DROPs.) Register in `1.0.0_master.yml`.

- [ ] **Step 2: Entities and envelope**

`TestPlanEnvelope.java` (companion.entity):

```java
public record TestPlanEnvelope(String seriesA, String seriesB, int lagDays, String expectedDirection,
                               int minN, int minGroupN, int windowDays) {
    public static final String DIRECTION_POSITIVE = "positive";
    public static final String DIRECTION_NEGATIVE = "negative";
    public String canonical() {
        return seriesA.toLowerCase(Locale.ROOT) + "|" + seriesB.toLowerCase(Locale.ROOT) + "|" + lagDays + "|" + expectedDirection;
    }
    /** Stable identity: rewording never changes it; a different test is a different hypothesis. */
    public static String key(TestPlanEnvelope plan) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(plan.canonical().getBytes(StandardCharsets.UTF_8));
            return "ref-" + HexFormat.of().formatHex(digest, 0, 4);
        } catch (Exception e) { throw new SystemRuntimeErrorException(SystemMessage.error("INTERNAL_ERROR").build()); }
    }
    public boolean directionMatches(double r) { return DIRECTION_NEGATIVE.equals(expectedDirection) ? r < 0 : r > 0; }
}
```

`PatternEntity`: widen both `@Pattern` regexes; add constants; add fields:

```java
@Size(max = 80) @Column(name = "hypothesis_key", length = 80) private String hypothesisKey;
@JdbcTypeCode(SqlTypes.JSON) @Column(name = "test_plan", columnDefinition = "jsonb") private TestPlanEnvelope testPlan;
@Column(precision = 4, scale = 3) private BigDecimal belief;
@NotNull @Column(name = "evidence_hits", nullable = false) private Integer evidenceHits = 0;
@NotNull @Column(name = "evidence_misses", nullable = false) private Integer evidenceMisses = 0;
@Pattern(regexp = "pair_catalog|weekly_hypothesis|quick_notice|nightly_reflection") @Column(length = 24) private String origin;
public boolean isUserFrozen() { return STATUS_CONFIRMED.equals(status) || STATUS_REJECTED.equals(status); }
```

`PatternEventEntity`: regex + six constants. `PatternEventPayloadEnvelope` becomes

```java
public record PatternEventPayloadEnvelope(Double r, Integer n, Double p, Integer reinforcementCount, UUID factId,
                                          Boolean hit, String verdict, String channel, String choice, String text,
                                          List<String> evidenceRefs, Boolean surfaced) {
    // keep the five existing factories delegating with nulls for the trailing components
    public static PatternEventPayloadEnvelope evidence(Double r, Integer n, Double p, String verdict, Boolean hit) { ... }
    public static PatternEventPayloadEnvelope observation(String text, List<String> evidenceRefs, boolean surfaced) { ... }
    public static PatternEventPayloadEnvelope userReply(String channel, String choice, String text) { ... }
    public static PatternEventPayloadEnvelope revised(String text) { ... }
}
```

Jackson deserializes older rows with the trailing components null (the S4/S5 precedent on
`CompanionMessageEnvelope`). Add `PatternRepository.findByCreatedByAndHypothesisKeyAndDeletedFalse(UUID, String)`
and `findByCreatedByAndStatusInAndDeletedFalse(UUID, Collection<String>)`, and
`PatternEventRepository.findTop10ByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(UUID, UUID, String)`
and `countByCreatedByAndPatternIdAndKindAndDeletedFalse(UUID, UUID, String)`.

`PatternPopulator`: add `reflection(UUID owner, TestPlanEnvelope plan, String status)` — kind
`reflection`, `pairKey = hypothesisKey = TestPlanEnvelope.key(plan)`, category `trigger`,
title `"Teszt: " + plan.seriesA() + " → " + plan.seriesB()`, `origin = nightly_reflection`,
`evidence` = one chip, `saveAndFlush`.

- [ ] **Step 3: Write the failing lifecycle unit test**

`HypothesisLifecycleTest.java`:

```java
class HypothesisLifecycleTest {
    private final ReflectionProperties.Lifecycle cfg = new ReflectionProperties.Lifecycle(3, 3, 30, 0.3, 0.15);

    @Test void proposedBecomesMonitoring_onStrongHit() {
        assertThat(HypothesisLifecycle.decide("proposed", PatternGate.Verdict.LIVE, true, 1, 0, 0, 0, 0, cfg))
            .isEqualTo(new HypothesisLifecycle.Decision("monitoring", "monitoring"));
    }
    @Test void monitoringBecomesConfirmed_onStreakAndPositiveReply() {
        assertThat(HypothesisLifecycle.decide("monitoring", PatternGate.Verdict.LIVE, true, 3, 0, 1, 0, 0, cfg).newStatus()).isEqualTo("confirmed");
    }
    @Test void monitoringStaysMonitoring_onStreakWithoutReply() {
        assertThat(HypothesisLifecycle.decide("monitoring", PatternGate.Verdict.LIVE, true, 3, 0, 0, 0, 0, cfg)).isEqualTo(HypothesisLifecycle.Decision.NONE);
    }
    @Test void refutedAfterMissStreak() {
        assertThat(HypothesisLifecycle.decide("monitoring", PatternGate.Verdict.LIVE, false, 0, 3, 0, 0, 0, cfg).newStatus()).isEqualTo("refuted");
    }
    @Test void refutedAfterTwoNegativeReplies() {
        assertThat(HypothesisLifecycle.decide("proposed", PatternGate.Verdict.FEW_DAYS, false, 0, 0, 0, 2, 0, cfg).newStatus()).isEqualTo("refuted");
    }
    @Test void dormantAfterThirtyDaysWithoutData() {
        assertThat(HypothesisLifecycle.decide("monitoring", PatternGate.Verdict.NO_DATA, false, 0, 0, 0, 0, 31, cfg).newStatus()).isEqualTo("dormant");
    }
    @Test void dormantRevivesOnData() {
        assertThat(HypothesisLifecycle.decide("dormant", PatternGate.Verdict.FEW_DAYS, false, 0, 0, 0, 0, 0, cfg).newStatus()).isEqualTo("proposed");
    }
    @Test void userFrozenNeverMoves() {
        assertThat(HypothesisLifecycle.decide("confirmed", PatternGate.Verdict.LIVE, false, 0, 5, 0, 5, 0, cfg)).isEqualTo(HypothesisLifecycle.Decision.NONE);
        assertThat(HypothesisLifecycle.decide("rejected", PatternGate.Verdict.LIVE, true, 5, 0, 5, 0, 0, cfg)).isEqualTo(HypothesisLifecycle.Decision.NONE);
    }
    @Test void belief_isBoundedAndMonotone() {
        double weak = HypothesisLifecycle.belief(0.1, 0.6, 0, 0, 0, 0, cfg);
        double strong = HypothesisLifecycle.belief(0.6, 0.01, 2, 0, 5, 0, cfg);
        assertThat(weak).isBetween(0.0, 1.0); assertThat(strong).isBetween(0.0, 1.0); assertThat(strong).isGreaterThan(weak);
        assertThat(HypothesisLifecycle.belief(null, null, 0, 0, 0, 0, cfg)).isEqualTo(0.0);
    }
    @Test void keyIsStableAcrossRewording() {
        TestPlanEnvelope a = new TestPlanEnvelope("people:Anna", "sleep-duration-h", 1, "positive", 8, 3, 60);
        TestPlanEnvelope b = new TestPlanEnvelope("people:anna", "sleep-duration-h", 1, "positive", 8, 3, 60);
        assertThat(TestPlanEnvelope.key(a)).isEqualTo(TestPlanEnvelope.key(b)).startsWith("ref-");
    }
}
```

- [ ] **Step 4: Run → FAIL; implement `HypothesisLifecycle`**

```java
public final class HypothesisLifecycle {
    public record Decision(String newStatus, String eventKind) { public static final Decision NONE = new Decision(null, null); }
    private HypothesisLifecycle() {}

    public static Decision decide(String status, PatternGate.Verdict verdict, boolean hit, int hitStreak, int missStreak,
                                  int positiveReplies, int negativeReplies, long daysWithoutData, ReflectionProperties.Lifecycle cfg) {
        if (PatternEntity.STATUS_CONFIRMED.equals(status) || PatternEntity.STATUS_REJECTED.equals(status)) { return Decision.NONE; }
        if (negativeReplies >= 2) { return new Decision(PatternEntity.STATUS_REFUTED, PatternEventEntity.KIND_REFUTED); }
        if (PatternEntity.STATUS_DORMANT.equals(status)) {
            return verdict == PatternGate.Verdict.NO_DATA ? Decision.NONE : new Decision(PatternEntity.STATUS_PROPOSED, PatternEventEntity.KIND_MONITORING);
        }
        if (verdict == PatternGate.Verdict.NO_DATA && daysWithoutData > cfg.dormantAfterDays()) {
            return new Decision(PatternEntity.STATUS_DORMANT, PatternEventEntity.KIND_DORMANT);
        }
        if (verdict != PatternGate.Verdict.LIVE) { return Decision.NONE; }
        if (missStreak >= cfg.refuteStreak()) { return new Decision(PatternEntity.STATUS_REFUTED, PatternEventEntity.KIND_REFUTED); }
        if (PatternEntity.STATUS_PROPOSED.equals(status) && hit) { return new Decision(PatternEntity.STATUS_MONITORING, PatternEventEntity.KIND_MONITORING); }
        if (PatternEntity.STATUS_MONITORING.equals(status) && hitStreak >= cfg.confirmStreak() && positiveReplies >= 1) {
            return new Decision(PatternEntity.STATUS_CONFIRMED, PatternEventEntity.KIND_CONFIRMED);
        }
        return Decision.NONE;
    }

    /** 0.5·gate + 0.3·replies + 0.2·streak; every term in [0,1]. Code constants (spec §4.3). */
    public static double belief(Double r, Double p, int positive, int negative, int hits, int misses, ReflectionProperties.Lifecycle cfg) {
        double gate = 0.0;
        if (r != null && p != null) {
            double strength = Math.min(1.0, Math.abs(r) / (2 * cfg.strongR()));
            double significance = p <= cfg.strongP() ? 1.0 : Math.max(0.0, 1.0 - (p - cfg.strongP()) / (1.0 - cfg.strongP()));
            gate = 0.5 * strength + 0.5 * significance;
        }
        double user = (positive + negative) == 0 ? 0.0 : Math.max(0.0, (double) (positive - negative) / (positive + negative + 1));
        double streak = (hits + misses) == 0 ? 0.0 : (double) hits / (hits + misses + 1);
        return Math.clamp(0.5 * gate + 0.3 * user + 0.2 * streak, 0.0, 1.0);
    }
}
```

Make `PatternGate`, `PatternGate.Verdict`, `PatternGate.Outcome` and `PatternGate.evaluate`/`window`
`public` (no behaviour change; add one line to the class javadoc).

- [ ] **Step 5: Run the unit test → PASS; commit**

```bash
git commit -am "feat(companion): pattern lifecycle columns, TestPlanEnvelope, pure HypothesisLifecycle (mezo-eq85.2)"
```

- [ ] **Step 6: Write the failing evaluation IT**

`HypothesisEvaluationServiceIT.java` — seeds 10 finished days: on even days a `journal_entry`
signal mentioning `Anna` and a sleep log of 8.0 h the next day; on odd days no person and 6.0 h;
plan `people:anna → sleep-duration-h`, lag 1, positive, minN 8, minGroupN 3, window 60.

```java
@Test void testEvaluate_shouldAppendEvidenceAndMoveProposedToMonitoring_onStrongHit() {
    PatternEntity row = patternPopulator.reflection(owner, PLAN, "proposed");
    seedAnnaSleepDays(owner, 10);
    assertThat(evaluationService.evaluate(owner, LocalDate.now())).isEqualTo(1);
    PatternEntity after = patternRepository.findById(row.getId()).orElseThrow();
    assertThat(after.getStatus()).isEqualTo("monitoring");
    assertThat(after.getEvidenceHits()).isEqualTo(1);
    assertThat(after.getBelief()).isNotNull();
    List<PatternEventEntity> events = patternEventRepository.findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, row.getId());
    assertThat(events).extracting(PatternEventEntity::getKind).containsExactly("evidence", "monitoring");
    assertThat(events.get(0).getPayload().hit()).isTrue();
    assertThat(events.get(0).getPayload().verdict()).isEqualTo("LIVE");
}
@Test void testEvaluate_shouldConfirmAndPromote_afterThreeHitsAndOnePositiveReply() {
    // seed row monitoring + a user_reply(chip, watch) event; call evaluate three times with today, today+1, today+2
    // (the window still contains the seeded days) ⇒ status confirmed, promotedFactId set, knowledge_fact source=pattern exists
}
@Test void testEvaluate_shouldRefute_afterThreeMisses() { /* seed uncorrelated data (random 6–8 h regardless of Anna) ⇒ three evaluations ⇒ refuted, 'refuted' event */ }
@Test void testEvaluate_shouldSkipUserFrozenRows() { /* status rejected ⇒ evaluate returns 0, no events */ }
@Test void testEvaluate_shouldGoDormant_whenNoDataForLongerThanConfigured() {
    // row created 31 days ago (set createdAt via populator/save), no signals ⇒ dormant + 'dormant' event
}
```

- [ ] **Step 7: Run → FAIL; implement `HypothesisEvaluationService`**

```java
@Slf4j @Service @RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH}, havingValue = "true")
public class HypothesisEvaluationService {
    private final PatternRepository patternRepository;
    private final PatternEventRepository patternEventRepository;
    private final DerivedSeriesService derivedSeriesService;
    private final PatternService patternService;
    private final ReflectionProperties properties;

    /** Evaluates every open row with a test plan; each row in its own transaction so one failure cannot poison the run. */
    public int evaluate(UUID userId, LocalDate today) {
        List<PatternEntity> open = patternRepository.findByCreatedByAndStatusInAndDeletedFalse(userId,
            List.of(PatternEntity.STATUS_PROPOSED, PatternEntity.STATUS_MONITORING, PatternEntity.STATUS_DORMANT));
        int evaluated = 0;
        for (PatternEntity row : open) {
            if (row.getTestPlan() == null || PatternEntity.KIND_STATISTICAL.equals(row.getKind())) { continue; }
            try { evaluateOne(userId, row.getId(), today); evaluated++; }
            catch (Exception e) { log.warn("Hypothesis evaluation failed for {} of user {}", row.getId(), userId, e); }
        }
        return evaluated;
    }

    @Transactional
    void evaluateOne(UUID userId, UUID patternId, LocalDate today) {
        PatternEntity row = patternRepository.findByIdAndCreatedByAndDeletedFalse(patternId, userId).orElseThrow();
        TestPlanEnvelope plan = row.getTestPlan();
        LocalDate to = today.minusDays(1);
        LocalDate from = to.minusDays(plan.windowDays() - 1L);
        Map<LocalDate, Double> a = derivedSeriesService.series(userId, plan.seriesA(), from, to);
        Map<LocalDate, Double> b = derivedSeriesService.series(userId, plan.seriesB(), from, to.plusDays(plan.lagDays()));
        PatternGate.Outcome outcome = PatternGate.evaluate(a, b, plan.lagDays(), plan.minN(), plan.minGroupN(), derivedSeriesService.valueKindOf(plan.seriesA()));
        Double r = outcome.result() == null ? null : outcome.result().r();
        Double p = outcome.result() == null ? null : outcome.result().p();
        boolean strong = r != null && Math.abs(r) >= properties.lifecycle().strongR() && p <= properties.lifecycle().strongP();
        boolean live = outcome.verdict() == PatternGate.Verdict.LIVE;
        boolean hit = live && strong && plan.directionMatches(r);
        if (live) { if (hit) row.setEvidenceHits(row.getEvidenceHits() + 1); else row.setEvidenceMisses(row.getEvidenceMisses() + 1); }
        record(row, PatternEventEntity.KIND_EVIDENCE, PatternEventPayloadEnvelope.evidence(r, outcome.alignedDays(), p, outcome.verdict().name(), live ? hit : null));
        int hitStreak = streak(userId, row.getId(), true), missStreak = streak(userId, row.getId(), false);
        int positive = replies(userId, row.getId(), true), negative = replies(userId, row.getId(), false);
        long daysWithoutData = outcome.verdict() == PatternGate.Verdict.NO_DATA ? ChronoUnit.DAYS.between(lastDataDay(userId, row.getId(), row.getCreatedAt()), today) : 0;
        row.setBelief(BigDecimal.valueOf(HypothesisLifecycle.belief(r, p, positive, negative, row.getEvidenceHits(), row.getEvidenceMisses(), properties.lifecycle())).setScale(3, RoundingMode.HALF_UP));
        row.setLastDetectedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        HypothesisLifecycle.Decision d = HypothesisLifecycle.decide(row.getStatus(), outcome.verdict(), hit, hitStreak, missStreak, positive, negative, daysWithoutData, properties.lifecycle());
        if (d.newStatus() != null) {
            if (PatternEntity.STATUS_CONFIRMED.equals(d.newStatus())) { patternService.applyEngineConfirm(userId, row); }
            else { row.setStatus(d.newStatus()); record(row, d.eventKind(), PatternEventPayloadEnvelope.empty()); }
        }
        patternRepository.saveAndFlush(row);
    }
    private int streak(UUID userId, UUID patternId, boolean wantHit) {
        int streak = 0;
        for (PatternEventEntity e : patternEventRepository.findTop10ByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(userId, patternId, PatternEventEntity.KIND_EVIDENCE)) {
            Boolean hit = e.getPayload().hit();
            if (hit == null || hit != wantHit) { break; }
            streak++;
        }
        return streak;
    }
    private int replies(UUID userId, UUID patternId, boolean positive) {
        Set<String> choices = positive ? Set.of("watch", "confirm") : Set.of("reject");
        return (int) patternEventRepository.findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(userId, patternId).stream()
            .filter(e -> PatternEventEntity.KIND_USER_REPLY.equals(e.getKind()))
            .filter(e -> e.getPayload().choice() != null && choices.contains(e.getPayload().choice()))
            .count();
    }
    private LocalDate lastDataDay(UUID userId, UUID patternId, Instant createdAt) {
        return patternEventRepository.findTop10ByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(userId, patternId, PatternEventEntity.KIND_EVIDENCE).stream()
            .filter(e -> !PatternGate.Verdict.NO_DATA.name().equals(e.getPayload().verdict()))
            .map(e -> e.getOccurredAt().atZone(ZoneId.systemDefault()).toLocalDate())
            .findFirst()
            .orElse(createdAt.atZone(ZoneId.systemDefault()).toLocalDate());
    }
    private void record(PatternEntity row, String kind, PatternEventPayloadEnvelope payload) {
        PatternEventEntity event = new PatternEventEntity();
        event.setCreatedBy(row.getCreatedBy()); event.setPatternId(row.getId()); event.setKind(kind); event.setPayload(payload);
        patternEventRepository.saveAndFlush(event);
    }
}
```

`PatternService.applyEngineConfirm(UUID userId, PatternEntity pattern)`: set status
`confirmed`, record `confirmed` event, promote if `promotedFactId == null` (+ `promoted`
event), publish `PatternConfirmedEvent` — the body of `decide`'s confirm branch extracted into
this method and called from `decide` too, so both paths stay identical.

`PatternDetectionService.upsert`: when a statistical row is created or refreshed and
`testPlan == null`, set `testPlan = new TestPlanEnvelope(pair.metricA().wireKey(), pair.metricB().wireKey(), pair.lagDays(), pair.expectedDirection(), config.minN(), config.minGroupN(), config.lookbackDays())`,
`hypothesisKey = "pair:" + pair.key()`, `origin = pair_catalog` (display only — the nightly
Pearson job keeps evaluating these rows; `HypothesisEvaluationService` skips `statistical`).

- [ ] **Step 8: Run the evaluation IT → PASS; commit**

```bash
git add -A && git commit -m "feat(companion): nightly hypothesis evaluation → evidence events, belief, engine transitions (mezo-eq85.2)"
```

- [ ] **Step 9: `ReflectionJob` replaces `HypothesisJob`**

```java
@Slf4j @Component @RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_JOB_SWITCH}, havingValue = "true")
public class ReflectionJob {
    private final UserFanOut userFanOut;
    private final TextSignalCatchUpService catchUpService;
    private final ChatDaySignalService chatDaySignalService;
    private final HypothesisEvaluationService evaluationService;
    private final HypothesisPipelineService hypothesisPipelineService;

    @Scheduled(cron = "${mezo.companion.reflection.cron}")
    public void run() { runFor(LocalDate.now()); }

    /** Package-visible for ReflectionJobIT. Every step isolated per user. */
    void runFor(LocalDate today) {
        userFanOut.forEachActiveUser("Reflection", user -> {
            UUID userId = user.getId();
            step("catch-up", userId, () -> catchUpService.catchUp(userId, today));
            step("chat-day", userId, () -> chatDaySignalService.extractDay(userId, today.minusDays(1)));
            step("evaluate", userId, () -> evaluationService.evaluate(userId, today));
            step("propose", userId, () -> hypothesisPipelineService.run(userId, null));
        });
    }
    private void step(String name, UUID userId, Supplier<?> body) {
        try { Object out = body.get(); log.info("Reflection {} for user {}: {}", name, userId, out); }
        catch (Exception e) { log.warn("Reflection {} failed for user {}", name, userId, e); }
    }
}
```

`HypothesisPipelineService.run(UUID userId)` becomes `run(UUID userId, String extraContext)`
(appends `extraContext` to `gather`'s output when non-null; Task 3 fills it) and reads
`properties.reflection().propose().maxPerNight()` instead of `hypotheses().maxPerRun()` — inject
`ReflectionProperties`. Keep `Hypotheses.keepThreshold/reviseThreshold`; remove `Hypotheses.cron`
and `maxPerRun` from the record and yml. Delete `HypothesisJob.java`,
`FeaturesConfiguration.HYPOTHESIS_JOB_SWITCH`, the yml `hypothesis-job:` block; delete
`HypothesisJobSwitchOffIT` if present and any test referencing `HypothesisJob`
(`grep -rn HypothesisJob backend/src/test`). Write `ReflectionJobSwitchOffIT` (property
`mezo.techcore.cron.reflection-job.enabled=false` ⇒ no `ReflectionJob` bean) and
`ReflectionJobIT` (two users, one with a journal entry lacking a signal and one with an open
plan row: `runFor(today)` writes the missing signal and one evidence event; a scripted
`SIGNAL_FAIL` for user 1 does not stop user 2's evaluation).

- [ ] **Step 10: Contract widening + FE unions**

`companion.yml`: widen `PatternResponse.kind` / `status` patterns; add

```yaml
        hypothesisKey: { type: string, nullable: true, description: 'Stabil identitás a teszt-tervből (ref-…), a statisztikai sorokon pair:<key>.' }
        testPlan:
          allOf: [{ $ref: '#/components/schemas/PatternTestPlan' }]
          nullable: true
        belief: { type: number, format: double, nullable: true, description: 'Determinisztikus bizonyosság 0..1 (kapu + válaszok + sorozat) — sosem LLM-becslés.' }
        evidenceHits: { type: integer }
        evidenceMisses: { type: integer }
        origin: { type: string, nullable: true, pattern: '^(pair_catalog|weekly_hypothesis|quick_notice|nightly_reflection)$' }
    PatternTestPlan:
      type: object
      required: [seriesA, seriesB, seriesALabel, seriesBLabel, lagDays, expectedDirection, minN, windowDays]
      properties:
        seriesA: { type: string }
        seriesB: { type: string }
        seriesALabel: { type: string }
        seriesBLabel: { type: string }
        lagDays: { type: integer }
        expectedDirection: { type: string, pattern: '^(positive|negative)$' }
        minN: { type: integer }
        windowDays: { type: integer }
```

Add `evidenceHits`, `evidenceMisses` to `PatternResponse.required`. `PatternEventResponse`:
widen `kind`, add `hit: {type: boolean, nullable: true}`, `verdict`, `channel`, `choice`, `text`
(nullable strings). Regenerate. `CompanionMapper.toPatternResponse` maps the new fields
(labels via `DerivedSeriesService.labelOf` — inject through a `default` method parameter or a
small `PatternTestPlanMapper` component; MapStruct `@Mapper(uses = …)`), `toPatternEventResponse`
maps the five new payload fields. FE `types.ts`: widen `PatternRowStatus`, `Pattern.kind`,
`PatternEventKind`; add `PatternTestPlan` interface and the new optional fields to `Pattern` and
`PatternEvent`; `patternsApi.toPattern` and `patternDetailApi.toEvent` copy them. Run
`pnpm typecheck` (or `pnpm build`) — `lifecycle.ts`'s `bucketize` must still compile: map
`refuted` to the `noRelationship` bucket and `dormant` to `gathering` in the status switch
(rendering copy comes in Task 6).

- [ ] **Step 11: Verify, docs, commit, PR**

Run: `cd backend && ./mvnw test -Dtest='HypothesisLifecycleTest,HypothesisEvaluationServiceIT,ReflectionJobIT,ReflectionJobSwitchOffIT,PatternDetectionServiceIT,PatternServiceIT,CompanionPatternApiIT,CompanionPatternPairDetailApiIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true -q`
and `cd frontend && pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build`.

Docs: companion.md "Reflexió S2 — lifecycle (`mezo-eq85.2`)" (state diagram, belief formula,
retired `HypothesisJob`, the 03:40 slot), §4 columns, §8 tests; CODEMAP; lint.

```bash
git add -A && git commit -m "feat(companion): ReflectionJob (03:40) replaces the weekly HypothesisJob; contract carries test plan, belief, tallies (mezo-eq85.2)"
```

---

### Task 3: `REFLECTION` memory policy, test-plan-aware proposals, chat block and seeded conversations (`mezo-eq85.3`)

**Files:**
- Modify: `.../companion/memory/dto/ConsumerPolicy.java`, `config/MemoryPlatformProperties.java`, `service/MemoryContextService.java`, `service/LlmMemoryReranker.java`, `application.yml`
- Create: `.../companion/reflection/service/ReflectionMemoryGateway.java`, `TestPlanValidator.java`, `ReflectionPromptBlock.java`, `ReflectionReplyRecorder.java`
- Modify: `.../companion/service/HypothesisPipelineService.java`, `ChatService.java`, `ConversationService.java`, `.../companion/entity/AiConversationEntity.java`
- Create: `db/changelog/.../202609071200_mezo-eq85.3_ai_conversation_seed_pattern.sql` + master entry
- Modify: `api/feature/companion/companion.yml` (`CreateConversationRequest.seedPatternId`, `ConversationResponse.seedPatternId`), regenerate
- Modify: `.../companion/llm/FakeCompanionLlm.java` (hypothesis sentinel accepts `testPlan`)
- Modify: `docs/infrastructure/local-dev-testing.md`, `docs/features/companion.md`
- Test: `ReflectionMemoryGatewayIT`, `HypothesisPipelineTestPlanIT`, `ChatReflectionBlockIT`, `ChatSeedReplyIT`, `TestPlanValidatorTest`

**Interfaces:**
- Consumes: `MemoryContextService.retrieve(MemoryRequest)`, `MemoryRequest(userId, consumerPolicy, currentQuery, shortConversationHistory, asOf, maxTokenBudget, conversationId, deep)`, `MemoryContext.promptBlock()`; Task 2's `TestPlanEnvelope`, `PatternEntity` fields; Task 1's `DerivedSeriesService.isKnown/labelOf`; `MemoryRetrievalRunRepository` (audit assertions).
- Produces:
  - `ConsumerPolicy.REFLECTION`; `MemoryPlatformProperties.policies().reflection()` = `record ReflectionPolicy(int candidateLimit, int maxTokens, boolean rerank)`.
  - `ReflectionMemoryGateway.contextFor(UUID userId, String query, boolean deep) → String` (prompt block or `""`, never throws).
  - `TestPlanValidator.validate(UUID userId, RawTestPlan raw) → Optional<TestPlanEnvelope>` where `record RawTestPlan(String seriesA, String seriesB, Integer lagDays, String expectedDirection)`.
  - `HypothesisPipelineService`: proposal JSON gains `"testPlan"`; a valid plan ⇒ `kind=reflection`, `hypothesisKey=TestPlanEnvelope.key(plan)`, `origin=nightly_reflection`; no/invalid plan ⇒ `kind=ai_hypothesis` (qualitative) with the title-hash key as today. `run(userId, extraContext)` now builds `extraContext` itself from the gateway when the argument is null.
  - `ReflectionPromptBlock.render(UUID userId) → String` (`""` when nothing open).
  - `AiConversationEntity.seedPatternId (UUID, nullable)`; `CreateConversationRequest.seedPatternId`.
  - `ReflectionReplyRecorder.recordChatReply(UUID userId, UUID patternId, String text)` → appends `user_reply(channel="chat", choice=null, text)`.

- [ ] **Step 1: Policy + config**

`ConsumerPolicy`: add `REFLECTION`. `MemoryPlatformProperties`: add `@NotNull @Valid Policies policies` with `record Policies(@NotNull @Valid ReflectionPolicy reflection)` and `record ReflectionPolicy(@Min(1) @Max(100) int candidateLimit, @Min(60) @Max(6000) int maxTokens, boolean rerank)`. yml under `memory-platform:`:

```yaml
      policies:
        reflection:
          # Offline consumer (mezo-eq85): deeper, no latency gate, reranker allowed.
          candidate-limit: 30
          max-tokens: 800
          rerank: true
```

`MemoryContextService.retrieveCandidates`: candidate limit =
`request.consumerPolicy() == ConsumerPolicy.REFLECTION ? properties.policies().reflection().candidateLimit() : properties.serving().candidateLimit()`.
`boundedTokenBudget`: REFLECTION ⇒ `min(requested, policies.reflection().maxTokens())`.
`LlmMemoryReranker.shouldRerank`: the existing `deep || WEEKLY_MEMOIR` condition also passes for
`REFLECTION` when `properties.policies().reflection().rerank()`.

- [ ] **Step 2: Failing gateway IT, then the gateway**

`ReflectionMemoryGatewayIT` (`companion-fake` profile, seeds two `memory_item` rows + vectors via
`MemoryItemPopulator` the way `MemoryContextServiceIT` does):

```java
@Test void testContextFor_shouldReturnPromptBlockAndAuditReflectionPolicy() {
    String block = gateway.contextFor(owner, "Anna és az alvás", false);
    assertThat(block).isNotBlank();
    assertThat(runRepository.findAll()).anySatisfy(run -> {
        assertThat(run.getCreatedBy()).isEqualTo(owner);
        assertThat(run.getConsumerPolicy()).isEqualTo("REFLECTION");
    });
}
@Test void testContextFor_shouldReturnEmpty_whenEmbeddingFails() {
    // query contains FakeEmbeddingAdapter.FAIL_EMBED (the existing sentinel) ⇒ "" and no exception
}
```

(Read `MemoryRetrievalRunEntity` for the exact policy column getter.)

```java
@Slf4j @Service @RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH}, havingValue = "true")
public class ReflectionMemoryGateway {
    private final MemoryContextService memoryContextService;
    private final MemoryPlatformProperties properties;
    private final LlmCallContextHolder llmCallContextHolder;
    public String contextFor(UUID userId, String query, boolean deep) {
        if (query == null || query.isBlank()) { return ""; }
        try {
            MemoryRequest request = new MemoryRequest(userId, ConsumerPolicy.REFLECTION, query, List.of(), LocalDate.now(),
                properties.policies().reflection().maxTokens(), null, deep);
            MemoryContext context = llmCallContextHolder.runWith(
                new LlmCallContext("companion_reflection", "memory", null, null), () -> memoryContextService.retrieve(request));
            return context.promptBlock() == null ? "" : context.promptBlock();
        } catch (RuntimeException e) {
            log.warn("Reflection memory retrieval failed for user {} — continuing without memories", userId, e);
            return "";
        }
    }
}
```

- [ ] **Step 3: Failing validator unit test, then `TestPlanValidator`**

```java
class TestPlanValidatorTest {
    @Test void acceptsKnownKeys_andFillsGateDefaults()      // people:anna → sleep-duration-h, lag 1 ⇒ minN 8 / minGroupN 3 / windowDays 60 from CompanionProperties.patterns()
    @Test void rejectsUnknownSeries()                      // "nincs-ilyen" ⇒ empty
    @Test void rejectsSameSeriesBothSides()
    @Test void clampsLagToZeroThree_andDefaultsDirectionPositive()
}
```

Implementation: `@Service` holding `DerivedSeriesService` and `CompanionProperties`;
`validate(userId, raw)`: both keys non-blank and `derivedSeriesService.isKnown(userId, key)`,
`!seriesA.equalsIgnoreCase(seriesB)`, `lag = clamp(raw.lagDays() == null ? 0 : raw.lagDays(), 0, 3)`,
direction `negative` only when the raw says so, else `positive`; `minN/minGroupN/windowDays`
from `properties.patterns()`.

- [ ] **Step 4: Test-plan-aware pipeline (failing IT first)**

`HypothesisPipelineTestPlanIT`: seed a user with text signals mentioning Anna and sleep logs;
script the proposal with the existing `[[HYPOTHESES:…]]` sentinel (check its exact name in
`FakeCompanionLlm`) as
`[{"title":"Anna után jobban alszol","mechanism":"…","category":"trigger","testPlan":{"seriesA":"people:anna","seriesB":"sleep-duration-h","lagDays":1,"expectedDirection":"positive"}}]`;
assert one `pattern` row with `kind=reflection`, `hypothesisKey` starting `ref-`,
`testPlan.seriesA()=="people:anna"`, `origin=nightly_reflection`, `status=proposed`. Second test:
an unknown series ⇒ `kind=ai_hypothesis`, `testPlan` null. Third: re-running with a reworded
title and the same plan ⇒ still one row.

Pipeline changes: `Hypothesis` record gains `RawTestPlan testPlan`; `PROPOSE_PROMPT` lists the
available series (`MetricKey.values()` wire keys + the user's `people:`/`topic:` keys from the
last 30 days of signals, built by a `availableSeries(userId)` helper) and asks for the
`testPlan` object or `null`; `persist` branches on `testPlanValidator.validate(...)`;
`gather` appends `"\n\nEMLÉKEK (memória-platform):\n" + reflectionMemoryGateway.contextFor(userId, "tegnap: " + yesterdaySignalsDigest, true)`
when `extraContext == null`. Also append yesterday's signals digest and the open rows' state
(`title · status · hits/misses`) so the model does not re-propose what is already open. Notify
with `HYPOTHESIS_NEW` only for qualitative rows; reflection rows are surfaced by Task 4.

- [ ] **Step 5: Chat `[Észrevételek]` block (failing IT first)**

`ReflectionPromptBlock.render(userId)`: rows with `status ∈ {proposed, monitoring}` and
`kind ∈ {reflection, ai_hypothesis}`, newest 5 by `lastDetectedAt`:

```text
[Észrevételek — amit Mezo most figyel]
- Anna után jobban alszol (figyeljük · 4 bejött / 1 nem · bizonyosság 38%)
```

`ChatService.assembleSystemPrompt`: after `knowledgeFactService.renderNewPatternFactsBlock(userId)`
add `reflectionBlock(userId)` — `ObjectProvider<ReflectionPromptBlock>`, `""` when absent.
`ChatReflectionBlockIT`: send a message with an open reflection row seeded; assert the fake's
recorded system prompt contains `[Észrevételek` (find how `ChatServiceIT`/`CompanionStreamApiIT`
inspect the prompt — `FakeCompanionLlm` keeps the last system prompt for existing block tests;
reuse that accessor).

- [ ] **Step 6: Seeded conversation + chat reply capture (failing IT first)**

Migration: `ALTER TABLE ai_conversation ADD COLUMN seed_pattern_id uuid REFERENCES pattern (id) ON DELETE SET NULL;`
Entity field `seedPatternId`. Contract: `CreateConversationRequest.seedPatternId {type: string, format: uuid, nullable: true}`,
`ConversationResponse.seedPatternId` (nullable). `ConversationService.create`: when present,
verify ownership via `PatternRepository.findByIdAndCreatedByAndDeletedFalse` (404 otherwise),
set it, and title the conversation with the pattern title. `ChatService.sendMessage` (and the
stream variant): after the user message is persisted, if `conversation.getSeedPatternId() != null`
call `replyRecorder.getIfAvailable()`'s `recordChatReply(userId, seedPatternId, request.getContent())`
inside a try/catch (never fails the turn). `ChatSeedReplyIT`: create a seeded conversation, send
"nem Anna miatt, hanem mert szabadnapos voltam" ⇒ one `user_reply` event with `channel=chat`
and that text.

- [ ] **Step 7: Deployment note and verification**

`docs/infrastructure/local-dev-testing.md`, after the memory eval section, add:

```markdown
### Chat serving mode (mezo-eq85, product-owner decision 2026-09-06)

Chat serves from the unified memory platform when the environment sets
`MEZO_MEMORY_SERVING_MODE=NEW` (the yml default stays `SHADOW`). `NEW` falls back to the legacy
context on a total retriever outage (audited as `MEMORY_RETRIEVAL_ALL_FAILED_FALLBACK_OLD`).
Set it in the deployment environment, not in `application.yml`.
```

Run: `./mvnw test -Dtest='ReflectionMemoryGatewayIT,TestPlanValidatorTest,HypothesisPipelineTestPlanIT,ChatReflectionBlockIT,ChatSeedReplyIT,MemoryContextServiceIT,ChatServiceIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true -q`;
regenerate contract + FE types; `pnpm build`; docs (companion.md "Reflexió S3"); CODEMAP; lint.

```bash
git add -A && git commit -m "feat(companion): REFLECTION memory policy, test-plan proposals, [Észrevételek] chat block, seeded conversations (mezo-eq85.3)"
```

---

### Task 4: Quick notice, observation feed, chip replies, morning digest (`mezo-eq85.4`)

**Files:**
- Create: `.../companion/reflection/service/QuickNoticePreScreen.java`, `ObservationBudget.java`, `QuickNoticeService.java`, `ObservationFeedService.java`, `ReflectionReplyService.java`, `ReflectionDigestService.java`
- Create: `.../companion/reflection/controller/CompanionObservationController.java`
- Modify: `.../companion/reflection/service/TextSignalListener.java` (call the notice after a signal), `HypothesisPipelineService.java` (replies → `revised`)
- Modify: `.../appnotification/domain/AppNotificationKind.java`
- Modify: `.../proactive/service/CompanionMessageGenerator.java`
- Modify: `.../companion/llm/FakeCompanionLlm.java` (`NOTICE_MARKER`)
- Modify: `api/feature/companion/companion.yml` (tag `CompanionObservation`), regenerate
- Test: `QuickNoticePreScreenTest`, `ObservationBudgetTest`, `QuickNoticeServiceIT`, `CompanionObservationApiIT`, `ReflectionReplyServiceIT`, `ReflectionDigestMorningIT`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - `QuickNoticePreScreen.screen(TextSignalEntity signal, List<PatternEntity> open, List<TextSignalEntity> lastSevenDays) → Optional<Trigger>`; `record Trigger(Kind kind, List<UUID> patternIds, String person, String topic)`, `enum Kind { TOUCHES_OPEN, NEW_PERSON, EXTREME_MOOD, TOPIC_STREAK }`.
  - `ObservationBudget.allows(UUID userId, Instant now) → boolean`; `ObservationBudget.remainingToday(UUID userId, Instant now) → int`.
  - `QuickNoticeService.onSignal(UUID userId, UUID signalId)`.
  - `ObservationFeedService.forDay(UUID userId, LocalDate day) → List<ObservationResponse>`.
  - `ReflectionReplyService.reply(UUID userId, UUID patternId, String choice, String text) → PatternReplyResponse`.
  - `ReflectionDigestService.digestFor(UUID userId, LocalDate date) → Optional<String>`.
  - `AppNotificationKind.OBSERVATION_NEW("observation_new", "pattern", "/nap/uzenetek?tab=eszrevetelek")`.
  - Contract `GET /api/companion/observation?date=` → `ObservationResponse[]`:
    `{id (event or pattern uuid), patternId, hypothesisKey, card: fresh|return|watching|confirmed, occurredAt, title, text, question (nullable), evidence: string[], status, evidenceHits, evidenceMisses, minN, belief (nullable), repliedChoice (nullable), sourceIcon: naplo|alvas|edzes|vacsora|hold|mezo}`;
    `POST /api/companion/pattern/{patternId}/reply {choice: watch|reject|talk, text?}` → `PatternReplyResponse {pattern: PatternResponse, conversationId (nullable uuid)}`.

- [ ] **Step 1: Pre-screen (failing unit test, then code)**

```java
class QuickNoticePreScreenTest {
    @Test void touchesOpen_whenPersonOfAnOpenPlanAppears()   // open row plan people:anna, signal people [Anna] ⇒ TOUCHES_OPEN with that id
    @Test void newPerson_onThirdMentionWithinSevenDays()      // last7 has two Anna signals, current mentions Anna ⇒ NEW_PERSON("Anna")
    @Test void extremeMood_onlyWhenSure()                     // mood 5 sure ⇒ EXTREME_MOOD; mood 5 unsure ⇒ empty
    @Test void topicStreak_onFourConsecutiveDays()            // munka on the 3 previous days + today ⇒ TOPIC_STREAK("munka")
    @Test void empty_whenNothingSalient()
}
```

Rules are evaluated in that order; the first hit wins. `TOUCHES_OPEN` also matches when the
signal's day has data for a metric named in an open plan's `seriesB` — skip that in v1 (people
and topics only; a `MetricKey` plan is caught nightly).

- [ ] **Step 2: Budget (failing unit test, then code)**

`ObservationBudget` reads surfaced observations from `PatternEventRepository.findByCreatedByAndKindAndOccurredAtAfterAndDeletedFalse(userId, "observation", startOfToday)`
filtered on `payload.surfaced() == TRUE`; `allows` = `count < maxPerDay` ∧ `now − newest ≥ minGapHours` ∧ `now` not in `[quietFrom, quietTo)` (wrap over midnight). Unit-test with a stubbed repository.

- [ ] **Step 3: Quick notice service (failing IT, then code)**

`QuickNoticeServiceIT`: seed an open reflection row (plan `people:anna → sleep-duration-h`) and
save a journal entry mentioning Anna at 14:00 server time (freeze the clock through the
`Clock` bean if the app has one; otherwise choose the assertion that does not depend on quiet
hours by setting `quiet-from`/`quiet-to` to `23:59`/`00:00` in `@TestPropertySource`). Assert:
one `observation` event on that row with `surfaced=true`, `text` non-blank, `evidenceRefs`
containing the journal entry id; one `app_notification` of kind `observation_new`. Second test:
`max-per-day=0` ⇒ event exists with `surfaced=false`, no notification. Third: a scripted
`[[NOTICE:{"text":"…","question":"…","newTestPlan":{"seriesA":"topic:munka","seriesB":"text-mood","lagDays":0,"expectedDirection":"negative"}}]]`
on a signal with topic `munka` on its fourth day ⇒ a new `reflection` row (`origin=quick_notice`)
plus its observation event.

`QuickNoticeService.onSignal(userId, signalId)` (`@Transactional`):
1. load the signal, the open rows (`proposed|monitoring`), the last 7 days of signals; `preScreen.screen(...)`, empty ⇒ return.
2. `NOTICE_MARKER = "GYORS-ÉSZREVÉTEL"`; prompt: the entry text, the touched rows (`title · status · hits/misses · your last reply text if any`), the trigger kind, and `reflectionMemoryGateway.contextFor(userId, entryText, false)`; answer JSON `{"text":"1–2 mondat, Mezo hangján, tegező","question":"egy kérdés","hypothesisKey":"ref-…|null","newTestPlan":{…}|null,"evidenceRefs":["journal_entry:<uuid>","sleep:<date>"]}`; parse defensively.
3. Resolve the target row: `hypothesisKey` → existing row; else `testPlanValidator.validate` → new `reflection` row (`origin=quick_notice`, `status=proposed`, title = first sentence of `text` capped at 200, category `trigger`, `evidence` = refs); else use the first touched row; if none ⇒ return.
4. `surfaced = observationBudget.allows(userId, Instant.now())`; append `observation(text + "\n" + question, evidenceRefs, surfaced)`; if surfaced, `appNotificationEmitter.emit(userId, OBSERVATION_NEW, "Mezo észrevett valamit", text, deeplink, patternId, "observation_new:" + eventId)`.

`TextSignalListener`: after a successful `record(...)`, call `quickNoticeService.onSignal(owner, saved.getId())` inside the same try/catch (a notice failure is logged, the signal stays).

`FakeCompanionLlm`: `NOTICE_SENTINEL = [[NOTICE:(.*?)]]`; default answer
`{"text":"Feltűnt, hogy amikor Anna szerepel a naplódban, másnap többet alszol.","question":"Figyeljem tovább?","hypothesisKey":null,"newTestPlan":null,"evidenceRefs":[]}`.

- [ ] **Step 4: Observation feed + reply endpoint (failing API IT, then code)**

Contract fragment (tag `CompanionObservation`, new `CompanionObservationApi`):

```yaml
  /api/companion/observation:
    get:
      tags: [CompanionObservation]
      operationId: listObservations
      summary: Az Észrevételek fül kártyái egy napra (mezo-eq85.4)
      parameters:
        - { name: date, in: query, required: false, schema: { type: string, format: date } }
      responses:
        '200': { description: Cards, newest first, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/ObservationResponse' } } } } }
        '401': { description: Missing or invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/companion/pattern/{patternId}/reply:
    post:
      tags: [CompanionObservation]
      operationId: replyToPattern
      summary: Chip-válasz egy észrevételre — figyeld / nem stimmel / mesélj (mezo-eq85.4)
      parameters: [{ name: patternId, in: path, required: true, schema: { type: string, format: uuid } }]
      requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/PatternReplyRequest' } } } }
      responses:
        '200': { description: The pattern after the reply (+ the seeded conversation for talk), content: { application/json: { schema: { $ref: '#/components/schemas/PatternReplyResponse' } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing or invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Pattern not found (or owned by someone else), content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
```

Schemas `ObservationResponse` (fields per the Interfaces block; `card` pattern
`^(fresh|return|watching|confirmed)$`), `PatternReplyRequest {choice: pattern ^(watch|reject|talk)$, text: nullable string ≤ 500}`, `PatternReplyResponse`.

`ObservationFeedService.forDay(userId, day)` builds, in this order:
- **fresh**: `observation` events of `day` with `surfaced=true` whose row has no `user_reply` after the event; `text`/`question` split on the last `\n`; `id = eventId`.
- **return**: `observation` events of `day` (surfaced) whose row has an earlier `user_reply` ⇒ `card=return` (the LLM text already references the reply because the prompt included it).
- **watching**: rows `status=monitoring` with a test plan, `id = patternId`, `text = ""`, `question = null`, tallies + `minN`.
- **confirmed**: rows whose newest `confirmed` event is within the last 24 h ⇒ `card=confirmed`.
`repliedChoice` = newest `user_reply.choice` of the row after the card's event (null otherwise).
`sourceIcon` from the plan's `seriesA` prefix (`people:`/`topic:` → `naplo`, `sleep-*` → `alvas`, `late-meal-hour` → `vacsora`, train/gym → `edzes`, none → `mezo`).

`ReflectionReplyService.reply(userId, patternId, choice, text)` (`@Transactional`): ownership
lookup (404); append `user_reply(channel="chip", choice, text)`; `watch` ⇒ if `proposed` set
`monitoring` + `monitoring` event; `reject` ⇒ count negatives, second one ⇒ `refuted` +
`refuted` event (user rule), first one ⇒ no status change; `talk` ⇒ `conversationService.create(userId, request with seedPatternId)` and return its id. Belief recomputed via
`HypothesisLifecycle.belief(...)` from the row's last evidence event r/p. Response = `PatternReplyResponse(mapper.toPatternResponse(row), conversationId)`.

`CompanionObservationApiIT`: seed one surfaced observation + one monitoring row + one row
confirmed today ⇒ `GET` returns three cards in order `fresh, watching, confirmed` with the right
`card` values; `POST reply watch` ⇒ `monitoring` and the fresh card disappears on the next `GET`
(it becomes `repliedChoice=watch` — assert that field instead if you keep replied cards for the
day; the FE hides replied fresh cards after the acknowledgement); `POST reply talk` ⇒
`conversationId` non-null and the conversation's `seedPatternId` equals the pattern; another
user's pattern ⇒ 404.

- [ ] **Step 5: Replies feed the nightly revise (small extension of Task 3's prompt)**

In `HypothesisPipelineService.gather`, for each open row include the newest `user_reply.text`
(chip or chat) as `„…”`; the proposal JSON gains `"revisedTestPlan"` + `"revisesHypothesisKey"`;
when present and valid, append a `revised(text)` event to the referenced row and create the new
row with the new plan (the old row stays; the spec's "az is fut"). Test: `HypothesisPipelineTestPlanIT`
gains one case.

- [ ] **Step 6: Morning digest (failing IT, then code)**

`ReflectionDigestService.digestFor(userId, date)`: events of `[date−1 03:00, date 03:00)`: the
newest of `confirmed|refuted|dormant` on a `reflection`/`ai_hypothesis` row, else the newest
`evidence` on a `monitoring` row that has a `user_reply`; deterministic Hungarian sentence:

```java
case confirmed -> "Ma éjjel megerősítettem: „" + title + "”. Beépítettem a tudásba.";
case refuted   -> "Elengedtem: „" + title + "” — a számok nem támasztották alá.";
case evidence  -> "Tegnap kérted, hogy figyeljem: „" + title + "” — az éjjeli számítás szerint " + (hit ? "bejött" : "nem jött be") + " (" + hits + " / " + (hits + misses) + ").";
```

`CompanionMessageGenerator.generateMorning`: `ObjectProvider<ReflectionDigestService>`; when a
digest exists append `"\n\nÉSZREVÉTEL (egy mondatban utalj rá, ha illik a napba):\n" + digest`
to the payload and add a `Ref("Pattern", title)` candidate. `ReflectionDigestMorningIT`: seed a
row confirmed last night; generate the morning message; assert the fake received a user
message containing `ÉSZREVÉTEL` (the morning fake echoes/records its payload — reuse the
`missedWorkoutsBlock` test's approach).

- [ ] **Step 7: Verify, docs, commit, PR**

Run the six new tests + `CompanionPatternApiIT` + `ProactiveFeedApiIT` (or the morning
generator IT) + `ArchitectureTest`; regenerate contract + FE types; `pnpm build`. Docs:
companion.md "Reflexió S4", new endpoints under §4, `OBSERVATION_NEW` in
`_platform-notifications.md` §3b, proactive.md morning gather line; CODEMAP; lint.

```bash
git add -A && git commit -m "feat(companion): quick notice with daily budget, observation feed + reply endpoint, morning digest (mezo-eq85.4)"
```

---

### Task 5: Észrevételek tab on the Nap→Mezo page (`mezo-eq85.5`)

**Files:**
- Create: `frontend/src/data/insights/observationsApi.ts`, `observationsHooks.ts`, `observations.ts` (mock seed), `observationsHooks.test.tsx`
- Modify: `frontend/src/data/hooks.ts` (re-export `useObservations`, `useObservationReply`), `frontend/src/data/types.ts`
- Create: `frontend/src/features/today/components/ObservationCard.tsx`, `ObservationCard.test.tsx`
- Modify: `frontend/src/features/today/pages/NapMezoPage.tsx`, `NapMezoPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css`
- Modify: `frontend/src/test/msw/handlers.ts`
- Modify: `docs/features/today.md`, `docs/features/insights.md`

**Interfaces:**
- Consumes: Task 4's `GET /api/companion/observation`, `POST /api/companion/pattern/{id}/reply`; `useDualQuery`; `ClayIcon`, `ClaySpot` (`@/shared/ui/clay`), `EntranceGroup` (already used on the page); `ChatPage`'s `?c=<conversationId>` URL contract.
- Produces:
  - `interface Observation { id, patternId, hypothesisKey, card: 'fresh'|'return'|'watching'|'confirmed', occurredAt, title, text, question?, evidence: string[], status: PatternRowStatus, evidenceHits, evidenceMisses, minN, belief?, repliedChoice?: ObservationChoice, sourceIcon: ClayIconName }`, `type ObservationChoice = 'watch'|'reject'|'talk'`.
  - `useObservations(date?) → { observations, degraded, isPending, isError, refetch }`; `useObservationReply() → { reply: (patternId, choice, text?) => Promise<{ conversationId?: string }> }` (real: POST + invalidate `['observations']`; mock: local cache update, `talk` ⇒ `{ conversationId: 'mock-conv' }`).
  - `ObservationCard({ item, onReply })`.
  - `NapMezoPage` tab union `'uzenetek' | 'eletjelek' | 'eszrevetelek'`, `?tab=eszrevetelek`.

- [ ] **Step 1: Types, API, hook (failing hook test first)**

`observationsHooks.test.tsx` (both modes, the `patternsHooks` test as template): mock mode
returns the seed (4 items, one per card kind); real mode with MSW `GET` returning two items
maps `card`/`sourceIcon`; a 404 ⇒ `degraded: true`; `reply('p1','watch')` POSTs
`{choice:'watch'}` and invalidates.

`observationsApi.ts`: `toObservation(w)` maps wire → `Observation` (`sourceIcon` falls back to
`'mezo'` when the wire string is not a `ClayIconName`; use the `i-` name map that
`PatternDomainMark` uses if one exists). `observations.ts`: the four seed cards copied from the
prototype copy (Anna/alvás fresh; nehéz hétfők return; késői vacsora watching 5/8; edzés után
hálásabb confirmed). MSW default: `http.get(`${API_BASE}/api/companion/observation`, () => HttpResponse.json([]))`
and `http.post(`${API_BASE}/api/companion/pattern/:id/reply`, …)` returning a minimal
`PatternReplyResponse`.

- [ ] **Step 2: `ObservationCard` (failing component test first)**

Tests: renders the italic Mezo sentence and the question for `fresh`; three chips for `fresh`,
two for `return` (`Így van` / `Kivétel volt` map to `watch` / `reject`), no chips for
`watching`/`confirmed`; clicking `Igen, figyeld` calls `onReply(patternId,'watch')` and flips
the card to the acknowledgement line; `watching` shows an 8-slot tally (`✓`/`✕`/`·` rendered as
text glyphs, not emoji) and `5 / 8 nap`; `Laborfüzet ›` links to `/mezo/patterns/${hypothesisKey}`;
`Mesélj` calls `onReply(...,'talk')` and, with a `conversationId` back, navigates to
`/mezo/chat?c=<id>`.

Markup follows the prototype 1:1 with class names `nap-obs nap-obs-fresh|return|watch|done`,
`.nap-obs-top`, `.nap-obs-say` (Fraunces italic — the same font-face the memoir page uses),
`.nap-obs-ask`, `.nap-obs-evid`, `.nap-obs-chips .chip.yes|.talk`, `.nap-obs-ack`,
`.nap-obs-tally`, `.nap-obs-prog`; `ClayIcon name={item.sourceIcon}` in the clay disc; the state
pill text `ÚJ` / `FIGYELEM` / `GYŰLIK` / `BEÉPÜLT`. Copy the prototype's CSS into
`prototype.css` under a `/* ── Észrevételek (mezo-eq85.5) ── */` block, converting hex greys to
the `--mz-*` tokens where `.nap-mzmsg` already does.

- [ ] **Step 3: The third tab (failing page test first)**

`NapMezoPage.test.tsx` additions (both modes): `?tab=eszrevetelek` opens the tab; the tab
button shows a dot when `useObservations` has a `fresh` card with no `repliedChoice` and the
tab is not active; the pane renders the cards and the footer line
`Ma még {n} észrevétel fér a keretbe · 22:00 után csendben maradok` — `n` comes from
`2 − fresh cards surfaced today`, clamped at 0 (the budget config is not on the wire; keep the
literal 2 and 22:00 in one `OBSERVATION_BUDGET = { perDay: 2, quietFrom: '22:00' }` constant
next to the seed, documented as mirroring `mezo.companion.reflection.notice`); pending renders
the existing skeleton, error a `GhostState` with retry, degraded the existing honest line,
empty `Még nincs észrevétel — Mezo figyel.`; the `?n=` deeplink still forces `uzenetek`.

Page changes: extend `MezoTab`, the `setTab` URL write (`eszrevetelek` ⇒ `tab=eszrevetelek`),
`dots` gets an `eszrevetelek` key computed from `useObservations()`, third `<button role="tab">`,
`{tab === 'eszrevetelek' && (<EntranceGroup>…</EntranceGroup>)}` mapping `ObservationCard`s
with the `rise` stagger, `useObservationReply` for `onReply`. The hero subtitle keeps counting
only the message thread.

- [ ] **Step 4: Verify, docs, commit, PR**

`pnpm test && VITE_USE_MOCK=false pnpm test && pnpm lint && pnpm build`. Docs: today.md
(NapMezoPage §: the third tab, the dot rule, the deeplink rule), insights.md §5 (the new
hooks), CODEMAP, lint.

```bash
git add -A && git commit -m "feat(fe): Észrevételek — third tab on the Nap→Mezo page with observation cards and reply chips (mezo-eq85.5)"
```

---

### Task 6: The laborfüzet on the pattern detail page (`mezo-eq85.6`)

**Files:**
- Modify: `.../companion/service/PatternPairDetailService.java`, `PatternMonitorService.java` (a `toPair` overload for a synthetic pair), `api/feature/companion/companion.yml` (`PatternMonitorPair` description only), test `CompanionPatternPairDetailApiIT`
- Create: `frontend/src/features/insights/components/HypothesisStateCard.tsx`, `TestPlanTiles.tsx`, `EvidenceLog.tsx` (+ `.test.tsx` each)
- Modify: `frontend/src/features/insights/pages/PatternDetailPage.tsx`, `PatternDetailPage.test.tsx`, `logic/lifecycle.ts`, `logic/lifecycle.test.ts`, `logic/patternCatalog.ts`, `components/PatternJournal.tsx` (or replace by `EvidenceLog` for reflection rows), `data/insights/insights.ts` (mock seed: one reflection pattern + events), `frontend/src/test/msw/handlers.ts`
- Modify: `docs/features/insights.md`

**Interfaces:**
- Consumes: Task 2's wire fields (`testPlan`, `belief`, `evidenceHits`, `evidenceMisses`, new event kinds/fields), Task 4's reply endpoint (chips inside the state card reuse `useObservationReply`), `usePatternPairDetail`, `usePatternActions().decide`, `PatternEvidenceChart` (two-group dot plot for a BINARY `metricAValueKind`).
- Produces: `GET /api/companion/pattern/pair/{hypothesisKey}` serves reflection rows (synthetic `PatternMonitorPair` from the plan, `days` from `DerivedSeriesService`); `HypothesisStateCard({ pattern, pair, onDecide, onReply })`, `TestPlanTiles({ plan, pair })`, `EvidenceLog({ events })`; `bucketize` places `refuted` under `noRelationship` and `dormant` under `gathering` with their own copy.

- [ ] **Step 1: Backend — reflection rows on the pair-detail endpoint (failing IT first)**

`CompanionPatternPairDetailApiIT` new case: a `reflection` row with plan `people:anna →
sleep-duration-h` and signals + sleep seeded ⇒ `GET /api/companion/pattern/pair/ref-…` returns
200 with `pair.key == hypothesisKey`, `pair.metricAKey == "people:anna"`,
`pair.metricAValueKind == "binary"`, `pair.metricALabel == "„Anna” a szövegeidben"`, `pattern.testPlan` present, `days` non-empty,
`events` including the `evidence` rows with `hit`/`verdict`; an unknown key still 404s.

`PatternPairDetailService.detail`: when no catalog pair matches, look up
`patternRepository.findByCreatedByAndHypothesisKeyAndDeletedFalse(userId, pairKey)`; a row with
a `testPlan` ⇒ build series via `DerivedSeriesService` and a synthetic
`CompanionProperties.PatternPair`-equivalent through a new `PatternMonitorService.toPair(TestPlanEnvelope plan, String key, String title, Map<String, Map<LocalDate, Double>> seriesByKey, PatternEntity row, LocalDate from, LocalDate to, DerivedSeriesService labels)`
overload that fills `metricALabel/BLabel/valueKind/domain` from `DerivedSeriesService.labelOf/valueKindOf`
(`domain` = the `MetricKey`'s domain when the key is a metric, `MIND` for people/topic),
`mechanismHu` = row mechanism, `questionHu` = row title, `whenPositiveHu/whenNegativeHu` =
`"{erősség} együttjárás"` generic templates, `verdict`/`alignedDays` from `PatternGate.evaluate`;
`impact` via the existing port; `days` aligned from the two series.

- [ ] **Step 2: FE components (failing tests first)**

`HypothesisStateCard`: eyebrow = category label + domain; state pill from status
(`FIGYELEM` monitoring, `GYŰLIK` proposed, `BEÉPÜLT` confirmed, `ELENGEDVE` refuted,
`PIHEN` dormant, `ELVETVE` rejected); question = `Hipotézis: {title}?`; human answer
(`Ígéretes, de még gyűlik.` when `evidenceHits + evidenceMisses < minN`, `Tartja magát.` when
hits ≥ 3·misses, `Nem igazolódik.` when misses > hits, `Beépült.` confirmed); sub-line with
group counts from `pair.groupZeroDays/groupOneDays` when present; belief ring = a conic
gradient `--v:{belief*100}%` with the percentage and the label `bizonyosság`, and the one-line
explanation from the prototype; the three decide buttons call `onDecide('confirm'|'monitor'|'reject')`
(hidden when the row is `confirmed`/`rejected` — a read-only status hero, the existing rule).

`TestPlanTiles`: two tiles `Ha…` (`seriesALabel`, `sourceIcon`) and `…akkor` (`seriesBLabel`),
plus the strip `+{lag} nap eltolás · {minN} nap kell minimum · {több|kevesebb} várt irány · {windowDays} nap ablak`.

`EvidenceLog`: the timeline; per kind: `observation` (coral dot, text), `user_reply` (lavender,
italic quoted text, `em` label `te`), `revised` (gold, `átfogalmazva`), `evidence` (gold,
`bejött`/`nem jött be`/`kevés nap`/`nincs adat` from `hit`/`verdict`, `n` days), `monitoring`/`confirmed`/`refuted`/`dormant`/`rejected`/`promoted`/`reinforced`/`snapshot` (existing `PatternJournal` copy). Dates in Hungarian short form (`Szept. 6. · 14:12`).

- [ ] **Step 3: Page wiring + buckets (failing page test first)**

`PatternDetailPage`: when `detail.pattern?.testPlan` exists (any kind), render
`HypothesisStateCard` instead of `PatternDetailHero`, then section heads `A teszt-terv`,
`Az eddigi napok` (existing `PatternEvidenceChart`), `Bizonyíték-napló` (`EvidenceLog`),
`Háttér` (existing diagnostics fold with r/p/gate). Rows without a plan keep today's layout.
`lifecycle.ts`: `refuted` ⇒ `noRelationship` bucket with the row copy `Megnéztük — nem igazolódott`,
`dormant` ⇒ `gathering` with `Pihen — várom az adatot`; `lifecycle.test.ts` two cases.
`patternCatalog.ts`: the status filter offers `refuted` and `dormant`. Mock seed: one reflection
pattern (`ref-anna-sleep`) + six events; MSW pair-detail default handles the key.

- [ ] **Step 4: Verify, docs, commit, PR, close the epic**

`pnpm test && VITE_USE_MOCK=false pnpm test && pnpm lint && pnpm build`; backend
`CompanionPatternPairDetailApiIT` + `ArchitectureTest`. Docs: insights.md §2.1/§2.1b (the
laborfüzet sections, the bucket rule for the two new statuses), companion.md §4 endpoint note;
CODEMAP; lint. Then `bd close mezo-eq85.6`, and on `mezo-eq85`: record the acceptance-criteria
walk-through from spec §11 and close it.

```bash
git add -A && git commit -m "feat(fe): laborfüzet — hypothesis state card, test plan tiles, evidence log on the pattern detail page (mezo-eq85.6)"
```

---

---

## Part B — the memory platform everywhere AI speaks (`mezo-eq85.7` … `mezo-eq85.12`)

**Product-owner decision (2026-09-06):** every AI surface whose answer should reflect the
user's history adopts the memory platform now, before the `mezo-6dii.9` real-Gemini gate has
run. Recorded on `mezo-6dii` and `mezo-eq85`; spec §8b/§9.

**Inventory basis:** 57 LLM call sites on `main` at `725cf84a0`. Only chat touches the platform
(SHADOW). Three groups: (A) surfaces that run the OLD pgvector path — real swaps; (B) surfaces
that read "the last N daily summaries" straight from tables — the platform block is ADDED
beside `KnowledgeFactService.renderPromptBlock`; (D) surfaces with no memory today where an
emlék makes the answer personal. Surfaces deliberately left alone: daily summary, period
consolidation (they are memory SOURCES — feeding them memory is circular), activity classify,
transcription, sleep shot, pantry photo/scrape, turn verdict, hello smoke.

### Shared seam for Part B (built in Task 7, reused by 8–12)

`companion/memory/service/MemoryContextBlock.java`:

```java
@Slf4j @Service @RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryContextBlock {
    private final MemoryContextService memoryContextService;
    private final MemoryPlatformProperties properties;
    private final LlmCallContextHolder llmCallContextHolder;

    /** Rendered `[Emlékek]` block for a non-chat consumer — "" on any failure, never throws.
     *  Wraps the retrieval in an LlmCallContext so the embedding/rewrite/rerank calls are billed
     *  to the CALLING surface, not to "memory". */
    public Rendered render(UUID userId, ConsumerPolicy policy, String query, LocalDate asOf, boolean deep,
                           String feature, String operation, UUID entityId) {
        MemoryPlatformProperties.PolicyLimits limits = properties.policies().limitsFor(policy);
        if (query == null || query.isBlank() || !limits.enabled()) { return Rendered.EMPTY; }
        try {
            MemoryRequest request = new MemoryRequest(userId, policy, query, List.of(), asOf, limits.maxTokens(), null, deep);
            MemoryContext context = llmCallContextHolder.runWith(
                new LlmCallContext(feature, operation + "_memory", "policy", entityId), () -> memoryContextService.retrieve(request));
            return new Rendered(context.promptBlock() == null ? "" : context.promptBlock(), context.refs(), context.retrievalRunId());
        } catch (RuntimeException e) {
            log.warn("Memory context for {}/{} failed — surface continues without [Emlékek]", feature, policy, e);
            return Rendered.EMPTY;
        }
    }
    public record Rendered(String block, List<RefsEnvelope.Ref> refs, UUID retrievalRunId) {
        public static final Rendered EMPTY = new Rendered("", List.of(), null);
    }
}
```

`MemoryPlatformProperties.Policies` grows one `PolicyLimits(boolean enabled, int candidateLimit, int maxTokens, boolean rerank, boolean deep)` per policy
(`reflection` from Task 3 keeps its shape; add `morningBriefing`, `weeklyMemoir`, `predictionEvidence`, `similarDays`, `characterEvidence`, `extraction`, `personalContext`) and `limitsFor(ConsumerPolicy)`.
`ConsumerPolicy` grows `SIMILAR_DAYS`, `CHARACTER_EVIDENCE`, `EXTRACTION`, `PERSONAL_CONTEXT`.
Each policy is individually switchable (`enabled`), so a surface can be rolled back by config
without code. Every surface that adds the block also adds the returned `refs` to its
`HIVATKOZÁS-JELÖLTEK` list (where the surface has one) so the model can cite an emlék and the
FE ref chips show it.

Task 3's `ReflectionMemoryGateway` is refactored in Task 7 into a thin caller of
`MemoryContextBlock` (same public signature), so reflection and Part B share one seam.

Tests common to every Part-B task: (1) the surface's existing generator IT gains a case where a
`memory_item` + `memory_vector` seeded by `MemoryItemPopulator` appears in the fake's recorded
payload as an `[Emlékek]` line; (2) `FakeEmbeddingAdapter.FAIL_EMBED` in the query ⇒ the
surface still produces its row; (3) a `memory_retrieval_run` row with the surface's policy
exists after generation; (4) the policy's `enabled: false` ⇒ no run row, payload unchanged.

### Task 7: `MemoryContextBlock` + morning, midday/evening, sleep and weight messages (`mezo-eq85.7`)

**Files:** create `companion/memory/service/MemoryContextBlock.java`; modify
`companion/memory/config/MemoryPlatformProperties.java`, `dto/ConsumerPolicy.java`,
`service/MemoryContextService.java` (candidate limit + token budget via `limitsFor`),
`service/LlmMemoryReranker.java` (rerank when `limitsFor(policy).rerank()`), `application.yml`;
refactor `companion/reflection/service/ReflectionMemoryGateway.java`; modify
`proactive/service/CompanionMessageGenerator.java` (`generateMorning:217`, `generateSleepReaction:~329`,
`generateWeightReaction:~382`, `generateWindow:~438`); tests `MemoryContextBlockIT`,
`CompanionMessageGeneratorMemoryIT`, existing `ProactiveFeed*IT` still green.

**Steps:**
- [ ] Failing `MemoryContextBlockIT`: seeded item ⇒ non-empty block + run row with policy `MORNING_BRIEFING`; `FAIL_EMBED` ⇒ `Rendered.EMPTY`; policy disabled ⇒ `EMPTY` and no run row.
- [ ] Implement the block, the properties (`policies.morning-briefing: {enabled: true, candidate-limit: 20, max-tokens: 600, rerank: false, deep: false}` and the other six with their spec values: memoir 30/1200/rerank true/deep true; prediction 30/800/rerank true; similar-days 30/600; character-evidence 30/1200/rerank true/deep true; extraction 10/300; personal-context 15/400), the `limitsFor` switch, and wire `MemoryContextService` + reranker to it. Refactor `ReflectionMemoryGateway` to delegate.
- [ ] Failing `CompanionMessageGeneratorMemoryIT`: morning payload contains `[Emlékek]` and the ref candidates include the memory ref; sleep/weight/window likewise.
- [ ] In each generator, after `knowledgeFactService.renderPromptBlock(userId)`: `MemoryContextBlock.Rendered mem = memoryContextBlock.render(userId, ConsumerPolicy.MORNING_BRIEFING, query, date, false, "proactive_feed", "<kind>", null)`, append `mem.block()`, add `mem.refs()` to `candidates`. Query per kind: morning = `contextSnapshotAssembler.renderWithoutBiometrics(...)` first 400 chars + "ma: " + today's plan line; sleep = "alvás " + last sleep log line; weight = "súly " + trend line; window = the latest daily-summary narrative first 300 chars. (`ObjectProvider<MemoryContextBlock>` — the bean is absent when companion is off.)
- [ ] Verify (`CompanionMessageGeneratorMemoryIT`, `ProactiveFeedApiIT`, `MemoryContextServiceIT`, `ReflectionMemoryGatewayIT`, `ArchitectureTest`), docs (companion.md "Memória mindenhol S7", proactive.md gathers), CODEMAP, commit `feat(proactive): morning/window/sleep/weight messages read the memory platform (mezo-eq85.7)`, PR, merge.

### Task 8: memoir, weekly review, weekly suggestion (`mezo-eq85.8`)

**Files:** modify `proactive/service/MemoirGenerator.java` (`gather:167`, after `:260`), `WeeklyReviewGenerator.java` (`:145`, after `:248`), `WeeklySuggestionGenerator.java` (`:78`, after the facts block); tests `MemoirGeneratorMemoryIT`, `WeeklyReviewGeneratorMemoryIT`, `WeeklySuggestionGeneratorMemoryIT`.

**Steps:**
- [ ] Failing ITs (the four common cases each; policy `WEEKLY_MEMOIR`, `deep=true`).
- [ ] Query = the week's daily-summary narratives joined (first 800 chars) + `"a hét: " + weekStart`; `asOf` = the week's Sunday; append block after the facts block; refs into the memoir/weekly anchor candidates (both generators number their refs — extend the list, keep indexes stable).
- [ ] Verify (`MemoirGeneratorIT`, `WeeklyReviewGeneratorIT`, `WeeklySuggestionIT` + the three new), docs, commit `feat(proactive): memoir, weekly review and suggestion read the memory platform (mezo-eq85.8)`, PR, merge.

### Task 9: prediction, experiment, challenge, diagnosis (`mezo-eq85.9`)

**Files:** modify `proactive/service/PredictionGenerator.java` (`gather:108`, after `:160`), `ExperimentProposalGenerator.java` (`:108`), `ChallengeGenerator.java` (`:127`), `DiagnosisGenerator.java` / `FatigueEvidenceCollector.gather:104`; tests one `*MemoryIT` per generator.

**Steps:**
- [ ] Failing ITs (policy `PREDICTION_EVIDENCE`; diagnosis uses `deep=true`).
- [ ] Query = the candidate patterns' titles joined (prediction/experiment/challenge) or the fatigue evidence summary line (diagnosis); block appended after the facts block (diagnosis: after the `knowledge_fact` raw block — replace that raw read with `renderPromptBlock` while there, one fewer bespoke fact renderer). Refs into each generator's candidate list.
- [ ] Verify, docs, commit `feat(proactive): prediction, experiment, challenge, diagnosis read the memory platform (mezo-eq85.9)`, PR, merge.

### Task 10: similar days (tool + Memória tab), character bootstrap/monthly, quarterly, profile, extraction, audit tags (`mezo-eq85.10`)

**Files:** modify `companion/tools/MemoryTools.java` (`findSimilarPastDays:52`), `companion/service/MemoryObservatoryService.java` (`similarDays:187`, `overview:71`, `summaries:165`), `character/service/CharacterHistoryReads.java` (`gatherHistory:191`), `character/service/CharacterMonthlyService.java` (`:126`), `companion/quarterly/service/QuarterlyReviewService.java` (`:128`), `companion/profile/service/ProfileAssembler.java` (`:143`), `companion/graph/service/LifeEventExtractionService.java` (`:139`), `companion/service/PersonExtractionService.java` (`:173`), `companion/memory/service/LlmMemoryQueryRewriter.java:28` + `LlmMemoryReranker.java:83` (wrap in `LlmCallContext("companion_memory", "rewrite"|"rerank", …)`); contract `api/feature/companion/companion.yml` `MemorySimilarDayResponse` (add `retrievalRunId`, `memoryItemId` nullable) — regenerate; FE `data/insights/memoryApi.ts` passes the new fields through; tests `MemoryToolsSimilarDaysIT`, `MemoryObservatorySimilarDaysIT`, `CharacterBootstrapMemoryIT`, `QuarterlyReviewMemoryIT`, `ProfileAssemblerMemoryIT`, `LifeEventExtractionMemoryIT`, `LlmMemoryCallContextIT`.

**Steps:**
- [ ] Failing `MemoryToolsSimilarDaysIT` + `MemoryObservatorySimilarDaysIT`: with only `memory_item`/`memory_vector` seeded (no `memory_embedding`), the tool and the endpoint return the seeded days; `memory_retrieval_run` has policy `SIMILAR_DAYS`.
- [ ] `MemoryTools.findSimilarPastDays` and `MemoryObservatoryService.similarDays` build a `MemoryRequest(SIMILAR_DAYS, query, deep=false)` through `MemoryContextService.retrieve` and map `MemoryContextItem`s (source kind `daily_summary` only — filter in the mapping; the policy's forbidden kinds list is the second guard) to the existing `SimilarDay` shape. `MemoryRecallService` stays for Task 11's retirement, unused after this step.
- [ ] Observatory `overview`/`summaries` count `memory_item`/`memory_vector` (serving version) instead of `memory_embedding`; the FE copy on the Memória tab says "vetítés" where it said "beágyazás" (insights.md §2.9).
- [ ] Failing `CharacterBootstrapMemoryIT`, `QuarterlyReviewMemoryIT`, `ProfileAssemblerMemoryIT`: policy `CHARACTER_EVIDENCE`, `deep=true`; character bootstrap's `gatherHistory` gains the block after the daily-summary narratives; monthly deep read passes the dimension's claims text as the query; quarterly passes the quarter's period-summary text; profile passes the rollup digest. Character and quarterly reach the block through the existing `CharacterPromptSource`-style port direction (character → companion is allowed; inject `MemoryContextBlock` directly).
- [ ] Failing `LifeEventExtractionMemoryIT`: policy `EXTRACTION`, query = the day's narrative; the block is appended as `KORÁBBI KAPCSOLÓDÓ EMLÉKEK` so the extractor can tell a recurring event from a new one; same for `PersonExtractionService`.
- [ ] `LlmMemoryCallContextIT`: a chat turn in `NEW` mode leaves `llm_log_history` rows for rewrite/rerank tagged `companion_memory`, not `UNKNOWN`.
- [ ] Verify, docs (companion.md tool + observatory notes, character.md bootstrap gather, insights.md §2.9), CODEMAP, commit `feat(companion): similar days, character, quarterly, profile and extraction read the memory platform; memory calls tagged (mezo-eq85.10)`, PR, merge.

### Task 11: retire the OLD path (`mezo-eq85.11`)

**Precondition:** Tasks 3, 7–10 merged; chat served in `NEW` for at least 7 days with the
audit showing zero `MEMORY_RETRIEVAL_ALL_FAILED_FALLBACK_OLD` rows (query
`memory_retrieval_run` by `error_code`). If the audit shows fallbacks, stop and report.

**Files:** delete `companion/service/PromptMemoryAssembler.java`, `MemoryRecallService.java`,
`companion/repository/MemoryEmbeddingAnnQuery.java` (and the `MemoryEmbeddingRepository` ANN
methods), the `OLD`/`SHADOW` branches of `ChatMemoryContextAdapter` + `MemoryShadowRunner`
(keep `RetrievalServingMode` with `NEW` only and a startup warning when the env still says
`OLD`/`SHADOW`); `MemoryEmbeddingWriter` keeps producing the `memory_item` projection but stops
writing `memory_embedding` (rename to `MemoryProjectionSource` if the name misleads);
`memory_embedding` table: NOT dropped in this slice — a follow-up migration after one release
(`mezo-eq85.11` notes the ticket); `AmbientRecallEvalIT`, `PromptMemoryAssemblerIT` deleted;
`MemoryRetrievalGeminiEvalIT` (PR #499) adjusted if its OLD baseline is needed — **coordinate:
merge #499 first or rebase it**; the `mezo.companion.ambient-recall.*` and `recall.*` config
blocks removed; docs: RAG spec §9/§11.D rewritten to the delivered state, companion.md
"OLD path retired", CODEMAP.

**Steps:**
- [ ] Audit query + report (stop condition above).
- [ ] Failing `ChatMemoryContextAdapterIT`: `NEW` serves from the platform; an env `SHADOW` value logs the warning and still serves `NEW`.
- [ ] Deletions + config removal; `ArchitectureTest`; full focused set (`ChatServiceIT`, `CompanionStreamApiIT`, `MemoryContextServiceIT`, `MemoryToolsSimilarDaysIT`, `NoteVectorLifecycleIT` adjusted to `memory_item`).
- [ ] Verify, docs, commit `refactor(companion): retire the OLD pgvector recall path; chat and tools serve from the memory platform only (mezo-eq85.11)`, PR, merge.

### Task 12: personal context for the domain assistants (`mezo-eq85.12`)

**Files:** modify `companion/service/MesoReviewGenerator.java` (`:132`) and `companion/llm/MesoPlanLlmAdapter.java` (`:56`), `companion/llm/HabitSuggestLlmAdapter.java` (`:130`), `companion/llm/LifeGoalProposeLlmAdapter.java` (`:87`), `companion/service/DayReviewService.prose` (`:297`), `meal/service/MealCoachService.java` (`:165`), `recipe/service/RecipeWorkshopService.java` (`:84`), `proactive/service/AdviceProseGenerator.java` (`:56`), `proactive/service/CompanionMessageGenerator.generatePeopleObservation` (`:638`), `quest/service/QuestFlavor.java` (`:71`); a companion-owned port `companion/service/PersonalContextSource.java` (`String render(UUID userId, String query)`) implemented by `MemoryContextBlock`-backed `PersonalContextAssembler` in companion so `meal`, `recipe`, `quest` (which must not import `companion.memory` internals — check `ArchitectureTest`'s allow-list for those slices) reach it through `ObjectProvider<PersonalContextSource>`; tests one `*PersonalContextIT` per surface.

**Steps:**
- [ ] Failing ITs (policy `PERSONAL_CONTEXT`, `deep=false`, `rerank=false`, 400 tokens): each surface's payload gains a `[Rólad — emlékek]` block when an item matches the query; the deterministic outputs (day-review numbers, meal targets, quest XP) are byte-identical with and without the block (assert on the parsed structures, not only the prose).
- [ ] Queries: meso review/plan = the cycle's focus + muscle groups + the last review's headline; habit suggest = the chain names + "szokás, amit már próbáltam"; life goal = the goal title + why; day review = the day's evaluation headline; meal coach = the meal's items + window; recipe workshop = the ingredient list; advice prose = the `adviceKey` label + facts; people = the person names of the day; quest flavor = the quest titles. Cheap-tier surfaces keep the block under 400 tokens; the interactive ones (meal coach, recipe workshop) run the retrieval with the policy's `candidate-limit: 15` and no rewrite (`MemoryRequest.shortConversationHistory = List.of()` already skips the rewrite).
- [ ] Verify, docs (each surface's feature doc: one line "olvassa a memória-platformot (`PERSONAL_CONTEXT`)"), CODEMAP, commit `feat: personal memory context for meso, habit, life-goal, day review, meal, recipe, advice, people and quest prose (mezo-eq85.12)`, PR, merge.

### Part B final gate

- Every policy has a `memory_retrieval_run` row in the last 24 h after one day of normal use; no policy shows more than 5% `error_code` rows.
- The Memória tab's overview counts come from `memory_item`/`memory_vector`.
- Spec §8b and RAG spec §9/§11.D reflect the delivered order; PR #499's eval either ran or its blocker is still the API key, stated on `mezo-6dii.9`.

---

## Final integration gate (Part A, `mezo-eq85.1`–`.6`)

Before closing `mezo-eq85`:

- Deployment env carries `MEZO_MEMORY_SERVING_MODE=NEW`; a chat turn's `memory_retrieval_run`
  row shows `serving_mode = NEW`; a reflection run shows `consumer_policy = REFLECTION`.
- A journal save mentioning a person present in an open plan produces a `fresh` card within a
  minute in the real app (`/verify` skill recipe), the chip flips the card, `Mesélj` opens a
  seeded chat whose reply appears as a `te` entry in the laborfüzet the next morning.
- The 03:40 job log shows the four steps per user; the morning message of a day after a state
  change carries the one-sentence digest.
- `bd` records the product-owner decisions (chat `NEW` before `mezo-6dii.9`; reflection before
  the chat gate) on `mezo-6dii` and `mezo-eq85`; PR #499 stays unmerged until the Gemini eval
  runs.
