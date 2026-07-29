package io.mrkuhne.mezo.feature.notification.controller;

import io.mrkuhne.mezo.api.controller.NotificationApi;
import io.mrkuhne.mezo.api.dto.PushSubscriptionRequest;
import io.mrkuhne.mezo.api.dto.PushTestResponse;
import io.mrkuhne.mezo.feature.notification.service.PushSender;
import io.mrkuhne.mezo.feature.notification.service.PushSubscriptionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/notification surface (bd mezo-h4wp.6.1) — thin delegation; gated on NOTIFICATION_SWITCH. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.NOTIFICATION_SWITCH, havingValue = "true")
public class NotificationController implements NotificationApi {

    private final PushSubscriptionService subscriptionService;
    private final PushSender pushSender;
    private final CurrentUserId currentUserId;

    @Override
    public void registerPushSubscription(PushSubscriptionRequest pushSubscriptionRequest) {
        subscriptionService.register(currentUserId.get(), pushSubscriptionRequest.getEndpoint(),
                pushSubscriptionRequest.getP256dh(), pushSubscriptionRequest.getAuth(),
                pushSubscriptionRequest.getUserAgent());
    }

    @Override
    public void unregisterPushSubscription(String endpoint) {
        subscriptionService.unregister(currentUserId.get(), endpoint);
    }

    @Override
    public PushTestResponse sendTestPush() {
        PushSender.PushFanOut out = pushSender.sendToAllDevices(currentUserId.get(),
                "Mezo · teszt", "A push működik. Ezt a mezo küldte.", "/today");
        PushTestResponse response = new PushTestResponse();
        response.setAttempted(out.attempted());
        response.setSent(out.sent());
        return response;
    }
}
