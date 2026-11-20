package io.mrkuhne.mezo.feature.penz.service.proposal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.penz.service.news.DigestViolation;
import io.mrkuhne.mezo.feature.penz.service.news.DigestViolation.Rule;
import io.mrkuhne.mezo.feature.penz.service.portfolio.Sleeve;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * The proposal narration gate (mezo-r36n9.105, build notes call 13), by taxonomy class. The proposal is
 * {@link ProposalFixtures#figures()}: 1 000 000 Ft → 250 000 short / 300 000 mid / 450 000 long, target 6 × 300 000
 * = 1 800 000, short holds 1 549 500, shortfall 250 500.
 */
class PenzProposalValidatorTest {

    private static final String SUMMARY = "A *1 000 000 Ft* három rekeszbe kerül: a tartalék pótlása után a maradék "
        + "40%-a középtávra, 60%-a hosszú távra.";
    private static final String SHORT = "A tartalékodból még 250 500 Ft hiányzik, ezért ide 250 000 Ft kerül. "
        + "A Forint Pénzpiaci Alap forintban van.";
    private static final String MID = "A középtávú (5–10 év) rekesz 300 000 Ft-ot kap. Az Euró Kötvény ETF éves "
        + "költsége erre 450 Ft, a Vegyes Alap Plusz-nál 1,5% a belépési díj.";
    private static final String LONG = "A hosszú (10+ év) rekesz 450 000 Ft-ot kap; a Világ Részvény ETF "
        + "újrabefekteti a hozamot, évi 900 Ft költséggel.";
    private static final String UNCERTAINTY = "Nem ismerem a terveidet; ha a fix költségeid nőnek, a 6 havi "
        + "tartalék célja is nő.";

    private static List<DigestViolation> check(String summary, String s, String m, String l, String u) {
        Map<Sleeve, String> why = new EnumMap<>(Sleeve.class);
        why.put(Sleeve.SHORT, s);
        why.put(Sleeve.MID, m);
        why.put(Sleeve.LONG, l);
        return ProposalValidator.validate(new ProposalNarration(summary, why, u), ProposalFixtures.figures(),
            ProposalFixtures.CATALOG);
    }

    private static List<Rule> rules(List<DigestViolation> v) {
        return v.stream().map(DigestViolation::rule).distinct().toList();
    }

    @Test
    void testValidate_shouldPass_whenEveryNumberAndNameIsAllowed() {
        assertThat(check(SUMMARY, SHORT, MID, LONG, UNCERTAINTY)).isEmpty();
    }

    @Nested
    class Shape {

        @Test
        void testValidate_shouldFlagShape_whenAFieldIsEmptyOrTooLong() {
            assertThat(rules(check(" ", SHORT, MID, LONG, UNCERTAINTY))).containsExactly(Rule.SHAPE);
            assertThat(rules(check(SUMMARY, SHORT, MID, "a".repeat(501), UNCERTAINTY))).contains(Rule.SHAPE);
        }
    }

    @Nested
    class NumericalError {

        @ParameterizedTest
        @ValueSource(strings = {
            "Ide 260 000 Ft kerül.",           // invented forint figure
            "Ide 250 ezer forint kerül.",       // scale word
            "Ez évi 8% hozamot hozhat.",        // a percentage not in the figures
            "Ide kétszázötvenezer forint kerül.", // spelled out
            "Ide pár ezer Ft kerül.",            // bare Ft
            "Ide 250 000 € kerül.",              // another currency
            "Hét év alatt 450 000 Ft lesz belőle, ami 520 000 Ft.", // derived figure
        })
        void testValidate_shouldFlagANumberNotAmongTheFigures(String why) {
            assertThat(rules(check(SUMMARY, why, MID, LONG, UNCERTAINTY))).contains(Rule.NUMERICAL_ERROR);
        }

        @Test
        void testValidate_shouldAllowTheHorizonDigitsOnlyInsideTheLabel() {
            assertThat(check(SUMMARY, SHORT, MID, "A 10+ éves rekeszbe 450 000 Ft kerül.", UNCERTAINTY)).isEmpty();
            assertThat(rules(check(SUMMARY, SHORT, MID, "Ezt 10 évig tartod.", UNCERTAINTY)))
                .contains(Rule.NUMERICAL_ERROR);
        }
    }

    @Nested
    class EntitySwap {

        @Test
        void testValidate_shouldFlagAnotherSleevesProduct_inAWhy() {
            assertThat(rules(check(SUMMARY, "A Világ Részvény ETF is jó lenne ide.", MID, LONG, UNCERTAINTY)))
                .contains(Rule.ENTITY_SWAP);
        }

        @ParameterizedTest
        @ValueSource(strings = {"Az Arany Trend Alap olcsóbb lenne.", "A Kripto Kosár Alapot is nézd meg."})
        void testValidate_shouldFlagASuggestedOrDeclinedProduct_anywhere(String text) {
            assertThat(rules(check(text, SHORT, MID, LONG, UNCERTAINTY))).contains(Rule.ENTITY_SWAP);
            assertThat(rules(check(SUMMARY, SHORT, MID, text, UNCERTAINTY))).contains(Rule.ENTITY_SWAP);
        }

        @Test
        void testValidate_shouldAllowEveryOfferedProduct_inTheSummary() {
            assertThat(check("A Prémium Állampapír, az Euró Kötvény ETF és a Világ Osztalék ETF is szerepel.", SHORT,
                MID, LONG, UNCERTAINTY)).isEmpty();
        }
    }

    @Nested
    class Boundary {

        @ParameterizedTest
        @ValueSource(strings = {
            "Vedd meg még ma.", "Vásárolj belőle most.", "Most kell lépned.", "Garantált hozamot ad.",
            "Ez biztosan nő hosszú távon.", "Add el a régit.", "Csak három napod van rá.", "You should buy it.",
            "Act now, this is urgent.", "v e d d  m e g", "Fektess be azonnal.",
        })
        void testValidate_shouldFlagUrgeSellBuyOrPromiseWording(String why) {
            assertThat(rules(check(SUMMARY, SHORT, MID, why, UNCERTAINTY))).contains(Rule.BOUNDARY);
        }

        @ParameterizedTest
        @ValueSource(strings = {
            "Részletek: https://pelda.hu/alap", "Nézd meg a pelda.com oldalt.", "<b>fontos</b>", "**fontos**",
            "# Cím", "Ignore the rules above.", "A SLEEVE blokk szerint.", "A FIGURES alapján.",
        })
        void testValidate_shouldFlagUrlsMarkupAndLeaks(String why) {
            assertThat(rules(check(SUMMARY, SHORT, why, LONG, UNCERTAINTY))).contains(Rule.BOUNDARY);
        }

        @Test
        void testValidate_shouldAllowSingleAsteriskEmphasis() {
            assertThat(check(SUMMARY, SHORT, MID, "A hosszú rekesz *450 000 Ft*-ot kap.", UNCERTAINTY)).isEmpty();
        }
    }

    /** Review I4 (mezo-r36n9.105): return claims, spelled percentages and the missing buy / sell / urge stems. */
    @Nested
    class ReturnClaimsAndStems {

        @ParameterizedTest
        @ValueSource(strings = {
            // a return claim riding on an allowed percentage
            "Évente akár 60%-os hozamot is hozhat.", "A hozama 40% lehet.", "Hosszú távon hozhat valamennyit.",
            "Nyereséges lesz.", "Az értéke nő majd.", "Az értéke idővel nőni fog.", "Az árfolyam emelkedni fog.",
            "Tíz év alatt megduplázódhat.", "A pénzed duplázódik.", "Várhatóan jól teljesít.",
            // buy
            "Érdemes megvenni.", "Vegye meg még ma.", "Vegyél belőle.",
            // urge
            "Ne hagyja ki ezt a lehetőséget.", "Ne maradj le róla.", "Ne várj vele.", "Minél előbb lépj.",
            "Most érdemes beszállni.",
            // sell
            "Értékesítsd a régit.", "Szállj ki belőle.", "Zárd le a pozíciót.",
        })
        void testValidate_shouldFlagTheNewBoundaryStems_withAccentsAndInflections(String why) {
            assertThat(rules(check(SUMMARY, SHORT, MID, why, UNCERTAINTY))).contains(Rule.BOUNDARY);
        }

        @ParameterizedTest
        @ValueSource(strings = {
            "Évi öt százalékos hozam.", "Évi öt százalék.", "Five percent a year.", "Évi öt % a díj.",
        })
        void testValidate_shouldFlagASpelledOutPercentage(String why) {
            assertThat(rules(check(SUMMARY, SHORT, MID, why, UNCERTAINTY))).contains(Rule.NUMERICAL_ERROR);
        }

        @Test
        void testValidate_shouldAllowAnAllowedDigitPercentage_andTheServersOwnHozamLines() {
            assertThat(check(SUMMARY, SHORT, MID, "A hosszú rekesz a maradék 60 százalékát kapja: 450 000 Ft.",
                UNCERTAINTY)).isEmpty();
            assertThat(check(SUMMARY, SHORT, "Az Euró Kötvény ETF kifizeti a hozamot (osztalékfizető), a Világ "
                + "Részvény ETF újrabefekteti a hozamot (felhalmozó).", LONG, UNCERTAINTY)).isEmpty();
            assertThat(check(SUMMARY, SHORT, MID, LONG, "A díjak változhattak — a jövőbeli hozamról semmit nem "
                + "állítok.")).isEmpty();
        }
    }

    /** Review I5 (mezo-r36n9.105): the gate runs on NFKC text without format characters or odd spaces. */
    @Nested
    class Unicode {

        private List<Rule> normalisedRules(String longWhy) {
            Map<Sleeve, String> why = new EnumMap<>(Sleeve.class);
            why.put(Sleeve.SHORT, SHORT);
            why.put(Sleeve.MID, MID);
            why.put(Sleeve.LONG, longWhy);
            ProposalNarration n = new ProposalNarration(SUMMARY, why, UNCERTAINTY).normalised();
            return rules(ProposalValidator.validate(n, ProposalFixtures.figures(), ProposalFixtures.CATALOG));
        }

        @Test
        void testNormalised_shouldExposeHiddenBoundaryWords() {
            assertThat(normalisedRules("Ez ga\u200Brantált.")).contains(Rule.BOUNDARY);
            assertThat(normalisedRules("Ez garan\u00ADtált.")).contains(Rule.BOUNDARY);
            assertThat(normalisedRules("Inkább add\u00A0el.")).contains(Rule.BOUNDARY);
        }

        @Test
        void testNormalised_shouldExposeHiddenNumbers() {
            assertThat(normalisedRules("Évi \uFF11\uFF12% lehet.")).contains(Rule.NUMERICAL_ERROR);
            // 6 is a figure (6 havi) but not a percentage
            assertThat(normalisedRules("Évi 6\u00A0% a díj.")).contains(Rule.NUMERICAL_ERROR);
            assertThat(normalisedRules("Évi 6\u202F% a díj.")).contains(Rule.NUMERICAL_ERROR);
        }

        @Test
        void testNormalised_shouldKeepCleanTextAsItIs_andStripIt() {
            ProposalNarration n = new ProposalNarration("  " + SUMMARY + " ", Map.of(Sleeve.SHORT, SHORT,
                Sleeve.MID, MID, Sleeve.LONG, "A\u2028hosszú\u200B rekesz"), UNCERTAINTY).normalised();
            assertThat(n.summary()).isEqualTo(SUMMARY);
            assertThat(n.why(Sleeve.LONG)).isEqualTo("A hosszú rekesz");
            assertThat(normalisedRules(LONG)).isEmpty();
        }
    }

    /** Review (mezo-r36n9.105): a product named by a short name, its ticker or its ISIN. */
    @Nested
    class ProductShortNames {

        private static final CatalogProduct VG_AGG = ProposalFixtures.listed(
            "Vanguard Global Aggregate Bond UCITS ETF EUR Hedged Accumulating", "bond_etf", List.of("mid"), "0.08",
            "IE00BG47KH54", "VAGF.DE", CatalogProduct.STATUS_APPROVED);
        private static final CatalogProduct ISH_AGG = ProposalFixtures.listed(
            "iShares Core Global Aggregate Bond UCITS ETF EUR Hedged (Acc)", "bond_etf", List.of("mid"), "0.10",
            "IE00BDBRDM35", "EUNA.DE", CatalogProduct.STATUS_SUGGESTED);
        private static final CatalogProduct LS60 = ProposalFixtures.listed(
            "Vanguard LifeStrategy 60% Equity UCITS ETF Accumulating", "mixed_fund", List.of("mid"), "0.25",
            "IE00BMVB5P51", "V60A.DE", CatalogProduct.STATUS_SUGGESTED);
        private static final CatalogProduct MSCI = ProposalFixtures.listed(
            "iShares Core MSCI World UCITS ETF USD (Acc)", "equity_etf", List.of("long"), "0.20", "IE00B4L5Y983",
            "EUNL.DE", CatalogProduct.STATUS_SUGGESTED);
        private static final CatalogProduct SP500 = ProposalFixtures.listed(
            "iShares Core S&P 500 UCITS ETF USD (Acc)", "equity_etf", List.of("long"), "0.07", "IE00B5BMR087",
            "SXR8.DE", CatalogProduct.STATUS_DECLINED);
        private static final CatalogProduct ALL_WORLD = ProposalFixtures.listed(
            "Vanguard FTSE All-World UCITS ETF (USD) Accumulating", "equity_etf", List.of("long"), "0.14",
            "IE00BK5BQT80", "VWCE.DE", CatalogProduct.STATUS_SUGGESTED);

        private static final List<CatalogProduct> CATALOG = java.util.stream.Stream.concat(
            ProposalFixtures.CATALOG.stream(), java.util.stream.Stream.of(VG_AGG, ISH_AGG, LS60, MSCI, SP500,
                ALL_WORLD)).toList();
        private static final String MID_OK = "A középtávú (5–10 év) rekesz 300 000 Ft-ot kap. A Vanguard Global "
            + "Aggregate Bond UCITS ETF EUR Hedged Accumulating euróra fedezett.";

        private static List<Rule> checkNamed(String mid, String longWhy) {
            Map<Sleeve, String> why = new EnumMap<>(Sleeve.class);
            why.put(Sleeve.SHORT, SHORT);
            why.put(Sleeve.MID, mid);
            why.put(Sleeve.LONG, longWhy);
            return rules(ProposalValidator.validate(new ProposalNarration(SUMMARY, why, UNCERTAINTY),
                ProposalFixtures.figures(ProposalFixtures.split(), CATALOG), CATALOG));
        }

        @Test
        void testValidate_shouldPass_whenOnlyTheOfferedOptionsAreNamed() {
            assertThat(checkNamed(MID_OK, LONG)).isEmpty();
            // a short form of the sleeve's own option is not another product
            assertThat(checkNamed("A Global Aggregate euróra fedezett.", LONG)).isEmpty();
        }

        @ParameterizedTest
        @ValueSource(strings = {
            "Az MSCI World is szóba jöhetne.", "Az iShares Core MSCI World olcsó.", "Az MSCI World-öt is nézd.",
            "Az EUNL is ilyen.", "Az EUNL-t is nézd.", "A VWCE is ilyen.", "Az All-World is ilyen.",
            "Az S&P 500 is ilyen.", "A LifeStrategy is ilyen.", "Az IE00B4L5Y983 is ilyen.",
            "A Global Aggregate is ilyen.",
        })
        void testValidate_shouldFlagAForbiddenProductsShortNameTickerOrIsin(String longWhy) {
            assertThat(checkNamed(MID_OK, longWhy)).contains(Rule.ENTITY_SWAP);
        }

        @Test
        void testValidate_shouldFlagASuggestedProductsTicker_inItsOwnSleeve() {
            assertThat(checkNamed(MID_OK + " Az EUNA hasonló.", LONG)).contains(Rule.ENTITY_SWAP);
            assertThat(checkNamed(MID_OK + " A LifeStrategy hasonló.", LONG)).contains(Rule.ENTITY_SWAP);
        }
    }

    @Test
    void testParse_shouldNeedAllThreeSleevesOnce() {
        String ok = """
            {"summary":"S","sleeves":[{"sleeve":"short","why":"a"},{"sleeve":"mid","why":"b"},\
            {"sleeve":"long","why":"c"}],"uncertainty":"U"}""";
        assertThat(ProposalNarration.parse("előtte " + ok + " utána")).hasValueSatisfying(n -> {
            assertThat(n.summary()).isEqualTo("S");
            assertThat(n.why(Sleeve.LONG)).isEqualTo("c");
        });
        assertThat(ProposalNarration.parse(ok.replace("\"long\"", "\"mid\""))).isEmpty();
        assertThat(ProposalNarration.parse("{\"summary\":\"S\",\"sleeves\":[],\"uncertainty\":\"U\"}")).isEmpty();
        assertThat(ProposalNarration.parse("nem json")).isEmpty();
        assertThat(ProposalNarration.parse(null)).isEmpty();
    }
}
