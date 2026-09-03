package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitDayRepository;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * Weekly review (mezo-p2tr) — the deterministic per-day score service, over populator-seeded
 * days. Honest-null semantics are the load-bearing behavior: a day with fewer than two present
 * subscores never gets a synthesized score.
 */
@Transactional
@ActiveProfiles("companion-fake")
class DayScoreServiceIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 6, 20);

    @Autowired private DayScoreService dayScoreService;
    @Autowired private FuelDayService fuelDayService;
    @Autowired private UserPopulator userPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private MealRepository mealRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private HabitDayRepository habitDayRepository;

    /**
     * A pantry-arm meal on {@code date} whose consumed kcal/protein land EXACTLY at
     * {@code kcalFactor * target} / {@code proteinFactor * target} — snapshotPer=amount=1 makes
     * MealMapper's {@code factor = amount / snapshotPer} exactly 1, so the snapshot values ARE the
     * line's contribution (no rounding noise from an intermediate serving-size ratio).
     */
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
        line.setSnapshotCarbsG(BigDecimal.ZERO);
        line.setSnapshotFatG(BigDecimal.ZERO);
        line.setSnapshotNova((short) 1);
        meal.getItems().add(line);
        mealRepository.saveAndFlush(meal);
    }

    /**
     * An active goal covering {@code date} whose prescribed recept segment sets an explicit kcal
     * target and a {@code proteinG} of ZERO — the one way {@code FuelDayService.targetSet} yields a
     * non-positive protein target (the config fallback is {@code @Positive}, so this branch is
     * otherwise unreachable). Triggers the fuel subscore's kcal-closeness-ONLY path.
     */
    private void seedNoProteinTargetGoal(UUID owner, LocalDate date, int kcalTarget) {
        GoalPrescriptionJson.Segment segment = new GoalPrescriptionJson.Segment(
                1, 1, "w1", kcalTarget, 0, null, null, null, null, null, null, null, null, null);
        GoalPrescriptionJson prescription = new GoalPrescriptionJson(null, null, List.of(segment), null, null);
        goalPopulator.createGoalFull(owner, date, date.plusWeeks(4), prescription, null, null, null);
    }

    /** A pantry-arm meal on {@code date} whose consumed kcal lands EXACTLY at {@code kcal} (protein 0). */
    private void seedMealWithKcal(UUID owner, LocalDate date, double kcal) {
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
        line.setSnapshotKcal(BigDecimal.valueOf(kcal));
        line.setSnapshotProteinG(BigDecimal.ZERO);
        line.setSnapshotCarbsG(BigDecimal.ZERO);
        line.setSnapshotFatG(BigDecimal.ZERO);
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

    @Test
    void fullDayScoresAllFourSubscores() {
        UUID owner = userPopulator.createUser().getId();
        // sleep: 8h at quality 10/10 (the FE dial is 1-10, not 1-5) hits the 8.0h default target
        // exactly and the top of the quality dial -> d=1, quality-term=1 -> subscore 1.0.
        sleepLogPopulator.createSleepLog(owner, DAY, new BigDecimal("8.0"), 10);
        // fuel: kcal and protein both exactly at target -> closeness/ratio both 1.0 -> subscore 1.0.
        seedMeal(owner, DAY, 1.0, 1.0);
        // checkin: all four canonical slots, energy 10/10 throughout -> count-term and
        // energy-term both 1.0 -> subscore 1.0.
        checkInPopulator.createCheckIn(owner, DAY, "08:00", 10, 5, null);
        checkInPopulator.createCheckIn(owner, DAY, "12:00", 10, 5, null);
        checkInPopulator.createCheckIn(owner, DAY, "16:00", 10, 5, null);
        checkInPopulator.createCheckIn(owner, DAY, "20:00", 10, 5, null);
        // activity: a logged workout alone maxes the subscore regardless of xp.
        trainPopulator.createSportSession(owner, DAY);

        DayScoreService.DayScore day = dayFor(owner, DAY);

        assertThat(day.subscores().sleep()).isEqualTo(100);
        assertThat(day.subscores().fuel()).isEqualTo(100);
        assertThat(day.subscores().checkin()).isEqualTo(100);
        assertThat(day.subscores().activity()).isEqualTo(100);
        assertThat(day.score()).isEqualTo(100);
    }

    @Test
    void sparseDayWithOneDomainIsHonestNull() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, DAY, new BigDecimal("8.0"), 10);

        DayScoreService.DayScore day = dayFor(owner, DAY);

        assertThat(day.subscores().sleep()).isNotNull();
        assertThat(day.subscores().fuel()).isNull();
        assertThat(day.subscores().checkin()).isNull();
        assertThat(day.subscores().activity()).isNull();
        assertThat(day.score()).isNull();
    }

    @Test
    void emptyDayYieldsNullEverything() {
        UUID owner = userPopulator.createUser().getId();

        DayScoreService.DayScore day = dayFor(owner, DAY);

        assertThat(day.subscores().sleep()).isNull();
        assertThat(day.subscores().fuel()).isNull();
        assertThat(day.subscores().checkin()).isNull();
        assertThat(day.subscores().activity()).isNull();
        assertThat(day.score()).isNull();
    }

    @Test
    void kcalOutsideBandScoresZeroFuelCloseness() {
        UUID owner = userPopulator.createUser().getId();
        // 2x kcal target, way outside the default 0.25 band -> closeness floors at 0; no protein
        // logged (factor 0) -> the protein-ratio half is also 0 -> fuel subscore == 0, not null
        // (kcal WAS logged that day, it is just badly off-target).
        seedMeal(owner, DAY, 2.0, 0.0);
        // give the day a second present domain so the honest-null gate (>=2 subscores) does not
        // swallow the fuel value under test.
        sleepLogPopulator.createSleepLog(owner, DAY, new BigDecimal("8.0"), 10);

        DayScoreService.DayScore day = dayFor(owner, DAY);

        assertThat(day.subscores().fuel()).isEqualTo(0);
    }

    /**
     * The {@code scores(userId, from, to, Map)} overload must degrade to the standalone fetch,
     * not NPE, when the caller's map omits a day (mezo-8tp8 review I1): kcal WAS logged that day,
     * so {@code fuelSubscore} dereferences the day's targets — if the map lookup returned
     * {@code null} unguarded, this would throw. Falling back to {@link FuelDayService#getDay}
     * for the missing day scores it exactly as the standalone {@code scores(userId, from, to)}
     * would.
     */
    @Test
    void mapOverloadFallsBackToFetchWhenDayIsMissingFromTheSuppliedMap() {
        UUID owner = userPopulator.createUser().getId();
        seedMeal(owner, DAY, 1.0, 1.0);
        sleepLogPopulator.createSleepLog(owner, DAY, new BigDecimal("8.0"), 10);

        List<DayScoreService.DayScore> scores =
                dayScoreService.scores(owner, DAY, DAY, Map.<LocalDate, FuelDayResponse>of());

        assertThat(scores).hasSize(1);
        assertThat(scores.get(0).subscores().fuel()).isEqualTo(100);
        assertThat(scores.get(0).subscores().sleep()).isEqualTo(100);
        assertThat(scores.get(0).score()).isEqualTo(100);
    }

    /**
     * Locks in {@code overallScore}'s chosen reading of "round(100 * mean(present subscores))":
     * the mean of the ALREADY-ROUNDED 0-100 subscore ints, not round(100 * mean of the raw 0-1
     * fractions). Also exercises two branches no other test hits: sleep with quality ABSENT
     * (duration-only ratio) and fuel with NO protein target (kcal-closeness-only).
     *
     * <p>sleep: durationH=1.25h / target 8.0h -> raw fraction 0.15625 -> subscore round(15.625)=16.
     * fuel: kcalTarget=4000 (goal segment, proteinG=0 so the protein-blend half never applies),
     * consumed kcal=3450 -> closeness = 1 - |3450/4000-1|/0.25 = 0.45 exactly -> subscore 45.
     *
     * <p>Implemented (mean-of-rounded-ints): round((16+45)/2) = round(30.5) = 31.
     * Alternative (round-of-mean-of-fractions): round((15.625+45)/2) = round(30.3125) = 30.
     * The two readings diverge by exactly 1 here — asserting 31 pins the implemented one.
     */
    @Test
    void overallScoreIsTheMeanOfRoundedSubscoresNotTheRoundOfTheMeanOfFractions() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, DAY, new BigDecimal("1.25"), null);
        seedNoProteinTargetGoal(owner, DAY, 4000);
        seedMealWithKcal(owner, DAY, 3450.0);

        DayScoreService.DayScore day = dayFor(owner, DAY);

        assertThat(day.subscores().sleep()).isEqualTo(16);
        assertThat(day.subscores().fuel()).isEqualTo(45);
        assertThat(day.subscores().checkin()).isNull();
        assertThat(day.subscores().activity()).isNull();
        // 31, NOT 30 — see the javadoc above for why this pins the mean-of-ints reading.
        assertThat(day.score()).isEqualTo(31);
    }

    /**
     * Two more branches: check-in with a PARTIAL slot count (2 of the canonical 4, not the 0/4/full
     * cases the other tests cover) and activity from XP ALONE (no workout logged that day at all —
     * only a habit's awarded XP). Also doubles as the "exactly 2 subscores present" floor: with
     * sleep and fuel absent, this is the minimal case where {@code score} stops being null.
     *
     * <p>checkin: 2 slots, energy 7 both times -> c=2/4=0.5, energy-term=clamp01((7-1)/9)=0.6667 ->
     * value=0.6*0.5+0.4*0.6667=0.5667 -> subscore round(56.667)=57.
     * activity: no GYM_VOLUME_KG/SPORT_LOAD_MIN/TRAINING_RPE row at all, only habit xpAwarded=75
     * against the default xp-baseline=150 -> ratio=0.5 -> subscore 50.
     * score = round((57+50)/2) = round(53.5) = 54.
     */
    @Test
    void checkinPartialCountAndXpOnlyActivity_areTheMinimalTwoSubscoreFloor() {
        UUID owner = userPopulator.createUser().getId();
        checkInPopulator.createCheckIn(owner, DAY, "08:00", 7, 5, null);
        checkInPopulator.createCheckIn(owner, DAY, "20:00", 7, 5, null);
        HabitDayEntity habit = new HabitDayEntity();
        habit.setCreatedBy(owner);
        habit.setHabitDate(DAY);
        habit.setHabitKey("test-xp-only");
        habit.setStatus(HabitDayEntity.STATUS_DONE);
        habit.setXpAwarded(75);
        habitDayRepository.saveAndFlush(habit);

        DayScoreService.DayScore day = dayFor(owner, DAY);

        assertThat(day.subscores().sleep()).isNull();
        assertThat(day.subscores().fuel()).isNull();
        assertThat(day.subscores().checkin()).isEqualTo(57);
        assertThat(day.subscores().activity()).isEqualTo(50);
        assertThat(day.score()).isEqualTo(54);
    }
}
