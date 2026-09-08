package io.mrkuhne.mezo.feature.llmlog.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.ZoneId;
import java.util.Set;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** LLM call audit log tuning (mezo.llm-log) — payload cap, report zone, the async writer's executor, retention and the per-user USD cap. */
@Validated
@ConfigurationProperties(prefix = "mezo.llm-log")
public record LlmLogProperties(
    /** Prompt/response payloads are truncated to this many characters before persisting. */
    @Positive int maxPayloadChars,
    /**
     * The wall clock the usage rollups are cut on (mezo-h3gb): "today", "this week" and "this
     * month" are the user's calendar periods, not UTC ones, so the server zone must not decide it.
     * Bound as a {@link ZoneId} so an unknown zone id fails at startup, not at first request.
     */
    @NotNull ZoneId reportZone,
    @NotNull @Valid Executor executor,
    @NotNull @Valid Retention retention,
    @NotNull @Valid Budget budget
) {
    /** The audit-writer thread pool — small by design; logging must never starve the request path. */
    public record Executor(@Positive int coreSize, @Positive int maxSize, @Positive int queueCapacity) {}

    /**
     * mezo-1y3p payload retention: the four payload columns are NULLed after {@code payloadDays};
     * cost/token metadata is kept forever (the ADR 0014 founding purpose is retention-proof).
     */
    public record Retention(@Positive int payloadDays, @NotBlank String cron) {}

    /**
     * The per-user rolling USD cap (mezo-ozri.6, spec §C1). REVERSES ADR 0035 §L1, which shipped
     * cost VISIBILITY only and explicitly rejected a per-account quota; the migration spec's §4 is
     * why — a heavy account costs ~$51/month against $10.46 of net revenue per subscription, so the
     * ceiling stopped being theoretical. Every number is YAML, the three thresholds included,
     * because nobody knows the honest p95 until the beta produces one.
     */
    public record Budget(
        /** Master switch. Off ⇒ the gate answers OK for everyone and no spend read is ever issued. */
        boolean enabled,
        /** The ceiling for ONE account across ONE cycle, in the pricing block's currency. */
        @NotNull @DecimalMin("0.01") BigDecimal hardCapUsd,
        /**
         * The cycle is a ROLLING window of this many days ending now, not a calendar month. A
         * calendar reset would hand an account that burned the whole ceiling on the 31st a clean
         * slate on the 1st, and the ceiling exists precisely to stop that.
         */
        @Min(1) @Max(3650) int cycleDays,
        /** % of the cap at which every call routes onto the provider's cheap tier (spec §C1: 70). */
        @Min(1) @Max(100) int degradeAtPercent,
        /** % at which {@code throttledFeatures} are suspended on top of that (spec §C1: 90). */
        @Min(1) @Max(100) int throttleCronAtPercent,
        /** % at which every capped call is refused until the window rolls on (spec §C1: 100). */
        @Min(1) @Max(1000) int stopAtPercent,
        /**
         * {@code LlmCallContext.feature()} slugs suspended from the throttle step up: the expensive
         * background generators, whose value is "nice to have tomorrow" rather than "a user is
         * waiting". Every one of them is an idempotent catch-up inside {@code UserFanOut}'s per-user
         * try/catch, so refusing the call simply skips that run and the next one picks it back up.
         */
        Set<String> throttledFeatures,
        /**
         * Slugs the cap never applies to. {@code admin_replay} by default: the owner's dry-run
         * inspection bills the INSPECTED user's spend, so capping it would make exactly the accounts
         * worth inspecting the ones that cannot be inspected.
         */
        Set<String> exemptFeatures
    ) {
        /** The binder hands a record component null for an omitted key AND for an empty one. */
        public Budget {
            throttledFeatures = throttledFeatures == null ? Set.of() : Set.copyOf(throttledFeatures);
            exemptFeatures = exemptFeatures == null ? Set.of() : Set.copyOf(exemptFeatures);
        }

        /** Cross-field: the steps only mean anything ascending, and jakarta cannot say so per field. */
        @AssertTrue(message = "degrade-at-percent < throttle-cron-at-percent < stop-at-percent required")
        public boolean isThresholdsAscending() {
            return degradeAtPercent < throttleCronAtPercent && throttleCronAtPercent < stopAtPercent;
        }
    }
}
