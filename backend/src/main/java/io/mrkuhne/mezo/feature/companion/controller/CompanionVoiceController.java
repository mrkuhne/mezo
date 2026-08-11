package io.mrkuhne.mezo.feature.companion.controller;

import io.mrkuhne.mezo.api.controller.CompanionVoiceApi;
import io.mrkuhne.mezo.api.dto.TranscriptionResponse;
import io.mrkuhne.mezo.feature.companion.service.TranscriptionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** /api/companion/transcribe surface (mezo-at8x.4) — mappings from the generated {@link CompanionVoiceApi}. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class CompanionVoiceController implements CompanionVoiceApi {

    private final TranscriptionService service;
    private final CurrentUserId currentUserId;

    @Override
    public TranscriptionResponse transcribeVoiceNote(MultipartFile audio) {
        return service.transcribe(currentUserId.get(), audio);
    }
}
