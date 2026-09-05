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
import io.mrkuhne.mezo.feature.progression.repository.LevelUpEventRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.HabitPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
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
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private HabitPopulator habitPopulator;
    @Autowired private LevelUpEventRepository levelUpEventRepository;

    private UUID owner() {
        return userPopulator.createUser("habit-svc@test.hu").getId();
    }

    private static Instant at(LocalDate date, String hhmm) {
        return LocalDateTime.of(date, LocalTime.parse(hhmm)).atZone(ZoneId.systemDefault()).toInstant();
    }

    @Test
    void testGetDay_shouldLazilyCreateFifteenPendingRows_whenTodayFirstRead() {
        UUID owner = owner();
        HabitDayResponse day = habitService.getDay(owner, LocalDate.now());
        assertThat(day.getHabits()).hasSize(15);
        assertThat(day.getHabits())
            .allSatisfy(h -> assertThat(h.getStatus().getValue()).isIn("pending", "done"));
        assertThat(repository.findByCreatedByAndHabitDate(owner, LocalDate.now())).hasSize(15);
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

    /**
     * The live repro this fixes (mezo-czol): an honest out-of-window wakeup left {@code
     * wake_on_time} pending with zero feedback — the row's CTA kept dumbly re-offering
     * "Logolás". The server is the only party that knows the wakeup + the goal anchor + the
     * configured window (mezo.habit.wake-window-min, 45 by default — see application.yml), so
     * the hint is computed here, never on the FE.
     */
    @Test
    void testGetDay_shouldHintOutOfWindow_whenWakeupOutsideGoalWindow() {
        UUID owner = owner();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "05:30", 15);
        sleepLogPopulator.createSleepLog(owner, today, "23:00", "06:30", new BigDecimal("7.5"));

        HabitDayResponse day = habitService.getDay(owner, today);

        assertThat(day.getHabits()).filteredOn(h -> "wake_on_time".equals(h.getKey()))
            .first().satisfies(h -> {
                assertThat(h.getStatus().getValue()).isEqualTo("pending"); // honestly outside the window
                assertThat(h.getHint()).isEqualTo("06:30 — a célablakon kívül (05:30 ± 45′)");
            });
    }

    @Test
    void testGetDay_shouldCompleteAndNullHint_whenWakeupInsideGoalWindow() {
        UUID owner = owner();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "05:30", 15);
        sleepLogPopulator.createSleepLog(owner, today, "22:30", "05:40", new BigDecimal("7.0"));

        HabitDayResponse day = habitService.getDay(owner, today);

        assertThat(day.getHabits()).filteredOn(h -> "wake_on_time".equals(h.getKey()))
            .first().satisfies(h -> {
                assertThat(h.getStatus().getValue()).isEqualTo("done");
                assertThat(h.getHint()).isNull();
            });
    }

    @Test
    void testGetDay_shouldStayPendingWithNullHint_whenNoSleepLogYet() {
        UUID owner = owner();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "05:30", 15);

        HabitDayResponse day = habitService.getDay(owner, today);

        assertThat(day.getHabits()).filteredOn(h -> "wake_on_time".equals(h.getKey()))
            .first().satisfies(h -> {
                assertThat(h.getStatus().getValue()).isEqualTo("pending"); // CTA must keep offering Logolás
                assertThat(h.getHint()).isNull();
            });
    }

    /**
     * Review fix regression (mezo-czol): a PAST day's rows never materialize/evaluate (that only
     * happens for {@code LocalDate.now()}), so a past {@code wake_on_time} row reads as a
     * synthetic {@code pending} default regardless of what its sleep log actually says. Before the
     * today-gate, {@code wakeHint} inferred "out of window" from bare pending + a wakeup existing
     * — which falsely flagged this in-window backfilled wakeup as out-of-window. The hint is a
     * TODAY-read affordance only; past-day reads (e.g. the Rutin tab's read-only history view)
     * must always get a null hint.
     */
    @Test
    void testGetDay_shouldStayHintFree_whenPastDayHasInWindowBackfilledWakeup() {
        UUID owner = owner();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        sleepGoalPopulator.goal(owner, 480, "WAKE", "05:30", 15);
        sleepLogPopulator.createSleepLog(owner, yesterday, "22:30", "05:45", new BigDecimal("7.0"));

        HabitDayResponse day = habitService.getDay(owner, yesterday);

        assertThat(day.getHabits()).filteredOn(h -> "wake_on_time".equals(h.getKey()))
            .first().satisfies(h -> {
                assertThat(h.getStatus().getValue()).isEqualTo("pending"); // synthetic default — rows never materialized for a past day
                assertThat(h.getHint()).isNull(); // must NOT falsely claim the in-window wakeup was out of window
            });
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
        assertThatThrownBy(() -> habitService.check(owner, "wind_down", today.minusDays(2)))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                ex -> assertHabitCode(ex, "HABIT_TOO_OLD"));
        assertThatThrownBy(() -> habitService.check(owner, "wind_down", today.plusDays(1)))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                ex -> assertHabitCode(ex, "HABIT_TOO_OLD"));
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

    /**
     * Backfill (mezo-x9c2): yesterday's cron-closed MISSED row flips to done on a backdated
     * MANUAL check, and the XP's business date is YESTERDAY (occurredOn rides habit_date —
     * mezo-huzd plumbing), so the gamification day aggregate heals retroactively.
     */
    @Test
    void testCheck_shouldFlipMissedToDoneAndBackdateXp_whenYesterday() {
        UUID owner = owner();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        habitPopulator.row(owner, yesterday, "morning_sunlight", HabitDayEntity.STATUS_MISSED);

        HabitWriteResponse res = habitService.check(owner, "morning_sunlight", yesterday);

        assertThat(res.getHabit().getStatus().getValue()).isEqualTo("done");
        assertThat(res.getLevelUps()).isNotEmpty();
        assertThat(levelUpEventRepository.findByCreatedByAndOccurredOn(owner, yesterday))
            .hasSize(1); // XP attributed to YESTERDAY, not today
        // done rows guard unchanged for the past day too
        assertThatThrownBy(() -> habitService.check(owner, "morning_sunlight", yesterday))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                ex -> assertHabitCode(ex, "HABIT_ALREADY_DONE"));
    }

    /**
     * Backfill (mezo-x9c2): a yesterday whose rows never materialized (the user never opened
     * the app that day) must not 500 — check() materializes the checked key's row for the
     * REQUEST date. Final review finding 1: for a PAST date this must be narrow — ONLY the
     * checked habit's row, not the whole catalog (a full-catalog reconcile here would plant
     * pending rows for every other habit too, which the next today-open's closeStaleRows would
     * then silently DERIVED-complete for vacuously-satisfied metrics and award unearned XP).
     */
    @Test
    void testCheck_shouldMaterializeAbsentRows_whenYesterdayNeverTouched() {
        UUID owner = owner();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        // no populator call — yesterday has zero rows

        HabitWriteResponse res = habitService.check(owner, "morning_sunlight", yesterday);

        assertThat(res.getHabit().getStatus().getValue()).isEqualTo("done");
        assertThat(repository.findByCreatedByAndHabitDate(owner, yesterday)).hasSize(1);
    }

    /**
     * Backfill (mezo-x9c2, final review finding 1 — critical): backfilling one MANUAL habit on a
     * never-opened yesterday must not fabricate DERIVED awards for unrelated habits. Before the
     * fix, check()'s full-catalog ensureRows planted pending rows for every def on that date, and
     * the next today-open's closeStaleRows silently completed the vacuously-satisfied DERIVED
     * ones (no data at all reads as "satisfied" for some metrics) and awarded them XP for a day
     * the user never touched. Only the one manual award should exist for yesterday afterward.
     */
    @Test
    void testCheck_shouldNotAwardUnrelatedDerivedHabits_whenYesterdayNeverTouched() {
        UUID owner = owner();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        // no populator call — yesterday has zero rows and zero signals of any kind

        habitService.check(owner, "morning_sunlight", yesterday);
        habitService.closePast(owner, LocalDate.now()); // simulates the next day's cron/open

        assertThat(levelUpEventRepository.findByCreatedByAndOccurredOn(owner, yesterday))
            .hasSize(1); // only the one manual award — no unrelated DERIVED habits got completed
    }

    /**
     * Backfill (mezo-x9c2): yesterday-uncheck reverts the XP and resets to pending; the next
     * closePast honestly re-closes it missed — intended semantics, pinned here.
     */
    @Test
    void testUncheck_shouldRevertAndRecloseMissed_whenYesterday() {
        UUID owner = owner();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        habitPopulator.row(owner, yesterday, "morning_sunlight", HabitDayEntity.STATUS_MISSED);
        habitService.check(owner, "morning_sunlight", yesterday);

        var reverted = habitService.uncheck(owner, "morning_sunlight", yesterday);
        assertThat(reverted.getStatus().getValue()).isEqualTo("pending");
        assertThat(levelUpEventRepository.findByCreatedByAndOccurredOn(owner, yesterday)).isEmpty();

        habitService.closePast(owner, LocalDate.now());
        assertThat(byKey(repository.findByCreatedByAndHabitDate(owner, yesterday),
            "morning_sunlight").getStatus()).isEqualTo("missed");
    }

    /**
     * Midnight race, ordering A (mezo-x9c2): the user checks late, the close job runs after.
     * closePast only closes PENDING rows, so it must skip the done row — no double-close,
     * no second award for THIS habit. Since final review finding 1, check() on a past date only
     * materializes the checked key's own row (not the whole catalog), so closePast afterward has
     * no other pending rows to touch for yesterday here. The race assertion still scopes to
     * morning_sunlight's own row via sourceRefId rather than the day's total award count, to stay
     * robust to that scope.
     */
    @Test
    void testClosePastAfterCheck_shouldKeepDoneAndSingleAward_whenCheckWonTheRace() {
        UUID owner = owner();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        habitPopulator.row(owner, yesterday, "morning_sunlight", HabitDayEntity.STATUS_PENDING);
        habitService.check(owner, "morning_sunlight", yesterday); // pending -> done (backfill window)

        habitService.closePast(owner, LocalDate.now()); // the "cron" arrives second

        HabitDayEntity sunlight = byKey(repository.findByCreatedByAndHabitDate(owner, yesterday),
            "morning_sunlight");
        assertThat(sunlight.getStatus()).isEqualTo("done");
        assertThat(levelUpEventRepository.findByCreatedByAndOccurredOn(owner, yesterday))
            .filteredOn(e -> sunlight.getId().equals(e.getSourceRefId()))
            .hasSize(1); // exactly one award for morning_sunlight — no double-close, no second award
    }

    /**
     * Midnight race, ordering B (mezo-x9c2): the close job wins and closes the row missed;
     * the user's late check then flips missed -> done. Both orderings converge on done + 1 award.
     */
    @Test
    void testCheckAfterClosePast_shouldFlipMissedToDone_whenCronWonTheRace() {
        UUID owner = owner();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        habitPopulator.row(owner, yesterday, "morning_sunlight", HabitDayEntity.STATUS_PENDING);
        habitService.closePast(owner, LocalDate.now()); // cron closes it missed first

        HabitWriteResponse res = habitService.check(owner, "morning_sunlight", yesterday);

        assertThat(res.getHabit().getStatus().getValue()).isEqualTo("done");
        assertThat(levelUpEventRepository.findByCreatedByAndOccurredOn(owner, yesterday))
            .hasSize(1);
    }

    @Test
    void testClosePast_shouldCloseEndOfDayAndMissRest_whenYesterdayPending() {
        UUID owner = owner();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        habitPopulator.pendingDay(owner, yesterday); // all 12 keys pending

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
        // Anchor bed target explicitly at 23:00 (was the old config ghost; ghost is now 22:00 — spec §3).
        sleepGoalPopulator.goal(owner, 450, "BED", "23:00", 15);
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
        // summary is read-only/non-bootstrapping (mezo-n5e9.1 review finding 3) — a real getDay
        // touch is what materializes the catalog perfectDays/activeForChainKey need to resolve
        // habit keys against; the honest real-world order (getDay before summary).
        habitService.getDay(owner, today);
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
        // summary is read-only/non-bootstrapping (mezo-n5e9.1 review finding 3) — bootstrap via a
        // real getDay touch first, same reasoning as the strength test above.
        habitService.getDay(owner, LocalDate.now());
        // all 9 MORNING keys done on the same past day -> one perfect morning
        habitPopulator.row(owner, day, "wake_on_time", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, day, "morning_sunlight", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, day, "morning_pushups", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, day, "morning_video", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, day, "morning_weigh_in", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, day, "morning_coffee", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, day, "morning_workout", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, day, "protein_breakfast", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, day, "daily_intention", HabitDayEntity.STATUS_DONE);
        // only 5 of 6 EVENING keys done (bed_on_time missed) -> no perfect evening
        habitPopulator.row(owner, day, "caffeine_cutoff", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, day, "kitchen_close", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, day, "intention_reflect", HabitDayEntity.STATUS_DONE);
        habitPopulator.row(owner, day, "evening_ritual", HabitDayEntity.STATUS_DONE);
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
