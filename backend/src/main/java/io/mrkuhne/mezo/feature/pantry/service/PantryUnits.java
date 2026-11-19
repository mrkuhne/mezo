package io.mrkuhne.mezo.feature.pantry.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

/**
 * Turns a said amount ("2 ek", "30 dkg", "1 fej") into a food's BASIS unit (mezo-r36n9.63).
 *
 * <p>Why it exists: a saved recipe line counts as {@code amount ÷ the food's basis amount × its
 * facts}, whatever the line's unit says — so "2 ek" stored against a per-100-g food would silently
 * count as 2 g. Once a row has a food, its unit IS that food's basis unit, and this is the one place
 * that converts into it. What converts exactly is filled in; what does not (a volume against a mass
 * food, a piece, a can, no amount at all) is prefilled where a rough rule exists and comes back with
 * {@code doubt = true}, so the caller holds the save until the owner has looked.
 *
 * <p>Pure and Spring-free; unit spellings fold through {@link PantryNameIndex}'s synonyms.
 */
public final class PantryUnits {

    /** {@code amount} in {@code unit} (the food's basis unit); {@code doubt} = the owner must confirm it. */
    public record Resolved(BigDecimal amount, String unit, boolean doubt) {}

    private static final String DEFAULT_BASIS = "g";

    /** Said unit -> grams. */
    private static final Map<String, BigDecimal> MASS = Map.of(
        "g", BigDecimal.ONE, "dkg", BigDecimal.TEN, "dag", BigDecimal.TEN, "deka", BigDecimal.TEN,
        "kg", BigDecimal.valueOf(1000), "kilo", BigDecimal.valueOf(1000));

    /** Said unit -> millilitres (a tablespoon is 15 ml, a teaspoon 5 ml). */
    private static final Map<String, BigDecimal> VOLUME = Map.ofEntries(
        Map.entry("ml", BigDecimal.ONE), Map.entry("cl", BigDecimal.TEN), Map.entry("dl", BigDecimal.valueOf(100)),
        Map.entry("l", BigDecimal.valueOf(1000)), Map.entry("liter", BigDecimal.valueOf(1000)),
        Map.entry("ek", BigDecimal.valueOf(15)), Map.entry("evokanal", BigDecimal.valueOf(15)),
        Map.entry("tk", BigDecimal.valueOf(5)), Map.entry("teaskanal", BigDecimal.valueOf(5)));

    private PantryUnits() {
    }

    /** {@code saidAmount} may be null (nothing stated). A null/blank {@code basisUnit} is grams. */
    public static Resolved toBasis(BigDecimal saidAmount, String saidUnit, String basisUnit) {
        String basis = basisUnit == null || basisUnit.isBlank() ? DEFAULT_BASIS : basisUnit.strip();
        if (saidAmount == null) {
            return new Resolved(BigDecimal.ZERO, basis, true);
        }
        String said = PantryNameIndex.canonicalUnit(saidUnit);
        String target = PantryNameIndex.canonicalUnit(basis);
        if (!said.isEmpty() && said.equals(target)) {
            return new Resolved(clean(saidAmount), basis, false);
        }
        BigDecimal grams = MASS.containsKey(said) ? saidAmount.multiply(MASS.get(said)) : null;
        BigDecimal millilitres = VOLUME.containsKey(said) ? saidAmount.multiply(VOLUME.get(said)) : null;
        if ("g".equals(target)) {
            if (grams != null) {
                return new Resolved(clean(grams), basis, false);
            }
            if (millilitres != null) {
                return new Resolved(clean(millilitres), basis, true); // 1 ml ~ 1 g: a guess to confirm
            }
        } else if ("ml".equals(target)) {
            if (millilitres != null) {
                return new Resolved(clean(millilitres), basis, false);
            }
            if (grams != null) {
                return new Resolved(clean(grams), basis, true);
            }
        }
        // A piece, a can, a head, an unknown word — or a mass/volume against a food counted in pieces:
        // no rule converts it, so the number stays as said and is never trusted.
        return new Resolved(clean(saidAmount), basis, true);
    }

    private static BigDecimal clean(BigDecimal v) {
        BigDecimal rounded = v.setScale(3, RoundingMode.HALF_UP).stripTrailingZeros();
        return rounded.scale() < 0 ? rounded.setScale(0) : rounded;
    }
}
