package io.mrkuhne.mezo.feature.train;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Marker bean present only when mezo.feature.timing-profile.enabled=true; gates the profile
 * learning hook in WorkoutService.finishWorkout via ObjectProvider. */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.TIMING_PROFILE_SWITCH, havingValue = "true")
public class TimingProfileGate {}
