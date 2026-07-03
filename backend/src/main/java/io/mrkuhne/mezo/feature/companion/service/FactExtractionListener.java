package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * The V1.2 post-turn trigger: after a chat turn commits, extract fact candidates asynchronously.
 * Gated on BOTH the companion switch and {@code mezo.companion.extraction.enabled} — flipping
 * extraction off removes this bean, so no post-turn LLM call can ever happen. Failures are
 * logged and swallowed: extraction must never affect a chat turn.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.COMPANION_EXTRACTION_SWITCH},
        havingValue = "true")
public class FactExtractionListener {

    private final FactExtractionService factExtractionService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onChatTurnCompleted(ChatTurnCompleted event) {
        try {
            factExtractionService.extractFromTurn(
                    event.userId(), event.userMessageId(), event.userContent(), event.assistantContent());
        } catch (Exception e) {
            log.warn("Post-turn fact extraction failed for user {}", event.userId(), e);
        }
    }
}
