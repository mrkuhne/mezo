package io.mrkuhne.mezo.feature.penz.service.news;

import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.HOLDINGS;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.good;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.quietAnswer;
import static io.mrkuhne.mezo.feature.penz.service.news.WeeklyFixtures.with;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.penz.service.news.DigestViolation.Rule;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** The weekly review validator by the spec §6 taxonomy (mezo-r36n9.120). Every holding and phrase is invented. */
class PenzWeeklyReviewValidatorTest {

    private static final WeeklySection LONG = WeeklyReviewSectioner.sections(
        List.of(WeeklyFixtures.worldItem("holding-w")), HOLDINGS, 27).get(2);

    private static List<Rule> rules(WeeklyModelSection m) {
        return WeeklyReviewValidator.validate(m, LONG, HOLDINGS).stream().map(DigestViolation::rule).toList();
    }

    @Test
    void testValidate_shouldAcceptAGoodSection_andAMattersFalseAnswer() {
        assertThat(WeeklyReviewValidator.validate(good("long", "holding-w"), LONG, HOLDINGS)).isEmpty();
        assertThat(WeeklyReviewValidator.validate(quietAnswer("long"), LONG, HOLDINGS)).isEmpty();
    }

    @Test
    void testValidate_shouldAcceptTheSectionsOwnFigures_verbatim() {
        WeeklyModelSection m = with(good("long", "holding-w"), "body",
            "A héten egy hír érintette, és a részed 27 hónapnyi fix költséget fedez; ez nem változott.");

        assertThat(rules(m)).isEmpty();
    }

    // ---- Numerical Error ----

    @ParameterizedTest
    @ValueSource(strings = {
        "A részeden 18 400 Ft volt a hatás.",
        "A hosszú távú rész 3,5%-ot hozhat.",
        "Ez 40 hónapnyi fix költség.",
        "Ez tízezer forintot jelent.",
        "A részed 27 ezer hónapra elég.",
        "Ft-ban mérve semmi sem változott."
    })
    void testValidate_shouldRejectAnInventedFigure(String body) {
        assertThat(rules(with(good("long", "holding-w"), "body", body))).contains(Rule.NUMERICAL_ERROR);
    }

    // ---- Entity Swap ----

    @Test
    void testValidate_shouldRejectAnotherSleevesHolding() {
        assertThat(rules(with(good("long", "holding-w"), "verdict",
            "A Példabank Nyrt híre a hosszú távú képet is átírja."))).contains(Rule.ENTITY_SWAP);
        assertThat(rules(with(good("long", "holding-w"), "body",
            "A Kitalált Kötvény sem mozdult a héten."))).contains(Rule.ENTITY_SWAP);
    }

    // ---- Negation Flip (sign rule) ----

    @Test
    void testValidate_shouldRejectASignedFigure() {
        assertThat(rules(with(good("long", "holding-w"), "body", "A hírek száma −1 lett."))).contains(Rule.NEGATION_FLIP);
    }

    // ---- Temporal Confusion ----

    @Test
    void testValidate_shouldRejectAYearOrAWeekday() {
        assertThat(rules(with(good("long", "holding-w"), "body", "A szabály 2027-től érvényes.")))
            .contains(Rule.TEMPORAL_CONFUSION);
        assertThat(rules(with(good("long", "holding-w"), "body", "Kedden jelent meg a hír.")))
            .contains(Rule.TEMPORAL_CONFUSION);
    }

    // ---- Boundary ----

    @ParameterizedTest
    @ValueSource(strings = {
        "Add el a Mintavilág ETF-et.",
        "Most kell lépned, mielőtt késő.",
        "Érdemes többet venni belőle: vásárolj.",
        "Ez biztos hozam a következő években.",
        "a d d  e l  m o s t",
        "Sell before it falls."
    })
    void testValidate_shouldRejectASellOrUrgeOrPromise(String verdict) {
        assertThat(rules(with(good("long", "holding-w"), "verdict", verdict))).contains(Rule.BOUNDARY);
    }

    @Test
    void testValidate_shouldRejectAUrlMarkupOrAPromptLeak() {
        assertThat(rules(with(good("long", "holding-w"), "body", "Részletek: https://evil.example/x")))
            .contains(Rule.BOUNDARY);
        assertThat(rules(with(good("long", "holding-w"), "body", "Lásd a **fontos** részt."))).contains(Rule.BOUNDARY);
        assertThat(rules(with(good("long", "holding-w"), "body", "A STORY blokk szerint ez fontos.")))
            .contains(Rule.BOUNDARY);
        assertThat(rules(with(good("long", "holding-w"), "body", "BOOP_PENZ_WEEKLY_V1"))).contains(Rule.BOUNDARY);
    }

    // ---- Shape ----

    @Test
    void testValidate_shouldRejectAnEmptyOrTooLongField() {
        assertThat(rules(with(good("long", "holding-w"), "noAction", " "))).contains(Rule.SHAPE);
        assertThat(rules(with(good("long", "holding-w"), "body", "a".repeat(WeeklyReviewValidator.BODY_MAX + 1))))
            .contains(Rule.SHAPE);
        assertThat(rules(with(good("long", "holding-w"), "verdict", "a".repeat(WeeklyReviewValidator.VERDICT_MAX + 1))))
            .contains(Rule.SHAPE);
    }

    @Test
    void testValidate_shouldRejectMattersWithoutABoolean_orWithoutOneOfItsOwnStories() {
        WeeklyModelSection g = good("long", "holding-w");
        assertThat(rules(new WeeklyModelSection("long", null, g.storyIds(), g.verdict(), g.body(), g.uncertainty(),
            g.noAction()))).contains(Rule.SHAPE);
        assertThat(rules(new WeeklyModelSection("long", true, List.of("holding-unknown"), g.verdict(), g.body(),
            g.uncertainty(), g.noAction()))).contains(Rule.SHAPE);
    }

    @Test
    void testKnownStoryIds_shouldIgnoreUnknownIds_inTheModelsOrder() {
        WeeklyModelSection m = new WeeklyModelSection("long", true, List.of("nope", "holding-w", "holding-w"), "v", "b",
            "u", "n");

        assertThat(WeeklyReviewValidator.knownStoryIds(m, LONG)).containsExactly("holding-w");
    }
}
