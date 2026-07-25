package io.mrkuhne.mezo.feature.train;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Marker bean present only when mezo.feature.volume-progression.enabled=true; gates the weekly
 * volume rollover + effective-set override in WorkoutService.getToday via ObjectProvider. */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.VOLUME_PROGRESSION_SWITCH, havingValue = "true")
public class VolumeProgressionGate {}
