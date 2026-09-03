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
     * a MAX over eleven unrelated aggregates in nine features; neither a derived method nor JPQL
     * can span them, and the alternative — eleven separate {@code findFirst…OrderByCreatedAtDesc}
     * calls, the {@code WeeklyReviewService.isStale} idiom — costs eleven round trips per probed
     * week, which an 8-week trend read pays 88 times.
     *
     * <p><b>What is in.</b> Every LOG a {@code DayEvaluationEngine} dimension is derived from
     * (mezo-jcpt.4, the six-dimension engine that replaced the four legacy subscores):
     * <ul>
     *   <li>nutrition + quality — {@code meal} and {@code meal_item} (editing a meal's lines moves
     *       the day's macros AND its NOVA/micro aggregate, so both tables are probed);</li>
     *   <li>training — {@code workout_session}, {@code sport_session}, {@code run_session_log};</li>
     *   <li>sleep — {@code sleep_log};</li>
     *   <li>logging — {@code meal} (timeliness), {@code water_log} and {@code check_in};</li>
     *   <li>rhythm — nothing of its own: it averages the prior days' base scores, so it moves only
     *       when one of the tables above moves.</li>
     * </ul>
     * {@code habit_day}, {@code activity_log} and {@code daily_quest} are kept although no
     * dimension reads XP any more: the week response still renders {@code xp} per day, and dropping
     * them would let a week's rendered XP go stale behind a cached score.
     *
     * <p><b>What is out, and the limitations.</b>
     * <ul>
     *   <li>{@code weight_log} — displayed by the week, feeds NO dimension; a weigh-in must not
     *       invalidate a score.</li>
     *   <li><b>Training SCHEDULE tables</b> ({@code gym_schedule_slot}, {@code sport_schedule_slot},
     *       {@code sport_event}, {@code running_block} and the prescribed run sessions under it),
     *       which {@code WorkoutWindowQueryService.windowsFor} reads for the training dimension's
     *       planned/done split. This is deliberately a LOG-write probe: those are configuration
     *       tables with different write semantics (they are edited in place, they are not dated
     *       into the probed window, and one edit retroactively re-plans every past week). So
     *       <b>a schedule edit does not invalidate a cached week</b> — the week's training
     *       dimension keeps the plan that was in force when it was computed until something else
     *       in the window is logged.</li>
     *   <li>The probe reads {@code created_at}, so an EDIT of an existing row (rather than a new
     *       row) is not detected — inherited from {@code WeeklyReviewService.isStale}. The
     *       {@code computedAt} the API returns is what keeps that case honest.</li>
     * </ul>
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
                select max(created_at) from water_log
                    where created_by = :userId and is_deleted = false and log_date between :from and :to
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
