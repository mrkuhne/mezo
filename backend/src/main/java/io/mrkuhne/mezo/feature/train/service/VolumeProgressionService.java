package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.ProvenanceEnvelope;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Weekly per-muscle volume-target rollover (spec §5.2-§5.3, DA3/DA4). Lazily triggered — the
 * intended caller is {@code getToday} right after the active mesocycle is resolved (Task A5) —
 * this method just does the recompute once the calendar week has advanced past the last one:
 *
 * <ol>
 *   <li>Bail out (no-op) if the mesocycle's {@code startDate}-anchored calendar week
 *       ({@link MesoWeeks#clampWeek}) has not advanced past {@code volumeRecompute.lastRun}
 *       (DA3 idempotency — safe to call every request).</li>
 *   <li>Otherwise read the last COMPLETED week's logged working sets, collapse each exercise's
 *       21-token zone to its coarse {@link MuscleGroup}, and derive per-group
 *       {@code loggedLastWeek} (count) + {@code grind} (any exercise finishing ≥ the configured
 *       RIR gap below its target — the recovery proxy, DA4).</li>
 *   <li>Run {@link VolumeDecider#decide} per volume-log row, ramping toward the muscle's {@link
 *       PriorityTier} ceiling ({@code musclePriorities}-driven: Emphasize -> MRV, Grow (default)
 *       -> MAV, Maintain -> MEV and never ramps — mezo-3m5m, spec GD4), deload-aware; persist the
 *       new {@code currentSets} + an appended provenance {@link ProvenanceEnvelope.Adjustment},
 *       and advance the mesocycle's {@code currentWeek} + {@code volumeRecompute} audit.</li>
 * </ol>
 *
 * <p>A muscle with no volume-log row is simply absent from the loop (DA5) — never fabricated.
 */
@Service
@RequiredArgsConstructor
public class VolumeProgressionService {


    private final MesocycleRepository mesocycleRepository;
    private final MuscleGroupVolumeLogRepository volumeLogRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final ExerciseRepository exerciseRepository;
    private final VolumeProperties props;

    @Transactional
    public void rolloverIfDue(UUID createdBy, MesocycleEntity meso) {
        int calWeek = MesoWeeks.clampWeek(meso.getStartDate(), meso.getWeeks());
        int lastRunWeek = parseLastRunWeek(meso.getVolumeRecompute());
        if (calWeek <= lastRunWeek) {
            return; // already recomputed for this calendar week — idempotent (DA3).
        }
        // volume-engine-v2 Task 8 replaces this with the weekly proposal
        meso.setCurrentWeek(calWeek);
        mesocycleRepository.save(meso);
    }

    /** {@code "W{n}"} → {@code n}; {@code null}/blank/unparsable ⇒ 0 (never recomputed yet). */
    private int parseLastRunWeek(VolumeRecomputeJson recompute) {
        if (recompute == null || recompute.lastRun() == null || recompute.lastRun().isBlank()) {
            return 0;
        }
        try {
            return Integer.parseInt(recompute.lastRun().replaceFirst("(?i)^W", ""));
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
