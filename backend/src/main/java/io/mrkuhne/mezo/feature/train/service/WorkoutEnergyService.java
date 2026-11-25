package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.WorkoutEnergy;
import io.mrkuhne.mezo.feature.train.config.TrainProperties;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

/**
 * The kcal shown when a workout ends (mezo-r36n9.170, owner 2026-11-25: „becslés, utána óra"). The
 * watch's own figure wins when a Health strength workout matches the session; otherwise the
 * server's net estimate — the very gym model and minutes rule the day's food budget uses
 * ({@link WorkoutWindowQueryService#gymMinutes(WorkoutSessionEntity, int)}), so the two never
 * disagree about one session. Only a completed session has an energy.
 */
@Service
@RequiredArgsConstructor
public class WorkoutEnergyService {

    private final ActivityEnergyModel activityEnergyModel;
    private final AthleteBodyPort athleteBodyPort;
    private final ObjectProvider<WatchWorkoutEnergyPort> watch;
    private final TrainProperties props;

    public Optional<WorkoutEnergy> energyOf(UUID userId, WorkoutSessionEntity instance) {
        if (!"completed".equals(instance.getStatus())) {
            return Optional.empty();
        }
        WatchWorkoutEnergyPort port = watch.getIfAvailable();
        if (port != null) {
            Optional<Integer> measured = port.watchKcal(userId, instance.getDate(), LoggedSessionReadPort.gym(instance))
                .filter(k -> k > 0);
            if (measured.isPresent()) {
                return Optional.of(new WorkoutEnergy(measured.get(), WorkoutEnergy.SourceEnum.WATCH));
            }
        }
        BigDecimal restKcalPerHour = athleteBodyPort.bodyAt(userId, instance.getDate())
            .flatMap(b -> ActivityEnergyModel.restKcalPerHour(b.bmrKcal(), b.weightKg()))
            .orElse(null);
        return activityEnergyModel
            .netKcal("gym", null, WorkoutWindowQueryService.gymMinutes(instance, props.gymDefaultMinutes()),
                restKcalPerHour)
            .filter(k -> k > 0)
            .map(k -> new WorkoutEnergy(k, WorkoutEnergy.SourceEnum.ESTIMATE));
    }
}
