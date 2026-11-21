package io.mrkuhne.mezo.feature.capacity.repository;

import io.mrkuhne.mezo.feature.capacity.entity.CapacityEventFeedbackEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CapacityEventFeedbackRepository extends JpaRepository<CapacityEventFeedbackEntity, UUID> {
    List<CapacityEventFeedbackEntity> findByCreatedByAndDeletedFalse(UUID owner);
}
