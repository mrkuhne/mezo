package io.mrkuhne.mezo.feature.telemetry.repository;

import io.mrkuhne.mezo.feature.telemetry.entity.ScreenEventEntity;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * The screen-event log (bd mezo-o5cz). Deliberately NOT behind the feature switch: a Spring Data
 * interface is inert without a caller, and leaving it unconditional lets {@code AdminUsageService}
 * inject it once — with the switch off the table is simply empty and the admin panel reads zeros,
 * instead of the admin slice needing an ObjectProvider dance for a query that cannot fail.
 *
 * <p>The dependency direction is {@code admin -> telemetry} and never the reverse (ArchUnit
 * {@code feature_slices_are_cycle_free}); nothing in this package knows the admin slice exists.
 */
public interface ScreenEventRepository extends JpaRepository<ScreenEventEntity, UUID> {

    /** Per-screen totals since {@code since} — the admin table's rows. */
    @Query(value = """
        select e.screen as "screen",
               count(*) as "views",
               count(distinct e.created_by) as "uniqueUsers",
               max(e.occurred_at) as "lastSeenAt"
        from screen_event e
        where e.occurred_at >= :since
        group by e.screen
        order by 2 desc, 1 asc
        """, nativeQuery = true)
    List<ScreenUsageRow> aggregateByScreenSince(@Param("since") Instant since);

    /** Screen x day view counts since {@code since}, cut in {@code zone} — the sparklines. */
    @Query(value = """
        select e.screen as "screen",
               (e.occurred_at at time zone :zone)::date as "day",
               count(*) as "views"
        from screen_event e
        where e.occurred_at >= :since
        group by 1, 2
        order by 1, 2
        """, nativeQuery = true)
    List<ScreenDayRow> aggregateByScreenAndDaySince(@Param("since") Instant since, @Param("zone") String zone);

    /**
     * Retention: a hard DELETE of everything that occurred before {@code cutoff}. These rows are
     * disposable by design (spec §3) — there is nothing to soft-delete and nothing to archive.
     */
    @Modifying
    @Query("delete from ScreenEventEntity e where e.occurredAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") Instant cutoff);
}
