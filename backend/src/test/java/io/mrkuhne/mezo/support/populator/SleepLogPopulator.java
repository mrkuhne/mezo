package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for the SleepLog aggregate — see
 * docs/references/integration_test_framework.md (one populator per aggregate). Persists via
 * repository {@code saveAndFlush} so DB CHECKs fire. Seeds raw sleep rows for read-side tests
 * (e.g. future Insights) without going through the service write path.
 */
@TestComponent
@RequiredArgsConstructor
public class SleepLogPopulator {

    private final SleepLogRepository sleepLogRepository;

    /** Persists a single sleep log for {@code owner} on {@code date}. */
    public SleepLogEntity createSleepLog(UUID owner, LocalDate date, BigDecimal durationH, Integer quality) {
        SleepLogEntity e = new SleepLogEntity();
        e.setCreatedBy(owner); // ownership set server-side style
        e.setDate(date);
        e.setDurationH(durationH);
        e.setQuality(quality);
        return sleepLogRepository.saveAndFlush(e);
    }
}
