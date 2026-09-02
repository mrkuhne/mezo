package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LearnedFactRepository extends JpaRepository<LearnedFactEntity, UUID> {

    /** The pending inbox: undecided candidates, newest first (idx_learned_fact_created_by_user_decision). */
    List<LearnedFactEntity> findByCreatedByAndUserDecisionIsNullAndDeletedFalseOrderByCreatedAtDesc(
            UUID createdBy);

    /** "A hét tanulságai" (mezo-d20.7.6): the week's candidates DECIDED OR NOT — the closed-week
     *  read shows the settled state too, which the pending inbox above deliberately hides. */
    List<LearnedFactEntity> findByCreatedByAndWeekStartAndDeletedFalseOrderByCreatedAtDesc(
            UUID createdBy, LocalDate weekStart);

    /** The still-open weekly candidates a regeneration archives with the old review (decided ones
     *  are never touched — the user's decision must not be lost). */
    List<LearnedFactEntity> findByCreatedByAndWeekStartAndUserDecisionIsNullAndDeletedFalse(
            UUID createdBy, LocalDate weekStart);

    /** Every live candidate of the user, DECIDED OR NOT — the weekly round's dedupe base: a
     *  rejected lesson must not be re-offered next Monday ("amit elvetsz, nem kérdezi újra"). */
    List<LearnedFactEntity> findByCreatedByAndDeletedFalse(UUID createdBy);

    Optional<LearnedFactEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /** Memória-obszervatórium (mezo-al1i) — az L2 kártya függő-jelölt száma. */
    long countByCreatedByAndUserDecisionIsNullAndDeletedFalse(UUID createdBy);

    /** Karakter round-4 read layer (CharacterMetaReads): window read, bounded above for catch-up honesty. */
    List<LearnedFactEntity> findByCreatedByAndUserDecisionIsNotNullAndCreatedAtGreaterThanEqualAndCreatedAtLessThanAndDeletedFalse(
            UUID createdBy, Instant from, Instant toExclusive);
}
