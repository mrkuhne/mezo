package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.wearable.entity.DailyMetricEntity;
import io.mrkuhne.mezo.feature.wearable.repository.DailyMetricRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for DailyMetric (Boop S2, mezo-r36n9.2) — one populator per aggregate,
 *  persisted with {@code saveAndFlush} so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class DailyMetricPopulator {

    private final DailyMetricRepository repository;

    public DailyMetricEntity createDay(UUID owner, LocalDate date, int steps, int restingHr) {
        DailyMetricEntity e = new DailyMetricEntity();
        e.setCreatedBy(owner);
        e.setDate(date);
        e.setSteps(steps);
        e.setRestingHr(restingHr);
        e.setUpdatedAt(Instant.now());
        return repository.saveAndFlush(e);
    }
}
