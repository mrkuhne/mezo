# W2.5 Graph Maintenance Job Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the nightly `GraphMaintenanceJob` (bd `mezo-b3pp.10`, spec §6.5): edge-weight decay,
stale-candidate pruning, weak-edge pruning, fresh-pattern-evidence reinforcement, plus wiring the
already-built W2.2 nightly reconciler (`GraphPromotionService.reconcile`) and W2.3 extraction
(`LifeEventExtractionService.extractFor`) into the same nightly run.

**Architecture:** One new `GraphMaintenanceService` (pure, no LLM) owns decay/prune/reinforce as a
single `@Transactional` per-user unit of work. One new `GraphMaintenanceJob` (`@Scheduled`,
`FeedbackLearningJob`'s per-user-isolation idiom) loops every `AppUserEntity` and runs THREE
independently-isolated phases per user: (1) `GraphMaintenanceService.runMaintenance`, (2)
`GraphPromotionService.reconcile`, (3) `LifeEventExtractionService.extractFor(yesterday)` — a
failure in one phase for one user must not skip the other phases or other users. Along the way,
`GraphPromotionService.reconcile` gets a bug fix it depends on (bd `mezo-b3pp.32`): per-row
isolation instead of aborting the whole sweep on the first failing pattern/fact/goal.

**Tech Stack:** Spring Boot (`@Scheduled`, `@ConditionalOnProperty`, Spring Data JPA), Postgres
(`knowledge_node`/`knowledge_edge`/`pattern_event` — all already migrated), JUnit 5 + AssertJ +
Testcontainers integration tests (`AbstractIntegrationTest`).

## Global Constraints

- Contract-first is N/A here — this slice has no REST surface (spec §6.5 acceptance: "decay,
  floor-prune, reinforcement each pinned by IT").
- No LLM/embed call is added by this slice's own code (decay/prune/reinforce is pure arithmetic);
  the reconcile/extraction phases it wires in already carry their own `LlmCallContextHolder`
  tagging (`companion_graph`) from W2.2/W2.3 — nothing new to tag.
- Tuning as nested `@Valid` config records (`CompanionProperties.Graph`), never magic numbers in
  code (§11 config idiom).
- New crons land in the dawn dead zone with a techcore switch + a `SwitchOffIT`
  (`GraphMaintenanceJobSwitchOffIT`) — the `FeedbackLearningJob`/`PatternDetectionJob` precedent:
  the job class itself gets ONLY a switch-off IT; the real logic is proven at the service layer.
- Integration-first tests; `ResetDatabase`'s truncate list already covers `knowledge_node`,
  `knowledge_edge`, `pattern_event` — no migration needed for this slice.
- Feature docs in the same change: `docs/features/companion.md` gets a new coverage-table row +
  a new `### W2.5 graph maintenance job` subsection, then `node scripts/lint-docs.mjs` +
  `node scripts/gen-codemap.mjs` (per user memory: focused ITs miss the codemap regen).
- Working directory for every step below is the `backend/` module unless a step says otherwise.

---

### Task 1: Config plumbing — cron + tuning knobs + job switch

> **Amendment (post-Task-1-execution):** the original Step 4 below had this task create
> `GraphMaintenanceJobSwitchOffIT.java` early, referencing `GraphMaintenanceJob` before Task 5
> creates it. That broke `test-compile` for the ENTIRE module — Maven compiles the whole
> `src/test/java` tree regardless of `-Dtest` filters, so the orphaned reference blocked every
> test run (including Tasks 2/3/4's) until Task 5 landed. The file was removed in commit
> `1559df18` ("chore(companion): defer GraphMaintenanceJobSwitchOffIT to Task 5"). Task 1 is
> otherwise unchanged and already complete; Task 5 now owns writing AND running this test (see
> Task 5's amended steps below) instead of just running a pre-written file.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java:138-151` (the `Graph` record)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java:190` (append the new switch constant before the closing brace)
- Modify: `backend/src/main/resources/application.yml:271-330` (`techcore.cron` block) and `:438-449` (`companion.graph` block)

**Interfaces:**
- Consumes: nothing new.
- Produces: `CompanionProperties.Graph.cron()` (String, cron expression), `.candidateMaxAgeDays()`
  (int, days), `.reinforcementBump()` (double, 0..1) — Task 4's `GraphMaintenanceService` and
  Task 5's `GraphMaintenanceJob` read these. `FeaturesConfiguration.GRAPH_MAINTENANCE_JOB_SWITCH`
  (String constant `"mezo.techcore.cron.graph-maintenance-job.enabled"`) — Task 5's job class
  gates on it.

- [ ] **Step 1: Extend `CompanionProperties.Graph` with the three new fields**

Edit `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java`,
replacing the existing `Graph` record (lines 138-151):

```java
    /** W2.1 knowledge-graph tuning (spec §6.1) — traversal bounds + nightly maintenance knobs. */
    public record Graph(
        /** Neighborhood traversal depth from a seed node (W2.4). */
        @Min(1) @Max(3) int maxHops,
        /** Top-K neighbors returned by weight (W2.4). */
        @Min(1) @Max(20) int topK,
        /** Nightly edge-weight multiplicative decay (W2.5) — e.g. 0.99 = 1%/day fade. */
        @DecimalMin("0.9") @DecimalMax("1.0") double decayFactor,
        /** Edges below this weight are soft-deleted on the nightly pass (W2.5). */
        @DecimalMin("0.0") @DecimalMax("1.0") double pruneFloor,
        /** Hard cap on the rendered [Összefüggések] block (estimated tokens, W2.4). */
        @Min(1) int renderMaxTokens,
        /** W2.2 edge structurer: suggestions below this confidence are dropped (edges start humble). */
        @DecimalMin("0.0") @DecimalMax("1.0") double edgeConfidenceFloor,
        /** W2.5 (mezo-b3pp.10): cron for the nightly GraphMaintenanceJob (server zone). */
        @NotBlank String cron,
        /** W2.5: candidate nodes (never confirmed/rejected) older than this many days are
         *  soft-deleted — the stale L2 inbox item gets swept off the list. */
        @Min(1) @Max(365) int candidateMaxAgeDays,
        /** W2.5: fresh pattern evidence (a same-night pattern_event snapshot for a promoted
         *  pattern) bumps that node's edges by this much, capped at 1.0 — decay's counterweight
         *  for evidence still arriving. */
        @DecimalMin("0.0") @DecimalMax("1.0") double reinforcementBump
    ) {}
```

- [ ] **Step 2: Add the job switch constant**

Edit `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`,
inserting before the final closing `}` of the class (after `KNOWLEDGE_GRAPH_SWITCH`, currently line 190):

```java

    /** Phase 5 W2.5 (mezo-b3pp.10) nightly graph-maintenance job — techcore cron zone. */
    public static final String GRAPH_MAINTENANCE_JOB_SWITCH =
        "mezo.techcore.cron.graph-maintenance-job.enabled";
```

- [ ] **Step 3: Wire the cron switch + tuning values into `application.yml`**

In `backend/src/main/resources/application.yml`, inside the `techcore: cron:` block, insert a new
entry directly after the `feedback-learning-job:` entry (which currently ends at line 284, right
before the `# V3.2 weekly hypothesis pipeline` comment at line 285):

```yaml
      # W2.5 (mezo-b3pp.10) nightly graph maintenance: edge decay/prune + reinforcement, plus the
      # W2.2 reconciler and W2.3 extraction (schedule: mezo.companion.graph.cron);
      # off = the GraphMaintenanceJob bean does not exist
      graph-maintenance-job:
        enabled: true
```

Then, inside the `companion: graph:` block (currently lines 438-449, ending right before the
`summary:` key), append the three new keys after `edge-confidence-floor: 0.4`:

```yaml
      # W2.2 (mezo-b3pp.7): the edge structurer drops suggestions below this confidence; the ones
      # that pass are created at weight = confidence × 0.5 and grow only through W2.5 reinforcement.
      edge-confidence-floor: 0.4
      # W2.5 (mezo-b3pp.10): nightly maintenance cron — 03:20, a free dawn slot (02:20 daily-summary,
      # 02:40 patterns, 03:00 SUN hypotheses, 03:10 feedback-learning, 03:40 llm-log retention).
      cron: "0 20 3 * * *"
      # Candidate nodes (never confirmed/rejected by the L2 inbox) older than this many days are
      # soft-deleted — a stale extractor guess stops sitting in the list forever.
      candidate-max-age-days: 30
      # Fresh pattern evidence (a same-night pattern_event snapshot for an already-promoted
      # pattern) bumps that node's edges by this much, capped at 1.0.
      reinforcement-bump: 0.05
```

(Only the new `cron`/`candidate-max-age-days`/`reinforcement-bump` lines are additions — the
`edge-confidence-floor: 0.4` line already exists and is shown only for placement context; do not
duplicate it.)

- [x] ~~Step 4: Write `GraphMaintenanceJobSwitchOffIT` (will not compile until Task 5)~~ —
  **superseded by the amendment above.** This test moved to Task 5 (it is written AND run there,
  right after `GraphMaintenanceJob` itself exists), because Maven's whole-tree test-compile made
  an early orphaned reference block every other test in the module.

- [x] **Step 5: Confirm config binds — run the existing config validation IT**

Run: `./mvnw test -Dtest=CompanionPropertiesBindingIT -pl . 2>&1 | tail -40` (if no such test class
exists, instead run any existing companion IT, e.g. `./mvnw test -Dtest=GraphServiceIT`, to prove
`@ConfigurationProperties` binding of the extended `Graph` record does not break context startup)

Expected: BUILD SUCCESS (context loads, `CompanionProperties` binds without a validation error).

- [x] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java \
        backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java \
        backend/src/main/resources/application.yml
git commit -m "feat(companion): W2.5 graph-maintenance config + job switch (mezo-b3pp.10)"
```

---

### Task 2: Fix `GraphPromotionService.reconcile` per-row isolation (mezo-b3pp.32)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphPromotionService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphPromotionServiceReconcileIsolationIT.java` (new — own class, same reason `ChatServiceGraphBlockFailureIT` is its own class: `@MockitoSpyBean` forks the application context, and that fork must not leak into `GraphPromotionServiceIT`'s other tests)

**Interfaces:**
- Consumes: nothing new (fixes an existing public method's behavior).
- Produces: `GraphPromotionService.reconcile(UUID userId)` (unchanged signature) now continues past
  a failing row instead of aborting the whole sweep — Task 5's `GraphMaintenanceJob` depends on
  this (one bad pattern must not skip that user's facts/goals, or later users).

- [ ] **Step 1: Write the failing test — one bad row must not kill the sweep**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphPromotionServiceReconcileIsolationIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromotionService;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * W2.5 prerequisite (bd mezo-b3pp.32, flagged during W2.2's final review): {@code reconcile}
 * must not abort the whole sweep on the first failing row, since W2.5's {@code GraphMaintenanceJob}
 * calls it nightly across every user. Own IT class — the {@code @MockitoSpyBean} forks the
 * application context, the {@code ChatServiceGraphBlockFailureIT} precedent for why that fork
 * must not leak into {@code GraphPromotionServiceIT}'s other (non-spy) tests.
 */
class GraphPromotionServiceReconcileIsolationIT extends AbstractIntegrationTest {

    @MockitoSpyBean private GraphPromotionService promotionService;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private GoalPopulator goalPopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testReconcile_shouldIsolatePerRowFailures_soOneBadPatternDoesNotSkipFactsAndGoals() {
        UUID owner = ownerId();
        PatternEntity pattern = patternPopulator.createPattern(owner, "isolation_case", "Hibás minta.");
        pattern.setStatus(PatternEntity.STATUS_CONFIRMED);
        pattern.setR(new BigDecimal("-0.500"));
        pattern.setN(10);
        patternPopulator.save(pattern);
        doThrow(new RuntimeException("boom")).when(promotionService).promotePattern(owner, pattern.getId());
        KnowledgeFactEntity manual = new KnowledgeFactEntity();
        manual.setCreatedBy(owner);
        manual.setFactText("Kézzel rögzített preferencia — a hibás minta után is le kell futnia.");
        manual.setCategory("life");
        manual.setSource(KnowledgeFactEntity.SOURCE_MANUAL);
        knowledgeFactRepository.saveAndFlush(manual);
        goalPopulator.createGoal(owner, "active");

        int count = promotionService.reconcile(owner);

        // the failing pattern contributes 0; the fact + the active goal still promote
        assertThat(count).isEqualTo(2);
        assertThat(nodeRepository.findAll())
            .extracting(GraphNodeEntity::getKind)
            .containsExactlyInAnyOrder(GraphNodeEntity.KIND_PREFERENCE, GraphNodeEntity.KIND_GOAL);
    }
}
```

Check `GoalPopulator.createGoal(UUID owner, String status)`'s exact signature in
`backend/src/test/java/io/mrkuhne/mezo/support/populator/GoalPopulator.java` before using it above
— `GraphPromotionServiceIT`'s existing `testReconcile_shouldPromoteEverythingMissed_andStayIdempotent`
test already calls it the same way (`goalPopulator.createGoal(owner, "active")`), so this should
match without adjustment.

- [ ] **Step 2: Run it to see it fail**

```bash
./mvnw test -Dtest=GraphPromotionServiceReconcileIsolationIT
```

Expected: FAIL — the real assertion failure: today's `reconcile` throws `RuntimeException: boom`
straight out of `promotionService.reconcile(owner)` (no isolation) instead of returning `2`.

- [ ] **Step 3: Fix `reconcile` — catch-and-continue per row, with a logged skip count**

Edit `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphPromotionService.java`.
Add `@Slf4j` to the class (it currently has none) and replace the `reconcile` method body:

Add these imports near the top of the file (alongside the existing imports):
```java
import lombok.extern.slf4j.Slf4j;
```

Add `@Slf4j` above `@Service` on the class declaration (currently just `@Service` +
`@RequiredArgsConstructor` + `@ConditionalOnProperty`):
```java
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH, havingValue = "true")
public class GraphPromotionService {
```

Replace the `reconcile` method (currently):
```java
    public int reconcile(UUID userId) {
        GraphPromotionService proxy = self.getObject();
        int count = 0;
        for (PatternEntity pattern : patternRepository
                .findByCreatedByAndStatusAndDeletedFalseOrderByLastDetectedAtDesc(userId, PatternEntity.STATUS_CONFIRMED)) {
            count += proxy.promotePattern(userId, pattern.getId()).isPresent() ? 1 : 0;
        }
        for (KnowledgeFactEntity fact : knowledgeFactRepository
                .findByCreatedByAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(userId)) {
            count += proxy.promoteFact(userId, fact.getId()).isPresent() ? 1 : 0;
        }
        for (GoalEntity goal : goalRepository.findByCreatedByAndDeletedFalseOrderByStartDateDesc(userId)) {
            count += proxy.syncGoal(userId, goal.getId()).isPresent() ? 1 : 0;
        }
        return count;
    }
```

with:
```java
    public int reconcile(UUID userId) {
        GraphPromotionService proxy = self.getObject();
        int count = 0;
        int skipped = 0;
        for (PatternEntity pattern : patternRepository
                .findByCreatedByAndStatusAndDeletedFalseOrderByLastDetectedAtDesc(userId, PatternEntity.STATUS_CONFIRMED)) {
            try {
                count += proxy.promotePattern(userId, pattern.getId()).isPresent() ? 1 : 0;
            } catch (Exception e) {
                skipped++;
                log.warn("Reconcile: pattern {} promotion failed for user {}", pattern.getId(), userId, e);
            }
        }
        for (KnowledgeFactEntity fact : knowledgeFactRepository
                .findByCreatedByAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(userId)) {
            try {
                count += proxy.promoteFact(userId, fact.getId()).isPresent() ? 1 : 0;
            } catch (Exception e) {
                skipped++;
                log.warn("Reconcile: fact {} promotion failed for user {}", fact.getId(), userId, e);
            }
        }
        for (GoalEntity goal : goalRepository.findByCreatedByAndDeletedFalseOrderByStartDateDesc(userId)) {
            try {
                count += proxy.syncGoal(userId, goal.getId()).isPresent() ? 1 : 0;
            } catch (Exception e) {
                skipped++;
                log.warn("Reconcile: goal {} sync failed for user {}", goal.getId(), userId, e);
            }
        }
        if (skipped > 0) {
            log.warn("Reconcile skipped {} row(s) for user {} due to per-row failures", skipped, userId);
        }
        return count;
    }
```

Also update the method's javadoc (immediately above `reconcile`) to add one sentence noting the
per-row isolation — insert this sentence at the end of the existing javadoc block, before the
`@return` line:

```
     * <p>Per-row isolation (mezo-b3pp.32): a single row's promotion/sync failure is caught,
     * logged, and skipped — it does not abort the rest of the sweep for this user. This matters
     * once W2.5's {@code GraphMaintenanceJob} calls this nightly across every user: one corrupt
     * pattern must not silently stop that user's facts and goals from reconciling too.
     *
```

- [ ] **Step 4: Run the test again to see it pass, then the existing suite for regressions**

```bash
./mvnw test -Dtest=GraphPromotionServiceReconcileIsolationIT
./mvnw test -Dtest=GraphPromotionServiceIT
```

Expected: both PASS — the new isolation test, and the full existing `GraphPromotionServiceIT`
suite (incl. `testReconcile_shouldPromoteEverythingMissed_andStayIdempotent`) unaffected.

- [ ] **Step 5: Close the prerequisite bd issue**

```bash
bd close mezo-b3pp.32
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphPromotionService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphPromotionServiceReconcileIsolationIT.java
git commit -m "fix(companion): per-row isolation in GraphPromotionService.reconcile (mezo-b3pp.32)"
```

---

### Task 3: Repository finders + test-data backdating helper

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/repository/GraphEdgeRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/repository/GraphNodeRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/PatternEventRepository.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/GraphPopulator.java`
- Test: none standalone — these are read by Task 4's IT.

**Interfaces:**
- Produces:
  - `GraphEdgeRepository.findByCreatedByAndDeletedFalse(UUID createdBy): List<GraphEdgeEntity>`
  - `GraphNodeRepository.findByCreatedByAndStatusAndCreatedAtBeforeAndDeletedFalse(UUID createdBy, String status, Instant cutoff): List<GraphNodeEntity>`
  - `PatternEventRepository.findByCreatedByAndKindAndOccurredAtAfterAndDeletedFalse(UUID createdBy, String kind, Instant since): List<PatternEventEntity>`
  - `GraphPopulator.createCandidateNodeAt(UUID owner, String kind, String title, LocalDate occurredOn, Map<String,Object> meta, Instant createdAt): GraphNodeEntity`

- [ ] **Step 1: Add the edge finder**

Edit `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/repository/GraphEdgeRepository.java`,
adding one method (the file currently has three finders and ends after
`findByCreatedByAndToNodeIdAndDeletedFalse`):

```java
    /** W2.5 (mezo-b3pp.10): every active edge for a user — the nightly decay/prune pass loads
     *  them all once rather than per-node, since the ADR 0031 scale assumption (hundreds of
     *  nodes, single user) makes one flat list cheaper than N traversal queries. */
    List<GraphEdgeEntity> findByCreatedByAndDeletedFalse(UUID createdBy);
```

- [ ] **Step 2: Add the candidate-age finder**

Edit `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/repository/GraphNodeRepository.java`.
Add `import java.time.Instant;` alongside the existing `import java.time.LocalDate;`, then add this
method after `findByCreatedByAndStatusAndIdNotAndDeletedFalseOrderByCreatedAtDesc`:

```java
    /** W2.5 (mezo-b3pp.10): candidate nodes (never confirmed/rejected) sitting in the L2 inbox
     *  longer than {@code graph.candidate-max-age-days} — the nightly prune target. */
    List<GraphNodeEntity> findByCreatedByAndStatusAndCreatedAtBeforeAndDeletedFalse(
        UUID createdBy, String status, Instant cutoff);
```

- [ ] **Step 3: Add the fresh-snapshot finder**

Edit `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/PatternEventRepository.java`,
adding one method after the existing `findFirstByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc`:

```java

    /** W2.5 (mezo-b3pp.10): every {@code snapshot} event newer than {@code since} — the nightly
     *  reinforcement pass's "fresh pattern evidence" signal. Distinct pattern ids from this list
     *  are the patterns whose already-promoted graph node's edges get bumped tonight. */
    List<PatternEventEntity> findByCreatedByAndKindAndOccurredAtAfterAndDeletedFalse(
            UUID createdBy, String kind, Instant since);
```

(`java.time.Instant` is already imported in this file via `PatternEventPopulator`'s sibling usage —
verify the import exists at the top of `PatternEventRepository.java`; if not, add
`import java.time.Instant;`.)

- [ ] **Step 4: Add the backdating populator helper**

Edit `backend/src/test/java/io/mrkuhne/mezo/support/populator/GraphPopulator.java`. Add these
imports at the top, alongside the existing ones:

```java
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import org.springframework.transaction.annotation.Transactional;
```

Add the `EntityManager` field right after the two repository fields (`nodeRepository`,
`edgeRepository`):

```java

    /** JPA-managed shared EntityManager — the {@code @CreationTimestamp} backdate needs a native
     *  update; field-injected {@code @PersistenceContext} is the house exception to constructor DI
     *  (the {@code FeedbackPopulator} precedent). */
    @PersistenceContext
    private EntityManager em;
```

Add a new method at the end of the class, right before the final closing `}`:

```java

    /** W2.5 (mezo-b3pp.10): a candidate node with a controlled {@code created_at}, for
     *  deterministic stale-candidate-prune window tests — the {@code FeedbackPopulator
     *  .createVerdictAt} precedent. */
    @Transactional
    public GraphNodeEntity createCandidateNodeAt(UUID owner, String kind, String title,
            LocalDate occurredOn, Map<String, Object> meta, Instant createdAt) {
        GraphNodeEntity n = createCandidateNode(owner, kind, title, occurredOn, meta);
        em.createNativeQuery("update knowledge_node set created_at = :at where id = :id")
            .setParameter("at", createdAt).setParameter("id", n.getId()).executeUpdate();
        em.clear();
        return nodeRepository.findById(n.getId()).orElseThrow();
    }
```

- [ ] **Step 5: Compile-check**

```bash
./mvnw -q compile -pl . 2>&1 | tail -60
```

Expected: BUILD SUCCESS. (No new tests yet — these are plain repository/populator additions; Task
4 exercises them.)

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/repository/GraphEdgeRepository.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/repository/GraphNodeRepository.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/PatternEventRepository.java \
        backend/src/test/java/io/mrkuhne/mezo/support/populator/GraphPopulator.java
git commit -m "feat(companion): graph maintenance repository finders + test backdating helper (mezo-b3pp.10)"
```

---

### Task 4: `GraphMaintenanceService` — decay, prune, reinforce

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphMaintenanceService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphMaintenanceResult.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphMaintenanceServiceIT.java`

**Interfaces:**
- Consumes: `GraphNodeRepository` (incl. Task 3's new finder), `GraphEdgeRepository` (incl. Task
  3's new finder, plus the existing `findByCreatedByAndFromNodeIdAndDeletedFalse`/
  `...ToNodeIdAndDeletedFalse`), `PatternEventRepository` (incl. Task 3's new finder),
  `CompanionProperties.graph()` (Task 1), `GraphPromotionService.SOURCE_PATTERN` (existing
  constant `"pattern"`), `PatternEventEntity.KIND_SNAPSHOT` (existing constant `"snapshot"`).
  Talks to the repositories directly rather than through `GraphService` — `GraphService`'s
  `edgesFrom`/`edgesTo`/`findBySource` are thin one-line wrappers over exactly these repository
  calls, and pulling `GraphService` in as a fourth dependency here would add nothing.
- Produces: `GraphMaintenanceService.runMaintenance(UUID userId): GraphMaintenanceResult` — Task
  5's `GraphMaintenanceJob` calls this as its first per-user phase.
  `GraphMaintenanceResult(int edgesDecayed, int edgesPruned, int candidatesPruned, int edgesReinforced)`.

- [ ] **Step 1: Write the failing IT**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphMaintenanceServiceIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphEdgeRepository;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphMaintenanceResult;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphMaintenanceService;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromotionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import io.mrkuhne.mezo.support.populator.PatternEventPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** W2.5 (bd mezo-b3pp.10, spec §6.5): the nightly maintenance pass's pure arithmetic —
 *  decay, floor-prune, stale-candidate-prune, fresh-pattern reinforcement. No LLM involved. */
class GraphMaintenanceServiceIT extends AbstractIntegrationTest {

    @Autowired private GraphMaintenanceService maintenanceService;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private GraphEdgeRepository edgeRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private GraphPopulator graphPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventPopulator patternEventPopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testRunMaintenance_shouldDecayEveryActiveEdge_byTheConfiguredFactor() {
        UUID owner = ownerId();
        GraphNodeEntity a = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PREFERENCE, "A");
        GraphNodeEntity b = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PREFERENCE, "B");
        graphPopulator.createEdge(owner, a.getId(), b.getId(), GraphEdgeEntity.KIND_RELATES_TO, "0.800");

        GraphMaintenanceResult result = maintenanceService.runMaintenance(owner);

        assertThat(result.edgesDecayed()).isEqualTo(1);
        List<GraphEdgeEntity> edges = edgeRepository.findByCreatedByAndDeletedFalse(owner);
        assertThat(edges).hasSize(1);
        // default decayFactor = 0.99 -> 0.800 * 0.99 = 0.792
        assertThat(edges.get(0).getWeight()).isEqualByComparingTo(new BigDecimal("0.792"));
    }

    @Test
    void testRunMaintenance_shouldPruneEdges_thatDecayBelowTheFloor() {
        UUID owner = ownerId();
        GraphNodeEntity a = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PREFERENCE, "A");
        GraphNodeEntity b = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PREFERENCE, "B");
        // default pruneFloor = 0.05; 0.020 * 0.99 = 0.0198 -> rounds to 0.020, well under 0.05 ->
        // pruned. (NOT 0.050: 0.050 * 0.99 = 0.0495, which rounds HALF_UP right back to 0.050 —
        // exactly AT the floor, not under it, and would NOT prune.)
        graphPopulator.createEdge(owner, a.getId(), b.getId(), GraphEdgeEntity.KIND_RELATES_TO, "0.020");

        GraphMaintenanceResult result = maintenanceService.runMaintenance(owner);

        assertThat(result.edgesPruned()).isEqualTo(1);
        assertThat(edgeRepository.findByCreatedByAndDeletedFalse(owner)).isEmpty();
    }

    @Test
    void testRunMaintenance_shouldPruneStaleCandidates_butNeverActiveNodes() {
        UUID owner = ownerId();
        Instant old = Instant.now().minus(31, ChronoUnit.DAYS);
        GraphNodeEntity staleCandidate = graphPopulator.createCandidateNodeAt(
            owner, GraphNodeEntity.KIND_LIFE_EVENT, "Régi jelölt", null, Map.of(), old);
        GraphNodeEntity freshCandidate = graphPopulator.createCandidateNode(
            owner, GraphNodeEntity.KIND_LIFE_EVENT, "Friss jelölt", null, Map.of());
        GraphNodeEntity activeOldNode = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PREFERENCE, "Aktív");

        GraphMaintenanceResult result = maintenanceService.runMaintenance(owner);

        assertThat(result.candidatesPruned()).isEqualTo(1);
        assertThat(nodeRepository.findByIdAndCreatedByAndDeletedFalse(staleCandidate.getId(), owner)).isEmpty();
        assertThat(nodeRepository.findByIdAndCreatedByAndDeletedFalse(freshCandidate.getId(), owner)).isPresent();
        assertThat(nodeRepository.findByIdAndCreatedByAndDeletedFalse(activeOldNode.getId(), owner)).isPresent();
    }

    @Test
    void testRunMaintenance_shouldReinforceEdges_ofAPromotedPatternWithAFreshSnapshot() {
        UUID owner = ownerId();
        PatternEntity pattern = patternPopulator.createPattern(owner, "sleep_vs_mood", "Alvás -> hangulat");
        pattern.setStatus(PatternEntity.STATUS_CONFIRMED);
        patternPopulator.save(pattern);
        GraphNodeEntity patternNode = graphPopulator.createNode(
            owner, GraphNodeEntity.KIND_PATTERN, "Alvás -> hangulat");
        // simulate GraphPromotionService.upsertNode's source anchor without invoking the LLM structurer
        setSource(patternNode, GraphPromotionService.SOURCE_PATTERN, pattern.getId());
        GraphNodeEntity other = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PREFERENCE, "Kapcsolódó");
        graphPopulator.createEdge(owner, patternNode.getId(), other.getId(), GraphEdgeEntity.KIND_SUPPORTS, "0.600");
        patternEventPopulator.snapshot(owner, pattern.getId(), -0.55, 15, 0.03, Instant.now().minus(2, ChronoUnit.HOURS));

        GraphMaintenanceResult result = maintenanceService.runMaintenance(owner);

        assertThat(result.edgesReinforced()).isEqualTo(1);
        GraphEdgeEntity edge = edgeRepository.findByCreatedByAndDeletedFalse(owner).get(0);
        // decayed first (0.600 * 0.99 = 0.594), then reinforced (+0.05 = 0.644)
        assertThat(edge.getWeight()).isEqualByComparingTo(new BigDecimal("0.644"));
        assertThat(edge.getLastReinforcedAt()).isNotNull();
    }

    @Test
    void testRunMaintenance_shouldNotReinforce_whenTheSnapshotIsStale() {
        UUID owner = ownerId();
        PatternEntity pattern = patternPopulator.createPattern(owner, "sleep_vs_focus", "Alvás -> fókusz");
        pattern.setStatus(PatternEntity.STATUS_CONFIRMED);
        patternPopulator.save(pattern);
        GraphNodeEntity patternNode = graphPopulator.createNode(
            owner, GraphNodeEntity.KIND_PATTERN, "Alvás -> fókusz");
        setSource(patternNode, GraphPromotionService.SOURCE_PATTERN, pattern.getId());
        GraphNodeEntity other = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PREFERENCE, "Kapcsolódó");
        graphPopulator.createEdge(owner, patternNode.getId(), other.getId(), GraphEdgeEntity.KIND_SUPPORTS, "0.600");
        // 3 days old -> outside the 1-day freshness window
        patternEventPopulator.snapshot(owner, pattern.getId(), -0.4, 10, 0.05, Instant.now().minus(3, ChronoUnit.DAYS));

        GraphMaintenanceResult result = maintenanceService.runMaintenance(owner);

        assertThat(result.edgesReinforced()).isZero();
    }

    /** Test-only: sets the source anchor directly via the repository (bypasses the LLM edge
     *  structurer that {@code GraphPromotionService.promotePattern} would trigger for a new node —
     *  reinforcement only needs the anchor, not real structured edges). */
    private void setSource(GraphNodeEntity node, String sourceKind, UUID sourceId) {
        node.setSourceKind(sourceKind);
        node.setSourceId(sourceId);
        nodeRepository.saveAndFlush(node);
    }
}
```

- [ ] **Step 2: Run it to see it fail**

```bash
./mvnw test -Dtest=GraphMaintenanceServiceIT
```

Expected: FAIL to compile (`GraphMaintenanceService`/`GraphMaintenanceResult` do not exist yet).

- [ ] **Step 3: Write `GraphMaintenanceResult`**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphMaintenanceResult.java`:

```java
package io.mrkuhne.mezo.feature.companion.graph.service;

/** W2.5 (bd mezo-b3pp.10, spec §6.5): one nightly maintenance run's tallies for one user — logged
 *  by {@link GraphMaintenanceJob}, asserted directly by {@code GraphMaintenanceServiceIT}. */
public record GraphMaintenanceResult(
    int edgesDecayed, int edgesPruned, int candidatesPruned, int edgesReinforced) {
}
```

- [ ] **Step 4: Write `GraphMaintenanceService`**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphMaintenanceService.java`:

```java
package io.mrkuhne.mezo.feature.companion.graph.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphEdgeRepository;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * W2.5 (bd mezo-b3pp.10, spec §6.5): the nightly maintenance pass over one user's graph — pure
 * arithmetic, no LLM call. {@link #runMaintenance} is one {@code @Transactional} unit of work:
 * (1) every active edge's weight decays by {@code graph.decayFactor}, and any edge that decays
 * under {@code graph.pruneFloor} is soft-deleted in the same pass; (2) candidate nodes older than
 * {@code graph.candidateMaxAgeDays} (never confirmed/rejected by the L2 inbox) are soft-deleted;
 * (3) a promoted PATTERN node with a "fresh" {@code pattern_event} snapshot (within the last day —
 * the nightly {@code PatternDetectionJob}'s own window) has every edge touching it bumped by
 * {@code graph.reinforcementBump}, capped at 1.0, with {@code lastReinforcedAt} stamped.
 *
 * <p>{@link GraphMaintenanceJob} calls this as the first of its three nightly phases, before the
 * W2.2 reconciler and W2.3 extraction — each phase is independently isolated there, so a failure
 * here never blocks the other two.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH, havingValue = "true")
public class GraphMaintenanceService {

    /** How far back a pattern_event snapshot still counts as "fresh evidence" — one night's
     *  worth, matching the PatternDetectionJob's own nightly cadence. */
    private static final long REINFORCEMENT_FRESHNESS_HOURS = 24;

    private final GraphNodeRepository nodeRepository;
    private final GraphEdgeRepository edgeRepository;
    private final PatternEventRepository patternEventRepository;
    private final CompanionProperties properties;

    @Transactional
    public GraphMaintenanceResult runMaintenance(UUID userId) {
        CompanionProperties.Graph cfg = properties.graph();
        EdgeDecayResult decay = decayAndPruneEdges(userId, cfg.decayFactor(), cfg.pruneFloor());
        int candidatesPruned = pruneStaleCandidates(userId, cfg.candidateMaxAgeDays());
        int edgesReinforced = reinforceFreshPatterns(userId, cfg.reinforcementBump());
        return new GraphMaintenanceResult(
            decay.decayed(), decay.pruned(), candidatesPruned, edgesReinforced);
    }

    private record EdgeDecayResult(int decayed, int pruned) {}

    /** One query loads every active edge; each is decayed and, if it falls under the floor,
     *  soft-deleted in the SAME pass instead of a second floor-prune query re-reading everything. */
    private EdgeDecayResult decayAndPruneEdges(UUID userId, double decayFactor, double pruneFloor) {
        List<GraphEdgeEntity> edges = edgeRepository.findByCreatedByAndDeletedFalse(userId);
        BigDecimal factor = BigDecimal.valueOf(decayFactor);
        BigDecimal floor = BigDecimal.valueOf(pruneFloor);
        int pruned = 0;
        for (GraphEdgeEntity edge : edges) {
            BigDecimal decayed = edge.getWeight().multiply(factor).setScale(3, RoundingMode.HALF_UP);
            if (decayed.compareTo(floor) < 0) {
                edgeRepository.delete(edge);   // @SQLDelete -> soft delete
                pruned++;
            } else {
                edge.setWeight(decayed);
            }
        }
        return new EdgeDecayResult(edges.size(), pruned);
    }

    private int pruneStaleCandidates(UUID userId, int maxAgeDays) {
        Instant cutoff = Instant.now().minus(maxAgeDays, ChronoUnit.DAYS);
        List<GraphNodeEntity> stale = nodeRepository.findByCreatedByAndStatusAndCreatedAtBeforeAndDeletedFalse(
            userId, GraphNodeEntity.STATUS_CANDIDATE, cutoff);
        stale.forEach(nodeRepository::delete);   // @SQLDelete -> soft delete
        return stale.size();
    }

    /** Fresh snapshot evidence for an already-promoted pattern bumps every edge TOUCHING that
     *  pattern's node (both directions) — the counterweight to this same run's decay. Edges that
     *  were just pruned above are gone from {@code findByCreatedByAndFromNodeIdAndDeletedFalse}/
     *  {@code ...ToNodeIdAndDeletedFalse} already (both are {@code @SQLRestriction}-filtered), so
     *  a dead relationship simply isn't reinforced — it stays gone until re-evidenced fresh. */
    private int reinforceFreshPatterns(UUID userId, double bump) {
        Instant since = Instant.now().minus(REINFORCEMENT_FRESHNESS_HOURS, ChronoUnit.HOURS);
        Set<UUID> freshPatternIds = patternEventRepository
            .findByCreatedByAndKindAndOccurredAtAfterAndDeletedFalse(userId, PatternEventEntity.KIND_SNAPSHOT, since)
            .stream().map(PatternEventEntity::getPatternId).collect(Collectors.toSet());
        if (freshPatternIds.isEmpty()) {
            return 0;
        }
        BigDecimal bumpAmount = BigDecimal.valueOf(bump);
        Instant now = Instant.now();
        int reinforced = 0;
        for (UUID patternId : freshPatternIds) {
            Optional<GraphNodeEntity> node = nodeRepository
                .findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(userId, GraphPromotionService.SOURCE_PATTERN, patternId);
            if (node.isEmpty()) {
                continue;   // pattern confirmed but never promoted — nothing to reinforce
            }
            UUID nodeId = node.get().getId();
            List<GraphEdgeEntity> touching = new ArrayList<>(edgeRepository.findByCreatedByAndFromNodeIdAndDeletedFalse(userId, nodeId));
            touching.addAll(edgeRepository.findByCreatedByAndToNodeIdAndDeletedFalse(userId, nodeId));
            for (GraphEdgeEntity edge : touching) {
                BigDecimal bumped = edge.getWeight().add(bumpAmount).min(BigDecimal.ONE).setScale(3, RoundingMode.HALF_UP);
                edge.setWeight(bumped);
                edge.setLastReinforcedAt(now);
                reinforced++;
            }
        }
        return reinforced;
    }
}
```

- [ ] **Step 5: Run the IT to see it pass**

```bash
./mvnw test -Dtest=GraphMaintenanceServiceIT
```

Expected: PASS — all five test methods. If the decay/reinforce arithmetic assertions
(`0.792`/`0.644`) fail on rounding, check `RoundingMode.HALF_UP` at `setScale(3, ...)` matches —
the DB column is `numeric(4,3)` so anything beyond 3 decimal places must already be rounded before
`saveAndFlush`/dirty-check-flush, or Postgres itself will round on write and the in-memory
assertion (pre-flush) would then disagree with what a fresh read shows. Since these assertions read
directly off the still-attached JPA entity within the same transaction as the flush (no explicit
re-read from DB), the Java-side `setScale` must match the DB precision exactly for the assertion to
hold before AND after a hypothetical re-read.

- [ ] **Step 6: Run the full graph test package to check for regressions**

```bash
./mvnw test -Dtest='io.mrkuhne.mezo.feature.companion.graph.**'
```

Expected: BUILD SUCCESS, all tests green.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphMaintenanceService.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphMaintenanceResult.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphMaintenanceServiceIT.java
git commit -m "feat(companion): GraphMaintenanceService — decay/prune/reinforce (mezo-b3pp.10)"
```

---

### Task 5: `GraphMaintenanceJob` — nightly cron wiring all three phases

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphMaintenanceJob.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphMaintenanceJobSwitchOffIT.java` (new — written and run in this task's Step 2; see Task 1's amendment note for why it was moved here from Task 1)

**Interfaces:**
- Consumes: `AppUserRepository.findAll()` (existing, `io.mrkuhne.mezo.feature.auth.repository.AppUserRepository`),
  `GraphMaintenanceService.runMaintenance(UUID)` (Task 4), `GraphPromotionService.reconcile(UUID)`
  (existing, fixed in Task 2), `LifeEventExtractionService.extractFor(UUID, LocalDate)` (existing,
  W2.3), `CompanionProperties.graph().cron()` (Task 1),
  `FeaturesConfiguration.{COMPANION_SWITCH, KNOWLEDGE_GRAPH_SWITCH, GRAPH_MAINTENANCE_JOB_SWITCH}`.
- Produces: the `GraphMaintenanceJob` bean itself — nothing downstream depends on it (it is the
  terminal nightly entry point), but this task's own `GraphMaintenanceJobSwitchOffIT` asserts its
  presence/absence.

- [ ] **Step 1: Write `GraphMaintenanceJob`**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphMaintenanceJob.java`:

```java
package io.mrkuhne.mezo.feature.companion.graph.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The W2.5 nightly cron (bd mezo-b3pp.10, spec §6.5) — the {@code FeedbackLearningJob} idiom:
 * per-user isolation, one bad user never kills the run. THREE independently-isolated phases per
 * user, in this order: (1) {@link GraphMaintenanceService#runMaintenance} (decay/prune/reinforce,
 * pure arithmetic), (2) {@link GraphPromotionService#reconcile} (the W2.2 nightly catch-up sweep —
 * already per-row isolated internally, mezo-b3pp.32), (3) {@link
 * LifeEventExtractionService#extractFor} for YESTERDAY (the W2.3 extraction pass; "yesterday" the
 * same convention {@code DailySummaryJob}/{@code PatternDetectionJob} use — a night's narrative
 * is only complete once the night is over).
 *
 * <p>Phase isolation is at the PHASE level here, not just per-user: a failure in phase 1 for a
 * user must not skip phases 2/3 for that SAME user, and a failure anywhere must not skip the next
 * user. Gated on {@code COMPANION_SWITCH} ∧ {@code KNOWLEDGE_GRAPH_SWITCH} ∧
 * {@code GRAPH_MAINTENANCE_JOB_SWITCH} — all three collaborators this job calls already require at
 * least {@code KNOWLEDGE_GRAPH_SWITCH} themselves, so direct constructor injection (no
 * {@code ObjectProvider}) is safe: whenever this bean exists, so do theirs.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH,
            FeaturesConfiguration.GRAPH_MAINTENANCE_JOB_SWITCH},
        havingValue = "true")
public class GraphMaintenanceJob {

    private final AppUserRepository appUserRepository;
    private final GraphMaintenanceService graphMaintenanceService;
    private final GraphPromotionService graphPromotionService;
    private final LifeEventExtractionService lifeEventExtractionService;

    @Scheduled(cron = "${mezo.companion.graph.cron}")
    public void run() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                GraphMaintenanceResult result = graphMaintenanceService.runMaintenance(user.getId());
                log.info("Graph maintenance for user {}: {} edges decayed, {} edges pruned, "
                        + "{} candidates pruned, {} edges reinforced", user.getId(),
                    result.edgesDecayed(), result.edgesPruned(), result.candidatesPruned(),
                    result.edgesReinforced());
            } catch (Exception e) {
                log.warn("Graph maintenance failed for user {}", user.getId(), e);
            }
            try {
                int upserted = graphPromotionService.reconcile(user.getId());
                log.info("Graph reconcile for user {}: {} node(s) upserted", user.getId(), upserted);
            } catch (Exception e) {
                log.warn("Graph reconcile failed for user {}", user.getId(), e);
            }
            try {
                int candidates = lifeEventExtractionService.extractFor(user.getId(), yesterday);
                log.info("Life-event extraction for user {} on {}: {} candidate(s)", user.getId(),
                    yesterday, candidates);
            } catch (Exception e) {
                log.warn("Life-event extraction failed for user {} on {}", user.getId(), yesterday, e);
            }
        }
    }
}
```

(`CompanionProperties` is imported but unused directly in this class — the cron expression is read
by Spring from `${mezo.companion.graph.cron}` at the `@Scheduled` annotation, not injected as a
field. Remove the unused `import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;`
line before compiling — it was listed above only to document where the cron value comes from.)

- [ ] **Step 2: Write and run `GraphMaintenanceJobSwitchOffIT`**

(Moved here from Task 1 — see that task's amendment note: writing this earlier, before
`GraphMaintenanceJob` existed, broke `test-compile` for the whole module.)

Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphMaintenanceJobSwitchOffIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.graph.service.GraphMaintenanceJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** Job switch off ⇒ the nightly maintenance cron bean does not exist (mezo-b3pp.10). */
@TestPropertySource(properties = "mezo.techcore.cron.graph-maintenance-job.enabled=false")
class GraphMaintenanceJobSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoJobBean_whenJobSwitchOff() {
        assertThat(context.getBeanProvider(GraphMaintenanceJob.class).getIfAvailable()).isNull();
    }
}
```

Run it:

```bash
./mvnw test -Dtest=GraphMaintenanceJobSwitchOffIT
```

Expected: PASS.

- [ ] **Step 3: Run the full companion + graph test packages for regressions**

```bash
./mvnw test -Dtest='io.mrkuhne.mezo.feature.companion.**'
```

Expected: BUILD SUCCESS. (This is the broad focused-package run the house workflow calls for
locally — compose must be up per `AGENTS.md`; the full backend suite stays CI's job.)

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphMaintenanceJob.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphMaintenanceJobSwitchOffIT.java
git commit -m "feat(companion): GraphMaintenanceJob — nightly decay/reconcile/extraction (mezo-b3pp.10)"
```

---

### Task 6: Docs — companion.md + CODEMAP regen + lint

**Files:**
- Modify: `docs/features/companion.md` (coverage table row + new `### W2.5` subsection)
- Modify: `docs/CODEMAP.md` (regenerated, never hand-edited)

**Interfaces:** none — documentation only.

- [ ] **Step 1: Add the coverage-table row**

In `docs/features/companion.md`, insert a new row immediately after the "Graph traversal +
[Összefüggések] prompt block" row (the row ending `...IDENT-3: failures log + omit, degraded
untouched, savepoint keeps the turn's transaction alive.` — currently the row right before
"Episodic recall in chat"):

```markdown
| Graph maintenance job (decay + reinforcement) | ✅ `mezo-b3pp.10` | Phase 5 W2.5 — nightly `GraphMaintenanceJob` (`mezo.companion.graph.cron`, dawn slot, `COMPANION_SWITCH` ∧ `KNOWLEDGE_GRAPH_SWITCH` ∧ its own job switch): per-user, three phase-isolated steps — `GraphMaintenanceService.runMaintenance` (edge weight ×= `decayFactor` daily, edges under `pruneFloor` soft-deleted in the same pass, candidate nodes older than `candidateMaxAgeDays` soft-deleted, fresh same-night `pattern_event` snapshot evidence bumps a promoted pattern's touching edges by `reinforcementBump` capped at 1.0), then W2.2's `GraphPromotionService.reconcile` (now per-row isolated, mezo-b3pp.32 fixed alongside), then W2.3's `LifeEventExtractionService.extractFor(yesterday)`. A failure in any phase for any user never skips the rest. |
```

- [ ] **Step 2: Add the `### W2.5` architecture subsection**

In `docs/features/companion.md`, insert a new subsection right before the `### Entities` heading
that follows the `### W2.4 graph traversal...` section (search for `### Entities` — it is the
heading immediately after the paragraph ending `...ChatServiceGraphBlockSwitchOffIT\`.`):

```markdown
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
  THREE independently try/caught phases, in order: `GraphMaintenanceService.runMaintenance` →
  `GraphPromotionService.reconcile` (W2.2) → `LifeEventExtractionService.extractFor(yesterday)`
  (W2.3) — a failure in one phase never skips the other two for that user, and never skips the
  next user. Gated on `COMPANION_SWITCH` ∧ `KNOWLEDGE_GRAPH_SWITCH` ∧ its own
  `mezo.techcore.cron.graph-maintenance-job.enabled` switch; the three collaborators it calls all
  already require at least `KNOWLEDGE_GRAPH_SWITCH`, so direct constructor injection is safe.
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
```

- [ ] **Step 3: Regenerate the codemap**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/phase5-slice-mezo-b3pp-eab8f9
node scripts/gen-codemap.mjs
```

Expected: `docs/CODEMAP.md` updates to include the two new backend files (`GraphMaintenanceService`,
`GraphMaintenanceJob`, `GraphMaintenanceResult`) under the companion/graph package entry.

- [ ] **Step 4: Lint the docs**

```bash
node scripts/lint-docs.mjs
```

Expected: exits clean — no new orphans, no broken links, no staleness warnings introduced by this
change.

- [ ] **Step 5: Commit**

```bash
git add docs/features/companion.md docs/CODEMAP.md
git commit -m "docs(companion): W2.5 graph maintenance job (mezo-b3pp.10)"
```

---

## Self-Review Notes (for the plan author, not a task)

- **Spec coverage:** §6.5's four acceptance bullets are each a distinct assertion in
  `GraphMaintenanceServiceIT` (decay, floor-prune, reinforcement, "active nodes never pruned").
  The "also hosts the W2.2 nightly reconciler + W2.3 extraction (three phases, per-phase
  isolation)" requirement is Task 5's `GraphMaintenanceJob`. The `mezo-b3pp.32` prerequisite is
  Task 2. Config idiom (§11) is Task 1. Docs mandate (§11) is Task 6.
- **Out of scope (confirmed against §12):** no graph visualization, no new REST endpoints (W2.6
  handles the FE surface separately, bd `mezo-b3pp.11`, not part of this slice).
- **Type consistency check:** `GraphMaintenanceResult` field names
  (`edgesDecayed`/`edgesPruned`/`candidatesPruned`/`edgesReinforced`) are used identically in
  Task 4's IT assertions, Task 4's service implementation, and Task 5's job's log statement.
