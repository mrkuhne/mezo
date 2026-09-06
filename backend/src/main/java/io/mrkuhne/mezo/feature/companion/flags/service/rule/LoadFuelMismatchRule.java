package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * 7-day training load vs. fuel/sleep conjunction (spec 2026-09-03 §4 row 2, rank 2):
 * {@code COMBINED_LOAD_MIN} 7-day average at or above {@code loadThreshold} AND (7-day
 * {@code DAILY_KCAL} average below {@code kcalFractionOfTarget} of the day's target OR 7-day
 * {@code SLEEP_DURATION_H} average below {@code sleepFloorHours}).
 *
 * <p><b>The honesty gate cannot be counted from the load series.</b> {@code COMBINED_LOAD_MIN} is
 * one of {@link MetricSeriesService}'s two calendar-complete metrics — an unlogged training day is
 * a real {@code 0.0}, indistinguishable from a rest day. So "≥{@code minLoggedDaysPerSide} logged
 * days" is counted independently from the SPARSE {@code DAILY_KCAL} and {@code SLEEP_DURATION_H}
 * series, where a missing day genuinely is absent. A side whose gate fails simply cannot fire —
 * it never counts as compliant OR as violating.
 *
 * <p>The kcal target comes from {@link FuelDayService#getDay}, the same accessor
 * {@code MetricSeriesService.fuelRollup} and {@code MesoContextAssembler.kcalTargets} use: the
 * active goal's prescribed recept segment when one covers the date, else the configured
 * {@code mezo.nutrition} fallback (day-type adjusted at serve time). Paired per logged-kcal-day
 * so the fraction never mixes a target from a day whose consumption is unknown.
 *
 * <p>{@code WEIGHT_TREND_PCT_WK} is embedded as a CORROBORATING FACT only (spec §4 row 10's last
 * clause) — it is read when available and never gates or triggers the raise.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class LoadFuelMismatchRule implements FlagRule {

    private static final String ARM_KCAL = "kcal";
    private static final String ARM_SLEEP = "sleep";
    private static final String ARM_BOTH = "both";

    private final MetricSeriesService metricSeriesService;
    private final FuelDayService fuelDayService;
    private final FlagProperties properties;

    @Override
    public FlagVerdict evaluate(UUID userId, LocalDate today) {
        FlagProperties.LoadFuelMismatch cfg = properties.loadFuelMismatch();
        LocalDate from = today.minusDays(cfg.windowDays() - 1L);

        // COMBINED_LOAD_MIN is calendar-complete — every day in [from, today] has a real value.
        Map<LocalDate, Double> loadSeries =
            metricSeriesService.series(userId, MetricKey.COMBINED_LOAD_MIN, from, today);
        double loadSum = 0.0;
        for (LocalDate day = from; !day.isAfter(today); day = day.plusDays(1)) {
            loadSum += loadSeries.getOrDefault(day, 0.0);
        }
        double loadAvg = loadSum / cfg.windowDays();
        if (loadAvg < cfg.loadThreshold()) {
            return FlagVerdict.clear(FlagKey.LOAD_FUEL_MISMATCH, new FlagVerdict.ClearEvidence(
                "load_avg_min", loadAvg, cfg.loadThreshold(), null));
        }

        // Sparse series: a missing day is a genuine absence, so the logged-day count MUST come
        // from these, never from the calendar-complete load series above.
        Map<LocalDate, Double> kcalSeries =
            metricSeriesService.series(userId, MetricKey.DAILY_KCAL, from, today);
        Map<LocalDate, Double> sleepSeries =
            metricSeriesService.series(userId, MetricKey.SLEEP_DURATION_H, from, today);

        int kcalLoggedDaysRaw = countInWindow(kcalSeries, from, today);
        int sleepLoggedDays = countInWindow(sleepSeries, from, today);

        boolean kcalRawGateOk = kcalLoggedDaysRaw >= cfg.minLoggedDaysPerSide();
        boolean sleepGateOk = sleepLoggedDays >= cfg.minLoggedDaysPerSide();
        if (!kcalRawGateOk && !sleepGateOk) {
            return FlagVerdict.unavailable(FlagKey.LOAD_FUEL_MISMATCH,
                UnavailableReason.NOT_ENOUGH_LOGGED_DAYS);
        }

        // Frozen and gated on the SAME count. kcalLoggedDaysRaw only screens whether pairing is
        // worth attempting; the number that actually backs the average — and that the honesty
        // gate is really about — is `paired`: a day counts only once it has BOTH a logged kcal
        // value AND a resolvable target. A day whose target fails to resolve must not inflate
        // the logged-day count the card (and the gate) rely on.
        Double kcalAvg = null;
        Double kcalTargetAvg = null;
        Double kcalFraction = null;
        int kcalLoggedDays = kcalLoggedDaysRaw;
        boolean kcalArmFires = false;
        if (kcalRawGateOk) {
            double kcalConsumedSum = 0.0;
            double kcalTargetSum = 0.0;
            int paired = 0;
            for (Map.Entry<LocalDate, Double> e : kcalSeries.entrySet()) {
                LocalDate day = e.getKey();
                if (day.isBefore(from) || day.isAfter(today)) {
                    continue;
                }
                BigDecimal target = dayKcalTarget(userId, day);
                if (target == null) {
                    continue;
                }
                kcalConsumedSum += e.getValue();
                kcalTargetSum += target.doubleValue();
                paired++;
            }
            kcalLoggedDays = paired;
            if (paired >= cfg.minLoggedDaysPerSide()) {
                kcalAvg = kcalConsumedSum / paired;
                kcalTargetAvg = kcalTargetSum / paired;
                kcalFraction = kcalAvg / kcalTargetAvg;
                kcalArmFires = kcalFraction < cfg.kcalFractionOfTarget();
            }
        }

        Double sleepAvg = null;
        boolean sleepArmFires = false;
        if (sleepGateOk) {
            double sleepSum = 0.0;
            for (LocalDate day = from; !day.isAfter(today); day = day.plusDays(1)) {
                Double v = sleepSeries.get(day);
                if (v != null) {
                    sleepSum += v;
                }
            }
            sleepAvg = sleepSum / sleepLoggedDays;
            sleepArmFires = sleepAvg < cfg.sleepFloorHours();
        }

        if (!kcalArmFires && !sleepArmFires) {
            return FlagVerdict.clear(FlagKey.LOAD_FUEL_MISMATCH, new FlagVerdict.ClearEvidence(
                "fuel_arms_fired", 0.0, 1.0, null));
        }
        String firedArm = kcalArmFires && sleepArmFires ? ARM_BOTH
            : kcalArmFires ? ARM_KCAL : ARM_SLEEP;

        Double weightTrendPctWk = metricSeriesService
            .series(userId, MetricKey.WEIGHT_TREND_PCT_WK, today, today)
            .get(today);

        return FlagVerdict.raised(FlagKey.LOAD_FUEL_MISMATCH,
            FlagPayloadEnvelope.loadFuelMismatch(new FlagPayloadEnvelope.LoadFuelMismatch(
                cfg.windowDays(), loadAvg, cfg.loadThreshold(),
                kcalAvg, kcalTargetAvg, kcalFraction, cfg.kcalFractionOfTarget(), kcalLoggedDays,
                sleepAvg, cfg.sleepFloorHours(), sleepLoggedDays,
                cfg.minLoggedDaysPerSide(),
                firedArm,
                weightTrendPctWk)));
    }

    private static int countInWindow(Map<LocalDate, Double> series, LocalDate from, LocalDate to) {
        int count = 0;
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            if (series.containsKey(day)) {
                count++;
            }
        }
        return count;
    }

    /** The kcal TARGET for one day — the goal recept segment when one covers the date, else the
     *  configured fallback (day-type adjusted): the same accessor {@link FuelDayService#getDay}
     *  resolves for the Fuel-day MacroHero and {@code ContextSnapshotAssembler#fuelBlock}. */
    private BigDecimal dayKcalTarget(UUID userId, LocalDate day) {
        FuelDayResponse response = fuelDayService.getDay(userId, day);
        MacroSet targets = response.getTargets();
        return targets == null ? null : targets.getKcal();
    }
}
