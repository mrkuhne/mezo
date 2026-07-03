package io.mrkuhne.mezo.feature.companion.embedding;

import io.mrkuhne.mezo.feature.companion.service.ChatTurnCompleted;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.LocalDate;

/**
 * The V2.2 post-turn embedding trigger (the {@code FactExtractionListener} idiom): after a chat
 * turn commits, embed it into the episodic memory asynchronously. Gated on BOTH the companion
 * switch and {@code mezo.companion.embedding.embed-chat-turns} — flipping it off removes this
 * bean, so no post-turn embedding call can ever happen. Failures are logged and swallowed:
 * memory building must never affect a chat turn. Missed turns self-heal via the nightly job's
 * catch-up pass.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.COMPANION_EMBED_TURNS_SWITCH},
        havingValue = "true")
public class TurnEmbeddingListener {

    private final MemoryEmbeddingWriter memoryEmbeddingWriter;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onChatTurnCompleted(ChatTurnCompleted event) {
        try {
            memoryEmbeddingWriter.writeTurn(event.userId(), event.assistantMessageId(),
                    event.userContent(), event.assistantContent(), LocalDate.now());
        } catch (Exception e) {
            log.warn("Post-turn embedding failed for user {}", event.userId(), e);
        }
    }
}
