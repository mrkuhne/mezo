package io.mrkuhne.mezo.feature.penz.service.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Mirrors the old app's {@code src/domain/balances.test.ts} 1:1 (7 cases). */
class PenzBalancesTest {

    private static final UUID A1 = UUID.nameUUIDFromBytes("a1".getBytes());
    private static final UUID A2 = UUID.nameUUIDFromBytes("a2".getBytes());
    private static final LocalDate DAY = LocalDate.parse("2026-11-05");

    private static AccountInput acct(String currency, long opening) {
        return new AccountInput(A1, currency, opening);
    }

    private static TxnInput mk(TxnKind kind, long amount) {
        return new TxnInput(A1, kind, amount, "HUF", amount, DAY, null);
    }

    private static TxnInput mk(TxnKind kind, long amount, String currency, long hufMinor) {
        return new TxnInput(A1, kind, amount, currency, hufMinor, DAY, null);
    }

    // balances.test.ts > accountBalanceMinor > opening + income - expense - transfer_out
    @Test
    void openingPlusIncomeMinusExpenseMinusTransferOut() {
        assertThat(Balances.accountBalanceMinor(acct("HUF", 100_000_00),
            List.of(mk(TxnKind.INCOME, 600_000_00), mk(TxnKind.EXPENSE, 200_000_00), mk(TxnKind.TRANSFER_OUT, 50_000_00))))
            .isEqualTo(450_000_00);
    }

    // balances.test.ts > accountBalanceMinor > invest_buy subtracts and invest_sell adds
    @Test
    void investBuySubtractsAndInvestSellAdds() {
        assertThat(Balances.accountBalanceMinor(acct("HUF", 100_000),
            List.of(mk(TxnKind.INVEST_BUY, 30_000), mk(TxnKind.INVEST_SELL, 10_000)))).isEqualTo(80_000);
    }

    // balances.test.ts > accountBalanceMinor > adds transfer_in
    @Test
    void addsTransferIn() {
        assertThat(Balances.accountBalanceMinor(acct("HUF", 0), List.of(mk(TxnKind.TRANSFER_IN, 70)))).isEqualTo(70);
    }

    // balances.test.ts > accountBalanceMinor > ignores other accounts
    @Test
    void ignoresOtherAccounts() {
        TxnInput other = new TxnInput(A2, TxnKind.INCOME, 999, "HUF", 999, DAY, null);
        assertThat(Balances.accountBalanceMinor(acct("HUF", 0), List.of(other))).isZero();
    }

    // balances.test.ts > accountBalanceMinor > uses account currency amount, not HUF
    @Test
    void usesAccountCurrencyAmountNotHuf() {
        assertThat(Balances.accountBalanceMinor(acct("EUR", 0), List.of(mk(TxnKind.INCOME, 100, "EUR", 40_000))))
            .isEqualTo(100);
    }

    // balances.test.ts > accountBalanceMinor > mismatched currency: HUF account uses amount_huf_minor
    @Test
    void mismatchedCurrencyOnHufAccountUsesHufTwin() {
        assertThat(Balances.accountBalanceMinor(acct("HUF", 10_000_00), List.of(mk(TxnKind.EXPENSE, 2_53, "EUR", 1_000_00))))
            .isEqualTo(9_000_00);
    }

    // balances.test.ts > accountBalanceMinor > mismatched currency on a non-HUF account is skipped and counted
    @Test
    void mismatchedCurrencyOnNonHufAccountIsSkippedAndCounted() {
        AccountBalance r = Balances.accountBalance(acct("EUR", 100_00),
            List.of(mk(TxnKind.EXPENSE, 5_000_00, "HUF", 5_000_00), mk(TxnKind.EXPENSE, 10_00, "EUR", 4_000_00)));
        assertThat(r).isEqualTo(new AccountBalance(90_00, 1));
    }
}
