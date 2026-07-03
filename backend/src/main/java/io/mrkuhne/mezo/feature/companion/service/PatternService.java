package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.PatternDecisionRequest;
import io.mrkuhne.mezo.api.dto.PatternResponse;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
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
        return mapper.toPatternResponse(patternRepository.saveAndFlush(pattern));
    }
}
