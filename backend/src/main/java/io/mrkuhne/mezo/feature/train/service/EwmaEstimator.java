package io.mrkuhne.mezo.feature.train.service;

import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/**
 * RFC 6298's estimator, reused for workout pacing (spec 2026-09-02): a smoothed value plus a
 * smoothed absolute deviation, updated per observation.
 *
 * <p>Two rules matter more than the arithmetic. First, an observation that lies further than
 * {@code outlierK} deviations from the current estimate is DROPPED, never clipped — clipping a
 * contaminated sample biases the estimate upward permanently (Karn's algorithm). Second, the gate
 * stays open until {@code minSamples} observations have landed, so a cold estimate can still move.
 *
 * <p>Seeds come from config, not from the first observation: a fresh profile starts at the
 * frontend's static pacing constants, so the estimate is never worse than today's.
 */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class EwmaEstimator {

    public record Estimate(double value, double deviation, int samples) {}

    public static Estimate seed(double value) {
        return new Estimate(value, value / 2, 0);
    }

    public static Estimate update(
            Estimate current, double observation,
            double alpha, double beta, double outlierK, int minSamples) {
        if (current.samples() >= minSamples
                && Math.abs(observation - current.value()) > outlierK * current.deviation()) {
            return current;
        }
        double deviation = (1 - beta) * current.deviation()
            + beta * Math.abs(current.value() - observation);
        double value = (1 - alpha) * current.value() + alpha * observation;
        return new Estimate(value, deviation, current.samples() + 1);
    }
}
