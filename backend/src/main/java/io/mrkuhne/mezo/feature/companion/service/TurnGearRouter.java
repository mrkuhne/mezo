package io.mrkuhne.mezo.feature.companion.service;

import java.util.Optional;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;

/**
 * The single place a turn's gear is decided: deterministic rules first, the cheap classifier only
 * for what they cannot settle, and ANALYSIS whenever anything is unclear or broken.
 *
 * <p>The fallback is the TOP gear on purpose. Guessing too high costs latency; guessing too low
 * costs the user a worse answer, and this system exists because the answers were too thin.
 *
 * <p><b>Gated on the companion switch</b> (mezo-rj214.7) because it requires {@code GearClassifier},
 * which requires a {@code CompanionLlm} — a bean that only exists when the companion is on. Its one
 * consumer, {@code ChatService}, carries the same condition.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
@RequiredArgsConstructor
public class TurnGearRouter {

    private final TurnGearAnalyzer analyzer;
    private final GearClassifier classifier;
    private final CompanionProperties properties;

    public TurnGear route(String userMessage) {
        return analyzer.analyze(userMessage)
            .or(() -> properties.turn().gear().classifierEnabled()
                ? classifier.classify(userMessage)
                : Optional.<TurnGear>empty())
            .orElse(TurnGear.ANALYSIS);
    }
}
