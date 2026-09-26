package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * S3 (mezo-d6ivw.3): a {@code FactExtractionListener} testvére — egy commitolt chat-forduló után
 * aszinkron kinyeri az ismert személyekről szóló tényeket. Ugyanaz a kapu-pár (companion +
 * extraction); a PEOPLE-függést a szerviz kezeli ObjectProviderrel. Hiba = warn + nyelés:
 * a kinyerés sosem érintheti a chat-fordulót.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.COMPANION_EXTRACTION_SWITCH},
        havingValue = "true")
public class PersonFactExtractionListener {

    private final PersonFactExtractionService personFactExtractionService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onChatTurnCompleted(ChatTurnCompleted event) {
        try {
            LlmActorContext.runAsCaptured(event.userId(), () -> personFactExtractionService.extractFromTurn(
                    event.userId(), event.userMessageId(), event.userContent(), event.assistantContent()));
        } catch (Exception e) {
            log.warn("Post-turn person-fact extraction failed for user {}", event.userId(), e);
        }
    }
}
