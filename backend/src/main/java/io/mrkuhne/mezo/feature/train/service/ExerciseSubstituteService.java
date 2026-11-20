package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.ExerciseSubstitutesResponse;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseDiscomfortRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Candidate;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Context;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Result;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The reasoned swap read (mezo-r36n9.66, spec 2026-11-17 §6.2): gathers the user's state — gym profile,
 * recent joint discomfort, today's check-in pain, the swap-time "nem esik jól" note, the running block's
 * goal, logged history — and hands it to the pure {@link ExerciseSubstituteRanker}, then renders the
 * reason sentences. Pure read; the candidate pool is the master catalogue plus the user's own exercises.
 * The pool, candidate state and rendering are shared with the block day editor through {@link SubstituteReads}.
 */
@Service
@RequiredArgsConstructor
public class ExerciseSubstituteService {

    private final WorkoutExerciseChangeService workoutExerciseChangeService;
    private final ExerciseDiscomfortService exerciseDiscomfortService;
    private final ExerciseDiscomfortRepository discomfortRepository;
    private final ExerciseRepository exerciseRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final MesocycleRepository mesocycleRepository;
    private final GymProfileService gymProfileService;
    private final DiscomfortHistory discomfortHistory;
    private final SubstituteReads reads;

    @Transactional(readOnly = true)
    public ExerciseSubstitutesResponse substitutes(AppUserEntity viewer, UUID workoutId, UUID exerciseId) {
        UUID userId = viewer.getId();
        WorkoutSessionEntity instance = workoutExerciseChangeService.activeInstanceOrThrow(userId, workoutId);
        ExerciseEntity outRow = exerciseDiscomfortService.rowOrThrow(userId, instance, exerciseId);
        LocalDate today = instance.getDate() != null ? instance.getDate() : LocalDate.now();

        List<ExerciseCatalogEntity> pool = reads.pool(userId);
        ExerciseCatalogEntity outCatalog = outRow.getCatalogId() == null ? null
            : pool.stream().filter(c -> c.getId().equals(outRow.getCatalogId())).findFirst().orElse(null);

        // Only rows that can ever rank are loaded for history: the outgoing muscle and its body region.
        String outMuscle = outCatalog != null ? outCatalog.getMuscle() : outRow.getMuscle();
        String region = ExerciseSubstituteRanker.region(outMuscle);
        List<ExerciseCatalogEntity> relevant = pool.stream()
            .filter(c -> Objects.equals(region, ExerciseSubstituteRanker.region(c.getMuscle())))
            .toList();

        GymAvailability gym = gymProfileService.availability(userId);
        // Labels cover the whole user-visible pool (the full searchable list); history only the rankable rows.
        Map<UUID, PainLevel> pain = discomfortHistory.levels(userId, pool, today);
        Map<UUID, ExerciseSetEntity> topSets = reads.topSets(userId, relevant);

        List<Candidate> candidates = SubstituteReads.candidates(pool, gym, pain, topSets);
        Candidate out = outCatalog != null
            ? SubstituteReads.candidate(outCatalog, true, PainLevel.NONE, false)
            : new Candidate(outRow.getId(), outRow.getMuscle(), outRow.getType(), null, null, null, null, null, null,
                null, null, true, true, PainLevel.NONE, false);

        boolean soreNow = discomfortRepository.findByCreatedByAndIdentityKeyAndNotedOn(
            userId, ExerciseHistoryResolver.identityKey(outRow), today).isPresent();
        Set<String> painJoints = reads.painJointsToday(userId, today);
        Context ctx = new Context(goalPreset(instance), soreNow, painJoints, inWorkout(userId, instance));

        Result result = ExerciseSubstituteRanker.rank(out, candidates, ctx);
        return reads.response(viewer, pool, result, SubstituteReads.painJointHu(painJoints, out.joints()), topSets,
            c -> null);
    }

    /** No block, or a block without a goal, reads as null — the ranker treats it as hypertrophy. */
    private String goalPreset(WorkoutSessionEntity instance) {
        UUID mesoId = instance.getMesocycleId();
        if (mesoId == null && instance.getTemplateSessionId() != null) {
            mesoId = workoutSessionRepository.findById(instance.getTemplateSessionId())
                .map(WorkoutSessionEntity::getMesocycleId).orElse(null);
        }
        return mesoId == null ? null
            : mesocycleRepository.findById(mesoId).map(MesocycleEntity::getGoalPreset).orElse(null);
    }

    /** Catalogue ids already part of today's workout: the day's plan minus rows swapped out, plus today's changes. */
    private Set<UUID> inWorkout(UUID userId, WorkoutSessionEntity instance) {
        List<ExerciseEntity> rows = exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(
            userId, List.of(instance.getTemplateSessionId(), instance.getId()));
        Set<UUID> replaced = rows.stream().filter(r -> instance.getId().equals(r.getWorkoutSessionId()))
            .map(ExerciseEntity::getReplacesExerciseId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<UUID> out = new HashSet<>();
        for (ExerciseEntity r : rows) {
            boolean addedToday = instance.getId().equals(r.getAddedInWorkoutId());
            if (r.getCatalogId() != null && !replaced.contains(r.getId()) && !addedToday) {
                out.add(r.getCatalogId());
            }
        }
        return out;
    }
}
