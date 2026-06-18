package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.biometrics.profile.repository.BiometricProfileRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for the BiometricProfile aggregate — see
 * docs/references/integration_test_framework.md (one populator per aggregate). Persists via
 * repository {@code saveAndFlush} so DB CHECKs / the one-per-owner UNIQUE fire.
 */
@TestComponent
@RequiredArgsConstructor
public class BiometricProfilePopulator {

    private final BiometricProfileRepository repository;

    /** Persists a default profile for {@code owner} and flushes so DB CHECKs fire. */
    public BiometricProfileEntity create(UUID owner) {
        BiometricProfileEntity e = new BiometricProfileEntity();
        e.setCreatedBy(owner);
        e.setSex("M");
        e.setHeightCm(new BigDecimal("180.0"));
        e.setBirthDate(LocalDate.of(1991, 3, 1));
        e.setBodyFatPct(new BigDecimal("15.0"));
        return repository.saveAndFlush(e);
    }
}
