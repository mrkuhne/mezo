package io.mrkuhne.mezo.feature.biometrics.sleep.repository;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.techcore.persistence.OwnedRepository;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SleepLogRepository extends OwnedRepository<SleepLogEntity> {

    /** Latest sleep row ("last night") for the companion context snapshot. */
    Optional<SleepLogEntity> findFirstByCreatedByAndDeletedFalseOrderByDateDesc(UUID createdBy);

    /** Last-N-days window for the companion get_recovery(scope=sleep) tool (V0.5, mezo-xixu) — plain
     *  finder, no companion dependency. */
    List<SleepLogEntity> findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(
            UUID createdBy, LocalDate from);

    /** Detail window for the companion get_recovery(scope=sleep) date/from/to params (mezo-ohce)
     *  — plain derived finder, no companion dependency. Inclusive bounds, newest first. */
    List<SleepLogEntity> findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(
            UUID createdBy, LocalDate from, LocalDate to);

    /** Weekly review {@code stale} probe (mezo-p2tr): the most recently CREATED sleep row inside
     *  the week — compared against the review's {@code generatedAt}, not its own {@code date}. */
    Optional<SleepLogEntity> findFirstByCreatedByAndDeletedFalseAndDateBetweenOrderByCreatedAtDesc(
            UUID createdBy, LocalDate from, LocalDate to);

    /** External ids of this owner that already have a row — soft-deleted ones included, because the
     *  unique slot spans them (Boop S2 upsert counts inserted vs updated from this). */
    @Query(value = "select external_id from sleep_log where created_by = :createdBy and external_id in (:ids)",
           nativeQuery = true)
    List<String> findExistingExternalIds(@Param("createdBy") UUID createdBy, @Param("ids") Collection<String> ids);

    /** The live row of one date, write-locked: both night writers merge into it (one night per date,
     *  Boop B1). Soft-deleted rows are invisible here by {@code @SQLRestriction}. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<SleepLogEntity> findByCreatedByAndDateAndDeletedFalse(UUID createdBy, LocalDate date);

    /** The live row owning a Health external id (it may sit on another date than a re-sent night). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<SleepLogEntity> findByCreatedByAndExternalIdAndDeletedFalse(UUID createdBy, String externalId);

    /** Live Health nights inside a re-sent window — the candidates for window deletion. */
    List<SleepLogEntity> findByCreatedByAndDeletedFalseAndSourceAndDateBetween(
            UUID createdBy, String source, LocalDate from, LocalDate to);

    /** Frees an external id held by a SOFT-DELETED row so a live row can take it: the unique index
     *  {@code uq_sleep_log_owner_external} spans deleted rows that {@code @SQLRestriction} hides. */
    @Modifying(flushAutomatically = true)
    @Query(value = "update sleep_log set external_id = null "
        + "where created_by = :createdBy and external_id = :externalId and is_deleted = true", nativeQuery = true)
    int clearDeletedExternalId(@Param("createdBy") UUID createdBy, @Param("externalId") String externalId);
}
