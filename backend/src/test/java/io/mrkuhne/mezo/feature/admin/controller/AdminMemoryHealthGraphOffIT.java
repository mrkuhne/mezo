package io.mrkuhne.mezo.feature.admin.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import io.mrkuhne.mezo.api.dto.AdminMemoryCountBucket;
import io.mrkuhne.mezo.api.dto.AdminMemoryHealthResponse;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Degraded, not dead (mezo-4qyt.2): with the knowledge graph switched off, {@code /health} still
 * answers for the VECTOR half and returns empty graph buckets — the surface's rule is that one
 * layer being off never takes the other views down with it. A separate class because the switch is
 * a class-level {@code @TestPropertySource}.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
    "mezo.feature.companion.enabled=true",
    "mezo.feature.knowledge-graph.enabled=false",
    "mezo.feature.admin-memory.enabled=true"
})
class AdminMemoryHealthGraphOffIT extends ApiIntegrationTest {

    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private MemoryItemPopulator memoryPopulator;

    @Test
    void testHealth_shouldStillAnswerVectorHalf_whenGraphSwitchIsOff() {
        RegisteredUser anna = registerUser("Anna");
        MemoryItemEntity item = memoryPopulator.item(anna.id(), "journal_entry", UUID.randomUUID(),
                "friss", LocalDate.of(2026, 6, 3));
        memoryPopulator.vector(item, VERSION, MemoryEmbeddingPopulator.axisVector(0));

        AdminMemoryHealthResponse response = getForBody(
                "/api/admin/users/" + anna.id() + "/memory/health",
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryHealthResponse.class);

        assertThat(response.getVectorsByStatus())
                .extracting(AdminMemoryCountBucket::getKey, AdminMemoryCountBucket::getCount)
                .containsExactly(tuple("ready", 1L));
        assertThat(response.getNodesByStatus()).isEmpty();
        assertThat(response.getNodesByKind()).isEmpty();
        assertThat(response.getEdgeWeightHistogram()).isEmpty();
    }

    @Test
    void testGraph_shouldReturn404Disabled_whenGraphSwitchIsOff() {
        RegisteredUser anna = registerUser("Anna");

        String body = getForBody("/api/admin/users/" + anna.id() + "/memory/graph",
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        // A missing bean is a product state ("that layer is off"), never a 500.
        assertHasRequestError(body, "ADMIN_MEMORY_DISABLED");
    }
}
