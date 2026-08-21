---
title: Companion (AI chat brain)
type: feature-domain
status: mixed
updated: 2026-08-21
tags: [companion, ai, chat, llm, backend, phase-3]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion
  - backend/src/main/java/io/mrkuhne/mezo/feature/llmlog
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/GeminiUsageExtractor.java
  - api/feature/companion/companion.yml
  - frontend/src/data/insights/chatHooks.ts
  - backend/src/main/resources/db/changelog/1.0.0/script/202607031400_mezo-fnnq.2_create_ai_conversation_message.sql
  - docs/decisions/0008-companion-llm-spring-ai-2-gemini.md
related: [insights, _platform-api-backend, _platform-auth-security, journal]
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
  account level/coins/streak + top skills + weekly XP rollup, today's quest count + habit chains +
  creed/foci/reflection + napzárás state, FuelDay rollup + protocol + intakes, cycleDay/phase, last
  sleep + latest check-in), rendered as eight Hungarian-labelled blocks under `AKTUÁLIS ÁLLAPOT
  (pillanatkép — {dátum}):` and inserted into the `ChatService` system prompt **between the static
  voice and the history transcript**.
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
  snapshot's `Ma:`/`Holnap:`. **Both the sport and the gym part are shared code** — `ToolText.sportLine`
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
  (`mezo.companion.patterns.pairs`, 8 pairs v1 — **29 since V3.4**, `mezo-6ha5`) it lag-aligns two per-day metric series over the
  lookback window, gates on `min-n` (8), runs PURE Pearson math (`PearsonCorrelation` — r, n and
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

**The gate extracted into `PatternGate` + a live monitor (`mezo-viqs`, post-epic):** the
surfacing gate `detectPair` ran inline (the `aligned < min-n` and constant-series checks) moved
into `PatternGate` (`service/PatternGate.java`) — package-private, static, Spring-free, the
`PearsonCorrelation` precedent. `evaluate(seriesA, seriesB, lagDays, minN)` (`PatternGate.java:33-54`) `→ Outcome(Verdict,
alignedDays, PearsonCorrelation.Result, Side constantSide)` (types at `PatternGate.java:17-24`),
`Verdict ∈ {LIVE, FEW_DAYS, NO_DATA, DEGENERATE}`, `Side ∈ {A, B, BOTH}` (which series is
constant, `DEGENERATE`-only). **`FROZEN` is deliberately NOT in `Verdict`** — it is the
consequence of a persisted row's `confirmed`/`rejected` status, decided by the caller, never by
the gate math. `detectPair` now calls `PatternGate.evaluate` and upserts only on `LIVE`
(`PatternDetectionService.java:66-78`); the per-pair `try/catch` isolation and the
`upsert`/`reinforcePromotedFact` logic are unchanged, and `PatternDetectionServiceIT` is
untouched. **`PatternMonitorService`** (`service/PatternMonitorService.java`, read-only,
switch-gated) sits behind the new `GET /api/companion/pattern/monitor` — for every catalog pair
it re-runs `PatternGate.evaluate` over the EXACT SAME windows the nightly job would use
(`to = yesterday`, `from = to − (lookbackDays−1)`, B lag-shifted) and reports the **5-verdict
model**: `live` (gate passed, live `r`/`n`/`p`) / `few_days` (aligned days below `min-n`, with
`missingDays` + the thinner-covered bottleneck metric) / `no_data` (zero aligned days) /
`degenerate` (enough days but a constant series) / `frozen` (a `confirmed`/`rejected` row — no
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
    not 0) · `daily-xp` (activity + habit + completed-quest XP sum; zero-XP days absent) ·
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
| LLM adapter | ✅ V0.1 (ADR 0008) | Real `GeminiCompanionLlm` (`gemini-2.5-flash`) / deterministic `FakeCompanionLlm` (`companion-fake` profile, + forced-failure sentinels since V0.4, + `[fake-tool:…]` scripted tool execution since V0.5, + `[fake-briefing:…]` scripted briefing dispatched on `BRIEFING_MARKER_MIRROR` — a literal mirror of `BriefingGenerator.BRIEFING_MARKER`, not an import, to avoid a companion→proactive package cycle — since proactive B1.1; + `[fake-weekly:…]` scripted weekly-suggestion prose dispatched on `WEEKLY_MARKER_MIRROR` (same literal-mirror rule) since proactive W1; + `[fake-memoir:{…}]` scripted memoir JSON dispatched on `MEMOIR_MARKER_MIRROR` (`"HETI-MEMOIR-FELADAT"`, same literal-mirror rule) since proactive W2; + `[fake-heartbeat:…]` scripted heartbeat prose dispatched on `HEARTBEAT_MARKER_MIRROR` (`"NAPKOZBENI-JEGYZET-FELADAT"`, same literal-mirror rule) since proactive H1; + `[fake-prediction:{…}]` scripted predictions JSON (GREEDY regex — the payload nests objects) dispatched on `PREDICTION_MARKER_MIRROR` (`"HETI-PREDIKCIO-FELADAT"`) since proactive P1; + `[fake-experiment:{…}]` scripted experiment-proposal JSON (GREEDY) dispatched on `EXPERIMENT_MARKER_MIRROR` (`"N1-KISERLET-FELADAT"`, same literal-mirror rule) since proactive P2; + `[fake-activity:{…}]` scripted activity-classification JSON (GREEDY) dispatched on `ACTIVITY_MARKER_MIRROR` (`"TEVEKENYSEG-BESOROLAS-FELADAT"`, same literal-mirror rule) since gamified growth E2 `mezo-jzca` — the cheap-tier `ActivityClassifier` is a new `CompanionLlm` consumer outside `feature/companion`, see [`growth.md`](growth.md); + `[fake-quest-flavor:[…]]` scripted quest title/why rewrite (GREEDY — a JSON array; default `[]` = no rewrite → catalog copy) dispatched on `QUEST_FLAVOR_MARKER_MIRROR` (`"KULDETES-IZESITES-FELADAT"`, same literal-mirror rule) since gamified growth E3 `mezo-6ng8` — the cheap-tier `QuestFlavor` is a second such outside-`feature/companion` consumer, see [`growth.md`](growth.md)). |
| Streaming (SSE) | ✅ V0.4 | `POST .../message/stream` — `delta`/`done`/`error` events, two-transaction turn, hand-written controller (§9 Decision 11). |
| Tool calling + audit | ✅ V0.5, expanded mezo-xixu | 8 read tools at V0.5, **15 read hub-tools now** (scope-consolidated) over existing services; `RecordingToolCallback` audit + per-turn cap (raised 6→15, mezo-xixu); `tool_calls`/`refs` envelopes persisted; `mezo.companion.tools.*` tunables. |
| Frontend | ✅ V1.2 | ChatPage real since V0.4/V0.5; **KnowledgeListPage real since V1.2** (candidate inbox + persisting toggles + degraded state). **LIVE on k3s since 2026-07-04** — `GEMINI_API_KEY` rides the `mezo-app` SealedSecret, switch on; smoke-verified with a real context-aware Gemini answer. |
| Knowledge facts (L3) | ✅ V1.1 | `knowledge_fact`/`learned_fact` tables + fact CRUD + top-N injection block in every system prompt (`mezo.companion.facts.top-n`). |
| Fact extraction + confirm | ✅ V1.2 | Post-turn async extraction (`mezo.companion.extraction.*`) → `learned_fact` candidates → L2 decision endpoint → promotion (`source=chat`). |
| Advisor chain (never-ask-twice + self-check) | ✅ V1.3, criterion renamed `mezo-q71s` | Clinical regex + LLM verdict (`redundantQuestion`/`unmarkedClaim` — marked speculation allowed since [ADR 0028](../decisions/0028-marked-speculation-in-chat.md)), retry-once → `degraded` flag (`mezo.companion.advisors.*`); reinforcement on extraction dedupe-hit. |
| Vector infra (pgvector + EmbeddingPort) | ✅ V2.1 | `memory_embedding` (`vector(768)`, HNSW, cosine) + `EmbeddingPort` (real Gemini SDK adapter / fake); image `pgvector/pgvector:pg16` in compose + k3s + Testcontainers. |
| Narrative memory (summaries + embed pipeline) | ✅ V2.2 | Nightly `DailySummaryJob` (first cron; catch-up = backfill) → `daily_summary` + embeddings; post-turn `TurnEmbeddingListener` embeds every chat turn; `mezo.companion.summary.*` + `embedding.*` tunables. |
| Journal embedding seam | ✅ `mezo-b3pp.1` | `memory_embedding` kind-CHECK widened to 10 (only `journal_entry` populated); `JournalEmbeddingListener` (AFTER_COMMIT, `COMPANION_SWITCH`+journal-switch gated) → `MemoryEmbeddingWriter.writeJournal`/`.deleteJournalEmbedding` (edit = update-in-place, not delete+insert). Full detail: [`journal.md`](journal.md). |
| Decision embedding seam | ✅ `mezo-b3pp.4` | A FOURTH `memory_embedding` kind, `decision`, joins `chat_turn`/`daily_summary`/`journal_entry`; `DecisionEmbeddingListener` (same AFTER_COMMIT/`@Async`, `COMPANION_SWITCH`+journal-switch gated idiom) → `MemoryEmbeddingWriter.writeDecision` — embeds the decision text on create, then **re-embeds the SAME row in place on review** with the outcome folded in (`"…\n\nKimenet (N/5): …"`), because the outcome is the half worth recalling. No delete path (decisions aren't deletable), so no orphaned-vector race to handle. Full detail: [`journal.md`](journal.md). |
| Episodic recall in chat | ✅ V2.3 | `find_similar_past_days` tool + `MemoryRecallService` (similarity × exp(-age/τ), similarity floor, daily-summary scope); `Memory` ref chips; `mezo.companion.recall.*` tunables. |
| Statistical patterns + Inbox | ✅ V3.1, monitor added `mezo-viqs` | Nightly `PatternDetectionJob` (Pearson + real p-value, upsert by pair key, frozen user judgements) → `pattern` table → Inbox API → **PatternsPage real dual-mode** (`mezo.companion.patterns.*`); **`mezo-viqs`** extracted the shared `PatternGate` and added a read-only `GET /api/companion/pattern/monitor` (5-verdict live diagnostics over the job's exact windows, no writes) → **Insights Motor tab** ([`insights.md`](insights.md) §2.8). |
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
(`embedding/MemoryEmbeddingWriter.java:114-141`) — still the single write path, just a new
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
(`reflection`/`gratitude`/`decision`/`monthly_summary`/`activity_note`/`checkin_note` — only
`journal_entry` is written today). See [`journal.md`](journal.md) §3/§5/§9 for the full seam,
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
(`decisionText + "\n\nKimenet (" + outcomeRating + "/5): " + outcomeText`) — because the outcome
("what did I decide, and did it work") is the half of a decision actually worth recalling later, not
the raw decision text alone. This reuses the exact update-in-place mechanics `writeJournal` already
established (`findByKindAndRefId` → update `content`/`embedding`/`occurred_on` when a live row
exists, insert-only `write` on the first call) — **the one genuine difference from `journal_entry` is
that there is no delete path** (the decision surface offers no delete), so
`DecisionEmbeddingListener` carries no orphaned-vector re-check, only the same create-then-fast-review
insert-race retry-once (`DataIntegrityViolationException` on `uq_memory_embedding_kind_ref_id` →
re-read → retry). See [`journal.md`](journal.md) §3/§4/§5/§9 for the full decision-journal seam.

## 2. User-facing behavior

The ChatPage under Insights (`/insights/chat`, [`insights.md`](insights.md) §2.5) is the real
companion surface since V0.4, dual-mode:

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
  → ChatStreamService.streamMessage            service/ChatStreamService.java:59
      1. chatService.prepareTurn(userId, id, req)     ── TX #1: getOwned (404 BEFORE the stream),
         prompt = voice + snapshot + facts + pattern-ack + TONE_REMINDER (mezo-q71s: history is
         NOT in here — loadWindow()'s Turns ride PreparedTurn.history separately), persist USER
         row, title-once + lastMessageAt
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
      5. chatService.completeTurn(userId, id, answer, audit, degraded) ── TX #2: persist ASSISTANT
         row WITH tool_calls/refs envelopes + degraded → terminal event:done, data: MessageResponse
         (tools[] = "name(args)" chips, refs[] = tool-contributed data refs, degraded flag)
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
  → ChatService.sendMessage(userId, id, req)   service/ChatService.java:90
      1. conversationService.getOwned(userId, id)          → 404 RESOURCE_NOT_FOUND if missing/foreign
      2. systemPrompt = SYSTEM_PROMPT (incl. the V0.5 tool-usage line)
                      + contextSnapshotAssembler.render(userId, LocalDate.now())    ── V0.3 ──
                      + knowledgeFactService.renderPromptBlock(userId)              ── V1.1 ──
                      + knowledgeFactService.renderNewPatternFactsBlock(userId)     ── V3.3 ──
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
      5. persist the ASSISTANT row with audit.toToolCallsEnvelope()/toRefsEnvelope() + degraded
         (null envelopes when no tool ran — the V0.2 steady state is unchanged)
      6. touchConversation → lastMessageAt = now; title = first user msg (once)
      6b. publish ChatTurnCompleted ── V1.2: AFTER_COMMIT → @Async FactExtractionListener
          → FactExtractionService.extractFromTurn (cheap-tier LLM, JSON parse, dedupe, cap)
          → undecided learned_fact candidates (the streamed path publishes in completeTurn)
  → CompanionMapper.toMessageResponse(assistant)   mapper/CompanionMapper.java:30
      (null envelope → []; envelope entry {type,name,args} → wire MessageTool{type, "name(args)"})
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
background context, no longer the only forward signal), `[Növekedés]` (`GamificationService.getProfile` account level/XP/coins/
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
`snapshot.checkin-note-max-chars`). Every lookup uses `Optional`/status-filtered repo finders —
the assembler NEVER throws for missing data. Composition is strictly one-way (companion → other
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
(deterministic: accent-folded lowercase (NFD strip), sentence-split on `[.!?\n]`, violation when
an `advisors.rx-terms` term AND a dose-change verb (`emeld|emeljük|csökkentsd|…hagyd el|állítsd
át…` — imperative/we-forms only, written accent-folded) share a sentence) first; a clinical hit
skips `TurnVerdictCheck` that round. The verdict is ONE cheap-tier call through the history-less
two-string port (`VERDICT_MARKER`-prefixed judge prompt; payload = `"KONTEXTUS:\n" + turnSystemPrompt
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
  (chat_turn,daily_summary,weekly_summary)` at V2.1 — **widened to 10 kinds at Phase 5 W1.1**
  (`mezo-b3pp.1`, migration `202608181610_mezo-b3pp.1_expand_memory_embedding_kinds.sql`): `+
  monthly_summary, journal_entry, reflection, gratitude, decision, activity_note, checkin_note`.
  `journal_entry` (W1.1, `KIND_JOURNAL_ENTRY`, written by `JournalEmbeddingListener` below) and
  `decision` (W1.4, `KIND_DECISION`, written by `DecisionEmbeddingListener` below) are populated as
  of `mezo-b3pp.4`; the remaining four kinds are schema headroom for the rest of the Phase 5 W1
  narrative-capture wave (`journal.md` §5/§9) — one migration lands all ten per the
  design spec's explicit instruction, rather than one `alter table` per later slice), `ref_id uuid`
  (`uq_memory_embedding_kind_ref_id (kind, ref_id)` — one embedding per source unit, the V2.2
  pipeline's idempotence anchor **and the spans-soft-deleted-rows constraint that makes journal's
  edit path an update-in-place instead of delete+insert, see the bullet below**), `content text`
  (the embedded narrative, kept verbatim so recall can quote it), `embedding vector(768) not null`,
  `occurred_on date` (when the episode happened — the recency-ranking key); indexes
  `idx_memory_embedding_created_by_kind_occurred_on (created_by, kind, occurred_on desc)` +
  `idx_memory_embedding_vector` (**HNSW, `vector_cosine_ops`** — pairs with the `<=>` operator).

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
| `POST /api/companion/conversation/{id}/message/stream` | SSE `(delta\|tool)*, (done\|error)` | 200 · 400 · 401 · 404 | The **streamed** turn (V0.4, tag `CompanionStream`, **hand-written** — §9 Decision 11); `tool` events interleave live since mezo-280 (progress only — the `done` row's `tools[]` stays authoritative). Two-transaction; `error` ⇒ no assistant row. Non-2xx are plain JSON before the stream starts. |
| `GET /api/companion/fact` | `KnowledgeFactResponse[]` | 200 · 401 | V1.1 — owner's facts, `reinforcement_count desc, created_at desc`. |
| `POST /api/companion/fact` | `KnowledgeFactResponse` | 201 · 400 · 401 | V1.1 manual add — `CreateFactRequest {factText 1..500, category pattern}`; `source=manual`, `include_in_prompt=true`, `reinforcement_count=0`. |
| `PATCH /api/companion/fact/{id}` | `KnowledgeFactResponse` | 200 · 400 · 401 · 404 | V1.1 partial update — `UpdateFactRequest {factText?, category?, includeInPrompt?}`, only provided fields applied (the KnowledgeListPage toggle). |
| `GET /api/companion/fact/candidate` | `FactCandidateResponse[]` | 200 · 401 | V1.2 — the pending inbox: undecided candidates, newest first. |
| `POST /api/companion/fact/candidate/{id}/decision` | `FactCandidateResponse` | 200 · 400 · 401 · 404 | V1.2 — `FactDecisionRequest {decision accept\|reject\|refine, refinedText?}`; accept/refine promote (`promotedFactId` set); refine without text → FIELD `VALIDATION_REQUIRED_FIELD`; re-decide → `COMPANION_CANDIDATE_ALREADY_DECIDED`. |
| `GET /api/companion/pattern/monitor` | `PatternMonitorResponse` | 200 · 401 | `mezo-viqs` — live diagnostics: re-runs `PatternGate` over the exact windows the nightly job uses, writing nothing; per-pair verdict + per-`MetricKey` coverage — `missingDays` populated only for `few_days`, `bottleneckMetricKey` for `few_days`/`no_data`/`degenerate` (`PatternMonitorService.java:140-146`). **mezo-18bx (additive):** pairs carry `mechanismHu` (the catalog's config `mechanism`) + `metricADomain`/`metricBDomain`, coverage rows carry `sourceHu` + `domain` — straight pass-through from `MetricKey`/`PatternPair`, no new computation. |
| `GET /api/companion/pattern/pair/{pairKey}` | `PatternPairDetailResponse` | 200 · 401 · 404 | **S1 close (`mezo-tk88.3`):** the pattern detail page's one-stop read — `PatternPairDetailService.detail` reuses `PatternMonitorService.toPair` (package-widened) so the gate verdict can never disagree with the Motor dashboard. `pattern` is `null` until the pair goes live (no synthetic row); `events[]` is the `pattern_event` history (first reader, oldest-first); `days[]` are the CURRENT window's aligned points, computed live (never stored — frozen `confirmed`/`rejected` rows still show today's data); `impact` is the "what came of this" block (promoted fact + grounded predictions/experiments/challenges). Unknown `pairKey` (not in the `mezo.companion.patterns.pairs` catalog) → 404 `COMPANION_PATTERN_PAIR_NOT_FOUND`. **FE consumer since `mezo-tk88.5`:** `usePatternPairDetail(pairKey)` (`patternDetailHooks.ts`) → `PatternDetailPage.tsx` (`/insights/patterns/:pairKey`) — any 404 (unknown key OR the companion switch off) maps to one honest `notFound` state; see [`insights.md`](insights.md) §2.1b/§4. |
| `GET /api/companion/memory/overview` | `MemoryOverviewResponse` | 200 · 401 · 404 | `mezo-al1i` — L0–L3 layer counts + the 3 job cron strings, one read-only aggregate (`MemoryObservatoryService.overview`). |
| `GET /api/companion/memory/summary` | `MemorySummaryListResponse` | 200 · 401 · 404 | `mezo-al1i` — the L1 journal, date-desc, optional `from`/`to`; `embedded` flags a live `memory_embedding` row for that day. |
| `GET /api/companion/memory/similar-days` | `SimilarDaysResponse` | 200 · 400 · 401 · 404 | `mezo-al1i` — reuses `MemoryRecallService` (V2.3) verbatim; `q` required (1..∞ chars), `k` 1..5 (default 3); below-floor matches never returned (the same honest empty-list rule as the tool). |
| `GET /api/companion/memory/llm-usage` | `LlmUsageResponse` | 200 · 401 · 404 | `mezo-al1i` — daily rollup over `llm_log_history` (`days` 1..90, default 30); `enabled:false` + empty `perDay` + zeroed `totals` when the `mezo.feature.llm-log.enabled` switch is off — the query never runs. |
| `POST /api/companion/transcribe` | `TranscriptionResponse` | 200 · 400 · 401 · 404 · 502 | **`mezo-at8x.4`** — multipart `audio` → transcript. Own tag `CompanionVoice` → `CompanionVoiceApi` → `CompanionVoiceController`. Stateless + ephemeral: nothing persisted, the bytes live only for the one model call (`CompanionLlm.complete(system, "", InlineAudio)`, `CallKind.TRANSCRIBE`). Size/mime checked in `TranscriptionService` against `mezo.companion.transcription.*` (base mime only — `MediaRecorder`'s `;codecs=opus` is stripped) → FIELD `VALIDATION_INVALID_VALUE` on `audio`. **Empty text is a success, not an error** (silence); a model that narrates instead of transcribing (> 8 000 chars) → 502 `COMPANION_TRANSCRIBE_FAILED`. |

**Schemas:** `ConversationResponse {id, title?, startedAt, lastMessageAt?}`,
`MessageResponse {id, role, content, createdAt, tools[], refs[], degraded}` (**filled since
V0.5** on tool-using turns; a tool-less turn's null envelope still maps to `[]`,
`CompanionMapper.toTools/toRefs`; `degraded` required boolean since V1.3 — always false on user
rows), `MessageTool {type, name}` (`type` = `read` in V0.5; `name`
carries the args baked in — `get_recovery(scope=sleep, days=3)`), `MessageRef {kind, id}` (kinds: `Workout`,
`Sport`, `Run`, `WeightTrend`, `Sleep`, `FuelDay`, `Protocol`, `Goal`, `Medication`, since
V2.3 `Memory` — a recalled day's date, and since mezo-xixu `TrainingPlan` — the resolved date, or
the mesocycle title for `scope=meso`, `ExerciseRecord` — the exercise name, `Recipe` — the
matched recipe's name, `Pantry` — the pantry item's name, `SleepGoal` — the resolved wake time
(`get_recovery(scope=sleep-goal)`), `CheckIn` — a check-in's date (`get_recovery(scope=checkins)`),
and `Growth` — a stable scope label (`skills`/`week-{weekStart}`/`achievements`/`titles`,
`get_growth(scope)`), `Practice` — the resolved date (`get_daily_practice(date)`), and since
mezo-xixu `Insight` — a confirmed pattern's title (`get_insights(scope=patterns)`; no ref for the
deferred `predictions`/`experiments` scopes)),
`SendMessageRequest {content}` (`minLength 1`, `maxLength 4000`),
`StreamDelta {text}` + `StreamError {code}` + `StreamToolCall {type, name}` (V0.4 + mezo-280 — the
SSE per-event `data:` payloads; every data line is JSON; `StreamToolCall.name` carries the SAME
pre-baked `"name(args)"` label as `MessageTool.name`, `type` always `read` in V0.5),
`KnowledgeFactResponse {id, factText, category, source, reinforcementCount,
includeInPrompt, lastReinforcedAt?, createdAt}` (V1.1). **`mezo-al1i`** adds
`MemoryOverviewResponse {l0, l1, l2, l3, jobs}` (nested `MemoryOverviewL0/L1/L2/L3/Jobs` +
`MemoryPatternCount {kind, status, count}` + `MemoryFactSourceCount {source, count}` +
`MemoryEmbeddingCounts {dailySummary, chatTurn}`), `MemorySummaryListResponse {items:
MemorySummaryItem[]}` (`{date, narrative, embedded}`), `SimilarDaysResponse {items:
SimilarDayItem[]}` (`{date, excerpt, similarity, finalScore}` — `finalScore` is the wire name for
`MemoryRecallService`'s `similarity × exp(-age/τ)` score), and `LlmUsageResponse {enabled, perDay:
LlmUsageDay[], totals}` (`LlmUsageDay {date, calls, inputTokens, outputTokens, costUsd?}` —
`costUsd` null means no priced row that day, never a fabricated 0). All four schemas are defined in
`api/feature/companion/companion.yml`, alongside the existing `Companion` tag schemas.

**`PatternPairDetailResponse` (S1 close, `mezo-tk88.3`):** `{pair: PatternMonitorPair,
pattern: PatternResponse | null, events: PatternEventResponse[], days: AlignedDayResponse[],
impact: PatternImpactResponse}` — `pair`/`days` are the SAME `PatternMonitorPair`/live-window
shapes the monitor endpoint returns (§ above), so the two surfaces never disagree. `PatternEventResponse
{kind, occurredAt, r?, n?, p?, reinforcementCount?, factId?}` mirrors one `pattern_event` row 1:1
(`CompanionMapper.toPatternEventResponse`) — only the fields the `kind` actually uses are non-null.
`PatternImpactResponse {fact: PatternImpactFact | null, predictions: PatternImpactRef[],
experiments: PatternImpactRef[], challenges: PatternImpactRef[]}` — `fact` is the promoted knowledge
fact (via `PatternEntity.promotedFactId`), the three ref lists are grounded rows found by each
proactive repository's `findByCreatedByAndSourcePatternIdAndDeletedFalse` (S2, `mezo-tk88.2`);
`PatternImpactRef {id, title, status}`. **Assembly crosses the companion↔proactive boundary** —
see §5.5's `PatternImpactSource` paragraph for how that stays ArchitectureTest-clean.

### The V0.5 tool catalog (all read-only, ownership-scoped, audited)

| Tool (args) | Source (existing reads) | Ref |
|---|---|---|
| `get_training_log(scope, days)` (mezo-xixu, merged from `get_recent_workouts`+`get_sport_sessions`) | scope=gym: `WorkoutSessionRepository.findDoneInstancesBetween` + per-instance sets → date, dayLabel, set count, Σ volume kg; scope=sport/run: sport + run since-date finders → sport/duration/intensity/RPE or run week/rounds | `Workout`/date (≤5) or `Sport`/date (≤3) or `Run`/date (≤3) |
| `get_training_plan(scope, date)` (mezo-xixu, sport added mezo-ajp) | FORWARD plan: `WorkoutService.findPlannedTemplateForDate` + `ExerciseRepository` (gym day, read-only — never `getToday`) + `SportService.getSchedule` (recurring slots matched on the date's weekday) + `RunningService.listBlocks`/`RunningBlockStructure` (prescribed run) + `TrainService.listMesocycles` (`scope=meso` full cycle) | `TrainingPlan`/date or meso title |
| `get_weight_trend(weeks)` | `WeightTrendService.computeTrend` → trend kg, weekly + 4w rate, one EWMA point per ISO week | `WeightTrend`/`{w}h` |
| `get_fuel_log(range, date, days)` (mezo-xixu, merged from `get_recent_meals`) | range=day: `FuelDayService.getDay` looped per day (from `date`, default today) → kcal/F vs targets, meal count + titles (≤3), plus `WaterLogService.sumForDay` for the anchor day's water vs target; range=week: `FuelDayService.getWeek` (Monday-anchored ISO week containing `date`) → per-day kcal/F/water vs targets | `FuelDay`/date (≤5) |
| `get_recovery(scope, days)` (mezo-xixu, merged from `get_sleep`, adds sleep-goal + check-ins) | scope=sleep: `SleepLogRepository` since-date finder → duration, quality, awakenings; scope=sleep-goal: `SleepGoalService.getGoal` (target minutes, regularity band; `SLEEP_GOAL_SWITCH`-gated, read via `ObjectProvider`) + `SleepAnchorPort.resolve` (bed/wake anchor, ungated) → target hours/min, bed/wake, regularity band; scope=checkins: `CheckInService.listForDay` per day across the window → energy/stress/body/mental (1–10) per slot | scope=sleep: `Sleep`/date (≤5); scope=sleep-goal: `SleepGoal`/wake-time; scope=checkins: `CheckIn`/date (≤5) |
| `get_protocol(scope, days)` (mezo-xixu, merged from `get_protocol_adherence`) | scope=adherence: `ProtocolService.getView().getActive()` + intake since-date finder → per-day taken/expected + total %; scope=intake: `IntakeService.listForDay` (today, protocol-independent) → item names (via the pantry stash) + known dose; scope=supplements: the active protocol's distinct `items[].pantryItemId` (mezo-vx9v living protocol, zone-sorted) → item names | `Protocol`/`v{n}` (adherence/supplements always; intake only when a protocol happens to be active) |
| `get_goal(scope)` (mezo-xixu, merged from `get_goal_progress`) | scope=progress (default): active goal + `computeTrend` + `GoalPrescriptionJson.currentSegment` → week N, start→target, actual vs plan rate, e heti recept; scope=recept: the goal's `prescription.segments` (≤3) → per-segment kcal/protein/sleep/rest-days/rate/rationale; scope=guards: `prescription.guardStatus` → strength e1RM trend + breach, muscle weekly-set floor + below-maintenance list; scope=feasibility: `prescription.feasibility` → verdict + notes (≤3); scope=timeline: `GoalTimelineService.getTimeline` (pure read) → mapped plan links + uncovered gym-lane week gaps (≤3 each). recept/guards/feasibility render "még nincs kiértékelve" until the goal's first `evaluate` (never called from the tool) | `Goal`/title |
| `get_medication(scope)` (mezo-xixu; `scope ∈ {cycle, all}`, default `cycle`, renamed from the drug-specific original scope names in `mezo-lwmq`) | scope=cycle (default): `MedicationCycleService.derive` + top-10 doses → cycle day, phase, last dose, next due; scope=all: `MedicationService.getDay` → name, active ingredient, cadence, default dose, cycle position (once a dose is on record) + recent doses, generic (no drug-specific naming) | `Medication`/name |
| `get_exercise_records(exercise)` (mezo-xixu) | `ExerciseRecordService.list` (compute-on-read over working sets, read-only) → no/blank `exercise`: top-5 lifts by best e1RM; with `exercise`: case-insensitive name-contains match(es) → bestSet, bestE1rm (Epley), repRecords, recentTopSets | `ExerciseRecord`/exercise name (≤5) |
| `get_recipes(filter)` (mezo-xixu, scored match mezo-sxe) | `RecipeService.list` (read-only) → no/blank `filter`: name/category/whole-recipe kcal+protein/mezo-fit score list; with `filter`: accent-folded token match scored over name (4) > ingredient name (3) > slot/category/role/tag/fitsFor/starred (2), all-token hits winning over partial — the best scorer renders full macros + ingredient lines (the detail comes from the same `.list` response, not a separate `.get` call) | `Recipe`/recipe name (≤5) |
| `get_pantry(kind)` (mezo-xixu) | `PantryService.getPantry` (read-only) → `kind ∈ {food, supplement, stim, med}` (default: all kinds); food from `ingredients` (name + stock qty/unit + expiry), supplement/stim/med from `stash` filtered by `type` (name + stock qty/unit, no expiry in the contract) | `Pantry`/item name (≤5) |
| `get_growth(scope)` (mezo-xixu) | scope=skills (default): `ProgressionService.getProfile` (ungated) → account level/XP/streak from `GamificationService.getProfile` (`GAMIFICATION_SWITCH`-gated, `ObjectProvider`) + every skill with real progress (athletic/muscle/life); scope=week: `GrowthWeekService.growthWeek` (ungated) → closed quests, LIFE XP, activities, savings for the current ISO week; scope=achievements: `AchievementService.achievements` (ungated) → all 9 derive-on-read badges + persisted perk unlocks; scope=titles: `GamificationService.getProfile` → equipped + owned titles | `Growth`/`skills` or `week-{weekStart}` or `achievements` or `titles` |
| `get_daily_practice(date)` (mezo-xixu) | `TodayQuestSource.todayStats` (port, read-only) → quest completed/total for the date; `HabitService.summary` (always "as of today", no `date` param) → perfect-chain-day counts + any habit with real 28-day signal; `IntentionService.getDay` → creed/foci/reflection for the date; `RitualService.getDay` → napzárás closed/open for the date; `TodayActivitySource.activitiesForDay` (2nd companion-owned port, impl `activity/service/DailyActivityAdapter`) → logged activities (text + XP), capped at 5. Active challenges NOT composed (`ProactiveChallengeService.getChallenges` write-transactional; a direct repository read would open a new companion→proactive cycle) | `Practice`/date |
| `get_insights(scope)` (mezo-xixu) | scope=patterns (default, only live scope): `PatternService.list` (same `companion` slice, read-only) filtered to `PatternEntity.STATUS_CONFIRMED` → title + deterministic mechanism prose (direction/strength) + evidence chips (r/n/p), capped at 5. scope=predictions/experiments DEFERRED — `ProactivePredictionService.getPredictions`/`ProactiveExperimentService.getExperiments` (`feature.proactive.service`) lazily GENERATE on a miss (a write) and a direct import would open a new companion↔proactive cycle; both render "még nem elérhető" | `Insight`/pattern title (≤5); none for predictions/experiments |
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
- `mezo.companion.patterns.pairs` = the 29-pair catalog (`@NotEmpty`, each
  `{key, category, label, title, mechanism, question, expected-direction, when-positive-hu,
  when-negative-hu, metric-a, metric-b, lag-days}`) — `mechanism` is the „miért figyeljük"
  one-liner (`mezo-18bx`); **`mezo-fj1g` added the human-language card fields:** `question`
  (the card's question-title), `expected-direction` (`positive|negative` — the hypothesized
  correlation sign; the FE renders „Meglepő:" when the found sign disagrees) and the two authored
  direction readings `when-positive-hu`/`when-negative-hu` (what a positive/negative r MEANS for
  this pair, in Hungarian, with an `{erősség}` slot the FE fills from |r|). All `@NotBlank` —
  the config validator refuses a pair without them. Pair keys are pattern identity (never rename
  a live key); metrics come from the `MetricKey` enum, which since `mezo-18bx` also carries
  `sourceHu` and a `MetricDomain` (`SLEEP/TRAIN/FUEL/MIND/BODY/OTHER`); the monitor DTOs pass
  everything through (`questionHu`/`expectedDirection`/`whenPositiveHu`/`whenNegativeHu` since
  `mezo-fj1g`), and `PatternResponse` gained `pairKey` (the Motor↔Patterns cross-link anchor).
- `mezo.companion.patterns.load-gym-kg-per-min` = **100** (`@Min(1) @Max(10000)`) — V3.4: the
  ACWR/monotony daily-load common scale (this many kg of gym volume ≙ one sport minute).
- `mezo.companion.summary.note-max-chars` = **200** (`@Min(0) @Max(1000)`) — V3.4: per-field cap
  on the digest's qualitative fields (notes, mention excerpt).
- `mezo.companion.hypotheses.cron` = `"0 0 3 * * SUN"` — the V3.2 weekly loop; switch
  `mezo.techcore.cron.hypothesis-job.enabled` (`HYPOTHESIS_JOB_SWITCH`).
- `mezo.companion.hypotheses.max-per-run` = **3** (`@Min(1) @Max(10)`) — hypotheses judged per run.
- `mezo.companion.hypotheses.keep-threshold` = **0.75** / `revise-threshold` = **0.50** (0..1) —
  the arch §4.7 routing thresholds; the four WEIGHTS are code constants (they define the score).
- Feature switch `mezo.feature.companion.enabled` (`FeaturesConfiguration.COMPANION_SWITCH`).

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

**V2.1 embedding seam (✅ wired, unused until V2.2).** All embedding access goes through the
`EmbeddingPort` (`EmbeddingPort.java`) — `embedDocuments(List<String>) → List<float[]>` /
`embedQuery(String) → float[]`, unit vectors at `DIMENSIONS=768`. Real `GeminiEmbeddingAdapter`
talks to the Google GenAI SDK `Client` bean directly (Spring AI 2.0.0 has no Gemini
EmbeddingModel — the SDK call is the slice's provider decision, hidden by the port; same key as
chat); fake `FakeEmbeddingAdapter` under `companion-fake` (seeded-random unit vectors +
`[fake-embed:…]` sentinel).

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
LlmCallContext(feature, operation, entityKind, entityId), …)` wraps each of the **32 tagged call
sites across 29 classes** (companion chat/summary/extraction/hypotheses/recall/embedding/advisor/
smoke-test + meal draft & coach, pantry scrape & photo, sleep shot, recipe prose, activity classify,
quest flavor, habit-suggest, fuel stack-placement & slot-template, voice transcription, and the
proactive generators). An untagged site records `feature = 'unknown'`. Switch
`mezo.feature.llm-log.enabled` off ⇒ the injected recorder is the no-op ⇒ nothing happens; the
adapters never branch on the switch.

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
cycle/water/weight/check-in) — zero new cross-feature finders v1; `PatternsPage` consumes
`usePatterns`/`usePatternActions` from `@/data/hooks` ([`insights.md`](insights.md) §2.1).
**V3.4 widened the read set** (still read-only, one-way): exercise-feedback, habit-day,
ritual-day, mention and medication-dose repositories; the only NEW
finders are two derived queries on `RitualDayRepository`
(`findByCreatedByAndRitualDateBetween`, `findFirstByCreatedByOrderByRitualDateAsc`) — no
migration. The digest additionally reads `MentionRepository` + `DailyIntentionRepository`.
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
wires it in, no compile-time edge crosses the boundary in the new direction. `PatternImpactService`
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

21. **Category enum v1 = `train|fuel|health|life`, source = `chat|pattern|manual`** — String +
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

**Deferred (with bd ids):**
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
- **Knowledge graph edges** — the Me KnowledgePage graph layer has no backend (real mode renders
  `edges: []`); file its slice when the graph view earns it.

## 10. Key files

**API contract**
- `api/feature/companion/companion.yml` — the conversation/fact/pattern surface (tag `Companion` → `CompanionApi`), the SSE turn (tag `CompanionStream`, hand-written), the voice note (tag `CompanionVoice` → `CompanionVoiceApi`, `mezo-at8x.4`) and, since **`mezo-al1i`**, the `memory/{overview,summary,similar-days,llm-usage}` reads on the same `Companion` tag;
  registered in `api/generate/merge.yml` → merged `api/openapi.yml` → `api.gen.ts` + `io.mrkuhne.mezo.api.*`.

**Backend — controllers / services / mapper**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/CompanionController.java` — `implements CompanionApi`, JWT ownership, switch-gated.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/CompanionStreamController.java` — the V0.4 **hand-written** SSE endpoint (§9 Decision 11).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/CompanionVoiceController.java` + `service/TranscriptionService.java` — **`mezo-at8x.4`** the stateless voice-note → transcript surface (`implements CompanionVoiceApi`, switch-gated; size/mime validation + the transcription system prompt).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ConversationService.java` — list/create/listMessages/`getOwned` (404).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java` — `SYSTEM_PROMPT` (named blocks, mezo-q71s) + `TONE_REMINDER` + snapshot/facts prompt assembly + sync turn + the V0.4 `prepareTurn`/`completeTurn` halves; `toTurns`/`loadWindow` produce the `List<Turn> history` that now travels SEPARATELY from the prompt.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/ChatHistory.java` — **mezo-q71s** the `List<Turn>` → "Daniel: … / Mezo: …" text renderer, the sole source for the three non-model consumers (advisor judge payload, fake LLM echo, `llm_log_history.conversation_history`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatStreamService.java` — the V0.4 streamed turn (`delta`/`tool`/`done`/`error` Flux over the port; the `tool` sink since mezo-280).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ContextSnapshotAssembler.java` — the V0.3 cross-feature "today" block (8 HU blocks, `nincs adat` absences).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/TodayQuestSource.java` — the companion-owned port for `[Napi gyakorlat]`'s quest count, implemented by `feature/quest/service/TodayQuestAdapter.java` (keeps the quest↔companion dependency one-directional; the `progression.QuestLedgerSource` precedent).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/KnowledgeFactService.java` — V1.1 fact CRUD + `renderPromptBlock` (top-N injection, `FACTS_HEADER`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/FactExtractionService.java` — V1.2 post-turn extraction (`EXTRACTION_MARKER`, parse/dedupe/cap).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/{ChatTurnCompleted,FactExtractionListener}.java` — the V1.2 AFTER_COMMIT async trigger.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/FactCandidateService.java` — V1.2 pending inbox + accept/refine/reject decision.
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/AsyncConfiguration.java` — `@EnableAsync` (born with V1.2).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/mapper/CompanionMapper.java` — entity → generated `api.dto` (null envelope → `[]`; + `toKnowledgeFactResponse`; + `degraded` since V1.3; + `toPatternEventResponse` since S1 close `mezo-tk88.3`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternPairDetailService.java` — **S1 close (`mezo-tk88.3`)** the pattern detail page's read; reuses `PatternMonitorService.toPair` (package-widened) + delegates the impact block to `PatternImpactSource`.
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
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` — deterministic fake (`companion-fake`); `[fake-tool:…]` sentinel execution since V0.5; the greedy `[fake-meal:{json}]` sentinel (matched in user text + UTF-8 image bytes, mezo-78rn); the greedy `[fake-recipe-fit:{json}]` sentinel (planted in a recipe name, mezo-bw3y); the `MESO_REVIEW` branch (mezo-meyc.3) answering the canned `MESO_REVIEW_ANSWER` unless `[fake-meso-review:…]` is planted in the run TITLE, or `[fake-meso-review-echo]` which returns the **assembled user payload verbatim** (the only way to assert what the generator actually sent — the fake stays stateless, no prompt recorder) — failure injection rides the shared `[fake-fail]`. Unlike the `feature.proactive`/`feature.activity` markers this one is IMPORTED (`MesoReviewGenerator.MESO_REVIEW_MARKER`), not mirrored as a literal: the generator is in the SAME `companion` slice, so no new package cycle is possible.
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
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java:114-141` — `writeJournal` (update-in-place re-embed on an edit — `uq_memory_embedding_kind_ref_id` spans soft-deleted rows, so a delete+insert would collide) / `deleteJournalEmbedding`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/MemoryEmbeddingEntity.java:44-58` — `KIND_JOURNAL_ENTRY` + the 10-kind `@Pattern` (§4 above).
- Tests: journal cases folded into `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriterIT.java` (`testWriteJournal_*`/`testDeleteJournalEmbedding_*`) + `backend/src/test/java/io/mrkuhne/mezo/feature/journal/JournalEmbeddingEventIT.java` (the end-to-end AFTER_COMMIT round trip) — full test map in [`journal.md`](journal.md) §8.

**Backend — decision embedding seam (`mezo-b3pp.4`, Phase 5 W1.4, post-epic — full detail in [`journal.md`](journal.md))**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/DecisionEmbeddingListener.java` — the AFTER_COMMIT/`@Async` trigger on `feature/journal`'s `DecisionEntrySavedEvent` (fired on both create and review), gated on `COMPANION_SWITCH` + `JOURNAL_SWITCH`; retries once on the create-then-fast-review insert race, no delete-race handling (decisions aren't deletable).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java:150-176` — `writeDecision`: embeds `decisionText` on create, re-embeds the SAME `(kind=decision, ref_id)` row in place on review with the outcome folded into the content (`"…\n\nKimenet (N/5): …"`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/MemoryEmbeddingEntity.java:44-58` — `KIND_DECISION` (the 10-kind `@Pattern`, §4 above, unchanged — `'decision'` was already permitted).
- Tests: decision cases folded into `MemoryEmbeddingWriterIT` (`testWriteDecision_*`) + `backend/src/test/java/io/mrkuhne/mezo/feature/journal/DecisionEmbeddingEventIT.java` (the end-to-end AFTER_COMMIT round trip, both create and review) — full test map in [`journal.md`](journal.md) §8.

**Backend — entities / repos / config**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/{AiConversationEntity,AiMessageEntity,ToolCallsEnvelope,RefsEnvelope,KnowledgeFactEntity,LearnedFactEntity}.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/{AiConversationRepository,AiMessageRepository,KnowledgeFactRepository,LearnedFactRepository}.java` — **`mezo-al1i`** added finders for the observatory: `LearnedFactRepository.countByCreatedByAndUserDecisionIsNullAndDeletedFalse` (the L2 pending count).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/DailySummaryRepository.java` — **`mezo-al1i`** added `countByCreatedBy`, `findTop1ByCreatedByOrderBySummaryDateAsc/Desc` (L1 first/last date), `findByCreatedByAndSummaryDateBetweenOrderBySummaryDateDesc` (the journal query).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/MemoryEmbeddingRepository.java` — **`mezo-al1i`** added `countByCreatedByAndKind` (L1 embedding counts) + `findRefIdsByCreatedByAndKind` (the memory-observatory L1 journal's `embedded` flag lookup — the daily-summary journal, not `feature/journal`); **`mezo-b3pp.1`** added `findByKindAndRefId` (the journal embed pipeline's update-in-place lookup, above).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java` — `Llm` + `Chat` + `Snapshot` + `Tools` + `Facts` + `Extraction` + `Advisors` records; **`mezo-b3pp.1`** added `Journal` (`:203-207` — `decisionReviewDays`, unused by this slice, landed early for W1.4's decision journal).
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `COMPANION_SWITCH` + extraction/advisors sub-switches.
- `backend/src/main/resources/application.yml` — `mezo.feature.companion.enabled` + `mezo.companion.llm.*`/`chat.*` + `spring.ai.google.genai.api-key`.

**Backend — migration**
- `backend/src/main/resources/db/changelog/1.0.0/script/202607031400_mezo-fnnq.2_create_ai_conversation_message.sql` (in `1.0.0_master.yml`).
- `backend/src/main/resources/db/changelog/1.0.0/script/202607031707_mezo-fnnq.6_create_knowledge_learned_fact.sql` (in `1.0.0_master.yml`).
- `backend/src/main/resources/db/changelog/1.0.0/script/202607031812_mezo-fnnq.7_learned_fact_category.sql` (in `1.0.0_master.yml`).
- `backend/src/main/resources/db/changelog/1.0.0/script/202607031900_mezo-fnnq.8_ai_message_degraded.sql` (in `1.0.0_master.yml`).
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
- `backend/src/test/java/io/mrkuhne/mezo/feature/companion/{CompanionMemoryOverviewApiIT,CompanionMemorySummaryApiIT,CompanionMemorySimilarDaysApiIT,CompanionMemoryLlmUsageApiIT,CompanionMemoryLlmUsageDisabledIT,CompanionMemorySwitchOffIT}.java` — the `mezo-al1i` memory-observatory batch: populated + empty overview, range-filtered summaries, the deterministic fake-embedding similar-days path, the LLM-usage rollup + its `enabled:false` disabled-audit branch, and the switch-off 404 across all 4 endpoints; `CompanionApiSwitchOffIT` extended to assert the memory/overview route (one of the four), with `CompanionMemorySwitchOffIT` proving bean absence covers all four.
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

