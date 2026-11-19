package io.mrkuhne.mezo.feature.penz.service.engine;

/** Transaction kinds, as the old app's {@code TxnKind} (wire/DB values are the lower-case names). */
public enum TxnKind {
    EXPENSE, INCOME, TRANSFER_OUT, TRANSFER_IN, INVEST_BUY, INVEST_SELL;

    /** Money flowing INTO the account (the balance adds it); everything else subtracts. */
    public boolean isInflow() {
        return this == INCOME || this == TRANSFER_IN || this == INVEST_SELL;
    }
}
