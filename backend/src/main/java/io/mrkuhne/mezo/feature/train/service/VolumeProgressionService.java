package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * The lazy weekly trigger {@code WorkoutService.getToday} calls once the active run is resolved.
 * Since volume engine v2 it only hands over to {@link WeekProposalService#generateIfDue}, which
 * decides, records and (in {@code auto} mode) applies the week's per-exercise set changes and
 * advances the run's {@code currentWeek} and {@code volume_recompute} audit — once per calendar
 * week, so it is safe to call on every request. Kept as a seam so {@code getToday} is untouched.
 */
@Service
@RequiredArgsConstructor
public class VolumeProgressionService {

    private final WeekProposalService weekProposalService;

    /** Mutates {@code meso} in place ({@code currentWeek}, {@code volumeRecompute}) when a new week is due. */
    public void rolloverIfDue(UUID createdBy, MesocycleEntity meso) {
        weekProposalService.generateIfDue(createdBy, meso);
    }
}
