package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The twice-daily Pénz news poll (Boop Pénz L6, mezo-r36n9.104): 06:30 and 13:30 Europe/Budapest
 * ({@code mezo.penz.news.cron} / {@code .zone}). Exists only with both switches on — the feature
 * ({@link FeaturesConfiguration#PENZ_NEWS_SWITCH}) and the cron bean ({@link FeaturesConfiguration#PENZ_NEWS_JOB_SWITCH});
 * the body only hands off to {@link PenzNewsRunner#runAsync} so the scheduler thread is never held by network calls.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.PENZ_NEWS_SWITCH, FeaturesConfiguration.PENZ_NEWS_JOB_SWITCH},
    havingValue = "true")
public class PenzNewsJob {

    private final PenzNewsRunner runner;

    @Scheduled(cron = "${mezo.penz.news.cron:0 30 6,13 * * *}", zone = "${mezo.penz.news.zone:Europe/Budapest}")
    public void run() {
        runner.runAsync();
    }
}
