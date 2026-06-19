package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Computes the <b>formula</b> TDEE bootstrap from a biometric profile + current weight (spec §6.1,
 * grounded numbers in {@code docs/research/queries/2026-06-18-goal-engine-numbers.md}). This is the
 * starting estimate before real intake data lands; the adaptive (back-calc) TDEE is deferred to a
 * later slice once Fuel calorie-logging exists.
 *
 * <h2>Model</h2>
 * <ul>
 *   <li><b>BMR — Katch-McArdle</b> when body-fat % is known (the more reliable path):
 *       {@code LBM = weight·(1 − bodyFatPct/100)}, {@code BMR = 370 + 21.6·LBM}; {@code formula="KATCH"}.</li>
 *   <li><b>BMR — Mifflin-St Jeor</b> otherwise: men {@code 10·kg + 6.25·cm − 5·age + 5},
 *       women {@code … − 161} (sex M/F); {@code formula="MSJ"}.</li>
 *   <li><b>PAL</b> from {@code profile.activityLevel} via {@link GoalEngineProperties.Pal#forLevel}
 *       (default MODERATE 1.55 when null/unknown). <b>TDEE = BMR × PAL.</b></li>
 * </ul>
 *
 * <p><b>Anti-double-count (spec §6.3):</b> the PAL multiplier already bakes in the athlete's
 * average activity energy — per-session MET deltas are <em>not</em> added here. Those are the
 * projection's block-boundary concern (Task 6).
 *
 * <p>Stateless, pure-deterministic, config-driven (PAL bands from {@link GoalEngineProperties});
 * no hardcoded multiplier. Caller supplies the current weight (latest weigh-in), so the service
 * has no repository dependency and is trivially unit-/integration-testable.
 */
@Service
@RequiredArgsConstructor
public class TdeeBootstrapService {

    private static final String FORMULA_MSJ = "MSJ";
    private static final String FORMULA_KATCH = "KATCH";

    /** Katch-McArdle constants: BMR = 370 + 21.6·LBM. */
    private static final BigDecimal KATCH_BASE = new BigDecimal("370");
    private static final BigDecimal KATCH_PER_KG_LBM = new BigDecimal("21.6");

    /** Mifflin-St Jeor coefficients: 10·kg + 6.25·cm − 5·age + sexConstant. */
    private static final BigDecimal MSJ_PER_KG = BigDecimal.TEN;
    private static final BigDecimal MSJ_PER_CM = new BigDecimal("6.25");
    private static final BigDecimal MSJ_PER_YEAR = new BigDecimal("5");
    private static final BigDecimal MSJ_MALE_CONSTANT = new BigDecimal("5");
    private static final BigDecimal MSJ_FEMALE_CONSTANT = new BigDecimal("-161");

    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

    /** Output precision: BMR/TDEE/PAL to 2 dp (kcal/day; the contract types are numbers). */
    private static final int SCALE = 2;

    private final GoalEngineProperties props;

    /**
     * Compute the formula TDEE bootstrap. Pure — {@code computedAt} is {@code OffsetDateTime.now()}
     * and age is derived from {@code profile.birthDate} relative to {@code LocalDate.now()} (the
     * codebase convention; no {@code Clock} bean exists).
     *
     * @param profile         the biometric profile (sex, heightCm, birthDate, bodyFatPct, activityLevel)
     * @param currentWeightKg the latest weigh-in (kg) — the BMR basis
     */
    public TdeeBootstrapJson compute(BiometricProfileEntity profile, BigDecimal currentWeightKg) {
        BigDecimal bmr;
        String formula;
        if (profile.getBodyFatPct() != null) {
            bmr = katchMcArdle(currentWeightKg, profile.getBodyFatPct());
            formula = FORMULA_KATCH;
        } else {
            int age = ageYears(profile.getBirthDate());
            bmr = mifflinStJeor(currentWeightKg, profile.getHeightCm(), age, profile.getSex());
            formula = FORMULA_MSJ;
        }

        BigDecimal pal = BigDecimal.valueOf(props.pal().forLevel(profile.getActivityLevel()));
        BigDecimal tdee = bmr.multiply(pal);

        // pal stays unrounded — it is a multiplier (e.g. 1.725), not a kcal value; only the
        // kcal outputs (bmr, tdee) are rounded to whole-ish kcal precision.
        return new TdeeBootstrapJson(scaled(bmr), scaled(tdee), pal, formula, OffsetDateTime.now());
    }

    /** Katch-McArdle: LBM = weight·(1 − bodyFatPct/100); BMR = 370 + 21.6·LBM. */
    private BigDecimal katchMcArdle(BigDecimal weightKg, BigDecimal bodyFatPct) {
        BigDecimal leanFraction = BigDecimal.ONE.subtract(bodyFatPct.divide(ONE_HUNDRED));
        BigDecimal lbm = weightKg.multiply(leanFraction);
        return KATCH_BASE.add(KATCH_PER_KG_LBM.multiply(lbm));
    }

    /** Mifflin-St Jeor: 10·kg + 6.25·cm − 5·age + (men +5 | women −161). */
    private BigDecimal mifflinStJeor(BigDecimal weightKg, BigDecimal heightCm, int age, String sex) {
        BigDecimal sexConstant = "F".equalsIgnoreCase(sex) ? MSJ_FEMALE_CONSTANT : MSJ_MALE_CONSTANT;
        return MSJ_PER_KG.multiply(weightKg)
            .add(MSJ_PER_CM.multiply(heightCm))
            .subtract(MSJ_PER_YEAR.multiply(BigDecimal.valueOf(age)))
            .add(sexConstant);
    }

    private static int ageYears(LocalDate birthDate) {
        return (int) ChronoUnit.YEARS.between(birthDate, LocalDate.now());
    }

    private static BigDecimal scaled(BigDecimal value) {
        return value.setScale(SCALE, RoundingMode.HALF_UP);
    }
}
