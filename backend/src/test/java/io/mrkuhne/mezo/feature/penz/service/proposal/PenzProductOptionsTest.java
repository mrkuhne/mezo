package io.mrkuhne.mezo.feature.penz.service.proposal;

import static io.mrkuhne.mezo.feature.penz.service.proposal.ProposalFixtures.FT;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.penz.service.portfolio.Sleeve;
import io.mrkuhne.mezo.feature.penz.service.proposal.ProductOptions.Option;
import io.mrkuhne.mezo.feature.penz.service.proposal.ProductOptions.SleeveOptions;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Options per sleeve and their computed figures (mezo-r36n9.105, build notes call 12). */
class PenzProductOptionsTest {

    @Test
    void testForSleeve_shouldOfferOnlyApprovedProductsOfThatSleeve_cheapestFirst() {
        SleeveOptions longOpts = ProductOptions.forSleeve(Sleeve.LONG, 450_000 * FT, ProposalFixtures.CATALOG);
        assertThat(longOpts.names()).containsExactly("Világ Részvény ETF", "Világ Osztalék ETF");
        assertThat(longOpts.names()).doesNotContain("Arany Trend Alap", "Kripto Kosár Alap");
        assertThat(longOpts.note()).isNull();

        SleeveOptions mid = ProductOptions.forSleeve(Sleeve.MID, 300_000 * FT, ProposalFixtures.CATALOG);
        assertThat(mid.names()).containsExactly("Euró Kötvény ETF", "Világ Részvény ETF", "Vegyes Alap Plusz");
    }

    @Test
    void testForSleeve_shouldPutAnUnknownTerLast() {
        SleeveOptions shortOpts = ProductOptions.forSleeve(Sleeve.SHORT, 250_000 * FT, ProposalFixtures.CATALOG);
        assertThat(shortOpts.names()).containsExactly("Forint Pénzpiaci Alap", "Prémium Állampapír");
        Option bond = shortOpts.options().get(1);
        assertThat(bond.yearlyCostHufMinor()).isNull();
        assertThat(bond.differs()).contains("nincs egyszerű éves díja — lásd a díjmegjegyzést");
    }

    @Test
    void testForSleeve_shouldCapAtThree() {
        List<CatalogProduct> many = List.of(ProposalFixtures.WORLD, ProposalFixtures.WORLD_DIST,
            ProposalFixtures.product("A", "equity_etf", "EUR", List.of("long"), "0.3", null, null, "accumulating",
                CatalogProduct.STATUS_APPROVED),
            ProposalFixtures.product("B", "equity_etf", "EUR", List.of("long"), "0.4", null, null, "accumulating",
                CatalogProduct.STATUS_APPROVED));
        assertThat(ProductOptions.forSleeve(Sleeve.LONG, 1_000 * FT, many).names()).hasSize(3).doesNotContain("B");
    }

    @Test
    void testYearlyCost_shouldBeAmountTimesTerRoundedTo10Ft() {
        // 450 000 Ft × 0,20% = 900 Ft
        assertThat(ProductOptions.yearlyCost(450_000 * FT, new BigDecimal("0.20"))).isEqualTo(900 * FT);
        // 123 456 Ft × 0,07% = 86,4192 Ft → 90 Ft
        assertThat(ProductOptions.yearlyCost(123_456 * FT, new BigDecimal("0.07"))).isEqualTo(90 * FT);
        // 10 000 Ft × 0,04% = 4 Ft → 0 Ft; 12 500 × 0,04% = 5 Ft → 10 Ft (HALF_UP)
        assertThat(ProductOptions.yearlyCost(10_000 * FT, new BigDecimal("0.04"))).isZero();
        assertThat(ProductOptions.yearlyCost(12_500 * FT, new BigDecimal("0.04"))).isEqualTo(10 * FT);
        assertThat(ProductOptions.yearlyCost(1_000 * FT, null)).isNull();
    }

    @Test
    void testForSleeve_shouldComputeTheDifferLines() {
        SleeveOptions mid = ProductOptions.forSleeve(Sleeve.MID, 300_000 * FT, ProposalFixtures.CATALOG);
        Option cheapest = mid.options().get(0);
        Option world = mid.options().get(1);
        Option mixed = mid.options().get(2);
        assertThat(cheapest.yearlyCostHufMinor()).isEqualTo(450 * FT);
        assertThat(cheapest.differs()).containsExactly("ebben a rekeszben ennek a legalacsonyabb az éves költsége",
            "devizában van (EUR) — az árfolyam is mozgatja a forintértékét", "kifizeti a hozamot (osztalékfizető)");
        assertThat(world.differs()).contains("évente 150 Ft-tal többe kerül, mint a legolcsóbb",
            "újrabefekteti a hozamot (felhalmozó)");
        assertThat(mixed.differs()).contains("évente 3 150 Ft-tal többe kerül, mint a legolcsóbb",
            "forintban van, nincs árfolyamkockázata", "belépéskor 1,5% egyszeri díj");
    }

    @Test
    void testForSleeve_shouldSayHonestly_whenFewerThanTwoApproved() {
        SleeveOptions one = ProductOptions.forSleeve(Sleeve.LONG, 1_000 * FT, List.of(ProposalFixtures.WORLD));
        assertThat(one.note()).isEqualTo(
            "ehhez a rekeszhez még csak 1 jóváhagyott termék van — a termékjegyzékben tudsz jóváhagyni");
        assertThat(one.options().getFirst().differs()).isEmpty();
        SleeveOptions none = ProductOptions.forSleeve(Sleeve.LONG, 1_000 * FT, List.of(ProposalFixtures.SUGGESTED));
        assertThat(none.options()).isEmpty();
        assertThat(none.note()).startsWith("ehhez a rekeszhez még nincs jóváhagyott termék");
    }
}
