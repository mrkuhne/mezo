package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class HabitCatalogIT extends AbstractIntegrationTest {

    @Autowired
    private HabitCatalog catalog;

    @Test
    void testLoad_shouldExposeOrderedHabits_whenContextBoots() {
        assertThat(catalog.all()).hasSize(14);
        assertThat(catalog.forChain(HabitCatalog.CHAIN_MORNING)).hasSize(9);
        assertThat(catalog.forChain(HabitCatalog.CHAIN_EVENING)).hasSize(5);
        assertThat(catalog.forChain(HabitCatalog.CHAIN_MORNING))
            .extracting(HabitCatalog.HabitDef::position)
            .containsExactly(1, 2, 3, 4, 5, 6, 7, 8, 9);
        assertThat(catalog.byKey("morning_weigh_in")).isPresent();
        assertThat(catalog.byKey("nope")).isEmpty();
    }

    @Test
    void testLoad_shouldPlaceTheTwoNewHabitsRightAfterSunlight_withAClickableVideoLink() {
        assertThat(catalog.byKey("morning_pushups")).hasValueSatisfying(d -> {
            assertThat(d.position()).isEqualTo(3);
            assertThat(d.mode()).isEqualTo(HabitCatalog.MODE_MANUAL);
            assertThat(d.linkUrl()).isNull();
        });
        assertThat(catalog.byKey("morning_video")).hasValueSatisfying(d -> {
            assertThat(d.position()).isEqualTo(4);
            assertThat(d.mode()).isEqualTo(HabitCatalog.MODE_MANUAL);
            assertThat(d.linkUrl()).isEqualTo("https://www.facebook.com/share/r/1ERXP5zNFs/?mibextid=wwXIfr");
        });
    }
}
