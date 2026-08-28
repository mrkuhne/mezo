package io.mrkuhne.mezo.feature.companion.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.api.dto.MeWeekResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * Weekly review (mezo-p2tr) HTTP contract for {@code GET /api/me/week/{start}} — always 7 day
 * entries for one ISO-Monday week, honest-null day scores, and weekly aggregates that average
 * only over days WITH data. Dense-day seeding mirrors {@code DayScoreServiceIT}'s recipes.
 */
@ActiveProfiles("companion-fake")
class MeWeekControllerIT extends ApiIntegrationTest {

    private static final LocalDate MONDAY = LocalDate.of(2026, 6, 15);

    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private MealRepository mealRepository;
    @Autowired private FuelDayService fuelDayService;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private MeWeekResponse week(LocalDate start) {
        return getForBody("/api/me/week/" + start, ownerAuthHeaders(), HttpStatus.OK, MeWeekResponse.class);
    }

    /** A dense day: sleep + a pantry-arm meal at target + all four check-in slots + a workout. */
    private void seedDenseDay(UUID owner, LocalDate date) {
        sleepLogPopulator.createSleepLog(owner, date, new BigDecimal("8.0"), 10);
        seedMeal(owner, date, 1.0, 1.0);
        checkInPopulator.createCheckIn(owner, date, "08:00", 10, 5, null);
        checkInPopulator.createCheckIn(owner, date, "12:00", 10, 5, null);
        checkInPopulator.createCheckIn(owner, date, "16:00", 10, 5, null);
        checkInPopulator.createCheckIn(owner, date, "20:00", 10, 5, null);
        trainPopulator.createSportSession(owner, date);
    }

    /** Copy of {@code DayScoreServiceIT.seedMeal} — a pantry-arm meal whose consumed kcal/protein
     *  land exactly at {@code kcalFactor * target} / {@code proteinFactor * target}. */
    private void seedMeal(UUID owner, LocalDate date, double kcalFactor, double proteinFactor) {
        MacroSet targets = fuelDayService.getDay(owner, date).getTargets();
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "test-food-" + UUID.randomUUID(), null);

        MealEntity meal = new MealEntity();
        meal.setCreatedBy(owner);
        meal.setLoggedAt(date.atStartOfDay(ZoneOffset.UTC).toInstant().plusSeconds(3600));
        meal.setMealDate(date);
        meal.setSlot("lunch");
        meal.setTitle("Weekly review fixture");

        MealItemEntity line = new MealItemEntity();
        line.setMeal(meal);
        line.setCreatedBy(owner);
        line.setLineOrder(0);
        line.setSource("pantry");
        line.setPantryItemId(item.getId());
        line.setAmount(BigDecimal.ONE);
        line.setUnit("g");
        line.setSnapshotName(item.getName());
        line.setSnapshotPer(BigDecimal.ONE);
        line.setSnapshotBasisUnit("g");
        line.setSnapshotKcal(BigDecimal.valueOf(targets.getKcal().doubleValue() * kcalFactor));
        line.setSnapshotProteinG(BigDecimal.valueOf(targets.getP().doubleValue() * proteinFactor));
        line.setSnapshotCarbsG(BigDecimal.TEN);
        line.setSnapshotFatG(BigDecimal.ONE);
        line.setSnapshotNova((short) 1);
        meal.getItems().add(line);
        mealRepository.saveAndFlush(meal);
    }

    @Test
    void weekReturnsSevenDaysWithScoresAndAggregates() {
        UUID owner = ownerId();
        seedDenseDay(owner, MONDAY);
        seedDenseDay(owner, MONDAY.plusDays(1));

        MeWeekResponse response = week(MONDAY);

        assertThat(response.getStart()).isEqualTo(MONDAY);
        assertThat(response.getDays()).hasSize(7);
        assertThat(response.getDays().get(0).getDate()).isEqualTo(MONDAY);
        assertThat(response.getDays().get(6).getDate()).isEqualTo(MONDAY.plusDays(6));

        assertThat(response.getDays().get(0).getScore()).isNotNull();
        assertThat(response.getDays().get(1).getScore()).isNotNull();
        for (int i = 2; i < 7; i++) {
            assertThat(response.getDays().get(i).getScore()).isNull();
            assertThat(response.getDays().get(i).getCheckinCount()).isZero();
        }

        assertThat(response.getWeekly().getScore()).isNotNull();
        assertThat(response.getWeekly().getAvgKcal()).isNotNull();
        assertThat(response.getWeekly().getAvgKcal().doubleValue())
            .isEqualTo(response.getDays().get(0).getKcal().doubleValue());
    }

    @Test
    void nonMondayIs400() {
        LocalDate tuesday = MONDAY.plusDays(1);
        String body = exchangeForBody(org.springframework.http.HttpMethod.GET,
            "/api/me/week/" + tuesday, null, ownerAuthHeaders(),
            HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(body, "ME_WEEK_START_NOT_MONDAY");
    }

    @Test
    void prevWeekScoreComesFromThePriorWeek() {
        UUID owner = ownerId();
        LocalDate priorMonday = MONDAY.minusWeeks(1);
        seedDenseDay(owner, priorMonday);
        seedDenseDay(owner, priorMonday.plusDays(1));

        MeWeekResponse response = week(MONDAY);

        assertThat(response.getWeekly().getPrevWeekScore()).isNotNull();
    }
}
