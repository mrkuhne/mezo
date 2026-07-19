package io.mrkuhne.mezo.feature.habit.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Habit tuning (mezo.habit): every target window/cutoff is config, never code (ADR 0010). */
@Validated
@ConfigurationProperties(prefix = "mezo.habit")
public record HabitProperties(
    @NotBlank String closeCron,
    @Min(0) int wakeWindowMin,
    @NotBlank String weighInCutoff,
    @NotBlank String morningWindowEnd,
    @NotBlank String workoutCutoff,
    @Min(1) int proteinTargetG,
    @NotBlank String caffeineCutoff,
    @Min(0) int bedGraceMin,
    @Min(0) int kitchenCloseOffsetMin,
    @NotBlank String defaultWake,
    @NotBlank String defaultBed,
    @Min(1) int strengthWindowDays,
    @Min(1) int minSample,
    @Min(1) int summaryDays) {}
