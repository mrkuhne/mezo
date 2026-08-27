# Graph node retraction Implementation Plan (`mezo-b3pp.31`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** make knowledge-graph promotion two-way — a pattern the user un-confirms, a goal the user deletes, and a soft-deleted knowledge fact must all stop asserting themselves in the graph, instead of leaving an `active` node that `GraphTraversalService` keeps feeding into the `[Összefüggések]` prompt block forever.

**Architecture:** two halves, exactly as the bd issue proposes. (1) **Event-driven, immediate:** `PatternService.decide`'s non-confirm branches and `GoalService.deleteGoal` publish retraction events that `GraphPromotionListener` turns into `GraphPromotionService.retractPattern`/`retractGoal` — archiving the node (`status='archived'`), which `GraphTraversalQuery` already excludes (`n.status = 'active'`, `GraphTraversalQuery.java:79,94,96,106`). (2) **Reconcile-side sweep over the complement sets:** `reconcile(userId)` gains a retraction phase that walks the user's *active* graph nodes and archives every one whose source row no longer qualifies — the only thing that can heal a retraction missed while the graph switch was off, and the only reachable fix for the `knowledge_fact` case, which has **no delete path in main source today**.

A third, load-bearing piece falls out of this: **archiving must be reversible.** `GraphService.upsertNode` never touches `status`, so once this slice starts archiving, a re-confirmed pattern would upsert into a node that stays `archived` forever. `promotePattern`/`promoteFact` must therefore assert `status = active` on every promotion, the way `syncGoal` already does (`GraphPromotionService.java:111-114`).

**Tech Stack:** Java 21 / Spring Boot, JPA + Postgres, Spring `@TransactionalEventListener(AFTER_COMMIT)` + `@Async`, integration tests on Testcontainers (`AbstractIntegrationTest`/`ApiIntegrationTest`), Awaitility for the async event hops.

## Global Constraints

- **bd id on every commit subject:** `(mezo-b3pp.31)`. Conventional-commit subjects.
- **Spec §11 (`docs/superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md`):** integration-first tests. **No new LLM/embed call site is added by this slice**, so the `LlmCallContextHolder.runWith(...)` clause has nothing to bind. **No new table**, so no `ResetDatabase` truncate-list entry and no new populator (`knowledge_node`/`knowledge_edge` are already in `support/ResetDatabase.java:40`; `support/populator/GraphPopulator.java` already exists).
- **No API contract change.** Retraction is internal — no REST surface, no `api/feature/...` fragment, no `npm run generate:api` / `pnpm generate:api`. **No frontend change**, so no `pnpm build`/`pnpm test` gate.
- **Switch discipline (spec §3 config idiom):** `GraphPromotionService` stays gated on `KNOWLEDGE_GRAPH_SWITCH` alone; `GraphPromotionListener` stays array-AND'ed on `{COMPANION_SWITCH, KNOWLEDGE_GRAPH_SWITCH}`. The new events are published **unconditionally** by `PatternService`/`GoalService` — those features must not learn about the graph switch; with the graph off the listener bean simply does not exist and nobody consumes them. This mirrors how `PatternConfirmedEvent`/`GoalSavedEvent` already work.
- **Archive, never soft-delete.** `status='archived'` is the visible L2 lifecycle state and keeps the row (`companion.md` §"knowledge_node": *"Archiving a node keeps the row, just out of active listing/traversal"*). Do **not** call `nodeRepository.delete(...)` anywhere in this slice — a soft delete would break the `(created_by, source_kind, source_id)` idempotency anchor's revival path.
- **Never touch edges.** Archiving a node leaves its edges alone; `GraphTraversalQuery` already refuses to traverse into a non-active node from both directions (`:94`, `:96`). Edge decay/prune stays W2.5's job.
- **Backend gate:** focused ITs only (`./mvnw clean test -Dtest='...'`) — the full suite is CI's job. Docker compose must be up.
- **Docs in the same change:** `docs/features/companion.md`; regenerate `docs/CODEMAP.md` (`node scripts/gen-codemap.mjs`, CI enforces `--check`); `node scripts/lint-docs.mjs` with no new staleness.

---

## File Structure

| File | Responsibility |
|---|---|
| **Modify** `backend/.../companion/graph/service/GraphPromotionService.java` | `promotePattern`/`promoteFact` assert `status=active`; new `retractPattern`/`retractGoal`/`retractFact`; `reconcile` gains the retraction sweep and returns a result record. |
| **Create** `backend/.../companion/graph/service/GraphReconcileResult.java` | `record GraphReconcileResult(int upserted, int retracted)` — `reconcile`'s honest return. |
| **Modify** `backend/.../companion/graph/service/GraphPromotionListener.java` | Two new AFTER_COMMIT `@Async` handlers. |
| **Modify** `backend/.../companion/graph/service/GraphMaintenanceJob.java` | Log both halves of the reconcile result. |
| **Create** `backend/.../companion/service/PatternRetractedEvent.java` | `record PatternRetractedEvent(UUID userId, UUID patternId)`. |
| **Modify** `backend/.../companion/service/PatternService.java` | Publish it on the non-confirm branches of `decide`. |
| **Create** `backend/.../goal/service/GoalDeletedEvent.java` | `record GoalDeletedEvent(UUID userId, UUID goalId)`. |
| **Modify** `backend/.../goal/service/GoalService.java` | Publish it in `deleteGoal`. |
| **Create** `backend/src/test/.../companion/graph/GraphRetractionIT.java` | The service-layer truth table: archive, revive, and the sweep. |
| **Create** `backend/src/test/.../companion/graph/GraphRetractionEventIT.java` | The two async event hops end-to-end (`GraphPromotionEventIT` idiom). |
| **Modify** `backend/src/test/.../companion/graph/GraphPromotionServiceIT.java`, `GraphPromotionServiceReconcileIsolationIT.java` | `reconcile` now returns a record — `.upserted()` at the three existing assertion sites. |
| **Modify** `docs/features/companion.md`, `docs/CODEMAP.md` | Ship state. |

---

### Task 1: Retraction in `GraphPromotionService` (archive, revive, sweep)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphReconcileResult.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphPromotionService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphMaintenanceJob.java:57-61`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphPromotionServiceIT.java:377-378`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphPromotionServiceReconcileIsolationIT.java:61`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphRetractionIT.java` (new)

**Interfaces:**
- Consumes: `GraphService.findBySource(userId, sourceKind, sourceId)` → `Optional<GraphNodeEntity>`; `GraphService.upsertNode(...)`; `GraphNodeEntity.STATUS_ACTIVE`/`STATUS_ARCHIVED`; `GraphNodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(userId, status)`; `PatternRepository.findByIdAndCreatedByAndDeletedFalse`; `KnowledgeFactRepository.findByIdAndCreatedByAndDeletedFalse`; `GoalRepository.findByIdAndCreatedByAndDeletedFalse`.
- Produces (Task 2 calls these verbatim):
  ```java
  public Optional<GraphNodeEntity> retractPattern(UUID userId, UUID patternId)  // @Transactional
  public Optional<GraphNodeEntity> retractGoal(UUID userId, UUID goalId)        // @Transactional
  public Optional<GraphNodeEntity> retractFact(UUID userId, UUID factId)        // @Transactional
  public GraphReconcileResult reconcile(UUID userId)                            // NOT @Transactional
  public record GraphReconcileResult(int upserted, int retracted) {}
  ```
  Each `retract*` returns the archived node, or `Optional.empty()` when there is no node for that source (never promoted) or the node is already archived.

- [ ] **Step 1: Write the failing test** — `GraphRetractionIT.java`

Follow the existing `GraphPromotionServiceIT` scaffolding exactly (same base class, same `@Autowired` services/repositories, same populators, same user setup — read that file first and mirror it; do not invent a new harness). The cases, each its own `@Test`, named in this codebase's `testX_shouldY_whenZ` style:

```
testRetractPattern_shouldArchiveTheNode_whenAConfirmedPatternIsRejected
  seed a confirmed pattern; promotePattern -> node active
  set the pattern's status to STATUS_REJECTED (repository write, no service needed)
  retractPattern(owner, patternId)
  => the SAME node row (same id) now has status = archived, is_deleted = false

testRetractPattern_shouldArchiveTheNode_whenAConfirmedPatternDropsToMonitoring
  same, with STATUS_MONITORING

testRetractPattern_shouldDoNothing_whenThePatternIsStillConfirmed
  promote, then retractPattern WITHOUT changing the status
  => Optional.empty(), node still active
  (this is the guard that makes the event safe to publish on any non-confirm decide)

testRetractPattern_shouldReturnEmpty_whenTheSourceWasNeverPromoted
  a confirmed pattern that was never promoted; retractPattern => empty, no node row created

testPromotePattern_shouldReviveTheNode_whenAnArchivedPatternIsReconfirmed
  promote -> reject -> retract (node archived) -> set status back to CONFIRMED -> promotePattern
  => the SAME node id is status = active again
  (pins the revive half; without it archiving is a one-way trip)

testRetractGoal_shouldArchiveTheNode_whenTheGoalIsSoftDeleted
  seed an ACTIVE goal; syncGoal -> node active
  goalRepository.delete(goal)   // @SQLDelete soft-delete
  retractGoal(owner, goalId) => node archived

testPromoteFact_shouldReviveTheNode_whenAnArchivedFactIsRepromoted
  promoteFact -> retractFact (after soft-deleting the fact) -> node archived
  undelete is not reachable through JPA here, so instead: seed a SECOND active fact, promote it,
  archive its node directly via graphService.archive(...), then promoteFact again
  => node active again

testReconcile_shouldArchive_whenAPatternWasUnconfirmedWithoutAnEvent
  promote a confirmed pattern (node active), then flip the pattern to STATUS_REJECTED directly
  in the repository — simulating a decide that happened while the graph switch was off
  reconcile(owner) => result.retracted() == 1, the node is archived, result.upserted() counts
  only the rows that still qualify

testReconcile_shouldArchive_whenAGoalWasSoftDeletedWithoutAnEvent
  syncGoal (node active), goalRepository.delete(goal), reconcile => node archived

testReconcile_shouldArchive_whenAKnowledgeFactWasSoftDeleted
  promoteFact (node active), knowledgeFactRepository.delete(fact), reconcile => node archived
  (there is NO service-level fact delete in main source today — this is the only way the seam
   is reachable, and the reason the sweep is the fix rather than an event)

testReconcile_shouldLeaveQualifyingNodesAlone_whenNothingWasRetracted
  a confirmed pattern, an active fact and an active goal, all promoted
  reconcile => retracted() == 0 and all three nodes still active

testReconcile_shouldBeStable_whenRunTwice
  after a sweep that archived one node, a second reconcile returns retracted() == 0
  and does not flip anything back

testReconcile_shouldIgnoreForeignNodes_whenAnotherUserOwnsThem
  a second user's active node whose source row is deleted must NOT be archived by
  reconcile(owner) — the sweep is per-user, like every other phase
```

Assert on re-read entities (`nodeRepository.findById(...)`), not on the returned instance alone, so a missing flush cannot make a test pass falsely.

- [ ] **Step 2: Run it and confirm it fails**

```bash
cd backend && ./mvnw clean test -Dtest='GraphRetractionIT' -Dmezo.test.use-testcontainers=true
```
Expected: compilation failure — `retractPattern`/`retractGoal`/`retractFact`/`GraphReconcileResult` do not exist.

- [ ] **Step 3: Create `GraphReconcileResult.java`**

```java
package io.mrkuhne.mezo.feature.companion.graph.service;

/**
 * What one {@link GraphPromotionService#reconcile} sweep did (bd mezo-b3pp.31). Promotion used to
 * be one-way, so a plain upsert count was the whole story; now the sweep also walks the
 * COMPLEMENT sets — active nodes whose source row stopped qualifying — and archives them, and
 * those two numbers must not be summed into one meaningless total.
 *
 * @param upserted  nodes created or refreshed from a source row that still qualifies
 * @param retracted active nodes archived because their source row no longer qualifies
 */
public record GraphReconcileResult(int upserted, int retracted) {
}
```

- [ ] **Step 4: Assert `active` on promotion (the revive half)**

In `GraphPromotionService.promotePattern`, after the `upsertNode` call and before the `if (isNew)` block, insert:

```java
        // Promotion is now two-way (mezo-b3pp.31): retractPattern archives this node when the
        // user un-confirms. GraphService.upsertNode never touches `status`, so without this line
        // a re-confirmed pattern would upsert into a node that stays `archived` forever and
        // never returns to the traversal — archiving would be a one-way trip. syncGoal has
        // always asserted its own status this way; the other two promoters now match it.
        if (!GraphNodeEntity.STATUS_ACTIVE.equals(node.getStatus())) {
            node.setStatus(GraphNodeEntity.STATUS_ACTIVE);
        }
```

In `promoteFact`, replace the `.map(...)` body so the same assertion runs — keep the method's shape, just bind the upserted node to a local first:

```java
    /** Active (non-pattern-sourced) knowledge fact -> PREFERENCE node. Re-promotion REVIVES an
     *  archived node (mezo-b3pp.31) — see the note in {@link #promotePattern}. */
    @Transactional
    public Optional<GraphNodeEntity> promoteFact(UUID userId, UUID factId) {
        return knowledgeFactRepository.findByIdAndCreatedByAndDeletedFalse(factId, userId)
            .filter(f -> !KnowledgeFactEntity.SOURCE_PATTERN.equals(f.getSource()))
            .map(f -> {
                GraphNodeEntity node = graphService.upsertNode(userId, GraphNodeEntity.KIND_PREFERENCE,
                    truncateTitle(f.getFactText()), f.getFactText(), SOURCE_FACT, f.getId(), null,
                    Map.of("category", f.getCategory(), "source", f.getSource()));
                if (!GraphNodeEntity.STATUS_ACTIVE.equals(node.getStatus())) {
                    node.setStatus(GraphNodeEntity.STATUS_ACTIVE);
                }
                return node;
            });
    }
```

- [ ] **Step 5: Add the three `retract*` methods**

Insert after `syncGoal`:

```java
    /**
     * The mirror of {@link #promotePattern} (bd mezo-b3pp.31): a pattern that is no longer
     * confirmed must stop asserting itself in the graph. Archives the node rather than deleting
     * it — {@code status='archived'} keeps the row (and with it the
     * {@code (createdBy, sourceKind, sourceId)} anchor, so a later re-confirm revives the SAME
     * node and its edges instead of building a second one), while
     * {@code GraphTraversalQuery}'s {@code status = 'active'} filter takes it out of the
     * [Összefüggések] prompt block immediately.
     *
     * <p>Re-checks the pattern's status itself instead of trusting the caller, so
     * {@code PatternService.decide} can publish the retraction event on ANY non-confirm branch
     * without the listener having to reason about which transitions matter.
     *
     * @return the archived node, or empty when the pattern is still confirmed, was never
     *         promoted, or the node is already archived (all no-ops)
     */
    @Transactional
    public Optional<GraphNodeEntity> retractPattern(UUID userId, UUID patternId) {
        boolean stillConfirmed = patternRepository.findByIdAndCreatedByAndDeletedFalse(patternId, userId)
            .filter(p -> PatternEntity.STATUS_CONFIRMED.equals(p.getStatus()))
            .isPresent();
        if (stillConfirmed) {
            return Optional.empty();
        }
        return archiveBySource(userId, SOURCE_PATTERN, patternId);
    }

    /** The mirror of {@link #syncGoal} for the DELETE path (bd mezo-b3pp.31). {@code syncGoal}
     *  already demotes a goal that merely stops being active, but a soft-deleted goal is invisible
     *  to it (its finder is {@code ...AndDeletedFalse}), so the delete needs its own retraction. */
    @Transactional
    public Optional<GraphNodeEntity> retractGoal(UUID userId, UUID goalId) {
        boolean stillLive = goalRepository.findByIdAndCreatedByAndDeletedFalse(goalId, userId).isPresent();
        if (stillLive) {
            return Optional.empty();
        }
        return archiveBySource(userId, SOURCE_GOAL, goalId);
    }

    /** The mirror of {@link #promoteFact} (bd mezo-b3pp.31). No service in main source
     *  soft-deletes a {@code knowledge_fact} today, so nothing publishes a fact-retraction event;
     *  this exists for {@link #reconcile}'s sweep, and is ready for the day a delete surface
     *  lands. */
    @Transactional
    public Optional<GraphNodeEntity> retractFact(UUID userId, UUID factId) {
        boolean stillLive = knowledgeFactRepository.findByIdAndCreatedByAndDeletedFalse(factId, userId)
            .filter(f -> !KnowledgeFactEntity.SOURCE_PATTERN.equals(f.getSource()))
            .isPresent();
        if (stillLive) {
            return Optional.empty();
        }
        return archiveBySource(userId, SOURCE_FACT, factId);
    }

    /** Archive the node behind one source row, if there is one and it is not archived already. */
    private Optional<GraphNodeEntity> archiveBySource(UUID userId, String sourceKind, UUID sourceId) {
        return graphService.findBySource(userId, sourceKind, sourceId)
            .filter(n -> !GraphNodeEntity.STATUS_ARCHIVED.equals(n.getStatus()))
            .map(n -> {
                n.setStatus(GraphNodeEntity.STATUS_ARCHIVED);
                return n;
            });
    }
```

`archiveBySource` relies on JPA dirty checking inside the caller's transaction, exactly as `syncGoal` already does at `GraphPromotionService.java:111-114` — do not add a `saveAndFlush`.

- [ ] **Step 6: Add the retraction sweep to `reconcile` and change its return type**

Change the signature to `public GraphReconcileResult reconcile(UUID userId)`, keep the three existing promotion loops exactly as they are (counting into `count`), and add a fourth loop after them, before the `skipped` log:

```java
        // The COMPLEMENT sweep (mezo-b3pp.31). The three loops above only ever see rows that
        // still qualify — confirmed patterns, non-deleted facts, non-deleted goals — so a row
        // that LEAVES those sets is invisible to them and its node would stay active forever.
        // This walks the other way round: from the user's active nodes back to their source row,
        // archiving every node whose source stopped qualifying. It is what heals a retraction
        // that happened while the graph switch was off (no listener existed to hear the event),
        // and it is the ONLY path that retracts a soft-deleted knowledge_fact, since nothing in
        // main source deletes one and so no event is published for it.
        int retracted = 0;
        for (GraphNodeEntity node : graphService.listActive(userId)) {
            UUID sourceId = node.getSourceId();
            if (sourceId == null) {
                continue;   // extractor/quarterly/profile nodes own their own lifecycle
            }
            try {
                boolean archived = switch (node.getSourceKind() == null ? "" : node.getSourceKind()) {
                    case SOURCE_PATTERN -> proxy.retractPattern(userId, sourceId).isPresent();
                    case SOURCE_FACT -> proxy.retractFact(userId, sourceId).isPresent();
                    case SOURCE_GOAL -> proxy.retractGoal(userId, sourceId).isPresent();
                    default -> false;
                };
                retracted += archived ? 1 : 0;
            } catch (Exception e) {
                skipped++;
                log.warn("Reconcile: node {} retraction check failed for user {}", node.getId(), userId, e);
            }
        }
```

and return `new GraphReconcileResult(count, retracted)`.

Notes the implementer must honour: the sweep goes through `proxy` for the same per-item-transaction reason the promotion loops do (see `reconcile`'s existing javadoc); it must run **after** the promotion loops so a row that was just re-promoted in this same sweep is seen in its post-promotion state; and it must skip nodes with a `sourceKind` this service does not own (`extractor`, `quarterly`, the profile node) — those have their own lifecycles and archiving them here would be a data-loss bug.

Extend `reconcile`'s javadoc with a paragraph describing the sweep and update its `@return` to name both numbers.

- [ ] **Step 7: Update the three call sites**

`GraphMaintenanceJob.java:57-61` — replace the `int upserted = ...` line and its log so both halves are reported:
```java
                GraphReconcileResult reconciled = graphPromotionService.reconcile(user.getId());
```
and reference `reconciled.upserted()` / `reconciled.retracted()` in the existing log statement (keep the log's level and its surrounding try/catch untouched).

`GraphPromotionServiceIT.java:377-378` and `GraphPromotionServiceReconcileIsolationIT.java:61` — the assertions there are about upserts; append `.upserted()` to the `reconcile(...)` calls so their meaning is unchanged.

- [ ] **Step 8: Run the tests — expect PASS**

```bash
cd backend && ./mvnw clean test -Dtest='GraphRetractionIT,GraphPromotionServiceIT,GraphPromotionServiceReconcileIsolationIT,GraphMaintenanceServiceIT' -Dmezo.test.use-testcontainers=true
```
Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph
git commit -m "feat(companion): retract graph nodes when their source stops qualifying (mezo-b3pp.31)"
```

---

### Task 2: The two retraction events

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternRetractedEvent.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalDeletedEvent.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternService.java` (the `decide` publish block, `:81-85`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalService.java` (`deleteGoal`, `:72-80`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphPromotionListener.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphRetractionEventIT.java` (new)

**Interfaces:**
- Consumes from Task 1: `GraphPromotionService.retractPattern(UUID, UUID)`, `retractGoal(UUID, UUID)`.
- Produces: `PatternRetractedEvent(UUID userId, UUID patternId)`, `GoalDeletedEvent(UUID userId, UUID goalId)`.

- [ ] **Step 1: Write the failing test** — `GraphRetractionEventIT.java`

Mirror `GraphPromotionEventIT` exactly — same base class, same non-`@Transactional` shape (real commits are required for AFTER_COMMIT to fire), same Awaitility usage and timeouts. Read that file before writing. Cases:

```
testPatternDecide_shouldArchiveTheNode_whenAConfirmedPatternIsRejected
  decide(confirm) -> await: exactly one active node for the pattern
  decide(reject)  -> await: that SAME node id is status = archived

testPatternDecide_shouldArchiveTheNode_whenAConfirmedPatternDropsToMonitoring
  decide(confirm) -> decide(monitor) -> await archived

testPatternDecide_shouldReviveTheNode_whenARejectedPatternIsConfirmedAgain
  decide(confirm) -> decide(reject) -> await archived -> decide(confirm)
  -> await: the SAME node id is active again, and there is still exactly ONE node for that
     pattern (the anchor held; no duplicate was created)

testPatternDecide_shouldNotCreateANode_whenAPatternIsRejectedWithoutEverBeingConfirmed
  decide(reject) on a proposed pattern -> await a short quiet period -> zero nodes for it

testGoalDelete_shouldArchiveTheNode_whenAnActiveGoalIsDeleted
  create+activate a goal (GoalSavedEvent promotes it) -> await active node
  deleteGoal -> await: that node is archived
```

The "nothing happened" cases need the `GraphPromotionEventIT` idiom for asserting absence over an async boundary — reuse whatever that file already does (do not invent a bare `Thread.sleep`).

- [ ] **Step 2: Run it and confirm it fails**

```bash
cd backend && ./mvnw clean test -Dtest='GraphRetractionEventIT' -Dmezo.test.use-testcontainers=true
```
Expected: compilation failure — the two event records do not exist.

- [ ] **Step 3: Create the two event records**

`PatternRetractedEvent.java` — mirror `PatternConfirmedEvent.java`'s shape and javadoc density:
```java
package io.mrkuhne.mezo.feature.companion.service;

import java.util.UUID;

/**
 * Published by {@code PatternService.decide} whenever a pattern lands in a status that is NOT
 * confirmed (bd mezo-b3pp.31) — the mirror of {@link PatternConfirmedEvent}. Fires on EVERY such
 * decide, not only on a transition out of confirmed: the consumer re-reads the pattern's status
 * anyway, so a pattern that was never confirmed simply has no node to retract and the handler is
 * a no-op. Keeping the publish rule that simple is what keeps {@code decide} free of any
 * knowledge about the graph.
 */
public record PatternRetractedEvent(UUID userId, UUID patternId) {
}
```

`GoalDeletedEvent.java` — mirror `GoalSavedEvent.java`:
```java
package io.mrkuhne.mezo.feature.goal.service;

import java.util.UUID;

/**
 * Published by {@code GoalService.deleteGoal} (bd mezo-b3pp.31). {@link GoalSavedEvent} covers
 * every write that can change a goal's title or status, and the graph's {@code syncGoal} demotes
 * a goal that merely stops being active — but a soft-deleted goal is invisible to that finder, so
 * the delete needs an event of its own or its GOAL node stays active forever.
 */
public record GoalDeletedEvent(UUID userId, UUID goalId) {
}
```

- [ ] **Step 4: Publish from `PatternService.decide`**

Turn the existing confirm-only publish block (`PatternService.java:81-85`) into the symmetric pair, keeping the existing comment:

```java
        if (PatternEntity.STATUS_CONFIRMED.equals(status)) {
            // W2.2 (mezo-b3pp.7): every confirm re-syncs the graph node; the promotion itself is
            // an idempotent UPSERT, so a re-confirm costs nothing and never duplicates.
            eventPublisher.publishEvent(new PatternConfirmedEvent(userId, pattern.getId()));
        } else {
            // mezo-b3pp.31: the mirror. An un-confirmed pattern must stop asserting itself in the
            // graph — the consumer re-reads the status, so publishing on every non-confirm branch
            // (including a reject that was never confirmed) is safe and keeps the rule simple.
            eventPublisher.publishEvent(new PatternRetractedEvent(userId, pattern.getId()));
        }
```

- [ ] **Step 5: Publish from `GoalService.deleteGoal`**

Append the publish as the last statement of `deleteGoal`, after `goalRepository.delete(goal)`:

```java
        // mezo-b3pp.31: the graph shadows a goal's lifecycle, and a soft-deleted goal is invisible
        // to GoalSavedEvent's consumer (syncGoal's finder is ...AndDeletedFalse), so the delete
        // gets its own event. Published INSIDE the transaction; the consumer's AFTER_COMMIT phase
        // is what makes the commit boundary its problem, not ours (the JournalService idiom).
        eventPublisher.publishEvent(new GoalDeletedEvent(userId, id));
```

- [ ] **Step 6: Add the two listener handlers**

In `GraphPromotionListener`, add the imports and two handlers matching the existing three exactly in shape — `@Async`, `@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)`, try/catch-and-log, never rethrow:

```java
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPatternRetracted(PatternRetractedEvent event) {
        try {
            promotionService.retractPattern(event.userId(), event.patternId());
        } catch (Exception e) {
            log.warn("Graph pattern retraction failed for pattern {}", event.patternId(), e);
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onGoalDeleted(GoalDeletedEvent event) {
        try {
            promotionService.retractGoal(event.userId(), event.goalId());
        } catch (Exception e) {
            log.warn("Graph goal retraction failed for goal {}", event.goalId(), e);
        }
    }
```

Match the exact log-message phrasing style of the three existing handlers (read them first).

- [ ] **Step 7: Run the ITs — expect PASS**

```bash
cd backend && ./mvnw clean test -Dtest='GraphRetractionEventIT,GraphPromotionEventIT,GraphPromotionSwitchOffIT,CompanionPatternApiIT,CompanionPatternMonitorApiIT,GoalServiceIT' -Dmezo.test.use-testcontainers=true
```
Expected: all green. `GraphPromotionSwitchOffIT` matters here — the two new events are published unconditionally, and with the graph switch off nothing may blow up on the publish.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature backend/src/test/java/io/mrkuhne/mezo/feature
git commit -m "feat(companion): publish pattern-retracted and goal-deleted events for the graph (mezo-b3pp.31)"
```

---

### Task 3: Docs + gates

**Files:**
- Modify: `docs/features/companion.md` — the W2.2 row in the status table (`:591`), the W2.5 row (`:594`), the `knowledge_node` lifecycle paragraph (`:1421-1422`), the W2.2 section (`:1450-1530`, in particular the three-promoter list at `:1455-1470` and the `GraphPromotionListener` sub-section at `:1513-1526`), and `reconcile`'s description (`:1540`). Bump `updated:`.
- Modify: `docs/CODEMAP.md` (regenerate).

- [ ] **Step 1: Edit `companion.md`**

What the prose must now say, in the doc's own voice:
- Promotion is **two-way**. Each promoter has a mirror: `retractPattern` (pattern no longer confirmed), `retractGoal` (goal soft-deleted — `syncGoal` already demotes a merely-inactive goal but cannot see a deleted one), `retractFact` (fact soft-deleted; **no delete path exists in main source today**, so nothing publishes a fact retraction and the sweep is its only trigger — say this plainly rather than implying a live seam).
- Retraction **archives, never deletes**: the row and its `(created_by, source_kind, source_id)` anchor survive, which is exactly what lets a re-confirm revive the same node instead of building a second one. `GraphTraversalQuery`'s `status = 'active'` filter is what takes an archived node out of the `[Összefüggések]` block.
- **Promotion now asserts `status='active'`** — the revive half. Without it archiving would be one-way, because `GraphService.upsertNode` never touches `status`.
- **Events:** `PatternRetractedEvent` (published on every non-confirm branch of `decide`; the consumer re-reads the status, so a never-confirmed reject is a harmless no-op) and `GoalDeletedEvent` (published by `deleteGoal`). Both unconditional on the publisher side — with the graph switch off the listener bean does not exist and nobody consumes them.
- **`reconcile` now returns `GraphReconcileResult(upserted, retracted)`** and runs a fourth, complement-set sweep after the three promotion loops: from the user's active nodes back to their source row, archiving any whose source stopped qualifying, per-row isolated like the rest, skipping `sourceKind`s it does not own (`extractor`, `quarterly`, profile). This is what heals a retraction missed while the switch was off — update the W2.5 row so the job's phase-2 description names both halves.

- [ ] **Step 2: Regenerate the codemap and lint the docs**

```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check && node scripts/lint-docs.mjs 2>&1 | tail -5
```
Expected: `--check` passes; `lint-docs` shows no NEW findings versus the pre-change baseline (run it once before editing to capture that baseline — the repo has pre-existing stale docs unrelated to this slice).

- [ ] **Step 3: Focused backend gate over everything this slice touches**

```bash
cd backend && ./mvnw clean test -Dtest='GraphRetractionIT,GraphRetractionEventIT,GraphPromotionServiceIT,GraphPromotionServiceReconcileIsolationIT,GraphPromotionEventIT,GraphPromotionSwitchOffIT,GraphMaintenanceServiceIT,GraphMaintenanceJobSwitchOffIT,CompanionPatternApiIT,CompanionPatternMonitorApiIT,GoalServiceIT' -Dmezo.test.use-testcontainers=true
```
Expected: all green. (ArchUnit and the full suite are CI's job.)

- [ ] **Step 4: Commit**

```bash
git add docs/features/companion.md docs/CODEMAP.md
git commit -m "docs(features): companion — graph retraction, revive-on-repromotion, reconcile sweep (mezo-b3pp.31)"
```

---

## Self-Review

- **bd coverage.** (a) un-confirmed pattern → Task 2's `PatternRetractedEvent` + Task 1's `retractPattern`, and the sweep as backstop. (b) `deleteGoal` leaving an active GOAL node → Task 2's `GoalDeletedEvent` + `retractGoal`, and the sweep. (c) soft-deleted `knowledge_fact` keeping its PREFERENCE node → `retractFact` reachable only through the sweep, because **no fact-delete path exists in main source** — stated honestly in code, tests and docs rather than papered over with an event nobody publishes. "reconcile cannot heal any of these — it iterates only confirmed patterns and non-deleted facts/goals" → Task 1 Step 6's complement sweep, which is the bd's own suggested shape ("archive on retraction (event or reconcile-side sweep over the complement sets)"). The bd's "Fix before W2.4 renders nodes into the prompt" is already overtaken — W2.4 shipped — which is why the event half (immediate) is in scope and not just the nightly sweep.
- **The one thing the bd does not name** and this plan adds anyway: promotion must assert `status='active'`, or the fix makes archiving permanent. Pinned by `testPromotePattern_shouldReviveTheNode_whenAnArchivedPatternIsReconfirmed` and by the event-level revive case.
- **Placeholders.** Production code is literal. Test bodies are specified as named cases with their exact seed→act→assert, deliberately deferring the harness boilerplate to the two existing IT files they must mirror (`GraphPromotionServiceIT`, `GraphPromotionEventIT`) rather than reproducing a base-class setup this plan cannot copy accurately — the implementer is told to read those first.
- **Type consistency.** `GraphReconcileResult(int upserted, int retracted)` is produced in Task 1 Step 3 and consumed at the four call sites in Step 7. `retractPattern`/`retractGoal` signatures declared in Task 1's Interfaces block are exactly what Task 2's handlers call. `SOURCE_PATTERN`/`SOURCE_FACT`/`SOURCE_GOAL` are the existing constants on `GraphPromotionService` (`:40-42`), reused by the sweep's `switch`.
