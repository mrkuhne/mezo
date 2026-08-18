package io.mrkuhne.mezo.feature.appnotification.service;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/**
 * The ALWAYS-ON emit facade (spec 2026-08-18 §4): producers (companion/proactive services)
 * inject this plainly; when the feed switch is off the {@link AppNotificationService} bean does
 * not exist and every emit is a silent no-op — a producer must never break because notifications
 * are disabled. This is the single place that holds the optionality (the RitualService
 * ObjectProvider precedent), so 12 call sites stay one-liners.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AppNotificationEmitter {

    private final ObjectProvider<AppNotificationService> serviceProvider;

    public void emit(UUID owner, AppNotificationKind kind, String title, String body,
                     String deeplink, UUID refId, String dedupKey) {
        AppNotificationService service = serviceProvider.getIfAvailable();
        if (service == null) {
            return;
        }
        try {
            service.emit(owner, kind, title, body, deeplink, refId, dedupKey);
        } catch (Exception e) {
            // A duplicate-key race inside emit's REQUIRES_NEW surfaces here as
            // UnexpectedRollbackException on commit — and no notification failure of ANY
            // shape may break the producing domain write. Log and move on.
            log.warn("Notification emit failed for {} ({}) — producer unaffected", dedupKey, kind.key(), e);
        }
    }
}
