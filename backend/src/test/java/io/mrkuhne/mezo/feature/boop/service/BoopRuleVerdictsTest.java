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
}
