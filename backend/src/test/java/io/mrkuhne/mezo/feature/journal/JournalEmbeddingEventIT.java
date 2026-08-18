package io.mrkuhne.mezo.feature.journal;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.CreateJournalEntryRequest;
import io.mrkuhne.mezo.api.dto.JournalEntryResponse;
import io.mrkuhne.mezo.api.dto.UpdateJournalEntryRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * End-to-end acceptance test of the W1.1 journal embed pipeline (bd mezo-b3pp.1, spec §5.1):
 * POST /api/journal -> AFTER_COMMIT {@code JournalEntrySavedEvent} -> async {@code
 * JournalEmbeddingListener} -> {@code MemoryEmbeddingWriter.writeJournal} -> exactly ONE
 * {@code memory_embedding(kind=journal_entry)} row. The {@code CompanionMessageEventIT} idiom:
 * NOT {@code @Transactional} so the server-side commit actually happens and AFTER_COMMIT
 * genuinely fires, Awaitility rides out the async hop.
 */
@ActiveProfiles("companion-fake")
class JournalEmbeddingEventIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testCreateJournalEntry_shouldProduceExactlyOneEmbedding_whenCommitted() {
        UUID owner = ownerId();

        JournalEntryResponse created = postForBody("/api/journal",
                CreateJournalEntryRequest.builder()
                        .text("Ma jó napom volt.")
                        .occurredOn(LocalDate.parse("2026-08-15"))
                        .source("quickinput")
                        .build(),
                ownerAuthHeaders(), HttpStatus.CREATED, JournalEntryResponse.class);

        await().atMost(10, SECONDS).untilAsserted(() -> {
            var rows = memoryEmbeddingRepository.findAll().stream()
                    .filter(r -> r.getCreatedBy().equals(owner))
                    .filter(r -> MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY.equals(r.getKind()))
                    .toList();
            assertThat(rows).hasSize(1);
            MemoryEmbeddingEntity row = rows.getFirst();
            assertThat(row.getKind()).isEqualTo(MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY);
            assertThat(row.getRefId()).isEqualTo(created.getId());
            assertThat(row.getContent()).isEqualTo("Ma jó napom volt.");
            assertThat(row.getOccurredOn()).isEqualTo(LocalDate.parse("2026-08-15"));
        });
    }

    @Test
    void testUpdateJournalEntry_shouldReembed_whenTextChanges() {
        UUID owner = ownerId();

        JournalEntryResponse created = postForBody("/api/journal",
                CreateJournalEntryRequest.builder()
                        .text("Eredeti szöveg.")
                        .occurredOn(LocalDate.parse("2026-08-15"))
                        .source("quickinput")
                        .build(),
                ownerAuthHeaders(), HttpStatus.CREATED, JournalEntryResponse.class);

        // Capture the pre-edit row id + vector so the post-edit assertion can prove the vector
        // ITSELF changed, not just the stored content — the fake embedding adapter is deterministic
        // per input text (seeded Random(text.hashCode())), so distinct texts map to distinct vectors.
        AtomicReference<UUID> originalRowId = new AtomicReference<>();
        AtomicReference<float[]> originalEmbedding = new AtomicReference<>();
        await().atMost(10, SECONDS).untilAsserted(() -> {
            var row = memoryEmbeddingRepository
                    .findByKindAndRefId(MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, created.getId());
            assertThat(row).isPresent();
            originalRowId.set(row.get().getId());
            originalEmbedding.set(row.get().getEmbedding());
        });

        putForBody("/api/journal/" + created.getId(),
                UpdateJournalEntryRequest.builder().text("Módosított szöveg.").build(),
                ownerAuthHeaders(), HttpStatus.OK, JournalEntryResponse.class);

        await().atMost(10, SECONDS).untilAsserted(() ->
                assertThat(memoryEmbeddingRepository
                        .findByKindAndRefId(MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, created.getId()))
                        .hasValueSatisfying(row -> {
                            assertThat(row.getId()).isEqualTo(originalRowId.get()); // update in place
                            assertThat(row.getContent()).isEqualTo("Módosított szöveg.");
                            assertThat(row.getEmbedding()).hasSize(EmbeddingPort.DIMENSIONS);
                            assertThat(row.getEmbedding()).isNotEqualTo(originalEmbedding.get());
                        }));

        var rows = memoryEmbeddingRepository.findAll().stream()
                .filter(r -> r.getCreatedBy().equals(owner))
                .filter(r -> MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY.equals(r.getKind()))
                .toList();
        assertThat(rows).hasSize(1);
    }

    @Test
    void testDeleteJournalEntry_shouldRemoveEmbedding_whenDeleted() {
        JournalEntryResponse created = postForBody("/api/journal",
                CreateJournalEntryRequest.builder()
                        .text("Törlendő bejegyzés.")
                        .occurredOn(LocalDate.parse("2026-08-15"))
                        .source("quickinput")
                        .build(),
                ownerAuthHeaders(), HttpStatus.CREATED, JournalEntryResponse.class);

        await().atMost(10, SECONDS).untilAsserted(() ->
                assertThat(memoryEmbeddingRepository
                        .findByKindAndRefId(MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, created.getId()))
                        .isPresent());

        deleteAndExpect("/api/journal/" + created.getId(), ownerAuthHeaders(), HttpStatus.NO_CONTENT);

        await().atMost(10, SECONDS).untilAsserted(() ->
                assertThat(memoryEmbeddingRepository
                        .findByKindAndRefId(MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, created.getId()))
                        .isEmpty());
    }
}
