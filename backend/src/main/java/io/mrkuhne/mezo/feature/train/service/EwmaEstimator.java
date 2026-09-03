package io.mrkuhne.mezo.feature.train.service;

import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/**
 * RFC 6298's estimator, reused for workout pacing (spec 2026-09-02): a smoothed value plus a
 * smoothed absolute deviation, updated per observation.
 *
 * <p>Three rules matter more than the arithmetic. First, an observation that lies further than
 * {@code outlierK} deviations from the current estimate is DROPPED, never clipped — clipping a
 * contaminated sample biases the estimate upward permanently (Karn's algorithm). Second, the gate
 * stays open until {@code minSamples} observations have landed, so a cold estimate can still move.
 * Third, the gate compares against {@code max(minDeviationSeconds, current.deviation())}, RFC
 * 6298's granularity floor (its {@code RTO = SRTT + max(G, K*RTTVAR)}): a user with very
 * consistent pacing converges {@code deviation} toward zero, and once {@code samples >=
 * minSamples} an unfloored gate of {@code outlierK * 0} rejects EVERY subsequent observation,
 * freezing the estimate permanently and silently. The floor is applied to the GATE comparison
 * only — the stored {@code deviation} itself is never floored, so it stays a faithful measurement
 * of the user's actual consistency.
 *
 * <p>Seeds come from config, not from the first observation: a fresh profile starts at an
 * untuned starting point derived from the frontend's static pacing constants — in the right
 * ballpark, but deliberately NOT calibrated to reproduce the static formula's numbers. Tuning
 * the seeds against real observation data is outstanding work.
 */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class EwmaEstimator {

    public record Estimate(double value, double deviation, int samples) {}

    public static Estimate seed(double value) {
        return new Estimate(value, value / 2, 0);
    }

    public static Estimate update(
            Estimate current, double observation,
            double alpha, double beta, double outlierK, int minSamples, double minDeviationSeconds) {
        double gateDeviation = Math.max(minDeviationSeconds, current.deviation());
        if (current.samples() >= minSamples
                && Math.abs(observation - current.value()) > outlierK * gateDeviation) {
            return current;
        }
        double deviation = (1 - beta) * current.deviation()
            + beta * Math.abs(current.value() - observation);
        double value = (1 - alpha) * current.value() + alpha * observation;
        return new Estimate(value, deviation, current.samples() + 1);
    }
}
