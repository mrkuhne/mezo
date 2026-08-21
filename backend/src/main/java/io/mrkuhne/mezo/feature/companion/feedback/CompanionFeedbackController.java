package io.mrkuhne.mezo.feature.companion.feedback;

import io.mrkuhne.mezo.api.controller.CompanionFeedbackApi;
import io.mrkuhne.mezo.api.dto.MessageFeedbackResponse;
import io.mrkuhne.mezo.api.dto.PutFeedbackRequest;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/companion/feedback surface (bd mezo-b3pp.15) — rides {@code COMPANION_SWITCH} (no own
 * switch; it is a companion organ, spec §8.1). Thin delegation, ownership from the principal. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class CompanionFeedbackController implements CompanionFeedbackApi {

    private final MessageFeedbackService messageFeedbackService;
    private final CurrentUserId currentUserId;

    @Override
    public MessageFeedbackResponse putFeedback(PutFeedbackRequest putFeedbackRequest) {
        return messageFeedbackService.put(currentUserId.get(), putFeedbackRequest);
    }

    @Override
    public void deleteFeedback(String artifactKind, UUID artifactId) {
        messageFeedbackService.retract(currentUserId.get(), artifactKind, artifactId);
    }

    @Override
    public List<MessageFeedbackResponse> listFeedback(String kind, List<UUID> ids) {
        return messageFeedbackService.list(currentUserId.get(), kind, ids);
    }
}
