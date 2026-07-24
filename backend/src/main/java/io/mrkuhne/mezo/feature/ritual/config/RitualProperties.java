package io.mrkuhne.mezo.feature.ritual.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Napzárás window tunables (spec §5) — bed-anchored offsets, minutes. */
@Validated
@ConfigurationProperties(prefix = "mezo.ritual")
public record RitualProperties(
    @Min(15) @Max(240) int leadMin,
    @Min(0) @Max(180) int prepLeadMin) {}
