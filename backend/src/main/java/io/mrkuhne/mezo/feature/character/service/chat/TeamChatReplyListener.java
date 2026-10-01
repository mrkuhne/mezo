package io.mrkuhne.mezo.feature.character.service.chat;

import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * S7 (mezo-d6ivw.7): a committed USER line lets the ügy's owner answer — AFTER_COMMIT, and the
 * answer runs on Boot's {@code applicationTaskExecutor} (the reply request never waits for a model
 * call, and every failure is a {@code log.warn}). Debounced by {@code reply-debounce-ms}, so a
 * burst of quick lines is answered once, by the newest line's event ({@link TeamChatReplyService#answer}
 * steps back when a newer USER line exists). Runs as the event's user ({@link LlmActorContext#runAs})
 * so the voice call's spend books against them.
 *
 * <p>mezo-d6ivw.11: the debounce is a DELAYED SUBMIT ({@link CompletableFuture#delayedExecutor}),
 * not a {@code Thread.sleep} on an {@code @Async} thread — a sleeping pool thread per USER line
 * held a shared executor slot for the whole debounce, starving every other async listener during
 * a burst. Now no pool thread is taken until the answer actually runs.
 */
@Slf4j
@Component
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
                FeaturesConfiguration.PROACTIVE_SWITCH, FeaturesConfiguration.INTERVENTION_SWITCH,
                FeaturesConfiguration.TEAM_CHAT_SWITCH},
        havingValue = "true")
public class TeamChatReplyListener {

    private final TeamChatReplyService replies;
    private final TeamChatProperties properties;
    private final Executor executor;

    public TeamChatReplyListener(TeamChatReplyService replies, TeamChatProperties properties,
            @Qualifier("applicationTaskExecutor") Executor executor) {
        this.replies = replies;
        this.properties = properties;
        this.executor = executor;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onReplied(TeamChatRepliedEvent event) {
        long debounce = properties.replyDebounceMillis();
        Executor target = debounce > 0
                ? CompletableFuture.delayedExecutor(debounce, TimeUnit.MILLISECONDS, executor)
                : executor;
        try {
            target.execute(() -> answer(event));
        } catch (RuntimeException e) {
            log.warn("Team chat answer not scheduled for user {} ügy {}", event.userId(), event.threadId(), e);
        }
    }

    private void answer(TeamChatRepliedEvent event) {
        try {
            LlmActorContext.runAs(event.userId(),
                    () -> replies.answer(event.userId(), event.threadId(), event.lineId()));
        } catch (Exception e) {
            log.warn("Team chat answer failed for user {} ügy {}", event.userId(), event.threadId(), e);
        }
    }
}
