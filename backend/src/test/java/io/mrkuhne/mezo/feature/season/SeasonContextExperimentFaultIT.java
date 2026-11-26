package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;

import io.mrkuhne.mezo.feature.season.repository.SeasonExperimentRepository;
import io.mrkuhne.mezo.feature.season.service.SeasonContextRenderer;
import io.mrkuhne.mezo.feature.season.service.SeasonService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Boop B6 Évad (mezo-r36n9.136): the season block reads the experiments in its own read-only transaction, so a
 * database fault there leaves out only the experiment lines and never marks Boop's reply transaction rollback-only.
 */
@Import(SeasonFixture.class)
class SeasonContextExperimentFaultIT extends AbstractIntegrationTest {

    @Autowired private SeasonContextRenderer renderer;
    @Autowired private SeasonService seasonService;
    @Autowired private SeasonFixture fixture;
    @Autowired private PlatformTransactionManager txManager;
    @MockitoSpyBean private SeasonExperimentRepository experiments;

    @AfterEach
    void reset() {
        Mockito.reset(experiments);
    }

    @Test
    void anExperimentReadFaultLeavesTheCallersTransactionCommittable() {
        UUID owner = fixture.owner("season-context-exp-fault@test.local");
        seasonService.activate(owner, seasonService.create(owner, SeasonFixture.draft()).getId());
        // fails the way a repository call does: through a transaction that joins the current one
        doAnswer(inv -> new TransactionTemplate(txManager).execute(s -> {
            throw new IllegalStateException("database down");
        })).when(experiments).findBySeasonIdAndKeptTrueOrderByCreatedAtAsc(any());

        new TransactionTemplate(txManager).executeWithoutResult(status -> {
            String out = renderer.render(owner, LocalDate.now());
            assertThat(out).startsWith("[Évad] ").contains("[Évad] E heti edzések: ")
                .doesNotContain("Szokás").doesNotContain("Kísérlet fut");
            assertThat(status.isRollbackOnly()).isFalse();
        });
    }
}
