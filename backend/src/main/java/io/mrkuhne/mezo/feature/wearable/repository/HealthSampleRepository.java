package io.mrkuhne.mezo.feature.wearable.repository;

import io.mrkuhne.mezo.feature.wearable.entity.HealthSampleEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HealthSampleRepository extends JpaRepository<HealthSampleEntity, UUID> {
}
