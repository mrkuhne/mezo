package io.mrkuhne.mezo.feature.penz.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.penz.service.QuoteClient.QuoteResult;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/** Parsing the Yahoo chart answer (build notes §2). Prices are invented. */
class PenzQuoteParseTest {

    private static final ObjectMapper JSON = JsonMapper.builder().build();

    /** 2026-11-20 15:30 UTC = 16:30 in Budapest. */
    private static final long MARKET_TIME = Instant.parse("2026-11-20T15:30:00Z").getEpochSecond();

    private static long day(int d) {
        return Instant.parse("2026-11-%02dT08:00:00Z".formatted(d)).getEpochSecond();
    }

    static String chart(String price, String currency, String closes) {
        return """
            {"chart":{"result":[{"meta":{"currency":"%s","symbol":"AAA.BD","regularMarketPrice":%s,
              "regularMarketTime":%d},
              "timestamp":[%d,%d,%d,%d,%d],
              "indicators":{"quote":[{"close":[%s]}]}}],"error":null}}
            """.formatted(currency, price, MARKET_TIME, day(16), day(17), day(18), day(19), day(20), closes);
    }

    @Test
    void readsThePriceCurrencyDateAndThePreviousClose() {
        QuoteResult r = QuoteClient.parse("AAA.BD", chart("10450.5", "HUF", "100,null,102,103,104"), JSON);
        assertThat(r).isInstanceOfSatisfying(QuoteResult.Found.class, f -> {
            assertThat(f.quote().price()).isEqualByComparingTo("10450.5");
            assertThat(f.quote().currency()).isEqualTo("HUF");
            assertThat(f.quote().asOf()).isEqualTo(LocalDate.of(2026, 11, 20));
            assertThat(f.quote().marketTime()).isEqualTo(Instant.ofEpochSecond(MARKET_TIME));
            assertThat(f.quote().previousClose()).isEqualByComparingTo("103");
        });
    }

    @Test
    void aNullCloseTheDayBeforeFallsBackToTheLastRealOne() {
        QuoteResult r = QuoteClient.parse("AAA.BD", chart("10", "EUR", "100,101,102,null,104"), JSON);
        assertThat(((QuoteResult.Found) r).quote().previousClose()).isEqualByComparingTo("102");
    }

    @Test
    void noEarlierCloseMeansNoPreviousClose() {
        QuoteResult r = QuoteClient.parse("AAA.BD", chart("10", "EUR", "null,null,null,null,104"), JSON);
        assertThat(((QuoteResult.Found) r).quote().previousClose()).isNull();
    }

    @Test
    void aMissingOrZeroPriceIsNoQuote() {
        assertThat(QuoteClient.parse("AAA.BD", chart("0", "HUF", "1,1,1,1,1"), JSON))
            .isInstanceOf(QuoteResult.Missing.class);
        assertThat(QuoteClient.parse("AAA.BD", chart("null", "HUF", "1,1,1,1,1"), JSON))
            .isInstanceOf(QuoteResult.Missing.class);
    }

    @Test
    void aChartErrorIsAnUnknownSymbol() {
        assertThat(QuoteClient.parse("NOPE", """
            {"chart":{"result":null,"error":{"code":"Not Found","description":"No data found"}}}
            """, JSON)).isInstanceOf(QuoteResult.Unknown.class);
    }

    @Test
    void garbageIsAFailure() {
        assertThat(QuoteClient.parse("AAA.BD", "<html>", JSON)).isInstanceOf(QuoteResult.Failed.class);
    }
}
