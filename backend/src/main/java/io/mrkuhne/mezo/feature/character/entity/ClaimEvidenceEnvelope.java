package io.mrkuhne.mezo.feature.character.entity;

import java.util.List;

/** Evidence refs behind a claim — code-collected ids, never invented (spec §4). */
public record ClaimEvidenceEnvelope(List<Ref> refs) {

    public record Ref(String kind, String id, String label) {
    }
}
