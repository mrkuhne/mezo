package io.mrkuhne.mezo.feature.companion.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * S8 (mezo-d6ivw.12): the fact-text backfill's ops switch. {@code mode}: {@code off} (default —
 * nothing happens), {@code dry-run} (lists every before/after pair, writes nothing) or
 * {@code apply} (rewrites, logs the same list) — QUOTED in YAML, a bare {@code off} parses as
 * boolean false. Picked up by {@code MezoApplication}'s {@code @ConfigurationPropertiesScan}.
 * Deliberately NOT {@code @Validated}/{@code @NotBlank}: production flips
 * {@code MEZO_COMPANION_FACTTEXTBACKFILL_MODE} for one deploy and removes it afterwards, and if
 * it is ever blanked instead of removed ({@code ""}), the app must still boot — the compact
 * constructor treats a null/blank env override the same as the unset default, off, exactly like
 * the brief's original {@code @Value(...:off)} would have.
 */
@ConfigurationProperties(prefix = "mezo.companion.fact-text-backfill")
public record FactTextBackfillProperties(String mode) {

    public FactTextBackfillProperties {
        mode = (mode == null || mode.isBlank()) ? "off" : mode;
    }
}
