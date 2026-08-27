# Fact opt-out must reach the graph Implementation Plan (`mezo-b3pp.30`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** make `knowledge_fact.include_in_prompt = false` — the user's explicit "don't put this in the companion's prompt" switch — actually stop the fact from reaching the prompt through the knowledge graph.

**The decision (the bd offered two).** bd `mezo-b3pp.30` offers either *filter promotion on `includeInPrompt` and archive the node when it flips false*, or *make the deliberate decision to ignore it explicit in the spec + docs*. We take the first, and it is not a close call: `GraphPromptAssembler` renders graph nodes into the **same system prompt** that `KnowledgeFactService.renderPromptBlock` writes into, and the codebase already states the governing principle at `KnowledgeFactService.java:124` — *"include_in_prompt is the user's kill-switch for EVERY injection channel — a toggled-off fact must never be announced either"*. That comment was itself a review finding on the V3.3 acknowledgment block. The graph is one more injection channel; the second option would mean shipping a switch the user can see and that silently leaks.

**Architecture:** `promoteFact` gains the `includeInPrompt` filter, and `retractFact`'s qualifying check gains the same condition — which is all the nightly sweep needs, because `mezo-b3pp.31` already built the complement sweep and the archive path. On top of that, a new `syncFact(userId, factId)` (the `syncGoal` shape: promote if qualifying, archive if not) and a `KnowledgeFactChangedEvent` from `KnowledgeFactService.update` make the toggle take effect on the next turn instead of at dawn.

**Urgency note this slice inherits.** Since `mezo-b3pp.31` shipped, the nightly `reconcile` promotion loop does not merely leave an opted-out fact's node alone — it re-upserts the node **and asserts `status='active'`** (the revive half). A user who archives the node by hand from the Tudástár UI has it silently resurrected by dawn. That makes the current behaviour actively user-hostile, not just incomplete.

**Tech Stack:** Java 21 / Spring Boot, JPA + Postgres, Spring `@TransactionalEventListener(AFTER_COMMIT)` + `@Async`, Testcontainers ITs.

## Global Constraints

- **bd id on every commit subject:** `(mezo-b3pp.30)`. Conventional-commit subjects.
- **Spec §11:** integration-first tests. No new LLM/embed call site → no `LlmCallContextHolder` obligation. No new table → `support/ResetDatabase.java` and the populators stay untouched.
- **No API contract change, no frontend change.** The Tudástár toggle that writes `includeInPrompt` already exists and is unchanged; there is no new REST surface. So: no `npm run generate:api` / `pnpm generate:api`, no `pnpm build`/`pnpm test` gate.
- **Archive, never soft-delete** (the `mezo-b3pp.31` rule): opting a fact out must archive its node, keeping the row and its `(created_by, source_kind, source_id)` anchor so opting back **in** revives the same node instead of building a duplicate.
- **Never mutate edges.** `GraphTraversalQuery` already filters `status='active'` on both endpoints.
- **Switch discipline:** `GraphPromotionService` stays gated on `KNOWLEDGE_GRAPH_SWITCH` alone; `GraphPromotionListener` stays array-AND'ed on `{COMPANION_SWITCH, KNOWLEDGE_GRAPH_SWITCH}`. `KnowledgeFactService` must stay **switch-blind** — it publishes unconditionally and must not import from the graph package.
- **Backend gate:** focused ITs only (`./mvnw clean test -Dtest='...' -Dmezo.test.use-testcontainers=true`, Docker up). The full suite is CI's job; Testcontainers mode is mandatory because the default fixed-DB mode races and fakes failures.
- **Docs in the same change:** `docs/features/companion.md` + one line in the design spec's §6.2; regenerate `docs/CODEMAP.md`; `node scripts/lint-docs.mjs` with no new staleness.

---

## File Structure

| File | Responsibility |
|---|---|
| **Modify** `backend/.../companion/graph/service/GraphPromotionService.java` | `promoteFact` filters on `includeInPrompt`; `retractFact`'s qualifying check gains the same condition; new `syncFact` (promote-or-archive). |
| **Modify** `backend/.../companion/graph/service/GraphPromotionListener.java` | Both fact handlers route through `syncFact`; new handler for the change event. |
| **Create** `backend/.../companion/service/KnowledgeFactChangedEvent.java` | `record KnowledgeFactChangedEvent(UUID userId, UUID factId)`. |
| **Modify** `backend/.../companion/service/KnowledgeFactService.java` | `update` publishes it. |
| **Create** `backend/src/test/.../companion/graph/GraphFactOptOutIT.java` | The opt-out truth table, service level + the async hop. |
| **Modify** `docs/features/companion.md`, `docs/superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md`, `docs/CODEMAP.md` | Ship state + the recorded decision. |

---

### Task 1: Honour `includeInPrompt` in promotion, retraction and the sweep

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphPromotionService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphFactOptOutIT.java` (new)

**Interfaces:**
- Consumes: `KnowledgeFactEntity.isIncludeInPrompt()`, `KnowledgeFactEntity.SOURCE_PATTERN`, `GraphService.findBySource`/`upsertNode`, `GraphNodeEntity.STATUS_ACTIVE`/`STATUS_ARCHIVED`, and the `archiveBySource` private helper added by `mezo-b3pp.31`.
- Produces (Task 2 calls this verbatim):
  ```java
  public Optional<GraphNodeEntity> syncFact(UUID userId, UUID factId)   // @Transactional
  ```
  Promotes when the fact qualifies, archives when it does not, returns the affected node or empty when there is nothing to do.

- [ ] **Step 1: Write the failing test** — `GraphFactOptOutIT.java`

Read `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphRetractionIT.java` first and mirror its harness exactly (base class, `@Autowired` set, populators, user setup, assertion style, `testX_shouldY_whenZ` naming). Assert on **re-read** entities (`nodeRepository.findById(...)`), never only on the returned instance. Cases:

```
testPromoteFact_shouldCreateNoNode_whenTheFactIsOptedOutOfThePrompt
  seed a manual fact with includeInPrompt=false; promoteFact => Optional.empty()
  and zero knowledge_node rows for that fact's id

testPromoteFact_shouldStillPromote_whenTheFactIsPromptIncluded
  the unchanged happy path — guards against the filter being too broad

testSyncFact_shouldArchiveTheNode_whenAPromotedFactIsOptedOut
  promote an included fact (node active); flip includeInPrompt=false through the repository;
  syncFact => the SAME node id is archived

testSyncFact_shouldReviveTheNode_whenAnOptedOutFactIsOptedBackIn
  ...continue from the previous state: flip includeInPrompt=true; syncFact
  => the SAME node id is active again, and there is still exactly ONE node for that fact
     (the (created_by, source_kind, source_id) anchor held; no duplicate)

testSyncFact_shouldDoNothing_whenTheFactWasNeverPromoted
  an opted-out fact that never had a node; syncFact => empty, no row created

testRetractFact_shouldArchiveTheNode_whenTheFactIsOptedOut
  promote, flip includeInPrompt=false, retractFact => node archived
  (retractFact's qualifying check must now count opt-out as "no longer qualifying")

testReconcile_shouldArchive_whenAPromotedFactWasOptedOutWithoutAnEvent
  promote (node active), flip includeInPrompt=false directly in the repository — simulating a
  toggle made while the graph switch was off — reconcile(owner)
  => result.retracted() == 1 and the node is archived

testReconcile_shouldNotResurrect_whenAnOptedOutFactsNodeWasArchived
  THE REGRESSION THIS SLICE EXISTS FOR: promote, flip includeInPrompt=false, archive the node
  (graphService.archive), then reconcile(owner) TWICE
  => the node is still archived after both runs, and result.upserted() never counts it
  (before this slice, mezo-b3pp.31's revive half re-asserted status='active' every night)

testReconcile_shouldLeavePromptIncludedFactsAlone_whenNothingWasOptedOut
  an included fact's node stays active and is counted as upserted, not retracted
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
cd backend && ./mvnw clean test -Dtest='GraphFactOptOutIT' -Dmezo.test.use-testcontainers=true
```
Expected: compilation failure (`syncFact` does not exist), and once that is stubbed, the opt-out cases fail on the missing filter.

- [ ] **Step 3: Filter `promoteFact` on `includeInPrompt`**

Add the filter to the existing chain, next to the pattern-source exclusion, and extend the javadoc:

```java
    /** Active, prompt-included, non-pattern-sourced knowledge fact -> PREFERENCE node.
     *  Re-promotion REVIVES an archived node (mezo-b3pp.31).
     *
     *  <p>{@code includeInPrompt} is filtered here (mezo-b3pp.30) because it is the user's
     *  kill-switch for EVERY injection channel — the wording is
     *  {@code KnowledgeFactService}'s own, where the same switch already gates the V1.1 facts
     *  block and the V3.3 acknowledgment block — and the graph is one more channel into the SAME
     *  system prompt: {@code GraphPromptAssembler} renders traversed nodes straight into it. A
     *  fact the user opted out of must therefore never become, or stay, an active node. */
    @Transactional
    public Optional<GraphNodeEntity> promoteFact(UUID userId, UUID factId) {
        return knowledgeFactRepository.findByIdAndCreatedByAndDeletedFalse(factId, userId)
            .filter(f -> !KnowledgeFactEntity.SOURCE_PATTERN.equals(f.getSource()))
            .filter(KnowledgeFactEntity::isIncludeInPrompt)
            .map(f -> { /* unchanged upsert + status assertion body */ });
    }
```

Keep the existing body of the `.map(...)` exactly as `mezo-b3pp.31` left it (upsert, then assert `STATUS_ACTIVE`).

- [ ] **Step 4: Teach `retractFact` that opt-out means "no longer qualifying"**

In `retractFact`, add the same condition to the `stillLive` chain and extend the javadoc to name the two ways a fact stops qualifying (soft-deleted, or opted out):

```java
        boolean stillLive = knowledgeFactRepository.findByIdAndCreatedByAndDeletedFalse(factId, userId)
            .filter(f -> !KnowledgeFactEntity.SOURCE_PATTERN.equals(f.getSource()))
            .filter(KnowledgeFactEntity::isIncludeInPrompt)
            .isPresent();
```

Also correct the javadoc sentence `mezo-b3pp.31` left there — it currently says nothing in main source soft-deletes a `knowledge_fact`, so the sweep is this method's only trigger. That stays true for the *delete* half, but the opt-out half now has a live trigger (`KnowledgeFactService.update` → Task 2's event). Say both plainly.

- [ ] **Step 5: Add `syncFact`**

Insert next to `syncGoal`, whose shape it mirrors:

```java
    /**
     * Promote-or-archive in one call (mezo-b3pp.30) — the {@link #syncGoal} shape, for the one
     * source whose qualifying condition the user can flip back and forth at will.
     *
     * <p>{@link #promoteFact} and {@link #retractFact} each answer only half the question, and a
     * caller reacting to "this fact changed" cannot know which half it needs: the same
     * {@code PUT} that opts a fact out can opt the next one back in. Routing both through here
     * keeps the listener free of that decision and makes the toggle take effect on the next turn
     * rather than at the nightly sweep.
     *
     * @return the promoted or archived node, or empty when there was nothing to do (an opted-out
     *         fact that was never promoted, or a node already in the target state)
     */
    @Transactional
    public Optional<GraphNodeEntity> syncFact(UUID userId, UUID factId) {
        Optional<GraphNodeEntity> promoted = promoteFact(userId, factId);
        return promoted.isPresent() ? promoted : retractFact(userId, factId);
    }
```

Note for the implementer: calling `promoteFact`/`retractFact` on `this` here is correct and deliberate — `syncFact` is already `@Transactional`, so the whole promote-or-archive decision belongs in ONE transaction, unlike `reconcile`'s per-item proxy calls (whose javadoc explains why *those* must not share one). Add a one-line comment saying so, or a reviewer will read it as the self-invocation bug.

- [ ] **Step 6: Run the tests — expect PASS**

```bash
cd backend && ./mvnw clean test -Dtest='GraphFactOptOutIT,GraphRetractionIT,GraphPromotionServiceIT,GraphPromotionServiceReconcileIsolationIT' -Dmezo.test.use-testcontainers=true
```
Expected: all green. If a pre-existing `GraphPromotionServiceIT`/`GraphRetractionIT` case seeds a fact without setting `includeInPrompt`, note that the column defaults to `true` (`KnowledgeFactEntity.java:62`), so those cases keep passing unchanged — if one does fail, the seed was relying on something else and you must read it, not "fix" it by loosening the filter.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph
git commit -m "fix(companion): graph promotion honours knowledge_fact.includeInPrompt (mezo-b3pp.30)"
```

---

### Task 2: Make the toggle immediate

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/KnowledgeFactChangedEvent.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/KnowledgeFactService.java` (`update`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphPromotionListener.java`
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphFactOptOutIT.java` **or** add the async cases to a new `GraphFactOptOutEventIT` — follow whichever matches `GraphPromotionEventIT`'s harness; the async cases need real commits, so they cannot live in a `@Transactional` test class.

**Interfaces:**
- Consumes from Task 1: `GraphPromotionService.syncFact(UUID, UUID)`.
- Produces: `KnowledgeFactChangedEvent(UUID userId, UUID factId)`.

- [ ] **Step 1: Write the failing test**

Mirror `GraphPromotionEventIT` exactly (non-`@Transactional`, Awaitility, same timeouts, absence asserted with the constant-condition idiom rather than a sleep). Cases:

```
testFactUpdate_shouldArchiveTheNode_whenTheFactIsOptedOutThroughTheApi
  promote an included fact (node active), then PUT the fact with includeInPrompt=false
  => await: the SAME node id is archived

testFactUpdate_shouldReviveTheNode_whenTheFactIsOptedBackIn
  ...then PUT includeInPrompt=true
  => await: the SAME node id is active again, still exactly ONE node for that fact

testFactUpdate_shouldRefreshTheTitle_whenTheFactTextIsEdited
  promote, then PUT a new factText
  => await: the node's title tracks the new text
  (a bonus the change event buys — before it, an edited fact's node title stayed stale until
   the nightly reconcile)

testFactUpdate_shouldCreateNoNode_whenAnOptedOutFactIsEdited
  an opted-out fact that was never promoted; PUT a new factText
  => await a quiet period: still zero nodes for that fact
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
cd backend && ./mvnw clean test -Dtest='GraphFactOptOutIT' -Dmezo.test.use-testcontainers=true
```
(or the new IT's name). Expected: the new cases fail — nothing publishes on update yet.

- [ ] **Step 3: Create `KnowledgeFactChangedEvent.java`**

```java
package io.mrkuhne.mezo.feature.companion.service;

import java.util.UUID;

/**
 * Published by {@code KnowledgeFactService.update} on every partial update (mezo-b3pp.30).
 * Distinct from {@link KnowledgeFactPromotedEvent}, which marks a candidate BECOMING a fact: this
 * one says "an existing fact changed, and the change may have flipped whether it belongs in the
 * companion's prompt at all" — the consumer re-derives the answer, so publishing on every update
 * (text, category or the {@code includeInPrompt} toggle) keeps the publisher free of that
 * decision, and incidentally keeps a renamed fact's graph node title fresh.
 */
public record KnowledgeFactChangedEvent(UUID userId, UUID factId) {
}
```

- [ ] **Step 4: Publish it from `KnowledgeFactService.update`**

The method currently ends `return mapper.toKnowledgeFactResponse(repository.save(fact));`. Publish before that return, inside the existing transaction (the consumer's AFTER_COMMIT phase owns the commit boundary — the `JournalService.delete` idiom):

```java
        // mezo-b3pp.30: include_in_prompt is the user's kill-switch for EVERY injection channel,
        // and the knowledge graph is one of them — GraphPromptAssembler renders traversed nodes
        // into the same system prompt this fact's own block writes into. Published on every
        // update, unconditionally: the consumer re-derives whether the fact still qualifies, and
        // this service must not learn about the graph switch (with the graph off, no bean
        // consumes this).
        eventPublisher.publishEvent(new KnowledgeFactChangedEvent(userId, factId));
```

`KnowledgeFactService` may not have an `ApplicationEventPublisher` injected yet — add it as a `private final` constructor dependency the way `PatternService`/`FactCandidateService` do (this class uses Lombok `@RequiredArgsConstructor`; check before editing). Do **not** import anything from the graph package.

- [ ] **Step 5: Route both fact handlers through `syncFact`**

In `GraphPromotionListener`, change the existing `onKnowledgeFactPromoted` body from `promotionService.promoteFact(...)` to `promotionService.syncFact(...)` — a freshly promoted candidate that is somehow already opted out must not become an active node either — and add the new handler in the same shape as its siblings (`@Async`, `@TransactionalEventListener(AFTER_COMMIT)`, try/catch-and-log, never rethrow, matching their log phrasing):

```java
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onKnowledgeFactChanged(KnowledgeFactChangedEvent event) {
        try {
            promotionService.syncFact(event.userId(), event.factId());
        } catch (Exception e) {
            log.warn("Graph fact sync failed for fact {}", event.factId(), e);
        }
    }
```

- [ ] **Step 6: Run the ITs — expect PASS**

```bash
cd backend && ./mvnw clean test -Dtest='GraphFactOptOutIT,GraphPromotionEventIT,GraphRetractionEventIT,GraphPromotionSwitchOffIT,CompanionFactApiIT,KnowledgeFactServiceIT' -Dmezo.test.use-testcontainers=true
```
(`CompanionFactApiIT` is the REST-level fact IT, `KnowledgeFactServiceIT` the service-level one.) `GraphPromotionSwitchOffIT` matters: the new event is published unconditionally, so with the graph switch off a fact update must still succeed and write no nodes — add that case there if it is not covered.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature backend/src/test/java/io/mrkuhne/mezo/feature
git commit -m "feat(companion): fact opt-out reaches the graph on the next turn, not at dawn (mezo-b3pp.30)"
```

---

### Task 3: Docs, the recorded decision, and the gates

**Files:**
- Modify: `docs/features/companion.md` — the W2.2 promotion section (the three-promoter list and the `GraphPromotionListener` sub-section), the `retractFact` bullet that currently says the sweep is its only trigger and cross-references this bd id, and the decisions section. Bump `updated:`.
- Modify: `docs/superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md` §6.2 — one clause on the promotion rule.
- Modify: `docs/CODEMAP.md` (regenerate).

- [ ] **Step 1: Record the decision and the shipped seams**

`companion.md` must now say:
- Promotion honours `include_in_prompt`. State the reasoning once, plainly: it is the user's kill-switch for every injection channel (the wording `KnowledgeFactService` already uses for the V1.1 and V3.3 blocks), and `GraphPromptAssembler` renders traversed nodes into the same system prompt — so the graph is another channel, not an exception. Name this as the resolution of bd `mezo-b3pp.30`'s explicit either/or, and say which option was taken and why the other was not.
- `syncFact` — promote-or-archive in one transaction, the `syncGoal` shape, and why the listener routes through it rather than picking a half.
- `KnowledgeFactChangedEvent` — published unconditionally by `update`, consumed by the new AFTER_COMMIT handler; the toggle now takes effect on the next turn instead of at the nightly sweep. Mention the incidental win: an edited fact's node title no longer goes stale until dawn.
- **Correct the `retractFact` bullet** `mezo-b3pp.31` left behind: the sweep is no longer its only trigger. The *delete* half still has none (nothing in main source soft-deletes a `knowledge_fact`); the *opt-out* half now does. Remove or rewrite the `mezo-b3pp.30` cross-reference, which is now this slice.
- Call out the regression this closes: before it, `mezo-b3pp.31`'s revive half made the nightly `reconcile` re-assert `status='active'` on an opted-out fact's node, so a manual archive from the Tudástár UI was undone by dawn.

Spec §6.2: extend the `knowledge_fact (active) → PREFERENCE node` clause to read `active AND prompt-included`, with a parenthetical pointing at `mezo-b3pp.30`.

- [ ] **Step 2: Regenerate the codemap and lint the docs**

```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check && node scripts/lint-docs.mjs 2>&1 | tail -5
```
Expected: `--check` passes; `lint-docs` shows no NEW findings versus the pre-edit baseline (capture it by running the linter once before editing — the repo has unrelated pre-existing stale docs).

- [ ] **Step 3: Focused backend gate**

```bash
cd backend && ./mvnw clean test -Dtest='GraphFactOptOutIT,GraphRetractionIT,GraphRetractionEventIT,GraphPromotionServiceIT,GraphPromotionServiceReconcileIsolationIT,GraphPromotionEventIT,GraphPromotionSwitchOffIT,GraphMaintenanceServiceIT,CompanionFactApiIT,KnowledgeFactServiceIT' -Dmezo.test.use-testcontainers=true
```
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add docs/features/companion.md docs/superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md docs/CODEMAP.md
git commit -m "docs(features): companion — graph promotion honours the fact prompt opt-out (mezo-b3pp.30)"
```

---

## Self-Review

- **bd coverage.** "`promoteFact` does not filter on `includeInPrompt`" → Task 1 Step 3. "archive the node when it flips false" → Task 1 Steps 4–5 plus Task 2's event; the nightly path needs no new code because `mezo-b3pp.31`'s complement sweep already calls `retractFact`, which Step 4 teaches the new condition. "MUST be settled before W2.4" is overtaken — W2.4 shipped, which is why the immediate half is in scope and not just the sweep. The bd's second option (document the deliberate ignore) is explicitly rejected, with the reason recorded in the docs so the question is closed rather than re-opened.
- **What this plan adds beyond the bd:** the opt-back-**in** direction (`syncFact` + the revive assertion `mezo-b3pp.31` added), which the bd does not mention and without which the switch would be one-way; and the stale-title fix that falls out of publishing on every update.
- **Placeholders.** Production code is literal. Test bodies are named cases with exact seed→act→assert, deferring harness boilerplate to the two IT files they must mirror (`GraphRetractionIT`, `GraphPromotionEventIT`) rather than reproducing a base-class setup this plan cannot copy accurately.
- **Type consistency.** `syncFact(UUID, UUID) -> Optional<GraphNodeEntity>` is declared in Task 1's Interfaces block and called verbatim by Task 2's two handlers. `KnowledgeFactChangedEvent(UUID userId, UUID factId)` matches its handler's `event.userId()`/`event.factId()`. `isIncludeInPrompt()` is the real accessor for the `include_in_prompt` column (`KnowledgeFactEntity.java:61-62`, a primitive `boolean` defaulting to `true`).
