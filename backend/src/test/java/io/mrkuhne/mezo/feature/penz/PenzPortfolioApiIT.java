package io.mrkuhne.mezo.feature.penz;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathMatching;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;

import com.github.tomakehurst.wiremock.WireMockServer;
import io.mrkuhne.mezo.api.dto.PenzHoldingEventRequest;
import io.mrkuhne.mezo.api.dto.PenzHoldingEventResponse;
import io.mrkuhne.mezo.api.dto.PenzHoldingRequest;
import io.mrkuhne.mezo.api.dto.PenzHoldingResponse;
import io.mrkuhne.mezo.api.dto.PenzInvestTxnRequest;
import io.mrkuhne.mezo.api.dto.PenzInvestTxnResponse;
import io.mrkuhne.mezo.api.dto.PenzPortfolioResponse;
import io.mrkuhne.mezo.api.dto.PenzPosition;
import io.mrkuhne.mezo.api.dto.PenzSleeve;
import io.mrkuhne.mezo.feature.penz.entity.PenzAccountEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzCategoryEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzHoldingEntity;
import io.mrkuhne.mezo.feature.penz.repository.PenzInvestTxnRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzQuoteRepository;
import io.mrkuhne.mezo.feature.penz.service.PenzProviderHealth;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PenzPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Boop Pénz L6 (mezo-r36n9.104): /api/penz holdings, investment transactions, holding events and the portfolio
 * over HTTP — CRUD, ownership 404s, clientRef replays, FIFO realized P/L and its guards, the symbol check, the FX
 * booking of a non-HUF buy, and Pénzem's figures from seeded quotes. One WireMock answers for both frankfurter.dev
 * and the Yahoo chart endpoint (never called live); the test-only loopback switch is set here only. Every figure
 * and symbol is invented.
 */
class PenzPortfolioApiIT extends ApiIntegrationTest {

    static final WireMockServer MOCK = new WireMockServer(wireMockConfig().dynamicPort());

    @DynamicPropertySource
    static void outbound(DynamicPropertyRegistry registry) {
        MOCK.start();
        registry.add("mezo.penz.frankfurter-base-url", MOCK::baseUrl);
        registry.add("mezo.penz.yahoo-base-url", MOCK::baseUrl);
        registry.add("mezo.penz.allow-loopback-for-tests", () -> "true");
    }

    @AfterAll
    static void stopMock() {
        MOCK.stop();
    }

    private static final ZoneId BUDAPEST = ZoneId.of("Europe/Budapest");

    @Autowired private PenzPopulator penz;
    @Autowired private PenzQuoteRepository quoteRows;
    @Autowired private PenzInvestTxnRepository txnRows;
    @Autowired private PenzProviderHealth health;

    private LocalDate today;

    @BeforeEach
    void resetStubs() {
        MOCK.resetAll();
        // anything not stubbed by a test: the quote source is down (a holding is then accepted unpriced)
        MOCK.stubFor(get(urlPathMatching("/v8/finance/chart/.*")).atPriority(10)
            .willReturn(aResponse().withStatus(500)));
        today = LocalDate.now(BUDAPEST);
    }

    private static void stubChart(String symbol, String currency, String price, String previousClose) {
        long marketTime = Instant.now().getEpochSecond();
        long dayBefore = marketTime - 86_400;
        MOCK.stubFor(get(urlPathEqualTo("/v8/finance/chart/" + symbol)).atPriority(1)
            .withQueryParam("range", equalTo("5d")).withQueryParam("interval", equalTo("1d"))
            .willReturn(aResponse().withHeader("Content-Type", "application/json").withBody("""
                {"chart":{"result":[{"meta":{"currency":"%s","symbol":"%s","regularMarketPrice":%s,
                  "regularMarketTime":%d},"timestamp":[%d,%d],
                  "indicators":{"quote":[{"close":[%s,%s]}]}}],"error":null}}
                """.formatted(currency, symbol, price, marketTime, dayBefore, marketTime, previousClose, price))));
    }

    private static void stubUnknown(String symbol) {
        MOCK.stubFor(get(urlPathEqualTo("/v8/finance/chart/" + symbol)).atPriority(1)
            .willReturn(aResponse().withStatus(404).withHeader("Content-Type", "application/json")
                .withBody("{\"chart\":{\"result\":null,\"error\":{\"code\":\"Not Found\"}}}")));
    }

    private static void stubRate(String currency, LocalDate date, String rate) {
        MOCK.stubFor(get(urlPathEqualTo("/" + date)).withQueryParam("from", equalTo(currency))
            .withQueryParam("to", equalTo("HUF"))
            .willReturn(aResponse().withHeader("Content-Type", "application/json")
                .withBody("{\"amount\":1.0,\"base\":\"" + currency + "\",\"date\":\"" + date
                    + "\",\"rates\":{\"HUF\":" + rate + "}}")));
    }

    private static PenzHoldingRequest holding(String name, String assetType, String symbol, String sleeve,
                                              String currency) {
        return new PenzHoldingRequest().name(name).assetType(assetType).symbol(symbol).platform("mbh")
            .sleeve(sleeve).currency(currency);
    }

    private PenzHoldingResponse create(HttpHeaders h, PenzHoldingRequest req) {
        return postForBody("/api/penz/holdings", req, h, HttpStatus.CREATED, PenzHoldingResponse.class);
    }

    private PenzInvestTxnResponse txn(HttpHeaders h, UUID holdingId, String side, String qty, long amountMinor,
                                      LocalDate date) {
        return postForBody("/api/penz/invest-transactions", new PenzInvestTxnRequest().holdingId(holdingId)
            .side(side).quantity(qty == null ? null : new BigDecimal(qty)).amountMinor(amountMinor).date(date),
            h, HttpStatus.CREATED, PenzInvestTxnResponse.class);
    }

    // ---- holdings ----

    @Test
    void holdingsCrudReplayAndStayPrivate() {
        RegisteredUser a = registerUser("penz holdings a");
        RegisteredUser b = registerUser("penz holdings b");
        UUID ref = UUID.randomUUID();
        PenzHoldingRequest bond = holding("  Prémium Állampapír  ", "bond", null, "short", "HUF")
            .bondRatePct(new BigDecimal("6.5")).newsTerms(List.of("PMÁP", " állampapír ", "PMÁP"))
            .platformName("  ").clientRef(ref);
        PenzHoldingResponse first = create(a.headers(), bond);
        assertThat(first.getName()).isEqualTo("Prémium Állampapír");
        assertThat(first.getSleeve()).isEqualTo(PenzHoldingResponse.SleeveEnum.SHORT);
        assertThat(first.getNewsTerms()).containsExactly("PMÁP", "állampapír");
        assertThat(first.getPlatformName()).isNull();
        assertThat(first.getBondRatePct()).isEqualByComparingTo("6.5");
        assertThat(first.getPosition()).isZero();
        assertThat(first.getArchived()).isFalse();
        assertThat(create(a.headers(), bond.name("Más név")).getId()).isEqualTo(first.getId());

        PenzHoldingResponse etf = create(a.headers(), holding("Világ ETF", "etf", null, "long", "EUR"));
        PenzHoldingResponse fund = create(a.headers(), holding("Alap", "fund", null, "mid", "HUF"));
        assertThat(etf.getPosition()).isEqualTo(1);
        assertThat(getForList("/api/penz/holdings", a.headers(), HttpStatus.OK, PenzHoldingResponse.class))
            .extracting(PenzHoldingResponse::getId).containsExactly(first.getId(), fund.getId(), etf.getId());

        PenzHoldingResponse moved = putForBody("/api/penz/holdings/" + fund.getId(),
            holding("Alap 2", "fund", null, "long", "HUF").position(0).archived(true), a.headers(), HttpStatus.OK,
            PenzHoldingResponse.class);
        assertThat(moved.getName()).isEqualTo("Alap 2");
        assertThat(moved.getSleeve()).isEqualTo(PenzHoldingResponse.SleeveEnum.LONG);
        assertThat(moved.getArchived()).isTrue();

        // B sees nothing and touches nothing of A's
        assertThat(getForList("/api/penz/holdings", b.headers(), HttpStatus.OK, PenzHoldingResponse.class)).isEmpty();
        assertHasRequestError(putForBody("/api/penz/holdings/" + first.getId(),
            holding("Lopott", "bond", null, "short", "HUF"), b.headers(), HttpStatus.NOT_FOUND, String.class),
            "PENZ_HOLDING_NOT_FOUND");
        deleteAndExpect("/api/penz/holdings/" + first.getId(), b.headers(), HttpStatus.NOT_FOUND);
        getForBody("/api/penz/holdings/" + first.getId() + "/transactions", b.headers(), HttpStatus.NOT_FOUND,
            String.class);
        postForBody("/api/penz/invest-transactions", new PenzInvestTxnRequest().holdingId(first.getId())
            .side("buy").amountMinor(100L).date(today), b.headers(), HttpStatus.NOT_FOUND, String.class);

        // delete takes the transactions and events with it
        txn(a.headers(), first.getId(), "buy", null, 1_000_000_00L, today.minusDays(3));
        postForBody("/api/penz/holding-events", new PenzHoldingEventRequest().holdingId(first.getId())
            .kind("coupon").date(today.plusDays(10)), a.headers(), HttpStatus.CREATED, PenzHoldingEventResponse.class);
        deleteAndExpect("/api/penz/holdings/" + first.getId(), a.headers(), HttpStatus.NO_CONTENT);
        assertThat(getForList("/api/penz/holdings", a.headers(), HttpStatus.OK, PenzHoldingResponse.class))
            .extracting(PenzHoldingResponse::getId).containsExactly(moved.getId(), etf.getId());
        assertThat(txnRows.findByCreatedByAndHoldingIdAndDeletedFalseOrderByCreatedAtAsc(a.id(), first.getId()))
            .isEmpty();
        assertThat(getForList("/api/penz/holding-events", a.headers(), HttpStatus.OK,
            PenzHoldingEventResponse.class)).isEmpty();
        deleteAndExpect("/api/penz/holdings/" + first.getId(), a.headers(), HttpStatus.NOT_FOUND);
    }

    @Test
    void theSymbolIsCheckedOnce() {
        RegisteredUser u = registerUser("penz symbols");
        stubUnknown("NOPE.BD");
        String err = postForBody("/api/penz/holdings", holding("Nincs ilyen", "stock", "nope.bd", "long", "HUF"),
            u.headers(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(err, "PENZ_SYMBOL_UNKNOWN");

        stubChart("AAA.BD", "HUF", "4321.5", "4300");
        PenzHoldingResponse known = create(u.headers(), holding("Bank részvény", "stock", "aaa.bd", "long", "HUF"));
        assertThat(known.getSymbol()).isEqualTo("AAA.BD");
        assertThat(quoteRows.findBySymbol("AAA.BD")).hasValueSatisfying(q -> {
            assertThat(q.getPrice()).isEqualByComparingTo("4321.5");
            assertThat(q.getPreviousClose()).isEqualByComparingTo("4300");
            assertThat(q.getCurrency()).isEqualTo("HUF");
        });

        // the source is down (default stub 500): accepted unpriced
        PenzHoldingResponse unpriced = create(u.headers(), holding("Olaj", "stock", "BBB.BD", "mid", "HUF"));
        assertThat(unpriced.getSymbol()).isEqualTo("BBB.BD");
        assertThat(health.failStreak("yahoo")).isEqualTo(1);

        // an update re-checks only a changed symbol
        putForBody("/api/penz/holdings/" + known.getId(), holding("Bank", "stock", "AAA.BD", "long", "HUF"),
            u.headers(), HttpStatus.OK, PenzHoldingResponse.class);
        assertHasRequestError(putForBody("/api/penz/holdings/" + known.getId(),
            holding("Bank", "stock", "NOPE.BD", "long", "HUF"), u.headers(), HttpStatus.BAD_REQUEST, String.class),
            "PENZ_SYMBOL_UNKNOWN");
        // a bad symbol shape is refused by the contract
        postForBody("/api/penz/holdings", holding("X", "stock", "AAA BD/../", "long", "HUF"), u.headers(),
            HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void theCurrencyIsFixedOnceATransactionExists() {
        RegisteredUser u = registerUser("penz currency");
        PenzHoldingResponse h = create(u.headers(), holding("Alap", "fund", null, "mid", "HUF"));
        putForBody("/api/penz/holdings/" + h.getId(), holding("Alap", "fund", null, "mid", "EUR"), u.headers(),
            HttpStatus.OK, PenzHoldingResponse.class);
        putForBody("/api/penz/holdings/" + h.getId(), holding("Alap", "fund", null, "mid", "HUF"), u.headers(),
            HttpStatus.OK, PenzHoldingResponse.class);
        txn(u.headers(), h.getId(), "buy", "2", 20_000_00L, today);
        assertHasRequestError(putForBody("/api/penz/holdings/" + h.getId(),
            holding("Alap", "fund", null, "mid", "EUR"), u.headers(), HttpStatus.BAD_REQUEST, String.class),
            "PENZ_CURRENCY_MISMATCH");
    }

    // ---- transactions ----

    @Test
    void fifoRealizesProfitAndGuardsThePosition() {
        RegisteredUser u = registerUser("penz fifo");
        PenzHoldingResponse h = create(u.headers(), holding("Részvény", "stock", null, "long", "HUF"));
        LocalDate d1 = today.minusDays(30);
        PenzInvestTxnResponse b1 = txn(u.headers(), h.getId(), "buy", "10", 100_000_00L, d1);
        PenzInvestTxnResponse b2 = txn(u.headers(), h.getId(), "buy", "10", 120_000_00L, d1.plusDays(1));
        assertThat(b1.getRealizedHufMinor()).isNull();
        assertThat(b1.getAmount().getHufMinor()).isEqualTo(100_000_00L);
        assertThat(b1.getFxRateDate()).isNull();

        UUID ref = UUID.randomUUID();
        PenzInvestTxnRequest sell = new PenzInvestTxnRequest().holdingId(h.getId()).side("sell")
            .quantity(new BigDecimal("15")).amountMinor(195_000_00L).date(d1.plusDays(2)).clientRef(ref);
        PenzInvestTxnResponse s = postForBody("/api/penz/invest-transactions", sell, u.headers(), HttpStatus.CREATED,
            PenzInvestTxnResponse.class);
        // FIFO: 100 000 (lot 1) + 60 000 (half of lot 2) consumed against 195 000
        assertThat(s.getRealizedHufMinor()).isEqualTo(35_000_00L);
        assertThat(s.getQuantity()).isEqualByComparingTo("15");
        assertThat(postForBody("/api/penz/invest-transactions", sell, u.headers(), HttpStatus.CREATED,
            PenzInvestTxnResponse.class).getId()).isEqualTo(s.getId());

        // 5 left: a sell of 6 is refused
        assertHasRequestError(postForBody("/api/penz/invest-transactions", new PenzInvestTxnRequest()
            .holdingId(h.getId()).side("sell").quantity(new BigDecimal("6")).amountMinor(80_000_00L)
            .date(today), u.headers(), HttpStatus.BAD_REQUEST, String.class), "PENZ_SELL_EXCEEDS_POSITION");
        // deleting a buy under the sell would leave the sell above the position
        assertHasRequestError(exchangeForBody(HttpMethod.DELETE,
            "/api/penz/invest-transactions/" + b1.getId(), null, u.headers(), HttpStatus.BAD_REQUEST, String.class),
            "PENZ_SELL_EXCEEDS_POSITION");

        List<PenzInvestTxnResponse> list = getForList("/api/penz/holdings/" + h.getId() + "/transactions",
            u.headers(), HttpStatus.OK, PenzInvestTxnResponse.class);
        assertThat(list).extracting(PenzInvestTxnResponse::getId).containsExactly(s.getId(), b2.getId(), b1.getId());
        assertThat(list.getFirst().getRealizedHufMinor()).isEqualTo(35_000_00L);

        deleteAndExpect("/api/penz/invest-transactions/" + s.getId(), u.headers(), HttpStatus.NO_CONTENT);
        deleteAndExpect("/api/penz/invest-transactions/" + b1.getId(), u.headers(), HttpStatus.NO_CONTENT);
        deleteAndExpect("/api/penz/invest-transactions/" + b1.getId(), u.headers(), HttpStatus.NOT_FOUND);
        RegisteredUser other = registerUser("penz fifo other");
        deleteAndExpect("/api/penz/invest-transactions/" + b2.getId(), other.headers(), HttpStatus.NOT_FOUND);
    }

    @Test
    void aForeignBuyIsBookedAtTheDatesEcbRate() {
        RegisteredUser u = registerUser("penz eur buy");
        PenzHoldingResponse h = create(u.headers(), holding("Világ ETF", "etf", null, "long", "EUR"));
        LocalDate day = LocalDate.of(2026, 10, 14);
        stubRate("EUR", day, "400.5");
        PenzInvestTxnResponse t = txn(u.headers(), h.getId(), "buy", "3", 1_000_00L, day);
        assertThat(t.getAmount().getCurrency()).isEqualTo("EUR");
        assertThat(t.getAmount().getMinor()).isEqualTo(1_000_00L);
        assertThat(t.getAmount().getHufMinor()).isEqualTo(400_500_00L);
        assertThat(t.getFxRateDate()).isEqualTo(day);
    }

    // ---- events ----

    @Test
    void eventsAreListedSoonestFirstValuedAndReplayed() {
        RegisteredUser u = registerUser("penz events");
        RegisteredUser b = registerUser("penz events b");
        PenzHoldingResponse etf = create(u.headers(), holding("Világ ETF", "etf", null, "long", "EUR"));
        penz.quote("EURHUF=X", "HUF", "410", "400", today);
        UUID ref = UUID.randomUUID();
        PenzHoldingEventRequest dividend = new PenzHoldingEventRequest().holdingId(etf.getId()).kind("dividend")
            .date(today.plusDays(20)).amountMinor(10_00L).note("Osztalék").clientRef(ref);
        PenzHoldingEventResponse e = postForBody("/api/penz/holding-events", dividend, u.headers(),
            HttpStatus.CREATED, PenzHoldingEventResponse.class);
        assertThat(e.getCurrency()).isEqualTo("EUR");
        assertThat(e.getAmountHufMinor()).isEqualTo(4_100_00L);
        assertThat(e.getHoldingName()).isEqualTo("Világ ETF");
        assertThat(e.getSleeve()).isEqualTo(PenzHoldingEventResponse.SleeveEnum.LONG);
        assertThat(postForBody("/api/penz/holding-events", dividend, u.headers(), HttpStatus.CREATED,
            PenzHoldingEventResponse.class).getId()).isEqualTo(e.getId());
        PenzHoldingEventResponse earlier = postForBody("/api/penz/holding-events", new PenzHoldingEventRequest()
            .holdingId(etf.getId()).kind("earnings").date(today.plusDays(5)), u.headers(), HttpStatus.CREATED,
            PenzHoldingEventResponse.class);
        postForBody("/api/penz/holding-events", new PenzHoldingEventRequest().holdingId(etf.getId()).kind("other")
            .date(today.minusDays(5)), u.headers(), HttpStatus.CREATED, PenzHoldingEventResponse.class);

        assertThat(getForList("/api/penz/holding-events", u.headers(), HttpStatus.OK, PenzHoldingEventResponse.class))
            .extracting(PenzHoldingEventResponse::getId).containsExactly(earlier.getId(), e.getId());
        assertThat(getForList("/api/penz/holding-events?from=" + today.minusDays(10), u.headers(), HttpStatus.OK,
            PenzHoldingEventResponse.class)).hasSize(3);
        assertThat(getForList("/api/penz/holding-events", b.headers(), HttpStatus.OK, PenzHoldingEventResponse.class))
            .isEmpty();
        deleteAndExpect("/api/penz/holding-events/" + e.getId(), b.headers(), HttpStatus.NOT_FOUND);
        deleteAndExpect("/api/penz/holding-events/" + e.getId(), u.headers(), HttpStatus.NO_CONTENT);
        deleteAndExpect("/api/penz/holding-events/" + e.getId(), u.headers(), HttpStatus.NOT_FOUND);
        postForBody("/api/penz/holding-events", new PenzHoldingEventRequest().holdingId(etf.getId()).kind("split")
            .date(today), u.headers(), HttpStatus.BAD_REQUEST, String.class);
    }

    // ---- the portfolio ----

    @Test
    void thePortfolioValuesSleevesFromQuotesAccrualAndCost() {
        RegisteredUser u = registerUser("penz portfolio");
        UUID o = u.id();
        PenzHoldingEntity bond = penz.holding(o, "Állampapír", "bond", null, "short", "HUF", new BigDecimal("6.5"));
        penz.investTxn(o, bond.getId(), "buy", null, 1_000_000_00L, "HUF", 1_000_000_00L, today.minusDays(100));
        PenzHoldingEntity fund = penz.holding(o, "Vegyes alap", "fund", null, "mid", "HUF", null);
        penz.investTxn(o, fund.getId(), "buy", new BigDecimal("50"), 250_000_00L, "HUF", 250_000_00L,
            today.minusDays(40));
        PenzHoldingEntity etf = penz.holding(o, "Világ ETF", "etf", "VVV.DE", "long", "EUR", null);
        penz.investTxn(o, etf.getId(), "buy", new BigDecimal("4"), 400_00L, "EUR", 160_000_00L, today.minusDays(60));
        PenzHoldingEntity stock = penz.holding(o, "Bank részvény", "stock", "AAA.BD", "long", "HUF", null);
        penz.investTxn(o, stock.getId(), "buy", new BigDecimal("10"), 200_000_00L, "HUF", 200_000_00L,
            today.minusDays(20));
        PenzHoldingEntity archived = penz.holding(o, "Régi", "stock", null, "long", "HUF", null);
        penz.investTxn(o, archived.getId(), "buy", new BigDecimal("1"), 999_00L, "HUF", 999_00L, today);
        penz.quote("VVV.DE", "EUR", "110", "100", today);
        penz.quote("EURHUF=X", "HUF", "410", "400", today);
        penz.quote("AAA.BD", "HUF", "21000", "20000", today);
        // 300 000 Ft of fixed costs this month (a monthly expense rule from the 1st)
        PenzAccountEntity acc = penz.account(o, "Fő", true);
        PenzCategoryEntity rent = penz.category(o, "Lakbér", "expense");
        penz.recurringRule(o, acc.getId(), rent.getId(), "expense", 300_000_00L, "HUF", 300_000_00L, "monthly",
            today.withDayOfMonth(1), true);
        penz.holdingEvent(o, bond.getId(), "coupon", today.plusDays(30), 50_000_00L, "HUF");
        penz.holdingEvent(o, etf.getId(), "dividend", today.plusDays(60), 10_00L, "EUR");
        penz.holdingEvent(o, etf.getId(), "earnings", today.plusMonths(13), null, null);
        penz.holdingEvent(o, stock.getId(), "other", today.minusDays(1), null, null);
        // make the archive flag stick (the populator saved before it was set)
        putForBody("/api/penz/holdings/" + archived.getId(), holding("Régi", "stock", null, "long", "HUF")
            .archived(true), u.headers(), HttpStatus.OK, PenzHoldingResponse.class);

        PenzPortfolioResponse p = getForBody("/api/penz/portfolio?date=" + today, u.headers(), HttpStatus.OK,
            PenzPortfolioResponse.class);

        long bondValue = 101_780_822L;          // 100 000 000 × (1 + 0.065 × 100 / 365)
        long etfValue = 18_040_000L;            // 4 × 110 × 410 Ft
        long stockValue = 21_000_000L;          // 10 × 21 000 Ft
        assertThat(p.getDate()).isEqualTo(today);
        assertThat(p.getTotalHufMinor()).isEqualTo(bondValue + 25_000_000L + etfValue + stockValue);
        assertThat(p.getCostHufMinor()).isEqualTo(100_000_000L + 25_000_000L + 16_000_000L + 20_000_000L);
        assertThat(p.getPriceMoveHufMinor()).isEqualTo(1_600_000L + 1_000_000L);  // 4 × 10 × 400 + 10 × 1 000
        assertThat(p.getFxMoveHufMinor()).isEqualTo(440_000L);                    // 4 × 110 × 10
        assertThat(p.getPriceMovePct()).isEqualByComparingTo("7.2");             // 26 000 / 360 000
        assertThat(p.getFxMovePct()).isEqualByComparingTo("1.2");
        assertThat(p.getPricesAsOf()).isEqualTo(today);
        assertThat(p.getStale()).isFalse();
        assertThat(p.getUnpricedCount()).isEqualTo(1);
        assertThat(p.getFixedCostsMonthlyHufMinor()).isEqualTo(30_000_000L);
        assertThat(p.getPractice().getMonthlyHufMinor()).isEqualTo(2_000_000L);
        assertThat(p.getPractice().getMonthPnlHufMinor()).isNull();

        assertThat(p.getSleeves()).extracting(PenzSleeve::getSleeve).containsExactly(PenzSleeve.SleeveEnum.SHORT,
            PenzSleeve.SleeveEnum.MID, PenzSleeve.SleeveEnum.LONG);
        PenzSleeve shortS = p.getSleeves().get(0);
        PenzSleeve longS = p.getSleeves().get(2);
        assertThat(shortS.getHoldings()).singleElement().satisfies(pos -> {
            assertThat(pos.getValuation()).isEqualTo(PenzPosition.ValuationEnum.ACCRUAL);
            assertThat(pos.getPriced()).isTrue();
            assertThat(pos.getValueHufMinor()).isEqualTo(bondValue);
            assertThat(pos.getSharePct()).isEqualByComparingTo("100.0");
        });
        assertThat(shortS.getCoverageMonths()).isNull();
        assertThat(p.getSleeves().get(1).getHoldings()).singleElement().satisfies(pos -> {
            assertThat(pos.getValuation()).isEqualTo(PenzPosition.ValuationEnum.COST);
            assertThat(pos.getPriced()).isFalse();
            assertThat(pos.getQuantity()).isEqualByComparingTo("50");
        });
        assertThat(longS.getValueHufMinor()).isEqualTo(etfValue + stockValue);
        assertThat(longS.getCoverageMonths()).isEqualTo(1);                       // 390 400 / 300 000
        assertThat(longS.getPriceMoveHufMinor()).isEqualTo(2_600_000L);
        assertThat(longS.getHoldings()).extracting(PenzPosition::getName)
            .containsExactly("Világ ETF", "Bank részvény");
        PenzPosition etfPos = longS.getHoldings().getFirst();
        assertThat(etfPos.getValueHufMinor()).isEqualTo(etfValue);
        assertThat(etfPos.getPriceMoveHufMinor()).isEqualTo(1_600_000L);
        assertThat(etfPos.getFxMoveHufMinor()).isEqualTo(440_000L);
        assertThat(etfPos.getChangePct()).isEqualByComparingTo("10.00");
        assertThat(etfPos.getSharePct()).isEqualByComparingTo("46.2");
        assertThat(etfPos.getCostHufMinor()).isEqualTo(16_000_000L);
        assertThat(etfPos.getPriceAsOf()).isEqualTo(today);
        assertThat(etfPos.getSymbol()).isEqualTo("VVV.DE");
        assertThat(shortS.getSharePct().add(p.getSleeves().get(1).getSharePct()).add(longS.getSharePct()))
            .isBetween(new BigDecimal("99.9"), new BigDecimal("100.1"));

        assertThat(p.getEvents()).extracting(PenzHoldingEventResponse::getKind).containsExactly(
            PenzHoldingEventResponse.KindEnum.COUPON, PenzHoldingEventResponse.KindEnum.DIVIDEND);
        assertThat(p.getEvents().get(1).getAmountHufMinor()).isEqualTo(4_100_00L);
        // nothing was fetched: every quote was fresh
        assertThat(MOCK.getAllServeEvents()).isEmpty();
    }

    @Test
    void anEmptyPortfolioHasThreeEmptySleeves() {
        RegisteredUser u = registerUser("penz portfolio empty");
        PenzPortfolioResponse p = getForBody("/api/penz/portfolio", u.headers(), HttpStatus.OK,
            PenzPortfolioResponse.class);
        assertThat(p.getSleeves()).hasSize(3).allSatisfy(s -> {
            assertThat(s.getValueHufMinor()).isZero();
            assertThat(s.getHoldings()).isEmpty();
        });
        assertThat(p.getTotalHufMinor()).isZero();
        assertThat(p.getFixedCostsMonthlyHufMinor()).isZero();
        assertThat(p.getSleeves().get(2).getCoverageMonths()).isNull();
        assertThat(p.getStale()).isFalse();
        assertThat(p.getPricesAsOf()).isNull();
    }

    @Test
    void oldPricesOrAFailingSourceMakeThePortfolioStale() {
        RegisteredUser u = registerUser("penz stale");
        PenzHoldingEntity stock = penz.holding(u.id(), "Bank részvény", "stock", "AAA.BD", "long", "HUF", null);
        penz.investTxn(u.id(), stock.getId(), "buy", new BigDecimal("2"), 40_000_00L, "HUF", 40_000_00L,
            today.minusDays(30));
        // fetched just now (throttled): the read does not refetch the five-day-old quote
        penz.quote("AAA.BD", "HUF", "21000", "20000", today.minusDays(5));
        PenzPortfolioResponse old = getForBody("/api/penz/portfolio?date=" + today, u.headers(), HttpStatus.OK,
            PenzPortfolioResponse.class);
        assertThat(old.getPricesAsOf()).isEqualTo(today.minusDays(5));
        assertThat(old.getStale()).isTrue();
        assertThat(MOCK.getAllServeEvents()).isEmpty();

        penz.quote("BBB.BD", "HUF", "100", "100", today);
        PenzHoldingEntity fresh = penz.holding(u.id(), "Olaj", "stock", "BBB.BD", "mid", "HUF", null);
        penz.investTxn(u.id(), fresh.getId(), "buy", new BigDecimal("1"), 100_00L, "HUF", 100_00L, today);
        deleteAndExpect("/api/penz/holdings/" + stock.getId(), u.headers(), HttpStatus.NO_CONTENT);
        assertThat(getForBody("/api/penz/portfolio?date=" + today, u.headers(), HttpStatus.OK,
            PenzPortfolioResponse.class).getStale()).isFalse();
        health.recordFailure("yahoo", PenzProviderHealth.KIND_QUOTES, "status 503");
        assertThat(getForBody("/api/penz/portfolio?date=" + today, u.headers(), HttpStatus.OK,
            PenzPortfolioResponse.class).getStale()).isTrue();
    }
}
