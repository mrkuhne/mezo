package io.mrkuhne.mezo.feature.companion.tools;

import java.math.BigDecimal;

/**
 * Shared render helpers for the V0.5 toolsets — the snapshot's num() idiom + arg clamping.
 * Public: {@link #exerciseLine} is also called from {@code companion.service.ContextSnapshotAssembler}
 * (same companion feature slice — see {@code ArchitectureTest#feature_slices_are_cycle_free}, which
 * slices per top-level feature, not per sub-package; {@code companion.service} already depends on
 * {@code companion.tools} for {@code CompanionToolRegistry}/{@code ToolCallAudit}).
 */
public final class ToolText {

    static final String NO_DATA = "nincs adat";

    private ToolText() {
    }

    /** Locale-independent compact number: strip trailing zeros, plain (non-scientific) string. */
    static String num(BigDecimal v) {
        return v == null ? "?" : v.stripTrailingZeros().toPlainString();
    }

    /** Null-safe window clamp: the model may omit the arg (fallback) or overshoot (min/max). */
    static int clamp(Integer value, int min, int max, int fallback) {
        return value == null ? fallback : Math.clamp(value, min, max);
    }

    /**
     * "{name} {workingSets}×{repMin}-{repMax}" — the compact exercise descriptor shared by
     * {@code TrainTools} (get_training_plan) and {@code ContextSnapshotAssembler} (Ma:/Holnap:).
     * Null-guarded: a missing rep range (or set count) must never render the literal "null" into
     * the LLM prompt, so each piece is rendered only when present.
     */
    public static String exerciseLine(String name, Integer workingSets, Integer repMin, Integer repMax) {
        StringBuilder b = new StringBuilder(name).append(' ').append(workingSets != null ? workingSets : "?");
        if (repMin != null && repMax != null) {
            b.append('×').append(repMin).append('-').append(repMax);
        }
        return b.toString();
    }
}
