package io.mrkuhne.mezo.feature.companion.controller;

import io.mrkuhne.mezo.api.controller.CompanionEffectsApi;
import io.mrkuhne.mezo.api.dto.EffectMuteRequest;
import io.mrkuhne.mezo.api.dto.EffectResponse;
import io.mrkuhne.mezo.api.dto.PersonEffectsResponse;
import io.mrkuhne.mezo.feature.companion.reflection.entity.EffectLinkEntity;
import io.mrkuhne.mezo.feature.companion.reflection.service.EffectLinkService;
import io.mrkuhne.mezo.feature.companion.reflection.service.EffectMuteService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/**
 * Emlékezet S4 (mezo-d6ivw.4): the named-effect read surface for one person — the entities
 * {@link EffectLinkService#effectViews} already sorted strongest-first, with the serve-time
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

    private static final Set<String> VALID_SUBJECT_KINDS = Set.of(
            EffectLinkEntity.SUBJECT_PERSON, EffectLinkEntity.SUBJECT_EVENT);

    private final EffectLinkService effectLinkService;
    private final EffectMuteService effectMuteService;
    private final CurrentUserId currentUserId;

    @Override
    public PersonEffectsResponse listPersonEffects(UUID personId) {
        return new PersonEffectsResponse()
                .effects(effectLinkService.effectViews(currentUserId.get(), personId).stream()
                        .map(CompanionEffectsController::toResponse)
                        .toList());
    }

    @Override
    public void muteEffectSubject(String subjectKind, String subjectKey, EffectMuteRequest effectMuteRequest) {
        requireValidSubjectKind(subjectKind);
        effectMuteService.mute(currentUserId.get(), subjectKind, subjectKey, effectMuteRequest.getMode().getValue());
    }

    @Override
    public void unmuteEffectSubject(String subjectKind, String subjectKey) {
        requireValidSubjectKind(subjectKind);
        effectMuteService.unmute(currentUserId.get(), subjectKind, subjectKey);
    }

    private static void requireValidSubjectKind(String subjectKind) {
        if (!VALID_SUBJECT_KINDS.contains(subjectKind)) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.field("VALIDATION_INVALID_VALUE", "subjectKind").build());
        }
    }

    private static EffectResponse toResponse(EffectLinkService.EffectView view) {
        EffectLinkEntity row = view.row();
        return new EffectResponse()
                .metric(EffectResponse.MetricEnum.fromValue(row.getMetric()))
                .direction(row.getCliffsDelta().signum() > 0
                        ? EffectResponse.DirectionEnum.HIGHER : EffectResponse.DirectionEnum.LOWER)
                .strengthBand(EffectResponse.StrengthBandEnum.fromValue(row.getStrengthBand()))
                .confidenceTier(EffectResponse.ConfidenceTierEnum.fromValue(row.getConfidenceTier()))
                .meanDiff(row.getMeanDiff().doubleValue())
                .subjectDays(row.getSubjectDays())
                .complementDays(row.getComplementDays())
                .computedAt(OffsetDateTime.ofInstant(row.getComputedAt(), ZoneOffset.UTC))
                .subjectKind(EffectResponse.SubjectKindEnum.fromValue(row.getSubjectKind()))
                .subjectKey(row.getSubjectKey())
                .subjectLabel(view.subjectLabel())
                .muted(view.muted());
    }
}
