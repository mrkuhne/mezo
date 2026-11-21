package io.mrkuhne.mezo.feature.capacity.repository;

import io.mrkuhne.mezo.feature.capacity.entity.CapacityProposalEntity;
import java.util.List;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

public interface CapacityProposalRepository extends JpaRepository<CapacityProposalEntity, UUID> {
    List<CapacityProposalEntity> findByCreatedByAndWeekStartAndDeletedFalse(UUID owner, java.time.LocalDate weekStart);

    /** Every proposal of the owner in that status (the season stats count the accepted ones). */
    List<CapacityProposalEntity> findByCreatedByAndStatusAndDeletedFalse(UUID owner, String status);

    /** The owner's proposal, row-locked for the accept/undo write (two quick taps serialize on it). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<CapacityProposalEntity> findWithLockByIdAndCreatedByAndDeletedFalse(UUID id, UUID owner);
}
