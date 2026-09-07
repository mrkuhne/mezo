package io.mrkuhne.mezo.feature.companion.controller;

import io.mrkuhne.mezo.api.controller.CompanionObservationApi;
import io.mrkuhne.mezo.api.dto.ObservationResponse;
import io.mrkuhne.mezo.api.dto.PatternReplyRequest;
import io.mrkuhne.mezo.api.dto.PatternReplyResponse;
import io.mrkuhne.mezo.feature.companion.reflection.service.ObservationFeedService;
import io.mrkuhne.mezo.feature.companion.reflection.service.ReflectionReplyService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/**
 * Reflexió S4 (mezo-eq85.4): the Észrevételek tab — the cards Mezo noticed, and the chip answer.
 *
 * <p>Gated on the REFLECTION switch as well as the companion one, because both collaborators are:
 * with Reflexió off there are no observations to serve, so the endpoint honestly disappears
 * instead of returning an empty list that looks like "nothing happened today".
 */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class CompanionObservationController implements CompanionObservationApi {

    private final ObservationFeedService observationFeedService;
    private final ReflectionReplyService reflectionReplyService;
    private final CurrentUserId currentUserId;

    @Override
    public List<ObservationResponse> listObservations(LocalDate date) {
        return observationFeedService.forDay(currentUserId.get(), date);
    }

    @Override
    public PatternReplyResponse replyToPattern(UUID patternId, PatternReplyRequest request) {
        return reflectionReplyService.reply(currentUserId.get(), patternId,
                request.getChoice(), request.getText());
    }
}
