package io.mrkuhne.mezo.feature.notification.service;

import io.mrkuhne.mezo.feature.notification.entity.ApnsDeviceEntity;
import io.mrkuhne.mezo.feature.notification.repository.ApnsDeviceRepository;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Native push registrations (Boop B1, mezo-r36n9.11) — no sending yet. One live row per device id;
 * a device belongs to whoever registered it last (a row held by another account is soft-deleted and
 * the caller gets a fresh one, as {@code created_by} is not updatable), and a token that moved to a
 * new device id supersedes the older row.
 */
@Service
@RequiredArgsConstructor
public class ApnsDeviceService {

    private final ApnsDeviceRepository repository;

    @Transactional
    public void register(UUID owner, UUID deviceId, String token, String environment, String bundleId, String appVersion) {
        ApnsDeviceEntity entity = repository.findByDeviceId(deviceId).orElse(null);
        if (entity != null && !owner.equals(entity.getCreatedBy())) {
            repository.delete(entity);
            repository.flush();
            entity = null;
        }
        if (entity == null) {
            entity = new ApnsDeviceEntity();
            entity.setCreatedBy(owner);
            entity.setDeviceId(deviceId);
        }
        Instant now = Instant.now();
        entity.setToken(token);
        entity.setEnvironment(environment);
        entity.setBundleId(bundleId);
        entity.setAppVersion(appVersion);
        entity.setLastSeenAt(now);
        entity.setUpdatedAt(now);
        entity.setInvalidatedAt(null);
        ApnsDeviceEntity saved = repository.saveAndFlush(entity);
        repository.findByToken(token).stream()
            .filter(other -> !other.getId().equals(saved.getId()))
            .forEach(repository::delete);
    }

    /** Idempotent: soft-deletes the caller's own live row; another account's device is left alone. */
    @Transactional
    public void unregister(UUID owner, UUID deviceId) {
        repository.findByDeviceId(deviceId)
            .filter(d -> owner.equals(d.getCreatedBy()))
            .ifPresent(repository::delete);
    }
}
