package io.mrkuhne.mezo.feature.character.service.chat;

import java.util.Optional;

/**
 * What the team chat voice seam hands back for one event (Csapatfal Act III, spec 2026-09-26 §5.3):
 * the owner's line, whether an LLM wrote it (and passed the fact guard), and the optional guest and
 * Szkeptikus lines. The guest / skeptic lines only ever exist when {@code voiced} is true — a
 * template owner line never carries company.
 */
public record TeamChatLines(String ownerBody, boolean voiced, Optional<String> guestBody,
        Optional<String> skepticBody) {

    /** The honest template fallback: the given text, {@code voiced=false}, nobody else speaks. */
    public static TeamChatLines template(String templateText) {
        return new TeamChatLines(templateText, false, Optional.empty(), Optional.empty());
    }
}
