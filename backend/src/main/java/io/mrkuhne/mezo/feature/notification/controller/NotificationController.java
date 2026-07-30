package io.mrkuhne.mezo.feature.notification.controller;

import io.mrkuhne.mezo.api.controller.NotificationApi;
import io.mrkuhne.mezo.api.dto.NotificationPref;
import io.mrkuhne.mezo.api.dto.NotificationPrefListRequest;
import io.mrkuhne.mezo.api.dto.NotificationPrefListResponse;
import io.mrkuhne.mezo.api.dto.NotificationScheduleEntry;
import io.mrkuhne.mezo.api.dto.NotificationScheduleRequest;
import io.mrkuhne.mezo.api.dto.PushSubscriptionRequest;
import io.mrkuhne.mezo.api.dto.PushTestResponse;
import io.mrkuhne.mezo.feature.notification.domain.CategoryPref;
import io.mrkuhne.mezo.feature.notification.domain.NotificationCategory;
import io.mrkuhne.mezo.feature.notification.domain.ScheduleEntry;
import io.mrkuhne.mezo.feature.notification.service.NotificationPrefService;
import io.mrkuhne.mezo.feature.notification.service.NotificationScheduleService;
import io.mrkuhne.mezo.feature.notification.service.PushSender;
import io.mrkuhne.mezo.feature.notification.service.PushSubscriptionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.RestController;

/** /api/notification surface (bd mezo-h4wp.6.1/.6.2/.6.3) — thin delegation; gated on NOTIFICATION_SWITCH. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.NOTIFICATION_SWITCH, havingValue = "true")
public class NotificationController implements NotificationApi {

    private final PushSubscriptionService subscriptionService;
    private final PushSender pushSender;
    private final NotificationPrefService prefService;
    private final NotificationScheduleService scheduleService;
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

    @Override
    public NotificationPrefListResponse getNotificationPrefs() {
        NotificationPrefListResponse response = new NotificationPrefListResponse();
        response.setPrefs(prefService.effectiveFor(currentUserId.get()).stream()
                .map(NotificationController::toDto)
                .toList());
        return response;
    }

    @Override
    public void putNotificationPrefs(NotificationPrefListRequest notificationPrefListRequest) {
        List<CategoryPref> prefs = notificationPrefListRequest.getPrefs().stream()
                .map(NotificationController::toCategoryPref)
                .toList();
        prefService.upsert(currentUserId.get(), prefs);
    }

    @Override
    public void putNotificationSchedule(NotificationScheduleRequest notificationScheduleRequest) {
        List<ScheduleEntry> entries = notificationScheduleRequest.getEntries().stream()
                .map(NotificationController::toScheduleEntry)
                .toList();
        scheduleService.replace(currentUserId.get(), notificationScheduleRequest.getCategories(), entries);
    }

    private static NotificationPref toDto(CategoryPref pref) {
        NotificationPref dto = new NotificationPref();
        dto.setCategory(pref.category().key());
        dto.setEnabled(pref.enabled());
        dto.setLeadMinutes(pref.leadMinutes());
        return dto;
    }

    private static CategoryPref toCategoryPref(NotificationPref dto) {
        NotificationCategory category = NotificationCategory.fromKey(dto.getCategory())
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("NOTIFICATION_UNKNOWN_CATEGORY").build(), HttpStatus.BAD_REQUEST));
        return new CategoryPref(category, dto.getEnabled(), dto.getLeadMinutes());
    }

    private static ScheduleEntry toScheduleEntry(NotificationScheduleEntry dto) {
        return new ScheduleEntry(dto.getWeekday(), dto.getTime(), dto.getCategory(), dto.getTitle(),
                dto.getBody(), dto.getDeeplink(), dto.getSource());
    }
}
