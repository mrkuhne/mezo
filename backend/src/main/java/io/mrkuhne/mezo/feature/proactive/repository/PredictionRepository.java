package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PredictionRepository extends JpaRepository<PredictionEntity, UUID> {

    /** The weekly generation's idempotence probe (n rows per week — existence, not uniqueness). */
    boolean existsByCreatedByAndWeekStart(UUID createdBy, LocalDate weekStart);

    /** The GET's read: all live predictions, newest validity window first. */
    List<PredictionEntity> findByCreatedByOrderByValidFromDescGeneratedAtDesc(UUID createdBy);

    /** The validation run's read: pending rows whose window has closed. */
    List<PredictionEntity> findByCreatedByAndStatusAndValidToBefore(
            UUID createdBy, String status, LocalDate validTo);

    /** S2 (mezo-tk88.2): the pattern-detail page's impact list — predictions grounded on one pattern. */
    List<PredictionEntity> findByCreatedByAndSourcePatternIdAndDeletedFalse(UUID createdBy, UUID sourcePatternId);

    /** Weekly review gather (mezo-p2tr): this week's predictions + status lines. */
    List<PredictionEntity> findByCreatedByAndWeekStart(UUID createdBy, LocalDate weekStart);

    /** Karakter round-4 read layer (CharacterMetaReads): window read, bounded above for catch-up honesty. */
    List<PredictionEntity> findByCreatedByAndValidToBetweenAndDeletedFalse(
            UUID createdBy, LocalDate from, LocalDate to);
}
