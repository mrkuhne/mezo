package io.mrkuhne.mezo.feature.character.service.edition;

import io.mrkuhne.mezo.feature.character.entity.EditionRef;
import java.time.Instant;
import java.util.List;

/** Egy esti kiadás jelölt — a válogatás (EditionSelector) bemenete. */
public record EditionCandidate(
        String sourceKind,
        String sourceId,
        TeamCharacter character,
        EditionGenre genre,
        String title,
        String recordText,
        List<String> facts,
        List<EditionRef> refs,
        boolean waiting,
        boolean claimChange,
        Instant changedAt,
        String sourceRoute) {

    public String sourceKey() {
        return sourceKind + ":" + sourceId;
    }
}
