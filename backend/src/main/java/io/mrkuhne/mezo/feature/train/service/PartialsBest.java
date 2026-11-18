package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetLegRepository;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * PARTIALS_BEST (mezo-r36n9.80): the best reps of a {@code partials} leg per exercise identity at a given parent
 * weight, over live parent working sets. Read-only and derived — never stored (ADR 0016).
 */
@Service
@RequiredArgsConstructor
public class PartialsBest {

    private final ExerciseSetLegRepository legRepository;

    /** One record: the best partials reps at a parent weight. */
    public record Best(BigDecimal weightKg, int reps) { }

    /** Records per weight, ascending by weight. {@code identityKey}: see {@link ExerciseHistoryResolver#identityKey}. */
    public List<Best> bestPerWeight(UUID createdBy, String identityKey) {
        return legRepository.bestPartialsPerWeight(createdBy, identityKey).stream()
            .map(r -> new Best(r.getWeightKg(), r.getReps()))
            .toList();
    }

    /** Records per weight for EVERY identity in one read (key: {@link ExerciseHistoryResolver#identityKey}). */
    public Map<String, List<Best>> bestPerWeightByIdentity(UUID createdBy) {
        Map<String, List<Best>> out = new LinkedHashMap<>();
        for (ExerciseSetLegRepository.IdentityPartialsRow r : legRepository.bestPartialsPerWeightAll(createdBy)) {
            out.computeIfAbsent(r.getIdentityKey(), k -> new ArrayList<>()).add(new Best(r.getWeightKg(), r.getReps()));
        }
        return out;
    }

    /** The best at exactly {@code weightKg}; null when there is no record or no weight. */
    public Integer at(UUID createdBy, ExerciseEntity ex, BigDecimal weightKg) {
        if (weightKg == null) {
            return null;
        }
        return bestPerWeight(createdBy, ExerciseHistoryResolver.identityKey(ex)).stream()
            .filter(b -> b.weightKg().compareTo(weightKg) == 0)
            .map(Best::reps)
            .findFirst().orElse(null);
    }
}
