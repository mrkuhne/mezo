package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.BriefingEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BriefingRepository extends JpaRepository<BriefingEntity, UUID> {

    Optional<BriefingEntity> findByCreatedByAndBriefingDate(UUID createdBy, LocalDate briefingDate);
}
