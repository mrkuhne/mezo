package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.ExperimentDecisionRequest;
import io.mrkuhne.mezo.api.dto.ExperimentResponse;
import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.mapper.ProactiveMapper;
import io.mrkuhne.mezo.feature.proactive.repository.ExperimentRepository;
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
 * The experiment write + read path (P2): the list read (proposed/active/completed, newest first —
 * dismissed excluded; `[]` = honest empty, never 404, the P1 list precedent), the on-demand
 * propose ("+ Új kísérlet javasol Mezo"), and the L2 accept/dismiss decision. Decision mirrors the
 * companion PatternService.decide (fetch-owned-or-404 → proposed-state guard (409) → mutate).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class ProactiveExperimentService {

    private static final List<String> LIVE_STATUSES = List.of(
            ExperimentEntity.STATUS_PROPOSED, ExperimentEntity.STATUS_ACTIVE, ExperimentEntity.STATUS_COMPLETED);

    private static final List<String> OPEN_STATUSES = List.of(
            ExperimentEntity.STATUS_PROPOSED, ExperimentEntity.STATUS_ACTIVE);

    private final ExperimentRepository experimentRepository;
    private final ExperimentProposalGenerator generator;
    private final ProactiveMapper mapper;

    @Transactional
    public List<ExperimentResponse> getExperiments(UUID userId) {
        if (experimentRepository.countByCreatedByAndStatusIn(userId, OPEN_STATUSES) == 0) {
            generator.propose(userId);   // lazy first proposal; empty = honest
        }
        return experimentRepository.findByCreatedByAndStatusInOrderByGeneratedAtDesc(userId, LIVE_STATUSES)
                .stream().map(mapper::toExperimentResponse).toList();
    }

    @Transactional
    public List<ExperimentResponse> propose(UUID userId) {
        return generator.propose(userId).stream().map(mapper::toExperimentResponse).toList();
    }

    @Transactional
    public ExperimentResponse decide(UUID userId, UUID id, ExperimentDecisionRequest request) {
        ExperimentEntity e = experimentRepository.findByIdAndCreatedByAndDeletedFalse(id, userId)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("PROACTIVE_EXPERIMENT_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        if (!ExperimentEntity.STATUS_PROPOSED.equals(e.getStatus())) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("PROACTIVE_EXPERIMENT_NOT_PROPOSED").build(), HttpStatus.CONFLICT);
        }
        switch (request.getDecision()) {
            case "accept" -> {
                e.setStatus(ExperimentEntity.STATUS_ACTIVE);
                e.setStartDate(LocalDate.now());
            }
            case "dismiss" -> e.setStatus(ExperimentEntity.STATUS_DISMISSED);
            default -> throw new SystemRuntimeErrorException(
                    SystemMessage.field("VALIDATION_INVALID_VALUE", "decision").build());
        }
        return mapper.toExperimentResponse(experimentRepository.saveAndFlush(e));
    }
}
