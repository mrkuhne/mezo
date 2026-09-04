package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.feature.companion.service.DayEvaluationEngine.DayDimension;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WaterLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * The day score END TO END (mezo-jcpt.4): real repositories, real {@link FuelDayService} targets,
 * real {@code WorkoutWindowQueryService} windows — feeding the one day math there is, {@link
 * DayEvaluationEngine}. The formula-level cases that used to live here died with the four legacy
 * sub-scores; the input-loading map and the per-dimension arithmetic are pinned exhaustively (and
 * cheaply) in {@code DayScoreServiceTest}. What this IT is for is the wiring the unit test mocks
 * away: that the loader's queries actually match what the owning features persist.
 *
 * <p>Honest-null semantics remain the load-bearing behavior: an unmeasured dimension degrades and
 * drops its weight, and a day that never closed gets no overall score at all.
 */
@Transactional
@ActiveProfiles("companion-fake")
class DayScoreServiceIT extends AbstractIntegrationTest {

    /** A Saturday (the week of {@code MeWeekControllerIT}'s Monday), safely in the past so the
     *  day is {@code closed} and the engine will produce a base score. */
    private static final LocalDate DAY = LocalDate.of(2026, 6, 20);
    private static final int SATURDAY = 5;   // gym slot tables use 0=Mon..6=Sun

    @Autowired private DayScoreService dayScoreService;
    @Autowired private FuelDayService fuelDayService;
    @Autowired private UserPopulator userPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private WaterLogPopulator waterLogPopulator;
    @Autowired private MealRepository mealRepository;

    /**
     * A pantry-arm meal on {@code date} whose consumed macros land EXACTLY on the day's targets —
     * snapshotPer=amount=1 makes {@code MealMapper}'s {@code factor = amount / snapshotPer} exactly
     * 1, so the snapshot values ARE the line's contribution (no rounding noise).
     *
     * <p>Its {@code logged_at} (when the meal was EATEN) is set to today's wall-clock time-of-day
     * so that it sits within the logging dimension's 120-minute band of the row's {@code
     * created_at} (when it was WRITTEN), which Hibernate stamps at insert and no test can choose.
     */
    private void seedOnTargetMeal(UUID owner, LocalDate date) {
        MacroSet targets = fuelDayService.getDay(owner, date).getTargets();
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "test-food-" + UUID.randomUUID(), null);

        MealEntity meal = new MealEntity();
        meal.setCreatedBy(owner);
        meal.setLoggedAt(date.atTime(LocalTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MINUTES))
                .toInstant(ZoneOffset.UTC));
        meal.setMealDate(date);
        meal.setSlot("lunch");
        meal.setTitle("Day evaluation fixture");

        MealItemEntity line = new MealItemEntity();
        line.setMeal(meal);
        line.setCreatedBy(owner);
        line.setLineOrder(0);
        line.setSource("pantry");
        line.setPantryItemId(item.getId());
        line.setAmount(BigDecimal.ONE);
        line.setUnit("g");
        line.setSnapshotName(item.getCatalog().getName());
        line.setSnapshotPer(BigDecimal.ONE);
        line.setSnapshotBasisUnit("g");
        line.setSnapshotKcal(targets.getKcal());
        line.setSnapshotProteinG(targets.getP());
        line.setSnapshotCarbsG(targets.getC());
        line.setSnapshotFatG(targets.getF());
        line.setSnapshotNova((short) 1);
        meal.getItems().add(line);
        mealRepository.saveAndFlush(meal);
    }

    private DayScoreService.DayScore dayFor(UUID owner, LocalDate date) {
        List<DayScoreService.DayScore> scores = dayScoreService.scores(owner, date, date);
        assertThat(scores).hasSize(1);
        assertThat(scores.get(0).date()).isEqualTo(date);
        return scores.get(0);
    }

    private static DayDimension dimension(DayScoreService.DayScore day, String id) {
        return day.evaluation().dimensions().stream().filter(d -> d.id().equals(id))
                .findFirst().orElseThrow();
    }

    /**
     * Every dimension reads what the owning feature actually persisted, and the legacy four-field
     * projection tracks it ({@code sleep←sleep, fuel←nutrition, checkin←logging,
     * activity←training}).
     *
     * <p>nutrition: consumed == targets on all four macros -> 100. sleep: 7.5h at the config
     * target with quality 10/10 -> 100. logging: meal logged within the band + water + 4/4
     * check-ins -> 100. training: one scheduled gym slot on this weekday with no completed
     * instance -> {@code 0.3 + 0.7 * 0} -> 30. quality: the fixture writes the meal row directly,
     * so it carries no score envelope and the dimension has nothing to aggregate -> NO_DATA.
     * rhythm: no earlier day has a base -> NO_DATA. base = the four DONE dimensions renormalized
     * over 0.75 = {@code (30 + 6 + 15 + 10) / 0.75} -> 81.
     */
    @Test
    void fullDayEvaluatesEveryDimensionAndProjectsTheLegacySubscores() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, DAY, new BigDecimal("7.5"), 10);
        seedOnTargetMeal(owner, DAY);
        waterLogPopulator.createWaterLog(owner, DAY, 500);
        checkInPopulator.createCheckIn(owner, DAY, "08:00", 10, 5, null);
        checkInPopulator.createCheckIn(owner, DAY, "12:00", 10, 5, null);
        checkInPopulator.createCheckIn(owner, DAY, "16:00", 10, 5, null);
        checkInPopulator.createCheckIn(owner, DAY, "20:00", 10, 5, null);
        trainPopulator.createGymSlot(owner, SATURDAY, "18:00");

        DayScoreService.DayScore day = dayFor(owner, DAY);

        assertThat(dimension(day, "nutrition").score()).isEqualTo(100);
        assertThat(dimension(day, "sleep").score()).isEqualTo(100);
        assertThat(dimension(day, "logging").score()).isEqualTo(100);
        assertThat(dimension(day, "training").score()).isEqualTo(30);
        assertThat(dimension(day, "quality").status()).isEqualTo("NO_DATA");
        assertThat(dimension(day, "rhythm").status()).isEqualTo("NO_DATA");

        assertThat(day.subscores().sleep()).isEqualTo(100);
        assertThat(day.subscores().nutrition()).isEqualTo(100);
        assertThat(day.subscores().logging()).isEqualTo(100);
        assertThat(day.subscores().training()).isEqualTo(30);
        assertThat(day.score()).isEqualTo(81).isEqualTo(day.evaluation().base());
    }

    /** A day with nothing logged measures nothing: only the always-measurable logging dimension
     *  is DONE (0 meals, no water, no check-in IS the measurement), which is one short of the
     *  engine's 2-dimension honesty gate — so there is no overall score. */
    @Test
    void emptyDayYieldsNullEverything() {
        UUID owner = userPopulator.createUser().getId();

        DayScoreService.DayScore day = dayFor(owner, DAY);

        assertThat(day.subscores().sleep()).isNull();
        assertThat(day.subscores().nutrition()).isNull();
        assertThat(day.subscores().training()).isNull();
        assertThat(day.subscores().logging()).isZero();
        assertThat(day.score()).isNull();
    }

    /**
     * The {@code scores(userId, from, to, Map)} overload must degrade to the standalone fetch, not
     * NPE, when the caller's map omits a day (mezo-8tp8 review I1): the nutrition dimension
     * dereferences that day's targets, so an unguarded null map lookup would throw.
     */
    @Test
    void mapOverloadFallsBackToFetchWhenDayIsMissingFromTheSuppliedMap() {
        UUID owner = userPopulator.createUser().getId();
        seedOnTargetMeal(owner, DAY);
        sleepLogPopulator.createSleepLog(owner, DAY, new BigDecimal("7.5"), 10);

        List<DayScoreService.DayScore> scores =
                dayScoreService.scores(owner, DAY, DAY, Map.<LocalDate, FuelDayResponse>of());

        assertThat(scores).hasSize(1);
        assertThat(scores.get(0).subscores().nutrition()).isEqualTo(100);
        assertThat(scores.get(0).subscores().sleep()).isEqualTo(100);
    }

    /** Task 8's entry point over real data: one day's inputs, resolved exactly like the range path
     *  resolves them. */
    @Test
    void inputsForResolvesOneDaysInputs() {
        UUID owner = userPopulator.createUser().getId();
        seedOnTargetMeal(owner, DAY);
        sleepLogPopulator.createSleepLog(owner, DAY, new BigDecimal("7.5"), 10);
        waterLogPopulator.createWaterLog(owner, DAY, 500);
        trainPopulator.createGymSlot(owner, SATURDAY, "18:00");

        DayEvaluationEngine.DayInputs inputs = dayScoreService.inputsFor(owner, DAY);

        assertThat(inputs.date()).isEqualTo(DAY);
        assertThat(inputs.closed()).isTrue();
        assertThat(inputs.kcal()).isEqualTo(inputs.kcalTarget());
        assertThat(inputs.proteinG()).isEqualTo(inputs.proteinTargetG());
        assertThat(inputs.sleepH()).isEqualTo(7.5);
        assertThat(inputs.sleepQuality1to10()).isEqualTo(10);
        assertThat(inputs.plannedWorkouts()).isEqualTo(1);
        assertThat(inputs.doneWorkouts()).isZero();
        assertThat(inputs.workoutDay()).isTrue();
        assertThat(inputs.waterLogged()).isTrue();
        assertThat(inputs.meals()).singleElement()
                .satisfies(m -> assertThat(m.slot()).isEqualTo("lunch"));
    }
}
