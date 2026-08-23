# W3.3 Recall Tuning Pass Implementation Plan (`mezo-b3pp.14`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ambient recall tunable purely from config — per kind-group `min-similarity` and decay τ — guarded by a deterministic, table-shaped eval harness IT, with every recall embed tagged `companion_recall`/`recall_embed`, and (the W3.3 input from `mezo-b3pp.27`) the current conversation's own chat turns excluded from ambient recall.

**Architecture:** `CompanionProperties.AmbientRecall` gets a nested `@Valid` `Group(cap, minSimilarity, decayDays)` record per kind-group (`dailySummary`, `periodSummary`, `journal`, `chatTurn`, `other`) replacing the flat `cap-*` + single `min-similarity`; `PromptMemoryAssembler` reads floor + τ from the group instead of `recall.decayDays()`/`ambient.minSimilarity()`. `MemoryEmbeddingAnnQuery` grows an optional `excludeConversationId` predicate (`ref_id not in (select id from ai_message where conversation_id = :cid)`) used only by the chat_turn group. `MemoryRecallService`'s tool-side query embed is retagged `companion_recall`/`recall_embed`. A new `AmbientRecallEvalIT` seeds a hand-crafted vector corpus and runs a `@ParameterizedTest` table of (query → expected ordered hits); `AmbientRecallTuningIT` proves config-only tuning via `@TestPropertySource`.

**Tech Stack:** Spring Boot 3, `@ConfigurationProperties` records + Jakarta validation, JDBC `NamedParameterJdbcTemplate`, pgvector, JUnit 5 parameterized tests, `companion-fake` profile (`FakeEmbeddingAdapter` `[fake-embed:…]` sentinel).

## Global Constraints

- Spec §11: every embed call wrapped in `LlmCallContextHolder.runWith(new LlmCallContext(feature, operation, entityKind, entityId), …)`; recall feature name is `companion_recall`, operation `recall_embed`.
- Spec §7.3: "no hardcoded numbers" — every floor/τ used by ambient recall must come from `application.yml`.
- Spec §12: no deletion of memory rows; exclusion only changes what recall ASKS for.
- IDENT-3: any embed/ANN failure ⇒ block omitted, turn continues (unchanged contract).
- Config idiom: tuning as nested `@Valid` records in `CompanionProperties`; `CompanionPropertiesIT` binds-from-yaml assertions.
- Tests: integration-first, `@Transactional` + `@ActiveProfiles("companion-fake")`, naming `testX_shouldY_whenZ`. Run focused: `cd backend && ./mvnw test -Dtest='<IT>'` (compose must be up).
- Docs in the same change: `docs/features/companion.md` (W3.1 row, config section ~L2047-2065, test list ~L2943, file list), then `node scripts/lint-docs.mjs` from repo root.
- Commits: conventional, carrying `(mezo-b3pp.14)`.

---

### Task 1: Per-group config record (cap + min-similarity + decay-days)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java:117-145`
- Modify: `backend/src/main/resources/application.yml:433-452`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PromptMemoryAssembler.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java:109-118`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ConsolidationPropertiesIT.java:25`

**Interfaces:**
- Produces: `CompanionProperties.AmbientRecall.Group(int cap, double minSimilarity, int decayDays)`; accessors `ambientRecall().dailySummary()`, `.periodSummary()`, `.journal()`, `.chatTurn()`, `.other()`; flat `capDailySummary/capJournal/capChatTurn/capOther/capPeriodSummary/minSimilarity` REMOVED.

- [ ] **Step 1: Rewrite the binding test**

Replace `testAmbientRecallConfig_shouldBindCapsAndBudgetFromYaml_whenContextStarts` in `CompanionPropertiesIT`:

```java
    @Test
    void testAmbientRecallConfig_shouldBindPerGroupFloorsAndDecayFromYaml_whenContextStarts() {
        CompanionProperties.AmbientRecall ambient = properties.ambientRecall();
        assertThat(ambient.enabled()).isTrue();
        assertThat(ambient.weeklyShadowDays()).isEqualTo(30);
        assertThat(ambient.maxTokens()).isEqualTo(1200);
        assertThat(ambient.dailySummary()).isEqualTo(new CompanionProperties.AmbientRecall.Group(2, 0.55, 90));
        assertThat(ambient.periodSummary()).isEqualTo(new CompanionProperties.AmbientRecall.Group(2, 0.55, 180));
        // W3.3 (mezo-b3pp.14): lived-with 2026-08-22 — the journal family wants a higher floor
        assertThat(ambient.journal()).isEqualTo(new CompanionProperties.AmbientRecall.Group(2, 0.60, 90));
        assertThat(ambient.chatTurn()).isEqualTo(new CompanionProperties.AmbientRecall.Group(1, 0.55, 90));
        assertThat(ambient.other()).isEqualTo(new CompanionProperties.AmbientRecall.Group(1, 0.55, 90));
    }
```

In `ConsolidationPropertiesIT` line 25 change `properties.ambientRecall().capPeriodSummary()` → `properties.ambientRecall().periodSummary().cap()`.

- [ ] **Step 2: Run to verify compile failure**

Run: `cd backend && ./mvnw test -Dtest='CompanionPropertiesIT' -q`
Expected: compilation error (`Group` / `dailySummary()` undefined).

- [ ] **Step 3: Replace the record**

In `CompanionProperties.java` replace the `AmbientRecall` record (keep the javadoc's first paragraph, update it):

```java
    /**
     * W3.1 always-on ambient recall (mezo-b3pp.12, spec §7.1) — the {@code [Emlékek]} block every
     * chat turn opens with. The ANN candidate pool and the per-item render cap are REUSED from
     * {@link Recall}; since W3.3 (mezo-b3pp.14, spec §7.3) the raw-cosine floor and the recency τ
     * are PER KIND-GROUP ({@link Group}) so the block is tuned from yml alone — no number lives in code.
     */
    public record AmbientRecall(
        /** Runtime kill-switch — off ⇒ no embed call and no block; the turn is otherwise unchanged. */
        boolean enabled,
        /** W3.2 coverage cutoff: a daily_summary hit older than this many days is not asked for at
         *  all — its covering weekly/monthly rung speaks for that stretch instead. The fine-grained
         *  rows and vectors stay in the store untouched (spec §12); only recall's reach changes. */
        @Min(1) @Max(3650) int weeklyShadowDays,
        /** Hard cap on the rendered block in ESTIMATED tokens (part of the ~6k memory budget). */
        @Min(100) @Max(6000) int maxTokens,
        /** W3.3 input (mezo-b3pp.27): skip the CURRENT conversation's own chat turns — they are
         *  already in the history window, recalling them is a duplicate. */
        boolean excludeCurrentConversation,
        /** daily_summary (inside the coverage window). */
        @NotNull @Valid Group dailySummary,
        /** weekly_summary + monthly_summary — the ladder rungs (W3.2), queried without a date floor. */
        @NotNull @Valid Group periodSummary,
        /** journal_entry + reflection + gratitude + decision. */
        @NotNull @Valid Group journal,
        /** chat_turn. */
        @NotNull @Valid Group chatTurn,
        /** activity_note + checkin_note. */
        @NotNull @Valid Group other
    ) {
        /** One kind-group's tuning: how many items may enter the block, the raw-cosine floor, and τ. */
        public record Group(
            /** Items allowed into the block (0 = the group is not even queried). */
            @Min(0) @Max(10) int cap,
            /** Raw-cosine floor — below it a match is noise, not a memory (0..1). */
            @DecimalMin("0.0") @DecimalMax("1.0") double minSimilarity,
            /** τ: the recency scale in days — rank = similarity × exp(-age/τ). */
            @Min(1) @Max(3650) int decayDays
        ) {}
    }
```

(`@NotNull`/`@Valid` are already imported — check the file's import block; add `jakarta.validation.constraints.NotNull` if absent.)

- [ ] **Step 4: Rewrite the yml block**

Replace `application.yml` lines 433–452 (`ambient-recall:` … `max-tokens: 1200`) with:

```yaml
    ambient-recall:
      # W3.1 (mezo-b3pp.12, spec §7.1): always-on episodic recall — every chat turn embeds the user
      # message once (feature=companion_recall, operation=recall_embed) and the prompt opens with an
      # [Emlékek] block of similar past episodes. The ANN candidate pool and the per-item render cap
      # reuse mezo.companion.recall.*; a failed embed/ANN just omits the block.
      enabled: true
      # Coverage cutoff (W3.2): daily summaries older than this are no longer asked for — the covering
      # weekly/monthly rung answers for that stretch. Nothing is deleted, only shadowed.
      weekly-shadow-days: 30
      # Hard cap on the rendered block (estimated tokens; ~3 chars/token for Hungarian prose)
      max-tokens: 1200
      # W3.3 input (mezo-b3pp.27): the current conversation's own chat turns are already in the
      # history window — do not recall them as memories
      exclude-current-conversation: true
      # W3.3 (mezo-b3pp.14, spec §7.3): PER KIND-GROUP tuning — the eval harness
      # (AmbientRecallEvalIT) is the regression net when these move. cap = items in the block
      # (0 = group not queried); min-similarity = raw cosine floor; decay-days = τ of the
      # similarity × exp(-age/τ) re-rank.
      daily-summary:
        cap: 2
        min-similarity: 0.55
        decay-days: 90
      # Ladder rungs stand for whole stretches — they fade slower than single days
      period-summary:
        cap: 2
        min-similarity: 0.55
        decay-days: 180
      # Lived-with 2026-08-22: journal hits at 0.59–0.62 were only weakly related → stricter floor
      journal:
        cap: 2
        min-similarity: 0.60
        decay-days: 90
      chat-turn:
        cap: 1
        min-similarity: 0.55
        decay-days: 90
      # activity_note + checkin_note
      other:
        cap: 1
        min-similarity: 0.55
        decay-days: 90
```

- [ ] **Step 5: Wire the assembler to the groups**

In `PromptMemoryAssembler.java`:

Replace the `Group` record and the group list + `recallGroup`/`toItem`:

```java
    /** One ANN query's shape: which kinds, the group's tuning, and the date floor. */
    private record Group(List<String> kinds, CompanionProperties.AmbientRecall.Group tuning,
                         LocalDate notBefore) {}
```

In `recall(...)` replace the `List<Group> groups = List.of(...)` with:

```java
            List<Group> groups = List.of(
                    new Group(KINDS_DAILY_SUMMARY, ambient.dailySummary(), dailyCutoff),
                    new Group(KINDS_PERIOD_SUMMARY, ambient.periodSummary(), null),
                    new Group(KINDS_JOURNAL, ambient.journal(), null),
                    new Group(KINDS_CHAT_TURN, ambient.chatTurn(), null),
                    new Group(KINDS_OTHER, ambient.other(), null));
```

and the loop call `recallGroup(userId, group, literal, today, ambient, recall)` → `recallGroup(userId, group, literal, today, recall)`.

Replace `recallGroup` + `toItem`:

```java
    private List<RecalledItem> recallGroup(UUID userId, Group group, String literal,
                                           LocalDate today, CompanionProperties.Recall recall) {
        CompanionProperties.AmbientRecall.Group tuning = group.tuning();
        if (tuning.cap() == 0) {
            return List.of();
        }
        return annQuery.nearestInKinds(userId, group.kinds(), literal, recall.candidatePool(),
                        group.notBefore())
                .stream()
                // the snapshot already carries today — and a future-dated unit is not a memory yet
                .filter(hit -> hit.occurredOn().isBefore(today))
                .map(hit -> toItem(hit, today, tuning.decayDays()))
                .filter(item -> item.similarity() >= tuning.minSimilarity())
                .sorted(Comparator.comparingDouble(RecalledItem::score).reversed())
                .limit(tuning.cap())
                .toList();
    }
```

(`toItem` is unchanged — it already takes `decayDays`.) Update the class javadoc sentence "the raw-similarity floor and the same similarity × exp(-age/τ) re-rank the V2.3 tool uses" → "a PER-GROUP raw-similarity floor and τ (W3.3, `ambient-recall.<group>.*`) in the V2.3 `similarity × exp(-age/τ)` re-rank".

- [ ] **Step 6: Run the focused ITs**

Run: `cd backend && ./mvnw test -Dtest='CompanionPropertiesIT,ConsolidationPropertiesIT,PromptMemoryAssemblerIT,PromptMemoryAssemblerShadowIT,PromptMemoryAssemblerSwitchOffIT,ChatServiceAmbientRecallIT' -q`
Expected: all PASS (the existing 0.707 journal seed still clears 0.60; decay τ stays 90 for every existing ordering test).

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java backend/src/main/resources/application.yml backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PromptMemoryAssembler.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/ConsolidationPropertiesIT.java
git commit -m "feat(companion): per-group ambient-recall floor + decay in config (mezo-b3pp.14)"
```

---

### Task 2: Exclude the current conversation's chat turns (mezo-b3pp.27 input)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/MemoryEmbeddingAnnQuery.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PromptMemoryAssembler.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/PromptMemoryAssemblerIT.java`

**Interfaces:**
- Consumes: `AmbientRecall.excludeCurrentConversation()` (Task 1).
- Produces: `MemoryEmbeddingAnnQuery.nearestInKinds(UUID userId, Collection<String> kinds, String queryVector, int k, LocalDate notBefore, UUID excludeConversationId)` — both nullable; the existing 4- and 5-arg overloads delegate with nulls.

- [ ] **Step 1: Write the failing IT**

Add to `PromptMemoryAssemblerIT` (add `@Autowired private AiConversationPopulator aiConversationPopulator; @Autowired private AiMessagePopulator aiMessagePopulator;` + imports `io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity`, `io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity`, populators):

```java
    @Test
    void testRecall_shouldSkipOwnConversationsChatTurns_whenTheyAreAlreadyInTheHistoryWindow() {
        UUID owner = userPopulator.createUser().getId();
        AiConversationEntity current = aiConversationPopulator.conversation(owner);
        AiConversationEntity older = aiConversationPopulator.conversation(owner);
        AiMessageEntity ownTurn = aiMessagePopulator.message(current, "ASSISTANT", "saját válasz");
        AiMessageEntity otherTurn = aiMessagePopulator.message(older, "ASSISTANT", "régi válasz");
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, ownTurn.getId(),
                "Daniel: ma\nMezo: saját", TODAY.minusDays(1), MemoryEmbeddingPopulator.axisVector(0));
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, otherTurn.getId(),
                "Daniel: régen\nMezo: régi", TODAY.minusDays(2), MemoryEmbeddingPopulator.axisVector(0));

        AmbientRecall recalled = assembler.recall(owner, current.getId(), AXIS0_QUERY, TODAY);

        // cap-chat-turn is 1 and the own turn is fresher (higher decayed score) — only the
        // exclusion can make the older conversation's turn win
        assertThat(recalled.block()).contains("Daniel: régen").doesNotContain("Daniel: ma");
    }
```

(Check `AiMessagePopulator.message(conversation, role, content)` — role string values: grep `AiMessageEntity` for the role constant / enum and use the assistant value it expects.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest='PromptMemoryAssemblerIT#testRecall_shouldSkipOwnConversationsChatTurns*' -q`
Expected: FAIL — block contains "Daniel: ma".

- [ ] **Step 3: Add the predicate to the ANN query**

In `MemoryEmbeddingAnnQuery`, replace the two SQL constants with a builder (keeps typed params, no `is null or` casts):

```java
    private static final String SQL_HEAD = """
        select id, kind, ref_id, content, occurred_on,
               (embedding <=> cast(:queryVector as vector)) as distance
        from memory_embedding
        where created_by = :userId
          and is_deleted = false
          and kind in (:kinds)
        """;
    /** W3.2 coverage floor (mezo-b3pp.13). */
    private static final String SQL_NOT_BEFORE = "  and occurred_on >= :notBefore\n";
    /** W3.3 (mezo-b3pp.27): chat_turn rows are keyed by the assistant ai_message id — skip the
     *  turns of the conversation being answered, they are already in the history window. */
    private static final String SQL_EXCLUDE_CONVERSATION =
            "  and ref_id not in (select m.id from ai_message m where m.conversation_id = :excludeConversationId)\n";
    private static final String SQL_TAIL = """
        order by embedding <=> cast(:queryVector as vector)
        limit :k
        """;
```

Signatures:

```java
    public List<Hit> nearestInKinds(UUID userId, Collection<String> kinds, String queryVector, int k) {
        return nearestInKinds(userId, kinds, queryVector, k, null, null);
    }

    public List<Hit> nearestInKinds(UUID userId, Collection<String> kinds, String queryVector, int k,
                                    LocalDate notBefore) {
        return nearestInKinds(userId, kinds, queryVector, k, notBefore, null);
    }

    /**
     * Nearest-first hits of the given kinds; {@code notBefore} (W3.2 coverage floor) and
     * {@code excludeConversationId} (W3.3, skip that conversation's own chat turns) are optional
     * predicates — {@code null} means "no filter". Same savepoint contract as the plain call.
     */
    public List<Hit> nearestInKinds(UUID userId, Collection<String> kinds, String queryVector, int k,
                                    LocalDate notBefore, UUID excludeConversationId) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("kinds", kinds)
                .addValue("queryVector", queryVector)
                .addValue("k", k);
        StringBuilder sql = new StringBuilder(SQL_HEAD);
        if (notBefore != null) {
            params.addValue("notBefore", notBefore);
            sql.append(SQL_NOT_BEFORE);
        }
        if (excludeConversationId != null) {
            params.addValue("excludeConversationId", excludeConversationId);
            sql.append(SQL_EXCLUDE_CONVERSATION);
        }
        String statement = sql.append(SQL_TAIL).toString();
        // … the existing savepoint-wrapped execution, unchanged, using `statement`
    }
```

Read the rest of the method first and keep the savepoint code exactly as it is.

- [ ] **Step 4: Pass the conversation id from the assembler**

`PromptMemoryAssembler.Group` gets a fourth component `UUID excludeConversationId`; build:

```java
            UUID excluded = ambient.excludeCurrentConversation() ? conversationId : null;
            List<Group> groups = List.of(
                    new Group(KINDS_DAILY_SUMMARY, ambient.dailySummary(), dailyCutoff, null),
                    new Group(KINDS_PERIOD_SUMMARY, ambient.periodSummary(), null, null),
                    new Group(KINDS_JOURNAL, ambient.journal(), null, null),
                    new Group(KINDS_CHAT_TURN, ambient.chatTurn(), null, excluded),
                    new Group(KINDS_OTHER, ambient.other(), null, null));
```

and in `recallGroup` call `annQuery.nearestInKinds(userId, group.kinds(), literal, recall.candidatePool(), group.notBefore(), group.excludeConversationId())`. Add a class-javadoc paragraph: "W3.3 (mezo-b3pp.27): the chat_turn query skips the conversation being answered (`ambient-recall.exclude-current-conversation`) — those turns are already in the history window."

- [ ] **Step 5: Run the ITs**

Run: `cd backend && ./mvnw test -Dtest='PromptMemoryAssemblerIT,PromptMemoryAssemblerShadowIT,ChatServiceAmbientRecallIT' -q`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/MemoryEmbeddingAnnQuery.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PromptMemoryAssembler.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/PromptMemoryAssemblerIT.java
git commit -m "feat(companion): ambient recall skips the current conversation's own chat turns (mezo-b3pp.14, mezo-b3pp.27)"
```

---

### Task 3: Recall embed tagging for the tool path

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MemoryRecallService.java:46-48`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/MemoryRecallServiceIT.java`

**Interfaces:**
- Produces: the tool's query embed is logged as `feature=companion_recall`, `operation=recall_embed`, `entityKind=tool`, entityId `null` — so the `/me/ai-usage` feature breakdown row `companion_recall` is recall's full cost share (ambient + tool).

- [ ] **Step 1: Write the failing IT**

Look at how `MemoryRecallServiceIT` is set up (profile, populators). Add a test that captures the context the embed port saw. Simplest provider-free probe: `LlmCallContextHolder` exposes `current()` (grep `LlmCallContextHolder.java` for the getter name) — wrap the fake port via a test `@TestConfiguration` is overkill; instead assert through the llm_log if the fake profile records embeds. Check: `grep -rn "recall_embed\|companion_recall" backend/src/test` — `GeminiEmbeddingAdapterRecordingTest` already shows the recording path. If the `companion-fake` profile does NOT write `llm_log`, write the test as a context probe:

```java
    @Test
    void testRecallSimilarDays_shouldTagTheQueryEmbedAsCompanionRecall_whenCalled() {
        UUID owner = userPopulator.createUser().getId();
        AtomicReference<LlmCallContext> seen = new AtomicReference<>();
        EmbeddingPort probe = new EmbeddingPort() {
            @Override public List<float[]> embedDocuments(List<String> texts) { return fake.embedDocuments(texts); }
            @Override public float[] embedQuery(String text) {
                seen.set(contextHolder.current().orElse(null));
                return fake.embedQuery(text);
            }
        };
        MemoryRecallService service = new MemoryRecallService(probe, memoryEmbeddingRepository, properties, contextHolder);

        service.recallSimilarDays(owner, "[fake-embed:1] alvás", 3);

        assertThat(seen.get()).isEqualTo(new LlmCallContext("companion_recall", "recall_embed", "tool", null));
    }
```

Adapt constructor argument order to `MemoryRecallService`'s `@RequiredArgsConstructor` field order and the holder's actual accessor name (read `LlmCallContextHolder.java`). If the holder has no public read accessor, add a package-visible-safe `public Optional<LlmCallContext> current()` — check first whether one exists (`grep -n "public" LlmCallContextHolder.java`).

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest='MemoryRecallServiceIT#testRecallSimilarDays_shouldTagTheQueryEmbedAsCompanionRecall*' -q`
Expected: FAIL — actual context is `("embed_memory","query",null,null)`.

- [ ] **Step 3: Retag**

`MemoryRecallService.java:47`: `new LlmCallContext("embed_memory", "query", null, null)` → `new LlmCallContext("companion_recall", "recall_embed", "tool", null)`; javadoc/comment: "W3.3 (mezo-b3pp.14): tagged like the ambient path so `/me/ai-usage`'s `companion_recall` row is recall's whole cost share."

- [ ] **Step 4: Run**

Run: `cd backend && ./mvnw test -Dtest='MemoryRecallServiceIT,MemoryObservatoryServiceIT' -q`
Expected: PASS. Also `grep -rn "embed_memory" backend/src docs` → no remaining references (fix any doc mention in `companion.md` / `_platform-llm-log.md`-like docs).

- [ ] **Step 5: Commit**

```bash
git add -A backend/src docs
git commit -m "feat(companion): tag the similar-days tool embed as companion_recall/recall_embed (mezo-b3pp.14)"
```

---

### Task 4: Deterministic eval harness IT (the tuning table)

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/AmbientRecallEvalIT.java`

**Interfaces:**
- Consumes: `PromptMemoryAssembler.recall(userId, conversationId, message, today)` → `AmbientRecall(block, refs, items)`; `MemoryEmbeddingPopulator.embedding(owner, kind, refId, content, day, vector)`, `axisVector`, `blendVector`; `FakeEmbeddingAdapter` `[fake-embed:…]` sentinel (components are raw floats then normalized — `[fake-embed:1 1]` = blend(0,1)).

- [ ] **Step 1: Write the harness**

```java
package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.entity.RecalledMemoriesEnvelope;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * W3.3 (mezo-b3pp.14, spec §7.3) — the ambient-recall EVAL HARNESS: a fixed, hand-crafted vector
 * corpus and a TABLE of (query → expected hits in prompt order). Provider-free and deterministic
 * (fake embedder, axis/blend vectors), so it is the regression net for every future
 * {@code mezo.companion.ambient-recall.*} tuning: move a floor or a τ in yml, run this class, and
 * read the table to see which memories moved in, out, or around.
 *
 * <p>Geometry legend — every corpus vector is a unit vector on axes 0..3 or a 45° blend:
 * <pre>
 *   axis 0 = "alvás/futás"     axis 1 = "munka/app"     axis 2 = "fesztivál"     axis 3 = "zaj"
 *   blend(a,b) has cosine 0.707 to both a and b — above every floor (0.55 / 0.60)
 *   the weak vector (0.58·axis0 + 0.81·axis1) has cosine 0.58 to axis 0: clears 0.55
 *   (daily_summary) but NOT the journal floor 0.60 — the lived-with 2026-08-22 case.
 * </pre>
 * Ages are chosen so decay (τ = 90 d, period rungs 180 d) decides ties deterministically.
 */
@Transactional
@ActiveProfiles("companion-fake")
class AmbientRecallEvalIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now();

    @Autowired private PromptMemoryAssembler assembler;
    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;
    @Autowired private UserPopulator userPopulator;

    /** One row of the tuning table. */
    record Case(String name, String query, List<String> expectedGistsInOrder) {
        @Override public String toString() { return name; }
    }

    /** THE TABLE — readable top-down: query → what the [Emlékek] block must carry, in order. */
    static Stream<Case> table() {
        return Stream.of(
            new Case("alvás/futás query: journal + daily + chat + note, freshest-first by decayed score",
                "[fake-embed:1] hogy aludtam futás után?",
                List.of("Jegyzet: esti séta, jó alvás.",           // other, 2 d, sim 1.0
                        "Napló: futás után jobban aludtam.",        // journal, 3 d, sim 1.0
                        "Beszélgetés: alvásról.",                   // chat_turn, 5 d, sim 1.0
                        "Nap: hosszú futás, korai lefekvés.",       // daily, 10 d, sim 1.0
                        "Hét: futóhét, rendezett alvás.")),          // weekly, 40 d, sim 0.707, τ 180
            new Case("weak journal match (0.58) is below the journal floor but a daily at 0.58 stays",
                "[fake-embed:1] hogy aludtam futás után?",
                List.of()),   // placeholder replaced in Step 2 — see the per-case seeding below
            new Case("munka/app query: only the app-journal and the app-day answer",
                "[fake-embed:0 1] mi volt az appal?",
                List.of("Napló: fejleszteni az applikációt.",
                        "Nap: egész nap kódolás.")),
            new Case("fesztivál query: the old stretch speaks through its monthly rung, the weak journal stays out",
                "[fake-embed:0 0 1] mi volt a fesztiválon?",
                List.of("Hónap: fesztiválhónap, kevés alvás.")),
            new Case("zaj query: nothing clears any floor → no block",
                "[fake-embed:0 0 0 1] valami teljesen más",
                List.of())
        );
    }

    private void seed(UUID owner, String kind, String content, int daysAgo, float[] vector) {
        memoryEmbeddingPopulator.embedding(owner, kind, UUID.randomUUID(), content,
                TODAY.minusDays(daysAgo), vector);
    }

    /** The corpus every case runs against — one place, so the table above stays readable. */
    private UUID seedCorpus() {
        UUID owner = userPopulator.createUser().getId();
        float[] a0 = MemoryEmbeddingPopulator.axisVector(0);
        float[] a1 = MemoryEmbeddingPopulator.axisVector(1);
        float[] a2 = MemoryEmbeddingPopulator.axisVector(2);
        float[] weak01 = new float[EmbeddingPort.DIMENSIONS];
        weak01[0] = 0.58f;
        weak01[1] = (float) Math.sqrt(1 - 0.58 * 0.58);
        float[] weak02 = new float[EmbeddingPort.DIMENSIONS];
        weak02[2] = 0.58f;
        weak02[3] = (float) Math.sqrt(1 - 0.58 * 0.58);

        // alvás/futás family
        seed(owner, MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE, "Jegyzet: esti séta, jó alvás.", 2, a0);
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "Napló: futás után jobban aludtam.", 3, a0);
        seed(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, "Beszélgetés: alvásról.\nMezo: igen", 5, a0);
        seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "Nap: hosszú futás, korai lefekvés.", 10, a0);
        seed(owner, MemoryEmbeddingEntity.KIND_WEEKLY_SUMMARY, "Hét: futóhét, rendezett alvás.", 40,
                MemoryEmbeddingPopulator.blendVector(0, 1));
        // the 2026-08-22 lived-with case: a journal line only weakly about sleep (0.58)
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "Napló: fejleszteni az applikációt.", 4, weak01);
        // munka/app family
        seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "Nap: egész nap kódolás.", 6, a1);
        // fesztivál family — old, so the daily is shadowed (weekly-shadow-days 30) and the rung answers
        seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "Nap: fesztivál első napja.", 75, a2);
        seed(owner, MemoryEmbeddingEntity.KIND_MONTHLY_SUMMARY, "Hónap: fesztiválhónap, kevés alvás.", 80, a2);
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "Napló: fesztivál… nincs kedvem.", 70, weak02);
        return owner;
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("table")
    void testRecall_shouldMatchTheTuningTable_whenCorpusIsSeeded(Case c) {
        UUID owner = seedCorpus();

        PromptMemoryAssembler.AmbientRecall recalled =
                assembler.recall(owner, UUID.randomUUID(), c.query(), TODAY);

        assertThat(recalled.items()).extracting(RecalledMemoriesEnvelope.Item::gist)
                .containsExactlyElementsOf(c.expectedGistsInOrder());
    }
}
```

- [ ] **Step 2: Make the table honest — drop the placeholder row and verify the geometry**

Remove the second `Case` (the "placeholder" row) — the weak-journal behaviour is already covered by case 1 ("Napló: fejleszteni az applikációt." must NOT appear) and case 4. Then sanity-check the expectations against the code before running:
- case 1: `weak01` journal is at sim 0.58 < 0.60 → out; `Napló: fejleszteni…` sim to axis 0 is 0.58 → out. The weekly rung at blend(0,1) has sim 0.707 → in, but its decayed score `0.707·e^(−40/180)=0.566` is below the four axis-0 items (scores `e^(−2/90)`…`e^(−10/90)` ≈ 0.98…0.895) → last. Daily cap 2, journal cap 2, chat 1, other 1, period 2 — none exceeded.
- case 3 (`[fake-embed:0 1]`): `Napló: fejleszteni…` has sim 0.81 to axis 1 → in (journal cap 2); `Nap: egész nap kódolás.` sim 1.0, 6 d → score 0.935; journal 0.81·e^(−4/90)=0.775 → **daily first, journal second** → fix the expected order to `List.of("Nap: egész nap kódolás.", "Napló: fejleszteni az applikációt.")`. The weekly blend(0,1) rung has sim 0.707 ≥ 0.55 → ALSO in, score 0.566 → third. Final case 3 expectation: `("Nap: egész nap kódolás.", "Napló: fejleszteni az applikációt.", "Hét: futóhét, rendezett alvás.")`.
- case 4 (`[fake-embed:0 0 1]`): the 75-day daily is beyond the 30-day shadow → not asked; monthly rung sim 1.0, 80 d, τ 180 → in; `weak02` journal sim 0.58 < 0.60 → out. Expectation stands.
- case 5: axis 3 — `weak01`/`weak02` have component 0.81 on axis 1/3 respectively: `weak02` has sim 0.81 to axis 3! → it IS recalled as a journal hit (0.81 ≥ 0.60). Change case 5 to assert exactly `List.of("Napló: fesztivál… nincs kedvem.")` and rename: "zaj query: only the journal line that leans on the noise axis survives". (The table must describe real behaviour, not wishes.)

- [ ] **Step 3: Run the harness**

Run: `cd backend && ./mvnw test -Dtest='AmbientRecallEvalIT' -q`
Expected: all 4 cases PASS. If a case fails, recompute the geometry by hand (similarity = dot product of the NORMALIZED query and the seeded vector; score = sim × exp(−age/τ_group)) and correct the TABLE — never loosen the assertion to `contains`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/companion/AmbientRecallEvalIT.java
git commit -m "test(companion): deterministic ambient-recall eval harness (mezo-b3pp.14)"
```

---

### Task 5: Config-only tuning verification IT

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/AmbientRecallTuningIT.java`

- [ ] **Step 1: Write the IT**

```java
package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.entity.RecalledMemoriesEnvelope;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * W3.3 (mezo-b3pp.14) acceptance "config-only tuning verified": the SAME corpus the default yml
 * renders one way renders another under overridden per-group knobs — no code path changes, only
 * {@code mezo.companion.ambient-recall.<group>.*}. Journal floor raised to 0.8 (a 0.707 journal
 * hit drops while the 0.707 daily stays); chat-turn τ shrunk to 2 days (an old chat turn sinks
 * below a same-similarity, older-by-less daily).
 */
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
        "mezo.companion.ambient-recall.journal.min-similarity=0.8",
        "mezo.companion.ambient-recall.chat-turn.decay-days=2"
})
class AmbientRecallTuningIT extends AbstractIntegrationTest {

    private static final String AXIS0_QUERY = "[fake-embed:1] alvás";
    private static final LocalDate TODAY = LocalDate.now();

    @Autowired private PromptMemoryAssembler assembler;
    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRecall_shouldDropJournalBelowRaisedFloorButKeepDaily_whenJournalFloorOverridden() {
        UUID owner = userPopulator.createUser().getId();
        float[] blend = MemoryEmbeddingPopulator.blendVector(0, 1);            // sim 0.707
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, UUID.randomUUID(),
                "napló 0.707", TODAY.minusDays(1), blend);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, UUID.randomUUID(),
                "nap 0.707", TODAY.minusDays(1), blend);

        PromptMemoryAssembler.AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(), AXIS0_QUERY, TODAY);

        assertThat(recalled.items()).extracting(RecalledMemoriesEnvelope.Item::gist)
                .containsExactly("nap 0.707");
    }

    @Test
    void testRecall_shouldSinkChatTurnBelowOlderDaily_whenChatTurnDecayOverridden() {
        UUID owner = userPopulator.createUser().getId();
        float[] a0 = MemoryEmbeddingPopulator.axisVector(0);
        // chat turn 4 d old: τ=2 ⇒ score e^-2 ≈ 0.135; daily 8 d old: τ=90 ⇒ e^(-8/90) ≈ 0.915
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, UUID.randomUUID(),
                "Daniel: friss beszélgetés", TODAY.minusDays(4), a0);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, UUID.randomUUID(),
                "régebbi nap", TODAY.minusDays(8), a0);

        PromptMemoryAssembler.AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(), AXIS0_QUERY, TODAY);

        assertThat(recalled.items()).extracting(RecalledMemoriesEnvelope.Item::gist)
                .containsExactly("régebbi nap", "Daniel: friss beszélgetés");
    }
}
```

- [ ] **Step 2: Run**

Run: `cd backend && ./mvnw test -Dtest='AmbientRecallTuningIT' -q`
Expected: PASS. (Under default yml the first test would render both and the second would put the chat turn first — the overrides alone flip them.)

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/companion/AmbientRecallTuningIT.java
git commit -m "test(companion): config-only ambient-recall tuning verified (mezo-b3pp.14)"
```

---

### Task 6: Docs + gates

**Files:**
- Modify: `docs/features/companion.md` (status table row ~L596; config section ~L2047–2065; ambient-recall tagging paragraph ~L2312; test list ~L2943)
- Modify: `docs/superpowers/plans/2026-08-18-phase5-roadmap.md` (mark W3.3 row shipped if the table carries status)
- Modify: `docs/CODEMAP.md` if the codemap generator is part of the docs lint (run `node scripts/lint-docs.mjs` and follow what it reports; see memory note "focused ITs miss ArchUnit + codemap").

- [ ] **Step 1: Update `companion.md`**

1. Add a status-table row after the W3.2 row:

```
| Recall tuning pass (W3.3) | ✅ `mezo-b3pp.14` | Ambient recall is tuned from yml ALONE: `ambient-recall.<group>.{cap,min-similarity,decay-days}` per kind-group (`daily-summary` · `period-summary` · `journal` · `chat-turn` · `other`, `CompanionProperties.AmbientRecall.Group`) replaced the flat caps + single floor + borrowed `recall.decay-days`; defaults keep W3.1 behaviour except the **journal floor 0.60** (lived-with 2026-08-22: 0.59–0.62 journal hits were noise) and **period rungs τ=180 d** (a rung stands for a stretch). `AmbientRecallEvalIT` is the regression net — a hand-crafted axis/blend vector corpus + a `@ParameterizedTest` TABLE of (query → expected gists in prompt order); `AmbientRecallTuningIT` proves a `@TestPropertySource` override alone re-ranks/drops items. `mezo-b3pp.27` input: `ambient-recall.exclude-current-conversation` (default true) makes the chat_turn ANN query skip the conversation being answered (`ref_id not in (select id from ai_message where conversation_id = …)` in `MemoryEmbeddingAnnQuery`) — those turns are already the history window. The `find_similar_past_days` tool embed is retagged `companion_recall`/`recall_embed` (`entityKind=tool`), so the `/me/ai-usage` `companion_recall` feature row is recall's whole cost share. |
```

2. Replace the config bullets for `cap-daily-summary`/`cap-journal`/…/`cap-period-summary`/`min-similarity` with:

```
- `mezo.companion.ambient-recall.<group>.cap` / `.min-similarity` / `.decay-days` — W3.3 per
  kind-group tuning (`Group` record, `@Min(0) @Max(10)` / 0..1 / `@Min(1) @Max(3650)`); groups:
  `daily-summary` **2 / 0.55 / 90**, `period-summary` **2 / 0.55 / 180**, `journal` **2 / 0.60 / 90**,
  `chat-turn` **1 / 0.55 / 90**, `other` **1 / 0.55 / 90**. cap 0 ⇒ the group is not queried.
  Tune in yml, then run `AmbientRecallEvalIT` and read its table.
- `mezo.companion.ambient-recall.exclude-current-conversation` = **true** — the chat_turn query
  skips the conversation being answered (mezo-b3pp.27).
```

3. Test list (~L2943): add `AmbientRecallEvalIT` / `AmbientRecallTuningIT` bullets and the new `PromptMemoryAssemblerIT` case; update the MemoryRecallServiceIT bullet if one exists.
4. Grep the doc for `embed_memory` and `ambient-recall.min-similarity` / `cap-journal` and fix every stale mention.

- [ ] **Step 2: Lint docs + codemap**

Run from repo root: `node scripts/lint-docs.mjs`
Expected: no new staleness/broken links. If the codemap is stale, regenerate per the script's instruction (check `scripts/` for the codemap generator) and include `docs/CODEMAP.md`.

- [ ] **Step 3: Full focused gate**

Run: `cd backend && ./mvnw clean test -Dtest='CompanionPropertiesIT,ConsolidationPropertiesIT,PromptMemoryAssemblerIT,PromptMemoryAssemblerShadowIT,PromptMemoryAssemblerSwitchOffIT,ChatServiceAmbientRecallIT,ChatServiceIT,ChatStreamServiceIT,MemoryRecallServiceIT,MemoryObservatoryServiceIT,AmbientRecallEvalIT,AmbientRecallTuningIT,PromptMemoryAssemblerTest,*ArchUnit*' -Dsurefire.failIfNoSpecifiedTests=false`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs(companion): W3.3 recall tuning pass (mezo-b3pp.14)"
```

---

## Self-review

- Spec §7.3 coverage: per-kind floor + τ in config (T1) ✔; eval harness as a table (T4) ✔; config-only tuning verified (T5) ✔; recall embed tagging for `/me/ai-usage` (T3; ambient path already tagged) ✔; docs (T6) ✔. bd input `mezo-b3pp.27` (T2) ✔ — close `.27` with `.14`.
- Type consistency: `AmbientRecall.Group(cap, minSimilarity, decayDays)` used identically in T1/T4/T5; `nearestInKinds(…, LocalDate notBefore, UUID excludeConversationId)` in T2 matches the assembler call.
- Not in scope: FE changes (no API/contract change — `/me/ai-usage` already groups by feature), new tables (none).
