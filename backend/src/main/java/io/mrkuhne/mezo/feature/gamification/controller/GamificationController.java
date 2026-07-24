package io.mrkuhne.mezo.feature.gamification.controller;

import io.mrkuhne.mezo.api.controller.GamificationApi;
import io.mrkuhne.mezo.api.dto.GamificationDayResponse;
import io.mrkuhne.mezo.api.dto.GamificationProfileResponse;
import io.mrkuhne.mezo.feature.gamification.service.GamificationService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/gamification surface (bd mezo-huzd) — thin delegation; gated on GAMIFICATION_SWITCH. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.GAMIFICATION_SWITCH, havingValue = "true")
public class GamificationController implements GamificationApi {

    private final GamificationService gamificationService;
    private final CurrentUserId currentUserId;

    @Override
    public GamificationProfileResponse getGamificationProfile() {
        return gamificationService.getProfile(currentUserId.get());
    }

    @Override
    public GamificationDayResponse getGamificationDay(LocalDate date) {
        return gamificationService.getDay(currentUserId.get(), date);
    }

    @Override
    public GamificationProfileResponse buyTitle(String key) {
        return gamificationService.buyTitle(currentUserId.get(), key);
    }

    @Override
    public GamificationProfileResponse equipTitle(String key) {
        return gamificationService.equipTitle(currentUserId.get(), key);
    }

    @Override
    public GamificationProfileResponse buyStreakSaver() {
        return gamificationService.buySaver(currentUserId.get());
    }
}
