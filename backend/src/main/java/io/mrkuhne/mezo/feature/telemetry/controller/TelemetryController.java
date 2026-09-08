package io.mrkuhne.mezo.feature.telemetry.controller;

import io.mrkuhne.mezo.api.controller.TelemetryApi;
import io.mrkuhne.mezo.api.dto.ScreenEventBatchRequest;
import io.mrkuhne.mezo.feature.telemetry.service.ScreenEventService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/**
 * The screen-event WRITE surface (bd mezo-o5cz) — mappings come from the generated
 * {@link TelemetryApi}. Off by default: with {@code mezo.feature.screen-telemetry.enabled} unset
 * this bean does not exist and {@code POST /api/telemetry/screen-events} is a 404, which the
 * frontend client swallows silently.
 *
 * <p>The owner of every written row is {@link CurrentUserId#get()} — the authenticated principal,
 * never anything from the payload (spec T5); the request body has no owner field to begin with.
 */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.SCREEN_TELEMETRY_SWITCH, havingValue = "true")
public class TelemetryController implements TelemetryApi {

    private final ScreenEventService service;
    private final CurrentUserId currentUserId;

    @Override
    public void ingestScreenEvents(ScreenEventBatchRequest screenEventBatchRequest) {
        service.ingest(currentUserId.get(), screenEventBatchRequest.getEvents());
    }
}
