# 06 — AI chat / companion and the LLM platform

Mapper: AI chat + LLM platform. Date 2026-11-10. Code read at `elastic-wu-5c1a35` HEAD; prod DB queried for shape/volume only.

## TL;DR

1. The platform is solid: one port (`CompanionLlm`) + `LlmModelRouter` (per-feature / per-call-kind model overrides, cheap vs smart tier, budget degrade), a per-user USD cap ($30 / 30 d, degrade at 70 %, throttle crons at 90 %, stop at 100 %), a full audit log (`llm_log_history`, cost per call), EN/HU output directive. Prod runs OpenAI `gpt-5.6-luna` (cheap) / `gpt-5.6-terra` (smart), Gemini for audio, vision and embeddings.
2. There are ~45 distinct AI call sites (tagged "features"); ~25 are written for a person to read (chat, feed, briefs, reviews, coaches, council), the rest are extraction/plumbing. Inventory in §2.2.
3. The chat's DEFAULT path is "conversation-first": a smart-tier planner (JSON, no tools) decides which of 23 read tools to run (≤5 rounds, 15 calls shared), then a tool-free smart-tier answer streams. Context is small and on-demand: baseline profile + weight + active weight goal, About-me, custom instructions, learned style profile, all confirmed facts, people recall — NOT the full day snapshot.
4. **Core 8 (one AI sees ALL data): partial.** The data is reachable through tools (`read_personal_records` over ~90 reviewed tables), but it is pull-based, not pushed; the planner decides. **Wearable data (Apple Health `daily_metric`, `wearable_workout`) and `calendar_event` are invisible to every AI feature except the Boop brief** (zero references in companion/proactive/character).
5. **Core 3 (active plan rules in chat context): missing.** No diet-plan entity exists; the chat only sees today's kcal/macro segment of the active weight goal and can fetch `get_goal`/`get_training_plan`. No allergen/intolerance data exists anywhere (only a digestion detector).
6. **Core 12 (live day re-examination): missing.** Closest: nightly `day_review` (deterministic 6-dim score + prose, closed days), flag/advice card (deterministic rules + cheap prose), morning/midday/evening feed. Nothing re-plans the day from live data.
7. **Core 9 (konzílium): exists and rich** — nightly 7-expert observation, Sunday konzílium (proposal → skeptic → integrator), daily council (21:00) + team chat + edition. It is a *character-dossier* machine over the web app's data, not a cross-checking diet/training agent set.
8. Prod usage of chat is tiny: 30 conversations, ~68 user turns in 2.5 months, last 2026-11-01; ~$0.035 and ~12 s per turn (plan 4 s + stream 8 s). Background generators cost ~10x the chat.
9. **Prod health flag:** every Gemini embedding call (`embed_memory`, `companion_recall`) has been failing (`ClientException`, ~20/day, 100 % since early Nov; last success 2026-11-06), so vector recall is effectively dead; `companion_fact_merge` fails 24/24 (`IllegalArgumentException`); council quota exhausted 19×. Cause not verified.
10. iOS has no chat today (only the generated OpenAPI copy mentions companion). Streaming is hand-written SSE (`POST /api/companion/conversation/{id}/message/stream`), so Swift needs a hand-written SSE client; the non-stream `…/message` endpoint is a drop-in fallback.

---

## 1. Scope

Backend `feature/companion` (chat, tools, advisors, flags, memory entry points, profile, reflection, quarterly), `feature/llmlog`, `feature/boop` prompts, plus every other feature's LLM call site (grep `new LlmCallContext(` — ~100 hits), `feature/character` (council/konzílium), `feature/proactive`; frontend chat (`frontend/src/features/insights/pages/ChatPage.tsx`, `frontend/src/data/insights/chat*.ts`); docs `docs/features/companion.md` (10 442 lines!), `character.md`, `_platform-language.md`. RAG/memory store internals deliberately skipped (other mapper); only the chat's call into it is noted.

## 2. What exists

### 2.1 LLM platform (techcore-ish, but it lives in `feature/companion` + `feature/llmlog`)

| Piece | Anchor | Notes |
|---|---|---|
| Port `CompanionLlm` | `feature/companion/CompanionLlm.java` | `complete`/`stream` (cheap tier, with tools), `completeSmart`/`streamSmart` (smart tier, **tool-free by contract**), vision overload (`InlineImage`), audio overload (`InlineAudio`). Prompt is split in STABLE (voice) + VOLATILE (`turnContext`) halves for provider prefix caching. |
| Adapters | `llm/SpringAiCompanionLlm.java` (540 l, base), `GeminiCompanionLlm`, `OpenAiCompanionLlm`, `FakeCompanionLlm` (1745 l, profile `companion-fake`, deterministic dispatch on prompt prefixes) | Spring AI 2.0.1. The tool loop runs inside the adapter. |
| Provider switch | `application.yml:822` `mezo.companion.llm.provider` (default `gemini`; **prod = `openai`** via env `MEZO_COMPANION_LLM_PROVIDER`) | `per-call-kind: TRANSCRIBE: gemini, VISION: gemini` — OpenAI adapter delegates audio+vision to Gemini. |
| Model router | `llm/LlmModelRouter.java` | Precedence: call-kind override → budget degrade target → feature override (`feature-models["[slug]"]`) → tier default. Config-only model moves. Models: Gemini 2.5 flash/pro; OpenAI gpt-5.6-luna (cheap) / terra (smart). |
| Reasoning effort | `OpenAiCompanionLlm.optionsFor:104` | Config `chat: high, smart: high`, but **pinned to `none` whenever the request carries tools** (Chat Completions rejects tools+reasoning). Hence the tool-free smart-tier design. |
| Output language | `llm/OutputLanguageDirective.java`, applied at `SpringAiCompanionLlm:127` | All prompts are Hungarian; for `en` accounts an English directive is **appended** (cache-prefix safe). Exempt: recall rewriter/reranker, embeddings, admin replay. History is never translated. |
| Persona | `feature/auth/service/PromptPersona.java` | `{{NÉV}}` token filled from account name; `VOICE_HU` tegező rule appended by prose prompts. |
| Call tagging | `feature/llmlog/context/LlmCallContext(feature, operation, entityKind, entityId)` + `LlmCallContextHolder.runWith` | Every call is tagged; this is also the budget-gate point. |
| Audit/cost log | `feature/llmlog` — table `llm_log_history` (call_kind, feature, operation, requested/served model, status, latency, tokens incl. cached/thoughts, tool_rounds, `cost_usd` with frozen pricing snapshot, system_prompt/user_message/response_text payload scrubbed after 90 d), `LlmUsageController`, `LlmLogRetentionJob` (03:40) | Pricing in `application.yml:~770` with promotional GPT-5.6 rates **only guaranteed to 2026-11-21**. |
| Budget | `LlmBudgetService`, `LlmBudgetGate`, yml `mezo.llm-log.budget` | $30 / rolling 30 d: ≥70 % → every call to cheap model; ≥90 % → throttled-features (memoir, diagnosis, prediction, experiment, challenge, weekly review, quarterly, hypothesis, day_review, character_edition, team_chat) suspended; 100 % → refused (429). `admin_replay`, `companion_smoke` exempt. |
| Tool registry | `tools/CompanionToolRegistry.java` | Every callback wrapped in `RecordingToolCallback` (audit + 15-call/turn budget). Owner `userId` comes from JWT `ToolContext`, never from model args. |
| Advisor chain | `advisor/CompanionAdvisorChain.java`, `ClinicalOutputCheck` (Rx dose-change ban), `ActionClaimCheck` (fabricated "I did X"), `TurnVerdictCheck` (LLM judge — **removed from the live path in S9.8**; last `companion_advisor` call 2026-09-17) | Post-hoc, deterministic; corrective retry lands in the persisted "done" row. |
| Voice in | `controller/CompanionVoiceController` `POST /api/companion/transcribe`, `service/TranscriptionService` (Gemini audio) | Stateless speech→text. |
| Feedback loop | `feedback/*` (👍/👎 per artifact → nightly rollup → `profile/ProfileAssembler` weekly smart synthesis "how to talk to him" → injected as learned profile) | |

### 2.2 Inventory of every AI feature (slug = `LlmCallContext.feature`)

Tier: C = cheap (`complete`), S = smart (`completeSmart`). Prod calls/cost from `llm_log_history` (2026-08-24 → 2026-11-10).

**A. Chat / conversation**

| Slug (ops) | Prompt location | Tier | Inputs → output | Prod |
|---|---|---|---|---|
| `companion_chat` (`conversation_plan`, `stream`/`send`, `answer`, `opening_turn`, legacy `plan`/`plan_replan`/`answer_replan`) | `ConversationTurnService.VOICE` (stable) + `TurnPlanner.planConversation` prompt (marker `TERV-FELADAT.`) + legacy `ChatService.SYSTEM_PROMPT`, `TurnAnswerer` | S (planner + answer) | See §3.1 → streamed Hungarian prose | 134 calls, $2.28; last 2026-11-01 |
| `companion_advisor` (`retry`, `verdict_check`) | `advisor/*` | C | corrective retry of an answer | 42, dead since 09-17 |
| `companion` (`transcribe`) | `TranscriptionService` | audio | clip → text | 10 |
| `companion_smoke` (`hello`) | `CompanionHelloRunner` | C | boot smoke call | – |

**B. Memory / knowledge plumbing (not read by the person)**

`companion_fact_extract` (`FactExtractionService`, C; post-turn candidates, ≤3), `companion_person_fact_extract` (`PersonFactExtractionService`), `people_extraction` (`PersonExtractionService`, 730 l), `companion_fact_merge` (`service/merge/FactMergeJudge`, S; **24/24 errors**), `companion_consolidation` (`PeriodSummaryService`, weekly 03:30 MON / monthly rungs), `companion_daily_summary` (`DailySummaryService`, nightly 02:20, C, `SUMMARY_MARKER`), `companion_graph` (`GraphEdgeStructurer`, `LifeEventExtractionService`), `companion_reflection` (`TextSignalExtractor` mood/energy/stress from journal text, `QuickNoticeService` same-day "noticed something"), `companion_recheck` (`KnowledgeRecheckService`, quarterly, S), `companion_profile` (`ProfileAssembler`, weekly MON 03:45, S), `companion_quarterly` (`QuarterlyReviewService`, S), `companion_recall` + `embed_memory` (query rewrite/rerank/embedding; Gemini `gemini-embedding-001`; **100 % failing since early Nov**).

**C. Hypotheses / patterns (item 3 "long-term effects")**

`companion_hypothesis` (`HypothesisPipelineService` propose → critique → revise, S, nightly via `ReflectionJob`; 168 calls, $6.22 — the single biggest background cost). Deterministic: `PatternDetectionService` (Pearson/Cliff over `MetricKey`, ~60 metrics, `service/MetricKey.java`), `EffectLinkService` (nightly; **subjects = people + 6 event types** `edzes/munka/csalad/kozos_program/konfliktus/pihenes` vs mental/energy/stress, 60-day window; prod: 3 event + 2 person links), `PatternMonitorService`, `PatternGate`.

**D. Proactive layer** (`feature/proactive`, docs `proactive.md`)

| Slug | Class | Tier | Output | Prod |
|---|---|---|---|---|
| `proactive_feed` (kinds morning/midday/evening/sleep/weight/people/hydration) | `FeedGenerationService`, `CompanionMessageGenerator` | C (S for some via `FeedGenerationService`) | `companion_message` rows | 334 calls, **$7.85 (biggest line)**; 73 morning, 73 midday, 71 evening, 38 weight, 27 sleep, 27 hydration |
| `proactive_advice` | `AdviceProseGenerator` | C | wording of the single daily advice card (candidate comes from deterministic flags); numerals forbidden + `ProseNumberGuard` | 31, last 09-23 (card now deterministic/off-chat?) — 38 `advice` rows till 11-10 |
| `proactive_weekly`, `proactive_weekly_review`, `proactive_memoir`, `proactive_prediction`, `proactive_experiment`, `proactive_diagnosis`, `proactive_challenge` | `WeeklySuggestionGenerator`, `WeeklyReviewGenerator`, `MemoirGenerator`, `PredictionGenerator`, `ExperimentProposalGenerator`, `DiagnosisGenerator` (fatigue), `ChallengeGenerator` (workout micro-challenge) | S, strict JSON, model only *selects* from code-built candidates | rows | challenge 95 calls $1.73; others <15 each |
| `quest_flavor` | `feature/quest/service/QuestFlavor` | C | rewrites daily quest text | 71 |

**E. Karakter / team (items 9)** — `feature/character`

`character` ops `observe` (`CharacterObservationService`, nightly 02:50, per expert C), `crosstalk` (`KonziliumCrossTalkRound`), `reply`/`reply-discussion` (`CharacterReplyEvaluation`), `portrait` (`PortraitWriter`), bootstrap/monthly deep read, konzílium proposal (C per expert) and verdict (`KonziliumVerdictRound`: skeptic then integrator, S) Sun 19:30, **daily council** 21:00 (`CharacterCouncilService`, debate ≤3 rounds, ≤8 tool calls, budget 14 calls/cycle). `character_edition` (`EditionVoiceWriter`, evening edition), `team_chat` (`TeamChatVoiceWriter`, `TeamChatReplyVoiceWriter`). 7 expert personas in `CharacterExpertCatalog` (doki, edzo, taplalkozo, szomnologus, … + Szkeptikus + Mezo integrator), 47 deterministic detectors. Prod: `character` 344 calls $1.08 (21 errors = council quota/tool budget exhausted), `character_edition` 43, `team_chat` 44.

**F. Food / fuel**

| Slug | Class | Tier | Input → output |
|---|---|---|---|
| `meal_draft` (`photo`, `text`) | `meal/service/MealAiDraftService` (+ `MealDraftLlmAdapter`) | C, vision for photo (Gemini) | free text/photo + owner's pantry+recipe catalog → draft meal lines; LLM picks id+amount, macros from DB; confidence deterministic. 112 calls |
| `meal_coach` (`verdict`) | `meal/service/MealCoachService`, `MealCoachPrompt`, `MealCoachContextReader` | C | deterministic score breakdown + day's workouts + running totals + last check-in + glucose band → tagline/summary/improve/dimension notes/glucose tips. Numbers are never the LLM's. Lazily per meal/day, cached in `meal.breakdown`. 97 calls |
| `recipe_breakdown` (prose), `recipe_workshop` (turn), `pantry_photo`, `pantry_scrape`, `stack_placement`, `slot_template` (`SlotPlanEvaluationService`) | respective services via `*LlmAdapter` | C | recipe prose, recipe-creation chat, pantry import from photo/URL, supplement slot placement fallback, "judge my meal-slot split" |

**G. Training / body / life**

`train_meso_plan` (`MesoPlanLlmAdapter`, generates a mesocycle plan, 2 calls), `meso_review` (`MesoReviewGenerator`, S), `sleep_shot` (Sleep Cycle screenshot → draft, vision, 19 calls — **this is today's only Sleep Cycle ingestion**), `habit_ai_suggest`, `lifegoal_propose`, `activity_classify`, `day_review` (`DayReviewService`, `PROMPT_VERSION v2-warm`; cached prose over the deterministic `DayEvaluationEngine`; nightly warm-up 02:30; 98 calls).

**H. Boop (native)** — `boop_brief` (`BoopVerdictWriter`/`BoopPrompts`, C, marker `BOOP_BRIEF_V1`): user message = computed scores + sleep/HR/steps/meals/calendar **count + time spans only (never titles)** + recovery + creed; JSON out (forma/alvas/mozgas/fuel/pulzus headlines, 2–4 sentence brief with links, tonight tip, next-meal tip). Not a companion message kind.

### 2.3 Chat tool catalogue (23 tools, `feature/companion/tools/*`)

Domain reads (18, `CompanionToolRegistry.callbacks`): `get_training_log`, `get_training_plan` (today/tomorrow/week/meso/date incl. runs + sport slots), `get_exercise_records` (TrainTools); `get_weight_trend`, `get_weight_log`, `get_recovery` (scope sleep/checkins/goal…; BiometricsTools); `get_fuel_log`, `get_protocol`, `get_recipes`, `get_pantry` (FuelTools); `get_goal` (scope progress/recept/timeline/guards/feasibility); `get_medication`; `find_similar_past_days`, `compare_periods` (MemoryTools); `get_growth`; `get_daily_practice`; `get_insights`; `get_life_goals`. Context/source reads (5, `conversationCallbacks`): `get_personal_context` (scope facts/people/character/reflections/**today = the full old ContextSnapshot**), `search_personal_memory`, `get_conversation_history` (older pages), `list_personal_sources`, `read_personal_records` (generic allowlisted read, `PersonalRecordSource.ALL` ≈ 90 reviewed projections: meal/meal_item, recipe(_ingredient), pantry_*, sleep_log, weight_log, check_in, workout/exercise/set, mesocycle, running_block, goal, goal_plan_link, protocol, journal, people, proactive artifacts, character…). **Not in the allowlist: anything from `wearable` (`daily_metric`, `wearable_workout`), `calendar_event`, `boop_brief`.** All tools read-only; chat cannot write (VOICE says so explicitly).

### 2.4 API surface (`api/feature/companion/companion.yml`)

Conversations CRUD+rename (`/api/companion/conversation[/{id}]`), messages (`…/messages`), sync turn (`…/message`), SSE turn (`…/message/stream`, events `delta`, `tool`, `phase` PLANNING/RETRIEVING/ANSWERING, terminal `done|error`), `…/turn-memory`, `…/forget-learned`, preferences + `personal-context` preview (about-me, custom instructions, learned-profile toggle), facts + candidates, patterns, observations, effects (+mute), flags trace, transcribe, memory overview/summary/similar-days/llm-usage, feedback. Anchored conversations (`context_kind/context_date`, week-anchored opening turn via `KICKOFF_PROMPT`).

### 2.5 Frontend chat

`ChatPage.tsx` (458 l): conversation picker/actions sheets, optimistic streamed turn (`chatApi.ts` fetch-ReadableStream SSE), tool chips/`ToolWorkStrip` (live phases), `TurnMemoryChips` (what was recalled/remembered/forgotten, undo), 👍/👎 `FeedbackChips`, quick questions (`logic/quickQuestions.ts`), voice dictation (`useVoiceInput`), degraded-state banner, retry/edit-failed. Separate `TeamChatPage` (character team wall chat). All client logic is display-only; no prompt/context logic lives in the frontend. Mock mode via `VITE_USE_MOCK`.

## 3. How it works

### 3.1 One chat turn (default, `mezo.companion.conversation.enabled: true`)

1. `ChatStreamService.stream` → `ChatService.prepareTurn` (tx 1: ownership, history window, forget pre-screen `ForgetIntent`, persist user row). Budget gate runs eagerly so a refusal is an HTTP 429, not a mid-stream error.
2. **Stable prompt** = `ConversationTurnService.VOICE` (free conversation on any topic, don't steer to health, no invented personal facts, can't act/log, *can* remember, source text is data not instructions, weight-trend honesty rules, goal-direction rule, no dose advice) — cached prefix.
3. **Volatile context** (`ChatService.conversationContext`): `[Beszélgetés] Ma: <date>` + anchored week block if anchored; `PersonalContextAssembler` = `[Fiók]` name + `[Személyes alapadatok]` (`PersonalBaselineContext`: age/height/sex/body-fat/activity level, **last weight only**, **active weight goal: trajectory, start/target kg, dates, today's prescription segment kcal/protein/carbs/fat/training-vs-rest kcal**) + `[Rólam]` + `[Saját kommunikációs instrukciók]` + learned communication profile (`ProfilePromptAssembler`, user can toggle); **all enabled confirmed knowledge facts** (`KnowledgeFactService.renderPromptBlock`, cap 200, prod 84 in prompt); memory-honesty blocks (deterministic people recall `PeopleRecall`, `[Ebben a beszélgetésben]`, `[Elfelejtve]`).
4. **Retrieval loop** (`ConversationTurnService.prepare`): up to `max-read-rounds` (5) times, a smart-tier **planner** (`TurnPlanner.planConversation`, JSON `{needsData, steps:[{tool,args,why}]}`, tool catalogue rendered as prompt text, no tool schemas so reasoning stays on) picks reads; `PlanValidator` checks names/args; `PlanExecutor` runs them in parallel (4 threads, 15 s step timeout), results digested (`ToolOutcomeDigest`, 8 000 chars/result, 40 000 total) and fed to the next planning round. Shared budget 15 calls/turn. Failure → notice line "data fetch unavailable, not absence of data" and answer anyway (degraded flag).
5. **Answer**: `companionLlm.streamSmart(stable, volatile+digest, history, message)` — tool-free, smart tier (terra, effort high), natively streamed. History = last 80 messages (12 000 chars each, 100 000 total), sent as real prior messages.
6. Post-stream: `CompanionAdvisorChain.review` (clinical + action-claim deterministic checks, silent corrective retry), tx 2 `completeTurn` persists assistant row (tool asks/outcomes provenance `TurnProvenance` — outcomes NULLed after 90 d — refs, recalled items, degraded). Publishes `ChatTurnCompleted` → async fact/person-fact extraction, embeddings, text signals.
7. Rollback flag: `conversation.enabled=false` restores the 2026-09 "gear" pipeline (`TurnGearRouter` CHAT/LOOKUP/ANALYSIS, `ContextSnapshotAssembler` 10-block snapshot `[Edzés] [Fuel] [Alvás] …`, ambient `[Emlékek]`/`[Összefüggések]` recall, `[Karakter]`, `[Észrevételek]`, replan lap). That legacy code (ChatService 966 l, ContextSnapshotAssembler 788 l, FakeCompanionLlm) is still maintained and still dominates the docs.

Language handling: prompts Hungarian; `OutputLanguageDirective` appended for `en`; user turns stored verbatim; no per-turn language detection (account setting only).

Token budget: **no token accounting**; only character caps (history 100 k chars, tool digest 40 k chars) and call caps. Prod avg ≈ 24 k prompt tokens per streamed answer, ≈ 10 k per planning round.

### 3.2 Other flows

- **Nightly/weekly pipeline** (all `@Scheduled`, switchable under `mezo.techcore.cron.*`): 02:20 daily summary → 02:30 day-review warm-up → 02:40 patterns → 02:50 character observation → 03:00 SUN hypotheses / nightly reflection+hypothesis loop → 03:10 feedback rollup → 03:20 graph → 03:30 MON weekly rung → 03:45 MON profile → quarterly; proactive feed morning/midday/evening crons; 21:00 council + edition; Sun 19:30 konzílium; hourly flag sweep (20 deterministic flag rules, `flags/service/rule/*`, feed the advice card and nudges).
- **Meal path**: log (text/photo → `meal_draft` → confirm) → deterministic scoring (`MealScoringService`, 8 dimensions) → on open/day batch `meal_coach` adds prose. Weight goal enters only through `dailyTargets` (from the goal prescription) and the "person" block (trajectory, sleep/stress); the LLM never scores.
- **Day path**: `DayEvaluationEngine` (6 dimensions, pure) → `DayReviewService` prose cached by inputs hash, only for closed+scored days.
- **Boop brief**: scores computed in Java (`BoopScores`, `EnergyCurveModel`, `RuleVerdicts`), LLM only words them, JSON parsed with fallbacks.

## 4. Quality assessment

Solid
- Clean seam + config-driven model routing + cost log + hard budget; excellent audit (`llm_log_history` 43 slugs, all tagged except 67 early `unknown` rows).
- "Code decides, model phrases" is applied consistently (meal coach, day review, advice, predictions, effects, Boop brief). Strong honesty rules, clinical dose guard, ownership from JWT only, `ProseNumberGuard`.
- Big test base: ~407 companion test classes (backend), FE unit tests per chat component.
- Provider fallback (Gemini) and a kill-switch to the previous chat pipeline.

Half-built / dead / duplicated / buggy
- **Embeddings failing in prod** (see TL;DR 9): vector recall, `search_personal_memory`, memory projection all degrade silently; `companion_fact_merge` 100 % error. Unverified root cause (log grep returned nothing; `ClientException` from the Gemini client — likely key/quota/model id). Highest-priority operational finding.
- **Docs drift**: `companion.md` is 10 k lines and describes the legacy snapshot path as the main design; code comments still say "46 tool definitions" (real: 23). `ChatService` carries both pipelines; dead-ish code: `TurnVerdictCheck`, gear router, `ContextSnapshotAssembler` chat variant.
- **Chat is under-used** (68 user turns ever; none after 2026-11-01) while background spend is ~10x: `proactive_feed` $7.85, `companion_hypothesis` $6.22, challenge $1.73 vs chat $2.28. The product's real AI surface is the feed, not the chat.
- Latency ~12 s per turn (planner round + smart answer); each extra read round adds ~4 s. Fine for a web chat, heavy for a watch/voice UX.
- GPT-5.6 prices are promotional until 2026-11-21 (yml comment) — cost model must be re-run.
- Mixed tier use: effort `high` on the cheap tier is "owed a re-measure" (yml comment).
- `proactive_advice` last LLM call 2026-09-23 although 38 advice rows exist to 11-10 → advice prose probably falls back to template/is off; not verified.
- English coverage partial (N2/N3 pending) — irrelevant if Boop is Hungarian-only.

## 5. Reuse for native iOS

As-is (no change): `POST/GET /api/companion/conversation…`, `…/message` (sync) and `…/message/stream` (SSE — hand-write a Swift `URLSession.bytes` client; the generated client can't do it, see `CompanionStreamController` "contract-first SSE precedent"), `/api/companion/transcribe` (but iOS has native `Speech`, so likely drop), preferences/personal-context, facts/candidates, turn-memory/forget, feedback, flags trace, `/api/proactive/feed`, `/api/llm usage`.
Needs a Boop-shaped API: (a) a compact "Boop day context" endpoint/tool that exposes `BoopDay` + `daily_metric` + calendar to the chat — currently nothing outside `feature/boop` can read wearable/calendar; (b) a phase/tool-event contract that is watch-friendly (short answers, no `ToolWorkStrip` metadata); (c) a non-conversation "ask the day" single-shot endpoint if the watch should not need conversation CRUD.
Lives only in web FE: chat UX (optimistic turn, retry, quick questions, tool chips, feedback chips, memory chips) — all display logic, must be rewritten in SwiftUI; **no business logic** would be lost. Prompts/context/tools are all backend, so the iOS chat gets them for free.
Reuse as platform for Boop's new AI jobs: `CompanionLlm` + `LlmCallContext` + router + budget (add a slug + `feature-models` entry, no code change per new feature), `FakeCompanionLlm` marker dispatch for ITs, `PromptPersona`, `OutputLanguageDirective`, `llm_log_history`.

## 6. Gaps vs. the owner's core

| # | Verdict | Reason |
|---|---|---|
| 8 One AI that sees ALL data + short/mid/long conclusions | **Exists, needs fixing** | Pull-based tool access to ~90 tables + facts + summaries (daily/weekly/monthly/quarterly `period_summary`, patterns, memoirs) gives mid/long-term material. But wearable + calendar are invisible, the full "today" snapshot isn't pushed, embeddings are failing in prod, and the planner can skip data. A "state of Daniel" document assembled per turn (or per day, cached) is missing. |
| 3 Plan rules in chat context | **Missing** | No plan entity: only the active weight goal's today-segment (kcal/macros) is always in context; `goal_plan_link` ties goals to meso/running blocks but no "allowed recipes/ingredients for 4 weeks" concept exists; no multi-plan model. Chat can fetch `get_goal`/`get_training_plan` on demand. |
| 3 Weight goal + meal eval against it | **Exists, good (partly)** | Goal engine + `dailyTargets` + deterministic meal score + `meal_coach` prose; trajectory/rate in prompts. |
| 3 Long-term effects of recipes/ingredients/new item on biomarkers | **Missing** | `EffectLinkService` handles people + 6 event types vs mood/energy/stress; `MetricKey` has macros/kcal/water but no per-recipe/ingredient/new-item exposure series, no biomarker (HRV/RHR) outcome. Hypothesis loop could host it. |
| 3 Personal trainer + dietitian AI support | **Exists, partial** | `train_meso_plan`, `meso_review`, challenge, meal coach, day review, advice; no unified coach agent with plan authoring/adjustment. |
| 2 Allergen/intolerance flags | **Missing** | Zero hits in recipe/pantry/meal/nutrition (only `FoodDigestionDetector` in character). |
| 7 Calendar AI scoring (mental energy, social drain) | **Missing** | Boop brief gets only counts/time spans, deliberately no titles; no per-event LLM scoring; no units-vs-capacity model (`EnergyCurveModel` is rule-based). |
| 9 Domain agents cross-checking (konzílium) | **Exists, good — different purpose** | 7 experts + skeptic + integrator, daily council with tool-backed debate, team chat. Targets a character dossier, runs on web data, budget-limited (quota exhausted 19×), not wired to plan/day decisions. Candidate to reuse its machinery for "diet vs training vs sleep" cross-check on the new plan model. |
| 10 Journaling, day goal, close-out rating | **Exists** (journal, intention, ritual/napzárás, `day_review`, check-in "a nap mérlege") — other mappers cover capture; AI side: text-signal extraction, quick notice, day review prose. |
| 11 Check-ins with watch snapshot | **Missing on AI side** | Check-in 2.0 is rich and fed to coach/flags; no watch-biomarker snapshot attached. |
| 12 AI re-examines each day live and adjusts | **Missing** | Only batch/event generators (morning/midday/evening feed, hourly flags, nightly review). No agent that takes live day state and proposes food/workout/movement changes, and no mutation tools (chat is explicitly read-only). `WorkoutDayAdjustmentEntity` and `PlacementEngine` are deterministic adjusters in train/fuel, not AI. |
| 1/6 Apple Health + Sleep Cycle into AI | **Exists for ingest, missing for AI** | Sleep Cycle only via screenshot (`sleep_shot`); Apple Health lands in `wearable` but no companion consumer. |

## 7. Open questions / risks

1. **Embedding outage**: who owns fixing it before Boop leans on memory? Check `GEMINI_API_KEY`/quota/model id in k3s secret; confirm with a prod log read.
2. Is the web chat staying? Boop could skip the conversation CRUD and expose a single "Ask Boop" (today-scoped) with the same planner+answer core; conversations/anchoring/forget UX are web-era complexity (30 convs, 68 turns).
3. **Latency/cost for watch**: planner+answer ≈ 12 s, ≈ $0.035/turn at promotional prices (ends 2026-11-21). A cached daily "state of Daniel" blob + one cheap call would be ~5–10x cheaper and faster; decide whether Boop's AI is "pre-computed briefs + occasional chat" (as the brief already is) or live agent.
4. Plan model is the biggest greenfield piece (core 3/5/12): no entity, no prompt, no tool exists — chat context design (what plan rules, how many tokens) should come with the plan schema, not after.
5. Cap: $30/30 d account budget with 70 % degrade; adding wearable-driven live re-examination (many calls/day) needs a budget slice or the existing `throttled-features` list.
6. Konzílium machinery vs Boop's "clean purpose-built" goal: keep as backend job families or drop? It is 47 detectors + 7 personas + team wall — heavily web-UX-tied (feed, replies, edition) though the data side is reusable.
7. Doc/code drift in `companion.md` (10 k lines) — treat code as truth; a short "as-built (conversation-first)" doc should replace it before the re-plan builds on it.
8. `FakeCompanionLlm` dispatches on literal prompt prefixes (e.g. `BOOP_BRIEF_V1`); every new Boop prompt needs a marker + fake branch for ITs.
