package io.mrkuhne.mezo.feature.penz.service.practice;

import static io.mrkuhne.mezo.feature.penz.service.practice.PenzWeeklyReviewTest.MON;
import static io.mrkuhne.mezo.feature.penz.service.practice.PenzWeeklyReviewTest.THU;
import static io.mrkuhne.mezo.feature.penz.service.practice.PenzWeeklyReviewTest.trade;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.penz.service.practice.PracticeCopy.Copy;
import io.mrkuhne.mezo.feature.penz.service.practice.PracticeCopy.Observation;
import io.mrkuhne.mezo.feature.penz.service.practice.WeeklyReview.Week;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/**
 * L7 build notes call 1 + call 9: the weekly review's deterministic Hungarian copy, modelled on the approved spike's
 * Gyakorlás tab. Every number comes from the computed week; spec §6 boundary — never urge, never promise a return,
 * never say sell.
 */
class PenzPracticeCopyTest {

    private static final Pattern BOUNDARY = Pattern.compile(
        "(?iu)(vegyél|vásárolj|add el|adj el|eladás|eladni|érdemes|biztos|garant|hozam|kellene|muszáj)");

    @Test
    void testRText_shouldSignAndUseADecimalComma() {
        assertThat(PracticeCopy.rText(new BigDecimal("0.84"))).isEqualTo("+0,8R");
        assertThat(PracticeCopy.rText(new BigDecimal("-1.70"))).isEqualTo("−1,7R");
        assertThat(PracticeCopy.rText(new BigDecimal("1.95"))).isEqualTo("+2,0R");
        assertThat(PracticeCopy.rText(new BigDecimal("-0.04"))).isEqualTo("0,0R");
        assertThat(PracticeCopy.rText(BigDecimal.ZERO)).isEqualTo("0,0R");
    }

    @Test
    void testWeek_shouldNameTheCostlyMistake_whenTheSpikeWeek() {
        Copy c = PracticeCopy.week(WeeklyReview.review(PenzWeeklyReviewTest.spikeWeek(), THU));

        assertThat(c.headline()).isEqualTo("A hírre ugrás vitte el a hetet");
        assertThat(c.sub()).isEqualTo("4 lezárt kereskedésből 3 hiba nélkül ment — azok átlagban *+0,5R*-t hoztak. "
            + "A hibának jelöltek átlaga *−1,7R* lett. A hírre ugrás a hét leggyakoribb hibája, és *5 100 Ft-ba* "
            + "került.");
        assertThat(c.observations()).extracting(Observation::title)
            .containsExactly("A hibák a döntők", "A kilépési szint nem mindig tartott");
        assertThat(c.observations().getFirst().body()).isEqualTo("A hibának jelölt kereskedéseid átlaga −1,7R, "
            + "a többié +0,5R. 4 kereskedésnél ez még nem bizonyíték, csak feltűnő.");
        assertThat(c.observations().get(1).body()).isEqualTo(
            "1 kereskedés a kilépési szinteden túl zárt — ott a veszteség nagyobb lett a tervezettnél.");
    }

    @Test
    void testWeek_shouldSayItWasTheCommonestMistake_whenTheWeekStillEndedUp() {
        Week w = WeeklyReview.review(List.of(
            trade("2.40", 720_000, MON, false, true, PracticeTag.TREND),
            trade("-1.00", -100_000, MON, true, true, PracticeTag.KORAI_ZARAS)), MON);
        Copy c = PracticeCopy.week(w);
        assertThat(c.headline()).isEqualTo("A korai zárás volt a hét leggyakoribb hibája");
        assertThat(c.sub()).isEqualTo("2 lezárt kereskedésből 1 hiba nélkül ment — azok átlagban *+2,4R*-t hoztak. "
            + "A hibának jelöltek átlaga *−1,0R* lett. Ez összesen *1 000 Ft-ba* került.");
    }

    @Test
    void testWeek_shouldNotCallACostlessMistakeExpensive() {
        Copy c = PracticeCopy.week(WeeklyReview.review(
            List.of(trade("1.20", 240_000, MON, true, true, PracticeTag.HIRRE)), MON));
        assertThat(c.headline()).isEqualTo("A hírre ugrás volt a hét leggyakoribb hibája");
        assertThat(c.sub()).isEqualTo("1 kereskedést zártál, átlagban *+1,2R* eredménnyel. "
            + "A hibának jelöltek ezúttal nem kerültek pénzbe — ettől még hibák maradnak.");
    }

    @Test
    void testWeek_shouldPraiseNothingButStateTheFacts_whenACleanHealthyWeek() {
        Copy c = PracticeCopy.week(WeeklyReview.review(List.of(
            trade("2.10", 420_000, MON, false, true, PracticeTag.TREND),
            trade("2.00", 400_000, MON, false, true, PracticeTag.TREND),
            trade("-1.00", -200_000, MON, false, true, PracticeTag.KITORES)), MON));
        assertThat(c.headline()).isEqualTo("Tiszta hét: egyik kereskedést sem jelölted hibának");
        assertThat(c.sub()).isEqualTo("3 kereskedést zártál, átlagban *+1,0R* eredménnyel. "
            + "Egyik sem ment *−1,5R* alá, a veszteségek a terv szerint kicsik maradtak.");
        assertThat(c.observations()).extracting(Observation::title).containsExactly("Erős pont: trend mentén");
        assertThat(c.observations().getFirst().body()).isEqualTo("Ezzel a címkével 2 kereskedést zártál a héten, "
            + "és mind nyereséges lett. Ennyiből ez még nem szabály.");
    }

    @Test
    void testWeek_shouldNameTheLimitBreach_whenCleanButUnhealthy() {
        Copy c = PracticeCopy.week(WeeklyReview.review(List.of(
            trade("-2.00", -400_000, MON, false, false, PracticeTag.FORDULO),
            trade("-1.80", -360_000, MON, false, false, PracticeTag.FORDULO)), MON));
        assertThat(c.headline()).isEqualTo("A héten 2 kereskedés −1,5R alatt zárt");
        assertThat(c.sub()).isEqualTo("2 kereskedést zártál, átlagban *−1,9R* eredménnyel. A −1,5R alatti zárás "
            + "azt jelzi, hogy a veszteség nagyobb lett a tervezettnél.");
        assertThat(c.observations()).extracting(Observation::title)
            .containsExactly("A kilépési szint nem mindig tartott", "Gyenge pont: fordulóra");
    }

    @Test
    void testWeek_shouldNoticeEarlyCloses_andCapObservationsAtThree() {
        Copy c = PracticeCopy.week(WeeklyReview.review(List.of(
            trade("0.40", 80_000, MON, false, true, PracticeTag.KORAI_ZARAS, PracticeTag.KITORES),
            trade("0.60", 120_000, MON, false, true, PracticeTag.KORAI_ZARAS, PracticeTag.KITORES),
            trade("-1.10", -220_000, MON, true, false, PracticeTag.HIRRE),
            trade("-1.00", -200_000, MON, true, true, PracticeTag.HIRRE)), MON));
        assertThat(c.observations()).hasSize(3);
        assertThat(c.observations()).extracting(Observation::title).containsExactly("A hibák a döntők",
            "A kilépési szint nem mindig tartott", "Gyenge pont: hírre ugrottam");
        Copy early = PracticeCopy.week(WeeklyReview.review(List.of(
            trade("0.40", 80_000, MON, false, true, PracticeTag.KORAI_ZARAS),
            trade("0.60", 120_000, MON, false, true, PracticeTag.KORAI_ZARAS)), MON));
        assertThat(early.observations()).extracting(Observation::title)
            .containsExactly("Erős pont: korán zártam", "A nyereséges kereskedéseket korán zárod");
        assertThat(early.observations().get(1).body())
            .isEqualTo("2 nyereséges kereskedést zártál a tervezett szint előtt.");
    }

    @Test
    void testWeek_shouldBeSilent_whenNoTradeClosedThisWeek() {
        Copy c = PracticeCopy.week(WeeklyReview.review(List.of(), MON));
        assertThat(c.headline()).isNull();
        assertThat(c.sub()).isNull();
        assertThat(c.observations()).isEmpty();
    }

    @Test
    void testNoiseLine_shouldAppearUnderFiftyTaggedTrades() {
        assertThat(PracticeCopy.noiseLine(4))
            .isEqualTo("50 jelölt kereskedés alatt ezek a számok még zajnak számítanak — most 4 van.");
        assertThat(PracticeCopy.noiseLine(0)).endsWith("most 0 van.");
        assertThat(PracticeCopy.noiseLine(49)).isNotNull();
        assertThat(PracticeCopy.noiseLine(50)).isNull();
    }

    @Test
    void testEveryLine_shouldStayInsideTheBoundary_andQuoteOnlyComputedNumbers() {
        List<Week> weeks = List.of(
            WeeklyReview.review(PenzWeeklyReviewTest.spikeWeek(), THU),
            WeeklyReview.review(List.of(trade("1.20", 240_000, MON, true, true, PracticeTag.HIRRE)), MON),
            WeeklyReview.review(List.of(trade("-2.00", -400_000, MON, false, false, PracticeTag.FORDULO)), MON),
            WeeklyReview.review(List.of(trade("2.10", 420_000, MON, false, true, PracticeTag.TREND)), MON));
        for (Week w : weeks) {
            Copy c = PracticeCopy.week(w);
            List<String> lines = new ArrayList<>(List.of(c.headline(), c.sub()));
            c.observations().forEach(o -> {
                lines.add(o.title());
                lines.add(o.body());
            });
            for (String line : lines) {
                assertThat(BOUNDARY.matcher(line).find()).as(line).isFalse();
                assertThat(line).doesNotContain("Mezo");
            }
        }
    }
}
