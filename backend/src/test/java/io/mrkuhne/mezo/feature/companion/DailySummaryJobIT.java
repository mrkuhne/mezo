package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.service.DailySummaryJob;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * The nightly job's contract: fills every missing finished day in the catch-up window
 * (idempotently), self-heals un-embedded turns, and isolates a failing date. NOT
 * {@code @Transactional} — the job/service manage their own transactions (real commits).
 */
@ActiveProfiles("companion-fake")
class DailySummaryJobIT extends AbstractIntegrationTest {

    @Autowired private DailySummaryJob dailySummaryJob;
    @Autowired private DailySummaryRepository dailySummaryRepository;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private AiConversationPopulator aiConversationPopulator;
    @Autowired private AiMessagePopulator aiMessagePopulator;

    @Test
    void testRun_shouldGenerateAndEmbedMissingDays_whenWindowHasData() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        weightLogPopulator.createWeightLog(owner, yesterday, new BigDecimal("104.5"));
        weightLogPopulator.createWeightLog(owner, yesterday.minusDays(2), new BigDecimal("104.9"));

        dailySummaryJob.run();

        assertThat(dailySummaryRepository.findByCreatedByAndSummaryDate(owner, yesterday)).isPresent();
        assertThat(dailySummaryRepository.findByCreatedByAndSummaryDate(owner, yesterday.minusDays(2))).isPresent();
        assertThat(memoryEmbeddingRepository.findAll().stream()
                .filter(e -> MemoryEmbeddingEntity.KIND_DAILY_SUMMARY.equals(e.getKind())))
                .hasSize(2);
    }

    @Test
    void testRun_shouldBeIdempotent_whenRunTwice() {
        UUID owner = userPopulator.createUser().getId();
        weightLogPopulator.createWeightLog(owner, LocalDate.now().minusDays(1), new BigDecimal("104.5"));

        dailySummaryJob.run();
        long summaries = dailySummaryRepository.count();
        long embeddings = memoryEmbeddingRepository.count();
        dailySummaryJob.run();

        assertThat(dailySummaryRepository.count()).isEqualTo(summaries);
        assertThat(memoryEmbeddingRepository.count()).isEqualTo(embeddings);
    }

    @Test
    void testRun_shouldCatchUpUnembeddedTurns_whenTurnsExist() {
        UUID owner = userPopulator.createUser().getId();
        AiConversationEntity conversation = aiConversationPopulator.conversation(owner);
        aiMessagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "mi volt tegnap?");
        AiMessageEntity assistant = aiMessagePopulator.message(
                conversation, AiMessageEntity.ROLE_ASSISTANT, "leg-day volt");

        dailySummaryJob.run();

        assertThat(memoryEmbeddingRepository.existsByKindAndRefId(
                MemoryEmbeddingEntity.KIND_CHAT_TURN, assistant.getId())).isTrue();
    }

    @Test
    void testRun_shouldIsolateFailingDate_whenLlmFailsForOneDay() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        weightLogPopulator.createWeightLog(owner, yesterday, new BigDecimal("104.5"));
        // Scripted LLM failure for the older day only — the run must survive and do the rest.
        checkInPopulator.createCheckIn(owner, yesterday.minusDays(2), "08:00", 3, 3, "[fake-fail]");

        assertThatCode(() -> dailySummaryJob.run()).doesNotThrowAnyException();

        assertThat(dailySummaryRepository.findByCreatedByAndSummaryDate(owner, yesterday)).isPresent();
        assertThat(dailySummaryRepository.findByCreatedByAndSummaryDate(owner, yesterday.minusDays(2))).isEmpty();
    }
}
