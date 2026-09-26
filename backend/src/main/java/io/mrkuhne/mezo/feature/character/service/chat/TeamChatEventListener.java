package io.mrkuhne.mezo.feature.character.service.chat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagClearedEvent;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaisedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Csapatfal Act III glue (mezo-a9bo7.21): a persisted flag raise opens an ügy, a persisted clear
 * resolves it. AFTER_COMMIT (only raises/clears that really persisted) and {@code @Async} off the
 * raising thread — the {@code InterventionEventListener} template: a chat failure must never
 * delay or break a check-in save, so every failure is a {@code log.warn}.
 *
 * <p>Both bodies run as the event's user ({@link LlmActorContext#runAs}, the
 * {@code CompanionMessageEventListener} precedent — final review I1, mezo-a9bo7.25): the async
 * thread carries no security context, so without it the voice call's {@code llm_log.created_by}
 * would be NULL and {@code TeamChatBudget} would never see the spend the monthly cap is about.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
                FeaturesConfiguration.PROACTIVE_SWITCH, FeaturesConfiguration.INTERVENTION_SWITCH,
                FeaturesConfiguration.TEAM_CHAT_SWITCH},
        havingValue = "true")
public class TeamChatEventListener {

    private final TeamChatService teamChatService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onFlagRaised(FlagRaisedEvent event) {
        try {
            LlmActorContext.runAs(event.userId(),
                    () -> teamChatService.open(event.userId(), event.flagKey(), Instant.now()));
        } catch (Exception e) {
            log.warn("Team chat open failed for user {} flag {}", event.userId(), event.flagKey(), e);
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onFlagCleared(FlagClearedEvent event) {
        try {
            LlmActorContext.runAs(event.userId(),
                    () -> teamChatService.resolve(event.userId(), event.flagKey(), event.evidence(), event.at()));
        } catch (Exception e) {
            log.warn("Team chat resolve failed for user {} flag {}", event.userId(), event.flagKey(), e);
        }
    }
}
