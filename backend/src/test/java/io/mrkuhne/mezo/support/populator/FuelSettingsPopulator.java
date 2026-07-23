package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.fuel.entity.FuelSettingsEntity;
import io.mrkuhne.mezo.feature.fuel.repository.FuelSettingsRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class FuelSettingsPopulator {

    private final FuelSettingsRepository fuelSettingsRepository;

    /** Any valid settings row — the ghost values. */
    public FuelSettingsEntity settings(UUID owner) {
        return settings(owner, 4, "14:00");
    }

    public FuelSettingsEntity settings(UUID owner, int mealsPerDay, String caffeineCutoff) {
        FuelSettingsEntity e = new FuelSettingsEntity();
        e.setCreatedBy(owner);
        e.setMealsPerDay(mealsPerDay);
        e.setCaffeineCutoff(caffeineCutoff);
        return fuelSettingsRepository.saveAndFlush(e);
    }
}
