package io.mrkuhne.mezo.feature.penz;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PenzProduct;
import io.mrkuhne.mezo.api.dto.PenzProductRequest;
import io.mrkuhne.mezo.api.dto.PenzProposal;
import io.mrkuhne.mezo.api.dto.PenzProposalAcceptRequest;
import io.mrkuhne.mezo.api.dto.PenzProposalAcceptSleeve;
import io.mrkuhne.mezo.api.dto.PenzProposalOption;
import io.mrkuhne.mezo.api.dto.PenzProposalRequest;
import io.mrkuhne.mezo.api.dto.PenzProposalSleeve;
import io.mrkuhne.mezo.api.dto.PenzProposalStep;
import io.mrkuhne.mezo.api.dto.PenzProposalStepRequest;
import io.mrkuhne.mezo.api.dto.PenzStrategy;
import io.mrkuhne.mezo.api.dto.PenzStrategyInput;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.penz.entity.PenzAccountEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzCategoryEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzHoldingEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzProductEntity;
import io.mrkuhne.mezo.feature.penz.service.PenzCatalogSeed;
import io.mrkuhne.mezo.feature.penz.service.PenzCatalogService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PenzPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * Boop Pénz L7 (mezo-r36n9.105): the catalog, the proposal flow and the monthly strategy over HTTP, with the scripted
 * companion fake narrating. Only approved products are ever offered or accepted; a narration with an invented figure,
 * a boundary word or another product's name falls back to the fixed copy with the figures unchanged; the split rules;
 * accept with his own numbers; supersede; the monthly proposal uses the strategy figure; owner isolation; and no
 * proposal endpoint ever writes a transaction, a holding or an investment row. Every name and figure is invented.
 */
@ActiveProfiles("companion-fake")
class PenzProposalApiIT extends ApiIntegrationTest {

    private static final long FT = 100L;
    private static final ZoneId BUDAPEST = ZoneId.of("Europe/Budapest");

    @Autowired private PenzPopulator penz;
    @Autowired private FakeCompanionLlm fakeLlm;
    @Autowired private PenzCatalogService catalogService;
    @Autowired private JdbcTemplate jdbc;

    private LocalDate today;

    @BeforeEach
    void setUp() {
        today = LocalDate.now(BUDAPEST);
        fakeLlm.scriptPenzProposal(null);
    }

    @AfterEach
    void resetScript() {
        fakeLlm.scriptPenzProposal(null);
    }

    /** The A-user world: fixed costs 300 000 Ft/month, the short sleeve holding 1 549 500 Ft, a mixed catalog. */
    private record World(RegisteredUser user, Map<String, PenzProductEntity> products) {

        UUID id(String name) {
            return products.get(name).getId();
        }
    }

    private World world(String label) {
        RegisteredUser u = registerUser(label);
        penz.settings(u.id(), 0);
        PenzAccountEntity acc = penz.account(u.id(), "Folyószámla", true);
        PenzCategoryEntity rent = penz.category(u.id(), "Lakhatás", "expense");
        penz.recurringRule(u.id(), acc.getId(), rent.getId(), "expense", 300_000 * FT, "HUF", 300_000 * FT, "monthly",
            today.withDayOfMonth(1).minusMonths(1), true);
        PenzHoldingEntity reserve = penz.holding(u.id(), "Tartalék", "cash", null, "short", "HUF", null);
        penz.investTxn(u.id(), reserve.getId(), "buy", null, 1_549_500 * FT, "HUF", 1_549_500 * FT,
            today.withDayOfMonth(1));
        List<PenzProductEntity> rows = List.of(
            penz.product(u.id(), "Teszt Pénzpiaci Alap", "money_market", "HUF", List.of("short"), "0.40",
                "accumulating", PenzProductEntity.STATUS_APPROVED),
            penz.product(u.id(), "Teszt Állampapír", "state_bond", "HUF", List.of("short"), null, "interest",
                PenzProductEntity.STATUS_APPROVED),
            penz.product(u.id(), "Teszt Kötvény ETF", "bond_etf", "EUR", List.of("mid"), "0.15", "distributing",
                PenzProductEntity.STATUS_APPROVED),
            penz.product(u.id(), "Teszt Világ ETF", "equity_etf", "EUR", List.of("mid", "long"), "0.20",
                "accumulating", PenzProductEntity.STATUS_APPROVED),
            penz.product(u.id(), "Teszt Osztalék ETF", "equity_etf", "EUR", List.of("long"), "0.22", "distributing",
                PenzProductEntity.STATUS_APPROVED),
            penz.product(u.id(), "Teszt Javasolt Alap", "mixed_fund", "HUF", List.of("long"), "0.01",
                "accumulating", PenzProductEntity.STATUS_SUGGESTED),
            penz.product(u.id(), "Teszt Elutasított Alap", "mixed_fund", "USD", List.of("long"), "0.01",
                "accumulating", PenzProductEntity.STATUS_DECLINED));
        return new World(u, rows.stream().collect(Collectors.toMap(PenzProductEntity::getName, Function.identity())));
    }

    private PenzProposal lumpSum(HttpHeaders h, long amountMinor) {
        return postForBody("/api/penz/proposals", new PenzProposalRequest().kind("lump_sum").amountHufMinor(amountMinor),
            h, HttpStatus.CREATED, PenzProposal.class);
    }

    private static PenzProposalSleeve sleeve(PenzProposal p, PenzProposalSleeve.SleeveEnum s) {
        return p.getSleeves().stream().filter(x -> x.getSleeve() == s).findFirst().orElseThrow();
    }

    private static List<String> names(PenzProposalSleeve s) {
        return s.getOptions().stream().map(PenzProposalOption::getName).toList();
    }

    private static PenzProposalAcceptSleeve pick(String sleeve, long amountMinor, UUID productId) {
        return new PenzProposalAcceptSleeve().sleeve(sleeve).amountHufMinor(amountMinor).productId(productId);
    }

    private long moneyRows(UUID owner) {
        Long n = jdbc.queryForObject("""
            select (select count(*) from penz_transaction where created_by = ?)
                 + (select count(*) from penz_invest_txn where created_by = ?)
                 + (select count(*) from penz_holding where created_by = ?)""", Long.class, owner, owner, owner);
        return n == null ? 0 : n;
    }

    // ---- the split and the options ----

    @Test
    void aProposalSplitsByTheRulesAndOffersOnlyApprovedProducts() {
        World w = world("penz proposal split");
        PenzProposal p = lumpSum(w.user().headers(), 1_000_000 * FT);

        assertThat(p.getKind()).isEqualTo(PenzProposal.KindEnum.LUMP_SUM);
        assertThat(p.getStatus()).isEqualTo(PenzProposal.StatusEnum.PROPOSED);
        assertThat(p.getAmountHufMinor()).isEqualTo(1_000_000 * FT);
        assertThat(p.getTitle()).isEqualTo("Felosztási javaslat: 1 000 000 Ft");
        assertThat(p.getSub()).isEqualTo("Rövid 250 000 Ft · Közép 300 000 Ft · Hosszú 450 000 Ft");
        assertThat(p.getNarratedBy()).isEqualTo(PenzProposal.NarratedByEnum.MODEL);
        assertThat(p.getSummary()).isEqualTo("Ez a teszt-modell összefoglalója a felosztásról.");
        assertThat(p.getRules()).hasSize(5);
        assertThat(p.getFacts()).extracting("value", "label").contains(
            org.assertj.core.groups.Tuple.tuple("1 800 000", "a tartalék célja"),
            org.assertj.core.groups.Tuple.tuple("250 500", "a tartalékból hiányzik"));
        assertThat(p.getPlan()).isEmpty();

        // emergency shortfall first (250 500 → 250 000), then 40 / 60, 1 000 Ft rounding
        PenzProposalSleeve shortS = sleeve(p, PenzProposalSleeve.SleeveEnum.SHORT);
        PenzProposalSleeve mid = sleeve(p, PenzProposalSleeve.SleeveEnum.MID);
        PenzProposalSleeve longS = sleeve(p, PenzProposalSleeve.SleeveEnum.LONG);
        assertThat(shortS.getAmountHufMinor()).isEqualTo(250_000 * FT);
        assertThat(mid.getAmountHufMinor()).isEqualTo(300_000 * FT);
        assertThat(longS.getAmountHufMinor()).isEqualTo(450_000 * FT);
        assertThat(longS.getSharePct()).isEqualByComparingTo("45.0");
        assertThat(longS.getLabel()).isEqualTo("10+ év");

        // only approved products of that sleeve, cheapest first; never the suggested or declined one
        assertThat(names(shortS)).containsExactly("Teszt Pénzpiaci Alap", "Teszt Állampapír");
        assertThat(names(mid)).containsExactly("Teszt Kötvény ETF", "Teszt Világ ETF");
        assertThat(names(longS)).containsExactly("Teszt Világ ETF", "Teszt Osztalék ETF");
        p.getSleeves().forEach(s -> assertThat(names(s)).doesNotContain("Teszt Javasolt Alap",
            "Teszt Elutasított Alap"));
        PenzProposalOption world = longS.getOptions().getFirst();
        assertThat(world.getYearlyCostHufMinor()).isEqualTo(900 * FT);
        assertThat(world.getReviewedAt()).isEqualTo(today.minusDays(30));
        assertThat(world.getDiffers()).contains("ebben a rekeszben ennek a legalacsonyabb az éves költsége");
        assertThat(longS.getOptionsNote()).isNull();

        // the prompt handed the model the figures and only the offered names
        assertThat(fakeLlm.lastPenzProposalUserMessage()).contains("- Az összeg: 1 000 000 Ft", "Teszt Világ ETF")
            .doesNotContain("Teszt Javasolt Alap", "Teszt Elutasított Alap");

        // round trip
        assertThat(getForBody("/api/penz/proposals/" + p.getId(), w.user().headers(), HttpStatus.OK,
            PenzProposal.class)).usingRecursiveComparison().ignoringFields("createdAt").isEqualTo(p);
    }

    @Test
    void anApprovalChangesWhatTheNextProposalOffers() {
        World w = world("penz proposal approve");
        HttpHeaders h = w.user().headers();
        postForBody("/api/penz/catalog/" + w.id("Teszt Javasolt Alap") + "/approve", null, h, HttpStatus.OK,
            PenzProduct.class);
        postForBody("/api/penz/catalog/" + w.id("Teszt Világ ETF") + "/decline", null, h, HttpStatus.OK,
            PenzProduct.class);
        PenzProposal p = lumpSum(h, 1_000_000 * FT);
        assertThat(names(sleeve(p, PenzProposalSleeve.SleeveEnum.LONG)))
            .containsExactly("Teszt Javasolt Alap", "Teszt Osztalék ETF");
        assertThat(names(sleeve(p, PenzProposalSleeve.SleeveEnum.MID))).containsExactly("Teszt Kötvény ETF");
        assertThat(sleeve(p, PenzProposalSleeve.SleeveEnum.MID).getOptionsNote()).isEqualTo(
            "ehhez a rekeszhez még csak 1 jóváhagyott termék van — a termékjegyzékben tudsz jóváhagyni");
    }

    // ---- the validator falls back ----

    @Test
    void aNarrationThatBreaksARuleFallsBackWithTheFiguresUnchanged() {
        World w = world("penz proposal fallback");
        HttpHeaders h = w.user().headers();
        PenzProposal clean = lumpSum(h, 1_000_000 * FT);
        assertThat(clean.getNarratedBy()).isEqualTo(PenzProposal.NarratedByEnum.MODEL);

        Map<String, String> breaks = Map.of(
            "suggested product", "A hosszú rekeszbe a Teszt Javasolt Alap illene.",
            "invented figure", "Ide 260 000 Ft kerül.",
            "sell", "A régi alapodat add el, és ezt tedd helyette.",
            "return promise", "Ez garantált hozamot ad.",
            "another sleeve's product", "Ide a Teszt Kötvény ETF a jó választás.",
            "declined product", "A Teszt Elutasított Alap olcsóbb lenne.");
        for (Map.Entry<String, String> e : breaks.entrySet()) {
            fakeLlm.scriptPenzProposal(answer(e.getValue()));
            PenzProposal p = lumpSum(h, 1_000_000 * FT);
            assertThat(p.getNarratedBy()).as(e.getKey()).isEqualTo(PenzProposal.NarratedByEnum.FALLBACK);
            assertThat(p.getSummary()).as(e.getKey()).startsWith("A *1 000 000 Ft* felosztása");
            assertThat(sleeve(p, PenzProposalSleeve.SleeveEnum.LONG).getWhy()).as(e.getKey()).contains("60%");
            assertThat(p.getSleeves()).as(e.getKey()).extracting(PenzProposalSleeve::getAmountHufMinor)
                .containsExactly(250_000 * FT, 300_000 * FT, 450_000 * FT);
            assertThat(p.getSleeves()).as(e.getKey()).extracting(PenzProposalSleeve::getOptions)
                .usingRecursiveComparison().isEqualTo(clean.getSleeves().stream().map(PenzProposalSleeve::getOptions)
                    .toList());
        }
        // a model that failed (blank) or answered garbage → the same fixed copy
        fakeLlm.scriptPenzProposal("");
        assertThat(lumpSum(h, 1_000_000 * FT).getNarratedBy()).isEqualTo(PenzProposal.NarratedByEnum.FALLBACK);
        fakeLlm.scriptPenzProposal("nem json");
        assertThat(lumpSum(h, 1_000_000 * FT).getNarratedBy()).isEqualTo(PenzProposal.NarratedByEnum.FALLBACK);
    }

    /** A valid answer whose short "why" is {@code shortWhy}. */
    private static String answer(String shortWhy) {
        return """
            {"summary":"A felosztás három rekeszbe kerül.","sleeves":[{"sleeve":"short","why":"%s"},\
            {"sleeve":"mid","why":"A középtávú rekesz indoklása."},{"sleeve":"long","why":"A hosszú rekesz \
            indoklása."}],"uncertainty":"A terveidet nem ismerem."}""".formatted(shortWhy);
    }

    // ---- accept, steps, dismiss, supersede ----

    @Test
    void acceptTakesHisNumbersAndOnlyOfferedApprovedProducts() {
        World w = world("penz proposal accept");
        HttpHeaders h = w.user().headers();
        PenzProposal p = lumpSum(h, 1_000_000 * FT);
        String accept = "/api/penz/proposals/" + p.getId() + "/accept";

        // a suggested product, another sleeve's option, no product for an amount → not approved
        assertHasRequestError(postForBody(accept, new PenzProposalAcceptRequest().sleeves(List.of(
            pick("long", 100_000 * FT, w.id("Teszt Javasolt Alap")))), h, HttpStatus.CONFLICT, String.class),
            "PENZ_PRODUCT_NOT_APPROVED");
        assertHasRequestError(postForBody(accept, new PenzProposalAcceptRequest().sleeves(List.of(
            pick("short", 100_000 * FT, w.id("Teszt Kötvény ETF")))), h, HttpStatus.CONFLICT, String.class),
            "PENZ_PRODUCT_NOT_APPROVED");
        assertHasRequestError(postForBody(accept, new PenzProposalAcceptRequest().sleeves(List.of(
            pick("mid", 100_000 * FT, null))), h, HttpStatus.CONFLICT, String.class), "PENZ_PRODUCT_NOT_APPROVED");
        // offered, but declined since → re-checked now
        postForBody("/api/penz/catalog/" + w.id("Teszt Osztalék ETF") + "/decline", null, h, HttpStatus.OK,
            PenzProduct.class);
        assertHasRequestError(postForBody(accept, new PenzProposalAcceptRequest().sleeves(List.of(
            pick("long", 100_000 * FT, w.id("Teszt Osztalék ETF")))), h, HttpStatus.CONFLICT, String.class),
            "PENZ_PRODUCT_NOT_APPROVED");
        // nothing to buy, a sleeve twice
        assertHasRequestError(postForBody(accept, new PenzProposalAcceptRequest().sleeves(List.of(
            pick("long", 0, null), pick("mid", 0, null))), h, HttpStatus.BAD_REQUEST, String.class),
            "PENZ_PROPOSAL_AMOUNT_INVALID");
        assertHasFieldError(postForBody(accept, new PenzProposalAcceptRequest().sleeves(List.of(
            pick("long", 1_000 * FT, w.id("Teszt Világ ETF")), pick("long", 1_000 * FT, w.id("Teszt Világ ETF")))),
            h, HttpStatus.BAD_REQUEST, String.class), "sleeves", "VALIDATION_INVALID_VALUE");

        // his own numbers: more short, nothing mid, the long rest
        PenzProposal accepted = postForBody(accept, new PenzProposalAcceptRequest().sleeves(List.of(
            pick("short", 200_000 * FT, w.id("Teszt Pénzpiaci Alap")), pick("mid", 0, null),
            pick("long", 512_345 * FT, w.id("Teszt Világ ETF")))), h, HttpStatus.OK, PenzProposal.class);
        assertThat(accepted.getStatus()).isEqualTo(PenzProposal.StatusEnum.ACCEPTED);
        assertThat(accepted.getAcceptedAt()).isNotNull();
        assertThat(accepted.getAmountHufMinor()).isEqualTo(1_000_000 * FT);
        assertThat(accepted.getPlan()).extracting(PenzProposalStep::getIndex, PenzProposalStep::getSleeve,
            PenzProposalStep::getProductName, PenzProposalStep::getAmountHufMinor, PenzProposalStep::getDone)
            .containsExactly(
                org.assertj.core.groups.Tuple.tuple(0, PenzProposalStep.SleeveEnum.SHORT, "Teszt Pénzpiaci Alap",
                    200_000 * FT, false),
                org.assertj.core.groups.Tuple.tuple(1, PenzProposalStep.SleeveEnum.LONG, "Teszt Világ ETF",
                    512_345 * FT, false));

        // ticking: done / undone; nothing else
        PenzProposal ticked = postForBody("/api/penz/proposals/" + p.getId() + "/steps/1",
            new PenzProposalStepRequest().done(true), h, HttpStatus.OK, PenzProposal.class);
        assertThat(ticked.getPlan().get(1).getDone()).isTrue();
        assertThat(ticked.getPlan().get(1).getDoneAt()).isNotNull();
        assertThat(ticked.getPlan().get(0).getDone()).isFalse();
        PenzProposal unticked = postForBody("/api/penz/proposals/" + p.getId() + "/steps/1",
            new PenzProposalStepRequest().done(false), h, HttpStatus.OK, PenzProposal.class);
        assertThat(unticked.getPlan().get(1).getDone()).isFalse();
        assertThat(unticked.getPlan().get(1).getDoneAt()).isNull();
        assertHasRequestError(postForBody("/api/penz/proposals/" + p.getId() + "/steps/5",
            new PenzProposalStepRequest().done(true), h, HttpStatus.NOT_FOUND, String.class),
            "PENZ_PROPOSAL_NOT_FOUND");

        // accepted: no second accept, no dismiss
        assertHasRequestError(postForBody(accept, new PenzProposalAcceptRequest().sleeves(List.of(
            pick("short", 1_000 * FT, w.id("Teszt Pénzpiaci Alap")))), h, HttpStatus.CONFLICT, String.class),
            "PENZ_PROPOSAL_STATE");
        assertHasRequestError(postForBody("/api/penz/proposals/" + p.getId() + "/dismiss", null, h,
            HttpStatus.CONFLICT, String.class), "PENZ_PROPOSAL_STATE");
    }

    @Test
    void aNewerProposalOfTheSameKindSupersedesAnUnacceptedOne() {
        World w = world("penz proposal supersede");
        HttpHeaders h = w.user().headers();
        PenzProposal first = lumpSum(h, 400_000 * FT);
        PenzProposal second = lumpSum(h, 500_000 * FT);
        assertThat(getForBody("/api/penz/proposals/" + first.getId(), h, HttpStatus.OK, PenzProposal.class)
            .getStatus()).isEqualTo(PenzProposal.StatusEnum.SUPERSEDED);
        assertHasRequestError(postForBody("/api/penz/proposals/" + first.getId() + "/accept",
            new PenzProposalAcceptRequest().sleeves(List.of(pick("long", 1_000 * FT, w.id("Teszt Világ ETF")))), h,
            HttpStatus.CONFLICT, String.class), "PENZ_PROPOSAL_STATE");
        assertHasRequestError(postForBody("/api/penz/proposals/" + first.getId() + "/steps/0",
            new PenzProposalStepRequest().done(true), h, HttpStatus.CONFLICT, String.class), "PENZ_PROPOSAL_STATE");

        // an accepted one is never superseded
        postForBody("/api/penz/proposals/" + second.getId() + "/accept", new PenzProposalAcceptRequest().sleeves(
            List.of(pick("long", 500_000 * FT, w.id("Teszt Világ ETF")))), h, HttpStatus.OK, PenzProposal.class);
        PenzProposal third = lumpSum(h, 600_000 * FT);
        assertThat(getForBody("/api/penz/proposals/" + second.getId(), h, HttpStatus.OK, PenzProposal.class)
            .getStatus()).isEqualTo(PenzProposal.StatusEnum.ACCEPTED);

        // dismiss
        PenzProposal dismissed = postForBody("/api/penz/proposals/" + third.getId() + "/dismiss", null, h,
            HttpStatus.OK, PenzProposal.class);
        assertThat(dismissed.getStatus()).isEqualTo(PenzProposal.StatusEnum.DISMISSED);
        assertHasRequestError(postForBody("/api/penz/proposals/" + third.getId() + "/dismiss", null, h,
            HttpStatus.CONFLICT, String.class), "PENZ_PROPOSAL_STATE");

        assertThat(getForList("/api/penz/proposals", h, HttpStatus.OK, PenzProposal.class))
            .extracting(PenzProposal::getId).containsExactly(third.getId(), second.getId(), first.getId());
        assertThat(getForList("/api/penz/proposals?status=superseded", h, HttpStatus.OK, PenzProposal.class))
            .extracting(PenzProposal::getId).containsExactly(first.getId());
    }

    @Test
    void anAmountBelow1000FtOrMissingIsRefused() {
        World w = world("penz proposal amount");
        HttpHeaders h = w.user().headers();
        assertHasRequestError(postForBody("/api/penz/proposals", new PenzProposalRequest().kind("lump_sum"), h,
            HttpStatus.BAD_REQUEST, String.class), "PENZ_PROPOSAL_AMOUNT_INVALID");
        assertHasRequestError(postForBody("/api/penz/proposals", new PenzProposalRequest().kind("lump_sum")
            .amountHufMinor(999 * FT), h, HttpStatus.BAD_REQUEST, String.class), "PENZ_PROPOSAL_AMOUNT_INVALID");
        postForBody("/api/penz/proposals", new PenzProposalRequest().kind("weekly").amountHufMinor(1_000 * FT), h,
            HttpStatus.BAD_REQUEST, String.class);
    }

    // ---- the monthly strategy ----

    @Test
    void theMonthlyProposalUsesTheStrategyFigure() {
        RegisteredUser u = registerUser("penz strategy");
        HttpHeaders h = u.headers();
        penz.settings(u.id(), 0);
        PenzAccountEntity acc = penz.account(u.id(), "Folyószámla", true);
        LocalDate prev = today.withDayOfMonth(1).minusMonths(1);
        penz.hufTransaction(u.id(), acc.getId(), "expense", 100_000 * FT, prev);
        penz.hufTransaction(u.id(), acc.getId(), "income", 500_000 * FT, prev.plusDays(4));
        penz.hufTransaction(u.id(), acc.getId(), "income", 500_000 * FT, today.withDayOfMonth(1));
        penz.product(u.id(), "Teszt Világ ETF", "equity_etf", "EUR", List.of("mid", "long"), "0.20", "accumulating",
            PenzProductEntity.STATUS_APPROVED);

        // avg income 500 000 − avg expenses 100 000 − savings 0 = 400 000; free before invest 500 000 − 20 000
        // practice = 480 000; min = 400 000; no emergency target (no fixed costs) → 25 % = 100 000 Ft
        PenzStrategy s = getForBody("/api/penz/strategy", h, HttpStatus.OK, PenzStrategy.class);
        assertThat(s.getAvailableHufMinor()).isEqualTo(100_000 * FT);
        Map<String, Long> inputs = s.getInputs().stream()
            .collect(Collectors.toMap(PenzStrategyInput::getKey, PenzStrategyInput::getHufMinor));
        assertThat(inputs).containsEntry("avgIncome", 500_000 * FT).containsEntry("avgExpenses", 100_000 * FT)
            .containsEntry("freeBeforeInvest", 480_000 * FT).containsEntry("emergencyTarget", 0L)
            .containsEntry("pullForward", 0L);
        assertThat(s.getNote()).contains("25%", "még nincs meg");
        assertThat(s.getCurrent()).isNull();

        PenzProposal monthly = postForBody("/api/penz/proposals", new PenzProposalRequest().kind("monthly"), h,
            HttpStatus.CREATED, PenzProposal.class);
        assertThat(monthly.getKind()).isEqualTo(PenzProposal.KindEnum.MONTHLY);
        assertThat(monthly.getAmountHufMinor()).isEqualTo(100_000 * FT);
        assertThat(monthly.getTitle()).isEqualTo("Havi stratégia: 100 000 Ft");
        assertThat(monthly.getSleeves()).extracting(PenzProposalSleeve::getAmountHufMinor)
            .containsExactly(0L, 40_000 * FT, 60_000 * FT);
        assertThat(getForBody("/api/penz/strategy", h, HttpStatus.OK, PenzStrategy.class).getCurrent().getId())
            .isEqualTo(monthly.getId());

        // a lump sum does not supersede the monthly one (different kinds)
        lumpSum(h, 50_000 * FT);
        assertThat(getForBody("/api/penz/proposals/" + monthly.getId(), h, HttpStatus.OK, PenzProposal.class)
            .getStatus()).isEqualTo(PenzProposal.StatusEnum.PROPOSED);
    }

    @Test
    void theMonthlyProposalIsRefused_whenThereIsNoFigure() {
        RegisteredUser u = registerUser("penz strategy empty");
        PenzStrategy s = getForBody("/api/penz/strategy?date=" + today, u.headers(), HttpStatus.OK,
            PenzStrategy.class);
        assertThat(s.getAvailableHufMinor()).isZero();
        assertThat(s.getNote()).startsWith("Még nincs egy teljes");
        assertHasRequestError(postForBody("/api/penz/proposals", new PenzProposalRequest().kind("monthly"),
            u.headers(), HttpStatus.BAD_REQUEST, String.class), "PENZ_PROPOSAL_AMOUNT_INVALID");
    }

    // ---- the catalog ----

    @Test
    void theCatalogListsApprovesDeclinesAndTakesHisOwnProducts() {
        World w = world("penz catalog");
        HttpHeaders h = w.user().headers();
        List<PenzProduct> list = getForList("/api/penz/catalog", h, HttpStatus.OK, PenzProduct.class);
        assertThat(list).extracting(PenzProduct::getStatus).containsExactly(
            PenzProduct.StatusEnum.APPROVED, PenzProduct.StatusEnum.APPROVED, PenzProduct.StatusEnum.APPROVED,
            PenzProduct.StatusEnum.APPROVED, PenzProduct.StatusEnum.APPROVED, PenzProduct.StatusEnum.SUGGESTED,
            PenzProduct.StatusEnum.DECLINED);

        PenzProduct mine = postForBody("/api/penz/catalog", new PenzProductRequest().name("  Saját Alap ")
            .kind("mixed_fund").currency("HUF").sleeves(List.of("long", "mid", "long")).whatItIs("Egy saját alap.")
            .terPct(new BigDecimal("0.5")).distribution("accumulating").sourceUrl("https://pelda.example/sajat"),
            h, HttpStatus.CREATED, PenzProduct.class);
        assertThat(mine.getName()).isEqualTo("Saját Alap");
        assertThat(mine.getStatus()).isEqualTo(PenzProduct.StatusEnum.APPROVED);
        assertThat(mine.getSuggestedBy()).isEqualTo(PenzProduct.SuggestedByEnum.OWNER);
        assertThat(mine.getSleeves()).containsExactly(PenzProduct.SleevesEnum.MID, PenzProduct.SleevesEnum.LONG);
        assertThat(mine.getReviewedAt()).isEqualTo(today);
        assertThat(mine.getApprovedAt()).isNotNull();

        UUID suggested = w.id("Teszt Javasolt Alap");
        PenzProduct edited = putForBody("/api/penz/catalog/" + suggested, new PenzProductRequest()
            .name("Teszt Javasolt Alap").kind("mixed_fund").currency("HUF").sleeves(List.of("long"))
            .whatItIs("Új leírás.").terPct(new BigDecimal("0.03")).distribution("accumulating"), h, HttpStatus.OK,
            PenzProduct.class);
        assertThat(edited.getReviewedAt()).isEqualTo(today);
        assertThat(edited.getStatus()).isEqualTo(PenzProduct.StatusEnum.SUGGESTED);
        assertThat(edited.getTerPct()).isEqualByComparingTo("0.03");

        PenzProduct approved = postForBody("/api/penz/catalog/" + suggested + "/approve", null, h, HttpStatus.OK,
            PenzProduct.class);
        assertThat(approved.getStatus()).isEqualTo(PenzProduct.StatusEnum.APPROVED);
        assertThat(postForBody("/api/penz/catalog/" + suggested + "/approve", null, h, HttpStatus.OK,
            PenzProduct.class).getApprovedAt()).isEqualTo(approved.getApprovedAt());
        PenzProduct declined = postForBody("/api/penz/catalog/" + suggested + "/decline", null, h, HttpStatus.OK,
            PenzProduct.class);
        assertThat(declined.getStatus()).isEqualTo(PenzProduct.StatusEnum.DECLINED);
        assertThat(declined.getApprovedAt()).isNull();

        assertHasRequestError(postForBody("/api/penz/catalog/" + UUID.randomUUID() + "/approve", null, h,
            HttpStatus.NOT_FOUND, String.class), "PENZ_PRODUCT_NOT_FOUND");
        postForBody("/api/penz/catalog", new PenzProductRequest().name("Rossz").kind("crypto").currency("HUF")
            .sleeves(List.of("long")).whatItIs("x").distribution("accumulating"), h, HttpStatus.BAD_REQUEST,
            String.class);
    }

    @Test
    void aResearchSeedIsInsertedOncePerOwner() {
        RegisteredUser u = registerUser("penz catalog seed");
        PenzCatalogSeed.Seed seed = new PenzCatalogSeed.Seed("teszt-seed-1", "Kutatott Teszt Alap", "bond_etf", "EUR",
            List.of("mid"), "Kitalált kutatott termék.", new BigDecimal("0.1"), null, null, "accumulating", null,
            null, "Teszt forrás", "https://pelda.example/seed", today.minusDays(3));
        assertThat(catalogService.seed(u.id(), List.of(seed))).isEqualTo(1);
        assertThat(catalogService.seed(u.id(), List.of(seed))).isZero();
        List<PenzProduct> list = getForList("/api/penz/catalog", u.headers(), HttpStatus.OK, PenzProduct.class);
        assertThat(list).singleElement().satisfies(p -> {
            assertThat(p.getStatus()).isEqualTo(PenzProduct.StatusEnum.SUGGESTED);
            assertThat(p.getSuggestedBy()).isEqualTo(PenzProduct.SuggestedByEnum.RESEARCH);
            assertThat(p.getReviewedAt()).isEqualTo(today.minusDays(3));
            assertThat(p.getSourceUrl()).isEqualTo("https://pelda.example/seed");
        });
        // declined stays declined: the seed never comes back
        postForBody("/api/penz/catalog/" + list.getFirst().getId() + "/decline", null, u.headers(), HttpStatus.OK,
            PenzProduct.class);
        assertThat(catalogService.seed(u.id(), List.of(seed))).isZero();
        // another owner gets his own copy
        RegisteredUser other = registerUser("penz catalog seed other");
        assertThat(catalogService.seed(other.id(), List.of(seed))).isEqualTo(1);
    }

    // ---- isolation and "never moves money" ----

    @Test
    void proposalsAndProductsStayPrivate() {
        World a = world("penz proposal owner a");
        RegisteredUser b = registerUser("penz proposal owner b");
        PenzProposal p = lumpSum(a.user().headers(), 1_000_000 * FT);

        assertThat(getForList("/api/penz/proposals", b.headers(), HttpStatus.OK, PenzProposal.class)).isEmpty();
        assertThat(getForList("/api/penz/catalog", b.headers(), HttpStatus.OK, PenzProduct.class)).isEmpty();
        assertHasRequestError(getForBody("/api/penz/proposals/" + p.getId(), b.headers(), HttpStatus.NOT_FOUND,
            String.class), "PENZ_PROPOSAL_NOT_FOUND");
        assertHasRequestError(postForBody("/api/penz/proposals/" + p.getId() + "/accept",
            new PenzProposalAcceptRequest().sleeves(List.of(pick("long", 1_000 * FT, a.id("Teszt Világ ETF")))),
            b.headers(), HttpStatus.NOT_FOUND, String.class), "PENZ_PROPOSAL_NOT_FOUND");
        assertHasRequestError(postForBody("/api/penz/proposals/" + p.getId() + "/dismiss", null, b.headers(),
            HttpStatus.NOT_FOUND, String.class), "PENZ_PROPOSAL_NOT_FOUND");
        assertHasRequestError(postForBody("/api/penz/catalog/" + a.id("Teszt Világ ETF") + "/decline", null,
            b.headers(), HttpStatus.NOT_FOUND, String.class), "PENZ_PRODUCT_NOT_FOUND");

        // B's proposal never offers A's products
        PenzProposal mine = lumpSum(b.headers(), 100_000 * FT);
        mine.getSleeves().forEach(s -> {
            assertThat(s.getOptions()).isEmpty();
            assertThat(s.getOptionsNote()).startsWith("ehhez a rekeszhez még nincs jóváhagyott termék");
        });
        assertThat(getForBody("/api/penz/proposals/" + p.getId(), a.user().headers(), HttpStatus.OK,
            PenzProposal.class).getStatus()).isEqualTo(PenzProposal.StatusEnum.PROPOSED);
    }

    @Test
    void noProposalEndpointEverMovesMoney() {
        World w = world("penz proposal no money");
        HttpHeaders h = w.user().headers();
        long before = moneyRows(w.user().id());

        PenzProposal p = lumpSum(h, 1_000_000 * FT);
        getForBody("/api/penz/strategy", h, HttpStatus.OK, PenzStrategy.class);
        PenzProposal accepted = postForBody("/api/penz/proposals/" + p.getId() + "/accept",
            new PenzProposalAcceptRequest().sleeves(List.of(pick("short", 250_000 * FT, w.id("Teszt Állampapír")),
                pick("long", 750_000 * FT, w.id("Teszt Osztalék ETF")))), h, HttpStatus.OK, PenzProposal.class);
        for (int i = 0; i < accepted.getPlan().size(); i++) {
            postForBody("/api/penz/proposals/" + p.getId() + "/steps/" + i, new PenzProposalStepRequest().done(true),
                h, HttpStatus.OK, PenzProposal.class);
        }
        PenzProposal other = lumpSum(h, 200_000 * FT);
        postForBody("/api/penz/proposals/" + other.getId() + "/dismiss", null, h, HttpStatus.OK, PenzProposal.class);

        assertThat(moneyRows(w.user().id())).isEqualTo(before);
    }
}
