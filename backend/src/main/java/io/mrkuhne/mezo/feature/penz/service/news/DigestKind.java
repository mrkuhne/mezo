package io.mrkuhne.mezo.feature.penz.service.news;

/** What a digest story is about (mezo-r36n9.104): one holding, the forint's exchange rate, or interest rates. */
public enum DigestKind {
    HOLDING("holding"), FX("fx"), RATES("rates");

    private final String wire;

    DigestKind(String wire) {
        this.wire = wire;
    }

    /** The {@code PenzDigestItem.kind} value. */
    public String wire() {
        return wire;
    }
}
