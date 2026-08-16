package io.mrkuhne.mezo.feature.quest;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.feature.quest.service.QuestService;
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
 * The day's quest offers are generated lazily on first read, and the morning cron generates them
 * too — so two writers race by design (mezo-5jly). The retired guard caught the resulting
 * {@code DataIntegrityViolationException} and re-read in the SAME transaction, which cannot work
 * on Postgres: the violation aborts the transaction (SQLSTATE 25P02) and every later statement on
 * that connection fails, so the losing reader's whole {@code getDay} request died.
 * {@code TxRaceGuardReproIT} pins the mechanism; this pins the user-visible consequence.
 *
 * <p>The slot uniqueness assertion matters as much as the no-exception one: offers are written one
 * slot at a time, so a half-set stitched together from two racers would be a different, quieter
 * bug — the user would see a day whose quests came from two different draws.
 */
class QuestServiceRaceIT extends AbstractIntegrationTest {

    private static final int ROUNDS = 5;

    @Autowired private UserPopulator userPopulator;
    @Autowired private QuestService questService;
    @Autowired private DailyQuestRepository questRepository;

    @Test
    void testGetDay_shouldGenerateOneCoherentOfferSet_whenTwoReadsRaceOnAFreshDay() throws Exception {
        LocalDate today = LocalDate.now();
        List<Throwable> failures = new ArrayList<>();

        for (int round = 0; round < ROUNDS; round++) {
            UUID owner = userPopulator.createUser("quest-race-" + round + "@test.hu").getId();

            CyclicBarrier gate = new CyclicBarrier(2);
            Callable<Object> readDay = () -> {
                gate.await();
                return questService.getDay(owner, today);
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

            List<String> slots = questRepository
                .findByCreatedByAndQuestDateOrderBySlotAsc(owner, today)
                .stream().map(DailyQuestEntity::getSlot).toList();
            assertThat(slots)
                .as("round %d: one draw wins the day — no slot may be filled twice", round)
                .doesNotHaveDuplicates();
        }

        assertThat(failures)
            .as("both concurrent getDay() callers must succeed — the losing generate must not fail "
                + "the request (%d/%d calls failed)", failures.size(), ROUNDS * 2)
            .isEmpty();
    }
}
