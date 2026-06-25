package io.mrkuhne.mezo.feature.progression;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Marker bean present ONLY when {@code mezo.feature.progression.enabled=true}; gates the gym
 * finish → progression trigger via {@code @ConditionalOnProperty} (the house feature-switch
 * pattern — no {@code @Value}/{@code Environment} reads). When the property is absent or false the
 * bean is missing, so {@code ObjectProvider<ProgressionGate>.getIfAvailable() == null} keeps
 * progression cleanly off. No {@code matchIfMissing} — the switch is declared explicitly.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.PROGRESSION_SWITCH, havingValue = "true")
public class ProgressionGate {
}
