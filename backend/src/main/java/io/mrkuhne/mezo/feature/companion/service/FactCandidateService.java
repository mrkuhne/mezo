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
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * The V1.2 pending inbox + the accept/refine/reject decision. Confirm is an explicit L2 action
 * (IDENT-6) — accept/refine promote the candidate into a {@code knowledge_fact} (source=chat),
 * which the V1.1 top-N injection then carries into every prompt. One decision per candidate.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FactCandidateService {

    private final LearnedFactRepository learnedFactRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final CompanionMapper mapper;

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
                    candidate.setPromotedFactId(promote(userId, candidate.getCandidateText(), candidate.getCategory()));
            case LearnedFactEntity.DECISION_REFINE -> {
                if (request.getRefinedText() == null || request.getRefinedText().isBlank()) {
                    throw new SystemRuntimeErrorException(
                            SystemMessage.field("VALIDATION_REQUIRED_FIELD", "refinedText").build());
                }
                candidate.setRefinedText(request.getRefinedText());
                candidate.setPromotedFactId(promote(userId, request.getRefinedText(), candidate.getCategory()));
            }
            case LearnedFactEntity.DECISION_REJECT -> { /* decision only — nothing is promoted */ }
            default -> throw new IllegalStateException("Contract pattern guarantees a known decision");
        }
        candidate.setUserDecision(request.getDecision());
        return mapper.toFactCandidateResponse(learnedFactRepository.saveAndFlush(candidate));
    }

    private UUID promote(UUID userId, String factText, String category) {
        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setCreatedBy(userId);
        fact.setFactText(factText);
        fact.setCategory(category);
        fact.setSource(KnowledgeFactEntity.SOURCE_CHAT);
        return knowledgeFactRepository.saveAndFlush(fact).getId();
    }

    private LearnedFactEntity getOwned(UUID userId, UUID candidateId) {
        return learnedFactRepository.findByIdAndCreatedByAndDeletedFalse(candidateId, userId)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
