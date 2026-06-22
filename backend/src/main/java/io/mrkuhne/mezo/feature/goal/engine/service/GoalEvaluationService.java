package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalProjectionService.ProjectionSegment;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson.Feasibility;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson.GuardStatus;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson.Segment;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * The G5 <b>heuristic feasibility gate</b> (spec §5.1, D9–D10) + the <b>segmented prescription
 * assembly</b> (spec §3.3 / §5.4). Pure-deterministic, config-driven, <em>never blocks or throws</em>:
 * it grades a trajectory and emits human (Hungarian) notes, then folds the projection segments (Task
 * 6) + guard status (Task 7) into the {@link GoalPrescriptionJson} artifact. The orchestrator
 * {@link GoalEngineService} owns the I/O (loading inputs + persisting the result); this service is the
 * decision + assembly core, kept side-effect-free so it is trivially unit-/integration-testable.
 *
 * <h2>Feasibility checks (deterministic, per trajectory)</h2>
 * <ol>
 *   <li><b>Rate realism (§6.5).</b> The goal's {@code rateTargetPctPerWeek} is graded against the
 *       rate band ({@code mezo.goal.rate}): {@code maintain} expects ≈0; {@code cut}/{@code bulk} use
 *       the same symmetric band — within {@code bandHigh} (1.0 %/wk) is clean, over {@code bandHigh}
 *       but within {@code capPctPerWeek} (1.0; here equal) warns, strictly over {@code capPctPerWeek}
 *       is <b>aggressive</b>. The "bias lower as leaner" advice (cut, low bf%) adds a softer note when
 *       a lean athlete sits in the upper half of the band.</li>
 *   <li><b>Guard satisfiability (§6.5).</b> From {@link GuardStatus} (Task 7): if the muscle guard is
 *       active and any muscle sits below maintenance volume → a warning note; the prescribed protein
 *       target is always emitted but {@code proteinMonitored=false} (Fuel not built) → a note records
 *       it. A breached strength e1RM trend → a warning note.</li>
 *   <li><b>Conflict detection (§5.1).</b> An aggressive (over-band) rate + an active running block +
 *       an active strength guard → a note flagging the likely strength breach and suggesting easing
 *       the deficit or shifting the run block.</li>
 * </ol>
 *
 * <p><b>Verdict.</b> {@code aggressive} when the rate is strictly over the cap or a conflict is
 * detected; {@code feasible-with-warnings} when any softer warning fired (over-band-but-capped rate,
 * below-maintenance volume, strength breach); otherwise {@code feasible}. Guards are soft (D9) — the
 * gate NEVER blocks; the verdict only colours the surface.
 */
@Service
@RequiredArgsConstructor
public class GoalEvaluationService {

    private static final String TRAJ_CUT = "cut";
    private static final String TRAJ_BULK = "bulk";
    private static final String TRAJ_MAINTAIN = "maintain";
    private static final String SYSTEM_RUN = "run";

    private static final String VERDICT_FEASIBLE = "feasible";
    private static final String VERDICT_WARNINGS = "feasible-with-warnings";
    private static final String VERDICT_AGGRESSIVE = "aggressive";

    private static final String BASIS_FORMULA = "formula";

    /** Default sleep target (h/night). The Sleep-domain bridge (spec §5.4) is future; this is a seed. */
    private static final BigDecimal DEFAULT_SLEEP_TARGET_H = new BigDecimal("8.0");

    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

    private final GoalEngineProperties props;
    private final GoalFeasibilityService feasibilityService;

    /**
     * Grade feasibility + assemble the full prescription artifact. Pure: no I/O, no throw.
     *
     * @param goal         the goal (trajectory, rateTargetPctPerWeek, guards)
     * @param weightKg     the current body weight (kg) — the protein-target basis
     * @param bodyFatPct   body-fat % when known (enables the LBM protein path), else {@code null}
     * @param segments     the projection segments (Task 6) — the per-segment kcal/rate spine
     * @param guards       the soft-guard status (Task 7)
     * @return the assembled {@link GoalPrescriptionJson}; {@code basis="formula"}, {@code generatedAt=now}
     */
    public GoalPrescriptionJson assemble(
        GoalEntity goal,
        BigDecimal weightKg,
        BigDecimal bodyFatPct,
        List<ProjectionSegment> segments,
        GuardStatus guards) {

        Feasibility feasibility = grade(goal, segments, guards);
        int proteinG = proteinTargetGrams(weightKg, bodyFatPct);

        List<Segment> rxSegments = new ArrayList<>(segments.size());
        for (ProjectionSegment seg : segments) {
            rxSegments.add(new Segment(
                seg.fromWeek(),
                seg.toWeek(),
                seg.label(),
                seg.targetKcal().setScale(0, RoundingMode.HALF_UP).intValueExact(),
                proteinG,
                DEFAULT_SLEEP_TARGET_H,
                List.of(), // rest-day placement is a future Train bridge (no deload weeks derivable here).
                seg.projectedRateKgPerWk(),
                seg.rationale()));
        }

        return new GoalPrescriptionJson(
            OffsetDateTime.now(), BASIS_FORMULA, rxSegments, guards, feasibility);
    }

    /**
     * The "no biometric profile" graceful artifact (spec — Task 9 relies on this not throwing). A
     * single empty-segment-free recept carrying only the feasibility note; bootstrap stays null on the
     * goal because there is no profile to compute one from.
     */
    public GoalPrescriptionJson missingProfile(GuardStatus guards) {
        Feasibility feasibility = new Feasibility(
            VERDICT_WARNINGS,
            List.of("Biometriai profil szükséges az értékeléshez (nem, magasság, születési dátum)."));
        return new GoalPrescriptionJson(
            OffsetDateTime.now(), BASIS_FORMULA, List.of(), guards, feasibility);
    }

    // ── feasibility grading ───────────────────────────────────────────────────────────────────────

    private Feasibility grade(GoalEntity goal, List<ProjectionSegment> segments, GuardStatus guards) {
        List<String> notes = new ArrayList<>();
        boolean aggressive = false;
        boolean warnings = false;

        // 1. Rate realism.
        RateGrade rate = gradeRate(goal);
        aggressive |= rate.aggressive();
        warnings |= rate.warning();
        notes.addAll(rate.notes());

        // 2. Guard satisfiability. Real breaches (below-maintenance volume, strength regression) warn;
        // the protein-not-monitored line is informational only and must NOT downgrade the verdict.
        GuardNotes guardNotes = gradeGuards(goal, guards);
        warnings |= guardNotes.hasWarning();
        notes.addAll(guardNotes.notes());

        // 3. Conflict: over-band rate + active running + active strength guard.
        if (rate.overBand() && hasRunning(segments) && strengthActive(guards)) {
            aggressive = true;
            notes.add("Konfliktus: agresszív ütem + aktív futóblokk + erő-védő → valószínű erő-visszaesés. "
                + "Javaslat: enyhítsd a deficitet vagy told arrébb a futóblokkot.");
        }

        String verdict = aggressive ? VERDICT_AGGRESSIVE : (warnings ? VERDICT_WARNINGS : VERDICT_FEASIBLE);
        return new Feasibility(verdict, notes);
    }

    /**
     * Grade {@code rateTargetPctPerWeek} against the band. The cut/bulk machinery is symmetric (only
     * the trajectory wording differs); maintain expects ≈0. The cap/band → verdict classification is
     * delegated to {@link GoalFeasibilityService#verdictForRate(BigDecimal)} so the eval gate and the
     * stateless feasibility preview share ONE band definition: {@code aggressive} (over cap),
     * {@code feasible-with-warnings} (over the recommended target but within the cap), else clean.
     */
    private RateGrade gradeRate(GoalEntity goal) {
        String trajectory = trajectory(goal);
        BigDecimal rate = goal.getRateTargetPctPerWeek() == null
            ? BigDecimal.ZERO : goal.getRateTargetPctPerWeek().abs();
        List<String> notes = new ArrayList<>();

        if (TRAJ_MAINTAIN.equals(trajectory)) {
            // Maintain should sit at ≈0; a non-trivial target rate is a (soft) mismatch warning.
            if (rate.compareTo(new BigDecimal(String.valueOf(props.rate().bandLow()))) >= 0) {
                notes.add("Karbantartó cél nem nulla ütemmel (" + rate.toPlainString()
                    + " %BW/hét); a karbantartás ~0 ütemet vár.");
                return new RateGrade(false, true, false, notes);
            }
            return new RateGrade(false, false, false, notes);
        }

        String word = TRAJ_BULK.equals(trajectory) ? "tömegelő (zsírnyereség)" : "fogyási";
        String verdict = feasibilityService.verdictForRate(rate);

        if (VERDICT_AGGRESSIVE.equals(verdict)) {
            notes.add("Agresszív " + word + " ütem: " + rate.toPlainString() + " %BW/hét > "
                + props.rate().capPctPerWeek() + " %BW/hét sapka.");
            return new RateGrade(true, false, true, notes);
        }
        if (VERDICT_WARNINGS.equals(verdict)) {
            notes.add("Magas " + word + " ütem: " + rate.toPlainString() + " %BW/hét a javasolt "
                + "ütem (" + props.rate().targetPctPerWeek() + " %BW/hét) felett.");
            return new RateGrade(false, true, true, notes);
        }
        return new RateGrade(false, false, false, notes);
    }

    /**
     * Guard-satisfiability + protein-monitoring notes from the Task 7 status. Separates real
     * <em>warning</em> breaches (below-maintenance volume, strength regression — these downgrade the
     * verdict) from the informational protein-not-monitored line (Fuel deferred — surfaced, but it
     * does NOT colour an otherwise-feasible plan).
     */
    private GuardNotes gradeGuards(GoalEntity goal, GuardStatus guards) {
        List<String> notes = new ArrayList<>();
        boolean warning = false;
        if (guards == null) {
            return new GuardNotes(false, notes);
        }
        GuardStatus.Muscle muscle = guards.muscle();
        if (muscle != null && Boolean.TRUE.equals(muscle.active())) {
            if (muscle.belowMaintenanceMuscles() != null && !muscle.belowMaintenanceMuscles().isEmpty()) {
                notes.add("Izom-védő: a heti volumen karbantartás alatt — "
                    + String.join(", ", muscle.belowMaintenanceMuscles())
                    + " (a célhoz volumen-emelés ajánlott).");
                warning = true;
            }
            // Protein target is prescribed but not monitored (Fuel intake not built) — informational.
            notes.add("A fehérje-célt előírjuk, de még nem monitorozzuk (a Fuel modul hiányzik).");
        }
        GuardStatus.Strength strength = guards.strength();
        if (strength != null && Boolean.TRUE.equals(strength.active())
            && Boolean.TRUE.equals(strength.breached())) {
            notes.add("Erő-védő: a fő gyakorlat becsült 1RM-je esik — a cél veszélyeztetheti az erőt.");
            warning = true;
        }
        return new GuardNotes(warning, notes);
    }

    private static boolean hasRunning(List<ProjectionSegment> segments) {
        return segments.stream().anyMatch(s -> s.activeSystems() != null
            && s.activeSystems().contains(SYSTEM_RUN));
    }

    private static boolean strengthActive(GuardStatus guards) {
        return guards != null && guards.strength() != null
            && Boolean.TRUE.equals(guards.strength().active());
    }

    // ── protein target ──────────────────────────────────────────────────────────────────────────

    /**
     * Protein target (g/day). The BW path is {@code gPerKgBwDefault} (2.0) × weight; when bf% is known
     * the LBM path {@code gPerKgLbmHigh} (3.1) × LBM is also considered, the higher of the two is
     * taken, and the result is capped at {@code gPerKgBwCap} (2.6) × weight. Rounded to whole grams.
     */
    int proteinTargetGrams(BigDecimal weightKg, BigDecimal bodyFatPct) {
        BigDecimal bwTarget = BigDecimal.valueOf(props.protein().gPerKgBwDefault()).multiply(weightKg);
        BigDecimal target = bwTarget;
        if (bodyFatPct != null) {
            BigDecimal lbm = weightKg.multiply(
                BigDecimal.ONE.subtract(bodyFatPct.divide(ONE_HUNDRED, 6, RoundingMode.HALF_UP)));
            BigDecimal lbmTarget = BigDecimal.valueOf(props.protein().gPerKgLbmHigh()).multiply(lbm);
            target = target.max(lbmTarget);
        }
        BigDecimal cap = BigDecimal.valueOf(props.protein().gPerKgBwCap()).multiply(weightKg);
        return target.min(cap).setScale(0, RoundingMode.HALF_UP).intValueExact();
    }

    private static String trajectory(GoalEntity goal) {
        return goal.getTrajectory() == null ? TRAJ_CUT : goal.getTrajectory().trim().toLowerCase();
    }

    /**
     * Outcome of the rate-realism check. {@code aggressive} → verdict aggressive; {@code warning} →
     * verdict at least with-warnings; {@code overBand} → eligible for the conflict rule (strictly over
     * the sustainable band, whether capped-warning or over-cap-aggressive); plus the human notes.
     */
    private record RateGrade(boolean aggressive, boolean warning, boolean overBand, List<String> notes) {
    }

    /** Guard notes split into the warning flag (verdict-affecting) and the full note list (surfaced). */
    private record GuardNotes(boolean hasWarning, List<String> notes) {
    }
}
