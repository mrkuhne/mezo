package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.port.TrainDayAdjustmentPort;
import io.mrkuhne.mezo.feature.train.port.TrainDayAdjustmentPort.EffectiveSession;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutDayAdjustmentRepository;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * The plan of a day as the owner will actually live it (Boop B7 K3, mezo-r36n9.17): the planned gym session with the
 * capacity ledger's accepted move / time shift / shorten / lighten applied, and the effective planned gym days. The
 * ONE place the read-only prose and flag readers (the brief, the chat context, the missed-workout flags, the hydration
 * probe) take these from, so they cannot drift apart. Pure reads — never {@link WorkoutService#getToday}.
 */
@Service
@RequiredArgsConstructor
public class EffectivePlanService {

    private final WorkoutService workoutService;
    private final ExerciseRepository exercises;
    private final GymScheduleSlotRepository gymSlots;
    private final WorkoutDayAdjustmentRepository dayAdjustments;
    private final TrainDayAdjustmentPort ledger;

    /**
     * One day's planned gym session, effective.
     *
     * @param plannedTime the earliest gym slot time of the session's plan day (a moved session keeps its own)
     * @param ledgerTime  the ledger's accepted start time, or null
     * @param minutes     the ledger's shortened minutes, else the template's estimate
     * @param label       the session's day label for prose: the template's, or the date's own weekday label when the
     *                    ledger moved the session onto it (a Monday session done on Wednesday reads "Sze")
     */
    public record PlannedSession(WorkoutSessionEntity template, String label, List<ExerciseEntity> exercises,
                                 LocalTime plannedTime,
                                 LocalTime ledgerTime, Integer minutes, int setDelta, EffectiveSession adjustment) {

        /** Working sets of one exercise: the legacy per-date delta (floor 1), then the ledger's lighten. */
        public int sets(ExerciseEntity e) {
            int sets = Math.max(1, (e.getWorkingSets() == null ? 0 : e.getWorkingSets()) + setDelta);
            return adjustment == null ? sets : adjustment.lightened(sets);
        }

        /** The start time: the ledger's shift wins over an older one-day override, which wins over the plan. */
        public LocalTime time(Optional<LocalTime> legacyOverride) {
            return ledgerTime != null ? ledgerTime : legacyOverride.orElse(plannedTime);
        }
    }

    /**
     * The day's planned gym session (a gym skip honoured); empty on a rest day — no template, or an empty template
     * day (ToolText.gymLine's criterion).
     */
    public Optional<PlannedSession> plannedSession(UUID owner, LocalDate date) {
        Optional<WorkoutSessionEntity> template = workoutService.findPlannedTemplateForDateUnlessSkipped(owner, date);
        if (template.isEmpty()) {
            return Optional.empty();
        }
        List<ExerciseEntity> planned = exercises.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(
            owner, List.of(template.get().getId()));
        if (planned.isEmpty()) {
            return Optional.empty();
        }
        EffectiveSession adjustment = ledger.effectiveSession(owner, date).orElse(null);
        int delta = dayAdjustments.findByCreatedByAndDateAndDeletedFalse(owner, date)
            .map(a -> (int) a.getSetDelta()).orElse(0);
        LocalDate planDay = adjustment != null && adjustment.movedIn() ? adjustment.movedInFrom() : date;
        int dow = planDay.getDayOfWeek().getValue() - 1; // 0=Hét..6=Vas (schedule-slot convention)
        LocalTime plannedTime = gymSlots.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(owner).stream()
            .filter(s -> s.getDayOfWeek() != null && s.getDayOfWeek() == dow && s.getTime() != null)
            .map(s -> LocalTime.parse(s.getTime()))
            .sorted()
            .findFirst().orElse(null);
        Integer minutes = adjustment != null && adjustment.minutes() != null ? adjustment.minutes()
            : template.get().getDurationEst();
        String label = adjustment != null && adjustment.movedIn()
            ? WorkoutService.HU_DAY_LABELS.get(date.getDayOfWeek().getValue() - 1) : template.get().getDayLabel();
        return Optional.of(new PlannedSession(template.get(), label, planned, plannedTime,
            adjustment == null ? null : adjustment.time(), minutes, delta, adjustment));
    }

    /**
     * The dates of {@code from..to} with a planned gym session by the weekly gym slots, with the ledger's moves
     * applied: a moved-away day drops out, a moved-in day joins when its plan day's weekday has a slot. (Skips are the
     * caller's business.) {@code gymWeekdays} (0 = Monday) are the weekly gym slots' weekdays, {@code ledger} the
     * range's {@link TrainDayAdjustmentPort#effectiveSessions}.
     */
    public static Set<LocalDate> plannedGymDates(Set<Integer> gymWeekdays, Map<LocalDate, EffectiveSession> ledger,
            LocalDate from, LocalDate to) {
        Set<LocalDate> out = new HashSet<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            EffectiveSession m = ledger.get(d);
            boolean planned;
            if (m != null && m.movedIn()) {
                planned = gymWeekdays.contains(m.movedInFrom().getDayOfWeek().getValue() - 1);
            } else if (m != null && m.movedAway()) {
                planned = false;
            } else {
                planned = gymWeekdays.contains(d.getDayOfWeek().getValue() - 1);
            }
            if (planned) {
                out.add(d);
            }
        }
        return out;
    }
}
