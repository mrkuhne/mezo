package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.DoublePredicate;
import java.util.function.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class RecoveryNeededRule implements FlagRule {

    private final MetricSeriesService metricSeriesService;
    private final CheckInRepository checkInRepository;
    private final FlagProperties properties;

    /**
     * Poor sleep + high RPE + high stress inside the same short window (spec's "same 48h", read as
     * whole days with today included — the three signals rarely land on one calendar day).
     *
     * <p>Check-in 2.0 (mezo-ck2, spec 2026-09-27 §3.2): the SLEEP arm is also met by a check-in
     * {@code rested <= restedAtMost} or {@code soreness >= sorenessAtLeast} inside the same window,
     * read off the raw rows (the newest qualifying one is frozen). A NULL answer never qualifies.
     */
    @Override
    public FlagVerdict evaluate(UUID userId, LocalDate today) {
        FlagProperties.Recovery cfg = properties.recovery();
        LocalDate from = today.minusDays(cfg.windowDays() - 1L);

        Map.Entry<LocalDate, Double> poorSleep = newestMatch(
            metricSeriesService.series(userId, MetricKey.SLEEP_DURATION_H, from, today),
            v -> v <= cfg.sleepFloorHours());
        Map.Entry<LocalDate, Double> highRpe = newestMatch(
            metricSeriesService.series(userId, MetricKey.TRAINING_RPE, from, today),
            v -> v >= cfg.rpeThreshold());
        Map.Entry<LocalDate, Double> highStress = newestMatch(
            metricSeriesService.series(userId, MetricKey.CHECKIN_STRESS, from, today),
            v -> v >= cfg.stressThreshold());
        List<CheckInEntity> checkIns =
            checkInRepository.findByCreatedByAndDeletedFalseAndDateBetween(userId, from, today);
        CheckInEntity lowRested = newestCheckIn(checkIns,
            c -> c.getRested() != null && c.getRested() <= cfg.restedAtMost());
        CheckInEntity highSoreness = newestCheckIn(checkIns,
            c -> c.getSoreness() != null && c.getSoreness() >= cfg.sorenessAtLeast());
        boolean sleepArm = poorSleep != null || lowRested != null || highSoreness != null;

        if (!sleepArm || highRpe == null || highStress == null) {
            int matched = 0;
            List<String> missing = new ArrayList<>();
            if (sleepArm) {
                matched++;
            } else {
                missing.add("sleep");
            }
            if (highRpe != null) {
                matched++;
            } else {
                missing.add("rpe");
            }
            if (highStress != null) {
                matched++;
            } else {
                missing.add("stress");
            }
            return FlagVerdict.clear(FlagKey.RECOVERY_NEEDED, new FlagVerdict.ClearEvidence(
                "signals_matched", (double) matched, 3.0, String.join(",", missing)));
        }
        return FlagVerdict.raised(FlagKey.RECOVERY_NEEDED,
            FlagPayloadEnvelope.recoveryNeeded(new FlagPayloadEnvelope.RecoveryNeeded(
                cfg.windowDays(), cfg.sleepFloorHours(), cfg.rpeThreshold(), cfg.stressThreshold(),
                poorSleep == null ? null : poorSleep.getValue(),
                poorSleep == null ? null : poorSleep.getKey().toString(),
                highRpe.getValue(), highRpe.getKey().toString(),
                highStress.getValue(), highStress.getKey().toString(),
                cfg.restedAtMost(),
                lowRested == null ? null : lowRested.getRested(),
                lowRested == null ? null : lowRested.getDate().toString(),
                cfg.sorenessAtLeast(),
                highSoreness == null ? null : highSoreness.getSoreness(),
                highSoreness == null ? null : highSoreness.getDate().toString())));
    }

    /** The newest (date, then slot) check-in satisfying {@code test}, or null. */
    private static CheckInEntity newestCheckIn(List<CheckInEntity> rows, Predicate<CheckInEntity> test) {
        return rows.stream()
            .filter(test)
            .max(Comparator.comparing(CheckInEntity::getDate).thenComparing(CheckInEntity::getSlotTime))
            .orElse(null);
    }

    /** The newest day in the series whose value satisfies {@code test}, or null. */
    private static Map.Entry<LocalDate, Double> newestMatch(
        Map<LocalDate, Double> series, DoublePredicate test) {
        return series.entrySet().stream()
            .filter(e -> e.getValue() != null && test.test(e.getValue()))
            .max(Map.Entry.comparingByKey())
            .orElse(null);
    }
}
