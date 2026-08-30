package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.FactCandidateResponse;
import io.mrkuhne.mezo.api.dto.FactDecisionRequest;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.mapper.CompanionMapper;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * The V1.2 pending inbox + the accept/refine/reject decision. Confirm is an explicit L2 action
 * (IDENT-6) — accept/refine promote the candidate into a {@code knowledge_fact} whose source is
 * INHERITED from the candidate (chat extraction ⇒ 'chat', weekly review ⇒ 'weekly_review'),
 * which the V1.1 top-N injection then carries into every prompt. One decision per candidate.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FactCandidateService {

    private final LearnedFactRepository learnedFactRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final CompanionMapper mapper;
    private final ApplicationEventPublisher eventPublisher;

    public List<FactCandidateResponse> listPending(UUID userId) {
        return learnedFactRepository
                .findByCreatedByAndUserDecisionIsNullAndDeletedFalseOrderByCreatedAtDesc(userId)
                .stream()
                .map(mapper::toFactCandidateResponse)
                .toList();
    }

    @Transactional
    public FactCandidateResponse decide(UUID userId, UUID candidateId, FactDecisionRequest request) {
        LearnedFactEntity candidate = getOwned(userId, candidateId);
        if (candidate.getUserDecision() != null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("COMPANION_CANDIDATE_ALREADY_DECIDED").build());
        }
        switch (request.getDecision()) {
            case LearnedFactEntity.DECISION_ACCEPT ->
                    candidate.setPromotedFactId(promote(userId, candidate.getCandidateText(), candidate));
            case LearnedFactEntity.DECISION_REFINE -> {
                if (request.getRefinedText() == null || request.getRefinedText().isBlank()) {
                    throw new SystemRuntimeErrorException(
                            SystemMessage.field("VALIDATION_REQUIRED_FIELD", "refinedText").build());
                }
                candidate.setRefinedText(request.getRefinedText());
                candidate.setPromotedFactId(promote(userId, request.getRefinedText(), candidate));
            }
            case LearnedFactEntity.DECISION_REJECT -> { /* decision only — nothing is promoted */ }
            // unreachable while the contract pattern holds — honest 400 if it ever drifts
            default -> throw new SystemRuntimeErrorException(
                    SystemMessage.field("VALIDATION_INVALID_VALUE", "decision").build());
        }
        candidate.setUserDecision(request.getDecision());
        if (candidate.getPromotedFactId() != null) {
            // W2.2 (mezo-b3pp.7): accept/refine just minted (or re-confirmed) a knowledge_fact —
            // promote it into a PREFERENCE node. Reject never sets promotedFactId, so no event fires.
            eventPublisher.publishEvent(new KnowledgeFactPromotedEvent(userId, candidate.getPromotedFactId()));
        }
        return mapper.toFactCandidateResponse(learnedFactRepository.saveAndFlush(candidate));
    }

    private UUID promote(UUID userId, String factText, LearnedFactEntity candidate) {
        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setCreatedBy(userId);
        fact.setFactText(factText);
        fact.setCategory(candidate.getCategory());
        fact.setSource(sourceOf(candidate));
        return knowledgeFactRepository.saveAndFlush(fact).getId();
    }

    /** The promoted fact inherits the CANDIDATE's provenance (mezo-d20.7.6) — hardcoding 'chat'
     *  would make an accepted weekly lesson lie about where it came from. */
    private static String sourceOf(LearnedFactEntity candidate) {
        return LearnedFactEntity.SOURCE_WEEKLY_REVIEW.equals(candidate.getSource())
                ? KnowledgeFactEntity.SOURCE_WEEKLY_REVIEW
                : KnowledgeFactEntity.SOURCE_CHAT;
    }

    private LearnedFactEntity getOwned(UUID userId, UUID candidateId) {
        return learnedFactRepository.findByIdAndCreatedByAndDeletedFalse(candidateId, userId)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
