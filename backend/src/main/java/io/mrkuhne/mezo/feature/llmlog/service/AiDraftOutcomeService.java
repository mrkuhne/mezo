package io.mrkuhne.mezo.feature.llmlog.service;

import io.mrkuhne.mezo.api.dto.AiDraftOutcomeRequest;
import io.mrkuhne.mezo.feature.llmlog.repository.AiDraftOutcomeRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Upserts the one outcome signal per (owner, draftId) — Slice 8 Task 1 (bd mezo-76f6). No GET:
 * admin reads the aggregate via {@link AiDraftOutcomeRepository} directly (Task 2).
 */
@Service
@RequiredArgsConstructor
public class AiDraftOutcomeService {

    private final AiDraftOutcomeRepository repository;

    @Transactional
    public void recordOutcome(UUID userId, UUID draftId, AiDraftOutcomeRequest request) {
        repository.upsertOutcome(userId, request.getFeature(), draftId, request.getOutcome());
    }
}
