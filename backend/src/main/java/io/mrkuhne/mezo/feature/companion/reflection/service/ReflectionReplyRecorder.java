package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reflexió S3 (bd mezo-eq85.3, spec 2026-09-06 §4.3): the user's own words about a hypothesis,
 * captured from a seeded chat thread. This is the ONLY user-authored input to {@code belief} —
 * and it lands as an append-only EVENT, never as a status: what Daniel says is evidence the
 * lifecycle weighs, not a verdict that skips it.
 *
 * <p>Ownership is re-checked here rather than trusted from the conversation row: the pattern
 * reference is nullable-on-delete, so a stale anchor must write nothing at all.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class ReflectionReplyRecorder {

    /** Where the reply came from — the chip channel is Task 4's; this one is free prose. */
    public static final String CHANNEL_CHAT = "chat";

    /** The payload column is jsonb, but an unbounded chat turn has no business inside an event. */
    private static final int MAX_TEXT_CHARS = 2000;

    private final PatternRepository patternRepository;
    private final PatternEventRepository patternEventRepository;

    /** Appends one {@code user_reply} event; a missing/foreign pattern or blank text writes nothing. */
    @Transactional
    public void recordChatReply(UUID userId, UUID patternId, String text) {
        if (patternId == null || text == null || text.isBlank()) {
            return;
        }
        if (patternRepository.findByIdAndCreatedByAndDeletedFalse(patternId, userId).isEmpty()) {
            log.debug("Seeded conversation points at pattern {} which user {} cannot see — no reply event",
                    patternId, userId);
            return;
        }
        PatternEventEntity event = new PatternEventEntity();
        event.setCreatedBy(userId);
        event.setPatternId(patternId);
        event.setKind(PatternEventEntity.KIND_USER_REPLY);
        event.setPayload(PatternEventPayloadEnvelope.userReply(CHANNEL_CHAT, null, truncate(text)));
        patternEventRepository.saveAndFlush(event);
    }

    private static String truncate(String text) {
        return text.length() <= MAX_TEXT_CHARS ? text : text.substring(0, MAX_TEXT_CHARS);
    }
}
