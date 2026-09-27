package io.mrkuhne.mezo.feature.character.service.chat;

import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
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
 * S7 (mezo-d6ivw.7): a committed USER line lets the ügy's owner answer — AFTER_COMMIT and
 * {@code @Async} (the {@link TeamChatEventListener} template: the reply request never waits for a
 * model call, and every failure is a {@code log.warn}). Waits {@code reply-debounce-ms} first, so a
 * burst of quick lines is answered once, by the newest line's event ({@link TeamChatReplyService#answer}
 * steps back when a newer USER line exists). Runs as the event's user ({@link LlmActorContext#runAs})
 * so the voice call's spend books against them.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
                FeaturesConfiguration.PROACTIVE_SWITCH, FeaturesConfiguration.INTERVENTION_SWITCH,
                FeaturesConfiguration.TEAM_CHAT_SWITCH},
        havingValue = "true")
public class TeamChatReplyListener {

    private final TeamChatReplyService replies;
    private final TeamChatProperties properties;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onReplied(TeamChatRepliedEvent event) {
        try {
            if (properties.replyDebounceMillis() > 0) {
                Thread.sleep(properties.replyDebounceMillis());
            }
            LlmActorContext.runAs(event.userId(),
                    () -> replies.answer(event.userId(), event.threadId(), event.lineId()));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Team chat answer interrupted for user {} ügy {}", event.userId(), event.threadId());
        } catch (Exception e) {
            log.warn("Team chat answer failed for user {} ügy {}", event.userId(), event.threadId(), e);
        }
    }
}
