package io.mrkuhne.mezo.feature.companion.embedding;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
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
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

/** V2.2 embed pipeline: idempotent unit writes, message-derived dating, replace-by-day. */
@Transactional
@ActiveProfiles("companion-fake")
class MemoryEmbeddingWriterIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 6, 20);

    @Autowired private MemoryEmbeddingWriter memoryEmbeddingWriter;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private DailySummaryRepository dailySummaryRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private AiConversationPopulator aiConversationPopulator;
    @Autowired private AiMessagePopulator aiMessagePopulator;

    @Test
    void testEmbedTurnByMessageId_shouldPersistTurnUnit_whenNewTurn() {
        UUID owner = userPopulator.createUser().getId();
        AiConversationEntity conversation = aiConversationPopulator.conversation(owner);
        aiMessagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "mit egyek?");
        AiMessageEntity assistant = aiMessagePopulator.message(
                conversation, AiMessageEntity.ROLE_ASSISTANT, "fehérjét");

        memoryEmbeddingWriter.embedTurnByMessageId(assistant.getId());

        List<MemoryEmbeddingEntity> rows = memoryEmbeddingRepository.findAll();
        assertThat(rows).hasSize(1);
        MemoryEmbeddingEntity row = rows.getFirst();
        assertThat(row.getKind()).isEqualTo(MemoryEmbeddingEntity.KIND_CHAT_TURN);
        assertThat(row.getRefId()).isEqualTo(assistant.getId());
        assertThat(row.getContent()).isEqualTo("Daniel: mit egyek?\nMezo: fehérjét");
        // occurred_on = the episode's day (the assistant row's creation day), never the embed day
        assertThat(row.getOccurredOn())
                .isEqualTo(LocalDate.ofInstant(assistant.getCreatedAt(), ZoneId.systemDefault()));
        assertThat(row.getEmbedding()).hasSize(EmbeddingPort.DIMENSIONS);
    }

    @Test
    void testEmbedTurnByMessageId_shouldSkip_whenAlreadyEmbedded() {
        UUID owner = userPopulator.createUser().getId();
        AiConversationEntity conversation = aiConversationPopulator.conversation(owner);
        aiMessagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "kérdés");
        AiMessageEntity assistant = aiMessagePopulator.message(
                conversation, AiMessageEntity.ROLE_ASSISTANT, "válasz");
        memoryEmbeddingWriter.embedTurnByMessageId(assistant.getId());

        memoryEmbeddingWriter.embedTurnByMessageId(assistant.getId());

        assertThat(memoryEmbeddingRepository.findAll()).hasSize(1);
    }

    @Test
    void testEmbedTurnByMessageId_shouldNoOp_whenIdIsNotAnAssistantRow() {
        UUID owner = userPopulator.createUser().getId();
        AiConversationEntity conversation = aiConversationPopulator.conversation(owner);
        AiMessageEntity userRow = aiMessagePopulator.message(
                conversation, AiMessageEntity.ROLE_USER, "csak kérdés");

        memoryEmbeddingWriter.embedTurnByMessageId(userRow.getId());
        memoryEmbeddingWriter.embedTurnByMessageId(UUID.randomUUID());

        assertThat(memoryEmbeddingRepository.findAll()).isEmpty();
    }

    @Test
    void testEmbedTurnByMessageId_shouldCapContent_whenOverMaxChars() {
        UUID owner = userPopulator.createUser().getId();
        AiConversationEntity conversation = aiConversationPopulator.conversation(owner);
        aiMessagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "x".repeat(3000));
        AiMessageEntity assistant = aiMessagePopulator.message(
                conversation, AiMessageEntity.ROLE_ASSISTANT, "y");

        memoryEmbeddingWriter.embedTurnByMessageId(assistant.getId());

        // embed-max-chars: 2000 — the stored content IS what got embedded, capped.
        assertThat(memoryEmbeddingRepository.findAll().getFirst().getContent()).hasSize(2000);
    }

    @Test
    void testWriteSummary_shouldPersistEmbedding_whenSummaryGiven() {
        UUID owner = userPopulator.createUser().getId();
        DailySummaryEntity summary = dailySummaryPopulator.summary(owner, DAY, "kemény leg-day volt");

        memoryEmbeddingWriter.writeSummary(summary);
        memoryEmbeddingWriter.writeSummary(summary);

        List<MemoryEmbeddingEntity> rows = memoryEmbeddingRepository.findAll();
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().getKind()).isEqualTo(MemoryEmbeddingEntity.KIND_DAILY_SUMMARY);
        assertThat(rows.getFirst().getRefId()).isEqualTo(summary.getId());
        assertThat(rows.getFirst().getContent()).isEqualTo("kemény leg-day volt");
        assertThat(rows.getFirst().getOccurredOn()).isEqualTo(DAY);
    }

    @Test
    void testWriteSummary_shouldReplaceStaleEmbedding_whenSummaryRegeneratedForSameDay() {
        UUID owner = userPopulator.createUser().getId();
        DailySummaryEntity original = dailySummaryPopulator.summary(owner, DAY, "első verzió");
        memoryEmbeddingWriter.writeSummary(original);
        // The regeneration path: soft-delete the summary row, a new one is generated for the day.
        dailySummaryRepository.delete(original);
        dailySummaryRepository.flush();
        DailySummaryEntity regenerated = dailySummaryPopulator.summary(owner, DAY, "második verzió");

        memoryEmbeddingWriter.writeSummary(regenerated);

        List<MemoryEmbeddingEntity> live = memoryEmbeddingRepository
                .findByCreatedByAndKindAndOccurredOn(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, DAY);
        assertThat(live).hasSize(1);
        assertThat(live.getFirst().getRefId()).isEqualTo(regenerated.getId());
        assertThat(live.getFirst().getContent()).isEqualTo("második verzió");
    }

    @Test
    void testFindUnembeddedTurnIds_shouldListOnlyMissingAssistantRows_whenSomeEmbedded() {
        UUID owner = userPopulator.createUser().getId();
        AiConversationEntity conversation = aiConversationPopulator.conversation(owner);
        aiMessagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "első kérdés");
        AiMessageEntity embedded = aiMessagePopulator.message(
                conversation, AiMessageEntity.ROLE_ASSISTANT, "első válasz");
        aiMessagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "második kérdés");
        AiMessageEntity missing = aiMessagePopulator.message(
                conversation, AiMessageEntity.ROLE_ASSISTANT, "második válasz");
        memoryEmbeddingWriter.embedTurnByMessageId(embedded.getId());

        List<UUID> ids = memoryEmbeddingWriter.findUnembeddedTurnIds(owner, Instant.now().minusSeconds(3600));

        assertThat(ids).containsExactly(missing.getId());
    }
}
