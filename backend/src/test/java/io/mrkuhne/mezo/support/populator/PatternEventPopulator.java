package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

import java.time.Instant;
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
}
