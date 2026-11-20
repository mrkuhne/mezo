package io.mrkuhne.mezo.feature.penz.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * The researched product list every owner's catalog is seeded from (Boop Pénz L7, mezo-r36n9.105, build notes call
 * 10) — code, reviewed like code, because every figure here is something Boop may print about a product. Each row is
 * inserted once per owner and {@link Seed#key} ({@code penz_product.seed_key}) as {@code suggested} /
 * {@code research}; the owner approves or declines it with one tap. Adding a row later seeds it for every owner on
 * their next catalog read; changing a row's figures does NOT touch rows already seeded (his copy is his).
 *
 * <p>Every seed carries the fee figures, the source they were read from and {@code reviewedAt} = the date they were
 * checked against that source. State-bond Treasury fees are left null: the MÁK fee notice was not confirmed against an official source, and the fee note says so.
 */
public final class PenzCatalogSeed {

    /**
     * One researched product.
     *
     * @param key        stable identity of the seed (never reused), e.g. {@code pmap-2026}
     * @param sleeves    ⊆ short|mid|long
     * @param terPct     yearly running cost percent, null when not applicable / unknown
     * @param reviewedAt when the figures were checked against {@code sourceUrl}
     */
    public record Seed(String key, String name, String kind, String currency, List<String> sleeves, String whatItIs,
                       BigDecimal terPct, BigDecimal entryFeePct, String feeNote, String distribution, String isin,
                       String symbol, String sourceName, String sourceUrl, LocalDate reviewedAt) {

        public Seed {
            sleeves = List.copyOf(sleeves);
        }
    }

    /** The researched list, checked 2026-11-20 (ETF running costs from justETF, bonds from the ÁKK offer documents). */
    public static final List<Seed> SEEDS = List.of(
            new Seed("fixmap-2029q2", "Fix Magyar Állampapír 2029/Q2", "state_bond", "HUF", List.of("short"),
                    "A magyar állam forintos, hároméves lakossági állampapírja: a kamata a teljes futamidő alatt rögzített, és negyedévente fizet kamatot.",
                    null, null, "Fix 5,50% éves kamat, negyedéves kamatfizetés; lejárat 2029. október 25. A kincstári díjakat a MÁK hirdetménye írja le — még nem ellenőriztem.", "interest", "HU0000407697", null, "ÁKK nyilvános ajánlattétel (2026.09.25.)",
                    "https://www.otpbank.hu/static/portal/sw/file/FIXMAP_2029Q2_nyilvanos.pdf", LocalDate.of(2026, 11, 20)),
            new Seed("mapplusz-2031m6", "Magyar Állampapír Plusz 2031/M6", "state_bond", "HUF", List.of("short", "mid"),
                    "Ötéves, forintos lakossági állampapír: a kamata előre rögzített és évről évre lépcsőzetesen emelkedik, az évente járó kamatot az állam újabb ugyanilyen papírként írja jóvá.",
                    null, null, "Évről évre emelkedő fix kamat (5,00%-tól 6,00%-ig); lejárat 2031. november 27. A kincstári díjakat a MÁK hirdetménye írja le — még nem ellenőriztem.", "interest", "HU0000407689", null, "ÁKK nyilvános ajánlattétel (2026.09.25.)",
                    "https://www.otpbank.hu/static/portal/sw/file/MAPP_2031M6_nyilvanos.pdf", LocalDate.of(2026, 11, 20)),
            new Seed("pmap-2036i1", "Prémium Magyar Állampapír 2036/I1", "state_bond", "HUF", List.of("short", "mid"),
                    "Inflációhoz kötött, forintos lakossági állampapír: az éves kamata az előző év átlagos inflációja plusz egy kis rögzített felár, így évről évre változik.",
                    null, null, "Kamat: az előző évi átlagos infláció + 0,10%, évente február 21-én; lejárat 2036. február 21. A kincstári díjakat a MÁK hirdetménye írja le — még nem ellenőriztem.", "interest", "HU0000407671", null, "ÁKK nyilvános ajánlattétel (2026.07.13.)",
                    "https://www.otpbank.hu/static/portal/sw/file/PMAP_2036I1_nyilvanos.pdf", LocalDate.of(2026, 11, 20)),
            new Seed("ishares-global-agg-eurh", "iShares Core Global Aggregate Bond UCITS ETF EUR Hedged (Acc)", "bond_etf", "EUR", List.of("mid"),
                    "Tőzsdén kereskedett alap, amely a világ állami és vállalati kötvényeit követi; a devizakockázatot euróra fedezi, a kamatbevételt visszaforgatja.",
                    new BigDecimal("0.10"), null, "Euróra fedezett.", "accumulating", "IE00BDBRDM35", "EUNA.DE", "justETF",
                    "https://www.justetf.com/en/etf-profile.html?isin=IE00BDBRDM35", LocalDate.of(2026, 11, 20)),
            new Seed("vanguard-global-agg-eurh", "Vanguard Global Aggregate Bond UCITS ETF EUR Hedged Accumulating", "bond_etf", "EUR", List.of("mid"),
                    "Tőzsdén kereskedett alap, amely világszerte sok ezer állami és vállalati kötvényt tart; a devizakockázatot euróra fedezi, a kamatbevételt visszaforgatja.",
                    new BigDecimal("0.08"), null, "Euróra fedezett.", "accumulating", "IE00BG47KH54", "VAGF.DE", "justETF",
                    "https://www.justetf.com/en/etf-profile.html?isin=IE00BG47KH54", LocalDate.of(2026, 11, 20)),
            new Seed("vanguard-lifestrategy-60", "Vanguard LifeStrategy 60% Equity UCITS ETF Accumulating", "mixed_fund", "EUR", List.of("mid"),
                    "Vegyes tőzsdei alap, amely nagyjából hat rész részvényt és négy rész kötvényt tart más indexalapokon keresztül, és ezt az arányt magától tartja.",
                    new BigDecimal("0.25"), null, null, "accumulating", "IE00BMVB5P51", "V60A.DE", "justETF",
                    "https://www.justetf.com/en/etf-profile.html?isin=IE00BMVB5P51", LocalDate.of(2026, 11, 20)),
            new Seed("vanguard-ftse-all-world-acc", "Vanguard FTSE All-World UCITS ETF (USD) Accumulating", "equity_etf", "EUR", List.of("long"),
                    "Tőzsdei indexalap, amely a fejlett és feltörekvő piacok nagy- és közepes vállalatainak részvényeit követi, az osztalékot visszaforgatja.",
                    new BigDecimal("0.14"), null, null, "accumulating", "IE00BK5BQT80", "VWCE.DE", "justETF",
                    "https://www.justetf.com/en/etf-profile.html?isin=IE00BK5BQT80", LocalDate.of(2026, 11, 20)),
            new Seed("ishares-msci-world-acc", "iShares Core MSCI World UCITS ETF USD (Acc)", "equity_etf", "EUR", List.of("long"),
                    "Tőzsdei indexalap, amely a fejlett országok nagy- és közepes vállalatainak részvényeit követi, az osztalékot visszaforgatja. Feltörekvő piacokat nem tart.",
                    new BigDecimal("0.20"), null, null, "accumulating", "IE00B4L5Y983", "EUNL.DE", "justETF",
                    "https://www.justetf.com/en/etf-profile.html?isin=IE00B4L5Y983", LocalDate.of(2026, 11, 20)),
            new Seed("spdr-acwi-imi-acc", "SPDR MSCI All Country World Investable Market UCITS ETF (Acc)", "equity_etf", "EUR", List.of("long"),
                    "Tőzsdei indexalap, amely a fejlett és feltörekvő piacok nagy-, közepes és kisvállalatainak részvényeit követi, az osztalékot visszaforgatja.",
                    new BigDecimal("0.17"), null, null, "accumulating", "IE00B3YLTY66", "SPYI.DE", "justETF",
                    "https://www.justetf.com/en/etf-profile.html?isin=IE00B3YLTY66", LocalDate.of(2026, 11, 20)),
            new Seed("ishares-sp500-acc", "iShares Core S&P 500 UCITS ETF USD (Acc)", "equity_etf", "EUR", List.of("long"),
                    "Tőzsdei indexalap, amely az ötszáz legnagyobb amerikai vállalat részvényeit követi, az osztalékot visszaforgatja. Csak amerikai cégeket tart.",
                    new BigDecimal("0.07"), null, null, "accumulating", "IE00B5BMR087", "SXR8.DE", "justETF",
                    "https://www.justetf.com/en/etf-profile.html?isin=IE00B5BMR087", LocalDate.of(2026, 11, 20)));

    private PenzCatalogSeed() {
    }
}
