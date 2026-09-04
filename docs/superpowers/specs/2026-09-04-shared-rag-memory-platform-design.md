# Shared RAG Memory Platform and Chat Pilot — Design

**Date:** 2026-09-04 · **Status:** approved

**Driver:** `mezo-6dii`

**Scope:** common long-term-memory retrieval platform inside Companion, introduced through a
measurable chat pilot before briefing, memoir and prediction consumers.

## 1. Problem and outcome

Mezo already has more than a simple vector search:

- deterministic structured context and SQL tools for current domain state;
- pgvector embeddings over ten narrative memory kinds;
- confirmed facts and a PostgreSQL-native knowledge graph;
- ambient recall with recency-aware ranking.

The missing capability is a single, measured retrieval platform. Today the paths are fragmented,
the main search is dense-only, chat embeds the raw current message without resolving follow-ups,
rank fusion and diversity are absent, embedding generations cannot safely coexist, and retrieval
quality has no representative benchmark. A framework swap alone would not solve these problems.

The outcome is one consumer-neutral memory service with explicit policies. Chat is the first
vertical slice and quality gate; morning briefing, weekly memoir and prediction evidence join only
after the chat pilot passes that gate. This is **a common platform with gradual integration**, not
separate RAG implementations per feature.

## 2. Decisions

1. Keep the platform under `feature/companion`; expose it through Mezo-owned interfaces.
2. Introduce a central `MemoryContextService`, parameterized by consumer policy.
3. Keep deterministic health snapshots and SQL tools outside long-term RAG. Source domain tables
   remain authoritative.
4. Retrieve in parallel from dense vectors, lexical search, confirmed facts and the knowledge
   graph; combine candidates with deterministic Reciprocal Rank Fusion (RRF).
5. Use an LLM reranker only for uncertain retrievals, explicit deep requests, and slower consumers.
6. Version the canonical retrieval projection and embeddings so old and new generations can coexist
   during backfill and shadow evaluation.
7. Validate semantic quality on a human-labelled, synthetic but realistic Hungarian corpus using
   real Gemini embeddings; keep ordinary CI deterministic and network-free.
8. Roll chat through `OLD` → `SHADOW` → `NEW`. Do not connect other consumers before the gate.
9. Record item-level feedback, but do not automatically train, rewrite, consolidate or forget
   memories during beta.
10. Do not introduce LangGraph now. Reconsider it only when Mezo has genuinely stateful,
    interruptible, resumable or human-approved multi-step agent workflows.

The architectural choice is recorded separately in
[`0036-shared-memory-platform-with-gradual-consumer-adoption.md`](../../decisions/0036-shared-memory-platform-with-gradual-consumer-adoption.md).

## 3. Boundaries and contracts

`MemoryContextService` is the sole consumer-facing entry point:

```text
MemoryRequest
  ├── userId
  ├── consumerPolicy
  ├── currentQuery
  ├── shortConversationHistory
  ├── asOf
  └── maxTokenBudget
          │
          ▼
MemoryContextService
  Query preparation
      → parallel retrievers
      → filtering
      → RRF + deterministic boosts
      → optional reranker
      → diversity + token-budget selection
      → rendering + audit
          │
          ▼
MemoryContext(items, promptBlock, refs, traceId)
```

Initial policies:

| Policy | Intended behavior |
|---|---|
| `CHAT_AMBIENT` | Low latency, small context, rerank only on uncertainty |
| `MORNING_BRIEFING` | Recent window plus high-salience older context; broader diversity |
| `WEEKLY_MEMOIR` | Longer time window and budget; reranking permitted by default |
| `PREDICTION_EVIDENCE` | Evidence-oriented selection with provenance and temporal validity |

Future profile and quarterly-summary policies may reuse the interface; they are not part of the
first implementation plan.

The service owns retrieval, ranking, selection, rendering and trace creation. It does not own:

- source-domain persistence;
- current-state metric calculations;
- SQL tool execution;
- chat orchestration or model response generation;
- automatic truth resolution between conflicting memories.

Spring AI's modular RAG primitives may be used behind internal ports where they reduce plumbing,
but consumers depend only on Mezo contracts. Migrating the custom schema to Spring AI's generic
`VectorStore` is not required.

## 4. Canonical memory model

### 4.1 `memory_item`

`memory_item` is the canonical retrieval projection, not a second source of truth:

- `id`, `created_by`;
- `source_kind`, `source_id`;
- `title`, `content`, `occurred_on`;
- `content_hash`, `schema_version`;
- `topics`, `people`, `salience`;
- `valid_from`, `valid_to`;
- `state`: `active`, `suppressed`, or `superseded`;
- `superseded_by`;
- typed JSON provenance;
- normal Mezo soft-delete fields.

The source row remains authoritative. Projection creation and refresh are idempotent on source
identity plus content hash. `suppressed` means the AI may no longer retrieve the item; it does not
delete the user's original journal, chat or domain record.

### 4.2 `memory_vector`

Vectors are stored separately from the canonical item:

- `memory_item_id`, `embedding_version`;
- provider, model, dimensions;
- embedding;
- `embedded_content_hash`;
- lifecycle status and timestamps.

The unique key is `(memory_item_id, embedding_version)`. A new model or embedding template writes a
new generation alongside the old one. Backfill is idempotent and resumable. Only a configured
serving version is read by the live path; another version may run in shadow until promoted.

The serving vector index remains PostgreSQL/pgvector HNSW cosine search. Its query must always
include ownership and active-state constraints.

### 4.3 Lexical projection

Each active `memory_item` also exposes normalized Hungarian search text through PostgreSQL full-text
search, with accent-insensitive normalization and trigram matching for names, dates, identifiers
and spelling variation. Lexical ranking is independent of vector similarity.

### 4.4 Facts and graph

Confirmed facts remain first-class data rather than flattened anonymous vector chunks. They gain
explicit validity, priority/pinned state, provenance, and `supersedes`/conflict links where needed.
Pinned active facts are always eligible; other facts must match the query. Expired and superseded
facts are excluded from ordinary serving but remain auditable. Contradictions are surfaced together
when unresolved; the platform never silently overwrites one with another.

The knowledge graph remains its own store and retriever. It supplies related people, topics and
events as candidates; graph traversal is not treated as vector similarity.

Raw health measurements are not duplicated into `memory_item`. They stay in domain tables and are
accessed through deterministic snapshots, metric services and tools.

## 5. Query preparation

A deterministic `QueryAnalyzer` selects exactly one mode:

- `NO_MEMORY_NEEDED`: the turn does not need personal memory;
- `SELF_CONTAINED`: the current message is an adequate query;
- `CONTEXT_DEPENDENT`: pronouns, ellipsis or follow-up language require short-history resolution.

Only `CONTEXT_DEPENDENT` invokes a query rewrite. The rewrite converts the current turn and bounded
recent history into one standalone search query. The original query is retained for lexical search;
the rewritten query drives dense search. A rewrite timeout, parse failure or empty result falls back
to the original query. No additional classifier LLM call runs on every message.

Example:

```text
Previous turn: "A keddi 10 km-es futásom gyengén ment."
Current turn:  "És előtte hogy aludtam?"
Dense query:   "Hogyan aludtam a keddi 10 km-es futás előtti éjszakán?"
Lexical query: "És előtte hogy aludtam?"
```

`NO_MEMORY_NEEDED` bypasses all memory retrievers and emits an auditable empty context.

## 6. Retrieval, fusion and selection

### 6.1 Parallel candidate generation

For a memory-bearing query, four independently testable retrievers run concurrently:

1. dense embedding search;
2. lexical full-text/trigram search;
3. confirmed-fact retrieval;
4. knowledge-graph retrieval.

Each returns ranked candidates plus provenance and retriever-local evidence. Initial candidate depth
is configurable per policy; the chat default is 30 per retriever. A partial retriever failure does
not cancel successful peers.

### 6.2 Hard filtering

Before ranking, exclude:

- any row not owned by `request.userId`;
- soft-deleted, suppressed, expired or superseded items;
- source kinds forbidden by the consumer policy;
- information after `request.asOf` for historical queries;
- vector rows not matching the configured serving embedding version.

Ownership must be enforced in each repository query. Post-retrieval filtering is defense in depth,
not the primary security boundary.

### 6.3 Deterministic fusion

Retriever result lists are combined with weighted RRF. The initial RRF constant is 60; candidate
depth, retriever weights and deterministic boosts are validated configuration under `mezo:`.
Rank-based fusion is used because dense, lexical, fact and graph scores do not share a calibrated
numeric scale.

The fused score may receive bounded, explainable modifiers for:

- temporal fit to an explicit query window;
- confirmed or pinned status;
- source reliability;
- salience;
- consumer-policy preference;
- mild recency.

Recency can break close ties but cannot displace an older exact match solely because it is old. Every
score component is included in the retrieval trace.

### 6.4 Optional reranking

A reranker is invoked only when policy allows it and at least one condition holds:

- leading candidates are within the configured uncertainty margin;
- dense and lexical rankings strongly disagree;
- unresolved conflicting facts are present;
- the request explicitly uses deep mode;
- the consumer is a slower synthesis path such as memoir.

On timeout or failure, deterministic fused order is served. Ordinary chat must not depend on the
reranker for availability or the p95 latency target.

### 6.5 Diversity and context construction

Selection applies near-duplicate removal, a per-source-conversation cap, policy-specific source and
time diversity, and the exact token budget. Unresolved conflicts are kept together. Chat normally
receives 3–8 complete, compact memory items rather than the current first-line rendering.

`MemoryContext` includes structured items and a rendered prompt block. Stable item references allow
the answer UI and feedback path to identify exactly which memories were supplied.

## 7. Audit and user control

`memory_retrieval_run` records:

- user and consumer policy;
- `NONE`, `RAW` or `REWRITE` mode;
- raw and rewritten query, subject to audit retention rules;
- serving and shadow embedding versions;
- retriever timing, candidate counts and errors;
- selected item references and explainable score components;
- `OLD`, `SHADOW` or `NEW` serving mode;
- total retrieval latency and trace ID.

`memory_retrieval_feedback` records run ID, memory item ID and one of:

- useful;
- irrelevant;
- suppress.

The beta UI shows source/date and an old, superseded or summary indicator where relevant. Each used
memory offers **Hasznos**, **Nem ide tartozik**, and **Ne használd többé**. Suppression takes effect
immediately in retrieval. Feedback is analysis data during beta and does not automatically alter
ranking weights.

The first release does not include a full memory editor or bulk-deletion interface.

## 8. Evaluation corpus and metrics

### 8.1 Corpus

Because beta has no production corpus, evaluation uses fully synthetic but coherent Hungarian life
histories for three isolated users:

1. a richly logging user;
2. a sparsely logging user;
3. a user whose circumstances and stated facts contradict or change over time.

The generator produces timelines first, then source records and queries from hidden scenario facts.
The final relevance labels are human-reviewed, not accepted directly from the generator. Cases
include paraphrases, ambiguous follow-ups, exact names/dates/numbers, negation, old-but-important
memories, adversarial near-negatives, superseded facts, cross-user distractors and questions that
correctly require no memory.

The corpus is split by scenario, never by individual query, into development, tuning and a sealed
holdout set. Related variants of one story cannot cross splits. The first release gate uses at least
300 holdout queries, at least 100 per persona. The holdout is versioned and may be opened for final
measurement, but failures are fixed against development/tuning cases or a newly versioned holdout;
the same holdout is not repeatedly tuned against.

### 8.2 Baseline and metric definitions

The frozen baseline is the current dense-only `MemoryEmbeddingAnnQuery` path with its current
recency adjustment and prompt rendering. Both baseline and candidate run against identical source
data and queries.

Human labels use graded relevance: `0 = irrelevant`, `1 = useful supporting context`,
`2 = directly required`. Metrics are macro-averaged over eligible holdout queries:

- **Recall@5:** relevant gold items retrieved in the first five divided by all relevant gold items;
- **nDCG@5:** graded ranking quality using the 0/1/2 labels;
- **MRR:** reciprocal rank of the first directly required item, or first useful item when no
  grade-2 item exists;
- **context precision:** selected relevant items divided by all items placed in the final prompt;
- **empty-query false-positive rate:** no-memory queries that nevertheless receive memory context.

### 8.3 Chat progression gate

The candidate may progress from chat pilot toward briefing and memoir only when the sealed holdout
shows all of the following:

- Recall@5 is at least 85%;
- nDCG@5 and MRR are both higher than the frozen baseline;
- context precision is at least 10 percentage points higher than baseline;
- ownership leakage is exactly zero across all deterministic and semantic cases;
- empty-query false-positive rate is at most 5%;
- p95 retrieval latency is at most 250 ms on the normal chat path without rewrite or reranking;
- embedding and reranking cost are recorded and remain within configured release budgets.

The first three thresholds are computed on the same sealed corpus. A corpus report includes per-
persona and per-case-family breakdowns so one easy persona cannot hide a failure on sparse or
contradictory histories.

The latency clock starts before query embedding and ends when `MemoryContext` is complete, so it
includes the embedding provider call, database retrieval, fusion and selection. Rewrite and
reranker paths are reported separately because they are conditional. If the real-provider holdout
cannot meet 250 ms, the platform does not silently redefine the metric; the release report must
show the miss and the product owner must explicitly revise the gate or the serving design.

### 8.4 Two test tiers

Normal CI is deterministic and network-free. It tests routing, ownership, filtering, RRF, tie
breaks, version isolation, diversity, token budgets, fallbacks and audit behavior with controlled
vectors and fixtures.

A separate manual/release suite calls the real Gemini embedding service and evaluates the sealed
semantic corpus. It writes a versioned report containing model/version, corpus version, metrics,
latency, cost and baseline delta. It is the semantic release gate; it does not run on every commit.

## 9. Rollout

Chat receives three configured modes:

- `OLD`: only the current retrieval result serves the answer;
- `SHADOW`: old retrieval serves, while the new pipeline runs and is compared asynchronously;
- `NEW`: the new pipeline serves, with controlled fallback to the old path or empty memory.

Rollout order:

```text
deterministic CI
  → offline semantic eval
  → internal shadow
  → small beta cohort
  → full chat
  → quality-gate review
  → morning briefing
  → weekly memoir
  → prediction evidence
```

Shadow comparison records overlap, relevance proxies, source mix, latency, failures, embedding cost
and feedback, but never changes the user's answer. Production beta feedback is a safety and tuning
signal, not a substitute for the hard offline gate while user volume is low.

Each later consumer gets its own policy, token budget, time window, diversity and reranker settings;
it does not fork the retrieval engine.

## 10. Failure handling and privacy

- Embedding failure degrades to lexical, facts and graph retrieval.
- Rewrite failure uses the raw query.
- Reranker failure uses deterministic fused order.
- Total retrieval failure produces an empty `MemoryContext`; chat and scheduled synthesis continue.
- A single retriever failure is isolated and auditable.
- Provenance and uncertainty accompany context; retrieved text is never promoted to confirmed fact.
- Full prompts and model answers are not copied into retrieval traces.
- Trace access is restricted and trace/query retention is configurable.
- `suppress` excludes an item immediately while preserving its source record where domain retention
  requires it.
- Re-embedding jobs are idempotent, resumable and limited to the target user/item/version.
- No automatic deletion, forgetting, consolidation or conflict resolution occurs during beta.

## 11. Delivery slices

### A. Platform foundation

- `memory_item` and versioned `memory_vector` schema;
- projection/backfill lifecycle;
- service and retriever contracts;
- consumer policies, configuration, audit and feature flags.

### B. Chat pilot

- adaptive query preparation;
- dense, lexical, fact and graph retrievers;
- filtering, RRF, uncertainty detection, diversity and token budgeting;
- `OLD`/`SHADOW`/`NEW` wiring;
- source display and minimal feedback controls.

### C. Quality gate

- synthetic corpus generator and versioned fixtures;
- deterministic CI evals;
- real-Gemini release eval and baseline report;
- explicit promotion decision using §8.3.

### D. Consumer adoption

After the gate, integrate briefing, memoir and prediction evidence one consumer at a time. Each
integration is a separate Beads issue/implementation slice and must add policy-specific eval cases.

The first implementation plan covers slices A–C: platform foundation, chat pilot and its quality
gate. Slice D is deliberately outside that plan because its work may start only after measured gate
results exist. Each additional consumer receives its own bounded design/plan based on those results.

## 12. Explicitly deferred

- LangGraph or a separate Python orchestration service;
- learned ranking from feedback;
- automatic memory consolidation, decay or forgetting;
- automatic LLM-driven salience mutation;
- silent fact overwrite or autonomous conflict resolution;
- mandatory reranking on every chat turn;
- full memory administration and bulk deletion UI;
- copying structured health telemetry into the vector store;
- connecting briefing, memoir or prediction before the chat gate passes.

## 13. Research basis

- [Spring AI modular RAG](https://docs.spring.io/spring-ai/reference/api/retrieval-augmented-generation.html)
  supports separable query transformation, retrieval and post-processing stages, which fit behind
  Mezo-owned interfaces.
- [Spring AI evaluation](https://docs.spring.io/spring-ai/reference/api/testing.html) provides
  evaluator primitives, but Mezo still needs retrieval-specific ranking metrics and its own corpus.
- [pgvector iterative index scans](https://github.com/pgvector/pgvector) support filtered HNSW
  retrieval; Mezo's existing strict-order setting remains valid.
- [Gemini embeddings](https://ai.google.dev/api/embeddings) remain behind the existing
  `EmbeddingPort`; provider details must not leak into platform consumers.
- [LangGraph](https://github.com/langchain-ai/langgraph) is aimed at controllable, stateful agent
  workflows. That is a future orchestration need, not a prerequisite for hybrid retrieval.

## 14. Acceptance criteria

The design is ready for implementation planning when:

- the written spec is explicitly approved;
- platform and source-of-truth boundaries are unambiguous;
- metric definitions and the chat progression gate are reproducible;
- every rollout mode has a defined serving/fallback behavior;
- deferred automation and LangGraph scope are explicit;
- implementation can be decomposed into small, independently verifiable slices without inventing
  new architectural decisions.
