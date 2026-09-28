package io.mrkuhne.mezo.feature.companion.config;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * S8 (mezo-d6ivw.12): the fact-text backfill's ops switch. {@code mode}: {@code off} (default —
 * nothing happens), {@code dry-run} (lists every before/after pair, writes nothing) or
 * {@code apply} (rewrites, logs the same list) — QUOTED in YAML, a bare {@code off} parses as
 * boolean false. Picked up by {@code MezoApplication}'s {@code @ConfigurationPropertiesScan}.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.companion.fact-text-backfill")
public record FactTextBackfillProperties(@NotBlank String mode) { }
