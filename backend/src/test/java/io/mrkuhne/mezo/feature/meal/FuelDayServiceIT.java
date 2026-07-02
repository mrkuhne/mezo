package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.MealItemRequest;
import io.mrkuhne.mezo.api.dto.MealRequest;
import io.mrkuhne.mezo.feature.meal.service.MealService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class FuelDayServiceIT extends AbstractIntegrationTest {

    @Autowired private MealService service;
    @Autowired private PantryItemPopulator pantryPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private UUID owner;

    @BeforeEach
    void setUpOwner() {
        owner = databasePopulator.populateUser("a@test.local");
    }

    private PantryItemEntity food(String name) {
        return pantryPopulator.createFood(owner, name, LocalDate.of(2026, 5, 25));
    }

    private MealRequest mealAt(int hour, String pantryItemId, String grams) {
        MealItemRequest i = new MealItemRequest();
        i.setSource("pantry");
        i.setPantryItemId(UUID.fromString(pantryItemId));
        i.setAmount(new BigDecimal(grams));
        i.setUnit("g");
        MealRequest r = new MealRequest();
        r.setSlot("lunch");
        r.setLoggedAt(OffsetDateTime.of(2026, 6, 24, hour, 0, 0, 0, ZoneOffset.UTC));
        r.setItems(List.of(i));
        return r;
    }

    @Test
    void testGetDay_shouldReturnConfigTargetsAndZeroConsumed_whenNoMeals() {
        FuelDayResponse day = service.getDay(owner, LocalDate.of(2026, 6, 24));

        assertThat(day.getDate()).isEqualTo(LocalDate.of(2026, 6, 24));
        assertThat(day.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(3100));
        assertThat(day.getTargets().getP()).isEqualByComparingTo(BigDecimal.valueOf(220));
        assertThat(day.getTargets().getC()).isEqualByComparingTo(BigDecimal.valueOf(380));
        assertThat(day.getTargets().getF()).isEqualByComparingTo(BigDecimal.valueOf(95));
        assertThat(day.getTargets().getWater()).isEqualByComparingTo(BigDecimal.valueOf(4000));
        assertThat(day.getConsumed().getKcal()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(day.getMeals()).isEmpty();
    }

    @Test
    void testGetDay_shouldSumConsumedAcrossMeals_whenMealsLogged() {
        PantryItemEntity p = food("Csirkemell"); // 110/23/0/1.5 per 100 g
        service.create(owner, mealAt(8, p.getId().toString(), "100"));  // 110/23/0/2 (1.5->2)
        service.create(owner, mealAt(13, p.getId().toString(), "200")); // 220/46/0/3

        FuelDayResponse day = service.getDay(owner, LocalDate.of(2026, 6, 24));

        assertThat(day.getMeals()).hasSize(2);
        // ordered by logged_at asc -> 08:00 then 13:00
        assertThat(day.getMeals()).extracting("loggedAt").isSorted();
        assertThat(day.getConsumed().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(330));
        assertThat(day.getConsumed().getP()).isEqualByComparingTo(BigDecimal.valueOf(69));
        // per-line round: 100 g -> round(1.5)=2 F ; 200 g -> round(3.0)=3 F ; day F = 2+3 = 5
        assertThat(day.getConsumed().getF()).isEqualByComparingTo(BigDecimal.valueOf(5));
        // water is the real Σ of the day's water-log entries -> 0 with none logged
        assertThat(day.getConsumed().getWater()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void testGetDay_shouldScopeToDayAndOwner_whenOtherDaysExist() {
        PantryItemEntity p = food("Csirkemell");
        service.create(owner, mealAt(13, p.getId().toString(), "100")); // 2026-06-24
        MealRequest otherDay = mealAt(13, p.getId().toString(), "100");
        otherDay.setLoggedAt(OffsetDateTime.of(2026, 6, 25, 13, 0, 0, 0, ZoneOffset.UTC));
        service.create(owner, otherDay);

        FuelDayResponse day = service.getDay(owner, LocalDate.of(2026, 6, 24));

        assertThat(day.getMeals()).hasSize(1);
    }
}
