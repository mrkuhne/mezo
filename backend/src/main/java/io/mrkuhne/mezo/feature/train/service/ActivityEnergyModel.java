package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.TrainProperties;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * The ONE activity-energy model (mezo-32m82): net-of-rest kcal from the 2024 Adult Compendium.
 * {@code kcal = (MET − 1) × restKcalPerHour × hours}. The "−1" removes the resting energy that
 * BMR × NEAT already bills for all 24 hours (gross MET double-counted it). {@code restKcalPerHour}
 * is the person's own BMR / 24 — the Compendium's "corrected MET" (Byrne 2005), which replaces the
 * old sex/age/lean personal factor. Whole-session codes already include rests between sets or
 * rallies, so the duration is the whole session, never discounted.
 *
 * <p>Honest-null: unknown rest energy or a non-positive duration → {@link Optional#empty()}, never 0.
 * The frontend mirror ({@code data/train/activityEnergy.ts}) is bound to this class by the shared
 * golden vectors in {@code api/fixtures/activity-energy-vectors.json}.
 */
@Component
public class ActivityEnergyModel {

    /** Written into {@code tdee_bootstrap.activityModel}; the migration runner recomputes goals below it. */
    public static final int VERSION = 2;

    private static final String OTHER = "other";
    private static final BigDecimal HOURS_PER_DAY = BigDecimal.valueOf(24);

    private final TrainProperties props;

    public ActivityEnergyModel(TrainProperties props) {
        this.props = props;
    }

    /** BMR / 24 when the BMR is known, else 1 kcal per kg per hour, else empty. */
    public static Optional<BigDecimal> restKcalPerHour(BigDecimal bmrKcal, BigDecimal weightKg) {
        if (bmrKcal != null && bmrKcal.signum() > 0) {
            return Optional.of(bmrKcal.divide(HOURS_PER_DAY, MathContext.DECIMAL64));
        }
        if (weightKg != null && weightKg.signum() > 0) {
            return Optional.of(weightKg);
        }
        return Optional.empty();
    }

    /** RPE 1–4 light, 5–7 moderate, 8–10 hard; null (and every planned slot) = moderate. */
    public static String band(Integer rpe) {
        if (rpe == null) {
            return "moderate";
        }
        if (rpe <= 4) {
            return "light";
        }
        return rpe <= 7 ? "moderate" : "hard";
    }

    /** The MET of {@code kind} at the RPE's band; an unknown kind reads as {@code other}. */
    public double met(String kind, Integer rpe) {
        TrainProperties.MetBand row = kind == null ? null : props.energy().met().get(kind);
        if (row == null) {
            row = props.energy().met().get(OTHER);
        }
        return switch (band(rpe)) {
            case "light" -> row.light();
            case "hard" -> row.hard();
            default -> row.moderate();
        };
    }

    /** Net kcal of one session, or empty when the rest energy or a positive duration is unknown. */
    public Optional<Integer> netKcal(String kind, Integer rpe, int durationMin, BigDecimal restKcalPerHour) {
        if (restKcalPerHour == null || durationMin <= 0) {
            return Optional.empty();
        }
        BigDecimal kcal = BigDecimal.valueOf(met(kind, rpe) - 1)
            .multiply(restKcalPerHour)
            .multiply(BigDecimal.valueOf(durationMin))
            .divide(BigDecimal.valueOf(60), MathContext.DECIMAL64);
        return Optional.of(kcal.setScale(0, RoundingMode.HALF_UP).intValueExact());
    }
}
