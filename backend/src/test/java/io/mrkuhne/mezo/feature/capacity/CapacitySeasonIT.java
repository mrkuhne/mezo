package io.mrkuhne.mezo.feature.capacity;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CapacitySeasonLoad;
import io.mrkuhne.mezo.api.dto.CapacitySeasonWeek;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.season.SeasonFixture;
import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import io.mrkuhne.mezo.feature.wearable.entity.CalendarEventEntity;
import io.mrkuhne.mezo.feature.wearable.repository.CalendarEventRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.CalendarEventPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;

/**
 * Boop B7 K2 Task 10 (mezo-r36n9.17): {@code GET /api/capacity/season}. The clock is pinned to Monday 2026-11-23 07:00
 * (owner zone) and the season starts 2026-11-02, so that Monday opens week 4 of 8: weeks 1-3 are past, week 4 is the
 * current one, weeks 5-8 are planned. All numbers invented.
 */
@Import({CapacitySeasonIT.PinnedClockConfig.class, SeasonFixture.class})
class CapacitySeasonIT extends ApiIntegrationTest {

    private static final LocalDate NOW = LocalDate.of(2026, 11, 23);
    private static final LocalDate START = LocalDate.of(2026, 11, 2);
    private static final ZoneId BUD = ZoneId.of("Europe/Budapest");

    @TestConfiguration
    static class PinnedClockConfig {
        @Bean
        Clock capacitySeasonTestClock() {
            return Clock.fixed(NOW.atTime(7, 0).atZone(BUD).toInstant(), BUD);
        }
    }

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private SeasonFixture fixture;
    @Autowired private SeasonRepository seasonRepository;
    @Autowired private CalendarEventPopulator calendarPopulator;
    @Autowired private CalendarEventRepository calendarEvents;
    @Autowired private SleepLogPopulator sleepPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private UUID ownerWithSeason() {
        return ownerWithSeason(START);
    }

    private UUID ownerWithSeason(LocalDate start) {
        UUID owner = fixture.owner(ownerProperties.ownerEmail());
        SeasonDraftJson d = SeasonFixture.draft();
        SeasonEntity s = fixture.plannedSeason(owner, d);
        s.setStatus(SeasonEntity.STATUS_ACTIVE);
        s.setStartDate(start);
        s.setWeeks(8);
        seasonRepository.saveAndFlush(s);
        return owner;
    }

    private void packedDay(UUID owner, LocalDate day) {
        for (String[] span : new String[][] {{"08:00", "12:00"}, {"13:00", "17:00"}}) {
            CalendarEventEntity e = calendarPopulator.createEvent(owner, day, "Egyeztetés " + span[0],
                Instant.parse(day + "T" + span[0] + ":00Z"), Instant.parse(day + "T" + span[1] + ":00Z"));
            e.setAttendeeCount(4);
            calendarEvents.saveAndFlush(e);
        }
    }

    private static CapacitySeasonWeek week(CapacitySeasonLoad l, int n) {
        return l.getWeeks().stream().filter(w -> w.getWeek() == n).findFirst().orElseThrow();
    }

    @Test
    void noSeasonIs404() {
        databasePopulator.populateUser(ownerProperties.ownerEmail());

        getForBody("/api/capacity/season", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void futureWeeksAreTrainingOnly() {
        ownerWithSeason();

        CapacitySeasonLoad l = getForBody("/api/capacity/season", ownerAuthHeaders(), HttpStatus.OK,
            CapacitySeasonLoad.class);

        assertThat(l.getWeeks()).hasSize(8);
        assertThat(l.getNowWeek()).isEqualTo(4);
        for (int n = 1; n <= 4; n++) {
            assertThat(week(l, n).getPlanned()).isFalse();
            assertThat(week(l, n).getTrainingOnly()).isFalse();
            assertThat(week(l, n).getRecovery()).isNotNull();
        }
        for (int n = 5; n <= 8; n++) {
            CapacitySeasonWeek w = week(l, n);
            assertThat(w.getPlanned()).isTrue();
            assertThat(w.getTrainingOnly()).isTrue();
            assertThat(w.getRecovery()).isNull();
            assertThat(w.getOver()).isFalse();
            assertThat(w.getLoad()).isPositive(); // four gym days + two sport evenings
        }
        // planned weeks repeat the same schedule: equal training load
        assertThat(week(l, 5).getLoad()).isEqualTo(week(l, 8).getLoad());
        assertThat(l.getStats().getMoves()).isZero();
        assertThat(l.getHeadline()).isNull();
    }

    @Test
    void overWhenLoadExceedsRecovery() {
        UUID owner = ownerWithSeason();
        for (int i = 0; i < 5; i++) { // week 2 (Nov 9-13): two 4-hour meeting blocks a day, short sleep
            LocalDate day = LocalDate.of(2026, 11, 9).plusDays(i);
            packedDay(owner, day);
            sleepPopulator.createSleepLog(owner, day, new BigDecimal("5.0"), 2);
        }

        CapacitySeasonLoad l = getForBody("/api/capacity/season", ownerAuthHeaders(), HttpStatus.OK,
            CapacitySeasonLoad.class);

        assertThat(week(l, 2).getOver()).isTrue();
        assertThat(week(l, 2).getLoad()).isGreaterThan(week(l, 2).getRecovery());
        assertThat(week(l, 1).getOver()).isFalse();
        assertThat(l.getStats().getOverloadedDays4w()).isPositive();
    }

    @Test
    void overloadCountsTheFourWeeksBeforeAYoungSeason() {
        // K2 final fix: a season that started 3 days ago (Fri Nov 20; week 1 = Nov 16-22) still counts the
        // overloaded days of the 4 weeks before today, not only the days since its start
        UUID owner = ownerWithSeason(NOW.minusDays(3));
        for (int i = 0; i < 5; i++) { // Nov 2-6: before the season's first Monday, inside the 4-week window
            LocalDate day = LocalDate.of(2026, 11, 2).plusDays(i);
            packedDay(owner, day);
            sleepPopulator.createSleepLog(owner, day, new BigDecimal("5.0"), 2);
        }

        CapacitySeasonLoad l = getForBody("/api/capacity/season", ownerAuthHeaders(), HttpStatus.OK,
            CapacitySeasonLoad.class);

        assertThat(l.getNowWeek()).isEqualTo(2);
        assertThat(l.getStats().getOverloadedDays4w()).isPositive();
    }

    @Test
    void currentWeekCountsOnlyItsLivedDays() {
        // K2 final fix: today is Monday Nov 23 (week 4); what is still ahead this week does not load it
        UUID owner = ownerWithSeason();
        CapacitySeasonLoad before = getForBody("/api/capacity/season", ownerAuthHeaders(), HttpStatus.OK,
            CapacitySeasonLoad.class);
        for (int i = 1; i <= 6; i++) { // Tue Nov 24 - Sun Nov 29: packed, but not lived yet
            packedDay(owner, NOW.plusDays(i));
        }

        CapacitySeasonLoad after = getForBody("/api/capacity/season", ownerAuthHeaders(), HttpStatus.OK,
            CapacitySeasonLoad.class);

        assertThat(week(after, 4).getLoad()).isEqualTo(week(before, 4).getLoad());
        assertThat(week(after, 4).getRecovery()).isEqualTo(week(before, 4).getRecovery());
        assertThat(week(after, 4).getOver()).isFalse();
        // only Monday is lived: its recovery is one day's worth, a seventh of a full lived week's
        assertThat(week(after, 4).getRecovery()).isLessThan(week(after, 3).getRecovery());
    }
}
