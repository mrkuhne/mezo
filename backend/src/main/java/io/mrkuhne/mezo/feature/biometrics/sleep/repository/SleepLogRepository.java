package io.mrkuhne.mezo.feature.biometrics.sleep.repository;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
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

    /** Idempotent Apple Health night write (Boop S2, mezo-r36n9.2). Native ON CONFLICT because
     *  {@code uq_sleep_log_owner_external} spans soft-deleted rows that {@code @SQLRestriction} hides
     *  (same reason as {@code AiDraftOutcomeRepository#upsertOutcome}); a deleted night stays deleted. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        insert into sleep_log (created_by, external_id, date, bedtime, wakeup, duration_h, in_bed_min,
                               awake_min, light_min, rem_min, deep_min, hypnogram, source_app, sleeping_hr, source,
                               is_deleted, created_at)
        values (:createdBy, :externalId, :date, :bedtime, :wakeup, :durationH, :inBedMin,
                :awakeMin, :lightMin, :remMin, :deepMin, cast(:hypnogram as jsonb), :sourceApp, :sleepingHr, 'apple_health', false, now())
        on conflict (created_by, external_id) where external_id is not null
        do update set date = excluded.date, bedtime = excluded.bedtime, wakeup = excluded.wakeup,
                      duration_h = excluded.duration_h, in_bed_min = excluded.in_bed_min,
                      awake_min = excluded.awake_min, light_min = excluded.light_min,
                      rem_min = excluded.rem_min, deep_min = excluded.deep_min,
                      hypnogram = excluded.hypnogram, source_app = excluded.source_app,
                      sleeping_hr = excluded.sleeping_hr, source = 'apple_health'
        """, nativeQuery = true)
    void upsertAppleHealthNight(@Param("createdBy") UUID createdBy, @Param("externalId") String externalId,
                                @Param("date") LocalDate date, @Param("bedtime") String bedtime,
                                @Param("wakeup") String wakeup, @Param("durationH") BigDecimal durationH,
                                @Param("inBedMin") Integer inBedMin, @Param("awakeMin") Integer awakeMin,
                                @Param("lightMin") Integer lightMin, @Param("remMin") Integer remMin,
                                @Param("deepMin") Integer deepMin, @Param("hypnogram") String hypnogramJson,
                                @Param("sourceApp") String sourceApp, @Param("sleepingHr") Integer sleepingHr);
}
