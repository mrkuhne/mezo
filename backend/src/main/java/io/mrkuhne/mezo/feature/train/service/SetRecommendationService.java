package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.PrescribedSet;
import io.mrkuhne.mezo.feature.train.config.HypertrophyProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Hypertrophy Drive — computes the prescribed warmup + working sets for one template exercise's
 * upcoming session (spec D2 double progression). Pure read; the switch is enforced by the caller
 * (WorkoutService.getToday via ObjectProvider&lt;HypertrophyDriveGate&gt;).
 */
@Service
@RequiredArgsConstructor
public class SetRecommendationService {

    private final ExerciseHistoryResolver historyResolver;
    private final HypertrophyProperties props;

    public Prescription prescribe(UUID createdBy, ExerciseEntity ex) {
        ExerciseSetEntity ref = referenceWorkingSet(createdBy, ex);
        BigDecimal base;
        String rationale;

        if (ref != null && ref.getWeightKg() != null) {
            int rp = ref.getReps();
            BigDecimal inc = props.increment().getOrDefault(ex.getType(), props.defaultIncrement());
            BigDecimal w = ref.getWeightKg();
            if (rp >= ex.getRepMax()) {
                base = w.add(inc);
                rationale = "Múlt hét " + rp + " × " + strip(w) + " kg → +" + strip(inc) + " kg";
            } else if (rp < ex.getRepMin()) {
                base = w.subtract(inc);
                rationale = "Múlt hét " + rp + " rep a cél alatt → −" + strip(inc) + " kg";
            } else {
                base = w;
                rationale = "Múlt hét " + rp + " rep a tartományban → súly tart, cél +1 rep";
            }
            base = roundClamp(base);
        } else if (ref != null) {
            base = null; // weightless history (plyo/bodyweight)
            rationale = "Testsúlyos — ismétlésre progresszálunk";
        } else if (ex.getAnchorWeightKg() != null) {
            base = roundClamp(ex.getAnchorWeightKg());
            rationale = "Kezdő súly (anchor)";
        } else {
            base = null;
            rationale = "Első alkalom — add meg a súlyt";
        }

        List<PrescribedSet> sets = new ArrayList<>();
        // Warmup rows are emitted even with no base weight (first session, no anchor): the FE
        // relies on them to label B1/B2 and to suppress RIR — only the target weight stays null.
        for (int i = 0; i < ex.getWarmupSets(); i++) {
            HypertrophyProperties.Ramp r = props.warmupRamp().get(Math.min(i, props.warmupRamp().size() - 1));
            sets.add(PrescribedSet.builder()
                .kind(PrescribedSet.KindEnum.WARMUP)
                .targetWeightKg(base == null ? null : roundClamp(base.multiply(BigDecimal.valueOf(r.pct()))))
                .targetReps(Math.max(1, (int) Math.round(ex.getRepMax() * r.repsFactor())))
                .targetRIR(null)
                .build());
        }
        for (int j = 0; j < ex.getWorkingSets(); j++) {
            sets.add(PrescribedSet.builder()
                .kind(PrescribedSet.KindEnum.WORKING)
                .targetWeightKg(base)
                .targetReps(ex.getRepMax())
                .targetRIR(ex.getTargetRir())
                .build());
        }
        return new Prescription(sets, rationale);
    }

    /**
     * Top WORKING set of the most recent completed session where this exercise's IDENTITY was
     * trained (max weight, then reps). Identity-resolved (mezo-eq4w) so a day edit's row swap
     * never resets double progression — the pre-edit rows' history still anchors the target.
     */
    private ExerciseSetEntity referenceWorkingSet(UUID createdBy, ExerciseEntity ex) {
        return historyResolver.latestCompletedWorkingSets(createdBy, List.of(ex))
            .getOrDefault(ex.getId(), List.of()).stream()
            .max(Comparator
                .comparing((ExerciseSetEntity s) -> s.getWeightKg() != null ? s.getWeightKg() : BigDecimal.valueOf(-1))
                .thenComparing(ExerciseSetEntity::getReps))
            .orElse(null);
    }

    private BigDecimal roundClamp(BigDecimal x) {
        BigDecimal step = props.plateStep();
        BigDecimal rounded = x.divide(step, 0, RoundingMode.HALF_UP).multiply(step);
        return rounded.max(BigDecimal.ZERO).min(BigDecimal.valueOf(999));
    }

    private String strip(BigDecimal x) {
        return x.stripTrailingZeros().toPlainString();
    }
}
