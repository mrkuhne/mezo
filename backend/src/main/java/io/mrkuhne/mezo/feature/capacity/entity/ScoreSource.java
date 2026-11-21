package io.mrkuhne.mezo.feature.capacity.entity;

/** Who produced an event score (Boop B7 K1, mezo-r36n9.17): stored as {@link #value()}. */
public enum ScoreSource {
    LLM("llm"),
    RULE("rule");

    private final String value;

    ScoreSource(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }
}
