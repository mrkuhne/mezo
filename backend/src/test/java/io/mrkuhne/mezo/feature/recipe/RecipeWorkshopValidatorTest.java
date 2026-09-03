package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.WorkshopDraft;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.recipe.config.RecipeWorkshopProperties;
import io.mrkuhne.mezo.feature.recipe.service.RecipeWorkshopValidator;
import io.mrkuhne.mezo.feature.recipe.service.RecipeWorkshopValidator.RawDraft;
import io.mrkuhne.mezo.feature.recipe.service.RecipeWorkshopValidator.RawLine;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RecipeWorkshopValidatorTest {

    private final RecipeWorkshopValidator validator =
            new RecipeWorkshopValidator(new RecipeWorkshopProperties(30, 20, 20));

    private static PantryItemEntity pantry(UUID id, String name) {
        PantryCatalogEntity c = new PantryCatalogEntity();
        c.setName(name);
        c.setServingUnit("g");
        PantryItemEntity p = new PantryItemEntity();
        p.setId(id);
        p.setCatalog(c);
        return p;
    }

    @Test
    void testSanitize_shouldResolvePantryLine_andOverwriteNameFromDb() {
        UUID id = UUID.randomUUID();
        RawDraft raw = new RawDraft("Csirketál", "dinner", 2, List.of("Süsd meg."),
                List.of(new RawLine(id.toString(), "csirke (LLM név)", BigDecimal.valueOf(300), "g",
                        null, null, null, null)));

        WorkshopDraft out = validator.sanitize(raw, x -> Optional.of(pantry(id, "Csirkemell")));

        assertThat(out.getLines()).hasSize(1);
        assertThat(out.getLines().getFirst().getSource()).isEqualTo("pantry");
        assertThat(out.getLines().getFirst().getName()).isEqualTo("Csirkemell"); // DB, not LLM
        assertThat(out.getLines().getFirst().getKcal()).isNull();               // macros never from LLM
    }

    @Test
    void testSanitize_shouldDemoteHallucinatedId_toEstimate() {
        RawDraft raw = new RawDraft("X", "dinner", 2, List.of(),
                List.of(new RawLine(UUID.randomUUID().toString(), "Édesburgonya",
                        BigDecimal.valueOf(200), "g", BigDecimal.valueOf(172),
                        BigDecimal.valueOf(3), BigDecimal.valueOf(40), BigDecimal.ZERO)));

        WorkshopDraft out = validator.sanitize(raw, x -> Optional.empty());

        assertThat(out.getLines().getFirst().getSource()).isEqualTo("estimate");
        assertThat(out.getLines().getFirst().getPantryItemId()).isNull();
        assertThat(out.getLines().getFirst().getKcal()).isEqualByComparingTo("172");
    }

    @Test
    void testSanitize_shouldDefaultBlankPantryServingUnit_toGrams() {
        UUID id = UUID.randomUUID();
        PantryItemEntity blankUnit = pantry(id, "Zabpehely");
        blankUnit.getCatalog().setServingUnit("   ");
        RawDraft raw = new RawDraft("Zabkása", "breakfast", 1, List.of(),
                List.of(new RawLine(id.toString(), "zab", BigDecimal.valueOf(50), "g",
                        null, null, null, null)));

        WorkshopDraft out = validator.sanitize(raw, x -> Optional.of(blankUnit));

        assertThat(out.getLines().getFirst().getUnit()).isEqualTo("g");
    }

    @Test
    void testSanitize_shouldDropMacrolessEstimate_andClampMeta() {
        RawDraft raw = new RawDraft(null, "brunch", 0, List.of(),
                List.of(new RawLine(null, "Valami", BigDecimal.ONE, "g", null, null, null, null),
                        new RawLine("not-a-uuid", "Rizs", BigDecimal.valueOf(-5), "g",
                                BigDecimal.valueOf(130), BigDecimal.valueOf(3),
                                BigDecimal.valueOf(28), BigDecimal.ZERO)));

        WorkshopDraft out = validator.sanitize(raw, x -> Optional.empty());

        assertThat(out.getName()).isEqualTo("Új recept");   // blank-name fallback
        assertThat(out.getCategory()).isEqualTo("dinner");  // invalid category fallback
        assertThat(out.getServings()).isEqualTo(1);         // clamped
        assertThat(out.getLines()).hasSize(1);              // macro-less line dropped
        assertThat(out.getLines().getFirst().getAmount()).isEqualByComparingTo("1"); // non-positive amount -> 1
    }
}
