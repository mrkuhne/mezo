package io.mrkuhne.mezo.feature.train.port;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Train-owned seam to the Health workouts the phone synced (Boop Sport S2, mezo-r36n9.202): the Sport area pairs a
 * Watch workout with tonight's sport for the pre-fill. The wearable feature supplies the adapter (wearable → train
 * already exists; train → wearable would be a cycle).
 */
public interface SportHealthPort {

    /** The owner's Health workouts dated {@code from..to}, in date order. */
    List<HealthWorkout> workouts(UUID owner, LocalDate from, LocalDate to);

    /** One Health workout; {@code kcal} / {@code avgHr} null when the source did not record them. */
    record HealthWorkout(String activityType, Instant start, Instant end, Integer kcal, Integer avgHr) {

        /** Whole minutes from start to end; 0 when either is missing or the span is empty. */
        public int minutes() {
            return start != null && end != null && end.isAfter(start)
                ? (int) java.time.Duration.between(start, end).toMinutes() : 0;
        }
    }
}
