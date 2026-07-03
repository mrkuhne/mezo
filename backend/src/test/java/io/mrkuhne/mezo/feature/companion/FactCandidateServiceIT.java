package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.FactCandidateResponse;
import io.mrkuhne.mezo.api.dto.FactDecisionRequest;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.service.FactCandidateService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The V1.2 pending inbox + the accept/refine/reject decision (L2 confirm — never silent). */
@Transactional
class FactCandidateServiceIT extends AbstractIntegrationTest {

    @Autowired private FactCandidateService factCandidateService;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private LearnedFactPopulator learnedFactPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private FactDecisionRequest decision(String decision, String refinedText) {
        return FactDecisionRequest.builder().decision(decision).refinedText(refinedText).build();
    }

    @Test
    void testListPending_shouldReturnUndecidedNewestFirstOwnerScoped_whenMixedCandidates() {
        UUID owner = databasePopulator.populateUser("candidate-list@test.local");
        UUID stranger = databasePopulator.populateUser("candidate-stranger@test.local");
        learnedFactPopulator.candidate(owner, "régi tény", "life", null);
        LearnedFactEntity decided = learnedFactPopulator.candidate(owner, "eldöntött tény", "life", null);
        decided.setUserDecision(LearnedFactEntity.DECISION_REJECT);
        learnedFactPopulator.candidate(owner, "új tény", "train", null);
        learnedFactPopulator.candidate(stranger, "idegen tény", "life", null);

        List<FactCandidateResponse> pending = factCandidateService.listPending(owner);

        assertThat(pending).extracting(FactCandidateResponse::getCandidateText)
                .containsExactly("új tény", "régi tény");
    }

    @Test
    void testDecide_shouldPromoteIntoKnowledgeFact_whenAccepted() {
        UUID userId = databasePopulator.populateUser("candidate-accept@test.local");
        LearnedFactEntity candidate = learnedFactPopulator.candidate(userId, "Laktózérzékeny", "health", null);

        FactCandidateResponse decided = factCandidateService.decide(
                userId, candidate.getId(), decision("accept", null));

        assertThat(decided.getUserDecision()).isEqualTo("accept");
        assertThat(decided.getPromotedFactId()).isNotNull();
        KnowledgeFactEntity promoted = knowledgeFactRepository.findById(decided.getPromotedFactId()).orElseThrow();
        assertThat(promoted.getFactText()).isEqualTo("Laktózérzékeny");
        assertThat(promoted.getCategory()).isEqualTo("health");
        assertThat(promoted.getSource()).isEqualTo(KnowledgeFactEntity.SOURCE_CHAT);
        assertThat(promoted.isIncludeInPrompt()).isTrue();
        assertThat(promoted.getReinforcementCount()).isZero();
        assertThat(promoted.getCreatedBy()).isEqualTo(userId);
    }

    @Test
    void testDecide_shouldUseRefinedText_whenRefined() {
        UUID userId = databasePopulator.populateUser("candidate-refine@test.local");
        LearnedFactEntity candidate = learnedFactPopulator.candidate(userId, "pontatlan tény", "fuel", null);

        FactCandidateResponse decided = factCandidateService.decide(
                userId, candidate.getId(), decision("refine", "Pontosított tény"));

        assertThat(decided.getUserDecision()).isEqualTo("refine");
        assertThat(decided.getRefinedText()).isEqualTo("Pontosított tény");
        KnowledgeFactEntity promoted = knowledgeFactRepository.findById(decided.getPromotedFactId()).orElseThrow();
        assertThat(promoted.getFactText()).isEqualTo("Pontosított tény");
        assertThat(promoted.getCategory()).isEqualTo("fuel");
    }

    @Test
    void testDecide_shouldThrowFieldError_whenRefineWithoutText() {
        UUID userId = databasePopulator.populateUser("candidate-refine-miss@test.local");
        LearnedFactEntity candidate = learnedFactPopulator.candidate(userId, "tény", "life", null);

        assertThatThrownBy(() -> factCandidateService.decide(userId, candidate.getId(), decision("refine", null)))
                .isInstanceOf(SystemRuntimeErrorException.class);
        assertThat(knowledgeFactRepository.findByCreatedByAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(userId))
                .isEmpty();
    }

    @Test
    void testDecide_shouldNotCreateFact_whenRejected() {
        UUID userId = databasePopulator.populateUser("candidate-reject@test.local");
        LearnedFactEntity candidate = learnedFactPopulator.candidate(userId, "elvetendő", "life", null);

        FactCandidateResponse decided = factCandidateService.decide(
                userId, candidate.getId(), decision("reject", null));

        assertThat(decided.getUserDecision()).isEqualTo("reject");
        assertThat(decided.getPromotedFactId()).isNull();
        assertThat(knowledgeFactRepository.findByCreatedByAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(userId))
                .isEmpty();
        assertThat(factCandidateService.listPending(userId)).isEmpty();
    }

    @Test
    void testDecide_shouldThrowConflict_whenAlreadyDecided() {
        UUID userId = databasePopulator.populateUser("candidate-double@test.local");
        LearnedFactEntity candidate = learnedFactPopulator.candidate(userId, "egyszer dönthető", "life", null);
        factCandidateService.decide(userId, candidate.getId(), decision("reject", null));

        assertThatThrownBy(() -> factCandidateService.decide(userId, candidate.getId(), decision("accept", null)))
                .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testDecide_shouldThrowNotFound_whenCandidateOwnedBySomeoneElse() {
        UUID owner = databasePopulator.populateUser("candidate-owner@test.local");
        UUID stranger = databasePopulator.populateUser("candidate-thief@test.local");
        LearnedFactEntity foreign = learnedFactPopulator.candidate(stranger, "idegen", "life", null);

        assertThatThrownBy(() -> factCandidateService.decide(owner, foreign.getId(), decision("accept", null)))
                .isInstanceOf(SystemRuntimeErrorException.class);
    }
}
