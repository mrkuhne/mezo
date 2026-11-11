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

/** Boop B1 (mezo-r36n9.11): APNs device registration — upsert, takeover, token supersede, idempotent delete. */
class ApnsDeviceContractIT extends ApiIntegrationTest {

    @Autowired private JdbcTemplate jdbc;

    private static final String TOKEN_A = "ab".repeat(32);
    private static final String TOKEN_B = "cd".repeat(32);

    private static ApnsDeviceIn body(UUID deviceId, String token) {
        return new ApnsDeviceIn().deviceId(deviceId).token(token).environment(ApnsDeviceIn.EnvironmentEnum.SANDBOX)
            .bundleId("io.mrkuhne.boop").appVersion("1.0");
    }

    private List<Map<String, Object>> live(UUID deviceId) {
        return jdbc.queryForList("select * from apns_device where device_id = ? and is_deleted = false", deviceId);
    }

    @Test
    void registerThenReRegisterUpdatesTokenAndLastSeen() {
        RegisteredUser u = registerUser("Apns1");
        UUID dev = UUID.randomUUID();
        putForBody("/api/devices/apns", body(dev, TOKEN_A), u.headers(), HttpStatus.NO_CONTENT, String.class);
        var first = live(dev).getFirst();
        assertThat(first.get("token")).isEqualTo(TOKEN_A);
        assertThat(first.get("created_by")).isEqualTo(u.id());
        putForBody("/api/devices/apns", body(dev, TOKEN_B).appVersion("1.1"), u.headers(), HttpStatus.NO_CONTENT, String.class);
        assertThat(live(dev)).hasSize(1);
        var second = live(dev).getFirst();
        assertThat(second.get("token")).isEqualTo(TOKEN_B);
        assertThat(second.get("app_version")).isEqualTo("1.1");
        assertThat(second.get("id")).isEqualTo(first.get("id"));
        assertThat(((java.sql.Timestamp) second.get("last_seen_at")).toInstant())
            .isAfterOrEqualTo(((java.sql.Timestamp) first.get("last_seen_at")).toInstant());
    }

    @Test
    void anotherAccountTakesOverTheDevice() {
        RegisteredUser a = registerUser("Apns2a");
        RegisteredUser b = registerUser("Apns2b");
        UUID dev = UUID.randomUUID();
        putForBody("/api/devices/apns", body(dev, TOKEN_A), a.headers(), HttpStatus.NO_CONTENT, String.class);
        putForBody("/api/devices/apns", body(dev, TOKEN_A), b.headers(), HttpStatus.NO_CONTENT, String.class);
        assertThat(live(dev)).singleElement().satisfies(r -> assertThat(r.get("created_by")).isEqualTo(b.id()));
    }

    @Test
    void sameTokenOnNewDeviceIdSupersedesTheOlderRow() {
        RegisteredUser u = registerUser("Apns3");
        UUID oldDev = UUID.randomUUID();
        UUID newDev = UUID.randomUUID();
        putForBody("/api/devices/apns", body(oldDev, TOKEN_A), u.headers(), HttpStatus.NO_CONTENT, String.class);
        putForBody("/api/devices/apns", body(newDev, TOKEN_A), u.headers(), HttpStatus.NO_CONTENT, String.class);
        assertThat(live(oldDev)).isEmpty();
        assertThat(live(newDev)).hasSize(1);
    }

    @Test
    void deleteIsIdempotentAndOwnDeviceOnly() {
        RegisteredUser a = registerUser("Apns4a");
        RegisteredUser b = registerUser("Apns4b");
        UUID dev = UUID.randomUUID();
        putForBody("/api/devices/apns", body(dev, TOKEN_A), a.headers(), HttpStatus.NO_CONTENT, String.class);
        deleteAndExpect("/api/devices/apns/" + dev, b.headers(), HttpStatus.NO_CONTENT);
        assertThat(live(dev)).hasSize(1);
        deleteAndExpect("/api/devices/apns/" + dev, a.headers(), HttpStatus.NO_CONTENT);
        assertThat(live(dev)).isEmpty();
        deleteAndExpect("/api/devices/apns/" + dev, a.headers(), HttpStatus.NO_CONTENT);
        deleteAndExpect("/api/devices/apns/" + UUID.randomUUID(), a.headers(), HttpStatus.NO_CONTENT);
    }

    @Test
    void unauthenticatedIs401AndBadTokenIs400() {
        UUID dev = UUID.randomUUID();
        putForBody("/api/devices/apns", body(dev, TOKEN_A), null, HttpStatus.UNAUTHORIZED, String.class);
        deleteAndExpect("/api/devices/apns/" + dev, null, HttpStatus.UNAUTHORIZED);
        RegisteredUser u = registerUser("Apns5");
        putForBody("/api/devices/apns", body(dev, "not-hex"), u.headers(), HttpStatus.BAD_REQUEST, String.class);
        putForBody("/api/devices/apns", body(dev, "ab".repeat(10)), u.headers(), HttpStatus.BAD_REQUEST, String.class);
        assertThat(live(dev)).isEmpty();
    }
}
