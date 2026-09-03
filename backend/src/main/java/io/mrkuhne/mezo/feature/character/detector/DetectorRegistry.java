package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.feature.character.config.CharacterProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Runs every ENABLED detector (per-key kill switches, spec §5) over one day's input. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class DetectorRegistry {

    private final List<CharacterDetector> detectors; // Spring injects all @Component detectors
    private final CharacterProperties properties;

    public List<DetectorSignal> runAll(DetectorInput input) {
        return detectors.stream()
                .filter(d -> properties.detectorEnabled(d.key()))
                .flatMap(d -> d.detect(input).stream())
                .toList();
    }
}
