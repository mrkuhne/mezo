package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.SportEventEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for {@link SportEventEntity}. List order = date ascending, then time — the natural
 * upcoming-events rendering order; the range variant backs the FE's current-week fetch.
 */
public interface SportEventRepository extends JpaRepository<SportEventEntity, UUID> {

    List<SportEventEntity> findByCreatedByAndDeletedFalseOrderByDateAscTimeAsc(UUID createdBy);

    List<SportEventEntity> findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateAscTimeAsc(
        UUID createdBy, LocalDate from, LocalDate to);

    Optional<SportEventEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
