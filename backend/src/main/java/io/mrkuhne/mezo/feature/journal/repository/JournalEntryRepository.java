package io.mrkuhne.mezo.feature.journal.repository;

import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JournalEntryRepository extends JpaRepository<JournalEntryEntity, UUID> {

    Optional<JournalEntryEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    Optional<JournalEntryEntity> findByCreatedByAndClientRefAndDeletedFalse(UUID createdBy, UUID clientRef);

    /** Race-safe insert for a Boop retry: a concurrent insert of the same {@code clientRef} makes this one
     *  wait and then do nothing (no unique violation, so a caller's transaction is never aborted). Returns 1
     *  when this call created the row; the caller reads it back. */
    @Modifying(flushAutomatically = true)
    @Query(value = """
        insert into journal_entry (created_by, occurred_on, text, source, client_ref)
        values (:createdBy, :occurredOn, :text, :source, :clientRef)
        on conflict (created_by, client_ref) where client_ref is not null and is_deleted = false do nothing
        """, nativeQuery = true)
    int insertIfClientRefAbsent(@Param("createdBy") UUID createdBy, @Param("occurredOn") LocalDate occurredOn,
                                @Param("text") String text, @Param("source") String source,
                                @Param("clientRef") UUID clientRef);

    List<JournalEntryEntity> findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(
        UUID createdBy, LocalDate startInclusive, LocalDate endInclusive);

    /** Feature-abandonment usage reads (round 2 S5, bd mezo-d58h.7.5, spec 2026-09-05 §(17)): how
     *  much of this surface the user has EVER written, and whether anything landed inside the idle
     *  window. {@code @SQLRestriction} on the entity already excludes soft-deleted rows, which is
     *  why neither name carries an {@code AndDeletedFalse}. */
    long countByCreatedBy(UUID createdBy);

    boolean existsByCreatedByAndCreatedAtAfter(UUID createdBy, Instant createdAt);
}
