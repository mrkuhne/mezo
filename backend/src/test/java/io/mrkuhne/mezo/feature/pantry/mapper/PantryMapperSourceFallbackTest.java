package io.mrkuhne.mezo.feature.pantry.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.IngredientResponse;
import io.mrkuhne.mezo.api.dto.SupplementStashResponse;
import org.junit.jupiter.api.Test;

/**
 * mezo-w3o: an out-of-enum pantry_item.source must degrade that row to "manual" instead of
 * 500-ing the whole pantry read. The allow-lists are kept in lockstep, so the fallback is a
 * safety net for drift, not a normal path.
 */
class PantryMapperSourceFallbackTest {

    private final PantryMapper mapper = new PantryMapperImpl();

    @Test
    void testToIngredientSource_shouldMapKnownValue_whenInEnum() {
        assertThat(mapper.toIngredientSource("openfoodfacts"))
            .isEqualTo(IngredientResponse.SourceEnum.OPENFOODFACTS);
    }

    @Test
    void testToIngredientSource_shouldFallBackToManual_whenOutOfEnum() {
        assertThat(mapper.toIngredientSource("future-vendor.hu"))
            .isEqualTo(IngredientResponse.SourceEnum.MANUAL);
    }

    @Test
    void testToStashSource_shouldFallBackToManual_whenOutOfEnum() {
        assertThat(mapper.toStashSource("future-vendor.hu"))
            .isEqualTo(SupplementStashResponse.SourceEnum.MANUAL);
    }
}
