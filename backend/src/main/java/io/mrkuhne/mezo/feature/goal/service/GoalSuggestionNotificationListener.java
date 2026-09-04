package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.service.AppNotificationEmitter;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/** Emits the feed row only after the new suggestion itself is durable. */
@Component
@RequiredArgsConstructor
public class GoalSuggestionNotificationListener {

    private final AppNotificationEmitter emitter;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onProposed(GoalSuggestionProposedEvent event) {
        emitter.emit(
            event.userId(),
            AppNotificationKind.GOAL_SUGGESTION,
            "Új javaslat a célodhoz",
            bodyFor(event.kind()),
            AppNotificationKind.GOAL_SUGGESTION.deeplink() + "/" + event.suggestionId(),
            event.suggestionId(),
            "goal_suggestion:" + event.suggestionId());
    }

    private String bodyFor(String kind) {
        return switch (kind) {
            case GoalSuggestionService.KIND_WEEKLY_CORRECTION -> "Heti korrekció";
            case GoalSuggestionService.KIND_PHASE_CHANGE -> "Szakaszváltás";
            default -> "Célhangolás";
        };
    }
}
