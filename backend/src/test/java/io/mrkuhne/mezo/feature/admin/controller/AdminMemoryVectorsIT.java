package io.mrkuhne.mezo.feature.admin.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminMemoryNeighbor;
import io.mrkuhne.mezo.api.dto.AdminMemoryNeighborsResponse;
import io.mrkuhne.mezo.api.dto.AdminMemoryVectorItem;
import io.mrkuhne.mezo.api.dto.AdminMemoryVectorsResponse;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryVectorEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import java.time.LocalDate;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * The memory map's payload and its neighbour probe (mezo-4qyt.2): a base64 Float32 PCA block that
 * matches the item list exactly, an honest {@code sampled} flag, and REAL pgvector cosine
 * distances rather than a re-derived similarity.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
    "mezo.feature.companion.enabled=true",
    "mezo.feature.admin-memory.enabled=true"
})
class AdminMemoryVectorsIT extends ApiIntegrationTest {

    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private MemoryItemPopulator memoryPopulator;

    @Test
    void testVectors_shouldReturnBase64ProjectionMatchingItemCount() {
        RegisteredUser anna = registerUser("Anna");
        readyItem(anna.id(), "futás", 1, LocalDate.of(2026, 6, 3));
        readyItem(anna.id(), "alvás", 2, LocalDate.of(2026, 6, 2));
        readyItem(anna.id(), "étkezés", 3, LocalDate.of(2026, 6, 1));

        AdminMemoryVectorsResponse response = getForBody(vectorsUri(anna.id()),
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryVectorsResponse.class);

        assertThat(response.getEmbeddingVersion()).isEqualTo(VERSION);
        assertThat(response.getSampled()).isFalse();
        assertThat(response.getTotal()).isEqualTo(3L);
        assertThat(response.getItems()).hasSize(3);
        // Newest first, exactly the sampling order the LIMIT clause applies.
        assertThat(response.getItems()).extracting(AdminMemoryVectorItem::getOccurredOn)
                .containsExactly(LocalDate.of(2026, 6, 3), LocalDate.of(2026, 6, 2),
                        LocalDate.of(2026, 6, 1));
        byte[] bytes = Base64.getDecoder().decode(response.getProjection());
        assertThat(bytes).hasSize(response.getItems().size() * response.getDims() * Float.BYTES);
    }

    @Test
    void testVectors_shouldExcludeStaleAndFailedVectors() {
        RegisteredUser anna = registerUser("Anna");
        MemoryItemEntity ready = readyItem(anna.id(), "friss", 1, LocalDate.of(2026, 6, 3));
        MemoryItemEntity stale = item(anna.id(), "elavult", LocalDate.of(2026, 6, 2));
        memoryPopulator.vector(stale, VERSION, MemoryEmbeddingPopulator.axisVector(2),
                MemoryVectorEntity.STATUS_READY, null, "a".repeat(64));
        MemoryItemEntity failed = item(anna.id(), "hibás", LocalDate.of(2026, 6, 1));
        memoryPopulator.vector(failed, VERSION, null,
                MemoryVectorEntity.STATUS_FAILED, "QUOTA", null);

        AdminMemoryVectorsResponse response = getForBody(vectorsUri(anna.id()),
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryVectorsResponse.class);

        // A stale vector is PRESENT but ANN-ineligible; a failed one has no vector at all. Neither
        // may appear on a map that claims to show what retrieval can reach.
        assertThat(response.getItems()).extracting(AdminMemoryVectorItem::getItemId)
                .containsExactly(ready.getId());
        assertThat(response.getTotal()).isEqualTo(1L);
    }

    @Test
    void testNeighbors_shouldOrderByRealCosineDistance_whenOwner() {
        RegisteredUser anna = registerUser("Anna");
        MemoryItemEntity anchor = item(anna.id(), "horgony", LocalDate.of(2026, 6, 3));
        memoryPopulator.vector(anchor, VERSION, MemoryEmbeddingPopulator.axisVector(0));
        MemoryItemEntity near = item(anna.id(), "közeli", LocalDate.of(2026, 6, 2));
        memoryPopulator.vector(near, VERSION, MemoryEmbeddingPopulator.blendVector(0, 1));
        MemoryItemEntity far = item(anna.id(), "távoli", LocalDate.of(2026, 6, 1));
        memoryPopulator.vector(far, VERSION, MemoryEmbeddingPopulator.axisVector(1));

        AdminMemoryNeighborsResponse response = getForBody(neighborsUri(anna.id(), anchor.getId()),
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryNeighborsResponse.class);

        assertThat(response.getItemId()).isEqualTo(anchor.getId());
        assertThat(response.getEmbeddingVersion()).isEqualTo(VERSION);
        assertThat(response.getNeighbors()).extracting(AdminMemoryNeighbor::getItemId)
                .containsExactly(near.getId(), far.getId());
        double nearer = response.getNeighbors().getFirst().getDistance();
        double farther = response.getNeighbors().get(1).getDistance();
        assertThat(nearer).isLessThan(farther);
        // 1 - cosine distance, on the L2-normalised vectors this app stores.
        assertThat(response.getNeighbors()).allSatisfy(neighbor ->
                assertThat(neighbor.getSimilarity()).isEqualTo(1.0 - neighbor.getDistance()));
    }

    @Test
    void testNeighbors_shouldNeverReturnTheAnchorItself() {
        RegisteredUser anna = registerUser("Anna");
        MemoryItemEntity anchor = readyItem(anna.id(), "horgony", 0, LocalDate.of(2026, 6, 3));
        readyItem(anna.id(), "másik", 1, LocalDate.of(2026, 6, 2));

        AdminMemoryNeighborsResponse response = getForBody(neighborsUri(anna.id(), anchor.getId()),
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryNeighborsResponse.class);

        assertThat(response.getNeighbors()).extracting(AdminMemoryNeighbor::getItemId)
                .doesNotContain(anchor.getId())
                .hasSize(1);
    }

    @Test
    void testNeighbors_shouldReturn404_whenItemHasNoServingVector() {
        RegisteredUser anna = registerUser("Anna");
        MemoryItemEntity vectorless = item(anna.id(), "vektor nélkül", LocalDate.of(2026, 6, 3));

        String body = getForBody(neighborsUri(anna.id(), vectorless.getId()),
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        // Distinct from ADMIN_MEMORY_ITEM_NOT_FOUND: the item exists, the vector does not.
        assertHasRequestError(body, "ADMIN_MEMORY_NO_VECTOR");
    }

    @Test
    void testNeighbors_shouldReturn404_whenItemDoesNotExist() {
        RegisteredUser anna = registerUser("Anna");

        String body = getForBody(neighborsUri(anna.id(), UUID.randomUUID()),
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "ADMIN_MEMORY_ITEM_NOT_FOUND");
    }

    // ==== helpers ====

    private MemoryItemEntity item(UUID owner, String content, LocalDate occurredOn) {
        return memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(), content, occurredOn);
    }

    private MemoryItemEntity readyItem(UUID owner, String content, int axis, LocalDate occurredOn) {
        MemoryItemEntity item = item(owner, content, occurredOn);
        memoryPopulator.vector(item, VERSION, MemoryEmbeddingPopulator.axisVector(axis));
        return item;
    }

    private static String vectorsUri(UUID userId) {
        return "/api/admin/users/" + userId + "/memory/vectors";
    }

    private static String neighborsUri(UUID userId, UUID itemId) {
        return vectorsUri(userId) + "/" + itemId + "/neighbors";
    }
}
