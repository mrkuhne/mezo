package io.mrkuhne.mezo.feature.admin.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminMemoryVectorsResponse;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
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
 * The map's sampling path (mezo-4qyt.2). A separate class because the threshold is a
 * class-level {@code @TestPropertySource} — a map of 5 000 of 12 000 memories that claims to be
 * complete is worse than no map, so {@code sampled} is surfaced, never silently applied.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
    "mezo.feature.companion.enabled=true",
    "mezo.feature.admin-memory.enabled=true",
    "mezo.admin.memory.vector-sample-threshold=3"
})
class AdminMemoryVectorsSamplingIT extends ApiIntegrationTest {

    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private MemoryItemPopulator memoryPopulator;

    @Test
    void testVectors_shouldFlagSampled_whenOverTheThreshold() {
        RegisteredUser anna = registerUser("Anna");
        for (int i = 0; i < 5; i++) {
            MemoryItemEntity item = memoryPopulator.item(anna.id(), "journal_entry",
                    UUID.randomUUID(), "emlék " + i, LocalDate.of(2026, 6, 1).plusDays(i));
            memoryPopulator.vector(item, VERSION, MemoryEmbeddingPopulator.axisVector(i));
        }

        AdminMemoryVectorsResponse response = getForBody(
                "/api/admin/users/" + anna.id() + "/memory/vectors",
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryVectorsResponse.class);

        assertThat(response.getSampled()).isTrue();
        assertThat(response.getItems()).hasSize(3);
        // `total` is the UNSAMPLED population, so the surface can say "3 of 5" honestly.
        assertThat(response.getTotal()).isEqualTo(5L);
        byte[] bytes = Base64.getDecoder().decode(response.getProjection());
        assertThat(bytes).hasSize(3 * response.getDims() * Float.BYTES);
    }
}
