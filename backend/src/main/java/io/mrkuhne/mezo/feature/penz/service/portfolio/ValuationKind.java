package io.mrkuhne.mezo.feature.penz.service.portfolio;

/** How a holding got its value: a market quote, a bond's simple-interest accrual, or its cost. */
public enum ValuationKind {
    QUOTE, ACCRUAL, COST;

    public String wire() {
        return name().toLowerCase(java.util.Locale.ROOT);
    }
}
