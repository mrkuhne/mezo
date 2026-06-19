package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for the WeightLog aggregate — see
 * docs/references/integration_test_framework.md (one populator per aggregate). Persists via
 * repository {@code saveAndFlush} so DB CHECKs fire. Seeds the raw {@code {date, weightKg}}
 * rows the EWMA weight-trend engine reads via {@code findAllOwned}.
 */
@TestComponent
@RequiredArgsConstructor
public class WeightLogPopulator {

    private final WeightLogRepository weightLogRepository;

    /** Persists a single weigh-in for {@code owner} on {@code date}. */
    public WeightLogEntity createWeightLog(UUID owner, LocalDate date, BigDecimal weightKg) {
        WeightLogEntity e = new WeightLogEntity();
        e.setCreatedBy(owner); // ownership set server-side style
        e.setDate(date);
        e.setWeightKg(weightKg);
        return weightLogRepository.saveAndFlush(e);
    }
}
