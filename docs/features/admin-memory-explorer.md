---
title: RAG memory explorer — owner console part 2
type: feature-domain
status: done
updated: 2026-09-09
tags: [admin, companion, memory, rag, pgvector, knowledge-graph, backend, frontend, data-layer, design]
key_files:
  - api/feature/admin-memory/admin-memory.yml
  - backend/src/main/java/io/mrkuhne/mezo/feature/admin/service/AdminMemoryService.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/admin/repository/AdminAlertQuery.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryProjectionService.java
  - frontend/src/features/admin/memory
  - frontend/src/data/admin/adminMemoryApi.ts
related: [admin-hub, companion, insights, _platform-auth-security, _platform-data-layer, _platform-design-system]
---

# RAG memory explorer — Feature Documentation

> One-line: the owner's "Memória" section — an installation-wide entry page at `/admin/memory`
> plus a per-user explorer at `/admin/users/:id/memory` (five views: Áttekintés · Felidézések ·
> Gráf · Térkép · Rétegek + a shared inspector) — answering *is the memory system healthy
> overall*, *why did the companion recall this for user X*, *what does X's knowledge graph look
> like*, *where do X's memories cluster*, and *is X's vector store healthy* — part 2 of the
> admin/observability platform series, after [`admin-hub.md`](admin-hub.md) (part 1).
> **Status: ✅ backend · ✅ FE real · ✅ FE mock.** `mezo-4qyt` (the four-view explorer) +
> `mezo-k5zy` (install-wide entry page, Áttekintés view, verdict-sentence, "Felidézések" rename).

## 1. Summary

Part 1 ([`admin-hub.md`](admin-hub.md)) gives the owner installation-wide counters and a generic
row browser. Neither answers the RAG-specific questions the beta actually needs: *is memory
healthy across every tester, without opening one at a time*, and, for a given tester, *why did
the companion recall THIS memory for THIS user, and can I trust the store it drew it from?*
Two epics answer them:

- **`mezo-4qyt`** shipped the per-user explorer: a 6th tab, "Memória", on the existing user-detail
  page, opening a sub-route with four views sharing one right-hand inspector — Felidézések, Gráf,
  Térkép, Rétegek (see §2).
- **`mezo-k5zy`** added the rail-level entry point (`/admin/memory`, one hop above any one
  user's explorer) plus a fifth, default-landing view inside the per-user explorer, Áttekintés,
  and renamed the original `runs` view's label from "Futások" to "Felidézések" (the URL value
  stays `runs`, so no existing deep link breaks).

Original plan (`mezo-4qyt`): six slices, one branch each (`feat/rag-explorer-s1`..`s6`) — S1/S2
backend (contract, runs/replay, then structured graph/vectors/neighbours/health), S3–S5 the first
three FE views, S6 the fourth view. Full plan:
`docs/superpowers/plans/2026-09-07-rag-memory-explorer.md`; design spec:
`docs/superpowers/specs/2026-09-06-rag-memory-explorer-design.md`. The `mezo-k5zy` fix round
added the entry page, the global-health endpoint, the Áttekintés view and the verdict sentence on
top of that shipped base.

## 2. User-facing behavior

**`/admin/memory` — Memória entry (installation-wide, `AdminMemoryEntryPage`).** Four KPI
posters from `GET /api/admin/memory/health` (kész/elakadt/elavult vektor, emlékek összesen), a
relative "utolsó éjszakai feldolgozás" line (`hoursSinceLabel`, warns past 26h — the nightly
job's own SLO), and a tester picker (`useAdminUserInsights`) that jumps straight into a given
user's `/admin/users/:id/memory` explorer. One companion-off gate for the WHOLE KPI row: a
degraded read (no `ADMIN_MEMORY_*` code, feature switch off) blanks all four posters together,
since they are meaningless without it — the tester picker below still renders, since it depends
on a completely different, non-degradable endpoint.

**`/admin/users/:id/memory?view=overview|runs|graph|map|layers&sel=<id>`** — the view and the
selected row live in the URL (`AdminMemoryPage.tsx`), not component state, so a deep link from a
run candidate to "this edge on Gráf" or "this point on Térkép" is addressable. **The URL value
for the first content view is still `runs`** (unchanged since `mezo-4qyt`) even though its rail
label is now "Felidézések" — every pre-existing `?view=runs` deep link keeps working unchanged.
An unset or unknown `view` now defaults to `overview` (it defaulted to `runs` before `mezo-k5zy`).
A five-way segment bar (`MemorySegmentBar`, Áttekintés · Felidézések · Gráf · Térkép · Rétegek)
sits under the existing 6-tab bar (Aktivitás · Adatok · Funkciók · Költség · Visszajelzések ·
**Memória**); the four selectable views (Felidézések · Gráf · Térkép · Rétegek) render into
`.am-content` beside a collapsible `MemoryInspector` that shows the currently selected row's
detail (or an empty placeholder when nothing is selected — Rétegek never populates it, it has no
selectable row). **Áttekintés is the one exception: it drops the inspector column entirely**
(`AdminMemoryPage.tsx` only mounts it for `view !== 'overview'`), so its tiles use the full
content width rather than sharing it with an always-empty pane.

**Áttekintés** (`OverviewView`, the default landing view): reads the SAME per-user `/health` op
Rétegek uses (no new endpoint) plus the SAME per-user feedback op the user-detail
Visszajelzések tab uses (`useAdminUserFeedback`) — a health summary strip (kész/elakadt/elavult
vektor, emlékek összesen; the failed/stale cells are clickable and jump to Rétegek, `onGo('layers',
null)` — the number is a guide, never a filter, same idiom as Rétegek's own data-browser links), a
recall-quality sentence ("A felidézett emlékek N%-a volt hasznos", honestly absent when there is
no feedback yet), and a "legutóbbi problémák" strip that either says "Nincs sikertelen vagy
elavult vektor." or offers the same Rétegek deep links again. No `onInspect` call — like Rétegek,
this view has no selectable row.

**Felidézések** (`RunsView`/`RunDetail`/`ReplayBox`, URL value `runs`): a paged run list, newest
first; each row shows the serving mode, candidate/selected counts, retention. A row carrying
`servingMode !== 'NEW'` gets the **árnyék** (shadow) badge, `title="Árnyékfutás — nem ezt látta a
modell"` — SHADOW is the production default, so most rows carry it. Opening a run shows a plain-
Hungarian **verdict-lead sentence** ("A legjobb találatot {forrás} találta meg a rendszer" —
`runVerdictSentence()`, over the top selected candidate, falling back to the first candidate when
none was selected) ahead of the ranked-candidate list, so a reader gets "why this run worked"
without opening a single candidate row; each candidate row ALSO carries its own one-line verdict
next to its content snapshot, plus the fused-score decomposition per retriever and the
reranked-position column labelled **"újrarangsorolt hely (1/hely)"** (never "reranker pontszám" —
see §9), and the prompt trace — what the LLM actually saw — with an explicit reason when it is
absent: `SHADOW_RUN` ("a modell ezt nem látta"), `NO_PROMPT_IMPRINT` (a NEW run whose imprint
could not be matched by the ±10-minute window), or `DRY_RUN` (a replay never writes an imprint at
all). The **replay box** runs a side-effect-free NEW-mode dry run of a typed query: toggles for
reranker/rewrite are labelled **"engedélyezve"**, never "kényszerítve" (they are allowances the
pipeline may still skip, not forces), and the result carries a **DRY-RUN** badge plus every
applicable note (`rewrite_unreachable_no_history`, `rewrite_skipped`, `reranker_skipped`,
`projection_embed_extra_call`/`pca_unavailable`).

**Gráf** (`GraphView`/`GraphInspector`): all seven node kinds get a fixed colour (PATTERN,
PREFERENCE, GOAL, LIFE_EVENT, SEASON, INSIGHT, PERSON — an unknown kind falls back to grey rather
than rendering invisible), each labelled through `memoryTermLabel()` (never a raw kind string) in
both the node itself and the legend, with the legend's `title` carrying the term's Hungarian hint
("what does this node kind mean"); `includeArchived`/`includeDeleted` toggles, a kind filter, a
minimum edge-weight slider, search. The edge legend renders each edge kind's arrow through the
same `memoryTermLabel()` lookup, with the hint carrying the one-liner the legend needs ("what does
this arrow MEAN", e.g. "Ellentmond → a két csomópont ellentmond egymásnak") — never a translated
key with no explanation. Arriving via a deep link from a run candidate shows an honesty line
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

**Rétegek** (`LayersView`): driven by the per-user `/health` alone — **no L0–L3 overview cards**
(that framing question is now answered by Áttekintés instead, see §9's "deferred" note below on
what changed). `memory_vector` by status (ok/elavult/sikertelen/összesen) with the stale and
failed counts as **linked** StatCells, each label going through `memoryTermLabel()` (ready/pending/
failed → Kész/Folyamatban/Elakadt); a failure-code breakdown when present; an embedding-version
distribution bar + legend, headlined with the active serving version; `memory_item` by state
(candidate/deleted linked); `knowledge_node` by status (candidate/deleted linked); a 10-bucket
edge-weight histogram; the inferred nightly-job timestamps, headlined **"(időpontok becsültek)"**.
Every linked count opens `/admin/data?table=<table>&userId=<id>` — part 1's data browser, table
and user pre-selected; the data browser has no arbitrary filter, so the count is a guide, never a
working filter. A footer note restates every linked number so the page is self-explanatory
without hovering each cell.

**Degraded state, both the entry page and every per-user view:** a 404 carrying no
`ADMIN_MEMORY_*` code (a missing controller bean — the feature switch, or the companion/
knowledge-graph switch a given endpoint needs, is off) renders "A memória-felfedező ki van
kapcsolva" instead of the normal error state; a run that genuinely 404s
(`ADMIN_MEMORY_RUN_NOT_FOUND`, e.g. past the 30-day retention window) re-throws and lands on the
ordinary error tile.

## 3. Architecture & data flow

```
/admin/memory              React.lazy admin chunk · AdminMemoryEntryPage (install-wide entry)
/admin/users/:id/memory?view=…  React.lazy admin chunk · AdminMemoryPage (URL-owned view+sel)
   │
   ▼
/api/admin/memory/health                 (install-wide, no userId)  ┐
/api/admin/users/{userId}/memory/**       (per-user)                 ├─ AdminMemoryApi (NEW tag)
   │  currentUser.requireOwner() — literal first statement, never inside an open @Transactional
   ▼
feature/admin (dependency direction admin → companion; ArchUnit `feature_slices_are_cycle_free`
│                pins it — nothing in feature/companion may import feature/admin)
├─ AdminMemoryController      implements generated AdminMemoryApi
├─ AdminMemoryService         orchestrates every endpoint; owns the ObjectProvider 404 gate;
│                              getAdminMemoryGlobalHealth reads AdminAlertQuery (below), NOT a
│                              per-user MemoryHealthQuery call fanned out over every user
├─ AdminMemoryRunMapper       run/candidate entities + config → DTOs (fusionRank/rerankDelta)
├─ AdminMemoryGraphMapper     structured node/edge rows → DTOs, evidence json → typed list
├─ AdminMemoryReplayService   LlmActorContext override + admin_replay context + RetrieveOptions
└─ AdminMemoryProperties      mezo.admin.memory — the per-user-explorer knobs
        │  every companion/graph dependency arrives via ObjectProvider<T> — a switched-off bean
        │  is a 404 ADMIN_MEMORY_DISABLED, never a NoSuchBeanDefinitionException 500
        ▼
feature/companion (memory + graph) — queries/services added for mezo-4qyt
├─ MemoryPromptTraceQuery      ai_message.recalled_memories lookup by retrievalRunId (±10 min)
├─ GraphStructureQuery         native node/edge reads that see past @SQLRestriction
├─ MemoryVectorPointQuery      vector+item list for the map (JDBC + savepoint, pgvector)
├─ MemoryNeighborQuery         pgvector cosine neighbours, real distance
├─ MemoryHealthQuery           per-user status/version/staleness/state/histogram rollups
├─ MemoryProjectionService     PCA-50 power-iteration SVD + per-instance cache + sampling
└─ MemoryContextService        retrieveDetailed(request, options) — the RetrieveOptions overload

feature/admin.repository.AdminAlertQuery  (part 1's owner-alerts backing query, admin-hub.md §4;
    getAdminMemoryGlobalHealth is its SECOND caller) — install-wide, no per-user filter:
    readyMemoryVectors / failedMemoryVectors / staleMemoryVectors / newestDailySummaryAt /
    totalMemoryItems, all sourced with the SAME predicates the memory_stuck/job_missed owner
    alerts already use, so the entry page's KPIs can never drift from what the alert rules see.
```

The `admin → companion` edge is the one place a cycle could sneak in: `MemoryProjectionService`
takes its PCA knobs (`pcaTargetDims`, `vectorSampleThreshold`) as a `ProjectionRequest` **parameter**,
never an injected `AdminMemoryProperties`, precisely so `feature/companion` never imports
`feature/admin`. `AdminAlertQuery` itself needs no such indirection — it is an `admin`-owned
repository from the start (mezo-kjwa), reused by `getAdminMemoryGlobalHealth` rather than
duplicated.

**FE data layer** (`frontend/src/data/admin/adminMemory{Api,Hooks,Mock}.ts`): every hook takes
`isOwner` and folds it into `enabled` (`useAdminMemoryGlobalHealth`, `useAdminMemoryRuns/Run/
Graph/Vectors/Neighbors/Health`, plus the `useAdminMemoryReplay` mutation) and every read wraps
its fetcher in `degradable(...)` — see §4's absent-key note and §6.

## 4. Data model & API

No new tables. `AdminMemoryProperties` (`mezo.admin.memory`) carries `pcaTargetDims` (50),
`vectorSampleThreshold` (5000), `neighborDefaultK` (10), `statementTimeout` (`PT5S`),
`runsMaxPageSize` (100), `edgeWeightHistogramBuckets` (10), `replayFeatureLabel`
(`admin_replay`) — every knob the per-user explorer needs goes to `application.yml`. Deliberately
**NOT** duplicated here: the RRF constant, the per-retriever fusion weights, the graph decay
factor — all **read live** from `MemoryPlatformProperties`/`CompanionProperties`, so the
explorer's score decomposition and verdict sentence can never drift from the constants the
pipeline actually fused with. The install-wide entry page's own timeout comes from part 1's
`mezo.admin.statement-timeout` (`AdminAlertQuery.applyStatementTimeout`, admin-hub.md §4) — there
is no separate install-wide knob here.

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
| `getAdminMemoryGlobalHealth` | `GET /api/admin/memory/health` | `AdminMemoryGlobalHealthResponse{vectorsReady, vectorsFailed, vectorsStale, itemsTotal, newestDailySummaryAt}` — install-wide, no `userId` path segment (mezo-k5zy) |
| `getAdminMemoryHealth` | `GET …/memory/health` | `AdminMemoryHealthResponse{servingEmbeddingVersion, vectorsByStatus, vectorFailures, vectorsByVersion, staleVectorCount, itemsByState, nodesByStatus, nodesByKind, edgeWeightHistogram, jobs}` — per-user |

Every operation is 401/403 like the rest of the platform; every operation also 404s
`ADMIN_MEMORY_DISABLED` when the feature switch (or, per-endpoint, the companion/knowledge-graph
switch) is off, and 504s `ADMIN_MEMORY_QUERY_TIMEOUT` on a statement-timeout cancellation
(`SET LOCAL statement_timeout`, same idiom as part 1's `ADMIN_QUERY_TIMEOUT`).

**`getAdminMemoryGlobalHealth` vs `getAdminMemoryHealth` (do not confuse the two, mezo-d6ny
staleness item).** The global op has no `{userId}` in its path — it answers "is the WHOLE
installation's memory healthy", sourced from `AdminAlertQuery` (the same repository part 1's
`memory_stuck`/`job_missed` owner alerts already read), not from fanning the per-user
`MemoryHealthQuery` out over every account. The per-user op is scoped to one inspected user and
additionally reports graph-side buckets (`nodesByStatus`/`nodesByKind`/`edgeWeightHistogram`),
which the global op does not carry at all.

**The PCA/base64 payload contract**: `projection` packs `items.length * dims` little-endian
Float32 values, row-major, in the same order as `items` — the client decodes it straight into a
`Float32Array` sized from the response's own `dims` (not the configured target, which the actual
projection may fall short of on a small store).

**The `retrieverRanks` absent-key semantics**: a candidate's per-retriever rank map carries a key
ONLY for retrievers that actually surfaced it — a candidate found solely by the dense retriever has
no `sparse`/`graph` key at all, never a sentinel like `null` or `-1`. The FE must branch on key
presence, not on a falsy rank. The FE's `runVerdictSentence()` (contribution.ts) walks this same
map to name the winning retriever in plain Hungarian — see §9.

## 5. Integrations

- **← companion (memory + graph)**: `MemoryContextService.retrieveDetailed(request, options)` is a
  method all four pre-existing public entry points delegate to, keeping their signatures
  and behaviour byte-for-byte (§9's mutation-tested claim). `RetrieveOptions.reranker`/`.rewrite`
  are allowances (§2); the replay's `queryProjection` costs a SECOND embed
  call (`EmbeddingPort`) since `DenseMemoryRetriever` embeds internally and
  `MemoryContext` never carries the vector out.
- **← llmlog**: `LlmCallContext.FEATURE_ADMIN_REPLAY` (`"admin_replay"`) + `isAdminReplay()` — a
  constant/instance method in the shared `llmlog` slice (both admin and companion already
  depend on it, so no `companion → admin` edge appears). `LlmMemoryQueryRewriter`/
  `LlmMemoryReranker` keep binding their own `companion_recall` context UNLESS the ambient context
  is already the admin replay, in which case they re-label to it — a normal
  chat turn's rewrite/rerank rows still land under `companion_recall`, never `admin_replay` or
  `companion_chat`.
- **← auth**: `currentUser.requireOwner()`, same *Ownership exception* as part 1 — see
  [`_platform-auth-security.md`](_platform-auth-security.md) §4 and
  [ADR 0038](../decisions/0038-admin-hub-cross-user-reads.md) (beta-scoped consent).
  `LlmActorContext.override`/`.runAsOverride` bill the replay's LLM calls to the INSPECTED user,
  not the owner, so the cost matrix stays honest about whose usage it is.
- **← admin hub (part 1)**: the layout (`MozaikPage`/`AdminTile`/`MosaicDesktop`), the rail's
  "Memória" entry (`/admin/memory`), the 6th "Memória" tab on `AdminUserDetailPage`, `AdminAlertQuery`
  (part 1's owner-alerts repository — the entry page's global-health op is its second caller),
  Áttekintés's recall-quality sentence (the SAME `useAdminUserFeedback` shape and honesty guard as
  the user-detail Visszajelzések tab), and every Rétegek deep link into the data browser
  (`/admin/data?table=&userId=`, `AdminRowQuery.applyStatementTimeout`).

## 6. How to use it (consume)

```ts
import {
  useAdminMemoryGlobalHealth,
  useAdminMemoryRuns, useAdminMemoryRun, useAdminMemoryReplay,
  useAdminMemoryGraph, useAdminMemoryVectors, useAdminMemoryNeighbors,
  useAdminMemoryHealth, useMe,
} from '@/data/hooks'

const isOwner = useMe().data?.role === 'OWNER'
const globalHealth = useAdminMemoryGlobalHealth(isOwner)         // install-wide, no userId
const health = useAdminMemoryHealth(userId, isOwner)             // one inspected user
```

Every hook closes over `isOwner` (`enabled: isOwner` for the global one, `enabled: isOwner &&
userId !== ''` for every per-user one) and passes `realStaleTime: DEFAULT_QUERY_STALE_TIME_MS`
explicitly (an omitted value overwrites the client default and leaves the query permanently
stale). Every READ wraps its fetcher in `degradable(...)` (`adminMemoryApi.ts`), which
discriminates a **degraded** 404 (no bean, feature off — resolved as `{ ...empty, degraded: true
}`) from a **real** 404 (any response carrying an `ADMIN_MEMORY_*` code, e.g. a hard-deleted
run) — only the former renders the "ki van kapcsolva" tile; the latter re-throws. The replay
**mutation** is never wrapped — its 404 is always a real error. The URL contract on the per-user
page: `view` (`overview|runs|graph|map|layers`, unknown or absent falls back to `overview`) and
`sel` (the currently selected row id, cleared on a view switch) are read/written through
`useSearchParams`, never local state.

## 7. How to extend it

- **A new endpoint**: contract-first in `admin-memory.yml` → `npm run generate:api` (api) +
  `pnpm generate:api` (frontend) → an `AdminMemoryService` method (gate every companion/graph
  dependency through `ObjectProvider`, `require(...)` first) → `AdminMemoryController` override →
  an IT under `feature/admin/controller/` → `adminMemoryApi`/`adminMemoryHooks`/mock seed → an
  MSW handler (`test/msw/handlers.ts`) → a view → both-mode tests → this doc's §4/§10.
- **A new node/edge/retriever/vector-state term**: add one entry to `MEMORY_TERM_LABELS`
  (`frontend/src/features/admin/lib/labels.ts`, admin-hub.md §4's label-dictionary rule) with a
  hint that answers "what does this MEAN" — Gráf's node color map (`KIND_COLOR`) and edge legend
  already fall back to grey/an untranslated key for anything not yet in the map, so this is
  additive on both sides.
- **A new health rollup**: one native statement in `MemoryHealthQuery` (per-user) or
  `AdminAlertQuery` (install-wide) + one bucket in `AdminMemoryHealthResponse`/
  `AdminMemoryGlobalHealthResponse` + one tile in `LayersView`/`AdminMemoryEntryPage` — the same
  additive shape as every other rollup on those views.

## 8. Testing

Backend (`-Dmezo.test.use-testcontainers=true`, Testcontainers `pgvector/pgvector:pg16`):
`AdminMemoryPropertiesTest`, `AdminMemoryRunMapperTest`, `AdminMemoryRunsIT`, `AdminMemoryReplayIT`
(dry-run writes no audit row; the replay's rows bill to `admin_replay` under the inspected user —
both load-bearing, mutation-tested per §9), `AdminMemoryGraphIT`, `AdminMemoryVectorsIT`,
`AdminMemoryVectorsSamplingIT`, `AdminMemoryHealthIT`, `AdminMemoryHealthGraphOffIT` (the graph
switch off, vector half still populated), `AdminMemoryGlobalHealthIT` +
`AdminMemoryGlobalHealthCompanionOffIT` (the install-wide entry-page op, incl. its degraded
state). The acceptance evidence for the `RetrieveOptions` refactor is that
`MemoryRetrievalDeterministicEvalIT`, `MemoryShadowRunnerIT` and the chat ITs pass **unedited** —
the only change to shipped behaviour in the whole `mezo-4qyt` epic. Every new endpoint has a
non-owner 403 case. `ArchitectureTest` (full `./mvnw test` only) enforces the `admin → companion`
direction and `feature_slices_are_cycle_free`.

Frontend (both `pnpm test` [mock] and `VITE_USE_MOCK=false pnpm test` [real]): a render test per
view (`OverviewView.test.tsx`, `RunsView.test.tsx`, `RunDetail.test.tsx`, `ReplayBox.test.tsx`,
`GraphView.test.tsx`, `GraphInspector.test.tsx`, `MapView.test.tsx`, `MapInspector.test.tsx`,
`LayersView.test.tsx`), `AdminMemoryPage.test.tsx` (view routing incl. the `overview` default,
the degraded-tile 404 discrimination, per-sibling isolation), `graphLayout.test.ts`,
`projection.test.ts`, `umapWorker.protocol.test.ts`, `contribution.test.ts` (incl.
`runVerdictSentence`'s retriever-priority tie-break and its live-`rrfK` requirement, §9),
`LayersView.test.tsx` (the stale-count data-browser link, the histogram's bucket-per-column
render, the becsült job labels, an empty-node-bucket payload rendering the vector half without
erroring).

**Gates**: contract-drift (`api/openapi.yml` + `api.gen.ts` committed), `node
scripts/gen-codemap.mjs --check`, `pnpm build`.

## 9. Decisions, gotchas & deferred

- **`ScoreBreakdownEnvelope.rerankerScore` is `1 / postRerankRank`, not a model score** —
  `MemoryRetrievalAuditWriter` writes it from the already-reranked list's position, so it restates
  the stored `rank`. The backend instead derives `fusionRank` by re-sorting stored candidates with
  the exact `MemoryCandidateFusion` comparator and returns `rerankDelta = fusionRank - rank`
  (non-null only when at least one candidate has a non-null `rerankerScore`); the UI column is
  labelled **"újrarangsorolt hely (1/hely)"**, never "reranker pontszám". A real per-candidate
  score needs the reranker prompt to return scores, not just an order (follow-up).
- **`runVerdictSentence` must be passed the LIVE `rrfK`, never a hardcoded default** — a caller
  holding the real `AdminMemoryFusionConfig` (every production caller does) MUST pass its actual
  `rrfK`; a hardcoded fallback of 60 exists ONLY for a caller with no live fusion config at all
  (`contribution.ts`'s own doc comment), because a boost that wins the sentence's comparison at
  k=60 can lose it at the server's real k, silently contradicting the stacked contribution bar
  right next to it.
- **The replay's `queryProjection` costs a SECOND embed call** — `DenseMemoryRetriever` embeds
  inside its own parallel executor and the vector never leaves it, so `AdminMemoryReplayService`
  embeds the replay query itself via `EmbeddingPort` under the same `admin_replay` context and
  hands it to `MemoryProjectionService.transform(...)`. `replayNotes` carries
  `projection_embed_extra_call` (or `pca_unavailable`) so the surface is honest about the cost.
- **The D3 label fix** (`LlmCallContext.FEATURE_ADMIN_REPLAY` / `isAdminReplay()`) is the subtlest
  change in the `mezo-4qyt` epic: naively deriving the feature label from the ambient context
  would have moved every chat turn's `query_rewrite`/`rerank` rows from `companion_recall` to
  `companion_chat`, corrupting part 1's cost matrix. The fix re-labels ONLY when the ambient
  context is already `admin_replay`; a normal chat turn is untouched.
- **SHADOW is the production default** — most runs a reviewer opens will carry the árnyék badge;
  that is expected, not a bug in the mock data.
- **`shadow_embedding_version` is always null today** — the shared-RAG-platform spec promises it,
  but nothing populates it yet (follow-up); the explorer already renders the field, so it will
  light up the moment it is written.
- **The PCA cache is per-instance** (`MemoryProjectionService`'s `ConcurrentHashMap`) — two
  backend replicas can hand two clients two different bases, and the FE additionally caches its
  UMAP fit per user in `sessionStorage`, so a reload served by the other replica can visibly move
  the map. Harmless at beta scale (follow-up).
- **The frozen knowledge-graph layout is untouched by this epic** — Gráf reads it, never writes.
- **Rétegek's "no L0–L3 overview cards" ruling is now answered elsewhere, not reversed** — the
  original `mezo-4qyt` S6 ruling kept Rétegek to raw rollups only, deferring the product-framed
  "how healthy is this, in plain terms" view; `mezo-k5zy`'s Áttekintés is that view, at BOTH the
  per-user level (this doc) and the installation level (the `/admin/memory` entry page) — Rétegek
  itself is unchanged.
- **Deferred (follow-ups filed at the end of the `mezo-4qyt` epic, see the plan's "Follow-up bd
  issues" section, still open)**: admin relevance labels on run candidates (the Phoenix eval
  pattern); a real FK from `llm_log_history.run_id` instead of the ±10-minute time-window join;
  populating `shadow_embedding_version`; the SHADOW→NEW serving-mode product decision this whole
  explorer exists to inform; a real per-candidate reranker score; sharing the PCA basis across
  replicas; the desktop mosaic treatment for the two pages moved in during part 1 (since resolved
  for `AdminCostPage` by its mezo-pfdv rebuild — see admin-hub.md §9 — `AdminAccountsPage` still
  outstanding).

## 10. Key files

- Contracts: `api/feature/admin-memory/admin-memory.yml`, `api/generate/merge.yml`
- Backend: `feature/admin/controller/AdminMemoryController.java`,
  `feature/admin/service/{AdminMemoryService,AdminMemoryRunMapper,AdminMemoryGraphMapper,
  AdminMemoryReplayService}.java`, `feature/admin/config/AdminMemoryProperties.java`,
  `feature/admin/repository/AdminAlertQuery.java` (shared with part 1 — serves both
  `AdminAlertService` and `AdminMemoryService`), `feature/companion/memory/repository/
  {MemoryPromptTraceQuery,MemoryVectorPointQuery,MemoryNeighborQuery,MemoryHealthQuery}.java`,
  `feature/companion/graph/repository/GraphStructureQuery.java`, `feature/companion/memory/
  service/{MemoryProjectionService,MemoryContextService}.java`,
  `feature/llmlog/context/LlmCallContext.java`, `techcore/security/LlmActorContext.java`,
  `techcore/configuration/FeaturesConfiguration.java` (`ADMIN_MEMORY_SWITCH`)
- Backend tests: `feature/admin/config/AdminMemoryPropertiesTest.java`,
  `feature/admin/service/AdminMemoryRunMapperTest.java`, `feature/admin/controller/
  {AdminMemoryRunsIT,AdminMemoryReplayIT,AdminMemoryGraphIT,AdminMemoryVectorsIT,
  AdminMemoryVectorsSamplingIT,AdminMemoryHealthIT,AdminMemoryHealthGraphOffIT,
  AdminMemoryGlobalHealthIT,AdminMemoryGlobalHealthCompanionOffIT}.java`
- Frontend: `features/admin/pages/AdminMemoryEntryPage.tsx`, `features/admin/memory/
  {AdminMemoryPage,MemorySegmentBar,MemoryInspector,contribution,graphLayout,umapConstants,
  umap.worker,projection}.ts(x)`, `features/admin/memory/views/{OverviewView,RunsView,RunDetail,
  ReplayBox,GraphView,GraphInspector,MapView,MapInspector,LayersView}.tsx`,
  `features/admin/lib/labels.ts` (`MEMORY_TERM_LABELS`), `data/admin/adminMemory{Api,Hooks,
  Mock}.ts`
- Docs: this file, [`admin-hub.md`](admin-hub.md) (part 1),
  [ADR 0038](../decisions/0038-admin-hub-cross-user-reads.md),
  `docs/superpowers/specs/2026-09-06-rag-memory-explorer-design.md`,
  `docs/superpowers/plans/2026-09-07-rag-memory-explorer.md`,
  `docs/superpowers/plans/2026-09-09-admin-value-dashboard-slice9.md`
