package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInNeedSource;
import io.mrkuhne.mezo.feature.character.config.CharacterProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * The character detectors' side of the question of the day (Check-in 2.0 follow-up A): every
 * ENABLED detector (per-key kill switch, as {@link DetectorRegistry} runs them) contributes the
 * check-in items it reads, with its own "why" sentence ({@link CharacterDetector#checkInNeeds()}).
 * Ordered between the companion's hypotheses and its catalog pairs ({@code @Order(2)}).
 */
@Component
@Order(2)
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class DetectorCheckInNeedSource implements CheckInNeedSource {

    private final List<CharacterDetector> detectors;
    private final CharacterProperties properties;

    @Override
    public List<Need> needs(UUID userId) {
        return detectors.stream()
            .filter(d -> properties.detectorEnabled(d.key()))
            .flatMap(d -> d.checkInNeeds().entrySet().stream())
            .map(e -> new Need(e.getKey(), e.getValue()))
            .toList();
    }
}
