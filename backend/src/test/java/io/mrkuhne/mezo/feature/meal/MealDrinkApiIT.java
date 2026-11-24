package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.BoopBrief;
import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.FuelPlanResponse;
import io.mrkuhne.mezo.api.dto.MealItemRequest;
import io.mrkuhne.mezo.api.dto.MealRequest;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.UsualMealsResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

/**
 * The drink slot over the API (Boop, mezo-r36n9.160): a drink is a meal row with {@code slot = drink} — saved
 * unscored, counted in the day's totals, claimed by no plan window, ranked among the usual drinks, and left out of
 * Boop's day (its meal rules see meals only).
 */
@ActiveProfiles("companion-fake")
class MealDrinkApiIT extends ApiIntegrationTest {

    private static final ZoneId ZONE = ZoneId.of("Europe/Budapest");

    @Test
    void aDrinkIsSavedUnscoredCountsInTheDayClaimsNoWindowAndRanksAmongUsuals() {
        HttpHeaders auth = ownerAuthHeaders();
        // Yesterday: the usual-meal history ends the day before the one asked about.
        LocalDate day = LocalDate.now(ZONE).minusDays(1);
        OffsetDateTime drank = day.atTime(9, 40).atZone(ZONE).toOffsetDateTime();
        UUID powder = createFood(auth, "Fehérjepor", "380", "75", "8", "6");

        MealRequest req = new MealRequest();
        req.setSlot("drink");
        req.setTitle("Fehérjeturmix");
        req.setCapturedAt(drank);
        req.setClientRef(UUID.randomUUID());
        req.setItems(List.of(pantryItem(powder, "30")));
        MealResponse drink = postForBody("/api/meal", req, auth, HttpStatus.CREATED, MealResponse.class);

        assertThat(drink.getSlot()).isEqualTo("drink");
        assertThat(drink.getMealDate()).isEqualTo(day);
        assertThat(drink.getScore().getValue()).isNull();
        assertThat(drink.getScore().getBreakdown()).isNull();

        FuelDayResponse fuelDay = getForBody("/api/fuel/day/" + day, auth, HttpStatus.OK, FuelDayResponse.class);
        assertThat(fuelDay.getConsumed().getKcal().doubleValue()).isGreaterThanOrEqualTo(110);
        assertThat(fuelDay.getMeals()).extracting(MealResponse::getId).contains(drink.getId());

        FuelPlanResponse plan = getForBody("/api/fuel/plan/" + day, auth, HttpStatus.OK, FuelPlanResponse.class);
        assertThat(plan.getWindows()).isNotEmpty();
        assertThat(plan.getWindows()).allSatisfy(w -> assertThat(w.getLoggedMealIds()).doesNotContain(drink.getId()));

        UsualMealsResponse usuals = getForBody("/api/fuel/usuals?slot=drink", auth, HttpStatus.OK, UsualMealsResponse.class);
        assertThat(usuals.getUsuals()).isNotEmpty();
        assertThat(usuals.getUsuals().get(0).getTitle()).isEqualTo("Fehérjeturmix");
        assertThat(usuals.getUsuals().get(0).getSlot().getValue()).isEqualTo("drink");

        BoopBrief brief = getForBody("/api/boop/brief?date=" + day, auth, HttpStatus.OK, BoopBrief.class);
        assertThat(brief.getDay().getMeals()).extracting(m -> m.getTitle()).doesNotContain("Fehérjeturmix");
    }

    @Test
    void anUnknownSlotIsStillRefused() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID powder = createFood(auth, "Fehérjepor", "380", "75", "8", "6");
        MealRequest req = new MealRequest();
        req.setSlot("coffee");
        req.setTitle("Kávé");
        req.setLoggedAt(OffsetDateTime.now(ZONE));
        req.setItems(List.of(pantryItem(powder, "30")));

        ResponseEntity<String> r = rest.exchange("/api/meal", HttpMethod.POST, new HttpEntity<>(req, auth), String.class);

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    private UUID createFood(HttpHeaders auth, String name, String kcal, String p, String c, String f) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName(name);
        r.setPer(new BigDecimal("100"));
        r.setUnit("g");
        r.setKcal(new BigDecimal(kcal));
        r.setProteinG(new BigDecimal(p));
        r.setCarbsG(new BigDecimal(c));
        r.setFatG(new BigDecimal(f));
        return postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class).getId();
    }

    private MealItemRequest pantryItem(UUID pantryItemId, String amount) {
        MealItemRequest i = new MealItemRequest();
        i.setSource("pantry");
        i.setPantryItemId(pantryItemId);
        i.setAmount(new BigDecimal(amount));
        i.setUnit("g");
        return i;
    }
}
