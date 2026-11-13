package io.mrkuhne.mezo.feature.nutrition.dayplan;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FuelPlanResponse;
import io.mrkuhne.mezo.api.dto.FuelPlanWindow;
import io.mrkuhne.mezo.feature.meal.service.dayplan.DayPlanService;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.DayPlan;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.Macros4;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.DayPlanWindow;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.WindowState;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PlannedSkipPopulator;
import io.mrkuhne.mezo.support.populator.RecoveryPeriodPopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * The server-side day plan end to end (Boop B4, mezo-r36n9.14) — a real seeded day through
 * {@link DayPlanService} and through the generated {@code FuelPlanApi} contract.
 *
 * <p>{@code now} is injected everywhere a state depends on it, so nothing here is clock-dependent.
 */
class FuelPlanIT extends ApiIntegrationTest {

    private static final ZoneId OWNER_ZONE = ZoneId.of("Europe/Budapest");
    /** A Tuesday — schedule {@code dayOfWeek} 1, the gym slot's weekday. */
    private static final LocalDate DAY = LocalDate.parse("2026-11-10");
    // mezo.nutrition.* — the config fallback targets a user with no goal is served.
    private static final int TARGET_KCAL = 3100;
    private static final int TARGET_P = 220;
    private static final int TARGET_C = 380;
    private static final int TARGET_F = 95;
    private static final int SKIPPED_KCAL = 300;

    @Autowired private DayPlanService dayPlans;
    @Autowired private MealPopulator meals;
    @Autowired private TrainPopulator train;
    @Autowired private SleepGoalPopulator sleepGoals;
    @Autowired private RecoveryPeriodPopulator recoveries;
    @Autowired private PlannedSkipPopulator skips;

    private static Instant at(int hour, int minute) {
        return DAY.atTime(hour, minute).atZone(OWNER_ZONE).toInstant();
    }

    private void seedDay(UUID user) {
        sleepGoals.goal(user, 480, "WAKE", "06:00", 15);
        breakfast(user);
        train.createActiveMeso(user);
        train.createGymSlot(user, 1, "18:00");
    }

    /** 450 kcal / 30 p / 60 c / 12 f at 07:10 owner-local — amount 1 over a per-1 snapshot, so exact. */
    private void breakfast(UUID user) {
        meals.createMealWithItems(user, DAY, "breakfast", at(7, 10),
            List.of(new MealPopulator.Line("Zabkása", "450", "30", "60", "12", (short) 1)));
    }

    /**
     * Wake 06:00 / bed 23:00 with no session: the default rhythm lands on 06:45 · 10:26 · 14:08 ·
     * 17:49 · 21:30 (breakfast · snack · lunch · snack · dinner) — the clock the state cases pin.
     */
    private void seedPlainRhythm(UUID user) {
        sleepGoals.goal(user, 420, "BED", "23:00", 15);
    }

    private void mealSkip(UUID user, String sessionKey, int plannedKcal) {
        PlannedSkipEntity skip = new PlannedSkipEntity();
        skip.setCreatedBy(user);
        skip.setDate(DAY);
        skip.setKind(PlannedSkipEntity.Kind.MEAL);
        skip.setSessionKey(sessionKey);
        skip.setReasonCategory(PlannedSkipEntity.Reason.NOT_HUNGRY);
        skip.setPlannedKcal(plannedKcal);
        skips.save(skip);
    }

    @Test
    void servesWindowsInClockOrderARemainingBudgetAndATip() {
        UUID user = databasePopulator.populateUser("fuelplan-day@test.local");
        seedDay(user);

        DayPlan plan = dayPlans.plan(user, DAY, LocalTime.of(10, 0));

        assertThat(plan.windows()).isNotEmpty();
        assertThat(plan.windows()).isSortedAccordingTo(Comparator.comparing(DayPlanWindow::from));
        assertThat(plan.windows()).allSatisfy(w -> {
            assertThat(w.to()).isAfter(w.from());
            assertThat(w.budget()).isNotNull();
        });
        // The logged breakfast closed its window; the rest are still open and exactly one is "now".
        assertThat(plan.windows()).filteredOn(w -> w.state() == WindowState.DONE).hasSize(1);
        assertThat(plan.windows()).filteredOn(w -> w.state() == WindowState.NOW).hasSize(1);
        assertThat(plan.windows().stream().filter(w -> w.state() == WindowState.DONE).findFirst()
            .orElseThrow().loggedMealIds()).hasSize(1);

        assertThat(plan.tip()).isNotNull();
        assertThat(plan.tip().text()).isNotBlank();
        // Every open window carries an offer — never an empty row (owner decision 16).
        assertThat(plan.windows()).filteredOn(w -> w.state() != WindowState.DONE)
            .allSatisfy(w -> assertThat(w.suggestion()).isNotNull());
    }

    /**
     * {@code remaining = targets − consumed − skipped}, against LITERAL numbers rather than a
     * re-derivation of the same expression: no goal covers this user, so the targets are the
     * config fallback {@value #TARGET_KCAL}/{@value #TARGET_P}/{@value #TARGET_C}/{@value #TARGET_F}
     * ({@code mezo.nutrition.*}); the seeded breakfast consumes 450/30/60/12 exactly (amount 1 over
     * a per-1 snapshot) and the seeded skip takes {@value #SKIPPED_KCAL} kcal off the day.
     *
     * <p>The skip is a kcal-only term by design (the planned kcal of a skipped slot is all the
     * skip row carries), so p/c/f are targets − consumed.
     */
    @Test
    void remainingIsTargetsMinusConsumedMinusSkipped() {
        UUID user = databasePopulator.populateUser("fuelplan-remaining@test.local");
        seedPlainRhythm(user);
        breakfast(user);
        mealSkip(user, "snack#1", SKIPPED_KCAL);

        DayPlan plan = dayPlans.plan(user, DAY, LocalTime.of(11, 0));

        assertThat(plan.remaining()).isEqualTo(new Macros4(
            TARGET_KCAL - 450 - SKIPPED_KCAL, TARGET_P - 30, TARGET_C - 60, TARGET_F - 12));
        assertThat(plan.remaining()).isEqualTo(new Macros4(2350, 190, 320, 83));
    }

    /**
     * Kihagyás S3: the budget is split over ALL windows, skipped ones included — a skipped meal's
     * share stays with it and nobody else is asked to eat more. The decision lives in
     * {@link DayPlanService} (it owns the skip read); {@code BudgetSplitter} has no skip input at
     * all, which is why this case is here and not in {@code BudgetSplitterTest}.
     */
    @Test
    void skippedWindowKcalLeaveTheBudget() {
        UUID withoutSkip = databasePopulator.populateUser("fuelplan-noskip@test.local");
        seedPlainRhythm(withoutSkip);
        UUID withSkip = databasePopulator.populateUser("fuelplan-skip@test.local");
        seedPlainRhythm(withSkip);
        mealSkip(withSkip, "snack#1", SKIPPED_KCAL);

        DayPlan plain = dayPlans.plan(withoutSkip, DAY, LocalTime.of(11, 0));
        DayPlan skipped = dayPlans.plan(withSkip, DAY, LocalTime.of(11, 0));

        DayPlanWindow skippedWindow = skipped.windows().get(1); // the 10:26 snack
        assertThat(skippedWindow.state()).isEqualTo(WindowState.SKIPPED);
        // It keeps its own share...
        assertThat(skippedWindow.budget()).isEqualTo(plain.windows().get(1).budget());
        // ...and nobody else grew to absorb it.
        assertThat(skipped.windows()).extracting(DayPlanWindow::budget)
            .containsExactlyElementsOf(plain.windows().stream().map(DayPlanWindow::budget).toList());
        // A skipped window is also never offered anything.
        assertThat(skippedWindow.suggestion()).isNull();
    }

    /**
     * {@code buildDayPlan.ts} step 6: the focus never falls BACK onto a window the day has already
     * passed. Breakfast 06:45 unlogged, the 10:26 snack skipped, now 11:00 — the focus lands on the
     * skipped snack and moves FORWARD to lunch 14:08, leaving breakfast missed.
     */
    @Test
    void focusMovesForwardPastASkippedWindowNeverBackToAnEarlierOne() {
        UUID user = databasePopulator.populateUser("fuelplan-skipfocus@test.local");
        seedPlainRhythm(user);
        mealSkip(user, "snack#1", SKIPPED_KCAL);

        DayPlan plan = dayPlans.plan(user, DAY, LocalTime.of(11, 0));

        assertThat(plan.windows()).extracting(w -> w.from() + " " + w.state())
            .containsExactly("06:45 MISSED", "09:56 SKIPPED", "13:23 NOW", "17:19 PENDING", "20:45 PENDING");
        assertThat(plan.tip().text()).startsWith("Következik: Ebéd,");
    }

    /**
     * A bed time AFTER midnight must not silence the day. The bedtime gate compares raw
     * minutes-of-day (the unwrapped axis is deliberately not ported), so bed 01:00 is minute 60 and
     * a naive gate would read every waking hour as "past bedtime": no window current, everything
     * missed, no tip — a total, silent failure. On a crossing anchor there is therefore no gate.
     *
     * <p>This pins the GATE only. Placement on such a day is still the degenerate case of report
     * §5.1 (kitchen close lands before the eating start), which stays out of scope here.
     */
    @Test
    void aBedTimeAfterMidnightStillHasACurrentWindowAndATip() {
        UUID user = databasePopulator.populateUser("fuelplan-crossing@test.local");
        sleepGoals.goal(user, 360, "BED", "01:00", 15); // bed 01:00, wake 07:00

        DayPlan plan = dayPlans.plan(user, DAY, LocalTime.of(12, 0));

        assertThat(plan.windows()).isNotEmpty();
        assertThat(plan.windows()).filteredOn(w -> w.state() == WindowState.NOW).hasSize(1);
        assertThat(plan.windows()).noneMatch(w -> w.state() == WindowState.MISSED);
        assertThat(plan.tip()).isNotNull();
        assertThat(plan.tip().text()).isNotBlank();
    }

    /** Past bedtime the eating day is over: nothing is "now", every unlogged window is missed. */
    @Test
    void afterBedtimeNoWindowIsNow() {
        UUID user = databasePopulator.populateUser("fuelplan-afterbed@test.local");
        seedPlainRhythm(user); // bed 23:00

        DayPlan plan = dayPlans.plan(user, DAY, LocalTime.of(23, 30));

        assertThat(plan.windows()).extracting(DayPlanWindow::state)
            .containsOnly(WindowState.MISSED);
        assertThat(plan.tip()).isNull();
    }

    @Test
    void kimeloModeDayHasNoBudgetsAndNoTip() {
        UUID user = databasePopulator.populateUser("fuelplan-kimelo@test.local");
        seedDay(user);
        recoveries.open(user, PlannedSkipEntity.Reason.ILLNESS, DAY.minusDays(1),
            RecoveryPeriodEntity.Estimate.UNKNOWN);

        DayPlan plan = dayPlans.plan(user, DAY, LocalTime.of(10, 0));

        assertThat(plan.windows()).isNotEmpty();
        assertThat(plan.windows()).allSatisfy(w -> assertThat(w.budget()).isNull());
        assertThat(plan.windows()).allSatisfy(w -> assertThat(w.suggestion()).isNull());
        assertThat(plan.remaining()).isNull();
        assertThat(plan.tip()).isNull();
    }

    @Test
    void getFuelPlanServesThePlanOverHttp() {
        RegisteredUser owner = registerUser("Fuel plan");
        seedDay(owner.id());

        FuelPlanResponse body = getForBody("/api/fuel/plan/" + DAY, owner.headers(),
            HttpStatus.OK, FuelPlanResponse.class);

        assertThat(body.getDate()).isEqualTo(DAY);
        assertThat(body.getWindows()).isNotEmpty();
        assertThat(body.getWindows()).extracting(FuelPlanWindow::getFrom).isSorted();
        assertThat(body.getWindows()).allSatisfy(w -> {
            assertThat(w.getLabel()).isNotBlank();
            assertThat(w.getLoggedMealIds()).isNotNull();
        });
        assertThat(body.getWindows()).filteredOn(w -> w.getState() == FuelPlanWindow.StateEnum.DONE).hasSize(1);
    }
}
