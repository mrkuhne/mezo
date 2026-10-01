package io.mrkuhne.mezo.feature.character.service.chat;

import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactChangedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * mezo-d6ivw.11: a knowledge fact changed (Tudástár toggle, edit, forget, mute, merge) — the
 * csapatfal exceptions remembered as that fact follow it ({@link TeamChatExceptionService#followFact}).
 * AFTER_COMMIT and {@code @Async}, the {@code GraphPromotionListener} template: the fact write never
 * waits for it, and every failure is a {@code log.warn}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
                FeaturesConfiguration.PROACTIVE_SWITCH, FeaturesConfiguration.INTERVENTION_SWITCH,
                FeaturesConfiguration.TEAM_CHAT_SWITCH},
        havingValue = "true")
public class TeamChatFactMirrorListener {

    private final TeamChatExceptionService exceptions;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onKnowledgeFactChanged(KnowledgeFactChangedEvent event) {
        try {
            exceptions.followFact(event.userId(), event.factId());
        } catch (Exception e) {
            log.warn("Team chat exception mirror failed for fact {} of user {}", event.factId(), event.userId(), e);
        }
    }
}
