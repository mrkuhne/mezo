package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.feature.companion.repository.PeriodSummaryRepository;
import io.mrkuhne.mezo.feature.companion.service.ConsolidationJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.PeriodSummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;

/**
 * The ladder cron's contract (mezo-b3pp.13): fills every finished period of the backfill window
 * that has source rows, embeds each rung, and is idempotent — a second run adds nothing. NOT
 * {@code @Transactional} — the job/service manage their own transactions (real commits).
 */
@ActiveProfiles("companion-fake")
class ConsolidationJobIT extends AbstractIntegrationTest {

    /** The newest week the job may touch: the ISO week that ended before the current one. */
    private static final LocalDate LAST_FINISHED_WEEK = LocalDate.now()
            .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);
    private static final LocalDate LAST_FINISHED_MONTH = LocalDate.now().withDayOfMonth(1).minusMonths(1);

    @Autowired private ConsolidationJob consolidationJob;
    @Autowired private PeriodSummaryRepository periodSummaryRepository;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private PeriodSummaryPopulator periodSummaryPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRunWeekly_shouldGenerateAndEmbedRung_whenTheFinishedWeekHasDays() {
        UUID owner = userPopulator.createUser().getId();
        dailySummaryPopulator.summary(owner, LAST_FINISHED_WEEK, "Hétfő volt.");
        dailySummaryPopulator.summary(owner, LAST_FINISHED_WEEK.plusDays(3), "Csütörtök volt.");

        consolidationJob.runWeekly();

        PeriodSummaryEntity rung = periodSummaryRepository
                .findByCreatedByAndGranularityAndPeriodStart(
                        owner, PeriodSummaryEntity.GRANULARITY_WEEK, LAST_FINISHED_WEEK)
                .orElseThrow();
        assertThat(rung.getSummaryText()).isEqualTo("FAKE-HETI-KONSZOLIDACIO");
        MemoryEmbeddingEntity vector = memoryEmbeddingRepository
                .findByKindAndRefId(MemoryEmbeddingEntity.KIND_WEEKLY_SUMMARY, rung.getId())
                .orElseThrow();
        assertThat(vector.getOccurredOn()).isEqualTo(LAST_FINISHED_WEEK);
    }

    @Test
    void testRunWeekly_shouldSkipWeeksWithoutDays_andNotTouchTheRunningWeek() {
        UUID owner = userPopulator.createUser().getId();
        dailySummaryPopulator.summary(owner, LAST_FINISHED_WEEK, "Lezárt hét napja.");
        dailySummaryPopulator.summary(owner, LAST_FINISHED_WEEK.plusWeeks(1), "Folyó hét napja.");

        consolidationJob.runWeekly();

        assertThat(periodSummaryRepository.findAll())
                .extracting(PeriodSummaryEntity::getPeriodStart)
                .containsExactly(LAST_FINISHED_WEEK);
    }

    @Test
    void testRunWeekly_shouldAddNothing_whenRunTwice() {
        UUID owner = userPopulator.createUser().getId();
        dailySummaryPopulator.summary(owner, LAST_FINISHED_WEEK, "Hétfő volt.");
        dailySummaryPopulator.summary(owner, LAST_FINISHED_WEEK.minusWeeks(2), "Két hete.");

        consolidationJob.runWeekly();
        consolidationJob.runWeekly();

        assertThat(periodSummaryRepository.findAll()).hasSize(2);
        assertThat(memoryEmbeddingRepository.countByCreatedByAndKind(
                owner, MemoryEmbeddingEntity.KIND_WEEKLY_SUMMARY)).isEqualTo(2);
    }

    @Test
    void testRunWeekly_shouldBackfillOlderWeeks_whenHistoryHasNoRungsYet() {
        UUID owner = userPopulator.createUser().getId();
        dailySummaryPopulator.summary(owner, LAST_FINISHED_WEEK.minusWeeks(3), "Régi nap.");
        dailySummaryPopulator.summary(owner, LAST_FINISHED_WEEK.minusWeeks(6), "Még régebbi nap.");
        // beyond the 8-week backfill window — must stay unconsolidated
        dailySummaryPopulator.summary(owner, LAST_FINISHED_WEEK.minusWeeks(20), "Ősrégi nap.");

        consolidationJob.runWeekly();

        assertThat(periodSummaryRepository.findAll())
                .extracting(PeriodSummaryEntity::getPeriodStart)
                .containsExactlyInAnyOrder(
                        LAST_FINISHED_WEEK.minusWeeks(3), LAST_FINISHED_WEEK.minusWeeks(6));
    }

    @Test
    void testRunWeekly_shouldKeepUsersSeparate_whenSeveralUsersHaveHistory() {
        UUID owner = userPopulator.createUser().getId();
        UUID other = userPopulator.createUser().getId();
        dailySummaryPopulator.summary(owner, LAST_FINISHED_WEEK, "Egyik nap.");
        dailySummaryPopulator.summary(other, LAST_FINISHED_WEEK, "Másik nap.");

        consolidationJob.runWeekly();

        assertThat(periodSummaryRepository.findAll())
                .extracting(PeriodSummaryEntity::getCreatedBy)
                .containsExactlyInAnyOrder(owner, other);
    }

    @Test
    void testRunMonthly_shouldGenerateAndEmbedMonthlyRung_whenTheMonthHasWeeks() {
        UUID owner = userPopulator.createUser().getId();
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_WEEK,
                LAST_FINISHED_MONTH.with(TemporalAdjusters.next(DayOfWeek.MONDAY)), "Heti szöveg.");

        consolidationJob.runMonthly();

        PeriodSummaryEntity rung = periodSummaryRepository
                .findByCreatedByAndGranularityAndPeriodStart(
                        owner, PeriodSummaryEntity.GRANULARITY_MONTH, LAST_FINISHED_MONTH)
                .orElseThrow();
        assertThat(rung.getSummaryText()).isEqualTo("FAKE-HAVI-KONSZOLIDACIO");
        assertThat(memoryEmbeddingRepository.existsByKindAndRefId(
                MemoryEmbeddingEntity.KIND_MONTHLY_SUMMARY, rung.getId())).isTrue();
    }

    @Test
    void testRunMonthly_shouldWriteNothing_whenNoWeeklyRungsExist() {
        UUID owner = userPopulator.createUser().getId();
        dailySummaryPopulator.summary(owner, LAST_FINISHED_WEEK, "Csak napi.");

        consolidationJob.runMonthly();

        assertThat(periodSummaryRepository.findAll()).isEmpty();
    }
}
