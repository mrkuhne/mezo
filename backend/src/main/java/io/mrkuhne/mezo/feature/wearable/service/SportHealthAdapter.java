package io.mrkuhne.mezo.feature.wearable.service;

import io.mrkuhne.mezo.feature.train.port.SportHealthPort;
import io.mrkuhne.mezo.feature.wearable.repository.WearableWorkoutRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Supplies train's {@link SportHealthPort} from the synced Health workouts (Boop Sport S2, mezo-r36n9.202). */
@Component
@RequiredArgsConstructor
public class SportHealthAdapter implements SportHealthPort {

    private final WearableWorkoutRepository workouts;

    @Override
    @Transactional(readOnly = true)
    public List<HealthWorkout> workouts(UUID owner, LocalDate from, LocalDate to) {
        return workouts.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDate(owner, from, to).stream()
            .map(w -> new HealthWorkout(w.getActivityType(), w.getStartAt(), w.getEndAt(), w.getKcal(), w.getAvgHr()))
            .toList();
    }
}
