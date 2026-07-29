package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PushSubscriptionRequest;
import io.mrkuhne.mezo.api.dto.PushTestResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.notification.repository.PushSubscriptionRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

/** HTTP-level tests for /api/notification (bd mezo-h4wp.6.1). */
class NotificationApiIT extends ApiIntegrationTest {

    @Autowired private PushSubscriptionRepository repository;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private JdbcTemplate jdbcTemplate;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private PushSubscriptionRequest request(String endpoint) {
        PushSubscriptionRequest r = new PushSubscriptionRequest();
        r.setEndpoint(endpoint);
        r.setP256dh("BOr1a2b3");
        r.setAuth("c3VwZXJzZWNyZXQ");
        r.setUserAgent("iPhone");
        return r;
    }

    @Test
    void testRegisterPushSubscription_shouldPersistOneRow_whenCalledTwiceWithTheSameEndpoint() {
        postForBody("/api/notification/subscription", request("https://p.example/a"),
                ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);
        postForBody("/api/notification/subscription", request("https://p.example/a"),
                ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);

        assertThat(repository.findAll()).hasSize(1);
    }

    @Test
    void testRegisterPushSubscription_shouldRefreshKeyMaterial_whenReSubscribingSameEndpoint() {
        PushSubscriptionRequest first = request("https://p.example/refresh");
        postForBody("/api/notification/subscription", first,
                ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);

        PushSubscriptionRequest second = request("https://p.example/refresh");
        second.setP256dh("BNewKeyMaterial");
        second.setAuth("bmV3LWF1dGgtc2VjcmV0");
        second.setUserAgent("Android");
        postForBody("/api/notification/subscription", second,
                ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);

        var rows = repository.findAll();
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().getP256dh()).isEqualTo("BNewKeyMaterial");
        assertThat(rows.getFirst().getAuth()).isEqualTo("bmV3LWF1dGgtc2VjcmV0");
        assertThat(rows.getFirst().getUserAgent()).isEqualTo("Android");
    }

    @Test
    void testUnregisterPushSubscription_shouldSoftDeleteRow_whenEndpointMatches() {
        postForBody("/api/notification/subscription", request("https://p.example/b"),
                ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);

        deleteAndExpect("/api/notification/subscription?endpoint=https://p.example/b",
                ownerAuthHeaders(), HttpStatus.NO_CONTENT);

        assertThat(repository.findAll()).isEmpty(); // @SQLRestriction hides the soft-deleted row
        // Physical row still exists, only flagged — soft delete, not a DELETE.
        Long softDeleted = jdbcTemplate.queryForObject(
                "select count(*) from push_subscription where is_deleted = true", Long.class);
        assertThat(softDeleted).isEqualTo(1L);
    }

    @Test
    void testUnregisterPushSubscription_shouldSucceed_whenEndpointUnknown() {
        deleteAndExpect("/api/notification/subscription?endpoint=https://p.example/nope",
                ownerAuthHeaders(), HttpStatus.NO_CONTENT);
    }

    @Test
    void testRegisterPushSubscription_shouldReturn401_whenUnauthenticated() {
        postForBody("/api/notification/subscription", request("https://p.example/c"),
                new HttpHeaders(), HttpStatus.UNAUTHORIZED, String.class);
    }

    @Test
    void testSendTestPush_shouldReturn200WithHonestCounts_whenNoRealPushServiceReachable() {
        UUID owner = ownerId();
        postForBody("/api/notification/subscription", request("https://p.example/test-1"),
                ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);
        postForBody("/api/notification/subscription", request("https://p.example/test-2"),
                ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);

        PushTestResponse response = postForBody("/api/notification/test", null,
                ownerAuthHeaders(), HttpStatus.OK, PushTestResponse.class);

        // Fake endpoints never resolve to a real push service — the honest answer is sent: 0,
        // but the endpoint itself must still be 200, never a 500, and BOTH devices are attempted.
        assertThat(response.getAttempted()).isEqualTo(2);
        assertThat(response.getSent()).isEqualTo(0);
        assertThat(repository.findByCreatedBy(owner)).hasSize(2); // FAILED prunes nothing
    }
}
