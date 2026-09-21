package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterObservationRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;

import lombok.RequiredArgsConstructor;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CharacterReplySourceResolver {
    private final CharacterClaimRepository claims;
    private final CharacterObservationRepository observations;
    private final CharacterConferenceRepository conferences;
    private final CharacterDimensionRepository dimensions;

    private final tools.jackson.databind.ObjectMapper mapper;

    public record Source(
            String text, String evidence, String expertKey, String dimensionKey, UUID claimId) {}

    @Transactional(readOnly = true)
    public Source resolve(UUID owner, String type, UUID id, int index) {
        if (index < 0 || index > 9999 || (!java.util.List.of("CONFERENCE_CHANGE", "CONFERENCE_ITEM").contains(type) && index != 0))
            throw missing();
        return switch (type) {
            case "CLAIM" ->
                    claimSource(
                            owner,
                            claims.findByIdAndCreatedBy(id, owner)
                                    .orElseThrow(CharacterReplySourceResolver::missing));
            case "OBSERVATION" -> {
                var o =
                        observations
                                .findByIdAndCreatedBy(id, owner)
                                .orElseThrow(CharacterReplySourceResolver::missing);
                String key = o.getDimensionKeys().keys().stream().findFirst().orElse(null);
                yield new Source(
                        ObservationText.stripClaimIdPrefix(o.getText()),
                        mapper.writeValueAsString(o.getSignals()),
                        o.getExpertKey(),
                        key,
                        null);
            }
            case "CONFERENCE_ITEM" -> {
                var c = conferences.findByIdAndCreatedBy(id, owner).orElseThrow(CharacterReplySourceResolver::missing);
                var deliberation = DeliberationAssembler.forRead(c, claimId -> claims.findByIdAndCreatedBy(claimId, owner).isPresent());
                if (deliberation == null) throw missing();
                var thread = deliberation.threads().stream()
                        .filter(t -> t.items().stream().anyMatch(i -> i.index() == index)).findFirst().orElseThrow(CharacterReplySourceResolver::missing);
                var item = thread.items().stream().filter(i -> i.index() == index).findFirst().orElseThrow();
                UUID claimId = null;
                if (item.claimId() != null) {
                    try {
                        var parsed = UUID.fromString(item.claimId());
                        if (claims.findByIdAndCreatedBy(parsed, owner).isPresent()) claimId = parsed;
                    } catch (IllegalArgumentException ignored) { /* Legacy external ref remains context only. */ }
                }
                yield new Source(item.text(), mapper.writeValueAsString(item), item.expertKey(), thread.dimensionKey(), claimId);
            }
            case "CONFERENCE_CHANGE" -> {
                var c =
                        conferences
                                .findByIdAndCreatedBy(id, owner)
                                .orElseThrow(CharacterReplySourceResolver::missing);
                if (c.getOutcome() == null
                        || c.getOutcome().changes() == null
                        || index >= c.getOutcome().changes().size()) throw missing();
                var change = c.getOutcome().changes().get(index);
                UUID claimId = null;
                if (change.claimId() != null) {
                    try {
                        var parsed = UUID.fromString(change.claimId());
                        if (claims.findByIdAndCreatedBy(parsed, owner).isPresent())
                            claimId = parsed;
                    } catch (IllegalArgumentException ignored) {
                        /* Legacy non-UUID change. */
                    }
                }
                String expert =
                        change.dimensionKey() == null
                                ? "mezo"
                                : dimensions
                                        .findByCreatedByAndKey(owner, change.dimensionKey())
                                        .map(
                                                d ->
                                                        d.getExpertKey() == null
                                                                ? "mezo"
                                                                : d.getExpertKey())
                                        .orElse("mezo");
                yield new Source(
                        change.summary(),
                        mapper.writeValueAsString(change),
                        expert,
                        change.dimensionKey(),
                        claimId);
            }
            default -> throw missing();
        };
    }

    private Source claimSource(UUID owner, CharacterClaimEntity c) {
        String key =
                dimensions
                        .findByIdAndCreatedBy(c.getDimensionId(), owner)
                        .orElseThrow(CharacterReplySourceResolver::missing)
                        .getKey();
        return new Source(
                c.getText(),
                mapper.writeValueAsString(c.getEvidence()),
                c.getProposedBy(),
                key,
                c.getId());
    }

    static SystemRuntimeErrorException missing() {
        return new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }
}
