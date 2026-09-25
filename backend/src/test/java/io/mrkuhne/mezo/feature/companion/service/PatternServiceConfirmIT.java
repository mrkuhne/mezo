package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * S2 (mezo-d6ivw.2): {@code PatternService.applyUserConfirm} — one confirm, one meaning, with
 * provenance. Companion the reply-path entry the FE's "Igen, ez igaz rám" chip calls.
 */
@ActiveProfiles("companion-fake")
class PatternServiceConfirmIT extends AbstractIntegrationTest {

    @Autowired private PatternService patternService;
    @Autowired private PatternRepository patternRepository;
    @Autowired private PatternEventRepository patternEventRepository;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;

    private static TestPlanEnvelope plan() {
        return new TestPlanEnvelope("people:anna", "sleep-duration-h", 1,
                TestPlanEnvelope.DIRECTION_POSITIVE, 8, 3, 30);
    }

    @Test
    void testApplyUserConfirm_shouldPromoteAndFreeze_whenRowHasNoTestPlan() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.createPattern(owner, "pair-no-plan-" + UUID.randomUUID(),
                "Teszt: nincs terv");

        patternService.applyUserConfirm(owner, row);
        patternRepository.saveAndFlush(row);

        PatternEntity saved = patternRepository.findById(row.getId()).orElseThrow();
        assertThat(saved.getStatus()).isEqualTo(PatternEntity.STATUS_CONFIRMED);
        assertThat(saved.getPromotedFactId()).isNotNull();
        KnowledgeFactEntity fact = knowledgeFactRepository.findById(saved.getPromotedFactId()).orElseThrow();
        assertThat(fact.getProvenance().patternId()).isEqualTo(row.getId());
        assertThat(fact.getProvenance().confirmSource()).isEqualTo(PatternService.CONFIRM_SOURCE_USER);
        assertThat(fact.isIncludeInPrompt()).isTrue();
    }

    @Test
    void testApplyUserConfirm_shouldPromoteButKeepMonitoring_whenRowHasTestPlan() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflection(owner, plan(), PatternEntity.STATUS_MONITORING);

        patternService.applyUserConfirm(owner, row);
        patternRepository.saveAndFlush(row);

        PatternEntity saved = patternRepository.findById(row.getId()).orElseThrow();
        assertThat(saved.getStatus()).isEqualTo(PatternEntity.STATUS_MONITORING);
        assertThat(saved.getPromotedFactId()).isNotNull();
    }

    @Test
    void testApplyUserConfirm_shouldNotDuplicateFact_whenConfirmedTwice() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.createPattern(owner, "pair-no-plan-" + UUID.randomUUID(),
                "Teszt: nincs terv");

        patternService.applyUserConfirm(owner, row);
        UUID firstFact = row.getPromotedFactId();
        patternService.applyUserConfirm(owner, row);

        assertThat(row.getPromotedFactId()).isEqualTo(firstFact);
        assertThat(knowledgeFactRepository.findByCreatedByAndSourceAndDeletedFalse(owner,
                KnowledgeFactEntity.SOURCE_PATTERN)).hasSize(1);
    }

    /**
     * S2 delta (final-review adjudications 2026-09-25): a drift card's confirm ("igen, ez most is
     * így van") only freezes the row — it must NEVER mint a fact that would contradict the
     * ORIGINAL confirmed fact the drift row is about. Superseding it is S6's job.
     */
    @Test
    void testApplyUserConfirm_shouldFreezeWithoutPromoting_whenRowIsADriftCard() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_PROPOSED);
        row.setPairKey(PatternEntity.PAIR_KEY_DRIFT_PREFIX + UUID.randomUUID());
        row = patternPopulator.save(row);

        patternService.applyUserConfirm(owner, row);
        patternRepository.saveAndFlush(row);

        PatternEntity saved = patternRepository.findById(row.getId()).orElseThrow();
        assertThat(saved.getStatus()).isEqualTo(PatternEntity.STATUS_CONFIRMED);
        assertThat(saved.getPromotedFactId()).isNull();
        assertThat(knowledgeFactRepository.findByCreatedByAndSourceAndDeletedFalse(owner,
                KnowledgeFactEntity.SOURCE_PATTERN)).isEmpty();
        assertThat(patternEventRepository
                .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, row.getId()))
                .extracting(PatternEventEntity::getKind)
                .containsExactly(PatternEventEntity.KIND_CONFIRMED)
                .doesNotContain(PatternEventEntity.KIND_PROMOTED);
    }
}
