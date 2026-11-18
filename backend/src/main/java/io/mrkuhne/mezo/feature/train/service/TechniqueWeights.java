package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.HypertrophyProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * The real-weight candidates a technique's drop leg snaps to (mezo-r36n9.80): the same set the progression's
 * range conversion uses — ever logged on this exercise's identity ∪ the plate grid, minus the machine's known
 * gaps. Loaded only for an exercise that actually carries a technique or the challenge.
 */
@Component
@RequiredArgsConstructor
public class TechniqueWeights {

    private final ExerciseHistoryResolver historyResolver;
    private final WeightGapService weightGapService;
    private final HypertrophyProperties props;

    /** {@code maxKg}: the heaviest weight a drop can start from (the grid is built up to it). */
    public Set<BigDecimal> realWeights(UUID createdBy, ExerciseEntity ex, BigDecimal maxKg) {
        Set<BigDecimal> out = new HashSet<>();
        for (BigDecimal w : historyResolver.workingWeightsEverLogged(createdBy, ex)) {
            out.add(WeightSnapper.norm(w));
        }
        if (maxKg != null && maxKg.signum() > 0) {
            BigDecimal step = props.plateStep();
            for (BigDecimal w = step; w.compareTo(maxKg) <= 0; w = w.add(step)) {
                out.add(WeightSnapper.norm(w));
            }
        }
        out.removeAll(weightGapService.gaps(createdBy, ex));
        return out;
    }
}
