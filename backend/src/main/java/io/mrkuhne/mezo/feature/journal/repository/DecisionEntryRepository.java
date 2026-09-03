package io.mrkuhne.mezo.feature.journal.repository;

import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import java.time.Instant;
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

    /** W5.3 (mezo-b3pp.20): reviewed decisions whose REVIEW landed inside a window, rating
     *  present — the profile's decision-quality trend input. Windowed by {@code reviewedAt}
     *  (not {@code decidedOn}) on purpose: the trend is about how his judgement is turning out
     *  as he learns the outcomes, not about when he happened to write the decision down.
     *
     *  <p>Half-open {@code [from, to)} on purpose — review fix (mezo-b3pp.20): Spring Data's
     *  {@code Between} renders JPQL/SQL {@code BETWEEN}, which is inclusive at BOTH ends, so a
     *  {@code Between} pair built from two adjacent quarter boundaries (this quarter's start doubling
     *  as the previous quarter's exclusive end) would double-count a decision reviewed at exactly
     *  that boundary instant into both quarters. {@code GrowthWeekService} already has this same
     *  {@code isBefore(until)} idiom for the identical reason (its own week-boundary "until"
     *  midnight must belong to the next period, not both). */
    List<DecisionEntryEntity> findByCreatedByAndReviewedAtGreaterThanEqualAndReviewedAtLessThanAndOutcomeRatingIsNotNullAndDeletedFalse(
        UUID createdBy, Instant from, Instant to);

    /** mezo-d20.7.8: decisions RECORDED inside a week — the weekly review's gather input
     *  ({@code WeeklyReviewContextSources}), chronological because the review narrates forwards. */
    List<DecisionEntryEntity> findByCreatedByAndDecidedOnBetweenAndDeletedFalseOrderByDecidedOnAsc(
        UUID createdBy, LocalDate startInclusive, LocalDate endInclusive);

    /** mezo-d20.7.8: decisions REVIEWED inside a week's half-open {@code [from, to)} instant window
     *  — the weekly review's gather input. Unlike the W5.3 finder above this does NOT require an
     *  {@code outcomeRating}: an ungraded review still happened, and the gather renders the missing
     *  rating as the honest {@code –} rather than dropping the row. */
    List<DecisionEntryEntity> findByCreatedByAndReviewedAtGreaterThanEqualAndReviewedAtLessThanAndDeletedFalseOrderByReviewedAtAsc(
        UUID createdBy, Instant from, Instant to);
}
