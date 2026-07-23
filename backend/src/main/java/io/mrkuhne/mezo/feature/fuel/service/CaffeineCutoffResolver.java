package io.mrkuhne.mezo.feature.fuel.service;

import io.mrkuhne.mezo.feature.fuel.config.FuelSettingsProperties;
import io.mrkuhne.mezo.feature.fuel.repository.FuelSettingsRepository;
import java.time.LocalTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * The single caffeine-cutoff source (spec D3). Deliberately NOT gated on the fuel-settings switch:
 * the habit engine's no_stim_after metric must resolve even when /api/fuel/settings is off.
 */
@Component
@RequiredArgsConstructor
public class CaffeineCutoffResolver implements CaffeineCutoffPort {

    private final FuelSettingsRepository repository;
    private final FuelSettingsProperties properties;

    @Override
    public LocalTime resolve(UUID userId) {
        return repository.findByCreatedByAndDeletedFalse(userId)
            .map(e -> LocalTime.parse(e.getCaffeineCutoff()))
            .orElseGet(() -> LocalTime.parse(properties.defaultCaffeineCutoff()));
    }
}
