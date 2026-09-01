package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.ExerciseSetResponse;
import io.mrkuhne.mezo.api.dto.LastWeekRef;
import io.mrkuhne.mezo.api.dto.OverloadSummary;
import io.mrkuhne.mezo.api.dto.SetLogRequest;
import io.mrkuhne.mezo.api.dto.SetUpdateRequest;
import io.mrkuhne.mezo.api.dto.TodayExercise;
import io.mrkuhne.mezo.api.dto.WorkoutFeedbackInput;
import io.mrkuhne.mezo.api.dto.WorkoutDetailExercise;
import io.mrkuhne.mezo.api.dto.WorkoutDetailResponse;
import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.api.dto.WorkoutStartRequest;
import io.mrkuhne.mezo.api.dto.WorkoutSummaryResponse;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.train.ClosingBlockGate;
import io.mrkuhne.mezo.feature.train.HypertrophyDriveGate;
import io.mrkuhne.mezo.feature.train.VolumeProgressionGate;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.service.CatalogMediaResolver.CatalogMedia;
import io.mrkuhne.mezo.feature.train.entity.ExerciseFeedbackEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.progression.ProgressionGate;
import io.mrkuhne.mezo.feature.progression.gym.GymSignal;
import io.mrkuhne.mezo.feature.train.signal.GymSignalCalculator;
import io.mrkuhne.mezo.feature.progression.mapper.LevelUpResultMapper;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.mapper.TrainMapper;
import io.mrkuhne.mezo.feature.train.repository.ExerciseFeedbackRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Workout-execution slice service (T2): today's workout context, instance start/resume, set
 * logging, RP feedback, finish. Template rows in {@code workout_session} are date-less with
 * {@code templateSessionId == null}; instances carry {@code date}, {@code status} and the
 * template back-link. All finders are scoped by {@code createdBy}; child writes verify the
 * parent chain belongs to the caller. Per house rule (spring_patterns.md) only the write
 * methods carry method-level {@code @Transactional}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkoutService {

    /** DayOfWeek (MONDAY..SUNDAY) → the HU day labels the frontend's DAY_ORDER uses. */
    public static final List<String> HU_DAY_LABELS =
        List.of("Hét", "Kedd", "Sze", "Csü", "Pén", "Szo", "Vas");

    private final MesocycleRepository mesocycleRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final ExerciseFeedbackRepository exerciseFeedbackRepository;
    private final CatalogMediaResolver catalogMediaResolver;
    private final TrainMapper mapper;
    // Progression collaborators (T6): the gym finish awards XP behind the feature switch. The gate
    // bean exists ONLY when mezo.feature.progression.enabled=true, so an absent provider ⇔ switch off.
    private final GymSignalCalculator gymSignalCalculator;
    private final ProgressionService progressionService;
    private final LevelUpResultMapper levelUpResultMapper;
    private final ObjectProvider<ProgressionGate> progressionGate;
    // Hypertrophy Drive (P1): the recommendation engine + its feature gate. The gate bean exists ONLY
    // when mezo.feature.hypertrophy-drive.enabled=true, so an absent provider ⇔ switch off (mirrors
    // progressionGate); off ⇒ getToday attaches no prescribedSets and the FE falls back to the logger.
    private final SetRecommendationService setRecommendationService;
    private final ExerciseHistoryResolver historyResolver;
    private final ObjectProvider<HypertrophyDriveGate> hypertrophyGate;
    // Fix zárás (mezo-z2ul): lazy closing-exercise ensure behind its own switch. The gate bean
    // exists ONLY when mezo.feature.closing-block.enabled=true (mirrors hypertrophyGate).
    private final ClosingBlockService closingBlockService;
    private final ObjectProvider<ClosingBlockGate> closingBlockGate;
    // Session flow fix (mezo-cd8s): lazily settle abandoned instances at the top of getToday — its
    // own @Transactional bean (getToday is a read), always on (no feature gate).
    private final WorkoutAutoCloseService workoutAutoCloseService;
    // Volume Progression (Plan 2 Phase A, mezo-hi9m): weekly per-muscle set-target rollover + the
    // effective per-exercise working-set distribution in getToday. The gate bean exists ONLY when
    // mezo.feature.volume-progression.enabled=true (mirrors hypertrophyGate/closingBlockGate).
    private final VolumeProgressionService volumeProgressionService;
    private final MuscleGroupVolumeLogRepository muscleGroupVolumeLogRepository;
    private final ObjectProvider<VolumeProgressionGate> volumeGate;
    // Medal collection (mezo-wp6n): derived-medal replay, read-only consumer of the frozen
    // MedalService — attaches the medals a set/session just earned to the logSet/finishWorkout
    // responses. No feature gate: medals are always-on (mirrors ExerciseRecordService).
    private final MedalService medalService;

    public WorkoutTodayResponse getToday(UUID createdBy, UUID templateSessionId) {
        // Settle abandoned instances FIRST (own @Transactional bean — getToday is a read):
        // after this, only a today-dated instance can be 'active', so the open-instance
        // lookup below can never resurrect last week's abandoned session. Runs before the
        // meso lookup so stale instances settle even when there is no active meso.
        workoutAutoCloseService.autoCloseStale(createdBy);
        WorkoutTodayResponse empty = new WorkoutTodayResponse();
        empty.setWeekDoneDates(List.of());
        MesocycleEntity activeMeso = mesocycleRepository
            .findByCreatedByAndStatusAndDeletedFalse(createdBy, "active")
            .stream().findFirst().orElse(null);
        // Volume progression (mezo-hi9m): lazy weekly rollover, own @Transactional bean — mutates
        // activeMeso in place (currentWeek/volumeRecompute + each muscle's currentSets), so no
        // re-read is needed. MUST run before deloadWeek below (reads activeMeso.currentWeek) and
        // before the effective-set distribution (reads the volume logs' currentSets).
        if (activeMeso != null && volumeGate.getIfAvailable() != null) {
            volumeProgressionService.rolloverIfDue(createdBy, activeMeso);
        }
        // Fix zárás: idempotent ensure across ALL template days of the active meso, BEFORE
        // today's exercise list is resolved — its own @Transactional (getToday itself is a read).
        if (activeMeso != null && closingBlockGate.getIfAvailable() != null) {
            closingBlockService.ensureClosingExercises(createdBy, activeMeso.getId());
        }
        // Gym done-state signal: this week's completed MESO-ORIGIN instance dates (custom
        // never ticks the planned rows — mezo-ws2x D5). Computed regardless of whether
        // today is a gym day, so the weekly rows can mark PAST done days.
        List<LocalDate> weekDoneDates = doneDatesThisWeek(createdBy);
        empty.setWeekDoneDates(weekDoneDates);
        // Day resolution (mezo-p7rp + mezo-ws2x): open instance > param > weekday label.
        // The open-instance and param branches are meso-INDEPENDENT — a custom (saját)
        // workout must resolve with no active meso too; only the weekday fallback needs one.
        WorkoutSessionEntity open = workoutSessionRepository
            .findFirstByCreatedByAndStatusAndTemplateSessionIdIsNotNullOrderByDateDescCreatedAtDesc(
                createdBy, "active")
            .orElse(null);
        // Shared meso session-list fetch (mezo-dz9c item 4): ensureClosingExercises above is its own
        // bean's internal query, left self-contained, but the day-resolution branch below and the
        // effective-sets distribution further down both used to re-query this same
        // findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc row set independently. Lazily fetched
        // at most ONCE here, whichever site needs it first; a request that needs neither (e.g. an
        // already-open or explicit-template day with the volume switch off) still fetches it zero
        // times, exactly as before.
        List<WorkoutSessionEntity> mesoSessions = null;
        WorkoutSessionEntity day;
        if (open != null) {
            day = ownedTemplateOrThrow(createdBy, open.getTemplateSessionId());
        } else if (templateSessionId != null) {
            day = ownedTemplateOrThrow(createdBy, templateSessionId);
        } else if (activeMeso != null) {
            mesoSessions = workoutSessionRepository
                .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(activeMeso.getId()));
            day = findPlannedTemplateForDate(mesoSessions, LocalDate.now()).orElse(null);
        } else {
            day = null;
        }
        if (day == null) {
            return empty;
        }
        List<ExerciseEntity> exercises = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, List.of(day.getId()));
        if (exercises.isEmpty()) {
            return empty; // rest day
        }
        Map<UUID, LastWeekRef> lastWeek = lastWeekRefs(createdBy, exercises);
        // Demo media: one batched catalog fetch for the day's linked exercises (catalog_id →
        // video_url), never per-exercise. Map keyed by catalog id; nulls filtered out.
        Map<UUID, CatalogMedia> mediaByCatalog = catalogMediaResolver.resolve(exercises.stream()
            .map(ExerciseEntity::getCatalogId).filter(java.util.Objects::nonNull).toList());
        // Week-scoped completion (D5): a template day completed ANY day of the current Mon–Sun
        // week reviews instead of restarting — was date == today before mezo-p7rp.
        // A custom day is repeatable — completedWorkout would trigger the FE review
        // redirect, so it stays null for custom-origin days (mezo-ws2x D4).
        WorkoutSessionEntity completedToday =
            "custom".equals(day.getOrigin()) ? null : completedThisWeek(createdBy, day.getId());
        // Deload-week detection (mezo-5pfe, DA1 fix mezo-hi9m): phaseCurve is 1-based against the
        // active meso's 1-based currentWeek (calendar week — see VolumeProgressionService/MesoWeeks)
        // — index currentWeek-1, bound-checked since currentWeek can point past the curve —
        // out-of-bounds resolves to non-deload rather than throwing.
        int phaseIdx = activeMeso != null ? activeMeso.getCurrentWeek() - 1 : -1;
        boolean deloadWeek = activeMeso != null
            && activeMeso.getPhaseCurve() != null
            && phaseIdx >= 0
            && phaseIdx < activeMeso.getPhaseCurve().size()
            && "Deload".equalsIgnoreCase(activeMeso.getPhaseCurve().get(phaseIdx));
        // Effective per-exercise working sets (DA6, mezo-gbo7): when the volume switch is on and
        // the active meso carries volume-log rows, each exercise's working-set count is its
        // muscle group's currentSets distributed across the whole meso template WEEK's counting
        // exercises of that group (see effectiveWorkingSets for the exact mechanics). Exempt
        // exercises, groups without a log row, and every exercise when the switch is off keep
        // the template workingSets (unchanged Plan-1 behavior).
        Map<UUID, Integer> effectiveSets = Map.of();
        if (activeMeso != null && volumeGate.getIfAvailable() != null) {
            List<MuscleGroupVolumeLogEntity> logs = muscleGroupVolumeLogRepository
                .findByCreatedByAndMesocycleIdInOrderByMuscleAsc(createdBy, List.of(activeMeso.getId()));
            if (!logs.isEmpty()) {
                if (mesoSessions == null) {
                    mesoSessions = workoutSessionRepository
                        .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(activeMeso.getId()));
                }
                effectiveSets = effectiveWorkingSets(weekTemplateExercises(createdBy, mesoSessions), logs);
            }
        }
        int weightUp = 0;
        int repUp = 0;
        int hold = 0;
        List<TodayExercise> mapped = new ArrayList<>();
        for (ExerciseEntity e : exercises) {
            TodayExercise t = mapper.toTodayExercise(e);
            t.setLastWeek(lastWeek.get(e.getId()));
            if (e.getCatalogId() != null) {
                CatalogMedia m = mediaByCatalog.get(e.getCatalogId());
                if (m != null) {
                    t.setVideoUrl(m.videoUrl());
                    t.setImageStartUrl(m.imageStartUrl());
                    t.setImageEndUrl(m.imageEndUrl());
                }
            }
            int effective = effectiveSets.getOrDefault(e.getId(), e.getWorkingSets());
            t.setWorkingSets(effective);
            if (hypertrophyGate.getIfAvailable() != null) {
                Prescription p = setRecommendationService.prescribe(createdBy, e, deloadWeek, effective);
                t.setPrescribedSets(p.sets());
                t.setRationale(p.rationale());
                t.setProgression(p.progression());
                if (p.progression() != null) {
                    switch (p.progression().getLever()) {
                        case WEIGHT -> weightUp++;
                        case REP -> repUp++;
                        default -> hold++; // HOLD, DELOAD
                    }
                }
            }
            mapped.add(t);
        }
        OverloadSummary overloadSummary = hypertrophyGate.getIfAvailable() != null
            ? OverloadSummary.builder().weightUp(weightUp).repUp(repUp).hold(hold).build()
            : null;
        return WorkoutTodayResponse.builder()
            .templateSessionId(day.getId())
            .dayLabel(day.getDayLabel())
            .title(day.getType())
            .durationEst(day.getDurationEst())
            .exercises(mapped)
            .openWorkout(open != null ? toInstanceResponse(createdBy, open) : null)
            .completedWorkout(completedToday != null ? toInstanceResponse(createdBy, completedToday) : null)
            .weekDoneDates(weekDoneDates)
            .overloadSummary(overloadSummary)
            .build();
    }

    /** An owned TEMPLATE row (templateSessionId == null) by id — 404 on anything else. */
    private WorkoutSessionEntity ownedTemplateOrThrow(UUID createdBy, UUID templateId) {
        return workoutSessionRepository.findById(templateId)
            .filter(s -> createdBy.equals(s.getCreatedBy()) && s.getTemplateSessionId() == null)
            .orElseThrow(WorkoutService::notFound);
    }

    /** The template day's most recent COMPLETED instance of the current Mon–Sun week (D5). */
    private WorkoutSessionEntity completedThisWeek(UUID createdBy, UUID templateId) {
        LocalDate today = LocalDate.now();
        LocalDate monday = today.minusDays(today.getDayOfWeek().getValue() - 1L);
        return workoutSessionRepository
            .findFirstByCreatedByAndTemplateSessionIdAndStatusAndDateBetweenOrderByDateDescCreatedAtDesc(
                createdBy, templateId, "completed", monday, monday.plusDays(6))
            .orElse(null);
    }

    /**
     * The planned (date-less) template session for a calendar date: active mesocycle + HU
     * day-label match. Quest generation (feature/quest) uses this as the day-type seam
     * (present → GYM day, absent → REST day), sharing getToday's resolution logic.
     */
    public Optional<WorkoutSessionEntity> findPlannedTemplateForDate(UUID createdBy, LocalDate date) {
        MesocycleEntity activeMeso = mesocycleRepository
            .findByCreatedByAndStatusAndDeletedFalse(createdBy, "active")
            .stream().findFirst().orElse(null);
        if (activeMeso == null) {
            return Optional.empty();
        }
        List<WorkoutSessionEntity> mesoSessions = workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(activeMeso.getId()));
        return findPlannedTemplateForDate(mesoSessions, date);
    }

    /**
     * Same resolution as {@link #findPlannedTemplateForDate(UUID, LocalDate)}, reusing a
     * caller-supplied meso session list — {@code getToday}'s shared-fetch path (mezo-dz9c item 4),
     * avoiding a second query for rows it already has.
     */
    private Optional<WorkoutSessionEntity> findPlannedTemplateForDate(
            List<WorkoutSessionEntity> mesoSessions, LocalDate date) {
        String dayLabel = HU_DAY_LABELS.get(date.getDayOfWeek().getValue() - 1);
        return mesoSessions.stream()
            .filter(s -> s.getTemplateSessionId() == null && dayLabel.equals(s.getDayLabel()))
            .findFirst();
    }

    /**
     * Workout instances with logged work (>=1 non-skipped set) in the inclusive date range, date
     * ascending — the same "done" semantics as {@link #doneDatesThisWeek}. Read method: no
     * {@code @Transactional}, matching {@link #getToday}.
     */
    public List<WorkoutSummaryResponse> listWorkouts(UUID createdBy, LocalDate from, LocalDate to) {
        if (from.isAfter(to)) {
            throw new SystemRuntimeErrorException(SystemMessage.error("TRAIN_INVALID_DATE_RANGE").build());
        }
        return workoutSessionRepository.findDoneInstancesBetween(createdBy, from, to).stream()
            .map(mapper::toWorkoutSummary)
            .toList();
    }

    /**
     * One instance joined with its template day's exercises + this instance's logged sets —
     * the done-day review source (spec 2026-07-15). Pure read; owned instance only (404
     * otherwise, template rows included). Skip markers set `skipped` and are excluded from sets.
     */
    public WorkoutDetailResponse getWorkoutDetail(UUID createdBy, UUID workoutId) {
        WorkoutSessionEntity instance = ownedInstanceOrThrow(createdBy, workoutId);
        List<ExerciseEntity> exercises = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(
                createdBy, List.of(instance.getTemplateSessionId()));
        Map<UUID, List<ExerciseSetEntity>> setsByExercise = exerciseSetRepository
            .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, instance.getId()).stream()
            .collect(Collectors.groupingBy(ExerciseSetEntity::getExerciseId));
        return WorkoutDetailResponse.builder()
            .id(instance.getId())
            .templateSessionId(instance.getTemplateSessionId())
            .date(instance.getDate())
            .status(WorkoutDetailResponse.StatusEnum.fromValue(instance.getStatus()))
            .title(instance.getType())
            .dayLabel(instance.getDayLabel())
            .durationEst(instance.getDurationEst())
            .note(instance.getClosingNote())
            .exercises(exercises.stream().map(e -> {
                List<ExerciseSetEntity> all = setsByExercise.getOrDefault(e.getId(), List.of());
                return WorkoutDetailExercise.builder()
                    .exerciseId(e.getId())
                    .name(e.getName())
                    .muscle(e.getMuscle())
                    .type(WorkoutDetailExercise.TypeEnum.fromValue(e.getType()))
                    .warmupSets(e.getWarmupSets())
                    .workingSets(e.getWorkingSets())
                    .repMin(e.getRepMin())
                    .repMax(e.getRepMax())
                    .targetRIR(e.getTargetRir())
                    .skipped(all.stream().anyMatch(ExerciseSetEntity::isSkipped))
                    .sets(all.stream().filter(s -> !s.isSkipped())
                        .sorted(Comparator.comparingInt(ExerciseSetEntity::getSetIndex))
                        .map(mapper::toSetResponse).toList())
                    .build();
            }).toList())
            .build();
    }

    /**
     * Dates (this Mon–Sun week) with a gym instance carrying >=1 logged set — gym done-state
     * ({@code WorkoutTodayResponse.weekDoneDates}). Plan-adherence (mezo-ws2x D5): MESO-only —
     * a completed custom (saját) instance never ticks a template day's weekly ✓.
     */
    private List<LocalDate> doneDatesThisWeek(UUID createdBy) {
        LocalDate today = LocalDate.now();
        LocalDate monday = today.minusDays(today.getDayOfWeek().getValue() - 1L);
        return workoutSessionRepository.findMesoDoneInstanceDates(createdBy, monday, monday.plusDays(6));
    }

    /**
     * Every TEMPLATE day's exercises for the meso — the unit the weekly volume target is
     * distributed over (mezo-gbo7). Instances are excluded (they carry a templateSessionId);
     * exercises hang off the template row, never off the instance. Takes the meso's already-fetched
     * session list rather than re-querying it — {@code getToday} shares one fetch across this and
     * {@link #findPlannedTemplateForDate(List, LocalDate)} (mezo-dz9c item 4).
     */
    private List<ExerciseEntity> weekTemplateExercises(UUID createdBy, List<WorkoutSessionEntity> mesoSessions) {
        List<UUID> templateDayIds = MesoTemplateDays.ids(mesoSessions);
        return templateDayIds.isEmpty()
            ? List.of()
            : exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, templateDayIds);
    }

    /**
     * Each exercise's effective working-set count (DA6): a muscle group's volume-log
     * {@code currentSets} distributed across the MESO WEEK's counting exercises of that group
     * (mezo-gbo7 — distributing it per day multiplied weekly volume by training frequency),
     * proportional to each exercise's template {@code workingSets}. Base-1 + largest-remainder:
     * every counting exercise gets a floor of 1 set, then the rest of the target is handed out
     * proportionally, so {@code sum(effective) == currentSets} exactly whenever {@code currentSets
     * >= the week's counting-exercise count}. Below that every exercise still gets its floor of
     * 1, so the weekly sum can only exceed the target, never fall short. Exempt exercises and
     * groups with no log row are absent from the returned map — the caller falls back to the
     * template {@code workingSets}.
     */
    private Map<UUID, Integer> effectiveWorkingSets(
            List<ExerciseEntity> exercises, List<MuscleGroupVolumeLogEntity> logs) {
        Map<String, Integer> targetSetsByGroup = logs.stream()
            .collect(Collectors.toMap(MuscleGroupVolumeLogEntity::getMuscle,
                MuscleGroupVolumeLogEntity::getCurrentSets, (a, b) -> a));
        Map<String, List<ExerciseEntity>> byGroup = exercises.stream()
            .filter(ExerciseEntity::isCountsTowardVolume) // mezo-gbo7: posture/plyo work is not volume
            .collect(Collectors.groupingBy(e -> MuscleGroup.of(e.getMuscle())));
        Map<UUID, Integer> out = new java.util.HashMap<>();
        for (Map.Entry<String, List<ExerciseEntity>> entry : byGroup.entrySet()) {
            Integer targetSets = targetSetsByGroup.get(entry.getKey());
            if (targetSets == null) {
                continue; // no log row for this group — caller keeps the template count
            }
            List<ExerciseEntity> groupExercises = entry.getValue();
            int exerciseCount = groupExercises.size();
            if (exerciseCount == 0) {
                continue;
            }
            if (targetSets <= exerciseCount) {
                // Can't sum below exerciseCount with a >=1 floor per exercise (degenerate).
                groupExercises.forEach(e -> out.put(e.getId(), 1));
                continue;
            }
            int templateSum = groupExercises.stream().mapToInt(ExerciseEntity::getWorkingSets).sum();
            int remaining = targetSets - exerciseCount; // reserve 1 set/exercise up front
            Map<UUID, Integer> extra = new java.util.HashMap<>();
            Map<UUID, Double> fraction = new java.util.HashMap<>();
            if (templateSum <= 0) {
                // No template signal to weigh by — split the remainder as evenly as possible.
                int base = remaining / exerciseCount;
                int evenRemainder = remaining % exerciseCount;
                int idx = 0;
                for (ExerciseEntity e : groupExercises) {
                    extra.put(e.getId(), base + (idx < evenRemainder ? 1 : 0));
                    idx++;
                }
            } else {
                int distributedExtra = 0;
                for (ExerciseEntity e : groupExercises) {
                    double exact = remaining * (double) e.getWorkingSets() / templateSum;
                    int floor = (int) Math.floor(exact);
                    extra.put(e.getId(), floor);
                    fraction.put(e.getId(), exact - floor);
                    distributedExtra += floor;
                }
                // Largest-remainder: hand out what floor-rounding left on the table, one set at a
                // time, to the biggest fractional share (ties -> bigger template workingSets, then
                // stable list order).
                int leftover = remaining - distributedExtra;
                List<ExerciseEntity> byFractionDesc = groupExercises.stream()
                    .sorted(Comparator.<ExerciseEntity>comparingDouble(e -> fraction.get(e.getId()))
                        .reversed()
                        .thenComparing(Comparator.comparingInt(ExerciseEntity::getWorkingSets).reversed()))
                    .toList();
                for (int i = 0; i < leftover; i++) {
                    extra.merge(byFractionDesc.get(i).getId(), 1, Integer::sum);
                }
            }
            groupExercises.forEach(e -> out.put(e.getId(), 1 + extra.get(e.getId())));
        }
        return out;
    }

    /**
     * "Last week" reference per exercise: the TOP working set (max weight) of the most recent
     * COMPLETED session where the exercise's IDENTITY was trained — identity-resolved
     * (mezo-eq4w) so a day edit's row swap never blanks the comparison line.
     */
    private Map<UUID, LastWeekRef> lastWeekRefs(UUID createdBy, List<ExerciseEntity> exercises) {
        Map<UUID, LastWeekRef> out = new java.util.HashMap<>();
        historyResolver.latestCompletedWorkingSets(createdBy, exercises).forEach((exId, sets) -> sets.stream()
            .filter(s -> s.getWeightKg() != null && s.getReps() != null && s.getRir() != null)
            .max(java.util.Comparator.comparing(ExerciseSetEntity::getWeightKg))
            .ifPresent(top -> out.put(exId, toLastWeekRef(top))));
        return out;
    }

    private LastWeekRef toLastWeekRef(ExerciseSetEntity set) {
        return LastWeekRef.builder()
            .weightKg(set.getWeightKg())
            .reps(set.getReps())
            .rir(set.getRir())
            .build();
    }

    @Transactional
    public WorkoutInstanceResponse startWorkout(UUID createdBy, WorkoutStartRequest req) {
        WorkoutSessionEntity template = workoutSessionRepository.findById(req.getTemplateSessionId())
            .filter(s -> createdBy.equals(s.getCreatedBy()) && s.getTemplateSessionId() == null)
            .orElseThrow(WorkoutService::notFound);
        // Spec rule: an open instance is resumed, never duplicated.
        WorkoutSessionEntity open = workoutSessionRepository
            .findFirstByCreatedByAndTemplateSessionIdAndStatusOrderByDateDescCreatedAtDesc(
                createdBy, template.getId(), "active")
            .orElse(null);
        if (open != null) {
            return toInstanceResponse(createdBy, open);
        }
        // Cross-day guards (mezo-p7rp): one open workout at a time (D6) and one completion
        // per template day per Mon–Sun week (D5) — the FE hides the CTA, this is the backstop
        // — D5 skipped for custom (saját) templates (mezo-ws2x).
        if (workoutSessionRepository
            .findFirstByCreatedByAndStatusAndTemplateSessionIdIsNotNullOrderByDateDescCreatedAtDesc(
                createdBy, "active").isPresent()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("TRAIN_WORKOUT_OPEN_ELSEWHERE").build(), HttpStatus.CONFLICT);
        }
        // D5 is plan-adherence: a custom (saját) template is repeatable any time (mezo-ws2x).
        if (!"custom".equals(template.getOrigin()) && completedThisWeek(createdBy, template.getId()) != null) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("TRAIN_DAY_DONE_THIS_WEEK").build(), HttpStatus.CONFLICT);
        }
        WorkoutSessionEntity instance = new WorkoutSessionEntity();
        instance.setCreatedBy(createdBy); // server-side ownership — never from the client
        instance.setMesocycleId(template.getMesocycleId());
        instance.setOrigin(template.getOrigin());
        instance.setTemplateSessionId(template.getId());
        instance.setDayLabel(template.getDayLabel());
        instance.setType(template.getType());
        instance.setMuscle(template.getMuscle());
        instance.setMuscleAccent(template.isMuscleAccent());
        instance.setDurationEst(template.getDurationEst());
        instance.setOrderIndex(template.getOrderIndex());
        instance.setDate(LocalDate.now());
        instance.setStatus("active");
        return toInstanceResponse(createdBy, workoutSessionRepository.save(instance));
    }

    @Transactional
    public ExerciseSetResponse logSet(UUID createdBy, UUID workoutId, SetLogRequest req) {
        WorkoutSessionEntity instance = ownedInstanceOrThrow(createdBy, workoutId);
        if (!"active".equals(instance.getStatus())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("TRAIN_WORKOUT_NOT_ACTIVE").build(), HttpStatus.CONFLICT);
        }
        // The exercise must hang off the instance's template day — child writes verify the chain.
        exerciseRepository.findById(req.getExerciseId())
            .filter(e -> createdBy.equals(e.getCreatedBy())
                && instance.getTemplateSessionId().equals(e.getWorkoutSessionId()))
            .orElseThrow(WorkoutService::notFound);
        ExerciseSetEntity set = new ExerciseSetEntity();
        set.setCreatedBy(createdBy);
        set.setExerciseId(req.getExerciseId());
        set.setWorkoutSessionId(instance.getId());
        set.setSetIndex(req.getSetIndex());
        set.setWeightKg(req.getWeightKg());
        set.setReps(req.getReps());
        set.setRir(req.getRir());
        set.setSide(req.getSide());
        set.setNote(req.getNote());
        set.setKind(req.getKind() != null ? req.getKind() : "working");
        set.setDoneAt(Instant.now());
        set.setTargetWeightKg(req.getTargetWeightKg());
        set.setTargetReps(req.getTargetReps());
        ExerciseSetEntity saved = exerciseSetRepository.save(set);
        exerciseSetRepository.flush(); // the replay reads through the repository — the row must be visible
        ExerciseSetResponse response = mapper.toSetResponse(saved);
        // Medals are derived and purely decorative (mezo-wp6n) — the set write above is the user's
        // real data and must survive a failure in the replay-derivation that follows it. Degrade to
        // "no medals for this set" rather than let the @Transactional method roll back the log.
        try {
            response.setMedals(medalService.forSet(createdBy, saved.getId()));
        } catch (RuntimeException e) {
            log.warn("Medal derivation failed for set {} — logging the set anyway", saved.getId(), e);
            response.setMedals(List.of());
        }
        return response;
    }

    /**
     * Overwrite one logged set's performance fields in an ACTIVE instance (mezo-l3on). Full
     * replacement, not a patch: an absent optional field clears it (spec D7). {@code setIndex},
     * {@code kind}, {@code exerciseId} and the {@code target*} prescription snapshot are immutable —
     * they describe WHICH slot this is and what was prescribed for it, not what the user did.
     */
    @Transactional
    public ExerciseSetResponse updateSet(UUID createdBy, UUID workoutId, UUID setId, SetUpdateRequest req) {
        ExerciseSetEntity set = ownedActiveSetOrThrow(createdBy, workoutId, setId);
        set.setWeightKg(req.getWeightKg());
        set.setReps(req.getReps());
        // Warmup sets carry no RIR (mirrors logSet) — effort tracking is working-set-only.
        set.setRir("warmup".equals(set.getKind()) ? null : req.getRir());
        set.setSide(req.getSide());
        set.setNote(req.getNote());
        ExerciseSetEntity saved = exerciseSetRepository.save(set);
        exerciseSetRepository.flush(); // the medal replay reads through the repository
        ExerciseSetResponse response = mapper.toSetResponse(saved);
        // Same rationale as logSet: medals are derived and decorative, the user's edit must survive
        // a failure in the replay-derivation that follows it.
        try {
            response.setMedals(medalService.forSet(createdBy, saved.getId()));
        } catch (RuntimeException e) {
            log.warn("Medal derivation failed for updated set {} — keeping the update", saved.getId(), e);
            response.setMedals(List.of());
        }
        return response;
    }

    /**
     * Soft-delete one logged set of an ACTIVE instance and RENUMBER the exercise's remaining sets to
     * 0..n-1 (mezo-l3on, spec D5). The frontend cursor is positional ({@code logged.length}) and
     * {@code seedFromOpen} assumes contiguous indices, so a gap would make the next logged set
     * collide with an existing index.
     */
    @Transactional
    public void deleteSet(UUID createdBy, UUID workoutId, UUID setId) {
        ExerciseSetEntity set = ownedActiveSetOrThrow(createdBy, workoutId, setId);
        UUID exerciseId = set.getExerciseId();
        exerciseSetRepository.delete(set); // @SQLDelete → soft delete
        exerciseSetRepository.flush();
        List<ExerciseSetEntity> remaining = exerciseSetRepository
            .findByCreatedByAndWorkoutSessionIdAndExerciseIdOrderBySetIndexAsc(createdBy, workoutId, exerciseId);
        for (int i = 0; i < remaining.size(); i++) {
            remaining.get(i).setSetIndex(i);
        }
        exerciseSetRepository.saveAll(remaining);
        exerciseSetRepository.flush();
    }

    /**
     * Shared guard for the set-level writes: owned instance, still {@code active}, and a set row that
     * belongs to THIS instance and is not a whole-exercise skip marker. Mirrors {@link #logSet}'s
     * chain-verification; a skip marker is not a logged set, so it is addressable only through the
     * skip flow.
     */
    private ExerciseSetEntity ownedActiveSetOrThrow(UUID createdBy, UUID workoutId, UUID setId) {
        WorkoutSessionEntity instance = ownedInstanceOrThrow(createdBy, workoutId);
        if (!"active".equals(instance.getStatus())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("TRAIN_WORKOUT_NOT_ACTIVE").build(), HttpStatus.CONFLICT);
        }
        return exerciseSetRepository.findById(setId)
            .filter(s -> createdBy.equals(s.getCreatedBy())
                && instance.getId().equals(s.getWorkoutSessionId())
                && !s.isSkipped())
            .orElseThrow(WorkoutService::notFound);
    }

    /**
     * Skip a whole exercise in an active instance: persist a skip-marker {@link ExerciseSetEntity}
     * (skipped=true, no performance fields). Mirrors {@link #logSet}'s guards — owned active
     * instance + exercise must hang off the instance's template day. A skip marker is NOT a logged
     * set: it carries the next free set index but does not flip the gym done-state (see
     * {@link WorkoutSessionRepository#findDoneInstanceDates}).
     */
    @Transactional
    public void skipExercise(UUID createdBy, UUID workoutId, UUID exerciseId) {
        WorkoutSessionEntity instance = ownedInstanceOrThrow(createdBy, workoutId);
        if (!"active".equals(instance.getStatus())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("TRAIN_WORKOUT_NOT_ACTIVE").build(), HttpStatus.CONFLICT);
        }
        // The exercise must hang off the instance's template day — child writes verify the chain.
        exerciseRepository.findById(exerciseId)
            .filter(e -> createdBy.equals(e.getCreatedBy())
                && instance.getTemplateSessionId().equals(e.getWorkoutSessionId()))
            .orElseThrow(WorkoutService::notFound);
        // Idempotent: a skip marker already present for this (instance, exercise) is a no-op
        // (mirrors saveFeedback's find-or-create intent — no duplicate marker rows).
        List<ExerciseSetEntity> instanceSets = exerciseSetRepository
            .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, instance.getId());
        boolean alreadySkipped = instanceSets.stream()
            .anyMatch(s -> s.getExerciseId().equals(exerciseId) && s.isSkipped());
        if (alreadySkipped) {
            return;
        }
        int nextIndex = (int) instanceSets.stream()
            .filter(s -> s.getExerciseId().equals(exerciseId))
            .count();
        ExerciseSetEntity marker = new ExerciseSetEntity();
        marker.setCreatedBy(createdBy); // server-side ownership — never from the client
        marker.setExerciseId(exerciseId);
        marker.setWorkoutSessionId(instance.getId());
        marker.setSetIndex(nextIndex);
        marker.setSkipped(true); // marker, not a logged set: perf fields stay null
        marker.setDoneAt(Instant.now());
        exerciseSetRepository.save(marker);
    }

    @Transactional
    public void saveFeedback(UUID createdBy, UUID workoutId, List<WorkoutFeedbackInput> items) {
        WorkoutSessionEntity instance = ownedInstanceOrThrow(createdBy, workoutId);
        // Batch: the template day's exercises + this instance's existing feedback rows are each
        // loaded ONCE (was findById + findBy... + save per item — 2N+N round-trips).
        Set<UUID> dayExerciseIds = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(
                createdBy, List.of(instance.getTemplateSessionId())).stream()
            .map(ExerciseEntity::getId)
            .collect(Collectors.toSet());
        Map<UUID, ExerciseFeedbackEntity> byExercise = exerciseFeedbackRepository
            .findByCreatedByAndWorkoutSessionId(createdBy, instance.getId()).stream()
            .collect(Collectors.toMap(ExerciseFeedbackEntity::getExerciseId, f -> f));
        List<ExerciseFeedbackEntity> rows = new ArrayList<>(items.size());
        for (WorkoutFeedbackInput in : items) {
            // The exercise must hang off the instance's template day — child writes verify the chain.
            if (!dayExerciseIds.contains(in.getExerciseId())) {
                throw notFound();
            }
            // Upsert per (instance, exercise) — the DB UNIQUE backs this invariant.
            ExerciseFeedbackEntity row = byExercise.computeIfAbsent(in.getExerciseId(), exId -> {
                ExerciseFeedbackEntity f = new ExerciseFeedbackEntity();
                f.setCreatedBy(createdBy);
                f.setWorkoutSessionId(instance.getId());
                f.setExerciseId(exId);
                return f;
            });
            row.setPump(in.getPump());
            row.setJointPain(in.getJointPain());
            row.setWorkload(in.getWorkload());
            rows.add(row);
        }
        exerciseFeedbackRepository.saveAll(rows);
    }

    /**
     * Set the durable per-exercise note (F4) — preloaded on the next session via {@link #getToday}.
     * Owner-scoped write; a foreign or missing exercise is a 404. A null/blank note clears it.
     */
    @Transactional
    public void saveExerciseNote(UUID createdBy, UUID exerciseId, String note) {
        ExerciseEntity exercise = exerciseRepository.findById(exerciseId)
            .filter(e -> createdBy.equals(e.getCreatedBy()))
            .orElseThrow(WorkoutService::notFound);
        exercise.setNote(note);
        exerciseRepository.save(exercise);
    }

    /**
     * The workout-level closing note (mezo-d20.8.2.2) — last-write-wins, blank clears, mirroring
     * {@link #saveExerciseNote}. This is the review page's write path, so a note can be corrected
     * or added long after the session was finished.
     */
    @Transactional
    public void saveClosingNote(UUID createdBy, UUID workoutId, String note) {
        WorkoutSessionEntity instance = ownedInstanceOrThrow(createdBy, workoutId);
        instance.setClosingNote(blankToNull(note));
        workoutSessionRepository.save(instance);
    }

    private static String blankToNull(String note) {
        return note == null || note.isBlank() ? null : note;
    }

    @Transactional
    public WorkoutInstanceResponse finishWorkout(UUID createdBy, UUID workoutId, String closingNote) {
        WorkoutSessionEntity instance = ownedInstanceOrThrow(createdBy, workoutId);
        if ("active".equals(instance.getStatus())) {
            instance.setStatus("completed"); // dirty-checked, flushed at commit
        }
        // FILL-IF-EMPTY, like closeMesocycle's self-eval: finishing is contractually idempotent, so
        // a re-finish (or a bodyless retry after a failed one) must never erase what was written.
        // Overwriting and clearing are the note endpoint's job, not this one's.
        String incoming = blankToNull(closingNote);
        if (incoming != null && blankToNull(instance.getClosingNote()) == null) {
            instance.setClosingNote(incoming);
        }
        WorkoutInstanceResponse base = toInstanceResponse(createdBy, instance);
        // Progression runs ONLY when the feature switch is on (gate bean present) and only here in
        // finishWorkout — never via the shared toInstanceResponse, so start/resume stay levelUp-free.
        // Atomic with the completion (same @Transactional); applyGym is idempotent on the instance id,
        // so a re-finish returns the stored payload without double-awarding.
        if (progressionGate.getIfAvailable() != null) {
            GymSignal signal = gymSignalCalculator.compute(createdBy, instance.getId());
            base.setLevelUp(levelUpResultMapper.toDto(progressionService.applyGym(createdBy, signal)));
        }
        // Same rationale as logSet above: medals are derived and decorative, the finish/completion
        // write must not roll back because the medal replay blew up.
        try {
            base.setMedals(medalService.forSession(createdBy, instance.getId()));
        } catch (RuntimeException e) {
            log.warn("Medal derivation failed for session {} — finishing the workout anyway",
                instance.getId(), e);
            base.setMedals(List.of());
        }
        return base;
    }

    /** Instance gate: owned AND an instance row (template rows are not loggable targets). */
    private WorkoutSessionEntity ownedInstanceOrThrow(UUID createdBy, UUID workoutId) {
        return workoutSessionRepository.findById(workoutId)
            .filter(s -> createdBy.equals(s.getCreatedBy()) && s.getTemplateSessionId() != null)
            .orElseThrow(WorkoutService::notFound);
    }

    private WorkoutInstanceResponse toInstanceResponse(UUID createdBy, WorkoutSessionEntity instance) {
        return WorkoutInstanceResponse.builder()
            .id(instance.getId())
            .templateSessionId(instance.getTemplateSessionId())
            .date(instance.getDate())
            .status(WorkoutInstanceResponse.StatusEnum.fromValue(instance.getStatus()))
            .sets(exerciseSetRepository
                .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, instance.getId())
                .stream().map(mapper::toSetResponse).toList())
            .build();
    }

    /** Ownership gate: a missing row and a foreign row are indistinguishable to the caller (404). */
    private static SystemRuntimeErrorException notFound() {
        return OwnershipGuard.notFound();
    }
}
