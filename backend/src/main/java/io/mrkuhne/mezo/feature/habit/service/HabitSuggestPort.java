package io.mrkuhne.mezo.feature.habit.service;

import java.util.List;
import java.util.UUID;

/**
 * Propose-only habit suggestions (mezo-n5e9.3, ADR 0019): implemented by the companion's
 * smart-model adapter; absent bean (any gating switch off) means the endpoint 503s cleanly.
 * The model never writes — accepting a suggestion goes through the normal createDef path.
 *
 * <p>Since mezo-3zue.2 a suggestion may also propose a full framework recipe: {@code framework}
 * (FOGG/CLEAR) plus that framework's own fields ({@code cue}/{@code craving}/{@code reward} for
 * CLEAR, {@code celebration} for FOGG — the anchor stays the existing {@code anchorCopy}). All
 * five are optional; a model response omitting them still parses (Jackson leaves the record
 * components {@code null}), so a legacy-shaped suggestion round-trips unchanged.
 */
public interface HabitSuggestPort {

    record Suggestion(String title, String why, String anchorCopy, String skillKey, int xp,
        String chainKey, String framework, String cue, String craving, String reward,
        String celebration) {}

    List<Suggestion> suggest(UUID userId, String chainKey, String hint);
}
