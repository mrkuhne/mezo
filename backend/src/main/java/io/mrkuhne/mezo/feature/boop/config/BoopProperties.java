package io.mrkuhne.mezo.feature.boop.config;

import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * Boop S3 tunables (mezo-r36n9.7). Picked up by {@code @Validated
@ConfigurationPropertiesScan}.
 *
 * @param stepsGoal daily steps that count as a full "mozgás" score.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.boop")
public record BoopProperties(@DefaultValue("9000") @Min(1) int stepsGoal) {
}
