package io.mrkuhne.mezo.feature.habit.repository;

import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HabitDayRepository extends JpaRepository<HabitDayEntity, UUID> {

    List<HabitDayEntity> findByCreatedByAndHabitDate(UUID createdBy, LocalDate habitDate);

    /**
     * Race-safe bootstrap of a day's habit rows (mezo-5jly). One set-based statement over the
     * whole key list, so a concurrent bootstrap (the cron, a second read, a check) is absorbed by
     * {@code ON CONFLICT DO NOTHING} instead of raising a violation.
     *
     * <p>This matters more here than at a single-row site: the previous guard caught the
     * violation and re-read, but on Postgres the violation aborts the transaction (25P02) and the
     * recovery read fails too — so a losing bootstrap took down the whole {@code getDay}/
     * {@code check} request. Mechanism pinned by {@code TxRaceGuardReproIT}.
     *
     * <p>{@code status} and {@code xp_awarded} are deliberately left to their DDL defaults
     * ({@code 'pending'} / {@code 0}) rather than restated here — the column defaults are the one
     * source of truth for a database-level insert.
     *
     * <p>The conflict target repeats the index predicate because
     * {@code uq_habit_day_user_date_key} is a PARTIAL unique index.
     *
     * @return the number of rows this caller actually inserted (0 when a concurrent caller won)
     */
    @Modifying
    @Query(value = """
        insert into habit_day (id, created_by, created_at, is_deleted, habit_date, habit_key)
        select gen_random_uuid(), :createdBy, :now, false, :habitDate, k
        from unnest(cast(:habitKeys as text[])) as k
        on conflict (created_by, habit_date, habit_key) where is_deleted = false do nothing
        """, nativeQuery = true)
    int insertMissing(@Param("createdBy") UUID createdBy,
                      @Param("habitDate") LocalDate habitDate,
                      @Param("habitKeys") String[] habitKeys,
                      @Param("now") Instant now);

    Optional<HabitDayEntity> findByCreatedByAndHabitDateAndHabitKey(
        UUID createdBy, LocalDate habitDate, String habitKey);

    List<HabitDayEntity> findByCreatedByAndStatusAndHabitDateBefore(
        UUID createdBy, String status, LocalDate before);

    List<HabitDayEntity> findByCreatedByAndHabitDateBetween(
        UUID createdBy, LocalDate from, LocalDate to);
}
