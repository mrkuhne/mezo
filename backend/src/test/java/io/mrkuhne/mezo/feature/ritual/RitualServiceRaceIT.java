package io.mrkuhne.mezo.feature.ritual;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.ritual.repository.RitualDayRepository;
import io.mrkuhne.mezo.feature.ritual.service.RitualService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
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
 * The concurrency-shaped test the race guard never had (mezo-5jly).
 *
 * <p>{@code close()} is idempotent BY DESIGN: closing an already-closed day must return the
 * existing close, not fail. Two callers arriving together (the phone retrying a request, the
 * app open on two surfaces) both pass {@code findBy…} → empty and both try to insert. One wins;
 * the other must still get a 200 carrying the winner's row.
 *
 * <p>The shipped guard tried to achieve that by catching {@code DataIntegrityViolationException}
 * and re-reading in the SAME transaction — which cannot work on Postgres, because the violation
 * aborts the transaction (SQLSTATE 25P02) and every later statement on that connection fails.
 * {@code TxRaceGuardReproIT} pins that mechanism in isolation; this test pins the user-visible
 * consequence at the service boundary.
 *
 * <p>A barrier makes both threads leave the gate together, and the whole thing repeats a few
 * times so a single lucky interleaving cannot report success.
 */
class RitualServiceRaceIT extends AbstractIntegrationTest {

    private static final int ROUNDS = 5;

    @Autowired private UserPopulator userPopulator;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private RitualService ritualService;
    @Autowired private RitualDayRepository ritualDayRepository;

    @Test
    void testClose_shouldReturnTheWinnersRowToBothCallers_whenTwoCloseConcurrently() throws Exception {
        LocalDate today = LocalDate.now();
        List<Throwable> failures = new ArrayList<>();

        for (int round = 0; round < ROUNDS; round++) {
            UUID owner = userPopulator.createUser("ritual-race-" + round + "@test.hu").getId();
            sleepGoalPopulator.goal(owner);

            CyclicBarrier gate = new CyclicBarrier(2);
            Callable<Object> closeCall = () -> {
                gate.await();
                return ritualService.close(owner, today);
            };

            ExecutorService pool = Executors.newFixedThreadPool(2);
            try {
                Future<Object> a = pool.submit(closeCall);
                Future<Object> b = pool.submit(closeCall);
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

            assertThat(ritualDayRepository.findByCreatedByAndRitualDate(owner, today))
                .as("round %d: exactly one row survives the race", round)
                .isPresent();
        }

        assertThat(failures)
            .as("both concurrent close() callers must succeed — the race loser gets the winner's row, "
                + "not an exception (%d/%d rounds failed)", failures.size(), ROUNDS * 2)
            .isEmpty();
    }
}
