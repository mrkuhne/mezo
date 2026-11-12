package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInSnapshotEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInSnapshotRepository;
import io.mrkuhne.mezo.feature.companion.service.BoopDayContext;
import io.mrkuhne.mezo.feature.companion.service.BoopDayContext.DayBlock;
import io.mrkuhne.mezo.feature.companion.service.BoopDayContext.DayChip;
import io.mrkuhne.mezo.feature.companion.service.OwnerToday;
import io.mrkuhne.mezo.feature.companion.tools.DayTools;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import io.mrkuhne.mezo.feature.companion.tools.ToolContexts;
import io.mrkuhne.mezo.feature.wearable.entity.DailyMetricEntity;
import io.mrkuhne.mezo.feature.wearable.repository.DailyMetricRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.CalendarEventPopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.DailyMetricPopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.IntentionPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * Boop B3 (mezo-r36n9.13, spec §7.6): the deterministic "Ma" block Boop's chat carries every turn, the
 * "Boop látja" chips built from the same block, the rule-based ready questions and the two day read tools.
 */
@Transactional
@ActiveProfiles("companion-fake")
class BoopDayContextIT extends AbstractIntegrationTest {

    /** A Thursday; the owner's "now" is noon Budapest time. */
    private static final LocalDate DAY = LocalDate.of(2026, 11, 12);
    private static final ZoneId ZONE = ZoneId.of("Europe/Budapest");
    private static final Instant NOON = DAY.atTime(12, 0).atZone(ZONE).toInstant();
    private static final String SECRET_TITLE = "Titkos ügyféltárgyalás a Kovács Bt-vel";

    @Autowired private BoopDayContext context;
    @Autowired private DayTools dayTools;
    @Autowired private OwnerToday ownerToday;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private SleepLogPopulator sleepLogs;
    @Autowired private SleepGoalPopulator sleepGoals;
    @Autowired private DailyMetricPopulator metricPopulator;
    @Autowired private DailyMetricRepository metrics;
    @Autowired private CheckInPopulator checkIns;
    @Autowired private CheckInSnapshotRepository snapshots;
    @Autowired private IntentionPopulator intentions;
    @Autowired private TrainPopulator train;
    @Autowired private MealPopulator meals;
    @Autowired private CalendarEventPopulator calendar;
    @Autowired private GoalPopulator goals;

    @Test
    void blockUnderTokenBudget() {
        UUID user = databasePopulator.populateUser("boop-day-budget@test.local");
        seedRichDay(user, DAY);

        String block = context.render(context.assemble(user, DAY, NOON));

        // Rough chars/4 estimate (the project has no tokenizer); Hungarian runs denser, so the test
        // holds the stricter chars/3 bound under the spec's 1 200-token target.
        assertThat(block.length() / 3).isLessThan(1200);
        assertThat(block).contains("[Ma — Boop látja] 2026-11-12")
            .contains("6ó 10p").contains("7ó 40p")
            .contains("HRV 38 ms (szokott 50)")
            .contains("4 210")
            .contains("pulzus 78, HRV 36 (szokott 50)")
            .contains("Ügyfélprezentáció")
            .contains("Röpi 19:00, 90 perc")
            .contains("Holnap:")
            .contains("Lefekvési cél: 23:15")
            .contains("Súlycél");
    }

    @Test
    void calendarTitlesNeverInBlock() {
        UUID user = databasePopulator.populateUser("boop-day-calendar@test.local");
        calendar.createEvent(user, DAY, SECRET_TITLE, at(DAY, 14, 0), at(DAY, 15, 0));
        calendar.createEvent(user, DAY, "Fogorvos Dr. Nagy", at(DAY, 16, 30), at(DAY, 17, 0));
        calendar.createEvent(user, DAY, "Reggeli stand-up", at(DAY, 9, 0), at(DAY, 9, 15)); // already over

        DayBlock day = context.assemble(user, DAY, NOON);
        String block = context.render(day);
        List<DayChip> chips = context.chips(day);

        assertThat(block).contains("még 2 esemény").contains("14:00–15:00 (60 perc)").contains("16:30–17:00 (30 perc)")
            .doesNotContain(SECRET_TITLE).doesNotContain("Fogorvos").doesNotContain("stand-up").doesNotContain("09:00");
        assertThat(chips).allSatisfy(chip -> assertThat(chip.label() + chip.value() + chip.sub())
            .doesNotContain("Titkos").doesNotContain("Fogorvos"));
    }

    @Test
    void chipsMatchBlock() {
        UUID user = databasePopulator.populateUser("boop-day-chips@test.local");
        seedRichDay(user, DAY);

        DayBlock day = context.assemble(user, DAY, NOON);
        String block = context.render(day);
        List<DayChip> chips = context.chips(day);

        assertThat(chips).extracting(DayChip::key)
            .containsExactly("sleep", "hrv", "session", "checkins", "fuel", "goal", "calendar");
        // The strip shows exactly what the model sees: every chip's value and sub is in the block.
        for (DayChip chip : chips) {
            assertThat(block).as("chip %s value", chip.key()).contains(chip.value());
            if (chip.sub() != null) {
                assertThat(block).as("chip %s sub", chip.key()).contains(chip.sub());
            }
        }
        assertThat(chips).filteredOn(c -> c.key().equals("hrv")).singleElement()
            .satisfies(c -> {
                assertThat(c.value()).isEqualTo("38");
                assertThat(c.sub()).isEqualTo("szokott 50");
            });
        assertThat(chips).filteredOn(c -> c.key().equals("session")).singleElement()
            .satisfies(c -> {
                assertThat(c.label()).isEqualTo("Röpi");
                assertThat(c.value()).isEqualTo("19:00");
                assertThat(c.sub()).isEqualTo("90 perc");
            });
    }

    @Test
    void lowHrvAsksWhyTired() {
        UUID user = databasePopulator.populateUser("boop-day-hrv@test.local");
        seedHrv(user, DAY, 50, 38);

        List<String> questions = context.questions(context.assemble(user, DAY, NOON));

        assertThat(questions).containsExactly("Miért vagyok fáradtabb, mint tegnap?");
    }

    @Test
    void sessionTodayAsksFoodAndFocus() {
        UUID user = databasePopulator.populateUser("boop-day-session@test.local");
        train.createScheduleSlot(user, dow(DAY), "19:00", 90, "training");

        List<String> questions = context.questions(context.assemble(user, DAY, NOON));

        assertThat(questions).containsExactly("Mennyit egyek a röpi előtt?", "Mire figyeljek ma az edzésen?");
    }

    @Test
    void maxThreeQuestions() {
        UUID user = databasePopulator.populateUser("boop-day-max@test.local");
        seedHrv(user, DAY, 50, 38);
        train.createScheduleSlot(user, dow(DAY), "19:00", 90, "training");
        train.createScheduleSlot(user, dow(DAY.plusDays(1)), "18:00", 90, "match");

        List<String> questions = context.questions(context.assemble(user, DAY, NOON));

        assertThat(questions).hasSize(3).containsExactly("Miért vagyok fáradtabb, mint tegnap?",
            "Mennyit egyek a röpi előtt?", "Mire figyeljek ma az edzésen?");

        UUID quiet = databasePopulator.populateUser("boop-day-quiet@test.local");
        assertThat(context.questions(context.assemble(quiet, DAY, NOON))).containsExactly("Hogy alakul a napom?");
    }

    @Test
    void dayToolsReadWearableAndCalendarWithoutTitles() {
        UUID user = databasePopulator.populateUser("boop-day-tools@test.local");
        LocalDate today = ownerToday.today();
        seedHrv(user, today, 50, 41);
        calendar.createEvent(user, today, SECRET_TITLE, at(today, 23, 0), at(today, 23, 45));
        ToolContext ctx = new ToolContext(Map.of(ToolContexts.USER_ID, user,
            ToolContexts.AUDIT, new ToolCallAudit(15, 20)));

        String wearableToday = dayTools.wearable("today", ctx);
        String wearableWeek = dayTools.wearable("week", ctx);
        String cal = dayTools.calendar("today", ctx);

        assertThat(wearableToday).contains("HRV 41 ms (szokott 50)").contains(today.toString());
        assertThat(wearableWeek).contains(today.minusDays(6).toString()).contains(today.toString());
        assertThat(cal).contains("23:00–23:45 (45 perc)").doesNotContain("Titkos").doesNotContain("Kovács");
    }

    // ------------------------------------------------------------------ fixtures

    private void seedRichDay(UUID user, LocalDate day) {
        sleepLogs.createSleepLog(user, day, "23:40", "05:50", new BigDecimal("6.17"));
        sleepLogs.createSleepLog(user, day.minusDays(1), "22:50", "06:30", new BigDecimal("7.67"));
        sleepGoals.goal(user);
        seedHrv(user, day, 50, 38);
        DailyMetricEntity today = metrics.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDate(user, day, day).getFirst();
        today.setSteps(4210);
        metrics.saveAndFlush(today);
        for (String slot : List.of("06:30", "10:00", "14:00")) {
            CheckInEntity c = checkIns.createCheckIn(user, day, slot, e -> {
                e.setEnergy(6);
                e.setMood(7);
                e.setStress(4);
            });
            CheckInSnapshotEntity s = new CheckInSnapshotEntity();
            s.setCreatedBy(user);
            s.setCheckInId(c.getId());
            s.setHrBpm(78);
            s.setHrvMs(36.0);
            s.setHrvUsualMs(50.0);
            s.setComputedBy("phone");
            snapshots.saveAndFlush(s);
        }
        intentions.focus(user, day, "Ügyfélprezentáció");
        intentions.focus(user, day, "Korán lefeküdni");
        train.createScheduleSlot(user, dow(day), "19:00", 90, "training");
        train.createScheduleSlot(user, dow(day.plusDays(1)), "18:00", 90, "match");
        meals.createMealWithItems(user, day, "breakfast",
            List.of(new MealPopulator.Line("Zabkása boop", "520", "24", "80", "10", (short) 1)));
        for (int h = 13; h <= 22; h++) {
            calendar.createEvent(user, day, SECRET_TITLE + " " + h, at(day, h, 0), at(day, h, 45));
        }
        goals.createGoal(user, "cut", "active");
    }

    private void seedHrv(UUID user, LocalDate day, int usual, int today) {
        for (int i = 14; i >= 0; i--) {
            DailyMetricEntity m = metricPopulator.createDay(user, day.minusDays(i), 8000, 55);
            m.setHrvMs(BigDecimal.valueOf(i == 0 ? today : usual));
            metrics.saveAndFlush(m);
        }
    }

    private static Instant at(LocalDate day, int hour, int minute) {
        return day.atTime(LocalTime.of(hour, minute)).atZone(ZONE).toInstant();
    }

    /** 0=Hét .. 6=Vas (schedule-slot convention). */
    private static int dow(LocalDate day) {
        return day.getDayOfWeek().getValue() - 1;
    }
}
