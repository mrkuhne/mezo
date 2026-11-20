package io.mrkuhne.mezo.feature.penz.service.portfolio;

/** A buy opens a lot; a sell consumes lots oldest first. */
public enum Side {
    BUY, SELL;

    /** From the stored / wire value {@code buy} | {@code sell}. */
    public static Side of(String wire) {
        return "sell".equals(wire) ? SELL : BUY;
    }

    public String wire() {
        return this == SELL ? "sell" : "buy";
    }
}
