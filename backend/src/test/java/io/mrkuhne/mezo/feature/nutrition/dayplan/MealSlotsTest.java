package io.mrkuhne.mezo.feature.nutrition.dayplan;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.service.dayplan.MealSlots;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.SlotKey;
import org.junit.jupiter.api.Test;

/** The drink slot (Boop, mezo-r36n9.160): a sixth bucket the plan's windows never claim and the scorer never judges. */
class MealSlotsTest {

    @Test
    void drinkIsAKnownSlot() {
        assertThat(SlotKey.fromWire("drink")).isEqualTo(SlotKey.DRINK);
        assertThat(SlotKey.DRINK.wire()).isEqualTo("drink");
    }

    @Test
    void mealSlotsReadTheDrinkWireAndTheHungarianWord() {
        assertThat(MealSlots.of("drink")).isEqualTo(SlotKey.DRINK);
        assertThat(MealSlots.of("Ital · 09:40")).isEqualTo(SlotKey.DRINK);
        assertThat(MealSlots.of("coffee")).isNull();
    }
}
