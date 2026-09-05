package io.mrkuhne.mezo.feature.companion.memory.controller;

import io.mrkuhne.mezo.api.controller.MemoryRetrievalApi;
import io.mrkuhne.mezo.api.dto.MemoryRetrievalFeedbackResponse;
import io.mrkuhne.mezo.api.dto.PutMemoryRetrievalFeedbackRequest;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryItemFeedbackService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** Authenticated beta-control surface for audited long-term-memory results. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryRetrievalController implements MemoryRetrievalApi {

    private final MemoryItemFeedbackService feedbackService;
    private final CurrentUserId currentUserId;

    @Override
    public List<MemoryRetrievalFeedbackResponse> listMemoryRetrievalFeedback(List<UUID> resultIds) {
        return feedbackService.list(currentUserId.get(), resultIds);
    }

    @Override
    public MemoryRetrievalFeedbackResponse putMemoryRetrievalFeedback(
            UUID runId, UUID resultId, PutMemoryRetrievalFeedbackRequest request) {
        return feedbackService.put(currentUserId.get(), runId, resultId, request);
    }
}
