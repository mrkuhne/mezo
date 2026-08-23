package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.feature.companion.repository.PeriodSummaryRepository;
import io.mrkuhne.mezo.feature.companion.service.PeriodSummaryService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.PeriodSummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

/**
 * W3.2 rung generation (mezo-b3pp.13): the week condenses its daily summaries, the month condenses
 * its weeks, both idempotently — and an empty period produces no row at all.
 */
@Transactional
@ActiveProfiles("companion-fake")
class PeriodSummaryServiceIT extends AbstractIntegrationTest {

    private static final LocalDate MONDAY = LocalDate.of(2026, 8, 17);
    private static final LocalDate MONTH = LocalDate.of(2026, 8, 1);

    @Autowired private PeriodSummaryService periodSummaryService;
    @Autowired private PeriodSummaryRepository periodSummaryRepository;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private PeriodSummaryPopulator periodSummaryPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testGenerateWeek_shouldCondenseTheWeeksDays_whenDailySummariesExist() {
        UUID owner = userPopulator.createUser().getId();
        dailySummaryPopulator.summary(owner, MONDAY, "Hétfő: leg day.");
        dailySummaryPopulator.summary(owner, MONDAY.plusDays(2), "Szerda: pihenő. [fake-period:Erős hét volt.]");
        dailySummaryPopulator.summary(owner, MONDAY.plusDays(6), "Vasárnap: hosszú futás.");
        // the NEXT week's day must not leak into this rung
        dailySummaryPopulator.summary(owner, MONDAY.plusDays(7), "Következő hétfő.");

        PeriodSummaryEntity week = periodSummaryService.generateWeek(owner, MONDAY);

        assertThat(week).isNotNull();
        assertThat(week.getGranularity()).isEqualTo(PeriodSummaryEntity.GRANULARITY_WEEK);
        assertThat(week.getPeriodStart()).isEqualTo(MONDAY);
        assertThat(week.getSummaryText()).isEqualTo("Erős hét volt.");
    }

    @Test
    void testGenerateWeek_shouldReturnExistingRowUntouched_whenWeekAlreadyConsolidated() {
        UUID owner = userPopulator.createUser().getId();
        dailySummaryPopulator.summary(owner, MONDAY, "Hétfő: leg day.");
        PeriodSummaryEntity first = periodSummaryPopulator.periodSummary(
                owner, PeriodSummaryEntity.GRANULARITY_WEEK, MONDAY, "Korábbi szöveg.");

        PeriodSummaryEntity again = periodSummaryService.generateWeek(owner, MONDAY);

        assertThat(again.getId()).isEqualTo(first.getId());
        assertThat(again.getSummaryText()).isEqualTo("Korábbi szöveg.");
        assertThat(periodSummaryRepository.findAll()).hasSize(1);
    }

    @Test
    void testGenerateWeek_shouldWriteNoRow_whenTheWeekHasNoDailySummaries() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(periodSummaryService.generateWeek(owner, MONDAY)).isNull();
        assertThat(periodSummaryRepository.findAll()).isEmpty();
    }

    @Test
    void testGenerateWeek_shouldSeeOnlyItsOwnUsersDays_whenAnotherUserHasSummaries() {
        UUID owner = userPopulator.createUser().getId();
        UUID other = userPopulator.createUser().getId();
        dailySummaryPopulator.summary(other, MONDAY, "Másik felhasználó napja.");

        assertThat(periodSummaryService.generateWeek(owner, MONDAY)).isNull();
    }

    @Test
    void testGenerateMonth_shouldCondenseTheMonthsWeeks_whenWeekRungsExist() {
        UUID owner = userPopulator.createUser().getId();
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_WEEK,
                LocalDate.of(2026, 8, 3), "Első hét. [fake-period:Augusztus íve.]");
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_WEEK,
                LocalDate.of(2026, 8, 10), "Második hét.");
        // a week rung outside the month must not leak in
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_WEEK,
                LocalDate.of(2026, 9, 7), "Szeptemberi hét.");

        PeriodSummaryEntity month = periodSummaryService.generateMonth(owner, MONTH);

        assertThat(month).isNotNull();
        assertThat(month.getGranularity()).isEqualTo(PeriodSummaryEntity.GRANULARITY_MONTH);
        assertThat(month.getPeriodStart()).isEqualTo(MONTH);
        assertThat(month.getSummaryText()).isEqualTo("Augusztus íve.");
    }

    @Test
    void testGenerateMonth_shouldWriteNoRow_whenTheMonthHasNoWeekRungs() {
        UUID owner = userPopulator.createUser().getId();
        dailySummaryPopulator.summary(owner, MONDAY, "Van napi, de nincs heti.");

        assertThat(periodSummaryService.generateMonth(owner, MONTH)).isNull();
        assertThat(periodSummaryRepository.findAll()).isEmpty();
    }

    @Test
    void testGenerateWeek_shouldWriteNoRow_whenTheModelAnswersBlank() {
        UUID owner = userPopulator.createUser().getId();
        dailySummaryPopulator.summary(owner, MONDAY, "Hétfő. [fake-period:   ]");

        assertThat(periodSummaryService.generateWeek(owner, MONDAY)).isNull();
        assertThat(periodSummaryRepository.findAll()).isEmpty();
    }
}
