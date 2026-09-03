package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.DayReviewEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DayReviewRepository extends JpaRepository<DayReviewEntity, UUID> {

    Optional<DayReviewEntity> findByCreatedByAndDate(UUID createdBy, LocalDate date);
}
