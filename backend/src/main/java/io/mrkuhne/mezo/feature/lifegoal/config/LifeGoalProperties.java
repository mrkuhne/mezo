package io.mrkuhne.mezo.feature.lifegoal.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Life-goal tuning (mezo.lifegoal), never code (configuration_conventions.md). */
@Validated
@ConfigurationProperties(prefix = "mezo.lifegoal")
public record LifeGoalProperties(

    /**
     * Pillar cap per goal, enforced here for non-HTTP callers of {@code
     * LifeGoalPillarService.validate} (e.g. future batch/import paths). Over HTTP the OpenAPI
     * contract's {@code maxItems: 5} on {@code LifeGoalPillarsRequest.pillars}
     * (api/feature/lifegoal/lifegoal.yml) is the binding cap: bean validation rejects a 6th
     * pillar with a generic {@code VALIDATION_INVALID_VALUE} before this class ever runs, so
     * raising this property above the contract's 5 would silently do nothing over HTTP. The
     * {@code @Max(5)} below keeps the two caps from drifting apart; if the contract's
     * {@code maxItems} ever changes, raise both together.
     */
    @Min(1) @Max(5) int maxPillars,

    /**
     * Nightly evaluation schedule (Spring cron), default 00:20 — after the habit close (00:10) so
     * the day's habit metrics are already honest. The job bean itself is gated by
     * {@code mezo.techcore.cron.life-goal-eval-job.enabled}.
     */
    @NotBlank String evalCron) {}
