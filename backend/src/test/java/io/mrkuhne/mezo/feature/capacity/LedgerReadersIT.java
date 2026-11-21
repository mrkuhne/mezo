package io.mrkuhne.mezo.feature.capacity;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.boop.service.BoopDay;
import io.mrkuhne.mezo.feature.boop.service.BoopDayAssembler;
import io.mrkuhne.mezo.feature.capacity.entity.AdjustmentState;
import io.mrkuhne.mezo.feature.capacity.entity.DayAdjustmentEntity;
import io.mrkuhne.mezo.feature.capacity.repository.DayAdjustmentRepository;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.LightenSession;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.MoveMealEnergy;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.MoveSessionDay;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.ShiftBedtime;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.ShiftSessionTime;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.ShortenSession;
import io.mrkuhne.mezo.feature.goal.engine.service.TdeeBootstrapService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.meal.service.dayplan.DayPlanService;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.DayPlan;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.DayPlanWindow;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.SlotKey;
import io.mrkuhne.mezo.feature.season.service.AdherenceService;
import io.mrkuhne.mezo.feature.season.service.AdherenceService.AdherenceDay;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService.DayMovement;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService.Window;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import io.mrkuhne.mezo.support.populator.WorkoutTimeOverridePopulator;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Boop B7 K3 (mezo-r36n9.17, Task 15): every reader honours the day-adjustment ledger — today's session, the week's
 * windows and movement, the fuel day's expected extra, the day plan's meal split, the brief (session time + bedtime)
 * and the season adherence. The ledger rows are written straight to the table (the readers never re-check the
 * ledger's accept rules), so the tests can sit on the real clock the train / fuel reads use. Numbers are invented.
 */
@Transactional
class LedgerReadersIT extends AbstractIntegrationTest {

    @Autowired private DayAdjustmentRepository adjustments;
    @Autowired private WorkoutService workoutService;
    @Autowired private WorkoutWindowQueryService windows;
    @Autowired private FuelDayService fuelDays;
    @Autowired private DayPlanService dayPlans;
    @Autowired private BoopDayAssembler assembler;
    @Autowired private AdherenceService adherence;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private TrainPopulator train;
    @Autowired private WorkoutTimeOverridePopulator timeOverrides;
    @Autowired private BiometricProfilePopulator profiles;
    @Autowired private WeightLogPopulator weights;
    @Autowired private GoalPopulator goals;
    @Autowired private GoalRepository goalRepository;
    @Autowired private TdeeBootstrapService tdeeBootstrap;

    private final LocalDate today = LocalDate.now(); // getToday and the pending preview key on the real clock
    private UUID owner;

    // ── fixtures ──────────────────────────────────────────────────────────────

    private void owner(String tag) {
        owner = databasePopulator.populateUser("ledger-readers-" + tag + "-" + UUID.randomUUID() + "@test.local");
    }

    /** A known body (gym net kcal) and an active goal, so the fuel day and the day plan carry budgets. */
    private void body() {
        BiometricProfileEntity profile = profiles.create(owner);
        weights.createWeightLog(owner, today.minusDays(3), new BigDecimal("80.00"));
        tdeeBootstrap.bmr(profile, new BigDecimal("80.00"));
        LocalDate start = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);
        GoalPrescriptionJson prescription = new GoalPrescriptionJson(null, "formula",
            List.of(new GoalPrescriptionJson.Segment(1, 12, "vágás", 2150, 163, 200, 70,
                null, null, null, -500, null, null, null)),
            null, null);
        GoalEntity goal = goals.createGoalFull(owner, start, start.plusWeeks(12), prescription, 4, "06:30", "22:30");
        goal.setTdeeBootstrap(new TdeeBootstrapJson(BigDecimal.valueOf(1963), new BigDecimal("1.2"),
            BigDecimal.valueOf(2356), new BigDecimal("570"), BigDecimal.valueOf(2926), "MSJ",
            OffsetDateTime.of(2026, 6, 1, 8, 0, 0, 0, ZoneOffset.UTC), 2));
        goalRepository.saveAndFlush(goal);
    }

    private WorkoutSessionEntity templateOn(LocalDate weekday) {
        var meso = train.createActiveMeso(owner);
        WorkoutSessionEntity day = train.createWorkoutSession(owner, meso.getId(), label(weekday), "Pull 1", 0, "active");
        train.createExercise(owner, day.getId(), "Evezés", 0); // 3 working sets
        return day;
    }

    private static String label(LocalDate d) {
        return WorkoutService.HU_DAY_LABELS.get(d.getDayOfWeek().getValue() - 1);
    }

    private static int dow(LocalDate d) {
        return d.getDayOfWeek().getValue() - 1;
    }

    private void ledger(AdjustmentPayload payload, AdjustmentState state) {
        DayAdjustmentEntity row = new DayAdjustmentEntity();
        row.setCreatedBy(owner);
        row.setDate(payload.day());
        row.setKind(payload.kind().name());
        row.setPayload(payload.toMap());
        row.setBundleId(UUID.randomUUID());
        row.setState(state.wire());
        row.setClientRef(UUID.randomUUID());
        adjustments.saveAndFlush(row);
    }

    private void active(AdjustmentPayload payload) {
        ledger(payload, AdjustmentState.ACTIVE);
    }

    private List<Window> gym(LocalDate date) {
        return windows.windowsFor(owner, date).stream().filter(w -> "gym".equals(w.kind())).toList();
    }

    private static int pending(FuelDayResponse day) {
        return Optional.ofNullable(day.getEnergy().getPendingMovementKcal()).orElse(0);
    }

    /** First budgeted window per slot (the window a meal-energy move lands on). */
    private static Map<SlotKey, Integer> firstBudgets(DayPlan plan) {
        Map<SlotKey, Integer> out = new LinkedHashMap<>();
        for (DayPlanWindow w : plan.windows()) {
            if (w.budget() != null) {
                out.putIfAbsent(w.slot(), w.budget().kcal());
            }
        }
        return out;
    }

    private static int total(DayPlan plan) {
        return plan.windows().stream().map(DayPlanWindow::budget).filter(Objects::nonNull).mapToInt(b -> b.kcal()).sum();
    }

    // ── one test per reader ───────────────────────────────────────────────────

    @Test
    void movedSessionAppearsOnNewDayNotOld() {
        owner("train");
        LocalDate yesterday = today.minusDays(1);
        WorkoutSessionEntity session = templateOn(yesterday);
        assertThat(workoutService.getToday(owner, null).getTemplateSessionId()).isNull(); // today is a rest day

        active(new MoveSessionDay(session.getId(), yesterday, today));
        active(new LightenSession(today, 0.5));
        active(new ShortenSession(today, 40));

        WorkoutTodayResponse moved = workoutService.getToday(owner, null);
        assertThat(moved.getTemplateSessionId()).isEqualTo(session.getId());
        assertThat(moved.getDurationEst()).isEqualTo(40);
        assertThat(moved.getExercises()).singleElement()
            .satisfies(e -> assertThat(e.getWorkingSets()).isEqualTo(2)); // round(3 × 0.5)
        assertThat(workoutService.findPlannedTemplateForDate(owner, today)).map(WorkoutSessionEntity::getId)
            .contains(session.getId());
        assertThat(workoutService.findPlannedTemplateForDate(owner, yesterday)).isEmpty();
    }

    @Test
    void movedSessionCountsOnceThisWeek() {
        owner("week");
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate wednesday = monday.plusDays(2);
        WorkoutSessionEntity session = templateOn(monday);
        train.createGymSlot(owner, dow(monday), "17:30");

        active(new MoveSessionDay(session.getId(), monday, wednesday));
        active(new ShiftSessionTime(wednesday, LocalTime.of(18, 15)));
        train.createWorkoutInstance(owner, session, wednesday, "completed");

        Map<LocalDate, List<Window>> week = windows.windowsFor(owner, monday, monday.plusDays(6));
        List<Window> gymWindows = week.entrySet().stream()
            .flatMap(e -> e.getValue().stream().filter(w -> "gym".equals(w.kind())).map(w -> Map.entry(e.getKey(), w)))
            .map(Map.Entry::getValue).toList();
        assertThat(gymWindows).singleElement().satisfies(w -> {
            assertThat(w.start()).isEqualTo(LocalTime.of(18, 15));
            assertThat(w.end()).isEqualTo(LocalTime.of(19, 15));
            assertThat(w.done()).isTrue();
            assertThat(w.label()).isEqualTo("Pull 1");
        });
        assertThat(week.get(wednesday)).anyMatch(w -> "gym".equals(w.kind()));
        assertThat(week.get(monday)).noneMatch(w -> "gym".equals(w.kind()));

        Map<LocalDate, DayMovement> movement = windows.movementBetween(owner, monday, monday.plusDays(6));
        assertThat(movement.get(wednesday).plannedDone()).isTrue(); // the moved session fulfils the plan there
        assertThat(movement.get(wednesday).extraKcal()).isZero();
        assertThat(movement.get(monday).plannedDone()).isFalse();
    }

    @Test
    void fuelExpectedExtraFollowsSession() {
        owner("fuel");
        body();
        LocalDate tomorrow = today.plusDays(1);
        WorkoutSessionEntity session = templateOn(today);
        train.createGymSlot(owner, dow(today), "07:00");
        FuelDayResponse todayBefore = fuelDays.getDay(owner, today);
        FuelDayResponse tomorrowBefore = fuelDays.getDay(owner, tomorrow);
        int gymPending = pending(todayBefore);
        assertThat(gymPending).isPositive();
        assertThat(pending(tomorrowBefore)).isZero();

        active(new MoveSessionDay(session.getId(), today, tomorrow));

        FuelDayResponse todayAfter = fuelDays.getDay(owner, today);
        FuelDayResponse tomorrowAfter = fuelDays.getDay(owner, tomorrow);
        assertThat(pending(todayAfter)).isZero();
        assertThat(pending(tomorrowAfter)).isEqualTo(gymPending);
        // The plan alone never raises the target (mezo-tb3s2): only logging the session does.
        assertThat(todayAfter.getEnergy().getTargetKcal()).isEqualTo(todayBefore.getEnergy().getTargetKcal());
        assertThat(tomorrowAfter.getEnergy().getTargetKcal()).isEqualTo(tomorrowBefore.getEnergy().getTargetKcal());
    }

    @Test
    void mealSplitShowsInDayPlan() {
        owner("meal");
        body();
        LocalTime early = LocalTime.of(5, 0);
        DayPlan before = dayPlans.plan(owner, today, early);
        Map<SlotKey, Integer> budgets = firstBudgets(before);
        assertThat(budgets).hasSizeGreaterThanOrEqualTo(2);
        List<SlotKey> slots = List.copyOf(budgets.keySet());
        SlotKey gains = slots.get(0);
        SlotKey gives = slots.get(1);
        assertThat(budgets.get(gives)).isGreaterThan(120);

        active(new MoveMealEnergy(today, Map.of(gains.wire(), 120, gives.wire(), -120)));

        DayPlan after = dayPlans.plan(owner, today, early);
        Map<SlotKey, Integer> moved = firstBudgets(after);
        assertThat(moved.get(gains)).isEqualTo(budgets.get(gains) + 120);
        assertThat(moved.get(gives)).isEqualTo(budgets.get(gives) - 120);
        assertThat(total(after)).isEqualTo(total(before)); // the day total never changes
    }

    @Test
    void briefBedtimeUsesNightOverride() {
        owner("brief");
        LocalDate day = LocalDate.parse("2026-11-24"); // the brief takes the phone's date, never the clock
        templateOn(day);
        train.createGymSlot(owner, dow(day), "07:00");
        timeOverrides.createOverride(owner, day, LocalTime.of(8, 0)); // the older one-day override
        BoopDay before = assembler.assemble(owner, day);
        assertThat(before.bedtimeTarget()).isNotEqualTo(LocalTime.of(21, 40));
        assertThat(before.session().time()).isEqualTo(LocalTime.of(8, 0));

        active(new ShiftBedtime(day, LocalTime.of(21, 40)));
        active(new ShiftSessionTime(day, LocalTime.of(9, 30)));
        active(new ShiftBedtime(day.plusDays(1), LocalTime.of(21, 0))); // another night — not this brief's

        BoopDay after = assembler.assemble(owner, day);
        assertThat(after.bedtimeTarget()).isEqualTo(LocalTime.of(21, 40));
        assertThat(after.session().time()).isEqualTo(LocalTime.of(9, 30)); // the ledger wins over the override
        assertThat(after.session().plannedTime()).isEqualTo(LocalTime.of(7, 0));
    }

    @Test
    void adherenceCountsMovedSessionOnNewDay() {
        owner("season");
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);
        LocalDate wednesday = monday.plusDays(2);
        WorkoutSessionEntity session = templateOn(monday);
        train.createGymSlot(owner, dow(monday), "17:30");
        active(new MoveSessionDay(session.getId(), monday, wednesday));
        train.createWorkoutInstance(owner, session, wednesday, "completed");

        AdherenceService.Result r = adherence.range(owner, monday, monday.plusDays(6));

        AdherenceDay mon = r.days().stream().filter(d -> d.date().equals(monday)).findFirst().orElseThrow();
        AdherenceDay wed = r.days().stream().filter(d -> d.date().equals(wednesday)).findFirst().orElseThrow();
        assertThat(mon.sessionPlanned()).isFalse();
        assertThat(mon.sessions()).isEmpty();
        assertThat(wed.sessions()).singleElement().satisfies(s -> {
            assertThat(s.kind()).isEqualTo("gym");
            assertThat(s.done()).isTrue();
        });
        assertThat(r.summary().trainingPlanned()).isEqualTo(1);
        assertThat(r.summary().trainingDone()).isEqualTo(1);
    }

    @Test
    void undoneAdjustmentIsIgnoredEverywhere() {
        owner("undone");
        body();
        LocalDate tomorrow = today.plusDays(1);
        LocalDate lastMonday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);
        WorkoutSessionEntity session = templateOn(today);
        train.createGymSlot(owner, dow(today), "07:00");
        LocalTime early = LocalTime.of(5, 0);
        WorkoutTodayResponse todayBefore = workoutService.getToday(owner, null);
        List<Window> gymBefore = gym(today);
        int pendingBefore = pending(fuelDays.getDay(owner, today));
        Map<SlotKey, Integer> budgetsBefore = firstBudgets(dayPlans.plan(owner, today, early));
        BoopDay briefBefore = assembler.assemble(owner, today);
        List<SlotKey> slots = List.copyOf(budgetsBefore.keySet());
        AdherenceService.Result adherenceBefore = adherence.range(owner, lastMonday, lastMonday.plusDays(6));

        ledger(new MoveSessionDay(session.getId(), today, tomorrow), AdjustmentState.UNDONE);
        ledger(new LightenSession(today, 0.3), AdjustmentState.UNDONE);
        ledger(new ShortenSession(today, 20), AdjustmentState.EXPIRED);
        ledger(new ShiftSessionTime(today, LocalTime.of(11, 0)), AdjustmentState.UNDONE);
        ledger(new ShiftBedtime(today, LocalTime.of(21, 5)), AdjustmentState.UNDONE);
        ledger(new MoveMealEnergy(today, Map.of(slots.get(0).wire(), 100, slots.get(1).wire(), -100)),
            AdjustmentState.UNDONE);
        ledger(new MoveSessionDay(session.getId(), lastMonday.plusDays(dow(today)), lastMonday.plusDays(6)),
            AdjustmentState.EXPIRED);

        WorkoutTodayResponse todayAfter = workoutService.getToday(owner, null);
        assertThat(todayAfter.getTemplateSessionId()).isEqualTo(session.getId());
        assertThat(todayAfter.getDurationEst()).isEqualTo(todayBefore.getDurationEst());
        assertThat(todayAfter.getExercises()).singleElement()
            .satisfies(e -> assertThat(e.getWorkingSets()).isEqualTo(3));
        assertThat(workoutService.findPlannedTemplateForDate(owner, tomorrow)).isEmpty();
        assertThat(gym(today)).isEqualTo(gymBefore);
        assertThat(gym(tomorrow)).isEmpty();
        assertThat(pending(fuelDays.getDay(owner, today))).isEqualTo(pendingBefore);
        assertThat(firstBudgets(dayPlans.plan(owner, today, early))).isEqualTo(budgetsBefore);
        BoopDay briefAfter = assembler.assemble(owner, today);
        assertThat(briefAfter.bedtimeTarget()).isEqualTo(briefBefore.bedtimeTarget());
        assertThat(briefAfter.session().time()).isEqualTo(LocalTime.of(7, 0));
        assertThat(adherence.range(owner, lastMonday, lastMonday.plusDays(6)).summary())
            .isEqualTo(adherenceBefore.summary());
    }
}
