package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.habit.repository.HabitDayRepository;
import io.mrkuhne.mezo.feature.habit.service.HabitService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The day's habit rows are bootstrapped lazily on first touch, so two callers arriving together
 * (the app opening on two surfaces, a read racing the nightly cron, a check racing a read) both
 * see an empty day and both try to insert the same key set (mezo-5jly).
 *
 * <p>The retired guard caught the resulting {@code DataIntegrityViolationException} and re-read in
 * the SAME transaction, which cannot work on Postgres — the violation aborts the transaction
 * (SQLSTATE 25P02) and every later statement fails. Here that took down the WHOLE
 * {@code getDay()} request, not just the bootstrap. {@code TxRaceGuardReproIT} pins the mechanism;
 * this pins the user-visible consequence.
 */
class HabitServiceRaceIT extends AbstractIntegrationTest {

    private static final int ROUNDS = 5;

    @Autowired private UserPopulator userPopulator;
    @Autowired private HabitService habitService;
    @Autowired private HabitDayRepository habitDayRepository;

    @Test
    void testGetDay_shouldBootstrapExactlyOneRowSet_whenTwoReadsRaceOnAFreshDay() throws Exception {
        LocalDate today = LocalDate.now();
        List<Throwable> failures = new ArrayList<>();

        for (int round = 0; round < ROUNDS; round++) {
            UUID owner = userPopulator.createUser("habit-race-" + round + "@test.hu").getId();

            CyclicBarrier gate = new CyclicBarrier(2);
            Callable<Object> readDay = () -> {
                gate.await();
                return habitService.getDay(owner, today);
            };

            ExecutorService pool = Executors.newFixedThreadPool(2);
            try {
                Future<Object> a = pool.submit(readDay);
                Future<Object> b = pool.submit(readDay);
                for (Future<Object> f : List.of(a, b)) {
                    try {
                        assertThat(f.get()).isNotNull();
                    } catch (Exception e) {
                        failures.add(e.getCause() == null ? e : e.getCause());
                    }
                }
            } finally {
                pool.shutdownNow();
            }

            // No duplicates: one row per habit_key for the day, whoever won.
            List<String> keys = habitDayRepository.findByCreatedByAndHabitDate(owner, today)
                .stream().map(r -> r.getHabitKey()).toList();
            assertThat(keys)
                .as("round %d: the racing bootstraps must not double-insert any habit_key", round)
                .doesNotHaveDuplicates();
        }

        assertThat(failures)
            .as("both concurrent getDay() callers must succeed — a losing bootstrap must not fail "
                + "the request (%d/%d calls failed)", failures.size(), ROUNDS * 2)
            .isEmpty();
    }
}
