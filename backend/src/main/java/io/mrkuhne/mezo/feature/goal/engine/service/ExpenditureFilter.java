package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * The learned-expenditure estimator (mezo-zz91i, spec §5.2): a 3-state linear Kalman filter over
 * {@code [m tissue kg, w transient water kg, B base kcal/day]}, one step per calendar day, seeded
 * with the formula base as the prior. A usable intake day links weight to B through
 * {@code Δm = (I − B − movement)/ρ}; an unknown or excluded day drifts by the goal balance with a
 * wide variance and carries no information about B. A weigh-in observes {@code m + w + G}, where G
 * is the deterministic glycogen-water input from the carb EWMA, so a sustained carb change is not
 * read as tissue. Pure: no I/O, no Spring.
 */
public final class ExpenditureFilter {

    private ExpenditureFilter() {
    }

    /**
     * One calendar day, days ascending and contiguous.
     *
     * @param intakeKcal   usable logged intake, or {@code null} (unlogged / excluded)
     * @param carbsG       that day's carbs when {@code intakeKcal} is usable, else {@code null}
     * @param movementKcal the day's served logged movement (planned + extra, mezo-tb3s2)
     * @param balanceKcal  the goal's daily energy balance (the drift assumed on an unknown day)
     * @param weightKg     the day's mean scale weight, or {@code null}
     */
    public record Day(LocalDate date, Integer intakeKcal, Integer carbsG, int movementKcal, int balanceKcal,
                      Double weightKg) {
    }

    public record Estimate(double baseKcal, double sdKcal) {
    }

    /** A run's posterior plus its per-day state trace (mezo-y72o3, the "Hogy tanultam?" explainer). */
    public record Traced(Estimate estimate, List<DayTrace> days) {
    }

    /**
     * The filtered state at the end of one day (after that day's weigh-in update, if any): tissue
     * {@code m}, transient water {@code w} and the glycogen-water input {@code G} the day's weigh-in
     * was priced against — so {@code m + w + G} is the de-noised scale trend.
     */
    public record DayTrace(LocalDate date, double tissueKg, double waterKg, double glycogenKg) {
    }

    public record Params(int kcalPerKg, double priorSdKcal, double sigmaScaleKg, double sigmaTissueKg,
                         double intakeErrorPct, double sigmaUnknownKcal, double waterPhi, double sigmaWaterKg,
                         double sigmaBaseKcal, double glycogenKgPerG, double glycogenMaxKg, double glycogenAlpha,
                         double sigmaInitMassKg, double sigmaInitWaterKg) {

        public static Params of(int kcalPerKg, int priorSdKcal, GoalEngineProperties.Expenditure e) {
            return new Params(kcalPerKg, priorSdKcal, e.sigmaScaleKg(), e.sigmaTissueKg(), e.intakeErrorPct(),
                e.sigmaUnknownKcal(), e.waterPhi(), e.sigmaWaterKg(), e.sigmaBaseKcal(), e.glycogenKgPerG(),
                e.glycogenMaxKg(), e.glycogenAlpha(), e.sigmaInitMassKg(), e.sigmaInitWaterKg());
        }

        public static Params of(GoalEngineProperties props) {
            return of(props.kcalPerKg(), props.bootstrapUncertaintyKcal(), props.expenditure());
        }
    }

    /** @return the posterior base at the end of the last day, or empty when no day has a weigh-in */
    public static Optional<Estimate> run(List<Day> days, double priorBaseKcal, Params p) {
        return runWithTrace(days, priorBaseKcal, p).map(Traced::estimate);
    }

    /**
     * {@link #run} plus one {@link DayTrace} per calendar day from the first weigh-in on — the same
     * arithmetic; the trace is only read off the state, never fed back.
     *
     * @return empty when no day has a weigh-in
     */
    public static Optional<Traced> runWithTrace(List<Day> days, double priorBaseKcal, Params p) {
        List<DayTrace> trace = new ArrayList<>();
        double cref = medianCarbs(days);
        double rho = p.kcalPerKg();
        double[] x = null;
        double[][] cov = null;
        Double carbEwma = null;
        Day prev = null;
        for (Day d : days) {
            if (x == null) {
                if (d.weightKg() == null) {
                    carbEwma = updateCarbEwma(carbEwma, d, p);
                    continue;
                }
                // A morning weigh-in predates the day's own eating, so it is priced against the carb
                // EWMA as it stood BEFORE d — the EWMA folds in d's carbs only after this init step.
                double g0 = glycogen(carbEwma, cref, p);
                x = new double[] {d.weightKg() - g0, 0, priorBaseKcal};
                cov = new double[][] {
                    {sq(p.sigmaInitMassKg()), 0, 0},
                    {0, sq(p.sigmaInitWaterKg()), 0},
                    {0, 0, p.priorSdKcal() * p.priorSdKcal()}};
                trace.add(new DayTrace(d.date(), x[0], x[1], g0));
                prev = d;
                carbEwma = updateCarbEwma(carbEwma, d, p);
                continue;
            }
            // Predict from prev's intake into d.
            double[][] f = {{1, 0, 0}, {0, p.waterPhi(), 0}, {0, 0, 1}};
            double u0;
            double qm;
            if (prev.intakeKcal() != null) {
                f[0][2] = -1 / rho;
                u0 = (prev.intakeKcal() - prev.movementKcal()) / rho;
                double intakeErr = p.intakeErrorPct() * prev.intakeKcal() / rho;
                qm = sq(p.sigmaTissueKg()) + sq(intakeErr);
            } else {
                u0 = prev.balanceKcal() / rho;
                qm = sq(p.sigmaTissueKg()) + sq(p.sigmaUnknownKcal() / rho);
            }
            x = new double[] {
                f[0][0] * x[0] + f[0][2] * x[2] + u0,
                f[1][1] * x[1],
                x[2]};
            cov = add(mul(mul(f, cov), transpose(f)), new double[][] {
                {qm, 0, 0}, {0, sq(p.sigmaWaterKg()), 0}, {0, 0, sq(p.sigmaBaseKcal())}});
            // Update on a weigh-in: z = m + w + G + v. Priced against the EWMA as it stood BEFORE d,
            // same reasoning as the init step above — d's own carbs are folded in only afterward.
            double g = glycogen(carbEwma, cref, p);
            if (d.weightKg() != null) {
                double y = d.weightKg() - g - (x[0] + x[1]);
                double s = cov[0][0] + cov[0][1] + cov[1][0] + cov[1][1] + sq(p.sigmaScaleKg());
                double[] k = new double[3];
                double[] hp = new double[3];
                for (int i = 0; i < 3; i++) {
                    k[i] = (cov[i][0] + cov[i][1]) / s;
                    hp[i] = cov[0][i] + cov[1][i];
                }
                for (int i = 0; i < 3; i++) {
                    x[i] += k[i] * y;
                    for (int j = 0; j < 3; j++) {
                        cov[i][j] -= k[i] * hp[j];
                    }
                }
            }
            trace.add(new DayTrace(d.date(), x[0], x[1], g));
            prev = d;
            carbEwma = updateCarbEwma(carbEwma, d, p);
        }
        return x == null ? Optional.empty()
            : Optional.of(new Traced(new Estimate(x[2], Math.sqrt(cov[2][2])), List.copyOf(trace)));
    }

    private static Double updateCarbEwma(Double carbEwma, Day d, Params p) {
        if (d.intakeKcal() == null || d.carbsG() == null) {
            return carbEwma;
        }
        return carbEwma == null ? d.carbsG() : carbEwma + p.glycogenAlpha() * (d.carbsG() - carbEwma);
    }

    private static double glycogen(Double carbEwma, double cref, Params p) {
        if (carbEwma == null) {
            return 0;
        }
        double g = p.glycogenKgPerG() * (carbEwma - cref);
        return Math.max(-p.glycogenMaxKg(), Math.min(p.glycogenMaxKg(), g));
    }

    private static double medianCarbs(List<Day> days) {
        double[] c = days.stream().filter(d -> d.intakeKcal() != null && d.carbsG() != null)
            .mapToDouble(Day::carbsG).sorted().toArray();
        if (c.length == 0) {
            return 0;
        }
        return c.length % 2 == 1 ? c[c.length / 2] : (c[c.length / 2 - 1] + c[c.length / 2]) / 2;
    }

    private static double sq(double v) {
        return v * v;
    }

    private static double[][] mul(double[][] a, double[][] b) {
        double[][] r = new double[3][3];
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                for (int k = 0; k < 3; k++) {
                    r[i][j] += a[i][k] * b[k][j];
                }
            }
        }
        return r;
    }

    private static double[][] transpose(double[][] a) {
        double[][] r = new double[3][3];
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                r[i][j] = a[j][i];
            }
        }
        return r;
    }

    private static double[][] add(double[][] a, double[][] b) {
        double[][] r = new double[3][3];
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                r[i][j] = a[i][j] + b[i][j];
            }
        }
        return r;
    }
}
