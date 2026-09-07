# RAG memory explorer — design spec (mezo-4qyt)

- **Issue:** mezo-4qyt · **Date:** 2026-09-06 · **Round:** superpowers:brainstorming + brainstorm-recon
- **Depends on:** admin hub (mezo-d5iy, `2026-09-06-admin-hub-design.md`) — the explorer is
  launched from `/admin/users/:id` and reuses `AdminLayout`, the `feature/admin` slice and the
  data browser for source drill-through.
- **Prototype (to be drawn in slice 3):** `docs/design_2.0/prototypes/admin-memory.html`
- **Series:** part 2 of the admin/observability platform (admin hub → **RAG explorer** → infra
  observability → feature telemetry).

## Problem

The companion's long-term memory is a hybrid RAG system (dense + lexical + knowledge-graph +
fact retrieval, weighted RRF fusion, optional LLM reranking) over pgvector, with a knowledge
graph of typed nodes and weighted, evidence-carrying edges, and a layered lifecycle (L0–L3).
Today the owner can inspect only their own memory, only through the user-facing Memória page,
and cannot answer the questions that matter during the beta: *why did the companion recall this
for user X?*, *what does X's knowledge graph look like?*, *where do X's memories cluster?*,
*is X's vector store healthy?* — without opening pgAdmin.

## Product decisions (Daniel, 2026-09-06)

1. **Priority:** retrieval explanation (A) and structure exploration (B) are equally primary;
   layer health (C) is supporting. Entry view: Futások (A).
2. **Replay:** both past runs (audit tables) and a live **dry-run** replay. The replay runs the
   NEW-mode pipeline, writes no audit rows, does not touch the user's memory, has reranker and
   query-rewrite toggles (cost), and is labelled honestly: it shows *what NEW mode would return*,
   not what the SHADOW-mode companion actually served.
3. **Embedding map is in v1**, not deferred: server-side PCA to 50 dims, client-side `umap-js` in a
   Web Worker, real neighbours from pgvector.
4. **Backend shape — approach A:** a dedicated `AdminMemoryApi` in the `feature/admin` slice with
   `userId` in the path, delegating to companion services and new companion-slice queries.
   Rejected B (adding `userId` to the user-facing companion endpoints): it would puncture the
   ownership rule on the most sensitive tables.
5. **Graph rendering — approach A:** `d3-force` for physics + hand-written SVG in the design 2.0
   language (the repo's existing style; no chart library today). Rejected `react-force-graph-2d`
   (own look, large bundle) and `sigma.js` (WebGL, oversized for hundreds of nodes).
6. **Read-only** apart from the replay, which is itself side-effect-free. No admin relevance
   labelling in v1 (follow-up).

## Architecture

```
/admin/users/:id/memory        sub-navigation: Futások (A) · Gráf (B) · Térkép (B) · Rétegek (C)
                               + a right-hand INSPECTOR panel shared by all views: the selected
                                 element (run candidate, node, edge, vector point) with source links
   │
   ▼
/api/admin/users/{userId}/memory/**    AdminMemoryApi (fragment api/feature/admin-memory/)
   │  first line of every controller method: currentUser.requireOwner()
   ▼
feature/admin · AdminMemoryService
   ├─ MemoryObservatoryService.overview(userId)       (companion, exists, takes userId)
   ├─ GraphService / GraphEdgeRepository               (companion, exists)
   ├─ NEW companion queries: run list, structured edges incl. deleted, vector list + PCA,
   │                         neighbours, health
   └─ MemoryContextService.retrieve(request, RetrieveOptions)   (companion, NEW overload)
```

Dependency direction `admin → companion`; companion never imports admin (ArchUnit
`feature_slices_are_cycle_free`). Every memory/graph bean is `@ConditionalOnProperty`; the
admin controller consumes them through `ObjectProvider` and answers 404 when a switch is off.

**Source tracing** ties the views together: any element exposes where it came from
(`memory_item.source_kind/source_id`, `knowledge_node.source_kind/source_id`, edge evidence
`{sourceKind, sourceId, note, at}`) and links into the admin hub's data browser row.

## Backend contract (`api/feature/admin-memory/admin-memory.yml`, tag `AdminMemory`)

All paths under `/api/admin/users/{userId}/memory`.

| Endpoint | Returns |
|---|---|
| `GET /runs?page=&size=` | `memory_retrieval_run` rows for the user, newest first: `id, createdAt, consumerPolicy, servingMode, queryMode, rawQuery, rewrittenQuery, candidateCount, durationMs, errorCode, retrieverTrace[]`. New finder `findByCreatedByOrderByCreatedAtDesc` (paged). Header carries the 30-day retention. |
| `GET /runs/{runId}` | run + candidates: per result `rank, selected, candidateKind, candidateRefId, memoryItemId, contentSnapshot, occurredOn, scoreBreakdown` (the stored `ScoreBreakdownEnvelope`: `retrieverRanks{dense,lexical,graph,facts}, rrf, pinnedBoost, sourceReliabilityBoost, temporalBoost, salienceBoost, recencyBoost, rerankerScore, finalScore`) + `fusionWeights` and `rrfK` from config so the client can draw contributions; `promptTrace` = the matching `ai_message.recalled_memories` items when they exist (NEW mode), else `null` with `reason` |
| `POST /replay` body `{query, reranker: bool, rewrite: bool}` | same shape as a run detail, `dryRun: true`, `servingMode: NEW`, plus `queryProjection` (the query vector in the PCA-50 space, for the map) |
| `GET /graph?includeArchived=&includeDeleted=` | `nodes[] {id, kind, title, summary, status, sourceKind, sourceId, occurredOn, meta, deleted}` and `edges[] {id, from, to, kind, weight, evidence[], lastReinforcedAt, createdAt, deleted}` — the first structured edge DTO in any contract |
| `GET /vectors?version=` | `items[] {itemId, sourceKind, occurredOn, salience, state, snippet}` + `projection` = base64 Float32 block of `n × 50` PCA coordinates + `sampled: bool`, `embeddingVersion` |
| `GET /vectors/{itemId}/neighbors?k=10` | pgvector cosine neighbours with real distance |
| `GET /health` | `memory_vector` by status and `failureCode`, embedding-version distribution, stale vectors (`embedded_content_hash ≠ content_hash`), `memory_item` by state, nodes by status, edge weight histogram (10 buckets), last nightly job timestamps |

### Replay: the one change inside the companion pipeline

`MemoryContextService.retrieve(request, RetrieveOptions)` where
`RetrieveOptions {audit: boolean, servingMode, reranker: boolean, rewrite: boolean}`; the existing
entry points delegate with defaults. With `audit=false` the `MemoryRetrievalAuditWriter` is
skipped and no `memory_retrieval_*` row is written. The admin service wraps the call in
`LlmActorContext.runAs(userId)` **and** `LlmCallContextHolder.runWith(LlmCallContext(feature=
"admin_replay", operation=...))`. Because `LlmActorResolver` prefers the JWT principal over
`runAs`, the resolver gains an explicit "actor override" that the admin path sets, so the
embedding / rewrite / rerank rows land on the inspected user's `created_by` with the
`admin_replay` feature — and therefore appear in the admin hub's cost matrix under that label.
`LlmMemoryQueryRewriter` and `LlmMemoryReranker` currently call the LLM without an explicit
`LlmCallContext`; the plan verifies their default labels before promising a per-run cost figure.

### PCA-50

Computed in the companion slice with a small power-iteration SVD (no new dependency) over the
user's ready, live, hash-matching vectors of the serving embedding version; cached in memory per
user, invalidated when the ready-vector count or the newest `updated_at` changes. Above 5 000
vectors the server samples (newest + highest salience first) and flags `sampled`.

## Frontend

### Routes and shell

`/admin/users/:id/memory` (+ `?view=runs|graph|map|layers&sel=<id>`), inside the admin lazy
chunk under `AdminLayout`. Sub-navigation as a segment bar; the inspector is a persistent right
column (collapsible). Deep links: a run candidate with `candidateKind=knowledge_edge` highlights
the edge on Gráf; a candidate with `memoryItemId` highlights the point on Térkép; both open the
same inspector entry.

### Futások (A)

- Run list table inside a tile: time, policy, **serving-mode badge** (SHADOW → "árnyékfutás,
  nem ezt látta a modell"), query mode, raw/rewritten query, candidate count, duration, error.
- Run detail (Elastic RRF explain × Azure sub-score table): one expandable row per candidate
  with a **stacked contribution bar** — one segment per source (`weight / (rrfK + rank)`),
  absent source shown as "–", then the boosts as separate segments, `finalScore`, reranker score
  and signed rank delta, and a "bekerült" flag from `selected`. Retriever trace (duration, count,
  error per retriever) as a small strip in the header.
- "Amit az LLM látott": rendered from `promptTrace` when present; otherwise the panel states that
  no prompt imprint exists for this run (the rendered block is not stored; SHADOW runs never
  reach the model).
- Replay: query box + toggles (reranker, rewrite) → the same detail view with a **DRY-RUN**
  badge and the mode caveat.

### Gráf (B)

`d3-force` simulation, SVG rendering: node = clay spot in the kind's colour, radius from degree,
edge width from weight, `CONFLICTS` dashed, `candidate` status faded, `archived`/deleted only with
the toggles. Kind filter chips, weight-threshold slider, title search. Layout runs once then
freezes; dragging moves locally. Inspector for a node: meta, source link, in/out edges; for an
edge: kind, weight, `lastReinforcedAt`, evidence rows each linking to their source, and a small
validity bar (created → last reinforced) that shows fresh vs decaying edges (nightly ×0.99 decay,
prune < 0.05).

### Térkép (B)

`umap-js` in a Web Worker (`nNeighbors 15`, `minDist 0.1`, vectors normalised for cosine),
rendered incrementally so the map unfolds; result cached per user in `sessionStorage`. SVG
scatter: colour by `sourceKind`, size by `salience`, `suppressed`/`superseded` hollow. Click →
inspector with content, source, and the 10 real neighbours (pgvector), highlighted on the map.
A replayed query is placed with `transform()` as a star and its candidates light up, so the
dense retriever's hits and misses are visible in one picture. Worker failure → fallback to the
first two PCA components.

### Rétegek (C)

`overview(userId)` reused unchanged + `/health`: StatCells and sparklines; every failed/stale
count links to the matching data-browser rows.

### Data layer

`frontend/src/data/admin/adminMemory{Api,Hooks,Mock}.ts`, types from `api.gen.ts`,
`useDualQuery` with `enabled: isOwner` and 404 → `degraded` (feature off), MSW handlers for every
path, worker module `frontend/src/features/admin/memory/umap.worker.ts`. New dependencies:
`d3-force`, `umap-js` (both small, no transitive UI).

## Error handling

- Companion or graph switch off → endpoint 404 → view shows a "ki van kapcsolva" tile; other
  views keep working.
- Replay: embedding-provider failure or the 200 ms retriever deadline surfaces in the retriever
  trace exactly as in a real run; reranker failure returns the post-fusion order with a
  "reranker kihagyva" flag; run-level `errorCode` in the header.
- Map: > 5 000 vectors sampled server-side and announced; worker failure → PCA-2 fallback.
- A run hard-deleted by the 30-day retention job → 404 → list refreshes.
- Every new dynamic/native query runs with `statement_timeout` (5 s) like the admin hub.

## Testing

- **Backend ITs** (Testcontainers `pgvector/pgvector:pg16`, `-Dmezo.test.use-testcontainers=true`)
  with `GraphPopulator`, `MemoryItemPopulator`, `MemoryEmbeddingPopulator`: run list paging and
  user isolation (another user's runs never appear); structured edges with and without
  `includeDeleted`; neighbours ordered by real cosine distance; PCA determinism and cache
  invalidation; **replay writes no `memory_retrieval_*` row**; replay's `llm_log_history` rows
  carry `feature=admin_replay` and the inspected user's `created_by`; non-owner 403 on every
  endpoint; `MemoryRetrievalDeterministicEvalIT` stays green.
- **Frontend:** contribution-bar maths as a pure function unit-tested against the Elastic example
  values; worker message protocol mocked; render test per view in both `VITE_USE_MOCK` modes;
  `umap-js` seeded deterministically in tests.
- **Gates:** contract-drift, codemap, ArchUnit via plain `./mvnw test`.

## Slices

1. **Backend runs + replay** — `AdminMemoryApi` contract, run list/detail, `RetrieveOptions`
   dry-run, `admin_replay` context + actor override, ITs.
2. **Backend graph + vectors + health** — structured edge DTO, graph endpoint with toggles,
   vector list with PCA-50, neighbours, health.
3. **Prototype + shell + Futások UI** — `admin-memory.html` (all four views + inspector on one
   canvas), sub-navigation, run list, run detail with contribution bars, replay box.
4. **Gráf UI** — `d3-force`, SVG rendering, filters, node/edge inspector, run ↔ graph highlight.
5. **Térkép UI** — worker, scatter, neighbours, replayed query on the map.
6. **Rétegek UI + docs** — health view; `docs/features/admin-memory-explorer.md` (10-section
   feature doc) or a section in `admin-hub.md`; fix the companion.md / insights.md staleness
   listed below; codemap.

## Follow-ups (own issues)

- Admin relevance labels on run candidates (Phoenix pattern) so the audit becomes an eval set.
- `llm_log_history.run_id` link by migration, so "what the LLM saw" and "what it cost" join.
- Populate `shadow_embedding_version` (always null today) for A/B embedding generations.
- The SHADOW → NEW serving-mode decision, which this explorer is meant to inform.
- Explicit `LlmCallContext` on `LlmMemoryQueryRewriter` / `LlmMemoryReranker` if their default
  labels turn out to be generic.

## Prior art

Researcher report (2026-09-06), filtered:

- **Adopted — Elastic RRF `explain` tree:** per-hit nested view of fused score → per-retriever
  rank and `1/(rank+k)` contribution, absent sources shown explicitly. This is the shape of the
  stored `ScoreBreakdownEnvelope`; the run detail row is a direct rendering of it.
  https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion
- **Adopted — Azure hybrid sub-score table:** never plot raw BM25 and cosine on one axis; show
  rank + weighted contribution per source, and keep the reranker score as a separate column with
  a rank delta. https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking
- **Adopted (partly) — Phoenix retriever spans:** cross-run table with quick filters and
  "what the LLM saw" as the final ordered list; per-document relevance labels deferred to a
  follow-up. Their decision to keep UMAP/HDBSCAN server-side was weighed and rejected here
  because the Java backend has no UMAP and per-user sets are small.
  https://github.com/Arize-ai/phoenix/issues/1163 , https://github.com/Arize-ai/phoenix/issues/160
- **Adopted — Graphiti/Zep edge panel contract:** fact + evidence → source episodes + validity
  timeline. mezo edges have no invalidation semantics, so the timeline is created → last
  reinforced (decay) rather than valid/invalid. https://help.getzep.com/graphiti/getting-started/overview
- **Adopted — `umap-js` client-side in a Web Worker**, after server-side PCA-50 to cut the
  payload from ~9 MB to ~0.6 MB per 3 000 items; `transform()` places the replay query.
  https://github.com/pair-code/umap-js
- **Rejected — sigma.js / WebGL** (graph sizes are hundreds), **react-force-graph** (own look,
  bundle size), LightRAG WebUI as a whole (Python stack).

## Codebase terrain

Investigator report (2026-09-06), filtered:

- **Layer model** is product vocabulary in `MemoryObservatoryService`, not a schema column: L0 =
  logged days; L1 = `daily_summary`/`period_summary`, legacy `memory_embedding` (10 kinds,
  `ref_id` → source row), canonical `memory_item` + `memory_vector` (mezo-6dii, one vector per
  `(item, embedding_version)`, `status pending|ready|failed`, partial HNSW on ready+live,
  ANN-eligible only when `embedded_content_hash = content_hash`); L2 = `pattern`,
  `learned_fact`, `knowledge_node status='candidate'`; L3 = `knowledge_fact`,
  `knowledge_node`/`knowledge_edge`. Serving version `gemini-embedding-001-768-v1`.
- **Pipeline:** `MemoryContextService.retrieve` → `MemoryQueryPreparer` (+ `LlmMemoryQueryRewriter`)
  → four `@Service`-named retrievers in parallel, 200 ms deadline, `retriever_trace` →
  `MemoryCandidateFusion` (weighted RRF `w/(60+rank)`, all weights 1.0, bounded boosts) →
  `MemoryContextSelector` → optional `LlmMemoryReranker` → `MemoryRetrievalAuditWriter`
  (REQUIRES_NEW) → `MemoryContextRenderer`. Serving modes `OLD|SHADOW|NEW`; **SHADOW is the
  production default**, so audited runs are shadow runs and the served context is the legacy path
  with no audit.
- **Audit tables:** `memory_retrieval_run` (`consumer_policy`, `query_mode`, raw/rewritten query,
  `embedding_version`, `shadow_embedding_version` always null, `serving_mode`, `duration_ms`,
  `retriever_trace`, `error_code`, `trace_id`), `memory_retrieval_result` (`rank`, `selected`,
  `content_snapshot`, `score_breakdown` jsonb), `memory_retrieval_feedback`. Repositories are
  thin (no "list runs for user" finder). Hard-deleted after 30 days by
  `MemoryRetrievalRetentionJob`. The rendered prompt block is **not** stored; the only bridge to
  the LLM log is `ai_message.recalled_memories` (NEW mode only).
- **No replay/dry-run exists.** Every `retrieve` embeds, may rewrite, writes audit rows, and
  `LlmActorResolver` bills the JWT principal, not `runAs`. `serving_mode` and `consumer_policy`
  have CHECK constraints — dry-run must not write, or a migration widens them.
- **Graph:** `GraphNodeEntity` kinds `PATTERN|PREFERENCE|GOAL|LIFE_EVENT|SEASON|INSIGHT|PERSON`,
  status `candidate|active|archived`, `source_kind/source_id`, `meta` jsonb; `GraphEdgeEntity`
  kinds `TRIGGERS|PRECEDED_BY|SUPPORTS|CONFLICTS|RELATES_TO`, `weight 0..1`, `evidence` =
  `List<GraphEdgeEvidence>`, `last_reinforced_at`; nightly `GraphMaintenanceService` decay ×0.99,
  prune < 0.05, +0.05 on fresh evidence. Structured sources: `GraphEdgeRepository.
  findByCreatedByAndDeletedFalse`, `GraphTraversalQuery.neighborhood` → `NeighborEdge`. **No
  structured edge DTO in any contract** (`GraphNodeResponse.topEdges` is text).
- **Reusable with `userId`:** `MemoryObservatoryService.overview/summaries/similarDays`
  (legacy ANN), `GraphService.listActiveWithTopEdges`; all current controllers resolve the owner
  from `CurrentUserId` and accept no `userId`.
- **Embeddings:** 768-dim, L2-normalised client-side, asymmetric task types
  (`GeminiEmbeddingAdapter`; `FakeEmbeddingAdapter` under `companion-fake`); ANN in
  `DenseMemoryQuery` (canonical) and `MemoryEmbeddingAnnQuery` (legacy). No projection, no
  item↔item similarity anywhere. `pg_trgm`, `unaccent`, `pgcrypto` installed.
- **Frontend inventory:** no d3/chart dependency; hand-rolled SVG (`ScoreRing`, `TrendChart`,
  `TokenColumns`, `SimilarDayCard`); `MemoryPage.tsx` segments Rétegek/Napló/Kereső/Audit,
  `KnowledgeListPage` + `NodeDetailSheet` (text edges), `RecalledMemoriesRow`. Prototypes:
  `tudastar-egyben.html`, `mezo-tab.html` memory band, `mezo-chat.html` recalled strip. A force
  graph was once planned and parked (bd mezo-2m4).
- **Volume:** demodata seeds no memory/graph rows; test populators exist. Bounds: 8 seeds, topK 8,
  2 hops, 30 candidates per retriever, 1 200-token chat budget.
- **Traps:** `admin → companion` only; every memory/graph bean `@ConditionalOnProperty` (consume
  via `ObjectProvider`); `@SQLRestriction` hides deleted rows from JPA — native SQL for
  `includeDeleted` (precedent `findByOwnerItemAndVersionIncludingDeleted`); JDBC-with-savepoint
  idiom for pgvector/CTE queries; graph weights decay nightly so a stored breakdown will not
  match the live edge weight; `requireOwner()` never inside `@Transactional(readOnly)`.
- **Staleness to fix in slice 6:** `insights.md` §Memória names the first segment "Áttekintés"
  (code: "Rétegek") and describes the old degraded redirect; `companion.md` W2.1 node-kind table
  lacks `PERSON`; the shared-RAG-platform spec promises `shadow_embedding_version`, code writes
  null.
