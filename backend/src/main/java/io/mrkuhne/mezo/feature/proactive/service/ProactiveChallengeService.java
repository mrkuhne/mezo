package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.ChallengeDecisionRequest;
import io.mrkuhne.mezo.api.dto.ChallengeResponse;
import io.mrkuhne.mezo.feature.proactive.entity.ChallengeEntity;
import io.mrkuhne.mezo.feature.proactive.mapper.ProactiveMapper;
import io.mrkuhne.mezo.feature.proactive.repository.ChallengeRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The workout-challenge write + read path (proactive P2, bd mezo-hbwi): the session/day card read
 * (lazy first proposal when none exist for TODAY; lazy outcome resolution of accepted rows once the
 * instance is done; dismissed excluded — {@code []} is the honest empty, never 404) and the L2
 * accept/dismiss decision. Decision mirrors {@link ProactiveExperimentService#decide}
 * (fetch-owned-or-404 → proposed-state guard (409) → mutate → saveAndFlush).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class ProactiveChallengeService {

    private static final List<String> DISMISSED = List.of(ChallengeEntity.STATUS_DISMISSED);

    private final ChallengeRepository challengeRepository;
    private final ChallengeGenerator generator;
    private final ChallengeOutcomeEvaluator outcomeEvaluator;
    private final ProactiveMapper mapper;

    @Transactional
    public List<ChallengeResponse> getChallenges(UUID userId, UUID templateSessionId, LocalDate date) {
        List<ChallengeEntity> rows = challengeRepository
                .findByCreatedByAndTemplateSessionIdAndWorkoutDateOrderByGeneratedAtAsc(
                        userId, templateSessionId, date);
        if (rows.isEmpty() && date.equals(LocalDate.now())) {
            rows = generator.generate(userId, templateSessionId, date);   // lazy first proposal
        }
        LocalDate today = LocalDate.now();
        for (ChallengeEntity c : rows) {
            if (ChallengeEntity.STATUS_ACCEPTED.equals(c.getStatus())) {
                outcomeEvaluator.evaluate(c, today);                      // lazy resolve when instance is done
            }
        }
        return rows.stream()
                .filter(c -> !DISMISSED.contains(c.getStatus()))
                .map(mapper::toChallengeResponse).toList();
    }

    @Transactional
    public ChallengeResponse decide(UUID userId, UUID id, ChallengeDecisionRequest request) {
        ChallengeEntity c = challengeRepository.findByIdAndCreatedBy(id, userId)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("PROACTIVE_CHALLENGE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        if (!ChallengeEntity.STATUS_PROPOSED.equals(c.getStatus())) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("PROACTIVE_CHALLENGE_NOT_PROPOSED").build(), HttpStatus.CONFLICT);
        }
        switch (request.getDecision()) {
            case "accept" -> c.setStatus(ChallengeEntity.STATUS_ACCEPTED);
            case "dismiss" -> c.setStatus(ChallengeEntity.STATUS_DISMISSED);
            default -> throw new SystemRuntimeErrorException(
                    SystemMessage.field("VALIDATION_INVALID_VALUE", "decision").build());
        }
        return mapper.toChallengeResponse(challengeRepository.saveAndFlush(c));
    }
}
