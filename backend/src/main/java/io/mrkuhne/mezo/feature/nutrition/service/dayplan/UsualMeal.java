package io.mrkuhne.mezo.feature.nutrition.service.dayplan;

import java.time.Instant;

/** One row of the owner's "szokásosak": a window, a name, how often it recurs and when it last did. */
public record UsualMeal(String key, String title, SlotKey slot, Integer kcal, Instant lastLoggedAt, int count) {
}
