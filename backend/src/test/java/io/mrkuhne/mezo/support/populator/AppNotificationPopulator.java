package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.appnotification.entity.AppNotificationEntity;
import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class AppNotificationPopulator {

    private final AppNotificationRepository repository;

    /** One outbox row with sensible copy — kind/dedupKey/occurredAt are what tests vary. */
    public AppNotificationEntity notification(UUID owner, String kind, String dedupKey, Instant occurredAt) {
        AppNotificationEntity e = new AppNotificationEntity();
        e.setCreatedBy(owner);
        e.setKind(kind);
        e.setTitle("Teszt értesítés");
        e.setBody("Teszt törzs.");
        e.setDeeplink("/insights");
        e.setDedupKey(dedupKey);
        e.setOccurredAt(occurredAt);
        return repository.saveAndFlush(e);
    }
}
