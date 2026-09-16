package io.mrkuhne.mezo.feature.companion.service;

import java.util.Optional;

import org.springframework.stereotype.Component;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import lombok.RequiredArgsConstructor;

/**
 * The single place a turn's gear is decided: deterministic rules first, the cheap classifier only
 * for what they cannot settle, and ANALYSIS whenever anything is unclear or broken.
 *
 * <p>The fallback is the TOP gear on purpose. Guessing too high costs latency; guessing too low
 * costs the user a worse answer, and this system exists because the answers were too thin.
 */
@Component
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
