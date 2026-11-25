package io.mrkuhne.mezo.feature.wearable.service;

import io.mrkuhne.mezo.feature.train.service.LoggedSession;
import io.mrkuhne.mezo.feature.train.service.WatchWorkoutEnergyPort;
import io.mrkuhne.mezo.feature.wearable.entity.WearableWorkoutEntity;
import io.mrkuhne.mezo.feature.wearable.repository.WearableWorkoutRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Train's {@link WatchWorkoutEnergyPort} (mezo-r36n9.170): the day's Health workouts run through the
 * same {@link WorkoutReconciler} Boop's day load uses, and the matched one's kcal is the answer.
 * The <b>largest</b> match wins, never the sum — Health often holds the same workout twice (two
 * sources, or one source written twice), and adding them would double the figure.
 */
@Component
@RequiredArgsConstructor
public class WatchWorkoutEnergyAdapter implements WatchWorkoutEnergyPort {

    private final WearableWorkoutRepository workouts;
    private final WorkoutReconciler reconciler;

    @Override
    public Optional<Integer> watchKcal(UUID userId, LocalDate date, LoggedSession session) {
        List<LoggedSession> candidates = List.of(session);
        return workouts.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDate(userId, date, date).stream()
            .filter(w -> w.getKcal() != null && w.getKcal() > 0)
            .filter(w -> reconciler.match(new WorkoutReconciler.HealthWorkout(w.getActivityType(), w.getStartAt(),
                w.getEndAt(), w.getKcal(), w.getAvgHr()), candidates).isPresent())
            .map(WearableWorkoutEntity::getKcal)
            .max(Integer::compare);
    }
}
