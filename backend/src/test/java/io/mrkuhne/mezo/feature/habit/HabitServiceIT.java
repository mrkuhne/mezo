package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.HabitDayResponse;
import io.mrkuhne.mezo.api.dto.HabitStrength;
import io.mrkuhne.mezo.api.dto.HabitSummaryResponse;
import io.mrkuhne.mezo.api.dto.HabitWriteResponse;
import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitDayRepository;
import io.mrkuhne.mezo.feature.habit.service.HabitService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.HabitPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * Day lifecycle (bd mezo-d1jb): lazy per-day materialization (today only), intraday derived
 * completion (awarded once through progression), manual check/uncheck with same-day revert, and
 * the past-day closure honesty pass (END_OF_DAY / bedtime-next-day / quiet-miss — ADR 0010). Data
 * is deterministic (populators + backdated signals); wall-clock-sensitive branches are not asserted.
 */
class HabitServiceIT extends AbstractIntegrationTest {

    @Autowired private HabitService habitService;
    @Autowired private HabitDayRepository repository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private HabitPopulator habitPopulator;

    private UUID owner() {
        return userPopulator.createUser("habit-svc@test.hu").getId();
    }

    private static Instant at(LocalDate date, String hhmm) {
        return LocalDateTime.of(date, LocalTime.parse(hhmm)).atZone(ZoneId.systemDefault()).toInstant();
    }

    @Test
    void testGetDay_shouldLazilyCreateTenPendingRows_whenTodayFirstRead() {
        UUID owner = owner();
        HabitDayResponse day = habitService.getDay(owner, LocalDate.now());
        assertThat(day.getHabits()).hasSize(10);
        assertThat(day.getHabits())
            .allSatisfy(h -> assertThat(h.getStatus().getValue()).isIn("pending", "done"));
        assertThat(repository.findByCreatedByAndHabitDate(owner, LocalDate.now())).hasSize(10);
    }

    @Test
    void testGetDay_shouldCompleteDerivedAndAwardOnce_whenBreakfastProteinMet() {
        UUID owner = owner();
        LocalDate today = LocalDate.now();
        var item = pantryItemPopulator.createFood(owner, "Skyr", null);
        mealPopulator.createPantryMeal(owner, item, today); // breakfast, 34.5 g protein

        HabitDayResponse first = habitService.getDay(owner, today);
        assertThat(first.getHabits()).anySatisfy(h -> {
            assertThat(h.getKey()).isEqualTo("protein_breakfast");
            assertThat(h.getStatus().getValue()).isEqualTo("done");
        });
        assertThat(first.getLevelUps()).isNotEmpty();

        HabitDayResponse second = habitService.getDay(owner, today);
        assertThat(second.getLevelUps()).isEmpty(); // idempotent
    }

    @Test
    void testCheck_shouldAwardAndGuard_whenManualHabit() {
        UUID owner = owner();
        LocalDate today = LocalDate.now();
        HabitWriteResponse res = habitService.check(owner, "morning_sunlight", today);
        assertThat(res.getHabit().getStatus().getValue()).isEqualTo("done");
        assertThat(res.getLevelUps()).isNotEmpty();

        assertThatThrownBy(() -> habitService.check(owner, "morning_sunlight", today))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                ex -> assertHabitCode(ex, "HABIT_ALREADY_DONE"));
        assertThatThrownBy(() -> habitService.check(owner, "morning_weigh_in", today))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                ex -> assertHabitCode(ex, "HABIT_NOT_MANUAL"));
        assertThatThrownBy(() -> habitService.check(owner, "nope", today))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                ex -> assertHabitCode(ex, "HABIT_UNKNOWN"));
        assertThatThrownBy(() -> habitService.check(owner, "wind_down", today.minusDays(1)))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                ex -> assertHabitCode(ex, "HABIT_NOT_TODAY"));
    }

    private static void assertHabitCode(SystemRuntimeErrorException ex, String code) {
        assertThat(ex.getMessages()).singleElement()
            .satisfies(m -> assertThat(m.getCode()).isEqualTo(code));
    }

    @Test
    void testUncheck_shouldRevertXpAndAllowRecheck_whenSameDay() {
        UUID owner = owner();
        LocalDate today = LocalDate.now();
        habitService.check(owner, "morning_sunlight", today);
        var reverted = habitService.uncheck(owner, "morning_sunlight", today);
        assertThat(reverted.getStatus().getValue()).isEqualTo("pending");

        HabitWriteResponse again = habitService.check(owner, "morning_sunlight", today);
        assertThat(again.getLevelUps()).isNotEmpty(); // re-award works after revert
    }

    @Test
    void testClosePast_shouldCloseEndOfDayAndMissRest_whenYesterdayPending() {
        UUID owner = owner();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        habitPopulator.pendingDay(owner, yesterday); // all 10 keys pending

        habitService.closePast(owner, LocalDate.now());

        var rows = repository.findByCreatedByAndHabitDate(owner, yesterday);
        // no stim logged yesterday -> caffeine cutoff honestly done; no meals -> kitchen close done
        assertThat(byKey(rows, "caffeine_cutoff").getStatus()).isEqualTo("done");
        assertThat(byKey(rows, "kitchen_close").getStatus()).isEqualTo("done");
        // no sleep log for today yet -> bed_on_time stays pending until its noon deadline
        assertThat(byKey(rows, "morning_sunlight").getStatus()).isEqualTo("missed");
        assertThat(byKey(rows, "protein_breakfast").getStatus()).isEqualTo("missed");
    }

    @Test
    void testClosePast_shouldCloseBedOnTime_whenNextDaySleepLogArrives() {
        UUID owner = owner();
        LocalDate dayBefore = LocalDate.now().minusDays(2);
        habitPopulator.pendingDay(owner, dayBefore);
        sleepLogPopulator.createSleepLog(owner, dayBefore.plusDays(1), "23:20", "06:10",
            new BigDecimal("6.8"));

        habitService.closePast(owner, LocalDate.now());

        var rows = repository.findByCreatedByAndHabitDate(owner, dayBefore);
        assertThat(byKey(rows, "bed_on_time").getStatus()).isEqualTo("done");
    }

    @Test
    void testClosePast_shouldCompleteIntradayMetric_whenSignalExistsForPastDay() {
        UUID owner = owner();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        habitPopulator.row(owner, yesterday, "morning_weigh_in", HabitDayEntity.STATUS_PENDING);
        // weigh-in before the 09:00 cutoff on the day itself -> honest DERIVED completion at closure
        weightLogPopulator.createWeightLogAt(owner, yesterday, new BigDecimal("81.0"),
            at(yesterday, "07:30"));

        habitService.closePast(owner, LocalDate.now());

        var rows = repository.findByCreatedByAndHabitDate(owner, yesterday);
        HabitDayEntity weighIn = byKey(rows, "morning_weigh_in");
        assertThat(weighIn.getStatus()).isEqualTo("done");
        assertThat(weighIn.getXpAwarded()).isEqualTo(10);
    }

    @Test
    void testSummary_shouldComputeStrengthAndNullUnderMinSample_whenClosedRowsVary() {
        UUID owner = owner();
        LocalDate today = LocalDate.now();
        // morning_sunlight: 5 closed rows (4 done + 1 missed) on distinct past dates -> min sample met
        habitPopulator.row(owner, today.minusDays(1), "morning_sunlight", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, today.minusDays(2), "morning_sunlight", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, today.minusDays(3), "morning_sunlight", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, today.minusDays(4), "morning_sunlight", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, today.minusDays(5), "morning_sunlight", HabitDayEntity.STATUS_MISSED);
        // wind_down: only 4 closed rows (2 done + 2 missed) -> below the min sample of 5
        habitPopulator.row(owner, today.minusDays(6), "wind_down", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, today.minusDays(7), "wind_down", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, today.minusDays(8), "wind_down", HabitDayEntity.STATUS_MISSED);
        habitPopulator.row(owner, today.minusDays(9), "wind_down", HabitDayEntity.STATUS_MISSED);

        HabitSummaryResponse summary = habitService.summary(owner);

        HabitStrength sunlight = strengthOf(summary.getHabits(), "morning_sunlight");
        assertThat(sunlight.getStrengthPct()).isEqualTo(80); // 4/5
        assertThat(sunlight.getDone28()).isEqualTo(4);
        assertThat(sunlight.getMissed28()).isEqualTo(1);

        HabitStrength windDown = strengthOf(summary.getHabits(), "wind_down");
        assertThat(windDown.getStrengthPct()).isNull(); // 4 closed < min sample 5
        assertThat(windDown.getDone28()).isEqualTo(2);
        assertThat(windDown.getMissed28()).isEqualTo(2);
    }

    @Test
    void testSummary_shouldCountPerfectDays_whenFullChainDone() {
        UUID owner = owner();
        LocalDate day = LocalDate.now().minusDays(1);
        // all 6 MORNING keys done on the same past day -> one perfect morning
        habitPopulator.row(owner, day, "wake_on_time", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, day, "morning_sunlight", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, day, "morning_weigh_in", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, day, "morning_coffee", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, day, "morning_workout", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, day, "protein_breakfast", HabitDayEntity.STATUS_DONE);
        // only 3 of 4 EVENING keys done (bed_on_time missed) -> no perfect evening
        habitPopulator.row(owner, day, "caffeine_cutoff", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, day, "kitchen_close", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, day, "wind_down", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, day, "bed_on_time", HabitDayEntity.STATUS_MISSED);

        HabitSummaryResponse summary = habitService.summary(owner);

        assertThat(summary.getPerfectMorningDays30()).isEqualTo(1);
        assertThat(summary.getPerfectEveningDays30()).isEqualTo(0);
    }

    private static HabitStrength strengthOf(List<HabitStrength> habits, String key) {
        return habits.stream().filter(h -> h.getKey().equals(key)).findFirst().orElseThrow();
    }

    private static HabitDayEntity byKey(java.util.List<HabitDayEntity> rows, String key) {
        return rows.stream().filter(r -> r.getHabitKey().equals(key)).findFirst().orElseThrow();
    }
}
