package io.mrkuhne.mezo.feature.capacity.repository;

import io.mrkuhne.mezo.feature.capacity.entity.CapacityProposalEntity;
import java.util.List;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CapacityProposalRepository extends JpaRepository<CapacityProposalEntity, UUID> {
    List<CapacityProposalEntity> findByCreatedByAndWeekStartAndDeletedFalse(UUID owner, java.time.LocalDate weekStart);

    /** Every proposal of the owner in that status (the season stats count the accepted ones). */
    List<CapacityProposalEntity> findByCreatedByAndStatusAndDeletedFalse(UUID owner, String status);

    /** The owner's proposal, row-locked for the accept/undo write (two quick taps serialize on it). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<CapacityProposalEntity> findWithLockByIdAndCreatedByAndDeletedFalse(UUID id, UUID owner);

    /** The owner's proposals about a day in {@code from..to} (the outcome job's window, Boop B7 K4). */
    List<CapacityProposalEntity> findByCreatedByAndDayBetweenAndDeletedFalse(UUID owner, java.time.LocalDate from,
                                                                             java.time.LocalDate to);

    /** The owner's proposals of the weeks starting in {@code from..to} (the week read's history, Boop B7 K4). */
    List<CapacityProposalEntity> findByCreatedByAndWeekStartBetweenAndDeletedFalse(UUID owner, java.time.LocalDate from,
                                                                                   java.time.LocalDate to);

    /** Owners with a proposal in a week starting on or after {@code from} (the nightly learning pass's owners). */
    @Query("select distinct p.createdBy from CapacityProposalEntity p where p.weekStart >= :from")
    List<UUID> ownersSince(@Param("from") java.time.LocalDate from);
}
