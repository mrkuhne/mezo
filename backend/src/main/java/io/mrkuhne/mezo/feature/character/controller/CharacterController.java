package io.mrkuhne.mezo.feature.character.controller;

import io.mrkuhne.mezo.api.controller.CharacterApi;
import io.mrkuhne.mezo.api.dto.CharacterConferenceResponse;
import io.mrkuhne.mezo.api.dto.CharacterConferenceSummary;
import io.mrkuhne.mezo.api.dto.CharacterDimensionResponse;
import io.mrkuhne.mezo.api.dto.CharacterFeedItem;
import io.mrkuhne.mezo.api.dto.CharacterOverviewResponse;
import io.mrkuhne.mezo.feature.character.service.CharacterService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** Karakter dossier reads (mezo-1gim slice 1) — mirrors {@code MeWeekController}: thin
 *  delegation to {@link CharacterService}, current-owner scoping via {@link CurrentUserId}. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CharacterController implements CharacterApi {

    private final CharacterService characterService;
    private final CurrentUserId currentUserId;

    @Override
    public CharacterOverviewResponse getCharacterOverview() {
        return characterService.overview(currentUserId.get());
    }

    @Override
    public CharacterDimensionResponse getCharacterDimension(String key) {
        return characterService.dimension(currentUserId.get(), key);
    }

    @Override
    public List<CharacterFeedItem> getCharacterFeed(Integer limit) {
        return characterService.feed(currentUserId.get(), limit == null ? 30 : Math.min(limit, 100));
    }

    @Override
    public List<CharacterConferenceSummary> listCharacterConferences() {
        return characterService.conferences(currentUserId.get());
    }

    @Override
    public CharacterConferenceResponse getCharacterConference(UUID conferenceId) {
        return characterService.conference(currentUserId.get(), conferenceId);
    }
}
