package io.mrkuhne.mezo.feature.needs.repository;

import io.mrkuhne.mezo.feature.needs.entity.NeedsDayEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NeedsDayRepository extends JpaRepository<NeedsDayEntity, UUID> {

    Optional<NeedsDayEntity> findByCreatedByAndNeedsDateAndDeletedFalse(UUID createdBy, LocalDate needsDate);

    Optional<NeedsDayEntity> findFirstByCreatedByAndDeletedFalseOrderByNeedsDateDesc(UUID createdBy);
}
