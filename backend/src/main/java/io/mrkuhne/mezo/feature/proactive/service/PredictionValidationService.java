package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.PredictionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * P1 deterministic prediction validation (spec §5 "a job evaluates closed windows deterministically
 * where possible"): PURE CODE, LLM-free. For each pending prediction whose window has closed
 * (valid_to &lt; today), compares the window's metric against the preceding 7 days and flips the
 * status to validated|missed with a code-formatted {@code actual}. No data in either compare window
 * ⇒ the row stays pending (honest — no fabricated verdict, §9 decision u).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class PredictionValidationService {

    private record Verdict(String direction, String actualText) {
    }

    private final PredictionRepository predictionRepository;
    private final WeightLogRepository weightLogRepository;
    private final SleepLogRepository sleepLogRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ProactiveProperties properties;

    @Transactional
    public int validateClosedWindows(UUID userId, LocalDate today) {
        List<PredictionEntity> due = predictionRepository
                .findByCreatedByAndStatusAndValidToBefore(userId, PredictionEntity.STATUS_PENDING, today);
        int closed = 0;
        for (PredictionEntity p : due) {
            Verdict v = evaluate(userId, p);
            if (v == null) {
                continue;   // no data in a compare window — stays pending (§9 decision u)
            }
            p.setStatus(v.direction().equals(p.getExpectedDirection())
                    ? PredictionEntity.STATUS_VALIDATED
                    : PredictionEntity.STATUS_MISSED);
            p.setActual(v.actualText());
            predictionRepository.saveAndFlush(p);
            closed++;
        }
        return closed;
    }

    private Verdict evaluate(UUID userId, PredictionEntity p) {
        LocalDate winFrom = p.getValidFrom();
        LocalDate winTo = p.getValidTo();
        LocalDate baseFrom = winFrom.minusDays(7);
        return switch (p.getMetricKey()) {
            case PredictionEntity.METRIC_WEIGHT_TREND -> weightVerdict(userId, winFrom, winTo, baseFrom);
            case PredictionEntity.METRIC_SLEEP_AVG -> sleepVerdict(userId, winFrom, winTo, baseFrom);
            case PredictionEntity.METRIC_TRAINING_VOLUME -> volumeVerdict(userId, winFrom, winTo, baseFrom);
            default -> null;
        };
    }

    private Verdict weightVerdict(UUID userId, LocalDate winFrom, LocalDate winTo, LocalDate baseFrom) {
        List<WeightLogEntity> all = weightLogRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, baseFrom);
        BigDecimal win = avg(all.stream()
                .filter(w -> inRange(w.getDate(), winFrom, winTo))
                .map(WeightLogEntity::getWeightKg).toList());
        BigDecimal base = avg(all.stream()
                .filter(w -> inRange(w.getDate(), baseFrom, winFrom.minusDays(1)))
                .map(WeightLogEntity::getWeightKg).toList());
        if (win == null || base == null) {
            return null;
        }
        BigDecimal delta = win.subtract(base);
        String dir = direction(delta, properties.prediction().weightEpsilonKg());
        return new Verdict(dir, "átlag " + round1(win) + " kg vs " + round1(base) + " kg (" + signed(delta) + ")");
    }

    private Verdict sleepVerdict(UUID userId, LocalDate winFrom, LocalDate winTo, LocalDate baseFrom) {
        List<SleepLogEntity> all = sleepLogRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, baseFrom);
        BigDecimal win = avg(all.stream()
                .filter(s -> inRange(s.getDate(), winFrom, winTo))
                .map(SleepLogEntity::getDurationH).toList());
        BigDecimal base = avg(all.stream()
                .filter(s -> inRange(s.getDate(), baseFrom, winFrom.minusDays(1)))
                .map(SleepLogEntity::getDurationH).toList());
        if (win == null || base == null) {
            return null;
        }
        BigDecimal delta = win.subtract(base);
        String dir = direction(delta, properties.prediction().sleepEpsilonH());
        return new Verdict(dir, "átlag " + round1(win) + " h vs " + round1(base) + " h (" + signed(delta) + ")");
    }

    private Verdict volumeVerdict(UUID userId, LocalDate winFrom, LocalDate winTo, LocalDate baseFrom) {
        int win = workoutSessionRepository.findDoneInstanceDates(userId, winFrom, winTo).size();
        int base = workoutSessionRepository.findDoneInstanceDates(userId, baseFrom, winFrom.minusDays(1)).size();
        if (win == 0 && base == 0) {
            return null;   // no training either side — no honest verdict
        }
        int delta = win - base;
        String dir = delta > 0 ? PredictionEntity.DIRECTION_UP
                : delta < 0 ? PredictionEntity.DIRECTION_DOWN
                : PredictionEntity.DIRECTION_STABLE;
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
        BigDecimal sum = present.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(present.size()), 3, RoundingMode.HALF_UP);
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
