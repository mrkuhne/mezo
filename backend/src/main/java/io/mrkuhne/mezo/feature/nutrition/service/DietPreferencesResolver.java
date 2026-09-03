package io.mrkuhne.mezo.feature.nutrition.service;

import io.mrkuhne.mezo.feature.goal.engine.service.DietPreferences;
import io.mrkuhne.mezo.feature.goal.engine.service.DietPreferencesPort;
import io.mrkuhne.mezo.feature.nutrition.config.DietSettingsProperties;
import io.mrkuhne.mezo.feature.nutrition.repository.DietSettingsRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * The single diet-preference derivation — deliberately UN-gated (the fuel-settings caffeine-resolver
 * idiom): the goal engine and the fuel-day targets must always resolve preferences, feature switch
 * or not. No row → the config ghost, which reproduces pre-slice-1 behavior exactly. Implements the
 * goal engine's {@link DietPreferencesPort} (ADR 0012 — consumer-owned port, spec §6.2): nutrition
 * adapts to the goal-owned port instead of the goal engine importing this concrete resolver.
 */
@Service
@RequiredArgsConstructor
public class DietPreferencesResolver implements DietPreferencesPort {

    private final DietSettingsRepository repository;
    private final DietSettingsProperties properties;

    @Override
    public DietPreferences resolve(UUID userId) {
        return repository.findByCreatedByAndDeletedFalse(userId)
            .map(e -> new DietPreferences(e.getSplitPreset(), e.getProteinPctX10(), e.getCarbsPctX10(),
                e.getFatPctX10(), e.getProteinTier(), e.getWaterMl(), e.getFiberG(),
                e.getDayTypeShiftKcal()))
            .orElseGet(() -> new DietPreferences(properties.defaultSplitPreset(), null, null, null,
                properties.defaultProteinTier(), properties.defaultWaterMl(), properties.defaultFiberG(),
                properties.defaultDayTypeShiftKcal()));
    }
}
