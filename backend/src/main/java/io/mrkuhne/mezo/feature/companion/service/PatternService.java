package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.PatternDecisionRequest;
import io.mrkuhne.mezo.api.dto.PatternResponse;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.mapper.CompanionMapper;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * V3.1 pattern inbox: the list read + the Confirm/Monitor/Reject L2 decision. Unlike fact
 * candidates a pattern is a STANDING judgement — transitions between the three user states are
 * repeatable (a rejected pattern can be re-opened to monitoring, etc.); the nightly job only
 * refreshes {@code proposed}/{@code monitoring} rows.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PatternService {

    private static final Map<String, String> DECISION_TO_STATUS = Map.of(
            "confirm", PatternEntity.STATUS_CONFIRMED,
            "monitor", PatternEntity.STATUS_MONITORING,
            "reject", PatternEntity.STATUS_REJECTED);

    private final PatternRepository patternRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final CompanionMapper mapper;

    public List<PatternResponse> list(UUID userId) {
        return patternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(userId)
                .stream()
                .map(mapper::toPatternResponse)
                .toList();
    }

    @Transactional
    public PatternResponse decide(UUID userId, UUID patternId, PatternDecisionRequest request) {
        PatternEntity pattern = patternRepository.findByIdAndCreatedByAndDeletedFalse(patternId, userId)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("COMPANION_PATTERN_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        String status = DECISION_TO_STATUS.get(request.getDecision());
        if (status == null) {
            // unreachable while the contract pattern holds — honest 400 if it ever drifts
            throw new SystemRuntimeErrorException(
                    SystemMessage.field("VALIDATION_INVALID_VALUE", "decision").build());
        }
        pattern.setStatus(status);
        // V3.3: the learning loop closes — a FIRST confirm promotes the pattern into a durable
        // knowledge fact (source=pattern, linked back); later un-confirms leave the fact alone
        // (it is Daniel's knowledge now — the Knowledge tab owns its lifecycle).
        if (PatternEntity.STATUS_CONFIRMED.equals(status) && pattern.getPromotedFactId() == null) {
            pattern.setPromotedFactId(promote(userId, pattern));
        }
        return mapper.toPatternResponse(patternRepository.saveAndFlush(pattern));
    }

    /** v1 category heuristic: physiology/trigger → health, response → train (documented). */
    private UUID promote(UUID userId, PatternEntity pattern) {
        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setCreatedBy(userId);
        fact.setFactText(pattern.getTitle());
        fact.setCategory("response".equals(pattern.getCategory()) ? "train" : "health");
        fact.setSource(KnowledgeFactEntity.SOURCE_PATTERN);
        return knowledgeFactRepository.saveAndFlush(fact).getId();
    }
}
