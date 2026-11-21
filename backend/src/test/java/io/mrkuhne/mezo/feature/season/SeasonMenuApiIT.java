package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SeasonMenuAlternative;
import io.mrkuhne.mezo.api.dto.SeasonMenuChoice;
import io.mrkuhne.mezo.api.dto.SeasonMenuGenerate;
import io.mrkuhne.mezo.api.dto.SeasonMenuMeal;
import io.mrkuhne.mezo.api.dto.SeasonMenuWeek;
import io.mrkuhne.mezo.api.dto.SeasonOverview;
import io.mrkuhne.mezo.api.dto.SeasonRecipeIds;
import io.mrkuhne.mezo.api.dto.SeasonRecipeOption;
import io.mrkuhne.mezo.api.dto.SeasonResponse;
import io.mrkuhne.mezo.api.dto.SeasonStaples;
import io.mrkuhne.mezo.api.dto.ShoppingItem;
import io.mrkuhne.mezo.api.dto.ShoppingItemCheck;
import io.mrkuhne.mezo.api.dto.ShoppingListResponse;
import io.mrkuhne.mezo.api.dto.ShoppingListSummary;
import io.mrkuhne.mezo.api.dto.ShoppingStapleToggle;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.service.SeasonService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.RecipePopulator;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;

/** Boop B6 Évad S3 (mezo-r36n9.16): the weekly menu, the recipe choice and the shopping list over HTTP. */
@Import(SeasonFixture.class)
class SeasonMenuApiIT extends ApiIntegrationTest {

    @Autowired private SeasonFixture fixture;
    @Autowired private SeasonService seasonService;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private RecipePopulator recipePopulator;

    @Test
    void menuRecipesAndListEndToEnd() {
        RegisteredUser u = registerUser("Menu");
        UUID owner = u.id();
        fixture.owner(u.email());
        PantryItemEntity oats = pantryItemPopulator.createPricedFood(owner, "Zabpehely", "grains", null, null, (short) 1);
        for (String[] r : new String[][] {{"Zabkása", "breakfast"}, {"Rizstál", "lunch"}, {"Alma", "snack"},
            {"Lazac", "dinner"}, {"Gulyás", "dinner"}, {"Lencse", "dinner"}}) {
            recipePopulator.createRecipe(owner, oats.getId(), r[0], r[1], List.of(), false);
        }
        SeasonEntity s = seasonService.activate(owner, seasonService.create(owner, SeasonFixture.draft()).getId());
        LocalDate next = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.MONDAY));

        SeasonOverview overview = getForBody("/api/seasons/active/overview", u.headers(), HttpStatus.OK, SeasonOverview.class);
        assertThat(overview.getMenu().getWeekStart()).isEqualTo(next);
        assertThat(overview.getMenu().getStatus().getValue()).isEqualTo("seeding");

        SeasonMenuWeek seeding = getForBody("/api/seasons/menu?weekStart=" + next, u.headers(), HttpStatus.OK,
            SeasonMenuWeek.class);
        assertThat(seeding.getStatus()).isEqualTo(SeasonMenuWeek.StatusEnum.SEEDING);
        assertThat(seeding.getRecipeCount()).isEqualTo(6);
        getForBody("/api/seasons/menu?weekStart=" + next.plusDays(1), u.headers(), HttpStatus.BAD_REQUEST, String.class);

        List<SeasonRecipeOption> options = Arrays.asList(getForBody("/api/seasons/recipes", u.headers(), HttpStatus.OK,
            SeasonRecipeOption[].class));
        assertThat(options).hasSize(6).allSatisfy(o -> assertThat(o.getAllowed()).isFalse());
        SeasonResponse saved = putForBody("/api/seasons/" + s.getId() + "/recipes",
            SeasonRecipeIds.builder().recipeIds(new ArrayList<>(options.stream().map(SeasonRecipeOption::getId).toList()))
                .build(), u.headers(), HttpStatus.OK, SeasonResponse.class);
        assertThat(saved.getDraft().getAllowedRecipeIds()).hasSize(6);

        SeasonMenuWeek proposed = postForBody("/api/seasons/menu/generate",
            SeasonMenuGenerate.builder().weekStart(next).build(), u.headers(), HttpStatus.OK, SeasonMenuWeek.class);
        assertThat(proposed.getStatus()).isEqualTo(SeasonMenuWeek.StatusEnum.PROPOSED);
        assertThat(proposed.getDays()).hasSize(7);
        assertThat(proposed.getRepeated()).isTrue(); // one recipe per breakfast / lunch / snack fills seven days

        SeasonMenuMeal dinner = proposed.getDays().get(0).getMeals().stream()
            .filter(m -> m.getSlot() == SeasonMenuMeal.SlotEnum.DINNER).findFirst().orElseThrow();
        List<SeasonMenuAlternative> alts = Arrays.asList(getForBody("/api/seasons/menu/meals/" + dinner.getId()
            + "/alternatives", u.headers(), HttpStatus.OK, SeasonMenuAlternative[].class));
        assertThat(alts).hasSize(2);
        putForBody("/api/seasons/menu/meals/" + dinner.getId(),
            SeasonMenuChoice.builder().recipeId(alts.get(0).getRecipeId()).build(), u.headers(), HttpStatus.OK,
            SeasonMenuWeek.class);

        getForBody("/api/seasons/shopping?weekStart=" + next, u.headers(), HttpStatus.NOT_FOUND, String.class);
        SeasonMenuWeek approved = postForBody("/api/seasons/menu/" + proposed.getId() + "/approve", null, u.headers(),
            HttpStatus.OK, SeasonMenuWeek.class);
        assertThat(approved.getStatus()).isEqualTo(SeasonMenuWeek.StatusEnum.APPROVED);
        String again = postForBody("/api/seasons/menu/generate", SeasonMenuGenerate.builder().weekStart(next).build(),
            u.headers(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(again, "MENU_NOT_PROPOSED");

        ShoppingListResponse list = getForBody("/api/seasons/shopping?weekStart=" + next, u.headers(), HttpStatus.OK,
            ShoppingListResponse.class);
        assertThat(list.getItems()).isNotEmpty().noneMatch(ShoppingItem::getStaple);
        ShoppingItem first = list.getItems().get(0);
        ShoppingItem ticked = putForBody("/api/seasons/shopping/items/" + first.getId(),
            ShoppingItemCheck.builder().checked(true).build(), u.headers(), HttpStatus.OK, ShoppingItem.class);
        assertThat(ticked.getChecked()).isTrue();
        ShoppingListResponse withCoffee = postForBody("/api/seasons/shopping/" + list.getId() + "/staples",
            ShoppingStapleToggle.builder().name("Kávé").on(true).build(), u.headers(), HttpStatus.OK,
            ShoppingListResponse.class);
        assertThat(withCoffee.getItems()).anyMatch(i -> i.getStaple() && i.getName().equals("Kávé"));

        SeasonStaples defaults = getForBody("/api/seasons/staples", u.headers(), HttpStatus.OK, SeasonStaples.class);
        assertThat(defaults.getDefaults()).isTrue();
        SeasonStaples mine = putForBody("/api/seasons/staples",
            SeasonStaples.builder().names(new ArrayList<>(List.of("Kávé", "Tea"))).build(), u.headers(), HttpStatus.OK,
            SeasonStaples.class);
        assertThat(mine.getNames()).containsExactly("Kávé", "Tea");
        assertThat(mine.getDefaults()).isFalse();
        SeasonStaples none = putForBody("/api/seasons/staples", SeasonStaples.builder().names(new ArrayList<>()).build(),
            u.headers(), HttpStatus.OK, SeasonStaples.class);
        assertThat(none.getNames()).isEmpty();
        assertThat(none.getDefaults()).isFalse();

        List<ShoppingListSummary> lists = Arrays.asList(getForBody("/api/seasons/shopping/lists", u.headers(),
            HttpStatus.OK, ShoppingListSummary[].class));
        assertThat(lists).hasSize(1);
        assertThat(lists.get(0).getCheckedCount()).isEqualTo(1);

        SeasonOverview after = getForBody("/api/seasons/active/overview", u.headers(), HttpStatus.OK, SeasonOverview.class);
        assertThat(after.getMenu().getStatus().getValue()).isEqualTo("approved");
    }

    @Test
    void anotherOwnersMealAndListAre404() {
        RegisteredUser a = registerUser("MenuA");
        RegisteredUser b = registerUser("MenuB");
        getForBody("/api/seasons/menu/meals/" + UUID.randomUUID() + "/alternatives", a.headers(), HttpStatus.NOT_FOUND,
            String.class);
        putForBody("/api/seasons/shopping/items/" + UUID.randomUUID(), ShoppingItemCheck.builder().checked(true).build(),
            b.headers(), HttpStatus.NOT_FOUND, String.class);
        getForBody("/api/seasons/menu?weekStart=" + LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.MONDAY)),
            a.headers(), HttpStatus.NOT_FOUND, String.class);
    }
}
