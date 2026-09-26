package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import java.time.LocalDate;
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
     * @param movementKcal the plan's daily movement average + the day's unplanned extra (net)
     * @param balanceKcal  the goal's daily energy balance (the drift assumed on an unknown day)
     * @param weightKg     the day's mean scale weight, or {@code null}
     */
    public record Day(LocalDate date, Integer intakeKcal, Integer carbsG, int movementKcal, int balanceKcal,
                      Double weightKg) {
    }

    public record Estimate(double baseKcal, double sdKcal) {
    }

    public record Params(int kcalPerKg, double priorSdKcal, double sigmaScaleKg, double sigmaTissueKg,
                         double intakeErrorPct, double sigmaUnknownKcal, double waterPhi, double sigmaWaterKg,
                         double sigmaBaseKcal, double glycogenKgPerG, double glycogenMaxKg, double glycogenAlpha) {

        public static Params of(int kcalPerKg, int priorSdKcal, GoalEngineProperties.Expenditure e) {
            return new Params(kcalPerKg, priorSdKcal, e.sigmaScaleKg(), e.sigmaTissueKg(), e.intakeErrorPct(),
                e.sigmaUnknownKcal(), e.waterPhi(), e.sigmaWaterKg(), e.sigmaBaseKcal(), e.glycogenKgPerG(),
                e.glycogenMaxKg(), e.glycogenAlpha());
        }

        public static Params of(GoalEngineProperties props) {
            return of(props.kcalPerKg(), props.bootstrapUncertaintyKcal(), props.expenditure());
        }
    }

    /** @return the posterior base at the end of the last day, or empty when no day has a weigh-in */
    public static Optional<Estimate> run(List<Day> days, double priorBaseKcal, Params p) {
        double cref = medianCarbs(days);
        double rho = p.kcalPerKg();
        double[] x = null;
        double[][] cov = null;
        Double carbEwma = null;
        Day prev = null;
        for (Day d : days) {
            if (d.intakeKcal() != null && d.carbsG() != null) {
                carbEwma = carbEwma == null ? d.carbsG() : carbEwma + p.glycogenAlpha() * (d.carbsG() - carbEwma);
            }
            if (x == null) {
                if (d.weightKg() == null) {
                    continue;
                }
                x = new double[] {d.weightKg() - glycogen(carbEwma, cref, p), 0, priorBaseKcal};
                cov = new double[][] {{0.25, 0, 0}, {0, 0.09, 0}, {0, 0, p.priorSdKcal() * p.priorSdKcal()}};
                prev = d;
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
            // Update on a weigh-in: z = m + w + G + v.
            if (d.weightKg() != null) {
                double y = d.weightKg() - glycogen(carbEwma, cref, p) - (x[0] + x[1]);
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
            prev = d;
        }
        return x == null ? Optional.empty() : Optional.of(new Estimate(x[2], Math.sqrt(cov[2][2])));
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
