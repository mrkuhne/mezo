package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzDigestEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * The owner's daily digests: one live row per owner and date. A rebuild replaces the day's row — the caller
 * hard-deletes the old one with {@link #purgeDay} and saves the new one in the same transaction (a soft delete would
 * keep a dead copy of yesterday's model prose for nothing; the partial unique index allows either).
 */
public interface PenzDigestRepository extends JpaRepository<PenzDigestEntity, UUID> {

    Optional<PenzDigestEntity> findByCreatedByAndDigestDateAndDeletedFalse(UUID createdBy, LocalDate digestDate);

    /** The owner's live digests from {@code from} to {@code to} (both inclusive), oldest first — the weekly review's source. */
    List<PenzDigestEntity> findByCreatedByAndDigestDateBetweenAndDeletedFalseOrderByDigestDateAsc(
        UUID createdBy, LocalDate from, LocalDate to);

    /** Removes the owner's digest rows for {@code digestDate} (live or soft-deleted); returns how many went. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "delete from penz_digest where created_by = :createdBy and digest_date = :digestDate",
        nativeQuery = true)
    int purgeDay(@Param("createdBy") UUID createdBy, @Param("digestDate") LocalDate digestDate);
}
