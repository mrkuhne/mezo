package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for {@link SportSessionEntity}. Extends {@link JpaRepository} directly rather than the
 * house {@code OwnedRepository}: this entity does carry a {@code date}, but {@code findAllOwned}
 * orders it ascending whereas the Train API surfaces sport sessions newest-first, so we declare an
 * explicit date-descending finder instead.
 */
public interface SportSessionRepository extends JpaRepository<SportSessionEntity, UUID> {

    List<SportSessionEntity> findByCreatedByAndDeletedFalseOrderByDateDesc(UUID createdBy);

    /** Ownership-scoped lookup (used by SportSignalCalculator to resolve a just-saved session). */
    Optional<SportSessionEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);

    /** Sessions on/after {@code from} — the companion snapshot's last-N-days digest. */
    List<SportSessionEntity> findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(
        UUID createdBy, LocalDate from);
}
