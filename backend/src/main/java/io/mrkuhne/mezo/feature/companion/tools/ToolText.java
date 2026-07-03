package io.mrkuhne.mezo.feature.companion.tools;

import java.math.BigDecimal;

/** Shared render helpers for the V0.5 toolsets — the snapshot's num() idiom + arg clamping. */
final class ToolText {

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
}
