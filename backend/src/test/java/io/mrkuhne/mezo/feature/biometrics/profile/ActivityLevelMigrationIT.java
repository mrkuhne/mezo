package io.mrkuhne.mezo.feature.biometrics.profile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.biometrics.profile.repository.BiometricProfileRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Proves the reframed activity_level CHECK (changeset {@code mezo-eujg}) accepts a new NEAT band
 * (DESK|MIXED|PHYSICAL) and rejects a legacy PAL band (e.g. MODERATE). Persists via repository
 * {@code saveAndFlush} so the DB CHECK actually fires.
 */
@Transactional
class ActivityLevelMigrationIT extends AbstractIntegrationTest {

    @Autowired private BiometricProfileRepository repository;
    @Autowired private DatabasePopulator databasePopulator;

    private BiometricProfileEntity profile(UUID owner, String level) {
        BiometricProfileEntity e = new BiometricProfileEntity();
        e.setCreatedBy(owner);
        e.setSex("M");
        e.setHeightCm(new BigDecimal("180.0"));
        e.setBirthDate(LocalDate.of(1991, 3, 1));
        e.setActivityLevel(level);
        return e;
    }

    @Test
    void testCheck_shouldAcceptNewBand_whenPhysical() {
        UUID user = databasePopulator.populateUser("neat-ok@test.local");
        BiometricProfileEntity saved = repository.saveAndFlush(profile(user, "PHYSICAL"));
        assertThat(saved.getActivityLevel()).isEqualTo("PHYSICAL");
    }

    @Test
    void testCheck_shouldRejectLegacyBand_whenModerate() {
        UUID user = databasePopulator.populateUser("neat-legacy@test.local");
        assertThatThrownBy(() -> repository.saveAndFlush(profile(user, "MODERATE")))
            .isInstanceOf(Exception.class); // DB CHECK violation
    }
}
