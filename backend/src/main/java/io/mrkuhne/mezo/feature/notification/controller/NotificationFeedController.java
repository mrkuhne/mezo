package io.mrkuhne.mezo.feature.notification.controller;

import io.mrkuhne.mezo.api.controller.NotificationFeedApi;
import io.mrkuhne.mezo.api.dto.NotificationFeedItem;
import io.mrkuhne.mezo.api.dto.NotificationFeedResponse;
import io.mrkuhne.mezo.feature.notification.entity.AppNotificationEntity;
import io.mrkuhne.mezo.feature.notification.service.AppNotificationService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/notification/feed surface (bd mezo-gzhp.1) — thin delegation; gated on the feed switch. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.NOTIFICATION_FEED_SWITCH, havingValue = "true")
public class NotificationFeedController implements NotificationFeedApi {

    private final AppNotificationService appNotificationService;
    private final CurrentUserId currentUserId;

    @Override
    public NotificationFeedResponse getNotificationFeed(Integer limit) {
        NotificationFeedResponse response = new NotificationFeedResponse();
        response.setItems(appNotificationService.feed(currentUserId.get(), limit == null ? 50 : limit).stream()
                .map(NotificationFeedController::toDto)
                .toList());
        return response;
    }

    @Override
    public void markNotificationFeedRead() {
        appNotificationService.markAllRead(currentUserId.get());
    }

    private static NotificationFeedItem toDto(AppNotificationEntity e) {
        NotificationFeedItem dto = new NotificationFeedItem();
        dto.setId(e.getId());
        dto.setKind(e.getKind());
        dto.setTitle(e.getTitle());
        dto.setBody(e.getBody());
        dto.setDeeplink(e.getDeeplink());
        dto.setOccurredAt(OffsetDateTime.ofInstant(e.getOccurredAt(), ZoneOffset.UTC));
        dto.setReadAt(e.getReadAt() == null ? null : OffsetDateTime.ofInstant(e.getReadAt(), ZoneOffset.UTC));
        return dto;
    }
}
