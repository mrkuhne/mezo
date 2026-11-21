package io.mrkuhne.mezo.feature.capacity.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Reason;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.CalendarEventPopulator;
import io.mrkuhne.mezo.support.populator.DailyMetricPopulator;
import io.mrkuhne.mezo.support.populator.RecoveryPeriodPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import io.mrkuhne.mezo.feature.wearable.entity.CalendarEventEntity;
import io.mrkuhne.mezo.feature.wearable.repository.CalendarEventRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Boop B7 K1 (mezo-r36n9.17): the capacity day over real data. Fixtures hang off {@link #DAY} (a Monday), never off
 * the clock. The day read never calls the model: a first read sees rule scores.
 */
@ActiveProfiles("companion-fake")
class CapacityDayServiceIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 23);

    @Autowired private CapacityDayService service;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private CalendarEventPopulator calendarPopulator;
    @Autowired private SleepLogPopulator sleepPopulator;
    @Autowired private DailyMetricPopulator metricPopulator;
    @Autowired private RecoveryPeriodPopulator recoveryPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private CalendarEventRepository calendarEvents;

    private void meeting(UUID owner, LocalDate date, String title, String startUtc, String endUtc) {
        calendarPopulator.createEvent(owner, date, title,
            Instant.parse(date + "T" + startUtc + ":00Z"), Instant.parse(date + "T" + endUtc + ":00Z"));
    }

    /** A meeting with four attendees: the rule scores it a "meeting" (mental by length, social 2). */
    private void withPeople(UUID owner, LocalDate date, String title, String startUtc, String endUtc) {
        CalendarEventEntity e = calendarPopulator.createEvent(owner, date, title,
            Instant.parse(date + "T" + startUtc + ":00Z"), Instant.parse(date + "T" + endUtc + ":00Z"));
        e.setAttendeeCount(4);
        calendarEvents.saveAndFlush(e);
    }

    @Test
    void packedDayIsTulSok() {
        UUID owner = databasePopulator.populateUser("cap-day1@test.local");
        trainPopulator.createGymSlot(owner, 0, "17:30"); // Monday
        sleepPopulator.createSleepLog(owner, DAY, new BigDecimal("6.0"), 3);
        withPeople(owner, DAY, "Tervezés", "08:00", "12:00"); // the 4-hour block
        withPeople(owner, DAY, "Egyeztetés", "13:00", "14:00");
        withPeople(owner, DAY, "Átadó", "15:00", "16:00");

        CapacityDay day = service.day(owner, DAY);

        assertThat(day.verdict()).isEqualTo("túl sok");
        assertThat(day.ratio()).isGreaterThan(1.0);
        assertThat(day.calendarKnown()).isTrue();
        assertThat(day.tanulo()).isTrue();
        assertThat(day.demand().items()).extracting(DemandCalculator.DemandItem::kind).contains("meeting", "training");
        assertThat(day.reasonFacts()).contains("3 megbeszélés délután").contains(" · ");
    }

    @Test
    void noCalendarStillGivesVerdictAndSaysSo() {
        UUID owner = databasePopulator.populateUser("cap-day2@test.local");
        trainPopulator.createGymSlot(owner, 0, "17:30");
        sleepPopulator.createSleepLog(owner, DAY, new BigDecimal("5.5"), 2);

        CapacityDay day = service.day(owner, DAY);

        assertThat(day.calendarKnown()).isFalse();
        assertThat(day.verdict()).isNotNull();
        assertThat(day.demand().items()).extracting(DemandCalculator.DemandItem::kind).containsExactly("training");
        assertThat(day.capacity().factors()).extracting(CapacityCalculator.Factor::key).contains("sleep");
        assertThat(day.reasonFacts()).contains("rövid éjszaka");
    }

    @Test
    void recoveryPeriodFloorsCapacity() {
        UUID owner = databasePopulator.populateUser("cap-day3@test.local");
        recoveryPopulator.open(owner, Reason.ILLNESS, DAY.minusDays(1), io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity.Estimate.FEW_DAYS);

        CapacityDay day = service.day(owner, DAY);

        assertThat(day.capacity().factors()).extracting(CapacityCalculator.Factor::key).containsExactly("recovery");
        // default base 6.0 units x headroom 1.25 x recovery 0.6
        assertThat(day.capacity().units()).isCloseTo(4.5, within(1e-9));
        assertThat(day.reasonFacts()).contains("kímélő mód");
    }

    @Test
    void weekReturnsSevenDaysMondayFirst() {
        UUID owner = databasePopulator.populateUser("cap-day4@test.local");
        meeting(owner, DAY.plusDays(2), "Heti sync", "09:00", "10:00");

        List<CapacityDay> week = service.week(owner, DAY);

        assertThat(week).hasSize(7);
        assertThat(week).extracting(CapacityDay::date)
            .containsExactly(DAY, DAY.plusDays(1), DAY.plusDays(2), DAY.plusDays(3), DAY.plusDays(4), DAY.plusDays(5),
                DAY.plusDays(6));
        assertThat(week.get(2).demand().units()).isGreaterThan(0);
        assertThat(week.get(0).demand().units()).isZero();
    }

    @Test
    void baseIsTheMedianOfFullDaysAndStillLearningWithoutLabels() {
        UUID owner = databasePopulator.populateUser("cap-day5@test.local");
        // 14 full days (sleep + metric), one calendar hour each
        for (int i = 1; i <= 14; i++) {
            LocalDate d = DAY.minusDays(i);
            sleepPopulator.createSleepLog(owner, d, new BigDecimal("8.0"), 4);
            metricPopulator.createDay(owner, d, 8000, 55);
            meeting(owner, d, "Napi", "09:00", "10:00");
        }
        sleepPopulator.createSleepLog(owner, DAY, new BigDecimal("8.0"), 4);

        CapacityDay day = service.day(owner, DAY);

        assertThat(day.fullDays()).isEqualTo(14);
        assertThat(day.labelledDays()).isZero();
        assertThat(day.tanulo()).isTrue(); // no labels yet
        // history is rule-scored (no attendees: a focus hour, mental 2 -> 2/3 unit a day): base 2/3 x headroom 1.25
        assertThat(day.capacity().units()).isCloseTo(2.0 / 3 * 1.25, within(1e-9));
    }
}
