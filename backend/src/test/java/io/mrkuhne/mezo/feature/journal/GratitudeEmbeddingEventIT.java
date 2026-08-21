package io.mrkuhne.mezo.feature.journal;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.CreateGratitudeEntryRequest;
import io.mrkuhne.mezo.api.dto.GratitudeEntryResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * End-to-end acceptance test of the W1.3 gratitude embed pipeline (bd mezo-b3pp.3):
 * POST /api/journal/gratitude -> AFTER_COMMIT {@code GratitudeEntrySavedEvent} -> async {@code
 * GratitudeEmbeddingListener} -> {@code MemoryEmbeddingWriter.writeGratitude} -> exactly ONE
 * {@code memory_embedding(kind=gratitude)} row. Same pattern as {@code JournalEmbeddingEventIT}.
 */
@ActiveProfiles("companion-fake")
class GratitudeEmbeddingEventIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testCreateGratitudeEntry_shouldProduceExactlyOneEmbedding_whenCommitted() {
        UUID owner = ownerId();

        var req = new CreateGratitudeEntryRequest();
        req.setText("Ma jó napom volt.");
        req.setOccurredOn(LocalDate.parse("2026-08-15"));
        req.setLifeArea("mindfulness");

        GratitudeEntryResponse created = postForBody("/api/journal/gratitude", req,
                ownerAuthHeaders(), HttpStatus.CREATED, GratitudeEntryResponse.class);

        await().atMost(10, SECONDS).untilAsserted(() -> {
            var rows = memoryEmbeddingRepository.findAll().stream()
                    .filter(r -> r.getCreatedBy().equals(owner))
                    .filter(r -> MemoryEmbeddingEntity.KIND_GRATITUDE.equals(r.getKind()))
                    .toList();
            assertThat(rows).hasSize(1);
            MemoryEmbeddingEntity row = rows.getFirst();
            assertThat(row.getKind()).isEqualTo(MemoryEmbeddingEntity.KIND_GRATITUDE);
            assertThat(row.getRefId()).isEqualTo(created.getId());
            assertThat(row.getContent()).isEqualTo("Ma jó napom volt.");
            assertThat(row.getOccurredOn()).isEqualTo(LocalDate.parse("2026-08-15"));
        });
    }

    @Test
    void testDeleteGratitudeEntry_shouldRemoveEmbedding_whenDeleted() {
        var req = new CreateGratitudeEntryRequest();
        req.setText("Törlendő hála.");
        req.setOccurredOn(LocalDate.parse("2026-08-15"));
        GratitudeEntryResponse created = postForBody("/api/journal/gratitude", req,
                ownerAuthHeaders(), HttpStatus.CREATED, GratitudeEntryResponse.class);

        await().atMost(10, SECONDS).untilAsserted(() ->
                assertThat(memoryEmbeddingRepository
                        .findByKindAndRefId(MemoryEmbeddingEntity.KIND_GRATITUDE, created.getId()))
                        .isPresent());

        deleteAndExpect("/api/journal/gratitude/" + created.getId(), ownerAuthHeaders(), HttpStatus.NO_CONTENT);

        await().atMost(10, SECONDS).untilAsserted(() ->
                assertThat(memoryEmbeddingRepository
                        .findByKindAndRefId(MemoryEmbeddingEntity.KIND_GRATITUDE, created.getId()))
                        .isEmpty());
    }
}
