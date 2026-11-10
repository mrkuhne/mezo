package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.boop.entity.WorkoutTimeOverrideEntity;
import io.mrkuhne.mezo.feature.boop.repository.WorkoutTimeOverrideRepository;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for WorkoutTimeOverride (Boop S3, mezo-r36n9.7) — persisted with {@code saveAndFlush}. */
@TestComponent
@RequiredArgsConstructor
public class WorkoutTimeOverridePopulator {

    private final WorkoutTimeOverrideRepository repository;

    public WorkoutTimeOverrideEntity createOverride(UUID owner, LocalDate date, LocalTime time) {
        WorkoutTimeOverrideEntity e = new WorkoutTimeOverrideEntity();
        e.setCreatedBy(owner);
        e.setDate(date);
        e.setTime(time);
        return repository.saveAndFlush(e);
    }
}
