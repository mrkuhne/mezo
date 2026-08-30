package io.mrkuhne.mezo.feature.character.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.util.Map;

/** Karakter tuning (mezo.character) — Karakter spec §5/§6. Config, never code. */
@Validated
@ConfigurationProperties(prefix = "mezo.character")
public record CharacterProperties(
        @NotNull @Valid Observation observation,
        @NotNull @Valid Conference conference,
        /** Per-detector kill switches (spec §5): key = detector key. Absent key = enabled. */
        @NotNull Map<String, Detector> detector) {

    // An empty YAML map (`detector: {}`) produces zero leaf properties under the
    // mezo.character.detector prefix, so relaxed binding sees nothing bound there and hands the
    // Binder null rather than an empty Map — normalize it here so @NotNull validates and every
    // detector stays enabled-by-default (detectorEnabled's absent-key contract).
    public CharacterProperties {
        detector = detector == null ? Map.of() : detector;
    }

    public record Observation(
            /** Nightly expert-pass cron (server zone). */
            @NotBlank String cron,
            /** How many finished days back the job heals (the summary catch-up idiom). */
            @Min(1) @Max(30) int catchUpDays) {}

    public record Conference(
            /** Weekly konzílium cron (server zone) — fires for the week that just finished. */
            @NotBlank String cron,
            /** How many finished weeks back the job heals (the observation catch-up idiom). */
            @Min(1) @Max(8) int catchUpWeeks) {}

    public record Detector(boolean enabled) {}

    public boolean detectorEnabled(String key) {
        Detector d = detector.get(key);
        return d == null || d.enabled();
    }
}
