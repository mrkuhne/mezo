package io.mrkuhne.mezo.feature.companion.reflection.repository;

import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Owned reads for {@code text_signal} — every finder filters {@code created_by} in SQL. */
public interface TextSignalRepository extends JpaRepository<TextSignalEntity, UUID> {

    /** S4 (mezo-eq85.4): one owned signal by id — the quick notice's entry point. */
    Optional<TextSignalEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /** The version a series reads: newest row for one source. */
    Optional<TextSignalEntity> findFirstByCreatedByAndSourceKindAndSourceIdAndDeletedFalseOrderByVersionDesc(
            UUID createdBy, String sourceKind, UUID sourceId);

    List<TextSignalEntity> findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(
            UUID createdBy, String sourceKind, UUID sourceId);

    List<TextSignalEntity> findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnAscVersionDesc(
            UUID createdBy, LocalDate from, LocalDate to);

    Optional<TextSignalEntity> findFirstByCreatedByAndSourceKindAndOccurredOnAndDeletedFalseOrderByVersionDesc(
            UUID createdBy, String sourceKind, LocalDate occurredOn);

    /**
     * The ONE documented owner-less finder (CLAUDE.md's "every owned query filters created_by"
     * exception): the deleted-entry suppression path. {@code JournalEntryDeletedEvent} /
     * {@code GratitudeEntryDeletedEvent} carry only the entry id — by the time the AFTER_COMMIT
     * listener runs, the source row is already soft-deleted, so its owner can no longer be read
     * from it. A soft delete keyed by {@code (source_kind, source_id)} needs no owner: the pair is
     * globally unique (the source id is a UUID PK), so this can never touch another user's row.
     * Kept deliberately narrow — suppression only, never a read that feeds a series or a prompt.
     */
    List<TextSignalEntity> findBySourceKindAndSourceIdAndDeletedFalse(String sourceKind, UUID sourceId);
}
