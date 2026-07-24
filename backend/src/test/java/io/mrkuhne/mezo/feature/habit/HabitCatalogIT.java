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
        assertThat(catalog.all()).hasSize(15);
        assertThat(catalog.forChain(HabitCatalog.CHAIN_MORNING)).hasSize(9);
        assertThat(catalog.forChain(HabitCatalog.CHAIN_EVENING)).hasSize(6);
        assertThat(catalog.forChain(HabitCatalog.CHAIN_MORNING))
            .extracting(HabitCatalog.HabitDef::position)
            .containsExactly(1, 2, 3, 4, 5, 6, 7, 8, 9);
        assertThat(catalog.forChain(HabitCatalog.CHAIN_EVENING))
            .extracting(HabitCatalog.HabitDef::position)
            .containsExactly(1, 2, 3, 4, 5, 6);
        assertThat(catalog.byKey("morning_weigh_in")).isPresent();
        assertThat(catalog.byKey("nope")).isEmpty();
    }

    @Test
    void testLoad_shouldPlaceEveningRitualAfterReflection_asDerivedMindsetHabit() {
        assertThat(catalog.byKey("evening_ritual")).hasValueSatisfying(d -> {
            assertThat(d.chain()).isEqualTo(HabitCatalog.CHAIN_EVENING);
            assertThat(d.position()).isEqualTo(4);
            assertThat(d.mode()).isEqualTo(HabitCatalog.MODE_DERIVED);
            assertThat(d.metric()).isEqualTo("ritual_closed");
            assertThat(d.skillKey()).isEqualTo("mindset");
            assertThat(d.skillKind()).isEqualTo("LIFE");
            assertThat(d.xp()).isBetween(5, 15);
            assertThat(d.anchorCopy()).isEqualTo("esti reflexió után");
        });
        assertThat(catalog.byKey("intention_reflect")).hasValueSatisfying(d -> {
            assertThat(d.position()).isEqualTo(3);
            assertThat(d.anchorCopy()).isEqualTo("konyhazárás után");
        });
        assertThat(catalog.byKey("wind_down")).hasValueSatisfying(d -> {
            assertThat(d.position()).isEqualTo(5);
            assertThat(d.anchorCopy()).isEqualTo("napzárás után");
        });
        assertThat(catalog.byKey("bed_on_time")).hasValueSatisfying(d ->
            assertThat(d.position()).isEqualTo(6));
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
