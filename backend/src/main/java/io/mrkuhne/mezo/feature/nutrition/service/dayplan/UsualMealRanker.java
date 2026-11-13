package io.mrkuhne.mezo.feature.nutrition.service.dayplan;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Ranks the owner's "szokásosak" from his own history — the server-side port of
 * {@code rankUsualMeals} ({@code frontend/src/features/fuel/logic/usualMeals.ts} :59).
 *
 * <p>The contract, in order: the window you are in now first, then how often it recurs, then how
 * recently. Rows fold by window + normalized name, and each row carries its LATEST occurrence's
 * name and energy — that is the recognisable one.
 *
 * <p>Honest-null: no history returns an EMPTY list, never an invented row; a nameless entry or one
 * whose window cannot be read drops out rather than being placed somewhere plausible.
 */
public final class UsualMealRanker {

    private UsualMealRanker() {
    }

    /** {@code bucket} is the window the caller is asking for; {@code limit} caps the rows. */
    public static List<UsualMeal> rank(List<LoggedMeal> history, SlotKey bucket, int limit) {
        Map<String, Row> byKey = new LinkedHashMap<>();
        for (LoggedMeal meal : history) {
            SlotKey slot = MealSlots.of(meal.slot());
            String title = meal.title() == null ? "" : meal.title().strip();
            if (slot == null || title.isEmpty()) {
                continue;
            }
            Row row = byKey.computeIfAbsent(slot.wire() + ":" + normalize(title),
                key -> new Row(key, slot, title, meal.kcal(), meal.loggedAt()));
            row.fold(title, meal.kcal(), meal.loggedAt());
        }

        List<UsualMeal> out = new ArrayList<>();
        byKey.values().stream()
            .sorted(Comparator
                .comparingInt((Row r) -> r.slot == bucket ? 0 : 1)
                .thenComparing(Comparator.comparingInt((Row r) -> r.count).reversed())
                .thenComparing(Comparator.comparing((Row r) -> r.lastLoggedAt).reversed()))
            .limit(Math.max(0, limit))
            .forEach(r -> out.add(new UsualMeal(r.key, r.title, r.slot, r.kcal, r.lastLoggedAt, r.count)));
        return List.copyOf(out);
    }

    /** "Zabkása  gyümölccsel" and "zabkása gyümölccsel" are the same row. */
    private static String normalize(String title) {
        return title.strip().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private static final class Row {
        private final String key;
        private final SlotKey slot;
        private String title;
        private Integer kcal;
        private java.time.Instant lastLoggedAt;
        private int count;

        private Row(String key, SlotKey slot, String title, Integer kcal, java.time.Instant lastLoggedAt) {
            this.key = key;
            this.slot = slot;
            this.title = title;
            this.kcal = kcal;
            this.lastLoggedAt = lastLoggedAt;
            this.count = 0;
        }

        private void fold(String nextTitle, Integer nextKcal, java.time.Instant at) {
            count++;
            if (at != null && at.isAfter(lastLoggedAt)) {
                title = nextTitle;
                kcal = nextKcal;
                lastLoggedAt = at;
            }
        }
    }
}
