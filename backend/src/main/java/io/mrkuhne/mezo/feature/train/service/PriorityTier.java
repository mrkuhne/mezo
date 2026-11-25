package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;

/**
 * Per-muscle priority tier (mezo-3m5m, spec GD4) — Építés / Hangsúly / Tartás. It selects the
 * weekly set band of a muscle group ({@link VolumeBands#band}); the band, not a single ceiling
 * landmark, encodes what each tier means.
 */
public enum PriorityTier {
    EMPHASIZE, GROW, MAINTAIN;

    /** Sparse-map resolve: null map, absent key, or unknown value all mean the GROW default. */
    public static PriorityTier of(Map<String, String> priorities, String muscle) {
        if (priorities == null) return GROW;
        return switch (priorities.getOrDefault(muscle, "grow")) {
            case "emphasize" -> EMPHASIZE;
            case "maintain" -> MAINTAIN;
            default -> GROW;
        };
    }

    /**
     * Validates + normalizes a muscle-priority map for storage (mezo-ltk0, tier-review
     * follow-up 2): map KEYS are FE-owned (coarse muscle-group names, same as the goalPreset
     * precedent) and are never validated here. Map VALUES must be one of the three known
     * tiers — a {@code grow} entry is dropped rather than stored, since a sparse map never
     * legitimately carries it (it IS the default); any other value 400s instead of silently
     * resolving to Grow.
     *
     * @return a new sparse map (never null) with only emphasize/maintain entries.
     */
    public static Map<String, String> normalize(Map<String, String> priorities) {
        if (priorities == null || priorities.isEmpty()) {
            return Map.of();
        }
        Map<String, String> normalized = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : priorities.entrySet()) {
            // Null-guard BEFORE the switch (same style as IntentionService#reflect's lookup
            // guard) — a null selector in a String switch throws NPE regardless of `default`,
            // and a plain Map<String,String> deserializes `{"back": null}` without complaint.
            String tierValue = entry.getValue();
            if (tierValue == null) {
                throw invalidTier();
            }
            switch (tierValue) {
                case "grow" -> { /* redundant with the sparse-map default — dropped, not stored */ }
                case "emphasize", "maintain" -> normalized.put(entry.getKey(), tierValue);
                default -> throw invalidTier();
            }
        }
        return normalized;
    }

    /** Every group at Tartás, in the given order — a consolidation block's priorities (mezo-r36n9.113). */
    public static Map<String, String> allMaintain(Collection<String> groups) {
        Map<String, String> out = new LinkedHashMap<>();
        groups.forEach(g -> out.put(g, "maintain"));
        return out;
    }

    private static SystemRuntimeErrorException invalidTier() {
        return new SystemRuntimeErrorException(
            SystemMessage.error("TRAIN_MUSCLE_PRIORITY_TIER_INVALID").build(), HttpStatus.BAD_REQUEST);
    }
}
