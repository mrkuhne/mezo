package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.PrescribedSet;
import io.mrkuhne.mezo.api.dto.ProgressionSignal;
import io.mrkuhne.mezo.feature.train.config.HypertrophyProperties;
import io.mrkuhne.mezo.feature.train.config.TrainStyleProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.service.ProgressionDecider.Decision;
import io.mrkuhne.mezo.feature.train.service.ProgressionDecider.RefSet;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
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
    private final WeightGapService weightGapService;
    private final TrainStyleProperties styleProps;

    /**
     * Every knob of one prescription (mezo-r36n9.79). {@code style} is {@link StyleContext#NONE} for an
     * unstyled run; {@code today} anchors the same-range reference window.
     */
    public record PrescribeOptions(boolean deloadWeek, int effectiveWorkingSets, boolean holdOnly,
                                   BigDecimal loadFactor, int rirFloor, StyleContext style, LocalDate today) { }

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
        return prescribe(createdBy, ex, deloadWeek, effectiveWorkingSets, false);
    }

    /**
     * Readiness shape (Check-in 2.0, mezo-ck2): {@code holdOnly} caps the progression at HOLD —
     * no weight or rep increase versus last week ({@link ProgressionDecider#capAtHold}) — for the
     * day the user tapped „Könnyítsük". Lighter moves (deload, weight down) stand.
     */
    public Prescription prescribe(UUID createdBy, ExerciseEntity ex, boolean deloadWeek,
                                  int effectiveWorkingSets, boolean holdOnly) {
        return prescribe(createdBy, ex, deloadWeek, effectiveWorkingSets, holdOnly, null, 0);
    }

    /**
     * Kímélő mód shape (Kihagyás S2, mezo-q4xt2.2, spec §9.1.6): a non-null {@code loadFactor}
     * holds the progression ({@link ProgressionDecider#capAtHold}) and then scales the base to
     * {@code loadFactor} × it, snapped to the plate grid — lever DELOAD with the comeback
     * rationale. Every working set's target RIR is raised to at least {@code rirFloor} (0 = no
     * floor). A null {@code loadFactor} with a 0 floor is exactly the readiness shape.
     */
    public Prescription prescribe(UUID createdBy, ExerciseEntity ex, boolean deloadWeek,
                                  int effectiveWorkingSets, boolean holdOnly,
                                  BigDecimal loadFactor, int rirFloor) {
        return prescribe(createdBy, ex, new PrescribeOptions(deloadWeek, effectiveWorkingSets, holdOnly,
            loadFactor, rirFloor, StyleContext.NONE, LocalDate.now()));
    }

    /**
     * The full shape. A styled exercise ({@link StyleContext#styled()}, T1 §6) prescribes at the ramped
     * reserve with the style's rep overshoot and the ramped grind, and carries its rest on every set;
     * an unstyled one prescribes exactly as before. For everyone, the reference is rep-range-aware
     * (§6.7.1): a different-range reference whose top set lies inside its own range and outside the
     * current one is converted to the current range instead of being judged against it.
     */
    public Prescription prescribe(UUID createdBy, ExerciseEntity ex, PrescribeOptions o) {
        boolean deloadWeek = o.deloadWeek();
        BigDecimal loadFactor = o.loadFactor();
        StyleContext style = o.style();
        boolean styled = style.styled();
        boolean hold = o.holdOnly() || loadFactor != null;
        // The row's reserve unstyled (as before, may be null); the ramped reserve on a styled exercise.
        Integer targetRir = styled ? Integer.valueOf(style.effectiveReserve()) : ex.getTargetRir();
        ExerciseHistoryResolver.Reference reference =
            historyResolver.reference(createdBy, ex, o.today(), styleProps.sameRangeMaxAgeDays());
        ExerciseSetEntity ref = topSet(reference.sets());
        BigDecimal base;
        int workingReps;
        String rationale;
        ProgressionSignal progression;

        // A 0 kg reference is bodyweight: the proportional step is a fraction of the load, so it
        // takes the weightless rep path (mezo-xbhrm — it divided by zero and 500'd the today view).
        if (ref != null && ref.getWeightKg() != null && ref.getWeightKg().signum() > 0) {
            RefSet refSet = new RefSet(ref.getWeightKg(), ref.getReps(), ref.getRir());
            // Proportional step (mezo-bk7sn): candidates are the real weights — ever logged ∪ the
            // plate grid, minus the machine's known gaps (mezo-bk7l2).
            Set<BigDecimal> gaps = weightGapService.gaps(createdBy, ex);
            Set<BigDecimal> used = historyResolver.workingWeightsEverLogged(createdBy, ex);
            ProgressionDecider.StepPolicy policy = stepPolicy(ex.getType(), style);
            Decision d;
            if (converts(reference, ref.getReps(), ex.getRepMin(), ex.getRepMax())) {
                d = ProgressionDecider.convert(refSet, ex.getRepMin(), ex.getRepMax(), targetRir, policy, used, gaps);
                if (deloadWeek) { // convert ignores the deload: regress the converted base, as decide would
                    d = ProgressionDecider.deload(d.base(), ref.getWeightKg(), ex.getRepMin(), props.plateStep());
                }
            } else {
                d = ProgressionDecider.decide(refSet, ex.getRepMin(), ex.getRepMax(), targetRir, policy, used, gaps,
                    deloadWeek, styled ? ref.getTargetReps() : null, styled);
            }
            if (hold) {
                d = ProgressionDecider.capAtHold(d, refSet, ex.getRepMin(), ex.getRepMax());
            }
            if (loadFactor != null) {
                BigDecimal light = roundClamp(d.base().multiply(loadFactor));
                // A small weight can snap straight back to the held base (10 kg × 0.9 → 10): keep the
                // honest HOLD decision rather than claiming a lighter load it does not carry.
                if (light.compareTo(d.base()) != 0) {
                    d = new Decision(ProgressionDecider.Lever.DELOAD, light, d.workingReps(),
                        light.subtract(ref.getWeightKg()), d.deltaReps(), ProgressionDecider.COMEBACK_RATIONALE);
                }
            }
            base = d.base();
            workingReps = d.workingReps();
            rationale = d.rationale();
            BigDecimal deltaKg = d.deltaKg();
            // Per-machine weight memory (mezo-bk7l2): only a WEIGHT/DELOAD move computes a new kg —
            // REP/HOLD reuse the logged weight, which logging itself proved to exist. WEIGHT already
            // picks around known gaps, so in practice this reactive snap serves the deload.
            if (d.lever() == ProgressionDecider.Lever.WEIGHT || d.lever() == ProgressionDecider.Lever.DELOAD) {
                if (gaps.contains(WeightSnapper.norm(base))) {
                    Optional<WeightSnapper.Snap> snap = WeightSnapper.snap(
                        base, workingReps, targetRir, ex.getRepMin(), ex.getRepMax(), ref.getWeightKg(),
                        gaps, historyResolver.workingWeightsEverLogged(createdBy, ex), props.plateStep());
                    if (snap.isPresent()) {
                        rationale = rationale + " · " + strip(base) + " kg nincs a gépen → "
                            + strip(snap.get().weightKg()) + " kg";
                        base = snap.get().weightKg();
                        workingReps = snap.get().reps();
                        // Direction-preserving snap → never zero (WeightSnapper), so the lever stands.
                        deltaKg = base.subtract(ref.getWeightKg());
                    }
                }
            }
            progression = ProgressionSignal.builder()
                .lever(ProgressionSignal.LeverEnum.fromValue(d.lever().name().toLowerCase()))
                .deltaKg(deltaKg)
                .deltaReps(d.deltaReps())
                .targetWeightKg(base)
                .targetReps(workingReps)
                .rationale(rationale)
                .build();
        } else if (ref != null) {
            base = null; // weightless history (plyo/bodyweight)
            if (hold) {
                workingReps = Math.min(ref.getReps(), ex.getRepMax());
                rationale = ProgressionDecider.LIGHTENED_RATIONALE;
                progression = ProgressionSignal.builder()
                    .lever(ProgressionSignal.LeverEnum.HOLD)
                    .targetReps(workingReps)
                    .rationale(rationale)
                    .build();
            } else {
                workingReps = Math.min(ref.getReps() + 1, ex.getRepMax());
                rationale = "Testsúlyos — ismétlésre progresszálunk";
                progression = ProgressionSignal.builder()
                    .lever(ProgressionSignal.LeverEnum.REP)
                    .deltaReps(1)
                    .targetReps(workingReps)
                    .rationale(rationale)
                    .build();
            }
        } else if (ex.getAnchorWeightKg() != null) {
            base = roundClamp(loadFactor == null
                ? ex.getAnchorWeightKg() : ex.getAnchorWeightKg().multiply(loadFactor));
            workingReps = ex.getRepMax();
            rationale = loadFactor != null && base.compareTo(roundClamp(ex.getAnchorWeightKg())) != 0
                ? ProgressionDecider.COMEBACK_RATIONALE : "Kezdő súly (anchor)";
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
        int warmupSets = ex.getWarmupSets();
        if (warmupSets > 0) {
            for (HypertrophyProperties.Ramp r : warmupLadder(warmupSets)) {
                sets.add(PrescribedSet.builder()
                    .kind(PrescribedSet.KindEnum.WARMUP)
                    .targetWeightKg(base == null ? null : roundClamp(base.multiply(BigDecimal.valueOf(r.pct()))))
                    .targetReps(r.reps())
                    .targetRIR(null)
                    .restSec(style.restSec())
                    .build());
            }
        }
        int rirFloor = o.rirFloor();
        for (int j = 0; j < o.effectiveWorkingSets(); j++) {
            sets.add(PrescribedSet.builder()
                .kind(PrescribedSet.KindEnum.WORKING)
                .targetWeightKg(base)
                .targetReps(workingReps)
                .targetRIR(rirFloor > 0
                    ? Integer.valueOf(Math.max(rirFloor, targetRir == null ? 0 : targetRir))
                    : targetRir)
                .restSec(style.restSec())
                .build());
        }
        return new Prescription(sets, rationale, progression);
    }

    /** The unstyled policy, with the style's rep overshoot on a styled exercise (T1 §6.4). */
    private ProgressionDecider.StepPolicy stepPolicy(String type, StyleContext style) {
        return new ProgressionDecider.StepPolicy(
            props.stepPercent().getOrDefault(type, props.defaultStepPercent()), props.maxJump(),
            props.maxJumpReserve(), props.reserveSlack(),
            style.styled() ? style.repOverflow() : props.repOverflow(), props.plateStep());
    }

    /**
     * Convert only a different-range reference whose top set lies inside its OWN range and outside the
     * current one (plan decision "when to convert"); a same-range reference, or reps in the current
     * range, or reps outside both ranges are judged as before.
     */
    private static boolean converts(ExerciseHistoryResolver.Reference r, int reps, int repMin, int repMax) {
        if (r.sameRange() || (reps >= repMin && reps <= repMax)) {
            return false;
        }
        return reps >= r.refRepMin() && reps <= r.refRepMax();
    }

    /**
     * Top WORKING set of the reference instance (max weight, then reps). The reference is
     * identity-resolved (mezo-eq4w) so a day edit's row swap never resets double progression — the
     * pre-edit rows' history still anchors the target.
     */
    private static ExerciseSetEntity topSet(List<ExerciseSetEntity> sets) {
        return sets.stream()
            .max(Comparator
                .comparing((ExerciseSetEntity s) -> s.getWeightKg() != null ? s.getWeightKg() : BigDecimal.valueOf(-1))
                .thenComparing(ExerciseSetEntity::getReps))
            .orElse(null);
    }

    /**
     * Count-keyed warmup ladder (mezo-dnln): counts 1-3 map straight to their configured ladder;
     * counts above 3 prepend {@code n - 3} repeats of the 3-ladder's first rung ahead of the full
     * 3-ladder, preserving its ascending order.
     */
    private List<HypertrophyProperties.Ramp> warmupLadder(int n) {
        if (n <= 3) {
            return props.warmupLadders().get(n);
        }
        List<HypertrophyProperties.Ramp> ladder3 = props.warmupLadders().get(3);
        List<HypertrophyProperties.Ramp> extended = new ArrayList<>(ladder3.size() + n - 3);
        for (int i = 0; i < n - 3; i++) {
            extended.add(ladder3.get(0));
        }
        extended.addAll(ladder3);
        return extended;
    }

    private static String strip(BigDecimal x) {
        return x.stripTrailingZeros().toPlainString();
    }

    private BigDecimal roundClamp(BigDecimal x) {
        BigDecimal step = props.plateStep();
        BigDecimal rounded = x.divide(step, 0, RoundingMode.HALF_UP).multiply(step);
        return rounded.max(BigDecimal.ZERO).min(BigDecimal.valueOf(999));
    }
}
