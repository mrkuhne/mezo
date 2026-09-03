package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.FuelWeekResponse;
import io.mrkuhne.mezo.api.dto.MealItemRequest;
import io.mrkuhne.mezo.api.dto.MealRequest;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.meal.service.MealService;
import io.mrkuhne.mezo.feature.nutrition.entity.DietSettingsEntity;
import io.mrkuhne.mezo.feature.nutrition.service.DailyTargets;
import io.mrkuhne.mezo.feature.nutrition.repository.DietSettingsRepository;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
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
    @Autowired private FuelDayService fuelDayService;
    @Autowired private PantryItemPopulator pantryPopulator;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private DietSettingsRepository dietSettingsRepository;

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

    /** Two-segment recept: weeks 1..2 → 2300 kcal / 170 g, weeks 3..6 → 2100 kcal / 180 g. */
    private GoalPrescriptionJson twoSegmentPrescription() {
        return new GoalPrescriptionJson(null, "formula",
            List.of(
                new GoalPrescriptionJson.Segment(1, 2, "bevezető", 2300, 170, null, null, null, null, null, null, null),
                new GoalPrescriptionJson.Segment(3, 6, "vágás", 2100, 180, null, null, null, null, null, null, null)),
            null, null);
    }

    @Test
    void testGetDay_shouldUsePrescriptionKcalAndProtein_whenActiveGoalSegmentCoversDate() {
        // goal started 2026-06-08 → 2026-06-24 is day 17 → goal-week 3 → the 2100/180 segment
        goalPopulator.createGoalFull(owner, LocalDate.of(2026, 6, 8), LocalDate.of(2026, 7, 20),
            twoSegmentPrescription(), 4, "06:30", "22:30");

        FuelDayResponse day = fuelDayService.getDay(owner, LocalDate.of(2026, 6, 24));

        assertThat(day.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(2100));
        assertThat(day.getTargets().getP()).isEqualByComparingTo(BigDecimal.valueOf(180));
        // carbs/fat/water are not prescribed — they stay on the config targets
        assertThat(day.getTargets().getC()).isEqualByComparingTo(BigDecimal.valueOf(380));
        assertThat(day.getTargets().getF()).isEqualByComparingTo(BigDecimal.valueOf(95));
        assertThat(day.getTargets().getWater()).isEqualByComparingTo(BigDecimal.valueOf(4000));
    }

    @Test
    void testGetDay_shouldFallBackToConfigTargets_whenNoSegmentCoversDate() {
        // goal starts AFTER the queried date → goal-week 0 → no segment → config fallback
        goalPopulator.createGoalFull(owner, LocalDate.of(2026, 7, 6), LocalDate.of(2026, 8, 17),
            twoSegmentPrescription(), 4, "06:30", "22:30");

        FuelDayResponse day = fuelDayService.getDay(owner, LocalDate.of(2026, 6, 24));

        assertThat(day.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(3100));
        assertThat(day.getTargets().getP()).isEqualByComparingTo(BigDecimal.valueOf(220));
    }

    @Test
    void testGetWeek_shouldUsePrescriptionTargetsPerDay_whenSegmentBoundaryFallsInsideWeek() {
        // goal starts 2026-06-08; the rendered week 2026-06-18..24 straddles the goal-week 2→3
        // boundary: 06-18..21 are goal-week 2 (2300), 06-22..24 are goal-week 3 (2100).
        goalPopulator.createGoalFull(owner, LocalDate.of(2026, 6, 8), LocalDate.of(2026, 7, 20),
            twoSegmentPrescription(), 4, "06:30", "22:30");

        FuelWeekResponse week = fuelDayService.getWeek(owner, LocalDate.of(2026, 6, 18));

        assertThat(week.getDays().get(0).getTargets().getKcal())
            .isEqualByComparingTo(BigDecimal.valueOf(2300));
        assertThat(week.getDays().get(6).getTargets().getKcal())
            .isEqualByComparingTo(BigDecimal.valueOf(2100));
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
    void testGetWeek_shouldReturnSevenZeroRollups_whenNoMeals() {
        LocalDate start = LocalDate.of(2026, 6, 22); // Monday

        FuelWeekResponse week = fuelDayService.getWeek(owner, start);

        assertThat(week.getStart()).isEqualTo(start);
        assertThat(week.getDays()).hasSize(7);
        assertThat(week.getDays().getFirst().getDate()).isEqualTo(start);
        assertThat(week.getDays().getLast().getDate()).isEqualTo(start.plusDays(6));
        assertThat(week.getDays()).allSatisfy(d -> {
            assertThat(d.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(3100));
            assertThat(d.getConsumed().getKcal()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(d.getConsumed().getWater()).isEqualByComparingTo(BigDecimal.ZERO);
        });
    }

    @Test
    void testGetWeek_shouldSumConsumedPerDay_whenMealsSpanDays() {
        PantryItemEntity p = food("Csirkemell"); // 110/23/0/1.5 per 100 g
        service.create(owner, mealAt(8, p.getId().toString(), "100"));  // Wed 06-24: 110 kcal / 23 P
        service.create(owner, mealAt(13, p.getId().toString(), "200")); // Wed 06-24: 220 kcal / 46 P
        MealRequest thursday = mealAt(13, p.getId().toString(), "100");
        thursday.setLoggedAt(OffsetDateTime.of(2026, 6, 25, 13, 0, 0, 0, ZoneOffset.UTC));
        service.create(owner, thursday);                                // Thu 06-25: 110 kcal / 23 P

        FuelWeekResponse week = fuelDayService.getWeek(owner, LocalDate.of(2026, 6, 22));

        assertThat(week.getDays().get(2).getConsumed().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(330));
        assertThat(week.getDays().get(2).getConsumed().getP()).isEqualByComparingTo(BigDecimal.valueOf(69));
        assertThat(week.getDays().get(3).getConsumed().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(110));
        assertThat(week.getDays().get(0).getConsumed().getKcal()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void testGetWeek_shouldScopeToOwner_whenAnotherUsersMealsExist() {
        UUID other = databasePopulator.populateUser("b@test.local");
        PantryItemEntity p = pantryPopulator.createFood(other, "Rizs", LocalDate.of(2026, 5, 25));
        service.create(other, mealAt(8, p.getId().toString(), "100"));

        FuelWeekResponse week = fuelDayService.getWeek(owner, LocalDate.of(2026, 6, 22));

        assertThat(week.getDays()).allSatisfy(
            d -> assertThat(d.getConsumed().getKcal()).isEqualByComparingTo(BigDecimal.ZERO));
    }

    @Test
    void testGetDay_shouldUseGoalSegmentKcalAndProtein_whenActiveGoalHasCurrentSegment() {
        UUID goalOwner = databasePopulator.populateUser("goal-owner@test.local");
        LocalDate today = LocalDate.now();
        // week 1 segment: 2600 kcal / 190 g protein — deliberately != the 3100/220 config
        GoalPrescriptionJson prescription = new GoalPrescriptionJson(null, "formula",
            List.of(new GoalPrescriptionJson.Segment(1, 12, "week1-12", 2600, 190,
                null, null, null, null, null, null, null)),
            null, null);
        goalPopulator.createGoalFull(goalOwner, today.minusDays(3), today.plusWeeks(11),
            prescription, 4, "06:00", "22:00");

        FuelDayResponse day = fuelDayService.getDay(goalOwner, today);

        assertThat(day.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(2600));
        assertThat(day.getTargets().getP()).isEqualByComparingTo(BigDecimal.valueOf(190));
        // segment carries no carbsG/fatG (pre-slice-1 shape) -> c/f stay config-driven
        assertThat(day.getTargets().getC()).isEqualByComparingTo(BigDecimal.valueOf(380));
    }

    /** Single-segment recept carrying prescribed carbsG/fatG (slice-1 shape), covering "today". */
    private GoalPrescriptionJson prescriptionWithMacros(int carbsG, int fatG) {
        return new GoalPrescriptionJson(null, "formula",
            List.of(new GoalPrescriptionJson.Segment(1, 12, "week1-12", 2600, 190, carbsG, fatG,
                null, null, null, null, null)),
            null, null);
    }

    @Test
    void testFuelDayTargets_shouldServePrescribedCarbsFat_whenSegmentCovers() {
        UUID goalOwner = databasePopulator.populateUser("carbs-fat-owner@test.local");
        LocalDate today = LocalDate.now();
        // 310/78 deliberately != the 380/95 config
        goalPopulator.createGoalFull(goalOwner, today.minusDays(3), today.plusWeeks(11),
            prescriptionWithMacros(310, 78), 4, "06:00", "22:00");

        FuelDayResponse day = fuelDayService.getDay(goalOwner, today);

        assertThat(day.getTargets().getC()).isEqualByComparingTo(BigDecimal.valueOf(310));
        assertThat(day.getTargets().getF()).isEqualByComparingTo(BigDecimal.valueOf(78));
        // water is still not prescribed by the goal -> config/preference ghost
        assertThat(day.getTargets().getWater()).isEqualByComparingTo(BigDecimal.valueOf(4000));
    }

    @Test
    void testFuelDayTargets_shouldServePreferenceWater_whenSettingsRowPresent() {
        UUID prefOwner = databasePopulator.populateUser("water-pref-owner@test.local");
        DietSettingsEntity row = new DietSettingsEntity();
        row.setCreatedBy(prefOwner);
        row.setSplitPreset("balanced");
        row.setProteinTier("moderate");
        row.setWaterMl(3200);
        row.setFiberG(30);
        row.setDayTypeShiftKcal(0);
        dietSettingsRepository.save(row);

        FuelDayResponse day = fuelDayService.getDay(prefOwner, LocalDate.now());

        assertThat(day.getTargets().getWater()).isEqualByComparingTo(BigDecimal.valueOf(3200));
        // no active goal for this owner -> kcal/p/c/f stay config-driven
        assertThat(day.getTargets().getC()).isEqualByComparingTo(BigDecimal.valueOf(380));
    }

    @Test
    void testFuelWeekTargets_shouldServePrescribedCarbsFatAndPreferenceWater_perDay() {
        UUID goalOwner = databasePopulator.populateUser("week-macros-owner@test.local");
        LocalDate start = LocalDate.now();
        goalPopulator.createGoalFull(goalOwner, start.minusDays(3), start.plusWeeks(11),
            prescriptionWithMacros(300, 70), 4, "06:00", "22:00");
        DietSettingsEntity row = new DietSettingsEntity();
        row.setCreatedBy(goalOwner);
        row.setSplitPreset("balanced");
        row.setProteinTier("moderate");
        row.setWaterMl(2800);
        row.setFiberG(30);
        row.setDayTypeShiftKcal(0);
        dietSettingsRepository.save(row);

        FuelWeekResponse week = fuelDayService.getWeek(goalOwner, start);

        assertThat(week.getDays()).allSatisfy(d -> {
            assertThat(d.getTargets().getC()).isEqualByComparingTo(BigDecimal.valueOf(300));
            assertThat(d.getTargets().getF()).isEqualByComparingTo(BigDecimal.valueOf(70));
            assertThat(d.getTargets().getWater()).isEqualByComparingTo(BigDecimal.valueOf(2800));
        });
    }

    @Test
    void testGetDay_shouldFallBackToConfigTargets_whenNoActiveGoal() {
        FuelDayResponse day = fuelDayService.getDay(owner, LocalDate.now());
        assertThat(day.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(3100));
        assertThat(day.getTargets().getP()).isEqualByComparingTo(BigDecimal.valueOf(220));
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

    // -- FuelDayService.dailyTargets (mezo-3g5w): the meal scorer's day-target resolver, sharing
    // the SAME segmentFor resolution as targetSet above -- so the score and the MacroHero can
    // never judge against different numbers.

    @Test
    void testDailyTargets_shouldReadGoalSegment_whenActiveGoalCoversDate() {
        // active goal whose prescription segment for week 1 prescribes 2400/180/240/70
        UUID goalOwner = databasePopulator.populateUser("daily-targets-goal-owner@test.local");
        LocalDate today = LocalDate.now();
        GoalPrescriptionJson prescription = new GoalPrescriptionJson(null, "formula",
            List.of(new GoalPrescriptionJson.Segment(1, 6, "Alap", 2400, 180, 240, 70,
                new BigDecimal("8.0"), List.of(), null, -300, "seed")),
            null, null);
        goalPopulator.createGoalFull(goalOwner, today.minusDays(3), today.plusWeeks(5),
            prescription, 4, "06:30", "22:30");

        DailyTargets t = fuelDayService.dailyTargets(goalOwner, today);

        assertThat(t.kcal()).isEqualTo(2400);
        assertThat(t.p()).isEqualTo(180);
        assertThat(t.c()).isEqualTo(240);
        assertThat(t.f()).isEqualTo(70);
        assertThat(t.source()).isEqualTo("goal");
    }

    @Test
    void testDailyTargets_shouldFallBackToConfig_whenNoActiveGoal() {
        DailyTargets t = fuelDayService.dailyTargets(owner, LocalDate.now());

        assertThat(t.kcal()).isEqualTo(3100);
        assertThat(t.p()).isEqualTo(220);
        assertThat(t.c()).isEqualTo(380);
        assertThat(t.f()).isEqualTo(95);
        assertThat(t.source()).isEqualTo("config");
    }
}
