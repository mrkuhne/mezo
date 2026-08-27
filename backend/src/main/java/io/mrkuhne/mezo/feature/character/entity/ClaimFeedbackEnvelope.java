package io.mrkuhne.mezo.feature.character.entity;

import java.time.Instant;
import java.util.List;

/** Append-only user feedback history on a claim (spec §7). */
public record ClaimFeedbackEnvelope(List<Event> events) {

    public record Event(String kind, String text, Instant at) {
    }
}
