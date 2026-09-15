package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import java.math.BigDecimal;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * The protein target's own arithmetic (mezo-jb84).
 *
 * <p>Why this file exists: the owner's target sat at 217 g and the Mérsékelt/Magas switch moved it
 * by exactly nothing. The tier only ever chose the BODY-WEIGHT coefficient, while the lean-mass
 * path stayed pinned at its high end — so for anyone lean enough that the LBM path wins, the
 * switch was inert and the target sat at the cap whatever was chosen. The band's lower endpoints
 * were already configured and simply never read.
 *
 * <p>These are pure arithmetic rounds on a directly constructed service: no Spring, no database,
 * so they run in the local gate too — which is where a number the user lives by belongs.
 */
class ProteinTargetTest {

    /** The application.yml band, verbatim: BW 1.6 / 2.0 / 2.2, LBM 2.3 / 2.7 / 3.1, cap 2.6. */
    private final GoalEvaluationService service = new GoalEvaluationService(
        new GoalEngineProperties(
            new GoalEngineProperties.Neat(1.20, 1.35, 1.50),
            7700,
            new GoalEngineProperties.Protein(2.0, 1.6, 2.2, 2.3, 2.7, 3.1, 2.6),
            new GoalEngineProperties.Rate(0.7, 1.0, 0.5, 1.0),
            new GoalEngineProperties.Volume(8, 6),
            new GoalEngineProperties.Strength(-5.0),
            new GoalEngineProperties.Ewma(10),
            new GoalEngineProperties.Diet(0.275, 0.20, 0.40, 0.22, 0.5),
            0,
            300,
            new GoalEngineProperties.Suggestion(Map.of()),
            new GoalEngineProperties.Adaptive(120, 50, 7, 4, 5.0),
            new GoalEngineProperties.Overview(new BigDecimal("20"), new BigDecimal("0.10"))),
        null);

    private static final BigDecimal WEIGHT = new BigDecimal("83.5");
    /** 16 % body fat → 70.14 kg lean mass, the shape that made the LBM path win. */
    private static final BigDecimal BODY_FAT = new BigDecimal("16");

    private int target(String tier) {
        return service.proteinTargetGrams(WEIGHT, BODY_FAT, tier);
    }

    @Test
    void tierMovesTheTarget_forALeanBodyWhereTheLbmPathWins() {
        // THE regression: these three were 217 / 217 / 217 before the fix, because the tier never
        // touched the LBM coefficient and the cap swallowed the difference.
        assertThat(target("low")).isLessThan(target("moderate"));
        assertThat(target("moderate")).isLessThan(target("high"));
    }

    @Test
    void eachTierTakesTheHigherOfTheTwoPaths() {
        // low:      max(83.5 × 1.6 = 133.6, 70.14 × 2.3 = 161.3) = 161
        // moderate: max(83.5 × 2.0 = 167.0, 70.14 × 2.7 = 189.4) = 189
        // high:     max(83.5 × 2.2 = 183.7, 70.14 × 3.1 = 217.4) = 217
        assertThat(target("low")).isEqualTo(161);
        assertThat(target("moderate")).isEqualTo(189);
        assertThat(target("high")).isEqualTo(217);
    }

    @Test
    void theCapStillBinds() {
        // A very lean body drives the LBM path above the cap; 2.6 × BW is the last word.
        int capped = service.proteinTargetGrams(WEIGHT, new BigDecimal("5"), "high");
        assertThat(capped).isEqualTo(new BigDecimal("2.6").multiply(WEIGHT).intValue());
    }

    @Test
    void withoutBodyFatOnlyTheBodyWeightPathRuns() {
        assertThat(service.proteinTargetGrams(WEIGHT, null, "low")).isEqualTo(134);
        assertThat(service.proteinTargetGrams(WEIGHT, null, "moderate")).isEqualTo(167);
        assertThat(service.proteinTargetGrams(WEIGHT, null, "high")).isEqualTo(184);
    }

    @Test
    void anUnknownTierFallsBackToModerate_neverToTheHighest() {
        // A stored value we do not recognise must not silently become the largest target.
        assertThat(service.proteinTargetGrams(WEIGHT, BODY_FAT, "nonsense")).isEqualTo(target("moderate"));
        assertThat(service.proteinTargetGrams(WEIGHT, BODY_FAT, null)).isEqualTo(target("moderate"));
    }
}
