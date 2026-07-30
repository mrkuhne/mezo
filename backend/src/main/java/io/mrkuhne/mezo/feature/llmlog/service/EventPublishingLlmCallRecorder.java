package io.mrkuhne.mezo.feature.llmlog.service;

import io.mrkuhne.mezo.feature.llmlog.event.LlmCallEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/**
 * The live recorder (switch on): resolves the actor on the CALLING thread — the only thread that
 * still has a security context — and hands the record to the application event bus, where
 * {@code LlmLogWriter}'s {@code @Async} listener picks it up off the request path (mezo-2zyu).
 *
 * <p>Publishing is intentionally NOT transactional: an audit row must survive a rolled-back user
 * transaction (a failed call is exactly what we most want logged).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LLM_LOG_SWITCH, havingValue = "true")
public class EventPublishingLlmCallRecorder implements LlmCallRecorder {

    private final ApplicationEventPublisher applicationEventPublisher;
    private final LlmActorResolver llmActorResolver;

    /**
     * The guard that makes {@link LlmCallRecorder}'s fire-and-forget promise true.
     *
     * <p>{@code publishEvent} is SYNCHRONOUS on the caller's thread and the multicaster has no
     * {@code ErrorHandler}, so anything the listener side raises before the async hop lands comes
     * straight back here: a {@code TaskRejectedException} from a saturated or already-shut-down
     * {@code llmLogExecutor}, a listener-resolution failure, an {@code @Async} proxy error. None of
     * those are the user's problem — losing an audit row is the correct trade, breaking the LLM call
     * is not.
     */
    @Override
    public void record(LlmCallRecord record) {
        try {
            applicationEventPublisher.publishEvent(
                new LlmCallEvent(record, llmActorResolver.currentActor(), Instant.now()));
        } catch (Exception ex) {
            log.warn("llm-log event publish failed, dropping audit row: {}", ex.toString());
        }
    }
}
