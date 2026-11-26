package io.mrkuhne.mezo.feature.capacity;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.WorkoutAsPlannedRequest;
import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.api.dto.GymScheduleSlotInput;
import io.mrkuhne.mezo.feature.train.MesocycleStarted;
import io.mrkuhne.mezo.feature.train.service.GymScheduleService;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import org.springframework.context.ApplicationEventPublisher;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.WorkoutStartRequest;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.boop.service.BoopDay;
import io.mrkuhne.mezo.feature.boop.service.BoopDayAssembler;
import io.mrkuhne.mezo.feature.capacity.entity.AdjustmentState;
import io.mrkuhne.mezo.feature.capacity.entity.DayAdjustmentEntity;
import io.mrkuhne.mezo.feature.capacity.repository.DayAdjustmentRepository;
import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagOutcome;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.MissedWorkoutsRule;
import io.mrkuhne.mezo.feature.companion.service.BoopDayContext;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import io.mrkuhne.mezo.feature.companion.tools.ToolContexts;
import io.mrkuhne.mezo.feature.companion.tools.TrainTools;
import org.springframework.ai.chat.model.ToolContext;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.PlannedSkipService;
import io.mrkuhne.mezo.support.populator.RecoveryPeriodPopulator;
import java.time.Instant;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
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
    @Autowired private BoopDayContext chatContext;
    @Autowired private TrainTools trainTools;
    @Autowired private MissedWorkoutsRule missedWorkouts;
    @Autowired private FlagProperties flagProperties;
    @Autowired private PlannedSkipService plannedSkips;
    @Autowired private RecoveryPeriodPopulator recoveries;
    @Autowired private WorkoutSessionRepository workoutSessions;
    @Autowired private MesocycleRepository mesocycles;
    @Autowired private ApplicationEventPublisher events;
    @Autowired private GymScheduleService gymSchedule;

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

    // ── fix round 1 ───────────────────────────────────────────────────────────

    @Test
    void chatContextSessionFollowsMoveShiftAndShorten() {
        owner("chat");
        LocalDate monday = LocalDate.parse("2026-11-30");
        LocalDate wednesday = monday.plusDays(2);
        WorkoutSessionEntity session = templateOn(monday);
        train.createGymSlot(owner, dow(monday), "07:00");
        active(new MoveSessionDay(session.getId(), monday, wednesday));
        active(new ShiftSessionTime(wednesday, LocalTime.of(9, 30)));
        active(new ShortenSession(wednesday, 40));
        Instant before = monday.minusDays(1).atStartOfDay(ZoneId.of("Europe/Budapest")).toInstant();

        assertThat(chatContext.assemble(owner, monday, before).today()).noneMatch(x -> "Edzés".equals(x.label()));
        assertThat(chatContext.assemble(owner, wednesday, before).today())
            .filteredOn(x -> "Edzés".equals(x.label())).singleElement().satisfies(x -> {
                assertThat(x.time()).isEqualTo(LocalTime.of(9, 30));
                assertThat(x.minutes()).isEqualTo(40);
                assertThat(x.detail()).isEqualTo("Sze"); // the day it is done on, not the plan's Monday
            });
    }

    @Test
    void missedWorkoutsFlagFollowsMove() {
        owner("missed");
        Instant longAgo = Instant.now().minus(365, ChronoUnit.DAYS);
        for (int d : new int[] {0, 2, 4}) {
            train.createGymSlotAt(owner, d, "07:00", longAgo);
        }
        WorkoutSessionEntity session = templateOn(today);
        LocalDate todayLocal = LocalDate.now(ZoneId.of("Europe/Budapest"));
        int windowDays = flagProperties.missedWorkouts().windowDays();
        List<LocalDate> planned = new ArrayList<>();
        for (int i = windowDays; i >= 1; i--) {
            LocalDate day = todayLocal.minusDays(i);
            if (dow(day) == 0 || dow(day) == 2 || dow(day) == 4) {
                planned.add(day);
            }
        }
        for (int i = 0; i < planned.size() - 2; i++) {
            train.createWorkoutInstance(owner, session, planned.get(i), "completed");
        }
        assertThat(missedWorkouts.evaluate(owner, todayLocal).outcome()).isEqualTo(FlagOutcome.RAISED);

        // The first of the two misses was moved to the next day and done there: it is no missed day.
        LocalDate moved = planned.get(planned.size() - 2);
        active(new MoveSessionDay(session.getId(), moved, moved.plusDays(1)));
        train.createWorkoutInstance(owner, session, moved.plusDays(1), "completed");

        assertThat(missedWorkouts.evaluate(owner, todayLocal).outcome()).isEqualTo(FlagOutcome.CLEAR);
    }

    @Test
    void movedInDayGetsTheKimeloSkip() {
        owner("kimelo");
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);
        LocalDate tuesday = monday.plusDays(1);
        WorkoutSessionEntity session = templateOn(monday);
        train.createGymSlot(owner, dow(monday), "17:30");
        recoveries.ended(owner, PlannedSkipEntity.Reason.ILLNESS, monday, monday.plusDays(3));
        active(new MoveSessionDay(session.getId(), monday, tuesday));

        List<LocalDate> recoveryGym = plannedSkips.verdictsBetween(owner, monday, monday.plusDays(6)).stream()
            .filter(v -> v.row().kind() == PlannedSkipEntity.Kind.GYM)
            .map(v -> v.row().date()).toList();
        assertThat(recoveryGym).containsExactly(tuesday);
    }

    @Test
    void movedSessionLoggedTodayCarriesTodaysLabel() {
        owner("label");
        LocalDate yesterday = today.minusDays(1);
        WorkoutSessionEntity session = templateOn(yesterday);
        active(new MoveSessionDay(session.getId(), yesterday, today));

        var started = workoutService.startWorkout(owner,
            WorkoutStartRequest.builder().templateSessionId(session.getId()).build());

        assertThat(workoutSessions.findById(started.getId()).orElseThrow().getDayLabel()).isEqualTo(label(today));
        assertThat(workoutSessions.findById(session.getId()).orElseThrow().getDayLabel()).isEqualTo(label(yesterday));
    }

    @Test
    void todaysLightenIsNotAppliedToAnotherDaysTemplate() {
        owner("explicit");
        WorkoutSessionEntity todays = templateOn(today);
        var meso = workoutSessions.findById(todays.getId()).orElseThrow().getMesocycleId();
        WorkoutSessionEntity other = train.createWorkoutSession(owner, meso, label(today.plusDays(1)), "Push 1", 1,
            "active");
        train.createExercise(owner, other.getId(), "Fekvenyomás", 0);
        active(new LightenSession(today, 0.5));
        active(new ShortenSession(today, 35));

        assertThat(workoutService.getToday(owner, null).getExercises()).singleElement()
            .satisfies(e -> assertThat(e.getWorkingSets()).isEqualTo(2));
        WorkoutTodayResponse explicit = workoutService.getToday(owner, other.getId());
        assertThat(explicit.getExercises()).singleElement()
            .satisfies(e -> assertThat(e.getWorkingSets()).isEqualTo(3));
        assertThat(explicit.getDurationEst()).isEqualTo(other.getDurationEst()); // the template's own, not 35
    }

    @Test
    void dayPlanEndsAtTheNightsShiftedBedtime() {
        owner("bedgate");
        body();
        LocalTime early = LocalTime.of(5, 0);
        DayPlan before = dayPlans.plan(owner, today, early);
        LocalTime lastBefore = before.windows().getLast().from();

        active(new ShiftBedtime(today, lastBefore.minusMinutes(90)));

        DayPlan after = dayPlans.plan(owner, today, early);
        assertThat(after.windows().getLast().from()).isBefore(lastBefore);
        assertThat(total(after)).isEqualTo(total(before));
    }

    @Test
    void trainingPlanToolFollowsMoveAndLighten() {
        owner("tool");
        LocalDate monday = today.with(TemporalAdjusters.next(DayOfWeek.MONDAY));
        LocalDate wednesday = monday.plusDays(2);
        WorkoutSessionEntity session = templateOn(monday);
        active(new MoveSessionDay(session.getId(), monday, wednesday));
        active(new LightenSession(wednesday, 0.5));
        ToolContext ctx = new ToolContext(Map.of(ToolContexts.USER_ID, owner, ToolContexts.AUDIT, new ToolCallAudit(6, 10)));

        String wed = trainTools.getTrainingPlan("date", wednesday.toString(), ctx);
        String mon = trainTools.getTrainingPlan("date", monday.toString(), ctx);

        assertThat(wed).contains("gym (Sze): Evezés 2"); // the day it is done on, round(3 × 0.5) sets
        assertThat(mon).contains("pihenőnap (gym)");
    }

    // ── main's newer readers (K3 final review, after the rebase) ──────────────

    /** Two days of one Mon–Sun week inside the catch-up window (today−7 … today): {plan day, moved-to day}. */
    private LocalDate[] catchUpPair() {
        return today.getDayOfWeek() == DayOfWeek.MONDAY
            ? new LocalDate[] {today.minusDays(6), today.minusDays(1)}
            : new LocalDate[] {today.minusDays(1), today};
    }

    private WorkoutAsPlannedRequest booking(WorkoutSessionEntity template, LocalDate date) {
        return WorkoutAsPlannedRequest.builder().templateSessionId(template.getId()).date(date)
            // never in the future: today's booking starts at 00:01 (the catch-up refuses a start after now)
            .startedAt(date.atTime(date.equals(today) ? LocalTime.of(0, 1) : LocalTime.of(18, 0))
                .atZone(ZoneId.systemDefault()).toOffsetDateTime())
            .clientRef(UUID.randomUUID()).overrides(List.of()).build();
    }

    @Test
    void movedSessionIsBookedOnlyOnItsEffectiveDay() {
        owner("asplanned");
        LocalDate[] pair = catchUpPair();
        LocalDate planDay = pair[0];
        LocalDate movedTo = pair[1];
        WorkoutSessionEntity session = templateOn(planDay);
        active(new MoveSessionDay(session.getId(), planDay, movedTo));

        // On the day it was moved away from: refused with train's own words, never a second session for the week.
        assertThatThrownBy(() -> workoutService.completeAsPlanned(owner, booking(session, planDay)))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessage("TRAIN_AS_PLANNED_MOVED");

        // On its effective day: booked, dated and labelled as that day.
        WorkoutInstanceResponse booked = workoutService.completeAsPlanned(owner, booking(session, movedTo));
        assertThat(booked.getDate()).isEqualTo(movedTo);
        assertThat(workoutSessions.findById(booked.getId()).orElseThrow().getDayLabel()).isEqualTo(label(movedTo));
    }

    @Test
    void newActiveBlockExpiresTheOldBlocksSessionChanges() {
        owner("meso-change");
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate movedTo = today.getDayOfWeek() == DayOfWeek.SUNDAY ? monday : monday.plusDays(6);
        WorkoutSessionEntity old = templateOn(today);
        active(new MoveSessionDay(old.getId(), today, movedTo));
        active(new ShortenSession(today, 40));
        active(new ShiftSessionTime(today, LocalTime.of(18, 15)));
        active(new ShiftBedtime(today, LocalTime.of(22, 0))); // not about the session: stays

        // A planned block starts mid-week (PlannedBlockStarter → TrainService.activateMesocycle): the old block is
        // archived, the new one is active with its own session today, and MesocycleStarted is published.
        mesocycles.findById(old.getMesocycleId()).ifPresent(m -> {
            m.setStatus("archived");
            mesocycles.saveAndFlush(m);
        });
        var next = train.createMesocycle(owner, "Next block", "active");
        WorkoutSessionEntity fresh = train.createWorkoutSession(owner, next.getId(), label(today), "Push 1", 0, "active");
        train.createExercise(owner, fresh.getId(), "Fekvenyomás", 0);
        events.publishEvent(new MesocycleStarted(owner, next.getId(), today));

        assertThat(adjustments.findAll().stream().filter(r -> owner.equals(r.getCreatedBy())))
            .extracting(DayAdjustmentEntity::getKind, DayAdjustmentEntity::getState)
            .containsExactlyInAnyOrder(
                org.assertj.core.groups.Tuple.tuple("MOVE_SESSION_DAY", "expired"),
                org.assertj.core.groups.Tuple.tuple("SHORTEN_SESSION", "expired"),
                org.assertj.core.groups.Tuple.tuple("SHIFT_SESSION_TIME", "expired"),
                org.assertj.core.groups.Tuple.tuple("SHIFT_BEDTIME", "active"));
        // The plan wins: today is the new block's session at its own length, not the old block's shortened one.
        WorkoutTodayResponse todays = workoutService.getToday(owner, null);
        assertThat(todays.getTemplateSessionId()).isEqualTo(fresh.getId());
        assertThat(todays.getDurationEst()).isNull(); // the template's own estimate (none), not the old 40 minutes
    }

    @Test
    void newActiveBlockKeepsATrainedMoveAsHistory() {
        owner("meso-history");
        LocalDate[] pair = catchUpPair();
        WorkoutSessionEntity old = templateOn(pair[0]);
        active(new MoveSessionDay(old.getId(), pair[0], pair[1]));
        active(new ShortenSession(today, 40));
        workoutService.completeAsPlanned(owner, booking(old, pair[1])); // trained on its new day

        mesocycles.findById(old.getMesocycleId()).ifPresent(m -> {
            m.setStatus("archived");
            mesocycles.saveAndFlush(m);
        });
        var next = train.createMesocycle(owner, "Next block", "active");
        WorkoutSessionEntity fresh = train.createWorkoutSession(owner, next.getId(), label(today), "Push 1", 0, "active");
        train.createExercise(owner, fresh.getId(), "Fekvenyomás", 0);
        events.publishEvent(new MesocycleStarted(owner, next.getId(), today));

        // The trained move stays history (its old day never turns into a missed workout); today's shortening settles
        // done when today's session is already trained, else it expires with the old block.
        String shortened = pair[1].equals(today) ? "done" : "expired";
        assertThat(adjustments.findAll().stream().filter(r -> owner.equals(r.getCreatedBy())))
            .extracting(DayAdjustmentEntity::getKind, DayAdjustmentEntity::getState)
            .containsExactlyInAnyOrder(
                org.assertj.core.groups.Tuple.tuple("MOVE_SESSION_DAY", "done"),
                org.assertj.core.groups.Tuple.tuple("SHORTEN_SESSION", shortened));
    }

    @Test
    void aRewrittenGymWeekExpiresOnlyTheMovesThatNoLongerFit() {
        org.junit.jupiter.api.Assumptions.assumeTrue(today.getDayOfWeek() != DayOfWeek.SUNDAY,
            "needs a later day in this week");
        owner("gym-week");
        LocalDate later = today.plusDays(1);
        WorkoutSessionEntity session = templateOn(today);
        active(new MoveSessionDay(session.getId(), today, later));

        // A schedule that keeps the target day free: the move still fits.
        gymSchedule.replaceSchedule(owner, List.of(GymScheduleSlotInput.builder().dayOfWeek(dow(today))
            .time("18:00").build()));
        assertThat(adjustments.findAll().stream().filter(r -> owner.equals(r.getCreatedBy())))
            .extracting(DayAdjustmentEntity::getState).containsExactly("active");

        // The target day gains a session (the season's Módosítás, a new schedule): the plan wins, the move expires.
        gymSchedule.replaceSchedule(owner, List.of(GymScheduleSlotInput.builder().dayOfWeek(dow(later))
            .time("18:00").build()));
        assertThat(adjustments.findAll().stream().filter(r -> owner.equals(r.getCreatedBy())))
            .extracting(DayAdjustmentEntity::getState).containsExactly("expired");
    }
}
