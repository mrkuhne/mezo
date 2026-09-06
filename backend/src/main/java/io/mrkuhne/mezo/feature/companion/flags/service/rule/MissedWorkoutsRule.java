package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Consecutive PLANNED gym days with nothing completed (spec 2026-09-03 §4 row 3) — so the
 * morning prompt stops cheering blindly at someone who has not trained since Friday.
 *
 * <p>"Consecutive" is in the sequence of PLANNED days, not calendar days: a Mon/Wed/Fri
 * schedule raises on a missed Mon + Wed. Only completed INSTANCES count as training —
 * {@code findDoneInstanceDates} filters {@code templateSessionId IS NOT NULL AND
 * status = 'completed'}, which is what keeps nullable-dated template rows and half-finished
 * sessions out.
 *
 * <p>The window ends YESTERDAY, not today: today is still in progress, and a Friday-evening
 * gym session is not "missing" at the 00:05 sweep just because it has not happened yet
 * (same reasoning as {@link MomentumAtRiskRule}'s windows — review fix, whole-branch review,
 * bd mezo-d58h.2).
 *
 * <p>The window is also clamped to the earliest {@code gym_schedule_slot.created_at}: a day
 * before the current schedule existed cannot be a violation of that schedule, so a user who
 * just created (or just changed) their Mon/Wed/Fri plan does not immediately inherit missed
 * days from before it existed (review fix, bd mezo-d58h.2).
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MissedWorkoutsRule implements FlagRule {

    private final GymScheduleSlotRepository gymScheduleSlotRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final FlagProperties properties;

    @Override
    public FlagVerdict evaluate(UUID userId, LocalDate today) {
        FlagProperties.MissedWorkouts cfg = properties.missedWorkouts();
        LocalDate to = today.minusDays(1);
        LocalDate from = to.minusDays(cfg.windowDays() - 1L);

        List<GymScheduleSlotEntity> slots =
            gymScheduleSlotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId);
        if (slots.isEmpty()) {
            return FlagVerdict.unavailable(FlagKey.MISSED_WORKOUTS, UnavailableReason.NO_GYM_SCHEDULE);
        }
        Set<Integer> plannedDows =
            slots.stream().map(GymScheduleSlotEntity::getDayOfWeek).collect(Collectors.toSet());

        // A day before the schedule existed cannot be a violation of it — clamp the scan to
        // start no earlier than the oldest surviving slot's creation date.
        LocalDate earliestSlotDate = slots.stream()
            .map(s -> s.getCreatedAt().atZone(ZoneId.systemDefault()).toLocalDate())
            .min(Comparator.naturalOrder())
            .orElse(from);
        if (from.isBefore(earliestSlotDate)) {
            from = earliestSlotDate;
        }
        if (from.isAfter(to)) {
            return FlagVerdict.unavailable(FlagKey.MISSED_WORKOUTS,
                UnavailableReason.SCHEDULE_YOUNGER_THAN_WINDOW);
        }

        Set<LocalDate> trained =
            Set.copyOf(workoutSessionRepository.findDoneInstanceDates(userId, from, to));

        List<String> plannedDays = new ArrayList<>();
        List<String> missedDays = new ArrayList<>();
        int run = 0;
        int longestRun = 0;
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            // gym_schedule_slot.day_of_week is 0=Monday..6=Sunday (the entity's own comment)
            int dow = day.getDayOfWeek().getValue() - 1;
            if (!plannedDows.contains(dow)) {
                continue;
            }
            plannedDays.add(day.toString());
            if (trained.contains(day)) {
                run = 0;
                continue;
            }
            missedDays.add(day.toString());
            run++;
            longestRun = Math.max(longestRun, run);
        }
        if (longestRun < cfg.minConsecutiveMissed()) {
            return FlagVerdict.clear(FlagKey.MISSED_WORKOUTS, new FlagVerdict.ClearEvidence(
                "longest_missed_run", (double) longestRun, (double) cfg.minConsecutiveMissed(),
                null));
        }
        return FlagVerdict.raised(FlagKey.MISSED_WORKOUTS,
            FlagPayloadEnvelope.missedWorkouts(new FlagPayloadEnvelope.MissedWorkouts(
                cfg.windowDays(), cfg.minConsecutiveMissed(), longestRun,
                missedDays, plannedDays)));
    }
}
