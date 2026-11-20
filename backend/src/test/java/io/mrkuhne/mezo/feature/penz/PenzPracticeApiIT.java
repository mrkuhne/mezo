package io.mrkuhne.mezo.feature.penz;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;

import com.github.tomakehurst.wiremock.WireMockServer;
import io.mrkuhne.mezo.api.dto.PenzAllowanceLine;
import io.mrkuhne.mezo.api.dto.PenzAllowanceResponse;
import io.mrkuhne.mezo.api.dto.PenzPaperTrade;
import io.mrkuhne.mezo.api.dto.PenzPaperTradeCloseRequest;
import io.mrkuhne.mezo.api.dto.PenzPaperTradeLastCloseRequest;
import io.mrkuhne.mezo.api.dto.PenzPaperTradeOpenRequest;
import io.mrkuhne.mezo.api.dto.PenzPaperTradeRequest;
import io.mrkuhne.mezo.api.dto.PenzPortfolioResponse;
import io.mrkuhne.mezo.api.dto.PenzPracticeOverview;
import io.mrkuhne.mezo.api.dto.PenzPracticeTag;
import io.mrkuhne.mezo.api.dto.PenzSettingsRequest;
import io.mrkuhne.mezo.feature.penz.repository.PenzPaperTradeRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PenzPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Boop Pénz L7 (mezo-r36n9.105): /api/penz/practice over HTTP — plan → open → last close → close → the overview and
 * the week; no plan, no trade (every wrong transition 409); a close needs ≥ 1 known tag; the stop side; the cap
 * (422, not borrowing from holdings / savings / the allowance, gains never raise it, the settings' practice amount
 * is the allowance's Gyakorlás line); idempotent create on clientRef; owner isolation; paper = true everywhere; the
 * FX booking of a EUR trade (frankfurter.dev is WireMock). Every figure is invented.
 */
class PenzPracticeApiIT extends ApiIntegrationTest {

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
    private static final String TRADES = "/api/penz/practice/trades";

    @Autowired private PenzPopulator penz;
    @Autowired private PenzPaperTradeRepository rows;

    private LocalDate today;

    @BeforeEach
    void setUp() {
        MOCK.resetAll();
        today = LocalDate.now(BUDAPEST);
    }

    private static void stubRate(String currency, LocalDate date, String rate) {
        MOCK.stubFor(get(urlPathEqualTo("/" + date)).withQueryParam("from", equalTo(currency))
            .withQueryParam("to", equalTo("HUF"))
            .willReturn(aResponse().withHeader("Content-Type", "application/json")
                .withBody("{\"amount\":1.0,\"base\":\"" + currency + "\",\"date\":\"" + date
                    + "\",\"rates\":{\"HUF\":" + rate + "}}")));
    }

    /** A long HUF plan: {@code qty} units, planned entry and stop per unit in minor units. */
    private static PenzPaperTradeRequest plan(String instrument, long qty, Long plannedEntry, long stop) {
        return new PenzPaperTradeRequest().instrument(instrument).direction("long").why("Kitörés a napi csúcs fölött")
            .currency("HUF").quantity(BigDecimal.valueOf(qty)).plannedEntryMinor(plannedEntry).stopMinor(stop);
    }

    private PenzPaperTrade create(HttpHeaders h, PenzPaperTradeRequest req) {
        return postForBody(TRADES, req, h, HttpStatus.CREATED, PenzPaperTrade.class);
    }

    private PenzPaperTrade open(HttpHeaders h, UUID id, long entry) {
        return postForBody(TRADES + "/" + id + "/open", new PenzPaperTradeOpenRequest().entryMinor(entry)
            .entryDate(today), h, HttpStatus.OK, PenzPaperTrade.class);
    }

    private PenzPaperTradeCloseRequest closing(long exit, List<String> tags) {
        return new PenzPaperTradeCloseRequest().exitMinor(exit).exitDate(today).tags(tags);
    }

    private PenzPracticeOverview overview(HttpHeaders h) {
        return getForBody("/api/penz/practice?date=" + today, h, HttpStatus.OK, PenzPracticeOverview.class);
    }

    @Test
    void testPracticeLoop_shouldPlanOpenCloseAndReview_whenTheHappyPath() {
        RegisteredUser u = registerUser("penz practice loop");

        PenzPracticeOverview empty = overview(u.headers());
        assertThat(empty.getPaper()).isTrue();
        assertThat(empty.getMonth()).isEqualTo(today.toString().substring(0, 7));
        assertThat(empty.getCap().getCapHufMinor()).isEqualTo(2_000_000L);
        assertThat(empty.getCap().getUsedHufMinor()).isZero();
        assertThat(empty.getTags()).extracting(PenzPracticeTag::getKey).hasSize(8).startsWith("kitores")
            .endsWith("terven_kivul");
        assertThat(empty.getNoiseLine()).endsWith("most 0 van.");
        assertThat(empty.getWeek().getHeadline()).isNull();
        assertThat(empty.getWeek().getCurve()).isNotEmpty();
        assertThat(empty.getOpen()).isEmpty();
        assertThat(empty.getPlanned()).isEmpty();
        assertThat(empty.getAvgR()).isNull();

        UUID ref = UUID.randomUUID();
        PenzPaperTrade planned = create(u.headers(), plan("  OTP  ", 10, 10_000L, 9_500).targetMinor(11_000L)
            .clientRef(ref));
        assertThat(planned.getPaper()).isTrue();
        assertThat(planned.getStatus()).isEqualTo(PenzPaperTrade.StatusEnum.PLANNED);
        assertThat(planned.getInstrument()).isEqualTo("OTP");
        assertThat(planned.getQuantity()).isEqualByComparingTo("10");
        assertThat(planned.getRiskMinor()).isEqualTo(5_000L);
        assertThat(planned.getStop().getHufMinor()).isEqualTo(9_500L);
        assertThat(planned.getEntry()).isNull();
        assertThat(planned.getClientRef()).isEqualTo(ref);
        // replay: the stored row, no second plan
        assertThat(create(u.headers(), plan("OTP", 10, 10_000L, 9_500).clientRef(ref)).getId())
            .isEqualTo(planned.getId());
        assertThat(overview(u.headers()).getPlanned()).extracting(PenzPaperTrade::getId)
            .containsExactly(planned.getId());

        PenzPaperTrade opened = open(u.headers(), planned.getId(), 10_000);
        assertThat(opened.getStatus()).isEqualTo(PenzPaperTrade.StatusEnum.OPEN);
        assertThat(opened.getEntry().getMinor()).isEqualTo(10_000L);
        assertThat(opened.getEntryDate()).isEqualTo(today);
        assertThat(opened.getCostHufMinor()).isEqualTo(100_000L);
        assertThat(opened.getRiskHufMinor()).isEqualTo(5_000L);
        assertThat(opened.getUnrealizedHufMinor()).isZero(); // no typed close yet: valued at entry
        assertThat(overview(u.headers()).getCap().getUsedHufMinor()).isEqualTo(100_000L);

        PenzPaperTrade marked = postForBody(TRADES + "/" + planned.getId() + "/last-close",
            new PenzPaperTradeLastCloseRequest().closeMinor(10_200L).date(today), u.headers(), HttpStatus.OK,
            PenzPaperTrade.class);
        assertThat(marked.getLastClose().getMinor()).isEqualTo(10_200L);
        assertThat(marked.getLastCloseDate()).isEqualTo(today);
        assertThat(marked.getUnrealizedHufMinor()).isEqualTo(2_000L);

        PenzPaperTrade closed = postForBody(TRADES + "/" + planned.getId() + "/close",
            closing(10_950, List.of("kitores", "kitores")).mistake(false).line("  A szintnél léptem ki.  "),
            u.headers(), HttpStatus.OK, PenzPaperTrade.class);
        assertThat(closed.getStatus()).isEqualTo(PenzPaperTrade.StatusEnum.CLOSED);
        assertThat(closed.getPnl().getMinor()).isEqualTo(9_500L);
        assertThat(closed.getPnl().getHufMinor()).isEqualTo(9_500L);
        assertThat(closed.getrMultiple()).isEqualByComparingTo("1.90");
        assertThat(closed.getTags()).containsExactly("kitores");
        assertThat(closed.getLine()).isEqualTo("A szintnél léptem ki.");
        assertThat(closed.getStopRespected()).isTrue();
        assertThat(closed.getUnrealizedHufMinor()).isNull();

        PenzPracticeOverview after = overview(u.headers());
        assertThat(after.getMonthPnlHufMinor()).isEqualTo(9_500L);
        assertThat(after.getClosedCount()).isEqualTo(1);
        assertThat(after.getTaggedCount()).isEqualTo(1);
        assertThat(after.getAvgR()).isEqualByComparingTo("1.90");
        assertThat(after.getNoiseLine()).endsWith("most 1 van.");
        assertThat(after.getCap().getUsedHufMinor()).isZero(); // a gain does not raise the cap
        assertThat(after.getCap().getLeftHufMinor()).isEqualTo(2_000_000L);
        assertThat(after.getOpen()).isEmpty();
        assertThat(after.getWeek().getClosedCount()).isEqualTo(1);
        assertThat(after.getWeek().getWinRatePct()).isEqualTo(100);
        assertThat(after.getWeek().getHeadline()).isEqualTo("Tiszta hét: egyik kereskedést sem jelölted hibának");
        assertThat(after.getWeek().getSub()).startsWith("1 kereskedést zártál, átlagban *+1,9R* eredménnyel.");
        assertThat(after.getWeek().getBySetup()).singleElement()
            .satisfies(s -> assertThat(s.getLabel()).isEqualTo("Kitörés"));
        assertThat(after.getWeek().getCurve().getLast().getCumulativeHufMinor()).isEqualTo(9_500L);
        assertThat(after.getWeek().getTrades()).extracting(PenzPaperTrade::getId).containsExactly(planned.getId());

        // the Pénzem practice row reads the same month P/L
        assertThat(getForBody("/api/penz/portfolio?date=" + today, u.headers(), HttpStatus.OK,
            PenzPortfolioResponse.class).getPractice().getMonthPnlHufMinor()).isEqualTo(9_500L);

        List<PenzPaperTrade> journal = getForList(TRADES + "?from=" + today + "&to=" + today, u.headers(),
            HttpStatus.OK, PenzPaperTrade.class);
        assertThat(journal).extracting(PenzPaperTrade::getId).containsExactly(planned.getId());
        assertThat(getForList(TRADES + "?to=" + today.minusDays(1), u.headers(), HttpStatus.OK,
            PenzPaperTrade.class)).isEmpty();

        // a closed trade is history: deleting it would drop its P/L (and a loss from the cap) — 409
        assertHasRequestError(exchangeForResponse(HttpMethod.DELETE, TRADES + "/" + planned.getId(), null,
            u.headers()).getBody(), "PENZ_PAPER_TRADE_STATE");
        assertThat(getForList(TRADES, u.headers(), HttpStatus.OK, PenzPaperTrade.class)).hasSize(1);
        assertThat(rows.findAll()).allMatch(r -> r.isPaper());
    }

    @Test
    void testTransitions_shouldRefuseEveryStepOutOfOrder_whenNoPlanNoTrade() {
        RegisteredUser u = registerUser("penz practice states");
        PenzPaperTrade p = create(u.headers(), plan("Mol", 5, null, 2_000));

        // a plan cannot be closed, valued or skipped past
        assertHasRequestError(postForBody(TRADES + "/" + p.getId() + "/close", closing(2_500, List.of("trend")),
            u.headers(), HttpStatus.CONFLICT, String.class), "PENZ_PAPER_TRADE_STATE");
        assertHasRequestError(postForBody(TRADES + "/" + p.getId() + "/last-close",
            new PenzPaperTradeLastCloseRequest().closeMinor(2_500L).date(today), u.headers(), HttpStatus.CONFLICT,
            String.class), "PENZ_PAPER_TRADE_STATE");
        // the stop must be on the losing side of the entry
        assertHasRequestError(postForBody(TRADES + "/" + p.getId() + "/open", new PenzPaperTradeOpenRequest()
            .entryMinor(1_900L).entryDate(today), u.headers(), HttpStatus.BAD_REQUEST, String.class),
            "PENZ_PAPER_TRADE_INVALID_STOP");
        assertHasRequestError(postForBody(TRADES, plan("Mol", 5, 1_900L, 2_000), u.headers(),
            HttpStatus.BAD_REQUEST, String.class), "PENZ_PAPER_TRADE_INVALID_STOP");
        assertHasRequestError(postForBody(TRADES, plan("Mol", 5, 2_100L, 2_000).direction("short"), u.headers(),
            HttpStatus.BAD_REQUEST, String.class), "PENZ_PAPER_TRADE_INVALID_STOP");
        postForBody(TRADES + "/" + p.getId() + "/open", new PenzPaperTradeOpenRequest().entryMinor(2_100L)
            .entryDate(today.plusDays(1)), u.headers(), HttpStatus.BAD_REQUEST, String.class);

        // an edit while planned, then open
        PenzPaperTrade edited = putForBody(TRADES + "/" + p.getId(), plan("Mol Nyrt.", 6, 2_100L, 2_000),
            u.headers(), HttpStatus.OK, PenzPaperTrade.class);
        assertThat(edited.getInstrument()).isEqualTo("Mol Nyrt.");
        assertThat(edited.getRiskMinor()).isEqualTo(600L);
        open(u.headers(), p.getId(), 2_100);
        assertHasRequestError(postForBody(TRADES + "/" + p.getId() + "/open", new PenzPaperTradeOpenRequest()
            .entryMinor(2_100L).entryDate(today), u.headers(), HttpStatus.CONFLICT, String.class),
            "PENZ_PAPER_TRADE_STATE");
        assertHasRequestError(putForBody(TRADES + "/" + p.getId(), plan("Mol", 6, 2_100L, 2_000), u.headers(),
            HttpStatus.CONFLICT, String.class), "PENZ_PAPER_TRADE_STATE");
        assertHasRequestError(postForBody(TRADES + "/" + p.getId() + "/cancel", null, u.headers(),
            HttpStatus.CONFLICT, String.class), "PENZ_PAPER_TRADE_STATE");

        // the close needs at least one KNOWN tag
        postForBody(TRADES + "/" + p.getId() + "/close", closing(2_200, List.of()), u.headers(),
            HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(postForBody(TRADES + "/" + p.getId() + "/close", closing(2_200, List.of("fomo")),
            u.headers(), HttpStatus.BAD_REQUEST, String.class), "PENZ_PRACTICE_TAG_UNKNOWN");
        assertHasRequestError(postForBody(TRADES + "/" + p.getId() + "/close",
            closing(2_200, List.of("trend", "fomo")), u.headers(), HttpStatus.BAD_REQUEST, String.class),
            "PENZ_PRACTICE_TAG_UNKNOWN");
        PenzPaperTrade closed = postForBody(TRADES + "/" + p.getId() + "/close",
            closing(1_900, List.of("hirre")).mistake(true), u.headers(), HttpStatus.OK, PenzPaperTrade.class);
        assertThat(closed.getrMultiple()).isEqualByComparingTo("-2.00");
        assertThat(closed.getStopRespected()).isFalse();
        assertThat(closed.getMistake()).isTrue();
        assertHasRequestError(postForBody(TRADES + "/" + p.getId() + "/close", closing(2_200, List.of("trend")),
            u.headers(), HttpStatus.CONFLICT, String.class), "PENZ_PAPER_TRADE_STATE");

        // a plan may be cancelled — and then never opened
        PenzPaperTrade other = create(u.headers(), plan("Richter", 1, null, 900_000));
        assertThat(postForBody(TRADES + "/" + other.getId() + "/cancel", null, u.headers(), HttpStatus.OK,
            PenzPaperTrade.class).getStatus()).isEqualTo(PenzPaperTrade.StatusEnum.CANCELLED);
        assertHasRequestError(postForBody(TRADES + "/" + other.getId() + "/open", new PenzPaperTradeOpenRequest()
            .entryMinor(1_000_000L).entryDate(today), u.headers(), HttpStatus.CONFLICT, String.class),
            "PENZ_PAPER_TRADE_STATE");

        PenzPracticeOverview o = overview(u.headers());
        assertThat(o.getWeek().getCommonMistake().getTag()).isEqualTo("hirre");
        assertThat(o.getWeek().getCommonMistake().getCostHufMinor()).isEqualTo(1_200L);
        assertThat(o.getWeek().getDistribution().getHealthy()).isFalse();
        assertThat(o.getWeek().getHeadline()).isEqualTo("A hírre ugrás vitte el a hetet");
        assertThat(o.getPlanned()).isEmpty();
    }

    @Test
    void testCap_shouldRefuseTheOpenAbove422_andNotBorrowFromAnythingElse() {
        RegisteredUser u = registerUser("penz practice cap");
        // 15 000 Ft open of the 20 000 Ft cap
        PenzPaperTrade first = create(u.headers(), plan("OTP", 10, null, 140_000).entryMinor(150_000L));
        assertThat(first.getStatus()).isEqualTo(PenzPaperTrade.StatusEnum.OPEN);
        assertThat(first.getCostHufMinor()).isEqualTo(1_500_000L);

        // 6 000 Ft more does not fit: the open is refused, the plan stays a plan
        PenzPaperTrade second = create(u.headers(), plan("Mol", 20, null, 29_000));
        assertHasRequestError(postForBody(TRADES + "/" + second.getId() + "/open", new PenzPaperTradeOpenRequest()
            .entryMinor(30_000L).entryDate(today), u.headers(), HttpStatus.UNPROCESSABLE_CONTENT, String.class),
            "PENZ_PRACTICE_CAP_EXCEEDED");
        // create-and-open in one call leaves nothing behind when the cap refuses it
        assertHasRequestError(postForBody(TRADES, plan("Richter", 20, null, 29_000).entryMinor(30_000L),
            u.headers(), HttpStatus.UNPROCESSABLE_CONTENT, String.class), "PENZ_PRACTICE_CAP_EXCEEDED");
        assertThat(getForList(TRADES, u.headers(), HttpStatus.OK, PenzPaperTrade.class))
            .extracting(PenzPaperTrade::getInstrument).containsExactlyInAnyOrder("OTP", "Mol");

        // not borrowing: a big holding, a savings goal and income change nothing
        var holding = penz.holding(u.id(), "Világ ETF", "etf", null, "long", "HUF", null);
        penz.investTxn(u.id(), holding.getId(), "buy", BigDecimal.TEN, 500_000_000L, "HUF", 500_000_000L, today);
        penz.savingsGoal(u.id(), "Tartalék", "goal", 100_000_000L, 90_000_000L, 0);
        var account = penz.account(u.id(), "Folyószámla", true);
        penz.hufTransaction(u.id(), account.getId(), "income", 80_000_000L, today);
        // gains never raise it: a closed paper win this month
        penz.closedPaperTrade(u.id(), "Nyerő", 10_000, 9_000, 60_000, 100, today, false, List.of("trend"));
        assertHasRequestError(postForBody(TRADES + "/" + second.getId() + "/open", new PenzPaperTradeOpenRequest()
            .entryMinor(30_000L).entryDate(today), u.headers(), HttpStatus.UNPROCESSABLE_CONTENT, String.class),
            "PENZ_PRACTICE_CAP_EXCEEDED");

        // a closed loss this month only counts once the month's closed trades are net negative
        penz.closedPaperTrade(u.id(), "Vesztes", 10_000, 9_000, 9_000, 100, today, true, List.of("hirre"));
        PenzPracticeOverview o = overview(u.headers());
        // the win (+50 000 Ft) and the loss (−1 000 Ft) net positive -> no closed-loss usage at all
        assertThat(o.getCap().getUsedHufMinor()).isEqualTo(1_500_000L);
        penz.closedPaperTrade(u.id(), "Nagy vesztes", 100_000, 50_000, 1, 200, today, true, List.of("hirre"));
        PenzPracticeOverview worse = overview(u.headers());
        assertThat(worse.getMonthPnlHufMinor()).isEqualTo(5_000_000L - 100_000L - 19_999_800L);
        assertThat(worse.getCap().getUsedHufMinor()).isEqualTo(1_500_000L + 15_099_800L);
        assertThat(worse.getCap().getLeftHufMinor()).isZero();

        // the cap is the settings' practice amount — the allowance's Gyakorlás line, one field
        putForBody("/api/penz/settings", new PenzSettingsRequest().savingsTargetHufMinor(0L)
            .practiceMonthlyHufMinor(20_000_000L), u.headers(), HttpStatus.OK, String.class);
        PenzAllowanceResponse allowance = getForBody("/api/penz/allowance?date=" + today, u.headers(),
            HttpStatus.OK, PenzAllowanceResponse.class);
        assertThat(allowance.getLines()).filteredOn(l -> l.getKey() == PenzAllowanceLine.KeyEnum.PRACTICE)
            .singleElement().satisfies(l -> assertThat(l.getAmount().getHufMinor()).isEqualTo(20_000_000L));
        assertThat(overview(u.headers()).getCap().getCapHufMinor()).isEqualTo(20_000_000L);
        // 20 000 000 − 16 599 800 = 3 400 200 left: 600 000 now fits
        assertThat(open(u.headers(), second.getId(), 30_000).getStatus()).isEqualTo(PenzPaperTrade.StatusEnum.OPEN);
    }

    @Test
    void testOwnership_shouldHideAndRefuseAnotherOwnersTrades() {
        RegisteredUser a = registerUser("penz practice a");
        RegisteredUser b = registerUser("penz practice b");
        UUID ref = UUID.randomUUID();
        PenzPaperTrade t = create(a.headers(), plan("OTP", 1, null, 9_000).clientRef(ref));

        assertHasRequestError(postForBody(TRADES + "/" + t.getId() + "/open", new PenzPaperTradeOpenRequest()
            .entryMinor(10_000L).entryDate(today), b.headers(), HttpStatus.NOT_FOUND, String.class),
            "PENZ_PAPER_TRADE_NOT_FOUND");
        putForBody(TRADES + "/" + t.getId(), plan("X", 1, null, 9_000), b.headers(), HttpStatus.NOT_FOUND,
            String.class);
        postForBody(TRADES + "/" + t.getId() + "/cancel", null, b.headers(), HttpStatus.NOT_FOUND, String.class);
        deleteAndExpect(TRADES + "/" + t.getId(), b.headers(), HttpStatus.NOT_FOUND);
        assertThat(getForList(TRADES, b.headers(), HttpStatus.OK, PenzPaperTrade.class)).isEmpty();
        assertThat(overview(b.headers()).getPlanned()).isEmpty();
        // the same clientRef from another owner is that owner's own plan
        assertThat(create(b.headers(), plan("OTP", 1, null, 9_000).clientRef(ref)).getId()).isNotEqualTo(t.getId());
        assertThat(overview(a.headers()).getPlanned()).extracting(PenzPaperTrade::getId).containsExactly(t.getId());
    }

    @Test
    void testFx_shouldBookTheEurTwinsAtTheTradesOwnDates() {
        RegisteredUser u = registerUser("penz practice fx");
        // the entry may not precede this month: on the 1st the "earlier day" is today itself
        boolean firstOfMonth = today.getDayOfMonth() == 1;
        LocalDate yesterday = firstOfMonth ? today : today.minusDays(1);
        stubRate("EUR", yesterday, "395.00");
        stubRate("EUR", today, firstOfMonth ? "395.00" : "400.00");
        // plan figures at today's rate: stop 50,00 EUR -> 20 000 Ft
        PenzPaperTrade p = create(u.headers(), new PenzPaperTradeRequest().instrument("Nasdaq-ETF")
            .direction("short").why("Visszateszt az ellenállásnál").currency("EUR").quantity(new BigDecimal("0.5"))
            .stopMinor(5_000L));
        assertThat(p.getStop().getHufMinor()).isEqualTo(firstOfMonth ? 1_975_000L : 2_000_000L);
        // opened yesterday at 48,00 EUR: cost 24,00 EUR at 395 = 9 480 Ft; risk 1,00 EUR = 395 Ft
        PenzPaperTrade o = postForBody(TRADES + "/" + p.getId() + "/open", new PenzPaperTradeOpenRequest()
            .entryMinor(4_800L).entryDate(yesterday), u.headers(), HttpStatus.OK, PenzPaperTrade.class);
        assertThat(o.getCostHufMinor()).isEqualTo(948_000L);
        assertThat(o.getRiskMinor()).isEqualTo(100L);
        assertThat(o.getRiskHufMinor()).isEqualTo(39_500L);
        assertThat(o.getStop().getHufMinor()).isEqualTo(1_975_000L);
        // closed today at 44,00 EUR: short P/L +2,00 EUR at 400 = +800 Ft, R = +2,00
        PenzPaperTrade c = postForBody(TRADES + "/" + p.getId() + "/close", closing(4_400, List.of("visszateszt")),
            u.headers(), HttpStatus.OK, PenzPaperTrade.class);
        assertThat(c.getPnl().getMinor()).isEqualTo(200L);
        assertThat(c.getPnl().getCurrency()).isEqualTo("EUR");
        assertThat(c.getPnl().getHufMinor()).isEqualTo(firstOfMonth ? 79_000L : 80_000L);
        assertThat(c.getrMultiple()).isEqualByComparingTo("2.00");
        assertThat(c.getStopRespected()).isTrue();
        assertThat(overview(u.headers()).getWeek().getDistribution().getBigWins()).isEqualTo(1);
    }

    /** Review I1 (mezo-r36n9.105): the cap is this month's; an entry may not be booked into a closed month. */
    @Test
    void testEntryDate_shouldRefuseAnEntryBeforeThisMonth_soLastMonthCannotDodgeThisMonthsLosses() {
        RegisteredUser u = registerUser("penz practice entry month");
        // a loss this month uses up the whole 20 000 Ft cap
        penz.closedPaperTrade(u.id(), "Vesztes", 2_000_000, 1_000_000, 1, 2, today, true, List.of("hirre"));
        assertThat(overview(u.headers()).getCap().getLeftHufMinor()).isZero();
        PenzPaperTrade p = create(u.headers(), plan("OTP", 1, null, 9_000));
        LocalDate lastMonth = today.withDayOfMonth(1).minusDays(1);

        String body = postForBody(TRADES + "/" + p.getId() + "/open", new PenzPaperTradeOpenRequest()
            .entryMinor(10_000L).entryDate(lastMonth), u.headers(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "entryDate", "VALIDATION_INVALID_VALUE");
        assertHasFieldError(postForBody(TRADES, plan("Mol", 1, null, 9_000).entryMinor(10_000L)
            .entryDate(lastMonth), u.headers(), HttpStatus.BAD_REQUEST, String.class), "entryDate",
            "VALIDATION_INVALID_VALUE");
        assertHasFieldError(putForBody(TRADES + "/" + p.getId(), plan("OTP", 1, null, 9_000).entryMinor(10_000L)
            .entryDate(lastMonth), u.headers(), HttpStatus.BAD_REQUEST, String.class), "entryDate",
            "VALIDATION_INVALID_VALUE");
        // this month the closed loss counts
        assertHasRequestError(postForBody(TRADES + "/" + p.getId() + "/open", new PenzPaperTradeOpenRequest()
            .entryMinor(10_000L).entryDate(today.withDayOfMonth(1)), u.headers(), HttpStatus.UNPROCESSABLE_CONTENT,
            String.class), "PENZ_PRACTICE_CAP_EXCEEDED");
    }

    /** Review I2 (mezo-r36n9.105): two opens at once cannot both fit a cap only one of them fits. */
    @Test
    void testCap_shouldLetExactlyOneOfTwoConcurrentOpensThrough_whenTheirSumExceedsIt() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            for (int round = 0; round < 4; round++) {
                RegisteredUser u = registerUser("penz practice race " + round);
                // 15 000 Ft each against the 20 000 Ft cap
                PenzPaperTrade a = create(u.headers(), plan("OTP", 10, null, 140_000));
                PenzPaperTrade b = create(u.headers(), plan("Mol", 10, null, 140_000));
                CountDownLatch go = new CountDownLatch(1);
                List<Future<ResponseEntity<String>>> calls = new ArrayList<>();
                for (PenzPaperTrade t : List.of(a, b)) {
                    calls.add(pool.submit(() -> {
                        go.await();
                        return exchangeForResponse(HttpMethod.POST, TRADES + "/" + t.getId() + "/open",
                            new PenzPaperTradeOpenRequest().entryMinor(150_000L).entryDate(today), u.headers());
                    }));
                }
                go.countDown();
                List<Integer> statuses = new ArrayList<>();
                for (Future<ResponseEntity<String>> f : calls) {
                    statuses.add(f.get(30, TimeUnit.SECONDS).getStatusCode().value());
                }
                assertThat(statuses).as("round %d", round).containsExactlyInAnyOrder(200, 422);
                assertThat(overview(u.headers()).getCap().getUsedHufMinor()).isEqualTo(1_500_000L);
            }
        } finally {
            pool.shutdownNow();
        }
    }

    /** Review I3 (mezo-r36n9.105): planned, open and cancelled rows may be deleted; closed ones may not. */
    @Test
    void testDelete_shouldRefuseAClosedTrade_andFreeTheCapOfAnOpenOne() {
        RegisteredUser u = registerUser("penz practice delete");
        PenzPaperTrade loser = create(u.headers(), plan("OTP", 10, null, 9_000).entryMinor(10_000L));
        postForBody(TRADES + "/" + loser.getId() + "/close", closing(9_000, List.of("hirre")), u.headers(),
            HttpStatus.OK, PenzPaperTrade.class);
        assertThat(overview(u.headers()).getCap().getUsedHufMinor()).isEqualTo(10_000L);
        ResponseEntity<String> refused = exchangeForResponse(HttpMethod.DELETE, TRADES + "/" + loser.getId(), null,
            u.headers());
        assertThat(refused.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertHasRequestError(refused.getBody(), "PENZ_PAPER_TRADE_STATE");
        assertThat(overview(u.headers()).getCap().getUsedHufMinor()).isEqualTo(10_000L);

        PenzPaperTrade open = create(u.headers(), plan("Mol", 10, null, 9_000).entryMinor(10_000L));
        assertThat(overview(u.headers()).getCap().getUsedHufMinor()).isEqualTo(110_000L);
        deleteAndExpect(TRADES + "/" + open.getId(), u.headers(), HttpStatus.NO_CONTENT);
        assertThat(overview(u.headers()).getCap().getUsedHufMinor()).isEqualTo(10_000L);

        PenzPaperTrade planned = create(u.headers(), plan("Richter", 1, null, 9_000));
        deleteAndExpect(TRADES + "/" + planned.getId(), u.headers(), HttpStatus.NO_CONTENT);
        PenzPaperTrade cancelled = create(u.headers(), plan("Magyar Telekom", 1, null, 9_000));
        postForBody(TRADES + "/" + cancelled.getId() + "/cancel", null, u.headers(), HttpStatus.OK,
            PenzPaperTrade.class);
        deleteAndExpect(TRADES + "/" + cancelled.getId(), u.headers(), HttpStatus.NO_CONTENT);
        assertThat(getForList(TRADES, u.headers(), HttpStatus.OK, PenzPaperTrade.class))
            .extracting(PenzPaperTrade::getId).containsExactly(loser.getId());
    }

    /** Review M1/M2 (mezo-r36n9.105): an R or a HUF twin beyond its column is a 400 field error, never a 500. */
    @Test
    void testOverflow_shouldBeAFieldError_whenTheROrTheRiskTwinCannotBeStored() {
        RegisteredUser u = registerUser("penz practice overflow");
        // risk 1 minor unit per unit, exit far below: R ≈ −10^11, beyond numeric(10,2)
        PenzPaperTrade tight = create(u.headers(), new PenzPaperTradeRequest().instrument("OTP").direction("long")
            .why("Szűk stop").currency("HUF").quantity(new BigDecimal("0.00000001")).stopMinor(99_999_999_999L)
            .entryMinor(100_000_000_000L));
        assertThat(tight.getStatus()).isEqualTo(PenzPaperTrade.StatusEnum.OPEN);
        assertHasFieldError(postForBody(TRADES + "/" + tight.getId() + "/close", closing(1, List.of("trend")),
            u.headers(), HttpStatus.BAD_REQUEST, String.class), "exitMinor", "VALIDATION_INVALID_VALUE");

        // a short EUR trade whose risk twin overflows a long once converted
        stubRate("EUR", today, "400.00");
        PenzPaperTrade wide = create(u.headers(), new PenzPaperTradeRequest().instrument("Nasdaq-ETF")
            .direction("short").why("Széles stop").currency("EUR").quantity(new BigDecimal("50000000"))
            .stopMinor(100_000_000_000L));
        postForBody(TRADES + "/" + wide.getId() + "/open", new PenzPaperTradeOpenRequest().entryMinor(1L)
            .entryDate(today), u.headers(), HttpStatus.BAD_REQUEST, String.class);
    }

}
