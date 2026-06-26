package io.mrkuhne.mezo.feature.medication.entity;

import java.util.List;

/**
 * Typed envelope for the {@code medication.cycle} jsonb column — the on/off schedule config.
 * {@code cycleLengthDays} is the repeat period; {@code phases} partitions that period into labelled
 * day ranges (e.g. an on-week / off-week split). Persisted as a single jsonb column via
 * {@code @JdbcTypeCode(SqlTypes.JSON)} (same pattern as {@code meal.breakdown} /
 * {@code ProvenanceEnvelope}) instead of a raw String.
 */
public record MedicationCycleJson(int cycleLengthDays, List<Phase> phases) {

    public record Phase(String key, int fromDay, int toDay, String label) {}
}
