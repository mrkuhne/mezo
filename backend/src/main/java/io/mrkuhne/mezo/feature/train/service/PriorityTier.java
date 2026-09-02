package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;

/**
 * Per-muscle priority tier — picks which volume landmark is "100%" for the weekly ramp
 * (mezo-3m5m, spec GD4). Maintain's ceiling is MEV: {@link VolumeDecider} ramps a muscle
 * below its ceiling back up (e.g. recovering toward MEV after a deload) and holds once it
 * reaches the ceiling — the ceiling alone encodes maintain semantics, there is no separate
 * ramp-disable flag.
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

    public int ceiling(int mev, int mav, int mrv) {
        return switch (this) { case EMPHASIZE -> mrv; case GROW -> mav; case MAINTAIN -> mev; };
    }

    /** Week-1 start of the ramp (mesocycle wizard redesign): EMPHASIZE begins two sets above MEV
     *  (never above MRV), GROW and MAINTAIN begin at MEV. Pairs with {@link #ceiling}. */
    public int weekOneStart(int mev, int mav, int mrv) {
        return this == EMPHASIZE ? Math.min(mev + 2, mrv) : mev;
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

    private static SystemRuntimeErrorException invalidTier() {
        return new SystemRuntimeErrorException(
            SystemMessage.error("TRAIN_MUSCLE_PRIORITY_TIER_INVALID").build(), HttpStatus.BAD_REQUEST);
    }
}
