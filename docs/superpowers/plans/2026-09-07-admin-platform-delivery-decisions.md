# Admin platform delivery — decision log (orchestrated autonomous run, 2026-09-07/08)

Daniel's brief: deliver the whole admin/observability series with subagents, decide autonomously,
log every decision here, put every tunable into application.yml.

## Delivery summary (what landed on main)

| PR | What | Status |
|----|------|--------|
| #569 | GHCR tag-retention workflow (mezo-gloh, part 3 follow-up) | merged |
| #570 | Admin hub P2 follow-ups: pending tile states + owner-gated redirects (.16/.17) | merged |
| #572 | RAG explorer S1 — runs list/detail + dry-run replay (BE) | merged |
| #573 | RAG explorer S2 — structured graph, PCA-50 vector map, neighbours, health (BE) | merged |
| #574 | RAG explorer S3 — FE shell + data layer + Futások view + prototype | merged |
| #576 | RAG explorer S4 — Gráf view (d3-force + SVG + inspector) | merged |
| #578 | RAG explorer S5 — Térkép view (umap worker + scatter + neighbours) | merged |
| #582 | RAG explorer S6 — Rétegek view + feature doc + staleness fixes | merged |
| #577 | Part 4: lean screen telemetry (mezo-o5cz) | merged |
| #583 | Admin hub P3 follow-ups: mock paging fidelity, helper consolidation, ArrivalProvider (.18/.19/.20) | merged |

Part 3 (infra observability) was already shipped before this run; its day-after verification
passed (see P3-2) and Telegram wiring was skipped for lack of credentials (P3-1).
**Epic mezo-d5iy (admin hub): CLOSED** — all 20 tasks/follow-ups done.
**Epic mezo-o5cz (part 4): CLOSED.**
Epic mezo-4qyt: S1–S6 slices closed; the epic stays in_progress carrying its 8 filed
follow-ups (mezo-4qyt.7–.14) — intentionally not force-closed.
Flake bug filed: mezo-x2ew (midnight-window test family 00:00–02:00 local, root cause verified).

## Scope decisions

- **S1 — Scope = all 4 parts** (Daniel's explicit choice). Exploration corrected the map:
  part 3 (infra observability, mezo-ibxy) already shipped — only 3 follow-ups remain
  (Telegram alertmanager sealing, day-after verification, mezo-gloh). Part 4 has no spec;
  I write one and deliver a lean, default-OFF implementation.
- **S2 — Execution order**: part 1 follow-ups (small, unblocks admin surface) → part 3
  follow-ups (time-sensitive: day-after verification) → part 2 (main deliverable) → part 4.

## Design decisions

- **D1 — Dry-run replay writes no audit row** (spec option A) instead of widening the
  `serving_mode`/`consumer_policy` CHECK constraints by migration. Why: zero schema risk,
  the replay is explicitly ephemeral, and retention/eval semantics of dry-runs are undefined.
- **D2 — Slice 6 doc = new `docs/features/admin-memory-explorer.md`** rather than a section
  in `admin-hub.md` (already 324 lines; the explorer has its own pipeline vocabulary).
- **D3 — Rewriter/Reranker LlmCallContext**: verify default labels in slice 1; if generic,
  add explicit contexts in the same slice (small change), not a follow-up.
- **D4 — UMAP params (nNeighbors 15, minDist 0.1, seed) stay FE-side** in a constants module,
  not application.yml — client-side rendering concern, not server tunable.
- **D5 — New `mezo.admin.memory.*` @Validated properties record** for every server tunable the
  spec left hardcoded: pca-target-dims(50), vector-sample-threshold(5000), neighbor-default-k(10),
  statement-timeout(PT5S), runs-max-page-size(100), edge-weight-histogram-buckets(10),
  replay-feature-label("admin_replay"). Companion-owned values (rrfK, fusion weights, decay)
  are READ from `mezo.companion.memory-platform.*`, never duplicated.
- **D6 — Feature switch**: new `mezo.feature.admin-memory.enabled` (default false, true in
  k8s deployment), registered in FeaturesConfiguration — mirrors admin-insights precedent,
  independent of it so the memory explorer can be toggled alone.

## Part 1 follow-up decisions

- **F17 — Ungated deep links (.17)**: gate the two legacy redirects (`router.tsx:424-425`)
  on `useMe().data?.role === 'OWNER'` via a small `OwnerOnlyRedirect` element; non-owner gets
  the old in-app page path removed silently (no toast, no bounce). Why not delete the
  redirects: stale bookmarks are real; the toast+eject UX was the bug.
- **F16 — Loading states (.16)**: add `isPending` to `AdminTileQuery` + skeleton branch in
  `AdminTile`, thread through the two synthetic query literals (AdminOverviewPage, AdminDataPage).
- **F18 — Mock paging (.18)**: shared `sliceRows(base, params)` helper used by both
  `adminDataMock` and the MSW handler; enlarge `food_log` fixture (>2 pages) and add
  `is_deleted` to fixture rows so the "Törölt sorok" toggle is exercisable.
- **F19 — Helper consolidation (.19)**: `usd` moves next to `huInt` into `@/shared/lib/huNum`
  (precedent); heat/alpha + series/scale helpers into new `features/admin/lib/adminViz.ts`.
- **F20 — Entrance replay (.20)**: mount `ArrivalProvider` inside `AdminLayout` (single
  mount-point mechanism already handles POP-on-cold-start).
- **F-ORDER — batch A (P2: .16+.17) merges before batch B (P3: .18+.19+.20)** because .16
  and .19 both touch AdminOverviewPage — sequential merge avoids a semantic conflict.

## Part 3 follow-up decisions

- **P3-1 — Telegram alertmanager wiring SKIPPED**: `/tmp/mezo-telegram` does not exist, so the
  bot token/chat id were not available to this run. The blackhole receiver stays; the handoff
  recipe (runbook §4) applies whenever Daniel drops the file. Left open in the tracker.
- **P3-2 — Day-after verification PASSED** (2026-09-07, ~20h after merge):
  vmagent target `serviceScrape/mezo/backend/0` = up on 10.42.0.188:8081;
  `LogErrorBurst` health=ok state=inactive (no error burst, rule evaluates);
  VictoriaLogs `| unpack_json` returns data (1 952 rows / 30 min);
  backend working set 724Mi < 1Gi limit. All monitoring pods Running (20h uptime).
- **P3-3 — mezo-gloh (GHCR tag retention)**: delivered as PR #569. Implementation decision
  (subagent, verified reasoning): direct GitHub REST API via `gh api` instead of
  `actions/delete-package-versions`, because that action matches its ignore filter against
  the version *name* (= digest for containers), never the tags — tag protection is
  inexpressible with it. Keep-set = newest 20 ∪ tags referenced in k8s/*/deployment.yaml.
  Safety: dry-run by default; scheduled runs only enforce when repo var
  GHCR_RETENTION_ENFORCE=true. Multi-arch risk checked: deploy.yml builds linux/amd64 only.

## Part 2 planning resolutions (plan agent, verified against code; full list in the plan's
"Resolved ambiguities" section — docs/superpowers/plans/2026-09-07-rag-memory-explorer.md)

- **P2-1 — D3 inverted after code verification**: `LlmMemoryQueryRewriter`/`LlmMemoryReranker`
  already carry explicit `companion_recall` contexts; the naive "inherit ambient label" fix
  would have relabelled every chat rewrite/rerank row and corrupted the part-1 cost matrix.
  Instead: `FEATURE_ADMIN_REPLAY` constant + `isAdminReplay()` in **llmlog** (shared slice, no
  ArchUnit cycle); the helpers re-label only for replays.
- **P2-2 — rerankerScore is 1/postRerankRank**, not a model score → the UI shows
  "újrarangsorolt hely" (rank delta derived by re-running the fusion comparator), never a score.
- **P2-3 — replay queryProjection costs one extra embed call** — made explicit in replayNotes;
  shipped null in S1, filled in S2.
- **P2-4 — new `RetrievalOutcome` + `retrieveDetailed`** because `MemoryContext` can't carry
  ranked candidates; existing entry points delegate unchanged.
- **P2-5 — 404 disambiguation**: FE treats 404 as "feature off" only when the error code is
  not `ADMIN_MEMORY_*`; deleted run → list refresh.
- **P2-6 — replay toggles are allowances** ("engedélyezve"), not forces.
- **P2-7 — Rétegek L0–L3 cards deferred** to a follow-up; `/health` alone drives the view in v1.
- **P2-8 — slice branches `feat/rag-explorer-s<N>`**, independently mergeable PRs (parallel
  sessions push main daily; small units merge safer).

## Part 2 implementation adaptations (S1, verified by failing tests first)

- **P2-9 — ThreadLocal propagation gap**: rerank + dense-embed run on `applicationTaskExecutor`,
  so `LlmActorContext`/`LlmCallContextHolder` breadcrumbs were lost (actor=null on replay rows).
  Fix: capture + re-bind inside the pool task **for the replay path only** — chat-turn rows keep
  today's shape (widening would retroactively re-label all embed traffic).
- **P2-10 — replay `rewrite` toggle is structurally inert** (`MemoryQueryAnalyzer` needs
  conversation history; a replay has none). Shipped honestly: allowing rewrite yields a
  `rewrite_unreachable_no_history` note instead of a dead switch. Contract documents it.

- **P2-11 — S2 adaptations** (all verified by tests; details in PR body): the plan's
  `MemoryProjectionService` sketch would have imported admin properties into companion
  (ArchUnit cycle) → knobs travel as a `ProjectionRequest` parameter and join the cache key;
  `queryProjection` built inside `AdminMemoryReplayService` (the only scope holding both the
  actor override and the admin_replay label), short-circuiting for NO_MEMORY_NEEDED;
  `vectorSampleThreshold` bound relaxed to @Min(2) so the plan's own sampling ITs can boot;
  degenerate PCA components return a zero basis vector (transform correctness); timestamptz
  read via OffsetDateTime→Instant (pgjdbc limitation); snippet length reuses the companion's
  serving.item-max-chars instead of a new knob; edge-weight histogram gap-fills zero buckets.

- **P2-12 — S3 adaptations**: d3-force/umap-js deps deferred to the slices that import them
  (S4/S5) — S3 ships placeholder Gráf/Térkép/Rétegek views; `degradable<T>` needed an explicit
  cast (the plan's snippet didn't typecheck); inspector "Forrás" link uses real contract fields
  (candidateKind), not the prototype's illustrative text. **Known gap filed for S6**: the
  committed admin-memory.html prototype lacks the src/{head,body}+build.sh wiring the
  prototype convention expects — regeneration impossible until backfilled.

## Part 4 decisions

- **P4-1 — Lean scope, default OFF** (spec: docs/superpowers/specs/2026-09-07-feature-telemetry-design.md,
  ADR 0039): screen views only, route PATTERNS not URLs (no PII path params), one table +
  batch ingest + retention job, everything tunable via `mezo.telemetry.*`; the admin-hub
  spec's "may never be needed" stance honoured by shipping it behind
  `mezo.feature.screen-telemetry.enabled=false`.
- **P4-2 — Implementation adaptations** (PR #577): admin read gated by ADMIN_INSIGHTS_SWITCH,
  not the telemetry switch (telemetry off ⇒ honest zero, not a second 404);
  `useScreenTracking` reads matches via UNSAFE_DataRouterStateContext (useMatches throws
  under plain MemoryRouter in 10 existing tests) with an id/uuid/date-scrubbing fallback;
  `screen_event` carries is_deleted (OwnedEntity mandate) but retention hard-deletes;
  table added to ResetDatabase TRUNCATE list; test properties enable the switch to share
  the default Spring context.
- **P2-13 — S6 adaptation**: prototype sp8/sp4 tile spans don't exist in AdminTile's
  union (3|4|6|12) — rebalanced 6/6; prototype build wiring (src/head+body + build.sh)
  backfilled, regeneration verified byte-identical.

## Operational decisions

- **O1 — bd CLI was wedged** by a hung `bd dolt pull` (30+ min, no output; killed). Working
  from the git-synced `.beads/issues.jsonl`; bd status updates + dolt push retried at close.
- **O2 — Models**: orchestrator Fable; part 2 plan-writing + BE slices 1-2 + reviews on Opus;
  FE slices and follow-up fixes on Sonnet.
- **O4 — GitHub merge-ref recompute stuck today**: `refs/pull/N/merge` would not rebuild after
  base pushes (polled 5+ min, API mergeable poked repeatedly), so `premerge.yml` kept failing
  its freshness assertion. Workaround applied to every PR of this run: merge `origin/main`
  into the branch and push (fresh CI round, ~28 min) right before premerge. mezo-gloh landed
  this way; same treadmill expected for each subsequent PR while main stays busy.
- **O5 — Midnight-crossing flake observed**: `ProactiveApiFeedIT.testGetFeed_shouldLazily
  GenerateElapsedWindows_whenTodayAfterMidday` failed on S5's CI at 00:00:35 Europe/Budapest
  (expected [midday, evening], got [morning, midday]) — same branch content was green an hour
  earlier; only a version bump intervened. Same flake family as mezo-pk63/mezo-3ns7.
  Handled by job rerun; follow-up issue filed to pin the test clock.
- **O3 — Worktrees per branch** under `../mezo-wt-*`; merges to main from worktree via
  `git checkout --detach origin/main && git merge --no-ff <branch> && git push origin HEAD:main`
  (handoff lesson). Full backend suite only ever run by the orchestrator, one Maven at a time.
