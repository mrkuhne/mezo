package io.mrkuhne.mezo.feature.wearable;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.ApnsDevicePopulator;
import io.mrkuhne.mezo.support.populator.HealthSamplePopulator;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/** Constraints of the B1 tables (mezo-r36n9.11): health_sample, apns_device, weight_log source. */
@Transactional
class HealthSchemaIT extends AbstractIntegrationTest {

    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private HealthSamplePopulator samples;
    @Autowired private ApnsDevicePopulator devices;
    @Autowired private JdbcTemplate jdbc;

    @Test
    void healthSampleRoundTripsAndRejectsUnknownMetric() {
        UUID user = databasePopulator.populateUser("a@test.local");
        samples.createSample(user, "hr-1", "heart_rate", Instant.parse("2026-11-09T07:00:00Z"), 61.0);
        assertThat(jdbc.queryForObject("select count(*) from health_sample where created_by = ?", Integer.class, user))
            .isEqualTo(1);
        assertThatThrownBy(() -> samples.createSample(user, "x-1", "steps", Instant.now(), 1.0))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void healthSampleExternalIdIsUniquePerOwner() {
        UUID user = databasePopulator.populateUser("a@test.local");
        samples.createSample(user, "hr-1", "heart_rate", Instant.parse("2026-11-09T07:00:00Z"), 61.0);
        assertThatThrownBy(() -> samples.createSample(user, "hr-1", "hrv_sdnn", Instant.now(), 40.0))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void apnsDeviceEnvironmentIsChecked() {
        UUID user = databasePopulator.populateUser("a@test.local");
        devices.createDevice(user, UUID.randomUUID(), "abcd", "sandbox");
        assertThatThrownBy(() -> devices.createDevice(user, UUID.randomUUID(), "abcd", "staging"))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void apnsDeviceIdIsUniqueWhileLive() {
        UUID a = databasePopulator.populateUser("a@test.local");
        UUID b = databasePopulator.populateUser("b@test.local");
        UUID device = UUID.randomUUID();
        devices.createDevice(a, device, "abcd", "sandbox");
        assertThatThrownBy(() -> devices.createDevice(b, device, "ef01", "sandbox"))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void weightLogDefaultsToManualAndRejectsUnknownSource() {
        UUID user = databasePopulator.populateUser("a@test.local");
        jdbc.update("insert into weight_log (created_by, date, weight_kg) values (?, current_date, 80)", user);
        assertThat(jdbc.queryForObject("select source from weight_log where created_by = ?", String.class, user))
            .isEqualTo("manual");
        assertThatThrownBy(() -> jdbc.update(
            "insert into weight_log (created_by, date, weight_kg, source) values (?, current_date, 80, 'scale')", user))
            .isInstanceOf(DataIntegrityViolationException.class);
    }
}
