# W3.1 Ambient recall — `[Emlékek]` prompt block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every companion chat turn opens already grounded in relevant past: the user message is embedded once, per-kind ANN recall over `memory_embedding` renders an `[Emlékek]` block into the system prompt (between the pattern-ack block and `TONE_REMINDER`), every recalled item adds a `Memory` ref, and any recall failure silently omits the block without failing the turn.

**Architecture:** A new `PromptMemoryAssembler` service (`feature/companion/service`) owns embed → 4 kind-group ANN queries (new repository method `findNearestInKinds`) → floor/decay/cap → dedupe → token-capped render. `ChatService` calls it from BOTH assembly sites (`prepareTurn` for the stream, `sendMessage` for sync) through one private `assembleSystemPrompt` helper; the recalled refs travel in `PreparedTurn` and are added to the turn's `ToolCallAudit` AFTER the LLM round (tool refs keep priority under the per-turn ref cap). Tuning lives in a new nested `CompanionProperties.AmbientRecall` record bound to `mezo.companion.ambient-recall.*`; τ / candidate pool / per-item render cap are reused from the existing `Recall` record. No API contract change (the `MessageRef` envelope carries free `kind`/`id` strings and `Memory` is already emitted).

**Tech Stack:** Spring Boot 3 / Java 21, Spring Data JPA native queries over pgvector (`<=>` cosine), Lombok, Jakarta validation on config records, JUnit 5 + AssertJ ITs on `AbstractIntegrationTest` (Testcontainers Postgres + `companion-fake` profile with `FakeCompanionLlm` / `FakeEmbeddingAdapter`).

**Driving bd issue:** `mezo-b3pp.12` — every commit subject ends with `(mezo-b3pp.12)`.

**Spec:** `docs/superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md` §7.1 (+ §3 anchors, §11 conventions).

## Global Constraints

- Branch `feat/ambient-recall` (already cut from `origin/main`). Work ONLY inside the worktree `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/phase-3-status-b1a9fa` — never `cd` to the primary repo.
- Run backend commands from `backend/`: `./mvnw test -Dtest='<Class1>,<Class2>' -Dmezo.test.use-testcontainers=true` (the default fixed-DB mode races; Testcontainers mode is the honest local gate; Docker must be running).
- Every LLM/embed call is tagged: `llmCallContextHolder.runWith(new LlmCallContext("companion_recall", "recall_embed", "conversation", conversationId), …)` (spec §11 feature name; `operation=recall_embed` is what §7.3's ai-usage split keys on).
- No `@Value`; no class-level `@Transactional`; no `new RuntimeException/IllegalStateException/IllegalArgumentException` outside `techcore` (ArchUnit `ArchitectureTest`). App-path errors use `new SystemRuntimeErrorException(SystemMessage.error("<KEY>").build())`.
- `@Service` classes live in `..service..`; config records carry Jakarta constraints and the top-level record is `@Validated`.
- Prompt-block convention (mirror `KnowledgeFactService.renderPromptBlock`): the block string is `""` when empty; otherwise it starts with `"\n\n"` + header line ending in `'\n'`, then one `"- …"` line per item ending in `'\n'`. `TONE_REMINDER` must stay the LAST thing in the system prompt (existing ITs assert `endsWith`).
- Defaults live ONLY in `application.yml` (no `@DefaultValue`); every new key must be present there (no `matchIfMissing` anywhere in the codebase).
- Test naming: `test<Method>_should<Outcome>_when<Condition>`; ITs extend `AbstractIntegrationTest`; fake vectors via `MemoryEmbeddingPopulator.axisVector/blendVector`; scripted query embedding via the `[fake-embed:1]` sentinel (→ axis-0 unit vector).
- Docs in the same change: `docs/features/companion.md` + `node scripts/gen-codemap.mjs` (CI `--check`s `docs/CODEMAP.md`) + `node scripts/lint-docs.mjs`.
- Spec values copied verbatim: caps `capDailySummary=2, capJournal=2, capChatTurn=1, capOther=1`; `minSimilarity` 0.55; `max-tokens` 1200; header tag `[Emlékek]`; failure ⇒ block omitted + `degraded=false`.

## File map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java` | 15th component `AmbientRecall ambientRecall` + nested record |
| Modify | `backend/src/main/resources/application.yml` | `mezo.companion.ambient-recall.*` block (after `recall:`) |
| Modify | 3 unit tests constructing `CompanionProperties` positionally (`GeminiCompanionLlmPromptOrderTest`, `GeminiCompanionLlmRecordingTest`, `GeminiEmbeddingAdapterRecordingTest`) | append the 15th arg |
| Modify | `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java` | binding test |
| Modify | `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/MemoryEmbeddingRepository.java` | `findNearestInKinds` |
| Modify | `backend/src/test/java/io/mrkuhne/mezo/feature/companion/MemoryEmbeddingRepositoryIT.java` | its IT |
| Modify | `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeEmbeddingAdapter.java` | `FAIL_EMBED` sentinel |
| Create | `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PromptMemoryAssembler.java` | the feature |
| Create | `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/PromptMemoryAssemblerTest.java` | pure render/cap unit tests |
| Create | `backend/src/test/java/io/mrkuhne/mezo/feature/companion/PromptMemoryAssemblerIT.java` | end-to-end recall IT |
| Create | `backend/src/test/java/io/mrkuhne/mezo/feature/companion/PromptMemoryAssemblerSwitchOffIT.java` | `enabled=false` IT |
| Modify | `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java` | wiring (both paths) |
| Modify | `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatStreamService.java` | refs → audit on the stream path |
| Modify | `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceIT.java`, `ChatStreamServiceIT.java` | wiring ITs |
| Modify | `docs/features/companion.md`, `docs/CODEMAP.md` | docs |

---

### Task 1: Config record `CompanionProperties.AmbientRecall` + yml + binding test

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java`
- Modify: `backend/src/main/resources/application.yml` (insert after the `recall:` block, i.e. after the line `render-max-chars: 300` and before `    summary:`)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlmPromptOrderTest.java` (method `minimalCompanionProperties()`, around lines 89–103)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlmRecordingTest.java` (around lines 343–346)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/GeminiEmbeddingAdapterRecordingTest.java` (around lines 215–216)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java`

**Interfaces:**
- Produces: `CompanionProperties.ambientRecall()` → `record AmbientRecall(boolean enabled, int capDailySummary, int capJournal, int capChatTurn, int capOther, double minSimilarity, int maxTokens)`.

- [ ] **Step 1: Write the failing binding test** — append to `CompanionPropertiesIT`:

```java
    @Test
    void testAmbientRecallConfig_shouldBindCapsAndBudgetFromYaml_whenContextStarts() {
        assertThat(properties.ambientRecall().enabled()).isTrue();
        assertThat(properties.ambientRecall().capDailySummary()).isEqualTo(2);
        assertThat(properties.ambientRecall().capJournal()).isEqualTo(2);
        assertThat(properties.ambientRecall().capChatTurn()).isEqualTo(1);
        assertThat(properties.ambientRecall().capOther()).isEqualTo(1);
        assertThat(properties.ambientRecall().minSimilarity()).isEqualTo(0.55);
        assertThat(properties.ambientRecall().maxTokens()).isEqualTo(1200);
    }
```

- [ ] **Step 2: Run it to see it fail (compile error: no `ambientRecall()`)**

Run: `cd backend && ./mvnw test -Dtest='CompanionPropertiesIT' -Dmezo.test.use-testcontainers=true -q 2>&1 | tail -30`
Expected: COMPILATION ERROR mentioning `ambientRecall`.

- [ ] **Step 3: Add the record + component.** In `CompanionProperties`, add the 15th component after `Transcription transcription`:

```java
    @NotNull @Valid Transcription transcription,
    @NotNull @Valid AmbientRecall ambientRecall
) {
```

and add the nested record after the `Recall` record:

```java
    /**
     * W3.1 always-on ambient recall (mezo-b3pp.12, spec §7.1) — the {@code [Emlékek]} block every
     * chat turn opens with. τ ({@code recall.decayDays}), the ANN candidate pool and the per-item
     * render cap ({@code recall.renderMaxChars}) are REUSED from {@link Recall}; only what the block
     * itself needs lives here.
     */
    public record AmbientRecall(
        /** Runtime kill-switch — off ⇒ no embed call and no block; the turn is otherwise unchanged. */
        boolean enabled,
        /** Per kind-group caps: items allowed into the block (0 = the group is not even queried). */
        @Min(0) @Max(10) int capDailySummary,
        /** journal_entry + reflection + gratitude + decision share this cap. */
        @Min(0) @Max(10) int capJournal,
        @Min(0) @Max(10) int capChatTurn,
        /** activity_note + checkin_note share this cap. */
        @Min(0) @Max(10) int capOther,
        /** Raw-cosine floor for ambient items — stricter than the tool's: a broad block must not carry noise. */
        @DecimalMin("0.0") @DecimalMax("1.0") double minSimilarity,
        /** Hard cap on the rendered block in ESTIMATED tokens (part of the ~6k memory budget). */
        @Min(100) @Max(6000) int maxTokens
    ) {}
```

- [ ] **Step 4: Add the yml block** — in `application.yml`, directly after `      render-max-chars: 300` (end of the `recall:` block) and before `    summary:`:

```yaml
    ambient-recall:
      # W3.1 (mezo-b3pp.12, spec §7.1): always-on episodic recall — every chat turn embeds the user
      # message once (operation=recall_embed) and the prompt opens with an [Emlékek] block of similar
      # past episodes (journal family, daily summaries, chat turns, notes). τ, the ANN candidate pool
      # and the per-item render cap reuse mezo.companion.recall.*; a failed embed/ANN just omits the block.
      enabled: true
      # Per kind-group caps (items in the block): daily_summary | journal family | chat_turn | notes
      cap-daily-summary: 2
      cap-journal: 2
      cap-chat-turn: 1
      cap-other: 1
      # Raw cosine floor — stricter than the tool's 0.25: a broad ambient block must not carry noise
      min-similarity: 0.55
      # Hard cap on the rendered block (estimated tokens; ~3 chars/token for Hungarian prose)
      max-tokens: 1200
```

- [ ] **Step 5: Fix the three positional constructors.**

`GeminiCompanionLlmPromptOrderTest.minimalCompanionProperties()` — append after `new Transcription(5_242_880, List.of("audio/wav"))`:
```java
                new Transcription(5_242_880, List.of("audio/wav")),
                new AmbientRecall(true, 2, 2, 1, 1, 0.55, 1200));
```
(and add `AmbientRecall` to the file's existing static/nested import list of `CompanionProperties.*` records — follow how `Transcription` is imported in that file).

`GeminiCompanionLlmRecordingTest` (the `new CompanionProperties(new CompanionProperties.Llm(CHAT_MODEL, SMART_MODEL), null, …)` call) — append one more `null` so there are 14 `null`s after `Llm`.

`GeminiEmbeddingAdapterRecordingTest` (the `new CompanionProperties(null, …, new CompanionProperties.Embedding(EMBED_MODEL, false, 2_000, true, 80, 200), null, …)` call) — append one more trailing `null`.

- [ ] **Step 6: Run the binding IT + the three unit tests**

Run: `cd backend && ./mvnw test -Dtest='CompanionPropertiesIT,GeminiCompanionLlmPromptOrderTest,GeminiCompanionLlmRecordingTest,GeminiEmbeddingAdapterRecordingTest' -Dmezo.test.use-testcontainers=true -q 2>&1 | tail -30`
Expected: all PASS (`BUILD SUCCESS`).

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlmPromptOrderTest.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlmRecordingTest.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/GeminiEmbeddingAdapterRecordingTest.java
git commit -m "feat(companion): ambient-recall config record + yml defaults (mezo-b3pp.12)"
```

---

### Task 2: Repository `findNearestInKinds`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/MemoryEmbeddingRepository.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/MemoryEmbeddingRepositoryIT.java`

**Interfaces:**
- Produces: `List<MemoryMatch> findNearestInKinds(UUID userId, Collection<String> kinds, String queryVector, int k)` — same projection as `findNearest` (`getId/getKind/getRefId/getContent/getOccurredOn/getDistance`), nearest first, restricted to `kind in (:kinds)`.

- [ ] **Step 1: Write the failing test** — append to `MemoryEmbeddingRepositoryIT` (the file already has `DAY`, `memoryEmbeddingPopulator`, `userPopulator`, `within`):

```java
    @Test
    void testFindNearestInKinds_shouldRestrictToGivenKindsAndOrderByDistance_whenMixedKindsSeeded() {
        UUID owner = userPopulator.createUser().getId();
        MemoryEmbeddingEntity journal = memoryEmbeddingPopulator.embedding(
            owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, UUID.randomUUID(), "napló", DAY,
            MemoryEmbeddingPopulator.axisVector(0));
        MemoryEmbeddingEntity gratitude = memoryEmbeddingPopulator.embedding(
            owner, MemoryEmbeddingEntity.KIND_GRATITUDE, UUID.randomUUID(), "hála", DAY.minusDays(1),
            MemoryEmbeddingPopulator.blendVector(0, 1));
        // same geometry, but a kind OUTSIDE the requested set — must not appear
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, DAY, 0);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, DAY, 0);

        List<MemoryMatch> matches = memoryEmbeddingRepository.findNearestInKinds(owner,
            List.of(MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, MemoryEmbeddingEntity.KIND_GRATITUDE,
                    MemoryEmbeddingEntity.KIND_REFLECTION, MemoryEmbeddingEntity.KIND_DECISION),
            MemoryEmbeddingRepository.toVectorLiteral(MemoryEmbeddingPopulator.axisVector(0)), 10);

        assertThat(matches).extracting(MemoryMatch::getId).containsExactly(journal.getId(), gratitude.getId());
        assertThat(matches.get(0).getDistance()).isCloseTo(0.0, within(1e-6));
        assertThat(matches.get(1).getKind()).isEqualTo(MemoryEmbeddingEntity.KIND_GRATITUDE);
    }

    @Test
    void testFindNearestInKinds_shouldLimitToKAndExcludeOtherUsers_whenManyRows() {
        UUID owner = userPopulator.createUser().getId();
        UUID stranger = userPopulator.createUser().getId();
        for (int i = 0; i < 5; i++) {
            memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, DAY.minusDays(i), 0);
        }
        memoryEmbeddingPopulator.embedding(stranger, MemoryEmbeddingEntity.KIND_CHAT_TURN, DAY, 0);

        List<MemoryMatch> matches = memoryEmbeddingRepository.findNearestInKinds(owner,
            List.of(MemoryEmbeddingEntity.KIND_CHAT_TURN),
            MemoryEmbeddingRepository.toVectorLiteral(MemoryEmbeddingPopulator.axisVector(0)), 3);

        assertThat(matches).hasSize(3);
        assertThat(matches).allSatisfy(m -> assertThat(m.getKind()).isEqualTo(MemoryEmbeddingEntity.KIND_CHAT_TURN));
    }
```

- [ ] **Step 2: Run to verify it fails (compile error)**

Run: `cd backend && ./mvnw test -Dtest='MemoryEmbeddingRepositoryIT' -Dmezo.test.use-testcontainers=true -q 2>&1 | tail -20`
Expected: COMPILATION ERROR `findNearestInKinds`.

- [ ] **Step 3: Add the query** — in `MemoryEmbeddingRepository`, after `findNearest` (add `import java.util.Collection;`):

```java
    /**
     * W3.1 (mezo-b3pp.12): the same ANN search restricted to a SET of kinds — one query per
     * kind-group of the ambient {@code [Emlékek]} block ({@code PromptMemoryAssembler}). Nearest
     * first. {@code kinds} must be non-empty (an empty {@code in ()} is a SQL error) — callers
     * skip groups whose cap is 0 instead of passing an empty set.
     */
    @Query(value = """
        select id, kind, ref_id as "refId", content, occurred_on as "occurredOn",
               (embedding <=> cast(:queryVector as vector)) as distance
        from memory_embedding
        where created_by = :userId
          and is_deleted = false
          and kind in (:kinds)
        order by embedding <=> cast(:queryVector as vector)
        limit :k
        """, nativeQuery = true)
    List<MemoryMatch> findNearestInKinds(@Param("userId") UUID userId, @Param("kinds") Collection<String> kinds,
                                         @Param("queryVector") String queryVector, @Param("k") int k);
```

- [ ] **Step 4: Run the IT**

Run: `cd backend && ./mvnw test -Dtest='MemoryEmbeddingRepositoryIT' -Dmezo.test.use-testcontainers=true -q 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/MemoryEmbeddingRepository.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/MemoryEmbeddingRepositoryIT.java
git commit -m "feat(companion): kind-set ANN query for ambient recall (mezo-b3pp.12)"
```

---

### Task 3: `FakeEmbeddingAdapter` failure sentinel

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeEmbeddingAdapter.java`

**Interfaces:**
- Produces: `FakeEmbeddingAdapter.FAIL_EMBED = "[fake-embed-fail]"` — any text containing it makes `embedQuery`/`embedDocuments` throw `SystemRuntimeErrorException` (the real adapter's invalid-response error), so ITs can stage an embed failure through the port. (Must not contain `[fake-fail]` as a substring — that sentinel fails the fake LLM turn itself — and must not match `EMBED_SENTINEL`, which requires a `:`.)

No dedicated test here — Task 5's failure IT exercises it; this task is pure scaffolding that Task 5 depends on.

- [ ] **Step 1: Add the sentinel.** Add imports `io.mrkuhne.mezo.techcore.exception.SystemMessage` and `io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException`; add the constant after `EMBED_SENTINEL`:

```java
    /**
     * Failure sentinel (W3.1): a text containing it makes the port throw the same
     * {@code SystemRuntimeErrorException} the real adapter raises on a malformed provider response —
     * ITs stage "the embed hop is down" without Mockito. Distinct from the fake LLM's
     * {@code [fake-fail]} (which fails the TURN, not the embed).
     */
    public static final String FAIL_EMBED = "[fake-embed-fail]";
```

and at the top of `vectorFor`:

```java
    private float[] vectorFor(String text) {
        if (text.contains(FAIL_EMBED)) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("COMPANION_EMBEDDING_INVALID_RESPONSE").build());
        }
        Matcher m = EMBED_SENTINEL.matcher(text);
```

Update the class javadoc's "Scripted vectors" paragraph with one sentence: `A {@code [fake-embed-fail]} sentinel makes the port throw instead (failure-path ITs).`

- [ ] **Step 2: Compile + ArchUnit (the raw-exception rule must stay green — we throw the app exception, not a raw one)**

Run: `cd backend && ./mvnw test -Dtest='ArchitectureTest,MemoryRecallServiceIT' -Dmezo.test.use-testcontainers=true -q 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeEmbeddingAdapter.java
git commit -m "test(companion): fake embedding port failure sentinel (mezo-b3pp.12)"
```

---

### Task 4: `PromptMemoryAssembler` — pure render + token cap (unit-tested)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PromptMemoryAssembler.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/PromptMemoryAssemblerTest.java`

**Interfaces:**
- Produces (public): `PromptMemoryAssembler.MEMORIES_HEADER` (String); `record AmbientRecall(String block, List<RefsEnvelope.Ref> refs)` with `AmbientRecall.EMPTY`; `AmbientRecall recall(UUID userId, UUID conversationId, String userMessage, LocalDate today)` (implemented in Task 5 — this task ships the class with the pure helpers and a `recall` that is fully implemented too; tests for the DB path come in Task 5).
- Produces (package-private, for tests): `record RecalledItem(String kind, UUID refId, LocalDate occurredOn, String content, double similarity, double score)`; `record Rendered(String block, List<RecalledItem> rendered)` with `Rendered.EMPTY`; `static Rendered renderBlock(List<RecalledItem> items, int maxTokens, int renderMaxChars)`; `static String oneLine(String content, int maxChars)`; `static int estimateTokens(int chars)`; `static final Map<String,String> KIND_LABELS`; `static final int CHARS_PER_TOKEN = 3`.

- [ ] **Step 1: Write the failing unit tests**

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler.RecalledItem;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler.Rendered;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The pure half of W3.1 ambient recall — rendering, the one-line gist, the token cap. No Spring. */
class PromptMemoryAssemblerTest {

    private static final LocalDate DAY = LocalDate.of(2026, 8, 10);

    private static RecalledItem item(String kind, String content, double score) {
        return new RecalledItem(kind, UUID.randomUUID(), DAY, content, 0.9, score);
    }

    @Test
    void testRenderBlock_shouldRenderDateKindTagAndGist_whenItemsGiven() {
        Rendered rendered = PromptMemoryAssembler.renderBlock(List.of(
                item("journal_entry", "futás után jobban aludtam\nmásodik sor", 0.9),
                item("daily_summary", "Kemény nap volt.", 0.8)), 1200, 300);

        assertThat(rendered.block()).startsWith(PromptMemoryAssembler.MEMORIES_HEADER);
        assertThat(rendered.block()).contains("- 2026-08-10 (napló): futás után jobban aludtam\n");
        assertThat(rendered.block()).contains("- 2026-08-10 (napi összefoglaló): Kemény nap volt.\n");
        assertThat(rendered.block()).doesNotContain("második sor");
        assertThat(rendered.rendered()).hasSize(2);
    }

    @Test
    void testRenderBlock_shouldReturnEmpty_whenNoItems() {
        assertThat(PromptMemoryAssembler.renderBlock(List.of(), 1200, 300)).isSameAs(Rendered.EMPTY);
        assertThat(Rendered.EMPTY.block()).isEmpty();
    }

    @Test
    void testRenderBlock_shouldStopAtFirstOverflowingItem_whenBudgetTight() {
        String longText = "x".repeat(200);
        // header ≈ 100 chars; each line ≈ 230 chars → with a 120-token (360-char) budget only ONE line fits
        Rendered rendered = PromptMemoryAssembler.renderBlock(List.of(
                item("journal_entry", longText, 0.9),
                item("daily_summary", longText, 0.8),
                item("chat_turn", "rövid", 0.7)), 120, 300);

        assertThat(rendered.rendered()).hasSize(1);
        assertThat(rendered.rendered().getFirst().kind()).isEqualTo("journal_entry");
        // relevance order is sacred: the short third item must NOT sneak in past the overflowing second
        assertThat(rendered.block()).doesNotContain("rövid");
        assertThat(PromptMemoryAssembler.estimateTokens(rendered.block().length())).isLessThanOrEqualTo(120);
    }

    @Test
    void testRenderBlock_shouldReturnEmpty_whenEvenFirstItemOverflows() {
        Rendered rendered = PromptMemoryAssembler.renderBlock(
                List.of(item("journal_entry", "x".repeat(300), 0.9)), 100, 300);

        assertThat(rendered).isSameAs(Rendered.EMPTY);
    }

    @Test
    void testRenderBlock_shouldFallBackToRawKind_whenKindHasNoLabel() {
        Rendered rendered = PromptMemoryAssembler.renderBlock(
                List.of(item("monthly_summary", "havi", 0.9), item("mystery_kind", "x", 0.8)), 1200, 300);

        assertThat(rendered.block()).contains("(havi összefoglaló): havi");
        assertThat(rendered.block()).contains("(mystery_kind): x");
    }

    @Test
    void testOneLine_shouldTakeFirstLineAndTruncateWithEllipsis_whenLongMultiline() {
        assertThat(PromptMemoryAssembler.oneLine("  első sor  \nmásodik", 300)).isEqualTo("első sor");
        assertThat(PromptMemoryAssembler.oneLine("a".repeat(310), 300)).isEqualTo("a".repeat(300) + "…");
        assertThat(PromptMemoryAssembler.oneLine("Daniel: kérdés\nMezo: válasz", 300)).isEqualTo("Daniel: kérdés");
    }

    @Test
    void testEstimateTokens_shouldRoundUpAtThreeCharsPerToken_whenCalled() {
        assertThat(PromptMemoryAssembler.estimateTokens(0)).isZero();
        assertThat(PromptMemoryAssembler.estimateTokens(1)).isEqualTo(1);
        assertThat(PromptMemoryAssembler.estimateTokens(3)).isEqualTo(1);
        assertThat(PromptMemoryAssembler.estimateTokens(4)).isEqualTo(2);
    }
}
```

- [ ] **Step 2: Run to verify it fails (class missing)**

Run: `cd backend && ./mvnw test -Dtest='PromptMemoryAssemblerTest' -q 2>&1 | tail -20`
Expected: COMPILATION ERROR.

- [ ] **Step 3: Create the class (full implementation — Task 5 only adds tests for the DB/embed path)**

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository.MemoryMatch;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * W3.1 always-on ambient recall (mezo-b3pp.12, spec §7.1): every chat turn opens already grounded
 * in relevant past. The incoming user message is embedded ONCE (RETRIEVAL_QUERY), four kind-group
 * ANN searches run over {@code memory_embedding} with per-group caps, the raw-similarity floor and
 * the same {@code similarity × exp(-age/τ)} re-rank the V2.3 tool uses, and the survivors render
 * as the {@code [Emlékek]} block under a hard token cap. Broad ambient recall — the
 * {@code find_similar_past_days} tool stays for deep, targeted recall on demand.
 *
 * <p>Failure honesty (IDENT-3): an embed/ANN failure is logged and the block is simply omitted —
 * the turn itself is fine, so the caller's {@code degraded} flag is NOT touched. The realistic
 * failure is the embed network hop (outside the DB); the ANN query shares the turn's transaction
 * exactly like the tool path's {@code MemoryRecallService} does today.
 *
 * <p>Dedupe: today's episodes are skipped (the context snapshot already carries the day), and
 * items are keyed by {@code (kind, ref_id)} so no unit enters the block twice.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PromptMemoryAssembler {

    /** Header of the block — same "\n\n…:\n" shape as the facts/pattern-ack headers. */
    public static final String MEMORIES_HEADER = "\n\n[Emlékek] (hasonló korábbi epizódok — nyersanyag,"
            + " nem felolvasandó lista; dátum (forrás): kivonat):\n";

    /** What one turn's ambient recall produced: the rendered block ("" when nothing) + the Memory refs. */
    public record AmbientRecall(String block, List<RefsEnvelope.Ref> refs) {
        public static final AmbientRecall EMPTY = new AmbientRecall("", List.of());
    }

    /** One recalled unit after re-ranking (package-private: the render tests build these by hand). */
    record RecalledItem(String kind, UUID refId, LocalDate occurredOn, String content,
                        double similarity, double score) {}

    /** The render result: the block text + exactly the items that made it in under the cap. */
    record Rendered(String block, List<RecalledItem> rendered) {
        static final Rendered EMPTY = new Rendered("", List.of());
    }

    static final List<String> KINDS_DAILY_SUMMARY = List.of(MemoryEmbeddingEntity.KIND_DAILY_SUMMARY);
    static final List<String> KINDS_JOURNAL = List.of(MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY,
            MemoryEmbeddingEntity.KIND_REFLECTION, MemoryEmbeddingEntity.KIND_GRATITUDE,
            MemoryEmbeddingEntity.KIND_DECISION);
    static final List<String> KINDS_CHAT_TURN = List.of(MemoryEmbeddingEntity.KIND_CHAT_TURN);
    static final List<String> KINDS_OTHER = List.of(MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE,
            MemoryEmbeddingEntity.KIND_CHECKIN_NOTE);

    /** Hungarian source tag per kind — unknown kinds fall back to the raw kind string. */
    static final Map<String, String> KIND_LABELS = Map.ofEntries(
            Map.entry(MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "napi összefoglaló"),
            Map.entry(MemoryEmbeddingEntity.KIND_WEEKLY_SUMMARY, "heti összefoglaló"),
            Map.entry("monthly_summary", "havi összefoglaló"),
            Map.entry(MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "napló"),
            Map.entry(MemoryEmbeddingEntity.KIND_REFLECTION, "esti reflexió"),
            Map.entry(MemoryEmbeddingEntity.KIND_GRATITUDE, "hála"),
            Map.entry(MemoryEmbeddingEntity.KIND_DECISION, "döntés"),
            Map.entry(MemoryEmbeddingEntity.KIND_CHAT_TURN, "korábbi beszélgetés"),
            Map.entry(MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE, "aktivitás-jegyzet"),
            Map.entry(MemoryEmbeddingEntity.KIND_CHECKIN_NOTE, "check-in jegyzet"));

    /** Conservative chars-per-token for accented, agglutinative Hungarian prose (Gemini ≈ 3–3.5). */
    static final int CHARS_PER_TOKEN = 3;

    private final EmbeddingPort embeddingPort;
    private final MemoryEmbeddingRepository memoryEmbeddingRepository;
    private final CompanionProperties properties;
    private final LlmCallContextHolder llmCallContextHolder;

    /**
     * The block for one turn. {@code today} is the snapshot's day — episodes of that day are
     * skipped. Never throws: any failure ⇒ {@link AmbientRecall#EMPTY} + a warn log.
     */
    public AmbientRecall recall(UUID userId, UUID conversationId, String userMessage, LocalDate today) {
        CompanionProperties.AmbientRecall ambient = properties.ambientRecall();
        if (!ambient.enabled() || userMessage == null || userMessage.isBlank()) {
            return AmbientRecall.EMPTY;
        }
        try {
            float[] queryVector = llmCallContextHolder.runWith(
                    new LlmCallContext("companion_recall", "recall_embed", "conversation", conversationId),
                    () -> embeddingPort.embedQuery(userMessage));
            String literal = MemoryEmbeddingRepository.toVectorLiteral(queryVector);
            CompanionProperties.Recall recall = properties.recall();

            // (kind, ref_id)-keyed so a unit can never enter twice; groups are disjoint today, the
            // map is the cheap guarantee that they stay so.
            Map<String, RecalledItem> byUnit = new LinkedHashMap<>();
            for (RecalledItem item : recallGroup(userId, KINDS_DAILY_SUMMARY, ambient.capDailySummary(),
                    literal, today, ambient, recall)) {
                byUnit.putIfAbsent(item.kind() + ':' + item.refId(), item);
            }
            for (RecalledItem item : recallGroup(userId, KINDS_JOURNAL, ambient.capJournal(),
                    literal, today, ambient, recall)) {
                byUnit.putIfAbsent(item.kind() + ':' + item.refId(), item);
            }
            for (RecalledItem item : recallGroup(userId, KINDS_CHAT_TURN, ambient.capChatTurn(),
                    literal, today, ambient, recall)) {
                byUnit.putIfAbsent(item.kind() + ':' + item.refId(), item);
            }
            for (RecalledItem item : recallGroup(userId, KINDS_OTHER, ambient.capOther(),
                    literal, today, ambient, recall)) {
                byUnit.putIfAbsent(item.kind() + ':' + item.refId(), item);
            }
            List<RecalledItem> items = new ArrayList<>(byUnit.values());
            items.sort(Comparator.comparingDouble(RecalledItem::score).reversed());

            Rendered rendered = renderBlock(items, ambient.maxTokens(), recall.renderMaxChars());
            if (rendered.rendered().isEmpty()) {
                return AmbientRecall.EMPTY;
            }
            // Memory refs carry the DATE (the V2.3 tool's convention — the FE chip is generic);
            // two items of one day collapse to one ref.
            LinkedHashSet<RefsEnvelope.Ref> refs = new LinkedHashSet<>();
            for (RecalledItem item : rendered.rendered()) {
                refs.add(new RefsEnvelope.Ref("Memory", item.occurredOn().toString()));
            }
            return new AmbientRecall(rendered.block(), List.copyOf(refs));
        } catch (RuntimeException e) {
            log.warn("Ambient recall skipped for conversation {} — the turn continues without [Emlékek]",
                    conversationId, e);
            return AmbientRecall.EMPTY;
        }
    }

    private List<RecalledItem> recallGroup(UUID userId, List<String> kinds, int cap, String literal,
                                           LocalDate today, CompanionProperties.AmbientRecall ambient,
                                           CompanionProperties.Recall recall) {
        if (cap == 0) {
            return List.of();
        }
        return memoryEmbeddingRepository.findNearestInKinds(userId, kinds, literal, recall.candidatePool())
                .stream()
                // the snapshot already carries today — and a future-dated unit is not a memory yet
                .filter(match -> match.getOccurredOn().isBefore(today))
                .map(match -> toItem(match, today, recall.decayDays()))
                .filter(item -> item.similarity() >= ambient.minSimilarity())
                .sorted(Comparator.comparingDouble(RecalledItem::score).reversed())
                .limit(cap)
                .toList();
    }

    private static RecalledItem toItem(MemoryMatch match, LocalDate today, int decayDays) {
        double similarity = 1.0 - match.getDistance();
        long ageDays = Math.max(0, ChronoUnit.DAYS.between(match.getOccurredOn(), today));
        double score = similarity * Math.exp(-(double) ageDays / decayDays);
        return new RecalledItem(match.getKind(), match.getRefId(), match.getOccurredOn(),
                match.getContent(), similarity, score);
    }

    /**
     * Renders relevance-ordered items under the token cap. Stops at the FIRST item that would
     * overflow — a later, shorter item never jumps ahead of a more relevant one (the order IS the
     * relevance statement). Empty when nothing fits.
     */
    static Rendered renderBlock(List<RecalledItem> items, int maxTokens, int renderMaxChars) {
        if (items.isEmpty()) {
            return Rendered.EMPTY;
        }
        StringBuilder block = new StringBuilder(MEMORIES_HEADER);
        List<RecalledItem> rendered = new ArrayList<>();
        for (RecalledItem item : items) {
            String line = "- " + item.occurredOn()
                    + " (" + KIND_LABELS.getOrDefault(item.kind(), item.kind()) + "): "
                    + oneLine(item.content(), renderMaxChars) + '\n';
            if (estimateTokens(block.length() + line.length()) > maxTokens) {
                break;
            }
            block.append(line);
            rendered.add(item);
        }
        return rendered.isEmpty() ? Rendered.EMPTY : new Rendered(block.toString(), List.copyOf(rendered));
    }

    /** The gist: first line only (chat turns are "Daniel: …\nMezo: …"), capped like the tool's render. */
    static String oneLine(String content, int maxChars) {
        String first = content.strip();
        int newline = first.indexOf('\n');
        if (newline >= 0) {
            first = first.substring(0, newline).strip();
        }
        return first.length() > maxChars ? first.substring(0, maxChars) + "…" : first;
    }

    /** Ceil(chars / CHARS_PER_TOKEN) — an estimate, deliberately conservative. */
    static int estimateTokens(int chars) {
        return (chars + CHARS_PER_TOKEN - 1) / CHARS_PER_TOKEN;
    }
}
```

- [ ] **Step 4: Run the unit tests**

Run: `cd backend && ./mvnw test -Dtest='PromptMemoryAssemblerTest' -q 2>&1 | tail -20`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PromptMemoryAssembler.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/PromptMemoryAssemblerTest.java
git commit -m "feat(companion): PromptMemoryAssembler — ambient recall block under a token cap (mezo-b3pp.12)"
```

---

### Task 5: `PromptMemoryAssemblerIT` — recall over seeded vectors, caps, floor, today-skip, refs, failure

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/PromptMemoryAssemblerIT.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/PromptMemoryAssemblerSwitchOffIT.java`

**Interfaces:**
- Consumes: `PromptMemoryAssembler.recall(userId, conversationId, message, today)` → `AmbientRecall(block, refs)`; `MemoryEmbeddingPopulator.embedding(createdBy, kind, refId, content, occurredOn, vector)`; `FakeEmbeddingAdapter.FAIL_EMBED`; `RefsEnvelope.Ref(kind, id)`.

- [ ] **Step 1: Write the ITs (they fail only if Task 4's logic is wrong — this is the acceptance net of spec §7.1)**

```java
package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler.AmbientRecall;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * W3.1 ambient recall over hand-seeded vectors + the fake embedder's {@code [fake-embed:…]}
 * scripted query: per-group caps, the similarity floor, today-skip, decayed ordering, Memory
 * refs, and the failure path — all provider-free.
 */
@Transactional
@ActiveProfiles("companion-fake")
class PromptMemoryAssemblerIT extends AbstractIntegrationTest {

    /** Query whose fake embedding is exactly axis-0 — cosine geometry is then hand-computable. */
    private static final String AXIS0_QUERY = "[fake-embed:1] hogy aludtam futás után?";
    private static final LocalDate TODAY = LocalDate.now();

    @Autowired private PromptMemoryAssembler assembler;
    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;
    @Autowired private UserPopulator userPopulator;

    private void seed(UUID owner, String kind, String content, LocalDate day, float[] vector) {
        memoryEmbeddingPopulator.embedding(owner, kind, UUID.randomUUID(), content, day, vector);
    }

    @Test
    void testRecall_shouldRenderRelevantEpisodesWithDateAndKindTag_whenSimilarMemoriesExist() {
        UUID owner = userPopulator.createUser().getId();
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "futás után jobban aludtam", TODAY.minusDays(3),
                MemoryEmbeddingPopulator.axisVector(0));
        seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "Kemény nap volt.\nMásodik sor.", TODAY.minusDays(10),
                MemoryEmbeddingPopulator.axisVector(0));
        seed(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, "Daniel: alvás?\nMezo: jó volt", TODAY.minusDays(5),
                MemoryEmbeddingPopulator.axisVector(0));
        seed(owner, MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE, "hosszú esti séta a parton", TODAY.minusDays(2),
                MemoryEmbeddingPopulator.axisVector(0));

        AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(), AXIS0_QUERY, TODAY);

        assertThat(recalled.block()).startsWith(PromptMemoryAssembler.MEMORIES_HEADER);
        assertThat(recalled.block()).contains("- " + TODAY.minusDays(3) + " (napló): futás után jobban aludtam\n");
        assertThat(recalled.block()).contains("- " + TODAY.minusDays(10) + " (napi összefoglaló): Kemény nap volt.\n");
        assertThat(recalled.block()).doesNotContain("Második sor");
        assertThat(recalled.block()).contains("(korábbi beszélgetés): Daniel: alvás?");
        assertThat(recalled.block()).contains("(aktivitás-jegyzet): hosszú esti séta");
        assertThat(recalled.refs()).containsExactlyInAnyOrder(
                new RefsEnvelope.Ref("Memory", TODAY.minusDays(2).toString()),
                new RefsEnvelope.Ref("Memory", TODAY.minusDays(3).toString()),
                new RefsEnvelope.Ref("Memory", TODAY.minusDays(5).toString()),
                new RefsEnvelope.Ref("Memory", TODAY.minusDays(10).toString()));
    }

    @Test
    void testRecall_shouldCapEachKindGroup_whenMoreMatchesThanCap() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 3; i++) {
            seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "összefoglaló " + i, TODAY.minusDays(i),
                    MemoryEmbeddingPopulator.axisVector(0));
        }
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "napló 1", TODAY.minusDays(1), MemoryEmbeddingPopulator.axisVector(0));
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "napló 2", TODAY.minusDays(2), MemoryEmbeddingPopulator.axisVector(0));
        seed(owner, MemoryEmbeddingEntity.KIND_GRATITUDE, "hála 1", TODAY.minusDays(3), MemoryEmbeddingPopulator.axisVector(0));
        seed(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, "Daniel: a\nMezo: b", TODAY.minusDays(1), MemoryEmbeddingPopulator.axisVector(0));
        seed(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, "Daniel: c\nMezo: d", TODAY.minusDays(2), MemoryEmbeddingPopulator.axisVector(0));

        AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(), AXIS0_QUERY, TODAY);

        String block = recalled.block();
        assertThat(block.split("\\(napi összefoglaló\\)", -1).length - 1).isEqualTo(2);   // cap-daily-summary
        assertThat(block).contains("összefoglaló 1").contains("összefoglaló 2").doesNotContain("összefoglaló 3");
        // the journal FAMILY shares cap-journal=2: the two fresher journal rows win over the older gratitude
        assertThat(block.split("\\(napló\\)", -1).length - 1 + block.split("\\(hála\\)", -1).length - 1).isEqualTo(2);
        assertThat(block).doesNotContain("hála 1");
        assertThat(block.split("\\(korábbi beszélgetés\\)", -1).length - 1).isEqualTo(1);      // cap-chat-turn
    }

    @Test
    void testRecall_shouldDropMatchesBelowFloorAndKeepMidMatches_whenGeometryStaged() {
        UUID owner = userPopulator.createUser().getId();
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "ortogonális zaj", TODAY.minusDays(1),
                MemoryEmbeddingPopulator.axisVector(1));                       // similarity 0.0
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "félig hasonló", TODAY.minusDays(1),
                MemoryEmbeddingPopulator.blendVector(0, 1));                   // similarity 0.707 ≥ 0.55

        AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(), AXIS0_QUERY, TODAY);

        assertThat(recalled.block()).contains("félig hasonló").doesNotContain("ortogonális zaj");
    }

    @Test
    void testRecall_shouldSkipTodaysEpisodes_whenSnapshotAlreadyCoversTheDay() {
        UUID owner = userPopulator.createUser().getId();
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "ma írt napló", TODAY, MemoryEmbeddingPopulator.axisVector(0));
        seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "jövőbeli", TODAY.plusDays(1), MemoryEmbeddingPopulator.axisVector(0));

        AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(), AXIS0_QUERY, TODAY);

        assertThat(recalled).isSameAs(AmbientRecall.EMPTY);
    }

    @Test
    void testRecall_shouldOrderByDecayedScore_whenSameSimilarityDifferentAge() {
        UUID owner = userPopulator.createUser().getId();
        seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "régi nap", TODAY.minusDays(60), MemoryEmbeddingPopulator.axisVector(0));
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "friss napló", TODAY.minusDays(2), MemoryEmbeddingPopulator.axisVector(0));

        AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(), AXIS0_QUERY, TODAY);

        assertThat(recalled.block().indexOf("friss napló")).isLessThan(recalled.block().indexOf("régi nap"));
    }

    @Test
    void testRecall_shouldReturnEmpty_whenUserHasNoMemories() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(assembler.recall(owner, UUID.randomUUID(), AXIS0_QUERY, TODAY)).isSameAs(AmbientRecall.EMPTY);
    }

    @Test
    void testRecall_shouldReturnEmptyAndNotThrow_whenEmbeddingFails() {
        UUID owner = userPopulator.createUser().getId();
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "lenne mit felidézni", TODAY.minusDays(1),
                MemoryEmbeddingPopulator.axisVector(0));

        AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(),
                FakeEmbeddingAdapter.FAIL_EMBED + " hogy aludtam?", TODAY);

        assertThat(recalled).isSameAs(AmbientRecall.EMPTY);
    }

    @Test
    void testRecall_shouldReturnEmpty_whenMessageBlank() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(assembler.recall(owner, UUID.randomUUID(), "   ", TODAY)).isSameAs(AmbientRecall.EMPTY);
    }
}
```

And the switch-off IT (own Spring context via `@TestPropertySource` — the `CompanionAdvisorsSwitchOffIT` idiom):

```java
package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler.AmbientRecall;
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

/** Ambient recall off ⇒ no block even with a perfect match on disk (the embed hop is skipped too). */
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.ambient-recall.enabled=false")
class PromptMemoryAssemblerSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private PromptMemoryAssembler assembler;
    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRecall_shouldReturnEmpty_whenAmbientRecallDisabled() {
        UUID owner = userPopulator.createUser().getId();
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, UUID.randomUUID(),
                "tökéletes találat", LocalDate.now().minusDays(1), MemoryEmbeddingPopulator.axisVector(0));

        AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(), "[fake-embed:1] alvás", LocalDate.now());

        assertThat(recalled).isSameAs(AmbientRecall.EMPTY);
    }
}
```

- [ ] **Step 2: Run both ITs**

Run: `cd backend && ./mvnw test -Dtest='PromptMemoryAssemblerIT,PromptMemoryAssemblerSwitchOffIT' -Dmezo.test.use-testcontainers=true -q 2>&1 | tail -40`
Expected: PASS (9 tests). If `testRecall_shouldCapEachKindGroup…` fails on the journal-family count, check that `KINDS_JOURNAL` includes `gratitude` and that the group is sorted by score before `limit(cap)`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/companion/PromptMemoryAssemblerIT.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/PromptMemoryAssemblerSwitchOffIT.java
git commit -m "test(companion): ambient recall ITs — caps, floor, today-skip, refs, failure, switch (mezo-b3pp.12)"
```

---

### Task 6: Wire the block into `ChatService` (both paths) + refs into the audit

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatStreamService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatStreamServiceIT.java`

**Interfaces:**
- Consumes: `PromptMemoryAssembler.recall(...)` → `AmbientRecall(block, refs)`.
- Produces: `ChatService.PreparedTurn` gains a 6th component `List<RefsEnvelope.Ref> recalledRefs` (only `ChatService.prepareTurn` constructs it; `ChatStreamService` reads it).

- [ ] **Step 1: Write the failing ITs.** Add to `ChatServiceIT` (add `@Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;` and imports for `MemoryEmbeddingEntity`, `MemoryEmbeddingPopulator`, `FakeEmbeddingAdapter`, `PromptMemoryAssembler`):

```java
    @Test
    void testSendMessage_shouldInjectMemoriesBlockBetweenPatternAckAndToneReminder_whenSimilarMemoriesExist() {
        UUID userId = databasePopulator.populateUser("chat-memories@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        factPopulator.fact(userId, "Laktózérzékeny", "health", 2);
        memoryEmbeddingPopulator.embedding(userId, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, UUID.randomUUID(),
                "futás után jobban aludtam", LocalDate.now().minusDays(3), MemoryEmbeddingPopulator.axisVector(0));

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(),
                request("[fake-embed:1] hogy aludtam futás után?"));

        String echoed = answer.getContent();
        String systemBlock = echoed.substring(echoed.indexOf("system=["), echoed.indexOf("] history=["));
        int facts = systemBlock.indexOf("MEGERŐSÍTETT TÉNYEK");
        int memories = systemBlock.indexOf(PromptMemoryAssembler.MEMORIES_HEADER);
        int tone = systemBlock.indexOf(ChatService.TONE_REMINDER);
        assertThat(facts).isPositive();
        assertThat(memories).isGreaterThan(facts);
        assertThat(tone).isGreaterThan(memories);
        assertThat(systemBlock).contains("(napló): futás után jobban aludtam");
        assertThat(systemBlock).endsWith(ChatService.TONE_REMINDER);
        // every recalled item is a Memory/date ref — on the wire and on the persisted row
        assertThat(answer.getRefs()).extracting(MessageRef::getKind, MessageRef::getId)
                .contains(org.assertj.core.groups.Tuple.tuple("Memory", LocalDate.now().minusDays(3).toString()));
        assertThat(lastAssistantRow(conversation.getId(), userId).getRefs().refs())
                .contains(new io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope.Ref(
                        "Memory", LocalDate.now().minusDays(3).toString()));
        assertThat(answer.getDegraded()).isFalse();
    }

    @Test
    void testSendMessage_shouldOmitMemoriesBlockAndStayHealthy_whenEmbeddingFails() {
        UUID userId = databasePopulator.populateUser("chat-memories-fail@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        memoryEmbeddingPopulator.embedding(userId, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, UUID.randomUUID(),
                "lenne mit felidézni", LocalDate.now().minusDays(1), MemoryEmbeddingPopulator.axisVector(0));

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(),
                request(FakeEmbeddingAdapter.FAIL_EMBED + " hogy aludtam?"));

        String echoed = answer.getContent();
        String systemBlock = echoed.substring(echoed.indexOf("system=["), echoed.indexOf("] history=["));
        // IDENT-3: the block is simply absent — the turn is NOT degraded and the prompt shape is intact
        assertThat(systemBlock).doesNotContain("[Emlékek]");
        assertThat(systemBlock).endsWith(ChatService.TONE_REMINDER);
        assertThat(answer.getDegraded()).isFalse();
        assertThat(answer.getRefs()).isEmpty();
        assertThat(messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(conversation.getId(), userId))
                .hasSize(2);
    }

    @Test
    void testSendMessage_shouldOmitMemoriesBlock_whenNothingSimilar() {
        UUID userId = databasePopulator.populateUser("chat-memories-none@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("szia"));

        assertThat(answer.getContent()).doesNotContain("[Emlékek]");
        assertThat(answer.getRefs()).isEmpty();
    }

    @Test
    void testSendMessage_shouldKeepToolRefsAheadOfMemoryRefs_whenBothPresent() {
        UUID userId = databasePopulator.populateUser("chat-memories-order@test.local");
        sleepLogPopulator.createSleepLog(userId, LocalDate.now(), new BigDecimal("7.0"), 3);
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        memoryEmbeddingPopulator.embedding(userId, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, UUID.randomUUID(),
                "futás után jobban aludtam", LocalDate.now().minusDays(3), MemoryEmbeddingPopulator.axisVector(0));

        MessageResponse resp = chatService.sendMessage(userId, conversation.getId(),
                request("[fake-embed:1] aludtam eleget? [fake-tool:get_recovery {\"scope\":\"sleep\",\"days\":3}]"));

        // the answer's own provenance (tool refs) wins the per-turn ref cap; ambient refs follow
        List<String> kinds = resp.getRefs().stream().map(MessageRef::getKind).toList();
        assertThat(kinds).contains("Sleep", "Memory");
        assertThat(kinds.indexOf("Memory")).isGreaterThan(kinds.lastIndexOf("Sleep"));
        assertThat(kinds.getLast()).isEqualTo("Memory");
    }
```

Add to `ChatStreamServiceIT` (add `@Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;` + imports for `MemoryEmbeddingEntity`, `MemoryEmbeddingPopulator`, `PromptMemoryAssembler`, `MessageRef`):

```java
    @Test
    void testStreamMessage_shouldInjectMemoriesBlockAndCarryMemoryRefsOnDone_whenSimilarMemoriesExist() {
        UUID userId = databasePopulator.populateUser("stream-memories@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        factPopulator.fact(userId, "Laktózérzékeny", "health", 2);
        memoryEmbeddingPopulator.embedding(userId, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, UUID.randomUUID(),
                "futás után jobban aludtam", LocalDate.now().minusDays(3), MemoryEmbeddingPopulator.axisVector(0));

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(), request("[fake-embed:1] hogy aludtam futás után?"))
                .collectList().block();

        // prepareTurn is the STREAMED assembly site — it must carry the same block as sendMessage
        String streamed = events.stream()
                .filter(e -> "delta".equals(e.event()))
                .map(e -> ((StreamDelta) e.data()).getText())
                .reduce("", String::concat);
        String systemBlock = streamed.substring(streamed.indexOf("system=["), streamed.indexOf("] history=["));
        assertThat(systemBlock.indexOf(PromptMemoryAssembler.MEMORIES_HEADER))
                .isGreaterThan(systemBlock.indexOf("MEGERŐSÍTETT TÉNYEK"));
        assertThat(systemBlock).contains("(napló): futás után jobban aludtam");
        assertThat(systemBlock).endsWith(ChatService.TONE_REMINDER);

        MessageResponse done = (MessageResponse) events.getLast().data();
        assertThat(done.getRefs()).extracting(MessageRef::getKind, MessageRef::getId)
                .contains(org.assertj.core.groups.Tuple.tuple("Memory", LocalDate.now().minusDays(3).toString()));
        AiMessageEntity assistant = messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(conversation.getId(), userId)
                .getLast();
        assertThat(assistant.getRefs().refs()).extracting(r -> r.kind()).contains("Memory");
    }
```

- [ ] **Step 2: Run to verify they fail** (no block, no refs)

Run: `cd backend && ./mvnw test -Dtest='ChatServiceIT,ChatStreamServiceIT' -Dmezo.test.use-testcontainers=true -q 2>&1 | tail -40`
Expected: the 5 new tests FAIL (assertions on `[Emlékek]` / `Memory`); the existing ones pass.

- [ ] **Step 3: Wire `ChatService`.**

(a) Inject the assembler — add a field after `knowledgeFactService`:
```java
    private final KnowledgeFactService knowledgeFactService;
    /** W3.1 — the always-on [Emlékek] block (mezo-b3pp.12). */
    private final PromptMemoryAssembler promptMemoryAssembler;
```

(b) Extend `PreparedTurn`:
```java
    /** One prepared chat turn — everything the LLM call needs, produced inside one transaction.
     *  {@code recalledRefs} (W3.1) are the ambient-recall Memory refs the stream path adds to its audit. */
    public record PreparedTurn(UUID conversationId, UUID userMessageId, String systemPrompt,
                               List<Turn> history, String userContent, List<RefsEnvelope.Ref> recalledRefs) {}
```

(c) Add ONE private assembly helper (so the two paths cannot drift) right above `loadWindow`:
```java
    /**
     * The canonical system prompt: voice → snapshot (V0.3) → top-N facts (V1.1) → fresh
     * pattern-facts acknowledgment (V3.3) → [Emlékek] ambient recall (W3.1) → [the W2.4
     * Összefüggések block slots in here when the graph gate opens] → TONE_REMINDER (mezo-q71s,
     * always last). The history travels as real prior messages, not a transcript in here.
     */
    private String assembleSystemPrompt(UUID userId, LocalDate today, String memoriesBlock) {
        return SYSTEM_PROMPT
                + contextSnapshotAssembler.render(userId, today)
                + knowledgeFactService.renderPromptBlock(userId)
                + knowledgeFactService.renderNewPatternFactsBlock(userId)
                + memoriesBlock
                + TONE_REMINDER;
    }
```

(d) `prepareTurn` becomes:
```java
    @Transactional
    public PreparedTurn prepareTurn(UUID userId, UUID conversationId, SendMessageRequest request) {
        AiConversationEntity conversation = conversationService.getOwned(userId, conversationId);
        LocalDate today = LocalDate.now();
        PromptMemoryAssembler.AmbientRecall recalled =
                promptMemoryAssembler.recall(userId, conversationId, request.getContent(), today);
        String systemPrompt = assembleSystemPrompt(userId, today, recalled.block());
        List<Turn> history = toTurns(loadWindow(userId, conversationId));
        AiMessageEntity userRow = persistMessage(
                conversation, userId, AiMessageEntity.ROLE_USER, request.getContent(), null, null, false);
        touchConversation(conversation, request.getContent());
        return new PreparedTurn(conversationId, userRow.getId(), systemPrompt, history, request.getContent(),
                recalled.refs());
    }
```

(e) `sendMessage`: replace the inline assembly (the `String systemPrompt = SYSTEM_PROMPT + … + TONE_REMINDER;` statement and its comment) with:
```java
        // Window BEFORE persisting the new message — the current content travels as the user param.
        // Prompt order: see assembleSystemPrompt. The history travels as real prior messages
        // (mezo-q71s), not a transcript inside the system prompt.
        LocalDate today = LocalDate.now();
        PromptMemoryAssembler.AmbientRecall recalled =
                promptMemoryAssembler.recall(userId, conversationId, request.getContent(), today);
        String systemPrompt = assembleSystemPrompt(userId, today, recalled.block());
```
and right BEFORE the `AiMessageEntity assistant = persistMessage(…)` line add:
```java
        // W3.1: ambient Memory refs join the audit AFTER the LLM round — tool refs are the answer's
        // own provenance and win the per-turn ref cap; the recalled days fill what is left.
        recalled.refs().forEach(ref -> audit.addRef(ref.kind(), ref.id()));
```

(f) `ChatStreamService`: inside the `Mono.fromCallable(() -> { … })` block, right before the `return ServerSentEvent.<Object>builder(chatService.completeTurn(…))` statement, add:
```java
                    // W3.1: ambient Memory refs after the tool loop + review — tool refs keep cap priority
                    turn.recalledRefs().forEach(ref -> audit.addRef(ref.kind(), ref.id()));
```

- [ ] **Step 4: Run the wiring ITs + ArchUnit + the assembler ITs**

Run: `cd backend && ./mvnw test -Dtest='ChatServiceIT,ChatStreamServiceIT,ArchitectureTest,PromptMemoryAssemblerIT,CompanionAdvisorsSwitchOffIT' -Dmezo.test.use-testcontainers=true -q 2>&1 | tail -40`
Expected: PASS. (`CompanionAdvisorsSwitchOffIT` is included because it drives `sendMessage` under a different context — the new collaborator must resolve there too.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatStreamService.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceIT.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatStreamServiceIT.java
git commit -m "feat(companion): [Emlékek] ambient recall block in every chat turn, both paths (mezo-b3pp.12)"
```

---

### Task 7: Broader local gate (companion suite slice) + `bd` hygiene

**Files:** none new.

- [ ] **Step 1: Run every IT that boots the companion chat or touches `CompanionProperties`/`memory_embedding`** (the full suite is CI's job):

Run: `cd backend && ./mvnw clean test -Dtest='ArchitectureTest,CompanionPropertiesIT,MemoryEmbeddingRepositoryIT,MemoryRecallServiceIT,PromptMemoryAssemblerTest,PromptMemoryAssemblerIT,PromptMemoryAssemblerSwitchOffIT,ChatServiceIT,ChatStreamServiceIT,CompanionAdvisorsSwitchOffIT,CompanionMemorySwitchOffIT,CompanionMemorySimilarDaysApiIT,CompanionMemoryLlmUsageApiIT,GeminiCompanionLlmPromptOrderTest,GeminiCompanionLlmRecordingTest,GeminiEmbeddingAdapterRecordingTest,*ChatApi*IT,*Companion*ApiIT' -Dmezo.test.use-testcontainers=true -q 2>&1 | tail -40`
Expected: `BUILD SUCCESS`. Any failure → fix in the owning task's files, re-run, amend nothing — make a fix commit.

- [ ] **Step 2: Frontend is untouched** — no contract change, no FE code; skip the FE gates (state this in the PR body). Verify: `git diff --stat origin/main -- api frontend` prints nothing.

- [ ] **Step 3: Record the follow-up** the implementation surfaced (not in scope, spec-silent):

```bash
bd create "W3.3 input: ambient recall may re-surface the current conversation's own recent chat_turns (already in the history window) — consider excluding the active conversation's turns / the history window's days in the recall tuning pass" -t task -p 3 --parent mezo-b3pp
```

---

### Task 8: Docs — `companion.md` + CODEMAP + lint

**Files:**
- Modify: `docs/features/companion.md`
- Regenerate: `docs/CODEMAP.md`

- [ ] **Step 1: Edit `docs/features/companion.md`** (line numbers are as of `origin/main` today — re-grep the quoted phrases before editing):

(a) In §1 the V2.3 bullet list (grep `Tool-only recall for now`): replace that bullet with:
```
- **Ambient recall is always-on since W3.1 (`mezo-b3pp.12`)** — see the Phase 5 table below; the
  tool stays for deep, targeted recall on demand.
```

(b) In the Phase 5 seams table (grep `| Episodic recall in chat | ✅ V2.3 |`), add a row directly after it:
```
| Ambient recall in chat (W3.1) | ✅ `mezo-b3pp.12` | `service/PromptMemoryAssembler` — every turn embeds the user message once (`LlmCallContext("companion_recall","recall_embed")`), runs four kind-group ANN queries (`MemoryEmbeddingRepository.findNearestInKinds`: daily_summary · journal family (journal_entry/reflection/gratitude/decision) · chat_turn · notes (activity_note/checkin_note)) with the V2.3 floor+decay re-rank, skips today (the snapshot's day), caps per group (`ambient-recall.cap-*`), dedupes by `(kind, ref_id)` and renders the **`[Emlékek]`** block (date + `(forrás)` tag + first-line gist ≤ `recall.render-max-chars`) under `ambient-recall.max-tokens` (estimated at 3 chars/token; stops at the first overflowing item — relevance order is never reshuffled). Position: pattern-ack → **[Emlékek]** → *(W2.4 Összefüggések slot)* → `TONE_REMINDER`. Every rendered item adds a `Memory`/date ref **after** the tool loop (tool refs keep priority under `tools.max-refs-per-turn`). IDENT-3: an embed/ANN failure logs + omits the block; `degraded` stays `false`. Runtime kill-switch `ambient-recall.enabled`. |
```

(c) In §3, both prompt-order renderings (grep `+ knowledgeFactService.renderNewPatternFactsBlock(userId)     ── V3.3 ──` and the stream-path line `prompt = voice + snapshot + facts + pattern-ack + TONE_REMINDER`): insert the W3.1 line so they read
```
                      + knowledgeFactService.renderNewPatternFactsBlock(userId)     ── V3.3 ──
                      + promptMemoryAssembler.recall(userId, id, content, today).block()  ── W3.1 ──
                      + TONE_REMINDER                                              ── mezo-q71s ──
```
and
```
         prompt = voice + snapshot + facts + pattern-ack + [Emlékek] (W3.1) + TONE_REMINDER (mezo-q71s: history is
```
Also mention in the stream path step list that `PreparedTurn.recalledRefs` are added to the audit right before `completeTurn` (after the advisor review).

(d) §4 config bullets — after the `mezo.companion.recall.render-max-chars` bullet add:
```
- `mezo.companion.ambient-recall.enabled` = **true** — W3.1 runtime kill-switch (off ⇒ no embed call, no block).
- `mezo.companion.ambient-recall.cap-daily-summary` / `cap-journal` / `cap-chat-turn` / `cap-other` =
  **2 / 2 / 1 / 1** (`@Min(0) @Max(10)`) — per kind-group caps on the `[Emlékek]` block (journal =
  journal_entry+reflection+gratitude+decision; other = activity_note+checkin_note).
- `mezo.companion.ambient-recall.min-similarity` = **0.55** (0..1) — raw-cosine floor for ambient
  items (stricter than the tool's 0.25).
- `mezo.companion.ambient-recall.max-tokens` = **1200** (`@Min(100) @Max(6000)`) — hard cap on the
  rendered block in estimated tokens (3 chars/token). τ, candidate pool and the per-item render
  cap are reused from `mezo.companion.recall.*`.
```

(e) §5 LLM-call-site paragraph (grep `companion chat/summary/extraction/hypotheses/recall/embedding/advisor`): add `ambient recall (`companion_recall`/`recall_embed`, W3.1)` to the list and bump the call-site count by one.

(f) §8 Testing — add one bullet: ``- `PromptMemoryAssemblerTest` (pure render/cap) · `PromptMemoryAssemblerIT` (caps, floor, today-skip, decayed order, Memory refs, `FakeEmbeddingAdapter.FAIL_EMBED` failure path) · `PromptMemoryAssemblerSwitchOffIT`; `ChatServiceIT`/`ChatStreamServiceIT` pin the block between the pattern-ack block and `TONE_REMINDER` on BOTH paths and the tool-refs-first ref order.``

(g) §10 Key files — add under the backend list:
``- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PromptMemoryAssembler.java` — W3.1 ambient recall: embed-once → 4 kind-group ANN → floor/decay/cap → `[Emlékek]` render under the token cap + Memory refs; never throws.``

(h) Frontmatter: keep `updated: 2026-08-22` (already today); if `key_files:` lists `ChatService.java`, leave it (it's what makes staleness honest).

- [ ] **Step 2: Regenerate the codemap and lint**

Run: `node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs 2>&1 | tail -15`
Expected: CODEMAP regenerated (diff shows the new class under `companion`); lint summary shows no ✗ error and **no new** 🔶 STALE beyond what `origin/main` already reports (run `git stash; node scripts/lint-docs.mjs | tail -3; git stash pop` to compare if unsure). `companion.md` will report "uncommitted" until the commit below — that is expected.

- [ ] **Step 3: Commit docs LAST (the doc's commit date must sit after every key_file's)**

```bash
git add docs/features/companion.md docs/CODEMAP.md
git commit -m "docs(companion): W3.1 ambient recall — [Emlékek] block, config, tests (mezo-b3pp.12)"
node scripts/lint-docs.mjs 2>&1 | grep -i "companion.md" | head -5
```
Expected: `companion.md` ✅ fresh.

---

## Self-review (done while writing)

- **Spec coverage §7.1:** embed once with context tag (T4) ✓ · per-kind caps + config record + yml defaults (T1, T4) ✓ · per-kind minSimilarity 0.55 — single shared floor now, W3.3 makes it per-kind (spec §7.3) ✓ · decay τ reused (`recall.decayDays`) ✓ · dedupe vs snapshot day + `(kind, ref_id)` (T4/T5) ✓ · `[Emlékek]` block, date + one-line + kind tag (T4) ✓ · `max-tokens` 1200 hard cap (T4 unit test) ✓ · ChatService order incl. the Összefüggések slot comment (T6) ✓ · `find_similar_past_days` untouched ✓ · failure ⇒ omit + `degraded=false` + log (T4/T5/T6) ✓ · Memory ref per item (T4/T6) ✓ · acceptance ITs with fake embeddings (T5/T6) ✓.
- **§11:** contract-first — no contract change (verified: `MessageRef` is free-string kind/id) ✓ · context tag `companion_recall`/`recall_embed` ✓ · `@Validated` nested record ✓ · integration-first ✓ · no new table ⇒ no ResetDatabase/populator work ✓ · docs in-change (T8) ✓.
- **Type consistency:** `AmbientRecall.block()/refs()`, `PreparedTurn.recalledRefs()`, `RefsEnvelope.Ref(kind,id)`, `findNearestInKinds(UUID, Collection<String>, String, int)`, `renderBlock(List<RecalledItem>, int, int)` used identically across T2/T4/T5/T6 ✓.
- **Known deviation to flag in the recap:** §7.1's literal `LlmCallContext("companion_chat","recall_embed")` vs §11's `companion_recall` — §11 chosen (it is the cross-cutting rule and gives ai-usage its own recall row).

---

## Execution addendum (2026-08-22, post-implementation)

What shipped differs from the task text above in one load-bearing way — recorded here so the plan does
not mislead a later reader:

- **Task 2 / Task 6 — the JPA `MemoryEmbeddingRepository.findNearestInKinds` did NOT ship.** A failing
  pgvector statement executed through Hibernate aborts the Postgres transaction *and* marks the
  EntityManager rollback-only, so the turn died at its next statement despite `recall` catching the
  exception (violating §7.1's "ANN failure ⇒ block omitted, turn fine"). `REQUIRES_NEW` on the query
  was tried and **deadlocks** against the house `@Transactional` IT idiom (the test transaction holds
  `ResetDatabase`'s TRUNCATE lock; a second connection waits forever). `PROPAGATION_NESTED` was tried
  and is impossible (`HibernateJpaDialect` exposes no `SavepointManager`). Shipped:
  `feature/companion/repository/MemoryEmbeddingAnnQuery` — `NamedParameterJdbcTemplate` on the
  transaction-bound connection under a **manual JDBC savepoint**; same connection (sees the caller's
  uncommitted rows, no lock waits), failure rolls back to the savepoint only. Tests that assert a COMMIT
  live in non-transactional classes (`ChatServiceAmbientRecallIT`, `MemoryEmbeddingAnnQueryIT`).
- `FakeEmbeddingAdapter` gained a second sentinel `FAIL_ANN = "[fake-embed-shortvec]"` (3-dim vector ⇒
  DB-level failure) next to `FAIL_EMBED`.
- Task 4's cap unit test budget is 130 tokens (120 was arithmetically vacuous); Task 5's floor test pins
  the floor between the tool's 0.25 and the ambient 0.55 with a 0.4-similarity row.
- Follow-up filed: `mezo-b3pp.27` (W3.3 input — exclude the active conversation's own recent turns).
