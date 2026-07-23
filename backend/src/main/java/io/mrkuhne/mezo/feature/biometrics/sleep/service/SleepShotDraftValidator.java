package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.stream.Stream;
import org.springframework.stereotype.Component;

/**
 * Deterministic consistency scoring for a screenshot extraction (spec D6) — the LLM never
 * grades itself. confidence = passed / applicable checks; needsReview on threshold
 * (boundary-inclusive) or a missing key field (bedtime, wakeup, asleepMin).
 */
@Component
public class SleepShotDraftValidator {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");
    private static final int SPAN_TOLERANCE_MIN = 15;
    private static final double PHASE_TOLERANCE_PCT = 0.10;

    public record Extracted(String bedtime, String wakeup, Integer asleepMin, Integer inBedMin,
                            Integer awakeMin, Integer lightMin, Integer remMin, Integer deepMin,
                            Integer qualityPct) {}

    public record Score(BigDecimal confidence, boolean needsReview) {}

    public Score score(Extracted e, double threshold) {
        int applicable = 0;
        int passed = 0;

        boolean timesPresent = e.bedtime() != null || e.wakeup() != null;
        boolean timesParse = parses(e.bedtime()) && parses(e.wakeup());
        if (timesPresent) {
            applicable++;
            if (e.bedtime() != null && e.wakeup() != null && timesParse) {
                passed++;
            }
        }

        if (e.asleepMin() != null && e.inBedMin() != null) {
            applicable++;
            if (e.asleepMin() <= e.inBedMin()) {
                passed++;
            }
        }

        boolean allPhases = Stream.of(e.awakeMin(), e.lightMin(), e.remMin(), e.deepMin())
            .allMatch(p -> p != null);
        if (allPhases && e.inBedMin() != null) {
            applicable++;
            int sum = e.awakeMin() + e.lightMin() + e.remMin() + e.deepMin();
            if (Math.abs(sum - e.inBedMin()) <= PHASE_TOLERANCE_PCT * e.inBedMin()) {
                passed++;
            }
        }

        if (e.bedtime() != null && e.wakeup() != null && timesParse && e.inBedMin() != null) {
            applicable++;
            int span = Math.floorMod(toMin(e.wakeup()) - toMin(e.bedtime()), 24 * 60);
            if (Math.abs(span - e.inBedMin()) <= SPAN_TOLERANCE_MIN) {
                passed++;
            }
        }

        BigDecimal confidence = applicable == 0
            ? BigDecimal.ZERO
            : BigDecimal.valueOf(passed).divide(BigDecimal.valueOf(applicable), 2, RoundingMode.HALF_UP);
        boolean keyMissing = e.bedtime() == null || e.wakeup() == null || e.asleepMin() == null;
        boolean needsReview = keyMissing || confidence.doubleValue() <= threshold;
        return new Score(confidence, needsReview);
    }

    private static boolean parses(String hhmm) {
        if (hhmm == null) {
            return false;
        }
        try {
            LocalTime.parse(hhmm, HH_MM);
            return true;
        } catch (Exception ex) {
            return false;
        }
    }

    private static int toMin(String hhmm) {
        LocalTime t = LocalTime.parse(hhmm, HH_MM);
        return t.getHour() * 60 + t.getMinute();
    }
}
