package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.notification.repository.PushSubscriptionRepository;
import io.mrkuhne.mezo.feature.notification.service.PushSender;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.NotificationPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Fan-out coverage: {@code WebPushClient.send} never throws, but in this test environment every
 * device fails to deliver (no real push service behind the fake endpoints) — the loop must still
 * visit every device rather than abort after the first failure.
 */
class PushSenderIT extends AbstractIntegrationTest {

    @Autowired private PushSender pushSender;
    @Autowired private NotificationPopulator notificationPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private PushSubscriptionRepository repository;

    @Test
    void testSendToAllDevices_shouldAttemptEveryDevice_whenEarlierDevicesFail() {
        UUID owner = userPopulator.createUser("push-sender@test.hu").getId();
        notificationPopulator.subscription(owner, "https://p.example/sender-1");
        notificationPopulator.subscription(owner, "https://p.example/sender-2");
        notificationPopulator.subscription(owner, "https://p.example/sender-3");

        var result = pushSender.sendToAllDevices(owner, "Cím", "Törzs szöveg ékezetekkel: áéíóöőúüű", "/today");

        // None of the fake endpoints resolve to a real push service -> every send fails, but all
        // three must have been attempted (the loop does not stop after the first failure).
        assertThat(result.attempted()).isEqualTo(3);
        assertThat(result.sent()).isEqualTo(0);
        // FAILED (as opposed to GONE) must not prune anything.
        assertThat(repository.findByCreatedBy(owner)).hasSize(3);
    }

    @Test
    void testSendToAllDevices_shouldReturnZero_whenOwnerHasNoDevices() {
        UUID owner = userPopulator.createUser("push-sender-empty@test.hu").getId();
        var result = pushSender.sendToAllDevices(owner, "Cím", "Törzs", "/today");
        assertThat(result.attempted()).isEqualTo(0);
        assertThat(result.sent()).isEqualTo(0);
    }
}
