package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import org.junit.jupiter.api.Test;

class TurnGearRouterTest {

    private static final String UNSURE_MESSAGE = "Az alvás.";

    private TurnGearRouter router(boolean classifierEnabled, String classifierAnswer) {
        GearClassifier classifier = new GearClassifier((system, user) -> classifierAnswer);
        return new TurnGearRouter(new TurnGearAnalyzer(), classifier,
            CompanionPropertiesFixtures.withGearClassifier(classifierEnabled));
    }

    @Test
    void testRoute_shouldSkipTheClassifier_whenTheAnalyzerIsSure() {
        // The classifier would say ANALYSIS; the analyzer is sure it is CHAT, so it is never asked.
        assertThat(router(true, "ANALYSIS").route("Szia!")).isEqualTo(TurnGear.CHAT);
    }

    @Test
    void testRoute_shouldUseTheClassifier_whenTheAnalyzerIsUnsure() {
        assertThat(router(true, "LOOKUP").route(UNSURE_MESSAGE)).isEqualTo(TurnGear.LOOKUP);
    }

    @Test
    void testRoute_shouldFallBackToAnalysis_whenTheClassifierAnswersGarbage() {
        assertThat(router(true, "banán").route(UNSURE_MESSAGE)).isEqualTo(TurnGear.ANALYSIS);
    }

    @Test
    void testRoute_shouldFallBackToAnalysis_whenTheClassifierThrows() {
        GearClassifier throwing = new GearClassifier((system, user) -> {
            throw new IllegalStateException("provider down");
        });
        TurnGearRouter router = new TurnGearRouter(new TurnGearAnalyzer(), throwing,
            CompanionPropertiesFixtures.withGearClassifier(true));
        assertThat(router.route(UNSURE_MESSAGE)).isEqualTo(TurnGear.ANALYSIS);
    }

    @Test
    void testRoute_shouldFallBackToAnalysis_whenTheClassifierIsDisabled() {
        assertThat(router(false, "LOOKUP").route(UNSURE_MESSAGE)).isEqualTo(TurnGear.ANALYSIS);
    }
}
