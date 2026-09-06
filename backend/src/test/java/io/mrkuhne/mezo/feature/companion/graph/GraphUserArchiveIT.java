package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Coverage for the {@code user_archived_at} durable-intent marker (mezo-06o0.5): a hand-archived
 * node must record that the ARCHIVE was a user decision, not just flip {@code status}, so a later
 * promoter guard can tell "user archived this" apart from "nothing has promoted it yet".
 */
class GraphUserArchiveIT extends AbstractIntegrationTest {

    @Autowired private GraphService graphService;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DatabasePopulator databasePopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
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
}
