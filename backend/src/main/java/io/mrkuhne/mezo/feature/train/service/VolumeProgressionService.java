package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.ProvenanceEnvelope;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.SortedSet;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;
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

    private static final String TRIGGER_LABEL = "weekly-rollover";
    private static final String PHASE_DELOAD = "Deload";

    private final MesocycleRepository mesocycleRepository;
    private final MuscleGroupVolumeLogRepository volumeLogRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final ExerciseRepository exerciseRepository;
    private final VolumeProperties props;

    /** Per-muscle-group signals derived from last completed week's logged working sets. */
    private record WeeklySignals(Map<String, Integer> loggedLastWeek, Map<String, Boolean> grind) {}

    /**
     * Baseline seeding on the create/activate path (mezo-xlmp): one volume-log row per coarse
     * {@link MuscleGroup} the meso's TEMPLATE days actually train, from the fixed
     * {@code mezo.volume.baselines} RP table, {@code currentSets = } the tier's week-1 start
     * (EMPHASIZE MEV+2, else MEV) — {@link #rolloverIfDue}'s first run stamps the START audit on
     * top. Idempotent: an existing row's group is skipped untouched, so activate doubles as a
     * backfill for pre-seed mesos; a group with no baselines entry is never fabricated (DA5).
     */
    @Transactional
    public void seedBaselines(UUID createdBy, UUID mesoId, Map<String, String> priorities) {
        List<UUID> templateIds = MesoTemplateDays.ids(workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(mesoId)));
        if (templateIds.isEmpty()) {
            return;
        }
        SortedSet<String> trained = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, templateIds).stream()
            .filter(ExerciseEntity::isCountsTowardVolume) // mezo-gbo7: no target without volume work
            .map(e -> MuscleGroup.of(e.getMuscle()))
            .collect(Collectors.toCollection(TreeSet::new));
        Set<String> existing = volumeLogRepository
            .findByCreatedByAndMesocycleIdInOrderByMuscleAsc(createdBy, List.of(mesoId)).stream()
            .map(MuscleGroupVolumeLogEntity::getMuscle)
            .collect(Collectors.toSet());

        List<MuscleGroupVolumeLogEntity> fresh = new ArrayList<>();
        for (String group : trained) {
            VolumeProperties.Baseline b = props.baselines().get(group);
            if (b == null || existing.contains(group)) {
                continue;
            }
            MuscleGroupVolumeLogEntity row = new MuscleGroupVolumeLogEntity();
            row.setCreatedBy(createdBy);
            row.setMesocycleId(mesoId);
            row.setMuscle(group);
            row.setMev(b.mev());
            row.setMav(b.mav());
            row.setMrv(b.mrv());
            row.setCurrentSets(PriorityTier.of(priorities, group).weekOneStart(b.mev(), b.mav(), b.mrv()));
            // confidence is contract-required on VolumeSource; 0.5 = generic table, not personalized.
            row.setSource(new ProvenanceEnvelope(
                new ProvenanceEnvelope.Baseline("RP guidelines · intermediate", b.mev(), b.mav(), b.mrv()),
                List.of(), 0.5,
                "RP irányelv baseline — a mesociklus aktiválásakor seedelve, személyre szabás nélkül.",
                null));
            fresh.add(row);
        }
        if (!fresh.isEmpty()) {
            volumeLogRepository.saveAll(fresh);
        }
    }

    @Transactional
    public void rolloverIfDue(UUID createdBy, MesocycleEntity meso) {
        int calWeek = MesoWeeks.clampWeek(meso.getStartDate(), meso.getWeeks());
        int lastRunWeek = parseLastRunWeek(meso.getVolumeRecompute());
        if (calWeek <= lastRunWeek) {
            return; // already recomputed for this calendar week — idempotent (DA3).
        }

        List<MuscleGroupVolumeLogEntity> logs = volumeLogRepository
            .findByCreatedByAndMesocycleIdInOrderByMuscleAsc(createdBy, List.of(meso.getId()));
        WeeklySignals signals = lastWeekSignals(createdBy, meso.getStartDate(), calWeek);
        boolean deloadPhase = isDeloadPhase(meso, calWeek);

        List<VolumeRecomputeJson.Change> changes = new ArrayList<>();
        for (MuscleGroupVolumeLogEntity row : logs) {
            String muscle = row.getMuscle();
            PriorityTier tier = PriorityTier.of(meso.getMusclePriorities(), muscle);
            VolumeDecider.Result result = VolumeDecider.decide(new VolumeDecider.Input(
                calWeek, row.getCurrentSets(), row.getMev(), row.getMav(), row.getMrv(), deloadPhase,
                signals.loggedLastWeek().getOrDefault(muscle, 0),
                signals.grind().getOrDefault(muscle, false),
                props.step(), props.deloadFraction(),
                tier.ceiling(row.getMev(), row.getMav(), row.getMrv())));

            row.setCurrentSets(result.targetSets());
            row.setSource(withRolloverAdjustment(row.getSource(), calWeek, result));
            changes.add(new VolumeRecomputeJson.Change(
                muscle, result.change(), reasonFor(result.lever()), result.lever() == VolumeDecider.Lever.DELOAD));
        }
        volumeLogRepository.saveAll(logs);

        meso.setCurrentWeek(calWeek);
        meso.setVolumeRecompute(new VolumeRecomputeJson("W" + calWeek, "W" + (calWeek + 1), TRIGGER_LABEL, changes));
        mesocycleRepository.save(meso);
    }

    // ── last-completed-week signal gathering ────────────────────────────────────────────────────

    /**
     * {@code loggedLastWeek} (working-set count) + {@code grind} (any exercise's most-recent logged
     * working set landing {@code ≥ grindRirGap} RIR below its target) per {@link MuscleGroup}, over
     * the previous calendar week's COMPLETED instances. Week 1 has no prior week to read.
     */
    private WeeklySignals lastWeekSignals(UUID createdBy, LocalDate startDate, int calWeek) {
        Map<String, Integer> loggedLastWeek = new HashMap<>();
        Map<String, Boolean> grind = new HashMap<>();
        if (calWeek <= 1) {
            return new WeeklySignals(loggedLastWeek, grind);
        }

        MesoWeeks.Window prevWindow = MesoWeeks.weekWindow(startDate, calWeek - 1);
        List<WorkoutSessionEntity> instances = workoutSessionRepository
            .findDoneInstancesBetween(createdBy, prevWindow.from(), prevWindow.to());
        if (instances.isEmpty()) {
            return new WeeklySignals(loggedLastWeek, grind);
        }

        // Exercises hang off the INSTANCE's TEMPLATE day, never copied per instance (WorkoutService's
        // logSet/skipExercise chain-verify rule) — resolve via the distinct template ids, not the
        // instance ids, then key by exercise id (ExerciseSetEntity.exerciseId points at the template row).
        List<UUID> templateIds = instances.stream()
            .map(WorkoutSessionEntity::getTemplateSessionId).filter(Objects::nonNull).distinct().toList();
        Map<UUID, ExerciseEntity> exercisesById = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, templateIds).stream()
            .collect(Collectors.toMap(ExerciseEntity::getId, e -> e, (a, b) -> a));

        // Latest logged working-set RIR per exercise: instances are date-ascending and each
        // instance's sets createdAt-ascending, so the last write per exercise id wins (= "most
        // recent logged working set", DA4).
        Map<UUID, Integer> latestRirByExercise = new HashMap<>();
        for (WorkoutSessionEntity instance : instances) {
            List<ExerciseSetEntity> sets = exerciseSetRepository
                .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, instance.getId());
            for (ExerciseSetEntity s : sets) {
                if (!"working".equals(s.getKind()) || s.isSkipped() || s.getReps() == null) {
                    continue;
                }
                ExerciseEntity exercise = exercisesById.get(s.getExerciseId());
                if (exercise == null || !exercise.isCountsTowardVolume()) {
                    continue; // mezo-gbo7: posture/plyo sets are not hypertrophy volume
                }
                loggedLastWeek.merge(MuscleGroup.of(exercise.getMuscle()), 1, Integer::sum);
                if (s.getRir() != null) {
                    latestRirByExercise.put(s.getExerciseId(), s.getRir());
                }
            }
        }

        for (Map.Entry<UUID, Integer> entry : latestRirByExercise.entrySet()) {
            ExerciseEntity exercise = exercisesById.get(entry.getKey());
            if (exercise == null || exercise.getTargetRir() == null) {
                continue;
            }
            boolean isGrind = entry.getValue() <= exercise.getTargetRir() - props.grindRirGap();
            if (isGrind) {
                grind.put(MuscleGroup.of(exercise.getMuscle()), true);
            }
        }
        return new WeeklySignals(loggedLastWeek, grind);
    }

    /** DA1: {@code phaseCurve} is 1-based against a 1-based {@code calWeek} — index {@code calWeek-1}, bounds-checked. */
    private boolean isDeloadPhase(MesocycleEntity meso, int calWeek) {
        List<String> phaseCurve = meso.getPhaseCurve();
        int idx = calWeek - 1;
        if (phaseCurve == null || idx < 0 || idx >= phaseCurve.size()) {
            return false;
        }
        return PHASE_DELOAD.equalsIgnoreCase(phaseCurve.get(idx));
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

    /** Appends the weekly move to the log row's provenance; the MEV/MAV/MRV baseline is untouched. */
    private ProvenanceEnvelope withRolloverAdjustment(
            ProvenanceEnvelope source, int calWeek, VolumeDecider.Result result) {
        List<ProvenanceEnvelope.Adjustment> adjustments =
            new ArrayList<>(source.adjustments() != null ? source.adjustments() : List.of());
        // kind must stay within the api contract's VolumeAdjustment.kind enum
        // (^(pattern|recovery|niggle|sport-cross)$) — a weekly rollover is a pattern-driven move.
        adjustments.add(new ProvenanceEnvelope.Adjustment(
            "pattern", "W" + calWeek + ": " + result.change(), Map.of(),
            result.lever() == VolumeDecider.Lever.DELOAD ? Boolean.TRUE : null));
        return new ProvenanceEnvelope(
            source.baseline(), adjustments, source.confidence(), source.note(), source.userOverride());
    }

    private String reasonFor(VolumeDecider.Lever lever) {
        return switch (lever) {
            case START -> "kezdő hét (MEV)";
            case RAMP -> "cél teljesítve, nincs grind";
            case HOLD -> "tartás";
            case DELOAD -> "deload";
        };
    }
}
