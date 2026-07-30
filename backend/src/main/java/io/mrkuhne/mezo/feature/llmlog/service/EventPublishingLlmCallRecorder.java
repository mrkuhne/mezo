package io.mrkuhne.mezo.feature.llmlog.service;

import io.mrkuhne.mezo.feature.llmlog.event.LlmCallEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
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
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LLM_LOG_SWITCH, havingValue = "true")
public class EventPublishingLlmCallRecorder implements LlmCallRecorder {

    private final ApplicationEventPublisher applicationEventPublisher;
    private final LlmActorResolver llmActorResolver;

    @Override
    public void record(LlmCallRecord record) {
        applicationEventPublisher.publishEvent(
            new LlmCallEvent(record, llmActorResolver.currentActor(), Instant.now()));
    }
}
