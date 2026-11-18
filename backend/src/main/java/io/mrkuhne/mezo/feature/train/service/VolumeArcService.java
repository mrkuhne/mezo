package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.MesocycleVolumeArcResponse;
import io.mrkuhne.mezo.api.dto.MuscleVolumeArc;
import io.mrkuhne.mezo.api.dto.VolumeArcWeek;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.json.RestoreEntryJson;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read-only whole-mesocycle volume arc (Phase B, Task B2): per-muscle planned line laid alongside
 * the logged actuals bucketed to {@code startDate}-anchored meso-weeks, up to {@code currentWeek} —
 * future weeks carry only {@code planned} ({@code actual == null}). The planned line is the volume
 * engine v2 path ({@link #plannedPath}): past weeks what each week prescribed, the current and later
 * weeks {@link VolumePath} from the plan as it stands. Never gated by the volume-progression switch
 * (harmless read); never mutates state.
 *
 * <p>A muscle with no {@link MuscleGroupVolumeLogEntity} row is simply absent from the response
 * (DA5, same rule as {@link VolumeProgressionService}) — never fabricated.
 */
@Service
@RequiredArgsConstructor
public class VolumeArcService {

    private static final String PHASE_DELOAD = "Deload";
    private static final String LEGACY_KEY = "legacy";

    /** Coarse volume-group → color-family region key, matching the frontend's {@code muscleRegion}. */
    private static final Map<String, String> REGION_BY_GROUP = Map.ofEntries(
        Map.entry("chest", "coral"),
        Map.entry("back", "sky"),
        Map.entry("shoulder", "lav"),
        Map.entry("biceps", "rose"),
        Map.entry("triceps", "rose"),
        Map.entry("quad", "sage"),
        Map.entry("ham", "sage"),
        Map.entry("glute", "sage"),
        Map.entry("calf", "sage"),
        Map.entry("core", "amber"));

    private final MesocycleRepository mesocycleRepository;
    private final MuscleGroupVolumeLogRepository volumeLogRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final ExerciseRepository exerciseRepository;
    private final TemplatePlan templatePlan;
    private final MesoWeekProposalRepository proposalRepository;
    private final EnergyBalancePort energyBalance;
    private final VolumeProperties props;

    @Transactional(readOnly = true)
    public MesocycleVolumeArcResponse arc(UUID createdBy, UUID mesoId) {
        return arc(createdBy, mesoId, null);
    }

    /**
     * Report-freeze overload (mezo-meyc.2): same arc, but the "how far has this run got" cutoff that
     * masks future weeks' {@code actual} to null comes from the caller instead of the stored
     * {@code currentWeek}.
     *
     * <p>Why it exists: {@code currentWeek} only advances on the weekly volume rollover, so a run
     * closed while that value is stale would freeze an internally CONTRADICTORY report — adherence
     * counting a week-2 session while the arc shows week 2 as "not reached yet" ({@code actual =
     * null}). {@code MesocycleReportService} passes {@code max(currentWeek, weeksElapsed)}; the
     * public {@link #arc(UUID, UUID)} passes {@code null} and behaves exactly as before.
     */
    @Transactional(readOnly = true)
    MesocycleVolumeArcResponse arc(UUID createdBy, UUID mesoId, Integer effectiveCurrentWeek) {
        MesocycleEntity meso = OwnershipGuard.ownedOrThrow(mesocycleRepository.findById(mesoId), createdBy);
        int weeks = meso.getWeeks();
        int currentWeek = effectiveCurrentWeek == null
            ? meso.getCurrentWeek()
            : Math.min(weeks, effectiveCurrentWeek);
        LocalDate startDate = meso.getStartDate();
        List<String> phaseCurve = meso.getPhaseCurve();

        Map<String, Map<Integer, Integer>> actualByGroupWeek =
            aggregateActuals(createdBy, mesoId, startDate, weeks);
        Map<String, int[]> plannedByGroup = plannedPath(createdBy, meso, currentWeek);

        List<MuscleVolumeArc> muscles = volumeLogRepository
            .findByCreatedByAndMesocycleIdInOrderByMuscleAsc(createdBy, List.of(mesoId)).stream()
            .map(row -> buildMuscleArc(row, phaseCurve, weeks, currentWeek, actualByGroupWeek,
                plannedByGroup.getOrDefault(row.getMuscle(), new int[weeks])))
            .toList();

        return MesocycleVolumeArcResponse.builder()
            .mesocycleId(meso.getId())
            .title(meso.getTitle())
            .currentWeek(currentWeek)
            .weeks(weeks)
            .startDate(startDate)
            .endDate(meso.getEndDate())
            .status(MesocycleVolumeArcResponse.StatusEnum.fromValue(meso.getStatus()))
            .phaseCurve(phaseCurve.stream().map(MesocycleVolumeArcResponse.PhaseCurveEnum::fromValue).toList())
            .muscles(muscles)
            .build();
    }

    /** {@code coarse group -> (1-based meso-week -> logged working-set count)}, over completed instances. */
    private Map<String, Map<Integer, Integer>> aggregateActuals(
            UUID createdBy, UUID mesoId, LocalDate startDate, int weeks) {
        Map<String, Map<Integer, Integer>> byGroupWeek = new HashMap<>();
        for (ExerciseSetRepository.MuscleWeekSetCount row
                : exerciseSetRepository.aggregateWorkingSetsByMuscleAndDate(createdBy, mesoId)) {
            String group = MuscleGroup.of(row.getMuscle());
            int week = MesoWeeks.weekOf(startDate, row.getDate(), weeks);
            byGroupWeek.computeIfAbsent(group, g -> new HashMap<>())
                .merge(week, (int) row.getSets(), Integer::sum);
        }
        return byGroupWeek;
    }

    private MuscleVolumeArc buildMuscleArc(MuscleGroupVolumeLogEntity row, List<String> phaseCurve, int weeks,
            int currentWeek, Map<String, Map<Integer, Integer>> actualByGroupWeek, int[] planned) {
        String muscle = row.getMuscle(); // already the coarse volume-group key
        int mrv = row.getMrv();
        Map<Integer, Integer> actuals = actualByGroupWeek.getOrDefault(muscle, Map.of());

        List<VolumeArcWeek> weekList = new ArrayList<>(weeks);
        for (int w = 1; w <= weeks; w++) {
            weekList.add(VolumeArcWeek.builder()
                .week(w)
                .phase(VolumeArcWeek.PhaseEnum.fromValue(phaseAt(phaseCurve, w)))
                .planned(planned[w - 1])
                .actual(w <= currentWeek ? actuals.getOrDefault(w, 0) : null)
                .isCurrent(w == currentWeek)
                .build());
        }

        return MuscleVolumeArc.builder()
            .muscle(muscle)
            .region(REGION_BY_GROUP.getOrDefault(muscle, "neutral"))
            .mrv(mrv)
            .weeks(weekList)
            .build();
    }

    /**
     * The planned weekly sets per muscle group (index {@code week − 1}), for the arc and the run's
     * evaluation (volume engine v2 S2, spec §6.3):
     * <ul>
     *   <li><b>past weeks</b> ({@code < currentWeek}): what that week really prescribed — the group sums of
     *       its applied weekly proposal's {@code planAfter} (rows resolved owner-scoped including
     *       soft-deleted ones, so a day edit does not lose them); a week without one (week 1, a
     *       stamped-only week) takes the state before the next applied proposal (its {@code planAfter}
     *       with its accepted lines turned back to {@code from}), else the current plan;</li>
     *   <li><b>the current and later weeks</b>: {@link VolumePath#project} from the plan as it stands,
     *       with the current deload proposal's {@code restore} when the current week is a deload; the
     *       deficit is today's answer for an active run, else none;</li>
     *   <li><b>legacy ledger rows</b> (no {@code bandHigh}: archived model-1 runs): the path of one
     *       synthetic exercise starting at the row's MEV with the caps off — week 1 MEV, the tier step
     *       up to the band top, the deload halving, the week after restoring.</li>
     * </ul>
     * Groups without a landmark entry are never pathed and so never appear.
     */
    Map<String, int[]> plannedPath(UUID createdBy, MesocycleEntity run, int currentWeek) {
        int weeks = run.getWeeks();
        int fromWeek = Math.max(1, Math.min(weeks, currentWeek));
        List<String> phaseCurve = run.getPhaseCurve() == null ? List.of() : run.getPhaseCurve();
        Map<String, int[]> planned = new TreeMap<>();
        List<TemplatePlan.Row> plan = templatePlan.rows(createdBy, run.getId());

        if (fromWeek > 1) {
            pastWeeks(createdBy, run, fromWeek, plan, planned);
        }

        Map<String, VolumePath.Group> groups = new TreeMap<>();
        List<VolumePath.Exercise> amounts = new ArrayList<>();
        for (TemplatePlan.Row r : plan) {
            if (r.group() == null) {
                continue;
            }
            amounts.add(new VolumePath.Exercise(r.exercise().getId().toString(), r.group(), r.dayIndex(),
                r.exercise().getWorkingSets(), r.capExtra()));
            groups.computeIfAbsent(r.group(), g -> {
                PriorityTier tier = PriorityTier.of(run.getMusclePriorities(), g);
                return new VolumePath.Group(tier,
                    VolumeBands.band(props.baselines().get(g), tier, run.isSportLoaded(g), props.bands()));
            });
        }
        boolean deficit = deficitFor(createdBy, run);
        fill(planned, weeks, VolumePath.project(new VolumePath.Input(weeks, phaseCurve, fromWeek, amounts,
            restoreTo(createdBy, run, fromWeek, phaseCurve, plan), groups, deficit,
            props.stepEmphasize(), props.stepGrow(), props.stepDeficit(), props.deloadFraction(),
            props.bands().exerciseCap(), props.bands().sessionCap())));

        for (MuscleGroupVolumeLogEntity row
                : volumeLogRepository.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(createdBy, List.of(run.getId()))) {
            if (row.getBandHigh() == null) {
                planned.put(row.getMuscle(), legacyScaffold(run, row, weeks, phaseCurve));
            }
        }
        return planned;
    }

    /** Today's deficit answer, for an active run only — a finished or archived run's path ignores it. */
    boolean deficitFor(UUID createdBy, MesocycleEntity run) {
        return "active".equals(run.getStatus()) && energyBalance.isInDeficit(createdBy, LocalDate.now());
    }

    /** Fills weeks {@code 1 … fromWeek − 1} with what each week prescribed. */
    private void pastWeeks(UUID createdBy, MesocycleEntity run, int fromWeek, List<TemplatePlan.Row> plan,
                           Map<String, int[]> planned) {
        int weeks = run.getWeeks();
        List<MesoWeekProposalEntity> applied = proposalRepository.findAllApplied(createdBy, run.getId()).stream()
            .filter(p -> p.getPlanAfter() != null).toList();
        Map<String, Integer> currentPlan = new LinkedHashMap<>();
        Map<String, String> groupById = new HashMap<>();
        plan.forEach(r -> {
            currentPlan.put(r.exercise().getId().toString(), r.exercise().getWorkingSets());
            groupById.put(r.exercise().getId().toString(), r.group());
        });

        List<Map<String, Integer>> states = new ArrayList<>();
        for (int w = 1; w < fromWeek; w++) {
            states.add(prescribedAt(w, applied, currentPlan));
        }

        Set<UUID> unknown = new HashSet<>();
        states.forEach(state -> state.keySet().stream().filter(id -> !groupById.containsKey(id))
            .forEach(id -> unknown.add(UUID.fromString(id))));
        if (!unknown.isEmpty()) {
            exerciseRepository.findOwnedByIdIncludingDeleted(createdBy, unknown)
                .forEach(e -> groupById.put(e.getId().toString(), templatePlan.groupOf(e)));
        }

        for (int w = 1; w < fromWeek; w++) {
            int index = w - 1;
            states.get(index).forEach((id, sets) -> {
                String group = groupById.get(id);
                if (group != null && sets != null) {
                    planned.computeIfAbsent(group, g -> new int[weeks])[index] += sets;
                }
            });
        }
    }

    /**
     * The exercise amounts week {@code week} prescribed: its own applied proposal's {@code planAfter};
     * else the state before the next applied proposal; else the plan as it stands.
     */
    private static Map<String, Integer> prescribedAt(int week, List<MesoWeekProposalEntity> applied,
                                                     Map<String, Integer> currentPlan) {
        Optional<MesoWeekProposalEntity> own = applied.stream().filter(p -> p.getWeek() == week).findFirst();
        if (own.isPresent()) {
            return own.get().getPlanAfter();
        }
        return applied.stream().filter(p -> p.getWeek() > week).findFirst()
            .map(next -> {
                Map<String, Integer> before = new LinkedHashMap<>(next.getPlanAfter());
                if (next.getLines() != null) {
                    next.getLines().stream()
                        .filter(l -> WeekProposalLineJson.DECISION_ACCEPTED.equals(l.decision()))
                        .forEach(l -> before.put(l.exerciseId().toString(), l.from()));
                }
                return before;
            })
            .orElse(currentPlan);
    }

    /**
     * The pre-deload amounts the week after a deload restores, when {@code fromWeek} is itself a deload:
     * the current deload proposal's restore entries, each keyed by the current row it matches (by id,
     * else by identity on the same day — a day re-saved during the deload re-mints its rows), the same
     * matching the weekly proposal's restore uses.
     */
    private Map<String, Integer> restoreTo(UUID createdBy, MesocycleEntity run, int fromWeek, List<String> phaseCurve,
                                           List<TemplatePlan.Row> plan) {
        if (!PHASE_DELOAD.equalsIgnoreCase(phaseAt(phaseCurve, fromWeek))) {
            return Map.of();
        }
        List<RestoreEntryJson> entries = proposalRepository.findWeekly(createdBy, run.getId(), fromWeek)
            .filter(p -> MesoWeekProposalEntity.STATUS_APPLIED.equals(p.getStatus())
                || MesoWeekProposalEntity.STATUS_AUTO_APPLIED.equals(p.getStatus()))
            .map(MesoWeekProposalEntity::getRestore)
            .orElse(List.of());
        Map<String, Integer> restore = new HashMap<>();
        TemplatePlan.matchEntries(entries == null ? List.of() : entries, plan)
            .forEach((entry, row) -> {
                // the owner's deload-week edit stands: only a row still at the deload amount is restored
                Integer now = row.exercise().getWorkingSets();
                if (now != null && now == entry.deloadSets()) {
                    restore.put(row.exercise().getId().toString(), entry.sets());
                }
            });
        return restore;
    }

    /**
     * A legacy (model-1) ledger row's planned line: one synthetic exercise starting at the row's MEV in
     * week 1, caps off, band from the row's own landmarks, never sport-adjusted, never in a deficit.
     */
    private int[] legacyScaffold(MesocycleEntity run, MuscleGroupVolumeLogEntity row, int weeks,
                                 List<String> phaseCurve) {
        String muscle = row.getMuscle();
        PriorityTier tier = PriorityTier.of(run.getMusclePriorities(), muscle);
        VolumeProperties.Baseline landmarks = new VolumeProperties.Baseline(row.getMev(), row.getMav(), row.getMrv());
        VolumePath.Input in = new VolumePath.Input(weeks, phaseCurve, 1,
            List.of(new VolumePath.Exercise(LEGACY_KEY, muscle, 0, row.getMev())), Map.of(),
            Map.of(muscle, new VolumePath.Group(tier, VolumeBands.band(landmarks, tier, false, props.bands()))),
            false, props.stepEmphasize(), props.stepGrow(), props.stepDeficit(), props.deloadFraction(),
            Integer.MAX_VALUE, Integer.MAX_VALUE);
        Map<String, int[]> one = new HashMap<>();
        fill(one, weeks, VolumePath.project(in));
        return one.getOrDefault(muscle, new int[weeks]);
    }

    private static void fill(Map<String, int[]> planned, int weeks, List<VolumePath.Week> path) {
        for (VolumePath.Week week : path) {
            if (week.week() < 1 || week.week() > weeks) {
                continue;
            }
            week.sets().forEach((group, sets) ->
                planned.computeIfAbsent(group, g -> new int[weeks])[week.week() - 1] = sets);
        }
    }

    /** DA1-style bounds-checked 1-based phaseCurve lookup; defensive fallback if lengths ever drift. */
    private String phaseAt(List<String> phaseCurve, int week) {
        int idx = week - 1;
        if (phaseCurve == null || idx < 0 || idx >= phaseCurve.size()) {
            return "MEV";
        }
        return phaseCurve.get(idx);
    }
}
