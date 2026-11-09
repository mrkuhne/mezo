package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.wearable.entity.WearableWorkoutEntity;
import io.mrkuhne.mezo.feature.wearable.repository.WearableWorkoutRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for WearableWorkout (Boop S2, mezo-r36n9.2) — one populator per aggregate,
 *  persisted with {@code saveAndFlush} so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class WearableWorkoutPopulator {

    private final WearableWorkoutRepository repository;

    public WearableWorkoutEntity createWorkout(UUID owner, String externalId, LocalDate date, String activityType,
                                               Instant start, Instant end) {
        WearableWorkoutEntity e = new WearableWorkoutEntity();
        e.setCreatedBy(owner);
        e.setExternalId(externalId);
        e.setDate(date);
        e.setActivityType(activityType);
        e.setStartAt(start);
        e.setEndAt(end);
        return repository.saveAndFlush(e);
    }
}
