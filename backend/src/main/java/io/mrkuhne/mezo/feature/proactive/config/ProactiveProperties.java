package io.mrkuhne.mezo.feature.proactive.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Proactive-layer tuning (mezo.proactive). B1.1: briefing gather window; B1.2 adds cron + regen. */
@Validated
@ConfigurationProperties(prefix = "mezo.proactive")
public record ProactiveProperties(
        @NotNull @Valid Briefing briefing,
        @NotNull @Valid Weekly weekly,
        @NotNull @Valid Memoir memoir,
        @NotNull @Valid Heartbeat heartbeat,
        @NotNull @Valid Prediction prediction,
        @NotNull @Valid Experiment experiment,
        @NotNull @Valid Challenge challenge) {

    public record Briefing(
        /** How many finished days of narrative memory (daily_summary) the gather reads;
         *  doubles as the emptiness gate: zero summaries in the window -> no briefing (404). */
        @Min(1) @Max(14) int pastDays,
        /** Dawn pre-generation schedule (server zone) — before the typical wake. */
        @NotBlank String cron,
        /** Max staleness regenerations per user+day (the GET path's cap). */
        @Min(0) @Max(5) int regenCapPerDay
    ) {}

    /** W1 weekly plan-suggestion generation. */
    public record Weekly(
        /** Monday-dawn schedule (server zone) — the suggestion is FOR the week just starting. */
        @NotBlank String cron
    ) {}

    /** W2 Sunday-evening weekly memoir generation. */
    public record Memoir(
        /** Sunday-evening schedule (server zone) — the memoir is FOR the week ending that Sunday. */
        @NotBlank String cron
    ) {}

    /** H1 in-day heartbeat notes — the two v1 windows (§9 decision p). The lazy GET derives the
     *  window fire-times from these SAME crons (CronExpression), so there is no duplicated
     *  time config (§9 decision r). */
    public record Heartbeat(
        /** Midday nudge schedule (server zone). */
        @NotBlank String middayCron,
        /** Evening closing schedule (server zone). */
        @NotBlank String eveningCron
    ) {}

    /** P1 weekly prediction generation + daily deterministic window-close validation. */
    public record Prediction(
        /** Monday-morning generation schedule (server zone), after the weekly suggestion. */
        @NotBlank String cron,
        /** Daily validation schedule (server zone) — closes windows with valid_to < today. */
        @NotBlank String validationCron,
        /** Cap on persisted predictions per generation week. */
        @Min(1) @Max(10) int maxPerWeek,
        /** Stable-band epsilon for the weight_trend verdict (kg). */
        @NotNull @DecimalMin("0.0") BigDecimal weightEpsilonKg,
        /** Stable-band epsilon for the sleep_avg verdict (hours). */
        @NotNull @DecimalMin("0.0") BigDecimal sleepEpsilonH
    ) {}

    /** P2 N=1 experiment proposal + daily deterministic outcome evaluation. */
    public record Experiment(
        /** Weekly proposal schedule (server zone), after the prediction batch. */
        @NotBlank String proposeCron,
        /** Daily outcome-evaluation schedule (server zone) — closes windows past their end. */
        @NotBlank String outcomeCron,
        /** Cap on OPEN experiments (proposed + active) per user — bounds the propose trigger. */
        @Min(1) @Max(10) int maxOpen,
        /** Minimum experiment window length (days) — also the default when the model omits it. */
        @Min(1) @Max(60) int minDays,
        /** Maximum experiment window length (days). */
        @Min(1) @Max(60) int maxDays
    ) {}

    /** Workout challenges — daily outcome-eval backstop + per-workout proposal cap. */
    public record Challenge(
        /** Daily outcome-evaluation schedule (server zone) — resolves accepted challenges whose day passed. */
        @NotBlank String outcomeCron,
        /** Cap on challenges proposed per workout session/day. */
        @Min(1) @Max(6) int maxPerWorkout
    ) {}
}
