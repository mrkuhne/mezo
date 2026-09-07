package io.mrkuhne.mezo.feature.admin.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import io.mrkuhne.mezo.api.dto.AdminMemoryCountBucket;
import io.mrkuhne.mezo.api.dto.AdminMemoryHealthResponse;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryVectorEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
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
 * The store's health rollups (mezo-4qyt.2): per-status and per-version counts, the quiet
 * stale-vector failure mode, and an edge-weight histogram with exactly the configured number of
 * buckets — {@code width_bucket} returns {@code buckets + 1} for a weight of exactly 1.0, and that
 * overflow must be folded, not shipped as a phantom column.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
    "mezo.feature.companion.enabled=true",
    "mezo.feature.knowledge-graph.enabled=true",
    "mezo.feature.admin-memory.enabled=true"
})
class AdminMemoryHealthIT extends ApiIntegrationTest {

    private static final String VERSION = "gemini-embedding-001-768-v1";
    private static final String OLD_VERSION = "gemini-embedding-001-768-v0";

    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private GraphPopulator graphPopulator;

    @Test
    void testHealth_shouldRollUpStatusVersionAndStaleness_whenOwner() {
        RegisteredUser anna = registerUser("Anna");
        MemoryItemEntity ready = item(anna.id(), "friss", LocalDate.of(2026, 6, 3));
        memoryPopulator.vector(ready, VERSION, MemoryEmbeddingPopulator.axisVector(0));
        MemoryItemEntity failed = item(anna.id(), "hibás", LocalDate.of(2026, 6, 2));
        memoryPopulator.vector(failed, VERSION, null, MemoryVectorEntity.STATUS_FAILED, "QUOTA", null);
        MemoryItemEntity stale = item(anna.id(), "elavult", LocalDate.of(2026, 6, 1));
        memoryPopulator.vector(stale, OLD_VERSION, MemoryEmbeddingPopulator.axisVector(2),
                MemoryVectorEntity.STATUS_READY, null, "b".repeat(64));

        AdminMemoryHealthResponse response = getForBody(healthUri(anna.id()),
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryHealthResponse.class);

        assertThat(response.getServingEmbeddingVersion()).isEqualTo(VERSION);
        assertThat(response.getVectorsByStatus())
                .extracting(AdminMemoryCountBucket::getKey, AdminMemoryCountBucket::getCount)
                .containsExactlyInAnyOrder(
                        tuple("failed", 1L),
                        tuple("ready", 2L));
        assertThat(response.getVectorFailures())
                .extracting(AdminMemoryCountBucket::getKey, AdminMemoryCountBucket::getCount)
                .containsExactly(tuple("QUOTA", 1L));
        assertThat(response.getVectorsByVersion())
                .extracting(AdminMemoryCountBucket::getKey)
                .containsExactlyInAnyOrder(VERSION, OLD_VERSION);
        // Present, ready, and yet ANN-ineligible: the hash no longer matches its item's content.
        assertThat(response.getStaleVectorCount()).isEqualTo(1L);
        assertThat(response.getItemsByState())
                .extracting(AdminMemoryCountBucket::getKey, AdminMemoryCountBucket::getCount)
                .containsExactly(tuple("active", 3L));
        // Inferred, not recorded: there is no job-run table anywhere in this app.
        assertThat(response.getJobs()).containsKeys("lastDailySummary", "lastPatternDetection",
                "lastEdgeReinforcement", "lastRetrievalRun", "lastVectorWrite");
        assertThat(response.getJobs().get("lastVectorWrite")).isNotNull();
        assertThat(response.getJobs().get("lastDailySummary")).isNull();
    }

    @Test
    void testHealth_shouldBucketEdgeWeights_andFoldWeightOne() {
        RegisteredUser anna = registerUser("Anna");
        GraphNodeEntity from = graphPopulator.createNode(anna.id(), GraphNodeEntity.KIND_PATTERN, "A");
        GraphNodeEntity to = graphPopulator.createNode(anna.id(), GraphNodeEntity.KIND_GOAL, "B");
        GraphNodeEntity third = graphPopulator.createNode(anna.id(), GraphNodeEntity.KIND_GOAL, "C");
        graphPopulator.createEdge(anna.id(), from.getId(), to.getId(),
                GraphEdgeEntity.KIND_TRIGGERS, "0.050");
        graphPopulator.createEdge(anna.id(), from.getId(), third.getId(),
                GraphEdgeEntity.KIND_SUPPORTS, "0.550");
        graphPopulator.createEdge(anna.id(), to.getId(), third.getId(),
                GraphEdgeEntity.KIND_RELATES_TO, "1.000");

        AdminMemoryHealthResponse response = getForBody(healthUri(anna.id()),
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryHealthResponse.class);

        // Exactly edgeWeightHistogramBuckets columns — no phantom eleventh for the 1.0 edge.
        assertThat(response.getEdgeWeightHistogram()).hasSize(10);
        assertThat(response.getEdgeWeightHistogram().getFirst().getCount()).isEqualTo(1L);
        assertThat(response.getEdgeWeightHistogram().get(5).getCount()).isEqualTo(1L);
        assertThat(response.getEdgeWeightHistogram().getLast().getCount()).isEqualTo(1L);
        assertThat(response.getEdgeWeightHistogram())
                .extracting(AdminMemoryCountBucket::getCount)
                .filteredOn(count -> count > 0)
                .hasSize(3);
        assertThat(response.getNodesByKind())
                .extracting(AdminMemoryCountBucket::getKey, AdminMemoryCountBucket::getCount)
                .containsExactlyInAnyOrder(
                        tuple("GOAL", 2L),
                        tuple("PATTERN", 1L));
        assertThat(response.getNodesByStatus())
                .extracting(AdminMemoryCountBucket::getKey, AdminMemoryCountBucket::getCount)
                .containsExactly(tuple("active", 3L));
    }

    private MemoryItemEntity item(UUID owner, String content, LocalDate occurredOn) {
        return memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(), content, occurredOn);
    }

    private static String healthUri(UUID userId) {
        return "/api/admin/users/" + userId + "/memory/health";
    }
}
