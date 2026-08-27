package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromotionService;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphReconcileResult;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphService;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * bd mezo-b3pp.30: {@code knowledge_fact.include_in_prompt = false} is the user's explicit
 * opt-out of every prompt-injection channel — the V1.1 facts block, the V3.3 acknowledgment
 * block, and (this slice) the graph. An opted-out fact must never become, or stay, an active
 * node that {@code GraphPromptAssembler} can render into the {@code [Összefüggések]} block of
 * the SAME system prompt. Follows {@link GraphRetractionIT}'s harness exactly: same base class,
 * same {@code @Autowired} set, same populator, same user setup, same assertion style (re-read
 * entities via {@code nodeRepository.findById}, never the returned instance alone).
 */
@ActiveProfiles("companion-fake")
class GraphFactOptOutIT extends AbstractIntegrationTest {

    @Autowired private GraphPromotionService promotionService;
    @Autowired private GraphService graphService;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DatabasePopulator databasePopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private KnowledgeFactEntity manualFact(UUID owner, String text, boolean includeInPrompt) {
        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setCreatedBy(owner);
        fact.setFactText(text);
        fact.setCategory("train");
        fact.setSource(KnowledgeFactEntity.SOURCE_CHAT);
        fact.setIncludeInPrompt(includeInPrompt);
        return knowledgeFactRepository.saveAndFlush(fact);
    }

    @Test
    void testPromoteFact_shouldCreateNoNode_whenTheFactIsOptedOutOfThePrompt() {
        UUID owner = ownerId();
        KnowledgeFactEntity fact = manualFact(owner, "Nem szabad promptba kerülnie.", false);

        assertThat(promotionService.promoteFact(owner, fact.getId())).isEmpty();

        assertThat(graphService.findBySource(owner, GraphPromotionService.SOURCE_FACT, fact.getId())).isEmpty();
    }

    @Test
    void testPromoteFact_shouldStillPromote_whenTheFactIsPromptIncluded() {
        UUID owner = ownerId();
        KnowledgeFactEntity fact = manualFact(owner, "Ez bekerülhet a promptba.", true);

        GraphNodeEntity node = promotionService.promoteFact(owner, fact.getId()).orElseThrow();

        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
    }

    @Test
    void testSyncFact_shouldArchiveTheNode_whenAPromotedFactIsOptedOut() {
        UUID owner = ownerId();
        KnowledgeFactEntity fact = manualFact(owner, "Előbb bekerül, aztán kikapcsolják.", true);
        GraphNodeEntity node = promotionService.promoteFact(owner, fact.getId()).orElseThrow();
        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ACTIVE);

        fact.setIncludeInPrompt(false);
        knowledgeFactRepository.saveAndFlush(fact);

        GraphNodeEntity archived = promotionService.syncFact(owner, fact.getId()).orElseThrow();

        assertThat(archived.getId()).isEqualTo(node.getId());
        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
    }

    @Test
    void testSyncFact_shouldReviveTheNode_whenAnOptedOutFactIsOptedBackIn() {
        UUID owner = ownerId();
        KnowledgeFactEntity fact = manualFact(owner, "Ki-be kapcsolják néhányszor.", true);
        GraphNodeEntity node = promotionService.promoteFact(owner, fact.getId()).orElseThrow();

        fact.setIncludeInPrompt(false);
        knowledgeFactRepository.saveAndFlush(fact);
        promotionService.syncFact(owner, fact.getId()).orElseThrow();
        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);

        fact.setIncludeInPrompt(true);
        knowledgeFactRepository.saveAndFlush(fact);
        GraphNodeEntity revived = promotionService.syncFact(owner, fact.getId()).orElseThrow();

        assertThat(revived.getId()).isEqualTo(node.getId());
        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
        assertThat(nodeRepository.findAll().stream()
            .filter(n -> fact.getId().equals(n.getSourceId()))
            .count()).isEqualTo(1);
    }

    @Test
    void testSyncFact_shouldDoNothing_whenTheFactWasNeverPromoted() {
        UUID owner = ownerId();
        KnowledgeFactEntity fact = manualFact(owner, "Soha nem is lett promotálva.", false);

        assertThat(promotionService.syncFact(owner, fact.getId())).isEmpty();
        assertThat(nodeRepository.findAll()).isEmpty();
    }

    @Test
    void testRetractFact_shouldArchiveTheNode_whenTheFactIsOptedOut() {
        UUID owner = ownerId();
        KnowledgeFactEntity fact = manualFact(owner, "Előbb bekerül, aztán retract-elik.", true);
        GraphNodeEntity node = promotionService.promoteFact(owner, fact.getId()).orElseThrow();

        fact.setIncludeInPrompt(false);
        knowledgeFactRepository.saveAndFlush(fact);

        GraphNodeEntity archived = promotionService.retractFact(owner, fact.getId()).orElseThrow();

        assertThat(archived.getId()).isEqualTo(node.getId());
        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
    }

    @Test
    void testReconcile_shouldArchive_whenAPromotedFactWasOptedOutWithoutAnEvent() {
        UUID owner = ownerId();
        KnowledgeFactEntity fact = manualFact(owner, "A switch ki volt kapcsolva, amikor kikapcsolták.", true);
        GraphNodeEntity node = promotionService.promoteFact(owner, fact.getId()).orElseThrow();

        fact.setIncludeInPrompt(false);
        knowledgeFactRepository.saveAndFlush(fact);

        GraphReconcileResult result = promotionService.reconcile(owner);

        assertThat(result.retracted()).isEqualTo(1);
        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
    }

    /**
     * THE REGRESSION THIS SLICE EXISTS FOR: before this fix, {@code reconcile}'s promotion loop
     * re-upserted the opted-out fact's node and forced it back to {@code active} every run — a
     * manual archive from the Tudástár UI was undone by dawn.
     */
    @Test
    void testReconcile_shouldNotResurrect_whenAnOptedOutFactsNodeWasArchived() {
        UUID owner = ownerId();
        KnowledgeFactEntity fact = manualFact(owner, "Kikapcsolva és archiválva, ne éledjen fel.", true);
        GraphNodeEntity node = promotionService.promoteFact(owner, fact.getId()).orElseThrow();

        fact.setIncludeInPrompt(false);
        knowledgeFactRepository.saveAndFlush(fact);
        graphService.archive(owner, node.getId());
        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);

        GraphReconcileResult first = promotionService.reconcile(owner);
        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
        assertThat(first.upserted()).isEqualTo(0);

        GraphReconcileResult second = promotionService.reconcile(owner);
        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
        assertThat(second.upserted()).isEqualTo(0);
    }

    @Test
    void testReconcile_shouldLeavePromptIncludedFactsAlone_whenNothingWasOptedOut() {
        UUID owner = ownerId();
        KnowledgeFactEntity fact = manualFact(owner, "Ez marad, semmi sem kapcsolta ki.", true);
        GraphNodeEntity node = promotionService.promoteFact(owner, fact.getId()).orElseThrow();

        GraphReconcileResult result = promotionService.reconcile(owner);

        assertThat(result.retracted()).isEqualTo(0);
        assertThat(result.upserted()).isGreaterThanOrEqualTo(1);
        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
    }
}
