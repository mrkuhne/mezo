package io.mrkuhne.mezo.feature.character.service.edition;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Egy étkezés annyija, amennyi Falat napi értékeléséhez kell (H5, mezo-a9bo7.16): mikor került be,
 * a determinisztikus pontszáma (null, ha még nincs pontozva) és a kcal-ja (a tétel-hozzájárulások
 * összege, a kanonikus {@code MealMapper#contribution} képlettel).
 */
public record EditionMeal(Instant loggedAt, BigDecimal score, BigDecimal kcal) {
}
