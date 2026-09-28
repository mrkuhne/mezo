package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.service.AppNotificationEmitter;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * The Monday learning bell (mezo-3n2so Task 6, spec §5.2): emits the feed row for a worth-saying
 * reviewed week. {@code AdaptiveReviewJob} itself is not {@code @Transactional} — it publishes
 * after {@code ExpenditureLearningService.reviewWeek}'s own transaction has already committed —
 * so {@code fallbackExecution = true} (unlike the {@code GoalSuggestionNotificationListener}
 * precedent, which rides its producer's own transaction).
 */
@Component
@RequiredArgsConstructor
public class ExpenditureWeekNotificationListener {

    private final AppNotificationEmitter emitter;

    @Async
    @TransactionalEventListener(fallbackExecution = true)
    public void onLearned(ExpenditureWeekLearnedEvent event) {
        emitter.emit(
            event.userId(),
            AppNotificationKind.EXPENDITURE_WEEK,
            titleFor(event),
            "Nézd meg, mit tanultam a múlt hétből.",
            AppNotificationKind.EXPENDITURE_WEEK.deeplink(),
            event.estimateId(),
            "expenditure_week:" + event.weekStart());
    }

    private String titleFor(ExpenditureWeekLearnedEvent event) {
        if (event.stepKcal() != 0) {
            return String.format("Heti tanulás: %+d kcal", event.stepKcal());
        }
        if ("HOLDING".equals(event.status())) {
            return "Heti tanulás: kevés adat volt";
        }
        return "Heti tanulás: " + event.excludedCount() + " nap kimaradt";
    }
}
