package io.mrkuhne.mezo.feature.capacity.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepAnchorPort;
import io.mrkuhne.mezo.feature.capacity.entity.AdjustmentState;
import io.mrkuhne.mezo.feature.capacity.entity.DayAdjustmentEntity;
import io.mrkuhne.mezo.feature.capacity.repository.DayAdjustmentRepository;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.MoveSessionDay;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.ShiftBedtime;
import io.mrkuhne.mezo.feature.capacity.service.ProposalWordingWriter.Wording;
import io.mrkuhne.mezo.feature.goal.engine.service.TdeeBootstrapService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import io.mrkuhne.mezo.feature.season.service.SleepNeedRule;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import java.time.ZoneId;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Import;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Boop B7 K3 (mezo-r36n9.17, Task 16): every cross-effect of a proposal comes from the real engines. The strongest
 * check: the calculator's "after" for a move equals what the fuel day service and the load model actually show once
 * the move is in the ledger. The capacity clock is pinned to a Wednesday 08:00 in his zone, the week after next, so
 * the fuel day's pending preview (which keys on the real date) exists for both days and every assertion always runs.
 * Numbers are invented.
 */
@Transactional
@Import(DayAdjustmentServiceIT.ClockConfig.class)
class CrossEffectCalculatorIT extends AbstractIntegrationTest {

    @Autowired private CrossEffectCalculator calculator;
    @Autowired private WeekPictureService pictures;
    @Autowired private CapacityDayService capacityDays;
    @Autowired private ProposalWordingWriter words;
    @Autowired private FuelDayService fuelDays;
    @Autowired private DayAdjustmentRepository adjustments;
    @Autowired private SleepAnchorPort sleepAnchor;
    @Autowired private SeasonRepository seasons;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private TrainPopulator train;
    @Autowired private BiometricProfilePopulator profiles;
    @Autowired private WeightLogPopulator weights;
    @Autowired private GoalPopulator goals;
    @Autowired private GoalRepository goalRepository;
    @Autowired private TdeeBootstrapService tdeeBootstrap;
    @Autowired private SleepGoalPopulator sleepGoals;
    @Autowired private WearableProperties wearable;
    @Autowired private DayAdjustmentServiceIT.MutableClock clock;

    /** Monday of the week after next (always ahead of the real date the fuel preview uses). */
    private final LocalDate monday = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
        .plusWeeks(2);
    private final LocalDate today = monday.plusDays(2);  // Wednesday: his pinned "today"
    private final LocalDate other = monday.plusDays(3);  // Thursday, the same week
    private UUID owner;
    private GoalEntity goal;

    @BeforeEach
    void pinClock() {
        clock.set(today.atTime(8, 0).atZone(ZoneId.of(wearable.zone())).toInstant());
    }

    @AfterEach
    void resetClock() {
        clock.reset();
    }

    private void fixture() {
        owner = databasePopulator.populateUser("cross-effects-" + UUID.randomUUID() + "@test.local");
        BiometricProfileEntity profile = profiles.create(owner);
        weights.createWeightLog(owner, LocalDate.now().minusDays(3), new BigDecimal("80.00"));
        tdeeBootstrap.bmr(profile, new BigDecimal("80.00"));
        LocalDate start = monday.minusWeeks(1);
        GoalPrescriptionJson prescription = new GoalPrescriptionJson(null, "formula",
            List.of(new GoalPrescriptionJson.Segment(1, 12, "vágás", 2150, 163, 200, 70,
                null, null, null, -500, null, null, null)),
            null, null);
        goal = goals.createGoalFull(owner, start, start.plusWeeks(12), prescription, 4, "06:30", "22:30");
        goal.setTdeeBootstrap(new TdeeBootstrapJson(BigDecimal.valueOf(1963), new BigDecimal("1.2"),
            BigDecimal.valueOf(2356), new BigDecimal("570"), BigDecimal.valueOf(2926), "MSJ",
            OffsetDateTime.of(2026, 6, 1, 8, 0, 0, 0, ZoneOffset.UTC), 2));
        goal = goalRepository.saveAndFlush(goal);
        sleepGoals.goal(owner, 450, "WAKE", "06:30", 15);

        SeasonEntity season = new SeasonEntity();
        season.setCreatedBy(owner);
        season.setTitle("Őszi évad");
        season.setStatus(SeasonEntity.STATUS_ACTIVE);
        season.setStartDate(start);
        season.setWeeks(12);
        season.setGoalId(goal.getId());
        seasons.saveAndFlush(season);
    }

    private WorkoutSessionEntity templateOnToday() {
        var meso = train.createActiveMeso(owner);
        WorkoutSessionEntity day = train.createWorkoutSession(owner, meso.getId(),
            WorkoutService.HU_DAY_LABELS.get(today.getDayOfWeek().getValue() - 1), "Pull 1", 0, "active");
        train.createExercise(owner, day.getId(), "Evezés", 0);
        train.createGymSlot(owner, today.getDayOfWeek().getValue() - 1, "19:00");
        return day;
    }

    private static int pending(FuelDayResponse day) {
        return Optional.ofNullable(day.getEnergy().getPendingMovementKcal()).orElse(0);
    }

    @Test
    void crossEffectsComeFromEngines() {
        fixture();
        WorkoutSessionEntity session = templateOnToday();
        ProposalDraft draft = new ProposalDraft("MOVE_SESSION_DAY",
            List.of(AdjustmentDraft.of(new MoveSessionDay(session.getId(), today, other))),
            Map.of("fromDate", today.toString(), "toDate", other.toString(), "sessionTime", "19:00",
                "toEmptyCalendar", true),
            0.5);
        FuelDayResponse fromBefore = fuelDays.getDay(owner, today);
        FuelDayResponse otherBefore = fuelDays.getDay(owner, other);
        int x = pending(fromBefore);
        assertThat(x).isPositive();
        CapacityDay fromLoad = capacityDays.day(owner, today);

        WeekPicture w = pictures.picture(owner, monday);
        assertThat(w.sessionsOn(today)).singleElement()
            .satisfies(s -> assertThat(s.templateId()).isEqualTo(session.getId()));
        Effects e = calculator.effects(owner, draft);

        // kcal: the fuel day service's own expected extra, moved whole with the session
        assertThat(e.sessionKcal()).isEqualTo(x);
        assertThat(e.day(today).orElseThrow().expectedExtraBefore()).isEqualTo(fromBefore.getEnergy()
            .getPendingMovementKcal());
        assertThat(e.day(today).orElseThrow().expectedExtraAfter()).isZero();
        int otherAfter = e.day(other).orElseThrow().expectedExtraAfter();
        // load: the load model's verdict before
        assertThat(e.day(today).orElseThrow().verdictBefore()).isEqualTo(fromLoad.verdict());
        assertThat(e.day(today).orElseThrow().ratioBefore()).isCloseTo(fromLoad.ratio(), within(1e-9));
        double otherRatioAfter = e.day(other).orElseThrow().ratioAfter();
        // week totals: the served targets + expected extras; a move changes neither the count nor the sum
        int week = 0;
        for (LocalDate d = monday; !d.isAfter(monday.plusDays(6)); d = d.plusDays(1)) {
            FuelDayResponse f = fuelDays.getDay(owner, d);
            week += f.getTargets().getKcal().intValue() + pending(f);
        }
        assertThat(e.before().expectedKcal()).isEqualTo(week);
        assertThat(e.after().expectedKcal()).isEqualTo(week);
        assertThat(e.before().sessions()).isEqualTo(1);
        assertThat(e.after().sessions()).isEqualTo(1);
        int need = SleepNeedRule.sleepNeedMinutes(450, 1, 0);
        assertThat(e.before().sleepHours()).isEqualTo(Math.round(7 * need / 60.0 * 10) / 10.0);
        // the season's target date is read, never recomputed
        assertThat(e.seasonTargetDate()).isEqualTo(goal.getTargetDate());
        // the card line carries the engine's figure and says the extra comes with the session
        Wording words = this.words.template(draft, e);
        assertThat(words.effectLines()).anyMatch(l -> l.contains(x + "\u00A0kcal") && l.contains("amikor megcsinálod"));

        // …and once the move is really in the ledger, the engines show exactly the calculator's "after"
        DayAdjustmentEntity row = new DayAdjustmentEntity();
        row.setCreatedBy(owner);
        row.setDate(today);
        row.setKind("MOVE_SESSION_DAY");
        row.setPayload(new MoveSessionDay(session.getId(), today, other).toMap());
        row.setBundleId(UUID.randomUUID());
        row.setState(AdjustmentState.ACTIVE.wire());
        row.setClientRef(UUID.randomUUID());
        adjustments.saveAndFlush(row);

        assertThat(pending(fuelDays.getDay(owner, today))).isZero();
        assertThat(pending(fuelDays.getDay(owner, other))).isEqualTo(otherAfter);
        assertThat(otherAfter).isEqualTo(pending(otherBefore) + x);
        assertThat(capacityDays.day(owner, other).ratio()).isCloseTo(otherRatioAfter, within(1e-6));
    }

    @Test
    void bedtimeAndNeedComeFromTheSleepRule() {
        fixture();
        templateOnToday();
        LocalTime later = LocalTime.of(23, 45);
        ProposalDraft draft = new ProposalDraft("SHIFT_BEDTIME",
            List.of(AdjustmentDraft.of(new ShiftBedtime(today, later))), Map.of(), 0.1);

        Effects e = calculator.effects(owner, draft);

        assertThat(e.sleep()).isNotNull();
        assertThat(e.sleep().bedtimeBefore()).isEqualTo(sleepAnchor.resolve(owner).bed());
        assertThat(e.sleep().bedtimeAfter()).isEqualTo(later);
        assertThat(e.sleep().needMin()).isEqualTo(SleepNeedRule.sleepNeedMinutes(450, 1, 0));
        assertThat(e.day(today).orElseThrow().verdictAfter()).isEqualTo(e.day(today).orElseThrow().verdictBefore());
    }
}
