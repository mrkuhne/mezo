package io.mrkuhne.mezo.feature.penz.service.sms;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.penz.service.sms.SmsIngestLogic.BodyCheck;
import io.mrkuhne.mezo.feature.penz.service.sms.SmsIngestLogic.Normalized;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * The 15 vitest cases of the old {@code base44/functions/ingest-sms/logic.test.ts}, one test per {@code it()},
 * same vectors (the key prefix is {@code mzp_} instead of {@code ft_}; the hash vectors are untouched because
 * SHA-256 does not care). Amounts are the old fixtures (invented).
 */
class PenzSmsIngestLogicTest {

    private static final String S1 =
        "MBH Bank: Kartyas vasarlas -15 500 HUF, MOL 1093 BUDAORS, 2026.11.11 08:17. Egyenleg: 412 380 HUF";
    private static final String OTP = "MBH Bank: Az On egyszer hasznalatos kodja: 482913";
    private static final List<String> CATS = List.of("Groceries", "Transport", "Dining");
    private static final LocalDate D12 = LocalDate.parse("2026-11-12");
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private static JsonNode j(String json) {
        return JSON.readTree(json);
    }

    private static Normalized n(String json) {
        return SmsIngestLogic.normalizeParsed(j(json), D12, CATS);
    }

    // 1
    @Test
    void extractApiKeyPrefersXApiKeyAcceptsBearerMzpOnly() {
        assertThat(PenzSmsKeys.extract(" mzp_a ", null)).isEqualTo("mzp_a");
        assertThat(PenzSmsKeys.extract(null, "Bearer mzp_b")).isEqualTo("mzp_b");
        assertThat(PenzSmsKeys.extract(null, "Bearer eyJplatformtoken")).isNull();
        assertThat(PenzSmsKeys.extract("", null)).isNull();
        assertThat(PenzSmsKeys.extract(null, null)).isNull();
    }

    // 2
    @Test
    void sha256HexSharesTheClientVector() {
        assertThat(SmsIngestLogic.sha256Hex("ft_test_key"))
            .isEqualTo("c55775582807cd18d29c1ca2ebddf6985219452099c6c03f1f9d623e6be6a1de");
    }

    // 3
    @Test
    void dedupeHashTrimsAndJoinsWithPipe() {
        assertThat(SmsIngestLogic.dedupeHash(" MBH Bank ", S1 + "\n"))
            .isEqualTo("8492fff52f966d6674637bb206de97097262e8b7501fb0901f1310735a902649");
    }

    // 4
    @Test
    void validateBody() {
        Instant now = Instant.parse("2026-11-11T07:20:00.000Z");
        BodyCheck ok = SmsIngestLogic.validateBody(S1, "MBH Bank", null, now);
        assertThat(ok.ok()).isTrue();
        assertThat(ok.value()).isEqualTo(new SmsIngestLogic.ValidBody(S1, "MBH Bank", now));
        assertThat(SmsIngestLogic.validateBody("  ", null, null, now).ok()).isFalse();
        assertThat(SmsIngestLogic.validateBody("x".repeat(1001), null, null, now).ok()).isFalse();
        assertThat(SmsIngestLogic.validateBody(null, null, null, now).ok()).isFalse();
        BodyCheck fallback = SmsIngestLogic.validateBody("a", null, "yesterday", now);
        assertThat(fallback.value().sender()).isEqualTo("unknown");
        assertThat(fallback.value().receivedAt()).isEqualTo(now);
        // extension: a usable ISO stamp with an offset is kept
        assertThat(SmsIngestLogic.validateBody("a", null, "2026-11-11T08:17:00+01:00", now).value().receivedAt())
            .isEqualTo(Instant.parse("2026-11-11T07:17:00Z"));
    }

    // 5
    @Test
    void looksLikeMoney() {
        assertThat(SmsIngestLogic.looksLikeMoney(S1)).isTrue();
        assertThat(SmsIngestLogic.looksLikeMoney("Jovairas +250 000 Ft erkezett")).isTrue();
        assertThat(SmsIngestLogic.looksLikeMoney("Card payment 12,50 EUR")).isTrue();
        assertThat(SmsIngestLogic.looksLikeMoney("Paid €12,50 at shop")).isTrue();
        assertThat(SmsIngestLogic.looksLikeMoney(OTP)).isFalse();
    }

    // 6
    @Test
    void budapestDateCrossesMidnightCorrectly() {
        assertThat(SmsIngestLogic.budapestDate(Instant.parse("2026-11-10T23:30:00Z")))
            .isEqualTo(LocalDate.parse("2026-11-11"));
    }

    // 7
    @Test
    void normalizeParsedDebitToExpenseInMinorUnitsCategoryFromList() {
        assertThat(n("""
            {"is_transaction":true,"direction":"debit","amount":15500,"currency":"huf","merchant":" MOL ",
             "date":"2026-11-11","category":"Transport"}"""))
            .isEqualTo(new Normalized("parsed", null, "expense", 1_550_000L, "HUF", "MOL",
                LocalDate.parse("2026-11-11"), "Transport"));
    }

    // 8
    @Test
    void normalizeParsedCreditToIncomeBadDateAndUnknownCategoryFallBack() {
        assertThat(n("""
            {"is_transaction":true,"direction":"credit","amount":12.5,"currency":"EUR","merchant":"",
             "date":"2026-13-40","category":"Salary??"}"""))
            .isEqualTo(new Normalized("parsed", null, "income", 1250L, "EUR", null, D12, null));
    }

    // 9
    @Test
    void normalizeParsedCategoryMatchIsCaseInsensitiveAndCanonical() {
        assertThat(n("{\"is_transaction\":true,\"direction\":\"debit\",\"amount\":1,\"currency\":\"HUF\","
            + "\"category\":\"groceries\"}").categoryName()).isEqualTo("Groceries");
    }

    // 10
    @Test
    void normalizeParsedNotATransactionIgnoredGarbageFailed() {
        assertThat(n("{\"is_transaction\":false}")).isEqualTo(Normalized.ignored("not_a_transaction"));
        assertThat(n("{\"is_transaction\":true,\"direction\":\"debit\",\"amount\":-5,\"currency\":\"HUF\"}").status())
            .isEqualTo("failed");
        assertThat(n("{\"is_transaction\":true,\"direction\":\"debit\",\"amount\":5,\"currency\":\"forint\"}")
            .status()).isEqualTo("failed");
        assertThat(n("{\"is_transaction\":true,\"direction\":\"sideways\",\"amount\":5,\"currency\":\"HUF\"}")
            .status()).isEqualTo("failed");
        assertThat(n("\"oops\"").status()).isEqualTo("failed");
        assertThat(SmsIngestLogic.normalizeParsed(null, D12, CATS).status()).isEqualTo("failed");
    }

    // 11
    @Test
    void normalizeParsedOnlyAnExplicitFalseIsIgnoredOtherNonTrueValuesFail() {
        String d = "\"direction\":\"debit\",\"amount\":5,\"currency\":\"HUF\"";
        assertThat(n("{" + d + ",\"is_transaction\":\"false\"}")).isEqualTo(Normalized.failed("bad_shape"));
        assertThat(n("{" + d + "}")).isEqualTo(Normalized.failed("bad_shape"));
        assertThat(n("{" + d + ",\"is_transaction\":null}")).isEqualTo(Normalized.failed("bad_shape"));
        assertThat(n("{" + d + ",\"is_transaction\":1}")).isEqualTo(Normalized.failed("bad_shape"));
    }

    // 12
    @Test
    void normalizeParsedAmountMustBeASafeIntegerOfMinorUnitsUpToOneBillionMajorUnits() {
        String t = "\"is_transaction\":true,\"direction\":\"debit\",\"currency\":\"HUF\"";
        Normalized max = n("{" + t + ",\"amount\":1000000000}");
        assertThat(max.status()).isEqualTo("parsed");
        assertThat(max.amountMinor()).isEqualTo(100_000_000_000L);
        assertThat(n("{" + t + ",\"amount\":1000000000.01}")).isEqualTo(Normalized.failed("bad_amount"));
        assertThat(n("{" + t + ",\"amount\":1e300}")).isEqualTo(Normalized.failed("bad_amount"));
    }

    // 13
    @Test
    void normalizeParsedCurrencyMustBeOnTheWhitelist() {
        String t = "\"is_transaction\":true,\"direction\":\"debit\",\"amount\":5";
        assertThat(n("{" + t + ",\"currency\":\"FTS\"}")).isEqualTo(Normalized.failed("bad_currency"));
        assertThat(n("{" + t + ",\"currency\":\"forint\"}")).isEqualTo(Normalized.failed("bad_currency"));
        for (String c : List.of("huf", "EUR", "usd", "GBP", "chf")) {
            Normalized r = n("{" + t + ",\"currency\":\"" + c + "\"}");
            assertThat(r.status()).isEqualTo("parsed");
            assertThat(r.currency()).isEqualTo(c.toUpperCase());
        }
    }

    // 14
    @Test
    void normalizeParsedAnLlmDateMoreThanSevenDaysFromTheFallbackIsReplaced() {
        String t = "\"is_transaction\":true,\"direction\":\"debit\",\"amount\":5,\"currency\":\"HUF\"";
        assertThat(n("{" + t + ",\"date\":\"2026-11-05\"}").date()).isEqualTo(LocalDate.parse("2026-11-05"));
        assertThat(n("{" + t + ",\"date\":\"2026-11-19\"}").date()).isEqualTo(LocalDate.parse("2026-11-19"));
        assertThat(n("{" + t + ",\"date\":\"2026-11-04\"}").date()).isEqualTo(D12);
        assertThat(n("{" + t + ",\"date\":\"2026-11-20\"}").date()).isEqualTo(D12);
        assertThat(n("{" + t + ",\"date\":\"2025-11-12\"}").date()).isEqualTo(D12);
    }

    // 15
    @Test
    void buildPromptCarriesTheTextTheSenderAndOnlyTheCategoryNames() {
        String p = SmsPrompt.userMessage(S1, "MBH Bank", CATS);
        for (String s : List.of(S1, "MBH Bank", "Groceries", "Transport", "Dining")) {
            assertThat(p).contains(s);
        }
        assertThat(SmsPrompt.SYSTEM_PROMPT).startsWith(SmsPrompt.MARKER).contains("\"is_transaction\"")
            .contains("terhelés").contains("jóváírás");
    }
}
