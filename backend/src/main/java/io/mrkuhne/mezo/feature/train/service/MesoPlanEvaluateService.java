package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.DayEvaluation;
import io.mrkuhne.mezo.api.dto.DaySetSpread;
import io.mrkuhne.mezo.api.dto.ExerciseCapWarning;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoPlanEvaluateRequest;
import io.mrkuhne.mezo.api.dto.MesoPlanEvaluation;
import io.mrkuhne.mezo.api.dto.MuscleEvaluation;
import io.mrkuhne.mezo.api.dto.PlanProposalEdit;
import io.mrkuhne.mezo.api.dto.SessionCapWarning;
import io.mrkuhne.mezo.api.dto.VolumeBandView;
import io.mrkuhne.mezo.api.dto.VolumePathWeek;
import io.mrkuhne.mezo.feature.train.config.TrainTechniqueProperties;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.SportScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The plan evaluator's two entry points (volume engine v2 S2): {@code POST /meso-plans/evaluate} measures a
 * draft plan, {@code GET /mesocycles/{id}/evaluation} measures a run's own template days. Both read the
 * owner's deficit and sport schedule; neither ever writes. The run's {@code path} is the arc's planned line
 * ({@link VolumeArcService#plannedPath}) — one computation, two readers.
 */
@Service
@RequiredArgsConstructor
public class MesoPlanEvaluateService {

    private final VolumeProperties props;
    private final EnergyBalancePort energyBalance;
    private final SportScheduleSlotRepository sportSlotRepository;
    private final MesocycleRepository mesocycleRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final VolumeArcService volumeArcService;
    private final TrainTechniqueProperties techniqueProps;

    @Transactional(readOnly = true)
    public MesoPlanEvaluation evaluate(UUID userId, MesoPlanEvaluateRequest req) {
        Map<String, String> priorities = PriorityTier.normalize(req.getMusclePriorities());
        List<String> sportGroups = SportGroups.normalize(req.getSportGroups(), props.baselines().keySet());

        List<PlanEvaluator.PlanDay> days = new ArrayList<>();
        for (MesoDayInput d : req.getDays()) {
            List<PlanEvaluator.PlanExercise> list = new ArrayList<>();
            for (GymExerciseInput x : d.getExercises() == null ? List.<GymExerciseInput>of() : d.getExercises()) {
                String group = x.getMuscle() == null || x.getMuscle().isBlank() ? null : MuscleGroup.of(x.getMuscle());
                list.add(new PlanEvaluator.PlanExercise(group, x.getWorkingSets(), x.getWarmupSets(),
                    !Boolean.FALSE.equals(x.getCountsTowardVolume())));
            }
            days.add(new PlanEvaluator.PlanDay(d.getDay(), list));
        }
        List<String> phaseCurve = req.getPhaseCurve().stream().map(MesoPlanEvaluateRequest.PhaseCurveEnum::getValue).toList();
        if (phaseCurve.size() != req.getWeeks()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("TRAIN_MESO_PHASE_CURVE_LENGTH").build(), HttpStatus.BAD_REQUEST);
        }

        List<SportScheduleSlotEntity> slots = sportSlotRepository
            .findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId);
        boolean deficit = energyBalance.isInDeficit(userId, LocalDate.now());
        PlanEvaluator.Result result = PlanEvaluator.evaluate(new PlanEvaluator.Input(req.getWeeks(), phaseCurve, days,
            priorities, sportGroups == null ? Set.of() : new HashSet<>(sportGroups), deficit,
            req.getSessionMinutesTarget(), sportWeekdays(slots), props));
        return toResponse(deficit, result, slots, sportGroups == null, null, null);
    }

    @Transactional(readOnly = true)
    public MesoPlanEvaluation evaluateRun(UUID userId, UUID mesoId) {
        MesocycleEntity run = OwnershipGuard.ownedOrThrow(mesocycleRepository.findById(mesoId), userId);

        List<WorkoutSessionEntity> templateDays = workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(userId, List.of(mesoId)).stream()
            .filter(s -> s.getTemplateSessionId() == null).toList();
        Map<UUID, List<ExerciseEntity>> bySession = new HashMap<>();
        if (!templateDays.isEmpty()) {
            exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(userId,
                templateDays.stream().map(WorkoutSessionEntity::getId).toList())
                .forEach(e -> bySession.computeIfAbsent(e.getWorkoutSessionId(), k -> new ArrayList<>()).add(e));
        }
        List<PlanEvaluator.PlanDay> days = new ArrayList<>();
        for (WorkoutSessionEntity s : templateDays) {
            List<PlanEvaluator.PlanExercise> list = new ArrayList<>();
            for (ExerciseEntity e : bySession.getOrDefault(s.getId(), List.of())) {
                String group = e.getMuscle() == null || e.getMuscle().isBlank() ? null : MuscleGroup.of(e.getMuscle());
                list.add(new PlanEvaluator.PlanExercise(group, e.getWorkingSets() == null ? 0 : e.getWorkingSets(),
                    e.getWarmupSets() == null ? 0 : e.getWarmupSets(), e.isCountsTowardVolume(),
                    TechniqueRules.capExtra(e, run.isTechniquesEnabled(), techniqueProps.capWeight())));
            }
            days.add(new PlanEvaluator.PlanDay(s.getDayLabel(), list, s.getOrderIndex()));
        }
        List<String> phaseCurve = run.getPhaseCurve() == null ? List.of() : run.getPhaseCurve();

        List<SportScheduleSlotEntity> slots = sportSlotRepository
            .findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId);
        boolean deficit = volumeArcService.deficitFor(userId, run);
        PlanEvaluator.Result result = PlanEvaluator.evaluate(new PlanEvaluator.Input(run.getWeeks(), phaseCurve, days,
            run.getMusclePriorities(),
            run.getSportGroups() == null ? Set.of() : new HashSet<>(run.getSportGroups()),
            deficit, null, sportWeekdays(slots), props));
        return toResponse(deficit, result, slots, run.getSportGroups() == null,
            volumeArcService.plannedPath(userId, run, run.getCurrentWeek()), run);
    }

    private static Set<Integer> sportWeekdays(List<SportScheduleSlotEntity> slots) {
        Set<Integer> days = new TreeSet<>();
        slots.forEach(s -> days.add(s.getDayOfWeek()));
        return days;
    }

    private MesoPlanEvaluation toResponse(boolean deficit, PlanEvaluator.Result r, List<SportScheduleSlotEntity> slots,
                                          boolean suggest, Map<String, int[]> plannedPath, MesocycleEntity run) {
        Set<String> suggested = new HashSet<>();
        if (suggest) {
            slots.stream().map(SportScheduleSlotEntity::getSport).distinct().forEach(sport ->
                suggested.addAll(props.sportGroupsBySport().getOrDefault(sport, List.of())));
        }
        List<MuscleEvaluation> muscles = r.muscles().stream().map(m -> MuscleEvaluation.builder()
            .muscle(m.muscle())
            .tier(MuscleEvaluation.TierEnum.fromValue(m.tier().name().toLowerCase()))
            .band(VolumeBandView.builder().low(m.band().low()).high(m.band().high()).limit(m.band().limit())
                .sportAdjusted(m.band().sportAdjusted()).build())
            .weeklySets(m.weeklySets())
            .fit(MuscleEvaluation.FitEnum.fromValue(m.fit().name().toLowerCase()))
            .diff(m.diff())
            .spread(m.spread().stream().map(s -> DaySetSpread.builder().dayIndex(s.dayIndex()).sets(s.sets()).build()).toList())
            .proposal(m.proposal().stream().map(p -> PlanProposalEdit.builder().dayIndex(p.dayIndex())
                .exerciseIndex(p.exerciseIndex()).delta(p.delta()).build()).toList())
            .proposalBlocked(m.proposalBlocked())
            .build()).toList();
        List<DayEvaluation> days = r.days().stream().map(d -> DayEvaluation.builder()
            .dayIndex(d.dayIndex()).day(d.day()).minutesEstimate(d.minutesEstimate()).overTarget(d.overTarget())
            .exerciseCapWarnings(d.exerciseCapWarnings().stream().map(w -> ExerciseCapWarning.builder()
                .exerciseIndex(w.exerciseIndex()).sets(w.sets()).cap(w.cap()).build()).toList())
            .sessionCapWarnings(d.sessionCapWarnings().stream().map(w -> SessionCapWarning.builder()
                .muscle(w.muscle()).sets(w.sets()).cap(w.cap()).build()).toList())
            .sportSameDay(d.sportSameDay()).build()).toList();
        List<VolumePathWeek> path = plannedPath == null
            ? r.path().stream().map(w -> VolumePathWeek.builder().week(w.week()).phase(w.phase()).total(w.total())
                .muscles(new TreeMap<>(w.sets())).build()).toList()
            : plannedPathWeeks(run, plannedPath);
        return MesoPlanEvaluation.builder()
            .deficit(deficit)
            .sportDays(List.copyOf(sportWeekdays(slots)))
            .suggestedSportGroups(props.baselines().keySet().stream().filter(suggested::contains).toList())
            .muscles(muscles).days(days).path(path).build();
    }

    private static List<VolumePathWeek> plannedPathWeeks(MesocycleEntity run, Map<String, int[]> planned) {
        List<String> curve = run.getPhaseCurve() == null ? List.of() : run.getPhaseCurve();
        List<VolumePathWeek> weeks = new ArrayList<>();
        for (int w = 1; w <= run.getWeeks(); w++) {
            Map<String, Integer> sets = new TreeMap<>();
            int total = 0;
            for (Map.Entry<String, int[]> e : planned.entrySet()) {
                sets.put(e.getKey(), e.getValue()[w - 1]);
                total += e.getValue()[w - 1];
            }
            weeks.add(VolumePathWeek.builder().week(w).phase(w - 1 < curve.size() ? curve.get(w - 1) : VolumePath.MISSING_PHASE)
                .total(total).muscles(sets).build());
        }
        return weeks;
    }
}
