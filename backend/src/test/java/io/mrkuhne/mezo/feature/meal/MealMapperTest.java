package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.mapper.MealMapper;
import io.mrkuhne.mezo.feature.meal.mapper.MealMapperImpl;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MealMapperTest {

    private final MealMapper mapper = new MealMapperImpl();

    private MealItemEntity item(
        String source, UUID recipeId, UUID pantryItemId,
        BigDecimal amount, BigDecimal per, String name, Short nova,
        String kcal, String p, String c, String f, int order) {
        MealItemEntity i = new MealItemEntity();
        i.setSource(source);
        i.setRecipeId(recipeId);
        i.setPantryItemId(pantryItemId);
        i.setAmount(amount);
        i.setUnit("g");
        i.setLineOrder(order);
        i.setSnapshotName(name);
        i.setSnapshotPer(per);
        i.setSnapshotBasisUnit("g");
        i.setSnapshotKcal(new BigDecimal(kcal));
        i.setSnapshotProteinG(new BigDecimal(p));
        i.setSnapshotCarbsG(new BigDecimal(c));
        i.setSnapshotFatG(new BigDecimal(f));
        i.setSnapshotNova(nova);
        return i;
    }

    private MealEntity meal() {
        MealEntity m = new MealEntity();
        m.setSlot("lunch");
        m.setTitle("Ebéd");
        m.setLoggedAt(Instant.parse("2026-06-24T11:20:00Z"));
        m.setMealDate(LocalDate.parse("2026-06-24"));
        UUID recipeId = UUID.randomUUID();
        UUID pantryItemId = UUID.randomUUID();
        // recipe arm: amount 2, per 1 -> factor 2 -> kcal 220, p 46, c 0, f 3
        m.getItems().add(item("recipe", recipeId, null,
            new BigDecimal("2"), new BigDecimal("1"), "Túrós tál", (short) 1,
            "110", "23", "0", "1.5", 0));
        // pantry arm: amount 50, per 100 -> factor 0.5 -> kcal 50, p 5, c 10, f round(2.5)=3
        m.getItems().add(item("pantry", null, pantryItemId,
            new BigDecimal("50"), new BigDecimal("100"), "Zabpehely", (short) 2,
            "100", "10", "20", "5", 1));
        return m;
    }

    @Test
    void testToResponse_shouldComputeRoundedContributionsAndMealRollup_whenItemsPresent() {
        MealResponse r = mapper.toResponse(meal());

        // item 0 (recipe arm): factor 2 -> kcal 220, p 46, c 0, f 3
        assertThat(r.getItems().get(0).getContribution().getKcal()).isEqualByComparingTo("220");
        assertThat(r.getItems().get(0).getContribution().getP()).isEqualByComparingTo("46");
        assertThat(r.getItems().get(0).getContribution().getC()).isEqualByComparingTo("0");
        assertThat(r.getItems().get(0).getContribution().getF()).isEqualByComparingTo("3");
        // item 1 (pantry arm): factor 0.5 -> kcal 50, p 5, c 10, f round(2.5)=3 (HALF_UP)
        assertThat(r.getItems().get(1).getContribution().getKcal()).isEqualByComparingTo("50");
        assertThat(r.getItems().get(1).getContribution().getP()).isEqualByComparingTo("5");
        assertThat(r.getItems().get(1).getContribution().getC()).isEqualByComparingTo("10");
        assertThat(r.getItems().get(1).getContribution().getF()).isEqualByComparingTo("3");
        // meal macros = Σ item contributions: kcal 270, p 51, c 10, f 6
        assertThat(r.getMacros().getKcal()).isEqualByComparingTo("270");
        assertThat(r.getMacros().getP()).isEqualByComparingTo("51");
        assertThat(r.getMacros().getC()).isEqualByComparingTo("10");
        assertThat(r.getMacros().getF()).isEqualByComparingTo("6");
    }

    @Test
    void testToResponse_shouldEmitPendingScore_whenBreakdownNull() {
        MealResponse r = mapper.toResponse(meal());

        assertThat(r.getScore()).isNotNull();
        assertThat(r.getScore().getValue()).isNull();
        assertThat(r.getScore().getBreakdown()).isNull();
    }

    @Test
    void testToResponse_shouldPassThroughPolymorphicItemFields_whenMapped() {
        MealEntity m = meal();
        UUID recipeId = m.getItems().get(0).getRecipeId();
        UUID pantryItemId = m.getItems().get(1).getPantryItemId();

        MealResponse r = mapper.toResponse(m);

        assertThat(r.getSlot()).isEqualTo("lunch");
        assertThat(r.getTitle()).isEqualTo("Ebéd");
        // recipe arm item
        assertThat(r.getItems().get(0).getSource()).isEqualTo("recipe");
        assertThat(r.getItems().get(0).getRecipeId()).isEqualTo(recipeId);
        assertThat(r.getItems().get(0).getPantryItemId()).isNull();
        assertThat(r.getItems().get(0).getName()).isEqualTo("Túrós tál");
        assertThat(r.getItems().get(0).getNova()).isEqualTo(1);
        assertThat(r.getItems().get(0).getLineOrder()).isEqualTo(0);
        // pantry arm item
        assertThat(r.getItems().get(1).getSource()).isEqualTo("pantry");
        assertThat(r.getItems().get(1).getPantryItemId()).isEqualTo(pantryItemId);
        assertThat(r.getItems().get(1).getRecipeId()).isNull();
        assertThat(r.getItems().get(1).getName()).isEqualTo("Zabpehely");
        assertThat(r.getItems().get(1).getNova()).isEqualTo(2);
    }

    @Test
    void testToResponse_shouldDefaultPerToOne_whenSnapshotPerNullOrZero() {
        MealEntity m = new MealEntity();
        m.setSlot("snack");
        m.setLoggedAt(Instant.parse("2026-06-24T15:00:00Z"));
        m.setMealDate(LocalDate.parse("2026-06-24"));
        // per = 0 -> factor falls back to ONE -> contribution == snapshot macros
        m.getItems().add(item("pantry", null, UUID.randomUUID(),
            new BigDecimal("1"), BigDecimal.ZERO, "Alma", (short) 1,
            "52", "0", "14", "0", 0));

        MealResponse r = mapper.toResponse(m);

        assertThat(r.getItems().get(0).getContribution().getKcal()).isEqualByComparingTo("52");
        assertThat(r.getItems().get(0).getContribution().getC()).isEqualByComparingTo("14");
    }
}
