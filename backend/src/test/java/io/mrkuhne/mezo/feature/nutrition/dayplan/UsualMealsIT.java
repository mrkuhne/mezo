package io.mrkuhne.mezo.feature.nutrition.dayplan;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.UsualMealResponse;
import io.mrkuhne.mezo.api.dto.UsualMealsResponse;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * {@code GET /api/fuel/usuals} (Boop B4 Task 13): the owner's recurring meals, ranked by the existing
 * {@code UsualMealRanker} — the window asked for first, then how often, then how recently. No history is an empty list.
 */
class UsualMealsIT extends ApiIntegrationTest {

    private static final ZoneId ZONE = ZoneId.of("Europe/Budapest");

    @Autowired private MealRepository meals;

    private void meal(UUID user, int daysAgo, String slot, String title, int hour) {
        LocalDate day = LocalDate.now(ZONE).minusDays(daysAgo);
        MealEntity m = new MealEntity();
        m.setCreatedBy(user);
        m.setMealDate(day);
        m.setSlot(slot);
        m.setTitle(title);
        Instant at = day.atTime(hour, 0).atZone(ZONE).toInstant();
        m.setLoggedAt(at);
        meals.saveAndFlush(m);
    }

    @Test
    void ranksTheRequestedWindowFirstThenByRecurrence() {
        RegisteredUser owner = registerUser("Usuals rank");
        // lunch: "Csirke rizzsel" three times; breakfast: "Zabkása" twice; dinner: "Tojás" once.
        for (int d = 1; d <= 3; d++) meal(owner.id(), d, "lunch", "Csirke rizzsel", 12);
        for (int d = 1; d <= 2; d++) meal(owner.id(), d, "breakfast", "Zabkása", 8);
        meal(owner.id(), 4, "dinner", "Tojás", 19);

        UsualMealsResponse byDefault = getForBody("/api/fuel/usuals", owner.headers(), HttpStatus.OK, UsualMealsResponse.class);
        assertThat(byDefault.getUsuals()).extracting(UsualMealResponse::getTitle)
            .containsExactly("Csirke rizzsel", "Zabkása", "Tojás");
        assertThat(byDefault.getUsuals().get(0).getCount()).isEqualTo(3);

        UsualMealsResponse asBreakfast = getForBody("/api/fuel/usuals?slot=breakfast", owner.headers(), HttpStatus.OK,
            UsualMealsResponse.class);
        // the window the owner is in ranks first, whatever the counts
        assertThat(asBreakfast.getUsuals().get(0).getTitle()).isEqualTo("Zabkása");
        assertThat(asBreakfast.getUsuals().get(0).getSlot()).isEqualTo(UsualMealResponse.SlotEnum.BREAKFAST);
    }

    @Test
    void foldsTheSameNameIntoOneRowAndNeverInventsOne() {
        RegisteredUser owner = registerUser("Usuals fold");
        meal(owner.id(), 1, "lunch", "Csirke  rizzsel", 12);
        meal(owner.id(), 2, "lunch", "csirke rizzsel", 12);
        meal(owner.id(), 3, "lunch", "   ", 12);

        UsualMealsResponse body = getForBody("/api/fuel/usuals", owner.headers(), HttpStatus.OK, UsualMealsResponse.class);
        assertThat(body.getUsuals()).hasSize(1);
        assertThat(body.getUsuals().get(0).getCount()).isEqualTo(2);
        // the latest occurrence's own spelling wins (yesterday's)
        assertThat(body.getUsuals().get(0).getTitle()).isEqualTo("Csirke  rizzsel");
    }

    @Test
    void noHistoryIsAnEmptyListNotAnInventedRow() {
        RegisteredUser owner = registerUser("Usuals empty");
        UsualMealsResponse body = getForBody("/api/fuel/usuals", owner.headers(), HttpStatus.OK, UsualMealsResponse.class);
        assertThat(body.getUsuals()).isEmpty();
    }

    @Test
    void anotherOwnersMealsAreNotMine() {
        RegisteredUser other = registerUser("Usuals other");
        RegisteredUser owner = registerUser("Usuals mine");
        meal(other.id(), 1, "lunch", "Valaki más ebédje", 12);
        UsualMealsResponse body = getForBody("/api/fuel/usuals", owner.headers(), HttpStatus.OK, UsualMealsResponse.class);
        assertThat(body.getUsuals()).isEmpty();
    }
}
