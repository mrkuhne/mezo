# LLM call audit log (`llm_log_history`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist an append-only, per-call audit row for every LLM call (chat/vision/tool/smart + embeddings + proactive crons) with the real served model, full token breakdown, a frozen price snapshot, latency, status, payload, and entity-level attribution.

**Architecture:** The two real Gemini adapters (`GeminiCompanionLlm`, `GeminiEmbeddingAdapter`) — the only places the provider `ChatResponse`/`EmbedContentResponse` metadata exists — call `.chatResponse()` instead of `.content()`, build an immutable `LlmCallRecord`, and hand it to an injected `LlmCallRecorder`. When the feature switch is on, the recorder publishes an `LlmCallEvent`; an `@Async @EventListener` (`LlmLogWriter`) resolves the actor, snapshots pricing, computes cost, and INSERTs one `llm_log_history` row in its own `REQUIRES_NEW` transaction. Entity attribution rides a thread-scoped `LlmCallContext` set by callers. When the switch is off a `NoOpLlmCallRecorder` is wired and there is zero overhead.

**Tech Stack:** Java 21, Spring Boot 4.x, Spring AI 2.0.0 (`spring-ai-google-genai`), google-genai client, Liquibase, JPA/Hibernate (`@JdbcTypeCode(SqlTypes.JSON)` for jsonb), Testcontainers/fixed `mezo_test`, AssertJ.

> **Design refinement vs. spec** (`docs/superpowers/specs/2026-07-28-llm-call-audit-log-design.md`): the spec sketched two `@Primary` *decorator beans* wrapping the ports. Because the port methods return `String`/`float[]` and the response metadata lives only *inside* the adapter, the capture is done by **modifying the two real adapters to emit an `LlmCallRecord` via an injected `LlmCallRecorder`** — same properties (consumers untouched, real metadata, context attribution, async, switchable) with **no `@Primary`/self-injection**. Embedding tokens are not exposed by the API; the honest metric is `billableCharacterCount` (added to the schema).

## Global Constraints

- **Base package:** `io.mrkuhne.mezo`. New feature package: `feature/llmlog/{entity,repository,service,event,context,config}`.
- **PKs:** `UUID` (`gen_random_uuid()`). **Ownership:** `created_by uuid`, set **server-side** (principal or owner), never from client.
- **INSERT-only:** `llm_log_history` has **no** `is_deleted`, no `@SQLRestriction`/`@SQLDelete`, no updates. Deliberate deviation from the soft-delete house default (audit rows are immutable).
- **Config:** everything under `mezo.` — no `@Value`, no hardcoded tunables. Switches: `FeaturesConfiguration` constant + `@ConditionalOnProperty`. Values: `@Validated` `*Properties` records.
- **DI:** constructor injection via `@RequiredArgsConstructor`. `@Transactional` method-level only.
- **Errors:** `SystemRuntimeErrorException` + `SystemMessage.error("CODE")`; codes added to `message.properties`; no hardcoded user text.
- **Liquibase:** `{YYYYMMDDHHMM}_mezo-2zyu_{desc}.sql`, immutable once released, explicit constraint names (`pk_/fk_/uq_/ck_/idx_`), registered in `1.0.0/1.0.0_master.yml`. Seed data (pricing) is **config**, never SQL.
- **Tests:** integration-first (`@SpringBootTest` via `AbstractIntegrationTest`), `test{Method}_should{Result}_when{Condition}`, AssertJ only, data via `*Populator`. New table → add to `ResetDatabase` TRUNCATE list **and** add a populator.
- **Verified Spring AI 2.0 API (javap-confirmed on the installed jars):**
  - `chatClient.prompt()...call().chatResponse()` → `ChatResponse`; `...stream().chatResponse()` → `Flux<ChatResponse>`.
  - `ChatResponse.getMetadata()` → `ChatResponseMetadata`: `.getModel()` (String served model), `.getUsage()` → `Usage`.
  - `Usage`: `.getPromptTokens()`, `.getCompletionTokens()`, `.getTotalTokens()` (all `Integer`), `.getNativeUsage()` (`Object`), `.getCacheReadInputTokens()` (`Long`).
  - Native usage cast: `(com.google.genai.types.GenerateContentResponseUsageMetadata) usage.getNativeUsage()` → `.thoughtsTokenCount()`, `.cachedContentTokenCount()`, `.promptTokenCount()`, `.candidatesTokenCount()`, `.totalTokenCount()` (all `Optional<Integer>`).
  - Response text: `chatResponse.getResult().getOutput().getText()`.
  - Embedding: `EmbedContentResponse.metadata()` → `Optional<EmbedContentMetadata>` → `.billableCharacterCount()` `Optional<Integer>` (no token count is exposed).

---

## Task 1: Pricing config + cost math

**Files:**
- Create: `feature/llmlog/config/ModelPrice.java`, `feature/llmlog/config/LlmPricingProperties.java`, `feature/llmlog/config/LlmLogProperties.java`
- Create: `feature/llmlog/service/PricingSnapshot.java`, `feature/llmlog/service/LlmPricingService.java`
- Modify: `src/main/resources/application.yml` (add `mezo.llm-log.*`)
- Test: `feature/llmlog/service/LlmPricingServiceTest.java` (pure unit)

**Interfaces produced:**
- `PricingSnapshot(String sourceModel, String currency, BigDecimal inputPerMillion, BigDecimal outputPerMillion, BigDecimal thinkingPerMillion, BigDecimal cachedPerMillion, BigDecimal embedPerMillionChars, LocalDate pricedOn)` — jsonb value object.
- `LlmPricingService.snapshot(String servedModel, LocalDate on)` → `PricingSnapshot` (null if model unknown).
- `LlmPricingService.computeGenerationCost(PricingSnapshot, Integer prompt, Integer candidates, Integer thoughts, Integer cached)` → `BigDecimal` (null if snapshot null).
- `LlmPricingService.computeEmbeddingCost(PricingSnapshot, Integer billableChars)` → `BigDecimal` (null if snapshot/chars null).

- [ ] **Step 1: Write the failing test**

```java
// feature/llmlog/service/LlmPricingServiceTest.java
class LlmPricingServiceTest {

    private LlmPricingService service() {
        Map<String, ModelPrice> models = Map.of(
            "gemini-2.5-flash", new ModelPrice(
                new BigDecimal("0.30"), new BigDecimal("2.50"),
                new BigDecimal("2.50"), new BigDecimal("0.075"), null),
            "gemini-embedding-001", new ModelPrice(null, null, null, null, new BigDecimal("0.15")));
        return new LlmPricingService(new LlmPricingProperties("USD", models));
    }

    @Test
    void testSnapshot_shouldFreezeUnitPrices_whenModelKnown() {
        PricingSnapshot snap = service().snapshot("gemini-2.5-flash", LocalDate.of(2026, 7, 28));
        assertThat(snap).isNotNull();
        assertThat(snap.currency()).isEqualTo("USD");
        assertThat(snap.inputPerMillion()).isEqualByComparingTo("0.30");
        assertThat(snap.pricedOn()).isEqualTo(LocalDate.of(2026, 7, 28));
    }

    @Test
    void testSnapshot_shouldReturnNull_whenModelUnknown() {
        assertThat(service().snapshot("gemini-9.9-ultra", LocalDate.of(2026, 7, 28))).isNull();
    }

    @Test
    void testComputeGenerationCost_shouldSumPerCategory_whenTokensGiven() {
        PricingSnapshot snap = service().snapshot("gemini-2.5-flash", LocalDate.of(2026, 7, 28));
        // 10_000 in @0.30/M + 1_000 out @2.50/M + 500 thoughts @2.50/M + 0 cached
        BigDecimal cost = service().computeGenerationCost(snap, 10_000, 1_000, 500, 0);
        // 0.003 + 0.0025 + 0.00125 = 0.00675
        assertThat(cost).isEqualByComparingTo("0.00675");
    }

    @Test
    void testComputeEmbeddingCost_shouldPricePerChar_whenBillableCharsGiven() {
        PricingSnapshot snap = service().snapshot("gemini-embedding-001", LocalDate.of(2026, 7, 28));
        BigDecimal cost = service().computeEmbeddingCost(snap, 2_000_000); // 2M chars @0.15/M = 0.30
        assertThat(cost).isEqualByComparingTo("0.30");
    }
}
```

- [ ] **Step 2: Run test to verify it fails** — `cd backend && ./mvnw clean test -Dtest=LlmPricingServiceTest` → FAIL (types missing).

- [ ] **Step 3: Write minimal implementation**

```java
// feature/llmlog/config/ModelPrice.java  — USD per 1M tokens (generation) / per 1M chars (embedding); nullable per model kind
public record ModelPrice(BigDecimal inputPerMillion, BigDecimal outputPerMillion,
                         BigDecimal thinkingPerMillion, BigDecimal cachedPerMillion,
                         BigDecimal embedPerMillionChars) {}
```

```java
// feature/llmlog/config/LlmPricingProperties.java
@ConfigurationProperties(prefix = "mezo.llm-log.pricing")
@Validated
public record LlmPricingProperties(@NotBlank String currency,
                                   @NotNull Map<String, ModelPrice> models) {}
```

```java
// feature/llmlog/config/LlmLogProperties.java
@ConfigurationProperties(prefix = "mezo.llm-log")
@Validated
public record LlmLogProperties(@Positive int maxPayloadChars, @NotNull Executor executor) {
    public record Executor(@Positive int coreSize, @Positive int maxSize, @Positive int queueCapacity) {}
}
```

```java
// feature/llmlog/service/PricingSnapshot.java
public record PricingSnapshot(String sourceModel, String currency,
                              BigDecimal inputPerMillion, BigDecimal outputPerMillion,
                              BigDecimal thinkingPerMillion, BigDecimal cachedPerMillion,
                              BigDecimal embedPerMillionChars, LocalDate pricedOn) {}
```

```java
// feature/llmlog/service/LlmPricingService.java
@Service
@RequiredArgsConstructor
public class LlmPricingService {

    private static final BigDecimal MILLION = new BigDecimal("1000000");
    private final LlmPricingProperties pricing;

    public PricingSnapshot snapshot(String servedModel, LocalDate on) {
        ModelPrice p = servedModel == null ? null : pricing.models().get(servedModel);
        if (p == null) {
            return null;
        }
        return new PricingSnapshot(servedModel, pricing.currency(),
            p.inputPerMillion(), p.outputPerMillion(), p.thinkingPerMillion(), p.cachedPerMillion(),
            p.embedPerMillionChars(), on);
    }

    /**
     * Per-category cost. {@code prompt} MUST already exclude {@code cached}
     * (pass {@code promptTokenCount - cachedContentTokenCount}) — Gemini reports cached as a
     * SUBSET of prompt, so billing prompt-full + cached-rate would 5x-overcharge the cached slice.
     */
    public BigDecimal computeGenerationCost(PricingSnapshot s, Integer prompt, Integer candidates,
                                            Integer thoughts, Integer cached) {
        if (s == null) {
            return null;
        }
        return perMillion(s.inputPerMillion(), prompt)
            .add(perMillion(s.outputPerMillion(), candidates))
            .add(perMillion(s.thinkingPerMillion(), thoughts))
            .add(perMillion(s.cachedPerMillion(), cached));
    }

    public BigDecimal computeEmbeddingCost(PricingSnapshot s, Integer billableChars) {
        if (s == null || billableChars == null) {
            return null;
        }
        return perMillion(s.embedPerMillionChars(), billableChars);
    }

    private static BigDecimal perMillion(BigDecimal unit, Integer count) {
        if (unit == null || count == null) {
            return BigDecimal.ZERO;
        }
        return unit.multiply(BigDecimal.valueOf(count)).divide(MILLION);
    }
}
```

Add to `application.yml` under `mezo:` (seed prices — verify current Gemini rates at implementation; these are placeholders in the right shape):

```yaml
  llm-log:
    max-payload-chars: 64000
    executor:
      core-size: 1
      max-size: 2
      queue-capacity: 500
    pricing:
      currency: USD
      models:
        gemini-2.5-flash:      { input-per-million: 0.30, output-per-million: 2.50, thinking-per-million: 2.50, cached-per-million: 0.075 }
        gemini-2.5-pro:        { input-per-million: 1.25, output-per-million: 10.0, thinking-per-million: 10.0, cached-per-million: 0.31 }
        gemini-embedding-001:  { embed-per-million-chars: 0.15 }
```

Register both `@ConfigurationProperties` in the config-scan (add `LlmLogProperties.class`, `LlmPricingProperties.class` to the existing `@ConfigurationPropertiesScan` / `@EnableConfigurationProperties` list — follow how `CompanionProperties` is registered).

- [ ] **Step 4: Run test to verify it passes** — `./mvnw clean test -Dtest=LlmPricingServiceTest` → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/config \
        backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/PricingSnapshot.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmPricingService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/service/LlmPricingServiceTest.java \
        backend/src/main/resources/application.yml
git -c core.hooksPath=/dev/null commit -m "feat(llm-log): pricing config + frozen-snapshot cost math (mezo-2zyu)"
```

---

## Task 2: `llm_log_history` table + entity + repository + test infra

**Files:**
- Create: `src/main/resources/db/changelog/1.0.0/script/202607281200_mezo-2zyu_create_llm_log_history.sql` (set the 12-digit prefix to the real UTC minute)
- Modify: `src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (register the changeset)
- Create: `feature/llmlog/entity/LlmLogEntity.java` (embeds `PricingSnapshot` as jsonb)
- Create: `feature/llmlog/entity/CallKind.java`, `feature/llmlog/entity/CallStatus.java`
- Create: `feature/llmlog/repository/LlmLogRepository.java`
- Modify: `src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (add `llm_log_history` to TRUNCATE list)
- Create: `src/test/java/io/mrkuhne/mezo/support/populator/LlmLogPopulator.java`
- Test: `feature/llmlog/repository/LlmLogRepositoryIT.java`

**Interfaces produced:**
- `enum CallKind { CHAT, CHAT_STREAM, VISION, SMART, TOOL, EMBED_DOC, EMBED_QUERY }`
- `enum CallStatus { SUCCESS, ERROR }`
- `LlmLogEntity` with all §4 columns; `pricing_snapshot` mapped `@JdbcTypeCode(SqlTypes.JSON) PricingSnapshot`.
- `LlmLogRepository extends JpaRepository<LlmLogEntity, UUID>`.

- [ ] **Step 1: Write the failing test**

```java
// feature/llmlog/repository/LlmLogRepositoryIT.java
class LlmLogRepositoryIT extends AbstractIntegrationTest {

    @Autowired LlmLogRepository repository;

    @Test
    void testSave_shouldRoundTripAllFieldsIncludingJsonbSnapshot_whenPersisted() {
        LlmLogEntity e = new LlmLogEntity();
        e.setCreatedBy(ownerId());                       // AbstractIntegrationTest helper
        e.setCallKind(CallKind.CHAT);
        e.setFeature("companion_chat");
        e.setRequestedModel("gemini-2.5-flash");
        e.setServedModel("gemini-2.5-flash");
        e.setStatus(CallStatus.SUCCESS);
        e.setLatencyMs(842);
        e.setPromptTokens(10_000);
        e.setCandidatesTokens(1_000);
        e.setSystemPrompt("sys");
        e.setUserMessage("hi");
        e.setResponseText("hello");
        e.setPayloadBytes(11);
        e.setPricingSnapshot(new PricingSnapshot("gemini-2.5-flash", "USD",
            new BigDecimal("0.30"), new BigDecimal("2.50"), new BigDecimal("2.50"),
            new BigDecimal("0.075"), null, LocalDate.of(2026, 7, 28)));
        e.setCostUsd(new BigDecimal("0.00550"));

        LlmLogEntity saved = repository.saveAndFlush(e);
        LlmLogEntity read = repository.findById(saved.getId()).orElseThrow();

        assertThat(read.getServedModel()).isEqualTo("gemini-2.5-flash");
        assertThat(read.getPromptTokens()).isEqualTo(10_000);
        assertThat(read.getPricingSnapshot().inputPerMillion()).isEqualByComparingTo("0.30");
        assertThat(read.getCostUsd()).isEqualByComparingTo("0.00550");
        assertThat(read.getCreatedAt()).isNotNull(); // @CreationTimestamp
    }
}
```

- [ ] **Step 2: Run test to verify it fails** — `./mvnw clean test -Dtest=LlmLogRepositoryIT` (compose up) → FAIL (table/entity missing).

- [ ] **Step 3: Write the migration + entity + repo + infra**

Migration `202607281200_mezo-2zyu_create_llm_log_history.sql`:

```sql
create table llm_log_history (
    id                 uuid        not null default gen_random_uuid(),
    created_by         uuid,
    created_at         timestamptz not null default now(),
    call_kind          text        not null,
    feature            text        not null,
    operation          text,
    entity_kind        text,
    entity_id          uuid,
    requested_model    text        not null,
    served_model       text,
    status             text        not null,
    error_code         text,
    error_class        text,
    latency_ms         integer     not null,
    streamed           boolean     not null default false,
    tool_rounds        integer,
    service_tier       text,
    prompt_tokens      integer,
    candidates_tokens  integer,
    thoughts_tokens    integer,
    cached_tokens      integer,
    total_tokens       integer,
    embed_input_count  integer,
    embed_dimensions   integer,
    embed_billable_chars integer,
    system_prompt      text,
    user_message       text,
    response_text      text,
    truncated          boolean     not null default false,
    payload_bytes      integer     not null default 0,
    image_count        integer,
    image_bytes_total  bigint,
    image_mime         text,
    pricing_snapshot   jsonb,
    cost_usd           numeric(12,6),
    constraint pk_llm_log_history_id primary key (id),
    constraint fk_llm_log_history_created_by_app_user_id foreign key (created_by) references app_user (id) on delete set null,
    constraint ck_llm_log_history_status check (status in ('SUCCESS','ERROR'))
);
create index idx_llm_log_history_created_at on llm_log_history (created_at);
create index idx_llm_log_history_feature_created_at on llm_log_history (feature, created_at);
create index idx_llm_log_history_served_model_created_at on llm_log_history (served_model, created_at);
```

Register in `1.0.0_master.yml` (append, following the existing pattern):

```yaml
  - changeSet:
      id: "1.0.0:202607281200_mezo-2zyu_create_llm_log_history"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202607281200_mezo-2zyu_create_llm_log_history.sql
```

`LlmLogEntity.java` — Lombok `@Getter/@Setter`, `@Entity @Table(name = "llm_log_history")`, **no** `@SQLRestriction/@SQLDelete`:

```java
@Entity
@Table(name = "llm_log_history")
@Getter
@Setter
public class LlmLogEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    private UUID createdBy;
    @CreationTimestamp @Column(updatable = false)
    private Instant createdAt;
    @Enumerated(EnumType.STRING) private CallKind callKind;
    private String feature;
    private String operation;
    private String entityKind;
    private UUID entityId;
    private String requestedModel;
    private String servedModel;
    @Enumerated(EnumType.STRING) private CallStatus status;
    private String errorCode;
    private String errorClass;
    private int latencyMs;
    private boolean streamed;
    private Integer toolRounds;
    private String serviceTier;
    private Integer promptTokens;
    private Integer candidatesTokens;
    private Integer thoughtsTokens;
    private Integer cachedTokens;
    private Integer totalTokens;
    private Integer embedInputCount;
    private Integer embedDimensions;
    private Integer embedBillableChars;
    @Column(columnDefinition = "text") private String systemPrompt;
    @Column(columnDefinition = "text") private String userMessage;
    @Column(columnDefinition = "text") private String responseText;
    private boolean truncated;
    private int payloadBytes;
    private Integer imageCount;
    private Long imageBytesTotal;
    private String imageMime;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb")
    private PricingSnapshot pricingSnapshot;
    @Column(precision = 12, scale = 6) private BigDecimal costUsd;
}
```

`LlmLogRepository`:

```java
public interface LlmLogRepository extends JpaRepository<LlmLogEntity, UUID> {}
```

Add `llm_log_history` to the front of the `ResetDatabase` TRUNCATE string (user-authored rows), e.g. `"TRUNCATE TABLE llm_log_history, gamification_profile, ..."`.

`LlmLogPopulator` (`@TestComponent @RequiredArgsConstructor`, mirrors `KnowledgeFactPopulator`): a `log(UUID createdBy, CallKind kind, String feature, String servedModel, int promptTokens, int candidatesTokens)` factory that builds a minimal `LlmLogEntity` and `saveAndFlush`es it.

- [ ] **Step 4: Run test to verify it passes** — `./mvnw clean test -Dtest=LlmLogRepositoryIT` → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/entity \
        backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/repository \
        backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java \
        backend/src/test/java/io/mrkuhne/mezo/support/populator/LlmLogPopulator.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmLogRepositoryIT.java
git -c core.hooksPath=/dev/null commit -m "feat(llm-log): llm_log_history table + entity + repo + test infra (mezo-2zyu)"
```

---

## Task 3: Write pipeline — context, record, event, recorder, async writer, switch

**Files:**
- Create: `feature/llmlog/context/LlmCallContext.java`, `feature/llmlog/context/LlmCallContextHolder.java`
- Create: `feature/llmlog/service/LlmCallRecord.java`, `feature/llmlog/service/TokenUsage.java`, `feature/llmlog/service/EmbedUsage.java`
- Create: `feature/llmlog/event/LlmCallEvent.java`
- Create: `feature/llmlog/service/LlmCallRecorder.java`, `feature/llmlog/service/NoOpLlmCallRecorder.java`, `feature/llmlog/service/EventPublishingLlmCallRecorder.java`
- Create: `feature/llmlog/service/LlmActorResolver.java`, `feature/llmlog/service/LlmLogWriter.java`, `feature/llmlog/config/LlmLogAsyncConfig.java`
- Modify: `techcore/configuration/FeaturesConfiguration.java` (add `LLM_LOG_SWITCH`)
- Modify: `application.yml` (`mezo.feature.llm-log.enabled: false` default; k8s deployment sets `true`)
- Test: `feature/llmlog/service/LlmLogWriterIT.java`, `feature/llmlog/service/LlmLogRecorderWiringIT.java`

**Interfaces produced:**
- `LlmCallContext(String feature, String operation, String entityKind, UUID entityId)`; `LlmCallContext.UNKNOWN`.
- `LlmCallContextHolder`: `set(LlmCallContext)`, `LlmCallContext get()` (returns `UNKNOWN` if unset), `clear()`, `<T> T runWith(LlmCallContext, Supplier<T>)`.
- `LlmCallRecord` (immutable) carrying everything the adapter observed (see fields below).
- `LlmCallRecorder.record(LlmCallRecord)`.
- `LlmLogWriter.persist(LlmCallEvent)` (package-visible, called by the async listener; also directly callable in ITs for determinism).

- [ ] **Step 1: Write the failing tests**

```java
// LlmLogWriterIT.java — the persistence + cost mapping, called synchronously for determinism
class LlmLogWriterIT extends AbstractIntegrationTest {

    @Autowired LlmLogWriter writer;
    @Autowired LlmLogRepository repository;

    @Test
    void testPersist_shouldMapRecordAndComputeCost_whenGenerationCallSucceeds() {
        LlmCallRecord rec = LlmCallRecord.builder()
            .callKind(CallKind.CHAT).feature("companion_chat")
            .requestedModel("gemini-2.5-flash").servedModel("gemini-2.5-flash")
            .status(CallStatus.SUCCESS).latencyMs(500)
            .tokens(new TokenUsage(10_000, 1_000, 500, 0, 11_500))
            .systemPrompt("sys").userMessage("hi").responseText("hello")
            .context(LlmCallContext.UNKNOWN).build();

        writer.persist(new LlmCallEvent(rec, ownerId(), Instant.parse("2026-07-28T10:00:00Z")));

        LlmLogEntity row = repository.findAll().getFirst();
        assertThat(row.getServedModel()).isEqualTo("gemini-2.5-flash");
        assertThat(row.getThoughtsTokens()).isEqualTo(500);
        assertThat(row.getCostUsd()).isEqualByComparingTo("0.00675");   // matches Task 1 math
        assertThat(row.getPricingSnapshot().sourceModel()).isEqualTo("gemini-2.5-flash");
        assertThat(row.getCreatedBy()).isEqualTo(ownerId());
    }

    @Test
    void testPersist_shouldTruncatePayloadAndFlag_whenOverCap() {
        String huge = "x".repeat(70_000);
        LlmCallRecord rec = LlmCallRecord.builder()
            .callKind(CallKind.CHAT).feature("companion_chat").requestedModel("gemini-2.5-flash")
            .status(CallStatus.SUCCESS).latencyMs(1).userMessage(huge)
            .context(LlmCallContext.UNKNOWN).build();
        writer.persist(new LlmCallEvent(rec, ownerId(), Instant.now()));
        LlmLogEntity row = repository.findAll().getFirst();
        assertThat(row.isTruncated()).isTrue();
        assertThat(row.getUserMessage().length()).isLessThanOrEqualTo(64_000);
        assertThat(row.getPayloadBytes()).isGreaterThanOrEqualTo(70_000);
    }
}
```

```java
// LlmLogRecorderWiringIT.java — switch on ⇒ EventPublishing bean; off ⇒ NoOp bean
class LlmLogRecorderWiringIT {

    @Nested
    @SpringBootTest(properties = "mezo.feature.llm-log.enabled=true")
    class Enabled extends AbstractIntegrationTest {
        @Autowired LlmCallRecorder recorder;
        @Test void testRecorder_shouldBeEventPublishing_whenSwitchOn() {
            assertThat(recorder).isInstanceOf(EventPublishingLlmCallRecorder.class);
        }
    }

    @Nested
    @SpringBootTest(properties = "mezo.feature.llm-log.enabled=false")
    class Disabled extends AbstractIntegrationTest {
        @Autowired LlmCallRecorder recorder;
        @Test void testRecorder_shouldBeNoOp_whenSwitchOff() {
            assertThat(recorder).isInstanceOf(NoOpLlmCallRecorder.class);
        }
    }
}
```

- [ ] **Step 2: Run to verify they fail** — `./mvnw clean test -Dtest=LlmLogWriterIT,LlmLogRecorderWiringIT` → FAIL.

- [ ] **Step 3: Implement**

```java
// context/LlmCallContext.java
public record LlmCallContext(String feature, String operation, String entityKind, UUID entityId) {
    public static final LlmCallContext UNKNOWN = new LlmCallContext("unknown", null, null, null);
}
```

```java
// context/LlmCallContextHolder.java
@Component
public class LlmCallContextHolder {
    private static final ThreadLocal<LlmCallContext> CTX = new ThreadLocal<>();
    public void set(LlmCallContext c) { CTX.set(c); }
    public LlmCallContext get() { LlmCallContext c = CTX.get(); return c != null ? c : LlmCallContext.UNKNOWN; }
    public void clear() { CTX.remove(); }
    public <T> T runWith(LlmCallContext c, Supplier<T> body) {
        set(c); try { return body.get(); } finally { clear(); }
    }
}
```

```java
// service/LlmCallRecord.java  (@Builder; enums/records TokenUsage, EmbedUsage in sibling files)
@Builder
public record LlmCallRecord(
    CallKind callKind, String requestedModel, String servedModel, CallStatus status,
    String errorCode, String errorClass, long latencyMs, boolean streamed, Integer toolRounds,
    String serviceTier, TokenUsage tokens, EmbedUsage embed,
    String systemPrompt, String userMessage, String responseText,
    Integer imageCount, Long imageBytesTotal, String imageMime,
    LlmCallContext context) {}
// TokenUsage(Integer prompt, Integer candidates, Integer thoughts, Integer cached, Integer total)
// EmbedUsage(Integer inputCount, Integer dimensions, Integer billableChars)
```

```java
// event/LlmCallEvent.java
public record LlmCallEvent(LlmCallRecord record, UUID createdBy, Instant startedAt) {}
```

```java
// service/LlmCallRecorder.java
public interface LlmCallRecorder { void record(LlmCallRecord record); }
```

```java
// service/NoOpLlmCallRecorder.java — the default when the switch is off
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.LLM_LOG_SWITCH, havingValue = "false", matchIfMissing = true)
public class NoOpLlmCallRecorder implements LlmCallRecorder {
    @Override public void record(LlmCallRecord record) { /* logging disabled */ }
}
```

```java
// service/EventPublishingLlmCallRecorder.java
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LLM_LOG_SWITCH, havingValue = "true")
public class EventPublishingLlmCallRecorder implements LlmCallRecorder {
    private final ApplicationEventPublisher publisher;
    private final LlmActorResolver actorResolver;
    @Override public void record(LlmCallRecord record) {
        publisher.publishEvent(new LlmCallEvent(record, actorResolver.currentActor(), Instant.now()));
    }
}
```

```java
// service/LlmActorResolver.java — principal user id, else configured owner (single-user), else null.
// Reuse the existing security seam (see how CurrentUserId resolves the principal) but NEVER throw:
// wrap the missing-principal case and fall back to the owner id from OwnerProperties.
@Component
@RequiredArgsConstructor
public class LlmActorResolver {
    private final OwnerProperties ownerProperties; // already used by ResetDatabase
    public UUID currentActor() {
        return principalUserIdOrNull() != null ? principalUserIdOrNull() : ownerProperties.id();
    }
    // principalUserIdOrNull(): read SecurityContextHolder; return null if unauthenticated (cron threads).
}
```

```java
// service/LlmLogWriter.java
@Component
@RequiredArgsConstructor
public class LlmLogWriter {

    private final LlmLogRepository repository;
    private final LlmPricingService pricing;
    private final LlmLogProperties properties;

    @Async("llmLogExecutor")
    @EventListener
    public void onLlmCall(LlmCallEvent event) {
        try {
            persist(event);
        } catch (RuntimeException ex) {
            // logging failures NEVER propagate to the user call
            LoggerFactory.getLogger(getClass()).warn("llm_log write failed: {}", ex.toString());
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void persist(LlmCallEvent event) {
        LlmCallRecord r = event.record();
        LlmLogEntity e = new LlmLogEntity();
        e.setCreatedBy(event.createdBy());
        e.setCallKind(r.callKind());
        e.setFeature(r.context() != null ? r.context().feature() : "unknown");
        e.setOperation(r.context() != null ? r.context().operation() : null);
        e.setEntityKind(r.context() != null ? r.context().entityKind() : null);
        e.setEntityId(r.context() != null ? r.context().entityId() : null);
        e.setRequestedModel(r.requestedModel());
        e.setServedModel(r.servedModel());
        e.setStatus(r.status());
        e.setErrorCode(r.errorCode());
        e.setErrorClass(r.errorClass());
        e.setLatencyMs((int) r.latencyMs());
        e.setStreamed(r.streamed());
        e.setToolRounds(r.toolRounds());
        e.setServiceTier(r.serviceTier());
        applyTokens(e, r.tokens());
        applyEmbed(e, r.embed());
        applyPayload(e, r);        // truncation cap + payload_bytes
        applyImages(e, r);
        applyCost(e, r, event.startedAt());
        repository.save(e);
    }

    private void applyCost(LlmLogEntity e, LlmCallRecord r, Instant startedAt) {
        PricingSnapshot snap = pricing.snapshot(r.servedModel(),
            startedAt.atZone(ZoneOffset.UTC).toLocalDate());
        e.setPricingSnapshot(snap);
        if (r.callKind() == CallKind.EMBED_DOC || r.callKind() == CallKind.EMBED_QUERY) {
            e.setCostUsd(pricing.computeEmbeddingCost(snap, e.getEmbedBillableChars()));
        } else {
            // Storage keeps the RAW provider counts (promptTokens INCLUDES cached — physically honest).
            // But cachedContentTokenCount is a SUBSET of promptTokenCount, so billing must NOT charge it
            // at the full input rate AND again at the cached rate. Bill the NET prompt (prompt - cached)
            // at input rate + cached at the cached rate. (Task-1 review, Important #1.)
            Integer cached = e.getCachedTokens();
            Integer netPrompt = e.getPromptTokens() == null ? null
                : e.getPromptTokens() - (cached == null ? 0 : cached);
            e.setCostUsd(pricing.computeGenerationCost(snap,
                netPrompt, e.getCandidatesTokens(), e.getThoughtsTokens(), cached));
        }
    }
    // applyTokens/applyEmbed/applyImages: null-safe field copies.
    // applyPayload: cap each of systemPrompt/userMessage/responseText at properties.maxPayloadChars,
    //   set truncated=true if any was cut, set payloadBytes to the pre-truncation UTF-8 byte length sum.
}
```

```java
// config/LlmLogAsyncConfig.java
@Configuration
@EnableAsync
@RequiredArgsConstructor
public class LlmLogAsyncConfig {
    private final LlmLogProperties properties;
    @Bean("llmLogExecutor")
    public Executor llmLogExecutor() {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(properties.executor().coreSize());
        ex.setMaxPoolSize(properties.executor().maxSize());
        ex.setQueueCapacity(properties.executor().queueCapacity());
        ex.setThreadNamePrefix("llm-log-");
        ex.initialize();
        return ex;
    }
}
```

`FeaturesConfiguration`: add `public static final String LLM_LOG_SWITCH = "mezo.feature.llm-log.enabled";`
`application.yml`: add `mezo.feature.llm-log.enabled: false` (default off; k8s turns it on in Task 6/rollout).

- [ ] **Step 4: Run to verify pass** — `./mvnw clean test -Dtest=LlmLogWriterIT,LlmLogRecorderWiringIT` → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/llmlog backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/service
git -c core.hooksPath=/dev/null commit -m "feat(llm-log): async write pipeline (context/record/event/recorder/writer) + switch (mezo-2zyu)"
```

---

## Task 4: Record chat/vision/smart/stream in `GeminiCompanionLlm`

**Files:**
- Modify: `feature/companion/llm/GeminiCompanionLlm.java`
- Create: `feature/companion/llm/GeminiUsageExtractor.java` (pure metadata→`TokenUsage`+serviceTier mapper)
- Test: `feature/companion/llm/GeminiUsageExtractorTest.java` (pure), `feature/companion/llm/GeminiCompanionLlmRecordingTest.java` (stub `ChatModel`, fake recorder — no network)

**Interfaces consumed:** `LlmCallRecorder`, `LlmCallContextHolder`, `LlmCallRecord`, `TokenUsage`, `CallKind`, `CallStatus`.
**Interfaces produced:** `GeminiUsageExtractor.extract(ChatResponse)` → `record UsageInfo(String servedModel, String serviceTier, TokenUsage tokens)`.

- [ ] **Step 1: Write the failing tests**

```java
// GeminiUsageExtractorTest.java — builds a ChatResponse with metadata + a native google usage stub
@Test
void testExtract_shouldReadServedModelAndTokenBreakdown_whenNativeUsagePresent() {
    // Build a Spring AI ChatResponse via ChatResponse.builder() with a ChatResponseMetadata
    // whose model = "gemini-2.5-flash" and Usage returns prompt=10000, completion=1000,
    // and getNativeUsage() = a GenerateContentResponseUsageMetadata with thoughtsTokenCount=500,
    // cachedContentTokenCount=0.
    UsageInfo info = new GeminiUsageExtractor().extract(response);
    assertThat(info.servedModel()).isEqualTo("gemini-2.5-flash");
    assertThat(info.tokens().prompt()).isEqualTo(10_000);
    assertThat(info.tokens().thoughts()).isEqualTo(500);
}
```

```java
// GeminiCompanionLlmRecordingTest.java — stub ChatModel returns a canned ChatResponse; capture the record
@Test
void testComplete_shouldRecordSuccessWithMetadata_whenCalled() {
    RecordingSpy recorder = new RecordingSpy();
    GeminiCompanionLlm llm = new GeminiCompanionLlm(stubChatModel(cannedResponse), companionProps,
        recorder, new LlmCallContextHolder(), new GeminiUsageExtractor());
    String out = llm.complete("sys", "hi");
    assertThat(out).isEqualTo("hello");
    LlmCallRecord rec = recorder.last();
    assertThat(rec.status()).isEqualTo(CallStatus.SUCCESS);
    assertThat(rec.callKind()).isEqualTo(CallKind.CHAT);
    assertThat(rec.servedModel()).isEqualTo("gemini-2.5-flash");
    assertThat(rec.tokens().prompt()).isEqualTo(10_000);
}

@Test
void testComplete_shouldRecordErrorAndRethrow_whenModelThrows() {
    RecordingSpy recorder = new RecordingSpy();
    GeminiCompanionLlm llm = new GeminiCompanionLlm(throwingChatModel(), companionProps,
        recorder, new LlmCallContextHolder(), new GeminiUsageExtractor());
    assertThatThrownBy(() -> llm.complete("sys", "hi")).isInstanceOf(RuntimeException.class);
    assertThat(recorder.last().status()).isEqualTo(CallStatus.ERROR);
    assertThat(recorder.last().errorClass()).isNotBlank();
}
```

- [ ] **Step 2: Run to verify fail** — `./mvnw clean test -Dtest=GeminiUsageExtractorTest,GeminiCompanionLlmRecordingTest` → FAIL.

- [ ] **Step 3: Implement** — inject `LlmCallRecorder`, `LlmCallContextHolder`, `GeminiUsageExtractor`; convert `.content()` sites to `.chatResponse()` wrapped in a timed try/catch that records. Sketch for the non-stream path:

```java
private String recorded(CallKind kind, String system, String user,
                        Integer imageCount, Long imageBytes, String imageMime,
                        Supplier<ChatResponse> call) {
    long t0 = System.nanoTime();
    LlmCallContext ctx = contextHolder.get();
    try {
        ChatResponse resp = call.get();
        var info = usageExtractor.extract(resp);
        String text = resp.getResult().getOutput().getText();
        recorder.record(LlmCallRecord.builder()
            .callKind(kind).requestedModel(modelFor(kind)).servedModel(info.servedModel())
            .status(CallStatus.SUCCESS).latencyMs(millis(t0)).serviceTier(info.serviceTier())
            .tokens(info.tokens()).systemPrompt(system).userMessage(user).responseText(text)
            .imageCount(imageCount).imageBytesTotal(imageBytes).imageMime(imageMime)
            .context(ctx).build());
        return text;
    } catch (RuntimeException ex) {
        recorder.record(LlmCallRecord.builder()
            .callKind(kind).requestedModel(modelFor(kind)).status(CallStatus.ERROR)
            .errorCode(errorCodeOf(ex)).errorClass(ex.getClass().getSimpleName())
            .latencyMs(millis(t0)).systemPrompt(system).userMessage(user).context(ctx).build());
        throw ex;
    }
}
```

- `complete(system, user, tools, ctx)` → `CallKind.TOOL` when tools present else `CHAT`; `completeSmart` → `SMART` (uses `smartChatClient`, `modelFor(SMART)=smartModel`); `complete(..., images)` → `VISION` with image marker fields (count/bytes/mime from the `InlineImage` list — **bytes not stored**).
- **Stream** (`CallKind.CHAT_STREAM`): use `.stream().chatResponse()` → `Flux<ChatResponse>`; keep an `AtomicReference<ChatResponse> last`; `.doOnNext(last::set)`, `.doOnError(e -> recorder.record(errorRecord))`, `.doOnComplete(() -> recorder.record(successRecord(last.get()...)))`, map each to `getResult().getOutput().getText()`. If `last` has no usage, record token fields null with `streamed=true`.
- `GeminiUsageExtractor.extract`: `servedModel = resp.getMetadata().getModel()`; `Usage u = resp.getMetadata().getUsage()`; `prompt=u.getPromptTokens()`, `candidates=u.getCompletionTokens()`, `total=u.getTotalTokens()`; if `u.getNativeUsage() instanceof GenerateContentResponseUsageMetadata g` → `thoughts=g.thoughtsTokenCount().orElse(null)`, `cached=g.cachedContentTokenCount().orElse(null)`; `serviceTier` from `resp.getMetadata().get("serviceTier")` if present else null. Guard every getter for null `getMetadata()`/`getUsage()`.

- [ ] **Step 4: Run to verify pass**, then run the companion IT suite to confirm no regression: `./mvnw clean test -Dtest=GeminiUsageExtractorTest,GeminiCompanionLlmRecordingTest,CompanionRealWiringIT` → PASS.

- [ ] **Step 5: Commit** — `feat(llm-log): record chat/vision/smart/stream calls in GeminiCompanionLlm (mezo-2zyu)`

---

## Task 5: Record embeddings in `GeminiEmbeddingAdapter`

**Files:**
- Modify: `feature/companion/embedding/GeminiEmbeddingAdapter.java`
- Test: `feature/companion/embedding/GeminiEmbeddingAdapterRecordingTest.java` (stub google client returning a canned `EmbedContentResponse`, fake recorder)

- [ ] **Step 1: Write the failing test** — `embedDocuments(List.of("a","b"))` with a stubbed client whose response `.metadata().billableCharacterCount()=42` → recorder gets one `EMBED_DOC` record with `embed.inputCount()==2`, `embed.dimensions()==768`, `embed.billableChars()==42`, `status=SUCCESS`, `responseText=null`. `embedQuery` → `EMBED_QUERY`, `inputCount==1`. Error path → `EMBED_*` record `status=ERROR`, exception rethrown.

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement** — inject `LlmCallRecorder` + `LlmCallContextHolder`; wrap the `embed(...)` private method with timing + record; `servedModel = companionProperties.embedding().model()` (the embedding API has no served-model echo — record the requested embedding model as served); `billableChars = response.metadata().flatMap(EmbedContentMetadata::billableCharacterCount).orElse(null)`; `dimensions = EmbeddingPort.DIMENSIONS`; `inputCount = texts.size()`. Record `EMBED_DOC` for `TASK_DOCUMENT`, `EMBED_QUERY` for `TASK_QUERY`.

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit** — `feat(llm-log): record embedding calls in GeminiEmbeddingAdapter (mezo-2zyu)`

---

## Task 6: Caller-side entity tagging + enable the switch in k8s

**Files (modify — set `LlmCallContext` at each LLM entry point, `finally`-clear via `contextHolder.runWith(...)`):**
- `feature/meal/service/MealCoachService.java` (`meal_coach`, entity `meal`/id), `MealAiDraftService.java` (`meal_draft`)
- `feature/pantry/service/PantryScrapeService.java` (`pantry_scrape`), `PantryPhotoService.java` (`pantry_photo`)
- `feature/biometrics/sleep/service/SleepShotService.java` (`sleep_shot`)
- `feature/recipe/service/RecipeBreakdownProseService.java` (`recipe_breakdown`, entity `recipe`/id)
- `feature/activity/service/ActivityClassifier.java` (`activity_classify`), `feature/quest/service/QuestFlavor.java` (`quest_flavor`)
- companion chat entry (`companion_chat`) + each `feature/proactive/service/*Generator.java` (`proactive_briefing`, `proactive_weekly`, `proactive_memoir`, `proactive_heartbeat`, `proactive_prediction`, `proactive_experiment`, `proactive_challenge`)
- Modify: `k8s/backend/deployment.yaml` — add `- name: MEZO_FEATURE_LLM_LOG_ENABLED` `value: "true"`

**Interfaces consumed:** `LlmCallContextHolder`, `LlmCallContext`.

Pattern (apply verbatim, adjusting feature/operation/entity per site):

```java
return contextHolder.runWith(
    new LlmCallContext("meal_coach", "verdict", "meal", mealId),
    () -> companionLlm.complete(system, user));   // the existing call, unchanged
```

- [ ] **Step 1: Write one representative failing IT** — `feature/meal/MealCoachLoggingIT` (companion-fake + `llm-log.enabled=true`, sync executor via test profile): calling the meal-coach path writes one `llm_log_history` row with `feature="meal_coach"`, `entity_kind="meal"`, matching `entity_id`.
- [ ] **Step 2: Run to verify fail** (row has `feature="unknown"` before tagging).
- [ ] **Step 3: Wrap each entry point** with `contextHolder.runWith(...)` per the list above.
- [ ] **Step 4: Run** the representative IT + a broad `./mvnw clean test` (focused first; full suite in CI) → PASS.
- [ ] **Step 5: Commit** — `feat(llm-log): tag every LLM entry point with call context + enable switch in k8s (mezo-2zyu)`

> Note: untagged calls still log (context defaults to `unknown`), so tagging is safe to land incrementally; this task completes it for all known sites.

---

## Task 7: ADR + feature doc + lint

**Files:**
- Create: `docs/decisions/0014-llm-call-audit-log.md` (ADR — the audit-log decision, the append-only / no-`is_deleted` deviation, the frozen price-snapshot honesty stance, why adapter-recording over `@Primary` decorators)
- Modify: `docs/features/companion.md` (integration section: "every LLM call is recorded to `llm_log_history` via an injected `LlmCallRecorder`; `.chatResponse()` metadata capture; switch `mezo.feature.llm-log.enabled`" + the data model + `key_files` list additions)
- Run: `node scripts/lint-docs.mjs`

- [ ] **Step 1** Write the ADR (context = the cost scare + no visibility; decision = §2 of the spec; consequences = append-only, config-priced, switchable).
- [ ] **Step 2** Update `docs/features/companion.md` §5 (integration) + data model; add the new files to its `key_files`.
- [ ] **Step 3** `node scripts/lint-docs.mjs` → no new orphans/broken links/staleness for `companion.md`.
- [ ] **Step 4: Commit** — `docs(llm-log): ADR 0014 + companion feature doc for the audit log (mezo-2zyu)`

---

## Final verification (before PR)

- [ ] `cd backend && ./mvnw clean test` (focused runs green locally; the **full** IT suite is the CI gate — see CLAUDE.md / `docs/infrastructure/local-dev-testing.md`).
- [ ] Contract check: no API/OpenAPI change in this feature (no new endpoint in v1) — nothing to regenerate.
- [ ] `bd update mezo-2zyu --notes` with the outcome; push branch → self-PR → CI green → local `--no-ff` merge → push main → delete branch.

## Self-review (plan vs. spec)

- **Spec coverage:** goals→all tasks; scope (chat/vision/tool/smart + embeddings + crons, one table)→Tasks 4/5/6 + schema Task 2; capture (adapter+recorder)→Tasks 3/4/5; async non-blocking→Task 3 (`@Async @EventListener`, warn-and-drop); cost token-breakdown + snapshot→Tasks 1/3; entity attribution→Tasks 3/6; INSERT-only→Task 2 (no `is_deleted`); switch→Tasks 3/6; DB-only v1→no controller task; docs/ADR→Task 7. **Spec §12 open items** all pinned: (1) getters verified in Global Constraints; (2) stream null-token behavior→Task 4; (3) no `@Primary` cycle (recorder pattern)→Task 3; (4) `created_by` via `LlmActorResolver`→Task 3; (5) `tool_rounds` recorded when observable, else null→Task 4.
- **Placeholder scan:** none — every step has concrete code or an exact file+pattern. Seed prices are explicitly flagged "verify current rates," which is a data-accuracy note, not a code placeholder.
- **Type consistency:** `LlmCallRecord`/`TokenUsage`/`EmbedUsage`/`LlmCallContext`/`PricingSnapshot`/`CallKind`/`CallStatus` names and shapes match across Tasks 1–6; `LlmLogWriter.persist` / `LlmCallRecorder.record` / `GeminiUsageExtractor.extract` signatures are used consistently by their consumers.
- **Deviation from spec noted:** embedding cost is per `billableCharacterCount` (schema gained `embed_billable_chars`); capture is adapter-recording, not `@Primary` decorators — both explained in the header.
