package io.mrkuhne.mezo.feature.penz.service.sms;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** The SMS amount cross-check: the parsed amount must literally be in the SMS (HUF via the guard, else literal). */
class PenzSmsAmountCheckTest {

    private static final String S1 =
        "MBH Bank: Kartyas vasarlas -15 500 HUF, MOL 1093 BUDAORS, 2026.11.11 08:17. Egyenleg: 412 380 HUF";

    @Test
    void hufGoesThroughTheGuard() {
        assertThat(SmsAmountCheck.containsAmount(S1, "HUF", 1_550_000L)).isTrue();
        assertThat(SmsAmountCheck.containsAmount(S1, "HUF", 41_238_000L)).isTrue(); // the balance is a figure too
        assertThat(SmsAmountCheck.containsAmount(S1, "HUF", 155_000L)).isFalse();
        assertThat(SmsAmountCheck.containsAmount(S1, "HUF", 109_300L)).isFalse(); // a store number is no amount
    }

    @Test
    void foreignAmountsNeedTheirCodeOrSymbol() {
        assertThat(SmsAmountCheck.containsAmount("Card payment 12,50 EUR at Bistro", "EUR", 1250L)).isTrue();
        assertThat(SmsAmountCheck.containsAmount("Paid €12.50 at shop", "EUR", 1250L)).isTrue();
        assertThat(SmsAmountCheck.containsAmount("Vasarlas 1 234,56 USD", "USD", 123_456L)).isTrue();
        assertThat(SmsAmountCheck.containsAmount("Paid $7 at kiosk", "USD", 700L)).isTrue();
        assertThat(SmsAmountCheck.containsAmount("GBP 3,5 coffee", "GBP", 350L)).isTrue();
        assertThat(SmsAmountCheck.containsAmount("Card payment 12,50 EUR", "EUR", 1200L)).isFalse();
        assertThat(SmsAmountCheck.containsAmount("Card payment 12,50 EUR", "USD", 1250L)).isFalse();
        assertThat(SmsAmountCheck.containsAmount("Card payment 12,50 CHF", "CHF", 1250L)).isTrue();
    }
}
