package io.mrkuhne.mezo.feature.penz.service.sms;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.penz.service.sms.InvestSmsMatch.TxnRef;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * {@link InvestSmsMatch} (mezo-r36n9.119): the old {@code smsConversion.test.ts} describe('matchInvestTxnForSms')
 * (3 cases, ported vector for vector) plus the {@code findSmsCandidates} rule of {@code features/invest/record.ts}.
 * Invented, round figures only.
 */
class PenzInvestSmsMatchTest {

    private static final UUID MBH = UUID.fromString("00000000-0000-0000-0000-0000000000a1");
    private static final UUID REV = UUID.fromString("00000000-0000-0000-0000-0000000000a2");
    private static final UUID B1 = UUID.fromString("00000000-0000-0000-0000-0000000000b1");
    private static final long AMOUNT = 10_000_000L;
    private static final LocalDate PLANNED = LocalDate.parse("2026-11-05");

    private static TxnRef buy(UUID id, UUID account, String kind, long amount, String date, UUID sms) {
        return new TxnRef(id, account, kind, amount, LocalDate.parse(date), "manual", sms, null);
    }

    private static TxnRef buy(String date) {
        return buy(B1, MBH, "invest_buy", AMOUNT, date, null);
    }

    private static Optional<TxnRef> match(String kind, List<TxnRef> txns) {
        return InvestSmsMatch.matchInvestBuyForSms(kind, MBH, AMOUNT, PLANNED, txns);
    }

    @Test
    void testMatchInvestBuyForSms_shouldReturnTheBuy_whenSameAccountAndAmountWithinThreeDaysEitherSide() {
        assertThat(match("expense", List.of(buy("2026-11-02")))).map(TxnRef::id).contains(B1);
        assertThat(match("expense", List.of(buy("2026-11-08")))).map(TxnRef::id).contains(B1);
    }

    @Test
    void testMatchInvestBuyForSms_shouldPreferTheClosestDate_whenSeveralMatch() {
        UUID far = UUID.randomUUID();
        UUID near = UUID.randomUUID();
        assertThat(match("expense", List.of(buy(far, MBH, "invest_buy", AMOUNT, "2026-11-02", null),
            buy(near, MBH, "invest_buy", AMOUNT, "2026-11-05", null)))).map(TxnRef::id).contains(near);
    }

    @Test
    void testMatchInvestBuyForSms_shouldPreferTheEarlierDate_whenTwoAreEquallyClose() {
        UUID before = UUID.randomUUID();
        UUID after = UUID.randomUUID();
        assertThat(match("expense", List.of(buy(after, MBH, "invest_buy", AMOUNT, "2026-11-07", null),
            buy(before, MBH, "invest_buy", AMOUNT, "2026-11-03", null)))).map(TxnRef::id).contains(before);
    }

    @Test
    void testMatchInvestBuyForSms_shouldBeEmpty_whenIncomeLinkedOtherAccountOtherAmountFourDaysOrNotABuy() {
        assertThat(match("income", List.of(buy("2026-11-03")))).isEmpty();
        assertThat(match("expense", List.of(buy(B1, MBH, "invest_buy", AMOUNT, "2026-11-03", UUID.randomUUID()))))
            .isEmpty();
        assertThat(match("expense", List.of(buy(B1, REV, "invest_buy", AMOUNT, "2026-11-03", null)))).isEmpty();
        assertThat(match("expense", List.of(buy(B1, MBH, "invest_buy", 10_000_100L, "2026-11-03", null)))).isEmpty();
        assertThat(match("expense", List.of(buy("2026-11-01")))).isEmpty();
        assertThat(match("expense", List.of(buy("2026-11-09")))).isEmpty();
        assertThat(match("expense", List.of(buy(B1, MBH, "expense", AMOUNT, "2026-11-03", null)))).isEmpty();
        assertThat(match("expense", List.of(buy(B1, MBH, "invest_sell", AMOUNT, "2026-11-03", null)))).isEmpty();
    }

    private static TxnRef smsExpense(UUID id, String date) {
        return new TxnRef(id, MBH, "expense", AMOUNT, LocalDate.parse(date), "sms", UUID.randomUUID(), null);
    }

    @Test
    void testSmsCandidates_shouldOfferSmsExpensesWithinThreeDays_closestFirst() {
        UUID near = UUID.randomUUID();
        UUID far = UUID.randomUUID();
        UUID manualButLinked = UUID.randomUUID();
        List<TxnRef> rows = List.of(smsExpense(far, "2026-11-08"), smsExpense(near, "2026-11-04"),
            new TxnRef(manualButLinked, MBH, "expense", AMOUNT, PLANNED, "manual", UUID.randomUUID(), null));
        assertThat(InvestSmsMatch.smsCandidates(true, MBH, AMOUNT, PLANNED, rows, Set.of()))
            .extracting(TxnRef::id).containsExactly(manualButLinked, near, far);
    }

    @Test
    void testSmsCandidates_shouldBeEmpty_whenTheAccountHasNoSmsSender() {
        assertThat(InvestSmsMatch.smsCandidates(false, MBH, AMOUNT, PLANNED,
            List.of(smsExpense(UUID.randomUUID(), "2026-11-05")), Set.of())).isEmpty();
    }

    @Test
    void testSmsCandidates_shouldSkipManualRecurringLinkedOtherAccountOtherAmountNonExpenseAndDayFour() {
        UUID linked = UUID.randomUUID();
        List<TxnRef> rows = List.of(
            new TxnRef(UUID.randomUUID(), MBH, "expense", AMOUNT, PLANNED, "manual", null, null),
            new TxnRef(UUID.randomUUID(), MBH, "expense", AMOUNT, PLANNED, "sms", UUID.randomUUID(),
                UUID.randomUUID()),
            smsExpense(linked, "2026-11-05"),
            new TxnRef(UUID.randomUUID(), REV, "expense", AMOUNT, PLANNED, "sms", UUID.randomUUID(), null),
            new TxnRef(UUID.randomUUID(), MBH, "expense", AMOUNT + 100, PLANNED, "sms", UUID.randomUUID(), null),
            new TxnRef(UUID.randomUUID(), MBH, "income", AMOUNT, PLANNED, "sms", UUID.randomUUID(), null),
            new TxnRef(UUID.randomUUID(), MBH, "invest_buy", AMOUNT, PLANNED, "sms", UUID.randomUUID(), null),
            smsExpense(UUID.randomUUID(), "2026-11-01"),
            smsExpense(UUID.randomUUID(), "2026-11-09"));
        assertThat(InvestSmsMatch.smsCandidates(true, MBH, AMOUNT, PLANNED, rows, Set.of(linked))).isEmpty();
    }
}
