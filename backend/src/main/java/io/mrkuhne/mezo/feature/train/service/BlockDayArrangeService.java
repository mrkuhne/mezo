package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.feature.train.config.TrainTechniqueProperties;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.mapper.TrainMapper;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Moves a running block's template days onto new gym weekdays (mezo-r36n9.122, Évad spec §5.12-1): the season's
 * one accept re-arranges the block together with the weekly slots, so the kcal and the block never disagree on the
 * number of sessions. {@link #plan} is the preview (no write); {@link #apply} writes the same plan.
 *
 * <p>Which day is repeated or dropped is {@link BlockDayArrangement}'s choice under the plan evaluator's verdict on
 * the laid-out week (muscles outside their band first, then heavy back-to-back days, then the total distance from
 * the bands) — the Blokk builder's own evaluator. A moved day keeps its row and its history (only its weekday label
 * and place change); an added day is a copy written through the day editor's own save
 * ({@link TrainService#replaceDayExercises}); a dropped day is soft-deleted with its exercises, and refused while
 * its workout runs (409 {@code TRAIN_DAY_WORKOUT_RUNNING}).
 */
@Service
@RequiredArgsConstructor
public class BlockDayArrangeService {

    static final int OFF_BAND_WEIGHT = 1000;
    static final int HEAVY_PAIR_WEIGHT = 10;

    private final MesocycleRepository mesocycleRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final VolumeArcService volumeArcService;
    private final VolumeProperties volumeProperties;
    private final TrainTechniqueProperties techniqueProps;
    private final TrainService trainService;
    private final TrainMapper mapper;
    private final VolumeLedger volumeLedger;

    /** The block's days as they stand, read once. */
    private record Read(MesocycleEntity run, List<WorkoutSessionEntity> days, Map<UUID, List<ExerciseEntity>> rows) {
    }

    /** The re-arranged week for {@code gymWeekdays} (0 = hétfő), judged against {@code sportWeekdays}. No write. */
    @Transactional(readOnly = true)
    public BlockDayArrangement.Plan plan(UUID owner, UUID mesoId, List<Integer> gymWeekdays, Set<Integer> sportWeekdays) {
        return plan(read(owner, mesoId), gymWeekdays, sportWeekdays, owner);
    }

    /**
     * Everything {@link #plan} depends on, as text (the season fingerprint covers it): each template day's id,
     * weekday label and place, and each of its exercises' id, muscle and working sets.
     */
    @Transactional(readOnly = true)
    public String state(UUID owner, UUID mesoId) {
        Read r = read(owner, mesoId);
        StringBuilder b = new StringBuilder(r.run().getId().toString()).append('|').append(r.run().getStatus());
        for (WorkoutSessionEntity d : r.days()) {
            b.append(";").append(d.getId()).append('|').append(d.getDayLabel()).append('|').append(d.getOrderIndex());
            for (ExerciseEntity e : r.rows().getOrDefault(d.getId(), List.of())) {
                b.append(',').append(e.getId()).append(':').append(e.getMuscle()).append(':').append(e.getWorkingSets());
            }
        }
        return b.toString();
    }

    /** Writes the plan {@link #plan} shows for the same state; a no-op when nothing moves. */
    @Transactional
    public BlockDayArrangement.Plan apply(UUID owner, UUID mesoId, List<Integer> gymWeekdays, Set<Integer> sportWeekdays) {
        Read r = read(owner, mesoId);
        BlockDayArrangement.Plan plan = plan(r, gymWeekdays, sportWeekdays, owner);
        if (!plan.changed()) {
            return plan;
        }
        for (BlockDayArrangement.Day d : plan.dropped()) {
            if (workoutSessionRepository.existsByCreatedByAndTemplateSessionIdAndStatus(owner, d.id(), "active")) {
                throw new SystemRuntimeErrorException(
                    SystemMessage.error(TrainService.TRAIN_DAY_WORKOUT_RUNNING).build(), HttpStatus.CONFLICT);
            }
        }
        Map<UUID, WorkoutSessionEntity> byId = new HashMap<>();
        r.days().forEach(d -> byId.put(d.getId(), d));
        for (BlockDayArrangement.Day d : plan.dropped()) {
            exerciseRepository.deleteAll(r.rows().getOrDefault(d.id(), List.of()));
            workoutSessionRepository.delete(byId.get(d.id()));
        }
        Set<UUID> placed = new HashSet<>();
        List<BlockDayArrangement.Plan.Slot> slots = plan.slots();
        for (int i = 0; i < slots.size(); i++) {
            BlockDayArrangement.Plan.Slot slot = slots.get(i);
            WorkoutSessionEntity source = byId.get(slot.sourceId());
            if (slot.change() != BlockDayArrangement.Change.ADD && placed.add(slot.sourceId())) {
                source.setDayLabel(label(slot.weekday()));
                source.setOrderIndex(i);
                workoutSessionRepository.save(source);
            } else {
                WorkoutSessionEntity copy = new WorkoutSessionEntity();
                copy.setCreatedBy(owner);
                copy.setMesocycleId(mesoId);
                copy.setDayLabel(label(slot.weekday()));
                copy.setType(source.getType());
                copy.setMuscle(source.getMuscle() == null ? "" : source.getMuscle());
                copy.setMuscleAccent(source.isMuscleAccent());
                copy.setNote(source.getNote());
                copy.setOrderIndex(i);
                UUID copyId = workoutSessionRepository.saveAndFlush(copy).getId();
                List<GymExerciseInput> inputs = r.rows().getOrDefault(source.getId(), List.of()).stream()
                    .map(e -> mapper.toExerciseInput(mapper.toExerciseJson(e))).toList();
                trainService.replaceDayExercises(owner, mesoId, copyId, inputs);
            }
        }
        workoutSessionRepository.flush();
        volumeLedger.sync(owner, mesoId);
        return plan;
    }

    private Read read(UUID owner, UUID mesoId) {
        MesocycleEntity run = OwnershipGuard.ownedOrThrow(mesocycleRepository.findById(mesoId), owner);
        List<WorkoutSessionEntity> days = workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(owner, List.of(mesoId)).stream()
            .filter(s -> s.getTemplateSessionId() == null).toList();
        Map<UUID, List<ExerciseEntity>> rows = new HashMap<>();
        if (!days.isEmpty()) {
            exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(owner,
                    days.stream().map(WorkoutSessionEntity::getId).toList())
                .forEach(e -> rows.computeIfAbsent(e.getWorkoutSessionId(), k -> new ArrayList<>()).add(e));
        }
        return new Read(run, days, rows);
    }

    private BlockDayArrangement.Plan plan(Read r, List<Integer> gymWeekdays, Set<Integer> sportWeekdays, UUID owner) {
        List<BlockDayArrangement.Day> days = r.days().stream()
            .map(d -> new BlockDayArrangement.Day(d.getId(), MesoPlanSkeleton.DAY_ORDER.indexOf(d.getDayLabel()),
                d.getType()))
            .toList();
        Map<UUID, List<PlanEvaluator.PlanExercise>> exercises = new HashMap<>();
        r.rows().forEach((dayId, list) -> exercises.put(dayId, list.stream().map(e -> new PlanEvaluator.PlanExercise(
            e.getMuscle() == null || e.getMuscle().isBlank() ? null : MuscleGroup.of(e.getMuscle()),
            e.getWorkingSets() == null ? 0 : e.getWorkingSets(), e.getWarmupSets() == null ? 0 : e.getWarmupSets(),
            e.isCountsTowardVolume(), TechniqueRules.capExtra(e, r.run().isTechniquesEnabled(),
                techniqueProps.capWeight()), e.getRestSec())).toList()));
        boolean deficit = volumeArcService.deficitFor(owner, r.run());
        MesocycleEntity run = r.run();
        return BlockDayArrangement.arrange(days, gymWeekdays, slots -> {
            List<PlanEvaluator.PlanDay> week = slots.stream()
                .map(s -> new PlanEvaluator.PlanDay(label(s.weekday()), exercises.getOrDefault(s.sourceId(), List.of())))
                .toList();
            PlanEvaluator.Result result = PlanEvaluator.evaluate(new PlanEvaluator.Input(run.getWeeks(),
                run.getPhaseCurve() == null ? List.of() : run.getPhaseCurve(), week, run.getMusclePriorities(),
                run.getSportGroups() == null ? Set.of() : new HashSet<>(run.getSportGroups()), deficit, null,
                sportWeekdays, volumeProperties, run.getTrainingStyle() != null));
            return score(result);
        });
    }

    /** Lower is better: muscles outside their band, then heavy back-to-back days, then the total distance. */
    static int score(PlanEvaluator.Result result) {
        int off = 0;
        int heavy = 0;
        int distance = 0;
        for (PlanEvaluator.MuscleResult m : result.muscles()) {
            if (m.fit() != PlanEvaluator.Fit.INSIDE) {
                off++;
            }
            heavy += m.consecutiveHeavy().size();
            distance += Math.abs(m.diff());
        }
        return off * OFF_BAND_WEIGHT + heavy * HEAVY_PAIR_WEIGHT + distance;
    }

    private static String label(int weekday) {
        return MesoPlanSkeleton.DAY_ORDER.get(weekday);
    }
}
