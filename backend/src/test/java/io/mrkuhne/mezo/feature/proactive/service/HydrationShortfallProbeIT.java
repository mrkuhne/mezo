package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WaterLogPopulator;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Round 2 S2 (bd mezo-d58h.7.2, spec §12). The probe is the WHOLE detection: training day,
 * pro-rated target from the sleep anchor, 60% threshold, batch-logger guard. The clock is always
 * passed explicitly — a {@code LocalTime.now()} inside would make every assertion depend on the
 * hour CI happens to run at.
 *
 * <p>Anchor: {@link SleepGoalPopulator#goal(UUID)} is a 06:45 wake / 23:15 bed pair, so at 15:00
 * the waking day is 8h15m of 16h30m — exactly half elapsed. With the 4000 ml config-ghost target
 * that is a 2000 ml pro-rated target and a 1200 ml (60%) firing line.
 */
class HydrationShortfallProbeIT extends AbstractIntegrationTest {

    private static final LocalTime AT_15 = LocalTime.of(15, 0);

    @Autowired private HydrationShortfallProbe probe;
    @Autowired private UserPopulator userPopulator;
    @Autowired private WaterLogPopulator waterLogPopulator;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private TrainPopulator trainPopulator;

    /** A user with a wake/bed anchor and a gym slot on {@code day}'s weekday. */
    private UUID trainingUser(LocalDate day) {
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner);
        trainPopulator.createGymSlot(owner, day.getDayOfWeek().getValue() - 1, "18:00");
        return owner;
    }

    @Test
    void testEvaluate_shouldReportTheShortfall_whenATrainingDayIsHalfOverAndWaterIsWayBehind() {
        LocalDate day = LocalDate.now();
        UUID owner = trainingUser(day);
        waterLogPopulator.createWaterLog(owner, day, 400);

        HydrationShortfallProbe.Shortfall shortfall = probe.evaluate(owner, day, AT_15).orElseThrow();

        assertThat(shortfall.loggedMl()).isEqualTo(400);
        assertThat(shortfall.dailyTargetMl()).isEqualTo(4000);
        assertThat(shortfall.proRatedTargetMl()).isEqualTo(2000);
        assertThat(shortfall.deficitMl()).isEqualTo(1600);
    }

    @Test
    void testEvaluate_shouldBeSilent_whenTheDayIsNotATrainingDay() {
        LocalDate day = LocalDate.now();
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner);
        waterLogPopulator.createWaterLog(owner, day, 400);

        assertThat(probe.evaluate(owner, day, AT_15)).isEmpty();
    }

    /** The batch-logger guard: nothing at all has been logged today, so the day is UNOBSERVED,
     *  not dry. Zero water + zero everything ⇒ silence (spec §12). */
    @Test
    void testEvaluate_shouldBeSilent_whenNothingHasBeenLoggedTodayAtAll() {
        LocalDate day = LocalDate.now();
        UUID owner = trainingUser(day);

        assertThat(probe.evaluate(owner, day, AT_15)).isEmpty();
    }

    @Test
    void testEvaluate_shouldBeSilent_whenWaterIsAtOrAboveTheProRatedThreshold() {
        LocalDate day = LocalDate.now();
        UUID owner = trainingUser(day);
        waterLogPopulator.createWaterLog(owner, day, 1200);

        assertThat(probe.evaluate(owner, day, AT_15)).isEmpty();
    }

    /** Before the wake anchor there is no elapsed waking day to be behind on. */
    @Test
    void testEvaluate_shouldBeSilent_whenTheClockIsBeforeTheWakeAnchor() {
        LocalDate day = LocalDate.now();
        UUID owner = trainingUser(day);
        waterLogPopulator.createWaterLog(owner, day, 100);

        assertThat(probe.evaluate(owner, day, LocalTime.of(5, 30))).isEmpty();
    }

    /** Just after wake the pro-rated target is a rounding artefact — min-pro-rated-ml suppresses it. */
    @Test
    void testEvaluate_shouldBeSilent_whenTheProRatedTargetIsStillBelowTheFloor() {
        LocalDate day = LocalDate.now();
        UUID owner = trainingUser(day);
        waterLogPopulator.createWaterLog(owner, day, 50);

        assertThat(probe.evaluate(owner, day, LocalTime.of(7, 30))).isEmpty();
    }
}
