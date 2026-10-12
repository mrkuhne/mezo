package io.mrkuhne.mezo.feature.fuel;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.MeResponse;
import io.mrkuhne.mezo.api.dto.MealItemRequest;
import io.mrkuhne.mezo.api.dto.MealRequest;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.MealScoreDimension;
import io.mrkuhne.mezo.api.dto.ProtocolItemCreateRequest;
import io.mrkuhne.mezo.api.dto.ProtocolItemResponse;
import io.mrkuhne.mezo.api.dto.ProtocolViewResponse;
import io.mrkuhne.mezo.feature.meal.service.MealService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/**
 * Fuel's server-written sentences follow the account language end to end (mezo-n4wf5.5): resolved
 * from the request's account, written once, and kept as written when the language is switched
 * later (N1 rule: stored text is never re-translated).
 */
class FuelLanguageIT extends ApiIntegrationTest {

    private static final OffsetDateTime LOGGED_AT = OffsetDateTime.of(2026, 6, 24, 13, 20, 0, 0, ZoneOffset.UTC);
    private static final LocalDate MEAL_DATE = LocalDate.of(2026, 6, 24);

    @Autowired private PantryItemPopulator pantryPop;
    @Autowired private MealService mealService;

    private void switchTo(HttpHeaders auth, String language) {
        putForBody("/api/auth/me/language", Map.of("language", language), auth, HttpStatus.OK, MeResponse.class);
    }

    private MealResponse logMeal(HttpHeaders auth) {
        MealItemRequest item = new MealItemRequest();
        item.setSource("estimate");
        item.setAmount(new BigDecimal("1"));
        item.setUnit("db");
        item.setName("Csirkés wrap");
        item.setPer(new BigDecimal("1"));
        item.setBasisUnit("db");
        item.setKcal(new BigDecimal("450"));
        item.setProteinG(new BigDecimal("28"));
        item.setCarbsG(new BigDecimal("40"));
        item.setFatG(new BigDecimal("18"));
        MealRequest r = new MealRequest();
        r.setSlot("lunch");
        r.setLoggedAt(LOGGED_AT);
        r.setTitle("Ebéd");
        r.setItems(List.of(item));
        return postForBody("/api/meal", r, auth, HttpStatus.CREATED, MealResponse.class);
    }

    private static String macroLabel(MealResponse meal) {
        return meal.getScore().getBreakdown().getDimensions().stream()
            .filter(d -> "macro".equals(d.getId())).map(MealScoreDimension::getLabel).findFirst().orElseThrow();
    }

    private MealResponse reread(HttpHeaders auth, MealResponse meal) {
        return getForBody("/api/fuel/day/" + MEAL_DATE, auth, HttpStatus.OK, FuelDayResponse.class)
            .getMeals().stream().filter(m -> m.getId().equals(meal.getId())).findFirst().orElseThrow();
    }

    @Test
    void testMealScore_shouldBeWrittenInTheAccountLanguage_andStayAsWritten() {
        var user = registerUser("fuel-lang-meal");

        MealResponse hungarian = logMeal(user.headers());
        assertThat(macroLabel(hungarian)).isEqualTo("Kcal & makró arány");

        switchTo(user.headers(), "en");
        MealResponse english = logMeal(user.headers());
        assertThat(macroLabel(english)).isEqualTo("Kcal and macro split");
        assertThat(english.getScore().getBreakdown().getDimensions())
            .filteredOn(d -> "micro".equals(d.getId()))
            .extracting(MealScoreDimension::getDetail).containsExactly("No fibre data for these items.");
        // the same numbers, whatever the words
        assertThat(english.getScore().getBreakdown().getDimensions())
            .filteredOn(d -> "macro".equals(d.getId())).extracting(MealScoreDimension::getScore)
            .containsExactlyElementsOf(hungarian.getScore().getBreakdown().getDimensions().stream()
                .filter(d -> "macro".equals(d.getId())).map(MealScoreDimension::getScore).toList());

        // frozen as written: the earlier meal still reads Hungarian, and switching back does not
        // re-translate the English one
        assertThat(macroLabel(reread(user.headers(), hungarian))).isEqualTo("Kcal & makró arány");
        switchTo(user.headers(), "hu");
        assertThat(macroLabel(reread(user.headers(), english))).isEqualTo("Kcal and macro split");
    }

    @Test
    void testRescore_shouldWriteInTheOwnersLanguage_whenNoRequestIsBehindIt() {
        var user = registerUser("fuel-lang-rescore");
        MealResponse meal = logMeal(user.headers()); // Hungarian envelope
        switchTo(user.headers(), "en");

        // the backfill path: this thread has no principal — the meal's owner decides the language
        assertThat(mealService.rescore(meal.getId())).isTrue();

        assertThat(macroLabel(reread(user.headers(), meal))).isEqualTo("Kcal and macro split");
    }

    @Test
    void testStackPlacement_shouldStoreTheReasonInTheAccountLanguage_andKeepIt() {
        var user = registerUser("fuel-lang-stack");
        switchTo(user.headers(), "en");
        var creatine = pantryPop.createSupplement(user.id(), "Kreatin monohidrát");
        var omega = pantryPop.createSupplement(user.id(), "Omega-3");

        ProtocolItemResponse placed = postForBody("/api/fuel/protocol/items",
            new ProtocolItemCreateRequest().pantryItemId(creatine.getId()),
            user.headers(), HttpStatus.CREATED, ProtocolItemResponse.class);
        ProtocolItemResponse manual = postForBody("/api/fuel/protocol/items",
            new ProtocolItemCreateRequest().pantryItemId(omega.getId()).slotKey("evening"),
            user.headers(), HttpStatus.CREATED, ProtocolItemResponse.class);

        assertThat(placed.getSlotKey()).isEqualTo("wake");
        assertThat(placed.getPlacementReason()).startsWith("Creatine in water after waking.");
        assertThat(placed.getDailyTotalHint()).isEqualTo("suggested daily total 15–20 g, best split into 3–4 doses");
        assertThat(manual.getPlacementReason()).isEqualTo("Placed here by hand.");

        switchTo(user.headers(), "hu");
        ProtocolViewResponse view = getForBody("/api/fuel/protocol", user.headers(), HttpStatus.OK,
            ProtocolViewResponse.class);
        ProtocolItemResponse stored = view.getActive().getItems().stream()
            .filter(i -> i.getId().equals(placed.getId())).findFirst().orElseThrow();
        assertThat(stored.getPlacementReason()).startsWith("Creatine in water after waking."); // stored: as written
        assertThat(stored.getDailyTotalHint()).contains("15–20g"); // derived per read: follows the language
    }
}
