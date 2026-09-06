package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagOutcome;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.NotificationPopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Spec 2026-09-03 §4 row 7/8 (rank 8, offers {@code shift_sleep_anchor} — wired by a later task):
 * the {@code lights_out} push sent on 5 consecutive evenings while the observed bedtime NEVER
 * complied with the sleep-goal anchor (config default {@code nonComplianceMinutes} 60).
 *
 * <p><b>The fixture's own anchor.</b> {@link SleepGoalPopulator#goal} seeds a WAKE-anchored goal
 * (06:45 wake, 450-minute/7.5h target), which {@code SleepAnchorResolver.derive} turns into a bed
 * anchor of 23:15 — shifted-hour 23.25. 60 minutes past that is 00:15 (shifted 24.25): a bedtime
 * AT that clock is compliant (boundary), one minute later is not.
 *
 * <p><b>The night pairing.</b> {@code push_log.log_date} (the evening the nudge fired) pairs with
 * {@code sleep_log.date} (the FOLLOWING wake morning) one day later — {@link #nudgedNights} seeds
 * both sides of that pairing for a window of consecutive nights ending TODAY (today's sleep row
 * is last night, per the {@code SleepDeficitCalculator} convention).
 */
class FlagEvaluatorIgnoredNudgeIT extends AbstractIntegrationTest {

    private static final String CATEGORY = "lights_out";

    @Autowired private FlagEvaluator evaluator;
    @Autowired private NotificationPopulator notificationPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    private List<String> keys(UUID owner) {
        return raisedKeys(evaluator.evaluate(owner));
    }

    /** The keys that actually RAISED — the old evaluate() return, reconstructed. */
    private static List<String> raisedKeys(List<FlagVerdict> verdicts) {
        return verdicts.stream()
            .filter(v -> v.outcome() == FlagOutcome.RAISED)
            .map(FlagVerdict::flagKey)
            .toList();
    }

    private static FlagVerdict verdictFor(List<FlagVerdict> verdicts, String flagKey) {
        return verdicts.stream().filter(v -> flagKey.equals(v.flagKey())).findFirst().orElseThrow();
    }

    private Optional<FlagPayloadEnvelope.IgnoredNudge> payload(UUID owner) {
        return evaluator.evaluate(owner).stream()
            .filter(v -> FlagKey.IGNORED_NUDGE.equals(v.flagKey()))
            .filter(v -> v.outcome() == FlagOutcome.RAISED)
            .map(v -> v.payload().ignoredNudge())
            .findFirst();
    }

    /** Seeds {@code n} nudged nights ending TODAY: for each, a {@code lights_out} push on the
     *  EVENING (sleepDate - 1) and a sleep row dated the WAKE MORNING (sleepDate) with the given
     *  bedtime — oldest night first. A {@code null} bedtime skips the sleep row entirely (an
     *  unlogged night), and a {@code null} push-flag skips the push (a night with no nudge sent). */
    private void nudgedNights(UUID owner, LocalDate today, String... bedtimes) {
        int n = bedtimes.length;
        LocalDate oldestSleepDate = today.minusDays(n - 1L);
        for (int i = 0; i < n; i++) {
            LocalDate sleepDate = oldestSleepDate.plusDays(i);
            LocalDate pushDate = sleepDate.minusDays(1);
            notificationPopulator.pushLog(owner, pushDate, "lights_out:" + pushDate, CATEGORY);
            if (bedtimes[i] != null) {
                sleepLogPopulator.createSleepLog(owner, sleepDate, bedtimes[i], "07:00", new BigDecimal("7.0"));
            }
        }
    }

    @Test
    void raises_when_five_consecutive_nudged_nights_are_all_late() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner);
        nudgedNights(owner, today, "00:30", "00:30", "00:30", "00:30", "00:30");

        assertThat(keys(owner)).contains(FlagKey.IGNORED_NUDGE);
    }

    /** Boundary: only 4 consecutive nudged/late nights precede today — the 5th (oldest) required
     *  night has neither a push nor a sleep row at all, so the window's required run breaks. */
    @Test
    void stays_silent_when_only_four_consecutive_nudged_nights_precede_today() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner);
        // Seeds the 4 most recent nights only (today-3..today); today-4 is left completely empty.
        LocalDate fourNightsStart = today.minusDays(3);
        for (LocalDate sleepDate = fourNightsStart; !sleepDate.isAfter(today); sleepDate = sleepDate.plusDays(1)) {
            LocalDate pushDate = sleepDate.minusDays(1);
            notificationPopulator.pushLog(owner, pushDate, "lights_out:" + pushDate, CATEGORY);
            sleepLogPopulator.createSleepLog(owner, sleepDate, "00:30", "07:00", new BigDecimal("7.0"));
        }

        assertThat(keys(owner)).doesNotContain(FlagKey.IGNORED_NUDGE);
    }

    @Test
    void stays_silent_when_one_of_the_five_nights_actually_complied() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner);
        // The middle night (index 2) goes to bed well before the anchor — a real compliant night.
        nudgedNights(owner, today, "00:30", "00:30", "22:00", "00:30", "00:30");

        assertThat(keys(owner)).doesNotContain(FlagKey.IGNORED_NUDGE);
    }

    /** The gate that matters most: an UNLOGGED night is neither compliant nor violating, so it
     *  BREAKS the run rather than extending it — this must never raise (that would nudge the user
     *  for not logging, which is {@code logging_gap}'s story). */
    @Test
    void stays_silent_when_one_of_the_five_nights_is_unlogged() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner);
        // index 3 has a push sent but no sleep row at all — a genuine logging gap, not compliance.
        nudgedNights(owner, today, "00:30", "00:30", "00:30", null, "00:30");

        assertThat(keys(owner)).doesNotContain(FlagKey.IGNORED_NUDGE);
    }

    /** Trap 3: with no {@code sleep_goal} row at all, {@code SleepAnchorPort} would otherwise
     *  ghost a config-default anchor — this rule must gate on the row existing instead. */
    @Test
    void stays_silent_when_there_is_no_sleep_goal_row_even_with_five_late_nudged_nights() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        // No sleepGoalPopulator.goal(owner) call at all.
        nudgedNights(owner, today, "00:30", "00:30", "00:30", "00:30", "00:30");

        assertThat(keys(owner)).doesNotContain(FlagKey.IGNORED_NUDGE);
    }

    /** Trap 2: a post-midnight bedtime (00:20) must be read as LATE, not as an early wall-clock
     *  hour — proven by actually raising on it against the 23:15 anchor. */
    @Test
    void a_post_midnight_bedtime_is_correctly_treated_as_late_not_early() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner);
        nudgedNights(owner, today, "00:20", "00:20", "00:20", "00:20", "00:20");

        assertThat(keys(owner)).contains(FlagKey.IGNORED_NUDGE);
        FlagPayloadEnvelope.IgnoredNudge p = payload(owner).orElseThrow();
        // 00:20 in the shifted space is 24.333..., well above the 23.25 anchor — never "early".
        assertThat(p.bedtimeHourByNight().values()).allSatisfy(v -> assertThat(v).isGreaterThan(24.0));
    }

    // ── boundary pair around nonComplianceMinutes (60) ───────────────────────────────────────

    @Test
    void stays_silent_when_every_night_is_exactly_at_the_non_compliance_boundary() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner);
        // 23:15 anchor + exactly 60 minutes = 00:15 — "more than" 60 minutes is required to raise.
        nudgedNights(owner, today, "00:15", "00:15", "00:15", "00:15", "00:15");

        assertThat(keys(owner)).doesNotContain(FlagKey.IGNORED_NUDGE);
    }

    @Test
    void raises_when_every_night_is_just_past_the_non_compliance_boundary() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner);
        // 23:15 anchor + 61 minutes = 00:16.
        nudgedNights(owner, today, "00:16", "00:16", "00:16", "00:16", "00:16");

        assertThat(keys(owner)).contains(FlagKey.IGNORED_NUDGE);
    }

    @Test
    void the_payload_freezes_the_category_run_length_anchor_threshold_and_each_nights_bedtime() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner);
        nudgedNights(owner, today, "00:30", "00:30", "00:30", "00:30", "00:30");

        FlagPayloadEnvelope.IgnoredNudge p = payload(owner).orElseThrow();
        assertThat(p.category()).isEqualTo(CATEGORY);
        assertThat(p.runLength()).isEqualTo(5);
        assertThat(p.minConsecutiveDays()).isEqualTo(5);
        assertThat(p.anchorBedTimeHour()).isEqualTo(23.25);
        assertThat(p.nonComplianceMinutes()).isEqualTo(60);
        assertThat(p.bedtimeHourByNight()).hasSize(5);
        assertThat(p.bedtimeHourByNight().values()).allSatisfy(v -> assertThat(v).isEqualTo(24.5));
    }

    @Test
    void is_unavailable_when_there_is_no_sleep_goal_row() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        nudgedNights(owner, today, "00:30", "00:30", "00:30", "00:30", "00:30");

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.IGNORED_NUDGE);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(verdict.reason()).isEqualTo(UnavailableReason.NO_SLEEP_GOAL_ROW);
    }

    @Test
    void is_unavailable_when_one_of_the_five_nights_is_unlogged() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner);
        nudgedNights(owner, today, "00:30", "00:30", "00:30", null, "00:30");

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.IGNORED_NUDGE);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(verdict.reason()).isEqualTo(UnavailableReason.UNLOGGED_NIGHT);
    }

    @Test
    void is_clear_when_one_of_the_five_nights_actually_complied() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner);
        nudgedNights(owner, today, "00:30", "00:30", "22:00", "00:30", "00:30");

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.IGNORED_NUDGE);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(verdict.clear().metric()).isEqualTo("nudge_run_nights");
        assertThat(verdict.clear().detail()).startsWith("complied:");
    }

    @Test
    void is_clear_when_a_required_night_has_no_nudge_sent() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner);
        LocalDate fourNightsStart = today.minusDays(3);
        for (LocalDate sleepDate = fourNightsStart; !sleepDate.isAfter(today); sleepDate = sleepDate.plusDays(1)) {
            LocalDate pushDate = sleepDate.minusDays(1);
            notificationPopulator.pushLog(owner, pushDate, "lights_out:" + pushDate, CATEGORY);
            sleepLogPopulator.createSleepLog(owner, sleepDate, "00:30", "07:00", new BigDecimal("7.0"));
        }

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.IGNORED_NUDGE);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(verdict.clear().metric()).isEqualTo("nudge_run_nights");
        assertThat(verdict.clear().detail()).startsWith("no_push:");
    }
}
