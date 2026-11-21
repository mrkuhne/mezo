package io.mrkuhne.mezo.feature.capacity.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;

import io.mrkuhne.mezo.feature.companion.port.CapacityContextPort;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Boop B7 K2 final fix (mezo-r36n9.17): the companion's capacity lines are read outside the caller's (writing)
 * transaction, so a database fault inside the read is swallowed to {@code ""} without marking the caller's
 * transaction rollback-only.
 */
class CapacityContextAdapterIT extends AbstractIntegrationTest {

    @Autowired private CapacityContextPort port;
    @Autowired private PlatformTransactionManager txManager;
    @Autowired private DatabasePopulator databasePopulator;
    @MockitoSpyBean private CapacityDayService days;

    @AfterEach
    void reset() {
        Mockito.reset(days);
    }

    /** A read that fails the way a repository call does: through a transaction that joins the current one. */
    private void historyFailsInsideATransaction() {
        doAnswer(inv -> new TransactionTemplate(txManager).execute(s -> {
            throw new IllegalStateException("database down");
        })).when(days).history(any(), any(), any());
    }

    @Test
    void aFaultInTheTodayLineLeavesTheCallersTransactionCommittable() {
        UUID owner = databasePopulator.populateUser("capacity-context-fault@test.local");
        historyFailsInsideATransaction();

        new TransactionTemplate(txManager).executeWithoutResult(status -> {
            assertThat(port.render(owner, LocalDate.of(2026, 11, 23))).isEmpty();
            assertThat(status.isRollbackOnly()).isFalse();
        });
    }

    @Test
    void aFaultInTheWeekLinesLeavesTheCallersTransactionCommittable() {
        UUID owner = databasePopulator.populateUser("capacity-context-week-fault@test.local");
        historyFailsInsideATransaction();

        new TransactionTemplate(txManager).executeWithoutResult(status -> {
            assertThat(port.week(owner, "2026-W48")).isEmpty();
            assertThat(status.isRollbackOnly()).isFalse();
        });
    }
}
