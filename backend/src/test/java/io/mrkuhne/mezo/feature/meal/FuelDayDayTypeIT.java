package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.nutrition.service.DailyTargets;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.SportEventEntity;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.SportEventRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Slice 3 (mezo-sxlj): the Fuel day picks the date's {@code trainingDayKcal} once a PLANNED session
 * was actually logged on it (mezo-u13jv — the plan alone never raises the target; mezo-32m82 D3 —
 * an unplanned session no longer flips the pick, it is credited as extra kcal on top of the
 * rest-day kcal), else {@code restDayKcal}, deriving the serve-time carb delta
 * (protein/fat constant) — never stored. {@code dailyTargets} (the meal scorer's base, mezo-3g5w)
 * applies the SAME pick, so a meal logged on a training day is judged against the training-day
 * budget the Fuel-day hero shows (score↔hero coherence).
 */
@Transactional
class FuelDayDayTypeIT extends AbstractIntegrationTest {

    @Autowired private FuelDayService fuelDayService;
    @Autowired private GymScheduleSlotRepository gymRepo;
    @Autowired private SportSessionRepository sportSessionRepository;
    @Autowired private SportEventRepository sportEventRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private TrainPopulator trainPopulator;

    private static final int SEGMENT_KCAL = 2150;
    private static final int SEGMENT_PROTEIN_G = 163;
    private static final int SEGMENT_CARBS_G = 200;
    private static final int SEGMENT_FAT_G = 70;
    private static final int TRAINING_DAY_KCAL = 2300;
    private static final int REST_DAY_KCAL = 1950;

    private int segmentCarbsG() {
        return SEGMENT_CARBS_G;
    }

    /** Active goal whose week-1 segment covers 2026-06-01..07, split by day type. */
    private UUID seedGoalWithDayTypeSegment() {
        return seedGoal(new GoalPrescriptionJson.Segment(1, 6, "day-type", SEGMENT_KCAL,
            SEGMENT_PROTEIN_G, SEGMENT_CARBS_G, SEGMENT_FAT_G, null, null, null, null,
            TRAINING_DAY_KCAL, REST_DAY_KCAL, null));
    }

    /** Same segment shape, but {@code trainingDayKcal}/{@code restDayKcal} null (pre-slice-3, uniform). */
    private UUID seedGoalWithUniformSegment() {
        return seedGoal(new GoalPrescriptionJson.Segment(1, 6, "uniform", SEGMENT_KCAL,
            SEGMENT_PROTEIN_G, SEGMENT_CARBS_G, SEGMENT_FAT_G, null, null, null, null,
            null, null, null));
    }

    /**
     * Same segment shape, but ONLY {@code trainingDayKcal} set — {@code restDayKcal} null (a
     * defensive shape {@link io.mrkuhne.mezo.feature.goal.engine.service.DayTypeShiftCalculator}
     * never itself emits, but {@code dayTypeAdjusted} must still degrade safely on: only one of the
     * two fields set means the picked field can be null on a rest day, and the uniform {@code kcal}
     * must be served rather than NPE-ing or half-applying the split, mezo-sxlj Finding 3).
     */
    private UUID seedGoalWithPartialSplitSegment() {
        return seedGoal(new GoalPrescriptionJson.Segment(1, 6, "partial-split", SEGMENT_KCAL,
            SEGMENT_PROTEIN_G, SEGMENT_CARBS_G, SEGMENT_FAT_G, null, null, null, null,
            TRAINING_DAY_KCAL, null, null));
    }

    private UUID seedGoal(GoalPrescriptionJson.Segment segment) {
        UUID owner = databasePopulator.populateUser("day-type-owner-" + UUID.randomUUID() + "@test.local");
        LocalDate startDate = LocalDate.of(2026, 6, 1); // Monday — goal-week 1 covers 06-01..07
        GoalPrescriptionJson prescription = new GoalPrescriptionJson(null, "formula",
            List.of(segment), null, null);
        goalPopulator.createGoalFull(owner, startDate, startDate.plusWeeks(11), prescription,
            4, "06:30", "22:30");
        return owner;
    }

    private void seedGymSlot(UUID owner, int dayOfWeek) {
        GymScheduleSlotEntity g = new GymScheduleSlotEntity();
        g.setCreatedBy(owner);
        g.setDayOfWeek(dayOfWeek);
        g.setTime("17:30");
        gymRepo.save(g);
    }

    /** A recurring sport slot on {@code dayOfWeek} at 18:00 — the plan a logged session fulfils. */
    private void seedSportSlot(UUID owner, int dayOfWeek) {
        trainPopulator.createScheduleSlot(owner, dayOfWeek, "18:00", 90, "training");
    }

    /** A LOGGED sport session played on {@code date} — with or without a matching plan. */
    private void seedLoggedSportSession(UUID owner, LocalDate date) {
        seedLoggedSportSession(owner, date, null);
    }

    private void seedLoggedSportSession(UUID owner, LocalDate date, Integer kcal) {
        SportSessionEntity s = new SportSessionEntity();
        s.setCreatedBy(owner);
        s.setDate(date);
        s.setTime("18:00");
        s.setSport("volleyball");
        s.setKcal(kcal);
        s.setKcalIsEstimate(kcal == null ? null : Boolean.TRUE);
        sportSessionRepository.save(s);
    }

    /** A dated, one-off sport EVENT on {@code date} (mezo-e1sp) — a plan, not logged movement. */
    private void seedSportEvent(UUID owner, LocalDate date) {
        SportEventEntity e = new SportEventEntity();
        e.setCreatedBy(owner);
        e.setDate(date);
        e.setTime("18:00");
        e.setDurationMin(90);
        e.setKind("match");
        e.setSport("volleyball");
        sportEventRepository.save(e);
    }

    @Test
    void trainingDayServesTrainingKcalAndCarbDelta() {
        UUID owner = seedGoalWithDayTypeSegment();
        LocalDate monday = LocalDate.of(2026, 6, 1); // dayOfWeek 0
        seedSportSlot(owner, 0);
        seedLoggedSportSession(owner, monday); // fulfils the planned slot → planned done

        FuelDayResponse day = fuelDayService.getDay(owner, monday);

        assertThat(day.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(TRAINING_DAY_KCAL));
        // carbs = segment carbsG + round((2300 - 2150) / 4) = segmentCarbsG() + 38
        assertThat(day.getTargets().getC())
            .isEqualByComparingTo(BigDecimal.valueOf(segmentCarbsG() + 38));
        assertThat(day.getTargets().getP()).isEqualByComparingTo(BigDecimal.valueOf(SEGMENT_PROTEIN_G));
    }

    @Test
    void restDayServesRestKcalAndNegativeCarbDelta() {
        UUID owner = seedGoalWithDayTypeSegment();
        LocalDate tuesday = LocalDate.of(2026, 6, 2); // dayOfWeek 1 — no schedule seeded

        FuelDayResponse day = fuelDayService.getDay(owner, tuesday);

        assertThat(day.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(REST_DAY_KCAL));
        // carbs = segment carbsG + round((1950 - 2150) / 4) = segmentCarbsG() - 50
        assertThat(day.getTargets().getC())
            .isEqualByComparingTo(BigDecimal.valueOf(segmentCarbsG() - 50));
    }

    @Test
    void nullDayTypeFieldsServeTheUniformKcal() {
        UUID owner = seedGoalWithUniformSegment();

        FuelDayResponse day = fuelDayService.getDay(owner, LocalDate.of(2026, 6, 2));

        assertThat(day.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(SEGMENT_KCAL));
        assertThat(day.getTargets().getC()).isEqualByComparingTo(BigDecimal.valueOf(segmentCarbsG()));
    }

    // -- mezo-u13jv (owner decision 2026-09-24): classification is LOGGED-movement based — the plan
    // alone (a gym slot, a dated sport event) never raises the day's target. mezo-32m82 D3: only a
    // logged session that fulfils a PLAN flips the day-type pick; an unplanned one adds its net kcal
    // on top of the rest-day kcal.

    @Test
    void plannedGymSlotAloneKeepsItARestDay() {
        UUID owner = seedGoalWithDayTypeSegment();
        LocalDate monday = LocalDate.of(2026, 6, 1); // dayOfWeek 0
        seedGymSlot(owner, 0);

        FuelDayResponse day = fuelDayService.getDay(owner, monday);

        assertThat(day.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(REST_DAY_KCAL));
        assertThat(day.getTargets().getC())
            .isEqualByComparingTo(BigDecimal.valueOf(segmentCarbsG() - 50));
    }

    @Test
    void adHocLoggedSportSessionIsRestDayKcalPlusItsExtraKcal() {
        UUID owner = seedGoalWithDayTypeSegment();
        LocalDate tuesday = LocalDate.of(2026, 6, 2); // dayOfWeek 1 — no schedule seeded
        int sessionKcal = 400;
        seedLoggedSportSession(owner, tuesday, sessionKcal);

        FuelDayResponse day = fuelDayService.getDay(owner, tuesday);

        int expectedKcal = REST_DAY_KCAL + sessionKcal;
        assertThat(day.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(expectedKcal));
        assertThat(day.getTargets().getC())
            .isEqualByComparingTo(BigDecimal.valueOf(segmentCarbsG() + Math.round((expectedKcal - SEGMENT_KCAL) / 4f)));
    }

    @Test
    void datedSportEventNotYetPlayedKeepsItARestDay() {
        UUID owner = seedGoalWithDayTypeSegment();
        LocalDate wednesday = LocalDate.of(2026, 6, 3); // dayOfWeek 2 — no schedule seeded
        seedSportEvent(owner, wednesday);

        FuelDayResponse day = fuelDayService.getDay(owner, wednesday);

        assertThat(day.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(REST_DAY_KCAL));
        assertThat(day.getTargets().getC())
            .isEqualByComparingTo(BigDecimal.valueOf(segmentCarbsG() - 50));
    }

    // -- Finding 3 (mezo-sxlj final fix wave): a partial split (only one of the two day-type fields
    // set) is a shape the engine's DayTypeShiftCalculator never itself emits, but dayTypeAdjusted
    // must still degrade safely — served kcal falls back to the uniform target, not a null-fueled NPE.

    @Test
    void partialSplitOnRestDayServesUniformKcal() {
        UUID owner = seedGoalWithPartialSplitSegment();
        LocalDate tuesday = LocalDate.of(2026, 6, 2); // dayOfWeek 1 — no schedule seeded, a rest day

        FuelDayResponse day = fuelDayService.getDay(owner, tuesday);

        assertThat(day.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(SEGMENT_KCAL));
        assertThat(day.getTargets().getC()).isEqualByComparingTo(BigDecimal.valueOf(segmentCarbsG()));
    }

    // -- Score <-> hero coherence: dailyTargets (the meal scorer's base, mezo-3g5w) must apply the
    // SAME day-type pick as targetSet (the MacroHero), so a meal logged on a training day is judged
    // against the training-day budget the hero shows.

    @Test
    void dailyTargetsOnTrainingDayReturnsTrainingKcalAndDeltaAdjustedCarbs() {
        UUID owner = seedGoalWithDayTypeSegment();
        LocalDate monday = LocalDate.of(2026, 6, 1);
        seedSportSlot(owner, 0);
        seedLoggedSportSession(owner, monday);

        DailyTargets t = fuelDayService.dailyTargets(owner, monday);

        assertThat(t.kcal()).isEqualTo(TRAINING_DAY_KCAL);
        assertThat(t.c()).isEqualTo(segmentCarbsG() + 38);
        assertThat(t.p()).isEqualTo(SEGMENT_PROTEIN_G);
        assertThat(t.source()).isEqualTo("goal");
    }

    @Test
    void dailyTargetsOnRestDayReturnsRestKcalAndDeltaAdjustedCarbs() {
        UUID owner = seedGoalWithDayTypeSegment();
        LocalDate tuesday = LocalDate.of(2026, 6, 2);

        DailyTargets t = fuelDayService.dailyTargets(owner, tuesday);

        assertThat(t.kcal()).isEqualTo(REST_DAY_KCAL);
        assertThat(t.c()).isEqualTo(segmentCarbsG() - 50);
        assertThat(t.source()).isEqualTo("goal");
    }
}
