package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

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
import io.mrkuhne.mezo.support.populator.CreatedAtBackdater;
import io.mrkuhne.mezo.support.populator.PatternEventPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TextSignalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Reflexió S2 (mezo-eq85.2): the nightly hypothesis evaluation. Every case drives the real gate
 * over real {@code text_signal} + {@code sleep_log} rows — the point of the slice is that a
 * hypothesis is FALSIFIABLE, so a test that stubbed the statistic would test nothing.
 *
 * <p>The plan under test is "the days I write about Anna are followed by longer sleep":
 * {@code people:anna → sleep-duration-h}, lag 1, positive.
 */
@ActiveProfiles("companion-fake")
class HypothesisEvaluationServiceIT extends AbstractIntegrationTest {

    private static final TestPlanEnvelope PLAN = new TestPlanEnvelope(
            "people:anna", "sleep-duration-h", 1, TestPlanEnvelope.DIRECTION_POSITIVE, 8, 3, 60);

    private static final LocalDate TODAY = LocalDate.now();

    @Autowired private HypothesisEvaluationService evaluationService;
    @Autowired private PatternRepository patternRepository;
    @Autowired private PatternEventRepository patternEventRepository;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventPopulator patternEventPopulator;
    @Autowired private TextSignalPopulator textSignalPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CreatedAtBackdater createdAtBackdater;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testEvaluate_shouldAppendEvidenceAndMoveProposedToMonitoring_onStrongHit() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflection(owner, PLAN, PatternEntity.STATUS_PROPOSED);
        seedAnnaSleepDays(owner, 10);

        assertThat(evaluationService.evaluate(owner, TODAY)).isEqualTo(1);

        PatternEntity after = patternRepository.findById(row.getId()).orElseThrow();
        assertThat(after.getStatus()).isEqualTo(PatternEntity.STATUS_MONITORING);
        assertThat(after.getEvidenceHits()).isEqualTo(1);
        assertThat(after.getEvidenceMisses()).isZero();
        assertThat(after.getBelief()).isNotNull();
        assertThat(after.getBelief()).isGreaterThan(BigDecimal.ZERO);

        List<PatternEventEntity> events = events(owner, row.getId());
        assertThat(events).extracting(PatternEventEntity::getKind)
                .containsExactly(PatternEventEntity.KIND_EVIDENCE, PatternEventEntity.KIND_MONITORING);
        assertThat(events.get(0).getPayload().hit()).isTrue();
        assertThat(events.get(0).getPayload().verdict()).isEqualTo("LIVE");
        assertThat(events.get(0).getPayload().n()).isEqualTo(10);
        assertThat(events.get(0).getPayload().r()).isNotNull();
    }

    @Test
    void testEvaluate_shouldConfirmAndPromote_afterThreeHitsAndOnePositiveReply() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflection(owner, PLAN, PatternEntity.STATUS_MONITORING);
        patternEventPopulator.userReply(owner, row.getId(), "chip", "watch", null);
        seedAnnaSleepDays(owner, 10);

        // three consecutive confirming nights — the seeded days stay inside the 60-day window
        for (int night = 0; night < 3; night++) {
            assertThat(evaluationService.evaluate(owner, TODAY.plusDays(night))).isEqualTo(1);
        }

        PatternEntity after = patternRepository.findById(row.getId()).orElseThrow();
        assertThat(after.getStatus()).isEqualTo(PatternEntity.STATUS_CONFIRMED);
        assertThat(after.getEvidenceHits()).isEqualTo(3);
        assertThat(after.getPromotedFactId()).isNotNull();
        assertThat(events(owner, row.getId())).extracting(PatternEventEntity::getKind)
                .containsSubsequence(PatternEventEntity.KIND_EVIDENCE,
                        PatternEventEntity.KIND_CONFIRMED, PatternEventEntity.KIND_PROMOTED);

        KnowledgeFactEntity fact = knowledgeFactRepository.findById(after.getPromotedFactId()).orElseThrow();
        assertThat(fact.getSource()).isEqualTo(KnowledgeFactEntity.SOURCE_PATTERN);
        assertThat(fact.getFactText()).isEqualTo(after.getTitle());
    }

    @Test
    void testEvaluate_shouldRefute_afterThreeMisses() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflection(owner, PLAN, PatternEntity.STATUS_PROPOSED);
        seedUncorrelatedDays(owner);

        for (int night = 0; night < 3; night++) {
            assertThat(evaluationService.evaluate(owner, TODAY.plusDays(night))).isEqualTo(1);
        }

        PatternEntity after = patternRepository.findById(row.getId()).orElseThrow();
        assertThat(after.getStatus()).isEqualTo(PatternEntity.STATUS_REFUTED);
        assertThat(after.getEvidenceHits()).isZero();
        assertThat(after.getEvidenceMisses()).isEqualTo(3);
        assertThat(events(owner, row.getId())).extracting(PatternEventEntity::getKind)
                .contains(PatternEventEntity.KIND_REFUTED);
        // the gate WAS live every night — the plan's prediction simply did not hold
        assertThat(events(owner, row.getId()).stream()
                .filter(e -> PatternEventEntity.KIND_EVIDENCE.equals(e.getKind()))
                .map(e -> e.getPayload().hit()))
                .containsExactly(false, false, false);
    }

    /**
     * BOTH user verdicts are frozen for the engine — the work-list query must not even read them.
     * (The lifecycle's own frozen branch, i.e. what would happen if such a row DID reach
     * {@code decide}, is owned by {@code HypothesisLifecycleTest.userFrozenNeverMoves}.)
     */
    @Test
    void testEvaluate_shouldSkipUserFrozenRows() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity rejected = patternPopulator.reflection(owner, PLAN, PatternEntity.STATUS_REJECTED);
        PatternEntity confirmed = patternPopulator.reflection(owner,
                new TestPlanEnvelope("people:anna", "sleep-duration-h", 2,
                        TestPlanEnvelope.DIRECTION_POSITIVE, 8, 3, 60),
                PatternEntity.STATUS_CONFIRMED);
        seedAnnaSleepDays(owner, 10);

        assertThat(evaluationService.evaluate(owner, TODAY)).isZero();

        for (PatternEntity frozen : List.of(rejected, confirmed)) {
            PatternEntity after = patternRepository.findById(frozen.getId()).orElseThrow();
            assertThat(after.getStatus()).isEqualTo(frozen.getStatus());
            assertThat(after.getBelief()).isNull();
            assertThat(after.getEvidenceHits()).isZero();
            assertThat(after.getEvidenceMisses()).isZero();
            assertThat(events(owner, frozen.getId())).isEmpty();
        }
    }

    /**
     * A {@code statistical} row carries a test plan too (Task 2 stamps the catalog pair onto it),
     * but the nightly Pearson job owns those rows — the plan there is display metadata. The
     * evaluation must walk past it even though it is open AND has a plan.
     */
    @Test
    void testEvaluate_shouldSkipStatisticalRows_evenWhenTheyCarryATestPlan() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity statistical = patternPopulator.statistical(owner,
                "checkin-stress~sleep-quality", PatternEntity.STATUS_PROPOSED);
        statistical.setTestPlan(PLAN);
        statistical.setHypothesisKey("pair:checkin-stress~sleep-quality");
        statistical.setOrigin(PatternEntity.ORIGIN_PAIR_CATALOG);
        patternPopulator.save(statistical);
        seedAnnaSleepDays(owner, 10);

        assertThat(evaluationService.evaluate(owner, TODAY)).isZero();

        PatternEntity after = patternRepository.findById(statistical.getId()).orElseThrow();
        assertThat(after.getStatus()).isEqualTo(PatternEntity.STATUS_PROPOSED);
        assertThat(after.getBelief()).isNull();
        assertThat(after.getEvidenceHits()).isZero();
        assertThat(events(owner, statistical.getId())).isEmpty();
    }

    @Test
    void testEvaluate_shouldGoDormant_whenNoDataForLongerThanConfigured() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflection(owner, PLAN, PatternEntity.STATUS_MONITORING);
        // born 31 days ago and never fed — past the configured 30-day dormancy window
        createdAtBackdater.backdate("pattern", row.getId(),
                Instant.now().minus(31, ChronoUnit.DAYS));

        assertThat(evaluationService.evaluate(owner, TODAY)).isEqualTo(1);

        PatternEntity after = patternRepository.findById(row.getId()).orElseThrow();
        assertThat(after.getStatus()).isEqualTo(PatternEntity.STATUS_DORMANT);
        assertThat(after.getEvidenceHits()).isZero();
        assertThat(after.getEvidenceMisses()).isZero(); // a no-data night is neither hit nor miss
        List<PatternEventEntity> events = events(owner, row.getId());
        assertThat(events).extracting(PatternEventEntity::getKind)
                .containsExactly(PatternEventEntity.KIND_EVIDENCE, PatternEventEntity.KIND_DORMANT);
        assertThat(events.get(0).getPayload().verdict()).isEqualTo("NO_DATA");
        assertThat(events.get(0).getPayload().hit()).isNull();
    }

    /**
     * {@code count} finished days: on every second day a signal naming Anna followed by a long
     * night, otherwise a signal without her followed by a short one. The jitter keeps r away from
     * a degenerate ±1 while staying far inside the strong band.
     */
    private void seedAnnaSleepDays(UUID owner, int count) {
        for (int i = 0; i < count; i++) {
            LocalDate day = TODAY.minusDays(count - (long) i);
            boolean anna = i % 2 == 0;
            textSignalPopulator.signal(owner, TextSignalEntity.SOURCE_JOURNAL, UUID.randomUUID(), day,
                    3, 3, 3, anna ? List.of("Anna") : List.of(), List.of());
            sleepLogPopulator.createSleepLog(owner, day.plusDays(1),
                    BigDecimal.valueOf((anna ? 8.0 : 6.0) + (i % 4) * 0.1), 3);
        }
    }

    /** Same 10 days, same balanced groups — but the two group means are IDENTICAL, so the gate
     *  stays LIVE (this is real evidence) and r lands at ~0: a miss, not a "cannot tell". */
    private void seedUncorrelatedDays(UUID owner) {
        double[] annaHours = {6.0, 7.0, 8.0, 7.0, 7.0};
        double[] otherHours = {7.0, 7.0, 8.0, 6.0, 7.0};
        for (int i = 0; i < 10; i++) {
            LocalDate day = TODAY.minusDays(10L - i);
            boolean anna = i % 2 == 0;
            textSignalPopulator.signal(owner, TextSignalEntity.SOURCE_JOURNAL, UUID.randomUUID(), day,
                    3, 3, 3, anna ? List.of("Anna") : List.of(), List.of());
            sleepLogPopulator.createSleepLog(owner, day.plusDays(1),
                    BigDecimal.valueOf(anna ? annaHours[i / 2] : otherHours[i / 2]), 3);
        }
    }

    private List<PatternEventEntity> events(UUID owner, UUID patternId) {
        return patternEventRepository
                .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, patternId);
    }
}
