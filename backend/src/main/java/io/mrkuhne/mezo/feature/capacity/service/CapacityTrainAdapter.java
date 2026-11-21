package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.port.CapacityTrainPort;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.service.RecoveryPeriodService;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
}
