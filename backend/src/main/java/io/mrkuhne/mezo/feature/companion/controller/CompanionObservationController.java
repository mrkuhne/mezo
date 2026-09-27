package io.mrkuhne.mezo.feature.companion.controller;

import io.mrkuhne.mezo.api.controller.CompanionObservationApi;
import io.mrkuhne.mezo.api.dto.KnowledgeObservationResponse;
import io.mrkuhne.mezo.api.dto.ObservationEvidenceItem;
import io.mrkuhne.mezo.api.dto.ObservationResponse;
import io.mrkuhne.mezo.api.dto.PatternReplyRequest;
import io.mrkuhne.mezo.api.dto.PatternReplyResponse;
import io.mrkuhne.mezo.feature.companion.reflection.service.KnowledgeObservationService;
import io.mrkuhne.mezo.feature.companion.reflection.service.ObservationFeedService;
import io.mrkuhne.mezo.feature.companion.reflection.service.ReflectionReplyService;
import io.mrkuhne.mezo.feature.companion.service.ForgetService;
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
    private final KnowledgeObservationService knowledgeObservationService;
    private final ForgetService forgetService;
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

    /** S6 (mezo-d6ivw.6): the Tudástár's Észrevételek section. */
    @Override
    public List<KnowledgeObservationResponse> listKnowledgeObservations() {
        return knowledgeObservationService.list(currentUserId.get());
    }

    /** S6: "Elfelejtem" on an observation — the row and its learned fact, for good. */
    @Override
    public void forgetObservation(UUID patternId) {
        forgetService.forgetObservation(currentUserId.get(), patternId);
    }

    /** S6: "Honnan tudom?" on a fact. */
    @Override
    public List<ObservationEvidenceItem> getFactEvidence(UUID factId) {
        return knowledgeObservationService.factEvidence(currentUserId.get(), factId);
    }
}
