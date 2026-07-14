package io.mrkuhne.mezo.feature.train;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Marker bean present ONLY when {@code mezo.feature.closing-block.enabled=true}; gates the lazy
 * closing-exercise ensure in {@code WorkoutService.getToday} via {@code ObjectProvider}. When the
 * property is absent/false the bean is missing → getToday serves the template days untouched.
 * Mirrors {@code HypertrophyDriveGate}; no {@code matchIfMissing}.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CLOSING_BLOCK_SWITCH, havingValue = "true")
public class ClosingBlockGate {
}
