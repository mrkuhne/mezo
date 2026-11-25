package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.CustomWorkoutResponse;
import io.mrkuhne.mezo.api.dto.CustomWorkoutUpsertRequest;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDay;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.MesocycleSettingsUpdateRequest;
import io.mrkuhne.mezo.api.dto.SportSessionResponse;
import io.mrkuhne.mezo.api.dto.GymExercise;
import io.mrkuhne.mezo.api.dto.VolumeBaseline;
import io.mrkuhne.mezo.api.dto.VolumeProfile;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.MesocycleActivated;
import io.mrkuhne.mezo.feature.train.MesocycleClosed;
import io.mrkuhne.mezo.feature.train.MesocycleStarted;
import io.mrkuhne.mezo.feature.train.service.CatalogMediaResolver.CatalogMedia;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.port.SeasonGatePort;
import io.mrkuhne.mezo.feature.train.entity.MesocycleReportEntity;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.TrainingYearBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.config.TrainProperties;
import io.mrkuhne.mezo.feature.train.mapper.TrainMapper;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleReportRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.TrainingYearBlockRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
 * Train slice service. Reads: {@code listMesocycles} loads each owned aggregate in three
 * index-friendly batch queries (volume logs, sessions, exercises) and stitches the per-muscle
 * volume profile and template days onto every mesocycle. Writes: {@link #stampRun} materializes a
 * whole run out of a plan document (mezo-meyc.1 — the wizard now saves a {@code meso_template} and
 * STARTS it, there is no direct create endpoint any more); derived fields ({@code endDate},
 * {@code currentWeek}, {@code orderIndex}) are computed server-side. Lifecycle writes
 * (activate/close) and the day-level exercise replace live here too.
 * All finders are scoped by {@code createdBy} and ownership
 * is stamped from the principal, so cross-user data never leaks. Per house rule
 * (spring_patterns.md) only the write methods carry method-level {@code @Transactional}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TrainService {

    private static final ZoneId ZONE = ZoneId.of("Europe/Budapest");

    /** 409 on a structural day save while that day's workout runs (mezo-r36n9.116). */
    public static final String TRAIN_DAY_WORKOUT_RUNNING = "TRAIN_DAY_WORKOUT_RUNNING";

    private final MesocycleRepository mesocycleRepository;
    private final MuscleGroupVolumeLogRepository volumeLogRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final ExerciseCatalogRepository exerciseCatalogRepository;
    private final SportSessionRepository sportSessionRepository;
    private final MesocycleReportRepository reportRepository;
    private final MesocycleReportService reportService;
    private final CatalogMediaResolver catalogMediaResolver;
    private final TrainMapper mapper;
    private final ExerciseStyler styler;
    private final TechniqueGuard techniqueGuard;
    private final TrainProperties trainProperties;
    // The volume log is derived from the plan (volume engine v2): recomputed after plan writes.
    private final VolumeLedger volumeLedger;
    private final TierChangeProposalService tierChangeProposals;
    private final VolumeProperties volumeProperties;
    // mezo-r36n9.81: week 1's planner challenges on a styled + techniques-enabled run at start.
    private final TechniquePlanService techniquePlanService;
    // mezo-meyc.3: fires only on a REAL close (never the idempotent re-close or fill-if-null
    // branches) — the companion AI-review generator's AFTER_COMMIT trigger (S3 task 15).
    private final ApplicationEventPublisher eventPublisher;
    // Boop B6 Évad (mezo-r36n9.16): no new block outside a season — the stamp + real-activation paths ask the gate.
    private final SeasonGatePort seasonGate;
    // Éves terv (mezo-r36n9.113): a started run joins its year block in the stamp transaction.
    private final YearPlanLinker yearPlanLinker;
    /** Throws a superseded planned run away when a block starts now (mezo-r36n9.113). */
    private final MesocycleDiscardService discardService;
    private final TrainingYearBlockRepository yearBlockRepository;
    private final ObjectProvider<Clock> clock;

    public List<MesocycleResponse> listMesocycles(UUID createdBy) {
        List<MesocycleEntity> mesos = mesocycleRepository.findByCreatedByAndDeletedFalseOrderByStartDateAsc(createdBy);
        List<UUID> mesoIds = mesos.stream().map(MesocycleEntity::getId).toList();
        if (mesoIds.isEmpty()) {
            return List.of();
        }

        Map<UUID, Map<String, VolumeProfile>> volumeByMeso = volumeLogRepository
            .findByCreatedByAndMesocycleIdInOrderByMuscleAsc(createdBy, mesoIds).stream()
            .collect(Collectors.groupingBy(v -> v.getMesocycleId(), LinkedHashMap::new,
                Collectors.toMap(v -> v.getMuscle(), mapper::toProfile, (a, b) -> a, LinkedHashMap::new)));

        // Template days only — workout instances (templateSessionId set) are not plan rows.
        List<WorkoutSessionEntity> sessions =
            workoutSessionRepository.findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, mesoIds)
                .stream().filter(s -> s.getTemplateSessionId() == null).toList();
        List<UUID> sessionIds = sessions.stream().map(WorkoutSessionEntity::getId).toList();
        Map<UUID, List<ExerciseEntity>> exercisesBySession = sessionIds.isEmpty()
            ? Map.of()
            : exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, sessionIds)
                .stream().collect(Collectors.groupingBy(ExerciseEntity::getWorkoutSessionId));
        List<ExerciseEntity> allExercises = exercisesBySession.values().stream().flatMap(List::stream).toList();
        Map<UUID, CatalogMedia> mediaByCatalog = mediaByCatalogOf(allExercises);
        Map<UUID, TrainingStyle> styleByMeso = new HashMap<>();
        mesos.forEach(m -> styleByMeso.put(m.getId(), TrainingStyle.fromWire(m.getTrainingStyle())));
        CatalogAttributes.Lookup stability = styler.lookupRows(allExercises,
            styleByMeso.values().stream().anyMatch(Objects::nonNull));

        Map<UUID, List<MesoDay>> daysByMeso = sessions.stream()
            .filter(s -> s.getMesocycleId() != null)
            .collect(Collectors.groupingBy(WorkoutSessionEntity::getMesocycleId, LinkedHashMap::new,
                Collectors.mapping(s -> toDay(s, exercisesBySession.getOrDefault(s.getId(), List.of()), mediaByCatalog,
                        styleByMeso.get(s.getMesocycleId()), stability),
                    Collectors.toList())));
        // hasReport in ONE batched query (mezo-meyc.2) — the Történet list's "van riportja" flag
        // must never become a per-run lookup.
        Set<UUID> reported = reportRepository
            .findByCreatedByAndMesocycleIdInAndDeletedFalse(createdBy, mesoIds).stream()
            .map(MesocycleReportEntity::getMesocycleId).collect(Collectors.toSet());

        return mesos.stream().map(m -> {
            MesocycleResponse r = mapper.toResponse(m);
            r.setWeeklyReviewMode(effectiveReviewMode(m));
            r.setHasReport(reported.contains(m.getId()));
            Map<String, VolumeProfile> volume = volumeByMeso.get(m.getId());
            List<MesoDay> days = daysByMeso.get(m.getId());
            if (volume != null && !volume.isEmpty()) {
                r.setVolumePerMuscle(volume);
            }
            if (days != null && !days.isEmpty()) {
                r.setDays(days);
            }
            return r;
        }).toList();
    }

    /**
     * The owned sport log, newest date first, optionally narrowed to an inclusive {@code from..to}
     * window (mezo-d20.7.1 — the Sport Napló 4-week idő+RPE trend). Both bounds are optional: with
     * neither given this is the historical whole-log read, and a single given bound leaves the
     * other side unbounded exactly as before. When both are present the range must be forward and
     * no wider than {@code mezo.train.sport-session-max-span-days} — a guard against a client
     * asking for a decade in one call; the open-ended forms are deliberately left unguarded
     * because they are the pre-existing behaviour. Pure read: no {@code @Transactional}.
     */
    public List<SportSessionResponse> listSportSessions(UUID createdBy, LocalDate from, LocalDate to) {
        if (from != null && to != null) {
            if (from.isAfter(to)) {
                throw new SystemRuntimeErrorException(
                    SystemMessage.error("TRAIN_INVALID_DATE_RANGE").build(), HttpStatus.BAD_REQUEST);
            }
            long spanDays = ChronoUnit.DAYS.between(from, to) + 1; // inclusive
            if (spanDays > trainProperties.sportSessionMaxSpanDays()) {
                throw new SystemRuntimeErrorException(
                    SystemMessage.error("TRAIN_DATE_RANGE_TOO_WIDE").build(), HttpStatus.BAD_REQUEST);
            }
            return map(sportSessionRepository
                .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(createdBy, from, to));
        }
        if (from != null) {
            return map(sportSessionRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(createdBy, from));
        }
        if (to != null) {
            return map(sportSessionRepository
                .findByCreatedByAndDeletedFalseAndDateLessThanEqualOrderByDateDesc(createdBy, to));
        }
        return map(sportSessionRepository.findByCreatedByAndDeletedFalseOrderByDateDesc(createdBy));
    }

    private List<SportSessionResponse> map(List<SportSessionEntity> sessions) {
        return sessions.stream().map(mapper::toResponse).toList();
    }

    /**
     * The plan document a run is stamped from (mezo-meyc.1) — everything {@link #stampRun} copies
     * onto the fresh {@code mesocycle} aggregate. Decouples the stitching from where the plan came
     * from: today a {@code MesoTemplateEntity} (via {@code MesoTemplateService.start}), which is
     * why {@code days}/{@code volumePerMuscle} arrive as the contract's input shapes rather than
     * the template's jsonb records.
     */
    record StampSource(
        UUID templateId,
        String title,
        String shortTitle,
        String goal,
        String goalPreset,
        LocalDate startDate,
        Integer weeks,
        String split,
        String style,
        String trainingStyle,
        List<String> phaseCurve,
        String notes,
        String status,
        List<MesoDayInput> days,
        Map<String, VolumeBaseline> volumePerMuscle,
        Map<String, String> musclePriorities,
        List<String> sportGroups,
        boolean techniquesEnabled,
        UUID yearBlockId // the Éves terv block this run starts; null = the ±14-day rule (mezo-r36n9.113)
    ) {}

    /**
     * Stamps a full mesocycle RUN out of a plan document: the {@code mesocycle} row with its
     * server-derived fields ({@code endDate}, {@code currentWeek}, {@code orderIndex}), the
     * template {@code workout_session} days with their {@code exercise} recipe rows, and — for an
     * active start — the per-muscle {@code muscle_group_volume_log} baseline rows. Package-visible:
     * the only caller is {@code MesoTemplateService.start}, itself {@code @Transactional}.
     */
    @Transactional
    MesocycleResponse stampRun(UUID createdBy, StampSource src) {
        requireSeason(createdBy, src.startDate());
        boolean active = "active".equals(src.status());
        MesocycleEntity m = new MesocycleEntity();
        m.setCreatedBy(createdBy); // server-side ownership — never from the client
        m.setTemplateId(src.templateId());
        m.setTitle(src.title());
        m.setShortTitle(src.shortTitle() != null ? src.shortTitle() : src.title());
        m.setStatus(src.status());
        m.setGoal(src.goal());
        m.setGoalPreset(src.goalPreset());
        // Defensive copy: the source map belongs to the template row — two managed entities must
        // never share one jsonb map instance (same reason as the phaseCurve copy below).
        m.setMusclePriorities(src.musclePriorities() != null ? Map.copyOf(src.musclePriorities()) : null);
        m.setSportGroups(src.sportGroups() != null ? List.copyOf(src.sportGroups()) : null);
        m.setStartDate(src.startDate());
        m.setEndDate(src.startDate().plusWeeks(src.weeks()));
        m.setWeeks(src.weeks());
        m.setCurrentWeek(active ? MesoWeeks.clampWeek(src.startDate(), src.weeks()) : 0);
        // split/style are optional on a template but NOT NULL on a run — an unset one becomes "".
        m.setSplit(src.split() != null ? src.split() : "");
        m.setStyle(src.style() != null ? src.style() : "");
        m.setTechniquesEnabled(src.techniquesEnabled()); // the run inherits the block flag (mezo-r36n9.80)
        m.setTrainingStyle(src.trainingStyle()); // the run inherits the template's training style (mezo-r36n9.79)
        // Defensive copy: the source list belongs to the template row — two managed entities must
        // never share one text[] collection instance.
        m.setPhaseCurve(List.copyOf(src.phaseCurve()));
        m.setNotes(src.notes());
        m.setVolumeModel((short) 2); // a new run is born on the amount model — nothing to migrate
        if (active) {
            // Single-active invariant holds on the start-as-active path too — the start sheet's
            // "Aktiválás most" stamps directly with active status (live-smoke regression).
            archiveActiveMesos(createdBy);
        }
        MesocycleEntity saved = mesocycleRepository.save(m);

        // Template days + exercises — orderIndex pinned by array order.
        List<MesoDayInput> days = src.days() != null ? src.days() : List.of();
        for (int d = 0; d < days.size(); d++) {
            MesoDayInput dayInput = days.get(d);
            WorkoutSessionEntity day = new WorkoutSessionEntity();
            day.setCreatedBy(createdBy);
            day.setMesocycleId(saved.getId());
            day.setDayLabel(dayInput.getDay());
            day.setType(dayInput.getType());
            day.setMuscle(dayInput.getMuscle() != null ? dayInput.getMuscle() : "");
            day.setMuscleAccent(Boolean.TRUE.equals(dayInput.getMuscleAccent()));
            day.setNote(dayInput.getNote());
            day.setOrderIndex(d);
            WorkoutSessionEntity savedDay = workoutSessionRepository.save(day);

            List<GymExerciseInput> exercises =
                dayInput.getExercises() != null ? dayInput.getExercises() : List.of();
            for (int e = 0; e < exercises.size(); e++) {
                exerciseRepository.save(toExerciseEntity(createdBy, savedDay.getId(), exercises.get(e), e));
            }
        }
        // Week 1's planner challenges (mezo-r36n9.81) — a no-op unless the run opts in. The catch keeps a planner
        // logic error from blocking the start; a repository failure inside it would still mark this joined
        // transaction rollback-only (a separate transaction could not see the uncommitted run rows).
        try {
            techniquePlanService.placeStartChallenges(createdBy, saved);
        } catch (RuntimeException ex) {
            log.warn("week-1 challenge placement failed for run {}, starting without them", saved.getId(), ex);
        }
        // The volume log is derived from the plan (volume engine v2): only an ACTIVE run carries
        // rows — a planned run stays profile-less until activation (sync is a no-op for it).
        if (active) {
            volumeLedger.sync(createdBy, saved.getId());
        }
        if (active) {
            supersedePlannedRuns(createdBy, saved);
        }
        // linkStarted runs inside this start transaction and must never fail the start (controller call 6): an
        // unexpected linker error is logged and the run starts unlinked (the plan then shows it as unlinkedRunning).
        // A repository failure inside it would still mark this joined transaction rollback-only — same caveat as the
        // week-1 challenge placement above.
        try {
            yearPlanLinker.linkStarted(createdBy, saved, src.yearBlockId());
        } catch (RuntimeException ex) {
            log.warn("year-plan link failed for run {}, starting it unlinked", saved.getId(), ex);
        }
        // Only a block that actually starts (mezo-r36n9.113: the season always shows the running block): the season
        // follows it AFTER_COMMIT (SeasonBlockLinkListener). A planned run is followed when activateMesocycle starts it.
        if (active) {
            eventPublisher.publishEvent(new MesocycleStarted(createdBy, saved.getId(), saved.getStartDate()));
        }
        return assembleResponse(createdBy, saved);
    }

    /**
     * Activates a mesocycle: archives every other active run (single-active invariant), then
     * publishes {@link MesocycleActivated} on the REAL activation branch ONLY (never on an
     * idempotent re-activate of an already-active run) — the goal's diet-phase suggestion probe
     * (Diet Plan slice 4) is the AFTER_COMMIT consumer.
     */
    @Transactional
    public MesocycleResponse activateMesocycle(UUID createdBy, UUID id) {
        MesocycleEntity target = ownedMesoOrThrow(createdBy, id);
        if (!"active".equals(target.getStatus())) {
            // A block already running is untouched (idempotent re-activate above); a real activation needs a season.
            requireSeason(createdBy, target.getStartDate());
            // Single-active invariant (spec rule): activating archives every other active meso.
            archiveActiveMesos(createdBy);
            target.setStatus("active");
            target.setCurrentWeek(MesoWeeks.clampWeek(target.getStartDate(), target.getWeeks()));
            // An archived or planned run that was never converted (volume_model 1; the one-time migration
            // covers only active and planned runs, and a planned one may have been created before it) was
            // not being prescribed from the old distribution at the moment of activation — its stored
            // working_sets ARE its plan, which is exactly the amount model, so no re-distribution is
            // needed. Without this it would stay model 1 forever and be silently skipped by the weekly
            // engine and by VolumeLedger.sync.
            if (target.getVolumeModel() == 1) {
                target.setVolumeModel((short) 2);
            }
            // Real activation only — AFTER_COMMIT consumers (Diet Plan slice 4) see it once this
            // transaction lands.
            eventPublisher.publishEvent(new MesocycleActivated(createdBy, id));
            // A planned block reaching its day (PlannedBlockStarter) is a start too: the season follows it
            // (mezo-r36n9.113). It starts running today at the earliest — a re-activated old run must not claim the
            // season's weeks from its long-past start date.
            LocalDate today = LocalDate.now(clock().withZone(ZONE));
            LocalDate runsFrom = target.getStartDate() == null || target.getStartDate().isBefore(today)
                ? today : target.getStartDate();
            eventPublisher.publishEvent(new MesocycleStarted(createdBy, id, runsFrom));
        }
        // Unconditional (even when already active): the ledger is idempotent, so activate also
        // backfills the volume log of a run that never had rows.
        volumeLedger.sync(createdBy, id);
        return assembleResponse(createdBy, target);
    }

    /**
     * A block that starts now takes over (mezo-r36n9.113): every never-started planned run dated after it with no
     * logged session is thrown away („Mégsem, eldobom" — soft delete, no report, no event), and its year block lets it
     * go (back to planned). Otherwise the planned run, made earlier, would activate on its day and archive this one.
     */
    private void supersedePlannedRuns(UUID createdBy, MesocycleEntity started) {
        LocalDate start = started.getStartDate();
        for (MesocycleEntity planned : mesocycleRepository.findByCreatedByAndStatusAndDeletedFalse(createdBy, "planned")) {
            if (planned.getStartDate() == null || !planned.getStartDate().isAfter(start)) continue;
            if (workoutSessionRepository.existsByCreatedByAndMesocycleIdAndTemplateSessionIdIsNotNull(createdBy,
                planned.getId())) {
                continue;
            }
            for (TrainingYearBlockEntity b : yearBlockRepository.findByCreatedByAndMesocycleIdAndDeletedFalse(createdBy,
                planned.getId())) {
                b.setMesocycleId(null);
                b.setStatus(YearGenerator.PLANNED);
                yearBlockRepository.save(b);
            }
            discardService.discard(createdBy, planned.getId());
        }
    }

    private Clock clock() {
        return clock.getIfAvailable(Clock::systemUTC);
    }

    /** 409 {@code SEASON_REQUIRED} unless a season is active, or a planned one starts within 7 days of {@code start}. */
    private void requireSeason(UUID createdBy, LocalDate start) {
        if (!seasonGate.allowsMesocycleStart(createdBy, start != null ? start : LocalDate.now())) {
            throw new SystemRuntimeErrorException(SystemMessage.error("SEASON_REQUIRED").build(), HttpStatus.CONFLICT);
        }
    }

    /**
     * Stores the run's tiers (and {@code sportGroups}) now; the ledger follows the new bands. Volume engine v2
     * (spec §6.5): every group whose band moved and whose plan now sits outside it gets a {@code tier_change}
     * proposal at once ({@link TierChangeProposalService} — applied in {@code auto} mode, pending in
     * {@code manual}). The run row is locked first (the weekly proposal's lock order) and read only through that
     * lock.
     */
    @Transactional
    public MesocycleResponse updateMusclePriorities(UUID createdBy, UUID id, Map<String, String> priorities,
                                                    List<String> sportGroups) {
        Map<String, String> normalized = PriorityTier.normalize(priorities);
        List<String> sport = sportGroups == null ? null // absent = unchanged, [] = cleared
            : SportGroups.normalize(sportGroups, volumeProperties.baselines().keySet());
        // Locked read first and only: the row (tiers, currentWeek, audit) is current, never a stale copy
        // flushed over a concurrent weekly generation. Absent or foreign = the same 404 as OwnershipGuard.
        MesocycleEntity m = mesocycleRepository.findLockedByIdAndCreatedByAndDeletedFalse(id, createdBy)
            .orElseThrow(OwnershipGuard::notFound);
        Map<String, VolumeBands.Band> bandsBefore = tierChangeProposals.bandsOf(m);
        m.setMusclePriorities(normalized.isEmpty() ? null : Map.copyOf(normalized));
        if (sportGroups != null) {
            m.setSportGroups(sport);
        }
        volumeLedger.sync(createdBy, id); // the tier moves the band
        // Deliberately not caught: the tier change and its band fix are one change — a failed raise fails the PUT.
        tierChangeProposals.raise(createdBy, m, bandsBefore);
        return assembleResponse(createdBy, m);
    }

    /**
     * Closes (archives) a run and FREEZES its end-of-mesocycle report in the same transaction
     * (mezo-meyc.2): {@code status = archived}, {@code closedAt = now}, the computed
     * adherence/volume/strength/records snapshot, and the owner's optional close-time self-eval.
     *
     * <p>IDEMPOTENT: re-closing an already archived run never recomputes (the report is a snapshot of
     * the moment the run was closed, not of "now") and never overwrites a self-eval already
     * captured. Refreshing a stale report is the explicit {@code MesocycleReportService.regenerate}
     * path, never a second close.
     *
     * <p>The ONE thing a second close may still do is FILL a self-eval that was never written: a run
     * auto-archived by starting the next one (the single-active invariant) gets its report through
     * the regenerate/backfill path and would otherwise have no way to ever receive the owner's note —
     * S2 has no other self-eval write path. Fill-if-empty only; an existing note is untouchable.
     *
     * <p>mezo-meyc.3: publishes {@link MesocycleClosed} on the REAL close branch ONLY — never on the
     * idempotent re-close nor the fill-if-null branch above, both of which leave {@code ai_eval}
     * untouched and would otherwise re-trigger the companion's AI-review generator for nothing.
     */
    @Transactional
    public MesocycleResponse closeMesocycle(UUID createdBy, UUID id, String selfEval) {
        MesocycleEntity target = ownedMesoOrThrow(createdBy, id);
        boolean hasNote = selfEval != null && !selfEval.isBlank();
        if (!"archived".equals(target.getStatus())) {
            target.setStatus("archived");
            // timestamptz stores micros — truncate so the pre/post-persist responses match
            target.setClosedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
            MesocycleReportEntity report = reportService.computeAndStore(target);
            if (hasNote) {
                report.setSelfEval(selfEval);
            }
            // Real close only — the report row is persisted (computeAndStore already saved it);
            // AFTER_COMMIT consumers see it once this transaction lands.
            eventPublisher.publishEvent(new MesocycleClosed(createdBy, id));
        } else if (hasNote) {
            // No report row yet ⇒ nothing to attach the note to; the owner regenerates first.
            reportRepository.findByMesocycleIdAndCreatedByAndDeletedFalse(id, createdBy)
                .filter(r -> r.getSelfEval() == null || r.getSelfEval().isBlank())
                .ifPresent(r -> r.setSelfEval(selfEval));
        }
        return assembleResponse(createdBy, target);
    }

    /**
     * Partial update of a running block's settings (mezo-r36n9.83); an absent (or null) field keeps its value,
     * so a block style can be changed but never cleared here. A new style re-stamps every exercise row of the
     * run's template days IN PLACE ({@link ExerciseStyler#restampRows}) — never soft-delete + re-insert, which
     * would re-mint the ids a pending week proposal's lines point at. The techniques flag only flips: picks
     * stay stored and are ignored while it is off. The review mode applies to proposals generated after the
     * switch; a pending one stays pending (it expires at the week boundary as before). Archived = 409.
     */
    @Transactional
    public MesocycleResponse updateSettings(UUID createdBy, UUID id, MesocycleSettingsUpdateRequest req) {
        // The weekly proposal's lock order: the run row first, read only through that lock.
        MesocycleEntity m = mesocycleRepository.findLockedByIdAndCreatedByAndDeletedFalse(id, createdBy)
            .orElseThrow(OwnershipGuard::notFound);
        if ("archived".equals(m.getStatus())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error(ExerciseTechniqueService.RUN_NOT_EDITABLE).build(), HttpStatus.CONFLICT);
        }
        if (req.getTechniquesEnabled() != null) {
            m.setTechniquesEnabled(req.getTechniquesEnabled());
        }
        if (req.getWeeklyReviewMode() != null) {
            m.setWeeklyReviewMode(req.getWeeklyReviewMode());
        }
        if (req.getTrainingStyle() != null) {
            String wire = mapper.styleWire(req.getTrainingStyle());
            if (!wire.equals(m.getTrainingStyle())) {
                m.setTrainingStyle(wire);
                restampRun(createdBy, m, TrainingStyle.fromWire(wire));
            }
        }
        return assembleResponse(createdBy, m);
    }

    /** Re-stamps the run's template-day rows under {@code block}, day by day, then re-syncs the ledger. */
    private void restampRun(UUID createdBy, MesocycleEntity m, TrainingStyle block) {
        List<UUID> dayIds = workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(m.getId())).stream()
            .filter(s -> s.getTemplateSessionId() == null).map(WorkoutSessionEntity::getId).toList();
        if (dayIds.isEmpty()) {
            return;
        }
        Map<UUID, List<ExerciseEntity>> byDay = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, dayIds).stream()
            .collect(Collectors.groupingBy(ExerciseEntity::getWorkoutSessionId, LinkedHashMap::new, Collectors.toList()));
        for (List<ExerciseEntity> rows : byDay.values()) {
            styler.restampRows(rows, block);
            // The picks were not touched here: one that became invalid under the catalog is cleared,
            // exactly as a day save clears an invalid carried pick, never a 400 on the settings change.
            styler.clearInvalidPicks(rows);
            exerciseRepository.saveAll(rows);
        }
        volumeLedger.sync(createdBy, m.getId());
    }

    /**
     * Full-list day replace. Training style (mezo-r36n9.79): the style fields a client omits are
     * carried over from the day's old rows (same identity, first unmatched) and every row is
     * re-stamped under the run's style — a no-op for an unstyled run.
     *
     * <p>Ids (mezo-r36n9.83): when the new list is the SAME exercises in the same order — equal length and,
     * at every index, the same identity (catalog id, else exact name; {@link #sameIdentity}) — the stored
     * rows are updated IN PLACE (id, created_at, order kept), so a pending week proposal's lines and an
     * open workout's logged sets keep pointing at them. Any other list (reorder, add, remove, swap) keeps
     * the soft-delete + re-insert path with new ids — and, while a workout of that day is running
     * (an {@code active} instance), such a structural save is refused with 409 {@code TRAIN_DAY_WORKOUT_RUNNING}
     * before any write; the in-place path stays allowed.
     */
    @Transactional
    public MesoDay replaceDayExercises(UUID createdBy, UUID mesoId, UUID dayId, List<GymExerciseInput> inputs) {
        MesocycleEntity meso = ownedMesoOrThrow(createdBy, mesoId);
        TrainingStyle block = TrainingStyle.fromWire(meso.getTrainingStyle());
        WorkoutSessionEntity day = OwnershipGuard.ownedOrThrow(
            workoutSessionRepository.findById(dayId)
                .filter(s -> mesoId.equals(s.getMesocycleId())),
            createdBy);

        // Full-list replace: soft-delete the current rows (@SQLDelete flips is_deleted), then
        // insert the new list with orderIndex pinned by array order.
        List<ExerciseEntity> old = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, List.of(dayId));
        List<ExerciseEntity> fresh = new ArrayList<>(inputs.size());
        for (int i = 0; i < inputs.size(); i++) {
            fresh.add(toExerciseEntity(createdBy, dayId, inputs.get(i), i));
        }
        CatalogAttributes.Lookup stability = styler.styleRows(fresh, old, block, inputs);
        techniqueGuard.validateRows(fresh); // before any write: a 400 leaves the day untouched
        boolean aligned = alignedByIdentity(old, fresh);
        // A running workout's logged sets point at these rows: only the in-place path keeps them valid.
        if (!aligned && workoutSessionRepository
                .existsByCreatedByAndTemplateSessionIdAndStatus(createdBy, dayId, "active")) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error(TRAIN_DAY_WORKOUT_RUNNING).build(), HttpStatus.CONFLICT);
        }
        List<ExerciseEntity> saved;
        if (aligned) {
            for (int i = 0; i < old.size(); i++) {
                copyEditable(fresh.get(i), old.get(i));
            }
            saved = exerciseRepository.saveAll(old);
        } else {
            exerciseRepository.deleteAll(old);
            saved = exerciseRepository.saveAll(fresh);
        }
        volumeLedger.sync(createdBy, mesoId);
        return toDay(day, saved, mediaByCatalogOf(saved), block, stability);
    }

    // ── Saját edzés (custom workout templates, mezo-ws2x) ─────────────────────────
    // A custom template is a meso-less workout_session TEMPLATE row (origin='custom',
    // mesocycleId null, templateSessionId null); its name lives in `type` (like meso day
    // titles) and its exercises are ordinary recipe rows, so the whole instance machinery
    // (start/log/finish/records/prescriptions) works on it unchanged.

    /** The owner's custom (saját) workout templates, oldest first. */
    public List<CustomWorkoutResponse> listCustomWorkouts(UUID createdBy) {
        List<WorkoutSessionEntity> templates = workoutSessionRepository
            .findByCreatedByAndOriginAndTemplateSessionIdIsNullOrderByCreatedAtAsc(createdBy, "custom");
        if (templates.isEmpty()) {
            return List.of();
        }
        List<ExerciseEntity> exercises = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(
                createdBy, templates.stream().map(WorkoutSessionEntity::getId).toList());
        Map<UUID, List<ExerciseEntity>> byTemplate = exercises.stream()
            .collect(Collectors.groupingBy(ExerciseEntity::getWorkoutSessionId));
        Map<UUID, CatalogMedia> media = mediaByCatalogOf(exercises);
        CatalogAttributes.Lookup stability = styler.lookupRows(exercises, false);
        return templates.stream()
            .map(t -> toCustomWorkoutResponse(t, byTemplate.getOrDefault(t.getId(), List.of()), media, stability))
            .toList();
    }

    @Transactional
    public CustomWorkoutResponse createCustomWorkout(UUID createdBy, CustomWorkoutUpsertRequest req) {
        WorkoutSessionEntity template = new WorkoutSessionEntity();
        template.setCreatedBy(createdBy); // server-side ownership — never from the client
        template.setOrigin("custom");
        template.setDayLabel(""); // custom templates are not weekday-bound
        template.setType(req.getName());
        template.setStatus("planned");
        WorkoutSessionEntity saved = workoutSessionRepository.save(template);
        return replaceCustomExercises(createdBy, saved, req.getExercises());
    }

    @Transactional
    public CustomWorkoutResponse updateCustomWorkout(UUID createdBy, UUID id, CustomWorkoutUpsertRequest req) {
        WorkoutSessionEntity template = ownedCustomTemplateOrThrow(createdBy, id);
        template.setType(req.getName());
        return replaceCustomExercises(createdBy, template, req.getExercises());
    }

    @Transactional
    public void deleteCustomWorkout(UUID createdBy, UUID id) {
        // Soft delete (@SQLDelete) — completed instances and their sets keep feeding
        // records/history (the record identity read includes soft-deleted rows).
        workoutSessionRepository.delete(ownedCustomTemplateOrThrow(createdBy, id));
    }

    /** An owned CUSTOM template row by id — missing/foreign/meso-origin/instance rows are all 404. */
    private WorkoutSessionEntity ownedCustomTemplateOrThrow(UUID createdBy, UUID id) {
        return OwnershipGuard.ownedOrThrow(
            workoutSessionRepository.findById(id)
                .filter(s -> "custom".equals(s.getOrigin()) && s.getTemplateSessionId() == null),
            createdBy);
    }

    /** Same exercises, same order: equal length and the same identity at every index (mezo-r36n9.83). */
    private static boolean alignedByIdentity(List<ExerciseEntity> old, List<ExerciseEntity> fresh) {
        if (old.size() != fresh.size()) {
            return false;
        }
        for (int i = 0; i < old.size(); i++) {
            if (!sameIdentity(old.get(i), fresh.get(i))) {
                return false;
            }
        }
        return true;
    }

    /** The carry-over / records identity: catalog id, else exact name (as {@code ExerciseStyler}). */
    private static boolean sameIdentity(ExerciseEntity a, ExerciseEntity b) {
        return a.getCatalogId() != null
            ? a.getCatalogId().equals(b.getCatalogId())
            : b.getCatalogId() == null && java.util.Objects.equals(a.getName(), b.getName());
    }

    /**
     * Copies every column a day save writes ({@link #toExerciseEntity} + styling) from the freshly built row
     * onto the stored one. Untouched: id, createdBy, createdAt, deleted, workoutSessionId, and the columns a
     * day save never sets — note (the durable per-exercise note) and the mid-workout markers
     * (replacesExerciseId, addedInWorkoutId, savedToPlan), which keep their stored values.
     */
    private static void copyEditable(ExerciseEntity from, ExerciseEntity to) {
        to.setName(from.getName());
        to.setMuscle(from.getMuscle());
        to.setWarmupSets(from.getWarmupSets());
        to.setWorkingSets(from.getWorkingSets());
        to.setRepMin(from.getRepMin());
        to.setRepMax(from.getRepMax());
        to.setTargetRir(from.getTargetRir());
        to.setAnchorWeightKg(from.getAnchorWeightKg());
        to.setType(from.getType());
        to.setCountsTowardVolume(from.isCountsTowardVolume());
        to.setWarning(from.getWarning());
        to.setCatalogId(from.getCatalogId());
        to.setTrainingStyle(from.getTrainingStyle());
        to.setRestSec(from.getRestSec());
        to.setOverrides(from.getOverrides() == null ? null : new ArrayList<>(from.getOverrides()));
        to.setTechnique(from.getTechnique());
        to.setTechniqueSource(from.getTechniqueSource());
        to.setChallenge(from.isChallenge());
        to.setOrderIndex(from.getOrderIndex());
    }

    /** Full-list replace, soft-delete + re-insert (the misaligned branch of {@link #replaceDayExercises}). */
    private CustomWorkoutResponse replaceCustomExercises(
            UUID createdBy, WorkoutSessionEntity template, List<GymExerciseInput> inputs) {
        List<ExerciseEntity> old = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, List.of(template.getId()));
        List<ExerciseEntity> fresh = new ArrayList<>(inputs.size());
        for (int i = 0; i < inputs.size(); i++) {
            fresh.add(toExerciseEntity(createdBy, template.getId(), inputs.get(i), i));
        }
        // a custom workout has no block style: nothing is stamped, an exercise's own fields persist as sent
        CatalogAttributes.Lookup stability = styler.styleRows(fresh, old, null, inputs);
        techniqueGuard.validateRows(fresh);
        exerciseRepository.deleteAll(old);
        List<ExerciseEntity> saved = exerciseRepository.saveAll(fresh);
        return toCustomWorkoutResponse(template, saved, mediaByCatalogOf(saved), stability);
    }

    private CustomWorkoutResponse toCustomWorkoutResponse(WorkoutSessionEntity template,
            List<ExerciseEntity> exercises, Map<UUID, CatalogMedia> media, CatalogAttributes.Lookup stability) {
        return CustomWorkoutResponse.builder()
            .id(template.getId())
            .name(template.getType())
            .exercises(toDay(template, exercises, media, null, stability).getExercises())
            .build();
    }

    /** Single-active invariant: archives every currently active meso of the owner. */
    private void archiveActiveMesos(UUID createdBy) {
        mesocycleRepository.findByCreatedByAndStatusAndDeletedFalse(createdBy, "active")
            .forEach(m -> m.setStatus("archived"));
    }

    /** Ownership gate: a missing row and a foreign row are indistinguishable to the caller (404). */
    private MesocycleEntity ownedMesoOrThrow(UUID createdBy, UUID id) {
        return OwnershipGuard.ownedOrThrow(mesocycleRepository.findById(id), createdBy);
    }

    private ExerciseEntity toExerciseEntity(UUID createdBy, UUID workoutSessionId, GymExerciseInput in, int orderIndex) {
        // Unknown catalog reference must surface as a 400 field error, never a raw FK 500.
        if (in.getCatalogId() != null && !exerciseCatalogRepository.existsById(in.getCatalogId())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "catalogId").build(), HttpStatus.BAD_REQUEST);
        }
        ExerciseEntity e = new ExerciseEntity();
        e.setCreatedBy(createdBy);
        e.setWorkoutSessionId(workoutSessionId);
        e.setName(in.getName());
        e.setMuscle(in.getMuscle() != null ? in.getMuscle() : "");
        e.setWarmupSets(in.getWarmupSets());
        e.setWorkingSets(in.getWorkingSets());
        e.setRepMin(in.getRepMin());
        e.setRepMax(in.getRepMax());
        e.setTargetRir(in.getTargetRIR());
        e.setAnchorWeightKg(in.getAnchorWeightKg());
        e.setType(in.getType().getValue());
        // mezo-gbo7: absent flag means "counts", except plyo which defaults to exempt.
        e.setCountsTowardVolume(in.getCountsTowardVolume() != null
            ? in.getCountsTowardVolume()
            : !"plyo".equals(in.getType() == null ? null : in.getType().getValue()));
        e.setWarning(in.getWarning());
        e.setCatalogId(in.getCatalogId());
        // Training style fields travel as wire values (mezo-r36n9.79); an empty overrides list is null.
        e.setTrainingStyle(mapper.styleWire(in.getTrainingStyle()));
        e.setRestSec(in.getRestSec());
        e.setOverrides(mapper.overridesWire(in.getOverrides()));
        // Technique fields (mezo-r36n9.80): wire values; styleRows carries/overwrites them on a day edit.
        e.setTechnique(in.getTechnique() == null || in.getTechnique() == io.mrkuhne.mezo.api.dto.Technique.NONE
            ? null : mapper.techniqueWire(in.getTechnique()));
        e.setTechniqueSource(mapper.techniqueSourceWire(in.getTechniqueSource()));
        e.setChallenge(Boolean.TRUE.equals(in.getChallenge()));
        e.setOrderIndex(orderIndex);
        return e;
    }

    /** The run's own weekly review mode, else the server default (mezo-r36n9.83). */
    private MesocycleResponse.WeeklyReviewModeEnum effectiveReviewMode(MesocycleEntity m) {
        return MesocycleResponse.WeeklyReviewModeEnum.fromValue(
            volumeProperties.weeklyReview().modeFor(m.getWeeklyReviewMode()));
    }

    /** Single-aggregate variant of the list stitching — write paths return the same shape as GET. */
    private MesocycleResponse assembleResponse(UUID createdBy, MesocycleEntity m) {
        MesocycleResponse r = mapper.toResponse(m);
        r.setWeeklyReviewMode(effectiveReviewMode(m));
        // Lombok's @Builder on the generated DTO ignores the contract's `default: false`, so every
        // assembly must state hasReport explicitly or it goes out null (mezo-meyc.2).
        r.setHasReport(reportRepository
            .findByMesocycleIdAndCreatedByAndDeletedFalse(m.getId(), createdBy).isPresent());
        Map<String, VolumeProfile> volume = volumeLogRepository
            .findByCreatedByAndMesocycleIdInOrderByMuscleAsc(createdBy, List.of(m.getId())).stream()
            .collect(Collectors.toMap(v -> v.getMuscle(), mapper::toProfile, (a, b) -> a, LinkedHashMap::new));
        List<WorkoutSessionEntity> sessions =
            workoutSessionRepository.findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(m.getId()))
                .stream().filter(s -> s.getTemplateSessionId() == null).toList();
        List<UUID> sessionIds = sessions.stream().map(WorkoutSessionEntity::getId).toList();
        Map<UUID, List<ExerciseEntity>> exercisesBySession = sessionIds.isEmpty()
            ? Map.of()
            : exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, sessionIds)
                .stream().collect(Collectors.groupingBy(ExerciseEntity::getWorkoutSessionId));
        List<ExerciseEntity> allExercises = exercisesBySession.values().stream().flatMap(List::stream).toList();
        Map<UUID, CatalogMedia> mediaByCatalog = mediaByCatalogOf(allExercises);
        TrainingStyle block = TrainingStyle.fromWire(m.getTrainingStyle());
        CatalogAttributes.Lookup stability = styler.lookupRows(allExercises, block != null);
        List<MesoDay> days = sessions.stream()
            .map(s -> toDay(s, exercisesBySession.getOrDefault(s.getId(), List.of()), mediaByCatalog,
                block, stability)).toList();
        if (!volume.isEmpty()) {
            r.setVolumePerMuscle(volume);
        }
        if (!days.isEmpty()) {
            r.setDays(days);
        }
        return r;
    }

    private MesoDay toDay(WorkoutSessionEntity s, List<ExerciseEntity> exercises,
        Map<UUID, CatalogMedia> mediaByCatalog, TrainingStyle block, CatalogAttributes.Lookup stability) {
        return MesoDay.builder()
            .id(s.getId())
            .day(s.getDayLabel())
            .type(s.getType())
            .muscle(s.getMuscle())
            .exerciseCount(exercises.size())
            .exercises(exercises.stream().map(e -> {
                GymExercise g = mapper.toGymExercise(e);
                g.setEffectiveTrainingStyle(
                    styler.effective(e.getTrainingStyle(), e.getType(), e.getCatalogId(), block, stability,
                        e.isCountsTowardVolume()));
                if (e.getCatalogId() != null) {
                    CatalogMedia m = mediaByCatalog.get(e.getCatalogId());
                    if (m != null) {
                        g.setVideoUrl(m.videoUrl());
                        g.setImageStartUrl(m.imageStartUrl());
                        g.setImageEndUrl(m.imageEndUrl());
                    }
                }
                return g;
            }).toList())
            .note(s.getNote())
            .current("active".equals(s.getStatus()) ? Boolean.TRUE : null)
            .muscleAccent(s.isMuscleAccent() ? Boolean.TRUE : null)
            .build();
    }

    /**
     * Demo-video lookup {@code catalog_id → video_url} for the given exercises. Maps the exercises to
     * their catalog ids and delegates the single batched fetch to {@link CatalogMediaResolver}; rows
     * with no linked catalog or no video are simply absent. Shared by every {@link #toDay} caller.
     */
    private Map<UUID, CatalogMedia> mediaByCatalogOf(List<ExerciseEntity> exercises) {
        return catalogMediaResolver.resolve(exercises.stream()
            .map(ExerciseEntity::getCatalogId).filter(java.util.Objects::nonNull).toList());
    }
}
