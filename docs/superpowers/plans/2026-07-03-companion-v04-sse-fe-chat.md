# Companion V0.4 — SSE streaming + FE ChatPage goes real (mezo-fnnq.4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The chat is usable on the phone — the existing mock ChatPage becomes a real, dual-mode surface with streamed (SSE) answers, history load, and an honest degraded state when the companion switch is off.

**Architecture:** Backend adds a hand-written SSE controller (`POST .../message/stream`, `Flux<ServerSentEvent<?>>` over the existing `CompanionLlm.stream` port) with the turn split into two transactions (`prepareTurn` → stream → `completeTurn`). The stream operation is documented in the contract fragment under a separate `CompanionStream` tag whose generated interface is deliberately NOT implemented — the V0.4 contract-first SSE precedent. Frontend adds `apiSse` (fetch + ReadableStream SSE parser) to `_client/api.ts`, a `data/insights/chatApi.ts` client + `chatHooks.ts` (`useChat` dual read via `useDualQuery`, `useChatActions` send/stream state machine), and rewrites `ChatPage` onto them.

**Tech Stack:** Spring Boot 4 (webmvc + reactor-core via Spring AI), OpenAPI contract-first, React 19 + TanStack Query + MSW, Vitest.

## Global Constraints

- UI copy: HUNGARIAN. Code, comments, commit messages: ENGLISH.
- Branch: `feat/companion-v04`; conventional commits carrying the bd id, e.g. `feat(companion): ... (mezo-fnnq.4)`.
- Contract-first: edit `api/feature/companion/companion.yml` BEFORE any code; merge with `cd api/generate && npm run generate:api`; FE types `cd frontend && pnpm generate:api`; commit both generated outputs (`api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`).
- Every new companion bean MUST be `@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")`.
- Backend tests: `./mvnw clean test` (ALWAYS `clean`; compose Postgres must be up: `cd backend && docker compose up -d`). LLM in tests is ALWAYS `FakeCompanionLlm` (`@ActiveProfiles("companion-fake")`) — network never touched.
- Backend test naming `test{Method}_should{Result}_when{Condition}`, AssertJ only, populator data.
- FE: hooks imported from `@/data/hooks` only; implementations in `data/insights/`; dual reads via `useDualQuery` (real mode NEVER falls back to the mock seed); deep absolute `@/*` imports, no barrels, tests colocated; no new `*Screen`/`*View`.
- FE gate: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — BOTH modes green.
- No new DB tables in this slice (no migration). `tools`/`refs` envelopes stay null (V0.5).
- No `@Value`; the only new config key is `spring.mvc.async.request-timeout` (infra key, not a `mezo.*` tunable).
- Doc upkeep is part of the slice: `docs/features/companion.md`, `docs/features/insights.md` §2.5, `docs/features/_platform-api-backend.md` (SSE precedent), `docs/milestones/roadmap.md`; finish with `node scripts/lint-docs.mjs`.

## Decisions locked (V0.4)

1. **SSE-in-contract-first precedent:** the stream operation IS in the fragment (single source of truth; event payload schemas generate FE types + backend DTOs) under its own tag `CompanionStream`, so the generator emits a separate `CompanionStreamApi` interface that **no bean implements** — an interface that is not a bean contributes no mappings, so it is inert. The real controller is hand-written (`CompanionStreamController`) because the generator cannot express `Flux<ServerSentEvent<?>>`. This is the ONE documented exception to "controllers implement the generated interface"; recorded in `_platform-api-backend.md` §9 + `companion.md` §9.
2. **Event protocol:** named SSE events `delta` (data = `StreamDelta{text}` JSON), then exactly one terminal `done` (data = the persisted assistant `MessageResponse` JSON) or `error` (data = `StreamError{code}` JSON, code `COMPANION_STREAM_FAILED`). Every `data:` line is JSON — sidesteps SSE multi-line framing of raw token text.
3. **Two-transaction turn (streamed path only):** `prepareTurn` (@Transactional: ownership 404, prompt assembly, persist USER row, title-once + `lastMessageAt`) → LLM stream (NO transaction) → `completeTurn` (@Transactional: persist ASSISTANT row, bump `lastMessageAt`). Mid-stream failure ⇒ `error` event, NO assistant row (partial answers are never persisted), the user row stays — honest history. The sync `sendMessage` stays untouched (single transaction, unchanged semantics) — the halves share its private helpers, and only the stream service calls them (through the proxy, so each gets its own transaction).
4. **FE transport = fetch + ReadableStream** (EventSource can't POST or send `Authorization`). FE sends `Accept: text/event-stream, application/json` so pre-stream failures (400/401/404) arrive as normal `SystemMessageList` JSON → `ApiError`.
5. **Degraded state (IDENT-3):** real-mode 404 on the conversation list (companion switch off) ⇒ `degraded: true` ghost (mirrors the progression 404→ghost pattern) — honest banner, disabled composer, no dead-end. Deployed k3s runs with `MEZO_FEATURE_COMPANION_ENABLED=false` until a real `GEMINI_API_KEY` secret lands (V0.2 review prerequisite) — the FE degraded state is exactly that switch-off UX.
6. **Hook surface:** `useChat()` → `{ data: { conversationId, messages, degraded, mode }, isPending }` (single `['chat']` bootstrap query: newest conversation + its messages; `mode: 'mock' | 'live'` keeps `isMockMode()` out of the feature layer). `useChatActions()` → `{ send(text), turn, error }` where `turn` is the in-flight overlay `{ userText, draft, thinking }`. The canned mock reply moves verbatim from `ChatPage` into the hook's mock branch (`cannedReply()` exported from `data/insights/chat.ts`, shared with MSW so both test modes assert the same strings).
7. **Header goes honest:** the hard-coded `"23 facts active · Gemini 3.1 Pro"` + fake `"L4 aktív"` chip are removed. Subtitle: mock → `demo beszélgetés`, live → `Gemini · élő`, degraded → `a társ most nem elérhető`.

---

### Task 1: Contract — SSE stream operation + event schemas

**Files:**
- Modify: `api/feature/companion/companion.yml`
- Regenerate: `api/openapi.yml` (merge), `frontend/src/data/_client/api.gen.ts` (FE types)

**Interfaces:**
- Produces: merged contract with `POST /api/companion/conversation/{conversationId}/message/stream`; schemas `StreamDelta { text }`, `StreamError { code }`; generated backend DTOs `io.mrkuhne.mezo.api.dto.{StreamDelta,StreamError}` (used by Tasks 3–4) and FE types `components['schemas']['StreamDelta'|'StreamError']` (used by Task 7).

- [ ] **Step 1: Create the branch and claim context**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git checkout -b feat/companion-v04
```

- [ ] **Step 2: Extend the fragment**

In `api/feature/companion/companion.yml`:

(a) Add the new tag under `tags:`:

```yaml
  - name: CompanionStream
    description: >-
      Phase-3 companion chat — SSE streaming turn (mezo-fnnq.4). PRECEDENT: this tag's generated
      interface (CompanionStreamApi) is deliberately NOT implemented — SSE (Flux<ServerSentEvent>)
      is outside the generator's vocabulary, so the endpoint is hand-written
      (CompanionStreamController) while the contract stays the single source of truth.
      See docs/features/_platform-api-backend.md §9.
```

(b) Update the sync operation's summary (drop the stale deferral note) — replace

```yaml
      summary: Send a user message and get the assistant's answer (sync JSON — V0.2; SSE arrives in V0.4)
```

with

```yaml
      summary: Send a user message and get the assistant's answer (sync JSON; streaming sibling at .../message/stream)
```

(c) Add the stream path after the `/message` path:

```yaml
  /api/companion/conversation/{conversationId}/message/stream:
    post:
      tags: [CompanionStream]
      operationId: streamMessage
      summary: >-
        Send a user message and stream the assistant's answer as Server-Sent Events (V0.4).
        Events: 0..n 'delta' (data = StreamDelta JSON), then exactly one terminal event —
        'done' (data = the persisted assistant MessageResponse JSON) or 'error'
        (data = StreamError JSON; the assistant turn is NOT persisted, the user message is).
        Every data line is JSON. Clients should send "Accept: text/event-stream, application/json"
        so pre-stream errors (400/401/404) arrive as normal SystemMessageList JSON.
      parameters:
        - name: conversationId
          in: path
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/SendMessageRequest' }
      responses:
        '200':
          description: SSE frames — see the per-event data schemas (StreamDelta / MessageResponse / StreamError)
          content:
            text/event-stream:
              schema:
                oneOf:
                  - $ref: '#/components/schemas/StreamDelta'
                  - $ref: '#/components/schemas/MessageResponse'
                  - $ref: '#/components/schemas/StreamError'
        '400':
          description: Validation error (emitted before the stream starts)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: Conversation not found (or owned by someone else)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

(d) Add the two event payload schemas under `components.schemas`:

```yaml
    StreamDelta:
      type: object
      required: [text]
      properties:
        text: { type: string, description: 'One streamed answer chunk (token/segment delta).' }
    StreamError:
      type: object
      required: [code]
      properties:
        code: { type: string, description: "Stream failure code — 'COMPANION_STREAM_FAILED'." }
```

- [ ] **Step 3: Merge + regenerate FE types**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
```

Expected: `api/openapi.yml` gains the stream path + 2 schemas; `frontend/src/data/_client/api.gen.ts` gains `StreamDelta`/`StreamError`.

- [ ] **Step 4: Verify the backend generator accepts it**

```bash
cd ../backend && ./mvnw clean compile -q
```

Expected: BUILD SUCCESS; `target/generated-sources/openapi/.../api/controller/CompanionStreamApi.java` exists (inert — nothing implements it). Contingency: if the `oneOf` in `text/event-stream` breaks generation, replace the 200 schema with `{ type: string, description: 'SSE frames; per-event payloads: StreamDelta / MessageResponse / StreamError' }` — all component schemas are still generated as models.

- [ ] **Step 5: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git add api/ frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): companion SSE stream contract — CompanionStream tag precedent (mezo-fnnq.4)"
```

---

### Task 2: FakeCompanionLlm failure sentinels + ChatService turn split

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceIT.java` (extend)

**Interfaces:**
- Consumes: existing `ChatService` internals (`SYSTEM_PROMPT`, `renderHistory`, `loadWindow`, `persistMessage`, `touchConversation`), `ConversationService.getOwned`.
- Produces: `ChatService.PreparedTurn(UUID conversationId, String systemPrompt, String userContent)` record; `@Transactional public PreparedTurn prepareTurn(UUID userId, UUID conversationId, SendMessageRequest request)`; `@Transactional public MessageResponse completeTurn(UUID userId, UUID conversationId, String answer)`; `FakeCompanionLlm.FAIL_COMPLETE = "[fake-fail]"`, `FakeCompanionLlm.FAIL_STREAM = "[fake-stream-fail]"`. Task 3 builds on all of these.

**Design note (transaction shape):** the sync `sendMessage` stays EXACTLY as it is today — one `@Transactional` method, unchanged rollback-on-LLM-failure semantics, zero regression risk. `prepareTurn`/`completeTurn` are ADDED as new public transactional methods sharing the existing private helpers. Called from `sendMessage` (self-invocation) they would bypass the proxy — which is fine, because the sync path keeps its own outer transaction and does NOT call them. The streaming service (Task 3, a different bean) calls them through the Spring proxy, so THERE each half gets its own transaction. This task is a pure refactor + additive change with no observable behavior change, so it carries no new test of its own — the new methods' behavior (user row survives an LLM stream failure, assistant row absent) is asserted where it is observable: `ChatStreamServiceIT` (Task 3).

- [ ] **Step 1: Implement** —

(a) `FakeCompanionLlm` gains deterministic failure sentinels:

```java
    /** Content markers that force a deterministic failure — lets ITs exercise error paths. */
    public static final String FAIL_COMPLETE = "[fake-fail]";
    public static final String FAIL_STREAM = "[fake-stream-fail]";

    @Override
    public String complete(String systemPrompt, String userMessage) {
        if (userMessage.contains(FAIL_COMPLETE)) {
            throw new IllegalStateException("FAKE-LLM forced complete failure");
        }
        return PREFIX + " system=[" + systemPrompt + "] user=[" + userMessage + "]";
    }

    @Override
    public Flux<String> stream(String systemPrompt, String userMessage) {
        if (userMessage.contains(FAIL_STREAM)) {
            return Flux.concat(
                Flux.just(PREFIX),
                Flux.error(new IllegalStateException("FAKE-LLM forced stream failure")));
        }
        return Flux.fromIterable(List.of(
            PREFIX,
            " system=[" + systemPrompt + "]",
            " user=[" + userMessage + "]"));
    }
```

(b) `ChatService` — add the two turn halves (delete nothing; `sendMessage` and the private helpers `loadWindow`/`renderHistory`/`persistMessage`/`touchConversation` stay untouched):

```java
    /** One prepared chat turn — everything the LLM call needs, produced inside one transaction. */
    public record PreparedTurn(UUID conversationId, String systemPrompt, String userContent) {}

    /**
     * First half of a STREAMED turn (own transaction when called through the proxy):
     * ownership check, prompt assembly (window BEFORE persisting the new message), persist
     * the USER row, set title-once + lastMessageAt. Splitting the turn means a later LLM
     * failure keeps the user message — honest history for the streamed path (the sync
     * sendMessage keeps its single-transaction rollback semantics).
     */
    @Transactional
    public PreparedTurn prepareTurn(UUID userId, UUID conversationId, SendMessageRequest request) {
        AiConversationEntity conversation = conversationService.getOwned(userId, conversationId);
        String systemPrompt = SYSTEM_PROMPT
                + contextSnapshotAssembler.render(userId, LocalDate.now())
                + renderHistory(loadWindow(userId, conversationId));
        persistMessage(conversation, userId, AiMessageEntity.ROLE_USER, request.getContent());
        touchConversation(conversation, request.getContent());
        return new PreparedTurn(conversationId, systemPrompt, request.getContent());
    }

    /** Second half of a turn (own transaction): persist the ASSISTANT row + bump lastMessageAt. */
    @Transactional
    public MessageResponse completeTurn(UUID userId, UUID conversationId, String answer) {
        AiConversationEntity conversation = conversationService.getOwned(userId, conversationId);
        AiMessageEntity assistant =
                persistMessage(conversation, userId, AiMessageEntity.ROLE_ASSISTANT, answer);
        conversation.setLastMessageAt(Instant.now());
        conversationRepository.save(conversation);
        return mapper.toMessageResponse(assistant);
    }

```

(Note the docstring on `prepareTurn` should say: "a later LLM failure keeps the user message — honest history for the STREAMED path"; the sync path keeps its single-transaction rollback semantics.)

- [ ] **Step 2: Run the companion suite**

```bash
cd backend && ./mvnw clean test -q -Dtest='Companion*IT,ChatServiceIT,ConversationServiceIT'
```

Expected: PASS (all existing tests unchanged; the new methods are exercised in Task 3).

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java
git commit -m "feat(companion): turn split (prepareTurn/completeTurn) + fake LLM failure sentinels (mezo-fnnq.4)"
```

---

### Task 3: ChatStreamService (+ IT)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatStreamService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatStreamServiceIT.java`

**Interfaces:**
- Consumes: `ChatService.prepareTurn/completeTurn` (Task 2), `CompanionLlm.stream`, generated `io.mrkuhne.mezo.api.dto.{StreamDelta,StreamError,MessageResponse,SendMessageRequest}` (Task 1).
- Produces: `public Flux<ServerSentEvent<Object>> streamMessage(UUID userId, UUID conversationId, SendMessageRequest request)` — events named `delta`/`done`/`error`. Task 4's controller returns this verbatim.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.api.dto.StreamDelta;
import io.mrkuhne.mezo.api.dto.StreamError;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.service.ChatStreamService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Streamed chat turn against the fake LLM — event protocol + two-transaction persistence. */
@ActiveProfiles("companion-fake")
class ChatStreamServiceIT extends AbstractIntegrationTest {

    @Autowired private ChatStreamService chatStreamService;
    // + the same populator/service/owner-id fields ChatServiceIT uses (copy its wiring verbatim)

    @Test
    void testStreamMessage_shouldEmitDeltasThenDoneAndPersistBothRows_whenLlmStreams() {
        var conversation = /* persist an owned conversation exactly like ChatServiceIT does */;
        SendMessageRequest request = SendMessageRequest.builder().content("mi a mai terv?").build();

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(ownerId(), conversation.getId(), request)
                .collectList().block();

        assertThat(events).isNotEmpty();
        assertThat(events.subList(0, events.size() - 1))
                .allSatisfy(e -> {
                    assertThat(e.event()).isEqualTo("delta");
                    assertThat(e.data()).isInstanceOf(StreamDelta.class);
                });
        String joined = events.stream().limit(events.size() - 1)
                .map(e -> ((StreamDelta) e.data()).getText()).reduce("", String::concat);
        assertThat(joined).startsWith(FakeCompanionLlm.PREFIX).contains("user=[mi a mai terv?]");

        ServerSentEvent<Object> last = events.getLast();
        assertThat(last.event()).isEqualTo("done");
        MessageResponse done = (MessageResponse) last.data();
        assertThat(done.getRole()).isEqualTo("assistant");
        assertThat(done.getContent()).isEqualTo(joined);

        var messages = conversationService.listMessages(ownerId(), conversation.getId());
        assertThat(messages).hasSize(2);
        assertThat(messages.getFirst().getRole()).isEqualTo("user");
        assertThat(messages.getLast().getContent()).isEqualTo(joined);
    }

    @Test
    void testStreamMessage_shouldEmitErrorAndKeepOnlyUserRow_whenLlmStreamFails() {
        var conversation = /* persist an owned conversation */;
        SendMessageRequest request = SendMessageRequest.builder()
                .content("szállj el " + FakeCompanionLlm.FAIL_STREAM).build();

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(ownerId(), conversation.getId(), request)
                .collectList().block();

        ServerSentEvent<Object> last = events.getLast();
        assertThat(last.event()).isEqualTo("error");
        assertThat(((StreamError) last.data()).getCode()).isEqualTo("COMPANION_STREAM_FAILED");

        var messages = conversationService.listMessages(ownerId(), conversation.getId());
        assertThat(messages).hasSize(1);   // partial answers are NEVER persisted
        assertThat(messages.getFirst().getRole()).isEqualTo("user");
    }

    @Test
    void testStreamMessage_shouldThrow404BeforeStreaming_whenConversationForeign() {
        assertThatThrownBy(() -> chatStreamService.streamMessage(
                ownerId(), UUID.randomUUID(),
                SendMessageRequest.builder().content("x").build()))
                .hasMessageContaining("RESOURCE_NOT_FOUND");
    }
}
```

(Fill the two `/* persist an owned conversation */` spots with the exact populator call `ChatServiceIT` uses — same class, same method; the 404 assertion matches how `ChatServiceIT` asserts `SystemRuntimeErrorException` — mirror its idiom.)

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw clean test -q -Dtest=ChatStreamServiceIT
```

Expected: FAIL — `ChatStreamService` does not exist (compile error).

- [ ] **Step 3: Implement `ChatStreamService`**

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.api.dto.StreamDelta;
import io.mrkuhne.mezo.api.dto.StreamError;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * The streamed chat turn (V0.4). Orchestrates the two transactional halves of ChatService
 * around the non-transactional LLM stream: prepareTurn (persist user row) → CompanionLlm.stream
 * (each chunk re-emitted as an SSE 'delta') → completeTurn (persist assistant row) as the
 * terminal 'done'. A mid-stream failure becomes a terminal 'error' event and the assistant
 * row is NOT persisted — partial answers never enter the history.
 *
 * <p>Ownership/validation failures inside prepareTurn throw BEFORE the Flux is returned, so
 * they surface as regular JSON error responses (the FE sends "Accept: text/event-stream,
 * application/json" accordingly).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class ChatStreamService {

    static final String EVENT_DELTA = "delta";
    static final String EVENT_DONE = "done";
    static final String EVENT_ERROR = "error";
    static final String STREAM_FAILED_CODE = "COMPANION_STREAM_FAILED";

    private final ChatService chatService;
    private final CompanionLlm companionLlm;

    public Flux<ServerSentEvent<Object>> streamMessage(
            UUID userId, UUID conversationId, SendMessageRequest request) {
        // Eager (pre-Flux) so 404/validation problems are normal HTTP errors, not SSE frames.
        ChatService.PreparedTurn turn = chatService.prepareTurn(userId, conversationId, request);

        StringBuilder answer = new StringBuilder();
        return companionLlm.stream(turn.systemPrompt(), turn.userContent())
                .doOnNext(answer::append)
                .map(chunk -> ServerSentEvent.<Object>builder(
                        StreamDelta.builder().text(chunk).build()).event(EVENT_DELTA).build())
                .concatWith(Mono.fromCallable(() -> ServerSentEvent.<Object>builder(
                                chatService.completeTurn(userId, conversationId, answer.toString()))
                        .event(EVENT_DONE).build()))
                .onErrorResume(e -> {
                    log.warn("Companion stream failed for conversation {}", conversationId, e);
                    return Mono.just(ServerSentEvent.<Object>builder(
                                    StreamError.builder().code(STREAM_FAILED_CODE).build())
                            .event(EVENT_ERROR).build());
                });
    }
}
```

- [ ] **Step 4: Run the IT**

```bash
cd backend && ./mvnw clean test -q -Dtest=ChatStreamServiceIT
```

Expected: PASS (3 tests). Note: `ServerSentEvent` comes from `spring-web`'s `org.springframework.http.codec` — already on the classpath with webmvc + reactor.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatStreamService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatStreamServiceIT.java
git commit -m "feat(companion): ChatStreamService — delta/done/error SSE turn over the LLM port (mezo-fnnq.4)"
```

---

### Task 4: CompanionStreamController (+ HTTP IT, switch-off coverage)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/CompanionStreamController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionStreamApiIT.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionApiSwitchOffIT.java` (one new assertion)
- Modify: `backend/src/main/resources/application.yml` (async timeout)

**Interfaces:**
- Consumes: `ChatStreamService.streamMessage` (Task 3), `CurrentUserId` (techcore), generated `SendMessageRequest`.
- Produces: `POST /api/companion/conversation/{conversationId}/message/stream` (`text/event-stream`).

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.ConversationResponse;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** HTTP-level SSE flow — the hand-written stream endpoint beside the generated surface. */
@ActiveProfiles("companion-fake")
class CompanionStreamApiIT extends ApiIntegrationTest {

    private static final String CONVERSATION_URI = "/api/companion/conversation";

    private HttpHeaders sseHeaders() {
        HttpHeaders headers = ownerAuthHeaders();
        headers.set(HttpHeaders.ACCEPT,
                MediaType.TEXT_EVENT_STREAM_VALUE + ", " + MediaType.APPLICATION_JSON_VALUE);
        return headers;
    }

    private String streamUri(Object conversationId) {
        return CONVERSATION_URI + "/" + conversationId + "/message/stream";
    }

    @Test
    void testStreamMessage_shouldReturn401_whenNoToken() {
        postForBody(streamUri(UUID.randomUUID()),
                SendMessageRequest.builder().content("x").build(),
                null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testStreamMessage_shouldReturn404Json_whenUnknownConversation() {
        String body = postForBody(streamUri(UUID.randomUUID()),
                SendMessageRequest.builder().content("x").build(),
                sseHeaders(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testStreamMessage_shouldReturn400FieldError_whenContentEmpty() {
        ConversationResponse conversation = postForBody(
                CONVERSATION_URI, null, ownerAuthHeaders(), HttpStatus.CREATED, ConversationResponse.class);
        String body = postForBody(streamUri(conversation.getId()),
                SendMessageRequest.builder().content("").build(),
                sseHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "content", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testStreamMessage_shouldStreamDeltasThenDoneAndPersist_whenValid() {
        ConversationResponse conversation = postForBody(
                CONVERSATION_URI, null, ownerAuthHeaders(), HttpStatus.CREATED, ConversationResponse.class);

        String sse = postForBody(streamUri(conversation.getId()),
                SendMessageRequest.builder().content("mi a mai terv?").build(),
                sseHeaders(), HttpStatus.OK, String.class);

        assertThat(sse).contains("event:delta").contains("event:done");
        assertThat(sse).contains(FakeCompanionLlm.PREFIX);
        assertThat(sse).contains("\"role\":\"assistant\"");

        List<MessageResponse> messages = getForList(
                CONVERSATION_URI + "/" + conversation.getId() + "/messages",
                ownerAuthHeaders(), HttpStatus.OK, MessageResponse.class);
        assertThat(messages).hasSize(2);
        assertThat(messages.getFirst().getRole()).isEqualTo("user");
        assertThat(messages.getLast().getRole()).isEqualTo("assistant");
        assertThat(messages.getLast().getContent()).startsWith(FakeCompanionLlm.PREFIX);

        List<ConversationResponse> conversations = getForList(
                CONVERSATION_URI, ownerAuthHeaders(), HttpStatus.OK, ConversationResponse.class);
        assertThat(conversations)
                .filteredOn(c -> c.getId().equals(conversation.getId()))
                .singleElement()
                .satisfies(c -> assertThat(c.getTitle()).isEqualTo("mi a mai terv?"));
    }

    @Test
    void testStreamMessage_shouldEmitErrorEventWithoutAssistantRow_whenLlmStreamFails() {
        ConversationResponse conversation = postForBody(
                CONVERSATION_URI, null, ownerAuthHeaders(), HttpStatus.CREATED, ConversationResponse.class);

        String sse = postForBody(streamUri(conversation.getId()),
                SendMessageRequest.builder().content("szállj el " + FakeCompanionLlm.FAIL_STREAM).build(),
                sseHeaders(), HttpStatus.OK, String.class);

        assertThat(sse).contains("event:error").contains("COMPANION_STREAM_FAILED");

        List<MessageResponse> messages = getForList(
                CONVERSATION_URI + "/" + conversation.getId() + "/messages",
                ownerAuthHeaders(), HttpStatus.OK, MessageResponse.class);
        assertThat(messages).hasSize(1);
        assertThat(messages.getFirst().getRole()).isEqualTo("user");
    }
}
```

(If the `event:` serialization carries a space — `event: delta` — relax those three assertions to `contains("delta")` etc. after inspecting the failure output once; TestRestTemplate buffers the finite fake stream, so plain `String` bodies work.)

Also append one assertion inside `CompanionApiSwitchOffIT`'s existing 404 test (same style as its other paths):

```java
        // V0.4 stream sibling — hand-written controller is switch-gated the same way
        // (POST with a body; expect 404 RESOURCE_NOT_FOUND like the rest)
```

Mirror exactly how that IT exercises the other `/api/companion/*` paths for the new URI `/api/companion/conversation/{random-uuid}/message/stream`.

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw clean test -q -Dtest=CompanionStreamApiIT
```

Expected: FAIL — 404 on every request (no controller yet).

- [ ] **Step 3: Implement the controller**

```java
package io.mrkuhne.mezo.feature.companion.controller;

import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.service.ChatStreamService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

import java.util.UUID;

/**
 * The V0.4 SSE turn — the ONE hand-written endpoint beside the generated CompanionApi surface.
 * PRECEDENT (recorded in _platform-api-backend.md §9): the operation IS in the contract fragment
 * (tag CompanionStream) so schemas/types stay generated, but the generated CompanionStreamApi
 * interface is deliberately not implemented — the generator cannot express
 * Flux&lt;ServerSentEvent&gt;. Mapping + @Valid therefore live here, hand-written.
 */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class CompanionStreamController {

    private final ChatStreamService chatStreamService;
    private final CurrentUserId currentUserId;

    @PostMapping(
            value = "/api/companion/conversation/{conversationId}/message/stream",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<Object>> streamMessage(
            @PathVariable UUID conversationId, @Valid @RequestBody SendMessageRequest request) {
        return chatStreamService.streamMessage(currentUserId.get(), conversationId, request);
    }
}
```

Add the async timeout to `backend/src/main/resources/application.yml` under the existing `spring:` root (LLM streams can exceed the servlet default; only this endpoint is async):

```yaml
  mvc:
    async:
      # SSE chat turns (V0.4): Gemini streams can exceed the container's ~30s async default.
      request-timeout: 120s
```

- [ ] **Step 4: Run the full backend suite**

```bash
cd backend && ./mvnw clean test -q
```

Expected: BUILD SUCCESS, all ITs green (including `CompanionApiSwitchOffIT` with the new path).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/CompanionStreamController.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionStreamApiIT.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionApiSwitchOffIT.java \
        backend/src/main/resources/application.yml
git commit -m "feat(companion): hand-written SSE stream endpoint + async timeout (mezo-fnnq.4)"
```

---

### Task 5: k3s — companion switch off until the Gemini secret lands

**Files:**
- Modify: `k8s/backend/deployment.yaml`

**Interfaces:** none (deploy config only). Context: the V0.2 final review flagged that the deployed backend boots with the dummy `GEMINI_API_KEY`, so every real chat call would 500. V0.4 ships the FE that calls it — the honest fix is the switch-off 404, which the new FE renders as the degraded state.

- [ ] **Step 1: Add the env var** — in `k8s/backend/deployment.yaml`, append to the container `env:` list:

```yaml
            # Phase-3 companion stays OFF in the deployed env until a real GEMINI_API_KEY
            # lands in the mezo-app secret (mezo-fnnq.4 note) — the FE renders the switch-off
            # 404 as an honest degraded chat state.
            - name: MEZO_FEATURE_COMPANION_ENABLED
              value: "false"
```

- [ ] **Step 2: Sanity-check the manifest**

```bash
kubectl apply --dry-run=client -f k8s/backend/deployment.yaml
```

Expected: `deployment.apps/... configured (dry run)` (or `unchanged`). If no kubeconfig is available locally, `python3 -c "import yaml,sys; yaml.safe_load_all(open('k8s/backend/deployment.yaml')) and print('ok')"` as a syntax check is enough.

- [ ] **Step 3: Commit**

```bash
git add k8s/backend/deployment.yaml
git commit -m "chore(k8s): keep companion switch off in deploy until Gemini secret lands (mezo-fnnq.4)"
```

---

### Task 6: FE `_client/api.ts` — `apiSse` fetch-stream helper (+ unit test)

**Files:**
- Modify: `frontend/src/data/_client/api.ts`
- Test: `frontend/src/data/_client/api.sse.test.ts`

**Interfaces:**
- Produces: `export async function* apiSse(path: string, init?: RequestInit): AsyncGenerator<{ event: string; data: string }>` — throws `ApiError` on non-OK responses (same contract as `apiFetch`). Task 7 consumes it.

- [ ] **Step 1: Write the failing test**

```ts
import { apiSse, ApiError, API_BASE } from '@/data/_client/api'

function sseResponse(frames: string[], status = 200): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      frames.forEach((f) => controller.enqueue(encoder.encode(f)))
      controller.close()
    },
  })
  return new Response(stream, { status, headers: { 'Content-Type': 'text/event-stream' } })
}

async function collect(gen: AsyncGenerator<{ event: string; data: string }>) {
  const out: { event: string; data: string }[] = []
  for await (const ev of gen) out.push(ev)
  return out
}

afterEach(() => vi.unstubAllGlobals())

test('parses named events with JSON data lines', async () => {
  vi.stubGlobal('fetch', vi.fn(async () =>
    sseResponse(['event:delta\ndata:{"text":"szia"}\n\n', 'event:done\ndata:{"id":"m1"}\n\n'])))
  const events = await collect(apiSse('/api/x', { method: 'POST', body: '{}' }))
  expect(events).toEqual([
    { event: 'delta', data: '{"text":"szia"}' },
    { event: 'done', data: '{"id":"m1"}' },
  ])
})

test('reassembles events split across network chunks (and tolerates CRLF + "data: " space)', async () => {
  vi.stubGlobal('fetch', vi.fn(async () =>
    sseResponse(['event: delta\r\ndata: {"te', 'xt":"fé"}\r\n\r\nevent:done\ndata:{}\n\n'])))
  const events = await collect(apiSse('/api/x'))
  expect(events).toEqual([
    { event: 'delta', data: '{"text":"fé"}' },
    { event: 'done', data: '{}' },
  ])
})

test('throws ApiError with the SystemMessage body on a non-OK response', async () => {
  vi.stubGlobal('fetch', vi.fn(async () =>
    new Response(JSON.stringify([{ code: 'RESOURCE_NOT_FOUND', message: 'nope' }]), { status: 404 })))
  await expect(collect(apiSse('/api/x'))).rejects.toSatisfy(
    (e: unknown) => e instanceof ApiError && e.status === 404 && e.messages[0].code === 'RESOURCE_NOT_FOUND')
})

test('targets API_BASE with the SSE accept header', async () => {
  const spy = vi.fn(async () => sseResponse(['event:done\ndata:{}\n\n']))
  vi.stubGlobal('fetch', spy)
  await collect(apiSse('/api/x'))
  const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe(`${API_BASE}/api/x`)
  expect(new Headers(init.headers).get('Accept')).toContain('text/event-stream')
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd frontend && pnpm vitest run src/data/_client/api.sse.test.ts
```

Expected: FAIL — `apiSse` is not exported.

- [ ] **Step 3: Implement** — append to `frontend/src/data/_client/api.ts`:

```ts
/**
 * SSE over fetch (POST-capable, Authorization-capable — EventSource is neither).
 * Yields `{ event, data }` per frame; every `data:` payload on this API is a single JSON
 * line by contract (the backend JSON-encodes deltas), multi-line data is still joined per
 * the SSE spec. Non-OK responses throw the same ApiError as apiFetch (the backend emits
 * pre-stream failures as regular SystemMessageList JSON).
 */
export async function* apiSse(
  path: string,
  init: RequestInit = {},
): AsyncGenerator<{ event: string; data: string }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream, application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => [])) as SystemMessage[]
    throw new ApiError(
      Array.isArray(body) && body.length ? body : [{ code: 'INTERNAL_ERROR', message: `HTTP ${res.status}` }],
      res.status,
    )
  }
  if (!res.body) {
    throw new ApiError([{ code: 'STREAM_ERROR', message: 'No response body' }], res.status)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
      let sep: number
      while ((sep = buf.indexOf('\n\n')) >= 0) {
        const frame = buf.slice(0, sep)
        buf = buf.slice(sep + 2)
        const event = parseSseFrame(frame)
        if (event) yield event
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function parseSseFrame(frame: string): { event: string; data: string } | null {
  let event = 'message'
  const data: string[] = []
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trimStart()
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
    // id:/retry:/comment lines are ignored — this client doesn't resume streams
  }
  return data.length ? { event, data: data.join('\n') } : null
}
```

- [ ] **Step 4: Run the test**

```bash
cd frontend && pnpm vitest run src/data/_client/api.sse.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/_client/api.ts frontend/src/data/_client/api.sse.test.ts
git commit -m "feat(fe/client): apiSse — fetch-based SSE reader with ApiError contract (mezo-fnnq.4)"
```

---

### Task 7: `data/insights/chatApi.ts` — REST + stream client, wire mapper (+ unit test)

**Files:**
- Create: `frontend/src/data/insights/chatApi.ts`
- Test: `frontend/src/data/insights/chatApi.test.ts`

**Interfaces:**
- Consumes: `apiFetch`, `apiSse`, `ApiError` (`@/data/_client/api`), generated types (Task 1).
- Produces: `chatApi.listConversations(): Promise<ConversationResponse[]>`, `chatApi.createConversation(): Promise<ConversationResponse>`, `chatApi.listMessages(id: string): Promise<MessageResponse[]>`, `chatApi.streamMessage(id: string, content: string, onDelta: (text: string) => void): Promise<MessageResponse>`, `toChatMessage(m: MessageResponse): ChatMessage`. Task 8 consumes all.

- [ ] **Step 1: Write the failing test**

```ts
import { toChatMessage } from '@/data/insights/chatApi'

test('maps a wire MessageResponse to the FE ChatMessage shape', () => {
  const mapped = toChatMessage({
    id: 'm1', role: 'assistant', content: 'Szia!', createdAt: '2026-07-03T06:32:00Z',
    tools: [{ type: 'read', name: 'get_sleep(days=7)' }],
    refs: [{ kind: 'SleepLog', id: 'sl-1' }],
  })
  expect(mapped.role).toBe('assistant')
  expect(mapped.text).toBe('Szia!')
  expect(mapped.ts).toMatch(/^\d{2}:\d{2}$/)
  expect(mapped.tools).toEqual([{ type: 'read', name: 'get_sleep(days=7)' }])
  expect(mapped.refs).toEqual([{ kind: 'SleepLog', id: 'sl-1' }])
})

test('omits empty tools/refs so user bubbles stay lean', () => {
  const mapped = toChatMessage({
    id: 'm2', role: 'user', content: 'hello', createdAt: '2026-07-03T06:34:00Z', tools: [], refs: [],
  })
  expect(mapped.tools).toBeUndefined()
  expect(mapped.refs).toBeUndefined()
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd frontend && pnpm vitest run src/data/insights/chatApi.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import { apiFetch, apiSse, ApiError } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { ChatMessage, ChatRole } from '@/data/types'
import type { Tool } from '@/shared/ui/ToolChip'

export type ConversationResponse = components['schemas']['ConversationResponse']
export type MessageResponse = components['schemas']['MessageResponse']
export type SendMessageRequest = components['schemas']['SendMessageRequest']
export type StreamDelta = components['schemas']['StreamDelta']
export type StreamError = components['schemas']['StreamError']

const CONVERSATION = '/api/companion/conversation'

/** Wire → FE mock-era shape (deliberately aligned in V0.2 — the cast below is the bridge). */
export function toChatMessage(m: MessageResponse): ChatMessage {
  return {
    role: m.role as ChatRole,
    ts: new Date(m.createdAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }),
    text: m.content,
    // wire `type` is a plain string; values come from our own backend ('read' | 'compute')
    tools: m.tools.length ? (m.tools as Tool[]) : undefined,
    refs: m.refs.length ? m.refs : undefined,
  }
}

export const chatApi = {
  listConversations: () => apiFetch<ConversationResponse[]>(CONVERSATION),
  createConversation: () => apiFetch<ConversationResponse>(CONVERSATION, { method: 'POST' }),
  listMessages: (conversationId: string) =>
    apiFetch<MessageResponse[]>(`${CONVERSATION}/${conversationId}/messages`),

  /**
   * One streamed turn: emits `onDelta` per chunk, resolves with the persisted assistant
   * message from the terminal `done` event; a terminal `error` event (or a stream that
   * ends without `done`) rejects with ApiError so callers share one failure path.
   */
  streamMessage: async (
    conversationId: string,
    content: string,
    onDelta: (text: string) => void,
  ): Promise<MessageResponse> => {
    const body = JSON.stringify({ content } satisfies SendMessageRequest)
    for await (const ev of apiSse(`${CONVERSATION}/${conversationId}/message/stream`, { method: 'POST', body })) {
      if (ev.event === 'delta') {
        onDelta((JSON.parse(ev.data) as StreamDelta).text)
      } else if (ev.event === 'done') {
        return JSON.parse(ev.data) as MessageResponse
      } else if (ev.event === 'error') {
        const code = (JSON.parse(ev.data) as StreamError).code
        throw new ApiError([{ code, message: 'Companion stream failed' }], 200)
      }
    }
    throw new ApiError([{ code: 'COMPANION_STREAM_INCOMPLETE', message: 'Stream ended without done' }], 200)
  },
}
```

- [ ] **Step 4: Run the test**

```bash
cd frontend && pnpm vitest run src/data/insights/chatApi.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/insights/chatApi.ts frontend/src/data/insights/chatApi.test.ts
git commit -m "feat(fe/data): companion chatApi — REST client + streamed turn + wire mapper (mezo-fnnq.4)"
```

---

### Task 8: `chatHooks.ts` — `useChat` + `useChatActions` dual-mode (+ hook tests, barrel rewire)

**Files:**
- Create: `frontend/src/data/insights/chatHooks.ts`
- Modify: `frontend/src/data/insights/chat.ts` (add `cannedReply`)
- Modify: `frontend/src/data/insights/insightsHooks.ts` (drop `useChat`)
- Modify: `frontend/src/data/hooks.ts` (re-export from the new module)
- Test: `frontend/src/data/insights/chatHooks.test.tsx`

**Interfaces:**
- Consumes: `chatApi`/`toChatMessage` (Task 7), `useDualQuery`, `isMockMode`, `initialChat`.
- Produces (Task 9's ChatPage consumes exactly these):
  - `interface ChatBootstrap { conversationId: string | null; messages: ChatMessage[]; degraded: boolean; mode: 'mock' | 'live' }`
  - `useChat(): { data: ChatBootstrap; isPending: boolean }`
  - `interface ChatTurn { userText: string; draft: string; thinking: boolean }`
  - `useChatActions(): { send: (text: string) => void; turn: ChatTurn | null; error: string | null }`
  - `cannedReply(text: string): string` (from `chat.ts`; Task 9's MSW handler reuses it)

- [ ] **Step 1: Add `cannedReply` to `frontend/src/data/insights/chat.ts`** (verbatim move of the ChatPage strings):

```ts
/** The Phase-1 demo reply — kept for mock mode; the MSW stream handler reuses it so
 *  both test modes assert the same strings. */
export function cannedReply(text: string): string {
  return (
    'Értem — és köszönöm hogy megosztottad. ' +
    (text.toLowerCase().includes('fáradt')
      ? 'A Reta D3-on ez gyakori; ne erőltessük a Pull Day-t ma. Egy könnyű walk és egy fehérje-snack többet adhat mint egy fél-erővel csinált edzés.'
      : 'Nézzük meg az adatokat: az elmúlt 3 napban a kalória-pacing 80%+ volt, és a Reta D3 ablakban ez stabil — innen indulhatunk.')
  )
}
```

- [ ] **Step 2: Write the failing hook tests** (`chatHooks.test.tsx`):

```tsx
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useChat, useChatActions } from '@/data/insights/chatHooks'
import { initialChat, cannedReply } from '@/data/insights/chat'

describe('useChat (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('seeds the Phase-1 conversation synchronously', () => {
    const { result } = renderHook(() => useChat(), { wrapper: makeHookWrapper() })
    expect(result.current.data.messages).toEqual(initialChat)
    expect(result.current.data.mode).toBe('mock')
    expect(result.current.data.degraded).toBe(false)
  })
})

describe('useChat (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('loads the newest conversation and maps its messages', async () => {
    const { result } = renderHook(() => useChat(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.data.conversationId).toBe('c-1'))
    expect(result.current.data.mode).toBe('live')
    expect(result.current.data.messages[0].text).toBe(initialChat[0].text)
    expect(result.current.data.messages[0].tools).toEqual(initialChat[0].tools)
  })

  it('resolves an empty account to an empty, non-degraded chat', async () => {
    server.use(http.get(`${API_BASE}/api/companion/conversation`, () => HttpResponse.json([])))
    const { result } = renderHook(() => useChat(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.data).toMatchObject({ conversationId: null, messages: [], degraded: false })
  })

  it('maps the switch-off 404 to an honest degraded state', async () => {
    server.use(http.get(`${API_BASE}/api/companion/conversation`, () =>
      HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND', message: 'off' }], { status: 404 })))
    const { result } = renderHook(() => useChat(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.data.degraded).toBe(true))
  })
})

describe('useChatActions (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('streams a turn into the chat cache', async () => {
    const wrapper = makeHookWrapper()
    const chat = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(chat.result.current.data.conversationId).toBe('c-1'))

    const actions = renderHook(() => useChatActions(), { wrapper })
    act(() => actions.result.current.send('Fáradt vagyok'))
    await waitFor(() => expect(actions.result.current.turn).toBeNull())

    const texts = chat.result.current.data.messages.map((m) => m.text)
    expect(texts).toContain('Fáradt vagyok')
    expect(texts).toContain(cannedReply('Fáradt vagyok'))
    expect(actions.result.current.error).toBeNull()
  })
})
```

NOTE: this file needs the Task-9 MSW companion handlers to pass — write it now (red), make it green in Task 9's Step 2 run. The two hooks in the last test MUST share one wrapper (one QueryClient) — call `makeHookWrapper()` once.

- [ ] **Step 3: Implement `chatHooks.ts`**

```ts
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { ApiError } from '@/data/_client/api'
import { chatApi, toChatMessage } from '@/data/insights/chatApi'
import { initialChat, cannedReply } from '@/data/insights/chat'
import type { ChatMessage } from '@/data/types'

export interface ChatBootstrap {
  conversationId: string | null
  messages: ChatMessage[]
  degraded: boolean
  mode: 'mock' | 'live'
}

/** One in-flight turn — the optimistic overlay ChatPage renders under the history. */
export interface ChatTurn { userText: string; draft: string; thinking: boolean }

const CHAT_KEY = ['chat'] as const
const EMPTY_CHAT: ChatBootstrap = { conversationId: null, messages: [], degraded: false, mode: 'live' }
const MOCK_CHAT: ChatBootstrap = {
  conversationId: 'mock-conversation', messages: initialChat, degraded: false, mode: 'mock',
}

const nowTs = () => new Date().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })

/**
 * Chat bootstrap read: the newest conversation + its full history. Real mode maps the
 * switch-off 404 to `degraded: true` (honest "companion unavailable", IDENT-3) instead
 * of a retried error — the progression 404→ghost pattern.
 */
export function useChat() {
  return useDualQuery<ChatBootstrap>({
    queryKey: CHAT_KEY,
    mockData: MOCK_CHAT,
    realFetch: async () => {
      try {
        const conversations = await chatApi.listConversations()
        const newest = conversations[0] // backend orders by last activity desc
        if (!newest) return EMPTY_CHAT
        const messages = await chatApi.listMessages(newest.id)
        return { conversationId: newest.id, messages: messages.map(toChatMessage), degraded: false, mode: 'live' }
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return { ...EMPTY_CHAT, degraded: true }
        throw err
      }
    },
    realEmpty: EMPTY_CHAT,
  })
}

/**
 * Send/stream state machine. Mock mode keeps the Phase-1 demo flow (1.2s thinking →
 * canned reply) but through the shared query cache; real mode ensures a conversation,
 * streams the SSE turn (deltas into `turn.draft`), then appends the persisted pair.
 */
export function useChatActions() {
  const queryClient = useQueryClient()
  const [turn, setTurn] = useState<ChatTurn | null>(null)
  const [error, setError] = useState<string | null>(null)

  const append = (conversationId: string, appended: ChatMessage[]) =>
    queryClient.setQueryData<ChatBootstrap>(CHAT_KEY, (old) => ({
      conversationId,
      messages: [...(old?.messages ?? []), ...appended],
      degraded: false,
      mode: old?.mode ?? (isMockMode() ? 'mock' : 'live'),
    }))

  const sendMock = (text: string) => {
    setTurn({ userText: text, draft: '', thinking: true })
    setTimeout(() => {
      append('mock-conversation', [
        { role: 'user', ts: 'now', text },
        {
          role: 'assistant', ts: 'now', text: cannedReply(text),
          tools: [
            { type: 'read', name: 'get_recent_checkins(d=3)' },
            { type: 'compute', name: `recallSharedMemory(theme='${text.slice(0, 20)}')` },
          ],
          refs: [{ kind: 'CheckIn', id: 'ci-2026-05-21' }],
        },
      ])
      setTurn(null)
    }, 1200)
  }

  const sendReal = (text: string) => {
    setTurn({ userText: text, draft: '', thinking: true })
    void (async () => {
      try {
        const cached = queryClient.getQueryData<ChatBootstrap>(CHAT_KEY)
        const conversationId = cached?.conversationId ?? (await chatApi.createConversation()).id
        const done = await chatApi.streamMessage(conversationId, text, (delta) =>
          setTurn((t) => (t ? { ...t, draft: t.draft + delta, thinking: false } : t)))
        append(conversationId, [{ role: 'user', ts: nowTs(), text }, toChatMessage(done)])
      } catch {
        setError('Nem sikerült válaszolni — próbáld újra.')
        // the user message may have persisted server-side; refetch keeps history honest
        void queryClient.invalidateQueries({ queryKey: CHAT_KEY })
      } finally {
        setTurn(null)
      }
    })()
  }

  const send = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || turn) return
    setError(null)
    if (isMockMode()) sendMock(trimmed)
    else sendReal(trimmed)
  }

  return { send, turn, error }
}
```

- [ ] **Step 4: Rewire the exports** —

In `frontend/src/data/insights/insightsHooks.ts`: delete the `useChat` function and the `initialChat` import (keep `useKnowledge`/`useInsights`).

In `frontend/src/data/hooks.ts` replace

```ts
export { useKnowledge, useInsights, useChat } from '@/data/insights/insightsHooks'
```

with

```ts
export { useKnowledge, useInsights } from '@/data/insights/insightsHooks'
export { useChat, useChatActions } from '@/data/insights/chatHooks'
```

- [ ] **Step 5: Run the new tests (expect partial red — MSW handlers arrive in Task 9)**

```bash
cd frontend && pnpm vitest run src/data/insights/chatHooks.test.tsx
```

Expected: mock-mode describe PASS; real-mode describes FAIL with unhandled-request/404 noise — that is the Task 9 handoff. If anything in the mock describe fails, fix it now.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/insights/chatHooks.ts frontend/src/data/insights/chatHooks.test.tsx \
        frontend/src/data/insights/chat.ts frontend/src/data/insights/insightsHooks.ts frontend/src/data/hooks.ts
git commit -m "feat(fe/data): useChat + useChatActions dual-mode hooks (mezo-fnnq.4)"
```

---

### Task 9: MSW companion handlers + ChatPage rewrite (+ page tests both modes)

**Files:**
- Modify: `frontend/src/test/msw/handlers.ts`
- Modify: `frontend/src/features/insights/pages/ChatPage.tsx`
- Modify: `frontend/src/features/insights/pages/ChatPage.test.tsx`

**Interfaces:**
- Consumes: `useChat`/`useChatActions` (Task 8), `cannedReply`, `ChatMessage` component (unchanged), `initialChat`.
- Produces: the real dual-mode ChatPage; MSW fixtures mirroring `initialChat` so both modes assert the same strings.

- [ ] **Step 1: MSW handlers** — append to `handlers.ts` (companion block at the end of the array):

```ts
  // Companion chat (V0.4) — fixtures mirror the mock seed (initialChat) so page/hook tests
  // assert the same strings in both modes. Tests exercise switch-off by overriding the
  // conversation list with a 404 (server.use).
  http.get(`${API_BASE}/api/companion/conversation`, () =>
    HttpResponse.json([
      { id: 'c-1', title: 'Aludtam 7h-t…', startedAt: '2026-07-03T06:32:00Z', lastMessageAt: '2026-07-03T06:34:00Z' },
    ]),
  ),
  http.post(`${API_BASE}/api/companion/conversation`, () =>
    HttpResponse.json({ id: 'c-new', title: null, startedAt: '2026-07-03T07:00:00Z', lastMessageAt: null }, { status: 201 }),
  ),
  http.get(`${API_BASE}/api/companion/conversation/:id/messages`, () =>
    HttpResponse.json(
      initialChat.map((m, i) => ({
        id: `msg-${i}`,
        role: m.role,
        content: m.text,
        createdAt: `2026-07-03T06:3${i}:00Z`,
        tools: m.tools ?? [],
        refs: m.refs ?? [],
      })),
    ),
  ),
  http.post(`${API_BASE}/api/companion/conversation/:id/message/stream`, async ({ request }) => {
    const { content } = (await request.json()) as { content: string }
    const reply = cannedReply(content)
    const mid = Math.ceil(reply.length / 2)
    const encoder = new TextEncoder()
    const frame = (event: string, data: unknown) => `event:${event}\ndata:${JSON.stringify(data)}\n\n`
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(frame('delta', { text: reply.slice(0, mid) })))
        controller.enqueue(encoder.encode(frame('delta', { text: reply.slice(mid) })))
        controller.enqueue(encoder.encode(frame('done', {
          id: 'msg-done', role: 'assistant', content: reply,
          createdAt: '2026-07-03T07:00:05Z', tools: [], refs: [],
        })))
        controller.close()
      },
    })
    return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } })
  }),
```

Add the imports at the top of `handlers.ts`:

```ts
import { initialChat, cannedReply } from '@/data/insights/chat'
```

- [ ] **Step 2: Verify the Task-8 hook tests go green**

```bash
cd frontend && pnpm vitest run src/data/insights/chatHooks.test.tsx && VITE_USE_MOCK=true pnpm vitest run src/data/insights/chatHooks.test.tsx
```

Expected: PASS in both modes.

- [ ] **Step 3: Rewrite `ChatPage.tsx`**

```tsx
import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { useChat, useChatActions } from '@/data/hooks'
import { ChatMessage } from '@/features/insights/components/ChatMessage'

const SUBTITLE = { mock: 'demo beszélgetés', live: 'Gemini · élő' } as const

function ThinkingDots() {
  return (
    <div className="col gap-sm" style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
      <span className="eyebrow brand">Mezo</span>
      <div className="card notch-12" style={{ padding: 14 }}>
        <div className="row gap-xs">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-glow)',
                animation: `pulse-soft 1.2s ease-in-out infinite ${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function ChatPage() {
  const { data, isPending } = useChat()
  const { send, turn, error } = useChatActions()
  const [draft, setDraft] = useState('')
  const { messages, degraded, mode } = data

  const submit = () => {
    if (!draft.trim() || degraded || turn) return
    send(draft)
    setDraft('')
  }

  return (
    <div className="col gap-md">
      <div className="row gap-sm" style={{ justifyContent: 'space-between' }}>
        <div className="col">
          <span className="eyebrow brand">Mezo · társ</span>
          <span className="text-tertiary" style={{ fontSize: 11, fontFamily: 'var(--ff-mono)' }}>
            {degraded ? 'a társ most nem elérhető' : SUBTITLE[mode]}
          </span>
        </div>
      </div>

      {degraded && (
        <div className="card notch-12" style={{ padding: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            A társ jelenleg nincs bekapcsolva — a beszélgetés nem elérhető. A napló, az edzés és a
            Fuel változatlanul működik.
          </p>
        </div>
      )}

      <div className="col gap-md" style={{ minHeight: 320 }}>
        {isPending && !degraded && messages.length === 0 && !turn && <ThinkingDots />}
        {messages.map((m, i) => (
          <ChatMessage key={i} m={m} />
        ))}
        {turn && <ChatMessage m={{ role: 'user', ts: 'most', text: turn.userText }} />}
        {turn && turn.thinking && <ThinkingDots />}
        {turn && !turn.thinking && turn.draft && (
          <ChatMessage m={{ role: 'assistant', ts: 'most', text: turn.draft }} />
        )}
        {error && (
          <div className="card notch-12" style={{ padding: 14, alignSelf: 'flex-start', maxWidth: '85%' }}>
            <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>{error}</p>
          </div>
        )}
      </div>

      <div className="card notch-12" style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" className="chip" style={{ padding: 8 }} aria-label="Hangbevitel">
          <Icon name="mic" size={14} />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Mondj valamit..."
          disabled={degraded}
          style={{ flex: 1, padding: '8px 4px', fontSize: 13 }}
        />
        <button
          type="button" className="chip brand" onClick={submit} disabled={degraded}
          style={{ padding: 8 }} aria-label="Küldés"
        >
          <Icon name="send" size={14} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rewrite `ChatPage.test.tsx`** (mode-stubbed describes, LogDoseSheet idiom; QueryClient wrapper required now):

```tsx
import { render, screen, act, fireEvent } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { ChatPage } from '@/features/insights/pages/ChatPage'
import { cannedReply } from '@/data/insights/chat'

const renderPage = () => render(<ChatPage />, { wrapper: QueryWrapper })

describe('ChatPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('seeds the conversation and the composer', () => {
    renderPage()
    expect(screen.getByText(/Jó reggelt\. Tegnap a Push Day/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Mondj valamit...')).toBeInTheDocument()
    expect(screen.getByText('get_recent_workouts(days=3)')).toBeInTheDocument()
  })

  test('sending a message appends it and then simulates a reply', async () => {
    // fireEvent (not userEvent) — userEvent deadlocks under fake timers here; see
    // ImportItemSheet.test.tsx for the documented environment issue.
    vi.useFakeTimers()
    renderPage()
    const input = screen.getByPlaceholderText('Mondj valamit...')
    fireEvent.change(input, { target: { value: 'Fáradt vagyok' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('Fáradt vagyok')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(1300)
    })
    expect(screen.getByText(/A Reta D3-on ez gyakori/)).toBeInTheDocument()
    vi.useRealTimers()
  })
})

describe('ChatPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('loads the history from the backend', async () => {
    renderPage()
    expect(await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)).toBeInTheDocument()
    expect(screen.getByText('get_recent_workouts(days=3)')).toBeInTheDocument()
    expect(screen.getByText('Gemini · élő')).toBeInTheDocument()
  })

  test('sending a message streams the reply into the thread', async () => {
    renderPage()
    await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)
    const input = screen.getByPlaceholderText('Mondj valamit...')
    fireEvent.change(input, { target: { value: 'Fáradt vagyok' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText('Fáradt vagyok')).toBeInTheDocument()
    expect(await screen.findByText(cannedReply('Fáradt vagyok'))).toBeInTheDocument()
  })

  test('renders the honest degraded state when the companion switch is off', async () => {
    server.use(http.get(`${API_BASE}/api/companion/conversation`, () =>
      HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND', message: 'off' }], { status: 404 })))
    renderPage()
    expect(await screen.findByText(/A társ jelenleg nincs bekapcsolva/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Mondj valamit...')).toBeDisabled()
  })
})
```

- [ ] **Step 5: Run the page + data tests in both modes**

```bash
cd frontend && pnpm vitest run src/features/insights src/data/insights src/data/_client/api.sse.test.ts \
  && VITE_USE_MOCK=true pnpm vitest run src/features/insights src/data/insights src/data/_client/api.sse.test.ts
```

Expected: PASS in both runs (note: `chatData.test.tsx` and `ChatMessage` snapshots are untouched and must stay green).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/test/msw/handlers.ts frontend/src/features/insights/pages/ChatPage.tsx \
        frontend/src/features/insights/pages/ChatPage.test.tsx
git commit -m "feat(insights): ChatPage goes real — streamed turns, history, degraded state (mezo-fnnq.4)"
```

---

### Task 10: Full gates + end-to-end verification

**Files:** none (verification only; fix regressions where they surface).

- [ ] **Step 1: Frontend full gate**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Expected: build green; ALL tests green in BOTH modes.

- [ ] **Step 2: Backend full gate**

```bash
cd backend && docker compose up -d && ./mvnw clean test
```

Expected: BUILD SUCCESS, all ITs green.

- [ ] **Step 3: Live end-to-end (verify skill — drive the real flow).** Terminal 1 backend with the FAKE adapter (no API key needed — the echo proves the whole SSE path):

```bash
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata,companion-fake
```

Terminal 2 frontend real mode:

```bash
cd frontend && pnpm dev
```

Then in a browser (Playwright/Chrome DevTools MCP): open `http://localhost:5180`, navigate Insights → Chat, send `mi a mai terv?`, and verify: the user bubble appears, the answer streams in (the FAKE-LLM echo containing `AKTUÁLIS ÁLLAPOT` proves the V0.3 snapshot rode along), the thread persists on reload. If a real `GEMINI_API_KEY` is exported, repeat once with `-Dspring-boot.run.profiles=demodata` for a real Gemini answer. Screenshot for the session log.

- [ ] **Step 4: Commit anything the verification shook out** (only if fixes were needed).

---

### Task 11: Documentation (mandatory — the slice is not done without it)

**Files:**
- Modify: `docs/features/companion.md`
- Modify: `docs/features/insights.md` (§2.5 + key files)
- Modify: `docs/features/_platform-api-backend.md` (§1 table row, §9 precedent, §4c)
- Modify: `docs/milestones/roadmap.md` (Phase-3 line + milestone log row)

**Content (edit the named sections in place — overwrite, no changelogs):**

- [ ] **Step 1: `companion.md`** —
  - Header one-line + §1 status: streaming ✅ V0.4, FE ✅ dual-mode wired; status table rows: `Streaming (SSE)` → ✅ V0.4 (`POST .../message/stream`, delta/done/error, two-transaction turn), `Frontend` → ✅ V0.4 (`useChat`/`useChatActions` + real ChatPage, degraded switch-off state).
  - §2 user-facing behavior: replace "None yet" — describe the real ChatPage flow (history load, streamed answer, mock header vs live header, degraded banner), note deployed env runs switch-off until the Gemini secret lands.
  - §3: add the stream flow diagram mirroring the sync one (`CompanionStreamController` → `ChatStreamService` → `prepareTurn` → `CompanionLlm.stream` → `completeTurn`; error ⇒ `error` event, no assistant row).
  - §4 REST table: add the stream endpoint row (`POST .../message/stream` · SSE `delta`/`done`/`error` · 200/400/401/404); schemas: add `StreamDelta{text}`, `StreamError{code}`; note the sync endpoint's unchanged one-transaction semantics vs the streamed two-transaction turn.
  - §5.1: seam now WIRED — `chatApi.ts`/`chatHooks.ts`/ChatPage; the FE `ChatMessage` mapping (`toChatMessage`).
  - §6: add the curl SSE example (`curl -N -H "Accept: text/event-stream" -X POST .../message/stream -d '{"content":"..."}'`) and the FE consumption note.
  - §8: add `ChatStreamServiceIT` (3 tests) + `CompanionStreamApiIT` (5 tests) + the switch-off stream assertion + the FE test files (`api.sse.test.ts`, `chatApi.test.ts`, `chatHooks.test.tsx`, `ChatPage.test.tsx` both modes).
  - §9: add V0.4 decisions 11–15 (SSE contract precedent / event protocol / two-transaction turn + honest-history semantics / fetch-ReadableStream transport / degraded-state pattern) + the `FakeCompanionLlm` sentinel gotcha (`[fake-fail]`/`[fake-stream-fail]` in test content force failures) + `spring.mvc.async.request-timeout` note.
  - §10: add the new key files (controller, stream service, ITs, `chatApi.ts`, `chatHooks.ts`, updated ChatPage); add `frontend/src/data/insights/chatHooks.ts` to `key_files` frontmatter; bump `updated:`.
- [ ] **Step 2: `insights.md` §2.5** — rewrite: ChatPage is now the real companion surface (dual-mode; mock = Phase-1 seeded demo with the canned reply; real = conversation bootstrap + SSE streaming + degraded state); pointer to `companion.md` for the backend; key-files section gains `chatApi.ts`/`chatHooks.ts`.
- [ ] **Step 3: `_platform-api-backend.md`** — §1 table companion row: V0.4 shipped (SSE + FE wired); §4c: add the stream endpoint (marked "hand-written — CompanionStream precedent"); §9 new decision block: **"SSE endpoints in the contract-first flow (V0.4 precedent)"** — operation documented in the fragment under a dedicated tag; generated `<Tag>Api` deliberately unimplemented (inert interface); controller hand-written with `Flux<ServerSentEvent<Object>>`; event payloads as component schemas so both generators emit types; pre-stream errors are plain JSON (dual Accept).
- [ ] **Step 4: `roadmap.md`** — Phase-3 line: mark ✅ V0.4 (one sentence: SSE turn + real dual-mode ChatPage + degraded state; next V0.5 / parallel tracks); add the milestone-log row for 2026-07-03 (or the actual date) summarizing the slice in the house style.
- [ ] **Step 5: Lint + commit**

```bash
node scripts/lint-docs.mjs
git add docs/
git commit -m "docs(companion): V0.4 — SSE + FE chat living docs + SSE contract precedent (mezo-fnnq.4)"
```

Expected: lint green (no orphans/broken links/stale flags on the touched docs).

---

### Task 12: Merge, close, hand off

- [ ] **Step 1: Merge locally (single dev, no PR)**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git checkout main
git pull --rebase
git merge --no-ff feat/companion-v04 -m "Merge feat/companion-v04: SSE streaming + FE ChatPage real (mezo-fnnq.4)"
git branch -d feat/companion-v04
```

(NO `git pull --rebase` after the merge — it flattens the `--no-ff` merge commit; push directly.)

- [ ] **Step 2: Close the bd issue + sync**

```bash
bd close mezo-fnnq.4
bd update mezo-fnnq.4 --notes "V0.4 shipped: SSE stream endpoint (delta/done/error, two-tx turn, hand-written controller precedent recorded in _platform-api-backend.md), FE useChat/useChatActions dual-mode + real ChatPage with degraded state; k3s keeps companion off until GEMINI_API_KEY secret lands. Next: V0.5 tool calling (mezo-fnnq.5) — unblocked."
bd dolt push
```

- [ ] **Step 3: Push and verify**

```bash
git push
git status   # MUST show "up to date with origin"
```

---

## Self-review notes

- **Spec coverage:** roadmap §V0.4 items — SSE variant of the message endpoint ✓ (Tasks 1, 3, 4); contract-first precedent decided + recorded ✓ (Decision 1, Task 11); FE dual-mode `useChat`/`useChatActions` in `data/insights/` ✓ (Task 8); ChatPage send/stream/history ✓ (Task 9); honest degraded state ✓ (Decision 5, Tasks 8–9); streaming outside `useDualQuery` (mutation + incremental append) ✓ (Task 8); mock chips stay until V0.5 ✓ (mock branch keeps them; real tools/refs stay `[]` on the wire). bd note (deployed GEMINI_API_KEY prerequisite) ✓ (Task 5).
- **Known risk (called out in tasks):** exact SSE wire text (`event:delta` vs `event: delta`) from Spring's writer — Task 4 says relax to `contains("delta")` if the first run shows a space; MVC support for `Flux<ServerSentEvent>` requires reactor-core, which Spring AI already brings (verified in `pom.xml`).
- **Type consistency:** `PreparedTurn`/`prepareTurn`/`completeTurn` (Tasks 2→3), `ChatBootstrap`/`ChatTurn`/`CHAT_KEY` (Task 8→9), `cannedReply` (Task 8→9 MSW), `apiSse` (Task 6→7), event names `delta`/`done`/`error` (Tasks 3→4→6→7→9) — all single-sourced.
