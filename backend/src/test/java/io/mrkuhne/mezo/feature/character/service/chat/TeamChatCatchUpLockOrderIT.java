package io.mrkuhne.mezo.feature.character.service.chat;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.entity.KeywordsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamChatActionsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamChatExceptionEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatExceptionRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagTraceEntity;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagTraceRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.FlagLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * S7 Task 7 review (mezo-d6ivw.7): the catch-up sweep's lock order. {@code answer()} and the reply
 * commit take an ügy's row lock and THEN the per-user exception lock; the sweep must never wait on
 * a row lock while holding the exception lock (its opens take it in the gate), or the two form a
 * cycle Postgres breaks by aborting one side. Lives in the service package to drive
 * {@code catchUpUser} for ONE user directly.
 */
@ActiveProfiles("companion-fake")
class TeamChatCatchUpLockOrderIT extends AbstractIntegrationTest {

    @Autowired private TeamChatService service;
    @Autowired private TeamChatThreadRepository threads;
    @Autowired private TeamChatExceptionRepository exceptions;
    @Autowired private CompanionFlagTraceRepository flagTraces;
    @Autowired private FlagLogPopulator flagLogPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private TransactionTemplate tx;

    @Test
    void catchUp_withAnActiveException_andARowLockedUgy_neverDeadlocks() throws Exception {
        UUID owner = userPopulator.createUser().getId();
        // An OPEN sleep_debt ügy whose latest trace is a clear — the sweep's resolve target.
        TeamChatThreadEntity t = new TeamChatThreadEntity();
        t.setCreatedBy(owner);
        t.setFlagKey(FlagKey.SLEEP_DEBT);
        t.setOwnerCharacter("szunya");
        t.setAdviceKey("sleep_recover_tonight");
        t.setStatus("OPEN");
        t.setOpenedAt(Instant.now().minus(3, ChronoUnit.HOURS).truncatedTo(ChronoUnit.MICROS));
        t.setPushed(false);
        t.setActions(new TeamChatActionsEnvelope(List.of()));
        TeamChatThreadEntity sleep = threads.saveAndFlush(t);
        CompanionFlagTraceEntity trace = new CompanionFlagTraceEntity();
        trace.setCreatedBy(owner);
        trace.setFlagKey(FlagKey.SLEEP_DEBT);
        trace.setOutcome("clear");
        trace.setEvidence(new FlagVerdict.ClearEvidence("deficit_hours", 2.0, 5.0, null));
        trace.setOccurredAt(Instant.now().minus(1, ChronoUnit.HOURS).truncatedTo(ChronoUnit.MICROS));
        flagTraces.saveAndFlush(trace);
        // A missed late_eating raise with an active exception — the sweep's open runs the gate
        // (which takes the per-user exception lock).
        TeamChatExceptionEntity e = new TeamChatExceptionEntity();
        e.setCreatedBy(owner);
        e.setFlagKey(FlagKey.LATE_EATING);
        e.setOwnerCharacter("falat");
        e.setContextTag("meccsnap");
        e.setNormalizedTag("meccsnap");
        e.setFactText("Meccsnapokon későn eszel — ez rendben van.");
        e.setKeywords(new KeywordsEnvelope(List.of("meccs")));
        e.setActive(true);
        e.setWindowStartedAt(Instant.now().minus(10, ChronoUnit.DAYS));
        exceptions.saveAndFlush(e);
        flagLogPopulator.raise(owner, FlagKey.LATE_EATING, FlagKey.SOURCE_WRITE,
                FlagPayloadEnvelope.lateEating(new FlagPayloadEnvelope.LateEating(
                        90, 21.5, 2, 3, 23.0, 2, Map.of(), Map.of())));

        CountDownLatch rowLocked = new CountDownLatch(1);
        CountDownLatch proceed = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            // answer()/reply-commit shape: the ügy's row lock first, then the exception lock.
            Future<?> tapper = pool.submit(() -> tx.executeWithoutResult(s -> {
                threads.lockOwned(sleep.getId(), owner).orElseThrow();
                rowLocked.countDown();
                try {
                    proceed.await(10, SECONDS);
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                }
                exceptions.lockUserExceptions(owner);
            }));
            assertThat(rowLocked.await(10, SECONDS)).isTrue();
            Future<?> sweep = pool.submit(() -> service.catchUpUser(owner, Instant.now()));
            Thread.sleep(1000); // the sweep reaches its row-lock wait (the old order: holding the exception lock)
            proceed.countDown();

            tapper.get(20, SECONDS);
            sweep.get(20, SECONDS);
        } finally {
            proceed.countDown();
            pool.shutdownNow();
        }
        assertThat(threads.findById(sleep.getId()).orElseThrow().getStatus()).isEqualTo("RESOLVED");
        assertThat(threads.findFirstByCreatedByAndFlagKeyAndStatusAndDeletedFalse(owner, FlagKey.LATE_EATING, "OPEN"))
                .get().extracting(TeamChatThreadEntity::getOffer).isEqualTo("EXCUSE");
    }
}
