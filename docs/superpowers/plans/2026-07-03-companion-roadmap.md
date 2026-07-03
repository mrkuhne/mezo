# Companion Roadmap — Phase 3 chat & AI memory, phased master plan (V0.1–V3.3)

> **What this is.** The single durable map for building the **Phase 3 AI brain** — the context-aware
> companion chat — in 14 session-sized slices across 4 value stages. It is a *roadmap of slices*, not an
> implementation plan: each slice gets its OWN detailed plan (and, where marked, a dated `specs/` ADR/design
> doc) in the session that builds it. Track live state in **bd** (epic `mezo-fnnq`, one child per slice);
> read THIS for the why/scope/dependencies of each slice. Design spec (read FIRST, it replaces the old docs):
> [`../specs/2026-07-03-phase3-companion-chat-design.md`](../specs/2026-07-03-phase3-companion-chat-design.md).
>
> **How to carry it forward in a fresh session (the handoff contract):**
> ```
> Olvasd el docs/superpowers/specs/2026-07-03-phase3-companion-chat-design.md-t
> és docs/superpowers/plans/2026-07-03-companion-roadmap.md §<SLICE>-t
> (+ docs/features/companion.md-t, ha már létezik), aztán bd show <bd-id>,
> claim, implementáld. Végén: kapuk zölden, feature-doc frissítés, push, close.
> ```
> `bd ready` shows the next unblocked slice. Do NOT feed the old Supabase-era docs
> (`docs/old docs/`) into slice sessions — the spec distills them; link into them only where a brief points at a section.

**Driving principles (decided 2026-07-03):**

- **Pain-first ordering** — v0 kills the "explain everything again" pain with ZERO vector infra
  (deterministic snapshot + tools). RAG (v2) and patterns (v3) are additive layers, not prerequisites.
- **Deterministic-first, LLM at the edges** — snapshot assembly, fact injection, retrieval ranking,
  statistical patterns are pure code, tested without any LLM. The LLM sits behind a port
  (`CompanionLlm`); ITs use a profile-gated fake implementation, never the network.
- **Session-sized slices** — the proven Fuel-P size: ~2-3 tables + 1 contract fragment + 1 service +
  FE hook/wiring, gates green at the end. If a slice needs two branches, split it.
- **Switch-gated** — everything behind `mezo.feature.companion.enabled`; the app is fully usable with it off.
- **V0.1 gates everything** — no slice starts before the provider/version ADR lands.

**Where we are (2026-07-03).** Phase 2 L0 data is live: train (meso/workout/sport/run + schedules),
fuel (meal/water/protocol/intake), goal (+prescription+day-planner fields), medication (derived retaDay),
biometrics (weight/sleep/check-in profile). FE has a **mock** ChatPage under Insights whose message
contract (text + `tools[]` chips + `refs[]`) is already the target shape (`frontend/src/data/insights/chat.ts`).
No `feature/companion` backend package, no AI tables, no pgvector extension yet.

---

## Slice brief format

**Goal · Builds · Out/deferred · Backend · FE · Depends on · Size · Open decisions · bd.**
Sizes S/M/L relative to the shipped Fuel P-slices. Every slice implicitly includes: contract-first
(`api/feature/companion/companion.yml`), Liquibase migration named `{ts}_{bd-id}_{desc}.sql`, ITs
(populators + `ResetDatabase` TRUNCATE for new tables), dual-mode FE gates, feature-doc update, lint-docs.

---

## V0 — „lát engem" (usable chat that already knows the day)

### V0.1 — ADR: Spring AI + provider; skeleton behind a switch

**Goal:** de-risk the stack — pick the Spring AI line compatible with Boot 4, pick the chat provider + model tiers, prove a hello-world round-trip.
**Builds:** ADR in `docs/decisions/` (Spring AI version; provider Gemini vs Anthropic vs OpenAI — cost/latency/Hungarian quality/tool-calling maturity; model tiers cheap-vs-smart; API-key env strategy for local + k3s). `mezo.feature.companion.enabled` switch + `CompanionProperties` (`@Validated`, under `mezo.companion.*`). `CompanionLlm` port interface + real adapter + profile-gated deterministic fake. One switch-gated hello endpoint or smoke IT proving the adapter streams.
**Out/deferred:** all domain tables; any prompt engineering.
**Backend:** `feature/companion/` package born; `techcore` untouched. Dependency additions to `pom.xml` (Spring AI BOM).
**FE:** none.
**Depends on:** nothing. **Size:** S/M. **Open decisions:** THE ADR (this slice exists to close it); secrets delivery on k3s (Secret manifest) — coordinate with `docs/infrastructure/`.
**bd:** `mezo-fnnq.1`.

### V0.2 — Conversations + sync chat endpoint (persistence spine)

**Goal:** a persisted conversation with a non-streamed LLM answer — the API spine everything else hangs on.
**Builds:** `ai_conversation` + `ai_message` tables (UUID, `created_by`, soft-delete; `tool_calls`/`refs` typed jsonb envelopes — empty for now). New contract fragment `api/feature/companion/companion.yml`: `GET/POST /api/companion/conversation`, `GET .../{id}/messages`, `POST .../{id}/message` (sync JSON response v0). `ConversationService` + `ChatService` (static Hungarian companion-voice system prompt; calls `CompanionLlm`). History windowing (last N turns) into the prompt.
**Out/deferred:** context snapshot (V0.3), streaming (V0.4), tools (V0.5).
**Backend:** entities/repos/services/controller per house layout; `AiConversationPopulator`/`AiMessagePopulator`; ITs against the fake LLM asserting persistence + prompt assembly.
**FE:** none yet (mock ChatPage untouched).
**Depends on:** V0.1. **Size:** M. **Open decisions:** message-window size config; conversation auto-titling (defer — title = first user message truncated).
**bd:** `mezo-fnnq.2`. **Living doc `docs/features/companion.md` is born in this slice.**

### V0.3 — ContextSnapshotAssembler (the pain-killer)

**Goal:** the chat's first message already knows today: goal, meso-week, schedule, fuel-day, retaDay, sleep, weight trend.
**Builds:** `ContextSnapshotAssembler` in `feature/companion` — read-only composition of EXISTING services (goal + prescription current week + day-planner fields; active meso + week; gym/sport schedule; last-7d train/sport/run digest; FuelDay rollup + protocol + today's intakes; `MedicationCycleService` retaDay/phase; last-night sleep; latest check-in; weight 7/14d trend). Deterministic Hungarian-labelled text block, stable ordering, explicit "nincs adat" for gaps, ~2–4k token budget. Injected into the `ChatService` system prompt.
**Out/deferred:** knowledge facts (v1), similar-days recall (v2).
**Backend:** pure service + unit/IT tests over populator-seeded data asserting the rendered block (no LLM in the loop). Config: snapshot windows (`mezo.companion.snapshot.*`).
**FE:** none.
**Depends on:** V0.2. **Size:** M/L (the cross-feature read surface is wide but each read exists). **Open decisions:** exact block ordering + token budget split; whether check-in text is included verbatim or summarized.
**bd:** `mezo-fnnq.3`. **Coupling rule:** companion → other features only; never the reverse.

### V0.4 — SSE streaming + FE ChatPage goes real

**Goal:** the chat is usable on the phone — streamed answers in the existing ChatPage, dual-mode.
**Builds:** streaming variant of the message endpoint (SSE, token deltas + terminal done event); FE `useChat`/`useChatActions` dual-mode hooks (`data/insights/` — mock keeps the seeded conversation; real streams + invalidates); ChatPage wired (send, stream-render, history load); honest degraded state when the switch is off / AI unavailable (IDENT-3: no dead-ends).
**Out/deferred:** tool-chip rendering from real data (V0.5 — mock chips stay until then).
**Backend:** SSE endpoint (`SseEmitter`/Flux) — **precedent decision in-slice:** how streaming lives in the contract-first flow (document `text/event-stream` in the fragment vs a documented hand-written endpoint beside generated ones). Record the choice in the slice notes + `_platform-api-backend.md`.
**FE:** streaming sits outside `useDualQuery` (mutation + incremental append); keep hook signatures stable.
**Depends on:** V0.2 (endpoint spine); pairs naturally after V0.3 so the first streamed answer is already context-aware. **Size:** L. **Open decisions:** SSE contract precedent; retry/timeout UX.
**bd:** `mezo-fnnq.4`.

### V0.5 — Tool calling + tool-chips (aggregation depth)

**Goal:** history/aggregate questions get real answers ("mennyi fehérje volt az átlag 2 hétre?") and the FE chips stop being theater.
**Builds:** first tool batch on `CompanionLlm`/ChatClient — `get_recent_workouts(days)`, `get_sport_sessions(days)`, `get_weight_trend(weeks)`, `get_recent_meals(days)`, `get_sleep(days)`, `get_protocol_adherence(days)`, `get_goal_progress()`, `get_reta_cycle()` — all read-only wrappers over existing services, ownership-scoped, per-turn call cap. Tool-call log persisted into `ai_message.tool_calls` (typed envelope) + `refs`; FE maps them to the existing `ChatMessage` `tools[]`/`refs[]` chips.
**Out/deferred:** compute/write tools (v3); `find_similar_past_days` (V2.3); `get_knowledge_facts` (v1).
**Backend:** tool registry module with the IDENT-2 structural rule (no outward-acting tool, ever); ITs with the fake LLM scripted to call tools, asserting the audit log.
**FE:** chip rendering from real `tool_calls` (shape already in the mock).
**Depends on:** V0.3, V0.4. **Size:** L. **Open decisions:** tool result token budgeting; per-turn call cap value.
**bd:** `mezo-fnnq.5`. **v0 exit criterion: Daniel asks "mit egyek ma edzés előtt?" on the phone and gets a grounded, streamed, chip-annotated answer with zero explaining.**

---

## V1 — „megjegyez" (facts + never-ask-twice)

### V1.1 — knowledge_fact / learned_fact + prompt injection

**Goal:** confirmed facts persist and every chat turn silently knows them.
**Builds:** `knowledge_fact` (fact_text, category, source, reinforcement_count, `include_in_prompt`, last_reinforced_at) + `learned_fact` (candidate → decision → promoted_fact_id) tables; CRUD contract (`GET/POST/PATCH /api/companion/fact`, list + toggle); top-N (by reinforcement) injection block in the system prompt (config `mezo.companion.facts.top-n`).
**Out/deferred:** extraction (V1.2); UI (V1.2); redundancy guard (V1.3).
**Backend:** entities/repos/service/controller + populators + ITs (injection block asserted via fake LLM prompt capture).
**FE:** none yet.
**Depends on:** V0.3. **Size:** M. **Open decisions:** category enum v1 (train/fuel/health/life is enough); manual fact-add path now or later.
**bd:** `mezo-fnnq.6`.

### V1.2 — Fact extraction + confirm UI (L2 surface)

**Goal:** the chat proposes what it learned; Daniel confirms with one tap; confirmed facts start flowing into prompts.
**Builds:** post-turn async extraction (LLM behind the port, structured output → `learned_fact` candidates; dedupe against existing facts); `KnowledgeListPage` goes real dual-mode — pending candidates (accept/refine/reject) + confirmed fact list + `include_in_prompt` toggle. Decision layering: confirm is an explicit L2 card, never silent.
**Out/deferred:** pattern-sourced facts (V3.3).
**Backend:** extraction service + endpoints (`POST /api/companion/fact/{id}/decision`); cadence decision in-slice (per-turn async vs daily batch — start per-turn async, config-gated).
**FE:** `useKnowledge`/`useKnowledgeActions` dual-mode; KnowledgeListPage wiring (page exists, mock).
**Depends on:** V1.1. **Size:** L. **Open decisions:** extraction prompt scope (facts only from user turns vs both); dedupe similarity heuristic (string-level v1, embedding-level after V2.1).
**bd:** `mezo-fnnq.7`.

### V1.3 — Never-ask-twice + advisor chain v1

**Goal:** the companion stops re-asking known things and starts self-checking its answers.
**Builds:** redundancy guard — post-response check against confirmed facts (the old docs' `redundancyCheck`, as a Spring AI Advisor); grounding-lite advisor (claims must cite snapshot block / tool result / fact — reject + one retry on violation, degraded-flag on second failure, per old docs §4.5 retry semantics); clinical hard rule graduates from prompt-only to a lightweight output check (Rx dose-change block).
**Out/deferred:** full EvidenceCheck with per-claim entity citations + numericGroundingCheck (needs cheap classifier tier — revisit after cost data).
**Backend:** advisor implementations + ITs with scripted fake-LLM violations asserting retry/degrade path.
**FE:** degraded-flag rendering on messages (subtle, honest).
**Depends on:** V1.2. **Size:** M. **Open decisions:** which advisors are worth their latency (measure!); retry budget.
**bd:** `mezo-fnnq.8`.

---

## V2 — „emlékszik" (episodic RAG)

### V2.1 — pgvector infra + embedding port

**Goal:** the vector layer exists everywhere the app runs.
**Builds:** pgvector extension in BOTH environments — local compose image swap (`pgvector/pgvector:pg16`, initdb note: existing volumes need `docker compose down -v` once) + k3s Postgres image/extension (coordinate `docs/infrastructure/deployment-k3s-argocd.md` + runbook update); Liquibase `CREATE EXTENSION vector` + `memory_embedding` table (`vector(768)`, HNSW, cosine); `EmbeddingPort` interface + provider adapter (re-validate the 768-dim decision against the V0.1 provider — the surviving invariant is `vector(768)`+HNSW+cosine; L2-normalize if the provider doesn't) + fake for tests.
**Out/deferred:** anything that writes embeddings (V2.2).
**Backend:** infra + entity/repo + a similarity-query repository method (`<=>` cosine) proven by IT with hand-seeded vectors (no embedding provider in tests).
**FE:** none.
**Depends on:** V0.2. **Size:** M (infra-heavy). **Open decisions:** embedding provider (ADR-let inside the slice if it diverges from chat provider); Testcontainers image swap for `use-testcontainers=true` mode.
**bd:** `mezo-fnnq.9`.

### V2.2 — Daily summaries + embedding pipeline

**Goal:** the narrative memory fills itself daily.
**Builds:** `daily_summary` table + nightly `@Scheduled` generator (LLM digest of the day's L0 — the same blocks the snapshot reads, past-tense narrative HU); embed pipeline: daily summaries + chat turns → `memory_embedding` (kind, ref_id, occurred_on); backfill command for existing history (recent N days).
**Out/deferred:** weekly summaries; embedding check-in free text (privacy think-through first).
**Backend:** scheduler (guard: idempotent per date), generator service (port-backed), embed writer; ITs: scheduler idempotence + writer with fake embedder.
**FE:** none.
**Depends on:** V2.1. **Size:** M/L. **Open decisions:** summary prompt shape; retention (keep all — single user, ~11MB/year per old docs est.); embed user turns only vs both.
**bd:** `mezo-fnnq.10`.

### V2.3 — Similar-days recall in chat

**Goal:** "volt már ilyen napod?" — the companion recalls thematically similar past episodes, time-aware.
**Builds:** `find_similar_past_days(description, k)` tool — embed the query, cosine top-k × recency decay (rank = similarity × exp(-age/τ), τ config), kind-filtered; results injected as tool output with dates + digests; chips show the recalled refs.
**Out/deferred:** auto-recall on every turn (old docs L1 always-on rule) — start tool-only, promote to always-on if it earns it.
**Backend:** retrieval service (pure ranking logic unit-tested with seeded vectors) + tool registration.
**FE:** none beyond existing chips.
**Depends on:** V2.2, V0.5. **Size:** M. **Open decisions:** τ (decay) default; auto-recall promotion criteria.
**bd:** `mezo-fnnq.11`.

---

## V3 — „észrevesz" (pattern engine)

### V3.1 — Statistical patterns + Inbox

**Goal:** the system surfaces real correlations from Daniel's own data; he judges them.
**Builds:** nightly `@Scheduled` correlation job over configured metric pairs (sleep↔next-day RPE, late-meal↔sleep quality, Reta-day↔kcal, sport-load↔gym volume…), Pearson r + n + p persisted as `pattern` rows (`kind=statistical`, honest small-n confidence= null); `pattern` table + Inbox contract (`GET /api/companion/pattern`, `POST .../{id}/decision` confirm/monitor/reject); `PatternsPage` goes real dual-mode (page + PatternCard exist, mock).
**Out/deferred:** LLM hypotheses (V3.2); promotion (V3.3).
**Backend:** correlation service (pure math, unit-tested against fixture series), scheduler, controller; populators + ITs.
**FE:** `usePatterns`/`usePatternActions` dual-mode; PatternCard wiring (Confirm/Monitor/Reject = L2 surface).
**Depends on:** V0.1 (conventions/switch only — independent of chat runtime). **Size:** L. **Open decisions:** metric-pair catalog v1 (start ~8-10 pairs, config-listed); minimum-n gate before a pattern may surface.
**bd:** `mezo-fnnq.12`.

### V3.2 — AI hypothesis loop (propose → critique → revise)

**Goal:** the engine goes beyond pairwise stats — mechanism-level hypotheses that survive self-critique.
**Builds:** weekly `@Scheduled` pipeline (LLM behind the port): gather weekly digest + confirmed facts → propose hypotheses (structured output) → critique with the old docs' 4-factor scoring (0.35 statistical support · 0.25 confounders · 0.20 fact-alignment · 0.20 actionability; keep ≥0.75 / revise ≥0.50 once / discard — arch §4.7) → persist survivors as `pattern` rows (`kind=ai_hypothesis`, critique jsonb attached, confidence from score).
**Out/deferred:** CausalChain multi-step entities (later epic); drift detection (later).
**Backend:** pipeline service — each stage a pure function around one LLM call (old NFR-M-4 rule: a node is pure-compute or pure-LLM, never both); ITs with scripted fake-LLM outputs asserting scoring/threshold routing.
**FE:** PatternCard already renders mechanism + critique fields (mock shape) — map real critique jsonb.
**Depends on:** V3.1. **Size:** L. **Open decisions:** weekly cadence day; max hypotheses/run; Pro-tier vs cheap-tier model for critique.
**bd:** `mezo-fnnq.13`.

### V3.3 — Pattern → knowledge promotion + reinforcement

**Goal:** the learning loop closes: confirmed patterns become durable facts the chat cites.
**Builds:** confirm-decision promotes `pattern` → `knowledge_fact` (source=`pattern`, link back); recurrence reinforcement (`reinforcement_count++` when the nightly job re-detects a confirmed pattern); in-chat acknowledgment ("ezt megtanultam rólad" — the companion references newly promoted facts on next conversation open); Insights Knowledge tab shows pattern-sourced facts with their evidence link.
**Out/deferred:** System-Disclosure mode (the "megmutassam a számítást?" reveal — nice-to-have later); memoir surfaces.
**Backend:** promotion service + reinforcement hook in the correlation job; ITs.
**FE:** KnowledgeListPage evidence-link rendering; small.
**Depends on:** V3.1, V1.1. **Size:** M. **Open decisions:** whether monitor-state patterns reinforce silently.
**bd:** `mezo-fnnq.14`.

---

## Dependency graph (quick reference)

```
V0.1 ─► V0.2 ─┬─► V0.3 ─┬─► V0.5 ─────────► V2.3
              │         ├─► V1.1 ─► V1.2 ─► V1.3
              ├─► V0.4 ─┘   │
              └─► V2.1 ─► V2.2 ─► V2.3
V0.1 ─► V3.1 ─► V3.2
V3.1 + V1.1 ─► V3.3
```

Parallel-friendly: after V0.3 the v1 track and the V2.1 infra can interleave with V0.4/V0.5;
V3.1 is independent of the chat runtime entirely.

## Relationship to other roadmaps

- **Fuel P8 (`mezo-0h6w`)** — meal-score prose, AI replan, stack recommendations, learned timing — layers
  ON TOP of this epic (needs the port/provider from V0.1, embeddings from V2.x, patterns from V3.x).
  `mezo-0h6w` carries a cross-reference note to `mezo-fnnq` (bd blocks epic↔epic deps).
- **Fuel P7 (meal-scoring deterministic v0, `mezo-yta`)** — independent; ship any time. Its prose layer is P8.
- **Goal-system Phase-3 anchor (`mezo-2hp`)** — adaptive TDEE learning belongs to the pattern-engine
  family (v3-adjacent); file its slice when v3 lands.
- **Old docs' proactive layer** (briefing, heartbeat, memoir, AnchorMode, crisis) — NOT in this epic;
  next epic after v1, reusing the snapshot (V0.3) + facts (v1) + summaries (V2.2).

## Per-slice execution checklist (when you start a V#)

1. `bd update <slice-id> --claim`; read the spec + this roadmap §slice (+ `docs/features/companion.md` if born). Where the brief says ADR/design-decision → write the dated `docs/decisions/` or `specs/` artifact first. For L-sized slices, write a dated `docs/superpowers/plans/` implementation plan (superpowers:writing-plans) before code.
2. Contract-first: edit `api/feature/companion/companion.yml` BEFORE code; merge (`api/generate`); regen FE (`pnpm generate:api`) + BE types.
3. TDD per `docs/references/` house rules: integration-first, populators, `ResetDatabase` TRUNCATE for new tables, AssertJ; **LLM/embedding always behind the port with the profile-gated fake — no network in tests, no live-LLM assertions**.
4. Dual-mode FE where the slice touches hooks: `isMockMode()` branch, signatures stable, both modes green + `pnpm build`.
5. Update `docs/features/companion.md` (+ `insights.md` if the ChatPage surface changed) + `docs/milestones/roadmap.md` milestone row; `node scripts/lint-docs.mjs`.
6. One bd issue + one `feat/companion-v##` branch; `--no-ff` merge (`git pull --rebase` BEFORE the merge, never after); `bd dolt push && git push`; close the slice issue with notes.
