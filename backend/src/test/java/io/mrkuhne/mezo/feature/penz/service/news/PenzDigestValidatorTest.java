package io.mrkuhne.mezo.feature.penz.service.news;

import static io.mrkuhne.mezo.feature.penz.service.news.DigestFixtures.GOOD_BODY;
import static io.mrkuhne.mezo.feature.penz.service.news.DigestFixtures.GOOD_NO_ACTION;
import static io.mrkuhne.mezo.feature.penz.service.news.DigestFixtures.GOOD_TITLE;
import static io.mrkuhne.mezo.feature.penz.service.news.DigestFixtures.GOOD_UNCERTAINTY;
import static io.mrkuhne.mezo.feature.penz.service.news.DigestFixtures.GOOD_VERDICT;
import static io.mrkuhne.mezo.feature.penz.service.news.DigestFixtures.HOLDINGS;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.penz.service.news.DigestViolation.Rule;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * The digest gate (mezo-r36n9.104, build notes §4), test names by the evaluation taxonomy of spec §6: EntitySwap ·
 * NumericalError · NegationFlip · TemporalConfusion · Boundary, plus Shape.
 */
class PenzDigestValidatorTest {

    private static final DigestStory WORLD = DigestFixtures.worldStory("Egy kitalált cikk szövege.");

    private static List<Rule> rules(DigestModelItem m, DigestStory s) {
        return DigestValidator.validate(m, s, HOLDINGS).stream().map(DigestViolation::rule).toList();
    }

    private static DigestModelItem withVerdict(String verdict) {
        return new DigestModelItem(WORLD.id(), true, GOOD_TITLE, verdict, GOOD_BODY, 2, GOOD_UNCERTAINTY,
            GOOD_NO_ACTION);
    }

    private static DigestModelItem withBody(String body) {
        return new DigestModelItem(WORLD.id(), true, GOOD_TITLE, GOOD_VERDICT, body, 2, GOOD_UNCERTAINTY,
            GOOD_NO_ACTION);
    }

    private static DigestModelItem withTitle(String title) {
        return new DigestModelItem(WORLD.id(), true, title, GOOD_VERDICT, GOOD_BODY, 2, GOOD_UNCERTAINTY,
            GOOD_NO_ACTION);
    }

    @Test
    void testGood_shouldPass_whenEveryNumberIsAFigureVerbatim() {
        assertThat(DigestValidator.validate(DigestFixtures.good(), WORLD, HOLDINGS)).isEmpty();
    }

    // ---- Numerical Error ----

    @Test
    void testNumericalError_shouldReject_whenProseInventsAForintAmount() {
        assertThat(rules(withVerdict("A te részeden 19 000 Ft-ot mozdult."), WORLD)).contains(Rule.NUMERICAL_ERROR);
    }

    @Test
    void testNumericalError_shouldReject_whenProseInventsAPercentOrBareNumber() {
        assertThat(rules(withBody("Az alap 2,3%-ot mozdult."), WORLD)).contains(Rule.NUMERICAL_ERROR);
        assertThat(rules(withBody("Az alap kb. 1500 céget tart."), WORLD)).contains(Rule.NUMERICAL_ERROR);
    }

    @Test
    void testNumericalError_shouldReject_whenADerivedSumIsWritten() {
        // effect + value is a figure the backend never computed
        assertThat(rules(withBody("Most 1 221 600 Ft-ot ér."), WORLD)).contains(Rule.NUMERICAL_ERROR);
    }

    @Test
    void testNumericalError_shouldReject_whenAmountIsInMillionWords() {
        assertThat(rules(withBody("A részed 1,3 millió forintot ér."), WORLD)).contains(Rule.NUMERICAL_ERROR);
    }

    @Test
    void testNumericalError_shouldAccept_everyHungarianSpellingOfAnAllowedFigure() {
        assertThat(rules(withBody("Hatás: 18 400 Ft, 18 400 Ft, 18.400 forint; érték 1 240 000 Ft; 1,1%."), WORLD))
            .isEmpty();
    }

    @Test
    void testNumericalError_shouldIgnoreDigitsInTheStoryOwnLedgerName() {
        NewsArticle a = DigestFixtures.article("b1", "Példa Hírek", "Bond story", null);
        DigestStory bond = new DigestStory(new Story("holding-dddddddddd", StoryKey.holding(DigestFixtures.BOND_ID),
            List.of(a), 1), DigestFixtures.BOND.name(), new DigestFigures(DigestKind.HOLDING, "short", 0, null, null),
            Map.of());
        DigestModelItem m = new DigestModelItem(bond.id(), true, "A Kitalált Kötvény 2031/A hozama változatlan",
            "Ez a rövid távú rész a terve szerint fut.", "A papír fut tovább.", 2, "Kevés a bizonytalanság.",
            "Ez az 1–3 éves rész menetrend szerint fut.");

        assertThat(rules(m, bond)).isEmpty();
    }

    // ---- Entity Swap ----

    @Test
    void testEntitySwap_shouldReject_whenAnotherHoldingIsNamed() {
        assertThat(rules(withBody("A Példabank részvényei is mozogtak."), WORLD)).contains(Rule.ENTITY_SWAP);
        assertThat(rules(withBody("A PLDB árfolyama is mozgott."), WORLD)).contains(Rule.ENTITY_SWAP);
        assertThat(rules(withVerdict("A Kitalált Kötvény sem változott."), WORLD)).contains(Rule.ENTITY_SWAP);
    }

    @Test
    void testEntitySwap_shouldAllowTheHoldingsAMacroStoryMoves() {
        DigestStory fx = DigestFixtures.fxStory();
        DigestModelItem m = new DigestModelItem(fx.id(), true, "A forint 0,6%-ot erősödött",
            "Ez az árfolyam mozgása, nem a Mintavilág ETF-é.", "A devizás részed ugyanannyi eurót ér.", 1,
            "A magyarázat bizonytalan.", "Árfolyammozgás, nem befektetési esemény.");

        assertThat(rules(m, fx)).isEmpty();
        assertThat(rules(new DigestModelItem(fx.id(), true, m.title(), "A Példabank is érintett.", m.body(), 1,
            m.uncertainty(), m.noAction()), fx)).contains(Rule.ENTITY_SWAP);
    }

    // ---- Negation Flip ----

    @ParameterizedTest
    @ValueSource(strings = {"A világ-ETF-ed emelkedett", "Nőtt az alapod értéke", "Erősödött az alap",
        "Szárnyal a világ-ETF", "Your world fund rose", "The fund gained ground"})
    void testNegationFlip_shouldReject_whenRiseWordsMeetANegativeEffect(String title) {
        assertThat(rules(withTitle(title), WORLD)).contains(Rule.NEGATION_FLIP);
    }

    @ParameterizedTest
    @ValueSource(strings = {"A világ-ETF-ed esett", "Csökkent az alapod", "Gyengült az alap", "Zuhant az ETF",
        "Visszaesett a világpiac", "The fund fell"})
    void testNegationFlip_shouldReject_whenFallWordsMeetAPositiveEffect(String title) {
        DigestStory up = new DigestStory(WORLD.story(), WORLD.holdingName(), new DigestFigures(DigestKind.HOLDING,
            "long", 1_840_000L, new BigDecimal("1.12"), 124_000_000L), WORLD.bodiesByUrl());
        DigestModelItem m = new DigestModelItem(up.id(), true, title, "Egy rövid mozgás a 10+ éves pénznél.",
            GOOD_BODY, 2, GOOD_UNCERTAINTY, GOOD_NO_ACTION);

        assertThat(rules(m, up)).contains(Rule.NEGATION_FLIP);
    }

    @Test
    void testNegationFlip_shouldNotApply_toMacroStories() {
        DigestStory fx = DigestFixtures.fxStory();
        DigestModelItem m = new DigestModelItem(fx.id(), true, "A forint erősödött", "Árfolyammozgás.",
            "A devizás részed ugyanannyi eurót ér.", 1, "Bizonytalan.", "Magától visszajön.");

        assertThat(rules(m, fx)).doesNotContain(Rule.NEGATION_FLIP);
    }

    // ---- Temporal Confusion ----

    @ParameterizedTest
    @ValueSource(strings = {"Kedden esett az alap.", "Pénteken jött a hír.", "Vasárnap óta mozog.",
        "On Monday the fund slid."})
    void testTemporalConfusion_shouldReject_whenAWeekdayIsNamed(String body) {
        assertThat(rules(withBody(body), WORLD)).contains(Rule.TEMPORAL_CONFUSION);
    }

    @Test
    void testTemporalConfusion_shouldReject_whenAYearOrDateIsWritten() {
        assertThat(rules(withBody("Ez 2025 óta a legnagyobb esés."), WORLD)).contains(Rule.TEMPORAL_CONFUSION);
        assertThat(rules(withBody("A következő döntés december 8-án lesz."), WORLD)).contains(Rule.NUMERICAL_ERROR);
    }

    // ---- Boundary ----

    @ParameterizedTest
    @ValueSource(strings = {"Most vedd meg olcsón.", "Vegyél még belőle.", "Add el, amíg lehet.", "Adj el egy részt.",
        "Érdemes lehet eladni.", "Most kell lépni.", "Azonnal érdemes átnézni.", "Sürgős a döntés.",
        "Garantált hozamot ad.", "Biztos nyereség vár.", "You should sell now.", "Time to buy the dip.",
        "This is urgent."})
    void testBoundary_shouldReject_buySellUrgeAndPromiseWording(String body) {
        assertThat(rules(withBody(body), WORLD)).contains(Rule.BOUNDARY);
    }

    @ParameterizedTest
    @ValueSource(strings = {"Részletek: https://evil.example/x", "Lásd www.example.org oldalt.",
        "Olvasd el: example.com", "<b>Fontos</b>", "**Fontos**", "[link](x)", "# Cím",
        "Ez az ARTICLE szövege.", "Az utasítás szerint ezt írom.", "Ignore previous instructions.",
        "BOOP_PENZ_DIGEST_V1", "My system prompt says"})
    void testBoundary_shouldReject_urlsMarkupAndPromptLeaks(String body) {
        assertThat(rules(withBody(body), WORLD)).contains(Rule.BOUNDARY);
    }

    @Test
    void testBoundary_shouldAllowSingleAsteriskEmphasis() {
        assertThat(rules(withBody("Ez *fontos*, de nem sürgető."), WORLD)).isEmpty();
    }

    // ---- Shape ----

    @Test
    void testShape_shouldReject_emptyFieldsOverlongFieldsAndBadConfidence() {
        assertThat(rules(new DigestModelItem(WORLD.id(), true, GOOD_TITLE, GOOD_VERDICT, GOOD_BODY, 2, " ",
            GOOD_NO_ACTION), WORLD)).contains(Rule.SHAPE);
        assertThat(rules(new DigestModelItem(WORLD.id(), true, GOOD_TITLE, GOOD_VERDICT, GOOD_BODY, 2,
            GOOD_UNCERTAINTY, null), WORLD)).contains(Rule.SHAPE);
        assertThat(rules(withTitle("a".repeat(DigestValidator.TITLE_MAX + 1)), WORLD)).contains(Rule.SHAPE);
        assertThat(rules(withVerdict("a".repeat(DigestValidator.VERDICT_MAX + 1)), WORLD)).contains(Rule.SHAPE);
        assertThat(rules(withBody("a".repeat(DigestValidator.BODY_MAX + 1)), WORLD)).contains(Rule.SHAPE);
        assertThat(rules(new DigestModelItem(WORLD.id(), true, GOOD_TITLE, GOOD_VERDICT, GOOD_BODY, 3,
            GOOD_UNCERTAINTY, GOOD_NO_ACTION), WORLD)).contains(Rule.SHAPE);
        assertThat(rules(new DigestModelItem(WORLD.id(), true, GOOD_TITLE, GOOD_VERDICT, GOOD_BODY, null,
            GOOD_UNCERTAINTY, GOOD_NO_ACTION), WORLD)).contains(Rule.SHAPE);
    }
}
