package io.mrkuhne.mezo.feature.proactive.entity;

import java.util.List;

/**
 * Typed jsonb envelope for {@code diagnosis.suspects} (mezo-hqfi). Every suspect is VALIDATED
 * before it lands here: {@code evidenceIndexes} is non-empty and in range against the frozen
 * evidence list, {@code metricKey} is a known {@code MetricKey}, {@code expectedDirection} is
 * the {@code ExperimentEntity} vocabulary ({@code up|down|stable}), and the probe fields map 1:1
 * onto {@code ExperimentEntity} so the hand-off needs no translation layer.
 */
public record DiagnosisSuspectsEnvelope(List<Suspect> suspects) {

    public record Suspect(
            int rank,
            String title,
            String claim,
            List<Integer> evidenceIndexes,
            String strength,
            String probeText,
            String metricKey,
            String expectedDirection,
            int totalDays) {
    }
}
