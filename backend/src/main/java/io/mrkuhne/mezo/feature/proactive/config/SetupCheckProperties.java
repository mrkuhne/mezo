package io.mrkuhne.mezo.feature.proactive.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Setup-check tuning (S3, bd mezo-d58h.3, spec 2026-09-03 §4 setup table) — EVERY threshold,
 * buffer and cadence is config, never code. Own record rather than another field on the
 * already-large CompanionProperties or ProactiveProperties: the FlagProperties precedent.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.proactive.setup-checks")
public record SetupCheckProperties(

    /** Daily schedule for the setup-check pass. */
    @NotBlank String cron,

    /** A setup card for the SAME check does not repeat inside this window — the spec's
     *  "at most weekly until the configuration contradicts them" cadence. */
    @Min(1) @Max(8760) int reEmitHours,

    @NotNull @Valid PlanFeasibility planFeasibility
) {

    public record PlanFeasibility(
        /** Minutes needed between waking and the morning obligation itself (shower, travel,
         *  breakfast) — the plan must leave room for this, not just for sleep. */
        @Min(0) @Max(240) int wakeBufferMin,
        /** Minutes between an evening sport slot ending and actually being home. sport_schedule_slot
         *  carries a free-text location and nothing geocoded, so this is one flat config number. */
        @Min(0) @Max(240) int commuteBufferMin,
        /** A gym slot at or before this hour counts as a MORNING obligation; later slots are
         *  evening training and do not constrain lights-out. */
        @Min(1) @Max(23) int morningCutoffHour,
        /** The plan is called infeasible only when it misses by MORE than this (spec: 45'). */
        @Min(5) @Max(240) int misfitToleranceMin,
        /** Trailing days of bedtime history the observed median is taken over. */
        @Min(3) @Max(90) int bedtimeWindowDays,
        /** Honest gate: fewer logged bedtimes than this in the window ⇒ the observed-bedtime
         *  half of the check stays silent (the schedule half can still speak). */
        @Min(2) @Max(30) int minBedtimeSamples
    ) {
    }
}
