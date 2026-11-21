package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import java.time.LocalDate;
import java.time.ZoneId;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The season experiments' daily pass (Boop B6 Évad S4, spec §5.9): at 04:40 in the Boop zone every owner with an
 * active season gets his due experiment finished and, when the season allows it, at most one proposal. Not the
 * proactive {@code ExperimentJob} (switched off by spec §5.12-2). One owner's failure never stops the others; each
 * owner is his own transaction ({@link ExperimentService#daily}).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "mezo.season.experiment-job.enabled", havingValue = "true")
public class SeasonExperimentJob {

    private final SeasonRepository seasons;
    private final ExperimentService experimentService;
    private final WearableProperties wearableProperties;

    @Scheduled(cron = "0 40 4 * * *", zone = "${mezo.wearable.zone:Europe/Budapest}")
    public void run() {
        LocalDate today = LocalDate.now(ZoneId.of(wearableProperties.zone()));
        for (SeasonEntity s : seasons.findByStatus(SeasonEntity.STATUS_ACTIVE)) {
            try {
                experimentService.daily(s.getCreatedBy(), today);
            } catch (RuntimeException e) {
                log.warn("Season experiment pass failed for season {}", s.getId(), e);
            }
        }
    }
}
