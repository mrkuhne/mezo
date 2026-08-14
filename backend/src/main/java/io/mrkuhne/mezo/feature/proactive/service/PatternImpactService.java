package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.PatternImpactFact;
import io.mrkuhne.mezo.api.dto.PatternImpactRef;
import io.mrkuhne.mezo.api.dto.PatternImpactResponse;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.service.PatternImpactSource;
import io.mrkuhne.mezo.feature.proactive.repository.ChallengeRepository;
import io.mrkuhne.mezo.feature.proactive.repository.ExperimentRepository;
import io.mrkuhne.mezo.feature.proactive.repository.PredictionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * mezo-tk88.3: the proactive-side implementation of {@link PatternImpactSource} — assembles the
 * pattern detail page's "what came of this" block (the promoted knowledge fact + every
 * prediction/experiment/challenge grounded on the pattern). Lives here (not in
 * {@code feature.companion}) because it reads {@code feature.proactive} repositories; see
 * {@link PatternImpactSource}'s javadoc for why the dependency is inverted through that interface.
 *
 * <p>Conditioned on {@code COMPANION_SWITCH} ONLY — the SAME switch as
 * {@code PatternPairDetailService}, deliberately NOT ALSO {@code PROACTIVE_SWITCH}. The detail
 * page's impact block must resolve to a bean whenever the companion is on, even if the proactive
 * generators are off; in that case it honestly lists nothing (the repositories are plain Spring
 * Data beans, unconditioned, so the finder calls themselves are always safe).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PatternImpactService implements PatternImpactSource {

    private final KnowledgeFactRepository knowledgeFactRepository;
    private final PredictionRepository predictionRepository;
    private final ExperimentRepository experimentRepository;
    private final ChallengeRepository challengeRepository;

    @Override
    @Transactional(readOnly = true)
    public PatternImpactResponse impact(UUID userId, PatternEntity row) {
        PatternImpactResponse.PatternImpactResponseBuilder builder = PatternImpactResponse.builder()
                .fact(null).predictions(List.of()).experiments(List.of()).challenges(List.of());
        if (row == null) {
            return builder.build();
        }
        if (row.getPromotedFactId() != null) {
            knowledgeFactRepository.findById(row.getPromotedFactId())
                    .filter(f -> !f.isDeleted())
                    .ifPresent(f -> builder.fact(PatternImpactFact.builder()
                            .id(f.getId())
                            .text(f.getFactText())
                            .reinforcementCount(f.getReinforcementCount())
                            .includeInPrompt(f.isIncludeInPrompt())
                            .build()));
        }
        builder.predictions(predictionRepository
                .findByCreatedByAndSourcePatternIdAndDeletedFalse(userId, row.getId()).stream()
                .map(e -> PatternImpactRef.builder().id(e.getId()).title(e.getTitle()).status(e.getStatus()).build())
                .toList());
        builder.experiments(experimentRepository
                .findByCreatedByAndSourcePatternIdAndDeletedFalse(userId, row.getId()).stream()
                .map(e -> PatternImpactRef.builder().id(e.getId()).title(e.getTitle()).status(e.getStatus()).build())
                .toList());
        builder.challenges(challengeRepository
                .findByCreatedByAndSourcePatternIdAndDeletedFalse(userId, row.getId()).stream()
                .map(e -> PatternImpactRef.builder().id(e.getId()).title(e.getTitle()).status(e.getStatus()).build())
                .toList());
        return builder.build();
    }
}
