---
title: RAG memory explorer — owner console part 2
type: feature-domain
status: done
updated: 2026-09-07
tags: [admin, companion, memory, rag, pgvector, knowledge-graph, backend, frontend, data-layer, design]
key_files:
  - api/feature/admin-memory/admin-memory.yml
  - backend/src/main/java/io/mrkuhne/mezo/feature/admin/service/AdminMemoryService.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryProjectionService.java
  - frontend/src/features/admin/memory
  - frontend/src/data/admin/adminMemoryApi.ts
related: [admin-hub, companion, insights, _platform-auth-security, _platform-data-layer, _platform-design-system]
---

# RAG memory explorer — Feature Documentation

> One-line: an owner-only surface at `/admin/users/:id/memory` (four views: Futások · Gráf ·
> Térkép · Rétegek + a shared inspector) that answers, without pgAdmin, *why the companion
> recalled this for user X*, *what X's knowledge graph looks like*, *where X's memories cluster*,
> and *is X's vector store healthy* — part 2 of the admin/observability platform series, after
> [`admin-hub.md`](admin-hub.md) (part 1).
> **Status: ✅ backend · ✅ FE real · ✅ FE mock.** `mezo-4qyt`.

## 1. Summary

Part 1 ([`admin-hub.md`](admin-hub.md)) gave the owner installation-wide counters and a generic
row browser. Neither answers the RAG-specific question the beta actually needs: *why did the
companion recall THIS memory for THIS user, and can I trust the store it drew it from?* This
epic (`mezo-4qyt`) adds a 5th tab, "Memória", on the existing user-detail page, opening a
sub-route with four views that share one right-hand inspector:

- **Futások** — the audited retrieval-run list + one run's ranked candidates and fused-score
  decomposition, plus a live dry-run **replay** of the same query in NEW mode.
- **Gráf** — the user's knowledge graph as a force-directed SVG (`d3-force`), node/edge inspector,
  evidence-carrying edges.
- **Térkép** — a `umap-js` (Web Worker) 2D projection of the server's PCA-50 block, an SVG
  scatter, real pgvector neighbours on click.
- **Rétegek** — vector/graph health rollups: per-status and per-version vector counts, staleness,
  item/node state counts, an edge-weight histogram, inferred nightly-job timestamps.

Six slices, one branch each (`feat/rag-explorer-s1`..`s6`): S1/S2 backend (contract, runs/replay,
then structured graph/vectors/neighbours/health), S3–S5 the first three FE views, S6 (this doc)
the fourth view plus documentation. Full plan:
`docs/superpowers/plans/2026-09-07-rag-memory-explorer.md`; design spec:
`docs/superpowers/specs/2026-09-06-rag-memory-explorer-design.md`.

## 2. User-facing behavior

Route family `/admin/users/:id/memory?view=runs|graph|map|layers&sel=<id>` — the view and the
selected row live in the URL (`AdminMemoryPage.tsx`), not component state, so a deep link from a
run candidate to "this edge on Gráf" or "this point on Térkép" is addressable. A four-way segment
bar (`MemorySegmentBar`, Futások · Gráf · Térkép · Rétegek) sits under the existing 5-tab bar
(Aktivitás · Adatok · Feature-ök · Költség · **Memória**); every view renders into `.am-content`
beside a collapsible `MemoryInspector` that shows the currently selected row's detail (or an empty
placeholder when nothing is selected — Rétegek never populates it, since it has no selectable
row).

**Futások** (`RunsView`/`RunDetail`/`ReplayBox`): a paged run list, newest first; each row shows
the serving mode, candidate/selected counts, retention. A row carrying `servingMode !== 'NEW'`
gets the **árnyék** (shadow) badge, `title="Árnyékfutás — nem ezt látta a modell"` — SHADOW is the
production default, so most rows carry it. Opening a run shows its ranked candidates with the
fused-score decomposition per retriever, the reranked-position column labelled **"újrarangsorolt
hely (1/hely)"** (never "reranker pontszám" — see §9), and the prompt trace — what the LLM
actually saw — with an explicit reason when it is absent: `SHADOW_RUN` ("a modell ezt nem
látta"), `NO_PROMPT_IMPRINT` (a NEW run whose imprint could not be matched by the ±10-minute
window), or `DRY_RUN` (a replay never writes an imprint at all). The **replay box** runs a
side-effect-free NEW-mode dry run of a typed query: toggles for reranker/rewrite are labelled
**"engedélyezve"**, never "kényszerítve" (resolved ambiguity 4 — they are allowances the pipeline
may still skip, not forces), and the result carries a **DRY-RUN** badge plus every applicable note
(`rewrite_unreachable_no_history`, `rewrite_skipped`, `reranker_skipped`,
`projection_embed_extra_call`/`pca_unavailable`).

**Gráf** (`GraphView`/`GraphInspector`): all seven node kinds get a fixed colour (PATTERN,
PREFERENCE, GOAL, LIFE_EVENT, SEASON, INSIGHT, PERSON — an unknown kind falls back to grey rather
than rendering invisible); `includeArchived`/`includeDeleted` toggles, a kind filter, a minimum
edge-weight slider, search. Arriving via a deep link from a run candidate shows an honesty line
("erre a jelöltre navigáltál egy futásból") the first render only.

**Térkép** (`MapView`/`MapInspector`): an SVG scatter of every ready vector, coloured by source
kind, hollow for `suppressed`/`superseded` items, radius by salience. A **sampled banner** appears
whenever the store exceeds `vectorSampleThreshold` ("N elem látszik M-ből"). Clicking a point
fetches its real pgvector neighbours (dashed lines). A replay query can be placed on the map: with
`queryProjection` present the point comes from the SAME UMAP `transform()` (labelled honestly, "a
UMAP transform()-jével lett kiszámolva ugyanabból a modellből"); without it, the query's dot is
the **centroid of its candidates' plotted points** and is labelled **becsült** ("a jelöltek
térkép-pontjainak súlypontja, nem valódi vetület"). A permanent caveat note explains that on-screen
distance is the 2D-folded projection, not the real vector distance — the inspector's pgvector
neighbours are the ground truth.

**Rétegek** (`LayersView`, this slice): driven by `/health` alone — **no L0–L3 overview cards**
(resolved ambiguity 7, follow-up #6 below). `memory_vector` by status (ok/elavult/sikertelen/
összesen) with the stale and failed counts as **linked** StatCells; a failure-code breakdown when
present; an embedding-version distribution bar + legend, headlined with the active serving
version; `memory_item` by state (candidate/deleted linked); `knowledge_node` by status
(candidate/deleted linked); a 10-bucket edge-weight histogram; the inferred nightly-job
timestamps, headlined **"(időpontok becsültek)"**. Every linked count opens
`/admin/data?table=<table>&userId=<id>` — part 1's data browser, table and user pre-selected; the
data browser has no arbitrary filter, so the count is a guide, never a working filter. A footer
note restates every linked number so the page is self-explanatory without hovering each cell.

**Degraded state, all four views:** a 404 carrying no `ADMIN_MEMORY_*` code (a missing controller
bean — the feature switch, or the companion/knowledge-graph switch a given endpoint needs, is off)
renders "A memória-felfedező ki van kapcsolva" instead of the normal error state (resolved
ambiguity 6); a run that genuinely 404s (`ADMIN_MEMORY_RUN_NOT_FOUND`, e.g. past the 30-day
retention window) re-throws and lands on the ordinary error tile.

## 3. Architecture & data flow

```
/admin/users/:id/memory?view=…  React.lazy admin chunk · AdminMemoryPage (URL-owned view+sel)
   │
   ▼
/api/admin/users/{userId}/memory/**   AdminMemoryApi (NEW tag)
   │  currentUser.requireOwner() — literal first statement, never inside an open @Transactional
   ▼
feature/admin (dependency direction admin → companion; ArchUnit `feature_slices_are_cycle_free`
│                pins it — nothing in feature/companion may import feature/admin)
├─ AdminMemoryController      implements generated AdminMemoryApi
├─ AdminMemoryService         orchestrates every endpoint; owns the ObjectProvider 404 gate
├─ AdminMemoryRunMapper       run/candidate entities + config → DTOs (fusionRank/rerankDelta)
├─ AdminMemoryGraphMapper     structured node/edge rows → DTOs, evidence json → typed list
├─ AdminMemoryReplayService   LlmActorContext override + admin_replay context + RetrieveOptions
└─ AdminMemoryProperties      mezo.admin.memory — the D5 knobs
        │  every companion/graph dependency arrives via ObjectProvider<T> — a switched-off bean
        │  is a 404 ADMIN_MEMORY_DISABLED, never a NoSuchBeanDefinitionException 500
        ▼
feature/companion (memory + graph) — NEW queries/services added for this epic
├─ MemoryPromptTraceQuery      ai_message.recalled_memories lookup by retrievalRunId (±10 min)
├─ GraphStructureQuery         native node/edge reads that see past @SQLRestriction
├─ MemoryVectorPointQuery      vector+item list for the map (JDBC + savepoint, pgvector)
├─ MemoryNeighborQuery         pgvector cosine neighbours, real distance
├─ MemoryHealthQuery           status/version/staleness/state/histogram rollups
├─ MemoryProjectionService     PCA-50 power-iteration SVD + per-instance cache + sampling
└─ MemoryContextService        retrieveDetailed(request, options) — the RetrieveOptions overload
```

The `admin → companion` edge is NEW and the one place a cycle could sneak in: `MemoryProjectionService`
takes its PCA knobs (`pcaTargetDims`, `vectorSampleThreshold`) as a `ProjectionRequest` **parameter**,
never an injected `AdminMemoryProperties`, precisely so `feature/companion` never imports
`feature/admin`.

**FE data layer** (`frontend/src/data/admin/adminMemory{Api,Hooks,Mock}.ts`): every hook takes
`isOwner` and folds it into `enabled` (`useAdminMemoryRuns/Run/Graph/Vectors/Neighbors/Health`,
plus the `useAdminMemoryReplay` mutation) and every read wraps its fetcher in `degradable(...)` —
see §4's absent-key note and §6.

## 4. Data model & API

No new tables. `AdminMemoryProperties` (`mezo.admin.memory`) carries `pcaTargetDims` (50),
`vectorSampleThreshold` (5000), `neighborDefaultK` (10), `statementTimeout` (`PT5S`),
`runsMaxPageSize` (100), `edgeWeightHistogramBuckets` (10), `replayFeatureLabel`
(`admin_replay`) — every knob the plan requires goes to `application.yml`. Deliberately **NOT**
duplicated here: the RRF constant, the per-retriever fusion weights, the graph decay factor — all
**read live** from `MemoryPlatformProperties`/`CompanionProperties`, so the explorer's score
decomposition can never drift from the constants the pipeline actually fused with.

**Contract** — `api/feature/admin-memory/admin-memory.yml` (tag `AdminMemory` →
`AdminMemoryApi`), appended to `api/generate/merge.yml`:

| Op | Path | → |
|---|---|---|
| `listAdminMemoryRuns` | `GET …/memory/runs?page=&size=` | `AdminMemoryRunPageResponse{items, page, size, total, retentionDays}` |
| `getAdminMemoryRun` | `GET …/memory/runs/{runId}` | `AdminMemoryRunDetailResponse{run, candidates, fusion, promptTrace, promptTraceReason, dryRun, queryProjection, replayNotes}` — 404 `ADMIN_MEMORY_RUN_NOT_FOUND` |
| `replayAdminMemory` | `POST …/memory/replay` | same shape, `dryRun=true` — 400 `ADMIN_MEMORY_REPLAY_QUERY_INVALID` on blank/over-long query |
| `getAdminMemoryGraph` | `GET …/memory/graph?includeArchived=&includeDeleted=` | `AdminMemoryGraphResponse{nodes, edges, decayFactor, pruneBelow}` |
| `getAdminMemoryVectors` | `GET …/memory/vectors?version=` | `AdminMemoryVectorsResponse{embeddingVersion, dims, sampled, total, items, projection}` — `projection` a base64 little-endian Float32 block |
| `getAdminMemoryNeighbors` | `GET …/memory/vectors/{itemId}/neighbors?k=` | `AdminMemoryNeighborsResponse{itemId, embeddingVersion, neighbors}` — 404 `ADMIN_MEMORY_ITEM_NOT_FOUND` / `ADMIN_MEMORY_NO_VECTOR` |
| `getAdminMemoryHealth` | `GET …/memory/health` | `AdminMemoryHealthResponse{servingEmbeddingVersion, vectorsByStatus, vectorFailures, vectorsByVersion, staleVectorCount, itemsByState, nodesByStatus, nodesByKind, edgeWeightHistogram, jobs}` |

Every operation is 401/403 like the rest of the platform; every operation also 404s
`ADMIN_MEMORY_DISABLED` when the feature switch (or, per-endpoint, the companion/knowledge-graph
switch) is off, and 504s `ADMIN_MEMORY_QUERY_TIMEOUT` on a statement-timeout cancellation
(`SET LOCAL statement_timeout`, same idiom as part 1's `ADMIN_QUERY_TIMEOUT`).

**The PCA/base64 payload contract**: `projection` packs `items.length * dims` little-endian
Float32 values, row-major, in the same order as `items` — the client decodes it straight into a
`Float32Array` sized from the response's own `dims` (not the configured target, which the actual
projection may fall short of on a small store).

**The `retrieverRanks` absent-key semantics**: a candidate's per-retriever rank map carries a key
ONLY for retrievers that actually surfaced it — a candidate found solely by the dense retriever has
no `sparse`/`graph` key at all, never a sentinel like `null` or `-1`. The FE must branch on key
presence, not on a falsy rank.

## 5. Integrations

- **← companion (memory + graph)**: `MemoryContextService.retrieveDetailed(request, options)` is a
  NEW method all four pre-existing public entry points now delegate to, keeping their signatures
  and behaviour byte-for-byte (§9's mutation-tested claim). `RetrieveOptions.reranker`/`.rewrite`
  are allowances (§2, resolved ambiguity 4); the replay's `queryProjection` costs a SECOND embed
  call (`EmbeddingPort`, resolved ambiguity 2) since `DenseMemoryRetriever` embeds internally and
  `MemoryContext` never carries the vector out.
- **← llmlog**: `LlmCallContext.FEATURE_ADMIN_REPLAY` (`"admin_replay"`) + `isAdminReplay()` — a
  new constant/instance method in the shared `llmlog` slice (both admin and companion already
  depend on it, so no `companion → admin` edge appears). `LlmMemoryQueryRewriter`/
  `LlmMemoryReranker` keep binding their own `companion_recall` context UNLESS the ambient context
  is already the admin replay, in which case they re-label to it (resolved ambiguity 3) — a normal
  chat turn's rewrite/rerank rows still land under `companion_recall`, never `admin_replay` or
  `companion_chat`.
- **← auth**: `currentUser.requireOwner()`, same *Ownership exception* as part 1 — see
  [`_platform-auth-security.md`](_platform-auth-security.md) §4 and
  [ADR 0038](../decisions/0038-admin-hub-cross-user-reads.md) (beta-scoped consent).
  `LlmActorContext.override`/`.runAsOverride` bill the replay's LLM calls to the INSPECTED user,
  not the owner, so the cost matrix stays honest about whose usage it is.
- **← admin hub (part 1)**: the layout (`MozaikPage`/`AdminTile`/`MosaicDesktop`), the 5th
  "Memória" tab on `AdminUserDetailPage`, and every Rétegek deep link into the data browser
  (`/admin/data?table=&userId=`, `AdminRowQuery.applyStatementTimeout`).

## 6. How to use it (consume)

```ts
import {
  useAdminMemoryRuns, useAdminMemoryRun, useAdminMemoryReplay,
  useAdminMemoryGraph, useAdminMemoryVectors, useAdminMemoryNeighbors,
  useAdminMemoryHealth, useMe,
} from '@/data/hooks'

const isOwner = useMe().data?.role === 'OWNER'
const health = useAdminMemoryHealth(userId, isOwner)
```

Every hook closes over `isOwner` (`enabled: isOwner && userId !== ''`) and passes
`realStaleTime: DEFAULT_QUERY_STALE_TIME_MS` explicitly (an omitted value overwrites the client
default and leaves the query permanently stale). Every READ wraps its fetcher in `degradable(...)`
(`adminMemoryApi.ts`), which discriminates a **degraded** 404 (no bean, feature off — resolved as
`{ ...empty, degraded: true }`) from a **real** 404 (any response carrying an `ADMIN_MEMORY_*`
code, e.g. a hard-deleted run) — only the former renders the "ki van kapcsolva" tile; the latter
re-throws. The replay **mutation** is never wrapped — its 404 is always a real error. The URL
contract: `view` (`runs|graph|map|layers`, unknown falls back to `runs`) and `sel` (the currently
selected row id, cleared on a view switch) are read/written through `useSearchParams`, never local
state.

## 7. How to extend it

- **A new endpoint**: contract-first in `admin-memory.yml` → `npm run generate:api` (api) +
  `pnpm generate:api` (frontend) → an `AdminMemoryService` method (gate every companion/graph
  dependency through `ObjectProvider`, `require(...)` first) → `AdminMemoryController` override →
  an IT under `feature/admin/controller/` → `adminMemoryApi`/`adminMemoryHooks`/mock seed → an
  MSW handler (`test/msw/handlers.ts`) → a view → both-mode tests → this doc's §4/§10.
- **A new node kind**: add a colour to `GraphView`'s `KIND_COLOR` (an unmapped kind already falls
  back to grey, so this is additive) and extend this doc's kind enumeration (§2) — see
  [`companion.md`](companion.md) W2.1 for where the kind itself is declared.
- **A new health rollup**: one native statement in `MemoryHealthQuery` + one bucket in
  `AdminMemoryHealthResponse`/`AdminMemoryGraphMapper` + one tile in `LayersView` — the same
  additive shape as every other rollup on that view.

## 8. Testing

Backend (`-Dmezo.test.use-testcontainers=true`, Testcontainers `pgvector/pgvector:pg16`):
`AdminMemoryPropertiesTest`, `AdminMemoryRunMapperTest`, `AdminMemoryRunsIT`, `AdminMemoryReplayIT`
(dry-run writes no audit row; the replay's rows bill to `admin_replay` under the inspected user —
both load-bearing, mutation-tested per §9), `AdminMemoryGraphIT`, `AdminMemoryVectorsIT`,
`AdminMemoryVectorsSamplingIT`, `AdminMemoryHealthIT`, `AdminMemoryHealthGraphOffIT` (the graph
switch off, vector half still populated). The acceptance evidence for the `RetrieveOptions`
refactor is that `MemoryRetrievalDeterministicEvalIT`, `MemoryShadowRunnerIT` and the chat ITs pass
**unedited** — the only change to shipped behaviour in the whole epic. Every new endpoint has a
non-owner 403 case. `ArchitectureTest` (full `./mvnw test` only) enforces the `admin → companion`
direction and `feature_slices_are_cycle_free`.

Frontend (both `pnpm test` [mock] and `VITE_USE_MOCK=false pnpm test` [real]): a render test per
view, `AdminMemoryPage.test.tsx` (view routing, the degraded-tile 404 discrimination, per-sibling
isolation), `graphLayout.test.ts`, `projection.test.ts`, `umapWorker.protocol.test.ts`,
`contribution.test.ts`, `LayersView.test.tsx` (the stale-count data-browser link, the histogram's
bucket-per-column render, the becsült job labels, an empty-node-bucket payload rendering the
vector half without erroring).

**Gates**: contract-drift (`api/openapi.yml` + `api.gen.ts` committed), `node
scripts/gen-codemap.mjs --check`, `pnpm build`.

## 9. Decisions, gotchas & deferred

- **`ScoreBreakdownEnvelope.rerankerScore` is `1 / postRerankRank`, not a model score** —
  `MemoryRetrievalAuditWriter` writes it from the already-reranked list's position, so it restates
  the stored `rank`. The backend instead derives `fusionRank` by re-sorting stored candidates with
  the exact `MemoryCandidateFusion` comparator and returns `rerankDelta = fusionRank - rank`
  (non-null only when at least one candidate has a non-null `rerankerScore`); the UI column is
  labelled **"újrarangsorolt hely (1/hely)"**, never "reranker pontszám". A real per-candidate
  score needs the reranker prompt to return scores, not just an order (follow-up #5).
- **The replay's `queryProjection` costs a SECOND embed call** — `DenseMemoryRetriever` embeds
  inside its own parallel executor and the vector never leaves it, so `AdminMemoryReplayService`
  embeds the replay query itself via `EmbeddingPort` under the same `admin_replay` context and
  hands it to `MemoryProjectionService.transform(...)`. `replayNotes` carries
  `projection_embed_extra_call` (or `pca_unavailable`) so the surface is honest about the cost.
- **The D3 label fix** (`LlmCallContext.FEATURE_ADMIN_REPLAY` / `isAdminReplay()`) is the subtlest
  change in the epic: naively deriving the feature label from the ambient context would have moved
  every chat turn's `query_rewrite`/`rerank` rows from `companion_recall` to `companion_chat`,
  corrupting part 1's cost matrix. The fix re-labels ONLY when the ambient context is already
  `admin_replay`; a normal chat turn is untouched.
- **SHADOW is the production default** — most runs a reviewer opens will carry the árnyék badge;
  that is expected, not a bug in the mock data.
- **`shadow_embedding_version` is always null today** — the shared-RAG-platform spec promises it,
  but nothing populates it yet (follow-up #3); the explorer already renders the field, so it will
  light up the moment it is written.
- **The PCA cache is per-instance** (`MemoryProjectionService`'s `ConcurrentHashMap`) — two
  backend replicas can hand two clients two different bases, and the FE additionally caches its
  UMAP fit per user in `sessionStorage`, so a reload served by the other replica can visibly move
  the map. Harmless at beta scale (follow-up #7).
- **The frozen knowledge-graph layout is untouched by this epic** — Gráf reads it, never writes.
- **Deferred (follow-ups filed at the end of slice 6, see the plan's "Follow-up bd issues"
  section)**: admin relevance labels on run candidates (the Phoenix eval pattern); a real FK from
  `llm_log_history.run_id` instead of the ±10-minute time-window join; populating
  `shadow_embedding_version`; the SHADOW→NEW serving-mode product decision this whole explorer
  exists to inform; a real per-candidate reranker score; `GET …/memory/overview` (L0–L3 product
  framing beside the raw Rétegek rollups); sharing the PCA basis across replicas; the desktop
  mosaic treatment for the two pages moved in during part 1.

## 10. Key files

- Contracts: `api/feature/admin-memory/admin-memory.yml`, `api/generate/merge.yml`
- Backend: `feature/admin/controller/AdminMemoryController.java`,
  `feature/admin/service/{AdminMemoryService,AdminMemoryRunMapper,AdminMemoryGraphMapper,
  AdminMemoryReplayService}.java`, `feature/admin/config/AdminMemoryProperties.java`,
  `feature/companion/memory/repository/{MemoryPromptTraceQuery,MemoryVectorPointQuery,
  MemoryNeighborQuery,MemoryHealthQuery}.java`, `feature/companion/graph/repository/
  GraphStructureQuery.java`, `feature/companion/memory/service/{MemoryProjectionService,
  MemoryContextService}.java`, `feature/llmlog/context/LlmCallContext.java`,
  `techcore/security/LlmActorContext.java`,
  `techcore/configuration/FeaturesConfiguration.java` (`ADMIN_MEMORY_SWITCH`)
- Backend tests: `feature/admin/config/AdminMemoryPropertiesTest.java`,
  `feature/admin/service/AdminMemoryRunMapperTest.java`, `feature/admin/controller/
  {AdminMemoryRunsIT,AdminMemoryReplayIT,AdminMemoryGraphIT,AdminMemoryVectorsIT,
  AdminMemoryVectorsSamplingIT,AdminMemoryHealthIT,AdminMemoryHealthGraphOffIT}.java`
- Frontend: `features/admin/memory/{AdminMemoryPage,MemorySegmentBar,MemoryInspector,
  contribution,graphLayout,umapConstants,umap.worker,projection}.ts(x)`,
  `features/admin/memory/views/{RunsView,RunDetail,ReplayBox,GraphView,GraphInspector,MapView,
  MapInspector,LayersView}.tsx`, `data/admin/adminMemory{Api,Hooks,Mock}.ts`
- Docs: this file, [`admin-hub.md`](admin-hub.md) (part 1),
  [ADR 0038](../decisions/0038-admin-hub-cross-user-reads.md),
  `docs/superpowers/specs/2026-09-06-rag-memory-explorer-design.md`,
  `docs/superpowers/plans/2026-09-07-rag-memory-explorer.md`
