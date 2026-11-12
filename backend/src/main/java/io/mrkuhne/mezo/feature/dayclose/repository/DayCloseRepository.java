package io.mrkuhne.mezo.feature.dayclose.repository;

import io.mrkuhne.mezo.feature.dayclose.entity.DayCloseEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/** Live closes only ({@code @SQLRestriction} on the entity); every finder is owner-scoped. */
public interface DayCloseRepository extends JpaRepository<DayCloseEntity, UUID> {

    Optional<DayCloseEntity> findByCreatedByAndCloseDate(UUID createdBy, LocalDate closeDate);

    List<DayCloseEntity> findByCreatedByAndCloseDateBetween(UUID createdBy, LocalDate from, LocalDate to);

    /** Makes sure the day has its one live close row without a unique violation (a retried or concurrent PUT);
     *  the caller reads it back with {@link #findByCreatedByAndCloseDate} and fills it. */
    @Modifying(flushAutomatically = true)
    @Query(value = """
        insert into day_close (created_by, close_date, closed_at, day_rating, client_ref)
        values (:createdBy, :closeDate, :closedAt, :dayRating, :clientRef)
        on conflict (created_by, close_date) where is_deleted = false do nothing
        """, nativeQuery = true)
    int insertIfAbsent(@Param("createdBy") UUID createdBy, @Param("closeDate") LocalDate closeDate,
                       @Param("closedAt") Instant closedAt, @Param("dayRating") int dayRating,
                       @Param("clientRef") UUID clientRef);

    /** Stores Boop's sentence for the close's inputs {@code hash}; a no-op (0) when the close was re-written
     *  after it was read ({@code updated_at} moved) — the line would describe the old close. */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        update day_close set boop_line = :line, boop_line_hash = :hash
        where id = :id and created_by = :createdBy and updated_at = :seenUpdatedAt and is_deleted = false
        """, nativeQuery = true)
    int storeLine(@Param("id") UUID id, @Param("createdBy") UUID createdBy, @Param("seenUpdatedAt") Instant seenUpdatedAt,
                  @Param("line") String line, @Param("hash") String hash);
}
