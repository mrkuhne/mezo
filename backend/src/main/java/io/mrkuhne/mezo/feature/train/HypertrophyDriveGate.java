package io.mrkuhne.mezo.feature.train;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Marker bean present ONLY when {@code mezo.feature.hypertrophy-drive.enabled=true}; gates the
 * prescribed-set computation in {@code WorkoutService.getToday} via {@code ObjectProvider}. When the
 * property is absent/false the bean is missing → the today response carries no prescribedSets and the
 * FE falls back to the ad-hoc logger. Mirrors {@code ProgressionGate}; no {@code matchIfMissing}.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.HYPERTROPHY_DRIVE_SWITCH, havingValue = "true")
public class HypertrophyDriveGate {
}
