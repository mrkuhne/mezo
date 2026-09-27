# Mezo emlékezete S8 — a chat memóriája, látható és őszinte · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the chat turn the unit of visible memory — every turn shows what Mezo *learned* (person facts, undoable), *proposes* (owner facts, Igen/Ne), *recalled* (people whose facts fed the answer) and *forgot* ("ezt ne jegyezd meg") — and make the model's own words about memory truthful.

**Architecture:** Code decides, the LLM only talks. A new read (`GET …/turn-memory`) composes one turn's memory from the people-owned person-fact port, `learned_fact` rows by `derived_from_message_id`, and a new `ai_message.forgotten_memories` envelope. A deterministic forget-intent pre-screen and a deterministic people matcher run inside `ChatService` before routing, feed volatile prompt blocks (`[Emberek]`, `[Ebben a beszélgetésben]`, `[Elfelejtve]`) and persist their results (forget envelope + `extraction_blocked`, `recalled_memories` `kind=person`). The FE extracts S7's `RememberedChip` into one shared `MemoryChip` (four variants) and renders it under each turn of the session.

**Tech Stack:** Java 25 / Spring Boot 4 / JPA + Liquibase / PostgreSQL 16 (Testcontainers ITs), OpenAPI contract-first (`api/feature/companion/companion.yml` → `api/generate` merge → maven generate-sources → `pnpm generate:api`), React 19 + TanStack Query + Vitest + MSW, Playwright layout specs.

**Driving bead:** `mezo-d6ivw.12` (folds `mezo-d6ivw.9` / S6b). Spec: [`docs/superpowers/specs/2026-09-24-mezo-emlekezete-design.md`](../specs/2026-09-24-mezo-emlekezete-design.md) §"S8 delta". Approved prototype: [`docs/design_2.0/prototypes/elo/mezo.html`](../../design_2.0/prototypes/elo/mezo.html) (search `S8 ·`).

## Global Constraints

- Owner decisions (spec S8 §Owner decisions 1–6) are fixed: owner facts are **asked in place** ("Megjegyezném: … [Igen] [Ne]"), person facts keep S3 auto-save + **"Megjegyeztem: … [Visszavonom]"**; *Ne* = **permanent** fact_text veto; ignored = stays in the Tudástár inbox; "ezt ne jegyezd meg" forgets the **latest** fact-producing turn and shows what, with a one-tap widen to the whole conversation; forget is **permanent**; recall is visible as **"Emlékszem: …"**; confirmed observations become full sentences (backfill = separate owner OK); **no write tool** — `CompanionToolRegistry` stays read-only.
- Out of scope: weekly fact consolidation (`mezo-d6ivw.10`), learning master switch (`mezo-rrjxe`), source-delete cascade (`mezo-9wp4g`), sensitive-category gate (file a follow-up bead, do not build).
- **FE copy is verbatim from the prototype** (Hungarian, including dashes and quotes): `Megjegyeztem:` · `Megjegyezném:` · `rólad szól, ezért előbb megkérdezlek` · `Igen` / `Ne` · `Visszavonom` · `a Tudástár Rólad részében látod` · `Visszavonva — nem jegyeztem meg.` · `Rendben, nem jegyzem meg — és nem is javaslom újra.` · `Elfelejtve · ` · `Elfelejtettem:` · `végleg — ezeket többé nem használom, és nem is tanulom meg újra` · `Mindent ebből a beszélgetésből?` · `Emlékszem: ` · sheet `EMLÉKSZEM` / `Ezt vettem elő a válaszhoz` / `Csak azt veszem elő, amit a Tudástárban is látsz. Ha valamelyiket nem szeretnéd, ott elhallgattathatod vagy elfelejtheted.` / `Emberek a Tudástárban ›` · sheet `MINDENT EBBŐL A BESZÉLGETÉSBŐL` / `Ezt az egyet is elfelejtem` / `Ezt a kettőt is elfelejtem` / `javaslat, még nem döntöttél róla` / `HH:MM-kor jegyeztem meg` / `Végleges: nem használom többé, és ugyanebből nem tanulom meg újra. Amit máskor, máshol mondasz, azt továbbra is megjegyezhetem.` / `Elfelejtem` / `Elfelejtem mind a kettőt` / `Mégse` · toasts `Elmentve — a Tudástárban bármikor elhallgattathatod.` and `Elfelejtve — ebből a beszélgetésből semmit nem tartok meg.`
- **Icons (all existing, no new sprite work):** `t-spark` remembered · `t-bulb` proposed · `t-people` recalled · `t-eraser` forgotten · `t-person` per-person row in the recall sheet. Never emojis.
- Üveg canon, **dark only**; chips are flat pills outside the answer card (no glass in glass); the recall line sits inside the answer card as a flat pill; every animation has a `prefers-reduced-motion: reduce` branch.
- House patterns: `ObjectProvider` fail-open for people beans (lesson 19); async `AFTER_COMMIT` listeners swallow-and-log; ArchUnit **companion → people only** (people never imports companion); OpenAPI enum-like fields use `enum:` not `pattern:` (lesson 21); contract chain order (lesson 22); no apostrophes inside single-quoted YAML scalars; Liquibase for every schema change; `ResetDatabase` needs no change (no new table — columns only on `ai_message`, lesson 35 checked); new FE routes → none (lesson 43 checked: the recall door reuses `/mezo/knowledge?view=emberek`).
- Every new `LlmCallContext` slug needs an FE admin label (lesson 14) — **S8 adds none** (the prompt blocks ride existing calls; `FakeCompanionLlm`'s default `completeSmart` echo already returns `system=[…]` incl. the volatile half, so ITs assert blocks through the echo; no new marker → no new fake branch, lesson 17 checked).
- Backend test command pattern: `cd backend && ./mvnw test -Dtest='<Class>' -Dmezo.test.use-testcontainers=true` (lesson 27: Testcontainers isolates from parallel sessions). Pipe with `set -o pipefail` (lesson 30).
- FE gates: `cd frontend && CI=true VITE_USE_MOCK=true pnpm test` **and** `CI=true VITE_USE_MOCK=false pnpm test` (both explicit — memory note: unset = mock), `pnpm build`. `pnpm test -- <file>` does NOT scope (memory note) — use `pnpm vitest run <file>` for focused runs.
- Commits: conventional subject carrying `(mezo-d6ivw.12)`, body ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch `feat/emlekezet-s8`; never `cd` to the primary checkout.
- Production DB: reads free; the backfill **apply** is a production write → separate owner OK in the §Communication format (Task 17). Never copy real prod text into commits/docs/prototypes.

## Decisions this plan makes where the spec left the detail open

| Open detail | Decision |
|---|---|
| Forget phrase list | `ForgetIntent` (pure, TextFold-normalized): **(1)** `ne jegyezd meg` anywhere; **(2)** `felejtsd el` NOT preceded by `ne` and followed (after an optional comma) by `ezt`/`azt`/`ezeket` **at a clause end**, or by `amit mondtam`/`amit irtam`/`az elozot`/`az elobbit`/`az elobbieket`/`mindent`; **(3)** the whole message is just `felejtsd el` (optionally with `kerlek`); **(4)** `ezt`/`azt`/`ezeket` + optional `inkabb` + `ne mentsd`/`ne tarold`, or `ne tarold` anywhere. Negatives pinned in the unit table: `Felejtsd el a tervet…`, `Felejtsd el ezt a tervet`, `Ne felejtsd el, hogy…`, `Ne felejtsd el, amit mondtam.`, `Jegyezd meg, hogy…`, `Elfelejtettem bevenni…`, `Mentsd el ezt a receptet.`, `Nem baj, ha nem jegyzed meg.` |
| Forget target | Per spec: the most recent **earlier** user message of the conversation with live memory (active chat person facts, undecided candidates, accepted candidates whose fact is live), scanning ≤ 20 earlier user rows. **Additionally** the immediately preceding user row is always marked `extraction_blocked` (closes the "user types *ne jegyezd meg* before the previous turn's extraction finished" race even when nothing is live yet). |
| No-extract marker | New `ai_message.extraction_blocked boolean not null default false`. Set on the forget message itself, on the forget target, on the immediately preceding user row, and on every user row of a widened forget — via entity `saveAndFlush` (the UPDATE takes the row lock). Both extractors call `MessageExtractionGate.isBlocked(messageId)` = `select extraction_blocked … for share` **inside their saving transaction right before the save**; a forget that commits first always wins, and an extraction that locked first commits before the forget's reads run. `ChatTurnCompleted` gains `extractionBlocked` so the listeners skip the LLM call entirely for a forget message. |
| Nightly cap | `PersonFactService`: **3 per person per source** (`MAX_FACTS_PER_PERSON_PER_SOURCE`) + **15 per source** ceiling (`MAX_FACTS_PER_SOURCE`) — one rule for both `nightly_day` and `chat_turn` sources. |
| `FactTextComposer` | `compose(kind, title, mechanism)`: statistical kind, null or blank mechanism → title. Else whitespace-collapse, split on sentence ends (`.`, `!`, `?`, `…` + whitespace); take the first sentence, append the second only if the pair stays ≤ 280 chars; hard cap 500 (word-boundary cut + `…`, total ≤ 500 = the edit cap). |
| Statistical detection | `PatternEntity.KIND_STATISTICAL.equals(pattern.getKind())` (rows minted by `PatternDetectionService:127`). |
| Turn-memory schema + path | `GET /api/companion/conversation/{conversationId}/turn-memory?messageId=` → `TurnMemoryResponse { learned: TurnPersonFactResponse[], proposed: FactCandidateResponse[], forgotten: MemoryItemResponse[] }`. Path is conversation-scoped (house convention: every chat path lives under `/api/companion/conversation/{id}`; the spec's `/chat/turn-memory` has no sibling). Widen = `GET` (preview) / `POST` (apply) `…/conversation/{id}/forget-learned`. |
| Recall door | `/mezo/knowledge?view=emberek` (the S6 hub's people view — `KnowledgeListPage.test.tsx:84`). |
| Recall disclosure content | A matched person becomes a `kind=person` item only if ≥ 1 active, prompt-enabled fact went in; `gist` = up to 3 raw fact texts joined by `\n` (the sheet's bullets); `similarity = 1.0`. The `[Emberek] (az üzenetben említettek)` block still lists every matched person (≤ 5). |
| `[Ebben a beszélgetésben]` when empty | Omitted (the VOICE rule "claim only what is listed" makes an absent block = nothing to claim) — keeps every existing prompt-echo test stable. |
| Chips on which turns | Every turn **sent in this browser session** (not only the last one); opening an old conversation fetches nothing (S3 rule kept). Polling runs the whole `[2000,3000,5000]` ladder (both extractors land independently) unless the turn is a forget turn. |
| Sheet title for 3+ items | Not in the prototype: `Ezt a {n} dolgot is elfelejtem` / button `Elfelejtem mindet`. The 1- and 2-item copy is the prototype's verbatim. |
| Backfill trigger | `FactTextBackfillRunner` (`CommandLineRunner`) reading `mezo.companion.fact-text-backfill.mode` = `"off"` (default) \| `dry-run` \| `apply`, fanned out with `UserFanOut`; prod flips it with the Deployment env `MEZO_COMPANION_FACTTEXTBACKFILL_MODE`. `"off"` must be quoted in YAML (bare `off` parses as boolean). |

## Spec / code contradictions found while planning (fixed in-plan)

1. **Spec says no FE renders `MessageResponse.recalled`** — false: `ChatMessage.tsx:86` renders `RecalledMemoriesRow` ("Emlékek · N"). Plan: `kind=person` items go to the new "Emlékszem" line only; `RecalledMemoriesRow` gets the non-person items (parity).
2. **S3 real-mode chip anchor is broken**: `chatHooks.sendReal` appends the user bubble **without an id** (`chatHooks.ts:319`), so `ChatPage`'s `lastUserMsgId` resolves to the *previous* user message — the chips poll the wrong turn. Plan: `MessageResponse.turnUserMessageId` on the send/`done` answer, appended as the user bubble's id.
3. **`ActionClaimCheck`** (advisor chain) flags `elmentettem`/`töröltem` as fabricated write claims (`application.yml:2080`). The honest prompt therefore tells the model to say *„megjegyeztem" / „elfelejtettem"*, never *„elmentettem" / „töröltem"*; the term list stays unchanged.
4. **Prod path `routeAndAssemble` returns `ChatMemoryPayload.empty()`** on the conversation-first path, and `completeTurn` picks `audit.recalled()` *instead of* the turn's own envelope — a naive `kind=person` append would be dropped whenever a tool recalled. Plan: `RecalledMemoriesEnvelope.withExtra(base, personItems)` on both paths.
5. Two ITs pin the old action rule text (`ChatServiceIT:467`, `ConversationFirstIT:87`) — updated in Task 8.
6. `PersonFactExtractionService` javadoc and `docs/features/companion.md:279` / `me.md` claim hu-fold name matching; the code is `toLowerCase(HU)` equality (`:117-132`). Fixed to `TextFold` in Task 9 and the docs are made true in Task 15.

---

## File Structure

**Backend — new**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/TurnMemoryService.java` — composes one turn's memory + a conversation's live memory items (read side).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ForgetIntent.java` — pure phrase matcher.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatForgetService.java` — forget-latest / forget-all / preview (write side, delegates to `PersonFactService.undo`, `FactCandidateService.decide(reject)`, `ForgetService.forgetFact`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MessageExtractionGate.java` — the `FOR SHARE` race marker read.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatMemoryBlocks.java` — renders `[Elfelejtve]` and `[Ebben a beszélgetésben]`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PeopleRecall.java` — deterministic people recall (block + disclosure items), switch-gated, fail-open.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/FactTextComposer.java` — pure full-sentence composer.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/FactTextBackfillService.java` + `FactTextBackfillRunner.java` — dry-run/apply backfill.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/ChatMemoryItem.java` + `ForgottenMemoriesEnvelope.java` — jsonb item + envelope.
- `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/MatchedPerson.java` — people-owned matcher result.
- `backend/src/main/resources/db/changelog/1.1.0/script/202609272300_mezo-d6ivw.12_ai_message_forget.sql`
- Tests: `ForgetIntentTest`, `FactTextComposerTest`, `PeopleRecallTest` (unit); `TurnMemoryServiceIT`, `ChatForgetServiceIT`, `ChatForgetTurnIT`, `PeopleRecallIT`, `PeopleRecallSwitchOffIT`, `ChatMemoryBlocksIT`, `FactTextBackfillServiceIT`, `CompanionTurnMemoryApiIT` (IT).

**Backend — modified**
- `api/feature/companion/companion.yml` (+ regenerated `api/openapi.yml`), `FactCandidateService`, `ForgetService`, `LearnedFactRepository`, `AiMessageRepository`, `AiMessageEntity`, `RecalledMemoriesEnvelope`, `CompanionMapper`, `CompanionController`, `ChatService`, `ChatTurnCompleted`, `FactExtractionService`, `FactExtractionListener`, `PersonFactExtractionService`, `PersonFactExtractionListener`, `ConversationTurnService` (VOICE), `KnowledgeFactService` (FACTS_HEADER), `PeopleSnapshotBlock`, `PatternService`, `FeaturesConfiguration`, `application.yml`, `1.1.0_master.yml`; people: `PersonFactService`, `PersonFactRepository`, `MentionDetectionService`, `PersonNeedles`, `PeopleService`.
- `k8s/backend/deployment.yaml` (Task 17 only, gated).

**Frontend — new**
- `frontend/src/features/insights/components/memory/MemoryChip.tsx` (+ `.test.tsx`) — the one shared chip, four variants.
- `frontend/src/features/insights/components/memory/TurnMemoryChips.tsx` (+ `.test.tsx`) — one turn's chips (data + actions).
- `frontend/src/features/insights/sheets/RecallSheet.tsx`, `ForgetAllSheet.tsx` (+ tests).
- `frontend/src/data/insights/turnMemoryApi.ts`, `turnMemoryHooks.ts` (+ `.test.ts`), `turnMemory.ts` (mock seed).
- `frontend/tests/layout/chat-memory.spec.ts`.

**Frontend — modified / deleted**
- `features/insights/components/teamchat/ReplyAfterlife.tsx` (switch to `MemoryChip`), `features/insights/components/ChatMessage.tsx`, `features/insights/pages/ChatPage.tsx` (+ test), `data/insights/chatHooks.ts`, `data/insights/chatApi.ts`, `data/me/peopleHooks.ts` (drop `useTurnFacts`), `data/me/people.ts` (drop `MOCK_TURN_FACTS`), `test/msw/handlers.ts`, `styles/prototype.css`, `data/_client/api.gen.ts` (generated).
- Delete: `features/insights/components/RememberedChips.tsx` + `.test.tsx`.

**Docs**
- `docs/features/companion.md`, `docs/features/me.md`, `docs/features/insights.md`, `docs/features/README.md`, `docs/milestones/roadmap.md`, `docs/CODEMAP.md` (generated), `docs/design_2.0/prototypes/elo/README.md`, spec §Slice lessons (new lessons only if paid for).

---

### Task 0: Pre-flight (no code)

**Files:** none (bd + git only)

- [ ] **Step 1: Check main is green and read what landed (lessons 40, 42)**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mobile-menu-fixed-position-8e3307
gh run list --branch main --limit 1
git fetch origin && git log --oneline origin/main -15
git rebase origin/main
```
Expected: latest `ci` run `completed success`; rebase clean. If main is red, fixing it comes first (CLAUDE.md).

- [ ] **Step 2: Claim the bead and write the *Kész, ha…* checklist into it**

```bash
bd update mezo-d6ivw.12 --claim
bd update mezo-d6ivw.12 --acceptance "$(sed -n '/^## Kész, ha…/,$p' docs/superpowers/plans/2026-09-27-emlekezet-s8-chat-memoria.md)"
bd show mezo-d6ivw.12 | head -40
```
Expected: the acceptance field shows the checklist from the end of this plan.

- [ ] **Step 3: File the out-of-scope follow-up**

```bash
bd create "Sensitive-category gate for the chat fact extractors (S8 follow-up)" -t task -p 3 \
  --description "Researcher recommendation from S8 recon (arxiv 2602.01450): do not auto-save / propose health, sexuality, religion, politics facts without an explicit gate. Deferred by owner decision in spec S8 §Out of scope." \
  --deps discovered-from:mezo-d6ivw.12
```

---

### Task 1: Reject = permanent veto; `FactDecisionRequest.decision` → `enum:`

**Files:**
- Modify: `api/feature/companion/companion.yml:1289-1293` (FactDecisionRequest), regenerate `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ForgetService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/FactCandidateService.java:48-83`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/FactCandidateServiceIT.java`, `CompanionFactCandidateApiIT.java`, `graph/GraphPromotionEventIT.java:79` (enum builder)

**Interfaces:**
- Consumes: `MemoryForgetVetoEntity.factTextVetoKey(String)` (existing, lesson 41).
- Produces: `public void ForgetService.vetoFactText(UUID userId, String text)`; generated `io.mrkuhne.mezo.api.dto.FactDecisionRequest.DecisionEnum { ACCEPT, REJECT, REFINE, SNOOZE }` with `getValue()` / `fromValue(String)`; `FactCandidateService.decide(UUID, UUID, FactDecisionRequest)` unchanged signature, reject now writes the veto.

- [ ] **Step 1: Contract — enum instead of pattern**

In `api/feature/companion/companion.yml`, replace the `decision:` line of `FactDecisionRequest` with:

```yaml
        decision:
          type: string
          enum: [accept, reject, refine, snooze]
          description: >-
            snooze = Most ne: hidden for 14 days, then re-offered, stays undecided. reject is
            permanent since S8 (mezo-d6ivw.12): the candidate text is vetoed and never proposed again.
```

Also update the `decideFactCandidate` summary text `reject archives it` → `reject archives it and vetoes its text (S8)`.

- [ ] **Step 2: Regenerate the contract chain (lesson 22)**

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api && cd ../backend && ./mvnw -q generate-sources
git -C .. diff --stat -- api/openapi.yml frontend/src/data/_client/api.gen.ts
```
Expected: both generated files changed; `grep -n "decision?: \"accept\" | \"reject\" | \"refine\" | \"snooze\"\|decision: \"accept\"" ../frontend/src/data/_client/api.gen.ts` shows a literal union.

- [ ] **Step 3: Write the failing tests**

In `FactCandidateServiceIT`, change the helper and add fields + a test:

```java
    @Autowired private FactExtractionService factExtractionService;
    @Autowired private MemoryForgetVetoRepository vetoRepository;

    private FactDecisionRequest decision(String decision, String refinedText) {
        return FactDecisionRequest.builder()
                .decision(FactDecisionRequest.DecisionEnum.fromValue(decision))
                .refinedText(refinedText).build();
    }

    @Test
    void testDecide_shouldVetoTextAndBlockReproposal_whenRejected() {
        UUID userId = databasePopulator.populateUser("s8-reject-veto@test.local");
        LearnedFactEntity candidate = learnedFactPopulator.candidate(userId, "Hajnalban szeretek futni", "train", null);

        factCandidateService.decide(userId, candidate.getId(), decision("reject", null));

        assertThat(vetoRepository.existsByCreatedByAndDomainAndVetoKeyAndDeletedFalse(userId,
                MemoryForgetVetoEntity.DOMAIN_FACT_TEXT,
                MemoryForgetVetoEntity.factTextVetoKey("Hajnalban szeretek futni"))).isTrue();
        int persisted = factExtractionService.extractFromTurn(userId, UUID.randomUUID(),
                "[fake-facts:[{\"fact\":\"hajnalban  szeretek FUTNI\",\"category\":\"train\",\"owner\":\"mocor\"}]]",
                "ok");
        assertThat(persisted).isZero();
    }
```

Imports: `io.mrkuhne.mezo.feature.companion.entity.MemoryForgetVetoEntity`, `io.mrkuhne.mezo.feature.companion.repository.MemoryForgetVetoRepository`, `io.mrkuhne.mezo.feature.companion.service.FactExtractionService`. The class needs `@ActiveProfiles("companion-fake")` for the fake LLM — add it if absent (the fake is what answers `[fake-facts:…]`).

In `CompanionFactCandidateApiIT` change the helper the same way (`DecisionEnum.fromValue(decision)`) and add:

```java
    @Test
    void testDecideFactCandidate_shouldReturn400_whenDecisionIsNotInTheEnum() {
        LearnedFactEntity candidate = learnedFactPopulator.candidate(ownerId(), "Enum-próba", "life", null);
        exchangeForBody("/api/companion/fact/candidate/" + candidate.getId() + "/decision", HttpMethod.POST,
                java.util.Map.of("decision", "maybe"), ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
    }
```

(Use the class's existing owner-id helper and populator field names — read the file's first 40 lines; if it seeds through the API instead, seed the candidate the same way the other tests do.) In `graph/GraphPromotionEventIT.java:79` use `.decision(FactDecisionRequest.DecisionEnum.ACCEPT)`.

- [ ] **Step 4: Run to see them fail**

```bash
cd backend && set -o pipefail && ./mvnw test -Dtest='FactCandidateServiceIT,CompanionFactCandidateApiIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -30
```
Expected: compile error in `FactCandidateService` (`request.getDecision()` is now `DecisionEnum`), after fixing that the veto test FAILS (`isTrue` expected).

- [ ] **Step 5: Implement**

`ForgetService` — add below `forgetObservation`:

```java
    /** S8 (mezo-d6ivw.12): a rejected proposal is never proposed again — the SAME fact_text veto a
     *  forget writes, through the one shared key helper (lesson 41). Idempotent. */
    @Transactional
    public void vetoFactText(UUID userId, String text) {
        veto(userId, MemoryForgetVetoEntity.DOMAIN_FACT_TEXT, MemoryForgetVetoEntity.factTextVetoKey(text));
    }
```

`FactCandidateService` — inject `private final ForgetService forgetService;` and rewrite `decide`:

```java
    @Transactional
    public FactCandidateResponse decide(UUID userId, UUID candidateId, FactDecisionRequest request) {
        LearnedFactEntity candidate = getOwned(userId, candidateId);
        if (candidate.getUserDecision() != null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("COMPANION_CANDIDATE_ALREADY_DECIDED").build());
        }
        String decision = request.getDecision().getValue();
        if (LearnedFactEntity.DECISION_SNOOZE.equals(decision)) {
            // „Most ne” (U9b): not a decision — the candidate stays open and returns in 14 days.
            candidate.setSnoozedUntil(Instant.now().plus(CandidateSnooze.DURATION));
            return mapper.toFactCandidateResponse(learnedFactRepository.saveAndFlush(candidate));
        }
        switch (decision) {
            case LearnedFactEntity.DECISION_ACCEPT ->
                    candidate.setPromotedFactId(promote(userId, candidate.getCandidateText(), candidate));
            case LearnedFactEntity.DECISION_REFINE -> {
                if (request.getRefinedText() == null || request.getRefinedText().isBlank()) {
                    throw new SystemRuntimeErrorException(
                            SystemMessage.field("VALIDATION_REQUIRED_FIELD", "refinedText").build());
                }
                candidate.setRefinedText(request.getRefinedText());
                candidate.setPromotedFactId(promote(userId, request.getRefinedText(), candidate));
            }
            // S8 (mezo-d6ivw.12): "Ne" is permanent — chat chip AND inbox. The extractor's veto
            // check (FactExtractionService) then never re-proposes the same text.
            case LearnedFactEntity.DECISION_REJECT -> forgetService.vetoFactText(userId, candidate.getCandidateText());
            default -> throw new SystemRuntimeErrorException(
                    SystemMessage.field("VALIDATION_INVALID_VALUE", "decision").build());
        }
        candidate.setUserDecision(decision);
        if (candidate.getPromotedFactId() != null) {
            eventPublisher.publishEvent(new KnowledgeFactPromotedEvent(userId, candidate.getPromotedFactId()));
        }
        return mapper.toFactCandidateResponse(learnedFactRepository.saveAndFlush(candidate));
    }
```

Fix any other main-code caller of `FactDecisionRequest.getDecision()` or `.builder().decision(String)`:

```bash
grep -rn "FactDecisionRequest" backend/src/main/java | grep -v "^.*import"
```
Expected: only `FactCandidateService` and `CompanionController` (pass-through, no change).

- [ ] **Step 6: Run the tests**

```bash
cd backend && set -o pipefail && ./mvnw test -Dtest='FactCandidateServiceIT,CompanionFactCandidateApiIT,GraphPromotionEventIT,FactExtractionServiceIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -15
```
Expected: `BUILD SUCCESS`, 0 failures.

- [ ] **Step 7: FE compile check (the union type) and commit**

```bash
cd frontend && pnpm tsc -b --pretty false 2>&1 | tail -5
cd .. && git add api/feature/companion/companion.yml api/openapi.yml frontend/src/data/_client/api.gen.ts backend/src
git commit -m "feat(companion): a rejected fact proposal is vetoed for good; decision is an enum (mezo-d6ivw.12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `FactCandidateResponse.derivedFromMessageId` + per-message candidate query

**Files:**
- Modify: `api/feature/companion/companion.yml:1274-1287`, regenerate
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/LearnedFactRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/mapper/CompanionMapper.java:178-192`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/FactCandidateServiceIT.java`

**Interfaces:**
- Produces: `List<LearnedFactEntity> LearnedFactRepository.findByCreatedByAndDerivedFromMessageIdInAndDeletedFalseOrderByCreatedAtAsc(UUID createdBy, Collection<UUID> messageIds)`; wire field `FactCandidateResponse.derivedFromMessageId: uuid | null`.

- [ ] **Step 1: Contract**

Add to `FactCandidateResponse.properties`:

```yaml
        derivedFromMessageId:
          type: string
          format: uuid
          nullable: true
          description: >-
            S8 (mezo-d6ivw.12) — the chat USER message the candidate was extracted from; null for a
            weekly-review candidate. The chat anchors its Megjegyezném chip on it.
```

Regenerate exactly as Task 1 Step 2.

- [ ] **Step 2: Failing test**

```java
    @Test
    void testListPending_shouldCarryTheSourceMessageId_andQueryByMessage() {
        UUID userId = databasePopulator.populateUser("s8-derived@test.local");
        UUID messageA = UUID.randomUUID();
        UUID messageB = UUID.randomUUID();
        learnedFactPopulator.candidate(userId, "A-ból", "life", messageA);
        learnedFactPopulator.candidate(userId, "B-ből", "life", messageB);
        learnedFactPopulator.candidate(userId, "heti", "life", null);

        assertThat(factCandidateService.listPending(userId))
                .filteredOn(c -> "A-ból".equals(c.getCandidateText()))
                .extracting(FactCandidateResponse::getDerivedFromMessageId).containsExactly(messageA);
        assertThat(learnedFactRepository.findByCreatedByAndDerivedFromMessageIdInAndDeletedFalseOrderByCreatedAtAsc(
                userId, List.of(messageB)))
                .extracting(LearnedFactEntity::getCandidateText).containsExactly("B-ből");
    }
```
(`@Autowired private LearnedFactRepository learnedFactRepository;`)

- [ ] **Step 3: Run — expect compile failure** (`getDerivedFromMessageId` / repo method missing).

```bash
cd backend && ./mvnw test -Dtest='FactCandidateServiceIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -20
```

- [ ] **Step 4: Implement**

`LearnedFactRepository`:

```java
    /** S8 (mezo-d6ivw.12): the candidates one or more chat turns produced — turn-memory + forget. */
    List<LearnedFactEntity> findByCreatedByAndDerivedFromMessageIdInAndDeletedFalseOrderByCreatedAtAsc(
            UUID createdBy, java.util.Collection<UUID> messageIds);
```

`CompanionMapper.toFactCandidateResponse` — add `.derivedFromMessageId(entity.getDerivedFromMessageId())` before `.createdAt(...)`.

- [ ] **Step 5: Run — expect PASS**, then commit

```bash
cd backend && set -o pipefail && ./mvnw test -Dtest='FactCandidateServiceIT,CompanionFactCandidateApiIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -8
cd .. && git add api frontend/src/data/_client/api.gen.ts backend/src
git commit -m "feat(companion): fact candidates carry their source chat message (mezo-d6ivw.12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Turn-memory read + `MessageResponse.turnUserMessageId`

**Files:**
- Modify: `api/feature/companion/companion.yml` (new path + 3 schemas + MessageResponse field), regenerate
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/TurnMemoryService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/repository/PersonFactRepository.java`, `people/service/PersonFactService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/AiMessageRepository.java`
- Modify: `CompanionMapper.java`, `CompanionController.java`, `ChatService.java:275,396`
- Test: create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/TurnMemoryServiceIT.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionTurnMemoryApiIT.java`; extend `ChatServiceIT`

**Interfaces:**
- Consumes: Task 2 repository method; `PersonFactService.capture` (existing).
- Produces:
  - `TurnMemoryResponse TurnMemoryService.turnMemory(UUID userId, UUID conversationId, UUID messageId)` (404 `RESOURCE_NOT_FOUND` for a foreign/unknown conversation or a non-user message)
  - `List<LearnedFactEntity> TurnMemoryService.liveCandidates(UUID userId, Collection<UUID> messageIds)` (package-visible, reused in Task 5)
  - `List<PersonFactEntity> PersonFactService.bySourceRefs(UUID userId, String sourceRefKind, Collection<String> sourceRefIds)`
  - `Map<UUID, String> PersonFactService.personNames(UUID userId, Collection<UUID> personIds)`
  - `Optional<AiMessageEntity> AiMessageRepository.findByIdAndConversationIdAndCreatedByAndDeletedFalse(UUID id, UUID conversationId, UUID createdBy)`
  - `MessageResponse CompanionMapper.toMessageResponse(AiMessageEntity, UUID turnUserMessageId)`; `TurnPersonFactResponse CompanionMapper.toTurnPersonFactResponse(PersonFactEntity, String personName)`
  - Generated: `CompanionApi.getTurnMemory(UUID conversationId, UUID messageId)`; DTOs `TurnMemoryResponse`, `TurnPersonFactResponse` (+`KindEnum`), `MemoryItemResponse` (+`KindEnum`), `MessageResponse.turnUserMessageId`.

- [ ] **Step 1: Contract**

Add the path after `/api/companion/conversation/{conversationId}/message:` (keep the existing indentation):

```yaml
  /api/companion/conversation/{conversationId}/turn-memory:
    get:
      tags: [Companion]
      operationId: getTurnMemory
      summary: >-
        S8 (mezo-d6ivw.12) — what one chat turn did to memory. learned = the person facts it
        saved (active only), proposed = the owner-fact candidates it raised (undecided, or
        accepted with a still-live fact), forgotten = what a forget request on this turn forgot.
        The chat chips poll this after a turn (2s/3s/5s ladder).
      parameters:
        - name: conversationId
          in: path
          required: true
          schema: { type: string, format: uuid }
        - name: messageId
          in: query
          required: true
          description: The USER message id of the turn.
          schema: { type: string, format: uuid }
      responses:
        '200':
          description: The turn memory (every list may be empty)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/TurnMemoryResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: Conversation or user message not found (or owned by someone else)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

Add schemas (next to `FactCandidateResponse`):

```yaml
    TurnMemoryResponse:
      type: object
      required: [learned, proposed, forgotten]
      properties:
        learned:
          type: array
          items: { $ref: '#/components/schemas/TurnPersonFactResponse' }
        proposed:
          type: array
          items: { $ref: '#/components/schemas/FactCandidateResponse' }
        forgotten:
          type: array
          items: { $ref: '#/components/schemas/MemoryItemResponse' }
    TurnPersonFactResponse:
      type: object
      required: [id, personId, personName, kind, text, createdAt]
      properties:
        id: { type: string, format: uuid }
        personId: { type: string, format: uuid }
        personName: { type: string }
        kind: { type: string, enum: [preference, relationship_state, shared_activity, important_date, sensitivity] }
        text: { type: string }
        createdAt: { type: string, format: date-time }
    MemoryItemResponse:
      type: object
      description: >-
        S8 — one memory item a chat turn produced, as the forget flow lists it. kind person_fact
        refId = the person fact, fact_candidate = the undecided candidate, knowledge_fact = the
        promoted fact of an accepted candidate.
      required: [kind, refId, text, createdAt, pending]
      properties:
        kind: { type: string, enum: [person_fact, fact_candidate, knowledge_fact] }
        refId: { type: string, format: uuid }
        personId: { type: string, format: uuid, nullable: true }
        who: { type: string, nullable: true, description: 'The person name for a person fact; null for the owner.' }
        text: { type: string }
        createdAt: { type: string, format: date-time }
        pending: { type: boolean, description: 'True for an undecided proposal.' }
```

Add to `MessageResponse.properties` (NOT to `required`):

```yaml
        turnUserMessageId:
          type: string
          format: uuid
          nullable: true
          description: >-
            S8 (mezo-d6ivw.12) — only on the answer a send returns (sync response and the stream
            done event): the id of the USER row of the same turn, so the client anchors the
            turn-memory chips without a refetch. Absent on listed history rows.
```

Regenerate (Task 1 Step 2).

- [ ] **Step 2: Failing service IT**

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/TurnMemoryServiceIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.TurnMemoryResponse;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** S8 (mezo-d6ivw.12): one turn's memory — person facts, live proposals, owner-scoped. */
@Transactional
class TurnMemoryServiceIT extends AbstractIntegrationTest {

    @Autowired private TurnMemoryService turnMemoryService;
    @Autowired private PersonFactService personFactService;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private AiMessagePopulator messages;
    @Autowired private LearnedFactPopulator candidates;
    @Autowired private PersonPopulator persons;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testTurnMemory_shouldComposeLearnedAndLiveProposals_forOneUserMessage() {
        UUID userId = databasePopulator.populateUser("s8-turnmem@test.local");
        AiConversationEntity conversation = conversations.conversation(userId);
        AiMessageEntity turn = messages.message(conversation, AiMessageEntity.ROLE_USER, "Dórival nyertünk");
        AiMessageEntity other = messages.message(conversation, AiMessageEntity.ROLE_USER, "másik kör");
        PersonEntity dori = persons.createPerson(userId, "Dóri");
        personFactService.capture(userId, PersonFactEntity.SOURCE_CHAT_TURN, turn.getId().toString(),
                List.of(new PersonFactService.PersonFactCapture(dori.getId(),
                        PersonFactEntity.KIND_RELATIONSHIP_STATE, "tavasz óta a strandröpi-párod", "high")));
        candidates.candidate(userId, "Nagy közös élmény után nehéz az egyedüllét.", "life", turn.getId());
        LearnedFactEntity rejected = candidates.candidate(userId, "elutasított", "life", turn.getId());
        rejected.setUserDecision(LearnedFactEntity.DECISION_REJECT);
        candidates.candidate(userId, "másik kör javaslata", "life", other.getId());

        TurnMemoryResponse memory = turnMemoryService.turnMemory(userId, conversation.getId(), turn.getId());

        assertThat(memory.getLearned()).singleElement().satisfies(f -> {
            assertThat(f.getPersonName()).isEqualTo("Dóri");
            assertThat(f.getText()).isEqualTo("tavasz óta a strandröpi-párod");
        });
        assertThat(memory.getProposed()).extracting(c -> c.getCandidateText())
                .containsExactly("Nagy közös élmény után nehéz az egyedüllét.");
        assertThat(memory.getForgotten()).isEmpty();
    }

    @Test
    void testTurnMemory_shouldReturn404_forAForeignConversationOrAnAssistantRow() {
        UUID owner = databasePopulator.populateUser("s8-turnmem-owner@test.local");
        UUID stranger = databasePopulator.populateUser("s8-turnmem-stranger@test.local");
        AiConversationEntity conversation = conversations.conversation(owner);
        AiMessageEntity turn = messages.message(conversation, AiMessageEntity.ROLE_USER, "szia");
        AiMessageEntity answer = messages.message(conversation, AiMessageEntity.ROLE_ASSISTANT, "szia!");

        assertThatThrownBy(() -> turnMemoryService.turnMemory(stranger, conversation.getId(), turn.getId()))
                .isInstanceOf(SystemRuntimeErrorException.class);
        assertThatThrownBy(() -> turnMemoryService.turnMemory(owner, conversation.getId(), answer.getId()))
                .isInstanceOf(SystemRuntimeErrorException.class);
    }
}
```

Add to `ChatServiceIT`:

```java
    @Test
    void testSendMessage_shouldReturnTheTurnUserMessageId_onTheAnswer() {
        UUID userId = databasePopulator.populateUser("s8-turn-anchor@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("Szia"));

        AiMessageEntity userRow = messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(conversation.getId(), userId)
                .getFirst();
        assertThat(userRow.getRole()).isEqualTo(AiMessageEntity.ROLE_USER);
        assertThat(answer.getTurnUserMessageId()).isEqualTo(userRow.getId());
    }
```

`CompanionTurnMemoryApiIT` (HTTP: 401 without token, 404 unknown conversation):

```java
package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class CompanionTurnMemoryApiIT extends ApiIntegrationTest {

    private static String url(UUID conversationId, UUID messageId) {
        return "/api/companion/conversation/" + conversationId + "/turn-memory?messageId=" + messageId;
    }

    @Test
    void getTurnMemory_shouldReturn401_withoutToken() {
        getForBody(url(UUID.randomUUID(), UUID.randomUUID()), null, HttpStatus.UNAUTHORIZED, String.class);
    }

    @Test
    void getTurnMemory_shouldReturn404_forUnknownConversation() {
        getForBody(url(UUID.randomUUID(), UUID.randomUUID()), ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }
}
```

- [ ] **Step 3: Run — expect compile failure** (service/DTO getters missing).

```bash
cd backend && ./mvnw test -Dtest='TurnMemoryServiceIT,CompanionTurnMemoryApiIT,ChatServiceIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -20
```

- [ ] **Step 4: Implement the people port**

`PersonFactRepository`:

```java
    /** S8 (mezo-d6ivw.12): the active facts several chat turns produced (turn-memory / forget). */
    List<PersonFactEntity> findByCreatedByAndSourceRefKindAndSourceRefIdInAndActiveTrueAndDeletedFalseOrderByCreatedAtAsc(
            UUID createdBy, String sourceRefKind, java.util.Collection<String> sourceRefIds);
```

`PersonFactService` (imports `java.util.Map`, `java.util.stream.Collectors`):

```java
    /** S8 (mezo-d6ivw.12): {@link #bySourceRef} for several sources at once — the turn-memory read. */
    @Transactional(readOnly = true)
    public List<PersonFactEntity> bySourceRefs(UUID userId, String sourceRefKind, Collection<String> sourceRefIds) {
        if (sourceRefIds.isEmpty()) {
            return List.of();
        }
        return personFactRepository
            .findByCreatedByAndSourceRefKindAndSourceRefIdInAndActiveTrueAndDeletedFalseOrderByCreatedAtAsc(
                userId, sourceRefKind, sourceRefIds);
    }

    /** S8: display names for fact chips — any non-deleted person, whatever its status. */
    @Transactional(readOnly = true)
    public Map<UUID, String> personNames(UUID userId, Collection<UUID> personIds) {
        if (personIds.isEmpty()) {
            return Map.of();
        }
        Set<UUID> wanted = Set.copyOf(personIds);
        return personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(userId).stream()
            .filter(p -> wanted.contains(p.getId()))
            .collect(Collectors.toMap(PersonEntity::getId, PersonEntity::getName));
    }
```

- [ ] **Step 5: Implement repository, mapper, service, controller, ChatService anchor**

`AiMessageRepository`:

```java
    /** S8 (mezo-d6ivw.12): one owned, live message of one conversation (turn-memory / forget-learned). */
    Optional<AiMessageEntity> findByIdAndConversationIdAndCreatedByAndDeletedFalse(
            UUID id, UUID conversationId, UUID createdBy);
```

`CompanionMapper` — replace `toMessageResponse(AiMessageEntity)` with the pair, and add the person-fact mapper (imports `io.mrkuhne.mezo.api.dto.TurnPersonFactResponse`, `io.mrkuhne.mezo.feature.people.entity.PersonFactEntity`, `java.util.UUID`):

```java
    default MessageResponse toMessageResponse(AiMessageEntity entity) {
        return toMessageResponse(entity, null);
    }

    /** S8: {@code turnUserMessageId} is set only on the answer a send returns (the chip anchor). */
    default MessageResponse toMessageResponse(AiMessageEntity entity, UUID turnUserMessageId) {
        return MessageResponse.builder()
                .id(entity.getId())
                .role(entity.getRole())
                .content(entity.getContent())
                .createdAt(toOffset(entity.getCreatedAt()))
                .tools(toTools(entity.getToolCalls(), entity.getToolOutcomes()))
                .refs(toRefs(entity.getRefs()))
                .recalled(toRecalled(entity.getRecalledMemories()))
                .degraded(entity.isDegraded())
                .turnUserMessageId(turnUserMessageId)
                .build();
    }

    default TurnPersonFactResponse toTurnPersonFactResponse(PersonFactEntity fact, String personName) {
        return TurnPersonFactResponse.builder()
                .id(fact.getId())
                .personId(fact.getPersonId())
                .personName(personName)
                .kind(TurnPersonFactResponse.KindEnum.fromValue(fact.getKind()))
                .text(fact.getFactText())
                .createdAt(toOffset(fact.getCreatedAt()))
                .build();
    }
```

`TurnMemoryService.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.TurnMemoryResponse;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.mapper.CompanionMapper;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * S8 (mezo-d6ivw.12): the turn is the unit of visible memory. Composes what one chat turn did —
 * person facts through the people-owned {@link PersonFactService} port (ArchUnit companion →
 * people), owner-fact candidates by {@code derived_from_message_id}, and (Task 5) the forget
 * envelope on the message itself. Read-only; PEOPLE_SWITCH off ⇒ no person facts, never an error.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class TurnMemoryService {

    private final ConversationService conversationService;
    private final AiMessageRepository messageRepository;
    private final LearnedFactRepository learnedFactRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final CompanionMapper mapper;
    private final ObjectProvider<PersonFactService> personFactService;

    @Transactional(readOnly = true)
    public TurnMemoryResponse turnMemory(UUID userId, UUID conversationId, UUID messageId) {
        conversationService.getOwned(userId, conversationId);
        AiMessageEntity message = ownedUserMessage(userId, conversationId, messageId);
        PersonFactService facts = personFactService.getIfAvailable();
        List<PersonFactEntity> personFacts = facts == null ? List.of()
                : facts.bySourceRefs(userId, PersonFactEntity.SOURCE_CHAT_TURN, List.of(message.getId().toString()));
        Map<UUID, String> names = facts == null ? Map.of()
                : facts.personNames(userId, personFacts.stream().map(PersonFactEntity::getPersonId).toList());
        return TurnMemoryResponse.builder()
                .learned(personFacts.stream()
                        .map(f -> mapper.toTurnPersonFactResponse(f, names.getOrDefault(f.getPersonId(), "")))
                        .toList())
                .proposed(liveCandidates(userId, List.of(message.getId())).stream()
                        .map(mapper::toFactCandidateResponse).toList())
                .forgotten(List.of())
                .build();
    }

    /** Undecided candidates, plus accepted/refined ones whose promoted fact is still live. A
     *  rejected candidate (promotedFactId null) never shows again. */
    List<LearnedFactEntity> liveCandidates(UUID userId, Collection<UUID> messageIds) {
        if (messageIds.isEmpty()) {
            return List.of();
        }
        return learnedFactRepository
                .findByCreatedByAndDerivedFromMessageIdInAndDeletedFalseOrderByCreatedAtAsc(userId, messageIds)
                .stream()
                .filter(c -> c.getUserDecision() == null
                        || (c.getPromotedFactId() != null && knowledgeFactRepository
                                .findByIdAndCreatedByAndDeletedFalse(c.getPromotedFactId(), userId).isPresent()))
                .toList();
    }

    AiMessageEntity ownedUserMessage(UUID userId, UUID conversationId, UUID messageId) {
        return messageRepository.findByIdAndConversationIdAndCreatedByAndDeletedFalse(messageId, conversationId, userId)
                .filter(m -> AiMessageEntity.ROLE_USER.equals(m.getRole()))
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
```

`CompanionController` — inject `private final TurnMemoryService turnMemoryService;` and:

```java
    @Override
    public TurnMemoryResponse getTurnMemory(UUID conversationId, UUID messageId) {
        return turnMemoryService.turnMemory(currentUserId.get(), conversationId, messageId);
    }
```

`ChatService`: in `completeTurn` return `mapper.toMessageResponse(assistant, userMessageId)`; in `sendMessage` return `mapper.toMessageResponse(assistant, userRow.getId())`.

- [ ] **Step 6: Run — expect PASS**

```bash
cd backend && set -o pipefail && ./mvnw test -Dtest='TurnMemoryServiceIT,CompanionTurnMemoryApiIT,ChatServiceIT,PersonFactServiceIT,ChatStreamServiceIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -10
```
Expected: `BUILD SUCCESS`. (If `ChatStreamServiceIT` does not exist under that name, run `-Dtest='ChatStream*'`.)

- [ ] **Step 7: Commit**

```bash
git add api frontend/src/data/_client/api.gen.ts backend/src
git commit -m "feat(companion): turn-memory read and the answer's turn anchor (mezo-d6ivw.12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `ForgetIntent` — the deterministic "ezt ne jegyezd meg" matcher

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ForgetIntent.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/ForgetIntentTest.java`

**Interfaces:**
- Produces: `public static boolean ForgetIntent.matches(String text)`.

- [ ] **Step 1: Failing unit table**

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** S8 (mezo-d6ivw.12): the narrow Hungarian forget phrase set — positives AND the traps. */
class ForgetIntentTest {

    @ParameterizedTest
    @ValueSource(strings = {
            "Ezt ne jegyezd meg.",
            "Az Annásat inkább ne jegyezd meg.",
            "NE JEGYEZD MEG",
            "kérlek ne jegyezd meg ezt",
            "felejtsd el ezt",
            "Felejtsd el, amit mondtam.",
            "felejtsd el amit írtam Annáról",
            "Felejtsd el az előzőt!",
            "Kérlek, felejtsd el!",
            "felejtsd el",
            "ezt ne mentsd",
            "Ezt inkább ne tárold.",
            "ne tárold el",
            "felejtsd el mindent erről"
    })
    void testMatches_shouldBeTrue_forAForgetRequest(String text) {
        assertThat(ForgetIntent.matches(text)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "Felejtsd el a tervet, csináljunk újat.",
            "Felejtsd el ezt a tervet",
            "Ne felejtsd el, hogy holnap edzés.",
            "Ne felejtsd el, amit mondtam.",
            "Jegyezd meg, hogy szeretem a kávét.",
            "Elfelejtettem bevenni a vitamint.",
            "Mentsd el ezt a receptet.",
            "Nem baj, ha nem jegyzed meg.",
            "",
            "   "
    })
    void testMatches_shouldBeFalse_forEverythingElse(String text) {
        assertThat(ForgetIntent.matches(text)).isFalse();
    }

    @org.junit.jupiter.api.Test
    void testMatches_shouldBeFalse_forNull() {
        assertThat(ForgetIntent.matches(null)).isFalse();
    }
}
```

- [ ] **Step 2: Run — expect compile failure**

```bash
cd backend && ./mvnw test -Dtest='ForgetIntentTest' 2>&1 | tail -10
```

- [ ] **Step 3: Implement**

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.techcore.text.TextFold;
import java.util.regex.Pattern;

/**
 * S8 (mezo-d6ivw.12): "ezt ne jegyezd meg" — a deterministic, deliberately NARROW pre-screen (code
 * decides, the LLM never does). Matched on the {@link TextFold} form (lowercase, accents stripped),
 * so "Ne jegyezd meg" and "ne jegyezd meg" are one phrase. Precision over recall: a missed forget
 * request costs one more sentence from the user; a false positive silently deletes memory.
 *
 * <p>The traps pinned in {@code ForgetIntentTest}: "felejtsd el a tervet" (a plan, not memory),
 * "ne felejtsd el…" (the opposite request), "elfelejtettem" (the user forgot), "jegyezd meg"
 * without the negation.
 */
public final class ForgetIntent {

    /** (1) "ne jegyezd meg" anywhere. */
    private static final Pattern DONT_REMEMBER = Pattern.compile("\\bne\\s+jegyezd\\s+meg\\b");

    /** (2) "felejtsd el" + an explicit memory object — never after "ne". The short pronouns only
     *  count at a clause end ("felejtsd el ezt." yes, "felejtsd el ezt a tervet" no). */
    private static final Pattern FORGET_THAT = Pattern.compile(
            "(?<!\\bne\\s)\\bfelejtsd\\s+el\\s*,?\\s*(?:"
                    + "(?:ezt|azt|ezeket)(?=\\s*(?:[.!?,;]|$))"
                    + "|amit\\s+(?:mondtam|irtam)"
                    + "|az\\s+(?:elozot|elobbit|elobbieket)"
                    + "|mindent)");

    /** (3) the whole message is just the request. */
    private static final Pattern FORGET_ALONE = Pattern.compile(
            "^(?:kerlek\\s*,?\\s*)?felejtsd\\s+el(?:\\s*,?\\s*kerlek)?\\s*[.!]*$");

    /** (4) "ezt ne mentsd / ne tárold", or "ne tárold" anywhere. */
    private static final Pattern DONT_STORE = Pattern.compile(
            "\\b(?:ezt|azt|ezeket)\\s+(?:inkabb\\s+)?ne\\s+(?:mentsd|tarold)\\b|\\bne\\s+tarold\\b");

    private ForgetIntent() {
    }

    public static boolean matches(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        String folded = TextFold.fold(text).strip().replaceAll("\\s+", " ");
        return DONT_REMEMBER.matcher(folded).find()
                || FORGET_THAT.matcher(folded).find()
                || FORGET_ALONE.matcher(folded).matches()
                || DONT_STORE.matcher(folded).find();
    }
}
```

Note the lookbehind `(?<!\bne\s)` needs a fixed width — `\bne\s` is fixed (2 letters + 1 space after whitespace collapse). "Ne felejtsd el, amit mondtam." folds to `ne felejtsd el, amit mondtam.` → lookbehind blocks it.

- [ ] **Step 4: Run — expect PASS** (`Tests run: 25, Failures: 0`)

```bash
cd backend && ./mvnw test -Dtest='ForgetIntentTest' 2>&1 | grep -E "Tests run|BUILD"
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ForgetIntent.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/ForgetIntentTest.java
git commit -m "feat(companion): deterministic forget-intent matcher for ezt ne jegyezd meg (mezo-d6ivw.12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: Forget storage, `ChatForgetService`, and the no-extract race marker

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.1.0/script/202609272300_mezo-d6ivw.12_ai_message_forget.sql`; modify `1.1.0/1.1.0_master.yml`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/ChatMemoryItem.java`, `ForgottenMemoriesEnvelope.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MessageExtractionGate.java`, `ChatForgetService.java`
- Modify: `AiMessageEntity.java`, `AiMessageRepository.java`, `TurnMemoryService.java`, `CompanionMapper.java`, `ChatTurnCompleted.java`, `ChatService.java:273,394`, `FactExtractionService.java`, `FactExtractionListener.java`, `PersonFactExtractionService.java`, `PersonFactExtractionListener.java`
- Test: create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/ChatForgetServiceIT.java`; modify `service/PostTurnActorIT.java:51` (event arity)

**Interfaces:**
- Consumes: `TurnMemoryService.liveCandidates`, `.ownedUserMessage` (Task 3); `ForgetService.forgetFact` (existing); `FactCandidateService.decide` (Task 1); `PersonFactService.undo` / `.bySourceRefs` / `.personNames`.
- Produces:
  - `record ChatMemoryItem(String kind, UUID refId, UUID personId, String who, String text, Instant createdAt, boolean pending, UUID sourceMessageId)` with `KIND_PERSON_FACT`, `KIND_FACT_CANDIDATE`, `KIND_KNOWLEDGE_FACT`
  - `record ForgottenMemoriesEnvelope(List<ChatMemoryItem> items)` + `static ForgottenMemoriesEnvelope ofOrNull(List<ChatMemoryItem>)` + `ForgottenMemoriesEnvelope append(List<ChatMemoryItem>)`
  - `AiMessageEntity.forgottenMemories` (jsonb), `AiMessageEntity.extractionBlocked` (boolean)
  - `List<ChatMemoryItem> TurnMemoryService.liveItemsOf(UUID userId, Collection<UUID> messageIds)` (newest first), `List<ChatMemoryItem> TurnMemoryService.liveItems(UUID userId, UUID conversationId)`, `List<UUID> TurnMemoryService.userMessageIds(UUID userId, UUID conversationId)`
  - `List<ChatMemoryItem> ChatForgetService.forgetLatest(UUID userId, UUID conversationId)` (empty = nothing to forget)
  - `List<ChatMemoryItem> ChatForgetService.preview(UUID userId, UUID conversationId)`
  - `List<ChatMemoryItem> ChatForgetService.forgetAll(UUID userId, UUID conversationId, UUID triggerMessageId)`
  - `boolean MessageExtractionGate.isBlocked(UUID userMessageId)` (propagation MANDATORY)
  - `record ChatTurnCompleted(UUID userId, UUID userMessageId, String userContent, UUID assistantMessageId, String assistantContent, boolean extractionBlocked)`
  - `MemoryItemResponse CompanionMapper.toMemoryItemResponse(ChatMemoryItem)`

- [ ] **Step 1: Liquibase**

`202609272300_mezo-d6ivw.12_ai_message_forget.sql`:

```sql
-- S8 (bd mezo-d6ivw.12): "ezt ne jegyezd meg". forgotten_memories = what a forget request on
-- THIS user message forgot (typed jsonb envelope, the recalled_memories precedent; null when the
-- message forgot nothing). extraction_blocked = the per-message no-extract marker: the post-turn
-- fact and person-fact extractors re-read it FOR SHARE right before saving, so a forget that
-- commits first always wins over an in-flight extraction of the same turn. Additive.
alter table ai_message add column forgotten_memories jsonb;
alter table ai_message add column extraction_blocked boolean not null default false;
```

Append to `1.1.0/1.1.0_master.yml`:

```yaml
  - changeSet:
      id: "1.1.0:202609272300_mezo-d6ivw.12_ai_message_forget"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609272300_mezo-d6ivw.12_ai_message_forget.sql
```

- [ ] **Step 2: Entities**

`ChatMemoryItem.java`:

```java
package io.mrkuhne.mezo.feature.companion.entity;

import java.time.Instant;
import java.util.UUID;

/**
 * S8 (mezo-d6ivw.12): one memory item a chat turn produced — the shared shape of the turn-memory
 * forget list, the forget-all preview and the {@code [Ebben a beszélgetésben]} prompt block.
 * Persisted inside {@link ForgottenMemoriesEnvelope}; {@code who}/{@code text} are snapshots.
 *
 * @param kind            {@link #KIND_PERSON_FACT} | {@link #KIND_FACT_CANDIDATE} | {@link #KIND_KNOWLEDGE_FACT}
 * @param refId           the person fact / the undecided candidate / the promoted knowledge fact
 * @param personId        the person of a person fact, else null
 * @param who             the person's name for a person fact, else null (= about the owner)
 * @param pending         true for an undecided proposal
 * @param sourceMessageId the chat USER message that produced it
 */
public record ChatMemoryItem(String kind, UUID refId, UUID personId, String who, String text,
                             Instant createdAt, boolean pending, UUID sourceMessageId) {

    public static final String KIND_PERSON_FACT = "person_fact";
    public static final String KIND_FACT_CANDIDATE = "fact_candidate";
    public static final String KIND_KNOWLEDGE_FACT = "knowledge_fact";
}
```

`ForgottenMemoriesEnvelope.java`:

```java
package io.mrkuhne.mezo.feature.companion.entity;

import java.util.ArrayList;
import java.util.List;

/** S8 (mezo-d6ivw.12): typed jsonb envelope for ai_message.forgotten_memories — the
 *  {@link RecalledMemoriesEnvelope} precedent: null when nothing was forgotten. */
public record ForgottenMemoriesEnvelope(List<ChatMemoryItem> items) {

    public static ForgottenMemoriesEnvelope ofOrNull(List<ChatMemoryItem> items) {
        return items == null || items.isEmpty() ? null : new ForgottenMemoriesEnvelope(List.copyOf(items));
    }

    /** The widen-to-conversation step appends to the triggering message's envelope. */
    public static ForgottenMemoriesEnvelope append(ForgottenMemoriesEnvelope base, List<ChatMemoryItem> more) {
        List<ChatMemoryItem> all = new ArrayList<>(base == null ? List.of() : base.items());
        more.stream().filter(i -> !all.contains(i)).forEach(all::add);
        return ofOrNull(all);
    }
}
```

`AiMessageEntity` — add after `recalledMemories`:

```java
    /** S8: what a forget request on THIS user message forgot — null when nothing. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "forgotten_memories", columnDefinition = "jsonb")
    private ForgottenMemoriesEnvelope forgottenMemories;

    /** S8: the per-message no-extract marker (forget request, forget target, widened forget). */
    @Column(name = "extraction_blocked", nullable = false)
    private boolean extractionBlocked;
```

- [ ] **Step 3: The race-marker read**

`AiMessageRepository`:

```java
    /** S8: FOR SHARE waits for an uncommitted forget's row lock — see MessageExtractionGate. */
    @Query(value = "select extraction_blocked from ai_message where id = :id for share", nativeQuery = true)
    Optional<Boolean> lockExtractionBlocked(@Param("id") UUID id);
```
(imports `org.springframework.data.jpa.repository.Query`, `org.springframework.data.repository.query.Param` if absent.)

`MessageExtractionGate.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * S8 (mezo-d6ivw.12): closes the "forget lands, then the in-flight extraction of the same turn
 * saves anyway" race. Called by BOTH post-turn extractors inside their saving transaction, right
 * before the save. The forget marks the message with an UPDATE (row lock held to its commit);
 * {@code FOR SHARE} here waits for that commit and then reads {@code true}. If the extraction
 * locked first, the forget's UPDATE waits for the extraction to commit, and the forget's reads —
 * which run after its UPDATE — see the freshly saved facts and forget them too.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MessageExtractionGate {

    private final AiMessageRepository messageRepository;

    @Transactional(propagation = Propagation.MANDATORY)
    public boolean isBlocked(UUID userMessageId) {
        return userMessageId != null && messageRepository.lockExtractionBlocked(userMessageId).orElse(false);
    }
}
```

- [ ] **Step 4: Live items on the read side + mapper**

`TurnMemoryService` — add (imports `ChatMemoryItem`, `java.util.ArrayList`, `java.util.Comparator`):

```java
    /** The conversation's USER message ids, oldest first. */
    @Transactional(readOnly = true)
    public List<UUID> userMessageIds(UUID userId, UUID conversationId) {
        return messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(conversationId, userId).stream()
                .filter(m -> AiMessageEntity.ROLE_USER.equals(m.getRole()))
                .map(AiMessageEntity::getId)
                .toList();
    }

    /** Every still-live memory item of the conversation — forget-all preview + [Ebben a beszélgetésben]. */
    @Transactional(readOnly = true)
    public List<ChatMemoryItem> liveItems(UUID userId, UUID conversationId) {
        return liveItemsOf(userId, userMessageIds(userId, conversationId));
    }

    /** Live items of the given user messages, newest first: active chat person facts, undecided
     *  candidates (pending), accepted/refined candidates as their live knowledge fact. */
    @Transactional(readOnly = true)
    public List<ChatMemoryItem> liveItemsOf(UUID userId, Collection<UUID> messageIds) {
        if (messageIds.isEmpty()) {
            return List.of();
        }
        List<ChatMemoryItem> items = new ArrayList<>();
        PersonFactService facts = personFactService.getIfAvailable();
        if (facts != null) {
            List<PersonFactEntity> rows = facts.bySourceRefs(userId, PersonFactEntity.SOURCE_CHAT_TURN,
                    messageIds.stream().map(UUID::toString).toList());
            Map<UUID, String> names = facts.personNames(userId, rows.stream().map(PersonFactEntity::getPersonId).toList());
            rows.forEach(f -> items.add(new ChatMemoryItem(ChatMemoryItem.KIND_PERSON_FACT, f.getId(), f.getPersonId(),
                    names.get(f.getPersonId()), f.getFactText(), f.getCreatedAt(), false,
                    UUID.fromString(f.getSourceRefId()))));
        }
        for (LearnedFactEntity c : liveCandidates(userId, messageIds)) {
            boolean pending = c.getUserDecision() == null;
            items.add(new ChatMemoryItem(
                    pending ? ChatMemoryItem.KIND_FACT_CANDIDATE : ChatMemoryItem.KIND_KNOWLEDGE_FACT,
                    pending ? c.getId() : c.getPromotedFactId(), null, null,
                    c.getRefinedText() != null ? c.getRefinedText() : c.getCandidateText(),
                    c.getCreatedAt(), pending, c.getDerivedFromMessageId()));
        }
        items.sort(Comparator.comparing(ChatMemoryItem::createdAt).reversed());
        return items;
    }
```

and in `turnMemory(...)` replace `.forgotten(List.of())` with:

```java
                .forgotten(message.getForgottenMemories() == null ? List.of()
                        : message.getForgottenMemories().items().stream().map(mapper::toMemoryItemResponse).toList())
```

`CompanionMapper` (imports `MemoryItemResponse`, `ChatMemoryItem`):

```java
    default MemoryItemResponse toMemoryItemResponse(ChatMemoryItem item) {
        return MemoryItemResponse.builder()
                .kind(MemoryItemResponse.KindEnum.fromValue(item.kind()))
                .refId(item.refId())
                .personId(item.personId())
                .who(item.who())
                .text(item.text())
                .createdAt(toOffset(item.createdAt()))
                .pending(item.pending())
                .build();
    }
```

- [ ] **Step 5: Failing ChatForgetService IT**

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/ChatForgetServiceIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FactDecisionRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.ChatMemoryItem;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryForgetVetoEntity;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryForgetVetoRepository;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.repository.PersonFactRepository;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/** S8 (mezo-d6ivw.12): forget the latest learning turn, the three forget routes, widen, preview. */
@Transactional
@ActiveProfiles("companion-fake")
class ChatForgetServiceIT extends AbstractIntegrationTest {

    @Autowired private ChatForgetService chatForgetService;
    @Autowired private FactCandidateService factCandidateService;
    @Autowired private PersonFactService personFactService;
    @Autowired private PersonFactRepository personFactRepository;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private MemoryForgetVetoRepository vetoRepository;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private FactExtractionService factExtractionService;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private AiMessagePopulator messages;
    @Autowired private LearnedFactPopulator candidates;
    @Autowired private PersonPopulator persons;
    @Autowired private DatabasePopulator databasePopulator;

    private record Fixture(UUID userId, AiConversationEntity conversation, AiMessageEntity turn1,
                           AiMessageEntity turn2, AiMessageEntity turn3, PersonEntity anna) {}

    /** turn1: Dóri fact + an owner proposal later ACCEPTED; turn2: Anna fact + an undecided
     *  proposal; turn3: nothing learned (the "most recent" row is not the target). */
    private Fixture fixture(String email) {
        UUID userId = databasePopulator.populateUser(email);
        AiConversationEntity conversation = conversations.conversation(userId);
        AiMessageEntity turn1 = messages.message(conversation, AiMessageEntity.ROLE_USER, "Dórival nyertünk");
        AiMessageEntity turn2 = messages.message(conversation, AiMessageEntity.ROLE_USER, "Annával rég beszéltem");
        AiMessageEntity turn3 = messages.message(conversation, AiMessageEntity.ROLE_USER, "és most?");
        PersonEntity dori = persons.createPerson(userId, "Dóri");
        PersonEntity anna = persons.createPerson(userId, "Anna");
        personFactService.capture(userId, PersonFactEntity.SOURCE_CHAT_TURN, turn1.getId().toString(), List.of(
                new PersonFactService.PersonFactCapture(dori.getId(), PersonFactEntity.KIND_RELATIONSHIP_STATE,
                        "a strandröpi-párod", "high")));
        LearnedFactEntity accepted = candidates.candidate(userId, "Egy nagy nap után nehéz egyedül.", "life", turn1.getId());
        factCandidateService.decide(userId, accepted.getId(), FactDecisionRequest.builder()
                .decision(FactDecisionRequest.DecisionEnum.ACCEPT).build());
        personFactService.capture(userId, PersonFactEntity.SOURCE_CHAT_TURN, turn2.getId().toString(), List.of(
                new PersonFactService.PersonFactCapture(anna.getId(), PersonFactEntity.KIND_PREFERENCE,
                        "régi csapattársad", "medium")));
        candidates.candidate(userId, "Szeretnék újra csapatban játszani.", "life", turn2.getId());
        return new Fixture(userId, conversation, turn1, turn2, turn3, anna);
    }

    @Test
    void testForgetLatest_shouldForgetOnlyTheMostRecentLearningTurn_andVetoIt() {
        Fixture f = fixture("s8-forget-latest@test.local");

        List<ChatMemoryItem> forgotten = chatForgetService.forgetLatest(f.userId(), f.conversation().getId());

        assertThat(forgotten).extracting(ChatMemoryItem::text)
                .containsExactlyInAnyOrder("régi csapattársad", "Szeretnék újra csapatban játszani.");
        assertThat(personFactRepository.findByCreatedByAndPersonIdAndDeletedFalseOrderByCreatedAtDesc(
                f.userId(), f.anna().getId())).allMatch(p -> !p.isActive());
        assertThat(vetoRepository.existsByCreatedByAndDomainAndVetoKeyAndDeletedFalse(f.userId(),
                MemoryForgetVetoEntity.DOMAIN_FACT_TEXT,
                MemoryForgetVetoEntity.factTextVetoKey("Szeretnék újra csapatban játszani."))).isTrue();
        // turn1 untouched: its person fact and its accepted fact are still live
        assertThat(chatForgetService.preview(f.userId(), f.conversation().getId())).extracting(ChatMemoryItem::text)
                .containsExactlyInAnyOrder("a strandröpi-párod", "Egy nagy nap után nehéz egyedül.");
        // race marker: the target AND the immediately preceding user row are blocked
        assertThat(messageRepository.findById(f.turn2().getId()).orElseThrow().isExtractionBlocked()).isTrue();
        assertThat(messageRepository.findById(f.turn3().getId()).orElseThrow().isExtractionBlocked()).isTrue();
        assertThat(messageRepository.findById(f.turn1().getId()).orElseThrow().isExtractionBlocked()).isFalse();
    }

    @Test
    void testForgetLatest_shouldReturnEmpty_whenNothingWasLearned() {
        UUID userId = databasePopulator.populateUser("s8-forget-empty@test.local");
        AiConversationEntity conversation = conversations.conversation(userId);
        messages.message(conversation, AiMessageEntity.ROLE_USER, "szia");

        assertThat(chatForgetService.forgetLatest(userId, conversation.getId())).isEmpty();
    }

    @Test
    void testForgetAll_shouldForgetEveryTurn_incl_anAcceptedFact_andAppendToTheTrigger() {
        Fixture f = fixture("s8-forget-all@test.local");
        AiMessageEntity trigger = messages.message(f.conversation(), AiMessageEntity.ROLE_USER, "ezt ne jegyezd meg");
        UUID acceptedFactId = chatForgetService.preview(f.userId(), f.conversation().getId()).stream()
                .filter(i -> ChatMemoryItem.KIND_KNOWLEDGE_FACT.equals(i.kind())).findFirst().orElseThrow().refId();

        List<ChatMemoryItem> forgotten = chatForgetService.forgetAll(f.userId(), f.conversation().getId(), trigger.getId());

        assertThat(forgotten).hasSize(4);
        assertThat(chatForgetService.preview(f.userId(), f.conversation().getId())).isEmpty();
        assertThat(knowledgeFactRepository.findByIdAndCreatedByAndDeletedFalse(acceptedFactId, f.userId())).isEmpty();
        assertThat(messageRepository.findById(trigger.getId()).orElseThrow().getForgottenMemories().items()).hasSize(4);
    }

    @Test
    void testExtraction_shouldDropItsCandidates_whenTheTurnWasForgottenMeanwhile() {
        Fixture f = fixture("s8-forget-race@test.local");
        chatForgetService.forgetLatest(f.userId(), f.conversation().getId());

        int persisted = factExtractionService.extractFromTurn(f.userId(), f.turn3().getId(),
                "[fake-facts:[{\"fact\":\"késve érkező tény\",\"category\":\"life\",\"owner\":\"mezo\"}]]", "ok");

        assertThat(persisted).isZero();
    }
}
```

- [ ] **Step 6: Run — expect compile failure** (service missing)

```bash
cd backend && ./mvnw test -Dtest='ChatForgetServiceIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -15
```

- [ ] **Step 7: Implement `ChatForgetService`**

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.FactDecisionRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.ChatMemoryItem;
import io.mrkuhne.mezo.feature.companion.entity.ForgottenMemoriesEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * S8 (mezo-d6ivw.12, folds S6b mezo-d6ivw.9): "ezt ne jegyezd meg" in the chat. The chat and the
 * Tudástár speak the same verbs through the same writers: a person fact → {@link
 * PersonFactService#undo} (the inactive row is its own veto); an undecided owner proposal → a
 * reject, which since S8 vetoes its text ({@link FactCandidateService#decide}); a proposal the
 * user already accepted in this conversation → {@link ForgetService#forgetFact}. Permanent — there
 * is no restore. The extraction race is closed by {@code extraction_blocked} (see {@link
 * MessageExtractionGate}): every row this service targets is marked BEFORE its items are read.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class ChatForgetService {

    /** How far back "the latest learning turn" is looked for. */
    static final int LATEST_SCAN_LIMIT = 20;

    private final ConversationService conversationService;
    private final AiMessageRepository messageRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final TurnMemoryService turnMemoryService;
    private final FactCandidateService factCandidateService;
    private final ForgetService forgetService;
    private final ObjectProvider<PersonFactService> personFactService;

    /** Forgets what the most recent EARLIER user message with live memory learned. Called by the
     *  chat turn BEFORE its own user row is persisted, so every row read here is earlier. The
     *  immediately preceding user row is always marked no-extract (its extraction may still be in
     *  flight). Empty list = nothing to forget. */
    @Transactional
    public List<ChatMemoryItem> forgetLatest(UUID userId, UUID conversationId) {
        List<UUID> rows = turnMemoryService.userMessageIds(userId, conversationId).reversed();
        if (rows.isEmpty()) {
            return List.of();
        }
        block(rows.getFirst());
        for (UUID rowId : rows.stream().limit(LATEST_SCAN_LIMIT).toList()) {
            if (!turnMemoryService.liveItemsOf(userId, List.of(rowId)).isEmpty()) {
                block(rowId);
                // re-read AFTER the row lock: an extraction that committed meanwhile is included
                return forgetItems(userId, turnMemoryService.liveItemsOf(userId, List.of(rowId)));
            }
        }
        return List.of();
    }

    /** What "Mindent ebből a beszélgetésből?" would forget — every still-live item. */
    @Transactional(readOnly = true)
    public List<ChatMemoryItem> preview(UUID userId, UUID conversationId) {
        conversationService.getOwned(userId, conversationId);
        return turnMemoryService.liveItems(userId, conversationId);
    }

    /** The widen step: forget every live item of every user message of the conversation, and
     *  append them to the triggering message's forget envelope (turn-memory shows them there). */
    @Transactional
    public List<ChatMemoryItem> forgetAll(UUID userId, UUID conversationId, UUID triggerMessageId) {
        conversationService.getOwned(userId, conversationId);
        AiMessageEntity trigger = turnMemoryService.ownedUserMessage(userId, conversationId, triggerMessageId);
        List<UUID> rows = turnMemoryService.userMessageIds(userId, conversationId);
        rows.forEach(this::block);
        List<ChatMemoryItem> forgotten = forgetItems(userId, turnMemoryService.liveItemsOf(userId, rows));
        AiMessageEntity fresh = messageRepository.findById(trigger.getId()).orElseThrow();
        fresh.setForgottenMemories(ForgottenMemoriesEnvelope.append(fresh.getForgottenMemories(), forgotten));
        fresh.setExtractionBlocked(true);
        messageRepository.saveAndFlush(fresh);
        return forgotten;
    }

    private void block(UUID messageId) {
        messageRepository.findById(messageId).filter(m -> !m.isExtractionBlocked()).ifPresent(m -> {
            m.setExtractionBlocked(true);
            messageRepository.saveAndFlush(m); // the UPDATE takes the row lock the gate waits on
        });
    }

    private List<ChatMemoryItem> forgetItems(UUID userId, List<ChatMemoryItem> items) {
        PersonFactService facts = personFactService.getIfAvailable();
        List<ChatMemoryItem> done = new ArrayList<>();
        for (ChatMemoryItem item : items) {
            boolean forgotten = switch (item.kind()) {
                case ChatMemoryItem.KIND_PERSON_FACT -> {
                    if (facts == null) yield false;
                    facts.undo(userId, item.personId(), item.refId());
                    yield true;
                }
                case ChatMemoryItem.KIND_FACT_CANDIDATE -> {
                    factCandidateService.decide(userId, item.refId(), FactDecisionRequest.builder()
                            .decision(FactDecisionRequest.DecisionEnum.REJECT).build());
                    yield true;
                }
                case ChatMemoryItem.KIND_KNOWLEDGE_FACT -> {
                    if (knowledgeFactRepository.findByIdAndCreatedByAndDeletedFalse(item.refId(), userId).isEmpty()) {
                        yield false;
                    }
                    forgetService.forgetFact(userId, item.refId());
                    yield true;
                }
                default -> false;
            };
            if (forgotten) {
                done.add(item);
            }
        }
        return done;
    }
}
```

- [ ] **Step 8: Wire the gate + event flag into both extractors**

`ChatTurnCompleted`:

```java
/**
 * Published by {@link ChatService} after the assistant row of a turn is persisted (sync AND
 * streamed path). Consumed AFTER_COMMIT by the async extractors and the embedding listener.
 * {@code extractionBlocked} (S8, mezo-d6ivw.12): the user message was a forget request — the fact
 * and person-fact listeners skip it entirely.
 */
public record ChatTurnCompleted(UUID userId, UUID userMessageId, String userContent,
                                UUID assistantMessageId, String assistantContent, boolean extractionBlocked) {
}
```

`ChatService`: `completeTurn` publishes

```java
        boolean blocked = messageRepository.findById(userMessageId).map(AiMessageEntity::isExtractionBlocked).orElse(false);
        eventPublisher.publishEvent(new ChatTurnCompleted(userId, userMessageId, userContent,
                assistant.getId(), answer, blocked));
```
and `sendMessage` publishes `new ChatTurnCompleted(userId, userRow.getId(), request.getContent(), assistant.getId(), answer, userRow.isExtractionBlocked())`.

`FactExtractionListener.onChatTurnCompleted` and `PersonFactExtractionListener.onChatTurnCompleted` — first line:

```java
        if (event.extractionBlocked()) {
            return; // S8: "ezt ne jegyezd meg" — never learn from the forget request itself
        }
```

`FactExtractionService` — inject `private final MessageExtractionGate extractionGate;` and right after `if (extracted.isEmpty()) { return 0; }`:

```java
        // S8 (mezo-d6ivw.12): the turn was forgotten while the LLM call ran — drop everything.
        if (extractionGate.isBlocked(userMessageId)) {
            log.info("Fact extraction for message {} dropped — the turn was forgotten", userMessageId);
            return 0;
        }
```

`PersonFactExtractionService` — inject `private final MessageExtractionGate extractionGate;` and `private final org.springframework.transaction.support.TransactionTemplate transactionTemplate;` (Boot auto-configures the bean) and replace the final `return facts.capture(...).size();` with:

```java
        // S8 (mezo-d6ivw.12): gate + save in ONE transaction — the gate's FOR SHARE must be held
        // until the capture commits, or a forget could slip in between.
        Integer saved = transactionTemplate.execute(status -> extractionGate.isBlocked(userMessageId) ? 0
                : facts.capture(userId, PersonFactEntity.SOURCE_CHAT_TURN, userMessageId.toString(), captures).size());
        return saved == null ? 0 : saved;
```

Fix the test constructor call: `PostTurnActorIT.java:51` → append `, false` as the 6th argument. Then:

```bash
grep -rn "new ChatTurnCompleted(" backend/src
```
Expected: 3 hits (2 in `ChatService`, 1 in `PostTurnActorIT`), all with 6 arguments.

- [ ] **Step 9: Run — expect PASS**

```bash
cd backend && set -o pipefail && ./mvnw test -Dtest='ChatForgetServiceIT,TurnMemoryServiceIT,PostTurnActorIT,FactExtractionServiceIT,PersonFactExtractionServiceIT,ChatServiceIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -10
```
Expected: `BUILD SUCCESS`. `PersonFactExtractionServiceIT` random message ids have no `ai_message` row → gate reads `Optional.empty()` → not blocked (unchanged behaviour).

- [ ] **Step 10: Commit**

```bash
git add backend/src
git commit -m "feat(companion): forget the latest learning turn, widen to the conversation, block in-flight extraction (mezo-d6ivw.12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Chat wiring — forget pre-screen, `[Elfelejtve]`, forget-learned endpoints

**Files:**
- Modify: `api/feature/companion/companion.yml` (2 operations on one path + 2 schemas), regenerate
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatMemoryBlocks.java`
- Modify: `ChatService.java` (`prepareTurn`, `sendMessage`, `routeAndAssemble`, `conversationContext`, `turnContext`, `chatGearContext`, `openingTurn`, new helpers), `CompanionController.java`
- Test: create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/ChatForgetTurnIT.java`; extend `CompanionTurnMemoryApiIT`

**Interfaces:**
- Consumes: `ForgetIntent.matches` (Task 4), `ChatForgetService` (Task 5).
- Produces:
  - `String ChatMemoryBlocks.forgetBlock(UUID userId, List<ChatMemoryItem> forgotten)` — `""` for null, `[Elfelejtve] …` otherwise (empty list = "nem volt mit elfelejteni")
  - ChatService private `String memoryBlocks(UUID userId, AiConversationEntity conversation, List<ChatMemoryItem> forgotten)` — the ONE place later tasks add blocks (Task 7 adds a 4th `String peopleBlock` parameter, Task 8 the conversation block)
  - Generated `CompanionApi.previewForgetLearned(UUID)` → `List<MemoryItemResponse>`, `CompanionApi.forgetLearned(UUID, ForgetLearnedRequest)` → `ForgetLearnedResponse`

- [ ] **Step 1: Contract**

```yaml
  /api/companion/conversation/{conversationId}/forget-learned:
    get:
      tags: [Companion]
      operationId: previewForgetLearned
      summary: >-
        S8 (mezo-d6ivw.12) — what Mindent ebből a beszélgetésből? would forget: every still-live
        memory item this conversation produced (person facts, undecided proposals, accepted facts).
      parameters:
        - name: conversationId
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          description: Live items, newest first (may be empty)
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/MemoryItemResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: Conversation not found (or owned by someone else)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    post:
      tags: [Companion]
      operationId: forgetLearned
      summary: >-
        S8 — forget everything this conversation taught, permanently (veto, never re-learned from
        the same text). The forgotten items are appended to the triggering message forget list.
      parameters:
        - name: conversationId
          in: path
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/ForgetLearnedRequest' }
      responses:
        '200':
          description: What was forgotten
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ForgetLearnedResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: Conversation or trigger message not found (or owned by someone else)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

Schemas:

```yaml
    ForgetLearnedRequest:
      type: object
      required: [triggerMessageId]
      properties:
        triggerMessageId: { type: string, format: uuid, description: 'The USER message whose Elfelejtettem chip offered the widen.' }
    ForgetLearnedResponse:
      type: object
      required: [forgotten]
      properties:
        forgotten:
          type: array
          items: { $ref: '#/components/schemas/MemoryItemResponse' }
```

Regenerate (Task 1 Step 2).

- [ ] **Step 2: Failing turn-level IT** (conversation-first path, the prod path)

`ChatForgetTurnIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/** S8 (mezo-d6ivw.12): a forget request inside a real chat turn — prompt, envelope, no-extract. */
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.conversation.enabled=true")
class ChatForgetTurnIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private PersonFactService personFactService;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private AiMessagePopulator messages;
    @Autowired private PersonPopulator persons;
    @Autowired private DatabasePopulator databasePopulator;

    private SendMessageRequest request(String text) {
        return SendMessageRequest.builder().content(text).build();
    }

    @Test
    void testSendMessage_shouldForgetTellTheModelAndRecordTheEnvelope_whenAskedNotToRemember() {
        UUID userId = databasePopulator.populateUser("s8-forget-turn@test.local");
        AiConversationEntity conversation = conversations.conversation(userId);
        AiMessageEntity earlier = messages.message(conversation, AiMessageEntity.ROLE_USER, "Anna régi csapattársam");
        PersonEntity anna = persons.createPerson(userId, "Anna");
        personFactService.capture(userId, PersonFactEntity.SOURCE_CHAT_TURN, earlier.getId().toString(), List.of(
                new PersonFactService.PersonFactCapture(anna.getId(), PersonFactEntity.KIND_PREFERENCE,
                        "régi csapattársad", "medium")));

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("Ezt ne jegyezd meg."));

        assertThat(answer.getContent()).contains("[Elfelejtve]").contains("Anna: régi csapattársad");
        AiMessageEntity forgetRow = messageRepository.findById(answer.getTurnUserMessageId()).orElseThrow();
        assertThat(forgetRow.isExtractionBlocked()).isTrue();
        assertThat(forgetRow.getForgottenMemories().items()).singleElement()
                .satisfies(i -> assertThat(i.text()).isEqualTo("régi csapattársad"));
    }

    @Test
    void testSendMessage_shouldSayNothingToForget_whenNothingWasLearned() {
        UUID userId = databasePopulator.populateUser("s8-forget-nothing@test.local");
        AiConversationEntity conversation = conversations.conversation(userId);

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("felejtsd el"));

        assertThat(answer.getContent()).contains("[Elfelejtve]").contains("nem volt mit elfelejteni");
        assertThat(messageRepository.findById(answer.getTurnUserMessageId()).orElseThrow().getForgottenMemories()).isNull();
    }

    @Test
    void testSendMessage_shouldNotForget_forANegativePhrase() {
        UUID userId = databasePopulator.populateUser("s8-forget-negative@test.local");
        AiConversationEntity conversation = conversations.conversation(userId);

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(),
                request("Felejtsd el a tervet, csináljunk újat."));

        assertThat(answer.getContent()).doesNotContain("[Elfelejtve]");
        assertThat(messageRepository.findById(answer.getTurnUserMessageId()).orElseThrow().isExtractionBlocked()).isFalse();
    }
}
```

`CompanionTurnMemoryApiIT` — add:

```java
    @Test
    void forgetLearned_shouldReturn404_forUnknownConversation() {
        postForBody("/api/companion/conversation/" + UUID.randomUUID() + "/forget-learned",
                java.util.Map.of("triggerMessageId", UUID.randomUUID().toString()),
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void previewForgetLearned_shouldReturn401_withoutToken() {
        getForBody("/api/companion/conversation/" + UUID.randomUUID() + "/forget-learned", null,
                HttpStatus.UNAUTHORIZED, String.class);
    }
```

- [ ] **Step 3: Run — expect failures** (`[Elfelejtve]` absent, endpoints missing)

```bash
cd backend && ./mvnw test -Dtest='ChatForgetTurnIT,CompanionTurnMemoryApiIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -20
```

- [ ] **Step 4: `ChatMemoryBlocks`**

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.entity.ChatMemoryItem;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * S8 (mezo-d6ivw.12): the volatile prompt blocks that let the model speak truthfully about memory.
 * {@code [Elfelejtve]} — what the forget pre-screen of THIS turn forgot, so the reply confirms it.
 * {@code [Ebben a beszélgetésben]} (Task 8) — what this conversation learned or proposed, the only
 * items the model may call "megjegyeztem".
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class ChatMemoryBlocks {

    static final String FORGET_HEADER = "[Elfelejtve]";
    static final int LINE_MAX_CHARS = 160;
    private static final Pattern CONTROL = Pattern.compile("[\\r\\n\\t\\p{Cc}]+");

    private final TurnMemoryService turnMemoryService;
    private final PromptPersona promptPersona;

    /** "" when the turn was not a forget request (null); a block otherwise. */
    public String forgetBlock(UUID userId, List<ChatMemoryItem> forgotten) {
        if (forgotten == null) {
            return "";
        }
        if (forgotten.isEmpty()) {
            return promptPersona.render(userId, "\n\n" + FORGET_HEADER + " {{NÉV}} azt kérte, ne jegyezz meg "
                    + "valamit, de ebből a beszélgetésből nem volt mit elfelejteni — ezt mondd meg neki őszintén.");
        }
        StringBuilder b = new StringBuilder("\n\n").append(FORGET_HEADER)
                .append(" {{NÉV}} kérésére ezeket most végleg elfelejtetted (erősítsd meg röviden, hogy "
                        + "elfelejtetted — mondd úgy: elfelejtettem, ne úgy: töröltem):");
        forgotten.forEach(item -> b.append("\n- ").append(line(item)));
        return promptPersona.render(userId, b.toString());
    }

    static String line(ChatMemoryItem item) {
        String text = CONTROL.matcher(item.text()).replaceAll(" ").strip();
        String who = item.who() == null ? "" : CONTROL.matcher(item.who()).replaceAll(" ").strip() + ": ";
        String full = who + text;
        return full.length() > LINE_MAX_CHARS ? full.substring(0, LINE_MAX_CHARS) + "…" : full;
    }
}
```

- [ ] **Step 5: `ChatService` wiring**

Add fields: `private final ChatForgetService chatForgetService;` `private final ChatMemoryBlocks chatMemoryBlocks;` (both COMPANION-gated like `ChatService`).

Add helpers:

```java
    /** S8 (mezo-d6ivw.12): the deterministic forget pre-screen — null when the message is not a
     *  forget request, the forgotten items (possibly empty) when it is. Runs BEFORE the user row
     *  is persisted, so "the latest turn" is always an earlier one. */
    private List<ChatMemoryItem> forgetIfAsked(UUID userId, UUID conversationId, String content) {
        return ForgetIntent.matches(content) ? chatForgetService.forgetLatest(userId, conversationId) : null;
    }

    /** S8: every memory-honesty block of the volatile half, in one place. */
    private String memoryBlocks(UUID userId, AiConversationEntity conversation, List<ChatMemoryItem> forgotten) {
        return chatMemoryBlocks.forgetBlock(userId, forgotten);
    }

    /** S8: the forget request's own row — never extracted, and it remembers what it forgot. */
    private AiMessageEntity markForgetRow(AiMessageEntity userRow, List<ChatMemoryItem> forgotten) {
        if (forgotten == null) {
            return userRow;
        }
        userRow.setExtractionBlocked(true);
        userRow.setForgottenMemories(ForgottenMemoriesEnvelope.ofOrNull(forgotten));
        return messageRepository.saveAndFlush(userRow);
    }
```

Change signatures and call sites:

1. `routeAndAssemble(UUID userId, AiConversationEntity conversation, String userContent, List<Turn> history, LocalDate today, List<ChatMemoryItem> forgotten)` — compute `String blocks = memoryBlocks(userId, conversation, forgotten);` first, then:
   - conversation branch: `conversationContext(userId, conversation, today, blocks)`
   - legacy: `chatGearContext(userId, today, blocks)` / `turnContext(userId, today, memory.factsBlock(), memory.memoriesBlock(), memory.graphBlock(), blocks, conversation.getContextKind(), conversation.getContextDate())`
2. `conversationContext(UUID userId, AiConversationEntity conversation, LocalDate today, String memoryBlocks)` → append `+ memoryBlocks` after `knowledgeFactService.renderPromptBlock(userId)`.
3. `turnContext(..., String graphBlock, String memoryBlocks, String contextKind, LocalDate contextDate)` → last render becomes `promptPersona.render(userId, memoriesBlock + graphBlock + memoryBlocks + TONE_REMINDER)` (TONE_REMINDER stays last).
4. `chatGearContext(UUID userId, LocalDate today, String memoryBlocks)` → `promptPersona.render(userId, "\n\nMa: " + today + "\n" + memoryBlocks + TONE_REMINDER) + personalContextAssembler.render(userId, today)`.
5. `openingTurn` → `conversationContext(userId, conversation, LocalDate.now(), "")` and the legacy `turnContext(... , "", "", "", ...)` gains one more `""`.
6. `prepareTurn` and `sendMessage`, before `routeAndAssemble`:

```java
        List<ChatMemoryItem> forgotten = forgetIfAsked(userId, conversationId, request.getContent());
        RoutedContext routed = routeAndAssemble(userId, conversation, request.getContent(), history, today, forgotten);
        AiMessageEntity userRow = markForgetRow(persistMessage(conversation, userId, AiMessageEntity.ROLE_USER,
                request.getContent(), null, null, null, false, null), forgotten);
```

Imports: `ChatMemoryItem`, `ForgottenMemoriesEnvelope`.

- [ ] **Step 6: Controller**

`CompanionController` — inject `private final ChatForgetService chatForgetService;` and `private final CompanionMapper mapper;` (if not yet a field) and:

```java
    @Override
    public List<MemoryItemResponse> previewForgetLearned(UUID conversationId) {
        return chatForgetService.preview(currentUserId.get(), conversationId).stream()
                .map(mapper::toMemoryItemResponse).toList();
    }

    @Override
    public ForgetLearnedResponse forgetLearned(UUID conversationId, ForgetLearnedRequest request) {
        return ForgetLearnedResponse.builder()
                .forgotten(chatForgetService.forgetAll(currentUserId.get(), conversationId, request.getTriggerMessageId())
                        .stream().map(mapper::toMemoryItemResponse).toList())
                .build();
    }
```

- [ ] **Step 7: Run — expect PASS** (plus the companion prompt-order suites)

```bash
cd backend && set -o pipefail && ./mvnw test -Dtest='ChatForgetTurnIT,CompanionTurnMemoryApiIT,ChatServiceIT,ChatServiceGearIT,ConversationFirstIT,ConversationFactsIT,PromptOrder*,ChatStream*' -Dmezo.test.use-testcontainers=true 2>&1 | tail -12
```
Expected: `BUILD SUCCESS`. A non-forget turn's prompt is byte-identical to before (the block is `""`).

- [ ] **Step 8: Commit**

```bash
git add api frontend/src/data/_client/api.gen.ts backend/src
git commit -m "feat(companion): ezt ne jegyezd meg in the chat turn + forget-learned endpoints (mezo-d6ivw.12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Deterministic people recall — `[Emberek]` block + `kind=person` disclosure + switch

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/MatchedPerson.java`, `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PeopleRecall.java`
- Modify: `people/service/PersonNeedles.java`, `people/service/MentionDetectionService.java`, `people/service/PeopleService.java:152-187`, `companion/service/PeopleSnapshotBlock.java`, `companion/entity/RecalledMemoriesEnvelope.java`, `companion/service/ChatService.java`, `techcore/configuration/FeaturesConfiguration.java`, `backend/src/main/resources/application.yml` (`mezo.companion` block, next to `extraction:`)
- Test: create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/PeopleRecallTest.java` (unit), `PeopleRecallIT.java`, `PeopleRecallSwitchOffIT.java`; extend `backend/src/test/java/io/mrkuhne/mezo/feature/people/MentionDetectionServiceIT.java`

**Interfaces:**
- Produces:
  - `public record MatchedPerson(UUID id, String name)` (people)
  - `List<MatchedPerson> MentionDetectionService.matchActivePersons(UUID userId, String text, int max)` — read-only, ordered by first mention, same TextFold/word-start rule as `detect`
  - `static int PersonNeedles.indexAtWordStart(String foldedHaystack, String foldedNeedle)` (−1 = none)
  - `List<PersonChatContext> PeopleService.chatContextFor(UUID userId, LocalDate today, Collection<UUID> personIds)`
  - `String PeopleSnapshotBlock.renderMentioned(UUID userId, LocalDate today, List<UUID> personIds)` (`""` when nothing)
  - `PeopleRecall.Result PeopleRecall.recall(UUID userId, String userContent, LocalDate today)`; `record Result(String block, List<RecalledMemoriesEnvelope.Item> items)`, `Result.EMPTY`
  - `RecalledMemoriesEnvelope.KIND_PERSON = "person"`, `static RecalledMemoriesEnvelope withExtra(RecalledMemoriesEnvelope base, List<Item> extra)`, `static List<Item> personItems(RecalledMemoriesEnvelope env)`
  - `FeaturesConfiguration.COMPANION_PEOPLE_RECALL_SWITCH = "mezo.companion.people-recall.enabled"`

- [ ] **Step 1: Failing people-side test** (append to `MentionDetectionServiceIT`)

```java
    @Test
    void testMatchActivePersons_shouldFoldAndOrderByFirstMention_andPersistNothing() {
        UUID userId = databasePopulator.populateUser("s8-match@test.local");
        PersonEntity bence = personPopulator.createPerson(userId, "Bence");
        PersonEntity dori = personPopulator.createPerson(userId, "Dóri");
        personPopulator.createCandidate(userId, "Jelölt Juli", "jegyzet");
        long before = mentionRepository.count();

        List<MatchedPerson> matched = mentionDetectionService.matchActivePersons(userId,
                "Dorival és Bencével nyertünk, Juli is ott volt", 5);

        assertThat(matched).extracting(MatchedPerson::id).containsExactly(dori.getId(), bence.getId());
        assertThat(mentionRepository.count()).isEqualTo(before);
    }
```
(Use the class's existing populator/repository field names; add `@Autowired private MentionRepository mentionRepository;` if absent.)

- [ ] **Step 2: Implement the people side**

`MatchedPerson.java`:

```java
package io.mrkuhne.mezo.feature.people.service;

import java.util.UUID;

/** S8 (mezo-d6ivw.12): a person named in a message — the read-only matcher's result. */
public record MatchedPerson(UUID id, String name) {}
```

`PersonNeedles` — replace `containsAtWordStart` with:

```java
    /** The first word-start index of the needle, or -1 (S8: recall orders by first mention). */
    static int indexAtWordStart(String foldedHaystack, String foldedNeedle) {
        int i = -1;
        while ((i = foldedHaystack.indexOf(foldedNeedle, i + 1)) >= 0) {
            if (i == 0 || !Character.isLetterOrDigit(foldedHaystack.charAt(i - 1))) {
                return i;
            }
        }
        return -1;
    }

    static boolean containsAtWordStart(String foldedHaystack, String foldedNeedle) {
        return indexAtWordStart(foldedHaystack, foldedNeedle) >= 0;
    }
```

`MentionDetectionService` — add (imports `java.util.Comparator`, `java.util.Map`, `java.util.LinkedHashMap`):

```java
    /**
     * S8 (mezo-d6ivw.12): the SAME name/alias rule as {@link #detect}, read-only — nothing is
     * persisted (the async ChatMentionListener still writes the mention). Active persons only,
     * ordered by where they are first named, capped at {@code max}.
     */
    @Transactional(readOnly = true)
    public List<MatchedPerson> matchActivePersons(UUID userId, String text, int max) {
        if (text == null || text.isBlank() || max <= 0) {
            return List.of();
        }
        String folded = TextFold.fold(text);
        Map<PersonEntity, Integer> firstIndex = new LinkedHashMap<>();
        for (PersonEntity person : personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(userId)) {
            if (!"active".equals(person.getStatus())) {
                continue;
            }
            PersonNeedles.of(person).stream()
                    .mapToInt(needle -> PersonNeedles.indexAtWordStart(folded, needle))
                    .filter(i -> i >= 0)
                    .min()
                    .ifPresent(i -> firstIndex.put(person, i));
        }
        return firstIndex.entrySet().stream()
                .sorted(Map.Entry.comparingByValue())
                .limit(max)
                .map(e -> new MatchedPerson(e.getKey().getId(), e.getKey().getName()))
                .toList();
    }
```

`PeopleService` — turn the body of `chatContext` into a private filtered variant:

```java
    @Transactional(readOnly = true)
    public List<PersonChatContext> chatContext(UUID userId, LocalDate today) {
        return chatContext(userId, today, p -> true);
    }

    /** S8 (mezo-d6ivw.12): the same rows for the persons a message names. */
    @Transactional(readOnly = true)
    public List<PersonChatContext> chatContextFor(UUID userId, LocalDate today, Collection<UUID> personIds) {
        if (personIds.isEmpty()) {
            return List.of();
        }
        Set<UUID> wanted = Set.copyOf(personIds);
        return chatContext(userId, today, p -> wanted.contains(p.getId()));
    }

    private List<PersonChatContext> chatContext(UUID userId, LocalDate today, Predicate<PersonEntity> include) {
        List<PersonEntity> persons = personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(userId)
            .stream().filter(include).toList();
        // … the existing body, unchanged from `if (persons.isEmpty())` on …
    }
```
(imports `java.util.function.Predicate`, `java.util.Collection`, `java.util.Set` if absent.)

Run: `cd backend && ./mvnw test -Dtest='MentionDetectionServiceIT,PeopleServiceIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -8` → PASS.

- [ ] **Step 3: Failing companion tests**

`PeopleRecallTest.java` (unit — fail-open, no Spring):

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.people.service.MatchedPerson;
import io.mrkuhne.mezo.feature.people.service.MentionDetectionService;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;

/** S8: a matcher failure never costs the user the turn — no block, no disclosure. */
class PeopleRecallTest {

    @Test
    void testRecall_shouldFailOpen_whenTheMatcherThrows() {
        MentionDetectionService broken = new MentionDetectionService(null, null) {
            @Override
            public List<MatchedPerson> matchActivePersons(UUID userId, String text, int max) {
                throw new IllegalStateException("boom");
            }
        };
        PeopleRecall recall = new PeopleRecall(broken, null,
                new StaticListableBeanFactory().getBeanProvider(io.mrkuhne.mezo.feature.people.service.PersonFactService.class));

        assertThat(recall.recall(UUID.randomUUID(), "Dórival", LocalDate.of(2026, 9, 27)))
                .isEqualTo(PeopleRecall.Result.EMPTY);
    }
}
```

`PeopleRecallIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/** S8 (mezo-d6ivw.12): code names the people, not the planner — block injected, envelope persisted. */
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.conversation.enabled=true")
class PeopleRecallIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private PersonFactService personFactService;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private PersonPopulator persons;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testSendMessage_shouldInjectMentionedPeopleAndDiscloseThem_whenNamed() {
        UUID userId = databasePopulator.populateUser("s8-recall@test.local");
        AiConversationEntity conversation = conversations.conversation(userId);
        PersonEntity dori = persons.createPerson(userId, "Dóri");
        persons.createPerson(userId, "Bence");
        personFactService.capture(userId, PersonFactEntity.SOURCE_NIGHTLY_DAY, "2026-09-26", List.of(
                new PersonFactService.PersonFactCapture(dori.getId(), PersonFactEntity.KIND_RELATIONSHIP_STATE,
                        "tavasz óta a strandröpi-párod", "high")));

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(),
                SendMessageRequest.builder().content("Dórival és Bencével nyertünk ma!").build());

        assertThat(answer.getContent()).contains("[Emberek] (az üzenetben említettek)")
                .contains("Dóri").contains("Bence").contains("tavasz óta a strandröpi-párod");
        // Bence has no fact → in the block, NOT in the disclosure
        assertThat(answer.getRecalled()).filteredOn(r -> "person".equals(r.getKind()))
                .singleElement().satisfies(r -> {
                    assertThat(r.getLabel()).isEqualTo("Dóri");
                    assertThat(r.getGist()).isEqualTo("tavasz óta a strandröpi-párod");
                });
    }

    @Test
    void testSendMessage_shouldAddNothing_whenNoKnownPersonIsNamed() {
        UUID userId = databasePopulator.populateUser("s8-recall-none@test.local");
        AiConversationEntity conversation = conversations.conversation(userId);
        persons.createPerson(userId, "Dóri");

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(),
                SendMessageRequest.builder().content("Milyen napom volt?").build());

        assertThat(answer.getContent()).doesNotContain("(az üzenetben említettek)");
        assertThat(answer.getRecalled()).noneMatch(r -> "person".equals(r.getKind()));
    }
}
```

`PeopleRecallSwitchOffIT.java` — same fixture as the first test with `@TestPropertySource(properties = {"mezo.companion.conversation.enabled=true", "mezo.companion.people-recall.enabled=false"})`, asserting `doesNotContain("(az üzenetben említettek)")` and no `person` recalled item.

- [ ] **Step 4: Run — expect failures**

```bash
cd backend && ./mvnw test -Dtest='PeopleRecallTest,PeopleRecallIT,PeopleRecallSwitchOffIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -15
```

- [ ] **Step 5: Implement**

`FeaturesConfiguration`:

```java
    /** S8 (mezo-d6ivw.12) — deterministic people recall in the chat: names in the user message →
     *  an [Emberek] block of just those people + an "Emlékszem" disclosure. Off ⇒ the PeopleRecall
     *  bean is absent and the turn assembles exactly as before (fail-open either way). */
    public static final String COMPANION_PEOPLE_RECALL_SWITCH = "mezo.companion.people-recall.enabled";
```

`application.yml` (under `mezo.companion`, sibling of `extraction:`):

```yaml
    # S8 (mezo-d6ivw.12): the chat recalls the people a message names — deterministically (the
    # MentionDetectionService TextFold/word-start rule), before routing. Off ⇒ no block, no
    # "Emlékszem" disclosure; the planner can still fetch people through get_personal_context.
    people-recall:
      enabled: true
```

`RecalledMemoriesEnvelope` — add (imports `java.util.ArrayList`):

```java
    /** S8 (mezo-d6ivw.12): the deterministic people recall's item kind ("Emlékszem"). */
    public static final String KIND_PERSON = "person";

    /** {@code base} plus {@code extra} items not already in it — null when both are empty. */
    public static RecalledMemoriesEnvelope withExtra(RecalledMemoriesEnvelope base, List<Item> extra) {
        List<Item> all = new ArrayList<>(base == null ? List.of() : base.items());
        extra.stream().filter(item -> !all.contains(item)).forEach(all::add);
        return ofOrNull(all);
    }

    public static List<Item> personItems(RecalledMemoriesEnvelope envelope) {
        return envelope == null ? List.of()
                : envelope.items().stream().filter(item -> KIND_PERSON.equals(item.kind())).toList();
    }
```

`PeopleSnapshotBlock` — add:

```java
    static final String MENTIONED_HEADER = HEADER_PREFIX + " (az üzenetben említettek)";

    /** S8 (mezo-d6ivw.12): the SAME rows for just the people this message names — "" when none. */
    public String renderMentioned(UUID userId, LocalDate today, List<UUID> personIds) {
        if (personIds.isEmpty()) {
            return "";
        }
        PeopleService service = peopleService.getIfAvailable();
        if (service == null) {
            return "";
        }
        List<PersonChatContext> rows = service.chatContextFor(userId, today, personIds);
        if (rows.isEmpty()) {
            return "";
        }
        StringBuilder b = new StringBuilder(MENTIONED_HEADER);
        rows.forEach(p -> b.append('\n').append(line(p)));
        return b.toString();
    }
```

`PeopleRecall.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.entity.RecalledMemoriesEnvelope;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.service.MatchedPerson;
import io.mrkuhne.mezo.feature.people.service.MentionDetectionService;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * S8 (mezo-d6ivw.12): deterministic people recall — the 09-26 planner made zero people reads in
 * six turns, so code names the people now. The user message is matched with the mention
 * detector's own TextFold/word-start rule (read-only), the matched people (≤ {@value #MAX_PERSONS})
 * get an {@code [Emberek]} block in the VOLATILE half (the same rows the planner tool would fetch),
 * and those with prompt-enabled facts are disclosed as {@code kind=person} recalled items — the
 * chat's "Emlékszem" line. Fail-open: any failure = no block, no disclosure, the turn proceeds.
 * (A DataAccessException still poisons the surrounding turn transaction — the IDENT-3 caveat of
 * {@link PeopleSnapshotBlock} applies unchanged.)
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.COMPANION_PEOPLE_RECALL_SWITCH},
        havingValue = "true")
public class PeopleRecall {

    static final int MAX_PERSONS = 5;
    static final int FACTS_PER_PERSON = 3;

    private final MentionDetectionService mentionDetection;
    private final PeopleSnapshotBlock peopleSnapshotBlock;
    private final ObjectProvider<PersonFactService> personFactService;

    public record Result(String block, List<RecalledMemoriesEnvelope.Item> items) {
        public static final Result EMPTY = new Result("", List.of());
    }

    public Result recall(UUID userId, String userContent, LocalDate today) {
        try {
            List<MatchedPerson> matched = mentionDetection.matchActivePersons(userId, userContent, MAX_PERSONS);
            if (matched.isEmpty()) {
                return Result.EMPTY;
            }
            String block = peopleSnapshotBlock.renderMentioned(userId, today,
                    matched.stream().map(MatchedPerson::id).toList());
            return new Result(block.isEmpty() ? "" : "\n\n" + block, disclosed(userId, matched));
        } catch (RuntimeException e) {
            log.warn("People recall failed for user {} — the turn proceeds without it", userId, e);
            return Result.EMPTY;
        }
    }

    private List<RecalledMemoriesEnvelope.Item> disclosed(UUID userId, List<MatchedPerson> matched) {
        PersonFactService facts = personFactService.getIfAvailable();
        if (facts == null) {
            return List.of();
        }
        Map<UUID, List<String>> byPerson = facts.promptFacts(userId, matched.stream().map(MatchedPerson::id).toList())
                .stream()
                .collect(Collectors.groupingBy(PersonFactEntity::getPersonId, LinkedHashMap::new,
                        Collectors.mapping(PersonFactEntity::getFactText, Collectors.toList())));
        return matched.stream()
                .filter(p -> byPerson.containsKey(p.id()))
                .map(p -> new RecalledMemoriesEnvelope.Item(RecalledMemoriesEnvelope.KIND_PERSON, p.id(), null,
                        p.name(), String.join("\n", byPerson.get(p.id()).stream().limit(FACTS_PER_PERSON).toList()), 1.0))
                .toList();
    }
}
```

`ChatService`:
- field `private final ObjectProvider<PeopleRecall> peopleRecall;`
- `RoutedContext` gains a 5th component `PeopleRecall.Result people`.
- helper:

```java
    /** S8: deterministic people recall — EMPTY when the switch is off (bean absent). */
    private PeopleRecall.Result recallPeople(UUID userId, String content, LocalDate today) {
        PeopleRecall recall = peopleRecall.getIfAvailable();
        return recall == null ? PeopleRecall.Result.EMPTY : recall.recall(userId, content, today);
    }
```
- `routeAndAssemble`: first `PeopleRecall.Result people = recallPeople(userId, userContent, today);`, then `String blocks = memoryBlocks(userId, conversation, forgotten, people.block());`, and pass `people` into every `new RoutedContext(...)`.
- `memoryBlocks(UUID userId, AiConversationEntity conversation, List<ChatMemoryItem> forgotten, String peopleBlock)` → `return peopleBlock + chatMemoryBlocks.forgetBlock(userId, forgotten);`
- `prepareTurn`: `RecalledMemoriesEnvelope.withExtra(routed.memory().recalled(), routed.people().items())` as the `PreparedTurn.recalled` argument.
- `sendMessage` persist: `RecalledMemoriesEnvelope.withExtra(audit.recalled() == null ? memory.recalled() : audit.recalled(), routed.people().items())`.
- `completeTurn` persist: `RecalledMemoriesEnvelope.withExtra(audit.recalled() == null ? recalled : audit.recalled(), RecalledMemoriesEnvelope.personItems(recalled))` (a tool recall no longer drops the people disclosure — contradiction 4).

- [ ] **Step 6: Run — expect PASS** (+ ArchUnit; the people package must not import companion)

```bash
cd backend && set -o pipefail && ./mvnw test -Dtest='PeopleRecallTest,PeopleRecallIT,PeopleRecallSwitchOffIT,MentionDetectionServiceIT,PeopleSnapshotBlockTest,ChatServiceIT,ChatServiceAmbientRecallIT,ConversationFirstIT,*Arch*' -Dmezo.test.use-testcontainers=true 2>&1 | tail -12
```
Expected: `BUILD SUCCESS`.

- [ ] **Step 7: Commit**

```bash
git add backend/src
git commit -m "feat(companion): deterministic people recall with an Emlékszem disclosure (mezo-d6ivw.12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Honest prompt — VOICE / SYSTEM_PROMPT / FACTS_HEADER + `[Ebben a beszélgetésben]`

**Files:**
- Modify: `ConversationTurnService.java:45-47` (VOICE), `ChatService.java:100-102` (SYSTEM_PROMPT), `KnowledgeFactService.java:52-55` (FACTS_HEADER), `ChatMemoryBlocks.java`, `ChatService.memoryBlocks`
- Test: `ChatServiceIT.java:467-468`, `service/ConversationFirstIT.java:87-88`, create `service/ChatMemoryBlocksIT.java`, extend `KnowledgeFactServiceIT`

**Interfaces:**
- Produces: `String ChatMemoryBlocks.conversationBlock(UUID userId, UUID conversationId)` — `""` when the conversation learned/proposed nothing live; else `[Ebben a beszélgetésben] …` with ≤ 8 item lines, newest first.

- [ ] **Step 1: Update the pinned tests first (they fail against the old text)**

`ChatServiceIT` (legacy prompt test, line 467):

```java
        // S8 (mezo-d6ivw.12): the action rule survives, the memory is described honestly.
        assertThat(echoed).contains("Naplózni, módosítani vagy bármit elvégezni")
                .contains("Soha ne állítsd, hogy elvégeztél valamit.")
                .contains("Emlékezni viszont tudsz")
                .contains("[Ebben a beszélgetésben]")
                .doesNotContain("Naplózni, menteni");
```

`ConversationFirstIT` (line 87):

```java
        assertThat(turn.systemPrompt()).contains("Nem tudsz naplózni, módosítani vagy bármit elvégezni",
                "Soha ne állítsd, hogy elvégeztél valamit", "Emlékezni viszont tudsz",
                "Soha ne mondd, hogy nem tudsz emlékezni");
        assertThat(turn.systemPrompt()).doesNotContain("naplózni, menteni");
```

`KnowledgeFactServiceIT`:

```java
    @Test
    void testFactsHeader_shouldAllowARareNaturalAcknowledgement() {
        assertThat(KnowledgeFactService.FACTS_HEADER).doesNotContain("ne hivatkozz arra")
                .contains("ahogy mondtad");
    }
```

`ChatMemoryBlocksIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/** S8: the model may call "megjegyeztem" only what this block lists — and the block is capped. */
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.conversation.enabled=true")
class ChatMemoryBlocksIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private ChatMemoryBlocks blocks;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private AiMessagePopulator messages;
    @Autowired private LearnedFactPopulator candidates;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testConversationBlock_shouldListWhatThisConversationLearned_capped() {
        UUID userId = databasePopulator.populateUser("s8-ebben@test.local");
        AiConversationEntity conversation = conversations.conversation(userId);
        AiMessageEntity turn = messages.message(conversation, AiMessageEntity.ROLE_USER, "sok minden");
        for (int i = 1; i <= 10; i++) {
            candidates.candidate(userId, "javaslat-%02d".formatted(i), "life", turn.getId());
        }

        String block = blocks.conversationBlock(userId, conversation.getId());

        assertThat(block).startsWith("\n\n[Ebben a beszélgetésben]");
        assertThat(block.lines().filter(l -> l.startsWith("- ")).count()).isEqualTo(8);
        assertThat(block).contains("javaslat, még nem döntött róla: javaslat-");
    }

    @Test
    void testSendMessage_shouldOmitTheBlock_whenNothingWasLearned() {
        UUID userId = databasePopulator.populateUser("s8-ebben-empty@test.local");
        AiConversationEntity conversation = conversations.conversation(userId);

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(),
                SendMessageRequest.builder().content("Szia").build());

        assertThat(answer.getContent()).doesNotContain("[Ebben a beszélgetésben]");
    }
}
```

Run: `cd backend && ./mvnw test -Dtest='ChatServiceIT,ConversationFirstIT,KnowledgeFactServiceIT,ChatMemoryBlocksIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -15` → FAIL.

- [ ] **Step 2: Rewrite `VOICE` lines 45-47** (replace those three lines only)

```java
            Nem tudsz naplózni, módosítani vagy bármit elvégezni a felhasználó helyett; csak
            beszélgetni és lekérdezni tudsz. Ha ilyet kérnek, mondd meg őszintén, és mondd el,
            hol tudja ő maga megtenni. Soha ne állítsd, hogy elvégeztél valamit.
            Emlékezni viszont tudsz: a beszélgetés után az app a háttérben megjegyzi, ami tartós.
            Amit az ismerőseiről mond, azt elmenti, és itt a beszélgetésben visszavonhatja; amit
            magáról mond, azt előbb javaslatként itt a beszélgetésben megkérdezi tőle. Mindez a
            Tudástárban is látszik.
            Soha ne mondd, hogy nem tudsz emlékezni vagy megjegyezni.
            Egy konkrét dologról csak akkor mondd, hogy megjegyezted, ha szerepel az
            [Ebben a beszélgetésben] blokkban; mondd úgy, hogy „megjegyeztem", sose úgy, hogy
            „elmentettem". Ha azt kéri, hogy valamit ne jegyezz meg vagy felejts el, azt az app
            elvégzi: az [Elfelejtve] blokk alapján erősítsd meg, mit felejtettél el.
```

- [ ] **Step 3: Rewrite the legacy `SYSTEM_PROMPT` lines 100-102** (same meaning, the file's `\`-continuation style)

```java
            Naplózni, módosítani vagy bármit elvégezni {{NÉV}} helyett nem tudsz — csak \
            beszélgetni és lekérdezni. Ha ilyet kérnek, mondd meg őszintén, és mondd el, hol tudja \
            ő maga megtenni. Soha ne állítsd, hogy elvégeztél valamit.
            Emlékezni viszont tudsz: a beszélgetés után az app a háttérben megjegyzi, ami tartós. \
            Amit {{NÉV}} az ismerőseiről mond, azt elmenti (itt visszavonhatja); amit magáról, azt \
            előbb javaslatként itt megkérdezi. Mindez a Tudástárban is látszik. Soha ne mondd, hogy \
            nem tudsz emlékezni. Konkrét dologról csak akkor mondd, hogy megjegyezted, ha szerepel \
            az [Ebben a beszélgetésben] blokkban („megjegyeztem", sose „elmentettem"). Ha azt kéri, \
            hogy valamit felejts el, az [Elfelejtve] blokk alapján erősítsd meg, mit felejtettél el.
```

- [ ] **Step 4: Rewrite `FACTS_HEADER`**

```java
    /** The injection block header — appended as a sibling block on every channel (facts-always,
     *  mezo-d6ivw.8). Passive use; S8 (mezo-d6ivw.12) allows a rare, natural acknowledgement —
     *  "never cite the remembering" contradicted the honest-memory voice. */
    public static final String FACTS_HEADER =
            "\n\nMEGERŐSÍTETT TÉNYEK {{NÉV}} személyéről (legfontosabb elöl):\n"
            + "Ezeket tudod róla korábbról. Használd természetesen, amikor releváns — ne sorold fel. "
            + "Ritkán, ha illik, egy félmondatban jelezheted, hogy tudod („ahogy mondtad…\").\n";
```

- [ ] **Step 5: `[Ebben a beszélgetésben]`**

`ChatMemoryBlocks` — add:

```java
    static final String CONVERSATION_HEADER = "[Ebben a beszélgetésben]";
    static final int CONVERSATION_MAX_LINES = 8;

    /** What this conversation learned or proposed (the turn-memory source), newest first, capped.
     *  "" when nothing — an absent block means there is nothing the model may claim. */
    public String conversationBlock(UUID userId, UUID conversationId) {
        List<ChatMemoryItem> items = turnMemoryService.liveItems(userId, conversationId);
        if (items.isEmpty()) {
            return "";
        }
        StringBuilder b = new StringBuilder("\n\n").append(CONVERSATION_HEADER)
                .append(" Amit ebből a beszélgetésből a háttérben megjegyeztél vagy javasoltál — csak ezekről "
                        + "mondhatod, hogy megjegyezted:");
        items.stream().limit(CONVERSATION_MAX_LINES).forEach(item -> b.append("\n- ").append(label(item))
                .append(line(item)));
        return promptPersona.render(userId, b.toString());
    }

    private static String label(ChatMemoryItem item) {
        return switch (item.kind()) {
            case ChatMemoryItem.KIND_FACT_CANDIDATE -> "javaslat, még nem döntött róla: ";
            case ChatMemoryItem.KIND_KNOWLEDGE_FACT -> "megjegyezve, {{NÉV}} jóváhagyta: ";
            default -> "megjegyezve: ";
        };
    }
```

`ChatService.memoryBlocks` → `return peopleBlock + chatMemoryBlocks.conversationBlock(userId, conversation.getId()) + chatMemoryBlocks.forgetBlock(userId, forgotten);`

- [ ] **Step 6: Run — expect PASS**, then the wider prompt suites

```bash
cd backend && set -o pipefail && ./mvnw test -Dtest='ChatServiceIT,ConversationFirstIT,KnowledgeFactServiceIT,ChatMemoryBlocksIT,ChatForgetTurnIT,ProfilePromptAssemblerIT,PromptOrder*,ChatServiceGearIT,ActionClaim*' -Dmezo.test.use-testcontainers=true 2>&1 | tail -12
```
Expected: `BUILD SUCCESS`.

- [ ] **Step 7: Commit**

```bash
git add backend/src
git commit -m "feat(companion): the chat describes its memory honestly and lists what it learned (mezo-d6ivw.12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Person-fact extraction — looser prompt, TextFold names, per-person cap

**Files:**
- Modify: `companion/service/PersonFactExtractionService.java:25-53,117-132`, `people/service/PersonFactService.java:55,72-80`
- Test: `feature/companion/PersonFactExtractionServiceIT.java`, `feature/people/PersonFactServiceIT.java:126-139`

**Interfaces:**
- Produces: `PersonFactService.MAX_FACTS_PER_PERSON_PER_SOURCE = 3`, `PersonFactService.MAX_FACTS_PER_SOURCE = 15` (package-visible constants); `PersonFactExtractionService.EXTRACTION_PROMPT` (package-visible) with the loosened rule.

- [ ] **Step 1: Failing tests**

`PersonFactServiceIT` — replace `testCapture_shouldCapPerSource` with:

```java
    @Test
    void testCapture_shouldCapPerPersonPerSource_andAtFifteenOverall() {
        UUID userId = databasePopulator.populateUser("pf-cap@test.local");
        List<PersonFactService.PersonFactCapture> proposals = new java.util.ArrayList<>();
        PersonEntity first = null;
        for (int p = 1; p <= 6; p++) {
            PersonEntity person = personPopulator.createPerson(userId, "Személy" + p);
            if (first == null) first = person;
            for (int f = 1; f <= 4; f++) {
                proposals.add(cap(person.getId(), PersonFactEntity.KIND_PREFERENCE, "tény " + p + "-" + f));
            }
        }

        List<PersonFactEntity> saved = personFactService.capture(userId,
            PersonFactEntity.SOURCE_NIGHTLY_DAY, "2026-09-27", proposals);

        assertThat(saved).hasSize(15);
        UUID firstId = first.getId();
        assertThat(saved).filteredOn(f -> f.getPersonId().equals(firstId)).hasSize(3);
    }
```

`PersonFactExtractionServiceIT` — add:

```java
    /** S8 eval fixture — the 09-26 shape, PARAPHRASED (never real text): an emotional retelling
     *  that still states stable relationship facts. The fake returns what a working extractor
     *  should; the IT pins resolution (TextFold: "Dori" → Dóri) and that ≥ 1 fact lands. The prompt
     *  loosening itself is checked by the manual prod call after deploy (Task 16). */
    @Test
    void testExtractFromTurn_shouldKeepStableFactsFromAnEmotionalRetelling_andFoldNames() {
        UUID userId = databasePopulator.populateUser("pfx-s8-eval@test.local");
        PersonEntity dori = personPopulator.createPerson(userId, "Dóri");
        personPopulator.createPerson(userId, "Bence");
        String retelling = """
                Megnyertük ma a strandröpi-tornát Dórival és Bencével, tavasz óta Dóri a párom a
                pályán. Aztán mindenki hazament, én meg itt ülök egyedül, furcsa ez a csend.
                Bence mondta, hogy jövőre szívesen játszana velünk.
                [fake-person-facts:[{"name":"Dori","kind":"relationship_state","fact":"tavasz óta a strandröpi-párod","confidence":"high"},{"name":"BENCE","kind":"shared_activity","fact":"jövőre is együtt játszanátok","confidence":"medium"}]]""";

        int persisted = extractionService.extractFromTurn(userId, UUID.randomUUID(), retelling, "Gratulálok!");

        assertThat(persisted).isGreaterThanOrEqualTo(1);
        assertThat(factsOf(userId, dori.getId())).extracting(PersonFactEntity::getFactText)
                .containsExactly("tavasz óta a strandröpi-párod");
    }

    @Test
    void testExtractionPrompt_shouldCountStableStatesAndRecurringPatterns_insideEmotionalTalk() {
        String prompt = PersonFactExtractionService.EXTRACTION_PROMPT;
        assertThat(prompt).contains("ismétlődő minta").contains("érzelmes")
                .doesNotContain("bizonytalan egyezésnél hagyd ki");
    }
```

Run: `cd backend && ./mvnw test -Dtest='PersonFactServiceIT,PersonFactExtractionServiceIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -15` → FAIL (cap 3 total; "Dori" unresolved; prompt text).

- [ ] **Step 2: Per-person cap**

`PersonFactService`:

```java
    /** S8 (mezo-d6ivw.12): the nightly run is ONE source (nightly_day/date) — a per-source cap of 3
     *  kept 3 of 5 people's facts from a single sentence. Now 3 per person per source, 15 overall. */
    static final int MAX_FACTS_PER_PERSON_PER_SOURCE = 3;
    static final int MAX_FACTS_PER_SOURCE = 15;
```
(remove `MAX_FACTS_PER_SOURCE = 3`). In `capture`, replace the loop head:

```java
        List<PersonFactEntity> saved = new ArrayList<>();
        Map<UUID, Integer> perPerson = new java.util.HashMap<>();
        for (PersonFactCapture c : captures) {
            if (saved.size() >= MAX_FACTS_PER_SOURCE) {
                break;
            }
            if (c.personId() != null && perPerson.getOrDefault(c.personId(), 0) >= MAX_FACTS_PER_PERSON_PER_SOURCE) {
                continue;
            }
```
and after `saved.add(personFactRepository.saveAndFlush(fact));` add `perPerson.merge(c.personId(), 1, Integer::sum);`. Update the javadoc of `capture` ("forrásonként … plafon" → "személyenként és forrásonként 3, forrásonként összesen 15").

- [ ] **Step 3: Loosened prompt + TextFold**

`PersonFactExtractionService.EXTRACTION_PROMPT`:

```java
    static final String EXTRACTION_PROMPT = """
            SZEMÉLYTÉNY. A beszélgetés-fordulóból gyűjtsd ki az ISMERT SZEMÉLYEKRŐL szóló tartós tényeket
            — kizárólag azt, amit {{NÉV}} maga állított. NEM {{NÉV}}-ről: róla más gyűjtő gondoskodik.
            Fajták: preference (mit szeret/nem szeret), relationship_state (a kapcsolat mostani állapota),
            shared_activity (közös, ismétlődő tevékenység), important_date (fontos dátum),
            sensitivity (mire érzékeny, mivel bánj óvatosan).
            Tartós tény egy stabil kapcsolati állapot vagy egy ismétlődő minta is („tavasz óta a párom
            a pályán", „hétköznap ritkán ér rá") — akkor is, ha egy érzelmes, személyes történet
            közben hangzik el. Egy tisztán egyszeri eseményt („tegnap felhívott"), kérdést vagy
            feltételezést NE vegyél fel.
            Csak az ISMERT SZEMÉLYEK listáján szereplő nevekhez írj tényt, és a nevet úgy add vissza,
            ahogy a listán szerepel.
            Válaszolj KIZÁRÓLAG egy JSON tömbbel, magyarázat nélkül, pontosan ebben a formában:
            [{"name":"...","kind":"preference","fact":"...","confidence":"low|medium|high"}]
            Ha nincs ilyen tény: []""";
```

`resolve(...)` (drop the `HU` locale constant and `java.util.Locale` import; import `io.mrkuhne.mezo.techcore.text.TextFold`):

```java
    /** Pontosan EGY aktív személyre illeszkedő név (név vagy alias, TextFold: kisbetű + ékezet
     *  nélkül — „Dori" = „Dóri") — különben eldobás. S8 óta ugyanaz a szabály, mint az éjszakai
     *  {@code PersonExtractionService.validFacts}-é. */
    private static PersonFactService.PersonFactCapture resolve(
            List<PersonFactService.KnownPerson> known, ExtractedPersonFact f) {
        if (f.name() == null || f.fact() == null || !PersonFactEntity.KINDS.contains(f.kind())) {
            return null;
        }
        String needle = TextFold.fold(f.name().strip());
        List<PersonFactService.KnownPerson> matches = known.stream()
                .filter(p -> TextFold.fold(p.name()).equals(needle)
                        || p.aliases().stream().anyMatch(a -> TextFold.fold(a).equals(needle)))
                .toList();
        if (matches.size() != 1) {
            return null; // 0 = ismeretlen név (jelölt-út dolga), 2+ = kétértelmű — sosem találgatunk
        }
        return new PersonFactService.PersonFactCapture(
                matches.getFirst().id(), f.kind(), f.fact(), f.confidence());
    }
```
Also fix the class javadoc's "(hu-fold, kisbetűs egyezés)" → "(TextFold: kisbetű + ékezet nélkül)".

- [ ] **Step 4: Run — expect PASS** (incl. the nightly extractor, which calls `capture`)

```bash
cd backend && set -o pipefail && ./mvnw test -Dtest='PersonFactServiceIT,PersonFactExtractionServiceIT,PersonExtractionServiceIT,PersonFactControllerIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add backend/src
git commit -m "feat(people): per-person nightly fact cap, TextFold names, looser person-fact prompt (mezo-d6ivw.12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: `FactTextComposer` — confirmed observations become full sentences

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/FactTextComposer.java`
- Modify: `companion/service/PatternService.java:224-231` (`promote`)
- Test: create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/FactTextComposerTest.java`; extend `service/PatternServiceConfirmIT.java`

**Interfaces:**
- Produces: `public static String FactTextComposer.compose(String kind, String title, String mechanism)`; `FactTextComposer.MAX_CHARS = 500`, `PAIR_MAX_CHARS = 280`.

- [ ] **Step 1: Failing unit table**

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import org.junit.jupiter.api.Test;

/** S8 (mezo-d6ivw.12): the prompt-ready sentence of a confirmed observation. */
class FactTextComposerTest {

    private static final String TITLE = "Rövid alvás → gyengébb edzés";

    @Test
    void compose_shouldKeepTheTitle_whenMechanismIsNullOrBlank() {
        assertThat(FactTextComposer.compose(PatternEntity.KIND_REFLECTION, TITLE, null)).isEqualTo(TITLE);
        assertThat(FactTextComposer.compose(PatternEntity.KIND_REFLECTION, TITLE, "   ")).isEqualTo(TITLE);
    }

    @Test
    void compose_shouldKeepTheTitle_forStatisticalBoilerplate() {
        assertThat(FactTextComposer.compose(PatternEntity.KIND_STATISTICAL, TITLE,
                "r = 0,41, n = 23 nap: az alvás és az edzés-RPE együtt mozog.")).isEqualTo(TITLE);
    }

    @Test
    void compose_shouldTakeTheFirstTwoSentences_whenTheyStayShort() {
        String mechanism = "Ha 6 óra alatt alszol, másnap nehezebbnek érzed az edzést.  Ilyenkor a súlyok "
                + "is lassabban mennek. Harmadik mondat, ami már nem kell.";
        assertThat(FactTextComposer.compose(PatternEntity.KIND_REFLECTION, TITLE, mechanism))
                .isEqualTo("Ha 6 óra alatt alszol, másnap nehezebbnek érzed az edzést. Ilyenkor a súlyok is lassabban mennek.");
    }

    @Test
    void compose_shouldTakeOnlyTheFirstSentence_whenThePairIsLong() {
        String first = "Első mondat " + "nagyon ".repeat(30) + "hosszú.";
        String mechanism = first + " Második mondat " + "szintén ".repeat(20) + "hosszú.";
        assertThat(FactTextComposer.compose(PatternEntity.KIND_AI_HYPOTHESIS, TITLE, mechanism)).isEqualTo(first);
    }

    @Test
    void compose_shouldCapAt500_onAWordBoundaryWithEllipsis() {
        String mechanism = "szó ".repeat(200).strip() + ".";
        String composed = FactTextComposer.compose(PatternEntity.KIND_REFLECTION, TITLE, mechanism);
        assertThat(composed).hasSizeLessThanOrEqualTo(500).endsWith("…").doesNotContain("  ");
        assertThat(composed.substring(0, composed.length() - 1)).endsWith("szó");
    }
}
```

`PatternServiceConfirmIT` — add:

```java
    @Test
    void testApplyUserConfirm_shouldWriteTheMechanismSentence_notTheTitle() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_MONITORING);

        patternService.applyUserConfirm(owner, row);
        patternRepository.saveAndFlush(row);

        KnowledgeFactEntity fact = knowledgeFactRepository
                .findById(patternRepository.findById(row.getId()).orElseThrow().getPromotedFactId()).orElseThrow();
        assertThat(fact.getFactText()).isEqualTo("Reflexió S2 teszt, terv nélkül.");
    }

    @Test
    void testApplyUserConfirm_shouldKeepTheTitle_forAStatisticalRow() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.createPattern(owner, "pair-stat-" + UUID.randomUUID(), "Statisztikai cím");

        patternService.applyUserConfirm(owner, row);
        patternRepository.saveAndFlush(row);

        KnowledgeFactEntity fact = knowledgeFactRepository
                .findById(patternRepository.findById(row.getId()).orElseThrow().getPromotedFactId()).orElseThrow();
        assertThat(fact.getFactText()).isEqualTo("Statisztikai cím");
    }
```

Run: `cd backend && ./mvnw test -Dtest='FactTextComposerTest,PatternServiceConfirmIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -12` → compile failure / FAIL.

- [ ] **Step 2: Implement**

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import java.util.regex.Pattern;

/**
 * S8 (mezo-d6ivw.12): a confirmed observation becomes a prompt-ready SENTENCE, not its title. The
 * mechanism carries the meaning (LLM text, a Q&A answer, or deterministic statistics); a
 * statistical row's mechanism is boilerplate ("r = …, n = …"), so those keep the title. Pure.
 * Capped at {@value #MAX_CHARS} — the knowledge fact edit cap ({@code UpdateFactRequest.factText}).
 */
public final class FactTextComposer {

    static final int MAX_CHARS = 500;
    /** The second sentence joins only while the pair stays this short. */
    static final int PAIR_MAX_CHARS = 280;
    private static final Pattern SENTENCE_END = Pattern.compile("(?<=[.!?…])\\s+");

    private FactTextComposer() {
    }

    public static String compose(String kind, String title, String mechanism) {
        if (PatternEntity.KIND_STATISTICAL.equals(kind) || mechanism == null || mechanism.isBlank()) {
            return title;
        }
        String[] sentences = SENTENCE_END.split(mechanism.strip().replaceAll("\\s+", " "));
        String text = sentences[0];
        if (sentences.length > 1 && text.length() + 1 + sentences[1].length() <= PAIR_MAX_CHARS) {
            text = text + " " + sentences[1];
        }
        return text.length() <= MAX_CHARS ? text : cut(text);
    }

    private static String cut(String text) {
        int limit = MAX_CHARS - 1;
        int space = text.lastIndexOf(' ', limit);
        return text.substring(0, space > 0 ? space : limit).stripTrailing() + "…";
    }
}
```

`PatternService.promote`: `fact.setFactText(FactTextComposer.compose(pattern.getKind(), pattern.getTitle(), pattern.getMechanism()));` — javadoc line: "S8: the fact text is the mechanism sentence (FactTextComposer); the veto key follows the new text automatically (ForgetService keys on fact_text), the pattern-id veto still guards re-minting."

- [ ] **Step 3: Run — expect PASS**, plus every promote consumer

```bash
cd backend && set -o pipefail && ./mvnw test -Dtest='FactTextComposerTest,PatternService*,KnowledgeRecheck*,QuickNotice*,ForgetServiceIT,TeamChatReplyIT,GraphPromotion*' -Dmezo.test.use-testcontainers=true 2>&1 | tail -12
```
Expected: `BUILD SUCCESS`. Any failure asserting `factText == title` for a reflection/hypothesis row is a test pinning the old behaviour — update its expected value to the mechanism's first sentence (never weaken to `isNotNull`).

- [ ] **Step 4: Commit**

```bash
git add backend/src
git commit -m "feat(companion): confirmed observations promote as full sentences (mezo-d6ivw.12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Backfill — dry-run first, apply only on the owner's OK

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/FactTextBackfillService.java`, `FactTextBackfillRunner.java`
- Modify: `backend/src/main/resources/application.yml` (`mezo.companion.fact-text-backfill.mode: "off"`)
- Test: create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/FactTextBackfillServiceIT.java`

**Interfaces:**
- Consumes: `FactTextComposer.compose` (Task 10), `UserFanOut.forEachActiveUser` (`feature.auth.service`).
- Produces: `record FactTextBackfillService.Change(UUID factId, UUID patternId, String before, String after, boolean muted)`; `List<Change> plan(UUID userId)`; `List<Change> apply(UUID userId)`; `int FactTextBackfillRunner.execute(String mode)`.

- [ ] **Step 1: Failing IT**

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/** S8 (mezo-d6ivw.12): title-only facts become sentences — dry-run lists, apply rewrites, mute stays. */
@ActiveProfiles("companion-fake")
class FactTextBackfillServiceIT extends AbstractIntegrationTest {

    @Autowired private FactTextBackfillService backfill;
    @Autowired private FactTextBackfillRunner runner;
    @Autowired private PatternService patternService;
    @Autowired private PatternRepository patternRepository;
    @Autowired private KnowledgeFactRepository factRepository;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;

    /** A confirmed reflection row whose fact is reset to the pre-S8 title-only text. */
    private KnowledgeFactEntity legacyFact(UUID owner, String mechanism) {
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_MONITORING);
        row.setMechanism(mechanism);
        patternPopulator.save(row);
        patternService.applyUserConfirm(owner, row);
        patternRepository.saveAndFlush(row);
        KnowledgeFactEntity fact = factRepository.findById(row.getPromotedFactId()).orElseThrow();
        fact.setFactText(row.getTitle());
        return factRepository.saveAndFlush(fact);
    }

    @Test
    void testPlanThenApply_shouldRewriteTitleOnlyFacts_keepMute_andBeIdempotent() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity live = legacyFact(owner, "Esti képernyő után később alszol el. Második mondat.");
        KnowledgeFactEntity muted = legacyFact(owner, "Kávé délután rontja az alvást.");
        muted.mute(KnowledgeFactEntity.MUTED_USER, Instant.now());
        factRepository.saveAndFlush(muted);
        PatternEntity stat = patternPopulator.createPattern(owner, "pair-stat-" + UUID.randomUUID(), "Stat cím");
        patternService.applyUserConfirm(owner, stat);
        patternRepository.saveAndFlush(stat);

        List<FactTextBackfillService.Change> plan = backfill.plan(owner);

        assertThat(plan).extracting(FactTextBackfillService.Change::after).containsExactlyInAnyOrder(
                "Esti képernyő után később alszol el. Második mondat.", "Kávé délután rontja az alvást.");
        assertThat(factRepository.findById(live.getId()).orElseThrow().getFactText())
                .isEqualTo("Teszt: terv nélküli észrevétel"); // dry-run writes nothing

        backfill.apply(owner);

        assertThat(factRepository.findById(live.getId()).orElseThrow().getFactText())
                .isEqualTo("Esti képernyő után később alszol el. Második mondat.");
        KnowledgeFactEntity mutedAfter = factRepository.findById(muted.getId()).orElseThrow();
        assertThat(mutedAfter.getFactText()).isEqualTo("Kávé délután rontja az alvást.");
        assertThat(mutedAfter.isIncludeInPrompt()).isFalse();
        assertThat(mutedAfter.getMutedReason()).isEqualTo(KnowledgeFactEntity.MUTED_USER);
        assertThat(backfill.plan(owner)).isEmpty();
    }

    @Test
    void testRunner_shouldDoNothing_whenModeIsOff() {
        assertThat(runner.execute("off")).isZero();
    }
}
```

Run: `cd backend && ./mvnw test -Dtest='FactTextBackfillServiceIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -10` → compile failure.

- [ ] **Step 2: Implement the service**

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * S8 (mezo-d6ivw.12): the one-shot rewrite of pre-S8 pattern facts whose text is still their
 * promoting pattern's TITLE. Not a Liquibase changeset — the data is user-specific and the owner
 * sees the before/after list first. {@link #plan} is the dry-run; {@link #apply} rewrites only
 * what {@link #plan} lists, publishes {@link KnowledgeFactChangedEvent} per row (graph + RAG
 * resync) and never touches the mute state. Deleted (forgotten) facts are not read at all.
 * Idempotent: an applied row no longer equals its title.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FactTextBackfillService {

    public record Change(UUID factId, UUID patternId, String before, String after, boolean muted) {}

    private final KnowledgeFactRepository factRepository;
    private final PatternRepository patternRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public List<Change> plan(UUID userId) {
        Map<UUID, PatternEntity> byFact = patternRepository.findByCreatedByAndPromotedFactIdIsNotNullAndDeletedFalse(userId)
                .stream().collect(Collectors.toMap(PatternEntity::getPromotedFactId, p -> p, (a, b) -> a));
        List<Change> changes = new ArrayList<>();
        for (KnowledgeFactEntity fact : factRepository.findByCreatedByAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(userId)) {
            PatternEntity pattern = promotingPattern(userId, fact, byFact);
            if (pattern == null || !fact.getFactText().equals(pattern.getTitle())) {
                continue;
            }
            String after = FactTextComposer.compose(pattern.getKind(), pattern.getTitle(), pattern.getMechanism());
            if (!after.equals(fact.getFactText())) {
                changes.add(new Change(fact.getId(), pattern.getId(), fact.getFactText(), after,
                        !fact.isIncludeInPrompt()));
            }
        }
        return changes;
    }

    @Transactional
    public List<Change> apply(UUID userId) {
        List<Change> changes = plan(userId);
        for (Change change : changes) {
            KnowledgeFactEntity fact = factRepository.findByIdAndCreatedByAndDeletedFalse(change.factId(), userId).orElseThrow();
            fact.setFactText(change.after());
            factRepository.save(fact);
            eventPublisher.publishEvent(new KnowledgeFactChangedEvent(userId, fact.getId()));
        }
        return changes;
    }

    private PatternEntity promotingPattern(UUID userId, KnowledgeFactEntity fact, Map<UUID, PatternEntity> byFact) {
        UUID viaEnvelope = fact.getProvenance() == null ? null : fact.getProvenance().patternId();
        if (viaEnvelope != null) {
            PatternEntity row = patternRepository.findByIdAndCreatedByAndDeletedFalse(viaEnvelope, userId).orElse(null);
            if (row != null) {
                return row;
            }
        }
        return byFact.get(fact.getId()); // pre-S2 promotions carry no envelope
    }
}
```

- [ ] **Step 3: Implement the runner + config**

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * S8 (mezo-d6ivw.12): the ops trigger of {@link FactTextBackfillService}. {@code
 * mezo.companion.fact-text-backfill.mode}: {@code off} (default — nothing happens), {@code dry-run}
 * (logs every before/after pair, writes nothing) or {@code apply} (rewrites, logs the same list).
 * Production sets it for ONE deploy through the Deployment env
 * {@code MEZO_COMPANION_FACTTEXTBACKFILL_MODE} and removes it afterwards; {@code apply} needs the
 * owner's explicit OK on the dry-run list (CLAUDE.md §Production database access).
 */
@Slf4j
@Component
@Order(300)
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FactTextBackfillRunner implements CommandLineRunner {

    static final String MODE_DRY_RUN = "dry-run";
    static final String MODE_APPLY = "apply";

    private final FactTextBackfillService service;
    private final UserFanOut userFanOut;

    @Value("${mezo.companion.fact-text-backfill.mode:off}")
    private String mode;

    @Override
    public void run(String... args) {
        execute(mode);
    }

    public int execute(String requestedMode) {
        if (!MODE_DRY_RUN.equals(requestedMode) && !MODE_APPLY.equals(requestedMode)) {
            return 0;
        }
        boolean apply = MODE_APPLY.equals(requestedMode);
        AtomicInteger total = new AtomicInteger();
        userFanOut.forEachActiveUser("fact-text-backfill", user -> {
            List<FactTextBackfillService.Change> changes = apply ? service.apply(user.getId()) : service.plan(user.getId());
            changes.forEach(c -> log.info("fact-text-backfill [%s] user=%s fact=%s muted=%s%n  ELŐTTE: %s%n  UTÁNA:  %s"
                    .formatted(requestedMode, user.getId(), c.factId(), c.muted(), c.before(), c.after())));
            total.addAndGet(changes.size());
        });
        log.info("fact-text-backfill [{}] done — {} row(s) {}", requestedMode, total.get(),
                apply ? "rewritten" : "would change");
        return total.get();
    }
}
```

`application.yml` (under `mezo.companion`):

```yaml
    # S8 (mezo-d6ivw.12): one-shot rewrite of title-only pattern facts into full sentences.
    # "off" | dry-run | apply — QUOTED: a bare off is YAML boolean false. Prod flips it for one
    # deploy via MEZO_COMPANION_FACTTEXTBACKFILL_MODE; apply only after the owner's OK.
    fact-text-backfill:
      mode: "off"
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd backend && set -o pipefail && ./mvnw test -Dtest='FactTextBackfillServiceIT' -Dmezo.test.use-testcontainers=true 2>&1 | tail -8
```

- [ ] **Step 5: Commit**

```bash
git add backend/src
git commit -m "feat(companion): dry-run/apply backfill for title-only pattern facts (mezo-d6ivw.12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 12: FE — the one shared `MemoryChip`; S7's csapatfal chip switches over with no visible change

**Files:**
- Create: `frontend/src/features/insights/components/memory/MemoryChip.tsx`, `MemoryChip.test.tsx`
- Modify: `frontend/src/features/insights/components/teamchat/ReplyAfterlife.tsx:51-100` (`RememberedChip`)
- Modify: `frontend/src/styles/prototype.css` (new S8 block after the S3 `.mzc-remundo` rule, ~line 4383)
- Test: `frontend/src/features/insights/components/teamchat/ReplyAfterlife.test.tsx` (must pass unchanged), `frontend/tests/layout/team-chat-reply.spec.ts` (unchanged)

**Interfaces:**
- Produces:
  - `interface MemoryLine { who?: string | null; text: string }`, `memoryLabel(m: MemoryLine): string` (`"Dóri — text"` / `"text"`)
  - `MemoryChip(props: MemoryChipProps)` where
    - `{ variant: 'remembered'; surface?: 'chat' | 'csapatfal'; item: MemoryLine; sub?: string; sensitive?: boolean; done?: boolean; undoneText?: string; forgotten?: boolean; delay?: number; onUndo: () => Promise<void> }`
    - `{ variant: 'proposed'; item: MemoryLine; forgotten?: boolean; delay?: number; onAccept: () => Promise<void>; onReject: () => Promise<void> }`
    - `{ variant: 'recalled'; names: string[]; onOpen: () => void }`
    - `{ variant: 'forgotten'; items: MemoryLine[]; canWiden: boolean; delay?: number; onWiden: () => void }`
  - `RememberedChip({ thread, onUndo })` — public API unchanged.

- [ ] **Step 1: Read the house FE rules** — `docs/references/frontend_conventions.md` (AGENTS.md trigger), then the prototype's S8 CSS block (`docs/design_2.0/prototypes/elo/mezo.html`, `/* ══ S8 ·` … `.sheet .u8 .s8who …`) and JS `s8chip`/`s8gone`/`s8rec`.

- [ ] **Step 2: Failing component test** — `MemoryChip.test.tsx`

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryChip, memoryLabel } from '@/features/insights/components/memory/MemoryChip'

/** S8 (mezo-d6ivw.12): four variants, each with busy / error / done (lesson 33: gate on the artefact). */
describe('MemoryChip', () => {
  test('remembered (chat): who — text, undo → done line; a failed undo keeps the chip and says so', async () => {
    let fail = true
    const onUndo = vi.fn(async () => { if (fail) throw new Error('x') })
    render(<MemoryChip variant="remembered" item={{ who: 'Dóri', text: 'a strandröpi-párod' }} onUndo={onUndo} />)
    expect(screen.getByText('Megjegyeztem:')).toBeInTheDocument()
    expect(screen.getByText('Dóri')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Visszavonom' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nem sikerült visszavonni — próbáld újra.')
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Visszavonom' }))
    expect(await screen.findByText('Visszavonva — nem jegyeztem meg.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Visszavonom' })).not.toBeInTheDocument()
  })

  test('remembered: the sensitivity pill and the kept sub-line', () => {
    render(<MemoryChip variant="remembered" item={{ text: 'x' }} sensitive sub="a Tudástár Rólad részében látod" onUndo={vi.fn()} />)
    expect(screen.getByText('érzékeny')).toBeInTheDocument()
    expect(screen.getByText('a Tudástár Rólad részében látod')).toBeInTheDocument()
  })

  test('remembered/proposed: a forgotten item renders the struck Elfelejtve line', () => {
    render(<MemoryChip variant="proposed" item={{ text: 'nehéz egyedül' }} forgotten onAccept={vi.fn()} onReject={vi.fn()} />)
    expect(screen.getByText(/Elfelejtve ·/)).toBeInTheDocument()
    expect(screen.getByText('nehéz egyedül').tagName).toBe('S')
  })

  test('proposed: Igen/Ne with the sub-line; Ne → the no-repropose line; buttons lock while busy', async () => {
    let release!: () => void
    const onReject = vi.fn(() => new Promise<void>((r) => { release = r }))
    render(<MemoryChip variant="proposed" item={{ text: 'nehéz egyedül' }} onAccept={vi.fn()} onReject={onReject} />)
    expect(screen.getByText('Megjegyezném:')).toBeInTheDocument()
    expect(screen.getByText('rólad szól, ezért előbb megkérdezlek')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ne' }))
    expect(screen.getByRole('button', { name: 'Igen' })).toBeDisabled()
    release()
    expect(await screen.findByText('Rendben, nem jegyzem meg — és nem is javaslom újra.')).toBeInTheDocument()
  })

  test('recalled: Emlékszem with the names, tap opens', async () => {
    const onOpen = vi.fn()
    render(<MemoryChip variant="recalled" names={['Dóri', 'Bence']} onOpen={onOpen} />)
    expect(screen.getByText('Dóri · Bence')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mit vettem elő róluk' }))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  test('forgotten: the list, the permanence note, and the widen offer only when there is more', () => {
    const { rerender } = render(<MemoryChip variant="forgotten" items={[{ who: 'Anna', text: 'régi csapattársad' }]} canWiden onWiden={vi.fn()} />)
    expect(screen.getByText('Elfelejtettem:')).toBeInTheDocument()
    expect(screen.getByText('Anna — régi csapattársad')).toBeInTheDocument()
    expect(screen.getByText('végleg — ezeket többé nem használom, és nem is tanulom meg újra')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mindent ebből a beszélgetésből?' })).toBeInTheDocument()
    rerender(<MemoryChip variant="forgotten" items={[{ text: 'x' }]} canWiden={false} onWiden={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Mindent ebből a beszélgetésből?' })).not.toBeInTheDocument()
  })

  test('csapatfal surface keeps the S7 DOM: link-style undo, tf-remgone done line', async () => {
    const { container } = render(<MemoryChip variant="remembered" surface="csapatfal" item={{ text: 'meccsnap' }}
      undoneText="Visszavonva — nem jegyeztem meg, és az ügy újra nyitott." onUndo={async () => {}} />)
    expect(container.querySelector('.mzc-remwrap .mzc-remchip .mzc-remundo')).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Visszavonom' }))
    await waitFor(() => expect(container.querySelector('p.tf-remgone')).toHaveTextContent('az ügy újra nyitott'))
  })

  test('memoryLabel joins who and text with an em dash', () => {
    expect(memoryLabel({ who: 'Bence', text: 'szervez' })).toBe('Bence — szervez')
    expect(memoryLabel({ text: 'rólad' })).toBe('rólad')
  })
})
```

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm vitest run src/features/insights/components/memory/MemoryChip.test.tsx` → FAIL (module missing).

- [ ] **Step 3: Implement `MemoryChip.tsx`**

```tsx
import { useState } from 'react'
import { Icon3D } from '@/shared/ui/clay'

/**
 * S8 (mezo-d6ivw.12) — the ONE memory chip of the chat and the csapatfal, extracted from S7's
 * `RememberedChip` (ReplyAfterlife.tsx). Four variants on one flat-pill shape (üveg: outside the
 * answer card, never glass in glass): remembered (t-spark · Megjegyeztem · Visszavonom), proposed
 * (t-bulb · Megjegyezném · Igen / Ne), recalled (t-people · Emlékszem: names ›) and forgotten
 * (t-eraser · Elfelejtettem: list · Mindent ebből a beszélgetésből?). Every action has busy /
 * error / done states, and the done state is gated on the artefact, not on the parent's status
 * (lesson 33). `surface="csapatfal"` renders S7's exact DOM (`mzc-remchip` / `tf-remgone`), so the
 * team-chat reply does not change visually. Source: docs/design_2.0/prototypes/elo/mezo.html „S8 ·".
 */
export interface MemoryLine { who?: string | null; text: string }

export const memoryLabel = (m: MemoryLine) => (m.who ? `${m.who} — ${m.text}` : m.text)

type Phase = 'idle' | 'busy' | 'error' | 'done'

function useChipAction() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [outcome, setOutcome] = useState<string | null>(null)
  const run = async (fn: () => Promise<unknown>, as: string) => {
    setPhase('busy')
    try {
      await fn()
      setOutcome(as)
      setPhase('done')
    } catch {
      setPhase('error')
    }
  }
  return { phase, outcome, run }
}

const UNDONE = 'Visszavonva — nem jegyeztem meg.'
const delayStyle = (delay?: number) => ({ ['--d' as string]: `${delay ?? 0}s` })

export type MemoryChipProps =
  | { variant: 'remembered'; surface?: 'chat' | 'csapatfal'; item: MemoryLine; sub?: string; sensitive?: boolean
      done?: boolean; undoneText?: string; forgotten?: boolean; delay?: number; onUndo: () => Promise<void> }
  | { variant: 'proposed'; item: MemoryLine; forgotten?: boolean; delay?: number
      onAccept: () => Promise<void>; onReject: () => Promise<void> }
  | { variant: 'recalled'; names: string[]; onOpen: () => void }
  | { variant: 'forgotten'; items: MemoryLine[]; canWiden: boolean; delay?: number; onWiden: () => void }

export function MemoryChip(props: MemoryChipProps) {
  switch (props.variant) {
    case 'remembered': return <Remembered {...props} />
    case 'proposed': return <Proposed {...props} />
    case 'recalled': return <Recalled {...props} />
    case 'forgotten': return <Forgotten {...props} />
  }
}

function ForgottenLine({ item }: { item: MemoryLine }) {
  return (
    <p className="mzc-memdone">
      <Icon3D name="t-eraser" size={16} />
      <span>Elfelejtve · <s>{memoryLabel(item)}</s></span>
    </p>
  )
}

function Remembered({ surface = 'chat', item, sub, sensitive, done, undoneText = UNDONE, forgotten, delay, onUndo }:
  Extract<MemoryChipProps, { variant: 'remembered' }>) {
  const { phase, run } = useChipAction()
  if (forgotten) return <ForgottenLine item={item} />
  if (done || phase === 'done') {
    return surface === 'csapatfal'
      ? <p className="tf-remgone">{undoneText}</p>
      : <p className="mzc-memdone"><Icon3D name="t-spark" size={16} />{undoneText}</p>
  }
  const busy = phase === 'busy'
  const undo = () => void run(onUndo, 'undone')
  if (surface === 'csapatfal') {
    return (
      <div className="mzc-remwrap col gap-xs">
        <div className="mzc-remchip row gap-xs">
          <Icon3D name="t-spark" size={18} />
          <span className="mzc-remtx"><b>Megjegyeztem:</b> {item.text}</span>
          <button type="button" className="mzc-remundo" disabled={busy} onClick={undo}>Visszavonom</button>
        </div>
        {phase === 'error' && <p className="tf-error" role="alert">Nem sikerült visszavonni — próbáld újra.</p>}
      </div>
    )
  }
  return (
    <>
      <div className="mzc-memchip is-remembered" style={delayStyle(delay)}>
        <Icon3D name="t-spark" size={20} />
        <span className="mzc-memtx">
          <b>Megjegyeztem:</b> {item.who && <><b>{item.who}</b> — </>}{item.text}
          {sensitive && <span className="mzc-remsens">érzékeny</span>}
          {sub && <small>{sub}</small>}
        </span>
        <span className="mzc-memacts">
          <button type="button" className="mzc-mbtn is-ghost" disabled={busy} onClick={undo}>Visszavonom</button>
        </span>
      </div>
      {phase === 'error' && <p className="mzc-memerr" role="alert">Nem sikerült visszavonni — próbáld újra.</p>}
    </>
  )
}

function Proposed({ item, forgotten, delay, onAccept, onReject }: Extract<MemoryChipProps, { variant: 'proposed' }>) {
  const { phase, outcome, run } = useChipAction()
  if (forgotten) return <ForgottenLine item={item} />
  if (phase === 'done' && outcome === 'rejected') {
    return <p className="mzc-memdone"><Icon3D name="t-bulb" size={16} />Rendben, nem jegyzem meg — és nem is javaslom újra.</p>
  }
  // accepted: the parent swaps this chip for the "Megjegyeztem" one once the kept state lands
  const busy = phase === 'busy' || outcome === 'accepted'
  return (
    <>
      <div className="mzc-memchip is-proposed" style={delayStyle(delay)}>
        <Icon3D name="t-bulb" size={20} />
        <span className="mzc-memtx">
          <b>Megjegyezném:</b> {item.text}
          <small>rólad szól, ezért előbb megkérdezlek</small>
        </span>
        <span className="mzc-memacts">
          <button type="button" className="mzc-mbtn" disabled={busy} onClick={() => void run(onAccept, 'accepted')}>Igen</button>
          <button type="button" className="mzc-mbtn is-ghost" disabled={busy} onClick={() => void run(onReject, 'rejected')}>Ne</button>
        </span>
      </div>
      {phase === 'error' && <p className="mzc-memerr" role="alert">Nem sikerült — próbáld újra.</p>}
    </>
  )
}

function Recalled({ names, onOpen }: Extract<MemoryChipProps, { variant: 'recalled' }>) {
  return (
    <button type="button" className="mzc-memrec" onClick={onOpen} aria-label="Mit vettem elő róluk">
      <Icon3D name="t-people" size={20} />
      <span>Emlékszem: <b>{names.join(' · ')}</b></span>
      <em aria-hidden="true">›</em>
    </button>
  )
}

function Forgotten({ items, canWiden, delay, onWiden }: Extract<MemoryChipProps, { variant: 'forgotten' }>) {
  return (
    <div className="mzc-memchip is-forgotten" style={delayStyle(delay)}>
      <Icon3D name="t-eraser" size={20} />
      <span className="mzc-memtx">
        <b>Elfelejtettem:</b>
        <ul>{items.map((i, n) => <li key={`${n}-${memoryLabel(i)}`}>{memoryLabel(i)}</li>)}</ul>
        <small>végleg — ezeket többé nem használom, és nem is tanulom meg újra</small>
        {canWiden && <button type="button" className="mzc-mbtn" onClick={onWiden}>Mindent ebből a beszélgetésből?</button>}
      </span>
    </div>
  )
}
```

- [ ] **Step 4: The S8 CSS block** — append after the `.mzc-remundo { … }` rule in `styles/prototype.css` (a 1:1 port of the prototype's `.s8*` block: `--lav→--dv-lav`, `--gold→--dv-amber`, `--rose→--dv-rose`, `--ink→--text-primary`, `--sub→--text-secondary`, `--faint→--text-muted`, `--hair→rgba(245,239,230,.08)`):

```css
/* ══ S8 · a chat memóriája (mezo-d6ivw.12) — négy jelzés egy közös chip-alakon ══
   Paritás-forrás: docs/design_2.0/prototypes/elo/mezo.html „S8 ·" (.s8chip/.s8btn/.s8done/.s8rec/
   .s8who/.s8list/.s8foot). Lapos pirula a válasz-kártyán KÍVÜL — nincs üveg az üvegben; csak sötét.
   A csapatfal (surface="csapatfal") továbbra is az S3/S7 `.mzc-remchip` alakot kapja. */
.mzc-memturn { display: grid; gap: 6px; justify-items: start; margin-top: -6px; }
.mzc-memchip {
  --c: var(--dv-lav);
  display: flex; align-items: center; gap: 8px; max-width: 92%; padding: 7px 8px 7px 9px; border-radius: 14px;
  background: linear-gradient(150deg, rgba(245, 239, 230, 0.035), color-mix(in srgb, var(--c) 10%, rgba(245, 239, 230, 0.02)));
  box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--c) 38%, transparent), 0 0 16px color-mix(in srgb, var(--c) 12%, transparent);
  animation: mzc-memin 0.45s cubic-bezier(0.3, 0.8, 0.4, 1) both; animation-delay: var(--d, 0s);
}
@keyframes mzc-memin { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
.mzc-memchip > :first-child { flex: none; }
.mzc-memtx { flex: 1; min-width: 0; font-size: 12px; line-height: 1.4; color: var(--text-secondary); }
.mzc-memtx b { color: var(--text-primary); font-weight: 650; }
.mzc-memtx small { display: block; margin-top: 2px; font-size: 10.5px; color: var(--text-muted); }
.mzc-memacts { display: flex; gap: 4px; flex: none; align-self: center; }
.mzc-mbtn {
  --c: var(--dv-lav);
  min-height: 30px; padding: 5px 10px; border: none; border-radius: 999px; font: inherit; font-size: 11.5px; font-weight: 650;
  cursor: pointer; color: color-mix(in srgb, var(--c) 80%, var(--text-primary));
  background: color-mix(in srgb, var(--c) 12%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 34%, transparent);
}
.mzc-mbtn.is-ghost { background: none; box-shadow: none; color: var(--text-secondary); }
.mzc-mbtn:disabled { opacity: 0.55; cursor: default; }
.mzc-mbtn:focus-visible { outline: 2px solid color-mix(in srgb, var(--c) 70%, white); outline-offset: 2px; }
.mzc-memchip.is-proposed, .mzc-memchip.is-proposed .mzc-mbtn { --c: var(--dv-amber); }
.mzc-memchip.is-forgotten, .mzc-memchip.is-forgotten .mzc-mbtn { --c: var(--dv-rose); }
.mzc-memchip.is-forgotten { align-items: flex-start; }
.mzc-memchip.is-forgotten > :first-child { margin-top: 1px; }
.mzc-memchip.is-forgotten .mzc-mbtn { margin-top: 8px; }
.mzc-memchip.is-forgotten ul { margin: 4px 0 0; padding: 0; list-style: none; display: grid; gap: 3px; }
.mzc-memchip.is-forgotten li { position: relative; padding-left: 11px; color: var(--text-secondary); }
.mzc-memchip.is-forgotten li::before {
  content: ""; position: absolute; left: 1px; top: 0.62em; width: 5px; height: 1.5px; border-radius: 1px;
  background: color-mix(in srgb, var(--dv-rose) 70%, white);
}
.mzc-memdone { display: flex; align-items: center; gap: 7px; margin: 0; padding: 2px 4px; font-size: 11.5px; color: var(--text-muted); animation: mzc-memin 0.35s both; }
.mzc-memdone > :first-child { opacity: 0.75; flex: none; }
.mzc-memdone s { text-decoration-color: color-mix(in srgb, var(--dv-rose) 60%, transparent); }
.mzc-memerr { margin: 0; padding: 0 4px; font-size: 11px; color: var(--dv-rose); }
.mzc-memrec {
  display: inline-flex; align-self: flex-start; align-items: center; gap: 7px; margin-top: 10px; padding: 5px 10px 5px 6px;
  border: none; border-radius: 999px; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; color: var(--text-secondary);
  background: rgba(245, 239, 230, 0.04); box-shadow: inset 0 0 0 1px rgba(245, 239, 230, 0.08);
}
.mzc-memrec b { color: color-mix(in srgb, var(--dv-lav) 70%, var(--text-primary)); font-weight: 650; }
.mzc-memrec em { font-style: normal; color: var(--text-muted); margin-left: 2px; }
.mzc-memwho { display: grid; gap: 10px; margin-top: 6px; }
.mzc-memwho-p { padding: 12px 14px; border-radius: 16px; background: rgba(245, 239, 230, 0.035); box-shadow: inset 0 0 0 1px rgba(245, 239, 230, 0.08); }
.mzc-memwho-p strong { display: flex; align-items: center; gap: 8px; font-size: 14.5px; }
.mzc-memwho-p ul { margin: 0; padding: 0; list-style: none; }
.mzc-memwho-p li { position: relative; margin-top: 5px; padding-left: 12px; font-size: 13px; line-height: 1.45; color: var(--text-secondary); }
.mzc-memwho-p li::before { content: ""; position: absolute; left: 0; top: 0.6em; width: 5px; height: 5px; border-radius: 50%; background: var(--dv-lav); opacity: 0.7; }
.mzc-memfoot { margin: 12px 0 0; font-size: 12px; line-height: 1.5; color: var(--text-muted); }
.mzc-memlist { margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.mzc-memlist li {
  padding: 9px 12px; border-radius: 12px; font-size: 13.5px; line-height: 1.45; color: var(--text-secondary);
  background: rgba(245, 239, 230, 0.035); box-shadow: inset 0 0 0 1px rgba(245, 239, 230, 0.08);
}
.mzc-memlist li small { display: block; margin-top: 2px; font-size: 11px; color: var(--text-muted); }
.mzc-memrow { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
@media (prefers-reduced-motion: reduce) { .mzc-memchip, .mzc-memdone { animation: none; } }
```

Collision check: `grep -oE "mzc-mem(turn|chip|tx|acts|done|err|rec|who|foot|list|row)|mzc-mbtn" frontend/src/styles/prototype.css | sort | uniq -c` — every name must come only from this block.

- [ ] **Step 5: Switch S7 over** — `ReplyAfterlife.tsx` `RememberedChip` becomes:

```tsx
/** The "Megjegyeztem: …" standing-exception chip — S8 (mezo-d6ivw.12): now the shared
 *  `MemoryChip` on its csapatfal surface (same DOM/classes as before, no visible change). Done
 *  after a local undo or when the thread comes back with `remembered.active === false`; the
 *  reopen clause only while the ügy is actually OPEN again. A STOP-withdrawn exception never
 *  lands here (the server drops it from `remembered`). */
export function RememberedChip({ thread, onUndo }: {
  thread: TeamChatThread
  onUndo: (threadId: string) => Promise<void>
}) {
  const remembered = thread.remembered
  if (remembered == null || thread.closeNote === STOP_CLOSE_NOTE) return null
  return (
    <MemoryChip
      variant="remembered"
      surface="csapatfal"
      item={{ text: remembered.text }}
      done={!remembered.active}
      undoneText={thread.status === 'OPEN'
        ? 'Visszavonva — nem jegyeztem meg, és az ügy újra nyitott.'
        : 'Visszavonva — nem jegyeztem meg.'}
      onUndo={() => onUndo(thread.id)}
    />
  )
}
```
Import `MemoryChip` from `@/features/insights/components/memory/MemoryChip`; drop the now-unused `useState` import.

- [ ] **Step 6: Run — the new test passes, S7 parity untouched**

```bash
cd frontend && set -o pipefail && CI=true VITE_USE_MOCK=true pnpm vitest run src/features/insights/components/memory src/features/insights/components/teamchat 2>&1 | tail -8
CI=true VITE_USE_MOCK=false pnpm vitest run src/features/insights/components/memory src/features/insights/components/teamchat 2>&1 | tail -8
pnpm build 2>&1 | tail -3
```
Expected: all green, `ReplyAfterlife.test.tsx` unmodified and passing.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/insights/components/memory frontend/src/features/insights/components/teamchat/ReplyAfterlife.tsx frontend/src/styles/prototype.css
git commit -m "feat(insights): one shared memory chip with four variants; csapatfal switches over unchanged (mezo-d6ivw.12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: FE — turn-memory data layer, mock seed, MSW handlers, the chat anchor fix

**Files:**
- Create: `frontend/src/data/insights/turnMemoryApi.ts`, `turnMemoryHooks.ts`, `turnMemoryHooks.test.tsx`, `turnMemory.ts`
- Modify: `frontend/src/data/insights/chatHooks.ts:283-293` (mock recall) and `:319` (user id), `frontend/src/test/msw/handlers.ts` (new handlers + `turnUserMessageId` on the stream `done` frame ~`:1758`)

**Interfaces:**
- Consumes: generated `components['schemas']['TurnMemoryResponse' | 'MemoryItemResponse' | 'ForgetLearnedRequest' | 'ForgetLearnedResponse']`; `usePeople().undoFactAsync` (`data/me/peopleHooks.ts:143`); `useKnowledgeActions().decide` (`data/insights/knowledgeHooks.ts:91`); `useKnowledgeHubActions().forgetFact` (`data/insights/knowledgeHubHooks.ts:125`).
- Produces:
  - types `MemoryItem`, `TurnLearned`, `TurnProposed`, `TurnMemory`, `TurnAnchor { id: string; ordinal: number; text: string }`; `EMPTY_TURN_MEMORY`
  - `turnMemoryApi.get(conversationId, messageId)`, `.previewForgetAll(conversationId)`, `.forgetAll(conversationId, triggerMessageId)`
  - `useTurnMemory(conversationId: string | null, anchor: TurnAnchor | null): { memory: TurnMemory; pending: boolean }`
  - `useTurnMemoryActions(conversationId, anchor)` → `{ undoLearned(personId, factId): Promise<void>; accept(candidateId): Promise<void>; reject(candidateId): Promise<void>; forgetKept(factId): Promise<void>; forgetAll(): Promise<MemoryItem[]> }`
  - `useForgetAllPreview(conversationId: string | null, enabled: boolean)` → TanStack `UseQueryResult<MemoryItem[]>`
  - mock: `MOCK_TURN_MEMORY`, `MOCK_FORGOTTEN_TURN`, `MOCK_FORGET_ALL_PREVIEW`, `MOCK_PERSON_RECALL`, `mockTurnMemory(ordinal, text)`, `looksLikeForget(text)`

- [ ] **Step 1: `turnMemoryApi.ts`**

```ts
import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

export type TurnMemoryResponse = components['schemas']['TurnMemoryResponse']
export type MemoryItemResponse = components['schemas']['MemoryItemResponse']
export type ForgetLearnedRequest = components['schemas']['ForgetLearnedRequest']
export type ForgetLearnedResponse = components['schemas']['ForgetLearnedResponse']

/** S8 (mezo-d6ivw.12): one memory item a chat turn produced (forget list / widen preview). */
export interface MemoryItem {
  kind: MemoryItemResponse['kind']
  refId: string
  personId: string | null
  who: string | null
  text: string
  createdAt: string
  pending: boolean
}
export interface TurnLearned { id: string; personId: string; who: string; kind: string; text: string }
/** `kept` = accepted/refined, its knowledge fact still live (undo forgets that fact). */
export interface TurnProposed { id: string; text: string; state: 'ask' | 'kept'; promotedFactId: string | null }
export interface TurnMemory { learned: TurnLearned[]; proposed: TurnProposed[]; forgotten: MemoryItem[] }
/** The user message a turn's chips hang on — `id` is the persisted row id, or `mock-turn-<i>`. */
export interface TurnAnchor { id: string; ordinal: number; text: string }

export const EMPTY_TURN_MEMORY: TurnMemory = { learned: [], proposed: [], forgotten: [] }

export const toMemoryItem = (m: MemoryItemResponse): MemoryItem => ({
  kind: m.kind, refId: m.refId, personId: m.personId ?? null, who: m.who ?? null,
  text: m.text, createdAt: m.createdAt, pending: m.pending,
})

export function toTurnMemory(r: TurnMemoryResponse): TurnMemory {
  return {
    learned: r.learned.map((f) => ({ id: f.id, personId: f.personId, who: f.personName, kind: f.kind, text: f.text })),
    proposed: r.proposed.map((c) => ({
      id: c.id,
      text: c.refinedText ?? c.candidateText,
      state: c.userDecision ? 'kept' : 'ask',
      promotedFactId: c.promotedFactId ?? null,
    })),
    forgotten: r.forgotten.map(toMemoryItem),
  }
}

const CONVERSATION = '/api/companion/conversation'

export const turnMemoryApi = {
  get: async (conversationId: string, messageId: string) =>
    toTurnMemory(await apiFetch<TurnMemoryResponse>(
      `${CONVERSATION}/${conversationId}/turn-memory?messageId=${encodeURIComponent(messageId)}`)),
  previewForgetAll: async (conversationId: string) =>
    (await apiFetch<MemoryItemResponse[]>(`${CONVERSATION}/${conversationId}/forget-learned`)).map(toMemoryItem),
  forgetAll: async (conversationId: string, triggerMessageId: string) =>
    (await apiFetch<ForgetLearnedResponse>(`${CONVERSATION}/${conversationId}/forget-learned`, {
      method: 'POST',
      body: JSON.stringify({ triggerMessageId } satisfies ForgetLearnedRequest),
    })).forgotten.map(toMemoryItem),
}
```

- [ ] **Step 2: Mock seed `turnMemory.ts`** (invented, real-looking — the prototype's Dóri/Anna/Bence evening; never production text)

```ts
import type { ChatRecalledMemory } from '@/data/types'
import type { MemoryItem, TurnLearned, TurnMemory, TurnProposed } from '@/data/insights/turnMemoryApi'

/** S8 (mezo-d6ivw.12) demo seed — all four chip variants (lesson 16: mock anchors are
 *  `mock-turn-<i>`). Session turn 0 learns Dóri + proposes one owner fact, turn 1 learns Anna +
 *  Bence, a forget request forgets turn 1. Mirrors docs/design_2.0/prototypes/elo/mezo.html S8F. */
const AT_22_05 = '2026-09-26T20:05:00Z'
const AT_22_07 = '2026-09-26T20:07:00Z'
const DORI: TurnLearned = { id: 'mock-pf-dori', personId: 'mock-person-dori', who: 'Dóri', kind: 'relationship_state',
  text: 'a strandröpi-párod, együtt nyertétek a szeptemberi tornát' }
const ANNA: TurnLearned = { id: 'mock-pf-anna', personId: 'mock-person-anna', who: 'Anna', kind: 'preference',
  text: 'régi csapattársad, rég beszéltetek' }
const BENCE: TurnLearned = { id: 'mock-pf-bence', personId: 'mock-person-bence', who: 'Bence', kind: 'shared_activity',
  text: 'jövőre hármasban játszana veled és Annával' }
const SELF: TurnProposed = { id: 'mock-lf-self', state: 'ask', promotedFactId: null,
  text: 'Egy nagy közös élmény után nehezen viselem az egyedül töltött estét.' }

const asItem = (f: TurnLearned, createdAt: string): MemoryItem => ({
  kind: 'person_fact', refId: f.id, personId: f.personId, who: f.who, text: f.text, createdAt, pending: false,
})

export const MOCK_TURN_MEMORY: TurnMemory[] = [
  { learned: [DORI], proposed: [SELF], forgotten: [] },
  { learned: [ANNA, BENCE], proposed: [], forgotten: [] },
]
export const MOCK_FORGOTTEN_TURN: TurnMemory = {
  learned: [], proposed: [], forgotten: [asItem(ANNA, AT_22_07), asItem(BENCE, AT_22_07)],
}
export const MOCK_FORGET_ALL_PREVIEW: MemoryItem[] = [
  asItem(DORI, AT_22_05),
  { kind: 'fact_candidate', refId: SELF.id, personId: null, who: null, text: SELF.text, createdAt: AT_22_05, pending: true },
]
export const MOCK_PERSON_RECALL: ChatRecalledMemory[] = [
  { kind: 'person', label: 'Dóri', gist: 'tavasz óta a strandröpi-párod\nhétköznap ritkán ér rá, inkább hétvégén játszotok', similarity: 1 },
  { kind: 'person', label: 'Bence', gist: 'az egyetem óta ismeritek\nő szervezi a szombati edzéseket', similarity: 1 },
]

/** Mock-only echo of the backend ForgetIntent — just enough to route the demo. */
export function looksLikeForget(text: string): boolean {
  const f = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  return !/ne felejtsd el/.test(f) && /ne jegyezd meg|felejtsd el|ne mentsd|ne tarold/.test(f)
}

export function mockTurnMemory(ordinal: number, text: string): TurnMemory {
  return looksLikeForget(text) ? MOCK_FORGOTTEN_TURN : MOCK_TURN_MEMORY[ordinal % MOCK_TURN_MEMORY.length]
}
```

- [ ] **Step 3: Failing hook test** — `turnMemoryHooks.test.tsx`

```tsx
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useTurnMemory, useTurnMemoryActions } from '@/data/insights/turnMemoryHooks'

describe('useTurnMemory (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('turn 0 seeds a learned person fact and an owner proposal; a forget text seeds the forgotten list', async () => {
    const { result } = renderHook(() => useTurnMemory('c-1', { id: 'mock-turn-0', ordinal: 0, text: 'Dórival nyertünk' }),
      { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.memory.learned).toHaveLength(1))
    expect(result.current.memory.proposed[0].state).toBe('ask')
    const forget = renderHook(() => useTurnMemory('c-1', { id: 'mock-turn-4', ordinal: 2, text: 'Ezt ne jegyezd meg.' }),
      { wrapper: makeHookWrapper() })
    await waitFor(() => expect(forget.result.current.memory.forgotten).toHaveLength(2))
  })

  test('accept flips the proposal to kept in the cache', async () => {
    const wrapper = makeHookWrapper()
    const anchor = { id: 'mock-turn-0', ordinal: 0, text: 'x' }
    const { result } = renderHook(() => ({ m: useTurnMemory('c-1', anchor), a: useTurnMemoryActions('c-1', anchor) }), { wrapper })
    await waitFor(() => expect(result.current.m.memory.proposed).toHaveLength(1))
    await act(() => result.current.a.accept('mock-lf-self'))
    await waitFor(() => expect(result.current.m.memory.proposed[0].state).toBe('kept'))
  })
})

describe('useTurnMemory (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('polls the turn-memory endpoint and maps the wire', async () => {
    let calls = 0
    server.use(http.get(`${API_BASE}/api/companion/conversation/:id/turn-memory`, () => {
      calls++
      return HttpResponse.json({
        learned: calls === 1 ? [] : [{ id: 'pf-1', personId: 'p-1', personName: 'Dóri', kind: 'preference', text: 'szereti a teát', createdAt: '2026-09-26T20:05:00Z' }],
        proposed: [], forgotten: [],
      })
    }))
    const { result } = renderHook(() => useTurnMemory('c-1', { id: 'u-1', ordinal: 0, text: 'x' }), { wrapper: makeHookWrapper() })
    expect(result.current.pending).toBe(true)
    await waitFor(() => expect(result.current.memory.learned[0]?.who).toBe('Dóri'), { timeout: 6000 })
  })

  test('without an anchor nothing is fetched', () => {
    const { result } = renderHook(() => useTurnMemory('c-1', null), { wrapper: makeHookWrapper() })
    expect(result.current).toEqual({ memory: { learned: [], proposed: [], forgotten: [] }, pending: false })
  })
})
```

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm vitest run src/data/insights/turnMemoryHooks.test.tsx` → FAIL (module missing).

- [ ] **Step 4: `turnMemoryHooks.ts`**

```ts
import { useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { usePeople } from '@/data/me/peopleHooks'
import { useKnowledgeActions } from '@/data/insights/knowledgeHooks'
import { useKnowledgeHubActions } from '@/data/insights/knowledgeHubHooks'
import {
  EMPTY_TURN_MEMORY, turnMemoryApi, type MemoryItem, type TurnAnchor, type TurnMemory,
} from '@/data/insights/turnMemoryApi'
import { MOCK_FORGET_ALL_PREVIEW, mockTurnMemory } from '@/data/insights/turnMemory'

/** The S3 back-off ladder (ms) — both extractors land independently, so the WHOLE ladder runs
 *  unless the turn is a forget request (its list is synchronous with the reply). */
const TURN_MEMORY_POLL_DELAYS = [2000, 3000, 5000]

export const turnMemoryKey = (conversationId: string | null, anchorId: string) =>
  ['turn-memory', conversationId, anchorId] as const
const previewKey = (conversationId: string | null) => ['forget-all-preview', conversationId] as const

const isEmpty = (m: TurnMemory) => m.learned.length + m.proposed.length + m.forgotten.length === 0

/**
 * S8 (mezo-d6ivw.12): one chat turn's memory — replaces S3's `useTurnFacts`. Real mode polls
 * `GET …/turn-memory` on the 2s/3s/5s ladder; mock mode serves the inline seed through the SAME
 * query cache, so the actions below patch one place in both modes.
 */
export function useTurnMemory(conversationId: string | null, anchor: TurnAnchor | null): { memory: TurnMemory; pending: boolean } {
  const mock = isMockMode()
  const attempts = useRef(0)
  const lastId = useRef<string | null>(null)
  if (lastId.current !== (anchor?.id ?? null)) {
    lastId.current = anchor?.id ?? null
    attempts.current = 0
  }
  const { data } = useQuery<TurnMemory>({
    queryKey: turnMemoryKey(conversationId, anchor?.id ?? ''),
    enabled: !!anchor && (mock || !!conversationId),
    queryFn: async () => {
      if (mock) return mockTurnMemory(anchor!.ordinal, anchor!.text)
      attempts.current += 1
      return turnMemoryApi.get(conversationId!, anchor!.id)
    },
    refetchInterval: (query) => {
      if (mock) return false
      if ((query.state.data?.forgotten.length ?? 0) > 0) return false
      if (attempts.current >= TURN_MEMORY_POLL_DELAYS.length) return false
      return TURN_MEMORY_POLL_DELAYS[Math.min(attempts.current, TURN_MEMORY_POLL_DELAYS.length - 1)]
    },
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  })
  const memory = data ?? EMPTY_TURN_MEMORY
  const pending = !mock && !!anchor && isEmpty(memory) && attempts.current < TURN_MEMORY_POLL_DELAYS.length
  return { memory, pending }
}

/** The four chip actions of one turn, each a promise the chip turns into busy/error/done. */
export function useTurnMemoryActions(conversationId: string | null, anchor: TurnAnchor | null) {
  const qc = useQueryClient()
  const mock = isMockMode()
  const { undoFactAsync } = usePeople()
  const { decide } = useKnowledgeActions()
  const { forgetFact } = useKnowledgeHubActions()
  const key = turnMemoryKey(conversationId, anchor?.id ?? '')
  const patch = (fn: (m: TurnMemory) => TurnMemory) =>
    qc.setQueryData<TurnMemory>(key, (old) => fn(old ?? EMPTY_TURN_MEMORY))

  return {
    undoLearned: async (personId: string, factId: string) => { await undoFactAsync(personId, factId) },
    accept: async (candidateId: string) => {
      await decide(candidateId, 'accept')
      if (mock) {
        patch((m) => ({ ...m, proposed: m.proposed.map((c) => c.id === candidateId
          ? { ...c, state: 'kept' as const, promotedFactId: `mock-fact-${candidateId}` } : c) }))
      } else {
        await qc.invalidateQueries({ queryKey: key })
      }
    },
    reject: async (candidateId: string) => { await decide(candidateId, 'reject') },
    forgetKept: async (factId: string) => { await forgetFact(factId) },
    forgetAll: async (): Promise<MemoryItem[]> => {
      const items = mock ? MOCK_FORGET_ALL_PREVIEW : await turnMemoryApi.forgetAll(conversationId!, anchor!.id)
      patch((m) => ({ ...m, forgotten: [...m.forgotten, ...items.filter((i) => !m.forgotten.some((f) => f.refId === i.refId))] }))
      void qc.invalidateQueries({ queryKey: previewKey(conversationId) })
      return items
    },
  }
}

/** What "Mindent ebből a beszélgetésből?" would forget — fetched once a forget chip shows. */
export function useForgetAllPreview(conversationId: string | null, enabled: boolean) {
  const mock = isMockMode()
  return useQuery<MemoryItem[]>({
    queryKey: previewKey(conversationId),
    enabled: enabled && (mock || !!conversationId),
    queryFn: () => (mock ? Promise.resolve(MOCK_FORGET_ALL_PREVIEW) : turnMemoryApi.previewForgetAll(conversationId!)),
    staleTime: 30_000,
  })
}
```

- [ ] **Step 5: MSW + mock recall + the anchor fix**

`test/msw/handlers.ts` — add next to the other companion/people handlers:

```ts
  // S8 (mezo-d6ivw.12): turn memory + the widen flow; the people-fact GET/DELETE that were missing.
  http.get(`${API_BASE}/api/companion/conversation/:id/turn-memory`, () =>
    HttpResponse.json({ learned: [], proposed: [], forgotten: [] })),
  http.get(`${API_BASE}/api/companion/conversation/:id/forget-learned`, () => HttpResponse.json([])),
  http.post(`${API_BASE}/api/companion/conversation/:id/forget-learned`, () => HttpResponse.json({ forgotten: [] })),
  http.get(`${API_BASE}/api/people/facts`, () => HttpResponse.json([])),
  http.delete(`${API_BASE}/api/people/:personId/facts/:factId`, () => new HttpResponse(null, { status: 204 })),
```
and in the stream `done` frame object add `turnUserMessageId: 'msg-user-done',`.

`chatHooks.ts` — mock reply (`recalled: [...]`, ~line 292): append `...MOCK_PERSON_RECALL` after the existing `chat_turn` item (import from `@/data/insights/turnMemory`). Real send (line 319):

```ts
        // S8: the done answer names its own user row — the chips anchor on the real id
        // without a refetch (before S8 the id-less bubble made the chips poll the PREVIOUS turn).
        append(conversationId, [{ id: done.turnUserMessageId ?? undefined, role: 'user', ts: nowTs(), text }, toChatMessage(done)])
```

(S3's `RememberedChips` / `useTurnFacts` stay until Task 14 swaps `ChatPage` over — removing them here would leave this commit unbuildable.)

- [ ] **Step 6: Run — expect PASS**

```bash
cd frontend && set -o pipefail && CI=true VITE_USE_MOCK=true pnpm vitest run src/data 2>&1 | tail -6
CI=true VITE_USE_MOCK=false pnpm vitest run src/data 2>&1 | tail -6
```

- [ ] **Step 7: Commit** (the data layer is additive — `pnpm build` stays green)

```bash
git add frontend/src/data frontend/src/test/msw/handlers.ts
git commit -m "feat(insights): turn-memory data layer, demo seed and the chat turn anchor (mezo-d6ivw.12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: FE — ChatPage chips under every session turn, "Emlékszem" line, recall + forget-all sheets

**Files:**
- Create: `frontend/src/features/insights/components/memory/TurnMemoryChips.tsx` (+ `.test.tsx`), `frontend/src/features/insights/sheets/RecallSheet.tsx`, `ForgetAllSheet.tsx` (+ `ForgetAllSheet.test.tsx`)
- Modify: `frontend/src/features/insights/components/ChatMessage.tsx`, `frontend/src/features/insights/pages/ChatPage.tsx:7,118-127,330`, `ChatPage.test.tsx`
- Modify/delete: `frontend/src/data/me/peopleHooks.ts:155-195` (drop `useTurnFacts` + `TURN_FACT_POLL_DELAYS` + the `MOCK_TURN_FACTS` import), `frontend/src/data/me/people.ts:381` (drop `MOCK_TURN_FACTS`); delete `frontend/src/features/insights/components/RememberedChips.tsx` + `.test.tsx`
- Create: `frontend/tests/layout/chat-memory.spec.ts`

**Interfaces:**
- Consumes: Task 12 `MemoryChip`; Task 13 hooks/types.
- Produces: `TurnMemoryChips({ conversationId, anchor, forgottenRefs, onForgotten })`; `RecallSheet({ items: ChatRecalledMemory[]; onClose })`; `ForgetAllSheet({ items: MemoryItem[]; onConfirm: () => Promise<void>; onClose })`; `forgetAllTitle(n)`, `forgetAllCta(n)`.

- [ ] **Step 1: Failing tests**

`ForgetAllSheet.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ForgetAllSheet, forgetAllCta, forgetAllTitle } from '@/features/insights/sheets/ForgetAllSheet'
import type { MemoryItem } from '@/data/insights/turnMemoryApi'

const items: MemoryItem[] = [
  { kind: 'person_fact', refId: 'a', personId: 'p', who: 'Dóri', text: 'a strandröpi-párod', createdAt: '2026-09-26T20:05:00Z', pending: false },
  { kind: 'fact_candidate', refId: 'b', personId: null, who: null, text: 'nehéz egyedül', createdAt: '2026-09-26T20:05:00Z', pending: true },
]

test('copy follows the prototype for one and two items, and stays Hungarian beyond', () => {
  expect(forgetAllTitle(1)).toBe('Ezt az egyet is elfelejtem')
  expect(forgetAllTitle(2)).toBe('Ezt a kettőt is elfelejtem')
  expect(forgetAllTitle(3)).toBe('Ezt a 3 dolgot is elfelejtem')
  expect(forgetAllCta(1)).toBe('Elfelejtem')
  expect(forgetAllCta(2)).toBe('Elfelejtem mind a kettőt')
  expect(forgetAllCta(4)).toBe('Elfelejtem mindet')
})

test('lists each item with its provenance line; a failed confirm keeps the sheet and says so', async () => {
  const onConfirm = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(undefined)
  render(<ForgetAllSheet items={items} onConfirm={onConfirm} onClose={vi.fn()} />)
  expect(screen.getByText('MINDENT EBBŐL A BESZÉLGETÉSBŐL')).toBeInTheDocument()
  expect(screen.getByText('javaslat, még nem döntöttél róla')).toBeInTheDocument()
  expect(screen.getByText(/-kor jegyeztem meg$/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Elfelejtem mind a kettőt' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Nem sikerült elfelejteni — próbáld újra.')
  expect(screen.getByRole('button', { name: 'Mégse' })).toBeInTheDocument()
})
```

`TurnMemoryChips.test.tsx` (mock mode through the real hooks):

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import { TurnMemoryChips } from '@/features/insights/components/memory/TurnMemoryChips'

const renderChips = (text: string, ordinal: number, forgottenRefs: ReadonlySet<string> = new Set()) =>
  render(
    <QueryWrapper><MemoryRouter>
      <TurnMemoryChips conversationId="c-1" anchor={{ id: `mock-turn-${ordinal}`, ordinal, text }}
        forgottenRefs={forgottenRefs} onForgotten={vi.fn()} />
    </MemoryRouter></QueryWrapper>,
  )

describe('TurnMemoryChips (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('a learning turn: Megjegyeztem (Dóri) + Megjegyezném; Igen turns it into a kept fact', async () => {
    renderChips('Dórival nyertünk', 0)
    expect(await screen.findByText('Dóri')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Igen' }))
    expect(await screen.findByText('a Tudástár Rólad részében látod')).toBeInTheDocument()
  })

  test('an earlier item forgotten later renders the struck line', async () => {
    renderChips('Dórival nyertünk', 0, new Set(['mock-pf-dori']))
    expect(await screen.findByText(/Elfelejtve ·/)).toBeInTheDocument()
  })

  test('a forget turn: Elfelejtettem list → widen sheet → confirm hides the offer', async () => {
    renderChips('Az Annásat inkább ne jegyezd meg.', 2)
    expect(await screen.findByText('Elfelejtettem:')).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Mindent ebből a beszélgetésből?' }))
    expect(await screen.findByText('Ezt a kettőt is elfelejtem')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Elfelejtem mind a kettőt' }))
    expect(await screen.findByText(/a strandröpi-párod, együtt nyertétek/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mindent ebből a beszélgetésből?' })).not.toBeInTheDocument()
  })
})
```

`ChatPage.test.tsx` — add to the **mock** describe:

```tsx
  test('S8: a sent turn shows its memory chips and the answer its Emlékszem line (mezo-d6ivw.12)', async () => {
    renderPage()
    const input = screen.getByPlaceholderText('Mondj valamit…')
    fireEvent.change(input, { target: { value: 'Dórival és Bencével nyertünk!' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText('Megjegyezném:', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByText('Megjegyeztem:')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Mit vettem elő róluk' }).at(-1)!)
    expect(await screen.findByText('Ezt vettem elő a válaszhoz')).toBeInTheDocument()
    expect(screen.getByText('ő szervezi a szombati edzéseket')).toBeInTheDocument()
  })

  test('S8: opening a conversation shows no turn chips — only this session\'s turns get them', () => {
    renderPage()
    expect(screen.queryByText('Megjegyeztem:')).not.toBeInTheDocument()
    expect(screen.queryByText('Megjegyezném:')).not.toBeInTheDocument()
  })
```
and to the **real** describe:

```tsx
  test('S8: the chips anchor on the done event\'s turnUserMessageId (mezo-d6ivw.12)', async () => {
    const asked: string[] = []
    server.use(http.get(`${API_BASE}/api/companion/conversation/:id/turn-memory`, ({ request }) => {
      asked.push(new URL(request.url).searchParams.get('messageId') ?? '')
      return HttpResponse.json({
        learned: [{ id: 'pf-1', personId: 'p-1', personName: 'Dóri', kind: 'preference', text: 'szereti a teát', createdAt: '2026-09-26T20:05:00Z' }],
        proposed: [], forgotten: [],
      })
    }))
    renderPage()
    await screen.findByText(/Jó reggelt\. Tegnap a Push Day/)
    const input = screen.getByPlaceholderText('Mondj valamit…')
    fireEvent.change(input, { target: { value: 'Dórival voltam' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText('szereti a teát', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(asked[0]).toBe('msg-user-done')
  })
```

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm vitest run src/features/insights` → FAIL.

- [ ] **Step 2: `ForgetAllSheet.tsx` + `RecallSheet.tsx`**

```tsx
// ForgetAllSheet.tsx
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { SheetHead } from '@/shared/ui/SheetHead'
import type { MemoryItem } from '@/data/insights/turnMemoryApi'

const TITLE_ID = 'forget-all-title'

/** Prototype copy for 1 and 2 items (docs/design_2.0/prototypes/elo/mezo.html SH.s8all); the
 *  3+ form is this plan's extension (the prototype never shows more than two). */
export const forgetAllTitle = (n: number) =>
  n === 1 ? 'Ezt az egyet is elfelejtem' : n === 2 ? 'Ezt a kettőt is elfelejtem' : `Ezt a ${n} dolgot is elfelejtem`
export const forgetAllCta = (n: number) =>
  n === 1 ? 'Elfelejtem' : n === 2 ? 'Elfelejtem mind a kettőt' : 'Elfelejtem mindet'
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })

/** S8 (mezo-d6ivw.12): "Mindent ebből a beszélgetésből?" — the confirm step of the widened
 *  forget. Rose glass sheet, flat list, the permanence footnote; the sheet closes only on success. */
export function ForgetAllSheet({ items, onConfirm, onClose }: {
  items: MemoryItem[]
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  return (
    <Sheet glass onClose={onClose} labelledBy={TITLE_ID} className="mzc-memsheet">
      {(close) => (
        <div style={{ ['--c' as string]: 'var(--dv-rose)' }}>
          <SheetHead icon="t-eraser" eyebrow="MINDENT EBBŐL A BESZÉLGETÉSBŐL" title={forgetAllTitle(items.length)}
            titleId={TITLE_ID} onClose={close} />
          <ul className="mzc-memlist">
            {items.map((i) => (
              <li key={`${i.kind}-${i.refId}`}>
                {i.who && <><b>{i.who}</b> — </>}{i.text}
                <small>{i.pending ? 'javaslat, még nem döntöttél róla' : `${hhmm(i.createdAt)}-kor jegyeztem meg`}</small>
              </li>
            ))}
          </ul>
          <p className="mzc-memfoot">
            Végleges: nem használom többé, és ugyanebből nem tanulom meg újra. Amit máskor, máshol mondasz, azt
            továbbra is megjegyezhetem.
          </p>
          {error && <p className="mzc-memerr" role="alert">Nem sikerült elfelejteni — próbáld újra.</p>}
          <div className="mzc-memrow">
            <button type="button" className="mzc-mbtn" style={{ ['--c' as string]: 'var(--dv-rose)' }} disabled={busy}
              onClick={async () => {
                setBusy(true)
                setError(false)
                try {
                  await onConfirm()
                  close()
                } catch {
                  setError(true)
                } finally {
                  setBusy(false)
                }
              }}>
              {forgetAllCta(items.length)}
            </button>
            <button type="button" className="mzc-mbtn is-ghost" onClick={close}>Mégse</button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
```

```tsx
// RecallSheet.tsx
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { SheetHead } from '@/shared/ui/SheetHead'
import { Icon3D } from '@/shared/ui/clay'
import type { ChatRecalledMemory } from '@/data/types'

const TITLE_ID = 'recall-sheet-title'

/** S8 (mezo-d6ivw.12): "Emlékszem" opened — the facts about each named person that went into
 *  the prompt (the `kind=person` recalled items; gist = one fact per line). The door goes to the
 *  Tudástár's people view, where each fact can be muted or forgotten. */
export function RecallSheet({ items, onClose }: { items: ChatRecalledMemory[]; onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <Sheet glass onClose={onClose} labelledBy={TITLE_ID} className="mzc-memsheet">
      {(close) => (
        <div style={{ ['--c' as string]: 'var(--dv-lav)' }}>
          <SheetHead icon="t-people" eyebrow="EMLÉKSZEM" title="Ezt vettem elő a válaszhoz" titleId={TITLE_ID} onClose={close} />
          <div className="mzc-memwho">
            {items.map((p) => (
              <div key={p.label} className="mzc-memwho-p">
                <strong><Icon3D name="t-person" size={22} />{p.label}</strong>
                <ul>{p.gist.split('\n').filter(Boolean).map((line) => <li key={line}>{line}</li>)}</ul>
              </div>
            ))}
          </div>
          <p className="mzc-memfoot">
            Csak azt veszem elő, amit a Tudástárban is látsz. Ha valamelyiket nem szeretnéd, ott elhallgattathatod vagy
            elfelejtheted.
          </p>
          <div className="mzc-memrow">
            <button type="button" className="mzc-mbtn" onClick={() => { close(); navigate('/mezo/knowledge?view=emberek') }}>
              Emberek a Tudástárban ›
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 3: `TurnMemoryChips.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { MemoryChip } from '@/features/insights/components/memory/MemoryChip'
import { ForgetAllSheet } from '@/features/insights/sheets/ForgetAllSheet'
import { useForgetAllPreview, useTurnMemory, useTurnMemoryActions } from '@/data/insights/turnMemoryHooks'
import type { TurnAnchor } from '@/data/insights/turnMemoryApi'
import { useToast } from '@/shared/ui/ToastProvider'

/**
 * S8 (mezo-d6ivw.12): one chat turn's memory under its answer — learned person facts
 * (Megjegyeztem), owner proposals (Megjegyezném → kept), and a forget turn's list (Elfelejtettem
 * + the widen offer). `forgottenRefs` is the page-wide set of forgotten item ids, so an EARLIER
 * turn's chip turns into "Elfelejtve · …" when a later turn forgets it. While the extractors are
 * still running and nothing is back, the S3 "még figyelek…" status shows; nothing at all → nothing.
 */
export function TurnMemoryChips({ conversationId, anchor, forgottenRefs, onForgotten }: {
  conversationId: string | null
  anchor: TurnAnchor
  forgottenRefs: ReadonlySet<string>
  onForgotten: (refIds: string[]) => void
}) {
  const { memory, pending } = useTurnMemory(conversationId, anchor)
  const actions = useTurnMemoryActions(conversationId, anchor)
  const toast = useToast()
  const [widened, setWidened] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const preview = useForgetAllPreview(conversationId, memory.forgotten.length > 0 && !widened)
  const forgottenIds = memory.forgotten.map((f) => f.refId).join(',')
  useEffect(() => {
    if (forgottenIds) onForgotten(forgottenIds.split(','))
  }, [forgottenIds, onForgotten])

  if (memory.learned.length + memory.proposed.length + memory.forgotten.length === 0) {
    return pending ? (
      <div className="mzc-rempend row gap-xs" role="status" aria-label="Mezo még figyel">
        <span className="mzc-rempend-dot" aria-hidden="true" />
        <span className="mzc-rempend-tx">még figyelek…</span>
      </div>
    ) : null
  }
  const rest = preview.data ?? []
  let delay = 0.3
  const next = () => { const d = delay; delay += 0.12; return d }
  return (
    <div className="mzc-memturn">
      {memory.learned.map((f) => (
        <MemoryChip key={f.id} variant="remembered" item={{ who: f.who, text: f.text }} sensitive={f.kind === 'sensitivity'}
          forgotten={forgottenRefs.has(f.id)} delay={next()} onUndo={() => actions.undoLearned(f.personId, f.id)} />
      ))}
      {memory.proposed.map((c) => (c.state === 'kept' ? (
        <MemoryChip key={`${c.id}-kept`} variant="remembered" item={{ text: c.text }} sub="a Tudástár Rólad részében látod"
          forgotten={forgottenRefs.has(c.id) || (c.promotedFactId != null && forgottenRefs.has(c.promotedFactId))}
          delay={next()} onUndo={() => actions.forgetKept(c.promotedFactId!)} />
      ) : (
        <MemoryChip key={c.id} variant="proposed" item={{ text: c.text }} forgotten={forgottenRefs.has(c.id)} delay={next()}
          onAccept={async () => {
            await actions.accept(c.id)
            toast.show({ kind: 'success', text: 'Elmentve — a Tudástárban bármikor elhallgattathatod.' })
          }}
          onReject={() => actions.reject(c.id)} />
      )))}
      {memory.forgotten.length > 0 && (
        <MemoryChip variant="forgotten" items={memory.forgotten} delay={next()}
          canWiden={!widened && rest.length > 0} onWiden={() => setSheetOpen(true)} />
      )}
      {sheetOpen && (
        <ForgetAllSheet items={rest} onClose={() => setSheetOpen(false)} onConfirm={async () => {
          const items = await actions.forgetAll()
          onForgotten(items.map((i) => i.refId))
          setWidened(true)
          toast.show({ kind: 'success', text: 'Elfelejtve — ebből a beszélgetésből semmit nem tartok meg.' })
        }} />
      )}
    </div>
  )
}
```
(Check `ToastMessage`'s simple shape in `shared/lib/toastBus.ts:8-43` — `{ kind: 'success', text }` is what `toastBus.test.ts:15` emits.)

- [ ] **Step 4: `ChatMessage.tsx`** — hooks go ABOVE the user-row early return:

```tsx
  const [recallOpen, setRecallOpen] = useState(false)
  if (m.role === 'user') { /* unchanged */ }
  // S8 (mezo-d6ivw.12): people the answer recalled get their own "Emlékszem" line; every other
  // recalled item keeps the W3.1b "Emlékek · N" disclosure (parity).
  const personRecall = (m.recalled ?? []).filter((r) => r.kind === 'person')
  const otherRecall = (m.recalled ?? []).filter((r) => r.kind !== 'person')
```
Replace `{m.recalled && <RecalledMemoriesRow items={m.recalled} feedback={memoryFeedback} />}` with:

```tsx
      {personRecall.length > 0 && (
        <MemoryChip variant="recalled" names={personRecall.map((r) => r.label)} onOpen={() => setRecallOpen(true)} />
      )}
      {recallOpen && <RecallSheet items={personRecall} onClose={() => setRecallOpen(false)} />}
      {otherRecall.length > 0 && <RecalledMemoriesRow items={otherRecall} feedback={memoryFeedback} />}
```
(imports `useState`, `MemoryChip`, `RecallSheet`.)

- [ ] **Step 5: `ChatPage.tsx`**

Remove the `RememberedChips` import, `armedRef`, the `lastUserMsgId` memo and `{!turn && <RememberedChips … />}`, then retire S3's chip and hook:

```bash
cd frontend && git rm src/features/insights/components/RememberedChips.tsx src/features/insights/components/RememberedChips.test.tsx
grep -rn "useTurnFacts\|MOCK_TURN_FACTS\|TURN_FACT_POLL_DELAYS\|RememberedChips" src
```
Delete `useTurnFacts`, `TURN_FACT_POLL_DELAYS`, the `MOCK_TURN_FACTS` import (peopleHooks) and export (people.ts), and any `useTurnFacts` test block in `peopleHooks.test.ts(x)` until the grep is empty. If `peopleApi.getFactsBySource` has no consumer left, delete it too (its MSW handler stays — the endpoint is live).

Then add (imports `Fragment`, `useCallback`, `TurnMemoryChips`, `type TurnAnchor`):

```tsx
  // S8 (mezo-d6ivw.12): every turn SENT in this session carries its memory chips; opening an old
  // conversation fetches nothing (the S3 rule). `armedFrom` = index of this session's first user
  // message; picking another conversation re-arms. Mock user bubbles have no id → `mock-turn-<i>`
  // (lesson 16); real ones carry the done event's `turnUserMessageId`.
  const [armedFrom, setArmedFrom] = useState<number | null>(null)
  useEffect(() => {
    if (turn && armedFrom === null) setArmedFrom(messages.length)
  }, [turn, armedFrom, messages.length])
  const [forgottenRefs, setForgottenRefs] = useState<ReadonlySet<string>>(new Set())
  const addForgotten = useCallback((ids: string[]) => setForgottenRefs((prev) => {
    if (ids.every((id) => prev.has(id))) return prev
    const next = new Set(prev)
    ids.forEach((id) => next.add(id))
    return next
  }), [])
  const pickConversation = (id: string | null) => {
    setArmedFrom(null)
    setForgottenRefs(new Set())
    selectConversation(id)
  }
  const conversationId = isNew ? null : (selection ?? data.conversationId ?? null)
  const anchorFor = (assistantIndex: number): TurnAnchor | null => {
    const userIndex = assistantIndex - 1
    const user = messages[userIndex]
    if (armedFrom === null || userIndex < armedFrom || user?.role !== 'user') return null
    const id = user.id ?? (isMockMode() ? `mock-turn-${userIndex}` : null)
    if (!id) return null
    return { id, ordinal: messages.slice(armedFrom, userIndex).filter((x) => x.role === 'user').length, text: user.text }
  }
```

Use `pickConversation` for the picker's `onSelect`/`onNew`, the header "Új beszélgetés" disc, and `ConversationActionsSheet.onDeleted` (the `useChatActions(selection, selectConversation)` call keeps the raw setter — a first send's created id must not re-arm).

Replace the messages loop:

```tsx
        {messages.map((m, i) => {
          const anchor = m.role === 'assistant' ? anchorFor(i) : null
          return (
            <Fragment key={m.id ?? `idx-${i}`}>
              <ChatMessage
                m={m}
                memoryFeedback={memoryFeedback}
                feedback={
                  m.role === 'assistant' && m.id
                    ? { value: feedback.get(m.id), onVote: (verdict, reason) => feedback.vote(m.id!, verdict, reason) }
                    : undefined
                }
              />
              {anchor && (
                <TurnMemoryChips conversationId={conversationId} anchor={anchor}
                  forgottenRefs={forgottenRefs} onForgotten={addForgotten} />
              )}
            </Fragment>
          )
        })}
```

- [ ] **Step 6: Layout spec** — `frontend/tests/layout/chat-memory.spec.ts`

```ts
import { test, expect } from '@playwright/test'
import { seedKalauzSeen } from './kalauzSeed'
import { seedSplashSkipped } from './splashSeed'

/** S8 (mezo-d6ivw.12): the four memory signals in the mock chat — reachable, never clipped,
 *  no horizontal scroll at 320px; the reduced-motion branch drops the chip animation. */
test.beforeEach(async ({ page }) => {
  await seedKalauzSeen(page)
  await seedSplashSkipped(page)
})

async function send(page: import('@playwright/test').Page, text: string) {
  const box = page.getByPlaceholder('Mondj valamit…')
  await box.fill(text)
  await box.press('Enter')
  await expect(page.getByText(text).last()).toBeVisible()
  await expect(page.getByText('dolgozom rajta…')).toBeHidden({ timeout: 5000 })
}

test('chat-memória: Megjegyeztem · Megjegyezném · Emlékszem · Elfelejtettem — 320px, nincs vízszintes túlcsordulás', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/mezo/chat?c=new')
  await page.waitForLoadState('networkidle')
  await send(page, 'Dórival és Bencével nyertünk ma!')
  await expect(page.getByText('Megjegyezném:')).toBeVisible()
  await expect(page.getByText('Megjegyeztem:').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mit vettem elő róluk' }).last()).toBeVisible()
  await send(page, 'Bence mondta, hogy Annával is játszhatnánk.')
  await send(page, 'Az Annásat inkább ne jegyezd meg.')
  await expect(page.getByText('Elfelejtettem:')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mindent ebből a beszélgetésből?' })).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(overflow).toBeLessThanOrEqual(320)
})

test('chat-memória: reduced motion — no chip animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/mezo/chat?c=new')
  await page.waitForLoadState('networkidle')
  await send(page, 'Dórival nyertünk!')
  const chip = page.locator('.mzc-memchip').first()
  await expect(chip).toBeVisible()
  expect(await chip.evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
})
```

- [ ] **Step 7: Run everything FE**

```bash
cd frontend && set -o pipefail
CI=true VITE_USE_MOCK=true pnpm test 2>&1 | tail -6
CI=true VITE_USE_MOCK=false pnpm test 2>&1 | tail -6
pnpm build 2>&1 | tail -3
pnpm test:layout -- chat-memory.spec.ts team-chat-reply.spec.ts 2>&1 | tail -8
```
Expected: both modes `Test Files … passed`, build OK, both layout specs green. (The full suite also runs `pageIndex.coverage.test.ts` — no new route, lesson 43.)

- [ ] **Step 8: Runtime verify** — `verify` skill: mock PWA at 320px, dark, `prefers-reduced-motion`; click through: send → chips → Igen → toast → Visszavonom → "Visszavonva — nem jegyeztem meg." → Emlékszem sheet → door lands on `/mezo/knowledge?view=emberek` → forget turn → widen sheet → confirm → toast; console clean. Screenshot evidence for the checklist.

- [ ] **Step 9: Commit**

```bash
git add frontend
git commit -m "feat(insights): the chat shows what each turn learned, proposes, recalled and forgot (mezo-d6ivw.12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Docs, codemap, lint, the full gates, living prototype

**Files:**
- Modify: `docs/features/companion.md` (§2 user-facing, §3 flow: forget pre-screen + people recall + blocks, §4 new endpoints/columns/`MessageResponse.turnUserMessageId`/enum, §8 new ITs, §9 decisions incl. contradictions 1–4 of this plan, §10 key files; fix `:279` "hu-fold" → TextFold)
- Modify: `docs/features/me.md` (S3 bullet: cap is now 3 per person per source / 15 per source; "exactly-one fold match" is now TRUE for the chat path too; chip = shared `MemoryChip` via turn-memory, not `RememberedChips`/`useTurnFacts`; new people-side `matchActivePersons` + `chatContextFor`)
- Modify: `docs/features/insights.md` (`:1009` RememberedChips → `MemoryChip`/`TurnMemoryChips`; ChatPage chips per session turn; Emlékszem line + RecallSheet; ForgetAllSheet; `RecalledMemoriesRow` now non-person items only)
- Modify: `docs/features/README.md` §2–§3 rows of companion / me / insights (status + route `/mezo/chat` stays)
- Modify: `docs/milestones/roadmap.md` (dated milestone entry for S8 + the *Epics in flight* `mezo-d6ivw` row)
- Modify: `docs/design_2.0/prototypes/elo/README.md` (Mezo row: "Last synced with production" → the merge date)
- Modify (only if a lesson was paid for): spec §Slice lessons, numbered from 45
- Regenerate: `docs/CODEMAP.md`

- [ ] **Step 1:** Update the docs above (link, don't paste code — `file:line` pointers). Use the `knowledge-base` skill's §update rules.

- [ ] **Step 2: Codemap + lint**

```bash
node scripts/gen-codemap.mjs && git diff --stat docs/CODEMAP.md
node scripts/lint-docs.mjs 2>&1 | tail -15
```
Expected: `0 errors`, no stale flag on companion/me/insights/admin-hub docs.

- [ ] **Step 3: Full backend suite with Testcontainers** (ArchUnit companion→people, `ResetDatabase`, contract drift of Java types)

```bash
cd backend && set -o pipefail && ./mvnw clean test -Dmezo.test.use-testcontainers=true 2>&1 | tail -25
```
Expected: `BUILD SUCCESS`, `Tests run: …, Failures: 0, Errors: 0`.

- [ ] **Step 4: Contract drift locally**

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api && cd .. && git diff --exit-code -- api/openapi.yml frontend/src/data/_client/api.gen.ts && echo NO-DRIFT
```

- [ ] **Step 5: Living prototype check** — the build matched the prototype (no deviation in the 1–2 item copy). If any visible deviation happened during the build, edit `docs/design_2.0/prototypes/elo/mezo.html` in the same merge and republish (`Artifact` `read` https://claude.ai/artifact/LBngXviRqUhc5q2ragbtex, then publish with `url`, `artifact-design` loaded first). Update the README row date.

- [ ] **Step 6: Whole-branch review before merge** (lessons 38, 40) — `superpowers:requesting-code-review` over `origin/main...HEAD`; merge `origin/main` into the branch first and re-run Steps 3–4 if main moved.

- [ ] **Step 7: Commit**

```bash
git add docs
git commit -m "docs(companion): S8 chat memory — features, index, roadmap, codemap (mezo-d6ivw.12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Ship — merge, deploy, verify live, prod DB check

**Files:** none new.

- [ ] **Step 1: Merge (no self-PR; worktree → detached HEAD)**

```bash
git fetch origin && git rebase origin/main
git checkout --detach origin/main && git merge --no-ff feat/emlekezet-s8 -m "Merge feat/emlekezet-s8: S8 chat memory (mezo-d6ivw.12)"
node scripts/gen-codemap.mjs && git diff --quiet docs/CODEMAP.md || { git add docs/CODEMAP.md && git commit -m "chore(codemap): regenerate after S8 merge (mezo-d6ivw.12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"; }
git push origin HEAD:main
git branch -d feat/emlekezet-s8
```
(Memory note: a merge silently drops CODEMAP entries — always regenerate after the final merge.)

- [ ] **Step 2: CI + deploy green for that commit**

```bash
gh run list --branch main --limit 3
gh run watch "$(gh run list --workflow deploy.yml --limit 1 --json databaseId -q '.[0].databaseId')"
```
Expected: `ci` and `deploy` `completed success` for the merge SHA. A red main outranks everything.

- [ ] **Step 3: Schema live (reads are free)**

```bash
export KUBECONFIG=~/.kube/mezo-k3s.yaml
kubectl exec -n mezo postgres-0 -- psql -U mezo -d mezo -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='ai_message' AND column_name IN ('forgotten_memories','extraction_blocked');"
```
Expected: 2 rows.

- [ ] **Step 4: Live UI check** — open `https://46.225.112.172.sslip.io/mezo/chat` in the in-app browser (if the login screen shows, ask the owner to log in — never type the password). Confirm the new bundle (hard reload once — lesson 7, the PWA's first open may run the precached bundle).

- [ ] **Step 5: Post-deploy behaviour check — needs the owner's OK first** (it writes real chat rows and memory into his account). Ask in Hungarian (§Communication format): a 3-message test conversation — (1) a message naming two known people (expect "Emlékszem: …"), (2) a message with a stable fact about himself (expect "Megjegyezném: …" within ~10 s), (3) "ezt ne jegyezd meg" (expect "Elfelejtettem: …") — then the test conversation is deleted with the chat's own ⋯ → Törlés. On OK, run it and then:

```bash
kubectl exec -n mezo postgres-0 -- psql -U mezo -d mezo -c "SELECT created_at, extraction_blocked, jsonb_array_length(forgotten_memories->'items') AS forgotten FROM ai_message WHERE forgotten_memories IS NOT NULL ORDER BY created_at DESC LIMIT 3;"
kubectl exec -n mezo postgres-0 -- psql -U mezo -d mezo -c "SELECT domain, count(*) FROM memory_forget_veto WHERE NOT is_deleted GROUP BY domain;"
kubectl exec -n mezo postgres-0 -- psql -U mezo -d mezo -c "SELECT created_at, left(response_text, 120) FROM llm_log_history WHERE feature='companion_person_fact_extract' ORDER BY created_at DESC LIMIT 3;"
```
Expected: a forget row with `extraction_blocked = t` and a count ≥ 1; `fact_text` veto count grew; at least one recent person-fact extraction answer is not `[]` (the manual eval check of Task 9). Never paste the returned text into commits/docs.

- [ ] **Step 6: Close out** — `bd update mezo-d6ivw.12` notes with the evidence; tracker backup and push:

```bash
node scripts/check-beads-backup.mjs --fix && git add .beads/issues.jsonl && git commit -m "chore(beads): tracker backup after S8 (mezo-d6ivw.12) [skip ci]

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git pull --rebase && bd dolt push && git push origin HEAD:main
```

---

### Task 17: Backfill in production — dry-run, owner OK, apply (GATED, manual, never automatic)

**Files:**
- Modify: `k8s/backend/deployment.yaml` (one env entry, twice; then removed)

- [ ] **Step 1: Dry-run deploy** (read-only; no owner OK needed — it writes nothing). Add under the backend container `env:` (next to `MEZO_COMPANION_LLM_PROVIDER`):

```yaml
            # S8 (mezo-d6ivw.12): one-shot fact-text backfill — dry-run logs the before/after list,
            # writes nothing. Remove this entry after the apply run.
            - name: MEZO_COMPANION_FACTTEXTBACKFILL_MODE
              value: "dry-run"
```
Commit (`chore(k8s): fact-text backfill dry-run (mezo-d6ivw.12)`), push to main, wait for the deploy, then:

```bash
kubectl logs -n mezo deploy/mezo-backend --since=30m | grep -A2 "fact-text-backfill \[dry-run\]"
```
Expected: one `ELŐTTE/UTÁNA` pair per title-only pattern fact (≤ 25; statistical rows stay out by design) and a `done — N row(s) would change` line.

- [ ] **Step 2: Owner decision (STOP and wait).** Show him the before/after list in chat, Hungarian, §Communication format (A helyzet · A gond · A lehetőségek table: *Átírom mindet* / *Csak a jókat írom át* (he names the ones to skip — then those are excluded by hand-editing each skipped fact's text in the Tudástár after the apply, or the apply is not run) / *Maradjon a cím* · Mi az ára · Az ajánlásom). Do not proceed without an explicit "igen" for this specific write.

- [ ] **Step 3: Apply deploy (only after the OK).** Change the env value to `"apply"`, commit (`chore(k8s): fact-text backfill apply — owner OK <date> (mezo-d6ivw.12)`), push, wait for deploy, then:

```bash
kubectl logs -n mezo deploy/mezo-backend --since=30m | grep "fact-text-backfill \[apply\] done"
kubectl exec -n mezo postgres-0 -- psql -U mezo -d mezo -c "SELECT count(*) FROM knowledge_fact kf JOIN pattern p ON p.promoted_fact_id = kf.id WHERE NOT kf.is_deleted AND kf.fact_text = p.title AND p.kind <> 'statistical';"
```
Expected: `done — N row(s) rewritten` with N = the dry-run N; the count query returns 0 (verify the `pattern` table/column names against `PatternEntity` `@Table`/`@Column` before running).

- [ ] **Step 4: Remove the env entry** (commit `chore(k8s): fact-text backfill done, env removed (mezo-d6ivw.12)`), push, confirm the next deploy logs no `fact-text-backfill` line. Record the result on the bead.

---

## Kész, ha…

**Amit a tulajdonos lát** (mock + prod, sötét téma)
- [ ] Egy elküldött kör alatt: **„Megjegyeztem: *Név* — tény [Visszavonom]"** (t-spark), érzékeny ténynél „érzékeny" címke; Visszavonom → „Visszavonva — nem jegyeztem meg."; sikertelen visszavonásnál hibaüzenet, a chip marad.
- [ ] **„Megjegyezném: … rólad szól, ezért előbb megkérdezlek [Igen] [Ne]"** (t-bulb, arany); Igen → „Megjegyeztem: … a Tudástár Rólad részében látod [Visszavonom]" + toast „Elmentve — a Tudástárban bármikor elhallgattathatod."; Ne → „Rendben, nem jegyzem meg — és nem is javaslom újra."; figyelmen kívül hagyva a Tudástár inboxban marad.
- [ ] A válasz-kártya alján **„Emlékszem: Név · Név ›"** (t-people) csak ha az üzenet ismert, tényekkel bíró embert nevez meg; koppintás → „EMLÉKSZEM / Ezt vettem elő a válaszhoz" lap, személyenként a promptba került tények, lábjegyzet, „Emberek a Tudástárban ›" → `/mezo/knowledge?view=emberek`.
- [ ] „ezt ne jegyezd meg" → **„Elfelejtettem:"** lista (t-eraser, rózsa) + „végleg — …" + „Mindent ebből a beszélgetésből?" → „MINDENT EBBŐL A BESZÉLGETÉSBŐL / Ezt a kettőt is elfelejtem" lap (javaslat / „HH:MM-kor jegyeztem meg" sorok, lábjegyzet, „Elfelejtem mind a kettőt" / „Mégse") → toast „Elfelejtve — ebből a beszélgetésből semmit nem tartok meg.", a korábbi körök chipjei „Elfelejtve · ~~…~~" sorrá válnak; a válasz szövege őszintén megerősíti, mit felejtett el; semmi elfelejtenivaló esetén ezt mondja.
- [ ] Betöltés: „még figyelek…" jel, amíg a kinyerés fut; üres kör → semmi; hibák: minden akciónál rövid hibaszöveg, a chip marad (újrapróbálható).
- [ ] 320px: nincs vízszintes görgetés (`chat-memory.spec.ts`); reduced-motion: nincs chip-animáció; új ikon nincs (mind a meglévő készletből).
- [ ] A modell nem mondja, hogy „nem tudok emlékezni"; csak az `[Ebben a beszélgetésben]` listán szereplőre mondja, hogy „megjegyeztem".

**Paritás (fordított lista)**
- [ ] S3 személy-tény auto-mentés + visszavonás vétója változatlan (inaktív sor = vétó).
- [ ] S7 csapatfal „Megjegyeztem" chip vizuálisan változatlan (`ReplyAfterlife.test.tsx` módosítás nélkül zöld, `team-chat-reply.spec.ts` zöld).
- [ ] Tudástár tény-jelölt inbox: Igen / Módosítom / Most ne változatlan; a Ne mostantól tartós vétó (spec szerint).
- [ ] „Emlékek · N" sor a nem-személy recall elemekre változatlan; a hozzá tartozó visszajelzés (memory feedback) működik.
- [ ] Régi beszélgetés megnyitása nem indít chip-lekérdezést; hangbevitel, gyors kérdések, beszélgetés-választó, ⋯ műveletek, hibabuborék Újra/Szerkesztés, feedback chipek változatlanok.
- [ ] `CompanionToolRegistry` csak olvasó (nincs új író eszköz).

**Kapuk**
- [ ] `CI=true VITE_USE_MOCK=true pnpm test` és `CI=true VITE_USE_MOCK=false pnpm test` zöld; `pnpm build` zöld; `chat-memory.spec.ts` + `team-chat-reply.spec.ts` zöld.
- [ ] `./mvnw clean test -Dmezo.test.use-testcontainers=true` zöld (ArchUnit companion→people, `ResetDatabase`/`AdminDataBrowserIT` a teljes futásban).
- [ ] Szerződés-drift nincs (`api/openapi.yml`, `api.gen.ts` friss); `node scripts/gen-codemap.mjs` lefutott; `node scripts/lint-docs.mjs` 0 hiba / 0 elavult.

**Dokumentáció**
- [ ] `docs/features/companion.md`, `me.md` (hu-fold állítás igaz, személyenkénti éjszakai plafon), `insights.md` frissítve; `docs/features/README.md` §2–§3 sorai igazak; `docs/milestones/roadmap.md` dátumozott bejegyzés + *Epics in flight* sor.

**Élesítve**
- [ ] Merge a main-re, `ci` és `deploy` zöld ugyanarra a commitra; az új verzió él a production URL-en (böngészőben ellenőrizve).
- [ ] Prod DB: az `ai_message` két új oszlopa megvan; a teszt-beszélgetés után forget-sor `extraction_blocked=t`-vel és elfelejtett elemekkel; `fact_text` vétók nőttek; friss `companion_person_fact_extract` válasz nem `[]`.
- [ ] Backfill: dry-run lista megmutatva → tulajdonosi OK → apply → a cím-egyenlő, nem-statisztikus tények száma 0 → env bejegyzés eltávolítva. (Ha a tulajdonos nem ad OK-t, ez a pont „nem alkalmazva, tulajdonosi döntés" megjegyzéssel zárul.)

**Élő prototípus**
- [ ] `docs/design_2.0/prototypes/elo/mezo.html` egyezik a production-nel (eltérés esetén frissítve és újrapublikálva ugyanarra az URL-re); `elo/README.md` Mezo sor dátuma frissítve.
