package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepAnchorPort;
import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.NudgeSendPort;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Spec 2026-09-03 §4 row 7/8 (rank 8, offers {@code shift_sleep_anchor} — wired by a later task):
 * the {@code lights_out} push sent on {@code minConsecutiveDays} consecutive evenings ending
 * at/near today, while the observed bedtime NEVER complied on any of those nights. The point
 * (design spec) is to stop repeating an ignored nudge and start a conversation instead.
 *
 * <p><b>Three data sources, three traps.</b>
 * <ol>
 *   <li>Sent pushes are {@code push_log} rows, reached through {@link NudgeSendPort} — a
 *       companion-owned port ({@code IgnoredNudgeRule} never imports {@code PushLogRepository}
 *       directly, which would close a {@code companion ↔ notification} feature-slice cycle; see
 *       the port's own javadoc).</li>
 *   <li>Observed bedtime is {@link MetricKey#BEDTIME_HOUR}, whose extractor
 *       ({@code MetricSeriesService.clockHour}) adds +24 to clock hours below 12, so a 00:30
 *       bedtime reads as 24.5 and post-midnight bedtimes sort on the SAME number line as
 *       pre-midnight ones. {@link #shiftedHour} applies the identical convention to the anchor's
 *       {@link LocalTime} before comparing — comparing a shifted observed value against a raw
 *       wall-clock anchor would misjudge every post-midnight night as "very early" rather than
 *       "very late".</li>
 *   <li>The target is {@link SleepAnchorPort#resolve}'s bed time — but {@code SleepAnchorPort}
 *       GHOSTS a config default when no {@code sleep_goal} row exists. This rule gates on the row
 *       EXISTING by reading {@link SleepGoalRepository} directly, before ever calling the port —
 *       a user with no goal is never measured against an invented target.</li>
 * </ol>
 *
 * <p><b>The night pairing.</b> {@code sleep_log.date} is the WAKE morning — the
 * {@code SleepDeficitCalculator} convention, "today's row is last night" — while
 * {@code push_log.log_date} is the calendar day the evening push actually fired. So the push sent
 * on day D pairs with the {@code BEDTIME_HOUR} value dated D+1, the morning that night's sleep
 * gets logged under; the window's newest paired night is the one whose sleep is dated
 * {@code today} (last night, already logged this morning) and whose push fired {@code
 * today.minusDays(1)} (yesterday evening).
 *
 * <p><b>Honesty gate.</b> An unlogged night is neither compliant nor violating — a gap in
 * {@code BEDTIME_HOUR} BREAKS the consecutive run rather than extending it (a missing night is
 * {@code logging_gap}'s story, never this rule's). The same break applies to a night with no push
 * sent, or a night the observed bedtime complied: any one such night inside the required window
 * silences the whole raise, exactly like a genuine streak.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class IgnoredNudgeRule implements FlagRule {

    private final MetricSeriesService metricSeriesService;
    private final SleepGoalRepository sleepGoalRepository;
    private final SleepAnchorPort sleepAnchorPort;
    private final ObjectProvider<NudgeSendPort> nudgeSendPort;
    private final FlagProperties properties;

    @Override
    public FlagVerdict evaluate(UUID userId, LocalDate today) {
        FlagProperties.IgnoredNudge cfg = properties.ignoredNudge();

        // Trap 3: gate on the goal row EXISTING — never let SleepAnchorPort's ghosted config
        // default stand in for a real target.
        if (sleepGoalRepository.findByCreatedByAndDeletedFalse(userId).isEmpty()) {
            return FlagVerdict.unavailable(FlagKey.IGNORED_NUDGE,
                UnavailableReason.NO_SLEEP_GOAL_ROW);
        }
        NudgeSendPort pushPort = nudgeSendPort.getIfAvailable();
        if (pushPort == null) {
            // notification off: cannot know whether anything was sent
            return FlagVerdict.unavailable(FlagKey.IGNORED_NUDGE,
                UnavailableReason.NOTIFICATIONS_OFF);
        }

        // Trap 2: convert the anchor into the SAME shifted-hour space BEDTIME_HOUR uses.
        double anchorShiftedHour = shiftedHour(sleepAnchorPort.resolve(userId).bed());

        int n = cfg.minConsecutiveDays();
        LocalDate newestSleepDate = today;
        LocalDate oldestSleepDate = today.minusDays(n - 1L);
        LocalDate oldestPushDate = oldestSleepDate.minusDays(1);
        LocalDate newestPushDate = newestSleepDate.minusDays(1);

        // Trap 1: push_log has no date-range finder in this repository — read through the port.
        Set<LocalDate> sentDates =
            pushPort.sentDates(userId, cfg.category(), oldestPushDate, newestPushDate);
        Map<LocalDate, Double> bedtimeSeries =
            metricSeriesService.series(userId, MetricKey.BEDTIME_HOUR, oldestSleepDate, newestSleepDate);

        Map<String, Double> bedtimeByNight = new LinkedHashMap<>();
        int nightsSoFar = 0;
        for (LocalDate sleepDate = oldestSleepDate; !sleepDate.isAfter(newestSleepDate);
                sleepDate = sleepDate.plusDays(1)) {
            LocalDate pushDate = sleepDate.minusDays(1);
            if (!sentDates.contains(pushDate)) {
                return FlagVerdict.clear(FlagKey.IGNORED_NUDGE, new FlagVerdict.ClearEvidence(
                    "nudge_run_nights", (double) nightsSoFar, (double) n, "no_push:" + pushDate));
            }
            Double observed = bedtimeSeries.get(sleepDate);
            if (observed == null) {
                // Honesty gate: an unlogged night is neither compliant nor violating.
                return FlagVerdict.unavailable(FlagKey.IGNORED_NUDGE,
                    UnavailableReason.UNLOGGED_NIGHT);
            }
            double lateByMinutes = (observed - anchorShiftedHour) * 60.0;
            if (lateByMinutes <= cfg.nonComplianceMinutes()) {
                return FlagVerdict.clear(FlagKey.IGNORED_NUDGE, new FlagVerdict.ClearEvidence(
                    "nudge_run_nights", (double) nightsSoFar, (double) n, "complied:" + sleepDate));
            }
            bedtimeByNight.put(pushDate.toString(), observed);
            nightsSoFar++;
        }

        return FlagVerdict.raised(FlagKey.IGNORED_NUDGE,
            FlagPayloadEnvelope.ignoredNudge(new FlagPayloadEnvelope.IgnoredNudge(
                cfg.category(), n, n, anchorShiftedHour, cfg.nonComplianceMinutes(), bedtimeByNight)));
    }

    /** The same +24-below-noon shift {@code MetricSeriesService.clockHour} applies to observed
     *  bedtimes, applied here to the anchor so both sides of the comparison live in one space. */
    private static double shiftedHour(LocalTime clock) {
        double fractional = clock.getHour() + clock.getMinute() / 60.0;
        return clock.getHour() < 12 ? fractional + 24 : fractional;
    }
}
