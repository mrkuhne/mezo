package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/** Test data factory for {@code pattern_event} rows (S1). */
@TestComponent
@RequiredArgsConstructor
public class PatternEventPopulator {

    private final PatternEventRepository patternEventRepository;

    public PatternEventEntity snapshot(UUID createdBy, UUID patternId,
                                       double r, int n, double p, Instant occurredAt) {
        PatternEventEntity entity = new PatternEventEntity();
        entity.setCreatedBy(createdBy);
        entity.setPatternId(patternId);
        entity.setKind(PatternEventEntity.KIND_SNAPSHOT);
        entity.setOccurredAt(occurredAt);
        entity.setPayload(PatternEventPayloadEnvelope.snapshot(r, n, p));
        return patternEventRepository.saveAndFlush(entity);
    }

    /** Reflexió S2 (mezo-eq85.2): the user's own answer about a pattern — the only user-authored
     *  input the lifecycle reads. */
    public PatternEventEntity userReply(UUID createdBy, UUID patternId,
                                        String channel, String choice, String text) {
        return userReply(createdBy, patternId, channel, choice, text, null);
    }

    /** Reflexió S4 (mezo-eq85.4): the observation feed classifies a card by whether a reply is
     *  OLDER than the observation event, so the reply's own time has to be seedable. */
    public PatternEventEntity userReply(UUID createdBy, UUID patternId, String channel,
                                        String choice, String text, Instant occurredAt) {
        return append(createdBy, patternId, PatternEventEntity.KIND_USER_REPLY,
                PatternEventPayloadEnvelope.userReply(channel, choice, text), occurredAt);
    }

    /** Reflexió S4: what the companion said out loud about a pattern; {@code surfaced} is whether
     *  it actually reached the user (an over-budget notice is stored but never shown). */
    public PatternEventEntity observation(UUID createdBy, UUID patternId, String text,
                                          List<String> evidenceRefs, boolean surfaced,
                                          Instant occurredAt) {
        return append(createdBy, patternId, PatternEventEntity.KIND_OBSERVATION,
                PatternEventPayloadEnvelope.observation(text, evidenceRefs, surfaced), occurredAt);
    }

    /** Any payload-less decision/lifecycle event ({@code confirmed}, {@code monitoring}, …). */
    public PatternEventEntity decision(UUID createdBy, UUID patternId, String kind, Instant occurredAt) {
        return append(createdBy, patternId, kind, PatternEventPayloadEnvelope.empty(), occurredAt);
    }

    private PatternEventEntity append(UUID createdBy, UUID patternId, String kind,
                                      PatternEventPayloadEnvelope payload, Instant occurredAt) {
        PatternEventEntity entity = new PatternEventEntity();
        entity.setCreatedBy(createdBy);
        entity.setPatternId(patternId);
        entity.setKind(kind);
        entity.setPayload(payload);
        if (occurredAt != null) {
            // timestamptz stores micros and ROUNDS nanos — truncate so the row read back equals
            // the instant the test seeded (mezo-mfmb, the PatternEventAppender lesson).
            entity.setOccurredAt(occurredAt.truncatedTo(ChronoUnit.MICROS));
        }
        return patternEventRepository.saveAndFlush(entity);
    }
}
