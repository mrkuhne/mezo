package io.mrkuhne.mezo.feature.character.entity;

import java.util.List;

/** Structured change list — the feed's diff source (spec §4/§6). */
public record ConferenceOutcomeEnvelope(List<Change> changes) {

    public record Change(String kind, String dimensionKey, String claimId, String summary) {
    }
}
