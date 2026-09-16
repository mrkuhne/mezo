package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/**
 * Table tests for the personalised MET kcal decider. Every expected number is the prototype's own
 * arithmetic (docs/design_2.0/prototypes/companion-titanium/sport-state.js) evaluated by hand — if
 * a constant drifts here, the estimate the user sees drifted too.
 */
class SportEnergyCalculatorTest {

    private static final BigDecimal W = new BigDecimal("81.4"); // the prototype athlete
    private static final BigDecimal BF18 = new BigDecimal("18");

    // ---- personalFactor ------------------------------------------------------------------------

    @Test
    void personalFactor_shouldApplyFemaleFactor_whenSexIsF() {
        assertThat(SportEnergyCalculator.personalFactor("F", 30, null)).isEqualTo(0.94, within(1e-9));
        assertThat(SportEnergyCalculator.personalFactor("female", 30, null)).isEqualTo(0.94, within(1e-9));
        assertThat(SportEnergyCalculator.personalFactor("M", 30, null)).isEqualTo(1.0, within(1e-9));
    }

    @Test
    void personalFactor_shouldDriftMinusTwoTenthsPercentPerYearPastThirty_whenAgeGiven() {
        assertThat(SportEnergyCalculator.personalFactor("M", 34, null)).isEqualTo(0.992, within(1e-9));
    }

    @Test
    void personalFactor_shouldClampAgeFactor_whenAgeFarFromThirty() {
        assertThat(SportEnergyCalculator.personalFactor("M", 90, null)).isEqualTo(0.90, within(1e-9));
        assertThat(SportEnergyCalculator.personalFactor("M", 0, null)).isEqualTo(1.05, within(1e-9));
    }

    @Test
    void personalFactor_shouldClampLeanFactor_whenBodyFatExtreme() {
        assertThat(SportEnergyCalculator.personalFactor("M", 30, BigDecimal.ZERO)).isEqualTo(1.08, within(1e-9));
        assertThat(SportEnergyCalculator.personalFactor("M", 30, new BigDecimal("60"))).isEqualTo(0.92, within(1e-9));
    }

    @Test
    void personalFactor_shouldBeOneLean_whenBodyFatUnknown() {
        assertThat(SportEnergyCalculator.personalFactor("M", 30, null)).isEqualTo(1.0, within(1e-9));
    }

    @Test
    void personalFactor_shouldMultiplyAllThree_whenEveryInputPresent() {
        // 1 (male) * 0.992 (34y) * 1.028 (18% body fat) — the prototype athlete
        assertThat(SportEnergyCalculator.personalFactor("M", 34, BF18)).isEqualTo(1.019776, within(1e-9));
    }

    // ---- metFor: one row per sport -------------------------------------------------------------

    @Test
    void metFor_shouldFoldVolleyballModesIntoIntensity_whenVolleyball() {
        // training 4.5 at intensity 5, match 6.5 at intensity 10 (sport-state.js:41)
        assertThat(SportEnergyCalculator.metFor("volleyball", 5)).isEqualTo(4.5, within(1e-9));
        assertThat(SportEnergyCalculator.metFor("volleyball", 10)).isEqualTo(6.5, within(1e-9));
        assertThat(SportEnergyCalculator.metFor("volleyball", null)).isEqualTo(5.3, within(1e-9)); // default 7
    }

    @Test
    void metFor_shouldFoldFootballModesIntoIntensity_whenFootball() {
        assertThat(SportEnergyCalculator.metFor("football", 5)).isEqualTo(7.0, within(1e-9));
        assertThat(SportEnergyCalculator.metFor("football", 10)).isEqualTo(10.0, within(1e-9));
    }

    @Test
    void metFor_shouldFoldBasketballModesIntoIntensity_whenBasketball() {
        assertThat(SportEnergyCalculator.metFor("basketball", 5)).isEqualTo(6.5, within(1e-9));
        assertThat(SportEnergyCalculator.metFor("basketball", 10)).isEqualTo(8.0, within(1e-9));
    }

    @Test
    void metFor_shouldFoldTennisModesIntoIntensity_whenTennis() {
        assertThat(SportEnergyCalculator.metFor("tennis", 5)).isEqualTo(5.0, within(1e-9));   // doubles
        assertThat(SportEnergyCalculator.metFor("tennis", 10)).isEqualTo(7.3, within(1e-9));  // singles
    }

    @Test
    void metFor_shouldUsePrototypeIntensityFormula_whenTrxOrCross() {
        assertThat(SportEnergyCalculator.metFor("trx", 7)).isEqualTo(3.5 + 7 * 0.42, within(1e-9));
        assertThat(SportEnergyCalculator.metFor("cross", 8)).isEqualTo(5 + 8 * 0.5, within(1e-9));
    }

    @Test
    void metFor_shouldUsePrototypeDefaultSession_whenBikeSwimOrHike() {
        // bike: 25 km in 60 min on flat terrain -> bikeMet(25) = 25*0.42 + 0.6
        assertThat(SportEnergyCalculator.metFor("bike", 6)).isEqualTo(11.1, within(1e-9));
        // swim: freestyle ("gyors") 8.3
        assertThat(SportEnergyCalculator.metFor("swim", 6)).isEqualTo(8.3, within(1e-9));
        // hike: 4 MET walking + 0.35 per 100 m of the default 300 m climb
        assertThat(SportEnergyCalculator.metFor("hike", null)).isEqualTo(5.05, within(1e-9));
    }

    @Test
    void metFor_shouldFallBackToModerateEffort_whenOtherOrUnknownSport() {
        assertThat(SportEnergyCalculator.metFor("other", 6)).isEqualTo(5.0, within(1e-9));
        assertThat(SportEnergyCalculator.metFor("kajak", 6)).isEqualTo(5.0, within(1e-9));
        assertThat(SportEnergyCalculator.metFor(null, null)).isEqualTo(5.0, within(1e-9));
    }

    // ---- the ported pace formulas --------------------------------------------------------------

    @Test
    void runMet_shouldRiseWithPaceAndClamp_whenSpeedGiven() {
        assertThat(SportEnergyCalculator.runMet(10.0)).isEqualTo(10.5, within(1e-9)); // 10*1.02 + 0.3
        assertThat(SportEnergyCalculator.runMet(30.0)).isEqualTo(19.0, within(1e-9)); // upper clamp
        assertThat(SportEnergyCalculator.runMet(1.0)).isEqualTo(4.0, within(1e-9));   // lower clamp
        assertThat(SportEnergyCalculator.runMet(0.0)).isEqualTo(0.0, within(1e-9));
    }

    @Test
    void bikeMet_shouldRiseWithPaceAndClamp_whenSpeedGiven() {
        assertThat(SportEnergyCalculator.bikeMet(25.0)).isEqualTo(11.1, within(1e-9)); // 25*0.42 + 0.6
        assertThat(SportEnergyCalculator.bikeMet(60.0)).isEqualTo(16.0, within(1e-9)); // upper clamp
        assertThat(SportEnergyCalculator.bikeMet(1.0)).isEqualTo(3.5, within(1e-9));   // lower clamp
    }

    @Test
    void hikeMet_shouldAddAThirdMetPerHundredMetresOfClimb_whenClimbGiven() {
        assertThat(SportEnergyCalculator.hikeMet(0)).isEqualTo(4.0, within(1e-9));
        assertThat(SportEnergyCalculator.hikeMet(300)).isEqualTo(5.05, within(1e-9));
        assertThat(SportEnergyCalculator.hikeMet(4000)).isEqualTo(11.0, within(1e-9)); // upper clamp
    }

    // ---- estimate ------------------------------------------------------------------------------

    @Test
    void estimate_shouldApplyMetFormulaAndPersonalFactor_whenEveryInputPresent() {
        // 5.3 MET * 3.5 * 81.4 / 200 * 90 min * 1.019776
        assertThat(SportEnergyCalculator.estimate("volleyball", 90, 7, W, "M", 34, BF18))
            .contains(693);
    }

    @Test
    void estimate_shouldReturnOnePerSport_whenTheTableIsWalked() {
        assertThat(SportEnergyCalculator.estimate("volleyball", 90, 10, W, "M", 34, BF18)).contains(850);
        assertThat(SportEnergyCalculator.estimate("cross", 45, 8, W, "M", 34, BF18)).contains(588);
        assertThat(SportEnergyCalculator.estimate("trx", 45, 7, W, "M", 34, BF18)).contains(421);
        assertThat(SportEnergyCalculator.estimate("bike", 60, 6, W, "M", 34, BF18)).contains(967);
        assertThat(SportEnergyCalculator.estimate("swim", 40, 6, W, "M", 34, BF18)).contains(482);
        assertThat(SportEnergyCalculator.estimate("football", 90, 7, W, "M", 34, BF18)).contains(1072);
        assertThat(SportEnergyCalculator.estimate("basketball", 75, 7, W, "M", 34, BF18)).contains(774);
        assertThat(SportEnergyCalculator.estimate("tennis", 60, 6, W, "M", 34, BF18)).contains(476);
        assertThat(SportEnergyCalculator.estimate("hike", 150, null, W, "M", 34, BF18)).contains(1100);
        assertThat(SportEnergyCalculator.estimate("other", 60, 6, W, "M", 34, BF18)).contains(436);
    }

    @Test
    void estimate_shouldApplyTheFemaleFactor_whenSexIsF() {
        // 5 MET * 3.5 * 70 / 200 * 60 * (0.94 * 1 * 1)
        assertThat(SportEnergyCalculator.estimateWithMet(5.0, 60, new BigDecimal("70"), "F", 30,
            new BigDecimal("25"))).contains(345);
    }

    @Test
    void estimate_shouldBeEmpty_whenWeightUnknown() {
        assertThat(SportEnergyCalculator.estimate("volleyball", 90, 7, null, "M", 34, BF18))
            .isEmpty();
        assertThat(SportEnergyCalculator.estimateWithMet(8.0, 90, null, "M", 34, BF18)).isEmpty();
    }

    @Test
    void estimate_shouldBeEmpty_whenDurationMissingOrNonPositive() {
        assertThat(SportEnergyCalculator.estimate("volleyball", 0, 7, W, "M", 34, BF18)).isEmpty();
        assertThat(SportEnergyCalculator.estimate("volleyball", -5, 7, W, "M", 34, BF18)).isEmpty();
    }

    @Test
    void estimate_shouldNeverReturnZero_whenTheSessionIsVeryShort() {
        Optional<Integer> kcal = SportEnergyCalculator.estimate("volleyball", 1, 1, W, "M", 34, BF18);
        assertThat(kcal).isPresent();
        assertThat(kcal.orElseThrow()).isPositive();
    }
}
