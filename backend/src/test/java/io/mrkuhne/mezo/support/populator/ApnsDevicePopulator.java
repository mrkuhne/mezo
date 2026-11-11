package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.notification.entity.ApnsDeviceEntity;
import io.mrkuhne.mezo.feature.notification.repository.ApnsDeviceRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for ApnsDevice (Boop B1, mezo-r36n9.11) — persisted with {@code saveAndFlush}
 *  so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class ApnsDevicePopulator {

    private final ApnsDeviceRepository repository;

    public ApnsDeviceEntity createDevice(UUID owner, UUID deviceId, String token, String environment) {
        ApnsDeviceEntity e = new ApnsDeviceEntity();
        e.setCreatedBy(owner);
        e.setDeviceId(deviceId);
        e.setToken(token);
        e.setEnvironment(environment);
        e.setBundleId("io.mrkuhne.boop");
        return repository.saveAndFlush(e);
    }
}
