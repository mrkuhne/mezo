package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromotionService;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphReconcileResult;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphService;
import io.mrkuhne.mezo.feature.companion.graph.service.LifeEventExtractionService;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfileAssembler;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * W2.2 retraction (bd mezo-b3pp.31, spec §6.2): the mirror half of promotion — a pattern the user
 * un-confirms, a goal they delete, and a soft-deleted knowledge fact must stop asserting
 * themselves in the graph. Follows {@link GraphPromotionServiceIT}'s harness exactly: same base
 * class, same {@code @Autowired} set, same populators, same user setup, same assertion style
 * (re-read entities via {@code nodeRepository.findById}, never the returned instance alone).
 */
@ActiveProfiles("companion-fake")
class GraphRetractionIT extends AbstractIntegrationTest {

    @Autowired private GraphPromotionService promotionService;
    @Autowired private GraphService graphService;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private GoalRepository goalRepository;
    @Autowired private PatternRepository patternRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private GoalPopulator goalPopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private PatternEntity confirmedPattern(UUID owner) {
        PatternEntity p = patternPopulator.createPattern(owner, "sleep_vs_soreness", "Késői evés rontja az alvást.");
        p.setStatus(PatternEntity.STATUS_CONFIRMED);
        p.setR(new BigDecimal("-0.610"));
        p.setN(21);
        return patternPopulator.save(p);
    }

    private KnowledgeFactEntity manualFact(UUID owner, String text) {
        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setCreatedBy(owner);
        fact.setFactText(text);
        fact.setCategory("train");
        fact.setSource(KnowledgeFactEntity.SOURCE_CHAT);
        return knowledgeFactRepository.saveAndFlush(fact);
    }

    @Test
    void testRetractPattern_shouldArchiveTheNode_whenAConfirmedPatternIsRejected() {
        UUID owner = ownerId();
        PatternEntity pattern = confirmedPattern(owner);
        GraphNodeEntity node = promotionService.promotePattern(owner, pattern.getId()).orElseThrow();
        assertThat(node.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);

        pattern.setStatus(PatternEntity.STATUS_REJECTED);
        patternRepository.saveAndFlush(pattern);

        GraphNodeEntity archived = promotionService.retractPattern(owner, pattern.getId()).orElseThrow();

        assertThat(archived.getId()).isEqualTo(node.getId());
        GraphNodeEntity reread = nodeRepository.findById(node.getId()).orElseThrow();
        assertThat(reread.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
        assertThat(reread.isDeleted()).isFalse();
    }

    @Test
    void testRetractPattern_shouldArchiveTheNode_whenAConfirmedPatternDropsToMonitoring() {
        UUID owner = ownerId();
        PatternEntity pattern = confirmedPattern(owner);
        GraphNodeEntity node = promotionService.promotePattern(owner, pattern.getId()).orElseThrow();

        pattern.setStatus(PatternEntity.STATUS_MONITORING);
        patternRepository.saveAndFlush(pattern);

        GraphNodeEntity archived = promotionService.retractPattern(owner, pattern.getId()).orElseThrow();

        assertThat(archived.getId()).isEqualTo(node.getId());
        GraphNodeEntity reread = nodeRepository.findById(node.getId()).orElseThrow();
        assertThat(reread.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
        assertThat(reread.isDeleted()).isFalse();
    }

    @Test
    void testRetractPattern_shouldDoNothing_whenThePatternIsStillConfirmed() {
        UUID owner = ownerId();
        PatternEntity pattern = confirmedPattern(owner);
        GraphNodeEntity node = promotionService.promotePattern(owner, pattern.getId()).orElseThrow();

        assertThat(promotionService.retractPattern(owner, pattern.getId())).isEmpty();

        GraphNodeEntity reread = nodeRepository.findById(node.getId()).orElseThrow();
        assertThat(reread.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
    }

    @Test
    void testRetractPattern_shouldReturnEmpty_whenTheSourceWasNeverPromoted() {
        UUID owner = ownerId();
        PatternEntity pattern = confirmedPattern(owner);

        assertThat(promotionService.retractPattern(owner, pattern.getId())).isEmpty();
        assertThat(nodeRepository.findAll()).isEmpty();
    }

    @Test
    void testPromotePattern_shouldReviveTheNode_whenAnArchivedPatternIsReconfirmed() {
        UUID owner = ownerId();
        PatternEntity pattern = confirmedPattern(owner);
        GraphNodeEntity node = promotionService.promotePattern(owner, pattern.getId()).orElseThrow();

        pattern.setStatus(PatternEntity.STATUS_REJECTED);
        patternRepository.saveAndFlush(pattern);
        promotionService.retractPattern(owner, pattern.getId()).orElseThrow();
        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);

        pattern.setStatus(PatternEntity.STATUS_CONFIRMED);
        patternRepository.saveAndFlush(pattern);
        GraphNodeEntity revived = promotionService.promotePattern(owner, pattern.getId()).orElseThrow();

        assertThat(revived.getId()).isEqualTo(node.getId());
        GraphNodeEntity reread = nodeRepository.findById(node.getId()).orElseThrow();
        assertThat(reread.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
    }

    @Test
    void testRetractGoal_shouldArchiveTheNode_whenTheGoalIsSoftDeleted() {
        UUID owner = ownerId();
        GoalEntity goal = goalPopulator.createGoal(owner, "active");
        GraphNodeEntity node = promotionService.syncGoal(owner, goal.getId()).orElseThrow();
        assertThat(node.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);

        goalRepository.delete(goal);

        GraphNodeEntity archived = promotionService.retractGoal(owner, goal.getId()).orElseThrow();

        assertThat(archived.getId()).isEqualTo(node.getId());
        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
    }

    @Test
    void testPromoteFact_shouldReviveTheNode_whenAnArchivedFactIsRepromoted() {
        UUID owner = ownerId();
        KnowledgeFactEntity fact = manualFact(owner, "Reggel jobban bírom az erős edzést.");
        GraphNodeEntity node = promotionService.promoteFact(owner, fact.getId()).orElseThrow();
        assertThat(node.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);

        graphService.archive(owner, node.getId());
        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);

        GraphNodeEntity revived = promotionService.promoteFact(owner, fact.getId()).orElseThrow();

        assertThat(revived.getId()).isEqualTo(node.getId());
        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
    }

    @Test
    void testReconcile_shouldArchive_whenAPatternWasUnconfirmedWithoutAnEvent() {
        UUID owner = ownerId();
        PatternEntity pattern = confirmedPattern(owner);
        GraphNodeEntity node = promotionService.promotePattern(owner, pattern.getId()).orElseThrow();

        pattern.setStatus(PatternEntity.STATUS_REJECTED);
        patternRepository.saveAndFlush(pattern);

        GraphReconcileResult result = promotionService.reconcile(owner);

        assertThat(result.retracted()).isEqualTo(1);
        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
    }

    @Test
    void testReconcile_shouldArchive_whenAGoalWasSoftDeletedWithoutAnEvent() {
        UUID owner = ownerId();
        GoalEntity goal = goalPopulator.createGoal(owner, "active");
        GraphNodeEntity node = promotionService.syncGoal(owner, goal.getId()).orElseThrow();

        goalRepository.delete(goal);

        GraphReconcileResult result = promotionService.reconcile(owner);

        assertThat(result.retracted()).isEqualTo(1);
        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
    }

    @Test
    void testReconcile_shouldArchive_whenAKnowledgeFactWasSoftDeleted() {
        UUID owner = ownerId();
        KnowledgeFactEntity fact = manualFact(owner, "Egy tény, amit majd törlünk.");
        GraphNodeEntity node = promotionService.promoteFact(owner, fact.getId()).orElseThrow();

        knowledgeFactRepository.delete(fact);

        GraphReconcileResult result = promotionService.reconcile(owner);

        assertThat(result.retracted()).isEqualTo(1);
        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
    }

    @Test
    void testReconcile_shouldLeaveQualifyingNodesAlone_whenNothingWasRetracted() {
        UUID owner = ownerId();
        PatternEntity pattern = confirmedPattern(owner);
        GraphNodeEntity patternNode = promotionService.promotePattern(owner, pattern.getId()).orElseThrow();
        KnowledgeFactEntity fact = manualFact(owner, "Egy tény, ami megmarad.");
        GraphNodeEntity factNode = promotionService.promoteFact(owner, fact.getId()).orElseThrow();
        GoalEntity goal = goalPopulator.createGoal(owner, "active");
        GraphNodeEntity goalNode = promotionService.syncGoal(owner, goal.getId()).orElseThrow();

        GraphReconcileResult result = promotionService.reconcile(owner);

        assertThat(result.retracted()).isEqualTo(0);
        assertThat(nodeRepository.findById(patternNode.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
        assertThat(nodeRepository.findById(factNode.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
        assertThat(nodeRepository.findById(goalNode.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
    }

    @Test
    void testReconcile_shouldBeStable_whenRunTwice() {
        UUID owner = ownerId();
        PatternEntity pattern = confirmedPattern(owner);
        GraphNodeEntity node = promotionService.promotePattern(owner, pattern.getId()).orElseThrow();
        pattern.setStatus(PatternEntity.STATUS_REJECTED);
        patternRepository.saveAndFlush(pattern);

        GraphReconcileResult first = promotionService.reconcile(owner);
        assertThat(first.retracted()).isEqualTo(1);

        GraphReconcileResult second = promotionService.reconcile(owner);

        assertThat(second.retracted()).isEqualTo(0);
        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
    }

    @Test
    void testReconcile_shouldIgnoreForeignNodes_whenAnotherUserOwnsThem() {
        UUID owner = ownerId();
        UUID stranger = databasePopulator.populateUser("stranger-" + UUID.randomUUID() + "@example.com");
        PatternEntity strangerPattern = patternPopulator.createPattern(
            stranger, "stranger_pair", "Idegen felhasználó mintája.");
        strangerPattern.setStatus(PatternEntity.STATUS_CONFIRMED);
        strangerPattern.setR(new BigDecimal("-0.500"));
        strangerPattern.setN(10);
        strangerPattern = patternPopulator.save(strangerPattern);
        GraphNodeEntity strangerNode = promotionService.promotePattern(stranger, strangerPattern.getId()).orElseThrow();
        strangerPattern.setStatus(PatternEntity.STATUS_REJECTED);
        patternRepository.saveAndFlush(strangerPattern);

        GraphReconcileResult result = promotionService.reconcile(owner);

        assertThat(result.retracted()).isEqualTo(0);
        assertThat(nodeRepository.findById(strangerNode.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
    }

    /**
     * Pins the sweep's "don't archive what I don't own" guard (final review, Finding 3). The
     * complement sweep in {@code GraphPromotionService.reconcile} skips {@code sourceId == null}
     * nodes outright — that structurally covers extractor/quarterly candidates, since
     * {@code GraphService.createCandidate} never sets a {@code sourceId}. The W4.3 profile node is
     * different: {@code ProfileAssembler} gives it {@code sourceKind="profile"} with a NON-null
     * {@code sourceId} (the owner's user id), so it is protected only by the sweep's {@code
     * switch}'s {@code default -> false} arm. If that default arm is ever turned into a lookup,
     * this test is what would catch the sweep silently archiving the singleton profile node.
     *
     * <p>The extractor half is seeded as an {@code ACTIVE} node with a null {@code sourceId}
     * rather than through {@code GraphService.createCandidate}: a real extractor node is {@code
     * status='candidate'}, which {@code listActive} never even offers to the sweep in the first
     * place, so seeding one there would make that half of this test vacuous. Seeding it
     * {@code active} instead still exercises the {@code sourceId == null} skip the sweep actually
     * relies on for that source kind.
     */
    @Test
    void testReconcile_shouldLeaveForeignSourceKindsAlone_whenProfileAndCandidateNodesExist() {
        UUID owner = ownerId();
        GraphNodeEntity profileNode = graphService.upsertNode(owner, GraphNodeEntity.KIND_INSIGHT,
            ProfileAssembler.PROFILE_TITLE, "Amit eddig tanultam róla.",
            ProfileAssembler.SOURCE_PROFILE, owner, null, Map.of());
        assertThat(profileNode.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
        GraphNodeEntity extractorLikeNode = graphService.upsertNode(owner, GraphNodeEntity.KIND_LIFE_EVENT,
            "Egy nap eseménye", "Egy nap eseménye, kivonatolva.",
            LifeEventExtractionService.SOURCE_EXTRACTOR, null, null, Map.of());
        assertThat(extractorLikeNode.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);

        GraphReconcileResult result = promotionService.reconcile(owner);

        assertThat(result.retracted()).isEqualTo(0);
        assertThat(nodeRepository.findById(profileNode.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
        assertThat(nodeRepository.findById(extractorLikeNode.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
    }
}
