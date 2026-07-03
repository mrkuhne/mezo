# Phase 3 — Companion Chat & AI Memory — design spec (v0–v3)

- **Date:** 2026-07-03
- **Status:** accepted (point-in-time design artifact)
- **Driver:** bd `mezo-fnnq` (epic) · roadmap: [`../plans/2026-07-03-companion-roadmap.md`](../plans/2026-07-03-companion-roadmap.md)
- **Sources:** old Supabase-era docs — [`../../old docs/mezo-prd.md`](../../old%20docs/mezo-prd.md) (PRD v2.1) + [`../../old docs/mezo-architecture.md`](../../old%20docs/mezo-architecture.md) (Architecture v2.1). This spec is the **distillation** of those docs onto the current stack; slice sessions should read THIS, not the old docs (link into them only where this spec points at a section for extra depth).

## 1. Product goal — the pain this kills

Daniel's concrete pain: *every new LLM chat starts with re-explaining everything* — when he trains,
what he eats, how much, the goal, the weight trend, the Reta cycle. The Phase 2 backend already
**stores all of that** (train + fuel + goal + weight + medication + sleep + check-in). Phase 3 puts a
chat on top that **already knows it** when the first message is typed.

The product identity comes from the old PRD's six IDENT principles, distilled to what governs this build:

| Principle | What it means for Phase 3 code |
|---|---|
| **IDENT-1 Companion, not coach** | First-person plural Hungarian voice; grounded in the user's own data; observation + suggestion, never bare grades. |
| **IDENT-2 Internal sphere only** | The tool registry NEVER contains an outward-acting tool (no email/calendar/purchase/third-party HTTP-write). Structural, not prompt-level. |
| **IDENT-3 Never silent** | Proactive surfaces (briefing/heartbeat) are OUT of v0–v3 scope, but nothing we build may dead-end: AI-unavailable renders an honest degraded state, never a broken screen. |
| **IDENT-4 Self-logging is the enemy** | Chat is also a capture surface later; v0–v3 keeps hooks for it (FreeNote-style messages) but does not build voice/photo ingestion. |
| **IDENT-6 Cognitive offloading** | Decision layering (L1 auto / L2 approve-card / L3 ask) applies from v1 on (fact-confirm = L2). |

**Explicitly dropped / deferred from the old docs** (decision 2026-07-03, this spec):

- The old **Phase 7 motivation system** (RecoveryCapital/CognitiveBandwidth/AdaptationBudget/RelationshipCredit,
  IdentityStage, StatDimension, MemoirCapsule, QuarterlyMemoir, PRStory) is **not** part of this epic.
  Note the standing tension: the shipped **Progression system (XP/levels)** contradicts the old docs'
  anti-XP constitution — a deliberate direction change that a future ADR must reconcile before any
  motivation-system work starts.
- Proactive cron surfaces (morning briefing, heartbeat, opportunity scanner, memoirs, anniversary,
  AnchorMode, crisis detection, drift detection) — later epics. v3's pattern engine is the only cron here.
- PERMA / life-context entities (PersonEntry, Event, ContextEpoch, EnvironmentSnapshot…) — later.
- Voice/photo ingestion, QuickInputSheet AI-routing — later.

## 2. Target architecture (current stack)

Old docs assumed Supabase Edge Functions + Deno + LangGraph.js + Gemini + RLS. We keep the
**functional design** and re-target the implementation:

| Old docs | mezo Phase 3 |
|---|---|
| Deno Edge Functions | Spring Boot 4 services in `backend/.../feature/companion/` |
| LangGraph.js ReAct agent | **Spring AI** `ChatClient` + tool calling (provider per ADR, slice V0.1) |
| Chat middlewares (EvidenceCheck…) | Spring AI **Advisor** chain (subset — see §6) |
| pg_cron | Spring `@Scheduled` (single instance; ShedLock only if ever >1 replica) |
| Supabase RLS | existing app-level `created_by` ownership filtering |
| pgvector on Supabase | pgvector extension on our Postgres 16 (local docker + k3s — infra work in V2.1) |
| Zod structured output | Spring AI structured output + Bean Validation |

### The 4-layer memory, translated

```
L3  knowledge_fact            — confirmed, long-lived facts; top-N injected into EVERY system prompt   (v1)
L2  pattern (+ critique meta) — statistical + AI-hypothesized correlations, user-confirmable inbox     (v3)
L1  memory_embedding          — pgvector episodic recall over NARRATIVE units (summaries, chat turns)  (v2)
L0  the Phase 2 domain tables — already built; read via snapshot + tools                               (done)
```

**The layering rule (the most important design decision):** the chat's context backbone is
**deterministic**, not retrieved:

1. **Context snapshot** (v0) — code assembles the current state from L0 into the system prompt. No AI infra.
2. **Tool calling** (v0) — aggregation/history questions run as service-backed tools (SQL can sum; top-k retrieval can't).
3. **RAG** (v2) — pgvector recalls *thematically similar past episodes* ("volt már ilyen nap"). Additive, not backbone.
4. **Facts** (v1) — the never-ask-twice guarantee comes from structured `knowledge_fact` injection, never from embeddings (probabilistic recall must not gate remembering someone's lactose intolerance).

### A chat turn (target shape, v0.5+)

```
POST /api/companion/chat/{conversationId}/message   (SSE)
  → build system prompt: companion voice (HU) + context snapshot (§4) + top-N knowledge facts (v1)
  → Spring AI ChatClient stream, tools registered (§5)
  → tool calls surfaced to FE as chips (mock ChatMessage contract: tools[] + refs[])
  → persist user+assistant ai_message rows (incl. tool-call log jsonb)
  → post-turn (async, v1+): fact-candidate extraction → learned_fact
  → post-turn (v2+): embed both turns → memory_embedding
```

## 3. Data model (new tables; house rules apply — UUID PK, `created_by`, soft delete, Liquibase)

| Table | Slice | Fields (essence) |
|---|---|---|
| `ai_conversation` | V0.2 | `title`, `started_at`, `last_message_at` |
| `ai_message` | V0.2 | FK conversation, `role` (`user`/`assistant`), `content` text, `tool_calls` jsonb (typed envelope), `refs` jsonb, `created_at` |
| `knowledge_fact` | V1.1 | `fact_text`, `category`, `source` (`chat`/`pattern`/`manual`), `reinforcement_count`, `include_in_prompt` bool, `last_reinforced_at` |
| `learned_fact` | V1.1 | `candidate_text`, `derived_from_message_id`, `user_decision` (`accept`/`reject`/`refine`) null until decided, `refined_text`, `promoted_fact_id` |
| `memory_embedding` | V2.1 | `kind` (`chat_turn`/`daily_summary`/`weekly_summary`), `ref_id`, `content` text, `embedding vector(768)`, `occurred_on` date |
| `daily_summary` | V2.2 | `summary_date`, `narrative` text (generated HU digest of the day) |
| `pattern` | V3.1 | `description`, `mechanism`, `kind` (`statistical`/`ai_hypothesis`), `confidence`, critique jsonb (v3.2), `status` (`proposed`/`monitoring`/`confirmed`/`rejected`), `promoted_fact_id` |

jsonb columns are typed embedded objects (`@JdbcTypeCode(SqlTypes.JSON)`), reusing the Train
`ProvenanceEnvelope` precedent for `tool_calls` (ADR 0006 pattern). **No fabricated values:** unknown
confidence is `null` and renders as "tanulom", never a hardcoded number (old docs `ProvenanceEnvelope` rule).

## 4. The context snapshot (v0.3 — the heart of the feature)

`ContextSnapshotAssembler` — a read-only, deterministic service in `feature/companion` that composes
the other features' services (one-directional coupling: companion → others, never back):

| Block | Source (existing) |
|---|---|
| Profile + weight | `biometric_profile`, `weight_log` 7/14-day trend |
| Goal | active `goal` + prescription current-week segment + `mealsPerDay`/`wakeTime`/`bedTime` |
| Train | active `mesocycle` + week position; `gym_schedule_slot`/`sport_schedule_slot` weekly rhythm; last-7d `workout_session`/`sport_session`/`run_session_log` digest |
| Fuel today | FuelDay rollup (consumed vs targets incl. water), active `protocol` + today's `supplement_intake` |
| Medication | server-derived `retaDay` + phase (`MedicationCycleService`) |
| Biometrics | last night `sleep_log`, latest `check_in` |

Rendered as a compact, Hungarian-labelled text block with deterministic ordering (unit-testable
without any LLM), budget ≈ 2–4k tokens. Missing data renders as explicit absence ("nincs adat"), never
invented. This block alone answers "mit egyek ma / mi van ma edzésre" — the stated pain.

## 5. Tool catalog — v0.5 first batch

Subset of the old docs' 19 read tools (arch Appendix C), mapped to **existing services**; all read-only,
ownership-scoped, audit-logged into `ai_message.tool_calls`:

`get_recent_workouts(days)` · `get_sport_sessions(days)` · `get_weight_trend(weeks)` ·
`get_recent_meals(days)` (day rollups) · `get_sleep(days)` · `get_protocol_adherence(days)` ·
`get_goal_progress()` · `get_reta_cycle()`

Later batches: `find_similar_past_days(description,k)` (V2.3), `get_knowledge_facts(topic)` (v1),
compute tools (`compute_correlation`, `compare_periods`) with the pattern engine (v3).
Tool-count discipline from the old docs: single-purpose, ≤ ~120 lines each, rate-limited per turn.

## 6. Guardrails carried over (non-negotiable)

- **Internal-sphere-only registry** (IDENT-2): no write tools in v0–v2 at all; v3 adds only `propose_pattern`-style internal writes.
- **No fabricated numbers/confidence**: `null` = "learning"; deterministic sub-scores computed in code.
- **Clinical guard**: the companion never suggests Rx dose changes (Reta!). v0 ships it as a system-prompt hard rule; a classifier-advisor (old docs §4.11) is a later hardening slice — do not block v0 on it.
- **Grounding-lite**: v0 system prompt mandates citing which snapshot block / tool result a claim comes from; the full EvidenceCheck/redundancy advisor chain (old docs §4.5) arrives with v1.3 (redundancy needs facts to exist).
- **Switch-gated + LLM-free tests**: everything behind `mezo.feature.companion.enabled` (+ config `*Properties`, never `@Value`). The LLM sits behind a port (`CompanionLlm` interface); integration tests use a deterministic in-process fake implementation (profile-gated bean, not a Mockito mock), never the network. All deterministic logic (snapshot, extraction plumbing, scoring, retrieval ranking) is tested without any LLM.

## 7. RAG layer design (v2) — what we embed and why

- **Embed narrative units, not raw rows**: generated `daily_summary` digests, chat turns, weekly report text later. Raw numeric rows (a set of 105×9) embed poorly; numbers stay in SQL behind tools.
- **Model/dimension**: old docs research (bd `mezo-c30`) settled `gemini-embedding-001` @ 768-dim, HNSW,
  cosine, client-side L2-normalization. **Re-validate at V2.1**: the embedding provider may differ from
  the chat provider chosen in the V0.1 ADR; the decision that survives is *768-dim `vector(768)` + HNSW + cosine*, provider-agnostic.
- **Recency matters**: retrieval ranks by `similarity × time-decay` (or date-filtered metadata) — cosine alone is time-blind.
- **RAG recalls; it does not build memory.** Memory building is the v1 promotion pipeline
  (chat → `learned_fact` candidate → user confirms → `knowledge_fact` → injected top-N). Keep the two mechanisms separate.

## 8. Pattern engine sketch (v3)

- **V3.1 statistical**: nightly `@Scheduled` Pearson correlations across L0 metrics (sleep↔RPE, late-meal↔sleep, Reta-day↔appetite proxy…) → `pattern` rows (`kind=statistical`) → Inbox API → `PatternsPage` Confirm/Monitor/Reject (L2 decision surface).
- **V3.2 AI hypotheses**: weekly propose→critique→revise loop; keep the old docs' 4-factor critique scoring
  (0.35 statistical support + 0.25 confounders + 0.20 fact-alignment + 0.20 actionability; keep ≥0.75, revise ≥0.50 once, discard <0.50 — arch §4.7).
- **V3.3 promotion**: confirmed pattern → `knowledge_fact` (+ reinforcement on recurrence); the companion acknowledges what it learned in-chat.

## 9. Open decisions → where they get decided

| Decision | Where |
|---|---|
| Spring AI version line (Boot 4 compat) + chat provider (Gemini vs Anthropic vs OpenAI) + model tiers | **ADR at V0.1** (cost/latency/HU-quality/tool-calling maturity) |
| SSE + contract-first: `text/event-stream` in the OpenAPI fragment vs hand-documented streaming endpoint | V0.4 (design note in-slice; precedent-setting) |
| Embedding provider (may differ from chat provider) | V2.1 (re-validate 768-dim research) |
| Fact-extraction cadence (per-turn async vs daily batch) | V1.2 |
| Advisor chain depth (which of the old 6 middlewares are worth their latency) | V1.3 |

## 10. Slice map (see roadmap for full briefs)

**v0 „lát engem":** V0.1 ADR+skeleton → V0.2 conversations+sync endpoint → V0.3 context snapshot → V0.4 SSE+FE wiring → V0.5 tool calling+chips.
**v1 „megjegyez":** V1.1 fact tables+injection → V1.2 extraction+confirm UI → V1.3 never-ask-twice+advisors.
**v2 „emlékszik":** V2.1 pgvector infra → V2.2 summaries+embedding pipeline → V2.3 similar-days retrieval.
**v3 „észrevesz":** V3.1 statistical patterns+inbox → V3.2 hypothesis loop → V3.3 promotion.

After v0 the feature is already daily-usable; v1–v3 deepen it. Living doc born at V0.2:
`docs/features/companion.md` (brain) + updates to `docs/features/insights.md` (ChatPage surface).
