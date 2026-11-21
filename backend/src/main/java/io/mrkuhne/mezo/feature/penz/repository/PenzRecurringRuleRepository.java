package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzRecurringRuleEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Rules carry no {@code date} field: bespoke owner-scoped finders. */
public interface PenzRecurringRuleRepository extends JpaRepository<PenzRecurringRuleEntity, UUID> {

    List<PenzRecurringRuleEntity> findByCreatedByAndDeletedFalseOrderByNameAsc(UUID createdBy);

    Optional<PenzRecurringRuleEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /** Whether the account carries any live recurring rule (its currency is then locked, mezo-r36n9.108). */
    boolean existsByAccountIdAndDeletedFalse(UUID accountId);
}
