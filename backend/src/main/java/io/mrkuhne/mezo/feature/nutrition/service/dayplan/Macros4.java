package io.mrkuhne.mezo.feature.nutrition.service.dayplan;

/** Whole-number kcal + protein/carb/fat grams — the day budget, a window's share, what is left. */
public record Macros4(int kcal, int p, int c, int f) {

    public static final Macros4 ZERO = new Macros4(0, 0, 0, 0);

    public Macros4 minus(Macros4 other) {
        return new Macros4(kcal - other.kcal, p - other.p, c - other.c, f - other.f);
    }

    public Macros4 minusKcal(int amount) {
        return new Macros4(kcal - amount, p, c, f);
    }
}
