package io.mrkuhne.mezo.feature.boop.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Boop S3 tunables (mezo-r36n9.7). Picked up by {@code @ConfigurationPropertiesScan}.
 *
 * @param stepsGoal daily steps that count as a full "mozgás" score.
 */
@ConfigurationProperties(prefix = "mezo.boop")
public record BoopProperties(@DefaultValue("9000") int stepsGoal) {
}
