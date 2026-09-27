package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.api.dto.ExpenditureExplanationResponse;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import io.mrkuhne.mezo.feature.goal.mapper.ExpenditureExplanationMapper;
import io.mrkuhne.mezo.feature.goal.repository.ExpenditureEstimateRepository;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * "Hogy tanultam?" (mezo-y72o3) — serves the caller's most recent reviewed week that carries a
 * persisted explanation. Owner-scoped like every goal read: the lookup is keyed on
 * {@code createdBy}, so another user's row is never visible. Nothing is computed here — the
 * explanation was built once in the weekly run ({@code ExpenditureExplainer}) and persisted as
 * jsonb; this is a plain read + mapping.
 */
@Service
@RequiredArgsConstructor
public class ExpenditureExplanationService {

    private final ExpenditureEstimateRepository expenditureEstimateRepository;
    private final ExpenditureExplanationMapper expenditureExplanationMapper;

    public Optional<ExpenditureExplanationResponse> getLatestExplanation(UUID userId) {
        return expenditureEstimateRepository
            .findFirstByCreatedByAndDeletedFalseAndExplanationIsNotNullOrderByWeekStartDesc(userId)
            .map(this::toResponse);
    }

    private ExpenditureExplanationResponse toResponse(ExpenditureEstimateEntity entity) {
        return expenditureExplanationMapper.toResponse(entity, entity.getExplanation());
    }
}
