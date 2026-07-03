---
title: Companion (AI chat brain)
type: feature-domain
status: mixed
updated: 2026-07-03
tags: [companion, ai, chat, llm, backend, phase-3]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion
  - api/feature/companion/companion.yml
  - frontend/src/data/insights/chatHooks.ts
  - backend/src/main/resources/db/changelog/1.0.0/script/202607031400_mezo-fnnq.2_create_ai_conversation_message.sql
  - docs/decisions/0008-companion-llm-spring-ai-2-gemini.md
related: [insights, _platform-api-backend, _platform-auth-security]
---

# Companion (AI chat brain) — Feature Documentation

> One-line: the Phase-3 AI companion — persisted conversations + a Hungarian chat over the
> `CompanionLlm` port (Spring AI 2 / Gemini) with a deterministic cross-feature **context
> snapshot** in every system prompt, **8 read-only tools** for history/aggregate questions
> (audited into the message envelopes, rendered as real FE chips), answered **sync JSON or
> streamed SSE**, and consumed by the **real dual-mode ChatPage**. **Status: backend ✅ V0.5
> (spine + snapshot + SSE + tools/audit); FE ✅ V0.5 (ChatPage real incl. real tool-chips) —
> v0 „lát engem" complete.** Cross-cutting Phase-3 domain with no route/tab of its own — the
> surface is the Insights ChatPage ([`insights.md`](insights.md) §2.5).

## 1. Summary

The **companion** is mezo's Phase-3 "AI brain": a context-aware chat that will eventually know
Daniel's day, remember facts, recall similar past days, and surface patterns. It is being built
in 14 session-sized slices (epic `mezo-fnnq`); this doc tracks **what actually exists now**.

**V0.2 (`mezo-fnnq.2`) shipped the persistence spine** — the API everything else hangs on:

- **Two owned tables** — `ai_conversation` + `ai_message` (UUID PK, `created_by`, soft-delete;
  `ai_message.tool_calls`/`refs` are typed jsonb envelopes, **always null in V0.2**).
- **A contract fragment** — `api/feature/companion/companion.yml`: 4 endpoints (`GET/POST`
  conversation, `GET .../messages`, `POST .../message`).
- **Two switch-gated services** — `ConversationService` (CRUD spine) + `ChatService` (static
  Hungarian companion-voice system prompt + last-N-message history windowing → one sync
  `CompanionLlm.complete()` call → persists both turns).
- **A controller** — `CompanionController implements CompanionApi`, ownership from the JWT.

**V0.3 (`mezo-fnnq.3`) shipped the context snapshot — the "pain-killer":**

- **`ContextSnapshotAssembler`** (`service/ContextSnapshotAssembler.java`) — a read-only,
  deterministic composition of the OTHER features' reads (profile + weight trend, active goal +
  prescription current-week segment + day-planner, active meso + schedules + last-7d digest,
  FuelDay rollup + protocol + intakes, retaDay/phase, last sleep + latest check-in), rendered as
  six Hungarian-labelled blocks under `AKTUÁLIS ÁLLAPOT (pillanatkép — {dátum}):` and inserted
  into the `ChatService` system prompt **between the static voice and the history transcript**.
  Missing data renders as explicit `nincs adat`, never invented; no LLM anywhere in the path.

**V0.4 (`mezo-fnnq.4`) shipped streaming + the real FE:**

- **SSE stream endpoint** — `POST .../message/stream` (`text/event-stream`): 0..n `delta`
  events (JSON `StreamDelta{text}`), then exactly one terminal `done` (the persisted assistant
  `MessageResponse`) or `error` (`StreamError{code}`, assistant NOT persisted). Hand-written
  `CompanionStreamController` + `ChatStreamService` over the port's `stream(…)` — the
  **contract-first SSE precedent** (§9 Decision 11).
- **Two-transaction streamed turn** — `ChatService.prepareTurn` (user row) → LLM stream →
  `ChatService.completeTurn` (assistant row); a mid-stream failure keeps the user row only.
- **Real dual-mode FE** — `useChat()` + `useChatActions()` (`data/insights/chatHooks.ts`) +
  `chatApi.ts` (fetch-ReadableStream SSE client) drive the rewritten ChatPage: history load,
  optimistic streamed turn, honest degraded state on switch-off 404.

**V0.5 (`mezo-fnnq.5`) shipped tool calling + real tool-chips — v0 „lát engem" is complete:**

- **8 read-only tools** in `feature/companion/tools/` (spec §5 first batch), grouped by source
  domain: `TrainTools` (`get_recent_workouts`, `get_sport_sessions` — sport + run logs),
  `BiometricsTools` (`get_weight_trend`, `get_sleep`), `FuelTools` (`get_recent_meals` day
  rollups, `get_protocol_adherence`), `GoalTools` (`get_goal_progress`), `MedicationTools`
  (`get_reta_cycle`). All ownership-scoped via `ToolContext` (`userId` from the JWT principal,
  NEVER from model args), compact deterministic Hungarian text results, `nincs adat` absences.
- **Registry + audit spine** — `CompanionToolRegistry` wraps every callback in
  `RecordingToolCallback` (audit + per-turn budget, structurally unbypassable); the per-turn
  `ToolCallAudit` rides in the Spring AI `ToolContext`, collects `{type:'read', name, args}`
  calls + tool-contributed refs (deduped, capped), and persists into the V0.2 jsonb envelopes.
- **Chips are real** — `CompanionMapper` puts `name(args)` on the wire
  (`get_sleep(days=3)` — the mock-seed chip style); the FE `toChatMessage` already passed
  `tools[]`/`refs[]` through, so history AND the streamed `done` event now render real chips.
- **IDENT-2 structurally** — new ArchUnit rule `companion_tools_are_internal_sphere_only`
  (no HTTP/mail client deps in the tools package, ever).

**Status per layer:**

| Layer | State | Notes |
|---|---|---|
| Backend (tables + contract + services + sync endpoint) | ✅ V0.2 | Behind `mezo.feature.companion.enabled`; switch off ⇒ the whole HTTP surface 404s. |
| Context snapshot | ✅ V0.3 | `ContextSnapshotAssembler` in every chat turn's system prompt; LLM-free, `nincs adat` absences, `mezo.companion.snapshot.*` windows. |
| LLM adapter | ✅ V0.1 (ADR 0008) | Real `GeminiCompanionLlm` (`gemini-2.5-flash`) / deterministic `FakeCompanionLlm` (`companion-fake` profile, + forced-failure sentinels since V0.4, + `[fake-tool:…]` scripted tool execution since V0.5). |
| Streaming (SSE) | ✅ V0.4 | `POST .../message/stream` — `delta`/`done`/`error` events, two-transaction turn, hand-written controller (§9 Decision 11). |
| Tool calling + audit | ✅ V0.5 | 8 read tools over existing services; `RecordingToolCallback` audit + per-turn cap; `tool_calls`/`refs` envelopes persisted; `mezo.companion.tools.*` tunables. |
| Frontend | ✅ V0.5 | ChatPage is real dual-mode: mock = Phase-1 seeded demo; real = bootstrap + SSE streaming + degraded state + **real tool-chips/refs on streamed turns**. Deployed k3s keeps the switch OFF until a real `GEMINI_API_KEY` lands. |
| Facts / RAG / patterns | ❌ deferred | V1.x (facts), V2.x (RAG), V3.x (patterns). |

**Driver:** `mezo-fnnq.2` (spine) + `mezo-fnnq.3` (snapshot) + `mezo-fnnq.4` (SSE + FE) +
`mezo-fnnq.5` (tools + chips). **Design of record:**
[`docs/superpowers/specs/2026-07-03-phase3-companion-chat-design.md`](../superpowers/specs/2026-07-03-phase3-companion-chat-design.md)
(§3 data model, §4 snapshot, §5 tool catalog, §6 guardrails); slice map
[`docs/superpowers/plans/2026-07-03-companion-roadmap.md`](../superpowers/plans/2026-07-03-companion-roadmap.md)
§V0.2–V0.5; implementation plans
[`2026-07-03-companion-v02-conversations.md`](../superpowers/plans/2026-07-03-companion-v02-conversations.md) +
[`2026-07-03-companion-v03-context-snapshot.md`](../superpowers/plans/2026-07-03-companion-v03-context-snapshot.md) +
[`2026-07-03-companion-v04-sse-fe-chat.md`](../superpowers/plans/2026-07-03-companion-v04-sse-fe-chat.md) +
[`2026-07-03-companion-v05-tools.md`](../superpowers/plans/2026-07-03-companion-v05-tools.md);
provider/port ADR
[`0008-companion-llm-spring-ai-2-gemini.md`](../decisions/0008-companion-llm-spring-ai-2-gemini.md).

## 2. User-facing behavior

The ChatPage under Insights (`/insights/chat`, [`insights.md`](insights.md) §2.5) is the real
companion surface since V0.4, dual-mode:

- **Real mode** (default `pnpm dev`, backend on :8090): the page bootstraps the **newest
  conversation + its full history** on load (header: `Mezo · társ` / `Gemini · élő`). Sending a
  message renders the user bubble immediately, thinking-dots until the first chunk, then the
  answer **streams in incrementally** (SSE `delta`s into a draft bubble); on the terminal `done`
  the persisted pair replaces the optimistic overlay. A first-ever message auto-creates the
  conversation. A stream failure shows an honest inline error bubble (`Nem sikerült válaszolni —
  próbáld újra.`) and refetches history (the user message survived server-side). History
  persists across reloads.
- **Degraded state (IDENT-3)** — companion switch off ⇒ the API 404s ⇒ the page renders a banner
  (`A társ jelenleg nincs bekapcsolva…`), subtitle `a társ most nem elérhető`, disabled composer;
  every other tab is untouched. This is exactly the **deployed k3s state** until a real
  `GEMINI_API_KEY` lands in the `mezo-app` secret (`MEZO_FEATURE_COMPANION_ENABLED=false` in
  `k8s/backend/deployment.yaml`).
- **Mock mode** (`VITE_USE_MOCK=true`): the Phase-1 demo — seeded `initialChat`, the canned
  1.2s `cannedReply` (branches on `"fáradt"`), subtitle `demo beszélgetés`. The V0.4 rewrite
  removed the fake `"23 facts active · Gemini 3.1 Pro"` line and the `"L4 aktív"` chip — the
  header is honest in both modes.

## 3. Architecture & data flow

**The streamed turn (V0.4 + V0.5 tools — what the FE uses):**

```
ChatPage (send) → useChatActions.sendReal → chatApi.streamMessage        (fetch + ReadableStream)
POST /api/companion/conversation/{id}/message/stream   (text/event-stream)
  → CompanionStreamController.streamMessage    controller/CompanionStreamController.java:38
      HAND-WRITTEN (§9 Decision 11) — @Valid + mapping live here, not on a generated interface
  → ChatStreamService.streamMessage            service/ChatStreamService.java:47
      1. chatService.prepareTurn(userId, id, req)     ── TX #1: getOwned (404 BEFORE the stream),
         prompt = voice + snapshot + history, persist USER row, title-once + lastMessageAt
      2. audit = toolRegistry.newTurnAudit()          ── V0.5: per-turn budget + call/ref collector
      3. companionLlm.stream(prompt, content,         ── NO TX: Spring AI runs the tool loop
             toolRegistry.callbacks(audit),              internally — each RecordingToolCallback
             toolRegistry.toolContext(userId, audit))     records {name,args} + tools add refs;
         each text chunk → event:delta, data: StreamDelta{text} (JSON)
      4. chatService.completeTurn(userId, id, answer, audit) ── TX #2: persist ASSISTANT row
         WITH tool_calls/refs envelopes → terminal event:done, data: MessageResponse
         (tools[] = "name(args)" chips, refs[] = tool-contributed data refs)
      onError ⇒ event:error, data: StreamError{code:"COMPANION_STREAM_FAILED"} — NO assistant row
  → FE: deltas append into the optimistic draft bubble; done → the persisted pair is written
    into the ['chat'] query cache (no refetch) and the chips/refs render; error → inline error
    bubble + invalidate
```

MVC adapts the returned `Flux<ServerSentEvent<Object>>` onto an internal `SseEmitter`
(reactor-core is on the classpath via Spring AI); `spring.mvc.async.request-timeout: 120s`
covers slow LLM streams. Pre-stream failures (400/401/404) are ordinary JSON
`SystemMessageList` responses — the FE sends `Accept: text/event-stream, application/json`.

**The sync turn (V0.2 — unchanged, one transaction):**

```
POST /api/companion/conversation/{id}/message   (sync JSON)
  → CompanionController.sendMessage            controller/CompanionController.java:42  (implements CompanionApi)
      currentUserId.get()  (JWT subject → UUID; techcore/security/CurrentUserId)
  → ChatService.sendMessage(userId, id, req)   service/ChatService.java:90
      1. conversationService.getOwned(userId, id)          → 404 RESOURCE_NOT_FOUND if missing/foreign
      2. systemPrompt = SYSTEM_PROMPT (incl. the V0.5 tool-usage line)
                      + contextSnapshotAssembler.render(userId, LocalDate.now())    ── V0.3 ──
                      + renderHistory(loadWindow())  ("Daniel:"/"Mezo:" transcript)
      3. persist the USER row (saveAndFlush → distinct created_at)
      4. audit = toolRegistry.newTurnAudit(); answer = companionLlm.complete(       ── V0.5 ──
             systemPrompt, req.content, toolRegistry.callbacks(audit),
             toolRegistry.toolContext(userId, audit))                               ── PORT ──►
         (real: GeminiCompanionLlm → Gemini tool loop · tests: FakeCompanionLlm echoes both
          halves + executes [fake-tool:…] sentinels through the REAL callbacks)
      5. persist the ASSISTANT row with audit.toToolCallsEnvelope()/toRefsEnvelope()
         (null when no tool ran — the V0.2 steady state is unchanged)
      6. touchConversation → lastMessageAt = now; title = first user msg (once)
  → CompanionMapper.toMessageResponse(assistant)   mapper/CompanionMapper.java:30
      (null envelope → []; envelope entry {type,name,args} → wire MessageTool{type, "name(args)"})
```

**The tool pipeline (V0.5).** `CompanionToolRegistry` (`tools/CompanionToolRegistry.java`) is the
ONLY assembly point: it builds the 8 callbacks from the 5 domain toolsets via `ToolCallbacks.from`
and wraps each in `RecordingToolCallback` (`tools/RecordingToolCallback.java`) bound to the turn's
`ToolCallAudit` (`tools/ToolCallAudit.java`). The decorator records `{type:'read', name, args}`
BEFORE delegating (a tool cannot forget its audit), soft-fails past
`mezo.companion.tools.max-calls-per-turn` with honest in-band text, and converts a tool exception
into an honest error result (one broken read never kills a streamed turn). Tools receive the
Spring AI `ToolContext` carrying `userId` (ownership scoping is structural — model args are never
trusted for identity, `tools/ToolContexts.java`) and the audit (for `addRef(kind, id)` — deduped,
capped at `max-refs-per-turn`). Results are compact deterministic Hungarian text with `nincs adat`
absences and config-clamped windows (`max-window-days`, `max-trend-weeks`) — token budget by
construction. Window args are model-optional (`@ToolParam(required = false)`) with in-code
defaults (7 days / 4 weeks).

**The context snapshot (V0.3).** `ContextSnapshotAssembler.render(userId, today)`
(`service/ContextSnapshotAssembler.java`) returns the `AKTUÁLIS ÁLLAPOT` block with six lines in
spec §4 order — `[Profil]` (biometric profile + `WeightTrendService` trend; an empty weigh-in
series renders `nincs adat`, and rates are omitted while `dataSufficiency = NONE` — a zero trend
would be a fabricated number), `[Cél]` (active goal, derived current week
`DAYS(startDate→today)/7+1`, the prescription segment whose `fromWeek..toWeek` contains it, and
the `mealsPerDay`/`wakeTime`/`bedTime` planner fields), `[Edzés]` (active meso with the week
DERIVED from `startDate` — the stored `currentWeek` can lag; gym/sport weekly rhythm; last-N-days
gym/sport/run digest), `[Mai üzemanyag]` (`FuelDayService.getDay` consumed/targets incl. water +
active protocol + today's intake count), `[Gyógyszer]` (`MedicationCycleService.derive` retaDay +
phase; an active med with no dose renders `nincs rögzített dózis` — honest zero), and
`[Regeneráció]` (latest sleep + latest check-in, note truncated to
`snapshot.checkin-note-max-chars`). Every lookup uses `Optional`/status-filtered repo finders —
the assembler NEVER throws for missing data. Composition is strictly one-way (companion → other
features; ArchUnit's cycle rule guards the reverse).

**Prompt assembly (the load-bearing shape).** The window is loaded **before** persisting the new
message, so the current turn travels as the `userMessage` param, never inside the rendered history
block (`ChatService.java:54-58`). `renderHistory` (`ChatService.java:73`) prepends a
`HISTORY_HEADER` (`"Eddigi beszélgetés (legrégebbitől a legújabbig):"`) then one line per prior
message — `"Daniel: …"` for a user row, `"Mezo: …"` for an assistant row. `SYSTEM_PROMPT`
(`ChatService.java:32`) is the static Hungarian companion voice (IDENT-1 "társ, nem edző" + the
clinical guard "Gyógyszer adagolására (pl. retatrutid) vonatkozó változtatást SOHA ne javasolj — az
orvosi döntés." + "számot vagy adatot kitalálni tilos", spec §6, + the V0.5 tool-usage line
"Múltbeli vagy összesítő kérdéshez … használd a kapott tool-okat"). The `CompanionLlm` port keeps
the two-string prompt shape and carries the tools alongside (`complete(system, user, tools,
toolContext)`) — the message-list variant V0.2 Decision #4 predicted turned out unnecessary
(Decision 16).

**Switch-gating (every bean conditional).** `CompanionController`, `ConversationService`,
`ChatService`, `CompanionMapper` (via the services), and both LLM adapters are
`@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")` —
`mezo.feature.companion.enabled`. **Switch off ⇒ no companion beans exist at all**, the context
still boots (the app is fully usable without companion), and the whole `/api/companion/*` surface
**404s** (there is no controller to route to — `CompanionApiSwitchOffIT`). Because the port bean is
absent when off, **nothing outside the switch may inject `CompanionLlm`** (see §9 gotcha).

**LLM adapter selection (ADR 0008).** With the switch on, exactly one `CompanionLlm` bean is
active: `GeminiCompanionLlm` (`llm/GeminiCompanionLlm.java`, `@Profile("!companion-fake")`) for
real traffic over the autoconfigured Gemini `ChatModel`, or `FakeCompanionLlm`
(`llm/FakeCompanionLlm.java`, `@Profile("companion-fake")`) in tests. The Gemini starter builds its
`ChatModel` **regardless** of the mezo switch, so a dummy `GEMINI_API_KEY` default keeps every
context bootable key-less (ADR 0008 consequence).

**Ownership.** Both entities extend `OwnedEntity` (`techcore/persistence/OwnedEntity.java` —
`created_by`, `is_deleted`, `created_at`), soft-deleted via `@SQLDelete`/`@SQLRestriction`. The
owner is resolved server-side from `CurrentUserId.get()` and stamped on write, never from a DTO —
the standard auth spine ([`_platform-auth-security.md`](_platform-auth-security.md) §5). Reads are
owner-scoped: `AiConversationRepository.findAllOwned` overrides the `OwnedRepository` default
(which orders by a non-existent `e.date`) with a `coalesce(lastMessageAt, createdAt) desc` JPQL
order (`repository/AiConversationRepository.java:14`); `AiMessageRepository` is a child-table
`JpaRepository` with `…OrderByCreatedAtAsc` (history) and `…OrderByCreatedAtDesc(…, Pageable)`
(the window) finders, both `ConversationIdAndCreatedByAndDeletedFalse` (owner + soft-delete scoped).

## 4. Data model & API

### Backend tables (V0.2, ✅)

Migration `202607031400_mezo-fnnq.2_create_ai_conversation_message.sql` (registered in
`db/changelog/1.0.0/1.0.0_master.yml`):

- **`ai_conversation`** — `id uuid pk (gen_random_uuid())`, `created_by uuid fk→app_user(id) ON
  DELETE CASCADE`, `is_deleted`, `created_at timestamptz` (**= the conversation start; no separate
  `started_at` column** — Decision #3), `title varchar(120)` (null until the first user message),
  `last_message_at timestamptz`; index `idx_ai_conversation_created_by_last_message_at
  (created_by, last_message_at desc)`.
- **`ai_message`** — `id uuid pk`, `created_by uuid fk→app_user ON DELETE CASCADE`, `is_deleted`,
  `created_at`, `conversation_id uuid fk→ai_conversation ON DELETE CASCADE`, `role varchar(16)`
  (`ck_ai_message_role IN ('user','assistant')`), `content text`, `tool_calls jsonb`, `refs jsonb`
  (**both null in V0.2** — filled at V0.5); indexes `idx_ai_message_conversation_id_created_at`
  (history/window ordering key) + `idx_ai_message_created_by`.

### Entities

`AiConversationEntity` (`entity/AiConversationEntity.java`) and `AiMessageEntity`
(`entity/AiMessageEntity.java`) both `extends OwnedEntity`, UUID `@GeneratedValue` id, soft-delete.
`AiMessageEntity` holds `ROLE_USER`/`ROLE_ASSISTANT` constants (`:32-33`), a `@ManyToOne(LAZY)`
`conversation`, a `@Pattern("user|assistant")` `role`, and two typed jsonb envelopes via
`@JdbcTypeCode(SqlTypes.JSON)`: `toolCalls: ToolCallsEnvelope` (`{calls:[{type,name}]}`) and
`refs: RefsEnvelope` (`{refs:[{kind,id}]}`) — the ADR 0006 / `ProvenanceEnvelope` typed-jsonb
precedent. **Field names mirror the FE mock `Tool{type,name}` / `ChatRef{kind,id}`** so V0.5 wiring
is mechanical (Decision #5). Round-trip proven by `AiMessageJsonbRoundTripIT`.

### REST endpoints (contract-first — tag `Companion` → `CompanionApi`)

Fragment `api/feature/companion/companion.yml`; `CompanionController implements CompanionApi`.
Every non-2xx returns `SystemMessageList`. All paths are protected (401 without a token).

| Method + path | Returns | Status | Notes |
|---|---|---|---|
| `GET /api/companion/conversation` | `ConversationResponse[]` | 200 · 401 | Owner's conversations, most-recently-active first (`ConversationService.list`). |
| `POST /api/companion/conversation` | `ConversationResponse` | 201 · 401 | New empty conversation (`title` null; `startedAt` = `created_at`). `saveAndFlush` so `@CreationTimestamp` is populated before mapping. |
| `GET /api/companion/conversation/{id}/messages` | `MessageResponse[]` | 200 · 401 · 404 | Full history, oldest-first. 404 for missing **or foreign** (`getOwned`, no existence leak). |
| `POST /api/companion/conversation/{id}/message` | `MessageResponse` | 200 · 400 · 401 · 404 | The **sync** chat turn (V0.2, single transaction — LLM failure still rolls the whole turn back). |
| `POST /api/companion/conversation/{id}/message/stream` | SSE `delta*, (done\|error)` | 200 · 400 · 401 · 404 | The **streamed** turn (V0.4, tag `CompanionStream`, **hand-written** — §9 Decision 11). Two-transaction; `error` ⇒ no assistant row. Non-2xx are plain JSON before the stream starts. |

**Schemas:** `ConversationResponse {id, title?, startedAt, lastMessageAt?}`,
`MessageResponse {id, role, content, createdAt, tools[], refs[]}` (**filled since V0.5** on
tool-using turns; a tool-less turn's null envelope still maps to `[]`,
`CompanionMapper.toTools/toRefs`), `MessageTool {type, name}` (`type` = `read` in V0.5; `name`
carries the args baked in — `get_sleep(days=3)`), `MessageRef {kind, id}` (kinds: `Workout`,
`Sport`, `Run`, `WeightTrend`, `Sleep`, `FuelDay`, `Protocol`, `Goal`, `Medication`),
`SendMessageRequest {content}` (`minLength 1`, `maxLength 4000`),
`StreamDelta {text}` + `StreamError {code}` (V0.4 — the SSE per-event `data:` payloads; every
data line is JSON).

### The V0.5 tool catalog (all read-only, ownership-scoped, audited)

| Tool (args) | Source (existing reads) | Ref |
|---|---|---|
| `get_recent_workouts(days)` | `WorkoutSessionRepository.findDoneInstancesBetween` (new finder) + per-instance sets → date, dayLabel, set count, Σ volume kg | `Workout`/date (≤5) |
| `get_sport_sessions(days)` | sport + run since-date finders (existed) → sport/duration/intensity/RPE + run week/rounds | `Sport`+`Run`/date (≤3+3) |
| `get_weight_trend(weeks)` | `WeightTrendService.computeTrend` → trend kg, weekly + 4w rate, one EWMA point per ISO week | `WeightTrend`/`{w}h` |
| `get_recent_meals(days)` | `FuelDayService.getDay` looped per day → kcal/F vs targets, meal count + titles (≤3) | `FuelDay`/date (≤5) |
| `get_sleep(days)` | `SleepLogRepository` since-date finder (new) → duration, quality, awakenings | `Sleep`/date (≤5) |
| `get_protocol_adherence(days)` | `ProtocolService.getView().getActive()` + intake since-date finder (new) → per-day taken/expected + total % | `Protocol`/`v{n}` |
| `get_goal_progress()` | active goal + `computeTrend` + `GoalPrescriptionJson.currentSegment` → week N, start→target, actual vs plan rate, e heti recept | `Goal`/title |
| `get_reta_cycle()` | `MedicationCycleService.derive` + top-10 doses → cycle day, phase, last dose, next due | `Medication`/name |

### Config keys (`mezo.companion.*` — `CompanionProperties`, `@Validated`)

- `mezo.companion.chat.history-window` = **20** (`@Min(0) @Max(200)`) — how many prior
  user+assistant rows (≈10 turns) are windowed into the system prompt (Decision #1).
- `mezo.companion.chat.title-max-chars` = **80** (`@Min(10) @Max(120)`) — auto-title = first user
  message truncated to this many chars (DB column caps at 120; Decision #2).
- `mezo.companion.snapshot.digest-days` = **7** (`@Min(1) @Max(30)`) — how many days back the
  snapshot's train digest (gym/sport/run counts) looks, including today (V0.3).
- `mezo.companion.snapshot.checkin-note-max-chars` = **200** (`@Min(0) @Max(1000)`) — the latest
  check-in note is included verbatim, truncated to this many characters (V0.3).
- `mezo.companion.tools.max-calls-per-turn` = **6** (`@Min(1) @Max(20)`) — recorded tool calls per
  turn; past it every tool soft-fails with honest in-band text (V0.5).
- `mezo.companion.tools.max-window-days` = **30** (`@Min(1) @Max(60)`) — upper clamp for the
  `days` tool args (V0.5).
- `mezo.companion.tools.max-trend-weeks` = **26** (`@Min(1) @Max(52)`) — upper clamp for
  `get_weight_trend(weeks)` (V0.5).
- `mezo.companion.tools.max-refs-per-turn` = **10** (`@Min(1) @Max(30)`) — refs persisted per turn,
  deduped in insertion order (V0.5).
- `mezo.companion.llm.chat-model` = `gemini-2.5-flash` (every turn) / `smart-model` =
  `gemini-2.5-pro` (heavy pipelines, unused until V3.2) — model tiers are config, not code (ADR 0008).
- Feature switch `mezo.feature.companion.enabled` (`FeaturesConfiguration.COMPANION_SWITCH`).

## 5. Integrations

Companion is a **Phase-3 domain that reads from the others, never the reverse** (the roadmap's
coupling rule). Today only the platform seams are wired; the domain seams are named future work.

### 5.1 Companion ↔ Insights / ChatPage (✅ V0.5 wired, chips real)
The ChatPage is now the real FE surface. **Contract crossing the seam:**
`chatApi.toChatMessage` (`frontend/src/data/insights/chatApi.ts`) maps the wire
`MessageResponse {role, content, createdAt, tools[], refs[]}` → the FE
`ChatMessage {role, ts, text, tools?, refs?}` (`ts` = HU `HH:MM`; empty `tools`/`refs` become
`undefined` so user bubbles stay lean; the V0.2 shape alignment made this a cast, not a
transform). The hook layer is `data/insights/chatHooks.ts`: `useChat()` (a single `['chat']`
`useDualQuery` bootstrap — newest conversation + history; 404 → `degraded`; `mode: 'mock'|'live'`
keeps `isMockMode()` out of the feature layer) + `useChatActions()` (send/stream state machine —
optimistic `ChatTurn {userText, draft, thinking}` overlay, `done` appended into the query cache).
**Since V0.5 the chips are real**: the wire `tools[]` (`{type:'read', name:'get_sleep(days=3)'}`)
render as `ToolChip`s and `refs[]` as `RefTag`s on history AND streamed turns — the FE needed
zero code changes (the pass-through was built at V0.4); chips appear when the terminal `done`
lands (the in-flight draft bubble stays chip-less by design — chips describe the persisted truth).

### 5.2 Companion ↔ Auth & ownership (wired)
Every companion write/read rides the auth spine ([`_platform-auth-security.md`](_platform-auth-security.md)
§5): `CompanionController` injects `CurrentUserId` and passes `.get()` into the services;
`ai_conversation`/`ai_message` `created_by` is stamped server-side and every finder is
`…AndCreatedByAndDeletedFalse` scoped. **Contract crossing the seam:** `CurrentUserId.get()` (UUID
from JWT subject) → `OwnedEntity.createdBy`; the boundary DTOs never carry `created_by`.

### 5.3 Companion ↔ LLM provider (wired, ADR 0008)
All model access goes through the `CompanionLlm` port (`CompanionLlm.java`). **Contract crossing
the seam:** `complete(systemPrompt, userMessage) → String` (V0.2 uses only `complete`; `stream(…) →
Flux<String>` exists for V0.4). Real adapter `GeminiCompanionLlm` / test fake `FakeCompanionLlm`;
provider swap = one new adapter + one starter swap (ADR 0008).

### 5.4 Companion ↔ API contract & backend platform (wired)
Companion is now a backed feature on the contract-first pipeline
([`_platform-api-backend.md`](_platform-api-backend.md) §3–§4): `companion.yml` → merged
`api/openapi.yml` → generated `CompanionApi` + DTOs (backend) and `api.gen.ts` types (FE). Drift =
compile error.

### 5.5 Companion ← other features (✅ V0.3 wired — read-only)
**`ContextSnapshotAssembler` is live**: companion now injects reads from **six** other features —
`biometrics` (`BiometricProfileRepository`, `WeightTrendService`, `SleepLogRepository`,
`CheckInRepository`), `goal` (`GoalRepository` + the prescription jsonb), `train`
(`MesocycleRepository`, `GymScheduleService`, `SportService`, `WorkoutSessionRepository.findDoneInstanceDates`,
`SportSessionRepository`/`RunSessionLogRepository` since-date finders), `meal` (`FuelDayService`),
`fuel` (`ProtocolService`, `IntakeService`) and `medication` (`MedicationRepository`,
`MedicationCycleService`). **Contract crossing the seam:** `render(UUID userId, LocalDate today) →
String` — the callee services' read methods with explicit `userId` scoping; strictly one-way
(no feature may import companion; the frozen ArchUnit cycle rule fails the build otherwise).
V0.3 also added four derived finders to those features' repos (sleep/check-in latest, sport/run
since-date) — plain finders, no companion dependency.

**V0.5 tools seam (✅ wired).** The 8 read tools in `feature/companion/tools/` compose the same
one-way reads (see §4 catalog). V0.5 added **three plain finders** to the owning features' repos
(the V0.3 precedent — no companion dependency): `SleepLogRepository` since-date,
`WorkoutSessionRepository.findDoneInstancesBetween` (entities variant of `findDoneInstanceDates`,
same ≥1-logged-set semantics), `SupplementIntakeRepository` since-date — plus the static
`GoalPrescriptionJson.currentSegment` helper extracted from the snapshot assembler (both now
share it). Guard rails: tools call ONLY read methods (`GoalEngineService.evaluate` is a WRITE and
is deliberately not wrapped); the IDENT-2 ArchUnit rule bans HTTP/mail client deps in the tools
package.

**Named future seams:**
- **V1.1 knowledge facts** injected into the prompt; **V2.3** `find_similar_past_days` joins the
  tool registry; **V2.x** RAG over daily summaries; **V3.x** pattern engine — see the roadmap
  dependency graph.

## 6. How to use it (consume)

**From the FE:** import `useChat` / `useChatActions` from `@/data/hooks` (implementations in
`data/insights/chatHooks.ts`); the ChatPage is the reference consumer. For a keyless local e2e
run the backend with the fake adapter — the echo streams through the whole SSE path:
`./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata,companion-fake`.

**Over HTTP** (bearer token from `POST /api/auth/login`; the backend must run with `demodata` so
the owner exists, and `mezo.feature.companion.enabled=true` — the default):

```bash
TOKEN=... # from POST /api/auth/login
BASE=http://localhost:8090/api/companion

# 1) start a conversation (title null until the first message)
CID=$(curl -s -X POST $BASE/conversation -H "Authorization: Bearer $TOKEN" | jq -r .id)

# 2) send a message → the persisted assistant answer (sync JSON)
curl -s -X POST $BASE/conversation/$CID/message \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"content":"mi a mai terv?"}'
# → { "id":…, "role":"assistant", "content":"…", "createdAt":…, "tools":[], "refs":[] }

# 3) full history, oldest first
curl -s $BASE/conversation/$CID/messages -H "Authorization: Bearer $TOKEN"

# 4) list conversations, most-recently-active first (title = truncated first user message)
curl -s $BASE/conversation -H "Authorization: Bearer $TOKEN"

# 5) STREAMED turn (V0.4) — -N disables buffering; note the dual Accept
curl -sN -X POST $BASE/conversation/$CID/message/stream \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -H 'Accept: text/event-stream, application/json' \
  -d '{"content":"mi a mai terv?"}'
# → event:delta \n data:{"text":"..."}   (0..n times)
# → event:done  \n data:{ ...persisted assistant MessageResponse... }
```

Note: `tools`/`refs` fill up when the turn used tools (V0.5) — with the fake adapter you can
force it deterministically: `{"content":"aludtam eleget? [fake-tool:get_sleep {\"days\":3}]"}`.
The first `message` sets the conversation `title` + `lastMessageAt`, and an empty `content`
returns a 400 field error (`VALIDATION_INVALID_VALUE`).

## 7. How to extend it

Follow the per-slice checklist in the roadmap
([`companion-roadmap.md`](../superpowers/plans/2026-07-03-companion-roadmap.md) §"Per-slice
execution checklist"). The house recipe, **contract-first**:

1. **Contract** — edit `api/feature/companion/companion.yml`, merge (`cd api/generate && npm run
   generate:api`), regen FE (`cd frontend && pnpm generate:api`) + BE types
   ([`api_contract_conventions.md`](../references/api_contract_conventions.md)).
2. **Backend** — entity/repo/service/controller per
   [`java_package_structure.md`](../references/java_package_structure.md) +
   [`spring_patterns.md`](../references/spring_patterns.md); **gate every new companion bean on
   `@ConditionalOnProperty(COMPANION_SWITCH)`** (see §9). Migration per
   [`liquibase_conventions.md`](../references/liquibase_conventions.md) (`{ts}_{bd-id}_{desc}.sql`,
   named constraints, entity↔DDL sync); add the new table to `ResetDatabase` TRUNCATE + a populator.
3. **Tests** — integration-first, LLM/embedding **always** behind the port with the profile-gated
   fake ([`testing_standards.md`](../references/testing_standards.md) +
   [`integration_test_framework.md`](../references/integration_test_framework.md)).
4. **Config** — tunables under `mezo.companion.*` on `CompanionProperties`, never `@Value`
   ([`configuration_conventions.md`](../references/configuration_conventions.md)).

**Where the next slices plug in:**
- **V1.1 (facts)** — knowledge facts injected into the prompt between the snapshot and the
  history block.
- **New tool?** — add a `@Tool` method to the matching domain toolset (or a new one), wire it
  into `CompanionToolRegistry.callbacks(...)`, keep it read-only + `ToolContexts.userId`-scoped,
  add its render test to `CompanionToolsRenderIT` and the registry-batch assert in
  `CompanionToolRegistryIT`. The decorator gives audit/budget/error-shielding for free.

## 8. Testing

Backend integration-first (compose Postgres up: `cd backend && docker compose up -d`), run with
`./mvnw clean test` (ALWAYS `clean` — Lombok+MapStruct incremental compile is flaky). The LLM in
tests is **always** `FakeCompanionLlm` — network never touched.

**The `companion-fake` profile trick.** `@ActiveProfiles("companion-fake")` **merges** with the
base test profiles (`AbstractIntegrationTest`/`ApiIntegrationTest` run `demodata`), so the fake
adapter replaces Gemini while everything else stays real. `FakeCompanionLlm.complete` **echoes
both prompt halves** (`"FAKE-LLM system=[…] user=[…]"`, `FakeCompanionLlm.java:24`), which makes
**prompt assembly assertable** — `ChatServiceIT` asserts the persisted answer contains the
companion voice (`"Te vagy a mezo"`, `"retatrutid"`), the windowed history block
(`"Daniel: …"`/`"Mezo: …"`), and that the current message rides as the `user=[…]` param, not the
history.

**`ContextSnapshotAssemblerIT` (V0.3, 10 tests)** — the snapshot is fully assertable without any
LLM: empty-user render (all six blocks in order, every absence an explicit `nincs adat`, config
targets still render), profile+trend, current-week segment + planner selection, train digest +
schedules, digest-window exclusion, FuelDay/protocol/intakes, retaDay+phase (`4. nap (Stabil)`),
sleep+check-in, note truncation at 200 chars, and determinism (two renders are `equals`).
`ChatServiceIT` gained `testSendMessage_shouldInjectContextSnapshotBetweenVoiceAndHistory…` —
the fake's echo proves voice → `AKTUÁLIS ÁLLAPOT` → history ordering in the real prompt.

The 5 V0.2 IT classes (`backend/src/test/…/feature/companion/`):

- **`AiMessageJsonbRoundTripIT`** — the typed jsonb envelopes survive a real DB round-trip (and stay
  `null`/`jsonb_typeof = object` when set); ADR 0006 pattern.
- **`ConversationServiceIT`** — create (empty, null title), list ordered by activity desc, cross-user
  isolation, chronological messages, 404 on a foreign conversation.
- **`ChatServiceIT`** — persistence (user+assistant rows, envelopes null) + prompt assembly (voice,
  history windowing, window cap at 20, title truncation to 80, keep-title on 2nd message, 404 on
  foreign) against the fake.
- **`CompanionApiIT`** — the HTTP flow end-to-end (`@ActiveProfiles("companion-fake")`): 401 without
  a token, 201 create, the send→persist→list round-trip, 400 on empty content, 404 on an unknown id.
- **`CompanionApiSwitchOffIT`** — `mezo.feature.companion.enabled=false` ⇒ `/api/companion/*` 404s
  (`RESOURCE_NOT_FOUND`) — the whole surface is gone (bean-boundary gating).

**V0.4 test additions:**

- **`ChatStreamServiceIT`** (3 tests, deliberately NOT `@Transactional` — it observes the real
  two-transaction turn): deltas join to the full answer + terminal `done` carries the persisted
  row + title/lastMessageAt touched; forced stream failure (`FakeCompanionLlm.FAIL_STREAM`
  sentinel in the content) ⇒ `error` event, **only** the user row persisted; foreign
  conversation throws 404 before any streaming.
- **`CompanionStreamApiIT`** (5 tests, HTTP-level): 401 / 404-as-JSON / 400 field error (the
  hand-written `@Valid` works), raw-SSE happy path (`event:delta`/`event:done` + persistence +
  title), error event without an assistant row. TestRestTemplate buffers the finite fake stream,
  so the SSE body is a plain assertable String.
- **`CompanionApiSwitchOffIT`** gained the stream-path 404 (the hand-written controller is
  switch-gated the same way).
- **FE:** `api.sse.test.ts` (the `apiSse` parser: named events, chunk-split/CRLF reassembly,
  ApiError on non-OK, Accept header), `chatApi.test.ts` (wire→`ChatMessage` mapping),
  `chatHooks.test.tsx` (mock seed; real bootstrap/empty/degraded; a streamed turn lands in the
  query cache), `ChatPage.test.tsx` (both modes: seeded demo + fake-timer canned reply / real
  history + streamed reply + degraded banner). MSW companion handlers
  (`src/test/msw/handlers.ts`) mirror `initialChat` and reuse `cannedReply`, so both modes
  assert the same strings; the stream handler answers with a real `ReadableStream` SSE body.

**V0.5 test additions:**

- **`CompanionToolsRenderIT`** (14 tests, `@Transactional` + fake profile) — every tool's rendered
  Hungarian text + contributed refs against populator-seeded data, LLM-free (tools called directly
  with a hand-built `ToolContext`): happy paths, `nincs adat`/`nincs aktív …` absences, window
  clamping (`getSleep(90)` → 30), volume math, adherence counting, honest-zero reta.
- **`CompanionToolRegistryIT`** — exactly the 8-tool batch registered, every callback wrapped in
  `RecordingToolCallback`; the tool-context carries `userId` + audit.
- **`ToolCallAuditTest` + `RecordingToolCallbackTest`** (pure units) — null envelopes when empty,
  `read` typing, budget exhaustion (soft-fail, not recorded), ref dedupe/cap, error-to-honest-text,
  `compactArgs` flattening (`{"days":7}` → `days=7`).
- **Extended ITs:** `ChatServiceIT` (scripted `[fake-tool:…]` turn → envelope persisted + wire
  chips `get_sleep(days=3)`/`read` + refs; tool-less turn keeps null envelopes; 7 sentinels →
  cap at 6 + budget text in the answer; the system prompt carries the tool-usage line),
  `ChatStreamServiceIT` (the `done` event carries chips + the row's envelope),
  `CompanionStreamApiIT` (raw SSE body contains the chip JSON), `CompanionLlmFakeIT` (sentinel
  execution, streamed tool chunk, UNKNOWN echo), `CompanionPropertiesIT` (`tools.*` bindings),
  `AiMessageJsonbRoundTripIT` (3-field `ToolCall{type,name,args}` round-trip),
  `ArchitectureTest` (`companion_tools_are_internal_sphere_only`).

Carried over from V0.1 (`mezo-fnnq.1`): `CompanionLlmFakeIT` (fake picked + echoes/streams),
`CompanionRealWiringIT` (Gemini adapter picked when the fake profile is absent), `CompanionSwitchOffIT`
(**no `CompanionLlm` bean when the switch is off** — `ObjectProvider.getIfAvailable() == null`),
`CompanionPropertiesIT` (llm tiers + the V0.2 `chat.*` window/title bindings).

## 9. Decisions, gotchas & deferred

**Plan decisions (locked in the V0.2 plan §"Decisions locked"):**

1. **Window = config, in messages not turns.** `mezo.companion.chat.history-window` = 20 (≈10
   turns); `title-max-chars` = 80. Tunable, `@Validated`, never `@Value`.
2. **Auto-titling deferred.** `title` = first user message truncated to `title-max-chars`, **set
   once, never regenerated** (`ChatService.touchConversation`, `ChatService.java:97`).
3. **No `started_at` column.** `OwnedEntity.created_at` is the conversation start; the contract's
   `startedAt` maps from it (`CompanionMapper.toConversationResponse`). A duplicate column would
   only drift — the spec §3 field list is "essence", not DDL.
4. **History windowing lives in the system prompt** (a rendered `Daniel:`/`Mezo:` transcript), so
   the `CompanionLlm` port keeps the two-string prompt shape. (The predicted message-list variant
   never materialized — V0.5 carries tools alongside the two strings instead; Decision 16.)
5. **Typed jsonb envelope shapes, always null in V0.2.** `ToolCallsEnvelope{calls:[{type,name}]}`,
   `RefsEnvelope{refs:[{kind,id}]}` — field names mirror the FE mock `Tool{type,name}` /
   `ChatRef{kind,id}` so V0.4/V0.5 wiring is mechanical (ADR 0006 / `ProvenanceEnvelope`
   precedent). (V0.5 extended `ToolCall` with `args` — Decision 18.)

**V0.3 decisions (locked in the V0.3 plan §"Decisions locked"):**

6. **`ContextSnapshotAssembler` keeps the design-of-record name** (not `*Service`) — it is the
   name the spec/roadmap/living doc all use; still a switch-gated `@Service` in `service/`.
7. **`render(userId, today)` takes the date as a parameter** — deterministic and boundary-testable;
   `ChatService` passes `LocalDate.now()` (codebase convention, no `Clock` bean).
8. **Weeks are DERIVED, not read** — goal week from `goal.startDate`, meso week from
   `meso.startDate` clamped to `[1, weeks]` (the stored `currentWeek` can lag).
9. **No fabricated trend**: empty weigh-in series → `súlytrend: nincs adat`; rates omitted while
   `dataSufficiency = NONE` (`WeightTrendService.empty()` returns zeros, not nulls — rendering
   them would violate spec §6).
10. **Budget by construction, no hard truncation** — the block is bounded by `digest-days` and
    one-line-per-block rendering (~0.5–1k token, well under the 2–4k spec budget).

**V0.3 gotcha:** the assembler runs inside EVERY chat turn (`ChatService.sendMessage` is one
transaction) — its reads are cheap single-row/short-list lookups by design; anything heavier
(full-history scans) belongs behind a V0.5 tool, not in the snapshot.

**V0.4 decisions (locked in the V0.4 plan §"Decisions locked"):**

11. **SSE-in-contract-first precedent.** The stream operation IS in `companion.yml` (single
    source of truth; `StreamDelta`/`StreamError` generate both FE types and backend DTOs) under
    its **own tag `CompanionStream`**, whose generated `CompanionStreamApi` interface is
    **deliberately unimplemented** (an interface that is no bean contributes no mappings — inert).
    The controller is hand-written because the generator cannot express
    `Flux<ServerSentEvent<?>>`; both ArchUnit guards carry a documented allowlist entry
    (`HAND_WRITTEN_CONTROLLER_ALLOWLIST`). Full write-up:
    [`_platform-api-backend.md`](_platform-api-backend.md) §9.
12. **Event protocol:** named events `delta` → (`done` | `error`), every `data:` line JSON —
    raw token text would fight SSE's multi-line framing.
13. **Two-transaction streamed turn, honest history.** `prepareTurn` (TX #1, user row) → stream
    (no TX) → `completeTurn` (TX #2, assistant row). Mid-stream failure ⇒ user row stays,
    assistant row never written, partial answers never persisted. The **sync** endpoint keeps
    its V0.2 single-transaction semantics (LLM failure still rolls back the whole turn) — the
    two paths share `ChatService`'s private helpers but not their transaction shape.
14. **FE transport = fetch + ReadableStream** (`apiSse` in `data/_client/api.ts`) — EventSource
    can neither POST nor send `Authorization`. Dual `Accept: text/event-stream, application/json`
    so pre-stream errors stay ordinary `ApiError`s.
15. **Degraded chat = the progression 404→ghost pattern** (`degraded: true` on the bootstrap,
    IDENT-3 honest banner + disabled composer), and the ChatPage header is honest per mode
    (`demo beszélgetés` / `Gemini · élő` / `a társ most nem elérhető`) — the fake facts-count
    line died with V0.4.

**V0.5 decisions (locked in the V0.5 plan §"Decisions locked"):**

16. **Port keeps two strings + tools; NO message-list variant.** V0.2 Decision #4 predicted tool
    calling would force a message-list port — it doesn't (Spring AI runs the tool-execution loop
    inside the adapter). `complete/stream(system, user, List<ToolCallback>, Map toolContext)` with
    `default` two-arg overloads. `ToolCallback`/`ToolContext` are spring-ai-core types shared by
    every provider starter — not provider types, so ADR 0008's isolation holds.
17. **Audit = decorator, refs = explicit, identity = context.** `RecordingToolCallback` records
    every call (unbypassable) + enforces the cap (soft-fail text in-band, attempt not recorded) +
    shields tool exceptions (honest error result); tools add their own refs via the audit in the
    `ToolContext`; `userId` comes ONLY from the tool context, never model args.
18. **Envelope grows `args`; wire stays `{type,name}`.** `ToolCall{type,name,args}` (args =
    compact display form, `days=7` — full fidelity for flat scalar V0.5 args; pre-V0.5 rows
    deserialize `args = null`); the mapper renders `name(args)` — the mock-seed chip style; `type`
    is always `read` in V0.5. No migration (columns existed since V0.2; null-when-empty preserved).
19. **Tool results are snapshot-idiom text**, windows clamped by `mezo.companion.tools.*` — token
    budget by construction. `get_sport_sessions` covers sport + run; `get_protocol_adherence`
    measures against the CURRENT active protocol for the whole window (version time-travel is
    v1+ material); `get_goal_progress` is a pure read composition (the engine's `evaluate` is a
    write and stays out of the registry).
20. **The fake scripts tools via content sentinels** — `[fake-tool:name {json}]` executes the
    REAL wrapped callback (audit/budget/refs included), so the whole pipeline is IT-covered with
    zero LLM. Spring AI's result converter JSON-encodes a tool's String return — the fake's echo
    shows `tool:name=["…"]` (quoted).

**Gotchas:**

- **The `CompanionLlm` bean is ABSENT when the switch is off** — it is
  `@ConditionalOnProperty(COMPANION_SWITCH)`. **Never inject `CompanionLlm` (or any companion bean)
  into an ungated bean**, or the context fails to start with the switch off. Anything that needs the
  port must itself be switch-gated; `CompanionSwitchOffIT` guards this (`getIfAvailable() == null`).
- **Switch off ⇒ 404, not 401/500.** With no controller bean there is no route, so the whole
  `/api/companion/*` surface 404s cleanly (`CompanionApiSwitchOffIT`).
- **Two rows per turn need distinct `created_at`.** `ChatService.persistMessage` uses
  `saveAndFlush` so the user and assistant rows of one turn get separate timestamps — the history
  ordering key (`idx_ai_message_conversation_id_created_at`) depends on it.
- **The Gemini `ChatModel` is autoconfigured regardless of the mezo switch** — the dummy
  `GEMINI_API_KEY` default is what keeps every context bootable key-less (ADR 0008). Keep it.
- **`companion-fake` merges, not replaces.** `@ActiveProfiles("companion-fake")` adds to the base
  `demodata` profile — don't expect it to strip other profiles.
- **`FakeCompanionLlm` failure sentinels (V0.4):** a test message containing `[fake-fail]`
  (`FAIL_COMPLETE`) makes `complete()` throw; `[fake-stream-fail]` (`FAIL_STREAM`) makes
  `stream()` emit one chunk then error — deterministic error-path ITs. The fake constructs a
  raw `IllegalStateException` ON PURPOSE (it simulates an arbitrary provider exception) and is
  allowlisted in the ArchUnit raw-exception rule.
- **`streamMessage` returns the Flux only after `prepareTurn` ran** — ownership/validation
  errors become normal JSON HTTP errors, never SSE frames. Keep any new pre-stream check
  BEFORE the Flux is built.
- **`ChatClient.toolCallbacks(...)` is deprecated in Spring AI 2.0** — the unified registration
  API is `tools(Object...)` (accepts `ToolCallback`s and `@Tool` objects alike);
  `GeminiCompanionLlm.request` uses it.
- **A chip appears even when the tool found no data** — the CALL is the audited fact
  (`get_sleep(days=3)` with a `nincs adat` result is an honest chip); refs only exist when data
  backed the answer.
- **Streamed tool turns run the tool reads OUTSIDE a transaction** (between TX #1 and TX #2) —
  every tool read is a self-contained repo/service call (`FuelDayService.getDay` carries its own
  `@Transactional(readOnly = true)`); don't add a lazy-walking read to a tool without one.

**Deferred (with bd ids):**
- **Deployed Gemini secret** — set a real `GEMINI_API_KEY` in the `mezo-app` secret, then drop
  `MEZO_FEATURE_COMPANION_ENABLED=false` from `k8s/backend/deployment.yaml` (the V0.2-review
  prerequisite; until then the deployed chat is the honest degraded state). The v0 exit criterion
  ("mit egyek ma edzés előtt?" on the phone, grounded + chip-annotated) needs this to be provable
  end-to-end on the real model — the real-API tool smoke is part of that rollout.
- **V1.x facts · V2.x RAG (pgvector) · V3.x patterns** — see the roadmap; `find_similar_past_days`
  joins the registry at V2.3 (`mezo-fnnq.11`).

## 10. Key files

**API contract**
- `api/feature/companion/companion.yml` — 4 endpoints + 5 schemas (tag `Companion` → `CompanionApi`);
  registered in `api/generate/merge.yml` → merged `api/openapi.yml` → `api.gen.ts` + `io.mrkuhne.mezo.api.*`.

**Backend — controllers / services / mapper**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/CompanionController.java` — `implements CompanionApi`, JWT ownership, switch-gated.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/CompanionStreamController.java` — the V0.4 **hand-written** SSE endpoint (§9 Decision 11).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ConversationService.java` — list/create/listMessages/`getOwned` (404).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java` — `SYSTEM_PROMPT` + snapshot + windowed prompt assembly + sync turn + the V0.4 `prepareTurn`/`completeTurn` halves.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatStreamService.java` — the V0.4 streamed turn (`delta`/`done`/`error` Flux over the port).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ContextSnapshotAssembler.java` — the V0.3 cross-feature "today" block (6 HU blocks, `nincs adat` absences).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/mapper/CompanionMapper.java` — entity → generated `api.dto` (null envelope → `[]`).

**Backend — LLM port (ADR 0008)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/CompanionLlm.java` — the port (`complete` + `stream`, tools variants since V0.5).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlm.java` — real adapter (`!companion-fake`); `tools(Object...)` + `toolContext` registration.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` — deterministic fake (`companion-fake`); `[fake-tool:…]` sentinel execution since V0.5.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/CompanionHelloRunner.java` — `companion-smoke` real-API round-trip proof.

**Backend — tools (V0.5)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/CompanionToolRegistry.java` — the ONLY assembly point (wraps + tool-context).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/{TrainTools,BiometricsTools,FuelTools,GoalTools,MedicationTools}.java` — the 8 `@Tool` reads.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/{ToolCallAudit,RecordingToolCallback,ToolContexts,ToolText}.java` — audit/budget/context/render spine.
- New plain finders in the owning features: `SleepLogRepository` (since-date), `WorkoutSessionRepository.findDoneInstancesBetween`, `SupplementIntakeRepository` (since-date); shared `GoalPrescriptionJson.currentSegment`.

**Backend — entities / repos / config**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/{AiConversationEntity,AiMessageEntity,ToolCallsEnvelope,RefsEnvelope}.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/{AiConversationRepository,AiMessageRepository}.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java` — `Llm` + `Chat` records.
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `COMPANION_SWITCH`.
- `backend/src/main/resources/application.yml` — `mezo.feature.companion.enabled` + `mezo.companion.llm.*`/`chat.*` + `spring.ai.google.genai.api-key`.

**Backend — migration**
- `backend/src/main/resources/db/changelog/1.0.0/script/202607031400_mezo-fnnq.2_create_ai_conversation_message.sql` (in `1.0.0_master.yml`).

**Backend — tests**
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/{AiMessageJsonbRoundTripIT,ConversationServiceIT,ChatServiceIT,ChatStreamServiceIT,CompanionApiIT,CompanionStreamApiIT,CompanionApiSwitchOffIT,CompanionLlmFakeIT,CompanionRealWiringIT,CompanionSwitchOffIT,CompanionPropertiesIT}.java`
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/{CompanionToolsRenderIT,CompanionToolRegistryIT,ToolCallAuditTest,RecordingToolCallbackTest}.java` — the V0.5 tool batch.
- `backend/src/test/java/io/mrkuhne/mezo/support/populator/{AiConversationPopulator,AiMessagePopulator}.java` + `support/ResetDatabase.java` (`ai_message`/`ai_conversation` TRUNCATE).
- `backend/src/test/java/io/mrkuhne/mezo/ArchitectureTest.java` — the two documented V0.4 allowlist entries (hand-written controller + fake-LLM raw exception) + the V0.5 `companion_tools_are_internal_sphere_only` rule.

**Frontend (real since V0.4)**
- `frontend/src/data/_client/api.ts` — `apiSse` (fetch-ReadableStream SSE reader) + its `api.sse.test.ts`.
- `frontend/src/data/insights/chatApi.ts` — REST + stream client, `toChatMessage` wire mapper.
- `frontend/src/data/insights/chatHooks.ts` — `useChat` (bootstrap dual-read) + `useChatActions` (send/stream state machine); re-exported from `data/hooks.ts`.
- `frontend/src/data/insights/chat.ts` — the mock seed (`initialChat`) + the shared `cannedReply`.
- `frontend/src/features/insights/pages/ChatPage.tsx` — the real dual-mode surface ([`insights.md`](insights.md) §2.5).
- `frontend/src/test/msw/handlers.ts` — companion fixtures + the SSE stream handler.
- `k8s/backend/deployment.yaml` — `MEZO_FEATURE_COMPANION_ENABLED=false` until the Gemini secret lands.

**Docs (link, don't duplicate)**
- Design spec: [`docs/superpowers/specs/2026-07-03-phase3-companion-chat-design.md`](../superpowers/specs/2026-07-03-phase3-companion-chat-design.md)
- Roadmap (14 slices): [`docs/superpowers/plans/2026-07-03-companion-roadmap.md`](../superpowers/plans/2026-07-03-companion-roadmap.md)
- V0.2 plan: [`docs/superpowers/plans/2026-07-03-companion-v02-conversations.md`](../superpowers/plans/2026-07-03-companion-v02-conversations.md)
- V0.4 plan: [`docs/superpowers/plans/2026-07-03-companion-v04-sse-fe-chat.md`](../superpowers/plans/2026-07-03-companion-v04-sse-fe-chat.md)
- V0.5 plan: [`docs/superpowers/plans/2026-07-03-companion-v05-tools.md`](../superpowers/plans/2026-07-03-companion-v05-tools.md)
- ADR: [`docs/decisions/0008-companion-llm-spring-ai-2-gemini.md`](../decisions/0008-companion-llm-spring-ai-2-gemini.md)
- Roadmap/milestone log: [`docs/milestones/roadmap.md`](../milestones/roadmap.md)
- References: [`docs/references/`](../references/) (`api_contract_conventions`, `liquibase_conventions`, `spring_patterns`, `testing_standards`, `integration_test_framework`, `configuration_conventions`, `java_package_structure`, `error_handling`)
