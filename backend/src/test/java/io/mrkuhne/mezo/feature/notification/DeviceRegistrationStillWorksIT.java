package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ApnsDeviceIn;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Web retirement guard (mezo-r36n9.97.7, spec 2026-11-19 §3 "Push"): browser web push left the
 * server, but the iPhone's APNs device registration — which lives in the same {@code
 * feature.notification} package — must keep working exactly as before. Passes before and after
 * the removal.
 */
class DeviceRegistrationStillWorksIT extends ApiIntegrationTest {

    private static final String TOKEN = "ef".repeat(32);

    @Autowired private JdbcTemplate jdbc;

    @Test
    void testRegister_shouldStoreDevice_whenIphoneRegistersApnsToken() {
        RegisteredUser user = registerUser("ApnsStays");
        UUID deviceId = UUID.randomUUID();
        ApnsDeviceIn body = new ApnsDeviceIn().deviceId(deviceId).token(TOKEN)
            .environment(ApnsDeviceIn.EnvironmentEnum.PRODUCTION).bundleId("io.mrkuhne.boop").appVersion("1.0");

        putForBody("/api/devices/apns", body, user.headers(), HttpStatus.NO_CONTENT, String.class);

        List<Map<String, Object>> rows = jdbc.queryForList(
            "select * from apns_device where device_id = ? and is_deleted = false", deviceId);
        assertThat(rows).singleElement().satisfies(row -> {
            assertThat(row.get("token")).isEqualTo(TOKEN);
            assertThat(row.get("environment")).isEqualTo("production");
            assertThat(row.get("created_by")).isEqualTo(user.id());
        });

        deleteAndExpect("/api/devices/apns/" + deviceId, user.headers(), HttpStatus.NO_CONTENT);
        assertThat(jdbc.queryForList(
            "select 1 from apns_device where device_id = ? and is_deleted = false", deviceId)).isEmpty();
    }
}
