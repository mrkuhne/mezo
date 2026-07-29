package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.notification.entity.PushSubscriptionEntity;
import io.mrkuhne.mezo.feature.notification.repository.PushSubscriptionRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class NotificationPopulator {

    private final PushSubscriptionRepository pushSubscriptionRepository;

    /** A live subscription with fixed, valid-looking (but not real) key material. */
    public PushSubscriptionEntity subscription(UUID owner, String endpoint) {
        PushSubscriptionEntity e = new PushSubscriptionEntity();
        e.setCreatedBy(owner);
        e.setEndpoint(endpoint);
        e.setP256dh("BOr1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7");
        e.setAuth("c3VwZXJzZWNyZXQ");
        e.setUserAgent("iPhone");
        return pushSubscriptionRepository.saveAndFlush(e);
    }
}
