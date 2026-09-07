package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import io.mrkuhne.mezo.feature.companion.reflection.service.HypothesisEvaluationService;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PatternEventPopulator;
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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * Reflexió S2 (mezo-eq85.2): the per-row transaction boundary of
 * {@code HypothesisEvaluationService.evaluateOne}.
 *
 * <p>The confirming night is the dangerous one: it writes the {@code evidence} event, then a
 * {@code knowledge_fact} plus the {@code confirmed}/{@code promoted} events, and only THEN saves
 * the row. Without one transaction around the whole row, a failure at that final save leaves a
 * durable fact and a {@code confirmed} event behind a row that is still {@code monitoring} with
 * {@code promotedFactId} null — so the next night confirms and promotes AGAIN (a duplicated fact),
 * and the tallies drift permanently away from the event log. This IT injects exactly that failure
 * and asserts NOTHING from the failed night survives.
 *
 * <p>Own IT class on purpose — the {@code @MockitoSpyBean} forks the application context, so it
 * stays out of {@code HypothesisEvaluationServiceIT}'s cached one.
 */
@ActiveProfiles("companion-fake")
class HypothesisEvaluationRollbackIT extends AbstractIntegrationTest {

    private static final TestPlanEnvelope PLAN = new TestPlanEnvelope(
            "people:anna", "sleep-duration-h", 1, TestPlanEnvelope.DIRECTION_POSITIVE, 8, 3, 60);

    private static final LocalDate TODAY = LocalDate.now();

    @Autowired private HypothesisEvaluationService evaluationService;
    @Autowired private PatternEventRepository patternEventRepository;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventPopulator patternEventPopulator;
    @Autowired private TextSignalPopulator textSignalPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private UserPopulator userPopulator;
    @MockitoSpyBean private PatternRepository patternRepository;

    @Test
    void testEvaluate_shouldLeaveNoPartialWrites_whenTheRowSaveFailsAfterAConfirm() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflection(owner, PLAN, PatternEntity.STATUS_MONITORING);
        patternEventPopulator.userReply(owner, row.getId(), "chip", "watch", null);
        seedAnnaSleepDays(owner);

        // two clean confirming nights — the third would hit the confirm streak and promote
        assertThat(evaluationService.evaluate(owner, TODAY)).isEqualTo(1);
        assertThat(evaluationService.evaluate(owner, TODAY.plusDays(1))).isEqualTo(1);
        PatternEntity before = patternRepository.findById(row.getId()).orElseThrow();
        assertThat(before.getStatus()).isEqualTo(PatternEntity.STATUS_MONITORING);
        assertThat(before.getEvidenceHits()).isEqualTo(2);

        // the row's LAST write blows up — everything the confirming night already wrote must go
        doThrow(new DataIntegrityViolationException("simulated row save failure"))
                .when(patternRepository).saveAndFlush(any(PatternEntity.class));

        // the run survives: evaluate()'s per-row try/catch still isolates the failure
        assertThat(evaluationService.evaluate(owner, TODAY.plusDays(2))).isZero();

        PatternEntity after = patternRepository.findById(row.getId()).orElseThrow();
        assertThat(after.getStatus()).isEqualTo(PatternEntity.STATUS_MONITORING);
        assertThat(after.getPromotedFactId()).isNull();
        assertThat(after.getEvidenceHits()).isEqualTo(2); // tallies did NOT drift from the event log
        assertThat(after.getEvidenceMisses()).isZero();

        List<PatternEventEntity> events = patternEventRepository
                .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, row.getId());
        assertThat(events).extracting(PatternEventEntity::getKind)
                .doesNotContain(PatternEventEntity.KIND_CONFIRMED, PatternEventEntity.KIND_PROMOTED);
        assertThat(events).filteredOn(e -> PatternEventEntity.KIND_EVIDENCE.equals(e.getKind()))
                .hasSize(2); // the failed night's evidence event rolled back with the rest
        assertThat(knowledgeFactRepository.findByCreatedByAndSourceAndDeletedFalse(
                owner, KnowledgeFactEntity.SOURCE_PATTERN)).isEmpty();
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
