package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.season.service.ShoppingListBuilder;
import io.mrkuhne.mezo.feature.season.service.ShoppingListBuilder.Item;
import io.mrkuhne.mezo.feature.season.service.ShoppingListBuilder.Line;
import io.mrkuhne.mezo.feature.season.service.ShoppingListBuilder.Use;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ShoppingListBuilderTest {

    private static final UUID RIZSTAL = UUID.randomUUID();
    private static final UUID WOK = UUID.randomUUID();
    private static final UUID CHICKEN = UUID.randomUUID();
    private static final UUID RICE = UUID.randomUUID();
    private static final UUID BROCCOLI = UUID.randomUUID();

    private static List<Line> lines() {
        return List.of(
            new Line(RIZSTAL, "Csirkés rizstál", 1, CHICKEN, "Csirkemell", new BigDecimal("200"), "g", "meat"),
            new Line(RIZSTAL, "Csirkés rizstál", 1, RICE, "Basmati rizs", new BigDecimal("80"), "g", "grains"),
            new Line(RIZSTAL, "Csirkés rizstál", 1, BROCCOLI, "Brokkoli", new BigDecimal("150"), "g", "vegetables"),
            new Line(WOK, "Pulykás wok", 4, CHICKEN, "Csirkemell", new BigDecimal("0.8"), "kg", "meat"),
            new Line(WOK, "Pulykás wok", 4, null, "Szójaszósz", new BigDecimal("40"), "ml", null));
    }

    @Test
    void sameIngredientMergedAcrossRecipes() {
        List<Item> items = ShoppingListBuilder.build(
            List.of(new Use(RIZSTAL, new BigDecimal("1.5")), new Use(RIZSTAL, BigDecimal.ONE), new Use(WOK, BigDecimal.ONE)),
            lines());
        Item chicken = items.stream().filter(i -> CHICKEN.equals(i.catalogId())).findFirst().orElseThrow();
        // 200 × 1.5 + 200 × 1 + 800 g × 1 serving / 4 servings
        assertThat(chicken.amount()).isEqualByComparingTo("700");
        assertThat(chicken.unit()).isEqualTo("g");
        assertThat(chicken.forRecipes()).containsExactly("Csirkés rizstál ×2", "Pulykás wok");
        assertThat(items.stream().filter(i -> CHICKEN.equals(i.catalogId()))).hasSize(1);
    }

    @Test
    void shelvesGroupInOrder() {
        List<Item> items = ShoppingListBuilder.build(List.of(new Use(RIZSTAL, BigDecimal.ONE), new Use(WOK, BigDecimal.ONE)),
            lines());
        assertThat(items).extracting(Item::shelf).containsExactly("zoldseg", "hus", "kamra", "egyeb");
    }

    @Test
    void gramsAbove1000BecomeKg() {
        assertThat(ShoppingListBuilder.amountText(new BigDecimal("1350"), "g")).isEqualTo("1,4 kg");
        assertThat(ShoppingListBuilder.amountText(new BigDecimal("2000"), "g")).isEqualTo("2 kg");
        assertThat(ShoppingListBuilder.amountText(new BigDecimal("1500"), "ml")).isEqualTo("1,5 l");
        assertThat(ShoppingListBuilder.amountText(new BigDecimal("613"), "g")).isEqualTo("620 g");
        assertThat(ShoppingListBuilder.amountText(new BigDecimal("42"), "g")).isEqualTo("45 g");
        assertThat(ShoppingListBuilder.amountText(new BigDecimal("2.2"), "db")).isEqualTo("3 db");
    }

    @Test
    void anIngredientTipHasNothingToShopFor() {
        assertThat(ShoppingListBuilder.build(List.of(new Use(null, null)), lines())).isEmpty();
    }

    @Test
    void shelfMapping() {
        assertThat(ShoppingListBuilder.shelf("fruits")).isEqualTo("zoldseg");
        assertThat(ShoppingListBuilder.shelf("eggs")).isEqualTo("hus");
        assertThat(ShoppingListBuilder.shelf("cheese")).isEqualTo("tej");
        assertThat(ShoppingListBuilder.shelf("nuts_seeds")).isEqualTo("kamra");
        assertThat(ShoppingListBuilder.shelf("supplement")).isEqualTo("egyeb");
    }
}
