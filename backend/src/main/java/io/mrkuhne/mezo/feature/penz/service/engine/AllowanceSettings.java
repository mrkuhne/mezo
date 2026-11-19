package io.mrkuhne.mezo.feature.penz.service.engine;

import java.time.YearMonth;
import java.util.Map;

/**
 * The settings the allowance reads, in HUF minor units: the monthly savings target, its per-month
 * overrides (old {@code month_overrides[m].savings_target_minor}) and the Gyakorlás monthly cap
 * ({@code practice}, spec §10.1.2 — deducted like a fixed cost; 0 reproduces the old engine).
 */
public record AllowanceSettings(long savingsTargetMinor, long practiceMinor, Map<YearMonth, Long> savingsTargetOverrides) {

    /** 20 000 Ft. */
    public static final long DEFAULT_PRACTICE_MINOR = 2_000_000L;

    public AllowanceSettings {
        savingsTargetOverrides = savingsTargetOverrides == null ? Map.of() : Map.copyOf(savingsTargetOverrides);
    }

    public static AllowanceSettings withDefaults(long savingsTargetMinor) {
        return new AllowanceSettings(savingsTargetMinor, DEFAULT_PRACTICE_MINOR, Map.of());
    }
}
