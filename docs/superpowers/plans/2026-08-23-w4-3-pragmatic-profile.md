# W4.3 — Pragmatic profile node + injection (`mezo-b3pp.17`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A weekly smart-tier `ProfileAssembler` distills the W4.2 feedback rollups, the reviewed W1.4 decisions and the active graph nodes into one compact Hungarian "how to talk to Daniel" prose, stored as the singleton `knowledge_node(kind=INSIGHT, source_kind='profile')`, injected into every chat turn as a capped `[Rólad tanultam]` block and shown read-only in Tudástár with an archive ("reset what you think of me") lever.

**Architecture:** New `feature/companion/profile/` subpackage inside the companion slice: `ProfileProperties` (config), `ProfileAssembler` (gather → smart LLM → upsert singleton node), `ProfileAssemblerJob` (weekly cron), `ProfilePromptAssembler` (render the block for `ChatService`). Storage reuses the existing `GraphService.upsertNode` idempotency key `(created_by, source_kind, source_id)` with `source_kind='profile'`, `source_id = userId` — the partial unique index makes the singleton a DB guarantee, so **no new table and no migration**. The REST contract is unchanged too: `GraphNodeResponse` already carries `sourceKind`, so the FE splits the profile out of the "Kapcsolatok" list by that field alone.

**Tech Stack:** Java 21 / Spring Boot (JPA, `@ConditionalOnProperty` bean gating, `@Scheduled`), `CompanionLlm.completeSmart` (gemini-2.5-pro), React 19 + TanStack Query (dual-mode), Vitest, Testcontainers-backed integration tests.

## Global Constraints

- **Contract-first:** `api/feature/...` fragment before code; backend implements the generated `<Tag>Api`. **This slice changes no contract** — `GraphNodeResponse.sourceKind` already exists (`api/feature/knowledge-graph/knowledge-graph.yml:104`). If a step seems to need a new endpoint, stop and re-read: it does not.
- **Every LLM/embed call site** wraps in `llmCallContextHolder.runWith(new LlmCallContext(feature, operation, entityKind, entityId), …)`. This slice's feature name is **`companion_profile`**, operation **`assemble`**.
- **Tier discipline:** smart tier (`completeSmart`) only — this is weekly synthesis, the same class of call as `WeeklySuggestionGenerator`.
- **Config, never code:** every threshold lives in `@Validated @ConfigurationProperties` records; every field must be present in `application.yml` or the context fails to start.
- **New crons in the dawn dead zone** with a `mezo.techcore.cron.<job>.enabled` switch + a SwitchOff IT proving the bean does not exist when off. Occupied 03:xx slots: 03:00 SUN, 03:10, 03:20, 03:30 MON, 03:40, 03:50 (1st of month). **This slice takes `0 45 3 * * MON`.**
- **Integration-first tests.** No new domain table ⇒ **no `ResetDatabase` change** (`knowledge_node` is already truncated, `ResetDatabase.java:40`).
- **IDENT-3 never silent-broken:** graph off ⇒ the profile beans do not exist ⇒ `ChatService` renders an empty block, never an error. `ProfilePromptAssembler` never throws.
- **IDENT-6:** the profile is L1-derived-but-visible — it is auto-written (no approve card) but always visible in Tudástár with an explicit archive lever.
- **Hungarian user-facing copy** everywhere (prompt block header, FE labels, LLM instruction).
- **Docs in the same change:** `docs/features/companion.md` + `docs/features/me.md`, then `node scripts/gen-codemap.mjs` and `node scripts/lint-docs.mjs` (new staleness forbidden).
- **Commit subjects** carry the bd id: `feat(companion): … (mezo-b3pp.17)`.

## Spec interpretation (decided up front, documented in `companion.md`)

Spec §8.3 says the assembler distills "feedback rollups + style stats + reviewed `decision_entry` outcomes (+ **RECOVERY-related graph nodes** when W2 live)". There is no `RECOVERY` node kind in the shipped graph (kinds: `PATTERN|PREFERENCE|GOAL|LIFE_EVENT|SEASON|INSIGHT`). The faithful reading with W2 live is *"what the graph already knows about how he works"*: the assembler feeds in the titles of the user's **active `PATTERN` and `PREFERENCE` nodes** (capped, newest first), excluding the profile node itself. This is recorded as a deliberate interpretation, not a silent deviation.

## File Structure

**Created (backend, all under `backend/src/main/java/io/mrkuhne/mezo/feature/companion/profile/`):**
- `config/ProfileProperties.java` — `mezo.companion.profile` knobs (the `FeedbackLearningProperties` precedent: a feature-scoped record, not another `CompanionProperties` nested component).
- `service/ProfileAssembler.java` — gather (pure code) → smart LLM → upsert + re-activate the singleton node. Public `Optional<UUID> rebuild(UUID userId)` (W5.3 `mezo-b3pp.20` will call it too).
- `service/ProfileAssemblerJob.java` — weekly cron, per-user try/catch.
- `service/ProfilePromptAssembler.java` — `String render(UUID userId)`, the capped `[Rólad tanultam]` block; never throws.
- `entity/ProfileMetaEnvelope.java` — the typed `meta` jsonb envelope for the profile node.

**Modified (backend):**
- `techcore/configuration/FeaturesConfiguration.java` — `PROFILE_ASSEMBLER_JOB_SWITCH` constant.
- `feature/companion/feedback/repository/FeedbackRollupRepository.java` — a list-all-scopes finder.
- `feature/journal/repository/DecisionEntryRepository.java` — a reviewed-decisions finder.
- `feature/companion/service/ChatService.java` — `ObjectProvider<ProfilePromptAssembler>` + the block's slot in `assembleSystemPrompt`.
- `feature/companion/llm/FakeCompanionLlm.java` — a dispatch branch for the profile marker.
- `backend/src/main/resources/application.yml` — `mezo.companion.profile` block + the cron switch.

**Created (backend tests):** `ProfilePropertiesIT`, `ProfileAssemblerIT`, `ProfileAssemblerJobSwitchOffIT`, `ProfilePromptAssemblerIT`, `ChatServiceProfileBlockIT`.
**Modified (backend tests):** `support/populator/GraphPopulator.java` (a source-bearing node helper), `support/populator/JournalPopulator.java` (a reviewed decision helper).

**Modified (frontend):** `data/types.ts` (`KnowledgeGraphNode.sourceKind`), `data/insights/graphApi.ts` (map it), `data/insights/graph.ts` (seed + `PROFILE_SOURCE_KIND`), `features/me/pages/KnowledgePage.tsx` (split the profile out), `features/me/pages/KnowledgePage.test.tsx`.
**Created (frontend):** `features/me/components/ProfileNodeCard.tsx` + `.test.tsx`.

---

### Task 1: Config — `ProfileProperties`, the cron switch, `application.yml`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/profile/config/ProfileProperties.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`
- Modify: `backend/src/main/resources/application.yml`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/profile/ProfilePropertiesIT.java`

**Interfaces:**
- Consumes: nothing.
- Produces: `ProfileProperties(String cron, int renderMaxTokens, int maxDecisions, int maxGraphNodes)` with accessors `cron()`, `renderMaxTokens()`, `maxDecisions()`, `maxGraphNodes()`; `FeaturesConfiguration.PROFILE_ASSEMBLER_JOB_SWITCH = "mezo.techcore.cron.profile-assembler-job.enabled"`.

- [ ] **Step 1: Write the failing test**

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/profile/ProfilePropertiesIT.java` (mirror `feature/companion/feedback/FeedbackLearningPropertiesIT.java` for imports/base class):

```java
package io.mrkuhne.mezo.feature.companion.profile;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.profile.config.ProfileProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** W4.3 (mezo-b3pp.17): the profile knobs are config, never code — this pins the shipped defaults. */
class ProfilePropertiesIT extends AbstractIntegrationTest {

    @Autowired
    private ProfileProperties properties;

    @Test
    void ships_weekly_monday_defaults() {
        assertThat(properties.cron()).isEqualTo("0 45 3 * * MON");
        assertThat(properties.renderMaxTokens()).isEqualTo(400);
        assertThat(properties.maxDecisions()).isEqualTo(10);
        assertThat(properties.maxGraphNodes()).isEqualTo(12);
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='ProfilePropertiesIT'
```

Expected: compilation failure — `ProfileProperties` does not exist.

- [ ] **Step 3: Create the properties record**

`.../companion/profile/config/ProfileProperties.java`:

```java
package io.mrkuhne.mezo.feature.companion.profile.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * W4.3 (mezo-b3pp.17, spec §8.3) — the pragmatic-profile knobs.
 *
 * <p>Feature-scoped record rather than another {@code CompanionProperties} nested component: the
 * {@code FeedbackLearningProperties} precedent (that class's javadoc carries the argument —
 * {@code CompanionProperties} is already 17 components deep and every new one widens a file every
 * companion session must read). Picked up by {@code @ConfigurationPropertiesScan}.
 *
 * @param cron           weekly run, AFTER the Monday 03:30 consolidation rung and the 03:10
 *                       feedback rollups — the profile reads both, so it must run last.
 * @param renderMaxTokens hard cap on the injected {@code [Rólad tanultam]} block (spec §8.3:
 *                       ≤400 tokens). Applied at STORE time as well, so Tudástár shows exactly
 *                       the text the model gets — never more.
 * @param maxDecisions   how many reviewed decisions (newest first) enter the LLM payload.
 * @param maxGraphNodes  how many active PATTERN/PREFERENCE node titles enter the payload.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.companion.profile")
public record ProfileProperties(
        @NotBlank String cron,
        @Min(50) @Max(2000) int renderMaxTokens,
        @Min(0) @Max(100) int maxDecisions,
        @Min(0) @Max(100) int maxGraphNodes) {
}
```

- [ ] **Step 4: Add the cron switch constant**

In `FeaturesConfiguration.java`, next to `FEEDBACK_LEARNING_JOB_SWITCH`, add:

```java
    /** W4.3 (mezo-b3pp.17): the weekly profile assembler job. */
    public static final String PROFILE_ASSEMBLER_JOB_SWITCH = "mezo.techcore.cron.profile-assembler-job.enabled";
```

- [ ] **Step 5: Add the yml block and the switch default**

In `application.yml`, under `mezo.techcore.cron`, beside `feedback-learning-job`:

```yaml
      # W4.3 (mezo-b3pp.17): weekly pragmatic-profile synthesis (smart tier, one LLM call/user/week)
      profile-assembler-job:
        enabled: true
```

and under `mezo.companion`, right after the `feedback-learning` block:

```yaml
    # W4.3 (mezo-b3pp.17): the pragmatic profile — "hogyan érdemes Daniellel beszélni"
    profile:
      # Monday 03:45 — after the 03:10 feedback rollups and the 03:30 weekly consolidation rung,
      # both of which are this job's inputs.
      cron: "0 45 3 * * MON"
      render-max-tokens: 400
      max-decisions: 10
      max-graph-nodes: 12
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
cd backend && ./mvnw test -Dtest='ProfilePropertiesIT'
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/profile backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/companion/profile
git commit -m "feat(companion): W4.3 profile config knobs + cron switch (mezo-b3pp.17)"
```

---

### Task 2: Read-side finders + test populators

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/repository/FeedbackRollupRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/journal/repository/DecisionEntryRepository.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/GraphPopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/JournalPopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/profile/ProfileSourceFindersIT.java`

**Interfaces:**
- Consumes: Task 1's nothing.
- Produces:
  - `List<FeedbackRollupEntity> FeedbackRollupRepository.findByCreatedByAndDeletedFalseOrderByScopeAsc(UUID createdBy)`
  - `List<DecisionEntryEntity> DecisionEntryRepository.findByCreatedByAndReviewedAtIsNotNullAndDeletedFalseOrderByReviewedAtDesc(UUID createdBy, Limit limit)`
  - `GraphNodeEntity GraphPopulator.createSourcedNode(AppUserEntity owner, String kind, String title, String summary, String sourceKind, UUID sourceId)`
  - `DecisionEntryEntity JournalPopulator.createReviewedDecision(AppUserEntity owner, LocalDate decidedOn, String decisionText, int outcomeRating, String outcomeText)`

- [ ] **Step 1: Write the failing test**

`.../feature/companion/profile/ProfileSourceFindersIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.profile;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.feedback.repository.FeedbackRollupRepository;
import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Limit;

/** W4.3 (mezo-b3pp.17): the two read-side finders the ProfileAssembler gathers with. */
class ProfileSourceFindersIT extends AbstractIntegrationTest {

    @Autowired
    private FeedbackRollupRepository rollupRepository;
    @Autowired
    private DecisionEntryRepository decisionRepository;

    @Test
    void reviewed_decisions_come_back_newest_first_and_unreviewed_stay_out() {
        databasePopulator.journal().createDecision(
                user, LocalDate.of(2026, 7, 1), "Nem edzek hajnalban", LocalDate.of(2026, 7, 15), null);
        databasePopulator.journal().createReviewedDecision(
                user, LocalDate.of(2026, 6, 1), "Heti 3 edzés", 4, "Bevált, tartható volt.");
        databasePopulator.journal().createReviewedDecision(
                user, LocalDate.of(2026, 5, 1), "Esti képernyőstop", 2, "Nem tartottam be.");

        List<DecisionEntryEntity> reviewed = decisionRepository
                .findByCreatedByAndReviewedAtIsNotNullAndDeletedFalseOrderByReviewedAtDesc(user.getId(), Limit.of(10));

        assertThat(reviewed).hasSize(2)
                .allSatisfy(d -> assertThat(d.getReviewedAt()).isNotNull());
        assertThat(reviewed).extracting(DecisionEntryEntity::getDecisionText)
                .doesNotContain("Nem edzek hajnalban");
    }

    @Test
    void all_rollup_scopes_for_a_user_come_back_in_one_read() {
        feedbackLearningService.computeRollups(user.getId());

        assertThat(rollupRepository.findByCreatedByAndDeletedFalseOrderByScopeAsc(user.getId()))
                .hasSize(11);
    }
}
```

Wire `feedbackLearningService` in the same test class with
`@Autowired private io.mrkuhne.mezo.feature.companion.feedback.service.FeedbackLearningService feedbackLearningService;`
and annotate the class `@ActiveProfiles("companion-fake")` only if the base class needs it — `computeRollups` is pure code, so no LLM profile is required; do NOT add it.

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='ProfileSourceFindersIT'
```

Expected: compilation failure — the two finders and `createReviewedDecision` do not exist.

- [ ] **Step 3: Add the finders**

`FeedbackRollupRepository.java` — add:

```java
    /** W4.3 (mezo-b3pp.17): every scope for one user in a single read — the ProfileAssembler needs
     *  all 11 rollups at once, and 11 point lookups would be 11 round trips for the same page. */
    List<FeedbackRollupEntity> findByCreatedByAndDeletedFalseOrderByScopeAsc(UUID createdBy);
```

(add `import java.util.List;` if missing.)

`DecisionEntryRepository.java` — add:

```java
    /** W4.3 (mezo-b3pp.17): decisions Daniel has ALREADY reviewed ({@code reviewedAt != null}),
     *  newest review first, capped by the caller — the profile's decision-quality input. */
    List<DecisionEntryEntity> findByCreatedByAndReviewedAtIsNotNullAndDeletedFalseOrderByReviewedAtDesc(
        UUID createdBy, Limit limit);
```

(add `import org.springframework.data.domain.Limit;`.)

- [ ] **Step 4: Add the populator helpers**

`JournalPopulator.java` — add next to `createDecision` (match the file's existing entity-construction style; `reviewedAt` must be set explicitly because `createDecision` never sets it):

```java
    /** W4.3 (mezo-b3pp.17): a decision that has already been through the review loop. */
    public DecisionEntryEntity createReviewedDecision(AppUserEntity owner, LocalDate decidedOn,
            String decisionText, int outcomeRating, String outcomeText) {
        DecisionEntryEntity entity = new DecisionEntryEntity();
        entity.setCreatedBy(owner.getId());
        entity.setDecidedOn(decidedOn);
        entity.setDecisionText(decisionText);
        entity.setReviewDue(decidedOn.plusDays(14));
        entity.setReviewedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        entity.setOutcomeRating((short) outcomeRating);
        entity.setOutcomeText(outcomeText);
        return decisionEntryRepository.saveAndFlush(entity);
    }
```

`GraphPopulator.java` — add:

```java
    /** W4.3 (mezo-b3pp.17): a node carrying the (sourceKind, sourceId) idempotency key — the
     *  profile singleton's shape, which `createNode` cannot express. */
    public GraphNodeEntity createSourcedNode(AppUserEntity owner, String kind, String title,
            String summary, String sourceKind, UUID sourceId) {
        GraphNodeEntity node = new GraphNodeEntity();
        node.setCreatedBy(owner.getId());
        node.setKind(kind);
        node.setTitle(title);
        node.setSummary(summary);
        node.setSourceKind(sourceKind);
        node.setSourceId(sourceId);
        return nodeRepository.saveAndFlush(node);
    }
```

(Use the repository field name already present in `GraphPopulator`; if the existing `createNode` uses a differently named field, reuse that exact name.)

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd backend && ./mvnw test -Dtest='ProfileSourceFindersIT'
```

Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature backend/src/test/java/io/mrkuhne/mezo
git commit -m "feat(companion): W4.3 profile read-side finders + populators (mezo-b3pp.17)"
```

---

### Task 3: `ProfileAssembler` — gather, synthesize, upsert the singleton

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/profile/entity/ProfileMetaEnvelope.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/profile/service/ProfileAssembler.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/profile/ProfileAssemblerIT.java`

**Interfaces:**
- Consumes: `ProfileProperties` (Task 1); the two finders + populators (Task 2); `GraphService.upsertNode(UUID, String kind, String title, String summary, String sourceKind, UUID sourceId, LocalDate occurredOn, Map<String,Object> meta)`, `GraphService.listActive(UUID)`; `CompanionLlm.completeSmart(String systemPrompt, String userMessage)`; `LlmCallContextHolder.runWith(LlmCallContext, Supplier<T>)`.
- Produces:
  - `ProfileAssembler.SOURCE_PROFILE = "profile"`, `ProfileAssembler.PROFILE_TITLE = "Rólad tanultam"`, `ProfileAssembler.PROFILE_MARKER = "ROLAD-TANULTAM"`
  - `Optional<UUID> ProfileAssembler.rebuild(UUID userId)` — the node id when a profile was written, empty on honest absence (no signal / blank answer).
  - `String ProfileAssembler.gather(UUID userId)` — the pure-code payload, `null` when there is no signal at all.
  - `ProfileMetaEnvelope(Instant generatedAt, int feedbackSignals, int reviewedDecisions, int graphNodes)` with `META_KEY = "profile"` and `Map<String,Object> toMeta()`.

- [ ] **Step 1: Write the failing test**

`.../feature/companion/profile/ProfileAssemblerIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.profile;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfileAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/** W4.3 (mezo-b3pp.17, spec §8.3): the weekly profile synthesis. */
@ActiveProfiles("companion-fake")
class ProfileAssemblerIT extends AbstractIntegrationTest {

    @Autowired
    private ProfileAssembler assembler;
    @Autowired
    private GraphNodeRepository nodeRepository;

    private void seedSignal() {
        databasePopulator.feedback().createVerdict(
                user, "chat_message", UUID.randomUUID(), "up", null);
        databasePopulator.journal().createReviewedDecision(
                user, LocalDate.of(2026, 6, 1), "Heti 3 edzés", 4, "Bevált.");
    }

    @Test
    void writes_the_singleton_profile_node_keyed_by_the_user() {
        seedSignal();

        Optional<UUID> nodeId = assembler.rebuild(user.getId());

        assertThat(nodeId).isPresent();
        GraphNodeEntity node = nodeRepository.findById(nodeId.orElseThrow()).orElseThrow();
        assertThat(node.getKind()).isEqualTo(GraphNodeEntity.KIND_INSIGHT);
        assertThat(node.getSourceKind()).isEqualTo(ProfileAssembler.SOURCE_PROFILE);
        assertThat(node.getSourceId()).isEqualTo(user.getId());
        assertThat(node.getTitle()).isEqualTo(ProfileAssembler.PROFILE_TITLE);
        assertThat(node.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
        assertThat(node.getSummary()).isNotBlank();
    }

    @Test
    void rerunning_updates_the_same_row_instead_of_adding_a_second_one() {
        seedSignal();

        UUID first = assembler.rebuild(user.getId()).orElseThrow();
        UUID second = assembler.rebuild(user.getId()).orElseThrow();

        assertThat(second).isEqualTo(first);
        assertThat(nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                user.getId(), GraphNodeEntity.STATUS_ACTIVE))
                .filteredOn(n -> ProfileAssembler.SOURCE_PROFILE.equals(n.getSourceKind()))
                .hasSize(1);
    }

    @Test
    void an_archived_profile_is_revived_by_the_next_run() {
        seedSignal();
        UUID nodeId = assembler.rebuild(user.getId()).orElseThrow();
        GraphNodeEntity archived = nodeRepository.findById(nodeId).orElseThrow();
        archived.setStatus(GraphNodeEntity.STATUS_ARCHIVED);
        nodeRepository.saveAndFlush(archived);

        assembler.rebuild(user.getId());

        assertThat(nodeRepository.findById(nodeId).orElseThrow().getStatus())
                .isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
    }

    @Test
    void no_signal_means_no_profile_and_no_llm_call() {
        long before = fakeCompanionLlm.completeCallCount();

        assertThat(assembler.rebuild(user.getId())).isEmpty();

        assertThat(fakeCompanionLlm.completeCallCount()).isEqualTo(before);
        assertThat(nodeRepository.findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(
                user.getId(), ProfileAssembler.SOURCE_PROFILE, user.getId())).isEmpty();
    }

    @Test
    void the_stored_prose_is_capped_at_the_configured_token_budget() {
        seedSignal();

        UUID nodeId = assembler.rebuild(user.getId()).orElseThrow();

        assertThat(nodeRepository.findById(nodeId).orElseThrow().getSummary().length())
                .isLessThanOrEqualTo(400 * 3);
    }
}
```

`fakeCompanionLlm` — wire it as `@Autowired private io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm fakeCompanionLlm;` (the class is a real bean under the `companion-fake` profile). If `AbstractIntegrationTest` already exposes it under another name, reuse that.

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='ProfileAssemblerIT'
```

Expected: compilation failure — `ProfileAssembler` does not exist.

- [ ] **Step 3: Create the meta envelope**

`.../profile/entity/ProfileMetaEnvelope.java`:

```java
package io.mrkuhne.mezo.feature.companion.profile.entity;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * W4.3 (mezo-b3pp.17): the profile node's typed {@code meta} payload — what the synthesis was
 * built from, so a surprising profile can be explained without re-running the job. Written as a
 * plain map under {@link #META_KEY} (the {@code GraphProposedEdge} idiom: the envelope owns its
 * own meta key, and read-back is hand-rolled rather than {@code ObjectMapper.convertValue}).
 */
public record ProfileMetaEnvelope(
        Instant generatedAt, int feedbackSignals, int reviewedDecisions, int graphNodes) {

    public static final String META_KEY = "profile";

    public Map<String, Object> toMeta() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("generatedAt", generatedAt.toString());
        payload.put("feedbackSignals", feedbackSignals);
        payload.put("reviewedDecisions", reviewedDecisions);
        payload.put("graphNodes", graphNodes);
        return Map.of(META_KEY, payload);
    }
}
```

- [ ] **Step 4: Create the assembler**

`.../profile/service/ProfileAssembler.java`:

```java
package io.mrkuhne.mezo.feature.companion.profile.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupEntity;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupStatsEnvelope;
import io.mrkuhne.mezo.feature.companion.feedback.repository.FeedbackRollupRepository;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphService;
import io.mrkuhne.mezo.feature.companion.profile.config.ProfileProperties;
import io.mrkuhne.mezo.feature.companion.profile.entity.ProfileMetaEnvelope;
import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * W4.3 (mezo-b3pp.17, spec §8.3) — the pragmatic profile: one weekly smart-tier synthesis of
 * "hogyan érdemes Daniellel beszélni", distilled from the W4.2 feedback rollups (per-surface
 * effectiveness + 👎-reason histogram), the reviewed W1.4 decisions, and what the graph already
 * knows about how he works.
 *
 * <p><b>Storage:</b> the singleton {@code knowledge_node(kind=INSIGHT, source_kind='profile',
 * source_id=userId)} — spec §4.2 ("not a separate table"). The user id as {@code source_id} is
 * load-bearing: {@code uq_knowledge_node_source} is a PARTIAL index ({@code where source_id is not
 * null}), so a null source id would silently drop the DB-level singleton guarantee.
 *
 * <p><b>Graph nodes as input (spec interpretation):</b> §8.3 asks for "RECOVERY-related graph
 * nodes when W2 live". There is no RECOVERY node kind; the faithful reading is what the graph
 * knows about how he works, i.e. the active PATTERN/PREFERENCE titles (the profile node itself
 * excluded — it must never eat its own output).
 *
 * <p><b>Honest absence:</b> with no feedback verdicts, no reviewed decisions and no graph nodes
 * there is nothing to learn from — no LLM call, no node, and any existing profile is left exactly
 * as it is rather than overwritten with an invention.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH},
    havingValue = "true")
public class ProfileAssembler {

    /** The {@code source_kind} of the singleton (spec §4.2). */
    public static final String SOURCE_PROFILE = "profile";

    /** Fixed node title — the prose lives in {@code summary}; the title is the Tudástár label. */
    public static final String PROFILE_TITLE = "Rólad tanultam";

    /** First line of the prompt — the fake LLM dispatches on it (FakeCompanionLlm). */
    public static final String PROFILE_MARKER = "ROLAD-TANULTAM";

    /** Same chars-per-token estimate as the [Emlékek]/[Összefüggések] blocks. */
    static final int CHARS_PER_TOKEN = 3;

    private static final String PROMPT = PROFILE_MARKER + """

            Te Daniel személyes társának a tanuló rétege vagy. A lenti nyers jelekből írj EGYETLEN
            tömör, magyar bekezdést arról, HOGYAN érdemes Daniellel beszélni: milyen üzenet válik be
            nála, mikor, milyen hosszban, mit utasít el. Csak abból dolgozz, amit a jelek mutatnak —
            ha valamire nincs jel, hallgass róla. Ne szólítsd meg, ne adj tanácsot, ne sorold fel a
            számokat: a megfigyelést fogalmazd meg. Legfeljebb 5 mondat.""";

    private final FeedbackRollupRepository rollupRepository;
    private final DecisionEntryRepository decisionRepository;
    private final GraphService graphService;
    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ProfileProperties properties;

    /**
     * Rebuilds the profile for one user. Returns the node id, or empty when there was no signal
     * to learn from or the model came back blank (both honest no-ops, not failures).
     *
     * <p>W5.3 (mezo-b3pp.20) calls this too, after the quarterly pass.
     */
    @Transactional
    public Optional<UUID> rebuild(UUID userId) {
        List<FeedbackRollupEntity> rollups = rollupRepository.findByCreatedByAndDeletedFalseOrderByScopeAsc(userId);
        List<DecisionEntryEntity> decisions = decisionRepository
                .findByCreatedByAndReviewedAtIsNotNullAndDeletedFalseOrderByReviewedAtDesc(
                        userId, Limit.of(properties.maxDecisions()));
        List<GraphNodeEntity> nodes = habitNodes(userId);
        int signals = feedbackSignals(rollups);
        if (signals == 0 && decisions.isEmpty() && nodes.isEmpty()) {
            log.debug("Profile skipped for user {} — no feedback, no reviewed decisions, no graph nodes", userId);
            return Optional.empty();
        }
        String payload = renderPayload(rollups, decisions, nodes);
        String prose = llmCallContextHolder.runWith(
                new LlmCallContext("companion_profile", "assemble", null, null),
                () -> companionLlm.completeSmart(PROMPT, payload));
        if (prose == null || prose.isBlank()) {
            log.warn("Profile skipped for user {} — the model returned nothing", userId);
            return Optional.empty();
        }
        GraphNodeEntity node = graphService.upsertNode(userId, GraphNodeEntity.KIND_INSIGHT, PROFILE_TITLE,
                cap(prose.strip(), properties.renderMaxTokens()), SOURCE_PROFILE, userId, null,
                new ProfileMetaEnvelope(Instant.now().truncatedTo(ChronoUnit.MICROS),
                        signals, decisions.size(), nodes.size()).toMeta());
        // upsertNode deliberately does not touch status (W2.2 owns its own status rules); the
        // weekly run is exactly the "reset what you think of me" recovery path spec §8.3 promises,
        // so an archived profile comes back ACTIVE here.
        if (!GraphNodeEntity.STATUS_ACTIVE.equals(node.getStatus())) {
            node.setStatus(GraphNodeEntity.STATUS_ACTIVE);
        }
        return Optional.of(node.getId());
    }

    /** Active PATTERN/PREFERENCE nodes, newest first, capped — never the profile node itself. */
    private List<GraphNodeEntity> habitNodes(UUID userId) {
        return graphService.listActive(userId).stream()
                .filter(n -> GraphNodeEntity.KIND_PATTERN.equals(n.getKind())
                        || GraphNodeEntity.KIND_PREFERENCE.equals(n.getKind()))
                .filter(n -> !SOURCE_PROFILE.equals(n.getSourceKind()))
                .limit(properties.maxGraphNodes())
                .toList();
    }

    private static int feedbackSignals(List<FeedbackRollupEntity> rollups) {
        return rollups.stream()
                .map(FeedbackRollupEntity::getStats)
                .filter(java.util.Objects::nonNull)
                .map(FeedbackRollupStatsEnvelope::total)
                .filter(java.util.Objects::nonNull)
                .mapToInt(Integer::intValue)
                .sum();
    }

    /** The LLM payload — pure code, honest about absence (a section with nothing stays out). */
    String renderPayload(List<FeedbackRollupEntity> rollups, List<DecisionEntryEntity> decisions,
            List<GraphNodeEntity> nodes) {
        StringBuilder out = new StringBuilder();
        List<String> feedbackLines = rollups.stream()
                .filter(r -> r.getStats() != null && r.getStats().total() != null && r.getStats().total() > 0)
                .map(r -> "- " + r.getScope() + ": " + r.getStats().up() + " tetszik / "
                        + r.getStats().down() + " nem tetszik")
                .toList();
        if (!feedbackLines.isEmpty()) {
            out.append("VISSZAJELZÉSEK (utolsó 30 nap):\n").append(String.join("\n", feedbackLines)).append('\n');
        }
        List<String> reasonLines = rollups.stream()
                .filter(r -> FeedbackRollupEntity.SCOPE_STYLE.equals(r.getScope()))
                .filter(r -> r.getStats() != null && r.getStats().bySurface() != null)
                .flatMap(r -> r.getStats().bySurface().entrySet().stream())
                .map(e -> "- " + e.getKey() + ": pontatlan " + e.getValue().inaccurate()
                        + " · túl sok " + e.getValue().tooMuch()
                        + " · rossz időzítés " + e.getValue().badTiming()
                        + " · nem rólam szól " + e.getValue().notAboutMe())
                .toList();
        if (!reasonLines.isEmpty()) {
            out.append("\nELUTASÍTÁS OKAI:\n").append(String.join("\n", reasonLines)).append('\n');
        }
        if (!decisions.isEmpty()) {
            out.append("\nÉRTÉKELT DÖNTÉSEK:\n");
            for (DecisionEntryEntity d : decisions) {
                out.append("- ").append(d.getDecidedOn()).append(" · ").append(d.getDecisionText())
                        .append(" → ").append(d.getOutcomeRating()).append("/5");
                if (d.getOutcomeText() != null && !d.getOutcomeText().isBlank()) {
                    out.append(" · ").append(d.getOutcomeText());
                }
                out.append('\n');
            }
        }
        if (!nodes.isEmpty()) {
            out.append("\nAMIT A GRÁF TUD RÓLA:\n");
            for (GraphNodeEntity n : nodes) {
                out.append("- ").append(n.getTitle()).append('\n');
            }
        }
        return out.toString();
    }

    /** Hard cap at the injection budget, cut on a word boundary — Tudástár must never show more
     *  than the model is given. */
    static String cap(String text, int maxTokens) {
        int maxChars = maxTokens * CHARS_PER_TOKEN;
        if (text.length() <= maxChars) {
            return text;
        }
        String head = text.substring(0, maxChars - 1);
        int lastSpace = head.lastIndexOf(' ');
        return (lastSpace > 0 ? head.substring(0, lastSpace) : head) + "…";
    }
}
```

- [ ] **Step 5: Teach the fake LLM the profile marker**

In `FakeCompanionLlm.java`, beside the other marker mirrors, add:

```java
    /** W4.3 (mezo-b3pp.17): literal mirror of {@code ProfileAssembler.PROFILE_MARKER} — importing
     *  the constant would be a boundary-crossing import from the llm package into a feature
     *  subpackage's service; {@code ProfileAssemblerIT} pins the two strings together. */
    private static final String PROFILE_MARKER_MIRROR = "ROLAD-TANULTAM";
```

and in the `complete(...)` dispatch chain (next to the other `systemPrompt.startsWith(...)` branches) add:

```java
        if (systemPrompt.startsWith(PROFILE_MARKER_MIRROR)) {
            return "A rövid, konkrét reggeli üzenet válik be nálad; a hosszabb elemzést délben"
                    + " olvasod el, a bőséges tipplistát pedig rendre elutasítod.";
        }
```

Add to `ProfileAssemblerIT` a test pinning the mirror:

```java
    @Test
    void the_fake_llm_mirror_still_matches_the_marker() {
        assertThat(ProfileAssembler.PROFILE_MARKER).isEqualTo("ROLAD-TANULTAM");
    }
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd backend && ./mvnw test -Dtest='ProfileAssemblerIT'
```

Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/test/java/io/mrkuhne/mezo/feature/companion/profile
git commit -m "feat(companion): W4.3 ProfileAssembler weekly synthesis (mezo-b3pp.17)"
```

---

### Task 4: `ProfileAssemblerJob` — the weekly cron + switch-off proof

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/profile/service/ProfileAssemblerJob.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/profile/ProfileAssemblerJobIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/profile/ProfileAssemblerJobSwitchOffIT.java`

**Interfaces:**
- Consumes: `ProfileAssembler.rebuild(UUID)`; `FeaturesConfiguration.PROFILE_ASSEMBLER_JOB_SWITCH`.
- Produces: `ProfileAssemblerJob.run()`.

- [ ] **Step 1: Write the failing tests**

`ProfileAssemblerJobIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.profile;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfileAssembler;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfileAssemblerJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/** W4.3 (mezo-b3pp.17): the weekly job sweeps every user and never lets one failure kill the run. */
@ActiveProfiles("companion-fake")
class ProfileAssemblerJobIT extends AbstractIntegrationTest {

    @Autowired
    private ProfileAssemblerJob job;
    @Autowired
    private GraphNodeRepository nodeRepository;

    @Test
    void the_run_writes_a_profile_for_a_user_with_signal() {
        databasePopulator.feedback().createVerdict(user, "chat_message", UUID.randomUUID(), "up", null);
        databasePopulator.journal().createReviewedDecision(
                user, LocalDate.of(2026, 6, 1), "Heti 3 edzés", 4, "Bevált.");

        job.run();

        assertThat(nodeRepository.findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(
                user.getId(), ProfileAssembler.SOURCE_PROFILE, user.getId())).isPresent();
    }
}
```

`ProfileAssemblerJobSwitchOffIT.java` (copy the exact shape of `GraphMaintenanceJobSwitchOffIT` — same base class, same property-override mechanism):

```java
package io.mrkuhne.mezo.feature.companion.profile;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.profile.service.ProfileAssemblerJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** W4.3 (mezo-b3pp.17): switch off ⇒ the job bean does not exist at all (the house cron idiom). */
@TestPropertySource(properties = "mezo.techcore.cron.profile-assembler-job.enabled=false")
class ProfileAssemblerJobSwitchOffIT extends AbstractIntegrationTest {

    @Autowired
    private ApplicationContext context;

    @Test
    void the_job_bean_is_absent() {
        assertThat(context.getBeanNamesForType(ProfileAssemblerJob.class)).isEmpty();
    }
}
```

- [ ] **Step 2: Run them to verify they fail**

```bash
cd backend && ./mvnw test -Dtest='ProfileAssemblerJobIT,ProfileAssemblerJobSwitchOffIT'
```

Expected: compilation failure — `ProfileAssemblerJob` does not exist.

- [ ] **Step 3: Create the job**

```java
package io.mrkuhne.mezo.feature.companion.profile.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * W4.3 (mezo-b3pp.17, spec §8.3): the weekly profile rebuild, Monday 03:45 — deliberately AFTER
 * the 03:10 feedback rollups and the 03:30 weekly consolidation rung, both of which it reads.
 * One smart-tier call per user per week.
 *
 * <p>Direct injection of {@link ProfileAssembler} is safe because this bean requires the same two
 * switches the assembler does, plus its own cron switch (the {@code GraphMaintenanceJob} idiom).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH,
            FeaturesConfiguration.PROFILE_ASSEMBLER_JOB_SWITCH},
    havingValue = "true")
public class ProfileAssemblerJob {

    private final AppUserRepository appUserRepository;
    private final ProfileAssembler profileAssembler;

    @Scheduled(cron = "${mezo.companion.profile.cron}")
    public void run() {
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                profileAssembler.rebuild(user.getId())
                        .ifPresent(id -> log.info("Profile rebuilt for user {} (node {})", user.getId(), id));
            } catch (RuntimeException e) {
                log.warn("Profile rebuild failed for user {} — the sweep continues", user.getId(), e);
            }
        }
    }
}
```

Check the exact `AppUserEntity`/`AppUserRepository` package and the `findAll` idiom against `GraphMaintenanceJob.java` and copy them verbatim if they differ.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend && ./mvnw test -Dtest='ProfileAssemblerJobIT,ProfileAssemblerJobSwitchOffIT'
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/profile backend/src/test/java/io/mrkuhne/mezo/feature/companion/profile
git commit -m "feat(companion): W4.3 weekly profile assembler job (mezo-b3pp.17)"
```

---

### Task 5: `[Rólad tanultam]` injection into every chat turn

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/profile/service/ProfilePromptAssembler.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/profile/ProfilePromptAssemblerIT.java`

**Interfaces:**
- Consumes: `ProfileAssembler.SOURCE_PROFILE`, `GraphNodeRepository.findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse`, `ProfileProperties.renderMaxTokens()`.
- Produces: `ProfilePromptAssembler.PROFILE_HEADER` and `String ProfilePromptAssembler.render(UUID userId)` — `""` when there is no active profile.

- [ ] **Step 1: Write the failing test**

`ProfilePromptAssemblerIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.profile;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfileAssembler;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfilePromptAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** W4.3 (mezo-b3pp.17): the injected block — present, capped, and empty once archived. */
class ProfilePromptAssemblerIT extends AbstractIntegrationTest {

    @Autowired
    private ProfilePromptAssembler assembler;
    @Autowired
    private GraphNodeRepository nodeRepository;

    private GraphNodeEntity seedProfile(String prose) {
        return databasePopulator.graph().createSourcedNode(user, GraphNodeEntity.KIND_INSIGHT,
                ProfileAssembler.PROFILE_TITLE, prose, ProfileAssembler.SOURCE_PROFILE, user.getId());
    }

    @Test
    void renders_the_header_and_the_prose() {
        seedProfile("A rövid reggeli üzenet válik be nálad.");

        String block = assembler.render(user.getId());

        assertThat(block).startsWith(ProfilePromptAssembler.PROFILE_HEADER)
                .contains("A rövid reggeli üzenet válik be nálad.");
    }

    @Test
    void no_profile_means_an_empty_block() {
        assertThat(assembler.render(user.getId())).isEmpty();
    }

    @Test
    void an_archived_profile_empties_the_block() {
        GraphNodeEntity node = seedProfile("A rövid reggeli üzenet válik be nálad.");
        node.setStatus(GraphNodeEntity.STATUS_ARCHIVED);
        nodeRepository.saveAndFlush(node);

        assertThat(assembler.render(user.getId())).isEmpty();
    }

    @Test
    void the_block_stays_under_the_token_cap_even_for_an_oversized_row() {
        seedProfile("szó ".repeat(2000));

        assertThat(assembler.render(user.getId()).length()).isLessThanOrEqualTo(
                ProfilePromptAssembler.PROFILE_HEADER.length() + 400 * 3);
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='ProfilePromptAssemblerIT'
```

Expected: compilation failure — `ProfilePromptAssembler` does not exist.

- [ ] **Step 3: Create the prompt assembler**

```java
package io.mrkuhne.mezo.feature.companion.profile.service;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.profile.config.ProfileProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * W4.3 (mezo-b3pp.17, spec §8.3): the {@code [Rólad tanultam]} block — the profile node's prose,
 * injected right after the facts blocks so the model reads "how to talk to him" BEFORE the recalled
 * material it will talk about.
 *
 * <p>Archiving the node empties this block until the next weekly run — that is the explicit
 * "reset what you think of me" lever, so this reads the ACTIVE node only.
 *
 * <p>Failure honesty (IDENT-3): never throws — a failure logs a warn and yields "".
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH},
    havingValue = "true")
public class ProfilePromptAssembler {

    /** Same "\n\n[Blokk] (magyarázat):\n" shape as the facts/[Emlékek]/[Összefüggések] headers. */
    public static final String PROFILE_HEADER = "\n\n[Rólad tanultam] (a visszajelzéseidből és a"
            + " döntéseidből tanult minta — hogyan érdemes veled beszélni; nyersanyag, nem"
            + " felolvasandó lista):\n";

    private final GraphNodeRepository nodeRepository;
    private final ProfileProperties properties;

    /** The block for one turn — "" when there is no active profile. Never throws. */
    @Transactional(readOnly = true)
    public String render(UUID userId) {
        try {
            Optional<GraphNodeEntity> node = nodeRepository
                    .findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(
                            userId, ProfileAssembler.SOURCE_PROFILE, userId)
                    .filter(n -> GraphNodeEntity.STATUS_ACTIVE.equals(n.getStatus()))
                    .filter(n -> n.getSummary() != null && !n.getSummary().isBlank());
            return node.map(n -> PROFILE_HEADER
                            + ProfileAssembler.cap(n.getSummary().strip(), properties.renderMaxTokens()))
                    .orElse("");
        } catch (RuntimeException e) {
            log.warn("Profile block skipped for user {} — the turn continues without it", userId, e);
            return "";
        }
    }
}
```

- [ ] **Step 4: Wire it into `ChatService`**

In `ChatService.java`:

1. Add the field next to `graphPromptAssembler`:

```java
    /** W4.3 — the [Rólad tanultam] block (mezo-b3pp.17); absent (null) when the graph switch is off. */
    private final ObjectProvider<ProfilePromptAssembler> profilePromptAssembler;
```

2. Add the null-safe helper next to `graphContext`:

```java
    /** W4.3: the profile's contribution — "" when the bean is absent or nothing is stored. */
    private String profileBlock(UUID userId) {
        ProfilePromptAssembler assembler = profilePromptAssembler.getIfAvailable();
        return assembler == null ? "" : assembler.render(userId);
    }
```

3. Change `assembleSystemPrompt` to take the block and place it **after the fact blocks, before `[Emlékek]`** (spec §8.3: "after the facts block"), and update its javadoc line:

```java
    /**
     * The canonical system prompt: voice → snapshot (V0.3) → top-N facts (V1.1) → fresh
     * pattern-facts acknowledgment (V3.3) → [Rólad tanultam] pragmatic profile (W4.3, "" when the
     * profile is archived/absent) → [Emlékek] ambient recall (W3.1) → [Összefüggések] graph context
     * (W2.4, "" when the graph switch is off or nothing matched) → TONE_REMINDER (mezo-q71s, always
     * last). The history travels as real prior messages, not a transcript in here.
     */
    private String assembleSystemPrompt(UUID userId, LocalDate today, String memoriesBlock, String graphBlock) {
        return SYSTEM_PROMPT
                + contextSnapshotAssembler.render(userId, today)
                + knowledgeFactService.renderPromptBlock(userId)
                + knowledgeFactService.renderNewPatternFactsBlock(userId)
                + profileBlock(userId)
                + memoriesBlock
                + graphBlock
                + TONE_REMINDER;
    }
```

(The signature is unchanged — `profileBlock(userId)` is fetched inside, exactly like the fact blocks. Both call sites, `prepareTurn` and `sendMessage`, therefore need no edit.)

4. Add the import for `ProfilePromptAssembler`.

- [ ] **Step 5: Add the wiring test**

Append to `ProfilePromptAssemblerIT`:

```java
    @Test
    void the_chat_prompt_carries_the_block_after_the_fact_blocks() {
        seedProfile("A rövid reggeli üzenet válik be nálad.");

        String prompt = chatService.assembleSystemPromptForTest(user.getId(), java.time.LocalDate.now(), "", "");

        assertThat(prompt).contains(ProfilePromptAssembler.PROFILE_HEADER);
    }
```

If `assembleSystemPrompt` is private and no test seam exists, do NOT add one — instead pin the order by asserting on a real turn, copying the approach of the existing `ChatServiceGraphBlockSwitchOffIT` / the IT that already asserts on an assembled prompt (find it with `grep -rn "CONNECTIONS_HEADER" backend/src/test`), and assert:

```java
        assertThat(prompt.indexOf(ProfilePromptAssembler.PROFILE_HEADER))
                .isGreaterThan(prompt.indexOf("[Tények]"))
                .isLessThan(prompt.indexOf(PromptMemoryAssembler.MEMORIES_HEADER));
```

using whatever header constants those classes actually expose (verify by reading them; do not invent constant names).

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd backend && ./mvnw test -Dtest='ProfilePromptAssemblerIT,ChatServiceGraphBlockSwitchOffIT'
```

Expected: PASS.

- [ ] **Step 7: Run the full focused backend gate for this slice**

```bash
cd backend && ./mvnw clean test -Dtest='Profile*IT,ChatService*IT,Graph*IT,FeedbackLearning*IT,ArchitectureTest'
```

Expected: PASS — `ArchitectureTest` is in the list on purpose (new subpackage, new cross-package reads).

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/test/java/io/mrkuhne/mezo/feature/companion/profile
git commit -m "feat(companion): W4.3 [Rólad tanultam] prompt injection (mezo-b3pp.17)"
```

---

### Task 6: Tudástár — the profile card, read-only with an archive lever

**Files:**
- Modify: `frontend/src/data/types.ts`
- Modify: `frontend/src/data/insights/graphApi.ts`
- Modify: `frontend/src/data/insights/graph.ts`
- Create: `frontend/src/features/me/components/ProfileNodeCard.tsx`
- Create: `frontend/src/features/me/components/ProfileNodeCard.test.tsx`
- Modify: `frontend/src/features/me/pages/KnowledgePage.tsx`
- Modify: `frontend/src/features/me/pages/KnowledgePage.test.tsx`

**Interfaces:**
- Consumes: the unchanged `GET /api/companion/graph/node` + `POST /api/companion/graph/node/{id}/archive` contract; `GraphNodeResponse.sourceKind` (already generated in `data/_client/api.gen.ts` — verify with `grep -n "sourceKind" frontend/src/data/_client/api.gen.ts` before starting; if it is missing, run `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api` and commit the regenerated files).
- Produces: `KnowledgeGraphNode.sourceKind: string | null`; `PROFILE_SOURCE_KIND = 'profile'` exported from `data/insights/graph.ts`; `<ProfileNodeCard node onArchive />`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/features/me/components/ProfileNodeCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProfileNodeCard } from './ProfileNodeCard'

const node = {
  id: 'gn-profile',
  kind: 'INSIGHT' as const,
  title: 'Rólad tanultam',
  summary: 'A rövid, konkrét reggeli üzenet válik be nálad.',
  sourceKind: 'profile',
  topEdges: [],
}

describe('ProfileNodeCard', () => {
  it('shows the learned prose read-only', () => {
    render(<ProfileNodeCard node={node} onArchive={() => {}} />)

    expect(screen.getByText(/A rövid, konkrét reggeli üzenet/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('archives on demand and says what archiving does', async () => {
    const onArchive = vi.fn()
    render(<ProfileNodeCard node={node} onArchive={onArchive} />)

    await userEvent.click(screen.getByRole('button', { name: 'Archivál' }))

    expect(onArchive).toHaveBeenCalledOnce()
    expect(screen.getByText(/következő heti/i)).toBeInTheDocument()
  })
})
```

Append to `frontend/src/features/me/pages/KnowledgePage.test.tsx` (match the file's existing render helper and imports):

```tsx
  it('lifts the profile node out of the Kapcsolatok groups into its own section', async () => {
    renderKnowledgePage()

    expect(await screen.findByText('Rólad tanultam')).toBeInTheDocument()
    // exactly once: it must not ALSO appear under the "Belátások" group
    expect(screen.getAllByText('Rólad tanultam')).toHaveLength(1)
  })
```

- [ ] **Step 2: Run them to verify they fail**

```bash
cd frontend && pnpm test -- ProfileNodeCard KnowledgePage
```

Expected: FAIL — `ProfileNodeCard` does not exist; the seed has no profile node.

- [ ] **Step 3: Carry `sourceKind` through the data layer**

`data/types.ts` — add to `KnowledgeGraphNode`:

```ts
  /** W4.3 (mezo-b3pp.17): `'profile'` marks the singleton pragmatic-profile node, which the
   *  Tudástár renders in its own section instead of the kind groups. */
  sourceKind: string | null
```

`data/insights/graphApi.ts` — in `toKnowledgeGraphNode`, add `sourceKind: n.sourceKind ?? null,`.

`data/insights/graph.ts` — add the constant and the seed entry:

```ts
/** W4.3 (mezo-b3pp.17): the singleton profile node's `source_kind` (backend
 *  `ProfileAssembler.SOURCE_PROFILE`) — the Tudástár splits it out of the kind groups by this. */
export const PROFILE_SOURCE_KIND = 'profile'
```

Add `sourceKind: null` to each of the four existing `graphNodeSeed` entries, and append:

```ts
  {
    id: 'gn-profile',
    kind: 'INSIGHT',
    title: 'Rólad tanultam',
    summary:
      'A rövid, konkrét reggeli üzenet válik be nálad; a hosszabb elemzést délben olvasod el, '
      + 'a bőséges tipplistát pedig rendre elutasítod.',
    sourceKind: PROFILE_SOURCE_KIND,
    topEdges: [],
  },
```

- [ ] **Step 4: Create the card**

`frontend/src/features/me/components/ProfileNodeCard.tsx`:

```tsx
import type { KnowledgeGraphNode } from '@/data/types'

/** W4.3 (mezo-b3pp.17): the pragmatic profile — what the companion has learned about HOW to talk
 *  to Daniel, shown read-only. Archiving is the explicit "felejtsd el, amit rólam gondolsz" lever:
 *  the `[Rólad tanultam]` prompt block empties until the next weekly run rebuilds it. */
export function ProfileNodeCard({ node, onArchive }: {
  node: KnowledgeGraphNode
  onArchive: () => void
}) {
  return (
    <div
      data-profile-node-card
      style={{
        background: 'var(--surface)',
        borderRadius: 16,
        boxShadow: 'var(--np-shadow-row)',
        padding: 14,
      }}
    >
      <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
          {node.title}
        </span>
        <button
          type="button"
          className="chip"
          onClick={onArchive}
          style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}
        >
          Archivál
        </button>
      </div>
      {node.summary && (
        <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.6, margin: '8px 0 0' }}>
          {node.summary}
        </p>
      )}
      <p className="text-tertiary" style={{ fontSize: 10, lineHeight: 1.5, margin: '8px 0 0' }}>
        Archiválás után a következő heti összegzésig nem kerül a beszélgetésbe.
      </p>
    </div>
  )
}
```

- [ ] **Step 5: Split the profile out on the page**

In `KnowledgePage.tsx`: import `PROFILE_SOURCE_KIND` and `ProfileNodeCard`, then derive

```tsx
  const profileNode = nodes.find(n => n.sourceKind === PROFILE_SOURCE_KIND) ?? null
  const graphNodes = nodes.filter(n => n.sourceKind !== PROFILE_SOURCE_KIND)
```

Render a new section immediately **above** the "Kapcsolatok" block:

```tsx
      {/* Pragmatic profile (W4.3, mezo-b3pp.17) */}
      {profileNode && (
        <div style={{ padding: '0 24px 32px' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <Eyebrow>Rólad tanultam</Eyebrow>
          </div>
          <ProfileNodeCard node={profileNode} onArchive={() => archive(profileNode.id)} />
        </div>
      )}
```

and change the Kapcsolatok block to use `graphNodes` in all three places it currently uses `nodes` (the `nodes.length > 0` guard, the count chip, and `nodes.filter(...)` inside the group map).

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd frontend && pnpm test -- ProfileNodeCard KnowledgePage
```

Expected: PASS.

- [ ] **Step 7: Run both modes plus the build**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Expected: all green. If the KnowledgePage visual golden legitimately moved, run `pnpm test:visual:update` and include the updated snapshots in the commit.

- [ ] **Step 8: Commit**

```bash
git add frontend/src
git commit -m "feat(me): W4.3 Tudástár profile card + archive lever (mezo-b3pp.17)"
```

---

### Task 7: Docs, codemap, doc-lint

**Files:**
- Modify: `docs/features/companion.md`
- Modify: `docs/features/me.md`
- Modify: `docs/CODEMAP.md` (generated — never hand-edited)

- [ ] **Step 1: Document the slice in `companion.md`**

Add a `### W4.3 pragmatic profile node + injection (✅ `mezo-b3pp.17`)` section after the W3.2 consolidation section, covering: the singleton node's identity (`INSIGHT` / `source_kind='profile'` / `source_id=userId` and WHY the user id is load-bearing for the partial unique index); the weekly Monday 03:45 job and why it runs last in the dawn window; the inputs (11 rollup scopes, style histogram, ≤10 reviewed decisions, ≤12 active PATTERN/PREFERENCE titles) **including the RECOVERY-node spec interpretation recorded above**; honest absence (no signal ⇒ no LLM call, no node, existing profile untouched); the `[Rólad tanultam]` block's position in the canonical prompt order and its ≤400-token cap applied at both store and render time; archive semantics (empties the block, next weekly run revives the same row). Update the canonical prompt-order line in §3 and the config-keys table with the four `mezo.companion.profile.*` keys + the `profile-assembler-job` switch. Add the new ITs to §8 and the new files to §10.

- [ ] **Step 2: Document the surface in `me.md`**

Update the `Tudás` (`pages/KnowledgePage.tsx`) section: the page now renders a "Rólad tanultam" section above "Kapcsolatok", read-only, with the archive lever, fed by the same `useKnowledgeGraphNodes` hook and split by `sourceKind === 'profile'`; note the mock seed carries a profile node so both modes show the surface.

- [ ] **Step 3: Regenerate the codemap and lint the docs**

```bash
node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs
```

Expected: the codemap picks up the new `profile` subpackage; `lint-docs` reports **no new staleness** and no broken links. Fix anything it flags before committing.

- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs(companion): W4.3 pragmatic profile node + injection (mezo-b3pp.17)"
```

---

## Ship checklist (after Task 7)

- [ ] `cd backend && ./mvnw clean test -Dtest='Profile*IT,ChatService*IT,Graph*IT,Feedback*IT,ArchitectureTest'` green (docker compose up first).
- [ ] `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` green.
- [ ] `node scripts/lint-docs.mjs` — no new staleness.
- [ ] `git push -u origin feat/w4-3-pragmatic-profile` → `gh pr create` (self-PR = CI gate) → `gh pr checks <PR#> --watch` green.
- [ ] Local `--no-ff` merge into main from the primary repo, push, `bd close mezo-b3pp.17 && bd dolt push`, delete the branch locally + on the remote.
