# S5 — Prompt caching: stable prefix + measurable cache hits (`mezo-ozri.5`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended)
> or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`)
> syntax for tracking.

**Goal:** Make the companion chat turn's provider-side prompt prefix STABLE across turns, so the 46
tool schemas plus the persona instructions are served from the provider's prompt cache at 0.1× the
input rate — and make the resulting cache-hit ratio visible in the AI-napló instead of estimated.

**Architecture:** Today `ChatService.assembleSystemPrompt` glues the constant persona
(`SYSTEM_PROMPT`) together with ten per-turn volatile blocks (today's snapshot, facts, memories,
graph, character, profile, tone reminder) into ONE system message. OpenAI renders the cacheable
prefix as *developer/system messages → tool definitions → conversation history*, so a system message
whose second line already changes every turn invalidates the prefix **before** the tool definitions
— every turn re-bills all 46 schemas at full price. The fix is a seam, not a rewrite: the port grows
an explicit `turnContext` string that the adapter emits as a SECOND system message placed AFTER the
history and immediately BEFORE the current user message. The stable half (persona + tools + closed
history) becomes the cache prefix; the volatile half becomes the suffix. The audit row and the
`FakeCompanionLlm` both re-join the two halves in the original order, so `llm_log.system_prompt` and
every fake-profile IT keep seeing byte-identical text.

**Tech Stack:** Java 21 / Spring Boot / Spring AI 2.0.1 (`OpenAiChatOptions`), JPA + Postgres
(`llm_log_history`), JUnit 5 + AssertJ + Testcontainers, OpenAPI-first contract (`api/*.yml` →
`io.mrkuhne.mezo.api.dto` + `frontend/src/data/_client/api.gen.ts`), React + TS frontend.

## Global Constraints

- **Provider facts, verified 2026-09-07 against `https://developers.openai.com/api/docs/guides/prompt-caching`:**
  caching is **enabled by default**; the minimum cacheable prefix is **1,024 tokens for GPT-5.6 and
  later**; the cached state includes "OpenAI-provided instructions, developer messages, tool
  definitions, and conversation history"; a cached prefix "remains eligible for reuse for 30 minutes
  after its most recent write or reuse"; cached input costs **0.1× the uncached input-token rate**;
  `prompt_cache_key` "influence[s] routing; [it does] not pin requests to a machine or guarantee a
  cache read hit". Usage reports the hit as `input_tokens_details.cached_tokens`.
- **Concatenation must stay byte-identical.** `stableSystemPrompt + turnContext` must equal today's
  `assembleSystemPrompt(..)` output character for character — **no separator**, no reordering, no
  trimming. This is what keeps `FakeCompanionLlm`'s `startsWith` dispatch and the
  `PREFIX + " system=[…]"` echo (which chat ITs assert on) unchanged.
- **Never reorder prompt text.** `CompanionMessageGenerator:75,100,114,139` marker constants are
  duplicated verbatim inside the fake; this slice must not touch any marker prompt.
- All tunables go to `application.yml` behind a `@ConfigurationProperties` record — `@Value` is
  ArchUnit-forbidden (`no_spring_value_annotation`).
- `spring-ai-starter-model-google-genai` stays in the build; `GEMINI_API_KEY` stays.
- The OpenAI adapter must keep overriding `completeSmart` (it does, in `SpringAiCompanionLlm`).
- If any file is added or renamed under `feature/companion/llm`, regenerate `docs/CODEMAP.md` in the
  same change — the focused ITs skip the ArchUnit and CODEMAP gates.
- Local runs are FOCUSED tests only; the full backend IT suite is the self-PR's CI job.

## File Structure

| File | Responsibility after this slice |
|---|---|
| `backend/src/main/java/io/mrkuhne/mezo/feature/companion/CompanionLlm.java` | Port grows the 6-arg `complete`/`stream` carrying `turnContext`; the old 5-arg forms become defaults passing `null`. |
| `…/companion/llm/SpringAiCompanionLlm.java` | Emits `turnContext` as a trailing `SystemMessage`; joins both halves for the audit row. |
| `…/companion/llm/FakeCompanionLlm.java` | Folds `turnContext` back into `systemPrompt` at entry — dispatch and echo unchanged. |
| `…/companion/llm/OpenAiCompanionLlm.java` | Sets `promptCacheKey` from the ambient call context + actor. |
| `…/companion/service/ChatService.java` | `assembleSystemPrompt` splits into `stableSystemPrompt` + `turnContext`; `PreparedTurn` carries both. |
| `…/companion/service/ChatStreamService.java` | Passes `turn.turnContext()` through. |
| `…/companion/advisor/CompanionAdvisorChain.java` | Carries `turnContext`; the corrective retry block appends to the CONTEXT, not the stable prompt. |
| `…/llmlog/repository/LlmStatusRow.java`, `LlmLogRepository.java` | The status rollup also sums `prompt_tokens` and `cached_tokens`. |
| `…/llmlog/service/LlmUsageService.java` | Puts those two sums on `LlmUsageTotals`. |
| `api/feature/llm-usage/llm-usage.yml` | `LlmUsageTotals` grows `promptTokens` + `cachedTokens`. |
| `frontend/src/features/admin/components/AiUsageHero.tsx` | Shows the cache-hit percentage. |
| `docs/features/llm-cost-audit.md` (or the companion chat feature doc) | Records the prefix contract and the measurement method. |

---

### Task 0: Claim the slice and branch

- [ ] **Step 1: Claim and branch**

```bash
bd update mezo-ozri.5 --claim
git switch -c feat/prompt-caching-stable-prefix
```

---

### Task 1: The `turnContext` seam (port + adapter + fake)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/CompanionLlm.java:33-38`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/SpringAiCompanionLlm.java:134-147, 210-226, 343-358`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java:591`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlmPromptOrderTest.java`

**Interfaces:**
- Produces: `CompanionLlm.complete(String systemPrompt, String turnContext, List<Turn> history, String userMessage, List<ToolCallback> tools, Map<String,Object> toolContext)` and the `Flux<String> stream(..)` twin with the same parameter order. `turnContext` is nullable/blank-tolerant; blank means "behave exactly as before".
- Produces: `SpringAiCompanionLlm` records `systemPrompt + turnContext` (empty-string join, in that order) into `LlmCallRecord.systemPrompt`.

- [ ] **Step 1: Write the failing tests**

Add to `GeminiCompanionLlmPromptOrderTest` (the existing `CapturingChatModel` and
`minimalCompanionProperties()` helpers stay as they are):

```java
    @Test
    void testComplete_shouldPlaceTurnContextAfterHistoryAndBeforeUser_whenTurnContextIsGiven() {
        CapturingChatModel chatModel = new CapturingChatModel();
        LlmCallContextHolder contextHolder = new LlmCallContextHolder();
        GeminiCompanionLlm adapter = new GeminiCompanionLlm(
                chatModel,
                new LlmModelRouter(minimalCompanionProperties(), contextHolder),
                new NoOpLlmCallRecorder(),
                contextHolder,
                new GoogleGenAiUsageExtractor());

        adapter.complete("RENDSZER", "[Ma] friss adat", List.of(
                new Turn(Role.USER, "korábbi kérdés"),
                new Turn(Role.ASSISTANT, "korábbi válasz")), "mostani kérdés", List.of(), Map.of());

        List<Message> sent = chatModel.captured.get().getInstructions();
        assertThat(sent).extracting(Message::getMessageType).containsExactly(
                MessageType.SYSTEM, MessageType.USER, MessageType.ASSISTANT,
                MessageType.SYSTEM, MessageType.USER);
        assertThat(sent.get(0).getText()).isEqualTo("RENDSZER");
        assertThat(sent.get(3).getText()).isEqualTo("[Ma] friss adat");
        assertThat(sent.get(4).getText()).isEqualTo("mostani kérdés");
    }

    @Test
    void testComplete_shouldSendOneSystemMessage_whenTurnContextIsBlank() {
        CapturingChatModel chatModel = new CapturingChatModel();
        LlmCallContextHolder contextHolder = new LlmCallContextHolder();
        GeminiCompanionLlm adapter = new GeminiCompanionLlm(
                chatModel,
                new LlmModelRouter(minimalCompanionProperties(), contextHolder),
                new NoOpLlmCallRecorder(),
                contextHolder,
                new GoogleGenAiUsageExtractor());

        adapter.complete("RENDSZER", "  ", List.of(), "mostani kérdés", List.of(), Map.of());

        assertThat(chatModel.captured.get().getInstructions())
                .extracting(Message::getMessageType)
                .containsExactly(MessageType.SYSTEM, MessageType.USER);
    }

    /** The audit row must keep showing every instruction the model got, in the order it got them. */
    @Test
    void testComplete_shouldRecordStablePromptAndTurnContextJoined_whenTurnContextIsGiven() {
        CapturingChatModel chatModel = new CapturingChatModel();
        LlmCallContextHolder contextHolder = new LlmCallContextHolder();
        List<LlmCallRecord> recorded = new ArrayList<>();
        GeminiCompanionLlm adapter = new GeminiCompanionLlm(
                chatModel,
                new LlmModelRouter(minimalCompanionProperties(), contextHolder),
                recorded::add,
                contextHolder,
                new GoogleGenAiUsageExtractor());

        adapter.complete("RENDSZER", "[Ma] friss adat", List.of(), "kérdés", List.of(), Map.of());

        assertThat(recorded).hasSize(1);
        assertThat(recorded.get(0).systemPrompt()).isEqualTo("RENDSZER[Ma] friss adat");
    }
```

New imports needed in the test: `java.util.ArrayList`,
`io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecord`. (`LlmCallRecorder` is a single-method
interface, so `recorded::add` is a valid lambda target — if it is not, write a tiny inner class
implementing `record(LlmCallRecord)`.)

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend && ./mvnw -q -Dtest=GeminiCompanionLlmPromptOrderTest test
```

Expected: FAIL — compile error, no 6-arg `complete`.

- [ ] **Step 3: Widen the port (as DEFAULTS, not new abstracts)**

The 5-arg `complete`/`stream` stay the abstract methods. The turn-context forms arrive as DEFAULTS
that collapse the two halves back into one string — so `FakeCompanionLlm` and the three test-only
`implements CompanionLlm` stubs (`LlmCallContextTaggingIT:64`, `ReflectionDigestMorningIT:62`,
`LlmMemoryQueryRewriterContextTest:58`) need no change at all, and only the real Spring AI adapter
overrides them to actually split the messages.

```java
    /**
     * One-shot completion on the cheap chat tier where the instructions are SPLIT (mezo-ozri.5):
     * {@code systemPrompt} is the stable half, {@code turnContext} the volatile one — today's
     * snapshot, recalled memories, the tone reminder. A provider adapter sends the volatile half as
     * its own message placed after the history and before the user's turn, so the cacheable prefix
     * (stable instructions + tool definitions + closed history) survives from one turn to the next.
     *
     * <p>The DEFAULT simply re-joins them, which is exactly what every non-caching implementation
     * wants: the fake keeps its {@code startsWith} dispatch and its {@code system=[…]} echo on one
     * unchanged string, and no test stub has to grow a parameter it does not care about.
     */
    default String complete(String systemPrompt, String turnContext, List<Turn> history, String userMessage,
                            List<ToolCallback> tools, Map<String, Object> toolContext) {
        return complete(joinInstructions(systemPrompt, turnContext), history, userMessage, tools, toolContext);
    }

    /** Streamed twin of {@link #complete(String, String, List, String, List, Map)}. */
    default Flux<String> stream(String systemPrompt, String turnContext, List<Turn> history, String userMessage,
                                List<ToolCallback> tools, Map<String, Object> toolContext) {
        return stream(joinInstructions(systemPrompt, turnContext), history, userMessage, tools, toolContext);
    }

    /**
     * The instructions as ONE string, in the order the model reads them — joined with NOTHING
     * between the halves, so the result is character-for-character what the chat prompt was before
     * the split.
     */
    static String joinInstructions(String systemPrompt, String turnContext) {
        return turnContext == null || turnContext.isBlank() ? systemPrompt : systemPrompt + turnContext;
    }
```

- [ ] **Step 4: Implement the real split in `SpringAiCompanionLlm`**

Override the two new forms; the inherited 5-arg overrides delegate INTO them with a null context so
there is one code path:

```java
    @Override
    public String complete(String systemPrompt, List<Turn> history, String userMessage,
                           List<ToolCallback> tools, Map<String, Object> toolContext) {
        return complete(systemPrompt, null, history, userMessage, tools, toolContext);
    }

    @Override
    public String complete(String systemPrompt, String turnContext, List<Turn> history, String userMessage,
                           List<ToolCallback> tools, Map<String, Object> toolContext) {
        CallKind kind = tools.isEmpty() ? CallKind.CHAT : CallKind.TOOL;
        String model = route(ModelTier.CHEAP, kind);
        CallSpec spec = new CallSpec(kind, model,
            CompanionLlm.joinInstructions(systemPrompt, turnContext), userMessage,
            ChatHistory.render(history), null, null, null, false);
        LlmRoundUsage tally = new LlmRoundUsage();
        return recorded(spec, tally,
            () -> request(systemPrompt, turnContext, history, userMessage, tools, toolContext, model, tally)
                .call().chatResponse());
    }
```

and the same shape for `stream` (5-arg delegating to the 6-arg; the 6-arg keeps the existing
`Flux.defer` body verbatim, with `CompanionLlm.joinInstructions(..)` in the `CallSpec` and
`turnContext` threaded into the `request(..)` call inside the defer).

`request(..)` places the volatile half as a trailing system message:

```java
    private ChatClient.ChatClientRequestSpec request(String systemPrompt, String turnContext,
                                                     List<Turn> history, String userMessage,
                                                     List<ToolCallback> tools,
                                                     Map<String, Object> toolContext, String model,
                                                     LlmRoundUsage tally) {
        // The volatile half rides its own system message at the END of the message list: Spring AI
        // lays a request out as [system] + messages + [user], so this lands after the history and
        // immediately before the user's turn — BEHIND the provider's cacheable prefix, never inside
        // it. Putting it in the leading system message (where it lived until mezo-ozri.5) changed
        // the prefix on every turn and re-billed all 46 tool schemas at the full input rate.
        List<Message> messages = new ArrayList<>(toMessages(history));
        if (turnContext != null && !turnContext.isBlank()) {
            messages.add(new SystemMessage(turnContext));
        }
        ChatClient.ChatClientRequestSpec spec = chatClient.prompt()
            .options(optionsFor(model, ModelTier.CHEAP, !tools.isEmpty()))
            .system(systemPrompt)
            .messages(messages)
            .user(userMessage)
            .advisors(a -> a.param(LlmRoundUsage.CONTEXT_KEY, tally));
        if (!tools.isEmpty()) {
            spec = spec.tools((Object[]) tools.toArray(ToolCallback[]::new)).toolContext(toolContext);
        }
        return spec;
    }
```

New imports: `org.springframework.ai.chat.messages.SystemMessage`, `java.util.ArrayList`.

- [ ] **Step 5: Confirm the fake needs nothing**

`FakeCompanionLlm` inherits the joining defaults, so its dispatch and echo are untouched. Do NOT
edit it. (Same for the three test-only stubs.)

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd backend && ./mvnw -q -Dtest=GeminiCompanionLlmPromptOrderTest test
```

Expected: PASS (5 tests).

- [ ] **Step 7: Compile the whole module**

```bash
cd backend && ./mvnw -q -DskipTests compile test-compile
```

Expected: BUILD SUCCESS. Any remaining caller of the old 5-arg form still compiles via the default.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/test/java/io/mrkuhne/mezo/feature/companion
git commit -m "feat(companion): turn-context seam on the LLM port for a stable cache prefix (mezo-ozri.5)"
```

---

### Task 2: Split the chat prompt at the call site

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java:203-206, 221, 262, 325, 352-371`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatStreamService.java:84, 102`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/advisor/CompanionAdvisorChain.java:42-63`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/ChatPromptSplitTest.java` (create)

**Interfaces:**
- Consumes: the 6-arg `CompanionLlm.complete`/`stream` from Task 1.
- Produces: `ChatService.PreparedTurn(UUID conversationId, UUID userMessageId, String systemPrompt, String turnContext, List<Turn> history, String userContent, List<RefsEnvelope.Ref> recalledRefs, RecalledMemoriesEnvelope recalled)`.
- Produces: `CompanionAdvisorChain.complete(String systemPrompt, String turnContext, List<Turn> history, String userMessage, List<ToolCallback> tools, Map<String,Object> toolContext, ToolCallAudit audit)` and `review(String systemPrompt, String turnContext, List<Turn> history, String userMessage, String answer, List<ToolCallback> tools, Map<String,Object> toolContext, ToolCallAudit audit)`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/ChatPromptSplitTest.java`.
This is a PURE test of the split contract — it must not boot Spring. Make the two new assemblers
package-private static-friendly by keeping them instance methods and testing them through
`prepareTurn` would need a context; instead assert the invariant that matters at the seam:

```java
package io.mrkuhne.mezo.feature.companion.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * mezo-ozri.5: the split is only safe while the two halves re-join into the ONE string the prompt
 * used to be — that identity is what keeps FakeCompanionLlm's startsWith dispatch and its
 * system=[…] echo (asserted by dozens of chat ITs) unchanged. Guarding the JOIN here means the
 * chat ITs never have to re-assert it.
 */
class ChatPromptSplitTest {

    @Test
    void testStableHalf_shouldStartTheJoinedPrompt_always() {
        String stable = ChatService.SYSTEM_PROMPT;
        String volatilePart = "[Ma]\nvalami\n" + ChatService.TONE_REMINDER;

        assertThat(stable + volatilePart).startsWith(ChatService.SYSTEM_PROMPT);
        assertThat(stable + volatilePart).endsWith(ChatService.TONE_REMINDER);
    }
}
```

If `SYSTEM_PROMPT` is not visible from the test package, widen it to package-private `static final`
(it already is `static final` at `ChatService.java:69`); `TONE_REMINDER` is already `public`.

- [ ] **Step 2: Run it**

```bash
cd backend && ./mvnw -q -Dtest=ChatPromptSplitTest test
```

Expected: PASS immediately (it is a guard, not a red test) — if it does not compile, fix visibility.

- [ ] **Step 3: Split `assembleSystemPrompt`**

Replace the single method at `ChatService.java:352` with two, keeping the javadoc's prompt-order
narrative on the pair:

```java
    /**
     * The STABLE half of the instructions (mezo-ozri.5): the voice, and nothing that changes from
     * one turn to the next. This is the text the provider caches — it sits in front of the 46 tool
     * schemas in the request the adapter builds, so anything volatile placed here would invalidate
     * the tool definitions' cache entry on every single turn and re-bill them at the full input rate.
     */
    private String stableSystemPrompt(UUID userId) {
        return promptPersona.render(userId, SYSTEM_PROMPT);
    }

    /**
     * The VOLATILE half, in the same order it has always had: snapshot (V0.3) → [Heti adatok]
     * anchored block (mezo-p2tr) → top-N facts (V1.1) → fresh pattern-facts (V3.3) → reflection →
     * [Karakter] (mezo-1gim.8) → [Rólad tanultam] (W4.3) → [Emlékek] (W3.1) → [Összefüggések]
     * (W2.4) → TONE_REMINDER (mezo-q71s, always last). Concatenated with NOTHING between the
     * halves: {@code stableSystemPrompt(..) + turnContext(..)} is character-for-character the string
     * this method used to return on its own.
     */
    private String turnContext(UUID userId, LocalDate today, String factsBlock, String memoriesBlock,
                               String graphBlock, String contextKind, LocalDate contextDate) {
        return promptPersona.render(userId, contextSnapshotAssembler.render(userId, today)
                + anchoredBlock(userId, contextKind, contextDate)
                + factsBlock
                + knowledgeFactService.renderNewPatternFactsBlock(userId)
                + reflectionBlock(userId)
                + characterBlock(userId)
                + profileBlock(userId)
                + memoriesBlock
                + graphBlock
                + TONE_REMINDER);
    }
```

Then at each of the three call sites (`prepareTurn` ≈ `:221`, `sendMessage` ≈ `:262`,
`openingTurn` ≈ `:325`) replace the single `assembleSystemPrompt(..)` local with two locals
`systemPrompt` / `turnContext` built from the pair above, and pass both down:

```java
        String systemPrompt = stableSystemPrompt(userId);
        String turnCtx = turnContext(userId, today, memory.factsBlock(), memory.memoriesBlock(),
                memory.graphBlock(), conversation.getContextKind(), conversation.getContextDate());
```

`sendMessage`'s two branches become:

```java
            AdvisedAnswer advised = llmCallContextHolder.runWith(turnContext,
                    () -> chain.complete(systemPrompt, turnCtx, history, request.getContent(),
                            toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit), audit));
…
            answer = llmCallContextHolder.runWith(turnContext,
                    () -> companionLlm.complete(systemPrompt, turnCtx, history, request.getContent(),
                            toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit)));
```

(NOTE the existing local named `turnContext` of type `LlmCallContext` in `sendMessage` — that is why
the new local is `turnCtx`. Do not rename the `LlmCallContext` one; it is referenced by the audit.)

`openingTurn` passes the same pair into `companionLlm.complete(systemPrompt, turnCtx, List.of(),
KICKOFF_PROMPT, List.of(), Map.of())`.

`PreparedTurn` gains `String turnContext` right after `systemPrompt`; `prepareTurn` returns it.

- [ ] **Step 4: Thread it through the stream path**

In `ChatStreamService`, `turn.systemPrompt()` becomes `turn.systemPrompt(), turn.turnContext()` in
both the `companionLlm.stream(..)` call (`:84`) and the `chain.review(..)` call (`:102`).

- [ ] **Step 5: Thread it through the advisor chain**

In `CompanionAdvisorChain`, add `String turnContext` after `systemPrompt` on `complete` and
`review`, pass it to `companionLlm.complete(..)`, and — the point — move the corrective block off
the stable prompt:

```java
            // mezo-ozri.5: the corrective block joins the VOLATILE half. Appending it to the stable
            // prompt would push a per-retry string in front of the tool definitions and throw away
            // the cached prefix for the retry round — the exact round we least want to pay twice for.
            String retryContext = (turnContext == null ? "" : turnContext) + AdvisorRetry.block(violations);
            answer = llmCallContextHolder.runWith(
                    new LlmCallContext("companion_advisor", "retry", null, null),
                    () -> companionLlm.complete(systemPrompt, retryContext, history, userMessage, tools, toolContext));
```

`runChecks(..)` keeps receiving the FULL instructions, so pass `systemPrompt + (turnContext == null
? "" : turnContext)` where it takes `systemPrompt` — the verdict must see everything the answer was
grounded in.

- [ ] **Step 6: Compile, then run the focused chat suite**

```bash
cd backend && ./mvnw -q -DskipTests compile test-compile
cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest='Chat*IT,Companion*IT,*AdvisorChain*' test
```

Expected: PASS. A failure asserting on `system=[…]` means the join is no longer byte-identical —
fix the concatenation, do not edit the assertion.

- [ ] **Step 7: Commit**

```bash
git add backend/src
git commit -m "feat(companion): stable system prompt, volatile turn context after the history (mezo-ozri.5)"
```

---

### Task 3: `prompt_cache_key` on the OpenAI options

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/OpenAiCompanionLlm.java:61-96`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/OpenAiCompanionLlmOptionsTest.java`

**Interfaces:**
- Consumes: `LlmCallContextHolder.get()` (already a constructor arg) and `LlmActorResolver.currentActor()`.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Write the failing test**

Add to `OpenAiCompanionLlmOptionsTest` (follow the file's existing construction helper; if it builds
the adapter through a helper, extend that helper with the new constructor argument):

```java
    @Test
    void testOptionsFor_shouldSetPromptCacheKeyFromFeatureAndActor_whenAnActorIsResolved() {
        UUID actor = UUID.fromString("00000000-0000-0000-0000-0000000000aa");
        LlmCallContextHolder holder = new LlmCallContextHolder();
        OpenAiCompanionLlm adapter = adapterWith(holder, () -> actor);

        OpenAiChatOptions options = holder.runWith(
                new LlmCallContext("companion_chat", "send", "conversation", UUID.randomUUID()),
                () -> adapter.optionsFor("gpt-5.6-luna", ModelTier.CHEAP, true).build());

        assertThat(options.getPromptCacheKey()).isEqualTo("companion_chat:" + actor);
    }

    @Test
    void testOptionsFor_shouldFallBackToTheFeatureAlone_whenNoActorIsResolved() {
        LlmCallContextHolder holder = new LlmCallContextHolder();
        OpenAiCompanionLlm adapter = adapterWith(holder, () -> null);

        OpenAiChatOptions options = holder.runWith(
                new LlmCallContext("companion_chat", "send", null, null),
                () -> adapter.optionsFor("gpt-5.6-luna", ModelTier.CHEAP, true).build());

        assertThat(options.getPromptCacheKey()).isEqualTo("companion_chat");
    }
```

`adapterWith(..)` is a new private helper in the test that constructs `OpenAiCompanionLlm` with a
stub `LlmActorResolver` whose `currentActor()` returns the supplied value (subclass
`LlmActorResolver` and override the method — it is a plain `@Component` with no final methods).
`optionsFor` is `protected`; the test lives in the same package, so it is reachable.

- [ ] **Step 2: Run it**

```bash
cd backend && ./mvnw -q -Dtest=OpenAiCompanionLlmOptionsTest test
```

Expected: FAIL — no such constructor / `getPromptCacheKey()` is null.

- [ ] **Step 3: Implement**

Add `LlmActorResolver llmActorResolver` and `LlmCallContextHolder llmCallContextHolder` fields to
`OpenAiCompanionLlm` (the holder is already a constructor parameter — keep a reference instead of
only forwarding it to `super`), and extend `optionsFor`:

```java
        String cacheKey = promptCacheKey();
        if (cacheKey != null) {
            builder.promptCacheKey(cacheKey);
        }
```

```java
    /**
     * The provider's ROUTING hint for prompt caching (mezo-ozri.5). Verified against
     * developers.openai.com/api/docs/guides/prompt-caching (2026-09-07): the key "influence[s]
     * routing; [it does] not pin requests to a machine or guarantee a cache read hit" — requests
     * carrying the same key are steered at the same cache, which is what makes one user's stable
     * chat prefix worth caching at all.
     *
     * <p>Feature slug + actor id, never anything identifying: the id is the account UUID that the
     * audit row already stores, and no prompt text goes anywhere near this value. A cron thread has
     * no actor, and then the feature slug alone is the honest key.
     */
    private String promptCacheKey() {
        LlmCallContext context = llmCallContextHolder.get();
        String feature = context == null ? null : context.feature();
        if (feature == null || feature.isBlank()) {
            return null;
        }
        UUID actor = llmActorResolver.currentActor();
        return actor == null ? feature : feature + ":" + actor;
    }
```

- [ ] **Step 4: Run the test**

```bash
cd backend && ./mvnw -q -Dtest=OpenAiCompanionLlmOptionsTest test
```

Expected: PASS.

- [ ] **Step 5: Verify the wiring still boots**

```bash
cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest='OpenAiProviderWiringIT,ChatModelQualifierIT,LlmModelRoutingIT' test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src
git commit -m "feat(companion): prompt_cache_key routing hint on OpenAI calls (mezo-ozri.5)"
```

---

### Task 4: Cached-token totals in the AI-napló API

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmStatusRow.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmLogRepository.java` (the `aggregateByStatusSince` query)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmUsageService.java:197-207`
- Modify: `api/feature/llm-usage/llm-usage.yml:179-189`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/controller/LlmUsageBreakdownIT.java`

**Interfaces:**
- Produces: `LlmUsageTotals.promptTokens` (int64, required) and `LlmUsageTotals.cachedTokens` (int64, required) — RAW provider counts, i.e. `cachedTokens` is a SUBSET of `promptTokens`, so the hit ratio is `cachedTokens / promptTokens`.
- Produces: `LlmStatusRow(CallStatus status, long callCount, BigDecimal costUsd, long unpricedCount, long promptTokens, long cachedTokens)`.

- [ ] **Step 1: Write the failing test**

In `LlmUsageBreakdownIT`, following the file's existing populator style:

```java
    @Test
    void testBreakdown_shouldSumPromptAndCachedTokens_whenRowsReportThem() throws Exception {
        llmLogPopulator.call(c -> c.feature("companion_chat").promptTokens(1000).cachedTokens(800));
        llmLogPopulator.call(c -> c.feature("companion_chat").promptTokens(1000).cachedTokens(0));

        mockMvc.perform(get("/api/llm-usage/breakdown").param("period", "month").with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totals.promptTokens").value(2000))
            .andExpect(jsonPath("$.totals.cachedTokens").value(800));
    }
```

Adapt the populator call and the auth helper to whatever the file already uses (read the
neighbouring test in the same file first and copy its shape exactly, including the endpoint path).
If `LlmLogPopulator` has no `cachedTokens` setter, add one mirroring `promptTokens`.

- [ ] **Step 2: Run it**

```bash
cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest=LlmUsageBreakdownIT test
```

Expected: FAIL — no such JSON path.

- [ ] **Step 3: Extend the contract**

In `api/feature/llm-usage/llm-usage.yml`, `LlmUsageTotals`:

```yaml
      required: [callCount, successCount, errorCount, cancelledCount, unpricedCount, promptTokens, cachedTokens, currency]
      properties:
        …
        promptTokens: { type: integer, format: int64, description: "summed raw prompt tokens; INCLUDES the cached slice" }
        cachedTokens: { type: integer, format: int64, description: "summed cache-read prompt tokens — a SUBSET of promptTokens; the hit ratio is cachedTokens/promptTokens (mezo-ozri.5)" }
```

Then merge the fragments into the bundled spec and regenerate both clients — this is the exact
command the contract-drift CI job re-runs:

```bash
cd api/generate && npm run generate:api
```

The frontend types land in `frontend/src/data/_client/api.gen.ts`; the backend DTOs are generated
into `io.mrkuhne.mezo.api.dto` by the Maven build, so `./mvnw compile` after this picks them up.

- [ ] **Step 4: Extend the query, row and service**

`LlmStatusRow` gains two `long` components. The query:

```java
    @Query("""
        select new io.mrkuhne.mezo.feature.llmlog.repository.LlmStatusRow(
            l.status, count(l), sum(l.costUsd),
            sum(case when l.costUsd is null then 1L else 0L end),
            coalesce(sum(coalesce(l.promptTokens, 0)), 0L),
            coalesce(sum(coalesce(l.cachedTokens, 0)), 0L))
        from LlmLogEntity l
        where l.createdAt >= :since
        group by l.status
        """)
    List<LlmStatusRow> aggregateByStatusSince(@Param("since") Instant since);
```

(Token sums coalesce to 0 on purpose, unlike cost: "no tokens reported" and "zero tokens" price the
same, whereas a null cost is a genuine unknown.)

`LlmUsageService.totals(..)`:

```java
            .promptTokens(rows.stream().mapToLong(LlmStatusRow::promptTokens).sum())
            .cachedTokens(rows.stream().mapToLong(LlmStatusRow::cachedTokens).sum())
```

- [ ] **Step 5: Run the test**

```bash
cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest='LlmUsageBreakdownIT,LlmUsageIT,LlmUsageControllerIT,LlmUsageBreakdownMidnightIT' test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api backend/src frontend/src/data/_client
git commit -m "feat(llmlog): prompt/cached token totals on the usage breakdown (mezo-ozri.5)"
```

---

### Task 5: The cache-hit number in the AI-napló header

**Files:**
- Modify: `frontend/src/features/admin/components/AiUsageHero.tsx`
- Test: `frontend/src/features/admin/components/AiUsageHero.test.tsx`

**Interfaces:**
- Consumes: `components['schemas']['LlmUsageTotals']` with `promptTokens` / `cachedTokens` from Task 4.

- [ ] **Step 1: Write the failing test**

Append to `AiUsageHero.test.tsx`, matching the file's existing render helper and totals fixture:

```tsx
  it('gyorsítótár-találati arányt mutat, ha volt prompt-token', () => {
    render(<AiUsageHero totals={{ ...totals, promptTokens: 1000, cachedTokens: 800 }} periodLabel="Ez a hónap" />)
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('gyorsítótárból')).toBeInTheDocument()
  })

  it('elrejti a gyorsítótár-arányt, ha nincs prompt-token', () => {
    render(<AiUsageHero totals={{ ...totals, promptTokens: 0, cachedTokens: 0 }} periodLabel="Ez a hónap" />)
    expect(screen.queryByText('gyorsítótárból')).not.toBeInTheDocument()
  })
```

Extend the file's shared `totals` fixture with `promptTokens: 0, cachedTokens: 0` so the existing
tests keep type-checking.

- [ ] **Step 2: Run it**

```bash
cd frontend && CI=true pnpm test
```

Expected: FAIL on the two new cases.

- [ ] **Step 3: Implement**

Add a third stat to the existing `row`, keeping the Mozaik card as is:

```tsx
        {totals.promptTokens > 0 && (
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>
              {Math.round((totals.cachedTokens / totals.promptTokens) * 100)}%
            </div>
            <div className="text-tertiary" style={{ fontSize: 10.5, fontWeight: 600 }}>gyorsítótárból</div>
          </div>
        )}
```

- [ ] **Step 4: Run the suite in both modes**

```bash
cd frontend && CI=true pnpm test
cd frontend && CI=true VITE_USE_MOCK=false pnpm test
cd frontend && pnpm build
```

Expected: PASS, PASS, build OK. If the mock handler for the breakdown endpoint needs the two new
required fields, add them there too (`frontend/src/mocks/**`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(admin): cache-hit ratio in the AI-napló header (mezo-ozri.5)"
```

---

### Task 6: Documentation, gates, PR

**Files:**
- Modify: the companion-chat / llm-cost feature doc under `docs/features/`
- Modify: `docs/CODEMAP.md` (only if a file was added or renamed — this plan adds one test file under `feature/companion/service`, so regenerate)

- [ ] **Step 1: Write the prefix contract into the feature doc**

Use the `knowledge-base` skill's 10-section shape. The section to add records: what the stable /
volatile split is, why the join must stay byte-identical, the provider facts with the date they were
verified (1,024-token minimum on GPT-5.6+, 30-minute reuse window, 0.1× cached rate, caching on by
default, `prompt_cache_key` is routing-only), and that the ratio is read off
`LlmUsageTotals.cachedTokens / promptTokens`.

- [ ] **Step 2: Regenerate the codemap**

```bash
node scripts/gen-codemap.mjs
node scripts/lint-docs.mjs
```

`docs/CODEMAP.md` is generated and CI-gated — never hand-edit it. `lint-docs.mjs` clears the
staleness flag on the feature doc touched in Step 1.

- [ ] **Step 3: Run the gates that focused tests skip**

```bash
cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest='*ArchUnit*,*Codemap*,*Convention*' test
```

- [ ] **Step 4: Refresh the tracker backup and commit**

```bash
node scripts/check-beads-backup.mjs --fix
git add docs .beads
git commit -m "docs(companion): prompt-caching prefix contract + codemap (mezo-ozri.5)"
```

- [ ] **Step 5: Push, open the self-PR, wait for CI green**

```bash
git push -u origin feat/prompt-caching-stable-prefix
gh pr create --fill
gh pr checks --watch
```

- [ ] **Step 6: Re-check against current main, then merge**

```bash
gh workflow run premerge.yml -f pr=<number>
git pull --rebase origin main
git merge --no-ff feat/prompt-caching-stable-prefix
git push origin HEAD:main
git push origin --delete feat/prompt-caching-stable-prefix
bd close mezo-ozri.5
```

---

## Out of scope (file as follow-ups)

- **The before/after COGS measurement on real traffic.** The acceptance criterion's "standard COGS
  measured before and after" needs a live `OPENAI_API_KEY` and real chat volume; nothing in a
  fake-profile IT can produce a provider cache hit. This slice ships the structure and the meter —
  the reading belongs with `mezo-kdhn` (the real-key smoke). File a bd note on `mezo-kdhn` pointing
  at `LlmUsageTotals.cachedTokens` as the number to read after a day of traffic.
- **Gemini implicit caching.** The same restructuring helps it, but Gemini's own threshold and
  reporting are not re-verified here.
