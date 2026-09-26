package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * A dimenzió érettsége (0..100) az AKTÍV állításaiból — az egyetlen definíció (mezo-a9bo7.11):
 * {@code min(100, round(20 × activeCount + 40 × meanActiveConfidence))}, 0 ha nincs állítás.
 * A portré-író, az overview/dimension olvasás és a heti érettség-történet mind ezt hívja, így a
 * szoba gyűrűje és a görbe utolsó pontja sosem mond ellent egymásnak.
 */
public final class MaturityFormula {

    private static final BigDecimal COVERAGE_WEIGHT = new BigDecimal("20");
    private static final BigDecimal CONFIDENCE_WEIGHT = new BigDecimal("40");
    private static final int MAX = 100;

    private MaturityFormula() {}

    public static short compute(List<CharacterClaimEntity> active) {
        if (active.isEmpty()) {
            return 0;
        }
        int rounded = COVERAGE_WEIGHT.multiply(BigDecimal.valueOf(active.size()))
                .add(CONFIDENCE_WEIGHT.multiply(mean(active, 10)))
                .setScale(0, RoundingMode.HALF_UP).intValue();
        return (short) Math.min(MAX, rounded);
    }

    /** Mean ACTIVE confidence at scale 3, or {@code null} when there is no active claim. */
    public static BigDecimal meanConfidence(List<CharacterClaimEntity> active) {
        return active.isEmpty() ? null : mean(active, 3);
    }

    private static BigDecimal mean(List<CharacterClaimEntity> active, int scale) {
        BigDecimal sum = active.stream().map(CharacterClaimEntity::getConfidence)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(active.size()), scale, RoundingMode.HALF_UP);
    }
}
