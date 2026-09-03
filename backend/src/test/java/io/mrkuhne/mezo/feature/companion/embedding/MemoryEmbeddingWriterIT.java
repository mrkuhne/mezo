package io.mrkuhne.mezo.feature.companion.embedding;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.journal.entity.GratitudeEntryEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.PeriodSummaryPopulator;
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
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private PeriodSummaryPopulator periodSummaryPopulator;

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
        assertThat(row.getContent()).isEqualTo("Felhasználó: mit egyek?\nMezo: fehérjét");
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

    @Test
    void testWriteJournal_shouldPersistJournalUnit_whenNewEntry() {
        UUID owner = userPopulator.createUser().getId();
        JournalEntryEntity entry = journalPopulator.createEntry(owner, DAY, "Ma jó napom volt.",
                JournalEntryEntity.SOURCE_QUICKINPUT);

        memoryEmbeddingWriter.writeJournal(entry);

        List<MemoryEmbeddingEntity> rows = memoryEmbeddingRepository.findAll();
        assertThat(rows).hasSize(1);
        MemoryEmbeddingEntity row = rows.getFirst();
        assertThat(row.getKind()).isEqualTo(MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY);
        assertThat(row.getRefId()).isEqualTo(entry.getId());
        assertThat(row.getContent()).isEqualTo(entry.getText());
        assertThat(row.getOccurredOn()).isEqualTo(entry.getOccurredOn());
        assertThat(row.getEmbedding()).hasSize(EmbeddingPort.DIMENSIONS);
    }

    @Test
    void testWriteJournal_shouldReembedInPlace_whenEntryEdited() {
        UUID owner = userPopulator.createUser().getId();
        JournalEntryEntity entry = journalPopulator.createEntry(owner, DAY, "Eredeti szöveg.",
                JournalEntryEntity.SOURCE_QUICKINPUT);
        memoryEmbeddingWriter.writeJournal(entry);
        MemoryEmbeddingEntity original = memoryEmbeddingRepository.findAll().getFirst();
        UUID originalRowId = original.getId();
        float[] originalEmbedding = original.getEmbedding();

        entry.setText("Módosított szöveg.");
        entry.setOccurredOn(DAY.plusDays(1));
        memoryEmbeddingWriter.writeJournal(entry);

        List<MemoryEmbeddingEntity> rows = memoryEmbeddingRepository.findAll();
        assertThat(rows).hasSize(1);
        MemoryEmbeddingEntity row = rows.getFirst();
        assertThat(row.getId()).isEqualTo(originalRowId);
        assertThat(row.getContent()).isEqualTo("Módosított szöveg.");
        assertThat(row.getOccurredOn()).isEqualTo(DAY.plusDays(1));
        // The fake embedding adapter is deterministic per input text (seeded Random(text.hashCode())),
        // so distinct texts must yield distinct vectors — proves the re-embed actually re-embedded,
        // not just re-stamped content/occurredOn on a stale vector.
        assertThat(row.getEmbedding()).hasSize(EmbeddingPort.DIMENSIONS);
        assertThat(row.getEmbedding()).isNotEqualTo(originalEmbedding);
    }

    @Test
    void testDeleteJournalEmbedding_shouldSoftDeleteRow_whenPresent() {
        UUID owner = userPopulator.createUser().getId();
        JournalEntryEntity entry = journalPopulator.createEntry(owner, DAY, "Törlendő bejegyzés.",
                JournalEntryEntity.SOURCE_QUICKINPUT);
        memoryEmbeddingWriter.writeJournal(entry);

        memoryEmbeddingWriter.deleteJournalEmbedding(entry.getId());

        assertThat(memoryEmbeddingRepository
                .findByKindAndRefId(MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, entry.getId()))
                .isEmpty();
    }

    @Test
    void testWriteDecision_shouldPersistDecisionUnit_whenNewEntry() {
        UUID owner = userPopulator.createUser().getId();
        DecisionEntryEntity decision = journalPopulator.createDecision(owner, DAY,
                "Váltok esti edzésre.", DAY.plusDays(30), "ctx");

        memoryEmbeddingWriter.writeDecision(decision);

        List<MemoryEmbeddingEntity> rows = memoryEmbeddingRepository.findAll();
        assertThat(rows).hasSize(1);
        MemoryEmbeddingEntity row = rows.getFirst();
        assertThat(row.getKind()).isEqualTo(MemoryEmbeddingEntity.KIND_DECISION);
        assertThat(row.getRefId()).isEqualTo(decision.getId());
        // No outcome yet — content is the decision text alone, no "Kimenet" suffix.
        assertThat(row.getContent()).isEqualTo(decision.getDecisionText());
        assertThat(row.getOccurredOn()).isEqualTo(decision.getDecidedOn());
        assertThat(row.getEmbedding()).hasSize(EmbeddingPort.DIMENSIONS);
    }

    @Test
    void testWriteDecision_shouldReembedInPlace_whenReviewed() {
        UUID owner = userPopulator.createUser().getId();
        DecisionEntryEntity decision = journalPopulator.createDecision(owner, DAY,
                "Esti edzésre váltok.", DAY.plusDays(30), "ctx");
        memoryEmbeddingWriter.writeDecision(decision);
        MemoryEmbeddingEntity original = memoryEmbeddingRepository.findAll().getFirst();
        UUID originalRowId = original.getId();
        float[] originalEmbedding = original.getEmbedding();

        decision.setOutcomeRating((short) 4);
        decision.setOutcomeText("Jobban aludtam tőle.");
        memoryEmbeddingWriter.writeDecision(decision);

        List<MemoryEmbeddingEntity> rows = memoryEmbeddingRepository.findAll();
        assertThat(rows).hasSize(1);
        MemoryEmbeddingEntity row = rows.getFirst();
        assertThat(row.getId()).isEqualTo(originalRowId);
        assertThat(row.getContent()).isEqualTo(
                "Esti edzésre váltok.\n\nKimenet (4/5): Jobban aludtam tőle.");
        // The fake embedding adapter is deterministic per input text (seeded Random(text.hashCode())),
        // so distinct content must yield a distinct vector — proves the re-embed actually re-embedded,
        // not just re-stamped content on a stale vector (the testWriteJournal_shouldReembedInPlace_*
        // precedent above).
        assertThat(row.getEmbedding()).hasSize(EmbeddingPort.DIMENSIONS);
        assertThat(row.getEmbedding()).isNotEqualTo(originalEmbedding);
    }

    @Test
    void testWriteGratitude_shouldCreateOneRow_whenFirstWrite() {
        UUID owner = userPopulator.createUser().getId();
        GratitudeEntryEntity entry = journalPopulator.createGratitude(owner, DAY,
                "hála a csendért", "mindfulness");

        memoryEmbeddingWriter.writeGratitude(entry);

        assertThat(memoryEmbeddingRepository.findByKindAndRefId(MemoryEmbeddingEntity.KIND_GRATITUDE, entry.getId()))
                .isPresent();
    }

    @Test
    void testDeleteGratitudeEmbedding_shouldRemoveRow_whenPresent() {
        UUID owner = userPopulator.createUser().getId();
        GratitudeEntryEntity entry = journalPopulator.createGratitude(owner, DAY, "x", null);
        memoryEmbeddingWriter.writeGratitude(entry);

        memoryEmbeddingWriter.deleteGratitudeEmbedding(entry.getId());

        assertThat(memoryEmbeddingRepository.findByKindAndRefId(MemoryEmbeddingEntity.KIND_GRATITUDE, entry.getId()))
                .isEmpty();
    }

    @Test
    void testWritePeriodSummary_shouldEmbedWeeklyUnitAtPeriodStart_whenGranularityIsWeek() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate monday = LocalDate.of(2026, 8, 17);
        PeriodSummaryEntity week = periodSummaryPopulator.periodSummary(
                owner, PeriodSummaryEntity.GRANULARITY_WEEK, monday, "Három edzés, stabil alvás.");

        memoryEmbeddingWriter.writePeriodSummary(week);

        MemoryEmbeddingEntity row = memoryEmbeddingRepository
                .findByKindAndRefId(MemoryEmbeddingEntity.KIND_WEEKLY_SUMMARY, week.getId())
                .orElseThrow();
        assertThat(row.getCreatedBy()).isEqualTo(owner);
        assertThat(row.getOccurredOn()).isEqualTo(monday);
        assertThat(row.getContent()).isEqualTo("Három edzés, stabil alvás.");
        assertThat(row.getEmbedding()).hasSize(EmbeddingPort.DIMENSIONS);
    }

    @Test
    void testWritePeriodSummary_shouldEmbedMonthlyUnit_whenGranularityIsMonth() {
        UUID owner = userPopulator.createUser().getId();
        PeriodSummaryEntity month = periodSummaryPopulator.periodSummary(
                owner, PeriodSummaryEntity.GRANULARITY_MONTH, LocalDate.of(2026, 7, 1), "Júliusi ív.");

        memoryEmbeddingWriter.writePeriodSummary(month);

        assertThat(memoryEmbeddingRepository.existsByKindAndRefId(
                MemoryEmbeddingEntity.KIND_MONTHLY_SUMMARY, month.getId())).isTrue();
        assertThat(memoryEmbeddingRepository.countByCreatedByAndKind(
                owner, MemoryEmbeddingEntity.KIND_WEEKLY_SUMMARY)).isZero();
    }

    @Test
    void testWritePeriodSummary_shouldRefreshVectorInPlace_whenPeriodTextChanged() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate monday = LocalDate.of(2026, 8, 17);
        PeriodSummaryEntity week = periodSummaryPopulator.periodSummary(
                owner, PeriodSummaryEntity.GRANULARITY_WEEK, monday, "Első változat.");
        memoryEmbeddingWriter.writePeriodSummary(week);

        week.setSummaryText("Javított változat.");
        memoryEmbeddingWriter.writePeriodSummary(week);

        assertThat(memoryEmbeddingRepository.countByCreatedByAndKind(
                owner, MemoryEmbeddingEntity.KIND_WEEKLY_SUMMARY)).isEqualTo(1);
        assertThat(memoryEmbeddingRepository
                .findByKindAndRefId(MemoryEmbeddingEntity.KIND_WEEKLY_SUMMARY, week.getId())
                .orElseThrow().getContent()).isEqualTo("Javított változat.");
    }
}
