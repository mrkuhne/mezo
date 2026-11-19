package io.mrkuhne.mezo.feature.penz.service.sms;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.penz.service.sms.SmsConversion.AccountRef;
import io.mrkuhne.mezo.feature.penz.service.sms.SmsConversion.CategoryRef;
import io.mrkuhne.mezo.feature.penz.service.sms.SmsConversion.ParsedSms;
import io.mrkuhne.mezo.feature.penz.service.sms.SmsConversion.SmsTxnPlan;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * The applicable cases of the old {@code src/app/smsConversion.test.ts}: {@code pickSmsAccount} (1) and
 * {@code planSmsTxn} (5). {@code dedupePending} (2) is replaced by the database unique index and covered by
 * {@code PenzSmsIngestApiIT#replayIsADuplicateAndNeverASecondTransaction}; {@code matchInvestTxnForSms} (3) and
 * {@code runConvertSms} (3, all invest-buy adoption) are L6.
 */
class PenzSmsConversionTest {

    private static final UUID SMS1 = UUID.fromString("00000000-0000-0000-0000-0000000005a1");
    private static final UUID CAT_GROCERIES = UUID.randomUUID();
    private static final UUID CAT_TRANSPORT = UUID.randomUUID();
    private static final UUID CAT_OTHER_IN = UUID.randomUUID();
    private static final UUID CAT_OTHER_OUT = UUID.randomUUID();
    private static final List<CategoryRef> CATS = List.of(
        new CategoryRef(CAT_GROCERIES, "Groceries", "expense"),
        new CategoryRef(CAT_TRANSPORT, "Transport", "expense"),
        new CategoryRef(CAT_OTHER_IN, "Other", "income"),
        new CategoryRef(CAT_OTHER_OUT, "Other", "expense"));
    private static final LocalDate D = LocalDate.parse("2026-11-11");

    private static AccountRef acct(UUID id, String currency, boolean isDefault, boolean archived, String sender) {
        return new AccountRef(id, currency, isDefault, archived, sender);
    }

    private static AccountRef huf() {
        return acct(UUID.randomUUID(), "HUF", false, false, null);
    }

    private static ParsedSms msg(String kind, long amountMinor, String currency, String merchant, String category) {
        return new ParsedSms(SMS1, kind, amountMinor, currency, merchant, D, category);
    }

    private static SmsTxnPlan plan(ParsedSms m, AccountRef a, String msgRate, String accountRate) {
        return SmsConversion.plan(m, a, CATS, new BigDecimal(msgRate), new BigDecimal(accountRate));
    }

    @Test
    void pickAccountSenderMatchBeatsDefaultArchivedNeverChosen() {
        UUID rev = UUID.randomUUID();
        UUID mbh = UUID.randomUUID();
        UUID old = UUID.randomUUID();
        UUID def = UUID.randomUUID();
        assertThat(SmsConversion.pickAccount("MBH Bank", List.of(acct(rev, "HUF", true, false, null),
            acct(mbh, "HUF", false, false, " mbh bank "))).id()).isEqualTo(mbh);
        assertThat(SmsConversion.pickAccount("MBH Bank", List.of(acct(old, "HUF", false, true, "MBH Bank"),
            acct(def, "HUF", true, false, null))).id()).isEqualTo(def);
        assertThat(SmsConversion.pickAccount("X", List.of())).isNull();
    }

    @Test
    void planHufExpenseOnHufAccount() {
        UUID mbh = UUID.randomUUID();
        SmsTxnPlan t = plan(msg("expense", 1_550_000L, "HUF", "MOL", "transport"), acct(mbh, "HUF", false, false, null),
            "1", "1");
        assertThat(t).isEqualTo(new SmsTxnPlan(mbh, "expense", 1_550_000L, "HUF", 1_550_000L, CAT_TRANSPORT, D, "MOL",
            SMS1, false));
    }

    @Test
    void planEurPurchaseOnHufAccountConvertsAndKeepsTheOriginalInTheNote() {
        SmsTxnPlan t = plan(msg("expense", 1250L, "EUR", "Bistro", null), huf(), "400", "1");
        assertThat(t.amountMinor()).isEqualTo(500_000L);
        assertThat(t.currency()).isEqualTo("HUF");
        assertThat(t.amountHufMinor()).isEqualTo(500_000L);
        assertThat(t.note()).matches("^Bistro · .*12[.,]50.*");
        assertThat(t.converted()).isTrue();
    }

    @Test
    void planUnknownCategoryNullMissingMerchantEmptyNote() {
        SmsTxnPlan t = plan(msg("expense", 1000L, "HUF", null, null), huf(), "1", "1");
        assertThat(t.categoryId()).isNull();
        assertThat(t.note()).isEmpty();
    }

    @Test
    void planConvertedWithNoMerchantHasNoLeadingSeparator() {
        SmsTxnPlan t = plan(msg("expense", 1250L, "EUR", null, null), huf(), "400", "1");
        assertThat(t.note()).matches("^12[.,]50.*");
    }

    @Test
    void planCategoryMatchedByNameAndKind() {
        assertThat(plan(msg("expense", 1000L, "HUF", null, "Other"), huf(), "1", "1").categoryId())
            .isEqualTo(CAT_OTHER_OUT);
        assertThat(plan(msg("income", 1000L, "HUF", null, "other"), huf(), "1", "1").categoryId())
            .isEqualTo(CAT_OTHER_IN);
        assertThat(plan(msg("income", 1000L, "HUF", null, "Groceries"), huf(), "1", "1").categoryId()).isNull();
    }

    // ---- beyond the oracle ----

    @Test
    void planHufSmsOnEurAccountConvertsIntoTheAccountCurrency() {
        SmsTxnPlan t = plan(msg("expense", 400_000L, "HUF", "Bolt", null),
            acct(UUID.randomUUID(), "EUR", false, false, null), "1", "400");
        assertThat(t.amountMinor()).isEqualTo(1000L); // 4 000 Ft at 400 Ft/EUR = 10,00 EUR
        assertThat(t.currency()).isEqualTo("EUR");
        assertThat(t.amountHufMinor()).isEqualTo(400_000L);
        assertThat(t.note()).isEqualTo("Bolt · 4 000 HUF");
    }

    @Test
    void formatMoneyGroupsThousandsAndWritesDecimalsAfterAComma() {
        assertThat(SmsConversion.formatMoney(123_456_78L, "EUR")).isEqualTo("123 456,78 EUR");
        assertThat(SmsConversion.formatMoney(1_550_000L, "HUF")).isEqualTo("15 500 HUF");
    }
}
