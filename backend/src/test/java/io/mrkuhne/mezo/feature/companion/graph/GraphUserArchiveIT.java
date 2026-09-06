package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
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
    @Autowired private GraphPopulator graphPopulator;

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

    private UUID createActivePerson(UUID owner, String name) {
        return personPopulator.createPerson(owner, name).getId();
    }

    private void archivePerson(UUID personId) {
        PersonEntity person = personRepository.findById(personId).orElseThrow();
        person.setStatus("archived");
        personRepository.saveAndFlush(person);
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

    @Test
    void restore_shouldReturnAnActiveNode_whenTheSourceIsStillActive() {
        UUID userId = ownerId();
        UUID personId = createActivePerson(userId, "Anna");
        GraphNodeEntity node = promotionService.syncPerson(userId, personId).orElseThrow();
        graphService.archive(userId, node.getId());

        GraphNodeEntity restored = graphService.restore(userId, node.getId());

        assertThat(restored.getUserArchivedAt()).isNull();
        assertThat(restored.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);

        GraphNodeEntity reread = nodeRepository.findById(node.getId()).orElseThrow();
        assertThat(reread.getUserArchivedAt()).isNull();
        assertThat(reread.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
    }

    /** D5: a visszaállítás a FORRÁSBÓL származtat, nem vakon aktivál — különben a felhasználó
     *  „visszaállítottam, másnap eltűnt" élményt kapna a hajnali reconcile után. Emellett a
     *  re-derive-nek ténylegesen le is kell futnia: a címet is frissítenie kell a forrásból,
     *  különben egy semmit sem tevő resyncNode is zöldre futtatná ezt a tesztet. */
    @Test
    void restore_shouldStayArchived_whenTheSourceWentInactiveMeanwhile() {
        UUID userId = ownerId();
        UUID personId = createActivePerson(userId, "Anna");
        GraphNodeEntity node = promotionService.syncPerson(userId, personId).orElseThrow();
        graphService.archive(userId, node.getId());
        archivePerson(personId);

        PersonEntity person = personRepository.findById(personId).orElseThrow();
        person.setName("Anna Kovács");
        personRepository.saveAndFlush(person);

        GraphNodeEntity restored = graphService.restore(userId, node.getId());

        assertThat(restored.getUserArchivedAt()).isNull();
        assertThat(restored.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
        assertThat(restored.getTitle()).isEqualTo("Anna Kovács");

        GraphNodeEntity reread = nodeRepository.findById(node.getId()).orElseThrow();
        assertThat(reread.getUserArchivedAt()).isNull();
        assertThat(reread.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
        assertThat(reread.getTitle()).isEqualTo("Anna Kovács");
    }

    @Test
    void restore_shouldActivate_whenTheNodeHasNoSourceRow() {
        UUID userId = ownerId();
        GraphNodeEntity node = graphService.upsertNode(userId, GraphNodeEntity.KIND_INSIGHT,
            "Kézi jegyzet", "Kézi jegyzet", null, null, null, Map.of());
        graphService.archive(userId, node.getId());

        assertThat(graphService.restore(userId, node.getId()).getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
    }

    /**
     * Code review finding (mezo-06o0.5, final whole-branch review): {@code restore} had no
     * precondition beyond ownership. A {@code candidate} node's id is public via {@code GET
     * /api/companion/graph/node/candidate}, and it carries {@code sourceId = null}, so {@code
     * resyncNode}'s source-less branch would raise it straight to {@code active} — promoting an
     * AI-proposed candidate while bypassing {@code LifeEventCandidateService.decide} entirely
     * (the already-decided gate, the refined title/summary, the {@code proposedEdges}
     * materialisation). The house principle: nothing the AI derives becomes durable without an
     * explicit user decision. {@code restore} is now rejected on any node the user did not
     * actually hand-archive.
     */
    @Test
    void restore_shouldReject_whenTheNodeIsAnUndecidedCandidate() {
        UUID userId = ownerId();
        GraphNodeEntity candidate = graphPopulator.createCandidateNode(userId, GraphNodeEntity.KIND_LIFE_EVENT,
            "Költözés", LocalDate.of(2026, 6, 1), Map.of());
        assertThat(candidate.isUserArchived()).isFalse();

        assertThatThrownBy(() -> graphService.restore(userId, candidate.getId()))
            .isInstanceOf(SystemRuntimeErrorException.class);

        GraphNodeEntity reread = nodeRepository.findById(candidate.getId()).orElseThrow();
        assertThat(reread.getStatus()).isEqualTo(GraphNodeEntity.STATUS_CANDIDATE);
        assertThat(reread.isUserArchived()).isFalse();
    }

    /** The mirror case: a node the SOURCE archived (via a promoter/retract path), never the
     *  user by hand — {@code userArchivedAt} stays null, so {@code restore} must reject it too,
     *  the same as the candidate case above. */
    @Test
    void restore_shouldReject_whenTheNodeWasMachineArchivedNotHandArchived() {
        UUID userId = ownerId();
        PersonEntity person = personPopulator.createPerson(userId, "Anna");
        GraphNodeEntity node = promotionService.syncPerson(userId, person.getId()).orElseThrow();
        archivePerson(person.getId());
        promotionService.syncPerson(userId, person.getId());
        GraphNodeEntity machineArchived = nodeRepository.findById(node.getId()).orElseThrow();
        assertThat(machineArchived.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
        assertThat(machineArchived.isUserArchived()).isFalse();

        assertThatThrownBy(() -> graphService.restore(userId, node.getId()))
            .isInstanceOf(SystemRuntimeErrorException.class);

        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
    }

    @Test
    void listUserArchived_shouldReturnOnlyTheHandArchivedNodes() {
        UUID userId = ownerId();
        UUID personId = createActivePerson(userId, "Anna");
        GraphNodeEntity byUser = promotionService.syncPerson(userId, personId).orElseThrow();
        graphService.archive(userId, byUser.getId());
        UUID otherPersonId = createActivePerson(userId, "Béla");
        GraphNodeEntity byMachine = promotionService.syncPerson(userId, otherPersonId).orElseThrow();
        archivePerson(otherPersonId);
        promotionService.syncPerson(userId, otherPersonId);

        assertThat(graphService.listUserArchived(userId))
            .extracting(GraphNodeEntity::getId)
            .containsExactly(byUser.getId());
    }
}
