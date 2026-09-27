package io.mrkuhne.mezo.feature.character.entity;

import java.util.List;

/** S7 (mezo-d6ivw.7): an exception's lowercase match stems, stored as jsonb. */
public record KeywordsEnvelope(List<String> keywords) {
    public KeywordsEnvelope {
        keywords = keywords == null ? List.of() : List.copyOf(keywords);
    }
}
