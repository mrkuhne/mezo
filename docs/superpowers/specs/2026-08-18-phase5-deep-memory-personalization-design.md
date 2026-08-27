# Phase 5 — Deep Memory & Personalization (design)

- **Date:** 2026-08-18 (reconstruction — the original 2026-07-31 spec was never committed and is lost;
  this spec was rebuilt from the epic's 20 bd slice descriptions, the live codebase, and fresh design
  decisions with Daniel. It **supersedes** every reference to
  `2026-07-31-phase5-deep-memory-personalization-design.md`.)
- **Driver:** epic `mezo-b3pp` (20 slices, `mezo-b3pp.1`–`.20`)
- **Slice roadmap:** [`2026-08-18-phase5-roadmap.md`](../plans/2026-08-18-phase5-roadmap.md)
- **Status:** approved design, pre-implementation

## 0. How to use this document

Each slice (§5–§9) is written to be executable from a **fresh session with zero prior context**:
read §1–§4 + the slice's own section + the file anchors it names, then brainstorm nothing — design
decisions are made here. The slice sections state *what* and *why*; per-slice implementation plans
(TDD steps) are still written at execution time via the normal plan workflow. §10 fixes the
execution order, which deliberately differs from the numeric slice order.

## 1. Goal — from "emlékszik" to "ismer"

Phase 3 gave the companion layered memory (snapshot → tools → facts → RAG → patterns); Phase 4 made
it speak first. What is still missing:

1. **Daniel's own words are not in the memory.** The embedding store holds *generated* prose
   (daily summaries, chat turns). Journal, evening reflection, gratitude, decisions — the narrative
   raw material — has no home. Numbers live in SQL; *stories* must live in the vector space
   (the Phase 3 spec's own rule), and today there are almost no first-person stories.
2. **Knowledge is a list, not a web.** `knowledge_fact` rows are flat sentences. "Late eating hurts
   sleep" and "poor sleep hurts training" exist independently; nothing represents that they chain.
3. **Recall is opt-in.** The past surfaces only when the model *chooses* to call
   `find_similar_past_days`. Every turn should start already-grounded in relevant past.
4. **Zero feedback signal is captured.** Months of generated briefings/memoirs/answers, and not one
   👍 is recorded. Every week without capture is lost training data — this is why feedback capture
   ships **first** (§10).
5. **The companion reacts to messages, not to state.** It cannot notice "three high-stress days in a
   row" and act on its own.

Five workstreams map onto these: **W1 narrative capture**, **W2 knowledge graph**, **W3 always-on
recall + consolidation**, **W4 feedback → profile**, **W5 state-triggered interventions
(JITAI-lite)**.

## 2. Identity constraints (unchanged, restated)

- **IDENT-2 Internal sphere only** — no outward-acting tool, ever. W5 interventions act only inside
  the app (feed + push), never on the outside world.
- **IDENT-3 Never silent-broken** — every new surface must render an honest degraded state when the
  companion/LLM is off. Recall failure degrades to "no memory block", never to a failed answer.
- **IDENT-6 Cognitive offloading, L1/L2/L3** — everything the AI *derives* about Daniel goes
  through the L2 approve-card inbox before becoming durable (LIFE_EVENT candidates, SEASON
  candidates); direct captures (journal, gratitude, feedback taps) are L1 (auto).
- **Clinical guard** — the advisor chain (V1.3) applies to every new prompt path unchanged.
- **Privacy note:** journal/reflection text goes to the Gemini API for embedding, exactly like chat
  turns already do. No new exposure class; no third party beyond the existing provider.

## 3. Existing surfaces the phase builds on (verified 2026-08-18)

File anchors verified against main; re-verify with grep if a slice lands much later.

- **Prompt assembly** — `ChatService` (`feature/companion/service/ChatService.java`): canonical
  order `SYSTEM_PROMPT → ContextSnapshotAssembler.render → knowledgeFactService.renderPromptBlock →
  renderNewPatternFactsBlock → TONE_REMINDER`; history as real turns (window
  `mezo.companion.chat.history-window`); post-turn `ChatTurnCompleted` event (AFTER_COMMIT) feeds
  `FactExtractionListener` + `TurnEmbeddingListener`.
- **Refs** — assistant `ai_message.refs` jsonb (`RefsEnvelope{kind,id}`), written by
  `ToolCallAudit.addRef` from every tool; kinds today: Workout, Sport, Run, TrainingPlan,
  ExerciseRecord, Insight, WeightTrend, Sleep, SleepGoal, CheckIn, Memory, Goal, Growth, FuelDay,
  Protocol, Recipe, Pantry, Practice, Medication. W4.2's reinforcement layer reads these.
- **memory_embedding** — `(kind, ref_id)` unique, `vector(768)` HNSW cosine,
  `ck_memory_embedding_kind in ('chat_turn','daily_summary','weekly_summary')` — `weekly_summary`
  is already legal but unwritten. `EmbeddingPort.embedDocuments/embedQuery` = Gemini
  RETRIEVAL_DOCUMENT/RETRIEVAL_QUERY task types; single write path `MemoryEmbeddingWriter`
  (idempotent by `(kind, ref_id)`, content capped at `mezo.companion.embedding.embed-max-chars`).
  `MemoryRecallService.recallSimilarDays` ranks by `similarity × exp(-age/τ)` over
  **daily_summary only** today.
- **Proactive feed** — `companion_message` table, kinds `morning|sleep|weight|midday|evening`,
  one live row per user+day+kind; crons `mezo.proactive.feed.*-cron`. **The old `briefing` and
  `heartbeat_note` tables were dropped** (202608151230) — wherever the bd slice text says
  "briefing/heartbeat", read "companion feed".
- **Memoir** — `memoir` table (week_start, title, body, anchors jsonb), Sunday smart-tier cron;
  **reactions are mock-only** (`MemoirPage.tsx` local state; the row doesn't even render live) —
  W4.1 replaces them and closes bd `mezo-kr9v`.
- **L2 inbox precedents** — fact candidates (`learned_fact` accept/refine/reject via
  `FactCandidateService.decide`), experiments/challenges (`.../decision` endpoints, 409 on
  re-decide). W2.3/W5.3 candidates reuse this idiom.
- **Pattern→fact promotion (V3.3)** — `PatternService.decide`: first confirm promotes
  `knowledge_fact(source=pattern)`; un-confirm never retracts. W2.2 mirrors this into graph nodes.
- **Napzárás** — `ritual_day(ritual_date, closed_at)`; FE `RitualPage` 5-act flow (Arrival →
  DayStory → Loops → Harvest(close) → Release); today nothing writes before act 4.
- **QuickInput** — `QuickInputSheet` 8-tile grid, in-place sheet swap idiom
  (`Phase = menu|sleep|naplo|checkin`); `naplo` currently opens `ActivityLogSheet` →
  `POST /api/activity` (`activity_log` with AI LIFE-skill classification).
- **check_in** — `note varchar(500)`; **`CheckInService.save` publishes no event today** (gap W5.1
  fills). Sleep/weight writes publish `SleepLogSavedEvent`/`WeightLogSavedEvent` consumed by
  `CompanionMessageEventListener` (`@Async @TransactionalEventListener(AFTER_COMMIT)`) — the
  template for W5.1's on-write evaluation.
- **Notifications** — 14 categories in `NotificationCategory` (enum carries
  key/defaultEnabled/defaultLeadMinutes/feWritten); `notification_pref` (missing row = code
  default); `push_log` day-scoped dedup written before send; per-minute dispatcher. **No
  quiet-hours anywhere** — W5.2 introduces it. New categories need no migration (varchar columns).
- **LLM tiers** — `mezo.companion.llm.chat-model=gemini-2.5-flash` (cheap),
  `smart-model=gemini-2.5-pro` (weekly/quarterly pipelines), embed
  `mezo.companion.embedding.model=gemini-embedding-001`. **Every** new LLM/embed call site wraps in
  `LlmCallContextHolder.runWith(new LlmCallContext(feature, operation, entityKind, entityId), …)`.
- **Config idiom** — feature switches `mezo.feature.<x>.enabled` as `FeaturesConfiguration`
  constants + `@ConditionalOnProperty` (array-AND for stacked switches); cron switches
  `mezo.techcore.cron.<job>.enabled` ("off ⇒ the job bean does not exist; lazy GET still serves");
  tuning as nested `@Valid` records in `CompanionProperties` (the `Patterns` record is the model).

## 4. Data model

All new tables: UUID PK (`gen_random_uuid()`), `created_by uuid` (server-side, `on delete cascade`
unless noted), `is_deleted` soft delete + `@SQLRestriction`, `created_at`. Explicit constraint
names (`pk_/fk_/uq_/ck_/idx_`). Migration files carry the driving slice's bd id.

### 4.1 W1 — narrative tables

```sql
create table journal_entry (
    id           uuid primary key default gen_random_uuid(),
    created_by   uuid not null references app_user(id) on delete cascade,
    is_deleted   boolean not null default false,
    created_at   timestamptz not null default now(),
    occurred_on  date not null,               -- the day the entry is ABOUT (default: today)
    text         text not null,               -- free prose, no length cap
    source       varchar(12) not null,        -- ck: quickinput | ritual
    constraint ck_journal_entry_source check (source in ('quickinput','ritual'))
);
create index idx_journal_entry_created_by_occurred_on on journal_entry (created_by, occurred_on desc);
```

`ritual_day` gains `reflection_text text` (nullable — skipping is first-class) and
`gratitude entries` live separately:

```sql
create table gratitude_entry (
    id          uuid primary key default gen_random_uuid(),
    created_by  uuid not null references app_user(id) on delete cascade,
    is_deleted  boolean not null default false,
    created_at  timestamptz not null default now(),
    occurred_on date not null,
    text        varchar(280) not null,
    life_area   varchar(16),                  -- nullable; ck: the 8 LIFE skill keys
    constraint ck_gratitude_entry_life_area check (life_area is null or life_area in
      ('mindfulness','mindset','cooking','financial','productivity','learning','connection','recovery'))
);
create index idx_gratitude_entry_created_by_occurred_on on gratitude_entry (created_by, occurred_on desc);
```

```sql
create table decision_entry (
    id               uuid primary key default gen_random_uuid(),
    created_by       uuid not null references app_user(id) on delete cascade,
    is_deleted       boolean not null default false,
    created_at       timestamptz not null default now(),
    decided_on       date not null,
    decision_text    text not null,
    context_snapshot jsonb not null,          -- SERVER-side capture at write time (see W1.4)
    review_due       date not null,           -- default decided_on + mezo.companion.journal.decision-review-days
    reviewed_at      timestamptz,
    outcome_rating   smallint,                -- ck 1..5, null until reviewed
    outcome_text     text,
    constraint ck_decision_entry_outcome_rating check (outcome_rating is null or outcome_rating between 1 and 5)
);
create index idx_decision_entry_created_by_review_due on decision_entry (created_by, review_due);
```

### 4.2 W2 — graph tables

```sql
create table knowledge_node (
    id          uuid primary key default gen_random_uuid(),
    created_by  uuid not null references app_user(id) on delete cascade,
    is_deleted  boolean not null default false,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    kind        varchar(12) not null,   -- ck: PATTERN | PREFERENCE | GOAL | LIFE_EVENT | SEASON | INSIGHT
    title       varchar(120) not null,  -- short Hungarian label ("Késői evés rontja az alvást")
    summary     text,                   -- 1-3 sentence elaboration, prompt-renderable
    status      varchar(10) not null default 'active',  -- ck: candidate | active | archived
    source_kind varchar(20),            -- pattern | knowledge_fact | goal | extractor | profile | quarterly
    source_id   uuid,                   -- the source row; extractor candidates may carry null
    occurred_on date,                   -- LIFE_EVENT/SEASON anchor date (null otherwise)
    meta        jsonb                   -- kind-specific payload (typed envelope per kind)
);
create unique index uq_knowledge_node_source on knowledge_node (created_by, source_kind, source_id)
    where source_id is not null and is_deleted = false;   -- idempotent promotion anchor

create table knowledge_edge (
    id                 uuid primary key default gen_random_uuid(),
    created_by         uuid not null references app_user(id) on delete cascade,
    is_deleted         boolean not null default false,
    created_at         timestamptz not null default now(),
    from_node_id       uuid not null references knowledge_node(id) on delete cascade,
    to_node_id         uuid not null references knowledge_node(id) on delete cascade,
    kind               varchar(12) not null,  -- ck: TRIGGERS | PRECEDED_BY | SUPPORTS | CONFLICTS | RELATES_TO
    weight             numeric(4,3) not null default 0.500,  -- ck 0..1
    evidence           jsonb,                 -- typed: [{sourceKind, sourceId, note, at}]
    last_reinforced_at timestamptz,
    constraint uq_knowledge_edge_pair unique (created_by, from_node_id, to_node_id, kind)
);
create index idx_knowledge_edge_from on knowledge_edge (from_node_id);
create index idx_knowledge_edge_to   on knowledge_edge (to_node_id);
```

The **companion profile (W4.3)** is a `knowledge_node` of `kind=INSIGHT`,
`source_kind='profile'`, singleton per user — not a separate table.

### 4.3 W3 — consolidation table

```sql
create table period_summary (
    id           uuid primary key default gen_random_uuid(),
    created_by   uuid not null references app_user(id) on delete cascade,
    is_deleted   boolean not null default false,
    created_at   timestamptz not null default now(),
    granularity  varchar(5) not null,   -- ck: week | month
    period_start date not null,         -- ISO Monday / first of month
    summary_text text not null,
    constraint uq_period_summary unique (created_by, granularity, period_start)
);
```

`memory_embedding`'s kind check expands (one migration, W1.1 carries the first batch):
`chat_turn, daily_summary, weekly_summary, monthly_summary, journal_entry, reflection, gratitude,
decision, activity_note, checkin_note`. The `(kind, ref_id)` uniqueness and the single
`MemoryEmbeddingWriter` write path are unchanged — every new kind gets a `write<Kind>` method there,
NOT a second writer.

### 4.4 W4 — feedback table

```sql
create table message_feedback (
    id            uuid primary key default gen_random_uuid(),
    created_by    uuid not null references app_user(id) on delete cascade,
    is_deleted    boolean not null default false,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    artifact_kind varchar(20) not null,  -- ck: chat_message | feed_message | weekly_suggestion | memoir | prediction
    artifact_id   uuid not null,         -- the artifact row's id (memoir: the memoir row; feed: companion_message)
    verdict       varchar(4) not null,   -- ck: up | down
    reason        varchar(16),           -- ck: inaccurate | too_much | bad_timing | not_about_me (down only)
    constraint uq_message_feedback_artifact unique (created_by, artifact_kind, artifact_id),
    constraint ck_message_feedback_reason check (reason is null or verdict = 'down')
);
```

One **updatable** verdict per artifact: re-tapping the same verdict deletes the row (retraction),
tapping the other verdict updates it. Experiments/challenges are deliberately NOT artifact kinds —
their accept/dismiss decision endpoints already are the signal.

W4.2's rollups get their own small table (queryable, no schema churn on the profile):

```sql
create table feedback_rollup (
    id          uuid primary key default gen_random_uuid(),
    created_by  uuid not null references app_user(id) on delete cascade,
    is_deleted  boolean not null default false,
    created_at  timestamptz not null default now(),
    scope       varchar(40) not null,   -- 'surface:<artifact_kind>' | 'feed:<kind>' | 'intervention:<key>' | 'style'
    window_days int not null,
    stats       jsonb not null,         -- typed envelope: counts, ratios, reason histogram
    computed_at timestamptz not null,
    constraint uq_feedback_rollup_scope unique (created_by, scope, window_days)
);
```

### 4.5 W5 — flag audit

```sql
create table companion_flag_log (
    id         uuid primary key default gen_random_uuid(),
    created_by uuid not null references app_user(id) on delete cascade,
    is_deleted boolean not null default false,
    created_at timestamptz not null default now(),
    flag_key   varchar(24) not null,   -- ck: sustained_stress | sleep_debt | momentum_at_risk | recovery_needed | all_healthy
    source     varchar(6) not null,    -- ck: write | sweep
    payload    jsonb                   -- the evaluator's inputs frozen at raise time
);
create index idx_companion_flag_log_user_key_at on companion_flag_log (created_by, flag_key, created_at desc);
```

Interventions are **config, not DB** (§9.2). Cooldowns derive from this log + `push_log` dedup.

## 5. W1 — Narrative capture (slices .1–.5)

### 5.1 W1.1 Journal entity + embed pipeline (`mezo-b3pp.1`)

**Goal:** free-prose journal, captured anywhere in two taps, embedded into memory.

- **Backend:** `journal_entry` (§4.1) in a new `feature/journal` package (controller/service/
  repository/entity/mapper per `java_package_structure.md`). Contract-first
  `api/feature/journal/journal.yml`: `POST /api/journal` (text, occurredOn?, source),
  `GET /api/journal?from&to` (newest first, paged by month), `PUT /api/journal/{id}`,
  `DELETE /api/journal/{id}` (soft). Post-write embedding via a `JournalEntrySavedEvent` +
  `@Async AFTER_COMMIT` listener → `MemoryEmbeddingWriter.writeJournal(entry)`
  (`kind=journal_entry`, `ref_id=entry.id`, `occurred_on=entry.occurredOn`, content = raw text
  capped at embed-max-chars; edits re-embed via delete+insert on the `(kind, ref_id)` key).
  The kind-CK expansion migration (§4.3) rides in this slice.
- **FE:** QuickInputSheet's `naplo` tile becomes a two-option in-place phase: „Aktivitás" (existing
  `ActivityLogSheet`, XP path) and „Napló" (new `JournalSheet` — one textarea + optional date,
  voice input via the existing `useVoiceInput` hook). New Me sub-page `/me/naplo` (`JournalPage`) —
  month-grouped read view with edit/delete; Me sub-nav gains a „Napló" tab.
- **Config:** `mezo.feature.journal.enabled` (off ⇒ /api/journal 404s, no beans);
  `CompanionProperties.Journal` record starts here: `@Positive int decisionReviewDays` (default 30,
  used by W1.4) — journal itself needs no tuning values yet.
- **Docs:** `docs/features/journal.md` is born (10-section template).
- **Acceptance:** entry saved from QuickInput appears on `/me/naplo` and produces exactly one
  `memory_embedding(kind=journal_entry)` row; edit re-embeds; both switches honest when off.

### 5.2 W1.2 Evening prose reflection in Napzárás (`mezo-b3pp.2`)

**Goal:** the evening ritual asks — once, gently — "Milyen volt a napod valójában?".

- **Backend:** `ritual_day.reflection_text text` column (migration). The ritual contract's
  close/day DTOs gain `reflectionText` (nullable). A new `PUT /api/ritual/reflection`
  (date + text) upserts the ritual_day row *before* close — **this deliberately relaxes the
  "nothing writes before act 4" invariant**: the reflection write is an idempotent upsert on the
  `(created_by, ritual_date)` row and cannot conflict with the close (which only stamps
  `closed_at`). Embedding: on close (not on each keystroke-save), the close service triggers the embed —
  direct call or a new `RitualClosedEvent` + AFTER_COMMIT listener, the implementation plan's
  choice — with `kind=reflection`, `ref_id=ritual_day.id`.
- **FE:** the new **combined writing act** (decision: ONE act, both parts optional) inserts after
  DayStory: `ReflectionStep` — prose textarea on top, the W1.3 gratitude rows below (until W1.3
  lands, the gratitude half simply isn't rendered). `ACT_COUNT` 5→6; skip is one tap („Ma nem
  írok"), empty advance never penalized, nothing blocks the close.
- **Acceptance:** reflection typed in the ritual lands on ritual_day + one
  `memory_embedding(kind=reflection)` after close; skipping writes nothing; the 6-act flow's
  close still fires exactly once.

### 5.3 W1.3 Gratitude entries (`mezo-b3pp.3`)

**Goal:** 1–3 gratitude lines a day, streak-visible.

- **Backend:** `gratitude_entry` (§4.1), `feature/journal` package (same domain). Contract:
  `POST /api/journal/gratitude` (text ≤280, lifeArea?, occurredOn?), `GET .../gratitude?from&to`,
  `DELETE`. Embed `kind=gratitude` post-write (same listener pattern; short texts are fine —
  they carry disproportionate emotional signal).
- **FE:** the gratitude half of `ReflectionStep` (up to 3 rows, life-area chip from the 8 LIFE
  skills); also reachable in `JournalSheet` as a mode toggle. Me/Napló gets a small streak card
  ("hálanapló: N napos sorozat" — derived count, not materialized, the medals precedent).
- **Acceptance:** rows persist with life_area; streak card counts consecutive days; ≤280 enforced
  at contract AND column.

### 5.4 W1.4 Decision journal + review loop (`mezo-b3pp.4`)

**Goal:** decisions recorded with their context frozen, then revisited.

- **Backend:** `decision_entry` (§4.1). On `POST /api/journal/decision` the **server** captures
  `context_snapshot` by calling `ContextSnapshotAssembler.render(userId, today)` and storing it
  as a typed jsonb envelope `{snapshotText, capturedAt}` — the client never supplies it (the
  point is what the system knew, unfalsified). `review_due = decided_on + journal.decisionReviewDays`.
  Review: `PUT /api/journal/decision/{id}/review` (outcomeRating 1–5, outcomeText?) stamps
  `reviewed_at`. Embed on create (`kind=decision`, decision_text) and re-embed on review
  (decision_text + outcome — the outcome is the valuable half).
  **Notification:** new `NotificationCategory.DECISION_REVIEW` (`decision_review`, defaultEnabled,
  lead 0) — anchored on `review_due` date at a fixed morning slot; dispatcher work is enum + anchor
  resolver only (no migration).
- **FE:** capture in `JournalSheet` („Döntés" mode: decision text + review-horizon hint); Me/Napló
  lists open decisions with due chips; a due decision opens a review sheet (rating + outcome).
- **Acceptance:** snapshot captured server-side (IT asserts a client-supplied snapshot is ignored);
  review updates rating and re-embeds; due notification dispatched once (push_log dedup).

### 5.5 W1.5 Note-embedding catch-up (`mezo-b3pp.5`)

**Goal:** the narrative already being written elsewhere joins the memory.

- **Backend:** extend `DailySummaryJob`'s nightly pass (same job — one nightly narrative sweep,
  not a new cron): embed yesterday's `activity_log.text` rows (`kind=activity_note`) and
  `check_in.note` rows (`kind=checkin_note`) whose text length ≥ `mezo.companion.embedding
  .note-min-chars` (default 80 — a "tired" note carries no retrieval value). One-time backfill on
  first run via the catch-up window idiom (`findUnembedded…` repository methods, per-row isolation).
- **Acceptance:** length gate holds; idempotent re-runs; backfill embeds history without
  duplicates (`(kind, ref_id)` unique).

## 6. W2 — Knowledge graph (slices .6–.11) — behind the gate (§10)

### 6.1 W2.1 Graph tables + skeleton + ADR (`mezo-b3pp.6`)

- **ADR:** "Knowledge graph is Postgres-native" — nodes/edges as plain tables, traversal via
  recursive CTE, no graph DB / no pgRouting; rationale: single-user scale (hundreds of nodes),
  everything stays in one backup/consistency domain. Alternatives (Neo4j, AGE) rejected for infra
  weight.
- **Backend:** §4.2 tables in `feature/companion/graph/` sub-package; `GraphService` CRUD +
  `GraphNodeResponse`/`GraphEdgeResponse` contract fragments (read-only list + archive action for
  W2.6; candidates confirm in W2.3). Switch `mezo.feature.knowledge-graph.enabled`
  (`FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH`) — off ⇒ no graph beans, graph API 404s, every
  graph hook elsewhere (W3.1 block, W4.2 reinforcement) silently absent. Tuning record
  `CompanionProperties.Graph`: `maxHops (1..3, default 2)`, `topK (1..20, default 8)`,
  `decayFactor (0.9..1, default 0.99)`, `pruneFloor (0..1, default 0.05)`,
  `renderMaxTokens (default 800)`.
- **Acceptance:** CRUD ITs; switch-off IT (no beans); ADR committed.

### 6.2 W2.2 Promotion pipelines (`mezo-b3pp.7`)

**Goal:** existing knowledge flows into the graph idempotently.

- Confirmed `pattern` → `PATTERN` node (title = pattern title, meta = {r, n, direction});
  a cheap-LLM **edge structurer** proposes edges from the new node to existing nodes (prompt:
  node titles list + the new pattern; output: typed edge suggestions with kind+confidence;
  suggestions below confidence floor dropped, others created at `weight = confidence × 0.5` —
  edges start humble, reinforcement raises them).
- `knowledge_fact` (active AND prompt-included, i.e. `include_in_prompt=true` — `mezo-b3pp.30`
  closed the open question of whether an opted-out fact should still shadow into the graph; it
  must not, since `GraphPromptAssembler` renders graph nodes into the same system prompt the
  `include_in_prompt` flag already gates) → `PREFERENCE` node; `goal` (active) → `GOAL` node (sync
  on the goal service's write path + nightly reconciliation).
- All UPSERT by `(created_by, source_kind, source_id)` (§4.2 unique index); re-promotion updates
  title/meta, never duplicates. Runs: hook on `PatternService.decide` confirm path +
  `FactCandidateService.promote` + nightly reconciler inside the graph maintenance job (W2.5).
- **Acceptance:** confirming a pattern creates exactly one node + only floor-passing edges;
  re-confirm is a no-op; fact/goal sync idempotent.

### 6.3 W2.3 LifeEventExtractor + confirm inbox (`mezo-b3pp.8`)

- Nightly cheap-LLM pass (inside the graph maintenance job's schedule, but a separate
  `LifeEventExtractionService`) over yesterday's `journal_entry` + `ritual_day.reflection_text` +
  `daily_summary` → 0–N `LIFE_EVENT` **candidates** (`knowledge_node.status=candidate`,
  `source_kind=extractor`, occurred_on set) with proposed `PRECEDED_BY`/`TRIGGERS` edges kept in
  `meta` until confirm.
- **L2 inbox:** the KnowledgeListPage candidates section (fact-candidate precedent) gains a
  "Életesemény-jelöltek" group: Elfogad (→ status=active + create the proposed edges) / Elvet
  (→ soft-delete). Never auto-active.
- **Acceptance:** extraction only proposes; confirm activates node+edges; reject leaves no residue;
  a night with no narrative produces no candidates (and no LLM call — emptiness gate).

### 6.4 W2.4 Graph traversal + ÖSSZEFÜGGÉSEK prompt block (`mezo-b3pp.9`)

- `GraphTraversalService.neighborhood(userId, seedNodeIds, maxHops, topK)` — one recursive CTE,
  weight-ordered, cycle-safe, ≤2 hops default. Seed selection: match node titles/summaries against
  the turn's domain keywords (the snapshot's active domains + user-message tokens via the
  `ToolText.fold` idiom) — deterministic, no LLM.
- Hungarian renderer → `[Összefüggések]` block (~500–800 tokens, `graph.renderMaxTokens`),
  inserted into the prompt between the facts block and TONE_REMINDER, **only when the graph switch
  is on**. Rendered edges add refs (`kind=GraphNode, id=node.id`) via `ToolCallAudit`.
- **Acceptance:** traversal IT on a seeded 3-hop chain returns ≤2-hop neighborhood in weight
  order; prompt IT shows the block present with switch on / absent off; refs recorded.

### 6.5 W2.5 Graph maintenance job (`mezo-b3pp.10`)

- Nightly `GraphMaintenanceJob` (`mezo.techcore.cron.graph-maintenance-job.enabled`, cron
  `mezo.companion.graph.cron`, dawn slot): edge `weight ×= decayFactor` daily; **candidate**
  nodes older than 30 days pruned (soft-delete); edges under `pruneFloor` soft-deleted;
  reinforcement bumps: fresh pattern evidence (a `pattern_event` LIVE snapshot for a promoted
  pattern) bumps its node's edges `+0.05` capped at 1.0, stamping `last_reinforced_at`. Also
  hosts the W2.2 nightly reconciler + W2.3 extraction (three phases, per-phase isolation).
- **Acceptance:** decay, floor-prune, reinforcement each pinned by IT; active nodes never pruned.

### 6.6 W2.6 Tudástár Kapcsolatok surface (`mezo-b3pp.11`)

- Me→Tudás page (`KnowledgePage`) gains a „Kapcsolatok" section: active nodes grouped by kind,
  each with its strongest edges as text lines („Késői evés → rontja → Alvásminőség · erős");
  archive action per node (L2 control, `PUT /api/companion/graph/node/{id}/archive`). No graph
  *visualization* — that stays parked in `mezo-2m4`.
- **Acceptance:** grouped render from live data; archive hides from prompt traversal immediately.

## 7. W3 — Recall & consolidation (slices .12–.14)

### 7.1 W3.1 Prompt assembly v2 — always-on recall (`mezo-b3pp.12`)

**Ships graph-independently (before the gate).**

- New `PromptMemoryAssembler` (companion.service): given userId + the incoming user message,
  embeds the message once (`embedQuery`, `LlmCallContext("companion_chat","recall_embed",…)`),
  runs per-kind ANN queries with **per-kind caps** (config record `CompanionProperties.AmbientRecall` (yml: `mezo.companion.ambient-recall.*`):
  `capDailySummary=2, capJournal=2, capChatTurn=1, capOther=1`, per-kind `minSimilarity`
  defaults 0.55, recency decay τ reused from existing recall), dedupes against the snapshot's
  day and each other by `(kind, ref_id)`, renders an `[Emlékek]` block (each item: date + one-line
  summary + kind tag), hard-capped at `ambient-recall.max-tokens` (default 1200 of the ~6k memory budget).
- ChatService order becomes: voice → snapshot → facts → pattern-ack → **[Emlékek]** →
  **[Összefüggések (if graph on)]** → TONE_REMINDER. The `find_similar_past_days` tool stays (deep,
  targeted recall on demand; the block is broad ambient recall).
- Failure honesty: embed/ANN failure ⇒ block omitted + `degraded=false` (the turn itself is fine);
  log-and-continue. Every recalled item adds a `Memory` ref.
- **Acceptance:** IT with fake embeddings shows relevant journal+summary lines in the prompt under
  caps; failure path omits block without failing the turn; token cap enforced.

### 7.2 W3.2 Consolidation ladder (`mezo-b3pp.13`)

- `period_summary` (§4.3). Weekly job (Monday dawn, after daily summaries): cheap-LLM condenses
  the week's `daily_summary` rows → `granularity=week` row + embed (`kind=weekly_summary` — the CK
  already allows it). Monthly (1st): condenses the month's weekly rows → `monthly_summary` + embed.
  Backfill both from existing history on first run.
- **Recall shadowing, nothing deleted:** `PromptMemoryAssembler` applies a coverage filter — a
  `daily_summary` hit older than `ambient-recall.weekly-shadow-days` (default 30) is replaced by its
  covering weekly row (fine rows stay in the store; ANN metadata filter `occurred_on >= cutoff`
  on the daily-kind query + unrestricted weekly/monthly queries).
- **Acceptance:** ladder rows generated + embedded idempotently; old fine-grained hits shadowed by
  weekly rows in the assembler IT; nothing deleted.

### 7.3 W3.3 Recall tuning pass (`mezo-b3pp.14`)

- Per-kind `minSimilarity`/decay τ moved fully into config (no hardcoded numbers); a
  **deterministic eval harness** IT: seeded fake-port embedding fixtures (hand-crafted vectors)
  + a table of (query, expected-top-hits) — the regression net for future tuning; recall embed
  calls tagged so `/me/ai-usage` can show recall's cost share (`operation=recall_embed`).
- **Acceptance:** eval harness green and readable as a tuning table; config-only tuning verified.

## 8. W4 — Feedback → profile (slices .15–.17)

### 8.1 W4.1 Feedback capture on all AI surfaces (`mezo-b3pp.15`) — **ships first**

- **Backend:** `message_feedback` (§4.4) in `feature/companion/feedback/`. Contract
  `api/feature/companion-feedback/`: `PUT /api/companion/feedback` upsert
  `{artifactKind, artifactId, verdict, reason?}` (re-tap same verdict ⇒ `DELETE
  /api/companion/feedback/{kind}/{id}`); `GET /api/companion/feedback?kind&ids` batch-read for
  page hydration. Validation: artifact existence NOT checked cross-table (kinds span 5 tables;
  a dangling id is harmless single-user), `reason` only with `down` (ck + contract).
  Switch: rides `mezo.feature.companion.enabled` (no own switch — it is a companion organ).
- **FE:** one shared `FeedbackChips` component (`features/insights/components/`): 👍/👎, on 👎 a
  four-chip reason row expands (pontatlan · túl sok · rossz időzítés · nem rólam szól); optimistic
  update, `useFeedback(kind, ids)` hook per house data conventions. Mounted on: chat assistant
  messages (ChatPage), companion-feed cards (Today feed), weekly-suggestion card (WeeklyPage),
  memoir (MemoirPage — replacing the mock reaction row entirely, **live-mode rendered**, closes
  `mezo-kr9v`), prediction cards (PredictionsPage).
- **Acceptance:** verdict upsert/retract round-trips on every surface in both FE modes; one row
  per artifact enforced; memoir mock reactions gone.

### 8.2 W4.2 Feedback learning loops (`mezo-b3pp.16`) — two layers

- **Rollup layer (graph-independent, ships with the early wave):** nightly
  `FeedbackLearningService` (inside the existing dawn window, own cron switch
  `feedback-learning-job`): pure-code aggregation into two artifacts — (a) **per-surface
  effectiveness rollups** (last-30-day up/down/total per artifact_kind + per feed kind), (b)
  **style stats** (👎-reason histogram per surface). Stored in the `feedback_rollup` table
  (§4.4) — cheap, queryable, no schema churn. Consumers: W4.3 profile, W5.2 intervention
  weighting, and the
  proactive generators (a surface whose 30-day rollup is strongly negative lowers its generation
  frequency — read-side only in this slice, generator changes documented as hooks).
- **Reinforcement layer (activates only when W2 is live):** a 👍 on a chat message walks its
  `ai_message.refs`; refs resolving to graph nodes (`GraphNode` kind from W2.4) bump the node's
  edges +0.02; 👎 applies −0.02. Guarded by the graph switch; no-op without it.
- **Acceptance:** rollups correct on seeded verdicts; reinforcement IT under graph-on, no-op
  under graph-off.

### 8.3 W4.3 Pragmatic profile node + injection (`mezo-b3pp.17`)

- `ProfileAssembler` (weekly, smart tier): distills feedback rollups + style stats + reviewed
  `decision_entry` outcomes (+ RECOVERY-related graph nodes when W2 live) into a compact Hungarian
  profile („Danielnél a rövid, konkrét reggeli üzenet válik be; a hosszú elemzést délben olvassa;
  a bőséges tippeket elutasítja…") — upserted as the singleton `INSIGHT` node
  (`source_kind='profile'`). Prompt: a `[Rólad tanultam]` block (≤400 tokens) after the facts
  block. Tudástár: the profile node rendered read-only with an archive control (archiving empties
  the prompt block until the next weekly run — an explicit "reset what you think of me" lever).
- **Acceptance:** profile regenerates weekly + after-archive; injection capped; visible in Tudástár.

## 9. W5 — JITAI-lite (slices .18–.20)

### 9.1 W5.1 Composite flag evaluator (`mezo-b3pp.18`)

- Deterministic, **LLM-free** `FlagEvaluator` (companion.service): rule set over recent biometrics —
  `sustained_stress` (check-in stress ≥ threshold on ≥3 of last 4 days), `sleep_debt` (cumulative
  deficit vs sleep goal over 3 nights), `momentum_at_risk` (habit/quest completion drop +
  missed gym day), `recovery_needed` (poor sleep + high RPE + high stress same 48h),
  `all_healthy` (none of the above for 7 days). Thresholds all in a
  `CompanionProperties.Flags` record — config, never code.
- Triggers: **on-write** — new `CheckInSavedEvent` published by `CheckInService.save` (the gap §3
  names) + existing sleep event, consumed by an AFTER_COMMIT listener; plus an **hourly sweep**
  (cron switch `flag-sweep-job`) for windows crossed by time alone. A raise writes
  `companion_flag_log` (§4.5) with the evaluator's inputs frozen in payload; a flag re-raises only
  after its per-flag cooldown (§9.2).
- **Acceptance:** each rule pinned by IT (boundary cases); on-write and sweep raise identically;
  log payload reproduces the inputs.

### 9.2 W5.2 Event-driven interventions (`mezo-b3pp.19`)

- **Intervention library = config** (`mezo.companion.interventions` list in application.yml):
  each entry `{key, flag, channel (feed|push|both), textHu, cooldownHours, quietHoursExempt:false}`.
  Selection: for a raised flag, pick the library entry whose W4.2 rollup effectiveness (by
  intervention key, from the „Segített?" loop) is highest; unseen entries get optimistic default.
- **Delivery:** a `companion_message` feed card (new kind `intervention` — CK migration) and/or a
  push via new `NotificationCategory.INTERVENTION`; **quiet hours arrive here**:
  `mezo.notification.quiet-hours` (`start`/`end` LocalTime, default 22:00–07:00) — the dispatcher
  defers (not drops) non-exempt intervention pushes to quiet-hours end. Per-flag cooldown from
  `companion_flag_log` + push_log dedup.
- **Closing the loop:** the intervention card carries a „Segített?" chip pair — writes
  `message_feedback(artifact_kind=feed_message)` with the intervention key in the card's content
  jsonb (W4.2 rolls it up per-intervention).
- **Acceptance:** flag → best-weighted intervention → feed+push inside allowed hours; quiet-hours
  deferral IT; cooldown blocks a re-fire; „Segített?" lands in message_feedback.

### 9.3 W5.3 Quarterly deep pass (`mezo-b3pp.20`)

- Quarterly smart-tier job (cron switch `quarterly-review-job`): season-over-season comparison
  (this quarter's period_summaries + rollups vs previous) → 0–N `SEASON` node **candidates** into
  the L2 inbox; decision-quality observations (reviewed `decision_entry` outcomes trend) appended
  to the profile input; re-runs `ProfileAssembler`. New chat tool `compare_periods(periodA,
  periodB)` (reads period_summary + rollups; refs accordingly; registered in the
  `[Eszköz-útmutató]` routing table per `companion_tool_conventions.md`).
- **Acceptance:** quarterly run produces candidates not actives; compare_periods renders an honest
  "nincs adat" for missing periods.

## 10. Execution order & the graph gate

Decided 2026-08-18 (value-first; feedback data compounds with time, the graph is the heaviest and
most speculative third of the phase):

```
1. W4.1 (.15)  feedback capture            ← first: every week without it is lost signal
2. W1.1 (.1) → W1.2 (.2) → W1.3 (.3) → W1.4 (.4) → W1.5 (.5)
3. W4.2 (.16)  rollup layer only
4. W3.1 (.12)  always-on recall, graph-independent
   ── ★ GRAPH GATE ─ new bd decision task; inputs: does recall+journal already give the
      "ismer engem" feeling? Is the fact list's flatness actually felt as a limit?
      Outcome A (build): 5. W2.1 → W2.2 → {W2.3, W2.4, W2.5} → W2.6 + W4.2 reinforcement layer
      Outcome B (defer): W2 slices stay open in bd, order continues below; every graph hook
      (prompt block, reinforcement, RECOVERY profile input) is switch-guarded and simply stays off.
6. W3.2 (.13) → W3.3 (.14)
7. W4.3 (.17)  profile (richer with graph, works without)
8. W5.1 (.18) → W5.2 (.19) → W5.3 (.20)
```

bd dependency adjustments this spec mandates: `.16` drops its dependency on `.10` (the
reinforcement layer is switch-guarded, not order-blocked); `.12` drops its dependency on `.9`
(same); `.20` keeps `.13` + `.17`, drops `.4` (reviewed decisions enrich but must not block).
A new bd task represents the gate itself, blocking `.6`.

## 11. Cross-cutting conventions (bind every slice)

- Contract-first (`api/feature/...` fragment before code); backend implements generated `<Tag>Api`;
  FE types regenerate; never hand-written boundary DTOs.
- Every LLM/embed call tagged with `LlmCallContextHolder.runWith(...)` — new features:
  `journal` (embed listeners), `companion_graph` (structurer, extractor), `companion_feedback`
  (none — pure code), `companion_recall` (recall_embed), `proactive_intervention`.
- Cheap tier (`chat-model`) for nightly extraction/structuring; smart tier only for
  weekly/quarterly synthesis (profile, quarterly pass) — the Phase 4 tiering precedent.
- New crons all in the dawn dead zones (02:20–03:40 occupied: check `application.yml` before
  picking; 03:10/03:20/03:50 free as of this writing) with techcore switches + SwitchOffITs.
- Integration-first tests; new domain tables → `ResetDatabase` truncate list + populators
  (`JournalPopulator`, `GraphPopulator`, `FeedbackPopulator`, `FlagLogPopulator`).
- Feature docs in the same change: `journal.md` born (W1.1); `companion.md` (§ per workstream),
  `insights.md`, `me.md`, `_platform-notifications.md` (new categories, quiet hours) updated as
  touched; `node scripts/lint-docs.mjs` after every docs touch.
- Frontend: `docs/references/frontend_conventions.md` binds; new pages are `*Page` under
  `features/me|insights/pages`; data hooks via `@/data/hooks` barrel only; dual-mode
  (`useDualQuery`) with honest mock seeds for every new surface.

## 12. Out of scope / deferred

- Graph **visualization** (`mezo-2m4` stays parked; W2.6 is text-only).
- Voice/photo journal attachments; journal search (revisit after W3 ships).
- Crisis/drift detection, AnchorMode, opportunity scanner (old-docs concepts — still later epics).
- Multi-user generalization of flags/interventions (single-user assumptions are fine and named).
- Any deletion of fine-grained memory rows (consolidation shadows, never deletes).
