package io.mrkuhne.mezo.feature.penz.service;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.getRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathMatching;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;

import com.github.tomakehurst.wiremock.WireMockServer;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.mrkuhne.mezo.feature.penz.entity.PenzQuoteEntity;
import io.mrkuhne.mezo.feature.penz.repository.PenzProviderStatusRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzQuoteRepository;
import io.mrkuhne.mezo.feature.penz.service.QuoteClient.QuoteResult;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PenzPopulator;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Boop Pénz L6 (mezo-r36n9.104): the quote cache against a WireMock Yahoo chart endpoint — parsing, the previous
 * close, the cache kept on failure, the refetch throttle, the held-symbol sweep, and the provider-health streak
 * with its gauge. Symbols and prices are invented.
 */
class PenzQuoteServiceIT extends AbstractIntegrationTest {

    static final WireMockServer YAHOO = new WireMockServer(wireMockConfig().dynamicPort());

    @DynamicPropertySource
    static void outbound(DynamicPropertyRegistry registry) {
        YAHOO.start();
        registry.add("mezo.penz.yahoo-base-url", YAHOO::baseUrl);
        registry.add("mezo.penz.allow-loopback-for-tests", () -> "true");
    }

    @AfterAll
    static void stopYahoo() {
        YAHOO.stop();
    }

    @Autowired private PenzQuoteService service;
    @Autowired private PenzProviderHealth health;
    @Autowired private PenzQuoteRepository quotes;
    @Autowired private PenzProviderStatusRepository statuses;
    @Autowired private PenzPopulator penz;
    @Autowired private DatabasePopulator db;
    @Autowired private MeterRegistry meters;

    private LocalDate today;

    @BeforeEach
    void reset() {
        YAHOO.resetAll();
        today = LocalDate.now(ZoneId.of("Europe/Budapest"));
    }

    /** Market time now; closes for two days before (the second null) and today. */
    private static void stubChart(String pathRegex, String currency, String price, String older, String today) {
        long now = Instant.now().getEpochSecond();
        YAHOO.stubFor(get(urlPathMatching(pathRegex)).willReturn(aResponse()
            .withHeader("Content-Type", "application/json").withBody("""
                {"chart":{"result":[{"meta":{"currency":"%s","regularMarketPrice":%s,"regularMarketTime":%d},
                  "timestamp":[%d,%d,%d],"indicators":{"quote":[{"close":[%s,null,%s]}]}}],"error":null}}
                """.formatted(currency, price, now, now - 2 * 86_400, now - 86_400, now, older, today))));
    }

    private double gauge() {
        Gauge g = meters.find(PenzProviderHealth.METRIC).tag("provider", "yahoo").tag("kind", "quotes").gauge();
        return g == null ? -1 : g.value();
    }

    @Test
    void aQuoteIsParsedAndCachedWithThePreviousClose() {
        stubChart("/v8/finance/chart/AAA\\.BD", "HUF", "4321.5", "4100", "4321.5");
        Optional<PenzQuoteEntity> q = service.refresh("AAA.BD", today);
        assertThat(q).hasValueSatisfying(row -> {
            assertThat(row.getPrice()).isEqualByComparingTo("4321.5");
            assertThat(row.getPreviousClose()).isEqualByComparingTo("4100"); // the null close is skipped
            assertThat(row.getCurrency()).isEqualTo("HUF");
            assertThat(row.getAsOf()).isEqualTo(today);
        });
        YAHOO.verify(getRequestedFor(urlPathEqualTo("/v8/finance/chart/AAA.BD"))
            .withQueryParam("range", equalTo("5d")).withQueryParam("interval", equalTo("1d"))
            .withHeader("Accept", equalTo("application/json")).withHeader("User-Agent", equalTo("Mozilla/5.0")));
        assertThat(health.failStreak(PenzQuoteService.PROVIDER_KEY)).isZero();

        // fresh today: no second fetch
        service.refresh("AAA.BD", today);
        assertThat(YAHOO.getAllServeEvents()).hasSize(1);
    }

    @Test
    void aFailureKeepsTheCacheAndGrowsTheStreakAndTheGauge() {
        penz.quote("AAA.BD", "HUF", "4000", "3900", today.minusDays(2));
        quotes.touch("AAA.BD", Instant.now().minus(Duration.ofHours(2)));
        YAHOO.stubFor(get(urlPathMatching("/v8/finance/chart/.*")).willReturn(aResponse().withStatus(500)
            .withBody("internal secret")));

        assertThat(service.refresh("AAA.BD", today)).hasValueSatisfying(row -> {
            assertThat(row.getPrice()).isEqualByComparingTo("4000");
            assertThat(row.getAsOf()).isEqualTo(today.minusDays(2));
        });
        assertThat(health.failStreak("yahoo")).isEqualTo(1);
        assertThat(gauge()).isEqualTo(1.0);
        assertThat(statuses.findByProviderKey("yahoo")).hasValueSatisfying(s -> {
            assertThat(s.getKind()).isEqualTo("quotes");
            assertThat(s.getLastError()).isEqualTo("status 500");
            assertThat(s.getLastFailureAt()).isNotNull();
        });

        // the attempt moved the throttle: an immediate second refresh does not fetch
        service.refresh("AAA.BD", today);
        assertThat(YAHOO.getAllServeEvents()).hasSize(1);
        assertThat(service.check("AAA.BD")).isInstanceOf(QuoteResult.Failed.class);
        assertThat(health.failStreak("yahoo")).isEqualTo(2);
        assertThat(gauge()).isEqualTo(2.0);

        YAHOO.resetAll();
        stubChart("/v8/finance/chart/AAA\\.BD", "HUF", "4400", "4300", "4400");
        assertThat(service.check("AAA.BD")).isInstanceOf(QuoteResult.Found.class);
        assertThat(health.failStreak("yahoo")).isZero();
        assertThat(gauge()).isZero();
        assertThat(quotes.findBySymbol("AAA.BD").orElseThrow().getPrice()).isEqualByComparingTo("4400");
    }

    @Test
    void anUnknownSymbolIsAnAnswerNotAnOutage() {
        YAHOO.stubFor(get(urlPathMatching("/v8/finance/chart/NOPE.*")).willReturn(aResponse().withStatus(404)));
        assertThat(service.check("NOPE.BD")).isInstanceOf(QuoteResult.Unknown.class);
        assertThat(health.failStreak("yahoo")).isZero();
        assertThat(quotes.findBySymbol("NOPE.BD")).isEmpty();
    }

    @Test
    void refreshAllHeldFetchesEverySymbolAndTheFxPairsInUse() {
        UUID a = db.populateUser("penz-quotes-a-" + UUID.randomUUID() + "@test.local");
        UUID b = db.populateUser("penz-quotes-b-" + UUID.randomUUID() + "@test.local");
        penz.holding(a, "Bank", "stock", "AAA.BD", "long", "HUF", null);
        penz.holding(b, "Világ ETF", "etf", "VVV.DE", "long", "EUR", null);
        penz.holding(b, "Állampapír", "bond", null, "short", "HUF", null);
        stubChart("/v8/finance/chart/AAA\\.BD", "HUF", "4321", "4300", "4321");
        stubChart("/v8/finance/chart/VVV\\.DE", "EUR", "110.25", "109", "110.25");
        stubChart("/v8/finance/chart/EURHUF.*", "HUF", "401.2", "400.1", "401.2");

        service.refreshAllHeld(today);

        assertThat(quotes.findBySymbol("AAA.BD")).isPresent();
        assertThat(quotes.findBySymbol("VVV.DE").orElseThrow().getCurrency()).isEqualTo("EUR");
        assertThat(quotes.findBySymbol("EURHUF=X").orElseThrow().getPrice()).isEqualByComparingTo("401.2");
        assertThat(YAHOO.getAllServeEvents()).hasSize(3);
    }

    @Test
    void newsIsAllFailingOnlyWhenEveryFeedFailed() {
        assertThat(health.allFailing(PenzProviderHealth.KIND_NEWS)).isFalse();
        health.recordFailure("feed-a", PenzProviderHealth.KIND_NEWS, "x".repeat(300));
        health.recordSuccess("feed-b", PenzProviderHealth.KIND_NEWS);
        assertThat(health.allFailing(PenzProviderHealth.KIND_NEWS)).isFalse();
        assertThat(statuses.findByProviderKey("feed-a").orElseThrow().getLastError()).hasSize(200);
        health.recordFailure("feed-b", PenzProviderHealth.KIND_NEWS, "status 503");
        assertThat(health.allFailing(PenzProviderHealth.KIND_NEWS)).isTrue();
        assertThat(health.allFailing(PenzProviderHealth.KIND_QUOTES)).isFalse();
    }
}
