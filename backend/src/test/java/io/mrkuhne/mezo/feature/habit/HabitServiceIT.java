package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.HabitDayResponse;
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
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

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
    @Autowired private HabitPopulator habitPopulator;

    private UUID owner() {
        return userPopulator.createUser("habit-svc@test.hu").getId();
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
            .isInstanceOf(SystemRuntimeErrorException.class); // HABIT_ALREADY_DONE
        assertThatThrownBy(() -> habitService.check(owner, "morning_weigh_in", today))
            .isInstanceOf(SystemRuntimeErrorException.class); // HABIT_NOT_MANUAL
        assertThatThrownBy(() -> habitService.check(owner, "nope", today))
            .isInstanceOf(SystemRuntimeErrorException.class); // HABIT_UNKNOWN
        assertThatThrownBy(() -> habitService.check(owner, "wind_down", today.minusDays(1)))
            .isInstanceOf(SystemRuntimeErrorException.class); // HABIT_NOT_TODAY
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

    private static HabitDayEntity byKey(java.util.List<HabitDayEntity> rows, String key) {
        return rows.stream().filter(r -> r.getHabitKey().equals(key)).findFirst().orElseThrow();
    }
}
