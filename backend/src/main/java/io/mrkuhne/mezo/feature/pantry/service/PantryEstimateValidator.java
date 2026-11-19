package io.mrkuhne.mezo.feature.pantry.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;
import tools.jackson.databind.ObjectMapper;

/**
 * Decides whether an AI nutrition estimate may become a food (mezo-r36n9.63). The model proposes
 * per-100 g/ml facts for a generic food; this class is the gate: the four headline figures must be
 * present, inside physical ranges, and agree with each other — an estimate whose stated energy does
 * not match the energy of its own macros is rejected whole, because a number that contradicts itself
 * is worse than no number.
 *
 * <p>The four secondary facts (fibre, sugar, salt, saturated fat) are kept only when plausible on
 * their own; an implausible one becomes {@code null} ("no data"), never 0 and never a reason to reject.
 * NOVA and allergens are not part of the answer at all: they are never guessed.
 *
 * <p>Pure and Spring-free.
 */
public final class PantryEstimateValidator {

    /** Per 100 g or 100 ml. The four secondary facts may be null. */
    public record Facts(String basisUnit, BigDecimal kcal, BigDecimal proteinG, BigDecimal carbsG, BigDecimal fatG,
                        BigDecimal fiberG, BigDecimal sugarG, BigDecimal saltG, BigDecimal saturatedFatG) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Answer(String basisUnit, BigDecimal kcal, BigDecimal proteinG, BigDecimal carbsG, BigDecimal fatG,
                          BigDecimal fiberG, BigDecimal sugarG, BigDecimal saltG, BigDecimal saturatedFatG) {}

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    /** Pure fat is ~900 kcal/100 g; nothing edible exceeds it. */
    private static final BigDecimal MAX_KCAL = BigDecimal.valueOf(900);
    /** Absolute slack between the stated energy and 4p + 4c + 9f (fibre, polyols, rounding). */
    private static final double KCAL_SLACK_ABS = 40;
    /** Relative slack, for energy-dense foods. */
    private static final double KCAL_SLACK_REL = 0.25;

    private PantryEstimateValidator() {
    }

    /**
     * Empty when the answer is unreadable, a headline figure is missing or outside 0..100 g
     * (kcal 0..900), the macros together exceed 100 g, or {@code |4p + 4c + 9f − kcal|} is larger than
     * {@code max(40, 0.25 · kcal)}.
     */
    public static Optional<Facts> validate(String llmJson) {
        Answer a;
        try {
            String json = llmJson.substring(llmJson.indexOf('{'), llmJson.lastIndexOf('}') + 1);
            a = MAPPER.readValue(json, Answer.class);
        } catch (Exception e) {
            return Optional.empty();
        }
        if (a == null || !inRange(a.kcal(), MAX_KCAL) || !inRange(a.proteinG(), HUNDRED)
                || !inRange(a.carbsG(), HUNDRED) || !inRange(a.fatG(), HUNDRED)) {
            return Optional.empty();
        }
        double p = a.proteinG().doubleValue();
        double c = a.carbsG().doubleValue();
        double f = a.fatG().doubleValue();
        double kcal = a.kcal().doubleValue();
        if (p + c + f > 100.5) {
            return Optional.empty();
        }
        if (Math.abs(4 * p + 4 * c + 9 * f - kcal) > Math.max(KCAL_SLACK_ABS, KCAL_SLACK_REL * kcal)) {
            return Optional.empty();
        }
        String basis = a.basisUnit() != null && "ml".equalsIgnoreCase(a.basisUnit().strip()) ? "ml" : "g";
        return Optional.of(new Facts(basis, round(a.kcal()), round(a.proteinG()), round(a.carbsG()), round(a.fatG()),
            within(a.fiberG(), HUNDRED), within(a.sugarG(), a.carbsG()), within(a.saltG(), HUNDRED),
            within(a.saturatedFatG(), a.fatG())));
    }

    private static boolean inRange(BigDecimal v, BigDecimal max) {
        return v != null && v.signum() >= 0 && v.compareTo(max) <= 0;
    }

    /** A secondary fact survives only inside {@code 0..max}; otherwise it is "no data". */
    private static BigDecimal within(BigDecimal v, BigDecimal max) {
        return inRange(v, max) ? round(v) : null;
    }

    private static BigDecimal round(BigDecimal v) {
        return v.setScale(1, RoundingMode.HALF_UP);
    }
}
