package io.mrkuhne.mezo.feature.companion.controller;

import io.mrkuhne.mezo.api.controller.CompanionObservationRecoveryApi;
import io.mrkuhne.mezo.api.dto.ObservationRecoveryRequest;
import io.mrkuhne.mezo.api.dto.ObservationRecoveryResponse;
import io.mrkuhne.mezo.feature.auth.service.CurrentUser;
import io.mrkuhne.mezo.feature.companion.reflection.service.ObservationRecoveryService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class ObservationRecoveryController implements CompanionObservationRecoveryApi {
    private final CurrentUser currentUser;
    private final ObservationRecoveryService recovery;

    @Override
    public ObservationRecoveryResponse recoverObservations(ObservationRecoveryRequest request) {
        var owner = currentUser.requireOwner().getId();
        return "preview".equals(request.getMode()) ? recovery.preview(owner)
                : recovery.apply(owner, request.getPlanId());
    }
}
