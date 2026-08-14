package io.mrkuhne.mezo.feature.ritual.repository;

import io.mrkuhne.mezo.feature.ritual.entity.RitualDayEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RitualDayRepository extends JpaRepository<RitualDayEntity, UUID> {
    Optional<RitualDayEntity> findByCreatedByAndRitualDate(UUID createdBy, LocalDate ritualDate);

    /**
     * Race-safe insert of the day's close (mezo-5jly). Native, because JPA cannot express
     * {@code ON CONFLICT} — and that is exactly what this needs: a duplicate must be a no-op the
     * database absorbs, never a constraint violation. A violation aborts the whole Postgres
     * transaction (SQLSTATE 25P02), after which every later statement on that connection fails,
     * so the previous "catch the violation and re-read in the same tx" guard could not work by
     * construction (mechanism pinned by {@code TxRaceGuardReproIT}).
     *
     * <p>The conflict target repeats the index predicate ({@code where is_deleted = false})
     * because {@code uq_ritual_day_user_date} is a PARTIAL unique index — without the predicate
     * Postgres cannot match the inference specification and fails to plan the statement at all.
     *
     * @return 1 when this caller inserted the row, 0 when a concurrent caller already had
     */
    @Modifying
    @Query(value = """
        insert into ritual_day (id, created_by, created_at, is_deleted, ritual_date, closed_at)
        values (gen_random_uuid(), :createdBy, :now, false, :ritualDate, :closedAt)
        on conflict (created_by, ritual_date) where is_deleted = false do nothing
        """, nativeQuery = true)
    int insertIfAbsent(@Param("createdBy") UUID createdBy,
                       @Param("ritualDate") LocalDate ritualDate,
                       @Param("closedAt") Instant closedAt,
                       @Param("now") Instant now);

    List<RitualDayEntity> findByCreatedByAndRitualDateBetween(UUID createdBy, LocalDate from, LocalDate to);

    Optional<RitualDayEntity> findFirstByCreatedByOrderByRitualDateAsc(UUID createdBy);
}
