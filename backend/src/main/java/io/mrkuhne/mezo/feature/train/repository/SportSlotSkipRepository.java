package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.SportSlotSkipEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for {@link SportSlotSkipEntity}. Existence check backs
 * {@code SportSlotSkipService#isSkipped}; the range query backs
 * {@code SportSlotSkipService#skipsBetween} (one query for a whole week instead of one per slot
 * per day).
 */
public interface SportSlotSkipRepository extends JpaRepository<SportSlotSkipEntity, UUID> {

    boolean existsByCreatedByAndDayOfWeekAndTimeAndDateAndDeletedFalse(
        UUID createdBy, Integer dayOfWeek, String time, LocalDate date);

    List<SportSlotSkipEntity> findByCreatedByAndDateBetweenAndDeletedFalse(
        UUID createdBy, LocalDate from, LocalDate to);
}
