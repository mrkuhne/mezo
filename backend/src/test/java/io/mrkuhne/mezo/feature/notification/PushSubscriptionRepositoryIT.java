package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.notification.entity.PushSubscriptionEntity;
import io.mrkuhne.mezo.feature.notification.repository.PushSubscriptionRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class PushSubscriptionRepositoryIT extends AbstractIntegrationTest {

    @Autowired private PushSubscriptionRepository repository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private OwnerProperties ownerProperties;

    // find-or-create: no demodata profile in this context — findByEmail().orElseThrow() was order-dependent (mezo-ghug)
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testFindByCreatedByAndEndpoint_shouldReturnRow_whenLiveRowExists() {
        UUID owner = ownerId();
        PushSubscriptionEntity e = new PushSubscriptionEntity();
        e.setCreatedBy(owner);
        e.setEndpoint("https://web.push.apple.com/abc");
        e.setP256dh("BOr1a2b3");
        e.setAuth("c3VwZXJzZWNyZXQ");
        repository.save(e);

        assertThat(repository.findByCreatedByAndEndpoint(owner, "https://web.push.apple.com/abc"))
            .isPresent();
        assertThat(repository.findByCreatedBy(owner)).hasSize(1);
    }

    @Test
    void testFindByCreatedBy_shouldExcludeRow_whenSoftDeleted() {
        UUID owner = ownerId();
        PushSubscriptionEntity e = new PushSubscriptionEntity();
        e.setCreatedBy(owner);
        e.setEndpoint("https://web.push.apple.com/gone");
        e.setP256dh("BOr1a2b3");
        e.setAuth("c3VwZXJzZWNyZXQ");
        repository.save(e);
        repository.delete(e); // @SQLDelete → soft delete

        assertThat(repository.findByCreatedBy(owner)).isEmpty();
    }
}
