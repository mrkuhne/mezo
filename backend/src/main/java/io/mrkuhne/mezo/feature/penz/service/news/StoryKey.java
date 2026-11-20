package io.mrkuhne.mezo.feature.penz.service.news;

import java.util.Objects;
import java.util.UUID;

/** What a group of articles is keyed by (mezo-r36n9.104): a holding id, or a macro kind ({@code holdingId} null). */
public record StoryKey(DigestKind kind, UUID holdingId) {

    /** A holding key carries the holding id, a macro key none — build keys through the factories below. */
    public StoryKey {
        Objects.requireNonNull(kind, "kind");
        if (kind != DigestKind.HOLDING) {
            holdingId = null;
        } else {
            Objects.requireNonNull(holdingId, "holdingId");
        }
    }

    public static StoryKey holding(UUID holdingId) {
        return new StoryKey(DigestKind.HOLDING, holdingId);
    }

    public static StoryKey fx() {
        return new StoryKey(DigestKind.FX, null);
    }

    public static StoryKey rates() {
        return new StoryKey(DigestKind.RATES, null);
    }

    /** Stable text form ({@code holding:<uuid>}, {@code fx}, {@code rates}) — the story-id hash input. */
    public String slug() {
        return kind == DigestKind.HOLDING ? "holding:" + holdingId : kind.wire();
    }
}
