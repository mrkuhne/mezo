package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.FuelDayRollup;
import io.mrkuhne.mezo.api.dto.FuelWeekResponse;
import io.mrkuhne.mezo.feature.goal.engine.service.TdeeBootstrapService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Kind;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Reason;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity.Estimate;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.PlannedSkipPopulator;
import io.mrkuhne.mezo.support.populator.RecoveryPeriodPopulator;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Kihagyás S3 (mezo-q4xt2.3, spec §10): the Fuel day and week serve {@code fuelMode},
 * {@code recoveryCategory}, {@code recoveryDay} and {@code skippedKcal}. MAINTENANCE drops the goal
 * deficit from the served target, GUIDANCE zeroes the skipped kcal, ESTIMATE leaves targets alone.
 */
@Transactional
class FuelDayRecoveryIT extends AbstractIntegrationTest {

    private static final int SEGMENT_KCAL = 2150;
    private static final int BALANCE_KCAL = -200;
    private static final int BMR = 1963;
    private static final int BASE_KCAL = 2356;
    private static final int DEFICIT_TARGET = BASE_KCAL + BALANCE_KCAL;   // 2156, above the BMR floor

    @Autowired private FuelDayService fuelDayService;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private GoalRepository goalRepository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private RecoveryPeriodPopulator periods;
    @Autowired private PlannedSkipPopulator skips;

    private UUID owner;
    /** A past Monday, so no day is "today" (no pending preview) and the whole week is queryable. */
    private final LocalDate weekStart =
        LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);

    private void seed() {
        owner = databasePopulator.populateUser("fuel-recovery-" + UUID.randomUUID() + "@test.local");
        GoalPrescriptionJson prescription = new GoalPrescriptionJson(null, "formula",
            List.of(new GoalPrescriptionJson.Segment(1, 12, "vágás", SEGMENT_KCAL, 163, 200, 70,
                null, null, null, BALANCE_KCAL, null, null, null)),
            null, null);
        GoalEntity goal = goalPopulator.createGoalFull(owner, weekStart.minusWeeks(1),
            weekStart.plusWeeks(12), prescription, 4, "06:30", "22:30");
        goal.setTdeeBootstrap(new TdeeBootstrapJson(BigDecimal.valueOf(BMR), new BigDecimal("1.2"),
            BigDecimal.valueOf(BASE_KCAL), new BigDecimal("570"), BigDecimal.valueOf(BASE_KCAL + 570), "MSJ",
            OffsetDateTime.of(2026, 6, 1, 8, 0, 0, 0, ZoneOffset.UTC), 2));
        goalRepository.saveAndFlush(goal);
    }

    private void mealSkip(LocalDate date, String key, Integer kcal) {
        PlannedSkipEntity s = new PlannedSkipEntity();
        s.setCreatedBy(owner);
        s.setDate(date);
        s.setKind(Kind.MEAL);
        s.setSessionKey(key);
        s.setReasonCategory(Reason.NONE);
        s.setPlannedKcal(kcal);
        skips.save(s);
    }

    @Test
    void testGetDay_shouldCarryNoMode_whenNoPeriodAndNoSkip() {
        seed();
        FuelDayResponse day = fuelDayService.getDay(owner, weekStart.plusDays(1));

        assertThat(day.getFuelMode()).isNull();
        assertThat(day.getRecoveryCategory()).isNull();
        assertThat(day.getRecoveryDay()).isNull();
        assertThat(day.getSkippedKcal()).isZero();
        assertThat(day.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(DEFICIT_TARGET));
    }

    @Test
    void testGetDay_shouldDropTheDeficit_whenInjuryPeriod() {
        seed();
        LocalDate day = weekStart.plusDays(2);
        periods.open(owner, Reason.INJURY, day.minusDays(1), Estimate.WEEK);

        FuelDayResponse r = fuelDayService.getDay(owner, day);

        assertThat(r.getFuelMode()).isEqualTo(FuelDayResponse.FuelModeEnum.MAINTENANCE);
        assertThat(r.getRecoveryCategory()).isEqualTo(FuelDayResponse.RecoveryCategoryEnum.INJURY);
        assertThat(r.getRecoveryDay()).isEqualTo(2);
        assertThat(r.getEnergy().getBalanceKcal()).isZero();
        assertThat(r.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(BASE_KCAL));
        assertThat(r.getTargets().getKcal().intValue()).isEqualTo(DEFICIT_TARGET - BALANCE_KCAL);
    }

    @Test
    void testGetDay_shouldGuideAndZeroSkippedKcal_whenIllnessPeriodEvenWithAMealSkip() {
        seed();
        LocalDate day = weekStart.plusDays(3);
        periods.open(owner, Reason.ILLNESS, day.minusDays(2), Estimate.FEW_DAYS);
        mealSkip(day, "lunch#1", 900);

        FuelDayResponse r = fuelDayService.getDay(owner, day);

        assertThat(r.getFuelMode()).isEqualTo(FuelDayResponse.FuelModeEnum.GUIDANCE);
        assertThat(r.getRecoveryDay()).isEqualTo(3);
        assertThat(r.getSkippedKcal()).isZero();
        assertThat(r.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(DEFICIT_TARGET));
    }

    @Test
    void testGetDay_shouldEstimateAndKeepTargets_whenTravelPeriod() {
        seed();
        LocalDate day = weekStart.plusDays(1);
        periods.open(owner, Reason.TRAVEL, day, Estimate.WEEK);

        FuelDayResponse r = fuelDayService.getDay(owner, day);

        assertThat(r.getFuelMode()).isEqualTo(FuelDayResponse.FuelModeEnum.ESTIMATE);
        assertThat(r.getRecoveryDay()).isEqualTo(1);
        assertThat(r.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(DEFICIT_TARGET));
    }

    @Test
    void testGetDay_shouldServeSkippedKcalAndKeepTargets_whenMealSkippedOnANormalDay() {
        seed();
        LocalDate day = weekStart.plusDays(1);
        mealSkip(day, "lunch#1", 900);

        FuelDayResponse r = fuelDayService.getDay(owner, day);

        assertThat(r.getFuelMode()).isNull();
        assertThat(r.getSkippedKcal()).isEqualTo(900);
        assertThat(r.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(DEFICIT_TARGET));
    }

    @Test
    void testGetDay_shouldClampSkippedKcalToTarget_whenSkipsExceedIt() {
        seed();
        LocalDate day = weekStart.plusDays(1);
        mealSkip(day, "lunch#1", 1500);
        mealSkip(day, "dinner#1", 1500);
        mealSkip(day, "snack#1", null);

        assertThat(fuelDayService.getDay(owner, day).getSkippedKcal()).isEqualTo(DEFICIT_TARGET);
    }

    @Test
    void testGetWeek_shouldCarryTheModeOnPeriodDaysOnly() {
        seed();
        periods.ended(owner, Reason.INJURY, weekStart.plusDays(2), weekStart.plusDays(5));
        mealSkip(weekStart.plusDays(6), "lunch#1", 700);

        FuelWeekResponse week = fuelDayService.getWeek(owner, weekStart);

        for (int i = 0; i < 7; i++) {
            FuelDayRollup d = week.getDays().get(i);
            boolean inPeriod = i >= 2 && i <= 4;
            if (inPeriod) {
                assertThat(d.getFuelMode()).isEqualTo(FuelDayRollup.FuelModeEnum.MAINTENANCE);
                assertThat(d.getRecoveryDay()).isEqualTo(i - 1);
                assertThat(d.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(BASE_KCAL));
            } else {
                assertThat(d.getFuelMode()).isNull();
                assertThat(d.getRecoveryDay()).isNull();
                assertThat(d.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(DEFICIT_TARGET));
            }
            assertThat(d.getSkippedKcal()).isEqualTo(i == 6 ? 700 : 0);
        }
    }
}
