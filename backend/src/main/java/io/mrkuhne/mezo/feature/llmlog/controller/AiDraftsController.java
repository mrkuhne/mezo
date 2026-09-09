package io.mrkuhne.mezo.feature.llmlog.controller;

import io.mrkuhne.mezo.api.controller.AiDraftsApi;
import io.mrkuhne.mezo.api.dto.AiDraftOutcomeRequest;
import io.mrkuhne.mezo.feature.llmlog.service.AiDraftOutcomeService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/**
 * /api/ai-drafts surface (Slice 8 Task 1, bd mezo-76f6) — mappings come from the generated
 * {@link AiDraftsApi}. USER-facing (no {@code requireOwner}): the outcome row is created under
 * the caller's own identity, ownership from the principal — not an admin view.
 */
@RestController
@RequiredArgsConstructor
public class AiDraftsController implements AiDraftsApi {

    private final AiDraftOutcomeService service;
    private final CurrentUserId currentUserId;

    @Override
    public void recordAiDraftOutcome(UUID draftId, AiDraftOutcomeRequest aiDraftOutcomeRequest) {
        service.recordOutcome(currentUserId.get(), draftId, aiDraftOutcomeRequest);
    }
}
