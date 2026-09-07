# RAG Memory Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An owner-only `/admin/users/:id/memory` surface that answers, without pgAdmin, *why the companion recalled this for user X* (audited run + a live dry-run replay, with the fused score decomposed per retriever), *what X's knowledge graph looks like* (force-directed, evidence-carrying edges), *where X's memories cluster* (real pgvector neighbours over a UMAP map), and *is X's vector store healthy* (per-status, per-version, staleness counts).

**Architecture:** A new `AdminMemoryApi` tag in the existing `feature/admin` backend slice, `userId` in the path, `currentUser.requireOwner()` as the literal first statement of every controller method. The admin service delegates to companion services and to NEW companion-slice queries (run list, structured edges including deleted, vector list + PCA-50, pgvector neighbours, health rollups) and calls `MemoryContextService` through a NEW `RetrieveOptions` overload whose `audit=false` path writes no `memory_retrieval_*` row. Dependency direction is `admin → companion`; companion never imports admin. Frontend: a 5th tab on the user-detail page opens a sub-route with a four-way segment bar (Futások · Gráf · Térkép · Rétegek) and a shared right-hand inspector, inside the existing `/admin` lazy chunk. Spec: `docs/superpowers/specs/2026-09-06-rag-memory-explorer-design.md`. Part 1 (the shell this rides on): `docs/superpowers/plans/2026-09-07-admin-hub.md`, `docs/features/admin-hub.md`.

**Tech Stack:** Spring Boot 4.0.0 / Java 25, Spring Data JPA + `NamedParameterJdbcTemplate` (+ the `SingleConnectionDataSource`/savepoint idiom for pgvector), PostgreSQL 16 + pgvector, openapi-merge-cli + openapi-generator-maven-plugin, Testcontainers `pgvector/pgvector:pg16`; React 19 + React Router 7, TanStack Query via `useDualQuery`, Vitest + MSW, hand-written SVG in the design 2.0 (`mozaik`/`clay`) language, `d3-force` for graph physics and `umap-js` in a Web Worker for the map.

---

## Binding decisions from the orchestrator

These were settled before planning. **Do not reopen them.** Where this section and the spec disagree, this section wins.

- **D1 — Dry-run writes NO audit row.** `serving_mode`/`consumer_policy` carry CHECK constraints; rather than widen them with a migration, the replay skips `MemoryRetrievalAuditWriter` entirely. No Liquibase changeSet in this epic.
- **D2 — Slice 6 writes a NEW feature doc**, `docs/features/admin-memory-explorer.md` (full 10-section shape per the `knowledge-base` skill), not a section inside `admin-hub.md`. `admin-hub.md` gets a cross-link only.
- **D3 — Verify the two LLM helpers' call contexts in slice 1.** Verified while planning; see *Resolved ambiguities* below — they are explicit but hard-coded to `companion_recall`, and their nested `runWith` **overwrites** an outer `admin_replay` label. Slice 1 fixes that in a non-regressing way (Task 1.6).
- **D4 — UMAP params live in a FE constants module** (`nNeighbors: 15`, `minDist: 0.1`, a fixed seed for tests) — `frontend/src/features/admin/memory/umapConstants.ts`.
- **D5 — New `@Validated @ConfigurationProperties` record `AdminMemoryProperties`**, prefix `mezo.admin.memory`, with `pca-target-dims: 50`, `vector-sample-threshold: 5000`, `neighbor-default-k: 10`, `statement-timeout: PT5S` (a `java.time.Duration`), `runs-max-page-size: 100`, `edge-weight-histogram-buckets: 10`, `replay-feature-label: admin_replay`. **Everything configurable goes to `application.yml`** — Daniel's explicit requirement. Companion-owned values (the RRF constant, the fusion weights, the decay factor) are **READ** from `MemoryPlatformProperties`/`CompanionProperties`, never duplicated here.
- **D6 — New feature switch `mezo.feature.admin-memory.enabled`**, default `false` in `application.yml`, `true` in `k8s/backend/deployment.yaml`, registered as `FeaturesConfiguration.ADMIN_MEMORY_SWITCH`, consumed via `@ConditionalOnProperty`. Beans absent ⇒ every `/api/admin/users/*/memory/**` path 404s.

---

## Resolved ambiguities (decided while planning, from the code)

These are **binding**: where this section and the spec disagree, this plan wins. Each is anchored to the file that forced the decision.

1. **`ScoreBreakdownEnvelope.rerankerScore` is NOT a model score — it is `1 / postRerankRank`.**
   `MemoryRetrievalAuditWriter.java:71` writes `command.reranked() ? 1.0 / (index + 1.0) : null`, and `index` is the position in the ALREADY-reranked list (`MemoryContextService.java:86-88` reassigns `ranked = reranker.rerank(ranked)` before the audit call). So the stored value restates the stored `rank`, and the "signed rank delta" the spec's run-detail row promises is **not** recoverable from a per-row reranker score.
   **Resolution:** the backend derives `fusionRank` by re-sorting the stored candidates with the exact `MemoryCandidateFusion` comparator (`finalScore` desc → `occurredOn` desc nulls-last → `candidateRefId` asc, `MemoryCandidateFusion.java:64-67`) and returns `rerankDelta = fusionRank - rank`, non-null only when at least one candidate has a non-null `rerankerScore`. The contract exposes `rerankerScore` verbatim but the UI column is labelled **"újrarangsorolt hely"** (`1/hely`), never "reranker pontszám". A follow-up issue records that a real per-candidate reranker score would need the LLM to return scores, not just an order.
2. **The replay's `queryProjection` costs a SECOND embed call.** `DenseMemoryRetriever` embeds inside the parallel executor and the query vector never leaves it; `MemoryContext` carries no vector. Threading it out would mean mutating the retriever contract for an admin feature.
   **Resolution:** `AdminMemoryService` embeds the replay query itself once via `EmbeddingPort` (under the same `admin_replay` `LlmCallContext`) and hands it to `MemoryProjectionService.transform(...)`. `replayNotes` carries `projection_embed_extra_call` so the surface is honest about it. In **slice 1** `queryProjection` is declared in the contract and always `null` (+ note `pca_unavailable`); **slice 2** fills it.
3. **`admin_replay` would be lost on the rewrite/rerank calls.** `LlmMemoryQueryRewriter.java:26-27` and `LlmMemoryReranker.java:47-48` bind their OWN `new LlmCallContext("companion_recall", …)` through `LlmCallContextHolder.runWith`, which save-and-restores (`LlmCallContextHolder.java:43-55`) — so a nested bind **overwrites** the admin's outer label for the duration of the inner call. D3's premise ("verify their default labels; add explicit contexts if generic") is inverted: they are explicit, and that is precisely the problem.
   **Resolution (Task 1.6):** a new constant `LlmCallContext.FEATURE_ADMIN_REPLAY` + instance method `isAdminReplay()` in the **llmlog** slice (a shared dependency of both admin and companion, so no `companion → admin` edge appears). Both helpers keep `companion_recall` **unless** the ambient context is already the admin replay, in which case they re-label to it. Nothing else moves: a chat turn's rewrite/rerank cost stays under `companion_recall` exactly as today.
   Naively deriving the feature from the ambient context would have silently moved every chat rewrite/rerank row from `companion_recall` to `companion_chat` and corrupted the part-1 cost matrix. Do not "simplify" it that way.
4. **`RetrieveOptions.reranker` / `.rewrite` are allowances, not forces.** `false` short-circuits (`shouldRerank` returns false / the rewriter is skipped); `true` means "behave exactly as production would". The replay UI labels the toggles "engedélyezve", not "kényszerítve".
5. **The replay needs the ranked candidates, which `MemoryContext` does not carry.** `MemoryContext` is `(items, promptBlock, refs, runId, traceId)`.
   **Resolution:** a new `MemoryContextService.RetrievalOutcome` record and a `retrieveDetailed(request, options)` method; all four existing public entry points delegate to it and keep their signatures and behaviour byte-for-byte.
6. **Degraded (feature off) vs. a genuinely missing run — both are 404.** A missing controller bean produces a bodyless Spring 404 (`apiFetch` synthesizes `INTERNAL_ERROR`); a hard-deleted run produces our `ADMIN_MEMORY_RUN_NOT_FOUND`.
   **Resolution:** the FE treats a 404 as *degraded* only when **no** returned `SystemMessage.code` starts with `ADMIN_MEMORY_`. Everything else re-throws and lands on the normal error state.
7. **`MemoryObservatoryService.overview(userId)` is reused unchanged** — it already takes `userId` (`MemoryObservatoryService.java:74`) and is `@Transactional(readOnly = true)`, so the admin controller calls `requireOwner()` **before** it, never inside it.
8. **Feature-map / doc drift found in part 1's docs** (slice 6 fixes it): `docs/features/admin-hub.md` §4 still lists the spec's *wrong* column names — `journal_entry.created_at`, `habit_day.date`, `water_log.created_at`, `weight_log.created_at` — while `application.yml:93-113` ships the corrected `occurred_on` / `habit_date` / `log_date` / `date`, and §4 omits `AdminProperties.reportZone` entirely.

---

## Global Constraints

- Driving epic **mezo-4qyt**. **Six branches, one per slice** (`feat/rag-explorer-s1` … `feat/rag-explorer-s6`), each cut fresh from `origin/main` in its own worktree, each its own self-PR → CI green → `gh workflow run premerge.yml -f pr=<n>` → local `--no-ff` merge → `git push`.
  **Why per-slice branches and not one stacked branch:** parallel sessions push `main` roughly daily, and this epic touches two files those sessions also touch (`frontend/src/test/msw/handlers.ts`, `frontend/src/data/hooks.ts`) plus `.beads/issues.jsonl` on every commit. A six-slice stack would accumulate a week of divergence before its first merge; six independently mergeable units each carry one day of it. The cost is six `git merge origin/main` cycles instead of one, and one hard ordering constraint: **slices 1 and 2 must be merged before slice 3 starts**, because slice 3 consumes `api.gen.ts` types they generate. Slices 4, 5 and 6 each depend only on 3.
- **Backend, ArchUnit-enforced** (`backend/src/test/java/io/mrkuhne/mezo/ArchitectureTest.java`): `@RestController` only in `..controller..`, `@Service` only in `..service..`, `@Entity` only in `..entity..`, Spring Data repositories only in `..repository..`; **no field injection** (Lombok `@RequiredArgsConstructor`); **no class-level `@Transactional`**; **no `@Value`** (`@Validated @ConfigurationProperties` records — `@ConfigurationPropertiesScan` registers them); **no raw `RuntimeException`/`IllegalStateException`/`IllegalArgumentException`** outside `techcore` (throw `SystemRuntimeErrorException`); every `@RestController` **must implement a generated `io.mrkuhne.mezo.api.controller.<Tag>Api`** (`controllers_implement_generated_api`, ArchitectureTest.java:131).
- **`feature_slices_are_cycle_free`** (ArchitectureTest.java:75) is a `FreezingArchRule` over `io.mrkuhne.mezo.feature.(*)..`. `admin → companion` is a NEW edge and must not create a cycle: **nothing in `feature/companion` may import `io.mrkuhne.mezo.feature.admin`.** The frozen store (`backend/src/test/resources/archunit-store`) tolerates only the two pre-existing cycles; a new one fails the build. **Check `git status` on `archunit-store` before every commit** — a green run can silently empty it (see the ArchUnit-store-corruption trap in the memory notes).
- `currentUser.requireOwner()` is the **literal first statement** of every controller method and is **never** called inside an open `@Transactional` — it issues a `touchLastSeen` UPDATE (`CurrentUser.java:38-43`).
- Companion/graph beans are all `@ConditionalOnProperty` (`FeaturesConfiguration.COMPANION_SWITCH`, `.KNOWLEDGE_GRAPH_SWITCH`). The admin slice consumes every one of them through **`ObjectProvider<T>`** and answers 404 `ADMIN_MEMORY_DISABLED` when a switch is off — never a 500 from a missing bean.
- **Contract chain**: new fragment `api/feature/admin-memory/admin-memory.yml` → append one `- inputFile:` line to `api/generate/merge.yml` → `cd api/generate && npm run generate:api` → `cd frontend && pnpm generate:api`. Both `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` are committed artifacts guarded by the contract-drift CI gate.
- **Codemap gate**: `node scripts/gen-codemap.mjs` must be re-run and `docs/CODEMAP.md` committed in the same change that adds a backend package or a frontend directory (`--check` is the gate). Slice 2 adds no packages; slices 1, 3 do.
- **Backend tests**: focused runs are always `cd backend && ./mvnw test -Dtest='...' -Dmezo.test.use-testcontainers=true -q` — the fixed compose DB races and fabricates failures. ArchUnit runs only in an unfiltered run, so **`./mvnw clean test -Dmezo.test.use-testcontainers=true` must pass once before each backend PR**.
- **Frontend tests run in BOTH modes**: `cd frontend && pnpm test` (unset ⇒ **real** for the runner) **and** `VITE_USE_MOCK=true pnpm test`, plus `pnpm build`. `pnpm test <file>` does **not** scope — arguments after the suite are ignored and the whole suite runs.
- Error codes are plain strings via `SystemMessage.error("CODE")`; every new code gets a **Hungarian** line in `backend/src/main/resources/messages.properties`.
- All user-facing copy is **Hungarian**; all code, comments and javadoc are **English**.
- Never hand-edit `docs/design_2.0/prototypes/*.html` — they are `cat`-assembled by `build.sh` from `src/<name>-head.html` + the two sprite sheets + `src/<name>-body.html`.
- Never touch the `image:` line of `k8s/backend/deployment.yaml` (the release bot rewrites it).
- Resolve a `.beads/issues.jsonl` conflict by taking either side and re-running `node scripts/check-beads-backup.mjs --fix`. After any `bd import`, **re-verify statuses from the exported JSONL** — unioning silently re-opens issues you just closed.

---

## File structure

**Contract — new:** `api/feature/admin-memory/admin-memory.yml` (tag `AdminMemory` → generated `AdminMemoryApi`); **modified:** `api/generate/merge.yml`.

**Backend — new in `backend/src/main/java/io/mrkuhne/mezo/feature/admin/`**

| File | Slice | Responsibility |
|---|---|---|
| `config/AdminMemoryProperties.java` | 1 | `mezo.admin.memory` — the D5 knobs |
| `service/AdminMemoryService.java` | 1,2 | orchestrates every endpoint; owns the `ObjectProvider` 404 gate |
| `service/AdminMemoryRunMapper.java` | 1 | run/candidate entities + config → generated DTOs, incl. `fusionRank`/`rerankDelta` |
| `service/AdminMemoryReplayService.java` | 1 | `LlmActorContext` override + `admin_replay` context + `RetrieveOptions` call |
| `service/AdminMemoryGraphMapper.java` | 2 | structured node/edge rows → DTOs, evidence json → typed list |
| `controller/AdminMemoryController.java` | 1,2 | implements generated `AdminMemoryApi` |

**Backend — new in `feature/companion/`**

| File | Slice | Responsibility |
|---|---|---|
| `memory/repository/MemoryPromptTraceQuery.java` | 1 | `ai_message.recalled_memories` lookup by `retrievalRunId` (native, jsonb containment) |
| `graph/repository/GraphStructureQuery.java` | 2 | native node/edge reads that see past `@SQLRestriction` (`includeDeleted`) |
| `memory/repository/MemoryVectorPointQuery.java` | 2 | vector+item list for the map (JDBC + savepoint, pgvector) |
| `memory/repository/MemoryNeighborQuery.java` | 2 | pgvector cosine neighbours with real distance |
| `memory/repository/MemoryHealthQuery.java` | 2 | status/version/staleness/state/histogram rollups |
| `memory/service/MemoryProjectionService.java` | 2 | PCA-50 power-iteration SVD + per-user cache + sampling + `transform()` |

**Backend — modified:** `feature/companion/memory/service/MemoryContextService.java` (`RetrieveOptions`, `RetrievalOutcome`, `retrieveDetailed`), `.../MemoryQueryPreparer.java` (`prepare(request, allowRewrite)`), `.../MemoryReranker.java` + `LlmMemoryReranker.java` + `LlmMemoryQueryRewriter.java` (replay label), `feature/companion/memory/repository/MemoryRetrievalRunRepository.java` + `MemoryRetrievalResultRepository.java` (finders), `feature/llmlog/context/LlmCallContext.java` (`FEATURE_ADMIN_REPLAY`, `isAdminReplay()`), `feature/llmlog/service/LlmActorResolver.java` (override first), `techcore/security/LlmActorContext.java` (`override`/`runAsOverride`), `techcore/configuration/FeaturesConfiguration.java` (`ADMIN_MEMORY_SWITCH`), `resources/application.yml`, `resources/messages.properties`, `src/test/resources/application.properties`, `k8s/backend/deployment.yaml`.

**Frontend — new `frontend/src/features/admin/memory/`:** `AdminMemoryPage.tsx`, `MemorySegmentBar.tsx`, `MemoryInspector.tsx`, `views/RunsView.tsx`, `views/RunDetail.tsx`, `views/ReplayBox.tsx`, `views/GraphView.tsx`, `views/MapView.tsx`, `views/LayersView.tsx`, `contribution.ts`, `graphLayout.ts`, `umapConstants.ts`, `umap.worker.ts`, `projection.ts`, plus a `.test.tsx`/`.test.ts` beside each.
**Frontend — new data:** `frontend/src/data/admin/adminMemory{Api,Hooks,Mock}.ts`.
**Frontend — modified:** `features/admin/adminRoutes.tsx`, `features/admin/pages/AdminUserDetailPage.tsx` (5th tab), `data/hooks.ts`, `test/msw/handlers.ts`, `styles/prototype.css`, `package.json`/`pnpm-lock.yaml`.

**Docs:** `docs/design_2.0/prototypes/src/admin-memory-{head,body}.html` + `build.sh` + `prototypes/README.md`; `docs/features/admin-memory-explorer.md` (new); `docs/features/admin-hub.md`, `docs/features/insights.md`, `docs/features/companion.md` (staleness); `docs/CODEMAP.md`.

---

## Slice 0 — Epic scaffolding

**Files:** none (git + bd only)

- [ ] **Step 0.1: File the child issues**

```bash
bd show mezo-4qyt
for t in "S1 Backend: AdminMemory contract, runs list/detail, dry-run replay" \
         "S2 Backend: structured graph, vector list + PCA-50, neighbours, health" \
         "S3 FE: admin-memory.html prototype, shell, Futasok (runs + replay)" \
         "S4 FE: Graf view (d3-force, SVG, node/edge inspector)" \
         "S5 FE: Terkep view (umap worker, scatter, neighbours)" \
         "S6 FE: Retegek view + docs (feature doc, staleness, codemap)" ; do
  bd create --title "$t" --type task --priority 2 --parent mezo-4qyt
done
bd list --parent mezo-4qyt
```

Expected: six child issues. Claim each with `bd update <id> --claim` at slice start, `bd close <id>` at slice end, and put its id in **every** commit subject for that slice (`feat(api): admin memory runs contract (mezo-xxxx)`).

- [ ] **Step 0.2: Record the branch order in the epic**

```bash
bd comment mezo-4qyt --body "Branches: feat/rag-explorer-s1..s6, one PR each. Order: s1 and s2 must be on main before s3 starts (s3 consumes their api.gen.ts types). s4/s5/s6 depend only on s3."
```

**Done when:** `bd list --parent mezo-4qyt` shows six open tasks and the ordering comment is on the epic.

---

## Slice 1 — Backend: runs list, run detail, dry-run replay

Branch `feat/rag-explorer-s1`. The slice that changes the companion pipeline; everything else is additive.

**Files:**
- Create: `api/feature/admin-memory/admin-memory.yml`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/admin/config/AdminMemoryProperties.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/admin/service/AdminMemoryService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/admin/service/AdminMemoryRunMapper.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/admin/service/AdminMemoryReplayService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/admin/controller/AdminMemoryController.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/repository/MemoryPromptTraceQuery.java`
- Modify: `api/generate/merge.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryContextService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryQueryPreparer.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryReranker.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/LlmMemoryReranker.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/LlmMemoryQueryRewriter.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/repository/MemoryRetrievalRunRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/repository/MemoryRetrievalResultRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/context/LlmCallContext.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmActorResolver.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/security/LlmActorContext.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`
- Modify: `backend/src/main/resources/application.yml`, `messages.properties`
- Modify: `backend/src/test/resources/application.properties`
- Modify: `k8s/backend/deployment.yaml`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/admin/config/AdminMemoryPropertiesTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/admin/controller/AdminMemoryRunsIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/admin/controller/AdminMemoryReplayIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/admin/service/AdminMemoryRunMapperTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/techcore/security/LlmActorContextOverrideTest.java`

**Interfaces produced:**
- Generated `io.mrkuhne.mezo.api.controller.AdminMemoryApi` + DTOs `AdminMemoryRunSummary`, `AdminMemoryRetrieverTrace`, `AdminMemoryRunPageResponse`, `AdminMemoryScoreBreakdown`, `AdminMemoryCandidate`, `AdminMemoryFusionConfig`, `AdminMemoryPromptTraceItem`, `AdminMemoryRunDetailResponse`, `AdminMemoryReplayRequest`.
- `AdminMemoryProperties` record.
- `FeaturesConfiguration.ADMIN_MEMORY_SWITCH`.
- `MemoryContextService.RetrieveOptions` / `.RetrievalOutcome` / `retrieveDetailed(...)`.
- `LlmCallContext.FEATURE_ADMIN_REPLAY` / `isAdminReplay()`; `LlmActorContext.override()` / `runAsOverride(...)`.

---

- [ ] **Step 1.1: Write the contract fragment (runs + replay only)**

Create `api/feature/admin-memory/admin-memory.yml`. Model it on `api/feature/admin-insights/admin-insights.yml`: `openapi: 3.0.3`, an `info` block, one `tags` entry, and explicit `401`/`403` responses on every operation referencing `#/components/schemas/SystemMessageList` (resolved from `api/common/common-schemas.yml` at merge time). Slice 2 appends its four paths and their schemas to this same file.

```yaml
openapi: 3.0.3
info:
  title: mezo admin-memory fragment
  version: 1.0.0
tags:
  - name: AdminMemory
    description: >
      OWNER-only RAG memory explorer for ONE inspected user (mezo-4qyt). Every operation
      returns 403 AUTH_FORBIDDEN for a non-owner and 404 when
      mezo.feature.admin-memory.enabled (or the companion/knowledge-graph switch a given
      endpoint needs) is off. Read-only apart from POST /replay, which is itself
      side-effect-free: it writes no memory_retrieval_* row and never touches the
      inspected user's memory.
paths:
  /api/admin/users/{userId}/memory/runs:
    get:
      tags: [AdminMemory]
      operationId: listAdminMemoryRuns
      summary: One user's audited retrieval runs, newest first (AdminMemory)
      parameters:
        - { name: userId, in: path, required: true, schema: { type: string, format: uuid } }
        - { name: page, in: query, required: false, schema: { type: integer, format: int32, minimum: 0, default: 0 } }
        - { name: size, in: query, required: false, schema: { type: integer, format: int32, minimum: 1, default: 25 } }
      responses:
        '200':
          description: One page of runs
          content:
            application/json:
              schema: { $ref: '#/components/schemas/AdminMemoryRunPageResponse' }
        '401': { $ref: '#/components/responses/AdminMemoryUnauthorized' }
        '403': { $ref: '#/components/responses/AdminMemoryForbidden' }
        '404': { $ref: '#/components/responses/AdminMemoryDisabled' }
  /api/admin/users/{userId}/memory/runs/{runId}:
    get:
      tags: [AdminMemory]
      operationId: getAdminMemoryRun
      summary: One run with its ranked candidates and score decomposition (AdminMemory)
      parameters:
        - { name: userId, in: path, required: true, schema: { type: string, format: uuid } }
        - { name: runId, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        '200':
          description: Run detail
          content:
            application/json:
              schema: { $ref: '#/components/schemas/AdminMemoryRunDetailResponse' }
        '401': { $ref: '#/components/responses/AdminMemoryUnauthorized' }
        '403': { $ref: '#/components/responses/AdminMemoryForbidden' }
        '404':
          description: No such run for this user, or the feature is off
            (ADMIN_MEMORY_RUN_NOT_FOUND / ADMIN_MEMORY_DISABLED)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/admin/users/{userId}/memory/replay:
    post:
      tags: [AdminMemory]
      operationId: replayAdminMemory
      summary: Side-effect-free NEW-mode dry run for one query (AdminMemory)
      parameters:
        - { name: userId, in: path, required: true, schema: { type: string, format: uuid } }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/AdminMemoryReplayRequest' }
      responses:
        '200':
          description: Dry-run detail, same shape as a run detail
          content:
            application/json:
              schema: { $ref: '#/components/schemas/AdminMemoryRunDetailResponse' }
        '400':
          description: Blank or over-long query (ADMIN_MEMORY_REPLAY_QUERY_INVALID)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401': { $ref: '#/components/responses/AdminMemoryUnauthorized' }
        '403': { $ref: '#/components/responses/AdminMemoryForbidden' }
        '404': { $ref: '#/components/responses/AdminMemoryDisabled' }
components:
  responses:
    AdminMemoryUnauthorized:
      description: Missing/invalid token
      content:
        application/json:
          schema: { $ref: '#/components/schemas/SystemMessageList' }
    AdminMemoryForbidden:
      description: Not the owner (AUTH_FORBIDDEN)
      content:
        application/json:
          schema: { $ref: '#/components/schemas/SystemMessageList' }
    AdminMemoryDisabled:
      description: Feature or its companion dependency is off (ADMIN_MEMORY_DISABLED)
      content:
        application/json:
          schema: { $ref: '#/components/schemas/SystemMessageList' }
  schemas:
    AdminMemoryRetrieverTrace:
      type: object
      required: [retriever, durationMs, candidateCount]
      properties:
        retriever: { type: string, description: 'dense | lexical | graph | facts' }
        durationMs: { type: integer, format: int64 }
        candidateCount: { type: integer, format: int32 }
        error: { type: string, nullable: true, description: 'TIMEOUT, INTERRUPTED, an exception simple name, or null' }
    AdminMemoryRunSummary:
      type: object
      required:
        [id, createdAt, consumerPolicy, servingMode, queryMode, rawQuery,
         candidateCount, selectedCount, durationMs, embeddingVersion, retrieverTrace]
      properties:
        id: { type: string, format: uuid, nullable: true, description: 'null on a dry run' }
        createdAt: { type: string, format: date-time }
        consumerPolicy: { type: string, description: 'CHAT_AMBIENT | MORNING_BRIEFING | WEEKLY_MEMOIR | PREDICTION_EVIDENCE | REFLECTION' }
        servingMode: { type: string, description: 'OLD | SHADOW | NEW' }
        queryMode: { type: string, description: 'NONE | RAW | REWRITE' }
        rawQuery: { type: string }
        rewrittenQuery: { type: string, nullable: true }
        candidateCount: { type: integer, format: int32 }
        selectedCount: { type: integer, format: int32 }
        durationMs: { type: integer, format: int64 }
        embeddingVersion: { type: string }
        shadowEmbeddingVersion: { type: string, nullable: true, description: 'always null today' }
        errorCode: { type: string, nullable: true }
        traceId: { type: string, format: uuid, nullable: true }
        retrieverTrace:
          type: array
          items: { $ref: '#/components/schemas/AdminMemoryRetrieverTrace' }
    AdminMemoryRunPageResponse:
      type: object
      required: [page, size, total, retentionDays, items]
      properties:
        page: { type: integer, format: int32 }
        size: { type: integer, format: int32, description: 'the size actually used; clamped, never rejected' }
        total: { type: integer, format: int64 }
        retentionDays:
          type: integer
          format: int32
          description: 'mezo.companion.memory-platform.audit.retention-days — runs older than this are hard-deleted'
        items:
          type: array
          items: { $ref: '#/components/schemas/AdminMemoryRunSummary' }
    AdminMemoryScoreBreakdown:
      type: object
      required: [retrieverRanks, rrf, finalScore]
      properties:
        retrieverRanks:
          type: object
          additionalProperties: { type: integer, format: int32 }
          description: 'retriever name -> 1-based rank inside that retriever; an ABSENT key means the retriever did not return this candidate'
        rrf: { type: number, format: double }
        pinnedBoost: { type: number, format: double, nullable: true }
        sourceReliabilityBoost: { type: number, format: double, nullable: true }
        temporalBoost: { type: number, format: double, nullable: true }
        salienceBoost: { type: number, format: double, nullable: true }
        recencyBoost: { type: number, format: double, nullable: true }
        rerankerScore:
          type: number
          format: double
          nullable: true
          description: >
            NOT a model relevance score. The pipeline stores 1/postRerankRank, i.e. a
            restatement of `rank`. Render it as "ujrarangsorolt hely", never as a score.
        finalScore: { type: number, format: double }
    AdminMemoryCandidate:
      type: object
      required: [rank, selected, candidateKind, candidateRefId, contentSnapshot, scoreBreakdown]
      properties:
        resultId: { type: string, format: uuid, nullable: true, description: 'null on a dry run' }
        rank: { type: integer, format: int32, description: 'final (post-rerank) rank as stored' }
        fusionRank:
          type: integer
          format: int32
          description: 'rank the deterministic fusion order alone would have given, derived from finalScore'
        rerankDelta:
          type: integer
          format: int32
          nullable: true
          description: 'fusionRank - rank; null when the run was not reranked'
        selected: { type: boolean, description: 'made it into the rendered context' }
        candidateKind: { type: string }
        candidateRefId: { type: string, format: uuid }
        memoryItemId: { type: string, format: uuid, nullable: true }
        contentSnapshot: { type: string }
        occurredOn: { type: string, format: date, nullable: true }
        scoreBreakdown: { $ref: '#/components/schemas/AdminMemoryScoreBreakdown' }
    AdminMemoryFusionConfig:
      type: object
      required: [rrfK, retrieverWeights]
      description: >
        Read live from mezo.companion.memory-platform.fusion. Never duplicated in
        mezo.admin.memory: the client draws contributions with the SAME constants the
        pipeline fused with. A run stored before a weight change was fused with the OLD
        weights, so a recomputed contribution can differ from the stored rrf — the surface
        says so.
      properties:
        rrfK: { type: integer, format: int32 }
        retrieverWeights:
          type: object
          additionalProperties: { type: number, format: double }
        pinnedBoost: { type: number, format: double }
        sourceReliabilityMaxBoost: { type: number, format: double }
        temporalMaxBoost: { type: number, format: double }
        salienceMaxAdjustment: { type: number, format: double }
        recencyMaxBoost: { type: number, format: double }
    AdminMemoryPromptTraceItem:
      type: object
      required: [kind, refId, label]
      properties:
        kind: { type: string }
        refId: { type: string, format: uuid }
        occurredOn: { type: string, format: date, nullable: true }
        label: { type: string }
        gist: { type: string, nullable: true }
        similarity: { type: number, format: double }
        retrievalResultId: { type: string, format: uuid, nullable: true }
        memoryItemId: { type: string, format: uuid, nullable: true }
        indicator: { type: string, nullable: true }
    AdminMemoryRunDetailResponse:
      type: object
      required: [run, candidates, fusion, dryRun, replayNotes]
      properties:
        run: { $ref: '#/components/schemas/AdminMemoryRunSummary' }
        candidates:
          type: array
          items: { $ref: '#/components/schemas/AdminMemoryCandidate' }
        fusion: { $ref: '#/components/schemas/AdminMemoryFusionConfig' }
        promptTrace:
          type: array
          nullable: true
          description: 'ai_message.recalled_memories for this run; null when no prompt imprint exists'
          items: { $ref: '#/components/schemas/AdminMemoryPromptTraceItem' }
        promptTraceReason:
          type: string
          nullable: true
          description: 'SHADOW_RUN | NO_PROMPT_IMPRINT | DRY_RUN — why promptTrace is null'
        dryRun: { type: boolean }
        queryProjection:
          type: array
          nullable: true
          description: 'dry run only: the query vector in the PCA-50 space, for the map'
          items: { type: number, format: float }
        replayNotes:
          type: array
          description: 'honesty flags, e.g. reranker_skipped, rewrite_skipped, projection_embed_extra_call, pca_unavailable'
          items: { type: string }
    AdminMemoryReplayRequest:
      type: object
      required: [query]
      properties:
        query: { type: string, minLength: 1, maxLength: 500 }
        reranker: { type: boolean, default: false, description: 'ALLOW the LLM reranker (costs a smart-tier call); the pipeline still decides whether it is needed' }
        rewrite: { type: boolean, default: false, description: 'ALLOW the LLM query rewrite (costs a call)' }
        consumerPolicy:
          type: string
          enum: [CHAT_AMBIENT, MORNING_BRIEFING, WEEKLY_MEMOIR, PREDICTION_EVIDENCE, REFLECTION]
          default: CHAT_AMBIENT
        asOf: { type: string, format: date, nullable: true, description: 'defaults to today in the server zone' }
```

- [ ] **Step 1.2: Register the fragment and regenerate**

Append **one line** to `api/generate/merge.yml`, after `../feature/admin-data/admin-data.yml`:

```yaml
  - inputFile: ../feature/admin-memory/admin-memory.yml
```

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api && cd ..
grep -n "AdminMemory" api/openapi.yml | head
grep -n "AdminMemoryRunDetailResponse" frontend/src/data/_client/api.gen.ts | head -3
```

Expected: the tag and every schema appear in both artifacts.

**Done when:** `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` both carry the `AdminMemory` tag and the nine schemas, and both are staged as committed artifacts.

- [ ] **Step 1.3: Write the failing properties test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/admin/config/AdminMemoryPropertiesTest.java`:

```java
package io.mrkuhne.mezo.feature.admin.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** The shipped mezo.admin.memory defaults, and the replay label pinned to its constant (mezo-4qyt). */
class AdminMemoryPropertiesTest extends AbstractIntegrationTest {

    @Autowired private AdminMemoryProperties properties;

    @Test
    void testDefaults_shouldMatchTheShippedYaml_whenContextBoots() {
        assertThat(properties.pcaTargetDims()).isEqualTo(50);
        assertThat(properties.vectorSampleThreshold()).isEqualTo(5000);
        assertThat(properties.neighborDefaultK()).isEqualTo(10);
        assertThat(properties.statementTimeout()).isEqualTo(Duration.ofSeconds(5));
        assertThat(properties.runsMaxPageSize()).isEqualTo(100);
        assertThat(properties.edgeWeightHistogramBuckets()).isEqualTo(10);
    }

    /**
     * The label the admin path binds MUST equal the constant the two companion LLM helpers
     * compare against (Task 1.6) — a rename on one side would silently stop re-labelling the
     * replay's rewrite/rerank rows, and the per-replay cost figure would quietly go wrong.
     */
    @Test
    void testReplayFeatureLabel_shouldEqualTheSharedConstant_whenDefaulted() {
        assertThat(properties.replayFeatureLabel()).isEqualTo(LlmCallContext.FEATURE_ADMIN_REPLAY);
    }

    @Test
    void testStatementTimeoutSql_shouldRenderMilliseconds_whenAskedForSqlForm() {
        assertThat(properties.statementTimeoutSql()).isEqualTo("5000ms");
    }
}
```

```bash
cd backend && ./mvnw test -Dtest='AdminMemoryPropertiesTest' -Dmezo.test.use-testcontainers=true -q
```

Expected: FAIL — `AdminMemoryProperties` does not exist (compile error).

- [ ] **Step 1.4: Write the properties record, the switch, the YAML and the messages**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/admin/config/AdminMemoryProperties.java`:

```java
package io.mrkuhne.mezo.feature.admin.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * {@code mezo.admin.memory} — the RAG explorer's tuning knobs (mezo-4qyt).
 *
 * <p>Deliberately does NOT carry the RRF constant, the per-retriever fusion weights or the graph
 * decay factor: those are the COMPANION's, read live from {@code MemoryPlatformProperties} /
 * {@code CompanionProperties}. Duplicating them here would let the explorer draw a score
 * decomposition with different constants than the pipeline actually fused with, which is the one
 * thing this surface exists to make trustworthy.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.admin.memory")
public record AdminMemoryProperties(
        /** Server-side PCA output dimensionality handed to the client's UMAP. */
        @Min(2) @Max(200) int pcaTargetDims,
        /** Above this many ready vectors the map samples (newest + most salient first). */
        @Min(100) @Max(100_000) int vectorSampleThreshold,
        /** Default k for the neighbour probe. */
        @Min(1) @Max(50) int neighborDefaultK,
        /** SET LOCAL statement_timeout applied to every native/dynamic query in this slice. */
        @NotNull Duration statementTimeout,
        /** Upper clamp for the run list page size; an oversized request is clamped, never rejected. */
        @Min(1) @Max(500) int runsMaxPageSize,
        /** Bucket count for the /health edge-weight histogram. */
        @Min(2) @Max(50) int edgeWeightHistogramBuckets,
        /** llm_log_history.feature label the dry-run replay bills under. */
        @NotBlank String replayFeatureLabel) {

    /** {@code statementTimeout} in the form Postgres accepts after {@code SET LOCAL}. */
    public String statementTimeoutSql() {
        return statementTimeout.toMillis() + "ms";
    }
}
```

In `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`, beside `ADMIN_INSIGHTS_SWITCH`:

```java
    /**
     * RAG memory explorer ({@code /api/admin/users/*}{@code /memory/**}, mezo-4qyt). Off ⇒ those
     * endpoints 404 and no admin-memory bean exists; the admin hub's own endpoints are unaffected.
     * A given endpoint ADDITIONALLY needs {@link #COMPANION_SWITCH} (runs, replay, vectors,
     * health) or {@link #KNOWLEDGE_GRAPH_SWITCH} (the graph endpoint) — the controller consumes
     * those beans through {@code ObjectProvider} and answers 404 ADMIN_MEMORY_DISABLED when one
     * is absent, rather than failing to start.
     */
    public static final String ADMIN_MEMORY_SWITCH = "mezo.feature.admin-memory.enabled";
```

In `backend/src/main/resources/application.yml`, inside the existing `mezo.admin:` block (after `feature-map:`, keeping the two-space indentation of `browser:`):

```yaml
    # RAG memory explorer tunables (mezo-4qyt). NOTE the deliberate omissions: the RRF
    # constant, the per-retriever fusion weights and the graph decay factor are the
    # companion's (mezo.companion.memory-platform.fusion / mezo.companion.graph) and are
    # READ from there, never mirrored here.
    memory:
      # Server-side PCA output dims handed to the client's UMAP (payload: ~0.6 MB / 3000 items).
      pca-target-dims: 50
      # Above this many ready vectors the map samples newest + most salient first and says so.
      vector-sample-threshold: 5000
      # Default k for the pgvector neighbour probe.
      neighbor-default-k: 10
      # SET LOCAL statement_timeout for every native/dynamic query in this slice, like the hub's 5s.
      statement-timeout: PT5S
      # Run-list page size clamp; an oversized request is clamped, never rejected.
      runs-max-page-size: 100
      # /health edge-weight histogram buckets over the 0..1 weight range.
      edge-weight-histogram-buckets: 10
      # llm_log_history.feature the dry-run replay bills under; must equal
      # LlmCallContext.FEATURE_ADMIN_REPLAY (AdminMemoryPropertiesTest pins them together).
      replay-feature-label: admin_replay
```

and, under the existing `mezo.feature:` block, beside `admin-insights:`:

```yaml
    # RAG memory explorer (mezo-4qyt) — /api/admin/users/{id}/memory/**. Off ⇒ those endpoints
    # 404; the admin hub's own endpoints are unaffected.
    admin-memory:
      enabled: false
```

Append to `backend/src/main/resources/messages.properties`:

```properties
ADMIN_MEMORY_DISABLED=A memória-felderítő ki van kapcsolva.
ADMIN_MEMORY_RUN_NOT_FOUND=A keresési futás nem található (lehet, hogy a 30 napos megőrzés törölte).
ADMIN_MEMORY_REPLAY_QUERY_INVALID=A próbakérdés üres vagy túl hosszú.
ADMIN_MEMORY_ITEM_NOT_FOUND=A memória-elem nem található.
ADMIN_MEMORY_NO_VECTOR=Ehhez az elemhez nincs kiszolgálható vektor.
ADMIN_MEMORY_QUERY_TIMEOUT=A lekérdezés túllépte az időkorlátot.
```

In `k8s/backend/deployment.yaml`, beside `MEZO_FEATURE_ADMIN_INSIGHTS_ENABLED`:

```yaml
            - name: MEZO_FEATURE_ADMIN_MEMORY_ENABLED
              value: "true"
```

In `backend/src/test/resources/application.properties`, beside the `admin-insights` line at the tail:

```properties
# RAG memory explorer (mezo-4qyt) — off by default in application.yml; ITs need the controller mounted.
mezo.feature.admin-memory.enabled=true
```

```bash
cd backend && ./mvnw test -Dtest='AdminMemoryPropertiesTest' -Dmezo.test.use-testcontainers=true -q
```

Expected: PASS once Step 1.6's `LlmCallContext.FEATURE_ADMIN_REPLAY` exists; until then the `replayFeatureLabel` assertion fails to compile. Do Step 1.6 next, then re-run.

**Done when:** the properties test is green, `mezo.admin.memory` and `mezo.feature.admin-memory` are in `application.yml` with the comments above, the k8s env var is set, and the test profile turns the switch on.

- [ ] **Step 1.5: Add the repository finders**

In `MemoryRetrievalRunRepository`:

```java
    /**
     * mezo-4qyt: the admin explorer's run list. Paged and owner-scoped; the entity's
     * {@code @SQLRestriction("is_deleted = false")} already hides soft-deleted runs, and the
     * retention job HARD-deletes past 30 days, so a page can legitimately shrink between two
     * requests — the response carries {@code retentionDays} so the surface can say why.
     */
    Page<MemoryRetrievalRunEntity> findByCreatedByOrderByCreatedAtDesc(UUID createdBy, Pageable pageable);

    Optional<MemoryRetrievalRunEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);
```

In `MemoryRetrievalResultRepository`:

```java
    /** mezo-4qyt: one run's candidates in stored (final, post-rerank) rank order. */
    List<MemoryRetrievalResultEntity> findByRunIdAndCreatedByOrderByRankAsc(UUID runId, UUID createdBy);
```

**Done when:** both repositories compile with the new finders and the imports (`org.springframework.data.domain.Page`/`Pageable`).

- [ ] **Step 1.6: The actor override and the `admin_replay` label (the D3 fix)**

In `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/context/LlmCallContext.java`:

```java
    /**
     * The admin explorer's dry-run replay (mezo-4qyt). Lives HERE, in llmlog, on purpose: both
     * {@code feature/admin} (which binds it) and {@code feature/companion} (whose rewrite and
     * rerank helpers check for it) need the same string, and llmlog is the slice both already
     * depend on — putting it in {@code feature/admin} would create a {@code companion → admin}
     * edge and break {@code feature_slices_are_cycle_free}.
     */
    public static final String FEATURE_ADMIN_REPLAY = "admin_replay";

    /** True when this context is the admin explorer's dry-run replay. */
    public boolean isAdminReplay() {
        return FEATURE_ADMIN_REPLAY.equals(feature);
    }
```

In `backend/src/main/java/io/mrkuhne/mezo/techcore/security/LlmActorContext.java`, add an override tier **above** the existing one:

```java
    private static final ThreadLocal<UUID> OVERRIDE = new ThreadLocal<>();

    /**
     * The account that OUTRANKS the request principal (mezo-4qyt) — null when nothing set it.
     *
     * <p>{@link #runAs} deliberately loses to a JWT principal: a cron thread has no principal, so
     * "principal wins" is right there. The admin explorer's dry-run replay is the opposite case:
     * the principal is the OWNER, but the embedding / rewrite / rerank calls are made ON BEHALF OF
     * the inspected user, and billing them to the owner would make the per-user cost matrix lie.
     * This is the ONLY intended caller; keep it that way — a second one is a design smell, not a
     * reuse opportunity.
     */
    public static UUID override() {
        return OVERRIDE.get();
    }

    /** Runs {@code body} with {@code userId} outranking any request principal, then restores. */
    public static <T> T runAsOverride(UUID userId, Supplier<T> body) {
        UUID previous = OVERRIDE.get();
        OVERRIDE.set(userId);
        try {
            return body.get();
        } finally {
            if (previous == null) {
                OVERRIDE.remove();
            } else {
                OVERRIDE.set(previous);
            }
        }
    }
```

In `LlmActorResolver.currentActor()`, make the override the first check and extend the class javadoc:

```java
    public UUID currentActor() {
        UUID override = LlmActorContext.override();
        if (override != null) {
            // mezo-4qyt: an explicit override outranks even a request principal — see
            // LlmActorContext#override for why the admin replay needs exactly that.
            return override;
        }
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        // ... unchanged
    }
```

In `LlmMemoryQueryRewriter`, replace the constant use with a derivation:

```java
    private static final String FEATURE_COMPANION_RECALL = "companion_recall";
    private static final String OPERATION = "query_rewrite";
    private static final LlmCallContext CALL_CONTEXT =
            new LlmCallContext(FEATURE_COMPANION_RECALL, OPERATION, null, null);

    @Override
    public String rewrite(String currentQuery, List<CompanionLlm.Turn> boundedHistory) {
        return llmCallContextHolder.runWith(callContext(), () -> companionLlm.complete(
                SYSTEM_PROMPT, boundedHistory, currentQuery, List.of(), Map.of()));
    }

    /**
     * {@code companion_recall/query_rewrite} for every caller EXCEPT the admin explorer's dry-run
     * replay (mezo-4qyt), which re-labels this call to its own feature so one replay's total cost
     * is priceable in the admin cost matrix.
     *
     * <p>Why not simply inherit the ambient feature: {@code LlmCallContextHolder#runWith} save-and-
     * restores, so a chat turn's ambient {@code companion_chat} is live on this thread too — and
     * inheriting it would silently move EVERY chat rewrite row out of {@code companion_recall} and
     * corrupt the shipped cost matrix. Only the replay label is honoured.
     */
    private LlmCallContext callContext() {
        LlmCallContext ambient = llmCallContextHolder.get();
        return ambient.isAdminReplay()
                ? new LlmCallContext(ambient.feature(), OPERATION, null, null)
                : CALL_CONTEXT;
    }
```

Apply the identical treatment in `LlmMemoryReranker` with `OPERATION = "rerank"`, keeping the existing "bind INSIDE the submitted task" arrangement — the holder is thread-bound and the adapter runs on `applicationTaskExecutor`, so **resolve `callContext()` on the CALLING thread and capture it**, then bind the captured value inside the task:

```java
            LlmCallContext context = callContext(); // resolved on the caller's thread: the ambient
                                                    // admin_replay binding does not exist on the pool thread
            call = applicationTaskExecutor.submit(() -> llmCallContextHolder.runWith(
                    context, () -> llm.completeSmart(SYSTEM_PROMPT, render(exposed))));
```

Create `backend/src/test/java/io/mrkuhne/mezo/techcore/security/LlmActorContextOverrideTest.java` (plain unit test, no Spring):

```java
/** mezo-4qyt: the override outranks a request principal; nesting and throwing both restore. */
class LlmActorContextOverrideTest {

    @Test
    void testOverride_shouldWinOverJwtPrincipal_whenSet() { /* set a Jwt authentication, assert the override id comes back */ }

    @Test
    void testOverride_shouldRestorePrevious_whenBodyThrows() { /* assertThatThrownBy + assert override() is null after */ }

    @Test
    void testOverride_shouldBeNull_whenNothingSetIt() { /* the resolver falls back to runAs, then to the principal */ }
}
```

**Traps for this step:**
- `LlmActorContext` currently has no `Supplier` import and its only method returns `void`; the new overload is generic and needs `java.util.function.Supplier`.
- Do **not** also change `runAs`'s precedence. Cron fan-out (`UserFanOut`) relies on "principal wins" and moving it would re-attribute production cron cost.
- `llmCallContextHolder.get()` never returns null (`LlmCallContextHolder.java:24-27` substitutes `UNKNOWN`), so `ambient.isAdminReplay()` is null-safe without a guard.

**Done when:** `./mvnw test -Dtest='LlmActorContextOverrideTest,LlmActorResolverTest,AdminMemoryPropertiesTest' -Dmezo.test.use-testcontainers=true -q` is green and the pre-existing `LlmActorResolverTest`/`LlmActorContextTest` still pass unchanged.

- [ ] **Step 1.7: `RetrieveOptions`, `RetrievalOutcome`, `retrieveDetailed`**

In `MemoryQueryPreparer`, add the rewrite-suppressing overload and keep the old signature delegating:

```java
    public PreparedMemoryQuery prepare(MemoryRequest request) {
        return prepare(request, true);
    }

    /**
     * mezo-4qyt: {@code allowRewrite = false} skips the LLM rewrite entirely (no call, no cost) and
     * returns the analyzed raw query — the admin dry-run replay's "rewrite off" toggle. Note the
     * consequence the caller must render honestly: with no rewrite the audit's derived query mode
     * is RAW, so a replay with the toggle off is not comparable to a REWRITE-mode stored run.
     */
    public PreparedMemoryQuery prepare(MemoryRequest request, boolean allowRewrite) {
        PreparedMemoryQuery analyzed = analyzer.analyze(
                request.currentQuery(), request.shortConversationHistory());
        if (analyzed.mode() != QueryMode.CONTEXT_DEPENDENT || !allowRewrite) {
            return analyzed;
        }
        String denseQuery = rewriteOrRaw(analyzed.rawQuery(), request.shortConversationHistory());
        return new PreparedMemoryQuery(
                analyzed.mode(), analyzed.rawQuery(), denseQuery, analyzed.from(), analyzed.to());
    }
```

In `MemoryContextService`, add the two records, the new public method, and route the existing private `retrieve` through it — every existing entry point keeps its exact signature and behaviour:

```java
    /**
     * How ONE retrieval should behave (mezo-4qyt). The four pre-existing entry points pass
     * {@link #audited}; only the admin explorer's dry run passes anything else.
     *
     * @param audit      false ⇒ {@link MemoryRetrievalAuditWriter} is skipped and NO
     *                   {@code memory_retrieval_*} row is written. Deliberately a skip rather than
     *                   a new {@code serving_mode}/{@code consumer_policy} value: both columns carry
     *                   CHECK constraints, and a dry run has no business widening them (D1).
     * @param reranker   ALLOW the LLM reranker. False short-circuits {@code shouldRerank}; true
     *                   restores production behaviour — it does not FORCE a rerank.
     * @param rewrite    ALLOW the LLM query rewrite (same allowance semantics).
     */
    public record RetrieveOptions(
            boolean audit, RetrievalServingMode servingMode, boolean reranker, boolean rewrite) {

        public static RetrieveOptions audited(RetrievalServingMode servingMode) {
            return new RetrieveOptions(true, servingMode, true, true);
        }
    }

    /**
     * Everything one retrieval produced, including what {@link MemoryContext} does not carry
     * (mezo-4qyt): the full ranked candidate list with its score breakdowns, the retriever trace
     * and the prepared query. The explorer's run detail and its dry run are the same rendering of
     * this record — one read for a stored run, one live for a replay.
     */
    public record RetrievalOutcome(
            MemoryContext context,
            PreparedMemoryQuery query,
            List<FusedCandidate> ranked,
            Set<MemoryRetrievalAuditWriter.CandidateIdentity> selected,
            Map<String, Object> retrieverTrace,
            String errorCode,
            long durationMs,
            boolean reranked,
            UUID runId) {
    }

    /** mezo-4qyt: the full-trace variant every other entry point now delegates to. */
    public RetrievalOutcome retrieveDetailed(MemoryRequest request, RetrieveOptions options) {
        return execute(request, options, false);
    }
```

Refactor the existing private `retrieve(request, servingMode, fallbackOnTotalFailure)` into `execute(request, options, fallbackOnTotalFailure)` returning `RetrievalOutcome`, and have the public methods take `.context()`:

```java
    public MemoryContext retrieve(MemoryRequest request) {
        return retrieve(request, RetrievalServingMode.NEW);
    }

    public MemoryContext retrieve(MemoryRequest request, RetrievalServingMode servingMode) {
        return execute(request, RetrieveOptions.audited(servingMode), false).context();
    }

    public MemoryContext retrieveForServing(MemoryRequest request) {
        return execute(request, RetrieveOptions.audited(RetrievalServingMode.NEW), true).context();
    }
```

Inside `execute`, four surgical changes and nothing else:

```java
        PreparedMemoryQuery query = queryPreparer.prepare(request, options.rewrite());
        ...
        boolean reranked = options.reranker()
                && reranker.shouldRerank(request, batch.candidates(), selected);
        ...
        AuditResult audit = writeAudit(options, new AuditCommand(...));   // both call sites
```

and the new private helper:

```java
    /**
     * D1: {@code audit = false} writes nothing. The stand-in still carries a trace id (the surface
     * shows one so a support conversation has a handle) and an EMPTY {@code resultIds} map, so the
     * {@link MemoryContextItem#retrievalResultId()} of a dry-run item is null — there is no row to
     * point at, and inventing one would make the map's "open the audit row" link a dead end.
     */
    private AuditResult writeAudit(RetrieveOptions options, AuditCommand command) {
        return options.audit()
                ? auditWriter.write(command)
                : new AuditResult(null, UUID.randomUUID(), Map.of());
    }
```

**Traps for this step:**
- `AuditResult.runId()` becomes nullable on the dry-run path. Grep every reader of `MemoryContext.runId()` (`ChatService`, `ChatStreamService`, `MemoryItemFeedbackService`, `MemoryRecallService`) and confirm none of them is reachable from `retrieveDetailed` — only the admin service calls it, and the admin service never persists feedback.
- `RetrievalOutcome.selected` is a `Set<CandidateIdentity>`, not the `List` the audit command wants; build the list for the command and the set for the outcome from the same source so a candidate is never "selected" in one and not the other.
- `MemoryShadowRunner` and `MemoryRetrievalDeterministicEvalIT` both drive `retrieve(...)`; their behaviour must be byte-identical after the refactor. `MemoryRetrievalDeterministicEvalIT` staying green is a named acceptance criterion in the spec's testing section.
- Do **not** make `execute` `@Transactional`. The audit writer is `REQUIRES_NEW` and wrapping the caller in a transaction reproduces the transactional-emit deadlock recorded in the memory notes.

**Done when:** `./mvnw test -Dtest='MemoryContextServiceIT,MemoryRetrievalDeterministicEvalIT,MemoryShadowRunnerIT,MemoryQueryPreparerTest' -Dmezo.test.use-testcontainers=true -q` is green with no test edits (adjust only if a test asserts on a signature that moved).

- [ ] **Step 1.8: The prompt-trace query**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/repository/MemoryPromptTraceQuery.java`:

```java
/**
 * "What the LLM actually saw" for one retrieval run (mezo-4qyt).
 *
 * <p>The rendered {@code [Emlékek]} block is NOT stored anywhere. The only bridge from a run to
 * the model's prompt is {@code ai_message.recalled_memories} — a typed jsonb envelope
 * ({@code RecalledMemoriesEnvelope}) whose items carry {@code retrievalRunId} — and only NEW-mode
 * turns write it, because SHADOW runs never reach the model at all. Hence: native, jsonb
 * containment, and a null answer with an explicit reason rather than an empty list.
 *
 * <p>Owner-scoped and time-bounded on purpose: there is no index on the jsonb path, so the
 * predicate is {@code created_by} + a window around the run's own {@code created_at} (the turn
 * that consumed a retrieval is written in the same request), which keeps the scan to one user's
 * few rows even before the caller's {@code statement_timeout} would fire.
 */
@Repository
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryPromptTraceQuery {

    private static final Duration WINDOW = Duration.ofMinutes(10);

    private static final String SQL = """
        select m.recalled_memories::text as envelope
        from ai_message m
        where m.created_by = :userId
          and m.is_deleted = false
          and m.recalled_memories is not null
          and m.created_at between :from and :to
          and m.recalled_memories -> 'items' @> cast(:probe as jsonb)
        order by m.created_at desc
        limit 1
        """;

    private final NamedParameterJdbcTemplate jdbc;

    /** The raw envelope json for the message that consumed {@code runId}, or empty. */
    public Optional<String> findEnvelopeJson(UUID userId, UUID runId, Instant runCreatedAt) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("from", runCreatedAt.minus(WINDOW))
                .addValue("to", runCreatedAt.plus(WINDOW))
                .addValue("probe", "[{\"retrievalRunId\":\"" + runId + "\"}]");
        return jdbc.query(SQL, params, (rs, i) -> rs.getString("envelope")).stream().findFirst();
    }
}
```

**Traps:** the `:probe` value is a *bound parameter*, not concatenated SQL — `runId` is a `UUID`, so its `toString()` cannot carry a quote, and the string is built only to shape the jsonb literal. Read the envelope with `getString` on a `::text` cast (the `AdminRowQuery.readCell` reasoning: never hand a driver `PGobject` to Jackson after the connection returns to the pool), and parse it in the admin mapper with the Jackson **3** (`tools.jackson.databind`) `ObjectMapper` — the only one that is a Spring bean here.

**Done when:** the class compiles and is covered by `AdminMemoryRunsIT`'s NEW-mode prompt-trace case (Step 1.11).

- [ ] **Step 1.9: The run mapper (with the honest `fusionRank`)**

Create `AdminMemoryRunMapper`. Two responsibilities: entity/config → DTO, and deriving `fusionRank`/`rerankDelta`.

```java
/**
 * Stored rows + live fusion config → the explorer's run-detail DTOs (mezo-4qyt).
 *
 * <p>{@code fusionRank} is DERIVED, not stored. The pipeline's persisted
 * {@code ScoreBreakdownEnvelope.rerankerScore} is {@code 1 / postRerankRank}
 * ({@code MemoryRetrievalAuditWriter}) — a restatement of the stored {@code rank}, not a model
 * relevance score — so the "signed rank delta" the surface promises has to come from somewhere
 * else. It comes from re-sorting the stored candidates with the EXACT comparator
 * {@code MemoryCandidateFusion} sorts with (finalScore desc, occurredOn desc nulls-last,
 * candidateRefId asc): that reconstructs the deterministic pre-rerank order from data that is
 * stored, and {@code rerankDelta = fusionRank - rank} is then real.
 *
 * <p>If the comparator in {@code MemoryCandidateFusion} ever changes, THIS must change with it;
 * {@code AdminMemoryRunMapperTest} pins the two orders against a hand-built fixture.
 */
@Service
@RequiredArgsConstructor
public class AdminMemoryRunMapper {

    private static final Comparator<MemoryRetrievalResultEntity> FUSION_ORDER = Comparator
            .comparingDouble((MemoryRetrievalResultEntity r) ->
                    r.getScoreBreakdown().finalScore() == null ? 0.0 : r.getScoreBreakdown().finalScore())
            .reversed()
            .thenComparing(MemoryRetrievalResultEntity::getOccurredOn,
                    Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(MemoryRetrievalResultEntity::getCandidateRefId);

    public AdminMemoryRunSummary summary(MemoryRetrievalRunEntity run, int candidateCount, int selectedCount) { /* ... */ }

    /** The retriever_trace jsonb map → a stable, name-sorted list the client can render as a strip. */
    public List<AdminMemoryRetrieverTrace> trace(Map<String, Object> retrieverTrace) { /* ... */ }

    public AdminMemoryFusionConfig fusion(MemoryPlatformProperties.Fusion config) { /* ... */ }

    public List<AdminMemoryCandidate> candidates(List<MemoryRetrievalResultEntity> rows) {
        List<MemoryRetrievalResultEntity> fusionOrder = rows.stream().sorted(FUSION_ORDER).toList();
        Map<UUID, Integer> fusionRankByRef = new HashMap<>();
        for (int i = 0; i < fusionOrder.size(); i++) {
            fusionRankByRef.put(fusionOrder.get(i).getCandidateRefId(), i + 1);
        }
        boolean reranked = rows.stream().anyMatch(r -> r.getScoreBreakdown().rerankerScore() != null);
        return rows.stream().map(row -> {
            int fusionRank = fusionRankByRef.get(row.getCandidateRefId());
            return AdminMemoryCandidate.builder()
                    .resultId(row.getId())
                    .rank(row.getRank())
                    .fusionRank(fusionRank)
                    .rerankDelta(reranked ? fusionRank - row.getRank() : null)
                    // ... selected, candidateKind, candidateRefId, memoryItemId,
                    //     contentSnapshot, occurredOn, scoreBreakdown
                    .build();
        }).toList();
    }
}
```

The generated DTOs are Lombok-style builders (see `MemoryOverviewResponse.builder()` usage in `MemoryObservatoryService`), so the mapper is builder-based throughout.

Create `AdminMemoryRunMapperTest` (plain unit test): build five `MemoryRetrievalResultEntity` fixtures whose stored `rank` order deliberately differs from their `finalScore` order, assert `fusionRank` reproduces the finalScore order, assert `rerankDelta` is the signed difference, assert `rerankDelta` is null for a run with no `rerankerScore` anywhere, and assert an absent retriever key stays absent in `retrieverRanks` (never zero — "the retriever did not return this candidate" and "it ranked it 0th" are different facts).

**Done when:** `./mvnw test -Dtest='AdminMemoryRunMapperTest' -q` is green.

- [ ] **Step 1.10: `AdminMemoryReplayService`, `AdminMemoryService`, `AdminMemoryController`**

`AdminMemoryReplayService` — the whole point is the two nested scopes:

```java
/**
 * The dry-run replay (mezo-4qyt): what NEW mode WOULD return for this query, right now.
 *
 * <p>Honesty is the feature. Three things are deliberately true and all three are surfaced:
 * (1) it writes no audit row (D1) and touches nothing the user owns; (2) it runs NEW mode, which
 * in production is SHADOW — so it is NOT what the companion actually served; (3) its LLM spend is
 * billed to the INSPECTED user under {@code admin_replay}, which is why both scopes below exist.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.ADMIN_MEMORY_SWITCH, havingValue = "true")
public class AdminMemoryReplayService {

    private final MemoryContextService memoryContextService;      // via ObjectProvider in AdminMemoryService
    private final LlmCallContextHolder llmCallContextHolder;
    private final AdminMemoryProperties properties;

    public MemoryContextService.RetrievalOutcome replay(UUID userId, AdminMemoryReplayRequest request) {
        MemoryRequest memoryRequest = new MemoryRequest(
                userId,
                ConsumerPolicy.valueOf(request.getConsumerPolicy()),
                request.getQuery(),
                List.of(),                       // no conversation history: a replay has none, and
                                                 // inventing one would change what the rewriter sees
                request.getAsOf() == null ? LocalDate.now() : request.getAsOf(),
                0,                               // 0 ⇒ the policy's own token budget applies
                null,                            // no conversationId ⇒ no same-conversation exclusion
                false);
        MemoryContextService.RetrieveOptions options = new MemoryContextService.RetrieveOptions(
                false, RetrievalServingMode.NEW,
                Boolean.TRUE.equals(request.getReranker()),
                Boolean.TRUE.equals(request.getRewrite()));
        LlmCallContext context = new LlmCallContext(
                properties.replayFeatureLabel(), "memory_retrieval", null, null);
        // Order matters: runAsOverride is the OUTER scope, so the actor override is live for every
        // LLM call the retrieval makes (embed, rewrite, rerank), including ones made on pool
        // threads that the resolver reads on the CALLING thread before the async audit hop.
        return LlmActorContext.runAsOverride(userId, () ->
                llmCallContextHolder.runWith(context, () ->
                        memoryContextService.retrieveDetailed(memoryRequest, options)));
    }
}
```

`AdminMemoryService` — the `ObjectProvider` gate and the run reads:

```java
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.ADMIN_MEMORY_SWITCH, havingValue = "true")
public class AdminMemoryService {

    private final ObjectProvider<MemoryRetrievalRunRepository> runRepository;
    private final ObjectProvider<MemoryRetrievalResultRepository> resultRepository;
    private final ObjectProvider<MemoryPromptTraceQuery> promptTraceQuery;
    private final ObjectProvider<MemoryPlatformProperties> memoryPlatformProperties;
    private final ObjectProvider<AdminMemoryReplayService> replayService;
    private final AdminMemoryRunMapper mapper;
    private final AdminMemoryProperties properties;
    private final AdminRowQuery rowQuery;   // reused ONLY for applyStatementTimeout
    private final ObjectMapper objectMapper;

    /**
     * Every companion dependency is optional at runtime: {@code mezo.feature.companion.enabled}
     * (and, for the graph endpoint in slice 2, {@code knowledge-graph}) gate the beans. A missing
     * bean is a product state ("that layer is off"), not a server fault — so it is a 404 with a
     * code the client recognises, never a NoSuchBeanDefinitionException 500.
     */
    private <T> T require(ObjectProvider<T> provider) {
        T bean = provider.getIfAvailable();
        if (bean == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("ADMIN_MEMORY_DISABLED").build(), HttpStatus.NOT_FOUND);
        }
        return bean;
    }

    @Transactional(readOnly = true)
    public AdminMemoryRunPageResponse runs(UUID userId, Integer page, Integer size) {
        rowQuery.applyStatementTimeout(properties.statementTimeoutSql());
        int p = page == null ? 0 : Math.max(0, page);
        int s = Math.clamp(size == null ? 25 : size, 1, properties.runsMaxPageSize());
        Page<MemoryRetrievalRunEntity> found = require(runRepository)
                .findByCreatedByOrderByCreatedAtDesc(userId, PageRequest.of(p, s));
        // ... map each run; candidateCount/selectedCount come from a per-run count, see the trap note
    }

    @Transactional(readOnly = true)
    public AdminMemoryRunDetailResponse run(UUID userId, UUID runId) { /* 404 ADMIN_MEMORY_RUN_NOT_FOUND */ }

    /** NOT @Transactional: the replay makes network LLM calls and must not hold a DB connection. */
    public AdminMemoryRunDetailResponse replay(UUID userId, AdminMemoryReplayRequest request) { /* ... */ }
}
```

`AdminMemoryController`:

```java
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.ADMIN_MEMORY_SWITCH, havingValue = "true")
public class AdminMemoryController implements AdminMemoryApi {

    private final AdminMemoryService service;
    private final CurrentUser currentUser;

    @Override
    public AdminMemoryRunPageResponse listAdminMemoryRuns(UUID userId, Integer page, Integer size) {
        currentUser.requireOwner();
        return service.runs(userId, page, size);
    }

    @Override
    public AdminMemoryRunDetailResponse getAdminMemoryRun(UUID userId, UUID runId) {
        currentUser.requireOwner();
        return service.run(userId, runId);
    }

    @Override
    public AdminMemoryRunDetailResponse replayAdminMemory(UUID userId, AdminMemoryReplayRequest request) {
        currentUser.requireOwner();
        return service.replay(userId, request);
    }
}
```

**Traps for this step:**
- `requireOwner()` is the literal first statement and the service methods carrying `@Transactional(readOnly = true)` are called *after* it — never wrap the controller method itself.
- The run-list `candidateCount`/`selectedCount`: do **not** load every run's candidates to count them (N+1 over 25 runs). Add one grouped native count in `AdminMemoryService`'s repository of choice, or a `MemoryRetrievalResultRepository` projection `countByRunIdIn`. Prefer a single `select run_id, count(*), count(*) filter (where selected) from memory_retrieval_result where created_by = :userId and run_id in (:ids) group by run_id`.
- `AdminMemoryReplayService` must **not** be `@Transactional`: an open transaction across the embed + rewrite + rerank network calls holds a Hikari connection for the whole latency budget, and the test pool is capped at 5.
- `ConsumerPolicy.valueOf(...)` on a client string: the contract's enum keeps it safe, but wrap it so a future contract widening cannot throw a raw `IllegalArgumentException` from outside `techcore` (ArchUnit forbids it) — map an unknown value to `ADMIN_MEMORY_REPLAY_QUERY_INVALID`.

**Done when:** the backend compiles, `AdminMemoryApi` is fully implemented (the generated interface has no default bodies), and `./mvnw clean test -Dmezo.test.use-testcontainers=true -q` reaches the new ITs.

- [ ] **Step 1.11: The ITs**

`AdminMemoryRunsIT extends ApiIntegrationTest`, using `MemoryItemPopulator` (`.run(...)`, `.result(...)`, `.item(...)`) and `AiMessagePopulator`:

- `testRuns_shouldReturn403_whenCallerIsUser` — `registerUser("Anna")`, hit `/api/admin/users/{anna}/memory/runs` with Anna's headers, expect 403 `AUTH_FORBIDDEN`. **Repeat this case for all three paths in this slice** (and all seven once slice 2 lands).
- `testRuns_shouldPageNewestFirst_whenOwner` — seed 3 runs, `size=2`, assert `total=3`, `items` newest-first, `retentionDays=30` (from `mezo.companion.memory-platform.audit.retention-days`).
- `testRuns_shouldClampOversizedSize_whenRequested` — `size=9999` → response `size == 100`, status 200 (clamped, never rejected).
- `testRuns_shouldNeverLeakAnotherUsersRuns_whenBothHaveRuns` — seed runs for Anna and Bea, list Anna's, assert every returned id belongs to Anna. **The user-isolation case the spec names.**
- `testRunDetail_shouldDecomposeScoresAndDeriveFusionRank_whenOwner` — seed a run + 3 results with hand-picked `ScoreBreakdownEnvelope`s whose `rank` order differs from `finalScore` order; assert `fusionRank`, `rerankDelta`, that an absent retriever key is absent from `retrieverRanks`, and that `fusion.rrfK == 60` and `fusion.retrieverWeights` has all four retrievers at 1.0.
- `testRunDetail_shouldReturn404_whenRunWasHardDeletedByRetention` — request a random UUID, expect `ADMIN_MEMORY_RUN_NOT_FOUND`.
- `testRunDetail_shouldCarryPromptTrace_whenNewModeMessageReferencesTheRun` — seed a run and an `ai_message` whose `recalled_memories` items carry `retrievalRunId = run.id`; assert `promptTrace` is non-null, in prompt order, and `promptTraceReason` is null.
- `testRunDetail_shouldExplainNullPromptTrace_whenRunIsShadow` — seed a SHADOW run with no message; assert `promptTrace == null` and `promptTraceReason == "SHADOW_RUN"`.

`AdminMemoryReplayIT extends ApiIntegrationTest` (needs the fake embedding adapter — `@ActiveProfiles` including `companion-fake`, and `@TestPropertySource` turning `mezo.feature.companion.enabled=true`; note the test profile pins `mezo.companion.memory-platform.serving-mode=OLD`, which is irrelevant here because the replay passes `NEW` explicitly):

- `testReplay_shouldWriteNoAuditRow_whenDryRun` — count `memory_retrieval_run` and `memory_retrieval_result` before and after; both unchanged. **The load-bearing D1 assertion.**
- `testReplay_shouldReturnDryRunShapeAndModeCaveat_whenOwner` — `dryRun == true`, `run.servingMode == "NEW"`, `run.id == null`, every candidate's `resultId == null`.
- `testReplay_shouldBillTheInspectedUserUnderAdminReplay_whenRerankAndRewriteAllowed` — seed nothing, POST with `reranker: true, rewrite: true`, then read `llm_log_history`: every row's `created_by == anna.id()` and `feature == "admin_replay"` (embed, rewrite **and** rerank — the Task 1.6 fix is what makes the latter two true). **The other load-bearing assertion.**
- `testReplay_shouldMakeNoLlmCallsForRewriteOrRerank_whenBothToggledOff` — `reranker: false, rewrite: false`; assert no `llm_log_history` row with `operation` in (`query_rewrite`, `rerank`), and `replayNotes` contains `reranker_skipped` and `rewrite_skipped`.
- `testReplay_shouldSurfaceRetrieverFailureInTrace_whenARetrieverTimesOut` — the retriever deadline is 200 ms; drive a failure the way the pre-existing retriever-timeout IT does and assert the trace entry carries `error`.
- `testReplay_shouldReturn400_whenQueryIsBlank`.
- `testReplay_shouldNotTouchTheUsersMemory_whenRun` — snapshot `memory_item`/`memory_vector`/`knowledge_edge` counts and `max(updated_at)` before/after; unchanged.

```bash
cd backend && ./mvnw test -Dtest='AdminMemoryRunsIT,AdminMemoryReplayIT,AdminMemoryRunMapperTest,AdminMemoryPropertiesTest,LlmActorContextOverrideTest' -Dmezo.test.use-testcontainers=true -q
```

**Done when:** all of the above pass, and `MemoryRetrievalDeterministicEvalIT` still passes untouched.

- [ ] **Step 1.12: Full gates, codemap, PR, merge**

```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check
cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true
git status --short backend/src/test/resources/archunit-store   # MUST be empty
cd .. && git merge origin/main
git push -u origin feat/rag-explorer-s1
gh pr create --fill --base main
# wait for CI green, then:
gh workflow run premerge.yml -f pr=<n>
git checkout main && git pull --rebase && git merge --no-ff feat/rag-explorer-s1 && git push
git worktree remove ../rag-explorer-s1 && git branch -d feat/rag-explorer-s1
```

**Traps:** the ArchUnit `feature_slices_are_cycle_free` check only runs in the unfiltered run — an `admin → companion` import is fine, a `companion → admin` one is not, and Task 1.6's constant placement in `llmlog` is what keeps it that way. Verify `archunit-store` was not emptied *before* committing.

**Slice 1 traps recap:**
- **SHADOW is the production default.** Every stored run is a shadow run; the served context came from the legacy path with no audit. The run list's serving-mode badge must say so ("árnyékfutás, nem ezt látta a modell") — slice 3 renders it, but the contract's `servingMode` is what makes it possible, so do not drop it.
- **`shadow_embedding_version` is always null.** Expose it, label it "nincs A/B generáció", and file the follow-up.
- **`rerankerScore` is `1/rank`, not a score** (resolved ambiguity 1). Never name it a score in a DTO description or a Hungarian label.
- **The stored breakdown was fused with the weights of its own time.** `AdminMemoryFusionConfig` is today's config; the surface must not claim a recomputed contribution equals the stored `rrf` if the config has moved since.
- **`promptTrace` is null for every SHADOW run, by construction.** A null is a fact, not a gap — always paired with a reason.

---

## Slice 2 — Backend: structured graph, vector list + PCA-50, neighbours, health

Branch `feat/rag-explorer-s2`, cut fresh from `origin/main` **after slice 1 merged**. Purely additive: four new endpoints on the existing fragment, five new companion-slice reads, one new companion service. Nothing in the retrieval pipeline changes.

**Files:**
- Modify: `api/feature/admin-memory/admin-memory.yml` (four paths + their schemas)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/repository/GraphStructureQuery.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/repository/MemoryVectorPointQuery.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/repository/MemoryNeighborQuery.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/repository/MemoryHealthQuery.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryProjectionService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/admin/service/AdminMemoryGraphMapper.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/admin/service/AdminMemoryService.java` (four methods)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/admin/service/AdminMemoryReplayService.java` (fill `queryProjection`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/admin/controller/AdminMemoryController.java` (four overrides)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/admin/controller/AdminMemoryGraphIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/admin/controller/AdminMemoryVectorsIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/admin/controller/AdminMemoryHealthIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryProjectionServiceIT.java`

**Interfaces produced:** generated DTOs `AdminMemoryGraphResponse`, `AdminMemoryGraphNode`, `AdminMemoryGraphEdge`, `AdminMemoryEdgeEvidence`, `AdminMemoryVectorsResponse`, `AdminMemoryVectorItem`, `AdminMemoryNeighborsResponse`, `AdminMemoryNeighbor`, `AdminMemoryHealthResponse` (+ its five sub-records); `MemoryProjectionService.Projection` / `.transform(...)`.

---

- [ ] **Step 2.1: Extend the contract**

Append to `api/feature/admin-memory/admin-memory.yml`'s `paths:` (each with the same four responses as slice 1's operations):

| operationId | Path | Params |
|---|---|---|
| `getAdminMemoryGraph` | `GET /api/admin/users/{userId}/memory/graph` | `includeArchived` (bool, default false), `includeDeleted` (bool, default false) |
| `getAdminMemoryVectors` | `GET /api/admin/users/{userId}/memory/vectors` | `version` (string, optional — defaults to the serving generation) |
| `getAdminMemoryNeighbors` | `GET /api/admin/users/{userId}/memory/vectors/{itemId}/neighbors` | `k` (int 1..50, default from `mezo.admin.memory.neighbor-default-k`) |
| `getAdminMemoryHealth` | `GET /api/admin/users/{userId}/memory/health` | — |

`getAdminMemoryNeighbors` additionally documents `404 ADMIN_MEMORY_ITEM_NOT_FOUND` / `ADMIN_MEMORY_NO_VECTOR`.

Schemas to add:

```yaml
    AdminMemoryEdgeEvidence:
      type: object
      required: [sourceKind, sourceId]
      description: 'one GraphEdgeEvidence row — the source that justified creating or reinforcing the edge'
      properties:
        sourceKind: { type: string }
        sourceId: { type: string, format: uuid }
        note: { type: string, nullable: true }
        at: { type: string, format: date-time, nullable: true }
    AdminMemoryGraphNode:
      type: object
      required: [id, kind, title, status, deleted]
      properties:
        id: { type: string, format: uuid }
        kind: { type: string, description: 'PATTERN | PREFERENCE | GOAL | LIFE_EVENT | SEASON | INSIGHT | PERSON' }
        title: { type: string }
        summary: { type: string, nullable: true }
        status: { type: string, description: 'candidate | active | archived' }
        sourceKind: { type: string, nullable: true }
        sourceId: { type: string, format: uuid, nullable: true }
        occurredOn: { type: string, format: date, nullable: true }
        userArchivedAt: { type: string, format: date-time, nullable: true, description: 'non-null = the USER hid it; promotion never overrides that' }
        createdAt: { type: string, format: date-time }
        updatedAt: { type: string, format: date-time, nullable: true }
        deleted: { type: boolean }
        meta:
          type: object
          nullable: true
          additionalProperties: true
        degree: { type: integer, format: int32, description: 'in+out edge count inside THIS response, for the node radius' }
    AdminMemoryGraphEdge:
      type: object
      required: [id, from, to, kind, weight, deleted, createdAt]
      description: >
        The first STRUCTURED edge DTO in any mezo contract (GraphNodeResponse.topEdges is
        rendered text). `weight` is the LIVE value: the nightly GraphMaintenanceService decays
        every edge by x0.99 and prunes below 0.05, so this will NOT match a
        memory_retrieval_result score_breakdown captured on an earlier day.
      properties:
        id: { type: string, format: uuid }
        from: { type: string, format: uuid }
        to: { type: string, format: uuid }
        kind: { type: string, description: 'TRIGGERS | PRECEDED_BY | SUPPORTS | CONFLICTS | RELATES_TO' }
        weight: { type: number, format: double, description: '0..1, live (post-decay)' }
        lastReinforcedAt: { type: string, format: date-time, nullable: true }
        createdAt: { type: string, format: date-time }
        deleted: { type: boolean }
        evidence:
          type: array
          items: { $ref: '#/components/schemas/AdminMemoryEdgeEvidence' }
    AdminMemoryGraphResponse:
      type: object
      required: [nodes, edges, decayFactor, pruneBelow]
      properties:
        nodes:
          type: array
          items: { $ref: '#/components/schemas/AdminMemoryGraphNode' }
        edges:
          type: array
          items: { $ref: '#/components/schemas/AdminMemoryGraphEdge' }
        decayFactor: { type: number, format: double, description: 'read from the companion graph config; the nightly multiplier' }
        pruneBelow: { type: number, format: double, description: 'weight below which the nightly pass deletes the edge' }
    AdminMemoryVectorItem:
      type: object
      required: [itemId, sourceKind, occurredOn, salience, state, snippet]
      properties:
        itemId: { type: string, format: uuid }
        sourceKind: { type: string }
        sourceId: { type: string, format: uuid }
        occurredOn: { type: string, format: date }
        salience: { type: number, format: double }
        state: { type: string, description: 'active | suppressed | superseded' }
        snippet: { type: string }
    AdminMemoryVectorsResponse:
      type: object
      required: [embeddingVersion, dims, sampled, total, items, projection]
      properties:
        embeddingVersion: { type: string }
        dims: { type: integer, format: int32, description: 'PCA output dims (mezo.admin.memory.pca-target-dims)' }
        sampled: { type: boolean, description: 'true = the user has more ready vectors than the sample threshold and this is a newest+most-salient subset' }
        total: { type: integer, format: int64, description: 'ready, hash-matching vectors of this generation BEFORE sampling' }
        items:
          type: array
          items: { $ref: '#/components/schemas/AdminMemoryVectorItem' }
        projection:
          type: string
          description: >
            base64 of a little-endian Float32 block of items.length x dims PCA coordinates, row
            major, in the same order as `items`. Base64 rather than a JSON number array to keep
            ~3000 x 50 floats around 0.6 MB instead of ~9 MB of decimal text.
    AdminMemoryNeighbor:
      type: object
      required: [itemId, sourceKind, occurredOn, distance, similarity, snippet, state]
      properties:
        itemId: { type: string, format: uuid }
        sourceKind: { type: string }
        occurredOn: { type: string, format: date }
        distance: { type: number, format: double, description: 'pgvector cosine distance (<=>), 0 = identical' }
        similarity: { type: number, format: double, description: '1 - distance' }
        salience: { type: number, format: double }
        state: { type: string }
        snippet: { type: string }
    AdminMemoryNeighborsResponse:
      type: object
      required: [itemId, embeddingVersion, neighbors]
      properties:
        itemId: { type: string, format: uuid }
        embeddingVersion: { type: string }
        neighbors:
          type: array
          items: { $ref: '#/components/schemas/AdminMemoryNeighbor' }
    AdminMemoryCountBucket:
      type: object
      required: [key, count]
      properties:
        key: { type: string }
        count: { type: integer, format: int64 }
    AdminMemoryHealthResponse:
      type: object
      required:
        [servingEmbeddingVersion, vectorsByStatus, vectorFailures, vectorsByVersion,
         staleVectorCount, itemsByState, nodesByStatus, nodesByKind, edgeWeightHistogram, jobs]
      properties:
        servingEmbeddingVersion: { type: string }
        vectorsByStatus:
          type: array
          items: { $ref: '#/components/schemas/AdminMemoryCountBucket' }
        vectorFailures:
          type: array
          description: 'failure_code -> count, over status = failed rows'
          items: { $ref: '#/components/schemas/AdminMemoryCountBucket' }
        vectorsByVersion:
          type: array
          items: { $ref: '#/components/schemas/AdminMemoryCountBucket' }
        staleVectorCount:
          type: integer
          format: int64
          description: 'embedded_content_hash <> content_hash — present but ANN-ineligible, the quiet failure mode'
        itemsByState:
          type: array
          items: { $ref: '#/components/schemas/AdminMemoryCountBucket' }
        nodesByStatus:
          type: array
          items: { $ref: '#/components/schemas/AdminMemoryCountBucket' }
        nodesByKind:
          type: array
          items: { $ref: '#/components/schemas/AdminMemoryCountBucket' }
        edgeWeightHistogram:
          type: array
          description: 'edgeWeightHistogramBuckets buckets over 0..1; key is the bucket range label'
          items: { $ref: '#/components/schemas/AdminMemoryCountBucket' }
        jobs:
          type: object
          additionalProperties: { type: string, format: date-time, nullable: true }
          description: >
            last observed run of each nightly pass, INFERRED from the newest row it writes
            (lastDailySummary, lastPatternDetection, lastEdgeReinforcement, lastRetrievalRun,
            lastVectorWrite) — there is no job-run table, and the surface says "inferred".
```

Regenerate exactly as in Step 1.2.

**Done when:** both artifacts carry the four new operations and every new schema.

- [ ] **Step 2.2: `GraphStructureQuery` — native reads that see past `@SQLRestriction`**

`GraphNodeEntity`/`GraphEdgeEntity` both carry `@SQLRestriction("is_deleted = false")`, so **no JPA finder can ever return a deleted row.** The precedent for going around it is `MemoryVectorRepository.findByOwnerItemAndVersionIncludingDeleted` (a `nativeQuery = true` `@Query`) and `GraphNodeRepository.countExtractorNodesOnDay` (native, deliberately soft-delete-blind). This slice needs both endpoints of an edge and a jsonb column, so it is a `@Repository` holding a `NamedParameterJdbcTemplate` rather than more native `@Query` methods on the entity repositories — keeping soft-delete-blind reads in one clearly-labelled place.

```java
/**
 * The explorer's structural graph read (mezo-4qyt) — the ONE place in the graph slice that can
 * see soft-deleted rows.
 *
 * <p>Native, not JPA, for a reason that is not performance: {@code GraphNodeEntity} and
 * {@code GraphEdgeEntity} both carry {@code @SQLRestriction("is_deleted = false")}, so a Spring
 * Data finder physically cannot answer {@code includeDeleted=true} — Hibernate appends the
 * predicate to every query it generates. The precedent is
 * {@code MemoryVectorRepository#findByOwnerItemAndVersionIncludingDeleted}.
 *
 * <p>Owner-scoped on BOTH sides of every join: an owned edge can point at a foreign node (the
 * {@code GraphTraversalQuery} note), and such a row must never reach an admin response either.
 *
 * <p>{@code evidence} comes back as {@code ::text} and is parsed by the admin mapper, never left
 * as a driver {@code PGobject} for Jackson to serialize after the read-only transaction commits
 * (the {@code AdminRowQuery#readCell} finding).
 */
@Repository
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH, havingValue = "true")
public class GraphStructureQuery {

    public record NodeRow(UUID id, String kind, String title, String summary, String status,
                          String sourceKind, UUID sourceId, LocalDate occurredOn,
                          OffsetDateTime userArchivedAt, Instant createdAt, Instant updatedAt,
                          boolean deleted, String metaJson) {}

    public record EdgeRow(UUID id, UUID fromNodeId, UUID toNodeId, String kind, BigDecimal weight,
                          Instant lastReinforcedAt, Instant createdAt, boolean deleted,
                          String evidenceJson) {}

    private static final String NODES = """
        select n.id, n.kind, n.title, n.summary, n.status, n.source_kind, n.source_id,
               n.occurred_on, n.user_archived_at, n.created_at, n.updated_at, n.is_deleted,
               n.meta::text as meta_json
        from knowledge_node n
        where n.created_by = :userId
          and (:includeDeleted or n.is_deleted = false)
          and (:includeArchived or n.status <> 'archived')
        order by n.created_at
        """;

    /**
     * Both endpoints must be present in the SAME response, or d3-force gets a link to a node id
     * it never received and throws. So the edge read joins both endpoint nodes under the SAME
     * visibility predicates the node read used — an edge whose endpoint is filtered out is
     * dropped here rather than shipped dangling.
     */
    private static final String EDGES = """
        select e.id, e.from_node_id, e.to_node_id, e.kind, e.weight,
               e.last_reinforced_at, e.created_at, e.is_deleted,
               coalesce(e.evidence, '[]'::jsonb)::text as evidence_json
        from knowledge_edge e
        join knowledge_node nf on nf.id = e.from_node_id and nf.created_by = :userId
             and (:includeDeleted or nf.is_deleted = false)
             and (:includeArchived or nf.status <> 'archived')
        join knowledge_node nt on nt.id = e.to_node_id and nt.created_by = :userId
             and (:includeDeleted or nt.is_deleted = false)
             and (:includeArchived or nt.status <> 'archived')
        where e.created_by = :userId
          and (:includeDeleted or e.is_deleted = false)
        order by e.weight desc, e.created_at
        """;

    private final NamedParameterJdbcTemplate jdbc;

    public List<NodeRow> nodes(UUID userId, boolean includeArchived, boolean includeDeleted) { /* ... */ }
    public List<EdgeRow> edges(UUID userId, boolean includeArchived, boolean includeDeleted) { /* ... */ }
}
```

**Traps:**
- `(:includeDeleted or n.is_deleted = false)` needs the parameter bound as a real `boolean`; `MapSqlParameterSource.addValue("includeDeleted", flag)` is enough, but Postgres will reject `or` against a driver-inferred `bytea` if the value arrives as `null` — never pass a `Boolean` that could be null.
- `knowledge_node.updated_at` is `@UpdateTimestamp` and can be null on rows written before that column existed; the DTO field is nullable.
- Do **not** add the savepoint wrapper here. There is no pgvector operator in these statements, and the savepoint idiom exists for "an optional read must not poison the caller's transaction" — this read IS the request.

- [ ] **Step 2.3: `MemoryVectorPointQuery` and `MemoryNeighborQuery` — the pgvector pair**

Both use the **JDBC-with-savepoint idiom** copied from `DenseMemoryQuery` (`SingleConnectionDataSource(connection, true)` + `connection.setSavepoint(...)` when not in auto-commit, rollback-to-savepoint on a `RuntimeException`), because they run pgvector operators and a failed statement must not leave the surrounding read-only transaction rollback-only.

`MemoryVectorPointQuery` returns the raw embeddings the projection needs plus the item metadata the map renders. Its predicate is `DenseMemoryQuery`'s ANN-eligibility predicate verbatim, minus the query vector:

```java
    private static final String SQL = """
        select i.id as item_id, i.source_id, i.source_kind, i.occurred_on, i.salience, i.state,
               left(i.content, :snippetChars) as snippet,
               v.embedding::text as embedding_text
        from memory_vector v
        join memory_item i on i.id = v.memory_item_id and i.created_by = :userId
        where v.created_by = :userId
          and v.is_deleted = false and v.status = 'ready' and v.embedding is not null
          and v.embedding_version = :embeddingVersion
          and v.embedded_content_hash = i.content_hash
          and i.is_deleted = false and i.state = 'active'
        order by i.occurred_on desc, i.salience desc, i.id
        limit :limit
        """;
```

`embedding::text` (pgvector's `[0.1,0.2,...]` form) parsed into a `float[]` in the row mapper: the `vector` type is `USER-DEFINED` to `information_schema` and has no default JDBC mapping — the exact reason the part-1 catalog drops such columns. Parse with a hand-rolled split rather than pulling in the pgvector JDBC extension.

The **sampling order is the LIMIT clause itself**: `occurred_on desc, salience desc, id` is "newest + most salient first" as the spec requires, and the caller passes `limit = threshold + 1` so it can tell "exactly at the threshold" from "over it". A separate `count(*)` under the same predicate gives `total`.

`MemoryNeighborQuery`:

```java
    private static final String SQL = """
        with anchor as (
            select v.embedding
            from memory_vector v
            where v.created_by = :userId and v.memory_item_id = :itemId
              and v.embedding_version = :embeddingVersion
              and v.status = 'ready' and v.is_deleted = false and v.embedding is not null
        )
        select i.id as item_id, i.source_kind, i.occurred_on, i.salience, i.state,
               left(i.content, :snippetChars) as snippet,
               (v.embedding <=> (select embedding from anchor)) as distance
        from memory_vector v
        join memory_item i on i.id = v.memory_item_id and i.created_by = :userId
        where v.created_by = :userId
          and v.is_deleted = false and v.status = 'ready' and v.embedding is not null
          and v.embedding_version = :embeddingVersion
          and v.embedded_content_hash = i.content_hash
          and i.is_deleted = false and i.state = 'active'
          and v.memory_item_id <> :itemId
          and exists (select 1 from anchor)
        order by distance
        limit :k
        """;
```

`similarity = 1 - distance` is computed in the mapper (cosine distance ⇒ similarity for the L2-normalised vectors this app writes; note that in the DTO description so nobody reads it as a dot product). An anchor with no ready vector of the serving generation yields an empty result — the service turns that into 404 `ADMIN_MEMORY_NO_VECTOR`, distinguished from 404 `ADMIN_MEMORY_ITEM_NOT_FOUND` by a prior owner-scoped `MemoryItemRepository` existence check.

**Traps:**
- **`exists (select 1 from anchor)`** is load-bearing: without it, `v.embedding <=> null` yields null for every row, `order by distance` returns an arbitrary page, and the endpoint would silently answer with nonsense instead of an error.
- The partial HNSW index covers `ready` + live rows only; keep the predicate identical to `DenseMemoryQuery`'s or the index is not used and the 5 s timeout starts to matter.
- `left(i.content, :snippetChars)` — bind the length, do not interpolate.

- [ ] **Step 2.4: `MemoryProjectionService` — PCA-50 by power iteration, cached, sampled, deterministic**

No new dependency: a small power-iteration SVD over the mean-centred matrix, deflating after each component.

```java
/**
 * Server-side PCA of one user's ready vectors (mezo-4qyt): 768 dims -> 50, so the client's UMAP
 * gets ~0.6 MB instead of ~9 MB per 3 000 items.
 *
 * <p>Power iteration rather than a linear-algebra dependency: the matrices are (few thousand) x
 * 768 and 50 components converge in a handful of passes each, so the whole thing is a few hundred
 * milliseconds of pure Java and adds nothing to the build.
 *
 * <p>DETERMINISM IS A CONTRACT, not a nicety: the client caches the UMAP result per user in
 * sessionStorage and places a replayed query into the SAME space with transform(), so two calls
 * for one user must return the same basis. The random start vector is therefore seeded from the
 * user id (never {@code Math.random}), and the cache is keyed on the exact facts that can change
 * the input: the ready-vector count and the newest {@code updated_at}.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryProjectionService {

    private static final long SEED = 0x5EEDL;
    private static final int MAX_ITERATIONS = 64;
    private static final double CONVERGENCE = 1e-7;

    /** One user's projection: the basis (for transform), the coordinates, and the honesty flags. */
    public record Projection(
            String embeddingVersion, int dims, boolean sampled, long total,
            List<UUID> itemIds, float[][] coordinates, double[] mean, double[][] basis) {}

    private final MemoryVectorPointQuery pointQuery;
    private final MemoryPlatformProperties memoryProperties;
    private final AdminMemoryProperties adminProperties;   // pca-target-dims, vector-sample-threshold
    private final Map<UUID, Cached> cache = new ConcurrentHashMap<>();

    public Projection project(UUID userId, String embeddingVersion) { /* cache probe -> compute */ }

    /** Places one 768-dim query vector into an existing basis — the replay's queryProjection. */
    public float[] transform(Projection projection, float[] queryVector) {
        float[] out = new float[projection.dims()];
        for (int k = 0; k < projection.dims(); k++) {
            double dot = 0.0;
            for (int d = 0; d < queryVector.length; d++) {
                dot += (queryVector[d] - projection.mean()[d]) * projection.basis()[k][d];
            }
            out[k] = (float) dot;
        }
        return out;
    }

    private record Cached(long readyCount, Instant newestUpdatedAt, String version, Projection projection) {}
}
```

The compute, in order:

1. **Probe** — one cheap `select count(*), max(i.updated_at)` under the point query's predicate. If the cached entry's `(readyCount, newestUpdatedAt, version)` matches, return it. This is what "invalidated when the ready-vector count or the newest `updated_at` changes" means; do not cache on a TTL, a stale map is worse than a recomputed one.
2. **Load** at most `vectorSampleThreshold + 1` rows in `occurred_on desc, salience desc, id` order. `sampled = loaded > threshold`; if so, truncate to `threshold`.
3. **Mean-centre** into a `double[n][768]`.
4. **For k in 0..dims-1**: start from `new Random(SEED ^ userId.getMostSignificantBits() ^ (k * 0x9E3779B9L))`, normalise; iterate `v ← normalise(Xᵀ(Xv))` until the L2 delta drops under `CONVERGENCE` or `MAX_ITERATIONS`; record `basis[k] = v`; compute `scores[i] = X[i]·v` and store as `coordinates[i][k]`; **deflate** `X[i] -= scores[i] * v`.
5. Cache and return.

Guard rails: fewer than 2 items ⇒ return a `Projection` with `dims = min(targetDims, n)` and zero-filled coordinates rather than dividing by zero; `dims` is always `min(pcaTargetDims, n, 768)` and the response's `dims` field carries the actual value, because the FE allocates its `Float32Array` from it.

`MemoryProjectionServiceIT` (Testcontainers, `MemoryItemPopulator.item` + `.vector` with `MemoryEmbeddingPopulator.axisVector(...)`/`blendVector(...)` for controlled geometry):
- `testProject_shouldBeDeterministic_whenCalledTwice` — two calls, byte-identical coordinates. **The spec's named PCA-determinism case.**
- `testProject_shouldSeparateTwoAxisClusters_whenVectorsAreOrthogonal` — seed two clusters on orthogonal axes, assert the first component separates them (the within-cluster spread on component 0 is smaller than the between-cluster gap).
- `testProject_shouldInvalidateCache_whenANewVectorLands` — project, add a vector, project again, assert the item count grew (i.e. the cache did not serve a stale basis).
- `testProject_shouldFlagSampled_whenOverTheThreshold` — `@TestPropertySource("mezo.admin.memory.vector-sample-threshold=5")`, seed 7, assert `sampled` and `items.size() == 5` and `total == 7`.
- `testTransform_shouldPlaceAKnownVectorNearItsCluster_whenTransformed` — transform one of the seeded vectors and assert it lands within a small epsilon of its own stored coordinates.

**Traps:**
- **A per-user in-memory cache is per-instance.** Fine at this scale, but say so in the javadoc — two backend replicas can hand two clients two different bases, and the FE caches per user in `sessionStorage`, so a page reload could jump. Note it as a known limit in the feature doc, not a bug to chase.
- `MemoryItemEntity.updatedAt` is `@UpdateTimestamp`, so re-projecting a changed item moves the probe value — that is exactly the intended invalidation trigger. Do **not** probe `memory_vector.updated_at`; `OwnedEntity` may not carry one.
- The deflation must use the scores computed **before** subtracting, and the basis vectors must be re-orthogonalised implicitly by deflation — do not skip the deflation "because power iteration converges to different vectors anyway". It does not.

- [ ] **Step 2.5: `MemoryHealthQuery`**

One `@Repository`, seven small grouped native statements, all owner-scoped, no dynamic identifiers:

```sql
-- vectorsByStatus
select v.status as key, count(*) from memory_vector v
where v.created_by = :userId and v.is_deleted = false group by 1 order by 1

-- vectorFailures
select coalesce(v.failure_code, 'UNKNOWN') as key, count(*) from memory_vector v
where v.created_by = :userId and v.is_deleted = false and v.status = 'failed' group by 1 order by 2 desc

-- vectorsByVersion
select v.embedding_version as key, count(*) from memory_vector v
where v.created_by = :userId and v.is_deleted = false group by 1 order by 1

-- staleVectorCount  (present but ANN-ineligible: the quiet failure mode)
select count(*) from memory_vector v
join memory_item i on i.id = v.memory_item_id and i.created_by = :userId
where v.created_by = :userId and v.is_deleted = false and v.status = 'ready'
  and v.embedded_content_hash <> i.content_hash

-- itemsByState
select i.state as key, count(*) from memory_item i
where i.created_by = :userId and i.is_deleted = false group by 1 order by 1

-- nodesByStatus / nodesByKind
select n.status as key, count(*) from knowledge_node n
where n.created_by = :userId and n.is_deleted = false group by 1 order by 1

-- edgeWeightHistogram
select width_bucket(e.weight, 0, 1, :buckets) as bucket, count(*)
from knowledge_edge e where e.created_by = :userId and e.is_deleted = false
group by 1 order by 1
```

Bucket labels are built in Java from `:buckets` (`"0.0–0.1"`, …) so the DTO's `key` is human-readable; `width_bucket` returns `buckets + 1` for a weight of exactly 1.0, so **fold that into the last bucket** or the histogram gains a phantom eleventh column.

The `jobs` map is inferred, one `max(...)` each: `max(created_at)` on `daily_summary`, `max(last_detected_at)` on `pattern`, `max(last_reinforced_at)` on `knowledge_edge`, `max(created_at)` on `memory_retrieval_run`, `max(created_at)` on `memory_vector`. There is no job-run table; the DTO description and the Hungarian label both say **"becsült"**.

**Trap:** the graph statements need `KNOWLEDGE_GRAPH_SWITCH`, the vector ones need `COMPANION_SWITCH`. Rather than split the repository, keep it on `COMPANION_SWITCH` and let `AdminMemoryService` supply empty graph buckets when the graph provider is absent — `/health` must still answer for the vector half when the graph is off, per the spec's "other views keep working" rule.

- [ ] **Step 2.6: Wire the four service methods, the graph mapper and the replay's projection**

`AdminMemoryService` gains `graph`, `vectors`, `neighbors`, `health`, each `@Transactional(readOnly = true)` and each opening with `rowQuery.applyStatementTimeout(properties.statementTimeoutSql())` — `SET LOCAL` only affects the current transaction, so it must be the first statement *inside* the transactional method, never before it (the `AdminRowQuery.applyStatementTimeout` javadoc).

`AdminMemoryGraphMapper` parses `metaJson`/`evidenceJson` with the Jackson 3 `ObjectMapper` and computes each node's `degree` from the edges **in this response** (so a filtered-out edge does not inflate a radius the client cannot explain).

`AdminMemoryReplayService` now fills `queryProjection` (resolved ambiguity 2): inside the existing two scopes, embed the query once via `ObjectProvider<EmbeddingPort>` with the query task type, call `MemoryProjectionService.project(userId, servingVersion)` then `.transform(...)`, and append `projection_embed_extra_call` to `replayNotes`. A failure anywhere in that chain appends `pca_unavailable` and leaves `queryProjection` null — **the replay must never fail because the map could not place its query.** Wrap it in its own try/catch with a `log.warn`.

Also: translate Postgres SQLSTATE `57014` (statement-timeout cancellation) to 504 `ADMIN_MEMORY_QUERY_TIMEOUT` the same way part 1 does for `ADMIN_QUERY_TIMEOUT`, rather than letting it surface as a generic 500.

- [ ] **Step 2.7: The ITs**

`AdminMemoryGraphIT` (uses `GraphPopulator`; needs `mezo.feature.knowledge-graph.enabled=true`, which `application.yml` already ships):
- 403 for a non-owner on all four new paths.
- `testGraph_shouldReturnStructuredEdgesWithEvidence_whenOwner` — two nodes + an edge with an explicit weight and evidence; assert `from`/`to`/`kind`/`weight`/`evidence[0].sourceKind`, and that `degree` is 1 on both nodes. **The first structured-edge assertion in the suite.**
- `testGraph_shouldHideDeletedByDefaultAndShowThemWhenAsked` — soft-delete one node via the repository (`@SQLDelete` fires), assert it is absent by default and present with `includeDeleted=true` carrying `deleted: true`. **The `includeDeleted` case the spec names.**
- `testGraph_shouldNotShipDanglingEdges_whenOneEndpointIsFiltered` — soft-delete one endpoint, assert the edge disappears with `includeDeleted=false` (so `d3-force` never sees a link to an unknown node).
- `testGraph_shouldExcludeArchivedByDefault` — an `archived` node absent by default, present with `includeArchived=true`.
- `testGraph_shouldNeverLeakAnotherUsersNodes`.

`AdminMemoryVectorsIT` (uses `MemoryItemPopulator` + `MemoryEmbeddingPopulator.axisVector`):
- `testVectors_shouldReturnBase64ProjectionMatchingItemCount` — decode the base64, assert `bytes.length == items.size() * dims * 4`.
- `testVectors_shouldFlagSampled_whenOverTheThreshold` (`@TestPropertySource`, threshold 3, seed 5).
- `testVectors_shouldExcludeStaleAndFailedVectors` — seed a vector whose `embedded_content_hash` no longer matches and one with `status = failed`; neither appears.
- `testNeighbors_shouldOrderByRealCosineDistance_whenOwner` — anchor on axis A, one neighbour on a blend of A and B, one on axis B; assert the returned order and that `distance` strictly increases and `similarity == 1 - distance`. **The spec's "neighbours ordered by real cosine distance" case.**
- `testNeighbors_shouldReturn404_whenItemHasNoServingVector` → `ADMIN_MEMORY_NO_VECTOR`; and 404 `ADMIN_MEMORY_ITEM_NOT_FOUND` for a random id.
- `testNeighbors_shouldNeverReturnTheAnchorItself`.

`AdminMemoryHealthIT`:
- `testHealth_shouldRollUpStatusVersionAndStaleness_whenOwner` — seed ready + failed + a stale ready vector, assert the three buckets and `staleVectorCount == 1`.
- `testHealth_shouldBucketEdgeWeights_andFoldWeightOne` — seed edges at 0.05, 0.55 and exactly 1.000; assert exactly `edgeWeightHistogramBuckets` buckets and that the 1.0 edge landed in the last one.
- `testHealth_shouldStillAnswerVectorHalf_whenGraphSwitchIsOff` — `@TestPropertySource("mezo.feature.knowledge-graph.enabled=false")`, assert 200 with empty `nodesByStatus`/`edgeWeightHistogram` and populated vector buckets.

```bash
cd backend && ./mvnw test -Dtest='AdminMemoryGraphIT,AdminMemoryVectorsIT,AdminMemoryHealthIT,MemoryProjectionServiceIT' -Dmezo.test.use-testcontainers=true -q
```

- [ ] **Step 2.8: Full gates, PR, merge** — as Step 1.12, plus a `node scripts/gen-codemap.mjs` run (this slice adds no package but does add files the codemap lists).

**Slice 2 traps recap:**
- **Stored breakdown ≠ live edge weight.** Nightly `×0.99` decay + prune below `0.05` means a run detail's `knowledge_edge` candidate score and the graph view's `weight` for the same edge legitimately differ. The contract says so; slice 4's inspector must say so in Hungarian.
- **`@SQLRestriction` is invisible until it bites.** Any new "include deleted" read must be native. Never "fix" a missing deleted row by adding a JPA finder.
- **pgvector columns have no JDBC mapping.** Read `embedding::text`; never `getObject`.
- **`sampled` must be surfaced, not silently applied.** A map of 5 000 of 12 000 memories that claims to be complete is worse than no map.
- **`/health`'s job timestamps are inferred.** There is no job-run table; label them "becsült" everywhere.

---

## Slice 3 — Frontend: prototype, shell, Futások (runs + run detail + replay)

Branch `feat/rag-explorer-s3`, cut from `origin/main` **after slices 1 and 2 are on main** (it consumes their `api.gen.ts` types). The prototype comes **first**: it is where the four views' layout and the shared inspector get settled on one canvas, before any React exists.

**Files:**
- Create: `docs/design_2.0/prototypes/src/admin-memory-head.html`, `src/admin-memory-body.html`
- Modify: `docs/design_2.0/prototypes/build.sh`, `docs/design_2.0/prototypes/README.md`
- Create: `frontend/src/data/admin/adminMemoryApi.ts`, `adminMemoryHooks.ts`, `adminMemoryMock.ts`
- Create: `frontend/src/features/admin/memory/AdminMemoryPage.tsx`, `MemorySegmentBar.tsx`, `MemoryInspector.tsx`
- Create: `frontend/src/features/admin/memory/views/RunsView.tsx`, `views/RunDetail.tsx`, `views/ReplayBox.tsx`
- Create: `frontend/src/features/admin/memory/contribution.ts`
- Create: `frontend/src/features/admin/memory/umapConstants.ts`
- Modify: `frontend/src/features/admin/adminRoutes.tsx`, `pages/AdminUserDetailPage.tsx`
- Modify: `frontend/src/data/hooks.ts`, `frontend/src/test/msw/handlers.ts`, `frontend/src/styles/prototype.css`
- Modify: `frontend/package.json`, `pnpm-lock.yaml`
- Test: `contribution.test.ts`, `AdminMemoryPage.test.tsx`, `RunsView.test.tsx`, `RunDetail.test.tsx`, `ReplayBox.test.tsx`, `adminMemoryHooks.test.tsx`

---

- [ ] **Step 3.1: The prototype (`admin-memory.html`) — FIRST**

Draw all four views plus the inspector on one scrolling canvas, in the design 2.0 language, reusing part 1's admin desktop CSS (`.ad-*` classes in `frontend/src/styles/prototype.css` §Admin hub, mirrored in `src/admin-head.html`). Author `src/admin-memory-head.html` (a copy of `admin-head.html`'s style block plus the new `.am-*` rules) and `src/admin-memory-body.html`; add to `build.sh` beside the `admin-hub.html` line:

```bash
cat src/admin-memory-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/admin-memory-body.html > admin-memory.html
```

and bump the trailing `echo "OK — 34 prototype files assembled."` to 35. Add a `README.md` row for it. Then:

```bash
cd docs/design_2.0/prototypes && ./build.sh && ls -la admin-memory.html
```

The canvas must show, top to bottom:

1. **Shell** — the `AdminLayout` rail, a user hero strip reused from the user-detail page, and a four-way segment bar (`Futások · Gráf · Térkép · Rétegek`) in the `.ad-tabs` idiom. A collapsible right inspector column (~320px) that is present in every view.
2. **Futások** — the run table (idő · policy · **serving-mode badge** · query mode · raw/rewritten query · jelöltek · ms · hiba) with a SHADOW row showing the badge text *"árnyékfutás — nem ezt látta a modell"*; a retriever-trace strip (four chips: name, ms, count, a red dot on error); one expanded candidate row with the **stacked contribution bar** (one segment per retriever + one per boost, an absent retriever rendered as a muted `–` chip, `finalScore` on the right, `újrarangsorolt hely` and a signed `Δ`), and a `bekerült` pill.
3. **"Amit az LLM látott"** — a rendered prompt-trace list in one state and the honest empty state in another (*"ehhez a futáshoz nincs prompt-lenyomat — árnyékfutás sosem ért el a modellig"*).
4. **Replay** — query box + two toggles (`Újraírás`, `Újrarangsorolás`) labelled *engedélyezve*, a **DRY-RUN** badge, and the mode caveat line (*"azt mutatja, mit adna a NEW mód — nem azt, amit a kísérő kiszolgált"*).
5. **Gráf** (slice 4's target) — the force layout with kind-coloured clay spots, edge widths, a dashed `CONFLICTS` edge, a faded `candidate` node, kind filter chips, a weight slider, a title search box; the edge inspector with evidence rows and the created→last-reinforced validity bar.
6. **Térkép** (slice 5's target) — the SVG scatter coloured by `sourceKind`, sized by `salience`, hollow for `suppressed`/`superseded`; a replayed query as a star with its candidates lit; the sampled banner.
7. **Rétegek** (slice 6's target) — StatCells for the health rollups with every failed/stale count styled as a link.

**Traps:** never hand-edit `admin-memory.html` — it is generated. Keep every new class prefixed `.am-` so nothing collides with part 1's `.ad-*`. The prototype is the source of truth the React views are ported from; get Daniel's sign-off on it before Step 3.4.

**Done when:** `admin-memory.html` builds, opens standalone, and Daniel has seen it.

- [ ] **Step 3.2: Add the two dependencies**

```bash
cd frontend
pnpm add d3-force@^3.0.0 umap-js@^1.4.0
pnpm add -D @types/d3-force@^3.0.0
pnpm ls d3-force umap-js --depth 0
```

Exactly these two runtime packages and one type package — **no `d3` meta-package** (it drags in a dozen unrelated modules), no `react-force-graph`, no `sigma`. Verify no transitive UI dependency arrived:

```bash
pnpm why react --json | head -40   # must show only the app's own react
```

**Done when:** `package.json` lists exactly `d3-force` and `umap-js` as new dependencies, `pnpm build` succeeds, and the lockfile is committed.

- [ ] **Step 3.3: The data layer**

`frontend/src/data/admin/adminMemoryApi.ts` — types from `api.gen.ts`, one `apiFetch` call per path, plus the **degraded** helper:

```ts
import { apiFetch, ApiError } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

// RAG memory explorer (mezo-4qyt) — OWNER-only, one inspected user per call. Every path is
// /api/admin/users/{userId}/memory/**; the backend gates on currentUser.requireOwner() and
// answers 404 when mezo.feature.admin-memory.enabled (or the companion/graph switch a given
// endpoint needs) is off.
export type AdminMemoryRunPageResponse = components['schemas']['AdminMemoryRunPageResponse']
export type AdminMemoryRunDetailResponse = components['schemas']['AdminMemoryRunDetailResponse']
export type AdminMemoryGraphResponse = components['schemas']['AdminMemoryGraphResponse']
export type AdminMemoryVectorsResponse = components['schemas']['AdminMemoryVectorsResponse']
export type AdminMemoryNeighborsResponse = components['schemas']['AdminMemoryNeighborsResponse']
export type AdminMemoryHealthResponse = components['schemas']['AdminMemoryHealthResponse']
export type AdminMemoryReplayRequest = components['schemas']['AdminMemoryReplayRequest']
export type AdminMemoryCandidate = components['schemas']['AdminMemoryCandidate']
export type AdminMemoryGraphNode = components['schemas']['AdminMemoryGraphNode']
export type AdminMemoryGraphEdge = components['schemas']['AdminMemoryGraphEdge']

/** A read that answered "this layer is switched off" rather than failing. */
export type Degradable<T> = T & { degraded?: boolean }

/**
 * Turns "the feature is off" into a RESOLVED value carrying `degraded: true`, so one view can say
 * "ki van kapcsolva" while the other three keep working — instead of every view sharing one error
 * state.
 *
 * The discrimination is load-bearing and NOT just "status === 404": a hard-deleted run (the 30-day
 * retention job) is also a 404, and that one must reach the caller as a real error so the list can
 * refresh. A missing controller bean produces a BODYLESS Spring 404, which `apiFetch` turns into a
 * synthetic INTERNAL_ERROR message; our own 404s always carry an ADMIN_MEMORY_* code. So: 404 with
 * no ADMIN_MEMORY_* code => degraded; anything else re-throws.
 */
export function degradable<T>(fetcher: () => Promise<T>, empty: T): () => Promise<Degradable<T>> {
  return async () => {
    try {
      return await fetcher()
    } catch (e) {
      const ours = e instanceof ApiError && e.messages.some((m) => m.code.startsWith('ADMIN_MEMORY_'))
      if (e instanceof ApiError && e.status === 404 && !ours) {
        return { ...empty, degraded: true }
      }
      throw e
    }
  }
}

const base = (userId: string) => `/api/admin/users/${encodeURIComponent(userId)}/memory`

export const adminMemoryApi = {
  runs: (userId: string, page = 0, size = 25): Promise<AdminMemoryRunPageResponse> =>
    apiFetch(`${base(userId)}/runs?page=${page}&size=${size}`),
  run: (userId: string, runId: string): Promise<AdminMemoryRunDetailResponse> =>
    apiFetch(`${base(userId)}/runs/${encodeURIComponent(runId)}`),
  replay: (userId: string, body: AdminMemoryReplayRequest): Promise<AdminMemoryRunDetailResponse> =>
    apiFetch(`${base(userId)}/replay`, { method: 'POST', body: JSON.stringify(body) }),
  graph: (userId: string, includeArchived: boolean, includeDeleted: boolean): Promise<AdminMemoryGraphResponse> =>
    apiFetch(`${base(userId)}/graph?includeArchived=${includeArchived}&includeDeleted=${includeDeleted}`),
  vectors: (userId: string, version?: string | null): Promise<AdminMemoryVectorsResponse> =>
    apiFetch(`${base(userId)}/vectors${version ? `?version=${encodeURIComponent(version)}` : ''}`),
  neighbors: (userId: string, itemId: string, k: number): Promise<AdminMemoryNeighborsResponse> =>
    apiFetch(`${base(userId)}/vectors/${encodeURIComponent(itemId)}/neighbors?k=${k}`),
  health: (userId: string): Promise<AdminMemoryHealthResponse> => apiFetch(`${base(userId)}/health`),
}
```

`adminMemoryHooks.ts` — **every** hook passes `realStaleTime: DEFAULT_QUERY_STALE_TIME_MS` explicitly (omitting it sends `undefined`, which overwrites the client default and leaves the query permanently stale — `useDualQuery.ts:36-45`; this is the known trap that bit part 1) and `enabled: isOwner` (folded together with any local precondition, so a caller can branch on `isPending`):

```ts
export const ADMIN_MEMORY_KEY = ['admin', 'memory'] as const

export function useAdminMemoryRuns(userId: string, page: number, size: number, isOwner: boolean) {
  const enabled = isOwner && userId !== ''
  const q = useDualQuery<Degradable<AdminMemoryRunPageResponse>>({
    queryKey: [...ADMIN_MEMORY_KEY, 'runs', userId, page, size],
    mockData: ADMIN_MEMORY_RUNS_MOCK,
    realFetch: degradable(() => adminMemoryApi.runs(userId, page, size), ADMIN_MEMORY_RUNS_EMPTY),
    realEmpty: ADMIN_MEMORY_RUNS_EMPTY,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
    keepPreviousRealData: true,   // paging must not blank the table for a round-trip
    enabled,
  })
  return { ...q, isPending: enabled && q.isPending }
}

export function useAdminMemoryRun(userId: string, runId: string, isOwner: boolean) { /* enabled: isOwner && userId && runId */ }
export function useAdminMemoryGraph(userId: string, includeArchived: boolean, includeDeleted: boolean, isOwner: boolean) { /* toggles in the key */ }
export function useAdminMemoryVectors(userId: string, version: string | null, isOwner: boolean) { /* version in the key */ }
export function useAdminMemoryNeighbors(userId: string, itemId: string | null, k: number, isOwner: boolean) { /* enabled: … && itemId !== null */ }
export function useAdminMemoryHealth(userId: string, isOwner: boolean) { /* … */ }

/** The replay is the only mutation on this surface — and it is side-effect-free server-side. */
export function useAdminMemoryReplay(userId: string) {
  return useMutation({ mutationFn: (body: AdminMemoryReplayRequest) => adminMemoryApi.replay(userId, body) })
}
```

`adminMemoryMock.ts` — a `*_MOCK` seed and a `*_EMPTY` ghost for each read. The seed must be **shaped exactly like the real API**, including the fields the mock is tempted to omit: a SHADOW run **and** a NEW run; a candidate whose `retrieverRanks` is missing one retriever; a run with `promptTrace: null` + `promptTraceReason: 'SHADOW_RUN'` and one with a populated trace; a `sampled: true` vectors payload with a real base64 projection block (generate it once and paste it — a hand-typed one of the wrong length breaks the `Float32Array` decode); an edge with two evidence rows and one with none; a `CONFLICTS` edge; an `archived` node and a `deleted: true` node. A mock fixture that omits a field the real API populates is an invisible correctness hole — the part-1 review found exactly that class of bug.

MSW handlers in `frontend/src/test/msw/handlers.ts`, beside the part-1 admin block, **one per path** and all populated defaults:

```ts
  // RAG memory explorer (mezo-4qyt) — populated defaults mirroring the mock seed. The
  // "switched off" (404) path is exercised via server.use() in the degraded-state tests.
  http.get(`${API_BASE}/api/admin/users/:userId/memory/runs`, ({ request }) => { /* honour page/size */ }),
  http.get(`${API_BASE}/api/admin/users/:userId/memory/runs/:runId`, () => HttpResponse.json(ADMIN_MEMORY_RUN_MOCK)),
  http.post(`${API_BASE}/api/admin/users/:userId/memory/replay`, async ({ request }) => { /* echo the query, dryRun: true */ }),
  http.get(`${API_BASE}/api/admin/users/:userId/memory/graph`, () => HttpResponse.json(ADMIN_MEMORY_GRAPH_MOCK)),
  http.get(`${API_BASE}/api/admin/users/:userId/memory/vectors`, () => HttpResponse.json(ADMIN_MEMORY_VECTORS_MOCK)),
  http.get(`${API_BASE}/api/admin/users/:userId/memory/vectors/:itemId/neighbors`, () => HttpResponse.json(ADMIN_MEMORY_NEIGHBORS_MOCK)),
  http.get(`${API_BASE}/api/admin/users/:userId/memory/health`, () => HttpResponse.json(ADMIN_MEMORY_HEALTH_MOCK)),
```

Re-export every hook from `frontend/src/data/hooks.ts` (the barrel every page reads through; `hooks.reexport.test.ts` enforces it).

**Traps:**
- Mock-mode queries **must** carry `staleTime: Infinity` (which `useDualQuery` gives them) and the mock `queryFn` must not be cache-first — a mock query without a stale time plus a cache-first `queryFn` silently reverts `setQueryData` writes, and flaky mock-parity tests are the tell.
- `degradable` wraps only the **reads**. The replay mutation surfaces its 404 as an error; the page renders the "ki van kapcsolva" tile from a read's `degraded` flag, never from the mutation.

**Done when:** `pnpm test adminMemoryHooks` (whole suite, both modes) is green and `dualMode.guard.test.ts` still passes.

- [ ] **Step 3.4: The shell, the route and the 5th tab**

`AdminMemoryPage.tsx` owns the URL state and nothing else:

```tsx
// /admin/users/:id/memory?view=runs|graph|map|layers&sel=<id>
// The view and the selection live in the URL, not in component state: a deep link from a run
// candidate to "this edge on Gráf" or "this point on Térkép" is the whole point of the four views
// sharing one inspector, and that only works if both are addressable.
const VIEWS = { runs: 'Futások', graph: 'Gráf', map: 'Térkép', layers: 'Rétegek' } as const
type ViewKey = keyof typeof VIEWS

export function AdminMemoryPage() {
  const { id = '' } = useParams()
  const isOwner = useMe().data?.role === 'OWNER'
  const [params, setParams] = useSearchParams()
  const view = (Object.keys(VIEWS).includes(params.get('view') ?? '') ? params.get('view') : 'runs') as ViewKey
  const sel = params.get('sel')
  const select = (next: string | null) => { /* setParams preserving `view`, replace: true */ }
  const go = (next: ViewKey) => { /* setParams preserving `sel` only when the target view can show it */ }
  // ... segment bar + <MosaicDesktop> content column + <MemoryInspector> right column
}
```

`MemoryInspector.tsx` is a presentational shell: a title, a close/collapse control, and children. Each view supplies its own inspector body (run candidate / node / edge / vector point), and every body ends with a **source link** — `sourceKind`/`sourceId` → `/admin/data?table=<mapped>&rowId=<sourceId>`, the part-1 data browser deep link `AdminUserDetailPage` already uses. Keep the `sourceKind → table` map in one exported record in `MemoryInspector.tsx` with an explicit fallback: an unmapped `sourceKind` renders the ids as plain text, never a broken link.

In `adminRoutes.tsx` add the lazy import and the child route:

```tsx
const AdminMemoryPage = lazy(() =>
  import('@/features/admin/memory/AdminMemoryPage').then((m) => ({ default: m.AdminMemoryPage })))
// ...
      { path: 'users/:id/memory', element: <AdminMemoryPage /> },
```

placed **after** `users/:id` so the more specific path is still matched by React Router 7's ranking (it is order-independent, but keep them adjacent for readability).

In `AdminUserDetailPage.tsx`, extend `TABS` with a 5th entry and make that one navigate instead of switching local state:

```tsx
const TABS = ['Aktivitás', 'Adatok', 'Feature-ök', 'Költség', 'Memória'] as const
// ...
onClick={() => (t === 'Memória' ? navigate(`/admin/users/${userId}/memory`) : setTab(t))}
```

`aria-selected` stays `tab === t`, which is never true for `Memória` — that is correct, it is a link dressed as a tab, and the test asserts the navigation rather than a selected state.

**Traps:** `/admin/users/:id/memory` is inside the existing lazy admin chunk, so no new `Suspense` boundary is needed — `AdminLayout` already provides one. Do not add a second.

**Done when:** the route renders in both modes and clicking `Memória` on the user detail page lands on it.

- [ ] **Step 3.5: The contribution maths as a pure, unit-tested function**

`frontend/src/features/admin/memory/contribution.ts`:

```ts
import type { AdminMemoryCandidate, components } from '@/data/admin/adminMemoryApi'

export interface Contribution {
  /** retriever name, or a boost key like 'recencyBoost' */
  key: string
  /** 1-based rank inside that retriever; null for a boost, or for a retriever that missed it */
  rank: number | null
  /** the additive amount this segment contributed to finalScore */
  value: number
  kind: 'retriever' | 'boost'
}

/**
 * One candidate's finalScore, decomposed into the segments the stacked bar draws
 * (Elastic RRF `explain` + the Azure sub-score table: rank + weighted contribution per source,
 * absent sources shown EXPLICITLY, boosts as their own segments, the reranker kept out of the
 * bar entirely).
 *
 * Each retriever's RRF share is `weight / (rrfK + rank)` — the same expression
 * MemoryCandidateFusion applies (`value.rrf += weight / (config.rrfConstant() + rank)`), so the
 * segments sum to the stored `rrf` up to floating-point error. `absent` retrievers are returned
 * with `rank: null, value: 0` so the bar can render a muted "–" instead of silently omitting a
 * source, which is the single most misleading thing a hybrid-retrieval explainer can do.
 *
 * NOT included in the bar: `rerankerScore`. The pipeline stores 1/postRerankRank, i.e. a
 * restatement of `rank` — it is not additive and putting it in a stacked bar would invent a
 * contribution that does not exist. It is a separate column, labelled as a position.
 */
export function decompose(
  candidate: AdminMemoryCandidate,
  fusion: components['schemas']['AdminMemoryFusionConfig'],
): { segments: Contribution[]; rrfSum: number; storedRrf: number; drift: number }
```

`contribution.test.ts` pins it against the **Elastic RRF documentation example** (`rrfK = 60`, a document at rank 1 in one retriever and rank 3 in another with unit weights ⇒ `1/61 + 1/63`), plus:
- an absent retriever comes back as `rank: null, value: 0` and is present in `segments`;
- unit weights vs a non-unit weight both reproduce `weight / (k + rank)`;
- `rrfSum` matches `storedRrf` within `1e-9` for a candidate built from consistent values, and `drift` is non-zero when the config's weights no longer match what the run was fused with (the run detail renders a quiet note when `Math.abs(drift) > 1e-6`);
- boosts appear as their own segments and a null boost is skipped, not treated as 0 with a visible segment.

**Done when:** `contribution.test.ts` is green in both modes.

- [ ] **Step 3.6: `RunsView`, `RunDetail`, `ReplayBox`**

`RunsView` — the run table inside an `AdminTile` (part 1's tile handles pending/error/retry per tile). Columns per the prototype. The serving-mode badge:

```tsx
// SHADOW is the PRODUCTION default (mezo.companion.memory-platform.serving-mode), so almost every
// stored run is a shadow run: the pipeline was audited in the background while the LEGACY path
// actually served the chat. Saying so on every row is the difference between an explainer and a
// misleading one.
const MODE_BADGE: Record<string, { label: string; tone: string; title: string }> = {
  SHADOW: { label: 'árnyék', tone: 'warn', title: 'Árnyékfutás — nem ezt látta a modell' },
  NEW: { label: 'élő', tone: 'ok', title: 'Egységes visszakeresés szolgálta ki' },
  OLD: { label: 'legacy', tone: 'mut', title: 'A régi visszakeresési út' },
}
```

The header also carries `retentionDays` (*"a futások {n} nap után törlődnek"*), so a shrinking list explains itself. Row click → `select(run.id)` and the detail loads beneath.

`RunDetail` — the retriever-trace strip, then one expandable row per candidate with `decompose(...)`'s stacked bar, `finalScore`, the `újrarangsorolt hely` column with the signed `Δ` (only when `rerankDelta != null`), and the `bekerült` pill from `selected`. Below, the **"Amit az LLM látott"** block:

```tsx
{detail.promptTrace
  ? <PromptTraceList items={detail.promptTrace} />
  : <p className="ad-mut">{PROMPT_TRACE_REASON[detail.promptTraceReason ?? 'NO_PROMPT_IMPRINT']}</p>}
```

with

```ts
const PROMPT_TRACE_REASON: Record<string, string> = {
  SHADOW_RUN: 'Ehhez a futáshoz nincs prompt-lenyomat: árnyékfutás sosem ért el a modellig.',
  NO_PROMPT_IMPRINT: 'Ehhez a futáshoz nem találtunk prompt-lenyomatot (a kirenderelt blokkot nem tároljuk).',
  DRY_RUN: 'Próbafutás — nem ment modellhez, így nincs prompt-lenyomata.',
}
```

Deep links out of a candidate: `candidateKind === 'knowledge_edge'` → `?view=graph&sel=<candidateRefId>`; a non-null `memoryItemId` → `?view=map&sel=<memoryItemId>`. Both go through `AdminMemoryPage`'s `go`/`select`, so the inspector entry is the same object in both views.

`ReplayBox` — query input (maxLength 500), the two toggles, a submit that calls `useAdminMemoryReplay`, and on success renders the **same `RunDetail`** with a `DRY-RUN` badge, the mode caveat, and the `replayNotes` chips (`reranker_skipped` → *"újrarangsorolás kihagyva"*, `rewrite_skipped` → *"újraírás kihagyva"*, `projection_embed_extra_call` → *"a térkép-elhelyezéshez egy extra beágyazás készült"*, `pca_unavailable` → *"a térkép-elhelyezés nem sikerült"*). The toggles' labels say **engedélyezve**, not *bekapcsolva* — the pipeline still decides whether a rerank is needed (resolved ambiguity 4).

**Traps:**
- The `DRY-RUN` badge and the mode caveat must be **unconditional** on a replay result, not derived from a state the user can toggle away.
- A candidate whose `retrieverRanks` is `{}` (a stored run from a total-retriever-outage) must render the bar as all-absent plus the run-level `errorCode`, not as a zero-height bar with no explanation.
- `keepPreviousRealData` on the runs hook means the table can briefly show the previous page's rows; the page indicator must come from the **response**, never from the requested page.

- [ ] **Step 3.7: Tests and gates**

Render tests per component in **both** modes (`pnpm test` = real, `VITE_USE_MOCK=true pnpm test` = mock):
- `AdminMemoryPage.test.tsx` — default view is Futások; `?view=graph` selects Gráf; an unknown `view` falls back to Futások; a 404-with-no-code (via `server.use()`) renders the "ki van kapcsolva" tile while a sibling view's query is untouched.
- `RunsView.test.tsx` — a SHADOW row shows the árnyék badge and its title text; the retention line renders the number; paging shows the response's page.
- `RunDetail.test.tsx` — an absent retriever renders a `–`; `rerankDelta` renders with its sign; `promptTrace: null` + `SHADOW_RUN` renders the shadow sentence, not an empty list; the edge-candidate deep link points at `?view=graph&sel=…`.
- `ReplayBox.test.tsx` — submitting posts the toggles as sent; the result carries the DRY-RUN badge and the caveat; `replayNotes` render as chips.
- `adminMemoryHooks.test.tsx` — every hook is disabled for a non-owner (no request fired), each carries `realStaleTime`, and the degraded discrimination works both ways (bodyless 404 ⇒ `degraded`, `ADMIN_MEMORY_RUN_NOT_FOUND` ⇒ `isError`).
- `AdminUserDetailPage.test.tsx` — extend with the 5th tab's navigation.

```bash
cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build
node ../scripts/gen-codemap.mjs --check   # from repo root
```

Then PR/premerge/merge as Step 1.12.

**Slice 3 traps recap:**
- **`realStaleTime` on every hook.** Omitting it is not a style nit; it makes the query permanently stale, and this page mounts six of them.
- **404 is overloaded.** Degraded vs. deleted-run is the one place a lazy `status === 404` check produces a wrong screen.
- **The mock seed is a contract test in disguise.** Any field the real API populates and the seed omits is a bug that only shows up in production.
- **SHADOW honesty is not optional.** Every surface that shows a stored run says which mode it was.

---

## Slice 4 — Frontend: Gráf view

Branch `feat/rag-explorer-s4`, cut from `origin/main` after slice 3. `d3-force` for physics, hand-written SVG for rendering — the repo has no chart library and every existing visual (`ScoreRing`, `TrendChart`, `TokenColumns`) is hand-rolled SVG in the design 2.0 language. A force-graph was once planned and parked (bd `mezo-2m4`); this is that work, scoped.

**Files:**
- Create: `frontend/src/features/admin/memory/graphLayout.ts`
- Create: `frontend/src/features/admin/memory/views/GraphView.tsx`
- Create: `frontend/src/features/admin/memory/views/GraphInspector.tsx`
- Modify: `frontend/src/features/admin/memory/AdminMemoryPage.tsx` (mount the view, honour `sel`)
- Modify: `frontend/src/styles/prototype.css` (`.am-graph*`)
- Test: `graphLayout.test.ts`, `GraphView.test.tsx`, `GraphInspector.test.tsx`

- [ ] **Step 4.1: `graphLayout.ts` — the simulation, isolated from React**

```ts
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force'

export interface LaidOutNode { id: string; x: number; y: number; degree: number; kind: string; /* … */ }

/**
 * Runs the force simulation to completion SYNCHRONOUSLY and returns frozen coordinates.
 *
 * `forceSimulation(...).stop()` + an explicit `tick(n)` loop rather than d3's own animation timer:
 * the layout is computed once when the data changes and then frozen (the spec's "layout runs once
 * then freezes; dragging moves locally"), so React never re-renders 60 times a second and the test
 * environment needs no timers or requestAnimationFrame at all. It also makes the output
 * DETERMINISTIC for a given input, which is what lets `graphLayout.test.ts` assert on positions.
 *
 * d3-force seeds initial positions from the node INDEX (a phyllotaxis spiral), not from
 * Math.random, so identical input gives identical output without seeding anything ourselves.
 */
export function layout(
  nodes: AdminMemoryGraphNode[],
  edges: AdminMemoryGraphEdge[],
  size: { width: number; height: number },
): { nodes: LaidOutNode[]; links: LaidOutLink[] }
```

Forces: `forceLink` keyed on node id with `distance` inversely proportional to `weight` (a strong edge pulls harder), `forceManyBody().strength(-180)`, `forceCollide` sized from the node radius, `forceCenter` at the viewport middle. `TICKS = 300`.

**The one bug this file must not have:** `forceLink` throws on a link whose `source`/`target` id is not in the node list. Slice 2's edge query already drops dangling edges, but the FE filters (kind chips, weight slider) can *also* remove a node — so `layout` must filter links against the node set it was given, as its first statement. `graphLayout.test.ts` asserts that a link to an unknown id is dropped rather than thrown on.

Radius from degree: `r = 7 + Math.min(11, Math.sqrt(degree) * 4)` — bounded, so a hub node cannot swallow the canvas. Edge stroke width from weight: `0.6 + weight * 3`.

- [ ] **Step 4.2: `GraphView.tsx` — SVG rendering, filters, drag**

- Node = a `ClaySpot`-toned circle in the kind's colour (one exported `KIND_COLOR` record covering all seven kinds — `PATTERN`, `PREFERENCE`, `GOAL`, `LIFE_EVENT`, `SEASON`, `INSIGHT`, **`PERSON`**; a missing kind falls back to a neutral, and `GraphView.test.tsx` asserts all seven are mapped so a new node kind cannot render invisible).
- `status === 'candidate'` → `opacity: .45`; `deleted` → dashed stroke; `CONFLICTS` edge → `strokeDasharray`.
- Controls: kind filter chips, a weight-threshold slider (`0 … 1`, step `.05`), a title search input, and the two data toggles (`Archiváltak`, `Töröltek`) which feed the **hook's query key**, not a client-side filter — they change what the server returns.
- Drag: pointer events set the dragged node's `x`/`y` in local state directly. **No re-simulation** — the layout is frozen; dragging moves one node, exactly as the spec says.
- Click a node or edge → `select(id)`; `sel` from the URL highlights it (thicker stroke + a halo) and scrolls the inspector into view. A `sel` that matches nothing is ignored silently (a deep link from a run whose edge has since been pruned by the nightly pass).

- [ ] **Step 4.3: `GraphInspector.tsx`**

Node body: kind, status, title, summary, `occurredOn`, `meta` as a `JsonCell` (part 1's component), a source link, and in/out edges as a list (each row navigates to that edge's `sel`).

Edge body: kind, **weight**, `lastReinforcedAt`, the evidence rows (each with its own source link), and the validity bar:

```tsx
{/* created → last reinforced. mezo edges have no invalidation semantics (unlike Graphiti/Zep's
    valid/invalid interval), so this is a DECAY story, not a validity one: GraphMaintenanceService
    multiplies every weight by `decayFactor` nightly and deletes below `pruneBelow`, so an edge
    that has not been reinforced lately is fading, not wrong. */}
<ValidityBar createdAt={edge.createdAt} lastReinforcedAt={edge.lastReinforcedAt}
             decayFactor={graph.decayFactor} pruneBelow={graph.pruneBelow} weight={edge.weight} />
```

`ValidityBar` renders the created→lastReinforced span, and — from `decayFactor`/`pruneBelow`/`weight`, all server-supplied — an estimated *"~N nap múlva kiesik, ha nem erősödik meg"* (`log(pruneBelow / weight) / log(decayFactor)`), clamped and labelled **becsült**.

The **honesty line** the spec's terrain notes demand, rendered whenever the inspector was opened from a run candidate:

> *"A futásban tárolt él-súly a futás pillanatáé; itt a mai, éjszakai gyengülés utáni súly látszik."*

- [ ] **Step 4.4: Tests and gates**

- `graphLayout.test.ts` — deterministic output for identical input; a dangling link is filtered, not thrown on; radius is bounded for a degree-50 hub; a stronger edge ends up shorter than a weak one.
- `GraphView.test.tsx` (both modes) — all seven kinds have a colour; a `candidate` node renders faded; a `CONFLICTS` edge renders dashed; the weight slider removes edges below the threshold **and** the nodes that thereby have no edges left stay (an isolated node is data, not noise); the archived/deleted toggles change the query key (assert via an MSW spy on the request URL).
- `GraphInspector.test.tsx` — evidence rows render with source links; an edge with no evidence renders the honest empty line; the decay estimate renders and is labelled becsült; the run-origin honesty line appears only when arrived at from a run.

```bash
cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build
```

**Slice 4 traps recap:** `PERSON` is a real node kind (`GraphNodeEntity.KIND_PERSON`) that `docs/features/companion.md`'s table still omits — slice 6 fixes the doc, but the colour map must cover it now. `forceLink` throws on unknown ids. The frozen layout is a deliberate choice, not a missing feature.

---

## Slice 5 — Frontend: Térkép view

Branch `feat/rag-explorer-s5`, cut from `origin/main` after slice 3 (independent of slice 4).

**Files:**
- Create: `frontend/src/features/admin/memory/umap.worker.ts`
- Create: `frontend/src/features/admin/memory/projection.ts`
- Create: `frontend/src/features/admin/memory/views/MapView.tsx`
- Create: `frontend/src/features/admin/memory/views/MapInspector.tsx`
- Modify: `frontend/src/features/admin/memory/AdminMemoryPage.tsx`, `styles/prototype.css`
- Test: `projection.test.ts`, `umapWorker.protocol.test.ts`, `MapView.test.tsx`, `MapInspector.test.tsx`

- [ ] **Step 5.1: `umapConstants.ts` (created in slice 3, filled here) — D4**

```ts
/**
 * UMAP parameters for the memory map (mezo-4qyt, D4). Client-side constants rather than server
 * config: they shape only how the SAME server-side PCA output is unfolded, so changing one is a
 * visual decision made in a deploy, not an environment knob.
 */
export const UMAP_N_NEIGHBORS = 15
export const UMAP_MIN_DIST = 0.1
export const UMAP_N_COMPONENTS = 2
/** Fixed so tests (and two loads of the same user's map) get the same picture. */
export const UMAP_SEED = 42
/** Epochs between progress messages — the map "unfolds" rather than appearing at the end. */
export const UMAP_PROGRESS_EVERY = 25
```

- [ ] **Step 5.2: `projection.ts` — decode and normalise**

```ts
/**
 * Decodes the server's base64 Float32 block into row-major PCA coordinates.
 *
 * `atob` -> Uint8Array -> Float32Array over the SAME buffer works only because the Uint8Array is
 * freshly allocated at offset 0 (a view into a larger buffer would be mis-aligned); build it that
 * way and never slice a shared buffer into here.
 *
 * Vectors are L2-normalised AFTER decoding because umap-js's default euclidean metric on
 * normalised vectors is monotonically equivalent to cosine — which is the metric the backend's
 * pgvector neighbours use, so the map's visual neighbourhoods and the inspector's real neighbours
 * tell the same story instead of two.
 */
export function decodeProjection(base64: string, count: number, dims: number): Float32Array[]
export function l2Normalise(rows: Float32Array[]): number[][]
```

`projection.test.ts`: a hand-built 2×3 block round-trips; a byte length that does not match `count * dims * 4` throws a clear error rather than producing garbage rows; normalisation makes every row's norm 1 and leaves a zero row untouched (not `NaN`).

- [ ] **Step 5.3: `umap.worker.ts` — the message protocol**

A plain Vite module worker (`new Worker(new URL('./umap.worker.ts', import.meta.url), { type: 'module' })`).

```ts
// Protocol — deliberately tiny and one-directional-per-message, so the main thread can be tested
// against a hand-written fake worker with no umap-js involved (umapWorker.protocol.test.ts).
export type UmapRequest = { type: 'fit'; data: number[][]; nNeighbors: number; minDist: number; seed: number }
export type UmapResponse =
  | { type: 'progress'; epoch: number; total: number; coords: number[][] }
  | { type: 'done'; coords: number[][] }
  | { type: 'error'; message: string }
```

Inside: `new UMAP({ nComponents, nNeighbors, minDist, random: mulberry32(seed) })`, then `fitAsync(cb)` posting a `progress` every `UMAP_PROGRESS_EVERY` epochs and a final `done`. `umap-js` accepts a `random` function, so the seed is honoured through that rather than by patching globals — that is what makes the map deterministic in tests.

`nNeighbors` must be clamped to `Math.min(UMAP_N_NEIGHBORS, data.length - 1)`; `umap-js` throws when `nNeighbors >= n`, and a user with 8 memories is a completely normal beta case.

Any throw becomes an `error` message — the worker never dies silently.

- [ ] **Step 5.4: `MapView.tsx`**

State machine: `idle → decoding → fitting(progress) → ready`, plus `fallback` and `disabled`.

- On `vectors.data` change: decode, normalise, spawn the worker, render each `progress` frame (the map visibly unfolds), settle on `done`.
- **Cache per user in `sessionStorage`** under `mezo.adminMemory.umap.<userId>.<embeddingVersion>.<itemCount>` — every part of that key can change the correct answer, and a stale map is the failure mode the cache must not create. Wrap **every** read and write in `try/catch`: a private window or blocked site data throws on access, and the map must still render.
- **Worker failure → PCA-2 fallback**: on an `error` message, or if the worker fails to construct at all, plot PCA components 0 and 1 directly from the decoded block and show a visible note (*"a UMAP nem futott le — az első két főkomponens látszik"*). This is a first-class state, not a console warning.
- Rendering: SVG scatter, colour by `sourceKind` (an exported record + neutral fallback), radius from `salience`, `suppressed`/`superseded` drawn hollow (`fill: none`, coloured stroke).
- `sampled` → a banner: *"{items} elem látszik a {total}-ból — a legfrissebb és legfontosabb mintája."*
- A replayed query's `queryProjection`: place it with the same worker's `transform` path — **or**, if `umap-js`'s `transform` is unavailable for the seeded instance, place it at the centroid of its own top-k nearest decoded PCA rows and label the star *becsült hely*. Decide by trying `transform` first; either way the star is visually distinct and its candidates (from the replay's `candidates[].memoryItemId`) light up.
- Click a point → `select(itemId)` → `useAdminMemoryNeighbors` fires and the 10 real pgvector neighbours are highlighted on the map with connector lines.

- [ ] **Step 5.5: `MapInspector.tsx`**

Content, `sourceKind`/`sourceId` source link, `occurredOn`, `salience`, `state`, and the neighbour list with **real cosine similarity** per row — labelled *"valódi vektor-közelség (pgvector)"* to distinguish it from screen distance:

> *"A térképen látott távolság a 2D-re hajtogatott vetület; ezek a szomszédok a teljes 768 dimenzióban a legközelebbiek."*

- [ ] **Step 5.6: Tests and gates**

- `umapWorker.protocol.test.ts` — a hand-written fake worker (no `umap-js`) drives `MapView` through `progress` → `done`, then through `error` → fallback. Mock the worker module with `vi.mock`.
- `MapView.test.tsx` (both modes) — the sampled banner renders when `sampled`; a `suppressed` item renders hollow; the fallback note renders on an `error` message; a `sessionStorage` accessor that throws does not break the render; clicking a point fires the neighbours request and highlights the returned ids; a payload with 3 items does not throw (the `nNeighbors` clamp).
- `MapInspector.test.tsx` — neighbours render with their similarity and the projection caveat is present.

```bash
cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build
```

**Slice 5 traps recap:** `nNeighbors >= n` throws — clamp it. `sessionStorage` throws in some contexts — always `try/catch`. The worker-failure fallback is a required state. **Screen distance is not vector distance** and the inspector must say so; the whole point of showing real pgvector neighbours next to a UMAP map is that the two can disagree.

---

## Slice 6 — Frontend: Rétegek view + docs

Branch `feat/rag-explorer-s6`, cut from `origin/main` after slice 3. The smallest code slice and the largest documentation one.

**Files:**
- Create: `frontend/src/features/admin/memory/views/LayersView.tsx`
- Modify: `frontend/src/features/admin/memory/AdminMemoryPage.tsx`, `styles/prototype.css`
- Create: `docs/features/admin-memory-explorer.md` (D2)
- Modify: `docs/features/admin-hub.md`, `docs/features/insights.md`, `docs/features/companion.md`
- Modify: `docs/CODEMAP.md`
- Test: `LayersView.test.tsx`

- [ ] **Step 6.1: `LayersView.tsx`**

Two data sources side by side: the **existing** `MemoryOverviewResponse` (via a new owner-scoped read of `MemoryObservatoryService.overview(userId)` — see the note below) and the new `/health`.

**The one open contract question, resolved:** `overview(userId)` is reused *unchanged*, but there is no admin-facing endpoint for it. Rather than add an eighth path late, **the L0–L3 half of this view is rendered from `/health` alone** (vectors by status/version, staleness, items by state, nodes by status/kind, the edge-weight histogram, the inferred job timestamps), and a link sends the owner to the user's own Memória page equivalent where the L0–L3 product framing lives. If Daniel wants the L0–L3 cards here too, that is a one-endpoint follow-up (`GET …/memory/overview` delegating to `MemoryObservatoryService.overview(userId)`), filed in the follow-ups below rather than smuggled into slice 6. The spec's "`overview(userId)` reused unchanged" is thereby satisfied *in shape* (the service is ready for it) without a contract change in the last slice.

Layout: `StatCell`s for `staleVectorCount`, failed vectors, candidate nodes and total edges; a small bar for `vectorsByStatus`, one for `itemsByState`, one for `nodesByKind`; the edge-weight histogram as a column chart; the job timestamps as a labelled list marked **becsült**.

Every failed/stale count is a **link into part 1's data browser** with the matching table pre-selected: `staleVectorCount` → `/admin/data?table=memory_vector&userId=<id>`, failed vectors → same, candidate nodes → `table=knowledge_node`. That closes the loop the spec asks for ("every failed/stale count links to the matching data-browser rows"). The data browser has no arbitrary filter, so the link selects the table and the user; the count itself is the guide.

`LayersView.test.tsx` (both modes): the stale count renders and links to `memory_vector`; the histogram renders exactly `edgeWeightHistogram.length` columns; the job list is labelled becsült; a graph-off payload (empty node buckets) renders the vector half without an error.

- [ ] **Step 6.2: The feature doc (D2)**

Create `docs/features/admin-memory-explorer.md` in the `knowledge-base` skill's 10-section shape, with front matter:

```yaml
---
title: RAG memory explorer — owner console part 2
type: feature-domain
status: done
updated: 2026-09-<dd>
tags: [admin, companion, memory, rag, pgvector, knowledge-graph, backend, frontend, data-layer, design]
key_files:
  - api/feature/admin-memory/admin-memory.yml
  - backend/src/main/java/io/mrkuhne/mezo/feature/admin/service/AdminMemoryService.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryProjectionService.java
  - frontend/src/features/admin/memory
  - frontend/src/data/admin/adminMemoryApi.ts
related: [admin-hub, companion, insights, _platform-auth-security, _platform-data-layer, _platform-design-system]
---
```

Content requirements, section by section:

1. **Summary** — what the four views answer and why the beta needs them; part 2 of the series; `mezo-4qyt`.
2. **User-facing behavior** — the route family, the segment bar, the shared inspector, each view's controls, and every honesty label verbatim (the SHADOW badge, the prompt-trace reasons, the sampled banner, the decay note, the projection caveat, the DRY-RUN badge). These labels ARE the feature; a doc that paraphrases them is stale on arrival.
3. **Architecture & data flow** — the diagram from the spec, plus the `ObjectProvider` 404 gate, `admin → companion` and the ArchUnit rule that pins the direction.
4. **Data model & API** — no new tables; the seven operations as a table; `AdminMemoryProperties` vs. what is READ from `MemoryPlatformProperties` (and *why* the split exists); the PCA/base64 payload contract; the `retrieverRanks` absent-key semantics.
5. **Integrations** — `← companion` (memory + graph), `← llmlog` (`LlmCallContext.FEATURE_ADMIN_REPLAY`, `LlmActorContext.override`), `← auth` (`requireOwner`, ADR 0038's beta-scoped consent), `← admin hub` (layout, tile, data-browser deep links, `AdminRowQuery.applyStatementTimeout`).
6. **How to use it** — the hook list with `isOwner`, the `degradable` discrimination, the URL contract (`view`/`sel`).
7. **How to extend it** — a new endpoint (contract → regen → service → controller → IT → api/hooks/mock → MSW → view → both-mode tests → this doc); a new node kind (add a colour, extend the doc's kind table); a new health rollup (one statement in `MemoryHealthQuery` + one bucket).
8. **Testing** — the IT list, the FE test list, the gates.
9. **Decisions, gotchas & deferred** — every entry from this plan's *Resolved ambiguities* (especially `rerankerScore` = `1/rank`, the replay's second embed call, the D3 label fix and why the naive version was wrong), plus: the per-instance PCA cache, SHADOW being the production default, `shadow_embedding_version` always null, the frozen graph layout, and the follow-ups below.
10. **Key files** — contracts, backend, backend tests, frontend, docs.

- [ ] **Step 6.3: The doc-staleness fixes**

Three files, four edits, each a small correction to an *existing* claim:

1. `docs/features/admin-hub.md` §4 — the feature-map column names drifted from what ships. Replace `journal` → `journal_entry.created_at` with **`journal_entry.occurred_on`**, `habits` → `habit_day.date` with **`habit_day.habit_date`**, `water` → `water_log.created_at` with **`water_log.log_date`**, `weight` → `weight_log.created_at` with **`weight_log.date`** (verify each against `backend/src/main/resources/application.yml` lines 93–113 at edit time, not against this plan). Same section: `AdminProperties` carries a third component the doc omits — add **`reportZone`** (`Europe/Budapest`, the zone every day-bucketing expression shifts into). Also add a cross-link to the new explorer doc in §9's deferred list, where "the RAG explorer (part 2…)" currently sits as a future item.
2. `docs/features/insights.md` §Memória — the first segment is named **"Rétegek"** in code, not "Áttekintés" (`MemoryPage.tsx`), and the described "old degraded redirect" no longer exists. Fix the segment name at every occurrence in that section (lines ~386, ~396, ~447, ~452 and the §Key files entry near ~923 all mention it) and delete/replace the stale degraded-redirect sentence with what the code does now (per-panel inline degraded lines).
3. `docs/features/companion.md` W2.1 — the node-kind table and the `ck_knowledge_node_kind` list omit **`PERSON`** (`GraphNodeEntity.KIND_PERSON`, added by Emberek S5 / `mezo-06o0.4`). Add it to the enumeration around line ~3020 and to the kind list around line ~3946, with a one-line gloss ("an active person's mirror in the graph").

Each fix is a separate commit with a message naming what drifted, so a future reader can see the correction was deliberate:

```bash
git commit -m "docs(admin-hub): correct the feature-map column names and add reportZone (mezo-xxxx)"
git commit -m "docs(insights): the first Memoria segment is Retegek, not Attekintes (mezo-xxxx)"
git commit -m "docs(companion): add the PERSON node kind to the W2.1 tables (mezo-xxxx)"
```

- [ ] **Step 6.4: Codemap, gates, PR, merge**

```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check
cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build
```

Then PR/premerge/merge as Step 1.12, and close the epic:

```bash
bd close <s6-id>
bd update mezo-4qyt --status closed
bd dolt push && git push
git status   # MUST show "up to date with origin"
```

**Slice 6 traps recap:** the doc fixes are corrections to *existing* text, so re-read the target lines before editing — parallel sessions may have moved them. `insights.md` mentions the segment name in five places; fixing one and missing four leaves the doc worse than before, because now it contradicts itself.

---

## Follow-up bd issues to file

File these at the end of slice 6 (`bd create --type task --priority 3`), each with a one-paragraph body naming what it unblocks. From the spec's Follow-ups plus what planning surfaced:

1. **Admin relevance labels on run candidates** (the Phoenix pattern) — a per-candidate relevant/irrelevant marker so the retrieval audit becomes an eval set. Needs a new table and the first write on this surface; deliberately out of a read-only v1.
2. **`llm_log_history.run_id` by migration** — today "what the LLM saw" (`ai_message.recalled_memories`) and "what it cost" (`llm_log_history`) can only be joined by time window (`MemoryPromptTraceQuery`'s ±10 minutes). A real FK makes the per-run cost figure exact.
3. **Populate `shadow_embedding_version`** — always null today, though the shared-RAG-platform spec promises it. Blocks A/B comparison of embedding generations, and the explorer already renders the field.
4. **The SHADOW → NEW serving-mode decision** — the product decision this whole explorer exists to inform. Its acceptance criterion is a decision, not code.
5. **A real per-candidate reranker score** — `ScoreBreakdownEnvelope.rerankerScore` stores `1/postRerankRank` (resolved ambiguity 1), so the surface can only show a position and a derived delta. Getting a genuine score means changing the reranker prompt to return scores and widening the envelope.
6. **`GET …/memory/overview`** — expose `MemoryObservatoryService.overview(userId)` so Rétegek can show the L0–L3 product framing beside the raw health rollups (Step 6.1's deferral).
7. **Share the PCA basis across replicas** — the projection cache is per-instance (`MemoryProjectionService`), so two backend pods can hand two clients two different bases while the FE caches per user in `sessionStorage`. Harmless at beta scale; needs a shared cache or a persisted basis if it ever isn't.
8. **Give the two moved-in owner pages the desktop mosaic treatment** — inherited from part 1's deferred list; unrelated to this epic but re-surfaced by working next to them.

---

## Self-review notes

Things a reviewer of this plan (or of its output) should check specifically, because they are where it is most likely to be wrong:

- **The `RetrieveOptions` refactor is the only change to shipped behaviour in the whole epic.** Everything else is additive. The acceptance evidence is not "the new ITs pass" — it is that `MemoryRetrievalDeterministicEvalIT`, `MemoryShadowRunnerIT` and the chat ITs pass **without edits**. If any of them needed a change, understand exactly why before accepting it.
- **Ask for mutation evidence on the two load-bearing replay assertions.** "No audit row is written" and "the rows are billed to the inspected user under `admin_replay`" are the claims this feature's honesty rests on. Break each deliberately (make the dry run audit; drop the `runAsOverride`) and confirm the corresponding IT fails. A green assertion that cannot fail is not evidence.
- **The D3 fix is the subtlest change in the epic.** Confirm that a normal chat turn's `query_rewrite` and `rerank` rows still land under `companion_recall` — not `companion_chat`, not `admin_replay`. That is a `llm_log_history` query after a chat IT, not a code read.
- **"What can a user no longer do?"** Nothing, by construction — but verify it: the four pre-existing `MemoryContextService` entry points keep their signatures, `MemoryQueryPreparer.prepare(request)` still exists, and `LlmActorContext.runAs`'s precedence is untouched.
- **Every honesty label is a requirement, not copy.** SHADOW badge, prompt-trace reason, `sampled` banner, decay note, projection caveat, DRY-RUN badge, "becsült" on the inferred job times. A view that quietly drops one is a defect even with green tests, because the whole surface exists to be trustworthy about a system that is easy to misread.
- **Check `git status` on `backend/src/test/resources/archunit-store` before every backend commit.** A green run can silently empty it.
- **Re-verify bd statuses from the exported JSONL after any `bd import`.** Unioning re-opens issues that were just closed.
