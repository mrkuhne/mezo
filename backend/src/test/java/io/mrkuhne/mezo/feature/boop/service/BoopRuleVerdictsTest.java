package io.mrkuhne.mezo.feature.boop.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.boop.service.BoopScores.Scores;
import io.mrkuhne.mezo.feature.boop.service.BoopVerdictWriter.Verdict;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Final review M2 (mezo-r36n9.7): the rule verdicts stay honest when data is missing. */
class BoopRuleVerdictsTest {

    private final RuleVerdicts rules = new RuleVerdicts(9000);
    private final BoopScores scores = new BoopScores(9000);

    @Test
    void mozgasSaysThereIsNoStepDataYet_whenNoStepsArrived() {
        BoopDay d = BoopBriefFixtures.day(null, null, List.of());
        Scores s = scores.compute(d, LocalTime.of(8, 0));

        Verdict mozgas = rules.write(d, s, LocalTime.of(8, 0)).mozgas();

        assertThat(mozgas.headline()).isEqualTo("Még nincs lépésadat");
        assertThat(mozgas.sentence()).doesNotContain("Lépéscél nélkül").doesNotContain("előtted");
    }

    /**
     * Boop B4 (mezo-r36n9.14): the day now carries the PLANNED-but-unlogged windows too, so the
     * "next unlogged meal" branch — dead while every meal was a logged one — names the next window
     * by its own name and time instead of falling through to the protein-gap sentence.
     */
    @Test
    void nextMealTipNamesTheNextWindow() {
        BoopDay d = BoopBriefFixtures.day(null, 4000, List.of(), List.of(
            new BoopDay.Meal(LocalTime.of(7, 0), "Reggeli", "breakfast", 450, 25, true),
            new BoopDay.Meal(LocalTime.of(10, 30), "Tízórai", "snack", 300, 20, false),
            new BoopDay.Meal(LocalTime.of(14, 0), "Ebéd", "lunch", 700, 45, false)));
        Scores s = scores.compute(d, LocalTime.of(9, 0));

        String tip = rules.write(d, s, LocalTime.of(9, 0)).nextMealTip();

        assertThat(tip).startsWith("Következik: Tízórai, 10:30.");
        assertThat(tip).doesNotContain("Ebéd");
    }
}
