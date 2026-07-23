package io.mrkuhne.mezo.feature.biometrics.sleep.controller;

import io.mrkuhne.mezo.api.controller.SleepShotApi;
import io.mrkuhne.mezo.api.dto.SleepShotDraftResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepShotService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** /api/sleep/screenshot surface (mezo-66ab) — mappings come from the generated {@link SleepShotApi}. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.SLEEP_SHOT_SWITCH, havingValue = "true")
public class SleepShotController implements SleepShotApi {

    private final SleepShotService service;
    private final CurrentUserId currentUserId;

    @Override
    public SleepShotDraftResponse draftSleepFromScreenshot(MultipartFile photo) {
        return service.extract(currentUserId.get(), photo);
    }
}
