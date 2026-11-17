package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.VolumeProgressionGate;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.ProvenanceEnvelope;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import jakarta.persistence.EntityManager;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The weekly volume log is DERIVED (volume engine v2, spec §6.1): one row per coarse muscle
 * group the active run's template days train with counting exercises, {@code currentSets} = the
 * sum of the plan's {@code working_sets}, plus the group's landmarks and tier band. Recomputed
 * after every write that can change it. A planned run (or the switch off) has no rows.
 */
@Service
@RequiredArgsConstructor
public class VolumeLedger {

    private final MesocycleRepository mesocycleRepository;
    private final MuscleGroupVolumeLogRepository volumeLogRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final VolumeProperties props;
    private final ObjectProvider<VolumeProgressionGate> volumeGate;
    private final EntityManager entityManager;

    /** Idempotent. Gate off or run not active: touches nothing. */
    @Transactional
    public void sync(UUID createdBy, UUID mesocycleId) {
        if (mesocycleId == null || volumeGate.getIfAvailable() == null) {
            return;
        }
        MesocycleEntity meso = mesocycleRepository.findById(mesocycleId)
            .filter(m -> createdBy.equals(m.getCreatedBy()))
            .orElse(null);
        if (meso == null || !"active".equals(meso.getStatus())) {
            return;
        }
        if (meso.getVolumeModel() < 2) {
            return; // the old targets in the ledger are the migration's input — never overwrite them
        }
        Map<String, Integer> setsByGroup = planSetsByGroup(createdBy, mesocycleId);
        Map<String, MuscleGroupVolumeLogEntity> existing = new TreeMap<>();
        volumeLogRepository.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(createdBy, List.of(mesocycleId))
            .forEach(r -> existing.put(r.getMuscle(), r));

        List<MuscleGroupVolumeLogEntity> toSave = new ArrayList<>();
        setsByGroup.forEach((group, sets) -> {
            VolumeProperties.Baseline b = props.baselines().get(group);
            VolumeBands.Band band = VolumeBands.band(b, PriorityTier.of(meso.getMusclePriorities(), group), props.bands());
            MuscleGroupVolumeLogEntity row = existing.remove(group);
            if (row == null) {
                row = new MuscleGroupVolumeLogEntity();
                row.setCreatedBy(createdBy);
                row.setMesocycleId(mesocycleId);
                row.setMuscle(group);
                // confidence is contract-required on VolumeSource; 0.5 = derived, not personalized.
                row.setSource(new ProvenanceEnvelope(
                    new ProvenanceEnvelope.Baseline("A terv szerint", b.mev(), b.mav(), b.mrv()),
                    List.of(), 0.5,
                    "A heti sorozatszám a terv gyakorlataiból adódik össze.", null));
            } else {
                ProvenanceEnvelope old = row.getSource();
                row.setSource(new ProvenanceEnvelope(
                    new ProvenanceEnvelope.Baseline(
                        old != null && old.baseline() != null ? old.baseline().name() : "A terv szerint",
                        b.mev(), b.mav(), b.mrv()),
                    old != null && old.adjustments() != null ? old.adjustments() : List.of(),
                    old != null ? old.confidence() : Double.valueOf(0.5),
                    old != null ? old.note() : null,
                    old != null ? old.userOverride() : null));
            }
            row.setMev(b.mev());
            row.setMav(b.mav());
            row.setMrv(b.mrv());
            row.setBandLow(band.low());
            row.setBandHigh(band.high());
            row.setCurrentSets(sets);
            toSave.add(row);
        });
        if (!existing.isEmpty()) {
            // Physical delete: a soft-deleted tombstone would collide with the (mesocycle, muscle)
            // unique constraint when the group is trained again. Done BEFORE the upserts below.
            // Only the deleted rows leave the persistence context (detached first, so no pending
            // state of theirs is flushed and no stale managed copy outlives the DELETE); the
            // caller's other managed entities stay managed — the query never clears.
            List<UUID> gone = existing.values().stream().map(MuscleGroupVolumeLogEntity::getId).toList();
            existing.values().forEach(entityManager::detach);
            volumeLogRepository.hardDeleteByIds(gone);
        }
        if (!toSave.isEmpty()) {
            volumeLogRepository.saveAll(toSave);
        }
    }

    /** Σ working_sets per coarse group over the run's template days; exempt exercises and groups
     *  without a landmark entry (core, traps) never appear. */
    private Map<String, Integer> planSetsByGroup(UUID createdBy, UUID mesocycleId) {
        List<UUID> templateIds = MesoTemplateDays.ids(workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(mesocycleId)));
        Map<String, Integer> sets = new TreeMap<>();
        if (templateIds.isEmpty()) {
            return sets;
        }
        for (ExerciseEntity e : exerciseRepository
                .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, templateIds)) {
            if (!e.isCountsTowardVolume()) {
                continue;
            }
            String group = MuscleGroup.of(e.getMuscle());
            if (props.baselines().containsKey(group)) {
                sets.merge(group, e.getWorkingSets(), Integer::sum);
            }
        }
        return sets;
    }
}
