package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromotionService;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * S6 final review Important 6: a pattern-sourced fact has no graph node of its own — its claim
 * lives in the source pattern's PATTERN node, which GraphPromptAssembler renders into the chat.
 * So muting the fact (user toggle, refute, drift supersession) must archive that node, re-enabling
 * must revive it, and the nightly reconcile must not undo either; a forgotten row never promotes.
 */
@ActiveProfiles("companion-fake")
class GraphPatternFactMuteIT extends AbstractIntegrationTest {

    @Autowired private GraphPromotionService promotionService;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private KnowledgeFactRepository facts;
    @Autowired private KnowledgeFactPopulator factPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;

    private record Promoted(UUID owner, PatternEntity pattern, KnowledgeFactEntity fact) {}

    private Promoted promoted() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_CONFIRMED);
        KnowledgeFactEntity fact = factPopulator.fact(owner, row.getTitle(), "health", 0, true,
                KnowledgeFactEntity.SOURCE_PATTERN);
        row.setPromotedFactId(fact.getId());
        return new Promoted(owner, patternPopulator.save(row), fact);
    }

    private String nodeStatus(UUID nodeId) {
        return nodeRepository.findById(nodeId).orElseThrow().getStatus();
    }

    @Test
    void mutingThePromotedFact_shouldArchiveThePatternNode_andReEnableRevivesIt() {
        Promoted p = promoted();
        GraphNodeEntity node = promotionService.promotePattern(p.owner(), p.pattern().getId()).orElseThrow();
        assertThat(nodeStatus(node.getId())).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);

        KnowledgeFactEntity fact = facts.findById(p.fact().getId()).orElseThrow();
        fact.mute(KnowledgeFactEntity.MUTED_SUPERSEDED, Instant.now());
        facts.saveAndFlush(fact);
        promotionService.syncFact(p.owner(), fact.getId());
        assertThat(nodeStatus(node.getId())).isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);

        // the nightly sweep must not revive it while the fact is muted
        promotionService.reconcile(p.owner());
        assertThat(nodeStatus(node.getId())).isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);

        fact = facts.findById(p.fact().getId()).orElseThrow();
        fact.unmute();
        facts.saveAndFlush(fact);
        promotionService.syncFact(p.owner(), fact.getId());
        assertThat(nodeStatus(node.getId())).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
    }

    @Test
    void reconcile_shouldArchiveAnActivePatternNode_whoseFactWasMutedWhileTheListenerMissedIt() {
        Promoted p = promoted();
        GraphNodeEntity node = promotionService.promotePattern(p.owner(), p.pattern().getId()).orElseThrow();
        KnowledgeFactEntity fact = facts.findById(p.fact().getId()).orElseThrow();
        fact.mute(KnowledgeFactEntity.MUTED_USER, Instant.now());
        facts.saveAndFlush(fact);

        promotionService.reconcile(p.owner());

        assertThat(nodeStatus(node.getId())).isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
    }

    @Test
    void promotePattern_shouldSkip_whenTheFactIsDeleted_orTheRowIsForgotten() {
        Promoted deletedFact = promoted();
        facts.deleteById(deletedFact.fact().getId()); // soft delete
        assertThat(promotionService.promotePattern(deletedFact.owner(), deletedFact.pattern().getId())).isEmpty();

        UUID owner = userPopulator.createUser().getId();
        PatternEntity forgotten = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_FORGOTTEN);
        assertThat(promotionService.promotePattern(owner, forgotten.getId())).isEmpty();
    }

    @Test
    void promotePattern_shouldStillPromote_aConfirmedRowWithoutAFact() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_CONFIRMED);
        assertThat(promotionService.promotePattern(owner, row.getId())).isPresent();
    }
}
