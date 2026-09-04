package io.mrkuhne.mezo.feature.companion.memory;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryVectorEntity;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryVectorRepository;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryReembeddingJob;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryReembeddingService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
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
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/** Resumable generation backfill against real PostgreSQL/pgvector. */
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
    "mezo.companion.memory-platform.reembedding.enabled=true",
    "mezo.companion.memory-platform.reembedding.target-version=gemini-embedding-001-768-v2",
    "mezo.companion.memory-platform.reembedding.batch-size=2"
})
class MemoryReembeddingIT extends AbstractIntegrationTest {

    private static final String V1 = "gemini-embedding-001-768-v1";
    private static final String V2 = "gemini-embedding-001-768-v2";
    private static final LocalDate DAY = LocalDate.of(2026, 8, 29);

    @Autowired private MemoryReembeddingService service;
    @Autowired private MemoryReembeddingJob job;
    @Autowired private MemoryItemPopulator memoryItemPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryVectorRepository vectorRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private AppUserRepository appUserRepository;

    @Test
    void testReembedMissing_shouldResumePendingGeneration_andKeepV1Readable() {
        UUID owner = userPopulator.createUser().getId();
        MemoryItemEntity item = memoryItemPopulator.item(
                owner, "journal_entry", UUID.randomUUID(), "Futás után jobban aludtam.", DAY);
        memoryItemPopulator.vector(item, V1, axisVector(0));
        MemoryVectorEntity pending = memoryItemPopulator.vector(item, V2, axisVector(1));
        pending.setStatus(MemoryVectorEntity.STATUS_PENDING);
        pending.setEmbedding(null);
        vectorRepository.saveAndFlush(pending);

        var result = service.reembedMissing(owner, V2, 10);

        assertThat(result).extracting("selected", "ready", "failed").containsExactly(1, 1, 0);
        assertReady(owner, item, V1);
        assertReady(owner, item, V2);
    }

    @Test
    void testReembedMissing_shouldSkipMatchingReady_andRefreshStaleHash() {
        UUID owner = userPopulator.createUser().getId();
        MemoryItemEntity matching = memoryItemPopulator.item(
                owner, "journal_entry", UUID.randomUUID(), "Változatlan tartalom.", DAY);
        memoryItemPopulator.vector(matching, V2, axisVector(0));
        MemoryItemEntity changed = memoryItemPopulator.item(
                owner, "reflection", UUID.randomUUID(), "Régi tartalom.", DAY);
        MemoryVectorEntity stale = memoryItemPopulator.vector(changed, V2, axisVector(1));
        float[] staleEmbedding = stale.getEmbedding().clone();
        changed.setContent("Új tartalom.");
        changed.setContentHash(sha256(changed.getContent()));
        itemRepository.saveAndFlush(changed);

        var result = service.reembedMissing(owner, V2, 10);

        assertThat(result).extracting("selected", "ready", "failed").containsExactly(1, 1, 0);
        MemoryVectorEntity refreshed = vectorRepository.findByOwnerItemAndVersionIncludingDeleted(
                owner, changed.getId(), V2).orElseThrow();
        assertThat(refreshed.getEmbeddedContentHash()).isEqualTo(changed.getContentHash());
        assertThat(refreshed.getEmbedding()).isNotEqualTo(staleEmbedding);
    }

    @Test
    void testReembedMissing_shouldMarkFailedAndRetry_whenProviderRecovers() {
        UUID owner = userPopulator.createUser().getId();
        MemoryItemEntity item = memoryItemPopulator.item(owner, "activity_note", UUID.randomUUID(),
                FakeEmbeddingAdapter.FAIL_EMBED + " átmeneti hiba", DAY);

        assertThat(service.reembedMissing(owner, V2, 10).failed()).isEqualTo(1);
        MemoryVectorEntity failed = vectorRepository.findByOwnerItemAndVersionIncludingDeleted(
                owner, item.getId(), V2).orElseThrow();
        assertThat(failed.getStatus()).isEqualTo(MemoryVectorEntity.STATUS_FAILED);
        assertThat(failed.getFailureCode()).isEqualTo("EMBEDDING_PROVIDER_FAILURE");

        item.setContent("A szolgáltató ismét elérhető.");
        item.setContentHash(sha256(item.getContent()));
        itemRepository.saveAndFlush(item);

        assertThat(service.reembedMissing(owner, V2, 10).ready()).isEqualTo(1);
        assertReady(owner, item, V2);
    }

    @Test
    void testRun_shouldReembedOnlyActiveOnboardedUsers_whenJobEnabled() {
        AppUserEntity active = userPopulator.createUser();
        AppUserEntity excluded = userPopulator.createUser();
        excluded.setOnboardedAt(null);
        appUserRepository.saveAndFlush(excluded);
        MemoryItemEntity activeItem = memoryItemPopulator.item(
                active.getId(), "journal_entry", UUID.randomUUID(), "Aktív felhasználó.", DAY);
        MemoryItemEntity excludedItem = memoryItemPopulator.item(
                excluded.getId(), "journal_entry", UUID.randomUUID(), "Kizárt felhasználó.", DAY);

        job.run();

        assertReady(active.getId(), activeItem, V2);
        assertThat(vectorRepository.findByOwnerItemAndVersionIncludingDeleted(
                excluded.getId(), excludedItem.getId(), V2)).isEmpty();
    }

    private void assertReady(UUID owner, MemoryItemEntity item, String version) {
        assertThat(vectorRepository
                .findByCreatedByAndMemoryItemIdAndEmbeddingVersionAndStatusAndDeletedFalse(
                        owner, item.getId(), version, MemoryVectorEntity.STATUS_READY))
                .isPresent();
    }

    private static float[] axisVector(int axis) {
        float[] vector = new float[EmbeddingPort.DIMENSIONS];
        vector[axis] = 1f;
        return vector;
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
