---
title: Companion (AI chat brain)
type: feature-domain
status: mixed
updated: 2026-07-03
tags: [companion, ai, chat, llm, backend, phase-3]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion
  - api/feature/companion/companion.yml
  - backend/src/main/resources/db/changelog/1.0.0/script/202607031400_mezo-fnnq.2_create_ai_conversation_message.sql
  - docs/decisions/0008-companion-llm-spring-ai-2-gemini.md
related: [insights, _platform-api-backend, _platform-auth-security]
---

# Companion (AI chat brain) — Feature Documentation

> One-line: the Phase-3 AI companion backend — persisted conversations + a sync Hungarian
> chat endpoint over the `CompanionLlm` port (Spring AI 2 / Gemini), with a deterministic
> cross-feature **context snapshot** injected into every system prompt. **Status: backend ✅
> V0.3 (spine + snapshot); FE 🔶 mock (ChatPage is still the simulated `insights` surface until
> V0.4).** Cross-cutting Phase-3 domain with no route/tab of its own yet — the user reaches
> "chat" only through the mock Insights ChatPage ([`insights.md`](insights.md) §2.5).

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

**Status per layer:**

| Layer | State | Notes |
|---|---|---|
| Backend (tables + contract + services + sync endpoint) | ✅ V0.2 | Behind `mezo.feature.companion.enabled`; switch off ⇒ the whole HTTP surface 404s. |
| Context snapshot | ✅ V0.3 | `ContextSnapshotAssembler` in every chat turn's system prompt; LLM-free, `nincs adat` absences, `mezo.companion.snapshot.*` windows. |
| LLM adapter | ✅ V0.1 (ADR 0008) | Real `GeminiCompanionLlm` (`gemini-2.5-flash`) / deterministic `FakeCompanionLlm` (`companion-fake` profile). |
| Streaming (SSE) | ❌ deferred → V0.4 | V0.2 answers are **sync JSON** (`POST .../message` returns the persisted assistant message). |
| Frontend | 🔶 mock | ChatPage under Insights is still fully simulated (`insights.md` §2.5); no `useChat` real hook, no network. Wires up at V0.4. |
| Facts / RAG / patterns | ❌ deferred | V1.x (facts), V2.x (RAG), V3.x (patterns). |

**Driver:** `mezo-fnnq.2` (spine) + `mezo-fnnq.3` (snapshot). **Design of record:**
[`docs/superpowers/specs/2026-07-03-phase3-companion-chat-design.md`](../superpowers/specs/2026-07-03-phase3-companion-chat-design.md)
(§3 data model, §4 snapshot, §6 guardrails); slice map
[`docs/superpowers/plans/2026-07-03-companion-roadmap.md`](../superpowers/plans/2026-07-03-companion-roadmap.md)
§V0.2–V0.3; implementation plans
[`2026-07-03-companion-v02-conversations.md`](../superpowers/plans/2026-07-03-companion-v02-conversations.md) +
[`2026-07-03-companion-v03-context-snapshot.md`](../superpowers/plans/2026-07-03-companion-v03-context-snapshot.md);
provider/port ADR
[`0008-companion-llm-spring-ai-2-gemini.md`](../decisions/0008-companion-llm-spring-ai-2-gemini.md).

## 2. User-facing behavior

**None yet.** V0.2 is a pure backend slice — the frontend is untouched. The only "chat" a user
can see is the **simulated ChatPage** under Insights (`/insights/chat`), documented in
[`insights.md`](insights.md) §2.5: it seeds from `initialChat` into local `useState`, fakes the
send flow with a `setTimeout(…, 1200)` canned reply that branches on the word `"fáradt"`, shows a
hard-coded `"23 facts active · Gemini 3.1 Pro"` header string, and never touches the network or a
real LLM. The V0.2 endpoints are reachable only by an authenticated HTTP client (curl / tests —
see §6). The mock ChatPage becomes the **real, streamed** surface at **V0.4** (`mezo-fnnq.4`),
which is when this section starts describing actual behavior.

## 3. Architecture & data flow

The path truncates at the backend today (no FE consumer). The full V0.2 flow:

```
POST /api/companion/conversation/{id}/message   (sync JSON)
  → CompanionController.sendMessage            controller/CompanionController.java:42  (implements CompanionApi)
      currentUserId.get()  (JWT subject → UUID; techcore/security/CurrentUserId)
  → ChatService.sendMessage(userId, id, req)   service/ChatService.java:52
      1. conversationService.getOwned(userId, id)          → 404 RESOURCE_NOT_FOUND if missing/foreign
      2. systemPrompt = SYSTEM_PROMPT                                               :57
                      + contextSnapshotAssembler.render(userId, LocalDate.now())    ── V0.3 ──
                      + renderHistory(loadWindow())  ("Daniel:"/"Mezo:" transcript)
      3. persist the USER row (saveAndFlush → distinct created_at)
      4. answer = companionLlm.complete(systemPrompt, req.content)                  ── PORT ──►
         (real: GeminiCompanionLlm → Gemini · tests: FakeCompanionLlm echoes both halves)
      5. persist the ASSISTANT row (tool_calls/refs left null)
      6. touchConversation → lastMessageAt = now; title = first user msg (once)
  → CompanionMapper.toMessageResponse(assistant)   mapper/CompanionMapper.java:30
      (null envelope → empty tools[]/refs[] on the wire)
```

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
orvosi döntés." + "számot vagy adatot kitalálni tilos", spec §6). The
`CompanionLlm` port keeps its V0.1 two-string shape (`complete(systemPrompt, userMessage)`) — a
message-list variant is V0.5's problem (Decision #4).

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
| `POST /api/companion/conversation/{id}/message` | `MessageResponse` | 200 · 400 · 401 · 404 | The **sync** chat turn (V0.2). 400 on empty/oversize `content`. |

**Schemas:** `ConversationResponse {id, title?, startedAt, lastMessageAt?}`,
`MessageResponse {id, role, content, createdAt, tools[], refs[]}` (`tools`/`refs` **always empty
until V0.5** — the null envelope maps to `[]`, `CompanionMapper.toTools/toRefs`),
`MessageTool {type, name}`, `MessageRef {kind, id}`,
`SendMessageRequest {content}` (`minLength 1`, `maxLength 4000`).

### Config keys (`mezo.companion.*` — `CompanionProperties`, `@Validated`)

- `mezo.companion.chat.history-window` = **20** (`@Min(0) @Max(200)`) — how many prior
  user+assistant rows (≈10 turns) are windowed into the system prompt (Decision #1).
- `mezo.companion.chat.title-max-chars` = **80** (`@Min(10) @Max(120)`) — auto-title = first user
  message truncated to this many chars (DB column caps at 120; Decision #2).
- `mezo.companion.snapshot.digest-days` = **7** (`@Min(1) @Max(30)`) — how many days back the
  snapshot's train digest (gym/sport/run counts) looks, including today (V0.3).
- `mezo.companion.snapshot.checkin-note-max-chars` = **200** (`@Min(0) @Max(1000)`) — the latest
  check-in note is included verbatim, truncated to this many characters (V0.3).
- `mezo.companion.llm.chat-model` = `gemini-2.5-flash` (every turn) / `smart-model` =
  `gemini-2.5-pro` (heavy pipelines, unused until V3.2) — model tiers are config, not code (ADR 0008).
- Feature switch `mezo.feature.companion.enabled` (`FeaturesConfiguration.COMPANION_SWITCH`).

## 5. Integrations

Companion is a **Phase-3 domain that reads from the others, never the reverse** (the roadmap's
coupling rule). Today only the platform seams are wired; the domain seams are named future work.

### 5.1 Companion ↔ Insights / ChatPage (🟣 V0.4 seam)
The mock ChatPage (`frontend/src/data/insights/chat.ts`, [`insights.md`](insights.md) §2.5) is the
FE surface companion will drive. **Contract crossing the seam:** the backend `MessageResponse`
`{role, content, createdAt, tools[], refs[]}` ↔ the FE `ChatMessage {role, ts, text, tools, refs}`.
The shapes were **deliberately aligned** (`MessageTool{type,name}` ↔ FE `Tool{type,name}`,
`MessageRef{kind,id}` ↔ FE `ChatRef{kind,id}`) so V0.4 (SSE + `useChat`/`useChatActions` dual-mode
hooks) and V0.5 (real tool-chips) are mechanical. Until V0.4 the FE keeps its seeded conversation
and this seam is inert.

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

**Named future seams:**
- **V0.5 tools** (`mezo-fnnq.5`): read-only wrappers (`get_weight_trend`, `get_recent_meals`, …)
  over the same services, ownership-scoped, logged into `ai_message.tool_calls`/`refs`.
- **V1.1 knowledge facts** injected into the prompt; **V2.x** RAG over daily summaries; **V3.x**
  pattern engine — see the roadmap dependency graph.

## 6. How to use it (consume)

There is **no FE hook yet** — the frontend still uses the mock ChatPage. Exercise the endpoints
with an authenticated HTTP client (bearer token from `POST /api/auth/login`; the backend must run
with `demodata` so the owner exists, and `mezo.feature.companion.enabled=true` — the default):

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
```

Note: `tools`/`refs` are `[]` in V0.2, the first `message` sets the conversation `title` +
`lastMessageAt`, and an empty `content` returns a 400 field error (`VALIDATION_INVALID_VALUE`).

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
- **V0.4 (streaming + FE)** — an SSE variant of `POST .../message` (`SseEmitter`/`Flux` over the
  port's `stream(…)`), the FE `useChat`/`useChatActions` dual-mode hooks in `data/insights/`, and
  ChatPage wired (send/stream-render/history). The SSE-in-contract-first precedent gets decided
  in-slice and recorded in `_platform-api-backend.md`.
- **V0.5 (tools)** — a tool registry over existing services; the `tool_calls`/`refs` envelopes
  (already typed, null today) start being written and map straight to the FE chips.

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

Carried over from V0.1 (`mezo-fnnq.1`): `CompanionLlmFakeIT` (fake picked + echoes/streams),
`CompanionRealWiringIT` (Gemini adapter picked when the fake profile is absent), `CompanionSwitchOffIT`
(**no `CompanionLlm` bean when the switch is off** — `ObjectProvider.getIfAvailable() == null`),
`CompanionPropertiesIT` (llm tiers + the V0.2 `chat.*` window/title bindings). FE tests: none yet
(no companion FE code until V0.4).

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
   the `CompanionLlm` port keeps its V0.1 two-string shape (`complete(system, user)`). A
   message-list port variant is V0.5's problem — tool calling forces it anyway.
5. **Typed jsonb envelope shapes, always null in V0.2.** `ToolCallsEnvelope{calls:[{type,name}]}`,
   `RefsEnvelope{refs:[{kind,id}]}` — field names mirror the FE mock `Tool{type,name}` /
   `ChatRef{kind,id}` so V0.4/V0.5 wiring is mechanical (ADR 0006 / `ProvenanceEnvelope` precedent).

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

**Deferred (with bd ids):**
- **V0.4 SSE streaming + FE ChatPage goes real** (`mezo-fnnq.4`) — the sync endpoint gets a stream
  sibling; `insights.md` §2.5 becomes real then.
- **V0.5 tool calling + tool-chips** (`mezo-fnnq.5`) — fills the `tool_calls`/`refs` envelopes.
- **V1.x facts · V2.x RAG (pgvector) · V3.x patterns** — see the roadmap.

## 10. Key files

**API contract**
- `api/feature/companion/companion.yml` — 4 endpoints + 5 schemas (tag `Companion` → `CompanionApi`);
  registered in `api/generate/merge.yml` → merged `api/openapi.yml` → `api.gen.ts` + `io.mrkuhne.mezo.api.*`.

**Backend — controller / services / mapper**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/CompanionController.java` — `implements CompanionApi`, JWT ownership, switch-gated.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ConversationService.java` — list/create/listMessages/`getOwned` (404).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java` — `SYSTEM_PROMPT` + snapshot + windowed prompt assembly + sync turn.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ContextSnapshotAssembler.java` — the V0.3 cross-feature "today" block (6 HU blocks, `nincs adat` absences).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/mapper/CompanionMapper.java` — entity → generated `api.dto` (null envelope → `[]`).

**Backend — LLM port (ADR 0008)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/CompanionLlm.java` — the port (`complete` + `stream`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlm.java` — real adapter (`!companion-fake`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` — deterministic fake (`companion-fake`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/CompanionHelloRunner.java` — `companion-smoke` real-API round-trip proof.

**Backend — entities / repos / config**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/{AiConversationEntity,AiMessageEntity,ToolCallsEnvelope,RefsEnvelope}.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/{AiConversationRepository,AiMessageRepository}.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java` — `Llm` + `Chat` records.
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `COMPANION_SWITCH`.
- `backend/src/main/resources/application.yml` — `mezo.feature.companion.enabled` + `mezo.companion.llm.*`/`chat.*` + `spring.ai.google.genai.api-key`.

**Backend — migration**
- `backend/src/main/resources/db/changelog/1.0.0/script/202607031400_mezo-fnnq.2_create_ai_conversation_message.sql` (in `1.0.0_master.yml`).

**Backend — tests**
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/{AiMessageJsonbRoundTripIT,ConversationServiceIT,ChatServiceIT,CompanionApiIT,CompanionApiSwitchOffIT,CompanionLlmFakeIT,CompanionRealWiringIT,CompanionSwitchOffIT,CompanionPropertiesIT}.java`
- `backend/src/test/java/io/mrkuhne/mezo/support/populator/{AiConversationPopulator,AiMessagePopulator}.java` + `support/ResetDatabase.java` (`ai_message`/`ai_conversation` TRUNCATE).

**Frontend (still mock — no companion code yet)**
- `frontend/src/data/insights/chat.ts` + `frontend/src/features/insights/pages/ChatPage.tsx` — the simulated ChatPage this backend will drive at V0.4 ([`insights.md`](insights.md) §2.5).

**Docs (link, don't duplicate)**
- Design spec: [`docs/superpowers/specs/2026-07-03-phase3-companion-chat-design.md`](../superpowers/specs/2026-07-03-phase3-companion-chat-design.md)
- Roadmap (14 slices): [`docs/superpowers/plans/2026-07-03-companion-roadmap.md`](../superpowers/plans/2026-07-03-companion-roadmap.md)
- V0.2 plan: [`docs/superpowers/plans/2026-07-03-companion-v02-conversations.md`](../superpowers/plans/2026-07-03-companion-v02-conversations.md)
- ADR: [`docs/decisions/0008-companion-llm-spring-ai-2-gemini.md`](../decisions/0008-companion-llm-spring-ai-2-gemini.md)
- Roadmap/milestone log: [`docs/milestones/roadmap.md`](../milestones/roadmap.md)
- References: [`docs/references/`](../references/) (`api_contract_conventions`, `liquibase_conventions`, `spring_patterns`, `testing_standards`, `integration_test_framework`, `configuration_conventions`, `java_package_structure`, `error_handling`)
