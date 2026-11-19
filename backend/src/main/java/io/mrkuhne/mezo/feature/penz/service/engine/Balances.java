package io.mrkuhne.mezo.feature.penz.service.engine;

import java.util.List;

/** Account balances, a port of the old app's {@code src/domain/balances.ts}. */
public final class Balances {

    private Balances() {
    }

    /**
     * Balance in the account's currency (minor units). Normally uses {@code amountMinor}. A txn
     * whose currency differs from the account's (legacy data) is counted at its HUF twin when the
     * account is HUF, and otherwise skipped and reported in {@code skippedCount} rather than mixing
     * currencies. Inflows (income, transfer in, invest sell) add; everything else subtracts.
     */
    public static AccountBalance accountBalance(AccountInput account, List<TxnInput> txns) {
        long balance = account.openingBalanceMinor();
        int skipped = 0;
        for (TxnInput t : txns) {
            if (!account.id().equals(t.accountId())) {
                continue;
            }
            long amount = t.amountMinor();
            if (!t.currency().equals(account.currency())) {
                if (!"HUF".equals(account.currency())) {
                    skipped++;
                    continue;
                }
                amount = t.amountHufMinor();
            }
            balance += t.kind().isInflow() ? amount : -amount;
        }
        return new AccountBalance(balance, skipped);
    }

    public static long accountBalanceMinor(AccountInput account, List<TxnInput> txns) {
        return accountBalance(account, txns).balanceMinor();
    }
}
