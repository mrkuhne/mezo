# 07 — RAG / long-term memory audit

Mapper area: memory engine (embeddings, retrieval, write-back, curation), issue `mezo-r36n9.9`. Date 2026-11-10.
Production checked read-only (shape/volume only).

## TL;DR

1. **This is real RAG in its design**: a hybrid retrieval engine with four parallel retrievers (pgvector HNSW dense, Postgres FTS + trigram lexical, knowledge facts, a 2-hop knowledge graph), weighted RRF fusion, small deterministic boosts, a token-budget selector, an optional LLM rewrite/rerank, per-consumer policies and a full audit trail. On paper it is well above typical hobby RAG.
2. **In production it is mostly broken right now.** Every document embedding has failed since **2026-10-21** (Gemini `ClientException`, 137 failures, 0 successes). Nothing new has gone into the vector store since 2026-10-19. Query embeddings fail too: 1 success in November against 67+ errors. The likely cause is the Google key, billing or quota lapsing after chat moved to OpenAI (last Gemini chat success 2026-10-16). Not confirmed: the error text is not logged.
3. **All 194 audited retrieval runs in the 30-day window are `PARTIAL_FAILURE`.** Dense failed or was skipped in 117 of 194. Lexical **timed out in 186 of 194** (the 200 ms budget). Facts timed out in 113 of 194. Only the graph retriever ran every time. In practice "RAG" today means graph edges, plus facts when they finish in time.
4. Monitoring cannot see this. A failed embed throws before any `memory_vector` row exists, so there are 0 "failed" vectors and the `memory_stuck` alert stays green. Daily summaries are still written, so `job_missed` stays green too.
5. **Chat barely uses RAG.** The conversation-first path (`conversation.enabled: true`) skips ambient retrieval completely (`ChatService.java:517-520`). Memory reaches chat only through the `search_personal_memory` tool, called **once ever** in production. Chat gets its "memory" by stuffing: all confirmed facts, the profile, a snapshot and the history window.
6. **The real consumers are 14 offline/proactive LLM surfaces**: morning feed, predictions, challenges, experiments, weekly review/memoir/suggestions, character, profile, quarterly, person/life-event extraction, reflection, quick notice. Each gets a `[Hosszú távú memória]` block through `MemoryContextBlock`. Their "queries" are 250–2000-char data dumps. That is a poor query shape, and it is a likely cause of the lexical timeouts. The 8 lexical runs that did succeed returned 0 hits.
7. The corpus is small and narrow: 203 items for one user. Sources are chat turns, daily, weekly and monthly summaries, check-in notes, gratitude, journal, reflection, decisions, and activity/character notes. **No meal, recipe, workout or biomarker rows are embedded.** Chunking is a fixed 2000 chars with no overlap. Title, topics, people and salience are never filled (constant 0.5), so three fusion modifiers do nothing.
8. Write-back is rich and alive: nightly daily summaries, a weekly/monthly consolidation ladder, a fact-candidate inbox → `knowledge_fact` (84 live), patterns (75), a knowledge graph (103 nodes / 79 edges), and a learned profile. Curation is good on paper (forget/mute/veto, weekly fact merge, graph decay/prune, 30-day audit purge), but the fact merge has run 0 times and no veto rows exist.
9. Long-term effects (core 3): `effect_link` covers only people/events → mood/energy/stress, and it has **0 live rows**. The Pearson pattern catalog has no recipe- or ingredient-level metric and no wearable metric (HRV, RHR). Measuring the effect of foods on biomarkers does not exist.
10. For Boop: the backend engine is reusable as a service, but it needs (a) the embedding provider fixed or moved to OpenAI, plus a re-embed run, (b) short natural-language queries instead of context dumps, (c) the retriever budget and the lexical query fixed, and (d) Apple Health and meal data in the corpus. The Boop morning brief (`feature/boop`) uses **no memory at all** today.

---

## 1. Scope

What I covered: the unified memory platform (`feature/companion/memory/**`), the legacy pgvector path (`memory_embedding`, `PromptMemoryAssembler`, recall tools), embedding writers and listeners, chat prompt assembly, every `MemoryContextBlock` / `MemoryContextService` consumer, write-back jobs (summaries, consolidation, facts, graph, profile, patterns, effects), curation and retention, config and the k8s overrides, and the production DB and LLM log.

Entry points:
- `docs/features/companion.md` §"Backend tables (shared RAG foundation)" (l.4441+), plus the graph and consolidation sections
- `docs/features/admin-memory-explorer.md`
- `backend/src/main/resources/application.yml:997-1330`
- `k8s/backend/deployment.yaml:108-140`

## 2. What exists

### 2.1 Storage

| Table | Role | Index | Prod rows (live) | Last write |
|---|---|---|---|---|
| `memory_embedding` (legacy, `202607032033_…pgvector.sql`) | one 768-d vector per `(kind, ref_id)`, prefix capped at 2000 chars | HNSW cosine (`…pgvector.sql:30`) | 192 | 2026-10-19 |
| `memory_item` (`202609041020_mezo-6dii.1_memory_platform.sql`) | canonical projection per `(owner, source_kind, source_id, chunk_index)`, sha256 hash, `search_vector` tsvector, `search_text` | GIN FTS + GIN trigram (`:53-54`) | 202 active | 2026-10-19 |
| `memory_vector` | one row per `(item, embedding_version)`, status pending/ready/failed | partial HNSW cosine (`:87-88`) | 202 ready, 0 failed | 2026-10-19 |
| `memory_retrieval_run` / `_result` / `_feedback` | audit of query → ranked candidates → user feedback; 30-day purge | — | 194 runs (2026-10-11 → today), 4 264 results, **0 feedback** | today |
| `knowledge_fact` | confirmed facts (pinned, validity, superseded, conflicts, owner = team member, mute) | — | 84 in prompt, 0 pinned | 2026-11-04 |
| `learned_fact` | fact candidates (inbox) | — | 40 | 2026-11-09 |
| `daily_summary` / `period_summary` | nightly narrative and the weekly/monthly ladder | — | 55 / 13 | today / 2026-11-09 |
| `knowledge_node` / `knowledge_edge` | graph (PATTERN, PREFERENCE, LIFE_EVENT, PERSON, GOAL, SEASON, INSIGHT) | — | 103 / 79 | 2026-11-03 |
| `pattern` / `pattern_event` | statistical + reflection + AI hypotheses with a belief lifecycle | — | 75 | today |
| `effect_link`, `effect_mute` | named-effect cache (person/event → mood/energy/stress) | — | 5 rows, **0 live** | 2026-10-12 |
| `text_signal` | LLM-extracted mood/energy/stress from prose | — | 37 | 2026-11-02 |
| `memory_forget_veto`, `fact_merge_ledger` | curation | — | 0 / 0 | — |

Embedded corpus in prod, by kind (live items): chat_turn 76 (chunks up to index 3), daily_summary 50, checkin_note 35, gratitude 16, weekly_summary 8, reflection 7, journal_entry 7, monthly_summary 2, activity_note 1, character_reply 1. **One user only.**

### 2.2 Embedding

- Model: **Google `gemini-embedding-001`, 768 dims**, L2-normalised. It uses task types `RETRIEVAL_DOCUMENT` / `RETRIEVAL_QUERY` correctly (`companion/llm/GeminiEmbeddingAdapter.java:30-31,55-56`; port `companion/EmbeddingPort.java:24`). The version tag is `gemini-embedding-001-768-v1` (`application.yml:1088`).
- Writers (event listeners → `embedding/MemoryEmbeddingWriter.java`):
  - daily summary (`:35`), chat turn as user+assistant pair (`:62`), journal (`:109`), gratitude (`:124`), decision with its outcome (`:144`), ritual reflection (`:157`), weekly/monthly summary (`:180`), activity and check-in notes via a nightly sync (`:217`, `NoteEmbeddingCatchUp`).
  - Listeners: `JournalEmbeddingListener`, `GratitudeEmbeddingListener`, `DecisionEmbeddingListener`, `ReflectionEmbeddingListener`, `TurnEmbeddingListener`, and `character/service/CharacterReplyMemorySource`.
- The legacy row is written first. After commit, an event dual-writes the canonical projection (`memory/service/MemoryProjectionListener.java:17-35`).
- Chunking happens in `MemoryProjectionWriter.upsert` (`memory/service/MemoryProjectionWriter.java`): it splits at `embed-max-chars` = 2000 (`application.yml:1005`) on a word boundary, with **no overlap** (`MemoryChunkText.end`). Chunk 0 reuses the legacy vector; further chunks are embedded separately. The writer skips re-embedding when content is unchanged (hash check).
- **Dead metadata.** Every projection sets `title=null`, `topics=[]`, `people=[]`, `salience=0.5` (`MemoryEmbeddingWriter.java:306-311`). The fusion salience modifier is therefore always 0, the label falls back to `source_kind`, and topic/people filtering is impossible.
- The re-embedding job exists (`MemoryReembeddingService/Job`) but is off (`application.yml:1106`).

### 2.3 Retrieval pipeline (`memory/service/MemoryContextService.java`)

1. **Query routing** (`MemoryQueryAnalyzer.java:34-57`). A deterministic Hungarian phrase list returns `NO_MEMORY_NEEDED` ("szia", "köszi"…). Short referential follow-ups become `CONTEXT_DEPENDENT`; everything else is `SELF_CONTAINED`. ISO dates in the query become a from/to window.
2. **Rewrite**: an LLM rewrite runs only for `CONTEXT_DEPENDENT` chat queries (`MemoryQueryPreparer.java:41`, `LlmMemoryQueryRewriter`). All 194 prod runs were `RAW`, so it has never run in the window.
3. **Query embedding**: one network hop before fan-out, 2.5 s timeout (`MemoryContextService.java:295`; `application.yml:1143`).
4. **Four retrievers in parallel**, each with a **200 ms DB deadline** (`MemoryContextService.java:302-404`; `application.yml:1139`), each with candidate limit = policy limit (10–30):
   - `dense`: pgvector `<=>` cosine over ready vectors of the serving version. Filters: owner, hash match, active, validity window, `occurred_on <= asOf`, source visibility, optionally excludes the current conversation, kind scope (`memory/repository/DenseMemoryQuery.java`). If there is no embedding it throws, by design, so the outage is visible (`DenseMemoryRetriever.java:42`).
   - `lexical`: `ts_rank_cd(websearch_to_tsquery('simple', q))` + 0.25 × max(trigram `similarity`, `word_similarity`), with `score > 0` (`memory/repository/LexicalMemoryQuery.java`).
   - `facts`: the same FTS + trigram scoring over `knowledge_fact`, pinned first, conflict pairs attached (`KnowledgeFactRetrievalQuery.java:16-54`).
   - `graph`: title/summary seed match → 2-hop neighbourhood, top-k 8 edges, decayed weights (`GraphMemoryRetriever.java`; `application.yml:1279+`).
5. **Fusion**: weighted RRF (k = 60, all weights 1.0) plus bounded boosts for temporal match, salience, source reliability (fact 1.0 > journal/summary 0.75 > edge 0.6 > other 0.5), pinned, and recency (`MemoryCandidateFusion.java`). A SIMILAR_DAYS-only cosine floor of 0.25 applies (`MemoryContextService.java:260-272`); REFLECTION has a 90-day window (`:224-246`).
6. **Selection**: token-budget selector with diversity grouping by conversation (`MemoryContextSelector.java`).
7. **Rerank**: an LLM reranker (`LlmMemoryReranker.java:61-85`), **globally disabled** (`reranker.enabled: false`, `application.yml:1146`). The per-policy `rerank: true` flags therefore do nothing.
8. **Render** a `[Hosszú távú memória]` block with old-memory indicators and a partial-failure notice (`MemoryContextRenderer`, `MemoryContextService.java:209-212`). Refs and recall disclosures go back to the UI.
9. **Audit**: every run is written to `memory_retrieval_run/result` (`MemoryRetrievalAuditWriter`); the shadow runner and admin replay sit on top.

Serving modes: `OLD | SHADOW | NEW`. The yml default is `SHADOW` (`application.yml:1096`); **production sets `NEW`** (`k8s/backend/deployment.yaml:138-139`).

### 2.4 Who actually uses retrieved chunks (call sites)

**Chat** (`companion/service/ChatService.java`)
- With `conversation.enabled=true` (prod, `application.yml:896`), `routeAndAssemble` returns `ChatMemoryPayload.empty()` and **never calls retrieval** (`ChatService.java:517-520`).
- The prompt gets `personalContextAssembler.render`, the full facts list and the memory-honesty blocks (`ChatService.java:533-544`).
- Retrieval reaches chat only through the tool `search_personal_memory` (`tools/ConversationContextTools.java:67-86` → `PersonalMemorySearchService` → `ChatMemoryContextAdapter.resolve` → `retrieveForServing`, `ChatMemoryContextAdapter.java:60-74`).
- The tools `find_similar_past_days` (`tools/MemoryTools.java:63`, via `SimilarDaysRecall.java:71` `retrieveOrFail`) and `compare_periods` also exist.
- The legacy gear path (`ChatService.java:521-529`, ambient `[Emlékek]` + graph block) only runs if conversation-first is switched off.

**Proactive feed tool**: `search_personal_memory` in `tools/FeedContextTools.java:22-35`.

**Context-block consumers** (`MemoryContextBlock.render`, `memory/service/MemoryContextBlock.java:67-86`, fail-open):

| Policy | Call site |
|---|---|
| MORNING_BRIEFING | `proactive/service/CompanionMessageGenerator.java:342,471,541,607` (query = first 400 chars of the snapshot + plan line, `:340`) · `proactive/service/FeedContextAssembler.java:45` |
| PREDICTION_EVIDENCE | `PredictionGenerator.java:231` · `ChallengeGenerator.java:258` · `ExperimentProposalGenerator.java:211` · `FatigueEvidenceCollector.java:209` |
| WEEKLY_MEMOIR | `MemoirGenerator.java:331` · `WeeklyReviewGenerator.java:371` · `WeeklySuggestionGenerator.java:164` |
| CHARACTER_EVIDENCE | `character/service/CharacterBootstrapService.java:196` · `CharacterMonthlyService.java:251` · `companion/profile/service/ProfileAssembler.java:324` · `companion/quarterly/service/QuarterlyReviewService.java:242` |
| EXTRACTION | `companion/service/PersonExtractionService.java:555` · `companion/graph/service/LifeEventExtractionService.java:248` |
| REFLECTION | `companion/reflection/service/ReflectionMemoryGateway.java:40`, used by `HypothesisPipelineService.java:505-519` (query = yesterday's digest or the evidence dump, capped at 2000 chars) and `QuickNoticeService.java:270` (query = the journal text) |
| (admin) | `admin/service/AdminMemoryReplayService.java:97` (dry run) |

**Not using memory**: the Boop morning brief (`feature/boop/service/*`). It has no `MemoryContextBlock`, no facts and no summaries; it only reads proposed patterns (`BoopDayAssembler.java:334-350`).

### 2.5 Write-back (memory formation)

- **Daily summary**: `DailySummaryJob` at 02:20 with 7-day self-heal (`service/DailySummaryJob.java:56`). It writes a narrative and embeds it.
- **Consolidation ladder**: `ConsolidationJob` weekly Mon 03:30 and monthly on the 1st (`service/ConsolidationJob.java:48,67`). It writes `period_summary` and embeds it. Daily summaries older than 30 days are "shadowed" by their rung (`ambient-recall.weekly-shadow-days`).
- **Facts**: `FactExtractionListener/Service` turns chat turns into `learned_fact` candidates. User confirmation promotes them to `knowledge_fact`. Pattern, weekly-review and person-fact promotion also feed `knowledge_fact`. Prod sources: pattern 52, chat 17, weekly_review 14, person_fact 2.
- **Fact merge**: weekly Monday (`service/merge/FactMergeJob`), auto-merges repetitions. **0 ledger rows** in prod.
- **Graph**: promotion listeners plus life-event extraction; `GraphMaintenanceJob` at 03:20 decays (0.99), prunes (<0.05) and drops stale candidates after 30 days.
- **Profile**: `ProfileAssemblerJob` → the "[Rólad tanultam]" pragmatic profile, injected via `PersonalContextAssembler`.
- **Patterns**: nightly Pearson pair catalog (`PatternDetectionService`), plus reflection hypotheses with a deterministic belief (`HypothesisEvaluationService`), plus a quarterly drift recheck.
- **Named effects**: `EffectLinkService` (Cliff's delta, person/event → mental/energy/stress).
- **Text signals**: LLM mood/energy/stress per journal or gratitude entry.

### 2.6 Curation / expiry

- **Forget**: "ezt ne jegyezd meg" blocks extraction, embedding and recall (`ChatForgetService`, `MemoryEmbeddingWriter.java:73-78`).
- **Suppress/mute**: retrieval feedback `useful|irrelevant|suppress` (2 endpoints, `memory/controller/MemoryRetrievalController.java:25,30`). Fact mute; pattern `forgotten`; `memory_forget_veto` blocks re-proposal.
- **Delete propagation**: deleting a source soft-deletes its legacy vector and suppresses the canonical item (`MemoryEmbeddingWriter.java:300-304`, `MemoryProjectionWriter.suppress`).
- **Validity**: `valid_from/to`, `superseded_by`, `conflicts_with` on items and facts. Retrievers honour them, but nothing writes validity on `memory_item` today.
- **Retention**: retrieval audit is hard-deleted after 30 days (03:50). LLM payloads are scrubbed after 90 days. Source memories are never expired; old ones are only labelled "régi" after 365 days.
- There is no salience learning: the feedback table is empty and the `salience` column is constant.

## 3. How it works end to end (today, in production)

```
journal / check-in note / chat turn / nightly summary
   └─► MemoryEmbeddingWriter ──Gemini embed (FAILING since 2026-10-21)──► memory_embedding
          └─(after commit)─► MemoryProjectionWriter ──chunk 2000──► memory_item + memory_vector
                                                     (nothing new since 2026-10-19)

proactive job (morning feed / weekly / prediction / character / reflection …)
   └─ builds a long context dump ─► used as the "query" ─► MemoryContextBlock
        └─ MemoryContextService: analyze (RAW) → query embed (FAILING) →
             dense ✗ (no vector) · lexical ✗ (timeout) · facts ~ (timeout 58%) · graph ✓
           → RRF → token budget → "[Hosszú távú memória]" + partial-failure notice
        └─ appended to that job's LLM prompt (fail-open)

chat turn (conversation-first)
   └─ prompt = voice + [Beszélgetés] + personal context/profile + ALL facts + history window
   └─ the model MAY call search_personal_memory → the same pipeline (called 1× ever)
```

## 4. Quality assessment

### Solid (design)
- A genuine hybrid design (dense + sparse + structured + graph) with RRF. That is the right shape for a small, personal, multilingual corpus.
- Correct use of asymmetric task types; hash-guarded idempotent re-embedding; versioned vector generations; partial HNSW index on ready/live rows.
- Honest failure semantics: a dense outage throws instead of looking like "no hits"; the partial-failure notice is placed in the prompt; `retrieveOrFail` is used for similar-days.
- Excellent observability *of runs*: per-run audit, a score breakdown, an admin explorer with replay, UMAP map and graph view.
- Per-consumer policies with kill switches, token budgets, and temporal and visibility filters.
- Test coverage is broad: about 25 memory test files plus about 20 consumer `*MemoryIT` / `*MemoryDisabledIT` pairs, `ChatMemoryRolloutIT` and `AmbientRecallEvalIT`. An offline eval also exists (`docs/research/raw/measurements/2026-09-17-memory-retrieval-gemini-eval.md`: recall@5 0.155 → 0.837).

### Broken / half-built (reality)
1. **Embedding outage, about 3 weeks, silent.** Since 2026-10-21 every `EMBED_DOC` call returns `ClientException` (137/137), and nearly every `EMBED_QUERY` does too (1 success in November). The likely cause is the Gemini key, quota or billing after the chat provider moved to OpenAI. `error_code` and the response text are empty in `llm_log_history`, so the exact reason is unrecorded. Effects:
   - 5 daily summaries since 2026-10-20 and the latest chat turns are not in the vector store.
   - The dense retriever has been dead since 2026-11-06.
   - The 7-day daily-summary catch-up re-embeds only recent days. The re-embedding job is off, so older gaps will not heal on their own once the key works again.
2. **The alerting blind spot.** `memory_stuck` counts `memory_vector.status='failed'`, but the writers throw before creating any vector row, so there are 0 failed rows. `job_missed` watches `daily_summary`, which is still fresh. The admin "Memória" page therefore shows healthy, 202/202 ready.
3. **Lexical retriever timed out in 96% of runs (186/194); facts in 58%.** Probable causes, not proven:
   - The 200 ms deadline starts at *submission*, on the shared `applicationTaskExecutor`, while many runs happen in dawn job bursts (03:00–06:00 has 85 runs), so they queue.
   - `word_similarity` / `similarity` are computed against 500–2000-char queries for every row.
   - `websearch_to_tsquery` ANDs every term of a long dump, so FTS can essentially never match. The 8 lexical runs that succeeded returned 0 candidates.

   Net effect: the sparse half of "hybrid" does not work in production.
4. **The query shape is wrong for most consumers.** Proactive and reflection surfaces pass context dumps as the query (averages: REFLECTION 1 812 chars, PREDICTION 1 432, CHARACTER 788). Good RAG practice is a short intent query, or HyDE / multi-query. A long dump embeds into a blurry "average day" vector and breaks FTS.
5. **Labelled RAG, actually stuffing.**
   - Chat's main memory is **facts-always**: every enabled fact is in every turn, capped only as a safety brake (`KnowledgeFactService.java:214-256`). That is fine at 84 facts, but it is not retrieval.
   - The hypothesis pipeline's `gather` = last 7 daily summaries + all facts + all statistical patterns + a metric table (`HypothesisPipelineService.java:523-545`).
   - The chat "personal context", profile and snapshot blocks are recency stuffing.
   - The memory block is a garnish on top of these dumps, not the main context.
6. **Chat RAG is effectively unused.** The tool has been called once ever. `ai_message.recalled_memories` is non-null on 31 messages, all before 2026-09-30, when the legacy/ambient path still ran. Production has 136 chat messages in total, and only 4 since 2026-10-12.
7. **Dead knobs**: reranker globally off; rewrite never fires (no chat-ambient runs); salience/title/topics/people never filled; retrieval feedback endpoints exist with 0 rows; fact merge has never merged; `effect_link` has 0 live rows; veto table empty.
8. **Two parallel stores.** `memory_embedding` (legacy) and `memory_item/vector` (canonical) duplicate every vector. The legacy one is kept only for the OLD/SHADOW fallback and for chunk 0 reuse. That doubles complexity for no current benefit.
9. **Corpus coverage gap.** Only prose is embedded. Meals, recipes, workouts, sleep nights, wearable days, calendar events and plans are not memory items, so "the AI remembers everything about me" (core 8) is false at the retrieval layer. Structured data reaches LLMs only through snapshot/tool stuffing.
10. **Scale.** One real user, 203 items. Every quality judgement here is untested at volume, and the HNSW index is irrelevant at this size: a sequential scan would do.

## 5. Reuse for native iOS (Boop)

- **As-is (backend service, no API needed)**: `MemoryContextBlock.render(...)` / `MemoryContextService.retrieve(...)` can be called from any new Boop backend surface, such as the morning brief, check-in reaction, day re-plan or chat. Add a `ConsumerPolicy` (e.g. `BOOP_BRIEF`) with its own limits. Write-back jobs (daily summary, consolidation, facts, graph, patterns) are user-scoped and keep working for a new account.
- **Existing HTTP**: only the retrieval-feedback endpoints (`/api/companion/memory/retrieval-feedback`, `PUT …/feedback`) and the knowledge-fact/graph endpoints (`KnowledgeGraphApi`, facts CRUD in the companion contract) exist. There is no "search my memory" endpoint for a client. Boop should not run retrieval client-side anyway.
- **Needs a Boop-shaped API**: a transparency surface ("mire emlékszik rólam", forget/mute) if the owner wants it on iPhone. The data and the services exist (`AboutMeService`, `ForgetService`, `KnowledgeFactService`), but the contracts are web-shaped.
- **Web-frontend-only logic**: the admin memory explorer (UMAP etc.) is web/admin only and need not move. The UMAP projection runs client-side from a PCA payload.
- **Prerequisites before Boop leans on memory**:
  1. Fix or switch the embedding provider. OpenAI `text-embedding-3-small` at 768 dims fits the existing `vector(768)` and the provider already used for chat. That needs a new `embedding_version` plus the existing `MemoryReembeddingService`, then a flip of `serving-embedding-version`.
  2. Add an alert on embed error rate and on "source rows without vector".
  3. Short intent queries per surface.
  4. A retriever deadline measured from task start, or a dedicated executor, and lexical on a trimmed keyword query.
  5. Embed new Boop sources: wearable day digests, check-in snapshots, meal/plan summaries, journal and day close-outs.

## 6. Gaps vs. the owner's core

| # | Verdict | Reason |
|---|---|---|
| 8 (one AI sees ALL data, short/mid/long-term conclusions, full-context chat) | **exists, needs fixing** | The short/mid/long ladder (daily → weekly → monthly summaries, facts, patterns, graph, profile) exists and is populated. But retrieval is degraded (embedding outage, lexical dead), chat skips ambient RAG, and structured data is not in the corpus. "Sees all" is really snapshot stuffing plus tools. |
| 9 (domain agents cross-checking) | **exists, partially relevant** | Facts carry an `owner` (deru/mocor/falat/szunya/mezo), and there are per-domain proactive generators, but the memory layer has no per-domain retrieval scope or cross-agent evidence exchange. Each generator retrieves independently with a dump query. See the konzílium mapper for the agent side. |
| 3 (long-term effects of recipes/ingredients/new items on biomarkers) | **missing** | `effect_link` covers only person/event → mood/energy/stress (0 live rows). The Pearson catalog (`service/MetricKey.java`) has daily macros, NOVA-4 %, meal score and check-ins, but **no recipe/ingredient keys and no wearable biomarkers** (HRV, RHR, steps). There is no before/after or "new item introduced" analysis. Needs a new effect engine. |
| 3 (active plan rules in AI chat context) | **not memory** | Plan rules belong in a deterministic context block, not RAG. Today they are not embedded, which is correct. |
| 10 / 11 (journal, check-ins) | **exists & good as memory sources** | Journal, gratitude, reflection and check-in notes are embedded, and text signals are extracted. Check-in biomarker snapshots are not embedded. |
| 12 (live day re-examination) | **missing at the memory layer** | No consumer uses "similar past days" for live re-planning, though `SimilarDaysRecall` is a ready building block. |
| Legacy `memory_embedding` path, ambient `[Emlékek]` recall, gear router | **candidate to drop** | Superseded by NEW plus conversation-first; kept only as a fallback. |
| Admin memory explorer (5 views, UMAP, replay) | **candidate to drop / freeze for Boop** | Impressive, but owner-console tooling for a 1-user store, and it did not reveal the outage. |

## 7. Open questions / risks for the re-plan

1. **What is the Gemini `ClientException`?** (key revoked, billing, quota, model access). Either fix it or move embeddings to OpenAI. Either way a re-embed run is needed: the reembedding job is off and catch-up windows are 7 days. Until then every "memory" block in production is graph-plus-facts only.
2. Should Boop's chat inject retrieved memory **ambiently** every turn (reliable, costs about one embed per turn) or rely on the **tool** (cheap, but the model almost never calls it: 1 call ever)? The evidence argues for ambient retrieval with a strict relevance floor.
3. What should be embedded for Boop? Per-day structured digests (sleep, HRV, load, meals, check-ins, calendar strain) would make "similar days" and long-term conclusions actually work. Today only prose is in the corpus.
4. Keep one store: drop `memory_embedding` and the OLD/SHADOW modes to halve the write path.
5. Query design per surface: short intents, or several sub-queries per surface, instead of a 2000-char dump.
6. Monitoring: alert on embed error rate and on source rows without a vector. The current health page reports "202/202 ready" during a 3-week outage.
7. Food → biomarker effects (core 3) need new data plumbing (ingredient-level daily exposure series × wearable series, with a lag) and a proper method (within-person before/after or an N-of-1 design). The RAG layer cannot provide this.
8. Volume is tiny (1 user, about 200 items). Eval numbers from September (recall@5 0.84) were measured on a seeded corpus. Re-measure after the fix on real data.
