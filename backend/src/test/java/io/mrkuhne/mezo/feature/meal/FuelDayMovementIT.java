package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FuelDayEnergy;
import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.goal.engine.service.TdeeBootstrapService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.nutrition.service.DailyTargets;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
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
 * The Fuel day's served target follows the LOGGED movement (mezo-tb3s2, spec
 * {@code docs/superpowers/specs/2026-09-28-actual-movement-budget-design.md} §2), replacing the
 * mezo-sxlj / mezo-32m82 day-type pick ({@code FuelDayDayTypeIT}):
 * {@code target = max(BMR, base + logged planned + logged extra + balance)}. A legacy
 * {@code trainingDayKcal}/{@code restDayKcal} split on the segment is ignored. Today's still-unlogged
 * plan rides along as the display-only {@code pendingMovementKcal}; a past day never carries one.
 * {@code dailyTargets} (the meal scorer's base) serves the same number as the hero.
 */
@Transactional
class FuelDayMovementIT extends AbstractIntegrationTest {

    @Autowired private FuelDayService fuelDayService;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private GoalRepository goalRepository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private TrainPopulator train;
    @Autowired private BiometricProfilePopulator biometricProfilePopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private TdeeBootstrapService tdeeBootstrapService;

    private static final int SEGMENT_KCAL = 2150;
    private static final int SEGMENT_CARBS_G = 200;
    private static final int BALANCE_KCAL = -500;
    private static final int BMR = 1963;
    private static final int BASE_KCAL = 2356;

    private UUID owner;
    private BigDecimal bodyBmr;

    /**
     * An owner with a known body (so gym net kcal and the pending preview can be computed) and an
     * active goal starting {@code startDate}: one segment covering weeks 1–12 that STILL carries a
     * legacy day-type split (2300 / 1950), which the served target must ignore.
     */
    private void seed(LocalDate startDate) {
        owner = databasePopulator.populateUser("movement-owner-" + UUID.randomUUID() + "@test.local");
        BiometricProfileEntity profile = biometricProfilePopulator.create(owner);
        weightLogPopulator.createWeightLog(owner, LocalDate.parse("2026-05-30"), new BigDecimal("80.00"));
        bodyBmr = tdeeBootstrapService.bmr(profile, new BigDecimal("80.00"));
        GoalPrescriptionJson prescription = new GoalPrescriptionJson(null, "formula",
            List.of(new GoalPrescriptionJson.Segment(1, 12, "vágás", SEGMENT_KCAL, 163, SEGMENT_CARBS_G, 70,
                null, null, null, BALANCE_KCAL, 2300, 1950, null)),
            null, null);
        GoalEntity goal = goalPopulator.createGoalFull(owner, startDate, startDate.plusWeeks(12), prescription,
            4, "06:30", "22:30");
        goal.setTdeeBootstrap(new TdeeBootstrapJson(BigDecimal.valueOf(BMR), new BigDecimal("1.2"),
            BigDecimal.valueOf(BASE_KCAL), new BigDecimal("570"), BigDecimal.valueOf(BASE_KCAL + 570), "MSJ",
            OffsetDateTime.of(2026, 6, 1, 8, 0, 0, 0, ZoneOffset.UTC), 2));
        goalRepository.saveAndFlush(goal);
    }

    /** round((MET_moderate − 1) × bmr/24 × minutes/60) — independent of ActivityEnergyModel. */
    private int moderateNet(String met, int minutes) {
        return new BigDecimal(met).subtract(BigDecimal.ONE).multiply(bodyBmr)
            .multiply(BigDecimal.valueOf(minutes))
            .divide(BigDecimal.valueOf(24 * 60), MathContext.DECIMAL64)
            .setScale(0, RoundingMode.HALF_UP).intValueExact();
    }

    private static int dow(LocalDate date) {
        return date.getDayOfWeek().getValue() - 1;
    }

    // (a) A done planned meso gym + a logged 490-kcal planned volleyball on a past Wednesday:
    // planned = gym net + 490, extra 0, target = base + planned + balance, no pending.
    @Test
    void testGetDay_shouldCreditLoggedPlannedMovement_whenPlannedGymAndVolleyballWereDone() {
        LocalDate start = LocalDate.of(2026, 6, 1);                 // Monday
        seed(start);
        LocalDate wed = start.plusDays(2);
        train.createGymSlot(owner, dow(wed), "07:00");
        UUID mesoId = train.createActiveMeso(owner).getId();
        train.createWorkoutInstance(owner, train.createTemplateDay(owner, mesoId, "Sze"), wed, "completed", 3600);
        train.createScheduleSlot(owner, dow(wed), "18:00", 90, "training");
        train.withKcal(train.createSportSession(owner, wed), 490);  // 18:15 — fulfils the slot
        int planned = moderateNet("3.5", 60) + 490;
        int expected = BASE_KCAL + planned + BALANCE_KCAL;

        FuelDayResponse day = fuelDayService.getDay(owner, wed);

        FuelDayEnergy e = day.getEnergy();
        assertThat(e.getPlannedMovementKcal()).isEqualTo(planned);
        assertThat(e.getExtraMovementKcal()).isZero();
        assertThat(e.getBalanceKcal()).isEqualTo(BALANCE_KCAL);
        assertThat(e.getTargetKcal()).isEqualTo(expected);
        assertThat(e.getPendingMovementKcal()).isNull();
        assertThat(day.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(expected));
        assertThat(day.getTargets().getC()).isEqualByComparingTo(
            BigDecimal.valueOf(SEGMENT_CARBS_G + Math.round((expected - SEGMENT_KCAL) / 4f)));

        DailyTargets scorer = fuelDayService.dailyTargets(owner, wed);   // score ↔ hero coherence
        assertThat(scorer.kcal()).isEqualTo(expected);
        assertThat(scorer.energy().plannedMovementKcal()).isEqualTo(planned);
    }

    // (b) Today with the plan still ahead and nothing logged: the target does not pre-credit the
    // plan (max(BMR, base + balance)); the plan shows as pending instead.
    @Test
    void testGetDay_shouldServeBasePlusBalanceWithPending_whenTodaysPlanIsNotLoggedYet() {
        LocalDate today = LocalDate.now();                          // pending keys on the real clock
        seed(today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1));
        train.createGymSlot(owner, dow(today), "07:00");
        train.createScheduleSlot(owner, dow(today), "18:00", 90, "training");

        FuelDayEnergy e = fuelDayService.getDay(owner, today).getEnergy();

        assertThat(e.getTargetKcal()).isEqualTo(Math.max(BMR, BASE_KCAL + BALANCE_KCAL));
        assertThat(e.getPlannedMovementKcal() + e.getExtraMovementKcal()).isZero();
        assertThat(e.getPendingMovementKcal()).isPositive()
            .isEqualTo(moderateNet("3.5", 60) + moderateNet("4.0", 90));
        assertThat(e.getBaseKcal() + e.getPlannedMovementKcal() + e.getExtraMovementKcal() + e.getBalanceKcal())
            .isEqualTo(e.getTargetKcal());
    }

    // (c) The same plan on a past day, never logged: no preview — a miss is simply a miss.
    @Test
    void testGetDay_shouldCarryNullPending_whenTheDayIsPast() {
        LocalDate today = LocalDate.now();
        seed(today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1));
        LocalDate lastWeek = today.minusWeeks(1);                   // anchored to the queried day
        train.createGymSlot(owner, dow(lastWeek), "07:00");
        train.createScheduleSlot(owner, dow(lastWeek), "18:00", 90, "training");

        FuelDayEnergy e = fuelDayService.getDay(owner, lastWeek).getEnergy();

        assertThat(e.getPendingMovementKcal()).isNull();
        assertThat(e.getTargetKcal()).isEqualTo(Math.max(BMR, BASE_KCAL + BALANCE_KCAL));
    }

    // An unplanned logged session is credited as extra on top of base + balance (the legacy
    // rest-day kcal no longer anchors it).
    @Test
    void testGetDay_shouldCreditUnplannedSessionAsExtra() {
        LocalDate start = LocalDate.of(2026, 6, 1);
        seed(start);
        LocalDate tuesday = start.plusDays(1);                      // no slot that weekday
        train.withKcal(train.createSportSession(owner, tuesday), 400);

        FuelDayEnergy e = fuelDayService.getDay(owner, tuesday).getEnergy();

        assertThat(e.getPlannedMovementKcal()).isZero();
        assertThat(e.getExtraMovementKcal()).isEqualTo(400);
        assertThat(e.getTargetKcal()).isEqualTo(BASE_KCAL + 400 + BALANCE_KCAL);
    }
}
