package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.ExerciseCatalogItem;
import io.mrkuhne.mezo.api.dto.ExerciseSubstitute;
import io.mrkuhne.mezo.api.dto.ExerciseSubstituteLabel;
import io.mrkuhne.mezo.api.dto.ExerciseSubstitutesResponse;
import io.mrkuhne.mezo.api.dto.LastTopSet;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseDiscomfortRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Candidate;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Context;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Ranked;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Result;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The reasoned swap read (mezo-r36n9.66, spec 2026-11-17 §6.2): gathers the user's state — gym profile,
 * recent joint discomfort, today's check-in pain, the swap-time "nem esik jól" note, the running block's
 * goal, logged history — and hands it to the pure {@link ExerciseSubstituteRanker}, then renders the
 * reason sentences. Pure read; the candidate pool is the master catalogue plus the user's own exercises.
 */
@Service
@RequiredArgsConstructor
public class ExerciseSubstituteService {

    /** Hungarian accusative of the check-in pain joints, for the "kíméli …, amit ma jeleztél" phrase. */
    private static final Map<String, String> JOINT_HU = Map.of(
        "shoulder", "a válladat", "elbow", "a könyöködet", "wrist", "a csuklódat",
        "lower-back", "a derekadat", "hip", "a csípődet", "knee", "a térdedet", "ankle", "a bokádat");

    private final WorkoutExerciseChangeService workoutExerciseChangeService;
    private final ExerciseDiscomfortService exerciseDiscomfortService;
    private final ExerciseDiscomfortRepository discomfortRepository;
    private final ExerciseRepository exerciseRepository;
    private final ExerciseCatalogRepository catalogRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final MesocycleRepository mesocycleRepository;
    private final GymProfileService gymProfileService;
    private final DiscomfortHistory discomfortHistory;
    private final ExerciseHistoryResolver historyResolver;
    private final ReadinessAssessor readinessAssessor;
    private final ExerciseCatalogService exerciseCatalogService;

    @Transactional(readOnly = true)
    public ExerciseSubstitutesResponse substitutes(AppUserEntity viewer, UUID workoutId, UUID exerciseId) {
        UUID userId = viewer.getId();
        WorkoutSessionEntity instance = workoutExerciseChangeService.activeInstanceOrThrow(userId, workoutId);
        ExerciseEntity outRow = exerciseDiscomfortService.rowOrThrow(userId, instance, exerciseId);
        LocalDate today = instance.getDate() != null ? instance.getDate() : LocalDate.now();

        List<ExerciseCatalogEntity> pool = catalogRepository.findAllByOrderByMuscleAscNameAsc().stream()
            .filter(c -> c.getCreatedBy() == null || userId.equals(c.getCreatedBy()))
            .toList();
        ExerciseCatalogEntity outCatalog = outRow.getCatalogId() == null ? null
            : pool.stream().filter(c -> c.getId().equals(outRow.getCatalogId())).findFirst().orElse(null);

        // Only rows that can ever rank are loaded for history: the outgoing muscle and its body region.
        String outMuscle = outCatalog != null ? outCatalog.getMuscle() : outRow.getMuscle();
        String region = ExerciseSubstituteRanker.region(outMuscle);
        List<ExerciseCatalogEntity> relevant = pool.stream()
            .filter(c -> Objects.equals(region, ExerciseSubstituteRanker.region(c.getMuscle())))
            .toList();

        GymAvailability gym = gymProfileService.availability(userId);
        Map<UUID, PainLevel> pain = discomfortHistory.levels(userId, relevant, today);
        Map<UUID, ExerciseSetEntity> topSets = topSets(userId, relevant);

        List<Candidate> candidates = new ArrayList<>();
        for (ExerciseCatalogEntity c : relevant) {
            candidates.add(candidate(c, gym.available(c), pain.getOrDefault(c.getId(), PainLevel.NONE),
                topSets.containsKey(c.getId())));
        }
        Candidate out = outCatalog != null
            ? candidate(outCatalog, true, PainLevel.NONE, false)
            : new Candidate(outRow.getId(), outRow.getMuscle(), outRow.getType(), null, null, null, null, null, null,
                null, null, true, true, PainLevel.NONE, false);

        boolean soreNow = discomfortRepository.findByCreatedByAndIdentityKeyAndNotedOn(
            userId, ExerciseHistoryResolver.identityKey(outRow), today).isPresent();
        Set<String> painJoints = readinessAssessor.morningCheckIn(userId, today)
            .map(c -> PainJointMap.joints(c.painRegions())).orElse(Set.of());
        Context ctx = new Context(goalPreset(instance), soreNow, painJoints, inWorkout(userId, instance));

        Result result = ExerciseSubstituteRanker.rank(out, candidates, ctx);

        Map<UUID, ExerciseCatalogEntity> byId = relevant.stream()
            .collect(Collectors.toMap(ExerciseCatalogEntity::getId, Function.identity()));
        List<ExerciseCatalogItem> items = exerciseCatalogService.toItems(viewer,
            result.suggestions().stream().map(r -> byId.get(r.id())).toList());
        String painJointHu = painJoints.stream().map(JOINT_HU::get).filter(Objects::nonNull).findFirst().orElse(null);
        List<ExerciseSubstitute> suggestions = new ArrayList<>();
        for (int i = 0; i < result.suggestions().size(); i++) {
            Ranked r = result.suggestions().get(i);
            ExerciseCatalogEntity entity = byId.get(r.id());
            suggestions.add(new ExerciseSubstitute()
                .exercise(items.get(i))
                .reasonText(SubstituteReason.sentence(r.signals(), painJointHu, entity.getType()))
                .signals(r.signals().stream().map(Enum::name).toList())
                .lastTopSet(lastTopSet(topSets.get(r.id()))));
        }
        List<ExerciseSubstituteLabel> labels = new ArrayList<>();
        for (ExerciseCatalogEntity c : relevant) { // pool order: deterministic
            ExerciseSubstituteRanker.Label label = result.labels().get(c.getId());
            if (label != null) {
                labels.add(new ExerciseSubstituteLabel().catalogId(c.getId())
                    .label(ExerciseSubstituteLabel.LabelEnum.valueOf(label.name())));
            }
        }
        return new ExerciseSubstitutesResponse().suggestions(suggestions).labels(labels);
    }

    private static Candidate candidate(ExerciseCatalogEntity c, boolean available, PainLevel pain, boolean doneBefore) {
        return new Candidate(c.getId(), c.getMuscle(), c.getType(), c.getGear(), c.getPattern(),
            c.getSecondaryMuscles(), c.getJoints(), c.getLengthened(), c.getDemand(), c.getStim(), c.getFatigue(),
            c.getCreatedBy() != null, available, pain, doneBefore);
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

    /** Per catalogue id: the heaviest set (then most reps) of the newest completed instance; absent = never done. */
    private Map<UUID, ExerciseSetEntity> topSets(UUID userId, List<ExerciseCatalogEntity> exercises) {
        List<ExerciseEntity> probes = exercises.stream().map(c -> {
            ExerciseEntity probe = new ExerciseEntity();
            probe.setId(c.getId()); // keys the resolver's answer by catalogue id
            probe.setCatalogId(c.getId());
            probe.setName(c.getName());
            return probe;
        }).toList();
        Map<UUID, ExerciseSetEntity> out = new HashMap<>();
        historyResolver.latestCompletedWorkingSets(userId, probes).forEach((id, sets) -> {
            Optional<ExerciseSetEntity> top = sets.stream().filter(s -> s.getReps() != null)
                .max(Comparator.comparing((ExerciseSetEntity s) ->
                    s.getWeightKg() == null ? BigDecimal.ZERO : s.getWeightKg())
                    .thenComparing(ExerciseSetEntity::getReps));
            top.ifPresent(s -> out.put(id, s));
        });
        return out;
    }

    private static LastTopSet lastTopSet(ExerciseSetEntity s) {
        return s == null ? null : new LastTopSet().weightKg(s.getWeightKg()).reps(s.getReps());
    }
}
