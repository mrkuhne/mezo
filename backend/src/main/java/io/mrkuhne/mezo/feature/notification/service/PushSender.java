package io.mrkuhne.mezo.feature.notification.service;

import io.mrkuhne.mezo.feature.notification.config.NotificationProperties;
import io.mrkuhne.mezo.feature.notification.entity.PushSubscriptionEntity;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.webpush.WebPushClient;
import io.mrkuhne.mezo.techcore.webpush.WebPushResult;
import io.mrkuhne.mezo.techcore.webpush.WebPushSubscriptionKeys;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/**
 * Multi-device push fan-out with dead-device pruning (bd mezo-h4wp.6.1). Sends the same
 * notification to every one of an owner's live devices; a {@code GONE} response prunes that
 * device, everything else is just logged — one bad device never aborts the rest.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.NOTIFICATION_SWITCH, havingValue = "true")
public class PushSender {

    /** How much of a push endpoint (a capability URL) is safe to put in a log line. */
    private static final int ENDPOINT_LOG_PREFIX_LEN = 40;

    private final PushSubscriptionService subscriptionService;
    private final WebPushClient webPushClient;
    private final NotificationProperties properties;
    private final ObjectMapper objectMapper;

    /** Attempted vs accepted device count — the honest report {@code POST /api/notification/test}
     *  (and later N2's dispatch job) surfaces; a send failing never turns into an HTTP error. */
    public record PushFanOut(int attempted, int sent) {}

    public PushFanOut sendToAllDevices(UUID owner, String title, String body, String url) {
        List<PushSubscriptionEntity> devices = subscriptionService.liveFor(owner);
        String payload = payload(title, body, url);
        int sent = 0;
        for (PushSubscriptionEntity device : devices) {
            WebPushResult result = webPushClient.send(
                    new WebPushSubscriptionKeys(device.getEndpoint(), device.getP256dh(), device.getAuth()),
                    payload);
            switch (result) {
                case SENT -> {
                    sent++;
                    safely(device, () -> subscriptionService.markSuccess(device.getId()));
                }
                case GONE -> safely(device, () -> subscriptionService.markGone(device.getId()));
                default -> log.warn("Push to {}... returned {}", logPrefix(device.getEndpoint()), result);
            }
        }
        return new PushFanOut(devices.size(), sent);
    }

    /** A bookkeeping failure (markSuccess/markGone) must not abort the fan-out over the rest. */
    private void safely(PushSubscriptionEntity device, Runnable bookkeeping) {
        try {
            bookkeeping.run();
        } catch (Exception e) {
            log.warn("Push bookkeeping failed for {}... ({})",
                    logPrefix(device.getEndpoint()), e.getClass().getSimpleName());
        }
    }

    /** {"title":…,"body":…,"url":…} via the injected ObjectMapper — never string concatenation,
     *  the title/body carry Hungarian text with accents and possibly quotes. */
    private String payload(String title, String body, String url) {
        String truncatedBody = body != null && body.length() > properties.bodyMaxChars()
                ? body.substring(0, properties.bodyMaxChars())
                : body;
        var fields = new LinkedHashMap<String, String>();
        fields.put("title", title);
        fields.put("body", truncatedBody);
        fields.put("url", url);
        return objectMapper.writeValueAsString(fields);
    }

    /** First {@value #ENDPOINT_LOG_PREFIX_LEN} chars only — an endpoint is a capability URL. */
    private static String logPrefix(String endpoint) {
        return endpoint.length() <= ENDPOINT_LOG_PREFIX_LEN ? endpoint : endpoint.substring(0, ENDPOINT_LOG_PREFIX_LEN);
    }
}
