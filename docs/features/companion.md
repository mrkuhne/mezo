---
title: Companion (AI chat brain)
type: feature-domain
status: mixed
updated: 2026-09-05
tags: [companion, ai, chat, llm, backend, phase-3]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion
  - backend/src/main/java/io/mrkuhne/mezo/feature/llmlog
  - api/feature/companion/companion.yml
  - api/feature/memory-retrieval/memory-retrieval.yml
  - frontend/src/data/insights/chatHooks.ts
  - frontend/src/data/insights/memoryFeedbackHooks.ts
  - backend/src/main/resources/db/changelog/1.0.0/script/202607031400_mezo-fnnq.2_create_ai_conversation_message.sql
  - docs/decisions/0008-companion-llm-spring-ai-2-gemini.md
related: [insights, proactive, today, me, _platform-api-backend, _platform-auth-security, _platform-notifications, journal, ritual]
---

# Companion (AI chat brain) — Feature Documentation

> One-line: the Phase-3 AI companion — persisted conversations + a Hungarian chat over the
> `CompanionLlm` port (Spring AI 2 / Gemini) with a deterministic cross-feature **context
> snapshot** (now forward-resolving today+tomorrow's training, dated) + the **top-N confirmed
> knowledge facts** in every system prompt, **15 read-only hub-tools** (scope-enumerated,
> `mezo.companion.tools.max-calls-per-turn` = 15) for history/aggregate + forward-plan +
> browse questions (audited into the message envelopes, rendered as real FE chips), a
> system-prompt **`[Eszköz-útmutató]`** tool-routing hint, answered **sync JSON or streamed
> SSE**, and consumed by the **real dual-mode ChatPage**. After every turn an **async extraction** proposes fact candidates that Daniel
> confirms on the **real KnowledgeListPage** (accept/refine/reject — L2). **Status: backend ✅
> V2.1 (spine + snapshot + SSE + tools/audit + facts + extraction/decision + advisors +
> pgvector/EmbeddingPort infra + narrative-memory pipeline + episodic recall tool); FE ✅ V1.3
> (ChatPage + KnowledgeListPage real + degraded badge)
> — v0 „lát engem" + v1 „megjegyez" + **v2 „emlékszik" complete**. The shared hybrid
> memory platform now shadows every chat turn by default and can serve it behind one
> `OLD`/`SHADOW`/`NEW` switch (`mezo-6dii.6`).**
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
  conversation, `GET .../messages`, `POST .../message`; **F7.5 `mezo-d20.8.5.1`: `PATCH /api/companion/conversation/{id}`** —
  rename, `ConversationRenameRequest{title 1..120}`, the list label only — **and `DELETE .../{id}`** — soft delete via the
  entity's `@SQLDelete`; the thread and (through `getOwned`'s filter) its messages become unreachable, nothing is purged).
- **Two switch-gated services** — `ConversationService` (CRUD spine) + `ChatService` (static
  Hungarian companion-voice system prompt + last-N-message history windowing → one sync
  `CompanionLlm.complete()` call → persists both turns).
- **A controller** — `CompanionController implements CompanionApi`, ownership from the JWT.

**V0.3 (`mezo-fnnq.3`) shipped the context snapshot — the "pain-killer":**

- **`ContextSnapshotAssembler`** (`service/ContextSnapshotAssembler.java`) — a read-only,
  deterministic composition of the OTHER features' reads (profile + weight trend, active goal +
  prescription current-week segment + day-planner, active meso + schedules + last-7d digest,
  account level/coins/streak + top skills + weekly XP rollup, today's quest count + habit chains +
  creed/foci/reflection + napzárás state, the active people circle (`[Emberek]`, **mezo-x6oa**,
  chat variant only), FuelDay rollup + protocol + intakes, cycleDay/phase, last sleep + latest
  check-in), rendered as nine Hungarian-labelled blocks under `AKTUÁLIS ÁLLAPOT (pillanatkép —
  {dátum}):` and inserted into the `ChatService` system prompt **between the static voice and the
  history transcript**.
  Missing data renders as explicit `nincs adat`, never invented; no LLM anywhere in the path.

**V0.4 (`mezo-fnnq.4`) shipped streaming + the real FE:**

- **SSE stream endpoint** — `POST .../message/stream` (`text/event-stream`): 0..n `delta`
  events (JSON `StreamDelta{text}`) interleaved with 0..n `tool` events (JSON
  `StreamToolCall{type,name}`, emitted the moment each tool executes — mezo-280, see §3 below),
  then exactly one terminal `done` (the persisted assistant `MessageResponse`) or `error`
  (`StreamError{code}`, assistant NOT persisted). Hand-written `CompanionStreamController` +
  `ChatStreamService` over the port's `stream(…)` — the **contract-first SSE precedent** (§9
  Decision 11).
- **Two-transaction streamed turn** — `ChatService.prepareTurn` (user row) → LLM stream →
  `ChatService.completeTurn` (assistant row); a mid-stream failure keeps the user row only.
- **Real dual-mode FE** — `useChat()` + `useChatActions()` (`data/insights/chatHooks.ts`) +
  `chatApi.ts` (fetch-ReadableStream SSE client) drive the rewritten ChatPage: history load,
  optimistic streamed turn, honest degraded state on switch-off 404.

**V0.5 (`mezo-fnnq.5`) shipped tool calling + real tool-chips — v0 „lát engem" is complete:**

- **8 read-only tools** in `feature/companion/tools/` (spec §5 first batch), grouped by source
  domain: `TrainTools` (`get_recent_workouts`, `get_sport_sessions` — sport + run logs; the two
  merged into one scoped `get_training_log(scope, days)` since mezo-xixu, see the catalog below),
  `BiometricsTools` (`get_weight_trend`, `get_sleep` — expanded into one scoped
  `get_recovery(scope, days)` (adds sleep-goal + check-ins) since mezo-xixu, see the catalog below),
  `FuelTools` (`get_recent_meals` day
  rollups — merged into one scoped `get_fuel_log(range, date, days)` day/week + water since
  mezo-xixu, see the catalog below; `get_protocol_adherence` — merged into one scoped
  `get_protocol(scope, days)` adherence/intake/supplements since mezo-xixu, see the catalog below),
  `GoalTools` (`get_goal_progress` — merged into one scoped `get_goal(scope)`
  progress/recept/timeline/guards/feasibility since mezo-xixu, see the catalog below),
  `MedicationTools` — one scoped `get_medication(scope)` tool since mezo-xixu (`scope ∈
  {cycle, all}`, default `cycle`, renamed from the drug-specific original scope names in
  `mezo-lwmq`), see the catalog below. All
  ownership-scoped via `ToolContext` (`userId` from the JWT principal,
  NEVER from model args), compact deterministic Hungarian text results, `nincs adat` absences.
- **9th tool — `get_training_plan` (forward plan, mezo-xixu)**, added onto `TrainTools`: the
  companion's first FORWARD-looking read (the other 8 are backward/aggregate). `scope ∈
  {today, tomorrow, week, meso, date}` (default `today`) resolves the dated gym day via
  `WorkoutService.findPlannedTemplateForDate` + `ExerciseRepository` (read-only — never
  `WorkoutService.getToday`, which auto-closes stale instances/ensures closing exercises) plus the
  active running block's prescribed session for that weekday (`RunningService.listBlocks` +
  `RunningBlockStructure`, week derived from the block's `startDate`, not the stored
  `currentWeek`), plus **any recurring sport-schedule slot falling on that weekday**
  (`SportService.getSchedule`, slot convention `0=Hét..6=Vas`, mezo-ajp); `scope=meso` renders the
  full active mesocycle (`TrainService.listMesocycles`) — weeks/phases/day-templates. One day
  renders as `gym (…): … ; sport: … ; futás: …`, the same three parts in the same order as the
  snapshot's `Ma (terv):`/`Holnap (terv):`. **Both the sport and the gym part are shared code** — `ToolText.sportLine`
  and `ToolText.gymLine` (mezo-4qu) — so the tool and the prompt snapshot cannot disagree about a day.
  The gym helper owns the rest-day criterion outright: a present-but-empty template (zero exercises)
  is a rest day, rendering `pihenőnap (gym)` on both sides, and a populated one renders
  `gym (<day label>): <exercises>`. Sharing it is what the drift cost: the criterion used to be
  duplicated in `TrainTools.dayContentLine` and `ContextSnapshotAssembler.dayLine`, the snapshot's
  copy was missing it, and — since the meso wizard stores all 7 weekdays as template rows, weekend
  rest days included (`type=Rest`, zero exercises) — it claimed a gym day every weekend (the
  weekend-training hallucination, mezo-650a); the tool's copy then still said `gym: pihenőnap` for
  the same day (mezo-4qu). `CompanionToolsRenderIT` pins both renderers on the same day, empty and
  populated, so a third divergence cannot land silently. `nincs adat` only when there is neither an active mesocycle, nor an active running
  block, **nor a sport slot** at all — a volleyball evening is a plan in its own right; a real rest
  day within an active plan renders `pihenőnap`.
- **10th tool — `get_exercise_records` (PR/e1RM, mezo-xixu)**, also on `TrainTools`: the "would I
  break a PR" basis, over the read-only `ExerciseRecordService.list` compute-on-read aggregation
  (Epley e1RM = weight×(30+reps)/30). No/blank `exercise` → a top-5 summary ranked by best e1RM;
  with `exercise` → case-insensitive name-contains match(es) rendering bestSet/bestE1rm/
  repRecords/recentTopSets. Bodyweight-only lifts (no weighted sets) render the honest "nincs
  súly-PR" line rather than a fabricated number.
- **11th tool — `get_recipes` (recipes, mezo-xixu)**, on `FuelTools`: read-only over
  `RecipeService.list` (`@Transactional(readOnly=true)`) — a single strong `filter` match renders
  full detail off the SAME `.list` response, no separate `.get` call. No/blank `filter` → a
  compact list (name, category, whole-recipe kcal/protein, mezo-fit score); with `filter` → a
  **scored free-text match** (mezo-sxe): the filter is folded (lowercase + NFD accent-strip) and
  split into tokens (1-char tokens dropped), each token weighted by the axis it hits — name (4) >
  ingredient name (3) > slot/category/role/tag/fitsFor/starred (2). Recipes hitting EVERY token
  win outright; only if none does do partial matches stand in, so a noisy filter still answers
  instead of falling through to `nincs adat`. The **best** scorer (strictly ahead of the runner-up,
  or the only one) renders the full detail (all 4 macros + fit score + ingredient lines); a tie
  renders the list. Capped at 5 rendered/audited recipes either way.

  Before mezo-sxe the filter matched slot/category/tag/starred/fitsFor only — the recipe **name**
  was deliberately excluded, citing a `spec §R1` that does not exist anywhere in `docs/` or its
  git history. So asking for a recipe by name (the most natural way to ask) always answered
  `nincs adat`, ingredient names went unused despite riding in the same response, and a two-word
  needle was matched as one substring, so `"smoothie collagen"` could never find
  `"Collagen Smoothie"`. The `starred` axis also matched bidirectionally
  (`keyword.contains(needle)`), making any short needle — `"cs"`, `"a"` — return every starred
  recipe; it now answers only to a whole token.
- **12th tool — `get_pantry` (pantry, mezo-xixu)**, also on `FuelTools`: read-only over
  `PantryService.getPantry` (splits into `ingredients`/food and `stash`/supplement+stim+med).
  `kind ∈ {food, supplement, stim, med}` (default: all kinds) lists each item's name + stock
  qty/unit, plus expiry for food (`IngredientResponse.stock.expires`; the stash projection carries
  no expiry). Null-guarded per item (no stock tracked → name only); capped at 5 rendered/audited items.
- **13th tool — `get_growth` (gamified growth, mezo-xixu)**, new `GrowthTools` bean: reads across
  `ProgressionService.getProfile` (skill levels/XP, ungated), `GamificationService.getProfile`
  (account level/XP/streak/titles, `GAMIFICATION_SWITCH`-gated, read via `ObjectProvider` — the
  `BiometricsTools#sleepGoalService` precedent), `GrowthWeekService.growthWeek` (weekly rollup,
  ungated) and `AchievementService.achievements` (badges/perks, ungated). `scope ∈ {skills, week,
  achievements, titles}` (default `skills`): scope=skills renders account level/XP/live-streak
  plus every skill with real progress (athletic/muscle/life, filtering out the fixed-taxonomy
  ghost defaults); scope=week/achievements render honest zeros per each backing service's own
  doc (never `nincs adat`); scope=titles renders the equipped + owned titles resolved to their
  Hungarian display names via `TitleCatalog` (ungated, direct-injected field — not
  `ObjectProvider`), falling back to the raw key only if it's missing from the catalog (never
  `nincs adat` unless gamification itself is off). `nincs adat` only for scope=skills, gated on
  `ProgressionProfileResponse.athleteLevel == null` (the service's own "no skill_progress rows
  yet" ghost signal).
- **14th tool — `get_daily_practice` (daily discipline, mezo-xixu)**, new `PracticeTools` bean: a
  date-parameterized sibling of `ContextSnapshotAssembler#practiceBlock` (which is hardwired to
  "today") — composes today's-or-a-given-date's quest count (`TodayQuestSource.todayStats`, the
  same read-only port), habit chain-strength (`HabitService.summary` — note: has no `date` param,
  so this line is always "as of today" regardless of the requested date), the daily intention
  (`IntentionService.getDay`: creed/foci/reflection), napzárás close state (`RitualService.getDay`),
  and logged activities. Every collaborator is `ObjectProvider`-gated (HABIT/INTENTION/RITUAL/
  ACTIVITY_SWITCH + the quest port's QUEST_SWITCH). Activities are read through a SECOND
  companion-owned port, `TodayActivitySource` (impl `activity/service/DailyActivityAdapter`, a
  plain `ActivityLogRepository` read) rather than `ActivityService` directly: `feature.activity`
  already depends on `feature.companion` (`ActivityClassifier`'s `CompanionLlm` use, plus
  transitively via `feature.quest`), so a direct `ActivityService` import from `companion.tools`
  would have closed a NEW 2-/3-slice cycle (`ArchitectureTest#feature_slices_are_cycle_free` only
  tolerates the two pre-existing frozen cycles) — the `TodayQuestSource` pattern, applied twice.
  Active challenges are deliberately NOT composed: `ProactiveChallengeService.getChallenges` is
  write-transactional (lazy-generates the first proposal + resolves accepted-challenge outcomes),
  and a direct `ChallengeRepository` read would open the same kind of NEW companion→proactive
  cycle (proactive's generators already call `CompanionLlm`) — fixing that cleanly needs a THIRD
  port, out of scope here.
- **15th tool — `get_insights` ("Minták", mezo-xixu)**, new `InsightsTools` bean — the feature this
  whole tool-expansion effort started from. Only `scope=patterns` is live: `PatternService.list`
  (same `companion` slice, injected directly — no `ObjectProvider`, gated on the same
  `COMPANION_SWITCH`) filtered down to `PatternEntity.STATUS_CONFIRMED` rows (the standing,
  user-judged patterns — not the proposed/monitoring/rejected inbox), capped at 5, rendering title
  + the deterministic mechanism prose (carries direction/strength) + evidence chips (r/n/p) when
  present. `scope=predictions`/`scope=experiments` are DEFERRED, not composed: their backing reads
  (`ProactivePredictionService#getPredictions`, `ProactiveExperimentService#getExperiments`, both
  in `feature.proactive.service`) lazily GENERATE on a miss inside a `@Transactional` method — a
  write on what would otherwise be a read tool, the same violation `PracticeTools` already
  documents for `ProactiveChallengeService#getChallenges` — and `feature.proactive` already depends
  on `feature.companion`, so a direct import would ALSO close a brand-new companion↔proactive
  cycle. Both scopes render an honest "még nem elérhető" (never a fabricated result, never a
  `nincs adat` that would misread as a real per-user absence). DONE_WITH_CONCERNS — resolving this
  cleanly needs a companion-owned read port (the `TodayQuestSource` pattern) plus a genuinely
  side-effect-free read on the proactive side; neither exists today.
- **Tool-selection hardening (mezo-xixu, design spec §7).** With 15 active tools the bottleneck
  is SELECTION, not implementation (2026 tool-calling research: accuracy degrades past ~15–20
  active tools). Four cheap→heavy measures, all shipped except the last: (1) **description
  discipline** — every `@Tool` description states a narrow responsibility + enumerated `scope`
  values + an explicit "Használd, amikor…" trigger clause, codified in
  [`companion_tool_conventions.md`](../references/companion_tool_conventions.md); (2) a
  **`[Eszköz-útmutató]` tool-routing hint** block in `ChatService.SYSTEM_PROMPT` (question-type →
  tool name, kept in sync with the `@Tool` descriptions); (3) the enriched **snapshot-first**
  context (Component A above) removes most tool calls before they'd ever be needed; (4) a
  **measurement phase** — `ToolSelectionEvalIT` (`feature/companion/eval/`, `@Tag("eval")`,
  opt-in, real `GeminiCompanionLlm` over a 40-case representative Hungarian question set) reports
  selection-accuracy from the `RecordingToolCallback` audit: baseline **37/40 = 92.5%**, printed
  via `log.info`, not a CI pass/fail gate. (5) **Tool-RAG is a prepared-but-INACTIVE escape
  hatch** on the existing pgvector `EmbeddingPort` — deliberately not built (YAGNI): its trigger
  is selection-accuracy dropping below ~85% (this baseline is comfortably above) **or** the
  toolset growing past ~20–25 (e.g. when write-tools land). Re-run the eval whenever tools are
  added/renamed/reworded to keep the baseline current.
- **Registry + audit spine** — `CompanionToolRegistry` wraps every callback in
  `RecordingToolCallback` (audit + per-turn budget, structurally unbypassable); the per-turn
  `ToolCallAudit` rides in the Spring AI `ToolContext`, collects `{type:'read', name, args}`
  calls + tool-contributed refs (deduped, capped), and persists into the V0.2 jsonb envelopes.
- **Chips are real** — `CompanionMapper` puts `name(args)` on the wire
  (`get_recovery(scope=sleep, days=3)` — the mock-seed chip style); the FE `toChatMessage` already passed
  `tools[]`/`refs[]` through, so history AND the streamed `done` event now render real chips.
- **IDENT-2 structurally** — new ArchUnit rule `companion_tools_are_internal_sphere_only`
  (no HTTP/mail client deps in the tools package, ever).

**V1.1 (`mezo-fnnq.6`) shipped the L3 memory spine — knowledge facts + prompt injection:**

- **Two new owned tables** — `knowledge_fact` (fact_text, category `train|fuel|health|life`,
  source `chat|pattern|manual` — a fourth, `weekly_review`, joined in `mezo-d20.7.6`,
  reinforcement_count, `include_in_prompt`, last_reinforced_at)
  + `learned_fact` (candidate → decision `accept|reject|refine` null-until-decided →
  promoted_fact_id; **table-only in V1.1** — the extraction/confirm flow is V1.2; `mezo-d20.7.6`
  added `source`/`week_start`/`evidence` so the weekly review can propose onto the same flow —
  see [`proactive.md`](proactive.md) WR).
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
  promote into `knowledge_fact` — with the source **INHERITED from the candidate**
  (`chat`, or `weekly_review` for a weekly lesson, `mezo-d20.7.6`) — which the V1.1 top-N
  injection then carries into every prompt. One decision per candidate
  (400 `COMPANION_CANDIDATE_ALREADY_DECIDED`).
- **KnowledgeListPage goes real** — dual-mode `useKnowledge`/`useKnowledgeActions`
  (`data/insights/knowledge{Api,Hooks}.ts`): pending L2 candidate cards (Elfogad / Pontosít
  inline / Elvet), persisting `include_in_prompt` toggles, degraded banner on switch-off 404.
  The FE `FactCategory` unified on the backend enum (`train|fuel|health|life`).

**V1.3 (`mezo-fnnq.8`) shipped never-ask-twice + the advisor chain v1 — v1 „megjegyez" complete:**

- **Post-response advisor chain** (`feature/companion/advisor/`, old docs §4.5 retry semantics
  on the port): `CompanionAdvisorChain.review(...)` runs after every LLM answer —
  `ClinicalOutputCheck` first (deterministic accent-folded regex: Rx term + dose-change verb in
  one sentence; a hit skips the verdict that round), then `TurnVerdictCheck` (ONE cheap-tier
  LLM call → strict-JSON `{redundantQuestion, unmarkedClaim, reason}` — the second key was
  `ungroundedClaim` until it was renamed at mezo-q71s ([ADR
  0028](../decisions/0028-marked-speculation-in-chat.md)) to allow marked speculation, defensively
  parsed, **fail-open**). Violation → corrective re-prompt (`AdvisorRetry.block` appended to the
  system prompt; same tools + same audit) up to `advisors.max-retries`; a still-violating answer ships
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

**Shared RAG memory platform foundation (`mezo-6dii.1`) — canonical storage without a serving cutover:**

- `memory_item` is the owner-scoped, source-addressable canonical retrieval projection. It keeps
  normalized search text, temporal validity, salience, topics/people and typed provenance apart
  from any embedding model.
- `memory_vector` stores independently deployable embedding generations per item. Multiple
  generations can coexist; only a ready live row is ANN-searchable. This makes re-embedding and
  OLD/SHADOW/NEW comparison possible without overwriting the current vector.
- `memory_retrieval_run` → `memory_retrieval_result` → `memory_retrieval_feedback` is the durable
  retrieval audit chain: policy/query/serving mode, ranked candidates with score components, then
  a user judgement. Composite foreign keys keep every link within one owner.
- The migration backfills every live legacy `memory_embedding` into one canonical item plus one
  ready `gemini-embedding-001-768-v1` vector and fails on an incomplete copy. The legacy table is
  deliberately unchanged and remains the chat's OLD serving source until the later shadow gate.
- `knowledge_fact` now has additive pinning, validity, supersession/conflict links and typed
  provenance. Existing prompt inclusion semantics remain unchanged.

**Canonical dual-write and vector generations (`mezo-6dii.2`) — population without a serving cutover:**

- Every successful legacy `memory_embedding` write now schedules an AFTER_COMMIT projection into
  `memory_item` plus the configured ready serving generation in `memory_vector`; all ten narrative
  kinds use this one path. The projection runs in its own transaction, so a canonical-write failure
  is logged but cannot roll back the already-durable OLD row.
- Projection is source-key idempotent: content is accent-folded for search, SHA-256 hashed, updated
  in place on drift, suppressed with all live generations on source deletion, and revived under the
  same canonical id when the source returns. Same hash plus an existing ready generation is a no-op.
- The optional re-embedding job is disabled by default. When enabled it fans out over active,
  onboarded users and fills one explicit target generation in bounded, `SKIP LOCKED` batches;
  pending/failed/stale rows resume safely while older ready generations remain readable.
- `memory_embedding` is still the sole serving source. The new canonical rows are population and
  migration infrastructure only; retrieval cutover remains behind later shadow/evaluation gates.

**Adaptive memory query preparation (`mezo-6dii.3`) — consumer-neutral input, still no serving cutover:**

- `MemoryRequest` is the shared boundary for chat, morning briefing, weekly memoir and prediction
  evidence. It carries owner, consumer policy, raw question, short history, as-of date, token budget,
  optional conversation identity and deep-search intent; this slice only prepares the query and does
  not retrieve or persist anything.
- `MemoryQueryAnalyzer` routes conservatively in pure code: closed Hungarian greetings/thanks/meta
  phrases need no memory; short referential follow-ups with usable history are context-dependent;
  everything else is self-contained. Explicit ISO dates become deterministic `from`/`to` bounds.
- Only context-dependent requests reach the existing cheap `CompanionLlm` port. The rewrite sees at
  most the latest six nonblank turns, with each turn capped at 500 characters, and must return one
  standalone Hungarian query of at most 500 characters. Provider failure, blank output or oversized
  output falls back to the untouched raw query. `PreparedMemoryQuery` retains raw and dense forms
  separately so later retrieval and audit can compare them.

**Shared memory context pipeline (`mezo-6dii.5`, chat rollout `mezo-6dii.6`):**

- `MemoryContextService` prepares the query, runs the four named retrievers concurrently with an
  independent 200 ms deadline, cancels timed-out work, isolates every failure,
  fuses their results, applies a strict
  prompt budget and persists a complete audit in a separate transaction. `NO_MEMORY_NEEDED`
  still creates an auditable empty run without an embedding, retriever or reranker call.
- Weighted reciprocal-rank fusion deduplicates stable candidates and records every bounded score
  component. Chat candidates carry their source conversation separately from the message source ID;
  selection collapses near-duplicates, caps one conversation at two chat turns, keeps exact
  unresolved fact pairs together, preserves standalone conflict edges and uses the renderer's exact
  conservative length estimate.
- The optional smart-tier reranker is disabled by default and only eligible on explicit uncertainty
  or deep/weekly policy. It can reorder only the IDs actually exposed to it; its own configured
  deadline, malformed output or provider failure returns the deterministic fused order.
- The result is one provenance-carrying `MemoryContext` (`items`, `[Hosszú távú memória]` block,
  refs, persisted run ID and diagnostic trace ID). Chat now consumes it in SHADOW by default and
  can switch to NEW without a second assembly path; OLD remains frozen for rollback.

**Retrieval feedback and canonical suppression (`mezo-6dii.7`):**

- NEW-mode disclosure cards with stable audit IDs now let the beta user mark a result useful or
  irrelevant, or suppress its canonical memory after a two-tap confirmation. Feedback upserts on
  the audited owner/result pair; suppression changes the canonical item state to `suppressed`, so
  every subsequent retriever excludes it without deleting the source record or its audit history.
- The chat page batch-loads the feedback for the newest 100 visible result IDs in one request,
  writes actions optimistically with rollback on failure, and keeps pre-rollout cards that have no
  retrieval IDs display-only. Fact and graph candidates have no canonical `memory_item`, so the UI
  keeps useful/irrelevant but does not offer suppression; the API also rejects such a request.

**Synthetic Hungarian retrieval evaluation (`mezo-6dii.8`):**

- `memory-hu-v1` is a fixed-seed (`20260904`) corpus of coherent synthetic timelines for exactly
  three isolated personas: rich logging, sparse logging and changing/contradictory circumstances.
  It contains 540 natural-language Hungarian queries split by whole scenario into 108 development,
  108 tuning and 324 sealed holdout cases (108 per persona). These are different data shapes, not
  renamed copies: the rich persona has dense background notes, the sparse persona omits most
  supporting summaries and spreads events farther apart, while the changing persona carries many
  high-salience superseded states.
- Every split covers paraphrase, contextual follow-up, exact value, old-salient, adversarial
  near-negative, negation, superseded, empty and cross-owner families. Relevance is graded
  `0/1/2`; the generator rejects missing gold sources, split leakage, malformed empty cases,
  missing foreign distractors and persona/family minimum failures. It also rejects duplicate source
  text, duplicate query text and cross-split query pairs with token Jaccard similarity `>= 0.90`.
  Even the no-memory phrases use disjoint semantic phrase pools per split; punctuation variation is
  confined within a split. Ownership distractors deliberately share the gold vector axis and have
  higher salience, so owner filtering—not an easy ranking mismatch—is what keeps them out.
- The JSON contains no fake-adapter sentinels. Network-free CI adds scripted geometry only in the
  deterministic runner with source-derived stable fixture UUIDs, then compares the frozen OLD
  assembler with `MemoryContextService` and
  calculates macro Recall@5, nDCG@5, MRR, context precision, empty false positives and ownership
  leakage over each path's final selected prompt context (the same lifecycle stage on both sides).
  The runner relaxes the retriever deadline to 5 seconds only in this test so host load cannot turn
  ranking results into timeout results; latency remains a real-provider concern. This is a
  wiring/regression smoke test, not evidence for the 85% semantic release gate.
- The holdout runner refuses to start until `review.json` records an explicit human approval whose
  non-blank reviewer, review date, corpus version, seed, query count and SHA-256 match the exact
  holdout bytes and the caller-supplied corpus equals that artifact. Regeneration therefore
  invalidates an earlier approval instead of silently reusing it. The real Gemini release gate and
  versioned report belong to `mezo-6dii.9`.

**V2.2 (`mezo-fnnq.10`) shipped daily summaries + the embed pipeline — the memory fills itself:**

- **`daily_summary` table + generator** — `DailySummaryService.generate(userId, date)`: a
  deterministic, date-scoped Hungarian digest of one FINISHED day's L0 (train/sport/run, fuel-day
  rollup, sleep, weight, medication cycle-day + dose, check-ins — reusing the owning features' reads;
  `nincs adat` semantics by omission; **since V3.4** also the qualitative fields: sleep/run
  notes, mention tone+excerpt, intention reflection — capped per `summary.note-max-chars`) → ONE cheap-tier `CompanionLlm` call (prompt behind
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
  vector per turn** (`Daniel: …
Mezo: …`, ref = assistant message id).
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
- **Ambient recall is always-on since W3.1 (`mezo-b3pp.12`)** — see the Phase 5 row in the status
  table below; the tool stays for deep, targeted recall on demand.

**V3.1 (`mezo-fnnq.12`) shipped statistical patterns + the Inbox — v3 „észrevesz" started:**

- **The second nightly cron** — `PatternDetectionJob` (02:40, switch
  `mezo.techcore.cron.pattern-detection-job.enabled`): for every pair in the config catalog
  (`mezo.companion.patterns.pairs`, 8 pairs v1 — **29 since V3.4**, `mezo-6ha5`) it lag-aligns two per-day metric series over the
  lookback window, gates on `min-n` (8) and — for binary A metrics — `min-group-n` (3 per
  0/1 group), runs PURE Pearson math (`PearsonCorrelation` — r, n and
  a real two-sided p via the incomplete-beta t-test, fixture-tested; no LLM anywhere) and
  **upserts one row per `(user, kind, pair_key)`**: stats refresh while `proposed`/`monitoring`,
  a user-judged `confirmed`/`rejected` row is never auto-touched (V3.3 adds reinforcement).
- **Series extraction** — `MetricSeriesService`: 12 `MetricKey`s v1 (sleep quality/duration,
  training RPE, sport load, gym volume, late-meal hour, daily kcal, medication cycle-day, water,
  morning weight-delta, check-in stress/energy) — **31 since V3.4** (the full list in the V3.4
  block below) — composed read-only from the owning features'
  EXISTING reads; deterministic multi-row aggregation, absence is absence (never bridged).
- **Honest numbers** — `confidence` is NULL on statistical rows (FE renders „tanulom");
  evidence chips carry `r=… · n=… nap · p=… · window`; mechanism is a deterministic HU sentence.
- **Inbox API + PatternsPage real** — `GET /api/companion/pattern` +
  `POST …/pattern/{id}/decision` (confirm/monitor/reject — REPEATABLE transitions, a pattern is
  a standing judgement); FE `usePatterns`/`usePatternActions` dual-mode (the knowledge recipe),
  PatternCard's decision buttons persist, critique bars render only when present (V3.2),
  degraded card on switch-off 404.

**The gate extracted into `PatternGate` + a live monitor (`mezo-viqs`, group-balance extension
`mezo-0469`):** the
surfacing gate `detectPair` ran inline (the `aligned < min-n` and constant-series checks) moved
into `PatternGate` (`service/PatternGate.java`) — package-private, static, Spring-free, the
`PearsonCorrelation` precedent. `evaluate(seriesA, seriesB, lagDays, minN, minGroupN,
metricAValueKind)` → `Outcome(Verdict, alignedDays, PearsonCorrelation.Result,
Side constantSide, groupZeroDays, groupOneDays)`. `Verdict ∈ {LIVE, FEW_DAYS, NO_DATA,
IMBALANCED_GROUPS, DEGENERATE}`; the exact order is `NO_DATA → FEW_DAYS → IMBALANCED_GROUPS →
DEGENERATE/LIVE`. `MetricValueKind ∈ {NUMBER, CLOCK_HOUR, BINARY}` lives on every `MetricKey`;
the group gate runs only for `BINARY` A metrics and requires at least `min-group-n` exact 0 and 1
values before Pearson is meaningful. `Side ∈ {A, B, BOTH}` names the constant series on
`DEGENERATE`; group counts exist only for a binary pair that reached the total-size gate.
**`FROZEN` is deliberately NOT in `Verdict`** — it is the
consequence of a persisted row's `confirmed`/`rejected` status, decided by the caller, never by
the gate math. `detectPair` now calls `PatternGate.evaluate` and upserts only on `LIVE`
(`PatternDetectionService.java`); therefore `few_days`, `no_data`, `imbalanced_groups` and
`degenerate` create/update no pattern row, snapshot or notification. A stale proposed row is left
byte-for-byte unchanged until the pair is LIVE again. The per-pair `try/catch` isolation and the
`upsert`/`reinforcePromotedFact` logic are unchanged, and `PatternDetectionServiceIT` is
the persistence boundary proof. **`PatternMonitorService`** (`service/PatternMonitorService.java`, read-only,
switch-gated) sits behind the new `GET /api/companion/pattern/monitor` — for every catalog pair
it re-runs `PatternGate.evaluate` over the EXACT SAME windows the nightly job would use
(`to = yesterday`, `from = to − (lookbackDays−1)`, B lag-shifted) and reports the **6-verdict
model**: `live` (gate passed, live `r`/`n`/`p`; binary pairs also carry both group counts) /
`few_days` (aligned days below `min-n`, with
`missingDays` + the thinner-covered bottleneck metric) / `no_data` (zero aligned days) /
`imbalanced_groups` (enough total days, but fewer than `min-group-n` observations in either
binary group; counts + required threshold, no `r`/`n`/`p`) / `degenerate` (enough eligible days
but a constant series) / `frozen` (a `confirmed`/`rejected` row — no
recompute, its own frozen `r`/`n`/`p` are reported) — plus per-metric coverage for ALL
`MetricKey`s (31 since V3.4; series pulled once per metric into a request-scoped cache, so the pair verdicts and
the coverage block share one snapshot — windowed via the shared `PatternGate.window` since V3.4). Because the nightly job and the monitor call the
**identical** `PatternGate.evaluate`, the monitor cannot say anything other than what the job
would decide — that shared code is the whole credibility of the diagnostic; the service writes
nothing (no new table, no migration). **`lastRunAt` is `max(lastDetectedAt)`, not "last job
execution"** (review fix wave `mezo-viqs`): the nightly job runs every night regardless,
but this field only advances when it upserts a `LIVE` row, and a `confirmed`/`rejected` row is
never auto-touched by that upsert (`detectPair` calls above) — so a user with an empty Inbox or an
all-user-judged Inbox sees `null`/a stale date here even though the job keeps running on schedule. The FE
(`insights.md` §2.8) labels the field **„Utolsó felismerés"** for exactly this reason, deliberately
NOT "Utolsó futás" (last run) as the frozen design spec originally had it — no new persistence was
added; this is a copy-only fix so the label matches what the value actually measures. **A known,
left-as-is quirk (spec §3.5):** the job reads
`lag=1` pairs' B-series up to `to + 1` — i.e. the current, partially-logged day — while the
A-series stops at yesterday; the monitor prints the window bounds so this is now at least
visible, but it is **not fixed** in this change.

**`pattern_event` (S1, `mezo-tk88.1`, post-epic) is the pattern's append-only history** —
never updated or deleted, three writer sites: `PatternDetectionService.recordSnapshot`
(`PatternDetectionService.java:138-146`, one `snapshot` row per LIVE nightly evaluation, even on
frozen `confirmed` rows) and `.reinforcePromotedFact` (`PatternDetectionService.java:165-171`,
one `reinforced` row per cooled-down recurrence); `PatternService.decide`
(`PatternService.java:66-79`, helper at `PatternService.java:92-101`) appends a
`confirmed`/`monitoring`/`rejected` row on **every** decision, plus — on the FIRST confirm only —
a `promoted` row (payload = the new `factId`) written **after** the decision row. **First reader
(S1 close, `mezo-tk88.3`):** the pattern-pair-detail endpoint's `events[]` — see below.

**V3.2 (`mezo-fnnq.13`) shipped the AI hypothesis loop — propose → critique → revise:**

- **The weekly smart-tier pipeline** — `HypothesisPipelineService` (cron `HypothesisJob`, Sunday
  03:00, switch `mezo.techcore.cron.hypothesis-job.enabled`): gather (last-7 daily-summary
  narratives + confirmed-facts block + the live statistical patterns' r/n/p — grounded
  statistical support; **since V3.4 also** the weekly raw metric table + the non-live pairs'
  gate diagnostics, see the V3.4 block) → **propose** (strict-JSON, `llm.smart-model` — the Pro tier's debut) →
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

**V3.4 (`mezo-6ha5`) shipped the catalog expansion + AI-context enrichment (spec:
`2026-08-11-pattern-catalog-expansion-design.md`):**

- **19 new `MetricKey`s (12 → 31)**, extractors in `MetricSeriesService`, all composed read-only
  from existing collector UIs (spec §2 audit — no new collection surface needed):
  - *Direct:* `gym-workload` (ExerciseFeedback workload 1–3, day avg — **the gym-RPE proxy**) ·
    `gym-joint-pain` (day **max** — pain is peak-sensitive) · `checkin-body`/`checkin-mental`
    (day avg) · `bedtime-hour`/`wakeup-hour` (fractional hour from the `"H:mm"` clock strings;
    **bedtime before-noon hours shift +24**, 01:00 → 25.0, so "later" stays monotone) ·
    `sleep-awakenings` (max) · `daily-protein-g` (FuelDay rollup, meal-days only — the
    DAILY_KCAL pattern generalized into `fuelRollup`) · `meal-score` (avg of scored meals) ·
    `medication-dose-mg` (the last administered dose on-or-before each day — the cycle-day anchor
    pattern) · `habits-done` (count of `done` rows; a habit-row day with zero done is a REAL 0)
    · `ritual-closed` (0/1 from the first-ever closed day onward — pre-adoption days are absent,
    not 0; **`mezo-b3pp.2`:** both the adoption lookup and the lit-day set use the closed-only
    `ritual_day` finders, so an OPEN reflection-only row neither starts the series early nor
    lights a day up) · `daily-xp` (activity + habit + completed-quest XP sum; zero-XP days absent) ·
    `social-mentions` (mentions per ts-day) · `run-hr-recovery-s` (avg).
  - *Derived (sport-science):* `weekend` (0/1 calendar series — control variable) · `acwr`
    (7d/28d rolling mean ratio of daily load; the extractor internally reads 28 days BEFORE the
    caller's window — the caller's `[from,to]` contract is unchanged; chronic 0 ⇒ no point) ·
    `training-monotony` (Foster: 7d rolling mean/SD, population SD; SD=0 ⇒ no point, never ∞) ·
    `bedtime-variability` (7d rolling SD of bedtime-hour, min 3 data days — social-jetlag
    signal). Daily load = sport-min + gym-volume/`load-gym-kg-per-min` (config, 100).
- **21 new pairs (8 → 29)** in `mezo.companion.patterns.pairs` — the missing gym-RPE pair
  (`sleep-quality~next-day-gym-workload`), overload/injury signals (`gym-volume~next-day-joint-pain`,
  `acwr~next-day-joint-pain`), sleep hygiene (`bedtime-hour~sleep-quality`,
  `ritual-closed~next-sleep-quality`, `late-meal~next-sleep-awakenings`), stress-eating
  (`checkin-stress~late-meal-hour`, `weekend~late-meal-hour`), mood/energy responses
  (`habits-done~checkin-mental`, `daily-xp~checkin-mental`, `social-mentions~checkin-mental`,
  `training-monotony~checkin-energy`, `bedtime-variability~checkin-mental`,
  `wakeup-hour~checkin-energy`), nutrition→energy (`daily-protein~next-day-checkin-energy`,
  `meal-score~next-day-checkin-energy`, `medication-dose~daily-kcal`), and recovery
  (`sport-load~next-sleep-quality`, `sleep-quality~next-day-hr-recovery`,
  `checkin-body~gym-joint-pain`, `gym-workload~next-day-checkin-body`). The monitor page shows
  them automatically — zero FE work, contract unchanged.
- **Run-level series cache in `detect()`** — one `series()` call per metric per run into an
  `EnumMap` over the union `[from, to+maxLag]` window; per-pair exact windows via the shared
  `PatternGate.window(...)` static helper (the monitor's request-scoped cache now uses the same
  helper — one windowing implementation for both).
- **Digest enrichment (B1)** — the V2.2 digest now carries the qualitative fields: sleep
  `notes`, run `notes`, check-in `note` (cap moved off the snapshot config), People mention
  tone + excerpt (newest 5/day), and the evening intention reflection (categorical yes|partial|no
  rendered as igen/részben/nem). Each field capped at `mezo.companion.summary.note-max-chars`
  (200). Narrative AND embedding get richer — the text signal the deterministic engine must not
  touch is exactly what the LLM layer needs.
- **Hypothesis-gather enrichment (B2+B3)** — `gather()` appends (a) a `HETI METRIKA-TÁBLA`
  block: all 31 metrics × last 7 finished days as raw numbers (`–` = no data), so the weekly LLM
  can see thresholds/U-shapes/interactions the pairwise Pearson is blind to; and (b) a
  `KAPU-DIAGNOSZTIKA` block: one line per non-live, non-frozen pair (title + key + verdict +
  aligned/min-n + bottleneck metric) from `PatternMonitorService.monitor()` — the AI can now make
  actionable hypotheses about MISSING data ("ha edzés után workload-ot pontoznál…"). `gather()`
  became package-private for `HypothesisGatherContextIT`.
- **Spec deviations (as-built):** `sourceHu` was NOT added to `MetricKey` (the monitor shipped
  without it and the contract has no such field — no consumer); `medication-dose-mg` derives from the
  dose log (`MedicationDoseEntity.dose`), not the cycle JSON (which holds only phase labels, no
  dose ladder); the driving bd issue's "20 metrics / 32 total" text predates the collector-UI
  audit — the approved count is 19/31 (deep-min dropped: permanently empty without a wearable
  import; V3.5 if that ever lands); the intention "reflection" is categorical (yes|partial|no),
  not free text — the digest renders it as a label, not a quote.

**Proactive-coaching S1 (`mezo-d58h.1`) added 3 more `MetricKey`s (31 → 34)** — extractors in
`MetricSeriesService`, no rule/pair/card consumes them yet (later slices S2–S6 do):

- *Direct:* `shoulder-strain` (day **max** of `sport_session.shoulder_strain`, 1–10; a null strain
  or no session is not a datapoint) — TRAIN domain.
- *Derived (sport-science):* `weight-trend-pct-wk` (7-day rolling least-squares slope of weigh-ins,
  expressed as %/week of the window's mean weight; honest gate — fewer than 4 weigh-ins in the
  trailing 7 days ⇒ no datapoint) — BODY domain. `combined-load-min` (the existing `dailyLoad`
  sport-min + gym-volume/`load-gym-kg-per-min` figure exposed as its OWN calendar series — every
  day in `[from,to]` present, an un-logged day a real `0.0`) — TRAIN domain. `COMBINED_LOAD_MIN` is
  the **second** documented exception to "missing days stay missing" (after `HABITS_DONE`,
  above) — see the `MetricSeriesService` class Javadoc and `FlagEvaluator`'s own Javadoc, which
  both now name it alongside `HABITS_DONE`.

Because `HypothesisPipelineService.gather()`'s `HETI METRIKA-TÁBLA` block and
`PatternMonitorService`'s per-metric coverage both iterate `MetricKey.values()` (§4/§5 above), all
three new metrics already appear in the weekly hypothesis table and the `/pattern/monitor`
coverage response, and widen what the proactive **Diagnózis** report can name as a suspect (§3
"Second consumer since `mezo-hqfi`" above) — with zero code change in those three call sites. The
34-total figure supersedes the "31 since V3.4" statements above, which remain accurate as a
historical snapshot of the V3.4 slice itself.

`MemoryObservatoryService`'s L0 `daysWithAnyData` union is a fourth `MetricKey.values()` consumer,
but a presence-counting one: it needed the `COMBINED_LOAD_MIN` calendar series excluded the same
way `WEEKEND` already was, since a key that is populated for every day by construction is evidence
of the calendar, not of the user having logged anything (CI regression `mezo-d58h.1`, fixed
alongside this doc update). Any future presence-counting consumer over `MetricKey.values()` must
skip both calendar-derived keys for the same reason.

**Memória-obszervatórium (`mezo-al1i`, post-epic) — a 4 memória-réteg read-only pillanatképe.**
`MemoryObservatoryService` (`service/MemoryObservatoryService.java`, companion-switch conditional)
backs 4 new read-only endpoints under `GET /api/companion/memory/*`, consumed by the Insights
**Memória** tab ([`insights.md`](insights.md) §2.9, the 9th sub-tab). **No new table, no
migration** — the service composes existing data:
- **`overview`** — L0 (`daysWithAnyData`/`windowDays`: how many days in the pattern-detection
  lookback window carry data on ANY `MetricKey`, built with the `PatternMonitorService` series-
  cache idiom — one `MetricSeriesService.series()` call per metric via the shared `PatternGate.window`
  helper; **`MetricKey.WEEKEND` is deliberately excluded from the union** — it is a synthetic
  calendar 0/1 that never misses a day, so folding it in would always saturate the count to the
  full window) / L1 (`daily_summary` count + first/last date + embedding counts by kind) / L2
  (pattern `kind`×`status` rollup, computed in plain Java — a user's live pattern set is small
  enough that a `GROUP BY` query would be overkill — plus the pending `learned_fact` candidate
  count) / L3 (confirmed-fact counts by `source`, the sum of `reinforcement_count`, the
  `include_in_prompt` count) / `jobs` (the three raw cron strings — summary/pattern/hypothesis, the
  FE never parses them — plus `lastSummaryDate` and `lastDetectedAt`).
- **`summary`** — the L1 journal: `daily_summary` rows date-desc over an optional `[from,to]`
  (missing bounds fall back to a wide default so there is only ever one query shape), each flagged
  `embedded` (a live `memory_embedding` row of kind `daily_summary` exists for that day).
- **`similar-days`** — the **V2.3 `MemoryRecallService` reused UNCHANGED**: the identical
  embed→ANN→recency-rerank pipeline the `find_similar_past_days` tool uses, so the chat tool and
  this UI surface can never disagree about a memory. Deliberately **NOT `@Transactional`** — the
  embed call is a network call, and no DB connection is held across it, the same reasoning
  `MemoryRecallService` itself documents. The excerpt is the stored narrative capped at
  `recall.render-max-chars` (300), the same cap the tool's own render uses.
- **`llm-usage`** — a new native daily rollup, `LlmLogRepository.aggregatePerDaySince` (+ the
  `LlmDailyAggregate` interface projection) over `llm_log_history` ([ADR
  0014](../decisions/0014-llm-call-audit-log.md)), wrapped by `LlmUsageService.perDay` — a sibling
  of the service's existing `summary()` day/week/month rollup, same calendar-day-in-report-zone
  semantics. Reads the **whole table**, not a user-scoped slice — cron/async-written rows have a
  null `created_by`, and an ownership filter would hide exactly the volume that costs the most (the
  same reasoning `LlmUsageService.summary()` already documents; the app is single-user and the
  endpoint sits behind JWT, so "all rows" IS "my rows"). **`enabled=false`** (the
  `mezo.feature.llm-log.enabled` switch off, detected via `auditEnabled()` — the recorder bean's
  presence IS the switch, no `@Value`) short-circuits **before the query runs** and returns
  `enabled:false` + an empty `perDay` + zeroed `totals` — the FE renders an honest "audit-log ki
  van kapcsolva" card, not an error.

`lastDetectedAt` in the `overview` `jobs` block is `max(lastDetectedAt)` over the user's own
statistical pattern rows — **the exact same "last DETECTION, not last RUN" semantics as
`PatternMonitorService`'s `lastRunAt`** ([`insights.md`](insights.md) §2.8) — it can read
null/stale even though the nightly detection job keeps running on schedule.

**Status per layer:**

| Layer | State | Notes |
|---|---|---|
| Backend (tables + contract + services + sync endpoint) | ✅ V0.2 | Behind `mezo.feature.companion.enabled`; switch off ⇒ the whole HTTP surface 404s. |
| Context snapshot | ✅ V0.3 | `ContextSnapshotAssembler` in every chat turn's system prompt; LLM-free, `nincs adat` absences, `mezo.companion.snapshot.*` windows. |
| LLM adapter | ✅ V0.1 (ADR 0008) | Real `GeminiCompanionLlm` (`gemini-2.5-flash`) / deterministic `FakeCompanionLlm` (`companion-fake` profile, + forced-failure sentinels since V0.4, + `[fake-tool:…]` scripted tool execution since V0.5, + `[fake-briefing:…]` scripted briefing dispatched on `BRIEFING_MARKER_MIRROR` — a literal mirror of `BriefingGenerator.BRIEFING_MARKER`, not an import, to avoid a companion→proactive package cycle — since proactive B1.1; + `[fake-weekly:…]` scripted weekly-suggestion prose dispatched on `WEEKLY_MARKER_MIRROR` (same literal-mirror rule) since proactive W1; + `[fake-memoir:{…}]` scripted memoir JSON dispatched on `MEMOIR_MARKER_MIRROR` (`"HETI-MEMOIR-FELADAT"`, same literal-mirror rule) since proactive W2 (GREEDY since prompt v2 `mezo-uajy` — the `anchors:[{index,note}]` payload nests objects); + `[fake-heartbeat:…]` scripted heartbeat prose dispatched on `HEARTBEAT_MARKER_MIRROR` (`"NAPKOZBENI-JEGYZET-FELADAT"`, same literal-mirror rule) since proactive H1; + `[fake-prediction:{…}]` scripted predictions JSON (GREEDY regex — the payload nests objects) dispatched on `PREDICTION_MARKER_MIRROR` (`"HETI-PREDIKCIO-FELADAT"`) since proactive P1; + `[fake-experiment:{…}]` scripted experiment-proposal JSON (GREEDY) dispatched on `EXPERIMENT_MARKER_MIRROR` (`"N1-KISERLET-FELADAT"`, same literal-mirror rule) since proactive P2; + `[fake-activity:{…}]` scripted activity-classification JSON (GREEDY) dispatched on `ACTIVITY_MARKER_MIRROR` (`"TEVEKENYSEG-BESOROLAS-FELADAT"`, same literal-mirror rule) since gamified growth E2 `mezo-jzca` — the cheap-tier `ActivityClassifier` is a new `CompanionLlm` consumer outside `feature/companion`, see [`growth.md`](growth.md); + `[fake-quest-flavor:[…]]` scripted quest title/why rewrite (GREEDY — a JSON array; default `[]` = no rewrite → catalog copy) dispatched on `QUEST_FLAVOR_MARKER_MIRROR` (`"KULDETES-IZESITES-FELADAT"`, same literal-mirror rule) since gamified growth E3 `mezo-6ng8` — the cheap-tier `QuestFlavor` is a second such outside-`feature/companion` consumer, see [`growth.md`](growth.md)). |
| Streaming (SSE) | ✅ V0.4 | `POST .../message/stream` — `delta`/`done`/`error` events, two-transaction turn, hand-written controller (§9 Decision 11). |
| Tool calling + audit | ✅ V0.5, expanded mezo-xixu | 8 read tools at V0.5, **15 read hub-tools now** (scope-consolidated) over existing services; `RecordingToolCallback` audit + per-turn cap (raised 6→15, mezo-xixu); `tool_calls`/`refs` envelopes persisted; `mezo.companion.tools.*` tunables. |
| Frontend | ✅ V1.2 | ChatPage real since V0.4/V0.5; **KnowledgeListPage real since V1.2** (candidate inbox + persisting toggles + degraded state). **LIVE on k3s since 2026-07-04** — `GEMINI_API_KEY` rides the `mezo-app` SealedSecret, switch on; smoke-verified with a real context-aware Gemini answer. |
| Knowledge facts (L3) | ✅ V1.1 | `knowledge_fact`/`learned_fact` tables + fact CRUD + top-N injection block in every system prompt (`mezo.companion.facts.top-n`). |
| Fact extraction + confirm | ✅ V1.2 | Post-turn async extraction (`mezo.companion.extraction.*`) → `learned_fact` candidates → L2 decision endpoint → promotion (`source=chat`). |
| Advisor chain (never-ask-twice + self-check) | ✅ V1.3, criterion renamed `mezo-q71s` | Clinical regex + LLM verdict (`redundantQuestion`/`unmarkedClaim` — marked speculation allowed since [ADR 0028](../decisions/0028-marked-speculation-in-chat.md)), retry-once → `degraded` flag (`mezo.companion.advisors.*`); reinforcement on extraction dedupe-hit. |
| Vector infra (pgvector + EmbeddingPort) | ✅ V2.1 | `memory_embedding` (`vector(768)`, HNSW, cosine) + `EmbeddingPort` (real Gemini SDK adapter / fake); image `pgvector/pgvector:pg16` in compose + k3s + Testcontainers. |
| Narrative memory (summaries + embed pipeline) | ✅ V2.2 | Nightly `DailySummaryJob` (first cron; catch-up = backfill) → `daily_summary` + embeddings; post-turn `TurnEmbeddingListener` embeds every chat turn; `mezo.companion.summary.*` + `embedding.*` tunables. |
| Canonical dual-write + vector generations | ✅ `mezo-6dii.2` | Every OLD memory write projects AFTER_COMMIT into source-addressable `memory_item` + versioned `memory_vector`; isolated failure preserves OLD. Optional resumable re-embedding builds a target generation without switching serving. |
| Shared chat retrieval rollout | ✅ `mezo-6dii.6` (SHADOW default) | One adapter feeds sync and SSE. `OLD` serves the frozen facts + ambient + graph path; `SHADOW` serves the identical payload and audits unified retrieval asynchronously; `NEW` serves the hybrid `MemoryContext` and falls back to OLD only on an audited total retriever outage. |
| Journal embedding seam | ✅ `mezo-b3pp.1` | `memory_embedding` kind-CHECK widened to 10 (only `journal_entry` populated); `JournalEmbeddingListener` (AFTER_COMMIT, `COMPANION_SWITCH`+journal-switch gated) → `MemoryEmbeddingWriter.writeJournal`/`.deleteJournalEmbedding` (edit = update-in-place, not delete+insert). Full detail: [`journal.md`](journal.md). |
| Decision embedding seam | ✅ `mezo-b3pp.4` | A FOURTH `memory_embedding` kind, `decision`, joins `chat_turn`/`daily_summary`/`journal_entry`; `DecisionEmbeddingListener` (same AFTER_COMMIT/`@Async`, `COMPANION_SWITCH`+journal-switch gated idiom) → `MemoryEmbeddingWriter.writeDecision` — embeds the decision text on create, then **re-embeds the SAME row in place on review** with the outcome folded in (`"…\n\nKimenet (N/5): …"`), because the outcome is the half worth recalling. No delete path (decisions aren't deletable), so no orphaned-vector race to handle. Full detail: [`journal.md`](journal.md). |
| Reflection embedding seam | ✅ `mezo-b3pp.2` | A FIFTH `memory_embedding` kind, `reflection`: the Napzárás evening prose (`ritual_day.reflection_text`, [`ritual.md`](ritual.md) §4). `ReflectionEmbeddingListener` reuses the AFTER_COMMIT/`@Async` idiom but is gated on `COMPANION_SWITCH` + **`RITUAL_SWITCH`** — the first seam whose second switch isn't journal's — and consumes `feature/ritual`'s `RitualClosedEvent` → `MemoryEmbeddingWriter.writeReflection`, embedding **on close** rather than per keystroke-save; a post-close edit re-publishes the event and re-embeds the same `(kind, ref_id)` row in place, and clearing the prose soft-deletes the vector so an erased evening stops being recallable. No migration — `reflection` was already legal in the W1.1 kind CHECK. Full detail: [`ritual.md`](ritual.md) §5. |
| Gratitude embedding seam | ✅ `mezo-b3pp.3` | A SIXTH `memory_embedding` kind, `gratitude`: 1–3 short lines a day from `gratitude_entry` (`feature/journal`, [`journal.md`](journal.md) §5). `GratitudeEmbeddingListener` is the journal-shaped twin of the journal listener (`COMPANION_SWITCH` + `JOURNAL_SWITCH`, AFTER_COMMIT/`@Async`), calling `MemoryEmbeddingWriter.writeGratitude` / `.deleteGratitudeEmbedding` over the shared `upsert`; no edit endpoint, so only the create-then-delete liveness re-check. Short texts embed fine — they carry disproportionate emotional signal (spec §5.3). |
| Note catch-up seam | ✅ `mezo-b3pp.5`, lifecycle `mezo-b3pp.26` | The SEVENTH and EIGHTH kinds, `activity_note`/`checkin_note` — the narrative written OUTSIDE the journal (`activity_log.text`, `check_in.note`). The first seam with **no listener**: the existing nightly `DailySummaryJob` runs `NoteEmbeddingCatchUp` per user (spec §5.5 — one nightly sweep, not a new cron) → `MemoryEmbeddingWriter.syncNote`, lifecycle-aware since `mezo-b3pp.26` (replaces the original insert-only `writeNote`): it compares a candidate's CAPPED text against the live vector's stored content and re-embeds through the revive-capable `upsert` only on a first write or a drift, so an unchanged corpus costs no embed call. No lower date bound, so the first run IS the one-time history backfill and later runs both catch up and heal drift; `NoteEmbeddingCatchUp.embed` also REAPS — before any budget check, every stored ref-id whose source row is gone OR still live but cleared to blank gets its vector soft-deleted via `MemoryEmbeddingWriter.deleteNoteEmbedding` — via `NarrativeNoteSource.liveNotes`. `mezo.companion.embedding.embed-notes` / `note-min-chars` (80) / `note-batch-size` (200, the whole run per user). Sources arrive through the companion-owned `NarrativeNoteSource` port (ArchUnit `feature_slices_are_cycle_free` rejected the direct repository import), injected as an `ObjectProvider` so gating an adapter off later is a real no-op instead of a context-startup failure — `ActivityNoteSourceAdapter` implements it from `feature/activity`, while `CheckInNoteSourceAdapter` stays in `embedding/` here, since `feature/biometrics` has no edge into companion and gaining one would close a new 4-slice cycle. No migration, no FE. Full detail: [`journal.md`](journal.md) §3/§9. |
| Feedback capture on the AI surfaces | ✅ `mezo-b3pp.15` | Phase 5 W4.1 — `message_feedback` + the `/api/companion/feedback` surface (GET batch-read / PUT upsert / DELETE retract), ONE updatable 👍/👎 verdict (optional 👎 reason) per `(user, artifactKind, artifactId)` across FIVE artifact kinds spanning five tables. Rides `COMPANION_SWITCH`, no own switch. FE: one page-level `useFeedback(kind, ids)` + the shared `FeedbackChips`, mounted on chat answers, the Today feed thread, the weekly suggestion, the memoir and predictions. **Feeds the nightly W4.2 rollup layer** (`feedback_rollup`, §5.7a) — the reinforcement layer (graph-node edge weighting) is still deferred to the graph-gate wave (§9). |
| Knowledge-graph promotion pipelines | ✅ `mezo-b3pp.7`, retraction `mezo-b3pp.31`, fact opt-out `mezo-b3pp.30` | Phase 5 W2.2 — confirmed patterns, active AND prompt-included non-pattern-sourced knowledge facts, and goal saves flow into `knowledge_node` via `GraphPromotionService`, idempotent on `(createdBy, sourceKind, sourceId)`; a cheap-LLM `GraphEdgeStructurer` proposes typed edges for newly created nodes only (confidence floor, top-K cap, IDENT-3 degrade to no edges). `GraphPromotionListener` wires it to `PatternConfirmedEvent`/`KnowledgeFactPromotedEvent`/`GoalSavedEvent`/`KnowledgeFactChangedEvent` AFTER_COMMIT + `@Async`, gated on both `COMPANION_SWITCH` and `KNOWLEDGE_GRAPH_SWITCH`. `reconcile(userId)` (the nightly catch-up sweep) exists but is not scheduled until W2.5. **Promotion is two-way (`mezo-b3pp.31`)**: `retractPattern`/`retractGoal`/`retractFact` archive the mirror node when a pattern is un-confirmed, a goal is soft-deleted, or a fact is soft-deleted or opted out of the prompt (`include_in_prompt=false`) — see the W2.2 section below for the event wiring, `syncFact`, and the honest gap that remains around `knowledge_fact` hard/soft deletes. |
| Life-event extraction + confirm inbox | ✅ `mezo-b3pp.8` | Phase 5 W2.3 — `LifeEventExtractionService` turns one day's own words (`journal_entry` + `ritual_day.reflection_text` + `daily_summary`) into 0..N `LIFE_EVENT` **candidate** nodes with edges parked in `meta.proposedEdges`; `LifeEventCandidateService` is the only path from a proposal to durable structure (accept → `active` + real edges at `confidence × 0.5`, reject → soft delete, no residue). Two pre-spend gates: the day already processed (soft-delete-blind probe, so a rejected night never returns) and an empty narrative (no LLM call at all). Nothing schedules it — W2.5's `GraphMaintenanceJob` calls `extractFor(...)` like it calls W2.2's `reconcile(...)`. |
| Graph traversal + [Összefüggések] prompt block | ✅ `mezo-b3pp.9` | Phase 5 W2.4 — every chat turn (both paths) gets a deterministic `[Összefüggések]` block: `GraphTraversalService.seedsFor` matches the folded user-message tokens (`ToolText.searchTokens`, punctuation stripped, ≥3 chars, not a Hungarian stopword, no LLM) against active node titles/summaries at a WORD START (`startsAWordInFolded`, mezo-b3pp.34), ranks matches (title hit, then distinct token hits, ties left to the query's own TOTAL `created_at desc, id` row order) and caps them at `graph.max-seeds` (default 8); `GraphTraversalQuery` (both reads raw JDBC under one savepoint: the seed-candidate read + the recursive CTE — undirected, cycle-safe path array, `graph.max-hops`, weight-desc `graph.top-k`, active + non-deleted + owner-scoped nodes only) returns the neighborhood; `GraphPromptAssembler` renders `- A → kiváltja → B · erős` lines (`PRECEDED_BY` swapped so the line stays cause-first) under `graph.render-max-tokens` between `[Emlékek]` and `TONE_REMINDER` and adds one `GraphNode` ref per rendered node — carrying the traversal's own `fromTitle`/`toTitle` as its `label` (`mezo-b3pp.33`), capped at `graph.max-refs` (default 6) — after the Memory refs. Bean exists only under `COMPANION_SWITCH` ∧ `KNOWLEDGE_GRAPH_SWITCH` (`ChatService` holds it via `ObjectProvider`) — off ⇒ block absent. IDENT-3: failures log + omit, `degraded` untouched, savepoint keeps the turn's transaction alive. |
| Graph maintenance job (decay + reinforcement) | ✅ `mezo-b3pp.10`, retraction sweep `mezo-b3pp.31`, person-extraction phase `mezo-06o0.3` | Phase 5 W2.5 — nightly `GraphMaintenanceJob` (`mezo.companion.graph.cron`, dawn slot, `COMPANION_SWITCH` ∧ `KNOWLEDGE_GRAPH_SWITCH` ∧ its own job switch): per-user, four phase-isolated steps — `GraphMaintenanceService.runMaintenance` (edge weight ×= `decayFactor` daily, edges under `pruneFloor` soft-deleted in the same pass, candidate nodes older than `candidateMaxAgeDays` soft-deleted, fresh same-night `pattern_event` snapshot evidence bumps a promoted pattern's touching edges by `reinforcementBump` capped at 1.0), then W2.2's `GraphPromotionService.reconcile` (now per-row isolated, mezo-b3pp.32 fixed alongside) — **its phase-2 promotion loops now run BOTH directions (`mezo-b3pp.31`)**: the original three promoter loops UPSERT forward from a still-qualifying source row, and a fourth complement-set sweep runs after them, walking every active node back to its source row and archiving any whose source stopped qualifying — the backstop for a retraction missed while the switch was off, and (for the still-untriggered delete half of `retractFact`) the ONLY trigger it gets, since nothing in main source soft-deletes a `knowledge_fact`; the opt-out half reaches `retractFact` on the same turn via `syncFact` (`mezo-b3pp.30`) — then W2.3's `LifeEventExtractionService.extractFor(yesterday)` — then, since **Emberek S4** (`mezo-06o0.3`), `feature/people`'s `PersonExtractionService.extractFor(userId, yesterday)`: gated on its own `COMPANION_SWITCH ∧ PEOPLE_SWITCH` pair (not the job's trio), so it's wired via `ObjectProvider<PersonExtractionService>.getIfAvailable()` — the bean can legitimately be absent. It enriches the day's toneless mentions with `tone`/`intensity`/`contextLabel` and proposes `candidate` persons for unknown names recurring often enough (see [me.md §5.4](me.md)). A failure in any phase for any user never skips the rest. |
| Episodic recall in chat | ✅ V2.3 | `find_similar_past_days` tool + `MemoryRecallService` (similarity × exp(-age/τ), similarity floor, daily-summary scope); `Memory` ref chips; `mezo.companion.recall.*` tunables. |
| Ambient recall in chat (W3.1) | ✅ `mezo-b3pp.12` | `service/PromptMemoryAssembler` — every turn embeds the user message ONCE (`LlmCallContext("companion_recall","recall_embed","conversation",id)`), then runs the kind-group ANN queries through `repository/MemoryEmbeddingAnnQuery` (four here, five since W3.2 added the rungs) (raw JDBC under a savepoint, §9 — NOT a JPA finder): daily_summary · journal family (journal_entry/reflection/gratitude/decision) · chat_turn · notes (activity_note/checkin_note). Per group: the V2.3 `similarity × exp(-age/τ)` re-rank over `recall.candidate-pool` candidates, the stricter ambient floor, today-and-later dates skipped (the snapshot already carries the day), the group's cap of items kept (a cap of 0 skips the query entirely) — **since W3.3 (`mezo-b3pp.14`) the floor, τ and cap are all per kind-group, `ambient-recall.<group>.{min-similarity,decay-days,cap}`**. Survivors dedupe by `(kind, ref_id)`, sort by score and render the **`[Emlékek]`** block (`- <ISO date> (<HU forrás>): <first line, cut at recall.render-max-chars and suffixed with …>`) under `ambient-recall.max-tokens` (≈3 chars/token; the loop STOPS at the first overflowing item — relevance order is never reshuffled). Position: pattern-ack → **[Emlékek]** → **[Összefüggések]** (W2.4) → `TONE_REMINDER`, assembled ONCE for both paths (`ChatService.assembleSystemPrompt`). Every rendered **day** adds one `Memory`/date ref (same-day items collapse; tool refs keep priority under `tools.max-refs-per-turn`) **after** the LLM round. IDENT-3: an embed/ANN failure logs + omits the block; `degraded` stays `false` and the turn's transaction survives. Runtime kill-switch `ambient-recall.enabled`. **W3.1b (`mezo-b3pp.28`) made it visible:** the rendered items are persisted per answer as the `ai_message.recalled_memories` jsonb envelope and returned as `MessageResponse.recalled`, which the chat UI shows as the collapsible „Emlékek · N" disclosure (§2). |
| Consolidation ladder (W3.2) | ✅ `mezo-b3pp.13` | Phase 5 W3.2 — `period_summary` (`week`/`month` rungs, uq `(created_by, granularity, period_start)`) generated by `service/PeriodSummaryService`: pure-code gather (the week's `daily_summary` narratives → the week rung; the month's week rungs → the month rung) + ONE cheap-tier condensation call (`LlmCallContext("companion_consolidation", "weekly"|"monthly", …)`), idempotent per period (an existing rung is returned, the model is NOT called) and honest (no source rows or a blank answer ⇒ no row). `service/ConsolidationJob` (Monday 03:30 weekly + 1st-of-month 03:50 monthly, switch `mezo.techcore.cron.consolidation-job.enabled`) fills and embeds every missing rung of its backfill window per user, so the catch-up doubles as the history backfill; each rung is embedded through `MemoryEmbeddingWriter.writePeriodSummary` as `weekly_summary`/`monthly_summary` at `occurred_on = period_start` (unchanged text short-circuits before the provider call). Recall SHADOWING: `PromptMemoryAssembler` asks for `daily_summary` hits only inside `ambient-recall.weekly-shadow-days` and queries the rung group unfiltered — beyond the cutoff a stretch is remembered through its rung. **Nothing is ever deleted** (spec §12). |
| Recall tuning pass (W3.3) | ✅ `mezo-b3pp.14` | Ambient recall is tuned from yml ALONE: `ambient-recall.<group>.{cap,min-similarity,decay-days}` per kind-group (`daily-summary` · `period-summary` · `journal` · `chat-turn` · `other`; `CompanionProperties.AmbientRecall.Group(cap, minSimilarity, decayDays)`) replaced the flat `cap-*` keys, the single `min-similarity` floor and the τ borrowed from `recall.decay-days` — no ambient-recall TUNING number lives in code any more (the render-side `CHARS_PER_TOKEN = 3` estimate is not a tuning knob). Defaults keep W3.1/W3.2 behaviour except the **journal floor 0.60** (lived-with 2026-08-22: 0.59–0.62 journal hits were noise) and **period rungs τ=180 d** (a rung stands for a whole stretch, so it fades slower than a single day). `AmbientRecallEvalIT` is the regression net — a hand-crafted 20-row axis/blend vector corpus + a `@ParameterizedTest` TABLE of (query → expected gists in prompt order), every entry mutation-verified; `AmbientRecallTuningIT` proves a `@TestPropertySource` override ALONE re-ranks and drops items with no code change. `mezo-b3pp.27` input: `ambient-recall.exclude-current-conversation` (default **true**) makes the chat_turn ANN query skip the conversation being answered (`ref_id not in (select m.id from ai_message m where m.conversation_id = :excludeConversationId)`, composed into `MemoryEmbeddingAnnQuery`'s statement) — this excludes the WHOLE conversation, not just what fits `chat.history-window` (20 messages ≈ 10 turns); beyond the window it is a deliberate trade — a long thread's own early turns drop out of ambient recall, but the thread is still the conversation being answered. The `find_similar_past_days` tool embed is retagged `LlmCallContext("companion_recall","recall_embed","tool",null)` (was `embed_memory`/`query`), so the `/me/ai-usage` `companion_recall` feature row is recall's WHOLE cost share, ambient and tool alike. |
| Statistical patterns + Inbox | ✅ V3.1, monitor `mezo-viqs`, group balance `mezo-0469` | Nightly `PatternDetectionJob` (Pearson + real p-value, LIVE-only persistence, frozen user judgements) → `pattern` table → Inbox API → **PatternsPage real dual-mode**. The shared `PatternGate` also powers the read-only monitor/detail pair DTO: six surface verdicts including `imbalanced_groups`, exact windows, value kinds and group counts, no diagnostic writes ([`insights.md`](insights.md) §2.1/§2.1b). |
| AI hypothesis loop | ✅ V3.2 | Weekly smart-tier propose→critique→revise (`mezo.companion.hypotheses.*`, arch §4.7 scoring); survivors = `ai_hypothesis` Inbox rows with critique + `thinking`. |
| Pattern → fact promotion + reinforcement | ✅ V3.3 | Confirm ⇒ `knowledge_fact` (source=pattern, linked back); same-direction recurrence reinforces; `ÚJ FELISMERÉSEK` ack block; `minta:` evidence chip on the Knowledge tab. **Epic complete.** |
| LLM call audit log (`mezo-2zyu`) | ✅ v1 + read API (`mezo-uakh`) | Every provider call (chat/stream/vision/tool/smart + embeddings + crons) records one append-only `llm_log_history` row with the token breakdown, a frozen price snapshot and caller attribution; async writer, `mezo.feature.llm-log.enabled` (off by default, ON in k8s). **Read side (`mezo-uakh`):** `GET /api/llm-usage/{summary,breakdown,calls,calls/{id}}` (`LlmUsageController`/`LlmUsageService`, ungated + no user filter — endpoint table in [`_platform-api-backend.md`](_platform-api-backend.md) §4c) surfaces the log as the Me **AI-napló** page at `/me/ai-usage` + `/me/ai-usage/:id` ([`me.md`](me.md) §2). [ADR 0014](../decisions/0014-llm-call-audit-log.md). |
| Memory observatory (`mezo-al1i`) | ✅ v1 | `MemoryObservatoryService` — 4 read-only `GET /api/companion/memory/*` reads (overview/summary/similar-days/llm-usage) over EXISTING data (no new table); `similar-days` reuses `MemoryRecallService` (V2.3) verbatim; `llm-usage` is a new `LlmLogRepository` native daily rollup over `llm_log_history` (ADR 0014). Backs the Insights **Memória** tab ([`insights.md`](insights.md) §2.9). |

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
**Tool & context expansion (`mezo-xixu`, post-epic) design of record:**
[`docs/superpowers/specs/2026-07-26-companion-tool-context-expansion-design.md`](../superpowers/specs/2026-07-26-companion-tool-context-expansion-design.md)
(§4 enriched snapshot, §5 the 15 hub-tools, §6 config/registry, §7 tool-selection hardening) —
raised the tool count 8→15, the per-turn budget 6→15, forward-resolved `[Edzés]`, added
`[Növekedés]`/`[Napi gyakorlat]`, and shipped the `[Eszköz-útmutató]` routing hint +
[`companion_tool_conventions.md`](../references/companion_tool_conventions.md) house rule.

**Conversational tone (`mezo-q71s`, post-epic) — the port, the persona and the advisor all became
multi-turn-aware; design of record:**
[`docs/superpowers/specs/2026-08-16-companion-conversational-tone-design.md`](../superpowers/specs/2026-08-16-companion-conversational-tone-design.md),
plan
[`2026-08-16-companion-conversational-tone.md`](../superpowers/plans/2026-08-16-companion-conversational-tone.md),
[ADR 0028](../decisions/0028-marked-speculation-in-chat.md):

- **The `CompanionLlm` port carries the conversation as real prior messages, not a transcript
  glued into the system prompt.** The port's `complete`/`stream` grew a `List<Turn> history`
  parameter (`CompanionLlm.java` — `Role{USER,ASSISTANT}` + `record Turn(role, content)`) as the
  now-ABSTRACT 5-arg method; the old 4-arg two-string shape became a `default` delegating with
  `List.of()` — the 10+ one-shot pipeline callers (meal, recipe, pantry, sleep, habit-suggest,
  scrape, transcription, extraction, summary, verdict) sit on that default, unchanged, and never
  see history. `GeminiCompanionLlm.request` maps `Turn`s onto Spring AI `Message`s
  (`.system(sp).messages(toMessages(history)).user(um)`), verified `[SYSTEM, USER, ASSISTANT,
  USER]`-ordered by `GeminiCompanionLlmPromptOrderTest` (a `Prompt`-capturing `ChatModel` stub —
  no IT can cover this, since the `companion-fake` profile the ITs run under never constructs a
  `GeminiCompanionLlm` bean). `ChatHistory.render(List<Turn>)` (new,
  `feature/companion/ChatHistory.java`) keeps the retired `renderHistory`'s "Daniel: … / Mezo: …"
  text shape alive for the three NON-model consumers that still need a string: the advisor's judge
  payload, the fake LLM's echo, and the llm-audit `conversation_history` column below.
- **`ChatService.SYSTEM_PROMPT` is rebuilt into named blocks** — `[Ki vagy]` · `[Hogyan beszélsz]`
  (new — behavioural tone rules, not adjectives) · `[Mit szabad állítani]` (new — the
  marked-speculation policy, [ADR 0028](../decisions/0028-marked-speculation-in-chat.md)) ·
  `[Példa a hangnemre]` (new — one contrasting "data-terminal vs conversational" answer pair) ·
  `[Tiltás]` · `[Eszközhasználat]` · `[Eszköz-útmutató]` — see §3 "Prompt assembly" below for the
  exact current shape. `Válaszolj magyarul, tömören.` is gone (identified as the single line most
  responsible for the terse, terminal-like tone); a new `ChatService.TONE_REMINDER` (public — the
  advisor's retry re-prompt needs it too) is appended at the very END of the fully assembled
  prompt, after the snapshot/facts/pattern-ack blocks, in both `sendMessage` and `prepareTurn` —
  the recency-weighted counterweight to the persona sitting at the prompt's top.
- **The advisor's `ungroundedClaim` criterion became `unmarkedClaim`** — see §3 "The advisor
  chain" and [ADR 0028](../decisions/0028-marked-speculation-in-chat.md) for the full rationale:
  a linguistically hedged guess ("tippelek", "lehet, hogy") is no longer a violation by itself; an
  invented concrete number still is, hedged or not. `AdvisorViolation.check`'s `"grounding"`
  literal became `"unmarked"`; `AdvisorRetry.block` gained a closing tone-preservation sentence so
  a corrective retry no longer flattens the whole answer a second time.

**Journal embedding seam (`mezo-b3pp.1`, Phase 5 W1.1, post-epic) — a THIRD narrative unit joins
`memory_embedding`, and the first one companion doesn't generate itself.** The new `feature/journal`
domain ([`journal.md`](journal.md)) owns free-prose journal entries; on every commit
(create/update/delete) it publishes `JournalEntrySavedEvent`/`JournalEntryDeletedEvent` — plain
Spring events, no import of `feature/companion` — which the new **`JournalEmbeddingListener`**
(`embedding/JournalEmbeddingListener.java`, the `TurnEmbeddingListener` idiom: `@Async
@TransactionalEventListener(AFTER_COMMIT)`, gated on BOTH `COMPANION_SWITCH` and the journal
feature's own switch, failures logged+swallowed) consumes through two new
`MemoryEmbeddingWriter` methods, **`writeJournal`/`deleteJournalEmbedding`**
(`embedding/MemoryEmbeddingWriter.java:119-137`/`:138-150`) — still the single write path, just a new
`kind=journal_entry`. **Unlike `chat_turn`, journal has no nightly self-heal sweep** (spec §5.5
scopes W1.5's catch-up job to `activity_note`/`checkin_note` only), so the listener handles its own
create-then-edit (insert-race retry-once) and create-then-delete (orphaned-vector cleanup) races
inline instead — see [`journal.md`](journal.md) §3 for the detail. **The one genuinely new wrinkle:
journal edits re-embed IN PLACE, not
delete+insert.** `uq_memory_embedding_kind_ref_id` spans soft-deleted rows (no partial-index
clause), so a soft-delete-then-reinsert on the same `(kind, ref_id)` would violate the unique
constraint; `writeJournal` instead looks up the live row via the new
`MemoryEmbeddingRepository.findByKindAndRefId` and updates its `content`/`embedding`/`occurred_on`
directly when present, falling back to the existing insert-only `write` helper on a first write.
This slice also carries the `memory_embedding` **kind-CHECK widening to 10 values** (§4 above) in
the same migration, landing schema headroom for the rest of the Phase 5 W1 wave
(`reflection`/`gratitude`/`decision`/`monthly_summary`/`activity_note`/`checkin_note` — of which
`journal_entry` alone was written at W1.1; of that batch only `monthly_summary` is still unwritten
today, §4). See [`journal.md`](journal.md) §3/§5/§9 for the full seam,
including the spec-deviation writeup for the update-in-place decision.

**Decision embedding seam (`mezo-b3pp.4`, Phase 5 W1.4, post-epic) — a FOURTH narrative kind joins
`memory_embedding`, reusing the `journal_entry` seam's exact shape.** `feature/journal`'s
`DecisionService` (the decision journal + review loop over the new `decision_entry` table,
[`journal.md`](journal.md) §4/§5) publishes `DecisionEntrySavedEvent` on both create and review; the
new **`DecisionEmbeddingListener`** (`embedding/DecisionEmbeddingListener.java`, the
`JournalEmbeddingListener` idiom verbatim: `@Async @TransactionalEventListener(AFTER_COMMIT)`, gated
on BOTH `COMPANION_SWITCH` and the journal feature's own switch, failures logged+swallowed) reloads
the live decision and calls the new `MemoryEmbeddingWriter.writeDecision`
(`embedding/MemoryEmbeddingWriter.java:150-176`) — `kind=decision`, `KIND_DECISION`. **The rule worth
knowing: a decision embeds twice into the SAME `(kind, ref_id)` row, not once.** On create it embeds
just `decisionText`; once Daniel reviews it (`PUT /api/journal/decision/{id}/review`), the SAME row
is re-embedded in place with the outcome folded into the content
(`decisionText + "

Kimenet (" + outcomeRating + "/5): " + outcomeText`) — because the outcome
("what did I decide, and did it work") is the half of a decision actually worth recalling later, not
the raw decision text alone. This reuses the exact update-in-place mechanics `writeJournal` already
established (`findByKindAndRefId` → update `content`/`embedding`/`occurred_on` when a live row
exists, insert-only `write` on the first call) — **the one genuine difference from `journal_entry` is
that there is no delete path** (the decision surface offers no delete), so
`DecisionEmbeddingListener` carries no orphaned-vector re-check, only the same create-then-fast-review
insert-race retry-once (`DataIntegrityViolationException` on `uq_memory_embedding_kind_ref_id` →
re-read → retry). See [`journal.md`](journal.md) §3/§4/§5/§9 for the full decision-journal seam.

**Reflection embedding seam (`mezo-b3pp.2`, Phase 5 W1.2) — a FIFTH narrative kind, and the first one sourced from outside `feature/journal`.** The Napzárás evening ritual ([`ritual.md`](ritual.md)) gained an optional prose reflection stored on `ritual_day.reflection_text`; `RitualService` publishes **`RitualClosedEvent`** and the new **`ReflectionEmbeddingListener`** (`embedding/ReflectionEmbeddingListener.java`) consumes it into `MemoryEmbeddingWriter.writeReflection` → `kind=reflection`, `ref_id = ritual_day.id`, `occurred_on = ritual_date`. Three things differ from the two journal-sourced seams, and all three are worth knowing:

- **The second switch is `RITUAL_SWITCH`, not `JOURNAL_SWITCH`.** The `@ConditionalOnProperty` array-AND is the same mechanism, but this listener's source domain is ritual — either switch off and the bean does not exist, so no embed call can happen. `RitualApiCompanionOffIT` pins the companion-off half (the close still succeeds, no embeddings written).
- **The trigger is a *lifecycle* event, not a save event.** `journal_entry`/`decision` embed on every write of their unit; the reflection embeds when the **day closes**, and again only if a *closed* day's prose is later edited. `RitualClosedEvent` is published from exactly two sites, both in `RitualService` — the single `closed_at` stamp branch (so a repeat close publishes nothing) and `saveReflection` on an already-closed row. A save *before* the close writes the column and publishes nothing; the close then embeds the final text. That is also why this listener carries **no create-then-fast-edit insert-race retry**: there is no per-keystroke write path to race with, and the FE upholds that end (`ReflectionStep` saves on advance, never a debounced autosave — [`ritual.md`](ritual.md) §9). A lost race would surface as the swallowed warning and heal on the next edit.
- **It has a delete path, but no delete event.** Clearing the prose is an ordinary `saveReflection` with blank text; `writeReflection` sees a null/blank `reflection_text` and **soft-deletes** the existing vector rather than embedding an empty string — the `deleteJournalEmbedding` idiom reached through the same write call instead of a second listener method (IDENT-3: an erased evening must stop being recallable).

Like `journal_entry` and `decision`, the event is published **inside** the writing transaction and the AFTER_COMMIT phase is the consumer's obligation (the `RitualClosedEvent` javadoc says so explicitly), the listener re-reads its row **by id** so a close plus a fast follow-up edit both embed the latest prose, and failures are logged and swallowed. The cross-feature edge is `companion → ritual`, the same direction the journal seams run — `feature/ritual` imports nothing from companion. This slice also **folded the three duplicated re-embed blocks into one private `MemoryEmbeddingWriter.upsert(createdBy, kind, refId, content, occurredOn)`**: `writeJournal`, `writeDecision` and `writeReflection` are now one-liners over it, so the update-in-place mechanics (lookup → refresh `content`/`embedding`/`occurred_on`, else insert via `write`) exist once. Write-once kinds (`chat_turn`, `daily_summary`) still call `write` directly — going through `upsert` would buy them a pointless lookup. **Reflection is also the first kind that can be cleared and then written again on the same `ref_id`** (blank ⇒ soft-delete, later prose ⇒ re-publish), and since `uq_memory_embedding_kind_ref_id` is a plain (non-partial) unique index the dead row keeps that slot — so `upsert`'s lookup is the **native** `findByKindAndRefIdIncludingDeleted` and its found branch clears `is_deleted`, REVIVING the row instead of inserting a colliding one whose failure both listeners would swallow ([journal.md §9](journal.md)).

**The reverse read, and why it's a port, not a direct import ([ADR 0029](../decisions/0029-invert-journal-companion-decision-context-port.md)).**
`DecisionService.create` also needs something FROM the companion — the rendered context-snapshot
text frozen into `decision_entry.context_snapshot` (`journal.md` §4). A direct
`ContextSnapshotAssembler` import from `feature/journal` would have closed a `journal ↔ companion`
cycle (companion already imports journal for the two listeners above), which
`ArchitectureTest.feature_slices_are_cycle_free` — a `FreezingArchRule` that treats any NEW cycle as
a build failure, not something to freeze — caught during the branch review that shipped W1.4. Fixed
with the ADR 0012 consumer-owned-port idiom: `feature/journal/service/DecisionContextPort` (owned by
journal) is implemented by `feature/companion/service/DecisionContextAssemblerAdapter`
(`@ConditionalOnProperty(COMPANION_SWITCH)`, a one-line delegation to `ContextSnapshotAssembler#render`),
consumed by `DecisionService` via `ObjectProvider<DecisionContextPort>`. The cross-feature edge this
creates is `companion → journal` — the SAME direction the rest of the seam already runs — so the
architecture stays acyclic with no frozen exception.

## 2. User-facing behavior

The ChatPage under Insights (`/insights/chat`, [`insights.md`](insights.md) §2.5) is the real
companion surface since V0.4, dual-mode:

- **One header, not two (`mezo-oq8z`)** — `/mezo/chat` suppresses the generic shell
  `AppHeader` and keeps the page's orb-led conversation header as the only top bar. Its
  back/thread-picker/new/actions controls remain available and the row sticks at `top: 0`;
  the tab bar remains visible and only the quick-log FAB stays suppressed as before.
- **Real mode** (default `pnpm dev`, backend on :8090): the page bootstraps the **selected
  conversation + its full history** on load (header: `Mezo · társ` / `Gemini · élő`). Sending a
  message renders the user bubble immediately, thinking-dots until the first chunk, then the
  answer **streams in incrementally** (SSE `delta`s into a draft bubble); on the terminal `done`
  the persisted pair replaces the optimistic overlay. A first-ever message auto-creates the
  conversation. A stream failure shows an honest inline error bubble (`Nem sikerült válaszolni —
  próbáld újra.`) and refetches history (the user message survived server-side). History
  persists across reloads.
- **Many conversations, not one endless thread (`mezo-at8x.3`)** — the multi-conversation spine
  has existed server-side since V0.2, but the FE only ever loaded `conversations[0]`. The page now
  carries its selection in the URL (`?c=<uuid>` · `?c=new` · absent = newest), lists the persisted
  conversations (server-side auto-title = first user message, truncated) in a picker sheet, and
  starts new ones. A `?c=new` draft is **lazily created**: `POST /conversation` only fires on the
  first send, so an abandoned "Új beszélgetés" leaves no empty row behind. UI detail in
  [`insights.md`](insights.md) §2.5.
- **Voice input (`mezo-at8x.4`)** — the composer's mic records via `getUserMedia`/`MediaRecorder`,
  converts to 16 kHz mono WAV client-side, and `POST`s it to `/api/companion/transcribe`; the
  transcript is **placed in the input, never auto-sent**. Server-side transcription is a deliberate
  platform call: the browser Web Speech API is absent or unreliable in exactly this app's habitat
  (iOS Safari + installed PWA), while `MediaRecorder` works everywhere. Nothing is persisted on
  either side — no audio row, no message row; the clip lives only for the one model call.
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
- **„Emlékek · N" — the recall disclosure (W3.1b, `mezo-b3pp.28`; shared rollout
  `mezo-6dii.6`)** — an assistant bubble whose answer was written with recalled context in its
  prompt carries a small **collapsed** row under the
  card (above the 👍/👎 chips): the eyebrow „Emlékek · N" plus a chevron (tooltip: „Ezekre
  emlékezett a társ a válasz előtt (W3.1 ambient recall)"). Tapping it expands one line per
  recalled memory — `<YYYY-MM-DD> · <forrás> · <NN>%` with the injected one-line gist under it, in
  **prompt order**. What it is NOT: it is not the answer, and not a citation list the model chose —
  it is the answer's **provenance**, the raw material ambient recall put in front of the model
  before it wrote anything (the model may well have ignored all of it). For an OLD/SHADOW row the
  percentage remains raw cosine similarity; for a NEW row it is the normalized final hybrid score.
  Neither is confidence in the answer. NEW rows additionally carry stable audit run/result IDs,
  the canonical memory ID when one exists, and a selection indicator. Timeless fact/graph context
  has no event date. A turn that recalled
  nothing — and every user bubble, and every pre-W3.1b answer — renders **no row at all**, not an
  empty one. Both modes show it (mock seeds two items on the first assistant message, one on the
  canned reply); refs collapse a day into one chip, the disclosure lists every episode.
- **The disclosure is also the beta memory-control surface (`mezo-6dii.7`).** Cards backed by a
  stable retrieval run/result show their source, date and selection indicator plus `Hasznos`,
  `Nem ide tartozik` and `Ne használd többé` actions. The first two are idempotent judgements; the
  destructive action is offered only for a canonical `memoryItemId`, requires a second confirmation
  tap and then marks the card unavailable with
  `Nem lesz többé használva`. A successful suppression emits a toast. Legacy OLD/SHADOW cards
  without stable IDs remain readable and expandable but deliberately show no action buttons.
- **The `Memory` chip is deduped against the disclosure, per-day (`mezo-b3pp.29`)** — the
  sibling „Hivatkozott · L3" ref row is no longer unconditionally independent of the „Emlékek · N"
  disclosure above: `ChatMessage.tsx` drops a `Memory`-kind ref **only when its id (a day string)
  is actually present among the `recalled` items' `occurredOn` dates**, because for that day
  `RecalledMemoriesRow` shows the very same memory with source and gist — a bare `[Memory]` date
  chip beside it would be pure duplication. A kind-only filter (dedupe whenever `recalled` is
  non-empty at all) is unsound: two independent backend paths emit `Memory` refs, and only ambient
  recall's feeds `recalled` — the `find_similar_past_days` tool's `Memory` refs never do, so a
  kind-only filter would hide the very day a tool-driven answer was built from whenever ambient
  recall (always-on) also fired that turn. Matching by day fixes that while still fully subsuming
  the old behaviour: with no `recalled` list the day-set is empty, so nothing is filtered and every
  `Memory` chip stays — it is then the answer's only provenance for the recall, so filtering it
  would destroy information rather than dedupe it. The footer's visibility guard is unchanged —
  `visibleRefs.length > 0`, not `m.refs`'s truthiness — because an empty array is truthy in JS:
  `refs: []` used to render a bare „Hivatkozott · L3" eyebrow over nothing, and the filter can put a
  normal, non-empty-`refs` message into exactly that state (all its refs were same-day `Memory`,
  all filtered). Pinned by four `ChatPage.test.tsx` cases: *hides the Memory chips when the answer
  carries a recalled list, but keeps the Emlékek row and the other chips*, *keeps the Memory chips
  when the answer has no recalled list — the chip is the only provenance*, *keeps a Memory chip
  whose day the Emlékek row does not carry*, and *hides the whole refs footer when filtering leaves
  nothing (latent empty-array-is-truthy bug)*. Out of scope, seen and deliberately deferred to
  `mezo-d20.12`: the eyebrow's own „· L3" label is arguably wrong (every chip it labels today is an
  L0/L1 ref, never an L3 fact), but the string is pinned as prototype copy in three Design 2.0
  documents, so it is not touched here.
- **Mock mode** (`VITE_USE_MOCK=true`): the Phase-1 demo — seeded `initialChat`, the canned
  1.2s `cannedReply` (branches on `"fáradt"`), subtitle `demo beszélgetés`. The V0.4 rewrite
  removed the fake `"23 facts active · Gemini 3.1 Pro"` line and the `"L4 aktív"` chip — the
  header is honest in both modes.

## 3. Architecture & data flow

**Shared-memory dual-write (`mezo-6dii.2`; OLD still serves):**

```text
source event/job → MemoryEmbeddingWriter transaction
  ├─ embed once → write/update/delete memory_embedding (OLD)
  └─ publish MemoryProjectionEvent
       AFTER_COMMIT → MemoryProjectionListener
         → MemoryProjectionWriter (REQUIRES_NEW)
           ├─ upsert/suppress memory_item by owner + source kind + source id
           └─ create/update/soft-delete the configured memory_vector generation

optional MemoryReembeddingJob
  → UserFanOut(active + onboarded users)
  → MemoryReembeddingService
    → lock bounded target-version candidates with FOR UPDATE SKIP LOCKED
    → pending → one document-embedding batch → ready | failed
```

The commit boundary is load-bearing: canonical projection is synchronous after OLD commits, but in
a separate transaction. It can therefore reuse the vector already paid for by OLD while a failure
only leaves a repairable projection gap. Re-offering an unchanged OLD row also republishes the event,
which heals a previously missed canonical row without another provider call. The re-embedding path
selects a named target version and never mutates `servingEmbeddingVersion`.

**Adaptive memory-query preparation (`mezo-6dii.3`; consumed by shared retrieval):**

```text
MemoryRequest
  → MemoryQueryAnalyzer (deterministic)
      ├─ NO_MEMORY_NEEDED → raw query retained; no LLM
      ├─ SELF_CONTAINED   → raw query retained; optional ISO date bounds
      └─ CONTEXT_DEPENDENT
           → latest 6 nonblank turns × max 500 chars
           → LlmMemoryQueryRewriter (cheap CompanionLlm)
           → standalone dense query | raw-query fallback
  → PreparedMemoryQuery(mode, rawQuery, denseQuery, from, to)
```

The analyzer, not the model, decides whether rewriting is warranted. This keeps greetings and
self-contained questions free of rewrite latency/cost, bounds conversational prompt exposure, and
makes failure behavior deterministic. The four-value `ConsumerPolicy` is already part of the core
request contract; later tasks apply its retrieval/ranking differences.

**Shared hybrid candidate retrieval (`mezo-6dii.4`; SHADOW by default, NEW-capable):**

```text
RetrievalInput(request, prepared query, serving embedding version, per-retriever limit)
  ├─ dense   → query embedding → memory_vector ⟕ active memory_item
  ├─ lexical → folded raw query → memory_item FTS + trigram score
  ├─ facts   → pinned ∪ query-matching knowledge_fact (+ valid conflict counterpart)
  └─ graph   → deterministic seed nodes → bounded GraphTraversalService neighborhood
       ↓
  provenance-rich MemoryCandidate lists (no fusion/selection/rendering in this slice)
```

Dense and lexical retrieval enforce owner, soft-delete, active state, validity and `asOf` in their
SQL, exclude the current conversation's own `chat_turn` rows, and apply their limit before mapping.
Dense additionally requires a ready, live, content-hash-current vector in the requested serving
generation. Fact retrieval respects `include_in_prompt` as the user's global injection opt-out,
excludes future/expired/superseded rows, and applies its limit to ranked seeds before expanding
each selected conflict to both still-valid owned sides; both sides carry the conflict flag. Graph
retrieval adds `asOf`-aware seed/neighborhood overloads to the existing traversal, excludes
future-dated nodes, keeps the configured hop/top-K bounds, and maps each edge under its stable ID.
All three new JDBC queries use the existing same-connection savepoint pattern and deliberately
rethrow failures; per-retriever catch/timeout/audit belongs to the Task-5 coordinator, so a genuine
empty result cannot be mistaken for an outage.

**Shared memory context orchestration (`mezo-6dii.5`; chat-integrated by `mezo-6dii.6`):**

```text
MemoryRequest → prepare query
  ├─ NO_MEMORY_NEEDED → REQUIRES_NEW empty audit (no provider/retriever work)
  └─ dense + lexical + facts + graph on applicationTaskExecutor
       → independent timeout/cancellation/error trace
       → weighted RRF + bounded explainable modifiers
       → exact-budget selection → optional uncertainty rerank → reselect
       → REQUIRES_NEW run/result audit
       → MemoryContext(items + rendered block + refs + traceId)
```

Fusion uses `(candidateKind, stableId)` identity and deterministic `finalScore desc → occurredOn
desc → stableId` ordering. The selector and renderer share the same line-length calculation, so an
`old`/`summary`/`conflict` marker can never make a selected item disappear at the prompt boundary.
Every successful or degraded execution is therefore attributable by trace ID, including raw versus
rewritten query, serving generation, retriever duration/count/error details, rank sources, selected
IDs and all score components. When every retriever fails the service returns an audited empty
context instead of failing the caller. The chat-serving variant converts this audited total outage
into an OLD fallback signal; partial failures still serve every successful retriever's context.

**Chat rollout boundary (`mezo-6dii.6`):**

```text
sync send / SSE prepare → load the same bounded history → ChatMemoryContextAdapter
  OLD    → confirmed facts + PromptMemoryAssembler + GraphPromptAssembler
  SHADOW → return the exact OLD payload; immutable MemoryRequest runs asynchronously → audit only
  NEW    → MemoryContextService.retrieveForServing
             ├─ success/partial failure → one [Hosszú távú memória] block + refs + stable IDs
             └─ audited total outage   → exact OLD fallback
       ↓
one ChatMemoryPayload → identical prompt ordering and recalled_memories persistence in both paths
```

`mezo.companion.memory-platform.serving-mode` is environment-overridable and defaults to
`SHADOW`, so beta traffic creates realistic comparison/audit data without changing answers.
`NEW` never appends the legacy fact/ambient/graph blocks beside the unified block, preventing
duplicate evidence. Pattern acknowledgement, character/profile context and tone retain their old
positions. The opening turn has no user query and intentionally keeps the legacy confirmed-fact
block rather than manufacturing a retrieval request.

**Retrieval-feedback path (`mezo-6dii.7`):**

```text
ChatPage → one useMemoryRetrievalFeedback(resultIds) batch GET
  → RecalledMemoriesRow reads per-result state and sends an optimistic PUT
      useful / irrelevant → upsert memory_retrieval_feedback
      suppress           → validate canonical memory_item → state=suppressed → upsert feedback
  → later hybrid retrieval SQL admits active items only
```

Both endpoints resolve ownership from `CurrentUserId`. The write pessimistically locks the exact
owned, selected `(runId,resultId)` pair before touching feedback or canonical state; a foreign
result, mismatched run and undisclosed candidate are therefore the same 404, while simultaneous
first writes serialize into one row. The feedback row and suppression transition share one
transaction. Suppression is terminal through this endpoint: a later useful/irrelevant action is
rejected instead of silently leaving a contradictory suppressed item. No learning event or
rank-weight mutation is emitted in this slice: `.8` owns using the accumulated labels for
evaluation/tuning.

**The streamed turn (V0.4 + V0.5 tools — what the FE uses):**

```
ChatPage (send) → useChatActions.sendReal → chatApi.streamMessage        (fetch + ReadableStream)
POST /api/companion/conversation/{id}/message/stream   (text/event-stream)
  → CompanionStreamController.streamMessage    controller/CompanionStreamController.java:38
      HAND-WRITTEN (§9 Decision 11) — @Valid + mapping live here, not on a generated interface
  → ChatStreamService.streamMessage            service/ChatStreamService.java:59
      1. chatService.prepareTurn(userId, id, req)     ── TX #1: getOwned (404 BEFORE the stream),
         prompt = voice + snapshot + facts + pattern-ack + [Rólad tanultam] (W4.3) + [Emlékek]
         (W3.1) + [Összefüggések] (W2.4) + TONE_REMINDER
         (mezo-q71s: history is NOT in here — loadWindow()'s Turns ride PreparedTurn.history
         separately) — the SAME private assembleSystemPrompt(userId, today, memoriesBlock, graphBlock) helper
         the sync path uses, with ONE LocalDate.now() per turn shared by the snapshot and the
         recall; persist USER row, title-once + lastMessageAt. The recalled Memory refs ride
         PreparedTurn.recalledRefs to step 5 — and since W3.1b (mezo-b3pp.28) so do the RENDERED
         ITEMS, in prompt order: PreparedTurn.recalled = RecalledMemoriesEnvelope.ofOrNull(
         recalled.items()), null when the turn recalled nothing. Only TX #1 ever runs the recall,
         so anything TX #2 must persist has to travel on the PreparedTurn
      2. audit = toolRegistry.newTurnAudit()          ── V0.5: per-turn budget + call/ref collector
         toolSink = Sinks.many().unicast().onBackpressureBuffer(); audit.onCall(call ->
         toolSink.tryEmitNext(toolEvent(call)))       ── mezo-280: registered BEFORE step 3, because
         some CompanionLlm implementations run the tool loop while the Flux is being ASSEMBLED —
         i.e. before anything subscribes; the buffering sink replays those pre-subscription calls
         once merged in
      3. companionLlm.stream(prompt, history, content, ── NO TX: Spring AI runs the tool loop
             toolRegistry.callbacks(audit),                internally — each RecordingToolCallback
             toolRegistry.toolContext(userId, audit))       records {name,args} + tools add refs,
                                                              firing audit's onCall listener → toolSink
         each text chunk → event:delta, data: StreamDelta{text} (JSON); Flux.merge(toolSink.asFlux(),
         deltas) interleaves 0..n event:tool, data: StreamToolCall{type,name} (JSON — the SAME
         pre-baked "name(args)" label as the done row's chip, bare name when args are blank) with the
         0..n deltas — progress only, the done row's tools[] stays authoritative. doFinally (NOT
         doOnComplete) completes toolSink when the delta Flux terminates, so a client disconnect
         can't leave the merge waiting on an orphaned sink; any LATER call (an advisor corrective
         round, step 4) emits into an already-completed sink and is silently dropped from the live
         stream — it still lands in the done row
      4. advisorChain.review(prompt, content, answer, …)   ── V1.3 (NO TX, bean present only when
         mezo.companion.advisors.enabled): clinical regex → LLM verdict; violation → ONE
         corrective re-prompt (AdvisorRetry.block appended; same tools+audit) → re-check;
         still violating ⇒ degraded=true. The done row carries the FINAL (possibly retried) text.
      4b. turn.recalledRefs().forEach(audit::addRef)   ── W3.1: the ambient Memory refs join the
         audit AFTER the tool loop AND the advisor review, immediately before step 5 — the tool
         refs are the answer's own provenance and win the tools.max-refs-per-turn cap (first-wins)
      4c. blank-answer guard (mezo-8z79) ── a null/blank finalAnswer NEVER reaches step 5: the
         turn terminates with event:error, code=COMPANION_EMPTY_ANSWER and no assistant row, the
         same "partial answers are never persisted" rule the mid-stream failure path follows
      5. chatService.completeTurn(userId, id, answer, audit, degraded, turn.recalled()) ── TX #2:
         persist ASSISTANT row WITH tool_calls/refs/recalled_memories envelopes + degraded →
         terminal event:done, data: MessageResponse
         (tools[] = "name(args)" chips, refs[] = tool-contributed data refs + the W3.1 Memory/date
         refs, recalled[] = the W3.1b disclosure — CompanionMapper.toRecalled over the row's
         recalled_memories envelope, [] when null, degraded flag)
      onError ⇒ event:error, data: StreamError{code:"COMPANION_STREAM_FAILED"} — NO assistant row
  → FE: deltas AND tool events append into the optimistic draft bubble (chips render live through
    ToolChipRow — mezo-280); done → the persisted pair is written into the ['chat'] query cache (no
    refetch), discarding the draft — chips included — wholesale, and the authoritative chips/refs
    render; error → inline error bubble + invalidate
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
  → ChatService.sendMessage(userId, id, req)   service/ChatService.java:184
      1. conversationService.getOwned(userId, id)          → 404 RESOURCE_NOT_FOUND if missing/foreign
      2. today = LocalDate.now()                     ── W3.1: ONE clock read per turn, shared by
                                                         the snapshot and the ambient recall
         recalled = promptMemoryAssembler.recall(userId, id, req.content, today)   ── W3.1 ──
         graph = graphContext(userId, req.content)   ── W2.4: GraphPromptAssembler.GraphContext,
                 EMPTY when the switch is off (no bean, ObjectProvider) or nothing matched ──
         systemPrompt = assembleSystemPrompt(userId, today, recalled.block(), graph.block())  ── the
                        ONE private helper both paths call (mezo-b3pp.12/mezo-b3pp.9); it returns:
                        SYSTEM_PROMPT (incl. the V0.5 tool-usage line)
                      + contextSnapshotAssembler.render(userId, today)             ── V0.3 ──
                      + knowledgeFactService.renderPromptBlock(userId)              ── V1.1 ──
                      + knowledgeFactService.renderNewPatternFactsBlock(userId)     ── V3.3 ──
                      + profileBlock(userId)  ── W4.3: the [Rólad tanultam] block ("" when the
                        profile is archived/absent or the graph switch is off) ──
                      + memoriesBlock  ── W3.1: the [Emlékek] block ("" when nothing was recalled) ──
                      + graphBlock  ── W2.4: the [Összefüggések] block ("" when the graph switch is
                        off or nothing matched) ──
                      + TONE_REMINDER                                              ── mezo-q71s ──
         history = toTurns(loadWindow(userId, id))    ── mezo-q71s: List<Turn>, travels SEPARATELY
                                                          from systemPrompt (not rendered into it)
      3. persist the USER row (saveAndFlush → distinct created_at)
      4. audit = toolRegistry.newTurnAudit(); answer = advisorChain.complete(...)   ── V1.3 ──
         when the advisors switch is on (ObjectProvider): attempt + review + retry inside the
         chain; falls back to the direct companionLlm.complete(...) call when off     ── PORT ──►
         (real: GeminiCompanionLlm → Gemini tool loop · tests: FakeCompanionLlm echoes
          system/history/user (mezo-q71s) + executes [fake-tool:…] sentinels through the REAL
          callbacks + answers verdict calls via the [fake-violate…] sentinels)
      4b. recalled.refs().forEach(audit::addRef)     ── W3.1: the ambient Memory refs join the audit
          AFTER the LLM round, so the tool refs (the answer's own provenance) take the
          tools.max-refs-per-turn cap first — the streamed twin does the same before completeTurn
      4c. RecalledMemoriesEnvelope.ofOrNull(recalled.items())  ── W3.1b (mezo-b3pp.28): the answer
          also DISCLOSES what it was given — the SAME rendered items, in prompt order, each gist
          byte-identical to the [Emlékek] line the model read (both go through oneLine at
          recall.render-max-chars). Refs collapse a day into one Memory/date ref; the items do NOT
          (a dense day is two lines in the prompt and two lines in the disclosure). Also carries
          refId, which the wire deliberately does not
      5. persist the ASSISTANT row with audit.toToolCallsEnvelope()/toRefsEnvelope() + the W3.1b
         recalled_memories envelope + degraded
         (tool_calls stays null when no tool ran — the V0.2 steady state is unchanged; refs is null
          only when NEITHER a tool nor the ambient recall contributed one; recalled_memories is null
          whenever the recall produced nothing — an omitted block and a failed recall look the same
          on the row, and every pre-W3.1b row is already null)
      6. touchConversation → lastMessageAt = now; title = first user msg (once)
      6b. publish ChatTurnCompleted ── V1.2: AFTER_COMMIT → @Async FactExtractionListener
          → FactExtractionService.extractFromTurn (cheap-tier LLM, JSON parse, dedupe, cap)
          → undecided learned_fact candidates (the streamed path publishes in completeTurn)
  → CompanionMapper.toMessageResponse(assistant)   mapper/CompanionMapper.java:30
      (null envelope → []; envelope entry {type,name,args} → wire MessageTool{type, "name(args)"};
       W3.1b toRecalled drops refId and keeps {occurredOn,kind,label,gist,similarity} — the SAME
       mapper serves GET /messages, so a reloaded history re-renders the disclosure unchanged)
```

**The tool pipeline (V0.5, expanded to 15 tools at mezo-xixu).** `CompanionToolRegistry`
(`tools/CompanionToolRegistry.java`) is the ONLY assembly point: it builds the 15 callbacks from
the 9 domain toolsets (`TrainTools`/`BiometricsTools`/`FuelTools`/`GoalTools`/`MedicationTools`/
`MemoryTools` — the V0.5–V2.3 batch — plus the mezo-xixu trio `GrowthTools`/`PracticeTools`/
`InsightsTools`) via `ToolCallbacks.from`
and wraps each in `RecordingToolCallback` (`tools/RecordingToolCallback.java`) bound to the turn's
`ToolCallAudit` (`tools/ToolCallAudit.java`). The decorator records `{type:'read', name, args}`
BEFORE delegating (a tool cannot forget its audit), soft-fails past
`mezo.companion.tools.max-calls-per-turn` with honest in-band text, and converts a tool exception
into an honest error result (one broken read never kills a streamed turn). **Since mezo-280,**
`ToolCallAudit` also carries one optional, `volatile`, fail-safe progress listener —
`onCall(Consumer<ToolCall>)`, invoked from `recordCall` inside a try/catch so a broken listener can
never fail a turn. `ChatStreamService` registers one to turn each recorded call into the live
`tool` SSE event described above; the sync `ChatService.sendMessage` path registers none, so it is
unaffected. Spring AI executes a turn's tool calls sequentially, so the listener needs no extra
synchronization on top of the audit's own. Tools receive the
Spring AI `ToolContext` carrying `userId` (ownership scoping is structural — model args are never
trusted for identity, `tools/ToolContexts.java`) and the audit (for `addRef(kind, id)` — deduped,
capped at `max-refs-per-turn`). Results are compact deterministic Hungarian text with `nincs adat`
absences and config-clamped windows (`max-window-days`, `max-trend-weeks`) — token budget by
construction. Window args are model-optional (`@ToolParam(required = false)`) with in-code
defaults (7 days / 4 weeks).

**The context snapshot (V0.3).** `ContextSnapshotAssembler.render(userId, today)`
(`service/ContextSnapshotAssembler.java`) returns the `AKTUÁLIS ÁLLAPOT` block with eight lines in
render() order — `[Profil]` (biometric profile + the latest actual weigh-in beside the
`WeightTrendService` EWMA trend — `WeightLogRepository.findFirstByCreatedByAndDeletedFalseOrderByDateDescCreatedAtDesc`
renders `mérés: {weight} kg ({date})`, or `mérés: nincs adat` with no weigh-in row; an empty
EWMA series renders `súlytrend: nincs adat`, and rates are omitted while `dataSufficiency = NONE`
— a zero trend would be a fabricated number), `[Cél]` (active goal, derived current week
`DAYS(startDate→today)/7+1`, the prescription segment whose `fromWeek..toWeek` contains it, the
goal's `mealsPerDay`, and the day's `ébredés`/`lefekvés` anchor resolved via `SleepAnchorPort`
from the sleep goal — never the retired goal wake/bed columns; the resolver always returns an
anchor, so both lines always render, falling back to the config ghost when no sleep goal exists),
`[Edzés]` (active meso with the week
DERIVED from `startDate` — the stored `currentWeek` can lag; **`Ma:`/`Holnap:` dated resolution
(mezo-xixu, the flagship fix)** — both render through ONE `dayLine` method (mezo-ajp): that day's
gym day + exercises via `WorkoutService.findPlannedTemplateForDate` (deliberately never
`WorkoutService.getToday`, which is write-transactional) or an honest `pihenőnap (gym)` — since
mezo-650a a present-but-EMPTY template (the meso wizard's explicit `Rest` rows, zero exercises)
also renders `pihenőnap (gym)`, and since mezo-4qu that criterion is not merely "the same as"
`TrainTools#dayContentLine` but literally the same code (`ToolText.gymLine`) — PLUS any
recurring sport-schedule slot on that weekday, PLUS the active running block's prescribed session
for that weekday (best-effort — absent block/week renders nothing, never fabricated). They used to
be two near-identical renderers that had drifted: `Ma:` resolved gym only, so today's sport and run
were invisible and the model had to re-derive them from the trailing weekly `sport-rend` pattern —
the very hallucination path this dated resolution exists to remove. The recurring
`gym-rend`/`sport-rend` strings + last-N-days gym/sport/run digest stay as TRAILING
background context, no longer the only forward signal. **`Ma (terv):` is labelled a PLAN and is
followed by `Ma eddig naplózva: gym: …; sport: N alkalom; futás: N alkalom` (mezo-xrhd)** — the
plan line alone had no completion state at all, so the companion-feed midday note read the planned
exercise list back as history ("a reggeli edzéseden már túl vagy") on a day with nothing logged.
Gym uses the same completed-instance signal as the habit metric `training_done_today`
(`WorkoutSessionRepository.findDoneInstanceDates(userId, today, today)`); sport/run count today's
own logs. The `WINDOW_PROMPT` carries the matching rule: the `Ma (terv)` line may never be narrated
as fact unless `Ma eddig naplózva` or a tool answer confirms it), `[Növekedés]` (`GamificationService.getProfile` account level/XP/coins/
streak, `ProgressionService.getProfile`'s top-3 skills by level with real XP — 0-XP taxonomy
ghosts filtered out, else `nincs adat` — and `GrowthWeekService.growthWeek`'s weekly LIFE-XP +
quest-closed rollup, an honest zero), `[Napi gyakorlat]` (today's quest completion count via the
`TodayQuestSource` port — a companion-owned interface implemented by `quest/service/
TodayQuestAdapter`, kept one-directional because `quest` already depends on `companion`
(`QuestFlavor`'s `CompanionLlm` use) so a direct import would cycle; deliberately bypasses
`QuestService.getDay`, which is write-transactional (lazy-generates + awards XP) and would violate
the assembler's read-only contract on every chat turn; `HabitService.summary`'s perfect-chain-day
counts; `IntentionService
.getDay`'s creed/today's foci/evening reflection (the reflection value HU-mapped —
`yes/partial/no` → `igen/részben/nem` — never the raw English enum leaking into the prompt), each
`nincs adat` on absence; and whether today's napzárás is closed via `RitualService.getDay`).
`GamificationService`/`HabitService`/`IntentionService`/`RitualService` each carry their OWN
feature switch independent of `COMPANION_SWITCH`, so the assembler reaches all four through
`ObjectProvider<T>.getIfAvailable()` (the `TodayQuestSource` precedent) — switch off ⇒ that
block's affected part renders `nincs adat` instead of failing Spring context startup. `[Mai üzemanyag]`
(`FuelDayService.getDay` consumed/targets incl. water +
active protocol + today's intake count), `[Gyógyszer]` (`MedicationCycleService.derive` cycleDay +
phase; no active medication — since `mezo-lwmq` the standing state — renders `nincs adat`; an
active med with no dose would render `nincs rögzített dózis` — honest zero either way), and
`[Regeneráció]` (latest sleep + latest check-in, note truncated to
`snapshot.checkin-note-max-chars`; **a check-in older than `today` renders `check-in: MA MÉG NINCS
(utolsó: {date} {slot} — energia x/10, stressz y/10)`, mezo-xrhd** — it used to render the latest
row ever, dated but with no today-status, so "no check-in today" was something the model had to
derive from the date and silently didn't; no check-in row at all still renders `nincs adat`). Every lookup uses `Optional`/status-filtered repo finders —
the assembler NEVER throws for missing data.

**The workout closing note in the snapshot (`mezo-d20.13`).** The `[Edzés]` block's `elmúlt N nap`
digest listed only *dates*; it now reads the instances themselves
(`WorkoutSessionRepository.findDoneInstancesBetween`, replacing `findDoneInstanceDates`) and
appends each session's closing note as ` — "…"`, truncated to
`snapshot.workout-note-max-chars`. The same suffix rides `Ma eddig naplózva: gym: elvégezve`, so
today's note is present from the moment it is written — not the next morning, which is why the
cheaper route through `DailySummaryService.addTrain` was rejected (those rows are written
nightly, and they would also hand the memoir a *generated narrative* instead of the sentence
itself). It reads `closingNote`, **not** `note` — the same table holds template rows whose `note`
is the mesocycle plan's day note, and rendering that here would pass plan text off as something
that happened. A blank or absent note renders **nothing at all** (ADR 0010: the snapshot never
remarks on what the user chose not to write). `TrainTools.renderGymLog` carries the note
**unabridged** — the just-in-time layer a "hogy ment kedden?" question lands on, per the
smallest-high-signal-slot-plus-retrieval pattern.

Composition is strictly one-way (companion → other
features; ArchUnit's cycle rule guards the reverse).

**The biometrics-free variant (companion-feed, `mezo-gst9`).** `renderWithoutBiometrics(userId,
today)` is a second entry point alongside `render`, used ONLY by
`feature/proactive/service/CompanionMessageGenerator.generateMorning`. It composes the SAME eight
blocks in the SAME order, but `profileBlock`/`recoveryBlock` each take a `withWeight`/`withSleep`
boolean: `render` passes `true` (the full `[Profil]` mérés+trend line, the full `[Regeneráció]`
sleep line); `renderWithoutBiometrics` passes `false`, so `[Profil]` stops after the height/age/sex
clause (no `mérés:`/`súlytrend:` at all) and `[Regeneráció]` renders only the latest check-in (no
sleep line). This exists because the companion-feed `morning` message is generated BEFORE the
day's sleep/weight can be logged — the design decision (spec §3) is that the morning message must
never discuss sleep or weight at all, and a prompt instruction alone can't guarantee that (the
model still sees and could still leak numbers that are merely "please don't mention" in a payload
it can read). Stripping the two blocks **at the source** removes the leak vector structurally
instead of relying on prompt discipline. Every OTHER companion-feed kind (`sleep`/`weight`/
`midday`/`evening`) calls the ordinary `render` — only `morning` is biometrics-free. See
[proactive.md §1/§3](proactive.md) for the generator side.

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
(deterministic: accent-folded lowercase (NFD strip), sentence-split on `[.!?
]`, violation when
an `advisors.rx-terms` term AND a dose-change verb (`emeld|emeljük|csökkentsd|…hagyd el|állítsd
át…` — imperative/we-forms only, written accent-folded) share a sentence) first; a clinical hit
skips `TurnVerdictCheck` that round. The verdict is ONE cheap-tier call through the history-less
two-string port (`VERDICT_MARKER`-prefixed judge prompt; payload = `"KONTEXTUS:
" + turnSystemPrompt
+ ChatHistory.render(history)` + the tool-call name list from `ToolCallAudit.callNames()` + the
user message + the answer, `TurnVerdictCheck.check`, `advisor/TurnVerdictCheck.java:52-60`) —
**since mezo-q71s the history is no longer inside `turnSystemPrompt`** (§3 "Prompt assembly"), so
the payload renders it explicitly with `ChatHistory.render`; without this the judge would go blind
to the conversation and fire false `redundantQuestion`/`unmarkedClaim` verdicts. Parsed
first-`{`-to-last-`}` into `{redundantQuestion, unmarkedClaim, reason}` — **fail-open** on any
call/parse failure. **`unmarkedClaim`** (renamed from `ungroundedClaim`, mezo-q71s — [ADR
0028](../decisions/0028-marked-speculation-in-chat.md)): the judge asks whether the answer states a
concrete unsupported claim **confidently, without a linguistic hedge** — a marked hunch
("tippelek", "gyanítom", "lehet, hogy", "ezt csak sejtem") is no longer itself a violation; an
invented concrete number still is, hedged or not. Violations map to `redundancy`/`unmarked`
(`AdvisorViolation.check` — was `"grounding"`); retry = `systemPrompt +
AdvisorRetry.block(violations)` with the same tools and the SAME audit (chips reflect the whole
turn), re-checked; after `advisors.max-retries` rounds a still-violating answer returns
`AdvisedAnswer(answer, degraded=true)`. `AdvisorRetry.block` gained a closing tone-preservation
sentence (mezo-q71s, `advisor/AdvisorRetry.java:24-25`): *"A hangnem NE változzon — ugyanaz az élő,
beszélgetős stílus; a javítás kizárólag a fent megjelölt problémára vonatkozzon."* — without it a
corrective retry structurally flattened the whole answer, not just the flagged problem. Both
callers hold the chain as `ObjectProvider<CompanionAdvisorChain>` — advisors off ⇒ no chain bean ⇒
V1.2 behavior byte-for-byte. Timing + verdict are `log.info`-ed per turn (the roadmap's "measure!"
decision).

**Prompt assembly (the load-bearing shape).** The window is loaded **before** persisting the new
message, so the current turn travels as the `userMessage` param — this was true before mezo-q71s
and stays true after it. What changed (mezo-q71s): the history is **no longer rendered into the
system prompt at all**. `loadWindow(userId, conversationId)` maps its `AiMessageEntity` rows onto
`List<CompanionLlm.Turn>` (`toTurns`, `ChatService.java:236-242`) and that list travels to the port
as its own parameter — `sendMessage` (`ChatService.java:193`) and `prepareTurn`
(`ChatService.java:154`, riding `PreparedTurn.history`) both do this. `ChatHistory.render` (the
retired `renderHistory`'s direct successor, now living in `feature/companion/ChatHistory.java`) is
never called on the model-bound path — only by the three non-model consumers described below.

`SYSTEM_PROMPT` (`ChatService.java:56-109`) is now **named blocks**, not one instruction stream:
`[Ki vagy]` (IDENT-1 "társ, nem edző", T/1 plural, never classifies/moralizes) · `[Hogyan beszélsz]`
(mezo-q71s, new — states BEHAVIOUR, not adjectives: converse rather than report, list only when
asked or when there are 4+ peer items, length follows the question, has opinions, asks a real
follow-up question but never a courtesy one, builds on what was already said) · `[Mit szabad
állítani]` (mezo-q71s, new — the marked-speculation policy: a linguistically hedged hunch is
allowed, a concrete number/date/past fact needs a source in the context/a tool call/Daniel's
message, and inventing one is forbidden even hedged; see [ADR
0028](../decisions/0028-marked-speculation-in-chat.md)) · `[Példa a hangnemre]` (mezo-q71s, new — one
contrasting "data-terminal" vs "conversational" answer to the same question, calibrating what
"marked" looks like) · `[Tiltás]` (the clinical guard — *"Gyógyszer adagolására vonatkozó
változtatást SOHA ne javasolj — az orvosi döntés."*; the drug-name example was removed in
`mezo-lwmq`, the prohibition itself is unchanged) · `[Eszközhasználat]` (the V0.5 tool-usage line, "Múltbeli vagy összesítő
kérdéshez … használd a kapott tool-okat", plus the mezo-280 tool-timing sentence below) ·
`[Eszköz-útmutató]` ((mezo-xixu) the terse question-type → tool name routing hint, PR →
`get_exercise_records`, edzésterv → `get_training_plan`, recept → `get_recipes`, … — one line per
tool, kept in sync with the `@Tool` descriptions per
[`companion_tool_conventions.md`](../references/companion_tool_conventions.md)). `Válaszolj
magyarul, tömören.` is GONE (mezo-q71s) — identified as the single line most responsible for the
terse, terminal-like tone; `[Hogyan beszélsz]`'s length rule replaces it. **Since mezo-280** one
closing timing sentence follows the tool-usage line: *"Ha tool kell a válaszhoz, ELŐBB hívd meg, és
csak a megkapott adatból válaszolj — ne írd le előre, hogy „megnézem" vagy „megpróbálom", és ne
ígérj utólagos utánanézést."* The `[Eszköz-útmutató]` block says WHICH tool; this sentence says
WHEN — it targets a live-observed failure mode where the model narrated an intent to look something
up ("most megpróbálom megnézni…") and streamed that narration before the tool result came back,
which read as answering before it had looked even though Spring AI's own streaming tool loop is
correctly ordered (design spec §1, `2026-07-30-companion-stream-tool-events-design.md` §1.2).

`ChatService.TONE_REMINDER` (mezo-q71s, `public` — the advisor's retry re-prompt needs it too,
`ChatService.java:116-119`) is appended at the very END of the FULLY assembled prompt — after
`SYSTEM_PROMPT`, the context snapshot (V0.3), the top-N facts (V1.1) and the pattern-ack block
(V3.3) — in BOTH `sendMessage` and `prepareTurn`. It is the recency-weighted counterweight to the
persona sitting at the prompt's top: *"[Emlékeztető] Ez beszélgetés Daniellel, nem adatlekérdezés.
A fenti adatblokk nyersanyag, nem a válasz formája."* — the runtime data blocks (snapshot/facts) sit
between the persona and this reminder, so without it the last thing the model reads before
answering would be raw data, not voice.

The `CompanionLlm` port's `complete`/`stream` are now **5-arg and ABSTRACT**
(`system, List<Turn> history, user, tools, toolContext` — `CompanionLlm.java:33-38`); the old 4-arg
two-string-plus-tools shape became a `default` delegating with `List.of()`
(`CompanionLlm.java:41-50`), so the port INVERTED (abstract ↔ default) rather than gaining a
parallel overload — every one-shot pipeline caller outside the chat path (meal, recipe, pantry,
sleep, habit-suggest, scrape, transcription, extraction, summary, verdict — §5) sits on the
default and needed zero changes. `GeminiCompanionLlm.request` builds
`.system(sp).messages(toMessages(history)).user(um)` (`GeminiCompanionLlm.java:296-310`) — Spring
AI's actual outgoing message order (`[SYSTEM, history-in-order…, USER]`) is pinned by
`GeminiCompanionLlmPromptOrderTest`, a hand-written `Prompt`-capturing `ChatModel` stub (no IT can
prove this: every IT runs on the `companion-fake` profile, where `GeminiCompanionLlm` doesn't even
exist as a bean — see §8). This supersedes V0.2 Decision #4 / V0.5 Decision 16 below, which
predicted and then confirmed a two-string-only port; mezo-q71s is the port's second inversion.

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

**W5.1 composite flags (bd `mezo-b3pp.18`, spec §9.1) — deterministic, LLM-free.**
`FlagEvaluator.evaluate(userId)` (`feature/companion/flags/service/FlagEvaluator.java`) is pure
arithmetic over `MetricSeriesService` series the owning features already compose READ-ONLY — there
is **no `LlmCallContextHolder` call anywhere in this slice**, because there is no LLM/embed call to
tag. **Rule spine (S1, bd `mezo-d58h.1`, spec 2026-09-03 §3.1) — one class per rule.** `FlagEvaluator`
itself is now a thin orchestrator: it holds no rule logic, just thirteen injected `FlagRule` beans
(`SustainedStressRule`, `SleepDebtRule`, `MomentumAtRiskRule`, `RecoveryNeededRule`,
`LoggingGapRule`, `MissedWorkoutsRule`, `AcuteBadDayRule`, `LoadFuelMismatchRule`,
`RapidWeightLossRule`, `JointOveruseRule`, `IgnoredNudgeRule`, `LateEatingRule`, `AllHealthyRule` —
each `feature/companion/flags/service/rule/*.java`) called in that fixed order, `allHealthyRule`
only when the other twelve raised nothing. The `FlagRule` interface
(`flags/service/FlagRule.java`) is one method, `evaluate(userId, today) → Optional<FlagRaise>`,
cooldowns NOT applied; each implementation carries its own reads and thresholds (still 100% from
`FlagProperties` — no rule holds a number of its own) and stays reviewable in isolation. S1 was a
pure refactor of the original five; **S2 (bd `mezo-d58h.2`) adds two more rules**:

- **`LoggingGapRule`** (spec §4 row 1) — the detector that must NOT go quiet when logging itself
  stops: every value-based rule above reads a `MetricSeriesService` series, and a series with no
  rows is honestly empty, which is exactly what happened on 2026-08-27 when a real logging
  collapse muted every other rule at once. It checks three domains for staleness and raises ONE
  flag carrying the list: meals stale at `logging-gap.meal-stale-hours` since `meal_.logged_at`,
  check-ins stale at `logging-gap.checkin-stale-hours` since `check_in.saved_at`, and sleep stale
  at `logging-gap.sleep-stale-mornings` consecutive missing wake mornings (`sleep_log.date`). A
  domain with no row at all counts as stale (never-logged is the most stale a domain gets). It
  raises once `≥ logging-gap.min-stale-domains` domains are stale. It also carries spec §4 row 5,
  "gap + suspicion": when `sleep_debt` itself stayed silent for want of logged nights (fewer than
  `sleep-debt.min-nights` inside its window) but the nights that ARE logged average at least
  `logging-gap.sleep-suspicion-deficit-hours` of deficit, the payload attaches that observed
  deficit instead of staying silent about it too.
- **`MissedWorkoutsRule`** (spec §4 row 3) — raises when `≥ missed-workouts.min-consecutive-missed`
  PLANNED gym days in a row (`gym_schedule_slot.day_of_week`, over the trailing
  `missed-workouts.window-days`) have no completed workout instance. "Consecutive" counts through
  the sequence of PLANNED days, not calendar days: a Mon/Wed/Fri schedule raises on a missed
  Mon + Wed, two calendar days apart. Only `templateSessionId IS NOT NULL AND status = 'completed'`
  instances count as training (`WorkoutSessionRepository.findDoneInstanceDates`).
- **`SleepDeficitCalculator`** (`flags/service/rule/SleepDeficitCalculator.java`) — the cumulative
  sleep-deficit-vs-goal arithmetic (goal lookup + the day-by-day `Σ max(0, goal − actual)` loop),
  extracted out of `SleepDebtRule` in bd `c6c045082` so `LoggingGapRule`'s "gap + suspicion"
  variant can reuse the exact same computation instead of a second copy. `SleepDebtRule` now calls
  it and turns the result into a verdict; behavior is unchanged from the pre-extraction single-class
  version (`FlagEvaluatorStressSleepIT` covers it unmodified).

**S6 batch B (bd `mezo-d58h.6`) adds the epic's last six rules**, in the spec's severity order
(`AdvicePriority.ORDER`, [proactive.md](proactive.md) §9 decision (ll)) — each with its own honesty
gate, the same discipline as the original seven:

- **`AcuteBadDayRule`** (rank 1, `acute_bad_day`) — ≥`minCheckIns` of TODAY's raw `check_in` rows
  with `body` or `energy` at or below `bodyOrEnergyAtMost`. Reads `CheckInRepository` directly,
  never `MetricSeriesService`'s day-averaged `CHECKIN_BODY`/`CHECKIN_ENERGY` — averaging is exactly
  what would destroy the signal (two 3s and a 7 average to a healthy-looking 4.3). A null
  body/energy is an unanswered question, never a low score, so it never qualifies; fewer than
  `minCheckIns` check-ins logged today ⇒ silent (one bad check-in is a moment, not a pattern).
- **`LoadFuelMismatchRule`** (rank 2, `load_fuel_mismatch`) — 7-day `COMBINED_LOAD_MIN` average at
  or above `loadThreshold` AND (7-day `DAILY_KCAL` average below `kcalFractionOfTarget` of the
  day's kcal target OR 7-day `SLEEP_DURATION_H` average below `sleepFloorHours`). The
  `≥minLoggedDaysPerSide` honesty gate is counted independently on each side from the SPARSE
  kcal/sleep series, never from `COMBINED_LOAD_MIN` itself — that series is one of
  `MetricSeriesService`'s two calendar-complete metrics (with `HABITS_DONE`), so an unlogged day
  there is a real `0.0`, indistinguishable from a genuine rest day. The kcal target comes from
  `FuelDayService.getDay`, paired per logged-kcal-day so a day whose target fails to resolve never
  inflates the logged-day count. `WEIGHT_TREND_PCT_WK` rides along in the payload as a
  corroborating fact only — it never gates or triggers the raise.
- **`RapidWeightLossRule`** (rank 3, `rapid_weight_loss`) — `WEIGHT_TREND_PCT_WK` below
  `pctPerWeekAtMost` (a negative %/week bound; MORE negative fires) AND the owner's single ACTIVE
  goal's `trajectory` is not `cut`. The weigh-in-count honesty gate is the metric extractor's OWN
  (`MetricSeriesService.weightTrendPctWk` yields no data point below 4 weigh-ins in the rolling
  7-day window) — the rule relies on that null rather than re-gating. No active goal at all ⇒
  silent, same as a `cut` goal: an absent goal makes "goal ≠ cut" unreadable, and per spec §7 the
  house default is silence over guessing either direction.
- **`JointOveruseRule`** (rank 4, `joint_overuse`, offers `lighten_tomorrow` — §9 decision (ll)
  below) — 7-day `SHOULDER_STRAIN` average ≥ `strainAvgAtLeast` AND tomorrow's planned gym session
  is shoulder-focused. Tomorrow's plan is read via `WorkoutService.findPlannedTemplateForDate`,
  NEVER `getToday` — `getToday` auto-closes stale instances and closes exercises on every call, a
  write a detection rule (evaluated hourly for every active user by the sweep job) must never
  trigger as a side effect of merely looking. The session's `muscle` field (which can carry a
  dashed sub-zone like `"shoulder-lateral"`) is normalised through `MuscleGroup.of` before
  comparing against `muscleNeedle`, never via a raw substring test. Silent with no strain data
  points in the window (never averages an empty set) or no planned session tomorrow.
- **`IgnoredNudgeRule`** (rank 8, `ignored_nudge`, offers `shift_sleep_anchor`) — the `lights_out`
  push sent on `minConsecutiveDays` consecutive evenings while the observed bedtime never complied
  on any of those nights. Reads sent pushes through the new `NudgeSendPort` (a companion-owned
  port — `notification → companion` already exists, so a direct `PushLogRepository` import would
  close a cycle) and compares `BEDTIME_HOUR` against the sleep anchor in
  `MetricSeriesService.clockHour`'s +24-shifted clock space (the rule's own `shiftedHour` applies
  the identical convention to the anchor before comparing). Gated on a `sleep_goal` row EXISTING,
  read directly off `SleepGoalRepository` BEFORE ever calling `SleepAnchorPort` — `resolve` ghosts a
  config default with no row, and a user with no goal must never be measured against an invented
  target. An unlogged night, a night with no push sent, or a night that complied all BREAK the
  consecutive run rather than counting as compliance or being skipped over.
- **`LateEatingRule`** (rank 9, the epic's last new detection, `late_eating`) — on ≥
  `minDaysOfLastThree` of the last `windowDays` days, the last meal (`LATE_MEAL_HOUR`) was within
  `minutesBeforeBed` minutes of the bedtime anchor (either direction) OR at/after `absoluteHour`
  (22:30 by default, inclusive). Two arms, OR'd per day, with different preconditions: the BED arm
  needs the same `sleep_goal`-row gate as `IgnoredNudgeRule` (`anchorShiftedHour` freezes `null`
  without one, and only the absolute arm can then qualify a day); the ABSOLUTE arm needs no goal at
  all — without one we still know 23:40 is late, we just do not know whether 21:00 is late for THIS
  user. The ABSOLUTE arm compares the RAW `LATE_MEAL_HOUR` value, never the +24-shifted one:
  `LATE_MEAL_HOUR` lives in its own plain 0.0–23.99 space, unlike `BEDTIME_HOUR`; shifting it before
  the absolute comparison (an earlier version's bug, fixed same-slice) made every pre-noon last meal
  unconditionally clear the threshold — a false positive on every intermittent-fasting or
  simply-early eater. A day with no logged meal is skipped, not counted either way.

Two prerequisite fixes underpin the rules above: `MetricSeriesService.weightTrendPctWk` and
`.lateMealHour` used to load a user's ENTIRE history and filter in Java; both are now bounded reads
(bd `mezo-9gp3`/`mezo-d58h.6`) — `weightTrendPctWk` to `[from-6, to]` (the 7-day rolling slope needs
the 6-day margin BEFORE `from` too; narrowing to `[from, to]` would silently change every window's
leading values) and `lateMealHour` to `[from, to]` (no rolling lookback, so no margin is needed).
The hourly sweep job now calling both extractors per-user, every hour, for every active user is what
made the unbounded reads actually matter.

**The `logging_gap` recency-read exception.** Every other rule above reads
`MetricSeriesService`'s day-bucketed series exclusively — but `LoggingGapRule`'s thresholds are in
HOURS (`meal-stale-hours`/`checkin-stale-hours`), and a day bucket cannot express "36 hours since
the last meal" once today is partially elapsed: a meal logged at 23:50 last night and none since
would read as "logged today" in a day bucket while already being 12+ hours stale in real time. So
`LoggingGapRule` reads `meal_.logged_at`/`check_in.saved_at` — real `Instant`s — directly off
`MealRepository`/`CheckInRepository` instead of composing a `MetricSeriesService` series. Sleep
stays day-bucketed (`sleepStaleMornings`, counted off `sleep_log.date`) because `sleep_log` carries
only the wake-morning date, no clock, so there is no finer granularity to lose.

**Adding a `FlagKey` needs FIVE mirrored changes** (S2 hit four of five; the fifth —
`CompanionProperties.Intervention.flag` — was missed and caught only during the S2 fix-wave
review, before it could fail at Spring context startup once S4 adds a `logging_gap`/
`missed_workouts` intervention-library entry): the `FlagKey` string constant itself; a new
`CooldownHours` field + `forFlag` switch arm in `FlagProperties`; a migration widening the
`ck_companion_flag_log_flag_key` DB CHECK; the `@Pattern` regex on `CompanionFlagLogEntity.flagKey`
(`entity/CompanionFlagLogEntity.java`) — a validation-layer mirror of the same DB CHECK that
nothing else re-derives from the other four; and the `@Pattern` regex on
`CompanionProperties.Intervention.flag` (`config/CompanionProperties.java`) — the same mirror again,
one layer up, gating the W5.2 intervention-library binding instead of the flag-log row. Miss either
`@Pattern` mirror and its own `@Valid`/binding validation rejects a legitimately-CHECK-permitted
key before it ever does anything useful.

Three of the five mirrors above (the migration, the entity `@Pattern`, the properties `@Pattern`)
fail loudly at Spring context startup or a `@Valid` rejection if missed. But a NEW `FlagKey` also
needs three quieter **degrade-sites** updated, none of which fail startup when missed — S6's six
new keys (bd `mezo-d58h.6`) cost a review round on each: `AdvicePriority.ORDER`
([proactive.md](proactive.md) §9 decision (ll)) — an unranked key silently ranks last and only
logs a warning, so a forgotten entry never blocks a card, it just always loses; `AdviceFactRenderer`
(same file) — an unmapped key silently renders zero fact lines rather than throwing, so the card
still delivers, just with no evidence block; and `CompanionFlagLogRepository.existsProblemRaiseSince`
— a hardcoded `NOT IN ('all_healthy', 'logging_gap', ...)` exclusion list that a new key correctly
counted as a "problem" needs no change to, but a key that is really a delivery-channel failure
(like `ignored_nudge`, below) must be added to by hand or it silently blocks `all_healthy` for a
full quiet-days window every time it fires.

Pure refactor beyond the two new rules — behavior, thresholds and the fixed evaluation order for
the original five are all unchanged; `FlagEvaluatorStressSleepIT`/`FlagEvaluatorMomentumRecoveryIT`
(§8) cover the same scenarios unmodified. Two triggers feed the SAME code path: the on-write listener (`FlagEvaluationListener`, `@Async
@TransactionalEventListener(phase = AFTER_COMMIT)` on the NEW `CheckInSavedEvent` — published by
`CheckInService.save` — and the existing `SleepLogSavedEvent`, published by `SleepLogService.log`)
and the hourly sweep
(`FlagSweepJob`, `@Scheduled(cron = "${mezo.companion.flags.sweep-cron}")`, gated on
`COMPANION_SWITCH` ∧ `mezo.techcore.cron.flag-sweep-job.enabled`, per-user try/catch — the
`PatternDetectionJob`/`GraphMaintenanceJob` idiom). Both call `FlagService.evaluateAndLog(userId,
source)`, which re-runs the evaluator, drops every raise still inside its own
`cooldownHours.<flag>` window (`CompanionFlagLogRepository.existsRaiseSince`), and appends what
survives to `companion_flag_log` with the inputs frozen in `payload` — **the ONLY difference
between the two triggers is the `source` string** (`FlagKey.SOURCE_WRITE`/`SOURCE_SWEEP`) on the
row. The write path never fails its caller: the listener catches and logs, the sweep isolates
per user. **W5.2 (bd `mezo-b3pp.19`) is now the consumer**: `FlagService.evaluateAndLog` publishes a
`FlagRaisedEvent(userId, flagKey, source)` for every raise it actually WRITES (post-cooldown, inside
the same transaction), and `feature.proactive.service.InterventionEventListener` (`@Async
@TransactionalEventListener(AFTER_COMMIT)` — the `CompanionMessageEventListener` template) turns a
committed raise into a `companion_message` feed card. See the W5.2 subsection below and
[`proactive.md`](proactive.md) §3/§4 for the card mechanics.

**Weekly review data layer + anchored conversations (`mezo-p2tr`).** Two companion-owned pieces
back the `/me/week` "Heti" tab ([me.md](me.md)) and its chat handoff — neither is the weekly-review
NARRATIVE itself (that's proactive-owned, [proactive.md §1 "WR"](proactive.md)):

- **The 6-dimension day evaluation (`mezo-jcpt.4`, plan 2/2).** There is **exactly ONE day math in
  the codebase** — it lives in `DayEvaluationEngine` — replacing the legacy 4-subscore formula
  described in older revisions of this doc (the `sleepSubscore`/`fuelSubscore`/`checkinSubscore`/
  `activitySubscore` methods are **deleted**; `MeWeekProperties`, the legacy formula's config
  record, was DELETED with them (`mezo-jcpt.7`) — the day target it once held is
  `DayEvaluationProperties`'s own `sleepTargetH` now).
  - **`DayEvaluationEngine`** (`service/DayEvaluationEngine.java`) — a PURE function
    (`DayInputs -> DayEvaluation`, no repository access, the `MealScoringService` house style) over
    **six dimensions**: `nutrition` (.30) · `quality` (.15) · `training` (.20) · `sleep` (.15) ·
    `logging` (.10) · `rhythm` (.10) (config, `DayEvaluationProperties`, sums 1.0, startup-validated
    via `Weights.isNormalized`). Each dimension reports `status ∈ {DONE, IN_PROGRESS, NO_DATA}`.
    **Honesty rules (binding):**
    - A `NO_DATA`/`IN_PROGRESS` dimension drops out with weight 0; every surviving `DONE`
      dimension's reported `weight` is the config weight **renormalized** so the `DONE` set sums to
      1.0 — the per-dimension weight and the day's `base` are folded from the SAME renormalized
      list, so they can never drift apart.
    - `base` (the overall score) is the rounded weighted sum of the `DONE` dimensions, and is
      `null` when fewer than 2 dimensions **that actually measured THIS day** are `DONE`, or when
      the day is not yet `closed` (`date < today`, v1 day closure) — an open/future day gets
      per-dimension progress only, never an overall number. `rhythm` is **excluded from that
      count**: it is *extrinsic*, the mean of OTHER days' bases, and knows nothing about this one.
      It still carries its weight in the weighted sum once the gate IS open. **This exclusion used
      to be load-bearing on its own** — before `mezo-el0t`, `logging` was `DONE` (an honest 0) on
      EVERY closed day including a fully untouched one, so `logging` + `rhythm` (`DONE` from ≥3
      prior days) could open the gate alone, reporting `round(0.5×0 + 0.5×rhythmMean)` — roughly
      *half the user's running average* — for a day the user never touched, pushing the state from
      `empty` to `scored` and spending an LLM call narrating nothing. `mezo-el0t` closed that path
      **structurally, not just by policy**: `logging` itself now goes `NO_DATA` on a fully
      untouched closed day (see below), so such a day has **zero** intrinsic `DONE` dimensions and
      the `≥2` gate cannot open regardless of what `rhythm` reports. The `rhythm`-exclusion rule
      above still matters for the OTHER case it always covered — a day with exactly one real,
      intrinsic signal (say `sleep` alone) must not get a second, free "dimension" from `rhythm` —
      but it is no longer the only thing standing between an untouched day and a fabricated score.
    - A **rest day** (`plannedWorkouts` null/0) makes `training` `NO_DATA` ("Pihenőnap · nem
      számít") rather than a penalty — resting must never cost points. One second-order consequence
      of the `mezo-el0t` change below: a day whose only fact is a planned-but-skipped workout
      (`training` `NO_DATA`, nothing else logged) no longer scores a `logging` 0 to pair with — on
      the **day page** it now reads `empty` ("nincs adat"), not `thin`. That is deliberate, not a
      regression: a plan is not evidence about what actually happened that day, so a day with
      nothing but an unmet plan genuinely has no log at all. Pinned by `DayEvaluationEngineTest`.
      **This is NOT yet true of the weekly mosaic.** `training: 30` (the config weight, not a
      score) is still on the `me-week` wire for a planned-but-skipped workout, and the frontend's
      `subscoreCount` (`weekDay.ts`) counts any non-null `subscores.training` regardless of
      whether it represents `NO_DATA` on the backend — so the mosaic still derives `thin` for
      exactly this day class while the day page's `DayEvaluationEngine` says `empty`. This is a
      genuine, currently-live backend/frontend disagreement introduced by `mezo-el0t`, not a
      documentation gap: fixing it needs a contract change (the wire has no way today to
      distinguish "training weight present but NO_DATA" from "training actually scored") plus a
      design decision on which surface should change. Tracked as `mezo-jcpt.16` (P2); deliberately
      NOT fixed in this change.
    - **`logging`'s measurability rule (`mezo-el0t`, narrowing a `mezo-jcpt` review-round-1
      decision, not reversing it).** The original decision: `logging`'s own inputs (meal
      timeliness, water-logged, check-in count) are never "unknown" — false/0 IS the measurement,
      so this dimension gets **no missing-target escape hatch** the way nutrition/quality's
      components do, and a genuinely untouched day must score an honest **0**, not degrade to
      `NO_DATA`, or the process dimension that exists to measure logging effort would silently stop
      penalizing the one day that most deserves it. That decision **still holds** for any day on
      which the user logged something, anything, at all — meals/water/check-ins empty, but a
      workout done, sleep logged, a weigh-in, or XP earned elsewhere: `logging` is still `DONE` and
      still reports its honest 0. What `mezo-el0t` narrows is the day with **no log of any kind**:
      `DayEvaluationEngine.anyLogPresent(DayInputs)` is the one predicate that answers "did the
      user log ANYTHING at all this day" — spanning meals/kcal, water, check-ins, sleep duration,
      sleep quality, completed workouts, weight (`DayInputs.weightKg`) and XP
      (`DayInputs.xp`) — and `loggingDim` checks it FIRST: only when it is `false` does `logging`
      degrade to `NO_DATA` (`null`, no score) instead of scoring the 0. This is safe precisely
      because such a day has zero intrinsic `DONE` dimensions anyway (the gate above is already
      closed), so dropping `logging`'s weight there softens nothing that was ever going to render.
      `weightKg`/`xp` join the predicate alongside the day's OWN logging inputs — not because they
      feed `logging`'s own score, but because `anyLogPresent` answers a broader question ("did the
      user log anything at all today") than `logging`'s own formula does, and a day whose only
      activity was a weigh-in or an XP-earning action must count as logged, not `empty`.
    - `sleep` is the one dimension that does **not** wait for `closed` — it finalizes as soon as
      it's logged, even on an open day (the "A+ lifecycle": each dimension closes on its own
      natural trigger). Formula: `0.7 × min(1, sleepH / sleepTargetH) + 0.3 × (quality-1)/9` when a
      1–10 quality dial was logged, else the duration ratio alone — bit-for-bit the legacy
      `sleepSubscore` formula, carried over verbatim.
    - Meal timeliness (inside `logging`) uses a **circular clock distance**
      (`min(|Δ|, 1440-|Δ|)` minutes) between `eatenAt` and `loggedAt`, both bare `LocalTime`s with
      no date: a meal eaten 23:30 and logged 00:10 reads as **40 minutes** late, not 23 hours — the
      near reading is overwhelmingly the real one, and the rare failure mode (forgiving a meal
      genuinely a day late) is far less punishing than the linear one's (zeroing an
      otherwise-perfect day over a midnight crossing).
    - Nutrition's carb/fat component follows the SAME one-level-down policy: a missing **target**
      is "we never set an expectation" → full credit; missing **data** against a real target drops
      the component out and kcal/protein renormalize over their combined 0.8 share.
  - **`DayScoreService`** (`service/DayScoreService.java`) — the day-score READ path: resolves a
    `DayInputs` carrier from every owning feature (fuel rollup, `WorkoutWindowQueryService`,
    `MetricSeriesService` sleep series, meal `created_at` for logging timeliness, water/check-in
    repositories) and hands it to the engine. Holds **no formula** of its own any more.
    - **Rhythm without recursion.** `rhythm` averages the mean of the PRIOR `rhythmWindowDays`
      days' **base scores computed WITHOUT their own rhythm dimension** ("rhythm-free bases") —
      never today's own base, which would let it eat itself, and never the FULL (rhythm-included)
      base of a prior day either, which would compound. Every day of the extended window
      `[from - rhythmWindowDays, to]` is loaded and evaluated ONCE with an empty prior list; those
      rhythm-free bases are what the in-range days' `rhythm` dimension averages — linear cost, at
      most two pure engine calls per day, never a fan-out. **This means a prior day's rhythm-free
      base can legitimately differ from the `base` score displayed FOR that same day** (which
      includes ITS OWN rhythm dimension) — the two numbers measure different things and are not a
      bug if they disagree.
    - `public DayInputs inputsFor(UUID userId, LocalDate date)` exposes one day's fully-resolved
      inputs (priors included) for the day-evaluation read path, without loading a whole week.
  - **Wire mapping (binding, `DaySubscores`).** **Since `mezo-jcpt.5` this projection is a
    straight 1:1**, not a remap: `DaySubscores`' six fields carry the engine's six dimensions
    under their OWN ids (`nutrition`/`quality`/`training`/`sleep`/`logging`/`rhythm`), and
    `me-week`'s wire shape `MeWeekSubscores` gained the same two fields (`quality`/`rhythm`) so
    the heti mozaik and the day page now share ONE six-key vocabulary — the historical
    "legacy four-field wire shape" this paragraph used to describe is gone from the *live* wire.
    **The one place a four-field shape survives is the persisted `weekly_score` cache**
    (`WeeklyScoreEntity`'s `sleep_avg`/`fuel_avg`/`checkin_avg`/`activity_avg` columns,
    `MeWeekTrendPoint`'s matching fields) — deliberately UNCHANGED (spec D3, no migration): the
    cache only needed the same four dimensions the legacy formula tracked, so widening it to six
    columns for two fields nothing yet reads would have been speculative. `WeeklyScoreService`
    narrows the now-six-field `DaySubscores` back down to those four columns via the SAME
    closest-successor mapping the wire used to carry: `sleepAvg ← sleep`, `fuelAvg ← nutrition`,
    `checkinAvg ← logging`, `activityAvg ← training`; `quality` and `rhythm` get no cache column.
    A degraded (`NO_DATA`/`IN_PROGRESS`) dimension projects to `null` throughout, the same
    "tanulom" signal the legacy subscores carried.
    **`checkinAvg`'s MEANING changed underneath the same formula (`mezo-el0t`).**
    `WeeklyScoreService.aggregate`'s per-column average still just means-the-non-null values — that
    formula did not change. What changed is what counts as non-null: `checkinAvg` averages
    `logging`, and before `mezo-el0t` a fully untouched day's `logging` was a fabricated `0`
    (never `null`), so it pulled every average down; now such a day's `logging` is genuinely `null`
    (see above) and the day drops OUT of the average entirely instead of dragging it toward 0. Two
    weeks with identical real logging behaviour but different untouched-day counts can now report
    different `checkinAvg` values than they would have before this slice, even though nothing about
    how the user actually logged changed — only how an untouched day is counted. Because
    `weekly_score` rows already computed under the OLD rule are silently wrong under the new one (a
    stale cached average, not a stale schema), this slice ships a one-off purge changeset,
    `202609051200_mezo-el0t_weekly_score_cache_invalidation.sql`, the same invalidate-the-cache
    pattern `mezo-jcpt.2`/`mezo-jcpt.4` used for their own `checkinAvg`-affecting changes — every
    row is deleted and the next read recomputes and re-caches under the current rule. This is
    currently **inert for end users**: nothing yet calls the week-trend endpoint that would surface
    a changed `checkinAvg` (§4/§9 below), so the purge is a correctness fix with no visible effect
    today, just no drifted cache waiting for the day something does read it.
    `DaySubscores.score` is `DayEvaluation
    .base()`. The day page itself does not read either shape — it consumes the full
    `DayEvaluation` through `GET /api/me/day/{date}/evaluation` (§4). **`MeWeekService
    .renderDayLine`** (below) is a separate, deliberately-unwidened consumer: it is an LLM-prompt
    payload rendered on every chat turn, so it still renders only the four legacy-named signals
    (alvás/fuel/checkin/aktivitás) off the six-field `DaySubscores` — widening it to `quality`/
    `rhythm` too is a separate decision (spec D4), not a byproduct of the wire change.
- **`MeWeekService`** (`service/MeWeekService.java`) — assembles `GET /api/me/week/{start}`
  (`MeWeekController`, one ISO-Monday week, live for the current in-progress week): per-day
  fuel/sleep/weight/check-in/workout/XP values + `DayScoreService` scores + weekly aggregates
  (checkin ratio, EWMA weight rate, prev-week score, totals). `MeWeekService.renderDayLine(day)` is
  the **single shared Hungarian one-liner formatter** — both `WeeklyReviewGenerator`'s LLM payload
  (proactive) and this doc's own `[Heti adatok]` block below render through this exact method, so
  the generated weekly narrative and the chat's live week context can never describe a day
  differently. Full formula/contract detail: [me.md §4](me.md).
- **`DayReviewService`** (`service/DayReviewService.java`) — assembles
  `GET /api/me/day/{date}/evaluation` (`MeWeekController`, §4): the deterministic evaluation ALWAYS,
  plus — lazily, for a **closed and scored** day only — a cached LLM prose layer over it. **The
  deterministic answer is the answer**: every LLM failure (switch off, provider throw/timeout,
  unparseable answer) degrades to the full evaluation with an EMPTY narrative and NO persisted row
  — never a 5xx, never a cached lie (the `MealCoachService` contract, one day-shaped level up).
  - **Server-side day state** — a five-way mirror of the frontend's four `weekDay.ts` states plus
    `in_progress`: `future` (date after today) → `in_progress` (today, still gathering) →
    `scored` (closed, `base != null`) → `thin`/`empty` (closed, `base == null`: `thin` if anything
    was logged that day, `empty` if nothing was). Prose is generated ONLY in the `scored` state.
  - **Cache, not truth.** `day_review` (migration `202609031300_mezo-jcpt.4_create_day_review.sql`,
    the `weekly_score` shape — soft-delete-aware partial unique index on `(created_by, date)`) holds
    one live row per user+day, keyed by `inputsHash` — `sha256` over each dimension's
    `id|score|status` **and its `facts` (label/value pairs, in emission order)** (fixed engine
    order) plus `base`. The facts are in the key because they are shown to the model and the
    narrative typically quotes them: scores are integers 0..100, so a retroactive log can move a
    fact (carbs 312 g → 280 g) without moving the rounded score, and a score-only key would keep
    serving prose quoting the old number. A hash match serves the stored envelope with
    ZERO LLM calls; a mismatch or missing row costs exactly ONE call, parsed, clamped and upserted.
    The unscored context signals (below) are deliberately OUTSIDE the hash — they are re-read fresh
    on every call and never fold into a cached sentence's correctness — as is the raw
    `priorBaseScores` list the prompt also carries; every prior-day change that matters moves the
    key through the `rhythm` dimension's own score and facts (accepted narrow gap, `mezo-jcpt.11`).
    `DayReviewJson` is the typed
    `jsonb` envelope (`entity/DayReviewJson.java`, the `MealBreakdownJson` precedent):
    `narrative[]`, `dimensionNotes{dim-id: note}`, `highlights[]` (`kind: key|pattern|win`, capped
    at 3), `adjustment {delta, reason}` and a point-in-time snapshot of `context` (read-back only —
    the API response always re-derives context fresh, never from this snapshot).
  - **Context signals** — UNSCORED facts computed DETERMINISTICALLY from their real sources and
    handed to the model so it never invents them: the day's `CHECKIN_ENERGY` mean, the weight
    trend's EWMA weekly rate (`WeightTrendService`), and the consecutive under-target-sleep streak
    ending at that date (breaks on any day with no sleep log — unknown is not "under"). A signal
    with no measurement is simply absent, never a fabricated neutral value; a failure reading them
    costs the signals, not the page (`signalsOrNone`).
  - **AI correction, clamped and discardable.** The model may propose `adjustment {delta, reason}`;
    `delta` is clamped to **[−5, +5]** and an adjustment with no reason is **discarded entirely**
    (never defaulted) — an unexplained nudge is exactly what the honesty rules forbid.
    `score = base == null ? null : clamp(base + delta, 0, 100)`, with `base` always reported
    separately — the correction is a visible chip on the day page, never silently folded into the
    headline number.
  - **`DAY_REVIEW_SWITCH`** (`mezo.feature.day-review.enabled`, default **true**) gates ONLY the
    prose: `DayReviewLlmAdapter` (`llm/DayReviewLlmAdapter.java`, bridging the cheap
    `CompanionLlm` tier, ADR 0008) additionally needs `COMPANION_SWITCH` (the two-switch array
    `@ConditionalOnProperty` idiom). With either off, `DayReviewLlm`'s `ObjectProvider` is empty and
    the endpoint still answers 200 with every dimension and an empty narrative — the score itself
    is never gated by either switch.
- **Anchored conversations.** `ai_conversation` carries two nullable columns, `context_kind`
  (`week`|`day`) and `context_date` — a plain conversation leaves both null.
  `CreateConversationRequest.context {kind, date}` (contract-optional) sets them at creation
  (`ConversationService.create`). **`WeekContextRenderer`** (`service/WeekContextRenderer.java`)
  renders the **`[Heti adatok]`** block for an anchored conversation — every day of the anchored
  week via `MeWeekService.renderDayLine`, the weekly aggregates, and (when a `weekly_review` row
  exists for that week) the review's own summary + day-notes; `kind=day` additionally calls out the
  anchored day with its own expanded line. A client-supplied `contextDate` that isn't itself a
  Monday is normalized to `previousOrSame(MONDAY)` for BOTH `kind`s — `kind=week` anchors this way
  too, not just `kind=day`, so a mid-week `contextDate` can never silently shift the rendered
  window off the ISO week it actually falls in. **Prompt position:** right after the `[Profil]`/`[Cél]`/…
  context snapshot (V0.3) and before the top-N facts block — `assembleSystemPrompt` now takes two
  extra parameters, `contextKind`/`contextDate` (both `null` for a plain conversation, in which case
  the block renders `""` and every other turn is byte-identical to before this slice). **Failure
  honesty (the `GraphPromptAssembler` precedent, IDENT-3):** `render()` never throws — any failure
  (bad date, missing data) logs a warn and degrades to `""`, so a broken week anchor never breaks
  the whole chat turn.
- **`WeekReviewSource`** (`feature/companion/WeekReviewSource.java`) — the port
  `WeekContextRenderer` uses to read the weekly-review summary/day-notes without importing
  `feature/proactive` directly: `proactive`'s `WeekReviewSourceAdapter` implements it (a plain
  repository read + map, deliberately not routed through `WeeklyReviewGenerator`). The dependency
  stays **proactive → companion**, never the reverse — proactive already depends on companion
  elsewhere (`WeeklyReviewGenerator` calls `MeWeekService`/`CompanionLlm`), so a direct
  `companion.service → proactive.repository` import would close a NEW slice cycle
  (`ArchitectureTest.feature_slices_are_cycle_free`); consumed via `ObjectProvider<WeekReviewSource>`
  — an absent bean (proactive switch off) renders the block WITHOUT the review section, never a
  fabricated one, the `TodayQuestSource`/`TodayActivitySource` precedent.
- **`ChatService.openingTurn(userId, conversationId)`** — the server-generated FIRST turn on a
  freshly-anchored conversation, called by `ConversationService.create` right after the row saves,
  only when a `context` was given. Assembles the SAME anchored system prompt every subsequent turn
  gets, then calls the LLM with **empty history, no tools**, and a fixed Hungarian `KICKOFF_PROMPT`
  ("open the conversation yourself: a short 3-5 sentence reflection on the [Heti adatok] block's
  highlighted day or week, close with a question") as the user content. **The kickoff prompt is
  never persisted as a user message** — only the resulting assistant answer is saved, so the
  transcript reads as Mezo genuinely speaking first, not answering a hidden scripted question.
  **Swallow-and-log on any failure** (bad LLM call, blank answer): the conversation simply stays
  empty, exactly as a plain `createConversation()` call would leave it — a broken opening turn never
  fails the create request. The `/me/week` "Beszélgess a napról/hétről" chips
  (`useChatHandoff`, [me.md §2](me.md)) are the sole trigger.

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
  advisor chain rejected the answer even after the corrective retry. **W3.1b** adds
  `recalled_memories jsonb` (`202608221700_mezo-b3pp.28_ai_message_recalled_memories.sql`,
  `mezo-b3pp.28`) — the `[Emlékek]` items ambient recall injected into THIS answer's prompt, in
  prompt order (`RecalledMemoriesEnvelope`); **null** on user rows, on every pre-W3.1b answer, and
  whenever the turn recalled nothing (the `refs`/`tool_calls` null-not-empty precedent). Additive,
  no backfill, no index — it is read only alongside its own row. `mezo-6dii.6` extends each JSON
  item additively with optional `retrievalRunId`, `retrievalResultId`, `memoryItemId` and
  `indicator`. OLD/pre-platform JSON remains readable because absent keys deserialize to null;
  NEW selected items carry the audit run/result identities and may omit `occurredOn` for a
  timeless fact or graph edge.

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
  (chat_turn,daily_summary,weekly_summary)` at V2.1 — **widened to 10 kinds at Phase 5 W1.1**
  (`mezo-b3pp.1`, migration `202608181610_mezo-b3pp.1_expand_memory_embedding_kinds.sql`): `+
  monthly_summary, journal_entry, reflection, gratitude, decision, activity_note, checkin_note`.
  `journal_entry` (W1.1, `KIND_JOURNAL_ENTRY`, written by `JournalEmbeddingListener` below),
  `decision` (W1.4, `KIND_DECISION`, written by `DecisionEmbeddingListener` below),
  `reflection` (W1.2, `KIND_REFLECTION`, written by `ReflectionEmbeddingListener` off
  `feature/ritual`'s close event), `gratitude` (W1.3, `KIND_GRATITUDE`, written by
  `GratitudeEmbeddingListener` below) and `activity_note`/`checkin_note` (W1.5,
  `KIND_ACTIVITY_NOTE`/`KIND_CHECKIN_NOTE`, written by the nightly
  `NoteEmbeddingCatchUp` pass through the lifecycle-aware `MemoryEmbeddingWriter.syncNote`
  since `mezo-b3pp.26` — re-embeds on drift, reaps on orphan or live-but-blank — the only kinds
  with NO listener behind them) are all populated;
  `monthly_summary` is what is still schema headroom from
  the Phase 5 W1 narrative-capture wave (`journal.md` §5/§9) — one migration lands all ten per the
  design spec's explicit instruction, rather than one `alter table` per later slice), `ref_id uuid`
  (`uq_memory_embedding_kind_ref_id (kind, ref_id)` — one embedding per source unit, the V2.2
  pipeline's idempotence anchor **and the spans-soft-deleted-rows constraint that makes journal's
  edit path an update-in-place instead of delete+insert, see the bullet below**), `content text`
  (the embedded narrative, kept verbatim so recall can quote it), `embedding vector(768) not null`,
  `occurred_on date` (when the episode happened — the recency-ranking key); indexes
  `idx_memory_embedding_created_by_kind_occurred_on (created_by, kind, occurred_on desc)` +
  `idx_memory_embedding_vector` (**HNSW, `vector_cosine_ops`** — pairs with the `<=>` operator).

### Backend tables (shared RAG foundation, `mezo-6dii.1`)

Migration `202609041020_mezo-6dii.1_memory_platform.sql` adds five owner-scoped tables while
leaving `memory_embedding` intact:

- **`memory_item`** — one canonical projection per `(created_by, source_kind, source_id)`, with
  SHA-256 `content_hash`, `text[]` topics/people, validity and lifecycle state, typed `provenance`
  jsonb, generated simple-language `tsvector`, GIN full-text/trigram indexes and owner-led reads.
- **`memory_vector`** — one row per `(memory_item_id, embedding_version)`, fixed 768 dimensions,
  pending/ready/failed lifecycle, embedded-content hash and partial ready/live HNSW cosine index.
- **`memory_retrieval_run` / `memory_retrieval_result` / `memory_retrieval_feedback`** — the
  auditable query→ranked candidate→user action chain. Results snapshot rendered content and typed
  score components; feedback is unique per live owner/result pair.
- **`knowledge_fact` additive columns** — `pinned`, `valid_from/to`, `superseded_by`,
  `conflicts_with`, and typed provenance. Defaults preserve all existing rows and prompt behavior.

`content_hash` and `embedded_content_hash` use `varchar(64)` plus an exact lowercase-hex CHECK.
This avoids Hibernate/PostgreSQL `bpchar` schema-validation drift while retaining the intended
fixed SHA-256 invariant.

`mezo-6dii.7` exposes that existing feedback table through two contract-first endpoints:

- `GET /api/companion/memory/retrieval-feedback?resultIds=<uuid,...>` — 1–100 IDs, returning only
  the caller-owned rows that exist; unknown and foreign IDs are omitted.
- `PUT /api/companion/memory/retrieval/{runId}/result/{resultId}/feedback` — body action
  `useful|irrelevant|suppress`, idempotently upserting the owner/result row. `suppress` additionally
  transitions its owned canonical `memory_item` to `suppressed`; a result without such an item
  returns `MEMORY_RETRIEVAL_SUPPRESS_UNAVAILABLE` (400), while changing an already-suppressed
  result returns `MEMORY_RETRIEVAL_SUPPRESSION_FINAL` (400).

Runtime population (`mezo-6dii.2`) is configured under `mezo.companion.memory-platform`:
`serving-mode` (`OLD|SHADOW|NEW`, default/environment fallback `SHADOW` since `mezo-6dii.6`),
`serving-embedding-version`, provider/model/schema metadata, future retrieval limits, an explicit
re-embedding target/batch/cron switch, and audit-retention settings. `MemoryProjectionWriter`
normalizes `search_text` with `ToolText.fold`, writes deterministic empty topics/people and default
salience `0.5`, and updates only the configured serving generation during dual-write. The optional
`MemoryReembeddingService` separately repairs or creates a requested generation when it is absent,
failed, deleted, pending, or carries a stale content hash; provider and malformed-response failures
are persisted with stable codes for a later retry. No runtime path changes the configured serving
version, and no endpoint or FE DTO is added in this slice.

Runtime retrieval (`mezo-6dii.5`) extends the same validated property tree with weighted-RRF and
modifier bounds, per-retriever timeout, reranker eligibility/size/deadline limits
and the old-item threshold.
Audit runs are retained for 30 days by default; `MemoryRetrievalRetentionJob` fans out over active
users at 03:50 and physically deletes expired runs so database cascades remove their result and
feedback children. This is an explicit audit-retention exception to normal domain soft deletion;
source memories and vectors are never touched by the purge.

### Backend tables (LLM audit log, ✅ `mezo-2zyu`)

Migration `202607281200_mezo-2zyu_create_llm_log_history.sql` (in `1.0.0_master.yml`). The table is
owned by the **`feature/llmlog`** package, not by companion — it audits every LLM call in the app —
but it is documented here because both recording adapters live in `feature/companion/llm/` (§5.3).

- **`llm_log_history`** — 36 columns, `id uuid pk (gen_random_uuid())`, `created_by uuid`
  (**nullable**, `on delete set null` — a cron thread has no principal, and deleting a user must not
  take the cost history), `created_at timestamptz`; **`call_kind`** (`CHAT|CHAT_STREAM|VISION|SMART|
  TOOL|EMBED_DOC|EMBED_QUERY`), attribution (`feature` **not null**, `operation`, `entity_kind`,
  `entity_id`), request/outcome (`requested_model`, `served_model`, `status`
  (`ck_llm_log_history_status IN ('SUCCESS','ERROR','CANCELLED')` — the third value added by
  `mezo-1rz9` for streams whose SSE client disconnected mid-turn), `error_code`, `error_class`,
  `latency_ms`, `streamed`, `tool_rounds` (populated since `mezo-58ig`: N usage-reporting model
  rounds ⇒ N−1 tool rounds; null when none observed), `service_tier`), generation counters
  (**per-round-summed on tool turns** since `mezo-58ig` — Spring AI 2.0's tool loop returns only the
  LAST round's response, so `GeminiRoundUsageAdvisor` + the `GeminiRoundUsage` tally sum each billed
  round's own native usage instead; single-round calls are byte-identical) (`prompt_/candidates_/thoughts_/
  cached_/total_tokens`), embedding counters (`embed_input_count`, `embed_dimensions`,
  `embed_billable_chars`), payload (`system_prompt`, **`conversation_history`** — new nullable text
  column, `mezo-q71s`, migration
  `202608161200_mezo-q71s_llm_log_conversation_history.sql` — filled ONLY by the chat call kinds
  (`CHAT`/`TOOL`/`CHAT_STREAM`) with `ChatHistory.render(history)`, null on every other kind; the
  `system_prompt` column's meaning is UNCHANGED by this addition — it still holds exactly what the
  model received as system prompt, nothing appended, `user_message`, `response_text`, `truncated`,
  `payload_bytes` = the TRUE pre-truncation UTF-8 size — `conversation_history` participates in the
  SAME cap/truncation/byte-count discipline as the other three payload columns, `LlmLogWriter.applyPayload`),
  image markers (`image_count`, `image_bytes_total`, `image_mime` — never the bytes), and cost
  (`pricing_snapshot jsonb`, `cost_usd numeric(12,6)`). Indexes: `created_at`, `(feature, created_at)`,
  `(served_model, created_at)` — the pruning axis + the two cost-report axes.
- **`pricing_snapshot` keys are camelCase**, not snake_case like the rest of the schema — it is the
  `PricingSnapshot` record serialised verbatim, so query it as
  `pricing_snapshot->>'inputPerMillion'` (also `sourceModel`, `currency`, `outputPerMillion`,
  `thinkingPerMillion`, `cachedPerMillion`, `embedPerMillionChars`, `pricedOn`).
- **INSERT-only — the one table with NO `is_deleted`** ([ADR 0014](../decisions/0014-llm-call-audit-log.md)):
  `LlmLogEntity` deliberately does **not** extend `OwnedEntity` (that superclass mandates the
  soft-delete column) and has no `@SQLDelete`/`@SQLRestriction`. Audit rows are immutable and never
  deleted — no row ever leaves the table; the only thing that changes is its payload, NULLed in
  place by the retention job below (`mezo-1y3p`, shipped).
- **Retention (`mezo-1y3p`):** the nightly `LlmLogRetentionJob` (`mezo.techcore.cron.llm-log-retention-job.enabled`,
  independent of the write switch) NULLs the four payload columns (`system_prompt`,
  `conversation_history`, `user_message`, `response_text`) of rows older than
  `mezo.llm-log.retention.payload-days` (90) and stamps `payload_scrubbed_at`; token counters,
  `cost_usd` and `pricing_snapshot` are kept forever. The detail view (`/me/ai-usage/:id`) renders
  the honest scrubbed state instead of a silently empty payload.
- **Reading it:** usage/cost aggregates **must exclude `status = 'ERROR'`** — an ERROR row carries no
  provider-reported usage or cost, but its request-side counters (image counts, embedding batch size
  + dimensions) do survive. A **`CANCELLED`** row (`mezo-1rz9` — the SSE client disconnected
  mid-stream) sits between the two: it keeps the partial `response_text` and whatever usage the
  per-round tally caught from already-completed tool rounds — those tokens WERE billed, so when
  present they carry a real `cost_usd`; the never-arrived final usage chunk stays null. A null
  `cost_usd` means *unpriced/unknown*, never *free*: an unpriced
  served model (also `log.warn`ed), an absent usage block and an unknown embedding char count all
  record null rather than a fabricated `0`. Because `created_by` is null on cron/`@Async` threads
  (and on `CHAT_STREAM` rows, whose terminal signal may run off the request thread), a read side must
  NOT apply the usual `created_by = currentUser` ownership filter (it would hide exactly the
  invisible cron and streaming volume).

### Backend tables (W4.1 feedback, ✅ `mezo-b3pp.15`)

Migration `202608211200_mezo-b3pp.15_create_message_feedback.sql` (in `1.0.0_master.yml`) — Phase 5
W4.1, the 👍/👎 capture layer over **every** AI-produced artifact, so W4.2 has real training data
instead of months of unrecorded signal. Driving spec:
[`specs/2026-08-18-phase5-deep-memory-personalization-design.md`](../superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md)
§4.4/§8.1.

- **`message_feedback`** — `id uuid pk (gen_random_uuid())`, `created_by uuid fk→app_user(id) ON
  DELETE CASCADE`, `is_deleted`, `created_at`, `updated_at timestamptz` (`@UpdateTimestamp` — the
  wire's `updatedAt`), `artifact_kind varchar(20)`, `artifact_id uuid`, `verdict varchar(4)`,
  `reason varchar(16)` (nullable). Constraints: `pk_message_feedback_id`,
  `fk_message_feedback_created_by_app_user_id`, **`uq_message_feedback_artifact (created_by,
  artifact_kind, artifact_id)`**, and four CHECKs — `ck_message_feedback_artifact_kind` (the seven
  kinds `chat_message|feed_message|weekly_suggestion|weekly_review|memoir|prediction|day_review`,
  widened from five in two CK-swap-only migrations —
  `202608271500_mezo-p2tr_feedback_weekly_review_kind.sql` added `weekly_review`,
  `202609050900_mezo-jcpt.9_feedback_day_review_kind.sql` added `day_review`; neither touches
  existing rows, only the CHECK's own claim of what a future insert may write),
  `ck_message_feedback_verdict` (`up|down`), `ck_message_feedback_reason_value`
  (`inaccurate|too_much|bad_timing|not_about_me`) and the cross-field
  **`ck_message_feedback_reason`** (`reason is null or verdict = 'down'`). Index
  `idx_message_feedback_created_by_kind (created_by, artifact_kind)` — the batch-read's key.
- **The seven kinds span SEVEN different tables** — `ai_message` (chat answers), `companion_message`
  (the Today feed), `weekly_suggestion`, `weekly_review`, `memoir`, `prediction` (proactive-owned,
  [`proactive.md` §4/§10](proactive.md)) and `day_review` (companion-owned, §3/§4 above,
  `mezo-jcpt.4`/`mezo-jcpt.9`). **`artifact_id` therefore carries NO foreign key**: existence
  is deliberately not validated cross-table (spec §8.1) — seven conditional FKs cannot be expressed,
  and a dangling id is harmless in a single-user app. A vote on a since-deleted artifact simply
  never gets read back.
- **`uq_message_feedback_artifact` spans soft-deleted rows too** (it is a plain unique constraint,
  not a `where is_deleted = false` partial index — deliberate, and the reason the write path is a
  native upsert rather than find-then-save; see the endpoint table below and §9).
- **No own feature switch** — the whole surface rides `mezo.feature.companion.enabled`
  (`FeaturesConfiguration.COMPANION_SWITCH`); feedback is a companion organ, not a feature
  (spec §8.1). Switch off ⇒ the `@ConditionalOnProperty` controller + service are absent ⇒ 404
  on all three operations (`CompanionFeedbackSwitchOffIT`).

### Backend tables (W4.2 feedback rollups, ✅ `mezo-b3pp.16`)

Migration `202608221200_mezo-b3pp.16_create_feedback_rollup.sql` (in `1.0.0_master.yml`) — the
nightly, rollup-only aggregation layer over `message_feedback` (spec §4.4/§8.2).

- **`feedback_rollup`** — `id uuid pk`, `created_by uuid fk→app_user(id) ON DELETE CASCADE`,
  `scope varchar(40)`, `window_days int`, `stats jsonb`, `computed_at timestamptz`. Constraints:
  `pk_feedback_rollup_id`, `fk_feedback_rollup_created_by_app_user_id`,
  **`uq_feedback_rollup_scope (created_by, scope, window_days)`** — the upsert identity —,
  `ck_feedback_rollup_scope` (`scope = 'style' or scope like 'surface:%' or scope like 'feed:%' or
  scope like 'intervention:%'` — the `intervention:%` arm is W5.2's, migration
  `202608241600_mezo-b3pp.19_feedback_rollup_intervention_scope.sql`, CK-swap-only, spec §9.2),
  `ck_feedback_rollup_window_days` (`window_days > 0`). Index
  `idx_feedback_rollup_created_by_scope (created_by, scope)`.
- **No history** — the nightly job overwrites `stats`/`computed_at` **in place** on the same
  `(created_by, scope, window_days)` row; there is no append-only log of past rollups.
- **Eleven fixed scopes per user, always, PLUS one `intervention:<key>` scope per configured
  library entry (W5.2, currently 6 → 17 rows total)** — `surface:chat_message`,
  `surface:feed_message`, `surface:weekly_suggestion`, `surface:memoir`, `surface:prediction`
  (per-artifact-kind up/down/total); `feed:morning`, `feed:sleep`, `feed:weight`, `feed:midday`,
  `feed:evening` (feed-kind resolved by looking `feed_message` artifact ids up against
  `companion_message.kind` through the `FeedMessageKindSource` port — no FK, spec §8.1's
  dangling-id precedent, and the lookup is user-scoped so a foreign row can never leak in); one
  `style` row (a per-surface down-reason histogram, `FeedbackRollupStatsEnvelope.bySurface`); and,
  since W5.2, one `intervention:<key>` row per `mezo.companion.interventions[].key` — the same
  `feed_message`-verdict lookup, filtered to the cards carrying that key
  (`FeedMessageKindSource.interventionKeysByIds`). An intervention verdict counts in BOTH
  `surface:feed_message` (it IS a `feed_message` artifact) and its own `intervention:<key>` row —
  deliberate, not double-counted: `FEED_KINDS` deliberately stays the five prose kinds, so the
  per-key scope is the only place the selection signal lives. Every scope is written even at zero
  counts — a missing row never means "no data", so W4.3/`InterventionService` never need to
  special-case absence.
- **`FeedbackRollupEntity`** (`feedback/entity/FeedbackRollupEntity.java`, W4.2)
  `extends OwnedEntity`; `stats` is the typed jsonb `FeedbackRollupStatsEnvelope` (the
  `PatternEventPayloadEnvelope` precedent — one record, all-nullable fields,
  `effectiveness(up, down)`/`style(bySurface)` factories per shape).
- **Config** — `FeedbackLearningProperties` (`feature/companion/feedback/config/`, prefix
  `mezo.companion.feedback-learning`): `cron` (default `0 10 3 * * *`, 03:10 dawn slot) and
  `window-days` (default 30). The `JournalProperties` precedent — its own small
  `@ConfigurationProperties` record rather than another `CompanionProperties` field.
- **`FeedbackLearningJob`/`FeedbackLearningService`** (`feedback/service/`, W4.2) — the
  `PatternDetectionJob`/`PatternDetectionService` idiom: a thin `@Scheduled` per-user loop
  (own switch `mezo.techcore.cron.feedback-learning-job.enabled`) delegating to a directly
  testable `computeRollups(UUID): int`. Pure code — **no LLM/embed call anywhere in this path**.
- **`FeedMessageKindSource`** (`feedback/service/`, W4.2) — the companion-owned inversion port for
  the `feed_message artifact id → companion_message.kind` batch lookup, implemented by
  `feature.proactive.service.FeedMessageKindService` (same `COMPANION_SWITCH` only). `feed:*`
  bucketing needs proactive data, and `feature.proactive` already imports `feature.companion`
  everywhere, so the direct repository import would close a NEW companion↔proactive cycle that
  ArchUnit's frozen `feature_slices_are_cycle_free` rejects — the `PatternImpactSource` precedent
  exactly. The port also owns the five feed-slot constants (literal mirrors of
  `CompanionMessageEntity.KIND_*`), so the service never imports a proactive entity either.
- **Window keys on `updated_at`, not `created_at`** — `MessageFeedbackRepository.upsertVerdict`'s
  `on conflict do update` bumps `updated_at` and deliberately leaves `created_at` at the FIRST
  vote, so a `created_at` window would silently drop a 👍→👎 flip (or a retract-and-re-vote) on an
  artifact first rated outside the window — the freshest signal there is. `updated_at` is written
  on the insert branch too, so nothing is lost by the swap.
- **Scope, explicitly**: this is the rollup layer ONLY. The reinforcement layer (a 👍/👎 walking
  `ai_message.refs` into knowledge-graph edge weights) activates only once W2 is live and ships as
  a separate, later, switch-guarded slice (design spec §8.2/§10) — not built here.

### Backend tables (W2.1 knowledge graph, ✅ `mezo-b3pp.6`)

Migration `202608221600_mezo-b3pp.6_create_knowledge_graph.sql` (in `1.0.0_master.yml`) — the
Postgres-native knowledge-graph skeleton (spec §4.2/§6.1, [ADR 0031](../decisions/0031-knowledge-graph-postgres-native.md)).
Behind the W2 graph gate ([ADR 0030](../decisions/0030-graph-gate-outcome-build.md), spec §10):
build was chosen after living with W3.1's always-on recall.

- **`knowledge_node`** — `id uuid pk`, `created_by uuid fk→app_user(id) ON DELETE CASCADE`,
  `updated_at timestamptz`, `kind varchar(12)` (`PATTERN|PREFERENCE|GOAL|LIFE_EVENT|SEASON|INSIGHT`),
  `title varchar(120)`, `summary text`, `status varchar(10)` default `active`
  (`candidate|active|archived`), `source_kind varchar(20)`, `source_id uuid`, `occurred_on date`,
  `meta jsonb`. **`uq_knowledge_node_source (created_by, source_kind, source_id)`** (partial, where
  `source_id is not null and is_deleted = false`) is the idempotent promotion anchor W2.2/W2.3
  UPSERT against.
- **`knowledge_edge`** — `id uuid pk`, `created_by uuid fk`, `from_node_id`/`to_node_id uuid
  fk→knowledge_node(id) ON DELETE CASCADE`, `kind varchar(12)`
  (`TRIGGERS|PRECEDED_BY|SUPPORTS|CONFLICTS|RELATES_TO`), `weight numeric(4,3)` default `0.500`
  (`ck_knowledge_edge_weight` 0..1), `evidence jsonb`, `last_reinforced_at timestamptz`.
  **`uq_knowledge_edge_pair (created_by, from_node_id, to_node_id, kind)`** (partial, where
  `is_deleted = false`) — same UPSERT idiom, so a later soft-delete (W2.5) doesn't block
  re-upserting the same pair.
- **`status` vs `is_deleted`** — the two are independent: `is_deleted` is the inherited
  `OwnedEntity` soft-delete; `status='archived'` is the visible L2 lifecycle state (the `GoalEntity`
  `planned/active/archived` idiom). Archiving a node keeps the row — and its
  `(created_by, source_kind, source_id)` anchor — out of active listing/traversal, never deletes
  it; that survival is exactly what lets a re-confirm/re-save UPSERT the SAME node back to
  `status='active'` instead of building a second one under a new id.
  `GraphTraversalQuery`'s `status = 'active'` filter is what takes an archived node out of the
  `[Összefüggések]` block (W2.4 § above). **Retraction (`mezo-b3pp.31`)** is this archiving path
  driven backwards from a source row that stopped qualifying — see the W2.2 section below.
  **The node survives archiving; its EDGES don't, necessarily** — see the `retractPattern` bullet
  below for why a node revived long after archiving can come back with none.
- **The W4.3 companion profile is a singleton `knowledge_node`** of `kind=INSIGHT`,
  `source_kind='profile'`, per user — not a separate table (spec §4.2).
- **`GraphNodeEntity`/`GraphEdgeEntity`** (`feature/companion/graph/entity/`, W2.1)
  `extends OwnedEntity`; `meta` is a generic `Map<String,Object>` jsonb column for now — typed
  envelopes per kind arrive with the slices that write them (W2.2 PATTERN meta `{r,n,direction}`,
  W2.3 LIFE_EVENT meta); `evidence` is a typed `List<GraphEdgeEvidence>` jsonb column
  (`{sourceKind, sourceId, note, at}` per item, the `PantryItemEntity.micros` List<record> jsonb
  precedent).
- **`GraphService`** (`feature/companion/graph/service/`, W2.1) — `upsertNode`/`upsertEdge` are the
  ONLY write paths later slices use (never a direct `repository.save`); both UPSERT by their unique
  index so re-promoting the same source row never duplicates. `archive(userId, nodeId)` flips
  `status` only.
- **Switch** `mezo.feature.knowledge-graph.enabled` (`FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH`)
  — off ⇒ no graph beans exist, `/api/companion/graph/*` 404s, and every graph hook elsewhere (W2.4
  `[Összefüggések]` block, W4.2 reinforcement, RECOVERY profile input) stays silently absent.
- **`CompanionProperties.Graph`** (prefix `mezo.companion.graph`): `maxHops` (1..3, default 2),
  `topK` (1..20, default 8), `decayFactor` (0.9..1, default 0.99), `pruneFloor` (0..1, default 0.05),
  `renderMaxTokens` (default 800) — consumed by W2.4's `GraphPromptAssembler`.
- **Scope, explicitly**: this slice is schema + CRUD + the two REST operations the spec commits to
  now (list active nodes, archive a node). No node-*creation* REST endpoint (nodes are written only
  by internal promotion/extraction pipelines, W2.2/W2.3); `GraphEdgeResponse` never shipped as its
  own DTO — W2.6 (`mezo-b3pp.11`) exposes edges pre-rendered as `GraphNodeResponse.topEdges` text
  lines instead of raw rows, since the only two HTTP consumers (the `[Összefüggések]` prompt block
  and the Tudástár "Kapcsolatok" UI) both want Hungarian lines, never structured edge data — edges
  are otherwise exercised at the service/repository layer directly (`GraphEntityPersistenceIT`).

### W2.2 graph promotion pipelines (✅ `mezo-b3pp.7`)

Existing knowledge starts flowing INTO the graph (spec §6.2) — still no REST surface; promotion is
internal, driven by async event hooks and (from W2.5) a nightly reconciler.

- **`GraphPromotionService`** (`graph/service/GraphPromotionService.java`) — four promotion
  entries (a fourth, `syncPerson`, joined the original three in **Emberek S5**, `mezo-06o0.4` —
  see below), each `@Transactional` and idempotent on `GraphNodeEntity`'s
  `(createdBy, sourceKind, sourceId)` unique index (re-promoting the same row UPSERTs, never
  duplicates):
  - `promotePattern(userId, patternId)` — a `confirmed` pattern (own, not deleted) → a
    `KIND_PATTERN` node, `sourceKind="pattern"`, meta `{r, n, direction}`. Anything else
    (missing/foreign/not-confirmed) returns empty. **Since `mezo-b3pp.31` it also asserts
    `status='active'` on the UPSERT** — the revive half of retraction: `GraphService.upsertNode`
    deliberately never touches `status`, so without this assertion an archived-then-reconfirmed
    pattern would UPSERT its row's summary/meta back to current but stay `archived` forever.
  - `promoteFact(userId, factId)` — an active (own, not deleted), **prompt-included**
    (`include_in_prompt=true`), non-pattern-sourced `knowledge_fact` → `KIND_PREFERENCE`,
    `sourceKind="knowledge_fact"`. **Deliberately skips rows whose `source='pattern'`**: those
    facts are the V3.3 shadow of a pattern that is ALREADY a PATTERN node via `promotePattern`, so
    promoting them too would put the same sentence in the graph twice under two different node
    kinds. Also asserts `status='active'` on UPSERT, the same `mezo-b3pp.31` revive half as
    `promotePattern`. **The `include_in_prompt` filter (`mezo-b3pp.30`) closes the bd's explicit
    either/or**: filter promotion on the flag, or make the deliberate decision to ignore it
    explicit in the spec and docs. This slice took the first option, and the second was never
    seriously in the running — `include_in_prompt` is the user's kill-switch for EVERY injection
    channel, the exact wording `KnowledgeFactService` already uses where the same flag gates the
    V1.1 facts block and the V3.3 acknowledgment block, and `GraphPromptAssembler` renders
    traversed nodes straight into that SAME system prompt. The graph is one more channel into it,
    not an exception to the rule; documenting a switch the user can see in the Tudástár UI that
    silently keeps leaking through the graph would contradict the switch's own contract, so the
    question is closed here, not left open for a future slice to re-litigate.
  - `syncGoal(userId, goalId)` — a goal → `KIND_GOAL`, `sourceKind="goal"`. Status mapping: `active`
    ⇒ node `status="active"`; anything else (`planned`/`archived`) ⇒ node `status="archived"` (the
    graph shadows a goal's whole lifecycle, it never forgets one; this is why `syncGoal` already
    demotes a merely-**inactive** goal without needing a separate retraction path). A goal that is
    **not** active and has never been promoted (`findBySource` empty) is skipped entirely — nothing
    to archive yet. Its finder is `findByCreatedByAndDeletedFalse...`, so a **soft-deleted** goal is
    invisible to `syncGoal` — deletion needs its own mirror, `retractGoal` below.
  - **`syncPerson(userId, personId)`** (**Emberek S5**, `mezo-06o0.4`, `SOURCE_PERSON = "person"`)
    — the fourth promotion entry, the `syncGoal` shape applied to a person: an active person →
    `KIND_PERSON` node, title = the person's name (`truncateTitle`), summary = `personSummary` —
    `relationshipHu` alone, or `relationshipHu + " · " + cadence` when the person has a contact
    cadence label. Anything else (`candidate`, `archived`) archives the node instead, the same
    `syncGoal`-style demotion. **A candidate is deliberately never promoted**: an overnight
    extractor proposal is not a fact until the user accepts it, so a never-promoted, non-active
    person is a no-op — there is nothing to shadow yet, exactly as `syncGoal` treats a
    never-active goal. Meta is a **merge, not an overwrite** (`HashMap` seeded from the existing
    node's meta, code-review fix `mezo-06o0.4`): the nightly edge pass below writes an
    `edgeStructuredOn` marker into the same jsonb column, and a plain rename/relationship-edit
    sync must not clobber it with a fresh `Map.of()`.
  - **`retractPerson(userId, personId)`** — the DELETE-path mirror of `retractGoal`: a
    soft-deleted person is invisible to `syncPerson`'s `...AndDeletedFalse` finder, so deletion
    needs its own retraction, same as a soft-deleted goal. A rejected candidate (reject = soft
    delete) also routes here and is typically a no-op — a candidate rarely had a node to archive.
  - All four titles go through `truncateTitle` — pattern titles (LLM hypotheses, up to 200 chars),
    fact texts, and goal titles can all exceed `knowledge_node.title varchar(120)`; person names
    cannot (`people.yml` pins `maxLength: 120` and `PersonExtractionService.validCandidates` drops
    longer names, so `truncateTitle` is unreachable on the person branch). Truncation cuts to 117
    chars + `…`.
  - **Retraction (`mezo-b3pp.31`) — promotion's mirror.** `retractPattern(userId, patternId)`,
    `retractGoal(userId, goalId)` and `retractFact(userId, factId)` each re-check their own
    source row's qualifying condition rather than trusting the caller (a pattern no longer
    `confirmed`; a goal with `is_deleted=true`; a fact with `is_deleted=true` OR
    `include_in_prompt=false`, mirroring `promoteFact`'s own filter), and archive the matching
    node through a private `archiveBySource` helper — plain JPA dirty checking inside the
    method's own `@Transactional`, no `saveAndFlush`. Each is a no-op (empty return) when the
    node was never promoted or is already archived, the same idempotence promotion already had.
    **`retractFact` has two triggers now, not one.** The *delete* half is still dead code in
    practice — no service in main source soft-deletes a `knowledge_fact`, so nothing publishes a
    delete-triggered retraction event, and the nightly complement sweep below remains its only
    caller for that half. The *opt-out* half is live as of `mezo-b3pp.30` (this slice): every
    `KnowledgeFactService.update` publishes `KnowledgeFactChangedEvent` unconditionally, and
    `GraphPromotionListener` routes it to `syncFact` below, so flipping `include_in_prompt` off
    reaches `retractFact` on the same turn instead of waiting for dawn.
  - **`syncFact(userId, factId)`** — promote-or-archive in ONE `@Transactional` call, the
    `syncGoal` shape applied to facts. `promoteFact` and `retractFact` each answer only half of
    "did this fact change", and a caller reacting to a `KnowledgeFactChangedEvent` cannot know in
    advance which half applies — the same `PATCH` that opts a fact out can opt the next one back
    in. `syncFact` tries `promoteFact` first and falls through to `retractFact` only when
    `promoteFact` returns empty, and — unlike `reconcile`'s per-item loop below, which
    deliberately calls itself through the injected `self` proxy so each row gets its own
    transaction — `syncFact` calls `promoteFact`/`retractFact` on `this` on purpose: the whole
    promote-or-archive decision for one fact must commit or roll back as a single unit, not as
    two.
  - **The regression this closes.** Before `mezo-b3pp.30`, `mezo-b3pp.31`'s revive half made
    `promoteFact` unconditionally assert `status='active'` on UPSERT with no `include_in_prompt`
    filter, so the nightly `reconcile` sweep would re-promote — and silently re-activate — an
    opted-out fact's node on every pass. A user who noticed the leak and archived that node by
    hand from the Tudástár UI had it resurrected by the next dawn's reconcile. The filter added
    here (both in `promoteFact` and, via the same condition, in `retractFact`'s qualifying check)
    closes that: an opted-out fact's node either never gets promoted or gets archived on the next
    `syncFact`/`reconcile` pass, and stays archived. **This durability is specific to opted-out
    facts.** For a fact left `include_in_prompt=true`, `promoteFact` still unconditionally
    re-asserts `status='active'` on UPSERT (the `mezo-b3pp.31` revive half, unchanged) — a
    hand-archived node for such a fact is still resurrected, and this slice actually SHORTENS
    that undo window from a night to a turn, since any `PATCH` on the fact now routes through
    `syncFact` → `promoteFact` within the async hop. `include_in_prompt` is the intended lever
    for keeping a fact out of the prompt; hand-archiving its graph node from the Tudástár UI is
    not a substitute for it.
  - **The node survives archiving; its edges don't, necessarily.** `status='archived'` keeps the
    row and its `(createdBy, sourceKind, sourceId)` anchor, so a later re-confirm/re-save
    UPSERTs the SAME node back to `active` rather than building a second one — but
    `GraphMaintenanceService.decayAndPruneEdges` (W2.5 § below) decays EVERY active edge nightly
    by `graph.decay-factor` regardless of endpoint status, and soft-deletes any that fall under
    `graph.prune-floor`; at the defaults (`decay-factor=0.99`, `prune-floor=0.05`) an edge that
    started around weight 0.3 crosses the floor in roughly half a year. On the later revive,
    `promotePattern`'s `isNew` check is false (the node row never went away), so
    `GraphEdgeStructurer` is deliberately NOT re-run — a node archived long enough comes back
    `active` but edge-less, and since `[Összefüggések]` renders purely from edges, contributes
    nothing to that block until something else rebuilds its edges.
  - **Residual window via the weekly profile snapshot (honest gap, out of scope).** A retracted
    PATTERN/PREFERENCE node leaves `[Összefüggések]` immediately, but `ProfileAssembler` (W4.3 §
    below) condenses active PATTERN/PREFERENCE titles into the `[Rólad tanultam]` block's
    `summary` only once a week — so content retracted mid-week can still be quoted inside
    `[Rólad tanultam]` until the next weekly regeneration. Self-healing (the next `rebuild` drops
    it), not fixed here.
  - `reconcile(userId)` — the nightly sweep (patterns/facts/goals/**people** the write-path hooks
    could have missed: pre-graph confirmations, manually created facts, drifted titles, a person
    whose status changed while the graph switch was off). Pure UPSERT, so running it twice in a
    row is a no-op on the second pass. **Exists in this slice but nothing schedules it yet** — no
    cron, no REST trigger; W2.5's `GraphMaintenanceJob` wires it in.
    **Since `mezo-b3pp.31` it returns `GraphReconcileResult(int upserted, int retracted)`** (a
    new record, replacing a bare `int`) and runs a promotion loop per source kind — pattern, fact,
    goal, and (**Emberek S5**, `mezo-06o0.4`) **person**, in that order — followed by a FIFTH,
    complement-set sweep: walking every one of the user's active nodes back to its source row and
    archiving any whose source stopped qualifying (a pattern no longer confirmed, a soft-deleted
    goal, fact, or person) — per-row isolated through the same `self`/`proxy`
    per-item-transaction idiom as the promotion loops, and skipping `sourceKind`s it does not own
    (`sourceId == null` for extractor/quarterly nodes; the `switch`'s `default -> false` branch for
    the profile node, which DOES carry a `sourceId` — see the code comment). This is the
    complement loop's whole reason to exist: the four promotion loops above only ever see rows
    that STILL qualify, so a row that LEAVES its qualifying set (un-confirmed, soft-deleted) is
    invisible to them and its node would otherwise stay active forever; the sweep is what heals a
    retraction missed while the switch was off (no listener existed to hear the event). For a
    `knowledge_fact` specifically it remains the ONLY path that ever retracts one for the *delete*
    half (nothing in main source soft-deletes a `knowledge_fact`) — the *opt-out* half now also
    reaches `retractFact` on the next turn via `syncFact` (`mezo-b3pp.30`), with the sweep as its
    backstop, same as every other source kind. The `person` branch of the complement switch calls
    `retractPerson`, the same backstop role.
  - **Deliberate transaction shape**: `promotePattern`/`promoteFact`/`syncGoal` are each
    all-or-nothing (node + any structured edges commit or roll back together, one DB transaction).
    A failure mid-promotion loses that one promotion, but promotion is idempotent, so the next
    re-confirm/re-save or the future nightly reconciler heals it with no special-casing needed. The
    user-facing safety net — a graph hiccup must never break the pattern/fact/goal write itself —
    is NOT this method's job; it comes from the async, AFTER_COMMIT listener below running outside
    the user's own write transaction entirely. **The honesty of "loses that one promotion" depends
    on `GraphEdgeStructurer` never swallowing a real persistence failure** (see below) — only the
    model-answer half of edge structuring is best-effort; a `DataAccessException` from the edge
    upsert propagates out of `promotePattern` so the transaction that rolls back and the caller
    that gets told about it agree.
- **`GraphEdgeStructurer`** (`graph/service/GraphEdgeStructurer.java`) — runs ONLY for a genuinely
  NEW node (re-promotion is a pure UPSERT, no LLM call), inside `GraphPromotionService`'s own
  transaction (tried `REQUIRES_NEW` once — reverted, since the new node isn't committed yet in the
  outer transaction, so a second transaction inserting edges against it always fails the
  `knowledge_edge` FK under read-committed isolation). Cheap tier (`CompanionLlm`), tagged via
  `LlmCallContextHolder.runWith(new LlmCallContext("companion_graph", "structure_edges",
  evidenceSourceKind, evidenceSourceId), …)` for the audit log. The prompt lists the newly promoted
  node plus a **numbered, index-based** candidate list (never titles — nothing depends on the model
  echoing Hungarian text back verbatim) of up to `top-k × 3` of the user's other active nodes,
  newest first, so the prompt stays flat as the graph grows instead of scaling with total node
  count. **Emptiness gate**: with no other active node there is nothing to link to and no LLM call
  is made at all. Suggestions below `mezo.companion.graph.edge-confidence-floor` **or above `1.0`**
  are dropped — never clamped, so a cheap model answering percent-style (`85`) or otherwise
  out-of-range can never reach `weight = confidence × 0.5` and threaten `knowledge_edge.weight
  numeric(4,3)` / `ck_knowledge_edge_weight`. Of the survivors, at most `top-k` are created (highest
  confidence first — the plan's locked decision to reuse W2.4's traversal cap rather than add a
  second knob) at `weight = confidence × 0.5` — edges start humble and only W2.5 reinforcement
  raises them. **IDENT-3, narrowly scoped to the model's answer**: a failed LLM call or an
  unparseable/empty response degrades to NO edges, logged and swallowed — never a failed promotion;
  the node the caller already persisted stands on its own. A `DataAccessException` out of the edge
  upsert itself is a DIFFERENT failure mode and is deliberately **not** swallowed: it propagates out
  of `structureEdges` and `promotePattern` so the caller's transaction actually rolls back and the
  caller is told the promotion failed, instead of the transaction silently going rollback-only while
  a "successful" node is returned.
- **`GraphPromotionListener`** (`graph/service/GraphPromotionListener.java`) — the
  `JournalEmbeddingListener` idiom: `@Async` + `@TransactionalEventListener(phase =
  TransactionPhase.AFTER_COMMIT)`, so promotion (LLM-bearing, via the structurer) never sits inside
  the user's own write transaction and a graph failure can never break a pattern decision, a fact
  accept or a goal save. Gated on **both** `COMPANION_SWITCH` and `KNOWLEDGE_GRAPH_SWITCH` — either
  off and the listener bean does not exist, so the hooks are simply absent. Consumes three events,
  each published inside the writer's own transaction (so an AFTER_COMMIT listener only ever sees a
  durable write):
  - `PatternConfirmedEvent(userId, patternId)` — published by `PatternService.decide` when a
    pattern lands in `confirmed` → `promotePattern`.
  - `KnowledgeFactPromotedEvent(userId, factId)` — published by `FactCandidateService` right after
    an accept/refine promotes a candidate into a `knowledge_fact` → **`syncFact`, not
    `promoteFact`** (rerouted by `mezo-b3pp.30`): a freshly promoted candidate is vanishingly
    unlikely to already be opted out, but the handler has no reason to special-case it when
    `syncFact` answers the same question correctly either way.
  - `GoalSavedEvent(userId, goalId)` — published by `GoalService` on every write that can change a
    goal's title or status (create/update/activate/archive) → `syncGoal`. The event record lives in
    `feature/goal/service/`, not `feature/companion/`: **the goal feature never imports companion**,
    it just publishes a plain Spring event and knows nothing about who (if anyone) is listening.
  - **Retraction events (`mezo-b3pp.31`), the same AFTER_COMMIT/`@Async` idiom, two more handlers
    on the same `GraphPromotionListener`:**
    `PatternRetractedEvent(userId, patternId)` — published by `PatternService.decide` on every
    NON-confirm branch (reject, or any other outcome that doesn't land in `confirmed`) →
    `retractPattern`; since the handler just re-reads the pattern's current status, a pattern that
    was rejected without ever having been confirmed publishes the event same as any other reject
    and `retractPattern` finds no promoted node and no-ops — harmless, not special-cased.
    `GoalDeletedEvent(userId, goalId)` — published inside `GoalService.deleteGoal`'s own write
    transaction → `retractGoal`. Both publishers are unconditional and switch-blind, the same
    posture as the three promotion events: with `KNOWLEDGE_GRAPH_SWITCH` off the listener bean
    itself does not exist, so nobody is subscribed and publishing costs nothing beyond the event
    object.
  - **`KnowledgeFactChangedEvent(userId, factId)` (`mezo-b3pp.30`)** — the third fact event, and
    the one that closes the opt-out gap above: `KnowledgeFactService.update` publishes it
    unconditionally inside its own write transaction, on every partial update — text edit,
    category change, or the `includeInPrompt` toggle alike — because the publisher has no reason
    to pre-judge whether a given edit flipped the fact's qualifying condition; the consumer
    re-derives that. A new `@Async @TransactionalEventListener(AFTER_COMMIT)` handler on
    `GraphPromotionListener` routes it to `syncFact`, so an opt-out (or opt-back-in) takes effect
    on the user's next turn rather than waiting for the nightly `reconcile` sweep. **Incidental
    win**: because the event fires on every update, not just the `includeInPrompt` toggle, an
    edited fact's graph-node title no longer goes stale until the nightly reconcile catches up —
    a rename now reaches `[Összefüggések]` on the same turn. **Carve-out: this "next turn"
    claim covers only the traversal channel** (`[Összefüggések]` and the injected fact block) —
    it is NOT a complete enumeration of every place an opted-out fact's words can still surface.
    The weekly `[Rólad tanultam]` block is a separate, slower channel with its own residue
    window; see "Residual window via the weekly profile snapshot" above.
  - **Person hooks (`mezo-06o0.4`, Emberek S5), the same AFTER_COMMIT/`@Async` idiom, on the same
    `GraphPromotionListener`:** `PersonSavedEvent(userId, personId)` → `syncPerson` and
    `PersonDeletedEvent(userId, personId)` → `retractPerson`. `PeopleService` publishes both,
    unconditionally and switch-blind (the same posture as every other event above), on every
    create/update/delete and every `decide(accept)`/`decide(reject)` — an accept flips a person's
    status to `active` and a save-event follows it into the graph on the same turn; a reject is a
    soft delete and fires the delete event. The event records live in
    `feature/people/service/`, not `feature/companion/`: the people feature never imports
    companion, same boundary `GoalSavedEvent`/`GoalDeletedEvent` already established for goals.
  - Each handler wraps its call in its own try/catch + `log.warn` — a promotion or retraction
    failure is logged, never rethrown into the async executor.

### W2.3 life-event extraction + confirm inbox (✅ `mezo-b3pp.8`)

A day's own words become 0..N `LIFE_EVENT` **candidates** (spec §6.3) — the first graph writer that
requires an explicit L2 decision before anything durable exists, the `FactCandidateService.decide`
idiom transplanted onto the graph.

- **`LifeEventExtractionService.extractFor(userId, day)`** — one cheap-LLM pass per day, gated on
  **both** `COMPANION_SWITCH` and `KNOWLEDGE_GRAPH_SWITCH`. **Nothing schedules it**: no cron, no
  REST trigger; W2.5's `GraphMaintenanceJob` will call it exactly as it will call W2.2's
  `reconcile(userId)` — the sweep exists, the cron arrives with the job.
  - **Two gates, both BEFORE any spend.** (1) `GraphNodeRepository.countExtractorNodesOnDay`
    (native, `source_kind = 'extractor' and occurred_on = :day`, deliberately blind to
    `is_deleted`) — a day already processed (accepted, still-pending, OR rejected) is never
    re-proposed; a rejected night must not resurrect itself every subsequent run. (2) the
    emptiness gate — `gatherNarrative` concatenates `journal_entry` (all of the day's entries) +
    `ritual_day.reflection_text` (the Napzárás reflection) + `daily_summary.narrative`, in that
    prompt order; a day with nothing written in any of the three costs no LLM call at all.
  - **The prompt**: system prompt tagged `EXTRACTOR_MARKER = "[life-event-extractor]"` (the
    `GraphEdgeStructurer.STRUCTURER_MARKER` `FakeCompanionLlm` dispatch idiom) asks for **at most
    3** life events as a bare JSON array (`[{"title", "summary", "edges":[{"index","kind","confidence"}]}]`,
    empty array `[]` if the day brought none); the user message lists the day's narrative followed
    by a **numbered, index-based** list of the user's existing active nodes (`top-k × 3` newest
    first, the W2.2 `GraphEdgeStructurer` pool-multiplier idiom — index, never title, so nothing
    depends on the model echoing Hungarian text back verbatim). Tagged for the audit log via
    `LlmCallContextHolder.runWith(new LlmCallContext("companion_graph", "extract_life_events",
    "day", null), …)` — `refId` is `null`: the call is scoped to a day, not to one existing entity.
  - **Allowed edge kinds**: only `TRIGGERS`/`PRECEDED_BY` (the two temporal/causal kinds; an event
    can trigger or follow an existing node, never `SUPPORTS`/`CONFLICTS`/`RELATES_TO`). Edges run
    from the new event toward the listed node, and `PRECEDED_BY` reads literally along that
    direction — *the event was preceded by the listed node* (the listed node happened first),
    stated in the prompt since W2.4 pinned the convention. A
    suggestion whose `index` is out of range, whose `kind` isn't one of the two, or whose
    `confidence` falls outside `[edgeConfidenceFloor, 1.0]` is **dropped, never clamped** — reusing
    the same `mezo.companion.graph.edge-confidence-floor` + `topK` config the W2.2 structurer
    already validates against, and the same reason: an out-of-range confidence must never survive
    to the confirm path, where `weight = confidence × 0.5` would threaten
    `ck_knowledge_edge_weight`. Survivors are packed into the typed **`GraphProposedEdge`**
    envelope (`toNodeId`, `kind`, `confidence`) and stored as a plain list under
    `knowledge_node.meta.proposedEdges` (`GraphProposedEdge.META_KEY`) — extraction never writes a
    `knowledge_edge` row itself, so a rejected candidate leaves no residue anywhere.
  - **IDENT-3**: a failed LLM call, or a response `parse()` can't find a `[...]` array in, or one
    that fails to deserialize into `LifeEventSuggestion[]`, degrades to **zero candidates** — logged
    (`log.warn`) and swallowed, never an exception out of `extractFor`, never a half-written night.
    Suggestions with a blank/missing `title` are filtered before the per-day limit is applied.
  - **The persistence side is atomic too.** `extractFor` itself carries no `@Transactional` (it is
    called once per user/day, with no wider transaction to join), so the night's candidate writes
    are pulled into their own `@Transactional persistCandidates(...)` method, invoked through a
    self-injected `ObjectProvider<LifeEventExtractionService>` proxy — the same idiom
    `GraphPromotionService.reconcile`'s javadoc explains (plain `this` self-invocation would bypass
    the proxy and get no transactional advice at all). One failing suggestion (a NUL byte Postgres
    rejects, a transient `DataAccessException`, ...) rolls back every candidate the night proposed,
    and `extractFor` degrades to `0` instead of letting the exception escape — so
    `countExtractorNodesOnDay` still finds nothing for the day, and a later run can retry it
    cleanly instead of a half-written night wedging the day gate shut forever.
  - Titles are truncated the `GraphPromotionService.truncateTitle` way (117 chars + `…`) —
    `knowledge_node.title varchar(120)`.
- **`GraphService.createCandidate(...)`** (new, alongside W2.1's `upsertNode`/`upsertEdge`) —
  deliberately **not** an upsert: extractor candidates carry `sourceId = null`, so
  `uq_knowledge_node_source` (partial, `source_id is not null`) doesn't apply and there is no key
  to UPSERT against; the per-day probe above is what keeps a re-run from proposing the same night
  twice. Writes `status = candidate` directly (IDENT-6: nothing the AI derives becomes durable
  without an explicit decision). `GraphService.listCandidates(userId)` is the paired read —
  `status = candidate`, not-deleted, newest first.
- **`LifeEventCandidateService`** (`graph/service/`) — the ONLY path from a `candidate` node to
  durable structure:
  - `listPending(userId)` → `graphService.listCandidates` mapped to `GraphNodeResponse`.
  - `decide(userId, nodeId, GraphCandidateDecisionRequest)` — 404 `GRAPH_NODE_NOT_FOUND` for a
    missing or foreign node (owned lookup, no existence leak); 400
    `GRAPH_CANDIDATE_ALREADY_DECIDED` when the node's `status` isn't `candidate` any more — **one
    decision per candidate**, never a silent second activation.
    - `reject` — a plain soft delete (`nodeRepository.delete`, `@SQLDelete`), **not** `archived`:
      an un-confirmed guess must leave no residue at all (the spec's own wording); `archived` stays
      reserved for nodes that WERE true and are being retired later (W2.6).
    - `accept` — flips `status` to `active`, flushes, then materialises every entry in the node's
      `meta.proposedEdges` envelope via `GraphService.upsertEdge` at `weight = confidence × 0.5`
      (edges start humble, same as W2.2 — W2.5 reinforcement is what raises them), evidence
      `{sourceKind: EVIDENCE_SOURCE = "extractor", sourceId: <the new node's id>, note:
      "life-event confirm confidence=…", at: now}`. **Vanished-target skip**: a proposed edge whose
      `toNodeId` no longer resolves to an OWNED, `active`, not-deleted node (archived or
      soft-deleted between extraction and the decision) is silently skipped and logged — a stale
      proposal must never block confirming an otherwise good life event.
  - The typed envelope is read back out of the generic `meta` jsonb map defensively: anything that
    isn't a `List<Map>`, or a map entry with a missing field or a non-UUID `toNodeId`, is dropped
    rather than thrown — a confirmed life event with one unreadable proposal is still a confirmed
    life event.
  - **`accept` re-validates every survivor before materialising it** — `decide` is the trust
    boundary (the ONLY path to durable graph structure), so it never assumes the extractor's own
    validation still holds for whatever is sitting in `meta` by confirm time. Each proposal is
    re-checked against the SAME rule the extractor applies (`kind` ∈
    `LifeEventExtractionService.ALLOWED_KINDS`, `confidence` ∈ `[edgeConfidenceFloor, 1.0]`), plus a
    self-loop guard (`toNodeId` equal to the candidate's own id). A proposal failing any of these is
    dropped, never clamped, and logged — the same reasoning as the extractor's own drop rule: an
    out-of-range confidence would compute a weight `ck_knowledge_edge_weight` rejects, and an
    unknown kind would violate `ck_knowledge_edge_kind`, either of which would otherwise turn an
    accept into a 500 that rolls back the whole decision.
- **`GraphMapper.proposedEdgeCount`** — a new `GraphNodeResponse` field: the size of
  `meta.proposedEdges` for a candidate node, `0` for every non-candidate node and for a candidate
  whose meta carries no (or a malformed) list. Lets the FE render "accept → N new links" without a
  second round-trip.
- **`FakeCompanionLlm`** dispatch (test-only): `[fake-life-events:[…]]` planted anywhere in the
  narrative is echoed back verbatim as the model's JSON array (a missing sentinel ⇒ `[]`, the
  un-scripted "quiet day" path); `[fake-life-events-broken]` returns matching-bracket-but-invalid
  JSON to exercise the catch-and-log parse-failure path specifically, distinct from the
  empty-answer path.

### W2.4 graph traversal + `[Összefüggések]` block (✅ `mezo-b3pp.9`)

The graph's first READ surface (spec §6.4): the part of the knowledge graph that touches what the
user just said, rendered into the chat prompt. No LLM anywhere in the slice.

- **`GraphTraversalQuery`** (`graph/repository/`) — BOTH statements the block needs, both raw JDBC
  under the same savepoint helper (`underSavepoint`) — the `MemoryEmbeddingAnnQuery` idiom (§9): a
  failed statement can't abort the chat turn's transaction. Gated `KNOWLEDGE_GRAPH_SWITCH`.
  - `activeNodes(userId)` → `ActiveNode(id, title, summary)`, the owner's active non-deleted nodes,
    `created_at desc, id` — the seed candidates. The `id` secondary key makes the order TOTAL
    (Postgres does not guarantee any particular row order among exact `created_at` ties), which
    `GraphTraversalService.seedsFor`'s stable ranking sort relies on for its own determinism
    (`mezo-b3pp.34`). It is **raw JDBC and not a JPA finder on purpose**: a Hibernate query failure
    marks the turn's transaction rollback-only, after which `GraphPromptAssembler`'s catch → EMPTY
    could no longer save the turn (IDENT-3).
  - `neighborhood(...)` → ONE recursive CTE over `knowledge_edge`, walked **undirected** from the
    seed ids (`from_node_id in seeds or to_node_id in seeds`), frontier = the far end of the last
    edge, `path uuid[]` as the cycle guard (a node is never re-entered), `hops < :maxHops`. The
    recursive term additionally requires the FRONTIER node itself to be active, non-deleted **and
    owned by the caller** before it extends through it — an archived node can still surface as an
    edge's endpoint (the final join drops those rows), but the walk never steps THROUGH it to reach
    further edges; the base term (seeds' own incident edges, hop 1) carries no such check, so a seed
    itself may be archived and its edges still surface. `distinct on (edge_id) … order by hops` keeps
    each edge once at its shortest hop; both endpoints are joined to `knowledge_node` with
    `created_by = :userId and is_deleted = false and status = 'active'` — the **owner scope on the
    node joins matters independently of the edge filter**: an owned edge may point at a foreign node
    (nothing in the schema forbids it) and that title must never reach the prompt; an archived node
    (W2.6) drops out of every line immediately. Final `order by weight desc, hops asc limit :topK`.
- **`GraphTraversalService`** (`graph/service/`) — `seedsFor(userId, message)`: the message's folded
  search tokens (`ToolText.searchTokens`) with the **leading/trailing non-letter/digit run stripped**
  (that splitter only breaks on whitespace/comma/semicolon, so `"alvás?"` would fold to the
  never-matching `alvas?`; the shared `ToolText` is deliberately left alone), then tokens under 3
  chars dropped so "ma"/"az" can't seed half the graph, **then a small closed Hungarian STOPWORDS
  set filtered out** (`mezo-b3pp.34`) — matched by folded **word-start** containment against every
  active node's title **or summary**; `neighborhood(userId, seeds, maxHops, topK)` — empty seeds ⇒
  empty, no SQL. Injects **no JPA repository at all** (see `activeNodes` above).
  - **Stopwords** (`STOPWORDS`, 29 entries, all pre-folded) — Hungarian filler ("nem", "hogy",
    "volt", …) that is ≥3 chars and so survives the length filter, yet carries no topic of its
    own: node summaries are ordinary Hungarian prose, so a single "nem" in a chatty turn used to
    match most of the graph, and once the seed set is effectively the whole graph the neighborhood
    walk stops answering the question that was asked and degenerates into "the globally strongest
    edges" instead. The list is deliberately kept **closed and small** rather than eager: a
    stopword list that over-reaches silently deletes real turns, which is the harder failure to
    notice — a false seed is visible in the rendered block, a wrongly-dropped one just looks like
    the graph had nothing to say.
  - **Word-start matching** (`startsAWordInFolded`, local to this class) replaces `ToolText.containsFolded`
    **only here** — that shared primitive is deliberately left untouched, because `FuelTools` also
    uses it for a user-typed filter that genuinely wants to match anywhere in the text. Plain
    containment produced false seeds here (`ital` matched `vitalitás`), but exact-word matching
    would be wrong for an agglutinative language, where the stem `alvás` must still reach the
    compound `alvásminőség`. Matching a token only where it STARTS a word is the rule that keeps
    the legitimate prefix case while dropping the false infix one.
  - **Ranked cap** — matching nodes are ordered (title hit outranks summary-only, then more
    distinct matching tokens wins) **before** `graph.max-seeds` (default 8) truncates the list.
    Two nodes tied on both keys are left in `activeNodes`' own `created_at desc, id` row order —
    the ranking sort is stable and deliberately carries no further tie-break stage of its own, so
    recency (a real relevance signal) decides rather than a bare node id; the query's `id`
    secondary key makes that row order TOTAL, so the same turn still always produces the same seed
    set as a genuine guarantee rather than an accident of query-plan or replica luck.
- **`GraphPromptAssembler`** (`graph/service/`) — `assemble(userId, message)` →
  `GraphContext(block, refs)`. Lines: `- <from.title> → <verb> → <to.title> · <erős|közepes|gyenge>`
  (verbs: TRIGGERS *kiváltja*, PRECEDED_BY *megelőzte*, SUPPORTS *támogatja*, CONFLICTS *ütközik
  vele*, RELATES_TO *kapcsolódik*; strength ≥0.7 / ≥0.35 / below). **`PRECEDED_BY` is the one kind
  rendered with SWAPPED endpoints** — `- <to.title> → megelőzte → <from.title>` — because the edge
  reads literally along its direction (`from PRECEDED_BY to` = the FROM-node was preceded by the
  TO-node, i.e. the TO-node happened first; pinned in `GraphEdgeEntity.KIND_PRECEDED_BY`'s javadoc
  and stated in both producer prompts, W2.2's `GraphEdgeStructurer` and W2.3's
  `LifeEventExtractionService`), and the header promises every line reads cause-first. Header
  `[Összefüggések] (…)`,
  cap `mezo.companion.graph.render-max-tokens` (≈3 chars/token, stop at the first overflowing line
  — weight order is the relevance statement). One `GraphNode`/node-id ref per rendered node,
  first-appearance order, **each carrying the traversal's own `fromTitle`/`toTitle` as its
  `label` (`mezo-b3pp.33`)** — no separate lookup, because the label is read off the SAME row the
  line was rendered from. That is deliberate, not just convenient: W2.6's node list is *active*
  nodes only, and archiving is real (retraction `mezo-b3pp.31`, the W2.6 "Archivál" action
  `mezo-b3pp.30`), so an FE label lookup by id would show a raw uuid — or nothing — for a node
  archived after the turn that referenced it, while the carried title still reads correctly.
  **Capped separately at `mezo.companion.graph.max-refs`** (default 6, `@Min(1) @Max(20)`) BEFORE
  reaching the shared `tools.max-refs-per-turn` budget (default 10): `topK` edges (default 8) yield
  up to `2×topK` = 16 node refs (each edge has two endpoints), and graph refs are appended LAST,
  after tool and Memory refs — an uncapped graph turn would fill the whole footer with graph chips
  and truncate refs earlier in the list mid-way. Never throws (IDENT-3: warn + `GraphContext.EMPTY`).
  Conditional on **both** `COMPANION_SWITCH` and `KNOWLEDGE_GRAPH_SWITCH`.
  Note: the rendered block itself still carries up to `topK` (default 8) edges — up to 16 node
  endpoints — while refs cap at 6, so an answer can legitimately cite a relationship whose nodes
  have no chip; that is not a bug to fix. The footer has never been an exhaustive index (the shared
  `tools.max-refs-per-turn` default 10 already truncated it before this slice), and the `[Összefüggések]`
  block is prompt raw material the model is explicitly told not to read out verbatim, not a
  citation list the refs owe full coverage to.
- **`ChatService`** holds the assembler through an `ObjectProvider` — switch off ⇒ no bean ⇒ the
  prompt simply has no block. Order: … → `[Emlékek]` → **`[Összefüggések]`** → `TONE_REMINDER`,
  assembled once for both paths; the GraphNode refs ride `PreparedTurn.recalledRefs` after the
  Memory refs and join the audit AFTER the LLM round. **`ToolCallAudit` dedups on `(kind, id)`
  ONLY, first-wins (`mezo-b3pp.33`)** — a private `RefKey(kind, id)` record keys the
  `LinkedHashMap`, deliberately narrower than `RefsEnvelope.Ref`'s own (now label-inclusive)
  equality: `Ref` became a record whose equality covers `label` too, so a naive
  `LinkedHashSet<Ref>` would stop deduping the instant the same `(kind, id)` arrives once without
  a label and once with one (e.g. a Memory day surfaced by both a tool call and ambient recall, or
  a graph node reached via two edges) and the entity would occupy the cap twice. First-wins keeps
  tool refs — added first, and each one specific provenance for a specific answer — ahead of the
  ambient/graph refs added afterwards, matching `ChatService`'s ordering. FE: `RefTag`/
  `chatRefDisplay` (`frontend/src/features/insights/logic/chatRefs.ts`) prefers `ref.label?.trim()`
  and falls back to the existing id-derived label with `||` — deliberately, not `??`, so an empty
  or whitespace-only label degrades exactly like a missing one rather than rendering a blank chip.
  Rows persisted before this slice have no `label` key at all (not even `null`) and take the same
  fallback path; `MessageRef.label` is optional/nullable and `required` stays `[kind, id]` so old
  and new rows are wire-compatible without a version bump.
- **Tests:** `GraphTraversalQueryIT` (3-hop chain ⇒ ≤2 hops in weight order, undirected walk +
  top-K, cycle termination, archived/soft-deleted excluded, **and both foreign shapes**: a foreign
  edge, plus an OWNED edge pointing at a foreign node), `GraphPromptAssemblerIT` (seed matching
  incl. punctuation-hugged tokens, block + refs, empty cases), `GraphPromptAssemblerTest` (render +
  cap + the `PRECEDED_BY` endpoint swap), `GraphPromptAssemblerRefsCapIT` (`mezo-b3pp.33`: a
  5-node star topology over `graph.max-refs=3` proves the cap AND first-appearance order — hub,
  n1, n2, dropping n3/n4), `ChatServiceGraphBlockIT` (position, refs on wire + row, stream-path
  refs), `ChatServiceGraphBlockFailureIT` (IDENT-3: `@MockitoSpyBean` makes the seed read throw ⇒
  block absent, `degraded` false, **both message rows still committed** — own IT class so the
  spy's forked context can't leak into the others), `ChatServiceGraphBlockSwitchOffIT`,
  `ToolCallAuditTest.testAddRef_shouldStillDedupe_whenTheSameKindAndIdArriveWithDifferentLabels`
  (`mezo-b3pp.33` — the label-breaks-equality trap above, pinned directly), `chatRefs.test.ts`
  (`mezo-b3pp.33` — carried label wins, empty/whitespace label falls back, absent label falls
  back), and `AiMessageJsonbRoundTripIT.testRefs_shouldDeserialiseWithNullLabel_whenTheJsonbPredatesTheLabelField`
  (review fix — writes raw jsonb with no `label` key at all, proving a genuinely pre-migration row
  deserialises with `label = null` rather than only proving the 2-arg constructor's own shape,
  which Jackson serialises with an explicit `"label":null`), and — pinning `seedsFor`'s stopword
  filter, word-start matching and rank-before-cap (`mezo-b3pp.34`) — three sibling classes split
  the way `GraphPromptAssemblerRefsCapIT` splits off from the assembler tests, because the cap
  cases need `graph.max-seeds` overridden per-class via `@TestPropertySource`:
  `GraphSeedSelectionIT` (default `max-seeds`: stopwords ignored, one real word inside an
  otherwise-all-stopword sentence still seeds, a token matches at a word start, the same token
  does NOT match mid-word, seeding is deterministic across repeated runs, an all-unusable-token
  message returns empty), `GraphSeedSelectionRankingIT` (`max-seeds=1`: a title hit outranks a
  summary-only hit and more distinct token hits outranks fewer, once the cap actually bites),
  `GraphSeedSelectionCapIT` (`max-seeds=2`: a large matching set is truncated to the cap).

### W2.5 graph maintenance job (✅ `mezo-b3pp.10`)

- **`GraphMaintenanceService`** (`graph/service/GraphMaintenanceService.java`) — pure arithmetic,
  no LLM call, one `@Transactional runMaintenance(userId)` per user:
  1. **Decay + floor-prune** — every active edge's weight ×= `graph.decay-factor` (default 0.99);
     an edge that decays under `graph.prune-floor` (default 0.05) is soft-deleted in the SAME pass
     (one `findByCreatedByAndDeletedFalse` load, not a second re-query).
  2. **Stale-candidate prune** — candidate nodes (never confirmed/rejected by the W2.3 L2 inbox)
     older than `graph.candidate-max-age-days` (default 30, keyed on `created_at`) are soft-deleted.
  3. **Reinforcement** — a PATTERN node with a `pattern_event` `snapshot` row from the last 24h
     (the nightly `PatternDetectionJob`'s own cadence — "fresh evidence") has EVERY edge touching
     it (both `from` and `to`) bumped by `graph.reinforcement-bump` (default 0.05), capped at 1.0,
     stamping `last_reinforced_at`. An edge pruned earlier in the SAME run is gone from the
     `@SQLRestriction`-filtered edge finders already, so it simply isn't reinforced.
  Returns `GraphMaintenanceResult(edgesDecayed, edgesPruned, candidatesPruned, edgesReinforced)`,
  logged per user by the job.
- **`GraphMaintenanceJob`** (`graph/service/GraphMaintenanceJob.java`) — the `FeedbackLearningJob`
  per-user-isolation idiom, cron `mezo.companion.graph.cron` (03:20, a free dawn slot). Per user,
  FOUR independently try/caught phases, in order: `GraphMaintenanceService.runMaintenance` →
  `GraphPromotionService.reconcile` (W2.2) → `LifeEventExtractionService.extractFor(yesterday)`
  (W2.3) → `PersonExtractionService.extractFor(yesterday)` (**Emberek S4**, `mezo-06o0.3`) — a
  failure in one phase never skips the other three for that user, and never skips the next user.
  Gated on `COMPANION_SWITCH` ∧ `KNOWLEDGE_GRAPH_SWITCH` ∧ its own
  `mezo.techcore.cron.graph-maintenance-job.enabled` switch; the first three collaborators it
  calls all already require at least `KNOWLEDGE_GRAPH_SWITCH`, so direct constructor injection is
  safe for them. `PersonExtractionService` is different — it's gated on `COMPANION_SWITCH ∧
  PEOPLE_SWITCH` instead, so the job reaches it through `ObjectProvider<PersonExtractionService>
  .getIfAvailable()` and simply skips phase 4 when the bean isn't there (the class itself lives in
  `feature/companion/service`, but it writes into the `people` feature's `person`/`mention` tables
  — see [me.md §5.4](me.md) for the extraction logic itself).
- **`GraphPromotionService.reconcile` per-row isolation (mezo-b3pp.32, fixed alongside this
  slice)** — a single pattern/fact/goal's promotion failure is now caught, logged, and skipped
  rather than aborting the rest of that user's sweep; a skip count is logged when any row failed.
  This was flagged as a W2.5 prerequisite during W2.2's review: harmless while nothing scheduled
  `reconcile`, no longer harmless once this job calls it nightly across every user.
- **Config** — `CompanionProperties.Graph` gains `cron` (`@NotBlank`), `candidateMaxAgeDays`
  (`@Min(1) @Max(365)`, default 30), `reinforcementBump` (`@DecimalMin/Max(0,1)`, default 0.05),
  alongside the existing `maxHops`/`topK`/`decayFactor`/`pruneFloor`/`renderMaxTokens`
  /`edgeConfidenceFloor`.
- **Tests:** `GraphMaintenanceServiceIT` (decay math, floor-prune, stale-candidate-prune vs.
  active-node survival, reinforcement on fresh evidence, no reinforcement on stale evidence),
  `GraphMaintenanceJobSwitchOffIT`, plus the new `GraphPromotionServiceReconcileIsolationIT`.
  Phase 4 (`PersonExtractionService`) has its own `PersonExtractionServiceIT` under
  `feature/companion/service` — see [me.md §7](me.md).

### W2.6 Tudástár Kapcsolatok surface (✅ `mezo-b3pp.11`)

- **`GraphEdgeLineRenderer`** (`graph/service/GraphEdgeLineRenderer.java`, new) — the Hungarian
  `cause → verb → effect · strength` line format, extracted out of `GraphPromptAssembler` so the
  prompt block (W2.4) and this REST surface render identically off one source of truth. Holds
  `KIND_VERBS` + `strength(weight)` + `renderLine(kind, fromTitle, toTitle, weight)` (the
  `PRECEDED_BY` endpoint-swap lives here now); `GraphPromptAssembler.renderBlock` calls it instead
  of keeping its own copy — behavior unchanged, `GraphPromptAssemblerTest` untouched.
- **`GraphService.listActiveWithTopEdges(userId)`** (new) — loads the user's active nodes + every
  active edge once (`GraphEdgeRepository.findByCreatedByAndDeletedFalse`, the W2.5 precedent),
  buckets edges by each touching node (both `from` and `to`), and renders the top-3-by-weight
  lines per node via `GraphEdgeLineRenderer`. An edge whose OTHER endpoint is archived/candidate
  is silently dropped — a line naming a node no longer in "current knowledge" would confuse the
  surface. Top-3 is a fixed UI constant (`GraphService.TOP_EDGES_PER_NODE`), not a tuning knob —
  a display concern, not graph behavior.
- **`GraphController.listGraphNodes()`** now calls this instead of the plain `listActive`, setting
  `GraphNodeResponse.topEdges` per node; `listGraphCandidates()` is untouched (default `[]`).
- **FE** — at the time this shipped, `frontend/src/features/me/pages/KnowledgePage.tsx` gained a
  "Kapcsolatok" section: the new dual-mode `useKnowledgeGraphNodes()` (`data/insights/graphHooks.ts`)
  lists active nodes grouped by `GRAPH_KIND_GROUPS` (`data/insights/graph.ts` — the 6 kind labels),
  each rendered as a `KnowledgeGraphNodeCard` (title + optional summary + `topEdges` lines + an
  "Archivál" button wired to `useKnowledgeGraphActions().archive`, `POST .../archive`). Real-mode
  404 (graph switch off) reads as an honest empty list — the `useLifeEventCandidates` idiom — so
  the rest of the page stays fully usable. No graph **visualization** — text lines only (`mezo-2m4`
  stays parked, spec §12). **Since `mezo-ms9a` (2026-09-01) `KnowledgePage.tsx` is deleted** — this
  whole chain (now `KindTileGrid`/`KindNodeList`/`NodeDetailSheet`) lives inside the unified
  Tudástár's `?view=kategoriak` (`features/insights/`, [`insights.md` §2.4](insights.md)); the hook
  and its contract are unchanged, only the consumer moved.
- **Acceptance:** `GraphApiIT` confirms `topEdges` is wired through HTTP; `GraphServiceIT` covers
  the bucketing (weight-desc, capped at 3, edges to archived nodes excluded); the original FE
  coverage (`graphHooks.test.tsx`/`KnowledgePage.test.tsx` — mock, real, 404,
  archive-removes-from-list) now lives in `KnowledgeListPage.test.tsx`'s `?view=kategoriak` cases
  (`mezo-ms9a`).

### Emberek S5 — gráf-tükör (✅ `mezo-06o0.4`)

The active person becomes a first-class PERSON node (`GraphPromotionService.syncPerson`/
`retractPerson`, `GraphPromotionListener`'s two new hooks, and `reconcile`'s person loop, all
documented in W2.2/W2.5 above), and this is the second write path: the nightly proposal of
**typed event edges** for a person's PERSON node, plus the FE surface that reads them back. Full
person-facing narrative (why a candidate is never promoted, what the detail-page card looks like)
lives in [me.md §5.4](me.md); this section is the companion-side mechanics.

- **`PersonExtractionService.linkPersonEdges(userId, day, dayMentions)`** (`feature/companion/
  service/PersonExtractionService.java`) — the event-edge pass `LifeEventExtractionService`'s
  sibling never had: runs in **its own `@Transactional`**, called through the self-proxy
  (`linkPersonEdgesSafely`) strictly AFTER that night's `persistNight` has already committed —
  the enrichment/candidate work above never shares a transaction with graph writes, so a graph
  hiccup can't roll back a mention enrichment. For each of the day's mentioned people (first
  mention per person, `dayMentions` order — a byproduct of the same query the enrichment pass
  already ran, no second lookup), it structures edges via `GraphEdgeStructurer` when — and only
  when — ALL of these hold:
  - the person has an **active** PERSON node (`GraphService.findBySource(userId,
    GraphPromotionService.SOURCE_PERSON, personId)`, `status = ACTIVE`) — a candidate or archived
    person is skipped, nothing to link;
  - the node has **no edges yet**, in either direction (`edgesFrom`/`edgesTo` both empty);
  - the node's `meta` carries **no `edgeStructuredOn` marker** — see below.
  - **Daily cap `MAX_EDGE_LINKS_PER_NIGHT = 3`**: at most 3 people get a structuring attempt per
    night, in `dayMentions` order; the rest wait for a later night they're mentioned again.
  - **Evidence** is `sourceKind = "mention"` with the triggering mention's own id — the edge
    traces back to the exact sentence that put the person in that day's list, the same evidence
    idiom `LifeEventExtractionService` uses for its own edges.
  - **At most once, ever, per person — not gated on edge count alone (code-review fix).** A pure
    "has this person got edges yet" check would retry a person on every future mention if the
    structurer's answer was ever empty or entirely below the confidence floor — wasted LLM spend,
    and a few permanently edge-less people could crowd the deterministic `dayMentions` ordering
    and starve genuinely untried people out of the nightly cap forever. So `linkPersonEdges`
    writes `edgeStructuredOn = <today's ISO date>` into the node's `meta` (via `GraphService
    .putMeta`) after **every** attempt, regardless of outcome — the gate is
    `!hasMarker && edgesFrom.isEmpty() && edgesTo.isEmpty()`, and a person is structured at most
    once for the whole lifetime of that node.
  - **Isolation is deliberately NOT complete.** `GraphEdgeStructurer`'s own contract lets a
    `DataAccessException` from the edge upsert escape uncaught, so the caller's transaction is
    left properly rollback-only. Because `linkPersonEdges` wraps the WHOLE nightly loop in one
    `@Transactional`, that same exception propagates out of `linkPersonEdges` itself (through the
    self-proxy call in `linkPersonEdgesSafely`, degrading to `0`) rather than being swallowed
    per-person — the whole night's edge pass gives up, but the already-committed `persistNight`
    result (IDENT-3) and the caller's own transaction (a separate one) are untouched. Any OTHER
    exception (a non-DB failure structuring one person) stays per-person isolated; the loop moves
    on to the next person.
  - `PersonExtractionResult` gained a third field, `edgeLinked` — how many people the structuring
    was **attempted** for that night, not how many edges were created (a zero-edge attempt still
    counts, since it still spent the marker and closed the "try again" gate).
  - `ObjectProvider<GraphService>`/`ObjectProvider<GraphEdgeStructurer>`: `KNOWLEDGE_GRAPH_SWITCH`
    is independent of the `COMPANION_SWITCH ∧ PEOPLE_SWITCH` pair that gates
    `PersonExtractionService` itself, so with the graph off these beans simply don't exist and
    `linkPersonEdges` returns `0` immediately — the enrichment/candidate work above is completely
    unaffected.
- **`PersonGraphEdgeSource`** (`feature/people/PersonGraphEdgeSource.java`) — a
  **fogyasztó-tulajdonú port** (ADR 0012, the `NarrativeNoteSource` idiom): `people` needs to show
  a person's graph edges on the detail page, but `people` must never depend on `companion` — the
  reverse dependency (`companion` → `people`, e.g. `PersonExtractionService` reading
  `PersonRepository`) already exists, and the other direction would close a cycle. So `people`
  declares the shape it needs (`Edge(nodeKind, title, relationHu, strength)`,
  `edgesByPerson(userId): Map<UUID, List<Edge>>`) and the graph side implements it.
  `PeopleService` requests it via `ObjectProvider` and works with an empty map when the bean is
  absent.
- **`PersonGraphEdgeAdapter`** (`graph/service/PersonGraphEdgeAdapter.java`, implements
  `PersonGraphEdgeSource`) — **lives in `feature/companion/graph/service`, not somewhere more
  neutral, because `GraphEdgeLineRenderer` is package-private** to that package: the adapter
  reuses `GraphEdgeLineRenderer.KIND_VERBS`/`strength(weight)` for the exact same Hungarian
  vocabulary the `[Összefüggések]` prompt block and the Tudástár `topEdges` surface already use,
  and the only way to call a package-private static without changing its visibility is to sit in
  the same package. `@ConditionalOnProperty(KNOWLEDGE_GRAPH_SWITCH)` — off, the bean doesn't
  exist, `people` falls back to its empty-map default. For each active PERSON node it collects
  `edgesFrom` + `edgesTo`, **sorts on the raw edge weight** (before mapping to the coarse
  strong/medium/weak `Edge.strength` string — sorting after mapping would lose the real order),
  drops any edge whose OTHER endpoint isn't itself an active node (an edge naming an
  archived/candidate node would mislead, not inform — the same rule `listActiveWithTopEdges`
  applies), and caps at `MAX_EDGES_PER_PERSON = 3` — the same display cap as the Tudástár's
  `topEdges`.
- **`PersonResponse.graphEdges`** — a **required, never-null** list field (empty when there is
  nothing to show, never absent), sourced from `PersonGraphEdgeAdapter.edgesByPerson` and merged
  into `PeopleService`'s bootstrap response. With the graph switch off, every
  `PersonResponse.graphEdges` comes back `[]` — the FE section built on it (`PersonDetailPage`'s
  "Kapcsolt események · gráf" card, [me.md §5.4](me.md)) simply doesn't render, with no other
  effect on the page.
- **Tests:** `PersonExtractionServiceIT`'s edge-suggestion branch covers the gate combinations
  (no node, archived node, already-edged node, already-attempted marker, the nightly cap);
  `syncPerson`/`retractPerson`/the reconcile person loop live in their own
  `GraphPromotionPersonIT` (`feature/companion/graph`), deliberately split out rather than grown
  onto the existing `GraphPromotionServiceIT`; `PersonGraphEdgeAdapter` has its own
  `PersonGraphEdgeAdapterIT`; FE coverage is `PersonDetailPage.test.tsx` in both modes.

### Emberek a chat pillanatképben (✅ `mezo-x6oa`)

Spec: [`2026-09-02-emberek-chat-snapshot-design.md`](../superpowers/specs/2026-09-02-emberek-chat-snapshot-design.md).
Until this slice the companion chat knew nothing of the user's people — names only leaked in
opportunistically through the `[Összefüggések]` graph block, for graph-promoted persons, with no
weekly direction. Now every CHAT turn's snapshot carries an **`[Emberek]`** block:

- **`PeopleService.chatContext(userId, today)`** (`feature/people/service`, read-only) — flat
  `PersonChatContext(name, relationshipHu, mentionsThisWeek, lastMentionAt, direction,
  directionReason)` rows for ACTIVE persons only (candidate/archived never), newest mention
  first, unmentioned last by name, no limit. The weekly count and the direction come from the
  SAME private helper the bootstrap uses, so the chat and the Emberek hub can never disagree.
  Since `mezo-cc6x` this reads `MentionRepository.findSignals` — a `MentionSignal(personId, ts,
  tone, intensity)` projection, not managed `MentionEntity` rows — so every chat turn's read
  skips the free-text `excerpt` and never adds dirty-checked entities to `prepareTurn`'s
  read-write persistence context.
- **`PeopleSnapshotBlock`** (`feature/companion/service`, COMPANION_SWITCH) renders it:
  header `[Emberek] (aktív kör, utolsó említés szerint, max N)`, one line per person
  `<név> — <kapcsolat> · <k× e héten | e héten nem került szóba> · <felfelé (indok) | lefelé
  (indok) | indok>`, capped at `snapshot.people-max-persons`. `PEOPLE_SWITCH` is independent of
  the companion switch, so the `PeopleService` is read through `ObjectProvider` (the
  `HabitService` precedent) — absent bean, empty circle or any `RuntimeException` all render
  `[Emberek] nincs adat`. IDENT-3, precisely: a NON-DB `RuntimeException` degrades gracefully and
  the turn continues; a `DataAccessException` from `chatContext` (its own `@Transactional
  (readOnly = true)` joins `prepareTurn`'s transaction) leaves the Hibernate session
  rollback-only regardless of this catch, so the turn still dies at commit — the same hazard
  `MemoryEmbeddingAnnQuery` exists to work around. `people-max-persons = 0` omits the block
  entirely. Raw quotes, `knownFacts`, `notes` never ride.
- **Chat variant only:** `ContextSnapshotAssembler.render` inserts it after `[Napi gyakorlat]`;
  `renderWithoutBiometrics` (the morning message) deliberately does not — that would be the
  companion bringing people up unprompted.
- **Grounding rule** in `ChatService.SYSTEM_PROMPT` (`[Mit szabad állítani]`): the model may
  recognise a mentioned name and refer to the relationship and this week's direction, must not
  invent anything else about a third party, and must not raise people on its own.
- No new port, no new slice edge: `companion → people` already existed (`ChatMentionListener`).
- Tests: `PeopleChatContextIT`, `PeopleSnapshotBlockTest`, `ContextSnapshotAssemblerIT`
  (+2: block present in `render`, absent in `renderWithoutBiometrics`), `CompanionPropertiesIT`.

### Backend tables (W3.2 consolidation ladder, ✅ `mezo-b3pp.13`)

Migration `202608231400_mezo-b3pp.13_create_period_summary.sql` (in `1.0.0_master.yml`) — the
memory's second and third rungs above `daily_summary` (spec §4.3/§7.2).

- **`period_summary`** — `id uuid pk`, `created_by uuid fk→app_user(id) ON DELETE CASCADE`,
  `granularity varchar(5)`, `period_start date`, `summary_text text`. Constraints:
  `pk_period_summary_id`, `fk_period_summary_created_by_app_user_id`,
  **`uq_period_summary (created_by, granularity, period_start)`** — a period can never be
  summarized twice —, `ck_period_summary_granularity` (`week` | `month`). Index
  `idx_period_summary_created_by_granularity (created_by, granularity, period_start desc)`.
  `PeriodSummaryEntity extends OwnedEntity` (soft delete + `@SQLRestriction`).
- **`period_start` is the identity, not the end** — the ISO Monday for a week, the 1st for a
  month. It is also the embedded unit's `occurred_on`, so the `[Emlékek]` line names a period a
  reader can place („2026-08-17 (heti összefoglaló): …") and the recency decay treats the whole
  period as that one date.
- **`PeriodSummaryService`** (`companion/service/`) — the `DailySummaryService` shape one rung up:
  PURE-CODE gather (dated lines of already-generated prose) → ONE **cheap-tier** call
  (`WEEKLY_MARKER` / `MONTHLY_MARKER`, `LlmCallContext("companion_consolidation", "weekly"|"monthly")`).
  Cheap tier is deliberate: nothing new is reasoned out here, prose is shortened — the smart tier
  stays for real synthesis (memoir, quarterly pass). `generateWeek`/`generateMonth` return the
  EXISTING row untouched (no LLM call) and `null` for a period with no source rows or a blank
  answer — an empty rung would shadow real memory with nothing.
- **Bottom-up only** — a month is condensed from its **week rungs**, never straight from days, so
  a month can only exist above weeks that exist.
- **`ConsolidationJob`** (`companion/service/`) — two `@Scheduled` methods under
  `COMPANION_SWITCH` ∧ `mezo.techcore.cron.consolidation-job.enabled`: weekly **Monday 03:30**
  (after that dawn's 02:20 daily summaries, so the just-finished week is complete at day level) and
  monthly **1st 03:50** (after the same dawn's weekly rung). Only FINISHED periods are touched —
  the newest week is the one that ended before the current one. Per-user AND per-period isolation
  (the `DailySummaryJob` idiom); the backfill window (`backfill-weeks` / `backfill-months`) is both
  the catch-up and the one-time history backfill.
- **Embedding** — `MemoryEmbeddingWriter.writePeriodSummary` (the single write path keeps its
  single-writer rule) maps `week`→`weekly_summary`, `month`→`monthly_summary` and re-embeds IN
  PLACE on text change; an UNCHANGED text short-circuits before the provider call, so re-offering
  the whole backfill window every night costs nothing. Both kinds were already legal in
  `ck_memory_embedding_kind` (W1.1 carried the batch).
- **Recall shadowing, nothing deleted** — `PromptMemoryAssembler`'s daily-summary group is queried
  with an `occurred_on >= today - ambient-recall.weekly-shadow-days` metadata floor
  (`MemoryEmbeddingAnnQuery.nearestInKinds(..., notBefore)`, a second SQL constant rather than a
  nullable predicate), while the new `weekly_summary`+`monthly_summary` group is queried
  unfiltered under its own cap (`ambient-recall.period-summary.cap` since W3.3). The fine-grained
  rows and their vectors stay in the store untouched (spec §12) — shadowing changes what recall
  ASKS for, never what exists.
- **Fake dispatch** — `FakeCompanionLlm` answers the two markers with the `[fake-period:…]`
  sentinel (planted in a source narrative, the memoir-sentinel channel) or the defaults
  `FAKE-HETI-KONSZOLIDACIO` / `FAKE-HAVI-KONSZOLIDACIO`.

### W4.3 pragmatic profile node + injection (✅ `mezo-b3pp.17`)

Spec §8.3 — one weekly smart-tier synthesis of "hogyan érdemes Daniellel beszélni" (how it is
worth talking to Daniel), injected into every turn as its own prompt block.

- **Not a new table** — the singleton `knowledge_node(kind=INSIGHT, source_kind='profile',
  source_id=userId)` (spec §4.2: "not a separate table"). **The user id as `source_id` is
  load-bearing:** `uq_knowledge_node_source` (W2.1) is a PARTIAL unique index (`where source_id is
  not null and is_deleted = false`) — a null `source_id` would silently drop the DB-level singleton
  guarantee, letting a second profile row slip in. No migration; no API contract change
  (`GraphNodeResponse.sourceKind` already existed since W2.1).
- **`ProfileAssembler.rebuild(userId, anchorQuarter)`** (`profile/service/`) gathers, in pure code: the
  rollup scopes for **only the currently configured feedback-learning window**
  (`FeedbackRollupRepository.findByCreatedByAndWindowDaysAndDeletedFalseOrderByScopeAsc(userId,
  feedbackLearningProperties.windowDays())` — fixed `mezo-b3pp.35`, item 3), the 👎-reason (style)
  histogram off the `style` scope's `bySurface` map, up to `maxDecisions`
  reviewed `decision_entry` rows newest-review-first (`DecisionEntryRepository
  .findByCreatedByAndReviewedAtIsNotNullAndDeletedFalseOrderByReviewedAtDesc`), and up to
  `maxGraphNodes` active PATTERN/PREFERENCE node titles (`GraphService.listActive`, the profile
  node itself excluded — it must never eat its own output). **Since W5.3 (`mezo-b3pp.20`) a
  fourth gather joined this list**: two more `DecisionEntryRepository` calls, one per quarter,
  over the half-open `[quarterStart, quarterStart + 3 months)` window
  (`decisionQuality`/`quarterLine`), folded into the payload as the `DÖNTÉSI MINŐSÉG` section
  — full mechanics in the W5.3 subsection below (§4). Those two quarters are
  `anchorQuarter` and `Quarters.previous(anchorQuarter)`: **the anchor is a required argument, not
  derived from `LocalDate.now()`** (final-review fix F1 — the two callers legitimately want
  different anchors, and there is no defaulting overload for a third to get wrong). Because of
  this gather, `renderPayload` is "pure code" only in the NFR-M-4 sense — no model is consulted
  anywhere in the arithmetic — and NOT a pure function of its arguments: it cannot be called
  without a DB. ONE smart-tier
  `CompanionLlm.completeSmart` call, tagged `LlmCallContext("companion_profile", "assemble", null,
  null)`, prompt marker `ROLAD-TANULTAM` (`FakeCompanionLlm` dispatch key in tests).
- **Spec interpretation (recorded explicitly, not a silent deviation):** §8.3 asks the assembler to
  distil "(+ RECOVERY-related graph nodes when W2 live)". There is **no `RECOVERY` node kind** in
  the shipped graph (kinds: `PATTERN`/`PREFERENCE`/`GOAL`/`LIFE_EVENT`/`SEASON`/`INSIGHT` — W2.1).
  The faithful reading taken here is "what the graph already knows about how he works" = the active
  PATTERN and PREFERENCE node titles, profile node excluded. Reasoning: PATTERN/PREFERENCE are the
  two kinds the graph promotes from repeated behavior and stated likes/dislikes — the closest thing
  to "how he works" the shipped taxonomy has — while GOAL/LIFE_EVENT/SEASON describe WHAT is
  happening to him, not HOW to talk to him, and INSIGHT is the profile's own kind.
- **Honest absence** — zero feedback signal AND zero reviewed decisions AND zero graph nodes ⇒ no
  LLM call, no node write, any existing profile left untouched (`ProfileAssembler.rebuild` returns
  `Optional.empty()` before the payload is even rendered). A blank model answer is the same
  no-op — never a node overwritten with an invention.
- **The payload reads only the CONFIGURED window's rollup rows** (`mezo-b3pp.35`, item 3,
  `ProfileAssemblerWindowHeaderIT` / `ProfileAssemblerIT
  .renderPayload_readsOnlyTheConfiguredWindow_whenRetiredWindowRowsExist`) — `feedback_rollup`'s
  unique key is `(created_by, scope, window_days)` and nothing deletes a row when
  `feedback-learning.window-days` changes, so a retired window's rows outlive the config that wrote
  them. Reading unfiltered would emit two contradictory `surface:<kind>` lines per scope under one
  `VISSZAJELZÉSEK` header (the number itself now derived from `FeedbackLearningProperties
  .windowDays()`, never hardcoded 30). **`ProfileAssembler` reads the SAME property
  `FeedbackLearningService` writes rows with on purpose** — filtering on a different knob would
  compile fine and silently match nothing, emptying the whole profile, which is a worse failure
  than the bug it fixes. **`QuarterlyReviewService.appendFeedback` deliberately does NOT filter
  the same way** — it reads every window unfiltered and labels each row with its own window
  instead, so seeing `surface:chat_message` twice with two window labels in a quarterly payload
  after a window-days change is that builder working as designed, not this fix leaking.
  **Operational edge (future window changes only, not this deploy):** `window-days` has always
  been 30 and the nightly rollup cron (03:10) normally finishes well before the weekly profile
  cron (Monday 03:45), so a fresh window's rows normally exist by read time; but a FUTURE window
  change landing in that ~35-minute gap, or `feedback-learning-job.enabled=false` while the
  profile job still runs, leaves the new window with zero rollup rows — and since `decisions`/
  `nodes` are typically non-empty, `rebuild`'s honest-absence gate does NOT fire, so it overwrites
  the existing profile with a strictly poorer payload. When decisions and nodes are also empty the
  gate does fire and the old profile is left untouched, so there is no silent data loss.
- **`feedbackSignals` sums `surface:*`-prefixed rows only** (`mezo-b3pp.35`, item 4,
  `ProfileAssemblerIT.feedbackSignals_countsEachVerdictOnce_whenAFeedMessageIsRolledUpTwice`) —
  the scope taxonomy is `style`, `surface:<artifact_kind>`, `feed:<feed_kind>`,
  `intervention:<key>`; `surface:*` is the complete, non-overlapping partition of every verdict
  (exactly one row per artifact kind), while `feed:*`/`intervention:*` are REFINEMENTS of a subset
  of it — a `feed_message` verdict lands in both `surface:feed_message` and its `feed:<kind>` row.
  Summing every scope double-counted it. This affects only the `meta.profile.feedbackSignals`
  number, not the `signals == 0` skip gate: every `feed:*`/`intervention:*` row is built by
  filtering the SAME window's verdicts down to `artifactKind == feed_message`
  (`FeedbackLearningService.computeRollups`), so a nonzero feed or intervention row always implies
  a nonzero `surface:feed_message` row from the same run — double counting could only inflate an
  already-nonzero total, never manufacture a nonzero total out of an all-zero one. It never changes
  which rollup LINES render in the payload either, since the rendered VISSZAJELZÉSEK lines already
  iterate every scope regardless. **The invariant to
  watch:** `MessageFeedbackEntity.KIND_WEEKLY_REVIEW` is declared but is not in
  `FeedbackLearningService.SURFACE_KINDS` (`mezo-b3pp.40`) — wiring that kind up for real without
  adding it there would make its verdicts land in no `surface:` row at all, silently UNCOUNTED, the
  mirror image of the double-count this item fixed and just as invisible.
- **The cap applies twice** — `ProfileProperties.renderMaxTokens` (**400**, spec §8.3, floor raised
  `@Min(50)` → `@Min(200)` by `mezo-b3pp.35` item 5) caps the
  prose at STORE time (`ProfileAssembler.cap`, `CHARS_PER_TOKEN = 3`, same estimate as
  `[Emlékek]`/`[Összefüggések]`) and again, redundantly, at RENDER time
  (`ProfilePromptAssembler.render`) — so Tudástár's "Rólad tanultam" card can never show more prose
  than the model was actually given, even if the config value changes between a write and a read.
  The cut lands on a word boundary with a trailing `…`. **The floor moved because the header alone
  costs tokens**: `ProfilePromptAssembler.PROFILE_HEADER` is 142 chars ÷ `CHARS_PER_TOKEN` (3) ≈ 48
  tokens ceiling-rounded, so the old floor of 50 left just 2 tokens for actual prose — not a
  violation of anything today, but zero headroom for the header to grow by even one clause. 200
  leaves over 150 tokens of prose room at the floor, still well under the shipped 400 default.
- **`upsertNode` does not touch status** (W2.2 owns its own status rules), so the assembler
  explicitly re-activates the node after the upsert: an archived profile is revived by the very
  next weekly run — the "reset what you think of me" recovery path spec §8.3 promises, without a
  dedicated endpoint.
- **`ProfileAssemblerJob`** (`profile/service/`) — one `@Scheduled` method, weekly **Monday 03:45**
  (`0 45 3 * * MON`), deliberately AFTER the 03:10 feedback rollups and the 03:30 weekly
  consolidation rung — it reads both, so it must run last in that dawn window. Gated on
  `COMPANION_SWITCH` ∧ `KNOWLEDGE_GRAPH_SWITCH` ∧
  `mezo.techcore.cron.profile-assembler-job.enabled` (`PROFILE_ASSEMBLER_JOB_SWITCH`); per-user
  try/catch (the `GraphMaintenanceJob`/`DailySummaryJob` idiom — one bad user never kills the run).
  Direct injection of `ProfileAssembler` into the job is safe because the job requires the same two
  feature switches the assembler does, plus its own cron switch. It anchors the rebuild on
  `Quarters.startOf(LocalDate.now())` — the quarter it is standing in, which is exactly what the
  assembler used to derive for itself, so this job's behaviour is unchanged by the W5.3
  final-review anchor fix. **Its switch reaches further than this bean**: the W5.3 quarterly job
  reads `PROFILE_ASSEMBLER_JOB_SWITCH` by THIS bean's presence and skips its own phase-2 rebuild
  when it is absent (§4).
- **`ProfilePromptAssembler.render(userId)`** — renders the `[Rólad tanultam]` block, positioned
  in the canonical prompt order right after the fact blocks (top-N facts + the pattern-facts
  acknowledgment) and BEFORE `[Emlékek]` — see the updated `assembleSystemPrompt` order in §3. Reads
  the ACTIVE node only (an archived one renders `""`, the explicit "forget what you think of me"
  lever), is capped, and **never throws** (IDENT-3): a `RuntimeException` logs a warn and yields
  `""`, so a profile-block failure never breaks a turn. `""` also when the bean is absent
  (`COMPANION_SWITCH`/`KNOWLEDGE_GRAPH_SWITCH` off — `ChatService` holds it via `ObjectProvider`,
  the `GraphPromptAssembler` idiom). **The never-throws contract now has a failure-path IT**
  (`mezo-b3pp.35`, item 2, `ProfilePromptAssemblerFailureIT
  .testRender_shouldReturnEmptyBlock_whenTheProfileReadFails` — its own IT class, same
  `@MockitoSpyBean`-forks-the-context reasoning as `ChatServiceGraphBlockFailureIT`): the catch is
  correct today, so nothing else in the suite would fail if a future refactor deleted it. The test
  exists so that refactor fails loudly instead — the profile block is optional, the surrounding
  turn is not.
- **`ProfileMetaEnvelope`** (`profile/entity/`) — the node's typed `meta.profile` payload
  (`generatedAt`, `feedbackSignals`, `reviewedDecisions`, `graphNodes`): what the synthesis was
  built from, so a surprising profile can be explained without re-running the job. Hand-rolled
  `toMeta()`/read-back under its own `META_KEY`, the `GraphProposedEdge` idiom. **This is a
  deliberate write-only forensic record** — nothing reads `meta.profile` back in production by
  design; a surprising profile is meant to be explained by reading the JSON straight out of the DB,
  not by re-running the job to reproduce it. Do not read this as dead code, and do not read the
  card's missing "when was this generated" affordance as a gap here either: the two are split on
  purpose — `mezo-b3pp.39` tracks surfacing the profile's age on the Tudástár card via
  `GraphNodeEntity.updatedAt` (a contract-first vertical of its own, unrelated to this envelope's
  diagnostic counts), so neither half of the original finding gets re-filed later against the
  wrong one.
- **W5.3 (`mezo-b3pp.20`) calls `ProfileAssembler.rebuild` too**, after the quarterly pass — the
  public method is deliberately reusable, not job-private — passing the just-finished quarter as
  the anchor, and only when `PROFILE_ASSEMBLER_JOB_SWITCH` is on (§4, "The anchor quarter" and
  "Phase 2 also honours `PROFILE_ASSEMBLER_JOB_SWITCH`").

### Backend tables (W5.1 flag log, ✅ `mezo-b3pp.18`; widened S2 `mezo-d58h.2`)

Migration `202608241200_mezo-b3pp.18_create_companion_flag_log.sql` (in `1.0.0_master.yml`) — the
append-only audit trail behind the composite-flag evaluator (spec §4.5/§9.1). S2 migration
`202609031200_mezo-d58h.2_flag_key_logging_gap_missed_workouts.sql` widens
`ck_companion_flag_log_flag_key` to the two new keys.

- **`companion_flag_log`** — `id uuid pk (gen_random_uuid())`, `created_by uuid fk→app_user(id) ON
  DELETE CASCADE`, `is_deleted`, `created_at timestamptz`, `flag_key varchar(24)`, `source
  varchar(6)`, `payload jsonb` (nullable). Constraints: `pk_companion_flag_log_id`,
  `fk_companion_flag_log_created_by_app_user_id`, `ck_companion_flag_log_flag_key`
  (`sustained_stress | sleep_debt | momentum_at_risk | recovery_needed | all_healthy |
  logging_gap | missed_workouts` — since S2), `ck_companion_flag_log_source` (`write | sweep`).
  Index `idx_companion_flag_log_user_key_at (created_by, flag_key, created_at desc)` — the
  cooldown gate's key.
- **One row per RAISE, never per evaluation.** The evaluator is deterministic, so `FlagService`
  appends only when a flag is both TRUE and past its own cooldown; a quiet evaluation (nothing
  true, or everything still cooling down) writes nothing. Nothing ever updates a row — no history
  to amend, only new raises to append.
- **`payload` is the typed jsonb `FlagPayloadEnvelope`** (`flags/entity/FlagPayloadEnvelope.java`
  — the `FeedbackRollupStatsEnvelope` precedent: one record, seven all-nullable nested-record
  fields, a static factory per shape). Exactly one of `sustainedStress`/`sleepDebt`
  /`momentumAtRisk`/`recoveryNeeded`/`allHealthy`/`loggingGap`/`missedWorkouts` is non-null per
  row, carrying BOTH the rule's config thresholds and the observed values at raise time (day-keyed
  maps, `LocalDate.toString()` keys — jsonb object keys are text), so the raise is reproducible
  from the log alone without re-running the evaluator.
- **No FK from `payload` to anything** — it freezes values read from other features' tables at
  raise time; those source rows can later change or be deleted without touching this row (the
  `message_feedback`/`feedback_rollup` dangling-reference precedent, spec §8.1).

### W5.2 intervention delivery (✅ `mezo-b3pp.19`, spec §9.2) — JITAI-lite

**Not a new companion table** — the flag log above is read only for its EVENT (below); the
delivered card itself is a sixth `companion_message` kind, `intervention`, owned by
`feature.proactive` and documented from that side ([`proactive.md`](proactive.md) §3/§4 — the
CHECK widening migration, the envelope's `interventionKey`, and why it is excluded from the feed's
cron miss-recovery). This subsection covers what companion owns: the raise→event trigger, the
selection algorithm, the two shipped decisions, and the config shape.

**Delivery chain (raise → event → selection → card → anchored push):**

1. `FlagService.evaluateAndLog` writes a `companion_flag_log` row (W5.1, above) and, in the SAME
   transaction, `eventPublisher.publishEvent(new FlagRaisedEvent(userId, flagKey, source))` — one
   event per raise that actually got WRITTEN (post-cooldown), never per evaluation.
2. `feature.proactive.service.InterventionEventListener` (`@Async
   @TransactionalEventListener(phase = AFTER_COMMIT)` — the `CompanionMessageEventListener`
   template) reacts only once the raise durably committed; a rolled-back raise delivers nothing.
3. `InterventionService.deliverForFlag(userId, flagKey)` — pure code, no LLM call anywhere in this
   path (the text is config, `textHu`) — runs the selection below and, if it picks an entry,
   `saveAndFlush`s the `companion_message` card.
4. `AnchorResolver.interventionAnchors` (not this feature — [`_platform-notifications.md`](_platform-notifications.md)
   §3d) anchors a push on the card's own generation minute, quiet-hours-deferred, gated on the
   picked entry's `channel`.

**Selection math** (`InterventionService.deliverForFlag`, `feature/proactive/service/`):

- Candidates = every `mezo.companion.interventions[]` entry whose `flag` matches the raised flag,
  minus any entry still inside its OWN `cooldownHours` — the cooldown gate reads the **envelope
  keys of recent `intervention`-kind cards** (`findByCreatedByAndKindAndGeneratedAtAfter`, filtered
  in memory at single-user volumes, spec §12), not `companion_flag_log` — see the resolved W5.1
  gotcha in §9 below.
- Pick = **max W4.2 effectiveness** — `feedback_rollup` scope `intervention:<key>`, `up/total`
  (§4 above); a key with **no votes yet gets `OPTIMISTIC_PRIOR = 1.5`**, strictly above any real
  ratio (max 1.0), so an untried entry is always tried before a proven-mediocre one — the spec's
  "unseen entries get optimistic default," exploration-before-exploitation, not a tunable knob.
  Ties keep **config order** (`Stream.max` over a strict comparator keeps the FIRST max).
- No eligible candidate (library empty for the flag, or every entry for it is in cooldown) ⇒
  delivers nothing, logged at info — never a fallback or a generic text.

**The two shipped decisions:**

- **`channel: feed | push | both` — and `push` behaves exactly like `both` (user decision,
  2026-08-24).** The card always exists (it is the „Segített?" home and the push anchor), so a
  push-only entry with no card would have nothing to anchor on and nowhere for feedback to land;
  `channel=feed` therefore means "card only, no push anchor" and `channel=push`/`channel=both` both
  mean "card + push" — `AnchorResolver.interventionAnchors` treats `feed` (or a since-retired key
  not in the library at all) as "no anchor, ever" and anything else as anchor-eligible.
- **One card per day, first raise wins (anti-nagging).** `deliverForFlag` checks
  `findByCreatedByAndMessageDateAndKind(userId, today, KIND_INTERVENTION)` before doing anything
  else — a SECOND raise of ANY flag the same day (the same flag re-raising, or a different flag
  raising after the first delivered) delivers nothing, logged at info. This is the partial unique
  index's (`uq_companion_message_created_by_date_kind`) natural consequence for this kind, not a
  separate guard — see [`proactive.md`](proactive.md) §4.

**Config** (`mezo.companion.interventions` — `CompanionProperties.Intervention`, §4 config keys
below) — a validated list, one record per library entry:
`{key (^[a-z0-9_]{1,27}$, unique — pinned by InterventionConfigIT), flag (one of the five W5.1
flag keys), channel (feed|push|both), textHu (≤500 chars, the card's ONLY content — never an LLM
call), cooldownHours (1–8760), quietHoursExempt (boolean)}`. Ships with **6 entries** covering all
five flags (two for `sustained_stress`: `stress_reset`/both/48h and `stress_talk`/feed/72h; one
each for `sleep_debt` (`sleep_recover_tonight`), `momentum_at_risk` (`momentum_small_win`),
`recovery_needed` (`recovery_rest_day`), all `channel: both`; and `all_healthy`
(`healthy_celebrate`, `channel: feed`, `cooldownHours: 168` — a weekly celebration, not a daily
nag)). The feature switch is `mezo.feature.intervention.enabled`
(`FeaturesConfiguration.INTERVENTION_SWITCH`) — every W5.2 bean (`InterventionService`,
`InterventionEventListener`) is `@ConditionalOnProperty` on `COMPANION_SWITCH` ∧ `PROACTIVE_SWITCH`
∧ `INTERVENTION_SWITCH`; off ⇒ the beans don't exist, `FlagService` still logs raises and publishes
events (nothing is listening), and `evaluateAndLog` writes the flag but no card follows
(`InterventionSwitchOffIT`).

### W5.3 quarterly deep pass (✅ `mezo-b3pp.20`, spec §9.3)

The season-over-season read: once a calendar quarter finishes, ONE smart-tier pass compares it
against the one before it and proposes 0..N `SEASON` **candidates** into the existing L2 inbox,
then re-runs the profile so its decision-quality trend picks up the quarter that just closed.
Lives in its own package, `feature/companion/quarterly/`, alongside — not inside — the
profile/graph packages it reads from and writes into.

**What runs when.** `QuarterlyReviewJob.run()` — cron `0 0 4 1 1,4,7,10 *` (server zone: the 1st
of Jan/Apr/Jul/Oct, 04:00) — runs AFTER that same dawn's 03:50 monthly consolidation rung, which
is what completes the quarter's LAST month and is therefore this job's own input; every other
dawn slot (02:20/02:40/03:00 SUN/03:05/03:10/03:20/03:30 MON/03:40/03:45 MON/03:50) stays clear.
Job switch `mezo.techcore.cron.quarterly-review-job.enabled`
(`FeaturesConfiguration.QUARTERLY_REVIEW_JOB_SWITCH`); the bean itself is
`@ConditionalOnProperty`-gated on `COMPANION_SWITCH` ∧ `KNOWLEDGE_GRAPH_SWITCH` ∧ its own switch —
both collaborators (`QuarterlyReviewService`, `ProfileAssembler`) already require the first two
themselves, so direct constructor injection is safe: whenever this bean exists, so do theirs.

**Phase 1 — season candidates (`QuarterlyReviewService.runFor`).** Reads the just-finished
quarter's `period_summary` MONTH rungs, the previous quarter's rungs, and the W4.2 feedback
rollups; makes ONE smart-tier call
(`LlmCallContext("companion_quarterly", "season_candidates", "quarter", null)`) asking the model
to name the recurring arcs the quarter reads as against the one before it, and writes 0..N
`knowledge_node(kind=SEASON, status=candidate, source_kind='quarterly',
occurred_on=<quarter start>)`. **No edges are proposed** — `meta.proposedEdges` is always `[]`
(`GraphProposedEdge.META_KEY`): a season is a reading of a period, not a causal claim, so nothing
this pass writes ever gets structurally linked to anything else.

**The feedback rollups disclose their window (fixed in the final review, F3).** Everything else in
this prompt is quarter-wide and the instruction is `Csak a megadott szövegekre támaszkodj, semmit
ne találj ki`, so an undisclosed window here reads to the model as quarter-wide evidence — but
`feedback_rollup` rows are a TRAILING window (`mezo.companion.feedback-learning.window-days`,
default 30) that the nightly job overwrites, so at 04:00 on the 1st they cover roughly the
quarter's LAST MONTH. The heading is therefore
`VISSZAJELZÉSEK AZ AI-FELÜLETEKRŐL (utolsó 30 nap, nem a teljes negyedév):`, with the number
**rendered from `FeedbackRollupEntity.windowDays`**, not hardcoded — the window is a config knob,
and rows are keyed `(created_by, scope, window_days)`, so a window change can leave two windows'
rows side by side; in that case the heading says `gördülő ablak` and each line carries its own
`(utolsó N nap)`. This is the quarterly payload builder agreeing with
`ProfileAssembler.renderPayload`, which already disclosed its own window
(`VISSZAJELZÉSEK (utolsó 30 nap)`). Without it, a quiet July/August followed by a rough September
hands the model September's 9 👎 as if they characterised the whole quarter — and that reading
becomes a durable SEASON candidate.

**Two gates, both before any spend.** (1) `GraphNodeRepository.countQuarterlyNodesOnQuarter` —
native, `source_kind = 'quarterly' and occurred_on = :quarterStart`, deliberately blind to
`is_deleted` (the W2.3 day-gate idiom one rung up) — a quarter already touched (accepted, still
pending, OR REJECTED) is never re-proposed. The literal `'quarterly'` in that query MUST stay
equal to `QuarterlyReviewService.SOURCE_QUARTERLY` — a native query can't reference the Java
constant, so a rename on one side would silently break the gate on the other; `QuarterlyReviewServiceIT`
pins the two together. (2) the emptiness gate — a quarter with no month rungs at all costs no LLM
call. **A missing PREVIOUS quarter is deliberately NOT a gate**: the first quarter of a user's
history still deserves a season reading, the prompt just states honestly that there is nothing to
compare it against.

**Phase 2 — profile refresh, anchored on the SAME finished quarter.** `QuarterlyReviewJob` re-runs
`ProfileAssembler.rebuild(userId, quarter)` after the season pass, per user — and the two phases
are separately try/caught, so a failed season pass for a user must not cost that same user their
profile refresh, and vice versa (the `GraphMaintenanceJob` per-user-isolation idiom, one level
deeper). **Why phase 2 runs at all is NOT that a season becomes profile input.**
`ProfileAssembler.habitNodes` only ever reads ACTIVE `PATTERN`/`PREFERENCE` nodes — a freshly
proposed `SEASON` candidate is neither of those kinds nor ever active while it sits pending, so it
is invisible to the profile in EVERY status. Re-running the assembler right as the quarter turns
over is what keeps the `DÖNTÉSI MINŐSÉG` trend (below) current — **and the anchor is what makes
that true**.

**The anchor quarter (fixed in the final review, F1).** `ProfileAssembler.rebuild` takes the
anchor quarter as a REQUIRED argument: the quarter its trend calls *"ez a negyedév"*, with
*"előző negyedév"* always `Quarters.previous(anchor)`. `ProfileAssemblerJob` (weekly, mid-quarter)
passes `Quarters.startOf(LocalDate.now())`; `QuarterlyReviewJob` passes the just-finished
`quarter` it already computed for phase 1, so the quarterly profile compares the quarter that
closed against the one before it. Before the fix, `decisionQuality` derived its own window from
`LocalDate.now()`: at 04:00 on Jan 1 that is the four-hour-old NEW quarter, which has nothing
reviewed in it, so the "a lone historical line is not a trend" rule dropped the ENTIRE `DÖNTÉSI
MINŐSÉG` section and the quarterly rebuild regenerated the profile prose from strictly LESS input
than the previous Monday's weekly run had — the user-visible *Rólad tanultam* node lost its
decision-quality observation on precisely the one day of the year the "quarterly deep pass" was
meant to sharpen it. No IT caught it because every IT runs mid-quarter; `ProfileAssemblerIT
.renderPayload_windows_the_trend_on_the_anchor_quarter_not_on_todays_quarter` now seeds both
quarters *around* the clock's quarter, so it fails on any day of the year if the window goes back
to `now()`. **There is deliberately no no-anchor overload** — a defaulting overload is exactly how
a future caller would re-acquire the bug by omission.

**Phase 2 also honours `PROFILE_ASSEMBLER_JOB_SWITCH` (fixed in the final review, F2).**
`mezo.techcore.cron.profile-assembler-job.enabled=false` is a documented kill switch for the
profile — no weekly rebuild, no smart-tier spend on it, and an archived *Rólad tanultam* node
stays archived. Calling `ProfileAssembler.rebuild` unconditionally from here made it leaky: four
times a year the quarterly cron would spend a smart-tier call per user anyway AND force the
non-ACTIVE node back to ACTIVE (the assembler's deliberate "reset what you think of me" revival),
resurrecting a profile the operator or the user had switched off. `@Value` is banned in this repo,
so the switch is read the house way — **by bean presence**: `QuarterlyReviewJob` holds
`ObjectProvider<ProfileAssemblerJob>`, and that bean's existence IS the switch (its own
`@ConditionalOnProperty` says so). Absent ⇒ phase 2 is skipped, with an honest log line (IDENT-3),
**while phase 1 keeps running** — proposing seasons is not the profile job, and switching the
profile off must not silently switch the season reading off too.
`QuarterlyReviewJobProfileSwitchOffIT` pins both halves (candidate written, no profile node; an
archived profile still archived afterwards).

**Decision-quality trend (`ProfileAssembler.decisionQuality`, folded into
`ProfileAssembler.renderPayload`'s payload as a new `DÖNTÉSI MINŐSÉG` section — the LLM's
INPUT, not the injected `[Rólad tanultam]` block, which carries only the model's output
prose).** Pure code, no LLM anywhere in the arithmetic
(NFR-M-4: the model gets the observation, never derives the number itself) — the ANCHOR quarter's
mean `outcome_rating` over reviewed decisions against the previous quarter's, one line
each: `"- ez a negyedév: 4,5/5 (2 értékelt döntés)"`. The Hungarian labels are relative to the
anchor, never to the wall clock (see "The anchor quarter" above). **Honest absence, both halves**: a quarter
with nothing reviewed contributes no line at all, and with NOTHING reviewed THIS quarter the
WHOLE section stays out of the payload — a lone historical line is not a trend, and a bare
`"0,0/5"` would read as terrible judgement rather than as no data. **Half-open window, fixed in
review**: the finder is `reviewedAtGreaterThanEqual` + `reviewedAtLessThan` over
`[quarterStart, quarterStart + 3 months)` — an earlier inclusive `BETWEEN` double-counted a
decision reviewed at EXACTLY the boundary instant into BOTH quarters (the previous window's
"inclusive" upper bound IS the current window's exact lower bound);
`ProfileAssemblerIT.renderPayload_counts_a_decision_reviewed_at_the_exact_quarter_boundary_only_once`
pins the fix.

**The L2 inbox is shared — no new endpoint.** SEASON candidates surface in the SAME
`GET /api/companion/graph/node/candidate` list W2.3's LIFE_EVENT candidates already use, and are
decided through the SAME `LifeEventCandidateService.decide` — kind-agnostic top to bottom, so
accepting/rejecting a season needed nothing this slice didn't already have (FE side: §2.4 of
[`insights.md`](insights.md)).

**`compare_periods` chat tool** (`MemoryTools.comparePeriods`) — a new row in the tool catalog
(§4 below) and in the `[Eszköz-útmutató]` routing hint (`"két időszak összevetése (negyedév/hónap)
→ compare_periods"`, `ChatService.SYSTEM_PROMPT`): `periodA`/`periodB` each spell either a quarter
(`2026-Q3`) or a month (`2026-07`) — parsed by the shared `Quarters.parse`/`isQuarter` helper —
and render side by side from the SAME `period_summary` MONTH rungs the quarterly job itself
reads, per-rung capped at `quarterly.render-max-chars`. Each rendered rung adds a ref — but
**`Időszak`/`2026-07`, deliberately NOT the `Memory`/ISO-date shape `find_similar_past_days`
uses** (fixed in the final review, F4): `RefTag` renders every ref generically as `[kind] label`,
so `Memory`/`2026-07-01` would put six chips reading like six specific DAYS under
„Hivatkozott · L3" when the answer was built from six whole MONTHS — the very lie this same slice
removed from the candidate card (`formatCandidateDate`, §2.4 of [`insights.md`](insights.md)),
which the slice must not then re-introduce one surface over. The label uses the same `YYYY-MM`
spelling `Quarters.parse` accepts, so a chip reads back as a period the tool understands; no FE
change was needed. A period that resolves to no rungs renders the honest `nincs
adat` rather than silence. **Deliberately excludes `feedback_rollup`** — see the decisions/gotchas
entry below for the ambiguity this resolved and how.

**The calendar helper.** `Quarters` (`quarterly/service/`) is a pure static utility — `startOf`,
`previous`, `endOf`, `label`, `parse`, `isQuarter` — shared by three callers that each need it and
none of which owns it: the quarterly job (which quarter just finished), `ProfileAssembler` (the
decision-quality window) and `compare_periods` (parsing what the model asked for). A "quarter" is
always keyed by its first day, the same convention `period_summary.period_start` already uses for
weeks (Monday) and months (the 1st) — one identity per period, so a quarter can never be reviewed
twice under two different keys.

**Config** — `mezo.companion.quarterly.*`, a feature-scoped `QuarterlyProperties` record (the
`ProfileProperties`/`FlagProperties` precedent, NOT another `CompanionProperties` nested
component; full shape in the config-keys section below): `cron`, `max-candidates`,
`max-period-lines`, `render-max-chars`.

### Entities

`MessageFeedbackEntity` (`feedback/entity/MessageFeedbackEntity.java`, W4.1) `extends OwnedEntity`,
soft-deleted (`@SQLDelete` + `@SQLRestriction`); `KIND_*`/`VERDICT_*`/`REASON_*` constants +
`@Pattern` mirrors of the value CHECKs — the `AiMessageEntity.role` precedent, no Java enum. The
cross-field `ck_message_feedback_reason` has **no entity-level equivalent** (a `@Pattern` cannot see
two fields); the service enforces it instead (below).

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
is mechanical (Decision #5). **W3.1b (`mezo-b3pp.28`) adds a THIRD** typed jsonb envelope,
`recalledMemories: RecalledMemoriesEnvelope` (`entity/RecalledMemoriesEnvelope.java`) —
`{items:[{kind, refId, occurredOn, label, gist, similarity}]}`, with a static
`ofOrNull(items)` factory so "nothing recalled" is a null column rather than an empty envelope.
`refId` is the source row's UUID: persisted (the row can be traced back to the episode it quoted)
but deliberately **not on the wire** — the chat has no route to a `memory_embedding` source, and a
raw id in a disclosure is noise. Round-trip proven by `AiMessageJsonbRoundTripIT` (the W3.1b case
pins the `LocalDate` `occurredOn` surviving Jackson and `jsonb_typeof = 'object'`).

### REST endpoints (contract-first — tag `Companion` → `CompanionApi`)

Fragment `api/feature/companion/companion.yml`; `CompanionController implements CompanionApi`.
Every non-2xx returns `SystemMessageList`. All paths are protected (401 without a token).

| Method + path | Returns | Status | Notes |
|---|---|---|---|
| `GET /api/companion/conversation` | `ConversationResponse[]` | 200 · 401 | Owner's conversations, most-recently-active first (`ConversationService.list`). |
| `POST /api/companion/conversation` | `ConversationResponse` | 201 · 401 | New empty conversation (`title` null; `startedAt` = `created_at`). `saveAndFlush` so `@CreationTimestamp` is populated before mapping. **`mezo-p2tr`:** an optional body `{context: {kind: week\|day, date}}` anchors it (`context_kind`/`context_date` persisted) and triggers `ChatService.openingTurn` — a server-generated, assistant-only first turn (§3 "Weekly review data layer + anchored conversations"). Absent/omitted `context` = unchanged plain-conversation behaviour. |
| `GET /api/companion/conversation/{id}/messages` | `MessageResponse[]` | 200 · 401 · 404 | Full history, oldest-first. 404 for missing **or foreign** (`getOwned`, no existence leak). |
| `POST /api/companion/conversation/{id}/message` | `MessageResponse` | 200 · 400 · 401 · 404 | The **sync** chat turn (V0.2, single transaction — LLM failure still rolls the whole turn back). |
| `POST /api/companion/conversation/{id}/message/stream` | SSE `(delta\|tool)*, (done\|error)` | 200 · 400 · 401 · 404 | The **streamed** turn (V0.4, tag `CompanionStream`, **hand-written** — §9 Decision 11); `tool` events interleave live since mezo-280 (progress only — the `done` row's `tools[]` stays authoritative). Two-transaction; `error` ⇒ no assistant row. Non-2xx are plain JSON before the stream starts. |
| `GET /api/companion/fact` | `KnowledgeFactResponse[]` | 200 · 401 | V1.1 — owner's facts, `reinforcement_count desc, created_at desc`. |
| `POST /api/companion/fact` | `KnowledgeFactResponse` | 201 · 400 · 401 | V1.1 manual add — `CreateFactRequest {factText 1..500, category pattern}`; `source=manual`, `include_in_prompt=true`, `reinforcement_count=0`. |
| `PATCH /api/companion/fact/{id}` | `KnowledgeFactResponse` | 200 · 400 · 401 · 404 | V1.1 partial update — `UpdateFactRequest {factText?, category?, includeInPrompt?}`, only provided fields applied (the KnowledgeListPage toggle). |
| `GET /api/companion/fact/candidate` | `FactCandidateResponse[]` | 200 · 401 | V1.2 — the pending inbox: undecided candidates, newest first. |
| `POST /api/companion/fact/candidate/{id}/decision` | `FactCandidateResponse` | 200 · 400 · 401 · 404 | V1.2 — `FactDecisionRequest {decision accept\|reject\|refine, refinedText?}`; accept/refine promote (`promotedFactId` set); refine without text → FIELD `VALIDATION_REQUIRED_FIELD`; re-decide → `COMPANION_CANDIDATE_ALREADY_DECIDED`. |
| `GET /api/companion/pattern/monitor` | `PatternMonitorResponse` | 200 · 401 | `mezo-viqs` — live diagnostics: re-runs `PatternGate` over the exact windows the nightly job uses, writing nothing; per-pair verdict + per-`MetricKey` coverage. `missingDays` exists only for `few_days`; `bottleneckMetricKey` for `few_days`/`no_data`/`degenerate`. **mezo-0469:** every pair carries both `metric*ValueKind` fields; binary pairs that reach the total-size gate carry `groupZeroDays`/`groupOneDays`/`requiredPerGroup`, and `imbalanced_groups` deliberately has no correlation stats. **mezo-18bx:** pairs also carry `mechanismHu` + domains, coverage rows `sourceHu` + domain. |
| `GET /api/companion/pattern/pair/{pairKey}` | `PatternPairDetailResponse` | 200 · 401 · 404 | **S1 close (`mezo-tk88.3`):** the pattern detail page's one-stop read — `PatternPairDetailService.detail` reuses `PatternMonitorService.toPair` (package-widened) so the gate verdict can never disagree with the Motor dashboard. `pattern` is `null` until the pair goes live (no synthetic row); `events[]` is the `pattern_event` history (first reader, oldest-first); `days[]` are the CURRENT window's aligned points, computed live (never stored — frozen `confirmed`/`rejected` rows still show today's data); `impact` is the "what came of this" block (promoted fact + grounded predictions/experiments/challenges). Unknown `pairKey` (not in the `mezo.companion.patterns.pairs` catalog) → 404 `COMPANION_PATTERN_PAIR_NOT_FOUND`. **FE consumer since `mezo-tk88.5`:** `usePatternPairDetail(pairKey)` (`patternDetailHooks.ts`) → `PatternDetailPage.tsx` (`/insights/patterns/:pairKey`) — any 404 (unknown key OR the companion switch off) maps to one honest `notFound` state; see [`insights.md`](insights.md) §2.1b/§4. |
| `GET /api/companion/memory/overview` | `MemoryOverviewResponse` | 200 · 401 · 404 | `mezo-al1i` — L0–L3 layer counts + the 3 job cron strings, one read-only aggregate (`MemoryObservatoryService.overview`). |
| `GET /api/companion/memory/summary` | `MemorySummaryListResponse` | 200 · 401 · 404 | `mezo-al1i` — the L1 journal, date-desc, optional `from`/`to`; `embedded` flags a live `memory_embedding` row for that day. |
| `GET /api/companion/memory/similar-days` | `SimilarDaysResponse` | 200 · 400 · 401 · 404 | `mezo-al1i` — reuses `MemoryRecallService` (V2.3) verbatim; `q` required (1..∞ chars), `k` 1..5 (default 3); below-floor matches never returned (the same honest empty-list rule as the tool). |
| `GET /api/companion/memory/llm-usage` | `LlmUsageResponse` | 200 · 401 · 404 | `mezo-al1i` — daily rollup over `llm_log_history` (`days` 1..90, default 30); `enabled:false` + empty `perDay` + zeroed `totals` when the `mezo.feature.llm-log.enabled` switch is off — the query never runs. |
| `POST /api/companion/transcribe` | `TranscriptionResponse` | 200 · 400 · 401 · 404 · 502 | **`mezo-at8x.4`** — multipart `audio` → transcript. Own tag `CompanionVoice` → `CompanionVoiceApi` → `CompanionVoiceController`. Stateless + ephemeral: nothing persisted, the bytes live only for the one model call (`CompanionLlm.complete(system, "", InlineAudio)`, `CallKind.TRANSCRIBE`). Size/mime checked in `TranscriptionService` against `mezo.companion.transcription.*` (base mime only — `MediaRecorder`'s `;codecs=opus` is stripped) → FIELD `VALIDATION_INVALID_VALUE` on `audio`. **Empty text is a success, not an error** (silence); a model that narrates instead of transcribing (> 8 000 chars) → 502 `COMPANION_TRANSCRIBE_FAILED`. |

**Schemas:** `ConversationResponse {id, title?, startedAt, lastMessageAt?}`,
`MessageResponse {id, role, content, createdAt, tools[], refs[], recalled[], degraded}` (**filled
since V0.5** on tool-using turns; a tool-less turn's null envelope still maps to `[]`,
`CompanionMapper.toTools/toRefs`; `degraded` required boolean since V1.3 — always false on user
rows; **`recalled` required array since W3.1b `mezo-b3pp.28`**, `[]` when the answer disclosed
nothing — the `tools`/`refs` "required, empty is the absence" convention, so the FE never
branches on undefined), `RecalledMemory {occurredOn (date), kind, label, gist, similarity}` (W3.1b
— one `[Emlékek]` line the model was given, in prompt order: `kind` is the raw
`memory_embedding.kind`, `label` the Hungarian source tag exactly as rendered in the prompt
(`napló`, `napi összefoglaló`, …), `gist` the injected one-liner byte-identical to the prompt line.
**`similarity` is the RAW cosine 0..1 to the user's message — NOT the `similarity × exp(-age/τ)`
decayed score the re-rank ordered by** (that one is `SimilarDayItem.finalScore`), so an old but
near-identical memory reads honestly as a high match even though it sorted low; the FE renders
`Math.round(similarity*100)%`. The envelope's `refId` is NOT exposed), `MessageTool {type, name}` (`type` = `read` in V0.5; `name`
carries the args baked in — `get_recovery(scope=sleep, days=3)`), `MessageRef {kind, id, label?}`
(kinds: `Workout`,
`Sport`, `Run`, `WeightTrend`, `Sleep`, `FuelDay`, `Protocol`, `Goal`, `Medication`, since
V2.3 `Memory` — a recalled day's date, and since mezo-xixu `TrainingPlan` — the resolved date, or
the mesocycle title for `scope=meso`, `ExerciseRecord` — the exercise name, `Recipe` — the
matched recipe's name, `Pantry` — the pantry item's name, `SleepGoal` — the resolved wake time
(`get_recovery(scope=sleep-goal)`), `CheckIn` — a check-in's date (`get_recovery(scope=checkins)`),
and `Growth` — a stable scope label (`skills`/`week-{weekStart}`/`achievements`/`titles`,
`get_growth(scope)`), `Practice` — the resolved date (`get_daily_practice(date)`), and since
mezo-xixu `Insight` — a confirmed pattern's title (`get_insights(scope=patterns)`; no ref for the
deferred `predictions`/`experiments` scopes); **`label` since `mezo-b3pp.33`** — optional/nullable,
`required` stays `[kind, id]`. Today only `GraphNode` refs populate it (the graph traversal's own
`fromTitle`/`toTitle` — §W2.4 above — so no separate lookup, and an archived node still shows the
name it had when the turn ran). Every other kind, and every row persisted before this field
existed, carries `label: null`/absent; the FE (`chatRefDisplay`) falls back to its existing
id-derived label for those, using `||` so an empty/whitespace label degrades the same way),
`SendMessageRequest {content}` (`minLength 1`, `maxLength 4000`),
`StreamDelta {text}` + `StreamError {code}` + `StreamToolCall {type, name}` (V0.4 + mezo-280 — the
SSE per-event `data:` payloads; every data line is JSON; `StreamToolCall.name` carries the SAME
pre-baked `"name(args)"` label as `MessageTool.name`, `type` always `read` in V0.5),
`KnowledgeFactResponse {id, factText, category, source, reinforcementCount,
includeInPrompt, lastReinforcedAt?, createdAt}` (V1.1). **`mezo-al1i`** adds
`MemoryOverviewResponse {l0, l1, l2, l3, jobs}` (nested `MemoryOverviewL0/L1/L2/L3/Jobs` +
`MemoryPatternCount {kind, status, count}` + `MemoryFactSourceCount {source, count}` +
`MemoryEmbeddingKindCount {kind, count}` — **`MemoryOverviewL1.embeddings` is `MemoryEmbeddingKindCount[]`
since `mezo-b3pp.22`, a BREAKING replacement of the original two-field `MemoryEmbeddingCounts
{dailySummary, chatTurn}`**; see the L1 paragraph below for why), `MemorySummaryListResponse {items:
MemorySummaryItem[]}` (`{date, narrative, embedded}`), `SimilarDaysResponse {items:
SimilarDayItem[]}` (`{date, excerpt, similarity, finalScore}` — `finalScore` is the wire name for
`MemoryRecallService`'s `similarity × exp(-age/τ)` score), and `LlmUsageResponse {enabled, perDay:
LlmUsageDay[], totals}` (`LlmUsageDay {date, calls, inputTokens, outputTokens, costUsd?}` —
`costUsd` null means no priced row that day, never a fabricated 0). All four schemas are defined in
`api/feature/companion/companion.yml`, alongside the existing `Companion` tag schemas.

**L1's embedding count is a list per kind, not two fixed fields (`mezo-b3pp.22`).** The original
`MemoryEmbeddingCounts {dailySummary, chatTurn}` shape hard-coded the two kinds `memory_embedding`
carried at V2.1; `mezo-b3pp.1` widened `ck_memory_embedding_kind` from three values to ten
(`journal_entry`, `reflection`, `gratitude`, `decision`, `activity_note`, `checkin_note` +
`weekly_summary`/`monthly_summary`, all documented in the V2.1 table above), and a fixed-field
response would have needed a contract change — and a matching FE edit — every time the CHECK grows
again. `MemoryOverviewL1.embeddings` is now `MemoryEmbeddingKindCount[]` (`{kind, count}`),
matching the shape its two L2/L3 siblings in the same response already use
(`MemoryOverviewL2.patterns: MemoryPatternCount[]`, `MemoryOverviewL3.facts:
MemoryFactSourceCount[]`) — an array absorbs an eleventh kind for free, no contract or FE change
required. `kind` is deliberately plain `type: string` in the schema, not enum-constrained: the DB
CHECK is the authority and it is expected to keep growing.
`MemoryEmbeddingRepository.countByKindForUser` (`repository/MemoryEmbeddingRepository.java`) is
ONE `group by m.kind` JPQL query — `select m.kind as kind, count(m) as count from
MemoryEmbeddingEntity m where m.createdBy = :createdBy group by m.kind order by count(m) desc,
m.kind asc` via the `KindCount {getKind(), getCount()}` projection — rather than one
`countByCreatedByAndKind` call per kind. Being JPQL (not native) matters: Hibernate's
`@SQLRestriction("is_deleted = false")` applies to JPQL exactly as it does to derived queries, so a
vector the nightly sweep has reaped (`mezo-b3pp.26` made note reaping real —
`MemoryEmbeddingWriter.syncNote` soft-deletes an orphaned or live-but-blank note vector) is
correctly absent from the count rather than inflating it. `MemoryObservatoryService.overview` maps
each row into `MemoryEmbeddingKindCount.builder().kind(row.getKind()).count((int)
row.getCount()).build()`; a kind with zero live vectors is simply never a row, so it is omitted
from the array — the same "absence is zero" convention `MemoryOverviewL2.patterns` and
`MemoryOverviewL3.facts` already use, now shared by all three. The `order by count desc, kind asc`
is deliberate, not cosmetic: it makes the response order deterministic, which is a property the API
promises its consumer — the FE renders one chip per array entry in wire order, with no client-side
sort. `testOverview_shouldOrderKindsByCountThenKind_whenSeveralKindsArePopulated` in
`CompanionMemoryOverviewApiIT` asserts that order with `containsExactly`, so it documents and locks
the intent — but it is not a hard guard: at this row count Postgres' aggregate happens to return the
same order even with the `order by` removed (verified by hand), so what actually backs the clause is
the API's determinism promise, not the test. On the FE,
`MemoryLayersPanel`'s `EMBEDDING_KIND_LABEL` map (`features/insights/components/
MemoryLayersPanel.tsx`) renders one stat per array entry and falls back to the raw `kind` string
(`EMBEDDING_KIND_LABEL[e.kind] ?? e.kind`) for a kind it has no Hungarian label for yet — without
that fallback the array shape would buy nothing, since a brand-new writer's vectors would still be
invisible in the panel until the FE separately shipped a label for it; with it, a new kind is
visible in the observatory the day its writer ships.

**`PatternPairDetailResponse` (S1 close, `mezo-tk88.3`):** `{pair: PatternMonitorPair,
pattern: PatternResponse | null, events: PatternEventResponse[], days: AlignedDayResponse[],
impact: PatternImpactResponse}` — `pair`/`days` are the SAME `PatternMonitorPair`/live-window
shapes the monitor endpoint returns (§ above), through the same `toPair(..., minN, minGroupN,
from, to)` path, so the two surfaces never disagree — including the binary group-balance verdict.
`PatternEventResponse
{kind, occurredAt, r?, n?, p?, reinforcementCount?, factId?}` mirrors one `pattern_event` row 1:1
(`CompanionMapper.toPatternEventResponse`) — only the fields the `kind` actually uses are non-null.
`PatternImpactResponse {fact: PatternImpactFact | null, predictions: PatternImpactRef[],
experiments: PatternImpactRef[], challenges: PatternImpactRef[]}` — `fact` is the promoted knowledge
fact (via `PatternEntity.promotedFactId`), the three ref lists are grounded rows found by each
proactive repository's `findByCreatedByAndSourcePatternIdAndDeletedFalse` (S2, `mezo-tk88.2`);
`PatternImpactRef {id, title, status}`. **Assembly crosses the companion↔proactive boundary** —
see §5.5's `PatternImpactSource` paragraph for how that stays ArchitectureTest-clean.

### REST endpoints — feedback (contract-first — tag `CompanionFeedback` → `CompanionFeedbackApi`)

Fragment `api/feature/companion-feedback/companion-feedback.yml` (its **own** fragment, registered in
`api/generate/merge.yml`; the `Companion` tag was left alone so the generated `CompanionApi` did not
grow a third responsibility); `CompanionFeedbackController implements CompanionFeedbackApi`, thin
delegation to `MessageFeedbackService`, ownership from `CurrentUserId`. All three paths are
switch-gated (404 when `COMPANION_SWITCH` is off) and protected (401 without a token).

| Method + path | Returns | Status | Notes |
|---|---|---|---|
| `GET /api/companion/feedback?kind&ids` | `MessageFeedbackResponse[]` | 200 · 400 · 401 | **Batch page hydration.** `ids` is a comma-joined uuid list (`style: form, explode: false`), **1..200** (`minItems`/`maxItems`). Returns only the requested ids that carry a live verdict — a never-voted id is simply ABSENT, never an error, so the surface degrades to "no chip selected" rather than a failed page. |
| `PUT /api/companion/feedback` | `MessageFeedbackResponse` | 200 · 400 · 401 | **Upsert** — `PutFeedbackRequest {artifactKind, artifactId, verdict, reason?}`. ONE updatable verdict per `(user, artifactKind, artifactId)`: the opposite verdict overwrites the row, a new `reason` updates it. `reason` with a non-`down` verdict → 400 **`FEEDBACK_REASON_REQUIRES_DOWN`** (an honest 400 in the service; the DB CHECK is only the backstop — a CHECK violation surfacing as a 500 is not an answer). |
| `DELETE /api/companion/feedback/{artifactKind}/{artifactId}` | — | 204 · 400 · 401 | **Retraction** — soft-deletes the row via `@SQLDelete`. **Idempotent:** retracting a never-voted artifact also answers 204, because "I have no opinion on this" is already what a missing row means. |

**Schemas:** `PutFeedbackRequest {artifactKind, artifactId, verdict, reason?}` and
`MessageFeedbackResponse {artifactKind, artifactId, verdict, reason?, updatedAt}`. The three enums
are spelled as plain `type: string` in both, but **only the INPUT side constrains them**:
`PutFeedbackRequest`'s `artifactKind`/`verdict`/`reason` (and the GET `kind` query param + the
DELETE `artifactKind` path param — the sibling `artifactId` carries `format: uuid` only, having no
enum to constrain) carry a `pattern` holding the `artifact_kind`/`verdict`/`reason` CHECK values
verbatim, so a bad value is a 400 from bean validation rather than a 500 from Jackson (the house
`pattern`-over-`enum` rule). `MessageFeedbackResponse`'s three fields carry **only a `description`
listing the values — no `pattern`**, which is the normal asymmetry: validation belongs on what a
client sends, not on what the server returns.
Either way `openapi-typescript` yields `string` for all six (it narrows neither a `pattern` nor a
description), so the FE narrows once at its own boundary
(`data/feedback/feedbackApi.ts`'s `toArtifactFeedback`). There is no `id` on the wire: the artifact
triple IS the identity.

**The write path is a native upsert, not find-then-save** (`MessageFeedbackRepository.upsertVerdict`,
`@Modifying(clearAutomatically, flushAutomatically)`): `insert … on conflict on constraint
uq_message_feedback_artifact do update set verdict, reason, is_deleted = false, updated_at = now()`.
Because that constraint spans soft-deleted rows (§4 above) a retracted row still owns the slot while
`@SQLRestriction` hides it from every derived finder — so a re-vote after a retraction would collide
on a plain `save`. The upsert **resurrects** it instead. The service re-reads the row afterwards and
maps it, so the response is always server truth.

### REST endpoints — knowledge graph (contract-first — tag `KnowledgeGraph` → `KnowledgeGraphApi`)

W2.1 (`mezo-b3pp.6`) — gated `KNOWLEDGE_GRAPH_SWITCH`:

- `GET /api/companion/graph/node` — active nodes for the current user, newest first; each carries
  `topEdges` (W2.6, `mezo-b3pp.11`) — up to 3 Hungarian text lines for its strongest touching
  edges (both directions), pre-rendered by the shared `GraphEdgeLineRenderer` (the same renderer
  `GraphPromptAssembler` uses for the `[Összefüggések]` block, so the UI and the model never
  disagree on phrasing); `[]` when the node has no edges. Candidates (`GET .../candidate`) always
  carry `topEdges: []` — the field is active-listing-only.
- `POST /api/companion/graph/node/{id}/archive` — archive a node (200 + the archived node body;
  404 `GRAPH_NODE_NOT_FOUND` if not owned).

W2.3 (`mezo-b3pp.8`) — the L2 confirm inbox, gated the same as the rest of the surface (switch off
⇒ both routes 404, `GraphSwitchOffIT`):

- `GET /api/companion/graph/node/candidate` — pending (undecided) `LIFE_EVENT` candidates, newest
  first.
- `POST /api/companion/graph/node/{id}/decision` — `GraphCandidateDecisionRequest {decision:
  accept|reject}` → the decided node (`active` on accept, the soft-deleted row's last shape on
  reject); 400 `GRAPH_CANDIDATE_ALREADY_DECIDED`; 404 `GRAPH_NODE_NOT_FOUND`.
- `GraphNodeResponse.proposedEdgeCount` — how many edges accepting this candidate would create
  (`0` for every non-candidate node).

### The V0.5 tool catalog (all read-only, ownership-scoped, audited)

| Tool (args) | Source (existing reads) | Ref |
|---|---|---|
| `get_training_log(scope, days)` (mezo-xixu, merged from `get_recent_workouts`+`get_sport_sessions`) | scope=gym: `WorkoutSessionRepository.findDoneInstancesBetween` + per-instance sets → date, dayLabel, set count, Σ volume kg; scope=sport/run: sport + run since-date finders → sport/duration/intensity/RPE or run week/rounds | `Workout`/date (≤5) or `Sport`/date (≤3) or `Run`/date (≤3) |
| `get_training_plan(scope, date)` (mezo-xixu, sport added mezo-ajp) | FORWARD plan: `WorkoutService.findPlannedTemplateForDate` + `ExerciseRepository` (gym day, read-only — never `getToday`) + `SportService.getSchedule` (recurring slots matched on the date's weekday) + `RunningService.listBlocks`/`RunningBlockStructure` (prescribed run) + `TrainService.listMesocycles` (`scope=meso` full cycle) | `TrainingPlan`/date or meso title |
| `get_weight_trend(weeks)` | `WeightTrendService.computeTrend` → trend kg, weekly + 4w rate, one EWMA point per ISO week | `WeightTrend`/`{w}h` |
| `get_weight_log(days)` (mezo-8z79) | `WeightLogRepository` since-date finder → the RAW daily weigh-ins, newest first: date, kg, day-over-day delta vs the previous row, note. The companion piece to `get_weight_trend`: the trend is EWMA-smoothed and therefore CANNOT answer "why does it fluctuate so much" — that question needs the unsmoothed points | `Weight`/date (≤5) |
| `get_fuel_log(range, date, days)` (mezo-xixu, merged from `get_recent_meals`) | range=day: `FuelDayService.getDay` looped per day (from `date`, default today) → kcal/F vs targets, meal count + titles (≤3), plus `WaterLogService.sumForDay` for the anchor day's water vs target; range=week: `FuelDayService.getWeek` (Monday-anchored ISO week containing `date`) → per-day kcal/F/water vs targets | `FuelDay`/date (≤5) |
| `get_recovery(scope, days, date, from, to)` (mezo-xixu, merged from `get_sleep`, adds sleep-goal + check-ins; **mezo-ohce: on-demand full sleep-log detail** via `date` (≤3 guidance, ISO dates) / `from` / `to`) | scope=sleep: compact last-N-days via `SleepLogRepository` since-date finder → duration, quality, awakenings; **when any of `date`/`from`/`to` is present**, full detail per requested day via the between-finder → bedtime, wakeup, duration, in-bed/awake/könnyű/REM/mély minutes, quality, awakenings, source + source quality, hypnogram (`bucketMin` + raw stages), notes; fields are null-guarded, missing day → `nincs rögzített alvás`, and the window is clamped to `tools().maxWindowDays()` with a `visszavágva N napra` header when trimmed. scope=sleep-goal: `SleepGoalService.getGoal` (target minutes, regularity band; `SLEEP_GOAL_SWITCH`-gated, read via `ObjectProvider`) + `SleepAnchorPort.resolve` (bed/wake anchor, ungated) → target hours/min, bed/wake, regularity band; scope=checkins: `CheckInService.listForDay` per day across the window → energy/stress/body/mental (1–10) per slot | scope=sleep: `Sleep`/date (≤5; detail mode emits one per rendered day, including missing days); scope=sleep-goal: `SleepGoal`/wake-time; scope=checkins: `CheckIn`/date (≤5) |
| `get_protocol(scope, days)` (mezo-xixu, merged from `get_protocol_adherence`) | scope=adherence: `ProtocolService.getView().getActive()` + intake since-date finder → per-day taken/expected + total %; scope=intake: `IntakeService.listForDay` (today, protocol-independent) → item names (via the pantry stash) + known dose; scope=supplements: the active protocol's distinct `items[].pantryItemId` (mezo-vx9v living protocol, zone-sorted) → item names | `Protocol`/`v{n}` (adherence/supplements always; intake only when a protocol happens to be active) |
| `get_goal(scope)` (mezo-xixu, merged from `get_goal_progress`) | scope=progress (default): active goal + `computeTrend` + `GoalPrescriptionJson.currentSegment` → week N, start→target, actual vs plan rate, e heti recept; scope=recept: the goal's `prescription.segments` (≤3) → per-segment kcal/protein/sleep/rest-days/rate/rationale; scope=guards: `prescription.guardStatus` → strength e1RM trend + breach, muscle weekly-set floor + below-maintenance list; scope=feasibility: `prescription.feasibility` → verdict + notes (≤3); scope=timeline: `GoalTimelineService.getTimeline` (pure read) → mapped plan links + uncovered gym-lane week gaps (≤3 each). recept/guards/feasibility render "még nincs kiértékelve" until the goal's first `evaluate` (never called from the tool) | `Goal`/title |
| `get_medication(scope)` (mezo-xixu; `scope ∈ {cycle, all}`, default `cycle`, renamed from the drug-specific original scope names in `mezo-lwmq`) | scope=cycle (default): `MedicationCycleService.deriveToday` + top-10 doses → cycle day, phase, last dose, next due; scope=all: `MedicationService.getDay` → name, active ingredient, cadence, default dose, cycle position (once a dose is on record) + recent doses, generic (no drug-specific naming). Both scopes' "today" now derive off the SAME `MedicationCycleService.MEDICATION_ZONE` (`Europe/Budapest`, mezo-8h2s) — before this fix `renderCycle` used the JVM's system-default zone while `getDay` used UTC, so scope=cycle and scope=all could disagree on the cycle day by one near either midnight | `Medication`/name |
| `get_exercise_records(exercise)` (mezo-xixu) | `ExerciseRecordService.list` (compute-on-read over working sets, read-only) → no/blank `exercise`: top-5 lifts by best e1RM; with `exercise`: case-insensitive name-contains match(es) → bestSet, bestE1rm (Epley), repRecords, recentTopSets | `ExerciseRecord`/exercise name (≤5) |
| `get_recipes(filter)` (mezo-xixu, scored match mezo-sxe) | `RecipeService.list` (read-only) → no/blank `filter`: name/category/whole-recipe kcal+protein/mezo-fit score list; with `filter`: accent-folded token match scored over name (4) > ingredient name (3) > slot/category/role/tag/fitsFor/starred (2), all-token hits winning over partial — the best scorer renders full macros + ingredient lines (the detail comes from the same `.list` response, not a separate `.get` call) | `Recipe`/recipe name (≤5) |
| `get_pantry(kind)` (mezo-xixu) | `PantryService.getPantry` (read-only) → `kind ∈ {food, supplement, stim, med}` (default: all kinds); food from `ingredients` (name + stock qty/unit + expiry), supplement/stim/med from `stash` filtered by `type` (name + stock qty/unit, no expiry in the contract) | `Pantry`/item name (≤5) |
| `get_growth(scope)` (mezo-xixu) | scope=skills (default): `ProgressionService.getProfile` (ungated) → account level/XP/streak from `GamificationService.getProfile` (`GAMIFICATION_SWITCH`-gated, `ObjectProvider`) + every skill with real progress (athletic/muscle/life); scope=week: `GrowthWeekService.growthWeek` (ungated) → closed quests, LIFE XP, activities, savings for the current ISO week; scope=achievements: `AchievementService.achievements` (ungated) → all 9 derive-on-read badges + persisted perk unlocks; scope=titles: `GamificationService.getProfile` → equipped + owned titles | `Growth`/`skills` or `week-{weekStart}` or `achievements` or `titles` |
| `get_daily_practice(date)` (mezo-xixu) | `TodayQuestSource.todayStats` (port, read-only) → quest completed/total for the date; `HabitService.summary` (always "as of today", no `date` param) → perfect-chain-day counts + any habit with real 28-day signal; `IntentionService.getDay` → creed/foci/reflection for the date; `RitualService.getDay` → napzárás closed/open for the date; `TodayActivitySource.activitiesForDay` (2nd companion-owned port, impl `activity/service/DailyActivityAdapter`) → logged activities (text + XP), capped at 5. Active challenges NOT composed (`ProactiveChallengeService.getChallenges` write-transactional; a direct repository read would open a new companion→proactive cycle) | `Practice`/date |
| `get_insights(scope)` (mezo-xixu) | scope=patterns (default, only live scope): `PatternService.list` (same `companion` slice, read-only) filtered to `PatternEntity.STATUS_CONFIRMED` → title + deterministic mechanism prose (direction/strength) + evidence chips (r/n/p), capped at 5. scope=predictions/experiments DEFERRED — `ProactivePredictionService.getPredictions`/`ProactiveExperimentService.getExperiments` (`feature.proactive.service`) lazily GENERATE on a miss (a write) and a direct import would open a new companion↔proactive cycle; both render "még nem elérhető" | `Insight`/pattern title (≤5); none for predictions/experiments |
| `find_similar_past_days(description, k)` (V2.3) | `MemoryRecallService.recallSimilarDays` — query embed → ANN over daily-summary vectors → similarity × recency-decay re-rank | `Memory`/date (≤k) |
| `compare_periods(periodA, periodB)` (W5.3, `mezo-b3pp.20`) | `Quarters.parse` reads each side as a quarter (`2026-Q3`) or a month (`2026-07`); `PeriodSummaryRepository`'s MONTH-granularity finder over `[periodStart, Quarters.endOf(periodStart)]` for a quarter (its 3 month rungs) or `[periodStart, periodStart]` for a month; per-rung capped at `quarterly.render-max-chars`. Deliberately does NOT read `feedback_rollup` (§9) | `Időszak`/`YYYY-MM` (one per rendered rung — a MONTH, never a day; none for a period with no rungs) |

### Config keys (`mezo.companion.*` — `CompanionProperties`, `@Validated`)

- `mezo.companion.chat.history-window` = **20** (`@Min(0) @Max(200)`) — how many prior
  user+assistant rows (≈10 turns) are windowed into the system prompt (Decision #1).
- `mezo.companion.chat.title-max-chars` = **80** (`@Min(10) @Max(120)`) — auto-title = first user
  message truncated to this many chars (DB column caps at 120; Decision #2).
- `mezo.companion.snapshot.digest-days` = **7** (`@Min(1) @Max(30)`) — how many days back the
  snapshot's train digest (gym/sport/run counts) looks, including today (V0.3).
- `mezo.companion.snapshot.checkin-note-max-chars` = **200** (`@Min(0) @Max(1000)`) — the latest
  check-in note is included verbatim, truncated to this many characters (V0.3).
- `mezo.companion.snapshot.workout-note-max-chars` = **180** (`@Min(0) @Max(1000)`) — the
  workout-level closing note is included **verbatim**, truncated to this many characters
  (`mezo-d20.13`); `0` turns the injection off. Never summarized: an LLM-shortened version of the
  user's own sentence loses exactly the numbers, hedges and specifics that make it worth carrying,
  and asserts an interpretation of their state the app was never told. The contract lets a note be
  1000 chars and the snapshot rides EVERY turn, so this clip is load-bearing, not cosmetic.
- `mezo.companion.snapshot.people-max-persons` = **12** (`@Min(0) @Max(30)`) — how many ACTIVE
  people the `[Emberek]` chat-snapshot block lists (newest mention first). `0` omits the block.
- `mezo.companion.tools.max-calls-per-turn` = **15** (`@Min(1) @Max(20)`, raised from 6 at
  mezo-xixu alongside the 8→15 tool expansion) — recorded tool calls per
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
- `mezo.companion.advisors.rx-terms` (`@NotEmpty`) — the clinical check's owner-curated
  GLP-1-family drug-name dictionary (7 terms, `application.yml`) — the guard's vocabulary, not
  user data, so it was deliberately left untouched by the medication-retirement pass ([ADR
  0027](../decisions/0027-retire-retatrutide-generic-medication-domain.md)); accent-folded
  contains-match, only dose-CHANGE verbs trigger.
- `mezo.companion.transcription.max-audio-bytes` = **5 242 880** (`@Min(1)`) — the voice-note
  upload cap (`mezo-at8x.4`), kept under the 6 MB container multipart cap so the SERVICE check is
  the effective, message-bearing limit; ~2.5 minutes of the 16 kHz mono WAV the FE uploads.
- `mezo.companion.transcription.allowed-mime-types` = `[audio/wav, audio/x-wav, audio/webm,
  audio/ogg, audio/mp4, audio/mpeg, audio/aac]` (`@NotEmpty`) — matched on the BASE type: the FE
  normalizes to wav where it can, but Chrome records webm/opus and iOS Safari mp4/aac.
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
  cap in the tool result (gist over full re-quote; token budget). **Since W3.1 the ambient
  `[Emlékek]` block reuses it** for its per-item first-line cap.
- `mezo.companion.ambient-recall.enabled` = **true** — W3.1 runtime kill-switch (off ⇒ no embed
  call, no ANN query, no block; the turn is otherwise identical). A blank user message short-circuits
  the same way.
- `mezo.companion.ambient-recall.<group>.cap` / `.min-similarity` / `.decay-days` — **W3.3
  (`mezo-b3pp.14`) per kind-group tuning** (`AmbientRecall.Group(cap, minSimilarity, decayDays)`:
  `@Min(0) @Max(10)` / 0..1 / `@Min(1) @Max(3650)`). The five groups and their shipped values:

  | group | kinds | cap | min-similarity | decay-days (τ) |
  |---|---|---|---|---|
  | `daily-summary` | `daily_summary` | **2** | **0.55** | **90** |
  | `period-summary` | `weekly_summary` + `monthly_summary` (the W3.2 rungs) | **2** | **0.55** | **180** |
  | `journal` | `journal_entry` + `reflection` + `gratitude` + `decision` | **2** | **0.60** | **90** |
  | `chat-turn` | `chat_turn` | **1** | **0.55** | **90** |
  | `other` | `activity_note` + `checkin_note` | **1** | **0.55** | **90** |

  **A cap of 0 skips that group's query entirely** — not "query then drop" (and `kind in ()` is a
  SQL error, so the skip is load-bearing). The floor is applied to the RAW cosine, τ only to the
  `similarity × exp(-age/τ)` re-rank; the block is one global score-ordered list across groups, so a
  group's τ decides how its items interleave with everyone else's. Two defaults deviate from the
  W3.1 single-floor/single-τ world and the reasons are on the record: the **journal floor 0.60**
  (lived-with 2026-08-22 — journal hits at 0.59–0.62 read as noise next to the day they were pulled
  into) and the **period τ 180** (a rung stands for a whole stretch; at τ90 an 80-day monthly falls
  below a 28-day daily and the ladder stops leading). Tune in yml, then run `AmbientRecallEvalIT`
  and read its table — it is built so every cap and those two knobs each have a row that moves.
- `mezo.companion.ambient-recall.exclude-current-conversation` = **true** (`mezo-b3pp.27`) — the
  chat_turn query skips the conversation being answered (`ref_id not in (select m.id from
  ai_message m where m.conversation_id = …)`); those turns are already in the history window, so
  recalling them is a duplicate. Off ⇒ the pre-W3.3 behaviour, own turns compete for the cap.
- `mezo.companion.ambient-recall.weekly-shadow-days` = **30** (`@Min(1) @Max(3650)`) — W3.2 coverage
  cutoff: a `daily_summary` older than this is no longer asked for, its covering rung answers for the
  stretch. Raising it delays consolidation's takeover, lowering it hands more of the past to the
  rungs; nothing is deleted either way.
  Ambient floors are deliberately stricter than the tool's **0.25** (`recall.min-similarity`): the
  tool was ASKED for a memory, the ambient block volunteers one. **Before W3.3 there was one flat
  `ambient-recall.min-similarity` (0.55) and τ was borrowed from `recall.decay-days`** — both keys
  are gone from ambient recall; `recall.decay-days` still drives the `find_similar_past_days` tool.
- `mezo.companion.ambient-recall.max-tokens` = **1200** (`@Min(100) @Max(6000)`) — hard cap on the
  rendered block in ESTIMATED tokens (`ceil(chars / 3)`, conservative for accented Hungarian);
  the render loop stops at the first item that would overflow. **Under the shipped defaults this
  never binds** — 6 items × ≤300 chars ≈ 700 tokens worst case — it is a safety net for someone
  raising the caps or `render-max-chars`. At the validated extremes it becomes a real gag: the
  102-char `MEMORIES_HEADER` alone is 34 estimated tokens, so `max-tokens` at its 100 minimum leaves
  ~198 chars for lines — about one short memory — and an item rendered at the 2000-char
  `render-max-chars` maximum can never fit at all.
- The ANN candidate pool (`recall.candidate-pool`) and the per-item render cap
  (`recall.render-max-chars`) are **reused** from `mezo.companion.recall.*` — W3.1 added no
  duplicates of them, and they are still shared. **τ is no longer among them**: W3.1 borrowed
  `recall.decay-days`, W3.3 (`mezo-b3pp.14`) gave every ambient group its own `decay-days`, so
  `recall.decay-days` now serves the `find_similar_past_days` tool alone.
- `mezo.companion.patterns.cron` = `"0 40 2 * * *"` — the V3.1 nightly correlation job (after the
  summary job by convention); switch `mezo.techcore.cron.pattern-detection-job.enabled`
  (`PATTERN_DETECTION_JOB_SWITCH`).
- `mezo.companion.patterns.lookback-days` = **60** (`@Min(14) @Max(365)`) — correlation window.
- `mezo.companion.patterns.min-n` = **8** (`@Min(3) @Max(60)`) — aligned-days floor before a pair
  may surface at all.
- `mezo.companion.patterns.min-group-n` = **3** (`@Min(3) @Max(30)`) — after the total-size gate,
  each exact 0/1 group of a binary A metric must independently reach this floor. Until then the
  verdict is `imbalanced_groups` and Pearson is not run.
- `mezo.companion.patterns.reinforce-cooldown-days` = **7** (`@Min(1) @Max(60)`) — a confirmed
  pattern reinforces its promoted fact at most once per window (the nightly lookback slides one
  day; re-counting the same evidence would inflate top-N ranks — review finding).
- `mezo.companion.patterns.pairs` = the 29-pair catalog (`@NotEmpty`, each
  `{key, category, label, title, mechanism, question, expected-direction, when-positive-hu,
  when-negative-hu, metric-a, metric-b, lag-days}`) — `mechanism` is the „miért figyeljük"
  one-liner (`mezo-18bx`); **`mezo-fj1g` added the human-language card fields:** `question`
  (the card's question-title), `expected-direction` (`positive|negative` — the hypothesized
  correlation sign; the FE uses it to select the authored result sentence) and the two authored
  direction readings `when-positive-hu`/`when-negative-hu` (what a positive/negative r MEANS for
  this pair, in Hungarian, with an `{erősség}` slot the FE fills from |r|). All `@NotBlank` —
  the config validator refuses a pair without them. Pair keys are pattern identity (never rename
  a live key); metrics come from the `MetricKey` enum, which since `mezo-18bx` also carries
  `sourceHu`, a `MetricDomain` (`SLEEP/TRAIN/FUEL/MIND/BODY/OTHER`) and, since `mezo-0469`, a
  `MetricValueKind` (`NUMBER/CLOCK_HOUR/BINARY`); the monitor DTOs pass
  everything through (`questionHu`/`expectedDirection`/`whenPositiveHu`/`whenNegativeHu` since
  `mezo-fj1g`), and `PatternResponse` gained `pairKey` (the Motor↔Patterns cross-link anchor).

  **Second consumer since `mezo-hqfi`:** the proactive **Diagnózis** report treats `MetricKey` as
  its suspect catalog — the enum is simultaneously the metric whitelist a model answer is
  validated against, the Hungarian evidence label (`labelHu`), and the provenance line shown in
  the UI (`sourceHu`), while `domain()` supplies the "at least two domains have data" gate.
  `MetricSeriesService#series` is its gather primitive. Consequence: **adding a `MetricKey` widens
  what the diagnosis can blame**, and renaming one breaks already-persisted `diagnosis.suspects`
  rows, which store the enum name. See [`proactive.md`](proactive.md) §4 → Diagnosis.
  Note the accessors are record-style (`labelHu()`, `sourceHu()`, `domain()`), not Lombok getters.
- `mezo.companion.patterns.load-gym-kg-per-min` = **100** (`@Min(1) @Max(10000)`) — V3.4: the
  ACWR/monotony daily-load common scale (this many kg of gym volume ≙ one sport minute).
- `mezo.companion.summary.note-max-chars` = **200** (`@Min(0) @Max(1000)`) — V3.4: per-field cap
  on the digest's qualitative fields (notes, mention excerpt).
- `mezo.companion.consolidation.weekly-cron` / `monthly-cron` = **`0 30 3 * * MON`** / **`0 50 3 1 * *`**
  — W3.2 ladder schedules (server zone, free dawn slots; 02:20/02:40/03:00 SUN/03:10/03:20/03:40 taken).
  The bean itself only exists while `mezo.techcore.cron.consolidation-job.enabled` is true.
- `mezo.companion.consolidation.backfill-weeks` / `backfill-months` = **8** / **3**
  (`@Min(1) @Max(520)` / `@Min(1) @Max(120)`) — finished periods each run re-offers; an existing rung
  is returned untouched, so the window is a self-heal and a history backfill in one.
- `mezo.companion.hypotheses.cron` = `"0 0 3 * * SUN"` — the V3.2 weekly loop; switch
  `mezo.techcore.cron.hypothesis-job.enabled` (`HYPOTHESIS_JOB_SWITCH`).
- `mezo.companion.hypotheses.max-per-run` = **3** (`@Min(1) @Max(10)`) — hypotheses judged per run.
- `mezo.companion.hypotheses.keep-threshold` = **0.75** / `revise-threshold` = **0.50** (0..1) —
  the arch §4.7 routing thresholds; the four WEIGHTS are code constants (they define the score).
- `mezo.companion.graph.max-hops` = **2** (`@Min(1) @Max(3)`) — W2.1: neighborhood traversal depth
  from a seed node; consumed starting W2.4.
- `mezo.companion.graph.top-k` = **8** (`@Min(1) @Max(20)`) — W2.1: top-K neighbors returned by
  weight; consumed starting W2.4.
- `mezo.companion.graph.decay-factor` = **0.99** (0.9..1) — W2.1: nightly edge-weight
  multiplicative decay (e.g. 0.99 = 1%/day fade); consumed by W2.5's `GraphMaintenanceService`.
- `mezo.companion.graph.prune-floor` = **0.05** (0..1) — W2.1: edges below this weight are
  soft-deleted on the nightly pass; consumed by W2.5's `GraphMaintenanceService`.
- `mezo.companion.graph.render-max-tokens` = **800** (`@Min(1)`) — W2.1: hard cap on the rendered
  `[Összefüggések]` block in estimated tokens; consumed by W2.4's `GraphPromptAssembler`. Of the
  original five W2.1 fields, all are now consumed: `top-k` earliest (W2.2's edge structurer), then
  `max-hops`/`render-max-tokens` (W2.4's traversal + render), then `decay-factor`/`prune-floor`
  (W2.5's maintenance job).
- `mezo.companion.graph.edge-confidence-floor` = **0.4** (0..1) — W2.2: the edge structurer drops
  suggestions below this confidence; survivors are created at `weight = confidence × 0.5`.
- `mezo.companion.graph.max-refs` = **6** (`@Min(1) @Max(20)`) — `mezo-b3pp.33`: cap on `GraphNode`
  refs emitted per turn, applied before the shared `tools.max-refs-per-turn` budget. `topK` edges
  (default 8) yield up to `2×topK` node refs, and graph refs are added LAST, so this exists so a
  graph-heavy turn can't fill the whole footer and truncate tool/Memory refs mid-list; consumed by
  W2.4's `GraphPromptAssembler`.
- `mezo.companion.graph.cron` = **"0 20 3 * * *"** (`@NotBlank`) — W2.5 (mezo-b3pp.10): the nightly
  `GraphMaintenanceJob` cron (03:20, a free dawn slot). Job switch
  `mezo.techcore.cron.graph-maintenance-job.enabled`
  (`FeaturesConfiguration.GRAPH_MAINTENANCE_JOB_SWITCH`).
- `mezo.companion.graph.candidate-max-age-days` = **30** (`@Min(1) @Max(365)`) — W2.5: candidate
  nodes (never confirmed/rejected by the L2 inbox) older than this many days are soft-deleted on
  the nightly pass.
- `mezo.companion.graph.reinforcement-bump` = **0.05** (0..1) — W2.5: fresh pattern evidence
  (a same-night `pattern_event` snapshot for a promoted pattern) bumps that node's touching edges
  by this much, capped at 1.0.
- `mezo.companion.graph.max-seeds` = **8** (`@Min(1) @Max(50)`) — `mezo-b3pp.34`: cap on
  `GraphTraversalService#seedsFor`'s ranked seed list, applied AFTER ranking (title hit, then
  distinct token hits, ties left to the query's own TOTAL `created_at desc, id` row order) so a chatty turn
  that word-start-matches many nodes still produces a deterministic, most-relevant-first seed set
  instead of degenerating into "the globally strongest edges" once the seed set is most of the
  graph; consumed by W2.4's `GraphTraversalService`.
- `mezo.companion.profile.cron` = **`0 45 3 * * MON`** (`@NotBlank`) — W4.3 (`mezo-b3pp.17`):
  weekly, AFTER the 03:10 feedback rollups and the 03:30 weekly consolidation rung (both read by
  the assembler, so it must run last in the dawn window). Job switch
  `mezo.techcore.cron.profile-assembler-job.enabled` (`PROFILE_ASSEMBLER_JOB_SWITCH`) — off ⇒ the
  `ProfileAssemblerJob` bean does not exist.
- `mezo.companion.profile.render-max-tokens` = **400** (`@Min(200) @Max(2000)`, spec §8.3 — floor
  raised from 50 by `mezo-b3pp.35` item 5: the `[Rólad tanultam]` header alone costs ~48 tokens, so
  50 left almost no room for prose) — the
  hard cap on the WHOLE `[Rólad tanultam]` block (header included) at render time; the same budget
  is applied at STORE time to the prose alone (no header there), so the stored summary can be
  marginally longer than what a turn actually renders — Tudástár may show a little more than the
  model was given, never less.
- `mezo.companion.profile.max-decisions` = **10** (`@Min(0) @Max(100)`) — how many reviewed
  decisions (newest-review-first) enter the synthesis payload.
- `mezo.companion.profile.max-graph-nodes` = **12** (`@Min(0) @Max(100)`) — how many active
  PATTERN/PREFERENCE node titles enter the synthesis payload.
- `mezo.companion.interventions` (`@NotNull List<@Valid Intervention>`) — W5.2 (bd `mezo-b3pp.19`)
  the intervention library, one `{key, flag, channel, textHu, cooldownHours, quietHoursExempt}`
  entry per config-text card `InterventionService` can select; **ships with 6 entries** covering
  all five W5.1 flags. Its own nested `CompanionProperties.Intervention` record (not a separate
  `@ConfigurationProperties` class — it needs `interventions()` alongside every other companion
  knob, and there is exactly one list field, not a cluster of related ones the `FlagProperties`/
  `ProfileProperties` precedent would justify splitting out). See the W5.2 subsection above (§4)
  for the full shape and the shipped entries.
- Feature switch `mezo.feature.intervention.enabled`
  (`FeaturesConfiguration.INTERVENTION_SWITCH`) — W5.2's own switch, `@ConditionalOnProperty`-gated
  ALONGSIDE `COMPANION_SWITCH` ∧ `PROACTIVE_SWITCH` (§4 above).
- Feature switch `mezo.feature.companion.enabled` (`FeaturesConfiguration.COMPANION_SWITCH`).

### Config keys (`mezo.companion.flags.*` — `FlagProperties`, `@Validated`)

W5.1 (bd `mezo-b3pp.18`) — a feature-scoped `@ConfigurationProperties(prefix =
"mezo.companion.flags")` record, not a `CompanionProperties` field (§9). EVERY threshold, window
and cooldown below is config, never code — `FlagEvaluator` holds no numbers of its own.

| key | default | meaning |
|---|---|---|
| `sweep-cron` | `"0 5 * * * *"` | the hourly sweep — `:05` past every hour, past no other dawn job |
| `sustained-stress.threshold` | `7.0` | check-in stress (1–10 scale) at/above this counts as a "bad" day |
| `sustained-stress.window-days` | `4` | the trailing window, TODAY included |
| `sustained-stress.min-days` | `3` | bad days required inside the window to raise |
| `sleep-debt.nights` | `3` | nights accumulated, ending TODAY (`sleep_log.date` is the wake morning, so today's row IS last night) |
| `sleep-debt.min-nights` | `2` | logged nights required inside the window (honest small-n gate) |
| `sleep-debt.deficit-hours` | `3.0` | cumulative `Σ max(0, goal − actual)` at/above which it raises |
| `sleep-debt.default-goal-hours` | `8.0` | fallback goal used only when the user has no `sleep_goal` row |
| `momentum.window-days` | `3` | the recent habit-completion window, ending YESTERDAY |
| `momentum.baseline-days` | `14` | the baseline window immediately before the recent one |
| `momentum.drop-ratio` | `0.5` | the recent average must fall to at most `baseline × (1 − ratio)` |
| `momentum.min-baseline` | `1.0` | below this baseline average there is no momentum left to lose (no flag) |
| `recovery.window-days` | `2` | the "same 48h" window, TODAY included, read as whole days |
| `recovery.sleep-floor-hours` | `6.0` | a night at/below this counts as "poor sleep" |
| `recovery.rpe-threshold` | `7.0` | a training RPE at/above this counts as "high effort" |
| `recovery.stress-threshold` | `6.0` | a check-in stress at/above this counts as "high stress" |
| `all-healthy.quiet-days` | `7` | no other flag raised for this many days ⇒ the quiet state itself is logged |
| `logging-gap.meal-stale-hours` | `36` | hours since the last `meal_.logged_at` at/above which meals count as stale |
| `logging-gap.checkin-stale-hours` | `48` | hours since the last `check_in.saved_at` at/above which check-ins count as stale |
| `logging-gap.sleep-stale-mornings` | `2` | consecutive missing wake mornings (`sleep_log.date`) at/above which sleep counts as stale |
| `logging-gap.min-stale-domains` | `1` | how many of the three domains must be stale at once for the flag to raise |
| `logging-gap.sleep-suspicion-deficit-hours` | `1.0` | when `sleep_debt` stayed silent for want of nights, the logged nights' average deficit at/above which the payload attaches the suspicion (spec §4 row 5) |
| `missed-workouts.window-days` | `14` | how far back planned gym days are scanned, ending TODAY |
| `missed-workouts.min-consecutive-missed` | `2` | consecutive PLANNED gym days with nothing completed needed to raise (consecutive in the sequence of planned days, not calendar days) |
| `acute-bad-day.min-check-ins` | `2` | check-ins logged TODAY required before the pattern can even be judged |
| `acute-bad-day.body-or-energy-at-most` | `3` | body/energy (1–10, nullable) at/below this counts as a "bad" check-in |
| `load-fuel-mismatch.window-days` | `7` | the trailing load/kcal/sleep window |
| `load-fuel-mismatch.load-threshold` | `50.0` | 7-day `COMBINED_LOAD_MIN` average at/above which the week counts as high-load (min-equivalents/day) |
| `load-fuel-mismatch.kcal-fraction-of-target` | `0.80` | 7-day kcal average below this fraction of the day's target counts as under-fuelled |
| `load-fuel-mismatch.sleep-floor-hours` | `7.0` | 7-day sleep average below this counts as under-recovered |
| `load-fuel-mismatch.min-logged-days-per-side` | `4` | honest small-n gate, checked independently on the kcal side and the sleep side |
| `rapid-weight-loss.pct-per-week-at-most` | `-0.7` | `WEIGHT_TREND_PCT_WK` at/below this (more negative — the bound is itself negative) raises the flag |
| `rapid-weight-loss.min-weigh-ins` | `4` | display-only mirror of the extractor's own ≥4-weigh-ins gate |
| `joint-overuse.window-days` | `7` | the trailing `SHOULDER_STRAIN` window |
| `joint-overuse.strain-avg-at-least` | `5.0` | window average at/above which strain counts as overuse |
| `joint-overuse.muscle-needle` | `"shoulder"` | matched against tomorrow's planned session's normalised `MuscleGroup` |
| `ignored-nudge.category` | `"lights_out"` | the `NotificationCategory` wire value of the ignored push |
| `ignored-nudge.min-consecutive-days` | `5` | consecutive push+non-compliant nights required |
| `ignored-nudge.non-compliance-minutes` | `60` | observed bedtime within this many minutes of the anchor counts as compliant (breaks the run) |
| `late-eating.minutes-before-bed` | `90` | last meal within this many minutes of the anchor (either direction) counts as "late" |
| `late-eating.absolute-hour` | `22.5` | fractional hour (`LATE_MEAL_HOUR`'s own unit) — a meal at/after this counts as late outright |
| `late-eating.min-days-of-last-three` | `2` | qualifying days required inside the window to raise |
| `late-eating.window-days` | `3` | the trailing window the qualifying-day count is taken over |
| `cooldown-hours.sustained-stress` | `24` | re-raise floor, per flag |
| `cooldown-hours.sleep-debt` | `24` | ″ |
| `cooldown-hours.momentum-at-risk` | `48` | ″ |
| `cooldown-hours.recovery-needed` | `24` | ″ |
| `cooldown-hours.all-healthy` | `168` | ″ (one week) |
| `cooldown-hours.logging-gap` | `48` | ″ — long enough that a gap card does not repeat daily |
| `cooldown-hours.missed-workouts` | `48` | ″ |
| `cooldown-hours.acute-bad-day` | `48` | ″ — same-day/acute signal |
| `cooldown-hours.load-fuel-mismatch` | `72` | ″ — slower trend-window signal |
| `cooldown-hours.rapid-weight-loss` | `72` | ″ |
| `cooldown-hours.joint-overuse` | `72` | ″ |
| `cooldown-hours.ignored-nudge` | `72` | ″ |
| `cooldown-hours.late-eating` | `48` | ″ — same-day/acute signal |

Job switch `mezo.techcore.cron.flag-sweep-job.enabled`
(`FeaturesConfiguration.FLAG_SWEEP_JOB_SWITCH`) — off ⇒ the `FlagSweepJob` bean does not exist;
the on-write listener keeps running unaffected (it answers to `COMPANION_SWITCH` only).

**The thirteen flags** (source of truth: the W5.1 plan's "The rules" table plus the S2 spec's §4
rows 1/3 and the round-1 coaching spec 2026-09-03 §4's severity order for the S6 six — all windows
are whole days computed from `LocalDate.now()`; missing days stay absent, never invented — the
`MetricSeriesService` rule — except `HABITS_DONE`/`COMBINED_LOAD_MIN` (calendar-complete), and
`logging_gap`'s meal/check-in reads plus `acute_bad_day`'s check-in read, both of which bypass
`MetricSeriesService` entirely — see §3 above for why):

| flag | fires when | inputs |
|---|---|---|
| `sustained_stress` | per-day avg `CHECKIN_STRESS` ≥ `threshold` on ≥ `min-days` of the last `window-days` days (today included) | `MetricKey.CHECKIN_STRESS` |
| `sleep_debt` | over the last `nights` nights ending TODAY (`sleep_log.date` is the wake morning, so today's row is last night): Σ max(0, goalHours − durationH) ≥ `deficit-hours`, and at least `min-nights` of them are logged | `MetricKey.SLEEP_DURATION_H`, `sleep_goal.target_minutes` (fallback `default-goal-hours`) |
| `momentum_at_risk` | recentAvg(`HABITS_DONE`) ≤ baselineAvg × (1 − `drop-ratio`) **and** ≥1 missed planned gym day in the recent window; guarded by baselineAvg ≥ `min-baseline` | `MetricKey.HABITS_DONE`, `gym_schedule_slot.day_of_week`, `WorkoutSessionRepository.findDoneInstanceDates` |
| `recovery_needed` | inside the last `window-days` days (today included): a day with `SLEEP_DURATION_H` ≤ `sleep-floor-hours` **and** a day with `TRAINING_RPE` ≥ `rpe-threshold` **and** a day with avg `CHECKIN_STRESS` ≥ `stress-threshold` | those three series |
| `logging_gap` | `≥ min-stale-domains` of {meals, check-ins, sleep} stale (thresholds above); a domain with no row at all counts as stale | `meal_.logged_at`, `check_in.saved_at`, `sleep_log.date` (direct repository reads, not `MetricSeriesService`) |
| `missed_workouts` | `≥ min-consecutive-missed` consecutive PLANNED gym days (in the sequence of planned days) with no completed workout instance, inside the `window-days`-day window ending YESTERDAY (today is still in progress), itself clamped to never start before the oldest surviving `gym_schedule_slot.created_at` — a day before the current schedule existed cannot be a violation of it (review fix, bd `mezo-d58h.2`) | `gym_schedule_slot.day_of_week`, `gym_schedule_slot.created_at`, `WorkoutSessionRepository.findDoneInstanceDates` |
| `acute_bad_day` | ≥ `min-check-ins` of TODAY's raw check-ins have body OR energy ≤ `body-or-energy-at-most`; a null score never qualifies | `check_in.body`/`check_in.energy` (direct repository read, TODAY only) |
| `load_fuel_mismatch` | 7-day `COMBINED_LOAD_MIN` avg ≥ `load-threshold` **and** (7-day `DAILY_KCAL` avg < `kcal-fraction-of-target` × the day's target **or** 7-day `SLEEP_DURATION_H` avg < `sleep-floor-hours`); each side's own `≥ min-logged-days-per-side` gate counted from the SPARSE series, never the calendar-complete load series | `MetricKey.COMBINED_LOAD_MIN`/`DAILY_KCAL`/`SLEEP_DURATION_H`, `FuelDayService.getDay` (kcal target); `WEIGHT_TREND_PCT_WK` rides along as a fact only |
| `rapid_weight_loss` | `WEIGHT_TREND_PCT_WK` < `pct-per-week-at-most` (more negative) **and** the single ACTIVE goal's `trajectory` ≠ `cut`; no active goal ⇒ silent (unreadable precondition) | `MetricKey.WEIGHT_TREND_PCT_WK`, `goal.trajectory` |
| `joint_overuse` | 7-day `SHOULDER_STRAIN` avg ≥ `strain-avg-at-least` **and** tomorrow's planned gym session is `muscle-needle`-focused (via `findPlannedTemplateForDate`, never `getToday`) | `MetricKey.SHOULDER_STRAIN`, `WorkoutService.findPlannedTemplateForDate` |
| `ignored_nudge` | the `category` push sent on `min-consecutive-days` consecutive evenings **and** every one of those nights' `BEDTIME_HOUR` missed the sleep anchor by more than `non-compliance-minutes`; requires a `sleep_goal` row; any unlogged/unsent/compliant night breaks the run | `push_log` (via `NudgeSendPort`), `MetricKey.BEDTIME_HOUR`, `SleepAnchorPort` |
| `late_eating` | on ≥ `min-days-of-last-three` of the last `window-days` days, `LATE_MEAL_HOUR` is within `minutes-before-bed` of the (shifted) sleep anchor **or** ≥ `absolute-hour`; the bed arm needs a `sleep_goal` row, the absolute arm does not | `MetricKey.LATE_MEAL_HOUR`, `SleepAnchorPort` (bed arm only) |
| `all_healthy` | none of the other twelve fire now, **and** no problem row in `companion_flag_log` in the last `quiet-days` days, **and** the window is not empty (≥1 check-in-stress or sleep value) | the log + the series |

`all_healthy`'s "no problem row" check (`existsProblemRaiseSince`) excludes `all_healthy` itself,
`logging_gap`, `ignored_nudge`, and (whole-branch review fix, bd `mezo-d58h.6`) `joint_overuse`:
`logging_gap` names a data-availability gap (a domain has gone stale), not a health/behavior
problem, so a user who tracks sleep and check-ins tightly but logs meals loosely must not have
`all_healthy` blocked for a full `quiet-days` window every time `logging_gap` fires (review fix, bd
`mezo-d58h.2`). `ignored_nudge` joins it by the same argument (bd `mezo-d58h.6`): it names the
app's OWN nudging failing to land — a delivery/behavior-change-channel problem, not a
health/behavior problem of the user's. `joint_overuse` joins by the same argument again: its own
intervention copy calls it a training tip, not an injury alert, and it fires on a conjunction (a
7-day strain average plus tomorrow's schedule) the user did nothing to earn — for a user on a
weekly shoulder split it is true roughly weekly, so counting it here would keep the seven-day quiet
window from ever opening. The other nine flags — `missed_workouts` and the remaining four S6 keys
(`acute_bad_day`, `load_fuel_mismatch`, `rapid_weight_loss`, `late_eating`) included — stay counted
as problems, since each IS a genuine behavior/health signal, unlike a data gap, a failed nudge, or a
forward-looking training advisory. The other suppression is unchanged: `FlagEvaluator` only runs
`AllHealthyRule` when nothing else raised in that same evaluation, so `all_healthy` never appears
alongside any other flag on the same day regardless of this query.

A flag is written only when `companion_flag_log` holds no row with that `flag_key` newer than
`cooldown-hours.<flag>` — identical for both sources.

### Config keys (`mezo.companion.quarterly.*` — `QuarterlyProperties`, `@Validated`)

W5.3 (bd `mezo-b3pp.20`, spec §9.3) — a feature-scoped `@ConfigurationProperties(prefix =
"mezo.companion.quarterly")` record, the `ProfileProperties`/`FlagProperties` precedent, NOT
another `CompanionProperties` nested component (§9).

| key | default | meaning |
|---|---|---|
| `cron` | `"0 0 4 1 1,4,7,10 *"` | the quarterly run (server zone) — 1st of Jan/Apr/Jul/Oct, AFTER that dawn's 03:50 monthly consolidation rung, which is this job's own input |
| `max-candidates` | `2` | how many SEASON candidates ONE run may propose — the model is told this same number; anything beyond it is dropped, never merged |
| `max-period-lines` | `6` | how many month rungs per side enter the season-proposal prompt — a quarter has 3, the cap guards against a mis-set window flooding the payload |
| `render-max-chars` | `400` | per-rung character cap in the `compare_periods` tool's rendered output (the `recall.render-max-chars` idiom: a tool result is a prompt budget) |

Job switch `mezo.techcore.cron.quarterly-review-job.enabled`
(`FeaturesConfiguration.QUARTERLY_REVIEW_JOB_SWITCH`) — off ⇒ the `QuarterlyReviewJob` bean does
not exist (no season candidates, no quarterly profile rerun; the weekly profile job is
independent and unaffected). **The reverse is deliberately NOT symmetric** (final-review fix F2):
this switch on + `mezo.techcore.cron.profile-assembler-job.enabled` off ⇒ phase 1 still proposes
season candidates, phase 2 does not rebuild the profile — the quarterly job reads that switch by
`ProfileAssemblerJob` bean presence (`@Value` is banned; §9), so switching the profile off is
never silently undone four times a year, and an archived *Rólad tanultam* node stays archived.
`QuarterlyPropertiesIT` pins all four shipped defaults; `QuarterlyReviewJobProfileSwitchOffIT`
pins the asymmetry.

### Config keys (`mezo.companion.day-evaluation.*` — `DayEvaluationProperties`, `@Validated`)

`mezo-jcpt.4` — a feature-scoped `@ConfigurationProperties(prefix =
"mezo.companion.day-evaluation")` record (the `QuarterlyProperties`/`FlagProperties` precedent,
NOT another `CompanionProperties` nested component), picked up by `@ConfigurationPropertiesScan`.
`DayEvaluationEngine`/`DayScoreService`/`DayReviewService` are the only readers.

| key | default | meaning |
|---|---|---|
| `weights.{nutrition,quality,training,sleep,logging,rhythm}` | `.30/.15/.20/.15/.10/.10` | dimension weights — `@AssertTrue` startup-validates the six sum to `1.0` (±1e-6) |
| `nutrition.kcal-under-band` / `kcal-over-band` | `0.10` / `0.05` | asymmetric kcal tolerance around the target (wider under, narrower over — cut-asymmetry) |
| `nutrition.kcal-slope` | `3.0` | linear falloff rate outside the kcal band |
| `nutrition.protein-under-band` / `protein-slope` | `0.05` / `2.5` | protein deficit band + falloff; a protein SURPLUS is forgiven (fitness policy) |
| `nutrition.carb-fat-band` / `carb-fat-slope` | `0.15` / `1.5` | symmetric carb+fat tolerance + falloff |
| `workout-day-kcal-widen` | `150` (kcal) | widens the kcal-fit upper target on a workout day |
| `sleep-target-h` | `7.5` | the day evaluation's ONLY sleep target (the legacy `MeWeekProperties.sleepTargetH` — `8.0` — went with that record, deleted in `mezo-jcpt.7`) |
| `rhythm-window-days` | `7` | how many prior days the `rhythm` dimension (and its rhythm-free-base recompute, above) looks back |
| `rhythm-min-days` | `3` | minimum prior days with a base score before `rhythm` reports `DONE` rather than `NO_DATA` |
| `log-timely-min` | `120` (minutes) | a meal counts "logged in time" within this many minutes of `eatenAt` (circular clock distance) |

`DayEvaluationPropertiesTest` pins the startup validation (weights summing, band ranges);
`DayEvaluationEngineTest` pins the formula per dimension.

Prose gate: `mezo.feature.day-review.enabled` (`DAY_REVIEW_SWITCH`) = **true** by default — see the
`DayReviewService`/`DayReviewLlmAdapter` writeup above for what it gates and does not.

### Config keys (`mezo.llm-log.*` — the audit log, `LlmLogProperties`/`LlmPricingProperties`)

- Feature switch `mezo.feature.llm-log.enabled` (`FeaturesConfiguration.LLM_LOG_SWITCH`) = **false**
  by default; off ⇒ `NoOpLlmCallRecorder` is the bean ⇒ nothing is published, no row, zero overhead.
  **ON in k8s** (`k8s/backend/deployment.yaml`), where the real Gemini adapters run.
- `mezo.llm-log.max-payload-chars` = **64000** — per-column cap for the stored prompt/response;
  `payload_bytes` keeps the true pre-truncation UTF-8 size and `truncated` flags the cut.
- `mezo.llm-log.executor.{core-size, max-size, queue-capacity}` = **1 / 2 / 500** — the audit
  writer's own bounded pool (`DiscardPolicy`; `@Bean(defaultCandidate = false)` so it cannot displace
  Boot's `applicationTaskExecutor`).
- `mezo.llm-log.pricing.currency` = `USD` + `pricing.models."[<model-id>]"` = per-model
  `{input-, output-, thinking-, cached-per-million}` (generation) / `embed-per-million-chars`
  (embeddings); seeded for `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-embedding-001`. **Keys are
  bracket-quoted** — a model id contains dots and an unbracketed key is split by the binder (the
  entry silently disappears). The seed rates are **placeholders to reconcile with current Gemini
  pricing**; changing them never rewrites history (every row freezes its own snapshot), and an
  unpriced model yields a **null** `cost_usd`, never a fabricated 0.

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
optimistic `ChatTurn {userText, draft, thinking, tools}` overlay, `done` appended into the query cache).
**Since V0.5 the chips are real**: the wire `tools[]` (`{type:'read', name:'get_recovery(scope=sleep, days=3)'}`)
render as `ToolChip`s and `refs[]` as `RefTag`s on history AND streamed turns — the FE needed
zero code changes (the pass-through was built at V0.4). **Since mezo-280 the chips are also live**:
each `tool` SSE event appends onto `ChatTurn.tools`, so the in-flight draft bubble renders its
chips through the same `ToolChipRow` as they execute, rather than all at once after the answer.
The draft — chips included — is still discarded wholesale when the terminal `done` row is appended:
that row's `tools[]` stays the persisted truth (it also covers advisor-retry calls made after the
stream ended), so the live chips are progress only.

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
provider swap = one new adapter + one starter swap (ADR 0008). **Since mezo-78rn the port also
carries a multimodal overload** — `complete(system, user, imageBytes, mimeType) → String`, ONE
ephemeral inline image on the cheap tier: `GeminiCompanionLlm` wraps the bytes in a Spring AI
`Media` part (`content.Media` + `MimeTypeUtils`), `FakeCompanionLlm` matches its greedy
`[fake-meal:{json}]` sentinel in the user text AND in the UTF-8-decoded image bytes (so photo-only
ITs drive canned JSON through the real multipart plumbing). The AI meal-log is the first consumer
(see the meal paragraph below).

**Pantry URL-scrape consumer (✅ wired, ADR 0012).** The Kamra URL-scrape import needs the cheap
LLM tier, but pantry must not import companion (the one-way feature-slice rule). So **pantry owns
the port** it needs (`feature/pantry/service/ScrapeLlm.java`) and **companion owns the adapter**:
`PantryScrapeLlmAdapter` (`llm/PantryScrapeLlmAdapter.java`) implements `ScrapeLlm` by delegating
to `CompanionLlm.complete` (the cheap two-string tier). It is `@ConditionalOnProperty(COMPANION_SWITCH)`
like every other `CompanionLlm` consumer, so companion off ⇒ no adapter bean ⇒ no `ScrapeLlm` bean
⇒ the scrape endpoint degrades to a clean 503. This is the **consumer-owned LLM port** pattern —
the only cross-feature dependency runs companion → pantry, so the ArchUnit feature-slice cycle rule
stays closed: [ADR 0012](../decisions/0012-consumer-owned-llm-ports.md); the consumer side is in
[`fuel.md`](fuel.md) §4–§5.

**Meal-coach consumer (✅ wired, ADR 0012, mezo-mr4n).** The qualitative verdict over a logged
meal's deterministic score is a fourth consumer of the cheap tier, same shape again: **meal owns
the port** (`feature/meal/service/MealCoachLlm.java`, one `complete(system, user)`) and companion
owns `MealCoachLlmAdapter` (`llm/MealCoachLlmAdapter.java`, `@ConditionalOnProperty(COMPANION_SWITCH)`).
Companion off ⇒ no adapter bean ⇒ `MealCoachService` produces no verdicts and the deterministic
envelope is served un-enriched — a **silent** degrade like the recipe prose layer, not the
scrape/ai-draft 503, because the meal score is deterministic and already served. Scripted in ITs by
the `[fake-meal-coach:{json}]` sentinel (GREEDY — the payload nests a `meals[]` array) planted in a
MEAL TITLE, which reaches the prompt through the meal's name. Consumer side: [`fuel.md`](fuel.md) §5/§9.

**AI meal-log consumer (✅ wired, ADR 0012).** The AI meal logging (free text / photo → editable
draft, mezo-78rn) needs the same cheap tier PLUS the vision overload — same shape as the scrape
consumer: **meal owns the port** it needs (`feature/meal/service/MealDraftLlm.java` — a text-only
`complete` + the multimodal `complete(system, user, imageBytes, mimeType)`) and **companion owns the
adapter** `MealDraftLlmAdapter` (`llm/MealDraftLlmAdapter.java`, `@ConditionalOnProperty(COMPANION_SWITCH)`)
delegating both overloads to `CompanionLlm`. So the only cross-feature edge runs **companion → meal**
(companion already reads meal transitively — a direct `meal → companion` edge would cycle), the
ArchUnit slice-cycle rule stays green, and meal reaches the port via `ObjectProvider<MealDraftLlm>`,
so companion off ⇒ no adapter bean ⇒ the `/api/meal/ai-draft` endpoint degrades to a clean 503. The
consumer side (service/prompt/validator/estimate arm) is in [`fuel.md`](fuel.md) §4–§5.

**Recipe AI-breakdown consumer (✅ wired, ADR 0012, mezo-bw3y).** The third consumer port, cheap
tier text-only: **recipe owns the port** (`feature/recipe/service/RecipeBreakdownLlm.java` — one
two-string `complete`) and **companion owns the adapter** `RecipeBreakdownLlmAdapter`
(`llm/RecipeBreakdownLlmAdapter.java`, `@ConditionalOnProperty(COMPANION_SWITCH)`). Unlike
scrape/ai-draft (whole feature IS the LLM → 503), the breakdown endpoint's core is deterministic:
companion off ⇒ empty `ObjectProvider` ⇒ **silent prose-less degrade**, never an error. Consumer
side (prose service/prompt/cache) in [`fuel.md`](fuel.md) §2/§4.

**Sleep-screenshot consumer (✅ wired, ADR 0012, mezo-66ab).** The Sleep Cycle screenshot ingestion
(a photo → an editable sleep-log draft, `POST /api/sleep/screenshot`) needs the cheap+**vision** tier —
same shape as the AI meal-log consumer: **sleep owns the port** it needs
(`feature/biometrics/sleep/service/SleepShotLlm.java` — a single multimodal
`complete(system, user, imageBytes, mimeType)`) and **companion owns the adapter**
`SleepShotLlmAdapter` (`llm/SleepShotLlmAdapter.java`, `@ConditionalOnProperty(COMPANION_SWITCH)`)
delegating to `CompanionLlm.complete` with one `InlineImage`. The only cross-feature edge runs
**companion → sleep** (sleep never imports companion), so the ArchUnit slice-cycle rule stays green;
`SleepShotService` reaches the port via `ObjectProvider<SleepShotLlm>`, so companion off ⇒ no adapter
bean ⇒ the endpoint degrades to a clean **503** `SLEEP_SHOT_LLM_UNAVAILABLE`. Unlike meal (which
trusts the model's numbers), the sleep consumer scores the extraction with its own **deterministic
validator** (confidence never comes from the LLM). Consumer side (service/prompt/validator, the
`/api/sleep/screenshot` surface) in [`me.md`](me.md) §3–§4.

**Stack-placement consumer (✅ wired, ADR 0012, mezo-vx9v).** The Fuel Stack's `PlacementEngine`
falls back to the cheap tier when the deterministic rule table doesn't recognize a supplement —
same shape again: **fuel owns the port** (`feature/fuel/service/StackPlacementLlm.java`, one
`complete(system, user)`) and companion owns `StackPlacementLlmAdapter`
(`llm/StackPlacementLlmAdapter.java`), gated on **both** `COMPANION_SWITCH` and
`mezo.feature.stack-placement-llm.enabled` (`STACK_PLACEMENT_LLM_SWITCH` — the
`ActivityClassifier`/`ChallengeOutcomeEvaluator` array-AND idiom). Either switch off ⇒ no adapter
bean ⇒ `PlacementEngine`'s `ObjectProvider<StackPlacementLlm>` is empty ⇒ placement **silently**
degrades to the deterministic 'fallback' zone, never an error. Consumer side in
[`fuel.md`](fuel.md).

**Habit-suggest consumer (✅ wired, ADR 0012, ADR [0019](../decisions/0019-user-editable-habit-catalog-propose-only-ai.md), mezo-n5e9.3).** The routine editor's propose-only AI habit suggester is
another consumer-owned-port pair, on the **smart** tier instead of cheap: **habit owns the port**
(`feature/habit/service/HabitSuggestPort.java`, `suggest(userId, chainKey, hint)`) and companion owns
`HabitSuggestLlmAdapter` (`llm/HabitSuggestLlmAdapter.java`) — the `StackPlacementLlmAdapter` idiom
extended to a **three-way** array (`HABIT_AI_SUGGEST_SWITCH` + `COMPANION_SWITCH` + `HABIT_SWITCH`).
Any one off ⇒ no adapter bean ⇒ `HabitAiService`'s `ObjectProvider<HabitSuggestPort>` is empty ⇒ a
clean **503** (never a silent degrade — an on-demand suggestion the user explicitly asked for has no
deterministic fallback to fall back to, unlike stack-placement/meal-coach). Tagged
`LlmCallContext("habit_ai_suggest", "propose", …)` for the `llm_log_history` audit (§4 below).
Consumer side — the routine editor's „✨ AI javaslat" sheet, the grounding/filter chain, the contract —
is in [`habit.md`](habit.md) §2/§4/§5.

**Meso-plan-generator consumer (mesocycle wizard redesign).** `MesoPlanLlmAdapter` (`llm/MesoPlanLlmAdapter.java`) — the train-owned `MesoPlanLlm` port's Gemini half (`[meso-plan]`, SMART tier, `LlmCallContext(train_meso_plan, generate)`), gated by `MESO_PLAN_AI_SWITCH` + the companion switch; the model only picks catalog ids into fixed frames, `train.MesoPlanMerger` validates. Consumer side (the deterministic skeleton/fill pipeline, the `POST /api/train/meso-plans/generate` contract) is in [`train.md`](train.md) §4 `#### Plan generator`.

**V2.1 embedding seam (✅ wired, unused until V2.2).** All embedding access goes through the
`EmbeddingPort` (`EmbeddingPort.java`) — `embedDocuments(List<String>) → List<float[]>` /
`embedQuery(String) → float[]`, unit vectors at `DIMENSIONS=768`. Real `GeminiEmbeddingAdapter`
talks to the Google GenAI SDK `Client` bean directly (Spring AI 2.0.0 has no Gemini
EmbeddingModel — the SDK call is the slice's provider decision, hidden by the port; same key as
chat); fake `FakeEmbeddingAdapter` under `companion-fake` (seeded-random unit vectors +
`[fake-embed:…]` sentinel; since **`mezo-b3pp.12`** also `FAIL_EMBED` = `[fake-embed-fail]` — the
port throws — and `FAIL_ANN` = `[fake-embed-shortvec]`, which returns a 3-dimension vector so the
embed SUCCEEDS and the DB rejects the ANN query instead: the two failure halves of the W3.1 path
are separately testable).

**LLM call audit log (✅ wired, [ADR 0014](../decisions/0014-llm-call-audit-log.md), mezo-2zyu).**
Every provider call in the app — companion chat (sync, streamed, tool rounds), the smart tier, the
vision overload, every consumer-owned port above, the embeddings, and every proactive cron — leaves
one append-only `llm_log_history` row (§4). **Capture happens INSIDE the two real adapters, not in a
decorator**: the ports return `String`/`float[]`, so the served model + token breakdown only exist on
the provider response, which lives nowhere else. `GeminiCompanionLlm` therefore calls
`.call().chatResponse()` and records from `recorded(...)` (`llm/GeminiCompanionLlm.java:158`) /
from the Flux's terminal signals for SSE (`:124`), and `GeminiEmbeddingAdapter` records around its
`EmbedContentResponse` (`llm/GeminiEmbeddingAdapter.java:70`); both always rethrow unchanged. Reading
the metadata is one pure mapper, `GeminiUsageExtractor` (`llm/GeminiUsageExtractor.java`) — the ONLY
place Gemini's `Usage`/`GoogleGenAiUsage` shapes are unwrapped, normalising every absent-usage shape
to `null` rather than a fake `0`. **Contract crossing the seam:** the adapters depend only on
`feature/llmlog` (`LlmCallRecorder.record(LlmCallRecord)` + `LlmCallContextHolder`) — one-way, the
audit domain stays self-contained and never calls back. `LlmCallRecorder` publishes an
`LlmCallEvent`; an `@Async("llmLogExecutor") @EventListener LlmLogWriter` persists it in its own
`REQUIRES_NEW` transaction, so the audit never blocks (or fails) the user's call. **WHO/WHY comes
from the call site**, not the adapter: `LlmActorResolver` reads the principal on the calling thread
(null on cron threads — deliberately, it never throws) and `LlmCallContextHolder.runWith(new
LlmCallContext(feature, operation, entityKind, entityId), …)` wraps each of the **37 tagged call
sites across 30 classes** (companion chat/summary/extraction/hypotheses/recall/**ambient
recall**/embedding/advisor/
smoke-test + meal draft & coach, pantry scrape & photo, sleep shot, recipe prose, activity classify,
quest flavor, habit-suggest, fuel stack-placement & slot-template, voice transcription, and the
proactive generators). The W3.1 ambient recall is the newest of them (`mezo-b3pp.12`): its
per-turn embed is tagged `companion_recall`/`recall_embed` — **its own feature name, not
`companion_chat`** — so `/me/ai-usage` can show recall's cost share as its own row (the design
spec's §7.3 requirement, satisfied early). **W3.3 (`mezo-b3pp.14`) finished that thought on the
TOOL path**: `MemoryRecallService`'s query embed for `find_similar_past_days` was tagged
`embed_memory`/`query` — the DOCUMENT-embed feature name — and now carries
`LlmCallContext("companion_recall", "recall_embed", "tool", null)`, the same feature/operation pair
as the ambient path with `entityKind` telling the two apart. So the `companion_recall` row is
recall's WHOLE cost share, and `embed_memory` is once again exactly what `MemoryEmbeddingWriter`
spends writing vectors — nothing else. An untagged site records `feature = 'unknown'`. Switch
`mezo.feature.llm-log.enabled` off ⇒ the injected recorder is the no-op ⇒ nothing happens; the
adapters never branch on the switch.

**Shared RAG retriever seam (`mezo-6dii.4`, wired to chat by `mezo-6dii.6`).** The
`MemoryRetriever` contract has four
named implementations (`dense`, `lexical`, `facts`, `graph`). Dense is the only adapter that crosses
the `EmbeddingPort` provider seam and embeds `PreparedMemoryQuery.denseQuery`; lexical and facts are
local PostgreSQL reads, while graph delegates to the existing deterministic
`GraphTraversalService`. Every adapter receives the same owner/as-of/policy envelope and returns
`MemoryCandidate` source identity, label/content, local score and selection signals. The shared
coordinator calls them for every SHADOW audit and every NEW served turn; OLD never invokes them.

**Shared RAG context seam (`mezo-6dii.5`, chat rollout `mezo-6dii.6`).**
`MemoryContextService.retrieve` is the
single consumer-neutral entrypoint above all four retrievers. It returns rendered context and
structured provenance together, while `MemoryReranker` keeps optional ordering replaceable without
coupling the coordinator to an orchestration framework. `ChatMemoryContextAdapter` is the first
consumer: OLD preserves the frozen path; SHADOW asynchronously writes comparison audits without
touching the response; NEW serves the unified block and falls back to OLD only after a total
retriever outage has itself been audited. Sync and SSE consume the same payload. Briefing, memoir
and prediction remain on their existing paths until their own staged rollout tasks.

**Retrieval feedback seam (`mezo-6dii.7`).** `MemoryItemFeedbackService` links user judgement to
the immutable, selected retrieval audit result, not directly to an arbitrary client-supplied
memory ID. A pessimistic result-row lock makes the find/create upsert safe under concurrent first
writes and also serializes terminal-state checks.
Canonical suppression then reuses the shared `memory_item.state` lifecycle already enforced by
dense and lexical retrieval. The FE consumes it through the standard `@/data/hooks` boundary;
one page-level hook owns batching/cache/rollback, while `RecalledMemoriesRow` stays a handle-driven
component and never issues per-card requests.

### 5.4 Companion ↔ API contract & backend platform (wired)
Companion is now a backed feature on the contract-first pipeline
([`_platform-api-backend.md`](_platform-api-backend.md) §3–§4): `companion.yml` → merged
`api/openapi.yml` → generated `CompanionApi` + DTOs (backend) and `api.gen.ts` types (FE). Drift =
compile error.

### 5.5 Companion ← other features (✅ V0.3 wired — read-only)
**`ContextSnapshotAssembler` is live**: companion now injects reads from **twelve** other
features — `biometrics` (`BiometricProfileRepository`, `WeightTrendService`, `WeightLogRepository`,
`SleepLogRepository`, `CheckInRepository`), `goal` (`GoalRepository` + the prescription jsonb), `train`
(`MesocycleRepository`, `GymScheduleService`, `SportService`, `WorkoutSessionRepository.findDoneInstanceDates`,
`SportSessionRepository`/`RunSessionLogRepository` since-date finders), `gamification`
(`GamificationService.getProfile`), `progression` (`ProgressionService.getProfile`,
`GrowthWeekService.growthWeek`), `quest` (via the `TodayQuestSource` port, NOT a direct
`DailyQuestRepository`/`QuestService.getDay` dependency — `quest` already depends on `companion`
for `QuestFlavor`'s AI rewriting, so companion importing `feature.quest` directly would form a
2-slice cycle; `QuestService.getDay` is write-transactional either way), `habit`
(`HabitService.summary`), `intention` (`IntentionService.getDay`), `ritual` (`RitualService.getDay`),
`meal` (`FuelDayService`), `fuel` (`ProtocolService`, `IntakeService`) and `medication`
(`MedicationRepository`, `MedicationCycleService`). `GamificationService`, `HabitService`,
`IntentionService` and `RitualService` are each `@ConditionalOnProperty`-gated by their OWN switch
(`GAMIFICATION_SWITCH`/`HABIT_SWITCH`/`INTENTION_SWITCH`/`RITUAL_SWITCH`), so the assembler holds
them as `ObjectProvider<T>` and resolves via `getIfAvailable()` — any one of those switches off
while `COMPANION_SWITCH` stays on degrades only that block's affected part to `nincs adat` rather
than failing Spring context startup with a missing-bean error. **Contract crossing the seam:**
`render(UUID userId, LocalDate today) → String` — the callee services' read methods with explicit
`userId` scoping; feature-slice dependencies stay cycle-free (`feature_slices_are_cycle_free`,
`ArchitectureTest`) — ports like `TodayQuestSource`/`QuestLedgerSource` are how a two-way data need
between two features is kept one-directional at the package level.
V0.3 also added four derived finders to those features' repos (sleep/check-in latest, sport/run
since-date) — plain finders, no companion dependency.

**V0.5 tools seam (✅ wired, now 15 tools since mezo-xixu).** The read tools in
`feature/companion/tools/` compose the same one-way reads (see §4 catalog). V0.5 added **three
plain finders** to the owning features' repos
(the V0.3 precedent — no companion dependency): `SleepLogRepository` since-date,
`WorkoutSessionRepository.findDoneInstancesBetween` (entities variant of `findDoneInstanceDates`,
same ≥1-logged-set semantics), `SupplementIntakeRepository` since-date — plus the static
`GoalPrescriptionJson.currentSegment` helper extracted from the snapshot assembler (both now
share it). Guard rails: tools call ONLY read methods (`GoalEngineService.evaluate` is a WRITE and
is deliberately not wrapped); the IDENT-2 ArchUnit rule bans HTTP/mail client deps in the tools
package.

mezo-ohce added a fourth plain finder —
`SleepLogRepository.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc` (inclusive window,
newest first) for `get_recovery`'s detail mode.

**V1.1 facts seam (✅ wired).** The knowledge-fact block is companion-internal (no cross-feature
read), but it is the seam the later slices hang onto: V1.2's extraction now writes `learned_fact`
candidates and its decision flow promotes them into `knowledge_fact` (source=`chat`); V1.3's
redundancy guard reads the same confirmed set; V3.3 promotes patterns into it (source=`pattern`)
and increments `reinforcement_count`.

**V1.2 Knowledge UI seam (✅ wired).** `useKnowledge()`/`useKnowledgeActions()`
(`data/insights/knowledgeHooks.ts`) serve BOTH knowledge surfaces at the time (Insights
KnowledgeListPage — real inbox + toggles; Me KnowledgePage — mock-mode graph prototype, real-mode
honest `edges: []`) — **since `mezo-ms9a` (2026-09-01) there is only one surface**, the unified
`KnowledgeListPage` (`insights.md` §2.4); `useKnowledge()`'s `edges` field is still the same
mock-only leg, just with a single consumer now.
**Contract crossing the seam:** `knowledgeApi` maps the wire (`factText`/`includeInPrompt`/
`reinforcementCount`, `candidateText`) onto the lean FE domain (`text`/`active`/`reinforced`);
`FactCategory` IS the backend enum since V1.2 ([`insights.md`](insights.md) §2.4, §5.1).

**V2.2 daily-digest seam (✅ wired — read-only, one-way).** `DailySummaryService.digest` composes
the same owning-feature reads the snapshot/tools use, but date-scoped to ONE past day:
`WorkoutSessionRepository.findDoneInstancesBetween(date,date)` + set counts, sport/run since-date
finders filtered to the day, `FuelDayService.getDay(date)`, sleep/check-in by-date finders,
`MedicationCycleService.derive(userId, med, date)` (it already took an explicit date), and ONE new
plain finder in the owning feature (`WeightLogRepository.findFirstBy…AndDate…` — the V0.3/V0.5
precedent). The nightly job fans out over the ACTIVE + onboarded accounts via `UserFanOut.forEachActiveUser`
(S6, `mezo-qw37.6` — companion → auth read), each user's body under `LlmActorContext.runAs`.

**V2.3 recall seam (✅ wired).** `find_similar_past_days` is companion-internal (tools →
`MemoryRecallService` → the V2.1 repository + V2.1 `EmbeddingPort`) — no new cross-feature reads.

**W3.1 ambient-recall seam (✅ wired, `mezo-b3pp.12`).** Also entirely companion-internal
(`ChatService` → `PromptMemoryAssembler` → `MemoryEmbeddingAnnQuery` + the V2.1 `EmbeddingPort`) —
no new cross-feature reads, no contract change (the `MessageRef` envelope already carries free
`kind`/`id` strings and `Memory` was already an emitted kind), no frontend change: the recalled days
render through the SAME generic ref chips the V2.3 tool has been feeding since then. The kinds it
searches are exactly the ones the W1.x embedding seams above populate, which is why W3.1 could ship
without touching any of them. **W3.3 (`mezo-b3pp.27`) added one read INSIDE companion**: the
chat_turn ANN query now correlates against `ai_message` (`ref_id not in (select m.id from ai_message
m where m.conversation_id = …)`) to skip the conversation being answered — same feature, same
schema, still no cross-feature reach.

**V3.1 patterns seam (✅ wired — read-only, one-way).** `MetricSeriesService` composes the
owning features' existing reads date-scoped (sleep/sport/run/workout+sets/meal/FuelDay/medication
cycle/water/weight/check-in) — zero new cross-feature finders v1; `PatternsPage` consumes
`usePatterns`/`usePatternActions` from `@/data/hooks` ([`insights.md`](insights.md) §2.1).
**V3.4 widened the read set** (still read-only, one-way): exercise-feedback, habit-day,
ritual-day, mention and medication-dose repositories; the only NEW
finders are two derived queries on `RitualDayRepository` — since `mezo-b3pp.2` their
closed-only forms (`findByCreatedByAndRitualDateBetweenAndClosedAtIsNotNull`,
`findFirstByCreatedByAndClosedAtIsNotNullOrderByRitualDateAsc`; the original
row-existence variants are deleted) — no migration. The digest additionally reads `MentionRepository` + `DailyIntentionRepository`.
**Activity/quest XP comes through the PORTS, not repositories** — `feature.activity` and
`feature.quest` depend on companion (LLM callers), so a direct companion → activity/quest
repository read closes a slice cycle (`feature_slices_are_cycle_free` caught exactly this);
`TodayActivitySource.awardedXpByDay` + `TodayQuestSource.completedXpByDay` extend the existing
inversion ports, consumed via `ObjectProvider` (absent bean = that source contributes nothing).

**S1 close (`mezo-tk88.3`) added the FIRST port pointing the OTHER way.** Every port above lets
companion pull data IN from a feature that itself depends on companion. The pattern-pair-detail
endpoint needs the opposite: `PatternPairDetailService` (companion) needs predictions/experiments/
challenges grounded on a pattern (`source_pattern_id`, S2 `mezo-tk88.2`) — but those live in
`feature.proactive`, which ALREADY imports companion extensively (§ below), so a direct companion
→ proactive import would open a brand-new 2-slice cycle (`feature_slices_are_cycle_free` is
FROZEN — only the pre-existing biometrics↔goal/meal↔recipe cycles are tolerated; a NEW cycle
fails outright). **`PatternImpactSource`** (`feature.companion.service`, plain interface, no
`ObjectProvider` needed since its implementor is unconditioned relative to it — see below) inverts
the dependency exactly like `TodayQuestSource` does, just mirrored: `PatternPairDetailService`
depends only on its own package; the real assembly (`feature.proactive.service.PatternImpactService`)
imports `feature.companion` (the already-existing direction) and implements the interface — Spring
wires it in, no compile-time edge crosses the boundary in the new direction.

**`HighlightCitationSource`** (`feature.companion`, `mezo-d20.7.7`) is the third instance of the
same inversion, and the one that closes the weekly review's highlight loop: it answers "in how many
of the last 12 live weekly reviews was this pattern/fact cited?", implemented by
`feature.proactive.service.HighlightCitationSourceAdapter`. Consumed through an `ObjectProvider`
(the adapter needs BOTH switches, so it can genuinely be absent), and that absence surfaces as a
`null` `citedWeeks` — not measurable is not zero. Two hard boundaries, both deliberate:
`PatternEntity.confidence` (a statistic) is never touched by a citation and a citation never moves
a pattern's status; and `KnowledgeFactEntity.reinforcementCount` keeps meaning "the USER re-stated
this" rather than being widened to cover the model quoting its own knowledge — the citation acts
only as a tie-breaker UNDER reinforcement inside `KnowledgeFactService.renderPromptBlock`. Full
rationale in [`proactive.md`](proactive.md) §5.12.

`PatternImpactService`
is `@ConditionalOnProperty(COMPANION_SWITCH)` — the SAME switch as `PatternPairDetailService`, not
`PROACTIVE_SWITCH` — so the detail endpoint always resolves a bean when companion is on; with the
proactive generators off it just lists nothing (the finder repositories are plain, unconditioned
Spring Data beans). See [`proactive.md`](proactive.md) §5.1 for the mirror-image writeup.

### 5.6 Companion → Train: the end-of-mesocycle AI review (✅ wired, `mezo-meyc.3` S3)

The one place the companion **writes into another feature's table**, and the first one triggered by
another feature's domain event rather than by a chat turn or a cron.

- **Trigger.** `train` publishes `MesocycleClosed(userId, mesocycleId)` (`feature/train/MesocycleClosed.java`)
  inside the transaction that persists a `mesocycle_report` row — the real close and every accepted
  `regenerate`. `MesoReviewListener` (`service/MesoReviewListener.java`) consumes it
  `@Async @TransactionalEventListener(AFTER_COMMIT)` — the `FactExtractionListener` idiom. AFTER_COMMIT is
  load-bearing: the generator reads the row back from another thread, so it must never see an
  uncommitted (or rolled-back) report. Gated on the COMPANION switch **only** — deliberately not also on
  `mezo.feature.meso-review.enabled`, unlike `FactExtractionListener`'s two-switch shape, because the
  deterministic context half must be assembled even when the narrative is off.
- **Context.** `MesoContextAssembler` (`service/MesoContextAssembler.java`) buckets the run's window
  `[startDate, closedAt ?? endDate]` into its meso-weeks (an inlined copy of train's package-private
  `MesoWeeks.weekOf` — 1-based, `startDate`-anchored 7-day buckets, clamped to `[1, weeks]`) and rolls up
  nine `MetricSeriesService` series per bucket (`SLEEP_DURATION_H`, `SLEEP_QUALITY`, `DAILY_KCAL`,
  `DAILY_WATER_ML`, `CHECKIN_ENERGY`, `CHECKIN_STRESS`, `WEIGHT_DELTA_KG`, `SPORT_LOAD_MIN`,
  `TRAINING_RPE`) plus per-day kcal TARGETS (`FuelDayService.getWeek`, the same target source
  `ContextSnapshotAssembler#fuelBlock` reads — batched, one call per aligned 7-day block) and session ROW
  counts from `SportSessionRepository`/`RunSessionLogRepository` (open-ended `date >= from` finder, upper
  bound applied in memory — the `MetricSeriesService` idiom). Output is the **train-owned**
  `MesoContextJson` record. Only weeks that actually contain a day in the window are emitted, so a run
  closed early has no all-null tail buckets. **Honest absence:** every average and measurement sum is
  `null` when its bucket carries no datapoint (a week with no weigh-in must not read as "0 kg change");
  the three ROW COUNTS (`sportSessions`/`runSessions`/`mealCoverageDays`) are the exception — their
  denominator (the bucket's calendar days) is known, so a 0 there is a fact, and it is what makes the
  neighbouring averages readable.
- **The metric legend (fix round 1) — the part that keeps the narrative honest.** Two context field names
  promise more than they measure, and the contract shape is train-owned so renaming them is not an option:
  `gymRpeAvg` is `TRAINING_RPE`, i.e. the **sport + run** RPE average with **no gym data in it at all**;
  `weightDeltaKg`/`weightChangeKg` sum `WEIGHT_DELTA_KG`, which only yields a point when **two consecutive
  days** were weighed, so weekly weigh-ins produce null rather than a run-long change. On top of that, no
  average carries its coverage denominator (2 of 7 nights reads identically to 7 of 7). So
  `MesoReviewGenerator.LEGEND` is prepended to the user payload, **before** the JSON blocks, spelling all
  of it out in Hungarian (plus "null = no data, don't estimate" and "a late close can make the last weekly
  bucket span more than 7 days"), and the system prompt instructs the model to interpret the fields by that
  legend and qualify accordingly. Keep `MesoContextAssembler`'s metric→field mapping and the legend in
  sync — the class javadoc says so on both sides, and `MesoReviewGeneratorIT` asserts the legend's presence
  and that it PRECEDES the data (a legend after the JSON is a legend the model skipped).
- **Narrative.** `MesoReviewGenerator` (`service/MesoReviewGenerator.java`) is a one-shot SMART-tier
  generator in the `MemoirGenerator` shape: PURE-CODE gather (the legend + run title + window + the owner's self-eval +
  the frozen `report` jsonb + the fresh `context` jsonb, serialized verbatim — nulls kept, because they
  ARE the "no data" signal the prompt tells the model to name instead of fill in) → ONE
  `companionLlm.completeSmart` inside `llmCallContextHolder.runWith(new LlmCallContext("meso_review",
  "generate", "mesocycle", id))` → `ai_eval` + `ready` + `ai_eval_generated_at`. The system prompt
  (`MESO_REVIEW_MARKER = "[MESO_REVIEW]"` + a Hungarian instruction block) asks for four sections in
  order — *mit sikerült / mi akadt el / kereszt-domain mintázatok / javaslatok a következő futamra* — in
  4–8 plain-prose paragraphs, ADR 0010 tone (non-judgmental, pattern-focused, hedged rather than causal)
  and with clinical/medication claims explicitly forbidden.
- **Ordering + failure.** The context is assembled and persisted **first, in its own transaction**, and only
  then is the model called: a provider outage must still leave the lifestyle context on the report page.
  `generate` is therefore NOT `@Transactional` (each step commits alone, and no DB connection is held
  across the round trip). Any failure — provider error, or an empty answer, which is treated as a degrade
  rather than an exception (the `MemoirGenerator` precedent) — is swallowed into a persisted `failed`
  status; nothing ever escapes to the `@Async` executor's default handler.
- **Both terminal writes go to a freshly RE-READ row** (`markReady` / `markFailed`), never to the pre-call
  snapshot: seconds pass during a real round trip, and a `regenerate` landing in that window has already
  written a new `report` jsonb (and possibly a `selfEval`). Merging the snapshot would silently revert them,
  so only the three AI fields are set on the fresh entity. `markReady` is public purely so
  `MesoReviewGeneratorIT` can pin that behaviour — no end-to-end test can observe it, because the fake LLM
  returns long before any concurrent write could be orchestrated.
- **Idempotency.** Work happens ONLY while `ai_eval_status = 'pending'`, the state `computeAndStore`
  leaves behind on every close and regenerate — where it now also **nulls `context`**, since a context
  computed against the old numbers/window must not survive beside fresh ones (with the switch off nothing
  would ever overwrite it). A `ready`/`failed` row is left completely untouched including its context, so
  the listener firing twice can never burn a second smart-tier call or overwrite a narrative the user is
  reading. Re-generation is requested by resetting the status.
- **Switch off.** With `mezo.feature.meso-review.enabled=false` the **train-owned** `MesoReviewGate`
  marker bean is absent and `generate` returns right after the context write; the row stays `pending`,
  which is harmless because `getReport` reports `aiEvalEnabled: false` and the FE hides the AI section
  instead of polling. The gate is consumed via `ObjectProvider` rather than a `@ConditionalOnProperty` on
  the generator precisely so the context half keeps being written.
- **Why the gate lives in `train`.** `companion` already depends on `train`; a gate declared in
  `companion` and consumed by `train`'s `MesocycleReportService` would close a brand-new `train↔companion`
  package cycle (`ArchitectureTest.feature_slices_are_cycle_free` only tolerates the two frozen ones).
  Consuming it *from* companion is free — companion→train is the sanctioned direction. See
  [`train.md`](train.md) §5 for the mirror-image writeup.

**V3.3 promotion seam (✅ wired — the loop closes).** Pattern-confirm →
`knowledge_fact(source=pattern)` → the V1.1 top-N injection carries it into every prompt → the
V3.1 nightly re-detection reinforces it → the reinforcement raises its injection rank. The next
epics (proactive briefing/heartbeat/memoir, Fuel P8) build on the now-complete
snapshot+facts+summaries+patterns stack — see the roadmap's "Relationship to other roadmaps".

### 5.7 Companion feedback → every AI surface (✅ W4.1 wired, `mezo-b3pp.15`)

`message_feedback` is companion-owned but **votes on artifacts five of them do not belong to** — the
one seam in this doc that fans OUT to three other features at once. The crossing contract is the
`(artifactKind, artifactId)` pair; nothing is joined server-side.

| Kind | Artifact table | Owner doc | FE surface |
|---|---|---|---|
| `chat_message` | `ai_message` | this doc (§4) | `ChatPage` assistant bubbles ([`insights.md` §2.5](insights.md)) |
| `feed_message` | `companion_message` | [`proactive.md` §4](proactive.md) | `MezoMessagesSheet` ([`today.md` §1](today.md)) |
| `weekly_suggestion` | `weekly_suggestion` | [`proactive.md` §4](proactive.md) | Weekly „heti tervjavaslat" card ([`insights.md` §2.2](insights.md)) |
| `weekly_review` | `weekly_review` | [`proactive.md` §10](proactive.md) | `WeekReviewCard` (`WeekHubPage` — [`me.md`](me.md)), `mezo-p2tr` |
| `memoir` | `memoir` | [`proactive.md` §4](proactive.md) | `MemoirPage` ([`insights.md` §2.3](insights.md)) |
| `prediction` | `prediction` | [`proactive.md` §4](proactive.md) | `PredictionsPage` cards ([`insights.md` §2.6](insights.md)) |
| `day_review` | `day_review` | this doc (§3/§4, `mezo-jcpt.4`) | `DayReviewCard` (`WeekDayPage` — [`me.md`](me.md)), `mezo-jcpt.9` |

Three of those artifacts had **no `id` on the wire** before this slice — `FeedMessageResponse`,
`WeeklySuggestionResponse` and `MemoirResponse` gained a required `id` (contract-only; the entities
always had one), because without it the FE has nothing to vote on. See [`proactive.md` §4](proactive.md).
The FE side is a single page-level hook + one shared controlled component
(`useFeedback(kind, ids)` / `FeedbackChips`) — [`insights.md` §4/§5.7](insights.md).

**`weekly_review` and `day_review` both vote on the row that carries the artifact itself, not
on a separate generated-message row** — `WeeklyReviewEntity.id` and `DayReviewEntity.id`
respectively — so their FE cards (`WeekReviewCard`, `DayReviewCard`) gate the chip row on that
id's presence rather than on any scored/closed state: a scored day whose prose generation failed
carries no `reviewId` and therefore no chips either (`DayReviewCard.tsx` — see
[`me.md`](me.md) "Day page").

**Accepted limitation — a vote survives a prose regeneration (`day_review`, `mezo-jcpt.9`).**
`DayReviewService.upsert` rewrites the `day_review` row IN PLACE on an `inputsHash` change (a
new LLM narrative for the same day), so the row's `id` — and therefore any 👍/👎 already cast on
it — is stable across a regeneration: a vote stays attached to "this day's review as an
artifact" even after its prose has been rewritten underneath it. This is accepted rather than
fixed: a closed day's inputs rarely change after the fact, and the alternative — deriving the
feedback `artifactId` from the `inputsHash` instead of the row's own id — would abandon the house
row-id pattern every other kind in the table above follows (§5.7), trading a rare staleness for a
structural inconsistency.

**Deferred — `weekly_review` and `day_review` votes do not reach the learning rollup.**
`FeedbackLearningService.SURFACE_KINDS` (§5.7a below) lists only `chat_message`, `feed_message`,
`weekly_suggestion`, `memoir` and `prediction` — both `weekly_review` (live since `mezo-p2tr`) and
`day_review` (`mezo-jcpt.9`) are captured and readable via the batch API but never rolled up, so
their votes are write-only today. Deliberately deferred to bd `mezo-jcpt.17`; nobody had
previously documented that this also affects `weekly_review`.

**The batch read is chunked at the api layer (`mezo-b3pp.23`).** At the old single-request shape,
200 comma-joined uuids put the query string alone at ~7.45 KB — under Tomcat's default 8 KB
`server.max-http-request-header-size` by itself, but the full request (that query string plus the
`Authorization: Bearer <JWT>` header and a real browser's own headers) pushed the total over that
budget, which this repo does not override. Tomcat answered a bare
400 with no `MessageFeedbackResponse[]` body, `useDualQuery` degraded to `realEmpty`, and every
chip on the page read unvoted — the next vote's `invalidateQueries` then reverted the one chip the
user had just tapped, because the refetch it triggered hit the same wall. `feedbackApi.list`
(`frontend/src/data/feedback/feedbackApi.ts`) now splits `ids` into `FEEDBACK_IDS_PER_REQUEST`
(100) uuids per request, fires the chunks with `Promise.all`, and flattens the merged pages before
returning — a header-budget number, not a contract one (the contract's per-request `maxItems` is
still 200, unchanged). The chunking lives entirely in the api layer on purpose: `useFeedback` keeps
running ONE `useDualQuery` with ONE cache key, and none of its optimistic-write/rollback/invalidate
machinery had to move. One failing chunk rejects the whole `Promise.all` call, deliberately — a
partial merge would leave some chips reading unvoted with no signal that anything had failed at
all, which is worse than the honest all-degrade `useFeedback` already does for a wholly failed read.
`FEEDBACK_MAX_IDS` changed meaning alongside it: it moved from 200 to 1000 and is no longer a
header-budget ceiling (chunking owns that now) but an overall fan-out ceiling of ten requests per
page hydration, still applied in `feedbackHooks.ts` as `slice(-FEEDBACK_MAX_IDS)` — newest-ids-win,
unchanged. This closes a second bug the bd never named: that `slice` already silently dropped the
oldest ids on any page past 200 rendered artifacts, **before** the header limit was ever reached
(the chat page renders oldest-first, so a conversation past 200 assistant messages showed its
oldest chips as permanently unvoted). That is why the bd's own alternative of lowering the cap to
~120 was rejected — it would only have moved that silent loss from 200 down to 120, not removed it.
The bd's other alternative, overriding `server.max-http-request-header-size` to 16 KB, was also
rejected — both rejections were confirmed with the human partner in favour of chunking. Past the
new 1000-id ceiling the oldest ids are still dropped, same failure mode an order of magnitude
further out; the residual is real and the actual cure is windowing `CompanionController.listMessages`
(`GET /api/companion/conversation/{id}/messages`, §6 above), which returns the whole conversation,
unwindowed, today.

#### 5.7a Feedback → nightly rollups (✅ W4.2 wired, `mezo-b3pp.16`)

Every finished night, `FeedbackLearningJob` walks every user and calls
`FeedbackLearningService.computeRollups(userId)`, which reads the last `window-days` (default 30)
of `message_feedback` (by **`updated_at`**, so an edited or re-cast verdict re-enters the window)
and overwrites 11 + N `feedback_rollup` rows in place (N = configured intervention keys, W5.2,
currently 6): per-surface effectiveness, per-feed-kind effectiveness (resolved through the
`FeedMessageKindSource` port to `companion_message.kind`), one `style` row with a per-surface
down-reason histogram, and one `intervention:<key>` row per library entry (§4 above). No prompt,
no UI — this is a rollup-only table. Its readers: W4.3's `ProfileAssembler` (`mezo-b3pp.17`, folds
all scopes into the weekly profile synthesis) and, since W5.2, `InterventionService`'s selection
math reads back the `intervention:<key>` rows to pick the best-weighted card (§4 above). **Known,
harmless gap:** a key removed from `mezo.companion.interventions` leaves its `intervention:<key>`
row behind in `feedback_rollup` forever — nothing prunes or zero-fills a retired key's row, because
nothing reads it either (`InterventionService` only ever looks up keys still present in the live
config).

### 5.8 Companion flags → Proactive interventions (✅ W5.2 wired, `mezo-b3pp.19`)

**One-way, event-driven, cross-feature — the `CompanionMessageEventListener` shape reused across a
feature boundary.** `FlagService` (companion) publishes `FlagRaisedEvent`; the LISTENER
(`InterventionEventListener`) and the delivery service (`InterventionService`) both live in
`feature.proactive`, not here — companion knows nothing about `companion_message`, cards, or push.
This mirrors `feature.proactive` already depending on `feature.companion` everywhere (the
`FeedMessageKindSource`/`PatternImpactSource` precedent, §4 above): the dependency runs companion →
proactive via a plain domain event (no import needed in either direction for the event type itself,
`FlagRaisedEvent` lives in `feature.companion.flags.service` and `feature.proactive` imports it),
so ArchUnit's frozen `feature_slices_are_cycle_free` rule is untouched. See
[`proactive.md`](proactive.md) §3/§5 for the receiving side and
[`_platform-notifications.md`](_platform-notifications.md) §3d for the push anchor + quiet hours.

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
# → event:delta 
 data:{"text":"..."}   (0..n times)
# → event:done  
 data:{ ...persisted assistant MessageResponse... }
```

Note: `tools`/`refs` fill up when the turn used tools (V0.5) — with the fake adapter you can
force it deterministically: `{"content":"aludtam eleget? [fake-tool:get_recovery {\"scope\":\"sleep\",\"days\":3}]"}`.
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

**Shared RAG persistence foundation (`mezo-6dii.1`).**
`feature/companion/memory/MemoryPlatformPersistenceIT.java` runs against real PostgreSQL/pgvector
and proves typed jsonb plus arrays round-trip, two embedding generations coexist, duplicate item
generations fail, owner B cannot read owner A's item, and physical audit-run purge cascades through
result and feedback. Its migration invariants also assert that every live legacy embedding has a
canonical item and ready v1 vector. `MemoryItemPopulator` supplies valid canonical/audit fixtures;
all five tables are reset before the legacy `memory_embedding` table.

**Canonical dual-write and re-embedding (`mezo-6dii.2`).**
`MemoryEmbeddingWriterIT` and `MemoryProjectionWriterIT` cover all ten source kinds plus
idempotent update/no-op, suppress and revive behavior. `MemoryProjectionFailureIsolationIT` forces
the NEW write to fail and proves the committed OLD row remains available. `MemoryReembeddingIT`
covers pending-batch resume, matching-hash skip, stale-hash refresh, stable provider failure + retry,
coexisting v1/v2 generations, and active/onboarded-user fan-out. The frozen OLD retrieval suite
(`AmbientRecallEvalIT`, `NoteVectorLifecycleIT`, `TurnEmbeddingListenerIT`) remains the regression
gate while serving has not cut over.

**Adaptive query preparation (`mezo-6dii.3`).**
`memory/service/MemoryQueryAnalyzerTest` pins the closed Hungarian routing table, history requirement and ISO-date
bounds as a pure unit test. `MemoryQueryPreparerIT` uses the profile-gated `FakeCompanionLlm` to
prove scripted standalone rewriting, raw-query retention, latest-six/nonblank/500-character history
bounds, raw fallback on provider failure/blank/oversized output, and zero LLM calls for no-memory or
self-contained requests. No test reaches a network model.

**Hybrid candidate retrievers (`mezo-6dii.4`).**
`HybridMemoryRetrieverIT` runs all four real retriever beans against PostgreSQL/pgvector with the
profile-gated fake embedder. Its matrix covers semantic and exact-term hits, old salient memory,
suppressed/superseded/expired/future rows, serving-vector version and content-hash eligibility,
current-conversation exclusion, cross-user isolation, fact pinning/opt-out/conflict expansion, and
stable graph-edge mapping. A forced wrong-dimension ANN call plus invalid limits prove dense,
lexical and fact JDBC failures propagate while their savepoints leave the enclosing transaction
usable. The dense case also executes `EXPLAIN (ANALYZE, BUFFERS)` over seeded data as a diagnostic;
no planner cost or node choice is asserted.

**Fusion, selection, audit and retention (`mezo-6dii.5`).**
Pure tests pin weighted RRF/dedupe/tie order, canonical source reliability, bounded recency,
duplicate/conversation caps, exact conflict pairs plus standalone conflict edges, exact rendered
budgets and strict reranker ID validation/deadline fallback. `MemoryContextServiceIT` uses the
four real retrievers plus fake embedding/LLM and proves no-call routing, parallel success, isolated
dense failure, total failure → audited empty context, raw/rewrite fields, timing/count/error trace,
selected result IDs, score JSON and cancellation of timed-out work. `HybridMemoryRetrieverIT`
additionally proves conversation identity and exact conflict counterparts survive the real SQL →
candidate seam. `MemoryPlatformPropertiesIT` proves valid binding and startup
rejection for invalid positive bounds. `MemoryRetrievalRetentionIT` proves the active-user purge
hard-deletes an expired run and cascade children while preserving a recent run.

**Chat rollout (`mezo-6dii.6`).**
`ChatServiceAmbientRecallIT` and `ChatStreamServiceIT` are pinned explicitly to OLD so their frozen
prompt/envelope assertions remain a compatibility gate. `ChatMemoryShadowRolloutIT` proves both
sync and SSE return that legacy payload while an audit run eventually appears off-thread.
`ChatMemoryRolloutIT` runs NEW through both delivery paths and proves one unified block (no duplicate
legacy fact/graph blocks), stable run/result/item disclosure IDs, cross-owner isolation and dense
provider failure degrading to lexical context. `MemoryContextServiceIT` separately forces every
retriever to fail and proves the serving variant persists the explicit fallback error before chat
uses OLD.

**Retrieval feedback and suppression (`mezo-6dii.7`).**
`MemoryRetrievalFeedbackApiIT` pins authentication, owner-only batch reads, idempotent action
switching, concurrent first writes, foreign/mismatched/unselected run-result 404s, request bounds,
invalid-action validation, non-canonical suppression 400, terminal suppression and the real
retrieval consequence of canonical suppression. Frontend hook tests pin one
deduplicated batch GET, network-free mock state, optimistic rollback and the suppression toast;
`RecalledMemoriesRow.test.tsx` pins non-nested article/button semantics, display-only legacy rows,
selection state and the two-tap destructive guard. `ChatPage.test.tsx` proves two assistant rows
still cause one feedback batch request.

**Synthetic Hungarian memory eval (`mezo-6dii.8`).**
`MemoryEvalMetricsTest` pins the metric arithmetic with hand-calculated graded examples.
`SyntheticMemoryCorpusGenerator` deterministically validates and reproduces `memory-hu-v1`; writing
artifacts and approving the exact reviewed holdout are separate explicit system-property entry
points. Its normal CI path also re-runs the generator's uniqueness, near-duplicate, persona-shape and
minimum-size validators against the committed artifacts. `MemoryRetrievalDeterministicEvalIT` seeds
real PostgreSQL/pgvector rows for all three users, runs OLD and NEW with the profile fake, compares
both paths at final selected-context stage, emits both metric sets, and gates split integrity, a
competitive same-axis ownership counterfactual, a modest geometry-only smoke floor, empty routing
and zero cross-owner leakage. The committed holdout has 324
questions, but fake vectors cannot validate Hungarian semantic quality, latency or the 85% Recall@5
release threshold; those remain the opt-in real-provider responsibilities of `mezo-6dii.9`.

**Daily evaluation (`mezo-jcpt.4`, plan 2/2).**
`feature/companion/service/DayEvaluationEngineTest.java` is the formula's unit-level pin — one test
per honesty rule, per dimension (asymmetric kcal bands, protein surplus forgiven/deficit counted,
workout-day kcal widen, missing-data-vs-missing-target degrade paths, weight renormalization
summing to 1.0, the rest-day-is-neutral rule, the circular meal-timeliness clock distance, the
rhythm mean-of-priors gate). `feature/companion/config/DayEvaluationPropertiesTest.java` pins the
startup weight-sum validation. `feature/companion/service/DayScoreServiceIT.java`
(`fullDayEvaluatesEveryDimensionAndProjectsTheLegacySubscores`) pins the input-loading map AND the
legacy `DaySubscores` projection end to end against real repositories; `emptyDayYieldsNullEverything`
pins the honest-null floor. `feature/companion/service/DayReviewServiceTest.java` pins the prose
cache (`inputsHash` hit serves with zero LLM calls, a hash mismatch regenerates, delta clamping
both directions, a reason-less adjustment discarded, highlight-kind normalization, and every
degrade path — a throwing port, an unparseable answer — still serving the deterministic evaluation
with an empty narrative). `feature/companion/controller/DayEvaluationApiIT.java` covers the full
`GET /api/me/day/{date}/evaluation` response per state (scored/in_progress/future), the
`DAY_REVIEW_SWITCH` bean presence, and 401; `DayEvaluationSwitchOffApiIT` pins the switch-off
degrade at the HTTP layer. `feature/companion/DayReviewRepositoryIT.java` pins the partial unique
index (soft-delete-aware) on `day_review (created_by, date)`.

**Weekly review data layer + anchored conversations (`mezo-p2tr`).**
`feature/companion/controller/MeWeekControllerIT.java` covers the
7-day response shape, the `ME_WEEK_START_NOT_MONDAY` 400, and the weekly-aggregate math.
`AnchoredConversationIT` covers `CreateConversationRequest.context` persisting `context_kind`/
`context_date`, the server-generated opening turn landing as an assistant-only row (never a user
row), and a failed opening-turn LLM call leaving the conversation created-but-empty rather than
failing the create call. Full formula/weekly-narrative test list: [me.md §8](me.md) /
[proactive.md §8](proactive.md).

**The `companion-fake` profile trick.** `@ActiveProfiles("companion-fake")` **merges** with the
base test profiles (`AbstractIntegrationTest`/`ApiIntegrationTest` run `demodata`), so the fake
adapter replaces Gemini while everything else stays real. `FakeCompanionLlm.complete/stream`
**echo three parts, not two** (mezo-q71s — the fake widened alongside the port's inversion):
`"FAKE-LLM system=[…] history=[…] user=[…]"`, where `history=[…]` is `ChatHistory.render(history)`
(`FakeCompanionLlm.java:366-368`). This is what makes **prompt assembly assertable**: `ChatServiceIT`
asserts the persisted answer's `system=[…]` segment contains the companion voice (`"Te vagy a
mezo"`, the drug-name-free clinical guard `"Gyógyszer adagolására vonatkozó változtatást"`)
and the `TONE_REMINDER` text but **NOT** any prior turn's content, the
`history=[…]` segment contains the windowed `"Daniel: …"`/`"Mezo: …"` transcript, and the
`user=[…]` segment is exactly the current message — never the history. Before mezo-q71s this was a
two-part echo with the history rendered INSIDE `system=[…]`; the three-way split is the single
test surface that would fail if the history were ever accidentally reglued into the system prompt
(see also the dedicated history-separation IT below).

**`ContextSnapshotAssemblerIT` (V0.3, 24 tests)** — the snapshot is fully assertable without any
LLM: empty-user render (all eight blocks in order, every absence an explicit `nincs adat`, config
targets still render), profile+trend, latest weigh-in beside the trend (`mérés:` — populated vs.
`nincs adat` with no weigh-in row vs. two same-day weigh-ins, where only `created_at` breaks the
tie), current-week segment + planner selection, train digest +
schedules, digest-window exclusion, **tomorrow's dated gym+sport+run resolution (mezo-xixu — the
regression guard for the observed hallucination bug: tomorrow's meso-template gym day + exercises,
the matching sport-schedule slot, the active running block's prescribed session for that weekday,
and the honest rest-day fallback when no template matches today OR tomorrow's weekday)**, account
level + top skill (`[Növekedés]`), quest count +
creed + focus + napzárás (`[Napi gyakorlat]`), FuelDay/protocol/intakes, cycleDay+phase
(`4. nap (Stabil)`), sleep+check-in, note truncation at 200 chars, the `[Cél]` day anchor sourced
from the sleep goal (derived `06:45`/`23:15`) vs. the config ghost (`06:00`/`22:00`) when no sleep
goal exists, and determinism (two renders are `equals`).
`ChatServiceIT` gained `testSendMessage_shouldInjectContextSnapshotBetweenVoiceAndFacts_whenSending` —
the fake's `system=[…]` echo proves voice → `AKTUÁLIS ÁLLAPOT` → facts ordering in the real prompt.
(**Since mezo-q71s** this ordering ends at the facts/pattern-ack/`TONE_REMINDER` blocks — history
is no longer part of it at all; see the `system=[…] history=[…] user=[…]` three-way echo split
above.)

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
- **`CompanionTranscribeApiIT`** (`mezo-at8x.4`, 6) — the voice surface through the generated
  `CompanionVoiceApi` with `mezo.companion.transcription.max-audio-bytes` lowered to 10 000: the
  `[fake-transcript:…]` sentinel decoded from the AUDIO BYTES comes back as the transcript, a
  `;codecs=opus` mime parameter is accepted (base-type matching), silence returns empty text with
  200, and oversized / unsupported-mime / missing audio each give a 400 (`VALIDATION_INVALID_VALUE`
  on field `audio`).

**V0.4 test additions:**

- **`ChatStreamServiceIT`** (7 tests, deliberately NOT `@Transactional` — it observes the real
  two-transaction turn): deltas join to the full answer + terminal `done` carries the persisted
  row + title/lastMessageAt touched; forced stream failure (`FakeCompanionLlm.FAIL_STREAM`
  sentinel in the content) ⇒ `error` event, **only** the user row persisted; foreign
  conversation throws 404 before any streaming (V0.4); scripted tool call ⇒ chips on `done` +
  persisted envelope (V0.5). **Grown by 3 at mezo-280:** a `tool` event fires strictly before the
  LAST `delta`, not merely before `done` — pinning that the chip appears WHILE the answer is still
  streaming, which is what rules out buffering every tool event and flushing them all right before
  the terminal row; a tool run without args emits the BARE name (no parentheses), the same branch
  the done row's chip takes; a tool-less turn emits zero `tool` events (regression guard).
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

**V0.5 test additions (grown to 15 tools' worth by mezo-xixu):**

- **`CompanionToolsRenderIT`** (77 tests, `@Transactional` + fake profile) — every tool's rendered
  Hungarian text + contributed refs against populator-seeded data, LLM-free (tools called directly
  with a hand-built `ToolContext`): happy paths, `nincs adat`/`nincs aktív …` absences, window
  clamping (`getRecovery("sleep", 90, …)` → 30), volume math, adherence counting, honest-zero medication cycle.
- **`CompanionToolRegistryIT`** — exactly the 15-tool batch registered, every callback wrapped in
  `RecordingToolCallback`; the tool-context carries `userId` + audit.
- **`ToolCallAuditTest` + `RecordingToolCallbackTest`** (pure units) — null envelopes when empty,
  `read` typing, budget exhaustion (soft-fail, not recorded), ref dedupe/cap, error-to-honest-text,
  `compactArgs` flattening (`{"days":7}` → `days=7`).
- **Extended ITs:** `ChatServiceIT` (scripted `[fake-tool:…]` turn → envelope persisted + wire
  chips `get_recovery(scope=sleep, days=3)`/`read` + refs; tool-less turn keeps null envelopes; 16
  sentinels → cap at 15 (raised from 7-sentinels/cap-6 pre-mezo-xixu) + budget text in the answer;
  the system prompt carries the tool-usage line + the `[Eszköz-útmutató]` routing hint),
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
  accept promotes (source inherited from the candidate — `chat` here, category carried,
  `include_in_prompt` true), refine uses the
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
  and at the time `KnowledgePage.test.tsx` pinned to mock mode (graph prototype) — deleted with the
  page, its coverage folded into `KnowledgeListPage.test.tsx`'s `?view=kategoriak` cases
  (`mezo-ms9a`); MSW fact/candidate fixtures mirror the seeds.

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
- **`TurnVerdictCheckIT`** (4) — clean / scripted-redundancy mapping / fail-open on non-JSON /
  (**mezo-q71s**) the judge payload renders `history` via `ChatHistory.render` — a sentinel planted
  in a `Turn`'s content reaches the payload ONLY through that render call, so this test fails first
  if the history-into-judge-payload wiring is ever dropped.
- **`CompanionAdvisorChainIT`** (6, via `ChatService.sendMessage`) — clean turn, retry-recover
  (`RETRY_MARKER` in the echo proves round 2), degraded persisted+on-wire, clinical-persists →
  degraded, verdict-broken → fail-open without retry, (**mezo-q71s**) a linguistically marked
  speculation does NOT trigger a retry — the policy's IT anchor ([ADR
  0028](../decisions/0028-marked-speculation-in-chat.md)).
- **`ChatStreamAdvisorIT`** (2, NOT `@Transactional`) — deltas carry attempt-1 (no marker),
  `done` carries the retried answer clean; violate-always → `done.degraded` + persisted flag.
- **`CompanionAdvisorsSwitchOffIT`** (2) — no chain bean; violation sentinels change nothing.
- **Extended:** `ChatServiceIT` (clean turn ⇒ `degraded=false` persisted + on-wire),
  `CompanionPropertiesIT` (advisors binding), `FactExtractionServiceIT` (+2: confirmed-dupe
  reinforces `reinforcement_count`/`last_reinforced_at`, pending-dupe does not).
- **`ChatServiceIT` mezo-q71s additions** — `testSendMessage_shouldKeepHistoryOutOfSystemPrompt_whenPriorTurnsExist`
  (the lynchpin test named in the design spec: the persisted system-prompt echo must NOT contain a
  prior turn's content, the history-echo segment must; this is the one test that fails if the
  history is ever reglued into the system prompt), `testSendMessage_shouldDropTerseInstructionAndCarryVoiceRules_whenAssemblingPrompt`
  (`"Válaszolj magyarul, tömören."` is gone; the new `[Hogyan beszélsz]`/`[Mit szabad állítani]`
  rules are present), `testSendMessage_shouldEndPromptWithToneReminder_whenAssemblingPrompt`
  (`TONE_REMINDER` is the LAST thing in the fully assembled prompt, after the snapshot/facts/
  pattern-ack blocks). `ChatStreamServiceIT` carries the streamed-path twin of the history-
  separation test.
- **FE:** `chatApi.test.ts` (degraded mapping: false → undefined, true → true),
  `ChatPage.test.tsx` (mock seed shows no badge; a degraded `done` renders `nem ellenőrzött`).

**W4.1 feedback test additions (`mezo-b3pp.15`) — all integration-first, no LLM in the path:**

- **`feedback/CompanionFeedbackApiIT`** (15 tests, HTTP-level, deliberately NOT `@Transactional` —
  the `JournalApiIT` rationale) — first vote, opposite-verdict overwrite,
  **resurrect-after-retraction**, the service-level `FEEDBACK_REASON_REQUIRES_DOWN` guard (400 on a
  reason sent with `up`), retraction incl. idempotency, batch-read incl. cross-user isolation, and a
  **dangling `artifact_id` accepted on purpose** (spec §8.1 — the no-cross-table-FK decision's
  regression anchor: if someone ever "fixes" it with a lookup, this test fails first). Contract
  validation is now covered for all five constrained fields (`mezo-b3pp.24`):
  `testPutFeedback_shouldReturn400_whenArtifactKindUnknown` and
  `testListFeedback_shouldReturn400_whenKindUnknown` (pre-existing), plus four new cases —
  `testPutFeedback_shouldReturn400_whenVerdictUnknown`,
  `testPutFeedback_shouldReturn400_whenReasonUnknown`,
  `testListFeedback_shouldReturn400_whenIdsEmpty`, and
  `testListFeedback_shouldReturn400_whenMoreThanTheContractMaximumIdsRequested`. All five
  constraints are generated bean-validation annotations, split across two generated sources:
  `kind`/`ids`/`artifactKind` (path) `@Pattern`/`@Size` live on the **`CompanionFeedbackApi`**
  interface itself, while `verdict`/`reason`/`artifactKind` (body) `@Pattern` live on the
  **`PutFeedbackRequest`** DTO it takes as a parameter. For `verdict` and `reason`, dropping the
  `@Pattern` wouldn't ship silently accepted garbage — the `ck_message_feedback_verdict` and
  `ck_message_feedback_reason_value` CHECK constraints in
  `backend/src/main/resources/db/changelog/1.0.0/script/202608211200_mezo-b3pp.15_create_message_feedback.sql`
  would still reject the write, just as a 500 instead of a field error. `ids`' `@Size(min = 1, max =
  200)` has no DB-level equivalent at all — nothing backstops it below the generated annotation.
  Either way, without these cases a fragment edit that silently dropped one of these constraints
  would ship green with every other test in the suite still passing.
  `testPutFeedback_shouldReturn400_whenReasonUnknown` deliberately pairs its bad `reason` value with
  `verdict = down` (the legal verdict for a reason): pairing it with `up` instead would trip the
  service-level `FEEDBACK_REASON_REQUIRES_DOWN` guard (already covered by
  `testPutFeedback_shouldReturn400_whenReasonSentWithUp`) before the `@Pattern` on `reason` is ever
  reached, proving nothing about the pattern itself.
  - **The `maxItems: 200` case is pinned but only partly reachable over HTTP.** No
    `server.max-http-request-header-size` override exists anywhere under
    `backend/src/main/resources`, so Tomcat's default 8 KB request-line/header limit applies. A
    201-uuid `ids` query string is ~7.48 KB — inside that budget in the IT, which reaches
    `@Size(max = 200)` cleanly and gets the expected `SystemMessageList` body. But the IT's
    `TestRestTemplate` request carries only `Authorization` plus HttpClient boilerplate; a real
    browser adds `User-Agent`, `Accept-Language`, `Accept-Encoding`, `Cookie`, `sec-ch-ua-*`,
    `Origin`/`Referer` — typically 400–800+ combined bytes — which can push the same request over
    Tomcat's 8 KB wall *before* bean validation runs (a bare, bodyless 400, not a field error). This
    is not a hypothetical: it is the same header-size wall `mezo-b3pp.23` fixed on the client side by
    chunking feedback batch reads to `FEEDBACK_IDS_PER_REQUEST` (100) ids per request — this test
    pins the server side of that wall, not proof a browser can reach 200 in one request.
  - **The empty-`ids` case pins a 400 but cannot prove which layer produced it.** `?ids=` binds to an
    empty `List<UUID>` and reaches `@Size(min = 1)` on the generated interface — confirmed at the
    time these tests were written via the `GlobalExceptionHandler` "Validation failed" log line
    (the `ConstraintViolationException` path), not the "Unconvertible request parameter" line a
    UUID-conversion failure would emit. But `handleConstraintViolation` and `handleTypeMismatch`
    both emit an identical `SystemMessage` for `ids` (same `fieldName`, same
    `VALIDATION_INVALID_VALUE` code), so the response-body assertion alone cannot distinguish the
    two paths — it would keep passing unchanged even if a refactor moved the rejection to the
    type-mismatch route. The FE tests that look adjacent do **not** add server-side proof either
    (`feedbackHooks.test.tsx` asserts the CLIENT never *sends* an empty list; since `mezo-b3pp.23`,
    `feedbackApi.test.ts` separately asserts no ONE request ever carries more than
    `FEEDBACK_IDS_PER_REQUEST` (100) ids — both are hook/api-layer behavior, not a server-rejection
    assertion).
- **`feedback/MessageFeedbackPersistenceIT`** — the entity/constraint layer under the API: an `up`
  row without a reason and a `down` row with one round-trip; `ck_message_feedback_reason` really
  fires on reason-with-`up`; `uq_message_feedback_artifact` really fires on a second plain save; and
  the two `upsertVerdict` behaviors — flip-verdict-and-clear-reason, and **resurrect a soft-deleted
  row** (the proof the constraint spans them).
- **`feedback/CompanionFeedbackSwitchOffIT`** — `mezo.feature.companion.enabled=false` ⇒ all three
  operations 404 (no controller/service bean). Feedback has no switch of its own.
- **Support:** `support/populator/FeedbackPopulator` + `message_feedback` in `ResetDatabase`'s
  truncate list (house rule for every new domain table).
- **FE** (both Vitest modes): `data/feedback/feedbackHooks.test.tsx` (the toggle semantics, the
  optimistic write + rollback, the `FEEDBACK_MAX_IDS` (1000) cap keeping the NEWEST ids,
  empty-id-set = no request, a failing read degrading to "no verdicts"),
  `features/insights/components/FeedbackChips.test.tsx` (the reason row's reveal/retract branches,
  `aria-pressed`), plus per-surface cases in
  `ChatPage`/`MemoirPage`/`PredictionsPage`/`MezoMessagesSheet`/`TodayPage.feedback` tests (the
  retired `WeeklyPage`'s case moved to `features/me/pages/WeekPage.test.tsx`, `mezo-p2tr`) — see
  [`insights.md` §8](insights.md) and [`today.md` §8](today.md).

**Batch-read chunking test additions (`mezo-b3pp.23`) — FE only, both Vitest modes:**

- **`data/feedback/feedbackApi.test.ts`** (new file) — asserts against the REAL request URLs MSW
  records, not just the merged return value: one request when ids fit in one chunk
  (`list_shouldSendOneRequest_whenIdsFitInOneChunk`), a 100/N split across two and three chunks,
  every chunk's rows merged in order, `list_shouldKeepEveryRequestUnderTheHeaderBudget` (the
  regression anchor that trips if someone raises `FEEDBACK_IDS_PER_REQUEST` back toward 200), zero
  requests for an empty `ids` array, and the whole call rejecting when one chunk's `Promise` rejects.
- **`data/feedback/feedbackHooks.test.tsx`** gained `hydrates every chip on a page past the old
  single-request cap` (a rendered id count that would have 400'd pre-`mezo-b3pp.23` now hydrates
  fully across the chunked requests) and updated `still bounds the request at FEEDBACK_MAX_IDS,
  keeping the NEWEST (last) ids` to the new 1000 ceiling.

**W4.2 feedback-rollup test additions (`mezo-b3pp.16`) — all integration-first, no LLM in the path:**

- **`feedback/FeedbackRollupPersistenceIT`** — entity round-trip for the effectiveness shape; a
  scope matching neither `style` nor a `surface:`/`feed:` prefix is rejected by the entity's
  `@Pattern` mirror (a `ConstraintViolationException` in-JVM, before any SQL leaves the process —
  bean validation always beats the DB CHECK to it on the JPA path), while a **native** insert that
  bypasses bean validation proves `ck_feedback_rollup_scope` really is in the schema too;
  `uq_feedback_rollup_scope` fires on a second row with the same
  `(created_by, scope, window_days)`.
- **`feedback/FeedbackLearningPropertiesIT`** — `mezo.companion.feedback-learning.{cron,
  window-days}` bind from `application.yml`.
- **`feedback/FeedbackLearningServiceIT`** — always upserts all 11 scopes (zero-filled when
  unseen); per-surface up/down counts; feed-kind bucketing via `FeedMessageKindSource`;
  the style histogram counts only down-verdicts with a reason; a verdict older than the window is
  excluded; a verdict first cast 40 days ago but **re-voted through `upsertVerdict` today IS
  counted** (the `updated_at` window, above — the case a `created_at` window loses); a second run
  overwrites in place rather than duplicating rows.
- **`feedback/FeedbackLearningJobSwitchOffIT`** — `mezo.techcore.cron.feedback-learning-job.enabled=false`
  ⇒ no `FeedbackLearningJob` bean.

**W4.3 pragmatic-profile test additions (`mezo-b3pp.17`, spec §8.3):**

- **`profile/service/ProfileAssemblerIT`** — writes the singleton node keyed by `(kind=INSIGHT,
  source_kind='profile', source_id=userId)`, status `ACTIVE`, non-blank summary; rerunning updates
  the SAME row rather than adding a second one; an archived profile is revived by the next run
  (status flipped back to `ACTIVE`); no feedback signal / no reviewed decisions / no graph nodes ⇒
  no LLM call AND no node (`FakeCompanionLlm.completeCallCount()` unchanged); the stored summary
  never exceeds `renderMaxTokens * 3` chars end to end; the package-private `renderPayload` is
  asserted DIRECTLY against real `feedback_rollup` rows a completed `FeedbackLearningService
  .computeRollups` run wrote — proving the VISSZAJELZÉSEK/ELUTASÍTÁS OKAI sections are genuinely
  wired to the rollup table, not structurally present with dead inputs (review finding).
- **`profile/service/ProfileAssemblerCapTest`** (pure unit) — the word-boundary cap: unchanged
  under the limit, unchanged exactly at the boundary, a space-free run over the cap hard-cut with
  an ellipsis.
- **`profile/ProfilePromptAssemblerIT`** — renders the header + prose for an active node; no
  profile row ⇒ `""`; an archived node ⇒ `""`; an oversized stored row still renders under the
  token cap (defense in depth alongside the store-time cap); the full chat prompt carries the
  block AFTER the fact blocks and BEFORE `[Emlékek]` (the canonical order pinned end to end).
- **`profile/ProfileAssemblerJobIT`** — the weekly sweep writes a profile for a user with signal.
- **`profile/ProfileAssemblerJobSwitchOffIT`** — `mezo.techcore.cron.profile-assembler-job
  .enabled=false` ⇒ no `ProfileAssemblerJob` bean (the house cron idiom).
- **`profile/ProfilePropertiesIT`** — pins the shipped defaults (Monday 03:45, 400/10/12).
- **`profile/ProfileSourceFindersIT`** — the two read-side finders in isolation: reviewed decisions
  come back newest-first with unreviewed rows excluded; all rollup scopes for a user come back in
  one read.

**W4.3 follow-up test additions (`mezo-b3pp.35`, spec §8.3 — window filter, signal counting, failure
IT):**

- **`profile/service/ProfileAssemblerWindowHeaderIT`**
  (`renderPayload_statesTheConfiguredWindowInTheHeader_whenItIsNotThirty`) — own IT class, a
  `@TestPropertySource` window-days override to 14 (forks a separate context, the
  `NoteVectorLifecycleBudgetIT` precedent): the `VISSZAJELZÉSEK` header states `14`, never the
  shipped-default `30`.
- **`profile/service/ProfileAssemblerIT`**, two new cases:
  `renderPayload_readsOnlyTheConfiguredWindow_whenRetiredWindowRowsExist` — a real rollup run plus a
  hand-inserted retired-window row for the same scope; the payload names the SAME scope exactly
  once, with the live window's numbers, never the retired window's; and
  `feedbackSignals_countsEachVerdictOnce_whenAFeedMessageIsRolledUpTwice` — a `surface:feed_message`
  row and a `feed:morning` row seeded with the same stats; `meta.profile.feedbackSignals` equals the
  `surface:*` total alone (5), not the summed-across-scopes double count (10).
- **`profile/ProfilePromptAssemblerFailureIT`**
  (`testRender_shouldReturnEmptyBlock_whenTheProfileReadFails`) — own IT class (`@MockitoSpyBean`
  forks the context, kept out of the clean `ProfilePromptAssemblerIT` context on purpose): a spied
  `GraphNodeRepository` throws `DataAccessResourceFailureException` from inside the guarded read;
  `render` still returns `""` and the exception never escapes — pins IDENT-3 against a future
  refactor that removes the catch, the same reasoning `ChatServiceGraphBlockFailureIT` pins for
  `GraphPromptAssembler`.

**W5.1 composite-flag test additions (`mezo-b3pp.18`, spec §9.1) — no LLM anywhere in this path:**

- **`flags/CompanionFlagLogPersistenceIT`** — entity round-trip with the typed jsonb payload for
  all seven `FlagPayloadEnvelope` shapes (including `MomentumAtRisk`'s `List<String>` and
  `RecoveryNeeded`'s nullable boxed `Double`s); an unknown `flag_key`/`source` is rejected by the
  entity's `@Pattern` in-JVM AND, via a native insert that bypasses bean validation, by the DB
  CHECK too; `existsRaiseSince` sees only rows inside its window.
- **`flags/FlagPropertiesIT`** — every rule/window/cooldown key binds from `application.yml`, the
  shipped defaults pinned one by one.
- **`flags/FlagEvaluatorStressSleepIT`** — `sustained_stress`: raises at 3-of-4 bad days, stays
  quiet at 2-of-4, the day just outside the window is ignored while the day just inside it counts,
  multiple same-day check-ins average; `sleep_debt`: raises at the deficit threshold, stays quiet
  just below it, a long night never credits against a short one, stays quiet below the
  `min-nights` gate, falls back to the default goal without a `sleep_goal` row, **counts last
  night's sleep, which is logged this morning** (`sleep_log.date` is the wake morning), and raises
  exactly AT the threshold (boundary); the payload freezes the stress inputs
  (`the_payload_freezes_the_stress_inputs`). Since S2 the `sleep_debt` cases exercise
  `SleepDeficitCalculator` through `SleepDebtRule`, not inline arithmetic — behavior pinned
  unchanged across the extraction.
- **`flags/FlagEvaluatorMomentumRecoveryIT`** — `momentum_at_risk`: raises on a habit collapse plus
  a missed planned gym day, stays quiet when every planned day was trained, with no planned gym day
  at all, below the baseline floor, or when the habits held up; `recovery_needed`: raises on poor
  sleep + high RPE + high stress inside the 48h window, stays quiet when one leg is missing or
  falls outside the window (including exactly one day past the true edge — the boundary case);
  `all_healthy`: raises after a quiet week WITH actual data, stays quiet while a problem flag is
  still inside the quiet window, and returns once that problem flag ages out of it. **Since S2,
  `an_empty_log_raises_logging_gap_not_all_healthy`** (renamed from
  `all_healthy_stays_quiet_on_an_empty_log`, `mezo-d58h.2` — the fixture was updated when
  `logging_gap` began raising for it, but the name still claimed the opposite): an EMPTY log is no
  longer the "no fabricated all_healthy over nothing" case it once was — `logging_gap` now raises
  first on a never-logged user (never-logged counts as stale, §3), so `all_healthy`'s own honesty
  gate is untestable via a bare empty log and is instead pinned by the "quiet window" cases above.
- **`flags/FlagEvaluatorLoggingGapIT`** and **`flags/FlagEvaluatorMissedWorkoutsIT`** (S2, bd
  `mezo-d58h.2`) — `logging_gap`: raises when ≥`min-stale-domains` of meals/check-ins/sleep are
  stale (including never-logged), stays quiet with fresh data in all domains, and the "gap +
  suspicion" payload attaches the observed deficit only when `sleep_debt` itself stayed silent for
  want of nights; `missed_workouts`: raises on `minConsecutiveMissed` consecutive PLANNED days with
  nothing completed, stays quiet with no gym schedule at all or when the run breaks, and treats a
  Mon/Wed/Fri schedule's consecutive PLANNED days correctly (not consecutive calendar days).
- **`flags/FlagEvaluatorAcuteBadDayIT`, `FlagEvaluatorLoadFuelMismatchIT`,
  `FlagEvaluatorRapidWeightLossIT`, `FlagEvaluatorJointOveruseIT`, `FlagEvaluatorIgnoredNudgeIT`,
  `FlagEvaluatorLateEatingIT`** (S6 batch B, bd `mezo-d58h.6`) — one IT per new rule, each pinning
  its own honesty gate: `acute_bad_day` stays quiet below `min-check-ins` and on a null-scored
  check-in; `load_fuel_mismatch` gates the kcal/sleep logged-day counts off the SPARSE series, never
  the calendar-complete load series, and carries `WEIGHT_TREND_PCT_WK` as a fact without ever
  gating on it; `rapid_weight_loss` stays quiet with no active goal and with a `cut` goal, and relies
  on the extractor's own <4-weigh-ins null; `joint_overuse` never calls the write-side `getToday`
  and stays quiet with no planned session tomorrow; `ignored_nudge` breaks its run on an unlogged
  night, a night with no push, or a single compliant night, and stays silent with no `sleep_goal`
  row; `late_eating` exercises both arms independently (bed-arm-only, absolute-arm-only, neither)
  and stays quiet on the days a goal-less user's absolute arm alone cannot yet qualify.
- **`flags/FlagServiceIT`** — writes one audit row per raised flag with the right `source`; the
  cooldown blocks an immediate re-raise and lifts once it expires; the on-write and sweep sources
  raise IDENTICALLY apart from `source`
  (`write_and_sweep_raise_identically_apart_from_the_source`). **Since S2,
  `a_quiet_evaluation_writes_only_logging_gap`** (renamed from
  `a_quiet_evaluation_writes_nothing`, `mezo-d58h.2`): the fixture that once left every rule
  silent now trips `logging_gap` (never-logged domains count as stale, §3), so the test asserts
  exactly one row — `logging_gap` — is written, not zero; a genuinely quiet evaluation (every
  domain fresh, nothing else true) is no longer reachable with this rule in the spine.
- **`flags/FlagEvaluationListenerIT`** — a check-in save raises the flag with `source=write`
  (deliberately NOT `@Transactional` — the `FlagServiceIT` precedent: the save must genuinely
  COMMIT for `AFTER_COMMIT` to fire, Awaitility rides out the `@Async` hop, the
  `CompanionMessageEventIT` idiom); a calm check-in save raises nothing.
- **`flags/FlagSweepJobSwitchOffIT`** — `mezo.techcore.cron.flag-sweep-job.enabled=false` ⇒ no
  `FlagSweepJob` bean (the house cron-switch idiom; the on-write listener is unaffected — a
  separate switch).

**W5.2 intervention delivery test additions (`mezo-b3pp.19`, spec §9.2) — no LLM anywhere in this
path either (the `flags/` suite above already pins `FlagService`'s event publish; these are the
consumer side, in `feature.proactive`, and the push-anchor side, in `feature.notification`):**

- **`proactive/InterventionServiceIT`** — a raised flag writes the card
  (`raisedFlagWritesTheCard`); the higher-effectiveness entry wins between two eligible candidates
  (`higherEffectivenessWins`); an unseen (unvoted) key beats a voted one via the optimistic prior
  (`unseenKeyBeatsVotedKey`); a cooled-down key is skipped in favor of the next-best
  (`perKeyCooldownSkipsToNextBest`); every eligible entry in cooldown delivers nothing
  (`allKeysInCooldownDeliversNothing`); a second same-day card is skipped regardless of flag
  (`secondCardSameDayIsSkipped`); two unseen (unvoted, no rollups seeded) candidates are a genuine
  tie and the FIRST in config order wins (`tieBreakKeepsConfigOrder_whenBothCandidatesAreUnseen`,
  final-review addition — distinct from `unseenKeyBeatsVotedKey` above, which pins unseen-beats-
  voted, not the unseen-vs-unseen tie-break itself); the REAL
  `@TransactionalEventListener(AFTER_COMMIT)` + `@Async` path delivers end to end
  (`listenerDeliversAfterCommit`, the `CompanionMessageEventIT` idiom — a rolled-back raise must
  deliver nothing).
- **`proactive/InterventionConfigIT`** — the library binds and covers every one of the five flags,
  and every key is unique (`libraryBindsCoversEveryFlagAndKeysAreUnique`).
- **`proactive/InterventionSwitchOffIT`** — `mezo.feature.intervention.enabled=false` ⇒ no
  `InterventionService` bean in the context, and `FlagService.evaluateAndLog` still writes the flag
  log row with no card following (the flag-log write path is unaffected by this switch — only the
  consumer disappears).
- **`proactive/CompanionMessageInterventionPersistenceIT`** — the `intervention` kind round-trips
  with its envelope `interventionKey` set; an unknown `kind` still trips the widened CHECK.
- **`notification/service/InterventionFireMinuteTest`** (pure, no Spring) —
  `AnchorResolver.interventionFireMinute` as a table: fires same-day in daytime; defers to the
  NEXT day's quiet-end when generated late evening; defers to the SAME day's quiet-end when
  generated early morning (already inside the window); the quiet-start boundary is INSIDE the
  window, the quiet-end boundary is OUTSIDE it (asymmetric, `[start, end)`); fires immediately when
  `quietHoursExempt`; never defers when `start == end` (quiet hours off); a non-wrapping window
  (final-review addition — `quietStart < quietEnd`, e.g. a midday 12:00–14:00 window, unlike the
  default's midnight-wrapping 22:00–07:00) defers within the SAME day, proving the wraps-detection
  branch handles both window shapes.
- **`notification/AnchorResolverInterventionIT`** — a `both`-channel card anchors on its own
  generation minute in daytime; a `both`-channel card generated in quiet hours defers ACROSS the
  day boundary (seeded via `CompanionMessagePopulator`'s explicit-`generatedAt` overload, the
  `sleep_reaction`/`weight_reaction` flakiness-avoidance idiom); a `feed`-channel card's library
  entry yields NO anchor; a card whose key is no longer in the library (retired) also yields none.
  Kept separate from `AnchorResolverIT` (the `AnchorResolverDecisionIT` precedent) since it drives
  its own quiet-hours fixtures. `AnchorResolverIT`/`AnchorResolverFeedIT` are re-run alongside it as
  a regression guard on the shared `AnchorResolver.resolve` entry point (§9 — nothing about the
  intervention addition should perturb an existing category's anchor).
- **`notification/NotificationCategoryTest`** — pins the now-**22**-key catalog (§4/§9 of
  [`_platform-notifications.md`](_platform-notifications.md)) including `INTERVENTION`.
- **`notification/NotificationPrefApiIT`** — the code-default fallback and per-category upsert,
  re-run as a regression guard now that `effectiveFor` walks 22 keys instead of 21.
- **`companion/feedback/Feedback*IT`** (`FeedbackLearningServiceIT`/`FeedbackRollupPersistenceIT`
  et al.) — re-run as a regression guard: the nightly rollup now writes 11+N rows instead of a
  fixed 11, and the widened `ck_feedback_rollup_scope` CHECK must still reject a bogus scope.

**W5.3 quarterly deep pass test additions (`mezo-b3pp.20`, spec §9.3):**

- **`quarterly/service/QuartersTest`** (pure unit) — `startOf`/`previous`/`endOf`/`label` over
  hand-picked dates including the Q1 year-boundary cross; `parse` accepts both spellings
  (`2026-Q3`, case-insensitive, and `2026-07`, whitespace-tolerant) and returns `null` — never
  throws — for `null`/blank/garbage/an out-of-range quarter or month; `isQuarter` tells a quarter
  spelling from a month one.
- **`quarterly/QuarterlyPropertiesIT`** — pins the four shipped defaults (`cron`, 2/6/400).
- **`quarterly/QuarterlyReviewServiceIT`** — creates candidates, never actives, on both quarters
  having rungs (`testRunFor_shouldCreateCandidatesNotActives_whenBothQuartersHaveRungs`); the
  season-over-season gather is genuinely real — a sentinel planted ONLY in the previous quarter's
  rung still reaches the model
  (`testRunFor_shouldRenderThePreviousQuarterIntoThePrompt_whenItHasRungs`); the model is capped at
  `max-candidates` even when it proposes more; the emptiness gate costs no LLM call
  (`fakeCompanionLlm.completeCallCount()` unchanged); a quarter with only ITS OWN rungs (no
  previous quarter) still runs — the missing-previous case is not a gate; an already-processed
  quarter is never re-run, and neither is one whose sole candidate was REJECTED (soft-deleted) —
  gate before spend in both cases; an unparseable/failed model answer degrades to zero, never an
  exception; a blank-titled suggestion is dropped while a valid sibling survives.
- **`quarterly/QuarterlyReviewJobIT`** — the cron reviews the quarter BEFORE the one standing (the
  test's own `lastFinishedQuarter()` helper), proposing SEASON candidates and then rebuilding the
  profile (phase 2 needs its OWN signal — a reviewed decision, since a fresh SEASON candidate
  alone does not open `ProfileAssembler`'s honest-absence gate); a user with nothing to review at
  all never throws.
- **`quarterly/QuarterlyReviewJobSwitchOffIT`** —
  `mezo.techcore.cron.quarterly-review-job.enabled=false` ⇒ no `QuarterlyReviewJob` bean (the
  house cron-switch idiom).
- **`quarterly/service/QuarterlyReviewPayloadIT`** (final-review fix F3) — a DIRECT assertion on
  the package-private `QuarterlyReviewService.buildUserMessage` (the `ProfileAssemblerIT
  .renderPayload` precedent, hence the `...quarterly.service` package): the feedback heading reads
  `VISSZAJELZÉSEK AZ AI-FELÜLETEKRŐL (utolsó 30 nap, nem a teljes negyedév):` with the 30 rendered
  off a row the REAL `FeedbackLearningService.computeRollups` wrote, and the bare undisclosed
  heading is asserted absent; with no verdicts at all the heading is omitted entirely. Going
  through `runFor` could only ever show the fake's ANSWER, never the payload — and the defect was
  in the payload's wording.
- **`quarterly/QuarterlyReviewJobProfileSwitchOffIT`** (final-review fix F2) — the OTHER switch:
  with `mezo.techcore.cron.profile-assembler-job.enabled=false` the quarterly cron still runs and
  still writes its SEASON candidate, but writes NO profile node — and a pre-existing ARCHIVED
  *Rólad tanultam* node is still archived, with its old summary intact, afterwards. The absent
  `ProfileAssemblerJob` bean asserted in the first test is not setup but the mechanism itself
  (bean presence IS the switch). Both tests seed the same reviewed decision `QuarterlyReviewJobIT`
  uses to OPEN the assembler's honest-absence gate, so the missing profile can only be the switch.
- **`profile/service/ProfileAssemblerIT`, extended** —
  `renderPayload_compares_this_quarter_against_the_previous_one_when_both_have_reviewed_decisions`
  (two ratings this quarter, mean 4.5, against one last quarter, 2.0 — the arithmetic AND the
  quarter windowing are both genuinely per-quarter);
  `renderPayload_omits_the_previous_quarter_line_when_it_has_no_reviewed_decisions` and
  `renderPayload_omits_the_whole_section_when_nothing_is_reviewed_this_quarter` (both halves of
  honest absence); **`renderPayload_counts_a_decision_reviewed_at_the_exact_quarter_boundary_only_once`**
  — the review-fix regression guard: a decision reviewed at the EXACT quarter-start instant used
  to double-count under an inclusive `BETWEEN`; this pins it counting once, in the current
  quarter's line only. **`renderPayload_windows_the_trend_on_the_anchor_quarter_not_on_todays_quarter`**
  (final-review fix F1) — everything is seeded in the ANCHOR quarter and the one before it, i.e.
  nothing in the quarter the clock is standing in, so the old `LocalDate.now()`-derived window
  would omit the whole `DÖNTÉSI MINŐSÉG` section on ANY day of the year, not just on a quarter
  boundary; the assertion is that "ez a negyedév" names the anchor and "előző negyedév" the one
  before it. The class's other tests pass the current quarter through a `currentQuarter()` helper,
  so they keep pinning exactly what they pinned before the anchor became explicit.
- **`tools/MemoryToolsRenderIT`, extended** — `testComparePeriods_shouldRenderBothQuarters_whenRungsExist`
  (a quarter really is assembled from ALL its month rungs, not just the one `Quarters.parse`
  itself would resolve to);
  `testComparePeriods_shouldTruncateLongSummary_whenOverRenderCap` (the `render-max-chars` cap is
  enforced, not merely declared); `testComparePeriods_shouldAcceptMonths_whenSpelledAsYyyyMm`;
  **`testComparePeriods_shouldRenderHonestNoData_whenAPeriodHasNoRungs`** — the acceptance case: a
  period with nothing recorded renders `nincs adat`, and — asymmetrically — only the period that
  DID produce data adds a ref; both ref assertions were retargeted in the final review (F4) onto
  the `Időszak`/`YYYY-MM` shape, with an explicit `noneSatisfy(kind == "Memory")` on the
  both-quarters case so a later "harmonise the ref kinds" change cannot quietly restore the
  day-shaped chip; `testComparePeriods_shouldRenderNoData_whenAnArgumentIsUnparseable`
  (`null`/garbled arguments, never a `TOOL_FAILED` exception); `testComparePeriods_shouldEmitNoRefs_whenBothPeriodsParseButHaveNoRungs`;
  `testComparePeriods_shouldNotLeakAnotherUsersPeriods_whenOwnershipDiffers` (ownership-scoped
  like every other tool read).

**W3.1 ambient-recall test additions (`mezo-b3pp.12`) — the LLM and the embedding port are both
fakes; the ANN math is real Postgres/pgvector over hand-seeded axis vectors:**

- **`PromptMemoryAssemblerTest`** (8, pure unit — no Spring, no DB): `renderBlock` renders
  `- <date> (<HU forrás>): <gist>`, stops at the FIRST overflowing item (a later, shorter item never
  jumps ahead of a more relevant one), returns empty when even the first item overflows, **skips a
  whitespace-only gist without spending a ref or leaving a dangling line** and keeps scanning
  (a blank gist is not a budget stop), falls back to the raw kind for an unlabelled kind; plus
  `oneLine` (first line + `…` truncation) and `estimateTokens` (ceil at 3 chars/token).
- **`PromptMemoryAssemblerIT`** (11, `@Transactional`, `companion-fake`): a relevant episode renders
  with its date and HU source tag; **two episodes of the SAME day render two lines but yield ONE
  `Memory`/date ref** (refs carry the date, not the row id — a dense day cannot eat the turn's ref
  budget); each kind group is capped independently; **the floor is pinned BETWEEN the two
  thresholds** — a similarity-0.4 `journal_entry` row passes the tool's `recall.min-similarity`
  (0.25) and must still fail the ambient journal floor (0.55 as shipped in W3.1, **0.60 since
  W3.3**), so a `recall.minSimilarity()`/`ambient.<group>().minSimilarity()` typo fails here first;
  today's episodes are skipped (the snapshot already carries the day); equal similarity orders by
  the decayed score; an empty store, a blank message, `FakeEmbeddingAdapter.FAIL_EMBED`
  (`[fake-embed-fail]` — the port throws) and `FAIL_ANN` (`[fake-embed-shortvec]` — the embed
  SUCCEEDS but returns a 3-dim vector, so Postgres rejects the query with "different vector
  dimensions") each return `AmbientRecall.EMPTY` **without throwing**.
- **W3.2 consolidation ladder (`mezo-b3pp.13`)** — `PeriodSummaryPersistenceIT` (5, the uq/soft
  delete/`ck_period_summary_granularity` schema contract, the DB-check case through a native
  insert), `PeriodSummaryServiceIT` (7, `companion-fake`: the week condenses only ITS days (the
  next week's day must not leak), an existing rung comes back untouched, an empty period / another
  user's days / a blank model answer each produce NO row, the month condenses its week rungs and
  ignores the ones outside it), `ConsolidationJobIT` (7, deliberately NOT `@Transactional` — the
  job manages its own transactions: rung + `weekly_summary` vector at `occurred_on = period_start`,
  the RUNNING week untouched, a second run adds nothing, older weeks inside the 8-week window
  backfilled and the 20-week-old one not, users kept separate, the monthly rung + its vector, and
  no monthly rung without weeks), `ConsolidationJobSwitchOffIT` (the switch removes the bean) and
  `ConsolidationPropertiesIT` (the yml binding for both the schedules/backfill and the two
  shadowing knobs).
- **`PromptMemoryAssemblerShadowIT`** (4, `@Transactional`, `companion-fake`) — the W3.2 coverage
  filter: a 60-day-old `daily_summary` is replaced in the block by its covering weekly rung **while
  its row is still in the store** (shadowed, not deleted), a 2-day-old day still renders directly,
  a monthly rung carries a 200-day-old stretch, and a period-summary cap of 2 keeps the two freshest
  rungs. `PromptMemoryAssemblerIT`'s decay-order case moved its old day from 60 to **20** days for
  the same reason — beyond the cutoff a bare daily hit is no longer asked for at all.
- **`MemoryEmbeddingAnnQueryIT`** (3, deliberately NOT `@Transactional` — the savepoint test needs a
  real outer transaction that actually COMMITS, which a test-managed always-rolled-back one cannot
  give): kind restriction + distance ordering, the `k` limit + other-user exclusion, and **the
  savepoint proof** — a failing ANN inside a live transaction, then a JPA write AND a second, good
  ANN read on that same transaction, then a clean commit. Without the savepoint the failed statement
  would leave Postgres's "current transaction is aborted" state and Hibernate's rollback-only mark.
- **`ChatServiceAmbientRecallIT`** (4, deliberately NOT `@Transactional` — these assert the turn
  COMMITS): the block sits strictly between the pattern-ack block and `TONE_REMINDER` in the real
  assembled prompt, the rendered item's `Memory`/date ref appears BOTH on the wire and on the
  persisted row, `FAIL_EMBED` and `FAIL_ANN` each omit the block while the turn still answers with
  `degraded=false`, and tool refs precede the ambient `Memory` refs in the envelope.
- **`PromptMemoryAssemblerSwitchOffIT`** — `mezo.companion.ambient-recall.enabled=false` ⇒ empty
  even with seeded, matching vectors (short-circuits before the embed — by construction, not
  observable through the return value).
- **Extended:** `ChatServiceIT` keeps the seedless case (no `[Emlékek]` when there is nothing to
  recall — the V0.2 steady state is untouched); `ChatStreamServiceIT` gained the streamed block +
  `Memory`-refs-on-`done` test and the streamed twin of the tool-refs-before-Memory-refs ordering;
  `CompanionPropertiesIT` gained the `ambient-recall.*` binding case (all seven keys from
  `application.yml`; **since W3.3 it binds the five `Group` records whole** —
  `isEqualTo(new Group(2, 0.55, 90))` … — alongside `enabled`/`weekly-shadow-days`/`max-tokens`);
  `FakeEmbeddingAdapterIT` pins BOTH new sentinels (`FAIL_EMBED` throws from
  `embedQuery` and `embedDocuments`; `FAIL_ANN` returns a unit-norm 3-dim vector) — without that,
  a sentinel that quietly stopped failing would turn every "the block is omitted" assertion above
  into a vacuous truth.
- **Support:** no new populator — the V2.1 `support/populator/MemoryEmbeddingPopulator` already
  stages exact cosine geometry (`axisVector`/`blendVector`), which is what makes the floor/cap/order
  assertions deterministic without any embedding provider.
- **House rule this slice added:** an ambient test that seeds vectors AND asserts a COMMIT must live
  in a non-`@Transactional` class. Inside a test-managed transaction the turn never commits, so a
  `done`-row/refs-envelope assertion would be asserting nothing.

**W3.1b disclosure test additions (`mezo-b3pp.28`) — no new test class on the backend: every
assertion was folded into the class that already owned that seam, so a regression fails where the
behaviour lives:**

- **`PromptMemoryAssemblerIT`** — the same-day case now pins **items vs refs**: two episodes of one
  day render **2 `AmbientRecall.items()` but still 1 `Memory` ref** (the disclosure is per episode,
  the ref budget is per day), each item's `gist` equals the `[Emlékek]` line's text and `similarity`
  is the raw cosine (`isCloseTo(1.0, within(1e-6))` on the staged axis vectors — the decayed score is
  never what reaches the wire). The `FAIL_EMBED`/`FAIL_ANN` cases now also assert `items()` is
  empty, not merely that the block is — `AmbientRecall.EMPTY` must be empty in all three fields.
- **`ChatServiceAmbientRecallIT`** — the sync answer's `recalled[]` on the WIRE (occurredOn/kind/
  label/gist/similarity) **and** the same envelope on the COMMITTED row (history re-renders it), the
  **user row's `recalledMemories` is null** (a disclosure belongs to an answer), and both failure
  branches (`FAIL_EMBED`/`FAIL_ANN`) leave `recalled` `[]` on the wire and **null on the row** while
  the turn still answers with `degraded=false` — a failed recall must be invisible, not an empty row.
- **`ChatStreamServiceIT`** — the streamed twin: the terminal `done` `MessageResponse` carries the
  items and the committed assistant row carries the envelope, proving `PreparedTurn.recalled`
  survives the TX #1 → TX #2 hop (the one place the two paths could silently diverge).
- **`CompanionApiIT`** — `GET /conversation/{id}/messages` after a recall-bearing turn: the user row
  discloses `[]`, the assistant row carries the items — the **history** contract, not just the
  send response.
- **`CompanionStreamApiIT`** — the raw SSE body contains `"recalled":[{` on the `done` event, so the
  field survives real serialization on the hand-written stream path (the generated mapper is not
  involved in shaping that frame's JSON).
- **`AiMessageJsonbRoundTripIT`** — the envelope survives Postgres: `LocalDate occurredOn` back as a
  `LocalDate` (not a string or an epoch array — the Jackson `JavaTimeModule` trap this class exists
  for), `refId` preserved, and `jsonb_typeof(recalled_memories) = 'object'`; the pre-existing case
  pins that a row without a recall keeps the column **null**.
- **FE:** `chatApi.test.ts` — `recalled: []` maps to `undefined` (no empty disclosure row) and a
  non-empty `recalled` passes through **unchanged**, same order and values. `ChatPage.test.tsx` in
  **both modes**: the mock seed's first assistant message shows the collapsed „Emlékek · 2" row and
  expands to the gists on click; the real-mode streamed answer carries its own disclosure from the
  MSW `done` frame. `chatHooks.test.tsx` and the MSW `GET /messages` fixture carry `recalled` so the
  handlers stay contract-shaped (`recalled` is REQUIRED on the wire — a fixture missing it would be
  a type error, which is the point).

- **Visual goldens moved** (`tests/visual/visual.spec.ts-snapshots/`): `insights-chat-{light,dark}`
  only — the first assistant bubble gains the collapsed row and the bottom-anchored transcript
  shifts above it; every other page's golden is byte-identical. Darwin regenerated locally
  (`pnpm test:visual:update`), linux via `gh workflow run update-visual-baselines.yml`.

**W3.3 recall tuning test additions (`mezo-b3pp.14`, spec §7.3) — the eval layer: fake embedder,
hand-seeded vectors, real Postgres/pgvector math, so tuning is testable without a provider:**

- **`AmbientRecallEvalIT`** (5 cases, `@ParameterizedTest` + `@MethodSource`, `@Transactional`,
  `companion-fake`) — the **eval harness**: one 20-row hand-crafted corpus (`tilted(axis, c)` puts
  the remainder of a unit vector on a filler axis no query touches, so a row answers exactly one
  case; `spanning(a, c, b)` is the only two-axis shape) and a readable TABLE of *(query → the exact
  `[Emlékek]` gists, in prompt order)*. Every ordering decision has ≥0.021 of headroom and every
  floor/cap decision ≥0.017 — far above float4 noise. Its javadoc is the contract and it is honest
  about the edges. **Pinned** (each verified by MUTATION — the knob moved on the command line and
  this class confirmed red): all **five caps in BOTH directions** (each group seeds one above-floor
  candidate its cap must cut); `daily-summary.min-similarity` from both sides (pinned to
  (0.52, 0.62] — the 0.52 day is fresh enough to OUTSCORE the 0.62 one, so lowering the floor takes
  a slot rather than merely adding a row); `journal.min-similarity` from both sides ((0.58, 0.66]);
  `period-summary.decay-days` 180 (at τ90 the 80-day monthly falls under the 28-day daily and case 3
  reorders) and `daily-summary.decay-days` 90 from above; `weekly-shadow-days` 30 (the 75-day
  festival day is invisible; at 90 case 3 gains it). **NOT pinned, stated so a green run is not
  over-read**: `journal`/`chat-turn`/`other.decay-days` (verified unchanged across τ 45…180 — every
  ordering they take part in has more headroom than that), the `period`/`chat`/`other` floors from
  BELOW (their kept rows sit at 0.66, so only "raise it to 0.70" goes red), and the journal floor at
  exactly 0.58 (the seeded `0.58f` is 0.5799999 and still reads as "under" a 0.58 floor). A fifth
  case queries an axis no memory leans on: nothing clears any floor ⇒ **no block at all**.
- **`AmbientRecallTuningIT`** (2, `@Transactional`, `companion-fake`, `@TestPropertySource`
  `journal.min-similarity=0.8` + `chat-turn.decay-days=2`) — the acceptance "config-only tuning
  verified": with NO code change, a raised journal floor drops a 0.707 journal hit while the 0.707
  daily of the same age (untouched group) stays, and a shrunk chat-turn τ sinks a 4-day-old chat
  turn (e^(-4/2) ≈ 0.135) below an 8-day-old daily (e^(-8/90) ≈ 0.915). Both prove the knob reaches
  its group and ONLY its group.
- **Extended:** `PromptMemoryAssemblerIT` gained
  `testRecall_shouldSkipOwnConversationsChatTurns_whenTheyAreAlreadyInTheHistoryWindow` — two
  identical-similarity chat turns, the FRESHER one in the conversation being answered; with
  `chat-turn.cap = 1` only the exclusion can let the older conversation's turn win (`mezo-b3pp.27`).
  `MemoryRecallServiceIT` gained
  `testRecallSimilarDays_shouldTagTheQueryEmbedAsCompanionRecall_whenCalled` — a hand-built
  `EmbeddingPort` probe reads `LlmCallContextHolder` from inside `embedQuery` and asserts the exact
  `LlmCallContext("companion_recall", "recall_embed", "tool", null)`, so the retag cannot silently
  revert. `CompanionPropertiesIT`'s ambient case now binds the five `Group` records whole
  (`isEqualTo(new Group(2, 0.55, 90))` …) instead of seven flat keys; `ConsolidationPropertiesIT`
  reads `periodSummary().cap()`; `GeminiCompanionLlmPromptOrderTest`'s hand-built
  `CompanionProperties` was updated for the new `AmbientRecall` shape.

Carried over from V0.1 (`mezo-fnnq.1`): `CompanionLlmFakeIT` (fake picked + echoes/streams),
`CompanionRealWiringIT` (Gemini adapter picked when the fake profile is absent), `CompanionSwitchOffIT`
(**no `CompanionLlm` bean when the switch is off** — `ObjectProvider.getIfAvailable() == null`),
`CompanionPropertiesIT` (llm tiers + the V0.2 `chat.*` window/title bindings).

## 9. Decisions, gotchas & deferred

**Plan decisions (locked in the V0.2 plan §"Decisions locked"):**

1. **Window = config, in messages not turns.** `mezo.companion.chat.history-window` = 20 (≈10
   turns); `title-max-chars` = 80. Tunable, `@Validated`, never `@Value`.
2. **Auto-titling deferred.** `title` = first user message truncated to `title-max-chars`, **set
   once, never regenerated** (`ChatService.touchConversation`, `ChatService.java:277`).
3. **No `started_at` column.** `OwnedEntity.created_at` is the conversation start; the contract's
   `startedAt` maps from it (`CompanionMapper.toConversationResponse`). A duplicate column would
   only drift — the spec §3 field list is "essence", not DDL.
4. **History windowing lived in the system prompt** (a rendered `Daniel:`/`Mezo:` transcript), so
   the `CompanionLlm` port originally kept a two-string prompt shape. **Superseded by mezo-q71s**
   (see the "Conversational tone" §1 entry and Decision 16 below): the history now rides the port
   as real prior messages (`List<Turn>`), and the two-string shape survives only as the default
   overload every history-less pipeline caller still uses.
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

16. **Port kept two strings + tools at V0.5; NO message-list variant — until mezo-q71s.** V0.2
    Decision #4 predicted tool calling would force a message-list port; it didn't (Spring AI runs
    the tool-execution loop inside the adapter regardless of prompt shape).
    `complete/stream(system, user, List<ToolCallback>, Map toolContext)` with `default` two-arg
    overloads held from V0.5 through V3.4. **`mezo-q71s` (conversational tone) is what finally
    added a message-list dimension** — not for tool calling, but so the chat HISTORY could travel
    as real prior turns instead of a rendered transcript inside the system prompt: the port
    INVERTED (the 5-arg `List<Turn> history` form became abstract, this 4-arg tool-carrying form
    became a `default` delegating with `List.of()`). `ToolCallback`/`ToolContext` are still
    spring-ai-core types shared by every provider starter — not provider types, so ADR 0008's
    isolation holds unchanged.
17. **Audit = decorator, refs = explicit, identity = context.** `RecordingToolCallback` records
    every call (unbypassable) + enforces the cap (soft-fail text in-band, attempt not recorded) +
    shields tool exceptions (honest error result); tools add their own refs via the audit in the
    `ToolContext`; `userId` comes ONLY from the tool context, never model args.
18. **Envelope grows `args`; wire stays `{type,name}`.** `ToolCall{type,name,args}` (args =
    compact display form, `days=7` — full fidelity for flat scalar V0.5 args; pre-V0.5 rows
    deserialize `args = null`); the mapper renders `name(args)` — the mock-seed chip style; `type`
    is always `read` in V0.5. No migration (columns existed since V0.2; null-when-empty preserved).
19. **Tool results are snapshot-idiom text**, windows clamped by `mezo.companion.tools.*` — token
    budget by construction. `get_training_log` scopes gym/sport/run into one tool (mezo-xixu,
    merged from `get_recent_workouts`+`get_sport_sessions`); `get_protocol`'s `scope=adherence`
    measures against the CURRENT active protocol for the whole window (version time-travel is
    v1+ material; mezo-xixu also merged in `scope=intake`/`supplements`, see the catalog);
    `get_goal_progress` is a pure read composition — merged into `get_goal(scope)` (mezo-xixu:
    progress/recept/guards/feasibility read the same `prescription` jsonb (engine's `evaluate` is a
    write and stays out of the registry); scope=timeline instead reads plan links via
    `GoalTimelineService`/`GoalPlanLinkService` — independent of evaluation).
20. **The fake scripts tools via content sentinels** — `[fake-tool:name {json}]` executes the
    REAL wrapped callback (audit/budget/refs included), so the whole pipeline is IT-covered with
    zero LLM. Spring AI's result converter JSON-encodes a tool's String return — the fake's echo
    shows `tool:name=["…"]` (quoted).

**V1.1 decisions (locked in-session):**

21. **Category enum v1 = `train|fuel|health|life`, source = `chat|pattern|manual`** (+
    `weekly_review` since `mezo-d20.7.6`) — String +
    `@Pattern` + CHECK constraint (the `role` precedent, no Java enum); request-side validation
    is contract `pattern` (400 FIELD error, not a Jackson 500).
22. **Manual fact-add ships in V1.1** (`POST /api/companion/fact`, source=`manual`) — facts can
    exist and prove the injection before V1.2's extraction lands.
23. **Injection = top-N by `reinforcement_count desc, created_at desc`,** config
    `mezo.companion.facts.top-n` (default 10); block renders Hungarian category labels; empty set
    ⇒ `""` (no empty header). Position: snapshot → **facts** → pattern-ack → `TONE_REMINDER`,
    shared by the sync and streamed turn (both call the same prompt assembly). **Since mezo-q71s**
    the history is no longer part of this ordering at all — it travels to the port as its own
    parameter, not rendered into the prompt (§3 "Prompt assembly").
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
    verdict call for redundancy AND grounding-lite (**renamed `unmarkedClaim` at mezo-q71s** — see
    the "Conversational tone" §1 entry and [ADR 0028](../decisions/0028-marked-speculation-in-chat.md);
    the criterion itself changed, not just the name — a linguistically hedged guess is no longer a
    violation, only an unmarked one). Full per-claim EvidenceCheck + numericGroundingCheck stay
    deferred (classifier-tier cost data first). Old ContinuityGate / MultiHorizonLoader intent is
    covered by the snapshot injection — not carried.
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
40. **Graph promotion honours the fact prompt opt-out, closing `mezo-b3pp.30`'s either/or** —
    filter `promoteFact` on `include_in_prompt`, or make the deliberate decision to leave it
    unfiltered explicit in the spec and docs. The first was taken; the second was rejected because
    `include_in_prompt` is already the user's kill-switch for every injection channel
    (`KnowledgeFactService`'s own wording for the V1.1 facts block and the V3.3 acknowledgment
    block), and `GraphPromptAssembler` renders traversed graph nodes into that SAME system prompt
    — the graph is one more channel, not a carve-out. Before this fix, `mezo-b3pp.31`'s revive
    half made the nightly `reconcile` re-assert `status='active'` on an opted-out fact's node, so
    a user who archived that node by hand from the Tudástár UI had it silently resurrected by
    dawn; the filter (mirrored into `retractFact`'s qualifying check) closes that. **This
    durability is specific to opted-out facts** — a fact left `include_in_prompt=true` is
    unaffected: `promoteFact` still unconditionally re-asserts `status='active'` for it, so a
    hand-archive of THAT node is undone by the very next write that touches the fact (even a
    category-only edit now routes through `syncFact` → `promoteFact` within the async hop, an
    even shorter undo window than the old nightly sweep). `include_in_prompt` is the intended
    lever for a fact the user wants out of the prompt — hand-archiving the graph node is not a
    substitute for it. `syncFact` (promote-or-archive in one transaction, the `syncGoal` shape)
    and the unconditionally published `KnowledgeFactChangedEvent` route the toggle to the
    traversal channel (`[Összefüggések]`, the injected fact block) on the user's next turn
    instead of waiting for the sweep, with an edited fact's node title kept fresh as a side
    effect — the weekly `[Rólad tanultam]` block is a separate, slower channel that can still
    carry a paraphrase of an opted-out fact for up to a week; see the W2.2 "Residual window via
    the weekly profile snapshot" note.

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
  (`get_recovery(scope=sleep, days=3)` with a `nincs adat` result is an honest chip); refs only exist when data
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
- **Any NEW call path on `GeminiCompanionLlm`/`GeminiEmbeddingAdapter` must emit an
  `LlmCallRecord`** (mezo-2zyu, [ADR 0014](../decisions/0014-llm-call-audit-log.md)). Recording lives
  inside the adapters because the ports return `String`/`float[]` — a decorator would see no
  metadata. Likewise wrap any new LLM CALL SITE in `LlmCallContextHolder.runWith(...)`, or its rows
  land under `feature = 'unknown'`.
- **Never declare a plain `Executor` bean** — Boot's `applicationTaskExecutor` is
  `@ConditionalOnMissingBean(Executor.class)`, so it silently backs off and every `@Async` in the app
  moves onto YOUR pool. `LlmLogAsyncConfig` uses `@Bean(defaultCandidate = false)` for exactly this;
  copy that if another feature ever needs its own pool.
- **Audit rows are not owner-scoped and not soft-deletable** — `created_by` is null on cron/`@Async`
  threads (no security-context propagation, and `LlmActorResolver` returns null rather than
  throwing), and `llm_log_history` has no `is_deleted`. So don't add an ownership filter to a future
  read side, and filter `status = 'SUCCESS'` in any usage/cost aggregate.

**W4.1 feedback decisions + gotchas (`mezo-b3pp.15`, spec §4.4/§8.1):**

- **Experiments and challenges are deliberately NOT feedback artifact kinds.** Their own
  `POST …/experiment/{id}/decision` and `POST …/challenge/{id}/decision` endpoints (accept/dismiss,
  [`proactive.md` §4](proactive.md)) ALREADY carry the same signal, and carry it better — a decision
  is an act with consequences, not an opinion. Adding a second, weaker channel for the same judgment
  would split the training data W4.2 reads and let the two disagree. The seven kinds (five at
  `mezo-b3pp.15`, `weekly_review` added `mezo-p2tr`, `day_review` added `mezo-jcpt.9`) are exactly
  the artifacts the user can otherwise only read.
- **Re-tapping the SAME verdict is a retraction, not a no-op** — one tap sets it, the same tap again
  clears it. The semantics live in the FE hook (`useFeedback.vote`), not in the backend: the API has
  a plain upsert and a plain delete, and it is `vote()` that decides which one a tap means. A tap
  that carries a reason is **always** an upsert, even when the verdict is unchanged — otherwise
  re-picking the reason already stored would silently delete the vote.
- **Re-voting after a retraction RESURRECTS the row** rather than inserting a new one, because
  `uq_message_feedback_artifact` spans soft-deleted rows. Do not "simplify" the native upsert into a
  find-then-save: `@SQLRestriction` hides the ghost row from every derived finder, so the save would
  hit a unique violation nobody's code can see coming. (Contrast `daily_summary`, which uses a
  `where is_deleted = false` PARTIAL unique index for the opposite reason — regenerability. Both
  choices are deliberate; check which one a table made before writing its write path.)
- **The reason/verdict cross-field rule is enforced TWICE, on purpose.** `ck_message_feedback_reason`
  is the backstop; `MessageFeedbackService.put` raises the honest 400
  `FEEDBACK_REASON_REQUIRES_DOWN` first, because a CHECK violation reaching the client as a 500 is
  not an answer. A `@Pattern` cannot express it (it sees one field), so the entity carries only the
  two value patterns.
- **Artifact existence is never checked.** Five kinds, five tables, no conditional FK — and a
  dangling id is harmless single-user (a vote on a since-deleted artifact simply never gets read
  back). `CompanionFeedbackApiIT.testPutFeedback_shouldAccept_whenArtifactIdDanglingAcrossTables` is
  the regression anchor: it fails the moment someone adds a lookup.
- **No feature switch of its own** — feedback rides `COMPANION_SWITCH` as a companion organ. Don't
  add `mezo.feature.feedback.*`; a surface whose chips work while the companion is dark would be
  collecting opinions about nothing.

**Batch-read chunking decisions + gotchas (`mezo-b3pp.23`, §5.7 above):**

- **Chunk at the api layer, not the hook.** `feedbackApi.list` is the only place that knows about
  HTTP request shape; `useFeedback`/`feedbackHooks.ts` only knows about ids and verdicts. Moving the
  chunk loop into the hook would have meant either N cache entries per page (defeating the "one
  chip re-tap invalidates everything" model) or hand-rolled merge logic duplicated at every call
  site — the api function is the one caller `useDualQuery`'s `realFetch` invokes, so merging there
  is free.
- **A failing chunk rejects the whole call — no partial merge.** `Promise.all` was chosen over
  `Promise.allSettled` on purpose: a partially successful batch would render *some* chips correctly
  and others silently unvoted with no way for the page to tell "unvoted" from "read failed", which
  is strictly worse than `useFeedback`'s existing whole-read degrade to `realEmpty` (IDENT-3).
  **This does amplify under retry:** the app `QueryClient` is `retry: 1`
  (`QueryProvider.tsx:21`) and a retry re-runs the whole `queryFn`, so one flaky chunk on a
  near-ceiling page re-fires every chunk — up to 20 requests instead of 2 — which is the accepted
  cost of the all-or-nothing choice above, not a defect.
- **Two alternatives were on the table and both were rejected, confirmed with the human partner.**
  Raising `server.max-http-request-header-size` to 16 KB in `application.yml` would have fixed the
  symptom without a ceiling, but ties FE payload size to a JVM/container tuning knob nobody else on
  the team would think to look at when the next artifact-heavy surface reintroduces the problem.
  Lowering `FEEDBACK_MAX_IDS` to ~120 (comfortably under the 200 that broke at 8 KB) would have
  "fixed" the header failure but only by moving the *existing*, bd-unmentioned `slice(-FEEDBACK_MAX_IDS)`
  truncation earlier — from 200 down to 120 — trading one silent-unvoted-chip bug for a smaller
  version of the same bug. Chunking is the only option that removes the header wall without
  shrinking what a page can ask for.
- **`FEEDBACK_MAX_IDS` (1000) is a request-count ceiling now, not a header-budget one** —
  `FEEDBACK_IDS_PER_REQUEST` (100) owns the header budget. The two constants are read from
  different files for a reason: raising the per-request chunk size back toward 200 would silently
  reopen the original Tomcat failure, which is exactly what
  `feedbackApi.test.ts`'s `list_shouldKeepEveryRequestUnderTheHeaderBudget` pins against.
- **The residual is real, not swept under the ceiling.** A conversation past 1000 rendered artifact
  ids still drops the oldest ones from the batch read — the same failure mode as the pre-fix 200,
  just an order of magnitude further out. The honest fix is windowing
  `CompanionController.listMessages` server-side so a page never renders 1000 ids to begin with;
  that is out of scope for this slice and undocumented as solved anywhere in this file.

**W3.1 ambient-recall gotchas (`mezo-b3pp.12`, spec §7.1):**

- **The ANN runs on raw JDBC under a HAND-TAKEN savepoint, not through JPA — and not through
  `PROPAGATION_NESTED` either.** `MemoryEmbeddingAnnQuery` executes on the *caller's own*
  connection and wraps the statement in `connection.setSavepoint(...)`, so a failed query rolls
  back to that savepoint and the turn's transaction stays usable. A JPA query would poison it
  twice over: Postgres would leave the transaction in its "current transaction is aborted,
  commands ignored until end of transaction block" state, and Hibernate marks the session
  rollback-only on **any** query `PersistenceException`. `PROPAGATION_NESTED` was tried and does
  NOT work here — `JpaTransactionManager` throws `NestedTransactionNotSupportedException: JpaDialect
  does not support savepoints` even with `setNestedTransactionAllowed(true)`, because
  `HibernateJpaDialect` exposes no `SavepointManager`. **Do not "simplify" this back into a
  `@Query` finder or a `REQUIRES_NEW`/`NESTED` annotation.** Same-connection also means the query
  sees the caller's uncommitted rows and never waits on a second connection's lock — which is what
  lets the `@Transactional` ITs work at all (the house idiom keeps `ResetDatabase`'s TRUNCATE lock
  inside the test transaction). Outside a transaction (auto-commit) no savepoint is taken; a
  savepoint would be illegal there.
- **The test split is not stylistic.** Assembler behavior (caps, floor, today-skip, decay order,
  failure paths) is asserted in `@Transactional` ITs; anything that asserts the turn COMMITS — the
  persisted refs envelope, the `done` row, the savepoint surviving a real commit — must live in a
  NON-`@Transactional` class (`ChatServiceAmbientRecallIT`, `ChatStreamServiceIT`,
  `MemoryEmbeddingAnnQueryIT`). A commit assertion inside a test-managed, always-rolled-back
  transaction asserts nothing. Any future ambient test that seeds vectors and checks a commit
  belongs in the non-transactional class.
- **`ambient-recall.max-tokens` is a safety net, not a working limit.** Under the shipped defaults
  (6 items × ≤300 chars) the block tops out around 700 estimated tokens against a 1200 cap, so the
  render loop never truncates in practice. It exists so that raising the caps or
  `recall.render-max-chars` cannot silently blow the prompt budget — see the §4 config bullet for
  what happens at the validated extremes.
- **Weekly/monthly summaries were HU labels before they were a group.** W3.1 shipped `KIND_LABELS`
  entries for `weekly_summary`/`monthly_summary` (`heti összefoglaló` / `havi összefoglaló`) while
  nothing wrote those rows and no query group asked for them — the seam left ready on purpose.
  **W3.2** (`mezo-b3pp.13`) closed it: the rungs are generated, embedded, queried as the fifth
  group, and the coverage filter shadows old daily hits with their covering rung.

**The empty-answer guard (`mezo-8z79`, 2026-08-23 live incident):**

- **A blank final answer is a FAILED turn, not an empty message.** Gemini can end a streamed round
  having emitted **no text at all** — no tool call, no error, a candidate with zero text parts (a
  thinking-only round that hits the output cap is the usual cause). The deltas then carry nothing,
  `answer.toString()` is `""`, and — this is the part that made it silent — **the advisor chain
  PASSES an empty answer**: the clinical regex finds nothing to object to and the LLM verdict
  returns `false/false` on an empty "MEZO VÁLASZA" block, so `retries=0, degraded=false`. The
  observed live signature was exactly that: `Advisor chain took 6316 ms (retries=0,
  degraded=false)` on a turn that persisted an empty row.
- **What the user saw:** an answer card with no prose, carrying only the `Hivatkozott · L3` strip
  and the `Emlékek` row — because the ambient Memory refs are added to the audit **after** the LLM
  round (step 4b of the stream flow), so they exist even when the answer does not.
- **The guard:** `ChatStreamService` rejects a null/blank `finalAnswer` before `completeTurn` and
  terminates the stream with `event:error, code=COMPANION_EMPTY_ANSWER` — the assistant row is
  never written, exactly like the mid-stream failure path. `ChatService.sendMessage` throws the
  same code (one transaction ⇒ the user row rolls back too). The FE gives that code its own
  message rather than the generic one, since an immediate retry is the right move.
- **`toTurns` filters blank rows — and that is NOT a duplicate of the guard.** The rows written
  before the guard existed are still in the database, and an empty `AssistantMessage` part can be
  rejected by the provider, which would poison **every later turn of that thread**. The filter is
  the retroactive half; the guard only stops new ones.
- **`llm_log_history.finish_reason` exists because this was undiagnosable without it.** An empty
  `response_text` alone cannot distinguish "the model chose to stop" (`STOP`) from "the model was
  cut off mid-thinking" (`MAX_TOKENS`) or a blocked candidate (`SAFETY`). Read off the FINAL
  generation's `ChatGenerationMetadata` in `GeminiUsageExtractor.finishReason` — the one place
  allowed to touch provider metadata — and surfaced on the `/me/ai-usage` detail page.
- **Related, still open: the verdict judge cannot see tool RESULTS.** The same incident's *first*
  turn was degraded with a plausible-looking but unverifiable complaint about a weight number,
  because `TurnVerdictCheck` gets the tool call NAMES but not their output (documented v1 limitation
  in its javadoc). A judge that must reason about a number it was never shown will keep producing
  this class of false positive.

**W5.1 composite-flag decisions + gotchas (`mezo-b3pp.18`, spec §9.1):**

- **`FlagProperties` is its own `@ConfigurationProperties(prefix = "mezo.companion.flags")`
  record, not a `CompanionProperties` nested field.** The spec's own wording (written before W4.2/
  W4.3 shipped) assumed the shared record; by the time this slice landed,
  `FeedbackLearningProperties` (W4.2) and `ProfileProperties` (W4.3) had already established a
  feature-scoped `@ConfigurationProperties` record as the house idiom for a slice's own tunables,
  and `FlagProperties` follows that precedent rather than growing the already-large
  `CompanionProperties` further. Recorded here as a deliberate deviation from the spec's literal
  text, not a silent one.
- **`sleep_debt`'s window ends TODAY; `momentum_at_risk`'s recent window ends yesterday (its
  baseline window sits entirely before that) — for a different reason, not the same one.**
  `sleep_log.date` is the WAKE-UP MORNING, not the evening the night began (confirmed by
  `HabitEvaluator`'s `sleep_wake_window`/`bedtime_next_day` metrics and by `SleepLogSheet` posting
  `date=today` on wake), so the row dated today already IS last night — excluding it would drop
  the very night that triggered the on-write evaluation and understate the deficit on every
  evaluation; an unlogged today is simply skipped by the existing null check, never counted as a
  debt-free night. `momentum_at_risk` excludes today for the opposite reason: today's habits are
  still in progress at whatever hour the evaluator runs, so counting an unfinished day's zero
  completions as a collapse would flag every single morning. `sustained_stress` and
  `recovery_needed` DO include today deliberately — a check-in or a workout already logged today is
  real signal the moment it lands, and both rules read from series that go stale rather than series
  that are inherently incomplete until the day ends. (This entry originally stated that `sleep_debt`
  excluded today on the same "logged tomorrow morning" premise as `momentum_at_risk`; that premise
  was wrong and was corrected during final review, along with the evaluator's window and its
  tests — see the sleep_debt row above and `FlagEvaluatorStressSleepIT`.)
- **`all_healthy` never raises over an empty log.** The guard requires the quiet window to
  actually contain at least one observed check-in-stress or sleep value, not merely the absence of
  a problem flag — a brand-new user, or one who logged nothing for a week, has NO evidence either
  way, and claiming "all healthy" there would be a claim about nothing. The same IDENT-3
  honest-degradation identity every other companion surface holds to (contrast the `[Emlékek]`/
  `[Összefüggések]` blocks above, which render `""` rather than fabricate) — a raised
  `all_healthy` row is a positive claim, so it earns the same evidentiary bar as any other flag.
- **The raise path is check-then-act, not atomic: `FlagService.evaluateAndLog` reads
  `existsRaiseSince` and only then `save`s.** The on-write listener and the hourly sweep can both
  evaluate the same user within milliseconds of each other (a check-in save fires the listener
  right as the sweep is mid-run), and nothing serializes the two — each can pass the same
  cooldown-window read before either writes, so a duplicate audit row for the same flag inside one
  cooldown window is possible, not merely theoretical. `companion_flag_log` is append-only and has
  no uniqueness constraint on `(created_by, flag_key)` within a window, so this is not a bug to fix
  here — it is a property W5.2 (the raise → intervention consumer) must design for: tolerate
  duplicate rows inside a cooldown window rather than assume one row per window per flag.
  **Resolved by construction, not by fixing this row:** `InterventionService` never reads
  `companion_flag_log` at all — its own cooldown gate reads recent `companion_message` envelope
  keys (§4 above), and its own anti-nag gate is the `companion_message` partial-unique index (one
  card per user+day+kind). A duplicate `FlagRaisedEvent` from two near-simultaneous raises therefore
  triggers at most one delivered card (the "today's card already exists" short-circuit runs before
  candidate selection); the duplicate audit rows this bullet describes stay a `companion_flag_log`
  bookkeeping quirk, never a duplicate delivery.
- **One evaluation issues roughly 9 `MetricSeriesService.series` calls, three of which
  (`sustained_stress`, `recovery_needed`, `all_healthy` — all reading `CHECKIN_STRESS`) query the
  `[from, to]` window directly via `CheckInRepository.findByCreatedByAndDeletedFalseAndDateBetween`**
  (the `MetricSeriesService.checkIn` implementation, shared by every `CHECKIN_*` metric —
  mezo-8tp8's B2 fix moved this off the earlier `findAllOwned` + in-memory filter, the same window
  finder `DayScoreService.checkinCounts` and `MeWeekService.checkinsByDate` already used). Fine at
  today's single-user-interactive-request scale — this runs at most once per write plus once an
  hour — and no longer scans the owner's full check-in history to do it.

**W5.2 intervention delivery decisions + gotchas (`mezo-b3pp.19`, spec §9.2):**

- **`channel: push` and `channel: both` are the SAME behavior (user decision, 2026-08-24) — the
  spec's three-value enum reads as two.** The card is always the push anchor AND the „Segített?"
  home, so there is no meaningful "push without a card" to distinguish from "card + push"; only
  `feed` (card, no push) is a real behavioral fork. Recorded here as a deliberate reading, not a
  silent no-op branch — see §4 above.
- **One card per day is enforced by the SAME partial-unique index that gives every other
  `companion_message` kind its idempotence, but it means something different here.** For
  `morning`/`sleep`/`weight`/`midday`/`evening` the index makes REGENERATION idempotent (a retry
  finds the existing row). For `intervention` it makes a SECOND RAISE OF ANY FLAG THE SAME DAY a
  no-op — the anti-nagging behavior is a side effect of reusing the existing table shape, not a
  bespoke guard. Worth knowing before touching the index: loosening it for another kind would also
  loosen `intervention`'s once-a-day ceiling.
- **The optimistic prior (`1.5`) is a `static final double` constant, not a config knob.** Spec
  §9.2 mandates it as a fixed exploration-over-exploitation rule (an unseen entry always beats a
  voted one, since 1.5 > any real up/total ratio); making it configurable would let a future change
  quietly break that guarantee for values ≥ 1.0 or ≤ 0, so it stays code, not `application.yml`.
- **`InterventionService` runs `@Transactional` and reads `feedback_rollup` for every candidate
  synchronously** — fine at single-user, ≤6-entries-per-flag scale (spec §12), but a library grown
  to dozens of entries per flag would turn this into N rollup reads per raise; not a problem today,
  worth knowing before the library grows much past its shipped 6. (Final-review fix, mezo-b3pp.19:
  the N reads are precomputed into a `Map<key, effectiveness>` BEFORE `Stream.max`, not inside its
  comparator — `Comparator.comparingDouble`'s key extractor would otherwise re-invoke the DB read
  on every pairwise comparison, not just once per candidate; the map keeps it to exactly N reads and
  leaves the config-order tie-break — first max under a strict comparator — untouched.)

**W5.3 quarterly deep pass decisions + gotchas (`mezo-b3pp.20`, spec §9.3):**

- **A SEASON node is never profile input, in ANY status — not "not yet," never.**
  `ProfileAssembler.habitNodes` filters strictly to ACTIVE `PATTERN`/`PREFERENCE` nodes; a `SEASON`
  is neither of those kinds, so a fresh candidate, an accepted active one, or a rejected
  soft-deleted one are all equally invisible to the profile synthesis. This is easy to misread
  from `QuarterlyReviewJob`'s own two-phase shape: phase 2 (`ProfileAssembler.rebuild`) runs
  right after phase 1 (the season proposal), which looks like "the season feeds the profile." It
  doesn't — phase 2 runs there because that is the moment the newly finished quarter becomes the
  right ANCHOR for `DÖNTÉSI MINŐSÉG`'s quarter-over-quarter comparison (§4 above), a purely
  date-driven trigger that would fire identically even if phase 1 proposed zero candidates every
  single quarter.
- **`compare_periods` deliberately excludes `feedback_rollup`, resolving an ambiguity in spec
  §9.3's own wording.** The spec describes the quarterly job's INPUT as "period_summaries +
  rollups" and was read, before this slice locked the tool's shape, as implying the
  `compare_periods` tool should expose the same two sources. It doesn't: `QuarterlyReviewService`
  reads both (§4 above, feeding the SEASON proposal), but `MemoryTools.comparePeriods` reads
  ONLY `period_summary` rungs. **Resolved with Daniel (product owner), recorded here rather than
  silently decided**: a period comparison is a question about his LIFE — what characterized the
  summer vs. the spring — not about how the AI itself performed; `feedback_rollup` scores
  companion effectiveness, not Daniel's own history, and folding it into an answer to "milyen volt
  a nyár" would quietly answer a different question than the one asked. Per
  `docs/references/companion_tool_conventions.md` rule 4 (no overclaim — a deliberately excluded
  value must be STATED, not just omitted), the tool's own `@Tool` description says so explicitly:
  "Csak a saját időszak-összefoglalóit adja vissza — az AI-üzenetekre adott visszajelzéseket …
  NEM tartalmazza."
- **`QuarterlyProperties` is its own `@ConfigurationProperties(prefix =
  "mezo.companion.quarterly")` record, not a `CompanionProperties` nested field** — the same
  deviation `FlagProperties` recorded for the identical reason (§9 above): by the time this slice
  landed, `FeedbackLearningProperties`/`ProfileProperties`/`FlagProperties` had already established
  a feature-scoped record as the house idiom for a slice's own tunables, and growing the
  already-large `CompanionProperties` further would only widen a file every companion session has
  to read.
- **The decision-quality window is half-open, `[quarterStart, quarterStart + 3 months)`, fixed
  during final review.** The original finder used Spring Data's `Between`, which is INCLUSIVE at
  both ends; a decision reviewed at exactly a quarter's first instant landed in that quarter's
  window AND in the previous quarter's window (whose own inclusive upper bound is that same
  instant), double-counting one review into both means. Fixed to
  `ReviewedAtGreaterThanEqual`/`ReviewedAtLessThan`, so the boundary instant counts in the CURRENT
  quarter only — pinned by
  `ProfileAssemblerIT.renderPayload_counts_a_decision_reviewed_at_the_exact_quarter_boundary_only_once`
  (§8 above), which seeds a second row in the previous quarter so the test fails under the old
  query on ANY day of the year, not only on a real quarter boundary.
- **The profile rebuild takes an explicit ANCHOR quarter; it no longer derives one from
  `LocalDate.now()` (final review, F1).** A job that runs AT a period boundary and a job that runs
  inside a period cannot share a now()-derived window: the quarterly cron fires at 04:00 on the
  1st and means the quarter that just CLOSED, while `LocalDate.now()` at that moment names a
  four-hour-old quarter with nothing reviewed in it — so the honest-absence rule silently deleted
  the whole trend section from the payload, and the quarterly rebuild rewrote the user-visible
  *Rólad tanultam* prose from LESS input than the previous weekly run had. The general lesson,
  worth keeping: **a derived time window belongs to the CALLER's intent, not to the callee's
  clock**, and the way to make that safe is a required parameter with no defaulting overload.
- **The quarterly job honours the PROFILE job's switch, but only for phase 2 (final review, F2).**
  A cron that reuses another cron's service inherits that cron's kill switch as an obligation:
  `mezo.techcore.cron.profile-assembler-job.enabled=false` promises no profile rebuild and no
  profile spend, and a quarterly caller ignoring it makes the promise false four times a year —
  including force-reviving an ARCHIVED profile node, which is a user-visible action taken against
  an explicit user choice. Read by **bean presence** (`ObjectProvider<ProfileAssemblerJob>`), the
  house alternative to the banned `@Value`. Phase 1 is deliberately NOT gated on it: the season
  proposal is not the profile job, and one switch must not silently disable an unrelated feature.

**Shared RAG context decisions (`mezo-6dii.5`).**

- Deterministic fusion/selection is the default serving algorithm; LLM reranking is an optional,
  disabled-by-default seam, not a mandatory framework dependency. This keeps the baseline cheap,
  reproducible and measurable before any later LangGraph-style orchestration would earn its cost.
- Retriever failures remain distinguishable from honest empty results in the persisted trace. Audit
  writes use a separate `REQUIRES_NEW` bean so a later caller/model failure cannot erase retrieval
  evidence, and selected result IDs are available for feedback linkage.
- Audit retention uses physical deletion intentionally. It is narrowly owner-and-cutoff scoped and
  exists only so FK cascade can purge expired audit/result/feedback rows; canonical memories retain
  normal lifecycle/soft-delete semantics.

**Shared RAG chat rollout decisions (`mezo-6dii.6`).**

- SHADOW is the safe default: the model still sees and returns exactly the frozen OLD context while
  the platform collects beta-shaped latency, failure and ranking evidence in the audit tables.
- Sync and SSE do not own separate retrieval logic. Both load history first and call one adapter,
  then persist the same disclosure envelope; this prevents rollout drift between delivery modes.
- NEW composes only the unified rendered block. It never double-injects legacy facts, ambient
  memories or graph context. A partial retriever failure serves successful peers; only an audited
  total outage falls back to OLD.
- No LangGraph dependency is introduced for this deterministic fan-out/fusion pipeline. The
  existing typed service boundary remains replaceable if later multi-step agent orchestration earns
  its operational cost.

**Retrieval-feedback decisions (`mezo-6dii.7`).**

- A feedback write is anchored to an audited owned run/result pair. The browser never submits a
  canonical item ID as authority, and the server requires `selected=true`, preventing feedback or
  suppression of a candidate that was not actually shown.
- Suppression is a reversible lifecycle state, not physical deletion. It immediately affects all
  active-item retrievers while retaining provenance and evaluation evidence. It is terminal on
  this feedback endpoint; a future explicit restore flow may reactivate the canonical item, but a
  later rating cannot do so implicitly.
- Useful/irrelevant labels are collected but do not silently tune production ranking in this
  slice. Offline evaluation and guarded weight proposals belong to `mezo-6dii.8`.
- The PUT response is server truth and remains in the FE cache; an extra post-write refetch would
  add latency and allow a fast stale read to erase the optimistic result. Failed writes restore the
  exact pre-mutation cache snapshot.

**Deferred (with bd ids):**
- ~~**W3.3 recall tuning (`mezo-b3pp.14`, spec §7.3)**~~ — **shipped**: per-group
  `min-similarity`/τ/cap in config, the deterministic eval harness, and its follow-up
  **`mezo-b3pp.27`** (ambient recall re-surfacing the active conversation's own `chat_turn` rows,
  which the history window already carries) closed by
  `ambient-recall.exclude-current-conversation`. See the W3.3 row in §1 and the §4 config bullets.
- **W4.2 — what the captured verdicts are FOR.** W4.1 only records; nothing reads `message_feedback`
  yet (no prompt influence, no ranking, no aggregate surface). That is the point — it starts the
  data collecting now so the personalization slice has history instead of a cold start.
- **LLM audit-log follow-ups (mezo-2zyu; read API + `/me/ai-usage` browsing UI shipped `mezo-uakh`):**
  still open — budget alerting and reconciling the placeholder `mezo.llm-log.pricing` rates with
  current Gemini pricing (payload retention itself shipped, `mezo-1y3p` — see the retention bullet
  above). (`mezo-58ig` per-round usage and
  `mezo-1rz9` CANCELLED streams are FIXED — see the audit-log section above.)
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
- **Knowledge graph edges — RESOLVED (`mezo-ms9a`).** The graph layer (now the unified Tudástár's
  `?view=kategoriak`) has real backend data since W2.6 (`GET /api/companion/graph/node`,
  `topEdges` per node) and the hero's active-edge COUNT is real since `mezo-ms9a`'s
  `GET /api/companion/graph/edge/count`; only `useKnowledge()`'s own legacy `edges` field (the
  pre-graph mock fact-edges) is still mock-only real-mode-`[]` — see [`insights.md` §2.4/§5.1](insights.md).

## 10. Key files

**API contract**
- `api/feature/companion/companion.yml` — the conversation/fact/pattern surface (tag `Companion` → `CompanionApi`), the SSE turn (tag `CompanionStream`, hand-written), the voice note (tag `CompanionVoice` → `CompanionVoiceApi`, `mezo-at8x.4`) and, since **`mezo-al1i`**, the `memory/{overview,summary,similar-days,llm-usage}` reads on the same `Companion` tag;
  registered in `api/generate/merge.yml` → merged `api/openapi.yml` → `api.gen.ts` + `io.mrkuhne.mezo.api.*`.
- `api/feature/companion-feedback/companion-feedback.yml` — **`mezo-b3pp.15`** the 👍/👎 surface on its OWN fragment + tag (`CompanionFeedback` → `CompanionFeedbackApi`); GET batch-read / PUT upsert / DELETE retract, also registered in `api/generate/merge.yml`.
- `api/feature/knowledge-graph/knowledge-graph.yml` — **`mezo-b3pp.6`** the W2.1 knowledge-graph surface on its OWN fragment + tag (`KnowledgeGraph` → `KnowledgeGraphApi`); GET active nodes / POST archive, also registered in `api/generate/merge.yml`.

**Backend — shared RAG persistence foundation (`mezo-6dii.1` — §3/§4/§8)**
- `backend/src/main/resources/db/changelog/1.0.0/script/202609041020_mezo-6dii.1_memory_platform.sql` — canonical item/vector generations, retrieval audit/feedback tables, legacy backfill and migration invariants; `memory_embedding` remains untouched.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/entity/` — the five entities plus typed `MemoryProvenanceEnvelope` and `ScoreBreakdownEnvelope` jsonb records.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/repository/` — owner-scoped business finders for canonical items, vectors and the audit chain.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/KnowledgeFactEntity.java` — additive pinning, validity, conflict/supersession and provenance mappings.
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/MemoryPlatformPersistenceIT.java` + `support/populator/MemoryItemPopulator.java` — PostgreSQL persistence/backfill/ownership/cascade coverage.

**Backend — canonical dual-write + vector generations (`mezo-6dii.2` — §3/§4/§8)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java` — unchanged OLD persistence semantics plus commit-bound canonical upsert/suppress events, reusing the already-produced vector.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/config/MemoryPlatformProperties.java` + `backend/src/main/resources/application.yml` — typed serving-generation, retrieval, re-embedding and audit-retention configuration; scheduled re-embedding is off by default.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/{MemoryProjectionEvent,MemoryProjectionListener,MemoryProjectionWriter}.java` — AFTER_COMMIT hand-off, isolated transaction, source-key lifecycle and serving-generation write.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/{MemoryReembeddingService,MemoryReembeddingJob}.java` — bounded resumable target-generation backfill and active-user fan-out without serving-version mutation.
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/{MemoryProjectionWriterIT,MemoryProjectionFailureIsolationIT,MemoryReembeddingIT}.java` + `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriterIT.java` — lifecycle, failure-isolation, generation coexistence/retry and all-source dual-write coverage.

**Backend — adaptive memory query preparation (`mezo-6dii.3` — §3/§8)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/dto/{ConsumerPolicy,QueryMode,MemoryRequest,PreparedMemoryQuery}.java` — shared consumer/request boundary and the deterministic prepared-query result.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/{MemoryQueryAnalyzer,MemoryQueryPreparer,MemoryQueryRewriter,LlmMemoryQueryRewriter}.java` — conservative routing, bounded contextual rewrite and raw-query fallback over the existing cheap LLM port.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` — deterministic `[fake-memory-rewrite:…]` scripting plus captured bounded history for integration assertions.
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryQueryAnalyzerTest.java` + `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/MemoryQueryPreparerIT.java` — routing/date unit coverage and real-context rewrite/fallback coverage.

**Backend — hybrid candidate retrievers (`mezo-6dii.4` — §3/§5/§8)**

- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/dto/{RetrievalInput,MemoryCandidate}.java` + `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryRetriever.java` — the common invocation and provenance-rich candidate contracts; fact/graph candidates honestly have no `memoryItemId`, and graph edges may have no event date.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/repository/{DenseMemoryQuery,LexicalMemoryQuery,KnowledgeFactRetrievalQuery}.java` — owner/state/validity/as-of filtering in SQL, serving-generation ANN, folded FTS+trigram ranking, pinned/matching/conflict fact union and same-connection savepoint isolation.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/{DenseMemoryRetriever,LexicalMemoryRetriever,FactMemoryRetriever,GraphMemoryRetriever}.java` — the named `dense`/`lexical`/`facts`/`graph` adapters; graph reuses the configured `GraphTraversalService` bounds.
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/HybridMemoryRetrieverIT.java` — deterministic pgvector/FTS/fact/graph result, ownership and failure-boundary matrix.

**Backend — fusion, selection, reranking and retrieval audit (`mezo-6dii.5` — §3–§5/§8–§9)**

- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/{MemoryContextService,MemoryCandidateFusion,MemoryContextSelector,MemoryContextRenderer}.java` — concurrent failure-isolated orchestration, deterministic explainable ranking and exact-budget provenance rendering.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/{MemoryReranker,LlmMemoryReranker}.java` — optional uncertainty-only smart-tier ordering with exposed-ID validation and deterministic fallback.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/{MemoryRetrievalAuditWriter,MemoryRetrievalRetentionJob}.java` — independent run/result persistence and active-user 30-day physical audit purge.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/dto/{MemoryContext,MemoryContextItem,ScoreBreakdown,RetrievalServingMode}.java` — structured context/provenance/score and staged rollout contracts.
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/{MemoryCandidateFusionTest,MemoryContextSelectorTest,LlmMemoryRerankerTest,MemoryContextServiceIT,MemoryPlatformPropertiesIT,MemoryRetrievalRetentionIT}.java` — pure ranking/rendering and PostgreSQL orchestration/config/retention gates.

**Backend + contract — chat rollout (`mezo-6dii.6` — §2–§5/§8–§9)**

- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/{ChatMemoryContextAdapter,MemoryShadowRunner}.java` — the single OLD/SHADOW/NEW boundary and its fire-and-forget, exception-isolated audit runner.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java` — sync/SSE preparation loads bounded history before resolving one shared memory payload; NEW never assembles duplicate legacy blocks.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/RecalledMemoriesEnvelope.java` + `mapper/CompanionMapper.java` — backward-compatible JSONB plus optional retrieval run/result/item IDs and indicator on the wire.
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/{ChatMemoryRolloutIT,ChatMemoryShadowRolloutIT,ChatServiceAmbientRecallIT,ChatStreamServiceIT}.java` — NEW, SHADOW and frozen OLD behavior across synchronous and streamed turns.
- `frontend/src/data/{types.ts,insights/chatApi.ts,insights/chatApi.test.ts,_client/api.gen.ts}` — optional disclosure provenance passthrough generated from the additive Companion contract.

**Backend + FE — retrieval feedback (`mezo-6dii.7` — §2–§5/§8–§9)**

- `api/feature/memory-retrieval/memory-retrieval.yml` — batch feedback read and audited
  run/result feedback PUT contract.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/{controller/MemoryRetrievalController,service/MemoryItemFeedbackService}.java`
  — current-user boundary, feedback upsert and canonical suppression transaction.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/repository/MemoryRetrievalFeedbackRepository.java`
  + `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/MemoryRetrievalFeedbackApiIT.java`
  — owned batch finder and HTTP/integration gate.
- `frontend/src/data/insights/{memoryFeedbackApi,memoryFeedbackHooks}.ts` — generated-contract API
  mapper plus single-page batch query and optimistic action handle.
- `frontend/src/features/insights/components/{RecalledMemoriesRow,ChatMessage}.tsx` +
  `frontend/src/features/insights/pages/ChatPage.tsx` — disclosure controls and one hook per thread.

**Backend — synthetic Hungarian memory eval (`mezo-6dii.8` — §8)**

- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/eval/{MemoryEvalCorpus,MemoryEvalMetrics,SyntheticMemoryCorpusGenerator,MemoryRetrievalDeterministicEvalIT,MemoryEvalMetricsTest}.java`
  — immutable corpus/review shapes, metric arithmetic, deterministic generation plus approval entry
  point, and network-free OLD-vs-NEW PostgreSQL regression runner.
- `backend/src/test/resources/eval/memory/v1/{personas,development,tuning,holdout,review}.json`
  — versioned three-persona corpus and SHA-bound human review metadata. `review.json` exists only
  after the explicit holdout review/approval command; changing the holdout invalidates it.

**Backend — feedback (W4.1, `mezo-b3pp.15` — §4/§5.7)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/controller/CompanionFeedbackController.java` — `implements CompanionFeedbackApi`, `COMPANION_SWITCH`-gated, ownership from `CurrentUserId`, thin delegation.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/service/MessageFeedbackService.java` — `put` (the honest `FEEDBACK_REASON_REQUIRES_DOWN` 400 before the upsert, then a re-read so the response is server truth — the can't-happen empty re-read raises `FEEDBACK_UPSERT_READBACK_FAILED` **500**: our fault, not the caller's) / `retract` (idempotent soft delete) / `list` (batch read).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/repository/MessageFeedbackRepository.java` — the two owner+kind finders and **`upsertVerdict`**, the native `on conflict … do update` that resurrects a retracted row (§9 — do not replace it with find-then-save).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/entity/MessageFeedbackEntity.java` — `extends OwnedEntity`, soft-deleted, `KIND_*`/`VERDICT_*`/`REASON_*` constants + the value `@Pattern`s (the cross-field CHECK has no entity twin, §4).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/mapper/MessageFeedbackMapper.java` — entity → `MessageFeedbackResponse` (`Instant` → UTC `OffsetDateTime`).
- `backend/src/main/resources/db/changelog/1.0.0/script/202608211200_mezo-b3pp.15_create_message_feedback.sql` — the table (in `1.0.0_master.yml`); `messages.properties` gained `FEEDBACK_REASON_REQUIRES_DOWN` + `FEEDBACK_UPSERT_READBACK_FAILED`.
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/feedback/{CompanionFeedbackApiIT,MessageFeedbackPersistenceIT,CompanionFeedbackSwitchOffIT}.java` + `support/populator/FeedbackPopulator.java` (+ `message_feedback` in `ResetDatabase`) — §8.
- **FE side** (documented in [`insights.md` §10](insights.md)): `frontend/src/data/feedback/` (`feedbackTypes`/`feedbackApi`/`feedbackMock`/`feedbackHooks`, exported through the `@/data/hooks` barrel) + `frontend/src/features/insights/components/FeedbackChips.tsx`.

**Backend — pragmatic profile (W4.3, `mezo-b3pp.17` — §4/§5, spec §8.3)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/profile/config/ProfileProperties.java` — the four `mezo.companion.profile.*` knobs (`cron`, `renderMaxTokens`, `maxDecisions`, `maxGraphNodes`), a feature-scoped record (`@ConfigurationPropertiesScan`) rather than another `CompanionProperties` nested component — the `FeedbackLearningProperties` precedent.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/profile/entity/ProfileMetaEnvelope.java` — the profile node's typed `meta.profile` payload (`generatedAt`/`feedbackSignals`/`reviewedDecisions`/`graphNodes`), hand-rolled under its own `META_KEY` (the `GraphProposedEdge` idiom).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/profile/service/ProfileAssembler.java` — `rebuild(userId)`: pure-code gather (feedback rollups, style histogram, reviewed decisions, active PATTERN/PREFERENCE titles) → ONE smart-tier `completeSmart` call → `GraphService.upsertNode` into the singleton `(kind=INSIGHT, source_kind='profile', source_id=userId)` row, explicitly re-activated after the upsert. Honest absence: no signal ⇒ `Optional.empty()`, no LLM call, no write.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/profile/service/ProfileAssemblerJob.java` — the weekly sweep (Monday 03:45, after the 03:10 rollups and 03:30 consolidation rung), per-user try/catch, `PROFILE_ASSEMBLER_JOB_SWITCH`-gated. Calls `ProfileAssembler.rebuild(userId, Quarters.startOf(LocalDate.now()))` — the same method W5.3 (`mezo-b3pp.20`) reuses after the quarterly pass with a DIFFERENT anchor, and the bean whose presence W5.3 reads as this switch (§4).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/profile/service/ProfilePromptAssembler.java` — the `[Rólad tanultam]` block: `render(userId)` reads the ACTIVE node, caps it again at render time, never throws (IDENT-3), `""` when the bean is absent or nothing is stored.
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `PROFILE_ASSEMBLER_JOB_SWITCH` (`mezo.techcore.cron.profile-assembler-job.enabled`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java` — `profileBlock(userId)` (the `ObjectProvider<ProfilePromptAssembler>` idiom, mirroring `graphContext`) folded into `assembleSystemPrompt` between the pattern-ack block and `[Emlékek]`.
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/profile/{ProfileAssemblerJobIT,ProfileAssemblerJobSwitchOffIT,ProfilePromptAssemblerIT,ProfilePropertiesIT,ProfileSourceFindersIT,service/ProfileAssemblerIT,service/ProfileAssemblerCapTest}.java` — §8.
- **FE side** — at ship time, `frontend/src/features/me/pages/KnowledgePage.tsx` + `frontend/src/features/me/components/ProfileNodeCard.tsx`; **since `mezo-ms9a` (2026-09-01)** the card is `frontend/src/features/insights/components/ProfileNodeCard.tsx`, rendered by `KnowledgeListPage`'s `?view=profil` ("Így beszélj velem") view — plus `frontend/src/data/insights/graph.ts` (`PROFILE_SOURCE_KIND`), documented in [`insights.md` §2.4](insights.md).

**Backend — composite flags (W5.1, `mezo-b3pp.18` — §3/§4, spec §4.5/§9.1; `logging_gap`/
`missed_workouts` added S2, bd `mezo-d58h.2`; `acute_bad_day`/`load_fuel_mismatch`/
`rapid_weight_loss`/`joint_overuse`/`ignored_nudge`/`late_eating` added S6 batch B, bd
`mezo-d58h.6`, spec 2026-09-03 §4)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/config/FlagProperties.java` — the `mezo.companion.flags.*` knobs (`sweepCron` + thirteen per-flag threshold records + `cooldownHours`), a feature-scoped `@Validated` record — the `FeedbackLearningProperties`/`ProfileProperties` precedent (§9).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/entity/FlagPayloadEnvelope.java` — the typed jsonb payload, one nested record per rule + a static factory each (the `FeedbackRollupStatsEnvelope` precedent); thirteen variants since S6.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/entity/CompanionFlagLogEntity.java` — `extends OwnedEntity`, append-only, soft-deletable, `flagKey`/`source` `@Pattern`-mirrored CHECKs — `flagKey`'s regex is the FOURTH mirror of the flag-key list (§3 above; `CompanionProperties.Intervention.flag` is the FIFTH), widened by S2 and again by S6.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/repository/CompanionFlagLogRepository.java` — `existsRaiseSince` (the cooldown gate) and `existsProblemRaiseSince` (the `all_healthy` quiet-window gate; its `NOT IN` exclusion list is a degrade-site the five formal mirrors do not cover — §3 above).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagKey.java` — the thirteen flag-key constants + `SOURCE_WRITE`/`SOURCE_SWEEP`, string constants mirroring the DB CHECKs (the `MessageFeedbackEntity` verdict/reason precedent).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagRaise.java` — one flag the evaluator says is TRUE right now, with its payload, before the cooldown gate is applied.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagEvaluator.java` — since S1 (`mezo-d58h.1`) a thin orchestrator calling thirteen `FlagRule` beans in a fixed order, LLM-free (§3).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagRule.java` — S1 (`mezo-d58h.1`): the one-method rule contract, `evaluate(userId, today) → Optional<FlagRaise>`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/NudgeSendPort.java` — S6 (bd `mezo-d58h.6`): the companion-owned port `IgnoredNudgeRule` reads sent `push_log` rows through, avoiding a `companion → notification` import that would close the existing `notification → companion` cycle.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/rule/{SustainedStressRule,SleepDebtRule,MomentumAtRiskRule,RecoveryNeededRule,AllHealthyRule}.java` — S1 (`mezo-d58h.1`): the original five rules, one class each, pure arithmetic over `MetricSeriesService`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/rule/SleepDeficitCalculator.java` — S2 (bd `c6c045082`): the shared sleep-deficit-vs-goal computation, extracted out of `SleepDebtRule` so `LoggingGapRule`'s suspicion variant can reuse it (§3).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/rule/LoggingGapRule.java` — S2 (bd `mezo-d58h.2`): the `logging_gap` rule; reads `MealRepository`/`CheckInRepository`/`SleepLogRepository` directly, not `MetricSeriesService` (§3 recency-read exception).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/rule/MissedWorkoutsRule.java` — S2 (bd `mezo-d58h.2`): the `missed_workouts` rule; consecutive-in-planned-days-not-calendar-days logic (§3).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/rule/{AcuteBadDayRule,LoadFuelMismatchRule,RapidWeightLossRule,JointOveruseRule,IgnoredNudgeRule,LateEatingRule}.java` — S6 batch B (bd `mezo-d58h.6`): the epic's last six rules, in severity order (§3 above has each one's own honesty gate).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagService.java` — the cooldown gate + append (`evaluateAndLog`), the ONLY write path into `companion_flag_log`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagEvaluationListener.java` — the on-write trigger, `@Async @TransactionalEventListener(AFTER_COMMIT)` on `CheckInSavedEvent`/`SleepLogSavedEvent`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagSweepJob.java` — the hourly sweep (`mezo.companion.flags.sweep-cron`), own job switch, per-user try/catch — the caller whose per-user, hourly cadence is what made the S6 bounded-read prerequisite fixes (§3 above) actually matter.
- `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/checkin/service/CheckInSavedEvent.java` — the NEW `CheckInService.save` AFTER_COMMIT event this slice consumes; the check-in feature itself knows nothing about flags.
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `FLAG_SWEEP_JOB_SWITCH` (`mezo.techcore.cron.flag-sweep-job.enabled`).
- `backend/src/main/resources/db/changelog/1.0.0/script/202608241200_mezo-b3pp.18_create_companion_flag_log.sql` — the table (in `1.0.0_master.yml`).
- `backend/src/main/resources/db/changelog/1.0.0/script/202609031200_mezo-d58h.2_flag_key_logging_gap_missed_workouts.sql` — S2: widens `ck_companion_flag_log_flag_key` to seven keys.
- `backend/src/main/resources/db/changelog/1.0.0/script/202609041200_mezo-d58h.6_flag_key_batch_b.sql` — S6: widens `ck_companion_flag_log_flag_key` to the thirteen keys.
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/{CompanionFlagLogPersistenceIT,FlagPropertiesIT,FlagEvaluatorStressSleepIT,FlagEvaluatorMomentumRecoveryIT,FlagServiceIT,FlagEvaluationListenerIT,FlagSweepJobSwitchOffIT,FlagEvaluatorLoggingGapIT,FlagEvaluatorMissedWorkoutsIT,FlagEvaluatorAcuteBadDayIT,FlagEvaluatorLoadFuelMismatchIT,FlagEvaluatorRapidWeightLossIT,FlagEvaluatorJointOveruseIT,FlagEvaluatorIgnoredNudgeIT,FlagEvaluatorLateEatingIT}.java` + `support/populator/FlagLogPopulator.java` (+ `companion_flag_log` in `ResetDatabase`) — §8. **Since W5.2 (`mezo-b3pp.19`), `FlagRaisedEvent` (below) is the consumer** — see the next block.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagRaisedEvent.java` — W5.2 (bd `mezo-b3pp.19`): the `{userId, flagKey, source}` event `FlagService.evaluateAndLog` publishes for every WRITTEN raise, inside the logging transaction (§3/§4 above).

**Backend — intervention delivery (W5.2, `mezo-b3pp.19` — §4/§5.8/§9, spec §9.2; consumer side, lives in `feature.proactive` not `feature.companion`)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/InterventionEventListener.java` — `@Async @TransactionalEventListener(AFTER_COMMIT)` on `FlagRaisedEvent`, the `CompanionMessageEventListener` template; catches and warns rather than propagating.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/InterventionService.java` — `deliverForFlag(userId, flagKey)`: the one-card-per-day gate, per-key cooldown (recent `intervention`-kind card envelope keys), `OPTIMISTIC_PRIOR = 1.5`, max-effectiveness selection, `saveAndFlush` into `companion_message`. PURE CODE — no `LlmCallContextHolder` call anywhere in this class.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java` — the nested `Intervention` record (`interventions()` field) — §4 config keys above.
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `INTERVENTION_SWITCH` (`mezo.feature.intervention.enabled`).
- `backend/src/main/resources/db/changelog/1.0.0/script/202608241500_mezo-b3pp.19_companion_message_intervention_kind.sql` — the CHECK-widening migration (companion_message kind, CK-swap only).
- `backend/src/main/resources/db/changelog/1.0.0/script/202608241600_mezo-b3pp.19_feedback_rollup_intervention_scope.sql` — the CHECK-widening migration (feedback_rollup scope, CK-swap only).
- `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/{InterventionServiceIT,InterventionConfigIT,InterventionSwitchOffIT,CompanionMessageInterventionPersistenceIT}.java` — §8. Push-anchor + quiet-hours tests live under `feature/notification` — see [`_platform-notifications.md`](_platform-notifications.md) §10.
- **FE side** — `frontend/src/features/today/components/MezoMessagesSheet.tsx` (the „Segített?" label on `kind === 'intervention'` rows, same `useFeedback('feed_message')` chips every other card kind uses) + `frontend/src/features/today/logic/mezoMessages.ts` (`MezoMessageItem` gains an optional `kind: FeedMessageKind`, so the sheet can branch on it — the wire never exposes `interventionKey` itself, only `kind`) + `frontend/src/data/types.ts` (`FeedMessageKind` gains `'intervention'`) — see [`proactive.md`](proactive.md) §5.4/§10 (the owning doc for the FE feed consumer) and [`_platform-notifications.md`](_platform-notifications.md) §10 (the `NotificationCategory`/settings-page side).

**Backend — quarterly deep pass (W5.3, `mezo-b3pp.20` — §4/§9, spec §9.3)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/quarterly/config/QuarterlyProperties.java` — the four `mezo.companion.quarterly.*` knobs (`cron`, `maxCandidates`, `maxPeriodLines`, `renderMaxChars`), a feature-scoped record (`@ConfigurationPropertiesScan`) — the `ProfileProperties`/`FlagProperties` precedent (§9).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/quarterly/service/Quarters.java` — the pure calendar helper (`startOf`/`previous`/`endOf`/`label`/`parse`/`isQuarter`), shared by the job, `ProfileAssembler` and `compare_periods`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/quarterly/service/SeasonSuggestion.java` — the model's per-season `{title, summary}` answer shape, deserialized straight off the parsed JSON array.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/quarterly/service/QuarterlyReviewService.java` — `runFor(userId, quarterStart)`: the two spend gates, the season-over-season smart-tier call, and the self-injected-proxy `persistCandidates` transaction (§4 above).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/quarterly/service/QuarterlyReviewJob.java` — the cron: per-user AND per-phase try/catch around `QuarterlyReviewService.runFor` then `ProfileAssembler.rebuild(userId, quarter)` — the just-finished quarter as the trend anchor, and phase 2 skipped entirely when `ObjectProvider<ProfileAssemblerJob>` resolves to nothing (§4 above).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/repository/GraphNodeRepository.java` — `countQuarterlyNodesOnQuarter`, the native per-quarter idempotence probe (the `countExtractorNodesOnDay` idiom one rung up; §4/§9).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/profile/service/ProfileAssembler.java` — `decisionQuality`/`quarterLine`, the `DÖNTÉSI MINŐSÉG` payload section (§4/§9 above).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/MemoryTools.java` — `comparePeriods`, alongside the existing `findSimilarPastDays` (not a new file — the tool joins the existing V2.3 recall bean; §4 above).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java` — the `[Eszköz-útmutató]` routing hint's new `compare_periods` row (§4 above).
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `QUARTERLY_REVIEW_JOB_SWITCH` (`mezo.techcore.cron.quarterly-review-job.enabled`).
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/quarterly/{QuarterlyPropertiesIT,QuarterlyReviewServiceIT,QuarterlyReviewJobIT,QuarterlyReviewJobSwitchOffIT,service/QuartersTest}.java` + extended `profile/service/ProfileAssemblerIT` + extended `tools/MemoryToolsRenderIT` — §8.
- **FE side** (documented in [`insights.md` §2.4/§10](insights.md)): `frontend/src/data/insights/graph.ts` (`CANDIDATE_COPY`, `formatCandidateDate`, the `lifeEventCandidateSeed` SEASON entry) + `frontend/src/features/insights/components/LifeEventCandidateCard.tsx` (kind-aware date/provenance) + `frontend/src/features/insights/pages/KnowledgeListPage.tsx` (per-kind grouping) — no new endpoint, no new FE data hook.

**Backend — daily evaluation (`mezo-jcpt.4`, plan 2/2 — §3/§4/§8)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/DayEvaluationProperties.java` — the 6-dimension engine's config (`mezo.companion.day-evaluation.*`): weights, nutrition bands, `sleepTargetH`, rhythm window, `logTimelyMin`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DayEvaluationEngine.java` — THE day math: `DayInputs -> DayEvaluation`, pure, no repository access, all six dimensions + the renormalization/honesty rules.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DayScoreService.java` — resolves `DayInputs` per day from every owning feature; `rhythmFreeInputs`/`rhythmFreeBases`/`withPriors` (the rhythm-without-recursion mechanism); `toSubscores` (the legacy `DaySubscores` projection); `inputsFor(userId, date[, today])` (the day-evaluation read path's single-day entry point; the 3-arg overload takes the caller's already-resolved `today` so a request crossing midnight cannot see two different clocks).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DayReviewService.java` — assembles `GET /api/me/day/{date}/evaluation`: state, context signals, the lazy hash-cached prose, the clamped AI adjustment.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DayReviewLlm.java` (port) + `llm/DayReviewLlmAdapter.java` (the two-switch-gated adapter, `DAY_REVIEW_SWITCH` + `COMPANION_SWITCH`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/{DayReviewEntity,DayReviewJson}.java` + `repository/DayReviewRepository.java` — the `day_review` cache row + its typed jsonb envelope.
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `DAY_REVIEW_SWITCH` (`mezo.feature.day-review.enabled`).
- `backend/src/main/resources/db/changelog/1.0.0/script/202609031300_mezo-jcpt.4_create_day_review.sql` (the table) + `202609031200_mezo-jcpt.4_weekly_score_cache_invalidation.sql` (the one-off `weekly_score` purge).
- `backend/src/main/resources/db/changelog/1.0.0/script/202609050900_mezo-jcpt.9_feedback_day_review_kind.sql` — `day_review` becomes the seventh W4.1 `message_feedback` artifact kind (CK-swap only, no data migration; §5.7 above); `MessageFeedbackEntity.KIND_DAY_REVIEW` + `DayEvaluationResponse.reviewId` (`DayReviewService`'s `ProseResult`, present only when the day carries actual LLM prose) + `DayReviewCard`'s `useFeedback('day_review', reviewId ? [reviewId] : [])` (mounted, gated on `reviewId` — not on `scored`) are the rest of this slice.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/WeeklyScoreRepository.java` — `latestScoreInputWrittenAt` widened to probe `water_log` (§4 accepted-limitation note on the training schedule tables' exclusion).
- **`config/MeWeekProperties.java` is DELETED** (`mezo-jcpt.7`) — the legacy formula it configured is gone (§3), and a full-repo grep found zero readers: no injection, no field read, no test, no `@Value` (ArchUnit forbids it), no env-var/compose/CI mapping. The record and its `mezo.companion.me-week` block in `application.yml` were removed **together**: the record's components are primitives with no defaults, so the two are a matched pair and a yml-only removal would fail validation in every Spring context. The `me-week` **contract** (the `api/feature/me-week` fragment, the OpenAPI tag, `MeWeekController`/`MeWeekService`, the `MeWeekSubscores` wire shape) is untouched — only the config prefix retired. The `sleep-target-h: 8.0` it carried has no successor: the day evaluation's only sleep target is `DayEvaluationProperties.sleepTargetH` (`7.5`), and `kcal-band`/`xp-baseline` had no reader left at all.
- Tests: `feature/companion/service/{DayEvaluationEngineTest,DayScoreServiceIT,DayReviewServiceTest}.java`, `feature/companion/config/DayEvaluationPropertiesTest.java`, `feature/companion/controller/{DayEvaluationApiIT,DayEvaluationSwitchOffApiIT}.java`, `feature/companion/DayReviewRepositoryIT.java`, `support/populator/DayReviewPopulator.java` — §8.
- **FE side** — `frontend/src/data/me/{dayEvaluation.ts,dayEvaluationApi.ts,dayEvaluationHooks.ts}` (dual-mode read + 4 named mock fixtures) + `frontend/src/features/me/pages/WeekDayPage.tsx` + `frontend/src/features/me/components/week/{DayDimensionTile,DayReviewCard}.tsx` + `frontend/src/features/me/logic/weekDay.ts` (`DAY_DIMENSIONS`/`doneDimensionCount`) — documented in [me.md](me.md) (the day page section).

**Backend — weekly review data layer + anchored conversations (`mezo-p2tr` — §3/§4/§8)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MeWeekService.java` + `controller/MeWeekController.java` — `GET /api/me/week/{start}` and the shared `renderDayLine` formatter.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/WeekContextRenderer.java` — the `[Heti adatok]` anchored-conversation prompt block.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/WeekReviewSource.java` — the port `feature/proactive`'s `WeekReviewSourceAdapter` implements (keeps the dependency proactive → companion, never the reverse).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ConversationService.java` — `create` reads `CreateConversationRequest.context`, persists `contextKind`/`contextDate`, and (when a context was given) calls `chatService.getObject().openingTurn(userId, saved.getId())`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java` — `KICKOFF_PROMPT` + `openingTurn` (the server-generated, assistant-only first turn) + the widened `assembleSystemPrompt` signature above.
- `backend/src/main/resources/db/changelog/1.0.0/script/202608271800_mezo-p2tr_ai_conversation_context.sql` — `ai_conversation.context_kind`/`.context_date` (nullable additive columns).
- `backend/src/main/resources/db/changelog/1.0.0/script/202608271500_mezo-p2tr_feedback_weekly_review_kind.sql` — `weekly_review` becomes the sixth W4.1 `message_feedback` artifact kind (CK-swap only; §5.7 above), live since this slice even though it went undocumented here until `mezo-jcpt.9`.
- `api/feature/me-week/me-week.yml` (new fragment) + `api/feature/companion/companion.yml` (`CreateConversationRequest.context`).
- Tests: `feature/companion/service/DayScoreServiceIT.java`, `feature/companion/controller/MeWeekControllerIT.java`, `AnchoredConversationIT`.
- **Owned by `feature/proactive`, not restated here** (the generated weekly-review NARRATIVE + its Monday cron/push/feedback): `feature/proactive/{entity/WeeklyReviewEntity,service/WeeklyReviewGenerator,service/WeeklyReviewJob,service/WeeklyReviewService,service/WeeklyReviewDigestService,service/WeekReviewSourceAdapter}.java` — see [`proactive.md` §10](proactive.md).
- **FE side** — `frontend/src/features/me/pages/{WeekHubPage,WeekAnalysisPage,WeekDaysPage,WeekLessonsPage,WeekDiscoveriesPage}.tsx` (the hub + 4 view-pages, `mezo-d20.6.10` split — `WeekPage.tsx` no longer exists) + `frontend/src/features/me/components/week/WeekDayTile.tsx` (per-day tile — `WeekDayCard` is deleted) + `frontend/src/features/me/components/{WeekDiscoveries,WeekNextCard,WeekReviewCard}.tsx` + `frontend/src/features/me/logic/useChatHandoff.ts` + `frontend/src/data/me/{meWeek*,weeklyReview*}.ts`, documented in [`me.md`](me.md) `Heti` §2/§4/§10.

**Backend — knowledge graph (W2.1, `mezo-b3pp.6` — §4.2/§6.1)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/entity/{GraphNodeEntity,GraphEdgeEntity}.java` — `extends OwnedEntity`; `meta`/`evidence` typed jsonb columns (§4 above).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphService.java` — `upsertNode`/`upsertEdge` are the ONLY write paths later slices use; `archive` flips `status` only.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/controller/GraphController.java` — `implements KnowledgeGraphApi`, `KNOWLEDGE_GRAPH_SWITCH`-gated, ownership from `CurrentUserId`.

**Backend — controllers / services / mapper**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/CompanionController.java` — `implements CompanionApi`, JWT ownership, switch-gated.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/CompanionStreamController.java` — the V0.4 **hand-written** SSE endpoint (§9 Decision 11).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/CompanionVoiceController.java` + `service/TranscriptionService.java` — **`mezo-at8x.4`** the stateless voice-note → transcript surface (`implements CompanionVoiceApi`, switch-gated; size/mime validation + the transcription system prompt).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ConversationService.java` — list/create/listMessages/`getOwned` (404).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java` — `SYSTEM_PROMPT` (named blocks, mezo-q71s) + `TONE_REMINDER` + the sync turn + the V0.4 `prepareTurn`/`completeTurn` halves; `toTurns`/`loadWindow` produce the `List<Turn> history` that now travels SEPARATELY from the prompt. **`mezo-b3pp.12`** folded the snapshot/facts/pattern-ack/`[Emlékek]`/tone assembly into ONE private `assembleSystemPrompt(userId, today, memoriesBlock, graphBlock, contextKind, contextDate)` (the last two params added by `mezo-p2tr` for the `[Heti adatok]` anchored block, both `null` for a plain conversation) that both paths call — it had been two byte-identical copies, one per path, and a third block would have made the drift inevitable; the helper also pins ONE `LocalDate.now()` per turn, shared by the snapshot and the recall. `PreparedTurn` gained `recalledRefs`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/ChatHistory.java` — **mezo-q71s** the `List<Turn>` → "Daniel: … / Mezo: …" text renderer, the sole source for the three non-model consumers (advisor judge payload, fake LLM echo, `llm_log_history.conversation_history`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatStreamService.java` — the V0.4 streamed turn (`delta`/`tool`/`done`/`error` Flux over the port; the `tool` sink since mezo-280).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ContextSnapshotAssembler.java` — the V0.3 cross-feature "today" block (8 HU blocks, `nincs adat` absences).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PromptMemoryAssembler.java` — **`mezo-b3pp.12`** W3.1 ambient recall: embed-once → five kind-group ANN queries (W3.2 added the rungs) → per-group floor/decay/cap (**per group since W3.3, `mezo-b3pp.14`**) → `(kind, ref_id)` dedupe → the `MEMORIES_HEADER` (`[Emlékek]`) render under the token cap, plus the `Memory`/date refs. **Never throws** — any `RuntimeException` becomes a `log.warn` + `AmbientRecall.EMPTY`, so the block is optional and the turn is not (IDENT-3). Not `@Transactional` (the ANN carries its own savepoint, §9).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/TodayQuestSource.java` — the companion-owned port for `[Napi gyakorlat]`'s quest count, implemented by `feature/quest/service/TodayQuestAdapter.java` (keeps the quest↔companion dependency one-directional; the `progression.QuestLedgerSource` precedent).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/KnowledgeFactService.java` — V1.1 fact CRUD + `renderPromptBlock` (top-N injection, `FACTS_HEADER`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/FactExtractionService.java` — V1.2 post-turn extraction (`EXTRACTION_MARKER`, parse/dedupe/cap).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/{ChatTurnCompleted,FactExtractionListener}.java` — the V1.2 AFTER_COMMIT async trigger.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/FactCandidateService.java` — V1.2 pending inbox + accept/refine/reject decision.
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/AsyncConfiguration.java` — `@EnableAsync` (born with V1.2).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/mapper/CompanionMapper.java` — entity → generated `api.dto` (null envelope → `[]`; + `toKnowledgeFactResponse`; + `degraded` since V1.3; + `toPatternEventResponse` since S1 close `mezo-tk88.3`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternPairDetailService.java` — **S1 close (`mezo-tk88.3`)** the pattern detail page's read; reuses `PatternMonitorService.toPair` (package-widened) + delegates the impact block to `PatternImpactSource`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/{MetricKey,MetricValueKind,PatternGate,PatternMonitorService,PatternDetectionService}.java` — the shared pattern math and metadata spine: value-kind-aware metric catalog, total/group/degeneracy gate, read-only monitor mapping and LIVE-only nightly persistence (`mezo-0469`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternImpactSource.java` — the companion-owned inversion port `PatternPairDetailService` depends on; implemented in `feature.proactive.service.PatternImpactService` (see [`proactive.md`](proactive.md) §10) — keeps the companion↔proactive dependency graph cycle-free in the NEW direction, mirroring `TodayQuestSource`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MemoryObservatoryService.java` — **`mezo-al1i`** the memory-observatory read-only aggregate: `overview`/`summaries`/`similarDays`/`llmUsage`, companion-switch conditional.

**Backend — meso end-of-run AI review (`mezo-meyc.3`, S3 — §5.6)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MesoContextAssembler.java` — the closed run's lifestyle context bucketed per meso-week (9 `MetricSeriesService` series + batched kcal targets via `FuelDayService.getWeek` + session row counts), emitted as the train-owned `MesoContextJson`; honest-absence rules (null averages/sums, real 0 row-counts) live here.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MesoReviewGenerator.java` — the one-shot SMART-tier generator (`MESO_REVIEW_MARKER`): context-first persistence, `MesoReviewGate` via `ObjectProvider`, pending-only idempotency, every failure swallowed into a persisted `failed`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MesoReviewListener.java` — the `@Async @TransactionalEventListener(AFTER_COMMIT)` trigger on train's `MesocycleClosed` (the `FactExtractionListener` idiom, companion-switch-gated only).

**Backend — advisor chain (V1.3)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/advisor/CompanionAdvisorChain.java` — the §4.5 retry/degrade orchestrator (`complete` sync / `review` streamed).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/advisor/ClinicalOutputCheck.java` — deterministic Rx dose-change regex (accent-folded, sentence-scoped).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/advisor/TurnVerdictCheck.java` — the combined LLM verdict (`VERDICT_MARKER`, fail-open parse; `unmarkedClaim` since mezo-q71s — [ADR 0028](../decisions/0028-marked-speculation-in-chat.md) — renders `history` via `ChatHistory.render` into its own payload).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/advisor/{AdvisorRetry,AdvisorViolation,AdvisedAnswer}.java` — retry block (mezo-q71s: gained a closing tone-preservation sentence) + value records (`AdvisorViolation.check` ∈ `clinical|redundancy|unmarked`, was `grounding`).

**Backend — LLM port (ADR 0008)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/CompanionLlm.java` — the port. **Since mezo-q71s** `complete`/`stream(system, List<Turn> history, user, tools, toolContext)` are the ABSTRACT 5-arg forms; the old tools-carrying 2-string shape is now a `default` delegating with `List.of()` (the port's second inversion — V0.5's Decision 16 is the first); the mezo-78rn multimodal `complete(…, imageBytes, mimeType)` overload is unchanged.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlm.java` — real adapter (`!companion-fake`); `.messages(toMessages(history))` between `.system(...)` and `.user(...)` (mezo-q71s) + `tools(Object...)` + `toolContext` registration; the Spring AI `Media` image part (mezo-78rn); **records every call path** via `.call().chatResponse()` + `LlmCallRecorder` (mezo-2zyu), including the new `conversationHistory` field on `CallSpec`/`LlmCallRecord` for the `CHAT`/`TOOL`/`CHAT_STREAM` kinds.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` — deterministic fake (`companion-fake`); `[fake-tool:…]` sentinel execution since V0.5; the greedy `[fake-meal:{json}]` sentinel (matched in user text + UTF-8 image bytes, mezo-78rn); the greedy `[fake-recipe-fit:{json}]` sentinel (planted in a recipe name, mezo-bw3y); the `MESO_REVIEW` branch (mezo-meyc.3) answering the canned `MESO_REVIEW_ANSWER` unless `[fake-meso-review:…]` is planted in the run TITLE, or `[fake-meso-review-echo]` which returns the **assembled user payload verbatim** (the only way to assert what the generator actually sent — the fake stays stateless, no prompt recorder) — failure injection rides the shared `[fake-fail]`. Unlike the `feature.proactive`/`feature.activity` markers this one is IMPORTED (`MesoReviewGenerator.MESO_REVIEW_MARKER`), not mirrored as a literal: the generator is in the SAME `companion` slice, so no new package cycle is possible. The plan-generator's `MesoPlanLlmAdapter` (`MARKER = "[meso-plan]"`) branch dispatches on the greedy `MESO_PLAN_SENTINEL` — `[fake-meso-plan:{json}]` planted in the request's `goalText` — with a default `{"rationale":"FAKE-INDOK","days":[]}` (a valid but empty-days answer — the un-scripted happy path still reaches the LLM branch and `MesoPlanMerger` runs, but an empty suggestion accepts no pick, so `MesoPlanGeneratorService` reports `llmUsed = false` and keeps the deterministic rationale, the same as no answer at all); failure injection rides the same shared `[fake-fail]`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/MealDraftLlmAdapter.java` — companion-side adapter for the meal-owned `MealDraftLlm` port (ADR 0012, mezo-78rn); `@ConditionalOnProperty(COMPANION_SWITCH)`, delegates both overloads to `CompanionLlm`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/SleepShotLlmAdapter.java` — companion-side adapter for the sleep-owned `SleepShotLlm` vision port (ADR 0012, mezo-66ab); `@ConditionalOnProperty(COMPANION_SWITCH)`, delegates to `CompanionLlm.complete` with one `InlineImage`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/CompanionHelloRunner.java` — `companion-smoke` real-API round-trip proof.

**Backend — LLM call audit log (mezo-2zyu, [ADR 0014](../decisions/0014-llm-call-audit-log.md))**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/GeminiUsageExtractor.java` — the ONE place Gemini's response metadata is read (served model, service tier, prompt/candidates/thoughts/cached tokens); absent usage → null, never 0.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/{GeminiRoundUsage,GeminiRoundUsageAdvisor}.java` — the per-round usage capture (`mezo-58ig`): a per-call tally rides the ChatClient request context to a CallAdvisor/StreamAdvisor ordered between ToolCallingAdvisor's loop and the model, which sums each round's own native usage; the adapter prefers the tally over the final-response read and derives `tool_rounds` from it.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/GeminiEmbeddingAdapter.java` — records the embedding calls (character-based `EmbedUsage`, `billableCharacterCount`) around its `EmbedContentResponse`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/{LlmCallRecorder,EventPublishingLlmCallRecorder,NoOpLlmCallRecorder}.java` — the seam the adapters call; switch on ⇒ publish, off ⇒ no-op.
- `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/{LlmCallRecord,TokenUsage,EmbedUsage,LlmActorResolver}.java` — what the adapter observed + who called (null on cron threads).
- `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmLogWriter.java` — `@Async @EventListener` → `REQUIRES_NEW` insert: field mapping, payload capping, net-prompt cost derivation.
- `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmPricingService.java` — freezes the day's unit prices onto the row and computes `cost_usd` from THAT snapshot (unknown model ⇒ null).
- `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/context/{LlmCallContext,LlmCallContextHolder}.java` — the thread-scoped caller tag (`runWith`); 32 call sites in 29 classes (`grep -rn "new LlmCallContext(" backend/src/main/java | grep -v LlmCallContext.java`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/entity/{LlmLogEntity,CallKind,CallStatus,PricingSnapshot}.java` — the INSERT-only entity (no `OwnedEntity`, no `is_deleted`) + the jsonb price snapshot; `LlmLogEntity.conversationHistory` (nullable text) since mezo-q71s.
- `backend/src/main/resources/db/changelog/1.0.0/script/202608161200_mezo-q71s_llm_log_conversation_history.sql` — the `conversation_history` column (nullable, no backfill needed — every existing row predates the chat's multi-turn port).
- `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/{event/LlmCallEvent,repository/LlmLogRepository}.java` — **`mezo-al1i`** `LlmLogRepository` grew `aggregatePerDaySince` (native daily rollup, report-zone calendar days) alongside the existing `aggregateSince`; new `repository/LlmDailyAggregate.java` projection (day/calls/inputTokens/outputTokens/costUsd).
- `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmUsageService.java` — **`mezo-al1i`** grew `perDay(days)` (a sibling of the existing `summary()` day/week/month rollup) + exposed `auditEnabled()` publicly for `MemoryObservatoryService`'s `enabled` short-circuit.
- `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/config/{LlmLogAsyncConfig,LlmLogProperties,LlmPricingProperties,ModelPrice}.java` — the isolated `llmLogExecutor` (`defaultCandidate = false`, `DiscardPolicy`) + `mezo.llm-log.*` binding, incl. `LlmLogProperties.Retention` (`payloadDays`/`cron`, `mezo-1y3p`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmLogRetentionJob.java` — **`mezo-1y3p`** the nightly scrub (`@Scheduled(cron = "${mezo.llm-log.retention.cron}")`, switch `mezo.techcore.cron.llm-log-retention-job.enabled`, deliberately independent of `mezo.feature.llm-log.enabled`): calls `LlmLogRepository.scrubPayloadsOlderThan` once per run.
- `backend/src/main/resources/db/changelog/1.0.0/script/202608181100_mezo-1y3p_llm_log_payload_scrubbed_at.sql` — the `payload_scrubbed_at` column backing the scrub.
- `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/controller/LlmUsageController.java` + `service/LlmUsageService.java` — the read side (`mezo-uakh`): `implements LlmUsageApi` (ungated, no `CurrentUserId`); `summary`/`breakdown`/`listCalls`/`call`, all `@Transactional(readOnly = true)` so the period aggregates share one DB snapshot.
- `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/UsagePeriod.java` — the DAY/WEEK/MONTH calendar-period enum (`startDate(zone)` + a hand-written `parse` that 400s on an unknown value — defense in depth behind the contract's `pattern`; `GlobalExceptionHandler` gained a `MethodArgumentTypeMismatchException` handler in `mezo-x0nb`, so a conversion failure is a 400 either way).
- `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/mapper/LlmLogMapper.java` — `LlmLogEntity → LlmCallDetailResponse` (hand-written default methods: the jsonb `PricingSnapshot`, `BigDecimal→Double` null-preserving cost, `Instant→OffsetDateTime`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/repository/{LlmStatusRow,LlmGroupRow,LlmCallRow,LlmUsageAggregate}.java` — the JPQL constructor-expression projections behind `aggregateByStatusSince`/`aggregateByFeatureSince`/`aggregateByModelSince`/`findCalls`/`aggregateSince` (`LlmLogRepository`); `findCalls` fetches `limit + 1` rows so the service can derive `hasMore` without a second `count(*)`.
- `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/**` (incl. the read-side `controller/{LlmUsageBreakdownIT,LlmCallListIT,LlmCallDetailIT}.java`, `mezo-uakh`; `service/LlmLogWriterIT.java` — the writer/DB round-trip, incl. `conversation_history` capping/truncation/null-on-non-chat since mezo-q71s) + `feature/companion/llm/{GeminiUsageExtractorTest,GeminiCompanionLlmRecordingTest,GeminiCompanionLlmPromptOrderTest,GeminiEmbeddingAdapterRecordingTest}.java` — writer/pricing/recorder/tagging/repository coverage + both adapters' recording paths (incl. `conversationHistory` on the audit record, mezo-q71s) + the outgoing Spring AI message ORDER (`GeminiCompanionLlmPromptOrderTest`, mezo-q71s — no IT can cover this, see §3) + the breakdown/list/detail endpoint ITs.

**Backend — tools (V0.5, expanded to 15 tools at mezo-xixu)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/CompanionToolRegistry.java` — the ONLY assembly point (wraps + tool-context).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/{TrainTools,BiometricsTools,FuelTools,GoalTools,MedicationTools,MemoryTools}.java` — the 12 `@Tool` reads from the V0.5–V2.3 batch.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/{GrowthTools,PracticeTools,InsightsTools}.java` — the mezo-xixu trio of new beans (`get_growth`/`get_daily_practice`/`get_insights`), bringing the total to 15 `@Tool` reads.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/{ToolCallAudit,RecordingToolCallback,ToolContexts,ToolText}.java` — audit/budget/context/render spine; `ToolCallAudit.onCall` is the mezo-280 live-progress listener seam.
- New plain finders in the owning features: `SleepLogRepository` (since-date), `WorkoutSessionRepository.findDoneInstancesBetween`, `SupplementIntakeRepository` (since-date); shared `GoalPrescriptionJson.currentSegment`.
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/eval/ToolSelectionEvalIT.java` — the mezo-xixu measurement phase (`@Tag("eval")`, opt-in, real `GeminiCompanionLlm`, 40-case Hungarian question set, baseline 37/40 = 92.5%).
- `docs/references/companion_tool_conventions.md` — the mezo-xixu `@Tool` description house rule (the `[Eszköz-útmutató]` routing hint's model-facing mirror).

**Backend — journal embedding seam (`mezo-b3pp.1`, Phase 5 W1.1, post-epic — full detail in [`journal.md`](journal.md))**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/JournalEmbeddingListener.java` — the AFTER_COMMIT/`@Async` trigger on `feature/journal`'s two events, gated on `COMPANION_SWITCH` + `JournalService`'s own switch (`FeaturesConfiguration.JOURNAL_SWITCH`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java` — `writeJournal` / `deleteJournalEmbedding`. Since `mezo-b3pp.2` `writeJournal` is a one-liner over the shared private `upsert(...)` (the update-in-place re-embed — `uq_memory_embedding_kind_ref_id` spans soft-deleted rows, so a delete+insert would collide).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/MemoryEmbeddingEntity.java:44-58` — `KIND_JOURNAL_ENTRY` + the 10-kind `@Pattern` (§4 above).
- Tests: journal cases folded into `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriterIT.java` (`testWriteJournal_*`/`testDeleteJournalEmbedding_*`) + `backend/src/test/java/io/mrkuhne/mezo/feature/journal/JournalEmbeddingEventIT.java` (the end-to-end AFTER_COMMIT round trip) — full test map in [`journal.md`](journal.md) §8.

**Backend — decision embedding seam (`mezo-b3pp.4`, Phase 5 W1.4, post-epic — full detail in [`journal.md`](journal.md))**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/DecisionEmbeddingListener.java` — the AFTER_COMMIT/`@Async` trigger on `feature/journal`'s `DecisionEntrySavedEvent` (fired on both create and review), gated on `COMPANION_SWITCH` + `JOURNAL_SWITCH`; retries once on the create-then-fast-review insert race, no delete-race handling (decisions aren't deletable).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java` — `writeDecision`: embeds `decisionText` on create, re-embeds the SAME `(kind=decision, ref_id)` row in place on review with the outcome folded into the content (`"…\n\nKimenet (N/5): …"`) — since `mezo-b3pp.2` also through the shared `upsert(...)`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/MemoryEmbeddingEntity.java:44-58` — `KIND_DECISION` (the 10-kind `@Pattern`, §4 above, unchanged — `'decision'` was already permitted).
- Tests: decision cases folded into `MemoryEmbeddingWriterIT` (`testWriteDecision_*`) + `backend/src/test/java/io/mrkuhne/mezo/feature/journal/DecisionEmbeddingEventIT.java` (the end-to-end AFTER_COMMIT round trip, both create and review) — full test map in [`journal.md`](journal.md) §8.

**Backend — reflection embedding seam (`mezo-b3pp.2`, Phase 5 W1.2 — full detail in [`ritual.md`](ritual.md))**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/ReflectionEmbeddingListener.java` — the AFTER_COMMIT/`@Async` trigger on `feature/ritual`'s `RitualClosedEvent`, gated on `COMPANION_SWITCH` + **`FeaturesConfiguration.RITUAL_SWITCH`** (not the journal switch); re-reads the `ritual_day` row by id, no insert-race retry (there is no per-keystroke write path to race with — §5 above).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java` — `writeReflection` (blank/cleared prose ⇒ soft-delete the vector; otherwise the shared `upsert(...)`) + the private `upsert(...)` itself, extracted in this slice out of the three duplicated re-embed blocks.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/MemoryEmbeddingEntity.java` — `KIND_REFLECTION` (the 10-kind `@Pattern` unchanged — `'reflection'` was already permitted, so W1.2 ships no companion-side migration).
- Tests: `backend/src/test/java/io/mrkuhne/mezo/feature/ritual/RitualReflectionEmbeddingIT.java` (the end-to-end vector: embed on close, none when skipped, none before the close, in-place re-embed on a post-close edit, soft-delete on a clear) + `RitualReflectionEventIT` (the publication contract) + `RitualApiCompanionOffIT` (companion off ⇒ close succeeds, no embeddings) — full test map in [`ritual.md`](ritual.md) §8.

**Backend — entities / repos / config**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/{AiConversationEntity,AiMessageEntity,ToolCallsEnvelope,RefsEnvelope,KnowledgeFactEntity,LearnedFactEntity}.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/RecalledMemoriesEnvelope.java` — **`mezo-b3pp.28`** the W3.1b disclosure envelope on `ai_message.recalled_memories`: `{items:[{kind, refId, occurredOn, label, gist, similarity}]}` in prompt order, with `ofOrNull(items)` so "recalled nothing" is a **null column**, not an empty envelope (the `RefsEnvelope` precedent). `refId` is persisted but never mapped onto the wire.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/{AiConversationRepository,AiMessageRepository,KnowledgeFactRepository,LearnedFactRepository}.java` — **`mezo-al1i`** added finders for the observatory: `LearnedFactRepository.countByCreatedByAndUserDecisionIsNullAndDeletedFalse` (the L2 pending count).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/DailySummaryRepository.java` — **`mezo-al1i`** added `countByCreatedBy`, `findTop1ByCreatedByOrderBySummaryDateAsc/Desc` (L1 first/last date), `findByCreatedByAndSummaryDateBetweenOrderBySummaryDateDesc` (the journal query).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/MemoryEmbeddingRepository.java` — **`mezo-al1i`** added `countByCreatedByAndKind` (L1 embedding counts) + `findRefIdsByCreatedByAndKind` (the memory-observatory L1 journal's `embedded` flag lookup — the daily-summary journal, not `feature/journal`); **`mezo-b3pp.1`** added `findByKindAndRefId` (the journal embed pipeline's update-in-place lookup, above); **`mezo-b3pp.2`** added `findByKindAndRefIdIncludingDeleted` (native — `@SQLRestriction` applies to JPQL too — the revive lookup `upsert` now reads through).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/MemoryEmbeddingAnnQuery.java` — **`mezo-b3pp.12`** the W3.1 kind-set ANN search, deliberately OUTSIDE Hibernate: a `NamedParameterJdbcTemplate` query on the CALLER's connection under a hand-taken JDBC savepoint, so a failed statement never poisons the turn's transaction (§9 — not a `@Query` finder, and `PROPAGATION_NESTED` does not work on Hibernate). Returns `Hit(id, kind, refId, content, occurredOn, distance)`; `kinds` must be non-empty. The statement is COMPOSED, not picked from a menu: `SQL_HEAD` + the optional `SQL_NOT_BEFORE` (W3.2 coverage floor) + the optional `SQL_EXCLUDE_CONVERSATION` (**W3.3 / `mezo-b3pp.27`** — `ref_id not in (select m.id from ai_message m where m.conversation_id = :excludeConversationId)`, applied only to the chat_turn group) + `SQL_TAIL`; a `null` argument simply leaves its fragment out, because an `(:param is null or …)` predicate would be an untyped-parameter cast headache and a muddier plan.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java` — `Llm` + `Chat` + `Snapshot` + `Tools` + `Facts` + `Extraction` + `Advisors` records; **`mezo-b3pp.12`** added the nested `AmbientRecall` record on `mezo.companion.ambient-recall.*`; **`mezo-b3pp.14`** (W3.3) reshaped it to `(enabled, weeklyShadowDays, maxTokens, excludeCurrentConversation, dailySummary, periodSummary, journal, chatTurn, other)` where each of the five groups is a `@NotNull @Valid Group(cap @Min(0) @Max(10), minSimilarity 0..1, decayDays @Min(1) @Max(3650))` — the flat `cap-*` keys and the single `minSimilarity` are gone, and ambient recall no longer borrows `Recall.decayDays`. **`mezo-b3pp.1`** landed a `Journal` record here (`decisionReviewDays`, unused by that slice, ahead of W1.4's need); **ADR 0029** (W1.4 branch review) moved it out to `feature/journal/config/JournalProperties.java` — a journal-owned `@ConfigurationProperties` record on the SAME `mezo.companion.journal.*` prefix — to break the cycle a direct `journal → companion` import for the config record would otherwise have closed.
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/config/JournalProperties.java` — `decisionReviewDays` (ADR 0029; see above).
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/service/DecisionContextPort.java` — the journal-owned port for the reverse (companion→journal) context-snapshot read (ADR 0029).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DecisionContextAssemblerAdapter.java` — the companion-side adapter implementing `DecisionContextPort` (ADR 0029), gated `COMPANION_SWITCH`.
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `COMPANION_SWITCH` + extraction/advisors sub-switches.
- `backend/src/main/resources/application.yml` — `mezo.feature.companion.enabled` + `mezo.companion.llm.*`/`chat.*` + `spring.ai.google.genai.api-key`.

**Backend — migration**
- `backend/src/main/resources/db/changelog/1.0.0/script/202607031400_mezo-fnnq.2_create_ai_conversation_message.sql` (in `1.0.0_master.yml`).
- `backend/src/main/resources/db/changelog/1.0.0/script/202607031707_mezo-fnnq.6_create_knowledge_learned_fact.sql` (in `1.0.0_master.yml`).
- `backend/src/main/resources/db/changelog/1.0.0/script/202607031812_mezo-fnnq.7_learned_fact_category.sql` (in `1.0.0_master.yml`).
- `backend/src/main/resources/db/changelog/1.0.0/script/202607031900_mezo-fnnq.8_ai_message_degraded.sql` (in `1.0.0_master.yml`).
- `backend/src/main/resources/db/changelog/1.0.0/script/202608221700_mezo-b3pp.28_ai_message_recalled_memories.sql` (in `1.0.0_master.yml`) — W3.1b `alter table ai_message add column recalled_memories jsonb`; additive, nullable, no backfill.
- `backend/src/main/resources/db/changelog/1.0.0/script/202607281200_mezo-2zyu_create_llm_log_history.sql` (in `1.0.0_master.yml`) — the append-only audit table (no `is_deleted`).
- `backend/src/main/resources/db/changelog/1.0.0/script/202608181610_mezo-b3pp.1_expand_memory_embedding_kinds.sql` (in `1.0.0_master.yml`) — the `memory_embedding` kind-CHECK widening to 10 (§4 above); the sibling `journal_entry`-table migration lives with `feature/journal`, see [`journal.md`](journal.md) §10.

**Backend — tests**
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/{AiMessageJsonbRoundTripIT,ConversationServiceIT,ChatServiceIT,ChatStreamServiceIT,CompanionApiIT,CompanionStreamApiIT,CompanionApiSwitchOffIT,CompanionLlmFakeIT,CompanionRealWiringIT,CompanionSwitchOffIT,CompanionPropertiesIT}.java`
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ContextSnapshotAssemblerIT.java` (V0.3, 24 tests) — incl. the mezo-xixu tomorrow-resolution regression guard (§3 above).
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/{CompanionToolsRenderIT,CompanionToolRegistryIT,ToolCallAuditTest,RecordingToolCallbackTest}.java` — the V0.5–mezo-xixu tool batch (77 render tests over 15 tools).
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/eval/ToolSelectionEvalIT.java` — the mezo-xixu measurement phase (`@Tag("eval")`, opt-in, 40-case set, baseline 37/40).
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/{KnowledgeFactServiceIT,LearnedFactPersistenceIT,CompanionFactApiIT}.java` — the V1.1 fact batch.
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/{FactExtractionServiceIT,FactCandidateServiceIT,CompanionFactCandidateApiIT,ChatExtractionFlowIT,ChatExtractionSwitchOffIT}.java` — the V1.2 extraction/decision batch.
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/{CompanionAdvisorChainIT,ChatStreamAdvisorIT,CompanionAdvisorsSwitchOffIT}.java` + `advisor/{ClinicalOutputCheckTest,TurnVerdictCheckIT}.java` — the V1.3 advisor batch.
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/MesoReviewGeneratorIT.java` — the `mezo-meyc.3` §5.6 batch (7 tests, `companion-fake`, deliberately NOT `@Transactional`): per-week/totals context numbers incl. the honest-absence nulls of a data-less W2 **plus the contract round-trip through `getReport`**, the metric **legend** asserted on the real prompt via the `[fake-meso-review-echo]` channel (content + ordering before the JSON), `markReady`'s **fresh-row** write (a concurrent `selfEval` survives), the title-planted sentinel proving the assembled payload reached the port, pending-only idempotency (a `ready` row's narrative AND null context both survive), `[fake-fail]` → `failed` **with the context still persisted**, and the real `closeMesocycle` → AFTER_COMMIT → `@Async` path awaited with Awaitility. The switch-off half lives in `feature/train/MesoReviewSwitchOffIT.java` (own `@TestPropertySource` context: `aiEvalEnabled` false + context written/status left `pending`, and it now **awaits** the listener's write so the async thread cannot collide with the next class's `ResetDatabase` TRUNCATE). Note `feature/train/MesocycleCloseReportIT.java` runs with `mezo.feature.companion.enabled=false` so the deterministic close report is asserted without this listener racing it from another thread; its regenerate test also pins that `computeAndStore` clears `context`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/{entity/PeriodSummaryEntity,repository/PeriodSummaryRepository,service/PeriodSummaryService,service/ConsolidationJob}.java` + `backend/src/main/resources/db/changelog/1.0.0/script/202608231400_mezo-b3pp.13_create_period_summary.sql` — the `mezo-b3pp.13` W3.2 consolidation ladder (§4): the two rungs, their generator, their cron and the table.
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/{PeriodSummaryPersistenceIT,PeriodSummaryServiceIT,ConsolidationJobIT,ConsolidationJobSwitchOffIT,ConsolidationPropertiesIT,PromptMemoryAssemblerShadowIT}.java` + `backend/src/test/java/io/mrkuhne/mezo/support/populator/PeriodSummaryPopulator.java` — the W3.2 test batch (§8), incl. the shadowing proof that the fine-grained row survives.
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/PromptMemoryAssemblerTest.java` + `backend/src/test/java/io/mrkuhne/mezo/feature/companion/{PromptMemoryAssemblerIT,PromptMemoryAssemblerSwitchOffIT,MemoryEmbeddingAnnQueryIT,ChatServiceAmbientRecallIT}.java` — the `mezo-b3pp.12` W3.1 batch (§8): pure render/cap unit tests, the `@Transactional` assembler ITs (caps, the floor pinned between 0.25 and the journal group's floor — 0.60 since W3.3, today-skip, decay order, `FAIL_EMBED`/`FAIL_ANN`), and the two deliberately NON-`@Transactional` classes that need a real commit (the savepoint proof; the block position + `Memory` refs on wire and row + tool-refs-first ordering). `FakeEmbeddingAdapter` gained the `FAIL_EMBED`/`FAIL_ANN` sentinels these drive.
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/{AmbientRecallEvalIT,AmbientRecallTuningIT}.java` — the `mezo-b3pp.14` W3.3 eval layer (§8): the parameterized (query → expected gists in order) TABLE over a fixed 20-row hand-crafted vector corpus — the regression net for every `ambient-recall.<group>.*` change, with a javadoc that states what it does and does NOT pin — and the `@TestPropertySource` twin proving a yml-only override re-ranks and drops items with no code change.
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/{CompanionMemoryOverviewApiIT,CompanionMemorySummaryApiIT,CompanionMemorySimilarDaysApiIT,CompanionMemoryLlmUsageApiIT,CompanionMemoryLlmUsageDisabledIT,CompanionMemorySwitchOffIT}.java` — the `mezo-al1i` memory-observatory batch: populated + empty overview, range-filtered summaries, the deterministic fake-embedding similar-days path, the LLM-usage rollup + its `enabled:false` disabled-audit branch, and the switch-off 404 across all 4 endpoints; `CompanionApiSwitchOffIT` extended to assert the memory/overview route (one of the four), with `CompanionMemorySwitchOffIT` proving bean absence covers all four.
- `backend/src/test/java/io/mrkuhne/mezo/support/populator/{AiConversationPopulator,AiMessagePopulator,KnowledgeFactPopulator,LearnedFactPopulator}.java` + `support/ResetDatabase.java` (companion tables in the TRUNCATE list).
- `backend/src/test/java/io/mrkuhne/mezo/ArchitectureTest.java` — the two documented V0.4 allowlist entries (hand-written controller + fake-LLM raw exception) + the V0.5 `companion_tools_are_internal_sphere_only` rule.

**Frontend (chat real since V0.4, knowledge since V1.2)**
- `frontend/src/data/_client/api.ts` — `apiSse` (fetch-ReadableStream SSE reader) + its `api.sse.test.ts`.
- `frontend/src/data/insights/chatApi.ts` — REST + stream client, `toChatMessage` wire mapper (+ `degraded` since V1.3; **`mezo-b3pp.28`** maps `recalled`, `[]` → `undefined` so a recall-less answer renders no disclosure at all).
- `frontend/src/features/insights/components/ChatMessage.tsx` — the bubble (chips, refs, V1.3 `nem ellenőrzött` badge; **`mezo-b3pp.28`** mounts `RecalledMemoriesRow` under the card, above the W4.1 feedback chips; **`mezo-b3pp.29`** filters `Memory` refs out of the chip row when the ref's day is present in `recalled`, and gates the footer on the filtered length — see §2 above).
- `frontend/src/features/insights/components/RecalledMemoriesRow.tsx` — **`mezo-b3pp.28`** the W3.1b „Emlékek · N" disclosure: a collapsed `aria-expanded` button (the answer is the point; this is its provenance) that opens to one `YYYY-MM-DD · forrás · NN%` line + gist per recalled memory, in prompt order. `similarity` is rendered `Math.round(s*100)%` — the raw cosine, not the decayed rank score.
- `frontend/src/data/insights/chatHooks.ts` — `useChat` (bootstrap dual-read) + `useChatActions` (send/stream state machine); re-exported from `data/hooks.ts`.
- `frontend/src/data/insights/chat.ts` — the mock seed (`initialChat`) + the shared `cannedReply`.
- `frontend/src/data/insights/knowledgeApi.ts` — V1.2 fact/candidate REST client + wire mappers.
- `frontend/src/data/insights/knowledgeHooks.ts` — `useKnowledge` (facts+candidates dual-read) + `useKnowledgeActions` (toggle/decide).
- `frontend/src/data/insights/knowledge.ts` — the mock seeds (`facts`, `candidateSeed`, `edges`) + the 4-category labels/colors.
- `frontend/src/features/insights/pages/ChatPage.tsx` — the real dual-mode chat surface ([`insights.md`](insights.md) §2.5).
- `frontend/src/features/insights/pages/KnowledgeListPage.tsx` — the real dual-mode L2 confirm surface ([`insights.md`](insights.md) §2.4).
- `frontend/src/features/insights/pages/MemoryPage.tsx` + `data/insights/memory{,Api,Hooks}.ts` — **`mezo-al1i`** the Memória tab (9th sub-tab, read-only over the 4 endpoints above); full breakdown in [`insights.md`](insights.md) §2.9, not duplicated here.
- `frontend/src/test/msw/handlers.ts` — companion fixtures (chat + facts/candidates + the `mezo-al1i` memory/{overview,summary,similar-days,llm-usage} defaults) + the SSE stream handler.
- `k8s/backend/deployment.yaml` — `MEZO_FEATURE_COMPANION_ENABLED=false` until the Gemini secret lands.

**Docs (link, don't duplicate)**
- Design spec: [`docs/superpowers/specs/2026-07-03-phase3-companion-chat-design.md`](../superpowers/specs/2026-07-03-phase3-companion-chat-design.md)
- Tool & context expansion design spec (`mezo-xixu`): [`docs/superpowers/specs/2026-07-26-companion-tool-context-expansion-design.md`](../superpowers/specs/2026-07-26-companion-tool-context-expansion-design.md)
- Live tool SSE events + anti-preamble prompt design spec (`mezo-280`): [`docs/superpowers/specs/2026-07-30-companion-stream-tool-events-design.md`](../superpowers/specs/2026-07-30-companion-stream-tool-events-design.md)
- Roadmap (14 slices): [`docs/superpowers/plans/2026-07-03-companion-roadmap.md`](../superpowers/plans/2026-07-03-companion-roadmap.md)
- V1.2 plan: [`docs/superpowers/plans/2026-07-03-companion-v12-fact-extraction.md`](../superpowers/plans/2026-07-03-companion-v12-fact-extraction.md)
- V1.3 plan: [`docs/superpowers/plans/2026-07-03-companion-v13-advisors.md`](../superpowers/plans/2026-07-03-companion-v13-advisors.md)
- V0.2 plan: [`docs/superpowers/plans/2026-07-03-companion-v02-conversations.md`](../superpowers/plans/2026-07-03-companion-v02-conversations.md)
- V0.4 plan: [`docs/superpowers/plans/2026-07-03-companion-v04-sse-fe-chat.md`](../superpowers/plans/2026-07-03-companion-v04-sse-fe-chat.md)
- V0.5 plan: [`docs/superpowers/plans/2026-07-03-companion-v05-tools.md`](../superpowers/plans/2026-07-03-companion-v05-tools.md)
- ADR: [`docs/decisions/0008-companion-llm-spring-ai-2-gemini.md`](../decisions/0008-companion-llm-spring-ai-2-gemini.md)
- Audit-log design spec: [`docs/superpowers/specs/2026-07-28-llm-call-audit-log-design.md`](../superpowers/specs/2026-07-28-llm-call-audit-log-design.md) + ADR: [`docs/decisions/0014-llm-call-audit-log.md`](../decisions/0014-llm-call-audit-log.md)
- Phase 5 "deep memory" design spec (`mezo-b3pp`, the journal embedding seam's driver): [`docs/superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md`](../superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md) §4.3/§5.1 · full feature doc: [`journal.md`](journal.md)
- Roadmap/milestone log: [`docs/milestones/roadmap.md`](../milestones/roadmap.md)
- References: [`docs/references/`](../references/) (`api_contract_conventions`, `liquibase_conventions`, `spring_patterns`, `testing_standards`, `integration_test_framework`, `configuration_conventions`, `java_package_structure`, `error_handling`, `companion_tool_conventions` — mezo-xixu's `@Tool` description house rule)
