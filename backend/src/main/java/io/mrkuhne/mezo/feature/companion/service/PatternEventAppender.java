package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * The ONE way a {@code pattern_event} row is appended (Reflexió S4, mezo-eq85.4). Extracted
 * because by S4 there were three hand-rolled copies of the same six lines
 * ({@code PatternService.recordEvent}, {@code HypothesisEvaluationService.record},
 * {@code ReflectionReplyRecorder}) and S4 would have added two more — the quick notice and the
 * chip reply. A single collaborator also pins the one detail that is easy to get subtly wrong:
 * {@code occurred_at} is truncated to MICROS, because {@code timestamptz} stores microseconds and
 * ROUNDS a nanosecond value, so an untruncated write no longer equals the row read back (the
 * {@code PatternEntity.lastDetectedAt} lesson, mezo-mfmb).
 *
 * <p>Deliberately NOT {@code @Transactional} and deliberately NOT switch-gated: it is a persistence
 * helper, so the CALLER's transaction (and the caller's own feature switch) decides everything.
 * It is also the reason it is a plain {@code @Component} in {@code companion/service} rather than
 * a method on {@code PatternService} — the reflection services would otherwise have to drag that
 * whole bean (and its seven collaborators) in just to write one row.
 */
@Component
@RequiredArgsConstructor
public class PatternEventAppender {

    private final PatternEventRepository patternEventRepository;

    /** Appends one event and returns it FLUSHED, so the caller can use its generated id. */
    public PatternEventEntity append(UUID userId, UUID patternId, String kind,
                                     PatternEventPayloadEnvelope payload) {
        PatternEventEntity event = new PatternEventEntity();
        event.setCreatedBy(userId);
        event.setPatternId(patternId);
        event.setKind(kind);
        event.setOccurredAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        event.setPayload(payload);
        return patternEventRepository.saveAndFlush(event);
    }
}
