package io.mrkuhne.mezo.feature.habit.service;

import java.util.List;
import java.util.UUID;

/**
 * Propose-only habit suggestions (mezo-n5e9.3, ADR 0019): implemented by the companion's
 * smart-model adapter; absent bean (any gating switch off) means the endpoint 503s cleanly.
 * The model never writes — accepting a suggestion goes through the normal createDef path.
 */
public interface HabitSuggestPort {

    record Suggestion(String title, String why, String anchorCopy, String skillKey, int xp,
        String chainKey) {}

    List<Suggestion> suggest(UUID userId, String chainKey, String hint);
}
