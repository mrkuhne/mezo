package io.mrkuhne.mezo.feature.nutrition.dayplan;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.FuelPlanResponse;
import io.mrkuhne.mezo.api.dto.FuelPlanWindow;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.meal.service.dayplan.DayPlanService;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.DayPlan;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.DayPlanWindow;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.WindowState;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.MealPopulator;
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

    @Autowired private DayPlanService dayPlans;
    @Autowired private FuelDayService fuelDays;
    @Autowired private MealPopulator meals;
    @Autowired private TrainPopulator train;
    @Autowired private SleepGoalPopulator sleepGoals;
    @Autowired private RecoveryPeriodPopulator recoveries;

    private static Instant at(int hour, int minute) {
        return DAY.atTime(hour, minute).atZone(OWNER_ZONE).toInstant();
    }

    private void seedDay(UUID user) {
        sleepGoals.goal(user, 480, "WAKE", "06:00", 15);
        meals.createMealWithItems(user, DAY, "breakfast", at(7, 10),
            List.of(new MealPopulator.Line("Zabkása", "450", "30", "60", "12", (short) 1)));
        train.createActiveMeso(user);
        train.createGymSlot(user, 1, "18:00");
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

        FuelDayResponse day = fuelDays.getDay(user, DAY);
        int expectedKcal = day.getTargets().getKcal().intValue()
            - day.getConsumed().getKcal().intValue()
            - (day.getSkippedKcal() == null ? 0 : day.getSkippedKcal());
        assertThat(plan.remaining()).isNotNull();
        assertThat(plan.remaining().kcal()).isEqualTo(expectedKcal);

        assertThat(plan.tip()).isNotNull();
        assertThat(plan.tip().text()).isNotBlank();
        // Every open window carries an offer — never an empty row (owner decision 16).
        assertThat(plan.windows()).filteredOn(w -> w.state() != WindowState.DONE)
            .allSatisfy(w -> assertThat(w.suggestion()).isNotNull());
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
