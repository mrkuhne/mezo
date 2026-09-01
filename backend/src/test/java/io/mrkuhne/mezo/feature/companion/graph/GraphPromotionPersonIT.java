package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromotionService;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphReconcileResult;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphService;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Emberek S5 gráf-tükör, Task 2 (bd mezo-06o0.4): active PERSON rows become PERSON nodes exactly
 * once, keyed by (createdBy, sourceKind, sourceId) — the {@code syncGoal}/{@code retractGoal}
 * shape, mirrored onto {@code person}. {@code companion-fake} matches {@code
 * GraphPromotionServiceIT}: no PERSON promotion runs the edge structurer today, but the profile
 * stays consistent with the rest of the graph slice's ITs.
 */
@ActiveProfiles("companion-fake")
class GraphPromotionPersonIT extends AbstractIntegrationTest {

    @Autowired private GraphPromotionService promotionService;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private GraphService graphService;
    @Autowired private PersonRepository personRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private PersonPopulator personPopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void syncPerson_shouldUpsertActiveNode_forActivePerson() {
        UUID userId = ownerId();
        PersonEntity person = personPopulator.createPerson(userId, "Petra");

        Optional<GraphNodeEntity> node = promotionService.syncPerson(userId, person.getId());

        assertThat(node).isPresent();
        assertThat(node.get().getKind()).isEqualTo(GraphNodeEntity.KIND_PERSON);
        assertThat(node.get().getTitle()).isEqualTo("Petra");
        assertThat(node.get().getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
        assertThat(node.get().getSourceKind()).isEqualTo(GraphPromotionService.SOURCE_PERSON);
        assertThat(node.get().getSourceId()).isEqualTo(person.getId());
    }

    @Test
    void syncPerson_shouldNotPromote_forCandidate() {
        UUID userId = ownerId();
        PersonEntity candidate = personPopulator.createCandidate(userId, "Marci", "idézet");

        assertThat(promotionService.syncPerson(userId, candidate.getId())).isEmpty();
        assertThat(nodeRepository.findAll()).isEmpty();
    }

    @Test
    void syncPerson_shouldBeIdempotent_andRevive() {
        UUID userId = ownerId();
        PersonEntity person = personPopulator.createPerson(userId, "Petra");

        UUID first = promotionService.syncPerson(userId, person.getId()).orElseThrow().getId();
        promotionService.retractPerson(userId, person.getId());   // nem archivál: még aktív
        UUID second = promotionService.syncPerson(userId, person.getId()).orElseThrow().getId();

        assertThat(second).isEqualTo(first);   // ugyanaz a node, sosem duplikál
        assertThat(nodeRepository.findAll()).hasSize(1);
    }

    @Test
    void retractPerson_shouldArchiveNode_afterSoftDelete() {
        UUID userId = ownerId();
        PersonEntity person = personPopulator.createPerson(userId, "Petra");
        promotionService.syncPerson(userId, person.getId());
        personRepository.delete(person);   // @SQLDelete → soft

        Optional<GraphNodeEntity> archived = promotionService.retractPerson(userId, person.getId());

        assertThat(archived).isPresent();
        assertThat(archived.get().getStatus()).isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
    }

    @Test
    void retractPerson_shouldBeNoOp_whilePersonStillActive() {
        UUID userId = ownerId();
        PersonEntity person = personPopulator.createPerson(userId, "Petra");
        promotionService.syncPerson(userId, person.getId());

        assertThat(promotionService.retractPerson(userId, person.getId())).isEmpty();
    }

    @Test
    void reconcile_shouldSweepPersons_bothWays() {
        UUID userId = ownerId();
        PersonEntity live = personPopulator.createPerson(userId, "Petra");
        PersonEntity gone = personPopulator.createPerson(userId, "Bence");
        promotionService.syncPerson(userId, gone.getId());
        personRepository.delete(gone);

        GraphReconcileResult result = promotionService.reconcile(userId);

        assertThat(result.upserted()).isGreaterThanOrEqualTo(1);   // `live` felkerült
        assertThat(result.retracted()).isGreaterThanOrEqualTo(1);  // `gone` node-ja archiválva
        assertThat(graphService.findBySource(userId, GraphPromotionService.SOURCE_PERSON, live.getId()))
            .isPresent();
    }
}
