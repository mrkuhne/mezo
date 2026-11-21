package io.mrkuhne.mezo.feature.mail.service;

/** The owner's tap on an item: "érdekel" or "nem érdekel". {@code column} is the stored value. */
public enum Verdict {
    INTEREST("interest", "érdekel"),
    NOPE("nope", "nem érdekel");

    private final String column;
    private final String label;

    Verdict(String column, String label) {
        this.column = column;
        this.label = label;
    }

    public String column() {
        return column;
    }

    /** The Hungarian word the few-shot examples carry. */
    public String label() {
        return label;
    }
}
