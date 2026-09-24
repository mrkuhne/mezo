package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.HypertrophyProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseWeightGapEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseWeightGapRepository;
import java.math.BigDecimal;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Per-machine weight memory (mezo-bk7l2): learns which weights are MISSING on an exercise's
 * machine from what the user logs, and forgets a gap the moment a set is logged at it. The owner
 * decided on no setup UI — the only signal is a near swap away from the engine's original
 * prescription ({@link WeightSnapper#isNearSwap}); a bigger swap is a choice, not evidence.
 */
@Service
@RequiredArgsConstructor
public class WeightGapService {

    private final ExerciseWeightGapRepository gapRepository;
    private final HypertrophyProperties props;

    /**
     * One set was logged (or edited) at {@code loggedKg}. Heals that weight; and, for a working set
     * logged near but not at {@code prescribedKg}, records the prescribed weight as missing.
     */
    @Transactional
    public void onLogged(UUID createdBy, ExerciseEntity ex, String kind, BigDecimal loggedKg, BigDecimal prescribedKg) {
        if (loggedKg == null || loggedKg.signum() <= 0) {
            return;
        }
        String key = ExerciseHistoryResolver.identityKey(ex);
        gapRepository.findByCreatedByAndIdentityKeyAndWeightKg(createdBy, key, WeightSnapper.norm(loggedKg))
            .ifPresent(gapRepository::delete);
        if (!"working".equals(kind) || prescribedKg == null || prescribedKg.signum() <= 0) {
            return;
        }
        BigDecimal inc = props.increment().getOrDefault(ex.getType(), props.defaultIncrement());
        if (!WeightSnapper.isNearSwap(prescribedKg, loggedKg, inc, props.gapNearFraction())) {
            return;
        }
        BigDecimal missing = WeightSnapper.norm(prescribedKg);
        if (gapRepository.findByCreatedByAndIdentityKeyAndWeightKg(createdBy, key, missing).isEmpty()) {
            ExerciseWeightGapEntity gap = new ExerciseWeightGapEntity();
            gap.setCreatedBy(createdBy);
            gap.setIdentityKey(key);
            gap.setWeightKg(missing);
            gapRepository.save(gap);
        }
    }

    /** The weights known to be missing on this exercise's machine. */
    public Set<BigDecimal> gaps(UUID createdBy, ExerciseEntity ex) {
        return gapRepository.findByCreatedByAndIdentityKey(createdBy, ExerciseHistoryResolver.identityKey(ex))
            .stream().map(g -> WeightSnapper.norm(g.getWeightKg())).collect(Collectors.toSet());
    }
}
