package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * P1 prediction crons: weekly Monday-morning generation + daily deterministic window-close
 * validation (the H1 two-methods-one-switch idiom). Both today/current-week only, no backfill;
 * idempotent; per-user failures isolated.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH,
                FeaturesConfiguration.PREDICTION_JOB_SWITCH},
        havingValue = "true")
public class PredictionJob {

    private final AppUserRepository appUserRepository;
    private final PredictionGenerator generator;
    private final PredictionValidationService validationService;

    @Scheduled(cron = "${mezo.proactive.prediction.cron}")
    public void runWeekly() {
        LocalDate weekStart = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        int generated = 0;
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                generated += generator.generate(user.getId(), weekStart).size();
            } catch (Exception e) {
                log.warn("Prediction generation failed for user {} week {}", user.getId(), weekStart, e);
            }
        }
        log.info("Prediction weekly run for {}: {} prediction(s) generated", weekStart, generated);
    }

    @Scheduled(cron = "${mezo.proactive.prediction.validation-cron}")
    public void runValidation() {
        LocalDate today = LocalDate.now();
        int closed = 0;
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                closed += validationService.validateClosedWindows(user.getId(), today);
            } catch (Exception e) {
                log.warn("Prediction validation failed for user {} on {}", user.getId(), today, e);
            }
        }
        log.info("Prediction validation run for {}: {} window(s) closed", today, closed);
    }
}
