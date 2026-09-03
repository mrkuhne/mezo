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

/** Proactive-layer tuning (mezo.proactive). */
@Validated
@ConfigurationProperties(prefix = "mezo.proactive")
public record ProactiveProperties(
        @NotNull @Valid Weekly weekly,
        @NotNull @Valid WeeklyReview weeklyReview,
        @NotNull @Valid Memoir memoir,
        @NotNull @Valid Prediction prediction,
        @NotNull @Valid Experiment experiment,
        @NotNull @Valid Challenge challenge,
        @NotNull @Valid Feed feed) {

    /** W1 weekly plan-suggestion generation. */
    public record Weekly(
        /** Monday-dawn schedule (server zone) — the suggestion is FOR the week just starting. */
        @NotBlank String cron
    ) {}

    /** Monday weekly-review generation (mezo-p2tr) — looks BACK at the week that just finished,
     *  unlike {@link Weekly}'s forward-looking suggestion. */
    public record WeeklyReview(
        /** Monday schedule (server zone) — the review is FOR the week that just ended. */
        @NotBlank String cron,
        /** How many trailing weeks of live reviews the highlight-citation signal looks back over
         *  (mezo-d20.7.7). A citation is a decaying signal on purpose: a fact the companion leaned
         *  on all last spring and never since should not keep outranking today's material forever.
         *  Doubles as the bound on the derived read. */
        @Min(1) @Max(52) int citationWindowWeeks
    ) {}

    /** W2 Sunday-evening weekly memoir generation. */
    public record Memoir(
        /** Sunday-evening schedule (server zone) — the memoir is FOR the week ending that Sunday. */
        @NotBlank String cron
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

    /** Companion-feed cron kinds (morning/midday/evening) — the unified feed's miss-recovery
     *  derives the midday/evening fire-times from these SAME crons, and the generator's gather
     *  window is this {@code pastDays}. */
    public record Feed(
        /** Dawn pre-generation schedule (server zone) — before the typical wake. */
        @NotBlank String morningCron,
        /** Midday nudge schedule (server zone). */
        @NotBlank String middayCron,
        /** Evening closing schedule (server zone). */
        @NotBlank String eveningCron,
        /** How many finished days of narrative memory (daily_summary) the gather reads;
         *  doubles as the emptiness gate: zero summaries in the window -> no message. */
        @Min(1) @Max(14) int pastDays
    ) {}
}
