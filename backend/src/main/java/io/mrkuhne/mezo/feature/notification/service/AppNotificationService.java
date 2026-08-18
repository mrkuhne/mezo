package io.mrkuhne.mezo.feature.notification.service;

import io.mrkuhne.mezo.feature.notification.config.NotificationFeedProperties;
import io.mrkuhne.mezo.feature.notification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.notification.entity.AppNotificationEntity;
import io.mrkuhne.mezo.feature.notification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The AI-brain notification outbox (bd mezo-gzhp.1, spec 2026-08-18 §4). {@code emit} is
 * IDEMPOTENT by dedup key: the exists-check catches the common re-run, the unique-index catch
 * the cron-vs-lazy-GET race — either way a duplicate occurrence is silently a no-op, never an
 * error surfaced to the producer. Bean is gated on the feed switch; producers reach it ONLY
 * through {@link AppNotificationEmitter}, which no-ops when this bean does not exist.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.NOTIFICATION_FEED_SWITCH, havingValue = "true")
public class AppNotificationService {

    private final AppNotificationRepository repository;
    private final NotificationFeedProperties properties;

    /**
     * REQUIRES_NEW keeps a duplicate-key rollback contained: several producers call emit from
     * inside their own @Transactional write (fact extraction, pattern decide) — letting the
     * unique-violation mark THAT transaction rollback-only would turn a benign duplicate
     * notification into a lost domain write.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void emit(UUID owner, AppNotificationKind kind, String title, String body,
                     String deeplink, UUID refId, String dedupKey) {
        if (repository.existsByCreatedByAndDedupKeyAndDeletedFalse(owner, dedupKey)) {
            return;
        }
        AppNotificationEntity e = new AppNotificationEntity();
        e.setCreatedBy(owner);
        e.setKind(kind.key());
        e.setTitle(PushSender.truncateBody(title, 120));
        e.setBody(PushSender.truncateBody(body, 300));
        e.setDeeplink(deeplink);
        e.setRefId(refId);
        e.setDedupKey(dedupKey);
        e.setOccurredAt(Instant.now());
        try {
            repository.saveAndFlush(e);
        } catch (DataIntegrityViolationException ex) {
            log.debug("Duplicate notification emit for {} ({}) — ignored", dedupKey, kind.key());
        }
    }

    public List<AppNotificationEntity> feed(UUID owner, int limit) {
        int capped = Math.min(limit, properties.limit());
        return repository.findByCreatedByAndDeletedFalseOrderByOccurredAtDesc(owner, PageRequest.of(0, capped));
    }

    /** Panel-open semantics: every unread row gets stamped. Returns how many were stamped. */
    @Transactional
    public int markAllRead(UUID owner) {
        List<AppNotificationEntity> unread = repository.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner);
        Instant now = Instant.now();
        unread.forEach(n -> n.setReadAt(now));
        repository.saveAllAndFlush(unread);
        return unread.size();
    }
}
