package io.mrkuhne.mezo.feature.character.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.math.BigDecimal;
import java.util.Map;

/** Karakter tuning (mezo.character) — Karakter spec §5/§6. Config, never code. */
@Validated
@ConfigurationProperties(prefix = "mezo.character")
public record CharacterProperties(
        @NotNull @Valid Observation observation,
        @NotNull @Valid Conference conference,
        @NotNull @Valid Monthly monthly,
        @NotNull @Valid Prompt prompt,
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

    public record Monthly(
            /** Monthly deep-read konzílium cron (server zone) — fires on a plain Sunday schedule;
             *  {@code CharacterMonthlyJob#isDeepReadDay} narrows it to the month's FIRST Sunday, since
             *  Spring cron cannot reliably express day-of-month AND day-of-week together. */
            @NotBlank String cron,
            /** How many days a CHAPTER dimension may sit with no ACTIVE claim before it is retired. */
            @Min(1) @Max(365) int staleChapterDays) {}

    public record Prompt(
            /** Claims below this confidence never make the [Karakter] prompt block (spec §8). */
            @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal minConfidence,
            /** Per-dimension line cap — the freshest/most-confident claims win the cut. */
            @Min(1) @Max(10) int maxClaimsPerDimension,
            /** Whole-block char budget; a dimension that would exceed it is dropped WHOLE. */
            @Min(200) @Max(8000) int maxTotalChars,
            /** Minimum dimension maturity before its portrait digest is worth injecting. */
            @Min(0) @Max(100) int portraitMinMaturity) {}

    public record Detector(boolean enabled) {}

    public boolean detectorEnabled(String key) {
        Detector d = detector.get(key);
        return d == null || d.enabled();
    }
}
