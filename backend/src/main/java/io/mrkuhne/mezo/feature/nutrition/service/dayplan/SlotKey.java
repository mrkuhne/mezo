package io.mrkuhne.mezo.feature.nutrition.service.dayplan;

import java.util.Locale;

/**
 * The four meal-window categories of the day plan (Boop B4, mezo-r36n9.14) — the Java twin of the
 * web planner's {@code SlotKey} ({@code frontend/src/features/fuel/logic/buildDayPlan.ts}). It is
 * also the recipe {@code category} vocabulary, so a window and a recipe can be matched directly.
 */
public enum SlotKey {
    BREAKFAST, LUNCH, DINNER, SNACK;

    /** Lowercase wire/DB value ({@code recipe.category}, the contract enum). */
    public String wire() {
        return name().toLowerCase(Locale.ROOT);
    }

    /** {@code null} for anything this vocabulary does not know — never a guessed slot. */
    public static SlotKey fromWire(String wire) {
        if (wire == null) {
            return null;
        }
        for (SlotKey k : values()) {
            if (k.wire().equals(wire.strip().toLowerCase(Locale.ROOT))) {
                return k;
            }
        }
        return null;
    }
}
