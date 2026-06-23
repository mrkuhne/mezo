package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.RecipeResponse;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeIngredientEntity;
import io.mrkuhne.mezo.feature.recipe.mapper.RecipeMapper;
import io.mrkuhne.mezo.feature.recipe.mapper.RecipeMapperImpl;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RecipeMapperTest {

    private final RecipeMapper mapper = new RecipeMapperImpl();

    private RecipeIngredientEntity line(
        String name, BigDecimal amount, BigDecimal per,
        String kcal, String p, String c, String f, int order) {
        RecipeIngredientEntity l = new RecipeIngredientEntity();
        l.setPantryItemId(UUID.randomUUID());
        l.setAmount(amount);
        l.setUnit("g");
        l.setLineOrder(order);
        l.setSnapshotName(name);
        l.setSnapshotPer(per);
        l.setSnapshotBasisUnit("g");
        l.setSnapshotKcal(new BigDecimal(kcal));
        l.setSnapshotProteinG(new BigDecimal(p));
        l.setSnapshotCarbsG(new BigDecimal(c));
        l.setSnapshotFatG(new BigDecimal(f));
        return l;
    }

    private RecipeEntity recipe() {
        RecipeEntity e = new RecipeEntity();
        e.setName("Túrós tál");
        e.setCategory("breakfast");
        e.setServings(2);
        e.setStarred(false);
        // 200 g of a per-100g food: factor = 2 -> kcal 110*2=220, p 23*2=46, c 0, f 1.5*2=3
        // + 50 g of a per-100g food: factor = 0.5 -> kcal 50, p 5, c 10, f 2.5(round->3? see below)
        e.getLines().add(line("Csirkemell", new BigDecimal("200"), new BigDecimal("100"),
            "110", "23", "0", "1.5", 0));
        e.getLines().add(line("Zabpehely", new BigDecimal("50"), new BigDecimal("100"),
            "100", "10", "20", "5", 1));
        return e;
    }

    @Test
    void testToResponse_shouldComputeRoundedContributionsAndWholeRecipeRollup_whenLinesPresent() {
        RecipeResponse r = mapper.toResponse(recipe());

        // line 0: 200/100 = 2.0 -> kcal 220, p 46, c 0, f 3
        assertThat(r.getIngredients().get(0).getContribution().getKcal())
            .isEqualByComparingTo("220");
        assertThat(r.getIngredients().get(0).getContribution().getP())
            .isEqualByComparingTo("46");
        assertThat(r.getIngredients().get(0).getContribution().getF())
            .isEqualByComparingTo("3");
        // line 1: 50/100 = 0.5 -> kcal 50, p 5, c 10, f round(2.5)=3 (HALF_UP)
        assertThat(r.getIngredients().get(1).getContribution().getKcal())
            .isEqualByComparingTo("50");
        assertThat(r.getIngredients().get(1).getContribution().getC())
            .isEqualByComparingTo("10");
        assertThat(r.getIngredients().get(1).getContribution().getF())
            .isEqualByComparingTo("3");
        // whole-recipe macros = Σ contributions: kcal 270, p 51, c 10, f 6
        assertThat(r.getMacros().getKcal()).isEqualByComparingTo("270");
        assertThat(r.getMacros().getP()).isEqualByComparingTo("51");
        assertThat(r.getMacros().getC()).isEqualByComparingTo("10");
        assertThat(r.getMacros().getF()).isEqualByComparingTo("6");
    }

    @Test
    void testToResponse_shouldEmitPendingMezoFitAndDerivedDefaults_whenFitScoreNull() {
        RecipeResponse r = mapper.toResponse(recipe());

        assertThat(r.getMezoFit().getScore()).isNull();
        assertThat(r.getMezoFit().getFitsFor()).isEmpty();
        assertThat(r.getTimesLogged()).isEqualTo(0);
        assertThat(r.getAvgScore()).isEqualByComparingTo("0");
        assertThat(r.getLastLogged()).isEqualTo("—");
    }

    @Test
    void testToResponse_shouldPassThroughScalarsAndLineOrder_whenMapped() {
        RecipeResponse r = mapper.toResponse(recipe());

        assertThat(r.getName()).isEqualTo("Túrós tál");
        assertThat(r.getCategory()).isEqualTo("breakfast");
        assertThat(r.getServings()).isEqualTo(2);
        assertThat(r.getIngredients()).extracting(i -> i.getName())
            .containsExactly("Csirkemell", "Zabpehely");
        assertThat(r.getIngredients()).extracting(i -> i.getLineOrder())
            .containsExactly(0, 1);
    }
}
