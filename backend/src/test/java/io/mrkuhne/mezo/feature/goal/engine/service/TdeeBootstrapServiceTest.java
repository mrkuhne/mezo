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
 * stateless and reads only {@code props.pal()}, so the properties record is built by hand with
 * the application.yml defaults — the yml→record binding itself is covered by
 * {@code GoalEnginePropertiesIT}. Builds {@link BiometricProfileEntity} in-memory (the service
 * is pure, no DB read). Birth dates are derived from {@code LocalDate.now()} so the age-based
 * assertions are stable on any run date.
 */
class TdeeBootstrapServiceTest {

    /** kcal tolerance — covers double↔BigDecimal rounding across the BMR×PAL chain. */
    private static final BigDecimal TOL = new BigDecimal("0.6");

    // Only pal() is read by the service; the other components are required by the record but
    // irrelevant here — they mirror the application.yml defaults for completeness.
    private final TdeeBootstrapService service = new TdeeBootstrapService(
        new GoalEngineProperties(
            new GoalEngineProperties.Pal(1.2, 1.375, 1.55, 1.725, 1.9),
            7700,
            new GoalEngineProperties.Protein(2.0, 1.6, 2.2, 2.3, 3.1, 2.6),
            new GoalEngineProperties.Rate(0.7, 1.0, 0.5, 1.0),
            new GoalEngineProperties.Volume(8, 6),
            new GoalEngineProperties.Strength(-5.0),
            new GoalEngineProperties.Ewma(10),
            new GoalEngineProperties.Met(325, 500, 500, 1150),
            0,
            300));

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
        // 84 kg, 180 cm, 35 yr, MALE, no bodyfat, MODERATE (1.55).
        // MSJ BMR = 10·84 + 6.25·180 − 5·35 + 5 = 840 + 1125 − 175 + 5 = 1795; TDEE = 1795·1.55.
        TdeeBootstrapJson r =
            service.compute(profile("M", "180.0", 35, null, "MODERATE"), new BigDecimal("84"));

        assertThat(r.formula()).isEqualTo("MSJ");
        assertThat(r.bmr().doubleValue()).isCloseTo(1795.0, within(0.6));
        assertThat(r.tdee().doubleValue()).isCloseTo(2782.25, within(0.6));
        assertThat(r.pal().doubleValue()).isEqualTo(1.55);
        assertThat(r.computedAt()).isNotNull();
    }

    @Test
    void testCompute_shouldUseKatchMcArdle_whenBodyFatPresent() {
        // Same athlete + 15% bodyfat → LBM = 84·0.85 = 71.4; BMR = 370 + 21.6·71.4 = 1912.24;
        // TDEE = 1912.24·1.55 ≈ 2963.97.
        TdeeBootstrapJson r =
            service.compute(profile("M", "180.0", 35, "15.0", "MODERATE"), new BigDecimal("84"));

        assertThat(r.formula()).isEqualTo("KATCH");
        assertThat(r.bmr().doubleValue()).isCloseTo(1912.24, within(0.6));
        assertThat(r.tdee().doubleValue()).isCloseTo(2963.97, within(0.6));
        assertThat(r.pal().doubleValue()).isEqualTo(1.55);
    }

    @Test
    void testCompute_shouldSubtract161Constant_whenFemaleMsj() {
        // Female MSJ uses −161 vs male +5 → BMR is exactly 166 kcal lower for identical inputs.
        TdeeBootstrapJson male =
            service.compute(profile("M", "180.0", 35, null, "MODERATE"), new BigDecimal("84"));
        TdeeBootstrapJson female =
            service.compute(profile("F", "180.0", 35, null, "MODERATE"), new BigDecimal("84"));

        assertThat(female.formula()).isEqualTo("MSJ");
        // Female BMR = 1795 − 5 − 161 = 1629.
        assertThat(female.bmr().doubleValue()).isCloseTo(1629.0, within(0.6));
        assertThat(male.bmr().subtract(female.bmr()).doubleValue()).isCloseTo(166.0, within(TOL.doubleValue()));
    }

    @Test
    void testCompute_shouldDefaultToModeratePal_whenActivityLevelNull() {
        TdeeBootstrapJson nullLevel =
            service.compute(profile("M", "180.0", 35, null, null), new BigDecimal("84"));
        TdeeBootstrapJson moderate =
            service.compute(profile("M", "180.0", 35, null, "MODERATE"), new BigDecimal("84"));

        assertThat(nullLevel.pal().doubleValue()).isEqualTo(1.55);
        assertThat(nullLevel.tdee().doubleValue()).isCloseTo(moderate.tdee().doubleValue(), within(0.01));
    }

    @Test
    void testCompute_shouldScaleTdeeWithPal_whenActivityLevelVery() {
        // VERY → PAL 1.725. TDEE = 1795·1.725 = 3096.375.
        TdeeBootstrapJson r =
            service.compute(profile("M", "180.0", 35, null, "VERY"), new BigDecimal("84"));

        assertThat(r.pal().doubleValue()).isEqualTo(1.725);
        assertThat(r.tdee().doubleValue()).isCloseTo(3096.375, within(0.6));
    }
}
