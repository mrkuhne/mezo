package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.PrescribedSet;
import io.mrkuhne.mezo.api.dto.ProgressionSignal;
import io.mrkuhne.mezo.feature.train.config.HypertrophyProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.service.ProgressionDecider.Decision;
import io.mrkuhne.mezo.feature.train.service.ProgressionDecider.RefSet;
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

    /** Plan-1 shape: prescribes against the exercise's own template {@code workingSets}. */
    public Prescription prescribe(UUID createdBy, ExerciseEntity ex, boolean deloadWeek) {
        return prescribe(createdBy, ex, deloadWeek, ex.getWorkingSets());
    }

    /**
     * Plan-2 shape (DA6): {@code effectiveWorkingSets} overrides the working-set COUNT (volume
     * rollover's distributed set target) while every other decision — reference lookup, base
     * weight/reps, warmup ramp — stays keyed off the exercise's own recipe fields.
     */
    public Prescription prescribe(
            UUID createdBy, ExerciseEntity ex, boolean deloadWeek, int effectiveWorkingSets) {
        ExerciseSetEntity ref = referenceWorkingSet(createdBy, ex);
        BigDecimal base;
        int workingReps;
        String rationale;
        ProgressionSignal progression;

        if (ref != null && ref.getWeightKg() != null) {
            BigDecimal inc = props.increment().getOrDefault(ex.getType(), props.defaultIncrement());
            Decision d = ProgressionDecider.decide(
                new RefSet(ref.getWeightKg(), ref.getReps(), ref.getRir()),
                ex.getRepMin(), ex.getRepMax(), ex.getTargetRir(), inc, props.plateStep(), deloadWeek);
            base = d.base();
            workingReps = d.workingReps();
            rationale = d.rationale();
            progression = ProgressionSignal.builder()
                .lever(ProgressionSignal.LeverEnum.fromValue(d.lever().name().toLowerCase()))
                .deltaKg(d.deltaKg())
                .deltaReps(d.deltaReps())
                .targetWeightKg(d.base())
                .targetReps(d.workingReps())
                .rationale(d.rationale())
                .build();
        } else if (ref != null) {
            base = null; // weightless history (plyo/bodyweight)
            workingReps = Math.min(ref.getReps() + 1, ex.getRepMax());
            rationale = "Testsúlyos — ismétlésre progresszálunk";
            progression = ProgressionSignal.builder()
                .lever(ProgressionSignal.LeverEnum.REP)
                .deltaReps(1)
                .targetReps(workingReps)
                .rationale(rationale)
                .build();
        } else if (ex.getAnchorWeightKg() != null) {
            base = roundClamp(ex.getAnchorWeightKg());
            workingReps = ex.getRepMax();
            rationale = "Kezdő súly (anchor)";
            progression = null;
        } else {
            base = null;
            workingReps = ex.getRepMax();
            rationale = "Első alkalom — add meg a súlyt";
            progression = null;
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
        for (int j = 0; j < effectiveWorkingSets; j++) {
            sets.add(PrescribedSet.builder()
                .kind(PrescribedSet.KindEnum.WORKING)
                .targetWeightKg(base)
                .targetReps(workingReps)
                .targetRIR(ex.getTargetRir())
                .build());
        }
        return new Prescription(sets, rationale, progression);
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
}
