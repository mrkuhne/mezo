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
 * device fails to deliver (the test context carries the {@code dummy-vapid-*} placeholders, so
 * signing fails before anything reaches the wire) — the loop must still visit every device rather
 * than abort after the first failure, and must prune only what is genuinely dead.
 *
 * <p>Endpoints are {@code http://localhost:1} rather than a fake DNS name: a resolver that
 * blackholes instead of returning NXDOMAIN would otherwise make every send burn the full 5 s
 * connect timeout in CI. Nothing listens on port 1, so a refused connection is immediate.
 */
class PushSenderIT extends AbstractIntegrationTest {

    @Autowired private PushSender pushSender;
    @Autowired private NotificationPopulator notificationPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private PushSubscriptionRepository repository;

    @Test
    void testSendToAllDevices_shouldAttemptEveryDevice_whenEarlierDevicesFail() {
        UUID owner = userPopulator.createUser("push-sender@test.hu").getId();
        notificationPopulator.subscription(owner, "http://localhost:1/push/sender-1");
        notificationPopulator.subscription(owner, "http://localhost:1/push/sender-2");
        notificationPopulator.subscription(owner, "http://localhost:1/push/sender-3");

        var result = pushSender.sendToAllDevices(owner, "Cím", "Törzs szöveg ékezetekkel: áéíóöőúüű", "/today");

        // Nothing can be delivered here -> every send fails, but all three must have been
        // attempted (the loop does not stop after the first failure).
        assertThat(result.attempted()).isEqualTo(3);
        assertThat(result.sent()).isEqualTo(0);
        // The load-bearing assertion for the GONE mapping: the failure cause here is OUR
        // misconfigured VAPID key (WEBPUSH_SIGN_FAILED), which hits every device at once. It must
        // stay FAILED, or the first production test push after a bad deploy would wipe the table.
        assertThat(repository.findByCreatedBy(owner)).hasSize(3);
    }

    @Test
    void testSendToAllDevices_shouldPruneOnlyTheDeviceWithUnusableKeyMaterial_whenKeysAreMalformed() {
        UUID owner = userPopulator.createUser("push-sender-prune@test.hu").getId();
        notificationPopulator.subscription(owner, "http://localhost:1/push/prune-good");
        notificationPopulator.subscription(owner, "http://localhost:1/push/prune-bad",
                NotificationPopulator.MALFORMED_P256DH);

        var result = pushSender.sendToAllDevices(owner, "Cím", "Törzs", "/today");

        // A malformed p256dh can never deliver and register-time validation is only minLength:1,
        // so that row has to become prunable — otherwise N2's per-minute job warn-logs it forever.
        assertThat(result.attempted()).isEqualTo(2);
        assertThat(result.sent()).isEqualTo(0);
        assertThat(repository.findByCreatedBy(owner))
                .extracting(e -> e.getEndpoint())
                .containsExactly("http://localhost:1/push/prune-good");
    }

    @Test
    void testSendToAllDevices_shouldReturnZero_whenOwnerHasNoDevices() {
        UUID owner = userPopulator.createUser("push-sender-empty@test.hu").getId();
        var result = pushSender.sendToAllDevices(owner, "Cím", "Törzs", "/today");
        assertThat(result.attempted()).isEqualTo(0);
        assertThat(result.sent()).isEqualTo(0);
    }
}
