package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.MesoDay;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.SportSessionResponse;
import io.mrkuhne.mezo.api.dto.VolumeProfile;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.mapper.TrainMapper;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Read-only assembly of the Train slice responses. {@code listMesocycles} loads each owned
 * aggregate in three index-friendly batch queries (volume logs, sessions, exercises) and stitches
 * the per-muscle volume profile and template days onto every mesocycle. All finders are scoped by
 * {@code createdBy}, so cross-user data never leaks. No {@code @Transactional}: per house rule
 * (spring_patterns.md) only write paths open a transaction.
 */
@Service
@RequiredArgsConstructor
public class TrainService {

    private final MesocycleRepository mesocycleRepository;
    private final MuscleGroupVolumeLogRepository volumeLogRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final SportSessionRepository sportSessionRepository;
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

        List<WorkoutSessionEntity> sessions =
            workoutSessionRepository.findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, mesoIds);
        List<UUID> sessionIds = sessions.stream().map(WorkoutSessionEntity::getId).toList();
        Map<UUID, List<ExerciseEntity>> exercisesBySession = sessionIds.isEmpty()
            ? Map.of()
            : exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, sessionIds)
                .stream().collect(Collectors.groupingBy(ExerciseEntity::getWorkoutSessionId));

        Map<UUID, List<MesoDay>> daysByMeso = sessions.stream()
            .filter(s -> s.getMesocycleId() != null)
            .collect(Collectors.groupingBy(WorkoutSessionEntity::getMesocycleId, LinkedHashMap::new,
                Collectors.mapping(s -> toDay(s, exercisesBySession.getOrDefault(s.getId(), List.of())),
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

    private MesoDay toDay(WorkoutSessionEntity s, List<ExerciseEntity> exercises) {
        return MesoDay.builder()
            .day(s.getDayLabel())
            .type(s.getType())
            .muscle(s.getMuscle())
            .exerciseCount(exercises.size())
            .exercises(exercises.stream().map(mapper::toGymExercise).toList())
            .note(s.getNote())
            .current("active".equals(s.getStatus()) ? Boolean.TRUE : null)
            .muscleAccent(s.isMuscleAccent() ? Boolean.TRUE : null)
            .build();
    }
}
