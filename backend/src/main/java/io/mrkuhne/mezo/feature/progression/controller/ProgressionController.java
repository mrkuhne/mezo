package io.mrkuhne.mezo.feature.progression.controller;

import io.mrkuhne.mezo.api.controller.ProgressionApi;
import io.mrkuhne.mezo.api.dto.GrowthWeekResponse;
import io.mrkuhne.mezo.api.dto.ProgressionProfileResponse;
import io.mrkuhne.mezo.feature.progression.service.GrowthWeekService;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read surface for the gamified-progression profile. The bean is present only when the engine is
 * switched on ({@code mezo.feature.progression.enabled}); with the switch off the endpoint 404s.
 */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.PROGRESSION_SWITCH, havingValue = "true")
public class ProgressionController implements ProgressionApi {

    private final ProgressionService progressionService;
    private final GrowthWeekService growthWeekService;
    private final CurrentUserId currentUserId;

    @Override
    public ProgressionProfileResponse getProfile() {
        return progressionService.getProfile(currentUserId.get());
    }

    @Override
    public GrowthWeekResponse getGrowthWeek(LocalDate date) {
        return growthWeekService.growthWeek(currentUserId.get(), date);
    }
}
