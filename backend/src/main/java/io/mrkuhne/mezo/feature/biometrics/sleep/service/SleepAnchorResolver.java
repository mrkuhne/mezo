package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.config.SleepGoalProperties;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import java.time.LocalTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * The single wake/bed derivation (spec D1/D4). Deliberately NOT gated on the sleep-goal switch:
 * HabitTargets must resolve anchors even when the /api/sleep/goal surface is off.
 */
@Component
@RequiredArgsConstructor
public class SleepAnchorResolver implements SleepAnchorPort {

    private final SleepGoalRepository repository;
    private final SleepGoalProperties properties;

    @Override
    public SleepAnchor resolve(UUID userId) {
        return repository.findByCreatedByAndDeletedFalse(userId)
            .map(g -> derive(g.getAnchor(), LocalTime.parse(g.getAnchorTime()), g.getTargetMinutes()))
            .orElseGet(this::ghost);
    }

    /** WAKE fixed -> bed = wake − target; BED fixed -> wake = bed + target (LocalTime wraps mod 24h). */
    static SleepAnchor derive(String anchor, LocalTime anchorTime, int targetMinutes) {
        return "WAKE".equals(anchor)
            ? new SleepAnchor(anchorTime, anchorTime.minusMinutes(targetMinutes))
            : new SleepAnchor(anchorTime.plusMinutes(targetMinutes), anchorTime);
    }

    private SleepAnchor ghost() {
        String time = "WAKE".equals(properties.defaultAnchor())
            ? properties.defaultWake() : properties.defaultBed();
        return derive(properties.defaultAnchor(), LocalTime.parse(time), properties.defaultTargetMin());
    }
}
