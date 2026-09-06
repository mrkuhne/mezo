package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.medication.service.MedicationCycleService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * W1 Monday-dawn pre-generation: the CURRENT week's suggestion per user (gathered from the
 * finished previous week). Idempotent; per-user failures isolated; the lazy GET covers misses.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH,
                FeaturesConfiguration.WEEKLY_SUGGESTION_JOB_SWITCH},
        havingValue = "true")
public class WeeklySuggestionJob {

    private final UserFanOut userFanOut;
    private final WeeklySuggestionGenerator generator;

    @Scheduled(cron = "${mezo.proactive.weekly.cron}")
    public void run() {
        // mezo-ned9: owner-local, the SAME derivation the gathered snapshot day uses.
        LocalDate weekStart = LocalDate.now(MedicationCycleService.MEDICATION_ZONE)
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        AtomicInteger generated = new AtomicInteger();
        userFanOut.forEachActiveUser("Weekly suggestion", user -> {
            try {
                if (generator.generate(user.getId(), weekStart) != null) {
                    generated.incrementAndGet();
                }
            } catch (Exception e) {
                log.warn("Weekly suggestion failed for user {} week {}", user.getId(), weekStart, e);
            }
        });
        log.info("Weekly-suggestion run for {}: {} suggestion(s) present", weekStart, generated.get());
    }
}
