package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;

/**
 * Builds a CompanionProperties whose only meaningful field is the gear switch. Every other
 * component is null on purpose: a unit test that reaches one of them should fail loudly rather
 * than quietly read a default that production does not have.
 */
final class CompanionPropertiesFixtures {

    private CompanionPropertiesFixtures() {
    }

    static CompanionProperties withGearClassifier(boolean enabled) {
        CompanionProperties.Turn turn = new CompanionProperties.Turn(
            new CompanionProperties.Turn.Gear(enabled),
            new CompanionProperties.Turn.Planner(1),
            new CompanionProperties.Turn.Executor(4, 15_000L),
            new CompanionProperties.Turn.Answerer("high"));
        // tools (4th component) mirrors application.yml's companion.tools block; the remaining
        // 17 nulls + interventions + turn make up the 20 components of CompanionProperties.
        CompanionProperties.Tools tools = new CompanionProperties.Tools(15, 30, 26, 10);
        return new CompanionProperties(null, null, null, tools, null, null, null, null, null, null,
            null, null, null, null, null, null, null, null, java.util.List.of(), turn);
    }
}
