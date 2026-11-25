package io.mrkuhne.mezo.feature.season.port;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * What the season needs from the goal engine (consumer-owned port, ADR 0012 shape): the season's own goal
 * lifecycle, the read-only draft projection behind the live preview, the feasibility band and the block link.
 * Season-owned types only, so the season's services never touch a goal entity.
 */
public interface SeasonGoalPort {

    /** The goal fields a season decides (window = the season's, or start → target when a pace sets the length). */
    record GoalFields(String title, String trajectory, LocalDate startDate, LocalDate targetDate,
                      BigDecimal startWeightKg, BigDecimal targetWeightKg, List<String> guards) {
    }

    /**
     * @param balanceAdjustmentKcal accepted adaptive correction (kcal/day), or null
     * @param segmentOverrides      accepted per-week overrides as text (fingerprint input), or null
     */
    record GoalView(UUID id, String status, GoalFields fields, Integer balanceAdjustmentKcal, String segmentOverrides) {
    }

    /** One day type's served targets. */
    record DayTargets(int kcal, int proteinG, int carbsG) {
    }

    /** The draft's guard outcome: strength breach, muscles under their weekly band, the rate cap. */
    record GuardFlags(boolean strengthBreached, List<String> musclesBelow, Boolean rateWithinCap) {
    }

    /**
     * The served targets of a draft on a training day and on a rest day, from the segment covering the date, plus
     * the segment's weekly planning kcal and the guard flags. {@code trainSportDay} = a gym + sport day (null when the
     * draft has none); {@code weekKcal} = the seven weekdays' served targets summed, each with its own sessions.
     */
    record DraftTargets(DayTargets trainDay, DayTargets restDay, DayTargets trainSportDay, int weekKcal,
                        int segmentKcal, GuardFlags guards) {
    }

    /** The draft schedule's energy, priced by the train side at the rest energy the calculator derives. */
    interface DraftEnergy {
        /** Draft gym + sport weekly EAT, kcal/day. */
        BigDecimal weeklyEat(BigDecimal restKcalPerHour);

        /** The net kcal one planned training day credits (a gym session, or a sport session without gym). */
        int trainDayMovementKcal(BigDecimal restKcalPerHour);

        /** The net kcal each weekday (0 = hétfő … 6) credits: every session of that day. Seven values. */
        List<Integer> weekdayMovementKcal(BigDecimal restKcalPerHour);

        /** The net kcal a gym + sport day credits; null when the draft has no such day. */
        Integer trainSportDayMovementKcal(BigDecimal restKcalPerHour);
    }

    /** {@code verdict}: feasible | warnings | aggressive. */
    record Feasibility(String verdict, BigDecimal ratePctPerWeek) {
    }

    UUID createGoal(UUID owner, GoalFields fields);

    /** Rewrites the season-owned fields; keeps the goal's own extras (identity frame, day-planner times). */
    void updateGoal(UUID owner, UUID goalId, GoalFields fields);

    /** Activates the goal (archives every other active goal, evaluates it). */
    void activate(UUID owner, UUID goalId);

    void archive(UUID owner, UUID goalId);

    Optional<GoalView> goal(UUID owner, UUID goalId);

    /** His live ({@code is_deleted = false}) active goal. */
    Optional<GoalView> liveActive(UUID owner);

    /**
     * Read-only projection of a draft goal over a draft schedule for {@code on}'s goal-week (week 1 before the
     * start). {@code existingGoalId} (nullable) lends the stored goal's links, overrides and accepted adjustments.
     * Empty when he has no body profile or no segment covers the date. Persists nothing.
     */
    Optional<DraftTargets> previewTargets(UUID owner, UUID existingGoalId, GoalFields draft, DraftEnergy energy,
                                          LocalDate on);

    Feasibility feasibility(GoalFields fields);

    /** Mesocycle ids linked to the goal (goal_plan_link), oldest start week first. */
    List<UUID> linkedMesocycles(UUID owner, UUID goalId);

    /**
     * Links the mesocycle to the goal from the week it starts in (week 1 when it started earlier); idempotent. It takes
     * over the weeks it runs in: an overlapping earlier link ends the week before, a same-week or later one is removed.
     */
    void link(UUID owner, UUID goalId, UUID mesocycleId, LocalDate mesocycleStart);

    /** The planned (formula) and the learned daily expenditure, kcal; {@code learned} is what the engine now serves. */
    record Expenditure(int plannedKcal, int learnedKcal) {
    }

    /**
     * The goal's expenditure when the engine serves a LEARNED base ({@code LearnedBaseResolver}); empty while it still
     * serves the formula (before learning, switch off, or no evaluated goal).
     */
    Optional<Expenditure> learnedExpenditure(UUID owner, UUID goalId);
}
