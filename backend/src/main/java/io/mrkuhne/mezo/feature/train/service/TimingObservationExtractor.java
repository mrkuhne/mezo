package io.mrkuhne.mezo.feature.train.service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/**
 * Splits a finished session's set-completion stream into the intervals the profile learns
 * (spec 2026-09-02).
 *
 * <p>done_at marks a set's END, so an interval is always "rest + the next set's execution" —
 * rest and work cannot be separated without also capturing set starts, which would cost new UI.
 * The decomposition is therefore by BOUNDARY, not by activity:
 *
 * <ul>
 *   <li>{@code lead_in} — session start to the first completed set (warm-up block).
 *   <li>{@code set_cycle_*} — two consecutive sets of the SAME exercise, bucketed compound vs
 *       everything-else to match the frontend's restSecondsFor split.
 *   <li>{@code transition} — an interval crossing an exercise boundary (rest + changeover +
 *       the next exercise's first set).
 * </ul>
 *
 * <p>Warm-up sets are counted like any other set: the estimate that consumes this profile sums
 * over ALL sets, so measurement and use share one decomposition — which matters far more than
 * separating warm-up pacing out.
 *
 * <p>An interval longer than the gap cap is DROPPED, not clipped, and counted: a session whose
 * clipped share exceeds maxClippedRatio is too contaminated to learn from at all.
 */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class TimingObservationExtractor {

    public static final String SET_CYCLE_COMPOUND = "set_cycle_compound";
    public static final String SET_CYCLE_ISOLATION = "set_cycle_isolation";
    public static final String TRANSITION = "transition";
    public static final String LEAD_IN = "lead_in";

    /** One completed, non-skipped set: which exercise it belongs to, that exercise's type, when. */
    public record SetStamp(UUID exerciseId, String exerciseType, Instant doneAt) {}

    /** Observations plus the noise accounting the caller needs to decide whether to learn at all. */
    public record Result(List<TimingObservation> observations, int clipped, int total) {
        public boolean tooNoisy(double maxClippedRatio) {
            return total > 0 && (double) clipped / total > maxClippedRatio;
        }
    }

    public static Result extract(
            Instant startedAt, List<SetStamp> stamps, int gapCapSeconds, int leadInCapSeconds) {
        List<TimingObservation> out = new ArrayList<>();
        if (stamps == null || stamps.isEmpty()) {
            return new Result(out, 0, 0);
        }
        List<SetStamp> sorted = new ArrayList<>(stamps);
        sorted.sort(Comparator.comparing(SetStamp::doneAt));
        if (startedAt != null) {
            long leadIn = seconds(startedAt, sorted.get(0).doneAt());
            if (leadIn > 0 && leadIn <= leadInCapSeconds) {
                out.add(new TimingObservation(LEAD_IN, leadIn));
            }
        }
        int clipped = 0;
        int total = 0;
        for (int i = 1; i < sorted.size(); i++) {
            SetStamp prev = sorted.get(i - 1);
            SetStamp curr = sorted.get(i);
            long gap = seconds(prev.doneAt(), curr.doneAt());
            total++;
            if (gap <= 0 || gap > gapCapSeconds) {
                clipped++;
                continue;
            }
            out.add(new TimingObservation(componentFor(prev, curr), gap));
        }
        return new Result(out, clipped, total);
    }

    private static String componentFor(SetStamp prev, SetStamp curr) {
        if (!prev.exerciseId().equals(curr.exerciseId())) {
            return TRANSITION;
        }
        return "compound".equals(curr.exerciseType()) ? SET_CYCLE_COMPOUND : SET_CYCLE_ISOLATION;
    }

    private static long seconds(Instant from, Instant to) {
        return Duration.between(from, to).getSeconds();
    }
}
