package io.mrkuhne.mezo.feature.notification.repository;

import io.mrkuhne.mezo.feature.notification.entity.ApnsDeviceEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Live rows only (the entity's {@code @SQLRestriction} hides soft-deleted ones). */
public interface ApnsDeviceRepository extends JpaRepository<ApnsDeviceEntity, UUID> {

    Optional<ApnsDeviceEntity> findByDeviceId(UUID deviceId);

    List<ApnsDeviceEntity> findByToken(String token);
}
