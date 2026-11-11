package io.mrkuhne.mezo.feature.biometrics.weight.repository;

import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.techcore.persistence.OwnedRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WeightLogRepository extends OwnedRepository<WeightLogEntity> {

    /** One day's (latest) weigh-in — plain finder for the companion daily digest (V2.2). */
    Optional<WeightLogEntity> findFirstByCreatedByAndDeletedFalseAndDateOrderByCreatedAtDesc(
            UUID createdBy, LocalDate date);

    /** Weigh-ins from {@code date} onward — the proactive P1 validation reads a window (upper
     *  bound filtered in Java, the house ≥-then-filter idiom; sleep uses the same shape). */
    List<WeightLogEntity> findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(
            UUID createdBy, LocalDate date);

    /** The single latest weigh-in (by date, tie-broken by created_at) — the companion snapshot's
     *  [Profil] "mérés:" fact, shown beside the EWMA trend (V2.2 follow-up, mezo-gst9). */
    Optional<WeightLogEntity> findFirstByCreatedByAndDeletedFalseOrderByDateDescCreatedAtDesc(
            UUID createdBy);

    /** Weekly review {@code stale} probe (mezo-p2tr): the most recently CREATED weigh-in inside
     *  the week — compared against the review's {@code generatedAt}, not its own {@code date}. */
    Optional<WeightLogEntity> findFirstByCreatedByAndDeletedFalseAndDateBetweenOrderByCreatedAtDesc(
            UUID createdBy, LocalDate from, LocalDate to);

    /** Every weigh-in inside a closed day window — the Fuel-week weight average (mezo-d20.7.2)
     *  folds these to one value per day (the day's latest) before averaging. Ordered so the
     *  LAST row of a given date is that date's latest entry. */
    List<WeightLogEntity> findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateAscCreatedAtAsc(
            UUID createdBy, LocalDate from, LocalDate to);

    @Query(value = "select external_id from weight_log where created_by = :createdBy and external_id in (:ids)",
           nativeQuery = true)
    List<String> findExistingExternalIds(@Param("createdBy") UUID createdBy, @Param("ids") Collection<String> ids);

    /** Apple Health weigh-in keyed by the HealthKit uuid; a re-sent id revives a deleted row (B1). */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        insert into weight_log (created_by, date, weight_kg, source, external_id, is_deleted, created_at)
        values (:createdBy, :date, :weightKg, 'apple_health', :externalId, false, now())
        on conflict (created_by, external_id) where external_id is not null
        do update set date = excluded.date, weight_kg = excluded.weight_kg, is_deleted = false
        """, nativeQuery = true)
    void upsertFromHealth(@Param("createdBy") UUID createdBy, @Param("externalId") String externalId,
                          @Param("date") LocalDate date, @Param("weightKg") BigDecimal weightKg);

    /** Soft-deletes the owner's live Apple Health weigh-ins with these external ids. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        update weight_log set is_deleted = true
        where created_by = :createdBy and source = 'apple_health' and external_id in (:ids) and is_deleted = false
        """, nativeQuery = true)
    int softDeleteHealthByExternalIds(@Param("createdBy") UUID createdBy, @Param("ids") Collection<String> ids);
}
