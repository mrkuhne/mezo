package io.mrkuhne.mezo.feature.goal.repository;

import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExpenditureEstimateRepository extends JpaRepository<ExpenditureEstimateEntity, UUID> {

    Optional<ExpenditureEstimateEntity> findByCreatedByAndWeekStartAndDeletedFalse(UUID createdBy, LocalDate weekStart);

    Optional<ExpenditureEstimateEntity> findFirstByCreatedByAndWeekStartBeforeAndDeletedFalseOrderByWeekStartDesc(
        UUID createdBy, LocalDate weekStart);

    Optional<ExpenditureEstimateEntity> findFirstByCreatedByAndDeletedFalseOrderByWeekStartDesc(UUID createdBy);

    boolean existsByCreatedByAndDeletedFalse(UUID createdBy);

    /**
     * The caller's most recent reviewed week that carries a "Hogy tanultam?" explanation
     * (mezo-y72o3) — older rows written before the explainer shipped have {@code explanation == null}
     * and are skipped, so this can land on an earlier week than
     * {@link #findFirstByCreatedByAndDeletedFalseOrderByWeekStartDesc}. Empty when the caller has no
     * explained row at all.
     */
    Optional<ExpenditureEstimateEntity> findFirstByCreatedByAndDeletedFalseAndExplanationIsNotNullOrderByWeekStartDesc(
        UUID createdBy);

    /** Every reviewed week from {@code weekStart} onward — the weekly summary's history (mezo-3n2so). */
    List<ExpenditureEstimateEntity> findByCreatedByAndWeekStartGreaterThanEqualAndDeletedFalseOrderByWeekStartAsc(
        UUID createdBy, LocalDate weekStart);

    /**
     * The caller's most recent reviewed weeks, newest first, capped by {@code page} (mezo-3n2so) —
     * pass {@code PageRequest.of(0, limit)} so a caller-chosen limit (up to 52, Task 5's API cap) is
     * honoured rather than silently truncated to a fixed top-N.
     */
    List<ExpenditureEstimateEntity> findByCreatedByAndDeletedFalseOrderByWeekStartDesc(UUID createdBy, Pageable page);
}
