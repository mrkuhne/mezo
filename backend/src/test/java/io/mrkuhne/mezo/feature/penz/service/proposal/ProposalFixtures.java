package io.mrkuhne.mezo.feature.penz.service.proposal;

import io.mrkuhne.mezo.feature.penz.service.portfolio.Sleeve;
import io.mrkuhne.mezo.feature.penz.service.proposal.ProposalSplitter.Split;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Invented catalog products and a ready proposal for the pure proposal tests (mezo-r36n9.105). */
final class ProposalFixtures {

    static final long FT = 100L;
    static final LocalDate REVIEWED = LocalDate.of(2026, 11, 18);

    static final CatalogProduct BOND = product("Prémium Állampapír", "state_bond", "HUF", List.of("short"), null,
        null, "kamat a hivatalos feltételek szerint", "interest", CatalogProduct.STATUS_APPROVED);
    static final CatalogProduct MONEY = product("Forint Pénzpiaci Alap", "money_market", "HUF", List.of("short"),
        "0.40", null, null, "accumulating", CatalogProduct.STATUS_APPROVED);
    static final CatalogProduct BOND_ETF = product("Euró Kötvény ETF", "bond_etf", "EUR", List.of("mid"), "0.15",
        null, null, "distributing", CatalogProduct.STATUS_APPROVED);
    static final CatalogProduct MIXED = product("Vegyes Alap Plusz", "mixed_fund", "HUF", List.of("mid"), "1.20",
        "1.5", null, "accumulating", CatalogProduct.STATUS_APPROVED);
    static final CatalogProduct WORLD = product("Világ Részvény ETF", "equity_etf", "EUR", List.of("mid", "long"),
        "0.20", null, null, "accumulating", CatalogProduct.STATUS_APPROVED);
    static final CatalogProduct WORLD_DIST = product("Világ Osztalék ETF", "equity_etf", "EUR", List.of("long"),
        "0.22", null, null, "distributing", CatalogProduct.STATUS_APPROVED);
    static final CatalogProduct SUGGESTED = product("Arany Trend Alap", "mixed_fund", "HUF", List.of("long"), "0.05",
        null, null, "accumulating", CatalogProduct.STATUS_SUGGESTED);
    static final CatalogProduct DECLINED = product("Kripto Kosár Alap", "mixed_fund", "USD", List.of("long"), "0.01",
        null, null, "accumulating", CatalogProduct.STATUS_DECLINED);

    static final List<CatalogProduct> CATALOG = List.of(BOND, MONEY, BOND_ETF, MIXED, WORLD, WORLD_DIST, SUGGESTED,
        DECLINED);

    private ProposalFixtures() {
    }

    static CatalogProduct product(String name, String kind, String currency, List<String> sleeves, String ter,
                                  String entry, String feeNote, String distribution, String status) {
        return new CatalogProduct(UUID.randomUUID(), name, "Leírás: " + name, kind, currency, sleeves,
            ter == null ? null : new BigDecimal(ter), entry == null ? null : new BigDecimal(entry), feeNote,
            distribution, REVIEWED, status, null, null);
    }

    /** A product with a ticker and an ISIN (the seed's real-looking shape). */
    static CatalogProduct listed(String name, String kind, List<String> sleeves, String ter, String isin,
                                 String symbol, String status) {
        return new CatalogProduct(UUID.randomUUID(), name, "Leírás: " + name, kind, "EUR", sleeves,
            new BigDecimal(ter), null, null, "accumulating", REVIEWED, status, isin, symbol);
    }

    /** 1 000 000 Ft; target 6 × 300 000; short holds 1 549 500 → 250 000 short, 300 000 mid, 450 000 long. */
    static Split split() {
        return ProposalSplitter.split(1_000_000 * FT, 6, 300_000 * FT, 1_549_500 * FT);
    }

    static ProposalFigures figures(Split split, List<CatalogProduct> catalog) {
        List<ProductOptions.SleeveOptions> sleeves = new ArrayList<>();
        for (Sleeve s : Sleeve.values()) {
            sleeves.add(ProductOptions.forSleeve(s, split.amount(s), catalog));
        }
        return new ProposalFigures(split, sleeves);
    }

    static ProposalFigures figures() {
        return figures(split(), CATALOG);
    }


}
