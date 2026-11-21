package io.mrkuhne.mezo.feature.penz;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathMatching;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;

import com.github.tomakehurst.wiremock.WireMockServer;
import io.mrkuhne.mezo.api.dto.PenzAllowanceResponse;
import io.mrkuhne.mezo.api.dto.PenzInvestTxnRequest;
import io.mrkuhne.mezo.api.dto.PenzInvestTxnResponse;
import io.mrkuhne.mezo.api.dto.PenzTransactionRequest;
import io.mrkuhne.mezo.api.dto.PenzTransactionResponse;
import io.mrkuhne.mezo.feature.penz.entity.PenzAccountEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzHoldingEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzTransactionEntity;
import io.mrkuhne.mezo.feature.penz.repository.PenzAccountRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzInvestTxnRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzTransactionRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PenzPopulator;
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
 * Boop Pénz (mezo-r36n9.119): an investment buy / sell linked to the money account it was paid from / into, over
 * HTTP — the linked money row in the account's currency (same currency, HUF twin, explicit amount, cross-currency
 * via HUF), the allowance "invested" line, the payable-account rule, ownership, the clientRef replay, adopting a
 * bank-SMS debit (candidates, date from the bank row, mismatch), the delete release and the 409 guard from the
 * transaction side. frankfurter.dev is a WireMock; every figure is invented and round. (The SMS-carrying revert is
 * in {@code PenzSmsIngestApiIT}, where real SMS rows exist.)
 */
class PenzInvestAccountLinkApiIT extends ApiIntegrationTest {

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

    private static final String TXNS = "/api/penz/invest-transactions";
    private static final LocalDate D = LocalDate.of(2026, 11, 4);

    @Autowired private PenzPopulator penz;
    @Autowired private PenzTransactionRepository transactionRows;
    @Autowired private PenzAccountRepository accountRows;
    @Autowired private PenzInvestTxnRepository investRows;

    private LocalDate today;

    @BeforeEach
    void resetStubs() {
        MOCK.resetAll();
        MOCK.stubFor(get(urlPathMatching("/v8/finance/chart/.*")).atPriority(10)
            .willReturn(aResponse().withStatus(500)));
        today = LocalDate.now(ZoneId.of("Europe/Budapest"));
    }

    private static void stubRate(String currency, LocalDate date, String rate) {
        MOCK.stubFor(get(urlPathEqualTo("/" + date)).withQueryParam("from", equalTo(currency))
            .withQueryParam("to", equalTo("HUF"))
            .willReturn(aResponse().withHeader("Content-Type", "application/json")
                .withBody("{\"amount\":1.0,\"base\":\"" + currency + "\",\"date\":\"" + date
                    + "\",\"rates\":{\"HUF\":" + rate + "}}")));
    }

    private PenzHoldingEntity holding(UUID owner, String name, String currency) {
        return penz.holding(owner, name, "fund", null, "long", currency, null);
    }

    private static PenzInvestTxnRequest buy(UUID holdingId, long amountMinor, LocalDate date, UUID accountId) {
        return new PenzInvestTxnRequest().holdingId(holdingId).side("buy").amountMinor(amountMinor).date(date)
            .accountId(accountId);
    }

    private PenzInvestTxnResponse record(HttpHeaders h, PenzInvestTxnRequest req) {
        return postForBody(TXNS, req, h, HttpStatus.CREATED, PenzInvestTxnResponse.class);
    }

    private PenzTransactionEntity money(UUID id) {
        return transactionRows.findById(id).orElseThrow();
    }

    private List<PenzTransactionEntity> rowsOn(UUID owner, UUID accountId) {
        return transactionRows.findByCreatedByAndAccountIdAndDateBetweenAndDeletedFalse(owner, accountId,
            LocalDate.of(2000, 1, 1), LocalDate.of(2100, 1, 1));
    }

    /** A bank-SMS debit as the ingest leaves it (source sms, needs review). */
    private PenzTransactionEntity smsDebit(UUID owner, UUID accountId, long amountMinor, LocalDate date) {
        PenzTransactionEntity t = penz.hufTransaction(owner, accountId, "expense", amountMinor, date);
        t.setSource("sms");
        t.setNeedsReview(true);
        t.setNote("MBH");
        return transactionRows.saveAndFlush(t);
    }

    private PenzAccountEntity smsAccount(UUID owner) {
        PenzAccountEntity a = penz.account(owner, "MBH", true);
        a.setSmsSender("MBH Bank");
        return accountRows.saveAndFlush(a);
    }

    // ---- the money row ----

    @Test
    void aForeignBuyPaidFromAHufAccountLandsAsItsHufTwinAndCountsAsInvested() {
        RegisteredUser u = registerUser("penz link huf");
        PenzAccountEntity mbh = penz.account(u.id(), "MBH", true);
        PenzHoldingEntity etf = holding(u.id(), "Világ ETF", "EUR");
        stubRate("EUR", today, "400");

        PenzInvestTxnResponse r = record(u.headers(), buy(etf.getId(), 1_000_00L, today, mbh.getId()));
        assertThat(r.getAmount().getCurrency()).isEqualTo("EUR");
        assertThat(r.getAmount().getHufMinor()).isEqualTo(400_000_00L);
        assertThat(r.getAccountId()).isEqualTo(mbh.getId());
        assertThat(r.getTransactionId()).isNotNull();

        PenzTransactionEntity m = money(r.getTransactionId());
        assertThat(m.getAccountId()).isEqualTo(mbh.getId());
        assertThat(m.getKind()).isEqualTo("invest_buy");
        assertThat(m.getCurrency()).isEqualTo("HUF");
        assertThat(m.getAmountMinor()).isEqualTo(400_000_00L);
        assertThat(m.getAmountHufMinor()).isEqualTo(400_000_00L);
        assertThat(m.getCategoryId()).isNull();
        assertThat(m.getDate()).isEqualTo(today);
        assertThat(m.getNote()).isEqualTo("Világ ETF");
        assertThat(m.getSource()).isEqualTo("manual");
        assertThat(m.isNeedsReview()).isFalse();

        PenzAllowanceResponse allowance = getForBody("/api/penz/allowance?date=" + today, u.headers(), HttpStatus.OK,
            PenzAllowanceResponse.class);
        assertThat(allowance.getLines()).filteredOn(l -> l.getKey().getValue().equals("invested")).singleElement()
            .satisfies(l -> assertThat(l.getAmount().getHufMinor()).isEqualTo(400_000_00L));

        // the list carries the link too
        assertThat(getForList("/api/penz/holdings/" + etf.getId() + "/transactions", u.headers(), HttpStatus.OK,
            PenzInvestTxnResponse.class)).singleElement().satisfies(t -> {
                assertThat(t.getAccountId()).isEqualTo(mbh.getId());
                assertThat(t.getTransactionId()).isEqualTo(r.getTransactionId());
            });
    }

    @Test
    void aSameCurrencyAccountTakesTheAmountItself() {
        RegisteredUser u = registerUser("penz link eur");
        PenzAccountEntity rev = penz.account(u.id(), "Revolut EUR", "checking", "EUR", true, false);
        PenzHoldingEntity etf = holding(u.id(), "Európa ETF", "EUR");
        stubRate("EUR", D, "400");
        PenzInvestTxnResponse r = record(u.headers(), buy(etf.getId(), 500_00L, D, rev.getId()));
        PenzTransactionEntity m = money(r.getTransactionId());
        assertThat(m.getCurrency()).isEqualTo("EUR");
        assertThat(m.getAmountMinor()).isEqualTo(500_00L);
        assertThat(m.getAmountHufMinor()).isEqualTo(200_000_00L);
        assertThat(m.getFxRateDate()).isEqualTo(D);
    }

    @Test
    void anExplicitAccountAmountWinsAndAnotherForeignCurrencyGoesThroughHuf() {
        RegisteredUser u = registerUser("penz link explicit");
        PenzAccountEntity mbh = penz.account(u.id(), "MBH", true);
        PenzAccountEntity rev = penz.account(u.id(), "Revolut EUR", "checking", "EUR", false, false);
        PenzHoldingEntity eur = holding(u.id(), "Európa ETF", "EUR");
        PenzHoldingEntity usd = holding(u.id(), "USA ETF", "USD");
        stubRate("EUR", D, "400");
        stubRate("USD", D, "360");

        PenzInvestTxnResponse explicit = record(u.headers(), buy(eur.getId(), 1_000_00L, D, mbh.getId())
            .accountAmountMinor(410_000_00L));
        assertThat(money(explicit.getTransactionId()).getAmountMinor()).isEqualTo(410_000_00L);
        assertThat(explicit.getAmount().getHufMinor()).isEqualTo(400_000_00L); // his own amount stays as typed

        // 100 USD = 36 000 Ft twin; ÷ 400 Ft/EUR = 90 EUR on the EUR account
        PenzInvestTxnResponse cross = record(u.headers(), buy(usd.getId(), 100_00L, D, rev.getId()));
        PenzTransactionEntity m = money(cross.getTransactionId());
        assertThat(m.getCurrency()).isEqualTo("EUR");
        assertThat(m.getAmountMinor()).isEqualTo(90_00L);
        assertThat(m.getAmountHufMinor()).isEqualTo(36_000_00L);
    }

    @Test
    void aSellIsPaidIntoTheAccountAsInvestSell() {
        RegisteredUser u = registerUser("penz link sell");
        PenzAccountEntity cash = penz.account(u.id(), "Kassza", "cash", "HUF", true, false);
        PenzHoldingEntity bond = holding(u.id(), "Állampapír", "HUF");
        record(u.headers(), buy(bond.getId(), 1_000_000_00L, D, cash.getId()));
        PenzInvestTxnResponse sell = record(u.headers(), new PenzInvestTxnRequest().holdingId(bond.getId())
            .side("sell").amountMinor(500_000_00L).date(D.plusDays(1)).accountId(cash.getId()));
        PenzTransactionEntity m = money(sell.getTransactionId());
        assertThat(m.getKind()).isEqualTo("invest_sell");
        assertThat(m.getAmountMinor()).isEqualTo(500_000_00L);
        assertThat(rowsOn(u.id(), cash.getId())).extracting(PenzTransactionEntity::getKind)
            .containsExactlyInAnyOrder("invest_buy", "invest_sell");
    }

    @Test
    void onlyHisLiveCheckingOrCashAccountCanPay() {
        RegisteredUser u = registerUser("penz link payable");
        RegisteredUser other = registerUser("penz link payable other");
        PenzHoldingEntity bond = holding(u.id(), "Állampapír", "HUF");
        PenzAccountEntity savings = penz.savingsAccount(u.id(), "Megtakarítás");
        PenzAccountEntity broker = penz.account(u.id(), "Bróker", "investment", "HUF", false, false);
        PenzAccountEntity archived = penz.account(u.id(), "Régi", false);
        archived.setArchived(true);
        accountRows.saveAndFlush(archived);
        PenzAccountEntity theirs = penz.account(other.id(), "Övé", true);

        assertHasFieldError(postForBody(TXNS, buy(bond.getId(), 100_000_00L, D, savings.getId()), u.headers(),
            HttpStatus.BAD_REQUEST, String.class), "accountId", "VALIDATION_INVALID_VALUE");
        assertHasFieldError(postForBody(TXNS, buy(bond.getId(), 100_000_00L, D, broker.getId()), u.headers(),
            HttpStatus.BAD_REQUEST, String.class), "accountId", "VALIDATION_INVALID_VALUE");
        assertHasRequestError(postForBody(TXNS, buy(bond.getId(), 100_000_00L, D, archived.getId()), u.headers(),
            HttpStatus.NOT_FOUND, String.class), "PENZ_ACCOUNT_NOT_FOUND");
        assertHasRequestError(postForBody(TXNS, buy(bond.getId(), 100_000_00L, D, theirs.getId()), u.headers(),
            HttpStatus.NOT_FOUND, String.class), "PENZ_ACCOUNT_NOT_FOUND");
        // nothing was written by the refused requests
        assertThat(getForList("/api/penz/holdings/" + bond.getId() + "/transactions", u.headers(), HttpStatus.OK,
            PenzInvestTxnResponse.class)).isEmpty();
        getForBody(TXNS + "/sms-candidates?accountId=" + theirs.getId() + "&amountMinor=100&date=" + D, u.headers(),
            HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void aClientRefReplayNeverWritesASecondMoneyRow() {
        RegisteredUser u = registerUser("penz link replay");
        PenzAccountEntity mbh = penz.account(u.id(), "MBH", true);
        PenzHoldingEntity bond = holding(u.id(), "Állampapír", "HUF");
        UUID ref = UUID.randomUUID();
        PenzInvestTxnResponse first = record(u.headers(), buy(bond.getId(), 200_000_00L, D, mbh.getId())
            .clientRef(ref));
        PenzInvestTxnResponse again = record(u.headers(), buy(bond.getId(), 200_000_00L, D, mbh.getId())
            .clientRef(ref));
        assertThat(again.getId()).isEqualTo(first.getId());
        assertThat(again.getTransactionId()).isEqualTo(first.getTransactionId());
        assertThat(again.getAccountId()).isEqualTo(mbh.getId());
        assertThat(rowsOn(u.id(), mbh.getId())).singleElement()
            .satisfies(t -> assertThat(t.getId()).isEqualTo(first.getTransactionId()));
    }

    // ---- adopting a bank-SMS debit ----

    @Test
    void aBuyAdoptsABankSmsDebitAndTakesItsDate() {
        RegisteredUser u = registerUser("penz link adopt");
        PenzAccountEntity mbh = smsAccount(u.id());
        PenzHoldingEntity bond = holding(u.id(), "MÁP Plusz", "HUF");
        PenzTransactionEntity debit = smsDebit(u.id(), mbh.getId(), 100_000_00L, D.plusDays(2));
        debit.setCategoryId(penz.category(u.id(), "Egyéb", "expense").getId());
        debit = transactionRows.saveAndFlush(debit);
        penz.hufTransaction(u.id(), mbh.getId(), "expense", 100_000_00L, D); // manual: never offered
        smsDebit(u.id(), mbh.getId(), 100_000_00L, D.plusDays(4)); // day 4: too far

        List<PenzTransactionResponse> offered = getForList(TXNS + "/sms-candidates?accountId=" + mbh.getId()
            + "&amountMinor=10000000&date=" + D, u.headers(), HttpStatus.OK, PenzTransactionResponse.class);
        assertThat(offered).extracting(PenzTransactionResponse::getId).containsExactly(debit.getId());
        int before = rowsOn(u.id(), mbh.getId()).size();

        PenzInvestTxnResponse r = record(u.headers(), buy(bond.getId(), 100_000_00L, D, mbh.getId())
            .linkTransactionId(debit.getId()));
        assertThat(r.getTransactionId()).isEqualTo(debit.getId());
        assertThat(r.getDate()).isEqualTo(D.plusDays(2)); // one buy never carries two dates
        assertThat(r.getAccountId()).isEqualTo(mbh.getId());
        PenzTransactionEntity m = money(debit.getId());
        assertThat(m.getKind()).isEqualTo("invest_buy");
        assertThat(m.getCategoryId()).isNull();
        assertThat(m.isNeedsReview()).isFalse();
        assertThat(m.getNote()).isEqualTo("MÁP Plusz");
        assertThat(m.getSource()).isEqualTo("sms");
        assertThat(rowsOn(u.id(), mbh.getId())).hasSize(before); // nothing new written

        // linked now: no longer offered, and a second buy cannot adopt it
        assertThat(getForList(TXNS + "/sms-candidates?accountId=" + mbh.getId() + "&amountMinor=10000000&date="
            + D, u.headers(), HttpStatus.OK, PenzTransactionResponse.class)).isEmpty();
        assertHasRequestError(postForBody(TXNS, buy(bond.getId(), 100_000_00L, D, mbh.getId())
            .linkTransactionId(debit.getId()), u.headers(), HttpStatus.CONFLICT, String.class),
            "PENZ_SMS_LINK_MISMATCH");
    }

    /**
     * Review fix (mezo-r36n9.119): two buys at once (different clientRefs) adopting the same bank debit — the money
     * row is locked before the re-check and one link per money row is a unique index, so exactly one wins and the
     * other gets 409 PENZ_SMS_LINK_MISMATCH (never a 500), and one investment row carries the link.
     */
    @Test
    void twoConcurrentBuysAdoptingTheSameBankDebitLetExactlyOneThrough() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            for (int round = 0; round < 6; round++) {
                RegisteredUser u = registerUser("penz link race " + round);
                PenzAccountEntity mbh = smsAccount(u.id());
                PenzHoldingEntity bond = holding(u.id(), "MÁP Plusz", "HUF");
                PenzTransactionEntity debit = smsDebit(u.id(), mbh.getId(), 100_000_00L, D);
                // his settings row exists already (its lazy first insert would serialize the two requests)
                getForBody("/api/penz/settings", u.headers(), HttpStatus.OK, String.class);
                CountDownLatch go = new CountDownLatch(1);
                List<Future<ResponseEntity<String>>> calls = new ArrayList<>();
                for (int i = 0; i < 2; i++) {
                    PenzInvestTxnRequest req = buy(bond.getId(), 100_000_00L, D, mbh.getId())
                        .linkTransactionId(debit.getId()).clientRef(UUID.randomUUID());
                    calls.add(pool.submit(() -> {
                        go.await();
                        return exchangeForResponse(HttpMethod.POST, TXNS, req, u.headers());
                    }));
                }
                go.countDown();
                List<Integer> statuses = new ArrayList<>();
                List<String> bodies = new ArrayList<>();
                for (Future<ResponseEntity<String>> f : calls) {
                    ResponseEntity<String> resp = f.get(30, TimeUnit.SECONDS);
                    statuses.add(resp.getStatusCode().value());
                    bodies.add(resp.getBody());
                }
                assertThat(statuses).as("round %d: %s", round, bodies).containsExactlyInAnyOrder(201, 409);
                assertThat(bodies).as("round %d", round).anyMatch(b -> b.contains("PENZ_SMS_LINK_MISMATCH"));
                assertThat(investRows.findByCreatedByAndTransactionIdInAndDeletedFalse(u.id(),
                    List.of(debit.getId()))).as("round %d", round).hasSize(1);
                assertThat(getForList("/api/penz/holdings/" + bond.getId() + "/transactions", u.headers(),
                    HttpStatus.OK, PenzInvestTxnResponse.class)).as("round %d", round).hasSize(1);
            }
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void aMismatchedLinkIsRefused() {
        RegisteredUser u = registerUser("penz link mismatch");
        PenzAccountEntity mbh = smsAccount(u.id());
        PenzAccountEntity noSms = penz.account(u.id(), "Kassza", "cash", "HUF", false, false);
        PenzHoldingEntity bond = holding(u.id(), "MÁP Plusz", "HUF");
        PenzTransactionEntity debit = smsDebit(u.id(), mbh.getId(), 100_000_00L, D);

        assertHasRequestError(postForBody(TXNS, buy(bond.getId(), 90_000_00L, D, mbh.getId())
            .linkTransactionId(debit.getId()), u.headers(), HttpStatus.CONFLICT, String.class),
            "PENZ_SMS_LINK_MISMATCH"); // another amount
        assertHasRequestError(postForBody(TXNS, buy(bond.getId(), 100_000_00L, D.minusDays(4), mbh.getId())
            .linkTransactionId(debit.getId()), u.headers(), HttpStatus.CONFLICT, String.class),
            "PENZ_SMS_LINK_MISMATCH"); // four days apart
        assertHasRequestError(postForBody(TXNS, buy(bond.getId(), 100_000_00L, D, noSms.getId())
            .linkTransactionId(debit.getId()), u.headers(), HttpStatus.CONFLICT, String.class),
            "PENZ_SMS_LINK_MISMATCH"); // another account (and one without an SMS sender)
        assertHasFieldError(postForBody(TXNS, new PenzInvestTxnRequest().holdingId(bond.getId()).side("sell")
            .amountMinor(100_000_00L).date(D).accountId(mbh.getId()).linkTransactionId(debit.getId()), u.headers(),
            HttpStatus.BAD_REQUEST, String.class), "linkTransactionId", "VALIDATION_INVALID_VALUE");
        assertHasFieldError(postForBody(TXNS, buy(bond.getId(), 100_000_00L, D, null)
            .linkTransactionId(debit.getId()), u.headers(), HttpStatus.BAD_REQUEST, String.class),
            "linkTransactionId", "VALIDATION_INVALID_VALUE");
        assertThat(money(debit.getId()).getKind()).isEqualTo("expense"); // untouched
    }

    // ---- delete and the guard ----

    @Test
    void theLinkedRowChangesOnlyThroughTheInvestmentAndGoesWithIt() {
        RegisteredUser u = registerUser("penz link guard");
        PenzAccountEntity mbh = penz.account(u.id(), "MBH", true);
        PenzHoldingEntity bond = holding(u.id(), "Állampapír", "HUF");
        PenzInvestTxnResponse r = record(u.headers(), buy(bond.getId(), 300_000_00L, D, mbh.getId()));
        UUID moneyId = r.getTransactionId();

        assertHasRequestError(putForBody("/api/penz/transactions/" + moneyId, new PenzTransactionRequest()
            .accountId(mbh.getId()).kind("expense").amountMinor(1_00L).currency("HUF").date(D), u.headers(),
            HttpStatus.CONFLICT, String.class), "PENZ_TRANSACTION_INVEST_LINKED");
        assertHasRequestError(exchangeForBody(org.springframework.http.HttpMethod.DELETE,
            "/api/penz/transactions/" + moneyId, null, u.headers(), HttpStatus.CONFLICT, String.class),
            "PENZ_TRANSACTION_INVEST_LINKED");

        deleteAndExpect(TXNS + "/" + r.getId(), u.headers(), HttpStatus.NO_CONTENT);
        assertThat(transactionRows.findById(moneyId)).isEmpty(); // a manual money row is soft-deleted

        // deleting the holding releases its transactions' money rows too
        PenzInvestTxnResponse again = record(u.headers(), buy(bond.getId(), 300_000_00L, D, mbh.getId()));
        deleteAndExpect("/api/penz/holdings/" + bond.getId(), u.headers(), HttpStatus.NO_CONTENT);
        assertThat(transactionRows.findById(again.getTransactionId())).isEmpty();
        assertThat(rowsOn(u.id(), mbh.getId())).isEmpty();
    }
}
