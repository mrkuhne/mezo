package io.mrkuhne.mezo.feature.pantry.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PantrySuggestionResponse;
import io.mrkuhne.mezo.feature.pantry.config.PantrySuggestionProperties;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Pure-math unit test for the deterministic swap heuristics (Fuel P6, mezo-bka) — the
 * MealScoringServiceTest precedent: the service is a pure function over entities + config,
 * so no Spring context is needed.
 */
class PantrySuggestionServiceTest {

    private final PantrySuggestionService service =
        new PantrySuggestionService(new PantrySuggestionProperties(3, new BigDecimal("0.8")));

    private PantryItemEntity food(String name, String category, Integer priceHuf, String priceUnit, Integer nova) {
        PantryItemEntity e = new PantryItemEntity();
        e.setKind("food");
        e.setName(name);
        e.setSource("manual");
        e.setCategory(category);
        e.setPriceHuf(priceHuf);
        e.setPriceUnit(priceUnit);
        e.setNova(nova == null ? null : nova.shortValue());
        return e;
    }

    @Test
    void testSuggest_shouldSurfaceCheaperAlternative_whenSameCategoryAndBasisAndRatioMet() {
        List<PantrySuggestionResponse> out = service.suggest(List.of(
            food("Prémium csirkemell", "meat", 4000, "/kg", null),
            food("Csirkemell", "meat", 2500, "/kg", null)));

        assertThat(out).hasSize(1);
        assertThat(out.getFirst().getName()).isEqualTo("Csirkemell");
        assertThat(out.getFirst().getPrice()).isEqualTo("2500 Ft/kg");
        assertThat(out.getFirst().getReason()).isEqualTo("Olcsóbb, mint a(z) Prémium csirkemell (−37%)");
    }

    @Test
    void testSuggest_shouldStaySilent_whenPriceGapBelowRatio() {
        List<PantrySuggestionResponse> out = service.suggest(List.of(
            food("A csirkemell", "meat", 2600, "/kg", null),
            food("B csirkemell", "meat", 2500, "/kg", null)));

        assertThat(out).isEmpty();
    }

    @Test
    void testSuggest_shouldNotComparePrices_whenPriceUnitsDiffer() {
        List<PantrySuggestionResponse> out = service.suggest(List.of(
            food("Tojás 10db", "eggs", 1200, "/db", null),
            food("Tojás kimért", "eggs", 300, "/kg", null)));

        assertThat(out).isEmpty();
    }

    @Test
    void testSuggest_shouldSurfaceLowNovaSwap_whenHighAndLowNovaShareCategory() {
        List<PantrySuggestionResponse> out = service.suggest(List.of(
            food("Gabonapehely", "grains", null, null, 4),
            food("Zabpehely", "grains", null, null, 1)));

        assertThat(out).hasSize(1);
        assertThat(out.getFirst().getName()).isEqualTo("Zabpehely");
        assertThat(out.getFirst().getPrice()).isEqualTo("—");
        assertThat(out.getFirst().getReason())
            .isEqualTo("NOVA 4 → NOVA 1 csere a(z) Gabonapehely helyett");
    }

    @Test
    void testSuggest_shouldReturnEmpty_whenNovaAllNull() {
        // The live-catalog reality until mezo-32ko: no NOVA data -> honest-empty, never fabricated.
        List<PantrySuggestionResponse> out = service.suggest(List.of(
            food("A", "grains", null, null, null),
            food("B", "grains", null, null, null)));

        assertThat(out).isEmpty();
    }

    @Test
    void testSuggest_shouldCapAtMaxItems_whenMoreCategoriesTrigger() {
        List<PantrySuggestionResponse> out = service.suggest(List.of(
            food("Drága hús", "meat", 4000, "/kg", null), food("Olcsó hús", "meat", 1000, "/kg", null),
            food("Drága sajt", "cheese", 4000, "/kg", null), food("Olcsó sajt", "cheese", 1000, "/kg", null),
            food("Drága hal", "fish", 4000, "/kg", null), food("Olcsó hal", "fish", 1000, "/kg", null),
            food("Drága gyümölcs", "fruits", 4000, "/kg", null), food("Olcsó gyümölcs", "fruits", 1000, "/kg", null)));

        assertThat(out).hasSize(3); // maxItems
    }

    @Test
    void testSuggest_shouldIgnoreNonFoodAndUncategorized_whenPresent() {
        PantryItemEntity supp = food("Kreatin", "supplement", 4000, "/kg", null);
        supp.setKind("supplement");
        List<PantrySuggestionResponse> out = service.suggest(List.of(
            supp,
            food("Kategóriátlan", null, 100, "/kg", null)));

        assertThat(out).isEmpty();
    }
}
