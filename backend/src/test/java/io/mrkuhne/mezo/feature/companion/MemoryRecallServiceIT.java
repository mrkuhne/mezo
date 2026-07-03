package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.service.MemoryRecallService;
import io.mrkuhne.mezo.feature.companion.service.MemoryRecallService.RecalledMemory;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * V2.3 recall ranking over hand-seeded vectors + the fake embedder's {@code [fake-embed:…]}
 * scripted query — similarity dominance, recency decay, the raw-similarity floor, the
 * daily-summary kind scope and the k clamp, all LLM/provider-free.
 */
@Transactional
@ActiveProfiles("companion-fake")
class MemoryRecallServiceIT extends AbstractIntegrationTest {

    /** Query whose fake embedding is exactly axis-0 — cosine geometry is then hand-computable. */
    private static final String AXIS0_QUERY = "[fake-embed:1] rossz alvás edzés után";

    @Autowired private MemoryRecallService memoryRecallService;
    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRecall_shouldOrderBySimilarity_whenSameAge() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(3);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                UUID.randomUUID(), "pontos találat", day, MemoryEmbeddingPopulator.axisVector(0));
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                UUID.randomUUID(), "részleges találat", day, MemoryEmbeddingPopulator.blendVector(0, 1));

        List<RecalledMemory> memories = memoryRecallService.recallSimilarDays(owner, AXIS0_QUERY, 5);

        assertThat(memories).extracting(RecalledMemory::content)
                .containsExactly("pontos találat", "részleges találat");
        assertThat(memories.get(0).similarity()).isCloseTo(1.0, within(1e-5));
        assertThat(memories.get(1).similarity()).isCloseTo(Math.sqrt(2) / 2, within(1e-5));
    }

    @Test
    void testRecall_shouldPreferRecentDay_whenSimilarityEqual() {
        UUID owner = userPopulator.createUser().getId();
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                UUID.randomUUID(), "régi nap", LocalDate.now().minusDays(200),
                MemoryEmbeddingPopulator.axisVector(0));
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                UUID.randomUUID(), "friss nap", LocalDate.now().minusDays(2),
                MemoryEmbeddingPopulator.axisVector(0));

        List<RecalledMemory> memories = memoryRecallService.recallSimilarDays(owner, AXIS0_QUERY, 5);

        assertThat(memories).extracting(RecalledMemory::content)
                .containsExactly("friss nap", "régi nap");
        // decay-days: 90 → a 200-day-old identical match scores ≈ e^(-200/90)
        assertThat(memories.get(1).score()).isCloseTo(Math.exp(-200.0 / 90), within(1e-3));
    }

    @Test
    void testRecall_shouldDropWeakMatches_whenBelowSimilarityFloor() {
        UUID owner = userPopulator.createUser().getId();
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                UUID.randomUUID(), "ortogonális zaj", LocalDate.now().minusDays(1),
                MemoryEmbeddingPopulator.axisVector(1));

        // min-similarity: 0.25 — an orthogonal (similarity 0) day must NOT be "remembered"
        assertThat(memoryRecallService.recallSimilarDays(owner, AXIS0_QUERY, 5)).isEmpty();
    }

    @Test
    void testRecall_shouldScopeToDailySummaries_whenTurnVectorsExist() {
        UUID owner = userPopulator.createUser().getId();
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN,
                UUID.randomUUID(), "chat turn", LocalDate.now().minusDays(1),
                MemoryEmbeddingPopulator.axisVector(0));
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                UUID.randomUUID(), "napi összefoglaló", LocalDate.now().minusDays(1),
                MemoryEmbeddingPopulator.axisVector(0));

        List<RecalledMemory> memories = memoryRecallService.recallSimilarDays(owner, AXIS0_QUERY, 5);

        assertThat(memories).extracting(RecalledMemory::content).containsExactly("napi összefoglaló");
    }

    @Test
    void testRecall_shouldClampK_whenAskingMoreThanMaxK() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 0; i < 7; i++) {
            memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                    UUID.randomUUID(), "nap " + i, LocalDate.now().minusDays(i + 1),
                    MemoryEmbeddingPopulator.axisVector(0));
        }

        // max-k: 5 — a k=99 ask still returns at most 5
        assertThat(memoryRecallService.recallSimilarDays(owner, AXIS0_QUERY, 99)).hasSize(5);
    }
}
