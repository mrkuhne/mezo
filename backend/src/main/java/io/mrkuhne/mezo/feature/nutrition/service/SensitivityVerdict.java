package io.mrkuhne.mezo.feature.nutrition.service;

import java.util.List;

/**
 * What the profile says about one food or recipe. {@code blocksSuggestion} only governs what Boop
 * PROPOSES — nothing is ever blocked from being logged.
 */
public record SensitivityVerdict(boolean blocksSuggestion, List<Warning> warnings) {

    /** {@code key} is the sensitivity key (or {@code nova}); {@code text} the short reason. */
    public record Warning(String key, String text) {
    }
}
