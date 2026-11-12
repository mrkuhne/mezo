package io.mrkuhne.mezo.feature.wearable.repository;

import io.mrkuhne.mezo.feature.wearable.entity.HealthSampleEntity;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HealthSampleRepository extends JpaRepository<HealthSampleEntity, UUID> {

    @Query(value = "select external_id from health_sample where created_by = :createdBy and external_id in (:ids)",
           nativeQuery = true)
    List<String> findExistingExternalIds(@Param("createdBy") UUID createdBy, @Param("ids") Collection<String> ids);

    /** Idempotent sample write keyed by the client's external id; a re-sent id revives a deleted row
     *  (it exists in Health again). {@code meta} is passed as JSON text. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        insert into health_sample (created_by, external_id, metric, start_at, end_at, value, unit, source_name,
                                   source_bundle, device, user_entered, meta, is_deleted, created_at, updated_at)
        values (:createdBy, :externalId, :metric, :startAt, :endAt, :value, :unit, :sourceName, :sourceBundle,
                :device, :userEntered, cast(:meta as jsonb), false, now(), now())
        on conflict on constraint uq_health_sample_owner_external
        do update set metric = excluded.metric, start_at = excluded.start_at, end_at = excluded.end_at,
                      value = excluded.value, unit = excluded.unit, source_name = excluded.source_name,
                      source_bundle = excluded.source_bundle, device = excluded.device,
                      user_entered = excluded.user_entered, meta = excluded.meta, is_deleted = false,
                      updated_at = now()
        """, nativeQuery = true)
    void upsert(@Param("createdBy") UUID createdBy, @Param("externalId") String externalId,
                @Param("metric") String metric, @Param("startAt") Instant startAt, @Param("endAt") Instant endAt,
                @Param("value") Double value, @Param("unit") String unit, @Param("sourceName") String sourceName,
                @Param("sourceBundle") String sourceBundle, @Param("device") String device,
                @Param("userEntered") boolean userEntered, @Param("meta") String meta);

    /** The owner's live samples of one metric starting inside {@code [from, to]}, oldest first
     *  (Boop B3, mezo-r36n9.13: the server-side check-in snapshot). */
    @Query("""
        select h from HealthSampleEntity h
        where h.createdBy = :createdBy and h.metric = :metric and h.deleted = false
          and h.startAt >= :from and h.startAt <= :to
        order by h.startAt asc
        """)
    List<HealthSampleEntity> findWindow(@Param("createdBy") UUID createdBy, @Param("metric") String metric,
                                        @Param("from") Instant from, @Param("to") Instant to);

    /** Soft-deletes the owner's live rows with these external ids; returns how many were live. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        update health_sample set is_deleted = true, updated_at = now()
        where created_by = :createdBy and external_id in (:ids) and is_deleted = false
        """, nativeQuery = true)
    int softDeleteByExternalIds(@Param("createdBy") UUID createdBy, @Param("ids") Collection<String> ids);
}
