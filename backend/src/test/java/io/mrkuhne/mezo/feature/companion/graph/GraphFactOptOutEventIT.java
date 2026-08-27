package io.mrkuhne.mezo.feature.companion.graph;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.KnowledgeFactResponse;
import io.mrkuhne.mezo.api.dto.UpdateFactRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * bd mezo-b3pp.30, Task 2: the fact CRUD PATCH is the fourth write-path surface — like
 * {@link GraphPromotionEventIT}'s three, it ends in an AFTER_COMMIT event that the async
 * {@code GraphPromotionListener} consumes, so the {@code include_in_prompt} toggle (and a plain
 * text edit) takes effect on the NEXT turn rather than waiting for the nightly reconcile sweep.
 * NOT {@code @Transactional} for the same reason as {@code GraphPromotionEventIT}: the server's
 * own commit has to really happen for AFTER_COMMIT to fire, and Awaitility rides out the async hop.
 * The synchronous {@code syncFact}/{@code promoteFact}/{@code reconcile} cases already live in
 * {@code GraphFactOptOutIT} (a service-level, non-{@code @Transactional} test with no HTTP client)
 * — this class is only for the PATCH-triggered async path.
 */
@ActiveProfiles("companion-fake")
class GraphFactOptOutEventIT extends ApiIntegrationTest {

    private static final String FACTS = "/api/companion/fact";

    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private KnowledgeFactPopulator factPopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private KnowledgeFactResponse patchFact(UUID factId, UpdateFactRequest request) {
        return patchForBody(FACTS + "/" + factId, request, ownerAuthHeaders(), HttpStatus.OK, KnowledgeFactResponse.class);
    }

    @Test
    void testFactUpdate_shouldArchiveTheNode_whenTheFactIsOptedOutThroughTheApi() {
        UUID owner = ownerId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Laktózérzékeny vagyok.", "health", 0);
        UUID nodeId = promoteThenAwaitActive(owner, fact.getId());

        patchFact(fact.getId(), UpdateFactRequest.builder().includeInPrompt(false).build());

        await().atMost(10, SECONDS).untilAsserted(() ->
            assertThat(nodeRepository.findById(nodeId).orElseThrow().getStatus())
                .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED));
    }

    @Test
    void testFactUpdate_shouldReviveTheNodeWhenTheFactIsOptedBackIn() {
        UUID owner = ownerId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Reggel edzek.", "train", 0);
        UUID nodeId = promoteThenAwaitActive(owner, fact.getId());

        patchFact(fact.getId(), UpdateFactRequest.builder().includeInPrompt(false).build());
        await().atMost(10, SECONDS).untilAsserted(() ->
            assertThat(nodeRepository.findById(nodeId).orElseThrow().getStatus())
                .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED));

        patchFact(fact.getId(), UpdateFactRequest.builder().includeInPrompt(true).build());

        await().atMost(10, SECONDS).untilAsserted(() ->
            assertThat(nodeRepository.findById(nodeId).orElseThrow().getStatus())
                .isEqualTo(GraphNodeEntity.STATUS_ACTIVE));
        assertThat(nodeRepository.findAll().stream()
            .filter(n -> fact.getId().equals(n.getSourceId())).count()).isEqualTo(1);
    }

    @Test
    void testFactUpdate_shouldRefreshTheTitle_whenTheFactTextIsEdited() {
        UUID owner = ownerId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Régi szöveg.", "life", 0);
        UUID nodeId = promoteThenAwaitActive(owner, fact.getId());

        patchFact(fact.getId(), UpdateFactRequest.builder().factText("Friss szöveg.").build());

        await().atMost(10, SECONDS).untilAsserted(() ->
            assertThat(nodeRepository.findById(nodeId).orElseThrow().getTitle())
                .contains("Friss szöveg."));
    }

    @Test
    void testFactUpdate_shouldCreateNoNode_whenAnOptedOutFactIsEdited() {
        UUID owner = ownerId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Soha nem promotálva.", "life", 0, false,
            KnowledgeFactEntity.SOURCE_MANUAL);

        patchFact(fact.getId(), UpdateFactRequest.builder().factText("Még mindig kikapcsolva.").build());

        // "Nothing happened" idiom (GraphPromotionEventIT): a constant-condition check held for a
        // window, not a bare sleep — during() re-asserts the predicate for its whole duration.
        await().during(2, SECONDS).atMost(10, SECONDS).untilAsserted(() ->
            assertThat(nodeRepository.findAll().stream()
                .filter(n -> fact.getId().equals(n.getSourceId()))).isEmpty());
    }

    /** PATCH with only {@code includeInPrompt} unset promotes the fact through the API first, then awaits the node. */
    private UUID promoteThenAwaitActive(UUID owner, UUID factId) {
        patchFact(factId, UpdateFactRequest.builder().includeInPrompt(true).build());
        await().atMost(10, SECONDS).untilAsserted(() ->
            assertThat(nodeRepository.findAll().stream()
                .filter(n -> factId.equals(n.getSourceId()))).hasSize(1));
        return nodeRepository.findAll().stream()
            .filter(n -> factId.equals(n.getSourceId())).findFirst().orElseThrow().getId();
    }
}
