package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WeeklyReviewRepository extends JpaRepository<WeeklyReviewEntity, UUID> {

    Optional<WeeklyReviewEntity> findByCreatedByAndWeekStart(UUID createdBy, LocalDate weekStart);
}
