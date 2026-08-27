package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MemoryEmbeddingKindCount;
import io.mrkuhne.mezo.api.dto.MemoryFactSourceCount;
import io.mrkuhne.mezo.api.dto.MemoryOverviewResponse;
import io.mrkuhne.mezo.api.dto.MemoryPatternCount;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/** A memória-obszervatórium áttekintés HTTP-kontraktusa (mezo-al1i) — rétegszámok, config-echo, izoláció. */
class CompanionMemoryOverviewApiIT extends ApiIntegrationTest {

    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private LearnedFactPopulator learnedFactPopulator;
    @Autowired private KnowledgeFactPopulator knowledgeFactPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private MemoryOverviewResponse overview() {
        return getForBody("/api/companion/memory/overview", ownerAuthHeaders(),
                HttpStatus.OK, MemoryOverviewResponse.class);
    }

    @Test
    void testGetMemoryOverview_shouldReturnZerosAndConfigEcho_whenUserHasNoData() {
        MemoryOverviewResponse response = overview();

        assertThat(response.getL0().getDaysWithAnyData()).isZero();
        assertThat(response.getL0().getWindowDays()).isEqualTo(60);
        assertThat(response.getL1().getSummaryCount()).isZero();
        assertThat(response.getL1().getFirstDate()).isNull();
        assertThat(response.getL1().getLastDate()).isNull();
        assertThat(response.getL1().getEmbeddings()).isEmpty();
        assertThat(response.getL2().getPatterns()).isEmpty();
        assertThat(response.getL2().getPendingFactCandidates()).isZero();
        assertThat(response.getL3().getFacts()).isEmpty();
        assertThat(response.getL3().getTotalReinforcements()).isZero();
        assertThat(response.getL3().getFactsInPrompt()).isZero();
        assertThat(response.getJobs().getSummaryCron()).isEqualTo("0 20 2 * * *");
        assertThat(response.getJobs().getPatternCron()).isEqualTo("0 40 2 * * *");
        assertThat(response.getJobs().getHypothesisCron()).isEqualTo("0 0 3 * * SUN");
        assertThat(response.getJobs().getLastSummaryDate()).isNull();
        assertThat(response.getJobs().getLastDetectedAt()).isNull();
    }

    @Test
    void testGetMemoryOverview_shouldCountEveryLayer_whenAllLayersPopulated() {
        UUID owner = ownerId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        // L0: két alvás-nap a minta-ablakban (sleep-quality + sleep-duration széria — unió: 2 nap)
        sleepLogPopulator.createSleepLog(owner, yesterday, new BigDecimal("7.5"), 4);
        sleepLogPopulator.createSleepLog(owner, yesterday.minusDays(2), new BigDecimal("6.0"), 3);
        // L1: két összefoglaló, az egyik vektorizálva + egy chat-turn vektor
        DailySummaryEntity embedded = dailySummaryPopulator.summary(owner, yesterday);
        dailySummaryPopulator.summary(owner, yesterday.minusDays(1));
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                embedded.getId(), "n", yesterday, MemoryEmbeddingPopulator.axisVector(0));
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN,
                UUID.randomUUID(), "t", yesterday, MemoryEmbeddingPopulator.axisVector(1));
        // L2: két statisztikai minta + egy függő jelölt
        patternPopulator.statistical(owner, "a~b", PatternEntity.STATUS_CONFIRMED);
        patternPopulator.statistical(owner, "c~d", PatternEntity.STATUS_PROPOSED);
        learnedFactPopulator.candidate(owner, "függő jelölt", null);
        // L3: chat- és minta-forrású tény (3 + 2 megerősítés, az utóbbi nincs a promptban)
        knowledgeFactPopulator.fact(owner, "tény1", "train", 3, true, KnowledgeFactEntity.SOURCE_CHAT);
        knowledgeFactPopulator.fact(owner, "tény2", "health", 2, false, KnowledgeFactEntity.SOURCE_PATTERN);

        MemoryOverviewResponse response = overview();

        assertThat(response.getL0().getDaysWithAnyData()).isEqualTo(2);
        assertThat(response.getL1().getSummaryCount()).isEqualTo(2);
        assertThat(response.getL1().getFirstDate()).isEqualTo(yesterday.minusDays(1));
        assertThat(response.getL1().getLastDate()).isEqualTo(yesterday);
        assertThat(response.getL1().getEmbeddings())
                .extracting(MemoryEmbeddingKindCount::getKind, MemoryEmbeddingKindCount::getCount)
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple("daily_summary", 1),
                        org.assertj.core.groups.Tuple.tuple("chat_turn", 1));
        assertThat(response.getL2().getPatterns())
                .extracting(MemoryPatternCount::getKind, MemoryPatternCount::getStatus, MemoryPatternCount::getCount)
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple("statistical", "confirmed", 1),
                        org.assertj.core.groups.Tuple.tuple("statistical", "proposed", 1));
        assertThat(response.getL2().getPendingFactCandidates()).isEqualTo(1);
        assertThat(response.getL3().getFacts())
                .extracting(MemoryFactSourceCount::getSource, MemoryFactSourceCount::getCount)
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple("chat", 1),
                        org.assertj.core.groups.Tuple.tuple("pattern", 1));
        assertThat(response.getL3().getTotalReinforcements()).isEqualTo(5);
        assertThat(response.getL3().getFactsInPrompt()).isEqualTo(1);
        assertThat(response.getJobs().getLastSummaryDate()).isEqualTo(yesterday);
        assertThat(response.getJobs().getLastDetectedAt()).isNotNull();
    }

    @Test
    void testGetMemoryOverview_shouldIgnoreForeignRows_whenAnotherUserHasMemory() {
        UUID foreign = userPopulator.createUser().getId();
        dailySummaryPopulator.summary(foreign, LocalDate.now().minusDays(1));
        knowledgeFactPopulator.fact(foreign, "idegen tény", "life", 9);

        MemoryOverviewResponse response = overview();

        assertThat(response.getL1().getSummaryCount()).isZero();
        assertThat(response.getL3().getFacts()).isEmpty();
    }

    @Test
    void testOverview_shouldReportEveryPopulatedKind_whenSeveralNarrativeKindsHaveVectors() {
        UUID owner = ownerId();
        LocalDate day = LocalDate.now().minusDays(1);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, day, 0);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, day, 1);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, day, 2);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, day, 3);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, day, 4);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, day, 5);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_GRATITUDE, day, 6);

        MemoryOverviewResponse response = overview();

        assertThat(response.getL1().getEmbeddings())
                .extracting(MemoryEmbeddingKindCount::getKind, MemoryEmbeddingKindCount::getCount)
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple("daily_summary", 2),
                        org.assertj.core.groups.Tuple.tuple("chat_turn", 3),
                        org.assertj.core.groups.Tuple.tuple("journal_entry", 1),
                        org.assertj.core.groups.Tuple.tuple("gratitude", 1));
    }

    @Test
    void testOverview_shouldOrderKindsByCountThenKind_whenSeveralKindsArePopulated() {
        UUID owner = ownerId();
        LocalDate day = LocalDate.now().minusDays(1);
        // chat_turn (3) leads on count desc; gratitude and journal_entry tie at 1 and must
        // break the tie alphabetically (kind asc): gratitude before journal_entry.
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, day, 0);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, day, 1);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, day, 2);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_GRATITUDE, day, 3);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, day, 4);

        MemoryOverviewResponse response = overview();

        assertThat(response.getL1().getEmbeddings())
                .extracting(MemoryEmbeddingKindCount::getKind, MemoryEmbeddingKindCount::getCount)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("chat_turn", 3),
                        org.assertj.core.groups.Tuple.tuple("gratitude", 1),
                        org.assertj.core.groups.Tuple.tuple("journal_entry", 1));
    }

    @Test
    void testOverview_shouldOmitKindsWithNoVectors_whenTheStoreIsPartiallyPopulated() {
        UUID owner = ownerId();
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                LocalDate.now().minusDays(1), 0);

        MemoryOverviewResponse response = overview();

        assertThat(response.getL1().getEmbeddings())
                .extracting(MemoryEmbeddingKindCount::getKind)
                .doesNotContain(MemoryEmbeddingEntity.KIND_CHAT_TURN, MemoryEmbeddingEntity.KIND_GRATITUDE);
    }

    @Test
    void testOverview_shouldCountOnlyTheOwner_whenAnotherUserHasVectors() {
        UUID owner = ownerId();
        UUID foreign = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(1);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, day, 0);
        memoryEmbeddingPopulator.embedding(foreign, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, day, 1);
        memoryEmbeddingPopulator.embedding(foreign, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, day, 2);

        MemoryOverviewResponse response = overview();

        assertThat(response.getL1().getEmbeddings())
                .extracting(MemoryEmbeddingKindCount::getKind, MemoryEmbeddingKindCount::getCount)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("daily_summary", 1));
    }

    @Test
    void testOverview_shouldIgnoreSoftDeletedVectors_whenSomeWereReaped() {
        UUID owner = ownerId();
        LocalDate day = LocalDate.now().minusDays(1);
        MemoryEmbeddingEntity kept = memoryEmbeddingPopulator.embedding(owner,
                MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, day, 0);
        MemoryEmbeddingEntity reaped = memoryEmbeddingPopulator.embedding(owner,
                MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, day, 1);
        memoryEmbeddingRepository.delete(reaped);

        MemoryOverviewResponse response = overview();

        assertThat(response.getL1().getEmbeddings())
                .extracting(MemoryEmbeddingKindCount::getKind, MemoryEmbeddingKindCount::getCount)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("daily_summary", 1));
        assertThat(memoryEmbeddingRepository
                .findByKindAndRefIdIncludingDeleted(MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, reaped.getRefId()))
                .isPresent();
        assertThat(kept).isNotNull();
    }

    @Test
    void testOverview_shouldReturnAnEmptyList_whenTheUserHasNoVectors() {
        MemoryOverviewResponse response = overview();

        assertThat(response.getL1().getEmbeddings()).isNotNull().isEmpty();
    }
}
