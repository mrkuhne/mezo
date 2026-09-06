package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromotionService;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphService;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Coverage for the {@code user_archived_at} durable-intent marker (mezo-06o0.5): a hand-archived
 * node must record that the ARCHIVE was a user decision, not just flip {@code status}, so a later
 * promoter guard can tell "user archived this" apart from "nothing has promoted it yet".
 *
 * <p>The second half of this file (below {@link #archive_shouldStampTheUserIntentMarker}) pins
 * the promoter-side guard itself: the four {@code raiseStatus} call sites in {@code
 * GraphPromotionService} must not silently resurrect a node the user hand-archived in the
 * Tudástár. Fixtures are copied from {@link GraphRetractionIT}, which already builds all four
 * source shapes (pattern/fact/goal/person).
 */
@ActiveProfiles("companion-fake")
class GraphUserArchiveIT extends AbstractIntegrationTest {

    @Autowired private GraphService graphService;
    @Autowired private GraphPromotionService promotionService;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private GoalRepository goalRepository;
    @Autowired private PatternRepository patternRepository;
    @Autowired private PersonRepository personRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private PersonPopulator personPopulator;

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
    void archive_shouldStampTheUserIntentMarker() {
        UUID userId = ownerId();
        UUID goalId = UUID.randomUUID();

        GraphNodeEntity node = graphService.upsertNode(userId, GraphNodeEntity.KIND_GOAL,
            "Kockahas", "Kockahas", "goal", goalId, null, Map.of());
        assertThat(node.isUserArchived()).isFalse();

        GraphNodeEntity archived = graphService.archive(userId, node.getId());

        assertThat(archived.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
        assertThat(archived.getUserArchivedAt()).isNotNull();
        assertThat(archived.isUserArchived()).isTrue();
    }

    @Test
    void reconcile_shouldNotResurrect_whenTheUserArchivedAPersonNode() {
        UUID userId = ownerId();
        PersonEntity person = personPopulator.createPerson(userId, "Anna");
        GraphNodeEntity node = promotionService.syncPerson(userId, person.getId()).orElseThrow();
        assertThat(node.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
        graphService.archive(userId, node.getId());

        promotionService.reconcile(userId);

        GraphNodeEntity after = nodeRepository.findById(node.getId()).orElseThrow();
        assertThat(after.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
        assertThat(after.isUserArchived()).isTrue();
    }

    @Test
    void reconcile_shouldNotResurrect_whenTheUserArchivedAGoalNode() {
        UUID userId = ownerId();
        GoalEntity goal = goalPopulator.createGoal(userId, "active");
        GraphNodeEntity node = promotionService.syncGoal(userId, goal.getId()).orElseThrow();
        graphService.archive(userId, node.getId());

        promotionService.reconcile(userId);

        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
    }

    @Test
    void promotePattern_shouldNotRevive_whenTheUserArchivedTheNode() {
        UUID userId = ownerId();
        PatternEntity pattern = confirmedPattern(userId);
        GraphNodeEntity node = promotionService.promotePattern(userId, pattern.getId()).orElseThrow();
        graphService.archive(userId, node.getId());

        promotionService.promotePattern(userId, pattern.getId());

        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
    }

    @Test
    void promoteFact_shouldNotRevive_whenTheUserArchivedTheNode() {
        UUID userId = ownerId();
        KnowledgeFactEntity fact = manualFact(userId, "Nem eszem laktózt.");
        GraphNodeEntity node = promotionService.promoteFact(userId, fact.getId()).orElseThrow();
        graphService.archive(userId, node.getId());

        promotionService.promoteFact(userId, fact.getId());

        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
    }

    /** A guard CSAK a státuszt fogja: a gráf továbbra is naprakészen árnyékolja a forrást. */
    @Test
    void syncPerson_shouldStillRefreshTitle_whenTheUserArchivedTheNode() {
        UUID userId = ownerId();
        PersonEntity person = personPopulator.createPerson(userId, "Anna");
        GraphNodeEntity node = promotionService.syncPerson(userId, person.getId()).orElseThrow();
        graphService.archive(userId, node.getId());

        person.setName("Anna Kovács");
        personRepository.saveAndFlush(person);
        promotionService.syncPerson(userId, person.getId());

        GraphNodeEntity after = nodeRepository.findById(node.getId()).orElseThrow();
        assertThat(after.getTitle()).isEqualTo("Anna Kovács");
        assertThat(after.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
    }
}
