package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.config.MesoPlanProperties.Split;
import io.mrkuhne.mezo.feature.train.service.CandidateRanker.Fix;
import io.mrkuhne.mezo.feature.train.service.CandidateRanker.Ranked;
import io.mrkuhne.mezo.feature.train.service.CandidateRanker.Reason;
import io.mrkuhne.mezo.feature.train.service.CandidateRanker.Scored;
import io.mrkuhne.mezo.feature.train.service.PlanEvaluator.ConsecutiveHeavy;
import io.mrkuhne.mezo.feature.train.service.PlanEvaluator.DayResult;
import io.mrkuhne.mezo.feature.train.service.PlanEvaluator.DaySets;
import io.mrkuhne.mezo.feature.train.service.PlanEvaluator.Fit;
import io.mrkuhne.mezo.feature.train.service.PlanEvaluator.MuscleResult;
import io.mrkuhne.mezo.feature.train.service.VolumeBands.Band;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class CandidateRankerTest {

    private static final Split UL = new Split("ul2", "Felső / Alsó", List.of("Upper", "Lower", "Upper", "Lower"));
    private static final Split FULL4 = new Split("full4", "Teljes test ×4", List.of("Full", "Full", "Full", "Full"));
    private static final Split PPL = new Split("ppl", "PPL", List.of("Push", "Pull", "Legs", "Push", "Pull", "Legs"));

    /** A muscle hit on the given day indexes, {@code setsPerDay} each, with a fit and optional heavy pairs. */
    private static MuscleResult muscle(String name, Fit fit, int setsPerDay, List<ConsecutiveHeavy> heavy, int... days) {
        List<DaySets> spread = new ArrayList<>();
        for (int d : days) spread.add(new DaySets(d, setsPerDay));
        return new MuscleResult(name, PriorityTier.GROW, new Band(8, 14, 20, false), setsPerDay * days.length, fit,
            0, spread, List.of(), false, PlanEvaluator.BasisSource.LANDMARKS_RP, heavy);
    }

    private static MuscleResult ok(String name, int... days) {
        return muscle(name, Fit.INSIDE, 3, List.of(), days);
    }

    private static List<DayResult> days(int... minutes) {
        List<DayResult> out = new ArrayList<>();
        for (int i = 0; i < minutes.length; i++) {
            out.add(new DayResult(i, "D" + i, minutes[i], null, List.of(), List.of(), false));
        }
        return out;
    }

    private static Scored scored(Split split, Integer target, List<MuscleResult> muscles, int... minutes) {
        return new Scored(split, new PlanEvaluator.Result(muscles, days(minutes), List.of()), target);
    }

    @Test
    void filtersOverTime() {
        Scored over = scored(UL, 60, List.of(ok("chest", 0, 2)), 55, 61, 50, 50);
        Scored fits = scored(FULL4, 60, List.of(ok("chest", 0, 1, 2, 3)), 55, 58, 50, 60);

        Ranked r = CandidateRanker.rank(List.of(over, fits));

        assertThat(r.nothingFits()).isFalse();
        assertThat(r.offered()).containsExactly(fits);
        assertThat(r.fixes()).isEmpty();
    }

    @Test
    void filtersHeavyConsecutive() {
        Scored heavy = scored(UL, null,
            List.of(muscle("quad", Fit.INSIDE, 5, List.of(new ConsecutiveHeavy(1, 2, 5, 5)), 1, 2)), 50, 50, 50, 50);
        Scored once = scored(FULL4, null, List.of(ok("chest", 0)), 50, 50, 50, 50);   // chest only 1×/week
        Scored fine = scored(PPL, null, List.of(ok("chest", 0, 3)), 50, 50, 50, 50, 50, 50);

        Ranked r = CandidateRanker.rank(List.of(heavy, once, fine));

        assertThat(r.offered()).containsExactly(fine);
        assertThat(CandidateRanker.passes(heavy)).isFalse();
        assertThat(CandidateRanker.passes(once)).isFalse();
    }

    @Test
    void keepsLightFullBody() {
        // 3 sets of every group on four consecutive days: below the heavy threshold, so the evaluator flags nothing
        Scored full = scored(FULL4, 60, List.of(ok("chest", 0, 1, 2, 3), ok("quad", 0, 1, 2, 3)), 50, 50, 50, 50);

        Ranked r = CandidateRanker.rank(List.of(full));

        assertThat(r.nothingFits()).isFalse();
        assertThat(r.offered()).containsExactly(full);
        assertThat(CandidateRanker.reasons(full, full))
            .containsExactly(new Reason("fits_time", 50), new Reason("freq_high", 4));
    }

    @Test
    void ordersByBandFitThenLongestDay() {
        Scored outsideOne = scored(UL, 70, List.of(ok("chest", 0, 2), muscle("back", Fit.BELOW, 3, List.of(), 1, 3)),
            40, 40, 40, 40);
        Scored longer = scored(FULL4, 70, List.of(ok("chest", 0, 2), ok("back", 1, 3)), 50, 65, 50, 50);
        Scored shorter = scored(PPL, 70, List.of(ok("chest", 0, 2), ok("back", 1, 3)), 50, 60, 50, 50, 50, 50);
        Scored tieLater = scored(new Split("x", "X", List.of("Full", "Full", "Full", "Full")), 70,
            List.of(ok("chest", 0, 2), ok("back", 1, 3)), 60, 60, 60, 60);

        Ranked r = CandidateRanker.rank(List.of(outsideOne, longer, shorter, tieLater));

        // shorter (60) before tieLater (60, later in the catalogue) before longer (65); outside-band is fourth → cut
        assertThat(r.offered()).containsExactly(shorter, tieLater, longer);
        assertThat(CandidateRanker.reasons(shorter, shorter))
            .containsExactly(new Reason("fits_time", 60), new Reason("freq_2x", null));
    }

    @Test
    void moreWarmupsComparedToTheRecommended() {
        Scored rec = new Scored(UL, new PlanEvaluator.Result(List.of(ok("chest", 0, 2)), days(50, 50, 50, 50),
            List.of()), null, 12);
        Scored more = new Scored(FULL4, new PlanEvaluator.Result(List.of(ok("chest", 0, 2)), days(55, 55, 55, 55),
            List.of()), null, 20);

        assertThat(CandidateRanker.reasons(more, rec))
            .containsExactly(new Reason("freq_2x", null), new Reason("more_warmups", 8));
        assertThat(CandidateRanker.reasons(rec, rec)).containsExactly(new Reason("freq_2x", null));
    }

    @Test
    void nothingFitsGivesClosestAndFixes() {
        Scored a = scored(UL, 45, List.of(ok("chest", 0, 2)), 50, 62, 50, 50);      // overrun 17
        Scored b = scored(FULL4, 45, List.of(ok("chest", 0, 1, 2, 3)), 52, 52, 52, 52); // overrun 7

        Ranked r = CandidateRanker.rank(List.of(a, b));

        assertThat(r.nothingFits()).isTrue();
        assertThat(r.offered()).containsExactly(b);
        assertThat(r.fixes()).containsExactly(new Fix("more_minutes", 60), new Fix("more_days", null));
    }

    @Test
    void nothingFitsPrefersTheSoundSplitOverTime() {
        // three consecutive days: full body fits 60 min but is heavy back-to-back; the spreading split runs over
        Split full3 = new Split("full3", "Teljes test ×3", List.of("Full", "Full", "Full"));
        Split ulf = new Split("ulf", "Felső / Alsó / Teljes test", List.of("Upper", "Lower", "Full"));
        Scored heavyFull = scored(full3, 60,
            List.of(muscle("quad", Fit.INSIDE, 4, List.of(new ConsecutiveHeavy(0, 1, 4, 4)), 0, 1, 2)), 55, 55, 55);
        Scored overUlf = scored(ulf, 60, List.of(ok("quad", 1, 2), ok("chest", 0, 2)), 68, 58, 62);

        Ranked r = CandidateRanker.rank(List.of(heavyFull, overUlf));

        assertThat(r.nothingFits()).isTrue();
        assertThat(r.offered()).containsExactly(overUlf);
        assertThat(r.fixes()).containsExactly(new Fix("more_minutes", 75), new Fix("more_days", null));
    }

    @Test
    void nothingSoundAtSixDaysHasNoFixes() {
        Scored heavy = scored(PPL, null,
            List.of(muscle("quad", Fit.INSIDE, 5, List.of(new ConsecutiveHeavy(2, 3, 5, 5)), 2, 3)),
            50, 50, 50, 50, 50, 50);

        Ranked r = CandidateRanker.rank(List.of(heavy));

        assertThat(r.nothingFits()).isTrue();
        assertThat(r.offered()).containsExactly(heavy);
        assertThat(r.fixes()).isEmpty();
    }

    @Test
    void atMostThree() {
        List<Scored> all = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            all.add(scored(new Split("s" + i, "S" + i, List.of("Full", "Full")), null, List.of(ok("chest", 0, 1)),
                50 + i, 50));
        }

        Ranked r = CandidateRanker.rank(all);

        assertThat(r.offered()).hasSize(3).containsExactly(all.get(0), all.get(1), all.get(2));
    }

    @Test
    void roundsUpToFifteen() {
        assertThat(CandidateRanker.roundUpToFifteen(60)).isEqualTo(60);
        assertThat(CandidateRanker.roundUpToFifteen(61)).isEqualTo(75);
        assertThat(CandidateRanker.roundUpToFifteen(1)).isEqualTo(15);
    }
}
