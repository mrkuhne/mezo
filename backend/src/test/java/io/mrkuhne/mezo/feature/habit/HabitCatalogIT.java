package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class HabitCatalogIT extends AbstractIntegrationTest {

    @Autowired
    private HabitCatalog catalog;

    @Test
    void testLoad_shouldExposeTenOrderedHabits_whenContextBoots() {
        assertThat(catalog.all()).hasSize(10);
        assertThat(catalog.forChain(HabitCatalog.CHAIN_MORNING)).hasSize(6);
        assertThat(catalog.forChain(HabitCatalog.CHAIN_EVENING)).hasSize(4);
        assertThat(catalog.forChain(HabitCatalog.CHAIN_MORNING))
            .extracting(HabitCatalog.HabitDef::position)
            .containsExactly(1, 2, 3, 4, 5, 6);
        assertThat(catalog.byKey("morning_weigh_in")).isPresent();
        assertThat(catalog.byKey("nope")).isEmpty();
    }
}
