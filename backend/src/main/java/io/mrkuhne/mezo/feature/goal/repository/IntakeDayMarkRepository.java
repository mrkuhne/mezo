package io.mrkuhne.mezo.feature.goal.repository;

import io.mrkuhne.mezo.feature.goal.entity.IntakeDayMarkEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IntakeDayMarkRepository extends JpaRepository<IntakeDayMarkEntity, UUID> {

    List<IntakeDayMarkEntity> findByCreatedByAndDayBetweenAndDeletedFalse(UUID createdBy, LocalDate from, LocalDate to);

    Optional<IntakeDayMarkEntity> findByCreatedByAndDayAndDeletedFalse(UUID createdBy, LocalDate day);
}
