package io.mrkuhne.mezo.feature.character.controller;

import io.mrkuhne.mezo.api.controller.CharacterApi;
import io.mrkuhne.mezo.api.dto.CharacterConferenceResponse;
import io.mrkuhne.mezo.api.dto.CharacterConferenceSummary;
import io.mrkuhne.mezo.api.dto.CharacterDimensionResponse;
import io.mrkuhne.mezo.api.dto.CharacterFeedItem;
import io.mrkuhne.mezo.api.dto.CharacterOverviewResponse;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.service.CharacterBootstrapService;
import io.mrkuhne.mezo.feature.character.service.CharacterService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Karakter dossier reads (mezo-1gim slice 1) — mirrors {@code MeWeekController}: thin
 *  delegation to {@link CharacterService}, current-owner scoping via {@link CurrentUserId}. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CharacterController implements CharacterApi {

    private final CharacterService characterService;
    private final CharacterBootstrapService characterBootstrapService;
    private final CurrentUserId currentUserId;

    /**
     * The generated {@code CharacterApi} fixes {@code bootstrapCharacter()} to a single
     * {@code @ResponseStatus(200)} (spring-generator {@code useResponseEntity=false}, house-wide),
     * but the contract also declares a bodyless {@code 204} for "no history yet" — see
     * {@code api/feature/character/character.yml}. A {@link ResponseStatusException} is the
     * standard Spring escape hatch for that one path; {@code GlobalExceptionHandler} answers it
     * with the thrown status and no body.
     */
    @Override
    public CharacterConferenceResponse bootstrapCharacter() {
        UUID owner = currentUserId.get();
        CharacterConferenceEntity conference = characterBootstrapService.run(owner);
        if (conference == null) {
            throw new ResponseStatusException(HttpStatus.NO_CONTENT);
        }
        return characterService.conference(owner, conference.getId());
    }

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
