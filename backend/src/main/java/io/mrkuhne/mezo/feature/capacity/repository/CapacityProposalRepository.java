package io.mrkuhne.mezo.feature.capacity.repository;

import io.mrkuhne.mezo.feature.capacity.entity.CapacityProposalEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CapacityProposalRepository extends JpaRepository<CapacityProposalEntity, UUID> {
    List<CapacityProposalEntity> findByCreatedByAndWeekStartAndDeletedFalse(UUID owner, java.time.LocalDate weekStart);

    /** Every proposal of the owner in that status (the season stats count the accepted ones). */
    List<CapacityProposalEntity> findByCreatedByAndStatusAndDeletedFalse(UUID owner, String status);
}
