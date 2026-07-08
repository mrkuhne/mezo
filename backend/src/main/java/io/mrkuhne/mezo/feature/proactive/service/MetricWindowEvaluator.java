package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Shared deterministic metric comparison (proactive P1 + P2): the window's avg/count vs a
 * baseline window, per the fixed metric catalog (the {@code PredictionEntity.METRIC_*} keys).
 * LLM-free; returns null when a compare window has no data (the honest "no verdict" state).
 * Extracted from {@code PredictionValidationService} so P1 (window-close validation) and P2
 * (experiment outcome) share ONE implementation — the metric constants + epsilon config live in
 * {@code PredictionEntity} / {@code ProactiveProperties.prediction()} respectively.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class MetricWindowEvaluator {

    public record Verdict(String direction, String actualText) {
    }

    private final WeightLogRepository weightLogRepository;
    private final SleepLogRepository sleepLogRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ProactiveProperties properties;

    /**
     * The window {@code [winFrom, winTo]} vs the baseline {@code [baseFrom, baseTo]} for the given
     * metric. null = no data in a compare window (honest — no verdict).
     */
    public Verdict evaluate(UUID userId, String metricKey,
                            LocalDate winFrom, LocalDate winTo, LocalDate baseFrom, LocalDate baseTo) {
        return switch (metricKey) {
            case PredictionEntity.METRIC_WEIGHT_TREND -> weight(userId, winFrom, winTo, baseFrom, baseTo);
            case PredictionEntity.METRIC_SLEEP_AVG -> sleep(userId, winFrom, winTo, baseFrom, baseTo);
            case PredictionEntity.METRIC_TRAINING_VOLUME -> volume(userId, winFrom, winTo, baseFrom, baseTo);
            default -> null;
        };
    }

    private Verdict weight(UUID userId, LocalDate winFrom, LocalDate winTo, LocalDate baseFrom, LocalDate baseTo) {
        List<WeightLogEntity> all = weightLogRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, baseFrom);
        BigDecimal win = avg(all.stream().filter(w -> inRange(w.getDate(), winFrom, winTo))
                .map(WeightLogEntity::getWeightKg).toList());
        BigDecimal base = avg(all.stream().filter(w -> inRange(w.getDate(), baseFrom, baseTo))
                .map(WeightLogEntity::getWeightKg).toList());
        if (win == null || base == null) {
            return null;
        }
        BigDecimal delta = win.subtract(base);
        return new Verdict(direction(delta, properties.prediction().weightEpsilonKg()),
                "átlag " + round1(win) + " kg vs " + round1(base) + " kg (" + signed(delta) + ")");
    }

    private Verdict sleep(UUID userId, LocalDate winFrom, LocalDate winTo, LocalDate baseFrom, LocalDate baseTo) {
        List<SleepLogEntity> all = sleepLogRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, baseFrom);
        BigDecimal win = avg(all.stream().filter(s -> inRange(s.getDate(), winFrom, winTo))
                .map(SleepLogEntity::getDurationH).toList());
        BigDecimal base = avg(all.stream().filter(s -> inRange(s.getDate(), baseFrom, baseTo))
                .map(SleepLogEntity::getDurationH).toList());
        if (win == null || base == null) {
            return null;
        }
        BigDecimal delta = win.subtract(base);
        return new Verdict(direction(delta, properties.prediction().sleepEpsilonH()),
                "átlag " + round1(win) + " h vs " + round1(base) + " h (" + signed(delta) + ")");
    }

    private Verdict volume(UUID userId, LocalDate winFrom, LocalDate winTo, LocalDate baseFrom, LocalDate baseTo) {
        int win = workoutSessionRepository.findDoneInstanceDates(userId, winFrom, winTo).size();
        int base = workoutSessionRepository.findDoneInstanceDates(userId, baseFrom, baseTo).size();
        if (win == 0 && base == 0) {
            return null;
        }
        int delta = win - base;
        String dir = delta > 0 ? PredictionEntity.DIRECTION_UP
                : delta < 0 ? PredictionEntity.DIRECTION_DOWN : PredictionEntity.DIRECTION_STABLE;
        return new Verdict(dir, win + " edzés vs " + base + " (" + (delta >= 0 ? "+" : "") + delta + ")");
    }

    private static boolean inRange(LocalDate d, LocalDate from, LocalDate to) {
        return d != null && !d.isBefore(from) && !d.isAfter(to);
    }

    private static BigDecimal avg(List<BigDecimal> values) {
        List<BigDecimal> present = values.stream().filter(v -> v != null).toList();
        if (present.isEmpty()) {
            return null;
        }
        return present.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(present.size()), 3, RoundingMode.HALF_UP);
    }

    private static String direction(BigDecimal delta, BigDecimal epsilon) {
        if (delta.abs().compareTo(epsilon) <= 0) {
            return PredictionEntity.DIRECTION_STABLE;
        }
        return delta.signum() > 0 ? PredictionEntity.DIRECTION_UP : PredictionEntity.DIRECTION_DOWN;
    }

    private static String round1(BigDecimal v) {
        return v.setScale(1, RoundingMode.HALF_UP).toPlainString();
    }

    private static String signed(BigDecimal delta) {
        BigDecimal r = delta.setScale(1, RoundingMode.HALF_UP);
        return (r.signum() >= 0 ? "+" : "") + r.toPlainString();
    }
}
