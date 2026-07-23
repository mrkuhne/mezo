package io.mrkuhne.mezo.feature.fuel.controller;

import io.mrkuhne.mezo.api.controller.FuelSettingsApi;
import io.mrkuhne.mezo.api.dto.FuelSettingsResponse;
import io.mrkuhne.mezo.api.dto.SetFuelSettingsRequest;
import io.mrkuhne.mezo.feature.fuel.service.FuelSettingsService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/fuel/settings surface (mezo-53su) — mappings come from the generated {@link FuelSettingsApi}. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.FUEL_SETTINGS_SWITCH, havingValue = "true")
public class FuelSettingsController implements FuelSettingsApi {

    private final FuelSettingsService service;
    private final CurrentUserId currentUserId;

    @Override
    public FuelSettingsResponse getFuelSettings() {
        return service.getSettings(currentUserId.get());
    }

    @Override
    public FuelSettingsResponse setFuelSettings(SetFuelSettingsRequest setFuelSettingsRequest) {
        return service.setSettings(currentUserId.get(), setFuelSettingsRequest);
    }
}
