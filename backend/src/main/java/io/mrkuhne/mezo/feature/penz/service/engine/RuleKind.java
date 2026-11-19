package io.mrkuhne.mezo.feature.penz.service.engine;

/** A recurring rule is either an income or an expense (old {@code RecurringRule.kind}). */
public enum RuleKind {
    EXPENSE, INCOME;

    /** The transaction kind a materialized occurrence of this rule gets. */
    public TxnKind txnKind() {
        return this == INCOME ? TxnKind.INCOME : TxnKind.EXPENSE;
    }
}
