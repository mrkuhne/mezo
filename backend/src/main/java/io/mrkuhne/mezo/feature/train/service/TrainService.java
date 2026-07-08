package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDay;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesocycleCreateRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.SportSessionResponse;
import io.mrkuhne.mezo.api.dto.GymExercise;
import io.mrkuhne.mezo.api.dto.VolumeProfile;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.mapper.TrainMapper;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Train slice service. Reads: {@code listMesocycles} loads each owned aggregate in three
 * index-friendly batch queries (volume logs, sessions, exercises) and stitches the per-muscle
 * volume profile and template days onto every mesocycle. Writes (T1): wizard create with nested
 * template days/exercises; derived fields ({@code endDate}, {@code currentWeek}, {@code
 * orderIndex}) are computed server-side. All finders are scoped by {@code createdBy} and ownership
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
    private final CatalogVideoResolver catalogVideoResolver;
    private final TrainMapper mapper;

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
        Map<UUID, String> videoByCatalog = videosByCatalog(
            exercisesBySession.values().stream().flatMap(List::stream).toList());

        Map<UUID, List<MesoDay>> daysByMeso = sessions.stream()
            .filter(s -> s.getMesocycleId() != null)
            .collect(Collectors.groupingBy(WorkoutSessionEntity::getMesocycleId, LinkedHashMap::new,
                Collectors.mapping(s -> toDay(s, exercisesBySession.getOrDefault(s.getId(), List.of()), videoByCatalog),
                    Collectors.toList())));

        return mesos.stream().map(m -> {
            MesocycleResponse r = mapper.toResponse(m);
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

    public List<SportSessionResponse> listSportSessions(UUID createdBy) {
        return sportSessionRepository.findByCreatedByAndDeletedFalseOrderByDateDesc(createdBy)
            .stream().map(mapper::toResponse).toList();
    }

    @Transactional
    public MesocycleResponse createMesocycle(UUID createdBy, MesocycleCreateRequest req) {
        MesocycleEntity m = new MesocycleEntity();
        m.setCreatedBy(createdBy); // server-side ownership — never from the client
        m.setTitle(req.getTitle());
        m.setShortTitle(req.getShortTitle() != null ? req.getShortTitle() : req.getTitle());
        m.setStatus(req.getStatus().getValue());
        m.setGoal(req.getGoal());
        m.setStartDate(req.getStartDate());
        m.setEndDate(req.getStartDate().plusWeeks(req.getWeeks()));
        m.setWeeks(req.getWeeks());
        m.setCurrentWeek(req.getStatus() == MesocycleCreateRequest.StatusEnum.ACTIVE
            ? clampWeek(req.getStartDate(), req.getWeeks())
            : 0);
        m.setSplit(req.getSplit());
        m.setStyle(req.getStyle());
        m.setPhaseCurve(req.getPhaseCurve().stream()
            .map(MesocycleCreateRequest.PhaseCurveEnum::getValue).toList());
        m.setNotes(req.getNotes());
        if (req.getStatus() == MesocycleCreateRequest.StatusEnum.ACTIVE) {
            // Single-active invariant holds on the create-as-active path too — the wizard's
            // "Aktiválás most" creates directly with active status (live-smoke regression).
            archiveActiveMesos(createdBy);
        }
        MesocycleEntity saved = mesocycleRepository.save(m);

        // Template days + exercises — orderIndex pinned by array order.
        List<MesoDayInput> days = req.getDays() != null ? req.getDays() : List.of();
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
        return assembleResponse(createdBy, saved);
    }

    @Transactional
    public MesocycleResponse activateMesocycle(UUID createdBy, UUID id) {
        MesocycleEntity target = ownedMesoOrThrow(createdBy, id);
        if (!"active".equals(target.getStatus())) {
            // Single-active invariant (spec rule): activating archives every other active meso.
            archiveActiveMesos(createdBy);
            target.setStatus("active");
            target.setCurrentWeek(clampWeek(target.getStartDate(), target.getWeeks()));
        }
        return assembleResponse(createdBy, target);
    }

    @Transactional
    public MesocycleResponse closeMesocycle(UUID createdBy, UUID id) {
        MesocycleEntity target = ownedMesoOrThrow(createdBy, id);
        if (!"archived".equals(target.getStatus())) {
            target.setStatus("archived");
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
        return toDay(day, saved, videosByCatalog(saved));
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

    /** Week containing today, clamped to [1, weeks] — week 1 before the start date. */
    private int clampWeek(LocalDate startDate, int weeks) {
        long week = ChronoUnit.DAYS.between(startDate, LocalDate.now()) / 7 + 1;
        return (int) Math.max(1, Math.min(weeks, week));
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
        e.setWarning(in.getWarning());
        e.setCatalogId(in.getCatalogId());
        e.setOrderIndex(orderIndex);
        return e;
    }

    /** Single-aggregate variant of the list stitching — write paths return the same shape as GET. */
    private MesocycleResponse assembleResponse(UUID createdBy, MesocycleEntity m) {
        MesocycleResponse r = mapper.toResponse(m);
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
        Map<UUID, String> videoByCatalog = videosByCatalog(
            exercisesBySession.values().stream().flatMap(List::stream).toList());
        List<MesoDay> days = sessions.stream()
            .map(s -> toDay(s, exercisesBySession.getOrDefault(s.getId(), List.of()), videoByCatalog)).toList();
        if (!volume.isEmpty()) {
            r.setVolumePerMuscle(volume);
        }
        if (!days.isEmpty()) {
            r.setDays(days);
        }
        return r;
    }

    private MesoDay toDay(WorkoutSessionEntity s, List<ExerciseEntity> exercises,
        Map<UUID, String> videoByCatalog) {
        return MesoDay.builder()
            .id(s.getId())
            .day(s.getDayLabel())
            .type(s.getType())
            .muscle(s.getMuscle())
            .exerciseCount(exercises.size())
            .exercises(exercises.stream().map(e -> {
                GymExercise g = mapper.toGymExercise(e);
                if (e.getCatalogId() != null) {
                    g.setVideoUrl(videoByCatalog.get(e.getCatalogId()));
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
     * their catalog ids and delegates the single batched fetch to {@link CatalogVideoResolver}; rows
     * with no linked catalog or no video are simply absent. Shared by every {@link #toDay} caller.
     */
    private Map<UUID, String> videosByCatalog(List<ExerciseEntity> exercises) {
        return catalogVideoResolver.resolve(exercises.stream()
            .map(ExerciseEntity::getCatalogId).filter(java.util.Objects::nonNull).toList());
    }
}
