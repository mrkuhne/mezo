package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.port.CapacityTrainPort;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.RecoveryPeriodService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * {@link CapacityTrainPort} over the train windows: the same planned/done resolution Étel's pre/post-workout meals
 * use, which already drops skipped gym, sport and run occurrences (planned_skip, sport_slot_skip, recovery).
 */
@Component
@RequiredArgsConstructor
public class CapacityTrainAdapter implements CapacityTrainPort {

    private final WorkoutWindowQueryService windows;
    private final RecoveryPeriodService recovery;
    private final GymScheduleSlotRepository gymSlots;
    private final SportScheduleSlotRepository sportSlots;
    private final MesocycleRepository mesocycles;
    private final WorkoutSessionRepository workoutSessions;
    private final ExerciseRepository exercises;

    @Override
    public Map<LocalDate, List<Session>> sessions(UUID owner, LocalDate from, LocalDate to) {
        Map<LocalDate, List<Session>> out = new LinkedHashMap<>();
        windows.windowsFor(owner, from, to).forEach((date, list) -> {
            List<Session> sessions = new ArrayList<>();
            for (WorkoutWindowQueryService.Window w : list) {
                long minutes = Duration.between(w.start(), w.end()).toMinutes();
                if (minutes <= 0) {
                    minutes += 24 * 60; // a session running past midnight
                }
                sessions.add(new Session(date, w.start(), (int) minutes, w.kind(), w.done(), w.label()));
            }
            if (!sessions.isEmpty()) {
                out.put(date, sessions);
            }
        });
        return out;
    }

    @Override
    public Set<LocalDate> recoveryDays(UUID owner, LocalDate from, LocalDate to) {
        return recovery.fuelDays(owner, from, to).keySet();
    }

    @Override
    public SlotCounts weeklySlots(UUID owner) {
        return new SlotCounts(gymSlots.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(owner).size(),
            sportSlots.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(owner).size());
    }

    @Override
    public int plannedGymKcal(UUID owner, LocalDate date, int minutes) {
        return windows.plannedGymKcal(owner, date, minutes);
    }

    @Override
    public boolean gymPlanned(UUID owner, LocalDate date) {
        int dow = date.getDayOfWeek().getValue() - 1; // 0 = Monday, the gym_schedule_slot convention
        return gymSlots.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(owner).stream()
            .anyMatch(s -> s.getDayOfWeek() == dow)
            || plannedTemplate(owner, date).isPresent();
    }

    @Override
    public boolean gymDoneOn(UUID owner, LocalDate date) {
        return !workoutSessions.findDoneInstancesBetween(owner, date, date).isEmpty();
    }

    /**
     * The raw label match of {@code WorkoutService#findPlannedTemplateForDate}, read from the repositories so a
     * ledger-aware train read can never leak back into the ledger's own checks — with the rest-day rule of
     * {@code EffectivePlanService.plannedSession} / {@code ToolText.gymLine}: a template day with no exercises is a
     * rest day, not a session (K3 final review: production keeps empty Saturday/Sunday templates, and counting them
     * made every day a gym day, so no move was ever possible).
     */
    @Override
    public Optional<UUID> plannedTemplate(UUID owner, LocalDate date) {
        String label = WorkoutService.HU_DAY_LABELS.get(date.getDayOfWeek().getValue() - 1);
        return mesocycles.findByCreatedByAndStatusAndDeletedFalse(owner, "active").stream().findFirst()
            .flatMap(meso -> workoutSessions
                .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(owner, List.of(meso.getId())).stream()
                .filter(s -> s.getTemplateSessionId() == null && label.equals(s.getDayLabel()))
                .findFirst())
            .filter(s -> !exercises.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(owner, List.of(s.getId()))
                .isEmpty())
            .map(WorkoutSessionEntity::getId);
    }

    @Override
    public boolean ownsTemplate(UUID owner, UUID templateSessionId) {
        return workoutSessions.findById(templateSessionId)
            .filter(s -> owner.equals(s.getCreatedBy()) && !s.isDeleted() && s.getTemplateSessionId() == null)
            .isPresent();
    }

    @Override
    public boolean workoutRunning(UUID owner, UUID templateSessionId) {
        return workoutSessions.existsByCreatedByAndTemplateSessionIdAndStatus(owner, templateSessionId, "active");
    }

    @Override
    public boolean templateInBlock(UUID owner, UUID templateSessionId, UUID mesocycleId) {
        return workoutSessions.findById(templateSessionId)
            .filter(s -> owner.equals(s.getCreatedBy()) && !s.isDeleted() && s.getTemplateSessionId() == null)
            .filter(s -> mesocycleId.equals(s.getMesocycleId()))
            .isPresent();
    }

    @Override
    public boolean templateInActiveBlock(UUID owner, UUID templateSessionId) {
        return mesocycles.findByCreatedByAndStatusAndDeletedFalse(owner, "active").stream().findFirst()
            .map(meso -> templateInBlock(owner, templateSessionId, meso.getId()))
            .orElse(false);
    }

    @Override
    public List<LocalDate> deloadMondays(UUID owner) {
        return mesocycles.findByCreatedByAndStatusAndDeletedFalse(owner, "active").stream().findFirst()
            .filter(meso -> meso.getStartDate() != null && meso.getPhaseCurve() != null)
            .map(meso -> {
                LocalDate first = meso.getStartDate().with(
                    java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
                List<LocalDate> out = new ArrayList<>();
                List<String> curve = meso.getPhaseCurve();
                for (int i = 0; i < curve.size(); i++) {
                    if ("Deload".equalsIgnoreCase(curve.get(i))) {
                        out.add(first.plusWeeks(i));
                    }
                }
                return List.copyOf(out);
            })
            .orElse(List.of());
    }
}
