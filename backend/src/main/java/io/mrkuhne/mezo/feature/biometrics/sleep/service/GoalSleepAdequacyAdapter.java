package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepGoalEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.engine.port.SleepAdequacyPort;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Sleep-side implementation of the goal engine's {@link SleepAdequacyPort}. Same deficit math as
 * companion's {@code FlagEvaluator.sleepDebt} (sleep_log.date is the WAKE morning, so the row
 * dated today IS last night; a long night never repays a short one; unlogged nights are skipped,
 * never counted debt-free) — but over the adaptive-review window ({@code mezo.goal.adaptive}),
 * independent of the companion switch.
 */
@Component
@RequiredArgsConstructor
public class GoalSleepAdequacyAdapter implements SleepAdequacyPort {

    /** Ghost when no sleep_goal row exists — mirrors the flag config's default-goal-hours. */
    private static final double DEFAULT_GOAL_HOURS = 8.0;

    private final SleepLogRepository sleepLogRepository;
    private final SleepGoalRepository sleepGoalRepository;
    private final GoalEngineProperties props;

    @Override
    public boolean sleepDebted(UUID userId, LocalDate today) {
        GoalEngineProperties.Adaptive cfg = props.adaptive();
        LocalDate from = today.minusDays(cfg.sleepDebtNights() - 1L);

        double goalHours = sleepGoalRepository.findByCreatedByAndDeletedFalse(userId)
            .map(SleepGoalEntity::getTargetMinutes)
            .map(minutes -> minutes / 60.0)
            .orElse(DEFAULT_GOAL_HOURS);

        int logged = 0;
        double deficit = 0;
        for (SleepLogEntity log : sleepLogRepository
                .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(userId, from, today)) {
            if (log.getDurationH() == null) {
                continue;
            }
            logged++;
            deficit += Math.max(0, goalHours - log.getDurationH().doubleValue()); // a long night never repays a short one
        }
        return logged >= cfg.sleepDebtMinNights() && deficit >= cfg.sleepDebtDeficitHours();
    }
}
