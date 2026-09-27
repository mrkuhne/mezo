package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.ReadinessChoiceEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for {@link ReadinessChoiceEntity} (Check-in 2.0 readiness, mezo-ck2). */
public interface ReadinessChoiceRepository extends JpaRepository<ReadinessChoiceEntity, UUID> {

    Optional<ReadinessChoiceEntity> findByCreatedByAndDateAndDeletedFalse(UUID createdBy, LocalDate date);
}
