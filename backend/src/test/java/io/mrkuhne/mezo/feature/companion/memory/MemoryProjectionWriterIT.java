package io.mrkuhne.mezo.feature.companion.memory;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.NarrativeNoteSource;
import io.mrkuhne.mezo.feature.companion.embedding.MemoryEmbeddingWriter;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryVectorEntity;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryVectorRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.feature.ritual.entity.RitualDayEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.RitualPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/** Dual-write lifecycle coverage for mutable narrative projections. */
@ActiveProfiles("companion-fake")
class MemoryProjectionWriterIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 8, 29);
    private static final String SERVING_VERSION = "gemini-embedding-001-768-v1";

    @Autowired private MemoryEmbeddingWriter memoryEmbeddingWriter;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private MemoryItemRepository memoryItemRepository;
    @Autowired private MemoryVectorRepository memoryVectorRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private RitualPopulator ritualPopulator;

    @Test
    void testWriteReflection_shouldSuppressAndReviveProjection_whenTextClearedThenRestored() {
        UUID owner = userPopulator.createUser().getId();
        RitualDayEntity day = ritualPopulator.closedDay(owner, DAY);
        day.setReflectionText("A séta után megnyugodtam.");
        memoryEmbeddingWriter.writeReflection(day);
        MemoryItemEntity original = assertProjected(
                owner, MemoryEmbeddingEntity.KIND_REFLECTION, day.getId(), day.getReflectionText());

        day.setReflectionText(" ");
        memoryEmbeddingWriter.writeReflection(day);

        assertSuppressed(owner, MemoryEmbeddingEntity.KIND_REFLECTION, day.getId());

        day.setReflectionText("A korai séta után jobban aludtam.");
        memoryEmbeddingWriter.writeReflection(day);

        MemoryItemEntity revived = assertProjected(
                owner, MemoryEmbeddingEntity.KIND_REFLECTION, day.getId(), day.getReflectionText());
        assertThat(revived.getId()).isEqualTo(original.getId());
    }

    @Test
    void testSyncNote_shouldUpdateAndSuppressProjection_whenActivityNoteChangesThenDeletes() {
        assertNoteLifecycle(NarrativeNoteSource.ACTIVITY_NOTE);
    }

    @Test
    void testSyncNote_shouldUpdateAndSuppressProjection_whenCheckInNoteChangesThenDeletes() {
        assertNoteLifecycle(NarrativeNoteSource.CHECKIN_NOTE);
    }

    private void assertNoteLifecycle(String kind) {
        UUID owner = userPopulator.createUser().getId();
        UUID sourceId = UUID.randomUUID();
        var original = new NarrativeNoteSource.Note(sourceId, owner, "Hosszú, nyugodt séta munka után.", DAY);

        assertThat(memoryEmbeddingWriter.syncNote(kind, original)).isTrue();
        MemoryItemEntity item = assertProjected(owner, kind, sourceId, original.text());
        assertThat(memoryEmbeddingWriter.syncNote(kind, original)).isFalse();

        var changed = new NarrativeNoteSource.Note(
                sourceId, owner, "Hosszú séta és korai lefekvés munka után.", DAY.plusDays(1));
        assertThat(memoryEmbeddingWriter.syncNote(kind, changed)).isTrue();
        MemoryItemEntity updated = assertProjected(owner, kind, sourceId, changed.text());
        assertThat(updated.getId()).isEqualTo(item.getId());
        assertThat(updated.getOccurredOn()).isEqualTo(DAY.plusDays(1));

        memoryEmbeddingWriter.deleteNoteEmbedding(kind, sourceId);

        assertThat(memoryEmbeddingRepository.findByKindAndRefId(kind, sourceId)).isEmpty();
        assertSuppressed(owner, kind, sourceId);
    }

    private MemoryItemEntity assertProjected(UUID owner, String kind, UUID sourceId, String content) {
        MemoryItemEntity item = memoryItemRepository
                .findByCreatedByAndSourceKindAndSourceId(owner, kind, sourceId)
                .orElseThrow();
        assertThat(item.getContent()).isEqualTo(content);
        assertThat(item.getContentHash()).isEqualTo(sha256(content));
        assertThat(item.getState()).isEqualTo(MemoryItemEntity.STATE_ACTIVE);
        assertThat(memoryVectorRepository
                .findByCreatedByAndMemoryItemIdAndEmbeddingVersionAndStatusAndDeletedFalse(
                        owner, item.getId(), SERVING_VERSION, MemoryVectorEntity.STATUS_READY))
                .isPresent();
        return item;
    }

    private void assertSuppressed(UUID owner, String kind, UUID sourceId) {
        MemoryItemEntity item = memoryItemRepository
                .findByCreatedByAndSourceKindAndSourceId(owner, kind, sourceId)
                .orElseThrow();
        assertThat(item.getState()).isEqualTo(MemoryItemEntity.STATE_SUPPRESSED);
        assertThat(memoryVectorRepository.findByCreatedByAndMemoryItemIdOrderByEmbeddingVersion(owner, item.getId()))
                .isEmpty();
    }

    private static String sha256(String content) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(content.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 must be available", e);
        }
    }
}
