# Companion Stream — Live Tool Events & Anti-Preamble Prompt — Design Spec

- **Date:** 2026-07-30
- **Driving bd:** `mezo-280` (siblings, already shipped on this branch: `mezo-ajp` sport blindness, `mezo-sxe` recipe search)
- **Status:** design (frozen artifact — do not rewrite; a new effort gets a new dated spec)
- **Scope:** API contract (`api/feature/companion`) + backend (`feature/companion`) + frontend (`data/insights`, `features/insights`, `shared/ui`).
- **Related:** [`docs/features/companion.md`](../../features/companion.md), [`docs/references/api_contract_conventions.md`](../../references/api_contract_conventions.md), [`docs/references/companion_tool_conventions.md`](../../references/companion_tool_conventions.md)

## 1. Problem

In a live chat on 2026-07-29 the companion repeatedly looked like it **answered before its tools ran**:

> **Daniel:** oké, nagyon éhes vagyok. mit egyek most? … smoothie collagen a receptek közül
> **Mezo:** *(chips shown after the fact: `get_fuel_log(...)`, `get_recipes(filter=smoothie collagen)`)*
> "…Most **megpróbálom megnézni** a smoothie kollagén receptjét, hogy lássuk, hogyan illeszkedik a céljaidhoz."
> **Daniel:** siker?

Daniel's report: *"van egy válasz először, hogy nem látja, aztán utána jönnek a tool call eredmények és változik a válasz folyamatosan. Olyan mintha hamarabb válaszolna mint, hogy lefutnak a tool callok."*

### 1.1 What is NOT the cause

Spring AI's streaming tool loop is correct. `GoogleGenAiChatModel.internalStream` (spring-ai-google-genai 2.0.0) recurses with the tool result and streams the continuation:

```java
Flux<ChatResponse> flux = chatResponseFlux.flatMap(response -> {
    if (this.toolExecutionEligibilityPredicate.isToolExecutionRequired(prompt.getOptions(), response)) {
        …
        return this.internalStream(new Prompt(toolExecutionResult.conversationHistory(), prompt.getOptions()), response);
    }
    return Flux.just(response);
})
```

Pre-tool text chunks pass through, the tool executes, the continuation streams. No fix belongs there.

### 1.2 The three real causes

| # | Cause | Evidence |
|---|---|---|
| **C1** | **The model narrates before calling a tool.** "Nézzük meg…", "Most megpróbálom megnézni…" streams first and is persisted as part of the answer. | `ChatService.SYSTEM_PROMPT` (`service/ChatService.java:46-69`) tells the model *which* tool to call but never *when* — nothing forbids answering-shaped text before the call. |
| **C2** | **Tool chips are back-filled at the very end.** During the whole tool phase the UI shows undifferentiated bouncing dots; then every chip appears at once, after the answer. | The wire carries exactly three events (`ChatStreamService.java:42-44`); the FE's streaming bubble passes only `{role, ts, text}` (`ChatPage.tsx:73`), so chips (`ChatMessage.tsx:47`) can only come from the terminal `done` payload. |
| **C3** | **The text visibly swaps at the end.** | On `done` the FE discards the streamed draft and renders the authoritative row (`chatHooks.ts:97,102-104`), which `CompanionAdvisorChain.review` (`advisor/CompanionAdvisorChain.java:48-71`) may have entirely rewritten in a non-streamed corrective round. |

C2 is the dominant one: even a perfectly-ordered turn *renders* as "answer first, tools after".

C3 is **working as designed** (the done row is authoritative and the corrective retry must be able to replace a bad answer) and is out of scope here — but it is only tolerable because it is rare. It is left alone deliberately.

## 2. Goal

The user sees **what the companion is reading, while it reads it**, and the companion stops writing "I'll go look that up" instead of looking it up.

Non-goals: changing the advisor chain; streaming tool *results*; cancelling an in-flight turn; a Tool-RAG/routing change.

## 3. Design

### 3.1 A `tool` SSE event (C2)

`RecordingToolCallback.call` is the single choke point every companion tool passes through — it already records the call into `ToolCallAudit`. A per-turn listener on the audit turns that same recording into a live event.

**Contract** (`api/feature/companion/companion.yml`, already merged into `api/openapi.yml`):

```yaml
StreamToolCall:
  type: object
  required: [type, name]
  properties:
    type: { type: string }   # 'read' | 'compute' — V0.5 emits only 'read'
    name: { type: string }   # pre-baked label, e.g. 'get_training_plan(scope=today)'
```

Same shape and same pre-baked `name(args)` label as `MessageTool` (`CompanionMapper:118-119`), so the FE renders a live chip and a done-row chip through the identical component.

**Ordering contract:** `tool` events are **progress only**. The authoritative list stays the `done` row's `tools`, which additionally covers advisor-retry calls made after the stream ended. A client that ignores `tool` events behaves exactly as before — this is a backwards-compatible addition.

**Backend wiring** (`ChatStreamService`):

```
Sinks.Many<ServerSentEvent<Object>> toolSink = Sinks.many().unicast().onBackpressureBuffer();
audit.onCall(call -> toolSink.tryEmitNext(toolEvent(call)));
Flux<SSE> deltas = llm.stream(...).map(delta).doFinally(s -> toolSink.tryEmitComplete());
Flux.merge(toolSink.asFlux(), deltas).concatWith(doneMono).onErrorResume(...)
```

- `ToolCallAudit` gains **one** optional listener (`onCall(Consumer<ToolCall>)`), invoked from `recordCall`. The sync `ChatService.sendMessage` path never registers one, so it is unaffected.
- Spring AI executes a turn's tool calls sequentially (already documented on `ToolCallAudit`), so the unicast sink needs no extra serialization.
- Emission after the sink completes (an advisor-retry tool call) returns `FAIL_TERMINATED` and is dropped — deliberately: those calls still land in the authoritative `done` row.
- The listener must never be able to fail a turn: `tryEmitNext` returns a result rather than throwing, and the callback does nothing else.

**Frontend:** `chatApi.streamMessage` gains an `onTool` callback; `useChatActions` accumulates `turn.tools`; `ChatPage` renders them on the live bubble through the existing `ToolChipRow`. The `thinking` flag flips off on the first `delta` **or** the first `tool`, so the dots give way as soon as anything real happens.

### 3.2 Anti-preamble prompt rule (C1)

One rule appended to `ChatService.SYSTEM_PROMPT`, right after the existing "use the tools" sentence:

> Ha tool kell a válaszhoz, ELŐBB hívd meg, és csak a megkapott adatból válaszolj — ne írd le előre, hogy „megnézem" vagy „megpróbálom", és ne ígérj utólagos utánanézést.

Rationale: the tool-routing hint already lives in `[Eszköz-útmutató]`; this adds the missing *timing* rule. Kept to one sentence — prompt real estate is scarce and the block is already long.

## 4. Files

| File | Change |
|---|---|
| `api/feature/companion/companion.yml` | ✅ done — `StreamToolCall` schema + `tool` event in the endpoint summary/`oneOf` |
| `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts` | regenerated |
| `backend/.../companion/tools/ToolCallAudit.java` | optional `onCall` listener |
| `backend/.../companion/service/ChatStreamService.java` | tool sink merged into the delta flux |
| `backend/.../companion/service/ChatService.java` | one prompt sentence |
| `backend/src/test/.../companion/ChatStreamServiceIT.java` (or a sibling) | tool-event ordering + no-tool regression |
| `backend/src/test/.../companion/tools/ToolCallAuditTest.java` | listener unit coverage |
| `frontend/src/data/insights/chatApi.ts` | parse the `tool` event → `onTool` |
| `frontend/src/data/insights/chatHooks.ts` | accumulate `turn.tools` |
| `frontend/src/features/insights/pages/ChatPage.tsx` | live chips on the draft bubble |
| `frontend/src/test/msw/handlers.ts` | stream handler emits a `tool` frame |
| `docs/features/companion.md` | streaming section + tool catalog |

## 5. Risks

| Risk | Mitigation |
|---|---|
| A sink emission throwing kills the turn | `tryEmitNext` never throws; the callback body is a single emit |
| Live chips disagree with the final chips | Final chips are re-rendered from the authoritative `done` row, which replaces the draft bubble entirely — the live list is discarded, not merged |
| Contract drift check fails in CI | `api/generate` merge + `pnpm generate:api` run in the same commit |
| An SSE client that does not know `tool` | Unknown event names are already ignored by the FE parser (`chatApi.ts:45-51` has no `else`), and the event is additive |
