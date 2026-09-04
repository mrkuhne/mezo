package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/**
 * Verifies the formula-TDEE bootstrap against the spec's worked numbers (spec §6.1 + grounded
 * research {@code docs/research/queries/2026-06-18-goal-engine-numbers.md}).
 *
 * <p>Pure logic: no Spring context (model: {@code ProgressionCurveTest}). The service is
 * stateless and reads only {@code props.neat()}, so the properties record is built by hand with
 * the application.yml defaults — the yml→record binding itself is covered by
 * {@code GoalEnginePropertiesIT}. Builds {@link BiometricProfileEntity} in-memory (the service
 * is pure, no DB read). Birth dates are derived from {@code LocalDate.now()} so the age-based
 * assertions are stable on any run date.
 */
class TdeeBootstrapServiceTest {

    /** kcal tolerance — covers double↔BigDecimal rounding across the BMR×NEAT chain. */
    private static final BigDecimal TOL = new BigDecimal("0.6");

    // Only neat() is read by the service; the other components are required by the record but
    // irrelevant here — they mirror the application.yml defaults for completeness.
    private final TdeeBootstrapService service = new TdeeBootstrapService(
        new GoalEngineProperties(
            new GoalEngineProperties.Neat(1.20, 1.35, 1.50),
            7700,
            new GoalEngineProperties.Protein(2.0, 1.6, 2.2, 2.3, 3.1, 2.6),
            new GoalEngineProperties.Rate(0.7, 1.0, 0.5, 1.0),
            new GoalEngineProperties.Volume(8, 6),
            new GoalEngineProperties.Strength(-5.0),
            new GoalEngineProperties.Ewma(10),
            new GoalEngineProperties.Diet(0.275, 0.20, 0.40, 0.22, 0.5),
            0,
            300,
            new GoalEngineProperties.Suggestion(java.util.Map.of()),
            new GoalEngineProperties.Adaptive(120, 50, 7, 4, 5.0),
            new GoalEngineProperties.Overview(new BigDecimal("20"), new BigDecimal("0.10"))));

    /** A 35-year-old today: birthDate = today − 35 years (mid-year to dodge birthday edges). */
    private static LocalDate birthDateForAge(int years) {
        return LocalDate.now().minusYears(years).minusDays(1);
    }

    private static BiometricProfileEntity profile(
        String sex, String heightCm, int age, String bodyFatPct, String activityLevel) {
        BiometricProfileEntity e = new BiometricProfileEntity();
        e.setSex(sex);
        e.setHeightCm(new BigDecimal(heightCm));
        e.setBirthDate(birthDateForAge(age));
        if (bodyFatPct != null) {
            e.setBodyFatPct(new BigDecimal(bodyFatPct));
        }
        e.setActivityLevel(activityLevel);
        return e;
    }

    @Test
    void testCompute_shouldUseMifflinStJeor_whenBodyFatAbsent() {
        // 84 kg, 180 cm, 35 yr, MALE, no bodyfat, MIXED (1.35), no scheduled training.
        // MSJ BMR = 10·84 + 6.25·180 − 5·35 + 5 = 840 + 1125 − 175 + 5 = 1795.
        // neatBaseline = 1795·1.35; weeklyEat 0 → tdee == baseline.
        TdeeBootstrapJson r =
            service.compute(profile("M", "180.0", 35, null, "MIXED"), new BigDecimal("84"), BigDecimal.ZERO);

        assertThat(r.formula()).isEqualTo("MSJ");
        assertThat(r.bmr().doubleValue()).isCloseTo(1795, within(1.0));
        assertThat(r.neat().doubleValue()).isEqualTo(1.35);
        assertThat(r.neatBaselineKcal().doubleValue()).isCloseTo(1795 * 1.35, within(1.0));
        assertThat(r.weeklyEatKcalPerDay().doubleValue()).isZero();
        assertThat(r.tdee().doubleValue()).isCloseTo(1795 * 1.35, within(1.0)); // weeklyEat 0 → tdee == baseline
        assertThat(r.computedAt()).isNotNull();
    }

    @Test
    void testCompute_shouldAddWeeklyEatToTdee_whenScheduled() {
        // Scheduled training energy (weeklyEatKcalPerDay = 500) is added on top of the NEAT baseline.
        TdeeBootstrapJson r =
            service.compute(profile("M", "180.0", 35, null, "MIXED"), new BigDecimal("84"), new BigDecimal("500"));

        assertThat(r.tdee().doubleValue()).isCloseTo(r.neatBaselineKcal().doubleValue() + 500, within(0.5));
    }

    @Test
    void testCompute_shouldUseKatchMcArdle_whenBodyFatPresent() {
        // Same athlete + 15% bodyfat → LBM = 84·0.85 = 71.4; BMR = 370 + 21.6·71.4 = 1912.24.
        // MIXED NEAT 1.35 → tdee = 1912.24·1.35 ≈ 2581.52 (weeklyEat 0).
        TdeeBootstrapJson r =
            service.compute(profile("M", "180.0", 35, "15.0", "MIXED"), new BigDecimal("84"), BigDecimal.ZERO);

        assertThat(r.formula()).isEqualTo("KATCH");
        assertThat(r.bmr().doubleValue()).isCloseTo(1912.24, within(0.6));
        assertThat(r.neat().doubleValue()).isEqualTo(1.35);
        assertThat(r.tdee().doubleValue()).isCloseTo(2581.52, within(0.6));
    }

    @Test
    void testCompute_shouldSubtract161Constant_whenFemaleMsj() {
        // Female MSJ uses −161 vs male +5 → BMR is exactly 166 kcal lower for identical inputs.
        TdeeBootstrapJson male =
            service.compute(profile("M", "180.0", 35, null, "MIXED"), new BigDecimal("84"), BigDecimal.ZERO);
        TdeeBootstrapJson female =
            service.compute(profile("F", "180.0", 35, null, "MIXED"), new BigDecimal("84"), BigDecimal.ZERO);

        assertThat(female.formula()).isEqualTo("MSJ");
        // Female BMR = 1795 − 5 − 161 = 1629.
        assertThat(female.bmr().doubleValue()).isCloseTo(1629.0, within(0.6));
        assertThat(male.bmr().subtract(female.bmr()).doubleValue()).isCloseTo(166.0, within(TOL.doubleValue()));
    }

    @Test
    void testCompute_shouldUseDeskBand_whenActivityLevelDesk() {
        // DESK lifestyle band → NEAT 1.20.
        TdeeBootstrapJson r =
            service.compute(profile("M", "180.0", 35, null, "DESK"), new BigDecimal("84"), BigDecimal.ZERO);

        assertThat(r.neat().doubleValue()).isEqualTo(1.20);
    }

    @Test
    void testCompute_shouldDefaultToMixed_whenActivityLevelNull() {
        // Null activity level → MIXED default NEAT 1.35.
        TdeeBootstrapJson r =
            service.compute(profile("M", "180.0", 35, null, null), new BigDecimal("84"), BigDecimal.ZERO);

        assertThat(r.neat().doubleValue()).isEqualTo(1.35);
    }
}
