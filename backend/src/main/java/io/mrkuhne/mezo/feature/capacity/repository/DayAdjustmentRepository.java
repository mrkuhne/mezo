package io.mrkuhne.mezo.feature.capacity.repository;

import io.mrkuhne.mezo.feature.capacity.entity.DayAdjustmentEntity;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DayAdjustmentRepository extends JpaRepository<DayAdjustmentEntity, UUID> {
    List<DayAdjustmentEntity> findByCreatedByAndDateAndDeletedFalse(UUID owner, LocalDate date);

    /** Rows filed in {@code from..to}, oldest first. */
    List<DayAdjustmentEntity> findByCreatedByAndDateBetweenAndDeletedFalseOrderByDateAscCreatedAtAsc(
        UUID owner, LocalDate from, LocalDate to);

    /** Rows of the owner in any of these states (the stale sweep, the empty-day check). */
    List<DayAdjustmentEntity> findByCreatedByAndStateInAndDeletedFalse(UUID owner, Collection<String> states);

    /** Rows filed in {@code from..to} in any of these states, oldest first (the readers' ledger read). */
    List<DayAdjustmentEntity> findByCreatedByAndStateInAndDateBetweenAndDeletedFalseOrderByDateAscCreatedAtAsc(
        UUID owner, Collection<String> states, LocalDate from, LocalDate to);

    /** The first step of an accepted bundle carries the request's clientRef itself (idempotent replay). */
    Optional<DayAdjustmentEntity> findByCreatedByAndClientRefAndDeletedFalse(UUID owner, UUID clientRef);

    List<DayAdjustmentEntity> findByCreatedByAndBundleIdAndDeletedFalseOrderByCreatedAtAsc(UUID owner, UUID bundleId);

    Optional<DayAdjustmentEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID owner);

    /** The row's proposal id without loading the row (undo locks the proposal before it reads the bundle). */
    @Query("select a.proposalId from DayAdjustmentEntity a where a.id = :id and a.createdBy = :owner and a.deleted = false")
    Optional<UUID> findProposalIdOf(@Param("id") UUID id, @Param("owner") UUID owner);
}
