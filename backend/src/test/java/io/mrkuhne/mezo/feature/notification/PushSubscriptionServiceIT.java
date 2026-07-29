package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.notification.entity.PushSubscriptionEntity;
import io.mrkuhne.mezo.feature.notification.repository.PushSubscriptionRepository;
import io.mrkuhne.mezo.feature.notification.service.PushSubscriptionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.NotificationPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/** Service-level coverage for the upsert/soft-delete rules HTTP tests can't see directly. */
class PushSubscriptionServiceIT extends AbstractIntegrationTest {

    @Autowired private PushSubscriptionService service;
    @Autowired private PushSubscriptionRepository repository;
    @Autowired private NotificationPopulator notificationPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private JdbcTemplate jdbcTemplate;

    private UUID owner() {
        return userPopulator.createUser("push-svc@test.hu").getId();
    }

    @Test
    void testRegister_shouldUpsertSingleRow_whenCalledTwiceWithSameEndpoint() {
        UUID owner = owner();
        service.register(owner, "https://p.example/svc-a", "key-1", "auth-1", "iPhone");
        service.register(owner, "https://p.example/svc-a", "key-2", "auth-2", "Android");

        var rows = repository.findByCreatedBy(owner);
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().getP256dh()).isEqualTo("key-2");
        assertThat(rows.getFirst().getAuth()).isEqualTo("auth-2");
        assertThat(rows.getFirst().getUserAgent()).isEqualTo("Android");
    }

    @Test
    void testMarkGone_shouldSoftDeleteRow_whenDeviceReportsGone() {
        UUID owner = owner();
        PushSubscriptionEntity saved = notificationPopulator.subscription(owner, "https://p.example/gone");

        service.markGone(saved.getId());

        // Invisible via the repository (SQLRestriction hides soft-deleted rows)...
        assertThat(repository.findByCreatedBy(owner)).isEmpty();
        assertThat(repository.findByCreatedByAndEndpoint(owner, "https://p.example/gone")).isEmpty();
        // ...but the physical row is still present in the table, only flagged.
        Long count = jdbcTemplate.queryForObject(
                "select count(*) from push_subscription where id = ? and is_deleted = true",
                Long.class, saved.getId());
        assertThat(count).isEqualTo(1L);
    }

    @Test
    void testUnregister_shouldNoOp_whenEndpointUnknown() {
        UUID owner = owner();
        service.unregister(owner, "https://p.example/never-registered");
        assertThat(repository.findByCreatedBy(owner)).isEmpty();
    }

    @Test
    void testMarkSuccess_shouldSetLastSuccessAt_whenDeviceAccepted() {
        UUID owner = owner();
        PushSubscriptionEntity saved = notificationPopulator.subscription(owner, "https://p.example/success");
        assertThat(saved.getLastSuccessAt()).isNull();

        service.markSuccess(saved.getId());

        var reloaded = repository.findByCreatedByAndEndpoint(owner, "https://p.example/success").orElseThrow();
        assertThat(reloaded.getLastSuccessAt()).isNotNull();
    }
}
