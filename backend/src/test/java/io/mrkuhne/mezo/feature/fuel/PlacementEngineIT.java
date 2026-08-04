package io.mrkuhne.mezo.feature.fuel;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.fuel.service.PlacementEngine;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/**
 * Companion is ON by default in the IT profile (application.yml) — this class forces it off so
 * {@code StackPlacementLlmAdapter} never exists (mirrors {@code RecipeBreakdownFallbackApiIT}),
 * proving the deterministic rule-table/timing/fallback paths without ever reaching the network.
 */
@Transactional
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class PlacementEngineIT extends AbstractIntegrationTest {

    @Autowired PlacementEngine engine;
    @Autowired PantryItemPopulator pantryPop;
    @Autowired io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;

    private PantryItemEntity supplement(String name) {
        UUID owner = databasePopulator.populateUser("a@test.local");
        return pantryPop.createSupplement(owner, name);
    }

    @Test
    void testPlace_shouldPlaceByRuleTable_whenNameMatchesNeedle() {
        PlacementEngine.Placement p = engine.place(supplement("Kreatin monohidrát"));
        assertThat(p.slotKey()).isEqualTo("wake");
        assertThat(p.source()).isEqualTo("rule");
        assertThat(p.reasonHu()).isNotBlank();
    }

    @Test
    void testPlace_shouldMarkRestDaySkip_whenPreWorkoutStimulant() {
        PlacementEngine.Placement p = engine.place(supplement("Origin PWO"));
        assertThat(p.slotKey()).isEqualTo("pre_workout");
        assertThat(p.restDayFallback()).isEqualTo("skip");
    }

    @Test
    void testPlace_shouldFallBack_whenUnknownItemAndLlmUnavailable() {
        // companion off (class-level TestPropertySource) -> adapter bean absent -> deterministic
        // fallback; timing is explicitly null so the item does not resolve via the timing hint either.
        UUID owner = databasePopulator.populateUser("a@test.local");
        PantryItemEntity item = pantryPop.createSupplement(owner, "Rejtélyes gyógynövény X", null);
        PlacementEngine.Placement p = engine.place(item);
        assertThat(p.slotKey()).isEqualTo("breakfast");
        assertThat(p.source()).isEqualTo("fallback");
    }

    @Test
    void testDailyTotalHint_shouldReturnHint_whenRuleCarriesOne() {
        assertThat(engine.dailyTotalHint("Kreatin monohidrát")).contains("15–20g");
        assertThat(engine.dailyTotalHint("Omega-3")).isNull();
    }
}
