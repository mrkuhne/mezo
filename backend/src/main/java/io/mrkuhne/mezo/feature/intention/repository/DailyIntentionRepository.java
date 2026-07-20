package io.mrkuhne.mezo.feature.intention.repository;

import io.mrkuhne.mezo.feature.intention.entity.DailyIntentionEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DailyIntentionRepository extends JpaRepository<DailyIntentionEntity, UUID> {

    Optional<DailyIntentionEntity> findByCreatedByAndIntentionDateAndDeletedFalse(
        UUID createdBy, LocalDate intentionDate);
}
