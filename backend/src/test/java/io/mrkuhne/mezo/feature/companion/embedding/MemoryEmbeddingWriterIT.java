package io.mrkuhne.mezo.feature.companion.embedding;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** V2.2 embed pipeline: idempotent unit writes + the nightly catch-up over missed turns. */
@Transactional
@ActiveProfiles("companion-fake")
class MemoryEmbeddingWriterIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 6, 20);

    @Autowired private MemoryEmbeddingWriter memoryEmbeddingWriter;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private AiConversationPopulator aiConversationPopulator;
    @Autowired private AiMessagePopulator aiMessagePopulator;

    @Test
    void testWriteTurn_shouldPersistEmbedding_whenNewTurn() {
        UUID owner = userPopulator.createUser().getId();
        UUID refId = UUID.randomUUID();

        memoryEmbeddingWriter.writeTurn(owner, refId, "mit egyek?", "fehérjét", DAY);

        List<MemoryEmbeddingEntity> rows = memoryEmbeddingRepository.findAll();
        assertThat(rows).hasSize(1);
        MemoryEmbeddingEntity row = rows.getFirst();
        assertThat(row.getKind()).isEqualTo(MemoryEmbeddingEntity.KIND_CHAT_TURN);
        assertThat(row.getRefId()).isEqualTo(refId);
        assertThat(row.getContent()).isEqualTo("Daniel: mit egyek?\nMezo: fehérjét");
        assertThat(row.getOccurredOn()).isEqualTo(DAY);
        assertThat(row.getEmbedding()).hasSize(EmbeddingPort.DIMENSIONS);
    }

    @Test
    void testWriteTurn_shouldSkip_whenAlreadyEmbedded() {
        UUID owner = userPopulator.createUser().getId();
        UUID refId = UUID.randomUUID();
        memoryEmbeddingWriter.writeTurn(owner, refId, "kérdés", "válasz", DAY);

        memoryEmbeddingWriter.writeTurn(owner, refId, "kérdés", "válasz", DAY);

        assertThat(memoryEmbeddingRepository.findAll()).hasSize(1);
    }

    @Test
    void testWriteSummary_shouldPersistEmbedding_whenSummaryGiven() {
        UUID owner = userPopulator.createUser().getId();
        DailySummaryEntity summary = dailySummaryPopulator.summary(owner, DAY, "kemény leg-day volt");

        memoryEmbeddingWriter.writeSummary(summary);

        List<MemoryEmbeddingEntity> rows = memoryEmbeddingRepository.findAll();
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().getKind()).isEqualTo(MemoryEmbeddingEntity.KIND_DAILY_SUMMARY);
        assertThat(rows.getFirst().getRefId()).isEqualTo(summary.getId());
        assertThat(rows.getFirst().getContent()).isEqualTo("kemény leg-day volt");
        assertThat(rows.getFirst().getOccurredOn()).isEqualTo(DAY);
    }

    @Test
    void testWriteTurn_shouldCapContent_whenOverMaxChars() {
        UUID owner = userPopulator.createUser().getId();

        memoryEmbeddingWriter.writeTurn(owner, UUID.randomUUID(), "x".repeat(3000), "y", DAY);

        // embed-max-chars: 2000 — the stored content IS what got embedded, capped.
        assertThat(memoryEmbeddingRepository.findAll().getFirst().getContent()).hasSize(2000);
    }

    @Test
    void testCatchUpTurns_shouldEmbedMissedTurns_whenTurnsUnembedded() {
        UUID owner = userPopulator.createUser().getId();
        AiConversationEntity conversation = aiConversationPopulator.conversation(owner);
        aiMessagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "volt már ilyen napom?");
        AiMessageEntity assistant = aiMessagePopulator.message(
                conversation, AiMessageEntity.ROLE_ASSISTANT, "igen, június 20-án");

        memoryEmbeddingWriter.catchUpTurns(owner, Instant.now().minusSeconds(3600));
        memoryEmbeddingWriter.catchUpTurns(owner, Instant.now().minusSeconds(3600));

        List<MemoryEmbeddingEntity> rows = memoryEmbeddingRepository.findAll();
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().getRefId()).isEqualTo(assistant.getId());
        assertThat(rows.getFirst().getContent())
                .contains("volt már ilyen napom?").contains("igen, június 20-án");
    }
}
