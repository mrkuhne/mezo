---
title: Companion (AI chat brain)
type: feature-domain
status: mixed
updated: 2026-07-06
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
> snapshot** + the **top-N confirmed knowledge facts** in every system prompt, **8 read-only
> tools** for history/aggregate questions (audited into the message envelopes, rendered as real
> FE chips), answered **sync JSON or streamed SSE**, and consumed by the **real dual-mode
> ChatPage**. After every turn an **async extraction** proposes fact candidates that Daniel
> confirms on the **real KnowledgeListPage** (accept/refine/reject — L2). **Status: backend ✅
> V2.1 (spine + snapshot + SSE + tools/audit + facts + extraction/decision + advisors +
> pgvector/EmbeddingPort infra + narrative-memory pipeline + episodic recall tool); FE ✅ V1.3
> (ChatPage + KnowledgeListPage real + degraded badge)
> — v0 „lát engem" + v1 „megjegyez" + **v2 „emlékszik" complete**.**
> Cross-cutting Phase-3 domain with no route/tab of its own — the surfaces are the Insights
> ChatPage + KnowledgeListPage ([`insights.md`](insights.md) §2.4–2.5). Nem-technikai
> működés-magyarázó: [`docs/guides/companion-hogyan-mukodik.md`](../guides/companion-hogyan-mukodik.md).

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

**V1.1 (`mezo-fnnq.6`) shipped the L3 memory spine — knowledge facts + prompt injection:**

- **Two new owned tables** — `knowledge_fact` (fact_text, category `train|fuel|health|life`,
  source `chat|pattern|manual`, reinforcement_count, `include_in_prompt`, last_reinforced_at)
  + `learned_fact` (candidate → decision `accept|reject|refine` null-until-decided →
  promoted_fact_id; **table-only in V1.1** — the extraction/confirm flow is V1.2).
- **Fact CRUD on the contract** — `GET/POST /api/companion/fact` + `PATCH .../fact/{id}`
  (partial update: text/category edit + the `include_in_prompt` toggle); POST creates
  `source=manual` facts (the manual-add path shipped now, so facts exist before V1.2 extraction).
- **Prompt injection** — `KnowledgeFactService.renderPromptBlock(userId)`: the top-N
  (`mezo.companion.facts.top-n`, default 10) prompt-included facts by reinforcement count (then
  newest), rendered as a deterministic Hungarian block (`MEGERŐSÍTETT TÉNYEK Danielről …`, one
  `- (kategória) tény` line each, `""` when none) and inserted into BOTH turn paths' system
  prompt **between the context snapshot and the history transcript**.

**V1.2 (`mezo-fnnq.7`) shipped extraction + the confirm UI — the learning loop's front half:**

- **Post-turn async extraction** — `ChatService` publishes `ChatTurnCompleted` (sync + streamed
  turn); the `FactExtractionListener` (`@TransactionalEventListener(AFTER_COMMIT)` + `@Async`,
  gated on `mezo.companion.extraction.enabled`) runs `FactExtractionService`: one cheap-tier
  LLM call over the turn transcript (strict-JSON answer, defensively parsed), normalized
  string-dedupe against confirmed facts + pending candidates, per-turn cap → undecided
  `learned_fact` rows. A broken answer means zero candidates, never a broken turn.
- **Decision endpoint + inbox** — `GET /api/companion/fact/candidate` (pending, newest first) +
  `POST .../candidate/{id}/decision` (`accept|reject|refine` + `refinedText`); accept/refine
  promote into `knowledge_fact` (`source=chat`) which the V1.1 top-N injection then carries
  into every prompt. One decision per candidate (400 `COMPANION_CANDIDATE_ALREADY_DECIDED`).
- **KnowledgeListPage goes real** — dual-mode `useKnowledge`/`useKnowledgeActions`
  (`data/insights/knowledge{Api,Hooks}.ts`): pending L2 candidate cards (Elfogad / Pontosít
  inline / Elvet), persisting `include_in_prompt` toggles, degraded banner on switch-off 404.
  The FE `FactCategory` unified on the backend enum (`train|fuel|health|life`).

**V1.3 (`mezo-fnnq.8`) shipped never-ask-twice + the advisor chain v1 — v1 „megjegyez" complete:**

- **Post-response advisor chain** (`feature/companion/advisor/`, old docs §4.5 retry semantics
  on the port): `CompanionAdvisorChain.review(...)` runs after every LLM answer —
  `ClinicalOutputCheck` first (deterministic accent-folded regex: Rx term + dose-change verb in
  one sentence; a hit skips the verdict that round), then `TurnVerdictCheck` (ONE cheap-tier
  LLM call → strict-JSON `{redundantQuestion, ungroundedClaim, reason}`, defensively parsed,
  **fail-open**). Violation → corrective re-prompt (`AdvisorRetry.block` appended to the system
  prompt; same tools + same audit) up to `advisors.max-retries`; a still-violating answer ships
  with `ai_message.degraded = true`. Sync path retries before delivery; the streamed path
  reviews post-hoc between the last delta and `done` (the done row is authoritative — the FE
  swap silently carries a corrected answer).
- **Degraded on the wire + badge** — `MessageResponse.degraded` (required boolean); the FE
  `ChatMessage` bubble renders a subtle `nem ellenőrzött` eyebrow (tooltip) on flagged answers.
- **Reinforcement starts** — an extraction dedupe-hit against a CONFIRMED fact now increments
  `reinforcement_count` + `last_reinforced_at` (the chat re-learned it) instead of silently
  dropping; pending-candidate duplicates still just skip.

**V2.1 (`mezo-fnnq.9`) shipped the vector layer — pgvector infra + the embedding port:**

- **pgvector everywhere the app runs** — the Postgres image is `pgvector/pgvector:pg16` in all
  three environments (local compose, k3s StatefulSet, Testcontainers — same PG16 major,
  data-compatible superset; the k3s swap included a pre-swap `pg_dump` + post-swap
  `REFRESH COLLATION VERSION` + `REINDEX`, see the runbook). The Liquibase changeset
  (`202607032033_mezo-fnnq.9_create_memory_embedding_pgvector.sql`) runs
  `CREATE EXTENSION IF NOT EXISTS vector` + creates `memory_embedding`.
- **`memory_embedding` table** — the L1 episodic layer's store: one `vector(768)` row per
  NARRATIVE unit (`kind` = `chat_turn|daily_summary|weekly_summary`, `ref_id` unique per kind —
  the V2.2 pipeline's idempotence anchor), HNSW cosine index. Entity maps `float[]` via
  hibernate-vector (`@JdbcTypeCode(SqlTypes.VECTOR)` + `@Array(length=768)`); ANN search is a
  native-SQL repository method (`<=>` has no JPQL form) returning entity fields + distance.
- **`EmbeddingPort`** (the `CompanionLlm` pattern, V2 decision): `embedDocuments(texts)` /
  `embedQuery(text)` — asymmetric Gemini task types (`RETRIEVAL_DOCUMENT`/`RETRIEVAL_QUERY`).
  Real `GeminiEmbeddingAdapter` calls the Google GenAI SDK `Client` (the bean the chat starter
  already provides) **directly** — Spring AI 2.0.0 ships no Gemini `EmbeddingModel`, so
  `embedContent` goes through the SDK; same provider, same API key, detail hidden by the port.
  Vectors are L2-normalized client-side (`gemini-embedding-001` only self-normalizes at 3072).
  Deterministic `FakeEmbeddingAdapter` (`companion-fake`): seeded-random unit vectors per text
  + a `[fake-embed:0.6 0.8]` scripting sentinel.
- **Nothing writes embeddings yet** — the daily-summary generator + embed pipeline is V2.2;
  recall-in-chat is V2.3.

**V2.2 (`mezo-fnnq.10`) shipped daily summaries + the embed pipeline — the memory fills itself:**

- **`daily_summary` table + generator** — `DailySummaryService.generate(userId, date)`: a
  deterministic, date-scoped Hungarian digest of one FINISHED day's L0 (train/sport/run, fuel-day
  rollup, sleep, weight, Reta cycle-day + dose, check-ins — reusing the owning features' reads;
  `nincs adat` semantics by omission) → ONE cheap-tier `CompanionLlm` call (prompt behind
  `SUMMARY_MARKER`) → past-tense narrative row. Digest = pure code, narrative = pure LLM
  (NFR-M-4). Empty day ⇒ no row; existing day ⇒ returned untouched (no LLM call). Uniqueness is
  a PARTIAL index (`where is_deleted = false`) so soft-deleting a summary lets the next night
  regenerate it.
- **The app's first `@Scheduled` cron** — `DailySummaryJob` (nightly, `mezo.companion.summary.cron`,
  default 02:20; switch `mezo.techcore.cron.daily-summary-job.enabled`; `SchedulingConfiguration`
  born in techcore): for every user × every finished day in the catch-up window
  (`summary.catch-up-days`, 7) it generates + embeds what's missing — **idempotent catch-up IS the
  backfill** (missed nights, crashes and pre-V2.2 history self-heal; per-date failures isolated).
- **Embed pipeline** — `MemoryEmbeddingWriter` (feature/companion/embedding/): narrative unit →
  `EmbeddingPort.embedDocuments` → `memory_embedding` row; content capped at
  `embedding.embed-max-chars` BEFORE embedding (the stored text IS what the vector describes);
  idempotent via exists-probe + the uq constraint (a lost race degrades to a logged skip).
  Summaries → kind=`daily_summary` (ref = summary row); chat turns → kind=`chat_turn`, **one
  vector per turn** (`Daniel: …\nMezo: …`, ref = assistant message id).
- **Post-turn embedding** — `TurnEmbeddingListener` (AFTER_COMMIT + `@Async`, the extraction-listener
  idiom) on the extended `ChatTurnCompleted` event (now carries `assistantMessageId`), gated on
  `mezo.companion.embedding.embed-chat-turns`; failures logged+swallowed. BOTH the live and the
  nightly catch-up path run the same `embedTurnByMessageId` — `occurred_on` always derives from
  the assistant ROW's creation day (the episode's day, never the embed day), and the catch-up
  embeds **one turn per transaction** (`findUnembeddedTurnIds` + per-id call from the job), so a
  racing/failing unit can never abort the batch (review finding). The catch-up HEALS the toggle,
  never bypasses it. Summaries replace-by-day: a regenerated summary soft-deletes the stale
  same-day embedding before inserting (one live summary vector per day).

**V2.3 (`mezo-fnnq.11`) shipped similar-days recall — v2 „emlékszik" is complete:**

- **`find_similar_past_days(description, k)`** joins the V0.5 tool registry (`tools/MemoryTools`,
  wrapped + audited like every tool): embeds the query (`EmbeddingPort.embedQuery`), ANN-searches
  the **daily-summary** vectors (kind-scoped — the tool answers about past DAYS; chat-turn vectors
  stay for a later always-on recall layer), and re-ranks in code by
  **`similarity × exp(-age/τ)`** (`MemoryRecallService` — cosine alone is time-blind, spec §7).
- **Honest floor** — matches under `recall.min-similarity` are dropped (a weak cosine match is
  noise, not a memory); an empty result renders `nincs adat`, never a fabricated resemblance.
- **Chips carry the recalled days** — each recalled day adds a `Memory`/date ref to the turn's
  audit, so the FE shows what got remembered (no FE change — the `MessageRef` envelope flows).
- Tool-only recall for now: auto-recall-on-every-turn stays deferred until it earns its latency
  (roadmap decision).

**V3.1 (`mezo-fnnq.12`) shipped statistical patterns + the Inbox — v3 „észrevesz" started:**

- **The second nightly cron** — `PatternDetectionJob` (02:40, switch
  `mezo.techcore.cron.pattern-detection-job.enabled`): for every pair in the config catalog
  (`mezo.companion.patterns.pairs`, 8 pairs v1) it lag-aligns two per-day metric series over the
  lookback window, gates on `min-n` (8), runs PURE Pearson math (`PearsonCorrelation` — r, n and
  a real two-sided p via the incomplete-beta t-test, fixture-tested; no LLM anywhere) and
  **upserts one row per `(user, kind, pair_key)`**: stats refresh while `proposed`/`monitoring`,
  a user-judged `confirmed`/`rejected` row is never auto-touched (V3.3 adds reinforcement).
- **Series extraction** — `MetricSeriesService`: 12 `MetricKey`s (sleep quality/duration,
  training RPE, sport load, gym volume, late-meal hour, daily kcal, Reta cycle-day, water,
  morning weight-delta, check-in stress/energy) composed read-only from the owning features'
  EXISTING reads; deterministic multi-row aggregation, absence is absence (never bridged).
- **Honest numbers** — `confidence` is NULL on statistical rows (FE renders „tanulom");
  evidence chips carry `r=… · n=… nap · p=… · window`; mechanism is a deterministic HU sentence.
- **Inbox API + PatternsPage real** — `GET /api/companion/pattern` +
  `POST …/pattern/{id}/decision` (confirm/monitor/reject — REPEATABLE transitions, a pattern is
  a standing judgement); FE `usePatterns`/`usePatternActions` dual-mode (the knowledge recipe),
  PatternCard's decision buttons persist, critique bars render only when present (V3.2),
  degraded card on switch-off 404.

**V3.2 (`mezo-fnnq.13`) shipped the AI hypothesis loop — propose → critique → revise:**

- **The weekly smart-tier pipeline** — `HypothesisPipelineService` (cron `HypothesisJob`, Sunday
  03:00, switch `mezo.techcore.cron.hypothesis-job.enabled`): gather (last-7 daily-summary
  narratives + confirmed-facts block + the live statistical patterns' r/n/p — grounded
  statistical support) → **propose** (strict-JSON, `llm.smart-model` — the Pro tier's debut) →
  **critique** per hypothesis (4-factor 0..1 + prose reasoning) → **score**
  (`0.35·stat + 0.25·conf + 0.20·l3align + 0.20·act`, arch §4.7 — weights are code) → route:
  keep ≥ `keep-threshold` (0.75) · revise ONCE ≥ `revise-threshold` (0.50) then re-critique ·
  else discard. Every stage pure-compute or pure-LLM (NFR-M-4); defensive JSON parsing all the
  way down (broken answer = zero survivors).
- **Survivors join the V3.1 Inbox** as `kind=ai_hypothesis` rows: `confidence` = the weighted
  score, critique jsonb attached (+`reasoning`), `r/n/p` null. Identity =
  `"hyp-" + hash(normalized title)` — an existing row in ANY status is never re-proposed
  (rejected stays rejected). The FE renders them with the existing critique grid + confidence.
- **`thinking` on the wire** — additive `PatternResponse.thinking` = the critic's prose
  reasoning (the card's "AI gondolatmenete"); rides the critique envelope, no migration.
- **Port grew a smart tier** — `CompanionLlm.completeSmart` (default = cheap tier;
  `GeminiCompanionLlm` builds a second ChatClient on `llm.smart-model`; the fake keeps one
  marker dispatch).

**V3.3 (`mezo-fnnq.14`) shipped pattern→knowledge promotion + reinforcement — the epic is
COMPLETE (all 14 slices):**

- **The learning loop closes** — a FIRST confirm on a pattern promotes it into a durable
  `knowledge_fact` (`source=pattern`, factText = the pattern title, linked back via
  `pattern.promoted_fact_id`; v1 category heuristic: physiology/trigger → health, response →
  train). Later un-confirms leave the fact alone — it is Daniel's knowledge now, the Knowledge
  tab owns its lifecycle. Repeat confirms never duplicate.
- **Recurrence reinforcement** — when the nightly detection re-detects a CONFIRMED pattern in
  the SAME direction (sign of r), the promoted fact gets `reinforcement_count++` +
  `last_reinforced_at` — at most once per `reinforce-cooldown-days` (7): the sliding window
  re-counts the same evidence nightly, so uncapped increments would crowd the top-N injection.
  The pattern's own stats stay frozen (the user judged THAT correlation). Monitoring rows never
  reinforce (silent monitoring stays silent); a direction flip is NOT the pattern recurring.
- **In-chat acknowledgment** — pattern-facts promoted within `facts.pattern-ack-days` (3) get an
  `ÚJ FELISMERÉSEK` block in BOTH chat paths' system prompt (after the top-N facts) — the
  companion naturally mentions "ezt megtanultam rólad" on the next conversation.
  `include_in_prompt` is the user's kill-switch for EVERY injection channel: a toggled-off fact
  is never announced either (review finding).
- **Evidence link on the Knowledge tab** — additive `KnowledgeFactResponse.patternTitle` (the
  promoting pattern's title, batch reverse-lookup); the FE fact card renders a `minta: …` chip.

**Status per layer:**

| Layer | State | Notes |
|---|---|---|
| Backend (tables + contract + services + sync endpoint) | ✅ V0.2 | Behind `mezo.feature.companion.enabled`; switch off ⇒ the whole HTTP surface 404s. |
| Context snapshot | ✅ V0.3 | `ContextSnapshotAssembler` in every chat turn's system prompt; LLM-free, `nincs adat` absences, `mezo.companion.snapshot.*` windows. |
| LLM adapter | ✅ V0.1 (ADR 0008) | Real `GeminiCompanionLlm` (`gemini-2.5-flash`) / deterministic `FakeCompanionLlm` (`companion-fake` profile, + forced-failure sentinels since V0.4, + `[fake-tool:…]` scripted tool execution since V0.5, + `[fake-briefing:…]` scripted briefing dispatched on `BRIEFING_MARKER_MIRROR` — a literal mirror of `BriefingGenerator.BRIEFING_MARKER`, not an import, to avoid a companion→proactive package cycle — since proactive B1.1; + `[fake-weekly:…]` scripted weekly-suggestion prose dispatched on `WEEKLY_MARKER_MIRROR` (same literal-mirror rule) since proactive W1). |
| Streaming (SSE) | ✅ V0.4 | `POST .../message/stream` — `delta`/`done`/`error` events, two-transaction turn, hand-written controller (§9 Decision 11). |
| Tool calling + audit | ✅ V0.5 | 8 read tools over existing services; `RecordingToolCallback` audit + per-turn cap; `tool_calls`/`refs` envelopes persisted; `mezo.companion.tools.*` tunables. |
| Frontend | ✅ V1.2 | ChatPage real since V0.4/V0.5; **KnowledgeListPage real since V1.2** (candidate inbox + persisting toggles + degraded state). **LIVE on k3s since 2026-07-04** — `GEMINI_API_KEY` rides the `mezo-app` SealedSecret, switch on; smoke-verified with a real context-aware Gemini answer. |
| Knowledge facts (L3) | ✅ V1.1 | `knowledge_fact`/`learned_fact` tables + fact CRUD + top-N injection block in every system prompt (`mezo.companion.facts.top-n`). |
| Fact extraction + confirm | ✅ V1.2 | Post-turn async extraction (`mezo.companion.extraction.*`) → `learned_fact` candidates → L2 decision endpoint → promotion (`source=chat`). |
| Advisor chain (never-ask-twice + self-check) | ✅ V1.3 | Clinical regex + LLM verdict, retry-once → `degraded` flag (`mezo.companion.advisors.*`); reinforcement on extraction dedupe-hit. |
| Vector infra (pgvector + EmbeddingPort) | ✅ V2.1 | `memory_embedding` (`vector(768)`, HNSW, cosine) + `EmbeddingPort` (real Gemini SDK adapter / fake); image `pgvector/pgvector:pg16` in compose + k3s + Testcontainers. |
| Narrative memory (summaries + embed pipeline) | ✅ V2.2 | Nightly `DailySummaryJob` (first cron; catch-up = backfill) → `daily_summary` + embeddings; post-turn `TurnEmbeddingListener` embeds every chat turn; `mezo.companion.summary.*` + `embedding.*` tunables. |
| Episodic recall in chat | ✅ V2.3 | `find_similar_past_days` tool + `MemoryRecallService` (similarity × exp(-age/τ), similarity floor, daily-summary scope); `Memory` ref chips; `mezo.companion.recall.*` tunables. |
| Statistical patterns + Inbox | ✅ V3.1 | Nightly `PatternDetectionJob` (Pearson + real p-value, upsert by pair key, frozen user judgements) → `pattern` table → Inbox API → **PatternsPage real dual-mode** (`mezo.companion.patterns.*`). |
| AI hypothesis loop | ✅ V3.2 | Weekly smart-tier propose→critique→revise (`mezo.companion.hypotheses.*`, arch §4.7 scoring); survivors = `ai_hypothesis` Inbox rows with critique + `thinking`. |
| Pattern → fact promotion + reinforcement | ✅ V3.3 | Confirm ⇒ `knowledge_fact` (source=pattern, linked back); same-direction recurrence reinforces; `ÚJ FELISMERÉSEK` ack block; `minta:` evidence chip on the Knowledge tab. **Epic complete.** |

**Driver:** `mezo-fnnq.2` (spine) + `mezo-fnnq.3` (snapshot) + `mezo-fnnq.4` (SSE + FE) +
`mezo-fnnq.5` (tools + chips) + `mezo-fnnq.6` (facts) + `mezo-fnnq.7` (extraction + confirm UI) +
`mezo-fnnq.8` (advisors + degraded + reinforcement) + `mezo-fnnq.9` (pgvector + embedding port) +
`mezo-fnnq.10` (daily summaries + embed pipeline; plan
[`2026-07-03-companion-v22-daily-summaries.md`](../superpowers/plans/2026-07-03-companion-v22-daily-summaries.md)) +
`mezo-fnnq.11` (similar-days recall) + `mezo-fnnq.12` (statistical patterns + Inbox; plan
[`2026-07-04-companion-v31-statistical-patterns.md`](../superpowers/plans/2026-07-04-companion-v31-statistical-patterns.md)) +
`mezo-fnnq.13` (hypothesis loop; plan
[`2026-07-04-companion-v32-hypothesis-loop.md`](../superpowers/plans/2026-07-04-companion-v32-hypothesis-loop.md)) +
`mezo-fnnq.14` (promotion + reinforcement) — **all 14 slices of `mezo-fnnq` shipped**.
**Design of record:**
[`docs/superpowers/specs/2026-07-03-phase3-companion-chat-design.md`](../superpowers/specs/2026-07-03-phase3-companion-chat-design.md)
(§3 data model, §4 snapshot, §5 tool catalog, §6 guardrails); slice map
[`docs/superpowers/plans/2026-07-03-companion-roadmap.md`](../superpowers/plans/2026-07-03-companion-roadmap.md)
§V0.2–V0.5; implementation plans
[`2026-07-03-companion-v02-conversations.md`](../superpowers/plans/2026-07-03-companion-v02-conversations.md) +
[`2026-07-03-companion-v03-context-snapshot.md`](../superpowers/plans/2026-07-03-companion-v03-context-snapshot.md) +
[`2026-07-03-companion-v04-sse-fe-chat.md`](../superpowers/plans/2026-07-03-companion-v04-sse-fe-chat.md) +
[`2026-07-03-companion-v05-tools.md`](../superpowers/plans/2026-07-03-companion-v05-tools.md) +
[`2026-07-03-companion-v13-advisors.md`](../superpowers/plans/2026-07-03-companion-v13-advisors.md);
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
- **Degraded ANSWER badge (V1.3)** — an assistant bubble whose answer failed the advisor
  self-check even after the corrective retry carries a subtle `nem ellenőrzött` eyebrow next to
  the timestamp (tooltip: „Ez a válasz nem ment át az önellenőrzésen — kezeld fenntartással.").
  On a streamed turn a rejected attempt-1 may briefly be visible while streaming; the `done`
  swap replaces it with the corrected answer (or flags it). Mock mode never shows the badge.
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
      4. advisorChain.review(prompt, content, answer, …)   ── V1.3 (NO TX, bean present only when
         mezo.companion.advisors.enabled): clinical regex → LLM verdict; violation → ONE
         corrective re-prompt (AdvisorRetry.block appended; same tools+audit) → re-check;
         still violating ⇒ degraded=true. The done row carries the FINAL (possibly retried) text.
      5. chatService.completeTurn(userId, id, answer, audit, degraded) ── TX #2: persist ASSISTANT
         row WITH tool_calls/refs envelopes + degraded → terminal event:done, data: MessageResponse
         (tools[] = "name(args)" chips, refs[] = tool-contributed data refs, degraded flag)
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
                      + knowledgeFactService.renderPromptBlock(userId)              ── V1.1 ──
                      + renderHistory(loadWindow())  ("Daniel:"/"Mezo:" transcript)
      3. persist the USER row (saveAndFlush → distinct created_at)
      4. audit = toolRegistry.newTurnAudit(); answer = advisorChain.complete(...)   ── V1.3 ──
         when the advisors switch is on (ObjectProvider): attempt + review + retry inside the
         chain; falls back to the direct companionLlm.complete(...) call when off     ── PORT ──►
         (real: GeminiCompanionLlm → Gemini tool loop · tests: FakeCompanionLlm echoes both
          halves + executes [fake-tool:…] sentinels through the REAL callbacks + answers
          verdict calls via the [fake-violate…] sentinels)
      5. persist the ASSISTANT row with audit.toToolCallsEnvelope()/toRefsEnvelope() + degraded
         (null envelopes when no tool ran — the V0.2 steady state is unchanged)
      6. touchConversation → lastMessageAt = now; title = first user msg (once)
      6b. publish ChatTurnCompleted ── V1.2: AFTER_COMMIT → @Async FactExtractionListener
          → FactExtractionService.extractFromTurn (cheap-tier LLM, JSON parse, dedupe, cap)
          → undecided learned_fact candidates (the streamed path publishes in completeTurn)
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

**The knowledge-fact injection (V1.1).** `KnowledgeFactService.renderPromptBlock(userId)`
(`service/KnowledgeFactService.java`) loads the top-N (`mezo.companion.facts.top-n`)
`include_in_prompt` facts ordered by `reinforcement_count desc, created_at desc` and renders
`MEGERŐSÍTETT TÉNYEK Danielről (legfontosabb elöl):` with one `- (kategória) fact_text` line per
fact — categories render as deterministic Hungarian labels (train→edzés, fuel→étkezés,
health→egészség, life→élet). No facts ⇒ `""` (no empty header). Both `sendMessage` and
`prepareTurn` insert it **between the snapshot and the history**, so the sync AND streamed turns
silently know every confirmed fact.

**The advisor chain (V1.3).** `feature/companion/advisor/` — `CompanionAdvisorChain` wraps the
port with the old docs' §4.5 semantics: `runChecks` = `ClinicalOutputCheck.check(answer)`
(deterministic: accent-folded lowercase (NFD strip), sentence-split on `[.!?\n]`, violation when
an `advisors.rx-terms` term AND a dose-change verb (`emeld|emeljük|csökkentsd|…hagyd el|állítsd
át…` — imperative/we-forms only, written accent-folded) share a sentence) first; a clinical hit
skips `TurnVerdictCheck` that round. The verdict is ONE cheap-tier call through the two-string
port (`VERDICT_MARKER`-prefixed judge prompt; payload = the turn's full system prompt + the
tool-call name list from `ToolCallAudit.callNames()` + the user message + the answer) parsed
first-`{`-to-last-`}` into `{redundantQuestion, ungroundedClaim, reason}` — **fail-open** on any
call/parse failure. Violations map to `redundancy`/`grounding`; retry = `systemPrompt +
AdvisorRetry.block(violations)` with the same tools and the SAME audit (chips reflect the whole
turn), re-checked; after `advisors.max-retries` rounds a still-violating answer returns
`AdvisedAnswer(answer, degraded=true)`. Both callers hold the chain as
`ObjectProvider<CompanionAdvisorChain>` — advisors off ⇒ no chain bean ⇒ V1.2 behavior
byte-for-byte. Timing + verdict are `log.info`-ed per turn (the roadmap's "measure!" decision).

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
  (history/window ordering key) + `idx_ai_message_created_by`. **V1.3** adds `degraded boolean
  not null default false` (`202607031900_mezo-fnnq.8_ai_message_degraded.sql`) — true when the
  advisor chain rejected the answer even after the corrective retry.

### Backend tables (V1.1, ✅)

Migration `202607031707_mezo-fnnq.6_create_knowledge_learned_fact.sql` (in `1.0.0_master.yml`):

- **`knowledge_fact`** — `id uuid pk`, `created_by fk→app_user ON DELETE CASCADE`, `is_deleted`,
  `created_at`, `fact_text text`, `category varchar(16)` (`ck_knowledge_fact_category IN
  (train,fuel,health,life)`), `source varchar(16)` (`ck_knowledge_fact_source IN
  (chat,pattern,manual)`), `reinforcement_count int default 0`, `include_in_prompt boolean
  default true`, `last_reinforced_at timestamptz`; index
  `idx_knowledge_fact_created_by_include_reinforcement (created_by, include_in_prompt,
  reinforcement_count desc)` — the injection query's key.
- **`learned_fact`** — `id uuid pk`, owner columns as above, `candidate_text text`,
  `category varchar(16)` (`ck_learned_fact_category`, **added by the V1.2 migration**
  `202607031812_mezo-fnnq.7_learned_fact_category.sql` — the extractor classifies at capture,
  promotion carries it), `derived_from_message_id uuid fk→ai_message ON DELETE SET NULL`,
  `user_decision varchar(16)` (`ck_learned_fact_user_decision IN (accept,reject,refine)` —
  NULL passes = undecided), `refined_text text`, `promoted_fact_id uuid fk→knowledge_fact
  ON DELETE SET NULL`; indexes on `(created_by, user_decision)` + both loose-ref FKs.

### Backend tables (V2.2, ✅)

Migration `202607032115_mezo-fnnq.10_create_daily_summary.sql` (in `1.0.0_master.yml`):

- **`daily_summary`** — `id uuid pk`, `created_by fk→app_user ON DELETE CASCADE`, `is_deleted`,
  `created_at`, `summary_date date not null`, `narrative text not null`. Uniqueness is a
  **partial unique index** `uq_daily_summary_created_by_summary_date … where is_deleted = false`
  (one LIVE summary per user+day; a soft-deleted row doesn't block regeneration — deliberate,
  summaries are regenerable data) + `idx_daily_summary_created_by_summary_date desc`.

### Backend tables (V2.1, ✅)

Migration `202607032033_mezo-fnnq.9_create_memory_embedding_pgvector.sql` (in `1.0.0_master.yml`) —
runs `CREATE EXTENSION IF NOT EXISTS vector` first (needs the `pgvector/pgvector:pg16` image,
swapped in-slice across compose/k3s/Testcontainers):

- **`memory_embedding`** — `id uuid pk`, `created_by fk→app_user ON DELETE CASCADE`, `is_deleted`,
  `created_at`, `kind varchar(20)` (`ck_memory_embedding_kind IN
  (chat_turn,daily_summary,weekly_summary)`), `ref_id uuid`
  (`uq_memory_embedding_kind_ref_id (kind, ref_id)` — one embedding per source unit, the V2.2
  pipeline's idempotence anchor), `content text` (the embedded narrative, kept verbatim so recall
  can quote it), `embedding vector(768) not null`, `occurred_on date` (when the episode happened —
  the recency-ranking key); indexes `idx_memory_embedding_created_by_kind_occurred_on
  (created_by, kind, occurred_on desc)` + `idx_memory_embedding_vector` (**HNSW,
  `vector_cosine_ops`** — pairs with the `<=>` operator).

### Entities

`MemoryEmbeddingEntity` (`entity/MemoryEmbeddingEntity.java`, V2.1) `extends OwnedEntity`,
soft-deleted, `KIND_*` constants + `@Pattern` mirror; the vector maps as `float[]` via
**hibernate-vector** (`@JdbcTypeCode(SqlTypes.VECTOR)` + `@Array(length = EmbeddingPort.DIMENSIONS)`
— new pom dependency, Boot-BOM managed). ANN search: `MemoryEmbeddingRepository.findNearest(userId,
kind?, vectorLiteral, k)` — **native SQL** (`<=>` has no JPQL form, so `@SQLRestriction` does NOT
apply → `is_deleted = false` is explicit in the query), returns a `MemoryMatch` projection
(id/kind/refId/content/occurredOn + `distance`); `toVectorLiteral(float[])` renders the pgvector
text literal the query binds. Proven by `MemoryEmbeddingRepositoryIT` over hand-seeded axis vectors
(order, kind filter, ownership, soft-delete, k-limit, uq violation — no embedding provider in tests).
**Filtered-ANN recall guard:** every pooled connection runs `SET hnsw.iterative_scan =
strict_order` (Hikari `connection-init-sql`) — without it a `kind`-filtered `findNearest` silently
returns fewer than k rows once the table outgrows the HNSW frontier (`hnsw.ef_search`, default 40);
regression-proven by the 63-row frontier IT case.

`KnowledgeFactEntity` + `LearnedFactEntity` (`entity/`) both `extends OwnedEntity`, soft-deleted;
category/source/decision are `String` + `@Pattern` mirrors of the CHECK constraints with constants
(`SOURCE_MANUAL`, `DECISION_ACCEPT`, …) — the `AiMessageEntity.role` precedent, no Java enum. The
learned-fact refs are **loose UUID columns** (`derivedFromMessageId`, `promotedFactId`), not
`@ManyToOne` — V1.2 reads them by id, nothing walks them.

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
| `GET /api/companion/fact` | `KnowledgeFactResponse[]` | 200 · 401 | V1.1 — owner's facts, `reinforcement_count desc, created_at desc`. |
| `POST /api/companion/fact` | `KnowledgeFactResponse` | 201 · 400 · 401 | V1.1 manual add — `CreateFactRequest {factText 1..500, category pattern}`; `source=manual`, `include_in_prompt=true`, `reinforcement_count=0`. |
| `PATCH /api/companion/fact/{id}` | `KnowledgeFactResponse` | 200 · 400 · 401 · 404 | V1.1 partial update — `UpdateFactRequest {factText?, category?, includeInPrompt?}`, only provided fields applied (the KnowledgeListPage toggle). |
| `GET /api/companion/fact/candidate` | `FactCandidateResponse[]` | 200 · 401 | V1.2 — the pending inbox: undecided candidates, newest first. |
| `POST /api/companion/fact/candidate/{id}/decision` | `FactCandidateResponse` | 200 · 400 · 401 · 404 | V1.2 — `FactDecisionRequest {decision accept\|reject\|refine, refinedText?}`; accept/refine promote (`promotedFactId` set); refine without text → FIELD `VALIDATION_REQUIRED_FIELD`; re-decide → `COMPANION_CANDIDATE_ALREADY_DECIDED`. |

**Schemas:** `ConversationResponse {id, title?, startedAt, lastMessageAt?}`,
`MessageResponse {id, role, content, createdAt, tools[], refs[], degraded}` (**filled since
V0.5** on tool-using turns; a tool-less turn's null envelope still maps to `[]`,
`CompanionMapper.toTools/toRefs`; `degraded` required boolean since V1.3 — always false on user
rows), `MessageTool {type, name}` (`type` = `read` in V0.5; `name`
carries the args baked in — `get_sleep(days=3)`), `MessageRef {kind, id}` (kinds: `Workout`,
`Sport`, `Run`, `WeightTrend`, `Sleep`, `FuelDay`, `Protocol`, `Goal`, `Medication`, and since
V2.3 `Memory` — a recalled day's date),
`SendMessageRequest {content}` (`minLength 1`, `maxLength 4000`),
`StreamDelta {text}` + `StreamError {code}` (V0.4 — the SSE per-event `data:` payloads; every
data line is JSON), `KnowledgeFactResponse {id, factText, category, source, reinforcementCount,
includeInPrompt, lastReinforcedAt?, createdAt}` (V1.1).

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
| `find_similar_past_days(description, k)` (V2.3) | `MemoryRecallService.recallSimilarDays` — query embed → ANN over daily-summary vectors → similarity × recency-decay re-rank | `Memory`/date (≤k) |

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
- `mezo.companion.facts.top-n` = **10** (`@Min(1) @Max(50)`) — how many confirmed facts (by
  reinforcement count, then newest) ride in every system prompt (V1.1).
- `mezo.companion.facts.pattern-ack-days` = **3** (`@Min(0) @Max(30)`) — pattern-facts younger
  than this get the V3.3 in-chat acknowledgment block (0 = off).
- `mezo.companion.extraction.enabled` = **true** — the V1.2 post-turn extraction master toggle
  (`COMPANION_EXTRACTION_SWITCH`); off ⇒ the AFTER_COMMIT listener bean does not exist.
- `mezo.companion.extraction.max-candidates-per-turn` = **3** (`@Min(1) @Max(10)`) — candidates
  persisted per chat turn (dedupe runs before the cap).
- `mezo.companion.advisors.enabled` = **true** — the V1.3 advisor-chain master toggle
  (`COMPANION_ADVISORS_SWITCH`); off ⇒ the chain/check beans do not exist (V1.2 behavior).
- `mezo.companion.advisors.max-retries` = **1** (`@Min(0) @Max(2)`) — corrective re-prompts
  before a violating answer ships `degraded` (0 = check-only flagging; old docs §4.5: 1).
- `mezo.companion.advisors.rx-terms` = `[retatrutid, reta, tirzepatid, mounjaro, szemaglutid,
  ozempic, wegovy]` (`@NotEmpty`) — the clinical check's guarded prescription-med terms
  (accent-folded contains-match; only dose-CHANGE verbs trigger).
- `mezo.companion.llm.chat-model` = `gemini-2.5-flash` (every turn) / `smart-model` =
  `gemini-2.5-pro` (heavy pipelines, unused until V3.2) — model tiers are config, not code (ADR 0008).
- `mezo.companion.embedding.model` = `gemini-embedding-001` (`@NotBlank`) — the V2.1 embedding
  model behind `EmbeddingPort`; the **768 dimension is structural** (the `vector(768)` schema +
  `EmbeddingPort.DIMENSIONS` constant), deliberately NOT config.
- `mezo.companion.embedding.embed-chat-turns` = **true** — the V2.2 post-turn embedding toggle
  (`COMPANION_EMBED_TURNS_SWITCH`); off ⇒ the `TurnEmbeddingListener` bean does not exist.
- `mezo.companion.embedding.embed-max-chars` = **2000** (`@Min(200) @Max(20000)`) — content cap
  per embedded narrative unit, applied BEFORE embedding (the stored text is the embedded text).
- `mezo.companion.summary.cron` = `"0 20 2 * * *"` (`@NotBlank`, server zone) — the nightly
  daily-summary job schedule (02:20, so "yesterday" is truly finished).
- `mezo.companion.summary.catch-up-days` = **7** (`@Min(1) @Max(60)`) — finished days back the job
  checks and self-heals each night (idempotent catch-up doubles as backfill).
- Job switch `mezo.techcore.cron.daily-summary-job.enabled` (`DAILY_SUMMARY_JOB_SWITCH`) — off ⇒
  the `DailySummaryJob` bean does not exist.
- `mezo.companion.recall.decay-days` = **90** (`@Min(1) @Max(365)`) — τ: how fast an old day's
  relevance fades in the V2.3 recall ranking.
- `mezo.companion.recall.max-k` = **5** (`@Min(1) @Max(10)`) — upper clamp for the recall tool's
  `k` arg.
- `mezo.companion.recall.min-similarity` = **0.25** (0..1) — raw-cosine floor; below it a match
  is noise, not a memory.
- `mezo.companion.recall.candidate-pool` = **20** (`@Min(1) @Max(100)`) — ANN candidates fetched
  before the decay re-rank.
- `mezo.companion.recall.render-max-chars` = **300** (`@Min(50) @Max(2000)`) — per-memory render
  cap in the tool result (gist over full re-quote; token budget).
- `mezo.companion.patterns.cron` = `"0 40 2 * * *"` — the V3.1 nightly correlation job (after the
  summary job by convention); switch `mezo.techcore.cron.pattern-detection-job.enabled`
  (`PATTERN_DETECTION_JOB_SWITCH`).
- `mezo.companion.patterns.lookback-days` = **60** (`@Min(14) @Max(365)`) — correlation window.
- `mezo.companion.patterns.min-n` = **8** (`@Min(3) @Max(60)`) — aligned-days floor before a pair
  may surface at all.
- `mezo.companion.patterns.reinforce-cooldown-days` = **7** (`@Min(1) @Max(60)`) — a confirmed
  pattern reinforces its promoted fact at most once per window (the nightly lookback slides one
  day; re-counting the same evidence would inflate top-N ranks — review finding).
- `mezo.companion.patterns.pairs` = the 8-pair catalog (`@NotEmpty`, each
  `{key, category, label, title, metric-a, metric-b, lag-days}`) — pair keys are pattern identity
  (never rename a live key); metrics come from the `MetricKey` enum.
- `mezo.companion.hypotheses.cron` = `"0 0 3 * * SUN"` — the V3.2 weekly loop; switch
  `mezo.techcore.cron.hypothesis-job.enabled` (`HYPOTHESIS_JOB_SWITCH`).
- `mezo.companion.hypotheses.max-per-run` = **3** (`@Min(1) @Max(10)`) — hypotheses judged per run.
- `mezo.companion.hypotheses.keep-threshold` = **0.75** / `revise-threshold` = **0.50** (0..1) —
  the arch §4.7 routing thresholds; the four WEIGHTS are code constants (they define the score).
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

**V2.1 embedding seam (✅ wired, unused until V2.2).** All embedding access goes through the
`EmbeddingPort` (`EmbeddingPort.java`) — `embedDocuments(List<String>) → List<float[]>` /
`embedQuery(String) → float[]`, unit vectors at `DIMENSIONS=768`. Real `GeminiEmbeddingAdapter`
talks to the Google GenAI SDK `Client` bean directly (Spring AI 2.0.0 has no Gemini
EmbeddingModel — the SDK call is the slice's provider decision, hidden by the port; same key as
chat); fake `FakeEmbeddingAdapter` under `companion-fake` (seeded-random unit vectors +
`[fake-embed:…]` sentinel).

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

**V1.1 facts seam (✅ wired).** The knowledge-fact block is companion-internal (no cross-feature
read), but it is the seam the later slices hang onto: V1.2's extraction now writes `learned_fact`
candidates and its decision flow promotes them into `knowledge_fact` (source=`chat`); V1.3's
redundancy guard reads the same confirmed set; V3.3 promotes patterns into it (source=`pattern`)
and increments `reinforcement_count`.

**V1.2 Knowledge UI seam (✅ wired).** `useKnowledge()`/`useKnowledgeActions()`
(`data/insights/knowledgeHooks.ts`) serve BOTH knowledge surfaces (Insights KnowledgeListPage —
real inbox + toggles; Me KnowledgePage — mock-mode graph prototype, real-mode honest `edges: []`).
**Contract crossing the seam:** `knowledgeApi` maps the wire (`factText`/`includeInPrompt`/
`reinforcementCount`, `candidateText`) onto the lean FE domain (`text`/`active`/`reinforced`);
`FactCategory` IS the backend enum since V1.2 ([`insights.md`](insights.md) §2.4, §5.1).

**V2.2 daily-digest seam (✅ wired — read-only, one-way).** `DailySummaryService.digest` composes
the same owning-feature reads the snapshot/tools use, but date-scoped to ONE past day:
`WorkoutSessionRepository.findDoneInstancesBetween(date,date)` + set counts, sport/run since-date
finders filtered to the day, `FuelDayService.getDay(date)`, sleep/check-in by-date finders,
`MedicationCycleService.derive(userId, med, date)` (it already took an explicit date), and ONE new
plain finder in the owning feature (`WeightLogRepository.findFirstBy…AndDate…` — the V0.3/V0.5
precedent). The nightly job iterates `AppUserRepository.findAll()` (companion → auth read).

**V2.3 recall seam (✅ wired).** `find_similar_past_days` is companion-internal (tools →
`MemoryRecallService` → the V2.1 repository + V2.1 `EmbeddingPort`) — no new cross-feature reads.

**V3.1 patterns seam (✅ wired — read-only, one-way).** `MetricSeriesService` composes the
owning features' existing reads date-scoped (sleep/sport/run/workout+sets/meal/FuelDay/medication
cycle/water/weight/check-in) — zero new cross-feature finders; `PatternsPage` consumes
`usePatterns`/`usePatternActions` from `@/data/hooks` ([`insights.md`](insights.md) §2.1).

**V3.3 promotion seam (✅ wired — the loop closes).** Pattern-confirm →
`knowledge_fact(source=pattern)` → the V1.1 top-N injection carries it into every prompt → the
V3.1 nightly re-detection reinforces it → the reinforcement raises its injection rank. The next
epics (proactive briefing/heartbeat/memoir, Fuel P8) build on the now-complete
snapshot+facts+summaries+patterns stack — see the roadmap's "Relationship to other roadmaps".

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
# → { "id":…, "role":"assistant", "content":"…", "createdAt":…, "tools":[], "refs":[], "degraded":false }

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

```bash
# 6) knowledge facts (V1.1) — add manually, list, toggle out of the prompt
FID=$(curl -s -X POST $BASE/fact -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"factText":"Laktózérzékeny","category":"health"}' | jq -r .id)
curl -s $BASE/fact -H "Authorization: Bearer $TOKEN"
curl -s -X PATCH $BASE/fact/$FID -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"includeInPrompt":false}'
```

Every prompt-included fact rides in the next chat turn's system prompt automatically (the
`MEGERŐSÍTETT TÉNYEK` block) — with the fake adapter the echo makes it visible in the answer.

```bash
# 7) extraction candidates (V1.2) — pending inbox + one-tap decision
curl -s $BASE/fact/candidate -H "Authorization: Bearer $TOKEN"
curl -s -X POST $BASE/fact/candidate/$CAND_ID/decision -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"decision":"accept"}'
# refine: {"decision":"refine","refinedText":"Pontosított tény"} · reject: {"decision":"reject"}
```

Candidates appear automatically after chat turns (async extraction; with the fake adapter script
them: `{"content":"mesélek [fake-facts:[{\"fact\":\"Laktózérzékeny\",\"category\":\"health\"}]]"}`).
The FE surface is the Insights KnowledgeListPage (`/insights/knowledge`).

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
- **New advisor check?** — add a component in `advisor/` and call it from
  `CompanionAdvisorChain.runChecks` (cheap/deterministic checks first, LLM-backed after); keep
  fail-open semantics for anything that can break, and give the fake LLM a sentinel if it needs
  scripted answers. V2.3's similar-days recall and the deferred full EvidenceCheck both land here.
- **New post-turn work?** — subscribe another `@TransactionalEventListener(AFTER_COMMIT)` to
  `ChatTurnCompleted` (own switch, own `@Async` method, catch-everything) — the V1.2 listener
  is the template; never do post-turn work inline in the turn transaction.
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

**V1.1 test additions:**

- **`KnowledgeFactServiceIT`** (10 tests) — create defaults (manual/included/zero-reinforcement),
  list ordering (reinforcement desc, then newest), cross-user isolation, partial-update semantics
  (toggle-only leaves text/category; text+category edit leaves the toggle), 404 on a foreign fact,
  and the injection block: `""` when empty, top-N cap with deterministic ordering, toggled-off
  exclusion, Hungarian category labels.
- **`LearnedFactPersistenceIT`** — the candidate → decision → promoted_fact_id shape round-trips;
  undecided rows keep every decision field null.
- **`CompanionFactApiIT`** (6 tests, HTTP) — 401 without token, POST 201 + list round-trip,
  400 field errors (empty factText, unknown category — both `VALIDATION_INVALID_VALUE`),
  PATCH toggle round-trip, PATCH 404 on unknown id. First **PATCH** consumer — `patchForBody`
  verb helper added to `ApiIntegrationTest`.
- **Extended:** `ChatServiceIT` (facts block between snapshot and history via the fake echo;
  toggled-off fact absent; no-facts turn renders no header), `CompanionApiSwitchOffIT` (fact
  surface 404s with the switch off), `CompanionPropertiesIT` (`facts.top-n` binding).
- New populators `KnowledgeFactPopulator`/`LearnedFactPopulator`; both tables in the
  `ResetDatabase` TRUNCATE list.

**V1.2 test additions:**

- **`FactExtractionServiceIT`** (6 tests, fake profile) — the fake answers extraction calls
  (system prompt keyed on `EXTRACTION_MARKER`) with the `[fake-facts:<json>]` sentinel from the
  turn content: happy-path persist (category + `derived_from_message_id`), dedupe vs
  confirmed + pending (case/whitespace variants), per-turn cap, invalid-item drops
  (unknown category / blank fact), not-JSON → zero rows without throwing, sentinel-less → zero.
- **`FactCandidateServiceIT`** (7 tests) — pending list (undecided/newest/owner-scoped),
  accept promotes (`source=chat`, category carried, `include_in_prompt` true), refine uses the
  corrected text + requires it (FIELD error), reject promotes nothing, re-decide → 400
  conflict, foreign → 404.
- **`CompanionFactCandidateApiIT`** (5 tests, HTTP) — 401, accept round-trip (inbox empties +
  the promoted fact appears in `GET /fact`), refine-without-text 400 FIELD, already-decided 400
  REQUEST, unknown 404.
- **`ChatExtractionFlowIT`** — the WHOLE pipeline over a committing HTTP turn (AFTER_COMMIT →
  async → candidate row), ridden out with **Awaitility** (new test dependency);
  `ChatExtractionSwitchOffIT` — extraction off ⇒ no listener bean.
- **Test-infra hardening:** `AbstractIntegrationTest` drains leftover `@Async` work before each
  test (bounded busy-wait on `applicationTaskExecutor`) — post-turn extraction from a previous
  committing test must never race the next test's DB reset.
- **FE:** `knowledgeApi.test.ts` (wire mapping + PATCH/POST bodies), `knowledgeHooks.test.tsx`
  (mock seed; real bootstrap/degraded; mock cache-mutating + real invalidating actions),
  `KnowledgeListPage.test.tsx` both modes (candidate actions, inline refine, toggle, degraded),
  `KnowledgePage.test.tsx` pinned to mock mode (graph prototype); MSW fact/candidate fixtures
  mirror the seeds.

**V1.3 test additions:**

- **The stateless fake-verdict trick** — verdict calls are keyed on the `VERDICT_MARKER` prompt
  prefix, and the verdict payload embeds the checked ANSWER; since the fake's echo embeds the
  prompts in every answer, attempt-2 answers contain `AdvisorRetry.RETRY_MARKER`, so
  `[fake-violate]` (violate until the marker appears) exercises retry-then-recover WITHOUT the
  fake keeping state. `[fake-violate-always]` → the degraded path; `[fake-verdict-broken]` →
  non-JSON → fail-open. Clinical scenarios need no scripting at all: the echo copies the user's
  Rx phrase into the "answer" and the regex fires on both rounds.
- **`ClinicalOutputCheckTest`** (5 tests, pure unit — no Spring) — verb+term same-sentence
  violation, accent-folded inflection (`Retát`), term-without-verb, verb-without-term,
  cross-sentence pass.
- **`TurnVerdictCheckIT`** (3) — clean / scripted-redundancy mapping / fail-open on non-JSON.
- **`CompanionAdvisorChainIT`** (5, via `ChatService.sendMessage`) — clean turn, retry-recover
  (`RETRY_MARKER` in the echo proves round 2), degraded persisted+on-wire, clinical-persists →
  degraded, verdict-broken → fail-open without retry.
- **`ChatStreamAdvisorIT`** (2, NOT `@Transactional`) — deltas carry attempt-1 (no marker),
  `done` carries the retried answer clean; violate-always → `done.degraded` + persisted flag.
- **`CompanionAdvisorsSwitchOffIT`** (2) — no chain bean; violation sentinels change nothing.
- **Extended:** `ChatServiceIT` (clean turn ⇒ `degraded=false` persisted + on-wire),
  `CompanionPropertiesIT` (advisors binding), `FactExtractionServiceIT` (+2: confirmed-dupe
  reinforces `reinforcement_count`/`last_reinforced_at`, pending-dupe does not).
- **FE:** `chatApi.test.ts` (degraded mapping: false → undefined, true → true),
  `ChatPage.test.tsx` (mock seed shows no badge; a degraded `done` renders `nem ellenőrzött`).

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

**V1.1 decisions (locked in-session):**

21. **Category enum v1 = `train|fuel|health|life`, source = `chat|pattern|manual`** — String +
    `@Pattern` + CHECK constraint (the `role` precedent, no Java enum); request-side validation
    is contract `pattern` (400 FIELD error, not a Jackson 500).
22. **Manual fact-add ships in V1.1** (`POST /api/companion/fact`, source=`manual`) — facts can
    exist and prove the injection before V1.2's extraction lands.
23. **Injection = top-N by `reinforcement_count desc, created_at desc`,** config
    `mezo.companion.facts.top-n` (default 10); block renders Hungarian category labels; empty set
    ⇒ `""` (no empty header). Position: snapshot → **facts** → history, shared by the sync and
    streamed turn (both call the same prompt assembly).
24. **`learned_fact` is table-only in V1.1** with **loose UUID refs** (`derived_from_message_id`,
    `promoted_fact_id`, both `ON DELETE SET NULL`, no `@ManyToOne`) and a CHECK that passes NULL
    (undecided candidate) — the V1.2 flow gets a ready schema, no dead code today.
25. **PATCH enters the contract** (partial update, only provided fields applied) — first PATCH
    endpoint in the app; `ApiIntegrationTest` grew the `patchForBody` helper (the framework's
    add-to-base rule).

**V1.2 decisions (locked in the V1.2 plan §"Decisions locked"):**

26. **Trigger = Spring event, AFTER_COMMIT + @Async** (`ChatTurnCompleted`, published in both
    turn paths; `PreparedTurn` grew `userMessageId` so streamed candidates anchor honestly).
    In rolled-back `@Transactional` ITs the event never fires — no cross-test interference by
    construction.
27. **Cadence: per-turn async, config-gated** (`mezo.companion.extraction.enabled`) — the
    roadmap's in-slice decision; daily batch deferred. The listener is the ONLY gated bean;
    the service exists whenever companion is on (directly testable).
28. **Extraction scope: the whole turn** (user + assistant text), restricted by prompt to facts
    *Daniel stated or confirmed*. Strict-JSON over the existing two-string port — no port
    change; defensive parse (first `[`..last `]`), unknown category/blank fact dropped.
29. **Dedupe v1 = normalized string equality** (trim/lowercase/whitespace-collapse) vs confirmed
    facts + pending candidates + the in-batch set; embedding-level dedupe re-evaluated after
    V2.1. Accept does NOT re-dedupe (double-confirm collapse = V1.3 redundancy territory).
30. **Decision lives on the candidate resource** (`/fact/candidate/{id}/decision`), one decision
    per candidate, promotion writes `knowledge_fact` directly (`source=chat`); refine requires
    `refinedText` as a service-level FIELD error (a conditional requirement the contract cannot
    express).
31. **FE taxonomy unified on the backend enum** — the mock seed remapped onto
    `train|fuel|health|life`, 4 HU labels, colors reuse 4 existing `--cat-*` vars (no CSS
    change); the Me graph page stays a mock-mode prototype (real mode: honest `edges: []`).

**V1.3 decisions (locked in the V1.3 plan §"Decisions locked"):**

32. **The "Spring AI Advisor" is a port-level chain, not a `ChatClient` advisor** — the codebase
    talks to the model through the hand-rolled `CompanionLlm` port (ADR 0008), so the chain
    wraps port calls explicitly (`CompanionAdvisorChain`). Same §4.5 semantics, no new framework
    surface.
33. **Chain depth v1 = 2 checks** (the roadmap's latency question answered small): deterministic
    clinical regex (~0 ms, first; a hit skips the LLM that round) + ONE combined cheap-tier
    verdict call for redundancy AND grounding-lite. Full per-claim EvidenceCheck +
    numericGroundingCheck stay deferred (classifier-tier cost data first). Old ContinuityGate /
    MultiHorizonLoader intent is covered by the snapshot injection — not carried.
34. **Retry semantics per old docs §4.5:** violation → ONE corrective re-prompt with the
    violation summary appended to the system prompt (same user message, same tools, SAME audit —
    chips honestly reflect all calls of the turn); still violating ⇒ ship WITH `degraded=true`
    (never block the answer). Budget = `advisors.max-retries` (0..2, default 1).
    `SelfHealthCheck` persistence deferred — `log.warn` is the V1.3 record.
35. **The verdict is FAIL-OPEN** — a broken/unreachable judge yields zero violations + a warn
    log; only a *detected violation surviving the retry budget* degrades. Availability over
    strictness: the judge must never take the chat down with it.
36. **Streamed turns review post-hoc** — deltas stream attempt-1 unbuffered (TTFB intact), the
    review runs between the last delta and `done`, and the authoritative done row carries the
    corrected (or flagged) answer through the FE's existing done-swap. Known v1 limitation: a
    rejected attempt-1 is briefly visible while streaming.
37. **Redundancy scope = the injected fact block** (top-N `include_in_prompt`) — exactly what
    the answering model could know; a prompt-excluded fact can't be culpably re-asked, and the
    retry can actually fix what the guard flags. Tool RESULTS are not shown to the judge in v1
    (call names only, claims from listed tools presumed grounded) — the high-value catch is the
    no-tool fabrication case; result capture is a bd follow-up.
38. **Reinforcement v1 = extraction dedupe-hit on a CONFIRMED fact** (`reinforcement_count++`,
    `last_reinforced_at=now()`) — the chat re-learning a fact IS a re-confirmation; pending and
    in-batch duplicates still just skip. The old `reinforce_knowledge_fact` TOOL stays v3.
39. **`degraded` is a persisted wire attribute** (`ai_message.degraded` NOT NULL default false;
    `MessageResponse.degraded` required) — the FE renders a subtle `nem ellenőrzött` eyebrow;
    mock messages never set it (`toChatMessage` maps false → `undefined`).

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
- **Post-turn async work outlives the HTTP response** — a committing IT's extraction can still
  be running when the next test starts; `AbstractIntegrationTest.drainAsyncWork()` guards this.
  Any new AFTER_COMMIT listener inherits the guard for free (it drains the shared executor).
- **The extraction listener swallows everything** (`log.warn`) — extraction must never affect a
  chat turn. Don't "fix" the catch-all; alert on the log if it ever matters.
- **The fake's verdict scripting keys on the ANSWER, not the request** — `[fake-violate]` in a
  test message reaches the verdict via the echo; if you change the echo format or
  `AdvisorRetry.RETRY_MARKER`, the stateless violate-once trick breaks with it (the fake checks
  the marker's presence in the payload to recognize a retry round).
- **The retry shares the turn's `ToolCallAudit`** — retry-round tool calls count against the
  same `max-calls-per-turn` budget and land in the same chips. Intentional (honest transparency);
  don't give the retry a fresh audit.

**Deferred (with bd ids):**
- **Deployed Gemini secret** — set a real `GEMINI_API_KEY` in the `mezo-app` secret, then drop
  `MEZO_FEATURE_COMPANION_ENABLED=false` from `k8s/backend/deployment.yaml` (the V0.2-review
  prerequisite; until then the deployed chat is the honest degraded state). The v0 exit criterion
  ("mit egyek ma edzés előtt?" on the phone, grounded + chip-annotated) needs this to be provable
  end-to-end on the real model — the real-API tool smoke is part of that rollout.
- **V2.x RAG (pgvector) · V3.x patterns** — see the roadmap; `find_similar_past_days` joins the
  registry at V2.3 (`mezo-fnnq.11`); `get_knowledge_facts(topic)` is a v1-batch tool candidate
  once facts outgrow the top-N window.
- **Advisor hardening (V1.3 follow-ups, bd-filed):** tool-RESULT capture into `ToolCallAudit`
  for the verdict judge · `SelfHealthCheck` persistence for violations (log-only today) ·
  latency/cost review of the verdict call after real-key usage (classifier-tier decision).
- **Knowledge graph edges** — the Me KnowledgePage graph layer has no backend (real mode renders
  `edges: []`); file its slice when the graph view earns it.

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
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/KnowledgeFactService.java` — V1.1 fact CRUD + `renderPromptBlock` (top-N injection, `FACTS_HEADER`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/FactExtractionService.java` — V1.2 post-turn extraction (`EXTRACTION_MARKER`, parse/dedupe/cap).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/{ChatTurnCompleted,FactExtractionListener}.java` — the V1.2 AFTER_COMMIT async trigger.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/FactCandidateService.java` — V1.2 pending inbox + accept/refine/reject decision.
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/AsyncConfiguration.java` — `@EnableAsync` (born with V1.2).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/mapper/CompanionMapper.java` — entity → generated `api.dto` (null envelope → `[]`; + `toKnowledgeFactResponse`; + `degraded` since V1.3).

**Backend — advisor chain (V1.3)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/advisor/CompanionAdvisorChain.java` — the §4.5 retry/degrade orchestrator (`complete` sync / `review` streamed).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/advisor/ClinicalOutputCheck.java` — deterministic Rx dose-change regex (accent-folded, sentence-scoped).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/advisor/TurnVerdictCheck.java` — the combined LLM verdict (`VERDICT_MARKER`, fail-open parse).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/advisor/{AdvisorRetry,AdvisorViolation,AdvisedAnswer}.java` — retry block + value records.

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
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/{AiConversationEntity,AiMessageEntity,ToolCallsEnvelope,RefsEnvelope,KnowledgeFactEntity,LearnedFactEntity}.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/{AiConversationRepository,AiMessageRepository,KnowledgeFactRepository,LearnedFactRepository}.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java` — `Llm` + `Chat` + `Snapshot` + `Tools` + `Facts` + `Extraction` + `Advisors` records.
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `COMPANION_SWITCH` + extraction/advisors sub-switches.
- `backend/src/main/resources/application.yml` — `mezo.feature.companion.enabled` + `mezo.companion.llm.*`/`chat.*` + `spring.ai.google.genai.api-key`.

**Backend — migration**
- `backend/src/main/resources/db/changelog/1.0.0/script/202607031400_mezo-fnnq.2_create_ai_conversation_message.sql` (in `1.0.0_master.yml`).
- `backend/src/main/resources/db/changelog/1.0.0/script/202607031707_mezo-fnnq.6_create_knowledge_learned_fact.sql` (in `1.0.0_master.yml`).
- `backend/src/main/resources/db/changelog/1.0.0/script/202607031812_mezo-fnnq.7_learned_fact_category.sql` (in `1.0.0_master.yml`).
- `backend/src/main/resources/db/changelog/1.0.0/script/202607031900_mezo-fnnq.8_ai_message_degraded.sql` (in `1.0.0_master.yml`).

**Backend — tests**
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/{AiMessageJsonbRoundTripIT,ConversationServiceIT,ChatServiceIT,ChatStreamServiceIT,CompanionApiIT,CompanionStreamApiIT,CompanionApiSwitchOffIT,CompanionLlmFakeIT,CompanionRealWiringIT,CompanionSwitchOffIT,CompanionPropertiesIT}.java`
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/{CompanionToolsRenderIT,CompanionToolRegistryIT,ToolCallAuditTest,RecordingToolCallbackTest}.java` — the V0.5 tool batch.
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/{KnowledgeFactServiceIT,LearnedFactPersistenceIT,CompanionFactApiIT}.java` — the V1.1 fact batch.
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/{FactExtractionServiceIT,FactCandidateServiceIT,CompanionFactCandidateApiIT,ChatExtractionFlowIT,ChatExtractionSwitchOffIT}.java` — the V1.2 extraction/decision batch.
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/{CompanionAdvisorChainIT,ChatStreamAdvisorIT,CompanionAdvisorsSwitchOffIT}.java` + `advisor/{ClinicalOutputCheckTest,TurnVerdictCheckIT}.java` — the V1.3 advisor batch.
- `backend/src/test/java/io/mrkuhne/mezo/support/populator/{AiConversationPopulator,AiMessagePopulator,KnowledgeFactPopulator,LearnedFactPopulator}.java` + `support/ResetDatabase.java` (companion tables in the TRUNCATE list).
- `backend/src/test/java/io/mrkuhne/mezo/ArchitectureTest.java` — the two documented V0.4 allowlist entries (hand-written controller + fake-LLM raw exception) + the V0.5 `companion_tools_are_internal_sphere_only` rule.

**Frontend (chat real since V0.4, knowledge since V1.2)**
- `frontend/src/data/_client/api.ts` — `apiSse` (fetch-ReadableStream SSE reader) + its `api.sse.test.ts`.
- `frontend/src/data/insights/chatApi.ts` — REST + stream client, `toChatMessage` wire mapper (+ `degraded` since V1.3).
- `frontend/src/features/insights/components/ChatMessage.tsx` — the bubble (chips, refs, V1.3 `nem ellenőrzött` badge).
- `frontend/src/data/insights/chatHooks.ts` — `useChat` (bootstrap dual-read) + `useChatActions` (send/stream state machine); re-exported from `data/hooks.ts`.
- `frontend/src/data/insights/chat.ts` — the mock seed (`initialChat`) + the shared `cannedReply`.
- `frontend/src/data/insights/knowledgeApi.ts` — V1.2 fact/candidate REST client + wire mappers.
- `frontend/src/data/insights/knowledgeHooks.ts` — `useKnowledge` (facts+candidates dual-read) + `useKnowledgeActions` (toggle/decide).
- `frontend/src/data/insights/knowledge.ts` — the mock seeds (`facts`, `candidateSeed`, `edges`) + the 4-category labels/colors.
- `frontend/src/features/insights/pages/ChatPage.tsx` — the real dual-mode chat surface ([`insights.md`](insights.md) §2.5).
- `frontend/src/features/insights/pages/KnowledgeListPage.tsx` — the real dual-mode L2 confirm surface ([`insights.md`](insights.md) §2.4).
- `frontend/src/test/msw/handlers.ts` — companion fixtures (chat + facts/candidates) + the SSE stream handler.
- `k8s/backend/deployment.yaml` — `MEZO_FEATURE_COMPANION_ENABLED=false` until the Gemini secret lands.

**Docs (link, don't duplicate)**
- Design spec: [`docs/superpowers/specs/2026-07-03-phase3-companion-chat-design.md`](../superpowers/specs/2026-07-03-phase3-companion-chat-design.md)
- Roadmap (14 slices): [`docs/superpowers/plans/2026-07-03-companion-roadmap.md`](../superpowers/plans/2026-07-03-companion-roadmap.md)
- V1.2 plan: [`docs/superpowers/plans/2026-07-03-companion-v12-fact-extraction.md`](../superpowers/plans/2026-07-03-companion-v12-fact-extraction.md)
- V1.3 plan: [`docs/superpowers/plans/2026-07-03-companion-v13-advisors.md`](../superpowers/plans/2026-07-03-companion-v13-advisors.md)
- V0.2 plan: [`docs/superpowers/plans/2026-07-03-companion-v02-conversations.md`](../superpowers/plans/2026-07-03-companion-v02-conversations.md)
- V0.4 plan: [`docs/superpowers/plans/2026-07-03-companion-v04-sse-fe-chat.md`](../superpowers/plans/2026-07-03-companion-v04-sse-fe-chat.md)
- V0.5 plan: [`docs/superpowers/plans/2026-07-03-companion-v05-tools.md`](../superpowers/plans/2026-07-03-companion-v05-tools.md)
- ADR: [`docs/decisions/0008-companion-llm-spring-ai-2-gemini.md`](../decisions/0008-companion-llm-spring-ai-2-gemini.md)
- Roadmap/milestone log: [`docs/milestones/roadmap.md`](../milestones/roadmap.md)
- References: [`docs/references/`](../references/) (`api_contract_conventions`, `liquibase_conventions`, `spring_patterns`, `testing_standards`, `integration_test_framework`, `configuration_conventions`, `java_package_structure`, `error_handling`)
