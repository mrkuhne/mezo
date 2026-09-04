package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInSavedEvent;
import io.mrkuhne.mezo.feature.train.service.SportSessionLoggedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Az azonnali ha–akkor triggerek belépője (mezo-iizd.7, a {@code FlagEvaluationListener} sablonja):
 * AFTER_COMMIT (csak megírt sorra reagálunk) és a kérés-szálon KÍVÜL ({@code @Async}), hogy egy
 * értesítés se lassíthassa vagy buktathassa a check-in / sport-session választ. A késleltetett
 * tervek nem itt, hanem a {@code LifeGoalEvalJob} következő futásában szólalnak meg (spec D-3).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalTriggerListener {

    private final LifeGoalTriggerService triggerService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCheckInSaved(CheckInSavedEvent event) {
        fire(event.userId(), LifeGoalTriggerRules.CHECKIN_ENERGY_LTE, event.date());
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onSportSessionLogged(SportSessionLoggedEvent event) {
        fire(event.userId(), LifeGoalTriggerRules.SPORT_SESSION_LOGGED, event.date());
    }

    private void fire(UUID userId, String triggerSource, LocalDate day) {
        try {
            triggerService.fireImmediate(userId, triggerSource, day);
        } catch (Exception e) {
            log.warn("Life-goal trigger evaluation after {} failed for user {}", triggerSource, userId, e);
        }
    }
}
