package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import io.mrkuhne.mezo.feature.companion.reflection.service.ReflectionJob;
import io.mrkuhne.mezo.feature.companion.reflection.service.TextSignalCatchUpService;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TextSignalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * Reflexió S2 (mezo-eq85.2): {@code ReflectionJob.step}'s own try/catch — the LAST isolation layer,
 * and the only one nothing else covers.
 *
 * <p>Below it, {@code TextSignalCatchUpService} already swallows a single bad SOURCE, so a poisoned
 * journal entry never reaches the step boundary ({@code ReflectionJobIT} covers that case).
 * Above it, {@code UserFanOut} isolates per user. The step boundary matters when a whole step
 * fails outright — and the point of the night's ordering is that the evaluation, which needs no LLM
 * at all, must still run after an LLM-driven step has died. So this IT makes the catch-up step
 * itself throw for every user and asserts both users' hypotheses were still evaluated.
 *
 * <p>Own IT class — the {@code @MockitoSpyBean} forks the application context.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.techcore.cron.reflection-job.enabled=true")
class ReflectionJobStepIsolationIT extends AbstractIntegrationTest {

    private static final TestPlanEnvelope PLAN = new TestPlanEnvelope(
            "people:anna", "sleep-duration-h", 1, TestPlanEnvelope.DIRECTION_POSITIVE, 8, 3, 60);

    private static final LocalDate TODAY = LocalDate.now();

    @Autowired private ReflectionJob reflectionJob;
    @Autowired private PatternRepository patternRepository;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private TextSignalPopulator textSignalPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private UserPopulator userPopulator;
    @MockitoSpyBean private TextSignalCatchUpService catchUpService;

    @Test
    void testRunFor_shouldStillEvaluate_whenTheCatchUpStepFailsOutright() {
        UUID first = userPopulator.createUser().getId();
        PatternEntity firstRow = patternPopulator.reflection(first, PLAN, PatternEntity.STATUS_PROPOSED);
        seedAnnaSleepDays(first);
        UUID second = userPopulator.createUser().getId();
        PatternEntity secondRow = patternPopulator.reflection(second, PLAN, PatternEntity.STATUS_PROPOSED);
        seedAnnaSleepDays(second);

        // the whole step dies, for every user — not one bad source inside it
        doThrow(new IllegalStateException("simulated catch-up step failure"))
                .when(catchUpService).catchUp(any(UUID.class), any(LocalDate.class));

        reflectionJob.runFor(TODAY);

        // the evaluate step ran anyway, for BOTH users: drop step()'s try/catch and the exception
        // escapes to UserFanOut, which abandons the rest of that user's night — these stay proposed
        assertThat(patternRepository.findById(firstRow.getId()).orElseThrow().getStatus())
                .isEqualTo(PatternEntity.STATUS_MONITORING);
        assertThat(patternRepository.findById(secondRow.getId()).orElseThrow().getStatus())
                .isEqualTo(PatternEntity.STATUS_MONITORING);
    }

    /** Ten finished days: Anna-days are followed by long nights, the others by short ones. */
    private void seedAnnaSleepDays(UUID owner) {
        for (int i = 0; i < 10; i++) {
            LocalDate day = TODAY.minusDays(10L - i);
            boolean anna = i % 2 == 0;
            textSignalPopulator.signal(owner, TextSignalEntity.SOURCE_JOURNAL, UUID.randomUUID(), day,
                    3, 3, 3, anna ? List.of("Anna") : List.of(), List.of());
            sleepLogPopulator.createSleepLog(owner, day.plusDays(1),
                    BigDecimal.valueOf((anna ? 8.0 : 6.0) + (i % 4) * 0.1), 3);
        }
    }
}
