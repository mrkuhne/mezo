package io.mrkuhne.mezo.feature.nutrition.service;

import java.math.BigDecimal;

/**
 * A nap állapota EZ ELŐTT az étkezés előtt (mezo-jcpt.19) — a {@link MealScoringService} context
 * dimenziójának napi bemenete. Nutrition-tulajdonú carrier, pontosan úgy, ahogy a
 * {@link DailyTargets}: a scorer pure marad, a hívó (meal slice) oldja fel a napot.
 *
 * <p>Csak kcal + fehérje: a context dimenzió mást nem használ. Ugyanaz a fogalom, amit a
 * coach-prompt {@code MealBlock}-ja {@code kcalBefore}/{@code pBefore} néven már hordoz.
 *
 * <p><b>Az {@link #unknown()} nem „üres nap", hanem „nem tudjuk".</b> Ilyenkor a dimenzió a
 * NÉVLEGES pályát feltételezi (elvárt = napi cél × slot-arány), ami bitre a v2 viselkedés —
 * lásd a spec §4.3 azonosságát. A produkcióban egyedül a {@code MealService.applyScore} pontoz
 * étkezést, és az mindig ismert napot ad; az ismeretlen ág a rövid {@code scoreMeal}
 * overloadoké.
 */
public record DayContext(BigDecimal kcalBefore, BigDecimal pBefore) {

    private static final DayContext UNKNOWN = new DayContext(null, null);

    /** „Nem tudjuk, mit evett ma" — a névleges pálya feltételezése. */
    public static DayContext unknown() {
        return UNKNOWN;
    }

    /** A nap addigi összegei; a {@code null} itt 0-t jelent (nincs korábbi étkezés). */
    public static DayContext of(BigDecimal kcalBefore, BigDecimal pBefore) {
        return new DayContext(
            kcalBefore == null ? BigDecimal.ZERO : kcalBefore,
            pBefore == null ? BigDecimal.ZERO : pBefore);
    }

    /** Igaz, ha a nap tényleg fel van oldva — ilyenkor él a maradék-keretes ág. */
    public boolean known() {
        return kcalBefore != null && pBefore != null;
    }
}
