package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * P2 experiment crons: weekly proposal + daily deterministic outcome evaluation (the P1
 * two-methods-one-switch idiom). Per-user failures isolated; idempotence via the propose cap +
 * the outcome window-close guard.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH,
                FeaturesConfiguration.EXPERIMENT_JOB_SWITCH},
        havingValue = "true")
public class ExperimentJob {

    private final AppUserRepository appUserRepository;
    private final ExperimentProposalGenerator generator;
    private final ExperimentOutcomeService outcomeService;

    @Scheduled(cron = "${mezo.proactive.experiment.propose-cron}")
    public void runPropose() {
        int proposed = 0;
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                proposed += generator.propose(user.getId()).size();
            } catch (Exception e) {
                log.warn("Experiment proposal failed for user {}", user.getId(), e);
            }
        }
        log.info("Experiment propose run: {} experiment(s) proposed", proposed);
    }

    @Scheduled(cron = "${mezo.proactive.experiment.outcome-cron}")
    public void runOutcome() {
        LocalDate today = LocalDate.now();
        int closed = 0;
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                closed += outcomeService.evaluateClosed(user.getId(), today);
            } catch (Exception e) {
                log.warn("Experiment outcome eval failed for user {} on {}", user.getId(), today, e);
            }
        }
        log.info("Experiment outcome run for {}: {} experiment(s) completed", today, closed);
    }
}
