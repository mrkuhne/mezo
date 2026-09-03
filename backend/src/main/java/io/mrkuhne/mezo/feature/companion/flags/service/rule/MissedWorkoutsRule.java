package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaise;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
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
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MissedWorkoutsRule implements FlagRule {

    private final GymScheduleSlotRepository gymScheduleSlotRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final FlagProperties properties;

    @Override
    public Optional<FlagRaise> evaluate(UUID userId, LocalDate today) {
        FlagProperties.MissedWorkouts cfg = properties.missedWorkouts();
        LocalDate from = today.minusDays(cfg.windowDays() - 1L);

        Set<Integer> plannedDows = gymScheduleSlotRepository
            .findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId).stream()
            .map(GymScheduleSlotEntity::getDayOfWeek)
            .collect(Collectors.toSet());
        if (plannedDows.isEmpty()) {
            return Optional.empty();
        }
        Set<LocalDate> trained =
            Set.copyOf(workoutSessionRepository.findDoneInstanceDates(userId, from, today));

        List<String> plannedDays = new ArrayList<>();
        List<String> missedDays = new ArrayList<>();
        int run = 0;
        int longestRun = 0;
        for (LocalDate day = from; !day.isAfter(today); day = day.plusDays(1)) {
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
            return Optional.empty();
        }
        return Optional.of(new FlagRaise(FlagKey.MISSED_WORKOUTS,
            FlagPayloadEnvelope.missedWorkouts(new FlagPayloadEnvelope.MissedWorkouts(
                cfg.windowDays(), cfg.minConsecutiveMissed(), longestRun,
                missedDays, plannedDays))));
    }
}
