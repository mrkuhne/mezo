package io.mrkuhne.mezo.feature.penz;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.getRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathMatching;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;

import com.github.tomakehurst.wiremock.WireMockServer;
import io.mrkuhne.mezo.api.dto.PenzAccountRequest;
import io.mrkuhne.mezo.api.dto.PenzAccountResponse;
import io.mrkuhne.mezo.api.dto.PenzCategoryRequest;
import io.mrkuhne.mezo.api.dto.PenzCategoryResponse;
import io.mrkuhne.mezo.api.dto.PenzMonthCloseRequest;
import io.mrkuhne.mezo.api.dto.PenzMonthCloseResponse;
import io.mrkuhne.mezo.api.dto.PenzRecurringRuleRequest;
import io.mrkuhne.mezo.api.dto.PenzRecurringRuleResponse;
import io.mrkuhne.mezo.api.dto.PenzSettingsRequest;
import io.mrkuhne.mezo.api.dto.PenzSettingsResponse;
import io.mrkuhne.mezo.api.dto.PenzTransactionRequest;
import io.mrkuhne.mezo.api.dto.PenzTransactionResponse;
import io.mrkuhne.mezo.api.dto.PenzTransferRequest;
import io.mrkuhne.mezo.feature.penz.repository.PenzFxRateRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzTransactionRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PenzPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Boop Pénz L4 (mezo-r36n9.102): /api/penz over HTTP — CRUD, ownership isolation, client-ref idempotency,
 * transfer pairs, the one FX policy (cache, fallback, 503) and the not-yet-built engine endpoints (501).
 * frankfurter.dev is stubbed with WireMock (never called live). Amounts are invented.
 */
class PenzApiIT extends ApiIntegrationTest {

    static final WireMockServer FX = new WireMockServer(wireMockConfig().dynamicPort());

    @DynamicPropertySource
    static void fxBaseUrl(DynamicPropertyRegistry registry) {
        FX.start();
        registry.add("mezo.penz.frankfurter-base-url", FX::baseUrl);
    }

    @AfterAll
    static void stopFx() {
        FX.stop();
    }

    /** A Wednesday well in the past — its rate is a plain ECB business-day rate. */
    private static final LocalDate RATE_DAY = LocalDate.of(2026, 10, 14);

    @Autowired private PenzPopulator penz;
    @Autowired private PenzFxRateRepository fxRates;
    @Autowired private PenzTransactionRepository transactionRows;

    @BeforeEach
    void resetStubs() {
        FX.resetAll();
    }

    private static void stubRate(String currency, LocalDate date, String rate) {
        FX.stubFor(get(urlPathEqualTo("/" + date)).withQueryParam("from", equalTo(currency))
            .withQueryParam("to", equalTo("HUF"))
            .willReturn(aResponse().withHeader("Content-Type", "application/json")
                .withBody("{\"amount\":1.0,\"base\":\"" + currency + "\",\"date\":\"" + date
                    + "\",\"rates\":{\"HUF\":" + rate + "}}")));
    }

    private static void stubProviderDown() {
        FX.stubFor(get(urlPathMatching("/.*")).willReturn(aResponse().withStatus(500)));
    }

    private PenzAccountResponse createAccount(HttpHeaders h, String name, boolean isDefault) {
        return postForBody("/api/penz/accounts", new PenzAccountRequest().name(name).type("checking").currency("HUF")
            .openingBalanceMinor(25_000_000L).isDefault(isDefault), h, HttpStatus.OK, PenzAccountResponse.class);
    }

    private static PenzTransactionRequest expense(UUID accountId, long amountMinor, String currency, LocalDate date) {
        return new PenzTransactionRequest().accountId(accountId).kind("expense").amountMinor(amountMinor)
            .currency(currency).date(date).note("Bolt");
    }

    private static String month(LocalDate d) {
        return YearMonth.from(d).toString();
    }

    // ---- settings ----

    @Test
    void settingsStartWithTheDefaultsAndArePut() {
        RegisteredUser u = registerUser("penz settings");
        PenzSettingsResponse s = getForBody("/api/penz/settings", u.headers(), HttpStatus.OK, PenzSettingsResponse.class);
        assertThat(s.getPracticeMonthlyHufMinor()).isEqualTo(2_000_000L);
        assertThat(s.getSavingsTargetHufMinor()).isZero();
        assertThat(s.getTimezone()).isEqualTo("Europe/Budapest");
        assertThat(s.getEmergencyFundMonths()).isEqualTo(6);

        PenzSettingsResponse put = putForBody("/api/penz/settings", new PenzSettingsRequest()
            .savingsTargetHufMinor(8_000_000L).practiceMonthlyHufMinor(1_500_000L).emergencyFundMonths(4),
            u.headers(), HttpStatus.OK, PenzSettingsResponse.class);
        assertThat(put.getSavingsTargetHufMinor()).isEqualTo(8_000_000L);
        assertThat(put.getPracticeMonthlyHufMinor()).isEqualTo(1_500_000L);
        assertThat(getForBody("/api/penz/settings", u.headers(), HttpStatus.OK, PenzSettingsResponse.class)
            .getEmergencyFundMonths()).isEqualTo(4);

        String err = putForBody("/api/penz/settings", new PenzSettingsRequest().savingsTargetHufMinor(0L)
            .practiceMonthlyHufMinor(0L).timezone("Mars/Olympus"), u.headers(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(err, "timezone", "VALIDATION_INVALID_VALUE");
    }

    // ---- accounts ----

    @Test
    void accountsCrudMoveTheDefaultFlagAndStayPrivate() {
        RegisteredUser a = registerUser("penz accounts a");
        RegisteredUser b = registerUser("penz accounts b");
        PenzAccountResponse first = createAccount(a.headers(), "Folyószámla", true);
        PenzAccountResponse second = createAccount(a.headers(), "Készpénz", true);

        List<PenzAccountResponse> list = getForList("/api/penz/accounts", a.headers(), HttpStatus.OK,
            PenzAccountResponse.class);
        assertThat(list).extracting(PenzAccountResponse::getName).containsExactly("Készpénz", "Folyószámla");
        assertThat(list).filteredOn(PenzAccountResponse::getIsDefault).extracting(PenzAccountResponse::getId)
            .containsExactly(second.getId());

        PenzAccountResponse updated = putForBody("/api/penz/accounts/" + first.getId(), new PenzAccountRequest()
            .name("Fő számla").type("checking").currency("HUF").smsSender("OTPdirekt"), a.headers(), HttpStatus.OK,
            PenzAccountResponse.class);
        assertThat(updated.getName()).isEqualTo("Fő számla");
        assertThat(updated.getSmsSender()).isEqualTo("OTPdirekt");
        assertThat(updated.getOpeningBalanceMinor()).isZero();

        postForBody("/api/penz/accounts/" + second.getId() + "/archive", null, a.headers(), HttpStatus.OK,
            PenzAccountResponse.class);
        assertThat(getForList("/api/penz/accounts", a.headers(), HttpStatus.OK, PenzAccountResponse.class))
            .extracting(PenzAccountResponse::getId).containsExactly(first.getId());
        assertThat(getForList("/api/penz/accounts?includeArchived=true", a.headers(), HttpStatus.OK,
            PenzAccountResponse.class)).hasSize(2);

        // user B sees nothing of A's and cannot touch A's rows
        assertThat(getForList("/api/penz/accounts?includeArchived=true", b.headers(), HttpStatus.OK,
            PenzAccountResponse.class)).isEmpty();
        String err = putForBody("/api/penz/accounts/" + first.getId(), new PenzAccountRequest().name("Lopott")
            .type("checking").currency("HUF"), b.headers(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(err, "PENZ_ACCOUNT_NOT_FOUND");
        postForBody("/api/penz/accounts/" + first.getId() + "/archive", null, b.headers(), HttpStatus.NOT_FOUND,
            String.class);
    }

    @Test
    void requestPatternsRefuseUnknownValues() {
        RegisteredUser u = registerUser("penz patterns");
        String err = postForBody("/api/penz/accounts", new PenzAccountRequest().name("X").type("checking")
            .currency("BTC"), u.headers(), HttpStatus.BAD_REQUEST, String.class);
        assertThat(err).contains("currency");
        PenzAccountResponse acc = createAccount(u.headers(), "Fő", true);
        postForBody("/api/penz/transactions", expense(acc.getId(), 100, "HUF", RATE_DAY).kind("gift"), u.headers(),
            HttpStatus.BAD_REQUEST, String.class);
        // a transfer leg cannot be created alone
        String leg = postForBody("/api/penz/transactions", expense(acc.getId(), 100, "HUF", RATE_DAY)
            .kind("transfer_out"), u.headers(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(leg, "kind", "VALIDATION_INVALID_VALUE");
    }

    // ---- categories ----

    @Test
    void defaultCategoriesAreSeededOnceAndNamesAreUnique() {
        RegisteredUser a = registerUser("penz categories a");
        RegisteredUser b = registerUser("penz categories b");
        List<PenzCategoryResponse> first = getForList("/api/penz/categories", a.headers(), HttpStatus.OK,
            PenzCategoryResponse.class);
        assertThat(first).hasSize(15);
        assertThat(first).filteredOn(c -> c.getKind() == PenzCategoryResponse.KindEnum.INCOME)
            .extracting(PenzCategoryResponse::getName).containsExactly("Fizetés", "Bónusz", "Egyéb bevétel");
        assertThat(first).extracting(PenzCategoryResponse::getName).contains("Élelmiszer", "Rezsi", "Egyéb");

        PenzCategoryResponse food = first.stream().filter(c -> c.getName().equals("Élelmiszer")).findFirst()
            .orElseThrow();
        putForBody("/api/penz/categories/" + food.getId(), new PenzCategoryRequest().name("Bevásárlás")
            .kind("expense").monthlyBudgetHufMinor(12_000_000L), a.headers(), HttpStatus.OK, PenzCategoryResponse.class);

        // a second access neither re-seeds the renamed default nor doubles anything
        List<PenzCategoryResponse> again = getForList("/api/penz/categories", a.headers(), HttpStatus.OK,
            PenzCategoryResponse.class);
        assertThat(again).hasSize(15);
        assertThat(again).extracting(PenzCategoryResponse::getName).doesNotContain("Élelmiszer").contains("Bevásárlás");

        PenzCategoryResponse created = postForBody("/api/penz/categories", new PenzCategoryRequest().name("Kutya")
            .kind("expense"), a.headers(), HttpStatus.OK, PenzCategoryResponse.class);
        assertThat(created.getPosition()).isEqualTo(15);
        String dup = postForBody("/api/penz/categories", new PenzCategoryRequest().name("rezsi").kind("expense"),
            a.headers(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(dup, "PENZ_CATEGORY_NAME_TAKEN");

        // B gets its own 15, and cannot edit A's
        assertThat(getForList("/api/penz/categories", b.headers(), HttpStatus.OK, PenzCategoryResponse.class))
            .hasSize(15).extracting(PenzCategoryResponse::getId).doesNotContain(food.getId());
        putForBody("/api/penz/categories/" + food.getId(), new PenzCategoryRequest().name("X").kind("expense"),
            b.headers(), HttpStatus.NOT_FOUND, String.class);
    }

    // ---- transactions ----

    @Test
    void hufTransactionsCrudByMonthAndStayPrivate() {
        RegisteredUser a = registerUser("penz txn a");
        RegisteredUser b = registerUser("penz txn b");
        PenzAccountResponse acc = createAccount(a.headers(), "Fő", true);
        LocalDate day = LocalDate.of(2026, 10, 3);

        PenzTransactionResponse t = postForBody("/api/penz/transactions",
            expense(acc.getId(), 1_299_000L, "HUF", day).needsReview(true), a.headers(), HttpStatus.OK,
            PenzTransactionResponse.class);
        assertThat(t.getAmount().getMinor()).isEqualTo(1_299_000L);
        assertThat(t.getAmount().getHufMinor()).isEqualTo(1_299_000L);
        assertThat(t.getAmount().getCurrency()).isEqualTo("HUF");
        assertThat(t.getFxRate()).isNull();
        assertThat(t.getSource()).isEqualTo(PenzTransactionResponse.SourceEnum.MANUAL);
        postForBody("/api/penz/transactions", expense(acc.getId(), 450_000L, "HUF", day.plusMonths(1)), a.headers(),
            HttpStatus.OK, PenzTransactionResponse.class);

        assertThat(getForList("/api/penz/transactions?month=2026-10", a.headers(), HttpStatus.OK,
            PenzTransactionResponse.class)).extracting(PenzTransactionResponse::getId).containsExactly(t.getId());
        assertThat(getForList("/api/penz/transactions?month=2026-10&needsReview=true", a.headers(), HttpStatus.OK,
            PenzTransactionResponse.class)).hasSize(1);
        getForBody("/api/penz/transactions?month=2026-13", a.headers(), HttpStatus.BAD_REQUEST, String.class);

        PenzTransactionResponse reviewed = postForBody("/api/penz/transactions/" + t.getId() + "/reviewed", null,
            a.headers(), HttpStatus.OK, PenzTransactionResponse.class);
        assertThat(reviewed.getNeedsReview()).isFalse();

        PenzTransactionResponse changed = putForBody("/api/penz/transactions/" + t.getId(),
            expense(acc.getId(), 1_500_000L, "HUF", day).note("Piac"), a.headers(), HttpStatus.OK,
            PenzTransactionResponse.class);
        assertThat(changed.getAmount().getHufMinor()).isEqualTo(1_500_000L);
        assertThat(changed.getNote()).isEqualTo("Piac");

        // B: no list, no update, no delete, no review, no booking on A's account
        assertThat(getForList("/api/penz/transactions?month=2026-10", b.headers(), HttpStatus.OK,
            PenzTransactionResponse.class)).isEmpty();
        putForBody("/api/penz/transactions/" + t.getId(), expense(acc.getId(), 1L, "HUF", day), b.headers(),
            HttpStatus.NOT_FOUND, String.class);
        deleteAndExpect("/api/penz/transactions/" + t.getId(), b.headers(), HttpStatus.NOT_FOUND);
        postForBody("/api/penz/transactions/" + t.getId() + "/reviewed", null, b.headers(), HttpStatus.NOT_FOUND,
            String.class);
        String foreign = postForBody("/api/penz/transactions", expense(acc.getId(), 100L, "HUF", day), b.headers(),
            HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(foreign, "PENZ_ACCOUNT_NOT_FOUND");

        deleteAndExpect("/api/penz/transactions/" + t.getId(), a.headers(), HttpStatus.NO_CONTENT);
        assertThat(getForList("/api/penz/transactions?month=2026-10", a.headers(), HttpStatus.OK,
            PenzTransactionResponse.class)).isEmpty();
    }

    @Test
    void aReplayedClientRefReturnsTheStoredRow() {
        RegisteredUser u = registerUser("penz idempotent");
        PenzAccountResponse acc = createAccount(u.headers(), "Fő", true);
        UUID ref = UUID.randomUUID();
        PenzTransactionResponse first = postForBody("/api/penz/transactions",
            expense(acc.getId(), 899_000L, "HUF", RATE_DAY).clientRef(ref), u.headers(), HttpStatus.OK,
            PenzTransactionResponse.class);
        PenzTransactionResponse replay = postForBody("/api/penz/transactions",
            expense(acc.getId(), 899_000L, "HUF", RATE_DAY).clientRef(ref), u.headers(), HttpStatus.OK,
            PenzTransactionResponse.class);
        assertThat(replay.getId()).isEqualTo(first.getId());
        assertThat(replay.getClientRef()).isEqualTo(ref);
        assertThat(getForList("/api/penz/transactions?month=" + month(RATE_DAY), u.headers(), HttpStatus.OK,
            PenzTransactionResponse.class)).hasSize(1);

        // another owner's equal client ref is its own row
        RegisteredUser other = registerUser("penz idempotent other");
        PenzAccountResponse otherAcc = createAccount(other.headers(), "Fő", true);
        PenzTransactionResponse theirs = postForBody("/api/penz/transactions",
            expense(otherAcc.getId(), 899_000L, "HUF", RATE_DAY).clientRef(ref), other.headers(), HttpStatus.OK,
            PenzTransactionResponse.class);
        assertThat(theirs.getId()).isNotEqualTo(first.getId());
    }

    @Test
    void aTransferIsAPairThatMovesAndDiesTogether() {
        RegisteredUser u = registerUser("penz transfer");
        PenzAccountResponse main = createAccount(u.headers(), "Fő", true);
        PenzAccountResponse savings = postForBody("/api/penz/accounts", new PenzAccountRequest().name("Megtakarítás")
            .type("savings").currency("HUF").isSavingsTarget(true), u.headers(), HttpStatus.OK,
            PenzAccountResponse.class);
        UUID ref = UUID.randomUUID();
        PenzTransferRequest req = new PenzTransferRequest().clientRef(ref).fromAccountId(main.getId())
            .toAccountId(savings.getId()).amountMinor(5_000_000L).currency("HUF").date(RATE_DAY).note("Félre");

        List<PenzTransactionResponse> legs = postForList("/api/penz/transfers", req, u.headers());
        assertThat(legs).extracting(PenzTransactionResponse::getKind).containsExactly(
            PenzTransactionResponse.KindEnum.TRANSFER_OUT, PenzTransactionResponse.KindEnum.TRANSFER_IN);
        assertThat(legs).extracting(PenzTransactionResponse::getAccountId).containsExactly(main.getId(),
            savings.getId());
        assertThat(legs.get(0).getTransferPairId()).isNotNull().isEqualTo(legs.get(1).getTransferPairId());

        // replay: the same pair, nothing doubled
        assertThat(postForList("/api/penz/transfers", req, u.headers())).extracting(PenzTransactionResponse::getId)
            .containsExactly(legs.get(0).getId(), legs.get(1).getId());

        // updating one leg moves the amount on both
        putForBody("/api/penz/transactions/" + legs.get(1).getId(), new PenzTransactionRequest()
            .accountId(savings.getId()).kind("transfer_in").amountMinor(6_000_000L).currency("HUF").date(RATE_DAY),
            u.headers(), HttpStatus.OK, PenzTransactionResponse.class);
        List<PenzTransactionResponse> month = getForList("/api/penz/transactions?month=" + month(RATE_DAY),
            u.headers(), HttpStatus.OK, PenzTransactionResponse.class);
        assertThat(month).hasSize(2).allSatisfy(t -> assertThat(t.getAmount().getMinor()).isEqualTo(6_000_000L));
        // a leg cannot change its kind
        putForBody("/api/penz/transactions/" + legs.get(1).getId(), new PenzTransactionRequest()
            .accountId(savings.getId()).kind("income").amountMinor(6_000_000L).currency("HUF").date(RATE_DAY),
            u.headers(), HttpStatus.BAD_REQUEST, String.class);

        deleteAndExpect("/api/penz/transactions/" + legs.get(0).getId(), u.headers(), HttpStatus.NO_CONTENT);
        assertThat(getForList("/api/penz/transactions?month=" + month(RATE_DAY), u.headers(), HttpStatus.OK,
            PenzTransactionResponse.class)).isEmpty();

        String same = postForBody("/api/penz/transfers", new PenzTransferRequest().fromAccountId(main.getId())
            .toAccountId(main.getId()).amountMinor(100L).currency("HUF").date(RATE_DAY), u.headers(),
            HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(same, "PENZ_TRANSFER_SAME_ACCOUNT");
    }

    // ---- FX ----

    @Test
    void aForeignAmountIsBookedOnceAndTheRateIsFetchedOnce() {
        RegisteredUser u = registerUser("penz fx cache");
        PenzAccountResponse acc = createAccount(u.headers(), "Fő", true);
        stubRate("EUR", RATE_DAY, "385.27");

        PenzTransactionResponse t = postForBody("/api/penz/transactions", expense(acc.getId(), 1_250L, "EUR", RATE_DAY),
            u.headers(), HttpStatus.OK, PenzTransactionResponse.class);
        // 12.50 EUR × 385.27 = 4815.875 Ft → 481 587.5 minor → HALF_UP 481 588
        assertThat(t.getAmount().getMinor()).isEqualTo(1_250L);
        assertThat(t.getAmount().getCurrency()).isEqualTo("EUR");
        assertThat(t.getAmount().getHufMinor()).isEqualTo(481_588L);
        assertThat(t.getFxRate()).isEqualByComparingTo(new BigDecimal("385.27"));
        assertThat(t.getFxRateDate()).isEqualTo(RATE_DAY);

        postForBody("/api/penz/transactions", expense(acc.getId(), 300L, "EUR", RATE_DAY), u.headers(), HttpStatus.OK,
            PenzTransactionResponse.class);
        // a second owner on the same day also hits the global cache
        RegisteredUser other = registerUser("penz fx cache other");
        PenzAccountResponse otherAcc = createAccount(other.headers(), "Fő", true);
        postForBody("/api/penz/transactions", expense(otherAcc.getId(), 999L, "EUR", RATE_DAY), other.headers(),
            HttpStatus.OK, PenzTransactionResponse.class);
        FX.verify(1, getRequestedFor(urlPathEqualTo("/" + RATE_DAY)));
        assertThat(fxRates.findByBaseAndQuoteAndRateDate("EUR", "HUF", RATE_DAY)).isPresent();

        // an update that leaves amount, currency and date alone keeps the stored twin (no re-booking)
        FX.resetAll();
        stubProviderDown();
        PenzTransactionResponse renamed = putForBody("/api/penz/transactions/" + t.getId(),
            expense(acc.getId(), 1_250L, "EUR", RATE_DAY).note("Múzeum"), u.headers(), HttpStatus.OK,
            PenzTransactionResponse.class);
        assertThat(renamed.getAmount().getHufMinor()).isEqualTo(481_588L);
        FX.verify(0, getRequestedFor(urlPathMatching("/.*")));
    }

    @Test
    void aWeekendAsksTheLastPublishedRate() {
        RegisteredUser u = registerUser("penz fx weekend");
        PenzAccountResponse acc = createAccount(u.headers(), "Fő", true);
        LocalDate saturday = LocalDate.of(2026, 10, 17);
        LocalDate friday = saturday.minusDays(1);
        FX.stubFor(get(urlPathEqualTo("/" + saturday)).willReturn(aResponse()
            .withHeader("Content-Type", "application/json")
            .withBody("{\"amount\":1.0,\"base\":\"USD\",\"date\":\"" + friday + "\",\"rates\":{\"HUF\":331.5}}")));

        PenzTransactionResponse t = postForBody("/api/penz/transactions", expense(acc.getId(), 2_000L, "USD", saturday),
            u.headers(), HttpStatus.OK, PenzTransactionResponse.class);
        assertThat(t.getDate()).isEqualTo(saturday);
        assertThat(t.getFxRateDate()).isEqualTo(friday);
        assertThat(t.getAmount().getHufMinor()).isEqualTo(663_000L);
    }

    @Test
    void providerDownFallsBackToARecentCachedRate() {
        RegisteredUser u = registerUser("penz fx fallback");
        PenzAccountResponse acc = createAccount(u.headers(), "Fő", true);
        penz.fxRate("EUR", RATE_DAY.minusDays(3), "384.10");
        penz.fxRate("EUR", RATE_DAY.minusDays(9), "370.00"); // older than the 7-day window: never used
        stubProviderDown();

        PenzTransactionResponse t = postForBody("/api/penz/transactions", expense(acc.getId(), 1_000L, "EUR", RATE_DAY),
            u.headers(), HttpStatus.OK, PenzTransactionResponse.class);
        assertThat(t.getFxRate()).isEqualByComparingTo(new BigDecimal("384.10"));
        assertThat(t.getFxRateDate()).isEqualTo(RATE_DAY.minusDays(3));
        assertThat(t.getAmount().getHufMinor()).isEqualTo(384_100L);
        // the fallback is not cached as the asked day's rate: the next write asks the provider again
        assertThat(fxRates.findByBaseAndQuoteAndRateDate("EUR", "HUF", RATE_DAY)).isEmpty();
    }

    @Test
    void noRateAnywhereIs503AndNothingIsWritten() {
        RegisteredUser u = registerUser("penz fx none");
        PenzAccountResponse acc = createAccount(u.headers(), "Fő", true);
        penz.fxRate("EUR", RATE_DAY.minusDays(9), "370.00"); // outside the window
        stubProviderDown();

        String err = postForBody("/api/penz/transactions", expense(acc.getId(), 1_000L, "EUR", RATE_DAY), u.headers(),
            HttpStatus.SERVICE_UNAVAILABLE, String.class);
        assertHasRequestError(err, "PENZ_FX_UNAVAILABLE");
        assertThat(transactionRows.findAllOwned(u.id())).isEmpty();

        // a HUF write never needs the provider
        postForBody("/api/penz/transactions", expense(acc.getId(), 1_000L, "HUF", RATE_DAY), u.headers(),
            HttpStatus.OK, PenzTransactionResponse.class);
    }

    // ---- recurring rules ----

    @Test
    void recurringRulesCrudAndStayPrivate() {
        RegisteredUser a = registerUser("penz rules a");
        RegisteredUser b = registerUser("penz rules b");
        PenzAccountResponse acc = createAccount(a.headers(), "Fő", true);
        PenzRecurringRuleRequest rent = new PenzRecurringRuleRequest().name("Albérlet").kind("expense")
            .amountMinor(18_000_000L).currency("HUF").accountId(acc.getId()).frequency("monthly")
            .startDate(LocalDate.of(2026, 1, 1));
        PenzRecurringRuleResponse created = postForBody("/api/penz/recurring-rules", rent, a.headers(), HttpStatus.OK,
            PenzRecurringRuleResponse.class);
        assertThat(created.getAmount().getHufMinor()).isEqualTo(18_000_000L);
        assertThat(created.getActive()).isTrue();
        assertThat(created.getFrequency()).isEqualTo(PenzRecurringRuleResponse.FrequencyEnum.MONTHLY);

        PenzRecurringRuleResponse updated = putForBody("/api/penz/recurring-rules/" + created.getId(),
            rent.amountMinor(19_000_000L).active(false), a.headers(), HttpStatus.OK, PenzRecurringRuleResponse.class);
        assertThat(updated.getAmount().getMinor()).isEqualTo(19_000_000L);
        assertThat(updated.getActive()).isFalse();
        putForBody("/api/penz/recurring-rules/" + created.getId(), rent.endDate(LocalDate.of(2025, 12, 1)),
            a.headers(), HttpStatus.BAD_REQUEST, String.class);

        assertThat(getForList("/api/penz/recurring-rules", b.headers(), HttpStatus.OK,
            PenzRecurringRuleResponse.class)).isEmpty();
        deleteAndExpect("/api/penz/recurring-rules/" + created.getId(), b.headers(), HttpStatus.NOT_FOUND);
        deleteAndExpect("/api/penz/recurring-rules/" + created.getId(), a.headers(), HttpStatus.NO_CONTENT);
        assertThat(getForList("/api/penz/recurring-rules", a.headers(), HttpStatus.OK,
            PenzRecurringRuleResponse.class)).isEmpty();
    }

    // ---- allowance + month close (engine-dependent parts: 501 until a later phase) ----

    @Test
    void allowanceAnswers501UntilTheEngineLands() {
        RegisteredUser u = registerUser("penz allowance");
        String err = getForBody("/api/penz/allowance?date=" + RATE_DAY, u.headers(), HttpStatus.NOT_IMPLEMENTED,
            String.class);
        assertHasRequestError(err, "PENZ_NOT_IMPLEMENTED");
    }

    @Test
    void openMonthsAndTheCloseGuards() {
        RegisteredUser u = registerUser("penz month close");
        LocalDate today = LocalDate.now(ZoneId.of("Europe/Budapest"));
        YearMonth current = YearMonth.from(today);
        PenzAccountResponse acc = createAccount(u.headers(), "Fő", true);
        LocalDate threeAgo = current.minusMonths(3).atDay(10);
        postForBody("/api/penz/transactions", expense(acc.getId(), 100_000L, "HUF", threeAgo), u.headers(),
            HttpStatus.OK, PenzTransactionResponse.class);
        penz.monthClose(u.id(), current.minusMonths(2).toString(), 250_000L, "kept");

        List<PenzMonthCloseResponse> open = getForList("/api/penz/month-closes/open", u.headers(), HttpStatus.OK,
            PenzMonthCloseResponse.class);
        assertThat(open).extracting(PenzMonthCloseResponse::getMonth).containsExactly(
            current.minusMonths(3).toString(), current.minusMonths(1).toString());
        assertThat(open).allSatisfy(m -> assertThat(m.getClosed()).isFalse());
        assertThat(getForList("/api/penz/month-closes", u.headers(), HttpStatus.OK, PenzMonthCloseResponse.class))
            .singleElement().satisfies(c -> {
                assertThat(c.getClosed()).isTrue();
                assertThat(c.getFinalRemaining().getHufMinor()).isEqualTo(250_000L);
            });

        PenzMonthCloseRequest keep = new PenzMonthCloseRequest().leftoverAction("kept");
        String notOver = postForBody("/api/penz/month-closes/" + current, keep, u.headers(), HttpStatus.BAD_REQUEST,
            String.class);
        assertHasRequestError(notOver, "PENZ_MONTH_NOT_OVER");
        String closed = postForBody("/api/penz/month-closes/" + current.minusMonths(2), keep, u.headers(),
            HttpStatus.CONFLICT, String.class);
        assertHasRequestError(closed, "PENZ_MONTH_ALREADY_CLOSED");
        String engine = postForBody("/api/penz/month-closes/" + current.minusMonths(1), keep, u.headers(),
            HttpStatus.NOT_IMPLEMENTED, String.class);
        assertHasRequestError(engine, "PENZ_NOT_IMPLEMENTED");
        postForBody("/api/penz/month-closes/" + current.minusMonths(1), Map.of("leftoverAction", "spent"),
            u.headers(), HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void penzNeedsAToken() {
        getForBody("/api/penz/accounts", null, HttpStatus.UNAUTHORIZED, String.class);
        postForBody("/api/penz/sms/ingest", Map.of("text", "x"), null, HttpStatus.UNAUTHORIZED, String.class);
    }

    private List<PenzTransactionResponse> postForList(String uri, Object body, HttpHeaders headers) {
        String json = postForBody(uri, body, headers, HttpStatus.OK, String.class);
        try {
            return objectMapper.readValue(json, objectMapper.getTypeFactory()
                .constructCollectionType(List.class, PenzTransactionResponse.class));
        } catch (Exception e) {
            throw new AssertionError("not a transaction list: " + json, e);
        }
    }
}
