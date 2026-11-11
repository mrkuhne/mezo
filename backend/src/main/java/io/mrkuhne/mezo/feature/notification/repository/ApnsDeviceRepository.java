package io.mrkuhne.mezo.feature.notification.repository;

import io.mrkuhne.mezo.feature.notification.entity.ApnsDeviceEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApnsDeviceRepository extends JpaRepository<ApnsDeviceEntity, UUID> {
}
