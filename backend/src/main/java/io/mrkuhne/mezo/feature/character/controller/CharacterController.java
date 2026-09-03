package io.mrkuhne.mezo.feature.character.controller;

import io.mrkuhne.mezo.api.controller.CharacterApi;
import io.mrkuhne.mezo.api.dto.CharacterClaimDto;
import io.mrkuhne.mezo.api.dto.CharacterClaimFeedbackRequest;
import io.mrkuhne.mezo.api.dto.CharacterConferenceResponse;
import io.mrkuhne.mezo.api.dto.CharacterConferenceSummary;
import io.mrkuhne.mezo.api.dto.CharacterDimensionResponse;
import io.mrkuhne.mezo.api.dto.CharacterExpertsResponse;
import io.mrkuhne.mezo.api.dto.CharacterFeedItem;
import io.mrkuhne.mezo.api.dto.CharacterOverviewResponse;
import io.mrkuhne.mezo.api.dto.CharacterRunResponse;
import io.mrkuhne.mezo.api.dto.CharacterRunSummary;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.service.CharacterBootstrapService;
import io.mrkuhne.mezo.feature.character.service.CharacterFeedbackService;
import io.mrkuhne.mezo.feature.character.service.CharacterService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
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
    /**
     * {@link CharacterBootstrapService} is {@code @ConditionalOnProperty} on BOTH
     * {@code CHARACTER_SWITCH} and {@code COMPANION_SWITCH} (it runs an LLM konzílium), while this
     * controller is character-only — S1 deliberately kept the dossier READS companion-free (see
     * class javadoc). With companion off the bean is simply absent: an {@link ObjectProvider} lets
     * the controller (and every read method below) stay up regardless, and only
     * {@link #bootstrapCharacter()} degrades — honestly, as a 404, mirroring the house
     * companion-off idiom used across the codebase (e.g. {@code ProactiveApiCompanionOffIT}); never
     * a silent 200.
     */
    private final ObjectProvider<CharacterBootstrapService> characterBootstrapService;
    private final CharacterFeedbackService characterFeedbackService;
    private final CurrentUserId currentUserId;

    /**
     * The generated {@code CharacterApi} fixes {@code bootstrapCharacter()} to a single
     * {@code @ResponseStatus(200)} (spring-generator {@code useResponseEntity=false}, house-wide),
     * but the contract also declares a bodyless {@code 204} for "no history yet" — see
     * {@code api/feature/character/character.yml}. A {@link ResponseStatusException} is the
     * standard Spring escape hatch for that one path; {@code GlobalExceptionHandler} answers it
     * with the thrown status and no body. With companion off there is no bootstrap bean at all —
     * that is a 404 ({@code RESOURCE_NOT_FOUND}), not the "no history yet" 204: the feature is
     * unavailable, not merely empty.
     */
    @Override
    public CharacterConferenceResponse bootstrapCharacter() {
        CharacterBootstrapService bootstrapService = characterBootstrapService.getIfAvailable();
        if (bootstrapService == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
        }
        UUID owner = currentUserId.get();
        CharacterConferenceEntity conference = bootstrapService.run(owner);
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
    public CharacterExpertsResponse getCharacterExperts() {
        return characterService.experts();
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

    @Override
    public List<CharacterRunSummary> getCharacterRuns(LocalDate from, LocalDate to) {
        return characterService.runs(currentUserId.get(), from, to);
    }

    @Override
    public CharacterRunResponse getCharacterRun(UUID runId) {
        return characterService.run(currentUserId.get(), runId);
    }

    /**
     * {@link CharacterFeedbackService} is gated on {@code CHARACTER_SWITCH} alone (no LLM in this
     * path, mezo-1gim.10) — same switch as this controller itself — so unlike
     * {@link #bootstrapCharacter()} there is no companion-off degradation to handle here; the bean
     * is always present whenever this controller is.
     */
    @Override
    public CharacterClaimDto submitCharacterClaimFeedback(UUID claimId, CharacterClaimFeedbackRequest request) {
        CharacterClaimEntity claim = characterFeedbackService.apply(currentUserId.get(), claimId,
                request.getKind().getValue(), request.getText());
        return characterService.toClaimDto(claim);
    }
}
