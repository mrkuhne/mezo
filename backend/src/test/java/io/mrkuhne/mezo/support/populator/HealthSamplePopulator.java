package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.wearable.entity.HealthSampleEntity;
import io.mrkuhne.mezo.feature.wearable.repository.HealthSampleRepository;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for HealthSample (Boop B1, mezo-r36n9.11) — persisted with {@code saveAndFlush}
 *  so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class HealthSamplePopulator {

    private final HealthSampleRepository repository;

    public HealthSampleEntity createSample(UUID owner, String externalId, String metric, Instant start, double value) {
        HealthSampleEntity e = new HealthSampleEntity();
        e.setCreatedBy(owner);
        e.setExternalId(externalId);
        e.setMetric(metric);
        e.setStartAt(start);
        e.setEndAt(start);
        e.setValue(value);
        return repository.saveAndFlush(e);
    }
}
