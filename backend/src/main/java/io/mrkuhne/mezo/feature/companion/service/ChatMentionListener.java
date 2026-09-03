package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.people.service.MentionDetectionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * S2 name-match a chat-forrásra (spec §3.2, bd mezo-06o0.1). Ez a listener a companion csomagban
 * él, NEM a people-ben: a companion→people él már létezik (Task 1/2 óta), egy people→companion él
 * viszont új ciklust zárna az ArchUnit slice-gráfon — ezért a payload-fogyasztó oldal települ ide,
 * a producer (companion) mellé. Kapuzás: PEOPLE ∧ COMPANION switch.
 *
 * <p>A {@link ChatTurnCompleted} payloadja hordozza a szöveget, nincs DB-újraolvasás: csak a USER
 * szavát matcheljük ({@code event.userContent()}) — a gép válasza sosem "a user említése", azt
 * matchelni hamis mentiont termelne. A ref {@code userMessageId}, mert a match-elt szöveg is a
 * user üzenete, nem az asszisztensé.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.PEOPLE_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class ChatMentionListener {

    private final MentionDetectionService mentionDetectionService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onChatTurnCompleted(ChatTurnCompleted event) {
        try {
            mentionDetectionService.detect(event.userId(), event.userContent(),
                    "chat", "chat_turn", event.userMessageId(), Instant.now());
        } catch (Exception e) {
            log.warn("Mention detection failed for chat turn {}", event.userMessageId(), e);
        }
    }
}
