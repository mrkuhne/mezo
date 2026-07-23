package io.mrkuhne.mezo.feature.habit.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepAnchorPort;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Wake/bed anchors from the sleep goal (mezo-dbsr, spec D3) — SleepAnchorPort ghosts config defaults. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.HABIT_SWITCH, havingValue = "true")
public class HabitTargets {

    private final SleepAnchorPort sleepAnchorPort;

    public record Resolved(LocalTime wake, LocalTime bed) {}

    public Resolved resolve(UUID userId) {
        SleepAnchorPort.SleepAnchor anchor = sleepAnchorPort.resolve(userId);
        return new Resolved(anchor.wake(), anchor.bed());
    }
}
