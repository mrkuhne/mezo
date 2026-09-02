# S6 Persona + cron-higiénia (mezo-qw37.6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every LLM prompt addresses the signed-in user by their own `app_user.name` instead of the hard-wired "Daniel", the konzílium wire marker becomes user-neutral, all 23 `@Scheduled` jobs fan out only over `ACTIVE` + onboarded users under `LlmActorContext`, a push endpoint can belong to only one account, the frontend's per-user `localStorage` keys are namespaced by user id, and the platform docs + a new ADR describe the multi-user model.

**Architecture:** One `PromptPersona` service in `feature/auth` resolves a `PersonaContext{userName}` for a `UUID` and substitutes a single `{{NÉV}}` token in prompt templates; every prompt site keeps its `static final String` template (now carrying the token) and calls `promptPersona.render(userId, …)` once, right before the LLM call. Transcript role labels ("Daniel: ") and the konzílium authorship marker become the neutral `Felhasználó` — the same precedent the spec sets for the wire marker — so stored embeddings, audit rows and conference transcripts stay parseable. A `UserFanOut` service in `feature/auth` replaces `appUserRepository.findAll()` in every job and wraps each user's body in `LlmActorContext.runAs`. On the frontend a module-level `userScope` (set by `AuthGate`) prefixes storage keys with `mezo.<userId>.`.

**Tech Stack:** Spring Boot 4 / Java 21, JUnit 5 + Testcontainers ITs (`-Dmezo.test.use-testcontainers=true`), React 19 + TanStack Query 5 + Vitest.

**Spec:** `docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md` §10 (also §2 decision table, §5 S1 interfaces, §7 `LlmActorContext`, §13, §14).

**Depends on:** S1 (`AppUserEntity.{status,onboardedAt,isOnboarded()}`, `useMe()`, `AuthGate`, `ME_QUERY_KEY`, `mockMe`) and S3 (`techcore` `LlmActorContext.runAs(UUID, Runnable)`). Branch from `main` after S3 is merged.

## Global Constraints

- Branch `feat/multi-user-s6-persona-cron`; conventional commits carry the bd id, e.g. `feat(auth): … (mezo-qw37.6)`. No `bd` commands from the worker (the orchestrator closes the issue).
- ArchUnit (`backend/src/test/java/io/mrkuhne/mezo/ArchitectureTest.java`): feature slices are cycle-free (frozen store) — **everyone may depend on `feature/auth`, `feature/auth` depends on no other feature** (only `techcore`); `@Service` in `..service..`, repositories in `..repository..`; constructor injection only; no class-level `@Transactional`; no `@Value`; no raw `RuntimeException`/`IllegalStateException`/`IllegalArgumentException` outside `techcore`.
- Prompt token is the literal `{{NÉV}}`; the only substitution helper is `PromptPersona`. No case inflection in this slice: every rewrite keeps the name in nominative and moves the suffix onto a following noun/pronoun (`Daniel hetét` → `{{NÉV}} hetét`; `Danielről` → `{{NÉV}} személyéről`; `Danielnek` → `{{NÉV}} számára`; `Daniellel` → `vele`).
- Transcript role label (chat history, embeddings, fact extraction, recipe workshop) is `PromptPersona.USER_TURN_LABEL = "Felhasználó: "`. Wire marker is `KonziliumProposalRound.USER_FEEDBACK_PREFIX = "FELHASZNÁLÓ VÁLASZA — "`; the FE parses both the old and the new prefix.
- `SchedulingConfiguration` pool stays at 1 (unchanged file).
- Config values go to `application.yml` under `mezo:` via a `@Validated` `*Properties` record — never `@Value`, never a hardcoded tunable.
- Backend focused gate: `cd backend && ./mvnw clean test -Dtest='PromptPersona*,UserFanOut*,PushSubscription*,KonziliumUserFeedbackIT,CharacterPromptAssemblerIT,ChatHistoryTest,ChatServiceIT,ChatStreamServiceIT,GeminiCompanionLlmRecordingTest,TurnEmbeddingListenerIT,MemoryEmbeddingWriterIT,DailySummaryJobIT,QuestJobIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`. CI runs the full suite.
- Frontend gate: `cd frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build` (unset `VITE_USE_MOCK` = mock!). Hungarian UI copy; hooks consumed only via `@/data/hooks`; `isMockMode()` only inside hook/component bodies.
- Docs: `node scripts/gen-codemap.mjs` after adding classes; `node scripts/lint-docs.mjs --errors-only`; new ADR number **0034** (`ls docs/decisions | tail -1` shows `0033-…`).

---

## File Structure

**Backend — create**
- `backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/PersonaContext.java` — `record PersonaContext(String userName)` + `FALLBACK`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/PromptPersona.java` — `@Service`: `forUser(UUID)`, `render(UUID, String)`, static `fill(PersonaContext, String)`, `NAME_TOKEN`, `USER_TURN_LABEL`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/UserFanOut.java` — `@Service`: `activeUsers()`, `forEachActiveUser(String, Consumer<AppUserEntity>)`.
- Tests: `feature/auth/service/PromptPersonaTest.java` (unit), `feature/auth/service/PromptPersonaIT.java`, `feature/auth/service/UserFanOutIT.java`, `feature/notification/PushSubscriptionRebindIT.java`, `feature/quest/QuestJobIT.java`.

**Backend — modify** (full path:line inventory in the tables below)
- `feature/auth/repository/AppUserRepository.java` (+ `findByStatusAndOnboardedAtIsNotNull`), `support/populator/UserPopulator.java` (onboarded by default).
- 22 job classes (table B), `feature/quest/repository/DailyQuestRepository.java`, `feature/quest/config/QuestProperties.java`, `application.yml` (`mezo.quest.cron-presence-days`).
- 30 prompt-site files (table A) + the test pins listed in table C.
- `feature/notification/service/PushSubscriptionService.java`, `feature/notification/repository/PushSubscriptionRepository.java`.

**Frontend — create**
- `frontend/src/shared/lib/userScope.ts` (+ `userScope.test.ts`) — `setCurrentUserId`, `currentUserId`, `userScopedKey(base)`.
- `frontend/src/features/character/components/TranscriptTurn.test.tsx`.

**Frontend — modify**
- `frontend/src/app/auth/AuthGate.tsx` (set/clear the scope id), `features/character/components/TranscriptTurn.tsx`, `data/character/characterMock.ts`, `data/me/meHooks.ts` (+ test), `features/me/pages/EnHubPage.tsx`, the six storage sites + their tests: `shared/lib/seenMessages.ts`, `features/today/logic/nudgeSeen.ts`, `features/me/logic/nightTrace.ts`, `features/me/logic/sleepEscalation.ts`, `features/train/logic/morningWindow.ts`, `shared/hooks/useStickyTab.ts`. `shared/lib/theme.ts` is **not** touched.

**Docs**
- Rewrite: `docs/features/_platform-auth-security.md` §4/§5/§8/§9/§10. New: `docs/references/security_conventions.md`, `docs/decisions/0034-multi-user-account-model.md`. Touch: `docs/references/liquibase_conventions.md:158`, `docs/references/integration_test_framework.md:124-126`, `AGENTS.md:159`, `docs/features/me.md:16` (§9), `docs/features/character.md:168,903`, `docs/features/_platform-notifications.md:570-571`, `docs/features/_platform-api-backend.md` §9, `docs/CODEMAP.md` (generated).

---

## Table A — prompt-site inventory (`grep -rn "Daniel" backend/src/main/java`, prompt/label sites only)

"Threaded today" is always a **static string literal** — no site receives the name as a parameter. "Render site" is where `promptPersona.render(userId, …)` is added (Tasks 2–4). Javadoc/comment mentions (`DecisionEntryRepository:23`, `CharacterObservationRepository:23`, `CharacterService:313,316`, `KonziliumProposalRound:85`, `CharacterFeedbackService:29,36,46,177`, `WeeklyReviewContextSources:61`, `DiagnosisRecipe:15`, `ChallengeEntity:24`, `ExperimentEntity:20`, `InsightsTools:24`, `FakeCompanionLlm:150`, `PatternEntity:115`, `NoteEmbeddingCatchUp:21`, `GraphNodeEntity:26`, `ProfileAssembler:37`, `PatternService:70,101`, `ContextSnapshotAssembler:288`, `PromptMemoryAssembler:246`) and demo seed copy (`PeopleSeedData:81`, `TrainSeedData:118,154,253`) are out of scope.

| # | File (`backend/src/main/java/io/mrkuhne/mezo/…`) | Line(s) | Current literal | Replacement | Render site |
|---|---|---|---|---|---|
| 1 | `feature/companion/service/ChatService.java` | 68 | `Te vagy a mezo, Daniel személyes egészség- és teljesítmény-társa.` | `Te vagy a mezo, {{NÉV}} személyes egészség- és teljesítmény-társa.` | `assembleSystemPrompt` :335-347 — wrap the whole return expression |
| 1 | | 74 | `ha Daniel listát kért` | `ha {{NÉV}} listát kért` | same |
| 1 | | 86 | `vagy Daniel üzenetéből származik` | `vagy {{NÉV}} üzenetéből származik` | same |
| 1 | | 102 | `amikor Daniel az adataira kíváncsi` | `amikor {{NÉV}} az adataira kíváncsi` | same |
| 1 | | 105 | `amikor Daniel kifejezetten kéri` | `amikor {{NÉV}} kifejezetten kéri` | same |
| 1 | | 110 | `Ha Daniel személyes` | `Ha {{NÉV}} személyes` | same |
| 1 | | 146 | `Ez beszélgetés Daniellel, nem adatlekérdezés.` | `Ez beszélgetés a társaddal ({{NÉV}}), nem adatlekérdezés.` | same (`TONE_REMINDER` is part of the wrapped expression) |
| 2 | `feature/companion/advisor/TurnVerdictCheck.java` | 42 | `sem Daniel üzenete nem támaszt alá` | `sem a felhasználó üzenete nem támaszt alá` | none — label only (`check(...)` has no `userId`) |
| 2 | | 59 | `"\n\nDaniel üzenete: "` | `"\n\nA felhasználó üzenete: "` | none |
| 3 | `feature/companion/advisor/AdvisorRetry.java` | 21 | `vagy Daniel üzenetéből állíts` | `vagy a felhasználó üzenetéből állíts` | none — static `block(...)` |
| 4 | `feature/companion/service/FactExtractionService.java` | 47 | `a Danielre vonatkozó ÚJ, tartós tényeket` | `a felhasználóra ({{NÉV}}) vonatkozó ÚJ, tartós tényeket` | `extractFromTurn` — render `EXTRACTION_PROMPT` before the `companionLlm` call |
| 4 | | 48 | `amit Daniel maga állított` | `amit {{NÉV}} maga állított` | same |
| 4 | | 70 | `"Daniel: " + userContent` | `PromptPersona.USER_TURN_LABEL + userContent` | label |
| 5 | `feature/companion/service/KnowledgeFactService.java` | 41 | `MEGERŐSÍTETT TÉNYEK Danielről (legfontosabb elöl):` | `MEGERŐSÍTETT TÉNYEK {{NÉV}} személyéről (legfontosabb elöl):` | `renderPromptBlock(userId)` :153 — `new StringBuilder(promptPersona.render(userId, FACTS_HEADER))` |
| 6 | `feature/companion/service/DailySummaryService.java` | 67 | `összefoglalót Daniel napjáról` | `összefoglalót {{NÉV}} napjáról` | `generate` :110 — `companionLlm.complete(promptPersona.render(userId, NARRATIVE_PROMPT), digest)` |
| 7 | `feature/companion/service/HypothesisPipelineService.java` | 71 | `hipotézist Daniel adatairól` | `hipotézist {{NÉV}} adatairól` | `propose(userId, context)` :231 — render after `String.format` |
| 8 | `feature/companion/service/PeriodSummaryService.java` | 51 | `heti összefoglalóvá Daniel hetéről` | `heti összefoglalóvá {{NÉV}} hetéről` | :128 `companionLlm.complete(promptPersona.render(userId, prompt), payload)` |
| 8 | | 57 | `havi összefoglalóvá Daniel hónapjáról` | `havi összefoglalóvá {{NÉV}} hónapjáról` | same |
| 9 | `feature/companion/service/MesoReviewGenerator.java` | 68 | `Daniel edzés-társa vagy` | `{{NÉV}} edzés-társa vagy` | `generate(userId, mesocycleId)` :131 |
| 9 | | 72 | `minősítsd Danielt` | `minősítsd őt` | same |
| 10 | `feature/companion/quarterly/service/QuarterlyReviewService.java` | 78 | `Te Daniel személyes társának` | `Te {{NÉV}} személyes társának` | :124 — `String prompt = promptPersona.render(userId, SYSTEM_PROMPT.formatted(...))` |
| 10 | | 91 | `Ne szólítsd meg Danielt` | `Ne szólítsd meg őt` | same |
| 11 | `feature/companion/profile/service/ProfileAssembler.java` | 84 | `Te Daniel személyes társának` | `Te {{NÉV}} személyes társának` | `rebuild(userId, …)` :142 |
| 11 | | 85 | `HOGYAN érdemes Daniellel beszélni` | `HOGYAN érdemes vele beszélni` | same |
| 12 | `feature/companion/graph/service/LifeEventExtractionService.java` | 88 | `Bemenet: Daniel egy napjának saját szövegei` | `Bemenet: {{NÉV}} egy napjának saját szövegei` | `extractFor(userId, day)` :138 |
| 13 | `feature/companion/service/PersonExtractionService.java` | 110 | `Bemenet: Daniel egy napjának saját szövegei` | `Bemenet: {{NÉV}} egy napjának saját szövegei` | `extractFor(userId, day)` :172 |
| 14 | `feature/companion/llm/HabitSuggestLlmAdapter.java` | 66 | `Daniel szokás-rendszerének` | `{{NÉV}} szokás-rendszerének` | `suggest(userId, …)` :104 — render after `String.format` |
| 15 | `feature/companion/ChatHistory.java` | 27 | `"Daniel: "` | `PromptPersona.USER_TURN_LABEL` | label (static renderer) |
| 16 | `feature/companion/embedding/MemoryEmbeddingWriter.java` | 99 | `"Daniel: " + userContent` | `PromptPersona.USER_TURN_LABEL + userContent` | label |
| 17 | `feature/character/service/CharacterPromptAssembler.java` | 50 | `[Karakter — amit eddig megtudtam Danielről]` | `[Karakter — amit eddig megtudtam {{NÉV}} személyéről]` | `render(userId)` :89 — `new StringBuilder(promptPersona.render(userId, HEADER))` |
| 18 | `feature/proactive/service/CompanionMessageGenerator.java` | 71 | `eligazítást Danielnek` | `eligazítást {{NÉV}} számára` | `generateMorning` :231 |
| 18 | | 74 | `amint Daniel rögzítette` | `amint {{NÉV}} rögzítette` | same |
| 18 | | 94 | `Daniel most rögzítette` | `{{NÉV}} most rögzítette` | `generateSleepReaction` :281 |
| 18 | | 107 | `Daniel most mérte meg` | `{{NÉV}} most mérte meg` | `generateWeightReaction` :334 |
| 18 | | 133 | `jegyzetet Danielnek` | `jegyzetet {{NÉV}} számára` | `generateWindow` :388 |
| 18 | | 159 | `mondatot Danielnek` | `mondatot {{NÉV}} számára` | `generatePeopleObservation` :480 |
| 18 | | 165 | `hogy Daniel észrevegye` | `hogy {{NÉV}} észrevegye` | same |
| 19 | `feature/proactive/service/WeeklyReviewGenerator.java` | 84 | `Elemezd Daniel hetét` | `Elemezd {{NÉV}} hetét` | `generate` :142 |
| 19 | | 87 | `tartós, Danielre vonatkozó megállapítás` | `tartós, a felhasználóra ({{NÉV}}) vonatkozó megállapítás` | same |
| 20 | `feature/proactive/service/MemoirGenerator.java` | 74 | `Te vagy a mezo, Daniel egészség-` | `Te vagy a mezo, {{NÉV}} egészség-` | `generate` :166 |
| 20 | | 88 | `de a hét Danielé` | `de a hét az övé ({{NÉV}})` | same |
| 21 | `feature/proactive/service/PredictionGenerator.java` | 64 | `előrejelzést Danielről` | `előrejelzést {{NÉV}} számára` | `generate` :107 |
| 22 | `feature/proactive/service/ExperimentProposalGenerator.java` | 61 | `kísérletet Danielnek` | `kísérletet {{NÉV}} számára` | `propose` :106 |
| 23 | `feature/proactive/service/ChallengeGenerator.java` | 66 | `Daniel mai edzésére` | `{{NÉV}} mai edzésére` | `generate(userId, …)` :121 |
| 24 | `feature/proactive/service/WeeklySuggestionGenerator.java` | 45 | `tervjavaslatot Danielnek` | `tervjavaslatot {{NÉV}} számára` | `generate` :76 |
| 25 | `feature/proactive/service/DiagnosisRecipe.java` | 26, 53 | `Daniel azt kérdezi: miért fáradt?` / `… miért alszik rosszul?` | `{{NÉV}} azt kérdezi: …` | `DiagnosisGenerator.java:109` — `companionLlm.completeSmart(promptPersona.render(userId, prompt(recipe)), …)` |
| 26 | `feature/character/service/CharacterExpertCatalog.java` | 27, 34, 40, 46, 52, 59, 65 | `…, Daniel profilozó csapatának …` (7 personas) | `…, {{NÉV}} profilozó csapatának …` | consumers of `systemPersona()`: #27, #28, #30 |
| 27 | `feature/character/service/PortraitWriter.java` | 48 | `Te vagy Mezo, Daniel személyes` | `Te vagy Mezo, {{NÉV}} személyes` | `rewrite(owner, …)` :69-70 — render `systemPrompt` and `userMessage` |
| 27 | | 50 | `megszólítod meg Danielt` | `megszólítod meg őt` | same |
| 27 | | 128 | `portré-szöveget Danielről` | `portré-szöveget róla ({{NÉV}})` | same (`contract()` is inside `systemPrompt`) |
| 28 | `feature/character/service/KonziliumVerdictRound.java` | 202 | `Te vagy a Szkeptikus, Daniel profilozó` | `Te vagy a Szkeptikus, {{NÉV}} profilozó` | `callSmart(owner, …)` :272-276 — one render for both rounds |
| 28 | | 254 | `Te vagy Mezo, Daniel személyes` | `Te vagy Mezo, {{NÉV}} személyes` | same |
| 29 | `feature/character/service/KonziliumProposalRound.java` | 87 | `USER_FEEDBACK_PREFIX = "DANIEL VÁLASZA — "` | `"FELHASZNÁLÓ VÁLASZA — "` | wire marker (applied at :120) |
| 29 | | 368 | `A "DANIEL VÁLASZA —" jelöléssel kezdődő sorok Daniel saját válaszai` | `A "FELHASZNÁLÓ VÁLASZA —" jelöléssel kezdődő sorok a felhasználó ({{NÉV}}) saját válaszai` | :228 — render `systemPrompt` (persona + contract) |
| 30 | `feature/character/service/CharacterObservationService.java` | 120 | `expert.systemPersona()` (carries #26) | unchanged text | render `systemPrompt` at :120 |
| 31 | `feature/recipe/service/RecipeWorkshopService.java` | 127 | `"Daniel: "` | `PromptPersona.USER_TURN_LABEL` | label |
| 32 | `feature/companion/llm/CompanionHelloRunner.java` | 39 | `"Koszonj Danielnek!"` | `"Koszonj a felhasznalonak!"` | none (dev runner) |

## Table B — cron job inventory (every `@Scheduled` method; 22 classes iterate `appUserRepository.findAll()`)

"LLM" = the per-user body can reach a provider call. "Guard today" = the cheapest existing pre-spend gate. Every row's loop is replaced by `userFanOut.forEachActiveUser(...)` in Task 7.

| # | Job (`backend/src/main/java/io/mrkuhne/mezo/feature/…`) | `findAll()` line | LLM | Guard today | Change |
|---|---|---|---|---|---|
| 1 | `habit/service/HabitJob.runClose` | :32 | no | — | fan-out only |
| 2 | `notification/service/NotificationDispatchJob.runOnce` | :89 | no | `pushLogRepository.existsByCreatedByAndLogDateAndDedupKey` :114 | fan-out only |
| 3 | `character/service/CharacterObservationJob.run` | :37 | yes | `CharacterObservationService.generateForDay` :73 `signals.isEmpty()` + per-expert `existsByCreatedByAndExpertKeyAndDay` :84 | fan-out only |
| 4 | `character/service/CharacterConferenceJob.run` | :40 | yes | `CharacterConferenceService.runWeekly` :88 `weekObservations.isEmpty() → null` | fan-out only |
| 5 | `character/service/CharacterMonthlyJob.run` | :51 | yes | `CharacterMonthlyService.run` :104 `activeClaims.isEmpty() → null` | fan-out only |
| 6 | `quest/service/QuestJob.runGenerate` | :41 | **yes** (`QuestFlavor.rewrite` :48) | **none** — every user gets quests + a flavor call daily | **add** `DailyQuestRepository.existsByCreatedByAndQuestDateGreaterThanEqual(userId, today.minusDays(cronPresenceDays))` guard |
| 7 | `quest/service/QuestJob.runFinalize` | :62 | no | — | fan-out only |
| 8 | `proactive/service/WeeklyReviewJob.run` | :39 | yes | `WeeklyReviewGenerator.gather` :177-179 `anyData` over `MeWeekService.week` | fan-out only |
| 9 | `proactive/service/WeeklySuggestionJob.run` | :35 | yes | `WeeklySuggestionGenerator.gather` :96 `priorWeek.isEmpty() → null` | fan-out only |
| 10 | `proactive/service/PredictionJob.runWeekly` | :37 | yes | `PredictionGenerator.generate` :97 exists-for-week + `gather` :153 confirmed patterns empty | fan-out only |
| 11 | `proactive/service/PredictionJob.runValidation` | :51 | no | — | fan-out only |
| 12 | `proactive/service/MemoirJob.run` | :36 | yes | `MemoirGenerator.gather` :197 `week.isEmpty() → null` | fan-out only |
| 13 | `proactive/service/ExperimentJob.runPropose` | :34 | yes | `ExperimentProposalGenerator.propose` :97 cap + `gather` :149 confirmed empty | fan-out only |
| 14 | `proactive/service/ExperimentJob.runOutcome` | :48 | no | — | fan-out only |
| 15 | `proactive/service/ChallengeJob.runOutcome` | :35 | no | — | fan-out only |
| 16 | `proactive/service/CompanionMessageJob.runMorning` (morning + sleep + people) | :37 | yes | `generateMorning` :206 no `daily_summary` in `feed.pastDays` window; `generateSleepReaction` :264 no sleep log newer than 2 days; `generatePeopleObservation` :433 `weekMentions.isEmpty()` | fan-out only |
| 17 | `proactive/service/CompanionMessageJob.runMidday/runEvening → runWindow` | :76 | yes | `generateWindow` :370 same daily-summary window gate | fan-out only |
| 18 | `companion/flags/service/FlagSweepJob.run` | :31 | no | — | fan-out only |
| 19 | `companion/graph/service/GraphMaintenanceJob.run` | :53 | yes (phases 3–4) | `LifeEventExtractionService.extractFor` :127 `narrative.isBlank() → 0`; `PersonExtractionService.extractFor` :157 `toneless.isEmpty() && narrative.isBlank()` | fan-out only |
| 20 | `companion/feedback/service/FeedbackLearningJob.run` | :31 | no | — | fan-out only |
| 21 | `companion/profile/service/ProfileAssemblerJob.run` | :46 | yes | `ProfileAssembler.rebuild` :135 no signals/decisions/nodes → `Optional.empty()` | fan-out only |
| 22 | `companion/service/HypothesisJob.run` | :29 | yes | `HypothesisPipelineService.run` :113 `gather == null → 0` (:167 no daily summaries) | fan-out only |
| 23 | `companion/service/ConsolidationJob.runWeekly/runMonthly` | :55, :72 | yes | `PeriodSummaryService.generateWeek/Month` :86/:116 `lines.isEmpty() → null` | fan-out only |
| 24 | `companion/service/DailySummaryJob.run` | :56 | yes (+ embeddings) | `DailySummaryService.generate` :104 `digest == null → null`; turn/note embedding passes only touch existing rows | fan-out only |
| 25 | `companion/service/PatternDetectionJob.run` | :30 | no (statistical) | — | fan-out only |
| 26 | `companion/quarterly/service/QuarterlyReviewJob.run` | :101 | yes | `QuarterlyReviewService.runFor` :117 `current.isEmpty() → 0` + `ProfileAssembler` gate | fan-out only |
| 27 | `llmlog/service/LlmLogRetentionJob.run` | — (table-wide, no user loop) | no | — | **unchanged** |

(23 job classes = 22 with a user loop + `LlmLogRetentionJob`; 31 `@Scheduled` methods in total.)

## Table C — test pins that break on the rename

| Test | Line | Change |
|---|---|---|
| `feature/character/KonziliumUserFeedbackIT.java` | 45 (javadoc), 99 (method name `…_withDanielPrefix`), 115 | `"FELHASZNÁLÓ VÁLASZA — Cáfolat: rendszeresen kihagyja a naplózást."`; rename to `…_withUserPrefix` |
| `feature/character/CharacterPromptAssemblerIT.java` | 102 | `contains("[Karakter — amit eddig megtudtam " + <user name> + " személyéről]")` |
| `feature/companion/ChatHistoryTest.java` | 25, 27 | `"Felhasználó: korábbi kérdés\n"` |
| `feature/companion/ChatServiceIT.java` | 287, 300, 303, 374, 376, 379 | `"Daniel: "` → `"Felhasználó: "` |
| `feature/companion/ChatStreamServiceIT.java` | 255, 256 | same |
| `feature/companion/llm/GeminiCompanionLlmRecordingTest.java` | 108, 111, 134, 135 | same |
| `feature/companion/embedding/TurnEmbeddingListenerIT.java` | 43 | `startsWith("Felhasználó: ma leg-day volt")` |
| `feature/companion/embedding/MemoryEmbeddingWriterIT.java` | 66 | `isEqualTo("Felhasználó: mit egyek?\nMezo: fehérjét")` |

Input-only pins that keep passing unchanged: `LlmLogWriterIT:140-148`, `PromptMemoryAssemblerIT` (seeds its own content), `PromptMemoryAssemblerTest:94`, `AmbientRecallTuningIT:74-81`, `FactExtractionServiceIT:174`, `AnchorResolverIT:121,324`, `QuestFlavorIT:35,42`, `CharacterApiIT:291,300`, `CharacterFeedPage.test.tsx:59`.

---

### Task 1: `PersonaContext` + `PromptPersona` in `feature/auth`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/PersonaContext.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/PromptPersona.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/auth/service/PromptPersonaTest.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/auth/service/PromptPersonaIT.java`

**Interfaces:**
- Consumes: `AppUserRepository.findById(UUID)`, `AppUserEntity.getName()` (S1).
- Produces: `record PersonaContext(String userName)` with `PersonaContext.FALLBACK` (`"a felhasználó"`) and `PersonaContext.of(String name)`; `PromptPersona.NAME_TOKEN = "{{NÉV}}"`, `PromptPersona.USER_TURN_LABEL = "Felhasználó: "`, `PersonaContext forUser(UUID userId)`, `String render(UUID userId, String template)`, `static String fill(PersonaContext persona, String template)`.

- [ ] **Step 1: Write the failing unit test**

`PromptPersonaTest.java`:

```java
package io.mrkuhne.mezo.feature.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PromptPersonaTest {

    @Test
    void testFill_shouldSubstituteEveryToken_whenTemplateCarriesSeveral() {
        String out = PromptPersona.fill(PersonaContext.of("Anna"),
                "Te vagy a mezo, {{NÉV}} társa. Elemezd {{NÉV}} hetét.");
        assertThat(out).isEqualTo("Te vagy a mezo, Anna társa. Elemezd Anna hetét.");
    }

    @Test
    void testFill_shouldLeaveTemplateUntouched_whenNoToken() {
        assertThat(PromptPersona.fill(PersonaContext.of("Anna"), "nincs token")).isEqualTo("nincs token");
    }

    @Test
    void testOf_shouldTrimAndFallBack_whenNameBlank() {
        assertThat(PersonaContext.of("  Béla  ").userName()).isEqualTo("Béla");
        assertThat(PersonaContext.of("   ")).isEqualTo(PersonaContext.FALLBACK);
        assertThat(PersonaContext.of(null)).isEqualTo(PersonaContext.FALLBACK);
    }

    @Test
    void testUserTurnLabel_shouldBeNeutral() {
        assertThat(PromptPersona.USER_TURN_LABEL).isEqualTo("Felhasználó: ");
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest='PromptPersonaTest'`
Expected: compilation error — `PersonaContext`/`PromptPersona` missing.

- [ ] **Step 3: Implement the record and the service**

`PersonaContext.java`:

```java
package io.mrkuhne.mezo.feature.auth.service;

/**
 * Who a prompt speaks about (S6, mezo-qw37.6). Plain display name as the user typed it at
 * registration/onboarding — no first-name splitting (Hungarian and Western name order cannot be
 * told apart) and no case inflection in this slice (spec §10).
 */
public record PersonaContext(String userName) {

    /** Used when the user row cannot be loaded — reads naturally in every template position. */
    public static final PersonaContext FALLBACK = new PersonaContext("a felhasználó");

    public static PersonaContext of(String name) {
        if (name == null || name.isBlank()) {
            return FALLBACK;
        }
        return new PersonaContext(name.strip());
    }
}
```

`PromptPersona.java`:

```java
package io.mrkuhne.mezo.feature.auth.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The ONE place prompt templates get their user name (S6, mezo-qw37.6). Templates stay
 * {@code static final} and carry {@link #NAME_TOKEN}; each prompt site calls
 * {@link #render(UUID, String)} once, right before its LLM call. Lives in feature/auth because
 * every feature may depend on auth and auth on no other feature (ArchUnit slice rule).
 */
@Service
@RequiredArgsConstructor
public class PromptPersona {

    /** The literal every prompt template uses for the user's name. */
    public static final String NAME_TOKEN = "{{NÉV}}";

    /** Transcript role label for the user's turns (chat history, embeddings, extraction) —
     *  neutral on purpose, the same precedent as the {@code FELHASZNÁLÓ VÁLASZA —} wire marker:
     *  stored rows must not vary with a display name. */
    public static final String USER_TURN_LABEL = "Felhasználó: ";

    private final AppUserRepository appUserRepository;

    @Transactional(readOnly = true)
    public PersonaContext forUser(UUID userId) {
        if (userId == null) {
            return PersonaContext.FALLBACK;
        }
        return appUserRepository.findById(userId)
                .map(AppUserEntity::getName)
                .map(PersonaContext::of)
                .orElse(PersonaContext.FALLBACK);
    }

    public String render(UUID userId, String template) {
        return fill(forUser(userId), template);
    }

    public static String fill(PersonaContext persona, String template) {
        return template.replace(NAME_TOKEN, persona.userName());
    }
}
```

- [ ] **Step 4: Run the unit test**

Run: `cd backend && ./mvnw clean test -Dtest='PromptPersonaTest'`
Expected: PASS.

- [ ] **Step 5: Write the failing IT (name resolution + fallback)**

`PromptPersonaIT.java`:

```java
package io.mrkuhne.mezo.feature.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class PromptPersonaIT extends AbstractIntegrationTest {

    @Autowired private PromptPersona promptPersona;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRender_shouldUseTheUsersName_whenUserExists() {
        AppUserEntity user = userPopulator.createUser("persona@test.local");
        user.setName("Anna");
        userPopulator.save(user);

        assertThat(promptPersona.render(user.getId(), "Elemezd {{NÉV}} hetét."))
                .isEqualTo("Elemezd Anna hetét.");
    }

    @Test
    void testRender_shouldFallBack_whenUserUnknown() {
        assertThat(promptPersona.render(UUID.randomUUID(), "Te vagy a mezo, {{NÉV}} társa."))
                .isEqualTo("Te vagy a mezo, a felhasználó társa.");
    }
}
```

Add to `backend/src/test/java/io/mrkuhne/mezo/support/populator/UserPopulator.java`:

```java
    /** Persists edits made on a populated user (name, status, onboardedAt). */
    public AppUserEntity save(AppUserEntity user) {
        return appUserRepository.saveAndFlush(user);
    }
```

- [ ] **Step 6: Run the IT**

Run: `cd backend && ./mvnw clean test -Dtest='PromptPersona*' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/PersonaContext.java backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/PromptPersona.java backend/src/test/java/io/mrkuhne/mezo/feature/auth/service backend/src/test/java/io/mrkuhne/mezo/support/populator/UserPopulator.java
git commit -m "feat(auth): PersonaContext + PromptPersona — one {{NÉV}} substitution helper (mezo-qw37.6)"
```

---
### Task 2: Companion prompt sites — chat, extraction, summaries, labels (table A #1–#17)

**Files:**
- Modify (table A rows): `ChatService.java`, `TurnVerdictCheck.java`, `AdvisorRetry.java`, `FactExtractionService.java`, `KnowledgeFactService.java`, `DailySummaryService.java`, `HypothesisPipelineService.java`, `PeriodSummaryService.java`, `MesoReviewGenerator.java`, `QuarterlyReviewService.java`, `ProfileAssembler.java`, `LifeEventExtractionService.java`, `PersonExtractionService.java`, `HabitSuggestLlmAdapter.java`, `ChatHistory.java`, `MemoryEmbeddingWriter.java`, `CharacterPromptAssembler.java`, `RecipeWorkshopService.java`, `CompanionHelloRunner.java`
- Test: table C rows for `ChatHistoryTest`, `ChatServiceIT`, `ChatStreamServiceIT`, `GeminiCompanionLlmRecordingTest`, `TurnEmbeddingListenerIT`, `MemoryEmbeddingWriterIT`, `CharacterPromptAssemblerIT`; new assertion in `ChatServiceIT`.

**Interfaces:**
- Consumes: `PromptPersona.render(UUID, String)`, `PromptPersona.USER_TURN_LABEL`, `PromptPersona.NAME_TOKEN` (Task 1).
- Produces: nothing new — templates now carry `{{NÉV}}`; `ChatHistory.render` output starts user turns with `Felhasználó: `.

- [ ] **Step 1: Write the failing test — the chat system prompt carries the user's name**

Add to `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceIT.java` (next to the existing system-block assertions around :374 — reuse that test's way of obtaining `systemBlock` from the fake's echo):

```java
    @Test
    void testSendMessage_shouldAddressTheUserByName_whenSystemPromptIsAssembled() {
        AppUserEntity user = userPopulator.createUser("named-chat@test.local");
        user.setName("Anna");
        userPopulator.save(user);
        UUID userId = user.getId();
        UUID conversationId = aiConversationPopulator.createConversation(userId).getId();

        MessageResponse answer = chatService.sendMessage(userId, conversationId,
                new SendMessageRequest(FakeCompanionLlm.SYSTEM_ECHO_SENTINEL));
        String systemBlock = answer.getContent();

        assertThat(systemBlock).contains("Te vagy a mezo, Anna személyes egészség- és teljesítmény-társa.");
        assertThat(systemBlock).doesNotContain("Daniel").doesNotContain(PromptPersona.NAME_TOKEN);
    }
```

(Use whatever echo sentinel the existing `:374` test uses to get the system block into `answer.getContent()` — copy that test's request literal; the name of the constant differs per fake mode. Import `io.mrkuhne.mezo.feature.auth.service.PromptPersona`.)

Also apply table C: `ChatHistoryTest:25,27`, `ChatServiceIT:287,300,303,374,376,379`, `ChatStreamServiceIT:255,256`, `GeminiCompanionLlmRecordingTest:108,111,134,135`, `TurnEmbeddingListenerIT:43`, `MemoryEmbeddingWriterIT:66` — replace `"Daniel: ` with `"Felhasználó: ` in each listed line. `CharacterPromptAssemblerIT:102` → `assertThat(block).contains("[Karakter — amit eddig megtudtam ").contains(" személyéről]")` plus `.doesNotContain("Daniel")`.

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest='ChatServiceIT,ChatHistoryTest' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — system prompt still says "Daniel", history still renders "Daniel: ".

- [ ] **Step 3: Rewrite the templates (table A #1–#17 literal replacements)**

Apply every "Replacement" cell of table A rows 1–17 verbatim. Concretely, the label sites:

`ChatHistory.java:27`:
```java
            rendered.append(turn.role() == Role.USER ? PromptPersona.USER_TURN_LABEL : "Mezo: ")
```
`FactExtractionService.java:70`:
```java
        String transcript = PromptPersona.USER_TURN_LABEL + userContent + "\nMezo: " + assistantContent;
```
`MemoryEmbeddingWriter.java:99`:
```java
                PromptPersona.USER_TURN_LABEL + userContent + "\nMezo: " + assistant.getContent(),
```
`RecipeWorkshopService.java:127`:
```java
                sb.append("user".equals(m.getRole()) ? PromptPersona.USER_TURN_LABEL : "Műhely: ").append(m.getText()).append('\n');
```
`TurnVerdictCheck.java:59`: `+ "\n\nA felhasználó üzenete: " + userMessage`. `CompanionHelloRunner.java:39`: `"Koszonj a felhasznalonak!"`.

Add `import io.mrkuhne.mezo.feature.auth.service.PromptPersona;` to each of those files.

- [ ] **Step 4: Inject `PromptPersona` and render at each call site**

Add `private final PromptPersona promptPersona;` (Lombok constructor) + the import to: `ChatService`, `FactExtractionService`, `KnowledgeFactService`, `DailySummaryService`, `HypothesisPipelineService`, `PeriodSummaryService`, `MesoReviewGenerator`, `QuarterlyReviewService`, `ProfileAssembler`, `LifeEventExtractionService`, `PersonExtractionService`, `HabitSuggestLlmAdapter`, `CharacterPromptAssembler`. Then:

`ChatService.assembleSystemPrompt` (:335-347):
```java
    private String assembleSystemPrompt(UUID userId, LocalDate today, String memoriesBlock, String graphBlock,
            String contextKind, LocalDate contextDate) {
        return promptPersona.render(userId, SYSTEM_PROMPT
                + contextSnapshotAssembler.render(userId, today)
                + anchoredBlock(userId, contextKind, contextDate)
                + knowledgeFactService.renderPromptBlock(userId)
                + knowledgeFactService.renderNewPatternFactsBlock(userId)
                + characterBlock(userId)
                + profileBlock(userId)
                + memoriesBlock
                + graphBlock
                + TONE_REMINDER);
    }
```
`FactExtractionService.extractFromTurn`: the `companionLlm.complete(EXTRACTION_PROMPT, …)` call becomes `companionLlm.complete(promptPersona.render(userId, EXTRACTION_PROMPT), …)` (locate with `grep -n "EXTRACTION_PROMPT" FactExtractionService.java`).
`KnowledgeFactService.renderPromptBlock` :153: `StringBuilder block = new StringBuilder(promptPersona.render(userId, FACTS_HEADER));`.
`DailySummaryService.generate` :110: `() -> companionLlm.complete(promptPersona.render(userId, NARRATIVE_PROMPT), digest)`.
`HypothesisPipelineService.propose` :231: `String prompt = promptPersona.render(userId, String.format(Locale.ROOT, PROPOSE_PROMPT, properties.hypotheses().maxPerRun()));`.
`PeriodSummaryService` :128: `() -> companionLlm.complete(promptPersona.render(userId, prompt), payload)`.
`MesoReviewGenerator.generate` :131: `() -> companionLlm.completeSmart(promptPersona.render(userId, SYSTEM_PROMPT), payload(run, windowEnd, stored))`.
`QuarterlyReviewService.runFor` :124: `String prompt = promptPersona.render(userId, SYSTEM_PROMPT.formatted(properties.maxCandidates()));`.
`ProfileAssembler.rebuild` :142: `() -> companionLlm.completeSmart(promptPersona.render(userId, PROMPT), payload)`.
`LifeEventExtractionService.extractFor` :138: `() -> companionLlm.complete(promptPersona.render(userId, SYSTEM_PROMPT), buildUserMessage(narrative, existing))`.
`PersonExtractionService.extractFor` :172: `() -> companionLlm.complete(promptPersona.render(userId, SYSTEM_PROMPT), buildUserMessage(narrative, toneless, persons))`.
`HabitSuggestLlmAdapter.suggest` :104: `String prompt = promptPersona.render(userId, String.format(Locale.ROOT, SYSTEM_PROMPT, properties.habitSuggest().maxSuggestions()));`.
`CharacterPromptAssembler.render` :89: `StringBuilder result = new StringBuilder(promptPersona.render(userId, HEADER));`.

- [ ] **Step 5: Run the focused tests + ArchUnit**

Run: `cd backend && ./mvnw clean test -Dtest='ChatServiceIT,ChatStreamServiceIT,ChatHistoryTest,GeminiCompanionLlmRecordingTest,TurnEmbeddingListenerIT,MemoryEmbeddingWriterIT,CharacterPromptAssemblerIT,FactExtractionServiceIT,KnowledgeFactServiceIT,ProfilePromptAssemblerIT,DailySummaryServiceIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS. Then `grep -rn '"Daniel' backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/main/java/io/mrkuhne/mezo/feature/recipe` → no hits.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/main/java/io/mrkuhne/mezo/feature/recipe backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterPromptAssembler.java backend/src/test/java/io/mrkuhne/mezo/feature/companion backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterPromptAssemblerIT.java
git commit -m "feat(companion): prompts address the user by app_user.name; neutral transcript label (mezo-qw37.6)"
```

---

### Task 3: Proactive prompt sites (table A #18–#25)

**Files:**
- Modify: `feature/proactive/service/CompanionMessageGenerator.java`, `WeeklyReviewGenerator.java`, `MemoirGenerator.java`, `PredictionGenerator.java`, `ExperimentProposalGenerator.java`, `ChallengeGenerator.java`, `WeeklySuggestionGenerator.java`, `DiagnosisRecipe.java`, `DiagnosisGenerator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/WeeklySuggestionNameIT.java` (new)

**Interfaces:**
- Consumes: `PromptPersona.render(UUID, String)`.

- [ ] **Step 1: Write the failing IT**

`WeeklySuggestionNameIT.java` (pattern: the existing `WeeklySuggestionGeneratorIT` in the same package — copy its `@ActiveProfiles("companion-fake")`, populators and the way it seeds a prior-week `daily_summary` so `gather` is non-null; the fake echoes the system prompt through `FakeCompanionLlm`'s echo sentinel planted in a summary narrative — reuse that test's sentinel literally):

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.proactive.service.WeeklySuggestionGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("companion-fake")
class WeeklySuggestionNameIT extends AbstractIntegrationTest {

    @Autowired private WeeklySuggestionGenerator generator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;

    @Test
    void testGenerate_shouldNameTheUser_whenPromptIsRendered() {
        AppUserEntity user = userPopulator.createUser("weekly-name@test.local");
        user.setName("Anna");
        userPopulator.save(user);
        LocalDate weekStart = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        dailySummaryPopulator.summary(user.getId(), weekStart.minusDays(3),
                "Edzés és jó alvás. " + io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm.SYSTEM_ECHO_SENTINEL);

        var suggestion = generator.generate(user.getId(), weekStart);

        assertThat(suggestion).isNotNull();
        assertThat(suggestion.getProse()).contains("tervjavaslatot Anna számára").doesNotContain("Daniel");
    }
}
```

(`DailySummaryPopulator.summary(owner, date, narrative)` and the echo-sentinel constant name: confirm both with `grep -n "public .*summary(" backend/src/test/java/io/mrkuhne/mezo/support/populator/DailySummaryPopulator.java` and `grep -n "ECHO" backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java`; use the actual names.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest='WeeklySuggestionNameIT' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — prose contains "Danielnek".

- [ ] **Step 3: Rewrite the templates and render**

Apply table A rows 18–25 replacements verbatim. Inject `private final PromptPersona promptPersona;` (+ import) into the seven generators and `DiagnosisGenerator`, then:

- `CompanionMessageGenerator`: `:231 companionLlm.complete(promptPersona.render(userId, MORNING_PROMPT), payload.toString())`; `:281 … render(userId, SLEEP_PROMPT) …`; `:334 … render(userId, WEIGHT_PROMPT) …`; `:388 companionLlm.complete(promptPersona.render(userId, WINDOW_PROMPT), payload, …)` (keep the trailing tool args); `:480 … render(userId, PEOPLE_PROMPT) …`.
- `WeeklyReviewGenerator:142`, `MemoirGenerator:166`, `PredictionGenerator:107`, `ExperimentProposalGenerator:106`, `ChallengeGenerator:121`, `WeeklySuggestionGenerator:76`: replace the first argument `PROMPT` with `promptPersona.render(userId, PROMPT)`.
- `DiagnosisRecipe.java:26,53`: `"{{NÉV}} azt kérdezi: miért fáradt?"`, `"{{NÉV}} azt kérdezi: miért alszik rosszul?"`. `DiagnosisGenerator.java:109`: `companionLlm.completeSmart(promptPersona.render(userId, prompt(recipe)), gather.payload())`.

- [ ] **Step 4: Run focused proactive tests**

Run: `cd backend && ./mvnw clean test -Dtest='WeeklySuggestionNameIT,CompanionMessage*IT,WeeklyReview*IT,Memoir*IT,Prediction*IT,Experiment*IT,Challenge*IT,Diagnosis*IT' -Dmezo.test.use-testcontainers=true`
Expected: PASS. `grep -rn "Daniel" backend/src/main/java/io/mrkuhne/mezo/feature/proactive` → only javadoc hits (`WeeklyReviewContextSources:61`, `DiagnosisRecipe:15`, entities).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/proactive backend/src/test/java/io/mrkuhne/mezo/feature/proactive
git commit -m "feat(proactive): generators address the user by name via PromptPersona (mezo-qw37.6)"
```

---
### Task 4: Character prompt sites + wire marker `FELHASZNÁLÓ VÁLASZA —` (table A #26–#30)

**Files:**
- Modify: `feature/character/service/CharacterExpertCatalog.java`, `PortraitWriter.java`, `KonziliumVerdictRound.java`, `KonziliumProposalRound.java`, `CharacterObservationService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/KonziliumUserFeedbackIT.java` (table C), new assertion there for the persona name.

**Interfaces:**
- Consumes: `PromptPersona.render(UUID, String)`.
- Produces: `KonziliumProposalRound.USER_FEEDBACK_PREFIX = "FELHASZNÁLÓ VÁLASZA — "` (package-private, unchanged visibility) — the FE (Task 5) parses this **and** the legacy `DANIEL VÁLASZA — `.

- [ ] **Step 1: Update the failing IT pins**

In `KonziliumUserFeedbackIT.java`: line 45 javadoc → `"FELHASZNÁLÓ VÁLASZA —"`; rename the test at :99 to `userObservation_namingCoreDimension_routesToOwningExpert_withUserPrefix`; line 115 →

```java
                        .contains("FELHASZNÁLÓ VÁLASZA — Cáfolat: rendszeresen kihagyja a naplózást."));
```

Add a second assertion in the same test proving the persona was rendered (the echoed rationale is the full user message, and the expert persona reaches the system prompt — assert on what the echo carries, the evidence line, and separately that no token leaked):

```java
        assertThat(result.proposals()).singleElement()
                .satisfies(p -> assertThat(p.rationale()).doesNotContain("DANIEL VÁLASZA").doesNotContain("{{NÉV}}"));
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest='KonziliumUserFeedbackIT' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — evidence line still carries `DANIEL VÁLASZA —`.

- [ ] **Step 3: Rewrite the templates**

- `CharacterExpertCatalog.java:27,34,40,46,52,59,65`: in each persona text block replace `Daniel profilozó csapatának` with `{{NÉV}} profilozó csapatának` (7 occurrences; the list stays `static final`).
- `PortraitWriter.java:48` → `Te vagy Mezo, {{NÉV}} személyes egészség- és teljesítmény-társa, most integrátor \`; `:50` → `mindig második személyben szólítod meg őt.`; `:128` → `Írj 2–5 mondatos, egyszerű magyar nyelvű portré-szöveget róla ({{NÉV}}), második \`.
- `KonziliumVerdictRound.java:202` → `Te vagy a Szkeptikus, {{NÉV}} profilozó csapatának kritikus tagja. …`; `:254` → `Te vagy Mezo, {{NÉV}} személyes egészség- és teljesítmény-társa, most integrátor …`.
- `KonziliumProposalRound.java:87`:
```java
    static final String USER_FEEDBACK_PREFIX = "FELHASZNÁLÓ VÁLASZA — ";
```
  and `:368` → `jellegű állításokat. A "FELHASZNÁLÓ VÁLASZA —" jelöléssel kezdődő sorok a felhasználó ({{NÉV}}) saját \` (the next line's `válaszai — ezek FELÜLÍRJÁK …` stays).

- [ ] **Step 4: Render at the four call sites**

Inject `private final PromptPersona promptPersona;` (+ import `io.mrkuhne.mezo.feature.auth.service.PromptPersona`) into `PortraitWriter`, `KonziliumVerdictRound`, `KonziliumProposalRound`, `CharacterObservationService`.

`PortraitWriter.rewrite` :69-70:
```java
        String systemPrompt = promptPersona.render(owner, PORTRAIT_MARKER + "\n" + persona(dimension) + "\n" + contract());
        String userMessage = promptPersona.render(owner, userMessage(dimension, activeClaims));
```
`KonziliumVerdictRound.callSmart` :272-276 (both rounds funnel through it):
```java
    private String callSmart(UUID owner, String operation, String systemPrompt, String userMessage) {
        String renderedSystem = promptPersona.render(owner, systemPrompt);
        String renderedUser = promptPersona.render(owner, userMessage);
        return llmCallContextHolder.runWith(
                new LlmCallContext("character", operation, "conference", null),
                () -> companionLlm.completeSmart(renderedSystem, renderedUser));
    }
```
(keep the existing `LlmCallContext` arguments exactly as they are in the file — only the two prompt variables change).
`KonziliumProposalRound` :228-229:
```java
            String systemPrompt = promptPersona.render(owner, marker + "\n" + expert.systemPersona() + "\n" + outputContract());
            String userMessage = promptPersona.render(owner, userMessage(periodLabel, evidence.lines(), expertActiveClaims, expert));
```
`CharacterObservationService.generateForExpert` :120:
```java
            String systemPrompt = promptPersona.render(owner, OBSERVATION_MARKER + "\n" + expert.systemPersona() + "\n" + outputContract());
```

- [ ] **Step 5: Run the character suite**

Run: `cd backend && ./mvnw clean test -Dtest='Konzilium*IT,CharacterObservation*IT,CharacterConference*IT,CharacterMonthly*IT,Portrait*IT,CharacterApiIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS. `grep -rn '"DANIEL\|Daniel ' backend/src/main/java/io/mrkuhne/mezo/feature/character/service` → only javadoc lines (`CharacterService:313,316`, `KonziliumProposalRound:85`, `CharacterFeedbackService`).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/character backend/src/test/java/io/mrkuhne/mezo/feature/character
git commit -m "feat(character): expert personas use the user's name; wire marker FELHASZNÁLÓ VÁLASZA (mezo-qw37.6)"
```

---

### Task 5: Frontend `TranscriptTurn` parses both authorship prefixes

**Files:**
- Modify: `frontend/src/features/character/components/TranscriptTurn.tsx:8-33,66-69`
- Modify: `frontend/src/data/character/characterMock.ts:403` (add a second user line with the new prefix)
- Test: `frontend/src/features/character/components/TranscriptTurn.test.tsx` (new)

**Interfaces:**
- Produces: exported `USER_ANSWER_PREFIXES = ['FELHASZNÁLÓ VÁLASZA — ', 'DANIEL VÁLASZA — ']` and `splitTranscriptLines(text): Line[]` (pure, testable).

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { TranscriptTurn, splitTranscriptLines } from '@/features/character/components/TranscriptTurn'

describe('splitTranscriptLines', () => {
  test('az új FELHASZNÁLÓ VÁLASZA prefix a felhasználó sora', () => {
    expect(splitTranscriptLines('FELHASZNÁLÓ VÁLASZA — nem igaz')).toEqual([{ isUser: true, text: 'nem igaz' }])
  })
  test('a tárolt DANIEL VÁLASZA prefix is felhasználói sor marad (régi konferenciák)', () => {
    expect(splitTranscriptLines('DANIEL VÁLASZA — pontosítom')).toEqual([{ isUser: true, text: 'pontosítom' }])
  })
  test('sima sor nem felhasználói', () => {
    expect(splitTranscriptLines('Szakértői szöveg')).toEqual([{ isUser: false, text: 'Szakértői szöveg' }])
  })
})

test('a felhasználói sor a "Válaszod" arany sávot kapja', () => {
  render(
    <TranscriptTurn
      turn={{ persona: 'drill', text: 'Bevezető\nFELHASZNÁLÓ VÁLASZA — talál', refIds: [] }}
      kind="EXPERT" displayName="Drill" color="#000"
    />,
  )
  expect(screen.getByText('Válaszod')).toBeInTheDocument()
  expect(screen.getByText('talál')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/character/components/TranscriptTurn.test.tsx`
Expected: FAIL — `splitTranscriptLines` is not exported; the label reads `Daniel válasza`.

- [ ] **Step 3: Implement**

Replace lines 22-35 of `TranscriptTurn.tsx` with:

```ts
/** S6 (mezo-qw37.6): the backend now emits FELHASZNÁLÓ VÁLASZA —; conferences stored before
 *  that carry the old DANIEL VÁLASZA — literal in their transcript envelope, so both parse. */
export const USER_ANSWER_PREFIXES = ['FELHASZNÁLÓ VÁLASZA — ', 'DANIEL VÁLASZA — '] as const

export interface Line {
  isUser: boolean
  text: string
}

export function splitTranscriptLines(text: string): Line[] {
  return text.split('\n').map((line) => {
    const prefix = USER_ANSWER_PREFIXES.find((p) => line.startsWith(p))
    return prefix ? { isUser: true, text: line.slice(prefix.length) } : { isUser: false, text: line }
  })
}
```

In the component: `const lines = splitTranscriptLines(turn.text)`; the render branch uses `line.isUser` and the rail label becomes `<span className="kr-ul">Válaszod</span>` (the reader is the user; second person). Update the header comment block (lines 8-17) to say "FELHASZNÁLÓ VÁLASZA — (and the legacy DANIEL VÁLASZA — in stored transcripts)". Keep the `kr-danielline` class name (CSS untouched).

`characterMock.ts:403` area: keep the existing `DANIEL VÁLASZA — ` line and add one more transcript line starting with `FELHASZNÁLÓ VÁLASZA — ` to a different expert turn in the same mock conference so the mock-mode konzílium page shows both.

- [ ] **Step 4: Run FE tests in both modes**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/character && VITE_USE_MOCK=false pnpm test src/features/character`
Expected: PASS (the `CharacterFeedPage.test.tsx:59` "Daniel saját megfigyelése." fixture is plain text and unaffected).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/character/components/TranscriptTurn.tsx frontend/src/features/character/components/TranscriptTurn.test.tsx frontend/src/data/character/characterMock.ts
git commit -m "feat(fe): TranscriptTurn parses FELHASZNÁLÓ and legacy DANIEL answer prefixes (mezo-qw37.6)"
```

---
### Task 6: `UserFanOut` — ACTIVE + onboarded users under `LlmActorContext`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/UserFanOut.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/repository/AppUserRepository.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/UserPopulator.java` (populated users are onboarded by default — otherwise every existing job IT silently skips its user after Task 7)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/auth/service/UserFanOutIT.java`

**Interfaces:**
- Consumes: S1 `AppUserEntity.UserStatus`, `AppUserEntity.getOnboardedAt()`; S3 `io.mrkuhne.mezo.techcore…LlmActorContext.runAs(UUID, Runnable)` (verify the exact package once with `grep -rn "class LlmActorContext" backend/src/main/java` — `UserFanOut` is the **only** production importer of it in this slice); `LlmActorResolver.currentActor()` (feature/llmlog) reads from it on cron threads.
- Produces: `List<AppUserEntity> activeUsers()`; `void forEachActiveUser(String jobName, Consumer<AppUserEntity> body)`; `AppUserRepository.findByStatusAndOnboardedAtIsNotNull(UserStatus)`.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.llmlog.service.LlmActorResolver;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class UserFanOutIT extends AbstractIntegrationTest {

    @Autowired private UserFanOut userFanOut;
    @Autowired private UserPopulator userPopulator;
    @Autowired private LlmActorResolver llmActorResolver;

    @Test
    void testActiveUsers_shouldSkipDisabledAndNotOnboarded_whenMixed() {
        AppUserEntity active = userPopulator.createUser("fan-active@test.local");
        AppUserEntity disabled = userPopulator.createUser("fan-disabled@test.local");
        disabled.setStatus(AppUserEntity.UserStatus.DISABLED);
        userPopulator.save(disabled);
        AppUserEntity notOnboarded = userPopulator.createUser("fan-fresh@test.local");
        notOnboarded.setOnboardedAt(null);
        userPopulator.save(notOnboarded);

        List<UUID> ids = userFanOut.activeUsers().stream().map(AppUserEntity::getId).toList();

        assertThat(ids).contains(active.getId()).doesNotContain(disabled.getId(), notOnboarded.getId());
    }

    @Test
    void testForEachActiveUser_shouldRunBodyAsTheUser_andIsolateFailures() {
        AppUserEntity a = userPopulator.createUser("fan-a@test.local");
        AppUserEntity b = userPopulator.createUser("fan-b@test.local");
        List<UUID> actors = new ArrayList<>();

        userFanOut.forEachActiveUser("test-job", user -> {
            actors.add(llmActorResolver.currentActor());
            if (user.getId().equals(a.getId())) {
                throw new UnsupportedOperationException("boom");
            }
        });

        assertThat(actors).contains(a.getId(), b.getId());
        assertThat(llmActorResolver.currentActor()).isNull(); // context cleared after the loop
    }

    @Test
    void testPopulator_shouldCreateOnboardedActiveUsers_byDefault() {
        AppUserEntity user = userPopulator.createUser();
        assertThat(user.getStatus()).isEqualTo(AppUserEntity.UserStatus.ACTIVE);
        assertThat(user.getOnboardedAt()).isNotNull().isBeforeOrEqualTo(Instant.now());
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest='UserFanOutIT' -Dmezo.test.use-testcontainers=true`
Expected: compilation error — `UserFanOut` missing.

- [ ] **Step 3: Repository finder + populator default**

`AppUserRepository.java` — add:
```java
    /** The cron fan-out set (spec L1): ACTIVE and onboarded. Disabled or half-registered accounts get no jobs. */
    List<AppUserEntity> findByStatusAndOnboardedAtIsNotNull(AppUserEntity.UserStatus status);
```
(add `import java.util.List;`).

`UserPopulator.createUser(String email)` — after `user.setPasswordHash("x");` add `user.setOnboardedAt(java.time.Instant.now());` (status defaults to `ACTIVE` on the entity). Javadoc: "Onboarded by default so the S6 cron fan-out sees populated users; call `setOnboardedAt(null)` + `save` to model a half-registered account."

- [ ] **Step 4: Implement `UserFanOut`**

```java
package io.mrkuhne.mezo.feature.auth.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.security.LlmActorContext; // adjust to S3's actual package (see Interfaces)
import java.util.List;
import java.util.function.Consumer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The per-user cron fan-out (S6, mezo-qw37.6, spec L1). Replaces {@code appUserRepository.findAll()}
 * in every {@code @Scheduled} job: only ACTIVE + onboarded accounts, each body executed under
 * {@link LlmActorContext#runAs} so {@code llm_log_history.created_by} names the user the job ran for,
 * and one failing user never aborts the run (the jobs keep their own finer-grained try/catch).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserFanOut {

    private final AppUserRepository appUserRepository;

    @Transactional(readOnly = true)
    public List<AppUserEntity> activeUsers() {
        return appUserRepository.findByStatusAndOnboardedAtIsNotNull(AppUserEntity.UserStatus.ACTIVE);
    }

    public void forEachActiveUser(String jobName, Consumer<AppUserEntity> body) {
        List<AppUserEntity> users = activeUsers();
        for (AppUserEntity user : users) {
            try {
                LlmActorContext.runAs(user.getId(), () -> body.accept(user));
            } catch (Exception e) {
                log.warn("{} failed for user {} — the fan-out continues", jobName, user.getId(), e);
            }
        }
        log.debug("{} fanned out over {} active user(s)", jobName, users.size());
    }
}
```

If S3's `runAs` signature turns out to be `<T> T runAs(UUID, Supplier<T>)`, wrap with `() -> { body.accept(user); return null; }` — the contract this plan relies on is only "sets the actor for the duration of the call and clears it in `finally`".

- [ ] **Step 5: Run the IT + ArchUnit**

Run: `cd backend && ./mvnw clean test -Dtest='UserFanOutIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS (auth → techcore only; no new slice edge).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/auth backend/src/test/java/io/mrkuhne/mezo/feature/auth backend/src/test/java/io/mrkuhne/mezo/support/populator/UserPopulator.java
git commit -m "feat(auth): UserFanOut — ACTIVE+onboarded cron fan-out under LlmActorContext (mezo-qw37.6)"
```

---

### Task 7: Every job uses `UserFanOut`; quest generation gets a presence guard

**Files:**
- Modify: the 22 job classes in table B (`findAll()` line numbers there).
- Modify: `feature/quest/repository/DailyQuestRepository.java`, `feature/quest/config/QuestProperties.java`, `backend/src/main/resources/application.yml` (`mezo.quest` block, :1334).
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/quest/QuestJobIT.java` (new), existing `DailySummaryJobIT` re-run.

**Interfaces:**
- Consumes: `UserFanOut.forEachActiveUser(String, Consumer<AppUserEntity>)` (Task 6).
- Produces: `DailyQuestRepository.existsByCreatedByAndQuestDateGreaterThanEqual(UUID, LocalDate)`; `QuestProperties.cronPresenceDays()`.

- [ ] **Step 1: Write the failing quest IT**

```java
package io.mrkuhne.mezo.feature.quest;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.feature.quest.service.QuestJob;
import io.mrkuhne.mezo.feature.quest.service.QuestService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("companion-fake")
class QuestJobIT extends AbstractIntegrationTest {

    @Autowired private QuestJob questJob;
    @Autowired private QuestService questService;
    @Autowired private DailyQuestRepository repository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRunGenerate_shouldSkipUsersWithoutRecentQuests_andServeRecentOnes() {
        LocalDate today = LocalDate.now();
        AppUserEntity dormant = userPopulator.createUser("quest-dormant@test.local");
        AppUserEntity recent = userPopulator.createUser("quest-recent@test.local");
        questService.dayQuests(recent.getId(), today.minusDays(1)); // the lazy GET path — proves presence
        AppUserEntity disabled = userPopulator.createUser("quest-disabled@test.local");
        disabled.setStatus(AppUserEntity.UserStatus.DISABLED);
        userPopulator.save(disabled);

        questJob.runGenerate();

        assertThat(repository.findByCreatedByAndQuestDateOrderBySlotAsc(recent.getId(), today)).isNotEmpty();
        assertThat(repository.findByCreatedByAndQuestDateOrderBySlotAsc(dormant.getId(), today)).isEmpty();
        assertThat(repository.findByCreatedByAndQuestDateOrderBySlotAsc(disabled.getId(), today)).isEmpty();
    }
}
```

(`questService.dayQuests(userId, date)` — use the service method that backs `GET /api/quest/day/{date}`; confirm its name with `grep -n "public .*LocalDate" backend/src/main/java/io/mrkuhne/mezo/feature/quest/service/QuestService.java`.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest='QuestJobIT' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — dormant and disabled users receive quests.

- [ ] **Step 3: Quest guard plumbing**

`DailyQuestRepository.java` — add `boolean existsByCreatedByAndQuestDateGreaterThanEqual(UUID createdBy, LocalDate from);`.

`QuestProperties.java` — add a component after `finalizeCron`: `@Min(1) int cronPresenceDays,   // 7 — the morning cron only backstops users who had quests in this window (lazy GET proves presence)`.

`application.yml` `mezo.quest` block: add `cron-presence-days: 7` next to `finalize-cron`.

`QuestJob.runGenerate` body per user (replaces :41-54):
```java
        userFanOut.forEachActiveUser("Quest generate", user -> {
            if (!repository.existsByCreatedByAndQuestDateGreaterThanEqual(
                    user.getId(), today.minusDays(properties.cronPresenceDays()))) {
                return; // spec L1: no quests in the presence window ⇒ no generation, no flavor LLM call
            }
            if (repository.findByCreatedByAndQuestDateOrderBySlotAsc(user.getId(), today).isEmpty()) {
                List<DailyQuestEntity> fresh = selector.generate(user.getId(), today);
                generatedCount.addAndGet(fresh.size());
                QuestFlavor flavor = questFlavor.getIfAvailable();
                if (flavor != null) {
                    flavor.rewrite(fresh); // companion voice; failures keep catalog copy
                }
            }
        });
```
with `AtomicInteger generatedCount = new AtomicInteger();` declared before the loop (lambdas cannot mutate a local `int`), `private final QuestProperties properties;` and `private final UserFanOut userFanOut;` injected (drop `AppUserRepository`). `runFinalize` gets the same treatment with `finalizedCount`.

- [ ] **Step 4: Migrate the other 21 job classes (mechanical, one pattern)**

For each class in table B rows 1–5, 7–26: replace `private final AppUserRepository appUserRepository;` with `private final UserFanOut userFanOut;` (import `io.mrkuhne.mezo.feature.auth.service.UserFanOut`; drop the `AppUserRepository` import and the `AppUserEntity` import if it becomes unused), and turn
```java
        for (AppUserEntity user : appUserRepository.findAll()) {
            …body…
        }
```
into
```java
        userFanOut.forEachActiveUser("<Job label>", user -> {
            …body…
        });
```
Rules: any `int` counter mutated inside the body becomes an `AtomicInteger` (`generated.incrementAndGet()` / `addAndGet(n)`, logged with `.get()`); an `int` declared inside the body (`int held = 0;` in `CharacterConferenceJob`, `written` in `CharacterObservationJob`, `generated` in `ConsolidationJob`/`DailySummaryJob`) stays a local of the lambda; `continue` inside a body becomes `return` (`QuarterlyReviewJob:110`); `users++` in `NotificationDispatchJob:90` becomes `users.incrementAndGet()`. Job labels: `"Habit close"`, `"Notification dispatch"`, `"Character observation"`, `"Character conference"`, `"Character monthly"`, `"Quest finalize"`, `"Weekly review"`, `"Weekly suggestion"`, `"Prediction weekly"`, `"Prediction validation"`, `"Memoir"`, `"Experiment propose"`, `"Experiment outcome"`, `"Challenge outcome"`, `"Companion-feed morning"`, `"Companion-feed " + kind`, `"Flag sweep"`, `"Graph maintenance"`, `"Feedback learning"`, `"Profile assembler"`, `"Hypothesis"`, `"Weekly consolidation"` / `"Monthly consolidation"`, `"Daily summary"`, `"Pattern detection"`, `"Quarterly review"`.

Verify: `grep -rn "appUserRepository.findAll()" backend/src/main/java` → no hits; `grep -rln "UserFanOut" backend/src/main/java | wc -l` → 23 (22 jobs + the class).

- [ ] **Step 5: Run the job ITs + ArchUnit**

Run: `cd backend && ./mvnw clean test -Dtest='QuestJobIT,DailySummaryJobIT,ConsolidationJobIT,CharacterObservationJobIT,CharacterConferenceJobIT,*JobIT,*JobSwitchOffIT,NotificationDispatch*IT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS (populated users are onboarded since Task 6, so every existing job IT still sees its user). Any IT that creates a user via `UserPopulator` and then expects the job to skip it must now set `onboardedAt=null` or `DISABLED` explicitly — none exist today.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/quest
git commit -m "feat(cron): all 22 user-loop jobs fan out via UserFanOut; quest cron presence guard (mezo-qw37.6)"
```

---
### Task 8: Push subscribe re-binds an endpoint from any other user

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/repository/PushSubscriptionRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/service/PushSubscriptionService.java:32-42` (`register`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/notification/PushSubscriptionRebindIT.java` (new; pattern = `PushSubscriptionServiceIT`)

**Interfaces:**
- Produces: `PushSubscriptionRepository.findByEndpoint(String)` → `List<PushSubscriptionEntity>` (live rows across owners; the partial unique index is per `(created_by, endpoint)`, so two owners can legitimately hold the same endpoint today — this task ends that).
- Note: `OwnedEntity.createdBy` is `updatable=false`, so re-binding = soft-delete the other owner's row + upsert the caller's, never an UPDATE of `created_by`.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.notification.repository.PushSubscriptionRepository;
import io.mrkuhne.mezo.feature.notification.service.PushSubscriptionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** S6 (mezo-qw37.6): one browser = one account — subscribing moves the endpoint to the caller. */
class PushSubscriptionRebindIT extends AbstractIntegrationTest {

    @Autowired private PushSubscriptionService service;
    @Autowired private PushSubscriptionRepository repository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRegister_shouldMoveEndpointToCaller_whenAnotherUserHeldIt() {
        UUID a = userPopulator.createUser("push-a@test.local").getId();
        UUID b = userPopulator.createUser("push-b@test.local").getId();
        String endpoint = "https://p.example/shared-device";
        service.register(a, endpoint, "key-a", "auth-a", "iPhone");

        service.register(b, endpoint, "key-b", "auth-b", "iPhone");

        assertThat(repository.findByCreatedBy(a)).isEmpty();
        var rows = repository.findByCreatedBy(b);
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().getP256dh()).isEqualTo("key-b");
        assertThat(repository.findByEndpoint(endpoint)).hasSize(1);
    }

    @Test
    void testRegister_shouldKeepOtherDevicesOfPreviousOwner_whenRebinding() {
        UUID a = userPopulator.createUser("push-a2@test.local").getId();
        UUID b = userPopulator.createUser("push-b2@test.local").getId();
        service.register(a, "https://p.example/a-phone", "key-1", "auth-1", "iPhone");
        service.register(a, "https://p.example/shared", "key-2", "auth-2", "Mac");

        service.register(b, "https://p.example/shared", "key-3", "auth-3", "Mac");

        assertThat(repository.findByCreatedBy(a)).singleElement()
                .satisfies(r -> assertThat(r.getEndpoint()).isEqualTo("https://p.example/a-phone"));
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest='PushSubscriptionRebindIT' -Dmezo.test.use-testcontainers=true`
Expected: compilation error — `findByEndpoint` missing.

- [ ] **Step 3: Implement**

`PushSubscriptionRepository.java` — add:
```java
    /** Every live row for this endpoint regardless of owner — the S6 re-bind reads it. */
    List<PushSubscriptionEntity> findByEndpoint(String endpoint);
```

`PushSubscriptionService.register`:
```java
    @Transactional
    public void register(UUID owner, String endpoint, String p256dh, String auth, String userAgent) {
        // S6 (mezo-qw37.6): a browser's push endpoint identifies a device, and a device belongs to
        // whoever is signed in on it now — soft-delete any other account's live row for it first.
        repository.findByEndpoint(endpoint).stream()
                .filter(other -> !owner.equals(other.getCreatedBy()))
                .forEach(repository::delete);
        PushSubscriptionEntity entity = repository.findByCreatedByAndEndpoint(owner, endpoint)
                .orElseGet(PushSubscriptionEntity::new);
        entity.setCreatedBy(owner);
        entity.setEndpoint(endpoint);
        entity.setP256dh(p256dh);
        entity.setAuth(auth);
        entity.setUserAgent(userAgent);
        repository.save(entity);
    }
```
Update the class-level and method Javadoc ("upsert-on-register, **re-bind across owners**, soft-delete-on-unregister/GONE").

- [ ] **Step 4: Run the notification suite**

Run: `cd backend && ./mvnw clean test -Dtest='PushSubscription*IT,NotificationApiIT,PushSenderIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/notification backend/src/test/java/io/mrkuhne/mezo/feature/notification
git commit -m "feat(notification): push subscribe re-binds the endpoint to the signed-in account (mezo-qw37.6)"
```

---

### Task 9: Frontend `userScope` — one helper, set by `AuthGate`

**Files:**
- Create: `frontend/src/shared/lib/userScope.ts`, `frontend/src/shared/lib/userScope.test.ts`
- Modify: `frontend/src/app/auth/AuthGate.tsx` (S1 Task 10 file) — three call sites; `frontend/src/app/auth/AuthGate.test.tsx` (+1 test)

**Interfaces:**
- Produces: `setCurrentUserId(id: string | null)`, `currentUserId(): string | null`, `userScopedKey(base: string): string` → `mezo.<userId>.<base>` or `mezo.anon.<base>`; `userScopedPrefix(): string` → `mezo.<userId>.` (for key-scanning prune loops).
- Consumes: S1 `mockMe.id`, `authApi.me()` result `.id`, `authEvents.onSignedOut`.

Design note: a module-level id (not a hook) because five of the six call sites are plain functions in `logic/`/`shared/lib` with no React context; `AuthGate` is the single writer, exactly like `tokenStore` is for the token. Tests set it directly.

- [ ] **Step 1: Write the failing tests**

`userScope.test.ts`:
```ts
import { afterEach, describe, expect, test } from 'vitest'
import { currentUserId, setCurrentUserId, userScopedKey, userScopedPrefix } from '@/shared/lib/userScope'

afterEach(() => setCurrentUserId(null))

describe('userScope', () => {
  test('kijelentkezve az anon névtérbe kulcsol', () => {
    expect(currentUserId()).toBeNull()
    expect(userScopedKey('msgseen.2026-09-02')).toBe('mezo.anon.msgseen.2026-09-02')
  })
  test('bejelentkezve a user id a névtér', () => {
    setCurrentUserId('11111111-2222-3333-4444-555555555555')
    expect(userScopedKey('night-wake:2026-09-02')).toBe('mezo.11111111-2222-3333-4444-555555555555.night-wake:2026-09-02')
    expect(userScopedPrefix()).toBe('mezo.11111111-2222-3333-4444-555555555555.')
  })
  test('két user kulcsa sosem ütközik', () => {
    setCurrentUserId('a')
    const ka = userScopedKey('sleep-escal-snooze')
    setCurrentUserId('b')
    expect(userScopedKey('sleep-escal-snooze')).not.toBe(ka)
  })
})
```

Add to `AuthGate.test.tsx` (imports: `currentUserId` from `@/shared/lib/userScope`, `mockMe` from `@/data/auth/authMock`):
```tsx
test('mock mode scopes storage to the mock identity', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  renderGate()
  expect(currentUserId()).toBe(mockMe.id)
})

test('valid token → me → the storage scope is the signed-in user; sign-out clears it', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  renderGate()
  await screen.findByText('APP')
  expect(currentUserId()).toBe('00000000-0000-0000-0000-000000000001') // the MSW /api/auth/me id
  setToken(null)
  authEvents.emitSignedOut('manual')
  await screen.findByRole('heading', { name: 'Bejelentkezés' })
  expect(currentUserId()).toBeNull()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/shared/lib/userScope.test.ts src/app/auth/AuthGate.test.tsx`
Expected: FAIL — module missing / scope never set.

- [ ] **Step 3: Implement `userScope.ts`**

```ts
// ============================================================
// Mezo · userScope — per-user névtér a böngésző-tárolóhoz (mezo-qw37.6, S6).
// Egy böngészőben több fiók is beléphet egymás után; a localStorage/sessionStorage
// kulcsok ezért `mezo.<userId>.<alap>` alakúak. Egyetlen író van: az AuthGate (mint a
// tokenStore-nál) — a logic-rétegbeli tiszta függvények innen olvasnak, React nélkül.
// A téma (`mezo-theme`) SZÁNDÉKOSAN eszköz-szintű marad, nem megy ezen át.
// ============================================================
let userId: string | null = null

export function setCurrentUserId(id: string | null): void {
  userId = id
}

export function currentUserId(): string | null {
  return userId
}

/** `mezo.<userId>.` — a kulcs-előtag; kulcsokat végigpásztázó törléshez (nightTrace prune). */
export function userScopedPrefix(): string {
  return `mezo.${userId ?? 'anon'}.`
}

/** `mezo.<userId>.<base>` — MINDEN per-user tároló-kulcs ezen keresztül készül. */
export function userScopedKey(base: string): string {
  return userScopedPrefix() + base
}
```

- [ ] **Step 4: Wire `AuthGate`**

In `AuthGate.tsx` add `import { setCurrentUserId } from '@/shared/lib/userScope'` and `import { mockMe } from '@/data/auth/authMock'`, then:
- at the top of the boot `useEffect`: `if (mock) { setCurrentUserId(mockMe.id); return }` (replaces the bare `if (mock) return`);
- after every `client.setQueryData(ME_QUERY_KEY, me)` (boot loop and `onAuthenticated`): `setCurrentUserId(me.id)`;
- inside the `authEvents.onSignedOut` handler, first line: `setCurrentUserId(null)`.

- [ ] **Step 5: Run in both modes**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/shared/lib/userScope.test.ts src/app/auth && VITE_USE_MOCK=false pnpm test src/shared/lib/userScope.test.ts src/app/auth`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shared/lib/userScope.ts frontend/src/shared/lib/userScope.test.ts frontend/src/app/auth
git commit -m "feat(fe): userScope storage namespace set by AuthGate (mezo-qw37.6)"
```

---
### Task 10: Migrate the six storage sites to `userScopedKey`

**Files:**
- Modify: `frontend/src/shared/lib/seenMessages.ts:8`, `frontend/src/features/today/logic/nudgeSeen.ts:20`, `frontend/src/features/me/logic/nightTrace.ts:8,50-56`, `frontend/src/features/me/logic/sleepEscalation.ts:13,36-49`, `frontend/src/features/train/logic/morningWindow.ts:7,44-58`, `frontend/src/shared/hooks/useStickyTab.ts:18-25,42`
- Test: the colocated `seenMessages.test.ts`, `nudgeSeen.test.ts:33,38`, `nightTrace.test.ts:35-43`, `sleepEscalation.test.ts:52`, `morningWindow.test.ts:37`, `useStickyTab.test.ts`, plus `frontend/src/test/setup.ts` (clear `localStorage` too and reset the scope between tests)
- Not touched: `shared/lib/theme.ts` (`mezo-theme` stays device-level, spec §10).

**Interfaces:**
- Consumes: `userScopedKey`, `userScopedPrefix`, `setCurrentUserId` (Task 9).
- Produces: `SNOOZE_KEY` in `sleepEscalation.ts`/`morningWindow.ts` become **functions** `snoozeKey(): string` (the key now depends on the current user); consumers of the constants are only the two test files.

Key layout after migration (`<u>` = current user id or `anon`): `mezo.<u>.msgseen.<date>`, `mezo.<u>.needsnudge.<date>`, `mezo.<u>.night-wake:<date>`, `mezo.<u>.sleep-escal-snooze`, `mezo.<u>.morning-training-snooze`, sessionStorage `mezo.<u>.tab:<key>`. Old un-namespaced keys are orphaned, not migrated: the date-keyed ones expire on their own, the two snoozes are lost once (accepted beta cost — note it in the ADR, Task 12).

- [ ] **Step 1: Write the failing tests (one isolation test per site)**

Append to `seenMessages.test.ts`:
```ts
  test('két user olvasottsága nem keveredik', () => {
    setCurrentUserId('u1')
    markMessagesSeen('2026-08-11', 'note')
    setCurrentUserId('u2')
    expect(lastSeenMessage('2026-08-11')).toBeNull()
    expect(localStorage.getItem('mezo.u1.msgseen.2026-08-11')).toBe('note')
  })
```
Append to `nudgeSeen.test.ts` (and change lines 33/38 to `localStorage.setItem('mezo.anon.needsnudge.2026-08-17', …)`):
```ts
  test('a nudge-napló user-névterezett', () => {
    setCurrentUserId('u1')
    markNudgeShown('2026-08-17', 'hidratacio', '2026-08-17T15:00:00.000Z')
    setCurrentUserId('u2')
    expect(shownNudges('2026-08-17')).toEqual([])
  })
```
`nightTrace.test.ts`: lines 35/36/38/43 use `mezo.anon.night-wake:<date>`; add:
```ts
  test('a prune csak a saját user kulcsait takarítja', () => {
    localStorage.setItem('mezo.other.night-wake:2026-07-19', JSON.stringify({ count: 1, lastAt: 'x' }))
    recordNightWake()
    expect(localStorage.getItem('mezo.other.night-wake:2026-07-19')).not.toBeNull()
  })
```
`sleepEscalation.test.ts:52`: `localStorage.setItem(snoozeKey(), 'garbage')` (import `snoozeKey` instead of `SNOOZE_KEY`); add:
```ts
  test('a snooze user-névterezett', () => {
    setCurrentUserId('u1'); snooze(TODAY)
    setCurrentUserId('u2'); expect(isSnoozed(TODAY)).toBe(false)
  })
```
`morningWindow.test.ts:37`: `localStorage.removeItem(snoozeKey())` (import `snoozeKey`); add the same two-user assertion with `snooze(hash)` / `isSnoozed(hash)`.
`useStickyTab.test.ts`: add:
```ts
test('a sticky tab user-névterezett — másik user a fallbackot kapja', () => {
  setCurrentUserId('u1')
  const a = renderHook(() => useStickyTab<Seg>('t.scoped', 'week'))
  act(() => a.result.current[1]('blocks'))
  a.unmount()
  setCurrentUserId('u2')
  const b = renderHook(() => useStickyTab<Seg>('t.scoped', 'week'))
  expect(b.result.current[0]).toBe('week')
})
```
Each test file imports `setCurrentUserId` from `@/shared/lib/userScope`. In `frontend/src/test/setup.ts` extend the existing `afterEach` to also `localStorage.clear()` and call `setCurrentUserId(null)` (import from `@/shared/lib/userScope`).

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/shared/lib/seenMessages.test.ts src/features/today/logic/nudgeSeen.test.ts src/features/me/logic src/features/train/logic/morningWindow.test.ts src/shared/hooks/useStickyTab.test.ts`
Expected: FAIL — keys are still global.

- [ ] **Step 3: Migrate the sites**

`seenMessages.ts:8`: `const keyFor = (date: string) => userScopedKey(\`msgseen.${date}\`)`.
`nudgeSeen.ts:20`: `const keyFor = (date: string) => userScopedKey(\`needsnudge.${date}\`)`.
`nightTrace.ts`: replace `const PREFIX = 'mezo-night-wake:'` with `const prefix = () => userScopedPrefix() + 'night-wake:'`; every `PREFIX + date` → `prefix() + date`; in `prune`: `const p = prefix()` once, then `k?.startsWith(p) && k.slice(p.length) < cutoffIso`.
`sleepEscalation.ts:13`: `export const snoozeKey = () => userScopedKey('sleep-escal-snooze')`; `:38` `localStorage.getItem(snoozeKey())`; `:47` `localStorage.setItem(snoozeKey(), …)`.
`morningWindow.ts:7`: `export const snoozeKey = () => userScopedKey('morning-training-snooze')`; `:46`/`:54` use `snoozeKey()`.
`useStickyTab.ts`: replace `const PREFIX = 'mezo-tab:'` with `const keyFor = (key: string) => userScopedKey(\`tab:${key}\`)`; `read` uses `sessionStorage.getItem(keyFor(key))`, the setter `sessionStorage.setItem(keyFor(key), next)`.
Add `import { userScopedKey } from '@/shared/lib/userScope'` (or `userScopedPrefix` for nightTrace) to each file; `grep -rn "SNOOZE_KEY" frontend/src` must return nothing.

- [ ] **Step 4: Run both modes on the touched features**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/shared src/features/today src/features/me src/features/train src/app && VITE_USE_MOCK=false pnpm test src/shared src/features/today src/features/me src/features/train src/app`
Expected: PASS (page tests `NapMezoPage.test.tsx`, `SleepPage.test.tsx`, `TrainTodayPage.test.tsx`, `navigation.test.tsx` run under the `anon` scope and keep passing).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared frontend/src/features/today/logic frontend/src/features/me/logic frontend/src/features/train/logic frontend/src/test/setup.ts
git commit -m "feat(fe): per-user localStorage/sessionStorage keys via userScopedKey; theme stays global (mezo-qw37.6)"
```

---

### Task 11: `useProfile` — static `user` seed only in mock mode

**Files:**
- Modify: `frontend/src/data/me/meHooks.ts` (whole file), `frontend/src/features/me/pages/EnHubPage.tsx:58,63,187`
- Test: `frontend/src/data/me/meHooks.test.tsx` (new)

**Interfaces:**
- Consumes: `useMe()` from `@/data/auth/authHooks` (S1 Task 9).
- Produces: `useProfile(): { user: ProfileIdentity | null }` with `export interface ProfileIdentity { name: string }`. Mock mode → `{ name: user.name }` from `today.ts`; real mode → `{ name: me.data.name }` or `null` while loading (never the seed).

First check what S2 left behind: `grep -n "useMe\|isMockMode" frontend/src/data/me/meHooks.ts`. If S2 already made `useProfile` real, keep its shape and only make sure the mock branch is the sole reader of the static `user` and that `EnHubPage` ghost-guards `null`; the test below still applies.

- [ ] **Step 1: Write the failing test**

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { makeHookWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { useProfile } from '@/data/me/meHooks'

afterEach(() => { vi.unstubAllEnvs(); localStorage.clear(); setToken(null) })

test('mock mode: the static seed identity', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { result } = renderHook(() => useProfile(), { wrapper: makeHookWrapper() })
  expect(result.current.user?.name).toBe('Daniel')
})

test('real mode: the name comes from /api/auth/me, never from the seed', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  const { result } = renderHook(() => useProfile(), { wrapper: makeHookWrapper() })
  expect(result.current.user).toBeNull()
  await waitFor(() => expect(result.current.user?.name).toBe('Owner')) // MSW /api/auth/me
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/data/me/meHooks.test.tsx`
Expected: FAIL — real mode still returns "Daniel".

- [ ] **Step 3: Implement**

`meHooks.ts`:
```ts
import { isMockMode } from '@/data/_client/mode'
import { useMe } from '@/data/auth/authHooks'
import { user } from '@/data/today/today'

export interface ProfileIdentity { name: string }

/**
 * The signed-in identity for the Én hero (S6, mezo-qw37.6 — closes the me.md §9 "static
 * user" decision). Real mode: GET /api/auth/me via useMe(), `null` until it arrives (ghost-guard,
 * no seed fallback — dual-mode read invariant). Mock mode: the static today.ts seed, which is
 * now the ONLY place that seed's identity fields are read.
 */
export function useProfile(): { user: ProfileIdentity | null } {
  const mock = isMockMode()
  const me = useMe()
  if (mock) return { user: { name: user.name } }
  return { user: me.data ? { name: me.data.name } : null }
}
```
`EnHubPage.tsx`: `:58` `const { user: profile } = useProfile()`; `:63` `const initial = (profile?.name ?? '').trim().charAt(0).toUpperCase()`; `:187` `<div className="enh-nm">{profile?.name ?? ''}</div>`.

- [ ] **Step 4: Run both modes**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/data/me src/features/me && VITE_USE_MOCK=false pnpm test src/data/me src/features/me && pnpm build`
Expected: PASS; `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/me/meHooks.ts frontend/src/data/me/meHooks.test.tsx frontend/src/features/me/pages/EnHubPage.tsx
git commit -m "feat(fe): useProfile reads the signed-in name in real mode; seed only in mock (mezo-qw37.6)"
```

---
### Task 12: Docs — auth platform doc §4/§5/§8–§10, `security_conventions.md`, ADR 0034, reference touch-ups

**Files:**
- Modify: `docs/features/_platform-auth-security.md` (S1 refreshed §1–§3/§6–§7; this task rewrites §4, §5, §8, §9, §10 and the frontmatter `updated`/`key_files`)
- Create: `docs/references/security_conventions.md` (folds bd `mezo-ah18.2`), `docs/decisions/0034-multi-user-account-model.md`
- Modify: `docs/references/liquibase_conventions.md:158`, `docs/references/integration_test_framework.md:124-126`, `AGENTS.md:159` + the reference table row for `integration_test_framework.md` (:148) gains `security_conventions.md`, `docs/features/me.md:16`, `docs/features/character.md:168,903`, `docs/features/_platform-notifications.md:570-571`, `docs/features/_platform-api-backend.md` §9 (cron bullet), `docs/README.md` index (ADR + reference), `docs/CODEMAP.md` (generated)

- [ ] **Step 1: `_platform-auth-security.md` — §4 Data model & API**

Replace the `user_profiles` table block and everything under "### The JWT, in detail"/"### Owner seeding & config" that still says single-owner with: the `app_user` column table (`id, email, password_hash, name, role ck OWNER|USER, status ck ACTIVE|DISABLED, timezone, onboarded_at, must_change_password, last_seen_at, created_at`), the `invite` table (columns from the S1 changeset `202609021200_mezo-qw37.1_multi_user_accounts.sql`), the endpoint table from spec §5 (`register`, `login` + `AUTH_ACCOUNT_DISABLED`, `me`, `changePassword`, `completeOnboarding`) plus the S3 admin table (spec §7), `CurrentUser` (request-cached principal, status check, `requireOwner()`, `last_seen_at` ≤ 5 min stamp) and `CurrentUserId` delegating to it, JWT unchanged (HS256, 30 d, `sub` = user id), `PromptPersona`/`PersonaContext` ("the user's name in prompts — Task 1"), `UserFanOut` ("who a cron runs for — Task 6"), catalog tables as the ownership exception (`exercise_catalog`, `pantry_catalog`: `created_by NULL` = master).

- [ ] **Step 2: §5 Integrations**

Rewrite the bullets: **every owned feature ↔ `CurrentUserId`** (unchanged contract, now with the DISABLED 403 on every request); **cron ↔ `UserFanOut` + `LlmActorContext`** (jobs never call `appUserRepository.findAll()`; the per-user body runs as that user so `llm_log_history.created_by` is set); **prompts ↔ `PromptPersona`** (`{{NÉV}}` token, `USER_TURN_LABEL`, wire marker `FELHASZNÁLÓ VÁLASZA —`); **frontend ↔ `AuthGate`/`useMe`/`userScope`** (token in `localStorage` `mezo.auth.token`, per-user storage keys `mezo.<userId>.…`, theme device-level); **push ↔ endpoint re-bind** (one browser = one account); **admin ↔ `requireOwner()`**; **LLM-usage ↔ owner-only + `byUser`**.

- [ ] **Step 3: §8 Testing**

Replace with: `ApiIntegrationTest.ownerAuthHeaders()` + S1 `registerUser(label)` (the B-user source for ownership-isolation ITs: every new endpoint gets a B-user 404/403 test); `UserPopulator.createUser` now yields **ACTIVE + onboarded** users (Task 6) — set `onboardedAt=null`/`DISABLED` + `save` to model the excluded kinds; `UserFanOutIT`, `PromptPersonaIT`, `PushSubscriptionRebindIT`, `QuestJobIT`, `KonziliumUserFeedbackIT`; the OWNER/USER role matrix (owner → 200 on admin, user → 403 `AUTH_FORBIDDEN`); FE: `AuthGate.test.tsx`, `userScope.test.ts`, `meHooks.test.tsx`, `TranscriptTurn.test.tsx`, both modes.

- [ ] **Step 4: §9 Decisions, gotchas & deferred; §10 Key files**

§9: keep the HS256/`@Size(min=32)`/filter-401 gotchas; replace the token-in-memory bullet with "token persisted in `localStorage`, dead session → `signedOut` event"; add gotchas: "`UserPopulator` users are onboarded by default — a job IT that expects a skipped user must say so", "prompt templates carry `{{NÉV}}` — a golden test on a template must assert the rendered name, never `Daniel`", "old conference transcripts keep `DANIEL VÁLASZA —`; the FE parses both", "un-namespaced storage keys from before S6 are orphaned (snoozes lost once)". Deferred: `mezo-5h9` closed (S1); T1 timezone column unused; L2 LLM quota not adopted. Point to ADR 0034 and the spec.
§10: list `feature/auth/service/{CurrentUser,InviteService,PromptPersona,PersonaContext,UserFanOut}.java`, `AuthStartupGuard`, `AdminController` (S3), `frontend/src/app/auth/{AuthGate,authState}.ts(x)`, `frontend/src/data/auth/*`, `frontend/src/shared/lib/userScope.ts`, `features/auth/pages/*`. Frontmatter: `updated: 2026-09-02`, `status: shipped`, add `frontend/src/shared/lib/userScope.ts` and `frontend/src/app/auth` to `key_files`, `related` + `_platform-notifications`.

- [ ] **Step 5: New `docs/references/security_conventions.md`**

```markdown
# Security Conventions

House rules for authentication, identity and data ownership in mezo (bd mezo-ah18.2, finalized with
the multi-user epic mezo-qw37). Living detail: `docs/features/_platform-auth-security.md`; the why:
`docs/decisions/0034-multi-user-account-model.md`.

## Identity
- HS256 JWT, 30-day expiry, `sub` = `app_user.id`; issued by `AuthService.login/register`, validated
  by the resource-server filter. No refresh token, no server-side revocation: **disabling** is a
  per-request status check (`CurrentUser` → 403 `AUTH_ACCOUNT_DISABLED`).
- Controllers inject `CurrentUserId` (a `UUID`) or `CurrentUser` (entity, `requireOwner()`);
  **never** read identity from a request DTO, header or query parameter.
- Roles: `OWNER` (seeded founder, admin surface) and `USER`. Owner-only endpoints call
  `currentUser.requireOwner()` first — 403 `AUTH_FORBIDDEN`.
- Public allowlist is exactly `/api/auth/login`, `/api/auth/register`, `/actuator/health`.

## Ownership
- Every domain table carries `created_by uuid NOT NULL` (FK `app_user` cascade), set server-side.
  Reads filter `created_by = currentUser`; a foreign row is a **404** (`OwnershipGuard.ownedOrThrow`),
  never a 403 — existence must not leak.
- Catalog tables are the one exception: `exercise_catalog`, `pantry_catalog` rows with
  `created_by IS NULL` are master data visible to everyone; user-authored rows are visible to
  everyone but editable only by author or OWNER.
- Cron jobs iterate `UserFanOut.forEachActiveUser` (ACTIVE + onboarded) and run under
  `LlmActorContext.runAs(userId, …)`; never `appUserRepository.findAll()`.
- Push endpoints belong to one account: subscribing re-binds the endpoint to the caller.

## Soft delete
- `is_deleted` + `@SQLDelete`/`@SQLRestriction`; normal paths never hard-delete. Unique indexes
  are partial (`WHERE is_deleted = false`) so a soft-deleted row never blocks a re-create.

## Prompts and the user's name
- Prompt templates are `static final` and carry `{{NÉV}}`; `PromptPersona.render(userId, template)`
  is the only substitution, applied once before the LLM call. Transcript role label is
  `PromptPersona.USER_TURN_LABEL` (`Felhasználó: `); the konzílium marker is `FELHASZNÁLÓ VÁLASZA —`.

## Tests
- Every new endpoint: a no-token 401 test and a B-user (`registerUser`) 404/403 test.
- Owner/user matrix for admin and LLM-usage endpoints. No token forging: mint via `/api/auth/login`.

## Secrets
- Prod refuses to boot with the default JWT secret / owner password (`mezo.auth.strict`, mezo-5h9).
- Never log a push endpoint, a token or key material.
```

- [ ] **Step 6: New ADR `docs/decisions/0034-multi-user-account-model.md`**

```markdown
# 0034 — Multi-user account model: invite-gated beta, shared catalogs, app-level ownership

- **Status:** Accepted
- **Date:** 2026-09-02
- **Driver:** mezo-qw37 (slices mezo-qw37.1 … mezo-qw37.6)
- **Spec:** docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md

## Context
mezo was a single-owner PWA with the owner's credentials baked into the frontend build, every
`@Scheduled` job iterating all `app_user` rows, "Daniel" hard-wired into ~20 prompt files, and
device storage keyed without a user. The data layer was already multi-user shaped (every domain
table `created_by NOT NULL`, every unique constraint led by `created_by`). Goal: a closed beta of
5–20 invited users, each with their own data, sharing the exercise and pantry catalogs.

## Decision
| Code | Decision | Rejected |
|---|---|---|
| A / A1 | Invite code + email + password; codes handed over by the owner; reset = admin temporary password | Magic link (SMTP + PWA link issues), open registration, OAuth |
| Q3a | Minimal in-app admin UI (`role=OWNER`): invites, users, reset, disable | psql/CLI only |
| M1 | Keep HS256 JWT + `CurrentUserId`; token in localStorage; disable via per-request status check | Session cookie + CSRF SPA rewrite, Keycloak/Authentik |
| K1 | Community pantry catalog: `pantry_catalog` global (seed + user-added, author marked), `pantry_item` per-user state | K2 private additions, K3 copy at registration |
| E1 | Community exercise catalog: user-added exercises visible to all; media/edit by author or OWNER | E2 private exercises |
| O2-lite | Onboarding wizard: name, birth date, sex, weight, height | O1 empty app, full wizard with meso |
| T1 | HU-only beta: `app_user.timezone` column stored, not yet used | Per-user timezone now (47+ `LocalDate.now()` sites) |
| L1 | Cron fan-out only over ACTIVE + onboarded users, per-job fresh-data guard before any LLM call, per-user LLM cost on the admin page | Monthly quota (L2), nothing (L3) |
| S6 | Prompts get `app_user.name` via one `{{NÉV}}` token (no inflection); transcript labels and the konzílium marker are user-neutral (`Felhasználó`) so stored rows never depend on a display name | Full Hungarian case inflection; name-bearing stored labels |
| S6 | Device storage keys namespaced `mezo.<userId>.…`; theme stays device-level; pre-S6 keys orphaned | Migrating old keys |
| S6 | One browser = one account for push: subscribe re-binds the endpoint | Allowing an endpoint under two accounts |

## Consequences
Easy: adding a user is an invite; every owned endpoint keeps working unchanged; catalogs grow
communally. Harder: no revocation until token expiry (30 d) beyond the status check; T1 leaves
"today" server-global; old conference transcripts carry the legacy `DANIEL VÁLASZA —` marker and the
FE parses both. To maintain: the B-user isolation test on every new endpoint, `UserFanOut` in
every new job, `{{NÉV}}` in every new prompt.

## Alternatives considered
Hibernate `@TenantId` (does not cover `findById`/native paths, not applicable to global catalogs);
Postgres RLS (two DB roles + datasource proxy + silent-empty failure mode — disproportionate under 20
users); session cookie + one-time-token magic link (SMTP infra and a full auth-stack rewrite for zero
beta value). Sources: spec §13.
```

- [ ] **Step 7: Reference and feature touch-ups**

- `liquibase_conventions.md:158` → `Every domain table is owner-scoped (\`created_by\`) and every repository query filters on it — **except the catalog tables** (\`exercise_catalog\`, \`pantry_catalog\`), where \`created_by IS NULL\` marks loader-seeded master rows and user-authored rows are readable by everyone (ADR 0034). For those, the composite index leads with the natural key, not \`created_by\`. For every other table:`
- `integration_test_framework.md:124-126` → `- Multi-user model (ADR 0034): the role matrix is OWNER/USER. Owner-only endpoints get an OWNER → 200 and a USER → 403 \`AUTH_FORBIDDEN\` test; every owned endpoint gets a B-user 404/403 test. Mint the second user with \`ApiIntegrationTest.registerUser(label)\` (invite → register → Bearer); \`UserPopulator.createUser\` (ACTIVE + onboarded, placeholder hash) serves the non-HTTP tests. Never forge tokens.`
- `AGENTS.md:159` → `- **Auth/ownership:** multi-user (ADR 0034, mezo-qw37) — invite-gated registration, HS256 bearer JWT, \`created_by\` resolved server-side from \`CurrentUser\`/\`CurrentUserId\` (never from the client), app-level filtering (\`created_by = currentUser\`, foreign row = 404), catalog tables the only shared exception; crons via \`UserFanOut\`; prompts via \`PromptPersona\`. Rules: \`docs/references/security_conventions.md\`.` Add a row to the reference table (:148 area): `| \`security_conventions.md\` | any auth, identity, ownership, cron fan-out or prompt-persona code — \`CurrentUser\`/\`requireOwner()\`, foreign row = 404, \`UserFanOut\`, \`{{NÉV}}\` via \`PromptPersona\`, B-user test on every endpoint |`.
- `me.md:16` (§9 `useProfile` bullet): append `**RESOLVED (S6, mezo-qw37.6):** \`useProfile\` reads \`GET /api/auth/me\` via \`useMe()\` in real mode and returns \`null\` until it arrives; the static \`today.ts\` \`user\` is read in mock mode only. The sanctioned exception is closed.` §10 key-files line for `meHooks.ts` (:97) → `useProfile (real: useMe(); mock: static user — S6)`.
- `character.md:168,903`: `"DANIEL VÁLASZA — "` → `"FELHASZNÁLÓ VÁLASZA — "` (S6), with a parenthetical that stored transcripts may still carry the old literal and `TranscriptTurn` parses both.
- `_platform-notifications.md:570-571`: append `Since S6 (mezo-qw37.6) \`register\` first soft-deletes any other account's live row for the same endpoint — one browser = one account.`
- `_platform-api-backend.md` §9: add a bullet `**Cron fan-out is \`UserFanOut.forEachActiveUser\`** (ACTIVE + onboarded, per-user \`LlmActorContext.runAs\`, per-user isolation) — never \`appUserRepository.findAll()\`. Each LLM-calling job keeps its own pre-spend gate (table in the S6 plan).`
- `docs/README.md` index: add the ADR and the reference.

- [ ] **Step 8: Regenerate and lint**

Run: `node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs --errors-only`
Expected: `docs/CODEMAP.md` lists `PersonaContext`, `PromptPersona`, `UserFanOut` under auth and the new ITs; lint has no errors.

- [ ] **Step 9: Commit**

```bash
git add docs AGENTS.md
git commit -m "docs(auth): multi-user platform doc, security_conventions, ADR 0034, reference touch-ups (mezo-qw37.6)"
```

---
### Task 13: Full gates, residual-grep, push, self-PR

**Files:** none new.

- [ ] **Step 1: Residual literal scan**

Run:
```bash
grep -rn '"Daniel\|Danielnek\|Danielről\|Danielt\b\|Daniellel\|DANIEL VÁLASZA' backend/src/main/java --include=*.java | grep -v "^\S*:\s*\*\|//"
grep -rn "appUserRepository.findAll()" backend/src/main/java
grep -rn "'mezo-night-wake\|'mezo.msgseen\|'mezo.needsnudge\|mezo-sleep-escal\|mezo-morning-training\|'mezo-tab:" frontend/src --include=*.ts --include=*.tsx | grep -v "test\."
```
Expected: all three empty (the first may still show javadoc lines that start with ` * ` — those are the documented out-of-scope comments; a hit inside a string literal is a miss to fix).

- [ ] **Step 2: Backend focused gate + broad smoke**

Run:
```bash
cd backend && ./mvnw clean test -Dtest='PromptPersona*,UserFanOut*,PushSubscription*,QuestJobIT,KonziliumUserFeedbackIT,CharacterPromptAssemblerIT,ChatHistoryTest,ChatServiceIT,ChatStreamServiceIT,GeminiCompanionLlmRecordingTest,TurnEmbeddingListenerIT,MemoryEmbeddingWriterIT,WeeklySuggestionNameIT,*JobIT,*JobSwitchOffIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true
```
Expected: PASS. Then `node scripts/lint-liquibase.mjs` (no changesets in this slice — must still pass).

- [ ] **Step 3: Frontend gate**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build`
Expected: both suites green, build succeeds.

- [ ] **Step 4: Docs lint + CODEMAP drift**

Run: `node scripts/gen-codemap.mjs --check && node scripts/lint-docs.mjs --errors-only`
Expected: no drift, no errors.

- [ ] **Step 5: Push and open the self-PR (the CI gate)**

```bash
git push -u origin feat/multi-user-s6-persona-cron
gh pr create --title "feat(auth): S6 persona + cron hygiene — PromptPersona, UserFanOut, push re-bind, userScope, ADR 0034 (mezo-qw37.6)" --body "$(cat <<'EOF'
S6 of the multi-user epic (mezo-qw37): prompts address the user by app_user.name through one {{NÉV}} token (PromptPersona), the konzílium wire marker is FELHASZNÁLÓ VÁLASZA — (FE parses both), all 22 user-loop crons fan out via UserFanOut (ACTIVE + onboarded, LlmActorContext.runAs) with a presence guard on the quest cron, push subscribe re-binds an endpoint to the signed-in account, FE storage keys are namespaced mezo.<userId>., useProfile reads /api/auth/me in real mode, and the platform docs + security_conventions.md + ADR 0034 describe the multi-user model. Spec: docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md §10.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr checks --watch
```
Expected: CI green. The orchestrator performs the `--no-ff` merge, `bd close mezo-qw37.6`, `bd dolt push`.

---

## Self-Review

**Spec coverage (§10):** `PersonaContext` in `feature/auth` + single `PromptPersona` helper → Task 1; every listed prompt site (`ChatService.assembleSystemPrompt`, the eleven proactive/companion generators, the six character classes, `FactExtractionService`, `RecipeWorkshopService`) plus the unlisted ones the grep surfaced (`KnowledgeFactService`, `CharacterPromptAssembler`, `DailySummaryService`, `HypothesisPipelineService`, `LifeEvent`/`PersonExtractionService`, `HabitSuggestLlmAdapter`, `ChatHistory`, `MemoryEmbeddingWriter`, `TurnVerdictCheck`, `AdvisorRetry`, `DiagnosisRecipe`) → Tasks 2–4 with table A; no inflection → Global Constraints rule + table A rewrites; wire marker BE + FE both prefixes → Tasks 4–5; static `user` seed mock-only → Task 11; `UserFanOut.activeUsers()` = `status='ACTIVE' AND onboarded_at IS NOT NULL` + every job + `LlmActorContext.runAs` → Tasks 6–7 with table B; per-job fresh-data guard audit → table B ("Guard today" column; the one missing gate, quest flavor, gets `existsByCreatedByAndQuestDateGreaterThanEqual`) → Task 7; pool stays 1 → constraint; localStorage namespacing incl. sessionStorage `mezo-tab:*`, theme untouched → Tasks 9–10; push re-bind → Task 8; docs (`_platform-auth-security.md` full multi-user rewrite of §4/§5/§8–§10, `liquibase_conventions.md` catalog exception, `integration_test_framework.md` OWNER/USER matrix, `AGENTS.md` §Auth, `me.md` §9/§10, `security_conventions.md` fold of mezo-ah18.2, ADR 0034 with the §2 decision table, CODEMAP) → Task 12. Spec §2 rows all appear in the ADR table.

**Placeholder scan:** no TBD/TODO; every code step carries the code. Four "confirm the exact name with grep" notes remain by design: the S3 `LlmActorContext` package (Task 6 — single import site), the `FakeCompanionLlm` echo-sentinel constant and `DailySummaryPopulator.summary` signature (Task 3 test), and the `QuestService` day-read method (Task 7 test) — each names the exact grep and the fallback shape.

**Type consistency:** `PromptPersona.render(UUID, String)` / `fill(PersonaContext, String)` / `USER_TURN_LABEL` / `NAME_TOKEN` used identically in Tasks 1–4; `UserFanOut.forEachActiveUser(String, Consumer<AppUserEntity>)` in Tasks 6–7; `UserPopulator.save(AppUserEntity)` introduced in Task 1 and used in Tasks 1, 3, 6, 7; `userScopedKey`/`userScopedPrefix`/`setCurrentUserId`/`currentUserId` in Tasks 9–10; `snoozeKey()` replaces `SNOOZE_KEY` in both logic files and their tests; `splitTranscriptLines`/`USER_ANSWER_PREFIXES`/`Line.isUser` in Task 5; `ProfileIdentity`/`useProfile` in Task 11; `KonziliumProposalRound.USER_FEEDBACK_PREFIX` value matches Task 5's first prefix and Table C.
