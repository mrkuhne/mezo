package io.mrkuhne.mezo.feature.nutrition.controller;

import io.mrkuhne.mezo.api.controller.SensitivityApi;
import io.mrkuhne.mezo.api.dto.SensitivityProfileRequest;
import io.mrkuhne.mezo.api.dto.SensitivityProfileResponse;
import io.mrkuhne.mezo.feature.nutrition.service.SensitivityService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** /api/sensitivity surface (Boop B4, mezo-r36n9.14) — mappings come from the generated {@link SensitivityApi}. */
@RestController
@RequiredArgsConstructor
public class SensitivityController implements SensitivityApi {

    private final SensitivityService service;
    private final CurrentUserId currentUserId;

    @Override
    public SensitivityProfileResponse getSensitivityProfile() {
        return service.getResponse(currentUserId.get());
    }

    @Override
    public SensitivityProfileResponse setSensitivityProfile(SensitivityProfileRequest sensitivityProfileRequest) {
        return service.setResponse(currentUserId.get(), sensitivityProfileRequest);
    }
}
