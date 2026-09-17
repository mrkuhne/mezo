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
        // 18 nulls + interventions + turn = the 20 components of CompanionProperties.
        return new CompanionProperties(null, null, null, null, null, null, null, null, null, null,
            null, null, null, null, null, null, null, null, java.util.List.of(), turn);
    }
}
