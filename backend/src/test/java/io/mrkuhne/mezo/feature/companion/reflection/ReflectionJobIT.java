package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import io.mrkuhne.mezo.feature.companion.reflection.repository.TextSignalRepository;
import io.mrkuhne.mezo.feature.companion.reflection.service.ReflectionJob;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
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

/**
 * Reflexió S2 (mezo-eq85.2): the nightly pass end to end over the REAL fan-out — the catch-up
 * writes the missing signal, the evaluation appends the evidence event, and a user whose text
 * extraction blows up does not cost the next user their night.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
    // the shared test profile disables this cron by default (kill-switch completeness) — this IT
    // drives the job directly, so it re-enables it on its own cached context (DailySummaryJobIT idiom)
    "mezo.techcore.cron.reflection-job.enabled=true"
})
class ReflectionJobIT extends AbstractIntegrationTest {

    private static final TestPlanEnvelope PLAN = new TestPlanEnvelope(
            "people:anna", "sleep-duration-h", 1, TestPlanEnvelope.DIRECTION_POSITIVE, 8, 3, 60);

    private static final LocalDate TODAY = LocalDate.now();
    private static final LocalDate YESTERDAY = TODAY.minusDays(1);

    @Autowired private ReflectionJob reflectionJob;
    @Autowired private TextSignalRepository textSignalRepository;
    @Autowired private PatternRepository patternRepository;
    @Autowired private PatternEventRepository patternEventRepository;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private TextSignalPopulator textSignalPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRunFor_shouldCatchUpSignalsAndEvaluateHypotheses_perUser() {
        // user 1 only has an un-extracted journal entry — the catch-up step must heal it
        UUID first = userPopulator.createUser().getId();
        JournalEntryEntity entry = journalPopulator.createEntry(first, YESTERDAY,
                "Annával sétáltunk, jó nap volt.", JournalEntryEntity.SOURCE_QUICKINPUT);
        // user 2 only has an open hypothesis over seeded history — the evaluate step must test it
        UUID second = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflection(second, PLAN, PatternEntity.STATUS_PROPOSED);
        seedAnnaSleepDays(second);

        reflectionJob.runFor(TODAY);

        assertThat(textSignalRepository
                .findFirstByCreatedByAndSourceKindAndSourceIdAndDeletedFalseOrderByVersionDesc(
                        first, TextSignalEntity.SOURCE_JOURNAL, entry.getId()))
                .isPresent();
        assertThat(patternRepository.findById(row.getId()).orElseThrow().getStatus())
                .isEqualTo(PatternEntity.STATUS_MONITORING);
        assertThat(patternEventRepository
                .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(second, row.getId()))
                .extracting(PatternEventEntity::getKind)
                .contains(PatternEventEntity.KIND_EVIDENCE);
    }

    @Test
    void testRunFor_shouldIsolateAFailingUser_andStillEvaluateTheNext() {
        // user 1's only source makes the extractor blow up — the whole first user's night is broken
        UUID first = userPopulator.createUser().getId();
        journalPopulator.createEntry(first, YESTERDAY, "Nehéz nap. " + FakeCompanionLlm.SIGNAL_FAIL,
                JournalEntryEntity.SOURCE_QUICKINPUT);
        UUID second = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflection(second, PLAN, PatternEntity.STATUS_PROPOSED);
        seedAnnaSleepDays(second);

        reflectionJob.runFor(TODAY);

        assertThat(textSignalRepository
                .findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnAscVersionDesc(
                        first, YESTERDAY, YESTERDAY)).isEmpty();
        // user 2's evaluation ran anyway — the fan-out isolates per user
        assertThat(patternRepository.findById(row.getId()).orElseThrow().getStatus())
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
