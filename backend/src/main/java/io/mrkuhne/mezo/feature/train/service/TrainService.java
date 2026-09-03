package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.CustomWorkoutResponse;
import io.mrkuhne.mezo.api.dto.CustomWorkoutUpsertRequest;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDay;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.SportSessionResponse;
import io.mrkuhne.mezo.api.dto.GymExercise;
import io.mrkuhne.mezo.api.dto.VolumeBaseline;
import io.mrkuhne.mezo.api.dto.VolumeProfile;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.MesocycleActivated;
import io.mrkuhne.mezo.feature.train.MesocycleClosed;
import io.mrkuhne.mezo.feature.train.service.CatalogMediaResolver.CatalogMedia;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleReportEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.ProvenanceEnvelope;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.config.TrainProperties;
import io.mrkuhne.mezo.feature.train.mapper.TrainMapper;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleReportRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import io.mrkuhne.mezo.feature.train.VolumeProgressionGate;
import lombok.RequiredArgsConstructor;
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
@Service
@RequiredArgsConstructor
public class TrainService {

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
    private final TrainProperties trainProperties;
    // Baseline seeding (mezo-xlmp): volume-log rows born on the create-as-active/activate path,
    // behind the volume-progression switch (gate bean absent ⇔ switch off — mirrors WorkoutService).
    private final VolumeProgressionService volumeProgressionService;
    private final ObjectProvider<VolumeProgressionGate> volumeGate;
    // mezo-meyc.3: fires only on a REAL close (never the idempotent re-close or fill-if-null
    // branches) — the companion AI-review generator's AFTER_COMMIT trigger (S3 task 15).
    private final ApplicationEventPublisher eventPublisher;

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
        Map<UUID, CatalogMedia> mediaByCatalog = mediaByCatalogOf(
            exercisesBySession.values().stream().flatMap(List::stream).toList());

        Map<UUID, List<MesoDay>> daysByMeso = sessions.stream()
            .filter(s -> s.getMesocycleId() != null)
            .collect(Collectors.groupingBy(WorkoutSessionEntity::getMesocycleId, LinkedHashMap::new,
                Collectors.mapping(s -> toDay(s, exercisesBySession.getOrDefault(s.getId(), List.of()), mediaByCatalog),
                    Collectors.toList())));
        // hasReport in ONE batched query (mezo-meyc.2) — the Történet list's "van riportja" flag
        // must never become a per-run lookup.
        Set<UUID> reported = reportRepository
            .findByCreatedByAndMesocycleIdInAndDeletedFalse(createdBy, mesoIds).stream()
            .map(MesocycleReportEntity::getMesocycleId).collect(Collectors.toSet());

        return mesos.stream().map(m -> {
            MesocycleResponse r = mapper.toResponse(m);
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
        List<String> phaseCurve,
        String notes,
        String status,
        List<MesoDayInput> days,
        Map<String, VolumeBaseline> volumePerMuscle,
        Map<String, String> musclePriorities
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
        m.setStartDate(src.startDate());
        m.setEndDate(src.startDate().plusWeeks(src.weeks()));
        m.setWeeks(src.weeks());
        m.setCurrentWeek(active ? MesoWeeks.clampWeek(src.startDate(), src.weeks()) : 0);
        // split/style are optional on a template but NOT NULL on a run — an unset one becomes "".
        m.setSplit(src.split() != null ? src.split() : "");
        m.setStyle(src.style() != null ? src.style() : "");
        // Defensive copy: the source list belongs to the template row — two managed entities must
        // never share one text[] collection instance.
        m.setPhaseCurve(List.copyOf(src.phaseCurve()));
        m.setNotes(src.notes());
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
        // Volume baselines (mezo-xlmp + mezo-meyc.1): only an ACTIVE run carries volume-log rows —
        // a planned run stays profile-less until activation (MesoVolume's "csak aktív" guard). The
        // plan's own landmarks win; seedBaselines then fills every trained group it left out.
        if (active && volumeGate.getIfAvailable() != null) {
            seedPlanBaselines(createdBy, saved.getId(), src.volumePerMuscle(), src.musclePriorities());
            volumeProgressionService.seedBaselines(createdBy, saved.getId(), src.musclePriorities());
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
        // Unconditional (even when already active): idempotent seeding doubles as the backfill
        // path for pre-mezo-xlmp mesos that were created without volume-log rows.
        if (volumeGate.getIfAvailable() != null) {
            volumeProgressionService.seedBaselines(createdBy, id, target.getMusclePriorities());
        }
        if (!"active".equals(target.getStatus())) {
            // Single-active invariant (spec rule): activating archives every other active meso.
            archiveActiveMesos(createdBy);
            target.setStatus("active");
            target.setCurrentWeek(MesoWeeks.clampWeek(target.getStartDate(), target.getWeeks()));
            // Real activation only — AFTER_COMMIT consumers (Diet Plan slice 4) see it once this
            // transaction lands.
            eventPublisher.publishEvent(new MesocycleActivated(createdBy, id));
        }
        return assembleResponse(createdBy, target);
    }

    /** GD7: the map change is stored now, applied at the next weekly rollover — nothing rewritten retroactively. */
    @Transactional
    public MesocycleResponse updateMusclePriorities(UUID createdBy, UUID id, Map<String, String> priorities) {
        MesocycleEntity m = OwnershipGuard.ownedOrThrow(mesocycleRepository.findById(id), createdBy);
        Map<String, String> normalized = PriorityTier.normalize(priorities);
        m.setMusclePriorities(normalized.isEmpty() ? null : Map.copyOf(normalized));
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

    @Transactional
    public MesoDay replaceDayExercises(UUID createdBy, UUID mesoId, UUID dayId, List<GymExerciseInput> inputs) {
        ownedMesoOrThrow(createdBy, mesoId);
        WorkoutSessionEntity day = OwnershipGuard.ownedOrThrow(
            workoutSessionRepository.findById(dayId)
                .filter(s -> mesoId.equals(s.getMesocycleId())),
            createdBy);

        // Full-list replace: soft-delete the current rows (@SQLDelete flips is_deleted), then
        // insert the new list with orderIndex pinned by array order.
        exerciseRepository.deleteAll(exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, List.of(dayId)));
        List<ExerciseEntity> fresh = new ArrayList<>(inputs.size());
        for (int i = 0; i < inputs.size(); i++) {
            fresh.add(toExerciseEntity(createdBy, dayId, inputs.get(i), i));
        }
        List<ExerciseEntity> saved = exerciseRepository.saveAll(fresh);
        return toDay(day, saved, mediaByCatalogOf(saved));
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
        return templates.stream()
            .map(t -> toCustomWorkoutResponse(t, byTemplate.getOrDefault(t.getId(), List.of()), media))
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

    /** Full-list replace, same soft-delete + re-insert pattern as {@link #replaceDayExercises}. */
    private CustomWorkoutResponse replaceCustomExercises(
            UUID createdBy, WorkoutSessionEntity template, List<GymExerciseInput> inputs) {
        exerciseRepository.deleteAll(exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, List.of(template.getId())));
        List<ExerciseEntity> fresh = new ArrayList<>(inputs.size());
        for (int i = 0; i < inputs.size(); i++) {
            fresh.add(toExerciseEntity(createdBy, template.getId(), inputs.get(i), i));
        }
        List<ExerciseEntity> saved = exerciseRepository.saveAll(fresh);
        return toCustomWorkoutResponse(template, saved, mediaByCatalogOf(saved));
    }

    private CustomWorkoutResponse toCustomWorkoutResponse(
            WorkoutSessionEntity template, List<ExerciseEntity> exercises, Map<UUID, CatalogMedia> media) {
        return CustomWorkoutResponse.builder()
            .id(template.getId())
            .name(template.getType())
            .exercises(toDay(template, exercises, media).getExercises())
            .build();
    }

    /**
     * The plan document's per-muscle landmarks become the run's volume-log rows, wrapped in the
     * same baseline {@link ProvenanceEnvelope} shape {@link VolumeProgressionService#seedBaselines}
     * writes ({@code currentSets = } the tier's week-1 start (EMPHASIZE MEV+2, else MEV)). Runs
     * BEFORE that RP-table seeding, whose idempotency then leaves these rows untouched and only
     * fills the groups the plan left out.
     */
    private void seedPlanBaselines(
            UUID createdBy, UUID mesoId, Map<String, VolumeBaseline> baselines, Map<String, String> priorities) {
        if (baselines == null || baselines.isEmpty()) {
            return;
        }
        List<MuscleGroupVolumeLogEntity> rows = new ArrayList<>(baselines.size());
        baselines.forEach((muscle, b) -> {
            MuscleGroupVolumeLogEntity row = new MuscleGroupVolumeLogEntity();
            row.setCreatedBy(createdBy);
            row.setMesocycleId(mesoId);
            row.setMuscle(muscle);
            row.setMev(b.getMev());
            row.setMav(b.getMav());
            row.setMrv(b.getMrv());
            row.setCurrentSets(PriorityTier.of(priorities, muscle).weekOneStart(b.getMev(), b.getMav(), b.getMrv()));
            // confidence is contract-required on VolumeSource; 0.5 = plan-level numbers, not
            // personalized from logged performance.
            row.setSource(new ProvenanceEnvelope(
                new ProvenanceEnvelope.Baseline(b.getName(), b.getMev(), b.getMav(), b.getMrv()),
                List.of(), 0.5,
                "Sablon baseline — a mesociklus indításakor a sablonból másolva.",
                null));
            rows.add(row);
        });
        volumeLogRepository.saveAll(rows);
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
        e.setOrderIndex(orderIndex);
        return e;
    }

    /** Single-aggregate variant of the list stitching — write paths return the same shape as GET. */
    private MesocycleResponse assembleResponse(UUID createdBy, MesocycleEntity m) {
        MesocycleResponse r = mapper.toResponse(m);
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
        Map<UUID, CatalogMedia> mediaByCatalog = mediaByCatalogOf(
            exercisesBySession.values().stream().flatMap(List::stream).toList());
        List<MesoDay> days = sessions.stream()
            .map(s -> toDay(s, exercisesBySession.getOrDefault(s.getId(), List.of()), mediaByCatalog)).toList();
        if (!volume.isEmpty()) {
            r.setVolumePerMuscle(volume);
        }
        if (!days.isEmpty()) {
            r.setDays(days);
        }
        return r;
    }

    private MesoDay toDay(WorkoutSessionEntity s, List<ExerciseEntity> exercises,
        Map<UUID, CatalogMedia> mediaByCatalog) {
        return MesoDay.builder()
            .id(s.getId())
            .day(s.getDayLabel())
            .type(s.getType())
            .muscle(s.getMuscle())
            .exerciseCount(exercises.size())
            .exercises(exercises.stream().map(e -> {
                GymExercise g = mapper.toGymExercise(e);
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
