package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzAccountEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Accounts carry no {@code date}: bespoke owner-scoped finders (the {@code GoalRepository} shape). */
public interface PenzAccountRepository extends JpaRepository<PenzAccountEntity, UUID> {

    List<PenzAccountEntity> findByCreatedByAndDeletedFalseOrderByNameAsc(UUID createdBy);

    List<PenzAccountEntity> findByCreatedByAndArchivedFalseAndDeletedFalseOrderByNameAsc(UUID createdBy);

    Optional<PenzAccountEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    Optional<PenzAccountEntity> findFirstByCreatedByAndSavingsTargetTrueAndArchivedFalseAndDeletedFalse(UUID createdBy);
}
