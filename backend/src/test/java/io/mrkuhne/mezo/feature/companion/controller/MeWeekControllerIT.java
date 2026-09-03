package io.mrkuhne.mezo.feature.companion.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.api.dto.MeWeekResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitDayRepository;
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
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
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
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private HabitDayRepository habitDayRepository;

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
        // Eaten at today's wall-clock time-of-day so the row's Hibernate-stamped created_at (when
        // it was WRITTEN — no test can choose it) lands inside the logging dimension's 120-minute
        // timeliness band: the fixture is "logged as it was eaten", the normal case.
        meal.setLoggedAt(date.atTime(LocalTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MINUTES))
            .toInstant(ZoneOffset.UTC));
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

    /** Seeds a habit-awarded XP row for {@code date} — the {@code DayScoreServiceIT}
     *  xp-only-activity recipe, reused here so the dense day's {@code xp} field has a
     *  deterministic, exactly-assertable value (B5, mezo-8tp8). */
    private void seedXp(UUID owner, LocalDate date, int xpAwarded) {
        HabitDayEntity habit = new HabitDayEntity();
        habit.setCreatedBy(owner);
        habit.setHabitDate(date);
        habit.setHabitKey("dense-day-xp");
        habit.setStatus(HabitDayEntity.STATUS_DONE);
        habit.setXpAwarded(xpAwarded);
        habitDayRepository.saveAndFlush(habit);
    }

    @Test
    void weekReturnsSevenDaysWithScoresAndAggregates() {
        UUID owner = ownerId();
        // fetched BEFORE seeding so the dense day's exact kcal/protein expectations track
        // whatever target FuelDayService actually prescribes (config fallback or an active goal),
        // rather than hardcoding the config default (mirrors DayScoreServiceIT.seedMeal).
        MacroSet targets = fuelDayService.getDay(owner, MONDAY).getTargets();
        seedDenseDay(owner, MONDAY);
        seedDenseDay(owner, MONDAY.plusDays(1));
        weightLogPopulator.createWeightLog(owner, MONDAY, new BigDecimal("82.5"));
        seedXp(owner, MONDAY, 75);

        MeWeekResponse response = week(MONDAY);

        assertThat(response.getStart()).isEqualTo(MONDAY);
        assertThat(response.getDays()).hasSize(7);
        assertThat(response.getDays().get(0).getDate()).isEqualTo(MONDAY);
        assertThat(response.getDays().get(6).getDate()).isEqualTo(MONDAY.plusDays(6));

        var monday = response.getDays().get(0);
        // The 6-dimension engine (mezo-jcpt.4) behind the unchanged four-field wire projection:
        // sleep←sleep 100 (8h over the 7.5h target, quality 10/10) · fuel←nutrition 80 (kcal and
        // protein exactly on target, but 10 g carbs / 1 g fat are far outside the C+F band) ·
        // checkin←logging 80 (timely meal + 4/4 check-ins, no water logged) · activity←training
        // 100 (the seeded sport session yields one window, done). quality and rhythm degrade (the
        // fixture writes meal rows straight to the repository, so they carry no score envelope;
        // no earlier day has a base), so the four DONE dimensions renormalize over 0.75:
        // (0.30*80 + 0.20*100 + 0.15*100 + 0.10*80) / 0.75 = 89.33 -> 89.
        assertThat(monday.getScore()).isEqualTo(89);
        assertThat(monday.getSubscores().getSleep()).isEqualTo(100);
        assertThat(monday.getSubscores().getFuel()).isEqualTo(80);
        assertThat(monday.getSubscores().getCheckin()).isEqualTo(80);
        assertThat(monday.getSubscores().getActivity()).isEqualTo(100);
        assertThat(monday.getKcal().doubleValue()).isEqualTo(targets.getKcal().doubleValue());
        assertThat(monday.getProteinG().doubleValue()).isEqualTo(targets.getP().doubleValue());
        assertThat(monday.getCarbsG().doubleValue()).isEqualTo(10.0);
        assertThat(monday.getFatG().doubleValue()).isEqualTo(1.0);
        assertThat(monday.getKcalTarget().doubleValue()).isEqualTo(targets.getKcal().doubleValue());
        assertThat(monday.getProteinTargetG().doubleValue()).isEqualTo(targets.getP().doubleValue());
        assertThat(monday.getWeightKg().doubleValue()).isEqualTo(82.5);
        assertThat(monday.getSleepMin()).isEqualTo(480);
        assertThat(monday.getSleepQuality().doubleValue()).isEqualTo(10.0);
        assertThat(monday.getCheckinCount()).isEqualTo(4);
        assertThat(monday.getWorkoutCount()).isEqualTo(1);
        assertThat(monday.getXp()).isEqualTo(75);

        assertThat(response.getDays().get(1).getScore()).isNotNull();
        for (int i = 2; i < 7; i++) {
            assertThat(response.getDays().get(i).getScore()).isNull();
            assertThat(response.getDays().get(i).getCheckinCount()).isZero();
        }

        assertThat(response.getWeekly().getScore()).isNotNull();
        assertThat(response.getWeekly().getAvgKcal()).isNotNull();
        assertThat(response.getWeekly().getAvgKcal().doubleValue())
            .isEqualTo(response.getDays().get(0).getKcal().doubleValue());
        // 8 filled slots (4 + 4, the two dense days) over 4*7=28 canonical slots for a fully-past
        // (elapsedDays=7) week -> 8/28 = 0.2857 (scale 4, HALF_UP).
        assertThat(response.getWeekly().getCheckinRatio().doubleValue()).isEqualTo(0.2857);
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
    void checkinRatioIsNullNotZeroForAFullyFutureWeek() {
        LocalDate futureMonday = LocalDate.now()
                .with(java.time.temporal.TemporalAdjusters.next(java.time.DayOfWeek.MONDAY))
                .plusWeeks(10);

        MeWeekResponse response = week(futureMonday);

        assertThat(response.getDays()).hasSize(7);
        assertThat(response.getWeekly().getCheckinRatio()).isNull();
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
