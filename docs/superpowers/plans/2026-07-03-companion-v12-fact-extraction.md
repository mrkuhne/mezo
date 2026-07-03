# Companion V1.2 — Fact extraction + confirm UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the chat proposes what it learned (post-turn async LLM extraction → `learned_fact` candidates, deduped), Daniel confirms with one tap (accept / refine / reject — explicit L2 cards on a real dual-mode KnowledgeListPage), and confirmed facts start flowing into every prompt via the existing V1.1 injection.

**Architecture:** `ChatService` publishes a `ChatTurnCompleted` event after persisting the assistant row (sync + streamed path); a switch-gated `FactExtractionListener` (`@TransactionalEventListener(AFTER_COMMIT)` + `@Async`) delegates to a fully-sync-testable `FactExtractionService` that calls the cheap LLM tier through the existing `CompanionLlm` port with a strict-JSON extraction prompt, parses defensively, dedupes string-level against confirmed facts + pending candidates, and persists capped `learned_fact` rows. A new `FactCandidateService` serves the pending inbox + the decision endpoint (accept/refine → promote into `knowledge_fact` with `source=chat`). The FE unifies on the backend category taxonomy, grows `knowledgeApi` + dual-mode `useKnowledge`/`useKnowledgeActions`, and rewires KnowledgeListPage into the L2 confirm surface.

**Tech Stack:** Spring Boot 4 (`@TransactionalEventListener`, `@EnableAsync`, Jackson 3 `tools.jackson`), Spring AI 2 port (two-string `complete`), Liquibase, Awaitility (test), TanStack Query dual-mode hooks, Vitest/MSW.

**Driver:** bd `mezo-fnnq.7` · roadmap §V1.2 · spec §3/§6 (L2 decision layering, IDENT-6) · living doc `docs/features/companion.md`.

## Global Constraints

- Branch `feat/companion-v12`; conventional commits carrying `(mezo-fnnq.7)`.
- Backend gate: `cd backend && ./mvnw clean test` (ALWAYS `clean`; compose Postgres up).
- FE gate: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes green.
- Contract-first: `api/feature/companion/companion.yml` BEFORE code; merge `cd api/generate && npm run generate:api`; FE regen `cd frontend && pnpm generate:api`.
- Every new companion bean `@ConditionalOnProperty(COMPANION_SWITCH)`; the extraction LISTENER additionally gated on the new `mezo.companion.extraction.enabled`.
- No LLM in tests — `companion-fake`; the fake answers extraction calls deterministically via a `[fake-facts:<json>]` content sentinel keyed on the extraction prompt marker.
- Config under `mezo.companion.extraction.*` on `CompanionProperties`; switch keys as constants in `FeaturesConfiguration`; never `@Value`.
- Async work must NEVER break a chat turn: listener catches everything; extraction parse failure → log + zero candidates.
- Migration: additive changeset only (`learned_fact.category`); never modify the released V1.1 changeset. New columns mirrored on the entity.
- FE: hooks from `@/data/hooks` only; implementations in `data/insights/knowledge{Api,Hooks}.ts`; `useDualQuery` for reads; NO mock seed as real-mode fallback; signatures stay backward-compatible (`useKnowledge` keeps `facts`/`edges`/`activeCount`).
- AssertJ only; ITs extend the shared bases; naming `test{Method}_should{Result}_when{Condition}`.

## Decisions locked (V1.2)

1. **Trigger = Spring event, AFTER_COMMIT + @Async** (the `spring_patterns.md` sanctioned pattern). `ChatTurnCompleted(userId, userMessageId, userContent, assistantContent)` published by `ChatService` in BOTH paths; `PreparedTurn` grows `userMessageId` so the streamed path can anchor candidates. In `@Transactional` (rollback) ITs the event never fires — no cross-test interference by construction.
2. **Extraction cadence: per-turn async, config-gated** (`mezo.companion.extraction.enabled`, default true) — the roadmap's in-slice cadence decision. Daily batch deferred; flipping the switch off removes the listener bean.
3. **Extraction scope: the whole turn** (user + assistant text), but the prompt restricts to facts *Daniel stated or confirmed* — assistant-only claims are excluded by instruction, not by truncating input.
4. **Structured output = strict JSON array over the existing two-string port** — no port change (YAGNI). Defensive parse: first `[`…last `]` substring, Jackson 3, unknown categories dropped, failure → log + skip. Never throws into the async boundary.
5. **`learned_fact` grows `category`** (additive migration, NOT NULL + `ck_learned_fact_category`, backfill `'life'`) — accept/refine must know the target category; the extractor classifies at capture time.
6. **Dedupe v1 = normalized string equality** (trim, lowercase, whitespace-collapse) against the user's `knowledge_fact.fact_text` AND pending `learned_fact.candidate_text`; per-turn cap `mezo.companion.extraction.max-candidates-per-turn` (default 3). Embedding-level dedupe re-evaluated after V2.1.
7. **Decision API on the candidate resource:** `GET /api/companion/fact/candidate` (pending, newest first) + `POST /api/companion/fact/candidate/{candidateId}/decision` (`{decision: accept|reject|refine, refinedText?}`) → the updated `FactCandidateResponse`. Accept/refine create `knowledge_fact` (`source=chat`, `include_in_prompt=true`); refine requires `refinedText` (FIELD `VALIDATION_REQUIRED_FIELD`); re-deciding → 400 `COMPANION_CANDIDATE_ALREADY_DECIDED` (new messages.properties code). Confirm is explicit L2 — nothing auto-promotes.
8. **Accept does NOT dedupe against confirmed facts** — extraction already deduped at capture; double-confirm collapse is V1.3 redundancy-guard territory (noted in the living doc).
9. **FE taxonomy unifies on the backend enum** (`train|fuel|health|life`): `FactCategory` retyped, the 15-fact mock seed remapped, `FACT_CATEGORIES` → 4 HU labels (Edzés/Étkezés/Egészség/Élet), `factCategoryColor` maps onto 4 existing `--cat-*` CSS vars (no CSS change). The Me KnowledgePage (graph prototype) keeps working — real mode simply gets `edges: []` (honest zero).
10. **FE domain types stay lean:** `KnowledgeFact {id, text, category, active, reinforced}` (wire mapped in `knowledgeApi`: `factText→text`, `includeInPrompt→active`, `reinforcementCount→reinforced`); new `FactCandidate {id, text, category}`. `useKnowledge()` adds `candidates`, `degraded`, `mode` (additive). `useKnowledgeActions()` = `{toggle, decide}`, mock branch mutates the `['knowledge']` cache via `setQueryData` (the medicationHooks pattern).
11. **Refine UX = inline** on the candidate card (reveal input + save) — no new Sheet; the L2 card IS the surface (IDENT-6).
12. **Async infra born now:** `techcore/configuration/AsyncConfiguration` (`@EnableAsync` only — Boot's auto-configured `applicationTaskExecutor` serves; tuning belongs in `spring.task.execution.*` YAML if ever needed). Awaitility (test scope, Boot-BOM version) for the one commit-path flow IT.

## File map

**Backend main:** `feature/companion/` → `service/ChatTurnCompleted.java` (new record), `service/FactExtractionService.java` (new), `service/FactExtractionListener.java` (new), `service/FactCandidateService.java` (new), `service/ChatService.java` (publish + PreparedTurn.userMessageId), `service/ChatStreamService.java` (pass-through), `entity/LearnedFactEntity.java` (+category), `repository/LearnedFactRepository.java` (+2 finders), `mapper/CompanionMapper.java` (+toFactCandidateResponse), `config/CompanionProperties.java` (+Extraction), `llm/FakeCompanionLlm.java` (extraction sentinel), `controller/CompanionController.java` (+2 overrides); `techcore/configuration/AsyncConfiguration.java` (new), `FeaturesConfiguration.java` (+EXTRACTION switch const); `resources/application.yml` (+extraction block), `messages.properties` (+1 code), migration `1.0.0/script/{ts}_mezo-fnnq.7_learned_fact_category.sql` + master registration.

**Backend test:** `FactExtractionServiceIT`, `FactCandidateServiceIT`, `CompanionFactCandidateApiIT`, `ChatExtractionFlowIT` (new); `LearnedFactPersistenceIT`, `CompanionApiSwitchOffIT`, `CompanionPropertiesIT`, `support/populator/LearnedFactPopulator` (updated); `backend/pom.xml` (+awaitility test dep).

**Frontend:** `data/types.ts` (FactCategory retype + FactCandidate), `data/insights/knowledge.ts` (seed remap + candidate seed + 4-entry FACT_CATEGORIES/colors), `data/insights/knowledgeApi.ts` (new), `data/insights/knowledgeHooks.ts` (new — useKnowledge/useKnowledgeActions), `data/insights/insightsHooks.ts` (drop useKnowledge), `data/hooks.ts` (re-export switch), `features/insights/pages/KnowledgeListPage.tsx` (rewrite), `src/test/msw/handlers.ts` (+fact handlers); tests: `knowledgeApi.test.ts`, `knowledgeHooks.test.tsx` (new), `KnowledgeListPage.test.tsx` (rewrite), `features/me/pages/KnowledgePage.test.tsx` (category remap touch-ups if asserted).

**Docs:** `docs/features/companion.md`, `docs/features/insights.md` (KnowledgeListPage real), `docs/milestones/roadmap.md`, this plan.

---

### Task 1: Contract — candidate endpoints + schemas, regen

**Files:** Modify `api/feature/companion/companion.yml`; regenerate `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts`.

**Interfaces produced:** generated `CompanionApi.listFactCandidates()` / `decideFactCandidate(UUID, FactDecisionRequest)`; DTOs `FactCandidateResponse {id, candidateText, category, userDecision?, refinedText?, promotedFactId?, createdAt}`, `FactDecisionRequest {decision, refinedText?}`.

- [ ] Add under `paths:` (before the stream path):

```yaml
  /api/companion/fact/candidate:
    get:
      tags: [Companion]
      operationId: listFactCandidates
      summary: Pending (undecided) extraction candidates, newest first (V1.2)
      responses:
        '200': { description: Pending candidates, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/FactCandidateResponse' } } } } }
        '401': { description: Missing or invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/companion/fact/candidate/{candidateId}/decision:
    post:
      tags: [Companion]
      operationId: decideFactCandidate
      summary: Decide a candidate — accept/refine promote it into a knowledge fact (source=chat), reject archives it. One decision per candidate (L2 explicit confirm).
      parameters:
        - name: candidateId
          in: path
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/FactDecisionRequest' }
      responses:
        '200': { description: The decided candidate (promotedFactId set on accept/refine), content: { application/json: { schema: { $ref: '#/components/schemas/FactCandidateResponse' } } } }
        '400': { description: Validation error / already decided, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing or invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Candidate not found (or owned by someone else), content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
```

- [ ] Add schemas: `FactCandidateResponse` (required `[id, candidateText, category, createdAt]`; `userDecision`/`refinedText`/`promotedFactId` nullable) and `FactDecisionRequest` (required `[decision]`; `decision: pattern ^(accept|reject|refine)$`; `refinedText: minLength 1, maxLength 500, nullable`).
- [ ] `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`; commit.

### Task 2: Migration — `learned_fact.category` + entity/populator/IT update

**Files:** Create `backend/src/main/resources/db/changelog/1.0.0/script/{UTCts}_mezo-fnnq.7_learned_fact_category.sql`; modify `1.0.0_master.yml`, `LearnedFactEntity.java`, `support/populator/LearnedFactPopulator.java`, `LearnedFactPersistenceIT.java`.

- [ ] RED: extend `LearnedFactPersistenceIT.testCandidate_shouldPersistUndecided_whenCreated` to assert `reloaded.getCategory()` equals the populated category; populator gains `candidate(createdBy, text, category, derivedFromMessageId)` (3-arg overload defaults `"life"`). Run → compile fail (no `getCategory`).
- [ ] GREEN: migration SQL:

```sql
-- V1.2: extraction classifies at capture time; accept/refine promotes with this category.
alter table learned_fact add column category varchar(16);
update learned_fact set category = 'life' where category is null;
alter table learned_fact alter column category set not null;
alter table learned_fact add constraint ck_learned_fact_category check (category in ('train', 'fuel', 'health', 'life'));
```

Register changeset `1.0.0:{ts}_mezo-fnnq.7_learned_fact_category` (author daniel.kuhne). Entity: `@NotNull @Size(max=16) @Pattern(regexp = "train|fuel|health|life") @Column(nullable = false, length = 16) private String category;`. Run IT → green. Commit.

### Task 3: Config + async infra — Extraction properties, switch, `@EnableAsync`, Awaitility

**Files:** Modify `CompanionProperties.java`, `application.yml`, `FeaturesConfiguration.java`, `CompanionPropertiesIT.java`, `backend/pom.xml`; create `techcore/configuration/AsyncConfiguration.java`.

- [ ] RED: `CompanionPropertiesIT` gains `testExtractionConfig_shouldBindFromYaml_whenContextStarts` asserting `properties.extraction().enabled()` true and `maxCandidatesPerTurn()` 3.
- [ ] GREEN: `Extraction(boolean enabled, @Min(1) @Max(10) int maxCandidatesPerTurn)` record (`@NotNull @Valid` component); YAML under `mezo.companion`:

```yaml
    extraction:
      # V1.2 post-turn fact extraction — async, per-turn; off = the listener bean does not exist
      enabled: true
      # Max learned_fact candidates persisted per chat turn (dedupe runs first)
      max-candidates-per-turn: 3
```

`FeaturesConfiguration`: `public static final String COMPANION_EXTRACTION_SWITCH = "mezo.companion.extraction.enabled";`. `AsyncConfiguration`: `@Configuration @EnableAsync public class AsyncConfiguration {}` (Boot's auto-configured executor serves `@Async`). pom: `org.awaitility:awaitility` test-scope (Boot BOM version). Run IT → green. Commit.

### Task 4: `FactExtractionService` + fake-LLM extraction sentinel (TDD core)

**Files:** Create `service/FactExtractionService.java`; modify `llm/FakeCompanionLlm.java`, `repository/LearnedFactRepository.java`; create `FactExtractionServiceIT.java`.

**Interfaces produced:** `int extractFromTurn(UUID userId, UUID userMessageId, String userContent, String assistantContent)` (returns persisted count); `FactExtractionService.EXTRACTION_MARKER` (prompt header keyed by the fake); repo finders `findByCreatedByAndUserDecisionIsNullAndDeletedFalseOrderByCreatedAtDesc(UUID)` and `findByIdAndCreatedByAndDeletedFalse(UUID, UUID)`.

- [ ] RED — `FactExtractionServiceIT` (`@Transactional`, `@ActiveProfiles("companion-fake")`), tests:
  - `testExtractFromTurn_shouldPersistCandidates_whenLlmReturnsFacts` — sentinel `[fake-facts:[{"fact":"Laktózérzékeny","category":"health"},{"fact":"Reggel edz szívesen","category":"train"}]]` in userContent → 2 pending rows with category + `derivedFromMessageId`.
  - `testExtractFromTurn_shouldSkipDuplicates_whenFactAlreadyConfirmedOrPending` — pre-seed `knowledge_fact` "Laktózérzékeny" (KnowledgeFactPopulator) + pending candidate "reggel edz  szívesen" (case/space variant) → 0 new rows.
  - `testExtractFromTurn_shouldCapCandidates_whenMoreThanBudget` — 5 facts in sentinel → 3 rows (`max-candidates-per-turn`).
  - `testExtractFromTurn_shouldDropUnknownCategory_whenLlmInventsOne` — category `"sport"` → that item skipped.
  - `testExtractFromTurn_shouldPersistNothing_whenLlmAnswerIsNotJson` — no sentinel (fake answers `[]`)… plus a malformed-sentinel case `[fake-facts:not-json]` → 0 rows, no exception.
- [ ] GREEN — service (switch-gated on COMPANION_SWITCH only; `@Transactional` on `extractFromTurn`):

```java
public static final String EXTRACTION_MARKER = "TÉNYKINYERÉS";
static final String EXTRACTION_PROMPT = """
        TÉNYKINYERÉS. A következő beszélgetés-fordulóból gyűjtsd ki a Danielre vonatkozó ÚJ, tartós tényeket
        (preferencia, szokás, egészségi jellemző, cél) — kizárólag azt, amit Daniel maga állított vagy megerősített.
        Ne vegyél fel egyszeri eseményt, kérdést, feltételezést, sem a Mezo saját javaslatait.
        Válaszolj KIZÁRÓLAG egy JSON tömbbel, magyarázat nélkül, pontosan ebben a formában:
        [{"fact":"...","category":"train|fuel|health|life"}]
        Ha nincs új tartós tény: []""";
```

Flow: transcript `"Daniel: %s\nMezo: %s"` → `companionLlm.complete(EXTRACTION_PROMPT, transcript)` → `parse()` (first `[`..last `]`, Jackson 3 `ObjectMapper` bean, record `ExtractedFact(String fact, String category)`, filter blank/unknown-category) → normalize+dedupe (existing fact texts via `KnowledgeFactRepository.findByCreatedByAndDeletedFalse…` + pending candidates finder; `normalize = trim().toLowerCase().replaceAll("\\s+", " ")`; also dedupe within the batch) → cap → persist `LearnedFactEntity` rows. All parse/LLM failures caught → `log.warn` → 0. Fake: in `complete()`, `if (systemPrompt.startsWith(FactExtractionService.EXTRACTION_MARKER))` return the `[fake-facts:(…)]` group from the user message (regex `\[fake-facts:(\[.*?\]|[^\]]*)]`, DOTALL) or `"[]"`. Run → green. Commit.

### Task 5: Event publish + async listener + commit-path flow IT

**Files:** Create `service/ChatTurnCompleted.java`, `service/FactExtractionListener.java`, `ChatExtractionFlowIT.java`; modify `service/ChatService.java`, `service/ChatStreamService.java`.

**Interfaces produced:** `record ChatTurnCompleted(UUID userId, UUID userMessageId, String userContent, String assistantContent)`; `ChatService.PreparedTurn` gains `UUID userMessageId`; `completeTurn(userId, conversationId, answer, audit, userMessageId)`.

- [ ] RED — `ChatExtractionFlowIT extends ApiIntegrationTest` (commits; `@ActiveProfiles("companion-fake")`): POST a message whose content carries a `[fake-facts:…]` sentinel; `await().atMost(5, SECONDS).untilAsserted(...)` a pending `learned_fact` row exists for the owner. Second test: `testListener_shouldNotExist_whenExtractionDisabled` (`@TestPropertySource(properties = "mezo.companion.extraction.enabled=false")` → `context.getBeanProvider(FactExtractionListener.class).getIfAvailable()` is null — separate IT class `ChatExtractionSwitchOffIT` to keep contexts clean).
- [ ] GREEN — `ChatService`: inject `ApplicationEventPublisher`; `sendMessage` publishes after the assistant row; `prepareTurn` returns the persisted user row id; `completeTurn(…, UUID userMessageId)` publishes; `ChatStreamService` passes `turn.userMessageId()`. Listener:

```java
@Async
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
public void onChatTurnCompleted(ChatTurnCompleted event) {
    try {
        factExtractionService.extractFromTurn(event.userId(), event.userMessageId(),
                event.userContent(), event.assistantContent());
    } catch (Exception e) {
        log.warn("Post-turn fact extraction failed", e);
    }
}
```

gated `@ConditionalOnProperty(name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.COMPANION_EXTRACTION_SWITCH}, havingValue = "true")`. Run flow IT + existing ChatServiceIT/ChatStreamServiceIT → green. Commit.

### Task 6: `FactCandidateService` — pending list + decision (TDD)

**Files:** Create `service/FactCandidateService.java`, `FactCandidateServiceIT.java`; modify `mapper/CompanionMapper.java`, `messages.properties`.

**Interfaces produced:** `List<FactCandidateResponse> listPending(UUID userId)`; `FactCandidateResponse decide(UUID userId, UUID candidateId, FactDecisionRequest request)`; mapper `toFactCandidateResponse(LearnedFactEntity)`; message code `COMPANION_CANDIDATE_ALREADY_DECIDED`.

- [ ] RED — `FactCandidateServiceIT` (`@Transactional`): pending list = undecided only, newest first, owner-scoped; accept → candidate decided + `promotedFactId` set + a `knowledge_fact` row with `source=chat`/`include_in_prompt=true`/text=candidateText/category carried; refine → requires `refinedText` (thrown `SystemRuntimeErrorException`, FIELD `VALIDATION_REQUIRED_FIELD` on `refinedText`), promoted fact uses the refined text, candidate stores it; reject → decision only, NO knowledge_fact; second decide → 400 `COMPANION_CANDIDATE_ALREADY_DECIDED`; foreign candidate → 404.
- [ ] GREEN — service (switch-gated, `@Transactional` on `decide`): getOwned via new repo finder → guard `userDecision == null` else 400; `switch (request.getDecision())` accept/refine/reject; promotion writes `KnowledgeFactEntity` directly (`SOURCE_CHAT`) via `KnowledgeFactRepository.saveAndFlush`; messages.properties: `COMPANION_CANDIDATE_ALREADY_DECIDED=This candidate has already been decided.`. Run → green. Commit.

### Task 7: Controller + HTTP ITs + switch-off

**Files:** Modify `controller/CompanionController.java`, `CompanionApiSwitchOffIT.java`; create `CompanionFactCandidateApiIT.java`.

- [ ] RED — `CompanionFactCandidateApiIT extends ApiIntegrationTest`: 401 without token (GET); seeded candidate (populator) round-trip: GET list contains it → POST accept decision 200 (`promotedFactId` non-null) → GET list now empty AND `GET /api/companion/fact` contains the promoted fact (`source=chat`); POST refine without `refinedText` → 400 FIELD `VALIDATION_REQUIRED_FIELD` on `refinedText`; POST on decided candidate → 400 REQUEST `COMPANION_CANDIDATE_ALREADY_DECIDED`; POST unknown id → 404. `CompanionApiSwitchOffIT` gains candidate-path 404.
- [ ] GREEN — controller overrides `listFactCandidates()` / `decideFactCandidate(...)` delegating to `FactCandidateService` with `currentUserId.get()`. Run → green. Commit.

### Task 8: FE — taxonomy unification + `knowledgeApi` + MSW

**Files:** Modify `frontend/src/data/types.ts`, `frontend/src/data/insights/knowledge.ts`, `frontend/src/test/msw/handlers.ts`; create `frontend/src/data/insights/knowledgeApi.ts` + `knowledgeApi.test.ts`.

**Interfaces produced:** `FactCategory = 'train' | 'fuel' | 'health' | 'life'`; `FactCandidate {id, text, category}`; `knowledgeApi.listFacts(): Promise<KnowledgeFact[]>`, `listCandidates(): Promise<FactCandidate[]>`, `toggleFact(id, active)`, `decide(id, decision, refinedText?)`.

- [ ] RED — `knowledgeApi.test.ts` (MSW): wire→domain mapping (`factText→text`, `includeInPrompt→active`, `reinforcementCount→reinforced`; candidate `candidateText→text`); toggle sends `{includeInPrompt}` `satisfies UpdateFactRequest`; decide sends `{decision, refinedText}` `satisfies FactDecisionRequest`.
- [ ] GREEN — retype `FactCategory`; remap the 15 seed facts onto the 4 categories + add `export const candidateSeed: FactCandidate[]` (2 entries); `FACT_CATEGORIES` → `[['train','Edzés'],['fuel','Étkezés'],['health','Egészség'],['life','Élet']]`; `factCategoryColor`: train→`var(--cat-physiology)`, fuel→`var(--cat-trigger)`, health→`var(--cat-goal-state)`, life→`var(--cat-preference)`. `knowledgeApi.ts` over `apiFetch` typed from `api.gen.ts`. MSW: in-memory fact/candidate stores mirroring the seeds, handlers for all 4 endpoints. Run FE tests → green (fix any KnowledgePage/KnowledgeListPage test fallout from the remap here only if compile-level; behavioral rewrites come in Task 10). Commit.

### Task 9: FE — dual-mode `useKnowledge` / `useKnowledgeActions`

**Files:** Create `frontend/src/data/insights/knowledgeHooks.ts` + `knowledgeHooks.test.tsx`; modify `insightsHooks.ts` (remove useKnowledge), `data/hooks.ts` (re-export from knowledgeHooks + export useKnowledgeActions).

**Interfaces produced:** `useKnowledge(): {facts, candidates, edges, activeCount, degraded, mode}`; `useKnowledgeActions(): {toggle(id, active), decide(id, decision, refinedText?), pending}`.

- [ ] RED — `knowledgeHooks.test.tsx`: mock mode returns seed facts + candidateSeed + edges; real mode fetches both endpoints (`['knowledge']` key), `edges: []`; real 404 → `degraded: true`; `toggle` (real) PATCHes + invalidates; `decide` (real) POSTs + invalidates; mock `toggle`/`decide` mutate the cache (fact flips, candidate disappears, accept appends fact).
- [ ] GREEN — `useDualQuery` bootstrap (mock: `{facts, candidates: candidateSeed, edges}`; real: `Promise.all([listFacts, listCandidates])` → `{facts, candidates, edges: []}`, `realEmpty` honest-empty, 404→degraded following the chatHooks pattern); actions via `useMutation` with mock `setQueryData` branch (medicationHooks pattern). Run → green. Commit.

### Task 10: FE — KnowledgeListPage rewrite (L2 confirm surface)

**Files:** Modify `features/insights/pages/KnowledgeListPage.tsx`, `KnowledgeListPage.test.tsx`; touch `features/me/pages/KnowledgePage.test.tsx` if it asserts old categories.

- [ ] RED — `KnowledgeListPage.test.tsx` both modes: pending section renders candidate cards with Elfogad/Pontosít/Elvet; accept calls `decide(id,'accept')`; refine reveals input, save calls `decide(id,'refine',text)`; reject calls `decide(id,'reject')`; confirmed list toggle calls `toggle(id, !active)`; real-mode degraded → honest banner + no composer of actions; header counts from hook data.
- [ ] GREEN — rewrite: `useKnowledge()` + `useKnowledgeActions()`; "Jóváhagyásra vár · N" candidate cards (category chip + 3 actions, inline refine input); confirmed facts (existing card style, toggle wired, opacity from `active`); degraded banner (`A társ jelenleg nincs bekapcsolva…` — ChatPage copy family); footer note kept. Run page tests + full FE suite both modes → green. Commit.

### Task 11: Gates

- [ ] `cd backend && ./mvnw clean test` → all green.
- [ ] `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → all green.

### Task 12: Docs + close

- [ ] `docs/features/companion.md`: V1.2 shipped block, status table (extraction/UI ✅), turn diagram (+post-turn async), §4 (candidate endpoints, learned_fact.category, extraction config), §5 (Insights seam update), §7 (V1.3 plug-in), §8 (new ITs), §9 decisions 26+, §10 key files. `docs/features/insights.md`: KnowledgeListPage real (dual-mode, degraded). `docs/milestones/roadmap.md`: V1.2 milestone row + phase-line update.
- [ ] `node scripts/lint-docs.mjs` → PASS.
- [ ] Merge: `git checkout main && git pull --rebase && git merge --no-ff feat/companion-v12 && git branch -d feat/companion-v12` (rebase BEFORE merge, push directly after — never rebase after the merge).
- [ ] `bd close mezo-fnnq.7` + notes; `bd dolt push && git push`; `git status` up to date.

## Self-review notes

- Spec coverage: extraction (roadmap "post-turn async, dedupe") → Tasks 4–5; confirm UI (accept/refine/reject + toggle) → Tasks 6–7 + 10; dual-mode hooks → Task 9; cadence decision → locked #2; dedupe heuristic decision → locked #6; extraction-scope decision → locked #3. Pattern-sourced facts explicitly out (V3.3).
- Type consistency: `FactCandidateResponse`/`FactDecisionRequest` names used identically in Tasks 1, 6, 7, 8; `ChatTurnCompleted` fields match publisher and listener; `extraction()` accessor matches the `Facts`-style record naming.
- Known risk: `@Async` in ApiIntegrationTest contexts — extraction fires post-commit in EVERY committing companion IT; the fake answers `[]` for sentinel-less turns → no rows, no interference. Awaitility only in the dedicated flow IT.
