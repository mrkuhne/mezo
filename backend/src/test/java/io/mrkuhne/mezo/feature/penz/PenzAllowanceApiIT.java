package io.mrkuhne.mezo.feature.penz;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathMatching;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;

import com.github.tomakehurst.wiremock.WireMockServer;
import io.mrkuhne.mezo.api.dto.PenzAccountRequest;
import io.mrkuhne.mezo.api.dto.PenzAccountResponse;
import io.mrkuhne.mezo.api.dto.PenzAllowanceLine;
import io.mrkuhne.mezo.api.dto.PenzAllowanceResponse;
import io.mrkuhne.mezo.api.dto.PenzMonthCloseRequest;
import io.mrkuhne.mezo.api.dto.PenzMonthCloseResponse;
import io.mrkuhne.mezo.api.dto.PenzMonthOverride;
import io.mrkuhne.mezo.api.dto.PenzRecurringRuleRequest;
import io.mrkuhne.mezo.api.dto.PenzRecurringRuleResponse;
import io.mrkuhne.mezo.api.dto.PenzSettingsRequest;
import io.mrkuhne.mezo.api.dto.PenzTransactionRequest;
import io.mrkuhne.mezo.api.dto.PenzTransactionResponse;
import io.mrkuhne.mezo.feature.penz.entity.PenzAccountEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzCategoryEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzRecurringRuleEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzTransactionEntity;
import io.mrkuhne.mezo.feature.penz.repository.PenzRecurringRuleRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzTransactionRepository;
import io.mrkuhne.mezo.feature.penz.service.PenzRecurringMaterializer;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PenzPopulator;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Boop Pénz L4 (mezo-r36n9.102): {@code GET /api/penz/allowance} end to end — the 10 derivation lines with the
 * Gyakorlás line (default 20 000 Ft) and a previous-month deficit that comes from a REAL month close, the week
 * and its per-day figure, ownership isolation, and the recurring materialization (idempotent reads; the old
 * app's {@code src/app/materialize.test.ts} 5 cases and the server-side half of
 * {@code src/features/recurring/recurringMath.test.ts}). frankfurter.dev is a WireMock that answers 500 (provider
 * down) — non-HUF rates come from the cache. Every figure is invented.
 */
class PenzAllowanceApiIT extends ApiIntegrationTest {

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

    @Autowired private PenzPopulator penz;
    @Autowired private PenzRecurringMaterializer materializer;
    @Autowired private PenzTransactionRepository transactionRows;
    @Autowired private PenzRecurringRuleRepository ruleRows;

    @BeforeEach
    void providerDown() {
        FX.resetAll();
        FX.stubFor(get(urlPathMatching("/.*")).willReturn(aResponse().withStatus(500)));
    }

    private static final LocalDate WEDNESDAY = LocalDate.of(2026, 10, 14);

    // ---- the allowance ----

    /*
     * September: salary 650 000 Ft (recurring, 09-05) − rent 180 000 Ft (recurring, 09-01) − savings 80 000 Ft
     * − Gyakorlás 20 000 Ft = 370 000 Ft free; a 395 000 Ft laptop leaves −25 000 Ft → the close stores a
     * 25 000 Ft deficit.
     * October: 650 000 + bonus 45 000 − rent 180 000 − savings 60 000 (October's own target) − Gyakorlás 20 000
     * − invested 50 000 − previous deficit 25 000 = 360 000 Ft free; spent 12 990 + 8 450 + 23 500 + 4 100
     * = 49 040 Ft → 310 960 Ft remaining.
     * Week of Wed 10-14 (Mon 10-12 … Sun 10-18, 20 days from 10-12 to the month's end): remaining at 10-12 =
     * 360 000 − 12 990 = 347 010 Ft → budget floor(347 010 × 7 / 20) = 121 453,50 Ft; spent 36 050 Ft →
     * 85 403,50 Ft left; per day over Wed…Sun (5 days) = 17 080,70 Ft.
     */
    @Test
    void theTenLinesWithPracticeAndADeficitFromARealClose() {
        RegisteredUser a = registerUser("penz allowance a");
        HttpHeaders h = a.headers();
        putForBody("/api/penz/settings", new PenzSettingsRequest().savingsTargetHufMinor(8_000_000L)
            .practiceMonthlyHufMinor(2_000_000L)
            .monthOverrides(Map.of("2026-10", new PenzMonthOverride().savingsTargetHufMinor(6_000_000L))),
            h, HttpStatus.OK, String.class);
        PenzAccountResponse main = account(h, "Folyószámla");
        rule(h, main.getId(), "Fizetés", "income", 65_000_000L, LocalDate.of(2026, 9, 5));
        rule(h, main.getId(), "Albérlet", "expense", 18_000_000L, LocalDate.of(2026, 9, 1));
        txn(h, main.getId(), "expense", 39_500_000L, LocalDate.of(2026, 9, 20), "Laptop");
        txn(h, main.getId(), "expense", 1_299_000L, LocalDate.of(2026, 10, 3), "Spar");
        txn(h, main.getId(), "income", 4_500_000L, LocalDate.of(2026, 10, 8), "Bónusz");
        txn(h, main.getId(), "invest_buy", 5_000_000L, LocalDate.of(2026, 10, 9), "ETF");
        txn(h, main.getId(), "expense", 845_000L, LocalDate.of(2026, 10, 13), "Pékség");
        txn(h, main.getId(), "expense", 2_350_000L, LocalDate.of(2026, 10, 14), "Tankolás");
        txn(h, main.getId(), "expense", 410_000L, LocalDate.of(2026, 10, 16), "Mozi");

        // open months carry the figures a close would store now (October: no closed September yet → no deficit)
        List<PenzMonthCloseResponse> open = getForList("/api/penz/month-closes/open", h, HttpStatus.OK,
            PenzMonthCloseResponse.class);
        assertThat(open).filteredOn(m -> m.getMonth().equals("2026-09")).singleElement().satisfies(m -> {
            assertThat(m.getClosed()).isFalse();
            assertThat(m.getFinalRemaining().getHufMinor()).isEqualTo(-2_500_000L);
            assertThat(m.getDeficit().getHufMinor()).isEqualTo(2_500_000L);
        });
        assertThat(open).filteredOn(m -> m.getMonth().equals("2026-10")).singleElement()
            .satisfies(m -> assertThat(m.getFinalRemaining().getHufMinor()).isEqualTo(33_596_000L));

        // months close oldest first: October cannot close while September is open
        String early = postForBody("/api/penz/month-closes/2026-10", new PenzMonthCloseRequest().leftoverAction("kept"),
            h, HttpStatus.CONFLICT, String.class);
        assertHasRequestError(early, "PENZ_EARLIER_MONTH_OPEN");

        PenzMonthCloseResponse close = postForBody("/api/penz/month-closes/2026-09",
            new PenzMonthCloseRequest().leftoverAction("transferred"), h, HttpStatus.OK, PenzMonthCloseResponse.class);
        assertThat(close.getLeftoverAction()).isEqualTo(PenzMonthCloseResponse.LeftoverActionEnum.NONE);
        assertThat(close.getFinalRemaining().getHufMinor()).isEqualTo(-2_500_000L);
        assertThat(close.getDeficit().getHufMinor()).isEqualTo(2_500_000L);
        assertThat(getForList("/api/penz/month-closes/open", h, HttpStatus.OK, PenzMonthCloseResponse.class))
            .filteredOn(m -> m.getMonth().equals("2026-10")).singleElement()
            .satisfies(m -> assertThat(m.getFinalRemaining().getHufMinor()).isEqualTo(31_096_000L));

        PenzAllowanceResponse r = getForBody("/api/penz/allowance?date=" + WEDNESDAY, h, HttpStatus.OK,
            PenzAllowanceResponse.class);
        assertThat(r.getDate()).isEqualTo(WEDNESDAY);
        assertThat(r.getLines()).extracting(l -> l.getKey().getValue()).containsExactly("recurringIncome",
            "oneOffIncome", "fixedCosts", "savingsTarget", "practice", "invested", "previousDeficit", "free", "spent",
            "remaining");
        assertThat(r.getLines()).extracting(l -> l.getAmount().getHufMinor()).containsExactly(65_000_000L,
            4_500_000L, 18_000_000L, 6_000_000L, 2_000_000L, 5_000_000L, 2_500_000L, 36_000_000L, 4_904_000L,
            31_096_000L);
        assertThat(r.getLines()).allSatisfy(l -> {
            assertThat(l.getAmount().getCurrency()).isEqualTo("HUF");
            assertThat(l.getAmount().getMinor()).isEqualTo(l.getAmount().getHufMinor());
        });
        assertThat(r.getMonth().getMonth()).isEqualTo("2026-10");
        assertThat(r.getMonth().getFree().getHufMinor()).isEqualTo(36_000_000L);
        assertThat(r.getMonth().getSpent().getHufMinor()).isEqualTo(4_904_000L);
        assertThat(r.getMonth().getRemaining().getHufMinor()).isEqualTo(31_096_000L);
        assertThat(r.getWeek().getStart()).isEqualTo(LocalDate.of(2026, 10, 12));
        assertThat(r.getWeek().getEnd()).isEqualTo(LocalDate.of(2026, 10, 18));
        assertThat(r.getWeek().getBudget().getHufMinor()).isEqualTo(12_145_350L);
        assertThat(r.getWeek().getSpent().getHufMinor()).isEqualTo(3_605_000L);
        assertThat(r.getWeek().getRemaining().getHufMinor()).isEqualTo(8_540_350L);
        assertThat(r.getWeek().getPerDay().getHufMinor()).isEqualTo(1_708_070L);

        // materialization is idempotent: a second read writes nothing; one row per occurrence
        assertThat(getForBody("/api/penz/allowance?date=" + WEDNESDAY, h, HttpStatus.OK, PenzAllowanceResponse.class))
            .usingRecursiveComparison().isEqualTo(r);
        List<PenzTransactionResponse> october = getForList("/api/penz/transactions?month=2026-10", h, HttpStatus.OK,
            PenzTransactionResponse.class);
        assertThat(october).filteredOn(t -> t.getSource() == PenzTransactionResponse.SourceEnum.RECURRING)
            .extracting(PenzTransactionResponse::getDate)
            .containsExactlyInAnyOrder(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 5));
        assertThat(october).filteredOn(t -> t.getSource() == PenzTransactionResponse.SourceEnum.RECURRING)
            .allSatisfy(t -> assertThat(t.getNeedsReview()).isFalse());

        // closing October now works, and it stores the figure carrying September's deficit
        PenzMonthCloseResponse octClose = postForBody("/api/penz/month-closes/2026-10",
            new PenzMonthCloseRequest().leftoverAction("kept"), h, HttpStatus.OK, PenzMonthCloseResponse.class);
        assertThat(octClose.getFinalRemaining().getHufMinor()).isEqualTo(31_096_000L);
        assertThat(octClose.getDeficit().getHufMinor()).isZero();
        assertThat(octClose.getLeftoverAction()).isEqualTo(PenzMonthCloseResponse.LeftoverActionEnum.KEPT);

        // user B: none of A's money — only the default Gyakorlás line (20 000 Ft) and no deficit
        RegisteredUser b = registerUser("penz allowance b");
        PenzAllowanceResponse theirs = getForBody("/api/penz/allowance?date=" + WEDNESDAY, b.headers(), HttpStatus.OK,
            PenzAllowanceResponse.class);
        assertThat(theirs.getLines()).extracting(l -> l.getAmount().getHufMinor()).containsExactly(0L, 0L, 0L, 0L,
            2_000_000L, 0L, 0L, -2_000_000L, 0L, -2_000_000L);
        assertThat(theirs.getWeek().getPerDay().getHufMinor()).isZero();
        assertThat(getForList("/api/penz/transactions?month=2026-10", b.headers(), HttpStatus.OK,
            PenzTransactionResponse.class)).isEmpty();
    }

    @Test
    void theDateDefaultsToTheOwnersTodayAndATokenIsNeeded() {
        RegisteredUser u = registerUser("penz allowance today");
        LocalDate before = LocalDate.now(ZoneId.of("Europe/Budapest"));
        PenzAllowanceResponse r = getForBody("/api/penz/allowance", u.headers(), HttpStatus.OK,
            PenzAllowanceResponse.class);
        assertThat(r.getDate()).isBetween(before, LocalDate.now(ZoneId.of("Europe/Budapest")));
        assertThat(r.getLines()).hasSize(10).extracting(PenzAllowanceLine::getKey)
            .contains(PenzAllowanceLine.KeyEnum.PRACTICE);
        getForBody("/api/penz/allowance", null, HttpStatus.UNAUTHORIZED, String.class);
        getForBody("/api/penz/allowance?date=2026-13-01", u.headers(), HttpStatus.BAD_REQUEST, String.class);
    }

    // ---- recurringMath.test.ts — rule edits never rewrite or backfill history (server side) ----

    @Test
    void ruleEditsKeepTheMaterializedDateAndResumingSkipsThePause() {
        RegisteredUser u = registerUser("penz rule edits");
        HttpHeaders h = u.headers();
        PenzAccountResponse main = account(h, "Fő");
        PenzRecurringRuleResponse gym = rule(h, main.getId(), "Edzőterem", "expense", 1_200_000L,
            LocalDate.of(2026, 9, 10));
        getForList("/api/penz/transactions?month=2026-09", h, HttpStatus.OK, PenzTransactionResponse.class);
        LocalDate materialized = ruleRows.findById(gym.getId()).orElseThrow().getLastMaterializedDate();
        assertThat(materialized).isNotNull().isAfterOrEqualTo(LocalDate.of(2026, 10, 10));

        // editing start date or frequency keeps last_materialized_date
        PenzRecurringRuleResponse moved = putForBody("/api/penz/recurring-rules/" + gym.getId(),
            ruleRequest(main.getId(), "Edzőterem", "expense", 1_200_000L, LocalDate.of(2026, 8, 1)).frequency("weekly"),
            h, HttpStatus.OK, PenzRecurringRuleResponse.class);
        assertThat(moved.getLastMaterializedDate()).isEqualTo(materialized);
        // no backfill: the earlier start writes nothing before the materialized date
        assertThat(getForList("/api/penz/transactions?month=2026-08", h, HttpStatus.OK,
            PenzTransactionResponse.class)).isEmpty();
        materialized = ruleRows.findById(gym.getId()).orElseThrow().getLastMaterializedDate(); // that read ran it
        // editing the amount keeps last_materialized_date
        PenzRecurringRuleResponse repriced = putForBody("/api/penz/recurring-rules/" + gym.getId(),
            ruleRequest(main.getId(), "Edzőterem", "expense", 1_400_000L, LocalDate.of(2026, 9, 10)), h,
            HttpStatus.OK, PenzRecurringRuleResponse.class);
        assertThat(repriced.getLastMaterializedDate()).isEqualTo(materialized);
        // and the written history keeps its own amounts
        assertThat(transactionRows.findAllOwned(u.id())).filteredOn(t -> gym.getId().equals(t.getRecurringRuleId()))
            .isNotEmpty().allSatisfy(t -> assertThat(t.getAmountHufMinor()).isEqualTo(1_200_000L));

        // pausing only flips active
        PenzRecurringRuleResponse paused = putForBody("/api/penz/recurring-rules/" + gym.getId(),
            ruleRequest(main.getId(), "Edzőterem", "expense", 1_400_000L, LocalDate.of(2026, 9, 10)).active(false),
            h, HttpStatus.OK, PenzRecurringRuleResponse.class);
        assertThat(paused.getActive()).isFalse();
        assertThat(paused.getLastMaterializedDate()).isEqualTo(materialized);
        // re-activating skips the paused period (last_materialized_date = yesterday)
        LocalDate today = LocalDate.now(ZoneId.of("Europe/Budapest"));
        PenzRecurringRuleResponse resumed = putForBody("/api/penz/recurring-rules/" + gym.getId(),
            ruleRequest(main.getId(), "Edzőterem", "expense", 1_400_000L, LocalDate.of(2026, 9, 10)).active(true),
            h, HttpStatus.OK, PenzRecurringRuleResponse.class);
        assertThat(resumed.getActive()).isTrue();
        assertThat(resumed.getLastMaterializedDate()).isBetween(today.minusDays(1), today);
    }

    // ---- materialize.test.ts (old src/app/materialize.ts), 1:1 ----

    private record Fixture(UUID owner, PenzAccountEntity account, PenzCategoryEntity category) {
    }

    /** The salary is in CHF, so the account is a CHF account (a rule matches its account's currency). */
    private Fixture fixture(String label) {
        UUID owner = registerUser(label).id();
        return new Fixture(owner, penz.account(owner, "Fő", "checking", "CHF", true, false),
            penz.category(owner, "Bér", "income"));
    }

    /** The old fixture's salary: 1 000.00 of a foreign currency monthly from 09-10 (CHF here), rate 400 → 400 000 Ft. */
    private PenzRecurringRuleEntity salary(Fixture f, boolean active, LocalDate start) {
        return penz.recurringRule(f.owner(), f.account().getId(), f.category().getId(), "income", 100_000L, "CHF",
            40_000_000L, "monthly", start, active);
    }

    private List<PenzTransactionEntity> rowsOf(UUID owner, UUID ruleId) {
        return transactionRows.findAllOwned(owner).stream().filter(t -> ruleId.equals(t.getRecurringRuleId()))
            .sorted(Comparator.comparing(PenzTransactionEntity::getDate)).toList();
    }

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 12);
    private static final LocalDate SEP_10 = LocalDate.of(2026, 9, 10);
    private static final LocalDate OCT_10 = LocalDate.of(2026, 10, 10);
    private static final LocalDate NOV_10 = LocalDate.of(2026, 11, 10);

    // it('creates all missing occurrences once and is idempotent')
    @Test
    void materializeCreatesAllMissingOccurrencesOnceAndIsIdempotent() {
        Fixture f = fixture("penz materialize once");
        PenzRecurringRuleEntity rule = salary(f, true, SEP_10);
        List.of(SEP_10, OCT_10, NOV_10).forEach(d -> penz.fxRate("CHF", d, "400"));

        assertThat(materializer.materializeDue(f.owner(), TODAY)).isEqualTo(3);
        List<PenzTransactionEntity> rows = rowsOf(f.owner(), rule.getId());
        assertThat(rows).extracting(PenzTransactionEntity::getDate).containsExactly(SEP_10, OCT_10, NOV_10);
        assertThat(ruleRows.findById(rule.getId()).orElseThrow().getLastMaterializedDate()).isEqualTo(NOV_10);
        assertThat(rows.getFirst()).satisfies(t -> {
            assertThat(t.getKind()).isEqualTo("income");
            assertThat(t.getAmountMinor()).isEqualTo(100_000L);
            assertThat(t.getCurrency()).isEqualTo("CHF");
            assertThat(t.getAmountHufMinor()).isEqualTo(40_000_000L);
            assertThat(t.getFxRateDate()).isEqualTo(SEP_10);
            assertThat(t.getCategoryId()).isEqualTo(f.category().getId());
            assertThat(t.getAccountId()).isEqualTo(f.account().getId());
            assertThat(t.getSource()).isEqualTo("recurring");
            assertThat(t.isNeedsReview()).isFalse();
            assertThat(t.getTransferPairId()).isNull();
        });
        assertThat(materializer.materializeDue(f.owner(), TODAY)).isZero();
        assertThat(rowsOf(f.owner(), rule.getId())).hasSize(3);
    }

    // it('skips a date that already has a txn from another tab but still advances')
    @Test
    void materializeSkipsADateThatAlreadyHasARowButStillAdvances() {
        Fixture f = fixture("penz materialize skip");
        PenzRecurringRuleEntity rule = salary(f, true, SEP_10);
        List.of(SEP_10, OCT_10, NOV_10).forEach(d -> penz.fxRate("CHF", d, "400"));
        penz.recurringTransaction(f.owner(), f.account().getId(), rule.getId(), "income", OCT_10);

        assertThat(materializer.materializeDue(f.owner(), TODAY)).isEqualTo(2);
        assertThat(rowsOf(f.owner(), rule.getId())).hasSize(3);
        assertThat(ruleRows.findById(rule.getId()).orElseThrow().getLastMaterializedDate()).isEqualTo(NOV_10);
    }

    // it('ignores inactive rules and rules with nothing due')
    @Test
    void materializeIgnoresInactiveRulesAndRulesWithNothingDue() {
        Fixture f = fixture("penz materialize idle");
        salary(f, false, SEP_10);
        salary(f, true, LocalDate.of(2026, 12, 1));
        assertThat(materializer.materializeDue(f.owner(), TODAY)).isZero();
        assertThat(transactionRows.findAllOwned(f.owner())).isEmpty();
    }

    // it('keeps partial progress when a later occurrence fails, then completes without duplicates')
    @Test
    void materializeKeepsPartialProgressWhenARateIsMissingThenCompletes() {
        Fixture f = fixture("penz materialize partial");
        PenzRecurringRuleEntity rule = salary(f, true, SEP_10);
        penz.fxRate("CHF", SEP_10, "400"); // 10-10 has no rate: provider down, nothing cached within 7 days

        assertThat(materializer.materializeDue(f.owner(), TODAY)).isEqualTo(1);
        assertThat(rowsOf(f.owner(), rule.getId())).extracting(PenzTransactionEntity::getDate).containsExactly(SEP_10);
        assertThat(ruleRows.findById(rule.getId()).orElseThrow().getLastMaterializedDate()).isNull();

        penz.fxRate("CHF", OCT_10, "400");
        penz.fxRate("CHF", NOV_10, "400");
        assertThat(materializer.materializeDue(f.owner(), TODAY)).isEqualTo(2);
        assertThat(rowsOf(f.owner(), rule.getId())).extracting(PenzTransactionEntity::getDate)
            .containsExactly(SEP_10, OCT_10, NOV_10);
    }

    // it('shares one run between overlapping callers') — the server has no shared promise: two concurrent runs
    // race on the unique (rule, date) index instead, and together write each occurrence exactly once.
    @Test
    void overlappingRunsWriteEachOccurrenceOnce() {
        Fixture f = fixture("penz materialize overlap");
        PenzRecurringRuleEntity rule = salary(f, true, SEP_10);
        List.of(SEP_10, OCT_10, NOV_10).forEach(d -> penz.fxRate("CHF", d, "400"));

        CompletableFuture<Integer> one = CompletableFuture.supplyAsync(() -> materializer.materializeDue(f.owner(), TODAY));
        CompletableFuture<Integer> two = CompletableFuture.supplyAsync(() -> materializer.materializeDue(f.owner(), TODAY));
        assertThat(one.join() + two.join()).isEqualTo(3);
        assertThat(rowsOf(f.owner(), rule.getId())).hasSize(3);
    }

    // ---- helpers ----

    private PenzAccountResponse account(HttpHeaders h, String name) {
        return postForBody("/api/penz/accounts", new PenzAccountRequest().name(name).type("checking").currency("HUF")
            .isDefault(true), h, HttpStatus.OK, PenzAccountResponse.class);
    }

    private static PenzRecurringRuleRequest ruleRequest(UUID accountId, String name, String kind, long amountMinor,
                                                        LocalDate start) {
        return new PenzRecurringRuleRequest().name(name).kind(kind).amountMinor(amountMinor).currency("HUF")
            .accountId(accountId).frequency("monthly").startDate(start);
    }

    private PenzRecurringRuleResponse rule(HttpHeaders h, UUID accountId, String name, String kind, long amountMinor,
                                           LocalDate start) {
        return postForBody("/api/penz/recurring-rules", ruleRequest(accountId, name, kind, amountMinor, start), h,
            HttpStatus.OK, PenzRecurringRuleResponse.class);
    }

    private void txn(HttpHeaders h, UUID accountId, String kind, long amountMinor, LocalDate date, String note) {
        postForBody("/api/penz/transactions", new PenzTransactionRequest().accountId(accountId).kind(kind)
            .amountMinor(amountMinor).currency("HUF").date(date).note(note), h, HttpStatus.OK,
            PenzTransactionResponse.class);
    }
}
