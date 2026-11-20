package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzProposalEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** The owner's investment proposals (mezo-r36n9.105). */
public interface PenzProposalRepository extends JpaRepository<PenzProposalEntity, UUID> {

    List<PenzProposalEntity> findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(UUID createdBy);

    List<PenzProposalEntity> findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(UUID createdBy,
                                                                                         String status);

    List<PenzProposalEntity> findByCreatedByAndKindAndStatusAndDeletedFalse(UUID createdBy, String kind,
                                                                           String status);

    Optional<PenzProposalEntity> findFirstByCreatedByAndKindAndMonthAndStatusInAndDeletedFalseOrderByCreatedAtDesc(
        UUID createdBy, String kind, String month, Collection<String> statuses);

    Optional<PenzProposalEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
