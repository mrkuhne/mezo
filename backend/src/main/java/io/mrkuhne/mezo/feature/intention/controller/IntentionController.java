package io.mrkuhne.mezo.feature.intention.controller;

import io.mrkuhne.mezo.api.controller.IntentionApi;
import io.mrkuhne.mezo.api.dto.AddFocusRequest;
import io.mrkuhne.mezo.api.dto.IntentionCreedResponse;
import io.mrkuhne.mezo.api.dto.IntentionDayResponse;
import io.mrkuhne.mezo.api.dto.IntentionFocusResponse;
import io.mrkuhne.mezo.api.dto.ReflectRequest;
import io.mrkuhne.mezo.api.dto.SetCreedRequest;
import io.mrkuhne.mezo.feature.intention.service.IntentionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/intention surface (bd mezo-a686) — thin delegation, ownership from the principal;
 * gated on {@code INTENTION_SWITCH} (off ⇒ the whole surface 404s and no intention beans exist). */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.INTENTION_SWITCH, havingValue = "true")
public class IntentionController implements IntentionApi {

    private final IntentionService intentionService;
    private final CurrentUserId currentUserId;

    @Override
    public IntentionDayResponse getIntentionDay(LocalDate date) {
        return intentionService.getDay(currentUserId.get(), date);
    }

    @Override
    public IntentionCreedResponse setCreed(SetCreedRequest request) {
        return intentionService.setCreed(currentUserId.get(), request.getText());
    }

    @Override
    public IntentionFocusResponse addFocus(AddFocusRequest request) {
        return intentionService.addFocus(currentUserId.get(), request.getDate(), request.getText());
    }

    @Override
    public void removeFocus(UUID id) {
        intentionService.removeFocus(currentUserId.get(), id);
    }

    @Override
    public IntentionDayResponse reflect(ReflectRequest request) {
        return intentionService.reflect(currentUserId.get(), request.getDate(),
            request.getValue() == null ? null : request.getValue().getValue());
    }
}
