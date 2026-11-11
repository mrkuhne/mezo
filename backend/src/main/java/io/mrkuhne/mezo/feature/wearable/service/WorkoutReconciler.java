package io.mrkuhne.mezo.feature.wearable.service;

import io.mrkuhne.mezo.feature.train.service.LoggedSession;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Read-time matcher between a Health workout and the sessions the owner logged in train (Boop B1,
 * mezo-r36n9.11). Pure: no I/O, so a session logged after the sync still matches. A candidate
 * matches when its time fits (overlap of at least {@code reconcileMinOverlapRatio} of the SHORTER
 * interval, or starts at most {@code reconcileMaxStartGapMinutes} apart) AND the activity fits;
 * among several the largest overlap wins (ties: the closer start). A candidate without a start
 * (sport with no clock time) never matches; one without an end matches on the start gap only.
 */
@Component
public class WorkoutReconciler {

    private static final Set<String> STRENGTH = Set.of("strength", "hiit", "other", "traditionalstrengthtraining", "functionalstrengthtraining",
        "highintensityintervaltraining", "crosstraining");
    private static final Set<String> VOLLEYBALL = Set.of("volleyball", "other");
    private static final String SPORT_VOLLEYBALL = "volleyball";

    private final double minOverlapRatio;
    private final long maxStartGapMinutes;

    @Autowired
    public WorkoutReconciler(WearableProperties props) {
        this(props.reconcileMinOverlapRatio(), props.reconcileMaxStartGapMinutes());
    }

    public WorkoutReconciler(double minOverlapRatio, long maxStartGapMinutes) {
        this.minOverlapRatio = minOverlapRatio;
        this.maxStartGapMinutes = maxStartGapMinutes;
    }

    /** The Health side of the match; kcal / avgHr ride along for the caller, the matcher ignores them. */
    public record HealthWorkout(String activityType, Instant start, Instant end, Integer kcal, Integer avgHr) {}

    /** The logged session this Health workout is, or empty. */
    public Optional<LoggedSession> match(HealthWorkout workout, List<LoggedSession> sessions) {
        if (workout.start() == null || workout.end() == null || !workout.end().isAfter(workout.start())) {
            return Optional.empty();
        }
        return sessions.stream()
            .filter(s -> s.start() != null && activityFits(workout.activityType(), s) && timeFits(workout, s))
            .max(Comparator.<LoggedSession>comparingLong(s -> overlapMillis(workout, s))
                .thenComparing(Comparator.<LoggedSession>comparingLong(s -> startGapMillis(workout, s)).reversed()));
    }

    private boolean timeFits(HealthWorkout w, LoggedSession s) {
        if (startGapMillis(w, s) <= Duration.ofMinutes(maxStartGapMinutes).toMillis()) {
            return true;
        }
        if (s.end() == null) {
            return false;
        }
        long shorter = Math.min(Duration.between(w.start(), w.end()).toMillis(),
            Duration.between(s.start(), s.end()).toMillis());
        return shorter > 0 && overlapMillis(w, s) >= minOverlapRatio * shorter;
    }

    private static long overlapMillis(HealthWorkout w, LoggedSession s) {
        if (s.end() == null) {
            return 0;
        }
        Instant from = w.start().isAfter(s.start()) ? w.start() : s.start();
        Instant to = w.end().isBefore(s.end()) ? w.end() : s.end();
        return Math.max(0, Duration.between(from, to).toMillis());
    }

    private static long startGapMillis(HealthWorkout w, LoggedSession s) {
        return Math.abs(Duration.between(w.start(), s.start()).toMillis());
    }

    private static boolean activityFits(String activityType, LoggedSession s) {
        String a = activityType == null ? "" : activityType.toLowerCase(Locale.ROOT);
        return switch (s.kind()) {
            case GYM -> STRENGTH.contains(a);
            case SPORT -> {
                String sport = s.sport() == null ? SPORT_VOLLEYBALL : s.sport().toLowerCase(Locale.ROOT);
                yield SPORT_VOLLEYBALL.equals(sport) ? VOLLEYBALL.contains(a) : STRENGTH.contains(a);
            }
        };
    }
}
