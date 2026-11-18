package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * The lazy weekly trigger {@code WorkoutService.getToday} calls once the active run is resolved.
 * Since volume engine v2 it only hands over to {@link WeekProposalService#generateIfDue}, which
 * decides, records and (in {@code auto} mode) applies the week's per-exercise set changes and
 * advances the run's {@code currentWeek} and {@code volume_recompute} audit — once per calendar
 * week, so it is safe to call on every request. Kept as a seam so {@code getToday} is untouched.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VolumeProgressionService {

    private final WeekProposalService weekProposalService;

    /**
     * Mutates {@code meso} in place ({@code currentWeek}, {@code volumeRecompute}) when a new week is due.
     * A failure in the weekly engine is logged and swallowed: the morning workout must never depend
     * on it (nothing is stamped, so the next open simply tries again; today is served from the
     * unchanged amounts).
     */
    public void rolloverIfDue(UUID createdBy, MesocycleEntity meso) {
        try {
            weekProposalService.generateIfDue(createdBy, meso);
        } catch (RuntimeException e) {
            log.error("weekly proposal failed for run {}", meso.getId(), e);
        }
    }
}
