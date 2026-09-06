package io.mrkuhne.mezo.feature.habit.repository;

import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HabitDayRepository extends JpaRepository<HabitDayEntity, UUID> {

    List<HabitDayEntity> findByCreatedByAndHabitDate(UUID createdBy, LocalDate habitDate);

    Optional<HabitDayEntity> findByCreatedByAndHabitDateAndHabitKey(
        UUID createdBy, LocalDate habitDate, String habitKey);

    List<HabitDayEntity> findByCreatedByAndStatusAndHabitDateBefore(
        UUID createdBy, String status, LocalDate before);

    List<HabitDayEntity> findByCreatedByAndHabitDateBetween(
        UUID createdBy, LocalDate from, LocalDate to);

    /**
     * One habit's WHOLE lifetime, oldest first (mezo-08zl). Deliberately unbounded in time — the
     * formation estimate is about the full arc, not the 28-day strength window — which is why it
     * only ever runs behind the page-triggered {@code /api/habit/formation/{key}} and never on
     * the chat-hot {@code summary()} path.
     */
    List<HabitDayEntity> findByCreatedByAndHabitKeyOrderByHabitDateAsc(
        UUID createdBy, String habitKey);

    /** Feature-abandonment usage reads (round 2 S5, bd mezo-d58h.7.5, spec 2026-09-05 §(17)) —
     *  STATUS-SCOPED on purpose. {@code habit_day} rows are written by the APP
     *  ({@code HabitService} materializes a {@code pending} row per active def on any read; the
     *  stale-close pass writes {@code missed}), so only {@code done} rows are evidence that the
     *  USER touched the surface. */
    long countByCreatedByAndStatus(UUID createdBy, String status);

    boolean existsByCreatedByAndStatusAndCreatedAtAfter(UUID createdBy, String status, Instant createdAt);
}
