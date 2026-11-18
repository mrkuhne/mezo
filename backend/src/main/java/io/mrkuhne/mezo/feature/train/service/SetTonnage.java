package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetLegEntity;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Tonnage of a logged set (mezo-r36n9.80, spec §6.4): the parent row's weight × reps PLUS its {@code drop} and
 * {@code mini} legs' weight × reps — never {@code partials} (a lengthened-range half rep is not comparable load).
 * A leg without a weight or reps contributes nothing (a bodyweight drop has no load to add; inheriting the
 * parent's weight would invent kilos the owner never wrote down). The one reader of legs for every tonnage
 * figure — {@code SESSION_VOLUME} medal, the records' best session / total volume, the gym signal's volume per
 * muscle — so they can never disagree. Records, e1RM and the other medals read parent rows only.
 */
@Service
@RequiredArgsConstructor
public class SetTonnage {

    /** Leg kinds that carry load into tonnage. */
    static final Set<String> LOADED_LEG_KINDS = Set.of("drop", "mini");

    private final SetLegService setLegService;

    /**
     * Extra tonnage per parent set id from its loaded legs — one batched read, and only over sets that carry a
     * technique (legs exist only on those). Pass LIVE parent sets only; sets without loaded legs are absent.
     */
    public Map<UUID, BigDecimal> legTonnage(Collection<ExerciseSetEntity> sets) {
        List<UUID> ids = sets.stream()
            .filter(s -> s.getTechnique() != null && s.getId() != null)
            .map(ExerciseSetEntity::getId)
            .collect(Collectors.toList());
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<UUID, BigDecimal> out = new HashMap<>();
        setLegService.legsBySetIds(ids).forEach((setId, legs) -> {
            BigDecimal t = legsTonnage(legs);
            if (t.signum() > 0) {
                out.put(setId, t);
            }
        });
        return out;
    }

    /** Σ weight × reps of the loaded ({@code drop}/{@code mini}) legs; partials and unweighted legs add 0. */
    public static BigDecimal legsTonnage(List<ExerciseSetLegEntity> legs) {
        return legs.stream()
            .filter(l -> LOADED_LEG_KINDS.contains(l.getKind()) && l.getWeightKg() != null && l.getReps() != null)
            .map(l -> l.getWeightKg().multiply(BigDecimal.valueOf(l.getReps())))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** The parent row's own weight × reps; 0 for a bodyweight or rep-less row. */
    public static BigDecimal parentTonnage(ExerciseSetEntity s) {
        return s.getWeightKg() != null && s.getReps() != null
            ? s.getWeightKg().multiply(BigDecimal.valueOf(s.getReps())) : BigDecimal.ZERO;
    }

    /** One set's full tonnage: parent + its loaded legs from a {@link #legTonnage} map. */
    public static BigDecimal of(ExerciseSetEntity s, Map<UUID, BigDecimal> legTonnage) {
        return parentTonnage(s).add(legTonnage.getOrDefault(s.getId(), BigDecimal.ZERO));
    }
}
