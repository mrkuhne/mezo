# Companion Stream — Live Tool Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The chat UI shows which tool the companion is running *while* it runs, and the model stops narrating "I'll go look that up" instead of looking it up.

**Architecture:** A per-turn listener on `ToolCallAudit` (the single choke point every tool already passes through via `RecordingToolCallback`) feeds a Reactor `Sinks.Many`, whose flux is merged into the SSE delta flux as a new `tool` event. The frontend accumulates those into the in-flight turn and renders them with the existing `ToolChipRow`. Separately, one sentence is added to `ChatService.SYSTEM_PROMPT` forbidding pre-tool narration.

**Tech Stack:** Spring Boot 4 + Spring AI 2 (Gemini), Project Reactor, OpenAPI contract-first (`api/feature/companion`), React 19 + Vite + TanStack Query, Vitest + MSW.

**Spec:** [`docs/superpowers/specs/2026-07-30-companion-stream-tool-events-design.md`](../specs/2026-07-30-companion-stream-tool-events-design.md)

## Global Constraints

- Driving bd id for every commit subject: `mezo-280`. Conventional commit subjects, e.g. `feat(companion): ... (mezo-280)`.
- Code, comments and commit messages in **ENGLISH**; all user-facing chat/UI copy in **Hungarian**.
- Backend house rules are mandatory: constructor injection via `@RequiredArgsConstructor` (never field injection), AssertJ-only assertions, integration-first tests extending `AbstractIntegrationTest`, `test{Method}_should{Result}_when{Condition}` naming, no Mockito/`@MockBean` in integration tests. See `docs/references/spring_patterns.md`, `docs/references/testing_standards.md`, `docs/references/integration_test_framework.md`.
- The API contract is already updated and regenerated (`api/feature/companion/companion.yml` → `api/openapi.yml` → `frontend/src/data/_client/api.gen.ts`). **Do not hand-write boundary DTOs**; use `io.mrkuhne.mezo.api.dto.StreamToolCall` on the backend and `components['schemas']['StreamToolCall']` on the frontend.
- **Backend test command — use exactly this, never the full suite** (the full backend suite OOM-kills this machine):
  `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='<Classes>' -DfailIfNoTests=false`
  Always include `clean` (Lombok+MapStruct incremental compile is flaky). If a run fails with `NoClassDefFound`/`NoSuchMethod` on classes you did not touch, that is background-LSP contamination of `target/classes` — re-run the same command once before investigating.
- **Frontend gate:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes must be green.
- The local fixed `mezo_test` Postgres has a stale Liquibase checksum for an unrelated changeset; that is why every backend command above passes `-Dmezo.test.use-testcontainers=true`. **Do not drop or modify the `mezo_test` database.**

---

### Task 1: `ToolCallAudit` gains a per-turn call listener

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/ToolCallAudit.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/ToolCallAuditTest.java`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `public void onCall(java.util.function.Consumer<ToolCallsEnvelope.ToolCall> listener)` on `ToolCallAudit`. The listener is invoked from `recordCall(String name, String args)` with the just-recorded `ToolCallsEnvelope.ToolCall` (a record of `type`, `name`, `args`). At most one listener; registering a second replaces the first. A listener that throws must not break `recordCall`.

- [ ] **Step 1: Write the failing test**

Append to `ToolCallAuditTest.java` (keep the existing tests and the existing import block; add `java.util.ArrayList`/`java.util.List` imports if missing):

```java
    @Test
    void testRecordCall_shouldNotifyListenerWithTheRecordedCall_whenListenerRegistered() {
        ToolCallAudit audit = new ToolCallAudit(5, 5);
        List<ToolCallsEnvelope.ToolCall> seen = new ArrayList<>();
        audit.onCall(seen::add);

        audit.recordCall("get_recovery", "scope=sleep, days=3");

        assertThat(seen).singleElement().satisfies(call -> {
            assertThat(call.name()).isEqualTo("get_recovery");
            assertThat(call.args()).isEqualTo("scope=sleep, days=3");
            assertThat(call.type()).isEqualTo(ToolCallAudit.TYPE_READ);
        });
    }

    @Test
    void testRecordCall_shouldStillRecord_whenListenerThrows() {
        ToolCallAudit audit = new ToolCallAudit(5, 5);
        audit.onCall(call -> {
            throw new IllegalStateException("listener blew up");
        });

        audit.recordCall("get_recipes", "filter=smoothie");

        // a broken progress listener must never fail the turn — the audit is the source of truth
        assertThat(audit.callCount()).isEqualTo(1);
        assertThat(audit.toToolCallsEnvelope().calls()).singleElement()
                .extracting(ToolCallsEnvelope.ToolCall::name).isEqualTo("get_recipes");
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='ToolCallAuditTest' -DfailIfNoTests=false`
Expected: compile error — `onCall` does not exist on `ToolCallAudit`.

- [ ] **Step 3: Implement the listener**

In `ToolCallAudit.java`, add the import `java.util.function.Consumer`, a field, the registration method, and the notify call inside `recordCall`:

```java
    /**
     * Optional per-turn progress listener (mezo-280). The streamed path registers one to turn each
     * recorded call into a live SSE 'tool' event; the sync path registers none. Kept to a single
     * listener — this is a progress hook, not an event bus — and deliberately fail-safe: the audit
     * is the authoritative record of the turn and must survive a broken listener.
     */
    private Consumer<ToolCallsEnvelope.ToolCall> listener;

    public void onCall(Consumer<ToolCallsEnvelope.ToolCall> listener) {
        this.listener = listener;
    }

    public void recordCall(String name, String args) {
        ToolCallsEnvelope.ToolCall call = new ToolCallsEnvelope.ToolCall(TYPE_READ, name, args);
        calls.add(call);
        if (listener != null) {
            try {
                listener.accept(call);
            } catch (RuntimeException e) {
                log.warn("Companion tool-call listener failed for {}", name, e);
            }
        }
    }
```

Annotate the class with `@Slf4j` (`lombok.extern.slf4j.Slf4j`) so `log` resolves.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='ToolCallAuditTest,RecordingToolCallbackTest' -DfailIfNoTests=false`
Expected: PASS, all tests in both classes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/ToolCallAudit.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/ToolCallAuditTest.java
git commit -m "feat(companion): per-turn tool-call listener on ToolCallAudit (mezo-280)"
```

---

### Task 2: `ChatStreamService` emits a live `tool` SSE event

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatStreamService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatStreamServiceIT.java`

**Interfaces:**
- Consumes: `ToolCallAudit.onCall(Consumer<ToolCallsEnvelope.ToolCall>)` from Task 1.
- Produces: a new SSE event name `"tool"` (constant `ChatStreamService.EVENT_TOOL`) whose data is `io.mrkuhne.mezo.api.dto.StreamToolCall` with `type` = the call's type and `name` = the pre-baked `"name(args)"` label (same format as `CompanionMapper.toTools`, `mapper/CompanionMapper.java:118-119`: bare `name` when args are null/blank).

- [ ] **Step 1: Write the failing tests**

Append to `ChatStreamServiceIT.java` (it already imports `MessageResponse`, `MessageTool`, `ServerSentEvent`, `List`, `UUID`, `BigDecimal`, `LocalDate`; add `import io.mrkuhne.mezo.api.dto.StreamToolCall;`):

```java
    @Test
    void testStreamMessage_shouldEmitToolEventBeforeDone_whenScriptedToolRuns() {
        UUID userId = databasePopulator.populateUser("stream-tool-event@test.local");
        sleepLogPopulator.createSleepLog(userId, LocalDate.now(), new BigDecimal("7.0"), 3);
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(),
                        request("aludtam eleget? [fake-tool:get_recovery {\"scope\":\"sleep\",\"days\":3}]"))
                .collectList().block();

        // the live 'tool' event carries the SAME pre-baked label as the done row's chip, so the FE
        // renders a live chip and a final chip through one component
        List<ServerSentEvent<Object>> toolEvents = events.stream()
                .filter(e -> "tool".equals(e.event())).toList();
        assertThat(toolEvents).singleElement().satisfies(e -> {
            StreamToolCall data = (StreamToolCall) e.data();
            assertThat(data.getName()).isEqualTo("get_recovery(scope=sleep, days=3)");
            assertThat(data.getType()).isEqualTo("read");
        });
        // progress arrives before the terminal event, never after it
        assertThat(events.indexOf(toolEvents.getFirst())).isLessThan(events.size() - 1);
        assertThat(events.getLast().event()).isEqualTo("done");
        assertThat(((MessageResponse) events.getLast().data()).getTools())
                .extracting(MessageTool::getName).containsExactly("get_recovery(scope=sleep, days=3)");
    }

    @Test
    void testStreamMessage_shouldEmitNoToolEvents_whenTurnRunsNoTools() {
        UUID userId = databasePopulator.populateUser("stream-no-tool-event@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(), request("mi a mai terv?"))
                .collectList().block();

        assertThat(events).noneMatch(e -> "tool".equals(e.event()));
        assertThat(events.getLast().event()).isEqualTo("done");
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='ChatStreamServiceIT' -DfailIfNoTests=false`
Expected: the first new test FAILS (no `tool` event is ever emitted — `toolEvents` is empty); the second passes trivially.

- [ ] **Step 3: Implement the tool sink**

In `ChatStreamService.java`: add `EVENT_TOOL`, add the imports `io.mrkuhne.mezo.api.dto.StreamToolCall`, `io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope` and `reactor.core.publisher.Sinks`, then rewrite the body of `streamMessage` between the audit creation and the `return`:

```java
    static final String EVENT_TOOL = "tool";
```

```java
        StringBuilder answer = new StringBuilder();
        // mezo-280: live tool progress. The audit is the one choke point every tool passes through
        // (RecordingToolCallback), so one listener turns each executed call into an SSE frame the
        // moment it runs — instead of every chip appearing at once in the terminal 'done' row.
        // unicast().onBackpressureBuffer() BUFFERS pre-subscription emissions, which matters: some
        // CompanionLlm implementations run the tool loop while the Flux is being assembled.
        Sinks.Many<ServerSentEvent<Object>> toolSink = Sinks.many().unicast().onBackpressureBuffer();
        // Registered BEFORE companionLlm.stream(...) is called for exactly that reason.
        audit.onCall(call -> toolSink.tryEmitNext(toolEvent(call)));

        Flux<ServerSentEvent<Object>> deltas = llmCallContextHolder.runWith(
                        new LlmCallContext("companion_chat", "stream", "conversation", conversationId),
                        () -> companionLlm.stream(turn.systemPrompt(), turn.userContent(),
                                toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit)))
                .doOnNext(answer::append)
                .map(chunk -> ServerSentEvent.<Object>builder(
                        StreamDelta.builder().text(chunk).build()).event(EVENT_DELTA).build())
                // Completing the sink with the deltas ends the merge. Any LATER call (an advisor
                // corrective round) emits into a terminated sink and is dropped — deliberately:
                // those calls still reach the client in the authoritative 'done' row.
                .doFinally(signal -> toolSink.tryEmitComplete());

        return Flux.merge(toolSink.asFlux(), deltas)
                .concatWith(Mono.fromCallable(() -> {
                    // V1.3: post-hoc review — deltas already delivered attempt-1; the done row is
                    // authoritative (the FE swaps it in), so a corrective retry lands silently here.
                    String finalAnswer = answer.toString();
                    boolean degraded = false;
                    CompanionAdvisorChain chain = advisorChain.getIfAvailable();
                    if (chain != null) {
                        AdvisedAnswer advised = chain.review(turn.systemPrompt(), turn.userContent(),
                                finalAnswer, toolRegistry.callbacks(audit),
                                toolRegistry.toolContext(userId, audit), audit);
                        finalAnswer = advised.answer();
                        degraded = advised.degraded();
                    }
                    return ServerSentEvent.<Object>builder(
                                    chatService.completeTurn(userId, conversationId, turn.userMessageId(),
                                            turn.userContent(), finalAnswer, audit, degraded))
                            .event(EVENT_DONE).build();
                }))
                .onErrorResume(e -> {
                    log.warn("Companion stream failed for conversation {}", conversationId, e);
                    return Mono.just(ServerSentEvent.<Object>builder(
                                    StreamError.builder().code(STREAM_FAILED_CODE).build())
                            .event(EVENT_ERROR).build());
                });
    }

    /** The live twin of {@code CompanionMapper.toTools}: same pre-baked "name(args)" chip label. */
    private static ServerSentEvent<Object> toolEvent(ToolCallsEnvelope.ToolCall call) {
        String label = call.args() == null || call.args().isBlank()
                ? call.name() : call.name() + "(" + call.args() + ")";
        return ServerSentEvent.<Object>builder(
                StreamToolCall.builder().type(call.type()).name(label).build())
                .event(EVENT_TOOL).build();
    }
```

Update the class javadoc's event list to mention the `tool` event.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='ChatStreamServiceIT,ChatStreamAdvisorIT,CompanionStreamApiIT' -DfailIfNoTests=false`
Expected: PASS in all three classes (the advisor and API-level stream tests must not regress).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatStreamService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatStreamServiceIT.java
git commit -m "feat(companion): stream a 'tool' SSE event as each tool executes (mezo-280)"
```

---

### Task 3: The system prompt forbids pre-tool narration

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java:46-69`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceIT.java`

**Interfaces:**
- Consumes: nothing. Produces: nothing consumed by other tasks (prompt text only).

- [ ] **Step 1: Write the failing test**

Append to `ChatServiceIT.java`. The fake LLM echoes the assembled system prompt back in its answer (`FakeCompanionLlm` streams `" system=[" + systemPrompt + "]"`), which is how the existing test at line 88 asserts `"[Eszköz-útmutató]"` — reuse that same idiom, mirroring how that test builds its conversation and calls `sendMessage`:

```java
    @Test
    void testSendMessage_shouldForbidPreToolNarration_whenSystemPromptAssembled() {
        UUID userId = databasePopulator.populateUser("prompt-no-preamble@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse resp = chatService.sendMessage(userId, conversation.getId(), request("szia"));

        // The tool-routing hint says WHICH tool; this says WHEN — the companion used to stream
        // "most megnézem…" and end the turn there, which reads as answering before it looked.
        assertThat(resp.getContent()).contains("ELŐBB hívd meg");
    }
```

If `ChatServiceIT` builds its request/conversation differently from this snippet, copy the exact idiom used by the existing `[Eszköz-útmutató]` test in that file rather than this shape — the assertion line is what matters.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='ChatServiceIT' -DfailIfNoTests=false`
Expected: FAIL — the assembled prompt does not contain that phrase.

- [ ] **Step 3: Add the prompt rule**

In `ChatService.SYSTEM_PROMPT`, immediately after the existing line ending `használd a kapott tool-okat — a pillanatkép csak a mai napot mutatja; tool nélkül ne találgass.`, insert:

```
            Ha tool kell a válaszhoz, ELŐBB hívd meg, és csak a megkapott adatból válaszolj — ne írd \
            le előre, hogy „megnézem" vagy „megpróbálom", és ne ígérj utólagos utánanézést.
```

Keep the existing text-block continuation style (`\` at end of line) so the rendered prompt stays one paragraph. Update the `SYSTEM_PROMPT` javadoc to note the timing rule (mezo-280).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='ChatServiceIT,CompanionApiIT' -DfailIfNoTests=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceIT.java
git commit -m "feat(companion): system prompt forbids pre-tool narration (mezo-280)"
```

---

### Task 4: Frontend renders live tool chips during the stream

**Files:**
- Modify: `frontend/src/data/insights/chatApi.ts`
- Modify: `frontend/src/data/insights/chatHooks.ts`
- Modify: `frontend/src/features/insights/pages/ChatPage.tsx`
- Modify: `frontend/src/test/msw/handlers.ts` (the `message/stream` handler, ~line 948)
- Test: `frontend/src/data/insights/chatHooks.test.tsx`, `frontend/src/features/insights/pages/ChatPage.test.tsx`

**Interfaces:**
- Consumes: the `tool` SSE event from Task 2 — data shape `{ type: string, name: string }`, already generated as `components['schemas']['StreamToolCall']`.
- Produces:
  - `chatApi.streamMessage(conversationId, content, onDelta, onTool?)` where `onTool: (tool: Tool) => void` and `Tool` is the existing `@/shared/ui/ToolChip` type.
  - `ChatTurn` gains `tools: Tool[]` (always an array, `[]` while empty).

- [ ] **Step 1: Write the failing tests**

In `frontend/src/data/insights/chatHooks.test.tsx`, add a test that the in-flight turn exposes streamed tools. Follow the file's existing idiom for rendering the hook and driving the MSW stream; the assertion to add is that after the `tool` frame arrives the hook's `turn.tools` contains `{ type: 'read', name: 'get_sleep(days=3)' }`, and that `turn.thinking` is `false` once any frame has arrived.

In `frontend/src/features/insights/pages/ChatPage.test.tsx`, add a test asserting the live bubble renders the streamed chip label (`get_sleep(days=3)`) *before* the turn completes — i.e. while `turn` is still set. Use the same MSW handler and the same `findBy*` idioms already used in that file.

Update the MSW stream handler in `frontend/src/test/msw/handlers.ts` to emit the tool frame first, matching the real backend ordering:

```ts
        controller.enqueue(encoder.encode(frame('tool', { type: 'read', name: 'get_sleep(days=3)' })))
        controller.enqueue(encoder.encode(frame('delta', { text: reply.slice(0, mid) })))
        controller.enqueue(encoder.encode(frame('delta', { text: reply.slice(mid) })))
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && pnpm test -- chatHooks ChatPage`
Expected: FAIL — `turn.tools` is undefined / the chip is not rendered during the stream.

- [ ] **Step 3: Implement the frontend wiring**

`chatApi.ts` — add the type export and the optional callback:

```ts
export type StreamToolCall = components['schemas']['StreamToolCall']
```

```ts
  streamMessage: async (
    conversationId: string,
    content: string,
    onDelta: (text: string) => void,
    onTool?: (tool: Tool) => void,
  ): Promise<MessageResponse> => {
    const body = JSON.stringify({ content } satisfies SendMessageRequest)
    for await (const ev of apiSse(`${CONVERSATION}/${conversationId}/message/stream`, { method: 'POST', body })) {
      if (ev.event === 'delta') {
        onDelta((JSON.parse(ev.data) as StreamDelta).text)
      } else if (ev.event === 'tool') {
        // progress only — the authoritative chips arrive on the done row, which replaces the draft
        onTool?.(JSON.parse(ev.data) as Tool)
      } else if (ev.event === 'done') {
        return JSON.parse(ev.data) as MessageResponse
      } else if (ev.event === 'error') {
        const code = (JSON.parse(ev.data) as StreamError).code
        throw new ApiError([{ code, message: 'Companion stream failed' }], 200)
      }
    }
    throw new ApiError([{ code: 'COMPANION_STREAM_INCOMPLETE', message: 'Stream ended without done' }], 200)
  },
```

`chatHooks.ts` — extend the turn shape and accumulate:

```ts
import type { Tool } from '@/shared/ui/ToolChip'

/** One in-flight turn — the optimistic overlay ChatPage renders under the history. */
export interface ChatTurn { userText: string; draft: string; thinking: boolean; tools: Tool[] }
```

Both `setTurn({ ... })` initialisers (mock at ~line 72, real at ~line 90) gain `tools: []`. In `sendReal`:

```ts
        const done = await chatApi.streamMessage(
          conversationId,
          text,
          (delta) => setTurn((t) => (t ? { ...t, draft: t.draft + delta, thinking: false } : t)),
          (tool) => setTurn((t) => (t ? { ...t, tools: [...t.tools, tool], thinking: false } : t)),
        )
```

`ChatPage.tsx` — render the live chips, and show the bubble as soon as there is a draft **or** a tool:

```tsx
        {turn && turn.thinking && <ThinkingDots />}
        {turn && !turn.thinking && (turn.draft || turn.tools.length > 0) && (
          <ChatMessage
            m={{
              role: 'assistant',
              ts: 'most',
              text: turn.draft,
              ...(turn.tools.length > 0 ? { tools: turn.tools } : {}),
            }}
          />
        )}
```

- [ ] **Step 4: Run the full frontend gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build succeeds and BOTH test modes pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/insights/chatApi.ts frontend/src/data/insights/chatHooks.ts \
        frontend/src/features/insights/pages/ChatPage.tsx frontend/src/test/msw/handlers.ts \
        frontend/src/data/insights/chatHooks.test.tsx frontend/src/features/insights/pages/ChatPage.test.tsx
git commit -m "feat(companion): live tool chips while the answer streams (mezo-280)"
```

---

### Task 5: Documentation

**Files:**
- Modify: `docs/features/companion.md` (the V0.4 streaming section and the SSE event protocol description)

**Interfaces:** none.

- [ ] **Step 1: Update the feature doc**

Find the section describing the streamed turn / SSE event protocol (search for `StreamDelta`, `EVENT_DELTA` or `ChatStreamService`) and the `ChatStreamServiceIT` test-catalog entry. Update them to describe:
- the three-plus-one event protocol: `delta` and `tool` interleaved, then exactly one terminal `done`/`error`;
- that `tool` is **progress only** — the done row's `tools` stays authoritative and also covers advisor-retry calls made after the sink completed;
- the `ToolCallAudit.onCall` seam and why the sink is `unicast().onBackpressureBuffer()` (pre-subscription buffering);
- the new `SYSTEM_PROMPT` timing rule and the behaviour it fixes;
- that the FE renders live chips on the draft bubble via the existing `ToolChipRow`, and the draft is still replaced wholesale by the authoritative done row.

Do NOT add a changelog or dated snapshot — edit the affected sections in place (git is the history).

- [ ] **Step 2: Run the doc lint**

Run: `node scripts/lint-docs.mjs`
Expected: `docs/features/companion.md` shows no NEW findings. The repo already has 8 pre-existing stale docs and 1 warn — that count must not grow.

- [ ] **Step 3: Commit**

```bash
git add docs/features/companion.md
git commit -m "docs(companion): live tool SSE events + anti-preamble prompt rule (mezo-280)"
```
