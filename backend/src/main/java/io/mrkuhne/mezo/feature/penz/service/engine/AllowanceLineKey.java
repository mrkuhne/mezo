package io.mrkuhne.mezo.feature.penz.service.engine;

/**
 * The derivation line keys shared by the engine and the API (L4 brief — use exactly these), in
 * display order. free = recurringIncome + oneOffIncome − fixedCosts − savingsTarget − practice −
 * invested − previousDeficit; remaining = free − spent.
 */
public enum AllowanceLineKey {
    RECURRING_INCOME("recurringIncome"),
    ONE_OFF_INCOME("oneOffIncome"),
    FIXED_COSTS("fixedCosts"),
    SAVINGS_TARGET("savingsTarget"),
    PRACTICE("practice"),
    INVESTED("invested"),
    PREVIOUS_DEFICIT("previousDeficit"),
    FREE("free"),
    SPENT("spent"),
    REMAINING("remaining");

    private final String wireKey;

    AllowanceLineKey(String wireKey) {
        this.wireKey = wireKey;
    }

    /** The key as it appears in the API's {@code lines[].key}. */
    public String wireKey() {
        return wireKey;
    }
}
