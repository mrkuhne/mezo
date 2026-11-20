package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.ExerciseCatalogItem;
import io.mrkuhne.mezo.api.dto.ExerciseSubstitute;
import io.mrkuhne.mezo.api.dto.ExerciseSubstituteLabel;
import io.mrkuhne.mezo.api.dto.ExerciseSubstitutesResponse;
import io.mrkuhne.mezo.api.dto.LastTopSet;
import io.mrkuhne.mezo.api.dto.SuggestionPrescription;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Candidate;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Ranked;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Result;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * The reads both suggestion entry points share (mezo-r36n9.66 workout swap, mezo-r36n9.116 block day editor):
 * the candidate pool, the per-candidate state, last top sets, today's pain joints and the response rendering.
 * One copy, so the two reads cannot drift apart.
 */
@Component
@RequiredArgsConstructor
class SubstituteReads {

    /** Hungarian accusative of the check-in pain joints, for the "kíméli …, amit ma jeleztél" phrase. */
    private static final Map<String, String> JOINT_HU = Map.of(
        "shoulder", "a válladat", "elbow", "a könyöködet", "wrist", "a csuklódat",
        "lower-back", "a derekadat", "hip", "a csípődet", "knee", "a térdedet", "ankle", "a bokádat");

    private final ExerciseCatalogRepository catalogRepository;
    private final ExerciseHistoryResolver historyResolver;
    private final ReadinessAssessor readinessAssessor;
    private final ExerciseCatalogService exerciseCatalogService;

    /** The master catalogue plus the user's own exercises, in muscle → name order. */
    List<ExerciseCatalogEntity> pool(UUID userId) {
        return catalogRepository.findAllByOrderByMuscleAscNameAsc().stream()
            .filter(c -> c.getCreatedBy() == null || userId.equals(c.getCreatedBy()))
            .toList();
    }

    /** Every pool row with the user's state on it, in pool order. */
    static List<Candidate> candidates(List<ExerciseCatalogEntity> pool, GymAvailability gym,
                                      Map<UUID, PainLevel> pain, Map<UUID, ExerciseSetEntity> topSets) {
        List<Candidate> out = new ArrayList<>(pool.size());
        for (ExerciseCatalogEntity c : pool) {
            out.add(candidate(c, gym.available(c), pain.getOrDefault(c.getId(), PainLevel.NONE),
                topSets.containsKey(c.getId())));
        }
        return out;
    }

    static Candidate candidate(ExerciseCatalogEntity c, boolean available, PainLevel pain, boolean doneBefore) {
        return new Candidate(c.getId(), c.getMuscle(), c.getType(), c.getGear(), c.getPattern(),
            c.getSecondaryMuscles(), c.getJoints(), c.getLengthened(), c.getDemand(), c.getStim(), c.getFatigue(),
            c.getCreatedBy() != null, available, pain, doneBefore);
    }

    /** The catalogue joints today's morning check-in reports as painful; empty without a check-in. */
    Set<String> painJointsToday(UUID userId, LocalDate today) {
        return readinessAssessor.morningCheckIn(userId, today)
            .map(c -> PainJointMap.joints(c.painRegions())).orElse(Set.of());
    }

    /** A painful joint the outgoing exercise loads wins; else the first mapped painful joint; else null. */
    static String painJointHu(Set<String> painJoints, List<String> outJoints) {
        String joint = painJoints.stream().filter(j -> outJoints != null && outJoints.contains(j)).findFirst()
            .orElse(painJoints.stream().filter(JOINT_HU::containsKey).findFirst().orElse(null));
        return joint == null ? null : JOINT_HU.get(joint);
    }

    /** Per catalogue id: the heaviest set (then most reps) of the newest completed instance; absent = never done. */
    Map<UUID, ExerciseSetEntity> topSets(UUID userId, List<ExerciseCatalogEntity> exercises) {
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

    /**
     * Renders the ranker's result: suggestion items with their reason sentence, signals, last top set and the
     * caller's prescription (null-returning for the workout swap), then the quiet labels in pool order.
     */
    ExerciseSubstitutesResponse response(AppUserEntity viewer, List<ExerciseCatalogEntity> pool, Result result,
                                         String painJointHu, Map<UUID, ExerciseSetEntity> topSets,
                                         Function<ExerciseCatalogEntity, SuggestionPrescription> prescription) {
        Map<UUID, ExerciseCatalogEntity> byId = pool.stream()
            .collect(Collectors.toMap(ExerciseCatalogEntity::getId, Function.identity()));
        List<ExerciseCatalogItem> items = exerciseCatalogService.toItems(viewer,
            result.suggestions().stream().map(r -> byId.get(r.id())).toList());
        List<ExerciseSubstitute> suggestions = new ArrayList<>();
        for (int i = 0; i < result.suggestions().size(); i++) {
            Ranked r = result.suggestions().get(i);
            ExerciseCatalogEntity entity = byId.get(r.id());
            suggestions.add(new ExerciseSubstitute()
                .exercise(items.get(i))
                .reasonText(SubstituteReason.sentence(r.signals(), painJointHu, entity.getType()))
                .signals(r.signals().stream().map(Enum::name).toList())
                .lastTopSet(lastTopSet(topSets.get(r.id())))
                .prescription(prescription.apply(entity)));
        }
        List<ExerciseSubstituteLabel> labels = new ArrayList<>();
        for (ExerciseCatalogEntity c : pool) { // pool order: deterministic
            ExerciseSubstituteRanker.Label label = result.labels().get(c.getId());
            if (label != null) {
                labels.add(new ExerciseSubstituteLabel().catalogId(c.getId())
                    .label(ExerciseSubstituteLabel.LabelEnum.valueOf(label.name())));
            }
        }
        return new ExerciseSubstitutesResponse().suggestions(suggestions).labels(labels);
    }

    private static LastTopSet lastTopSet(ExerciseSetEntity s) {
        return s == null ? null : new LastTopSet().weightKg(s.getWeightKg()).reps(s.getReps());
    }
}
