package io.mrkuhne.mezo.feature.boop.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * Boop S3 tunables (mezo-r36n9.7). Picked up by {@code @Validated
@ConfigurationPropertiesScan}.
 *
 * @param stepsGoal    daily steps that count as a full "mozgás" score.
 * @param regenPerDay  manual regenerations allowed per day's brief; the next one is a 409.
 * @param nightsNeeded logged nights (in the 60-day window) before the Forma score is computed;
 *                     fewer means the "learning" state.
 * @param llmTimeout   how long the brief waits for the LLM's words before it answers with the rule
 *                     verdicts (the phone gives up after 20 s; a slow model must not cost the brief).
 */
@Validated
@ConfigurationProperties(prefix = "mezo.boop")
public record BoopProperties(
        @DefaultValue("9000") @Min(1) int stepsGoal,
        @DefaultValue("3") @Min(0) int regenPerDay,
        @DefaultValue("14") @Min(1) int nightsNeeded,
        @DefaultValue("8s") @NotNull Duration llmTimeout) {
}
