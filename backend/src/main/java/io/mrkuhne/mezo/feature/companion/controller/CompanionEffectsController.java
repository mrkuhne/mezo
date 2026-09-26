package io.mrkuhne.mezo.feature.companion.controller;

import io.mrkuhne.mezo.api.controller.CompanionEffectsApi;
import io.mrkuhne.mezo.api.dto.EffectResponse;
import io.mrkuhne.mezo.api.dto.PersonEffectsResponse;
import io.mrkuhne.mezo.feature.companion.reflection.entity.EffectLinkEntity;
import io.mrkuhne.mezo.feature.companion.reflection.service.EffectLinkService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/**
 * Emlékezet S4 (mezo-d6ivw.4): the named-effect read surface for one person — the entities
 * {@link EffectLinkService#effectsForPerson} already sorted strongest-first, with the serve-time
 * confidence bump applied on a detached copy (never persisted).
 *
 * <p>Gated on the REFLECTION switch as well as the COMPANION one, mirroring
 * {@code CompanionObservationController}: with Reflexió off there is nothing named to serve.
 */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class CompanionEffectsController implements CompanionEffectsApi {

    private final EffectLinkService effectLinkService;
    private final CurrentUserId currentUserId;

    @Override
    public PersonEffectsResponse listPersonEffects(UUID personId) {
        return new PersonEffectsResponse()
                .effects(effectLinkService.effectsForPerson(currentUserId.get(), personId).stream()
                        .map(CompanionEffectsController::toResponse)
                        .toList());
    }

    private static EffectResponse toResponse(EffectLinkEntity row) {
        return new EffectResponse()
                .metric(row.getMetric())
                .direction(row.getCliffsDelta().signum() > 0 ? "higher" : "lower")
                .strengthBand(row.getStrengthBand())
                .confidenceTier(row.getConfidenceTier())
                .meanDiff(row.getMeanDiff().doubleValue())
                .subjectDays(row.getSubjectDays())
                .complementDays(row.getComplementDays())
                .computedAt(OffsetDateTime.ofInstant(row.getComputedAt(), ZoneOffset.UTC));
    }
}
