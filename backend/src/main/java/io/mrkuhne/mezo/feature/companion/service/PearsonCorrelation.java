package io.mrkuhne.mezo.feature.companion.service;

import java.util.Optional;

/**
 * Pure static math for the V3.1 pattern engine (NFR-M-4: pure-compute step, no Spring, no LLM):
 * Pearson r over two aligned samples + the two-sided p-value of the t-test
 * {@code t = r·√((n−2)/(1−r²))} via the regularized incomplete beta function
 * {@code p = I_{df/(df+t²)}(df/2, 1/2)} (the standard continued-fraction evaluation).
 * Degenerate inputs (n &lt; 3, zero variance) yield {@code Optional.empty()} — an honest
 * "no statistic", never a fabricated number.
 */
final class PearsonCorrelation {

    /** r ∈ [−1,1], n = sample size, p = two-sided significance. */
    record Result(double r, int n, double p) {
    }

    private PearsonCorrelation() {
    }

    static Optional<Result> correlate(double[] a, double[] b) {
        int n = a.length;
        if (n != b.length || n < 3) {
            return Optional.empty();
        }
        double meanA = mean(a);
        double meanB = mean(b);
        double cov = 0;
        double varA = 0;
        double varB = 0;
        for (int i = 0; i < n; i++) {
            double da = a[i] - meanA;
            double db = b[i] - meanB;
            cov += da * db;
            varA += da * da;
            varB += db * db;
        }
        if (varA == 0 || varB == 0) {
            return Optional.empty(); // constant series — correlation undefined
        }
        double r = cov / Math.sqrt(varA * varB);
        r = Math.clamp(r, -1.0, 1.0); // guard fp drift past ±1
        return Optional.of(new Result(r, n, twoSidedP(r, n)));
    }

    private static double twoSidedP(double r, int n) {
        double df = n - 2.0;
        double denom = 1 - r * r;
        if (denom <= 0) {
            return 0.0; // |r| = 1 — exact fit
        }
        double t = Math.abs(r) * Math.sqrt(df / denom);
        return regularizedIncompleteBeta(df / (df + t * t), df / 2.0, 0.5);
    }

    /** I_x(a,b) — regularized incomplete beta via the Lentz continued fraction (NR §6.4). */
    private static double regularizedIncompleteBeta(double x, double a, double b) {
        if (x <= 0) {
            return 0;
        }
        if (x >= 1) {
            return 1;
        }
        double logBeta = logGamma(a + b) - logGamma(a) - logGamma(b)
                + a * Math.log(x) + b * Math.log(1 - x);
        double front = Math.exp(logBeta);
        if (x < (a + 1) / (a + b + 2)) {
            return front * betaContinuedFraction(x, a, b) / a;
        }
        return 1 - front * betaContinuedFraction(1 - x, b, a) / b;
    }

    private static double betaContinuedFraction(double x, double a, double b) {
        final double tiny = 1e-30;
        final double eps = 1e-12;
        double qab = a + b;
        double qap = a + 1;
        double qam = a - 1;
        double c = 1;
        double d = 1 - qab * x / qap;
        if (Math.abs(d) < tiny) {
            d = tiny;
        }
        d = 1 / d;
        double h = d;
        for (int m = 1; m <= 200; m++) {
            int m2 = 2 * m;
            double aa = m * (b - m) * x / ((qam + m2) * (a + m2));
            d = 1 + aa * d;
            if (Math.abs(d) < tiny) {
                d = tiny;
            }
            c = 1 + aa / c;
            if (Math.abs(c) < tiny) {
                c = tiny;
            }
            d = 1 / d;
            h *= d * c;
            aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
            d = 1 + aa * d;
            if (Math.abs(d) < tiny) {
                d = tiny;
            }
            c = 1 + aa / c;
            if (Math.abs(c) < tiny) {
                c = tiny;
            }
            d = 1 / d;
            double del = d * c;
            h *= del;
            if (Math.abs(del - 1) < eps) {
                break;
            }
        }
        return h;
    }

    /** Lanczos log-gamma (g=7, n=9) — plenty for p-value precision. */
    private static double logGamma(double x) {
        double[] g = {
                0.99999999999980993, 676.5203681218851, -1259.1392167224028,
                771.32342877765313, -176.61502916214059, 12.507343278686905,
                -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
        };
        if (x < 0.5) {
            return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
        }
        x -= 1;
        double sum = g[0];
        for (int i = 1; i < 9; i++) {
            sum += g[i] / (x + i);
        }
        double t = x + 7.5;
        return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(sum);
    }

    private static double mean(double[] values) {
        double sum = 0;
        for (double v : values) {
            sum += v;
        }
        return sum / values.length;
    }
}
