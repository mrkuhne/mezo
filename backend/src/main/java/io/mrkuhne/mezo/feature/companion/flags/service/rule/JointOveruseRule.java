package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.service.MuscleGroup;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Spec 2026-09-03 §4 row 16 (rank 4, offers {@code lighten_tomorrow} — wired by a later task):
 * sport {@code SHOULDER_STRAIN} {@code windowDays}-average at or above {@code strainAvgAtLeast}
 * AND tomorrow's planned gym session is shoulder-focused.
 *
 * <p><b>Never {@link WorkoutService#getToday}.</b> Tomorrow's planned session MUST be read via
 * {@link WorkoutService#findPlannedTemplateForDate} — {@code getToday} auto-closes stale
 * instances and ensures closing exercises on EVERY call, a write a detection rule (evaluated
 * hourly for every active user by the sweep job) must never trigger as a side effect of merely
 * looking. {@code ContextSnapshotAssembler} and {@code TrainTools} carry the same comment for the
 * same reason.
 *
 * <p><b>The muscle match.</b> The session-level {@code WorkoutSessionEntity.muscle} field can
 * carry a dashed sub-zone (e.g. {@code "shoulder-lateral"}); it is normalised through
 * {@link MuscleGroup#of} — which collapses that to {@code "shoulder"} — before comparing against
 * the configured {@code muscleNeedle}, never via a raw substring test.
 *
 * <p>Honesty gate: no {@code SHOULDER_STRAIN} data points in the window ⇒ silent (never average
 * over an empty set; a sport session with a null strain is not a data point — enforced by
 * {@link MetricSeriesService}'s extractor itself); no planned session tomorrow ⇒ silent (there is
 * nothing to go lighter on).
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class JointOveruseRule implements FlagRule {

    private final MetricSeriesService metricSeriesService;
    private final WorkoutService workoutService;
    private final FlagProperties properties;

    @Override
    public FlagVerdict evaluate(UUID userId, LocalDate today) {
        FlagProperties.JointOveruse cfg = properties.jointOveruse();
        LocalDate from = today.minusDays(cfg.windowDays() - 1L);

        Map<LocalDate, Double> strainSeries =
            metricSeriesService.series(userId, MetricKey.SHOULDER_STRAIN, from, today);

        double sum = 0.0;
        int dataPoints = 0;
        for (LocalDate day = from; !day.isAfter(today); day = day.plusDays(1)) {
            Double value = strainSeries.get(day);
            if (value != null) {
                sum += value;
                dataPoints++;
            }
        }
        // Honest gate: never average over an empty set.
        if (dataPoints == 0) {
            return FlagVerdict.unavailable(FlagKey.JOINT_OVERUSE, UnavailableReason.NO_STRAIN_DATA);
        }
        double strainAvg = sum / dataPoints;
        if (strainAvg < cfg.strainAvgAtLeast()) {
            return FlagVerdict.clear(FlagKey.JOINT_OVERUSE, new FlagVerdict.ClearEvidence(
                "shoulder_strain_avg", strainAvg, cfg.strainAvgAtLeast(), null));
        }

        LocalDate tomorrow = today.plusDays(1);
        // findPlannedTemplateForDate is a READ — never getToday, which WRITES on every call.
        WorkoutSessionEntity planned =
            workoutService.findPlannedTemplateForDate(userId, tomorrow).orElse(null);
        if (planned == null) {
            return FlagVerdict.unavailable(FlagKey.JOINT_OVERUSE,
                UnavailableReason.NO_PLANNED_SESSION);
        }
        String tomorrowMuscle = MuscleGroup.of(planned.getMuscle());
        if (!cfg.muscleNeedle().equals(tomorrowMuscle)) {
            return FlagVerdict.clear(FlagKey.JOINT_OVERUSE, new FlagVerdict.ClearEvidence(
                "tomorrow_muscle", null, null, tomorrowMuscle));
        }

        return FlagVerdict.raised(FlagKey.JOINT_OVERUSE,
            FlagPayloadEnvelope.jointOveruse(new FlagPayloadEnvelope.JointOveruse(
                strainAvg, cfg.strainAvgAtLeast(), dataPoints, cfg.windowDays(),
                tomorrow.toString(), tomorrowMuscle)));
    }
}
