package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Verifies the formula-TDEE bootstrap against the spec's worked numbers (spec §6.1 + grounded
 * research {@code docs/research/queries/2026-06-18-goal-engine-numbers.md}).
 *
 * <p>Uses the real bound {@link io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties} (PAL
 * bands from {@code application.yml}), but builds {@link BiometricProfileEntity} in-memory — the
 * service is pure (no DB read), so no persistence is needed. Birth dates are derived from
 * {@code LocalDate.now()} so the age-based assertions are stable on any run date.
 */
@SpringBootTest
class TdeeBootstrapServiceIT {

    /** kcal tolerance — covers double↔BigDecimal rounding across the BMR×PAL chain. */
    private static final BigDecimal TOL = new BigDecimal("0.6");

    @Autowired
    private TdeeBootstrapService service;

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
