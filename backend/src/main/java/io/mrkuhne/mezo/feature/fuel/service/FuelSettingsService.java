package io.mrkuhne.mezo.feature.fuel.service;

import io.mrkuhne.mezo.api.dto.FuelSettingsResponse;
import io.mrkuhne.mezo.api.dto.SetFuelSettingsRequest;
import io.mrkuhne.mezo.feature.fuel.config.FuelSettingsProperties;
import io.mrkuhne.mezo.feature.fuel.entity.FuelSettingsEntity;
import io.mrkuhne.mezo.feature.fuel.repository.FuelSettingsRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.FUEL_SETTINGS_SWITCH, havingValue = "true")
public class FuelSettingsService {

    private final FuelSettingsRepository repository;
    private final FuelSettingsProperties properties;

    /** Config-default ghost when unset — never 404: every user has working planner settings. */
    public FuelSettingsResponse getSettings(UUID userId) {
        return repository.findByCreatedByAndDeletedFalse(userId)
            .map(e -> compose(e.getMealsPerDay(), e.getCaffeineCutoff()))
            .orElseGet(() -> compose(properties.defaultMealsPerDay(), properties.defaultCaffeineCutoff()));
    }

    @Transactional
    public FuelSettingsResponse setSettings(UUID userId, SetFuelSettingsRequest req) {
        FuelSettingsEntity row = repository.findByCreatedByAndDeletedFalse(userId)
            .orElseGet(() -> {
                FuelSettingsEntity e = new FuelSettingsEntity();
                e.setCreatedBy(userId); // server-side from principal, never from client
                return e;
            });
        row.setMealsPerDay(req.getMealsPerDay());
        row.setCaffeineCutoff(req.getCaffeineCutoff());
        repository.save(row);
        return compose(row.getMealsPerDay(), row.getCaffeineCutoff());
    }

    private static FuelSettingsResponse compose(int mealsPerDay, String caffeineCutoff) {
        return FuelSettingsResponse.builder()
            .mealsPerDay(mealsPerDay)
            .caffeineCutoff(caffeineCutoff)
            .build();
    }
}
