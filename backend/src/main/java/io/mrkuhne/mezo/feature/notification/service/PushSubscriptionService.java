package io.mrkuhne.mezo.feature.notification.service;

import io.mrkuhne.mezo.feature.notification.entity.PushSubscriptionEntity;
import io.mrkuhne.mezo.feature.notification.repository.PushSubscriptionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Owns the {@code push_subscription} rows: upsert-on-register, <b>re-bind across owners</b>
 * on register, and soft-delete-on-unregister/GONE, plus the per-owner live-device list
 * {@link PushSender} fans out to (bd mezo-h4wp.6.1).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.NOTIFICATION_SWITCH, havingValue = "true")
public class PushSubscriptionService {

    private final PushSubscriptionRepository repository;

    /**
     * Idempotent: re-subscribing the same device (same {@code endpoint}) refreshes the key
     * material on the existing row rather than inserting a second one — the DB has a partial
     * unique index on {@code (created_by, endpoint) where is_deleted = false} that a duplicate
     * insert would violate.
     *
     * <p>S6 (mezo-qw37.6) re-bind: a push endpoint identifies one physical device, and a device
     * belongs to whoever is signed in on it now — one browser, one account. If another account
     * still holds a live row for this endpoint, that row is soft-deleted first (never an
     * {@code UPDATE} of {@code created_by}, which is {@code updatable=false} on
     * {@link io.mrkuhne.mezo.techcore.persistence.OwnedEntity}) before the caller's own row is
     * upserted, so the same browser can never notify two accounts at once.
     */
    @Transactional
    public void register(UUID owner, String endpoint, String p256dh, String auth, String userAgent) {
        repository.findByEndpoint(endpoint).stream()
                .filter(other -> !owner.equals(other.getCreatedBy()))
                .forEach(repository::delete);
        PushSubscriptionEntity entity = repository.findByCreatedByAndEndpoint(owner, endpoint)
                .orElseGet(PushSubscriptionEntity::new);
        entity.setCreatedBy(owner);
        entity.setEndpoint(endpoint);
        entity.setP256dh(p256dh);
        entity.setAuth(auth);
        entity.setUserAgent(userAgent);
        repository.save(entity);
    }

    /** Unknown endpoint is a no-op, not an error — the client may be retrying a partial failure. */
    @Transactional
    public void unregister(UUID owner, String endpoint) {
        repository.findByCreatedByAndEndpoint(owner, endpoint).ifPresent(repository::delete);
    }

    /** The owner's currently live (non-soft-deleted) devices, for {@link PushSender} to fan out to. */
    @Transactional(readOnly = true)
    public List<PushSubscriptionEntity> liveFor(UUID owner) {
        return repository.findByCreatedBy(owner);
    }

    /** The push service says this device is gone for good — soft-delete via {@code @SQLDelete}. */
    @Transactional
    public void markGone(UUID id) {
        repository.findById(id).ifPresent(repository::delete);
    }

    /** Records a successful delivery for staleness/diagnostics — never gates delivery itself. */
    @Transactional
    public void markSuccess(UUID id) {
        repository.findById(id).ifPresent(e -> {
            e.setLastSuccessAt(Instant.now());
            repository.save(e);
        });
    }
}
