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
    private static final int BUCKET_MIN = 15;
    private static final int LENGTH_TOLERANCE_BUCKETS = 2;
    private static final int HYPNOGRAM_TOLERANCE_MIN = 30;
    private static final double HYPNOGRAM_TOLERANCE_PCT = 0.35;

    public record Extracted(String bedtime, String wakeup, Integer asleepMin, Integer inBedMin,
                            Integer awakeMin, Integer lightMin, Integer remMin, Integer deepMin,
                            Integer qualityPct, String hypnogram) {}

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

        if (timesParse && e.inBedMin() != null) { // timesParse already implies both times non-null
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

    /**
     * The hypnogram gate (mezo-fk9a, spec section 4) — V1 alphabet, V2 length against the
     * clock span, V3 composition against the exact per-phase minute totals. All-or-nothing:
     * a sequence with one stage misread is a wrong picture, and there is no honest partial
     * rendering. Deliberately independent of {@link #score}: confidence describes the numbers
     * the user is about to save, and a bad drawing must not scare them off good data.
     *
     * @return the sequence when every check passes, otherwise null
     */
    public String acceptedHypnogram(Extracted e) {
        String h = e.hypnogram() == null ? null : e.hypnogram().strip().toUpperCase();
        if (h == null || h.isEmpty()) {
            return null;
        }
        if (!h.matches("[DLRA]+")) { // V1
            return null;
        }
        if (!parses(e.bedtime()) || !parses(e.wakeup())) {
            return null;
        }
        int span = Math.floorMod(toMin(e.wakeup()) - toMin(e.bedtime()), 24 * 60);
        int expected = Math.round((float) span / BUCKET_MIN);
        if (Math.abs(h.length() - expected) > LENGTH_TOLERANCE_BUCKETS) { // V2
            return null;
        }
        // V3 precondition: without the three sleep-stage totals the composition is uncheckable,
        // and an uncheckable hypnogram is not worth drawing.
        if (e.deepMin() == null || e.lightMin() == null || e.remMin() == null) {
            return null;
        }
        return composesWith(h, 'D', e.deepMin()) && composesWith(h, 'L', e.lightMin())
            && composesWith(h, 'R', e.remMin())
            && (e.awakeMin() == null || composesWith(h, 'A', e.awakeMin()))
            ? h : null;
    }

    /** V3 for one stage. Loose on purpose: at 15-minute resolution a 100-minute total
     *  legitimately lands in 6-8 buckets. This catches a hallucinated sequence, not rounding. */
    private static boolean composesWith(String hypnogram, char stage, int actualMin) {
        int fromBuckets = (int) hypnogram.chars().filter(c -> c == stage).count() * BUCKET_MIN;
        double tolerance = Math.max(HYPNOGRAM_TOLERANCE_MIN, HYPNOGRAM_TOLERANCE_PCT * actualMin);
        return Math.abs(fromBuckets - actualMin) <= tolerance;
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
