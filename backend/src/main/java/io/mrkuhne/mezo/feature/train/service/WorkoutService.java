package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.ExerciseSetResponse;
import io.mrkuhne.mezo.api.dto.LastWeekRef;
import io.mrkuhne.mezo.api.dto.OverloadSummary;
import io.mrkuhne.mezo.api.dto.PrescribedSet;
import io.mrkuhne.mezo.api.dto.SetLogRequest;
import io.mrkuhne.mezo.api.dto.SetUpdateRequest;
import io.mrkuhne.mezo.api.dto.TodayComeback;
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
import io.mrkuhne.mezo.feature.train.config.TimingProperties;
import io.mrkuhne.mezo.feature.train.config.TrainTechniqueProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.service.CatalogMediaResolver.CatalogMedia;
import io.mrkuhne.mezo.feature.train.entity.ExerciseFeedbackEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetLegEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.mapper.TrainMapper;
import io.mrkuhne.mezo.feature.train.repository.ExerciseFeedbackRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutDayAdjustmentRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
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
import org.springframework.context.ApplicationEventPublisher;
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

    /** Zone of the kímélő-mód date lookups — the same one the recovery services use. */
    private static final ZoneId RECOVERY_TZ = ZoneId.of("Europe/Budapest");

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
    // Hypertrophy Drive (P1): the recommendation engine + its feature gate. The gate bean exists ONLY
    // when mezo.feature.hypertrophy-drive.enabled=true, so an absent provider ⇔ switch off;
    // off ⇒ getToday attaches no prescribedSets and the FE falls back to the logger.
    private final SetRecommendationService setRecommendationService;
    private final ExerciseHistoryResolver historyResolver;
    private final WeightGapService weightGapService;
    private final ObjectProvider<HypertrophyDriveGate> hypertrophyGate;
    // Fix zárás (mezo-z2ul): lazy closing-exercise ensure behind its own switch. The gate bean
    // exists ONLY when mezo.feature.closing-block.enabled=true (mirrors hypertrophyGate).
    private final ClosingBlockService closingBlockService;
    private final ObjectProvider<ClosingBlockGate> closingBlockGate;
    // Session flow fix (mezo-cd8s): lazily settle abandoned instances at the top of getToday — its
    // own @Transactional bean (getToday is a read), always on (no feature gate).
    private final WorkoutAutoCloseService workoutAutoCloseService;
    // Éves terv (mezo-r36n9.113): a due planned block starts on its day — own @Transactional bean, run first.
    private final PlannedBlockStarter plannedBlockStarter;
    // Volume Progression (Plan 2 Phase A, mezo-hi9m): weekly per-muscle set-target rollover + the
    // ledger sync. The gate bean exists ONLY when
    // mezo.feature.volume-progression.enabled=true (mirrors hypertrophyGate/closingBlockGate).
    private final VolumeProgressionService volumeProgressionService;
    private final ObjectProvider<VolumeProgressionGate> volumeGate;
    // Medal collection (mezo-wp6n): derived-medal replay, read-only consumer of the frozen
    // MedalService — attaches the medals a set/session just earned to the logSet/finishWorkout
    // responses. No feature gate: medals are always-on (mirrors ExerciseRecordService).
    private final MedalService medalService;
    private final SetLegService setLegService;
    // Actual-duration measurement (mezo-1jm8): gap/lead-in caps consumed when finishWorkout
    // derives activeSeconds from the session's logged set timestamps.
    private final TimingProperties timingProperties;
    // Learned workout-timing profile (mezo-dzbm): finishWorkout publishes WorkoutFinishedEvent
    // (below) instead of calling TimingProfileService directly — a REQUIRED-joined call cannot
    // survive a failure inside it without poisoning THIS transaction (proven, not assumed: Spring
    // marks a participating transaction rollback-only on any exception from a joined
    // @Transactional callee, DB-touching or not), so the failure-isolation this feature needs has
    // to come from running AFTER this transaction commits, not from a try/catch inside it. See
    // TimingProfileListener (AFTER_COMMIT + @Async, the ChatTurnCompleted/FactExtractionListener
    // idiom) — gated on the switch there, not here (mirrors ChatService, which publishes
    // ChatTurnCompleted unconditionally too).
    private final ApplicationEventPublisher eventPublisher;
    // Proactive coaching S5 (mezo-d58h.5): per-date lighten overlay on the row's own working_sets.
    private final WorkoutDayAdjustmentRepository workoutDayAdjustmentRepository;
    // Check-in 2.0 readiness (mezo-ck2): the day's „Könnyítsük" overlay — every prescription capped
    // at HOLD, and the pain-loaded (care) exercises drop their heavy sets. Read-time only.
    private final ReadinessAssessor readinessAssessor;
    // Kihagyás S1 (mezo-q4xt2.1): "is a gym day planned?" reads honour a gym skip. Does NOT
    // depend on WorkoutService — no cycle.
    private final PlannedSkipService plannedSkipService;
    // Kihagyás S2 kímélő mód (mezo-q4xt2.2): the comeback ramp + released-day lightening, read at
    // getToday time from the period rows. Repository-only bean — no cycle.
    private final RecoveryPeriodService recoveryPeriodService;
    // Training style (mezo-r36n9.79): the per-exercise style context and the batched catalog stability.
    private final ExerciseStyler exerciseStyler;
    private final TrainTechniqueProperties trainTechniqueProperties;
    private final TechniqueWeights techniqueWeights;
    private final PartialsBest partialsBest;
    private final CatalogAttributes catalogAttributes;
    // Weekly pin (volume engine v2 S3): kept weight/rep lines of this week's proposal hold that exercise.
    private final WeeklyPin weeklyPin;
    private final io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository sportScheduleSlotRepository;

    /**
     * Today's kímélő-mód lightening (spec §9.1.4 / §9.1.6): the DTO shown on the hero, plus the
     * prescription knobs — a load factor (null = none) and whether the progression is held.
     * Every lightened session also drops a third of its sets and floors RIR at 3.
     */
    private record Comeback(TodayComeback dto, BigDecimal loadFactor, boolean holdOnly) {}

    /**
     * RELEASED when today is released from the open period with lightening kept; else RAMP while
     * the latest ended period (not waived, no period open) still has ramp sessions left — index =
     * sessions completed from its end up to yesterday + 1, so a session completed today keeps
     * showing as the one it was. Index 1 (and a released day) → ≈90% load; index 2 → hold.
     */
    private Comeback comebackFor(UUID createdBy, LocalDate today) {
        var open = recoveryPeriodService.open(createdBy);
        if (open.isPresent()) {
            boolean released = recoveryPeriodService.release(createdBy, today)
                .filter(r -> r.isLighten() && r.getPeriodId().equals(open.get().getId()))
                .isPresent();
            return released
                ? new Comeback(new TodayComeback().index(1).total(1).mode(TodayComeback.ModeEnum.RELEASED),
                    ComebackRamp.LOAD_FACTOR, false)
                : null;
        }
        return recoveryPeriodService.latestEnded(createdBy)
            .filter(p -> !p.isComebackWaived())
            .map(p -> {
                int total = RecoveryReturnPolicy.decide(p.getStartDate(), p.getEndedOn()).rampSessions();
                int index = recoveryPeriodService.comebackSessionsDone(p, today.minusDays(1)) + 1;
                if (index > total) {
                    return null;
                }
                TodayComeback dto = new TodayComeback().index(index).total(total).mode(TodayComeback.ModeEnum.RAMP);
                return index == 1
                    ? new Comeback(dto, ComebackRamp.LOAD_FACTOR, false)
                    : new Comeback(dto, null, true);
            })
            .orElse(null);
    }

    public WorkoutTodayResponse getToday(UUID createdBy, UUID templateSessionId) {
        // Settle abandoned instances FIRST (own @Transactional bean — getToday is a read):
        // after this, only a today-dated instance can be 'active', so the open-instance
        // lookup below can never resurrect last week's abandoned session. Runs before the
        // meso lookup so stale instances settle even when there is no active meso.
        // Before both: a planned block due today becomes the active one (season gate permitting).
        plannedBlockStarter.startDue(createdBy);
        workoutAutoCloseService.autoCloseStale(createdBy);
        WorkoutTodayResponse empty = new WorkoutTodayResponse();
        empty.setWeekDoneDates(List.of());
        MesocycleEntity activeMeso = mesocycleRepository
            .findByCreatedByAndStatusAndDeletedFalse(createdBy, "active")
            .stream().findFirst().orElse(null);
        // Volume progression (mezo-hi9m): lazy weekly rollover, own @Transactional bean — mutates
        // activeMeso in place (currentWeek/volumeRecompute; the week's set changes go to the
        // exercise rows and the derived ledger), so no re-read is needed. MUST run before deloadWeek below (reads activeMeso.currentWeek).
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
        WorkoutSessionEntity day;
        if (open != null) {
            day = ownedTemplateOrThrow(createdBy, open.getTemplateSessionId());
        } else if (templateSessionId != null) {
            day = ownedTemplateOrThrow(createdBy, templateSessionId);
        } else if (activeMeso != null) {
            List<WorkoutSessionEntity> mesoSessions = workoutSessionRepository
                .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(activeMeso.getId()));
            day = findPlannedTemplateForDate(mesoSessions, LocalDate.now()).orElse(null);
        } else {
            day = null;
        }
        if (day == null) {
            return empty;
        }
        List<ExerciseEntity> templateRows = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, List.of(day.getId()));
        if (templateRows.isEmpty()) {
            return empty; // rest day
        }
        // Mid-workout swap/add (mezo-mobji): the open instance's own rows, placed and filtered by
        // the shared assembler; with no open instance the template passes through unchanged.
        List<SessionExerciseAssembler.Entry> entries = open != null
            ? assembleInstance(createdBy, open, templateRows)
            : SessionExerciseAssembler.assemble(null, templateRows, List.of(), List.of(), Map.of(), Set.of());
        List<ExerciseEntity> exercises = entries.stream().map(SessionExerciseAssembler.Entry::row).toList();
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
        // The plan is the amount (volume engine v2, spec §6.1): each exercise prescribes its own
        // working_sets. Overlays follow in a fixed order — per-date lighten delta (looked up ONCE
        // for today's date), comeback ramp, readiness care.
        int dayDelta = workoutDayAdjustmentRepository
            .findByCreatedByAndDateAndDeletedFalse(createdBy, LocalDate.now())
            .map(a -> (int) a.getSetDelta())
            .orElse(0);
        // Readiness „Könnyítsük" (mezo-ck2): present only when the user chose LIGHTEN for today.
        // Care exercise id → the pain region that flagged it. Undo deletes the choice, so the next
        // read prescribes normally again; logged sets are never touched (targets are per request).
        Optional<Map<UUID, String>> lighten = readinessAssessor.lightening(createdBy, LocalDate.now(), exercises);
        // Kímélő mód (mezo-q4xt2.2): comeback ramp / released day — read-time only, like dayDelta;
        // writes no workout_day_adjustment row. The readiness care override below still wins.
        Comeback comeback = comebackFor(createdBy, LocalDate.now(RECOVERY_TZ));
        // Training style (mezo-r36n9.79): only a day of the active run carries the run's style — a
        // custom workout is never styled. One batched stability read for the whole day (none unstyled).
        TrainingStyle runStyle = activeMeso != null && activeMeso.getId().equals(day.getMesocycleId())
            ? TrainingStyle.fromWire(activeMeso.getTrainingStyle()) : null;
        CatalogAttributes.Lookup stability = exerciseStyler.lookupRows(exercises, runStyle != null);
        boolean techniquesOn = activeMeso != null && activeMeso.isTechniquesEnabled()
            && activeMeso.getId().equals(day.getMesocycleId());
        // The rules are checked on write, but catalog attributes can change later (an edited row, a deploy's
        // catalog reload, a template start): re-check the picks at prescription time, one batched read.
        Set<UUID> invalidPicks = techniquesOn ? invalidPicks(entries) : Set.of();
        Set<UUID> sportSuppressed = techniquesOn ? sportDaySuppressed(createdBy, activeMeso, entries) : Set.of();
        // Weekly pin (volume engine v2 S3, spec §6.4): a weight/rep line he kept in this week's proposal holds
        // that exercise at last week's load — the same hold-only knob readiness and the comeback use. Only on
        // a day of the active run, with the engine and the prescription on; failure-isolated (unpinned).
        Set<UUID> pinned = activeMeso != null && activeMeso.getId().equals(day.getMesocycleId())
                && volumeGate.getIfAvailable() != null && hypertrophyGate.getIfAvailable() != null
            ? weeklyPin.pinnedRows(createdBy, activeMeso, day, exercises) : Set.of();
        LocalDate today = LocalDate.now();
        int weightUp = 0;
        int weightDown = 0;
        int repUp = 0;
        int hold = 0;
        List<TodayExercise> mapped = new ArrayList<>();
        for (SessionExerciseAssembler.Entry entry : entries) {
            ExerciseEntity e = entry.row();
            TodayExercise t = mapper.toTodayExercise(e);
            StyleContext style = runStyle == null ? StyleContext.NONE
                : exerciseStyler.context(e, runStyle, activeMeso.getCurrentWeek(), activeMeso.getPhaseCurve(),
                    stability);
            t.setEffectiveTrainingStyle(
                exerciseStyler.effective(e.getTrainingStyle(), e.getType(), e.getCatalogId(), runStyle, stability,
                    e.isCountsTowardVolume()));
            t.setChangeScope(entry.changeScope() == null ? null
                : TodayExercise.ChangeScopeEnum.fromValue(entry.changeScope()));
            t.setReplacesName(entry.replacesName());
            t.setReplacedByName(entry.replacedByName());
            t.setPlanSlot(entry.planSlot());
            t.setLastWeek(lastWeek.get(e.getId()));
            if (e.getCatalogId() != null) {
                CatalogMedia m = mediaByCatalog.get(e.getCatalogId());
                if (m != null) {
                    t.setVideoUrl(m.videoUrl());
                    t.setImageStartUrl(m.imageStartUrl());
                    t.setImageEndUrl(m.imageEndUrl());
                }
            }
            int effective;
            if (entry.workingSetsOverride() != null) {
                effective = Math.max(1, entry.workingSetsOverride()); // swapped out: only what was logged
            } else {
                if (entry.changeScope() != null) {
                    effective = e.getWorkingSets(); // a row changed today already carries today's count
                } else {
                    effective = Math.max(1, e.getWorkingSets() + dayDelta);
                    // Ramp lightening only on the planned count — a swapped / changed-today row
                    // carries a count that is already today's (no double lightening).
                    if (comeback != null) {
                        effective = ComebackRamp.lightenedSets(effective);
                    }
                }
            }
            String careRegion = lighten.map(m -> m.get(e.getId())).orElse(null);
            if (careRegion != null) {
                effective = 1; // the heavy working sets drop — one light working set remains
            }
            t.setWorkingSets(effective);
            if (hypertrophyGate.getIfAvailable() != null) {
                Prescription p = comeback == null
                    ? setRecommendationService.prescribe(createdBy, e, new SetRecommendationService.PrescribeOptions(
                        deloadWeek, effective, lighten.isPresent() || pinned.contains(e.getId()), null, 0, style,
                        today))
                    : setRecommendationService.prescribe(createdBy, e, new SetRecommendationService.PrescribeOptions(
                        deloadWeek, effective, lighten.isPresent() || comeback.holdOnly() || pinned.contains(e.getId()),
                        // A deload week already lightens the load — no extra ×0.9 on top; the set
                        // reduction and the RIR floor stay.
                        deloadWeek ? null : comeback.loadFactor(),
                        ComebackRamp.rirFloor(null), style, today));
                if (careRegion != null) {
                    p = lightCareSet(p, careRegion);
                }
                // Technique overlay (mezo-r36n9.80): a flagged run only. A gentle day (comeback, or a readiness
                // lighten — which also covers every care-lightened row), a deload week and a pick the catalog no
                // longer allows carry neither technique nor challenge; the echo then says so too (the stored plan
                // is untouched).
                if (techniquesOn) {
                    if (comeback != null || lighten.isPresent() || deloadWeek || invalidPicks.contains(e.getId())) {
                        t.setTechnique(null);
                        t.setTechniqueSource(null);
                        t.setChallenge(false);
                        t.setChallengeBest(null);
                    } else {
                        // Sport day: the challenge goes, a planner technique goes, an owner / ai technique stands
                        // — also when the same row carried both (mezo-r36n9.98).
                        boolean sport = sportSuppressed.contains(e.getId());
                        Technique technique = sport && "planner".equals(e.getTechniqueSource())
                            ? Technique.NONE : Technique.fromWire(e.getTechnique());
                        boolean challenge = !sport && e.isChallenge();
                        if (sport) {
                            t.setChallenge(false);
                            t.setChallengeBest(null);
                            if (technique == Technique.NONE) {
                                t.setTechnique(null);
                                t.setTechniqueSource(null);
                            }
                        }
                        p = overlayTechnique(createdBy, e, technique, challenge, t, p, deloadWeek);
                    }
                }
                t.setPrescribedSets(p.sets());
                // The ramped reserve is an engine overlay: switch off ⇒ the row's stamped targetRir stands.
                if (style.styled()) {
                    t.setTargetRIR(style.effectiveReserve());
                }
                t.setRationale(p.rationale());
                t.setProgression(p.progression());
                if (p.progression() != null) {
                    var signal = p.progression();
                    switch (signal.getLever()) {
                        case WEIGHT -> {
                            // A null/zero deltaKg is currently unreachable here: ProgressionDecider's
                            // WEIGHT lever always moves to a real weight strictly above/below the
                            // reference (deltaKg = base − ref, mezo-bk7sn). If that ever
                            // changes, this deliberately falls through to weightUp so the tally total
                            // still matches the exercise count.
                            if (signal.getDeltaKg() != null && signal.getDeltaKg().signum() < 0) weightDown++;
                            else weightUp++;
                        }
                        case REP -> repUp++;
                        default -> hold++; // HOLD, DELOAD
                    }
                }
            }
            mapped.add(t);
        }
        OverloadSummary overloadSummary = hypertrophyGate.getIfAvailable() != null
            ? OverloadSummary.builder().weightUp(weightUp).weightDown(weightDown).repUp(repUp).hold(hold).build()
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
            .comeback(comeback == null ? null : comeback.dto())
            .build();
    }

    /**
     * Sport-day rule (mezo-r36n9.81, spec §11 Q4): on a day he has a sport slot, a row of a sport-loaded group
     * carries no challenge and no machine-sourced (planner / AI) technique (the owner's own technique stands). The slots are read
     * once, and only when some row of the day carries a challenge or a planner technique.
     */
    private Set<UUID> sportDaySuppressed(UUID createdBy, MesocycleEntity run,
                                         List<SessionExerciseAssembler.Entry> entries) {
        List<String> groups = run.getSportGroups();
        if (groups == null || groups.isEmpty()) {
            return Set.of();
        }
        List<ExerciseEntity> candidates = entries.stream().map(SessionExerciseAssembler.Entry::row)
            .filter(r -> (r.isChallenge() || TechniqueLines.machine(r.getTechniqueSource()))
                && groups.contains(MuscleGroup.of(r.getMuscle())))
            .toList();
        if (candidates.isEmpty()) {
            return Set.of();
        }
        int weekday = LocalDate.now().getDayOfWeek().getValue() - 1; // 0=Hét..6=Vas, as sport_schedule_slot
        boolean sportDay = sportScheduleSlotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(createdBy)
            .stream().anyMatch(sl -> sl.getDayOfWeek() == weekday);
        if (!sportDay) {
            return Set.of();
        }
        return candidates.stream().map(ExerciseEntity::getId).collect(java.util.stream.Collectors.toSet());
    }

    /** Rows whose stored pick no longer passes {@link TechniqueRules}; one catalog read, none without a pick. */
    private Set<UUID> invalidPicks(List<SessionExerciseAssembler.Entry> entries) {
        List<ExerciseEntity> picked = entries.stream().map(SessionExerciseAssembler.Entry::row)
            .filter(r -> Technique.fromWire(r.getTechnique()) != Technique.NONE || r.isChallenge()).toList();
        if (picked.isEmpty()) {
            return Set.of();
        }
        CatalogAttributes.AttrsLookup attrs = catalogAttributes.loadAttrs(
            picked.stream().map(ExerciseEntity::getCatalogId).toList());
        return picked.stream()
            .filter(r -> TechniqueRules.check(Technique.fromWire(r.getTechnique()), r.isChallenge(),
                attrs.of(r.getCatalogId())).isPresent())
            .map(ExerciseEntity::getId).collect(java.util.stream.Collectors.toSet());
    }

    /**
     * The technique and/or challenge overlay of one exercise (mezo-r36n9.80): after the plain prescription, on its
     * last working set — with both, the technique's legs first and the challenge's half reps last (mezo-r36n9.98).
     * Nothing is loaded for an exercise without a technique or a challenge. A challenge also carries the best
     * partials reps logged at the weight it is prescribed at, in the same setup (the same technique before the half
     * reps, or none).
     */
    private Prescription overlayTechnique(UUID createdBy, ExerciseEntity e, Technique technique, boolean challenge,
                                          TodayExercise t, Prescription p, boolean deloadWeek) {
        if (technique == Technique.NONE && !challenge) {
            return p;
        }
        BigDecimal maxKg = p.sets().stream().map(PrescribedSet::getTargetWeightKg)
            .filter(java.util.Objects::nonNull).max(BigDecimal::compareTo).orElse(null);
        boolean drops = technique == Technique.DROP || technique == Technique.REST_DROP;
        Set<BigDecimal> real = deloadWeek || !drops ? Set.of() : techniqueWeights.realWeights(createdBy, e, maxKg);
        Prescription out = TechniquePrescriber.apply(p, technique, challenge, deloadWeek, real,
            trainTechniqueProperties);
        if (challenge && !deloadWeek) {
            p.sets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING)
                .reduce((a, b) -> b)
                .ifPresent(last -> t.setChallengeBest(
                    partialsBest.at(createdBy, e, last.getTargetWeightKg(), technique)));
        }
        return out;
    }

    /**
     * Readiness care exercise (mezo-ck2): its heavy working sets are dropped — the one remaining
     * working set carries the top warm-up rung's weight (the lighter load the ramp already
     * computed), or keeps its held target when there is no weighted warm-up. The rationale names
     * the pain region.
     */
    private static Prescription lightCareSet(Prescription p, String region) {
        BigDecimal light = p.sets().stream()
            .filter(s -> s.getKind() == PrescribedSet.KindEnum.WARMUP && s.getTargetWeightKg() != null)
            .map(PrescribedSet::getTargetWeightKg)
            .max(BigDecimal::compareTo)
            .orElse(null);
        if (light != null) {
            p.sets().stream()
                .filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING)
                .forEach(s -> s.setTargetWeightKg(light));
        }
        String rationale = "Fáj a " + PainRegionMap.possessive(region)
            + " — a nehéz szettek kimaradnak, egy könnyebb munkaszett";
        if (p.progression() != null) {
            p.progression().setRationale(rationale);
            if (light != null) {
                p.progression().setTargetWeightKg(light);
            }
        }
        return new Prescription(p.sets(), rationale, p.progression());
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
        return findPlannedTemplateForDate(activeMesoSessions(createdBy), date);
    }

    /** Like {@link #findPlannedTemplateForDate} but empty when the user skipped that gym day
     *  (Kihagyás S1). The pure variant stays for getToday, so a skipped day still resolves for
     *  undo. No {@code @Transactional} — matches its sibling {@link #findPlannedTemplateForDate}. */
    public Optional<WorkoutSessionEntity> findPlannedTemplateForDateUnlessSkipped(UUID userId, LocalDate date) {
        return plannedSkipService.isGymSkipped(userId, date) ? Optional.empty() : findPlannedTemplateForDate(userId, date);
    }

    /**
     * The coarse muscle groups ({@link MuscleGroup#of}) the planned template for {@code date}
     * loads — the session's own muscle plus every planned exercise's. A pure READ over
     * {@link #findPlannedTemplateForDate} (never {@code getToday}, which writes); empty when no
     * session is planned that day. Check-in 2.0 follow-up C: the persistent-pain card offers
     * "lighten tomorrow" only when this overlaps the painful region's groups.
     */
    public Set<String> plannedMuscleGroups(UUID createdBy, LocalDate date) {
        return findPlannedTemplateForDate(createdBy, date)
            .map(session -> java.util.stream.Stream.concat(
                    java.util.stream.Stream.of(session.getMuscle()),
                    exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(
                        createdBy, List.of(session.getId())).stream().map(ExerciseEntity::getMuscle))
                .map(MuscleGroup::of)
                .filter(group -> group != null && !group.isBlank())
                .collect(Collectors.toUnmodifiableSet()))
            .orElse(Set.of());
    }

    /**
     * The active mesocycle's planned session rows, unbounded — the fetch {@link
     * #findPlannedTemplateForDate(UUID, LocalDate)} performs per date, extracted so a RANGE caller
     * (mezo-jcpt.6: {@code WorkoutWindowQueryService}'s ranged {@code windowsFor}) can fetch it ONCE
     * for a whole date span instead of once per date — this list is user-global, not date-scoped.
     * Empty (never null) when there is no active mesocycle, matching {@link
     * #findPlannedTemplateForDate(List, LocalDate)}'s no-match resolution over an empty list.
     */
    List<WorkoutSessionEntity> activeMesoSessions(UUID createdBy) {
        MesocycleEntity activeMeso = mesocycleRepository
            .findByCreatedByAndStatusAndDeletedFalse(createdBy, "active")
            .stream().findFirst().orElse(null);
        if (activeMeso == null) {
            return List.of();
        }
        return workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(activeMeso.getId()));
    }

    /**
     * Same resolution as {@link #findPlannedTemplateForDate(UUID, LocalDate)}, reusing a
     * caller-supplied meso session list — {@code getToday}'s shared-fetch path (mezo-dz9c item 4)
     * and the ranged {@code windowsFor} path above, avoiding a second query for rows already held.
     * Package-private (not {@code private}): {@code WorkoutWindowQueryService} (same package)
     * calls it directly per day over a pre-fetched list (mezo-jcpt.6).
     */
    Optional<WorkoutSessionEntity> findPlannedTemplateForDate(
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
        List<SessionExerciseAssembler.Entry> entries = assembleInstance(createdBy, instance,
            exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(
                createdBy, List.of(instance.getTemplateSessionId())));
        List<ExerciseSetEntity> instanceSets = exerciseSetRepository
            .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, instance.getId());
        Map<UUID, List<ExerciseSetEntity>> setsByExercise = instanceSets.stream()
            .collect(Collectors.groupingBy(ExerciseSetEntity::getExerciseId));
        Map<UUID, List<ExerciseSetLegEntity>> legsBySet = legsOf(instanceSets);
        return WorkoutDetailResponse.builder()
            .id(instance.getId())
            .templateSessionId(instance.getTemplateSessionId())
            .date(instance.getDate())
            .status(WorkoutDetailResponse.StatusEnum.fromValue(instance.getStatus()))
            .title(instance.getType())
            .dayLabel(instance.getDayLabel())
            .durationEst(instance.getDurationEst())
            .note(instance.getClosingNote())
            .startedAt(toOffsetDateTime(instance.getStartedAt()))
            .finishedAt(toOffsetDateTime(instance.getFinishedAt()))
            .activeSeconds(instance.getActiveSeconds())
            .exercises(entries.stream().map(entry -> {
                ExerciseEntity e = entry.row();
                List<ExerciseSetEntity> all = setsByExercise.getOrDefault(e.getId(), List.of());
                return WorkoutDetailExercise.builder()
                    .exerciseId(e.getId())
                    .name(e.getName())
                    .muscle(e.getMuscle())
                    .type(WorkoutDetailExercise.TypeEnum.fromValue(e.getType()))
                    .warmupSets(e.getWarmupSets())
                    .workingSets(entry.workingSetsOverride() != null ? entry.workingSetsOverride() : e.getWorkingSets())
                    .repMin(e.getRepMin())
                    .repMax(e.getRepMax())
                    .targetRIR(e.getTargetRir())
                    .skipped(all.stream().anyMatch(ExerciseSetEntity::isSkipped))
                    .sets(all.stream().filter(s -> !s.isSkipped())
                        .sorted(Comparator.comparingInt(ExerciseSetEntity::getSetIndex))
                        .map(st -> setResponse(st, legsBySet)).toList())
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
        // The wall clock starts here and only here. The resume branch above returns before this
        // point, so a mid-workout reload or an app restart can never restart the clock.
        instance.setStartedAt(Instant.now());
        return toInstanceResponse(createdBy, workoutSessionRepository.save(instance));
    }

    @Transactional
    public ExerciseSetResponse logSet(UUID createdBy, UUID workoutId, SetLogRequest req) {
        WorkoutSessionEntity instance = ownedInstanceOrThrow(createdBy, workoutId);
        if (!"active".equals(instance.getStatus())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("TRAIN_WORKOUT_NOT_ACTIVE").build(), HttpStatus.CONFLICT);
        }
        // The exercise must hang off the instance's template day or the instance itself (a row
        // swapped/added mid-workout, mezo-mobji) — child writes verify the chain.
        ExerciseEntity exercise = exerciseRepository.findById(req.getExerciseId())
            .filter(e -> belongsTo(createdBy, instance, e))
            .orElseThrow(WorkoutService::notFound);
        // Logged regardless of the block flag (log what he did); legs only fit a technique (mezo-r36n9.80).
        Technique technique = req.getTechnique() == null
            ? Technique.NONE : Technique.fromWire(req.getTechnique().getValue());
        String techniqueWire = technique == Technique.NONE ? null : technique.wire();
        if (technique != Technique.NONE && "warmup".equals(req.getKind())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("TRAIN_SET_TECHNIQUE_ON_WARMUP").build(), HttpStatus.BAD_REQUEST);
        }
        setLegService.validate(techniqueWire, req.getLegs());
        ExerciseSetEntity set = new ExerciseSetEntity();
        set.setTechnique(techniqueWire);
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
        // The trained range, snapshotted at create only (updateSet never touches it): the row's range
        // can later change or the row be soft-deleted, the set keeps what it was trained at.
        set.setTargetRepMin(exercise.getRepMin());
        set.setTargetRepMax(exercise.getRepMax());
        ExerciseSetEntity saved = exerciseSetRepository.save(set);
        exerciseSetRepository.flush(); // the replay reads through the repository — the row must be visible
        if (req.getLegs() != null && !req.getLegs().isEmpty()) {
            setLegService.replace(saved.getId(), req.getLegs()); // legs BEFORE the medal replay
        }
        if (hypertrophyGate.getIfAvailable() != null) {
            // Per-machine weight memory (mezo-bk7l2): heal this weight, learn a near-swapped gap.
            weightGapService.onLogged(createdBy, exercise, set.getKind(), req.getWeightKg(), req.getPrescribedWeightKg());
        }
        ExerciseSetResponse response = setResponse(saved, setLegService.legsBySetIds(List.of(saved.getId())));
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
        // legs: absent = untouched, [] = clear, list = replace; the technique itself is immutable (mezo-r36n9.80).
        setLegService.validate(set.getTechnique(), req.getLegs());
        set.setWeightKg(req.getWeightKg());
        set.setReps(req.getReps());
        // Warmup sets carry no RIR (mirrors logSet) — effort tracking is working-set-only.
        set.setRir("warmup".equals(set.getKind()) ? null : req.getRir());
        set.setSide(req.getSide());
        set.setNote(req.getNote());
        ExerciseSetEntity saved = exerciseSetRepository.save(set);
        exerciseSetRepository.flush(); // the medal replay reads through the repository
        if (req.getLegs() != null) {
            setLegService.replace(saved.getId(), req.getLegs()); // legs BEFORE the medal replay
        }
        if (hypertrophyGate.getIfAvailable() != null) {
            // An edit to a weight proves it exists on the machine (mezo-bk7l2) — heal only, never learn.
            exerciseRepository.findById(set.getExerciseId()).ifPresent(ex ->
                weightGapService.onLogged(createdBy, ex, set.getKind(), req.getWeightKg(), null));
        }
        ExerciseSetResponse response = setResponse(saved, setLegService.legsBySetIds(List.of(saved.getId())));
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
        // The exercise must hang off the instance's template day or the instance itself (mezo-mobji).
        exerciseRepository.findById(exerciseId)
            .filter(e -> belongsTo(createdBy, instance, e))
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
        // The instance's own exercise list (mezo-mobji): template day + rows swapped/added in this
        // instance + a swapped-out row that already carries sets.
        Set<UUID> dayExerciseIds = assembleInstance(createdBy, instance,
                exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(
                    createdBy, List.of(instance.getTemplateSessionId()))).stream()
            .map(en -> en.row().getId())
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
        boolean isRealTransition = "active".equals(instance.getStatus());
        if (isRealTransition) {
            instance.setStatus("completed"); // dirty-checked, flushed at commit
        }
        // FILL-IF-EMPTY, like closeMesocycle's self-eval: finishing is contractually idempotent, so
        // a re-finish (or a bodyless retry after a failed one) must never erase what was written.
        // Overwriting and clearing are the note endpoint's job, not this one's.
        String incoming = blankToNull(closingNote);
        if (incoming != null && blankToNull(instance.getClosingNote()) == null) {
            instance.setClosingNote(incoming);
        }
        // FILL-IF-EMPTY, exactly like the closing note above: finishing is contractually
        // idempotent, so a retry must not move the wall clock.
        if (instance.getFinishedAt() == null) {
            instance.setFinishedAt(Instant.now());
        }
        // Timing is derived and decorative — the completion write above is the user's real data
        // and must survive a failure here (same rationale as the medal derivation below).
        try {
            List<Instant> doneAt = exerciseSetRepository
                .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, instance.getId())
                .stream()
                .filter(s -> !s.isSkipped() && s.getDoneAt() != null)
                .map(ExerciseSetEntity::getDoneAt)
                .toList();
            instance.setActiveSeconds(SessionTimingCalculator.activeSeconds(
                instance.getStartedAt(), doneAt,
                timingProperties.gapCapSeconds(), timingProperties.leadInCapSeconds()));
        } catch (RuntimeException e) {
            log.warn("Timing derivation failed for session {} — finishing the workout anyway",
                instance.getId(), e);
        }
        // levelUp stays absent: the XP world left the server (mezo-r36n9.97.5); the optional field
        // is kept only because the iPhone's contract copy still lists it.
        WorkoutInstanceResponse base = toInstanceResponse(createdBy, instance);
        // Same rationale as logSet above: medals are derived and decorative, the finish/completion
        // write must not roll back because the medal replay blew up.
        try {
            base.setMedals(medalService.forSession(createdBy, instance.getId()));
        } catch (RuntimeException e) {
            log.warn("Medal derivation failed for session {} — finishing the workout anyway",
                instance.getId(), e);
            base.setMedals(List.of());
        }
        // Learned workout-timing profile (mezo-dzbm): published only on the REAL active->completed
        // transition, gated on isRealTransition above — finishWorkout is deliberately idempotent
        // (a bodyless retry after a failed one re-enters this method with the instance already
        // completed, see the fill-if-empty comments above), and learnFrom has no already-learned
        // marker of its own, so an unconditional publish would fold the same session's intervals
        // into the EWMA twice on every retry, silently over-weighting it. The switch gate itself
        // lives on the LISTENER (@ConditionalOnProperty on TimingProfileListener), not on this
        // publish call. Consumed AFTER_COMMIT, so profile learning only ever runs once this
        // completion write has actually landed, and — because it then runs on its own thread,
        // after commit — nothing it does or throws can roll this write back. A rolled-back test
        // transaction never fires it, by design (mirrors ChatTurnCompleted).
        if (isRealTransition) {
            eventPublisher.publishEvent(new WorkoutFinishedEvent(createdBy, instance.getId()));
        }
        return base;
    }

    /**
     * The instance's exercise list (mezo-mobji): the template day's live rows, the rows swapped or
     * added in this instance, and any soft-deleted row (a "Mezociklusra is" swap) that already
     * carries sets here — assembled by {@link SessionExerciseAssembler}.
     */
    List<SessionExerciseAssembler.Entry> assembleInstance(
            UUID createdBy, WorkoutSessionEntity instance, List<ExerciseEntity> templateRows) {
        List<ExerciseEntity> instanceRows = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, List.of(instance.getId()));
        List<ExerciseSetEntity> sets = exerciseSetRepository
            .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, instance.getId());
        Map<UUID, Integer> loggedWorking = new java.util.HashMap<>();
        for (ExerciseSetEntity set : sets) {
            if (!set.isSkipped() && !"warmup".equals(set.getKind())) {
                loggedWorking.merge(set.getExerciseId(), 1, Integer::sum);
            }
        }
        Set<UUID> known = new java.util.HashSet<>();
        templateRows.forEach(r -> known.add(r.getId()));
        instanceRows.forEach(r -> known.add(r.getId()));
        // A soft-deleted row ("Mezociklusra is" swap) is still part of this instance when it carries
        // sets here, or when an instance row replaces it (it then marks the replacement's place).
        Set<UUID> missing = java.util.stream.Stream.concat(
                sets.stream().map(ExerciseSetEntity::getExerciseId),
                instanceRows.stream().map(ExerciseEntity::getReplacesExerciseId).filter(java.util.Objects::nonNull))
            .filter(id -> !known.contains(id)).collect(Collectors.toSet());
        List<ExerciseEntity> deletedReferenced = missing.isEmpty() ? List.of()
            : exerciseRepository.findOwnedByIdIncludingDeleted(createdBy, missing).stream()
                .filter(ExerciseEntity::isDeleted)
                .toList();
        return SessionExerciseAssembler.assemble(instance.getId(), templateRows, instanceRows,
            deletedReferenced, loggedWorking, closingBlockService.closingCatalogIds());
    }

    /** A loggable exercise of the instance: its template day's row or a row of the instance itself. */
    private static boolean belongsTo(UUID createdBy, WorkoutSessionEntity instance, ExerciseEntity e) {
        return createdBy.equals(e.getCreatedBy())
            && (instance.getTemplateSessionId().equals(e.getWorkoutSessionId())
                || instance.getId().equals(e.getWorkoutSessionId()));
    }

    /** Instance gate: owned AND an instance row (template rows are not loggable targets). */
    private WorkoutSessionEntity ownedInstanceOrThrow(UUID createdBy, UUID workoutId) {
        return workoutSessionRepository.findById(workoutId)
            .filter(s -> createdBy.equals(s.getCreatedBy()) && s.getTemplateSessionId() != null)
            .orElseThrow(WorkoutService::notFound);
    }

    /** One batched leg read for these (live) sets; empty input costs no query. */
    private Map<UUID, List<ExerciseSetLegEntity>> legsOf(List<ExerciseSetEntity> sets) {
        return setLegService.legsBySetIds(sets.stream().map(ExerciseSetEntity::getId).toList());
    }

    private ExerciseSetResponse setResponse(ExerciseSetEntity set, Map<UUID, List<ExerciseSetLegEntity>> legsBySet) {
        ExerciseSetResponse r = mapper.toSetResponse(set);
        r.setLegs(legsBySet.getOrDefault(set.getId(), List.of()).stream().map(mapper::toSetLeg).toList());
        return r;
    }

    private WorkoutInstanceResponse toInstanceResponse(UUID createdBy, WorkoutSessionEntity instance) {
        List<ExerciseSetEntity> instanceSets = exerciseSetRepository
            .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, instance.getId());
        Map<UUID, List<ExerciseSetLegEntity>> legsBySet = legsOf(instanceSets);
        return WorkoutInstanceResponse.builder()
            .id(instance.getId())
            .templateSessionId(instance.getTemplateSessionId())
            .date(instance.getDate())
            .status(WorkoutInstanceResponse.StatusEnum.fromValue(instance.getStatus()))
            .sets(instanceSets.stream().map(st -> setResponse(st, legsBySet)).toList())
            .startedAt(toOffsetDateTime(instance.getStartedAt()))
            .finishedAt(toOffsetDateTime(instance.getFinishedAt()))
            .activeSeconds(instance.getActiveSeconds())
            .build();
    }

    /** {@code format: date-time} contract fields generate as {@link OffsetDateTime}; entities store {@link Instant}. */
    private static OffsetDateTime toOffsetDateTime(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }

    /** Ownership gate: a missing row and a foreign row are indistinguishable to the caller (404). */
    private static SystemRuntimeErrorException notFound() {
        return OwnershipGuard.notFound();
    }
}
