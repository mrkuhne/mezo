package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzAccountEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Accounts carry no {@code date}: bespoke owner-scoped finders (the {@code GoalRepository} shape). */
public interface PenzAccountRepository extends JpaRepository<PenzAccountEntity, UUID> {

    List<PenzAccountEntity> findByCreatedByAndDeletedFalseOrderByNameAsc(UUID createdBy);

    List<PenzAccountEntity> findByCreatedByAndArchivedFalseAndDeletedFalseOrderByNameAsc(UUID createdBy);

    Optional<PenzAccountEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    Optional<PenzAccountEntity> findFirstByCreatedByAndSavingsTargetTrueAndArchivedFalseAndDeletedFalse(UUID createdBy);

    /** Takes the default flag off every account of the owner — run BEFORE setting it on one (partial unique index). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "update penz_account set is_default = false where created_by = :createdBy and is_default = true",
        nativeQuery = true)
    int clearDefault(@Param("createdBy") UUID createdBy);

    /** Takes the savings-target flag off every account of the owner — run BEFORE setting it on one. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "update penz_account set is_savings_target = false where created_by = :createdBy and is_savings_target = true",
        nativeQuery = true)
    int clearSavingsTarget(@Param("createdBy") UUID createdBy);
}
