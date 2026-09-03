package io.mrkuhne.mezo.feature.nutrition.controller;

import io.mrkuhne.mezo.api.controller.DietSettingsApi;
import io.mrkuhne.mezo.api.dto.DietSettingsResponse;
import io.mrkuhne.mezo.api.dto.SetDietSettingsRequest;
import io.mrkuhne.mezo.feature.nutrition.service.DietSettingsService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/diet/settings surface (Diet Plan slice 1, mezo-xwgb) — mappings come from the generated {@link DietSettingsApi}. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.DIET_SETTINGS_SWITCH, havingValue = "true")
public class DietSettingsController implements DietSettingsApi {

    private final DietSettingsService service;
    private final CurrentUserId currentUserId;

    @Override
    public DietSettingsResponse getDietSettings() {
        return service.getSettings(currentUserId.get());
    }

    @Override
    public DietSettingsResponse setDietSettings(SetDietSettingsRequest setDietSettingsRequest) {
        return service.setSettings(currentUserId.get(), setDietSettingsRequest);
    }
}
