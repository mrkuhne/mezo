package io.mrkuhne.mezo.feature.wearable.service;

import io.mrkuhne.mezo.api.dto.IngestResult;
import io.mrkuhne.mezo.api.dto.WorkoutIn;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.feature.wearable.repository.WearableWorkoutRepository;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Apple Health workouts → {@code wearable_workout}, keyed by the client's external id (mezo-r36n9.2).
 *  {@code date} is the local start day in {@code mezo.wearable.zone}. */
@Service
@RequiredArgsConstructor
public class WearableWorkoutService {

    private final WearableWorkoutRepository repository;
    private final WearableProperties properties;

    @Transactional
    public IngestResult ingest(UUID createdBy, List<WorkoutIn> workouts) {
        WearableBatches.requireAtMost(workouts.size(), properties.maxWorkouts());
        ZoneId zone = ZoneId.of(properties.zone());
        Set<String> existing = new HashSet<>(
            repository.findExistingExternalIds(createdBy, workouts.stream().map(WorkoutIn::getExternalId).toList()));
        Set<String> seen = new HashSet<>();
        int inserted = 0;
        for (WorkoutIn w : workouts) {
            repository.upsert(createdBy, w.getExternalId(), w.getStartAt().atZoneSameInstant(zone).toLocalDate(),
                w.getActivityType(), w.getStartAt().toInstant(), w.getEndAt().toInstant(), w.getKcal(), w.getAvgHr(),
                w.getSourceName());
            if (!existing.contains(w.getExternalId()) && seen.add(w.getExternalId())) {
                inserted++;
            }
        }
        return new IngestResult(inserted, workouts.size() - inserted);
    }
}
