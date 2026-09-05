package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaise;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Spec 2026-09-03 §4 row 8 (rank 9, the epic's last new detection): the last meal within
 * {@code minutesBeforeBed} (90) of the bedtime anchor, OR at/after {@code absoluteHour} (22.5 ==
 * 22:30), on at least {@code minDaysOfLastThree} (2) of the last {@code windowDays} (3) days.
 *
 * <p><b>The fixture's own anchor.</b> {@link SleepGoalPopulator#goal} seeds a WAKE-anchored goal
 * (06:45 wake, 450-minute/7.5h target), which {@code SleepAnchorResolver.derive} turns into a bed
 * anchor of 23:15 — shifted-hour 23.25, exactly the anchor {@code FlagEvaluatorIgnoredNudgeIT}
 * relies on. 90 minutes before that is 21:45 (shifted 21.75); a meal AT that clock is late via
 * the bed arm (boundary), one minute earlier is not.
 */
class FlagEvaluatorLateEatingIT extends AbstractIntegrationTest {

    @Autowired private FlagEvaluator evaluator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private UserPopulator userPopulator;

    private static final List<MealPopulator.Line> LINES = List.of(
        new MealPopulator.Line("Csirke", "500", "40", "30", "15", (short) 1));

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    private List<String> keys(UUID owner) {
        return evaluator.evaluate(owner).stream().map(FlagRaise::flagKey).toList();
    }

    private Optional<FlagPayloadEnvelope.LateEating> payload(UUID owner) {
        return evaluator.evaluate(owner).stream()
            .filter(r -> FlagKey.LATE_EATING.equals(r.flagKey()))
            .map(r -> r.payload().lateEating())
            .findFirst();
    }

    /** Logs the day's ONE (and last) meal at the given local hour:minute, via the explicit-instant
     *  overload so {@code MetricSeriesService.lateMealHour}'s wall-clock read is deterministic. */
    private void meal(UUID owner, LocalDate date, int hour, int minute) {
        mealPopulator.createMealWithItems(owner, date, "dinner",
            date.atTime(hour, minute).atZone(ZoneId.systemDefault()).toInstant(), LINES);
    }

    // ── absolute-hour arm — no goal row needed ────────────────────────────────────────────────

    @Test
    void raises_when_two_of_three_days_are_after_the_absolute_hour() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        meal(owner, today.minusDays(2), 22, 45);
        meal(owner, today.minusDays(1), 18, 0);
        meal(owner, today, 23, 0);

        assertThat(keys(owner)).contains(FlagKey.LATE_EATING);
    }

    /** Boundary on the DAY COUNT: only one of three days clears the absolute hour. */
    @Test
    void stays_silent_when_only_one_of_three_days_is_after_the_absolute_hour() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        meal(owner, today.minusDays(2), 22, 45);
        meal(owner, today.minusDays(1), 18, 0);
        meal(owner, today, 18, 0);

        assertThat(keys(owner)).doesNotContain(FlagKey.LATE_EATING);
    }

    /** Inclusive boundary: a meal logged at EXACTLY 22:30 (absoluteHour == 22.5) counts. */
    @Test
    void raises_when_meal_is_exactly_at_the_absolute_hour_boundary() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        meal(owner, today.minusDays(2), 22, 30);
        meal(owner, today.minusDays(1), 22, 30);
        meal(owner, today, 18, 0);

        assertThat(keys(owner)).contains(FlagKey.LATE_EATING);
    }

    @Test
    void stays_silent_when_meal_is_one_minute_before_the_absolute_hour_boundary() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        meal(owner, today.minusDays(2), 22, 29);
        meal(owner, today.minusDays(1), 22, 29);
        meal(owner, today, 18, 0);

        assertThat(keys(owner)).doesNotContain(FlagKey.LATE_EATING);
    }

    // ── bed arm — requires the goal row, gated exactly like IgnoredNudgeRule's anchor ────────

    /** Trap 1: two days late ONLY via the "within 90' of bed" arm (22:00 is 75' before the 23:15
     *  anchor, but well short of the 22:30 absolute threshold) — a goal row makes this raise. */
    @Test
    void raises_via_the_bed_arm_when_a_goal_row_is_present() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner);
        meal(owner, today.minusDays(2), 22, 0);
        meal(owner, today.minusDays(1), 22, 0);
        meal(owner, today, 18, 0);

        assertThat(keys(owner)).contains(FlagKey.LATE_EATING);
        FlagPayloadEnvelope.LateEating p = payload(owner).orElseThrow();
        assertThat(p.qualifyingArmByDay().values()).allSatisfy(arm -> assertThat(arm).isEqualTo("bed"));
    }

    /** Trap 1's honest split: the SAME two 22:00 meals, but with NO {@code sleep_goal} row at
     *  all — the bed arm cannot evaluate (no personal target to measure against), and 22:00 never
     *  clears the absolute-hour arm either, so the rule stays silent rather than inventing a
     *  target from the config-default anchor {@code SleepAnchorPort} would otherwise ghost in. */
    @Test
    void stays_silent_via_the_bed_arm_when_no_goal_row_exists_even_with_the_same_meals() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        // No sleepGoalPopulator.goal(owner) call at all.
        meal(owner, today.minusDays(2), 22, 0);
        meal(owner, today.minusDays(1), 22, 0);
        meal(owner, today, 18, 0);

        assertThat(keys(owner)).doesNotContain(FlagKey.LATE_EATING);
    }

    @Test
    void raises_when_meal_is_exactly_90_minutes_before_the_bed_anchor() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner);
        meal(owner, today.minusDays(2), 21, 45);
        meal(owner, today.minusDays(1), 21, 45);
        meal(owner, today, 18, 0);

        assertThat(keys(owner)).contains(FlagKey.LATE_EATING);
    }

    @Test
    void stays_silent_when_meal_is_91_minutes_before_the_bed_anchor() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner);
        meal(owner, today.minusDays(2), 21, 44);
        meal(owner, today.minusDays(1), 21, 44);
        meal(owner, today, 18, 0);

        assertThat(keys(owner)).doesNotContain(FlagKey.LATE_EATING);
    }

    // ── honesty gate: an unlogged day is neither late nor compliant ──────────────────────────

    /** The unlogged middle day does not block the two real late days from raising — it simply
     *  never enters the qualifying count either way. */
    @Test
    void raises_even_when_one_of_the_three_days_has_no_logged_meal_at_all() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        meal(owner, today.minusDays(2), 22, 45);
        // today.minusDays(1): no meal logged at all.
        meal(owner, today, 22, 45);

        assertThat(keys(owner)).contains(FlagKey.LATE_EATING);
    }

    /** The unlogged day is not silently promoted into a qualifying one: with only ONE genuinely
     *  late day logged, the rule stays silent even though a naive "2 of 3 slots" count could be
     *  tempted to treat the missing day as compliant/late filler. */
    @Test
    void stays_silent_when_only_one_real_day_qualifies_and_another_has_no_logged_meal() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        // today.minusDays(2): no meal logged at all.
        meal(owner, today.minusDays(1), 22, 45);
        meal(owner, today, 18, 0);

        assertThat(keys(owner)).doesNotContain(FlagKey.LATE_EATING);
    }

    // ── trap 2 (fixed): the absolute arm compares the RAW hour, never a shifted one ──────────

    /** REGRESSION for the false-positive this rule originally shipped with: shifting the meal
     *  hour for the absolute-arm comparison made every PRE-NOON last meal (any hour below 12)
     *  unconditionally clear {@code absoluteHour} — an 08:00-only breakfast on two of three days
     *  would have raised {@code late_eating} and told an intermittent-fasting or simply-early
     *  eater their breakfast was "very late". The absolute arm must stay in
     *  {@code LATE_MEAL_HOUR}'s own plain space: 8.0 is nowhere near 22.5. */
    @Test
    void stays_silent_when_the_only_logged_meal_is_an_early_breakfast_on_two_of_three_days() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        meal(owner, today.minusDays(2), 8, 0);
        meal(owner, today.minusDays(1), 8, 0);
        meal(owner, today, 18, 0);

        assertThat(keys(owner)).doesNotContain(FlagKey.LATE_EATING);
    }

    // ── trap 2: post-midnight meals ───────────────────────────────────────────────────────────

    /** A post-midnight-only last meal (00:30, no goal row, nothing else qualifying) does NOT fire
     *  the absolute arm — deliberately: {@code LATE_MEAL_HOUR} is the day's MAX meal hour, so
     *  00:30 being that max means it was the user's ONLY meal that day, which reads as a
     *  night-shift/logging-gap pattern rather than a late-night snack, and the rule never
     *  estimates past what it actually knows (see the rule's own javadoc). */
    @Test
    void stays_silent_for_a_post_midnight_only_meal_with_no_goal_row() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        meal(owner, today.minusDays(2), 0, 30);
        meal(owner, today.minusDays(1), 0, 30);
        meal(owner, today, 18, 0);

        assertThat(keys(owner)).doesNotContain(FlagKey.LATE_EATING);
    }

    /** But a post-midnight meal that lands close to a REAL (shifted) anchor still correctly fires
     *  the bed arm — proving the shift still does its job for the one case it exists for: 00:20 is
     *  65' after the 23:15 anchor (shifted diff, not a ~23h wraparound "early breakfast" misread). */
    @Test
    void raises_via_the_bed_arm_for_a_post_midnight_meal_close_to_the_anchor() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner);
        meal(owner, today.minusDays(2), 0, 20);
        meal(owner, today.minusDays(1), 0, 20);
        meal(owner, today, 18, 0);

        assertThat(keys(owner)).contains(FlagKey.LATE_EATING);
        FlagPayloadEnvelope.LateEating p = payload(owner).orElseThrow();
        // 00:20 in the shifted space is 24.333, well above the 22.5 absolute threshold's own
        // plain-space number — but this raise came from the BED arm, not the absolute one.
        assertThat(p.qualifyingArmByDay().values()).allSatisfy(arm -> assertThat(arm).isEqualTo("bed"));
        assertThat(p.lastMealHourByDay().values()).allSatisfy(v -> assertThat(v).isGreaterThan(24.0));
    }

    // ── payload freeze ─────────────────────────────────────────────────────────────────────

    @Test
    void the_payload_freezes_thresholds_the_anchor_and_each_days_hour_and_arm() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner);
        // today-2: both arms (22:45 is <=90' from the 23:15 anchor AND >= the 22:30 absolute hour).
        meal(owner, today.minusDays(2), 22, 45);
        // today-1: no meal at all — must not appear in either map.
        // today: bed arm only (22:00 is 75' before the anchor, but under the absolute hour).
        meal(owner, today, 22, 0);

        FlagPayloadEnvelope.LateEating p = payload(owner).orElseThrow();
        assertThat(p.minutesBeforeBed()).isEqualTo(90);
        assertThat(p.absoluteHour()).isEqualTo(22.5);
        assertThat(p.minDaysOfLastThree()).isEqualTo(2);
        assertThat(p.windowDays()).isEqualTo(3);
        assertThat(p.anchorBedTimeHour()).isEqualTo(23.25);
        assertThat(p.qualifyingDays()).isEqualTo(2);
        assertThat(p.lastMealHourByDay()).hasSize(2);
        assertThat(p.lastMealHourByDay().get(today.minusDays(2).toString())).isCloseTo(22.75, within(1e-9));
        assertThat(p.lastMealHourByDay().get(today.toString())).isCloseTo(22.0, within(1e-9));
        assertThat(p.qualifyingArmByDay().get(today.minusDays(2).toString())).isEqualTo("both");
        assertThat(p.qualifyingArmByDay().get(today.toString())).isEqualTo("bed");
    }
}
