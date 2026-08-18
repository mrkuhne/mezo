package io.mrkuhne.mezo.feature.needs.controller;

import io.mrkuhne.mezo.api.controller.NeedsApi;
import io.mrkuhne.mezo.api.dto.NeedsCloseRequest;
import io.mrkuhne.mezo.api.dto.NeedsCloseResponse;
import io.mrkuhne.mezo.api.dto.NeedsSummaryResponse;
import io.mrkuhne.mezo.feature.needs.service.NeedsService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/needs surface (bd mezo-dhzk) — thin delegation, ownership from the principal;
 * gated on {@code NEEDS_SWITCH} (off ⇒ the whole surface 404s and no needs beans exist). */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.NEEDS_SWITCH, havingValue = "true")
public class NeedsController implements NeedsApi {

    private final NeedsService needsService;
    private final CurrentUserId currentUserId;

    @Override
    public NeedsCloseResponse closeNeedsDay(NeedsCloseRequest request) {
        return needsService.close(currentUserId.get(), request);
    }

    @Override
    public NeedsSummaryResponse getNeedsSummary() {
        return needsService.summary(currentUserId.get());
    }
}
