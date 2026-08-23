package io.mrkuhne.mezo.feature.journal.repository;

import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DecisionEntryRepository extends JpaRepository<DecisionEntryEntity, UUID> {

    Optional<DecisionEntryEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    List<DecisionEntryEntity> findByCreatedByAndDeletedFalseOrderByDecidedOnDescCreatedAtDesc(UUID createdBy);

    /** The notification anchor's work list: decisions whose review lands exactly on {@code reviewDue}
     *  and that are still unreviewed (AnchorResolver, spec §5.4). */
    List<DecisionEntryEntity> findByCreatedByAndReviewDueAndReviewedAtIsNullAndDeletedFalse(
        UUID createdBy, LocalDate reviewDue);

    /** W4.3 (mezo-b3pp.17): decisions Daniel has ALREADY reviewed ({@code reviewedAt != null}),
     *  newest review first, capped by the caller — the profile's decision-quality input. */
    List<DecisionEntryEntity> findByCreatedByAndReviewedAtIsNotNullAndDeletedFalseOrderByReviewedAtDesc(
        UUID createdBy, Limit limit);
}
