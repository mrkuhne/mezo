package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.WeeklyScoreEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WeeklyScoreRepository extends JpaRepository<WeeklyScoreEntity, UUID> {

    Optional<WeeklyScoreEntity> findByCreatedByAndWeekStart(UUID createdBy, LocalDate weekStart);

    /** The trend window, oldest first (idx_weekly_score_created_by_week_start). */
    List<WeeklyScoreEntity> findByCreatedByAndWeekStartBetweenOrderByWeekStartAsc(
            UUID createdBy, LocalDate from, LocalDate to);

    /**
     * The newest {@code created_at} across every log that can move a week's score, inside
     * {@code [from, to]} — {@code null} when the window carries no such row at all.
     *
     * <p><b>Why native (the one place the derived→JPQL→native ladder ends at native):</b> this is
     * a MAX over ten unrelated aggregates in eight features; neither a derived method nor JPQL can
     * span them, and the alternative — ten separate {@code findFirst…OrderByCreatedAtDesc} calls,
     * the {@code WeeklyReviewService.isStale} idiom — costs ten round trips per probed week, which
     * an 8-week trend read pays 80 times.
     *
     * <p><b>What is in and what is out.</b> In: every source a {@code DayScoreService} subscore is
     * derived from — sleep ({@code sleep_log}), fuel ({@code meal} + {@code meal_item}, so editing
     * a meal's lines counts), check-in ({@code check_in}), activity ({@code workout_session},
     * {@code sport_session}, {@code run_session_log}) and the XP that feeds activity
     * ({@code habit_day}, {@code activity_log}, {@code daily_quest}). Out: {@code weight_log} —
     * weight is displayed by the week but feeds NO subscore, so a weigh-in must not invalidate a
     * score. Known limitation, inherited from {@code WeeklyReviewService.isStale}: the probe reads
     * {@code created_at}, so an EDIT of an existing row (rather than a new row) is not detected —
     * the {@code computedAt} the API returns is what keeps that case honest.
     */
    @Query(value = """
            select max(t.ts) from (
                select max(created_at) as ts from sleep_log
                    where created_by = :userId and is_deleted = false and date between :from and :to
                union all
                select max(created_at) from check_in
                    where created_by = :userId and is_deleted = false and date between :from and :to
                union all
                select max(created_at) from meal
                    where created_by = :userId and is_deleted = false and meal_date between :from and :to
                union all
                select max(i.created_at) from meal_item i join meal m on m.id = i.meal_id
                    where i.created_by = :userId and i.is_deleted = false and m.is_deleted = false
                      and m.meal_date between :from and :to
                union all
                select max(created_at) from workout_session
                    where created_by = :userId and is_deleted = false and date between :from and :to
                union all
                select max(created_at) from sport_session
                    where created_by = :userId and is_deleted = false and date between :from and :to
                union all
                select max(created_at) from run_session_log
                    where created_by = :userId and is_deleted = false and date between :from and :to
                union all
                select max(created_at) from habit_day
                    where created_by = :userId and is_deleted = false and habit_date between :from and :to
                union all
                select max(created_at) from activity_log
                    where created_by = :userId and is_deleted = false and occurred_on between :from and :to
                union all
                select max(created_at) from daily_quest
                    where created_by = :userId and is_deleted = false and quest_date between :from and :to
            ) t
            """, nativeQuery = true)
    Instant latestScoreInputWrittenAt(
            @Param("userId") UUID userId, @Param("from") LocalDate from, @Param("to") LocalDate to);
}
