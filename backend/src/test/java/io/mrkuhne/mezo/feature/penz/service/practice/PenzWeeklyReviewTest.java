package io.mrkuhne.mezo.feature.penz.service.practice;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.penz.service.practice.WeeklyReview.CurvePoint;
import io.mrkuhne.mezo.feature.penz.service.practice.WeeklyReview.ReviewTrade;
import io.mrkuhne.mezo.feature.penz.service.practice.WeeklyReview.Setup;
import io.mrkuhne.mezo.feature.penz.service.practice.WeeklyReview.Week;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * L7 build notes §3.1 PenzPracticeWeek + call 3: Monday-start week, win rate, by-setup, the distribution, the most
 * common mistake with its cost, the cumulative curve. The fixture mirrors the approved spike's four trades (invented
 * figures, HUF minor units).
 */
class PenzWeeklyReviewTest {

    static final LocalDate MON = LocalDate.of(2026, 11, 16);
    static final LocalDate THU = MON.plusDays(3);

    static ReviewTrade trade(String r, long pnl, LocalDate exit, boolean mistake, Boolean stopRespected,
                             PracticeTag... tags) {
        return new ReviewTrade(List.of(tags), mistake, pnl, new BigDecimal(r), exit, stopRespected);
    }

    /** The spike's week: kitörés +1,9R, visszateszt −1,0R, nyitási + korán zártam +0,5R, hírre (hiba) −1,7R. */
    static List<ReviewTrade> spikeWeek() {
        return List.of(
            trade("1.90", 570_000, MON, false, true, PracticeTag.KITORES),
            trade("-1.00", -300_000, MON.plusDays(1), false, true, PracticeTag.VISSZATESZT),
            trade("0.50", 150_000, MON.plusDays(2), false, true, PracticeTag.NYITASI_TARTOMANY,
                PracticeTag.KORAI_ZARAS),
            trade("-1.70", -510_000, THU, true, false, PracticeTag.HIRRE, PracticeTag.TERVEN_KIVUL),
            // last week — not in this review
            trade("3.00", 900_000, MON.minusDays(3), true, true, PracticeTag.HIRRE));
    }

    @Test
    void testWeekStart_shouldBeTheMonday_whenAnyDayOfTheWeek() {
        assertThat(WeeklyReview.weekStart(MON)).isEqualTo(MON);
        assertThat(WeeklyReview.weekStart(THU)).isEqualTo(MON);
        assertThat(WeeklyReview.weekStart(MON.plusDays(6))).isEqualTo(MON);
        assertThat(WeeklyReview.weekStart(MON.plusDays(7))).isEqualTo(MON.plusDays(7));
    }

    @Test
    void testReview_shouldComputeTheWeeksFigures_whenTheSpikeWeek() {
        Week w = WeeklyReview.review(spikeWeek(), THU);

        assertThat(w.weekStart()).isEqualTo(MON);
        assertThat(w.weekEnd()).isEqualTo(MON.plusDays(6));
        assertThat(w.closedCount()).isEqualTo(4);
        assertThat(w.winRatePct()).isEqualTo(50);
        assertThat(w.avgR()).isEqualByComparingTo("-0.08"); // −0,075 HALF_UP
        assertThat(w.netPnlHufMinor()).isEqualTo(-90_000);
        assertThat(w.cleanCount()).isEqualTo(3);
        assertThat(w.cleanAvgR()).isEqualByComparingTo("0.47");
        assertThat(w.mistakeCount()).isEqualTo(1);
        assertThat(w.mistakeAvgR()).isEqualByComparingTo("-1.70");
        assertThat(w.stopBrokenCount()).isEqualTo(1);

        assertThat(w.bySetup()).extracting(Setup::tag).containsExactly(PracticeTag.KITORES,
            PracticeTag.VISSZATESZT, PracticeTag.NYITASI_TARTOMANY, PracticeTag.HIRRE, PracticeTag.KORAI_ZARAS,
            PracticeTag.TERVEN_KIVUL);
        Setup kitores = w.bySetup().getFirst();
        assertThat(kitores.count()).isEqualTo(1);
        assertThat(kitores.wins()).isEqualTo(1);
        assertThat(kitores.avgR()).isEqualByComparingTo("1.90");

        assertThat(w.distribution().bigWins()).isZero();
        assertThat(w.distribution().smallLosses()).isEqualTo(1);
        assertThat(w.distribution().worseThanLimit()).isEqualTo(1);
        assertThat(w.distribution().healthy()).isFalse();

        // hírre and tervtől eltérés tie on count and cost -> the tag order decides
        assertThat(w.commonMistake()).isNotNull();
        assertThat(w.commonMistake().tag()).isEqualTo(PracticeTag.HIRRE);
        assertThat(w.commonMistake().count()).isEqualTo(1);
        assertThat(w.commonMistake().costHufMinor()).isEqualTo(510_000);

        assertThat(w.curve()).extracting(CurvePoint::date)
            .containsExactly(MON, MON.plusDays(1), MON.plusDays(2), THU);
        assertThat(w.curve()).extracting(CurvePoint::cumulativeHufMinor)
            .containsExactly(570_000L, 270_000L, 420_000L, -90_000L);
    }

    @Test
    void testReview_shouldPickTheMostFrequentMistake_andTheCostlierOnATie() {
        List<ReviewTrade> trades = List.of(
            trade("-0.50", -100_000, MON, true, true, PracticeTag.KORAI_ZARAS),
            trade("-1.00", -400_000, MON, true, true, PracticeTag.TERVEN_KIVUL),
            trade("0.80", 200_000, MON, true, true, PracticeTag.TERVEN_KIVUL),
            trade("-1.00", -50_000, MON, true, true, PracticeTag.HIRRE),
            trade("-1.00", -60_000, MON, true, true, PracticeTag.HIRRE));
        Week w = WeeklyReview.review(trades, MON);
        // terven_kivul (2, cost 200 000) beats hirre (2, cost 110 000); korai_zaras has 1
        assertThat(w.commonMistake().tag()).isEqualTo(PracticeTag.TERVEN_KIVUL);
        assertThat(w.commonMistake().count()).isEqualTo(2);
        assertThat(w.commonMistake().costHufMinor()).isEqualTo(200_000);
    }

    @Test
    void testReview_shouldCostAMistakeZero_whenItsTradesWereProfitable() {
        Week w = WeeklyReview.review(List.of(trade("1.20", 240_000, MON, true, true, PracticeTag.HIRRE)), MON);
        assertThat(w.commonMistake().costHufMinor()).isZero();
    }

    @Test
    void testReview_shouldBeEmptyButShaped_whenNoTradeClosedThisWeek() {
        Week w = WeeklyReview.review(List.of(trade("2.00", 1, MON.minusDays(1), false, true, PracticeTag.TREND)),
            MON.plusDays(2));
        assertThat(w.closedCount()).isZero();
        assertThat(w.winRatePct()).isNull();
        assertThat(w.avgR()).isNull();
        assertThat(w.bySetup()).isEmpty();
        assertThat(w.commonMistake()).isNull();
        assertThat(w.distribution().healthy()).isTrue();
        assertThat(w.curve()).extracting(CurvePoint::cumulativeHufMinor).containsExactly(0L, 0L, 0L);
    }

    @Test
    void testReview_shouldCountBigWinsAndHealthy_whenNoTradeBelowTheLimit() {
        Week w = WeeklyReview.review(List.of(
            trade("2.00", 400_000, MON, false, true, PracticeTag.TREND),
            trade("-1.20", -240_000, MON, false, true, PracticeTag.TREND),
            trade("-1.50", -300_000, MON, false, true, PracticeTag.TREND)), MON.plusDays(6));
        assertThat(w.distribution().bigWins()).isEqualTo(1);
        assertThat(w.distribution().smallLosses()).isEqualTo(1);
        assertThat(w.distribution().worseThanLimit()).isZero();
        assertThat(w.distribution().healthy()).isTrue();
        assertThat(w.curve()).hasSize(7);
        assertThat(w.winRatePct()).isEqualTo(33);
    }
}
