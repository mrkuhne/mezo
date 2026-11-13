package io.mrkuhne.mezo.feature.nutrition.service.dayplan;

import java.util.Locale;

/**
 * Reads a logged meal's {@code slot} string as a window category — the port of {@code mealSlotKey}
 * ({@code frontend/src/features/fuel/logic/buildDayPlan.ts} :128). The field holds either the enum
 * value ({@code breakfast}…) or a Hungarian display string ({@code "Uzsonna · 16:20"}), so both are
 * recognised. Anything else is {@code null} — an unknown window is never guessed.
 */
public final class MealSlots {

    private MealSlots() {
    }

    public static SlotKey of(String slot) {
        String s = slot == null ? "" : slot.toLowerCase(Locale.ROOT);
        if (s.equals("breakfast") || s.contains("reggeli")) {
            return SlotKey.BREAKFAST;
        }
        if (s.equals("lunch") || s.contains("ebéd") || s.contains("ebed")) {
            return SlotKey.LUNCH;
        }
        if (s.equals("dinner") || s.contains("vacsora")) {
            return SlotKey.DINNER;
        }
        if (s.contains("snack") || s.contains("uzsonna") || s.contains("tízórai") || s.contains("tizorai")) {
            return SlotKey.SNACK;
        }
        return null;
    }
}
