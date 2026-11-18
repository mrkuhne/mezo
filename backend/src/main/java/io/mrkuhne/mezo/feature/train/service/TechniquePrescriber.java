package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.PrescribedLeg;
import io.mrkuhne.mezo.api.dto.PrescribedSet;
import io.mrkuhne.mezo.api.dto.SetLegKind;
import io.mrkuhne.mezo.feature.train.config.TrainTechniqueProperties;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Pure policy: puts the chosen technique (or the challenge, which wins and is partials) on the LAST
 * working set of a prescription (mezo-r36n9.80). No-op without a technique/challenge and in a deload
 * week. Never mutates the input: the technique set is a copy, the other sets are shared as-is.
 */
public final class TechniquePrescriber {

    private TechniquePrescriber() {}

    public static Prescription apply(Prescription p, Technique t, boolean challenge, boolean deloadWeek,
                                     Set<BigDecimal> realWeights, TrainTechniqueProperties cfg) {
        Technique eff = challenge ? Technique.PARTIALS : (t == null ? Technique.NONE : t);
        if (eff == Technique.NONE || deloadWeek || p == null || p.sets() == null) return p;
        int idx = -1;
        for (int i = 0; i < p.sets().size(); i++) {
            if (p.sets().get(i).getKind() == PrescribedSet.KindEnum.WORKING) idx = i;
        }
        if (idx < 0) return p;
        PrescribedSet main = p.sets().get(idx);
        PrescribedSet out = copy(main);
        out.setTechnique(eff.toApi());
        switch (eff) {
            case REST_DROP -> {
                var c = cfg.restDrop();
                out.setTargetRIR(c.mainReserve());
                out.setLegs(List.of(dropLeg(main, c, false, realWeights)));
            }
            case DROP -> {
                var c = cfg.drop();
                out.setTargetRIR(c.mainReserve());
                out.setLegs(List.of(dropLeg(main, c, true, realWeights)));
            }
            case MYO -> {
                var c = cfg.myo();
                out.setTargetRIR(c.mainReserve());
                List<PrescribedLeg> legs = new ArrayList<>();
                for (int i = 0; i < c.maxMinis(); i++) {
                    legs.add(new PrescribedLeg().kind(SetLegKind.MINI).weightKg(main.getTargetWeightKg())
                        .reps(c.miniReps()).minReps(c.miniMinReps()).toFailure(false)
                        .restBeforeSec(c.miniRestSec()));
                }
                out.setLegs(legs);
            }
            case PARTIALS -> {
                out.setTargetRIR(cfg.partials().mainReserve());
                out.setLegs(List.of(new PrescribedLeg().kind(SetLegKind.PARTIALS).toFailure(true)
                    .restBeforeSec(0)));
            }
            default -> { return p; }
        }
        List<PrescribedSet> sets = new ArrayList<>(p.sets());
        sets.set(idx, out);
        return new Prescription(List.copyOf(sets), p.rationale(), p.progression());
    }

    private static PrescribedLeg dropLeg(PrescribedSet main, TrainTechniqueProperties.Drop c,
                                         boolean toFailure, Set<BigDecimal> real) {
        PrescribedLeg leg = new PrescribedLeg().kind(SetLegKind.DROP).toFailure(toFailure)
            .restBeforeSec(c.restSec()).dropPercent(c.dropPercent());
        if (!toFailure) leg.setReps(main.getTargetReps());
        leg.setWeightKg(snapDown(main.getTargetWeightKg(), c.dropPercent(), real));
        return leg;
    }

    /** Nearest real weight at or below main x (1 - pct%); null when there is no weight or no such candidate. */
    private static BigDecimal snapDown(BigDecimal main, int dropPercent, Set<BigDecimal> real) {
        if (main == null || real == null || real.isEmpty()) return null;
        BigDecimal target = main.multiply(BigDecimal.valueOf(100 - dropPercent))
            .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        return real.stream().map(w -> w.setScale(2, RoundingMode.HALF_UP))
            .filter(w -> w.compareTo(target) <= 0 && w.signum() > 0)
            .max(BigDecimal::compareTo).orElse(null);
    }

    private static PrescribedSet copy(PrescribedSet s) {
        return new PrescribedSet().kind(s.getKind()).targetWeightKg(s.getTargetWeightKg())
            .targetReps(s.getTargetReps()).targetRIR(s.getTargetRIR()).restSec(s.getRestSec())
            .technique(s.getTechnique()).legs(new ArrayList<>(s.getLegs()));
    }
}
