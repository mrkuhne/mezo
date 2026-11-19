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
 * weight, over live parent working sets, per challenge setup (mezo-r36n9.98: the technique before the half reps, or
 * none). Read-only and derived — never stored (ADR 0016).
 */
@Service
@RequiredArgsConstructor
public class PartialsBest {

    private final ExerciseSetLegRepository legRepository;

    /** One record: the best partials reps at a parent weight. */
    public record Best(BigDecimal weightKg, int reps) { }

    /**
     * Records per weight of one challenge setup ({@link TechniqueRules#challengeSetup}), ascending by weight.
     * {@code identityKey}: see {@link ExerciseHistoryResolver#identityKey}.
     */
    public List<Best> bestPerWeight(UUID createdBy, String identityKey, String setup) {
        return legRepository.bestPartialsPerWeight(createdBy, identityKey, setup).stream()
            .map(r -> new Best(r.getWeightKg(), r.getReps()))
            .toList();
    }

    /**
     * Plain-challenge records (setup {@code none}) per weight for EVERY identity in one read (key:
     * {@link ExerciseHistoryResolver#identityKey}).
     */
    public Map<String, List<Best>> bestPerWeightByIdentity(UUID createdBy) {
        Map<String, List<Best>> out = new LinkedHashMap<>();
        for (ExerciseSetLegRepository.IdentityPartialsRow r : legRepository.bestPartialsPerWeightAll(createdBy)) {
            out.computeIfAbsent(r.getIdentityKey(), k -> new ArrayList<>()).add(new Best(r.getWeightKg(), r.getReps()));
        }
        return out;
    }

    /**
     * The best at exactly {@code weightKg} among earlier sets of the same challenge setup — the technique done
     * before the half reps ({@link TechniqueRules#challengeSetup} of {@code technique}), so the number to beat is a
     * fair one (mezo-r36n9.98); null when there is no record or no weight.
     */
    public Integer at(UUID createdBy, ExerciseEntity ex, BigDecimal weightKg, Technique technique) {
        if (weightKg == null) {
            return null;
        }
        return bestPerWeight(createdBy, ExerciseHistoryResolver.identityKey(ex),
                TechniqueRules.challengeSetup(technique)).stream()
            .filter(b -> b.weightKg().compareTo(weightKg) == 0)
            .map(Best::reps)
            .findFirst().orElse(null);
    }
}
