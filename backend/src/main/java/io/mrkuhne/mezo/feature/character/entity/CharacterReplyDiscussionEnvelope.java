package io.mrkuhne.mezo.feature.character.entity;

import java.util.List;

/** Validated public expert comments in the existing reply processing cycle. */
public record CharacterReplyDiscussionEnvelope(List<ConferenceDeliberationEnvelope.PeerReaction> comments) {
    public CharacterReplyDiscussionEnvelope {
        comments = comments == null ? List.of() : List.copyOf(comments);
    }
}
