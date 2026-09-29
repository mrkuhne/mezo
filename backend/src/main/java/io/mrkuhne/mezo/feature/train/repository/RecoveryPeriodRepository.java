package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for {@link RecoveryPeriodEntity} (Kihagyás S2, mezo-q4xt2.2). The
 * {@code findFirstByCreatedByAndEndedOnIsNullAndDeletedFalse} lookup backs the "is the user
 * currently in kímélő mód" check; the range query backs a week/day read overlay (the caller
 * filters {@code endedOn == null || endedOn > from}); the "latest started" lookup backs the
 * "Tévedés volt" undo of the most recently opened period.
 */
public interface RecoveryPeriodRepository extends JpaRepository<RecoveryPeriodEntity, UUID> {

    Optional<RecoveryPeriodEntity> findFirstByCreatedByAndEndedOnIsNullAndDeletedFalse(UUID createdBy);

    List<RecoveryPeriodEntity> findByCreatedByAndStartDateLessThanEqualAndDeletedFalse(
        UUID createdBy, LocalDate to);

    Optional<RecoveryPeriodEntity> findFirstByCreatedByAndDeletedFalseOrderByStartDateDesc(UUID createdBy);

    /** The most recently ended period — the comeback ramp and the same-day "Mégsem vagyok jól" undo. */
    Optional<RecoveryPeriodEntity> findFirstByCreatedByAndEndedOnIsNotNullAndDeletedFalseOrderByEndedOnDescStartDateDesc(
        UUID createdBy);
}
