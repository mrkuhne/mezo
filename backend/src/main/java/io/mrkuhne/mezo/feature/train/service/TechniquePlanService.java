package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoPlanEvaluateRequest;
import io.mrkuhne.mezo.feature.train.config.TrainTechniqueProperties;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.SportScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Feeds the pure {@link TechniquePlanner} (mezo-r36n9.81): builds its block snapshot from a run's template-day rows
 * or from a draft plan (catalog attributes in one batched read, the effective style per row, the sport weekdays from
 * the owner's sport schedule, the deficit), projects every week of a block for the evaluator, and writes week 1's
 * planner challenges onto a freshly started run.
 *
 * <p>Only a block with a training style AND the techniques flag on is planned ({@link #optsIn}); everything else
 * gets an empty projection and no write. Index convention (same as {@link TemplatePlan} and the evaluator):
 * {@code dayIndex} = the run day's {@code orderIndex} (a draft day's position), {@code exerciseIndex} = the row's
 * position in that day's full row list, non-counting rows included.
 */
@Service
@RequiredArgsConstructor
public class TechniquePlanService {

    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final SportScheduleSlotRepository sportSlotRepository;
    private final EnergyBalancePort energyBalance;
    private final CatalogAttributes catalogAttributes;
    private final ExerciseStyler styler;
    private final VolumeProperties volumeProps;
    private final TrainTechniqueProperties techniqueProps;

    /** The run gets the planner: it has a training style and the techniques flag on. */
    public boolean optsIn(MesocycleEntity run) {
        return run.getTrainingStyle() != null && run.isTechniquesEnabled();
    }

    /** The draft gets the planner: it has a training style and the techniques flag on. */
    public boolean optsIn(MesoPlanEvaluateRequest req) {
        return req.getTrainingStyle() != null && Boolean.TRUE.equals(req.getTechniquesEnabled());
    }

    /**
     * The run's week as the planner sees it, from its CURRENT template-day rows. {@code workingSetsOverlay} (may be
     * null) replaces a row's working sets by row id — the weekly proposal's working copy.
     */
    public TechniquePlanner.Input snapshotRun(UUID createdBy, MesocycleEntity run, int week,
                                              Map<UUID, Integer> workingSetsOverlay) {
        return inputFor(readRun(createdBy, run, workingSetsOverlay).base(), week,
            WeekProposalService.isDeloadPhase(run, week));
    }

    /**
     * A block's projection for the evaluator: every week planned, plus the per-exercise technique recommendations
     * ({@link TechniqueRecommender}, mezo-r36n9.98) — both from ONE snapshot read.
     */
    public record Projection(List<TechniquePlanner.Week> weeks, List<TechniqueRecommender.Recommendation> recommendations) {
        static final Projection EMPTY = new Projection(List.of(), List.of());
    }

    /** Every week 1..weeks of the run planned from its current rows; empty when the run does not opt in. */
    public List<TechniquePlanner.Week> projectRun(UUID createdBy, MesocycleEntity run) {
        return planRun(createdBy, run).weeks();
    }

    /** {@link #projectRun} plus the run rows' recommendations; empty when the run does not opt in. */
    public Projection planRun(UUID createdBy, MesocycleEntity run) {
        if (!optsIn(run)) {
            return Projection.EMPTY;
        }
        Base base = readRun(createdBy, run, null).base();
        List<TechniquePlanner.Week> weeks = new ArrayList<>();
        for (int w = 1; w <= run.getWeeks(); w++) {
            weeks.add(TechniquePlanner.plan(inputFor(base, w, WeekProposalService.isDeloadPhase(run, w))));
        }
        return new Projection(List.copyOf(weeks), TechniqueRecommender.recommend(base.days(), techniqueProps.planner()));
    }

    /** The draft's week as the planner sees it (draft rows get deterministic ids, see {@link #draftRowId}). */
    public TechniquePlanner.Input snapshotDraft(UUID userId, MesoPlanEvaluateRequest req, int week) {
        return inputFor(readDraft(userId, req), week, WeekProposalService.isDeloadPhase(phaseCurve(req), week));
    }

    /** Every week 1..weeks of the draft; empty when the draft does not opt in. */
    public List<TechniquePlanner.Week> projectDraft(UUID userId, MesoPlanEvaluateRequest req) {
        return planDraft(userId, req).weeks();
    }

    /** {@link #projectDraft} plus the draft rows' recommendations; empty when the draft does not opt in. */
    public Projection planDraft(UUID userId, MesoPlanEvaluateRequest req) {
        if (!optsIn(req)) {
            return Projection.EMPTY;
        }
        Base base = readDraft(userId, req);
        List<String> curve = phaseCurve(req);
        List<TechniquePlanner.Week> weeks = new ArrayList<>();
        for (int w = 1; w <= req.getWeeks(); w++) {
            weeks.add(TechniquePlanner.plan(inputFor(base, w, WeekProposalService.isDeloadPhase(curve, w))));
        }
        return new Projection(List.copyOf(weeks), TechniqueRecommender.recommend(base.days(), techniqueProps.planner()));
    }

    /**
     * Run start: week 1's planner challenges onto the run rows ({@code challenge = true}, source {@code planner},
     * technique untouched). No-op when the run does not opt in. Joins the caller's transaction.
     */
    public void placeStartChallenges(UUID createdBy, MesocycleEntity run) {
        if (!optsIn(run)) {
            return;
        }
        RunState state = readRun(createdBy, run, null);
        TechniquePlanner.Week week = TechniquePlanner.plan(
            inputFor(state.base(), 1, WeekProposalService.isDeloadPhase(run, 1)));
        List<ExerciseEntity> changed = new ArrayList<>();
        for (TechniquePlanner.Pick pick : week.challenges()) {
            if (!TechniquePlanner.SOURCE_PLANNER.equals(pick.source())) continue;
            ExerciseEntity row = state.rowsById().get(pick.id());
            if (row == null) continue;
            row.setChallenge(true);
            row.setTechniqueSource(TechniquePlanner.SOURCE_PLANNER);
            changed.add(row);
        }
        if (!changed.isEmpty()) {
            exerciseRepository.saveAll(changed);
        }
    }

    // ── snapshot reads ──────────────────────────────────────────────────────────

    /** Week-independent part of the planner input, read once per call. */
    private record Base(List<TechniquePlanner.PlanDay> days, Map<String, String> priorities, Set<String> sportGroups,
                        boolean deficit) {}

    private record RunState(Base base, Map<UUID, ExerciseEntity> rowsById) {}

    private RunState readRun(UUID createdBy, MesocycleEntity run, Map<UUID, Integer> overlay) {
        List<WorkoutSessionEntity> templateDays = workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(run.getId())).stream()
            .filter(s -> s.getTemplateSessionId() == null).toList();
        Map<UUID, List<ExerciseEntity>> bySession = new HashMap<>();
        if (!templateDays.isEmpty()) {
            exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy,
                    templateDays.stream().map(WorkoutSessionEntity::getId).toList())
                .forEach(e -> bySession.computeIfAbsent(e.getWorkoutSessionId(), k -> new ArrayList<>()).add(e));
        }
        List<ExerciseEntity> all = bySession.values().stream().flatMap(List::stream).toList();
        CatalogAttributes.AttrsLookup attrs = catalogAttributes.loadAttrs(
            all.stream().map(ExerciseEntity::getCatalogId).toList());
        CatalogAttributes.Lookup stability = stabilityOf(attrs);
        Set<Integer> sportWeekdays = sportWeekdays(createdBy);
        TrainingStyle block = TrainingStyle.fromWire(run.getTrainingStyle());
        Map<UUID, Integer> sets = overlay == null ? Map.of() : overlay;

        List<TechniquePlanner.PlanDay> days = new ArrayList<>();
        Map<UUID, ExerciseEntity> rowsById = new HashMap<>();
        for (WorkoutSessionEntity s : templateDays) {
            int dayIndex = s.getOrderIndex() == null ? 0 : s.getOrderIndex();   // as TemplatePlan
            List<ExerciseEntity> rows = bySession.getOrDefault(s.getId(), List.of());
            List<TechniquePlanner.PlanRow> planRows = new ArrayList<>(rows.size());
            for (int i = 0; i < rows.size(); i++) {
                ExerciseEntity e = rows.get(i);
                rowsById.put(e.getId(), e);
                int workingSets = sets.getOrDefault(e.getId(), e.getWorkingSets() == null ? 0 : e.getWorkingSets());
                planRows.add(new TechniquePlanner.PlanRow(dayIndex, i, e.getId(), group(e.getMuscle()),
                    e.isCountsTowardVolume(), workingSets, e.getType(), e.getRepMax(), attrs.of(e.getCatalogId()),
                    effective(e.getTrainingStyle(), e.getType(), e.getCatalogId(), block, stability,
                        e.isCountsTowardVolume()),
                    Technique.fromWire(e.getTechnique()), e.getTechniqueSource(), e.isChallenge()));
            }
            days.add(new TechniquePlanner.PlanDay(dayIndex, sportDay(s.getDayLabel(), sportWeekdays),
                List.copyOf(planRows)));
        }
        Base base = new Base(List.copyOf(days), run.getMusclePriorities() == null ? Map.of() : run.getMusclePriorities(),
            run.getSportGroups() == null ? Set.of()
                : run.getSportGroups().stream().filter(Objects::nonNull).collect(Collectors.toUnmodifiableSet()),
            energyBalance.isInDeficit(createdBy, LocalDate.now()));
        return new RunState(base, rowsById);
    }

    private Base readDraft(UUID userId, MesoPlanEvaluateRequest req) {
        List<MesoDayInput> reqDays = req.getDays() == null ? List.of() : req.getDays();
        List<UUID> catalogIds = reqDays.stream()
            .flatMap(d -> d.getExercises() == null ? Stream.<GymExerciseInput>empty()
                : d.getExercises().stream())
            .map(GymExerciseInput::getCatalogId).toList();
        CatalogAttributes.AttrsLookup attrs = catalogAttributes.loadAttrs(catalogIds);
        CatalogAttributes.Lookup stability = stabilityOf(attrs);
        Set<Integer> sportWeekdays = sportWeekdays(userId);
        TrainingStyle block = req.getTrainingStyle() == null ? null
            : TrainingStyle.fromWire(req.getTrainingStyle().getValue());

        List<TechniquePlanner.PlanDay> days = new ArrayList<>();
        for (int d = 0; d < reqDays.size(); d++) {
            MesoDayInput day = reqDays.get(d);
            List<GymExerciseInput> exercises = day.getExercises() == null ? List.of() : day.getExercises();
            List<TechniquePlanner.PlanRow> rows = new ArrayList<>(exercises.size());
            for (int i = 0; i < exercises.size(); i++) {
                GymExerciseInput x = exercises.get(i);
                boolean counts = !Boolean.FALSE.equals(x.getCountsTowardVolume());
                String type = x.getType() == null ? null : x.getType().getValue();
                String exerciseStyle = x.getTrainingStyle() == null ? null : x.getTrainingStyle().getValue();
                Technique technique = x.getTechnique() == null ? Technique.NONE
                    : Technique.fromWire(x.getTechnique().getValue());
                boolean challenge = Boolean.TRUE.equals(x.getChallenge());
                rows.add(new TechniquePlanner.PlanRow(d, i, draftRowId(d, i), group(x.getMuscle()), counts,
                    x.getWorkingSets() == null ? 0 : x.getWorkingSets(), type, x.getRepMax(),
                    attrs.of(x.getCatalogId()),
                    effective(exerciseStyle, type, x.getCatalogId(), block, stability, counts),
                    technique, draftSource(x, technique, challenge), challenge));
            }
            days.add(new TechniquePlanner.PlanDay(d, sportDay(day.getDay(), sportWeekdays), List.copyOf(rows)));
        }
        List<String> sportGroups = SportGroups.normalize(req.getSportGroups(), volumeProps.baselines().keySet());
        return new Base(List.copyOf(days), PriorityTier.normalize(req.getMusclePriorities()),
            sportGroups == null ? Set.of() : new HashSet<>(sportGroups),
            energyBalance.isInDeficit(userId, LocalDate.now()));
    }

    /** A draft row's stable id: the same day / exercise position always gives the same id. */
    static UUID draftRowId(int dayIndex, int exerciseIndex) {
        return UUID.nameUUIDFromBytes((dayIndex + ":" + exerciseIndex).getBytes(StandardCharsets.UTF_8));
    }

    /** A draft's pick without a source is the owner's (it came from his editor). */
    private static String draftSource(GymExerciseInput x, Technique technique, boolean challenge) {
        if (x.getTechniqueSource() != null) {
            return x.getTechniqueSource().getValue();
        }
        return technique != Technique.NONE || challenge ? TechniquePlanner.SOURCE_OWNER : null;
    }

    private TechniquePlanner.Input inputFor(Base base, int week, boolean deloadWeek) {
        return new TechniquePlanner.Input(week, deloadWeek, base.days(), base.priorities(), base.sportGroups(),
            base.deficit(), volumeProps.bands().exerciseCap(), volumeProps.bands().sessionCap(),
            techniqueProps.capWeight(), techniqueProps.planner());
    }

    private TrainingStyle effective(String exerciseStyle, String type, UUID catalogId, TrainingStyle block,
                                    CatalogAttributes.Lookup stability, boolean counts) {
        io.mrkuhne.mezo.api.dto.TrainingStyle style =
            styler.effective(exerciseStyle, type, catalogId, block, stability, counts);
        return style == null ? null : TrainingStyle.fromWire(style.getValue());
    }

    private Set<Integer> sportWeekdays(UUID userId) {
        return sportSlotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId).stream()
            .map(SportScheduleSlotEntity::getDayOfWeek).collect(Collectors.toUnmodifiableSet());
    }

    /** The day label's weekday (Hét = 0 … Vas = 6) has a sport slot; an unknown label never does. */
    private static boolean sportDay(String dayLabel, Set<Integer> sportWeekdays) {
        int weekday = MesoPlanSkeleton.DAY_ORDER.indexOf(dayLabel);
        return weekday >= 0 && sportWeekdays.contains(weekday);
    }

    static CatalogAttributes.Lookup stabilityOf(CatalogAttributes.AttrsLookup attrs) {
        return new CatalogAttributes.Lookup(attrs.byId().entrySet().stream()
            .filter(e -> e.getValue().stable()).map(Map.Entry::getKey).collect(Collectors.toUnmodifiableSet()));
    }

    private static String group(String muscle) {
        return muscle == null || muscle.isBlank() ? null : MuscleGroup.of(muscle);
    }

    private static List<String> phaseCurve(MesoPlanEvaluateRequest req) {
        return req.getPhaseCurve() == null ? List.of()
            : req.getPhaseCurve().stream().map(MesoPlanEvaluateRequest.PhaseCurveEnum::getValue).toList();
    }

}
