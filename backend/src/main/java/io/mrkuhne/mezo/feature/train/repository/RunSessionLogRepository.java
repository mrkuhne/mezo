package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for {@link RunSessionLogEntity}. Extends {@link JpaRepository} directly (matching the
 * sibling {@code SportSessionRepository}); logged sessions are surfaced newest-first, so an explicit
 * date-descending finder is declared. The {@code is_deleted = false} filter comes from the entity
 * {@code @SQLRestriction}.
 */
public interface RunSessionLogRepository extends JpaRepository<RunSessionLogEntity, UUID> {

    List<RunSessionLogEntity> findByCreatedByAndDeletedFalseOrderByDateDesc(UUID createdBy);

    /** Ownership-scoped lookup (used by RunSignalCalculator to resolve a just-saved run log). */
    Optional<RunSessionLogEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);

    /** Logs on/after {@code from} — the companion snapshot's last-N-days digest. */
    List<RunSessionLogEntity> findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(
        UUID createdBy, LocalDate from);
}
