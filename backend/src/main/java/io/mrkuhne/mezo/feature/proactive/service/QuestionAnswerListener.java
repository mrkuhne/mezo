package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.feature.companion.feedback.service.MessageFeedbackRecordedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Round 2 S5 (bd mezo-d58h.7.5): the answer hop. AFTER_COMMIT (only a verdict that persisted is an
 * answer) and {@code @Async} off the request thread (the {@code CompanionMessageEventListener}
 * precedent) — remembering a fact must never slow down or fail a 👍 tap.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class QuestionAnswerListener {

    private final QuestionAnswerService questionAnswerService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onFeedbackRecorded(MessageFeedbackRecordedEvent event) {
        if (!MessageFeedbackEntity.KIND_FEED_MESSAGE.equals(event.artifactKind())) {
            return;
        }
        try {
            questionAnswerService.record(event.userId(), event.artifactId(), event.verdict());
        } catch (Exception e) {
            log.warn("Question-answer recording failed for user {}", event.userId(), e);
        }
    }
}
