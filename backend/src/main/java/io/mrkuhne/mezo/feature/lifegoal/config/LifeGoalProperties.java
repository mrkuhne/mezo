package io.mrkuhne.mezo.feature.lifegoal.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Life-goal tuning (mezo.lifegoal), never code (configuration_conventions.md). */
@Validated
@ConfigurationProperties(prefix = "mezo.lifegoal")
public record LifeGoalProperties(

    /** Pillar cap per goal. */
    @Min(1) @Max(10) int maxPillars) {}
