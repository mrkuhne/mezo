package io.mrkuhne.mezo.feature.nutrition.dayplan;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.service.dayplan.LoggedMeal;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.SlotKey;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.UsualMeal;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.UsualMealRanker;
import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** "Szokásosak" ported from {@code frontend/src/features/fuel/logic/usualMeals.ts} :59. */
class UsualMealRankerTest {

    private static LoggedMeal meal(String slot, String title, int kcal, String isoInstant) {
        Instant at = Instant.parse(isoInstant);
        return new LoggedMeal(UUID.randomUUID(), slot, title, kcal, at, LocalTime.of(8, 0));
    }

    /**
     * The bucket's own window comes first; inside it frequency decides, and a tie goes to the most
     * recent. A row carries its LATEST occurrence's name and energy.
     */
    @Test
    void ranksByFrequencyThenRecency() {
        List<LoggedMeal> history = List.of(
            meal("breakfast", "Zabkása", 420, "2026-11-10T06:30:00Z"),
            meal("breakfast", "zabkása ", 430, "2026-11-11T06:30:00Z"),
            meal("breakfast", "Zabkása", 440, "2026-11-12T06:30:00Z"),
            meal("breakfast", "Rántotta", 380, "2026-11-11T07:00:00Z"),
            meal("breakfast", "Rántotta", 390, "2026-11-12T07:00:00Z"),
            meal("breakfast", "Túrós tál", 350, "2026-11-13T07:00:00Z"),
            meal("dinner", "Csirke rizzsel", 700, "2026-11-13T18:00:00Z"),
            meal("dinner", "Csirke rizzsel", 710, "2026-11-12T18:00:00Z"),
            meal("dinner", "Csirke rizzsel", 720, "2026-11-11T18:00:00Z"),
            meal("dinner", "Csirke rizzsel", 730, "2026-11-10T18:00:00Z"));

        List<UsualMeal> out = UsualMealRanker.rank(history, SlotKey.BREAKFAST, 6);

        assertThat(out).extracting(UsualMeal::title)
            .containsExactly("Zabkása", "Rántotta", "Túrós tál", "Csirke rizzsel");
        assertThat(out.get(0).count()).isEqualTo(3); // the three spellings fold into one row
        assertThat(out.get(0).kcal()).isEqualTo(440); // the latest occurrence's energy
        assertThat(out.get(0).slot()).isEqualTo(SlotKey.BREAKFAST);
        // "Túrós tál" was logged once but more recently than "Rántotta"'s two — frequency wins first.
        assertThat(out.get(1).count()).isEqualTo(2);
        // The dinner row is in a different window, so it sorts after every breakfast one.
        assertThat(out.get(3).slot()).isEqualTo(SlotKey.DINNER);
    }

    /** No history → an empty list, never an invented suggestion; a nameless or unknown-window row drops out. */
    @Test
    void returnsNothingWithoutUsableHistory() {
        assertThat(UsualMealRanker.rank(List.of(), SlotKey.LUNCH, 6)).isEmpty();
        assertThat(UsualMealRanker.rank(List.of(
            meal("ismeretlen", "Valami", 100, "2026-11-13T12:00:00Z"),
            meal("lunch", "  ", 100, "2026-11-13T12:00:00Z")), SlotKey.LUNCH, 6)).isEmpty();
    }
}
