package io.mrkuhne.mezo.feature.train.signal;

import io.mrkuhne.mezo.feature.progression.TrainingCommitmentSource;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Training side of the discipline trait — see {@link TrainingCommitmentSource}. */
@Component
@RequiredArgsConstructor
public class TrainingCommitmentCalculator implements TrainingCommitmentSource {

    private final MesocycleRepository mesocycleRepository;
    private final WorkoutSessionRepository workoutSessionRepository;

    @Override
    public Stats commitmentStats(UUID createdBy, LocalDate from, LocalDate to) {
        MesocycleEntity activeMeso = mesocycleRepository
            .findByCreatedByAndStatusAndDeletedFalse(createdBy, "active")
            .stream().findFirst().orElse(null);
        if (activeMeso == null) {
            return new Stats(0, 0);
        }
        Set<String> plannedLabels = new HashSet<>();
        workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(activeMeso.getId()))
            .stream()
            .filter(s -> s.getTemplateSessionId() == null)
            .forEach(s -> plannedLabels.add(s.getDayLabel()));
        int planned = 0;
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            if (plannedLabels.contains(WorkoutService.HU_DAY_LABELS.get(d.getDayOfWeek().getValue() - 1))) {
                planned++;
            }
        }
        int done = (int) workoutSessionRepository.findDoneInstanceDates(createdBy, from, to)
            .stream().distinct().count();
        return new Stats(planned, done);
    }
}
