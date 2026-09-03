package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.notification.repository.PushSubscriptionRepository;
import io.mrkuhne.mezo.feature.notification.service.PushSubscriptionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** S6 (mezo-qw37.6): one browser = one account — subscribing moves the endpoint to the caller. */
class PushSubscriptionRebindIT extends AbstractIntegrationTest {

    @Autowired private PushSubscriptionService service;
    @Autowired private PushSubscriptionRepository repository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRegister_shouldMoveEndpointToCaller_whenAnotherUserHeldIt() {
        UUID a = userPopulator.createUser("push-a@test.local").getId();
        UUID b = userPopulator.createUser("push-b@test.local").getId();
        String endpoint = "https://p.example/shared-device";
        service.register(a, endpoint, "key-a", "auth-a", "iPhone");

        service.register(b, endpoint, "key-b", "auth-b", "iPhone");

        assertThat(repository.findByCreatedBy(a)).isEmpty();
        var rows = repository.findByCreatedBy(b);
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().getP256dh()).isEqualTo("key-b");
        assertThat(repository.findByEndpoint(endpoint)).hasSize(1);
    }

    @Test
    void testRegister_shouldKeepOtherDevicesOfPreviousOwner_whenRebinding() {
        UUID a = userPopulator.createUser("push-a2@test.local").getId();
        UUID b = userPopulator.createUser("push-b2@test.local").getId();
        service.register(a, "https://p.example/a-phone", "key-1", "auth-1", "iPhone");
        service.register(a, "https://p.example/shared", "key-2", "auth-2", "Mac");

        service.register(b, "https://p.example/shared", "key-3", "auth-3", "Mac");

        assertThat(repository.findByCreatedBy(a)).singleElement()
                .satisfies(r -> assertThat(r.getEndpoint()).isEqualTo("https://p.example/a-phone"));
    }
}
